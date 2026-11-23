// rc.47：两座工坊的渲染层（高定升级版）。
// 结构 / id / 类名 / 区块顺序逐项对齐：
//   RC47总方案/03_原型/rc47-proto-imprint.html（正文 589–713）
//   RC47总方案/03_原型/rc47-proto-choker.html（正文 457–529）
// 事件仍走 data-ws-* 由 app.js 分发；id 与 data-* 并存（YG 2026-11-22 批准方案 A）。
import {WHEEL_COPY, fill} from '../core/wheel-ui-copy.js';
import {CHOKER_STYLES, checkDeviceThreshold} from '../core/device-catalog.js';
import {composeChoker, chokerStyleDesc, STAGE} from './imprint-art.js';
import {renderToyLinkLite} from './toylink-lite.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => String.fromCharCode(38) + ({'&': 'amp;', '<': 'lt;', '>': 'gt;', '"': 'quot;', "'": '#39;'}[c]));
const women = (state) => Object.values(state?.characters || {}).filter((c) => c.trackingState === 'RECORDED');

// 原型 #targetArea（proto-imprint:976-984 / proto-choker 同构）：达标显示计数，未达标加深色「未达标」标
function targetArea(state, ui, label, counter) {
  const list = women(state);
  if (!list.length) return `<div class="ws-empty-banner">${esc(WHEEL_COPY.workshop.common.noWomanEmpty)}</div>`;
  return `<div class="ws-target-wrap"><span class="ws-target-lbl">${esc(label)}</span><div class="ws-target-strip" role="radiogroup" aria-label="${esc(label)}">${list.map((w) => {
    const n = counter(w);
    const g = checkDeviceThreshold(w);
    return `<button type="button" class="ws-char-chip${ui.charId === w.id ? ' on' : ''}${g.eligible ? '' : ' is-blocked'}" data-ws-target="${esc(w.id)}" role="radio" aria-checked="${ui.charId === w.id}"><span class="av">${esc(w.name.slice(0, 1))}</span><span>${esc(w.name)}</span>${n ? `<span class="cnt-tag">${n}</span>` : ''}${g.eligible ? '' : `<span class="gate-tag">${esc(WHEEL_COPY.workshop.common.gateTagBlocked)}</span>`}</button>`;
  }).join('')}</div></div>`;
}

// 原型门槛条（proto-imprint:986-995）
function gateBanner(kind, w, gate, marked, worn) {
  const C = WHEEL_COPY.workshop;
  const show = Boolean(w && !gate.eligible);
  const I = kind === 'imprint' ? C.imprint : C.choker;
  const title = fill(I.gateTitle, {name: w?.name || ''});
  const desc = kind === 'imprint'
    ? (marked ? fill(I.gateDescMarked, {count: marked}) : fill(I.gateDescEmpty, {affGap: gate.affGap, corGap: gate.corGap}))
    : (worn ? I.gateDescWorn : fill(I.gateDescEmpty, {affGap: gate.affGap, corGap: gate.corGap}));
  return `<div class="ws-gate-banner" id="gateBanner" role="status"${show ? '' : ' hidden'}>
    <div class="ws-gate-hd"><span id="gateTitle">${esc(show ? title : (kind === 'imprint' ? '未达到印记使用门槛' : '未达到项圈使用门槛'))}</span><span id="gateRule">${esc(C.common.gateRule)}</span></div>
    <div class="ws-gate-metrics" id="gateMetrics">${show ? `<span class="ws-gate-pill">${esc(fill(C.common.gateMetricAff, {affection: gate.affection, affGap: gate.affGap}))}</span><span class="ws-gate-pill">${esc(fill(C.common.gateMetricCor, {corruption: gate.corruption, corGap: gate.corGap}))}</span>` : ''}</div>
    <div class="ws-gate-desc" id="gateDesc">${esc(show ? desc : '')}</div>
  </div>`;
}

