// Run against a locally downloaded test PDF; the document is never uploaded.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PDFEngine} from '../src/engine.ts';
const file=process.argv[2];if(!file)throw new Error('Provide a local PDF path.');
const engine=new PDFEngine(),copy=new PDFEngine();
try {
 const bytes=new Uint8Array(fs.readFileSync(file));const info=engine.open(bytes);
 const pages=info.pages.length;let characters=0;
 for(let i=0;i<pages;i++){const image=engine.render(i,.8);assert(image.pixels.length>0);characters+=image.spans.length;}
 assert(characters>0);
 if(!info.readOnly){engine.edit({kind:'add',page:0,type:'Text',rect:[40,40,64,64],style:{color:[.2,.4,.9],opacity:1,width:2,fontSize:14,text:'Local compatibility test 中文'}});copy.open(engine.export());assert(copy.info().pages[0].marks.some(m=>m.contents.includes('Local compatibility test')));copy.open(engine.export(true));assert.equal(copy.info().pages.length,pages+1);}
 console.log(JSON.stringify({pages,bytes:bytes.length,characters,readOnly:info.readOnly,renderedAllPages:true,editableAndFlattenedRoundTrip:!info.readOnly},null,2));
}finally{engine.destroy();copy.destroy();}
