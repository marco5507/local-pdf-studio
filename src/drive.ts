export function driveDownloadURLs(source:string):string[]{
 const u=new URL(source);if(u.hostname!=='drive.google.com')throw new Error('Not a Google Drive URL.');
 const id=u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1]||u.searchParams.get('id');if(!id||!/^[\w-]+$/.test(id))throw new Error('This Drive link does not identify a file.');
 return ['https://drive.google.com/uc','https://drive.usercontent.google.com/download'].map(base=>{const out=new URL(base);out.searchParams.set('export','download');out.searchParams.set('id',id);for(const key of ['authuser','resourcekey']){const value=u.searchParams.get(key);if(value)out.searchParams.set(key,value);}return out.href;});
}
export async function fetchDrivePDF(source:string):Promise<Uint8Array>{
 let detail='';for(const url of driveDownloadURLs(source)){try{const r=await fetch(url,{credentials:'include',signal:AbortSignal.timeout(30000)});if(!r.ok){detail=`HTTP ${r.status}`;continue;}const data=new Uint8Array(await r.arrayBuffer());if(new TextDecoder().decode(data.subarray(0,1024)).includes('%PDF-'))return data;detail='Drive returned a preview or access page instead of PDF bytes.';}catch(e){detail=e instanceof Error?e.message:String(e);}}
 throw new Error('Google Drive did not provide a downloadable PDF. Check that this account can download the file, or return to the Drive preview. '+detail);
}
