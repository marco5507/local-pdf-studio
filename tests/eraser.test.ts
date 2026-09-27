import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {PDFEngine} from '../src/engine.ts';
import {sweptInk,sweptErasable,cutInk} from '../src/eraser.ts';
import type {Mark} from '../src/types.ts';
const mark=(id:string,x:number):Mark=>({id,type:'Ink',rect:[x,40,x,80],ink:[[[x,40],[x,80]]],color:[0,0,0],opacity:1,width:2,fontSize:12,contents:'',editable:true});
test('markup erasing follows individual text quads and preserves gaps, locked marks and other objects',()=>{
 const highlight:Mark={...mark('highlight',40),type:'Highlight',rect:[20,20,140,120],quads:[[20,20,140,20,20,30,140,30],[20,110,140,110,20,120,140,120]]};
 const underline:Mark={...mark('underline',40),type:'Underline',rect:[20,140,140,141],quads:undefined};
 const locked={...highlight,id:'locked',editable:false},square={...highlight,id:'square',type:'Square'},degenerate={...highlight,id:'empty',rect:[190,190,190,190] as Mark['rect'],quads:[[190,190,190,190,190,190,190,190]]};
 const marks=[highlight,underline,locked,square,degenerate];
 assert.deepEqual(sweptErasable([0,70],[160,70],marks,1),[]);
 assert.deepEqual(sweptErasable([0,25],[160,25],marks,1),['highlight']);
 assert.deepEqual(sweptErasable([80,0],[80,160],marks,1),['highlight','underline']);
 assert.deepEqual(sweptErasable([80,150],[80,150],[underline],1),['underline']);
 assert.deepEqual(sweptErasable([80,150],[80,150],[underline],2),[]);
});
test('full and partial gestures remove native text markup, preview without mutation and survive export and undo',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([200,200]);const e=new PDFEngine(),copy=new PDFEngine();
 try{
  e.open(await pdf.save());const style={color:[.8,.2,.1],opacity:.5,width:2,fontSize:12,text:''};
  for(const [i,type] of (['Highlight','Underline','StrikeOut'] as const).entries())e.edit({kind:'add',page:0,type,rect:[20,20+i*30,180,35+i*30],style});
  e.edit({kind:'add',page:0,type:'Ink',rect:[20,150,180,151],points:[[20,150],[180,150]],style});
  const original=e.info(),marks=original.pages[0].marks,ids=marks.slice(0,3).map(a=>a.id),pixels=e.render(0,1,false).pixels;
  assert(marks.slice(0,3).every(a=>a.quads?.length===1));
  const preview=e.render(0,1,false,ids);assert.notDeepEqual(preview.pixels,pixels);assert.equal(e.info().revision,original.revision);
  e.edit({kind:'eraseMarks',page:0,ids});assert.deepEqual(e.info().pages[0].marks.map(a=>a.type),['Ink']);assert.deepEqual(e.render(0,1,false).pixels,preview.pixels);
  e.undo();assert.equal(e.info().pages[0].marks.length,4);assert.deepEqual(e.render(0,1,false).pixels,pixels);
  const ink=cutInk(marks[3].ink!,[100,130],[100,170],11);
  e.edit({kind:'eraseInk',page:0,changes:[{id:marks[3].id,ink}],removeIds:ids});assert.equal(e.info().pages[0].marks.length,1);assert.equal(e.info().pages[0].marks[0].ink!.length,2);
  copy.open(e.export());assert.deepEqual(copy.info().pages[0].marks.map(a=>a.type),['Ink']);assert.deepEqual(copy.info().pages[0].marks[0].ink,ink);
  e.undo();assert.equal(e.info().pages[0].marks.length,4);assert.deepEqual(e.info().pages[0].marks[3].ink,marks[3].ink);
  e.redo();assert.equal(e.info().pages[0].marks.length,1);e.undo();
  for(const id of ids){e.edit({kind:'deleteMark',page:0,id});assert(!e.info().pages[0].marks.some(a=>a.id===id));e.undo();assert(e.info().pages[0].marks.some(a=>a.id===id));}
 }finally{e.destroy();copy.destroy();}
});
test('partial eraser splits sparse segments at exact boundaries and preserves untouched pieces',()=>{
 assert.deepEqual(cutInk([[[0,50],[100,50]]],[50,0],[50,100],10),[[[0,50],[40,50]],[[60,50],[100,50]]]);
 assert.deepEqual(cutInk([[[0,50],[100,50]]],[50,50],[50,50],10),[[[0,50],[40,50]],[[60,50],[100,50]]]);
 assert.deepEqual(cutInk([[[0,0],[100,0]]],[50,50],[50,60],10),[[[0,0],[100,0]]]);
 assert.deepEqual(cutInk([[[0,0],[100,0]]],[0,0],[100,0],10),[]);
 assert.deepEqual(cutInk([[[0,0],[50,50],[100,100]]],[50,0],[50,100],10),[[[0,0],[40,40]],[[60,60],[100,100]]]);
});
test('partial erasing survives export with both ends editable, preserves style and undoes once',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([200,200]);const e=new PDFEngine(),copy=new PDFEngine();
 try{e.open(await pdf.save());e.edit({kind:'add',page:0,type:'Ink',rect:[20,80,180,81],points:[[20,80],[180,80]],style:{color:[.2,.4,.8],opacity:.6,width:4,fontSize:12,text:'My ink'}});
 const original=e.info().pages[0].marks[0],ink=cutInk(original.ink!,[100,50],[100,110],12),changes=[{id:original.id,ink}];
 e.render(0,1,false,[],changes);assert.deepEqual(e.info().pages[0].marks[0].ink,original.ink);
 e.edit({kind:'eraseInk',page:0,changes});assert.equal(e.info().pages[0].marks[0].ink!.length,2);
 copy.open(e.export());const reopened=copy.info().pages[0].marks[0];assert.deepEqual(reopened.ink,ink);assert.equal(reopened.contents,'My ink');assert.equal(reopened.width,4);assert(reopened.editable);
 e.undo();assert.deepEqual(e.info().pages[0].marks[0].ink,original.ink);e.redo();assert.deepEqual(e.info().pages[0].marks[0].ink,ink);
 e.edit({kind:'eraseInk',page:0,changes:[{id:original.id,ink:[]}]});assert.equal(e.info().pages[0].marks.length,0);e.undo();assert.deepEqual(e.info().pages[0].marks[0].ink,ink);
 }finally{e.destroy();copy.destroy();}
});
test('eraser catches all crossed strokes between events and keeps screen-sized tolerance',()=>{
 const marks=[mark('one',40),mark('two',80),{...mark('locked',60),editable:false},{...mark('note',60),type:'Text'},mark('outside',160)];
 assert.deepEqual(sweptInk([0,60],[120,60],marks,1),['one','two']);
 assert.deepEqual(sweptInk([49,60],[49,60],[marks[0]],1),['one']);
 assert.deepEqual(sweptInk([49,60],[49,60],[marks[0]],2),[]);
 assert.deepEqual(sweptInk([40,0],[40,10],[marks[0]],1),[]);
});
test('eraser preview preserves the document; one undo restores the complete drag',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([200,200]);const engine=new PDFEngine();
 try{engine.open(await pdf.save());const style={color:[0,0,0],opacity:1,width:5,fontSize:12,text:''};
  for(const x of [40,80,140])engine.edit({kind:'add',page:0,type:'Ink',rect:[x,40,x+1,80],points:[[x,40],[x,80]],style});
  engine.edit({kind:'add',page:0,type:'Square',rect:[15,15,180,180],style});
  const info=engine.info(),ids=info.pages[0].marks.slice(0,2).map(m=>m.id),original=engine.render(0,1,false);
  const preview=engine.render(0,1,false,ids);assert.notDeepEqual(preview.pixels,original.pixels);assert.equal(engine.info().revision,info.revision);assert.equal(engine.info().pages[0].marks.length,4);
  engine.edit({kind:'eraseMarks',page:0,ids});assert.equal(engine.info().pages[0].marks.length,2);assert.deepEqual(engine.render(0,1,false).pixels,preview.pixels);
  engine.undo();assert.equal(engine.info().pages[0].marks.length,4);engine.redo();assert.equal(engine.info().pages[0].marks.length,2);
  assert.throws(()=>engine.edit({kind:'eraseMarks',page:0,ids:[info.pages[0].marks[3].id]}),/only removes pen/);assert.equal(engine.info().pages[0].marks.length,2);
 }finally{engine.destroy();}
});

test('eraser diameter controls screen-space hit tolerance at different zoom levels',()=>{const a=mark('ink',40);assert.deepEqual(sweptInk([60,60],[60,60],[a],1,20),[]);assert.deepEqual(sweptInk([60,60],[60,60],[a],1,40),['ink']);assert.deepEqual(sweptInk([60,60],[60,60],[a],2,40),[]);});
