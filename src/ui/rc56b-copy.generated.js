// 本文件由 scripts/extract-rc56b-copy.mjs 从 4N 方案 B 自动抠取，禁止手改。
// 源：reports/rc56-称呼与多人覆盖方案-4N-20261124.md
//   过渡补丁 §5.5 ← L206-206
//   UI 文案 §5.6 ← L214-236
export const DYNAMIC_FIELDS_PATCH = "【终端变量补充】①addressing是动态称呼而非固定设定：当玩家在正文明确要求改口且角色应下、或关系跃迁/冷战软化促成正式改口时，本轮必须replace /shenghao/characters/<ID>/addressing；公开避险或情动单句口癖不覆写，无契机不乱改。②多人同场时，presentCharacterIds（及_context.presentThoughtIds）列出的每一位在场人物都必须在本轮各自replace /shenghao/characters/<ID>/currentThought，哪怕仅在旁观也不得漏写。";

export const RENAME = {
  btn: "改称呼",
  title: "修改她对你的称呼",
  note: "修改后立即生效，下一轮起她将按新称呼与你互动；剧情中自然改口也会自动同步。",
  placeholder: "例如：哥、老板、阿澈、老公（1–20字）",
  cancel: "取消",
  save: "保存称呼",
  doneTpl: "已更新称呼为「{value}」",
  invalid: "称呼请填写 1 至 20 个字。",
};

export const DEBUG_OVERLAY = {
  title: "调试观察",
  note: "在「此刻」页心声下方显示本轮字段同步状态（排查用）",
  off: "关",
  on: "开",
};

export const THOUGHT_BADGE = {
  UPDATED: "本轮已更",
  SAME_VALUE: "与上轮同文",
  MISSING: "未收到补丁",
  DROPPED: "补丁被拦截",
};
export const ADDRESSING_BADGE = "称呼已变";
