import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shortcutTool} from '../src/shortcuts.ts';
test('tool shortcuts respect typing, composition, dialogs, modifiers and document permissions',()=>{
 for(const [key,tool] of Object.entries({v:'select',h:'Highlight',p:'Ink',e:'eraser',l:'laser'}))assert.equal(shortcutTool(key,{}),tool);
 for(const flag of ['typing','modal','busy','ctrlKey','metaKey','altKey','shiftKey','repeat','isComposing'])assert.equal(shortcutTool('h',{[flag]:true}),undefined);
 assert.equal(shortcutTool('H',{readOnly:true}),undefined);assert.equal(shortcutTool('l',{readOnly:true}),'laser');assert.equal(shortcutTool('v',{readOnly:true}),'select');assert.equal(shortcutTool('x',{}),undefined);
});
