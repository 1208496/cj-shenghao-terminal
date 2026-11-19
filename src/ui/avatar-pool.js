// rc.31：随机头像的选档 / 档内挑选 / 防撞 / 兜底（纯函数，无副作用，便于单测）
// 规则见 AGY_AVATAR_OPTIONS.md §1.5：确定性 HRW 选图，写入 avatarRef 后固定。

const FNV_OFFSET = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;

// FNV-1a 的雪崩不足：id 只差一两位时哈希大小会系统性偏斜，导致「加一张图」时
// 替换率远高于 1/(n+1)。末尾补一次 splitmix64 混合把相近输入彻底打散。
function mix64(h) {
  let x = BigInt.asUintN(64, h);
  x ^= x >> 30n;
  x = BigInt.asUintN(64, x * 0xbf58476d1ce4e5b9n);
  x ^= x >> 27n;
  x = BigInt.asUintN(64, x * 0x94d049bb133111ebn);
  x ^= x >> 31n;
  return BigInt.asUintN(64, x);
}

export function fnv64(value) {
  let h = FNV_OFFSET;
  for (const ch of String(value ?? '')) {
    h ^= BigInt(ch.codePointAt(0));
    h = BigInt.asUintN(64, h * FNV_PRIME);
  }
  return mix64(h).toString(16).padStart(16, '0');
}

// 分数落在哪一档；分数无效时返回 null（不配图，继续显示首字）。
export function tierOf(score, tiers) {
  const n = Number(score);
  if (!Number.isFinite(n) || n <= 0 || !Array.isArray(tiers)) return null;
  for (const tier of tiers) {
    if (n >= tier.min && n <= tier.max) return tier.id;
  }
  return null;
}

const liveItems = (items) => (Array.isArray(items) ? items.filter((it) => it && !it.retired) : []);

// 双向哈希拼接，抵消单个 FNV 在相似输入上的相关性，保证加图时替换率接近 1/(n+1)。
function weightOf(seed, id) {
  return fnv64(`${seed}:${id}`) + fnv64(`${id}#${seed}`);
}

// 档内按 HRW 排序：hash(seed:itemId) 越大越优先。加图时只有新图分数更高的少数人会换。
export function rankBySeed(items, seed) {
  return liveItems(items)
    .map((it) => ({ item: it, weight: weightOf(seed, it.id) }))
    .sort((a, b) => (a.weight === b.weight ? String(a.item.id).localeCompare(String(b.item.id)) : a.weight > b.weight ? -1 : 1))
    .map((row) => row.item);
}

// 相邻档：优先离她分数更近的一侧（§1.5 第 1 条）。
function neighborTiers(currentTierId, tiers, score) {
  const order = [...(tiers || [])].sort((a, b) => a.min - b.min);
  const index = order.findIndex((t) => t.id === currentTierId);
  if (index < 0) return [];
  const distance = (t) => (score < t.min ? t.min - score : score > t.max ? score - t.max : 0);
  return order.filter((t) => t.id !== currentTierId).sort((a, b) => distance(a) - distance(b));
}

// 主入口：给一个人物挑一张图。
// 返回 { id, tier, fallback } 或 null（清单为空 / 分数无效）。
// takenBy: Map<itemId, count>，本局已占用的图片数量；exclude: 本局其他人的 avatarRef 集合。
export function pickAvatar({ cid, score, tiers, items, takenBy, chatSeed = '', assigned = [] }) {
  const live = liveItems(items);
  if (!live.length) return null;
  const seed = `${chatSeed}:${cid}`;
  const tierId = tierOf(score, tiers);
  if (!tierId) return null;

  const taken = takenBy instanceof Map ? takenBy : new Map();
  const used = new Set(assigned.filter(Boolean));
  const inTier = (id) => live.filter((it) => it.tier === id);

  // 1) 本档：跳过已被别人占用的
  for (const item of rankBySeed(inTier(tierId), seed)) {
    if (!used.has(item.id)) return { id: item.id, tier: tierId, fallback: false };
  }
  // 2) 相邻档（由近到远）
  for (const tier of neighborTiers(tierId, tiers, Number(score))) {
    for (const item of rankBySeed(inTier(tier.id), seed)) {
      if (!used.has(item.id)) return { id: item.id, tier: tier.id, fallback: true };
    }
  }
  // 3) 全满：允许撞图，选本档里被占用次数最少的那张
  const own = rankBySeed(inTier(tierId), seed);
  const pool = own.length ? own : rankBySeed(live, seed);
  if (!pool.length) return null;
  const least = pool
    .map((item) => ({ item, count: taken.get(item.id) || 0 }))
    .sort((a, b) => a.count - b.count)[0];
  return { id: least.item.id, tier: least.item.tier, fallback: true, collide: true };
}

// 一次性给全人物分配（按建档先后稳定排序，新人物排最后，不会挤掉老人物）。
export function assignAll(characters, { tiers, items, chatSeed = '' }) {
  const list = Object.values(characters || {}).filter((c) => c && c.trackingState !== 'DELETED');
  const takenBy = new Map();
  const result = {};
  const assigned = [];
  for (const c of list) {
    if (c.avatarRef) {
      takenBy.set(c.avatarRef, (takenBy.get(c.avatarRef) || 0) + 1);
      assigned.push(c.avatarRef);
    }
  }
  for (const c of list) {
    if (c.avatarRef) continue;
    const picked = pickAvatar({ cid: c.id, score: c.beautyScore, tiers, items, takenBy, chatSeed, assigned });
    if (!picked) continue;
    result[c.id] = picked.id;
    takenBy.set(picked.id, (takenBy.get(picked.id) || 0) + 1);
    assigned.push(picked.id);
  }
  return result;
}

export function findItem(items, id) {
  return (items || []).find((it) => it && it.id === id) || null;
}


