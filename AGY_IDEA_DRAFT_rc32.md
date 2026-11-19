# 未实施想法草案（rc.32 前置调研 · 02 / 03 / 04 / 05）

> 定位：供下一轮强模型出正式方案（`AGY_PLAN_rc32.md`）使用的**现状核对与方案草案**。
> 范围：覆盖 `想法池/未实施想法.md` 的 **02 / 03 / 04 / 05**（06 明确不做，跳过）。
> 约束：遵守项目三条铁律（脚本兜底律 / 示例驱动律 / 文案逐字照抄律），本轮不写世界书/协议/开场白的正式定稿文案，只标明「改哪一段 / 达到什么效果」。

---

## 02 · 情动度的语义与走向（改名「情欲值」）

### 1. 现状（代码实际路径）

1. **初始化与校验**：
   - `src/core/engine.js:583`：`character(c)` 初始化 `arousal: 0`。
   - `src/runtime/schema.js:17`：`arousal` 经 `z.preprocess` 四舍五入并钳位到 `0..100` 整数，默认 `0`。
2. **增减路径（完全依赖模型手写，无脚本兜底/衰减）**：
   - `src/runtime/settlement.js:117`（`acceptFields`）：若模型本轮未提交 `arousal`，直接沿用 `prior.arousal`，**脚本没有任何衰减、封顶或事后回落逻辑**。
   - `src/content/protocol.txt:5`：仅写了一句 `暧昧或亲密时同步arousal（0–100）`，既没定义「日常 / 勾引 / 前戏 / 正戏 / 事后」分段，也没写事后回落规则。
   - `src/content/protocol.txt:20`：末尾 `<UpdateVariable><JSONPatch>` 示例里，在 `score: 98, milestone: "first_night"`（首次交欢正戏）这一轮把 `arousal` 写成 `75`——既不像「正戏几乎满」，也没有事后回落示例。
3. **下游副作用（为什么实机感觉不对）**：
   - `src/core/engine.js:861`（`SIGNIFICANT_BEHAVIOR_SCORE`）：`const mode = e.mode === 'INTIMATE' || (c.arousal ?? 0) >= 50 ? 'INTIMATE' : (e.mode || '');`。一旦 `arousal` 停在 `>= 50` 没回落，**哪怕下一轮是日常破防（`BREAKTHROUGH`），也会被强行判定成 `INTIMATE` 模式**。
   - `src/runtime/settlement.js:77`：`Number(proposed.arousal) >= 30` 会触发 `CORRUPTION_CHANGE` 的 `prowessBonus` 判定。
   - `src/runtime/settlement.js:214-216`：非实战且模型未手写 `vaginaState` 时，`arousal >= 65` 自动写「情动难耐，透明爱液泌出…」，`arousal >= 40` 自动写「芳心微乱，秘处温热湿润…」。
   - `src/runtime/settlement.js:235`：`Number(c.arousal) >= 50 && !o.complexion` 自动补「双颊绯红，眼波含春，呼吸微促」。
   - **UI 展示**：`src/ui/screens.js:42, 43, 61` 及 `src/ui/style.css:180, 183, 186, 187` 当前文案为 `情动` / `情动度`（编译后同步进 `src/ui/phone.html`）。

### 2. 做法（可选方案与推荐）

- **方案 A（纯改提示词 + 协议示例）**：只在 `protocol.txt` 定义五段区间与事后回落示例，脚本不动。
  - *优劣*：改动最小，但违反铁律 1（大模型常忘在事后那一轮把 `arousal` 降回去，导致卡在 70–95 并持续触发 `engine.js:861`）。
- **方案 B（协议分段驱动 + `settlement.js` 事后自动回落/护栏，保留字段名 `arousal`）**：保留 JSON 字段名 `arousal`，UI 与文案全面改名「情欲值」；协议定义五段规则与示例，`settlement.js` 对实战结束轮做确定性事后回落（如 `realSex` 轮若未处于「再来一次」续战状态，自动将 `arousal` 压回低位），并解耦 `engine.js:861` 对 `arousal >= 50` 强转 `INTIMATE` 的误伤。
  - *优劣*：兼顾模型叙事弹性与脚本兜底可靠性，不破坏现有变量结构与测试。
