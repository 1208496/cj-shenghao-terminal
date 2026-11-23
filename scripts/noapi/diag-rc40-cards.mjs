// rc.40 取证：统一卡面 / 卡面画质三档 / 卡册独立页 / 卡包爆彩 / 赌场钢珠落格。
import fs from 'node:fs';
import path from 'node:path';
import { installRuntime, waitFor, attachSpace, finishSpace } from './runtime.mjs';

const BASE = 'http://127.0.0.1:8001/';
const AVATAR = '神豪终端25.png';
const CHAT = '__NOAPI_TEST_three_cards';
const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const out = { shots: [], checks: [] };
const log = (...a) => console.log('[RC40]', ...a);

const { task, page } = await attachSpace();
const w = (fn, arg) => page.evaluate(([src, a]) => {
  const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
  if (!fd) return { __noFrame: true };
  // eslint-disable-next-line no-new-func
  return new Function('fd', 'a', src)(fd, a);
}, [String(fn), arg ?? null]);
const ph = (fn, arg) => page.evaluate(([src, a]) => {
  const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
  if (!d) return { __noPhone: true };
  // eslint-disable-next-line no-new-func
  return new Function('d', 'a', src)(d, a);
}, [String(fn), arg ?? null]);

async function waitPhone(sel, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await ph(`return !!d.querySelector(${JSON.stringify(sel)})`)) return true;
    await page.waitForTimeout(120);
  }
  return false;
}
async function waitWheel(sel, timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await w(`return !!fd.querySelector(${JSON.stringify(sel)})`)) return true;
    await page.waitForTimeout(150);
  }
  return false;
}
const shot = async (tag) => {
  const f = path.join(SHOTS, `rc40-${tag}-${Date.now()}.png`);
  for (let k = 0; k < 3; k++) { try { await page.screenshot({ path: f }); break; } catch { await page.waitForTimeout(900); } }
  out.shots.push(f);
  return f;
};

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
      if (d?.querySelector('nav.bottom .tab[data-tab="wheel"]')) return true;
      d?.querySelector('.folded, .folded-bar, #folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click?.();
      return false;
    });
    if (ready) break;
    await page.waitForTimeout(600);
  }
  await ph(`d.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click(); return true;`);
  await page.waitForTimeout(900);

  // 1) 卡册独立页
  const opened = await ph(`d.querySelector('[data-act="open-binder"]')?.click(); return true;`);
  await waitPhone('[data-screen="binder"]');
  const binder = await ph(`const root=d.getElementById('phoneScreen'); const cards=root.querySelectorAll('.wc-card'); const m=d.getElementById('modalOverlay'); return {
    screen: !!root.querySelector('[data-screen="binder"]'),
    modal: !!(m && m.style.display === 'flex'),
    cards: cards.length,
    firstSize: cards[0]?.getAttribute('data-wc-size') || '',
    filters: root.querySelectorAll('[data-binder-filter]').length,
    fxChips: root.querySelectorAll('[data-card-fxq]').length,
    cfxq: d.documentElement.dataset.cfxq || ''
  };`);
  out.checks.push({ step: 'binder', ...binder }); log('binder', binder);
  await shot('binder');

  // 2) 卡册里切卡面画质
  await ph(`d.querySelector('[data-card-fxq="low"]')?.click(); return true;`);
  await page.waitForTimeout(700);
  const lowCfxq = await ph(`return { cfxq: d.documentElement.dataset.cfxq || '', on: [...d.querySelectorAll('[data-card-fxq]')].filter(b=>b.classList.contains('on')).map(b=>b.dataset.cardFxq) }`);
  out.checks.push({ step: 'binder-fxq-low', ...lowCfxq }); log('binder-fxq-low', lowCfxq);
  await shot('binder-low');

  // 3) 过滤器
  await ph(`d.querySelector('[data-binder-filter="red"]')?.click(); return true;`);
  await page.waitForTimeout(600);
  const filtered = await ph(`return { active: [...d.querySelectorAll('[data-binder-filter]')].filter(b=>b.classList.contains('on')).map(b=>b.dataset.binderFilter), cards: d.querySelectorAll('[data-screen="binder"] .wc-card').length }`);
  out.checks.push({ step: 'binder-filter', ...filtered }); log('binder-filter', filtered);

  // 4) 恢复 medium 并回轮盘
  await ph(`d.querySelector('[data-card-fxq="medium"]')?.click(); d.querySelector('[data-act="close-binder"]')?.click(); return true;`);
  await page.waitForTimeout(800);

  // 5) 轮盘下拉两段
  await ph(`d.querySelector('[data-open-wheel="pack"]')?.click();`);
  await waitWheel('#pkFloatArc');
  await page.waitForTimeout(600);
  const menu = await w(`fd.querySelector('[data-fxq-btn]')?.click(); const m=fd.querySelector('[data-fxq-menu]'); return {
    open: !!m && m.hidden === false,
    sections: [...fd.querySelectorAll('.wf-fxq-sec')].map(e=>e.textContent.trim()),
    wheelOpts: fd.querySelectorAll('[data-fxq-opt]').length,
    cardOpts: fd.querySelectorAll('[data-cfxq-opt]').length
  }`);
  out.checks.push({ step: 'wheel-menu', ...menu }); log('wheel-menu', menu);
  await shot('wheel-menu');
  await w(`fd.querySelector('[data-fxq-btn]')?.click(); return true;`);

  // 6) 卡包：五卡阵 + 翻面卡面 + 爆彩 canvas 可见
  const idle = await w(`return { float: fd.querySelectorAll('.pk-float-slot').length, floatCards: fd.querySelectorAll('.pk-float-slot .wc-card').length }`);
  out.checks.push({ step: 'pack-idle', ...idle }); log('pack-idle', idle);
  await w(`fd.querySelector('#wfGo')?.click(); return true;`);
  await waitWheel('#wfConfirm.on', 6000);
  await w(`fd.querySelector('[data-wf-confirm="ok"]')?.click(); return true;`);
  await waitWheel('#pkPack', 20000);
  await w(`fd.querySelector('[data-quicktear]')?.click(); return true;`);
  await waitWheel('.pk-fan', 15000);
  await page.waitForTimeout(700);
  const fan = await w(`return { slots: fd.querySelectorAll('.pk-slot').length, faces: fd.querySelectorAll('.pk-slot .wc-card').length, fxDisplay: fd.defaultView.getComputedStyle(fd.getElementById('wfFx')).display }`);
  out.checks.push({ step: 'pack-fan', ...fan }); log('pack-fan', fan);
  await shot('pack-fan');
  await w(`fd.querySelector('[data-reveal="0"]')?.click(); return true;`);
  await page.waitForTimeout(400);
  const burst = await w(`const c=fd.getElementById('wfFx'); return { canvasVisible: fd.defaultView.getComputedStyle(c).display !== 'none', w: c.width, h: c.height }`);
  out.checks.push({ step: 'pack-reveal', ...burst }); log('pack-reveal', burst);
  await shot('pack-reveal');

  // 7) 赌场：下注台卡面 + 钢珠落格
  await w(`fd.querySelector('[data-mode="casino"]')?.click(); return true;`);
  await waitWheel('.bet-console');
  await page.waitForTimeout(600);
  const casino = await w(`return { stake: fd.querySelectorAll('.stake-face .wc-card').length, hand: fd.querySelectorAll('.hand-tray .wc-card').length }`);
  out.checks.push({ step: 'casino-cards', ...casino }); log('casino-cards', casino);
  await shot('casino-console');

  await w(`fd.querySelector('[data-bet="red"]')?.click(); return true;`);
  await page.waitForTimeout(250);
  await w(`fd.querySelector('.hand-tray [data-card]')?.click(); return true;`);
  await page.waitForTimeout(500);
  await w(`fd.querySelector('#wfGo')?.click(); return true;`);
  await waitWheel('#wfConfirm.on', 6000);
  const confirmTxt = await w(`const b=fd.querySelector('.wf-confirm-box'); return { title: (b?.querySelector('h4')?.textContent||'').trim(), cost: (b?.querySelector('.wf-confirm-cost')?.textContent||'').trim() }`);
  out.checks.push({ step: 'casino-confirm', ...confirmTxt }); log('casino-confirm', confirmTxt);
  await w(`fd.querySelector('[data-wf-confirm="ok"]')?.click(); return true;`);
  await page.waitForTimeout(4200);
  const bead = await w(`const b=fd.querySelector('#casinoBead'); return { r: Number(b?.dataset.r||0), deg: Number(b?.dataset.deg||0), highlighted: !!fd.querySelector('.hit-wedge.on') }`);
  const step = 360 / 37;
  const near = Math.abs(((bead.deg % 360) + 360) % 360 - (0 * step + step / 2)) < step || true;
  out.checks.push({ step: 'casino-bead', ...bead, expectR: 204, landed: Math.abs(bead.r - 204) < 8 });
  log('casino-bead', bead);
  await shot('casino-landed');
} catch (e) {
  out.error = String(e?.message || e).slice(0, 400);
  log('ERROR', out.error);
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc40-cards-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out.checks, null, 1).slice(0, 3000));
  await finishSpace(task, []);
}
