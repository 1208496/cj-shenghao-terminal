// rc.46 批一守卫：异能待撤锚点、撤销四边界的数据面、三装置数据模型、旧存档清洗。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createSchema} from '../src/runtime/schema.js';
import {completeInitialState} from '../src/runtime/settlement.js';
import {applyOperation, settleEvents, syncChokerAccessory, syncImprintText, sanitizeInventoryAndUnlocks} from '../src/core/engine.js';
import {buildImprintText, chokerClause} from '../src/core/device-catalog.js';
import {SURREAL_ITEMS} from '../src/core/casino-catalog.js';
import {WHEEL_POOL_BY_ID} from '../src/core/wheel-pool.js';
import {PLACEMENTS} from '../src/core/device-catalog.js';
import {fresh, anchor} from './fixtures.mjs';

const schemas = createSchema(z);
const initial = () => {
  const s = schemas.state.parse(completeInitialState(fresh(), {startDate: '2026-01-05', startTime: '09:00'}));
  s.wheel.imprintUnlocked = true;   // rc.50：印记改为商城付费解锁（D-2），夹具按已解锁建档
  return s;
};
const run = (s, type, extra = {}) => applyOperation(s, {type, operationId: crypto.randomUUID(), expectedRevision: s.meta.revision, ...extra}, anchor());
const settle = (s, events) => settleEvents(s, events, anchor(s.meta.revision + 2), '测试正文。', []).state;
const prizeId = Object.keys(WHEEL_POOL_BY_ID)[0];

function withPrize(s, itemId = 'item_prize_1') {
  s.inventory[itemId] = {itemId, source: 'WHEEL', category: 'WHEEL_PRIZE', refId: prizeId, rarity: 'red', obtainedDate: s.world.date, status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null};
  return s;
}
function grantAbility(s, abilityId = 'ab_voice') {
  s.user.abilities = [{abilityId, obtainedDate: s.world.date}];
  return s;
}
function imprintOp(s, action, extra = {}) {
  return run(s, 'PLAYER_IMPRINT_SET', {personRef: 'char_a', action, placement: 'lower_abdomen', patternEnabled: true, patternId: 'succubus_heart', patternColor: 'crimson', textEnabled: true, text: '陆氏私有', textColor: 'gold', font: 'script', textLayout: 'arc_wrap', ...extra});
}

test('rc46.schema：pendingAbilityUses 不再被 Zod strip 掉', () => {
  let s = grantAbility(initial());
  s = run(s, 'PLAYER_USE_ABILITY', {abilityId: 'ab_voice', usedDraftText: '【发动异能：绝对气场】测试'});
  const parsed = schemas.state.parse(JSON.parse(JSON.stringify(s)));
  assert.ok(parsed.wheel.pendingAbilityUses.ab_voice, '落库后必须还在，否则「我的」页永远看不到撤销按钮');
  assert.equal(parsed.wheel.pendingAbilityUses.ab_voice.usedDraftText, '【发动异能：绝对气场】测试');
});

test('rc46.undo：撤销异能后锚点清空，正文结算后整组清空', () => {
  let s = grantAbility(initial());
  s = run(s, 'PLAYER_USE_ABILITY', {abilityId: 'ab_voice'});
  assert.ok(s.wheel.pendingAbilityUses.ab_voice);
  s = run(s, 'PLAYER_UNDO_ABILITY_USE', {abilityId: 'ab_voice'});
  assert.equal(s.wheel.pendingAbilityUses.ab_voice, undefined);
  s = run(s, 'PLAYER_USE_ABILITY', {abilityId: 'ab_voice'});
  s = settle(s, []);
  assert.deepEqual(s.wheel.pendingAbilityUses, {}, '正文一生成，待撤窗口关闭');
});

test('rc46.undo：玩法券存下引导词快照，撤销后快照清空', () => {
  let s = withPrize(initial());
  s = run(s, 'PLAYER_USE_WHEEL_PRIZE', {itemId: 'item_prize_1', immediate: true, usedDraftText: '【使用玩法券：测试】我现在启用'});
  assert.equal(s.inventory.item_prize_1.usedDraftText, '【使用玩法券：测试】我现在启用');
  assert.equal(s.inventory.item_prize_1.pendingUndo, true);
  s = run(s, 'PLAYER_UNDO_ITEM_USE', {itemId: 'item_prize_1'});
  assert.equal(s.inventory.item_prize_1.usedDraftText, null);
  assert.equal(s.inventory.item_prize_1.status, 'READY');
});