- **方案 C（同时把底层字段名 `arousal` 改为 `desire`）**：连同 `schema.js` / `engine.js` / `settlement.js` / `protocol.txt` / 测试全量改键名。
  - *优劣*：虽然尚未向玩家发行允许改字段，但改内部键名收益为零且增加回归面，不划算。

**推荐方案 B**：
- **改哪些文件 / 函数**：
  1. `src/ui/screens.js:42, 43, 61`（及重编 `src/ui/phone.html`）：界面文案 `情动` / `情动度` 改为 `情欲` / `情欲值`。
  2. `src/runtime/settlement.js`（`syncPrivateRecords` 内，紧接 `realSex` 判定之后）：增加确定性事后回落与防卡死护栏（详见下方待解问题 2/3）。
  3. `src/core/engine.js:861`：收窄或移除 `(c.arousal ?? 0) >= 50` 对 `e.mode` 的强行覆盖（仅当 `e.mode` 缺失时才参考 `arousal`，避免 `BREAKTHROUGH` 事件被残留情欲误判为 `INTIMATE`）。
  4. `src/content/protocol.txt`（第 5 条、第 20 条示例）及 `src/content/literary.json` / `src/content/state-context.txt`（若有提及「情动」）：按铁律 2、3 由设计师给定稿，明确五段目标值、事后回落触发条件与示例。
- **新增字段或存储键**：不新增或重命名状态字段，沿用 `characters.<id>.arousal`。

### 3. 待解问题（推荐答案）

1. **当前实际走向与为何不符**：代码里 `arousal` 初始为 0、全靠模型自由写且无衰减机制，协议示例甚至在初夜高潮写了 75；模型容易「只升不降」，导致事后仍残留高值，且 `engine.js:861` 会把残留 `>=50` 当成亲密模式，违背「想要做的欲望」语义。【待你拍板】
2. **五段规则幅度**：建议在协议中定为 **日常未撩拨 0–15 / 勾引撩拨 25–55 / 前戏爱抚 55–80 / 正戏交欢 85–100 / 事后余韵 5–20**；同时脚本在非亲密日常轮若连续未发生亲密行为且模型未显式写 `arousal`，每次自然回落（如 `-15` 或归入 `<= 15`），理由是既给模型明确锚点，又防止状态长期卡高位。【待你拍板】
3. **「再来一次」要不要回补、回补多少**：建议**分两档处理**：若本轮 `realSex` 结束且正文/模型未显式续战，`settlement.js` 自动压到 `10–15`（满足「事后几乎没有」）；若玩家明确说「再来一次 / 继续」且模型本轮把 `arousal` 写高（如 `>= 60`）或新行为标题含继续/二战意象，脚本保留模型的回补值（建议协议指导回补至 **60–80**，从次轮前戏/正戏继续爬升）。理由是「正常事后脚本保底必降，主动续战允许模型拉回欲火」。【待你拍板】
4. **改名「情欲值」的连锁改动**：推荐**只改展示文案与提示词称呼（UI、世界书、协议、状态说明），保留底层键名 `arousal`**。理由是未发行阶段虽可改键名，但 `arousal` 对玩家不可见，保留键名可零成本兼容全部现有测试与校验逻辑。【待你拍板】

---

## 03 · 悬浮小手机的位置与透明块

### 1. 现状（代码实际路径）

1. **位置存储键**：
   - `src/runtime/host.js:25-26`（`loadPrefs` / `persistPrefs`）：存在宿主 `win.localStorage` 的 **`cj-shenghao:ui:v3:<branch>`**（按角色+聊天分支隔离），其中包含 `miniPosition: { left, top }` 与 `phonePosition: { left, top }`。
   - `src/runtime/host.js:334`：拖拽结束 `up()` 时写入 `prefs[mini ? 'miniPosition' : 'phonePosition'] = { left: end.left, top: end.top }` 并调 `persistPrefs()`。
