// rc.36：从方案 F 节 text 代码块逐字抠出定稿文案，生成 src/core/wheel-ui-copy.js。
// 铁律：本脚本不做任何trim之外的加工；文案一个字都不许在这里改。
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const plan = await fs.readFile(path.join(root, 'E:/AGY_ARCHIVE/SHZD_PLANS/AGY_PLAN_rc36_wheels.md'), 'utf8');
const marker = '## F 文案定稿';
const at = plan.indexOf(marker);
if (at < 0) throw new Error('POLICY_FINAL_SECTION_MISSING');
const block = plan.slice(at).match(/```text\r?\n([\s\S]*?)```/);
if (!block) throw new Error('POLICY_FINAL_BLOCK_MISSING');

const tree = {};
let section = null;
for (const raw of block[1].split(/\r?\n/)) {
  if (!raw.trim()) continue;
  const head = raw.match(/^\[([a-zA-Z0-9_.]+)\]$/);
  if (head) {
    section = head[1];
    const parts = section.split('.');
    let node = tree;
    for (const part of parts) {
      if (!node[part]) node[part] = {};
      node = node[part];
    }
    continue;
  }
  if (!section) throw new Error('LINE_OUTSIDE_SECTION: ' + raw);
  const kv = raw.match(/^([a-zA-Z0-9_]+) = ([\s\S]*)$/);
  if (!kv) throw new Error('BAD_LINE: ' + raw);
  let node = tree;
  for (const part of section.split('.')) node = node[part];
  if (Object.hasOwn(node, kv[1])) throw new Error('DUPLICATE_KEY: ' + section + '.' + kv[1]);
  node[kv[1]] = kv[2];
}

const body = `// 由 scripts/gen-rc36-copy.mjs 从 AGY_PLAN_rc36_wheels.md 的 F 节逐字生成，请勿手改。
// 改文案 = 改那份方案，再重跑 gen-rc36-copy.mjs。
export const WHEEL_COPY = ${JSON.stringify(tree, null, 2)};

// 占位符替换：只替换 {key}，找不到的键原样保留，方便测试抓出漏填。
export function fill(template, vars = {}) {
  return String(template ?? '').replace(/\\{([a-zA-Z0-9_]+)\\}/g, (m, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : m));
}
`;
await fs.writeFile(path.join(root, 'src/core/wheel-ui-copy.js'), body);
const count = JSON.stringify(tree).length;
console.log('COPY_OK sections=' + Object.keys(tree).join(',') + ' bytes=' + count);
