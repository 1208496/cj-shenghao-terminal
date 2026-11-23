// 只做几何取证：svg 实际视口 vs 内容半径
import { attachSpace, finishSpace } from './runtime.mjs';

const AV = '神豪终端14.png';
const CHAT = '__NOAPI_TEST_three_cards';
const { task, page } = await attachSpace();
try {
  await page.goto('http://127.0.0.1:8001/', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async ([av, chat]) => {
    const c = window.SillyTavern.getContext();
    const i = c.characters.findIndex((x) => x.avatar === av);
    await c.selectCharacterById(i);
    await c.openCharacterChat(chat);
  }, [AV, CHAT]);
  await page.waitForTimeout(2500);
  for (let i = 0; i < 12; i++) {
    const r = await page.evaluate(() => {
      const d = document.getElementById('cj-shenghao-phone-frame')?.contentDocument;
      if (d?.querySelector('[data-open-wheel="play"]')) return true;
      d?.querySelector('.folded,.folded-bar,#folded')?.click?.();
      d?.querySelector('[data-act="expand"]')?.click?.();
      d?.querySelector('nav.bottom .tab[data-tab="wheel"]')?.click?.();
      return false;
    });
    if (r) break;
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => document.getElementById('cj-shenghao-phone-frame')?.contentDocument?.querySelector('[data-open-wheel="play"]')?.click());
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const fd = document.getElementById('cj-shenghao-wheel-frame')?.contentDocument;
    if (!fd) return { err: 'NO_FRAME' };
    const svg = fd.getElementById('wfSvg');
    const board = svg.closest('.wf-board');
    const br = board.getBoundingClientRect();
    const sr = svg.getBoundingClientRect();
    const bezel = svg.querySelector('circle[r="332"]');
    const bez = bezel ? bezel.getBoundingClientRect() : null;
    const cs = fd.defaultView.getComputedStyle(svg);
    return {
      viewBox: svg.getAttribute('viewBox'),
      board: { w: Math.round(br.width), h: Math.round(br.height) },
      svg: { w: Math.round(sr.width), h: Math.round(sr.height), overflow: cs.overflow },
      bezel: bez ? { x: Math.round(bez.x), y: Math.round(bez.y), w: Math.round(bez.width), h: Math.round(bez.height) } : null,
      boardCs: { contain: fd.defaultView.getComputedStyle(board).contain, filter: fd.defaultView.getComputedStyle(board).filter, overflow: fd.defaultView.getComputedStyle(board).overflow }
    };
  });
  console.log(JSON.stringify(info, null, 1));
} finally {
  await finishSpace(task, []);
}
