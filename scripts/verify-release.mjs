#!/usr/bin/env node
// 发版核对：完全按玩家的加载路径走一遍（script-loader.js 的等价实现）。
// 只用卡内 publishable key，不碰 service_role。
//
// 用法：
//   node scripts/verify-release.mjs            # 读 Supabase 指针自动核对
//   node scripts/verify-release.mjs <提交号>    # 核对指定提交
//
// 通过输出 E2E_OK；任一步失败以非 0 退出。
import fs from 'node:fs';
import crypto from 'node:crypto';

const root = process.cwd();
const cfg = JSON.parse(fs.readFileSync('release/loader.config.json', 'utf8'));
const version = JSON.parse(fs.readFileSync('project.json', 'utf8')).version;
const cardPath = 'dist/' + version + '/神豪终端.json';
if (!fs.existsSync(cardPath)) { console.error('找不到正式卡 ' + cardPath + '，先跑 node scripts/build.mjs'); process.exit(1); }
const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
const loader = card.data.extensions.tavern_helper.scripts[3].content;
const CONTRACT = loader.match(/[a-f0-9]{64}/)[0];
const CDN_HOSTS = ['testingcf.jsdelivr.net', 'fastly.jsdelivr.net', 'cdn.jsdelivr.net'];
const isCommit = v => /^[a-f0-9]{40}$/.test(v);
const cdn = (host, file, ref) => 'https://' + host + '/gh/' + cfg.repository + '@' + ref + '/' + file;
const argRef = (process.argv[2] || '').trim();

let ref = argRef;
if (!ref) {
  const res = await fetch(cfg.supabaseUrl + '/rest/v1/' + cfg.table + '?key=in.(' + cfg.refKey + ',' + cfg.offKey + ')&select=key,value', { headers: { apikey: cfg.publishableKey } });
  if (!res.ok) { console.error('读指针失败 HTTP ' + res.status); process.exit(1); }
  const rows = await res.json();
  let off = '';
  for (const row of rows) {
    if (row.key === cfg.refKey) ref = String(row.value || '').trim();
    if (row.key === cfg.offKey) off = String(row.value || '').trim();
  }
  if (off) { console.error('⚠️ 停用开关非空，玩家只会看到公告：' + off); process.exit(1); }
  console.log('① 指针 ref=' + (ref || '(空)'));
}
if (!isCommit(ref)) { console.error('提交号非法：' + JSON.stringify(ref)); process.exit(1); }

let meta = null, usedHost = '';
for (const host of CDN_HOSTS) {
  try {
    const r = await fetch(cdn(host, cfg.metadataFile, ref), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP_' + r.status);
    meta = await r.json();
    usedHost = host;
    break;
  } catch (e) { console.error('   元数据 ' + host + ' 失败：' + e.message); }
}
if (!meta) { console.error('② 所有 CDN 都取不到元数据'); process.exit(1); }
console.log('② 元数据 via ' + usedHost + '  version=' + meta.version + '  sha256=' + String(meta.sha256).slice(0, 12) + '…');

const hashOk = meta.worldbookHash === CONTRACT;
console.log('③ 世界书契约  meta=' + String(meta.worldbookHash).slice(0, 12) + '…  card=' + CONTRACT.slice(0, 12) + '…  → ' + (hashOk ? '一致' : '不一致（玩家会被建议重新导入整卡）'));
if (!hashOk) { console.error('   与该整卡不匹配，停止'); process.exit(1); }

for (const host of CDN_HOSTS) {
  const r = await fetch(cdn(host, cfg.file, ref), { cache: 'no-store' });
  if (!r.ok) { console.error('   本体 ' + host + ' HTTP ' + r.status); process.exit(1); }
  const code = await r.text();
  const mark = code.startsWith('// ' + cfg.mark);
  const sha = crypto.createHash('sha256').update(Buffer.from(code, 'utf8')).digest('hex');
  console.log('④ 本体 via ' + host + '  ' + Buffer.byteLength(code, 'utf8') + ' 字节  mark=' + (mark ? 'OK' : 'BAD') + '  sha256=' + (sha === meta.sha256 ? '匹配' : '不匹配'));
  if (!mark || sha !== meta.sha256) process.exit(1);
}
console.log('E2E_OK 玩家打开整卡会直接加载 ' + meta.version + '@' + ref.slice(0, 9));
