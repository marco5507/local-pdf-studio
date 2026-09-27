// The picker must run directly from a user gesture, before PDF processing.
export type PDFFileHandle = {
 name:string;
 getFile():Promise<{size:number;lastModified:number}>;
 createWritable():Promise<{write(data:ArrayBuffer):Promise<void>;close():Promise<void>;abort():Promise<void>}>;
};
export type PDFSavePicker = (options:{suggestedName:string;types:{description:string;accept:Record<string,string[]>}[];excludeAcceptAllOption:boolean})=>Promise<PDFFileHandle>;
export function savePicker():PDFSavePicker|undefined {
 const host=window as unknown as {showSaveFilePicker?:PDFSavePicker};
 return host.showSaveFilePicker?.bind(window);
}
export async function saveEditableFile(picker:PDFSavePicker,name:string,exportPDF:()=>Promise<Uint8Array>):Promise<string> {
 const handle=await picker({suggestedName:name.replace(/\.pdf$/i,'')+'.pdf',types:[{description:'PDF document',accept:{'application/pdf':['.pdf']}}],excludeAcceptAllOption:true});
 const original=await handle.getFile();
 const bytes=await exportPDF();
 const current=await handle.getFile();
 if(current.size!==original.size||current.lastModified!==original.lastModified)throw new Error('The selected file changed while saving. Choose the file again to retry.');
 const writable=await handle.createWritable();
 try {
  await writable.write(new Uint8Array(bytes).buffer);
  await writable.close();
 } catch(error) {
  try {await writable.abort();} catch {/* Keep the original write failure. */}
  throw error;
 }
 return handle.name;
}
