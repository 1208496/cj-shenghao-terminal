// rc.51：把方案 §5.1 的 CSS 块逐值搬进 src/ui/style.css。
// 源：RC51总方案/02_方案_4A-跳蛋玩法.md 的 ```css 代码块（方案第 232–341 行）。
// 唯一改动（AGENTS §5.1(c) 接线必需）：给每条选择器加本项目的作用域前缀
//   `.workshop-page.is-toylink `——本项目全部 TOY 样式都在该作用域下，不加前缀会污染全卡。
// 所有数值（颜色 / 字号 / 间距 / 圆角 / 边框 / 渐变 / 尺寸）一字不改。
import fs from 'node:fs/promises';

const MD = 'E:/SHZDCHOSSS/RC51总方案/02_方案_4A-跳蛋玩法.md';
const OUT = 'E:/SHZDCHOSSS/src/ui/style.css';
const MARK = '/* rc.51：TOY·LINK 战术机制';
const SCOPE = '.workshop-page.is-toylink ';

const md = await fs.readFile(MD, 'utf8');
const sec = md.slice(md.indexOf('### 5.1'), md.indexOf('### 5.2'));
const f0 = sec.indexOf('```css');
const f1 = sec.indexOf('```', f0 + 6);
if (f0 < 0 || f1 < 0) throw new Error('§5.1 未找到 css 代码块');
const raw = sec.slice(f0 + 6, f1).replace(/^\n+|\n+$/g, '');

const out = [];
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.endsWith('{') && !trimmed.startsWith('@')) {
    const sel = trimmed.slice(0, -1).trim();
    const scoped = sel.split(',').map((s) => SCOPE + s.trim()).join(', ');
    out.push(scoped + ' {');
  } else {
    out.push(line);
  }
}

const css = await fs.readFile(OUT, 'utf8');
if (css.includes(MARK)) throw new Error('style.css 已含 rc.51 TOY 战术样式，先还原再跑');
const block = [
  MARK + '（选择器加 `.workshop-page.is-toylink` 作用域前缀，其余全部数值逐值取自 RC51 方案 §5.1） */',
  ...out,
  ''
].join('\n');
const next = css.trimEnd() + '\n\n' + block;
await fs.writeFile(OUT, next, 'utf8');

// 字面比对证据：逐条发出「方案原值 → 成品值」对照（去掉作用域前缀后必须逐字相等）
const cmp = [];
const ruleRe = /([^{}\n]+)\{([^{}]*)\}/g;
let m;
while ((m = ruleRe.exec(raw)) !== null) {
  const sel = m[1].trim();
  const body = m[2].trim();
  const got = (next.match(new RegExp(SCOPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')) || [])[1];
  const ok = got !== undefined && got.trim() === body;
  cmp.push((ok ? 'MATCH\t' : 'DIFF\t') + sel + '\t' + body.replace(/\s+/g, ' ').slice(0, 90));
}
const same = cmp.filter((l) => l.startsWith('MATCH')).length;
await fs.writeFile('E:/SHZDCHOSSS/.work/rc51-css-compare.txt', [
  'RC51 §5.1 CSS 规则字面比对（方案值 vs style.css 成品值）',
  '规则数：' + cmp.length + '｜MATCH ' + same + '｜DIFF ' + (cmp.length - same),
  '',
  ...cmp
].join('\n') + '\n', 'utf8');

console.log(JSON.stringify({rules: cmp.length, same, diff: cmp.length - same, outBytes: next.length}));
