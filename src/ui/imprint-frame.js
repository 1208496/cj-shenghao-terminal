import {
  PLACEMENTS,
  PLACEMENT_GROUPS,
  PLACEMENT_BY_ID,
  IMPRINT_PATTERNS,
  PATTERN_BY_ID,
  IMPRINT_COLORS,
  COLOR_BY_ID,
  IMPRINT_FONTS,
  IMPRINT_LAYOUTS,
  DEVICE_MIN_AFFECTION,
  DEVICE_MIN_CORRUPTION,
  checkDeviceThreshold,
} from '../core/device-catalog.js';
import { composeImprint, patternGlyph, describeImprint, entryLabel } from './imprint-art.js';
import { WHEEL_COPY, fill } from '../core/wheel-ui-copy.js';

const IMPRINT_CHANNEL = 'CJ_SHENGHAO_IMPRINT_V1';
const OP_TIMEOUT_MS = 12000;
const SCALES = ['sm', 'md', 'lg'];
const ANGLES = [-30, -15, 0, 15, 30];
const I = WHEEL_COPY.workshop.imprint;
const C = WHEEL_COPY.workshop.common;

const byId = (arr, id) => arr.find((x) => x.id === id) || arr[0];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const $ = (id) => document.getElementById(id);

const defaultDraft = (pid) => ({
  placement: pid,
  patternEnabled: true,
  patternId: 'succubus_heart',
  patternScale: 'md',
  patternColor: 'crimson',
  textEnabled: true,
  text: '',
  textLayout: 'arc_wrap',
  textScale: 'md',
  textAngle: 0,
  font: 'script',
  textColor: 'gold',
});

const st = {
  nonce: '',
  open: false,
  characters: [],
  userName: '你',
  charId: '',
  group: 'chest_abdomen',
  placement: 'lower_abdomen',
  draft: defaultDraft('lower_abdomen'),
  summaryOpen: true,
  fillInput: true,
  error: '',
  busy: false,
  pendingReqId: '',
  pendingMeta: null,
  modal: { open: false, onOk: null },
};

let opTimer = null;
let closeAnimTimer = null;
let toastTimer = null;

function postToHost(msg) {
  window.parent.postMessage({ channel: IMPRINT_CHANNEL, nonce: st.nonce, ...msg }, '*');
}

function curChar() {
  return st.characters.find((c) => c.id === st.charId) || null;
}

function gateOf(c) {
  return c ? checkDeviceThreshold({ ...c, trackingState: c.trackingState || 'RECORDED' }) : null;
}

function loadPlacement(pid) {
  const pl = byId(PLACEMENTS, pid);
  st.placement = pl.id;
  st.group = pl.group;
  const c = curChar();
  const saved = c?.imprints?.items?.[pl.id];
  st.draft = saved ? { ...defaultDraft(pl.id), ...saved, placement: pl.id } : defaultDraft(pl.id);
  st.error = '';
}

function showToast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function openModal(title, text, okLabel, onOk) {
  $('modalTitle').textContent = title;
  $('modalText').textContent = text;
  $('modalOk').textContent = okLabel;
  st.modal = { open: true, onOk };
  $('modalOverlay').classList.add('show');
}

function closeModal() {
  $('modalOverlay').classList.remove('show');
  st.modal = { open: false, onOk: null };
}

function redrawStage(pulse) {
  const pl = byId(PLACEMENTS, st.placement);
  const c = curChar();
  const entry = c?.imprints?.items?.[st.placement];
  const svg = $('imprintStageSvg');
  svg.innerHTML = composeImprint({ ...st.draft, placement: st.placement });
  if (pulse) {
    svg.classList.remove('ink-pulse');
    void svg.offsetWidth;
    svg.classList.add('ink-pulse');
  }
  const slotTag = entry ? I.stageSlotMarked : I.stageSlotEmpty;
  $('stageLeftCap').innerHTML = `<b>${esc(pl.short)}</b> · ${esc(slotTag)} · ${esc(pl.privacy)}`;
  $('stageRightCap').textContent = describeImprint(st.draft) || '未开启图层';
}

