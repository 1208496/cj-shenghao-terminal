# 《神豪终端》rc.32 四项新功能独立代码审查报告

审查范围：
- **03 悬浮小手机位置解耦**：`src/runtime/host.js`、`src/runtime/phone-geometry.js`、`src/ui/app.js`、`src/ui/style.css`
- **05 开局随机头像开关**：`src/ui/app.js`、`src/ui/setup-draft.js`、`src/ui/avatar-pool.js`、`src/runtime/avatar-manifest.js`、`src/runtime/host.js`
- **02 情欲值五段与 arousalGuard**：`src/runtime/settlement.js`、`src/core/engine.js`、`src/content/protocol.txt`、`src/content/literary.json`、`src/content/state-context.txt`、`src/ui/screens.js`
- **04 开局减负 + 熟人一句话描述 + expandContact**：`src/ui/app.js`、`src/runtime/host.js`、`src/core/engine.js`、`src/ui/setup-options.js`、`src/ui/opening-presets.js`
- **相关测试**：`tests/rc32-arousal.test.mjs`、`tests/rc32-contact-physiology.test.mjs`、`tests/rc33-contact-guard.test.mjs`、`tests/phone-geometry.test.mjs`、`tests/avatar-pool.test.mjs` 等

---

## 一、高严重度问题（High）

### H1. [02] `realSex` 与 `sexThisRound` 未区分 `BREAKTHROUGH` / `INTIMATE` 且 `REAL_SEX` 含泛词「首次」，纯日常高分破防会误夺处女并拉满情欲
- **位置**：`src/runtime/settlement.js:128,136,170-180,190-210`
- **问题**：
  1. `syncPrivateRecords` 在 L170–180 聚合 `queue` 时丢弃了 `e.mode`；L190 仅用 `behavior.score >= 90` 判定 `realSex`，`arousalGuard`（L136）也仅用 `Number(score) >= 90` 判定 `sexThisRound`。但 `src/content/protocol.txt:10` 与 `src/content/literary.json`（`score` 条目）明确允许纯日常 `mode: "BREAKTHROUGH"` 给 90–97 分（如抚平 `hiddenScar` 或点亮 `longTermDream`）。
  2. `src/runtime/settlement.js:128` 的 `REAL_SEX` 正则包含通用词 `首次`。只要 `behavior.action` 写了「首次吐露心事」「首次破防」，或 `lastIntimate` 写了「首次牵手」，就会直接命中 `REAL_SEX`。
- **影响**：一次完全柏拉图式的 90+ 情感破防，或任何带「首次」的互动，都会被脚本强制把 `arousal` 拉到 `88`，并把 `physiology.virgin` 置为 `false`、塞入「初夜夺取」标签、`withUserCount` 置 1、覆写 `hymenNote`/`abilityComment`/`vaginaState`。
- **修复建议**：
  1. `behaviors` 记录每条事件的 `mode`（或按 `settleEvents` 实际生效的 `effectiveMode` 与 `effectiveScore` 传入），仅当 `mode === 'INTIMATE'` 且通过尺度拦截时才允许 `score >= 90` 触发 `sexThisRound` / `realSex`。
  2. 将 `REAL_SEX` 中的单独「首次」替换为明确词（如 `首次交欢|首次结合`）。

### H2. [02] `realSex` 混用「历史发生过」与「本轮发生」，导致有过一次实战后 `vaginaState` 永久锁死在刚做完/灌满精液状态
- **位置**：`src/runtime/settlement.js:190,220-235`
- **问题**：
  1. L190 定义 `const realSex = behavior.score >= 90 || (c.intimacy?.withUserCount || 0) > 0 || REAL_SEX.test(last);`。只要该女性历史上和玩家发生过一次实战，此后**每一轮** `withUserCount > 0` 与 `REAL_SEX.test(last)` 都恒为 `true`。
  2. L224–227 的 `creampie` 检查的是永久累积的 `c.intimacy.unlockedTags`，且 `if (creampie)` 分支**连 `!wroteVagina` 都不检查**，直接无条件覆写 `c.physiology.vaginaState`。
  3. 即使没有内射标签，后续日常轮只要模型没改写 `vaginaState`，就会一直落入 L228 的「刚经历亲密交欢」，导致 L231–235 按 `c.arousal` 演进的分支彻底不可达；且 L231–235 本身也缺少 `arousal < 40` 的退潮回落分支。
