import {test} from 'node:test';
import assert from 'node:assert/strict';
import {driveDownloadURLs,fetchDrivePDF} from '../src/drive.ts';
import {makeRules} from '../public/rules.js';
import {zipPDFs} from '../src/archive.ts';
import fs from 'node:fs';
test('Drive URLs preserve file, resource key, and signed-in account without requesting uploads',()=>{
 const urls=driveDownloadURLs('https://drive.google.com/file/d/abc_123-X/view?authuser=2&resourcekey=key');
 assert.equal(urls.length,2);for(const url of urls){const u=new URL(url);assert.equal(u.searchParams.get('id'),'abc_123-X');assert.equal(u.searchParams.get('authuser'),'2');assert.equal(u.searchParams.get('resourcekey'),'key');assert.equal(u.searchParams.get('export'),'download');}
 assert.throws(()=>driveDownloadURLs('https://evil.test/file/d/abc/view'));
});
test('split archive stores Unicode PDF names and guards paths',()=>{const zip=zipPDFs([{name:'中文 - part 1.pdf',bytes:new TextEncoder().encode('%PDF-1.7\nhello')},{name:'../test.pdf',bytes:new TextEncoder().encode('%PDF-1.7\nworld')}]);assert.equal(new DataView(zip.buffer).getUint32(0,true),0x04034b50);assert.equal(new DataView(zip.buffer).getUint16(zip.length-12,true),2);fs.mkdirSync('test-artifacts',{recursive:true});fs.writeFileSync('test-artifacts/split-test.zip',zip);});
test('Drive handoff accepts only actual PDF bytes and retains fallback when downloads are blocked',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return calls===1?new Response('<html>Sign in</html>'):new Response('%PDF-1.7\nfixture');};const bytes=await fetchDrivePDF('https://drive.google.com/file/d/abc/view');assert.match(new TextDecoder().decode(bytes),/^%PDF-/);assert.equal(calls,2);
 globalThis.fetch=async()=>new Response('Download disabled',{status:403});await assert.rejects(()=>fetchDrivePDF('https://drive.google.com/file/d/abc/view'),/downloadable PDF/);
 }finally{globalThis.fetch=original;}
});
test('PDF redirect rules exclude POST, explicit downloads, embedded frames and excluded domains',()=>{
 const rules=makeRules('chrome-extension://sample/index.html',['example.com'],true);assert.equal(rules.length,4);
 assert.equal(rules[0].action.type,'allow');assert.equal(rules[0].condition.responseHeaders[0].header,'content-disposition');
 for(const r of rules.filter(r=>r.id===2||r.id===3)){assert.deepEqual(r.condition.resourceTypes,['main_frame']);assert.deepEqual(r.condition.excludedRequestMethods,['post']);assert.deepEqual(r.condition.excludedRequestDomains,['example.com']);assert.equal(r.action.redirect.regexSubstitution,'chrome-extension://sample/index.html?source=\\0');}
 const regex=new RegExp(rules[2].condition.regexFilter);assert(regex.test('https://host.test/test.PDF?key=abc'));assert(!regex.test('https://host.test/notpdf.html'));
});
