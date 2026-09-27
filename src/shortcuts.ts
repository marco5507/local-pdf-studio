import type {Tool} from './types';
export const toolKeys:Partial<Record<Tool,string>>={select:'V',Highlight:'H',Ink:'P',eraser:'E',laser:'L'};
export function shortcutTool(key:string,flags:{typing?:boolean;modal?:boolean;readOnly?:boolean;busy?:boolean;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean;shiftKey?:boolean;repeat?:boolean;isComposing?:boolean}):Tool|undefined{
 if(flags.typing||flags.modal||flags.busy||flags.ctrlKey||flags.metaKey||flags.altKey||flags.shiftKey||flags.repeat||flags.isComposing)return;
 const tool=(Object.keys(toolKeys) as Tool[]).find(t=>toolKeys[t]===key.toUpperCase());
 if(flags.readOnly&&tool!=='select'&&tool!=='laser')return;
 return tool;
}