2. **为什么任何交互都会把展开态位置重置回折叠图标位置**：
   - **原因一（`host.js:334` 写完位置没通知 UI）**：`dragStart` 的 `up()` 更新了宿主 `prefs.phonePosition` 和 `localStorage`，但**没有调用 `publish()`**，导致 iframe 内 `app.js` 持有的 `view.prefs.phonePosition` 仍然是拖拽前的旧值。
   - **原因二（`app.js:140` 每次重绘都用旧 `view.prefs.phonePosition` 覆盖坐标）**：玩家点击「此刻」「她们」「设置」等任意按钮触发 `phone()` 重绘时，`src/ui/app.js:140` 执行 `api.geometry?.({width:365, height:730, scale:standard?1:.82, ...view.prefs.phonePosition})`，把**过时的 `view.prefs.phonePosition`** 重新喂给 `api.geometry`，瞬间把刚拖走的小手机拉回原位。
   - **原因三（展开/折叠互相覆盖坐标）**：
     - 展开时：`src/ui/app.js:150`（`bindDrag` 的 `!result.moved` 分支）和 `src/ui/app.js:164`（`b.id === 'folded'`）都执行了 `api.preferences({ phonePosition: { left: r.left, top: r.top } })`，**主动把折叠图标位置覆盖成了展开态位置**。
     - 折叠时：`src/ui/app.js:220`（`case 'fold'`）执行 `api.preferences({ miniPosition: { left: r.left, top: r.top } })`，**反过来把展开态位置覆盖成了折叠图标位置**。
     - 结果就是展开位置和折叠位置被强行绑死，且拖完展开态未同步 `view.prefs`，一交互就跳回折叠图标所在处。
3. **折叠图标背后「多余的透明块」从哪来**（核对 `想法池` 猜测）：
   - *核对结果*：iframe 本体**有**跟着缩小，背景**也已经是透明的**（`src/ui/style.css:135, 171-172` 已设 `background: transparent!important`）。
   - *真正来源*：尺寸与外边距不匹配——`src/ui/app.js:130` 把折叠态 iframe 设成 **`74×108`**（`api.geometry?.({width:74, height:108, ...view.prefs.miniPosition})`），而 `src/ui/style.css:8, 139` 里 `.folded` 按钮实际只有 **`58×92`** 且带 **`margin: 5px`**。这多出来的 **16×16 px** 透明外框（叠加 `host.js:325-326` 的 `borderRadius: 18px; clipPath: inset(0 round 18px)` 与 `.folded` 的 `box-shadow`）在图标四周形成了一圈看得见阴影/挡鼠标的透明矩形热区。

### 2. 做法（可选方案与推荐）

- **方案 A（仅同步 `publish()`，继续让展开/折叠互相覆盖坐标）**：在 `host.js:334` 补 `publish()` 并在 `app.js:239` 把坐标放进 `signature`。
  - *优劣*：修好了「拖完一交互就跳回」，但展开和折叠依然绑死在同一位置，不符合「展开态独立位置并持久化」的需求。
- **方案 B（彻底解耦 `phonePosition` 与 `miniPosition` + 折叠态 iframe 与按钮 1:1 贴合）**：
  1. 去掉 `app.js:150`、`164`、`220` 三处互相覆盖 `phonePosition`/`miniPosition` 的逻辑，让两者完全独立读写 `localStorage`。
  2. `host.js:334` 拖拽结束 `up()` 后同步最新 `prefs` 给监听器（或在 `app.js:140` / `app.js:130` 仅在切换形态/无本地拖拽时传坐标，由 `host.js` 内部 `prefs` 作为位置唯一权威来源，不再从 `app.js` 回传可能过时的 `left/top`）。
  3. 折叠态把 `app.js:130` 的 iframe 尺寸收紧到与 `.folded` 一致（如 `58×92`，`.folded` 设 `margin: 0; width: 100%; height: 100%`），把未读红点 `.dot` 内收到右上角内侧（如 `top: 4px; right: 4px`）避免被 `clipPath` 裁切，去掉多余透明热区。
