// 修复：4.7.5 的替换区间误删了 CORRUPTION_CHANGE 分支，从 rc.29 备份插回
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const backupPath = path.join(root, '.work/engine.rc29.bak.js');
const livePath = path.join(root, 'src/core/engine.js');
const backup = fs.readFileSync(backupPath, 'utf8');
let live = fs.readFileSync(livePath, 'utf8');

const startAnchor = "    case 'CORRUPTION_CHANGE': {";
const endAnchor = "    case 'RELATIONSHIP_CHANGE': {";
const a = backup.indexOf(startAnchor);
const b = backup.indexOf(endAnchor, a);
if (a < 0 || b < 0) throw Error('backup corruption branch missing');
const block = backup.slice(a, b);
console.log('backup block chars', block.length);

if (live.includes(startAnchor)) throw Error('live already has corruption branch');
const insertAt = live.indexOf(endAnchor);
if (insertAt < 0) throw Error('live relationship anchor missing');
live = live.slice(0, insertAt) + block + live.slice(insertAt);
fs.writeFileSync(livePath, live, 'utf8');
console.log('CORRUPTION_RESTORED');

// 顺带检查 projection 之后是否还有内容被吃掉
const tailBackup = backup.slice(backup.indexOf('export function projection(s) {'));
const tailLive = live.slice(live.indexOf('export function projection(s) {'));
console.log('backup tail chars', tailBackup.length, 'live tail chars', tailLive.length);
