import {useEffect,useRef,useState} from 'react';

type Sample={x:number;y:number;time:number};
const lifetime=850;

/** Presentation-only overlay: never sends an edit to the PDF engine. */
export function LaserPointer(){
 const samples=useRef<Sample[]>([]),pointer=useRef<number|null>(null),frame=useRef<number|null>(null);
 const [now,setNow]=useState(0),[dot,setDot]=useState<{x:number;y:number}|null>(null);
 const clear=()=>{samples.current=[];pointer.current=null;if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;setDot(null);setNow(performance.now());};
 useEffect(()=>{const hide=()=>{if(document.hidden)clear();};window.addEventListener('blur',clear);document.addEventListener('visibilitychange',hide);return()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',hide);};},[]);
 const animate=()=>{frame.current=null;const time=performance.now();samples.current=samples.current.filter(p=>time-p.time<lifetime);setNow(time);if(samples.current.length)frame.current=requestAnimationFrame(animate);};
 const locate=(e:React.PointerEvent)=>{const rect=e.currentTarget.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};};
 const append=(position:{x:number;y:number})=>{samples.current=[...samples.current,{...position,time:performance.now()}].slice(-512);if(frame.current===null)frame.current=requestAnimationFrame(animate);};
 return <div className="laser-overlay" aria-hidden="true"
  onPointerDown={e=>{e.preventDefault();e.stopPropagation();if(e.button!==0||pointer.current!==null)return;pointer.current=e.pointerId;samples.current=[];const p=locate(e);setDot(p);append(p);e.currentTarget.setPointerCapture(e.pointerId);}}
  onPointerMove={e=>{e.stopPropagation();if(pointer.current!==null&&pointer.current!==e.pointerId)return;const p=locate(e);setDot(p);if(pointer.current===e.pointerId){if(e.buttons&1)append(p);else pointer.current=null;}}}
  onPointerUp={e=>{e.stopPropagation();if(pointer.current===e.pointerId){append(locate(e));pointer.current=null;}if(e.pointerType!=='mouse')setDot(null);}}
  onPointerCancel={e=>{e.stopPropagation();clear();}}
  onLostPointerCapture={()=>{pointer.current=null;}}
  onPointerLeave={()=>setDot(null)}
 >
  <svg className="laser-trail" width="100%" height="100%">
   {samples.current.slice(1).map((p,i)=><line key={`${p.time}-${i}`} x1={samples.current[i].x} y1={samples.current[i].y} x2={p.x} y2={p.y} stroke="#ff2345" strokeWidth="3" strokeLinecap="round" opacity={Math.max(0,1-(now-p.time)/lifetime)}/>)}
  </svg>
  {dot&&<span className="laser-dot" style={{left:dot.x,top:dot.y}}/>}
 </div>;
}
