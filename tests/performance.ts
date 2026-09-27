import fs from 'node:fs';
import {PDFEngine} from '../src/engine.ts';
const results=[];
for(const file of ['200-pages.pdf','50mb-scanned.pdf']){
 const e=new PDFEngine();try{const data=new Uint8Array(fs.readFileSync('test-artifacts/'+file));const start=performance.now();const info=e.open(data);const opened=performance.now();const page=e.render(0,1.2,false);const rendered=performance.now();const snapshot=e.checkpoint();results.push({file,bytes:data.length,pages:info.pages.length,openMs:Math.round(opened-start),renderFirstPageMs:Math.round(rendered-opened),checkpointMs:Math.round(performance.now()-rendered),snapshotBytes:snapshot.length,image:[page.width,page.height]});}finally{e.destroy();}
}
fs.writeFileSync('test-artifacts/performance-report.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
