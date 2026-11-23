// rc.51：CSS 字面比对证据（方案 §5.1 值 vs style.css 成品值）。
// 选择器允许带项目作用域前缀 `.workshop-page.is-toylink `，声明体必须逐字相等。
import fs from 'node:fs/promises';

const MD = 'E:/SHZDCHOSSS/RC51总方案/02_方案_4A-跳蛋玩法.md';
const CSS = 'E:/SHZDCHOSSS/src/ui/style.css';
const OUT = 'E:/SHZDCHOSSS/.work/rc51-css-compare.txt';
const SCOPE = '.workshop-page.is-toylink ';

const md = await fs.readFile(MD, 'utf8');
const sec = md.slice(md.indexOf('### 5.1'), md.indexOf('### 5.2'));
const f0 = sec.indexOf('```css');
const f1 = sec.indexOf('```', f0 + 6);
const raw = sec.slice(f0 + 6, f1).replace(/^\n+|\n+$/g, '');
const css = await fs.readFile(CSS, 'utf8');

const rules = [];
const re = /([^{}\n]+)\{([^{}]*)\}/g;
let m;
while ((m = re.exec(raw)) !== null) {
  rules.push({sel: m[1].trim(), body: m[2].trim().replace(/\s+/g, ' ')});
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const lines = [];
let same = 0;
let diff = 0;
for (const r of rules) {
  const scoped = r.sel.split(',').map((s) => SCOPE + s.trim()).join(', ');
  const hit = css.includes(scoped + ' {') ? css.slice(css.indexOf(scoped + ' {')) : '';
  const body = hit ? hit.slice(0, hit.indexOf('}') + 1).slice(hit.indexOf('{') + 1, -1) : '';
  const ok = body.length > 0 && norm(body) === r.body;
  if (ok) same++; else diff++;
  lines.push((ok ? 'MATCH\t' : 'DIFF\t') + r.sel + '\n\t方案: ' + r.body + '\n\t成品: ' + (body ? norm(body) : '未找到'));
}

await fs.writeFile(OUT, [
  'RC51 §5.1 CSS 规则字面比对（方案值 vs style.css 成品值；选择器加项目作用域前缀，其余逐字）',
  '规则数：' + rules.length + '｜MATCH ' + same + '｜DIFF ' + diff,
  '',
  ...lines
].join('\n') + '\n', 'utf8');
console.log(JSON.stringify({rules: rules.length, same, diff, out: OUT}));
