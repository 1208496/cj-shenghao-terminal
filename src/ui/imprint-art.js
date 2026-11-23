// rc.46：专属印记的矢量与合成（**从原型原样搬运**，勿在此重新创作图案）。
// 来源：.work/rc46-proto-imprint.html 的 PLACEMENTS / PATTERNS / COLORS / FONTS / 舞台合成逻辑。
// 只做了两件事：①去掉 DOM 操作改成纯函数；②颜色从静态量改成按 entry 取。
const S = 'rgba(232,202,162,.20)';

const PLACEMENTS = [
    { id:'lower_abdomen', group:'chest_abdomen', name:'小腹 · 淫纹核心', short:'小腹', privacy:'私密 · 露脐或宽衣可见', anchor:'小腹耻骨上方', cx:120, cy:78,
      sil:`<path d="M50 18 C58 64 76 112 108 148 M190 18 C182 64 164 112 132 148" fill="none" stroke="${S}" stroke-width="1.5"/><circle cx="120" cy="30" r="2.2" fill="none" stroke="${S}" stroke-width="1.2"/>` },
    { id:'left_breast',   group:'chest_abdomen', name:'左胸 · 心口乳侧', short:'左胸', privacy:'极私密 · 褪去内衣可见', anchor:'左胸心口处', cx:120, cy:78,
      sil:`<path d="M56 16 C64 72 86 124 142 126 C176 127 196 104 204 72 M42 106 Q84 124 124 120" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'right_breast',  group:'chest_abdomen', name:'右胸 · 乳晕外缘', short:'右胸', privacy:'极私密 · 褪去内衣可见', anchor:'右胸乳侧处', cx:120, cy:78,
      sil:`<path d="M184 16 C176 72 154 124 98 126 C64 127 44 104 36 72 M198 106 Q156 124 116 120" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'lower_back',    group:'waist_glute', name:'后腰 · 尾椎腰窝', short:'后腰', privacy:'半私密 · 俯身或低腰可见', anchor:'后腰尾椎上方', cx:120, cy:78,
      sil:`<path d="M120 12 L120 124 M64 20 C72 64 68 104 54 146 M176 20 C168 64 172 104 186 146" fill="none" stroke="${S}" stroke-width="1.4"/><circle cx="100" cy="112" r="2" fill="${S}"/><circle cx="140" cy="112" r="2" fill="${S}"/>` },
    { id:'left_glute',    group:'waist_glute', name:'左臀 · 臀峰弧线', short:'左臀', privacy:'极私密 · 褪去下装可见', anchor:'左臀弧面处', cx:120, cy:78,
      sil:`<path d="M62 18 C40 62 42 114 78 142 C104 154 134 146 154 122 M154 22 C158 64 162 96 154 122" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'right_glute',   group:'waist_glute', name:'右臀 · 臀峰弧线', short:'右臀', privacy:'极私密 · 褪去下装可见', anchor:'右臀弧面处', cx:120, cy:78,
      sil:`<path d="M178 18 C200 62 198 114 162 142 C136 154 106 146 86 122 M86 22 C82 64 78 96 86 122" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'clavicle',      group:'neck_shoulder', name:'锁骨 · 颈下胸上', short:'锁骨', privacy:'显露 · 日常领口隐约可见', anchor:'锁骨下沿', cx:120, cy:80,
      sil:`<path d="M38 44 Q84 58 114 46 M202 44 Q156 58 126 46 M96 10 Q102 30 112 40 M144 10 Q138 30 128 40" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'nape',          group:'neck_shoulder', name:'后颈 · 发际垂落', short:'后颈', privacy:'显露 · 挽发或身后拥抱可见', anchor:'后颈发际线下', cx:120, cy:80,
      sil:`<path d="M84 18 Q120 30 156 18 M94 28 C94 60 80 86 42 106 M146 28 C146 60 160 86 198 106" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'scapula',       group:'neck_shoulder', name:'肩胛 · 蝶骨背影', short:'肩胛', privacy:'半私密 · 露背装或俯身可见', anchor:'背脊肩胛骨处', cx:120, cy:78,
      sil:`<path d="M120 14 V146 M44 30 Q80 22 106 42 C96 78 88 104 68 122 M196 30 Q160 22 134 42 C144 78 152 104 172 122" fill="none" stroke="${S}" stroke-width="1.4"/>` },
    { id:'left_thigh_inner',  group:'lower_limb', name:'左大腿内侧 · 腿根', short:'左大腿内侧', privacy:'极私密 · 褪去下装或分腿可见', anchor:'左大腿内侧近根处', cx:120, cy:78,
      sil:`<path d="M68 14 C84 58 96 104 102 150 M166 14 C150 56 142 94 148 150" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'right_thigh_inner', group:'lower_limb', name:'右大腿内侧 · 腿根', short:'右大腿内侧', privacy:'极私密 · 褪去下装或分腿可见', anchor:'右大腿内侧近根处', cx:120, cy:78,
      sil:`<path d="M172 14 C156 58 144 104 138 150 M74 14 C90 56 98 94 92 150" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'left_thigh_outer',  group:'lower_limb', name:'左大腿外侧 · 胯侧', short:'左大腿外侧', privacy:'私密 · 高叉裙摆或褪衣可见', anchor:'左大腿外侧中上段', cx:120, cy:78,
      sil:`<path d="M74 14 C56 58 58 108 76 150 M162 14 C168 62 164 108 154 150" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'right_thigh_outer', group:'lower_limb', name:'右大腿外侧 · 胯侧', short:'右大腿外侧', privacy:'私密 · 高叉裙摆或褪衣可见', anchor:'右大腿外侧中上段', cx:120, cy:78,
      sil:`<path d="M166 14 C184 58 182 108 164 150 M78 14 C72 62 76 108 86 150" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'left_calf',         group:'lower_limb', name:'左小腿 · 脚踝肌理', short:'左小腿', privacy:'显露 · 着裙或丝袜隐约可见', anchor:'左小腿肚外侧', cx:120, cy:78,
      sil:`<path d="M88 14 C72 52 78 96 96 148 M152 14 C158 56 150 98 136 148" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'right_calf',        group:'lower_limb', name:'右小腿 · 脚踝肌理', short:'右小腿', privacy:'显露 · 着裙或丝袜隐约可见', anchor:'右小腿肚外侧', cx:120, cy:78,
      sil:`<path d="M152 14 C168 52 162 96 144 148 M88 14 C82 56 90 98 104 148" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'left_arm',   group:'upper_limb', name:'左臂 · 上臂内侧', short:'左臂', privacy:'半私密 · 无袖或抬臂可见', anchor:'左上臂内侧', cx:120, cy:78,
      sil:`<path d="M36 42 Q120 34 204 48 M36 114 Q120 122 204 108" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'right_arm',  group:'upper_limb', name:'右臂 · 上臂内侧', short:'右臂', privacy:'半私密 · 无袖或抬臂可见', anchor:'右上臂内侧', cx:120, cy:78,
      sil:`<path d="M36 48 Q120 34 204 42 M36 108 Q120 122 204 114" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'left_wrist', group:'upper_limb', name:'左手腕 · 脉搏内侧', short:'左手腕', privacy:'显露 · 抬手挽袖清晰可见', anchor:'左手腕内侧脉搏处', cx:120, cy:78,
      sil:`<path d="M32 52 L170 56 C188 56 198 44 210 38 M32 104 L170 100 C188 100 198 112 210 118 M168 58 Q174 78 168 98" fill="none" stroke="${S}" stroke-width="1.5"/>` },
    { id:'right_wrist',group:'upper_limb', name:'右手腕 · 脉搏内侧', short:'右手腕', privacy:'显露 · 抬手挽袖清晰可见', anchor:'右手腕内侧脉搏处', cx:120, cy:78,
      sil:`<path d="M208 52 L70 56 C52 56 42 44 30 38 M208 104 L70 100 C52 100 42 112 30 118 M72 58 Q66 78 72 98" fill="none" stroke="${S}" stroke-width="1.5"/>` }
  ];

