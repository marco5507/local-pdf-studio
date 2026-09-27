import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {PDFEngine} from '../src/engine.ts';
test('text boxes report clipping and retain multiline Chinese text, geometry and appearances through edits and exports',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([500,700]);const engine=new PDFEngine();
 try{
  engine.open(await pdf.save());engine.edit({kind:'add',page:0,type:'FreeText',rect:[40,100,300,130],style:{text:'Line one 中文\nLine two\nLine three',color:[.1,.2,.7],width:0,opacity:1,fontSize:16}});
  let mark=engine.info().pages[0].marks[0];const id=mark.id;assert.equal(mark.textOverflow,true);
  engine.edit({kind:'update',page:0,id,rect:[70,120,330,260]});mark=engine.info().pages[0].marks[0];assert.equal(mark.textOverflow,false);assert.deepEqual(mark.rect,[70,120,330,260]);const pixels=engine.render(0,1,false);assert.equal(pixels.pixels[(245*pixels.width+100)*4+3],0,'Moving the text box filled its empty background');const legacy=engine.doc.loadPage(0);legacy.getAnnotations()[0].setColor([0,0,1]);legacy.destroy();engine.edit({kind:'update',page:0,id,rect:[70,120,330,260]});assert.equal(engine.render(0,1,false).pixels[(245*pixels.width+100)*4+3],0,'Legacy box retained a colored background');
  engine.edit({kind:'update',page:0,id,style:{text:'Edited 中文\nSecond line',fontSize:24,color:[1,0,0]}});assert.equal(engine.info().pages[0].marks[0].fontSize,24);
  const p=engine.doc.loadPage(0),list=p.toDisplayList(true),text=list.toStructuredText('');let visible='';text.walk({onChar:c=>visible+=c});text.destroy();list.destroy();p.destroy();assert.ok(visible.includes('Edited 中文'),visible);
  engine.undo();assert.match(engine.info().pages[0].marks[0].contents,/Line one/);engine.redo();
  engine.edit({kind:'rotate',pages:[0],degrees:90});engine.edit({kind:'update',page:0,id,style:{text:'Rotated 中文'}});
  for(const flatten of [false,true]){const other=new PDFEngine();try{other.open(engine.export(flatten));const pg=other.doc.loadPage(0),dl=pg.toDisplayList(true),st=dl.toStructuredText('');let visible='';st.walk({onChar:c=>visible+=c});st.destroy();dl.destroy();pg.destroy();assert.ok(visible.includes('Rotated 中文'),visible);if(!flatten)assert.equal(other.info().pages[0].marks[0].contents,'Rotated 中文');}finally{other.destroy();}}
 }finally{engine.destroy();}
});
