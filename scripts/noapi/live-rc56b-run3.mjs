// rc56b 真实生成验收 · 第三轮（干净重跑）
// 修：用 lastSig + waitGeneration 等生成真正结束；抓 inspect().diagnostics；finishSpace 正确 import。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { lastSig, waitGeneration } from 'file:///E:/SHZDCHOSSS/scripts/ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE = 'http://127.0.0.1:8001/';
if (new URL(BASE).port !== '8001') throw new Error('SAFETY_BLOCK: 只允许 8001');
const AVATAR = '神豪终端7.png';
const OUT = path.join(ROOT, '.work', 'live-rc56b');
fs.mkdirSync(OUT, { recursive: true });
const NODE_BIN = /node(\.exe)?$/i.test(process.execPath) ? process.execPath : 'node';

const MSG1 = '上午十点，沈清弦在客厅窗边改图纸，陆晚晴盘腿坐在地毯上翻展册；苏晚刚从门口进来，把两杯手冲放在茶几上，站在旁边没说话。我靠在沙发上打量她们三个。';
const MSG2 = '我抬手按住沈清弦的手腕，直视她说：“以后别叫我陆总了，叫我阿澈。”';
const SPACE_NAME = 'NOAPI-RC56B-LIVE';

let task, page;
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === SPACE_NAME);
if (!entry) { task = await taskSpace(SPACE_NAME); page = (await task.pages())[0] ?? await task.newPage(); }
else if (entry.ownership === 'agent') { task = await taskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }
else { task = await takeOverTaskSpace(entry.id); const t = (await task.tabs())[0]; page = t.label ? task.page(t.label) : await task.adopt(t.page); }
console.log('[RC56B] space', task.spaceId, 'page', page.label);

const result = { at: new Date().toISOString(), rounds: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'result3.json'), JSON.stringify(result, null, 2), 'utf8');
const log = (...a) => console.log('[RC56B]', ...a);

const statusClass = () => page.evaluate(() => document.getElementById('API-status-top')?.className || '');
const isOk = (c) => c.includes('fa-plug') && !c.includes('exclamation');

async function ensureConnected() {
  const before = await statusClass();
  if (isOk(before)) return (result.connect = { ok: true, how: 'already' });
  await page.evaluate(() => document.querySelector('#API-status-top')?.click());
  await page.waitForTimeout(1500);
  const clicked = await page.evaluate(() => {
    for (const sel of ['#api_connect_btn', '#connect_api', 'button.connect', '.api_connect']) { const el = document.querySelector(sel); if (el) { el.click(); return sel; } }
    const pool = [...document.querySelectorAll('button,div,span,a,.menu_button')].filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
    const hit = pool.find((el) => (el.textContent || '').trim() === '连接'); if (hit) { hit.click(); return 'text:连接'; } return null;
  });
  let ok = false, after = '';
  for (let i = 0; i < 25; i++) { await page.waitForTimeout(900); after = await statusClass(); if (isOk(after)) { ok = true; break; } }
  await page.evaluate(() => document.querySelector('#API-status-top')?.click());
  await page.waitForTimeout(400);
  result.connect = { ok, clicked, before, after: await statusClass() };
  return result.connect;
}

const snapshot = () => page.evaluate(() => {
  const api = window.__CJ_SHENGHAO_V2__;
  const s = api?.read?.()?.state || null;
  const insp = (() => { try { return api?.inspect?.() || null; } catch { return null; } })();
  const chars = s?.characters || {};
  const strip = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  return {
    rev: s?.meta?.revision ?? null,
    present: s?.scene?.presentCharacterIds || [],
    audit: insp?.roundAudit || null,
    diagnostics: (insp?.diagnostics || []).map((d) => d?.code || d?.field || '?').slice(0, 12),
    busyReasons: insp?.busyReasons || null,
    chars: Object.fromEntries(['char_a', 'char_b', 'char_c'].map((id) => [id, {
      name: chars[id]?.name, addressing: chars[id]?.addressing || '',
      thought: strip(chars[id]?.currentThought).slice(0, 140), aff: chars[id]?.affection, arousal: chars[id]?.arousal,
    }])),
    ctxHasPTI: String(s?._context || '').includes('presentThoughtIds'),
  };
});

async function sendAndWait(text) {
  const sig = await lastSig(page);
  await page.evaluate((t) => {
    const ta = document.querySelector('#send_textarea');
    ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#send_but')?.click();
  }, text);
  const w = await waitGeneration(page, sig, { timeout: 300000 });
  const mes = await page.evaluate(() => {
    const msgs = window.SillyTavern.getContext().chat || [];
    const last = msgs[msgs.length - 1] || {};
    return String(last.mes || '');
  });
  return { wait: w, mes };
}

try {
  const conn = await ensureConnected();
  save();
  log('connect', JSON.stringify(conn));
  if (!conn.ok) throw new Error('API_NOT_CONNECTED：连接没点通，本轮不发消息');

  const seedRaw = execFileSync(NODE_BIN, [path.join(ROOT, 'scripts', 'test-noapi-seed.mjs'), '--char', '神豪终端7', '--preset', 'three_women_live', '--unique'], { encoding: 'utf8', cwd: ROOT });
  const seed = JSON.parse(seedRaw.slice(seedRaw.indexOf('{'), seedRaw.lastIndexOf('}') + 1));
  result.chatId = seed.chatId; save();

  await page.evaluate(async ([av, chat]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((x) => x.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
    if (typeof ctx.openCharacterChat === 'function') await ctx.openCharacterChat(chat);
  }, [AVATAR, seed.chatId]);
  await page.waitForTimeout(7000);
  result.before = await snapshot(); save();
  log('before', JSON.stringify({ rev: result.before.rev, pti: result.before.ctxHasPTI }));

  const r1 = await sendAndWait(MSG1);
  result.rounds.push({ id: 'R-1', sent: MSG1, wait: r1.wait, mesLen: r1.mes.length, mes: r1.mes.slice(0, 8000), after: await snapshot() });
  save();
  log('R-1', JSON.stringify({ len: r1.mes.length, wait: r1.wait, audit: result.rounds[0].after.audit, diag: result.rounds[0].after.diagnostics }));

  if (r1.mes.length > 200) {
    const r2 = await sendAndWait(MSG2);
    result.rounds.push({ id: 'R-2', sent: MSG2, wait: r2.wait, mesLen: r2.mes.length, mes: r2.mes.slice(0, 8000), after: await snapshot() });
    save();
    log('R-2', JSON.stringify({ len: r2.mes.length, chars: result.rounds[1].after.chars, audit: result.rounds[1].after.audit }));
  }
  result.ok = true;
} catch (e) {
  result.error = String(e?.message || e); save(); log('ERROR', result.error);
} finally {
  try { await task.finish({ keep: [] }); } catch (e) { log('finish failed', String(e?.message || e)); }
}
console.log('DONE ' + path.join(OUT, 'result3.json'));
