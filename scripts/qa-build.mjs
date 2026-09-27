import fs from 'node:fs';
const html=fs.readFileSync('dist/index.html','utf8').replaceAll('./assets/','/dist/assets/').replace('</body>','<script type="module" src="/tests/browser.qa.ts"></script></body>');fs.writeFileSync('qa-built.html',html);
const driveHTML=fs.readFileSync('dist/index.html','utf8').replaceAll('./assets/','/dist/assets/').replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/,'<script type="module" data-viewer-entry="$1" src="/tests/drive-viewer.qa.ts"></script>');fs.writeFileSync('qa-drive-built.html',driveHTML);

fs.writeFileSync('qa-improvements-built.html',html.replace('/tests/browser.qa.ts','/tests/improvements.qa.ts'));

fs.writeFileSync('qa-study-built.html',html.replace('/tests/browser.qa.ts','/tests/study.qa.ts'));

fs.writeFileSync('qa-textbox-built.html',html.replace('/tests/browser.qa.ts','/tests/textbox.qa.ts'));

fs.writeFileSync('qa-fonts-built.html',html.replace('/tests/browser.qa.ts','/tests/fonts.qa.ts'));

fs.writeFileSync('qa-zoom-built.html',html.replace('/tests/browser.qa.ts','/tests/zoom.qa.ts'));

fs.writeFileSync('qa-file-save-built.html',html.replace('/tests/browser.qa.ts','/tests/file-save.qa.ts'));
