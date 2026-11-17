#!/usr/bin/env node
// 铁律 3 落地器：从 rc.25 方案 Markdown 里原样抠出亲笔定稿，不经过手抄。
//   node scripts/extract-rc25-content.mjs <方案.md>
// 只做两件事：替换 literary.json 的 score / private-life 条目、整份覆盖 protocol.txt。
// 写完立刻回读，与方案里的代码块做逐字符比对；不一致直接失败。
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const planPath = process.argv[2];
if (!planPath) { console.error('需要方案 Markdown 路径'); process.exit(1); }
const plan = fs.readFileSync(planPath, 'utf8');

// 仅取 ``` 围栏块；语言标记后面的内容保持原始字节。
const blocks = [...plan.matchAll(/```([a-zA-Z]*)\r?\n([\s\S]*?)```/g)].map(m => ({lang: m[1], body: m[2]}));
const jsonBlocks = blocks.filter(b => b.lang === 'json');
const textBlocks = blocks.filter(b => b.lang === 'text');

const scoreBlock = jsonBlocks.find(b => b.body.includes('"id": "score"'));
const privateBlock = jsonBlocks.find(b => b.body.includes('"id": "private-life"'));
const protocolBlock = textBlocks.find(b => b.body.includes('你为《神豪终端》维护原生MVU变量'));
if (!scoreBlock || !privateBlock || !protocolBlock) {
  console.error('方案里没找到 score / private-life / protocol 定稿块');
  process.exit(1);
}

const readJson = body => JSON.parse(body.replace(/,\s*$/, ''));
const scoreEntry = readJson(scoreBlock.body);
const privateEntry = readJson(privateBlock.body);

const file = path.join(root, 'src/content/literary.json');
const literary = JSON.parse(fs.readFileSync(file, 'utf8'));
const replaceEntry = entry => {
  const at = literary.entries.findIndex(e => e.id === entry.id);
  if (at < 0) throw Error('missing entry ' + entry.id);
  literary.entries[at] = entry;
};
replaceEntry(scoreEntry);
replaceEntry(privateEntry);
fs.writeFileSync(file, JSON.stringify(literary, null, 2) + '\n', 'utf8');

const protocol = protocolBlock.body.endsWith('\n') ? protocolBlock.body : protocolBlock.body + '\n';
fs.writeFileSync(path.join(root, 'src/content/protocol.txt'), protocol, 'utf8');

// 回读校验：逐字符比对，任何差异都视为失败。
const written = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const entry of [scoreEntry, privateEntry]) {
  const got = written.entries.find(e => e.id === entry.id);
  if (JSON.stringify(got) !== JSON.stringify(entry)) throw Error('literary 条目不一致：' + entry.id);
}
const proto = fs.readFileSync(path.join(root, 'src/content/protocol.txt'), 'utf8');
if (proto !== protocol) throw Error('protocol.txt 回读不一致');
console.log('EXTRACT_OK score/private-life/protocol 与方案逐字符一致 · protocol 行数=' + proto.split('\n').length);