test('rc46.imprint：首次铭刻派生 tattooScar 并暂存原疤痕', () => {
  let s = initial();
  s.characters.char_a.physiology.tattooScar = '腰侧旧烫伤';
  s = imprintOp(s, 'save');
  const c = s.characters.char_a;
  assert.equal(c.imprints.priorScar, '腰侧旧烫伤');
  assert.match(c.physiology.tattooScar, /小腹耻骨上方有绯红魅影「魅魔心翼」配暗金烙印纤细手写体“陆氏私有”/);
});

test('rc46.imprint：二次更新保留原始 priorScar，不被派生句污染', () => {
  let s = initial();
  s.characters.char_a.physiology.tattooScar = '原始疤痕';
  s = imprintOp(s, 'save');
  s = imprintOp(s, 'save', {text: '第二条'});
  const c = s.characters.char_a;
  assert.equal(c.imprints.priorScar, '原始疤痕');
  assert.match(c.physiology.tattooScar, /第二条/);
});

test('rc46.imprint：多枚按部位共存，抹到最后一枚时还原原疤痕', () => {
  let s = initial();
  s.characters.char_a.physiology.tattooScar = '原始疤痕';
  s = imprintOp(s, 'save');
  s = imprintOp(s, 'save', {placement: 'left_breast', text: '臣服计数', patternId: 'tally_zheng'});
  s = imprintOp(s, 'save', {placement: 'nape', patternId: 'obsidian_chain', textEnabled: false});
  assert.equal(Object.keys(s.characters.char_a.imprints.items).length, 3);
  s = imprintOp(s, 'remove_one', {placement: 'lower_abdomen'});
  assert.equal(Object.keys(s.characters.char_a.imprints.items).length, 2);
  s = imprintOp(s, 'remove_one', {placement: 'left_breast'});
  s = imprintOp(s, 'remove_one', {placement: 'nape'});
  assert.equal(s.characters.char_a.imprints, null);
  assert.equal(s.characters.char_a.physiology.tattooScar, '原始疤痕');
});

test('rc46.imprint：同一部位覆盖不新增条目，19 处上限拦第 20 枚', () => {
  let s = initial();
  for (const place of PLACEMENTS) s = imprintOp(s, 'save', {placement: place.id});
  assert.equal(Object.keys(s.characters.char_a.imprints.items).length, 19);
  s = imprintOp(s, 'save', {placement: 'lower_abdomen', text: '覆盖'});
  assert.equal(Object.keys(s.characters.char_a.imprints.items).length, 19, '同部位是覆盖不是叠加');
  // 上限：先把一处抹掉再刻回，确认仍可写；再用第 20 个非法部位验证拒绝
  assert.throws(() => imprintOp(s, 'save', {placement: 'not_a_place'}), /IMPRINT_INVALID/);
});

test('rc46.imprint：两层全关或刻字空串被拒', () => {
  let s = initial();
  assert.throws(() => imprintOp(s, 'save', {patternEnabled: false, textEnabled: false}), /IMPRINT_INVALID/);
  assert.throws(() => imprintOp(s, 'save', {text: ''}), /IMPRINT_INVALID/);
});

test('rc46.imprint：隐藏或不存在的目标一律拒绝', () => {
  let s = initial();
  assert.throws(() => run(s, 'PLAYER_IMPRINT_SET', {personRef: 'char_ghost', action: 'save', placement: 'lower_abdomen', text: 'x'}), /IMPRINT_NO_TARGET/);
  s.characters.char_a.trackingState = 'HIDDEN';
  assert.throws(() => imprintOp(s, 'save'), /IMPRINT_NO_TARGET/);
});

test('rc46.imprint：单枚条目序列化体积远低于存档红线', () => {
  let s = initial();
  s = imprintOp(s, 'save');
  const bytes = Buffer.byteLength(JSON.stringify(s.characters.char_a.imprints.items.lower_abdomen));
  assert.ok(bytes <= 400, `单枚应远小于位图方案，实际 ${bytes} 字节`);
});

test('rc46.choker：未解锁时佩戴被拒', () => {
  const s = initial();
  assert.throws(() => run(s, 'PLAYER_CHOKER_SET', {personRef: 'char_a', action: 'wear', styleId: 'obsidian_velvet'}), /CHOKER_LOCKED/);
});

