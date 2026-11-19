// scripts/noapi/runtime.mjs —— 注入到页面里的测试内核（零 API 哨兵 + 跨 frame 寻址 + 四道门 + 真实点击）
//
// 用法（ego 运行时）：
//   await page.evaluate(installRuntime);                 // 装到顶层 window
//   await page.evaluate(() => window.__NOAPI__.installSentinel({ block: true }));
//
// 说明：
// - installRuntime 必须是**自包含函数**（evaluate 会 toString 序列化），
//   所以不要在里面引用模块作用域的任何东西。
// - 哨兵装在**所有同源 frame**，因为卡的运行时代码跑在 iframe[id^="TH-script--"]
//   里（host.js:13-15），只 patch 顶层 window 拦不住 generateRaw 与 fetch。
// - 默认 block:true —— 命中生成路由直接 reject，不留"记账但放行"的口子。

export function installRuntime() {
  if (window.__NOAPI__ && window.__NOAPI__.version >= 1) return { ok: true, reused: true, version: window.__NOAPI__.version };

  const GEN_RE = /\/(api\/(backends|openai|anthropic|google|openrouter|novelai|horde|kobold|textgen|extra)\/|api\/backends\/|generate\b|chat\/completions|streamGenerateContent|generateRaw)/i;
  const state = { violations: [], hooks: [], installed: false, block: true, domCounter: 0 };

  // ── frame 枚举 / 解析 ────────────────────────────────────────────
  function walk(win, path, out, depth) {
    if (!win || depth > 6) return;
    let doc;
    try { doc = win.document; } catch { return; }
    if (!doc) return;
    let els;
    try { els = doc.querySelectorAll('iframe,frame'); } catch { return; }
    for (let i = 0; i < els.length; i++) {
      const f = els[i];
      const id = f.id || f.getAttribute('name') || ('#' + i);
      const p = path.concat(id);
      let cw = null, cd = null;
      try { cw = f.contentWindow; cd = cw && cw.document; } catch { /* cross-origin */ }
      let rect = null;
      try { const b = f.getBoundingClientRect(); rect = { w: Math.round(b.width), h: Math.round(b.height) }; } catch { }
      out.push({ path: p, id, tag: f.tagName.toLowerCase(), src: String(f.getAttribute('src') || '').slice(0, 100), rect, cross: !cd, win: cw, doc: cd });
      if (cd) walk(cw, p, out, depth + 1);
    }
  }

  function framesRaw() {
    const out = [];
    walk(window, [], out, 0);
    return out;
  }

  function frames() {
    return framesRaw().map(({ path, id, tag, src, rect, cross }) => ({ path, id, tag, src, rect, cross }));
  }

  function resolve(pathArr) {
    let win = window;
    for (const id of (pathArr || [])) {
      let doc;
      try { doc = win.document; } catch { return null; }
      let el = null;
      if (String(id).startsWith('#')) el = doc.querySelectorAll('iframe,frame')[Number(String(id).slice(1))];
      else el = doc.getElementById(id) || doc.querySelector(`iframe[name="${id}"]`);
      if (!el) return null;
      try { win = el.contentWindow; } catch { return null; }
      if (!win) return null;
    }
    let doc = null;
    try { doc = win.document; } catch { return null; }
    return doc ? { win, doc, path: pathArr || [] } : null;
  }

  // ── 零 API 哨兵（全部同源 frame） ───────────────────────────────
  function note(where, what, detail) {
    const rec = { at: new Date().toISOString(), where, what, detail: String(detail || '').slice(0, 300) };
    state.violations.push(rec.what + ' @ ' + rec.where);
    return rec;
  }

  function patchWindow(w, label) {
    const done = [];
    // 1) fetch
    try {
      if (typeof w.fetch === 'function' && !w.fetch.__noapi) {
        const of = w.fetch.bind(w);
        const nf = function (input, init) {
          const url = String((input && input.url) || input || '');
          if (GEN_RE.test(url)) {
            note(label, 'fetch', url);
            if (state.block) return Promise.reject(Object.assign(new Error('ZERO_API_SENTINEL_BLOCKED'), { noapi: true, url }));
            return of(input, init);
          }
          return of(input, init);
        };
        nf.__noapi = true;
        try { w.fetch = nf; } catch { }
        done.push('fetch');
      }
    } catch { }
    // 2) XHR
    try {
      const X = w.XMLHttpRequest;
      if (X && X.prototype && !X.prototype.__noapi) {
        const oo = X.prototype.open, os = X.prototype.send;
        X.prototype.open = function (m, u, ...rest) { this.__noapi_url = String(u); return oo.call(this, m, u, ...rest); };
        X.prototype.send = function (...a) {
          if (GEN_RE.test(String(this.__noapi_url || ''))) {
            note(label, 'xhr', this.__noapi_url);
            if (state.block) throw Object.assign(new Error('ZERO_API_SENTINEL_BLOCKED'), { noapi: true, url: this.__noapi_url });
          }
          return os.apply(this, a);
        };
        X.prototype.__noapi = true;
        done.push('xhr');
      }
    } catch { }
    // 3) TavernHelper.generate / generateRaw（含卡自己 globalThis 上的裸函数）
    for (const key of ['generate', 'generateRaw']) {
      try {
        const wrap = (holder, name) => {
          if (!holder || typeof holder[name] !== 'function' || holder[name].__noapi) return false;
          const of = holder[name].bind(holder);
          const nf = function (...a) {
            note(label, 'TavernHelper.' + name, typeof a[0] === 'string' ? a[0].slice(0, 120) : '');
            if (state.block) return Promise.reject(Object.assign(new Error('ZERO_API_SENTINEL_BLOCKED'), { noapi: true }));
            return of(...a);
          };
          nf.__noapi = true;
          try { holder[name] = nf; } catch { return false; }
          return true;
        };
        if (wrap(w, key)) done.push(key);
        if (w.TavernHelper && wrap(w.TavernHelper, key)) done.push('TavernHelper.' + key);
      } catch { }
    }
    // 4) 酒馆生成事件（事后审计：真实生成一旦发生就不可能撤回，只能留证）
    try {
      const ctx = w.SillyTavern && w.SillyTavern.getContext && w.SillyTavern.getContext();
      const es = ctx && ctx.eventSource, et = ctx && ctx.eventTypes;
      if (es && et && et.GENERATION_STARTED && !es.__noapi) {
        es.on(et.GENERATION_STARTED, (type, opts, dryRun) => { if (dryRun !== true) note(label, 'GENERATION_STARTED(dryRun=false)', String(type || '')); });
        es.__noapi = true;
        done.push('eventSource');
      }
    } catch { }
    return done;
  }

  function installSentinel(opts) {
    state.block = opts && opts.block === false ? false : true;
    const list = framesRaw();
    const installed = [];
    for (const f of list) {
      if (!f.win) continue;
      const hooks = patchWindow(f.win, f.path.join('/') || 'top');
      if (hooks.length) installed.push({ path: f.path, hooks });
    }
    if (!list.some((f) => f.path.length === 0)) {
      const hooks = patchWindow(window, 'top');
      if (hooks.length) installed.push({ path: [], hooks });
    }
    state.installed = true;
    state.hooks = installed;
    return { ok: true, block: state.block, frames: list.length, installed, cross: list.filter((f) => f.cross).map((f) => f.path) };
  }

  // 新冒出来的 frame（轮盘 iframe 是打开时才创建的）要补装
  function reinstall() { return installSentinel({ block: state.block }); }

  // ── 具体元素事实 ───────────────────────────────────────────────
  function visibleFacts(el, doc, win) {
    let rect = null;
    try { const b = el.getBoundingClientRect(); rect = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; } catch { }
    let display = '', visibility = '', opacity = '';
    try {
      const cs = win.getComputedStyle(el);
      display = cs.display; visibility = cs.visibility; opacity = cs.opacity;
    } catch { }
    let checkVis = null;
    try { checkVis = typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : null; } catch { }
    const inCollapsed = !!(el.closest && el.closest('details:not([open])'));
    const visible = !!(rect && rect.w > 0 && rect.h > 0 && display !== 'none' && visibility !== 'hidden' && opacity !== '0' && !inCollapsed) && checkVis !== false;
    let coveredBy = null;
    if (rect && visible) {
      try {
        const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        const hit = doc.elementFromPoint(cx, cy);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
          coveredBy = `${hit.tagName.toLowerCase()}${hit.id ? '#' + hit.id : ''}${hit.className && typeof hit.className === 'string' ? '.' + hit.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
        }
      } catch { }
    }
    return { visible, rect, display, visibility, opacity, visibilityHidden: visibility === 'hidden', inCollapsed, coveredBy };
  }

  function pointerChain(el, win) {
    let node = el, guard = 0;
    while (node && node !== node.ownerDocument.body && guard++ < 20) {
      try { if (win.getComputedStyle(node).pointerEvents === 'none') return true; } catch { }
      node = node.parentElement;
    }
    return false;
  }

  function hostApi() { return window.__CJ_SHENGHAO_V2__ || null; }

  function isDisabled(el) {
    return el.disabled === true || el.getAttribute('aria-disabled') === 'true' || !!(el.closest && el.closest('[disabled]'));
  }

  /** 选出"真正会被点到的那个"：显式 index > 首个可见且可用的 > 首个可见的 > 第一个 */
  function choose(entries, o) {
    if (o.index != null) return { entry: entries[o.index], ambiguous: false, visibleCount: entries.filter((e) => e.vis.visible).length };
    const vis = entries.filter((e) => e.vis.visible);
    const usable = vis.filter((e) => !isDisabled(e.el));
    const entry = (o.skipDisabled ? usable[0] : vis[0]) || entries[0];
    return { entry, ambiguous: vis.length > 1, visibleCount: vis.length };
  }

  function busyFacts() {
    const api = hostApi();
    let busyReasons = null, err = null;
    try { busyReasons = api && api.inspect ? api.inspect().busyReasons : null; } catch (e) { err = String(e.message || e); }
    return { busyReasons, err };
  }

  function find(sel, opts) {
    const o = opts || {};
    const t = resolve(o.path);
    if (!t) return { found: false, count: 0, why: 'FRAME_NOT_FOUND', path: o.path || [] };
    let list = [];
    try { list = Array.from(t.doc.querySelectorAll(sel)); } catch (e) { return { found: false, count: 0, why: 'BAD_SELECTOR', error: String(e.message || e) }; }
    if (!list.length) return { found: false, count: 0, path: o.path || [], selector: sel };
    const entries = list.map((el) => ({ el, vis: visibleFacts(el, t.doc, t.win) }));
    const { entry, ambiguous, visibleCount } = choose(entries, o);
    const el = entry.el;
    const b = busyFacts();
    return {
      found: true, count: list.length, visibleCount, ambiguous, selector: sel, path: o.path || [], indexGiven: o.index != null,
      tag: el.tagName.toLowerCase(), id: el.id || '', cls: String(el.className || '').slice(0, 120), text: String(el.textContent || '').trim().slice(0, 80),
      disabled: isDisabled(el),
      ariaDisabled: el.getAttribute('aria-disabled') === 'true',
      pointerEventsNone: pointerChain(el, t.win),
      visibility: entry.vis,
      hostBusy: !!(b.busyReasons && (b.busyReasons.generation || b.busyReasons.setup || b.busyReasons.mvu || b.busyReasons.extra)),
      busyReasons: b.busyReasons,
    };
  }

  function snap() {
    const api = hostApi();
    let rev = null, wheel = null, inspect = null, state = null;
    try { const r = api && api.read ? api.read() : null; rev = r && r.state ? r.state.meta.revision : null; state = r; } catch { }
    try { wheel = api && api.wheelDebug ? api.wheelDebug() : null; } catch { }
    try { inspect = api && api.inspect ? api.inspect() : null; } catch { }
    let toast = '';
    try { const c = document.getElementById('toast-container'); toast = c ? String(c.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300) : ''; } catch { }
    let domLen = 0, nodes = 0;
    const list = framesRaw();
    for (const f of list) { try { domLen += f.doc ? f.doc.documentElement.innerHTML.length : 0; nodes += f.doc ? f.doc.querySelectorAll('*').length : 0; } catch { } }
    try { domLen += document.documentElement.innerHTML.length; nodes += document.querySelectorAll('*').length; } catch { }
    return {
      rev, toast, domLen, nodes,
      wheelMsgs: wheel && wheel.msgs ? wheel.msgs.slice(-12) : [],
      wheel: wheel ? { open: wheel.open, ready: wheel.ready, spinning: wheel.spinning, built: wheel.open ? true : false } : null,
      busyReasons: inspect ? inspect.busyReasons : null,
      floors: (window.SillyTavern && window.SillyTavern.getContext) ? (window.SillyTavern.getContext().chat || []).length : null,
    };
  }

  // ── 四道门 + 真实指针事件链 ────────────────────────────────────
  function tap(sel, opts) {
    const o = opts || {};
    const gateList = [];
    const facts = find(sel, o);
    if (!facts.found) return { ok: false, code: 'F1', facts, gates: [{ gate: 'exists', pass: false }] };
    gateList.push({ gate: 'exists', pass: true });
    if (facts.ambiguous) gateList.push({ gate: 'unambiguous', pass: false, count: facts.count, visibleCount: facts.visibleCount });
    else gateList.push({ gate: 'unambiguous', pass: true, count: facts.count, visibleCount: facts.visibleCount });
    const v = facts.visibility;
    if (!v.visible) return { ok: false, code: 'F2', facts, gates: gateList.concat([{ gate: 'visible', pass: false }]) };
    gateList.push({ gate: 'visible', pass: true });
    const clickable = !facts.disabled && !facts.pointerEventsNone && !v.coveredBy && !facts.hostBusy;
    gateList.push({ gate: 'clickable', pass: clickable, disabled: facts.disabled, pointerEventsNone: facts.pointerEventsNone, coveredBy: v.coveredBy, hostBusy: facts.hostBusy });
    if (!clickable) return { ok: false, code: 'F3', facts, gates: gateList };
    // 无阻塞弹窗门
    const t = resolve(o.path);
    let modal = null;
    try {
      const m = t.doc.querySelector('.popup:not([style*="display: none"]), dialog[open], #dialogue_popup[style*="display: flex"], .modal[style*="display: block"]');
      if (m) modal = (m.id || m.className || m.tagName).toString().slice(0, 80);
    } catch { }
    gateList.push({ gate: 'no-modal', pass: !modal, modal });
    if (modal && !o.allowModal) return { ok: false, code: 'F3', facts, gates: gateList, modal };

    const before = snap();
    // 必须与 find() 选中同一个节点，否则"判定的是 A、点的是 B"
    const rawList = Array.from(t.doc.querySelectorAll(sel));
    const chosen = choose(rawList.map((e2) => ({ el: e2, vis: visibleFacts(e2, t.doc, t.win) })), o).entry;
    const el = chosen.el;
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const win = t.win;
    const mk = (type, extra) => {
      const init = Object.assign({ bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true, view: win }, extra || {});
      let ev;
      try { ev = type.startsWith('pointer') ? new win.PointerEvent(type, init) : new win.MouseEvent(type, init); } catch { ev = new win.Event(type, { bubbles: true, cancelable: true }); }
      return ev;
    };
    try {
      el.dispatchEvent(mk('pointerover')); el.dispatchEvent(mk('pointerenter', { bubbles: false }));
      el.dispatchEvent(mk('pointerdown')); el.dispatchEvent(mk('mousedown'));
      try { el.focus && el.focus(); } catch { }
      el.dispatchEvent(mk('pointerup', { buttons: 0 })); el.dispatchEvent(mk('mouseup', { buttons: 0 }));
      el.dispatchEvent(mk('click', { buttons: 0, detail: 1 }));
    } catch (e) {
      return { ok: false, code: 'F7', facts, gates: gateList, error: String(e.message || e), before };
    }
    return { ok: true, facts, gates: gateList, before };
  }

  const api = {
    version: 1,
    frames, resolve: (p) => { const t = resolve(p); return t ? { ok: true } : { ok: false }; },
    installSentinel, reinstall, find, tap, snap,
    /** 全页文本（含所有同源 frame，跳过 script/style）：用于"这段文案到底在不在页面上"这类断言 */
    allText: (limit) => {
      const cap = limit || 300000;
      const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);
      const take = (doc) => {
        try {
          const w = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => (SKIP.has(n.parentNode && n.parentNode.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
          });
          const buf = [];
          let n;
          while ((n = w.nextNode())) buf.push(n.nodeValue);
          return buf.join(' ');
        } catch { return ''; }
      };
      let out = '';
      for (const f of framesRaw()) { try { out += take(f.doc) + '\n'; } catch { } }
      try { out += take(document); } catch { }
      return out.replace(/\s+/g, ' ').slice(0, cap);
    },
    violations: () => state.violations.slice(),
    clearViolations: () => { state.violations.length = 0; return true; },
    host: () => {
      const a = hostApi();
      if (!a) return { ok: false };
      const out = { ok: true };
      try { out.read = a.read(); } catch (e) { out.readError = String(e.message || e); }
      try { out.inspect = a.inspect(); } catch (e) { out.inspectError = String(e.message || e); }
      try { out.wheelDebug = a.wheelDebug(); } catch (e) { out.wheelDebugError = String(e.message || e); }
      return out;
    },
    opHistory: () => {
      const a = hostApi();
      try {
        const s = a.read().state;
        const h = s.operationHistory || {};
        const ids = Object.keys(h);
        const last = ids.slice(-3).map((id) => ({ id, status: h[id] && h[id].status, type: h[id] && h[id].type, result: h[id] && h[id].result }));
        return { count: ids.length, last };
      } catch (e) { return { count: null, error: String(e.message || e) }; }
    },
    // 全局 MutationObserver 计数器：判"点击有没有引起 DOM 变化"用
    startDomWatch: () => {
      if (window.__NOAPI_DOMWATCH__) return window.__NOAPI_DOMWATCH__.n;
      const w = { n: 0 };
      window.__NOAPI_DOMWATCH__ = w;
      const list = framesRaw();
      for (const f of list) {
        try {
          if (!f.doc) continue;
          const mo = new f.win.MutationObserver((muts) => { w.n += muts.length; });
          mo.observe(f.doc.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
        } catch { }
      }
      try { const mo = new MutationObserver((m) => { w.n += m.length; }); mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true }); } catch { }
      return 0;
    },
    domWatchCount: () => (window.__NOAPI_DOMWATCH__ ? window.__NOAPI_DOMWATCH__.n : -1),
  };

  window.__NOAPI__ = api;
  return { ok: true, version: 1 };
}

/** 宿主侧小工具：等待某个 page.evaluate 条件成立，且**失败也要给出最后快照** */
export async function waitFor(page, fn, arg, { timeout = 15000, interval = 250, label = 'wait' } = {}) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try { last = await page.evaluate(fn, arg); } catch (e) { last = { ok: false, error: String(e).slice(0, 200) }; }
    if (last === true || (last && last.ok === true)) return last;
    await page.waitForTimeout(interval);
  }
  return { ok: false, timeout: true, label, last };
}

/**
 * 取一个 space：优先复用同名的（ego 规矩：一个目标一个 space），没有才新建。
 * 用完必须 await finishSpace(task) —— 否则窗口会一直堆在任务栏里。
 */
export async function attachSpace(name = 'NOAPI-HARNESS') {
  const spaces = await listTaskSpaces();
  const found = spaces.find((s) => s.name === name && s.ownership === 'agent');
  const task = found ? await taskSpace(found.id) : await taskSpace(name);
  const pages = await task.pages();
  const page = pages[0] ?? (await task.adopt((await task.tabs())[0].page));
  console.log(`[NOAPI] space ${task.spaceId} ${found ? 'REUSED' : 'CREATED'} "${name}"`);
  return { task, page, spaceId: task.spaceId, reused: !!found };
}

/** 收尾：关掉这个 space（含其中所有页面）。留页面用 keep: ['p1']。 */
export async function finishSpace(task, keep = []) {
  if (!task) return { ok: false, why: 'no task' };
  try { const r = await task.finish({ keep }); console.log(`[NOAPI] space ${task.spaceId ?? ''} finish(${JSON.stringify(keep)})`); return { ok: true, result: r }; }
  catch (e) { console.log('[NOAPI] finish 失败：' + String(e.message || e)); return { ok: false, why: String(e.message || e) }; }
}
