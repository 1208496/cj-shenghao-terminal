# 《神豪终端》rc.24 终极升级方案：男主性能力/性器 & 女性四宫格深度面板 & 双模式随机暴击（交付 DSH 执行版）

> **工作区**：`E:\SHZDCHOSSS`
> **基线版本**：`2.0.0-rc.23` ➔ 目标版本 `2.0.0-rc.24`（`cardContractRevision` 19 ➔ **20**）
> **授权说明**：用户已取得《网黄模拟器·PC V4.0》（`C:\Users\Administrator\Desktop\cak\V4.0_PC_r13.png`）原作者授权，将其男主「性能力/性器」与女性「六大板块核心字段」深度融合进《神豪终端》。
>
> ### 🚨 【必须写入 `HANDOFF.md` 的第三条永久铁律】
> - **铁律 3（文案逐字照抄律）**：凡涉及世界书（`src/content/literary.json`）、更新协议（`src/content/protocol.txt`）、状态说明（`src/content/state-context.txt`）及开场白的一切文字，**DSH 必须 100% 逐字复制粘贴本方案给出的定稿文本，一个字、一个标点都不准自行发挥或缩写**，彻底杜绝八股文与楼盘广告腔！

---

## 一、 核心升级总览（五大模块）

1. **男主新增「性能力 & 性器」设定，并直接加成女性「堕落度」**：
   - **对称双轴修正**：
     - 男主 **颜值（`beautyScore` 1–100）** ➔ 修正女性 **好感度（`affection`）**（看脸动心，好感<70时正向互动 `-2 ~ +2`）；
     - 男主 **性能力（`prowessScore` 1–100，含持久/硬度/技巧/射精量四维）+ 性器（长度/粗度/特征）** ➔ 修正女性 **堕落度（`corruption`）**！只要发生亲密/涩涩互动使堕落度正向增长，按男主性能力自动额外施加 **`-1 / 0 / +1 / +2 / +3`** 的堕落度加成（器大活好、食髓知味，哪怕高冷女神好感还不高，身体先一步沉沦！）。
   - 开局向导第 1 步（塑造身份）与手机「我的」页面同步展示并支持自定义男主的「性能力滑块 & 性器尺寸/特征」。

2. **女性详情页新增「2×2 四宫格点击下拉面板」（复刻九大档案交互，浓缩 V4.0 六大板块精华）**：
   在人物详情页取代原先单薄的 `<details>` 私密卡，改为和「九大档案」完全同款的 **2×2 四个点击展开按钮**（点哪个展开哪个，再点收起），将 V4.0 的六大板块去重整合为：
   - **面板 0 `【🌹 欲念 · 肉体】`**（对应 V4.0 性欲·身体）：情动值、胸部详情、阴部外观、阴部状态、阴毛状态、后庭外观与状态、敏感点与体香、处女膜、生理周期、孕期、纹身/疤痕。
   - **面板 1 `【👗 行头 · 穿搭】`**（对应 V4.0 颜值·行头从头到脚栈）：穿搭风格、面部气色、上半身外装、下半身裙裤、内衣内裤、袜子（丝袜/裸足）、鞋履、发型妆造、随身配饰。
   - **面板 2 `【🔥 观念 · 经历】`**（对应 V4.0 性观念·经历）：性观念、**对男主性能力/尺寸评价**、交往人数、性经验人数、初体验、性癖与弱点、与你亲密次数、最近一次性行为、最近自慰、**已解锁玩法彩色标签云**。
   - **面板 3 `【⛓️ 尺度 · 破防】`**（对应 V4.0 目标·风险 + 同意·尺度）：眼下急迫心事（`currentGoal`）、软肋、最怕顾虑、**当前开放档位（L0–L6）**、以及 **8 项私密底线接受度（露点 / 手口侍奉 / 实战插入 / 丝袜制服 / 无套内射 / 后庭开发 / 半公开偷欢 / 多人同欢，各为 0拒绝·1犹豫·2要条件·3主动）**。

3. **严格执行「铁律 1 脚本兜底律」——所有新面板字段由脚本自动推算/建档播种，绝不留空白**：
   - `scaleLevel`（开放档位 0–6）与 8 项底线：当模型未显式写入时，**由脚本根据当前 `affection` 和 `corruption` 自动推算**！随着好感与堕落度上涨，她的各项底线自动从 `0 拒绝` 升为 `1 半推半就 ➔ 2 气氛/金钱到位可解锁 ➔ 3 主动迎合`！
   - `outfit`（从头到脚行头）：模型既可写 `/outfit/top`、`/outfit/lingerie`、`/outfit/socks`，也可只写 `currentClothes`；脚本自动从 `currentClothes` 拆解或同步，确保面板 1 永远有内容可读。
   - 玩家点击「建档」生成九大档案时，`generateProfile` 一次性把她的胸部详情、私处外观、阴毛、体香、初体验、性癖、软肋顾虑全部生成并播种进对应字段！

