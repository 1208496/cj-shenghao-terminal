# 《神豪终端》女性角色档案结构评估

> 评估范围：仅限 `src/` 下女性角色档案（`characters.<id>`），不含玩家个人档案、经济账本与日程系统。

---

## 零、现状结构速览

### 1. 字段全貌（`src/runtime/schema.js:11-26`）

单个女性角色对象共包含 **77 个叶子字段**（不含 9 大深度档案内部 9 键），分为 6 层：

| 层级 | 字段明细 | 数量 |
|---|---|---:|
| 身份与元信息 | `id`、`name`、`age`、`beautyScore`、`aliases`、`occupation`、`trackingState`、`starred`、`avatarRef`、`portraitRef`、`contactConfirmed`、`firstContactEvidence`、`lastSexSceneRevision` | 13 |
| 关系与基础外观 | `affection`、`corruption`、`arousal`、`relationshipLabel`、`relationshipNotes`、`relationshipEvidence`、`personalityTags`、`appearance`、`body`、`heightCm`、`weightKg`、`bustCm`、`waistCm`、`hipCm`、`shoeSizeEu`、`cupSize`、`addressing`、`impression`、`knownFacts`、`knownFactsEvidence` | 20 |
| 现场实时状态与三层心绪 | `currentClothes`、`currentPose`、`currentAction`、`currentExpression`、`currentMood`、`currentCondition`、`currentItems`、`currentThought`、`offscreen`、`recentGoal`、`longTermDream`、`hiddenScar` | 12 |
| 私密四维 · `physiology` | `cycle`、`pregnancy`、`virgin`、`hymenNote`、`chestDetail`、`vaginaLook`、`vaginaState`、`pubicHair`、`anusLook`、`anusState`、`bodyScent`、`tattooScar`、`traits` | 13 |
| 私密四维 · `outfit` | `style`、`complexion`、`top`、`bottom`、`lingerie`、`socks`、`shoes`、`makeup`、`accessories` | 9 |
| 私密四维 · `intimacy` | `attitude`、`abilityComment`、`partnersCount`、`sexPartnerCount`、`firstTime`、`experience`、`fetishes`、`unlockedTags`、`withUserCount`、`lastIntimate`、`lastMasturbation` | 11 |
| 私密四维 · `limits` | `scaleLevel`、`weakness`、`worry`、`exposure`、`foreplay`、`intercourse`、`cosplay`、`creampie`、`anal`、`publicPlay`、`multi` | 11 |
| 按需深度档案 | `profileFixed`（9 项：`identity`/`appearance`/`body`/`personality`/`habits`/`style`/`family`/`career`/`social`）、`profileLocked` | 2（含 9 子键） |

### 2. 播种与运行期维护链路

1. **开局/初见来源**：预设（`src/ui/setup-presets.json`）、一句话 AI 扩写（`src/runtime/host.js:174-205` `expandContact`）或剧情中模型 `add /shenghao/characters/<id>`。
2. **脚本确定性兜底播种**：`src/core/engine.js:591-870`（`seedAnatomy` 串联 `seedInnerLife` 与 `seedOutfit`）按 `id/name` 的 64 位 FNV-1a 哈希 + `archetypeOf` 五大性格原型（`cool/proud/sunny/warm/pure`），自动填满空缺的 `recentGoal/longTermDream/hiddenScar`、肉体静态项（含 `anusLook/anusState`）、穿搭 9 项与 `limits.weakness/worry`；已有非空值优先保留。
3. **每轮结算兜底**：`src/runtime/settlement.js:171-298` 自动执行 `arousalGuard`（情欲五段回落）、`syncPrivateRecords`（实战后自动翻 `virgin`/`withUserCount`/`unlockedTags`/`vaginaState`）、`syncOutfit`（`currentClothes` ⇄ `outfit` 互拷、高情欲覆写 `complexion`）、`syncLimits`（由 `max(affection, corruption*1.15)` 与标签自动推算 8 项底线）及 `applyCycles`（按故事日期推算 28 天生理期）。
4. **按需九大建档**：玩家手动点击后由 `host.js:158-173`（`generateProfile`）生成 `profileFixed` 9 段履历，并可补空私密种子。

### 3. 手机界面排布（`src/ui/screens.js`）