- **影响**：L191 注释声称「情欲值兜底放在气质判定之前，后续 vaginaState / complexion 才读得到降下来的值」，实际对所有已推倒角色完全失效；几天后在咖啡馆正常聊天（`arousal = 0`），私密面板仍永久显示「内壁滚烫痉挛，花穴微张、深处灌满浓稠精液」。
- **修复建议**：
  1. 拆分为 `everHadSex`（仅负责 L193–210 的 `virgin`/`withUserCount`/`sexPartnerCount`/`abilityComment` 历史兜底）与 `sexThisRound`（仅本轮实战发生时才写刚交欢/内射后的 `vaginaState`）。
  2. `creampie` 仅检测本轮 `behavior.text` / `behavior.tags` / `lastChanged ? last : ''`，并同样尊重 `wroteVagina`（或仅在 `sexThisRound` 时生效）。
  3. 当 `!sexThisRound && !wroteVagina && Number(c.arousal) < 25` 且当前 `vaginaState` 仍为脚本自动写入的高情欲/刚交欢文案时，回落为平静状态描述。

### H3. [02] `arousalGuard` 的续战分支错误要求 `sexThisRound` 为真，导致「事后下一轮要求再来一次」无法回补反被扣成 0
- **位置**：`src/runtime/settlement.js:136-142`
- **问题**：L139 写 `if (sexThisRound && isEncore) return Math.max(currentArousal, 72);`。对照 `src/content/protocol.txt:5`（「唯有刚完事她主动开口要“再来一次”或玩家趁余韵继续讨要时才回补到 65–80」）与 `protocol.txt:10`（「纯粹重复上一轮同一动作不重复提交高分」），当玩家在事后轮（`prior = 12`）或下一轮提出「再来一次」时，模型通常不会立刻再提交 90+ `BEHAVIOR`，也不会修改 `lastIntimate`，此时 `sexThisRound` 为 `false`。
- **影响**：续战分支 L139 直接跳过；若模型漏改 `arousal`，还会落入 L142 的日常自然回落，把 `12` 直接扣到 `0`，与协议设计完全相反。
- **修复建议**：将 L139 改为不强依赖 `sexThisRound`（例如 `if (isEncore && (sexThisRound || priorArousal >= 5 || lastChanged)) return Math.max(currentArousal, 72);`，前提是仅对在场人物读取 `body`）。

### H4. [04] `expandContact` 生成的 `hiddenScar`、`attitude`、`fetishes` 被前端静默丢弃
- **位置**：`src/runtime/host.js:185,202,204`、`src/ui/app.js:112,243`、`src/core/engine.js:919-921,958-960`
- **问题**：
  1. `host.js:185` 的 system prompt 明确要求模型生成 `hiddenScar`、`attitude`、`fetishes`，`host.js:202,204` 也完整解析并返回了这三个字段。
  2. 但 `app.js:112`（`applyExpandedContact`）的映射表完全漏掉了 `hiddenScar`、`attitude`、`fetishes`；`app.js:243`（`save-contact`）对新建熟人只从 `contactPresets` 查找 `hiddenScar`，对 AI 补全出来的熟人恒为空字符串，且完全未写入 `intimacy.attitude` / `intimacy.fetishes`。
  3. `engine.js:919-921,958-960` 只在 `validateDraft` / `character` 透传了 `physiology`，未透传 `intimacy`。
