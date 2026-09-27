export function parseRanges(input:string,count:number):number[] {
 if(!input.trim())return Array.from({length:count},(_,i)=>i);
 const pages=new Set<number>();
 for(const part of input.split(',')){
  const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if(!m)throw new Error('Use page numbers or ranges, for example 1, 3-5.');
  const a=Number(m[1]),b=Number(m[2]||m[1]);
  if(a<1||b<a||b>count)throw new Error(`Page range must be between 1 and ${count}.`);
  for(let n=a;n<=b;n++)pages.add(n-1);
 }
 return [...pages].sort((a,b)=>a-b);
}
export const rectFromPoints=(a:number[],b:number[]):[number,number,number,number]=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
export const colorHex=(c:number[])=>'#'+(c.length===3?c:[c[0]??0,c[0]??0,c[0]??0]).map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
export const hexColor=(v:string)=>[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255);
export function nearStroke(point:number[],strokes:number[][][],width:number){const radius=Math.max(4,width/2+3);return strokes.some(stroke=>stroke.some((b,i)=>{const a=stroke[Math.max(0,i-1)],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/len)):0;return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)<=radius;}));}