- **方案 C（在 `host.js` 里把折叠图标做成宿主 DOM 而非 iframe）**：折叠时隐藏 iframe、在宿主直接挂一个原生 `<button>`。
  - *优劣*：绝对零透明块，但样式/主题/红点要维护两套 DOM 且与现有 `phoneGeometry`、`dragStart` 体系割裂。

**推荐方案 B**：
- **改哪些文件 / 函数**：
  1. `src/ui/app.js:130, 140, 150, 164, 220`：移除互相覆盖 `phonePosition` / `miniPosition` 的 `api.preferences(...)`；折叠态 `api.geometry` 改为 `{width: 58, height: 92, ...}`；展开态不再用可能过时的 `view.prefs.phonePosition` 覆盖刚拖完的宿主坐标（或由 `host.js` 在 `up()` 补 `publish()` 并在 `app.js:239` 避免重绘重置）。
  2. `src/runtime/host.js:314-336`：`api.geometry` 未显式传入 `left/top` 时自动回退到当前模式的 `prefs.phonePosition` / `prefs.miniPosition`；`dragStart` 的 `up()` 结束时同步通知订阅方（`publish()`）或更新内部坐标，保证切页重绘不跳回。
  3. `src/ui/style.css:8, 139`：`.folded` 去掉 `margin: 5px`，改为 `width: 100%; height: 100%; margin: 0`，`.dot` 调整为 `top: 4px; right: 4px`（并同步重编 `phone.html`）。
- **新增字段或存储键**：沿用 `cj-shenghao:ui:v3:<branch>` 内的 `phonePosition` 与 `miniPosition`，无需新键。

### 3. 待解问题（推荐答案）

1. **为什么任何交互都会重置位置**：因为 `host.js:334` 拖完后只写 `prefs` 不 `publish()`，且 `app.js:140` 每次点击切页/设置都把过时的 `view.prefs.phonePosition`（展开时刚被 `app.js:150,164` 覆写成折叠图标坐标）传给 `api.geometry`。理由：代码实证链条完整明确。【待你拍板】
2. **折叠图标背后透明块来源**：不是 iframe 没缩小也不是背景没透明，而是 `app.js:130` 申请了 `74×108` 的 iframe 而 `.folded` 按钮只有 `58×92 + margin:5px`，多出 16px 透明边距。理由：将 iframe 与按钮尺寸对齐为 `58×92` 且去掉 `margin` 即可根除。【待你拍板】
3. **期望行为**：展开态记住 `phonePosition`、折叠态记住 `miniPosition`，互不覆盖、各自持久化；首次展开若无 `phonePosition` 再用默认右上角位置（由 `phoneGeometry` 钳位在视口内）。理由：完全贴合独立记忆与不挡鼠标的设计目标。【待你拍板】

---

## 04 · 开局表单减负 + 熟人编辑改成「一句话描述」

### 1. 现状（代码实际路径）

1. **开局表单第二步 `housingMode` / `residenceDescription`**：
   - 表单与草稿：`src/ui/app.js:21`（`defaultDraft`）、`src/ui/app.js:38`（第二步两个输入框）、`src/ui/app.js:59`（`setupSummary` 预览）、`src/ui/opening-presets.js:6-9`（4 个开局预设）、`src/ui/setup-presets.json:51, 147`（下拉词库）。
   - 内核与校验：`src/core/engine.js:592`（`validateDraft` 校验长度）、`src/runtime/schema.js:52`（`user` 结构必填 `housingMode: short, residenceDescription: text`）、`src/runtime/settlement.js:56`（列为不可变字段）。
   - **谁在读这两个字段（核对结果）**：`src/runtime/host.js:183` 的开场 `summary` **没读**它们；`src/ui/screens.js` 手机端界面 **没显示**它们；`src/content/literary.json`、`protocol.txt`、`state-context.txt` **均未提及**它们。目前唯一传给模型的地方只是 `src/core/engine.js:1116` 的 `projection(s)` 把整包 `s.user` 带了出去。
