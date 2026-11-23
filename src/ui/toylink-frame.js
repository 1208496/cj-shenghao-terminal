// rc.52：TOY·LINK 独立宽屏帧逻辑（顶层 iframe 内运行）。
// DOM / 类名 / 数值取自 4N 原型 `RC52总方案/03_原型/toy-wide-proto.html`（由 extract-rc52-toywide.mjs 抽成模板与样式）；
// 本文件只负责：握手、按宿主快照渲染、100ms 帧局部绘帧、双步佩戴状态机、控件事件 → 通道命令。
// 三条防坑（rc.49 教训）：不校验 event.source、READY 300ms×20 重发、模板零演示值。
import {WHEEL_COPY, fill} from '../core/wheel-ui-copy.js';
import {TOY_STAGE_CN, toyMode, toyHz, toyStackOf, toyBurstMult, toyFeedText} from '../core/toylink-engine.js';
import {checkDeviceThreshold} from '../core/device-catalog.js';

const CHANNEL = 'CJ_SHENGHAO_TOYLINK_V1';
const C_ARO = 2 * Math.PI * 52;
const C_ENV = 2 * Math.PI * 44;

const T = () => WHEEL_COPY.workshop.toylink;
const $ = (id) => document.getElementById(id);
const MODES = () => WHEEL_COPY.workshop.toylink.modes || [];

let nonce = '';
let view = null;
let ready = false;
let built = false;
let readyTimer = null;
let reqSeq = 0;
const pending = new Map();
const modal = {open: false, step: 1, loc: '', scene: ''};

// ---------- 通道 ----------
function post(type, payload) {
  try {
    window.parent.postMessage({channel: CHANNEL, nonce, type, ...(payload || {})}, '*');
  } catch { /* 顶层不可达时静默 */ }
}

function startReadyLoop() {
  let n = 0;
  const fire = () => {
    if (ready || n >= 20) { clearInterval(readyTimer); readyTimer = null; return; }
    n += 1;
    post('TOYLINK_READY');
  };
  fire();
  readyTimer = setInterval(fire, 300);
}

function act(cmd, payload) {
  return new Promise((resolve) => {
    const reqId = 'r' + (++reqSeq);
    pending.set(reqId, resolve);
    post('TOYLINK_ACTION', {reqId, cmd, payload: payload || {}});
    setTimeout(() => {
      if (pending.has(reqId)) { pending.delete(reqId); resolve({ok: false, code: 'TIMEOUT'}); }
    }, 8000);
  });
}

window.addEventListener('message', (e) => {
  const d = e && e.data;
  if (!d || d.channel !== CHANNEL) return;
  if (d.type === 'TOYLINK_INIT' || d.type === 'TOYLINK_OPEN') {
    if (d.nonce) nonce = d.nonce;
    ready = true;
    if (readyTimer) { clearInterval(readyTimer); readyTimer = null; }
    // 复用同一个 iframe 再次打开时，必须清掉上次退场动画留下的 is-closing（否则整页 opacity:0）
    const ovEl = $('tlOverlay');
    if (ovEl) { ovEl.hidden = false; ovEl.classList.remove('is-closing'); }
    if (d.view) { view = d.view; renderAll(); }
    if (!built) { built = true; post('TOYLINK_BUILT'); }
    return;
  }
  if (d.type === 'TOYLINK_STATE_SYNC') {
    if (d.view) { view = d.view; renderAll(); }
    return;
  }
  if (d.type === 'TOYLINK_TICK') {
    if (d.frame) paintFrame(d.frame);
    return;
  }
  if (d.type === 'TOYLINK_ACTION_RES') {
    if (d.view) { view = d.view; }
    const done = pending.get(d.reqId);
    if (done) { pending.delete(d.reqId); done(d); }
    else renderAll();
    return;
  }
  if (d.type === 'TOYLINK_CLOSE_ANIMATE') {
    const ov = $('tlOverlay');
    if (ov) ov.classList.add('is-closing');
    setTimeout(() => post('TOYLINK_CLOSE_DONE'), 180);
    return;
  }
  if (d.type === 'TOYLINK_CLOSE') {
    const ov = $('tlOverlay');
    if (ov) ov.hidden = true;
  }
});