function renderAll() {
  const c = curChar();
  const marks = c?.imprints?.items || {};
  const keys = Object.keys(marks);
  const marked = keys.length;
  const entry = marks[st.placement];
  const pl = byId(PLACEMENTS, st.placement);
  const gate = gateOf(c);
  const d = st.draft;

  // 顶栏状态与抹除
  const pill = $('topStatusPill');
  pill.textContent = !marked
    ? I.targetStatusEmpty
    : (marked >= PLACEMENTS.length ? fill(I.statusFull, { count: marked }) : fill(I.statusMulti, { count: marked }));
  pill.classList.toggle('engraved', marked > 0);
  pill.setAttribute('aria-expanded', String(marked > 0 && st.summaryOpen));
  $('btnRemoveTop').hidden = !entry;
  $('btnRemoveTop').disabled = st.busy;

  // 顶栏对象切换条
  if (!c) {
    $('targetArea').innerHTML = `<div class="ws-empty-banner">${esc(C.noWomanEmpty)}</div>`;
  } else {
    $('targetArea').innerHTML = `<div class="ws-target-wrap"><span class="ws-target-lbl">${esc(I.targetLabel)}</span><div class="ws-target-strip" role="radiogroup" aria-label="${esc(I.targetLabel)}">${st.characters.map((w) => {
      const n = Object.keys(w.imprints?.items || {}).length;
      const g = gateOf(w);
      return `<button type="button" class="ws-char-chip${w.id === c.id ? ' on' : ''}${g.eligible ? '' : ' is-blocked'}" data-ws-target="${esc(w.id)}" role="radio" aria-checked="${w.id === c.id}"><span class="av">${esc(w.name.slice(0, 1))}</span><span>${esc(w.name)}</span>${n ? `<span class="cnt-tag">${n}</span>` : ''}${g.eligible ? '' : `<span class="gate-tag">${esc(C.gateTagBlocked)}</span>`}</button>`;
    }).join('')}</div></div>`;
  }

  // 门槛拦截条
  const showGate = Boolean(c && !gate.eligible);
  $('gateBanner').hidden = !showGate;
  if (showGate) {
    $('gateTitle').textContent = fill(I.gateTitle, { name: c.name });
    $('gateRule').textContent = C.gateRule;
    $('gateMetrics').innerHTML = `<span class="ws-gate-pill">当前好感 <b>${gate.affection}</b>/${DEVICE_MIN_AFFECTION}（差 ${gate.affGap}）</span><span class="ws-gate-pill">当前堕落 <b>${gate.corruption}</b>/${DEVICE_MIN_CORRUPTION}（差 ${gate.corGap}）</span>`;
    $('gateDesc').textContent = marked
      ? fill(I.gateDescMarked, { count: marked })
      : fill(I.gateDescEmpty, { affGap: gate.affGap, corGap: gate.corGap });
  }

  // 左栏：部位详情卡
  $('metaPlaceName').textContent = pl.name;
  $('metaSlotBadge').textContent = entry ? I.stageSlotMarked : I.stageSlotEmpty;
  $('metaSlotBadge').classList.toggle('is-marked', Boolean(entry));
  $('metaAnchor').textContent = pl.anchor;
  $('metaPrivacy').textContent = pl.privacy;

  // 左栏：对象档案信息卡
  if (!c) {
    $('targetAv').textContent = '空';
    $('targetAv').classList.add('is-empty');
    $('targetName').textContent = C.noWomanBtn;
    $('targetStateBadge').textContent = I.targetStatePreview;
    $('targetStateBadge').className = 'imp-target-state is-empty';
    $('targetQuotaText').textContent = I.targetEmptyQuota;
    $('statAffVal').textContent = `--/${DEVICE_MIN_AFFECTION}`;
    $('statCorVal').textContent = `--/${DEVICE_MIN_CORRUPTION}`;
    $('statAffBox').classList.remove('is-met');
    $('statCorBox').classList.remove('is-met');
  } else {
    $('targetAv').textContent = c.name.slice(0, 1);
    $('targetAv').classList.remove('is-empty');
    $('targetName').textContent = c.name;
    $('targetStateBadge').textContent = gate.eligible ? I.targetStateEligible : C.gateTagBlocked;
    $('targetStateBadge').className = `imp-target-state${gate.eligible ? '' : ' is-blocked'}`;
    $('targetQuotaText').textContent = `已铭刻 ${marked}/${PLACEMENTS.length} 处`;
    $('statAffVal').textContent = `${gate.affection}/${DEVICE_MIN_AFFECTION}`;
    $('statCorVal').textContent = `${gate.corruption}/${DEVICE_MIN_CORRUPTION}`;
    $('statAffBox').classList.toggle('is-met', gate.affection >= DEVICE_MIN_AFFECTION);
    $('statCorBox').classList.toggle('is-met', gate.corruption >= DEVICE_MIN_CORRUPTION);
  }

  // 中栏：身体部位
  $('placePrivacyHint').textContent = pl.privacy;
  $('placeTabs').innerHTML = PLACEMENT_GROUPS.map((g) => {
    const n = PLACEMENTS.filter((p) => p.group === g.id && marks[p.id]).length;
    return `<button type="button" class="place-tab${st.group === g.id ? ' on' : ''}" data-ws-group="${esc(g.id)}" role="tab" aria-selected="${st.group === g.id}">${esc(I.placeGroups[g.id] || g.label)}${n ? `<span class="gcnt">·${n}</span>` : ''}</button>`;
  }).join('');
  $('placeGrid').innerHTML = PLACEMENTS.filter((p) => p.group === st.group).map((p) => {
    const on = marks[p.id];
    const aria = fill(on ? I.placeMarkedAria : I.placeEmptyAria, { placeName: p.name });
    return `<button type="button" class="ws-pill${st.placement === p.id ? ' on' : ''}${on ? ' has-mark' : ''}" data-ws-place="${esc(p.id)}" role="radio" aria-checked="${st.placement === p.id}" aria-label="${esc(aria)}">${esc(p.name)}</button>`;
  }).join('');
  $('placeQuotaHint').textContent = `${marked}/${PLACEMENTS.length} 处`;

  // 中栏：纹样图腾
  $('patternGroup').classList.toggle('is-off', !d.patternEnabled);
  $('patternBody').hidden = !d.patternEnabled;
  $('patDescHint').textContent = d.patternEnabled ? byId(IMPRINT_PATTERNS, d.patternId).desc : '已关闭（仅保留文字）';
  $('patGrid').innerHTML = IMPRINT_PATTERNS.map((p) => `<button type="button" class="ws-pat-card${d.patternId === p.id ? ' on' : ''}" data-ws-pattern="${esc(p.id)}" role="radio" aria-checked="${d.patternId === p.id}" title="${esc(p.desc)}"><svg viewBox="-50 -36 100 72" aria-hidden="true">${patternGlyph(p.id, d.patternColor)}</svg><b>${esc(p.name)}</b></button>`).join('');
  $('patScaleRow').innerHTML = SCALES.map((s) => `<button type="button" class="seg-btn${d.patternScale === s ? ' on' : ''}" data-ws-field="patternScale:${s}" role="radio" aria-checked="${d.patternScale === s}">${esc(I.scales[s])}</button>`).join('');

  // 中栏：墨色与书体
  const curColorObj = byId(IMPRINT_COLORS, d.patternColor);
  $('colorDescHint').textContent = `${curColorObj.name} · ${curColorObj.desc}`;
  $('patColorRow').innerHTML = IMPRINT_COLORS.map((col) => `<button type="button" class="ws-swatch${d.patternColor === col.id ? ' on' : ''}" data-ws-field="patternColor:${esc(col.id)}" role="radio" aria-checked="${d.patternColor === col.id}" aria-label="${esc(col.name)}" title="${esc(col.name)}：${esc(col.desc)}"><i style="background:${col.fill}"></i></button>`).join('');
  $('textColorRow').innerHTML = IMPRINT_COLORS.map((col) => `<button type="button" class="ws-swatch${d.textColor === col.id ? ' on' : ''}" data-ws-field="textColor:${esc(col.id)}" role="radio" aria-checked="${d.textColor === col.id}" aria-label="${esc(col.name)}" title="${esc(col.name)}：${esc(col.desc)}"><i style="background:${col.fill}"></i></button>`).join('');
  $('fontRow').innerHTML = IMPRINT_FONTS.map((f) => `<button type="button" class="chip${d.font === f.id ? ' on' : ''}" data-ws-field="font:${esc(f.id)}" role="radio" aria-checked="${d.font === f.id}">${esc(f.label)}</button>`).join('');

  // 右栏：图层开关
  $('switchPatItem').classList.toggle('is-on', d.patternEnabled);
  $('switchTxtItem').classList.toggle('is-on', d.textEnabled);
  $('btnTogglePattern').classList.toggle('on', d.patternEnabled);
  $('btnTogglePattern').textContent = d.patternEnabled ? I.layerOn : I.layerOff;
  $('btnTogglePattern').setAttribute('aria-pressed', String(d.patternEnabled));
  $('btnToggleText').classList.toggle('on', d.textEnabled);
  $('btnToggleText').textContent = d.textEnabled ? I.layerOn : I.layerOff;
  $('btnToggleText').setAttribute('aria-pressed', String(d.textEnabled));

  // 右栏：刻字与角度
  $('textGroup').classList.toggle('is-off', !d.textEnabled);
  $('textBody').hidden = !d.textEnabled;
  if ($('wsImprintText').value !== (d.text || '')) $('wsImprintText').value = d.text || '';
  const len = String(d.text || '').length;
  $('wsTextCount').textContent = fill(I.textLimitHint, { len });
  $('wsTextCount').classList.toggle('is-max', len >= 16);
  const inspoList = [
    fill(I.inspo1, { surname: (st.userName || '你').slice(0, 1) }),
    I.inspo2,
    fill(I.inspo3, { userName: st.userName || '你' }),
    I.inspo4,
  ];
  $('inspoRow').innerHTML = inspoList.map((t) => `<button type="button" class="ws-inspo-chip" data-ws-inspo="${esc(t)}">${esc(t)}</button>`).join('');
  $('textLayoutRow').innerHTML = IMPRINT_LAYOUTS.map((l) => `<button type="button" class="seg-btn${d.textLayout === l.id ? ' on' : ''}" data-ws-field="textLayout:${esc(l.id)}" role="radio" aria-checked="${d.textLayout === l.id}">${esc(I.layouts[l.id] || l.label)}</button>`).join('');
  $('textScaleRow').innerHTML = SCALES.map((s) => `<button type="button" class="seg-btn${d.textScale === s ? ' on' : ''}" data-ws-field="textScale:${s}" role="radio" aria-checked="${d.textScale === s}">${esc(I.scales[s])}</button>`).join('');
  const deg = Number(d.textAngle) || 0;
  $('wsAngleSlider').value = String(deg);
  $('angleValText').textContent = `${deg > 0 ? '+' : ''}${deg}°`;
  $('textAngleRow').innerHTML = ANGLES.map((a) => `<button type="button" class="seg-btn${deg === a ? ' on' : ''}" data-ws-angle="${a}" role="radio" aria-checked="${deg === a}">${a > 0 ? '+' : ''}${a}°</button>`).join('');

  // 右栏：多枚摘要条与展开抽屉
  $('multiSummary').hidden = !(c && marked > 0);
  $('multiSummary').classList.toggle('is-full', marked >= PLACEMENTS.length);
  if (c && marked > 0) {
    const shorts = keys.map((k) => (PLACEMENT_BY_ID[k]?.short || k));
    const previewNames = shorts.slice(0, 4).join(' / ') + (marked > 4 ? ` 等 ${marked} 处` : '');
    $('summaryLine').textContent = marked >= PLACEMENTS.length ? I.summaryFullLine : fill(I.summaryLine, { count: marked, places: previewNames });
    $('summaryCaret').textContent = st.summaryOpen ? '收起 ▴' : '展开明细 ▾';
    $('btnToggleDrawer').setAttribute('aria-expanded', String(st.summaryOpen));
    $('summaryDrawer').hidden = !st.summaryOpen;
    if (st.summaryOpen) {
      $('summaryDrawer').innerHTML = keys.map((k) => `<div class="ws-summary-item${k === st.placement ? ' is-cur' : ''}"><button type="button" class="ws-sum-jump" data-ws-jump="${esc(k)}"><span class="ws-sum-place">${esc(PLACEMENT_BY_ID[k]?.short || k)}</span><span class="ws-sum-desc">${esc(entryLabel(marks[k]))}</span></button><button type="button" class="ws-sum-del" data-ws-remove-one="${esc(k)}"${st.busy ? ' disabled' : ''}>抹除</button></div>`).join('')
        + `<div class="ws-summary-foot"><span>共 ${marked}/${PLACEMENTS.length} 处 · 点击条目跳转编辑</span><button type="button" class="ws-clear-all-btn" id="btnRemoveAll" data-ws-remove-all="1"${st.busy ? ' disabled' : ''}>${esc(I.btnRemoveAll)}</button></div>`;
    }
  }

  // 右栏底部：提交区
  $('wsFillInput').checked = st.fillInput;
  const errText = !c ? C.noWomanEmpty : st.error;
  $('wsTextErr').hidden = !errText;
  $('wsTextErr').textContent = errText;

  $('btnRemoveFoot').hidden = !entry;
  $('btnRemoveFoot').disabled = st.busy;
  const btnSave = $('btnSave');
  const reasonEl = $('footerReason');
  if (!c) {
    btnSave.disabled = true;
    btnSave.textContent = C.noWomanBtn;
    reasonEl.hidden = true;
  } else if (!gate.eligible) {
    btnSave.disabled = true;
    btnSave.textContent = fill(C.btnBlocked, { affGap: gate.affGap, corGap: gate.corGap });
    reasonEl.hidden = false;
    reasonEl.textContent = fill(I.footerReasonBlocked, { name: c.name, affection: gate.affection, corruption: gate.corruption });
  } else {
    btnSave.disabled = st.busy;
    btnSave.textContent = entry ? fill(I.btnUpdatePlace, { placementShort: pl.short }) : fill(I.btnSaveNew, { name: c.name, placementShort: pl.short });
    reasonEl.hidden = true;
  }

  redrawStage(false);
}

