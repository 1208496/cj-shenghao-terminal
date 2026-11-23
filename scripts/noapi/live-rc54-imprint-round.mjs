// rc54 补充第 4 轮（用户 2026-11-23 明确「跑」授权）：给 R-02 定性 + 顺带验 R-06 后半句
//   前置：项圈佩戴、印记在下腹、TOY 佩戴但**未运行**（新页面 run.running 天然复位）
//   发送：把镜头推到下腹的一句
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/live-rc54-imprint-round.mjs')"
import fs from 'node:fs';
import path from 'node:path';
import { attachSpace, finishSpace, waitFor } from 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/runtime.mjs';
import { openTavern, lastSig, waitGeneration } from 'file:///E:/SHZDCHOSSS/scripts/ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端7.png';
const PHONE_ID = 'cj-shenghao-phone-frame';
const CHAT = '__NOAPI_TEST_device_ready__mwtb1axy';
const OUT_DIR = path.join(ROOT, '.work', 'live-rc54');
const SENT = '我扶住她的肩，把她转过来面对我，另一只手撩起她裙摆的一角，低头看向她小腹下方那片皮肤。';
if (new URL(BASE).port !== '8001') throw new Error('SAFETY_BLOCK: 只允许 8001');

const result = { at: new Date().toISOString(), chatId: CHAT, sent: SENT, round: 4, model: null, before: null, after: null };
const log = (...a) => console.log('[LIVE54-R4]', ...a);

const { task, page } = await attachSpace('NOAPI-RC54-LIVE');
const ph = (src) => page.evaluate((s) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  return new Function('d', s)(d);
}, String(src));
const sleep = (ms) => page.waitForTimeout(ms);
const snap = () => page.evaluate(() => {
  const h = window.__CJ_SHENGHAO_V2__;
  const s = h?.read?.()?.state || null;
  const a = s?.characters?.char_a || null;
  let toy = null;
  try { toy = h?.toyLinkState?.() || null; } catch { toy = null; }
  return {
    rev: s?.meta?.revision ?? null,
    chokerWorn: !!a?.choker?.worn,
    accessories: a?.outfit?.accessories || '',
    imprintKeys: Object.keys(a?.imprints?.items || {}),
    tattooScar: a?.physiology?.tattooScar || '',
    toy: toy ? { wearingIds: toy.wearingIds || [], running: !!toy.running, pow: toy.pow ?? null, activeMode: toy.activeMode || null } : null,
  };
});

