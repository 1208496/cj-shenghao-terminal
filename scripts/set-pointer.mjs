#!/usr/bin/env node
// 更新 Supabase 版本指针（refKey）。写操作需要 service_role 密钥，
// 卡里那把 publishable key 只有 SELECT 权限（实测 401 / 42501）。
//
// 用法：
//   node scripts/set-pointer.mjs                  # 只读：打印当前指针
//   node scripts/set-pointer.mjs <40位提交号>      # 写入并回读校验
//   node scripts/set-pointer.mjs --sql <提交号>    # 只打印可直接在后台执行的 SQL
//
// 密钥来源（按顺序）：
//   1. 环境变量 CJ_SUPABASE_SERVICE_KEY
//   2. <项目>/.secrets/supabase-service-key.txt        （已被 .gitignore 忽略）
//   3. %USERPROFILE%/.cj-shenghao/supabase-service-key.txt
// 密钥不会出现在任何输出或文件里。
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'release', 'loader.config.json'), 'utf8'));
const base = cfg.supabaseUrl + '/rest/v1/' + cfg.table;
const isCommit = v => typeof v === 'string' && /^[a-f0-9]{40}$/.test(v);

function serviceKey() {
  const env = (process.env.CJ_SUPABASE_SERVICE_KEY || '').trim();
  if (env) return env;
  const files = [
    path.join(root, '.secrets', 'supabase-service-key.txt'),
    path.join(process.env.USERPROFILE || process.env.HOME || '', '.cj-shenghao', 'supabase-service-key.txt'),
  ];
  for (const file of files) {
    try { const v = fs.readFileSync(file, 'utf8').trim(); if (v) return v; } catch {}
  }
  return '';
}

function keyShape(key) {
  if (!key) return 'missing';
  if (key.startsWith('sb_secret_')) return 'sb_secret';
  if (key.startsWith('sb_publishable_')) return 'PUBLISHABLE_ONLY_READ';
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      return payload.role === 'service_role' ? 'jwt_service_role' : 'jwt_' + payload.role;
    } catch { return 'jwt_unparsed'; }
  }
  return 'unknown';
}

function headers(key, extra = {}) {
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...extra };
}

async function readPointer(key) {
  const url = base + '?key=in.(' + cfg.refKey + ',' + cfg.offKey + ')&select=key,value';
  const res = await fetch(url, { headers: key.startsWith('sb_publishable_') ? { apikey: key } : headers(key) });
  if (!res.ok) throw new Error('READ_HTTP_' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

async function writePointer(key, commit) {
  const url = base + '?key=eq.' + encodeURIComponent(cfg.refKey);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: headers(key, { Prefer: 'return=representation' }),
    body: JSON.stringify({ value: commit }),
  });
  if (!res.ok) throw new Error('WRITE_HTTP_' + res.status + ' ' + (await res.text()).slice(0, 300));
  return res.json();
}

const arg = (process.argv[2] || '').trim();
const sqlMode = arg === '--sql';
const commit = (sqlMode ? process.argv[3] : arg).trim();

if (sqlMode) {
  if (!isCommit(commit)) { console.error('需要 40 位提交号'); process.exit(1); }
  console.log(`update public.${cfg.table} set value = '${commit}' where key = '${cfg.refKey}';`);
  console.log(`update public.${cfg.table} set value = '' where key = '${cfg.offKey}';`);
  console.log(`select key, value from public.${cfg.table} where key in ('${cfg.refKey}','${cfg.offKey}');`);
  process.exit(0);
}

const key = serviceKey();
const shape = keyShape(key);

if (!arg) {
  const rows = await readPointer(key || cfg.publishableKey);
  console.log('当前指针（只读）：');
  for (const row of rows) console.log('  ' + row.key + ' = ' + JSON.stringify(row.value));
  console.log('service_role 密钥：' + (shape === 'missing' ? '未配置（写入需要它，或用 --sql 在后台执行）' : '已配置（' + shape + '）'));
  process.exitCode = 0;
} else {
  if (!isCommit(commit)) { console.error('提交号必须是 40 位十六进制'); process.exit(1); }
  if (shape === 'missing' || shape === 'PUBLISHABLE_ONLY_READ') {
    console.error('没有可写的密钥（当前：' + shape + '）。改用：node scripts/set-pointer.mjs --sql ' + commit);
    process.exit(2);
  }
  if (!['sb_secret', 'jwt_service_role'].includes(shape)) {
    console.error('密钥角色不是 service_role（当前：' + shape + '），拒绝写入。');
    process.exit(2);
  }

  const written = await writePointer(key, commit);
  console.log('已写入：' + JSON.stringify(written));
  const after = await readPointer(key);
  for (const row of after) console.log('回读 ' + row.key + ' = ' + JSON.stringify(row.value));
  const ok = after.some(r => r.key === cfg.refKey && r.value === commit);
  if (!ok) { console.error('回读不一致，指针没有生效'); process.exit(3); }
  console.log('POINTER_OK ' + commit);
}