- **影响**：模型消耗 token 按玩家一句话描述量身定制的暗伤伏笔、亲密观念与性癖全部丢失，开局后被 `seedInnerLife` / `seedAnatomy` 覆写成通用原型模板。
- **修复建议**：在弹窗作用域中保存 AI 补全返回的 `hiddenScar`（保持对玩家不可见的知识边界，不显示在表单中）以及 `attitude`/`fetishes`（可进表单或随弹窗状态保存），在 `save-contact` 写入草稿，并在 `validateDraft` / `character` 中把 `intimacy.attitude`、`intimacy.fetishes` 与 `physiology` 一并先落位再由 `seedAnatomy` 补空。

### H5. [04] `cancelExpandContact` 提前释放 `setupBusy` + `expandContact` 的 `finally` 未校验所有权，存在并发锁竞态
- **位置**：`src/runtime/host.js:181-187,306`
- **问题**：`cancelExpandContact()`（L306）立刻将 `activeExpandKey = null; setupBusy = false;`，但底层 `H.generateRaw()` 是异步中止（部分后端甚至忽略 `stopGenerationById` 直到自然返回）。若玩家关弹窗后立刻再次触发 `expandContact` 或点击「开始我的人生」（`submit`），新请求将 `setupBusy` 置为 `true`；随后旧请求 `generateRaw` 结束进入 L187 的 `finally`，虽然 `if (activeExpandKey === requestKey)` 保护了 `activeExpandKey`，却紧接着**无条件执行了 `setupBusy = false; publish();`**。
- **影响**：旧请求的收尾直接解除了新请求的忙碌锁，导致新请求仍在途时 UI 解锁，可能触发并发 `expandContact` 或重复 `submit`。（注：`buildProfile` L302/L307 存在同类问题。）
- **修复建议**：将 L187 改为 `if (activeExpandKey === requestKey) { activeExpandKey = null; setupBusy = false; }`，或改用进行中任务集合 `activeSetupKeys.size > 0` 计算 `setupBusy`。

### H6. [02] 省略 `mode: "INTIMATE"` 可绕过尺度阀门 1 与复刷衰减阀门 2；且被阀门 1 拦截的违规强推仍会触发 `realSex` 与好感保护
- **位置**：`src/core/engine.js:63,1206-1243`、`src/runtime/settlement.js:46-50,170-192`
- **问题**：
  1. `engine.js:1211`（阀门 1：`openness < 35` 压回 55 分）与 `engine.js:1216`（阀门 2：旧玩法复刷降档）都只判断 `mode === 'INTIMATE'`（仅看 `e.mode`），但 `engine.js:63` 的 `reward()` 还会按 `action` 关键词兜底判为 `INTIMATE`。若模型输出 `{"type":"BEHAVIOR","personRef":"char_a","action":"实战插入","score":95}` 而漏写 `mode`，会完全绕过阀门 1 与阀门 2 并拿满 95 分暴击。
  2. 即便模型写了 `mode: "INTIMATE"` 并被阀门 1 把 `effectiveScore` 从 95 压回 55，`settlement.js:47,50`（`intimateBehaviors` / `positiveRounds`）和 `settlement.js:175,190`（`syncPrivateRecords`）都直接读取原始 `queue` 中的 `e.score = 95`，未读结算后的 `effectiveScore`。
- **影响**：模型漏写 `mode` 可白嫖满额亲密暴击；即使被阀门 1 拦截的越界强推，依然会阻止好感扣分、给堕落度加性能力加成、拉满 `arousal` 并夺走处女。
- **修复建议**：抽离统一的 `isIntimateBehavior(e)`（`e.mode === 'INTIMATE'` 或 `action` 命中亲密关键词）供阀门 1/2 与 `reward()` 共用；由 `settleEvents` 返回每人物实际生效的 `effectiveScore` 与 `effectiveMode`，再供 `syncPrivateRecords` 与 `arousalGuard` 使用。

---

## 二、中严重度问题（Medium）

