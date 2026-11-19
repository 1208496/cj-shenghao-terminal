import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tierOf,rankBySeed,pickAvatar,assignAll,findItem} from '../src/ui/avatar-pool.js';
import {INLINE_AVATAR_MANIFEST as BOOK} from '../src/ui/avatar-manifest.generated.js';

const tiers = BOOK.tiers;
const items = BOOK.items;

test('rc.31 tierOf 命中各档边界，分数无效时不配图', () => {
  // 按清单里的实际分区逐档校验（档位由 YG 的出图分组决定，不写死 19/20 这类数字）
  for (const tier of tiers) {
    assert.equal(tierOf(tier.min, tiers), tier.id, `${tier.min} 应落在 ${tier.id}`);
    assert.equal(tierOf(tier.max, tiers), tier.id, `${tier.max} 应落在 ${tier.id}`);
  }
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  assert.equal(sorted[0].min, 1, '最低档从 1 开始');
  assert.equal(sorted[sorted.length - 1].max, 100, '最高档到 100 结束');
  for (let i = 1; i < sorted.length; i += 1) {
    assert.equal(sorted[i].min, sorted[i - 1].max + 1, '分档必须连续不重不漏');
  }
  assert.equal(tierOf(null, tiers), null);
  assert.equal(tierOf(0, tiers), null);
  assert.equal(tierOf(undefined, tiers), null);
});

test('rc.31 同一人物在确定性哈希下始终拿到同一张图', () => {
  const a = pickAvatar({ cid: 'char_x', score: 82, tiers, items, takenBy: new Map(), chatSeed: 'init-1' });
  const b = pickAvatar({ cid: 'char_x', score: 82, tiers, items, takenBy: new Map(), chatSeed: 'init-1' });
  assert.equal(a.id, b.id);
  assert.equal(a.tier, 'b4');
  const other = pickAvatar({ cid: 'char_y', score: 82, tiers, items, takenBy: new Map(), chatSeed: 'init-1' });
  assert.notEqual(a.id, other.id, '同档不同人应拿到不同图');
});

test('rc.31 同档多人不撞图，超出档容量才降级', () => {
  const b4 = items.filter((it) => it.tier === 'b4' && !it.retired);
  assert.ok(b4.length >= 2);
  const taken = new Map();
  const assigned = [];
  const picked = [];
  for (let i = 0; i < b4.length; i += 1) {
    const r = pickAvatar({ cid: 'char_' + i, score: 80, tiers, items, takenBy: taken, chatSeed: 'init', assigned });
    picked.push(r.id);
    taken.set(r.id, (taken.get(r.id) || 0) + 1);
    assigned.push(r.id);
  }
  assert.equal(new Set(picked).size, b4.length, '档内人数不超过图数时不应撞图');

  const extra = pickAvatar({ cid: 'char_extra', score: 80, tiers, items, takenBy: taken, chatSeed: 'init', assigned });
  assert.equal(extra.fallback, true, '超出档容量应降级');
});

test('rc.31 本档用完借相邻档，全满时允许撞图并选占用最少的一张', () => {
  const b4 = items.filter((it) => it.tier === 'b4' && !it.retired);
  const taken = new Map(b4.map((it) => [it.id, 1]));
  const assigned = b4.map((it) => it.id);
  const near = pickAvatar({ cid: 'char_z', score: 80, tiers, items, takenBy: taken, chatSeed: 'init', assigned });
  assert.equal(near.fallback, true);
  assert.notEqual(near.tier, 'b4');

  const allIds = items.filter((it) => !it.retired).map((it) => it.id);
  const full = new Map(allIds.map((id) => [id, 1]));
  const collide = pickAvatar({ cid: 'char_z', score: 80, tiers, items, takenBy: full, chatSeed: 'init', assigned: allIds });
  assert.equal(collide.collide, true);
  assert.ok(allIds.includes(collide.id));
});

test('rc.31 清单为空或分数缺失时返回 null（继续显示姓名首字）', () => {
  assert.equal(pickAvatar({ cid: 'c', score: 80, tiers, items: [], takenBy: new Map() }), null);
  assert.equal(pickAvatar({ cid: 'c', score: null, tiers, items, takenBy: new Map() }), null);
});

test('rc.31 assignAll 保留已有 avatarRef，新人物排在后面且不挤掉老人物', () => {
  const chars = {
    char_a: { id: 'char_a', beautyScore: 80, avatarRef: 'b4-0001', trackingState: 'RECORDED' },
    char_b: { id: 'char_b', beautyScore: 81, avatarRef: null, trackingState: 'RECORDED' },
    char_c: { id: 'char_c', beautyScore: 79, avatarRef: null, trackingState: 'RECORDED' },
  };
  const assign = assignAll(chars, { tiers, items, chatSeed: 'init' });
  assert.equal(assign.char_a, undefined, '已有头像的人不重算');
  assert.ok(assign.char_b && assign.char_b !== 'b4-0001');
  assert.ok(assign.char_c && assign.char_c !== assign.char_b && assign.char_c !== 'b4-0001');
});

