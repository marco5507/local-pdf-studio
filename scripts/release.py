"""Package the build and corresponding extension source. Run after npm run build."""
from pathlib import Path
import shutil, zipfile, json, hashlib

project=Path(__file__).resolve().parents[1]
output=project.parents[1]/'outputs'/'Local-PDF-Studio'
output.mkdir(parents=True,exist_ok=True)
extension=output/'extension'
shutil.copytree(project/'dist',extension,dirs_exist_ok=True)
for name in ['README.md','VALIDATION.md','LICENSE','THIRD-PARTY-NOTICES.md']:
    shutil.copy2(project/name,output/name)
allowed_scripts={'package.mjs','qa-build.mjs','icons.py','pdf-qa.py','check-local-pdf.ts','release.py'}
source_files=[project/name for name in ['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','qa.html','README.md','VALIDATION.md','LICENSE','THIRD-PARTY-NOTICES.md']]
for folder in ['src','public','tests']:
    source_files += [p for p in (project/folder).rglob('*') if p.is_file()]
source_files += [project/'scripts'/n for n in sorted(allowed_scripts)]
with zipfile.ZipFile(output/'Local-PDF-Studio-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in source_files:z.write(p,'local-pdf-studio/'+p.relative_to(project).as_posix())
with zipfile.ZipFile(output/'Local-PDF-Studio-extension.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(extension.rglob('*')):
        if p.is_file():z.write(p,'extension/'+p.relative_to(extension).as_posix())
    for name in ['README.md','VALIDATION.md','LICENSE','THIRD-PARTY-NOTICES.md']:z.write(output/name,name)
manifest=json.loads((extension/'manifest.json').read_text())
assert manifest['manifest_version']==3
for path in [manifest['background']['service_worker'],manifest['options_page'].split('#')[0]]:
    assert (extension/path).is_file()
for archive in output.glob('*.zip'):
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert not any('drive-user-test' in n or 'node_modules' in n or 'test-artifacts' in n for n in z.namelist())
checksums={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in output.glob('*.zip')}
(output/'checksums.json').write_text(json.dumps(checksums,indent=2))
print(json.dumps({'output':str(output),'archives':checksums},indent=2))
