import {useEffect,useState,type RefObject} from 'react';
import {Highlighter,Underline,Strikethrough,StickyNote,X} from 'lucide-react';
import type {Edit,Rect,Style} from './types';
import type {Translate} from './i18n';
import {hexColor} from './ranges';

type SelectionData={quads:number[][];rect:Rect;left:number;top:number};
export function SelectionToolbar({root,enabled,zoom,page,style,onEdit,t}:{root:RefObject<HTMLDivElement|null>;enabled:boolean;zoom:number;page:number;style:Style;onEdit:(edit:Edit)=>void;t:Translate}){
 const [selection,setSelection]=useState<SelectionData|null>(null),[note,setNote]=useState<string|null>(null),[color,setColor]=useState('#f8c73c');
 useEffect(()=>{
  setSelection(null);setNote(null);if(!enabled)return;
  const inspect=()=>{
   if(root.current?.querySelector('.selection-toolbar')?.contains(document.activeElement))return;
   const s=window.getSelection(),element=root.current;
   if(!element||!s?.rangeCount||s.isCollapsed||!s.toString().trim()){setSelection(null);setNote(null);return;}
   const range=s.getRangeAt(0),layer=element.querySelector('.text-layer');
   if(!layer?.contains(range.commonAncestorContainer)){setSelection(null);return;}
   const b=element.getBoundingClientRect(),boxes=Array.from(range.getClientRects()).filter(r=>r.width>0&&r.height>0);
   if(!boxes.length)return;
   const quads=boxes.map(r=>[(r.left-b.left)/zoom,(r.top-b.top)/zoom,(r.right-b.left)/zoom,(r.top-b.top)/zoom,(r.left-b.left)/zoom,(r.bottom-b.top)/zoom,(r.right-b.left)/zoom,(r.bottom-b.top)/zoom]);
   const rect:Rect=[Math.min(...quads.map(q=>q[0])),Math.min(...quads.map(q=>q[1])),Math.max(...quads.map(q=>q[6])),Math.max(...quads.map(q=>q[7]))];
   setSelection({quads,rect,left:Math.max(0,Math.min(b.width-280,boxes[0].left-b.left)),top:Math.max(0,boxes[0].top-b.top-46)});setNote(null);
  };
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelection(null);setNote(null);window.getSelection()?.removeAllRanges();}};
  document.addEventListener('selectionchange',inspect);window.addEventListener('keyup',inspect);window.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('selectionchange',inspect);window.removeEventListener('keyup',inspect);window.removeEventListener('keydown',escape);};
 },[enabled,zoom,page,root]);
 if(!enabled||!selection)return null;
 const close=()=>{setSelection(null);setNote(null);window.getSelection()?.removeAllRanges();};
 const add=(type:string)=>{const r=selection.rect;onEdit({kind:'add',page,type,rect:type==='Text'?[r[0],r[1],r[0]+24,r[1]+24]:r,quads:type==='Text'?undefined:selection.quads,style:{...style,color:hexColor(color),opacity:type==='Highlight'?.45:1,text:type==='Text'?note||'':''}});close();};
 return <div className="selection-toolbar" role="toolbar" aria-label={t('Selected text tools')} style={{left:selection.left,top:selection.top}} onPointerDown={e=>{e.stopPropagation();if(!(e.target instanceof HTMLTextAreaElement)&&!(e.target instanceof HTMLInputElement))e.preventDefault();}}>
  <div className="selection-actions">
   {([['Highlight',Highlighter],['Underline',Underline],['StrikeOut',Strikethrough]] as const).map(([type,Icon])=><button key={type} title={t(type)} aria-label={t(type)} onClick={()=>add(type)}><Icon size={17}/></button>)}
   <button title={t('Note')} aria-label={t('Note')} onClick={()=>setNote('')}><StickyNote size={17}/></button>
   <input type="color" aria-label={t('Selection color')} value={color} onChange={e=>setColor(e.target.value)}/>
   <button title={t('Close')} aria-label={t('Close')} onClick={close}><X size={15}/></button>
  </div>
  {note!==null&&<form onSubmit={e=>{e.preventDefault();if(note.trim())add('Text');}}><textarea aria-label={t('Write a note')} placeholder={t('Write a note')} value={note} onChange={e=>setNote(e.target.value)} autoFocus/><button type="submit" disabled={!note.trim()}>{t('Add note')}</button></form>}
 </div>;
}
