// 重写 scene.two-women：断言「此刻」页真的渲染两位在场人物，且没有重复/溢出。
import fs from 'node:fs';

const p = 'suites/shenghao-rc37.suite.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const c = j.cases.find((x) => x.id === 'scene.two-women');
c.steps = [
  { act: 'expand' },
  { act: 'tab', tab: 'scene' },
  { act: 'assert', selector: 'nav.bottom .tab[data-tab]', kind: 'count', equals: 5 },
  { act: 'assert', selector: '[data-expand]', kind: 'count', equals: 2 },
  { act: 'assert', kind: 'pageText', matches: '现场的她们[\\s\\S]{0,20}\\(2\\)' },
  { act: 'assert', kind: 'pageText', matches: '沈清弦' },
  { act: 'assert', kind: 'pageText', matches: '陆晚晴' },
  { act: 'assert', selector: '[data-expand]', kind: 'visible', equals: true }
];
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log('SCENE CASE OK');
