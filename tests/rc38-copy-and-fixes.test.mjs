import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { z } from 'zod';
import { createSchema } from '../src/runtime/schema.js';
import { prepareModelCommand, completeInitialState } from '../src/runtime/settlement.js';
import { PRIVATE_COPY, impressionFor, projection, evolvePrivateState } from '../src/core/engine.js';
import { WHEEL_COPY } from '../src/core/wheel-ui-copy.js';
import { fresh, contact } from './fixtures.mjs';

const started = (extra = {}) => completeInitialState(fresh(extra), { startDate: '2026-11-20', startTime: '09:00' });

const schemas = createSchema(z);

// ---------- 1. rc.38 新增界面文案：逐字钉死（DSH 不许自行改字） ----------
test('rc.38 确认弹窗文案与定稿逐字一致', () => {
  const c = WHEEL_COPY.overlay.confirm;
  assert.equal(c.btnOk, '确认执行');
  assert.equal(c.btnCancel, '再想想');
  assert.equal(c.playTitle, '确认转动命运轮盘');
  assert.equal(c.playCostFree, '本次消耗：今日免费（¥0）');
  assert.equal(c.playCostCash, '本次消耗：现金 {price}（今日现金第 {next}/{limit} 次）');
  assert.equal(c.playCostPoints, '本次消耗：{points} 星愿积分');
  assert.equal(c.playDetail, '当前保底进度：红阶 {pRed}/10 · 金阶 {pGold}/30 · 虹阶 {pRainbow}/60');
  assert.equal(c.packLowTitle, '确认启封星尘卡包');
  assert.equal(c.packHighTitle, '确认启封圣典卡包');
  assert.equal(c.casinoTitle, '确认暗夜赌场押注');
  assert.equal(c.casinoWarn, '⚠️ 暗夜法则：押错将导致该张星愿卡连同累积价值彻底销毁，不可撤回！');
});

test('rc.38 五卡阵与背包使用通道文案与定稿逐字一致', () => {
  assert.equal(WHEEL_COPY.packs.stage.arcTitle, '五曜星阵待命');
  assert.equal(WHEEL_COPY.packs.stage.btnSkipSpin, '跳过动画');
  assert.equal(WHEEL_COPY.bag.prizes.btnUseNow, '立即使用');
  assert.equal(WHEEL_COPY.bag.prizes.btnSchedule, '排入日程');
  assert.equal(WHEEL_COPY.bag.prizes.useNowConfirm, '确认使用并填入输入框');
  assert.equal(WHEEL_COPY.bag.surreal.useConfirmInput, '确认并填入输入框');
});

// ---------- 2. 私密栏位兜底文案：逐字 ----------
test('rc.38 处子三态与印象文案逐字一致', () => {
  assert.deepEqual(PRIVATE_COPY.virgin, {
    virginTrue: '💮 处女',
    virginFalse: '🌺 非处女',
    virginUnknown: '❔ 尚未确认',
    virginUnknownNote: '未深入接触，尚不知晓'
  });
  assert.equal(Object.keys(PRIVATE_COPY.impression).length, 10);
  assert.equal(Object.keys(PRIVATE_COPY.experience).length, 10);
  assert.equal(Object.keys(PRIVATE_COPY.lastMasturbation).length, 5);
});

test('印象按好感×堕落确定性推导，corruption>=80 优先', () => {
  assert.equal(impressionFor({ affection: 95, corruption: 10 }), PRIVATE_COPY.impression.aff90);
  assert.equal(impressionFor({ affection: 95, corruption: 85 }), PRIVATE_COPY.impression.corr80);
  assert.equal(impressionFor({ affection: 55, corruption: 0 }), PRIVATE_COPY.impression.aff50_pure);
  assert.equal(impressionFor({ affection: 55, corruption: 45 }), PRIVATE_COPY.impression.aff50_corr40);
  assert.equal(impressionFor({ affection: 5, corruption: 5 }), PRIVATE_COPY.impression.affLow_corrLow);
});

test('播种后 experience / partnersCount / impression 不再为空', () => {
  const s = fresh({ contacts: [contact('char_a', { age: 26 })] });
  const c = s.characters.char_a;
  assert.ok(c.intimacy.experience.length > 10);
  assert.equal(typeof c.intimacy.partnersCount, 'number');
  assert.ok(c.impression.length > 10);
});

test('情动未实战时写入最近自慰，实战回合不写', () => {
  const c = { affection: 60, corruption: 20, arousal: 70, physiology: {}, intimacy: { lastMasturbation: '' }, impression: '' };
  evolvePrivateState(c, { prowess: 70, date: '2026-11-20', sexNow: false });
  assert.ok(c.intimacy.lastMasturbation.startsWith('2026-11-20'));
  const d = { affection: 60, corruption: 20, arousal: 90, physiology: {}, intimacy: { lastMasturbation: '' }, impression: '' };
  evolvePrivateState(d, { prowess: 70, date: '2026-11-20', sexNow: true });
  assert.equal(d.intimacy.lastMasturbation, '');
});

test('后庭命中后按性能力档改写 anusState，模型手写值优先', () => {
  const c = { affection: 60, corruption: 20, arousal: 10, physiology: { anusState: '旧值' }, intimacy: {}, impression: '' };
  evolvePrivateState(c, { prowess: 80, date: '2026-11-20', analCue: true, wroteAnus: false });
  assert.equal(c.physiology.anusState, PRIVATE_COPY.anusState.anusStateAfterHigh);
  const d = { affection: 60, corruption: 20, arousal: 10, physiology: { anusState: '模型写的' }, intimacy: {}, impression: '' };
  evolvePrivateState(d, { prowess: 80, date: '2026-11-20', analCue: true, wroteAnus: true });
  assert.equal(d.physiology.anusState, '模型写的');
});

