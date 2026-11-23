// 本文件由 scripts/extract-opening-copy.mjs 从 4N 方案自动抠取，禁止手改。
// 源：reports/rc56-开局表单方案-4N-20261124.md
//   SETUP_FIELD_HINTS  ← L293-344
//   SETUP_FIELD_ERRORS ← L363-406
//   BEAUTY_HINT        ← L351-351
//   PROWESS_HINT       ← L356-356
//   DRAFT_WARN_TEXT    ← L413-413
//   DRAFT_WARN_BTN     ← L418-418
//   BODY_EMPTY_TEXT    ← L425-425
//   BODY_MISSING_TPL   ← L429-429

export const SETUP_FIELD_HINTS = {
  "name": "必填 · 1–50 字",
  "age": "必填 · 18–80 整数",
  "gender": "必填 · 最多 40 字（点击可选）",
  "occupation": "必填 · 最多 100 字（点击可选）",
  "heightCm": "选填 · 140–230 CM，留空由模型补全",
  "weightKg": "选填 · 35–200 KG，留空由模型补全",
  "shoeSizeEu": "选填 · 34–52 欧码，留空由模型补全",
  "_gen_length": "选填 · 最多 40 字，留空默认 18cm",
  "_gen_girth": "选填 · 最多 40 字，留空默认 4.8cm",
  "_gen_traits": "选填 · 最多 300 字（点击可选）",
  "appearance": "必填 · 最多 500 字（点击可选）",
  "body": "必填 · 最多 500 字（点击可选）",
  "background": "必填 · 最多 1200 字（点击可选）",
  "currentLocation": "必填 · 最多 150 字（点击可选）",
  "workLifeDescription": "选填 · 最多 600 字（点击可选）",
  "startDate": "必填 · 格式 YYYY-MM-DD（点击可选）",
  "startTime": "必填 · 24 小时制 HH:mm（点击可选）",
  "weather": "选填 · 最多 150 字（点击可选）",
  "a_name": "必填 · 最多 120 字（点击可选）",
  "a_value": "非负金额 · 最多两位小数，可填万或亿（如 150万）",
  "a_note": "选填 · 最多 300 字（点击可选）",
  "a_description": "选填 · 最多 50 字，留空按资产自动生成",
  "a_owner": "选填 · 最多 300 字，留空默认本人全额所有",
  "c_brief": "选填 · 最多 400 字；点一键补全需至少 2 字",
  "c_name": "必填 · 1–50 字",
  "c_age": "必填 · 18–80 整数",
  "c_relation": "选填 · 最多 12 字，留空默认「熟人」",
  "c_aff": "0–100 整数，留空默认 40",
  "c_corruption": "0–100 整数，留空默认 0",
  "c_beauty": "选填 · 1–100 整数，留空由模型补全",
  "c_job": "选填 · 最多 100 字（点击可选）",
  "c_cupSize": "选填 · 建议 A–G，留空按三围自动推算",
  "c_addressing": "选填 · 最多 20 字",
  "c_personalityTags": "选填 · 最多 6 个标签，每个不超过 12 字，用顿号或逗号分隔",
  "c_appearance": "选填 · 最多 500 字（点击可选）",
  "c_body": "选填 · 最多 500 字（点击可选）",
  "c_heightCm": "选填 · 100–230 CM",
  "c_weightKg": "选填 · 25–250 KG",
  "c_bustCm": "选填 · 40–200 CM",
  "c_waistCm": "选填 · 30–200 CM",
  "c_hipCm": "选填 · 40–200 CM",
  "c_shoeSizeEu": "选填 · 25–55 欧码",
  "c_recentGoal": "选填 · 最多 200 字，留空自动生成",
  "c_longTermDream": "选填 · 最多 200 字，留空自动生成",
  "c_notes": "选填 · 最多 1200 字（点击可选）",
  "c_chestDetail": "选填 · 最多 200 字，留空自动生成",
  "c_vaginaLook": "选填 · 最多 200 字，留空自动生成",
  "c_pubicHair": "选填 · 最多 120 字，留空自动生成",
  "c_bodyScent": "选填 · 最多 120 字，留空自动生成",
  "c_traits": "选填 · 最多 400 字，留空自动生成"
};

