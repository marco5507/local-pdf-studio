import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,rgb} from 'pdf-lib';
import {PDFEngine} from '../src/engine.ts';
import {parseRanges} from '../src/ranges.ts';
import fs from 'node:fs';
const style={color:[.1,.25,.7],opacity:1,width:2,fontSize:18,text:'English 中文測試 简体字'};
async function fixture(count=2){const d=await PDFDocument.create();for(let i=0;i<count;i++){const p=d.addPage([595,842]);p.drawText(`Local PDF Studio - page ${i+1}`,{x:40,y:770,size:24,color:rgb(.1,.2,.4)});p.drawText('Select this text to highlight it. All processing stays local.',{x:40,y:720,size:12});}const f=d.getForm();const tx=f.createTextField('name');tx.setText('Marco');tx.addToPage(d.getPage(0),{x:40,y:620,width:220,height:30});const cb=f.createCheckBox('accept');cb.addToPage(d.getPage(0),{x:40,y:570,width:20,height:20});const dd=f.createDropdown('choice');dd.addOptions(['Option A','Option B']);dd.select('Option A');dd.addToPage(d.getPage(0),{x:80,y:565,width:160,height:30});return d.save();}
test('range parser validates and deduplicates',()=>{assert.deepEqual(parseRanges('1, 3-5,3',5),[0,2,3,4]);assert.throws(()=>parseRanges('0',5));assert.throws(()=>parseRanges('3-2',5));});
test('Chinese editable annotations, forms, flattening and undo survive round trips',async()=>{
 const e=new PDFEngine();try{
  const original=await fixture();let info=e.open(original);assert.equal(info.pages.length,2);assert.equal(info.readOnly,false);assert.equal(info.pages[0].fields.length,3);
  e.edit({kind:'add',page:0,type:'FreeText',rect:[40,300,450,370],style});
  e.edit({kind:'add',page:0,type:'Text',rect:[450,100,480,130],style:{...style,text:'Remember 記得跟進'}});
  e.edit({kind:'add',page:0,type:'Highlight',rect:[40,105,350,123],style:{...style,color:[1,.8,0],opacity:.5,text:''}});
  e.edit({kind:'field',page:0,id:0,value:'中文姓名'});assert.equal(e.info().pages[0].fields[0].value,'中文姓名');
  const bytes=e.export();e.undo();assert.equal(e.info().pages[0].fields[0].value,'Marco');e.redo();assert.equal(e.info().pages[0].fields[0].value,'中文姓名');
  const other=new PDFEngine();try{other.open(bytes);assert.equal(other.info().pages[0].marks.length,3);assert.match(other.info().pages[0].marks[0].contents,/中文/);assert.equal(other.search('中文').length,1);const image=other.render(0,1);assert.equal(image.width,595);}finally{other.destroy();}
  const flat=e.export(true);const f=new PDFEngine();try{f.open(flat);assert.equal(f.info().pages.length,3);assert.equal(f.info().pages[0].marks.length,0);assert.equal(f.info().pages[0].fields.length,0);assert.equal(f.search('記得跟進').length,1);}finally{f.destroy();}
  fs.mkdirSync('test-artifacts',{recursive:true});fs.writeFileSync('test-artifacts/sample.pdf',original);fs.writeFileSync('test-artifacts/edited.pdf',bytes);fs.writeFileSync('test-artifacts/flattened.pdf',flat);
 }finally{e.destroy();}
});
test('rotate, crop, reorder, duplicate, merge, extract and undo retain editable content',async()=>{
 const e=new PDFEngine();try{e.open(await fixture());e.edit({kind:'add',page:0,type:'Square',rect:[50,200,120,260],style});
  e.edit({kind:'rotate',pages:[0],degrees:90});assert.deepEqual(e.info().pages[0].bounds,[0,0,842,595]);e.undo();assert.deepEqual(e.info().pages[0].bounds,[0,0,595,842]);
  e.edit({kind:'crop',pages:[0],rect:[20,20,570,820]});assert.deepEqual(e.info().pages[0].bounds,[0,0,550,800]);e.undo();
  e.edit({kind:'reorder',order:[0,0,1]});let info=e.info();assert.equal(info.pages.length,3);assert.equal(info.pages[1].marks.length,1);assert.equal(info.pages[1].fields.length,3);assert.notEqual(info.pages[0].id,info.pages[1].id);
  e.edit({kind:'deleteMark',page:1,id:info.pages[1].marks[0].id});assert.equal(e.info().pages[0].marks.length,1);e.undo();
  e.edit({kind:'merge',bytes:await fixture(1)});assert.equal(e.info().pages.length,4);assert.equal(e.info().pages[3].fields.length,3);e.undo();assert.equal(e.info().pages.length,3);
  const x=new PDFEngine();try{x.open(e.export(false,[1]));assert.equal(x.info().pages.length,1);assert.equal(x.info().pages[0].marks.length,1);}finally{x.destroy();}
 }finally{e.destroy();}
});