function buildDraftText(c, pl, d) {
  const clause = d.textEnabled && d.text ? `（镌刻字样“${d.text}”）` : '';
  return fill(I.inputDraft, {
    name: c.name,
    anchor: pl.anchor,
    colorName: COLOR_BY_ID[d.patternColor]?.name || '',
    patternName: PATTERN_BY_ID[d.patternId]?.name || '',
    textClause: clause,
  });
}

function sendOp(op, meta) {
  if (st.busy) return;
  const reqId = crypto.randomUUID();
  st.busy = true;
  st.pendingReqId = reqId;
  st.pendingMeta = meta;
  st.error = '';
  renderAll();
  clearTimeout(opTimer);
  opTimer = setTimeout(() => {
    if (st.pendingReqId !== reqId) return;
    st.busy = false;
    st.pendingReqId = '';
    st.pendingMeta = null;
    st.error = '操作超时，请稍后重试。';
    renderAll();
  }, OP_TIMEOUT_MS);
  postToHost({
    type: 'IMPRINT_OP_REQ',
    reqId,
    op,
    fillInput: st.fillInput,
    draftText: meta.draftText || '',
  });
}

function mapErrorCode(code, c) {
  const gate = gateOf(c);
  if (code === 'DEVICE_THRESHOLD_NOT_MET') {
    return fill(I.footerReasonBlocked, {
      name: c?.name || '',
      affection: gate?.affection ?? 0,
      corruption: gate?.corruption ?? 0,
    });
  }
  if (code === 'IMPRINT_EMPTY_LAYERS') return I.errBothOff;
  if (code === 'IMPRINT_TEXT_REQUIRED') return I.errTextRequired;
  if (code === 'IMPRINT_TEXT_INVALID') return I.textInvalidHint;
  if (code === 'CHARACTER_NOT_FOUND') return C.noWomanEmpty;
  return WHEEL_COPY.errors?.[code] || '操作失败，请稍后重试。';
}

