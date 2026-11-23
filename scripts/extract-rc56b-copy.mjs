// 从 4N 方案 B 抠取 S1 阶段用到的定稿文案（§5.5 过渡补丁 + §5.6 UI 文案），写进源码。
// 铁律：卡内文案不许手写，只能由本脚本从方案代码块逐字抠取；可重复执行（幂等）。
// 用法：node scripts/extract-rc56b-copy.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const PLAN = path.join(root, 'reports', 'rc56-称呼与多人覆盖方案-4N-20261124.md');
const OUT = path.join(root, 'src', 'ui', 'rc56b-copy.generated.js');
const lines = fs.readFileSync(PLAN, 'utf8').split(/\r?\n/);

function block(head, lang, nth = 1) {
  const start = lines.findIndex((l) => l.startsWith(head));
  if (start < 0) throw Error('section not found: ' + head);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^#{2,3} /.test(lines[i])) { end = i; break; }
  const found = [];
  for (let i = start + 1; i < end; i++) {
    if (lines[i].trim() === '```' + lang) {
      for (let j = i + 1; j < end; j++) if (lines[j].trim() === '```') { found.push({ body: lines.slice(i + 1, j), startLine: i + 2, endLine: j }); i = j; break; }
    }
  }
  const hit = found[nth - 1];
  if (!hit) throw Error(`block ${lang}#${nth} not found in ${head}`);
  return hit;
}

const patch = block('### 5.5', 'text', 1);
const ui = block('### 5.6', 'text', 1);

// §5.6 逐行解析（保留原文，不做改写）
const uiLines = ui.body.map((l) => l.trim());
const pick = (re) => {
  for (const l of uiLines) { const m = l.match(re); if (m) return m[1].trim(); }
  return '';
};
const btnRename = uiLines.find((l) => l === '改称呼') || '';
const titles = uiLines.filter((l) => l.startsWith('标题：')).map((l) => l.slice(3).trim());
const opts = pick(/^选项：(.+)$/).split('/').map((s) => s.trim());
const badge = (key) => pick(new RegExp('^' + key + '：(.+)$'));

const C = {
  BTN_RENAME: btnRename,
  MODAL_TITLE: titles[0] || '',
  MODAL_NOTE: pick(/^说明：(.+)$/),
  MODAL_PLACEHOLDER: pick(/^输入框占位：(.+)$/),
  BTN_CANCEL: pick(/^取消按钮：(.+)$/),
  BTN_SAVE: pick(/^确认按钮：(.+)$/),
  TOAST_DONE_TPL: pick(/^成功提示（Toast）：(.+)$/),
  TOAST_INVALID: pick(/^空值\/超长提示（Toast）：(.+)$/),
  DEBUG_TITLE: titles[1] || '',
  DEBUG_NOTE: pick(/^副标题：(.+)$/),
  DEBUG_OFF: opts[0] || '',
  DEBUG_ON: opts[1] || '',
  BADGE_UPDATED: badge('心声已更'),
  BADGE_SAME: badge('心声同文'),
  BADGE_MISSING: badge('心声漏写'),
  BADGE_DROPPED: badge('心声丢弃'),
  BADGE_ADDRESSING: badge('称呼已更'),
  PATCH: patch.body.join('\n'),
};

const empty = Object.entries(C).filter(([k, v]) => !v);
if (empty.length) throw Error('抠取缺项：' + empty.map(([k]) => k).join(','));

const src = `// 本文件由 scripts/extract-rc56b-copy.mjs 从 4N 方案 B 自动抠取，禁止手改。
// 源：reports/rc56-称呼与多人覆盖方案-4N-20261124.md
//   过渡补丁 §5.5 ← L${patch.startLine}-${patch.endLine}
//   UI 文案 §5.6 ← L${ui.startLine}-${ui.endLine}
export const DYNAMIC_FIELDS_PATCH = ${JSON.stringify(C.PATCH)};

export const RENAME = {
  btn: ${JSON.stringify(C.BTN_RENAME)},
  title: ${JSON.stringify(C.MODAL_TITLE)},
  note: ${JSON.stringify(C.MODAL_NOTE)},
  placeholder: ${JSON.stringify(C.MODAL_PLACEHOLDER)},
  cancel: ${JSON.stringify(C.BTN_CANCEL)},
  save: ${JSON.stringify(C.BTN_SAVE)},
  doneTpl: ${JSON.stringify(C.TOAST_DONE_TPL)},
  invalid: ${JSON.stringify(C.TOAST_INVALID)},
};

export const DEBUG_OVERLAY = {
  title: ${JSON.stringify(C.DEBUG_TITLE)},
  note: ${JSON.stringify(C.DEBUG_NOTE)},
  off: ${JSON.stringify(C.DEBUG_OFF)},
  on: ${JSON.stringify(C.DEBUG_ON)},
};

export const THOUGHT_BADGE = {
  UPDATED: ${JSON.stringify(C.BADGE_UPDATED)},
  SAME_VALUE: ${JSON.stringify(C.BADGE_SAME)},
  MISSING: ${JSON.stringify(C.BADGE_MISSING)},
  DROPPED: ${JSON.stringify(C.BADGE_DROPPED)},
};
export const ADDRESSING_BADGE = ${JSON.stringify(C.BADGE_ADDRESSING)};
`;

fs.writeFileSync(OUT, src, 'utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const report = {
  plan: path.relative(root, PLAN).replaceAll('\\', '/'),
  out: 'src/ui/rc56b-copy.generated.js',
  patch: { lines: `L${patch.startLine}-${patch.endLine}`, sha: sha(C.PATCH), chars: C.PATCH.length },
  ui: { lines: `L${ui.startLine}-${ui.endLine}`, fields: Object.keys(C).filter((k) => k !== 'PATCH').length, sample: { title: C.MODAL_TITLE, save: C.BTN_SAVE, badge: C.BADGE_MISSING } },
};
fs.writeFileSync(path.join(root, '.work', 'rc56b-copy-compare.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
