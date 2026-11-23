// rc.39 追加：暗夜赌场复刻取证——盘面 + 赌桌下注台（选卡/选色/收手兑换/收回背包/上桌态）。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端21.png';
const CHAT = '__NOAPI_TEST_three_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const out = { shots: [], checks: [] };
const log = (...a) => console.log('[CASINO]', ...a);

const { task, page } = await attachSpace();
try {
  await page.goto(BASE, { timeout: 30000 });
  await waitFor(page, () => ({ ok: document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form') }), null, { label: 'READY' });
  await page.evaluate(installRuntime);
  await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
  await page.evaluate(async ([av, chat]) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    await ctx.selectCharacterById(idx);
    await ctx.openCharacterChat(chat);
  }, [AVATAR, CHAT]);
  await page.waitForTimeout(2500);
  for (let i = 0; i < 10; i++) {
    const ready = await page.evaluate(() => {
      const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
      if (d?.querySelector('[data-open-wheel="casino"]')) return true;
      d?.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click();
      d?.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click();
      return false;
    });
    if (ready) break;
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="casino"]')?.click());
  await page.waitForTimeout(2500);

  const shot = async (tag) => {
    const f = path.join(SHOTS, `rc39-casino-${tag}-${Date.now()}.png`);
    for (let k = 0; k < 3; k++) { try { await page.screenshot({ path: f }); break; } catch { await page.waitForTimeout(1200); } }
    out.shots.push(f);
    return f;
  };

  // 1) 初始态：下注台空槽
  const empty = await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    const z = fd?.querySelector('[data-stake-zone]');
    return {
      mode: fd?.getElementById('wfRoot')?.dataset.mode,
      console: !!fd?.querySelector('.bet-console'),
      title: (fd?.querySelector('.console-hd b')?.textContent || '').trim(),
      stakeLabel: (fd?.querySelector('.stake-lbl')?.textContent || '').trim(),
      stakeVal: (fd?.querySelector('[data-stake-val]')?.textContent || '').trim(),
      placeholder: (fd?.querySelector('.stake-hint')?.textContent || '').trim(),
      betBoxes: [...(fd?.querySelectorAll('[data-bet]') || [])].map((b) => ({ k: b.dataset.bet, t: (b.textContent || '').trim() })),
      handCards: fd?.querySelectorAll('.hand-tray [data-card]').length ?? 0,
      draggable: fd?.querySelector('.hand-tray [data-card]')?.getAttribute('draggable'),
      cashDisabled: fd?.querySelector('[data-cashout-now]')?.disabled === true,
      returnDisabled: fd?.querySelector('[data-return-card]')?.disabled === true,
      goDisabled: fd?.querySelector('#wfGo')?.disabled === true,
      nodes: fd?.getElementById('wfSvg')?.querySelectorAll('*').length
    };
  });
  out.checks.push({ step: 'empty', ...empty }); log('empty', empty);
  await shot('empty');

  // 2) 选色 + 选卡：赌注上桌
  await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('[data-bet="red"]')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('.hand-tray [data-card]')?.click());
  await page.waitForTimeout(600);
  const armed = await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    return {
      stakeVal: (fd?.querySelector('[data-stake-val]')?.textContent || '').trim(),
      cardFace: !!fd?.querySelector('.stake-face .wish-card'),
      inSlot: fd?.querySelectorAll('.hand-tray [data-card].in-slot').length ?? 0,
      betSelected: [...(fd?.querySelectorAll('[data-bet]') || [])].filter((b) => b.classList.contains('selected')).map((b) => b.dataset.bet),
      goEnabled: fd?.querySelector('#wfGo')?.disabled === false,
      cashEnabled: fd?.querySelector('[data-cashout-now]')?.disabled === false
    };
  });
  out.checks.push({ step: 'armed', ...armed }); log('armed', armed);
  await shot('armed');

  // 3) 收回背包
  await page.evaluate(() => document.getElementById('cj-shenghao-wheel-frame')?.contentDocument?.querySelector('[data-return-card]')?.click());
  await page.waitForTimeout(500);
  const returned = await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    return {
      stakeVal: (fd?.querySelector('[data-stake-val]')?.textContent || '').trim(),
      cardFace: !!fd?.querySelector('.stake-face .wish-card'),
      inSlot: fd?.querySelectorAll('.hand-tray [data-card].in-slot').length ?? 0,
      goDisabled: fd?.querySelector('#wfGo')?.disabled === true
    };
  });
  out.checks.push({ step: 'returned', ...returned }); log('returned', returned);
} catch (e) {
  out.error = String(e?.message || e).slice(0, 400);
  log('ERROR', out.error);
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc39-casino-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out, null, 1).slice(0, 2600));
  await finishSpace(task, []);
}