function applyView(view, isOpen) {
  if (!view) return;
  document.documentElement.style.setProperty('--cj-font-scale', String(view.fontScale || 1));
  st.characters = Array.isArray(view.characters) ? view.characters : [];
  st.userName = String(view.userName || '你');
  if (isOpen) {
    st.open = true;
    st.busy = false;
    st.pendingReqId = '';
    st.pendingMeta = null;
    st.error = '';
    st.summaryOpen = true;
    st.fillInput = view.fillInputDefault !== undefined ? !!view.fillInputDefault : true;
    st.charId = view.charId && st.characters.some((c) => c.id === view.charId)
      ? view.charId
      : (st.characters[0]?.id || '');
    const c = curChar();
    const first = Object.keys(c?.imprints?.items || {})[0] || 'lower_abdomen';
    loadPlacement(first);
    const ov = $('impOverlay');
    clearTimeout(closeAnimTimer);
    ov.classList.remove('is-closing');
    ov.hidden = false;
  } else if (!st.characters.some((c) => c.id === st.charId)) {
    st.charId = st.characters[0]?.id || '';
  }
  renderAll();
}

let readyTimer = null;
function announceReady() {
  postToHost({ type: 'IMPRINT_READY' });
}
// rc.49 修：首开时宿主可能把 INIT 发在 srcdoc 提交前的那一瞬，消息会丢。
// 帧侧主动每 300ms 重发一次 READY（宿主收到就再发 INIT），收到首条 INIT/OPEN 即停。
function startReadyLoop() {
  if (readyTimer) return;
  let tries = 0;
  readyTimer = setInterval(() => {
    if (readyTimer === null) return;
    if (++tries > 20) {
      clearInterval(readyTimer);
      readyTimer = null;
      return;
    }
    announceReady();
  }, 300);
}
function stopReadyLoop() {
  if (readyTimer) {
    clearInterval(readyTimer);
    readyTimer = null;
  }
}