### M1. [02] `arousalGuard` 将全局 `body` 文本套用到所有离场 `RECORDED` 人物，造成跨人物串扰
- **位置**：`src/runtime/settlement.js:181-192`
- **问题**：`syncPrivateRecords` 遍历所有 `trackingState === 'RECORDED'` 的人物，无论其是否在 `s.scene.presentCharacterIds` 中，都把当前场景的 `body` 原样传给 `arousalGuard`。
- **影响**：主角在卧室与角色 A 完事（「事后相拥而眠」）或续战（「再来一次」），会同时篡改远在异地的角色 B 的 `arousal`。
- **修复建议**：对 `!s.scene.presentCharacterIds.includes(cid)` 的离场人物不传 `body`（传 `''`），仅保留其自身自然回落。

### M2. [02] `syncOutfit` 在 `arousal >= 50` 时无条件覆写模型亲手写的 `complexion`，且 `arousal` 回落后永不复位
- **位置**：`src/runtime/settlement.js:253-255`
- **问题**：L254 在 `Number(c.arousal) >= 50` 时无条件写入 `'双颊绯红，眼波含春，呼吸微促'`，既会覆盖模型本轮亲手写的差异化气色（例如 `protocol.txt:20` 示例中的「双颊潮红，眼神迷离」），又在 `arousal` 降回 12 或 0 后完全不恢复静态气色。
- **影响**：角色只要动情过一次，此后即使事后平复或次日日常，`outfit.complexion` 仍一直卡在「双颊绯红，眼波含春，呼吸微促」。
- **修复建议**：仅当模型本轮未改写 `outfit.complexion` 时才按 `arousal >= 50` 覆盖；当 `arousal < 35` 且当前值等于脚本自动写入的动情文案时，恢复为 `seedOutfit` 的默认静态气色。

### M3. [02] `arousalGuard` 事后上限 `18` 与 `protocol.txt:5` 的「5–20」口径冲突，且 `AFTERGLOW_RE` 含泛词易在日常误杀
- **位置**：`src/runtime/settlement.js:131,141`、`src/content/protocol.txt:5`
- **问题**：
  1. `protocol.txt:5` 要求事后回落到 `5–20`，但 `settlement.js:141` 判断 `wrote && currentArousal <= 18`，模型合规写出 `19` 或 `20` 会被强行改回 `12`。
  2. `AFTERGLOW_RE` 含 `结束后|平复|沉睡`，日常剧情出现「会议结束后她平复了心情」且 `priorArousal >= 40` 时，即使模型本轮刚把 `arousal` 提高到 55，也会被强行砸回 `12`。
- **影响**：合规数值被无端篡改；暧昧升温轮若正文末 400 字碰巧出现「平复」「结束后」，情欲值会莫名暴跌。
- **修复建议**：将 L141 上限改为 `<= 20` 与协议对齐；若模型本轮主动上调了 `arousal`（`currentArousal > priorArousal`），不因泛词强行砸回 12，并收窄「结束后」「平复」的匹配语境。

### M4. [04] `expandContact` 的 `num()` 未过滤 `null` / `""` / `boolean`，导致空值被钳制到下限而非回退 `fallback`
- **位置**：`src/runtime/host.js:193,196-201`
- **问题**：`num` 仅检查 `Number.isFinite(Number(v))`。在 JavaScript 中 `Number(null) === 0`、`Number('') === 0`、`Number(false) === 0`，三者均通过 `isFinite` 检查，导致 `fallback` 永远不生效。
- **影响**：若模型对未知字段输出 `null` 或 `""`，`heightCm`/`weightKg`/`bustCm`/`waistCm`/`hipCm`/`shoeSizeEu` 会从预期的 `null` 变成 `145`/`38`/`70`/`50`/`75`/`34`，`beautyScore` 变成 `1`，`age` 变成 `18`。
- **修复建议**：在 `num` 开头增加 `if (v === null || v === undefined || v === '' || typeof v === 'boolean') return fallback;`。

