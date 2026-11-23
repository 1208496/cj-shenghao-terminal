// rc.50：TOY·LINK 轻量适配层（取代旧 190KB vendor 适配层）。
// 职责：分支级佩戴态持久化、100ms 物理循环、注入提示词同步、tick 订阅通道。
// 规则逐条取自 RC50 方案 §2.2 / §4 / §6：tick 绝不触发 host 的 publish()；
// 只有 stop / 摘下正在运行对象 / 换分支 / destroy 会停机，物理引擎内部永不停机。
// rc.51：新增战术命令（scene / edge-lock / shock / burst）、处境持久化与手法轨迹。
//   规则取自 RC51 方案 §3.1–§3.5 / §6.2；注入仍保持事件驱动（方案 §8 风险 3）。
import {checkDeviceThreshold} from '../core/device-catalog.js';
import {
  TOY_MAX_PEAK, TOY_AWAY_SCENE_DEFAULT, stepToyTick, toyHz, toyMode, toyStackOf, toySceneOf, toyBurstMult,
  buildToyInputLine, buildToyPromptBlock, buildToyWearInputLine, buildToyWearPromptBlock,
  TOY_LITE_GEARS, toyLiteGearOf, buildToyLitePromptBlock
} from '../core/toylink-engine.js';

export const TOYLINK_STORAGE_PREFIX = 'cj-shenghao:toylink:v1:';
export const TOYLINK_PROMPT_ID = 'cj_shenghao_toylink_live';
// rc.52（方案 §4.2）：佩戴事件的一次性注入，生成结束即撤
export const TOYLINK_WEAR_PROMPT_ID = 'cj_shenghao_toylink_wear';
// rc.53（03 方案 §6.1）：极简版唯一注入 ID，与实验版两个 ID 严格互斥
export const TOYLINK_LITE_PROMPT_ID = 'cj_shenghao_toylink_lite';
// rc.53（03 方案 §2.2）：被门禁拦下的写命令
const LITE_WRITE_CMDS = ['wear', 'unwear', 'start', 'stop', 'gear'];
const LAB_WRITE_CMDS = ['wear', 'unwear', 'start', 'stop', 'mode', 'pow', 'freq', 'here', 'scene', 'edge-lock', 'shock', 'burst', 'write'];
const TICK_MS = 100;

const clampPow = (v) => Math.max(5, Math.min(100, Math.round(Number(v) || 55)));
const clampFreq = (v) => Math.max(5, Math.min(100, Math.round(Number(v) || 40)));

