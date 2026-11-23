// rc.46：三装置（专属印记 / 誓约项圈 / TOY·LINK 模块）的静态资料表。
// 文案逐字取自 rc.46 方案（4N §10.1–§10.3、§5.3、§5.4、§2.4），不得自行改写。
// 本文件只放数据与纯函数，不读状态、不写状态。

// ── 身体部位：19 处，5 组，左右成对 ─────────────────────────────
export const PLACEMENTS = [
  { id: 'lower_abdomen', group: 'chest_abdomen', name: '小腹 · 淫纹核心', short: '小腹', privacy: '私密 · 露脐或宽衣可见', anchor: '小腹耻骨上方' },
  { id: 'left_breast', group: 'chest_abdomen', name: '左胸 · 心口乳侧', short: '左胸', privacy: '极私密 · 褪去内衣可见', anchor: '左胸心口处' },
  { id: 'right_breast', group: 'chest_abdomen', name: '右胸 · 乳晕外缘', short: '右胸', privacy: '极私密 · 褪去内衣可见', anchor: '右胸乳侧处' },
  { id: 'lower_back', group: 'waist_glute', name: '后腰 · 尾椎腰窝', short: '后腰', privacy: '半私密 · 俯身或低腰可见', anchor: '后腰尾椎上方' },
  { id: 'left_glute', group: 'waist_glute', name: '左臀 · 臀峰弧线', short: '左臀', privacy: '极私密 · 褪去下装可见', anchor: '左臀弧面处' },
  { id: 'right_glute', group: 'waist_glute', name: '右臀 · 臀峰弧线', short: '右臀', privacy: '极私密 · 褪去下装可见', anchor: '右臀弧面处' },
  { id: 'clavicle', group: 'neck_shoulder', name: '锁骨 · 颈下胸上', short: '锁骨', privacy: '显露 · 日常领口隐约可见', anchor: '锁骨下沿' },
  { id: 'nape', group: 'neck_shoulder', name: '后颈 · 发际垂落', short: '后颈', privacy: '显露 · 挽发或身后拥抱可见', anchor: '后颈发际线下' },
  { id: 'scapula', group: 'neck_shoulder', name: '肩胛 · 蝶骨背影', short: '肩胛', privacy: '半私密 · 露背装或俯身可见', anchor: '背脊肩胛骨处' },
  { id: 'left_thigh_inner', group: 'lower_limb', name: '左大腿内侧 · 腿根', short: '左大腿内侧', privacy: '极私密 · 褪去下装或分腿可见', anchor: '左大腿内侧近根处' },
  { id: 'right_thigh_inner', group: 'lower_limb', name: '右大腿内侧 · 腿根', short: '右大腿内侧', privacy: '极私密 · 褪去下装或分腿可见', anchor: '右大腿内侧近根处' },
  { id: 'left_thigh_outer', group: 'lower_limb', name: '左大腿外侧 · 胯侧', short: '左大腿外侧', privacy: '私密 · 高叉裙摆或褪衣可见', anchor: '左大腿外侧中上段' },
  { id: 'right_thigh_outer', group: 'lower_limb', name: '右大腿外侧 · 胯侧', short: '右大腿外侧', privacy: '私密 · 高叉裙摆或褪衣可见', anchor: '右大腿外侧中上段' },
  { id: 'left_calf', group: 'lower_limb', name: '左小腿 · 脚踝肌理', short: '左小腿', privacy: '显露 · 着裙或丝袜隐约可见', anchor: '左小腿肚外侧' },
  { id: 'right_calf', group: 'lower_limb', name: '右小腿 · 脚踝肌理', short: '右小腿', privacy: '显露 · 着裙或丝袜隐约可见', anchor: '右小腿肚外侧' },
  { id: 'left_arm', group: 'upper_limb', name: '左臂 · 上臂内侧', short: '左臂', privacy: '半私密 · 无袖或抬臂可见', anchor: '左上臂内侧' },
  { id: 'right_arm', group: 'upper_limb', name: '右臂 · 上臂内侧', short: '右臂', privacy: '半私密 · 无袖或抬臂可见', anchor: '右上臂内侧' },
  { id: 'left_wrist', group: 'upper_limb', name: '左手腕 · 脉搏内侧', short: '左手腕', privacy: '显露 · 抬手挽袖清晰可见', anchor: '左手腕内侧脉搏处' },
  { id: 'right_wrist', group: 'upper_limb', name: '右手腕 · 脉搏内侧', short: '右手腕', privacy: '显露 · 抬手挽袖清晰可见', anchor: '右手腕内侧脉搏处' }
];

