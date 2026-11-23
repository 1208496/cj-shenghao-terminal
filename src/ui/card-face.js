// rc.40 统一星愿卡面组件（单一真源）：同时供全屏轮盘（卡包/赌场）与小手机（卡册/背包）使用。
// 约束：零外部图片、零 SVG filter；外壳承交互，内芯纯展示。

import { cardGlyph } from './card-art.js';
import { WHEEL_COPY, fill } from '../core/wheel-ui-copy.js';
import { WISH_CARDS } from '../core/casino-catalog.js';

// 与 app.js 同款转义：用 fromCharCode(38) 拼实体，避免产物里出现会被宿主预处理的实体串。
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => String.fromCharCode(38) + ({ '&': 'amp;', '<': 'lt;', '>': 'gt;', '"': 'quot;', "'": '#39;' }[c]));

const VALID_RARITIES = new Set(['gray', 'red', 'gold', 'rainbow', 'mystery']);
const VALID_SIZES = new Set(['lg', 'md', 'sm', 'xs']);

export function resolveCardTitle(card = {}) {
  if (card.name) return String(card.name);
  const entry = WHEEL_COPY.cards?.[card.cardCode];
  if (entry?.name) return entry.name;
  return WISH_CARDS[card.rarity]?.name || String(card.cardCode || card.rarity || '');
}

export function resolveTierLabel(rarity) {
  const labels = WHEEL_COPY.cardFace?.tiers || {};
  return labels[rarity] || labels.gray || '灰阶·I';
}

/**
 * 生成统一星愿卡面 DOM 字符串。
 * @param {object} card
 * @param {'gray'|'red'|'gold'|'rainbow'|'mystery'} card.rarity
 * @param {string} [card.cardCode]
 * @param {number|string} [card.points]        // 兼容 currentPoints / points / 自定义文本（如 '???'）
 * @param {number} [card.currentPoints]
 * @param {'low'|'high'} [card.poolTier]
 * @param {number} [card.serialNo]
 * @param {number} [card.winStreak]
 * @param {boolean} [card.locked]
 * @param {'lg'|'md'|'sm'|'xs'} [card.size='md']
 * @param {string} [card.name]                 // 待机秘印卡可覆盖名称
 * @param {string} [card.tierLabel]            // 可覆盖左上角档位文案
 * @param {boolean} [card.showCrack=false]     // 赌场输局裂纹层占位
 */
export function renderCardFace(card = {}) {
  const rarity = VALID_RARITIES.has(card.rarity) ? card.rarity : 'gray';
  const size = VALID_SIZES.has(card.size) ? card.size : 'md';
  const tierText = card.tierLabel || resolveTierLabel(rarity);
  const nameText = resolveCardTitle(card);
  const rawPoints = card.points !== undefined ? card.points : (card.currentPoints ?? 0);
  const pointsText = typeof rawPoints === 'number'
    ? fill(WHEEL_COPY.cardFace.pointsUnit, { n: rawPoints })
    : String(rawPoints);

  const serial = Number(card.serialNo) > 0
    ? `${WHEEL_COPY.packs.ui.serialPrefix}${String(card.serialNo).padStart(4, '0')}`
    : '';
  const poolBadge = card.poolTier === 'low'
    ? WHEEL_COPY.packs.ui.poolLowBadge
    : card.poolTier === 'high'
      ? WHEEL_COPY.packs.ui.poolHighBadge
      : '';
  const topRight = serial || '✦';
  const streak = Number(card.winStreak) > 0
    ? `<span class="wc-streak">${esc(fill(WHEEL_COPY.packs.ui.streakBadge, { n: card.winStreak }))}</span>`
    : '';
  const lock = card.locked ? '<span class="wc-lock" aria-label="已锁定">🔒</span>' : '';
  const crack = card.showCrack
    ? '<svg class="wc-crack" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true"><path d="M52 0 L44 38 L66 64 L32 98 L58 150 M44 38 L12 52 M66 64 L96 80" stroke="#ff687c" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>'
    : '';

  return `<div class="wc-card wc-${esc(rarity)}" data-wc-size="${esc(size)}" data-rarity="${esc(rarity)}"${card.cardCode ? ` data-card-code="${esc(card.cardCode)}"` : ''}${card.poolTier ? ` data-pool-tier="${esc(card.poolTier)}"` : ''}>
    <div class="wc-face">
      <div class="wc-top">
        <span class="wc-tier">${esc(tierText)}</span>
        ${poolBadge ? `<span class="wc-pool">${esc(poolBadge)}</span>` : ''}
        <span class="wc-serial">${esc(topRight)}</span>
      </div>
      <div class="wc-art">${cardGlyph(card.cardCode || `${rarity === 'mystery' ? 'rainbow_3' : `${rarity}_1`}`, 'currentColor')}</div>
      <div class="wc-foot">
        <div class="wc-name">${esc(nameText)}</div>
        <div class="wc-val">${esc(pointsText)}</div>
      </div>
      ${streak}${lock}${crack}
    </div>
  </div>`;
}
