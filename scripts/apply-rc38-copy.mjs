// rc.38 文案落盘：从 AGY_PLAN_rc38_feedback.md 的定稿块里逐字抠出文本写进 src/content/。
// 铁律三：DSH 只搬运、不改字。任何"要不要润色一下"的念头都必须压住。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PLAN = 'E:/AGY_ARCHIVE/SHZD_PLANS/AGY_PLAN_rc38_feedback.md';
const md = fs.readFileSync(PLAN, 'utf8');

function fenceAfter(headingNeedle, lang) {
  const at = md.indexOf(headingNeedle);
  if (at < 0) throw new Error('找不到标题：' + headingNeedle);
  const open = '```' + lang;
  const s = md.indexOf(open, at);
  if (s < 0) throw new Error('标题后没有 ' + open + '：' + headingNeedle);
  const bodyStart = md.indexOf('\n', s + open.length) + 1;
  const end = md.indexOf('```', bodyStart);
  if (end < 0) throw new Error('代码块没闭合：' + headingNeedle);
  return md.slice(bodyStart, end).replace(/\r\n/g, '\n').replace(/\n+$/, '\n');
}

// 1) state-context.txt（定稿块 1，全文替换）
const stateContext = fenceAfter('#### 定稿块 1：', 'text');
fs.writeFileSync(path.join(ROOT, 'src/content/state-context.txt'), stateContext, 'utf8');

// 2) protocol.txt（定稿块 2，全文替换）+ B.7 激进方案的 incomingPing 追加句（定稿块 4 的 text 块）
let protocol = fenceAfter('#### 定稿块 2：', 'text');
const pingLine = fenceAfter('#### 定稿块 4（可选扩展', 'text').trim();
const protoLines = protocol.split('\n');
const targetIdx = protoLines.findIndex((l) => l.startsWith('同步world.date'));
if (targetIdx < 0) throw new Error('protocol 里找不到第 4 行（同步world.date…）');
if (!protoLines[targetIdx].includes(pingLine)) protoLines[targetIdx] += pingLine;
protocol = protoLines.join('\n');
fs.writeFileSync(path.join(ROOT, 'src/content/protocol.txt'), protocol, 'utf8');

// 3) literary.json：定稿块 3（10 个条目）+ 定稿块 4 的 relationships-network（B.7 激进方案）
const book = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/literary.json'), 'utf8'));
const patchEntries = JSON.parse(fenceAfter('#### 定稿块 3：', 'json'));
const network = JSON.parse(fenceAfter('#### 定稿块 4（可选扩展', 'json'));
const byId = new Map(book.entries.map((e) => [e.id, e]));
let updated = 0, added = 0;
for (const patch of [...patchEntries, network]) {
  const cur = byId.get(patch.id);
  if (cur) {
    for (const k of ['title', 'constant', 'keys', 'body']) if (k in patch) cur[k] = patch[k];
    updated++;
  } else {
    book.entries.push(patch);
    byId.set(patch.id, patch);
    added++;
  }
}
fs.writeFileSync(path.join(ROOT, 'src/content/literary.json'), JSON.stringify(book, null, 2) + '\n', 'utf8');

const constantLen = book.entries.filter((e) => e.constant).reduce((n, e) => n + e.body.length, 0);
console.log('APPLY_OK', JSON.stringify({
  stateContext: stateContext.length,
  protocol: protocol.length,
  bookEntries: book.entries.length,
  constantEntries: book.entries.filter((e) => e.constant).map((e) => e.id),
  constantChars: constantLen,
  updated,
  added,
  pingAppended: protoLines[targetIdx].includes(pingLine)
}, null, 2));
