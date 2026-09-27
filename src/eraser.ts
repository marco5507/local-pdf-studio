import type {Point,Mark} from './types';

function distance(p:Point,a:Point,b:Point){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function segmentDistance(a:Point,b:Point,c:Point,d:Point){
 const cross=(u:Point,v:Point,w:Point)=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]);
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 if(abC*abD<0&&cdA*cdB<0)return 0;
 return Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b));
}
// Test the entire cursor movement, including gaps between rapid pointer events.
export function sweptInk(from:Point,to:Point,marks:Mark[],zoom:number,diameter=20){
 return marks.filter(mark=>mark.type==='Ink'&&mark.editable&&(mark.ink||[]).some(stroke=>stroke.some((end,i)=>segmentDistance(from,to,stroke[Math.max(0,i-1)],end)<=diameter/2/zoom+mark.width/2))).map(mark=>mark.id);
}
export function sweptErasable(from:Point,to:Point,marks:Mark[],zoom:number,diameter=20){
 const ink=new Set(sweptInk(from,to,marks,zoom,diameter)),radius=diameter/2/zoom;
 return marks.filter(mark=>{
  if(!mark.editable)return false;if(ink.has(mark.id))return true;
  if(!['Highlight','Underline','StrikeOut'].includes(mark.type))return false;
  const r=mark.rect,quads=mark.quads?.length?mark.quads:[[r[0],r[1],r[2],r[1],r[0],r[3],r[2],r[3]]];
  return quads.some(q=>{
   const polygon:Point[]=[[q[0],q[1]],[q[2],q[3]],[q[6],q[7]],[q[4],q[5]]];
   const inside=(p:Point)=>{const signs=polygon.map((a,i)=>{const b=polygon[(i+1)%4];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);});return signs.some(s=>Math.abs(s)>1e-8)&&(signs.every(s=>s>=0)||signs.every(s=>s<=0));};
   return inside(from)||inside(to)||polygon.some((a,i)=>segmentDistance(from,to,a,polygon[(i+1)%4])<=radius);
  });
 }).map(mark=>mark.id);
}

// Exact line/capsule clipping: remove intervals inside the swept circular eraser.
export function cutInk(ink:Point[][],from:Point,to:Point,radius:number):Point[][]{
 const output:Point[][]=[];
 for(const stroke of ink){
  if(stroke.length===1){if(distance(stroke[0],from,to)>radius)output.push(stroke);continue;}
  let run:Point[]=[];
  const flush=()=>{if(run.length>1)output.push(run);run=[];};
  for(let i=1;i<stroke.length;i++){
   const a=stroke[i-1],b=stroke[i],vx=b[0]-a[0],vy=b[1]-a[1],length=vx*vx+vy*vy;
   if(length<1e-16)continue;
   const intervals:number[][]=[];
   for(const center of [from,to]){
    const dx=a[0]-center[0],dy=a[1]-center[1],B=2*(dx*vx+dy*vy),C=dx*dx+dy*dy-radius*radius,D=B*B-4*length*C;
    if(D>=0)intervals.push([(-B-Math.sqrt(D))/(2*length),(-B+Math.sqrt(D))/(2*length)]);
   }
   const ex=to[0]-from[0],ey=to[1]-from[1],el=Math.hypot(ex,ey);
   if(el>1e-10){
    let low=0,high=1;const ux=ex/el,uy=ey/el;
    const constrain=(start:number,delta:number,min:number,max:number)=>{if(Math.abs(delta)<1e-12){if(start<min||start>max)high=-1;}else{const x=(min-start)/delta,y=(max-start)/delta;low=Math.max(low,Math.min(x,y));high=Math.min(high,Math.max(x,y));}};
    constrain((a[0]-from[0])*ux+(a[1]-from[1])*uy,vx*ux+vy*uy,0,el);
    constrain(-(a[0]-from[0])*uy+(a[1]-from[1])*ux,-vx*uy+vy*ux,-radius,radius);
    if(high>=low)intervals.push([low,high]);
   }
   const merged:number[][]=[];
   for(const [lo,hi] of intervals.map(([l,h])=>[Math.max(0,l),Math.min(1,h)]).filter(([l,h])=>h-l>1e-10).sort((a,b)=>a[0]-b[0])){const last=merged.at(-1);if(last&&lo<=last[1]+1e-10)last[1]=Math.max(last[1],hi);else merged.push([lo,hi]);}
   const at=(t:number):Point=>[a[0]+vx*t,a[1]+vy*t];
   const keep=(start:number,end:number)=>{if(end-start<=1e-10)return;const p=at(start),q=at(end),last=run.at(-1);if(last&&Math.hypot(last[0]-p[0],last[1]-p[1])>1e-7)flush();if(!run.length)run.push(p);run.push(q);};
   let start=0;for(const [lo,hi] of merged){keep(start,lo);flush();start=hi;}keep(start,1);
  }
  flush();
 }
 return output;
}