export const PLACEMENT_BY_ID = Object.fromEntries(PLACEMENTS.map(p => [p.id, p]));
export const PLACEMENT_IDS = PLACEMENTS.map(p => p.id);
export const PLACEMENT_GROUPS = [
  { id: 'chest_abdomen', label: '胸腹' },
  { id: 'waist_glute', label: '腰臀' },
  { id: 'neck_shoulder', label: '颈肩' },
  { id: 'lower_limb', label: '下肢' },
  { id: 'upper_limb', label: '上肢' }
];

// ── 纹样图腾：15 款（含「正」字图腾） ───────────────────────────
export const IMPRINT_PATTERNS = [
  { id: 'succubus_heart', name: '魅魔心翼', desc: '倒心羽翼环抱，经典淫纹核心' },
  { id: 'tally_zheng', name: '「正」字计数', desc: '五划正字铭刻，记下每一次臣服' },
  { id: 'thorn_crown', name: '荆棘冠冕', desc: '棘刺缠绕王冠，高傲低头臣服' },
  { id: 'lunar_sigil', name: '月相契约', desc: '弦月与秘符交叠，暗夜定契' },
  { id: 'abyss_butterfly', name: '深渊蝶翼', desc: '展翅魔蝶细纹，腰腹摇曳生姿' },
  { id: 'rose_vine', name: '蔷薇藤蔓', desc: '带刺花枝蔓延，靡丽贴合肌理' },
  { id: 'obsidian_chain', name: '黑曜锁链', desc: '细链环扣锁印，象征归属束缚' },
  { id: 'astral_crest', name: '星芒圣印', desc: '八芒星轨纹章，奢华贵族烙印' },
  { id: 'coiled_serpent', name: '盘蛇缠枝', desc: '细蛇绕轴吐信，冰冷缠绵占有' },
  { id: 'chain_cross', name: '锁链十字', desc: '圣洁十字缠锁，禁忌背德印记' },
  { id: 'rose_window', name: '哥特玫瑰窗', desc: '繁复对称花窗，庄严暗夜圣堂' },
  { id: 'fallen_wings', name: '堕天双翼', desc: '舒展锐利羽翼，折翼归顺之姿' },
  { id: 'astrolabe_ring', name: '秘仪星盘', desc: '同心星轨刻度，命运锁死归属' },
  { id: 'bound_heart', name: '束缚之心', desc: '缎带十字勒紧心房，甘愿交付' },
  { id: 'spade_thorns', name: '黑桃荆环', desc: '尖锐黑桃嵌棘环，危险痴迷印记' }
];
export const PATTERN_BY_ID = Object.fromEntries(IMPRINT_PATTERNS.map(p => [p.id, p]));

// ── 墨色 ────────────────────────────────────────────────────
export const IMPRINT_COLORS = [
  { id: 'crimson', name: '绯红魅影', desc: '艳丽淫纹粉红，肌表灼目微光', fill: '#f05684' },
  { id: 'gold', name: '暗金烙印', desc: '皇家鎏金细线，奢华贵族质感', fill: '#e4c482' },
  { id: 'obsidian', name: '深曜墨黑', desc: '经典高定刺青黑，利落冷艳', fill: '#1d1724' },
  { id: 'violet', name: '魅紫幽光', desc: '魅魔秘纹紫调，幽暗迷离', fill: '#b876ff' }
];
export const COLOR_BY_ID = Object.fromEntries(IMPRINT_COLORS.map(c => [c.id, c]));