const PATTERNS = [
    { id:'succubus_heart',  name:'魅魔心翼', desc:'倒心羽翼环抱，经典淫纹核心',
      draw:(c) => `<path d="M0 -8 C-14 -26 -38 -22 -42 -6 C-44 4 -30 12 -18 13 C-28 19 -32 28 -24 31 C-14 33 -4 23 0 17 C4 23 14 33 24 31 C32 28 28 19 18 13 C30 12 44 4 42 -6 C38 -22 14 -26 0 -8 Z" fill="${c.aura}" stroke="${c.stroke}" stroke-width="1.5" stroke-linejoin="round"/><path d="M0 -14 C-7 -22 -16 -16 -14 -7 C-12 2 0 12 0 12 C0 12 12 2 14 -7 C16 -16 7 -22 0 -14 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.1"/>` },
    { id:'tally_zheng',     name:'「正」字计数', desc:'五划正字铭刻，记下每一次臣服',
      draw:(c) => `<rect x="-24" y="-24" width="48" height="48" rx="4" fill="${c.aura}" stroke="${c.stroke}" stroke-width="1.2" stroke-dasharray="6 3"/><path d="M-16 -15 H16 M0 -15 V16 M0 -1 H14 M-11 -3 V16 M-18 16 H18" fill="none" stroke="${c.fill}" stroke-width="4.2" stroke-linecap="square"/><path d="M-16 -15 H16 M0 -15 V16 M0 -1 H14 M-11 -3 V16 M-18 16 H18" fill="none" stroke="${c.stroke}" stroke-width="1.1" stroke-linecap="square"/>` },
    { id:'thorn_crown',     name:'荆棘冠冕', desc:'棘刺缠绕王冠，高傲低头臣服',
      draw:(c) => `<path d="M-36 10 L-26 -14 L-12 2 L0 -22 L12 2 L26 -14 L36 10 Q0 20 -36 10 Z" fill="${c.aura}" stroke="${c.stroke}" stroke-width="1.5" stroke-linejoin="round"/><path d="M-40 12 Q-20 -4 0 8 Q20 -4 40 12 M-18 -2 L-22 -9 M18 -2 L22 -9 M0 -22 L0 -29" fill="none" stroke="${c.fill}" stroke-width="1.6" stroke-linecap="round"/>` },
    { id:'lunar_sigil',     name:'月相契约', desc:'弦月与秘符交叠，暗夜定契',
      draw:(c) => `<path d="M-24 0 A24 24 0 1 0 24 0 A17 17 0 1 1 -24 0 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.2"/><path d="M0 -24 L4 -6 L22 0 L4 6 L0 24 L-4 6 L-22 0 L-4 -6 Z" fill="${c.aura}" stroke="${c.stroke}" stroke-width="1.2"/>` },
    { id:'abyss_butterfly', name:'深渊蝶翼', desc:'展翅魔蝶细纹，腰腹摇曳生姿',
      draw:(c) => `<path d="M0 -4 C-12 -26 -40 -26 -38 -6 C-37 6 -20 10 -6 8 C-20 12 -28 24 -18 28 C-9 31 -2 20 0 12 C2 20 9 31 18 28 C28 24 20 12 6 8 C20 10 37 6 38 -6 C40 -26 12 -26 0 -4 Z" fill="${c.aura}" stroke="${c.stroke}" stroke-width="1.4"/><path d="M0 -18 V20 M-4 -18 Q0 -26 4 -18" fill="none" stroke="${c.fill}" stroke-width="1.8" stroke-linecap="round"/>` },
    { id:'rose_vine',       name:'蔷薇藤蔓', desc:'带刺花枝蔓延，靡丽贴合肌理',
      draw:(c) => `<path d="M-44 10 C-26 -10 -12 18 0 0 C12 18 26 -10 44 10" fill="none" stroke="${c.stroke}" stroke-width="1.6" stroke-linecap="round"/><path d="M0 -14 C-10 -14 -14 -4 -8 4 C-2 10 2 10 8 4 C14 -4 10 -14 0 -14 Z M-4 -4 C0 -9 6 -5 2 1" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.2"/>` },
    { id:'obsidian_chain',  name:'黑曜锁链', desc:'细链环扣锁印，象征归属束缚',
      draw:(c) => `<path d="M-40 0 H-18 M18 0 H40 M-24 -7 H-8 A7 7 0 0 1 -8 7 H-24 A7 7 0 0 1 -24 -7 Z M8 -7 H24 A7 7 0 0 1 24 7 H8 A7 7 0 0 1 8 -7 Z" fill="none" stroke="${c.stroke}" stroke-width="1.6"/><path d="M0 -12 L10 0 L0 12 L-10 0 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.3"/>` },
    { id:'astral_crest',    name:'星芒圣印', desc:'八芒星轨纹章，奢华贵族烙印',
      draw:(c) => `<circle cx="0" cy="0" r="20" fill="${c.aura}" stroke="${c.stroke}" stroke-width="1.2" stroke-dasharray="3 3"/><path d="M0 -25 L5 -6 L24 0 L5 6 L0 25 L-5 6 L-24 0 L-5 -6 Z M-14 -14 L14 14 M14 -14 L-14 14" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.2"/>` },
    { id:'coiled_serpent',  name:'盘蛇缠枝', desc:'细蛇绕轴吐信，冰冷缠绵占有',
      draw:(c) => `<path d="M0 -26 V26" fill="none" stroke="${c.stroke}" stroke-width="1.4" stroke-linecap="round"/><path d="M-12 -18 C16 -18 16 -4 -12 -2 C-26 0 -20 14 10 14 C22 14 18 24 4 24" fill="none" stroke="${c.fill}" stroke-width="3.2" stroke-linecap="round"/><path d="M-14 -18 L-20 -22 M-14 -18 L-20 -15" fill="none" stroke="${c.stroke}" stroke-width="1.3" stroke-linecap="round"/>` },
    { id:'chain_cross',     name:'锁链十字', desc:'圣洁十字缠锁，禁忌背德印记',
      draw:(c) => `<path d="M0 -24 V24 M-18 -8 H18" fill="none" stroke="${c.fill}" stroke-width="4.2" stroke-linecap="round"/><path d="M0 -24 V24 M-18 -8 H18" fill="none" stroke="${c.stroke}" stroke-width="1.1"/><path d="M-14 -16 Q0 -2 14 -16 M-14 10 Q0 -4 14 10" fill="none" stroke="${c.stroke}" stroke-width="1.5" stroke-dasharray="3 2"/>` },
    { id:'rose_window',     name:'哥特玫瑰窗', desc:'繁复对称花窗，庄严暗夜圣堂',
      draw:(c) => `<circle cx="0" cy="0" r="23" fill="${c.aura}" stroke="${c.stroke}" stroke-width="1.5"/><circle cx="0" cy="0" r="10" fill="none" stroke="${c.fill}" stroke-width="1.6"/><path d="M0 -23 V23 M-23 0 H23 M-16 -16 L16 16 M16 -16 L-16 16" stroke="${c.stroke}" stroke-width="1.1"/><circle cx="0" cy="0" r="4" fill="${c.fill}"/>` },
    { id:'fallen_wings',    name:'堕天双翼', desc:'舒展锐利羽翼，折翼归顺之姿',
      draw:(c) => `<path d="M-4 -4 C-16 -24 -36 -24 -44 -10 C-30 -6 -22 -2 -14 2 C-26 4 -34 10 -36 18 C-22 14 -12 10 -4 6 Z" fill="${c.aura}" stroke="${c.stroke}" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 -4 C16 -24 36 -24 44 -10 C30 -6 22 -2 14 2 C26 4 34 10 36 18 C22 14 12 10 4 6 Z" fill="${c.aura}" stroke="${c.stroke}" stroke-width="1.4" stroke-linejoin="round"/><path d="M0 -14 L5 0 L0 16 L-5 0 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.1"/>` },
    { id:'astrolabe_ring',  name:'秘仪星盘', desc:'同心星轨刻度，命运锁死归属',
      draw:(c) => `<circle cx="0" cy="0" r="24" fill="none" stroke="${c.stroke}" stroke-width="1.3"/><circle cx="0" cy="0" r="16" fill="${c.aura}" stroke="${c.fill}" stroke-width="1.4" stroke-dasharray="4 2"/><ellipse cx="0" cy="0" rx="26" ry="9" fill="none" stroke="${c.stroke}" stroke-width="1.2" transform="rotate(-24)"/><circle cx="0" cy="0" r="4.5" fill="${c.fill}"/>` },
    { id:'bound_heart',     name:'束缚之心', desc:'缎带十字勒紧心房，甘愿交付',
      draw:(c) => `<path d="M0 -10 C-10 -24 -28 -16 -24 0 C-20 14 0 24 0 24 C0 24 20 14 24 0 C28 -16 10 -24 0 -10 Z" fill="${c.aura}" stroke="${c.fill}" stroke-width="2"/><path d="M-22 -2 L22 4 M-18 8 L18 -8 M-20 -6 Q0 2 20 -6" fill="none" stroke="${c.stroke}" stroke-width="1.6" stroke-linecap="round"/>` },
    { id:'spade_thorns',    name:'黑桃荆环', desc:'尖锐黑桃嵌棘环，危险痴迷印记',
      draw:(c) => `<circle cx="0" cy="0" r="23" fill="none" stroke="${c.stroke}" stroke-width="1.3" stroke-dasharray="5 3"/><path d="M0 -20 C-12 -6 -20 2 -14 10 C-9 16 -2 12 0 8 C2 12 9 16 14 10 C20 2 12 -6 0 -20 Z M0 8 L-5 19 H5 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.2"/>` }
  ];

