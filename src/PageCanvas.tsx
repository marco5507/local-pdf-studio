import {fontCSS} from './fonts';
import {useEffect,useRef,useState} from 'react';
import type {EngineClient} from './client';
import type {Edit,PageInfo,Tool,Style,Point,Rect,TextSpan,Mark,InkEdit} from './types';
import type {Translate} from './i18n';
import {colorHex,rectFromPoints} from './ranges';
import {LaserPointer} from './LaserPointer';
import {SelectionToolbar} from './SelectionToolbar';
import {sweptErasable,cutInk} from './eraser';

const noHidden:string[]=[];
type Props={textEditing?:string|null;textValue?:string;onTextChange?:(text:string)=>void;onEndText?:()=>void;onEditText?:(id:string)=>void;hiddenMarks?:string[];engine:EngineClient;page:PageInfo;index:number;revision:number;zoom:number;tool:Tool;eraserMode:'partial'|'full';eraserSize:number;style:Style;readOnly:boolean;forms:boolean;selected:string|null;onSelect:(id:string|null)=>void;onEdit:(e:Edit)=>void;onCrop:(r:Rect)=>void;onPage:(i:number)=>void;t:Translate;image?:Uint8Array;hits?:number[][][];preview?:{rect:Rect;text:string;color:string;opacity:number;size:number;image?:string};thumbnail?:boolean};
export function PageCanvas(p:Props){
 const textEditor=useRef<HTMLTextAreaElement>(null);
 const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);const [visible,setVisible]=useState(false),[spans,setSpans]=useState<TextSpan[]>([]),[error,setError]=useState('');
 const [drag,setDrag]=useState<{start:Point;end:Point;points:Point[];pressures:number[];mark?:Mark;resize?:boolean}|null>(null);const dragRef=useRef(drag);dragRef.current=drag;
 const erasing=useRef<{pointer:number;last:Point;ids:Set<string>;changes:Map<string,Point[][]>}|null>(null),[erasePreview,setErasePreview]=useState<string[]>([]),[inkPreview,setInkPreview]=useState<InkEdit[]>([]),[eraserCursor,setEraserCursor]=useState<Point|null>(null);
 const cancelErase=()=>{erasing.current=null;setErasePreview([]);setInkPreview([]);};
 useEffect(()=>{cancelErase();setEraserCursor(null);},[p.tool,p.eraserMode,p.eraserSize,p.readOnly,p.page.id]);
 const hidden=p.hiddenMarks||noHidden,hiddenKey=hidden.join(',');
 const marks=p.page.marks.filter(a=>!hidden.includes(a.id));
 const w=p.page.bounds[2]-p.page.bounds[0],h=p.page.bounds[3]-p.page.bounds[1];const z=p.zoom;
 useEffect(()=>{const o=new IntersectionObserver(([e])=>{setVisible(e.isIntersecting);},{rootMargin:p.thumbnail?'100px':'500px'});if(root.current)o.observe(root.current);return()=>o.disconnect();},[]);
 useEffect(()=>{let cancelled=false;setError('');if(!visible){if(canvas.current){canvas.current.width=1;canvas.current.height=1;}setSpans([]);return;}
  p.engine.call('render',{page:p.index,scale:z*Math.min(devicePixelRatio,2),text:!p.thumbnail,hideMarks:[...hidden,...erasePreview,...(p.textEditing?[p.textEditing]:[])],inkEdits:inkPreview}).then(result=>{if(cancelled||!canvas.current)return;const c=canvas.current;c.width=result.width;c.height=result.height;c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(result.pixels),result.width,result.height),0,0);setSpans(result.spans);}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};
 },[visible,p.engine,p.index,p.revision,z,p.thumbnail,erasePreview,inkPreview,hiddenKey,p.textEditing]);
 useEffect(()=>{if(p.textEditing&&!p.readOnly){textEditor.current?.focus({preventScroll:true});textEditor.current?.select();}},[p.textEditing,p.readOnly]);
 const point=(e:{clientX:number;clientY:number}):Point=>{const b=root.current!.getBoundingClientRect();return [Math.max(0,Math.min(w,(e.clientX-b.left)/z)),Math.max(0,Math.min(h,(e.clientY-b.top)/z))];};
 const erasePoint=(e:{clientX:number;clientY:number}):Point=>{const b=root.current!.getBoundingClientRect();return [(e.clientX-b.left)/z,(e.clientY-b.top)/z];};
 const sweep=(to:Point)=>{const gesture=erasing.current;if(!gesture)return;const count=gesture.ids.size,hits=sweptErasable(gesture.last,to,marks,z,p.eraserSize);for(const id of hits){gesture.ids.add(id);if(p.eraserMode==='partial'){const mark=p.page.marks.find(a=>a.id===id)!;if(mark.type!=='Ink')continue;gesture.changes.set(id,cutInk(gesture.changes.get(id)??mark.ink??[],gesture.last,to,p.eraserSize/2/z+mark.width/2));}}gesture.last=to;if(p.eraserMode==='partial'&&hits.length)setInkPreview([...gesture.changes].map(([id,ink])=>({id,ink})));if(gesture.ids.size!==count)setErasePreview([...gesture.ids]);};
 const begin=(e:React.PointerEvent,mark?:Mark,resize=false)=>{
  if(p.thumbnail||p.tool==='laser'||p.readOnly||e.button!==0||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;
  if(p.tool==='select'&&!mark){p.onSelect(null);return;}
  if(mark&&!mark.editable)return;
  if(p.tool==='eraser'){const pt=erasePoint(e);erasing.current={pointer:e.pointerId,last:pt,ids:new Set(),changes:new Map()};setEraserCursor(pt);sweep(pt);e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);return;}
  const pt=point(e);setDrag({start:pt,end:pt,points:[pt],pressures:[e.pressure||.5],mark,resize});if(mark){(e.currentTarget as HTMLElement).focus({preventScroll:true});p.onSelect(mark.id);}
  if(!['Highlight','Underline','StrikeOut'].includes(p.tool)||mark){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);}e.stopPropagation();
 };
 const move=(e:React.PointerEvent)=>{if(p.tool==='eraser'){setEraserCursor(erasePoint(e));if(erasing.current?.pointer===e.pointerId){if(!(e.buttons&1)||p.readOnly){cancelErase();return;}e.preventDefault();const samples=e.nativeEvent.getCoalescedEvents?.()||[];for(const sample of samples)sweep(erasePoint(sample));sweep(erasePoint(e));}return;}const d=dragRef.current;if(!d)return;const end=point(e);setDrag({...d,end,points:p.tool==='Ink'?[...d.points,end]:[d.start,end],pressures:[...d.pressures,e.pressure||.5]});};
 const finish=(e:React.PointerEvent)=>{
  if(erasing.current?.pointer===e.pointerId){sweep(erasePoint(e));const ids=[...erasing.current.ids],changes=[...erasing.current.changes].map(([id,ink])=>({id,ink}));cancelErase();if(ids.length)p.onEdit(p.eraserMode==='partial'?{kind:'eraseInk',page:p.index,changes,removeIds:ids.filter(id=>!changes.some(c=>c.id===id))}:{kind:'eraseMarks',page:p.index,ids});return;}
  const d=dragRef.current;if(!d)return;setDrag(null);const end=point(e);let r=rectFromPoints(d.start,end);
  if(d.mark){const a=d.mark.rect,dx=end[0]-d.start[0],dy=end[1]-d.start[1];const rect:Rect=d.resize?[a[0],a[1],Math.max(a[0]+8,a[2]+dx),Math.max(a[1]+8,a[3]+dy)]:[a[0]+dx,a[1]+dy,a[2]+dx,a[3]+dy];if(Math.abs(dx)+Math.abs(dy)>1)p.onEdit({kind:'update',page:p.index,id:d.mark.id,rect});return;}
  if(p.tool==='crop'){if(r[2]-r[0]>10&&r[3]-r[1]>10)p.onCrop(r);return;}
  if(['Highlight','Underline','StrikeOut'].includes(p.tool)){
   const selection=window.getSelection();const quads:number[][]=[];
   if(selection?.rangeCount&&!selection.isCollapsed){const range=selection.getRangeAt(0);const b=root.current!.getBoundingClientRect();if(root.current!.contains(range.commonAncestorContainer))for(const box of Array.from(range.getClientRects())){if(box.width>0&&box.height>0){const x=(box.left-b.left)/z,y=(box.top-b.top)/z,ww=box.width/z,hh=box.height/z;quads.push([x,y,x+ww,y,x,y+hh,x+ww,y+hh]);}}selection.removeAllRanges();}
   if(!quads.length){if(r[2]-r[0]<3||r[3]-r[1]<3)return;quads.push([r[0],r[1],r[2],r[1],r[0],r[3],r[2],r[3]]);}
   p.onEdit({kind:'add',page:p.index,type:p.tool,rect:r,style:{...p.style,text:'',opacity:p.tool==='Highlight'?.45:1},quads});return;
  }
  if(['select','eraser','laser'].includes(p.tool))return;
  if(r[2]-r[0]<5||r[3]-r[1]<5){r=[d.start[0],d.start[1],Math.min(w,d.start[0]+(p.tool==='Text'?24:180)),Math.min(h,d.start[1]+(p.tool==='Text'?24:65))];}
  if(p.tool==='FreeText'){const minH=p.style.fontSize*1.35+6,minW=Math.max(40,p.style.fontSize+6);r=[Math.max(0,Math.min(r[0],w-minW)),Math.max(0,Math.min(r[1],h-minH)),Math.min(w,Math.max(r[2],r[0]+minW)),Math.min(h,Math.max(r[3],r[1]+minH))];}
  if(p.tool==='Ink'&&d.points.length<2)return;
  p.onEdit({kind:'add',page:p.index,type:p.tool,rect:r,style:{...p.style,text:['FreeText','Text'].includes(p.tool)?p.style.text||p.t(p.tool==='Text'?'Add note':'Add text'):''},points:p.tool==='Ink'?d.points:[d.start,end],image:p.tool==='Stamp'?p.image:undefined});
 };
 const box=(r:Rect)=>({left:r[0]*z,top:r[1]*z,width:(r[2]-r[0])*z,height:(r[3]-r[1])*z});
 const selected=marks.find(a=>a.id===p.selected);
 let dragBox:Rect|undefined;if(drag?.mark){const a=drag.mark.rect,dx=drag.end[0]-drag.start[0],dy=drag.end[1]-drag.start[1];dragBox=drag.resize?[a[0],a[1],a[2]+dx,a[3]+dy]:[a[0]+dx,a[1]+dy,a[2]+dx,a[3]+dy];}
 return <div ref={root} className={`pdf-page ${p.thumbnail?'thumbnail-page':''} tool-${p.tool}`} style={{width:w*z,height:h*z}} data-page={p.index+1} data-erasing-count={erasePreview.length} onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerLeave={()=>setEraserCursor(null)} onLostPointerCapture={()=>{if(erasing.current)cancelErase();}} onPointerCancel={()=>{setDrag(null);cancelErase();}}>
  <canvas ref={canvas} aria-label={`${p.t('Page')} ${p.index+1}`} style={{width:w*z,height:h*z}}/>
  {error&&<div className="page-error">{error}</div>}
  {!p.thumbnail&&<>
   <SelectionToolbar root={root} enabled={p.tool==='select'&&!p.readOnly} zoom={z} page={p.index} style={p.style} onEdit={p.onEdit} t={p.t}/>
   {p.tool==='laser'&&<LaserPointer key={z}/>}
   {p.tool==='eraser'&&!p.readOnly&&eraserCursor&&<div className="eraser-cursor" style={{left:eraserCursor[0]*z,top:eraserCursor[1]*z,width:p.eraserSize,height:p.eraserSize}}/>}
   <div className={`text-layer ${p.tool==='select'||['Highlight','Underline','StrikeOut'].includes(p.tool)?'selectable':''}`} aria-label={p.t('Page')}>
    {spans.map((s,i)=><span key={i} style={{...box(s.rect),fontSize:s.size*z,lineHeight:`${(s.rect[3]-s.rect[1])*z}px`}}>{s.text}</span>)}
   </div>
   {p.tool==='select'&&p.page.links.map((l,i)=><a key={i} className="pdf-link" style={box(l.rect)} href={/^https?:|^mailto:|^#page=/.test(l.uri)?l.uri:undefined} title={l.uri} onClick={e=>{if(l.uri.startsWith('#page=')){e.preventDefault();p.onPage(Number(l.uri.split('=')[1])-1);}e.stopPropagation();}} target={l.uri.startsWith('#')?undefined:'_blank'} rel="noreferrer"/>) }
   {p.tool==='select'&&!p.readOnly&&marks.filter(a=>a.editable&&a.id!==p.textEditing).flatMap(a=>(a.quads?.length?a.quads.map(q=>[Math.min(q[0],q[2],q[4],q[6]),Math.min(q[1],q[3],q[5],q[7]),Math.max(q[0],q[2],q[4],q[6]),Math.max(q[1],q[3],q[5],q[7])] as Rect):[a.rect]).map((hit,part)=><button key={`${a.id}-${part}`} aria-label={`${p.t(a.type==='Text'?'Note':a.type)}: ${a.contents||p.t('Selected annotation')}`} className="mark-hit" style={box([hit[0],hit[1]-Math.max(0,12/z-(hit[3]-hit[1]))/2,hit[2],hit[3]+Math.max(0,12/z-(hit[3]-hit[1]))/2])} onDoubleClick={e=>{if(a.type==='FreeText'){e.stopPropagation();p.onEditText?.(a.id);}}} onPointerDown={e=>begin(e,a)} onClick={e=>{e.stopPropagation();e.currentTarget.focus({preventScroll:true});p.onSelect(a.id);}}/>))}
   {selected?.type==='FreeText'&&selected.id===p.textEditing&&!p.readOnly&&<textarea ref={textEditor} className="text-box-editor" aria-label={p.t('Text box content')} value={p.textValue??selected.contents} style={{...box(selected.rect),...fontCSS(selected.font),fontSize:selected.fontSize*z,lineHeight:1.35,padding:3*z,color:colorHex(selected.color),opacity:selected.opacity}} onChange={e=>p.onTextChange?.(e.target.value)} onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onBlur={()=>p.onEndText?.()} onKeyDown={e=>{if(e.key==='Escape'&&!e.nativeEvent.isComposing){e.stopPropagation();p.onEndText?.();}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();p.onEndText?.();}}}/>}
   {selected?.type==='FreeText'&&selected.editable&&p.tool==='select'&&!p.readOnly&&<button className="text-box-move" aria-label={p.t('Move text box')} title={p.t('Drag to move; double-click the text to edit.')} style={{left:selected.rect[0]*z,top:Math.max(0,selected.rect[1]*z-30)}} onPointerDown={e=>begin(e,selected)}>{p.t('Move')}</button>}
   {selected&&p.tool==='select'&&<div className="selection-box" style={box(dragBox||selected.rect)}><button aria-label={p.t('Resize annotation')} className="resize-handle" onPointerDown={e=>begin(e,selected,true)}/></div>}
   {selected?.editable&&p.tool==='select'&&!p.readOnly&&<button className="annotation-delete" aria-label={p.t('Delete annotation')} title={p.t('Delete annotation')} style={{left:Math.min(w*z-30,selected.rect[2]*z),top:Math.max(0,selected.rect[1]*z-32)}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();p.onEdit({kind:'deleteMark',page:p.index,id:selected.id});}}>×</button>}
   {p.forms&&p.page.fields.map(f=>['text','combobox','listbox','checkbox','radiobutton'].includes(f.type)?<div className="field" key={`${f.id}-${p.revision}`} style={box(f.rect)}>
    {f.type==='text'&&f.multiline?<textarea aria-label={f.label} title={f.label} defaultValue={f.value} disabled={p.readOnly||f.readOnly} onBlur={e=>{if(e.target.value!==f.value)p.onEdit({kind:'field',page:p.index,id:f.id,value:e.target.value});}}/>:f.type==='text'?<input aria-label={f.label} title={f.label} defaultValue={f.value} disabled={p.readOnly||f.readOnly} onBlur={e=>{if(e.target.value!==f.value)p.onEdit({kind:'field',page:p.index,id:f.id,value:e.target.value});}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} style={{fontSize:Math.min(15,(f.rect[3]-f.rect[1])*.5)*z}}/>:['checkbox','radiobutton'].includes(f.type)?<input type={f.type==='checkbox'?'checkbox':'radio'} aria-label={f.label} checked={!!f.checked} disabled={p.readOnly||f.readOnly} onChange={()=>p.onEdit({kind:'field',page:p.index,id:f.id,value:''})}/>:<select aria-label={f.label} defaultValue={f.value} disabled={p.readOnly||f.readOnly} onChange={e=>p.onEdit({kind:'field',page:p.index,id:f.id,value:e.target.value})}>{f.options.map(o=><option key={o}>{o}</option>)}</select>}
   </div>:null)}
   {p.hits?.flatMap((match,mi)=>match.map((q,qi)=><div className="search-hit" key={`${mi}-${qi}`} style={box([Math.min(q[0],q[2],q[4],q[6]),Math.min(q[1],q[3],q[5],q[7]),Math.max(q[0],q[2],q[4],q[6]),Math.max(q[1],q[3],q[5],q[7])])}/>))}
   {drag&&!drag.mark&&<svg className="draw-preview" viewBox={`0 0 ${w} ${h}`}>{p.tool==='Ink'?drag.points.slice(1).map((pt,i)=><line key={i} x1={drag.points[i][0]} y1={drag.points[i][1]} x2={pt[0]} y2={pt[1]} stroke={colorHex(p.style.color)} opacity={p.style.opacity} strokeWidth={p.style.width*(.5+drag.pressures[i])} strokeLinecap="round"/>):<rect x={Math.min(drag.start[0],drag.end[0])} y={Math.min(drag.start[1],drag.end[1])} width={Math.abs(drag.start[0]-drag.end[0])} height={Math.abs(drag.start[1]-drag.end[1])} fill="#2563eb18" stroke="#2563eb" strokeDasharray="4 3" strokeWidth={1/z}/>}</svg>}
   {p.preview&&<div className="batch-preview" style={{...box(p.preview.rect),color:p.preview.color,opacity:p.preview.opacity,fontSize:p.preview.size*z}}>{p.preview.image?<img src={p.preview.image}/>:p.preview.text}</div>}
  </>}
 </div>;
}
