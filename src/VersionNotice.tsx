import {useEffect,useState} from 'react';
import type {Translate} from './i18n';
declare const __APP_VERSION__:string;
export function VersionNotice({t,onRefresh,disabled}:{t:Translate;onRefresh:()=>Promise<void>;disabled:boolean}){
 const [update,setUpdate]=useState(false);
 useEffect(()=>{
  let alive=true;const extension=!!globalThis.chrome?.runtime?.id;
  const url=extension?chrome.runtime.getURL('manifest.json'):new URL('manifest.json',location.href).href;
  const check=async()=>{try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return;const manifest=await r.json();if(alive&&typeof manifest.version==='string')setUpdate(manifest.version!==__APP_VERSION__);}catch{if(alive&&extension&&!globalThis.chrome?.runtime?.id)setUpdate(true);}};
  const visible=()=>{if(document.visibilityState==='visible')void check();};
  void check();const timer=setInterval(visible,60000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[]);
 return <><span className="version-badge" title={t('Running version')}>v{__APP_VERSION__}</span>{update&&<div className="version-notice" role="status"><span>{t('An update is available. Save your work, then refresh this PDF tab.')}</span><button disabled={disabled} onClick={()=>onRefresh().catch(()=>{})}>{t('Save and refresh tab')}</button></div>}</>;
}
