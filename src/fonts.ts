// These standard PDF fonts are included in the local MuPDF runtime.
export const fontOptions=[
 {id:'Helvetica',label:'Helvetica',family:'Arial, Helvetica, sans-serif',weight:400,style:'normal'},
 {id:'Helvetica-Bold',label:'Helvetica Bold',family:'Arial, Helvetica, sans-serif',weight:700,style:'normal'},
 {id:'Helvetica-Oblique',label:'Helvetica Italic',family:'Arial, Helvetica, sans-serif',weight:400,style:'italic'},
 {id:'Helvetica-BoldOblique',label:'Helvetica Bold Italic',family:'Arial, Helvetica, sans-serif',weight:700,style:'italic'},
 {id:'Times-Roman',label:'Times Roman',family:'"Times New Roman", Times, serif',weight:400,style:'normal'},
 {id:'Times-Bold',label:'Times Bold',family:'"Times New Roman", Times, serif',weight:700,style:'normal'},
 {id:'Times-Italic',label:'Times Italic',family:'"Times New Roman", Times, serif',weight:400,style:'italic'},
 {id:'Times-BoldItalic',label:'Times Bold Italic',family:'"Times New Roman", Times, serif',weight:700,style:'italic'},
 {id:'Courier',label:'Courier',family:'"Courier New", Courier, monospace',weight:400,style:'normal'},
 {id:'Courier-Bold',label:'Courier Bold',family:'"Courier New", Courier, monospace',weight:700,style:'normal'},
 {id:'Courier-Oblique',label:'Courier Italic',family:'"Courier New", Courier, monospace',weight:400,style:'italic'},
 {id:'Courier-BoldOblique',label:'Courier Bold Italic',family:'"Courier New", Courier, monospace',weight:700,style:'italic'},
] as const;
export type FontName=typeof fontOptions[number]['id'];
export const isFontName=(v:unknown):v is FontName=>fontOptions.some(f=>f.id===v);
export function fontName(value?:string):FontName{
 const aliases:Record<string,FontName>={Helv:'Helvetica',HeBo:'Helvetica-Bold',HeOb:'Helvetica-Oblique',HeBO:'Helvetica-BoldOblique',TiRo:'Times-Roman',TiBo:'Times-Bold',TiIt:'Times-Italic',TiBI:'Times-BoldItalic',Cour:'Courier',CoBo:'Courier-Bold',CoOb:'Courier-Oblique',CoBO:'Courier-BoldOblique'};
 return isFontName(value)?value:aliases[value||'']||'Helvetica';
}
export function fontCSS(value?:string){const font=fontOptions.find(f=>f.id===fontName(value))!;return {fontFamily:font.family,fontWeight:font.weight,fontStyle:font.style};}
