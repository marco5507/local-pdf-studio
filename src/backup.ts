import {isFontName} from './fonts.ts';
import type {Draft,Preferences,Style} from './types';

const magic='LPSBAK1\n',encoder=new TextEncoder(),decoder=new TextDecoder();
const hash=async(b:ArrayBuffer)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
type Entry=Omit<Draft,'source'|'current'|'token'>&{sourceSize:number;currentSize:number;sourceHash:string;currentHash:string};
export type Backup={drafts:Draft[];preferences:Preferences};
function check(ok:unknown):asserts ok {if(!ok)throw Error('Invalid or damaged backup.');}
const finite=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function style(v:Style){return v&&(v.font===undefined||isFontName(v.font))&&Array.isArray(v.color)&&[1,3,4].includes(v.color.length)&&v.color.every(n=>finite(n,0,1))&&finite(v.opacity,0,1)&&finite(v.width,0,200)&&finite(v.fontSize,1,1000)&&typeof v.text==='string';}
export function checkedPreferences(p:Preferences):Preferences{
 check(p&&['en','zh'].includes(p.language)&&['system','light','dark'].includes(p.theme));
 check(Array.isArray(p.presets)&&p.presets.length<=100&&p.presets.every(style));
 check(Array.isArray(p.signatures)&&p.signatures.length<=100&&p.signatures.every(s=>typeof s.name==='string'&&typeof s.data==='string'&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s.data)));
 check(p.eraserSize===undefined||finite(p.eraserSize,4,80));
 // Site permissions and automatic opening are configured on the destination.
 return {language:p.language,theme:p.theme,eraserSize:p.eraserSize,presets:p.presets,signatures:p.signatures,autoOpen:false,excludedSites:[]};
}
export async function encodeBackup(drafts:Draft[],preferences:Preferences):Promise<Blob>{
 const entries:Entry[]=[];
 for(const {source,current,token,...d} of drafts)entries.push({...d,sourceSize:source.byteLength,currentSize:current.byteLength,sourceHash:await hash(source),currentHash:await hash(current)});
 const header=encoder.encode(JSON.stringify({version:1,entries,preferences:checkedPreferences(preferences)}));
 check(header.length<=16*1024*1024);
 const size=new ArrayBuffer(4);new DataView(size).setUint32(0,header.length);
 return new Blob([magic,size,header,...drafts.flatMap(d=>[d.source,d.current])],{type:'application/octet-stream'});
}
export async function decodeBackup(file:Blob):Promise<Backup>{
 check(file.size>=12);check(decoder.decode(await file.slice(0,8).arrayBuffer())===magic);
 const size=new DataView(await file.slice(8,12).arrayBuffer()).getUint32(0);check(size>0&&size<=16*1024*1024&&12+size<=file.size);
 let manifest;try{manifest=JSON.parse(decoder.decode(await file.slice(12,12+size).arrayBuffer()));}catch{throw Error('Invalid or damaged backup.');}
 check(manifest&&manifest.version===1&&Array.isArray(manifest.entries)&&manifest.entries.length<=10000);
 const preferences=checkedPreferences(manifest.preferences);let offset=12+size;const drafts:Draft[]=[];
 for(const e of manifest.entries as Entry[]){
  check(e&&typeof e.name==='string'&&e.name.length<=4096&&typeof e.id==='string'&&typeof e.encrypted==='boolean');
  check(Number.isInteger(e.page)&&e.page>=0&&finite(e.zoom,.05,10)&&finite(e.updated,0,Number.MAX_SAFE_INTEGER));
  check(Number.isSafeInteger(e.sourceSize)&&e.sourceSize>0&&Number.isSafeInteger(e.currentSize)&&e.currentSize>0&&offset+e.sourceSize+e.currentSize<=file.size);
  check(e.bookmarks===undefined||(Array.isArray(e.bookmarks)&&e.bookmarks.length<=100000&&e.bookmarks.every(b=>b&&typeof b.id==='string'&&typeof b.pageId==='string'&&typeof b.label==='string')));
  const source=await file.slice(offset,offset+e.sourceSize).arrayBuffer();offset+=e.sourceSize;
  const current=await file.slice(offset,offset+e.currentSize).arrayBuffer();offset+=e.currentSize;
  check(await hash(source)===e.sourceHash&&await hash(current)===e.currentHash);
  check([source,current].every(b=>decoder.decode(b.slice(0,1024)).includes('%PDF-')));
  drafts.push({id:e.id,name:e.name,source,current,updated:e.updated,page:e.page,zoom:e.zoom,bytes:current.byteLength,encrypted:e.encrypted,bookmarks:e.bookmarks});
 }
 check(offset===file.size);return {drafts,preferences};
}