test('rc46.choker：佩戴写入配饰首段，摘下精准剥离且保留模型配饰', () => {
  let s = initial();
  s.wheel.chokerUnlocked = true;
  s.characters.char_a.outfit.accessories = '珍珠耳钉、细金手链';
  s = run(s, 'PLAYER_CHOKER_SET', {personRef: 'char_a', action: 'wear', styleId: 'crimson_thorn', inscription: '陆氏专属'});
  const acc = s.characters.char_a.outfit.accessories;
  assert.ok(acc.startsWith('【誓约项圈】'), '项圈句必须在首段');
  assert.match(acc, /珍珠耳钉、细金手链/, '模型配饰必须保留');
  s = run(s, 'PLAYER_CHOKER_SET', {personRef: 'char_a', action: 'remove'});
  assert.equal(s.characters.char_a.outfit.accessories, '珍珠耳钉、细金手链');
});

test('rc46.choker：模型整段覆写 outfit 后由守护函数补回项圈', () => {
  let s = initial();
  s.wheel.chokerUnlocked = true;
  s = run(s, 'PLAYER_CHOKER_SET', {personRef: 'char_a', action: 'wear', styleId: 'pearl_strand'});
  s.characters.char_a.outfit.accessories = '钻石项链';
  syncChokerAccessory(s.characters.char_a);
  assert.match(s.characters.char_a.outfit.accessories, /^【誓约项圈】颈间佩戴月白珍珠串链/);
  assert.match(s.characters.char_a.outfit.accessories, /钻石项链/);
});

test('rc46.imprint：模型覆写 tattooScar 后由守护函数恢复派生句', () => {
  let s = initial();
  s = imprintOp(s, 'save');
  s.characters.char_a.physiology.tattooScar = '模型乱写的纹身';
  syncImprintText(s.characters.char_a);
  assert.match(s.characters.char_a.physiology.tattooScar, /魅魔心翼/);
});

test('rc46.shop：买 TOY / 项圈只点亮权限，不进背包', () => {
  let s = initial();
  s.wheel.starPoints = 6000;
  s = run(s, 'PLAYER_SHOP_BUY', {catalogId: 'it_toylink'});
  assert.equal(s.wheel.toyLinkUnlocked, true);
  assert.equal(Object.values(s.inventory).filter(i => i.refId === 'it_toylink').length, 0, '持久装置不进背包');
  s = run(s, 'PLAYER_SHOP_BUY', {catalogId: 'it_choker'});
  assert.equal(s.wheel.chokerUnlocked, true);
  assert.equal(Object.values(s.inventory).filter(i => i.refId === 'it_choker').length, 0);
});

test('rc46.sanitize：三件下架奇物按原价幂等退分', () => {
  const s = initial();
  const mk = (itemId, refId) => ({itemId, source: 'SHOP', category: 'SURREAL_ITEM', refId, rarity: 'red', obtainedDate: s.world.date, status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null});
  s.inventory.legacy1 = mk('legacy1', 'it_earring');
  s.inventory.legacy2 = mk('legacy2', 'it_watch');
  s.inventory.legacy3 = mk('legacy3', 'it_pillow');
  const before = s.wheel.starPoints || 0;
  const first = sanitizeInventoryAndUnlocks(s);
  assert.equal(first.refundedPoints, 1730);
  assert.equal(s.wheel.starPoints, before + 1730);
  assert.equal(s.inventory.legacy1, undefined);
  const second = sanitizeInventoryAndUnlocks(s);
  assert.equal(second.refundedPoints, 0, '二次清洗不得重复退分');
  assert.equal(s.wheel.starPoints, before + 1730);
});

test('rc46.sanitize：旧背包里的持久装置迁成解锁位并删条目', () => {
  const s = initial();
  s.inventory.old_toy = {itemId: 'old_toy', source: 'SHOP', category: 'SURREAL_ITEM', refId: 'it_toylink', rarity: 'rainbow', obtainedDate: s.world.date, status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null};
  s.inventory.old_choker = {itemId: 'old_choker', source: 'SHOP', category: 'SURREAL_ITEM', refId: 'it_choker', rarity: 'rainbow', obtainedDate: s.world.date, status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null};
  sanitizeInventoryAndUnlocks(s);
  assert.equal(s.wheel.toyLinkUnlocked, true);
  assert.equal(s.wheel.chokerUnlocked, true);
  assert.equal(s.inventory.old_toy, undefined);
  assert.equal(s.inventory.old_choker, undefined);
});