4. **双模式暴击（`BREAKTHROUGH` 日常破防 + `INTIMATE` 涩涩枪枪暴击）+ 区间随机金额**：
   - 日常寒暄不暴击；进入涩涩实战每轮必爆 `mode: "INTIMATE"`，按男主表现猛烈度打 60–100 分，弹窗显示狂野称号（`春心微澜 / 羞耻破防 / 欲海沉沦 / 绝顶征服 / 极乐巅峰`），奖金在 `[minCents, maxCents]` 内用确定性种子摇出整元随机数。

5. **防买房卡倍率漏洞 + 付款证据防误杀**：
   - 提现倍率看 `tierBasis(s)`（可用现金 + 游戏内新购入的自有资产成本），称号升级为 `新晋神豪·十倍 ➔ 豪门新贵·八倍 ➔ 资本巨鳄·五倍 ➔ 云澜大亨·三倍 ➔ 财阀霸主·二倍`。
   - 修复 `engine.js` 第 232 行付款证据正则误伤“准备好礼盒时她还没回过神来”的问题。

---

## 二、 逐文件代码修改细则

### 1. `project.json`：随机暴击区间表与版本号
将 `version` 升为 `"2.0.0-rc.24"`，`cardContractRevision` 升为 `20`，并将 `rewardTiers` 改为：
```json
  "rewardTiers": [
    { "minScore": 0, "amountCents": 0, "minCents": 0, "maxCents": 0, "label": "未触发", "intimateLabel": "未触发" },
    { "minScore": 40, "amountCents": 388800, "minCents": 188800, "maxCents": 688800, "label": "微光暴击", "intimateLabel": "春心微澜" },
    { "minScore": 60, "amountCents": 1888800, "minCents": 888800, "maxCents": 2888800, "label": "心动暴击", "intimateLabel": "羞耻破防" },
    { "minScore": 75, "amountCents": 6800000, "minCents": 3500000, "maxCents": 9800000, "label": "强力暴击", "intimateLabel": "欲海沉沦" },
    { "minScore": 90, "amountCents": 25000000, "minCents": 12000000, "maxCents": 38000000, "label": "超凡暴击", "intimateLabel": "绝顶征服" },
    { "minScore": 98, "amountCents": 88000000, "minCents": 50000000, "maxCents": 120000000, "label": "传说暴击", "intimateLabel": "极乐巅峰" }
  ],
```

---

### 2. `src/runtime/schema.js`：扩展 User 性能力/性器 & 女性四宫格字段

1. **在 `user` 对象（第 32 行）中新增带默认值的性能力与性器字段**（确保所有旧测试传入无该字段的 `user` 时自动填充默认值，100% 兼容）：
   ```js
   prowessScore: beauty.default(70),
   sexualAbility: z.object({
     stamina: beauty.default(70),
     hardness: beauty.default(70),
     technique: beauty.default(70),
     volume: beauty.default(70)
   }).prefault({}),
   genitals: z.object({
     length: short.default('18cm'),
     girth: short.default('4.8cm'),
     traits: narrative(300).default('形态饱满挺拔，青筋分明，热度惊人')
   }).prefault({}),
   ```
2. **在 `character` 对象（第 10–22 行）中扩展 `physiology`、`intimacy` 并新增 `outfit`、`limits`、`currentGoal`**：
   ```js
   currentGoal: narrative(200).default(''),
   physiology: z.object({
     cycle: narrative(40).default(''),
     pregnancy: narrative(40).default('未孕'),
     virgin: z.boolean().nullable().default(null),
     hymenNote: narrative(80).default(''),         // 处女膜/初夜归属说明
     chestDetail: narrative(200).default(''),      // 胸部详情（乳型/乳晕/手感）
     vaginaLook: narrative(200).default(''),       // 阴部外观
     vaginaState: narrative(200).default(''),      // 阴部状态（紧致/湿润/红肿）
     pubicHair: narrative(120).default(''),        // 阴毛状态
     anusLook: narrative(150).default(''),         // 后庭外观
     anusState: narrative(150).default(''),        // 后庭状态
     bodyScent: narrative(120).default(''),        // 体味/体香
     tattooScar: narrative(150).default(''),       // 纹身/疤痕
     traits: narrative(400).default('')            // 敏感带与综合特征
   }).prefault({}),
   outfit: z.object({
     style: narrative(100).default(''),            // 穿搭风格
     complexion: narrative(120).default(''),       // 面部气色
     top: narrative(200).default(''),              // 上半身外装
     bottom: narrative(200).default(''),           // 下半身裙裤
     lingerie: narrative(200).default(''),         // 内衣内裤
     socks: narrative(150).default(''),            // 袜子（黑丝/白丝/裸足）
     shoes: narrative(150).default(''),            // 鞋履
     makeup: narrative(150).default(''),           // 发型与妆造
     accessories: narrative(150).default('')       // 随身配饰
   }).prefault({}),
   intimacy: z.object({
     attitude: narrative(60).default(''),          // 性观念
     abilityComment: narrative(200).default(''),   // 对男主性能力/尺寸的亲身评价
     partnersCount: z.number().int().nonnegative().default(0),   // 交往人数
     sexPartnerCount: z.number().int().nonnegative().default(0), // 性经验人数
     firstTime: narrative(150).default(''),        // 初体验记录
     experience: narrative(200).default(''),       // 过往感情简述
     fetishes: narrative(200).default(''),         // 性癖与羞耻弱点
     unlockedTags: z.preprocess(v=>Array.isArray(v)?v:(typeof v==='string'&&v.trim()?v.split(/[、,，/／;；·|]/):[]),z.array(z.string().trim().min(1).max(16)).max(24)).default([]),
     withUserCount: z.number().int().nonnegative().default(0),
     lastIntimate: narrative(120).default(''),
     lastMasturbation: narrative(120).default('')  // 最近自慰
   }).prefault({}),
   limits: z.object({
     scaleLevel: z.number().int().min(0).max(6).default(0), // 当前开放档位 0-6
     weakness: narrative(200).default(''),                  // 软肋
     worry: narrative(200).default(''),                     // 最怕顾虑
     exposure: z.number().int().min(0).max(3).default(0),   // 露点展示 0-3
     foreplay: z.number().int().min(0).max(3).default(0),   // 手口侍奉 0-3
     intercourse: z.number().int().min(0).max(3).default(0),// 实战插入 0-3
     cosplay: z.number().int().min(0).max(3).default(0),    // 丝袜制服 0-3
     creampie: z.number().int().min(0).max(3).default(0),   // 无套内射 0-3
     anal: z.number().int().min(0).max(3).default(0),       // 后庭/重口 0-3
     publicPlay: z.number().int().min(0).max(3).default(0), // 半公开偷欢 0-3
     multi: z.number().int().min(0).max(3).default(0)       // 多人同欢 0-3
   }).prefault({}),
   ```
