import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import type {Translate} from './i18n';
export function Button({icon:Icon,label,onClick,active,disabled,compact=false,className='',...rest}:{icon?:any;label:string;onClick?:()=>void;active?:boolean;disabled?:boolean;compact?:boolean;className?:string;[k:string]:any}){return <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className={`${compact?'icon-button':'tool-button'} ${active?'active':''} ${className}`} {...rest}>{Icon&&<Icon size={compact?18:20} strokeWidth={1.7}/>} {!compact&&<span>{label}</span>}</button>;}
export function Modal({title,onClose,children,t,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;t:Translate;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const d=ref.current!;d.showModal();return()=>d.close();},[]);
 return <dialog ref={ref} className={wide?'wide':''} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="dialog-head"><h2>{title}</h2><Button icon={X} label={t('Close')} onClick={onClose} compact/></div>{children}</dialog>;
}
export function download(bytes:Uint8Array,name:string,mime='application/pdf'){const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export const fileBytes=(file:File)=>file.arrayBuffer().then(b=>new Uint8Array(b));