// ---------- 视图计算 ----------
function toy() { return (view && view.toyState) || {}; }
function chars() { return (view && view.characters) || []; }
function curChar() {
  const t = toy();
  return chars().find((c) => c.id === t.selectedId) || chars()[0] || null;
}
function isLiveOf(c) {
  const t = toy();
  return !!t.running && !!c && t.activeTargetId === c.id;
}
function wornOf(c) {
  const t = toy();
  return !!(c && Array.isArray(t.wearingIds) && t.wearingIds.indexOf(c.id) >= 0);
}
function gateOf(c) {
  const g = checkDeviceThreshold(c);
  return {eligible: g.eligible, affection: g.affection, corruption: g.corruption, affGap: g.affGap, corGap: g.corGap};
}

function toast(msg) {
  const t = $('tlToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------- 全量渲染 ----------
function renderAll() {
  const Tt = T();
  const t = toy();
  const c = curChar();
  const list = chars();
  document.documentElement.style.setProperty('--cj-font-scale', String(view?.fontScale || 1));

  // 顶栏对象胶囊条
  const strip = $('tlTargetStrip');
  if (strip) {
    strip.innerHTML = list.map((ch) => {
      const g = gateOf(ch);
      const cw = wornOf(ch);
      const cl = t.running && t.activeTargetId === ch.id;
      const stTxt = cl ? Tt.tagLive : (!g.eligible ? Tt.tagBlocked : (cw ? Tt.tagWorn : Tt.tagUnworn));
      const stCls = cl ? ' is-live' : (cw ? ' is-worn' : '');
      return `<button type="button" class="tl-char-chip${c && ch.id === c.id ? ' on' : ''}${g.eligible ? '' : ' is-blocked'}" data-tl-target="${esc(ch.id)}">`
        + `<span class="tl-av">${esc(String(ch.name || '').slice(0, 1))}</span><span>${esc(ch.name)}</span>`
        + `<span class="tl-chip-st${stCls}">${esc(stTxt)}</span></button>`;
    }).join('');
  }
  const wornCnt = $('tlWornCnt');
  if (wornCnt) wornCnt.textContent = fill(Tt.wornCount, {n: Array.isArray(t.wearingIds) ? t.wearingIds.length : 0});

  // 状态胶囊
  const pill = $('tlTopPill');
  if (pill) {
    pill.className = 'tl-status-pill' + (t.preview ? ' is-locked' : (t.running ? ' is-live' : ''));
    pill.textContent = t.preview ? Tt.pillLocked : (t.running ? fill(Tt.pillLive, {modeName: t.modeName || '', peak: toyStackOf(t.peak).peak}) : Tt.pillIdle);
  }

  const showGate = !t.preview && (!c || !gateOf(c).eligible);
  const lockBanner = $('tlLockedBanner');
  if (lockBanner) lockBanner.hidden = !t.preview;
  const gateBanner = $('tlGateBanner');
  if (gateBanner) gateBanner.hidden = !showGate;
  if (showGate) {
    const g = gateOf(c);
    setText('tlGateTitle', c ? fill(Tt.gateTitle, {name: c.name}) : Tt.gateNoWoman);
    setText('tlGateDesc', c ? fill(Tt.gateDesc, {affGap: g.affGap, corGap: g.corGap}) : Tt.gateNoWoman);
    const gm = $('tlGateMetrics');
    if (gm) gm.innerHTML = c
      ? `<span class="tl-gate-pill">${esc(fill(WHEEL_COPY.workshop.common.gateMetricAff, {affection: g.affection, affGap: g.affGap}))}</span><span class="tl-gate-pill">${esc(fill(WHEEL_COPY.workshop.common.gateMetricCor, {corruption: g.corruption, corGap: g.corGap}))}</span>`
      : '';
  }

  // 左栏佩戴条
  const worn = wornOf(c);
  const live = isLiveOf(c);
  setText('tlWearAv', c ? String(c.name || '').slice(0, 1) : '—');
  setText('tlWearName', c ? c.name : '—');
  const wTag = $('tlWearTag');
  if (wTag) {
    wTag.textContent = live ? Tt.tagLive : (worn ? Tt.tagWorn : Tt.tagUnworn);
    wTag.className = 'tl-wear-tag' + (live ? ' is-live' : (worn ? ' is-worn' : ''));
  }
  const nums = $('tlWearNums');
  if (nums) nums.textContent = c ? fill(Tt.wearNums, {affection: gateOf(c).affection, corruption: gateOf(c).corruption}) : '';
  const wBtn = $('tlBtnWear');
  if (wBtn) {
    wBtn.textContent = worn ? Tt.btnUnwear : Tt.btnWear;
    wBtn.className = 'tl-wear-btn' + (worn ? ' is-unwear' : '');
    wBtn.disabled = !!t.preview || !c || (!worn && !gateOf(c).eligible);
  }

  // 舞台提示
  const otherChar = chars().find((x) => x.id === t.activeTargetId) || null;
  let hintText = '';
  if (!t.preview && c && gateOf(c).eligible && !live) {
    if (t.running && t.activeTargetId && t.activeTargetId !== c.id) hintText = fill(Tt.otherRunningHint, {name: otherChar ? otherChar.name : ''});
    else if (!worn) hintText = fill(Tt.wearHint, {name: c.name});
  }
  const hintEl = $('tlStageHint');
  if (hintEl) { hintEl.textContent = hintText; hintEl.hidden = !hintText; }

  // 九模网格（图标 / 名称 / 一词特性）
  const grid = $('tlModeGrid');
  if (grid) {
    grid.innerHTML = MODES().map((m) => `<button type="button" class="tl-mode-btn${m.id === t.modeId ? ' on' : ''}" data-tl-mode="${esc(m.id)}"${t.preview ? ' disabled' : ''}>`
      + `<svg viewBox="0 0 24 24">${m.icon}</svg>`
      + `<span class="tl-mode-copy"><b>${esc(m.name)}</b><small>${esc(m.tag)}</small></span></button>`).join('');
  }
  const mode = toyMode(t.modeId);
  setText('tlModeHdRight', fill(Tt.modeHd, {modeName: mode.name}));
  setText('tlModeNote', mode.feel);
  setText('tlLegendSpec', `${mode.name} · ${Math.round(Number(t.pow) || 0)}% · ${toyHz(Number(t.freq) || 40)}Hz`);

  // 参数
  const pow = Math.max(5, Math.min(100, Number(t.pow) || 55));
  const freq = Math.max(5, Math.min(100, Number(t.freq) || 40));
  const powBar = $('tlPowBar');
  if (powBar) powBar.style.width = pow + '%';
  setText('tlPowVal', pow + '%');
  const freqBar = $('tlFreqBar');
  if (freqBar) freqBar.style.width = freq + '%';
  setText('tlFreqVal', toyHz(freq) + 'Hz');
  document.querySelectorAll('[data-tl-pow],[data-tl-freq]').forEach((b) => { b.disabled = !!t.preview; });

  // 落点与处境
  const here = t.here === 'away' ? 'away' : 'with';
  document.querySelectorAll('[data-tl-here]').forEach((b) => {
    b.classList.toggle('on', b.dataset.tlHere === here);
    b.disabled = !!t.preview;
  });
  setText('tlHereHint', here === 'with' ? Tt.hereWithHint : Tt.hereAwayHint);
  const sceneBlock = $('tlSceneBlock');
  if (sceneBlock) sceneBlock.hidden = here !== 'away';
  if (here === 'away') {
    const scenes = Tt.scenes || {};
    const curSid = t.sceneId || t.lastAwaySceneId;
    const sceneGrid = $('tlSceneGrid');
    if (sceneGrid) {
      sceneGrid.innerHTML = Object.entries(scenes).map(([id, sc]) => `<button type="button" class="tl-scene-btn${id === curSid ? ' on' : ''}" data-tl-scene="${esc(id)}"${t.preview ? ' disabled' : ''}>`
        + `<i class="tl-tier-dot is-${esc(sc.tier)}"></i><span>${esc(sc.label)}</span></button>`).join('');
    }
    setText('tlSceneDesc', scenes[curSid] ? scenes[curSid].desc : '');
  }

  // 底部主操作
  const fHint = $('tlFooterHint');
  if (fHint) {
    if (t.preview) { fHint.textContent = Tt.footerLocked; fHint.hidden = false; }
    else if (live) { fHint.textContent = Tt.footerRunning; fHint.hidden = false; }
    else fHint.hidden = true;
  }
  const mainBtn = $('tlMainBtn');
  if (mainBtn) {
    if (live) { mainBtn.textContent = Tt.btnStop; mainBtn.className = 'tl-btn-main is-stop'; mainBtn.disabled = false; }
    else {
      mainBtn.textContent = Tt.btnStart;
      mainBtn.className = 'tl-btn-main';
      mainBtn.disabled = !!t.preview || !c || !gateOf(c).eligible || !worn || (!!t.running && t.activeTargetId !== (c && c.id));
    }
  }
  const writeBtn = $('tlWriteBtn');
  if (writeBtn) writeBtn.disabled = !!t.preview || !c || !worn;

  paintDynamic(false);
  if (modal.open) renderModal();
}

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch])); }
function setText(id, text) { const el = $(id); if (el) el.textContent = text; }

