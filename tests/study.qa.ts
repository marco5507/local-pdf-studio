// Development-only integration runner against the compiled viewer and synthetic PDFs.
import {EngineClient} from '../src/client';
import {getDraft,listDrafts,saveDraft,draftToken,deleteDraft,getPreferences} from '../src/storage';
import {decodeBackup} from '../src/backup';
const report:{suite:string;passed:string[];failed:string[];errors:string[];finished?:string}={suite:'Backup, filters and study notes',passed:[],failed:[],errors:[]};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const assert=(ok:unknown,s:string)=>{if(!ok)throw Error(s);};
async function until(fn:()=>unknown,s:string,timeout=25000){const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error(s);await wait(100);}await wait(100);}
async function click(s:string){const b=[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>!b.disabled&&b.getClientRects().length&&(b.textContent?.trim()===s||b.getAttribute('aria-label')===s));assert(b,'Missing button '+s);b!.click();await wait(200);}
const idle=()=>until(()=>!document.querySelector('.busy'),'Busy timeout');
const saved=()=>until(()=>document.querySelector('.document-title')?.textContent?.includes('Saved locally'),'Save timeout');
function select(label:string,value:string){const el=document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;assert(el,'Missing select '+label);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}
function file(input:HTMLInputElement,blob:Blob,name:string){const dt=new DataTransfer();dt.items.add(new File([blob],name));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
const downloads:{name:string;blob:Promise<Blob>}[]=[],originalClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:'))downloads.push({name:this.download,blob:fetch(this.href).then(r=>r.blob())});else originalClick.call(this);};
window.addEventListener('error',e=>report.errors.push(e.message));window.addEventListener('unhandledrejection',e=>report.errors.push(String(e.reason)));
let fixture:EngineClient|undefined;const restoredIDs:string[]=[];
try{
 await until(()=>!!document.querySelector('.home'),'No home');
 fixture=new EngineClient();const sample=new Uint8Array(await(await fetch('/test-artifacts/sample.pdf')).arrayBuffer());await fixture.call('open',{bytes:sample});const hit=(await fixture.call('search',{query:'Select this text'}))[0];
 const style={color:[1,0,0],opacity:1,width:3,fontSize:16,text:''};
 await fixture.call('edit',{kind:'add',page:0,type:'Highlight',rect:[40,100,200,130],quads:hit.quads[0],style:{...style,color:[1,.8,0]}});
 await fixture.call('edit',{kind:'add',page:0,type:'Ink',rect:[50,400,300,410],points:[[50,405],[300,405]],style});
 await fixture.call('edit',{kind:'add',page:0,type:'Text',rect:[350,200,374,224],style:{...style,text:'Exam note 中文 <script>test</script>'}});
 const bytes=await fixture.call('export',{});fixture.close();fixture=undefined;
 const name='Study QA '+crypto.randomUUID()+'.pdf';file(document.querySelector<HTMLInputElement>('input[type=file]')!,new Blob([bytes]),name);
 await until(()=>document.querySelectorAll('.document-scroll .text-layer span').length>20,'PDF did not render');await idle();await click('Single page');await saved();
 await click('Bookmarks');await click('Add bookmark');await saved();
 const active=(await listDrafts()).find(d=>d.name===name)!;assert(active,'No draft');const before=(await getDraft(active.id))!;
 select('Annotation type','Highlight');await wait(500);assert(document.querySelectorAll('.document-scroll .mark-hit').length===1,'Type filter left hidden hits');assert(!document.querySelector('.comments-list')?.textContent?.includes('Exam note'),'Hidden comment remains');
 select('Annotation color','#ff0000');await wait(400);assert(document.querySelectorAll('.document-scroll .mark-hit').length===0,'Color and type did not combine');await click('Show all annotations');await wait(400);assert(document.querySelectorAll('.document-scroll .mark-hit').length===3,'Reset did not restore marks');report.passed.push('Type/color filters hide annotation handles and comments and reset cleanly');
 select('Annotation type','Highlight');await wait(350);await click('Export study notes');await click('Preview');await until(()=>!!document.querySelector('.study-preview'),'No study preview');assert(document.querySelectorAll('.study-preview article').length===2,'Study export omitted unfiltered notes');assert(document.querySelector('.study-preview')?.textContent?.includes('Select this text'),'Marked text missing');
 document.querySelector<HTMLInputElement>('dialog input[type=checkbox]')!.click();await wait(200);assert(document.querySelector<HTMLButtonElement>('dialog .primary')?.disabled,'Changing filter left stale export');await click('Preview');await until(()=>document.querySelectorAll('.study-preview article').length===1,'Filtered study preview wrong');await click('Download study notes');const exported=downloads.at(-1)!;const html=await(await exported.blob).text();assert(html.includes('Select this text')&&html.includes('Page 1'),'Study download missing text/page');assert(!html.includes('<script>test</script>'),'Export contains executable document text');await click('Cancel');await click('Show all annotations');
 report.passed.push('Study preview includes marked text, page numbers and optional filters; downloadable HTML is escaped');
 await click('Save a copy');await idle();const pdf=new Uint8Array(await(await downloads.at(-1)!.blob).arrayBuffer());fixture=new EngineClient();const reopened=await fixture.call('open',{bytes:pdf});assert(reopened.pages[0].marks.length===3,'Filters changed PDF export');fixture.close();fixture=undefined;report.passed.push('PDF export retains all editable annotations');
 await click('Settings');await click('Backup and restore');await click('Download backup');await until(()=>downloads.some(d=>d.name.endsWith('.lpsbackup')),'Backup did not download');const backupBlob=await downloads.find(d=>d.name.endsWith('.lpsbackup'))!.blob;const decoded=await decodeBackup(backupBlob);assert(decoded.drafts.some(d=>d.id===active.id),'Backup omitted open draft');
 const originalIDs=new Set((await listDrafts()).map(d=>d.id));const binput=document.querySelector<HTMLInputElement>('input[aria-label="Backup file"]')!;
 file(binput,backupBlob.slice(0,backupBlob.size-3),'damaged.lpsbackup');await until(()=>document.querySelector('dialog [role=alert]')?.textContent?.includes('damaged'),'Corruption was not reported');assert((await listDrafts()).length===originalIDs.size,'Damaged backup wrote drafts');
 file(binput,backupBlob,'valid.lpsbackup');await until(()=>!!document.querySelector('.backup-preview'),'No restore preview');assert([...document.querySelectorAll<HTMLInputElement>('dialog input[type=checkbox]')].every(i=>!i.checked),'Restoring preferences or signatures is not opt-in');await click('Restore copies');await until(()=>document.querySelector('dialog [role=status]')?.textContent?.includes('Drafts restored'),'Restore did not complete');
 const after=await listDrafts();restoredIDs.push(...after.filter(d=>!originalIDs.has(d.id)).map(d=>d.id));assert(restoredIDs.length===decoded.drafts.length,'Restore lost drafts');assert([...new Uint8Array((await getDraft(active.id))!.current)].join(',')===[...new Uint8Array(before.current)].join(','),'Restore changed original');const restored=(await getDraft(after.find(d=>restoredIDs.includes(d.id)&&d.name===name)!.id))!;assert(restored.bookmarks?.length===1&&restored.bookmarks[0].pageId===before.bookmarks![0].pageId,'Restore lost bookmarks');
 report.passed.push('Local backup includes active edits; damaged restore is rejected; valid restore is additive with optional preferences/signatures');
 await click('Done');await click('Home');await until(()=>!!document.querySelector('.home'),'Home missing');const row=[...document.querySelectorAll<HTMLButtonElement>('.draft-main')].find(b=>b.textContent?.includes(name));row!.click();await until(()=>!!document.querySelector('.document-scroll'),'Restored draft did not open');await saved();report.passed.push('Restored PDF opens normally with editable annotations');
 // Leave the restored fixture visible for manual visual review. Remove only other
 // synthetic restored copies created by this runner.
 for(const id of restoredIDs.filter(id=>id!==restored.id))await deleteDraft(id);
}catch(e){report.failed.push(e instanceof Error?e.stack||e.message:String(e));}
finally{fixture?.close();HTMLAnchorElement.prototype.click=originalClick;}
report.finished=new Date().toISOString();await fetch('/__qa/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(report,null,2)});
