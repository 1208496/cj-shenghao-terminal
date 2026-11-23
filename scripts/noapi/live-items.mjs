// B 档：真实生成一轮（会花 1 次模型额度，只跑一次，不重试）。
// 一次验两件事：①想法 19「使用玩法券 / 奇物后正文是否描写」；②B.7「离场熟人主动来信是否被写进正文」。
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/live-items.mjs')"
import fs from 'node:fs';
import path from 'node:path';
import { assertSafeUrl, assertSafePath } from './guards.mjs';
import { waitFor, attachSpace, finishSpace } from './runtime.mjs';
import { openTavern, connectApi, installProbes, sendText, shot } from '../ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE_URL = 'http://127.0.0.1:8001/';
assertSafeUrl(BASE_URL);
const OUT_DIR = path.resolve(ROOT, '.work', 'noapi');
assertSafePath(OUT_DIR, [ROOT]);
fs.mkdirSync(OUT_DIR, { recursive: true });

const avatar = '神豪终端9.png';
const chatId = '__NOAPI_LIVE_items';
const PHONE_ID = 'cj-shenghao-phone-frame';

const out = { at: new Date().toISOString(), avatar, chatId, steps: [] };
const step = (name, detail) => { out.steps.push({ name, detail, at: new Date().toISOString() }); console.log('[LIVE]', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 300)); };

