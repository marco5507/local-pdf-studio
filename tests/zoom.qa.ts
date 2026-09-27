import {PDFDocument} from 'pdf-lib';
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
 await until(()=>document.querySelector('.home'),'Home missing');
 const pdf=await PDFDocument.create();for(let i=0;i<10;i++){const p=pdf.addPage(i%3===0?[840,595]:[595,842]);p.drawText('Zoom regression page '+(i+1),{x:50,y:500});}
 const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(await pdf.save())],'Zoom QA '+crypto.randomUUID()+'.pdf',{type:'application/pdf'}));
 const input=document.querySelector<HTMLInputElement>('input[type=file]')!;input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 await until(()=>document.querySelectorAll('.document-scroll .pdf-page').length===10,'PDF did not open');await idle();await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
 const scroller=()=>document.querySelector<HTMLElement>('.document-scroll')!;
 const frames=()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
 const pageNumber=()=>Number(document.querySelector<HTMLInputElement>('input[aria-label="Page"]')!.value);
 const pageEl=(n:number)=>scroller().querySelector<HTMLElement>(`[data-page="${n}"]`)!;
 async function go(n:number){text(document.querySelector<HTMLInputElement>('input[aria-label="Page"]')!,String(n));await frames();await wait(350);}
 async function setZoom(n:number){const select=document.querySelector<HTMLSelectElement>('select[aria-label="Zoom"]')!;select.value=String(n);select.dispatchEvent(new Event('change',{bubbles:true}));await frames();await wait(350);}
 function location(n:number){const v=scroller().getBoundingClientRect(),r=pageEl(n).getBoundingClientRect();return {fraction:(v.top+25-r.top)/r.height,screen:r.top-v.top};}
 for(const mode of ['Continuous','Single page','Two pages']){
  await click(mode);await setZoom(100);await go(6);
  const root=scroller(),rect=pageEl(6).getBoundingClientRect();root.scrollTop+=rect.top-root.getBoundingClientRect().top+rect.height*.55-25;await wait(300);
  assert(pageNumber()===6,mode+': reading middle of page selected another page');
  let before=location(6).fraction;
  function keptPosition(label:string){const root=scroller();if(root.scrollTop>1&&root.scrollTop<root.scrollHeight-root.clientHeight-1)assert(Math.abs(location(6).fraction-before)<.004,mode+': '+label+' lost reading position: '+before+' -> '+location(6).fraction);else assert(pageEl(6).getBoundingClientRect().bottom>root.getBoundingClientRect().top,mode+': clamped page not visible');before=location(6).fraction;}
  for(const control of ['Zoom in','Zoom out']){await click(control);await wait(350);assert(pageNumber()===6,mode+': '+control+' changed page');keptPosition(control);}
  for(const amount of [200,50,150,100]){await setZoom(amount);assert(pageNumber()===6,mode+': percentage zoom changed page');keptPosition('percentage zoom');}
  await click('Fit width');await wait(350);assert(pageNumber()===6,mode+': fit width changed page');keptPosition('fit width');
  note(mode+': zoom buttons, percentage selector and fit width preserve page and reading position');
 }
 await click('Continuous');await setZoom(100);await go(8);
 for(let i=0;i<4;i++){buttons('Zoom in')[0].click();await wait(40);}await wait(400);assert(pageNumber()===8,'Rapid zoom changed page');note('Rapid consecutive zoom keeps a later page selected');
 await go(10);await setZoom(25);assert(pageEl(10).getBoundingClientRect().bottom>scroller().getBoundingClientRect().top,'Last page became invisible');note('Last page stays visible at minimum zoom');
}catch(e){report.failed.push(e instanceof Error?e.stack||e.message:String(e));}finally{HTMLAnchorElement.prototype.click=anchorClick;}
report.finished=new Date().toISOString();await fetch('/__qa/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(report,null,2)});
