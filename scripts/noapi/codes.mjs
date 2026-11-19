// scripts/noapi/codes.mjs —— 失败归因码（纯函数，可离线单测）
//
// 设计依据：rc47 双模型对照报告 §5.2「归因码表」——用 4N 的 F0/F8 切法，
// 配 4A 的「每码必落盘字段 + 一眼定责判据」。
// 本文件不含任何浏览器/网络依赖，Node 直接跑。

export const CODES = {
  PASS: { code: 'PASS', name: '通过', action: 'continue' },
  F0: { code: 'F0', name: '环境/关卡门未过', action: 'abort', hint: '8001 未起 / 卡没选中 / 聊天没进去 / 世界书或脚本 iframe 未生效 / 宿主对象不存在' },
  F1: { code: 'F1', name: '目标元素不存在', action: 'continue', hint: '选择器或契约锚点没命中，卡改结构或锚点被删' },
  F2: { code: 'F2', name: '目标元素不可见', action: 'continue', hint: 'display:none / 0×0 / opacity:0 / 在折叠容器里' },
  F3: { code: 'F3', name: '目标元素不可点', action: 'continue', hint: 'disabled / aria-disabled / pointer-events:none / 被遮挡 / 宿主 busy 逻辑拒绝' },
  F4: { code: 'F4', name: '寻址歧义（多匹配）', action: 'continue', hint: '同选择器命中多个节点且未指定 index，可能点错' },
  F5: { code: 'F5', name: '点击无任何可观测反应', action: 'continue', hint: 'DOM/状态/postMessage/控制台四维全 0：事件没到处理函数，或被静默 return' },
  F6: { code: 'F6', name: '状态已变但渲染未跟上', action: 'continue', hint: '宿主 revision 变了，界面断言仍不成立：渲染层/投影层问题' },
  F7: { code: 'F7', name: '测试框架自身错误', action: 'abort', hint: '脚本异常、选择器语法错、evidence 结构缺失——不是卡的 bug' },
  F8: { code: 'F8', name: '零 API 违约（会花钱）', action: 'abort', hint: '命中生成端点 / generateRaw / 真实 GENERATION_STARTED' },
  F9: { code: 'F9', name: '宿主拒绝操作（业务规则码）', action: 'continue', hint: '操作确实送到了宿主，但 mutateState/replayPlayerCommand 抛了规则码（LEDGER_MISMATCH / GENERATION_BUSY / STALE_SOURCE / STALE_REVISION …）：点了有效，是数据或前置条件不成立' },
};

/** 归因顺序即优先级：先排除"根本没资格判"，再判"点不到"，最后判"点了没用"。 */
const ORDER = ['F8', 'F0', 'F7', 'F4', 'F1', 'F2', 'F3', 'F9', 'F5', 'F6'];

/**
 * @param {object} ev 证据包（由 runtime 采集，纯数据）
 * @param {string[]} [ev.violations]      零 API 违约记录
 * @param {object}   [ev.env]              {ready, reasons[]}
 * @param {string|null} [ev.error]         采集过程中的异常
 * @param {object}   [ev.target]           {found, count, ambiguous, indexGiven}
 * @param {object}   [ev.visibility]       {visible}
 * @param {object}   [ev.interact]         {disabled, ariaDisabled, pointerEventsNone, coveredBy, hostBusy, busyReasons}
 * @param {object}   [ev.reaction]         {domChanged, stateChanged, postMessage, consoleErrors}
 * @param {object}   [ev.render]           {expectation, matched, revisionBefore, revisionAfter}
 * @returns {{code:string,name:string,action:string,reason:string,detail:object}}
 */
