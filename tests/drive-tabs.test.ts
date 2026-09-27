import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createDriveTabOpener,driveRequest,driveSource} from '../public/drive-tabs.js';

const source='https://drive.google.com/file/d/abc_123/view';
const request=(url=source)=>({type:'open-drive-pdf',source:url,name:'Test 中文.pdf'});
const sender=(id=1,incognito=false)=>({id:'studio',frameId:0,url:source,tab:{id,windowId:3,incognito}});
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
function chromeMock(){
 const tabs=new Map<number,any>([[1,{id:1,windowId:3,url:'https://drive.google.com/drive/my-drive',incognito:false}],[2,{id:2,windowId:3,url:source,incognito:false}]]);
 const created:any[]=[],updated:any[]=[],session:any={};let serial=10;
 const state={preferences:{autoOpen:true,excludedSites:[] as string[]},access:true,contexts:true,failCreate:false,failStorage:false,bypass:false};
 const api:any={runtime:{id:'studio',getURL:(path:string)=>'chrome-extension://studio/'+path,getContexts:async(filter:any)=>state.contexts?[...tabs.values()].filter(t=>t.url?.startsWith('chrome-extension://')&&t.incognito===filter.incognito).map(t=>({tabId:t.id,windowId:t.windowId,documentUrl:t.url,incognito:t.incognito,frameId:0})):[]},
 storage:{local:{get:async()=>({preferences:state.preferences})},session:{get:async()=>{if(state.failStorage)throw Error('denied');return structuredClone(session);},set:async(value:any)=>{if(state.failStorage)throw Error('denied');Object.assign(session,structuredClone(value));}}},
 permissions:{contains:async()=>state.access},windows:{update:async()=>({})},declarativeNetRequest:{getSessionRules:async()=>state.bypass?[{id:100001}]:[]},
 tabs:{get:async(id:number)=>{if(!tabs.has(id))throw Error('closed');return {...tabs.get(id)};},update:async(id:number,value:any)=>{if(!tabs.has(id))throw Error('closed');updated.push({id,...value});return Object.assign(tabs.get(id),value);},create:async(value:any)=>{await tick();if(state.failCreate)throw Error('creation failed');const tab={...value,id:serial++,incognito:tabs.get(value.openerTabId)?.incognito||false};tabs.set(tab.id,tab);created.push({...tab});return {...tab};}}};
 return {api,tabs,created,updated,session,state};
}
test('Drive tab requests validate sender and source while keeping file identity independent of filename and resource key',()=>{
 const valid=driveRequest(request(),sender(),'studio');assert(valid);assert.equal(valid.id,'abc_123');
 for(const changed of [{...sender(),id:'other'},{...sender(),frameId:4},{...sender(),url:'https://evil.test/'},{...sender(),tab:undefined}])assert.equal(driveRequest(request(),changed,'studio'),null);
 for(const url of ['https://evil.test/file/d/abc/view','http://drive.google.com/file/d/abc/view','https://drive.google.com/drive/my-drive','https://user:pass@drive.google.com/file/d/abc/view'])assert.equal(driveSource(url),null);
 assert.equal(driveRequest(request(source+'?resourcekey=key&authuser=0'),sender(),'studio').key,valid.key);
});
test('simultaneous Drive folder and preview requests create one separate viewer and never navigate the original tabs',async()=>{
 const m=chromeMock(),opener=createDriveTabOpener(m.api),originals=JSON.stringify([...m.tabs.values()]);
 const results=await Promise.all(Array.from({length:12},(_,i)=>opener.open(request(),sender(i%2+1))));
 assert.equal(m.created.length,1);assert.equal(new Set(results.map(r=>r.tabId)).size,1);
 const viewer=new URL(m.created[0].url);assert.equal(viewer.searchParams.get('drive'),source);assert.equal(viewer.searchParams.get('name'),'Test 中文.pdf');assert.equal(m.created[0].active,true);
 assert.equal(JSON.stringify([...m.tabs.values()].slice(0,2)),originals);
 assert(m.updated.every(u=>u.id===results[0].tabId&&!('url' in u)));
});
test('Drive viewer reuse survives worker restarts and pending navigation; closed or repurposed tabs are not reused',async()=>{
 const m=chromeMock();let opener=createDriveTabOpener(m.api);const first=await opener.open(request(),sender());
 m.state.contexts=false;const tab=m.tabs.get(first.tabId);tab.pendingUrl=tab.url;delete tab.url;
 opener=createDriveTabOpener(m.api);assert.equal((await opener.open(request(),sender())).tabId,first.tabId);assert.equal(m.created.length,1);
 tab.url=tab.pendingUrl;delete tab.pendingUrl;m.state.contexts=true;delete m.session.driveViewerTabs;
 opener=createDriveTabOpener(m.api);assert.equal((await opener.open(request(),sender())).tabId,first.tabId);
 tab.url='chrome-extension://studio/index.html';assert.notEqual((await opener.open(request(),sender())).tabId,first.tabId);
 const second=m.created.at(-1).id;m.tabs.delete(second);await opener.forget(second);assert.equal((await opener.open(request(),sender())).reused,false);assert.equal(m.created.length,3);
});
test('Drive identity separates accounts, incognito and different documents while preserving resource keys',async()=>{
 const m=chromeMock(),opener=createDriveTabOpener(m.api);m.tabs.set(4,{id:4,windowId:3,url:source,incognito:true});
 await opener.open(request(source+'?resourcekey=secret-key&authuser=2'),sender());
 await opener.open(request(source+'?authuser=2'),sender());assert.equal(m.created.length,1);
 assert.equal(new URL(new URL(m.created[0].url).searchParams.get('drive')!).searchParams.get('resourcekey'),'secret-key');
 await opener.open(request(),sender());await opener.open(request(),sender(4,true));await opener.open(request(source.replace('abc_123','different')),sender());assert.equal(m.created.length,4);
});
test('disabled or excluded Drive opening does nothing; a failed creation or session storage write does not wedge the queue',async()=>{
 const m=chromeMock(),opener=createDriveTabOpener(m.api);
 m.state.preferences.autoOpen=false;assert((await opener.open(request(),sender())).disabled);
 m.state.preferences.autoOpen=true;m.state.preferences.excludedSites=['google.com'];assert((await opener.open(request(),sender())).disabled);
 m.state.preferences.excludedSites=[];m.state.access=false;assert((await opener.open(request(),sender())).disabled);assert.equal(m.created.length,0);
 m.state.access=true;m.state.bypass=true;assert((await opener.open(request(),sender())).disabled);assert.equal(m.created.length,0);m.state.bypass=false;
 m.state.failCreate=true;await assert.rejects(()=>opener.open(request(),sender()),/creation failed/);
 m.state.failCreate=false;m.state.failStorage=true;await opener.open(request(),sender());await createDriveTabOpener(m.api).open(request(),sender());assert.equal(m.created.length,1);
});