// ── 书体（label 用于界面，body 用于派生句） ──────────────────────
export const IMPRINT_FONTS = [
  { id: 'script', label: '纤细手写', body: '纤细手写体' },
  { id: 'gothic', label: '哥特花体', body: '哥特花体' },
  { id: 'seal', label: '古典篆刻', body: '古典篆刻体' }
];
export const FONT_BY_ID = Object.fromEntries(IMPRINT_FONTS.map(f => [f.id, f]));

// ── 刻字布局与缩放 ───────────────────────────────────────────
export const IMPRINT_LAYOUTS = [
  { id: 'arc_wrap', label: '弧绕外缘' },
  { id: 'above', label: '图腾上方' },
  { id: 'below', label: '图腾下方' },
  { id: 'side_stamp', label: '独立落款' }
];
export const LAYOUT_BY_ID = Object.fromEntries(IMPRINT_LAYOUTS.map(l => [l.id, l]));
export const SCALE_LABELS = { sm: '小', md: '中', lg: '大' };
export const SCALE_FACTOR = { sm: 0.76, md: 1, lg: 1.22 };
export const TEXT_SCALE_FACTOR = { sm: 0.84, md: 1, lg: 1.2 };

// ── 项圈材质：7 款 ──────────────────────────────────────────
export const CHOKER_STYLES = [
  { id: 'obsidian_velvet', name: '黑曜丝绒细链', desc: '哑光黑曜丝绒配隐形暗扣，日常如极简细颈链般自然', swatch: 'is-velvet' },
  { id: 'rose_gold_lock', name: '玫瑰金铭牌锁圈', desc: '贴颈玫瑰金纤环缀刻字小牌，垂落微型十字锁扣', swatch: 'is-rosegold' },
  { id: 'crimson_thorn', name: '绯红荆棘皮质颈环', desc: '暗绯头层软皮浮雕荆棘暗纹，贴合喉结脉搏的支配感', swatch: 'is-crimson' },
  { id: 'silver_studs', name: '银质铆钉窄圈', desc: '冷冽哑黑窄带嵌细密银钉，锋利冷艳的驯服标记', swatch: 'is-studs' },
  { id: 'pearl_strand', name: '月白珍珠串链', desc: '温润南洋珠串缀暗金吊牌，端庄名媛皮囊下的私密枷锁', swatch: 'is-pearl' },
  { id: 'satin_ribbon', name: '墨红缎带蝴蝶结', desc: '垂顺酒红真丝系出软结，似礼盒丝带般等待拆封', swatch: 'is-ribbon' },
  { id: 'minimal_torc', name: '极简冷银金属环', desc: '一体成型抛光冷银颈环，贴骨微凉的绝对归属圈', swatch: 'is-torc' }
];
export const CHOKER_STYLE_BY_ID = Object.fromEntries(CHOKER_STYLES.map(s => [s.id, s]));

// ── 已下架的三件空壳持久奇物（只留静态名兜底，防日志渲染裸 ID） ──
export const LEGACY_ITEM_NAMES = {
  it_earring: '心跳共振耳钉（已下架）',
  it_watch: '情绪温控怀表（已下架）',
  it_pillow: '双生梦境枕（已下架）'
};
export const LEGACY_REMOVED_PRICES = { it_earring: 280, it_watch: 550, it_pillow: 900 };

// ── 派生句：单枚印记短句 ─────────────────────────────────────
// 双层同开：{anchor}有{pColor}「{patternName}」配{tColor}{fontBody}“{text}”
// 仅纹样：  {anchor}有{pColor}「{patternName}」印记
// 仅刻字：  {anchor}刻有{tColor}{fontBody}“{text}”
export function imprintClause(entry) {
  const place = PLACEMENT_BY_ID[entry.placement];
  const anchor = place ? place.anchor : String(entry.placement || '');
  const pColor = COLOR_BY_ID[entry.patternColor]?.name || '';
  const tColor = COLOR_BY_ID[entry.textColor]?.name || '';
  const pattern = PATTERN_BY_ID[entry.patternId]?.name || '';
  const font = FONT_BY_ID[entry.font]?.body || '';
  const text = String(entry.text || '').trim();
  if (entry.patternEnabled && entry.textEnabled) return `${anchor}有${pColor}「${pattern}」配${tColor}${font}“${text}”`;
  if (entry.patternEnabled) return `${anchor}有${pColor}「${pattern}」印记`;
  return `${anchor}刻有${tColor}${font}“${text}”`;
}