const { task, page } = await attachSpace();
try {
  await openTavern(page);
  await connectApi(page);
  step('API_CONNECTED');

  await page.evaluate(async (av) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
  }, avatar);
  await page.waitForTimeout(2400);
  await page.evaluate(async (c) => { await window.SillyTavern.getContext().openCharacterChat(c); }, chatId);

  const phone = await waitFor(page, (o) => {
    const f = document.getElementById(o.pid);
    const v = window.__CJ_SHENGHAO_V2__;
    const s = v && v.read ? v.read() : null;
    return { ok: !!f && !!(s && s.state && s.state.meta && s.state.meta.initialized) };
  }, { pid: PHONE_ID }, { label: 'PHONE', timeout: 25000 });
  if (!phone.ok) throw new Error('PHONE_NOT_READY');
  step('PHONE_READY');
  await installProbes(page);

  const snap = () => page.evaluate((pid) => {
    const ctx = window.SillyTavern.getContext();
    const h = window.__CJ_SHENGHAO_V2__;
    const view = h && h.read ? h.read() : null;
    const s = view && view.state ? view.state : null;
    const chat = ctx.chat || [];
    const lastAI = [...chat].reverse().find((m) => m && m.is_user === false);
    const ctxText = s && s._context ? String(s._context) : '';
    return {
      floors: chat.length,
      lastAIMessageId: lastAI ? lastAI.message_id : null,
      lastAITextLen: lastAI ? String(lastAI.mes || '').length : 0,
      viewRevision: s && s.meta ? s.meta.revision : null,
      cashCents: s && s.user ? s.user.cashCents : null,
      opCount: s && s.operationHistory ? Object.keys(s.operationHistory).length : null,
      inv: s && s.inventory ? Object.fromEntries(Object.entries(s.inventory).map(([k, v]) => [k, { status: v.status, usedDate: v.usedDate, usedRevision: v.usedRevision ?? null }])) : null,
      hasPing: ctxText.includes('incomingPing'),
      hasMustDepict: ctxText.includes('mustDepictUsedItems'),
      intimateStage: ctxText.includes('INTIMATE_SCENE_ACTIVE'),
      toast: (document.getElementById('toast-container')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      phoneVisible: !!document.getElementById(pid) && getComputedStyle(document.getElementById(pid)).display !== 'none'
    };
  }, PHONE_ID);

  out.before = await snap();
  step('BEFORE', { rev: out.before.viewRevision, inv: out.before.inv, ping: out.before.hasPing });

  // 硬前置：两张券都必须是 READY，否则这轮验不了「使用后正文描写」，直接停手不花额度。
  const ready = out.before.inv?.prize_1?.status === 'READY' && out.before.inv?.surreal_1?.status === 'READY';
  if (!ready) throw new Error('PRESET_NOT_FRESH: ' + JSON.stringify({ prize: out.before.inv?.prize_1, surreal: out.before.inv?.surreal_1 }));
  // 清空上一轮残留的输入框，避免把旧文案当成这一轮的证据。
  await page.evaluate(() => { const ta = document.getElementById('send_textarea'); if (ta) { ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); } });

  // 展开小手机 → 轮盘页 → 开背包
  for (let i = 0; i < 10; i++) {
    const ok = await page.evaluate(() => {
      const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
      if (d?.querySelector('[data-act="open-bag"]')) return true;
      d?.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click();
      d?.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click();
      return false;
    });
    if (ok) break;
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-act="open-bag"]')?.click());
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-bag-tab="prizes"]')?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-use-now="prize_1"]')?.click());
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-confirm-use-prize="prize_1"]')?.click());
  await page.waitForTimeout(1200);
  const prizeDraft = await page.evaluate(() => document.getElementById('send_textarea')?.value || '');
  step('PRIZE_USED', { draftLen: prizeDraft.length, head: prizeDraft.slice(0, 60) });

  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-bag-tab="surreal"]')?.click());
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-use-item="surreal_1"]')?.click());
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-confirm-use-item="surreal_1"]')?.click());
  await page.waitForTimeout(1200);
  const itemDraft = await page.evaluate(() => document.getElementById('send_textarea')?.value || '');
  step('ITEM_USED', { draftLen: itemDraft.length, head: itemDraft.slice(0, 60) });

  // 产品行为是「替换式填入」，一轮里要同时验两张券，测试侧把它们拼起来（玩家本来也能自己补字）。
  const composed = `${prizeDraft}\n${itemDraft}`;
  await page.evaluate((t) => {
    const ta = document.getElementById('send_textarea');
    if (ta) { ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  }, composed);
  out.composed = { len: composed.length, head: composed.slice(0, 120) };
  out.mid = await snap();
  step('COMPOSED', { ping: out.mid.hasPing, mustDepict: out.mid.hasMustDepict, inv: out.mid.inv });

  const t0 = Date.now();
  const gen = await sendText(page, composed);
  out.generation = { ...gen, elapsedMs: Date.now() - t0 };
  step('GENERATED', { ok: gen && gen.ok, ms: out.generation.elapsedMs });

  await page.waitForTimeout(3000);
  out.after = await snap();
  step('AFTER', { rev: out.after.viewRevision, inv: out.after.inv, toast: out.after.toast });

  const lastAI = await page.evaluate(() => {
    const ctx = window.SillyTavern.getContext();
    const m = [...(ctx.chat || [])].reverse().find((x) => x && x.is_user === false);
    return m ? { mes: String(m.mes || ''), len: String(m.mes || '').length } : null;
  });
  out.lastAIText = lastAI ? { len: lastAI.len, head: lastAI.mes.slice(0, 1200) } : null;
  const body = lastAI ? lastAI.mes.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '').replace(/<think[\s\S]*?<\/think>/gi, '') : '';

  const L1 = /温泉山庄|汤池|温泉/.test(body);
  const L2 = /香气|气息|香味/.test(body) && /呼吸|体温|发烫|颤栗|眼神|迷离/.test(body);
  const L3 = (out.after.viewRevision ?? 0) > (out.mid.viewRevision ?? 0) && out.after.inv?.prize_1?.status === 'USED' && out.after.inv?.surreal_1?.status === 'USED' && !/zod|变量更新错误/i.test(out.after.toast || '');
  const pingHit = /微信|消息|手机震|屏幕亮|发来|语音|短信/.test(body);
  out.verdict = {
    modelStatus: gen && gen.ok ? 'pass' : 'blocked',
    itemDepiction: { L1, L2, L3, pass: L3 && (L1 || L2) },
    incomingPing: { hasPingInContext: out.mid.hasPing, writtenInBody: pingHit, pass: out.mid.hasPing ? pingHit : null },
    mustDepictInContext: out.mid.hasMustDepict,
    revDelta: (out.after.viewRevision ?? 0) - (out.before.viewRevision ?? 0),
    zodErrors: /zod|变量更新错误/i.test(out.after.toast || '') ? out.after.toast : null
  };
  step('VERDICT', out.verdict);

  try { out.shot = await shot(page, 'live-items'); } catch { }
  const file = path.join(OUT_DIR, `live-items-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  console.log('[LIVE] evidence →', file);
} catch (e) {
  out.error = String(e?.stack || e).slice(0, 800);
  console.log('[LIVE] ERROR', out.error);
  const file = path.join(OUT_DIR, `live-items-err-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  console.log('[LIVE] evidence →', file);
} finally {
  await finishSpace(task, []);
}