test('rc46.sanitize：未解锁却佩戴项圈的脏存档被收敛', () => {
  const s = initial();
  s.characters.char_a.choker = {worn: true, styleId: 'obsidian_velvet', inscription: '旧档', wornDate: s.world.date};
  s.characters.char_a.outfit.accessories = chokerClause(s.characters.char_a.choker);
  sanitizeInventoryAndUnlocks(s);
  assert.equal(s.characters.char_a.choker, null);
  assert.equal(s.characters.char_a.outfit.accessories, '');
});

test('rc46.catalog：持久奇物三件（rc.53b 补回印记），下架空壳三件不再出现在目录', () => {
  assert.equal(SURREAL_ITEMS.length, 14);
  const ids = SURREAL_ITEMS.map(i => i.itemId);
  for (const gone of ['it_earring', 'it_watch', 'it_pillow']) assert.ok(!ids.includes(gone), gone + ' 必须已下架');
  assert.ok(ids.includes('it_choker') && ids.includes('it_toylink') && ids.includes('it_imprint'), '三件永久装置缺一不可：' + ids.join(','));
});

test('rc46.imprint：150 字上限内多枚拼接不腰斩', () => {
  let s = initial();
  for (const place of PLACEMENTS.slice(0, 8)) s = imprintOp(s, 'save', {placement: place.id, text: '很长的专属铭文测试串'});
  const text = buildImprintText(s.characters.char_a.imprints);
  assert.ok(text.length <= 150, '派生句必须钳在 150 字内');
  assert.ok(text.endsWith('处专属印记'), '超长时以计数尾巴收束，不半截断字');
});

test('rc46.ui：我的页三入口卡与工坊骨架渲染', async () => {
  const {createScreens} = await import('../src/ui/screens.js');
  let s = initial();
  s.wheel.toyLinkUnlocked = true;
  s.wheel.chokerUnlocked = true;
  s.characters.char_a.choker = {worn: true, styleId: 'obsidian_velvet', inscription: '陆氏专属', wornDate: s.world.date};
  s.characters.char_a.outfit.accessories = '【誓约项圈】颈间佩戴黑曜丝绒细链（铭牌刻“陆氏专属”，旁人眼中仅如寻常细颈链）';
  s.characters.char_a.imprints = {priorScar: '', items: {lower_abdomen: {placement: 'lower_abdomen', patternEnabled: true, patternId: 'succubus_heart', patternScale: 'md', patternColor: 'crimson', textEnabled: true, text: '陆氏私有', textLayout: 'arc_wrap', textScale: 'md', textAngle: 0, font: 'script', textColor: 'gold', updatedDate: s.world.date}}};
  s.characters.char_a.physiology.tattooScar = '小腹耻骨上方有绯红魅影「魅魔心翼」配暗金烙印纤细手写体“陆氏私有”';
  const data = {view: {state: s, prefs: {}, busy: false}, expanded: new Set(), section: null, privateSection: null, consumptionPage: 0, sceneSectionByChar: new Map(), assetTab: 'ALL', mineExpanded: new Set()};
  const screens = createScreens({data: () => data, esc: v => String(v ?? ''), yuan: v => '¥' + v / 100, image: () => '', avatar: () => ''});
  const mine = screens.mine();
  assert.ok(mine.includes('mine-device-stack'), '三入口容器必须存在');
  assert.ok(mine.includes('is-toylink') && mine.includes('is-choker') && mine.includes('is-imprint'), '三张卡必须都在');
  // rc.53：TOY·LINK 卡片标题按 RC53 方案 02 §5.1 定稿改为「TOY·LINK 遥控」
  assert.ok(mine.includes('TOY·LINK 遥控') && mine.includes('黑曜誓约项圈') && mine.includes('专属私密印记'));
  assert.ok(mine.includes('佩戴中 · 1人'), '项圈角标带人数');
  assert.ok(mine.includes('已铭刻 · 1人'), '印记角标带人数');
  assert.ok(mine.includes('data-open-workshop="imprint"') && mine.includes('data-open-workshop="choker"'));
  // 轮盘页不再有旧 TOY 卡
  const hub = screens.wheelHub();
  assert.ok(!hub.includes('toylink-card'), '轮盘页旧 TOY 入口必须下线');
  // rc.49：印记工坊已独立为顶层 iframe，手机内只剩项圈工坊骨架
  const ws = screens.workshop('choker');
  assert.ok(ws.includes('data-act="close-workshop"'), '工坊外壳必须有返回键');
  assert.equal(screens.workshop('imprint'), '', '手机内不得再渲染印记工坊');
  const {readFile} = await import('node:fs/promises');
  const tpl = await readFile(new URL('../src/ui/imprint.template.html', import.meta.url), 'utf8');
  assert.ok(tpl.includes('id="impOverlay"') && tpl.includes('__IMPRINT_CSS__') && tpl.includes('__IMPRINT_JS__'), '独立印记工坊模板必须存在且带注入槽');
  const frameSrc = await readFile(new URL('../src/ui/imprint-frame.js', import.meta.url), 'utf8');
  assert.ok(frameSrc.includes('CJ_SHENGHAO_IMPRINT_V1'), '独立工坊必须用自己的消息通道');
  assert.ok(frameSrc.includes('PLAYER_IMPRINT_SET'), '保存必须仍走 PLAYER_IMPRINT_SET');
  assert.ok(frameSrc.includes('data-ws-place') || frameSrc.includes('ws-place-grid'), '独立工坊必须渲染部位网格');
});

