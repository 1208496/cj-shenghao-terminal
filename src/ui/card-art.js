// rc.37 卡面美术：12 款内联矢量纹样 + 四档金属视觉参数。
// 铁律：零外部图片、零网络依赖、零 SVG filter；单卡只用 1 条 path。

export const RARITY_VISUAL = {
  gray: { rim: '#8f98a8', tone1: '#1e212a', tone2: '#2a2e3a', halo: 'rgba(143,152,168,.22)', stamp: 'I', pool: 'low' },
  red: { rim: '#e0607c', tone1: '#3e121f', tone2: '#5c1a2c', halo: 'rgba(224,96,124,.28)', stamp: 'II', pool: 'low' },
  gold: { rim: '#f0cf88', tone1: '#2c200e', tone2: '#4c3615', halo: 'rgba(240,207,136,.34)', stamp: 'III', pool: 'high' },
  rainbow: { rim: '#c79bf0', tone1: '#211538', tone2: '#3b235c', halo: 'rgba(199,155,240,.36)', stamp: 'IV', pool: 'high' },
};

// 每档 3 款，共 12 款图鉴。
export const CARD_PATHS = {
  gray_1: 'M12 2.6l2.1 5.5 5.9.4-4.6 3.7 1.5 5.7-4.9-3.2-4.9 3.2 1.5-5.7-4.6-3.7 5.9-.4z',
  gray_2: 'M12 3.2l7.2 4.1v9.4L12 20.8 4.8 16.7V7.3zM12 7.4l-3.4 2v5l3.4 1.9 3.4-1.9v-5z',
  gray_3: 'M6.4 3.6h8.4l2.8 3.4v13.4H6.4zM8.8 8.4h6M8.8 11.6h6M8.8 14.8h3.8',
  red_1: 'M4.6 18.4c0-4.6 2.6-6.6 5-8.4 1.4-1.1 2.2-2.4 2.4-4.4 1.9 1.6 2.4 3.4 2.2 5.2 1.6-.4 2.8 0 3.6 1.2-1 .5-1.6 1.2-1.8 2.2 1.3.9 1.9 2.2 1.9 4.2h-4.4c-.9 0-1.6-.7-1.6-1.6v-1.9h-1.6v3.5z',
  red_2: 'M12 20.4c-3.1-2.3-6-4.6-6-7.9 0-2.4 1.6-4.1 3.8-4.1 1 0 1.7.4 2.2 1.1.5-.7 1.2-1.1 2.2-1.1 2.2 0 3.8 1.7 3.8 4.1 0 3.3-2.9 5.6-6 7.9zM12 3.4v2.4',
  red_3: 'M5.2 5.6h13.6v10.2L12 20.6l-6.8-4.8zM8.4 9.2h7.2M8.4 12.2h4.6',
  gold_1: 'M7 4.4h10l1.4 10.2c0 2.4-2.6 4.6-6.4 4.6s-6.4-2.2-6.4-4.6zM9.6 4.4v2.2h4.8V4.4M12 9.2v5.6',
  gold_2: 'M12 2.8v18.4M6.4 7.2h11.2M8.2 7.2 6 15.4c1.5 1.2 3.5 1.2 5 .2M15.8 7.2l2.2 8.2c-1.5 1.2-3.5 1.2-5 .2M9.4 21.2h5.2',
  gold_3: 'M3.6 9.2 6 4.6h12l2.4 4.6-4.2 2.8-1.4-2.2H9.2L7.8 12zM4.6 11.4v6.2h14.8v-6.2M9 17.6v-3.6h6v3.6',
  rainbow_1: 'M12 2.4l2.6 6.4 6.8.5-5.2 4.4 1.7 6.6L12 16.9 6.1 20.3l1.7-6.6L2.6 9.3l6.8-.5zM12 7.4l1 2.4 2.6.2-2 1.7.7 2.5-2.3-1.4-2.3 1.4.7-2.5-2-1.7 2.6-.2z',
  rainbow_2: 'M4.4 4.4h15.2v4.4H4.4zM6.8 8.8v10.4M17.2 8.8v10.4M4.4 19.2h15.2M9.4 4.4v4.4M14.6 4.4v4.4',
  rainbow_3: 'M12 2.8l8.2 4.7v9L12 21.2 3.8 16.5v-9zM12 8.2l3.8 2.2v4.4L12 17l-3.8-2.2v-4.4zM12 2.8v5.4M3.8 7.5l4.4 2.9M20.2 7.5l-4.4 2.9',
};

export const CARD_CODES = Object.keys(CARD_PATHS);

export function cardPath(code) {
  return CARD_PATHS[code] || CARD_PATHS.gray_1;
}

// 卡面纹样的内联 SVG（1 条 path，可直接放进小手机或全屏 iframe）
export function cardGlyph(code, color = 'currentColor') {
  return `<svg class="wish-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="${cardPath(code)}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
