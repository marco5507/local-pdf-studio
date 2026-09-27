from pathlib import Path
import json, time
import pypdfium2 as pdfium
from pypdf import PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
import io, random

root=Path('test-artifacts'); root.mkdir(exist_ok=True)
results={}
for name in ['edited','flattened']:
    path=root/f'{name}.pdf'
    doc=pdfium.PdfDocument(str(path))
    for i in range(len(doc)):
        doc[i].render(scale=1.3).to_pil().save(root/f'{name}-{i+1}.png')
    reader=PdfReader(str(path))
    results[name]={'pages':len(reader.pages),'text':'\n'.join(p.extract_text() for p in reader.pages),'annotations':[len(p.get('/Annots',[])) for p in reader.pages]}
    doc.close()

c=canvas.Canvas(str(root/'200-pages.pdf'),pagesize=(595,842))
for i in range(200):
    c.setFont('Helvetica',24);c.drawString(40,770,f'Local PDF Studio - Performance {i+1}')
    c.setFont('Helvetica',11)
    for line in range(45):c.drawString(40,725-line*14,f'Page {i+1} line {line+1}: Searchable document text for a local rendering test.')
    c.showPage()
c.save()

# Deterministic image-heavy fixture near the planned 50 MB target.
rng=random.Random(20260908)
c=canvas.Canvas(str(root/'50mb-scanned.pdf'),pagesize=(595,842),pageCompression=0)
for i in range(18):
    data=rng.randbytes(1450*2000*3);im=Image.frombytes('RGB',(1450,2000),data)
    stream=io.BytesIO();im.save(stream,format='JPEG',quality=90);stream.seek(0)
    c.drawImage(ImageReader(stream),0,0,595,842);c.showPage()
c.save()
results['fixtures']={p.name:p.stat().st_size for p in [root/'200-pages.pdf',root/'50mb-scanned.pdf']}
(root/'independent-pdf-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in results.items() if k=='fixtures'}))
