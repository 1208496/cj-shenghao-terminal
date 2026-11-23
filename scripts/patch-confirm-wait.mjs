// 在每条 `waitForEl #wfConfirm.on` 之后插入 700ms 稳定等待 + 可见性断言，
// 消除「弹窗还在 0.18s 淡入中就点」造成的 F2 抖动。
import fs from 'node:fs';

const p = 'suites/shenghao-rc37.suite.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const OK = '[data-wf-confirm="ok"]';
let n = 0;
for (const c of j.cases) {
  const out = [];
  for (const s of c.steps || []) {
    out.push(s);
    if (s.act === 'waitForEl' && s.selector === '#wfConfirm.on') {
      const next = (c.steps || [])[c.steps.indexOf(s) + 1];
      if (!(next && next.act === 'wait')) {
        out.push({ act: 'wait', ms: 700 });
        out.push({ act: 'assert', frame: 'wheel', selector: OK, kind: 'visible', equals: true });
        n++;
      }
    }
  }
  c.steps = out;
}
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log('CONFIRM_WAIT_PATCHED', n);