export function createToyLinkBridge(win, deps = {}) {
  const getBranchKey = typeof deps.getBranchKey === 'function' ? deps.getBranchKey : () => 'default';
  const getState = typeof deps.getState === 'function' ? deps.getState : () => null;
  const onStateChange = typeof deps.onStateChange === 'function' ? deps.onStateChange : () => {};

  let opened = false;
  let preview = false;
  let branchKey = '';
  let wearingIds = [];
  let last = {mode: 'wave', pow: 55, freq: 40, here: 'with', sceneId: TOY_AWAY_SCENE_DEFAULT};
  let run = freshRun();
  let timer = null;
  let lastTs = 0;
  let clock = 0;
  const subscribers = new Set();
  let lastFrame = null;
  // rc.52（方案 §4.2）：本轮尚未发送的佩戴引导，用于摘下时撤回与清理输入框
  let pendingWear = null;
  // rc.53（03 方案 §2.1）：模式锁。null = 两版均可进；'lite' / 'lab' = 占用中，另一版被门禁拦住。
  // C-34（YG 2026-11-23 18:46 批准）：摘光不自动解锁、load() 也不自愈清锁，只有 resetAll() 解锁。
  let activeMode = null;
  // rc.53（03 方案 §6.1）：本轮刚发生的事件态；GENERATION_ENDED 降级为持续态
  let liteEvent = null;
  let liteOpen = false;

  function freshRun() {
    return {
      running: false, selectedId: null, activeTargetId: null,
      mode: last.mode, pow: last.pow, freq: last.freq, here: last.here, sceneId: last.sceneId,
      aro: 0, env: 0, stage: 1, peak: 0,
      edgeLocked: false, edgeCount: 0, crave: 0, craveBurst: false,
      resisting: false, resistLeft: 0, resistCd: 0, breakCount: 0, endureCount: 0, shockCd: 0,
      exposure: 0, exposedCount: 0, sync: 0, heartSec: 0,
      trace: [], feedKey: 'idle', feedSubKey: '', burst: false, rushBreak: false
    };
  }

  const helper = () => {
    try { return win.TavernHelper || globalThis.TavernHelper || null; } catch { return null; }
  };

  function storageKey() {
    return TOYLINK_STORAGE_PREFIX + (branchKey || 'default');
  }

  // rc.51：处境随 here 一起持久化；本卡未发行，缺失时按 here 直接给默认处境（方案 §6.2）。
  function sanitizeLast(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const here = src.here === 'away' ? 'away' : 'with';
    // rc.52：现场没有处境；last.sceneId 只保存「最近一次有效的别处处境」
    let sceneId = typeof src.sceneId === 'string' ? src.sceneId : '';
    if (!toySceneOf(sceneId)) sceneId = TOY_AWAY_SCENE_DEFAULT;
    return {
      mode: toyMode(src.mode).id,
      pow: clampPow(src.pow),
      freq: clampFreq(src.freq),
      here,
      sceneId
    };
  }

  function load() {
    try {
      const raw = win.localStorage.getItem(storageKey());
      const data = raw ? JSON.parse(raw) : null;
      const ids = Array.isArray(data?.wearingIds) ? data.wearingIds.filter((x) => typeof x === 'string') : [];
      wearingIds = [...new Set(ids)];
      last = sanitizeLast(data?.last);
      // C-34：模式锁随分支持久化；不做「空佩戴自愈」，解锁只走 resetAll()。
      activeMode = (data?.activeMode === 'lite' || data?.activeMode === 'lab') ? data.activeMode : null;
    } catch {
      wearingIds = [];
      last = {mode: 'wave', pow: 55, freq: 40, here: 'with', sceneId: TOY_AWAY_SCENE_DEFAULT};
      activeMode = null;
    }
    return wearingIds.slice();
  }

  function save() {
    try {
      win.localStorage.setItem(storageKey(), JSON.stringify({wearingIds: wearingIds.slice(), activeMode, last, _touchedAt: Date.now()}));
    } catch { /* 存储失败不阻断本地计时 */ }
  }

  function womenOf() {
    const s = getState();
    return Object.values(s?.characters || {}).filter((c) => c.trackingState === 'RECORDED');
  }

  function charById(id) {
    if (!id) return null;
    const s = getState();
    return s?.characters?.[id] || null;
  }

  function currentSelected() {
    const list = womenOf();
    if (run.selectedId && list.some((c) => c.id === run.selectedId)) return charById(run.selectedId);
    const first = list[0] || null;
    run.selectedId = first ? first.id : null;
    return first;
  }

  // ---------- 手法轨迹（方案 §3.5：最多保留最近 5 个关键节点） ----------
  function pushTrace(label) {
    const t = Array.isArray(run.trace) ? run.trace.slice() : [];
    t.push(label);
    while (t.length > 5) t.shift();
    run.trace = t;
  }

  function traceEdge(count) {
    const t = Array.isArray(run.trace) ? run.trace.slice() : [];
    const label = '寸止×' + count;
    if (t.length && t[t.length - 1].startsWith('寸止')) t[t.length - 1] = label;
    else t.push(label);
    while (t.length > 5) t.shift();
    run.trace = t;
  }

  function setFeed(key) {
    run.feedSubKey = run.feedKey;
    run.feedKey = key;
  }

  // ---------- 注入 ----------
  function injectNow() {
    if (!run.running || !run.activeTargetId) return;
    const c = charById(run.activeTargetId);
    if (!c) return;
    const block = buildToyPromptBlock({...run, mode: run.mode, here: run.here}, c.name);
    const H = helper();
    if (!H || typeof H.injectPrompts !== 'function') return;
    const payload = {id: TOYLINK_PROMPT_ID, content: block, position: 'in_chat', depth: 1, role: 'system', should_scan: false};
    try {
      H.injectPrompts([payload]);
    } catch {
      try { H.injectPrompts(payload); } catch (err) { console.warn('[神豪终端] TOY·LINK 注入失败', err?.message || err); }
    }
  }

  function uninjectNow() {
    const H = helper();
    if (!H || typeof H.uninjectPrompts !== 'function') return;
    try { H.uninjectPrompts([TOYLINK_PROMPT_ID]); } catch { /* noop */ }
  }

  // 佩戴事件注入（一次性）：挂上与撤回都走这里，幂等由单 ID 保证
  function injectWearNow(block) {
    const H = helper();
    if (!H || typeof H.injectPrompts !== 'function') return false;
    const payload = {id: TOYLINK_WEAR_PROMPT_ID, content: block, position: 'in_chat', depth: 1, role: 'system', should_scan: false};
    try { H.injectPrompts([payload]); return true; } catch {
      try { H.injectPrompts(payload); return true; } catch { return false; }
    }
  }

  function uninjectWear() {
    const H = helper();
    if (!H || typeof H.uninjectPrompts !== 'function') return;
    try { H.uninjectPrompts([TOYLINK_WEAR_PROMPT_ID]); } catch { /* noop */ }
  }

  function clearPendingWear() {
    if (!pendingWear) return null;
    uninjectWear();
    const was = pendingWear;
    pendingWear = null;
    return was;
  }

  function getPendingWear() { return pendingWear; }

  // ---------- rc.53 极简版注入（03 方案 §6.2：只写自己 ID，不双边互撤） ----------
  function uninjectLite() {
    const H = helper();
    if (!H || typeof H.uninjectPrompts !== 'function') return;
    try { H.uninjectPrompts([TOYLINK_LITE_PROMPT_ID]); } catch { /* noop */ }
  }

  // 统一全清点：只在这里、切聊天、销毁三处一次性撤掉三个 ID
  function uninjectAll() {
    const H = helper();
    if (!H || typeof H.uninjectPrompts !== 'function') return;
    try { H.uninjectPrompts([TOYLINK_LITE_PROMPT_ID, TOYLINK_PROMPT_ID, TOYLINK_WEAR_PROMPT_ID]); } catch { /* noop */ }
  }

  function syncLiteInjection() {
    if (activeMode !== 'lite' || !wearingIds.length) { uninjectLite(); return false; }
    const H = helper();
    if (!H || typeof H.injectPrompts !== 'function') return false;
    const targetId = (liteEvent && liteEvent.charId) || run.activeTargetId || run.selectedId || wearingIds[0];
    const c = charById(targetId);
    if (!c) { uninjectLite(); return false; }
    const others = wearingIds.filter((id) => id !== targetId).map((id) => (charById(id) || {}).name).filter(Boolean);
    const block = buildToyLitePromptBlock({
      event: liteEvent,
      name: c.name,
      names: wearingIds.map((id) => (charById(id) || {}).name).filter(Boolean).join('、') || c.name,
      gear: (liteEvent && liteEvent.gear != null) ? liteEvent.gear : toyLiteGearOf(run.pow),
      pow: run.pow,
      running: run.running,
      otherWornNames: run.running ? others.join('、') : ''
    });
    const payload = {id: TOYLINK_LITE_PROMPT_ID, content: block.content, position: 'in_chat', depth: 1, role: 'system', should_scan: false};
    try { H.injectPrompts([payload]); return true; } catch {
      try { H.injectPrompts(payload); return true; } catch { return false; }
    }
  }

  // 生成结束：事件态降级为持续态（03 方案 §6.2 规则 3）
  function onLiteGenerationEnded() {
    if (activeMode !== 'lite') return false;
    liteEvent = null;
    return syncLiteInjection();
  }

  // 一键清空（03 方案 §3.1 第 2–5 步；关宽屏由宿主在调用前完成）
  function resetAll() {
    stopTimer();
    wearingIds = [];
    pendingWear = null;
    liteEvent = null;
    activeMode = null;
    last = {mode: 'wave', pow: 55, freq: 40, here: 'with', sceneId: TOY_AWAY_SCENE_DEFAULT};
    run = freshRun();
    run.mode = last.mode;
    run.pow = last.pow;
    run.freq = last.freq;
    run.here = last.here;
    run.sceneId = last.sceneId;
    clock = 0;
    lastFrame = null;
    run.selectedId = null;
    currentSelected();
    uninjectAll();
    try { win.localStorage.removeItem(storageKey()); } catch { /* noop */ }
    onStateChange();
    emit();
    return {ok: true};
  }

  // ---------- 帧 ----------
  function frame(extra = {}) {
    const stack = toyStackOf(run.peak);
    return {
      running: run.running,
      targetId: run.activeTargetId,
      selectedId: run.selectedId,
      aro: run.aro,
      env: run.env,
      stage: run.stage,
      peak: stack.peak,
      tier: stack.tier,
      tierLabel: stack.tierLabel,
      rateMult: stack.rateMult,
      envMult: stack.envMult,
      capped: stack.capped,
      modeId: run.mode,
      modeName: toyMode(run.mode).name,
      pow: run.pow,
      freq: run.freq,
      hz: toyHz(run.freq),
      here: run.here,
      sceneId: run.here === 'away' ? run.sceneId : null,
      sceneLabel: run.here === 'away' ? ((toySceneOf(run.sceneId) || {}).label || '') : '',
      lastAwaySceneId: last.sceneId || TOY_AWAY_SCENE_DEFAULT,
      edgeLocked: run.edgeLocked,
      edgeCount: run.edgeCount,
      crave: run.crave,
      resisting: run.resisting,
      resistLeft: run.resistLeft,
      breakCount: run.breakCount,
      shockCd: run.shockCd,
      exposure: run.exposure,
      exposedCount: run.exposedCount,
      sync: run.sync,
      feedKey: run.feedKey,
      feedSubKey: run.feedSubKey,
      burstMult: toyBurstMult(run.edgeCount),
      burstReady: run.edgeCount >= 1,
      ...extra
    };
  }

  function emit(extra) {
    lastFrame = frame(extra);
    for (const fn of subscribers) {
      try { fn(lastFrame); } catch { /* 订阅者异常不影响物理 */ }
    }
    return lastFrame;
  }

  // ---------- 物理 ----------
  function tick() {
    if (!run.running) return;
    const now = Date.now();
    const dt = lastTs ? Math.min(0.5, (now - lastTs) / 1000) : TICK_MS / 1000;
    lastTs = now;
    clock += dt;
    const res = stepToyTick({...run}, dt, clock);
    run = {...run, ...res.nextRun};
    run.env = res.env;
    if (res.edgeHit) traceEdge(run.edgeCount);
    if (res.peaked) pushTrace('绝顶×' + run.peak);
    if (res.peaked || res.stageChanged || res.edgeHit || res.resistBroken || res.exposedHit) injectNow();
    emit({
      peaked: res.peaked,
      stageChanged: res.stageChanged,
      edgeHit: res.edgeHit,
      resistStarted: res.resistStarted,
      resistPassed: res.resistPassed,
      exposedHit: res.exposedHit,
      crit: res.crit
    });
  }

  function startTimer() {
    if (timer) return;
    lastTs = 0;
    timer = setInterval(tick, TICK_MS);
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    lastTs = 0;
  }

  function stopRun(quiet) {
    const was = run.running;
    run.running = false;
    run.activeTargetId = null;
    stopTimer();
    uninjectNow();
    if (!quiet) onStateChange();
    if (was) emit();
    return was;
  }

  // ---------- 生命周期 ----------
  function open({preview: previewMode = false, targetCharacterId = null} = {}) {
    opened = true;
    preview = !!previewMode;
    if (!branchKey) load();
    if (targetCharacterId && charById(targetCharacterId)) run.selectedId = targetCharacterId;
    if (!run.selectedId) currentSelected();
    if (!run.running) {
      run.mode = last.mode;
      run.pow = last.pow;
      run.freq = last.freq;
      run.here = last.here;
      run.sceneId = last.sceneId;
    }
    return snapshot();
  }

  function close() {
    opened = false;
    return {ok: true};
  }

  // rc.53：极简版面板打开/关闭（手机内嵌，不走 iframe；preview 与实验版共用同一开关）
  function openLite({preview: previewMode = false} = {}) {
    liteOpen = true;
    preview = !!previewMode;
    if (!branchKey) load();
    if (!run.selectedId) currentSelected();
    return snapshot();
  }

  function closeLite() {
    liteOpen = false;
    return {ok: true};
  }

  function onBranchChange() {
    stopRun(true);
    clearPendingWear();
    branchKey = String(getBranchKey() || '');
    load();
    // rc.55 / B-09：上一个聊天没消费掉的事件态（佩戴 / 启动 / 换档）必须在这里清掉。
    // syncLiteInjection 优先用 liteEvent.charId，留着它就会把旧聊天的人物名与事件注入新聊天。
    liteEvent = null;
    uninjectAll();
    run = freshRun();
    run.mode = last.mode;
    run.pow = last.pow;
    run.freq = last.freq;
    run.here = last.here;
    run.sceneId = last.sceneId;
    // 03 方案 §2.3：新分支若仍锁在极简版且有佩戴者，恢复持续佩戴态注入
    if (activeMode === 'lite' && wearingIds.length) syncLiteInjection();
    currentSelected();
    onStateChange();
    return snapshot();
  }

  function destroy() {
    stopRun(true);
    clearPendingWear();
    uninjectAll();
    subscribers.clear();
    opened = false;
    liteOpen = false;
    preview = false;
    lastFrame = null;
  }

  // ---------- 命令 ----------
  function action(cmd, payload = {}) {
    // rc.53（03 方案 §2.2 guardLab）：极简版占用时，实验版写命令一律拦下
    if (activeMode === 'lite' && LAB_WRITE_CMDS.includes(cmd)) return {ok: false, code: 'TOYLINK_MODE_LOCKED', lockedBy: 'lite'};
    switch (cmd) {
      case 'select': {
        const c = charById(payload.id);
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        run.selectedId = c.id;
        return {ok: true};
      }
      case 'wear': {
        const c = charById(payload.id || run.selectedId) || currentSelected();
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        if (preview) return {ok: false, code: 'TOYLINK_LOCKED'};
        if (!checkDeviceThreshold(c).eligible) return {ok: false, code: 'DEVICE_THRESHOLD_NOT_MET'};
        const here = payload.here === 'away' ? 'away' : 'with';
        const sc = here === 'away' ? toySceneOf(payload.sceneId) : null;
        const sceneId = here === 'away' ? ((sc && payload.sceneId) || last.sceneId || TOY_AWAY_SCENE_DEFAULT) : null;
        if (wearingIds.indexOf(c.id) >= 0) {
          return {ok: true, already: true, name: c.name, here, sceneId};
        }
        wearingIds.push(c.id);
        // rc.53：实验版真正写入占用状态时上锁（只浏览/选人不上锁）
        if (!activeMode) activeMode = 'lab';
        run.here = here;
        last.here = here;
        if (here === 'away') { run.sceneId = sceneId; last.sceneId = sceneId; } else { run.sceneId = null; }
        const wearInputLine = buildToyWearInputLine(c.name, here, sceneId);
        const wearBlock = buildToyWearPromptBlock(c.name, here, sceneId);
        injectWearNow(wearBlock);
        pendingWear = {charId: c.id, here, sceneId, exactText: wearInputLine};
        save();
        onStateChange();
        return {ok: true, name: c.name, here, sceneId, wearInputLine};
      }
      case 'unwear': {
        const c = charById(payload.id || run.selectedId) || currentSelected();
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        let pendingWearText = '';
        if (pendingWear && pendingWear.charId === c.id) {
          const was = clearPendingWear();
          pendingWearText = was ? was.exactText : '';
        }
        wearingIds = wearingIds.filter((x) => x !== c.id);
        save();
        if (run.running && run.activeTargetId === c.id) stopRun(true);
        onStateChange();
        return {ok: true, name: c.name, pendingWearText};
      }
      case 'mode': {
        const m = toyMode(payload.id);
        if (!m) return {ok: false, code: 'UNKNOWN_ITEM'};
        const prev = run.mode;
        run.mode = m.id;
        last.mode = m.id;
        // 方案 §3.1 / §3.6：撩拨吊到 crave≥60 后换模式 → 下一次绝顶溃堤双绝顶
        if (prev === 'tease' && m.id !== 'tease' && run.crave >= 60) run.craveBurst = true;
        // 方案 §2.1 rush：edgeCount ≥2 或 crave ≥60 后切入 → 首轮直接秒破 100%
        if (m.id === 'rush' && (run.edgeCount >= 2 || run.crave >= 60)) run.rushBreak = true;
        if (prev !== m.id) pushTrace(m.name);
        save();
        if (run.running) injectNow();
        emit({});
        return {ok: true, modeId: m.id};
      }
      case 'pow': {
        run.pow = clampPow(run.pow + Number(payload.delta || 0));
        last.pow = run.pow;
        save();
        if (run.running) injectNow();
        emit({});
        return {ok: true, pow: run.pow};
      }
      case 'freq': {
        run.freq = clampFreq(run.freq + Number(payload.delta || 0));
        last.freq = run.freq;
        save();
        if (run.running) injectNow();
        emit({});
        return {ok: true, freq: run.freq};
      }
      case 'here': {
        run.here = payload.value === 'away' ? 'away' : 'with';
        last.here = run.here;
        // 方案 §7.3-3：切现场时 sceneId 置 null 且不动 last.sceneId；切别处恢复上次别处处境
        if (run.here === 'away') {
          const sid = toySceneOf(run.sceneId) ? run.sceneId : (last.sceneId || TOY_AWAY_SCENE_DEFAULT);
          run.sceneId = sid;
          last.sceneId = sid;
        } else {
          run.sceneId = null;
        }
        save();
        if (run.running) injectNow();
        emit({});
        return {ok: true, here: run.here, sceneId: run.sceneId};
      }
      case 'scene': {
        // 方案 §6.1：切换当前处境，处境自带 here，二者保持一致
        const sc = toySceneOf(payload.id);
        if (!sc) return {ok: false, code: 'UNKNOWN_ITEM'};
        run.sceneId = payload.id;
        run.here = sc.here === 'away' ? 'away' : 'with';
        last.sceneId = run.sceneId;
        last.here = run.here;
        save();
        if (run.running) injectNow();
        emit({});
        return {ok: true, sceneId: run.sceneId, here: run.here};
      }
      case 'edge-lock': {
        // 方案 §6.1：开关寸止锁（on 省略即取反）
        const on = typeof payload.on === 'boolean' ? payload.on : !run.edgeLocked;
        run.edgeLocked = on;
        if (on) pushTrace('寸止锁');
        if (run.running) injectNow();
        emit({});
        return {ok: true, edgeLocked: on};
      }
      case 'shock': {
        // 方案 §6.1：瞬时强刺（破除 resisting 并 +18 aro），冷却 4 秒
        if (run.shockCd > 0) return {ok: true, skip: 'cooldown', shockCd: run.shockCd};
        const cap = (run.edgeLocked || run.mode === 'edge') ? 96 : (run.mode === 'tease' ? 85 : 100);
        run.shockCd = 4;
        run.env = 1;
        if (run.resisting) {
          run.resisting = false;
          run.resistLeft = 0;
          run.breakCount += 1;
          run.aro = Math.min(cap, run.aro + 18);
          setFeed('shock_hit');
          pushTrace('强刺破防');
        } else {
          run.aro = Math.min(cap, run.aro + 18);
          setFeed('shock_normal');
          pushTrace('瞬时强刺');
        }
        if (run.running) injectNow();
        emit({});
        return {ok: true, breakCount: run.breakCount, aro: run.aro};
      }
      case 'burst': {
        // 方案 §6.1：解除寸止锁并引爆积累的 edgeCount 势能
        if (run.edgeCount < 1) return {ok: false, code: 'UNKNOWN_ITEM'};
        const mult = toyBurstMult(run.edgeCount);
        run.edgeLocked = false;
        run.burst = true;
        setFeed('burst_release');
        pushTrace('破顶释放');
        if (run.running) injectNow();
        emit({});
        return {ok: true, mult, edgeCount: run.edgeCount};
      }
      case 'start': {
        if (preview) return {ok: false, code: 'TOYLINK_LOCKED'};
        const c = charById(payload.id || run.selectedId) || currentSelected();
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        if (!checkDeviceThreshold(c).eligible) return {ok: false, code: 'DEVICE_THRESHOLD_NOT_MET'};
        if (wearingIds.indexOf(c.id) < 0) return {ok: false, code: 'TOYLINK_NOT_WORN'};
        if (run.running) {
          if (run.activeTargetId === c.id) return {ok: true, already: true};
          stopRun(true);
        }
        run.selectedId = c.id;
        run.activeTargetId = c.id;
        run.running = true;
        // rc.53：实验版启动即上锁
        if (!activeMode) activeMode = 'lab';
        run.aro = 0;
        run.env = 0;
        run.stage = 1;
        run.peak = 0;
        run.edgeLocked = false;
        run.edgeCount = 0;
        run.crave = 0;
        run.craveBurst = false;
        run.resisting = false;
        run.resistLeft = 0;
        run.resistCd = 0;
        run.breakCount = 0;
        run.endureCount = 0;
        run.shockCd = 0;
        run.exposure = 0;
        run.exposedCount = 0;
        run.sync = 0;
        run.heartSec = 0;
        run.trace = [];
        run.burst = false;
        run.rushBreak = false;
        setFeed(run.here === 'with' ? 'start_with' : 'start_away');
        clock = 0;
        startTimer();
        injectNow();
        onStateChange();
        emit();
        return {ok: true, name: c.name};
      }
      case 'stop': {
        if (!run.running) return {ok: true};
        const was = run.activeTargetId;
        stopRun(false);
        return {ok: true, was};
      }
      case 'write': {
        const c = charById(run.activeTargetId || run.selectedId) || currentSelected();
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        const inputLine = buildToyInputLine({...run, aro: run.aro, stage: run.stage, peak: run.peak}, c.name, run.here);
        return {ok: true, inputLine, name: c.name};
      }
      default:
        return {ok: false, code: 'UNKNOWN_ITEM'};
    }
  }

  // ---------- rc.53 极简版命令（六个动作，不启 100ms 定时器、不填输入框） ----------
  function liteAction(cmd, payload = {}) {
    // 03 方案 §2.2 guardLite：实验版占用时极简版只读
    if (activeMode === 'lab' && LITE_WRITE_CMDS.includes(cmd)) return {ok: false, code: 'TOYLINK_MODE_LOCKED', lockedBy: 'lab'};
    switch (cmd) {
      case 'select': {
        const c = charById(payload.id);
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        run.selectedId = c.id;
        return {ok: true, id: c.id};
      }
      case 'wear': {
        const c = charById(payload.id || run.selectedId) || currentSelected();
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        if (preview) return {ok: false, code: 'TOYLINK_LOCKED'};
        if (!checkDeviceThreshold(c).eligible) return {ok: false, code: 'DEVICE_THRESHOLD_NOT_MET'};
        if (run.running && run.activeTargetId && run.activeTargetId !== c.id) return {ok: false, code: 'TOYLINK_OTHER_RUNNING'};
        const already = wearingIds.indexOf(c.id) >= 0;
        if (!already) wearingIds.push(c.id);
        run.selectedId = c.id;
        if (!activeMode) activeMode = 'lite';
        liteEvent = {type: 'worn', charId: c.id};
        save();
        syncLiteInjection();
        onStateChange();
        return {ok: true, name: c.name, gear: toyLiteGearOf(run.pow), already};
      }
      case 'unwear': {
        const c = charById(payload.id || run.selectedId) || currentSelected();
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        const wasRunning = run.running && run.activeTargetId === c.id;
        wearingIds = wearingIds.filter((x) => x !== c.id);
        if (wasRunning) { run.running = false; run.activeTargetId = null; }
        liteEvent = null;
        // C-34：摘光不放锁，必须显式「清空状态」才能解除
        save();
        syncLiteInjection();
        onStateChange();
        emit();
        return {ok: true, name: c.name, stopped: wasRunning, wearingIds: wearingIds.slice()};
      }
      case 'start': {
        if (preview) return {ok: false, code: 'TOYLINK_LOCKED'};
        const c = charById(payload.id || run.selectedId) || currentSelected();
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        if (!checkDeviceThreshold(c).eligible) return {ok: false, code: 'DEVICE_THRESHOLD_NOT_MET'};
        if (wearingIds.indexOf(c.id) < 0) return {ok: false, code: 'TOYLINK_NOT_WORN'};
        if (run.running && run.activeTargetId && run.activeTargetId !== c.id) return {ok: false, code: 'TOYLINK_OTHER_RUNNING'};
        const gear = toyLiteGearOf(run.pow);
        run.selectedId = c.id;
        run.activeTargetId = c.id;
        run.running = true;
        run.pow = TOY_LITE_GEARS[gear - 1];
        last.pow = run.pow;
        if (!activeMode) activeMode = 'lite';
        liteEvent = {type: 'started', charId: c.id, gear};
        // 03 方案 §2.3：极简版不启动 100ms 定时器
        save();
        syncLiteInjection();
        onStateChange();
        emit();
        return {ok: true, name: c.name, gear};
      }
      case 'stop': {
        if (!run.running) return {ok: true, already: true};
        const c = charById(run.activeTargetId);
        run.running = false;
        run.activeTargetId = null;
        liteEvent = {type: 'stopped', charId: c ? c.id : null};
        save();
        syncLiteInjection();
        onStateChange();
        emit();
        return {ok: true, name: c ? c.name : '', gear: toyLiteGearOf(run.pow)};
      }
      case 'gear': {
        const c = charById(payload.id || run.selectedId) || currentSelected();
        if (!c) return {ok: false, code: 'NO_RECORDED_WOMAN'};
        if (!checkDeviceThreshold(c).eligible) return {ok: false, code: 'DEVICE_THRESHOLD_NOT_MET'};
        if (wearingIds.indexOf(c.id) < 0) return {ok: false, code: 'TOYLINK_NOT_WORN'};
        const gear = Math.max(1, Math.min(3, Number(payload.gear) || 1));
        const prevGear = toyLiteGearOf(run.pow);
        run.pow = TOY_LITE_GEARS[gear - 1];
        last.pow = run.pow;
        if (run.running) liteEvent = {type: 'gear_changed', charId: run.activeTargetId || c.id, gear, prevGear};
        else liteEvent = null;
        save();
        syncLiteInjection();
        onStateChange();
        emit();
        return {ok: true, name: c.name, gear, prevGear, running: run.running};
      }
      default:
        return {ok: false, code: 'UNKNOWN_ITEM'};
    }
  }

  function snapshot() {
    const f = lastFrame || frame();
    return {
      opened,
      preview,
      running: run.running,
      selectedId: run.selectedId,
      activeTargetId: run.activeTargetId,
      modeId: run.mode,
      modeName: toyMode(run.mode).name,
      pow: run.pow,
      freq: run.freq,
      hz: toyHz(run.freq),
      here: run.here,
      sceneId: run.here === 'away' ? run.sceneId : null,
      sceneLabel: run.here === 'away' ? ((toySceneOf(run.sceneId) || {}).label || '') : '',
      lastAwaySceneId: last.sceneId || TOY_AWAY_SCENE_DEFAULT,
      aro: run.aro,
      env: run.env,
      stage: run.stage,
      peak: toyStackOf(f.peak).peak,
      tier: f.tier,
      tierLabel: f.tierLabel,
      rateMult: f.rateMult,
      edgeLocked: run.edgeLocked,
      edgeCount: run.edgeCount,
      crave: run.crave,
      resisting: run.resisting,
      breakCount: run.breakCount,
      shockCd: run.shockCd,
      exposure: run.exposure,
      exposedCount: run.exposedCount,
      feedKey: run.feedKey,
      feedSubKey: run.feedSubKey,
      sync: run.sync,
      burstMult: toyBurstMult(run.edgeCount),
      trace: Array.isArray(run.trace) ? run.trace.slice() : [],
      wearingIds: wearingIds.slice(),
      activeMode,
      liteGear: toyLiteGearOf(run.pow),
      liteOpened: liteOpen
    };
  }

  function subscribeTick(fn) {
    if (typeof fn !== 'function') return () => {};
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  branchKey = String(getBranchKey() || '');
  load();
  run.mode = last.mode;
  run.pow = last.pow;
  run.freq = last.freq;
  run.here = last.here;
  run.sceneId = last.sceneId;

  return {
    open,
    close,
    openLite,
    closeLite,
    destroy,
    onBranchChange,
    action,
    liteAction,
    resetAll,
    onLiteGenerationEnded,
    subscribeTick,
    snapshot,
    clearPendingWear,
    getPendingWear,
    get wearingIds() { return wearingIds.slice(); },
    get running() { return run.running; },
    get preview() { return preview; },
    get opened() { return opened; },
    get activeMode() { return activeMode; },
    TOY_MAX_PEAK
  };
}

