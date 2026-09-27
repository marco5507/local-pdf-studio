import fs from 'node:fs/promises';
await fs.mkdir('dist/licenses',{recursive:true});
await fs.copyFile('node_modules/mupdf/LICENSE','dist/licenses/MuPDF-AGPL-3.0.txt');
await fs.copyFile('node_modules/mupdf/LICENSE','LICENSE');
await fs.copyFile('THIRD-PARTY-NOTICES.md','dist/licenses/THIRD-PARTY-NOTICES.md');
const licenses=[['react','LICENSE'],['react-dom','LICENSE'],['lucide-react','LICENSE']];
for(const [pkg,file] of licenses)await fs.copyFile(`node_modules/${pkg}/${file}`,`dist/licenses/${pkg}.txt`);
console.log('Packaged local runtime and license notices.');
