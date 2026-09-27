import type {FontName} from './fonts';
import type {StudyNote} from './annotations';
export type Rect = [number,number,number,number];
export type Point = [number,number];
export type InkEdit = {id:string;ink:Point[][]};
export type Tool = 'select'|'Highlight'|'Underline'|'StrikeOut'|'Text'|'FreeText'|'Square'|'Circle'|'Line'|'Arrow'|'Ink'|'eraser'|'laser'|'Stamp'|'crop';
export type Mark = {font?:FontName;textOverflow?:boolean;id:string;type:string;rect:Rect;color:number[];opacity:number;contents:string;width:number;fontSize:number;editable:boolean;ink?:Point[][];quads?:number[][];group?:string};
export type Field = {id:number;type:string;label:string;rect:Rect;value:string;options:string[];readOnly:boolean;multiline?:boolean;checked?:boolean};
export type PageInfo = {id:string;bounds:Rect;rotation:number;marks:Mark[];fields:Field[];links:{rect:Rect;uri:string}[]};
export type Outline = {title:string;page:number;children?:Outline[]};
export type SessionInfo = {pages:PageInfo[];outline:Outline[];readOnly:boolean;reason:string;canPrint:boolean;canCopy:boolean;undo:boolean;redo:boolean;revision:number;encrypted:boolean};
export type TextSpan = {text:string;rect:Rect;size:number};
export type RenderResult = {width:number;height:number;pixels:Uint8ClampedArray;spans:TextSpan[]};
export type Style = {font?:FontName;color:number[];opacity:number;width:number;fontSize:number;text:string};
export type Edit =
 | {kind:'add';page:number;type:string;rect:Rect;style:Style;points?:Point[];quads?:number[][];image?:Uint8Array;group?:string}
 | {kind:'update';page:number;id:string;rect?:Rect;style?:Partial<Style>}
 | {kind:'deleteMark';page:number;id:string}
 | {kind:'eraseMarks';page:number;ids:string[]}
 | {kind:'eraseInk';page:number;changes:InkEdit[];removeIds?:string[]}
 | {kind:'field';page:number;id:number;value:string}
 | {kind:'reorder';order:number[]}
 | {kind:'rotate';pages:number[];degrees:number}
 | {kind:'blank';after:number}
 | {kind:'merge';bytes:Uint8Array;password?:string}
 | {kind:'crop';pages:number[];rect:Rect}
 | {kind:'batch';pages:number[];mode:'watermark'|'numbers';style:Style;position:string;image?:Uint8Array;imageSize?:number};
export type Requests = {
 open:{bytes:Uint8Array;password?:string}; info:undefined;
 render:{page:number;scale:number;text?:boolean;hideMarks?:string[];inkEdits?:InkEdit[]};
 study:{page:number}; search:{query:string}; edit:Edit; undo:undefined; redo:undefined;
 export:{flatten?:boolean;pages?:number[]}; split:{groups:number[][];baseName:string}; checkpoint:undefined;
};
export type Responses = {study:StudyNote[];open:SessionInfo;info:SessionInfo;render:RenderResult;search:{page:number;quads:number[][][]}[];edit:SessionInfo;undo:SessionInfo;redo:SessionInfo;export:Uint8Array;split:Uint8Array;checkpoint:Uint8Array};
export type WorkerRequest = {[K in keyof Requests]:{id:number;method:K;args:Requests[K]}}[keyof Requests];
export type Bookmark = {id:string;pageId:string;label:string};
export type Draft = {id:string;name:string;source:ArrayBuffer;current:ArrayBuffer;updated:number;page:number;zoom:number;bytes:number;encrypted:boolean;token?:string;bookmarks?:Bookmark[]};
export type DraftSummary=Omit<Draft,'source'|'current'>&{sourceBytes:number};
export type Preferences = {eraserSize?:number;language:'en'|'zh';theme:'system'|'light'|'dark';autoOpen:boolean;excludedSites:string[];presets:Style[];signatures:{name:string;data:string}[]};