const SCALES = [
    { id:'sm', name:'小', factor:0.76, textMul:0.84 },
    { id:'md', name:'中', factor:1.00, textMul:1.00 },
    { id:'lg', name:'大', factor:1.22, textMul:1.20 }
  ];

const LAYOUTS = [
    { id:'arc_wrap',   name:'弧绕外缘' },
    { id:'above',      name:'图腾上方' },
    { id:'below',      name:'图腾下方' },
    { id:'side_stamp', name:'独立落款' }
  ];

const FONTS = [
    { id:'script', name:'纤细手写', fam:'"Kaiti SC","STKaiti","KaiTi","Brush Script MT",cursive,serif', weight:500, lsAscii:'0.04em', lsZh:'0.12em', skew:-8, strokeW:0.6 },
    { id:'gothic', name:'哥特花体', fam:'"Songti SC","STSong","Noto Serif CJK SC","SimSun",Georgia,serif', weight:700, lsAscii:'0.06em', lsZh:'0.18em', skew:0, strokeW:0.85 },
    { id:'seal',   name:'古典篆刻', fam:'"Songti SC","STSong","Noto Serif CJK SC",Georgia,"Times New Roman",serif', weight:600, lsAscii:'0.14em', lsZh:'0.24em', skew:0, strokeW:0.5 }
  ];