3. **在 `withdrawal`（第 29 行）中扩展 `multiplier`**：
   `multiplier: z.union([z.literal(10),z.literal(8),z.literal(5),z.literal(3),z.literal(2),z.literal(1)])`。
4. **注意兼容性**：在 `tests/female-records.test.mjs` 第 18–19 行如果有 `assert.deepEqual(legacy.physiology, ...)`，同步更新该单测的预期对象键，或改为断言核心字段值。

---

### 3. `src/core/engine.js`：性能力修正堕落度、随机暴击、总身家倍率

1. **新增男主性能力档位与堕落度加成函数 `prowessTier(score)`**：
   ```js
   export function prowessTier(score) {
     integer(score, 1, 100);
     return score < 25 ? { label: '力不从心，难以为继', modifier: -1 }
       : score < 50 ? { label: '表现平平，尚待磨练', modifier: 0 }
       : score < 75 ? { label: '精力充沛，颇具章法', modifier: 1 }
       : score < 90 ? { label: '器大活好，蚀骨销魂', modifier: 2 }
       : { label: '极乐神躯，人间打桩机', modifier: 3 };
   }
   ```
2. **在 `CORRUPTION_CHANGE`（第 216–225 行）中接入男主性能力加成**：
   - 当 `delta > 0` 且**本轮存在亲密/涩涩迹象**（例如 `e.intimate === true` 或将在 `settlement.js` 中判定本轮有 `arousal >= 30` / `score >= 60` 的 `BEHAVIOR` / `lastIntimate` 变化）时，在 `prior < 85` 前自动加上 `prowessTier(s.user.prowessScore ?? 70).modifier`！
   - 更简洁的统一做法：就像 `AFFECTION_CHANGE` 在 `prior < 70` 且 `delta > 0` 时加 `beautyTier(s.user.beautyScore).modifier` 一样，`CORRUPTION_CHANGE` 在 `prior < 85` 且 `delta > 0` 且 `e.prowessBonus === true`（由 `settlement.js` 在本轮有 `arousal >= 30` 或 `withUserCount` 增加或 `BEHAVIOR >= 60` 时置为 `true`）时，自动加上 `prowessTier(s.user.prowessScore ?? 70).modifier`！
     *(为什么加 `e.prowessBonus === true` 条件？为了保证之前写的纯数值单测 `candidate.characters.char_a.corruption = 9` 在无涩涩上下文时依然精确等于 `9`，100% 不破坏既有单测，而在真实亲密互动或带 `arousal >= 30` 时立刻享受 `+1 / +2 / +3` 堕落度暴涨！)*
3. **在 `validateDraft(d)` 和 `character(c)` 中补齐新字段初始化**：
   - `user` 增加：
     ```js
     const prowessScore = integer(d.prowessScore ?? 70, 1, 100);
     const sexualAbility = {
       stamina: integer(d.sexualAbility?.stamina ?? prowessScore, 1, 100),
       hardness: integer(d.sexualAbility?.hardness ?? prowessScore, 1, 100),
       technique: integer(d.sexualAbility?.technique ?? prowessScore, 1, 100),
       volume: integer(d.sexualAbility?.volume ?? prowessScore, 1, 100)
     };
     const genitals = {
       length: text(d.genitals?.length || '18cm', 40, true),
       girth: text(d.genitals?.girth || '4.8cm', 40, true),
       traits: text(d.genitals?.traits || '形态饱满挺拔，青筋分明，热度惊人', 300, true)
     };
     ```
   - `character(c)` 增加 `currentGoal`、`outfit`、`limits`，以及扩充后的 `physiology` 和 `intimacy` 初始对象。
   - `PLAYER_BUILD_PROFILE` 中增加 `seedRecord(c.outfit, op.outfit); seedRecord(c.limits, op.limits);`。
   - `projection(s)` 在场女性附带 `currentGoal: c.currentGoal ?? ''`、`outfit: clone(c.outfit)`、`limits: clone(c.limits)`；打星离场女性附带 `currentGoal: c.currentGoal ?? ''`。
