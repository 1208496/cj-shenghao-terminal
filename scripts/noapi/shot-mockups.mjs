// 渲染两版 mockup 截图（只读本地文件）。不用 CDP 视口覆盖——file:// 页面下会卡住。
import fs from 'node:fs';
import path from 'node:path';
import { attachSpace, finishSpace } from './runtime.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const { task } = await attachSpace();
const out = [];
let page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
try {
  for (const name of ['rc39-wheel-page-A', 'rc39-wheel-page-B']) {
    const file = path.join(ROOT, 'reports', `${name}.html`).replace(/\\/g, '/');
    try { await page.close(); } catch {}
    page = await task.newPage();
    await page.goto('file:///' + file, { timeout: 30000 });
    await page.waitForTimeout(2000);
    const info = await page.evaluate(() => ({ title: document.title, h: document.documentElement.scrollHeight, text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200) }));
    const f = path.join(SHOTS, `${name}-${Date.now()}.png`);
    await page.screenshot({ path: f, fullPage: true });
    out.push({ name, shot: f, ...info });
  }
} catch (e) {
  out.push({ error: String(e?.message || e).slice(0, 300) });
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', 'mockup-shots.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await finishSpace(task, []);
}