// ---------- 100ms 绘帧（只按 id 局部更新，不重建任何容器）----------
function paintFrame(f) {
  if (!f) return;
  const card = $('tlStageCard');
  const stack = toyStackOf(f.peak);
  if (card) {
    card.dataset.tier = String(stack.tier);
    card.classList.toggle('is-resisting', !!f.resisting);
    card.classList.toggle('is-edging', !!(f.edgeLocked || f.modeId === 'edge'));
    if (f.edgeHit) { card.classList.remove('is-edging-hit'); void card.offsetWidth; card.classList.add('is-edging-hit'); }
  }
  const aro = Math.max(0, Math.min(100, Number(f.aro) || 0));
  const env = Math.max(0, Math.min(1, Number(f.env) || 0));
  const aroEl = $('tlRingAro');
  if (aroEl) aroEl.setAttribute('stroke-dasharray', `${(C_ARO * aro / 100).toFixed(1)} ${C_ARO.toFixed(1)}`);
  const envEl = $('tlRingEnv');
  if (envEl) envEl.setAttribute('stroke-dasharray', `${(C_ENV * env).toFixed(1)} ${C_ENV.toFixed(1)}`);
  setText('tlPeakBadge', stack.capped ? fill(T().peakBadgeCapped, {peak: stack.peak}) : fill(T().peakBadge, {peak: stack.peak}));
  setText('tlStackBadge', fill(T().stackBadge, {tierLabel: stack.tierLabel, rateMult: stack.rateMult.toFixed(2)}));
  const stage = Math.max(1, Math.min(5, Number(f.stage) || 1));
  setText('tlStageText', TOY_STAGE_CN[stage - 1]);
  if (!f.running) {
    // 待机态：环心回「待机」并显示佩戴态，对齐原型 renderAll 的 idle 分支
    const c0 = curChar();
    const worn0 = c0 && wornOf(c0);
    setText('tlStageText', T().stageIdle);
    setText('tlStageSub', c0 ? (worn0 ? fill(T().stageSubWorn, {name: c0.name}) : fill(T().stageSubUnworn, {name: c0.name})) : '');
    setText('tlStageMeta', fill(T().stageMetaLine, {stageName: T().stageIdle, tierLabel: stack.tierLabel, peak: stack.peak}));
  }
  setText('tlStageSub', (f.edgeLocked || f.modeId === 'edge') ? fill(T().stageSubEdging, {count: f.edgeCount}) : (f.resisting ? T().stageSubResisting : fill(T().stageSubLive, {stage, peak: stack.peak})));
  setText('tlStageMeta', fill(T().stageMetaLine, {stageName: f.running ? TOY_STAGE_CN[stage - 1] : T().stageIdle, tierLabel: stack.tierLabel, peak: stack.peak}));
  setText('tlFeedTag', !f.running ? T().feedTagIdle : ((f.edgeLocked || f.modeId === 'edge') ? T().feedTagEdge : (f.resisting ? T().feedTagResist : (stack.peak > 0 ? T().feedTagPeak : T().feedTagLive))));
  const bpm = 92 + Math.round(aro * 0.65 + stack.peak * 6);
  setText('tlFeedTele', f.running ? fill(T().feedTeleLive, {bpm, tension: (T().tensions || {})[String(stage)] || ''}) : T().feedTeleIdle);
  setText('tlFeedLine', toyFeedText({feedKey: f.feedKey, edgeCount: f.edgeCount, crave: f.crave, peak: stack.peak}));
  const exp = Math.round(Number(f.exposure) || 0);
  const expBar = $('tlExpBar');
  if (expBar) expBar.style.width = exp + '%';
  setText('tlExpVal', (Number(f.exposedCount) || 0) > 0 ? fill(T().expBroken, {count: f.exposedCount}) : (exp >= 80 ? fill(T().expDanger, {exp}) : fill(T().expSafe, {exp})));
  const lockBtn = $('tlBtnEdgeLock');
  if (lockBtn) {
    lockBtn.classList.toggle('on', !!f.edgeLocked);
    lockBtn.textContent = f.edgeLocked ? fill(T().btnEdgeLockOn, {count: f.edgeCount}) : T().btnEdgeLockOff;
    lockBtn.disabled = !wornOf(curChar());
  }
  const shockBtn = $('tlBtnShock');
  if (shockBtn) {
    const cd = Number(f.shockCd) || 0;
    shockBtn.classList.toggle('is-alert', !!f.resisting);
    shockBtn.textContent = cd > 0 ? fill(T().btnShockCd, {sec: Math.ceil(cd)}) : (f.resisting ? T().btnShockBreak : T().btnShock);
    shockBtn.disabled = cd > 0 || !f.running;
  }
  const burstBtn = $('tlBtnBurst');
  if (burstBtn) {
    const show = !!f.running && (Number(f.edgeCount) || 0) >= 1;
    burstBtn.hidden = !show;
    burstBtn.textContent = fill(T().btnBurst, {mult: toyBurstMult(f.edgeCount).toFixed(2)});
  }
  const tr = $('tlTraceVal');
  if (tr) {
    const trace = Array.isArray(f.trace) ? f.trace : [];
    if (trace.length) { tr.textContent = trace.join(' → '); tr.classList.remove('is-empty'); }
    else { tr.textContent = T().traceEmpty; tr.classList.add('is-empty'); }
  }
  const pill = $('tlTopPill');
  if (pill && f.running) pill.textContent = fill(T().pillLive, {modeName: toyMode(f.modeId).name, peak: stack.peak});
}

