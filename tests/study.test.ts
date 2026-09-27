import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {PDFEngine} from '../src/engine.ts';
import {encodeBackup,decodeBackup} from '../src/backup.ts';
import {matchesAnnotation,annotationColor,studyHTML} from '../src/annotations.ts';
const preferences={language:'zh' as const,theme:'dark' as const,autoOpen:true,excludedSites:['example.com'],eraserSize:36,presets:[],signatures:[]};
const style={color:[1,0,0],opacity:1,width:2,fontSize:14,text:''};
test('backup preserves binary PDFs, bookmarks and tools and rejects corruption and truncation',async()=>{
 const d=await PDFDocument.create();d.addPage();const bytes=new Uint8Array(await d.save()).buffer;
 const draft={id:'original',name:'中文.pdf',source:bytes,current:bytes,updated:123,page:0,zoom:1,bytes:bytes.byteLength,encrypted:true,bookmarks:[{id:'a',pageId:'stable',label:'考試'}]};
 const blob=await encodeBackup([draft],preferences),restored=await decodeBackup(blob);
 assert.deepEqual(restored.drafts,[draft]);assert.equal(restored.preferences.eraserSize,36);assert.equal(restored.preferences.autoOpen,false);assert.deepEqual(restored.preferences.excludedSites,[]);
 const broken=new Uint8Array(await blob.arrayBuffer());broken[broken.length-20]^=1;await assert.rejects(decodeBackup(new Blob([broken])),/damaged/);
 await assert.rejects(decodeBackup(blob.slice(0,blob.size-1)),/damaged/);await assert.rejects(decodeBackup(new Blob([blob,'extra'])),/damaged/);
 await assert.rejects(encodeBackup([], {...preferences,signatures:[{name:'bad',data:'data:image/svg+xml,<svg/>'}]}),/damaged/);
});
test('annotation filters combine color and type; study HTML escapes document text',()=>{
 assert.equal(annotationColor([0,1,1,0]),'#ff0000');assert.equal(annotationColor([.5]),'#808080');
 assert.equal(matchesAnnotation({type:'Ink',color:[1,0,0]},{type:'Ink',color:'#ff0000'}),true);assert.equal(matchesAnnotation({type:'Text',color:[1,0,0]},{type:'Ink',color:'#ff0000'}),false);
 const html=studyHTML('<script>x</script>',[{page:2,id:'a',type:'Text',color:[1,0,0],text:'中文',contents:'<img src=x onerror=alert(1)>'}],s=>s);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('Page 3'));assert.ok(html.includes('中文'));
});
test('filtered rendering preserves annotations; study text follows crop, rotation, reorder and reopening',async()=>{
 const d=await PDFDocument.create();const p=d.addPage([500,600]);p.drawText('Study this sentence',{x:40,y:500,size:20});d.addPage([500,600]);
 const e=new PDFEngine();try{e.open(await d.save());const q=e.search('Study this sentence')[0].quads[0];
 e.edit({kind:'add',page:0,type:'Highlight',rect:[40,70,300,110],quads:q,style});e.edit({kind:'add',page:0,type:'Text',rect:[350,200,374,224],style:{...style,text:'考試提醒'}});
 const before=e.info(),marks=before.pages[0].marks,full=e.render(0,.5,false),hidden=e.render(0,.5,false,marks.map(a=>a.id));assert.notDeepEqual(hidden.pixels,full.pixels);assert.deepEqual(e.info(),before);
 const check=(page:number)=>{const rows=e.study(page);assert.equal(rows.find(r=>r.type==='Highlight')?.text,'Study this sentence');assert.equal(rows.find(r=>r.type==='Text')?.contents,'考試提醒');};check(0);
 e.edit({kind:'rotate',pages:[0],degrees:90});check(0);e.undo();e.edit({kind:'crop',pages:[0],rect:[10,10,490,590]});check(0);e.edit({kind:'reorder',order:[1,0]});check(1);
 const reopened=new PDFEngine();try{reopened.open(e.export());assert.equal(reopened.study(1).find(r=>r.type==='Highlight')?.text,'Study this sentence');assert.equal(reopened.info().pages[1].marks.length,2);}finally{reopened.destroy();}
 }finally{e.destroy();}
});
