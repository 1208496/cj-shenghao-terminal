export function diagnosticMessage(items=[]){
  items=items.filter(item=>['CASH_TRANSACTION','TRANSACTION_REFUND','ASSET_TRANSFER'].includes(item.eventType));
  if(!items.length)return '';
  const codes=[...new Set(items.map(item=>item.code))];
  if(codes.every(code=>code==='EVIDENCE_NOT_IN_SOURCE'))return '有事件未记录：evidence 不是本轮正文中可匹配的原文。请把对应事件的 evidence 改为本轮正文的直接摘录，再在 MVU 面板重试。其他通过校验的变化已保留。';
  if(codes.every(code=>code==='NO_NATIVE_COMMANDS'||code==='NATIVE_NOT_PROCESSED'))return '本轮变量更新尚未确认。请检查回复末尾是否有有效的 UpdateVariable/JSONPatch 更新块，再在 MVU 面板检查解析结果。';
  const details=items.slice(0,3).map(item=>{
    const where=Number.isInteger(item.ordinal)?'第'+(item.ordinal+1)+'项事件'+(item.field?'的 '+item.field:''):item.field||item.person||'';
    const reason=item.code==='INVALID_TEXT'?'文本为空、类型不符或过长':item.code;
    return (where?where+'：':'')+reason;
  });
  const isolated=items.every(item=>Number.isInteger(item.ordinal)||item.field||item.person);
  return '部分变化未记录（'+codes.join('、')+'）：'+details.join('；')+'。'+(isolated?'其他通过检查的变化已保留。':'')+'请修正对应更新后在 MVU 面板重试。';
}