try {
  await openTavern(page);
  const conn = { before: null, after: null, ok: false };
  conn.before = await page.evaluate(() => document.getElementById('API-status-top')?.className || null);
  if (!(conn.before || '').includes('fa-plug') || (conn.before || '').includes('exclamation')) {
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const pool = [...document.querySelectorAll('button, .menu_button, div, span')].filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
      pool.find((el) => (el.textContent || '').trim() === '连接')?.click();
    });
    for (let i = 0; i < 18; i += 1) {
      await page.waitForTimeout(900);
      conn.after = await page.evaluate(() => document.getElementById('API-status-top')?.className || null);
      if (conn.after && conn.after.includes('fa-plug') && !conn.after.includes('exclamation')) { conn.ok = true; break; }
    }
    await page.evaluate(() => document.querySelector('#API-status-top')?.click());
    await page.waitForTimeout(500);
  } else { conn.ok = true; conn.after = conn.before; }
  result.connect = conn;
  log('CONNECT', JSON.stringify(conn));
  if (!conn.ok) throw new Error('API_NOT_CONNECTED');

  await page.evaluate(async ([av, c]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((x) => x.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
    await ctx.openCharacterChat(c);
  }, [AVATAR, CHAT]);
  const phone = await waitFor(page, (o) => {
    const f = document.getElementById(o.pid);
    const v = window.__CJ_SHENGHAO_V2__;
    const s = v?.read?.() || null;
    return { ok: !!f && getComputedStyle(f).display !== 'none' && !!(s?.state?.meta?.initialized) };
  }, { pid: PHONE_ID }, { label: 'PHONE', timeout: 25000 });
  if (!phone.ok) throw new Error('PHONE_NOT_READY');
  await sleep(1200);

  result.model = await page.evaluate(() => {
    const o = window.SillyTavern.getContext().chatCompletionSettings || {};
    return { source: o.chat_completion_source || null, custom_model: o.custom_model || null };
  });
  result.before = await snap();
  log('BEFORE', JSON.stringify({ rev: result.before.rev, choker: result.before.chokerWorn, imprints: result.before.imprintKeys, toy: result.before.toy }));

  // TOY 必须是「佩戴但未运行」；运行态本就不持久，若连佩戴都没了才补戴一次（不开启）
  if (!result.before.toy?.wearingIds?.length || result.before.toy?.running) {
    await ph(`const f=d.querySelector('.folded,.folded-bar,#folded'); if(f){f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1}));f.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:1}));f.click();} return true;`);
    await sleep(600);
    await ph(`[...d.querySelectorAll('nav.bottom .tab')].find(b=>b.dataset.tab==='mine')?.click(); return true;`);
    await sleep(600);
    await ph(`const sc=d.querySelector('.phone-screen'); if(sc) sc.scrollTop=260; return true;`);
    await sleep(200);
    await ph(`d.querySelector('[data-toylink]')?.click(); return true;`);
    await sleep(1000);
    await ph(`d.querySelector('[data-tl-lite-select="char_a"]')?.click(); return true;`);
    await sleep(500);
    await ph(`d.querySelector('[data-tl-lite-stop="1"]')?.click(); return true;`);
    await sleep(600);
    await ph(`d.querySelector('[data-tl-lite-wear="1"]')?.click(); return true;`);
    await sleep(1000);
    result.before = await snap();
    log('TOY_RESTORED', JSON.stringify(result.before.toy), 'running=' + result.before.toy?.running);
  }
  if (result.before.toy?.running) throw new Error('TOY_STILL_RUNNING');
  if (!result.before.imprintKeys?.length) throw new Error('IMPRINT_MISSING_IN_STATE');

  const sig = await lastSig(page);
  await page.evaluate((t) => {
    const ta = document.getElementById('send_textarea');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, t);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('send_but')?.click();
  }, SENT);
  const t0 = Date.now();
  const gen = await waitGeneration(page, sig, { timeout: 540000 });
  const ai = await page.evaluate(() => {
    const chat = window.SillyTavern.getContext().chat || [];
    const m = [...chat].reverse().find((x) => x && x.is_user === false);
    return m ? { text: String(m.mes || '') } : null;
  });
  result.gen = { ok: !!gen.ok, why: gen.why || '', chars: ai ? ai.text.length : 0, ms: Date.now() - t0 };
  result.after = await snap();
  if (ai) {
    fs.writeFileSync(path.join(OUT_DIR, 'round-4.md'), `# R-4 生成正文（补充轮：R-02 定性 + R-06 后半）\n\n- 前置：项圈佩戴 / 印记下腹 / TOY 佩戴未运行\n- 发送：${SENT}\n- 字符数：${ai.text.length}\n\n---\n\n${ai.text}\n`, 'utf8');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'round-4-result.json'), JSON.stringify(result, null, 2), 'utf8');
  log('ROUND4', JSON.stringify(result.gen));
  log('AFTER', JSON.stringify({ rev: result.after.rev, acc: result.after.accessories.slice(0, 60), scar: result.after.tattooScar.slice(0, 40), toy: result.after.toy }));
} catch (e) {
  result.error = String(e?.message || e).slice(0, 300);
  fs.writeFileSync(path.join(OUT_DIR, 'round-4-result.json'), JSON.stringify(result, null, 2), 'utf8');
  log('ERROR', result.error);
  throw e;
} finally {
  await finishSpace(task, []);
}
