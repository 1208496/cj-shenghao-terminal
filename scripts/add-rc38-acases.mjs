// rc.38 A 档补测：把「点下去之后」的行为断掉（之前只有存在性断言）。
import fs from 'node:fs';

const path = 'suites/shenghao-rc37.suite.json';
const suite = JSON.parse(fs.readFileSync(path, 'utf8'));
const has = (id) => suite.cases.some((c) => c.id === id);

if (!has('pack.full-flow')) {
  suite.cases.push({
    id: 'pack.full-flow',
    title: '星愿卡包全链路：确认 → 环绕 → 落台 → 撕开 → 全翻 → 收集',
    preset: 'three_cards',
    steps: [
      { act: 'expand' },
      { act: 'tab', tab: 'wheel' },
      { act: 'openWheel', type: 'pack' },
      { act: 'waitForEl', frame: 'wheel', selector: '#pkFloatArc', timeout: 8000 },
      { act: 'assert', frame: 'wheel', selector: '#pkFloatArc .pk-float-slot', kind: 'count', equals: 5 },
      { act: 'click', frame: 'wheel', selector: '#wfGo', settle: 400 },
      { act: 'waitForEl', frame: 'wheel', selector: '#wfConfirm.on', timeout: 5000 },
      { act: 'click', frame: 'wheel', selector: '[data-wf-confirm="ok"]', settle: 600 },
      { act: 'waitForEl', frame: 'wheel', selector: '#pkPack', timeout: 25000 },
      { act: 'click', frame: 'wheel', selector: '[data-quicktear]', settle: 900 },
      { act: 'waitForEl', frame: 'wheel', selector: '.pk-fan', timeout: 15000 },
      { act: 'assert', frame: 'wheel', selector: '.pk-slot', kind: 'count', equals: 3 },
      { act: 'click', frame: 'wheel', selector: '[data-revealall]', settle: 1400 },
      { act: 'assert', frame: 'wheel', selector: '.pk-slot.is-open', kind: 'count', equals: 3 },
      { act: 'click', frame: 'wheel', selector: '[data-collect]', settle: 900 },
      { act: 'assert', frame: 'wheel', selector: '#pkFloatArc', kind: 'count', equals: 1 },
      { act: 'assert', kind: 'lastOp', status: 'COMMITTED', type: 'PLAYER_PACK_DRAW' }
    ]
  });
}

if (!has('wheel.confirm-cancel')) {
  suite.cases.push({
    id: 'wheel.confirm-cancel',
    title: '确认弹窗点「再想想」：不落操作、不扣钱、不出结果',
    preset: 'empty_bag',
    steps: [
      { act: 'expand' },
      { act: 'tab', tab: 'wheel' },
      { act: 'openWheel', type: 'play' },
      { act: 'waitForEl', frame: 'wheel', selector: '#wfGo', timeout: 8000 },
      { act: 'assert', kind: 'pageProbe', probe: 'ops', equals: 0 },
      { act: 'click', frame: 'wheel', selector: '#wfGo', settle: 500 },
      { act: 'waitForEl', frame: 'wheel', selector: '#wfConfirm.on', timeout: 5000 },
      { act: 'assert', frame: 'wheel', selector: '[data-wf-confirm="cancel"]', kind: 'visible', equals: true },
      { act: 'click', frame: 'wheel', selector: '[data-wf-confirm="cancel"]', settle: 900 },
      { act: 'assert', frame: 'wheel', selector: '#wfConfirm.on', kind: 'count', equals: 0 },
      { act: 'assert', frame: 'wheel', selector: '#wfResult.on', kind: 'count', equals: 0 },
      { act: 'assert', kind: 'pageProbe', probe: 'ops', equals: 0 },
      { act: 'assert', kind: 'pageProbe', probe: 'revision', equals: 1 }
    ]
  });
}

if (!has('bag.use-to-input')) {
  suite.cases.push({
    id: 'bag.use-to-input',
    title: '背包：立即使用玩法券 / 使用奇物 → 引导词落进聊天输入框',
    preset: 'three_cards',
    steps: [
      { act: 'expand' },
      { act: 'tab', tab: 'wheel' },
      { act: 'click', frame: 'phone', selector: '[data-act="open-bag"]', settle: 900 },
      { act: 'waitForEl', frame: 'phone', selector: '[data-bag-tab="prizes"]', timeout: 8000 },
      { act: 'click', frame: 'phone', selector: '[data-bag-tab="prizes"]', settle: 500 },
      { act: 'click', frame: 'phone', selector: '[data-use-now="prize_1"]', settle: 700 },
      { act: 'waitForEl', frame: 'phone', selector: '[data-confirm-use-prize="prize_1"]', timeout: 8000 },
      { act: 'click', frame: 'phone', selector: '[data-confirm-use-prize="prize_1"]', settle: 1300 },
      { act: 'assert', frame: 'top', selector: '#send_textarea', kind: 'value', includes: '【使用玩法券：' },
      { act: 'assert', kind: 'lastOp', status: 'COMMITTED', type: 'PLAYER_USE_WHEEL_PRIZE' },
      { act: 'click', frame: 'phone', selector: '[data-bag-tab="surreal"]', settle: 600 },
      { act: 'click', frame: 'phone', selector: '[data-use-item="surreal_1"]', settle: 700 },
      { act: 'waitForEl', frame: 'phone', selector: '[data-confirm-use-item="surreal_1"]', timeout: 8000 },
      { act: 'click', frame: 'phone', selector: '[data-confirm-use-item="surreal_1"]', settle: 1300 },
      { act: 'assert', frame: 'top', selector: '#send_textarea', kind: 'value', includes: '【使用奇物：' },
      { act: 'assert', kind: 'lastOp', status: 'COMMITTED', type: 'PLAYER_USE_SURREAL_ITEM' }
    ]
  });
}

fs.writeFileSync(path, JSON.stringify(suite, null, 2) + '\n', 'utf8');
console.log('SUITE_OK cases=' + suite.cases.length + ' ids=' + suite.cases.map((c) => c.id).join(','));