// 离散控件的静态部分（非运行态也要刷）
function paintDynamic(edgeHit) {
  const t = toy();
  const c = curChar();
  const stack = toyStackOf(isLiveOf(c) ? t.peak : 0);
  const card = $('tlStageCard');
  if (card) {
    card.dataset.tier = String(stack.tier);
    card.classList.toggle('is-live', isLiveOf(c));
    if (edgeHit) { card.classList.remove('is-edging-hit'); void card.offsetWidth; card.classList.add('is-edging-hit'); }
  }
  paintFrame({...t, running: !!t.running, peak: stack.peak, stage: isLiveOf(c) ? t.stage : 1, aro: isLiveOf(c) ? t.aro : 0, env: isLiveOf(c) ? t.env : 0, exposure: isLiveOf(c) ? t.exposure : 0});
}

// ---------- 佩戴双步弹窗 ----------
function openWearModal() {
  const t = toy();
  modal.open = true;
  modal.step = 1;
  modal.loc = '';
  modal.scene = t.lastAwaySceneId || '';
  renderModal();
}
function closeWearModal() { modal.open = false; renderModal(); }

function renderModal() {
  const Tt = T();
  const c = curChar();
  const ov = $('tlModalOverlay');
  if (!ov) return;
  ov.hidden = !modal.open;
  ov.classList.toggle('show', modal.open);
  if (!modal.open) return;
  const scenes = Tt.scenes || {};
  setText('tlModalStep', modal.step === 1 ? Tt.modalStep1 : Tt.modalStep2);
  setText('tlModalTitle', modal.step === 1 ? fill(Tt.wearConfirmTitle, {name: c ? c.name : ''}) : fill(Tt.wearLocTitle, {name: c ? c.name : ''}));
  setText('tlModalBody', modal.step === 1 ? Tt.wearConfirmBody : Tt.wearLocSub);
  const locGrid = $('tlModalLocGrid');
  if (locGrid) locGrid.hidden = modal.step !== 2;
  const sceneWrap = $('tlModalScenes');
  if (sceneWrap) sceneWrap.hidden = !(modal.step === 2 && modal.loc === 'away');
  const sceneGrid = $('tlModalSceneGrid');
  if (sceneGrid && modal.step === 2) {
    const cur = modal.scene || Tt.scenes ? (modal.scene || '') : '';
    sceneGrid.innerHTML = Object.entries(scenes).map(([id, sc]) => `<button type="button" class="tl-modal-scene${id === cur ? ' on' : ''}" data-modal-scene="${esc(id)}">`
      + `<i class="tl-tier-dot is-${esc(sc.tier)}"></i><span>${esc(sc.label)}</span></button>`).join('');
  }
  document.querySelectorAll('[data-modal-loc]').forEach((b) => b.classList.toggle('on', b.dataset.modalLoc === modal.loc));
  const err = $('tlModalErr');
  if (err) err.hidden = !(modal.step === 2 && !modal.loc);
  const ok = $('tlModalOk');
  if (ok) {
    ok.textContent = modal.step === 1 ? Tt.wearConfirmOk : Tt.wearLocSubmit;
    ok.disabled = modal.step === 2 && (!modal.loc || (modal.loc === 'away' && !(modal.scene || '')));
  }
  const cancel = $('tlModalCancel');
  if (cancel) cancel.textContent = modal.step === 1 ? Tt.wearConfirmCancel : Tt.wearLocBack;
}

