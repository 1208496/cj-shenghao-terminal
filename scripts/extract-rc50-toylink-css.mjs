// rc.50：把原型 `<style>` 里的成品样式抽取进 src/ui/style.css。
// 取 RC50 原型 `rc50-proto-toylink-lite.html`：:root 的 --tl-* 变量、html.theme-purple 的暗色变量、
// 以及 206–844 行全部 `.workshop-page.is-toylink` 规则；剔除仅原型使用的 .proto-* 块。
import fs from 'node:fs/promises';

const SRC = 'E:/SHZDCHOSSS/RC50总方案/04_原型/rc50-proto-toylink-lite.html';
const OUT = 'E:/SHZDCHOSSS/src/ui/style.css';
const MARK = '/* rc.50：TOY·LINK 轻量遥控子页';

const html = await fs.readFile(SRC, 'utf8');
const lines = html.split(/\r?\n/);

const rootStart = lines.findIndex((l) => l.trim() === ':root{');
const darkStart = lines.findIndex((l) => l.trim() === 'html.theme-purple{');
const styleEnd = lines.findIndex((l) => l.trim() === '</style>');
if (rootStart < 0 || darkStart < 0 || styleEnd < 0) throw new Error('原型样式边界未找到');

function varsBetween(from, to) {
  const out = [];
  for (let i = from; i < to; i++) {
    const t = lines[i].trim();
    if (t.startsWith('--tl-')) out.push('  ' + t);
  }
  return out;
}
const lightVars = varsBetween(rootStart, darkStart);
const darkVars = varsBetween(darkStart, styleEnd);

// 成品规则段：从第一条 `.workshop-page.is-toylink{` 到 </style>，剔除 .proto-* 规则块
const ruleStart = lines.findIndex((l) => l.trim().startsWith('.workshop-page.is-toylink{'));
if (ruleStart < 0) throw new Error('成品规则段起点未找到');
const rules = [];
let skipDepth = 0;
for (let i = ruleStart; i < styleEnd; i++) {
  const raw = lines[i];
  const t = raw.trim();
  if (skipDepth > 0) {
    if (t.endsWith('}')) skipDepth--;
    continue;
  }
  if (t.startsWith('.proto-')) {
    if (!t.endsWith('}')) skipDepth = 1;
    continue;
  }
  rules.push(raw);
}

const block = [
  MARK + '（DOM / 类名 / 全部数值逐值取自 RC50 原型，YG 2026-11-23 实测通过） */',
  '.workshop-page.is-toylink{',
  ...lightVars,
  '}',
  '.theme-purple .workshop-page.is-toylink{',
  ...darkVars,
  '}',
  ...rules,
  ''
].join('\n');

const css = await fs.readFile(OUT, 'utf8');
if (css.includes(MARK)) throw new Error('style.css 已含 rc.50 TOY 样式，先还原再跑');
await fs.writeFile(OUT, css.trimEnd() + '\n\n' + block, 'utf8');
console.log(JSON.stringify({lightVars: lightVars.length, darkVars: darkVars.length, ruleLines: rules.length, outBytes: (css.length + block.length)}));