window.addEventListener('message', (event) => {
  // rc.49 修：真酒馆里 TavernHelper 脚本活在自己的 iframe 里，它把工坊 iframe 挂到顶层 body，
  // 但 postMessage 的 event.source 是那个 TH iframe 而不是 window.parent（顶层窗口）。
  // 所以这里不能拿 event.source 卡死，只认 channel + 握手 nonce（与 wheel-frame.js 同一条教训）。
  const data = event.data;
  if (!data || data.channel !== IMPRINT_CHANNEL) return;
  if (data.type === 'IMPRINT_INIT' || data.type === 'IMPRINT_OPEN') {
    stopReadyLoop();
    if (data.type === 'IMPRINT_INIT') st.nonce = String(data.nonce || '');
    else if (data.nonce && data.nonce !== st.nonce) return;
    applyView(data.view, true);
    postToHost({ type: 'IMPRINT_BUILT' });
    return;
  }
  if (data.nonce !== st.nonce) return;
  if (data.type === 'IMPRINT_STATE_SYNC') {
    applyView(data.view, false);
    return;
  }
  if (data.type === 'IMPRINT_OP_RES') {
    if (data.reqId !== st.pendingReqId) return;
    clearTimeout(opTimer);
    st.busy = false;
    st.pendingReqId = '';
    const meta = st.pendingMeta || {};
    st.pendingMeta = null;
    if (data.view) {
      st.characters = Array.isArray(data.view.characters) ? data.view.characters : st.characters;
      st.userName = String(data.view.userName || st.userName);
    }
    const c = curChar();
    if (data.ok) {
      st.error = '';
      if (meta.action === 'remove_all') {
        st.summaryOpen = false;
        loadPlacement(st.placement);
      } else {
        loadPlacement(meta.placement || st.placement);
      }
      renderAll();
      redrawStage(true);
      if (meta.action === 'save') {
        const total = Object.keys(c?.imprints?.items || {}).length;
        showToast(meta.isUpdate
          ? fill(I.updatePlaceOkToast, { name: meta.charName, placementShort: meta.placeShort, label: meta.label })
          : fill(I.savePlaceOkToast, { name: meta.charName, placementShort: meta.placeShort, label: meta.label, total }));
      } else if (meta.action === 'remove_one') {
        const remain = Object.keys(c?.imprints?.items || {}).length;
        showToast(fill(I.removePlaceOkToast, { name: meta.charName, placementShort: meta.placeShort, remain }));
      } else if (meta.action === 'remove_all') {
        showToast(fill(I.removeAllOkToast, { name: meta.charName, count: meta.count }));
      }
    } else {
      st.error = mapErrorCode(data.errorCode, c);
      renderAll();
    }
    return;
  }
  if (data.type === 'IMPRINT_CLOSE_ANIMATE') {
    st.open = false;
    closeModal();
    const ov = $('impOverlay');
    ov.classList.add('is-closing');
    clearTimeout(closeAnimTimer);
    closeAnimTimer = setTimeout(() => {
      ov.hidden = true;
      ov.classList.remove('is-closing');
      postToHost({ type: 'IMPRINT_CLOSE_DONE' });
    }, 180);
    return;
  }
  if (data.type === 'IMPRINT_CLOSE') {
    st.open = false;
    closeModal();
    clearTimeout(closeAnimTimer);
    const ov = $('impOverlay');
    ov.hidden = true;
    ov.classList.remove('is-closing');
  }
});

