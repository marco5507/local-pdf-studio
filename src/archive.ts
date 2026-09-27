// ZIP "store" mode: PDFs are already compressed, so avoid recompressing them.
// UTF-8 filenames, CRC-32, and conventional ZIP headers for broad compatibility.
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function zipPDFs(files:{name:string;bytes:Uint8Array}[]):Uint8Array{
 if(files.length>65535)throw new Error('Too many split files.');
 const encoder=new TextEncoder(),parts:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0,centralSize=0;
 for(const file of files){const name=encoder.encode(file.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_'));if(name.length>65535)throw new Error('Filename is too long.');let crc=0xffffffff;for(const byte of file.bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,file.bytes.length,true);l.setUint32(22,file.bytes.length,true);l.setUint16(26,name.length,true);local.set(name,30);
  const directory=new Uint8Array(46+name.length),d=new DataView(directory.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,file.bytes.length,true);d.setUint32(24,file.bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);
  parts.push(local,file.bytes);central.push(directory);offset+=local.length+file.bytes.length;centralSize+=directory.length;
 }
 if(offset+centralSize+22>0xffffffff)throw new Error('This split archive exceeds the 4 GB ZIP limit. Use smaller page groups.');
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
 const out=new Uint8Array(offset+centralSize+22);let at=0;for(const part of [...parts,...central,end]){out.set(part,at);at+=part.length;}return out;
}
