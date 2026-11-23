const CODE_LABELS={
  INSUFFICIENT_CASH:'可用现金不足（INSUFFICIENT_CASH）',
  PAYMENT_NOT_PROVEN:'正文未证实已完成付款（PAYMENT_NOT_PROVEN）',
  INVALID_MONEY:'金额格式无效（INVALID_MONEY）',
  ALLOCATION_EXCEEDS_COST:'分摊金额超过实付总额（ALLOCATION_EXCEEDS_COST）',
  ASSET_REQUIRED:'购房购车须同步附上资产信息（ASSET_REQUIRED）',
  INVALID_TEXT:'文本为空、类型不符或过长（INVALID_TEXT）'
};
export function diagnosticMessage(items=[]){
  // rc.41：NO_NATIVE_COMMANDS / NATIVE_NOT_PROCESSED 不带 eventType，不能按事件类型过滤掉，
  // 否则"模型没输出变量块"这条告警永远不会显示（死代码）。
  items=items.filter(item=>['CASH_TRANSACTION','TRANSACTION_REFUND','ASSET_TRANSFER','ASSET_GRANT'].includes(item.eventType)||['NO_NATIVE_COMMANDS','NATIVE_NOT_PROCESSED'].includes(item.code));
  if(!items.length)return '';
  const codes=[...new Set(items.map(item=>item.code))];
  if(codes.every(code=>code==='EVIDENCE_NOT_IN_SOURCE'))return '有事件未记录：evidence 不是本轮正文中可匹配的原文。请把对应事件的 evidence 改为本轮正文的直接摘录，再在 MVU 面板重试。其他通过校验的变化已保留。';
  if(codes.every(code=>code==='NO_NATIVE_COMMANDS'||code==='NATIVE_NOT_PROCESSED'))return '本轮变量更新尚未确认。请检查回复末尾是否有有效的 UpdateVariable/JSONPatch 更新块，再在 MVU 面板检查解析结果。';
  const details=items.slice(0,3).map(item=>{
    const where=Number.isInteger(item.ordinal)?'第'+(item.ordinal+1)+'项事件'+(item.field?'的 '+item.field:''):item.field||item.person||'';
    const reason=CODE_LABELS[item.code]||item.code;
    return (where?where+'：':'')+reason;
  });
  const isolated=items.every(item=>Number.isInteger(item.ordinal)||item.field||item.person);
  return '部分变化未记录（'+codes.join('、')+'）：'+details.join('；')+'。'+(isolated?'其他通过检查的变化已保留。':'')+'请修正对应更新后在 MVU 面板重试。';
}
