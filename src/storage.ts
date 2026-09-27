import type {Draft,DraftSummary,Preferences} from './types';
const defaults:Preferences={language:'en',theme:'system',autoOpen:false,excludedSites:[],presets:[{color:[.13,.36,.9],opacity:1,width:2,fontSize:14,text:''},{color:[.88,.18,.28],opacity:1,width:3,fontSize:14,text:''},{color:[1,.8,.1],opacity:.4,width:12,fontSize:14,text:''}],signatures:[]};
const summary=(d:Draft):DraftSummary=>({id:d.id,name:d.name,updated:d.updated,page:d.page,zoom:d.zoom,bytes:d.bytes,encrypted:d.encrypted,sourceBytes:d.source.byteLength,token:d.token});
const db=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('local-pdf-studio',3);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('drafts'))r.result.createObjectStore('drafts',{keyPath:'id'});if(r.result.objectStoreNames.contains('draft-index'))return;const index=r.result.createObjectStore('draft-index',{keyPath:'id'});const cursor=r.transaction!.objectStore('drafts').openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){index.put(summary(c.value));c.continue();}};};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close other Local PDF Studio tabs to update draft storage.'));});
async function transaction<T>(mode:IDBTransactionMode,act:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('drafts',mode);const req=act(tx.objectStore('drafts'));tx.oncomplete=()=>{resolve(req.result);d.close();};tx.onerror=tx.onabort=()=>{reject(tx.error||req.error||new Error('Local storage failed.'));d.close();};});}
async function writeBoth(action:(tx:IDBTransaction)=>void){const d=await db();return new Promise<void>((resolve,reject)=>{const tx=d.transaction(['drafts','draft-index'],'readwrite');action(tx);tx.oncomplete=()=>{d.close();resolve();};tx.onerror=tx.onabort=()=>{d.close();reject(tx.error||new Error('Local storage failed.'));};});}
export class DraftConflictError extends Error {constructor(){super('This draft changed in another tab. Save your work as a separate draft.');this.name='DraftConflictError';}}
export const draftToken=(draft?:Pick<Draft,'token'|'updated'>)=>draft?(draft.token||'legacy:'+draft.updated):null;
// Compare and write in the SAME IndexedDB read/write transaction. A separate
// read followed by a write would let two tabs both pass the check.
export async function saveDraft(draft:Draft,expected:string|null):Promise<string>{
 const d=await db();return new Promise((resolve,reject)=>{
  const tx=d.transaction(['drafts','draft-index'],'readwrite');let conflict=false;const token=crypto.randomUUID();
  const read=tx.objectStore('draft-index').get(draft.id);
  read.onsuccess=()=>{if(draftToken(read.result)!==expected){conflict=true;tx.abort();return;}const next={...draft,token};tx.objectStore('drafts').put(next);tx.objectStore('draft-index').put(summary(next));};
  tx.oncomplete=()=>{d.close();resolve(token);};tx.onerror=tx.onabort=()=>{d.close();reject(conflict?new DraftConflictError():tx.error||new Error('Local storage failed.'));};
 });
}
export const getDraft=(id:string)=>transaction<Draft|undefined>('readonly',s=>s.get(id));
export const snapshotDrafts=()=>transaction<Draft[]>('readonly',s=>s.getAll());
export async function restoreDrafts(drafts:Draft[]){
 const copies=drafts.map(d=>({...d,id:d.id.split(':')[0]+':restored-'+crypto.randomUUID(),token:crypto.randomUUID(),updated:Date.now()}));
 await writeBoth(tx=>{for(const d of copies){tx.objectStore('drafts').add(d);tx.objectStore('draft-index').add(summary(d));}});
 return copies.map(d=>d.id);
}
export async function listDrafts():Promise<DraftSummary[]>{const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('draft-index'),r=tx.objectStore('draft-index').getAll();tx.oncomplete=()=>{d.close();resolve((r.result as DraftSummary[]).sort((a,b)=>b.updated-a.updated));};tx.onerror=()=>{d.close();reject(tx.error);};});}
export const deleteDraft=(id:string)=>writeBoth(tx=>{tx.objectStore('drafts').delete(id);tx.objectStore('draft-index').delete(id);});
export const clearDrafts=()=>writeBoth(tx=>{tx.objectStore('drafts').clear();tx.objectStore('draft-index').clear();});
export async function fingerprint(bytes:ArrayBuffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function getPreferences():Promise<Preferences>{try{const p=globalThis.chrome?.storage? (await chrome.storage.local.get('preferences')).preferences:JSON.parse(localStorage.getItem('preferences')||'{}');return {...defaults,...p};}catch{return defaults;}}
export async function savePreferences(p:Preferences){if(globalThis.chrome?.storage)await chrome.storage.local.set({preferences:p});else localStorage.setItem('preferences',JSON.stringify(p));}
export function getSourceURL(){const q=location.search;if(q.startsWith('?source='))return q.slice(8);const params=new URLSearchParams(q);return params.get('drive')||params.get('file');}
export async function sourceAccess(url:string){if(!globalThis.chrome?.permissions)return true;const u=new URL(url);if(!['http:','https:','file:'].includes(u.protocol))throw new Error('Download this PDF first, then open the local file.');const pattern=u.protocol==='file:'?'file:///*':u.origin+'/*';return chrome.permissions.contains({origins:[pattern]});}
export async function requestSourceAccess(url:string){const u=new URL(url);return chrome.permissions.request({origins:[u.protocol==='file:'?'file:///*':u.origin+'/*']});}