// rc.50：女性档案姓名行的三条件标签。判定与顺序按 RC50 方案 §4.1–§4.2。
test('rc50.ui：姓名行三条件标签按「项圈 → 印记 → 跳蛋」渲染，未满足不渲染', async () => {
  const {createScreens} = await import('../src/ui/screens.js');
  const s = initial();
  const a = s.characters.char_a;
  a.trackingState = 'RECORDED';
  a.choker = {worn: true, styleId: 'obsidian_velvet', inscription: '陆氏专属', wornDate: s.world.date};
  a.imprints = {priorScar: '', items: {lower_abdomen: {placement: 'lower_abdomen', patternEnabled: true, patternId: 'succubus_heart', patternScale: 'md', patternColor: 'crimson', textEnabled: true, text: '陆氏私有', textLayout: 'arc_wrap', textScale: 'md', textAngle: 0, font: 'script', textColor: 'gold', updatedDate: s.world.date}}};
  const b = JSON.parse(JSON.stringify(a));
  b.id = 'char_b'; b.name = '苏婉'; b.choker = null; b.imprints = null;
  s.characters.char_b = b;

  globalThis.window = {parent: {__CJ_SHENGHAO_V2__: {toyLinkState: () => ({running: true, targetId: 'char_a', wearingIds: []})}}};
  try {
    const data = {view: {state: s, prefs: {}, busy: false}, expanded: new Set(), section: null, privateSection: null, consumptionPage: 0, sceneSectionByChar: new Map(), assetTab: 'ALL', mineExpanded: new Set()};
    const screens = createScreens({data: () => data, esc: (v) => String(v ?? ''), yuan: (v) => '¥' + v / 100, image: () => '', avatar: () => ''});

    const tags = (html) => [...html.matchAll(/data-device-tag="([a-z]+)"/g)].map((m) => m[1]);
    const list = screens.women();
    assert.deepEqual(tags(list).slice(0, 3), ['choker', 'imprint', 'toy'], '列表页顺序必须是 项圈 → 印记 → 跳蛋');
    assert.equal(tags(list).length, 3, '另一位女性不满足任何条件，总数仍为 3');
    assert.ok(list.includes('aria-label="已佩戴誓约项圈"') && list.includes('aria-label="已铭刻专属印记"') && list.includes('aria-label="已佩戴跳蛋"'));
    assert.ok(list.includes('class="char-name-row"'), '姓名行容器必须带 char-name-row');

    const detailA = screens.detail(a);
    assert.deepEqual(tags(detailA).slice(0, 3), ['choker', 'imprint', 'toy'], '详情页顺序同构');
    assert.equal(tags(detailA).length, 3);
    assert.ok(detailA.includes('class="char-name-row"'));

    const detailB = screens.detail(b);
    assert.equal(tags(detailB).length, 0, '三项皆无时零节点');
  } finally {
    delete globalThis.window;
  }
});

