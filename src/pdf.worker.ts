import {PDFEngine} from './engine';
import {zipPDFs} from './archive';
import type {WorkerRequest} from './types';
const engine=new PDFEngine();
self.onmessage=({data:r}:{data:WorkerRequest})=>{
 try{
  let result:unknown;
  switch(r.method){
   case 'open':result=engine.open(r.args.bytes,r.args.password);break;
   case 'info':result=engine.info();break;
   case 'render':result=engine.render(r.args.page,r.args.scale,r.args.text,r.args.hideMarks,r.args.inkEdits);break;
   case 'study':result=engine.study(r.args.page);break;
   case 'search':result=engine.search(r.args.query);break;
   case 'edit':result=engine.edit(r.args);break;
   case 'undo':result=engine.undo();break;
   case 'redo':result=engine.redo();break;
   case 'checkpoint':result=engine.checkpoint();break;
   case 'export':result=engine.export(r.args.flatten,r.args.pages);break;
   case 'split':result=zipPDFs(r.args.groups.map((pages,index)=>({name:`${r.args.baseName} - part ${index+1}.pdf`,bytes:engine.export(false,pages)})));break;
  }
  const transfer:Transferable[]=result instanceof Uint8Array?[result.buffer as ArrayBuffer]:r.method==='render'?[(result as any).pixels.buffer]:[];
  self.postMessage({id:r.id,result},transfer);
 }catch(e){self.postMessage({id:r.id,error:e instanceof Error?e.message:String(e),code:(e as any)?.code});}
};
self.postMessage({ready:true});