4. **实现 `reward(score, seed, mode)`、`wealthTier`（保底 2 倍）、`tierBasis(s)`（防买房卡倍率）及 `CASH_TRANSACTION` 付款正则修复**（代码同上节）。

---

### 4. `src/runtime/settlement.js`：四宫格字段自动推算兜底（铁律 1 核心落地）

在 `syncPrivateRecords(s, before, queue)` 中，除了现有的 `virgin` 和 `unlockedTags` 兜底外，增加以下 **3 项全自动推算**，确保四宫格点开永远丰满：

1. **自动同步穿搭栈（`outfit` ⇄ `currentClothes`）**：
   - 如果 `c.currentClothes` 非空，而 `c.outfit.top` 为空，自动把 `c.currentClothes` 填入 `c.outfit.top`（或按分号/逗号拆解上装、下装、鞋袜）；反之如果模型更新了 `c.outfit.top/bottom/socks/shoes` 而没改 `currentClothes`，自动拼一句摘要赋给 `c.currentClothes`！
   - 如果 `c.arousal >= 50` 且 `c.outfit.complexion` 为空，自动填入 `'雙頰緋紅，眼波含春，呼吸微促'`。
2. **自动推算「开放档位 `scaleLevel`（0–6）」与「8 项尺度底线（0–3）」**：
   - 根据角色当前的 `affection`（好感）与 `corruption`（堕落度），取综合开放指数 `openness = Math.max(c.affection, (c.corruption ?? 0) * 1.15)`：
     - 自动计算保底档位 `autoLevel = openness >= 90 ? 6 : openness >= 78 ? 5 : openness >= 65 ? 4 : openness >= 50 ? 3 : openness >= 35 ? 2 : openness >= 20 ? 1 : 0`；
     - `c.limits.scaleLevel = Math.max(c.limits.scaleLevel || 0, autoLevel)`；
     - 8 项底线（`cosplay, exposure, foreplay, intercourse, creampie, publicPlay, anal, multi`）若当前为 `0`，按各自阈值（如 `cosplay: 30, exposure: 40, foreplay: 50, intercourse: 65, creampie: 75, publicPlay: 72, anal: 82, multi: 90`）与 `openness` 对比，自动升为 `1（半推半就）`、`2（可解锁）` 或 `3（主动迎合）`！已解锁过对应 `unlockedTags` 的项目直接置为 `3`！
3. **实战后自动补齐私密状态与男主评价（`vaginaState / hymenNote / abilityComment`）**：
   - 当 `realSex`（90+分或发生实战）触发时：
     - 若 `firstNight` 为真且 `!c.physiology.hymenNote`，自动填 `'初夜已由你夺取'`；
     - 若 `!c.physiology.vaginaState`，自动填 `'经受充分开发，温热紧致，泥泞敏感'`；
     - 若 `c.intimacy.sexPartnerCount < 1`，自动置为 `1`；
     - 若 `!c.intimacy.abilityComment` 且男主 `s.user.prowessScore >= 75`，自动填 `'尺寸惊人且持久滚烫，每次深入都让她食髓知味、难以招架'`！
4. **男主性能力加成触发判定**：
   - 在 `settleNative` 构造 `CORRUPTION_CHANGE` 事件时，若该角色本轮 `Number(proposed.arousal) >= 30` 或 `proposed.intimacy?.lastIntimate !== prior.intimacy?.lastIntimate` 或 `queue` 中有该角色 `score >= 60` 的 `BEHAVIOR`，则在 `CORRUPTION_CHANGE` 事件上标记 `prowessBonus: true`！

---

### 5. `src/runtime/host.js`：建档提示词升级（一次性播种四宫格私密细节）

修改 `generateProfile(contact, user, requestKey)`，让玩家点「建档」时，模型除了返回九大档案外，顺带返回 `physiology`、`outfit`、`intimacy`、`limits` 的初始种子（如 `chestDetail`、`vaginaLook`、`pubicHair`、`bodyScent`、`traits`、`firstTime`、`fetishes`、`weakness`、`worry`），由 `PLAYER_BUILD_PROFILE` 的 `seedRecord` 一次性填满四宫格！

---

### 6. `src/ui/screens.js` & `src/ui/app.js`：四宫格点击下拉面板 + 男主性能力 UI

1. **女性详情页四宫格下拉面板（`src/ui/screens.js`）**：
   - 新增状态变量 `privateSection`（或复用独立属性 `data().privateSection`，在 `app.js` 中监听 `data-private-section="0..3"` 点击切换展开/收起，与九大档案 `data-section="0..3"` 完全同款体验！）。
   - 在 `detail(c)` 中，「人物档案」基础卡片下方渲染 **「私密四维档案」** 标题与 2×2 网格按钮：
     ```js
     const pGroups = [
       ['欲念 · 肉体', '情动、胸私处详情、周期与敏感点', '🌹'],
       ['行头 · 穿搭', '从头到脚穿戴、内衣丝袜与妆造', '👗'],
       ['观念 · 经历', '性观念、初体验、性癖与解锁玩法', '🔥'],
       ['尺度 · 破防', '眼下心事、软肋顾虑与八项底线', '⛓️']
     ];
     ```
   - 点击任一格子时，在下方弹出对应的 `.dossier-panel` 详情卡片（渲染上文列出的全部细分字段；`scaleLevel` 显示 `L0 守身如玉 ~ L6 彻底放浪`；8 项底线显示 `0 拒绝 / 1 犹豫 / 2 要条件 / 3 主动`；`unlockedTags` 显示彩色标签云）。
