// 从 AGY_PLAN_rc37_packs.md 的 `## H 文案定稿` 代码块逐字抠取，生成 src/core/wheel-ui-copy.js。
// 铁律三：文案只能来自方案定稿，本脚本不做任何改写、缩写或润色。
import fs from 'node:fs';

const PLAN = 'E:/AGY_ARCHIVE/SHZD_PLANS/AGY_PLAN_rc37_packs.md';
const OUT = 'src/core/wheel-ui-copy.js';

const plan = fs.readFileSync(PLAN, 'utf8');
const at = plan.indexOf('## H 文案定稿');
if (at < 0) throw new Error('方案里找不到 ## H 文案定稿');
const block = plan.slice(at).match(/```text\r?\n([\s\S]*?)```/);
if (!block) throw new Error('H 节缺少 text 代码块');

const tree = {};
let count = 0;
for (const raw of block[1].split(/\r?\n/)) {
  if (!raw.trim()) continue;
  const kv = raw.match(/^([a-zA-Z0-9_.]+) = ([\s\S]*)$/);
  if (!kv) throw new Error('坏行：' + raw);
  const parts = kv[1].split('.');
  let node = tree;
  for (const p of parts.slice(0, -1)) node = node[p] ||= {};
  node[parts.at(-1)] = kv[2];
  count += 1;
}

const body = `// 由 scripts/gen-rc37-copy.mjs 从 AGY_PLAN_rc37_packs.md 的 H 节逐字生成，请勿手改。
// 改文案 = 改那份方案，再重跑 gen-rc37-copy.mjs。
export const WHEEL_COPY = ${JSON.stringify(tree, null, 2)};

// 占位符替换：只替换 {key}，找不到的键原样保留，方便测试抓出漏填。
export function fill(template, vars = {}) {
  return String(template ?? '').replace(/\\{([a-zA-Z0-9_]+)\\}/g, (m, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : m));
}
`;
fs.writeFileSync(OUT, body, 'utf8');
console.log(`COPY_OK ${count} keys -> ${OUT}`);
