import type {Requests,Responses} from './types';
import EngineWorker from './pdf.worker?worker';
export class EngineClient{
 private worker=new EngineWorker(); private serial=0;
 private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 private ready=false;private failure:Error|null=null;private queued:{id:number;method:keyof Requests;args:unknown}[]=[];
 private timeout=setTimeout(()=>this.fail(new Error('The PDF engine could not start. Reopen this tab and try again.')),30000);
 constructor(){this.worker.onmessage=({data})=>{if(data.ready){this.ready=true;clearTimeout(this.timeout);for(const item of this.queued)this.worker.postMessage(item);this.queued=[];return;}const p=this.pending.get(data.id);if(!p)return;this.pending.delete(data.id);data.error?p.reject(Object.assign(new Error(data.error),{code:data.code})):p.resolve(data.result);};this.worker.onerror=(e)=>this.fail(new Error(e.message||'The PDF engine stopped. Reopen your saved draft.'));}
 private fail(error:Error){this.failure=error;clearTimeout(this.timeout);for(const p of this.pending.values())p.reject(error);this.pending.clear();this.queued=[];}
 call<K extends keyof Requests>(method:K,args:Requests[K]):Promise<Responses[K]>{if(this.failure)return Promise.reject(this.failure);return new Promise((resolve,reject)=>{const id=++this.serial;this.pending.set(id,{resolve,reject});const item={id,method,args};if(this.ready)this.worker.postMessage(item);else this.queued.push(item);});}
 close(){this.worker.terminate();this.fail(new Error('Document closed'));}
}