2. **熟人编辑弹窗的控件与来源**（核对 `想法池` 事实）：
   - *核对差异*：`想法池` 写「现有 21 个控件」，实际 `src/ui/app.js:90`（`contactForm`）共有 **23 个控件**：1 个「预设人物」下拉框 `contactPreset` + 21 个文本/数字/多行输入（`c_name`、`c_age`、`c_relation`、`c_aff`、`c_corruption`、`c_beauty`、`c_job`、`c_cupSize`、`c_addressing`、`c_personalityTags`、`c_appearance`、`c_body`、`c_heightCm`、`c_weightKg`、`c_bustCm`、`c_waistCm`、`c_hipCm`、`c_shoeSizeEu`、`c_recentGoal`、`c_longTermDream`、`c_notes`）+ 1 个勾选框 `c_present`。
   - 控件下拉词库与数值选项来自 `src/ui/setup-options.js:3-6`（`numericAndDate` + `src/ui/setup-presets.json` 的 `fields` 与 `contacts` 6 个预设）。
   - 保存逻辑在 `src/ui/app.js:217`（`save-contact`），校验在 `src/core/engine.js:613-616`（`validateDraft`），入库在 `src/core/engine.js:576-587`（`character(c)`）。
3. **女体记录字段缺失与透传断点**：
   - `src/ui/screens.js:63, 69` 已展示 `physiology.chestDetail`、`vaginaLook`、`pubicHair`、`bodyScent`、`traits`、`virgin` 等；`src/core/engine.js:280-350`（`seedAnatomy`）会在空白时按姓名种子自动生成默认文案。
   - 但 `contactForm`（`app.js:90`）、`save-contact`（`app.js:217`）、`validateDraft`（`engine.js:613`）都没有这组输入；`character(c)`（`engine.js:578`）也只透传了 `c.physiology?.traits`，没透传 `chestDetail` / `vaginaLook` / `pubicHair` / `bodyScent` / `virgin`。
4. **当前建档/补全路径的关键约束**：
   - `src/core/engine.js:577, 613` 强制要求 `c.name` 非空且 `c.age` 为 `1..120` 整数。
   - **`src/runtime/settlement.js:62` 把 `name` 和 `age` 锁死为不可变**：`for(const k of ['id','name','age',...]) proposed[k]=clone(prior[k]??null);`。这意味着如果熟人只填了一句描述、没填姓名年龄就进 `initialize()`，开场正文这一轮模型也**改不了**她的姓名和年龄！

### 2. 做法（可选方案与推荐）

- **方案 A（仅靠开局 `/trigger` 的 `pendingBasicProfiles` 补全，不发额外请求）**：弹窗默认只露「一句话描述」框，但仍要求（或兜底填）姓名/年龄；其余留空交给开场第一轮正文通过 `pendingBasicProfiles` 补齐。
  - *优劣*：零额外请求、符合 `protocol.txt:6`「开局一次正常生成」；但玩家点开「自定义」看不到模型生成的结果，且若玩家在「一句话描述」里写了名字却没单独填姓名框，模型无法改名（被 `settlement.js:62` 锁死）。
- **方案 B（在熟人编辑弹窗内提供「AI 一键生成/补全」静默请求，类似建档 `generateProfile`）**：主界面只放「一句话描述角色」主输入框 +「✨ AI 补全」按钮（可选自动或手动触发）+「自定义」折叠/切换按钮。点生成后调用 `H.generateRaw` 返回结构化 JSON 填入所有自定义字段（含姓名、年龄、三围、女体记录等），玩家可随时点进「自定义」微调，再点「添加」。
  - *优劣*：玩家开局前就能预览和修改全部字段，完美绕开 `settlement.js:62` 锁死 `name`/`age` 的限制；缺点是多 1 次约 3–8 秒的静默 LLM 请求（仅在玩家添加「一句话熟人」时发生）。
- **方案 C（混合：主框支持「AI 补全并预览」+ 也允许「不调模型直接保存」由开场补全）**：有姓名/年龄时可直接存进草稿由开场 `pendingBasicProfiles` 补齐；若没写姓名或想先看完整设定，点「AI 补全」走静默请求填满自定义字段。