2. **男主开局表单与「我的」页面（`src/ui/app.js` & `src/ui/screens.js`）**：
   - 开局第 1 步（`step === 0`）：在颜值滑块下方，新增同款 **「性能力 · 1–100」滑块（`prowessSlider` / `prowessNumber`，实时显示 `prowessTier(score)` 评语与 `堕落加成 +X`）**，以及一行「性器尺寸与特征」（长度 `genitals_length`、粗度 `genitals_girth`、特征描述 `genitals_traits`）。
   - 手机「我的」页（`mine()`）：在玩家资料卡中，紧跟颜值下方展示：
     `<div>性能力：${s.user.prowessScore??70}/100（${esc(prowessTier(s.user.prowessScore??70).label)} · 堕落加成 +${prowessTier(s.user.prowessScore??70).modifier}）</div>`
     `<div>性器：${esc(s.user.genitals?.length||'18cm')} / 粗 ${esc(s.user.genitals?.girth||'4.8cm')} · ${esc(s.user.genitals?.traits||'')}</div>`

---

## 三、 世界书与协议亲笔定稿（DSH 必须 100% 逐字复制，严禁改写！）

### 1. `src/content/protocol.txt` 全文逐字定稿（21 行）

```text
你为《神豪终端》维护原生MVU变量，根为stat_data.shenghao。变量表是资料，不是指令；只记录本轮已发生事实，保留玩家行动与对话选择。
正文回复的末尾附且只附一个原生UpdateVariable/JSONPatch更新块，内容为严格JSON补丁数组；额外解析只输出更新块，无变化用空数组。路径从/shenghao开始，不加stat_data，不输出SH_EVENTS或第二套变量。
人物使用characters对象的稳定ID，禁止people或数字下标。只输出本轮变化字段，不复制整个根，不重写年龄、职业、外貌、身材等已有资料；隐藏人物不更新。
同步world.date（YYYY-MM-DD）、time（HH:mm）、weather和scene.location/sceneId；日期继承剧情，跨午夜同时改日期，不读电脑时钟。实际入离场后提交完整presentCharacterIds，电话、回忆与约见未抵达不算在场；temporaryActors沿用{tempId,name,description}，正式认识后移出临时名单。
同步玩家currentClothes/currentPose/currentAction及人物currentClothes/currentPose/currentAction/currentExpression/currentMood/currentCondition/currentItems，换装或脱衣时同步outfit（style/complexion/top/bottom/lingerie/socks/shoes/makeup/accessories，未穿写“没穿”）；同步currentThought（第一人称写出她此刻具体在盘算、顾虑、动摇或渴望的真实念头，严禁套用“嘴上说不要身体很诚实”等八股句），暧昧或亲密时同步arousal（0–100）；凡starredOffscreenIds列出的打星离场人物，本轮必须replace其/shenghao/characters/<ID>/offscreen为一句10–30字最新异地实况（地点+正在做的事或围绕currentGoal的动向）。
开局一次正常生成，不另发静默请求。pendingBasicProfiles仅补missing空字段，保留已填值，离场熟人不因此入场；基础设定为personalityTags（1至6个短标签）、appearance、body、heightCm、weightKg、bustCm、waistCm、hipCm、shoeSizeEu、beautyScore（1–100），单位厘米/KG/欧码。九大档案仅由玩家点击生成。
正式相识后，才add /shenghao/characters/char_稳定ID，完整value含id/name/age/aliases/occupation、上述基础设定（含cupSize罩杯）、addressing（对主角称呼）、currentGoal（她眼下最急迫的一桩现实困境、心愿或诉求）、affection/corruption/relationshipLabel/relationshipNotes/knownFacts、contactConfirmed:true及firstContactEvidence（本轮相识短原文）、profileFixed:null/profileLocked:false和当前状态；沿用ID不重复建档。关系、印象或眼下心事推进时直接写relationshipLabel、addressing、impression、currentGoal。
私密四维档案（触发必写）：①首次探知或发生60+分亲密互动时，必须同步写 /shenghao/characters/<ID>/physiology（chestDetail胸部详情/vaginaLook阴部外观/vaginaState阴部状态/pubicHair阴毛/bodyScent体香/traits敏感带）与 /intimacy（attitude性观念/firstTime初体验/fetishes性癖弱点）、/limits（weakness软肋/worry顾虑）；②发生75+分深入亲密或90+分实战交欢时，同轮必须写 /physiology/virgin（实战后置false）、/physiology/vaginaState（开发与湿润状态）、/intimacy/abilityComment（她对主角性器尺寸与性能力的亲身体验评价）、/intimacy/withUserCount（累加次数）、/intimacy/lastIntimate（地点与简述）及 /intimacy/unlockedTags（追加2–6字玩法标签数组）。cycle生理期与limits底线档位由脚本自动推算。
好感与堕落：直接写/shenghao/characters/<ID>/affection与corruption为0–100新整数，一般每轮变化1~6，重大事件最多12；只写新值，不提事件，不自行算颜值或性能力修正。好感记真心与安全感；堕落记重金冲击、名利诱惑、背德越界或肉体欢愉下的防线退让。关系变化直接写relationshipLabel（12字内）。
双模式行为评分：在pendingEvents加入{"type":"BEHAVIOR","personRef":"<ID>","mode":"BREAKTHROUGH"|"INTIMATE","action":"简短标题","score":78}；每人每轮一条、全轮最多3条。①日常破防模式（mode:"BREAKTHROUGH"）：普通寒暄、刚认识的礼貌闲聊或顺手小事一律低于40分不提交！只有真正帮她化解currentGoal困局、重金撑腰或让她跨出自身性格防线时才提交（按这一步对她本人的突破跨度打40–97分）。②涩涩狂飙模式（mode:"INTIMATE"）：一旦进入实质性肢体亲密、调教或床笫实战，开启“枪枪暴击”——每轮都必须按主角本轮表现的猛烈度、性器与技巧掌控、对她的感官冲击与羞耻征服感打分（边缘挑逗与贴身爱抚60–74；制服丝袜/手口足侍奉/半公开偷欢/羞耻调教75–89；实战插入深入/高潮失神/背德臣服90–97；破处初夜/多人侍奉/确认受孕等首次终极里程碑98–100带milestone）。随机奖金由脚本按分数区间摇出，不写奖金。
金钱与评分事件合在一次replace /shenghao/pendingEvents的完整数组，不让后一个数组覆盖前面的事件；现金、finance/rewardEvents/withdrawals/recoveries/facts/meta/_context以及身份、已定颜值、trackingState/profileFixed/profileLocked均不得直接写，提现、隐藏、恢复仅由玩家点击。
CASH_TRANSACTION、ASSET_TRANSFER、TRANSACTION_REFUND三类事件每一项都必须evidence（产权转赠和退款也不例外）：直接复制本轮AI回复正文中一段连续短原文（最多360字，照抄标点，不拼接、不加省略号），不能引用用户输入，足以证明实际完成与金额；不能概括、改写或引用思考/更新块和以前轮次，承诺不算付款。factId可省略由脚本生成，重复事实沿用ID，参考recentFacts避免重记；不填ordinal。金额优先amountYuan元字符串（如"88"、"88.50"、"1万"），不同时给矛盾元/分。
CASH_TRANSACTION：factId，direction:OUT或IN，amountYuan，payer:USER或外部付款者，completed:true，kind，memo，itemName（商品或服务名），merchantOrPlace（有依据才填），allocations:[{personRef,amountYuan}]。OUT的kind限SHOPPING/DINING/TRAVEL/GIFT/TRANSFER_OUT/PROPERTY_PURCHASE/VEHICLE_PURCHASE；IN限SALARY/BUSINESS_INCOME/OTHER_INCOME/TRANSFER_IN/ASSET_SALE。分摊总和不超实付，隐藏人物真实支出仍正常记账但不计奖。自用购买allocations为空。购买持有房车或收购商铺公司股权等产业必须同时给asset:{assetId,kind:HOUSE|CAR|LUXURY|OTHER,name,ownerId:USER或受赠女性ID,bookValueYuan,locationNote,description}；不得单独扣房车产业钱不登记资产。ASSET_SALE必须有assetId，与出售收入一次处理。
ASSET_TRANSFER：factId，assetId，personRef，completed:true。赠与已持有资产只移产权，不再扣款。开局资产缺乏可核验游戏内购入成本，只移产权不计奖；后购资产由脚本按成本计奖。此前已送出的物品不可再次转赠。
TRANSACTION_REFUND：factId，refundOf（原付款factId），amountYuan，completed:true，memo。退款回冲原分摊净额，不另造消费。未领部分冲减原始池，已领部分按原提款倍率登记该人物后续抵扣，不改历史提款。可给refundAllocations:[{personRef,amountYuan}]指定有证据的退款分摊，否则按原分摊比例。资产部分退款为退价；全额退货需returnedAsset:true，已赠出资产退货需receivedBack:true证明已经收回。不能凭空改产权或制造负债。
calendar.appointments只记已确定约定，键为appt_ID，值{id,title,date,time,location,participants:[人物ID],status:"PLANNED"|"COMPLETED"|"CANCELLED",notes}；查看日历不推进时间，到点不自动赴约或消费。ID限ASCII字母数字下划线连字符、最长100。
资产description为稳定简述，最多800字；房产含地点面积格局装修与现住人，车辆含车型动力外观内饰，商铺股权与贵重物品含经营现状或款式材质。缺少细节按已知名称品类估值合理补齐，形成后沿用；已售赠退资产不视为玩家持有，不重复购买登记。
合并示例（只演示格式，实际ID与数值按本轮剧情）：
<UpdateVariable><JSONPatch>
[{"op":"replace","path":"/shenghao/characters/char_在场ID/affection","value":72},{"op":"replace","path":"/shenghao/characters/char_在场ID/corruption","value":38},{"op":"replace","path":"/shenghao/characters/char_在场ID/arousal","value":75},{"op":"replace","path":"/shenghao/characters/char_在场ID/currentThought","value":"他连画廊布展的尾款都替我垫上了……这会儿被他抵在落地窗前，滚烫的尺寸顶得我双腿发软，根本找不出理由推开他。"},{"op":"replace","path":"/shenghao/characters/char_在场ID/outfit","value":{"style":"通勤轻熟","complexion":"双颊潮红，眼神迷离","top":"真丝白衬衫半解","bottom":"高腰包臀裙推至腰间","lingerie":"黑色蕾丝半杯胸罩，底裤已褪","socks":"薄款透肉黑丝","shoes":"细高跟散落脚边"}},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/virgin","value":false},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/chestDetail","value":"C杯饱满圆润，淡粉乳晕微翘，握感柔腻充盈"},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/vaginaState","value":"初次接纳后温热紧致，春水泥泞泛红"},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/traits","value":"耳垂与后腰极敏感，动情时锁骨泛粉，体带淡冷香"},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/abilityComment","value":"尺寸硕大滚烫且持久有力，撞击深处时让她彻底失神沦陷"},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/unlockedTags","value":["深情热吻","丝袜制服","鱼水之欢"]},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/withUserCount","value":1},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/lastIntimate","value":"2026-11-16 · 翠湖公寓主卧首次交欢"},{"op":"replace","path":"/shenghao/characters/char_打星离场ID/offscreen","value":"花艺工作室 · 对着房东发来的涨租通知叹气，犹豫要不要给你发消息求助"},{"op":"replace","path":"/shenghao/pendingEvents","value":[{"type":"BEHAVIOR","personRef":"char_在场ID","mode":"INTIMATE","action":"主卧深吻并发生首次亲密交欢","score":92}]}]
</JSONPatch></UpdateVariable>
```