- **「此刻」场景页（在场折叠卡，lines 82, 92）**：顶行三轴数值 → 展开后为「心声 + 三轴进度条 + 2×2 四方块」：`此刻 · 动向`（神情/心情/姿态/动作/身体状态/随身物品/近期目标）、`行头 · 穿戴`（`outfitPanel`）、`身姿 · 基础`（`basicRows`）、`欲念 · 私密`（精简版肉体 + 开放档位 + 已解锁玩法标签）。打星离场人物折叠在底部，仅显 `offscreen`。
- **「人物详情」页（lines 81, 98-105）**：立绘封面 + 头部三轴/心声/近期目标与长期梦想 + 奖池提现区 + **2×2 四方块**（`身姿 · 基础`、`欲念 · 肉体`、`行头 · 穿搭`、`经历 · 尺度`）+ 九大档案折叠区 + 消费/提现/暴击记录。

### 4. 模型每轮输入 vs 仅玩家可见边界（`src/core/engine.js:1467-1472`）

- **在场女性**：`projection(s)` 全量喂给模型——含基础资料、三轴、7 项 `current*`、`currentThought`、`recentGoal`、`longTermDream`、`hiddenScar`、完整私密四维（`physiology`/`outfit`/`intimacy`/`limits`）；`profileFixed` 仅在已建档且 `!profileLocked` 时附带。
- **打星离场女性**：仅喂极简索引 + `relationshipLabel`、`affection`、`corruption`、`recentGoal`、`hiddenScar`、`starred:true`、`offscreen`。
- **未打星离场 / 已隐藏女性**：仅喂 `{id, name, aliases, trackingState}` 极简索引。
- **只喂模型、刻意不给玩家看**：`hiddenScar`（暗伤伏笔，界面完全隐藏以维护知识边界）、`relationshipNotes`、`knownFacts`（均进在场 `_context`，但 `screens.js` 未渲染）。
- **只给玩家看 / 仅系统留存、不喂模型**：`avatarRef`、`portraitRef`、`contactConfirmed`、`firstContactEvidence`、`relationshipEvidence`、`knownFactsEvidence`、`lastSexSceneRevision`，以及锁定后的 `profileFixed`。

---

## 一、哪些字段是多余的（建议删除 5 项）

### 1. `currentClothes`（与 `outfit.*` 完全重复的双轨穿搭）
- **在哪**：`src/runtime/schema.js:16`、`src/core/engine.js:538-540,1470`、`src/runtime/settlement.js:254-263`、`src/content/protocol.txt:5`、`src/ui/screens.js:52,55`。
- **为什么删**：`outfit` 已经拥有完整的 9 项结构化穿搭，而 `currentClothes` 只是把 `outfit.{top,bottom,socks,shoes}` 拼接成的一条扁平字符串。它带来了四重纯消耗：① `protocol.txt` 要求模型换装时双边维护；② `settlement.js` 不得不写 `syncOutfit` 互相兜底；③ 每轮在场 `_context` 把同一套衣服喂给模型两遍；④ 手机端 `outfitPanel` 第一行「此刻穿着」紧挨着下面的「上装/下装/袜子/鞋履」，视觉上直接复读。
- **替代做法**：直接删除该字段。凡需要一句话穿搭摘要的地方，由前端或脚本从 `outfit.top` / `outfit.bottom` 即时拼接展示即可。

### 2. `physiology.anusLook` 与 `physiology.anusState`（零协议驱动的模板肉体噪音）
- **在哪**：`src/runtime/schema.js:22`、`src/core/engine.js:673-690,1470`、`src/ui/screens.js:63`。
- **为什么删**：第一，`protocol.txt` 从未要求模型在任何节点更新这两个字段，它们几乎永远停留在开局的 4 选 1 静态模板；第二，`seedAnatomy` 不分人物性格与关系阶段，刚结识、好感 20、`limits.anal === 0` 的角色一打开档案就赫然展示「浅粉菊蕾紧缩…禁区防线严密，毫厘未开」，既破坏都市活人质感，又让每个在场女性每轮白白多吐两句废话进上下文。
- **替代做法**：直接删除。真正推进到相关玩法时，现有的 `limits.anal`、`intimacy.unlockedTags` 与 `physiology.traits` 已经完全够承接。