// 多枚拼接：按 PLACEMENTS 解剖顺序，全角分号连接，150 字上限内截断并收尾
export const IMPRINT_TEXT_LIMIT = 150;
export function buildImprintText(imprints) {
  const items = imprints?.items || {};
  const priorScar = String(imprints?.priorScar || '').trim();
  const clauses = [];
  for (const place of PLACEMENTS) {
    const entry = items[place.id];
    if (entry) clauses.push(imprintClause(entry));
  }
  if (!clauses.length) return priorScar;
  const total = clauses.length;
  const tail = priorScar && total <= 2 ? `；原有：${priorScar}` : '';
  let out = clauses.join('；');
  if (tail && out.length + tail.length <= IMPRINT_TEXT_LIMIT) return out + tail;
  if (out.length <= IMPRINT_TEXT_LIMIT) return out;
  // 超长：按顺序保留完整短句，末尾补计数尾巴，绝不腰斩半个词
  const suffix = `等共${total}处专属印记`;
  let kept = '';
  for (const clause of clauses) {
    const next = kept ? `${kept}；${clause}` : clause;
    if (next.length + suffix.length > IMPRINT_TEXT_LIMIT) break;
    kept = next;
  }
  return `${kept || clauses[0].slice(0, IMPRINT_TEXT_LIMIT - suffix.length)}${suffix}`.slice(0, IMPRINT_TEXT_LIMIT);
}

// 项圈派生句
export function chokerClause(choker) {
  const style = CHOKER_STYLE_BY_ID[choker?.styleId]?.name || '';
  const ins = String(choker?.inscription || '').trim();
  return ins
    ? `【誓约项圈】颈间佩戴${style}（铭牌刻“${ins}”，旁人眼中仅如寻常细颈链）`
    : `【誓约项圈】颈间佩戴${style}（旁人眼中仅如寻常细颈链）`;
}

// ── rc.47：三装置（印记 / 项圈 / TOY·LINK）统一使用门槛 ─────────────
export const DEVICE_MIN_AFFECTION = 70;
export const DEVICE_MIN_CORRUPTION = 60;

/**
 * 判定目标女性是否达到三装置的使用门槛（好感 ≥ 70 或堕落 ≥ 60，二选一达标即可）。
 * @param {object|null|undefined} c - state.characters[id]
 * @returns {{
 *   eligible: boolean,
 *   affection: number,
 *   corruption: number,
 *   minAffection: number,
 *   minCorruption: number,
 *   affGap: number,
 *   corGap: number,
 *   metBy: 'both' | 'affection' | 'corruption' | null
 * }}
 */
export function checkDeviceThreshold(c) {
  const affection = Math.max(0, Math.min(100, Math.trunc(Number(c?.affection) || 0)));
  const corruption = Math.max(0, Math.min(100, Math.trunc(Number(c?.corruption) || 0)));
  const affGap = Math.max(0, DEVICE_MIN_AFFECTION - affection);
  const corGap = Math.max(0, DEVICE_MIN_CORRUPTION - corruption);
  const affOk = affection >= DEVICE_MIN_AFFECTION;
  const corOk = corruption >= DEVICE_MIN_CORRUPTION;
  const eligible = Boolean(c && c.trackingState === 'RECORDED' && (affOk || corOk));
  const metBy = !eligible ? null : (affOk && corOk ? 'both' : affOk ? 'affection' : 'corruption');
  return {
    eligible,
    affection,
    corruption,
    minAffection: DEVICE_MIN_AFFECTION,
    minCorruption: DEVICE_MIN_CORRUPTION,
    affGap,
    corGap,
    metBy
  };
}