**推荐方案 B（或 C 作为容错）**：
- **改哪些文件 / 函数**：
  1. `src/ui/app.js`：`defaultDraft`（`:21`）、第二步表单（`:38`）、`setupSummary`（`:59`）删除 `housingMode` 与 `residenceDescription`；重构 `contactForm`（`:90`）与 `save-contact`（`:217`）为「一句话描述主区 + 自定义折叠/弹窗区」，在自定义区补齐女体记录字段（`virgin`、`chestDetail`、`vaginaLook`、`pubicHair`、`bodyScent`、`traits`）。
  2. `src/ui/opening-presets.js:6-9` & `src/ui/setup-presets.json:51, 147`：清理 `housingMode` / `residenceDescription`（并可为女体字段补常用下拉词库）。
  3. `src/core/engine.js:578-579, 592, 613` & `src/runtime/schema.js:52` & `src/runtime/settlement.js:56`：`user` 去掉 `housingMode` / `residenceDescription`（未发行阶段按规则直接删除，不留兼容层）；`validateDraft` 与 `character(c)` 透传熟人的 `physiology` 预设字段（在 `seedAnatomy` 之前写入，未填的仍由 `seedAnatomy` 兜底）。
  4. `src/runtime/host.js`：新增 `api.expandContact(briefDescription)`（走 `H.generateRaw({should_silence: true, ...})`，复用 `parseProfileJSON` 的稳健解析），把一句话描述展开为完整的熟人草稿 JSON。
- **新增字段或存储键**：熟人草稿对象可选增 `briefDescription`（仅用于表单回显，不入正式状态），`characters.<id>.physiology` 沿用现有结构。

### 3. 待解问题（推荐答案）

1. **删掉 `housingMode` / `residenceDescription` 后谁在读**：代码实证除了 `projection(s)` 整包带出 `user` 外，开场 `summary`、手机 UI、世界书和协议**均未读取**这两个字段；住处、同居与房产剧情已有 `currentLocation`、`workLifeDescription` 和 `assets`（`HOUSE` 类 `description`）承载。理由：可直接从表单与状态结构中删除。【待你拍板】
2. **「一句话描述 → 模型补全」补哪些、怎么兜底、走哪次请求**：推荐走**熟人弹窗内的单次静默 `H.generateRaw` 请求**，一次性补齐基础设定（姓名/年龄/职业/关系/性格/外貌/身材/三围/近期目标/长期梦想）+ 女体记录（`chestDetail`/`vaginaLook`/`pubicHair`/`bodyScent`/`traits`）；若接口失败或玩家不想等，兜底保留 `notes` 并给默认姓名/年龄占位或提示填写姓名后交由开场正文补齐。理由：唯一能让玩家在开局前就点进「自定义」查看和修改全部字段的做法，且避免 `settlement.js:62` 锁死占位姓名。【待你拍板】
3. **「自定义」要补的女体字段清单**：按 YG 已确认口径，在自定义区新增 **是否处女（`virgin`）、胸部详情（`chestDetail`）、阴部户型与色泽（`vaginaLook`）、阴毛类型（`pubicHair`）、体香（`bodyScent`）、敏感带详情（`traits`）**（均为选填，留空仍由 `engine.js` 的 `seedAnatomy` 自动生成，不强迫填写）。理由：与 `screens.js:63` 展示项完全对齐，且有脚本兜底。【待你拍板】
4. **6 个熟人预设怎么进两层结构**：选预设后**直接填满「自定义」字段**（同时自动生成一句概括写入主输入框或显示「已载入预设，可点自定义微调」），不浪费模型请求。理由：预设本身已有完整数值与文案，直接填充最快最稳。【待你拍板】

---

## 05 · 开局清单里加「是否启用随机头像」+ 提示

### 1. 现状（代码实际路径）

1. **开关当前所在位置与存储**：
   - 仅存在于手机端设置页 `src/ui/screens.js:110`（`settings()`），点击处理在 `src/ui/app.js:185`（`api.preferences({ randomAvatar: d.randomAvatar === 'on' })`）。
   - 存储键：`prefs.randomAvatar`（存在 `win.localStorage` 的 `cj-shenghao:ui:v3:<branch>`，按聊天分支隔离），默认视为开启（代码多处判断 `!== false`）。