$('modalCancel').onclick = closeModal;
$('modalOk').onclick = () => {
  const fn = st.modal.onOk;
  closeModal();
  if (fn) fn();
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'btnClose') {
    if (!st.busy) postToHost({ type: 'IMPRINT_CLOSE_REQ', reason: 'USER' });
    return;
  }
  if (b.dataset.wsTarget) {
    st.charId = b.dataset.wsTarget;
    const c = curChar();
    const first = Object.keys(c?.imprints?.items || {})[0] || st.placement;
    loadPlacement(first);
    renderAll();
    return;
  }
  if (b.dataset.wsGroup) {
    st.group = b.dataset.wsGroup;
    renderAll();
    return;
  }
  if (b.dataset.wsPlace) {
    loadPlacement(b.dataset.wsPlace);
    renderAll();
    redrawStage(true);
    return;
  }
  if (b.dataset.wsPattern) {
    st.draft.patternId = b.dataset.wsPattern;
    st.error = '';
    renderAll();
    redrawStage(true);
    return;
  }
  if (b.dataset.wsField) {
    const [k, v] = b.dataset.wsField.split(':');
    if (k && v) {
      st.draft[k] = v;
      st.error = '';
      renderAll();
      redrawStage(true);
    }
    return;
  }
  if (b.dataset.wsAngle !== undefined) {
    st.draft.textAngle = Number(b.dataset.wsAngle) || 0;
    renderAll();
    redrawStage(true);
    return;
  }
  if (b.dataset.wsInspo) {
    st.draft.text = String(b.dataset.wsInspo).slice(0, 16);
    st.draft.textEnabled = true;
    st.error = '';
    renderAll();
    redrawStage(true);
    return;
  }
  if (b.id === 'btnTogglePattern') {
    st.draft.patternEnabled = !st.draft.patternEnabled;
    st.error = '';
    renderAll();
    redrawStage(true);
    return;
  }
  if (b.id === 'btnToggleText') {
    st.draft.textEnabled = !st.draft.textEnabled;
    st.error = '';
    renderAll();
    redrawStage(true);
    return;
  }
  if (b.id === 'btnToggleDrawer' || b.id === 'topStatusPill') {
    if (Object.keys(curChar()?.imprints?.items || {}).length) {
      st.summaryOpen = !st.summaryOpen;
      renderAll();
    }
    return;
  }
  if (b.dataset.wsJump) {
    loadPlacement(b.dataset.wsJump);
    renderAll();
    redrawStage(true);
    return;
  }
  if (b.dataset.wsRemoveOne || b.id === 'btnRemoveTop' || b.id === 'btnRemoveFoot') {
    if (st.busy) return;
    const c = curChar();
    const pid = b.dataset.wsRemoveOne || st.placement;
    const existing = c?.imprints?.items?.[pid];
    if (!existing) return;
    const pl = byId(PLACEMENTS, pid);
    const total = Object.keys(c.imprints.items).length;
    const remain = total - 1;
    const label = entryLabel(existing);
    const body = total <= 1
      ? fill(I.removeLastPlaceText, { name: c.name, placementShort: pl.short, label })
      : fill(I.removePlaceText, { name: c.name, placementShort: pl.short, label, remain });
    openModal(I.removePlaceTitle, body, I.removePlaceConfirm, () => {
      sendOp(
        { type: 'PLAYER_IMPRINT_SET', personRef: c.id, action: 'remove_one', placement: pid },
        { action: 'remove_one', placement: pid, charName: c.name, placeShort: pl.short }
      );
    });
    return;
  }
  if (b.dataset.wsRemoveAll || b.id === 'btnRemoveAll') {
    if (st.busy) return;
    const c = curChar();
    const cnt = Object.keys(c?.imprints?.items || {}).length;
    if (!cnt) return;
    openModal(
      I.removeAllTitle,
      fill(I.removeAllText, { name: c.name, count: cnt }),
      I.removeAllConfirm,
      () => {
        sendOp(
          { type: 'PLAYER_IMPRINT_SET', personRef: c.id, action: 'remove_all' },
          { action: 'remove_all', charName: c.name, count: cnt }
        );
      }
    );
    return;
  }
  if (b.id === 'btnSave') {
    if (st.busy) return;
    const c = curChar();
    if (!c) return;
    if (!gateOf(c).eligible) return;
    if (!st.draft.patternEnabled && !st.draft.textEnabled) {
      st.error = I.errBothOff;
      renderAll();
      return;
    }
    if (st.draft.textEnabled && !String(st.draft.text || '').trim()) {
      st.error = I.errTextRequired;
      renderAll();
      return;
    }
    if (st.draft.textEnabled && /[\r\n<>]/.test(st.draft.text)) {
      st.error = I.textInvalidHint;
      renderAll();
      return;
    }
    const pl = byId(PLACEMENTS, st.placement);
    const old = c.imprints?.items?.[st.placement];
    const cleanText = String(st.draft.text || '').trim().slice(0, 16);
    const op = {
      type: 'PLAYER_IMPRINT_SET',
      personRef: st.charId,
      action: 'save',
      placement: st.placement,
      patternEnabled: !!st.draft.patternEnabled,
      patternId: st.draft.patternId,
      patternScale: st.draft.patternScale,
      patternColor: st.draft.patternColor,
      textEnabled: !!st.draft.textEnabled,
      text: cleanText,
      textLayout: st.draft.textLayout,
      textScale: st.draft.textScale,
      textAngle: Number(st.draft.textAngle) || 0,
      font: st.draft.font,
      textColor: st.draft.textColor,
    };
    const meta = {
      action: 'save',
      isUpdate: Boolean(old),
      placement: st.placement,
      charName: c.name,
      placeShort: pl.short,
      label: entryLabel({ ...st.draft, text: cleanText }),
      draftText: buildDraftText(c, pl, { ...st.draft, text: cleanText }),
    };
    if (old) {
      openModal(
        I.overwritePlaceTitle,
        fill(I.overwritePlaceText, {
          name: c.name,
          placementShort: pl.short,
          oldLabel: entryLabel(old),
          newLabel: meta.label,
        }),
        I.removePlaceConfirm.replace('此部位', '覆盖'),
        () => sendOp(op, meta)
      );
    } else {
      sendOp(op, meta);
    }
  }
});

