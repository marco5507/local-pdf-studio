import {fontName,type FontName} from './fonts.ts';
import {inQuad,type StudyNote} from './annotations.ts';
import * as m from 'mupdf';
import type {Edit,Rect,Point,Style,SessionInfo,PageInfo,Mark,RenderResult,TextSpan,InkEdit} from './types';

const supported=new Set(['Highlight','Underline','StrikeOut','Text','FreeText','Square','Circle','Line','Ink','Stamp']);
const color=(c:number[])=>c as m.Color;
const quad=(r:Rect):m.Quad=>[r[0],r[1],r[2],r[1],r[0],r[3],r[2],r[3]];
const copiedBuffer=(b:m.Buffer)=>{try{return new Uint8Array(b.asUint8Array());}finally{b.destroy();}};
const uid=()=>crypto.randomUUID();
const str=(o:m.PDFObject,k:string)=>o.get(k).asString();

export class PDFEngine {
 doc!:m.PDFDocument; revision=0; password=''; encrypted=false; original=new Uint8Array();
 private fonts=new Map<FontName,m.Font>();
 readonly latin=new m.Font('Helvetica'); readonly cjk=new m.Font('zh-Hant');
 private readonlyReason=''; private permissions={print:true,copy:true};
 open(bytes:Uint8Array,password=''){
  const doc=m.Document.openDocument(bytes,'application/pdf').asPDF() as m.PDFDocument|null;
  if(!doc)throw new Error('This file is not a PDF.');
  const encrypted=doc.needsPassword()||!!doc.getMetaData('encryption')&&!/^None$/i.test(doc.getMetaData('encryption')||'');
  if(doc.needsPassword()&&!doc.authenticatePassword(password)){doc.destroy();throw Object.assign(new Error(password?'Incorrect PDF password.':'Password required'),{code:'PASSWORD'});}
  if(!doc.countPages()){doc.destroy();throw new Error('This PDF has no pages.');}
  this.doc?.destroy();this.doc=doc;this.password=password;this.encrypted=encrypted;this.original=new Uint8Array(bytes);this.revision=0;
  doc.disableJS();this.permissions={print:doc.hasPermission('print'),copy:doc.hasPermission('copy')};
  this.readonlyReason='';
  if(['edit','annotate','form','assemble'].some(p=>!doc.hasPermission(p as m.DocumentPermission)))this.readonlyReason='Document permissions restrict editing.';
  const root=doc.getTrailer().get('Root');
  if(!root.get('AcroForm','XFA').isNull())this.readonlyReason='XFA forms are read-only in this release.';
  for(let n=0;n<doc.countPages();n++){
   const p=doc.loadPage(n);try{for(const w of p.getWidgets())if(w.getFieldType()==='signature'&&!w.getObject().getInheritable('V').isNull())this.readonlyReason='Digitally signed PDFs are read-only.';}finally{p.destroy();}
  }
  // Scan signature dictionaries as signatures may not have visible widgets.
  for(let n=1;n<doc.countObjects();n++){const o=doc.newIndirect(n);try{if(o.get('Type').asName()==='Sig'&&!o.get('ByteRange').isNull())this.readonlyReason='Digitally signed PDFs are read-only.';}finally{o.destroy();}}
  if(!this.readonlyReason){doc.beginOperation('Initialize identities');for(let i=0;i<doc.countPages();i++){const o=doc.findPage(i);if(o.get('LPSPageID').isNull())o.put('LPSPageID',doc.newString(uid()));o.destroy();}doc.endOperation();doc.enableJournal();}
  return this.info();
 }
 info():SessionInfo{
  const pages:PageInfo[]=[];
  for(let n=0;n<this.doc.countPages();n++){
   const p=this.doc.loadPage(n);try{
    pages.push({id:str(p.getObject(),'LPSPageID')||`page-${p.getObject().asIndirect()}`,bounds:p.getBounds(),rotation:p.getObject().getInheritable('Rotate').asNumber(),marks:p.getAnnotations().filter(a=>a.getType()!=='Popup').map(a=>this.mark(a)),fields:p.getWidgets().map((w,id)=>({id,type:w.getFieldType(),label:w.getLabel()||w.getName()||`Field ${id+1}`,rect:w.getBounds(),value:w.getValue()||'',options:w.isChoice()?w.getOptions(false):[],readOnly:w.isReadOnly(),checked:(w.isCheckbox()||w.isRadioButton())&&!['','Off'].includes(w.getObject().get('AS').asName()),multiline:w.isText()&&w.isMultiline()})),links:p.getLinks().map(l=>{let uri=l.getURI();if(uri.startsWith('#')){try{uri=`#page=${this.doc.resolveLink(uri)+1}`;}catch{}}const v={rect:l.getBounds(),uri};l.destroy();return v;})});
   }finally{p.destroy();}
  }
  const outline=(items:any[]):any[]=>items.map(i=>({title:i.title||'',page:i.uri?this.doc.resolveLink(i.uri):i.page??0,children:i.down?outline(i.down):undefined}));
  return {pages,outline:outline(this.doc.loadOutline()||[]),readOnly:!!this.readonlyReason,reason:this.readonlyReason,canPrint:this.permissions.print,canCopy:this.permissions.copy,undo:!this.readonlyReason&&this.doc.canUndo(),redo:!this.readonlyReason&&this.doc.canRedo(),revision:this.revision,encrypted:this.encrypted};
 }
 mark(a:m.PDFAnnotation):Mark{
  const type=a.getType(),o=a.getObject();let fontSize=14;
  if(type==='FreeText')fontSize=a.getDefaultAppearance().size||14;
  return {id:a.getName()||String(o.asIndirect()),type,rect:a.getBounds(),color:type==='FreeText'?a.getDefaultAppearance().color:a.getColor(),opacity:a.getOpacity(),contents:a.getContents(),width:a.hasBorder()?a.getBorderWidth():1,fontSize,font:type==='FreeText'?fontName(str(o,'LPSFont')||a.getDefaultAppearance().font):undefined,textOverflow:type==='FreeText'&&o.get('LPSTextOverflow').asBoolean(),editable:supported.has(type)&&!(a.getFlags()&(m.PDFAnnotation.IS_READ_ONLY|m.PDFAnnotation.IS_LOCKED|m.PDFAnnotation.IS_LOCKED_CONTENTS)),ink:type==='Ink'?a.getInkList():undefined,quads:a.hasQuadPoints()?a.getQuadPoints():undefined,group:str(o,'LPSGroup')||undefined};
 }
 render(page:number,scale:number,text=true,hideMarks:string[]=[],inkEdits:InkEdit[]=[]):RenderResult{
  const p=this.doc.loadPage(page);try{
   const bounds=p.getBounds();scale=Math.max(.05,Math.min(scale,Math.sqrt(14_000_000/((bounds[2]-bounds[0])*(bounds[3]-bounds[1])))));
   let pix:m.Pixmap;
   if(hideMarks.length||inkEdits.length){
    const hidden=new Set(hideMarks),replacements=new Map(inkEdits.map(e=>[e.id,e.ink])),list=new m.DisplayList(bounds),device=new m.DisplayListDevice(list);
    try{p.runPageContents(device,m.Matrix.identity);for(const a of p.getAnnotations()){const id=a.getName()||String(a.getObject().asIndirect());if(a.getType()==='Ink'&&replacements.has(id)){const path=new m.Path();for(const stroke of replacements.get(id)!){if(!stroke.length)continue;path.moveTo(...stroke[0]);for(const point of stroke.slice(1))path.lineTo(...point);}const state=new m.StrokeState({lineCap:'Round',lineJoin:'Round',lineWidth:a.getBorderWidth(),miterLimit:10}),c=a.getColor();device.strokePath(path,state,m.Matrix.identity,c.length===1?m.ColorSpace.DeviceGray:c.length===4?m.ColorSpace.DeviceCMYK:m.ColorSpace.DeviceRGB,color(c.length?c:[0,0,0]),a.getOpacity());state.destroy();path.destroy();}else if(!hidden.has(id))a.run(device,m.Matrix.identity);}p.runPageWidgets(device,m.Matrix.identity);device.close();pix=list.toPixmap(m.Matrix.scale(scale,scale),m.ColorSpace.DeviceRGB,true);}finally{device.destroy();list.destroy();}
   }else pix=p.toPixmap(m.Matrix.scale(scale,scale),m.ColorSpace.DeviceRGB,true,true);
   const result:RenderResult={width:pix.getWidth(),height:pix.getHeight(),pixels:new Uint8ClampedArray(pix.getPixels()),spans:[]};pix.destroy();
   if(text&&this.permissions.copy){const structured=p.toStructuredText('');let chars:TextSpan[]=[];
    structured.walk({onChar:(c,_o,_f,size,q)=>chars.push({text:c,size,rect:[Math.min(q[0],q[2],q[4],q[6]),Math.min(q[1],q[3],q[5],q[7]),Math.max(q[0],q[2],q[4],q[6]),Math.max(q[1],q[3],q[5],q[7])]}),endLine:()=>{result.spans.push(...chars);chars=[];}});structured.destroy();
   }return result;
  }finally{p.destroy();m.shrinkStore(75);}
 }
 study(page:number):StudyNote[]{
  if(!this.permissions.copy)throw new Error('Document permissions restrict text extraction.');
  const p=this.doc.loadPage(page);try{
   const marks=p.getAnnotations().map(a=>this.mark(a)).filter(a=>['Highlight','Underline','StrikeOut'].includes(a.type)||a.contents.trim());
   const rows:StudyNote[]=marks.map(a=>({id:a.id,page,type:a.type,color:a.color,text:'',contents:a.contents}));
   if(marks.some(a=>a.quads?.length)){
    const text=p.toStructuredText('');try{text.walk({onChar:(c,_o,_f,_s,q)=>{const center:Point=[(q[0]+q[2]+q[4]+q[6])/4,(q[1]+q[3]+q[5]+q[7])/4];marks.forEach((a,i)=>{if(a.quads?.some(quad=>inQuad(center,quad)))rows[i].text+=c;});},endLine:()=>{rows.forEach(r=>{if(r.text&&!r.text.endsWith('\n'))r.text+='\n';});}});}finally{text.destroy();}
   }
   return rows.map(r=>({...r,text:r.text.trim()}));
  }finally{p.destroy();}
 }
 search(query:string){if(!this.permissions.copy)throw new Error('Document permissions restrict text extraction.');const results:{page:number;quads:number[][][]}[]=[];if(!query.trim())return results;for(let i=0;i<this.doc.countPages();i++){const p=this.doc.loadPage(i);try{const hits=p.search(query,'');for(const a of p.getAnnotations())if(a.getContents().toLocaleLowerCase().includes(query.toLocaleLowerCase()))hits.push([quad(a.getBounds())]);if(hits.length)results.push({page:i,quads:hits});}finally{p.destroy();}}return results;}
 private textAppearance(a:m.PDFAnnotation,text:string,size:number,c:number[],face:FontName='Helvetica'){
  let latin=this.fonts.get(face);if(!latin){latin=face==='Helvetica'?this.latin:new m.Font(face);this.fonts.set(face,latin);}
  const r=a.getRect(),list=new m.DisplayList(r),dev=new m.DisplayListDevice(list),obj=new m.Text();
  if(a.getType()==='Widget'){
   const mk=a.getObject().get('MK'),bg=mk.get('BG').asJS(),bc=mk.get('BC').asJS();const path=new m.Path();path.rect(r[0]+.5,r[1]+.5,r[2]-.5,r[3]-.5);
   if(Array.isArray(bg)&&bg.length)dev.fillPath(path,false,m.Matrix.identity,bg.length===1?m.ColorSpace.DeviceGray:m.ColorSpace.DeviceRGB,bg as m.Color,1);
   if(Array.isArray(bc)&&bc.length){const stroke=new m.StrokeState({lineCap:'Butt',lineJoin:'Miter',lineWidth:a.getBorderWidth()||1,miterLimit:10});dev.strokePath(path,stroke,m.Matrix.identity,bc.length===1?m.ColorSpace.DeviceGray:m.ColorSpace.DeviceRGB,bc as m.Color,1);stroke.destroy();}path.destroy();
  }
  let x=r[0]+3,y=r[1]+size+2,overflow=false;
  for(const ch of text.replace(/\r\n?/g,'\n')){if(ch==='\n'){x=r[0]+3;y+=size*1.35;continue;}const f=(ch.codePointAt(0)??0)>255?this.cjk:latin;const advance=f.advanceGlyph(f.encodeCharacter(ch))*size;
   if(x+advance>r[2]-3){x=r[0]+3;y+=size*1.35;}if(y>r[3]-size*.2){overflow=true;break;}
   obj.showString(f,[size,0,0,-size,x,y],ch);x+=advance;
  }
  if(a.getType()==='FreeText')a.getObject().put('LPSTextOverflow',overflow);
  dev.fillText(obj,m.Matrix.identity,m.ColorSpace.DeviceRGB,color(c),1);dev.close();a.setAppearanceFromDisplayList('N',null,m.Matrix.identity,list);obj.destroy();dev.destroy();list.destroy();
 }
 private add(e:Extract<Edit,{kind:'add'}>){
  const p=this.doc.loadPage(e.page);try{
   const a=p.createAnnotation((e.type==='Arrow'?'Line':e.type) as m.PDFAnnotationType);
   a.setName(uid());a.setFlags(m.PDFAnnotation.IS_PRINT);a.setAuthor('Local PDF Studio');a.setCreationDate(new Date());a.setModificationDate(new Date());a.setColor(e.type==='FreeText'?[]:color(e.style.color));a.setOpacity(e.style.opacity);a.setContents(e.style.text);
   if(e.group)a.getObject().put('LPSGroup',this.doc.newString(e.group));
   if(a.hasBorder())a.setBorderWidth(e.type==='FreeText'?0:e.style.width);
   if(a.hasQuadPoints())a.setQuadPoints(e.quads?.length?e.quads as m.Quad[]:[quad(e.rect)]);
   else if(a.hasLine()){a.setLine(e.points?.[0]||[e.rect[0],e.rect[1]],e.points?.at(-1)||[e.rect[2],e.rect[3]]);if(e.type==='Arrow')a.setLineEndingStyles('None','ClosedArrow');}
   else if(e.type==='Ink')a.setInkList([e.points?.length?e.points:[[e.rect[0],e.rect[1]],[e.rect[2],e.rect[3]]]]);
   else a.setRect(e.rect);
   if(e.type==='Text'){a.setIcon('Note');a.setIsOpen(false);}
   if(e.type==='FreeText'){const face=fontName(e.style.font);a.getObject().put('LPSFont',this.doc.newString(face));a.setDefaultAppearance(face,e.style.fontSize,color(e.style.color));a.setLanguage('zh-Hant');a.update();this.textAppearance(a,e.style.text,e.style.fontSize,e.style.color,face);}
   if(e.type==='Stamp'&&e.image){const image=new m.Image(e.image);a.setStampImage(image);a.setRect(e.rect);image.destroy();}
   a.update();
  }finally{p.destroy();}
 }
 private editable(page:m.PDFPage,id:string){const a=page.getAnnotations().find(a=>(a.getName()||String(a.getObject().asIndirect()))===id);if(!a)throw new Error('Annotation no longer exists.');if(!this.mark(a).editable)throw new Error('This annotation is locked or unsupported.');return a;}
 private transformAnnotation(a:m.PDFAnnotation,to:Rect){
  const from=a.getBounds(),sx=(to[2]-to[0])/Math.max(1,from[2]-from[0]),sy=(to[3]-to[1])/Math.max(1,from[3]-from[1]);const point=(p:Point):Point=>[to[0]+(p[0]-from[0])*sx,to[1]+(p[1]-from[1])*sy];
  if(a.hasQuadPoints())a.setQuadPoints(a.getQuadPoints().map(q=>[...point([q[0],q[1]]),...point([q[2],q[3]]),...point([q[4],q[5]]),...point([q[6],q[7]])] as m.Quad));
  else if(a.hasInkList())a.setInkList(a.getInkList().map(s=>s.map(point)));
  else if(a.hasLine()){const line=a.getLine();a.setLine(point(line[0]),point(line[1]));}
  else a.setRect(to);
 }
 private importPages(source:m.PDFDocument,indices:number[],at=this.doc.countPages()){
  const map=this.doc.newGraftMap(),prefix=uid().slice(0,8),fieldParents=new Map<number,m.PDFObject>();
  try{for(const i of indices){
   map.graftPage(at,source,i);const dest=this.doc.findPage(at),src=source.findPage(i);dest.put('LPSPageID',this.doc.newString(uid()));
   const annotations=this.doc.newArray();
   src.get('Annots').forEach((item)=>{
    const o=this.doc.newDictionary();item.forEach((v,key)=>{if(!['P','Parent','Popup','IRT'].includes(String(key)))o.put(key,map.graftObject(v));});
    o.put('P',dest);o.put('NM',this.doc.newString(uid()));
    if(item.get('Subtype').asName()==='Widget'){
     for(const key of ['FT','Ff','V','DV','Opt','DA','Q','MaxLen']){const value=item.getInheritable(key);if(!value.isNull())o.put(key,map.graftObject(value));}
     o.put('T',this.doc.newString(`${prefix}_${item.getInheritable('T').asString()||annotations.length}`));
     const root=this.doc.getTrailer().get('Root');if(root.get('AcroForm').isNull())root.put('AcroForm',this.doc.newDictionary());const form=root.get('AcroForm');if(form.get('Fields').isNull())form.put('Fields',this.doc.newArray());
     if(form.get('DR').isNull()&&!source.getTrailer().get('Root','AcroForm','DR').isNull())form.put('DR',map.graftObject(source.getTrailer().get('Root','AcroForm','DR')));
     const ref=this.doc.addObject(o),parent=item.get('Parent');
     if(!parent.isNull()){
      let importedParent=fieldParents.get(parent.asIndirect());
      if(!importedParent){const field=this.doc.newDictionary();for(const key of ['FT','Ff','V','DV','Opt','DA','Q','MaxLen']){const value=item.getInheritable(key);if(!value.isNull())field.put(key,map.graftObject(value));}field.put('T',this.doc.newString(`${prefix}_${parent.getInheritable('T').asString()||fieldParents.size}`));field.put('Kids',this.doc.newArray());importedParent=this.doc.addObject(field);form.get('Fields').push(importedParent);fieldParents.set(parent.asIndirect(),importedParent);}
      for(const key of ['FT','Ff','V','DV','Opt','DA','Q','MaxLen','T'])o.delete(key);o.put('Parent',importedParent);importedParent.get('Kids').push(ref);
     }else form.get('Fields').push(ref);
     annotations.push(ref);
    }else annotations.push(this.doc.addObject(o));
   });
   if(annotations.length)dest.put('Annots',annotations);annotations.destroy();dest.destroy();src.destroy();at++;
  }}finally{map.destroy();}
 }
 edit(e:Edit){
  if(this.readonlyReason)throw new Error(this.readonlyReason);
  this.doc.beginOperation(e.kind);
  try{
   if(e.kind==='add')this.add(e);
   if(e.kind==='eraseInk'){
    const p=this.doc.loadPage(e.page);try{const changes=e.changes.map(change=>({a:this.editable(p,change.id),ink:change.ink})),removed=[...new Set(e.removeIds||[])].map(id=>this.editable(p,id));if(removed.some(a=>!['Highlight','Underline','StrikeOut'].includes(a.getType())))throw new Error('Only text markup may be removed with partial ink erasing.');if(changes.some(({a})=>a.getType()!=='Ink'))throw new Error('The eraser only removes pen strokes.');for(const a of removed)p.deleteAnnotation(a);for(const {a,ink} of changes){if(!ink.length)p.deleteAnnotation(a);else{a.setInkList(ink);a.setModificationDate(new Date());a.update();}}}finally{p.destroy();}
   }
   if(e.kind==='eraseMarks'){
    const p=this.doc.loadPage(e.page);try{const annotations=[...new Set(e.ids)].map(id=>this.editable(p,id));if(annotations.some(a=>!['Ink','Highlight','Underline','StrikeOut'].includes(a.getType())))throw new Error('The eraser only removes pen strokes and text markup.');for(const a of annotations)p.deleteAnnotation(a);}finally{p.destroy();}
   }
   if(e.kind==='update'||e.kind==='deleteMark'){
    const p=this.doc.loadPage(e.page);try{const a=this.editable(p,e.id);if(e.kind==='deleteMark')p.deleteAnnotation(a);else{
     const s=e.style;if(e.rect)this.transformAnnotation(a,e.rect);
     if(s?.color&&a.getType()!=='FreeText')a.setColor(color(s.color));if(s?.opacity!==undefined)a.setOpacity(s.opacity);if(s?.text!==undefined)a.setContents(s.text);if(s?.width!==undefined&&a.hasBorder())a.setBorderWidth(s.width);
     a.setModificationDate(new Date());
     if(a.getType()==='FreeText'){const old=a.getDefaultAppearance(),textColor=s?.color||(old.color.length?old.color:[0,0,0]),face=fontName(s?.font||str(a.getObject(),'LPSFont')||old.font);a.getObject().put('LPSFont',this.doc.newString(face));if(a.getAuthor()==='Local PDF Studio')a.setColor([]);a.setDefaultAppearance(face,s?.fontSize||old.size,color(textColor));a.update();this.textAppearance(a,a.getContents(),s?.fontSize||old.size,textColor,face);}else a.update();
    }}finally{p.destroy();}
   }
   if(e.kind==='field'){
    const p=this.doc.loadPage(e.page);try{const w=p.getWidgets()[e.id];if(!w||w.isReadOnly())throw new Error('This field is read-only.');
     if(w.isCheckbox()||w.isRadioButton())w.toggle();else if(w.isChoice()){if(!w.setChoiceValue(e.value))throw new Error('This form value is not accepted.');}else if(w.isText()){if(!w.setTextValue(e.value))throw new Error('This form value is not accepted.');}else throw new Error('This form type is unsupported.');
     p.update();
     if((w.isText()||w.isChoice())&&/[^\u0000-\u00ff]/.test(e.value)){const da=w.getDefaultAppearance();this.textAppearance(w,e.value,da.size||12,da.color.length?da.color:[0,0,0]);}
    }finally{p.destroy();}
   }
   if(e.kind==='rotate')for(const i of e.pages){const p=this.doc.findPage(i);p.put('Rotate',((p.getInheritable('Rotate').asNumber()+e.degrees)%360+360)%360);p.destroy();}
   if(e.kind==='crop')for(const i of e.pages){const p=this.doc.loadPage(i);try{const b=p.getBounds();const r:Rect=[Math.max(b[0],e.rect[0]),Math.max(b[1],e.rect[1]),Math.min(b[2],e.rect[2]),Math.min(b[3],e.rect[3])];if(r[2]-r[0]<10||r[3]-r[1]<10)throw new Error('The crop area must be at least 10 × 10 points.');const pdfRect=m.Rect.transform(r,m.Matrix.invert(p.getTransform()));p.getObject().put('CropBox',pdfRect);}finally{p.destroy();}}
   if(e.kind==='blank'){const p=this.doc.addPage([0,0,595,842],0,{},'');p.put('LPSPageID',this.doc.newString(uid()));this.doc.insertPage(e.after+1,p);p.destroy();}
   if(e.kind==='reorder'){
    if(!e.order.length)throw new Error('Keep at least one page.');const count=this.doc.countPages();if(e.order.some(i=>i<0||i>=count))throw new Error('Invalid page number.');
    const seen=new Set<number>();let clone:m.PDFDocument|undefined;
    const order=e.order.map(i=>{if(!seen.has(i)){seen.add(i);return i;}if(!clone){clone=m.Document.openDocument(this.checkpoint(),'application/pdf').asPDF()!;if(clone.needsPassword())clone.authenticatePassword(this.password);}const index=this.doc.countPages();this.importPages(clone,[i]);return index;});
    this.doc.rearrangePages(order);clone?.destroy();
   }
   if(e.kind==='merge'){
    const src=m.Document.openDocument(e.bytes,'application/pdf').asPDF();if(!src)throw new Error('Choose a valid PDF.');
    try{if(src.needsPassword()&&!src.authenticatePassword(e.password||''))throw Object.assign(new Error('The PDF to merge requires a password.'),{code:'MERGE_PASSWORD'});if(!src.hasPermission('assemble'))throw new Error('This PDF does not permit page assembly.');this.importPages(src,Array.from({length:src.countPages()},(_,i)=>i));}finally{src.destroy();}
   }
   if(e.kind==='batch'){
    const group=`${e.mode}:${uid()}`;for(let index=0;index<e.pages.length;index++){
     const page=e.pages[index],p=this.doc.loadPage(page),b=p.getBounds();p.destroy();const w=b[2]-b[0],h=b[3]-b[1];let text=e.mode==='numbers'?String((parseInt(e.style.text)||1)+index):e.style.text;
     let width=e.image?(e.imageSize||150):Math.min(w-48,Math.max(60,[...text].reduce((sum,ch)=>sum+(ch.charCodeAt(0)>255?1:.58)*e.style.fontSize,0)+10));let height=e.style.fontSize*1.5+8;
     if(e.image){const img=new m.Image(e.image);height=width*img.getHeight()/img.getWidth();img.destroy();}
     const x=e.position.includes('left')?24:e.position.includes('right')?w-width-24:(w-width)/2;
     const y=e.position.startsWith('Top')?24:e.position.startsWith('Bottom')?h-height-24:(h-height)/2;
     this.add({kind:'add',page,type:e.image?'Stamp':'FreeText',rect:[x,y,x+width,y+height],style:{...e.style,text},image:e.image,group});
    }
   }
   this.doc.endOperation();this.revision++;return this.info();
  }catch(error){this.doc.abandonOperation();throw error;}
 }
 undo(){if(!this.readonlyReason&&this.doc.canUndo()){this.doc.undo();this.revision++;}return this.info();}
 redo(){if(!this.readonlyReason&&this.doc.canRedo()){this.doc.redo();this.revision++;}return this.info();}
 checkpoint(){if(this.readonlyReason)return new Uint8Array(this.original);return copiedBuffer(this.doc.saveToBuffer('compress=yes,encrypt=keep'));}
 export(flatten=false,pages?:number[]){
  if(this.readonlyReason){if(flatten||pages)throw new Error(this.readonlyReason);return new Uint8Array(this.original);}
  const bytes=this.checkpoint();if(!flatten&&!pages)return bytes;
  const temp=new PDFEngine();try{
   temp.open(bytes,this.password);if(pages)temp.edit({kind:'reorder',order:pages});
   if(flatten){const notes=temp.info().pages.flatMap((p,i)=>p.marks.filter(a=>a.contents&&a.type!=='FreeText').map(a=>`Page ${i+1} · ${a.type}\n${a.contents}`));
    temp.doc.beginOperation('Flatten copy');if(notes.length){
     const lines:string[]=[];for(const note of notes){for(const para of note.split('\n')){let line='';let width=0;for(const ch of para){const dw=ch.charCodeAt(0)>255?12:7;if(width+dw>500){lines.push(line);line='';width=0;}line+=ch;width+=dw;}lines.push(line);}lines.push('');}
     for(let start=0;start<lines.length;start+=42){const p=temp.doc.addPage([0,0,595,842],0,{},'');temp.doc.insertPage(-1,p);p.destroy();temp.add({kind:'add',page:temp.doc.countPages()-1,type:'FreeText',rect:[36,30,559,815],style:{color:[.1,.15,.22],opacity:1,width:0,fontSize:12,text:'Comments / 註解摘要\n\n'+lines.slice(start,start+42).join('\n')}});}
    }temp.doc.bake(true,true);temp.doc.endOperation();
   }
   return copiedBuffer(temp.doc.saveToBuffer('compress=yes,garbage=3,encrypt=keep'));
  }finally{temp.destroy();}
 }
 destroy(){this.doc?.destroy();for(const [face,font] of this.fonts)if(face!=='Helvetica')font.destroy();this.fonts.clear();this.latin.destroy();this.cjk.destroy();}
}



