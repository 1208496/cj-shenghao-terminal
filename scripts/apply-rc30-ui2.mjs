// 只处理 4.10.3 screens.js 与 4.10.4 style.css（app.js/setup-options 已在前一轮写入）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const md = fs.readFileSync(path.join(root, 'AGY_PLAN_rc30.md'), 'utf8');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, v) => fs.writeFileSync(path.join(root, p), v, 'utf8');
const fence = (a, b, dedent = false) => {
  const i = md.indexOf(a), j = md.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw Error('fence markers missing ' + a);
  const m = md.slice(i, j).match(/[ \t]*```javascript\r?\n([\s\S]*?)\r?\n[ \t]*```/);
  if (!m) throw Error('no js fence ' + a);
  let code = m[1];
  if (dedent) code = code.split('\n').map((l) => l.replace(/^ {1,6}/, '')).join('\n');
  return code;
};
const replaceOnce = (src, from, to, label) => {
  const n = src.split(from).length - 1;
  if (n !== 1) throw Error('expect 1 match, got ' + n + ': ' + label);
  return src.replace(from, to);
};

let sc = read('src/ui/screens.js');
console.log('goalBox present:', /const goalBox=/.test(sc), 'goalsBox present:', /const goalsBox=/.test(sc));

if (/const goalBox=/.test(sc)) {
  const line = sc.match(/const goalBox=[^\n]*\n/)[0];
  sc = sc.replace(line, fence('#### 4.10.3 ', '2. **第 27 行', true) + '\n');
  console.log('replaced goalBox definition');
}
if (!/const goalsBox=/.test(sc)) throw Error('goalsBox missing after patch');

// 两处调用（顺序：basicRows → true，statusPanel → false）
const callText = '+goalBox(c.currentGoal);';
let i1 = sc.indexOf(callText);
if (i1 >= 0) { sc = sc.slice(0, i1) + '+goalsBox(c,true);' + sc.slice(i1 + callText.length); console.log('call 1 -> goalsBox(c,true)'); }
let i2 = sc.indexOf(callText);
if (i2 >= 0) { sc = sc.slice(0, i2) + '+goalsBox(c,false);' + sc.slice(i2 + callText.length); console.log('call 2 -> goalsBox(c,false)'); }
if (sc.includes('+goalBox(c.currentGoal)')) throw Error('goalBox call left in screens.js');
sc = sc.replace(/\n\s*\+goalsBox\(c,true\);/g, '\n      +goalsBox(c,true);').replace(/\n\s*\+goalsBox\(c,false\);/g, '\n      +goalsBox(c,false);');

// detailBlocks / sceneBlocks 两行
const blocks = fence('#### 4.10.3 ', '5. **第 94 行', true).split('\n').map((l) => l.trim()).filter(Boolean);
const dLine = blocks.find((l) => l.startsWith('const detailBlocks='));
const sLine = blocks.find((l) => l.startsWith('const sceneBlocks='));
for (const [target, replacement] of [['const detailBlocks=', dLine], ['const sceneBlocks=', sLine]]) {
  const a = sc.indexOf(target);
  if (a < 0) throw Error('missing ' + target);
  const b = sc.indexOf('\n', a);
  sc = sc.slice(0, a) + replacement + sc.slice(b);
}
console.log('replaced detailBlocks/sceneBlocks');

// detail(c) 顶部名片卡
if (sc.includes('${thoughtBox(c.currentThought)}${goalBox(c.currentGoal)}')) {
  sc = replaceOnce(sc, '${thoughtBox(c.currentThought)}${goalBox(c.currentGoal)}', '${thoughtBox(c.currentThought)}${goalsBox(c,true)}', 'detail card goal');
  console.log('replaced detail card goal');
}
write('src/ui/screens.js', sc);
console.log('SCREENS_OK');

// style.css
let css = read('src/ui/style.css');
if (!css.includes('.dream-card{')) {
  const block = md.slice(md.indexOf('#### 4.10.4 '));
  const rule = block.match(/```css\r?\n([\s\S]*?)\r?\n```/)[1].trim();
  const at = css.indexOf('.goal-card{');
  if (at < 0) throw Error('.goal-card missing');
  const end = css.indexOf('\n', at);
  css = css.slice(0, end + 1) + rule + '\n' + css.slice(end + 1);
  write('src/ui/style.css', css);
  console.log('STYLE_OK');
} else console.log('STYLE_ALREADY');
console.log('UI2_OK');