export function classify(ev = {}) {
  const checks = {
    F8: () => (Array.isArray(ev.violations) && ev.violations.length ? `零 API 违约 ${ev.violations.length} 次：${ev.violations.slice(0, 3).join(' | ')}` : null),

    F0: () => {
      const env = ev.env;
      if (!env) return null;
      if (env.ready === false) return `环境关卡未过：${(env.reasons || ['未知原因']).join('；')}`;
      return null;
    },

    F7: () => {
      if (ev.error) return `采集/执行异常：${String(ev.error).slice(0, 300)}`;
      // 证据不全一律 F7：不许因为"没东西可判"就静默 PASS（空证据包是最危险的假绿）。
      if (!ev.target || typeof ev.target.found !== 'boolean') return '证据包缺少 target.found，无法判定';
      return null;
    },

    F4: () => {
      const t = ev.target;
      if (!t || !t.found) return null;
      if (t.count > 1 && !t.indexGiven) return `选择器命中 ${t.count} 个节点且未指定 index，无法确定点的是哪一个`;
      return null;
    },

    F1: () => {
      const t = ev.target;
      if (!t) return null;
      if (t.found === false) return `目标未命中${t.selector ? `：${t.selector}` : ''}${t.framePath ? `（frame ${JSON.stringify(t.framePath)}）` : ''}`;
      return null;
    },

    F2: () => {
      const v = ev.visibility;
      if (!v || v.visible !== false) return null;
      const bits = [];
      if (v.display === 'none') bits.push('display:none');
      if (v.rect && (v.rect.w === 0 || v.rect.h === 0)) bits.push(`尺寸 ${v.rect.w}×${v.rect.h}`);
      if (v.opacity === '0') bits.push('opacity:0');
      if (v.visibilityHidden) bits.push('visibility:hidden');
      if (v.inCollapsed) bits.push('位于折叠容器内');
      return `元素存在但不可见${bits.length ? '：' + bits.join('、') : ''}`;
    },

    F3: () => {
      const i = ev.interact;
      if (!i) return null;
      const bits = [];
      if (i.disabled) bits.push('disabled');
      if (i.ariaDisabled) bits.push('aria-disabled=true');
      if (i.pointerEventsNone) bits.push('pointer-events:none');
      if (i.coveredBy) bits.push(`被 ${i.coveredBy} 遮挡`);
      if (i.hostBusy) bits.push(`宿主 busy（${Object.entries(i.busyReasons || {}).filter(([, v]) => v).map(([k]) => k).join('+') || 'unknown'}）`);
      if (!bits.length) return null;
      return `元素可见但不可点：${bits.join('、')}`;
    },

    F9: () => {
      const r = ev.reaction;
      if (!r) return null;
      if (r.hostError) return `宿主拒绝这次操作：${String(r.hostError).slice(0, 200)}（操作已送达宿主，不是没点上；查数据一致性与前置条件）`;
      return null;
    },

    F5: () => {
      const r = ev.reaction;
      if (!r) return null;
      const moved = !!(r.domChanged || r.stateChanged || r.postMessage || (r.consoleErrors || []).length);
      if (moved) return null;
      return '点击后四维（DOM / 宿主状态 / postMessage / 控制台）全无变化：事件可能没到处理函数，或被静默拒绝';
    },

    F6: () => {
      const [render, r] = [ev.render, ev.reaction];
      if (!render) return null;
      if (render.matched === true) return null;
      if (r && r.stateChanged) return `宿主状态已变（revision ${render.revisionBefore} → ${render.revisionAfter}），但界面断言仍不成立：${render.expectation || '未给期望'}`;
      return null;
    },
  };

  for (const code of ORDER) {
    let reason = null;
    try { reason = checks[code](); } catch (e) { reason = `归因器在 ${code} 上抛错：${e.message}`; }
    if (reason) return { ...CODES[code], reason, detail: ev };
  }

  // 走到这里说明没有失败层命中：要么真有渲染期望没满足，要么就是通过
  const render = ev.render;
  if (render && render.matched === false) {
    return { ...CODES.F6, reason: `状态未变且渲染断言不成立：${render.expectation || '未给期望'}`, detail: ev };
  }
  return { ...CODES.PASS, reason: '所有归因层均未命中失败条件', detail: ev };
}

/** 便于人工读的定责建议 */
export function oneLine(res) {
  return `${res.code} ${res.name} → ${res.reason}`;
}
