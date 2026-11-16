export function setupStatus(view){
  const p=view.setupProgress;
  if(p?.phase==='initializing')return '正在创建开局记录……';
  if(p?.phase==='saving')return '正在保存开局并等待 MVU 确认……';
  return '正在等待当前生成或变量处理结束……';
}
