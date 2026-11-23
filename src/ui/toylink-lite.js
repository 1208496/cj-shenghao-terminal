// rc.53：TOY·LINK 极简遥控（手机内嵌面板，不加 iframe）。
// DOM / 类名 / 区块顺序取自 RC53总方案/02 §4.3 与 03 §5.1；文案 100% 取自 WHEEL_COPY.workshop.toylinkLite。
// 红线：极简版只改角色状态，从不读写聊天输入框（不填字、不删字）。
import {WHEEL_COPY, fill} from '../core/wheel-ui-copy.js';
import {checkDeviceThreshold} from '../core/device-catalog.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => String.fromCharCode(38) + ({'&': 'amp;', '<': 'lt;', '>': 'gt;', '"': 'quot;', "'": '#39;'}[c]));
const gearOf = (pow) => { const n = Number(pow) || 0; return n <= 45 ? 1 : n <= 75 ? 2 : 3; };

export function renderToyLinkLite({state, toy}) {
  const L = WHEEL_COPY.workshop.toylinkLite;
  const common = WHEEL_COPY.workshop.common;
  const unlocked = !!state?.wheel?.toyLinkUnlocked;
  const t = toy || {};
  const wearingIds = Array.isArray(t.wearingIds) ? t.wearingIds : [];
  const activeMode = t.activeMode || null;
  const running = !!t.running;
  const lockLab = activeMode === 'lab';
  const women = Object.values(state?.characters || {}).filter((c) => c.trackingState === 'RECORDED');
  const c = (t.selectedId && state?.characters?.[t.selectedId]) || women[0] || null;
  const gate = checkDeviceThreshold(c);
  const worn = Boolean(c && wearingIds.includes(c.id));
  const isRunningThis = Boolean(running && c && t.targetId === c.id);
  const isRunningOther = Boolean(running && c && t.targetId && t.targetId !== c.id);
  const activeName = (isRunningOther && state?.characters?.[t.targetId]?.name) || '';
  const gear = gearOf(t.pow);
  const gears = L.gears;
  const gearLabel = gears[gear - 1].label;

  const pillText = !unlocked ? L.pillLocked
    : lockLab ? L.pillLabLocked
    : running ? fill(L.pillLive, {gearShort: gears[gear - 1].short})
    : wearingIds.length ? L.pillWorn : L.pillIdle;
  const pillCls = (!unlocked || lockLab) ? 'is-locked' : running ? 'is-live' : wearingIds.length ? 'is-worn' : 'is-idle';

  // 03 §4：{summary} 由现有文案键确定性拼接（不新增文案串）
  const summary = running
    ? `${(state?.characters?.[t.targetId]?.name) || (c ? c.name : '')} · ${L.dotLive}`
    : fill(L.wornCount, {count: wearingIds.length});

  const disAll = !unlocked || lockLab;
  const wearDis = disAll || !c || !gate.eligible;
  const unwearDis = disAll || !c;
  const startDis = disAll || !c || !gate.eligible || !worn || isRunningOther;
  const gearDis = disAll || !c || !gate.eligible || !worn || isRunningOther;

  const stateText = isRunningThis ? fill(L.stateRunning, {gearLabel})
    : worn ? L.stateWornIdle : L.stateUnworn;

  const chips = women.map((w) => {
    const wWorn = wearingIds.includes(w.id);
    const wLive = Boolean(running && t.targetId === w.id);
    const wGate = !checkDeviceThreshold(w).eligible;
    const on = Boolean(c && c.id === w.id);
    const dot = wLive ? `<span class="tl-lite-dot is-live">${esc(L.dotLive)}</span>`
      : wWorn ? `<span class="tl-lite-dot is-worn">${esc(L.dotWorn)}</span>`
      : wGate ? `<span class="tl-lite-dot is-gate">${esc(L.dotGate)}</span>` : '';
    return `<button type="button" class="tl-lite-chip${on ? ' on' : ''}${wGate ? ' is-blocked' : ''}" data-tl-lite-select="${esc(w.id)}" role="radio" aria-checked="${on}"><span class="tl-lite-name">${esc(w.name)}</span>${dot}</button>`;
  }).join('');

  const gearBtns = gears.map((g) => `<button type="button" class="tl-lite-gear${gear === g.gear ? ' on' : ''}" data-tl-lite-gear="${g.gear}" role="radio" aria-checked="${gear === g.gear}"${gearDis ? ' disabled' : ''}><b>${esc(g.short)}</b><small>${esc(g.sub)}</small></button>`).join('');

  const wearBtn = worn
    ? `<button type="button" class="btn secondary tl-lite-btn is-danger-outline" data-tl-lite-unwear="1"${unwearDis ? ' disabled' : ''}>${esc(L.btnUnwear)}</button>`
    : `<button type="button" class="btn secondary tl-lite-btn" data-tl-lite-wear="1"${wearDis ? ' disabled' : ''}>${esc(L.btnWear)}</button>`;
  const runBtn = isRunningThis
    ? `<button type="button" class="btn danger tl-lite-btn" data-tl-lite-stop="1"${disAll ? ' disabled' : ''}>${esc(L.btnStop)}</button>`
    : `<button type="button" class="btn tl-lite-btn" data-tl-lite-start="1"${startDis ? ' disabled' : ''}>${esc(L.btnStart)}</button>`;

  const labLabel = activeMode === 'lite' ? L.btnOpenLabLocked : activeMode === 'lab' ? L.btnBackToLab : L.btnOpenLab;
  const labCls = activeMode === 'lite' ? ' is-locked-switch' : '';

  const lockBanner = (unlocked && lockLab) ? `<div class="tl-lite-banner is-mode-lock" data-tl-mode-lock="lab" role="status">
      <p class="tl-lite-lock-msg">${esc(fill(L.labLockBanner, {summary}))}</p>
      <div class="tl-lite-lock-acts">
        <button type="button" class="btn secondary tl-lite-sm-btn" data-tl-open-lab="1">${esc(L.btnBackToLab)}</button>
        <button type="button" class="btn danger tl-lite-sm-btn" data-tl-lite-reset="1">${esc(L.btnReset)}</button>
      </div>
    </div>` : '';

  const body = women.length === 0
    ? `<div class="card tl-lite-empty">${esc(L.emptyNoWoman)}</div>`
    : `<section class="card tl-lite-sec" aria-label="${esc(L.secTarget)}">
      <div class="tl-lite-sec-hd"><span>${esc(L.secTarget)}</span><small>${esc(fill(L.wornCount, {count: wearingIds.length}))}</small></div>
      <div class="tl-lite-chips" role="radiogroup" aria-label="${esc(L.secTarget)}">${chips}</div>
    </section>
    ${(c && !gate.eligible) ? `<div class="tl-lite-banner is-gate" role="status">${esc(fill(L.gateBanner, {name: c.name, affection: gate.affection, corruption: gate.corruption}))}</div>` : ''}
    ${isRunningOther ? `<div class="tl-lite-banner is-busy" role="status">
      <span>${esc(fill(L.otherRunningBanner, {activeName, name: c.name}))}</span>
      <button type="button" class="mini-btn" data-tl-lite-stop="1">${esc(fill(L.btnStopOther, {activeName}))}</button>
    </div>` : ''}
    <section class="card tl-lite-ctrl">
      <div class="tl-lite-status">
        <b data-tl-lite-target-name>${esc(c ? c.name : '')}</b>
        <span class="tl-lite-state-text" data-tl-lite-state>${esc(stateText)}</span>
      </div>
      <div class="tl-lite-row">${wearBtn}${runBtn}</div>
      <div class="tl-lite-sec-hd tl-lite-gear-hd"><span>${esc(L.secGear)}</span><small data-tl-lite-gear-cur>${esc(gearLabel)}</small></div>
      <div class="tl-lite-gears" role="radiogroup" aria-label="${esc(L.secGear)}">${gearBtns}</div>
      <p class="muted tl-lite-hint">${esc(L.hint)}</p>
    </section>`;

  return `<div class="tl-lite" data-tl-lite-root="1">
    <div class="tl-lite-top">
      <button type="button" class="backlink" data-act="close-workshop">${esc(common.backBtn)}</button>
      <span class="tl-lite-pill ${pillCls}" data-tl-lite-pill>${esc(pillText)}</span>
    </div>
    ${unlocked ? '' : `<div class="tl-lite-banner is-locked" role="status">${esc(L.lockedBanner)}</div>`}
    ${lockBanner}
    ${body}
    <div class="tl-lite-foot">
      <button type="button" class="btn secondary full tl-lite-reset-btn${activeMode ? ' is-active' : ''}" data-tl-lite-reset="1"${activeMode ? '' : ' disabled'}>${esc(activeMode ? L.btnReset : L.btnResetIdle)}</button>
      <button type="button" class="btn ghost full tl-lite-lab-btn${labCls}" data-tl-open-lab="1">${esc(labLabel)}</button>
      ${activeMode === 'lite' ? `<span class="tl-lite-lock-note" data-tl-lab-blocked-hint>${esc(L.labSwitchBlockedHint)}</span>` : `<span class="muted tl-lite-foot-note">${esc(L.labNote)}</span>`}
    </div>
  </div>`;
}