2. **分配与渲染时机**：
   - **分配写库**：`src/runtime/host.js:147-151`，在每次 MVU 结算顺风车里判断 `prefs.randomAvatar !== false`，调用 `assignAll(...)` 为还没有 `avatarRef` 的人物写入 `person.avatarRef = avatarId`。
   - **UI 渲染**：`src/ui/app.js:100-118`（`randomAvatarUrl`），当 `view.prefs.randomAvatar === false` 时直接返回空字符串（回退为姓名首字，手动上传的 IndexedDB 图片不受影响）。
   - **恢复人物核对**：`src/core/engine.js:1077-1079`（`PLAYER_RESTORE`）只改 `trackingState='RECORDED'`，**不会**清空 `avatarRef`；`src/runtime/settlement.js:62` 也会在每轮结算保留 `prior.avatarRef`。
3. **开局表单缺失**：
   - `src/ui/app.js:36`（`preview` 即「最后一步 · 确认起点」）和 `src/ui/app.js:59`（`setupSummary`）均没有随机头像开关与说明。

### 2. 做法（可选方案与推荐）

- **方案 A（放在「最后一步 · 确认起点」页，直接读写 `prefs.randomAvatar`）**：在 `app.js:36` 的 `preview` 页面、「查看完整设定」上方/下方放一组「随机头像：开启 / 关闭」chip 开关 + 优缺点提示卡；切换时同步写 `draftStore` / `api.preferences({ randomAvatar })`（与设置页共用同一个 `prefs.randomAvatar`）。
  - *优劣*：与 `setup` 流程无缝衔接，玩家确认开局前最后一眼就能决定本局配不配头像，开局后在设置页也能随时再改。
- **方案 B（放在第三步「生活里熟悉的人」上方）**：在 `app.js:39` 加开关。
  - *优劣*：哪怕玩家第三步不加任何熟人（开局后才结识新人），依然需要这个开关；放在「确认起点」更符合「全局开局清单」定位。
- **方案 C（开局单独存一份 `state.meta.randomAvatar` 锁死本局）**：把开关写进角色卡状态变量，开局后设置页不能改。
  - *优劣*：削弱了已有的设置页开关灵活性，没必要。

**推荐方案 A**：
- **改哪些文件 / 函数**：
  1. `src/ui/app.js:36`（`wizard()` 的 `preview` 分支）：加入「随机头像（开 / 关）」chip 控件及优缺点提示块；在 `actions()` 处理 `[data-setup-random-avatar]` 点击，调用 `api.preferences({ randomAvatar })`（若 `api` 尚未连上则暂存 `draftStore` 并在 `connect()` line 248 同步给 `api.preferences`）。
  2. `src/ui/app.js:59`（`setupSummary`）：补充一行 `随机头像：开启（按颜值分档随机配图）/ 关闭`。
  3. `src/ui/app.js:248`（`connect()`）：若开局前用户在断连状态改过 `randomAvatar`，连上 `api` 时一并同步 `api.preferences`。
- **新增字段或存储键**：不新增键，复用 `prefs.randomAvatar`（与设置页互通）。

### 3. 待解问题（推荐答案）

1. **放在哪一步**：推荐放在**「最后一步 · 确认起点」（`preview` 页）**，位于核心设定摘要之后、「查看完整设定」之前。理由：这里正是开局清单总览，且即使用户没在第三步添加初始熟人也能看到并设置。【待你拍板】
2. **提示文案（优缺点 +「抽卡式小惊喜」卖点）**：按铁律 3 仅说明要达到的效果（正式逐字文案由下轮设计师定稿）：
   - **开启（推荐）**：说明「开局像抽卡，每位女性按颜值档位从云端图库随机匹配一张固定头像，带来抽卡式小惊喜，且同一人物固定不变；缺点是可能抽到与你脑补画风不完全一致的脸，且首次加载需联网读图（失败会回退内置保底/首字）」。
   - **关闭**：说明「所有人物默认显示姓名首字圆章，清爽省流、纯靠文字想象，也可随时自行上传本地头像或图床链接；缺点是少了开局抽卡配图的视觉惊喜」。【待你拍板】
