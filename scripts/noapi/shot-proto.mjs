// 渲染两份轮盘原型截图（只读本地文件）
import fs from 'node:fs';
import path from 'node:path';
import { attachSpace, finishSpace } from './runtime.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const targets = [
  { name: 'proto-base', file: path.join(ROOT, 'reports', 'rc34-prototype', 'wheel-proto.html') },
  { name: 'proto-v2', file: path.join(ROOT, '.work', 'wheel-proto-v2.html') }
];

const { task } = await attachSpace();
const out = [];
let page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
try {
  for (const t of targets) {
    try { await page.close(); } catch {}
    page = await task.newPage();
    const url = 'file:///' + t.file.replace(/\\/g, '/');
    await page.goto(url, { timeout: 30000 });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({ title: document.title, w: innerWidth, h: document.documentElement.scrollHeight }));
    const shot = path.join(SHOTS, `rc34-${t.name}-${Date.now()}.png`);
    let ok = false;
    for (let k = 0; k < 3 && !ok; k++) {
      try { await page.screenshot({ path: shot, fullPage: true }); ok = true; } catch { await page.waitForTimeout(1500); }
    }
    out.push({ ...t, url, shot, ok, ...info });
  }
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', 'proto-shots.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await finishSpace(task, []);
}