$('wsImprintText').addEventListener('input', (e) => {
  st.draft.text = String(e.target.value || '').slice(0, 16);
  if (e.target.value !== st.draft.text) e.target.value = st.draft.text;
  const len = st.draft.text.length;
  $('wsTextCount').textContent = fill(I.textLimitHint, { len });
  $('wsTextCount').classList.toggle('is-max', len >= 16);
  st.error = '';
  $('wsTextErr').hidden = true;
  redrawStage(false);
});

$('wsAngleSlider').addEventListener('input', (e) => {
  const deg = Math.max(-30, Math.min(30, Number(e.target.value) || 0));
  st.draft.textAngle = deg;
  $('angleValText').textContent = `${deg > 0 ? '+' : ''}${deg}°`;
  document.querySelectorAll('[data-ws-angle]').forEach((x) => {
    const on = Number(x.dataset.wsAngle) === deg;
    x.classList.toggle('on', on);
    x.setAttribute('aria-checked', String(on));
  });
  redrawStage(false);
});

$('wsFillInput').addEventListener('change', (e) => {
  st.fillInput = !!e.target.checked;
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (st.modal.open) {
    closeModal();
    return;
  }
  if (st.open && !st.busy) {
    postToHost({ type: 'IMPRINT_CLOSE_REQ', reason: 'USER' });
  }
});

announceReady();
startReadyLoop();