export const SETUP_FIELD_ERRORS = {
  "name_required": "请填写你的姓名（1–50 字）。",
  "name_tooLong": "姓名最多 50 字。",
  "age_required": "请填写年龄（18–80 的整数）。",
  "age_range": "年龄须为 18–80 的整数。",
  "gender_required": "请填写性别（1–40 字）。",
  "gender_tooLong": "性别最多 40 字。",
  "occupation_required": "请填写职业（1–100 字）。",
  "occupation_tooLong": "职业最多 100 字。",
  "heightCm_meters": "身高需填厘米数（140–230），例如 175，请勿填米数。",
  "heightCm_range": "身高须在 140–230 CM 之间，或留空由模型补全。",
  "weightKg_range": "体重须在 35–200 KG 之间，或留空由模型补全。",
  "shoeSizeEu_range": "鞋码须在 34–52 欧码之间，或留空由模型补全。",
  "beautyScore_range": "颜值须为 1–100 的整数。",
  "prowessScore_range": "性能力须为 1–100 的整数。",
  "appearance_required": "请填写外貌与气质（1–500 字）。",
  "body_required": "请填写身材描述（1–500 字）。",
  "background_required": "请填写背景经历（1–1200 字）。",
  "currentLocation_required": "请填写当前地点（1–150 字）。",
  "startDate_invalid": "起始日期格式须为 YYYY-MM-DD（如 2026-01-05）。",
  "startTime_invalid": "起始时间格式须为 24 小时制 HH:mm（如 09:00）。",
  "a_name_required": "请填写资产名称（1–120 字）。",
  "a_value_invalid": "估值格式不正确：请填非负数字，最多两位小数，可带万或亿（如 150万）。",
  "a_value_overflow": "估值超出安全计算范围，请填写更小的金额。",
  "a_limit": "开局资产最多登记 100 项。",
  "c_limit": "初始熟人最多添加 20 位。",
  "c_brief_required": "请先写一句角色描述（至少 2 字），再点模型一键补全。",
  "c_name_required": "请先点击「模型一键补全设定」，或填写熟人姓名（1–50 字）。",
  "c_age_required": "请填写熟人年龄（18–80 的整数）。",
  "c_age_range": "熟人年龄须为 18–80 的整数。",
  "c_relation_tooLong": "与你的关系最多 12 字。",
  "c_aff_range": "初始好感须为 0–100 的整数。",
  "c_corruption_range": "初始堕落度须为 0–100 的整数。",
  "c_beauty_range": "熟人颜值须为 1–100 的整数，或留空。",
  "c_personalityTags_count": "性格标签最多填写 6 个，请用顿号或逗号分隔。",
  "c_personalityTags_len": "单个性格标签最多 12 字，请精简过长的词条。",
  "c_heightCm_meters": "熟人身高需填厘米数（100–230），例如 168，请勿填米数。",
  "c_heightCm_range": "熟人身高须在 100–230 CM 之间，或留空。",
  "c_weightKg_range": "熟人体重须在 25–250 KG 之间，或留空。",
  "c_bustCm_range": "胸围须在 40–200 CM 之间，或留空。",
  "c_waistCm_range": "腰围须在 30–200 CM 之间，或留空。",
  "c_hipCm_range": "臀围须在 40–200 CM 之间，或留空。",
  "c_shoeSizeEu_range": "熟人鞋码须在 25–55 欧码之间，或留空。"
};

export const BEAUTY_HINT = "1–100 整数；仅影响好感未达70时的有效正面互动，不会逐轮自动加减。";

export const PROWESS_HINT = "1–100 整数；只在她亲身体会过的亲密互动里修正堕落度，不影响日常好感。";

export const DRAFT_WARN_TEXT = "检测到已保存的草稿中有项数据超出范围，请先修正后再继续。";

export const DRAFT_WARN_BTN = "去修改";

export const BODY_EMPTY_TEXT = "留空（开场由模型自动补全）";

export const BODY_MISSING_TPL = "（{missingLabels}留空，开场由模型自动补全）";