const COLORS = [
    { id:'crimson',  name:'绯红魅影', desc:'艳丽淫纹粉红，肌表灼目微光', fill:'#f05684', stroke:'#ff9ec0', aura:'rgba(224,72,114,.32)' },
    { id:'gold',     name:'暗金烙印', desc:'皇家鎏金细线，奢华贵族质感', fill:'#e4c482', stroke:'#fff0c4', aura:'rgba(217,184,120,.30)' },
    { id:'obsidian', name:'深曜墨黑', desc:'经典高定刺青黑，利落冷艳',   fill:'#1d1724', stroke:'#9b8ea8', aura:'rgba(180,164,196,.24)' },
    { id:'violet',   name:'魅紫幽光', desc:'魅魔秘纹紫调，幽暗迷离',     fill:'#b876ff', stroke:'#e3c6ff', aura:'rgba(168,100,240,.32)' }
  ];

const byId = (list, id) => list.find((x) => x.id === id) || list[0];
const escXml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => String.fromCharCode(38) + ({'&': 'amp;', '<': 'lt;', '>': 'gt;', '"': 'quot;', "'": '#39;'}[c]));

export const PLACEMENT_POINTS = Object.fromEntries(PLACEMENTS.map((p) => [p.id, {x: p.cx, y: p.cy}]));