3. **与设置页是否共用 `prefs.randomAvatar`**：推荐**共用同一份 `prefs.randomAvatar`**。理由：开局设定初始偏好，进入游戏后玩家仍可在「终端设置」里随时切换，体验最自然，且代码零分叉。【待你拍板】
4. **关掉时已写进 `avatarRef` 的人怎么办**：推荐**保留 `avatarRef` 不动、仅在 UI 层隐藏不渲染**（即维持 `app.js:101` 现状）。理由：已配好的人不会因为误触关闭又重开而丢失「选定后固定不变」的抽卡结果。【待你拍板】

---

## 综合建议（请求时机 / 实施顺序 / 下一轮重点展开）

### 1. 04「一句话描述角色 → 模型补全」该走哪一次请求？

建议走**熟人编辑弹窗内点击「AI 补全」时触发的独立静默请求（`H.generateRaw({ should_silence: true })`）**，而不是搭车走开局 `/trigger` 的第一次正文生成。原因有三：
1. `settlement.js:62` 在开局 `initialize()` 之后会**锁死 `name` 与 `age`**，若不先在弹窗阶段由模型把姓名、年龄、三围与女体特征补出来，开场正文这一轮无法替占位角色改名。
2. 玩家点开「自定义」时必须能看到模型补全后的具体字段并二次微调，这只能在进入 `initialize()` 之前完成。
3. 复用 `host.js` 现有 `generateProfile` 的 `generateRaw` + `parseProfileJSON` + 取消/报错重试机制，技术链路完全现成。

### 2. 四条想法的建议实施顺序

1. **先做 03（悬浮小手机位置与透明块）**：纯 UI/宿主坐标修复，无模型提示词改动，独立可测、立刻解决实机交互痛点。
2. **再做 05（开局清单加随机头像开关）**：改动极小（仅 `app.js` 预览页 + 同步逻辑），顺手把 rc.31 尾巴彻底收口。
3. **接着做 02（情动度改名「情欲值」与五段走向）**：涉及 `screens.js`、`settlement.js`、`engine.js` 与 `protocol.txt` / 世界书文案定稿，需要同步更新单测与实机跑一轮亲密/事后对话验证。
4. **最后做 04（开局表单删住所 + 熟人「一句话描述」与女体自定义）**：改动面最大（跨 `app.js`、`engine.js`、`schema.js`、`settlement.js`、`host.js`、预设 JSON 与静默生成 prompt），放在最后集中攻关并做端到端开局验收。

### 3. 本轮未把握、需要下一轮重点展开的地方

1. **02 的「再来一次」判定边界**：脚本在 `settlement.js` 里究竟凭什么信号区分「正常事后（必须压低 `arousal`）」和「玩家要求再来一次（保留模型回补的 60–80）」？若仅靠本轮模型自己写的 `arousal` 数值，存在模型忘了降的假阳性；若靠 `BEHAVIOR` 标题关键词或新增一个临时标记，需下一轮定出最稳的判定条件。
2. **02 与 `engine.js:861` 的耦合**：目前 `c.arousal >= 50` 会把任何 `BEHAVIOR` 强制转为 `INTIMATE`，下一轮需确认是否直接删掉这个 `|| (c.arousal ?? 0) >= 50` 条件（仅认 `e.mode === 'INTIMATE'`），并核对现有测试里有没有依赖它的用例。
3. **04 静默生成 `expandContact` 的提示词与失败兜底**：需要设计师给出精确的系统提示词（约束 JSON 结构、女体描述尺度与不幻觉原则），并决定当玩家「只填一句话、不点 AI 补全直接点添加」时，是否自动触发一次补全，还是强制提示先点生成 / 填姓名。
4. **03 折叠态圆角与红点裁切**：`host.js:325` 在 `width <= 100` 时给 iframe 套了 `clipPath: inset(0 round 18px)`，若缩成 `58×92`，需要确认 `.folded` 的 `border-radius: 16px` 与 `border: 4px` 在 1:1 尺寸下是否会把右上角未读 `.dot` 裁掉，以及拖拽手柄阴影是否需要给 2px 呼吸余量或改用外层阴影。
