// rc.52：把方案 §5 定稿文案 + §3.2 的 8 条处境 + 原型的九模标签/图标，逐字合并进 wheel-ui-copy.js 的 workshop.toylink。
// 原则（项目 AGENTS §7.2）：只做文本切片与合并，不写、不改、不润色；每一条都做字面自检。
import fs from 'node:fs/promises';
import {WHEEL_COPY} from '../src/core/wheel-ui-copy.js';

const PLAN = 'E:/SHZDCHOSSS/RC52总方案/02_方案_4N-TOY宽屏与佩戴链路.md';
const PROTO = 'E:/SHZDCHOSSS/RC52总方案/03_原型/toy-wide-proto.html';
const TPL = 'E:/SHZDCHOSSS/src/ui/toylink.template.html';
const OUT = 'E:/SHZDCHOSSS/src/core/wheel-ui-copy.js';
const CMP = 'E:/SHZDCHOSSS/.work/rc52-copy-compare.txt';

const plan = await fs.readFile(PLAN, 'utf8');
const proto = await fs.readFile(PROTO, 'utf8');
const tpl = await fs.readFile(TPL, 'utf8');

function jsonBlocks(fromMark, toMark) {
  const sec = plan.slice(plan.indexOf(fromMark), toMark ? plan.indexOf(toMark) : plan.length);
  const out = {};
  for (const m of sec.matchAll(/```json\s*\r?\n([\s\S]*?)```/g)) Object.assign(out, JSON.parse(m[1]));
  return out;
}

// §5.1 佩戴弹窗 / §5.2 佩戴引导词 / §5.3 佩戴注入块 / §5.4 运行态分离 / §5.5 补充键
const wearDialog = jsonBlocks('### 5.1', '### 5.2');
const wearInput = jsonBlocks('### 5.2', '### 5.3');
const wearPrompt = jsonBlocks('### 5.3', '### 5.4');
const runtimeCopy = jsonBlocks('### 5.4', '### 5.5');
const extraCopy = jsonBlocks('### 5.5', '## 六、');

// §3.2 处境表（markdown）：| `id` | `label` | tier | expRate | 理由 | desc | directive |
const scenesSec = plan.slice(plan.indexOf('### 3.2'), plan.indexOf('## 四', plan.indexOf('### 3.2')));
const scenes = {};
for (const line of scenesSec.split(/\r?\n/)) {
  const cells = line.split('|').map((s) => s.trim());
  if (cells.length < 8) continue;
  const idM = /^`([a-z_]+)`$/.exec(cells[1]);
  if (!idM) continue;
  const labelM = /^`([^`]+)`$/.exec(cells[2]);
  const tierM = /`(low|mid|high)`/.exec(cells[3]);
  const rate = Number(cells[4].replace(/`/g, ''));
  if (!labelM || !tierM || !Number.isFinite(rate)) continue;
  scenes[idM[1]] = {label: labelM[1], here: 'away', tier: tierM[1], expRate: rate, desc: cells[6], directive: cells[7]};
}

// 原型里的九模 id / name / tag / icon（逐字）
const modeLines = proto.slice(proto.indexOf('const TOY_MODES = ['), proto.indexOf('// 原型演示人物'));
const modes = [];
for (const line of modeLines.split(/\r?\n/)) {
  const m = /\{ id: '([a-z]+)', name: '([^']+)', tag: '([^']+)',[\s\S]*?icon: '([^']+)'/.exec(line);
  if (m) modes.push({id: m[1], name: m[2], tag: m[3], icon: m[4]});
}

// 模板/原型里的静态标签（逐字取自模板，缺字面就报错）
const statics = {
  wornCount: '已佩戴 {n} 人',
  modeHd: '{modeName} · 连续叠加',
  wearNums: '♥ 好感 {affection} · ❖ 堕落 {corruption}',
  modalStep1: '步骤 1 / 2 · 佩戴确认',
  modalStep2: '步骤 2 / 2 · 选择佩戴落点',
  sceneBlockLabel: '别处处境（选定后切她的独立视角）',
  tierLow: '私密',
  tierMid: '半公开',
  tierHigh: '高危公开',
  traceLabel: '手法轨迹'
};
const probeOverride = {
  // 原型里是 JS 模板字符串渲染出来的，按源码字面核对
  wearNums: '♥ 好感 ${c.affection} · ❖ 堕落 ${c.corruption}'
};
for (const [k, v] of Object.entries(statics)) {
  const probe = probeOverride[k] || v.replace('{n}', '0').replace('{modeName}', '潮汐').replace('{affection}', '86').replace('{corruption}', '64');
  if (!tpl.includes(probe) && !proto.includes(probe)) throw new Error('静态标签未在原型/模板中找到：' + k + ' = ' + v);
}
if (!proto.includes('步骤 2 / 2 · 选择佩戴落点')) throw new Error('原型缺少第二步步骤文案');
if (modes.length !== 9) throw new Error('九模标签解析数量不对：' + modes.length);
if (Object.keys(scenes).length !== 8) throw new Error('处境解析数量不对：' + Object.keys(scenes).length);

// 合并
const before = WHEEL_COPY.workshop.toylink;
const merged = {...before};
for (const k of ['scenes', 'promptBlock', 'inputLineWith', 'inputLineAway', 'backBtn', 'wearOkToast']) delete merged[k];
Object.assign(merged, wearDialog, wearInput, wearPrompt, runtimeCopy, extraCopy, statics, {modes, scenes});

const src = await fs.readFile(OUT, 'utf8');
const wsIdx = src.indexOf('  "workshop": {');
const keyIdx = src.indexOf('    "toylink": {', wsIdx);
if (wsIdx < 0 || keyIdx < 0) throw new Error('未找到 workshop.toylink');
const braceStart = src.indexOf('{', keyIdx);
let depth = 0;
let braceEnd = -1;
for (let i = braceStart; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
}
if (braceEnd < 0) throw new Error('toylink 花括号未配平');
const block = '    "toylink": ' + JSON.stringify(merged, null, 2).split('\n').join('\n    ');
let next = src.slice(0, keyIdx) + block + src.slice(braceEnd + 1);
// errors 补 TOYLINK_NOT_WORN
if (!next.includes('"TOYLINK_NOT_WORN"')) {
  next = next.replace('"TOYLINK_MISSING":', '"TOYLINK_NOT_WORN": "请先为该人物佩戴 TOY·LINK 装置后再启动遥控。",\n    "TOYLINK_MISSING":');
}
await fs.writeFile(OUT, next, 'utf8');

// 字面自检
const checks = [];
let ok = 0;
let bad = 0;
const push = (k, want, got) => {
  const same = JSON.stringify(want) === JSON.stringify(got);
  same ? ok++ : bad++;
  checks.push((same ? 'MATCH\t' : 'DIFF\t') + k + '\t' + JSON.stringify(want).slice(0, 100));
};
for (const [k, v] of Object.entries({...wearDialog, ...wearInput, ...wearPrompt, ...runtimeCopy, ...extraCopy, ...statics})) push(k, v, merged[k]);
push('scenes', scenes, merged.scenes);
push('modes', modes, merged.modes);
await fs.writeFile(CMP, [
  'RC52 文案字面比对（方案 §5 / §3.2 / 原型九模 vs wheel-ui-copy.js）',
  '键数：' + (ok + bad) + '｜MATCH ' + ok + '｜DIFF ' + bad,
  '',
  ...checks
].join('\n') + '\n', 'utf8');

console.log(JSON.stringify({keys: ok + bad, ok, bad, scenes: Object.keys(scenes).length, modes: modes.length, outBytes: next.length}));