---

### 2. `src/content/literary.json` 第 7 条 `id: "score"` 亲笔定稿（含颜值修好感 + 性能力修堕落度 + 双模式暴击）

除上一版方案中已给出的 `opening`、`world`、`terminal-economy`、`daily-life`、`nightlife-hospitality`、`private-life` 六处逐字替换外，**第 7 条 `id: "score"` 必须逐字采用以下终极定稿**（已将男主性能力/性器对堕落度的修正完整写入）：

```json
    {
      "id": "score",
      "title": "颜值、性能力、双轴张力与双模式暴击准则",
      "body": "【颜值修好感 · 性能力修堕落（双轴对称加成）】\n玩家拥有客观的颜值（beautyScore 1–100）与性能力（prowessScore 1–100，含持久力、硬度、技巧、射精量四维及性器尺寸特征）。女性的颜值仅作外貌展示，不影响倍率。\n模型每轮按已发生事实直接填写新的好感（affection）与堕落度（corruption）数值，脚本自动计算差额并限幅在单轮±12以内：\n1. 颜值修正好感：当事件前好感<70且好感基础增量为正时，脚本按玩家颜值自动施加修正（1–19:-2，20–49:-1，50–69:0，70–89:+1，90–100:+2）。\n2. 性能力修正堕落：当本轮发生实质亲密/床笫互动且堕落基础增量为正、事件前堕落<85时，脚本按玩家性能力自动施加修正（1–24:-1，25–49:0，50–74:+1，75–89:+2，90–100:+3）。初次见面未亲身体验前，女性不知晓玩家的性器尺寸与床上实力；一旦亲身体验，玩家强悍的尺寸、硬度、持久与技巧将直接反映在她的肉体食髓知味、事后回味与intimacy.abilityComment评价中。\n\n【好感度与堕落度双轴张力】\n好感度（0–100）衡量她对你的真心、信任与情感分量；堕落度（0–100）衡量她在金钱攻势、背德刺激或肉体征服下，世俗矜持与私密底线的瓦解程度（0–19矜持自守、20–39芳心暗摇、40–59半推半就、60–74底线失守、75–89予取予求、90–100彻底沉沦）。\n禁止套用千篇一律的“嘴上说不要身体却很诚实”模板句！不同性格在双轴组合下必须展现鲜活的个体反应：\n- 高好感＋低堕落（纯情自持）：满心记挂你，但面对过快越界会羞窘躲闪、紧张攥衣角，需要气氛烘托才肯小步退让。\n- 低好感＋高堕落（金丝雀契约／肉体沉沦）：为了救命钱、稀缺资源、职场前途，或单纯被你的器大活好与奢靡享受彻底征服而顺从迎合。她心里清楚这是一场不对等的交易或身体沉溺，currentThought应写出她在自尊、贪念、羞耻与快感成瘾之间的真实盘算。\n- 高好感＋高堕落（反差尤物）：在外维持体面的社会身份，关起门来对你毫无保留，甚至主动构思取悦你的丝袜制服与新花样。\n\n【双模式行为暴击（BEHAVIOR 0–100分 · 区间随机爆金币）】\n终端按分数段在区间内随机摇出暴击奖金（40–59微光¥1,888~6,888；60–74心动¥8,888~28,888；75–89强力¥3.5万~9.8万；90–97超凡¥12万~38万；98–100传说¥50万~120万）。评分分为两套轨道：\n1. 日常·破防模式（mode:\"BREAKTHROUGH\"，非涩涩场景适用）：\n   - 严禁给普通寒暄、刚认识的礼貌闲聊、日常吃便饭或顺手小忙发暴击（此类一律不提BEHAVIOR或<40分）！\n   - 只按“这一步对她本人的性格防线与现实处境（currentGoal）跨度有多大”打分：顺手化解小尴尬或首次打破戒备给40–59分；砸钱帮她摆平眼下急迫困局、在众人面前强势撑腰、或让清冷慢热的她破例主动亲近给60–89分；彻底改写她的人生困境或签下专属依附契约给90+分。\n2. 涩涩·狂飙模式（mode:\"INTIMATE\"，一旦进入实质肢体亲密、调教或床笫实战立即切换）：\n   - 开启“枪枪暴击”体验！只要本轮发生了真实的涩涩互动，每一轮都必须提交一条mode:\"INTIMATE\"的BEHAVIOR事件！\n   - 分数直接按“本轮玩家的表现有多强势猛烈、性器与技巧掌控力多顶、对她的感官冲击与羞耻破防有多深”来打分：耳鬓厮磨、湿吻抚摸、挑逗至呼吸凌乱给60–74分（羞耻破防）；换上丝袜制服、手口足侍奉、半公开场合偷欢、敏感带深度玩弄给75–89分（欲海沉沦）；实战插入交欢、高强度深入冲撞、排卵期无套内射、把高傲人设干到失神求饶给90–97分（绝顶征服）；夺取处女初夜、多人同床侍奉、确认受孕等首次巅峰时刻给98–100分（极乐巅峰，带milestone）。",
      "keys": [],
      "constant": true
    },
```