### 3. 一组全链路无写入入口的「幽灵空字段」：`intimacy.lastMasturbation`、`intimacy.partnersCount`、`physiology.tattooScar`、`impression`（附带两枚废证词 `relationshipEvidence` / `knownFactsEvidence`）
- **在哪**：`src/runtime/schema.js:12-14,22,24`、`src/core/engine.js:1470`、`src/ui/screens.js:31,63,79`。
- **为什么删**：逐一核对 `protocol.txt`、`seedAnatomy`、`expandContact`、`generateProfile`、`setup-presets.json` 与 `settlement.js`，这 6 个字段**没有任何一处正式写入逻辑**。运行期它们长期维持 `""` 或 `0`：界面上因判空隐藏、玩家根本见不到，但前 4 个仍每轮作为空键序列化进 `_context` 占 token、误导模型猜测字段用途。语义上也全部重叠：`impression` 与 `relationshipNotes` / `currentThought` 重叠，`tattooScar` 与 `appearance` 重叠，`partnersCount` 与 `firstTime` 重叠。
- **替代做法**：整组清除，保持 Schema 与实际读写链路 1:1 对齐。

### 4. `physiology.hymenNote` 与 `intimacy.sexPartnerCount`（与 `virgin` / `firstTime` / `withUserCount` 多重叠床）
- **在哪**：`src/runtime/schema.js:22,24`、`src/core/engine.js:691-693,921,1470`、`src/runtime/settlement.js:201-202`、`src/ui/screens.js:58,79`。
- **为什么删**：关于「是否处女与过往经验」这一件事，当前竟分散在 `virgin`、`hymenNote`、`firstTime`、`sexPartnerCount`、`experience` 五个字段里。实机中 `hymenNote` 只是把 `virgin` 布尔值翻译成一句「处女膜完好无损，未经人事」或「初夜已由你夺取」，在 `screens.js:58` 里甚至和「处女/非处女」胶囊并排挤在同一行，纯属复读；`sexPartnerCount` 也从未被协议更新，只在非处或实战后机械置 `1`，遇到过往多段恋情的角色反而制造数字吃书风险。
- **替代做法**：删去 `hymenNote` 与 `sexPartnerCount`，仅保留 `physiology.virgin`（状态锚点）+ `intimacy.firstTime`（一句具体初体验事实）+ `intimacy.withUserCount`（与主角次数）。

### 5. `currentItems`（与 `outfit.accessories` 职责重叠且归类错位）
- **在哪**：`src/runtime/schema.js:16`、`src/core/engine.js:1470`、`src/content/protocol.txt:5`、`src/ui/screens.js:48,82`。
- **为什么删**：`outfit.accessories` 在播种池与预设里已经承担了随身物件描述（如「随身真皮公文包」「随身花剪皮套」「磨砂运动水壶」「怀里抱着的专业书」），但现场状态又单开了 `currentItems`，甚至连 `screens.js:82` 的「行头 · 穿戴」卡片副标题都写着「此刻穿着、内衣丝袜与随身物品」，实际 `currentItems` 却渲染在隔壁「此刻 · 动向」里。模型每轮同时维护两处，极易漏更或重复写包和配饰。
- **替代做法**：删除 `currentItems`，统一归口到 `outfit.accessories`（UI 文案可顺手改为「配饰与随身物」），让「此刻 · 动向」纯粹聚焦于人的姿态、动作、神情与状态。

---

## 二、哪些字段是缺的（建议新增 4 项）

> 下面 4 项总字数上限仅约 250–300 字，比上面删掉的字段更省上下文，却能直接补齐「谈吐辨识度、长期情感记忆、自主生活轨迹、精准投喂互动」四个活人维度。

### 1. `sharedMemories`（与你的共同记忆 · 字符串数组，上限 8 条）
- **加在哪**：`characters.<id>.sharedMemories`（`z.array(narrative(60)).max(8).default([])`）；每轮在场时随 `projection` 喂给模型；界面放在人物详情「身姿 · 基础」或「经历 · 尺度」顶部作为「✦ 共同记忆」列表。
- **为什么加**：当前档案里只有 `affection/corruption` 两个数字和只记「最近一次上床」且不断覆盖的 `lastIntimate`。对话拉长滑出上下文窗口后，模型只看到 `affection: 78`，却完全忘了「她为什么会爱上你」，只能空洞抒情；玩家回看档案也看不到两人一路走来的非床戏高光（如暴雨夜替她保住花材、终审会帮她夺回署名、她第一次给你煮醒酒汤）。**有共同记忆的人才是活人，只有好感数值的只是立绘。**
- **加了怎么用**：
  - 协议规定仅在发生实质推进关系的节点（破防暴击、重要约会、共渡难关、初夜等）时追加 1 条带日期/场景锚点的短句（如 `11-16 · 暴雨夜替她保住冷香晚香玉，她第一次主动留你喝姜茶`），满 8 条后淘汰最早的普通条。
  - 模型在后续聊天、微醺或吵架时自然引用旧梗与旧账；玩家在手机里也能获得极强的养成留痕感。

