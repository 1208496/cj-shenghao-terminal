// 想法池 07：开局表单必填校验规则（纯函数，便于单测）。
// 资产、熟人、天气、工作与生活、性器三项、颜值/性能力都有默认值或确实可空，故不列入。
// 年龄单独校验整数范围；姓名在 step 0 与 age 一起进 missing 列表。
export const STEP_REQUIRED={0:['name','gender','occupation','appearance','body','background'],1:['currentLocation','startDate','startTime']};
export function missingInStep(draft,step){
  const missing=(STEP_REQUIRED[step]||[]).filter(k=>!String(draft?.[k]??'').trim());
  if(step===0&&!(Number.isInteger(Number(draft?.age))&&Number(draft.age)>=1))missing.unshift('age');
  return missing;
}
