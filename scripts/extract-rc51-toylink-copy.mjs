// rc.51：把方案 §5.2 的定稿文案块逐字合并进 wheel-ui-copy.js 的 workshop.toylink。
// 源：RC51总方案/02_方案_4A-跳蛋玩法.md（4A 定稿，conversation_id b9628c98-…）
// 规则（项目 AGENTS §7.2）：只做「文本切片 + 原样合并」，不写、不改、不润色任何文案；
// 方案块里出现的键覆盖同名旧键，其余旧键（title/backBtn/pill*/btnStart…）保留。
import fs from 'node:fs/promises';
import {WHEEL_COPY} from '../src/core/wheel-ui-copy.js';

const MD = 'E:/SHZDCHOSSS/RC51总方案/02_方案_4A-跳蛋玩法.md';
const OUT = 'E:/SHZDCHOSSS/src/core/wheel-ui-copy.js';
const CMP = 'E:/SHZDCHOSSS/.work/rc51-copy-compare.txt';

const md = await fs.readFile(MD, 'utf8');
const sec = md.slice(md.indexOf('### 5.2'), md.indexOf('### 5.3'));
const f0 = sec.indexOf('```json');
const f1 = sec.indexOf('```', f0 + 7);
if (f0 < 0 || f1 < 0) throw new Error('§5.2 未找到 json 代码块');
const jsonText = sec.slice(f0 + 7, f1).trim();
const planCopy = JSON.parse(jsonText);

const src = await fs.readFile(OUT, 'utf8');
const wsIdx = src.indexOf('  "workshop": {');
if (wsIdx < 0) throw new Error('未找到 workshop 节点');
const keyIdx = src.indexOf('    "toylink": {', wsIdx);
if (keyIdx < 0) throw new Error('未找到 workshop.toylink 节点');
const braceStart = src.indexOf('{', keyIdx);
let depth = 0;
let braceEnd = -1;
for (let i = braceStart; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
}
if (braceEnd < 0) throw new Error('toylink 花括号未配平');

const merged = {...WHEEL_COPY.workshop.toylink, ...planCopy};
const serialized = JSON.stringify(merged, null, 2).split('\n').join('\n    ');
const nextBlock = '    "toylink": ' + serialized;
const next = src.slice(0, keyIdx) + nextBlock + src.slice(braceEnd + 1);
await fs.writeFile(OUT, next, 'utf8');

// 字面比对证据：方案块里每个键在成品里的值必须与方案逐字相等
const lines = [];
let same = 0;
let diff = 0;
for (const [k, v] of Object.entries(planCopy)) {
  const got = merged[k];
  const ok = JSON.stringify(got) === JSON.stringify(v);
  if (ok) same++; else diff++;
  lines.push((ok ? 'MATCH\t' : 'DIFF\t') + k + '\t' + JSON.stringify(v).slice(0, 120));
}
const report = [
  'RC51 §5.2 文案键字面比对（方案 vs wheel-ui-copy.js workshop.toylink）',
  '方案：' + MD,
  '成品：' + OUT,
  '键数：' + Object.keys(planCopy).length + '｜MATCH ' + same + '｜DIFF ' + diff,
  '',
  ...lines
].join('\n');
await fs.writeFile(CMP, report + '\n', 'utf8');

console.log(JSON.stringify({planKeys: Object.keys(planCopy).length, same, diff, outBytes: next.length, cmp: CMP}));
