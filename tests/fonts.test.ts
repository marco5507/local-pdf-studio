import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {PDFEngine} from '../src/engine.ts';
import {fontOptions,fontName} from '../src/fonts.ts';
import {encodeBackup,decodeBackup} from '../src/backup.ts';
test('all bundled font choices render distinctly and survive text edits, movement and export',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([500,700]);const e=new PDFEngine();const pictures=new Set<string>();
 try{e.open(await pdf.save());e.edit({kind:'add',page:0,type:'FreeText',rect:[40,100,420,250],style:{text:'Font sample Wide iii 中文',color:[.1,.2,.7],width:0,opacity:1,fontSize:24}});const id=e.info().pages[0].marks[0].id;
 for(const f of fontOptions){e.edit({kind:'update',page:0,id,style:{font:f.id}});assert.equal(e.info().pages[0].marks[0].font,f.id);const image=e.render(0,.5,false);pictures.add(Buffer.from(image.pixels).toString('base64'));const reopened=new PDFEngine();try{reopened.open(e.export());assert.equal(reopened.info().pages[0].marks[0].font,f.id);assert.deepEqual(reopened.render(0,.5,false).pixels,image.pixels);}finally{reopened.destroy();}}
 assert.equal(pictures.size,fontOptions.length,'Font choices produced identical appearances');e.edit({kind:'update',page:0,id,style:{text:'Preserved font 中文'}});e.edit({kind:'update',page:0,id,rect:[60,120,440,270]});assert.equal(e.info().pages[0].marks[0].font,'Courier-BoldOblique');e.edit({kind:'update',page:0,id,style:{font:'Times-Roman'}});e.undo();assert.equal(e.info().pages[0].marks[0].font,'Courier-BoldOblique');e.redo();assert.equal(e.info().pages[0].marks[0].font,'Times-Roman');
 const flat=new PDFEngine();try{const image=e.render(0,.5,false);flat.open(e.export(true));assert.deepEqual(flat.render(0,.5,false).pixels,image.pixels);}finally{flat.destroy();}
 }finally{e.destroy();}
});
test('font preferences round-trip in backups and old aliases remain compatible',async()=>{
 assert.equal(fontName('Helv'),'Helvetica');assert.equal(fontName('Cour'),'Courier');assert.equal(fontName(),'Helvetica');
 const prefs={language:'en' as const,theme:'system' as const,autoOpen:false,excludedSites:[],signatures:[],presets:[{font:'Times-Bold' as const,text:'',color:[0,0,0],width:2,opacity:1,fontSize:18}]};
 assert.equal((await decodeBackup(await encodeBackup([],prefs))).preferences.presets[0].font,'Times-Bold');
});
