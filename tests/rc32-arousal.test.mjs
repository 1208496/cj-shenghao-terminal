import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {arousalGuard} from '../src/runtime/settlement.js';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('rc.32 情欲值：正戏轮拉到几乎满，模型写得更高则保留', () => {
  assert.equal(arousalGuard({prior: 20, current: 60, behaviorText: '实战插入', score: 92, body: '进入正戏'}), 88);
  assert.equal(arousalGuard({prior: 20, current: 95, behaviorText: '实战插入', score: 92}), 95);
});

test('rc.32 情欲值：事后轮必须大幅回落，模型已降到位则保留', () => {
  assert.equal(arousalGuard({prior: 92, current: 92, last: '当晚交欢', lastChanged: false, score: 0, body: '事后相拥而眠'}), 12);
  assert.equal(arousalGuard({prior: 92, current: 10, score: 0, body: '事后平复'}), 10);
});

test('rc.32 情欲值：玩家要求再来一次时回补到 72 以上', () => {
  assert.equal(arousalGuard({prior: 92, current: 12, behaviorText: '再来一次', score: 92, body: '她拉住你衣角说再来一次'}), 72);
  assert.equal(arousalGuard({prior: 92, current: 80, behaviorText: '再来一次', score: 92}), 80);
});

test('rc.32 情欲值：普通日常轮自然回落 20 点，不越界', () => {
  assert.equal(arousalGuard({prior: 40, current: 40, score: 30, body: '普通寒暄'}), 20);
  assert.equal(arousalGuard({prior: 5, current: 5, score: 30, body: '普通寒暄'}), 0);
  assert.equal(arousalGuard({prior: 0, current: 0}), 0);
});

test('rc.32 情欲值：60 分以上破防轮不触发日常回落', () => {
  assert.equal(arousalGuard({prior: 40, current: 40, score: 70, body: '帮她解围'}), 40);
});

test('rc.32 文案已逐字落地（协议五段 / 世界书新增段 / 界面改名 / 状态说明）', () => {
  const protocol = read('src/content/protocol.txt');
  assert(protocol.includes('日常平淡0–15、心猿意马被撩动25–55、脱衣前戏升温55–80、正戏交欢85–100'), '协议五段锚点缺失');
  assert(protocol.includes('事后温存退潮示例'), '协议事后示例缺失');

  const literary = JSON.parse(read('src/content/literary.json'));
  const body = literary.entries.find(e => e.id === 'private-life').body;
  assert(!body.includes('【情欲值（arousal）的五段反应与事后退潮】'), '评审要求撤销的五段反应段不得存在于世界书');
  assert(body.includes('高冷者的咬唇隐忍与溃堤哭腔'), '原性格区分写法必须保留');

  const stateCtx = read('src/content/state-context.txt');
  assert(!stateCtx.includes('情欲值（arousal）'), '评审要求撤销的重复定义不得存在于状态说明');

  const screens = read('src/ui/screens.js');
  assert(!screens.includes('情动度'), '界面仍有旧文案「情动度」');
  assert(!screens.includes('🌡️ 情动 '), '界面仍有旧文案「情动」');
  assert(screens.includes('🌡️ 情欲值：'), '界面未改名为情欲值');
});