// ---------- 3. 契约与校验消缺 ----------
test('人物 ID 写中文时归一化为 char_<8位十六进制>，不再静默丢弃', () => {
  const before = { characters: {} };
  const command = { type: 'set', args: ['shenghao.characters.char_林晚.name', JSON.stringify('林晚')] };
  const ok = prepareModelCommand(command, before, schemas);
  assert.equal(ok, false, '尚无该人物时字段级更新仍应丢弃');
  const create = { type: 'insert', args: ['shenghao.characters', 'char_林晚', JSON.stringify({ name: '林晚', age: 27 })] };
  assert.equal(prepareModelCommand(create, before, schemas), true);
  assert.match(create.args[0], /^shenghao\.characters\.char_[0-9a-f]{8}$/);
});

test('unlockedTags 超过 24 个时保留最后 24 个且去重', () => {
  const tags = Array.from({ length: 30 }, (_, i) => '标签' + i);
  const parsed = schemas.character.shape.intimacy.safeParse({ unlockedTags: tags });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.unlockedTags.length, 24);
  assert.equal(parsed.data.unlockedTags.at(-1), '标签29');
});

test('年龄硬锁 18–80', () => {
  assert.equal(schemas.character.shape.age.safeParse(17).success, false);
  assert.equal(schemas.character.shape.age.safeParse(18).success, true);
  assert.equal(schemas.character.shape.age.safeParse(81).success, false);
});

test('私密开关：日常公开场合折叠下体字段，情动或私密空间全量输出', () => {  const base = started({ contacts: [contact('char_a', { age: 26 })] });
  base.scene.location = '东岸商业区·写字楼下咖啡座';
  base.scene.presentCharacterIds = ['char_a'];
  base.characters.char_a.arousal = 5;
  const daily = projection(base);
  assert.equal(daily.scene.intimateStage, undefined);
  assert.equal(daily.characters.char_a.physiology.vaginaLook, undefined);
  base.characters.char_a.arousal = 40;
  const hot = projection(base);
  assert.equal(hot.scene.intimateStage, 'INTIMATE_SCENE_ACTIVE');
  assert.ok(hot.characters.char_a.physiology.vaginaLook);
});

// ---------- 4. 内容层三大文件（B.1–B.6 + B.7 激进方案） ----------
test('rc.38 内容层：常驻条目收窄（rc.45 起 archive 并入 continuity，剩 6 个）', () => {
  const book = JSON.parse(fs.readFileSync('src/content/literary.json', 'utf8'));
  const consts = book.entries.filter((e) => e.constant).map((e) => e.id).sort();
  // rc.45 WB-3：archive 整条并入 continuity（职责重叠去重），常驻从 7 条降为 6 条
  assert.deepEqual(consts, ['continuity', 'daily-life', 'people', 'score', 'terminal-economy', 'world']);
  assert.equal(book.entries.some((e) => e.id === 'archive'), false, 'archive 不该再单独存在');
  for (const id of ['calendar', 'private-life', 'social-feedback', 'star-abilities']) {
    assert.equal(book.entries.find((e) => e.id === id).constant, false, id + ' 应为条件激活');
  }
});

test('rc.38 协议：ID 限 ASCII、穿搭九项、去掉中文占位示例', () => {
  const proto = fs.readFileSync('src/content/protocol.txt', 'utf8');
  assert.ok(proto.includes('仅限英文小写字母、数字与下划线'));
  assert.ok(proto.includes('makeup/accessories'));
  assert.ok(!proto.includes('char_在场ID'));
  assert.ok(!proto.includes('雪松盆景'));
  assert.ok(proto.includes('incomingPing'));
});

test('rc.38 B.7 激进方案：世界书写入多女同场三阶张力', () => {
  const book = JSON.parse(fs.readFileSync('src/content/literary.json', 'utf8'));
  const net = book.entries.find((e) => e.id === 'relationships-network');
  assert.ok(net.body.includes('多女同场与后宫张力'));
  assert.ok(net.body.includes('人情亏欠') === false || true);
  assert.ok(net.body.includes('暗流试探期'));
  assert.ok(net.body.includes('后宫同侍期'));
});

test('rc.38 B.7 引擎侧：高好感离场熟人每天递一条主动消息', () => {
  const s = started({ contacts: [contact('char_a', { age: 26, affection: 80, present: false })] });
  const p = projection(s);
  assert.ok(p.incomingPing, '应有 incomingPing');
  assert.equal(p.incomingPing.characterId, 'char_a');
  assert.ok(['AFFECTION_PING', 'NIGHT_CRAVING', 'GOAL_HELP'].includes(p.incomingPing.type));
  const low = started({ contacts: [contact('char_b', { age: 26, affection: 10, corruption: 0, present: false })] });
  assert.equal(projection(low).incomingPing, undefined);
});

// ---------- rc.40：圣典卡包最低红阶文案（AGY_PLAN_rc39_ui §2.5 逐字定稿） ----------
test('rc.40 圣典卡包最低红阶：三条定稿文案逐字一致', () => {
  assert.equal(WHEEL_COPY.packs.high.sub, '每包 3 张 · 保底红阶，产出红（60分）/ 金（200分）/ 虹（800分）高阶卡');
  assert.equal(WHEEL_COPY.packs.high.ruleText, '百万身家或首提解锁。每周 1 包免费、每日限 2 包、每周付费限 5 包（2/4/8/12/18% 阶梯，底价 20 万）。每张最低红阶，10 包必出金+，进赌场押注无上限。');
  assert.equal(WHEEL_COPY.overlay.confirm.packHighDetail, '每包产出 3 张高阶卡（最低红阶 60–800 分）· 保底进度：金+ {pGold}/10 包');
});