test('rc.31 档内加图后只有少数人换图（HRW 的稳定性）', () => {
  const pool = items.filter((it) => it.tier === 'b3');
  const grown = items.concat([{ id: 'b3-9001', tier: 'b3', file: 'b3/b3-9001.webp', bytes: 1, sha256: 'x', retired: false }]);
  const grownPool = grown.filter((it) => it.tier === 'b3');
  let changed = 0;
  const N = 60;
  for (let i = 0; i < N; i += 1) {
    const before = rankBySeed(pool, 'seed' + i)[0].id;
    const after = rankBySeed(grownPool, 'seed' + i)[0].id;
    if (after !== before) changed += 1;
  }
  const ratio = changed / N;
  assert.ok(ratio <= 0.4, '加一张图影响面应接近 1/(n+1)，实际 ' + (ratio * 100).toFixed(0) + '%');
});

test('rc.31 内联清单结构与 findItem', () => {
  assert.equal(BOOK.schema, 1);
  assert.ok(BOOK.tiers.length >= 5);
  assert.ok(BOOK.items.length >= 10);
  const first = BOOK.items[0];
  assert.ok(first.data && first.data.startsWith('data:image/webp;base64,'), '前几张应自带 data URL 兜底');
  assert.equal(findItem(BOOK.items, first.id).file, first.file);
  assert.equal(findItem(BOOK.items, 'not-exist'), null);
});

// rc.31b：内联清单必须是**全量**条目。只内联每档两张时，同档第 3 个人会被推到隔壁档
// （实机证据：88 分拿到 b5-0002）。这里直接拿 assets/avatars/manifest.json 对账。
test('rc.31b 内联清单与远程清单张数一致（不再每档只内联两张）', () => {
  const remote = JSON.parse(fs.readFileSync(new URL('../assets/avatars/manifest.json', import.meta.url), 'utf8'));
  const liveRemote = remote.items.filter((it) => !it.retired);
  assert.equal(BOOK.items.length, liveRemote.length, '内联条目数应等于清单总数');
  const count = (list) => list.reduce((acc, it) => ({ ...acc, [it.tier]: (acc[it.tier] || 0) + 1 }), {});
  assert.deepEqual(count(BOOK.items), count(liveRemote), '每档内联张数应等于清单张数');
  assert.deepEqual(BOOK.tiers, remote.tiers, '档位区间应与清单一致');
});

// rc.31b 回归：同一档第 3 个人也必须留在本档（之前跨到相邻档）
test('rc.31b 同档第 3 人仍留在本档，不跨档', () => {
  for (const score of [30, 60, 75, 85, 95]) {
    const tier = tierOf(score, tiers);
    const taken = new Map();
    const assigned = [];
    for (let i = 0; i < 3; i += 1) {
      const r = pickAvatar({ cid: 'same_tier_' + score + '_' + i, score, tiers, items, takenBy: taken, chatSeed: 'cfg', assigned });
      assert.ok(r, '应能分到图');
      assert.equal(r.tier, tier, `${score} 分的第 ${i + 1} 个人应仍在 ${tier}，实际 ${r.tier}`);
      taken.set(r.id, (taken.get(r.id) || 0) + 1);
      assigned.push(r.id);
    }
  }
});

test('rc.31b resolvedManifest 优先远程/缓存，缓存键不再吃旧版本', async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  store.set('cj-shenghao:avatar-manifest:v2', JSON.stringify({ schema: 1, tiers, items: items.slice(0, 4) }));
  const mod = await import('../src/runtime/avatar-manifest.js');
  mod.dropLegacyCaches();
  assert.equal(store.has('cj-shenghao:avatar-manifest:v2'), false, '旧 v2 缓存应被清掉');
  const fresh = { schema: 1, version: 'x', assetRef: 'y', basePath: 'assets/avatars', tiers, items: items.slice(0, 6) };
  mod.rememberManifest(fresh);
  assert.equal(mod.resolvedManifest().items.length, 6, '有缓存时用缓存');
  delete globalThis.localStorage;
});


test('rc.32 关闭随机头像再打开不洗掉已配结果（assignAll 保留已有 avatarRef）', () => {
  const existing = items[0].id;
  const chars = {
    a: { id: 'a', beautyScore: 60, avatarRef: existing },
    b: { id: 'b', beautyScore: 60 },
  };
  const assigned = assignAll(chars, { tiers, items, chatSeed: 'rc32-seed' });
  assert.equal(assigned.a, undefined, '已配图的人不重抽');
  assert.equal(chars.a.avatarRef, existing, '已写入的 avatarRef 不被覆盖');
  assert.ok(assigned.b, '新人物仍会按颜值档配图');
  assert.notEqual(assigned.b, existing, '不得与已占用的图撞车');
  assert.ok(findItem(items, assigned.b), '配到的是清单里的真实图片');
});
