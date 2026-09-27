import {useState} from 'react';
import type {Bookmark,PageInfo} from './types';
import type {Translate} from './i18n';
export function BookmarksPanel({bookmarks,pages,page,onChange,onJump,t}:{bookmarks:Bookmark[];pages:PageInfo[];page:number;onChange:(value:Bookmark[])=>void;onJump:(page:number)=>void;t:Translate}){
 const [name,setName]=useState('');
 return <div className="bookmarks-panel"><form onSubmit={e=>{e.preventDefault();if(!pages[page])return;onChange([...bookmarks,{id:crypto.randomUUID(),pageId:pages[page].id,label:name.trim()||`${t('Page')} ${page+1}`}]);setName('');}}><input aria-label={t('Bookmark name')} placeholder={t('Bookmark name')} value={name} maxLength={160} onChange={e=>setName(e.target.value)}/><button type="submit">{t('Add bookmark')}</button></form>
  {!bookmarks.length&&<p className="panel-empty">{t('No bookmarks yet')}</p>}
  {bookmarks.map(b=>{const i=pages.findIndex(p=>p.id===b.pageId);return <div className="bookmark-row" key={b.id}><input aria-label={t('Rename bookmark')} defaultValue={b.label} maxLength={160} onBlur={e=>{const label=e.target.value.trim()||b.label;e.target.value=label;if(label!==b.label)onChange(bookmarks.map(a=>a.id===b.id?{...a,label}:a));}}/><div><button disabled={i<0} title={b.label} onClick={()=>onJump(i)}>{i<0?t('Page removed'):`${t('Page')} ${i+1}`}</button><button aria-label={`${t('Remove bookmark')}: ${b.label}`} onClick={()=>onChange(bookmarks.filter(a=>a.id!==b.id))}>×</button></div></div>;})}
  <small>{t('Bookmarks are saved with this local draft.')}</small>
 </div>;
}
