// rc.38：零 API 套件跟上新交互——GO 之后先过确认弹窗，并补两条新断言用例。
import fs from 'node:fs';

const path = 'suites/shenghao-rc37.suite.json';
const suite = JSON.parse(fs.readFileSync(path, 'utf8'));

const OK_BTN = '[data-wf-confirm="ok"]';
let inserted = 0;
for (const c of suite.cases) {
  const steps = [];
  for (const s of c.steps || []) {
    steps.push(s);
    if (s.act === 'click' && s.selector === '#wfGo') {
      steps.push({ act: 'waitForEl', frame: 'wheel', selector: '#wfConfirm.on', timeout: 5000 });
      steps.push({ act: 'assert', frame: 'wheel', selector: OK_BTN, kind: 'visible', equals: true });
      steps.push({ act: 'click', frame: 'wheel', selector: OK_BTN, settle: 900 });
      inserted++;
    }
  }
  c.steps = steps;
}

if (!suite.cases.some((c) => c.id === 'mine.no-shop-btn')) {
  suite.cases.push({
    id: 'mine.no-shop-btn',
    title: '我的页：异能栏不再挂「前往星愿商城」重复入口',
    preset: 'three_cards',
    steps: [
      { act: 'expand' },
      { act: 'tab', tab: 'mine' },
      { act: 'assert', selector: '[data-tab="mine"] .ability-shop-link', kind: 'count', equals: 0 },
      { act: 'assert', selector: '[data-tab="mine"] .ability-card', kind: 'visible', equals: true }
    ]
  });
}
if (!suite.cases.some((c) => c.id === 'pack.five-float-cards')) {
  suite.cases.push({
    id: 'pack.five-float-cards',
    title: '星愿卡包：待机五卡悬浮阵（4 档稀有度 + 中心星愿秘印）',
    preset: 'three_cards',
    steps: [
      { act: 'expand' },
      { act: 'tab', tab: 'wheel' },
      { act: 'openWheel', type: 'pack' },
      { act: 'waitForEl', frame: 'wheel', selector: '#pkFloatArc', timeout: 8000 },
      { act: 'assert', frame: 'wheel', selector: '#pkFloatArc .pk-float-slot', kind: 'count', equals: 5 },
      { act: 'assert', frame: 'wheel', selector: '[data-pack-phase="IDLE"]', kind: 'visible', equals: true },
      { act: 'assert', frame: 'wheel', selector: '#wfGo[data-go]', kind: 'visible', equals: true }
    ]
  });
}

fs.writeFileSync(path, JSON.stringify(suite, null, 2) + '\n', 'utf8');
console.log('SUITE_OK', JSON.stringify({ inserted, cases: suite.cases.length }));
