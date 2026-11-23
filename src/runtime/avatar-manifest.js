// rc.31：头像清单加载（方案二）——远程优先，失败回落到构建内联的保底清单。
// 图库在独立仓 1208496/cj-shenghao-avatars，走 jsDelivr 三个 host；清单按 commit SHA 固定。
import { INLINE_AVATAR_MANIFEST } from '../ui/avatar-manifest.generated.js';

const REPO = '1208496/cj-shenghao-avatars';
const REF = 'a862677bdb1416d1824120541150a0c26405df5d';
// 缓存键带 REF：换清单/换图后旧缓存自动失效，不会一直吃上一版的条目。
const CACHE_KEY = `cj-shenghao:avatar-manifest:v3:${REF}`;
const LEGACY_CACHE_KEYS = ['cj-shenghao:avatar-manifest:v2'];
const HOSTS = ['https://testingcf.jsdelivr.net/gh/', 'https://fastly.jsdelivr.net/gh/', 'https://cdn.jsdelivr.net/gh/'];
const MANIFEST_PATH = 'assets/avatars/manifest.json';

export const AVATAR_BASES = HOSTS.map((host) => `${host}${REPO}@${REF}/`);
export const AVATAR_MANIFEST_URL = AVATAR_BASES[0] + MANIFEST_PATH;

let memory = null;
let resolvedBase = AVATAR_BASES[0];

export function avatarBase() {
  return resolvedBase;
}

// rc.41：交给 host 的 pruneStorage 保护当前这版清单，其余 <REF> 残留可回收。
export function manifestCacheKey() {
  return CACHE_KEY;
}

export function inlineManifest() {
  return INLINE_AVATAR_MANIFEST && INLINE_AVATAR_MANIFEST.schema ? INLINE_AVATAR_MANIFEST : null;
}

function valid(manifest) {
  return !!(manifest && manifest.schema === 1 && Array.isArray(manifest.tiers) && Array.isArray(manifest.items));
}

export function cachedManifest() {
  if (memory && valid(memory)) return memory;
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (valid(raw)) { memory = raw; return memory; }
  } catch (e) {}
  return null;
}

// 结算时给人物分配头像只用同步数据：优先已拉到的远程清单，其次缓存，最后构建内联。
// 内联清单现在是**全量条目**，所以哪怕网络还没回来也不会出现「同档只有两张」的跨档。
export function resolvedManifest() {
  if (memory && valid(memory)) return memory;
  const hit = cachedManifest();
  if (hit) return hit;
  return inlineManifest();
}

// 旧版本（v2 等）的清单键直接清掉，避免旧条目一直被当成有效缓存。
export function dropLegacyCaches() {
  for (const key of LEGACY_CACHE_KEYS) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
}

export function rememberManifest(manifest) {
  if (!valid(manifest)) return null;
  memory = manifest;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(manifest)); } catch (e) {}
  return manifest;
}

// 依次试三个 host 拉清单；任一个成功就记住它，后面拼图片地址也用这个 base。
export async function loadManifest({ url, timeoutMs = 8000 } = {}) {
  dropLegacyCaches();
  const hit = cachedManifest();
  if (hit) return { manifest: hit, source: 'cache' };
  const candidates = url ? [url] : AVATAR_BASES.map((base) => base + MANIFEST_PATH);
  for (const target of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(target, { signal: controller.signal, cache: 'no-cache' });
      clearTimeout(timer);
      if (!response.ok) continue;
      const json = await response.json();
      if (!valid(json)) continue;
      const matched = AVATAR_BASES.find((base) => target.startsWith(base));
      if (matched) resolvedBase = matched;
      return { manifest: rememberManifest(json), source: 'remote' };
    } catch (e) {
      console.log('[神豪终端] 头像清单拉取失败', String(e && e.message).slice(0, 60));
    }
  }
  const fallback = inlineManifest();
  return fallback ? { manifest: fallback, source: 'inline' } : { manifest: null, source: 'none' };
}

// 图片地址：条目自带 data URL（内联保底）优先，否则 base + manifest.basePath + 相对路径。
export function avatarUrl(item, manifest, baseUrl) {
  if (!item) return '';
  if (item.data) return item.data;
  const base = baseUrl || avatarBase() || manifest?.baseUrl || '';
  if (!base) return '';
  const rel = String(item.file || '').replace(/^\//, '');
  const path = manifest?.basePath ? `${String(manifest.basePath).replace(/\/$/, '')}/${rel}` : rel;
  return base.replace(/\/?$/, '/') + path;
}

// 图片加载失败时依次换下一个 host 重试一次，全部失败才交回首字。
export function nextBase(current) {
  const index = AVATAR_BASES.indexOf(current || resolvedBase);
  const next = AVATAR_BASES[(index + 1) % AVATAR_BASES.length];
  resolvedBase = next;
  return next;
}
