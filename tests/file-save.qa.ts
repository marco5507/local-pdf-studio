import {getDraft,listDrafts} from '../src/storage';
import {EngineClient} from '../src/client';
// Development-only browser integration runner. Not included in the extension build.
const report:{passed:string[];failed:string[];errors:string[];exports:{name:string;bytes:number}[];finished?:string}={passed:[],failed:[],errors:[],exports:[]};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>any,message:string,timeout=20000){const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw new Error(message);await wait(100);}await wait(150);}
const assert=(value:any,message:string)=>{if(!value)throw new Error(message);};
const buttons=(label:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(b=>b.getAttribute('aria-label')===label||b.title===label||b.textContent?.trim()===label);
async function click(label:string){const b=buttons(label).find(b=>b.getClientRects().length&&!b.disabled);assert(b,`Button missing: ${label}`);b!.click();await wait(200);}
const text=(el:HTMLInputElement|HTMLTextAreaElement,value:string)=>{Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
const blur=(el:HTMLElement)=>{el.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));};
const idle=()=>until(()=>!document.querySelector('.busy'),'Busy operation did not finish');
const note=(name:string)=>report.passed.push(name);
window.addEventListener('error',e=>report.errors.push(e.message));window.addEventListener('unhandledrejection',e=>report.errors.push(String(e.reason)));
const captured:Promise<ArrayBuffer>[]=[];
const anchorClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){captured.push(fetch(this.href).then(r=>r.arrayBuffer()));fetch(this.href).then(r=>r.arrayBuffer()).then(b=>report.exports.push({name:this.download,bytes:b.byteLength}));}else anchorClick.call(this);};
async function draw(x1:number,y1:number,x2:number,y2:number){const page=document.querySelector<HTMLElement>('.document-scroll .pdf-page')!;const rect=page.getBoundingClientRect(),scale=rect.width/595;const capture=page.setPointerCapture;page.setPointerCapture=()=>{};const fire=(type:string,x:number,y:number)=>page.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:rect.left+x*scale,clientY:rect.top+y*scale,pressure:.5}));fire('pointerdown',x1,y1);await wait(60);fire('pointermove',x2,y2);await wait(60);fire('pointerup',x2,y2);page.setPointerCapture=capture;await idle();}


async function moveHandle(target:HTMLElement,dx:number,dy:number){const b=target.getBoundingClientRect(),start=[b.left+b.width/2,b.top+b.height/2],capture=target.setPointerCapture;target.setPointerCapture=()=>{};for(const [type,x,y] of [['pointerdown',...start],['pointermove',start[0]+dx,start[1]+dy],['pointerup',start[0]+dx,start[1]+dy]] as const){target.dispatchEvent(new PointerEvent(String(type),{bubbles:true,pointerId:8,button:type==='pointermove'?-1:0,buttons:type==='pointerup'?0:1,clientX:Number(x),clientY:Number(y)}));await wait(70);}target.setPointerCapture=capture;await idle();}

function chooseFont(value:string){const select=document.querySelector<HTMLSelectElement>('select[aria-label="Text font"]')!;assert(select&&!select.disabled,'Font selector missing or disabled');select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}

try{
 await until(()=>document.querySelector('.home'),'No home');const sample=await(await fetch('/test-artifacts/sample.pdf')).arrayBuffer();
 const directory=await navigator.storage.getDirectory(),handle=await directory.getFileHandle('save-test-'+crypto.randomUUID()+'.pdf',{create:true});let stream=await handle.createWritable();await stream.write(sample);await stream.close();
 let picks=0;Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:async()=>{picks++;return handle;}});
 const transfer=new DataTransfer();transfer.items.add(new File([sample],'File Save QA '+crypto.randomUUID()+'.pdf',{type:'application/pdf'}));const input=document.querySelector<HTMLInputElement>('input[type=file]')!;input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));await wait(1500);if(buttons('Open original copy').length)await click('Open original copy');await until(()=>document.querySelectorAll('.document-scroll .text-layer span').length>20,'PDF missing');
 await click('Single page');await click('Annotate');await click('Text');await draw(80,320,400,470);text(document.querySelector<HTMLTextAreaElement>('.text-box-editor')!,'Saved editable 中文');
 await click('Save flattened copy');await click('Save to original file…');await idle();await until(()=>document.querySelector('.footer-status')?.textContent?.includes(handle.name),'No file save confirmation');assert(picks===1,'Picker not called');
 const e=new EngineClient();try{const info=await e.call('open',{bytes:new Uint8Array(await(await handle.getFile()).arrayBuffer())});const mark=info.pages[0].marks.find(m=>m.type==='FreeText');assert(mark?.contents==='Saved editable 中文','File flattened or pending typing lost');assert(info.pages[0].fields.length>=1,'Form fields flattened');await e.call('edit',{kind:'update',page:0,id:mark!.id,style:{text:'Still editable'}});}finally{e.close();}
 note('Save-to-original UI writes an editable PDF, flushes focused text and preserves form fields');
 const before=await(await handle.getFile()).arrayBuffer();Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError');}});await click('Save flattened copy');await click('Save to original file…');await idle();assert(!document.querySelector('.error-toast'),'Cancellation reported as error');assert((await(await handle.getFile()).arrayBuffer()).byteLength===before.byteLength,'Cancel changed saved file');note('Cancelling file selection leaves the file and open document intact');
}catch(e){report.failed.push(e instanceof Error?e.stack||e.message:String(e));}finally{HTMLAnchorElement.prototype.click=anchorClick;}
report.finished=new Date().toISOString();await fetch('/__qa/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(report,null,2)});