export function patternGlyph(patternId, colorId) {
  const pt = byId(PATTERNS, patternId);
  const c = byId(COLORS, colorId);
  return pt.draw(c);
}

// 与原型 800–878 行同一套排版规则
export function composeImprint(entry) {
  const pl = byId(PLACEMENTS, entry?.placement);
  const pt = byId(PATTERNS, entry?.patternId);
  const pCl = byId(COLORS, entry?.patternColor);
  const tCl = byId(COLORS, entry?.textColor);
  const ft = byId(FONTS, entry?.font);
  const pSc = byId(SCALES, entry?.patternScale);
  const tSc = byId(SCALES, entry?.textScale);
  const lay = byId(LAYOUTS, entry?.textLayout);
  const raw = String(entry?.text || '').trim();
  const showPat = !!entry?.patternEnabled;
  const showTxt = !!entry?.textEnabled && raw.length > 0;
  const both = showPat && showTxt;

  let patX = pl.cx, patY = pl.cy;
  if (both) {
    if (entry.textLayout === 'arc_wrap') patY = pl.cy + 12;
    else if (entry.textLayout === 'above') patY = pl.cy + 15;
    else if (entry.textLayout === 'below') patY = pl.cy - 14;
    else if (entry.textLayout === 'side_stamp') patX = pl.cx - 24;
  }

  const patLayer = showPat ? `<g class="ws-pattern-layer" transform="translate(${patX},${patY}) scale(${pSc.factor})">${pt.draw(pCl)}</g>` : '';

  let defsHtml = '';
  let txtLayer = '';
  if (showTxt) {
    const hasZh = /[\u4e00-\u9fff]/.test(raw);
    let weight = 0;
    for (const ch of raw) weight += /[\u4e00-\u9fff]/.test(ch) ? 1.8 : 1;
    const baseSize = weight <= 10 ? 13.5 : (weight <= 16 ? 11.5 : 10);
    const fsize = +(baseSize * tSc.textMul).toFixed(1);
    const ls = hasZh ? ft.lsZh : ft.lsAscii;
    const angle = Number(entry.textAngle) || 0;
    const safeTxt = escXml(raw);
    const halo = `fill="none" stroke="${tCl.aura}" stroke-width="${ft.strokeW + 1.8}" stroke-linejoin="round"`;

    if (entry.textLayout === 'arc_wrap') {
      const rx = both ? Math.round(54 + 12 * pSc.factor) : 64;
      const ry = both ? Math.round(48 + 10 * pSc.factor) : 50;
      const baseY = both ? patY + 4 : pl.cy + 20;
      const arcD = `M ${patX - rx},${baseY} A ${rx},${ry} 0 0,1 ${patX + rx},${baseY}`;
      defsHtml = `<defs><path id="imprintArc" d="${arcD}"/></defs>`;
      const rot = angle ? ` rotate(${angle},${patX},${patY})` : '';
      txtLayer = `<g class="ws-text-layer" transform="${rot}">
        <text font-family='${ft.fam}' font-size="${fsize}" font-weight="${ft.weight}" letter-spacing="${ls}" ${halo}><textPath href="#imprintArc" startOffset="50%" text-anchor="middle">${safeTxt}</textPath></text>
        <text font-family='${ft.fam}' font-size="${fsize}" font-weight="${ft.weight}" letter-spacing="${ls}" fill="${tCl.fill}" stroke="${tCl.stroke}" stroke-width="${ft.strokeW}"><textPath href="#imprintArc" startOffset="50%" text-anchor="middle">${safeTxt}</textPath></text>
      </g>`;
    } else if (entry.textLayout === 'above' || entry.textLayout === 'below') {
      const tx = pl.cx;
      const ty = both
        ? (entry.textLayout === 'above' ? Math.max(22, patY - 34 * pSc.factor - 12) : Math.min(142, patY + 34 * pSc.factor + 16))
        : pl.cy + 4;
      const lenAttr = weight > 15 ? ' textLength="168" lengthAdjust="spacingAndGlyphs"' : '';
      const xform = `translate(${tx},${ty})${angle ? ` rotate(${angle})` : ''}${ft.skew ? ` skewX(${ft.skew})` : ''}`;
      txtLayer = `<g class="ws-text-layer" transform="${xform}">
        <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family='${ft.fam}' font-size="${fsize}" font-weight="${ft.weight}" letter-spacing="${ls}" ${halo}${lenAttr}>${safeTxt}</text>
        <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family='${ft.fam}' font-size="${fsize}" font-weight="${ft.weight}" letter-spacing="${ls}" fill="${tCl.fill}" stroke="${tCl.stroke}" stroke-width="${ft.strokeW}"${lenAttr}>${safeTxt}</text>
      </g>`;
    } else {
      const tx = both ? pl.cx + 62 : pl.cx;
      const ty = pl.cy;
      const charsArr = Array.from(raw).slice(0, 8);
      const step = Math.min(14, Math.max(10, fsize * 1.02));
      const totalH = charsArr.length * step;
      const startY = -(totalH / 2) + step * 0.5;
      const xform = `translate(${tx},${ty})${angle ? ` rotate(${angle})` : ''}`;
      const boxH = Math.min(116, totalH + 12);
      const tspans = charsArr.map((ch, idx) => `<tspan x="0" y="${(startY + idx * step).toFixed(1)}">${escXml(ch)}</tspan>`).join('');
      txtLayer = `<g class="ws-text-layer" transform="${xform}">
        <rect x="${-(fsize * 0.72)}" y="${-(boxH / 2)}" width="${(fsize * 1.44).toFixed(1)}" height="${boxH.toFixed(1)}" rx="3" fill="${tCl.aura}" stroke="${tCl.stroke}" stroke-width="1"/>
        <text text-anchor="middle" dominant-baseline="middle" font-family='${ft.fam}' font-size="${Math.min(13, fsize).toFixed(1)}" font-weight="${ft.weight}" fill="${tCl.fill}" stroke="${tCl.stroke}" stroke-width="${ft.strokeW}">${tspans}</text>
      </g>`;
    }
  }

  return `${defsHtml}<g class="ws-body-silhouette">${pl.sil}</g>${patLayer}${txtLayer}`;
}