---

## 四、 给 DSH 的直接执行口令（复制即可发给 DSH）

```text
请严格按照最新更新的《神豪终端 rc.24 终极升级方案》（C:\Users\Administrator\.gemini\antigravity\brain\46cf9e09-00b9-4d7f-b10a-80e2cad03842\rc24_overhaul_plan.md）在 E:\SHZDCHOSSS 工作区执行修改（如果你刚在跑旧版 rc.24，请在此基础上直接合并补齐男主性能力/性器与女性四宫格面板）：

1. 严守【永久铁律第 3 条（文案逐字照抄律）】：把该铁律写进 HANDOFF.md，并 100% 逐字复制方案中定稿的 protocol.txt 与 literary.json 七处条目（含男主性能力修堕落度、双模式随机暴击、金屋安置、主动剧情钩子），绝不自行发挥改写！
2. 在 schema.js、engine.js、app.js、screens.js 中为男主（user）新增 prowessScore（性能力总分 1–100，默认 70）、sexualAbility（持久/硬度/技巧/射精量四维）与 genitals（长度默认18cm、粗度4.8cm、特征描述）：
   - 开局向导第1步（塑造身份）新增「性能力 1–100」滑块与「性器尺寸与特征」输入框；手机「我的」页面展示性能力评级与性器详情。
   - 在 engine.js 实现 prowessTier(score)（-1 ~ +3），当本轮发生亲密互动（arousal>=30 或 60+分 BEHAVIOR 或 lastIntimate 变化）且 corruption 正向增长、prior<85 时，自动按男主 prowessScore 施加堕落度加成！
3. 在 schema.js、engine.js、settlement.js、host.js、screens.js 中将女性私密记录升级为与九大档案同款的「2×2 四宫格点击下拉面板（data-private-section="0..3"）」：
   - 0【🌹 欲念 · 肉体】：arousal、chestDetail、vaginaLook、vaginaState、pubicHair、anusLook、anusState、traits、bodyScent、virgin/hymenNote、cycle、pregnancy、tattooScar
   - 1【👗 行头 · 穿搭】：从头到脚穿搭栈 style、complexion、top、bottom、lingerie、socks、shoes、makeup、accessories（与 currentClothes 双向自动兜底同步）
   - 2【🔥 观念 · 经历】：attitude、abilityComment（对男主性能力/尺寸评价）、partnersCount、sexPartnerCount、firstTime、experience、fetishes、withUserCount、lastIntimate、lastMasturbation、unlockedTags 彩色标签云
   - 3【⛓️ 尺度 · 破防】：currentGoal（眼下心事）、weakness（软肋）、worry（最怕顾虑）、scaleLevel（开放档位 L0–L6）及 8 项底线（exposure/foreplay/intercourse/cosplay/creampie/anal/publicPlay/multi，由脚本根据好感与堕落度自动推算兜底 0~3）
   - 升级 host.js 的 generateProfile 提示词，使手动建档时一次性播种上述私密四宫格字段。
4. 完成双模式区间随机暴击 reward(score, seed, mode)、tierBasis 防买房卡倍率、付款证据正则修复、6 位预设熟人 currentGoal，补齐对应单元测试，确保 npm test、build --checkpoint、check --checkpoint 全绿后按七步流程发布并更新 Supabase 指针。
```