async function submitWear() {
  const c = curChar();
  if (!c || !modal.loc) return;
  const payload = {id: c.id, here: modal.loc};
  if (modal.loc === 'away') payload.sceneId = modal.scene;
  const res = await act('wear', payload);
  if (!res || !res.ok) {
    toast(WHEEL_COPY.errors[res && res.code] || WHEEL_COPY.errors.TOYLINK_MISSING);
    return;
  }
  closeWearModal();
  const locLabel = modal.loc === 'with' ? T().hereWith : ((T().scenes || {})[modal.scene] || {}).label || T().hereAway;
  if (res.data && res.data.already) { renderAll(); return; }
  toast(res.data && res.data.filled ? fill(T().wearOkFillToast, {name: c.name, locLabel}) : fill(T().wearOkNoInputToast, {name: c.name, locLabel}));
  renderAll();
}

// ---------- 事件 ----------
document.addEventListener('click', async (e) => {
  const b = e.target && e.target.closest ? e.target.closest('button') : null;
  if (!b) return;
  if (b.id === 'tlBtnClose') { post('TOYLINK_CLOSE_REQ', {reason: 'USER'}); return; }
  if (b.id === 'tlBtnShop') { post('TOYLINK_OPEN_SHOP'); return; }
  if (b.dataset.tlTarget) { await act('select', {id: b.dataset.tlTarget}); renderAll(); return; }
  if (b.id === 'tlBtnWear') {
    const c = curChar();
    if (!c) return;
    if (wornOf(c)) {
      const res = await act('unwear', {id: c.id});
      if (res && res.ok) toast(fill(T().unwearOkToast, {name: c.name}));
      renderAll();
      return;
    }
    openWearModal();
    return;
  }
  if (b.dataset.modalLoc) { modal.loc = b.dataset.modalLoc; if (modal.loc === 'with') modal.scene = ''; renderModal(); return; }
  if (b.dataset.modalScene) { modal.scene = b.dataset.modalScene; renderModal(); return; }
  if (b.id === 'tlModalCancel') {
    if (modal.step === 2) { modal.step = 1; renderModal(); } else closeWearModal();
    return;
  }
  if (b.id === 'tlModalOk') {
    if (modal.step === 1) { modal.step = 2; renderModal(); return; }
    await submitWear();
    return;
  }
  if (b.dataset.tlMode) { await act('mode', {id: b.dataset.tlMode}); renderAll(); return; }
  if (b.dataset.tlPow !== undefined) { await act('pow', {delta: Number(b.dataset.tlPow)}); renderAll(); return; }
  if (b.dataset.tlFreq !== undefined) { await act('freq', {delta: Number(b.dataset.tlFreq)}); renderAll(); return; }
  if (b.dataset.tlHere) { await act('here', {value: b.dataset.tlHere}); renderAll(); return; }
  if (b.dataset.tlScene) { await act('scene', {id: b.dataset.tlScene}); renderAll(); return; }
  if (b.id === 'tlBtnEdgeLock') { await act('edge-lock', {}); renderAll(); return; }
  if (b.id === 'tlBtnShock') { await act('shock', {}); renderAll(); return; }
  if (b.id === 'tlBtnBurst') { await act('burst', {}); renderAll(); return; }
  if (b.id === 'tlMainBtn') {
    const t = toy();
    const c = curChar();
    if (isLiveOf(c)) await act('stop', {});
    else await act('start', {id: c && c.id});
    renderAll();
    return;
  }
  if (b.id === 'tlWriteBtn') {
    const res = await act('write', {});
    if (res && res.ok && res.data) {
      if (res.data.filled === false) toast(WHEEL_COPY.errors.INPUT_NOT_FOUND);
      else toast(T().writeOkToast);
    }
    renderAll();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (modal.open) { closeWearModal(); return; }
  post('TOYLINK_CLOSE_REQ', {reason: 'USER'});
});

// ---------- 启动 ----------
renderAll();
startReadyLoop();