function dossierPreview(state, ui, styleId) {
  const w = state?.characters?.[ui.charId] || null;
  if (!w) return `<div class="dossier-preview-hd">女性档案胶囊预览（同步联动）</div><div class="dossier-acc">暂无已收录女性</div>`;
  if (w.choker?.worn) {
    const styleName = CHOKER_STYLES.find((s) => s.id === styleId)?.name || '';
    const insTxt = w.choker.inscription ? `铭牌刻“${w.choker.inscription}”，` : '';
    return `<div class="dossier-preview-hd">女性档案胶囊预览（同步联动）</div><div class="dossier-name-row"><b>${esc(w.name)}</b><span class="choker-capsule" title="点击前往项圈工坊修改或摘下">⛓️ 誓约项圈</span></div><div class="dossier-acc">【誓约项圈】颈间佩戴${esc(styleName)}（${esc(insTxt)}旁人眼中仅如寻常细颈链）</div>`;
  }
  return `<div class="dossier-preview-hd">女性档案胶囊预览（未佩戴时不显示灰标签，仅保留快捷入口）</div><div class="dossier-name-row"><b>${esc(w.name)}</b><span class="quick-dashed">+ 项圈</span></div><div class="dossier-acc">穿搭配饰：珍珠耳钉</div>`;
}

