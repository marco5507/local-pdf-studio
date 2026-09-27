import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as m from 'mupdf';
import {PDFEngine} from '../src/engine.ts';
import {PDFDocument} from 'pdf-lib';
const fixture=await PDFDocument.create();for(let i=0;i<2;i++){const p=fixture.addPage([595,842]);p.drawText(`Compatibility page ${i+1}`,{x:40,y:770,size:20});}const fixtureBytes=await fixture.save();
const sample=()=>new Uint8Array(fixtureBytes);
const style={color:[.2,.3,.8],opacity:.7,width:3,fontSize:14,text:''};
test('radio selections remain exclusive after merge, editing, undo and export',async()=>{
 const pdf=await PDFDocument.create();const page=pdf.addPage();const radio=pdf.getForm().createRadioGroup('choice');radio.addOptionToPage('First',page,{x:40,y:650,width:20,height:20});radio.addOptionToPage('Second',page,{x:40,y:600,width:20,height:20});radio.select('First');const bytes=await pdf.save();
 const engine=new PDFEngine();const reopened=new PDFEngine();try{engine.open(sample());engine.edit({kind:'merge',bytes});const fields=()=>engine.info().pages[2].fields;assert.deepEqual(fields().map(f=>f.checked),[true,false]);engine.edit({kind:'field',page:2,id:fields()[1].id,value:''});assert.deepEqual(fields().map(f=>f.checked),[false,true]);engine.undo();assert.deepEqual(fields().map(f=>f.checked),[true,false]);engine.redo();reopened.open(engine.export());assert.deepEqual(reopened.info().pages[2].fields.map(f=>f.checked),[false,true]);}finally{engine.destroy();reopened.destroy();}
});
test('encrypted drafts and exported copies still require the original password',()=>{
 const d=m.Document.openDocument(sample(),'application/pdf').asPDF()!;const b=d.saveToBuffer('encrypt=aes-256,user-password=qa-password,owner-password=qa-owner');const data=new Uint8Array(b.asUint8Array());b.destroy();d.destroy();
 const e=new PDFEngine();try{assert.throws(()=>e.open(data),/Password required/);assert.throws(()=>e.open(data,'wrong'),/Incorrect/);const info=e.open(data,'qa-password');assert.equal(info.encrypted,true);e.edit({kind:'add',page:0,type:'Text',rect:[20,20,44,44],style:{...style,text:'Encrypted note'}});for(const bytes of [e.checkpoint(),e.export(true)]){const r=m.Document.openDocument(bytes,'application/pdf');assert(r.needsPassword());assert(r.authenticatePassword('qa-password'));r.destroy();}}finally{e.destroy();}
});
test('signed documents return unchanged bytes and reject editing and flattening',()=>{
 const d=m.Document.openDocument(sample(),'application/pdf').asPDF()!;d.addObject({Type:'Sig',ByteRange:[0,1,2,3],Contents:d.newByteString([0,0])});const b=d.saveToBuffer('');const data=new Uint8Array(b.asUint8Array());b.destroy();d.destroy();
 const e=new PDFEngine();try{assert(e.open(data).readOnly);assert.throws(()=>e.edit({kind:'blank',after:0}),/signed/);assert.throws(()=>e.export(true),/signed/);assert.deepEqual(e.export(),data);}finally{e.destroy();}
});
test('stamps, ink, arrows, markup, batch numbering and geometry remain editable',()=>{
 const e=new PDFEngine();try{e.open(sample());const img=new Uint8Array(fs.readFileSync('public/icons/128.png'));
  for(const type of ['Stamp','Ink','Arrow','Underline','StrikeOut','Circle'])e.edit({kind:'add',page:0,type,rect:[100,330,220,410],style,points:[[100,330],[160,370],[220,410]],image:type==='Stamp'?img:undefined});
  const before=e.info();for(const mark of before.pages[0].marks)e.edit({kind:'update',page:0,id:mark.id,rect:[mark.rect[0]+20,mark.rect[1]+10,mark.rect[2]+40,mark.rect[3]+30],style:{opacity:.5,color:[.8,.2,.1]}});
  e.edit({kind:'batch',pages:[0,1],mode:'numbers',style:{...style,text:'5'},position:'Bottom right'});assert.equal(e.info().pages[1].marks.at(-1)?.contents,'6');
  const clone=new PDFEngine();try{clone.open(e.export());assert.equal(clone.info().pages[0].marks.length,7);assert.equal(clone.info().pages[0].marks[0].type,'Stamp');assert(clone.info().pages[0].marks.every(a=>a.editable));}finally{clone.destroy();}
 }finally{e.destroy();}
});
