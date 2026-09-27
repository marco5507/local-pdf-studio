export type ReadingAnchor={page:number;x:number;y:number;screenX:number;screenY:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
// Track the page containing the reading line, rather than the nearest page top.
// Keep the current page when two pages share the same row.
export function visiblePage(container:HTMLElement,current:number):number {
 const view=container.getBoundingClientRect(),line=view.top+25;
 let best=current,distance=Infinity;
 for(const el of container.querySelectorAll<HTMLElement>('.pdf-page')){
  const r=el.getBoundingClientRect();
  if(r.right<=view.left||r.left>=view.right)continue;
  const d=Math.max(r.top-line,line-r.bottom,0),page=Number(el.dataset.page)-1;
  if(d<distance||(d===distance&&page===current)){distance=d;best=page;}
 }
 return best;
}
export function captureReadingAnchor(container:HTMLElement,current:number):ReadingAnchor|null {
 const page=visiblePage(container,current),el=container.querySelector<HTMLElement>(`[data-page="${page+1}"]`);
 if(!el)return null;
 const v=container.getBoundingClientRect(),r=el.getBoundingClientRect();
 const x=clamp(v.left+container.clientWidth/2,r.left,r.right),y=clamp(v.top+25,r.top,r.bottom);
 return {page,x:(x-r.left)/r.width,y:(y-r.top)/r.height,screenX:x-v.left,screenY:y-v.top};
}
export function restoreReadingAnchor(container:HTMLElement,anchor:ReadingAnchor){
 const el=container.querySelector<HTMLElement>(`[data-page="${anchor.page+1}"]`);if(!el)return;
 const v=container.getBoundingClientRect(),r=el.getBoundingClientRect();
 container.scrollLeft+=r.left+anchor.x*r.width-v.left-anchor.screenX;
 container.scrollTop+=r.top+anchor.y*r.height-v.top-anchor.screenY;
}