// A minimal Drive DOM harness. Any inserted overlay, iframe, or navigation
// interception fails immediately; the real content script runs unmodified.
function driveDOM(url:string,title:string,send:(message:any)=>Promise<any>,preferences:any={autoOpen:true,excludedSites:[]}){
 const listeners:Record<string,(event:any)=>void>={},timers=new Map<number,()=>void>(),messages:any[]=[];let seq=0,mutate=()=>{};
 class Element {tagName='DIV';textContent='Test 中文.pdf';attrs:Record<string,string>={'data-id':'abc_123'};closest(){return this;}getAttribute(key:string){return this.attrs[key]||null;}querySelector(){return null;}}
 const document={title,documentElement:Object.freeze({}),querySelector:()=>null,createElement:()=>{throw Error('Drive DOM must remain unchanged');},addEventListener:(type:string,fn:any)=>listeners[type]=fn};
 const location=new URL(url),window:any={addEventListener:(type:string,fn:any)=>listeners[type]=fn};window.top=window;
 const chrome={runtime:{sendMessage:(m:any)=>{messages.push(m);return send(m);}},storage:{local:{get:async()=>({preferences})},onChanged:{addListener:()=>{}}}};
 vm.runInNewContext(fs.readFileSync('public/drive.js','utf8'),{window,document,location,Element,URL,chrome,MutationObserver:class{constructor(fn:()=>void){mutate=fn;}observe(){}},setTimeout:(fn:()=>void)=>{timers.set(++seq,fn);return seq;},clearTimeout:(id:number)=>timers.delete(id)});
 return {document,location,messages,element:new Element(),event:(type:string,target=new Element())=>listeners[type]({target,key:'Enter',preventDefault:()=>{throw Error('Drive navigation was intercepted');},stopPropagation:()=>{throw Error('Drive navigation was intercepted');}}),mutate:()=>mutate(),flush:async()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}await tick();}};
}
test('Drive content script leaves the original page untouched and coalesces folder/preview opens into one viewer',async()=>{
 const m=chromeMock(),opener=createDriveTabOpener(m.api);
 const folder=driveDOM('https://drive.google.com/drive/u/2/my-drive','My Drive',message=>opener.open(message,sender(1))),preview=driveDOM(source+'?authuser=2','Test 中文.pdf - Google Drive',message=>opener.open(message,sender(2)));
 await tick();folder.event('dblclick');folder.event('dblclick');await folder.flush();await tick();
 assert.equal(folder.messages.length,1);assert.equal(preview.messages.length,1);assert.equal(m.created.length,1);
 for(let i=0;i<4;i++){preview.mutate();await preview.flush();}assert.equal(preview.messages.length,1);
 assert.equal(folder.location.href,'https://drive.google.com/drive/u/2/my-drive');assert.equal(preview.location.href,source+'?authuser=2');
 preview.location.href=source.replace('abc_123','next')+'?authuser=2';preview.document.title='Next.pdf - Google Drive';preview.mutate();await preview.flush();assert.equal(preview.messages.length,2);
});
test('Drive content script preserves link resource/account information and ignores non-PDF previews and exclusions',async()=>{
 const messages:any[]=[],send=async(m:any)=>{messages.push(m);return {ok:true};};
 const content=driveDOM('https://drive.google.com/drive/u/2/my-drive','My Drive',send);await tick();
 content.element.attrs.href=source+'?authuser=3&resourcekey=kept';content.event('keydown',content.element);await content.flush();assert.equal(new URL(messages[0].source).searchParams.get('authuser'),'3');assert.equal(new URL(messages[0].source).searchParams.get('resourcekey'),'kept');
 const nonPDF=driveDOM(source,'Image.png - Google Drive',send),excluded=driveDOM(source,'Test.pdf - Google Drive',send,{autoOpen:true,excludedSites:['google.com']});await tick();nonPDF.mutate();excluded.mutate();await nonPDF.flush();await excluded.flush();assert.equal(messages.length,1);
});
