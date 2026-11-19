// 应用 rc.30 的 settlement.js 与 host.js 代码块
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const md = fs.readFileSync(path.join(root, 'AGY_PLAN_rc30.md'), 'utf8');

function fence(startMarker, endMarker) {
  const a = md.indexOf(startMarker);
  if (a < 0) throw Error('missing start ' + startMarker);
  const b = md.indexOf(endMarker, a + startMarker.length);
  if (b < 0) throw Error('missing end ' + endMarker);
  const m = md.slice(a, b).match(/```javascript\r?\n([\s\S]*?)\r?\n```/);
  if (!m) throw Error('no js fence in ' + startMarker);
  return m[1];
}

// ---- settlement.js ----
const sp = path.join(root, 'src/runtime/settlement.js');
let s = fs.readFileSync(sp, 'utf8');
fs.writeFileSync(path.join(root, '.work/settlement.rc29.bak.js'), s, 'utf8');
const stBlock = fence('### 4.8 ', '### 4.9 ');
const stStart = s.indexOf('    if(realSex){');
if (stStart < 0) throw Error('settlement anchor missing');
const stEnd = s.indexOf('    syncOutfit(c);', stStart);
if (stEnd < 0) throw Error('settlement end anchor missing');
s = s.slice(0, stStart) + stBlock + '\n' + s.slice(stEnd);
fs.writeFileSync(sp, s, 'utf8');
console.log('APPLIED settlement syncPrivateRecords');

// ---- host.js 建档提示词 ----
const hp = path.join(root, 'src/runtime/host.js');
let h = fs.readFileSync(hp, 'utf8');
fs.writeFileSync(path.join(root, '.work/host.rc29.bak.js'), h, 'utf8');
const newLine = fence('### 4.9 ', '### 4.10 ').trim();
const lineStart = h.indexOf("    {role:'system',content:'仅返回一个JSON对象");
if (lineStart < 0) throw Error('host prompt anchor missing');
const lineEnd = h.indexOf('\n', lineStart);
h = h.slice(0, lineStart) + newLine + h.slice(lineEnd);
fs.writeFileSync(hp, h, 'utf8');
console.log('APPLIED host generateProfile prompt');

// 语法自检
for (const [file, mod] of [['src/runtime/settlement.js', 'settlement'], ['src/runtime/host.js', 'host']]) {
  const url = 'file:///' + path.join(root, file).replace(/\\/g, '/');
  try {
    await import(url);
    console.log('IMPORT_OK', mod);
  } catch (error) {
    console.log('IMPORT_FAIL', mod, error.message);
  }
}