### M5. [04] 切换聊天分支（`CHAT_CHANGED`）未中止在途 `expandContact`，导致新分支被旧分支的 `setupBusy` 锁死
- **位置**：`src/runtime/host.js:378`
- **问题**：`CHAT_CHANGED` 递增了 `epoch`（能阻止旧结果写入），但未调用 `api.cancelExpandContact()`，也未重置 `setupBusy`。
- **影响**：玩家在开局页发起 AI 补全后切换聊天，新聊天分支的终端与开局按钮会一直处于 `busy` 锁定状态，直到旧请求返回。
- **修复建议**：在 `CHAT_CHANGED` 中顺手调用 `api.cancelExpandContact()`（以及 `api.cancelBuildProfile()`）。

### M6. [05] 随机头像 `<img>` 缺少错误兜底与 CDN 切源重试，`nextBase()` 为死代码
- **位置**：`src/ui/app.js:138,183`、`src/runtime/avatar-manifest.js:101-106`
- **问题**：`image()` 渲染随机头像时未加 `data-media` 属性，而 `wireImages()`（L183）只给 `img[data-media]` 绑定 `error` 回调；`avatar-manifest.js:101` 实现的 `nextBase()` 换源逻辑全仓库无人调用。
- **影响**：玩家开启随机头像后，一旦 `testingcf.jsdelivr.net` 不可达或处于离线环境，所有女性头像均显示浏览器破图图标，既不会切换备用 CDN host，也不会退回姓名首字圆章。
- **修复建议**：给随机头像 `<img>` 添加 `data-random-avatar` 标记，在 `wireImages()` 中绑定 `error` 处理器：先尝试 `nextBase()` 轮换剩余 CDN host，全部失败后替换为姓名首字文本节点。

### M7. [05] `receive()` 渲染签名遗漏 `prefs.randomAvatar`，且分支错位时开局开关会出现假选中
- **位置**：`src/ui/app.js:189,265`
- **问题**：
  1. `app.js:265` 的 `signature` 包含 `theme/phoneSize/fontSize/displayDock`，唯独缺少 `v.prefs.randomAvatar`。若偏好变化来自外部或另一视图，`receive()` 会误判签名未变而跳过重绘。
  2. `app.js:189` 当 `api && api.read().chatKey !== activeChat` 时会走 `else` 分支调用 `draftStore?.write(activeChat, patch)`；若此时 `activeChat !== draftStore.chatKey()`，`setup-draft.js:5` 会静默返回 `false` 拒绝落盘，但 `app.js:189` 依然改写内存 `view.prefs.randomAvatar` 并重绘 `wizard()`。
- **影响**：跨视图同步随机头像开关时界面不刷新；分支切换瞬间点击开关可能出现「界面显示关闭、实际未持久化」的假象。
- **修复建议**：把 `v.prefs.randomAvatar` 加入 `app.js:265` 的 `signature`；在 `app.js:189` 检查 `draftStore?.write(...)` 返回值，写入失败时不伪造本地 `view.prefs`。

### M8. [03] 拖拽被 `blur`/`pointercancel` 中断后坐标既未保存也未回弹；隐藏态 `resize` 会把坐标覆写为 `(0,0)`
- **位置**：`src/runtime/host.js:373,380`
- **问题**：
  1. `dragStart` 的 `cancel()`（L373）只做 `cleanup(); finish?.({moved:true});`，此时 `move()` 已改写了 `phone.style.left/top`，但 `prefs` 仍保留旧坐标。下次 `phone()` 重绘调用 `api.geometry({width, height, scale})` 时，悬浮窗会突然跳回旧位置。
  2. `resize()`（L380）未判断 `phone.style.display === 'none'` 或 `prefs.displayDock === 'bottom'`。当悬浮窗隐藏时 `getBoundingClientRect()` 返回 `{left:0, top:0}`，`resize()` 将有限值 `left:0, top:0` 显式传给 `api.geometry`，覆盖掉 `savedPos`。
