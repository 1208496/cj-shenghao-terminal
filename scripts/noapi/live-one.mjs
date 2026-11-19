// scripts/noapi/live-one.mjs —— 真实生成一轮（会花一次模型额度，只跑一次，不重试）
//
// 目的：验证「答案取决于模型输出」的那部分——协议是否按 <JSONPatch> 写字段、生成后 stat_data 是否回写。
// 这是零 API 通道永远验不了的一层，按 runtime-debug 的口径归 modelStatus。
//
// 注意：本脚本 **不装零 API 哨兵**（装了就把真生成拦掉了）。
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/live-one.mjs')"

import fs from 'node:fs';
import path from 'node:path';
import { assertSafeUrl, assertSafePath } from './guards.mjs';
import { waitFor, attachSpace, finishSpace } from './runtime.mjs';
import { openTavern, connectApi, installProbes, lastSig, sendText, shot } from '../ego-st-lib.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const BASE_URL = 'http://127.0.0.1:8001/';
assertSafeUrl(BASE_URL);
const OUT_DIR = path.resolve(ROOT, '.work', 'noapi');
assertSafePath(OUT_DIR, [ROOT]);
fs.mkdirSync(OUT_DIR, { recursive: true });

const avatar = '神豪终端5.png';
const chatId = '__NOAPI_TEST_three_cards';
const PHONE_ID = 'cj-shenghao-phone-frame';

// 一条指令同时压三种写：现金支出（CASH_TRANSACTION + 账本）、人物好感/情动、当前动作。
const MESSAGE = '让助理订两张明天上午飞东京的头等舱，总共 12 万，从我卡上直接扣。订好把行程发我手机上。顺便跟沈清弦说一声，这趟她跟我一起去。';

const out = { at: new Date().toISOString(), avatar, chatId, message: MESSAGE, steps: [] };
const step = (name, detail) => { out.steps.push({ name, detail, at: new Date().toISOString() }); console.log('[LIVE]', name, detail ?? ''); };

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
    let vars = null;
    if (lastAI) { try { vars = window.Mvu.getMvuData({ type: 'message', message_id: lastAI.message_id }); } catch { } }
    const toast = (document.getElementById('toast-container')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    return {
      floors: chat.length,
      lastAIMessageId: lastAI ? lastAI.message_id : null,
      lastAITextLen: lastAI ? String(lastAI.mes || '').length : 0,
      viewRevision: s && s.meta ? s.meta.revision : null,
      cashCents: s && s.user ? s.user.cashCents : null,
      ledgerCount: s && s.finance ? Object.keys(s.finance.ledger || {}).length : null,
      opCount: s && s.operationHistory ? Object.keys(s.operationHistory).length : null,
      chars: s && s.characters ? Object.fromEntries(Object.entries(s.characters).map(([k, c]) => [k, { affection: c.affection, corruption: c.corruption, arousal: c.arousal, thought: String(c.currentThought || '').slice(0, 40), action: String(c.currentAction || '').slice(0, 40) }])) : null,
      lastAIVarsRevision: vars && vars.stat_data && vars.stat_data.shenghao && vars.stat_data.shenghao.meta ? vars.stat_data.shenghao.meta.revision : null,
      lastAIHasState: !!(vars && vars.stat_data && vars.stat_data.shenghao && vars.stat_data.shenghao.meta && vars.stat_data.shenghao.meta.initialized),
      lastAIOps: vars && vars.cj_native_operations ? (vars.cj_native_operations.items || []).length : 0,
      toast,
      phoneVisible: !!document.getElementById(pid) && getComputedStyle(document.getElementById(pid)).display !== 'none',
    };
  }, PHONE_ID);

  out.before = await snap();
  step('BEFORE', { rev: out.before.viewRevision, cash: out.before.cashCents, floors: out.before.floors, ledger: out.before.ledgerCount });

  const t0 = Date.now();
  // sendText 内部已经等生成结束（10 秒启动判据 + 结束判据），不要再调一次 waitGeneration
  const gen = await sendText(page, MESSAGE);
  out.generation = { ...gen, elapsedMs: Date.now() - t0 };
  step('GENERATED', { ok: gen && gen.ok, ms: out.generation.elapsedMs });

  await page.waitForTimeout(2500);
  out.after = await snap();
  step('AFTER', {
    rev: out.after.viewRevision, cash: out.after.cashCents, floors: out.after.floors,
    aiVarsRev: out.after.lastAIVarsRevision, aiHasState: out.after.lastAIHasState, aiOps: out.after.lastAIOps,
    ledger: out.after.ledgerCount, toast: out.after.toast,
  });

  const lastAI = await page.evaluate(() => {
    const ctx = window.SillyTavern.getContext();
    const m = [...(ctx.chat || [])].reverse().find((x) => x && x.is_user === false);
    return m ? { mes: String(m.mes || '').slice(0, 1500), len: String(m.mes || '').length } : null;
  });
  out.lastAIText = lastAI;

  const zod = /zod|变量更新错误|MVU/i.test(out.after.toast || '') ? out.after.toast : '';
  out.verdict = {
    modelStatus: gen && gen.ok ? 'pass' : 'blocked',
    runtimeStatus: out.after.lastAIHasState && out.after.viewRevision > out.before.viewRevision ? 'pass' : 'fail',
    zodErrors: zod || null,
    cashDelta: (out.after.cashCents ?? 0) - (out.before.cashCents ?? 0),
    ledgerDelta: (out.after.ledgerCount ?? 0) - (out.before.ledgerCount ?? 0),
    revDelta: (out.after.viewRevision ?? 0) - (out.before.viewRevision ?? 0),
  };

  try { out.shot = await shot(page, 'live-one'); } catch { }
  const file = path.join(OUT_DIR, `live-one-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');

  console.log('\n===== 结论 =====');
  console.log(JSON.stringify(out.verdict, null, 2));
  console.log('AI 正文长度：', out.lastAIText && out.lastAIText.len);
  console.log('AI 正文开头：', (out.lastAIText?.mes || '').slice(0, 160).replace(/\n/g, ' '));
  console.log('现金：', out.before.cashCents, '→', out.after.cashCents);
  console.log('账本条目：', out.before.ledgerCount, '→', out.after.ledgerCount);
  console.log('revision：', out.before.viewRevision, '→', out.after.viewRevision, '（AI 楼 stat_data rev =', out.after.lastAIVarsRevision, '）');
  console.log('toast：', out.after.toast || '(空)');
  console.log('证据：', file);
} catch (e) {
  out.fatal = String(e.message || e);
  const file = path.join(OUT_DIR, `live-one-FATAL-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  console.log('[LIVE] FATAL:', out.fatal);
  console.log('证据：', file);
} finally {
  await finishSpace(task);
}

