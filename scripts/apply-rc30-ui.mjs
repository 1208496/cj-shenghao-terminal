// 应用 rc.30 的 UI 改动（setup-options / app / screens / style）
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

// 4.10.1 setup-options.js
let so = read('src/ui/setup-options.js');
const newContact = fence('#### 4.10.1 ', '#### 4.10.2 ').trim();
const soStart = so.indexOf('export function contactPresetValues(');
if (soStart < 0) throw Error('contactPresetValues missing');
const soEnd = so.indexOf('\n', soStart);
so = so.slice(0, soStart) + newContact + so.slice(soEnd);
write('src/ui/setup-options.js', so);
console.log('APPLIED setup-options');

// 4.10.2 app.js
let app = read('src/ui/app.js');
app = replaceOnce(app,
  "${field('眼下心事 / 她的现实困境（选填）','c_goal','',{area:true})}",
  "${field('近期目标（选填）','c_recentGoal','',{area:true})}${field('长期梦想（选填）','c_longTermDream','',{area:true})}",
  'app.js contactForm goal fields');
app = replaceOnce(app,
  "notes:val('c_notes'),currentGoal:val('c_goal').trim(),present:$('c_present').checked",
  "notes:val('c_notes'),recentGoal:val('c_recentGoal').trim(),longTermDream:val('c_longTermDream').trim(),hiddenScar:(editingContactId?draft.contacts.find(x=>x.id===editingContactId)?.hiddenScar:contactPresets.find(p=>p.presetId===$('contactPreset')?.value)?.hiddenScar)||'',present:$('c_present').checked",
  'app.js save-contact');
write('src/ui/app.js', app);
console.log('APPLIED app.js');

// 4.10.3 screens.js
let sc = read('src/ui/screens.js');
const oldGoalBox = sc.match(/const goalBox=[^\n]*\n/);
if (!oldGoalBox) throw Error('goalBox definition missing');
sc = sc.replace(oldGoalBox[0], fence('#### 4.10.3 ', '2. **第 27 行', true) + '\n');

// 两处 +goalBox(c.currentGoal); 按出现顺序分别替换
const callRe = /\s*\+goalBox\(c\.currentGoal\);/g;
const calls = [...sc.matchAll(callRe)];
if (calls.length !== 2) throw Error('goalBox call sites expected 2, got ' + calls.length);
let idx1 = sc.indexOf('+goalBox(c.currentGoal);');
sc = sc.slice(0, idx1) + '+goalsBox(c,true);' + sc.slice(idx1 + '+goalBox(c.currentGoal);'.length);
let idx2 = sc.indexOf('+goalBox(c.currentGoal);');
sc = sc.slice(0, idx2) + '+goalsBox(c,false);' + sc.slice(idx2 + '+goalBox(c.currentGoal);'.length);
if (sc.includes('goalBox(c.currentGoal)')) throw Error('goalBox call left');

// detailBlocks / sceneBlocks 两行
const blocks = fence('#### 4.10.3 ', '5. **第 94 行', true);
const lines = blocks.split('\n').map((l) => l.trim()).filter(Boolean);
if (lines.length !== 2) throw Error('expect 2 block lines, got ' + lines.length);
const dLine = lines.find((l) => l.startsWith('const detailBlocks='));
const sLine = lines.find((l) => l.startsWith('const sceneBlocks='));
for (const [target, replacement] of [['const detailBlocks=', dLine], ['const sceneBlocks=', sLine]]) {
  const a = sc.indexOf(target);
  if (a < 0) throw Error('missing ' + target);
  const b = sc.indexOf('\n', a);
  sc = sc.slice(0, a) + replacement + sc.slice(b);
}
// detail(c) 顶部名片卡
sc = replaceOnce(sc,
  '${thoughtBox(c.currentThought)}${goalBox(c.currentGoal)}',
  '${thoughtBox(c.currentThought)}${goalsBox(c,true)}',
  'app.js detail card goal');
write('src/ui/screens.js', sc);
console.log('APPLIED screens.js');

// 4.10.4 style.css
let css = read('src/ui/style.css');
const dreamRule = md.slice(md.indexOf('#### 4.10.4 '), md.indexOf('\n---', md.indexOf('#### 4.10.4 ')))
  .match(/```css\r?\n([\s\S]*?)\r?\n```/)[1].trim();
if (css.includes('.dream-card{')) throw Error('dream-card already present');
const goalAt = css.indexOf('.goal-card{');
if (goalAt < 0) throw Error('.goal-card missing');
const goalLineEnd = css.indexOf('\n', goalAt);
css = css.slice(0, goalLineEnd + 1) + dreamRule + '\n' + css.slice(goalLineEnd + 1);
write('src/ui/style.css', css);
console.log('APPLIED style.css');

console.log('UI_OK');

