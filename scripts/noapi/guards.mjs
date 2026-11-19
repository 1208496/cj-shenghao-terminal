// scripts/noapi/guards.mjs —— 防误伤守卫（纯函数，可离线单测）
//
// 铁律：只碰 8001 测试实例；C:\jiuguan（8000 玩家日常实例）物理级禁止。
// 注意：8001 实例在 E:\Ajiuguanagentceshi\SillyTavern —— 字符串里含 "jiuguan"，
// 所以禁止规则必须按「盘符 + 路径段」判定，不能用 /jiuguan/i 粗暴匹配。

import path from 'node:path';

export const TEST_PORT = '8001';
export const PLAYER_PORT = '8000';

/** 8000 玩家实例的盘符路径前缀（含 C:\jiuguan 的任意写法） */
const PLAYER_ROOT = /^[a-z]:[\\/]jiuguan(?:[\\/]|$)/i;

export class SafetyBlock extends Error {
  constructor(msg) { super('SAFETY_BLOCK: ' + msg); this.name = 'SafetyBlock'; }
}

/** URL 必须是 8001；命中 8000 立即抛。 */
export function assertSafeUrl(url) {
  let u;
  try { u = new URL(String(url)); } catch { throw new SafetyBlock(`非法 URL：${url}`); }
  if (u.port === PLAYER_PORT) throw new SafetyBlock(`禁止连接 8000（玩家日常实例）：${url}`);
  if (u.port !== TEST_PORT) throw new SafetyBlock(`端口不是 8001（当前 ${u.port || '默认'}）：${url}`);
  return true;
}

function normalize(p) {
  return path.resolve(String(p)).replace(/[\\/]+$/, '');
}

/**
 * 写入/删除路径必须落在 allowedRoots 之内，且不得是 8000 玩家实例。
 * @param {string} target
 * @param {string[]} allowedRoots
 */
export function assertSafePath(target, allowedRoots) {
  const t = normalize(target);
  if (PLAYER_ROOT.test(t)) throw new SafetyBlock(`禁止读写 8000 玩家实例目录：${t}`);
  const roots = (allowedRoots || []).map(normalize);
  if (!roots.length) throw new SafetyBlock('未声明允许的写入根目录，拒绝执行');
  const ok = roots.some((r) => t === r || t.startsWith(r + path.sep));
  if (!ok) throw new SafetyBlock(`路径不在允许的根目录内：${t}（允许：${roots.join(' / ')}）`);
  return t;
}

/** 路径里出现 8000 实例的任何变体都要拦（用于拼接后的复核） */
export function assertNoPlayerInstance(str) {
  const s = String(str);
  if (PLAYER_ROOT.test(normalize(s))) throw new SafetyBlock(`字符串指向 8000 玩家实例：${s}`);
  return true;
}
