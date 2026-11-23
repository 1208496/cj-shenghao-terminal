// RC52 最后一条（会花钱：1 次生成，inline 模式）：clearPendingWear 是否把佩戴注入撤掉
// 思路：在「佩戴轮」同一聊天再发一句日常（不碰 TOY），看这一轮是否还出现「刚戴上/刚置入」的新动作、
//       以及模型思考块里是否复述 worn 态注入措辞（「本轮刚将…置入体内深处」「严禁描写任何震动」）。
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/live-rc52-clear-pending.mjs')"
import fs from 'node:fs';
import path from 'node:path';
import { attachSpace, finishSpace, waitFor } from 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/runtime.mjs';
import { openTavern, lastSig, waitGeneration } from 'file:///E:/SHZDCHOSSS/scripts/ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端7.png';
const OUT_DIR = path.join(ROOT, '.work', 'live-rc52');
const wearResult = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'round-wear-result.json'), 'utf8'));
const CHAT = wearResult.chatId;
if (new URL(BASE).port !== '8001') throw new Error('SAFETY_BLOCK: 只允许 8001');
const SENT = '我在她旁边坐下，把茶几上的铅笔递给她，随口问了两句草图的进度。';

const result = { at: new Date().toISOString(), chatId: CHAT, sent: SENT, round: 'B(第二句)' };
const log = (...a) => console.log('[CLEAR-WEAR]', ...a);
const save = () => fs.writeFileSync(path.join(OUT_DIR, 'clear-pending-result.json'), JSON.stringify(result, null, 2), 'utf8');

const { task, page } = await attachSpace('NOAPI-RC54-LIVE');
try {
  await openTavern(page);
  const conn = { ok: false, before: null, after: null };
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
    await page.waitForTimeout(400);
  } else { conn.ok = true; conn.after = conn.before; }
  result.connect = conn;
  if (!conn.ok) throw new Error('API_NOT_CONNECTED');

  await page.evaluate(async ([av, c]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((x) => x.avatar === av);
    if (idx < 0) throw new Error('CHAR_NOT_FOUND');
    await ctx.selectCharacterById(idx);
    await ctx.openCharacterChat(c);
  }, [AVATAR, CHAT]);
  await waitFor(page, (o) => {
    const f = document.getElementById(o);
    const s = window.__CJ_SHENGHAO_V2__?.read?.();
    return { ok: !!f && !!(s?.state?.meta?.initialized) };
  }, 'cj-shenghao-phone-frame', { label: 'PHONE', timeout: 25000 });
  await page.waitForTimeout(2200);

  result.mode = await page.evaluate(() => window.SillyTavern.getContext().extensionSettings?.mvu_settings?.['更新方式'] ?? null);
  result.stateBefore = await page.evaluate(() => {
    const h = window.__CJ_SHENGHAO_V2__;
    const s = h?.read?.()?.state || null;
    const a = s?.characters?.char_a || null;
    let toy = null;
    try { toy = h.toyLinkState(); } catch { toy = null; }
    return {
      rev: s?.meta?.revision ?? null,
      choker: !!a?.choker?.worn,
      toy: toy ? { wearingIds: toy.wearingIds || [], running: !!toy.running, activeMode: toy.activeMode || null } : null,
      itemText: String(a?.currentItems || '').slice(0, 80),
    };
  });
  log('MODE', result.mode, '｜state', JSON.stringify(result.stateBefore));

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
    return m ? String(m.mes || '') : null;
  });
  result.gen = { ok: !!gen.ok, why: gen.why || '', chars: ai ? ai.length : 0, ms: Date.now() - t0 };
  if (ai) fs.writeFileSync(path.join(OUT_DIR, 'round-clear-wear.md'), `# 第二句（验 clearPendingWear）\n\n- 发送：${SENT}\n- 字符数：${ai.length}\n\n---\n\n${ai}\n`, 'utf8');
  if (ai) {
    const think = (ai.match(/<think[\s\S]*?(<\/think>|$)/i) || [''])[0];
    const cut = ai.indexOf('<game>');
    const body = (cut >= 0 ? ai.slice(cut + 6) : ai).replace(/<think[\s\S]*?<\/think>/gi, '').replace(/<UpdateVariable[\s\S]*?<\/UpdateVariable>/gi, '').replace(/<StatusPlaceHolderImpl\s*\/?>/gi, '');
    fs.writeFileSync(path.join(OUT_DIR, 'round-clear-wear-body.md'), body, 'utf8');
    result.probe = {
      thinkLen: think.length,
      bodyLen: body.replace(/\s/g, '').length,
      // worn 态注入的特征措辞
      thinkHasWornInjection: /本轮刚|刚将|置入体内深处|严禁描写任何震动|严禁写震动/.test(think),
      // 正文里是否重演「新发生的佩戴动作」
      bodyHasFreshWearAction: /(刚|重新|再度).{0,6}(戴上|置入|放进|塞进|推入)|把.{0,8}(跳蛋|蛋体).{0,10}(推|塞|置)/.test(body),
      bodyMentionsWearState: /(戴着|佩戴|含着|夹着|体内).{0,12}(跳蛋|异物|它)/.test(body),
      bodyHasVibration: /(震动|震颤|嗡鸣|嗡嗡)/.test(body),
      bodyLenNoSpace: body.replace(/\s/g, '').length,
    };
  }
  await page.waitForTimeout(3000);
  result.stateAfter = await page.evaluate(() => {
    const h = window.__CJ_SHENGHAO_V2__;
    const s = h?.read?.()?.state || null;
    return { rev: s?.meta?.revision ?? null, itemText: String(s?.characters?.char_a?.currentItems || '').slice(0, 80) };
  });
  save();
  log('GEN', JSON.stringify(result.gen));
  log('PROBE', JSON.stringify(result.probe, null, 1));
} catch (e) {
  result.error = String(e?.message || e).slice(0, 300);
  save();
  log('ERROR', result.error);
  throw e;
} finally {
  await finishSpace(task, []);
}