- **影响**：拖拽中途失焦后界面位置与持久化状态分裂，后续点击任意按钮时发生瞬移；未开局或切换聊天时调整浏览器窗口大小会导致位置被重置到左上角。
- **修复建议**：`cancel()` 若发生过移动，调用 `api.geometry({...layout})` 回弹到已保存位置（或直接落盘合法坐标）；`resize()` 在 `phone.style.display === 'none'` 或 `prefs.displayDock === 'bottom'` 时不传 `left/top`（或直接跳过）。

---

## 三、低严重度问题（Low）

### L1. [04] `expandContact` 的 `cupSize` 未提取单字母，模型写「C罩杯」会被截成「C罩」
- **位置**：`src/runtime/host.js:198`、`src/ui/screens.js:24`
- **问题**：`cupSize: str(parsed?.cupSize, 2).toUpperCase()` 直接截前 2 字符。若模型返回「C罩杯」，结果变成「C罩」，在 `screens.js:24` 拼成「C罩 罩杯」。
- **修复建议**：改为 `str(parsed?.cupSize, 8).match(/[A-G]/i)?.[0]?.toUpperCase() || ''`。

### L2. [04] 熟人弹窗三处交互细节：`CONTACT_AI_TEXT.preset` 未使用、切预设不作废在途 AI 请求、AI 失败吞掉具体错误码
- **位置**：`src/ui/app.js:110-115,261`
- **问题**：
  1. `CONTACT_AI_TEXT.preset`（L110）定义后从未被 `fillContactPreset`（L115）引用，选预设后状态提示仍停留在 AI 引导文案（另 L111 有多余双分号 `;;`）。
  2. `app.js:261` 切换 `#contactPreset` 下拉框时未递增 `contactToken` 也未取消在途 `expandContact`，旧 AI 结果返回后会覆盖刚选好的预设。
  3. `fillContactByAi`（L113）的 `catch` 将 `GENERATION_BUSY` / `STALE_CHAT` 等明确原因全部吞成通用 `CONTACT_AI_TEXT.failed`。
- **修复建议**：`fillContactPreset` 内递增 `contactToken`、调用 `api?.cancelExpandContact?.()` 并更新 `#contactAiStatus` 为 `CONTACT_AI_TEXT.preset`；`fillContactByAi` 对 `GENERATION_BUSY`/`STALE_CHAT` 展示 `errorText(error)`。

### L3. [03] `bindDrag` 未防 `api` 断连空引用与多指并发 `pointerdown`
- **位置**：`src/ui/app.js:173`
- **问题**：直接调用 `api.dragStart(...)` 未使用可选链，且未在 `controller` 已激活时忽略后续 `pointerdown`。热重载断连瞬间点击会抛 `TypeError`，触屏双指同时按住标题栏会覆盖前一个拖拽控制器。
- **修复建议**：在 `pointerdown` 开头加 `if (!api?.dragStart || controller) return;`。

### L4. [04/05] 开局预览摘要遗漏性能力与性器设定；`validateDraft` 未兼容 `beautyScore: null`
- **位置**：`src/ui/app.js:61`、`src/core/engine.js:957`
- **问题**：`setupSummary(d)` 展示了颜值与随机头像，未列出步骤 1 填写的 `prowessScore` 和 `genitals`；`validateDraft` L957 仅对 `c.beautyScore === undefined` 放行，传 `null` 会抛 `INVALID_INTEGER`（与 `schema.js:11` 的 `nullable` 不一致）。
- **修复建议**：`setupSummary` 补充性能力/性器一行；`engine.js:957` 放宽为 `c.beautyScore == null ? null : integer(c.beautyScore, 1, 100)`。

---

## 四、测试缺口清单

