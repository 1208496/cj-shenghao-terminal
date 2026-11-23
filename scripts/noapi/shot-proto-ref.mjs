// rc.39 对照取证：把 4N 的两份原版原型（赌场 / 轮盘）在同一视口下截图，用于和实机页逐项对齐。
import fs from 'node:fs';
import path from 'node:path';
import { attachSpace, finishSpace } from './runtime.mjs';

const ROOT = 'E:\\SHZDCHOSSS';
const SHOTS = path.join(ROOT, 'reports', 'noapi-test-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const out = { shots: [] };
const { task, page } = await attachSpace();
try {
  for (const [tag, file] of [['casino', 'reports/rc39-proto-casino.html'], ['wheel', 'reports/rc39-proto-wheel.html']]) {
    await page.goto('file:///' + path.join(ROOT, file).replace(/\\/g, '/'), { timeout: 30000 });
    await page.waitForTimeout(1500);
    const f = path.join(SHOTS, `rc39-proto-${tag}-ref-${Date.now()}.png`);
    await page.screenshot({ path: f });
    out.shots.push(f);
    console.log('[PROTO]', tag, f);
  }
} catch (e) {
  out.error = String(e?.message || e).slice(0, 300);
  console.log('[PROTO] ERROR', out.error);
} finally {
  fs.writeFileSync(path.join(ROOT, '.work', `rc39-proto-ref-${Date.now()}.json`), JSON.stringify(out, null, 1), 'utf8');
  await finishSpace(task, []);
}
