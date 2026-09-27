import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {PDFEngine} from '../src/engine.ts';
import {saveEditableFile,type PDFFileHandle} from '../src/file-save.ts';
function target(){
 let bytes=new Uint8Array([1,2,3]),staged=bytes,modified=1,opened=0,aborted=false;
 const handle:PDFFileHandle={name:'original.pdf',getFile:async()=>({size:bytes.length,lastModified:modified}),createWritable:async()=>{opened++;return {write:async data=>{staged=new Uint8Array(data);},close:async()=>{bytes=staged;modified++;},abort:async()=>{aborted=true;}};}};
 return {handle,get bytes(){return bytes;},get opened(){return opened;},get aborted(){return aborted;},change(){modified++;}};
}
test('replacing a file writes an editable PDF with text and forms intact',async()=>{
 const pdf=await PDFDocument.create();const page=pdf.addPage();pdf.getForm().createTextField('Name').addToPage(page);const engine=new PDFEngine(),reopened=new PDFEngine(),file=target();
 try{engine.open(await pdf.save());engine.edit({kind:'add',page:0,type:'FreeText',rect:[40,80,300,160],style:{font:'Times-Bold',text:'Editable 中文',color:[0,0,0],opacity:1,width:0,fontSize:16}});
 const field=engine.info().pages[0].fields[0];engine.edit({kind:'field',page:0,id:field.id,value:'Saved form'});
 assert.equal(await saveEditableFile(async()=>file.handle,'original.pdf',async()=>engine.export(false)),'original.pdf');
 const info=reopened.open(file.bytes);assert.equal(info.pages[0].marks[0].contents,'Editable 中文');assert.equal(info.pages[0].marks[0].font,'Times-Bold');assert.equal(info.pages[0].fields[0].value,'Saved form');reopened.edit({kind:'update',page:0,id:info.pages[0].marks[0].id,style:{text:'Edit again'}});assert.equal(reopened.info().pages[0].marks[0].contents,'Edit again');
 }finally{engine.destroy();reopened.destroy();}
});
test('cancelled picker and failed export never open the original for writing',async()=>{
 const file=target();let exported=false;
 await assert.rejects(saveEditableFile(async()=>{throw new DOMException('Cancelled','AbortError');},'a.pdf',async()=>{exported=true;return new Uint8Array();}));assert.equal(exported,false);
 await assert.rejects(saveEditableFile(async()=>file.handle,'a.pdf',async()=>{throw new Error('Export failed');}),/Export failed/);assert.equal(file.opened,0);assert.deepEqual([...file.bytes],[1,2,3]);
});
test('external modification during export stops the replacement',async()=>{
 const file=target();await assert.rejects(saveEditableFile(async()=>file.handle,'a.pdf',async()=>{file.change();return new Uint8Array([4]);}),/changed while saving/);assert.equal(file.opened,0);
});
test('write failure aborts and reports the error without closing',async()=>{
 let aborted=false,closed=false;const handle:PDFFileHandle={name:'a.pdf',getFile:async()=>({size:3,lastModified:1}),createWritable:async()=>({write:async()=>{throw new Error('Disk full');},close:async()=>{closed=true;},abort:async()=>{aborted=true;}})};
 await assert.rejects(saveEditableFile(async()=>handle,'a.pdf',async()=>new Uint8Array([4])),/Disk full/);assert.equal(aborted,true);assert.equal(closed,false);
});