### 2. `lifeAnchor`（常驻地与日常作息 · 单字符串，上限 100 字）
- **加在哪**：`characters.<id>.lifeAnchor`（`narrative(100).default('')`）；**在场与打星离场时都随 `projection` 喂给模型**；界面放在「身姿 · 基础」职业下方一行「常驻与作息」。
- **为什么加**：世界书强调「世界在视线之外持续运转，她有自己的上班时间与生活节奏」，但数据层没有任何字段记录她住在哪片区、在哪工作、几点忙几点闲。结果模型在写偶遇、约饭或更新打星离场的 `offscreen` 时只能临场瞎编，容易前天住老城、今天瞬移东岸，或者工作日大上午无所事事随时待命。
- **加了怎么用**：
  - 开局预设、AI 扩写与初见建档时写入（如 `栖云里街角花店自住；早7点去花市进货，午后最闲，周二闭店`），脚本按职业提供极简兜底。
  - 模型对照 `world.time` 更新 `offscreen` 异地实况时自动贴合她的作息；玩家在日历邀约或突袭探访时，会真实撞上「正在赶稿/进货/闭店」的日程节奏，撑起自主运转的活人感。

### 3. `speechStyle`（谈吐腔调与微动作 · 单字符串，上限 100 字）
- **加在哪**：`characters.<id>.speechStyle`（`narrative(100).default('')`）；在场时随 `projection` 喂给模型；界面可放在「身姿 · 基础」外貌身材下方一行「谈吐习惯」，或作为轻量锚点折叠展示。
- **为什么加**：`personalityTags` 只有「知性、严谨、温柔」这类抽象标签，未点九大建档前模型缺少行为与语言锚点，聊过十轮后不同女性的台词极易滑回统一的「AI 通用言情腔」。真正让玩家「不看名字就知道是谁在说话」的，是她的说话节奏、口头禅以及紧张/动摇/敷衍时的标志性小动作。
- **加了怎么用**：
  - 开局预设、AI 扩写与初见建档时写入具体可演的细节（如 `语速慢而克制，反驳前习惯先轻推镜框说「客观来讲」；心虚时会用指腹摩挲尾戒`），`seedAnatomy` 按五大原型兜底。
  - 模型每轮写对话和神态时直接照着锚定，无需消耗九大档案的庞大 token，就能长期稳住角色声线与微表情辨识度。

### 4. `tastes`（偏爱与雷区 · 单字符串，上限 100 字）
- **加在哪**：`characters.<id>.tastes`（`narrative(100).default('')`）；在场时随 `projection` 喂给模型；界面放在「身姿 · 基础」性格标签下方一行「偏爱与雷区」。
- **为什么加**：《神豪终端》的核心玩法之一就是请客吃饭、逛街买单、挑礼物投喂，但整套档案里居然没有一个字段记录她喜欢吃什么、喝什么、迷什么小物、最讨厌什么（除非手动建九大档案且不锁定）。结果玩家想当个「记得她不吃香菜、只喝浅烘手冲、偏爱冷调银饰、讨厌被摸头」的细心主角，手机里没处查，模型也只能靠猜，千篇一律送名牌包和红酒。
- **加了怎么用**：
  - 开局预设、AI 扩写与初见建档时按格式写入（如 `偏爱：浅烘手冲、冷调银饰、爵士黑胶；雷区：香菜、浓烈甜香、被当众灌酒`），`seedAnatomy` 按原型兜底；剧情中玩家套出新喜好或新忌口时可增量 `replace`。
  - 玩家约会送礼前翻一眼手机就能精准投喂（或故意踩她小雷区逗她），模型也能顺理成章写出「你居然记得我不喝冰的」这类极强活人细节。