export function describeImprint(entry) {
  const pt = byId(PATTERNS, entry?.patternId);
  const lay = byId(LAYOUTS, entry?.textLayout);
  const raw = String(entry?.text || '').trim();
  const showPat = !!entry?.patternEnabled;
  const showTxt = !!entry?.textEnabled && raw.length > 0;
  if (showPat && showTxt) return `${pt.name} · ${lay.name}`;
  if (showPat) return `${pt.name}（纯纹样）`;
  if (showTxt) return `纯刻字 · ${lay.name}`;
  return '';
}

// 与原型 entryLabel()（proto-imprint:733-738）逐字一致：抽屉条目的描述串
export function entryLabel(entry) {
  const pat = entry?.patternEnabled ? byId(PATTERNS, entry.patternId).name : '';
  const raw = String(entry?.text || '').trim();
  const txt = entry?.textEnabled && raw ? `“${raw}”` : '';
  if (pat && txt) return `${pat} · ${txt}`;
  return pat || (txt ? `刻字 ${txt}` : '专属印记');
}

const STYLES = [
    {
      id:'obsidian_velvet', name:'黑曜丝绒细链', swatch:'is-velvet',
      desc:'哑光黑曜丝绒配隐形暗扣，日常如极简细颈链般自然',
      draw:(ins) => `
        <path d="M74 68 Q120 88 166 68" fill="none" stroke="#18131d" stroke-width="11" stroke-linecap="round"/>
        <path d="M75 68 Q120 88 165 68" fill="none" stroke="#453b52" stroke-width="8" stroke-linecap="round"/>
        <path d="M78 65 Q120 83 162 65" fill="none" stroke="rgba(255,232,190,.22)" stroke-width="1"/>
        <circle cx="120" cy="80" r="4" fill="#d4b073" stroke="#fff0cc" stroke-width="1"/>
        <rect x="94" y="88" width="52" height="17" rx="8.5" fill="#1d1824" stroke="#d8b578" stroke-width="1.3"/>
        <text x="120" y="99.5" text-anchor="middle" font-size="8.5" fill="#f7dfa8" font-family='"Songti SC","SimSun",Georgia,serif' letter-spacing="0.08em">${ins || '✦'}</text>
      `
    },
    {
      id:'rose_gold_lock', name:'玫瑰金铭牌锁圈', swatch:'is-rosegold',
      desc:'贴颈玫瑰金纤环缀刻字小牌，垂落微型十字锁扣',
      draw:(ins) => `
        <path d="M74 67 Q120 87 166 67" fill="none" stroke="#b37168" stroke-width="6.5" stroke-linecap="round"/>
        <path d="M75 66 Q120 85 165 66" fill="none" stroke="#f6c7b4" stroke-width="2.4" stroke-linecap="round"/>
        <rect x="90" y="80" width="60" height="18" rx="9" fill="#3a2024" stroke="#f4c2ae" stroke-width="1.5"/>
        <text x="120" y="92" text-anchor="middle" font-size="8.5" fill="#ffe3d4" font-family='"Songti SC","SimSun",Georgia,serif' letter-spacing="0.08em">${ins || '✦'}</text>
        <path d="M120 98 L126 108 L120 118 L114 108 Z" fill="#2a161a" stroke="#f6c7b4" stroke-width="1.3"/>
        <path d="M120 104 V112 M117.5 108 H122.5" stroke="#ffe3d4" stroke-width="1.2" stroke-linecap="round"/>
      `
    },
    {
      id:'crimson_thorn', name:'绯红荆棘皮质颈环', swatch:'is-crimson',
      desc:'暗绯头层软皮浮雕荆棘暗纹，贴合喉结脉搏的支配感',
      draw:(ins) => `
        <path d="M72 67 Q120 90 168 67" fill="none" stroke="#5b1122" stroke-width="14" stroke-linecap="round"/>
        <path d="M74 67 Q120 89 166 67" fill="none" stroke="#a62442" stroke-width="9" stroke-linecap="round"/>
        <path d="M80 68 L90 78 L100 72 L110 82 L120 75 L130 82 L140 72 L150 78 L160 68" fill="none" stroke="#f8b2c4" stroke-width="1.1" opacity=".8"/>
        <circle cx="120" cy="84" r="5" fill="none" stroke="#f0c888" stroke-width="1.6"/>
        <rect x="92" y="92" width="56" height="17" rx="4" fill="#2d0c16" stroke="#f09db0" stroke-width="1.3"/>
        <text x="120" y="103.5" text-anchor="middle" font-size="8.5" fill="#ffd9e2" font-family='"Songti SC","SimSun",Georgia,serif' letter-spacing="0.08em">${ins || '✦'}</text>
      `
    },
    {
      id:'silver_studs', name:'银质铆钉窄圈', swatch:'is-studs',
      desc:'冷冽哑黑窄带嵌细密银钉，锋利冷艳的驯服标记',
      draw:(ins) => `
        <path d="M73 67 Q120 89 167 67" fill="none" stroke="#16141a" stroke-width="12" stroke-linecap="round"/>
        <path d="M75 67 Q120 88 165 67" fill="none" stroke="#302c38" stroke-width="8" stroke-linecap="round"/>
        <path d="M82 70 L84 65 L86 71 M96 76 L98 70 L100 77 M110 79 L112 73 L114 80 M126 80 L128 73 L130 79 M140 77 L142 70 L144 76 M154 71 L156 65 L158 70" fill="none" stroke="#e4ebf5" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="120" cy="82" r="5.5" fill="none" stroke="#d8e2f0" stroke-width="1.8"/>
        <rect x="92" y="91" width="56" height="17" rx="3" fill="#181820" stroke="#cdd8e8" stroke-width="1.3"/>
        <text x="120" y="102.5" text-anchor="middle" font-size="8.5" fill="#e6eef8" font-family='"Songti SC","SimSun",Georgia,serif' letter-spacing="0.08em">${ins || '✦'}</text>
      `
    },
    {
      id:'pearl_strand', name:'月白珍珠串链', swatch:'is-pearl',
      desc:'温润南洋珠串缀暗金吊牌，端庄名媛皮囊下的私密枷锁',
      draw:(ins) => `
        <path d="M76 68 Q120 88 164 68" fill="none" stroke="#d6c8b6" stroke-width="1.2"/>
        <path d="M78 69 Q120 88 162 69" fill="none" stroke="#f5efe6" stroke-width="7.5" stroke-linecap="round" stroke-dasharray="1 9.5"/>
        <path d="M78 67.5 Q120 86.5 162 67.5" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="1 9.5"/>
        <circle cx="120" cy="84" r="3" fill="#e5c585"/>
        <rect x="94" y="89" width="52" height="17" rx="8.5" fill="#2c2224" stroke="#e5c585" stroke-width="1.3"/>
        <text x="120" y="100.5" text-anchor="middle" font-size="8.5" fill="#fff0cc" font-family='"Songti SC","SimSun",Georgia,serif' letter-spacing="0.08em">${ins || '✦'}</text>
      `
    },
    {
      id:'satin_ribbon', name:'墨红缎带蝴蝶结', swatch:'is-ribbon',
      desc:'垂顺酒红真丝系出软结，似礼盒丝带般等待拆封',
      draw:(ins) => `
        <path d="M73 67 Q120 88 167 67" fill="none" stroke="#6c1128" stroke-width="11" stroke-linecap="round"/>
        <path d="M75 66 Q120 86 165 66" fill="none" stroke="#b92748" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M120 80 C108 72 96 74 98 84 C100 91 112 86 120 82 C128 86 140 91 142 84 C144 74 132 72 120 80 Z" fill="#9e1c3b" stroke="#f8b2c4" stroke-width="1.2"/>
        <path d="M116 83 L104 114 M124 83 L136 114" fill="none" stroke="#9e1c3b" stroke-width="4" stroke-linecap="round"/>
        <rect x="94" y="92" width="52" height="16" rx="8" fill="#3a0d1a" stroke="#f5b8c8" stroke-width="1.2"/>
        <text x="120" y="103" text-anchor="middle" font-size="8.5" fill="#ffe2ea" font-family='"Songti SC","SimSun",Georgia,serif' letter-spacing="0.08em">${ins || '✦'}</text>
      `
    },
    {
      id:'minimal_torc', name:'极简冷银金属环', swatch:'is-torc',
      desc:'一体成型抛光冷银颈环，贴骨微凉的绝对归属圈',
      draw:(ins) => `
        <path d="M73 68 Q120 90 167 68" fill="none" stroke="#7d8796" stroke-width="7.5" stroke-linecap="round"/>
        <path d="M74 67 Q120 88 166 67" fill="none" stroke="#eef3fa" stroke-width="3" stroke-linecap="round"/>
        <rect x="92" y="80" width="56" height="17" rx="8.5" fill="#1e222b" stroke="#dce5f2" stroke-width="1.5"/>
        <text x="120" y="91.5" text-anchor="middle" font-size="8.5" fill="#eef4fc" font-family='"Songti SC","SimSun",Georgia,serif' letter-spacing="0.08em">${ins || '✦'}</text>
      `
    }
  ]

const CHOKER_STYLE_BY_ID = Object.fromEntries(STYLES.map((s) => [s.id, s]));

export { STYLES as CHOKER_ART_STYLES };

// 原型同款：按款式取 draw(ins)，铭牌文字直接嵌进画里
// 颈部剪影（逐字取自 RC47总方案/03_原型/rc47-proto-choker.html:616 NECK_SIL）
const NECK_SIL = '<path d="M88 16 C88 46 80 68 48 92 M152 16 C152 46 160 68 192 92 M56 124 Q120 138 184 124" fill="none" stroke="rgba(232,202,162,.16)" stroke-width="1.4"/>';

export function composeChoker(choker) {
  const styleId = choker?.styleId || 'obsidian_velvet';
  const style = CHOKER_STYLE_BY_ID[styleId] || STYLES[0];
  const ins = String(choker?.inscription || '').trim();
  return `${NECK_SIL}<g class="ws-choker-art">${style.draw(ins)}</g>`;
}

export function chokerStyleDesc(styleId) {
  return (CHOKER_STYLE_BY_ID[styleId] || STYLES[0]).desc;
}

export const STAGE = {w: 240, h: 160};


