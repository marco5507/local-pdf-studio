// Development-only standalone Drive startup test. All Drive download requests
// are served from the local synthetic fixture; nothing is fetched from Drive.
const report:{suite:string;passed:string[];failed:string[];errors:string[];finished?:string}={suite:'Standalone Drive viewer',passed:[],failed:[],errors:[]};
const requests:URL[]=[],originalFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(['drive.google.com','drive.usercontent.google.com'].includes(url.hostname)){
  requests.push(url);return originalFetch('/test-artifacts/sample.pdf',init);
 }
 if(url.origin!==location.origin)throw Error('Unexpected external request in local QA');
 return originalFetch(input,init);
};
window.addEventListener('error',e=>report.errors.push(e.message));window.addEventListener('unhandledrejection',e=>report.errors.push(String(e.reason)));
const assert=(condition:unknown,message:string)=>{if(!condition)throw Error(message);};
const until=async(fn:()=>unknown,message:string)=>{const start=performance.now();while(!fn()){if(performance.now()-start>20000)throw Error(message);await new Promise(r=>setTimeout(r,100));}};
try{
 const query=new URLSearchParams({drive:'https://drive.google.com/file/d/automatic_fixture/view?authuser=2&resourcekey=local-fixture',name:'Automatic Drive QA.pdf'});
 history.replaceState(null,'',location.pathname+'?'+query);
 const entry=document.querySelector('script[data-viewer-entry]')!.getAttribute('data-viewer-entry')!;
 await import(/* @vite-ignore */entry);
 await until(()=>Number(document.querySelector('.document-scroll canvas')?.getAttribute('width'))>1&&document.querySelectorAll('.document-scroll .text-layer span').length>20&&!document.querySelector('.busy'),'Automatic PDF loading did not finish');
 assert(document.querySelector('.document-title')?.textContent?.includes('Automatic Drive QA.pdf'),'Drive filename missing');
 assert(document.querySelectorAll('.thumbnail-item').length===2,'Drive PDF page count incorrect');
 assert(document.querySelectorAll('.text-layer span').length>20,'Drive PDF text layer missing');
 assert(window.parent===window&&!document.querySelector('iframe'),'Viewer is not a standalone page');
 assert(requests.length===1&&requests[0].searchParams.get('authuser')==='2'&&requests[0].searchParams.get('resourcekey')==='local-fixture','Drive download identity was lost or fetched twice');
 report.passed.push('Drive query automatically fetches and renders PDF in a standalone viewer without selecting a file');
 await until(()=>document.querySelector('.document-title')?.textContent?.includes('Saved locally'),'Automatic Drive draft did not save');
 report.passed.push('Automatically opened Drive PDF checkpoints locally');
 const home=document.querySelector<HTMLButtonElement>('button[aria-label="Home"]')!;home.click();
 await until(()=>!!document.querySelector('.home'),'Home did not open');assert(!location.search,'Returning Home left a stale Drive document identity');
 report.passed.push('Returning Home clears the Drive identity used for tab reuse');
}catch(e){report.failed.push(e instanceof Error?e.stack||e.message:String(e));}
finally{globalThis.fetch=originalFetch;}
report.finished=new Date().toISOString();document.body.dataset.driveQa=report.failed.length?'failed':'passed';await originalFetch('/__qa/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(report,null,2)});