1. **03 悬浮小手机位置解耦（缺集成与边界测试）**：`tests/phone-geometry.test.mjs` 仅覆盖 `phoneGeometry` 纯数学计算，缺少 `host.js` 对 `miniPosition` / `phonePosition` 独立持久化、折叠/展开互不覆盖、`dragStart` 取消（`blur`/`pointercancel`）、隐藏态 `resize`、以及 `CHAT_CHANGED` 切分支恢复各自坐标的测试。
2. **05 开局随机头像开关（缺端到端与 host 测试）**：`tests/avatar-pool.test.mjs` 仅测 `assignAll` 纯函数，缺少 `host.js` 在 `prefs.randomAvatar === false` 时跳过写 `avatarRef`、断连态通过 `setupDraftStore` 落盘并在 `connect()` 同步到 `api.preferences`、以及随机头像加载失败回退/切源的测试。
3. **02 情欲值五段与 `arousalGuard`（缺跨轮与 `settleNative` 集成测试）**：`tests/rc32-arousal.test.mjs` 仅测 `arousalGuard` 5 条孤立用例，缺少：① `BREAKTHROUGH` 90+ 分不误触发 `sexThisRound`/`realSex`；② 已推倒人物后续日常轮 `vaginaState` 与 `outfit.complexion` 退潮；③ 事后下一轮无 90+ 评分的「再来一次」回补；④ 离场人物不受在场 `body` 串扰；⑤ 漏写 `mode` 的亲密 `BEHAVIOR` 不绕过阀门 1/2。
4. **04 `expandContact` 与熟人弹窗（仅源码静态正则断言，缺运行时测试）**：`tests/rc33-contact-guard.test.mjs` 全部是源码字符串 `includes` 检查，未实际运行 `expandContact` 或弹窗流程，因此漏掉了 `num(null) -> min`、`hiddenScar`/`attitude`/`fetishes` 丢失、`cancelExpandContact` 后二次请求的 `setupBusy` 竞态及 `cupSize` 截断。

---

## 五、已核对无问题的模块与依据

- **03 · `src/ui/style.css`（`.folded` 与 `.folded-bar`）及 `src/runtime/phone-geometry.js`**：已核对无问题。`style.css:139` 已用 `position:relative!important;inset:auto!important;width:100%!important;height:100%!important;touch-action:none` 让折叠态铺满 iframe 并把定位完全交给宿主，`.folded.folded-bar`（L273）正常覆盖为底栏横条；`phone-geometry.js:1-10` 缩放与视口钳制逻辑稳定且有单测覆盖。
- **03 · `src/ui/app.js:144-165,187` 折叠/展开主路径与键盘操作**：已核对无问题。折叠传 `58×92`、展开传 `365×730` 且均不传 `left/top`，天然各自读取 `miniPosition` / `phonePosition`；`bottom` 模式不绑拖拽并独立持久化 `dockExpanded`，键盘触发 `#folded` 点击路径正常。
- **05 · `src/ui/avatar-pool.js` 确定性选图与防撞**：已核对无问题。`assignAll` 先保留既有 `avatarRef` 计入占用再按 `chatSeed:cid` 确定性选图，关闭再开启不会洗掉已配结果，且内联清单与远程清单全量对齐（`tests/avatar-pool.test.mjs` 12 条用例通过）。
- **02 · `src/content/literary.json`、`src/content/state-context.txt` 与 `src/ui/screens.js` 文案落地**：已核对无问题。世界书 `private-life` 与 `state-context.txt` 已按评审要求移除重复的情欲五段定义并保留性格差异描写；`screens.js:42,43,61` 已全面统一为「情欲 / 情欲值」，无「情动度」残留。
- **04 · `src/core/engine.js` 开局减负（移除住所两项）与 `physiology` 优先落位**：已核对无问题。`defaultDraft`、`opening-presets.js`、`validateDraft` 均已彻底移除 `housingMode`/`residenceDescription`；`character()`（L919–921）先写入开局已填 `physiology` 与 `virgin===false` 时的 `sexPartnerCount`，再由 `seedAnatomy` 只补空字段（`tests/rc32-contact-physiology.test.mjs` 全部通过）。