export function renderChoker({state, ui}) {
  const C = WHEEL_COPY.workshop.choker;
  const common = WHEEL_COPY.workshop.common;
  const w = state?.characters?.[ui.charId] || null;
  const worn = women(state).filter((x) => x.choker?.worn === true);
  // rc.55 / B-10：编辑控件与预览读草稿，已佩戴摘要才读落库值。原先优先读 w.choker，
  // 已佩戴人物点换款后重绘仍显示旧款（草稿只在确认保存时才生效），选中态与舞台和表单分叉。
  const styleId = ui.chokerDraft?.styleId || w?.choker?.styleId || 'obsidian_velvet';
  const ins = ui.chokerDraft?.inscription ?? w?.choker?.inscription ?? '';
  const unlocked = !!state?.wheel?.chokerUnlocked;
  const styleName = CHOKER_STYLES.find((s) => s.id === styleId)?.name || '';
  const gate = checkDeviceThreshold(w);
  const styles = CHOKER_STYLES.map((s) => `<button type="button" class="choker-style-btn${styleId === s.id ? ' on' : ''}" data-ws-style="${esc(s.id)}" role="radio" aria-checked="${styleId === s.id}"><span class="choker-swatch ${esc(s.swatch || '')}"></span><span class="choker-style-name">${esc(s.name)}</span></button>`).join('');

  let saveLabel, saveDisabled = true, reasonText = '', reasonHidden = true;
  if (!w) saveLabel = common.noWomanBtn;
  else if (!unlocked) { saveLabel = C.btnLocked; reasonHidden = false; reasonText = C.footerReasonLocked; }
  else if (!gate.eligible) {
    saveLabel = fill(common.btnBlocked, {affGap: gate.affGap, corGap: gate.corGap});
    reasonHidden = false;
    reasonText = fill(C.footerReasonBlocked, {name: w.name, action: w.choker?.worn ? '更新款式' : '佩戴项圈', affection: gate.affection, corruption: gate.corruption});
  } else { saveDisabled = false; saveLabel = w.choker?.worn ? C.btnUpdate : fill(C.btnWear, {name: w.name}); }

  return `<div class="ws-scroll" data-workshop="choker" data-kind="choker">
    <div class="ws-topbar">
      <button type="button" class="backlink" id="btnBack" data-act="close-workshop">${esc(common.backBtn)}</button>
      <div class="ws-topbar-right">
        <button type="button" class="ws-status-pill" id="topStatusPill" aria-expanded="false">${esc(w?.choker?.worn ? fill(C.targetStatusWorn, {styleName}) : C.targetStatusNone)}</button>
        <button type="button" class="ws-remove-top" id="btnRemoveTop" data-ws-choker-remove="1"${w?.choker?.worn ? '' : ' hidden'}>${esc(C.btnRemove)}</button>
      </div>
    </div>
    <div class="ws-locked-banner" id="lockedBanner"${unlocked ? ' hidden' : ''}><span>${esc(C.lockedBanner)}</span><button type="button" class="ws-shop-btn" id="btnGoShop" data-act="open-shop-permanent">${esc(common.goShopBtn)}</button></div>
    <div id="targetArea">${targetArea(state, ui, C.targetLabel, (c) => (c.choker?.worn ? 1 : 0))}</div>
    ${gateBanner('choker', w, gate, 0, !!w?.choker?.worn)}
    <div class="ws-worn-summary" id="wornSummary"${worn.length ? '' : ' hidden'}>${worn.length ? esc(fill(C.wornListSummary, {count: worn.length, names: worn.map((x) => x.name).join('、')})) : ''}</div>
    <div class="ws-body">
      <section class="ws-stage-card" aria-label="誓约项圈预览舞台">
        <svg id="chokerStageSvg" class="ws-stage-svg" viewBox="0 0 ${STAGE.w} ${STAGE.h}" role="img" aria-label="黑曜誓约项圈预览">${composeChoker({styleId, inscription: ins})}</svg>
        <div class="ws-stage-caption"><span id="stageLeftCap"><b>${esc(styleName)}</b></span><span id="stageRightCap">${esc(ins ? `刻字：“${ins}”` : '素面无字')}</span></div>
      </section>
      <section class="ws-controls">
        <div class="ws-group">
          <div class="ws-group-hd"><span>${esc(C.secStyle)}（${CHOKER_STYLES.length} 款）</span></div>
          <div class="choker-style-grid" id="styleList" role="radiogroup" aria-label="${esc(C.secStyle)}">${styles}</div>
          <div class="choker-style-desc" id="styleDesc">${esc(`${styleName}：${chokerStyleDesc(styleId)}`)}</div>
        </div>
        <div class="ws-group">
          <div class="ws-group-hd"><span>${esc(C.secInscription)}</span><span class="ws-count" id="insCount">${esc(fill(C.insLimitHint, {len: String(ins).length}))}</span></div>
          <div class="ws-input-row"><input id="wsChokerIns" type="text" maxlength="12" value="${esc(ins)}" placeholder="${esc(C.insPlaceholder)}" data-ws-ins="1" autocomplete="off" aria-label="${esc(C.secInscription)}"></div>
          <div class="ws-field-err" id="insErr"${ui.error ? '' : ' hidden'}>${esc(ui.error || '')}</div>
        </div>
        <div class="dossier-preview" id="dossierPreview">${dossierPreview(state, ui, styleId)}</div>
      </section>
    </div>
  </div>
  <footer class="ws-footer">
    <label class="ws-fill-toggle"><input type="checkbox" id="wsFillInput" data-ws-fill="1" ${ui.fillInput ? 'checked' : ''}><span>${esc(common.fillInputLabel)}</span></label>
    <div class="ws-footer-reason" id="footerReason"${reasonHidden ? ' hidden' : ''}>${esc(reasonText)}</div>
    <div class="ws-footer-acts">
      <button type="button" class="btn secondary ws-btn-del" id="btnRemoveFoot" data-ws-choker-remove="1"${w?.choker?.worn ? '' : ' hidden'}>${esc(C.btnRemove)}</button>
      <button type="button" class="btn gold ws-btn-save" id="btnSave" data-ws-choker-save="1" ${saveDisabled ? 'disabled' : ''}>${esc(saveLabel)}</button>
    </div>
  </footer>`;
}

export function renderWorkshop(kind, ctx) {
  if (kind === 'choker') return renderChoker(ctx);
  if (kind === 'toylink-lite') return renderToyLinkLite({state: ctx?.state, toy: ctx?.toy});
  return '';
}

