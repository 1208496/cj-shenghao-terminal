# 神豪终端 · rc.36「三盘轮盘 + 五页导航」实施方案

> **目标版本**：`2.0.0-rc.36` ｜ **建议 `cardContractRevision`**：`30 → 31`
> **适用范围**：本方案只做设计与施工指引，交由 DSH 执行。
> **文案铁律**：**F 节代码块中的所有面向玩家文案为 100% 最终定稿，DSH 必须用脚本逐字提取写盘，一个字、一个标点都不准自行修改、缩写或润色。**
> **发行口径**：当前尚未向玩家正式发行，按项目约定直接修改/删除旧字段（如 `lastFreeCardDate`），不为未发行存档保留兼容层或迁移层。

---

## A 缺陷清单

按严重度（P0 / P1 / P2）排序，已合并 HANDOFF 第 27 行记录的已知问题与本次代码全检新发现的问题。

### P0（阻断核心功能 / 体验不可用）

1. **轮盘浮层被困在小手机 iframe / 正文底部状态栏内，无法真正全屏**
   - **现象**：打开轮盘后，浮层仅能盖住 365×730 的悬浮小手机区域；在「固定正文底部」模式下更是被裁进底部横条或面板高度内，完全达不到突破小手机盖在正文之上的目标。
   - **根因**：`createWheelOverlay()` 将 `.wheel-overlay` 挂在手机 iframe 自身的 `document.body` 下，`.wheel-overlay { position: fixed; inset: 0 }` 的参考视口是 iframe 自身而非酒馆顶层窗口 `win.document.body`；且 `.wheel-board { width: min(74vmin, 520px) }` 的 `vmin` 取的也是 365px 窄视口。
   - **影响文件:行**：`src/ui/wheel-overlay.js:100`、`src/ui/style.css:340,350`、`src/runtime/host.js:323-324,350-364`

2. **赌场轮盘右侧下注台溢出裁切，文字不可见且无法点击**
   - **现象**：切到赌场模式后，右侧「赌桌下注台」（红/黑/绿押注按钮与星愿卡列表）右侧文字被裁掉大半，在 365px 手机内几乎完全消失在可视区外。
   - **根因**：`.casino-side` 采用 `position: absolute; right: -292px; width: 280px` 强行定位在 `.wheel-stage` 右外侧，既被 iframe 边界裁切，在全屏移动端窄屏下也会直接溢出屏幕右边缘。
   - **影响文件:行**：`src/ui/style.css:362-372`、`src/ui/wheel-overlay.js:98,136-145`

3. **星愿商城弹窗缺少购买按钮，且进阶价格与已觉醒状态显示错误**
   - **现象**：打开「星愿商城」弹窗后只能看到商品名称与价格纯文本，点击无任何反应，玩家无法购买异能、奇物或 TOY·LINK；且不可升级异能（`upgradable: false`）觉醒后仍显示「原价 → 进阶」，可升级异能进阶价格显示的是原价而非 `upgradeCost(a, lv)`。
   - **根因**：`shopModal()` 渲染的是 `<div class="shop-price">`，遗漏了 `<button data-shop-buy="...">`；`actions()` 中监听 `if (d.shopBuy)` 永远无法被触发。
   - **影响文件:行**：`src/ui/app.js:74-78,258`、`src/core/casino.js:64-67`

4. **赌场押中后点击结果卡「收手兑换」静默失效**
   - **现象**：赌场押中翻倍弹出结果卡，玩家点击「收手兑换」后结果卡关闭，但积分未入账、卡牌未被兑换，无任何提示。
   - **根因**：`spinCasino()` 在展示结果卡后于第 240 行立刻执行 `side.dataset.cardId = ''` 清空了选中卡 ID；随后点击 `data-cashout` 时读取 `side.dataset.cardId` 为空字符串，被第 267 行 `if (!cardId) return;` 直接静默拦截。
   - **影响文件:行**：`src/ui/wheel-overlay.js:233,240,264-270`

5. **轮盘浮层 SVG 渲染过重，实机截图触发 `PageUnresponsive` 超时**
   - **现象**：浮层展开后主线程负载偏高，ego 实机截图触发 `PageUnresponsive` 超时；同时此前为了止损削减了大量视觉表现，观感单薄。
   - **根因**：`playWheelSvg()` 为 52 个扇区各生成独立 `<path>` + 独立 `<g><path>`（150+ SVG 节点、内联 52 份完整符号路径），缺少合并与 `<symbol>/<use>` 复用；且 `refresh()` 反复整块重写 `svg.innerHTML` 触发全量重排重栅格化。
   - **影响文件:行**：`src/ui/wheel-overlay.js:38-59,122-134,153-174`、`HANDOFF.md:27,60`

### P1（核心链路断裂 / 逻辑错误 / 规则未闭环）

6. **背包弹窗按钮错位：星愿卡缺少「去赌场加押」，玩法奖品误挂「去赌场加押」**
   - **现象**：背包里 `WISH_CARD` 只有「立即兑换」按钮，无法一键带去赌场；相反 `WHEEL_PRIZE` 玩法券被错误挂上 `CASINO_UI.buttons.bagGoBet`（「去赌场加押」），点击后打开的还是玩法轮盘。
   - **根因**：`bagModal()` 模板分支把 `bagGoBet` 放错到 `WHEEL_PRIZE` 分支，且 `data-act="open-wheel"` 写死了 `wheel().open('play')`。
   - **影响文件:行**：`src/ui/app.js:60-67,253`

7. **玩法轮盘无法使用「120 星愿积分」模式，5 次现金后直接撞上限报错**
   - **现象**：每日免费 1 次 + 5 次现金用完后，玩法轮盘没有切到积分模式，继续点 GO 仍发 `mode: 'cash'` 触发 `WHEEL_DAILY_LIMIT`；也无法主动选择用 120 积分抽。
   - **根因**：`spinPlay()` 仅判断 `w.lastFreeDate === st().world.date` 在 `free/cash` 间二选一，未调用 `wheelQuote()`，也没有现金/积分切换入口。
   - **影响文件:行**：`src/ui/wheel-overlay.js:186-188`、`src/core/wheel.js:61-70`

8. **奇物注入 AI 上下文（`projection`）永远为空**
   - **现象**：玩家在商城买到的超现实奇物（真言威士忌、微醺忘忧香等）永远不会出现在 AI 上下文的 `bagSurrealItems` 中，正文无法感知玩家持有奇物。
   - **根因**：`projection(s)` 查表写成了 `SURREAL_ITEM_BY_ID[i.itemId]`，但 `i.itemId` 是运行时实例 ID（`item_<opId>`），目录键是 `i.refId`（如 `it_whisky`），查表恒为 `undefined`。
   - **影响文件:行**：`src/core/engine.js:1579`

9. **`runWheelOp` 在旋转动画前调用 `refresh()`，导致 SVG 被整块重置、动画跳变**
   - **现象**：点 GO 后结算一返回，`svg.innerHTML` 立即被整块重建归零，与内存中的 `playAngle` / `casinoAngle` 脱节；若旋转期间收到外部状态刷新，动画会被直接销毁中断。
   - **根因**：`runWheelOp()` 在 `api.action()` 后立刻调 `wheelOverlay?.refresh()`，而 `refresh()` 无视 `busy` 直接调 `render()` 重写整个 SVG。
   - **影响文件:行**：`src/ui/app.js:45-52`、`src/ui/wheel-overlay.js:122-134,282`

10. **虹阶终极大奖（NO.53 / index 52）无落点动画与金光高亮**
    - **现象**：抽中虹阶 `w53`（终端最终愿望）时，内环多转一圈且没有任何格子亮起金光。
    - **根因**：`RINGS[2]` 仅覆盖索引 `46..51`（6 格），索引 52 是中心虹核 `CORE`，但 `animatePlay(52)` 仍将其归入 `owner = 2`，`highlightPlay(52)` 查找 `[data-cell="52"]` 返回 `null`。
    - **影响文件:行**：`src/ui/wheel-overlay.js:9-14,54,147-174`

11. **赌场 `updateCasinoGo()` 死代码 + 翡翠格（×36）中奖文案未接**
    - **现象**：未选卡或未选框时赌场 GO 按钮未禁用也未显示「请先放卡」；押中翡翠格 ×36 时弹出的是普通 `winNormal` 文案，未使用 `winGreen`。
    - **根因**：`updateCasinoGo()` 定义后从未被调用；`spinCasino()` 未区分 `bet === 'green'`。
    - **影响文件:行**：`src/ui/wheel-overlay.js:229-233,252`

12. **4 个数值型异能未接结算 + TOY·LINK 桥接未做**
    - **现象**：`ab_scent`（情欲下限 +8/+12/+16）、`ab_voice`（好感 +1/+2/+3）、`ab_stamina`（战力 +8/+12/+16）、`ab_gaze`（堕落 +2/+3/+5）尚未参与脚本结算；`toyLinkUnlocked` 解锁后缺少前端一键呼出桥接。
    - **根因**：rc.34/rc.35 遗留待办。
    - **影响文件:行**：`HANDOFF.md:27,83-84`、`src/core/casino-catalog.js:161,173,209,269,485`

### P2（信息架构 / 边界健壮性 / 历史待决）

13. **三页导航拥挤：财富挤在「我的」页，星愿卡抽取藏在背包弹窗，轮盘挂在日历页**
    - **现象**：导航仅 3 项（此刻/她们/我的）；「我的」页过长；星愿卡没有独立轮盘，藏在背包弹窗底部按钮；日历页混入轮盘入口。
    - **根因**：rc.34/rc.35 临时沿用旧 3-Tab 框架挂载新功能。
    - **影响文件:行**：`src/ui/app.js:207-211`、`src/ui/screens.js:108-120`

14. **切换聊天（`CHAT_CHANGED`）时轮盘浮层未自动关闭**
    - **现象**：开着轮盘切换聊天时，`receive()` 仅关闭 `modal` 和 `fx`，轮盘仍停留在上一聊天的状态。
    - **根因**：`receive()` 与 `host.js` 的 `CHAT_CHANGED` 回调均未联动关闭轮盘。
    - **影响文件:行**：`src/ui/app.js:318`、`src/runtime/host.js:378`

15. **裸 `s.wheel = {}` 缺少 `discoveredPrizeIds` 防御初始化**
    - **现象**：若状态中 `s.wheel` 为 `{}`，执行 `PLAYER_WHEEL_SPIN` 时 `w.discoveredPrizeIds.includes(...)` 会抛 `TypeError`。
    - **根因**：`applyOperation` 未对数组子字段做空值兜底。
    - **影响文件:行**：`src/core/engine.js:1418,1439`

16. **赌场/商城实机点击未验 + H7（省略 `mode:"INTIMATE"` 绕过尺度阀门）待决**
    - **现象**：赌场押注、商城购买、星愿卡兑换仅有单测，未在 8001 实机点通；H7 尺度阀门绕过问题仍未拍板是否修复。
    - **根因**：上轮施工收尾未覆及。
    - **影响文件:行**：`HANDOFF.md:27,59,82,85`

---

## B 轮盘全屏方案

### 1. 候选方案对比与选定

| 维度 | 方案一：临时把手机 iframe 撑到 `100vw×100vh` | 方案二：直接注入酒馆父页面 `win.document.body` DOM | **方案三（选定）：顶层独立全屏兄弟 iframe `#cj-shenghao-wheel-frame`** |
|---|---|---|---|
| **全屏可靠性** | 差。底部停靠时手机 iframe 挂在 `.mes_text` 内，祖先含 `overflow`/`transform` 会令 `position:fixed` 失效；若迁回 `body` 会触发 **iframe 文档重载**，JS 状态全丢 | 好。直接挂 `win.document.body` | **极好**。始终是 `win.document.body` 直接子节点，与小手机悬浮/折叠/底部停靠完全解耦 |
| **CSS 与事件隔离** | 好 | 差。极易被酒馆主题 `!important`、全局 `button/svg` 规则或快捷键拦截污染 | **极好**。100% 样式与 DOM 隔离，不受酒馆皮肤与美化插件干扰 |
| **切停靠/换楼稳定性** | 差。`syncDockMount` 与 `syncBottomHeight` 会反复改写 `phone.style` 造成冲突 | 好 | **极好**。`syncDockMount` 只动 `#cj-shenghao-phone-frame`，绝不触碰轮盘 iframe |
| **实现代价** | 低，但坑极多且底部停靠无解 | 中，维护样式冲突成本高 | **可控**：新增 `postMessage` 桥接（约 80 行）+ 构建内联 `wheelHTML`（约 +25 KB，远低于 3 MB 上限） |

**最终决定：选定方案三（顶层独立全屏兄弟 iframe），由 `host.js` 统一托管生命周期。**

#### 关键工程细节

- **宿主与样式**：`host.js` 在首次打开轮盘时懒创建 `#cj-shenghao-wheel-frame`（`sandbox="allow-scripts allow-same-origin"`，`srcdoc=wheelHTML`），挂在 `win.document.body` 末尾。
  - 关闭态：`display: none; pointer-events: none;`
  - 打开态：`position: fixed; inset: 0; width: 100vw; height: 100dvh; border: 0; margin: 0; padding: 0; background: transparent; z-index: 2147482600; display: block; pointer-events: auto;`
- **层级与遮挡关系**：`z-index: 2147482600` 高于小手机（`3000`）与酒馆全部原生层/弹窗，全屏半透明暗曜遮罩（`rgba(8, 7, 12, 0.84)`）盖住正文、酒馆顶栏、输入栏与小手机本身。桌面端可加 `backdrop-filter: blur(4px)`；移动端（`@media (max-width: 860px)`）关闭 `backdrop-filter` 保帧率。
- **关闭与恢复**：关闭时隐藏 `#cj-shenghao-wheel-frame`、恢复顶层滚动锁；小手机 iframe 原封不动，当前 Tab 与滚动条位置 100% 保留。
- **响应式布局（根治赌场右侧裁切）**：
  - 废除 `.casino-side { position: absolute; right: -292px }`。
  - 舞台 `.wheel-stage` 改为 Flex 布局：
    - **宽屏（`≥ 860px`）**：`flex-direction: row; align-items: center; justify-content: center; gap: 24px; max-width: min(96vw, 960px);` —— 左盘（`min(72vmin, 520px)`）+ 右侧面板（`width: 300px; flex-shrink: 0`），整体居中，永不溢出。
    - **窄屏/移动端（`< 860px`）**：`flex-direction: column; align-items: center; gap: 12px; width: 100%; height: 100dvh; padding: 52px 12px 16px;` —— 上盘（`min(84vw, 44dvh, 360px)`）+ 下侧控制/下注台（`width: min(94vw, 420px); max-height: 38dvh; overflow-y: auto`），确保 375×667 竖屏下所有按钮与星愿卡完整可见可点。
- **`Esc` 与点击遮罩关闭**：
  - 轮盘 iframe 内监听 `keydown(Escape)` 与 `[data-close]`（遮罩与右上角 `×`）；
  - `host.js` 同时在顶层 `win` 监听 `keydown(Escape)`（避免焦点未落入 iframe 时 Esc 失效）；
  - 旋转中（`wheelSpinning === true`）禁止 Esc 与点击遮罩关闭，轻提示「转盘转动中，请等待落定」。
- **滚动锁定**：打开时 `host.js` 记录 `win.document.body.style.overflow` 并设为 `'hidden'`；关闭或 `api.destroy()` 时精确还原。
- **重挂载 / 切聊天 / 销毁**：
  - 切底部停靠（`syncDockMount`）、换楼、正文流更新：**不关闭、不重载**轮盘 iframe，仅推送 `WHEEL_STATE_SYNC`。
  - 切聊天（`CHAT_CHANGED`）：`host.js` 强制向轮盘发送 `WHEEL_CLOSE { reason: 'CHAT_CHANGED' }` 并隐藏 iframe，清除 `wheelSpinning`。
  - 脚本卸载（`api.destroy()`）：`wheelFrame?.remove()`、移除顶层 `message`/`keydown` 监听、还原滚动锁。

---

### 2. 完整 `postMessage` 通信协议

信道常量：`CHANNEL = 'CJ_SHENGHAO_WHEEL_V1'`。
安全校验：因 `srcdoc` iframe 在 `allow-same-origin` 下的 `origin` 表现随宿主环境存在差异，协议采用 **三重校验**：`event.source` 严格相等（父查 `wheelFrame.contentWindow`，子查 `window.parent`）+ `data.channel === CHANNEL` + `data.nonce === sessionNonce`（握手时由父端生成下发）。

| 消息名 `type` | 方向 | 负载字段 | 说明 |
|---|---|---|---|
| `WHEEL_READY` | Child → Parent | `{ channel }` | iframe 脚本挂载完成，请求初始化握手 |
| `WHEEL_INIT` | Parent → Child | `{ channel, nonce, wheelType, preselectCardId, view }` | 握手应答，下发会话 nonce、初始盘型与精简状态快照 `view` |
| `WHEEL_OPEN` | Parent → Child | `{ channel, nonce, wheelType, preselectCardId, view }` | 已初始化 iframe 再次打开，切换盘面并刷新状态 |
| `WHEEL_STATE_SYNC` | Parent → Child | `{ channel, nonce, view }` | 外部状态/busy/revision 变更推送（子端旋转中仅缓存，落定后应用） |
| `WHEEL_OP_REQ` | Child → Parent | `{ channel, nonce, reqId, op, lineage }` | 请求执行写操作（`op` 含 `operationId`、`type`、`expectedRevision` 及业务参数） |
| `WHEEL_OP_RES` | Parent → Child | `{ channel, nonce, reqId, ok, result?, view?, errorCode?, errorMessage? }` | 操作结果回传；子端 12000ms 超时自动 reject `WHEEL_BRIDGE_TIMEOUT` |
| `WHEEL_BUSY_LOCK` | Child → Parent | `{ channel, nonce, spinning }` | 通知父端旋转动画锁状态（控制 Esc 与遮罩拦截） |
| `WHEEL_CLOSE_REQ` | Child → Parent | `{ channel, nonce }` | 子端点击关闭/按 Esc，请求父端隐藏 iframe |
| `WHEEL_CLOSE` | Parent → Child | `{ channel, nonce, reason }` | 父端确认关闭或因 `CHAT_CHANGED` 强制关闭，子端复位弹窗与动画锁 |

其中 `view` 为 `host.js` 裁剪后的轻量快照，避免跨帧克隆整棵角色树：
```js
// host.js 裁剪的轮盘专用快照（体积极小，序列化 < 1ms）
function wheelSnapshot(v = stateView()) {
  const s = v?.state;
  return {
    ready: !!s,
    busy: !!v?.busy,
    lineage: v?.lineage || '',
    revision: s?.meta?.revision ?? 0,
    theme: v?.prefs?.theme || 'sage',
    worldDate: s?.world?.date || '',
    cashCents: s?.user?.cashCents ?? 0,
    tierBasisCents: s ? tierBasis(s) : 0,
    hasWithdrawal: s ? Object.keys(s.withdrawals || {}).length > 0 : false,
    wheel: s?.wheel ? clone(s.wheel) : {},
    wishCards: s ? Object.values(s.inventory || {}).filter((i) => i.category === 'WISH_CARD') : [],
  };
}
```

---

### 3. 状态竞争与并发防护

1. **生成期锁定**：`host.js` 监听 `GENERATION_STARTED` / `mvuBusy` 时，通过 `subscribe` 自动推送 `WHEEL_STATE_SYNC { view: { busy: true, ... } }`；轮盘子端在 `busy === true` 时禁用 GO 按钮并显示「正文生成中，请稍候…」。
2. **乐观锁复用**：`WHEEL_OP_REQ` 携带子端当前 `expectedRevision` 与 `lineage`。`host.js` 收到后直接复用 `api.action(op, lineage)`，依次经过 `requireRule(!busy(), 'GENERATION_BUSY')` → `readCurrent()` 校验 `lineage` → `applyOperation()` 校验 `expectedRevision === state.meta.revision`。
3. **冲突自愈**：若 `api.action()` 抛出 `STALE_REVISION` 或 `STALE_SOURCE`，`host.js` 在返回 `WHEEL_OP_RES { ok: false, errorCode }` 的同时，立刻附带最新 `view: wheelSnapshot()`；子端更新本地快照并弹出友好提示，玩家再次点击即可成功，绝不死锁。
4. **防连点幂等**：子端在点击 GO 时立刻置 `spinning = true` 并生成唯一 `operationId = crypto.randomUUID()`，即使网络或桥接抖动，引擎层 `state.operationHistory[op.operationId]` 也能保证绝不重复扣款。
5. **动画隔离**：子端在 `spinning === true` 期间收到 `WHEEL_STATE_SYNC`，只写入 `pendingView`，绝不中途重绘盘面或打断旋转；等动画 `transitionend` 落定并弹出结果卡后再合并 `pendingView`。

---

### 4. 性能预算（根治 `PageUnresponsive`）

| 指标 | rc.34 现状 | rc.36 硬性上限 | 具体技术手段 |
|---|---|---|---|
| **玩法轮盘 SVG 节点数** | 160+ | **≤ 75** | 52 扇区按色合并为 **6 条 `<path>`**（每环深/浅交替各 1 条）+ 3 条径向分隔线 `<path>`；52 个符号改 `<defs><symbol>` + `<use>`；落点高亮改 **1 个复用 `<path class="hit-wedge">`** |
| **星愿轮盘 SVG 节点数** | 无 | **≤ 35** | 12 扇区按四档色合并为 **4 条 `<path>`** + 1 条分隔线 `<path>` + 12 个 `<use>` 星芒符号 + 1 个复用 `<path class="hit-wedge">` |
| **赌场轮盘 SVG 节点数** | ~80 | **≤ 48** | 红 18 格合并 1 条 `<path>`、黑 18 格合并 1 条 `<path>`、绿 1 格 1 条 `<path>`、分隔线 1 条 `<path>` + 37 个轻量 `<text>` + 1 个滚珠 `<circle>` |
| **同帧并发动画层数** | 5+（含常驻） | **≤ 3 层** | 玩法盘旋转时仅 3 个 `.ring` 动画（3 层）；落定后停止环动画，再播 1 层金光 + 1 层 Canvas 粒子（2 层） |
| **粒子系统** | 无/DOM | **1 个 `<canvas>`，≤ 36 颗** | 爆发寿命 ≤ 1.6s，静止时彻底停掉 `rAF`（**空闲 0 FPS、0 CPU**，彻底消除无头截图超时） |
| **`will-change` 策略** | 未控 | **动态按需挂载** | 仅旋转开始加 `.is-spinning { will-change: transform }`，落定 `transitionend` 移除为 `auto` |
| **高耗滤镜禁令** | 含多处阴影 | **0 个 SVG filter** | 禁用 `<feGaussianBlur>` 与大面积 `filter: drop-shadow()`，统一用 `<radialGradient>` 与轻量 CSS `box-shadow` 替代 |
| **SVG 重建频次** | 每次 `refresh` 重写 | **仅切盘时构建 1 次** | 状态刷新只更新侧栏文字、余额与按钮，绝不碰 `svg.innerHTML` |

---

### 5. 视觉表现清单与 DOM 成本

| 视觉项 | 三盘差异化表现 | 实现方式 | 新增 DOM 成本 |
|---|---|---|---|
| **盘面主视觉** | **命运轮盘**：黑金哥特三环（外灰30/中绯红16/内鎏金6 + 中心虹核）；<br>**星愿圣盘**：深空曜紫 + 香槟星轨单环 12 格（6灰/3红/2金/1虹）+ 圣印中心；<br>**暗夜赌场**：欧式黑曜翡翠 37 格（0绿/18红/18黑）+ 外圈金属珠槽 | 合并 `<path>` + `<symbol>/<use>` + 静态蚀刻装饰环 | 35–75 个 SVG 节点（切盘建一次） |
| **旋转物理** | 命运盘三环阶梯差速（4/5/6 圈，`4.8s/5.1s/5.4s`，`cubic-bezier(.12,.78,.04,1)`）；星愿盘单环沉重仪式感（5 圈，`4.6s`）；赌场盘盘面顺时针缓转 + 象牙滚珠逆时针急转落槽（`4.4s`） | 纯 GPU `transform: rotate(...)` | **0** |
| **无指针金光落点** | 命运盘/星愿盘停稳瞬间，中奖扇区亮起暖金脉冲（`hit-wedge` 覆写 `d` 路径）；抽中虹阶 NO.53 时中心虹核触发径向虹光脉冲 | 1 个复用 `<path class="hit-wedge">` + 1 个 `<circle class="core-glow">` | **2 个 SVG 节点** |
| **星轨装饰** | 命运盘与星愿盘外圈蚀刻 12 方位星标与双金环 | 合并为 2 条静态 `<path>`，静止零重绘 | **2 个 SVG 节点** |
| **金箔 / 星尘粒子** | 灰阶 12 颗微尘 / 红阶 20 颗绯焰 / 金阶 30 颗金箔 / 虹阶 36 颗虹光爆发；赌场押中绿格触发翡翠金箔爆发 | 单 `<canvas class="wheel-fx-canvas">` 1.6s 一次性 `rAF` 爆发 | **1 个 Canvas** |
| **开奖卡进出场** | 暗金毛玻璃卡片从底部弹性浮出，按稀有度（gray/red/gold/rainbow）切换边框光晕与顶标色条 | 复用 `<div class="wheel-result">` | **1 个容器** |

---

### 6. 完整代码骨架（可直接施工）

#### 6.1 `host.js` 顶层全屏轮盘托管与 `postMessage` 桥接

```js
// src/runtime/host.js 新增（放在 phone 创建逻辑下方）
const WHEEL_CHANNEL = 'CJ_SHENGHAO_WHEEL_V1';
let wheelFrame = null;
let wheelReady = false;
let wheelOpen = false;
let wheelSpinning = false;
let wheelNonce = '';
let wheelPendingOpen = null;
let savedBodyOverflow = null;

function wheelSnapshot(v = stateView()) {
  const s = v?.state;
  return {
    ready: !!s,
    busy: !!v?.busy,
    lineage: v?.lineage || '',
    revision: s?.meta?.revision ?? 0,
    theme: v?.prefs?.theme || 'sage',
    worldDate: s?.world?.date || '',
    cashCents: s?.user?.cashCents ?? 0,
    tierBasisCents: s ? tierBasis(s) : 0,
    hasWithdrawal: s ? Object.keys(s.withdrawals || {}).length > 0 : false,
    wheel: s?.wheel ? clone(s.wheel) : {},
    wishCards: s ? Object.values(s.inventory || {}).filter((i) => i.category === 'WISH_CARD') : [],
  };
}

function postToWheel(msg) {
  if (!wheelFrame?.contentWindow) return;
  wheelFrame.contentWindow.postMessage({ channel: WHEEL_CHANNEL, nonce: wheelNonce, ...msg }, '*');
}

function lockTopScroll(lock) {
  if (lock) {
    if (savedBodyOverflow === null) savedBodyOverflow = win.document.body.style.overflow;
    win.document.body.style.overflow = 'hidden';
  } else if (savedBodyOverflow !== null) {
    win.document.body.style.overflow = savedBodyOverflow;
    savedBodyOverflow = null;
  }
}

function ensureWheelFrame() {
  if (wheelFrame && wheelFrame.isConnected) return wheelFrame;
  wheelReady = false;
  wheelNonce = crypto.randomUUID();
  wheelFrame = win.document.createElement('iframe');
  wheelFrame.id = 'cj-shenghao-wheel-frame';
  wheelFrame.title = '神豪终端 · 轮盘';
  wheelFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  wheelFrame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;border:0;margin:0;padding:0;background:transparent;z-index:2147482600;display:none;pointer-events:none;';
  wheelFrame.srcdoc = wheelHTML; // 构建时由 wheel-frame.html 内联注入
  win.document.body.append(wheelFrame);
  return wheelFrame;
}

function openWheel(wheelType = 'play', opts = {}) {
  if (disposed) return;
  const frame = ensureWheelFrame();
  wheelOpen = true;
  wheelSpinning = false;
  frame.style.display = 'block';
  frame.style.pointerEvents = 'auto';
  lockTopScroll(true);
  const payload = { wheelType, preselectCardId: opts.cardId || '', view: wheelSnapshot() };
  if (wheelReady) {
    postToWheel({ type: 'WHEEL_OPEN', ...payload });
  } else {
    wheelPendingOpen = payload;
  }
}

function closeWheel(reason = 'USER') {
  if (!wheelOpen) return;
  if (wheelSpinning && reason === 'USER') return;
  wheelOpen = false;
  wheelSpinning = false;
  if (wheelFrame) {
    postToWheel({ type: 'WHEEL_CLOSE', reason });
    wheelFrame.style.display = 'none';
    wheelFrame.style.pointerEvents = 'none';
  }
  lockTopScroll(false);
}

const onWheelMessage = async (event) => {
  if (!wheelFrame || event.source !== wheelFrame.contentWindow) return;
  const data = event.data;
  if (!data || data.channel !== WHEEL_CHANNEL) return;
  if (data.type === 'WHEEL_READY') {
    wheelReady = true;
    const initPayload = wheelPendingOpen || { wheelType: 'play', preselectCardId: '', view: wheelSnapshot() };
    wheelPendingOpen = null;
    postToWheel({ type: 'WHEEL_INIT', ...initPayload });
    return;
  }
  if (data.nonce !== wheelNonce) return;
  if (data.type === 'WHEEL_BUSY_LOCK') {
    wheelSpinning = !!data.spinning;
    return;
  }
  if (data.type === 'WHEEL_CLOSE_REQ') {
    closeWheel('USER');
    return;
  }
  if (data.type === 'WHEEL_OP_REQ') {
    const { reqId, op, lineage } = data;
    try {
      const next = await api.action(op, lineage || stateView().lineage);
      const hist = next?.state?.operationHistory?.[op.operationId];
      postToWheel({
        type: 'WHEEL_OP_RES',
        reqId,
        ok: true,
        result: hist?.result || {},
        view: wheelSnapshot(next),
      });
    } catch (err) {
      postToWheel({
        type: 'WHEEL_OP_RES',
        reqId,
        ok: false,
        errorCode: String(err?.message || 'OP_FAILED'),
        view: wheelSnapshot(),
      });
    }
  }
};

const onTopKeydown = (e) => {
  if (e.key === 'Escape' && wheelOpen && !wheelSpinning) closeWheel('USER');
};

win.addEventListener('message', onWheelMessage);
win.addEventListener('keydown', onTopKeydown, true);
stops.push(() => {
  win.removeEventListener('message', onWheelMessage);
  win.removeEventListener('keydown', onTopKeydown, true);
  closeWheel('DESTROY');
  wheelFrame?.remove();
  wheelFrame = null;
});
// 挂到 api 暴露给手机 iframe
api.openWheel = openWheel;
api.closeWheel = closeWheel;
// 在 publish() 末尾追加：if (wheelOpen && wheelReady) postToWheel({ type: 'WHEEL_STATE_SYNC', view: wheelSnapshot() });
// 在 CHAT_CHANGED 回调内追加：closeWheel('CHAT_CHANGED');
```

#### 6.2 `wheel-frame.html` + `wheel-frame.css`（响应式不裁切 + 性能约束）

```html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; font-family: system-ui, -apple-system, "PingFang SC", sans-serif; color: #ece4d4; user-select: none; }
  .wf-root { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
  .wf-backdrop { position: absolute; inset: 0; background: rgba(8, 7, 12, 0.84); backdrop-filter: blur(4px); }
  .wf-close { position: fixed; top: 14px; right: 16px; z-index: 20; width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(217,184,120,.55); background: rgba(20,16,24,.92); color: #f6e3b0; font-size: 20px; line-height: 1; cursor: pointer; }
  .wf-stage { position: relative; z-index: 10; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 24px; max-width: min(96vw, 960px); max-height: 94dvh; padding: 12px; }
  .wf-left { display: flex; flex-direction: column; align-items: center; gap: 10px; flex-shrink: 0; }
  .wf-modes { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .wf-modes button { font: inherit; font-size: 12px; letter-spacing: .06em; padding: 5px 14px; border-radius: 999px; border: 1px solid rgba(217,184,120,.35); background: rgba(255,255,255,.05); color: #c9bda6; cursor: pointer; }
  .wf-modes button.on { background: linear-gradient(180deg,#f6e3b0,#d9b878); color: #2b1f0c; border-color: #f6e3b0; font-weight: 700; }
  .wf-board { position: relative; width: min(70vmin, 500px); height: min(70vmin, 500px); contain: layout style; }
  .wf-svg, .wf-fx { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .wf-fx { pointer-events: none; }
  .wf-svg .ring.is-spinning { will-change: transform; }
  .wf-svg .hit-wedge { opacity: 0; pointer-events: none; transition: opacity .25s ease; }
  .wf-svg .hit-wedge.on { opacity: 1; }
  .wf-go { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 18%; aspect-ratio: 1; border-radius: 50%; border: 0; cursor: pointer; font: inherit; font-weight: 800; letter-spacing: .1em; font-size: clamp(11px, 1.8vmin, 16px); color: #2b1f0c; background: radial-gradient(circle at 34% 28%,#fff6d8,#e9c986 34%,#b98f45 66%,#6d4f1f); box-shadow: 0 0 0 2px #2a2013, 0 0 0 5px rgba(217,184,120,.5), 0 0 20px rgba(246,227,176,.32); }
  .wf-go:disabled { filter: grayscale(.5) brightness(.78); cursor: default; }
  .wf-side { width: 300px; max-height: 82dvh; overflow-y: auto; flex-shrink: 0; padding: 14px; border-radius: 16px; background: rgba(18, 15, 22, 0.94); border: 1px solid rgba(217,184,120,.34); display: flex; flex-direction: column; gap: 10px; }
  .wf-result { position: fixed; left: 50%; bottom: 20px; z-index: 30; transform: translate(-50%, 16px); width: min(92vw, 420px); padding: 14px 16px; border-radius: 14px; background: linear-gradient(180deg, rgba(32,26,24,.98), rgba(16,13,18,.99)); border: 1px solid rgba(217,184,120,.48); opacity: 0; pointer-events: none; transition: transform .26s ease, opacity .24s ease; }
  .wf-result.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
  .wf-toast { position: fixed; top: 16px; left: 50%; z-index: 40; transform: translateX(-50%); padding: 7px 14px; border-radius: 999px; background: rgba(24,20,28,.95); border: 1px solid rgba(217,184,120,.45); font-size: 12px; color: #f6e3b0; opacity: 0; pointer-events: none; transition: opacity .2s; }
  .wf-toast.on { opacity: 1; }
  @media (max-width: 860px) {
    .wf-backdrop { backdrop-filter: none; }
    .wf-stage { flex-direction: column; justify-content: flex-start; gap: 10px; width: 100%; height: 100dvh; max-height: 100dvh; padding: 50px 10px 14px; }
    .wf-board { width: min(82vw, 42dvh, 340px); height: min(82vw, 42dvh, 340px); }
    .wf-side { width: min(94vw, 420px); flex: 1 1 auto; max-height: 38dvh; }
  }
</style>
</head>
<body>
  <div class="wf-root" id="wfRoot">
    <div class="wf-backdrop" data-close></div>
    <button class="wf-close" data-close aria-label="关闭轮盘">×</button>
    <div class="wf-stage">
      <div class="wf-left">
        <div class="wf-modes" id="wfModes"></div>
        <div class="wf-board">
          <svg viewBox="0 0 640 640" class="wf-svg" id="wfSvg"></svg>
          <canvas class="wf-fx" id="wfFx" width="640" height="640"></canvas>
          <button class="wf-go" id="wfGo" data-go>GO</button>
        </div>
      </div>
      <aside class="wf-side" id="wfSide"></aside>
    </div>
    <div class="wf-result" id="wfResult"></div>
    <div class="wf-toast" id="wfToast"></div>
  </div>
  <script type="module" src="./wheel-frame.js"></script>
</body>
</html>
```

#### 6.3 `wheel-frame.js` 桥接、合并扇区与单次粒子核心骨架

```js
// src/ui/wheel-frame.js 核心骨架（精简示意，DSH 补全三盘侧栏渲染与文案引用）
const CHANNEL = 'CJ_SHENGHAO_WHEEL_V1';
const OP_TIMEOUT_MS = 12000;
let nonce = '';
let wheelType = 'play';
let view = null;
let pendingView = null;
let spinning = false;
let builtType = '';
let selectedPayMode = 'auto'; // play: 'auto'|'points'
let selectedCardId = '';
let selectedBet = '';
let lastWonCardId = ''; // 修复赌场收手兑换 P0：独立保存本次押中卡 ID
const inflight = new Map();

function send(msg) {
  window.parent.postMessage({ channel: CHANNEL, nonce, ...msg }, '*');
}

function requestOp(op) {
  return new Promise((resolve, reject) => {
    const reqId = crypto.randomUUID();
    const timer = setTimeout(() => {
      inflight.delete(reqId);
      reject(new Error('WHEEL_BRIDGE_TIMEOUT'));
    }, OP_TIMEOUT_MS);
    inflight.set(reqId, { resolve, reject, timer });
    send({
      type: 'WHEEL_OP_REQ',
      reqId,
      op: { ...op, operationId: crypto.randomUUID(), expectedRevision: view?.revision ?? 0 },
      lineage: view?.lineage || '',
    });
  });
}

function setSpinning(flag) {
  spinning = flag;
  send({ type: 'WHEEL_BUSY_LOCK', spinning });
}

// 扇区合并工具：同一环内偶数格 / 奇数格各拼成一条 path 的 d 字符串，52 格仅 6 条 path
function mergedRingPaths(r1, r2, count, fillA, fillB) {
  let dA = '', dB = '', dSep = '';
  const step = 360 / count;
  for (let i = 0; i < count; i++) {
    const seg = sector(r1, r2, i * step, (i + 1) * step);
    if (i % 2 === 0) dA += seg; else dB += seg;
    const [x0, y0] = polar(r1, i * step);
    const [x1, y1] = polar(r2, i * step);
    dSep += `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return `<path d="${dA}" fill="${fillA}"/><path d="${dB}" fill="${fillB}"/><path d="${dSep}" fill="none" stroke="rgba(217,184,120,.24)" stroke-width=".9"/>`;
}

// 一次性粒子爆发（1.6s 后自动停 rAF，空闲 0 CPU）
function burstParticles(rarity) {
  const canvas = document.getElementById('wfFx');
  const ctx = canvas.getContext('2d');
  const count = { gray: 12, red: 20, gold: 30, rainbow: 36 }[rarity] || 16;
  const palette = {
    gray: ['#d4dae6', '#9aa3b5'],
    red: ['#ff8fa3', '#ffd1d8', '#f6e3b0'],
    gold: ['#fff0be', '#f6e3b0', '#d9b878'],
    rainbow: ['#fff0be', '#e0b3ff', '#8ef6e4', '#ff9ebc'],
  }[rarity] || ['#f6e3b0'];
  const pts = Array.from({ length: count }, (_, i) => {
    const a = (Math.PI * 2 * i) / count + (i % 3) * 0.14;
    const v = 2.2 + (i % 5) * 0.9;
    return { x: 320, y: 320, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + (i % 3), c: palette[i % palette.length], life: 1 };
  });
  const t0 = performance.now();
  function tick(now) {
    const elapsed = now - t0;
    ctx.clearRect(0, 0, 640, 640);
    if (elapsed > 1600) return; // 硬停帧，空闲 0 CPU
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.975; p.vy *= 0.975;
      p.life = Math.max(0, 1 - elapsed / 1600);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  const data = event.data;
  if (!data || data.channel !== CHANNEL) return;
  if (data.type === 'WHEEL_INIT' || data.type === 'WHEEL_OPEN') {
    if (data.type === 'WHEEL_INIT') nonce = data.nonce;
    if (data.nonce !== nonce) return;
    wheelType = data.wheelType || 'play';
    selectedCardId = data.preselectCardId || '';
    selectedBet = '';
    lastWonCardId = '';
    view = data.view;
    pendingView = null;
    ensureBoardBuilt(wheelType); // 仅切盘时构建 SVG
    renderSideAndControls();
    return;
  }
  if (data.nonce !== nonce) return;
  if (data.type === 'WHEEL_STATE_SYNC') {
    if (spinning) { pendingView = data.view; return; }
    view = data.view;
    renderSideAndControls(); // 不重建 SVG
    return;
  }
  if (data.type === 'WHEEL_OP_RES') {
    const entry = inflight.get(data.reqId);
    if (!entry) return;
    clearTimeout(entry.timer);
    inflight.delete(data.reqId);
    if (data.view) {
      if (spinning) pendingView = data.view; else view = data.view;
    }
    if (data.ok) entry.resolve(data);
    else entry.reject(new Error(data.errorCode || 'OP_FAILED'));
    return;
  }
  if (data.type === 'WHEEL_CLOSE') {
    setSpinning(false);
    document.getElementById('wfResult').classList.remove('on');
  }
});

window.parent.postMessage({ channel: CHANNEL, type: 'WHEEL_READY' }, '*');
```

---

## C 三盘经济设计

### 1. 三盘总览对照表

| 维度 | 一、命运轮盘（玩法轮盘） | 二、星愿圣盘（星愿轮盘） | 三、暗夜赌场（赌场轮盘） |
|---|---|---|---|
| **定位** | 便宜、高频、日常趣味奇遇 | 限制多、极贵、星愿卡唯一造血源 | 37 格高风险倍增器 |
| **入口条件** | 无门槛，开局即开 | **计级身家 ≥ ¥1,000,000** 或 **累计已提现 ≥ 1 笔**（脚本实时判定） | 背包持有 ≥ 1 张星愿卡（无卡可进盘看规则，不可开转） |
| **免费次数** | **每日首次免费**（1 次/日） | **每周首次免费**（1 次/周，按 ISO 周一刷新；仍需已解锁） | 无 |
| **单次成本** | **现金**：轻阶梯 `0.1% / 0.2% / 0.3% / 0.5% / 0.8% / 1.0% / 1.2% / 1.5%`（基数 `tierBasis`，下限 **¥500**，硬封顶 **¥50,000**）；<br>**积分**：**120 星愿积分/次**（可随时切换） | **仅限现金**（不可用积分买）：承接原重资产阶梯 **`2% / 4% / 8% / 12% / 18%`**（基数 `tierBasis`，底价 **¥200,000**，无封顶） | **仅限星愿卡**（整张卡当前价值梭哈，不可用现金/积分） |
| **每日 / 每周上限** | 每日：免费 1 次 + 现金 8 次 + 积分不限；每周无硬顶 | **每日上限 2 次**（含免费）；**每周付费上限 5 次**（+1 次免费，每周总计最多 6 次）；**严禁连抽/十连** | 不设局数上限（受卡牌存量与销毁风险自然约束） |
| **奖池内容** | 仅 53 条玩法（`WHEEL_POOL`） | 仅四档星愿卡（灰 20 / 红 60 / 金 200 / 虹 800 基础分） | 37 格（0 绿 ×36、18 红 ×2、18 黑 ×2） |
| **概率与保底** | 权重 `14400 / 4400 / 1100 / 100`；保底 `10 红+ / 30 金+ / 60 虹`（未解锁 TOY·LINK 时 60 必出） | 权重 `700 / 220 / 70 / 10`（70% / 22% / 7% / 1%）；保底 **`10 红+ / 30 金+`** | 红 `18/37`、黑 `18/37`、绿 `1/37`；无保底 |
| **产出与风险** | `WHEEL_PRIZE` 玩法券进背包；抽中 `w53` 解锁 `toyLinkUnlocked` | `WISH_CARD` 星愿卡进背包（可直兑积分或进赌场加押） | 押中原卡积分翻倍并累加 `winStreak`（不设连赢上限）；**押错整张卡连同累积价值彻底销毁** |

### 2. 经济取舍与已确认规则承接说明

1. **已确认的 `2% / 4% / 8% / 12% / 18%` 现金阶梯**：原挂在玩法轮盘上导致亿万身家转一次普通玩法要花千万，违背 YG「玩法轮盘不要贵」的要求。本方案**100% 保留该阶梯数值不推翻，将其从玩法轮盘迁移承接到星愿圣盘**（按周计次、底价 20 万、无封顶），同时为玩法轮盘配置「0.1%–1.5%、单次 500 元起、最高 5 万元封顶」的亲民轻阶梯。
2. **经济闭环**：
   `重金现金` → **星愿圣盘**（受门槛 + 日限 2 + 周限 5 约束）→ `星愿卡（20/60/200/800 分）` → ① 直接在背包兑换 `星愿积分`，或 ② 带入 **暗夜赌场** 押红/黑/绿搏翻倍（输则销毁）→ `星愿积分` → **星愿商城**（14 异能 Lv1–3 / 16 奇物 / 3600 分直兑 TOY·LINK）或以 `120 分/次` 反哺玩法轮盘。
3. **原「背包里每日领免费星愿卡」下线**：统一收口至星愿圣盘，彻底消除白嫖膨胀风险。
4. **对已有存档字段的影响**：未向玩家正式发行，直接移除 `s.wheel.lastFreeCardDate`，新增星愿盘周/日字段与赌场统计字段，不写旧存档兼容层。

### 3. 状态树字段完整定义（挂在 `s.wheel` 下）

```js
// src/runtime/schema.js 默认值定义（s.wheel）
export function defaultWheelState() {
  return {
    // ---- 公共货币与解锁 ----
    starPoints: 0,              // number >= 0，星愿积分余额
    toyLinkUnlocked: false,     // boolean，是否已解锁 TOY·LINK
    unlockedSecretPages: [],    // string[]，已用窥心镜解锁的女性 ID
    shopHistory: [],            // { purchaseId, catalogId, costPoints, date }[]

    // ---- 一、命运轮盘（玩法轮盘）----
    lastFreeDate: '',           // string YYYY-MM-DD，玩法盘上次免费日期
    todayPaidDate: '',          // string YYYY-MM-DD，玩法盘现金计数日期
    todayPaidSpins: 0,          // number 0..8，玩法盘今日已付现金次数
    totalSpins: 0,              // number >= 0，玩法盘累计总抽数
    pityRed: 0,                 // number 0..9
    pityGold: 0,                // number 0..29
    pityRainbow: 0,             // number 0..59
    discoveredPrizeIds: [],     // string[]，已抽中过的玩法 ID 图鉴

    // ---- 二、星愿圣盘（星愿轮盘，新增，取代旧 lastFreeCardDate）----
    wishWeekKey: '',            // string YYYY-Www，脚本由 world.date 推算
    wishWeekFreeUsed: false,    // boolean，本周免费 1 次是否已用
    wishWeekPaidSpins: 0,       // number 0..5，本周现金付费次数（对应 2/4/8/12/18%）
    wishTodayDate: '',          // string YYYY-MM-DD，星愿盘当日计数日期
    wishTodaySpins: 0,          // number 0..2，星愿盘今日总抽数（含免费）
    totalCardsDrawn: 0,         // number >= 0，星愿卡累计抽数
    cardPityRed: 0,             // number 0..9（10 抽必出红+）
    cardPityGold: 0,            // number 0..29（30 抽必出金+，新增）

    // ---- 三、暗夜赌场（赌场轮盘）----
    casinoRound: 0,             // number >= 0，累计总局数（参与种子）
    casinoTotalWins: 0,         // number >= 0，累计胜场
    casinoTotalLosses: 0,       // number >= 0，累计负场
    casinoBestWinPoints: 0,     // number >= 0，单卡历史最高积分
  };
}
```

### 4. 脚本兜底与引擎核心伪代码（绝不依赖大模型写字段）

```js
// src/core/wheel.js & src/core/casino.js 纯计算层
export const PLAY_DAILY_CASH_LIMIT = 8;
export const PLAY_CASH_RATES = [0.001, 0.002, 0.003, 0.005, 0.008, 0.01, 0.012, 0.015];
export const PLAY_CASH_MIN_CENTS = 50000;      // ¥500
export const PLAY_CASH_CAP_CENTS = 5000000;    // ¥50,000

export const WISH_UNLOCK_BASIS_CENTS = 100000000; // ¥1,000,000
export const WISH_DAILY_LIMIT = 2;
export const WISH_WEEKLY_PAID_LIMIT = 5;
export const WISH_CASH_RATES = [0.02, 0.04, 0.08, 0.12, 0.18];
export const WISH_CASH_MIN_CENTS = 20000000;   // ¥200,000
export const CARD_PITY_GOLD = 30;

// 脚本根据 world.date 确定性推算 ISO 周键 YYYY-Www
export function isoWeekKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '2026-W01';
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// 玩法轮盘实时报价
export function playWheelQuote(wheel, worldDate, tierBasisCents) {
  const w = wheel || {};
  const free = w.lastFreeDate !== worldDate;
  const paidToday = w.todayPaidDate === worldDate ? (Number(w.todayPaidSpins) || 0) : 0;
  const canCash = paidToday < PLAY_DAILY_CASH_LIMIT;
  const rate = PLAY_CASH_RATES[Math.min(paidToday, PLAY_CASH_RATES.length - 1)];
  const rawCents = Math.round(((Number(tierBasisCents) || 0) * rate) / 100) * 100;
  const costCents = Math.min(PLAY_CASH_CAP_CENTS, Math.max(PLAY_CASH_MIN_CENTS, rawCents));
  return {
    freeAvailable: free,
    cashAvailable: canCash,
    defaultMode: free ? 'free' : (canCash ? 'cash' : 'points'),
    costCents,
    costPoints: POINTS_PER_SPIN, // 120
    paidToday,
    paidLimit: PLAY_DAILY_CASH_LIMIT,
  };
}

// 星愿圣盘解锁与实时报价（全部脚本推算）
export function wishWheelQuote(wheel, worldDate, tierBasisCents, hasWithdrawal) {
  const w = wheel || {};
  const unlocked = (Number(tierBasisCents) || 0) >= WISH_UNLOCK_BASIS_CENTS || !!hasWithdrawal;
  const weekKey = isoWeekKey(worldDate);
  const sameWeek = w.wishWeekKey === weekKey;
  const weekFreeUsed = sameWeek ? !!w.wishWeekFreeUsed : false;
  const weekPaid = sameWeek ? (Number(w.wishWeekPaidSpins) || 0) : 0;
  const todaySpins = w.wishTodayDate === worldDate ? (Number(w.wishTodaySpins) || 0) : 0;
  if (!unlocked) return { unlocked: false, reason: 'WISH_LOCKED', weekKey, todaySpins, weekPaid };
  if (todaySpins >= WISH_DAILY_LIMIT) return { unlocked: true, canSpin: false, reason: 'WISH_DAILY_LIMIT', weekKey, todaySpins, weekPaid, weekFreeUsed };
  if (!weekFreeUsed) return { unlocked: true, canSpin: true, mode: 'free', costCents: 0, rate: 0, weekKey, todaySpins, weekPaid, weekFreeUsed };
  if (weekPaid >= WISH_WEEKLY_PAID_LIMIT) return { unlocked: true, canSpin: false, reason: 'WISH_WEEKLY_LIMIT', weekKey, todaySpins, weekPaid, weekFreeUsed };
  const rate = WISH_CASH_RATES[weekPaid];
  const rawCents = Math.round(((Number(tierBasisCents) || 0) * rate) / 100) * 100;
  const costCents = Math.max(WISH_CASH_MIN_CENTS, rawCents);
  return { unlocked: true, canSpin: true, mode: 'cash', costCents, rate, weekKey, todaySpins, weekPaid, weekFreeUsed };
}

// engine.js: PLAYER_CARD_DRAW 升级为星愿圣盘结算
// 1. 校验 q = wishWheelQuote(w, s.world.date, tierBasis(s), Object.keys(s.withdrawals || {}).length > 0)
// 2. requireRule(q.unlocked, 'WISH_LOCKED'); requireRule(q.canSpin, q.reason);
// 3. 若 q.mode === 'cash'：requireRule(s.user.cashCents >= q.costCents, 'INSUFFICIENT_CASH'); 扣现金 + 写 addLedger(kind:'WISH_WHEEL_SPIN', memo:'星愿圣盘 · 抽卡')
// 4. 更新周/日计数（跨周自动重置 wishWeekKey/wishWeekFreeUsed/wishWeekPaidSpins；跨日重置 wishTodayDate/wishTodaySpins）
// 5. rollWishCard({ seed, cardPityRed: w.cardPityRed || 0, cardPityGold: w.cardPityGold || 0 })（新增 30 抽金+保底）
// 6. 写入 s.inventory[itemId]（category:'WISH_CARD'），返回 { itemId, rarity, points, mode: q.mode, costCents: q.costCents }

// engine.js: PLAYER_CASINO_BET 同步更新战绩
// 胜：w.casinoTotalWins = (w.casinoTotalWins || 0) + 1; w.casinoBestWinPoints = Math.max(w.casinoBestWinPoints || 0, r.nextPoints);
// 负：w.casinoTotalLosses = (w.casinoTotalLosses || 0) + 1;
```

---

## D 五页导航

### 1. 五项导航固定顺序与图标

`const TABS = [['scene', '⌂', '此刻'], ['women', '♡', '她们'], ['mine', '▣', '我的'], ['wealth', '◈', '财富'], ['wheel', '✦', '轮盘']];`

### 2. 各页区块清单与迁移结论

| Tab ID | 标题 | 区块清单（自上而下） | 变更说明 |
|---|---|---|---|
| `scene` | **此刻** | 1. 顶部时间/地点/天气卡（含「日历」入口）<br>2. 在场人物卡片<br>3. 特别关注 · 异地实况折叠卡<br>4. 临时人物卡片 | 无结构变动 |
| `women` | **她们** | 1. 已收录女性列表（含好感/堕落进度条与奖池额）<br>2. 点击进入人物详情 `detail` | 无结构变动 |
| `mine` | **我的** | 1. **主角个人名片卡**（头像、姓名年龄、财富阶梯徽章、个人标签、身高/体重/鞋码、颜值魅力、床笫战力、性器规格、外貌气质、身材体态）<br>2. **⚡ 主角异能栏**（展示已觉醒异能胶囊与等级；空态提供「前往星愿商城」快捷按钮跳转至轮盘页） | **删除**：原财富总览、累计收支、持有资产、收支明细、背包/商城双入口。<br>「我的」页彻底回归纯粹个人档案与自身能力 |
| `wealth` | **财富** | 1. **财富总览池**（总资产估值、可用现金、持有资产、当前财富阶梯徽章）<br>2. **累计收支卡**（累计收入、累计支出、统计口径说明）<br>3. **持有资产**（分类筛选 tabs + 资产列表，默认展开）<br>4. **收支明细**（最近 100 笔流水，保留折叠） | **新增独立页**，完整承接原「我的」页下半部分 |
| `wheel` | **轮盘** | 1. **星愿资产与门户条**：左侧显示 `✦ 星愿积分` + `🃏 持有星愿卡数`；下方并排 **`我的背包`**（`data-act="open-bag"`）与 **`星愿商城`**（`data-act="open-shop"`）双门户卡<br>2. **三盘独立入口卡**（悬浮竖排 / 宽屏底部停靠 3 列横排）：<br>　- **卡 1 · 命运轮盘**：53 格奇遇玩法 · 实时报价徽章（今日免费 / 下抽 ¥X / 120 积分）· 今日现金 `x/8` 与三档保底进度 · `data-open-wheel="play"`<br>　- **卡 2 · 星愿圣盘**：高阶星愿卡专属 · 解锁/限次/报价徽章 · 今日 `x/2`、本周付费 `y/5`、保底进度 · `data-open-wheel="wish"`<br>　- **卡 3 · 暗夜赌场**：37 格押注翻倍 · 持有星愿卡徽章 · 历史胜负与最高单卡分 · `data-open-wheel="casino"`<br>3. **TOY·LINK 快捷横幅**（仅 `toyLinkUnlocked === true` 时显示） | **明确结论**：**背包、商城挪至「轮盘」页**，与三盘形成「抽 → 赌 → 兑 → 买」单页闭环；**异能栏留在「我的」页**（属于主角个人属性） |

### 3. 日历页与 `app.js` 状态机改造

- **日历页（`screens.js:120`）**：删除 `<button class="wheel-entry" data-act="open-wheel">...</button>`，顶部保留 `我的日历` + `返回此刻`（`data-act="close-calendar"`）。日历仍只从「此刻」页日期卡进入。
- **`app.js` 状态机**：
  - `tab` 合法值：`'scene' | 'women' | 'mine' | 'wealth' | 'wheel'`。
  - `title` 映射：`{ scene: '此刻', women: '她们', mine: '我的', wealth: '财富', wheel: '轮盘' }[tab]`（`calendarOpen` / `hidden` / `settings` / `detail` 优先级不变）。
  - `body` 分发新增 `tab === 'wealth' ? screens.wealth() : screens.wheel()`。
  - 点击任意底部 Tab（`d.tab`）统一重置 `calendarOpen = false; detail = null; settings = false; hidden = false;`。
  - 新增点击分发：`if (d.openWheel) { api.openWheel(d.openWheel, { cardId: d.cardId || '' }); return; }`。
  - 背包弹窗（`bagModal()`）：
    - 移除底部的 `data-draw-card` 按钮；
    - `WISH_CARD` 行同时提供 **`去赌场加押`**（`data-open-wheel="casino" data-card-id="..."`，点击后先 `closeModal()` 再开赌场并自动预选该卡）与 **`立即兑换`**（`data-redeem-card`）；
    - `WHEEL_PRIZE` 行仅展示编号、名称、简介与状态，**不再挂「去赌场加押」按钮**。
  - 商城弹窗（`shopModal()`）：
    - 每行右侧渲染真正可点击的 `<button class="mini-btn" data-shop-buy="...">`；
    - 不可升级且已觉醒异能显示禁用态 `已觉醒`；可升级已满 Lv.3 显示禁用态 `已满阶`；可进阶异能正确调用 `upgradeCost(a, lv)` 显示进阶价。

### 4. 五项导航 CSS 关键值（365px 窄屏 + 底部宽屏）

365px 宽度下 5 格平均每格 71px（扣 4px 两侧内边距），2 字标签仅宽 ~21px，空间充裕不折行。

```css
/* 365px 悬浮小手机底部 5-Tab 导航 */
.phone .bottom {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;
  padding: 6px 4px 8px;
}
.phone .tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  padding: 4px 2px;
  font-size: calc(10px * var(--cj-font-scale, 1));
  line-height: 1.2;
  white-space: nowrap;
}
.phone .tab .i {
  font-size: calc(15px * var(--cj-font-scale, 1));
  line-height: 1.1;
}

/* 固定正文底部宽屏模式：顶栏 5 枚胶囊导航 */
.phone.is-bottom-dock .wide-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex-wrap: wrap;
  margin: 0 auto;
}
.phone.is-bottom-dock .wide-tab {
  padding: 4px 10px;
  font-size: calc(11.5px * var(--cj-font-scale, 1));
  white-space: nowrap;
}

/* 轮盘页三盘入口卡布局（窄屏竖排，底部宽屏三列横排） */
.wheel-hub-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 9px; margin-bottom: 12px; }
@media (min-width: 600px) {
  .phone.is-bottom-dock .wheel-hub-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
```

---

## E 施工步骤与验收

### 1. 分步施工顺序

| 步骤 | 改动范围（文件） | 新增/更新测试 | 验证方式 |
|---|---|---|---|
| **Step 1 · 核心经济与缺陷修复** | `src/core/wheel.js`、`src/core/casino.js`、`src/core/engine.js`、`src/runtime/schema.js`（新增 `isoWeekKey` / `playWheelQuote` / `wishWheelQuote`、星愿盘 30 抽金+保底、赌场战绩计数、修 `SURREAL_ITEM_BY_ID[i.refId]` 与 `discoveredPrizeIds` 兜底；同步接入 4 个数值型异能加成） | `tests/rc36-three-wheels.test.mjs`；更新 `tests/rc35-casino-math.test.mjs`、`tests/rc35-casino-ops.test.mjs` | `npm test` 全绿 |
| **Step 2 · 文案定稿生成** | 写提取脚本从本方案 F 节 `text` 块逐字生成 `src/core/wheel-ui-copy.js`（并同步 `CASINO_UI` 相关字段） | 校验脚本断言字面 100% 一致 | 生成后 `git diff` 零手改 |
| **Step 3 · 独立全屏轮盘前端** | 新建 `src/ui/wheel-frame.html`、`src/ui/wheel-frame.js`（合并 `<path>` + `<symbol>/<use>` + Canvas 粒子 + 响应式布局 + `postMessage` 协议 + 修虹核 NO.53 高亮、赌场收手兑换、绿格文案、支付模式切换）；移除旧 `src/ui/wheel-overlay.js` 与 `style.css` 旧浮层规则；更新构建脚本打包内联 `wheelHTML` | 静态断言 `wheel-frame` 节点数预算与 `postMessage` 协议单测 | 本地静态预览 + `npm test` |
| **Step 4 · `host.js` 顶层托管** | `src/runtime/host.js`（新增 `#cj-shenghao-wheel-frame` 懒创建、`api.openWheel` / `api.closeWheel`、`WHEEL_*` 桥接、滚动锁、`Esc` 拦截、`CHAT_CHANGED` 强关、`destroy()` 清理） | 桥接消息与并发锁单测 | `npm test` |
| **Step 5 · 五页导航与弹窗修复** | `src/ui/app.js`、`src/ui/screens.js`、`src/ui/style.css`（5-Tab 导航、`wealth` 与 `wheel` 两页独立、日历删轮盘入口、我的页删财富与门户、修 `shopModal` 缺按钮与 `bagModal` 按钮错位） | UI 渲染结构单测（断言 5 个 Tab、财富页/轮盘页元素、商城 `data-shop-buy` 存在） | `npm test` |
| **Step 6 · 契约与构建** | `project.json` 升 `2.0.0-rc.36`，`cardContractRevision` 升 **`31`** | — | `npm run build -- --checkpoint` + `npm run check -- --checkpoint` 全绿，核对产物体积 `< 3 MB` |
| **Step 7 · 8001 实机验收** | 导入 `dist/2.0.0-rc.36-checkpoint/神豪终端.json` 到 8001 | 按下方实机清单逐项点击 + 截图 | 全部通过且截图无 `PageUnresponsive` |

### 2. 实机验收清单（8001）

1. **五页导航（悬浮小手机 365px + 固定正文底部宽屏）**
   - 点底栏/顶栏：顺序严格为 `此刻 / 她们 / 我的 / 财富 / 轮盘`，5 格不折行、不溢出。
   - 点「我的」：仅剩个人名片 + 异能栏，无财富、无背包/商城、无轮盘入口。
   - 点「财富」：完整显示总资产、可用现金、持有资产（分类筛选正常）、收支明细。
   - 点「此刻 → 日期卡 → 日历」：日历顶部无轮盘入口，点「返回此刻」回到此刻页。
   - 点「轮盘」：顶部显示星愿积分 + 星愿卡数 + 背包/商城双入口；下方三张独立入口卡（命运轮盘 / 星愿圣盘 / 暗夜赌场）信息准确。
2. **真全屏弹出与布局（悬浮态 + 底部停靠折叠态/展开态 + 窄屏 375px）**
   - 分别从悬浮模式和底部停靠模式点击三盘入口：轮盘均以 `100vw×100dvh` 盖住整个酒馆页面（含顶栏、正文、输入栏与小手机）。
   - 桌面宽屏下赌场右侧下注台完整居中不裁切；375px 竖屏下下注台落在盘面下方完整可滚可点。
   - 静止态与落定后截图 3 次：均在 2 秒内出图，**零 `PageUnresponsive`**。
   - 旋转中按 `Esc` / 点遮罩：被拦截并提示「转盘转动中，请等待落定」；落定后按 `Esc` / 点 `×` / 点遮罩：正常关闭并恢复小手机原位与正文滚动。
3. **三盘核心流程与修复项实机点通**
   - **命运轮盘**：首次免费 1 抽 → 第 2 抽显示轻阶梯现金价（500–50,000 元）→ 可切「120 星愿积分」支付 → 旋转落定有金光高亮 + 粒子 + 结果卡；奖品入背包。
   - **星愿圣盘**：身家不足百万且未提现时显示锁定提示不可转；达标后本周免费 1 抽 → 再抽按 `2%`（底价 20 万）扣现金 → 今日第 3 抽被拦（`今日已达 2 次上限`）；背包出现星愿卡。
   - **暗夜赌场**：背包点星愿卡「去赌场加押」直达赌场并自动预选该卡 → 选红/黑/绿 → GO 亮起 → 旋转落定：
     - 押中：点「继续加押」正常连押；点「收手兑换」积分真实入账、卡牌消失；
     - 押错：卡牌销毁、侧栏刷新。
   - **星愿商城**：点任意异能/奇物按钮可真实扣分购买；已觉醒不可升级异能变灰显示「已觉醒」；可升级异能显示正确进阶价且可升至 Lv.2 / Lv.3。
4. **并发与切聊天**
   - 轮盘打开状态下切聊天：轮盘自动关闭并恢复滚动。
   - 正文生成中：轮盘 GO 按钮自动灰置并提示「正文生成中，请稍候…」。

### 3. 风险与回滚点

- **风险 1：`srcdoc` iframe 在不同浏览器下 `event.origin` 为 `'null'`**：已规避——协议以 `event.source === wheelFrame.contentWindow` + `CHANNEL` + 随机 `nonce` 做三重校验，不依赖 `event.origin` 字符串匹配。
- **风险 2：酒馆外层容器有 `overflow: hidden` 或自定义滚动容器 `#chat`**：打开时同时锁 `win.document.body.style.overflow` 与关闭时原样还原；全屏层 `position: fixed; inset: 0` 独立吃掉所有滚轮/触控事件，即使 `#chat` 存在也不会穿透滚动。
- **风险 3：包体大小**：`wheel-frame.html` 合并路径 + `<symbol>` 复用后内联体积预计 ~25 KB，当前卡体 1,608 KB，合计仍远低于 3 MB 上限。
- **回滚点**：Step 1–5 均在独立分支/提交推进；若全屏 iframe 在特定移动端浏览器出现异常，可单步回滚 Step 3–4 并保留 Step 1（三盘经济）与 Step 5（五页导航），零数据损失。

---

## F 文案定稿

> **执行指令**：以下 ```` ```text ```` 代码块为 100% 最终定稿，**DSH 必须由脚本逐字提取写入源码，严禁改动任何一个字或标点**。格式为 `[section]` + `key = value`，占位符 `{...}` 原样保留供运行时替换。

```text
[nav]
scene = 此刻
women = 她们
mine = 我的
wealth = 财富
wheel = 轮盘

[wheels.names]
play = 命运轮盘
wish = 星愿圣盘
casino = 暗夜赌场

[wheels.hub]
title = 命运与星愿
sub = 奇遇、筹码与超凡奇物，尽在于此
pointsLabel = 星愿积分
cardsLabel = 持有星愿卡
bagTitle = 我的背包
bagSub = 玩法券 · 星愿卡 · 超现实奇物
shopTitle = 星愿商城
shopSub = 异能觉醒 · 奇物兑换 · 终极大奖
toylinkBannerTitle = TOY·LINK 终端控制模块已就绪
toylinkBannerSub = 终极权限已激活，随时可呼出实体遥控器
toylinkBannerBtn = 呼出终端

[wheels.cards.play]
title = 命运轮盘
sub = 53 格云澜奇遇 · 每日首抽免费，轻装畅转
badgeFree = 今日免费
badgeCash = 现金 {price}
badgePoints = {points} 星愿积分
metaLine = 今日现金 {paid}/{limit} · 保底 红 {pRed}/10 · 金 {pGold}/30 · 虹 {pRainbow}/60
cta = 开启命运轮盘

[wheels.cards.wish]
title = 星愿圣盘
sub = 高阶星愿卡专属 · 重金启封，限量流通
badgeLocked = 尚未解锁
badgeFree = 本周免费
badgeCash = 现金 {price}（{rate}%）
badgeDailyFull = 今日已满 {used}/{limit}
badgeWeeklyFull = 本周已满 {used}/{limit}
metaLine = 今日 {today}/{todayLimit} · 本周付费 {week}/{weekLimit} · 保底 红 {pRed}/10 · 金 {pGold}/30
lockHint = 计级身家满 100 万，或完成任意 1 笔提现后解锁
cta = 开启星愿圣盘
ctaLocked = 暂未满足门槛

[wheels.cards.casino]
title = 暗夜赌场
sub = 37 格欧式轮盘 · 押中翻倍，押错整张销毁
badgeReady = 可押 {count} 张卡
badgeEmpty = 暂无星愿卡
metaLine = 历史 {wins} 胜 {losses} 负 · 单卡最高 {best} 分
cta = 步入暗夜赌场

[overlay.common]
closeLabel = 关闭轮盘
goReady = GO
goSpinning = 转动中…
goBusy = 生成中
busyBanner = 正文正在生成，请等待本轮落定后再转动。
spinningCloseGuard = 转盘转动中，请等待落定后再关闭。
staleRefreshHint = 终端状态已同步，请再点一次。
timeoutError = 轮盘响应超时，请稍后再试。

[overlay.play]
sideTitle = ✦ 命运轮盘 · 53 格奇遇
payModeCash = 现金转盘（{price}）
payModePoints = 积分转盘（{points} 分）
payModeFree = 今日免费（0 元）
ruleText = 每日首次免费；之后现金单次 {minPrice} 起、最高 {capPrice} 封顶（每日限 {limit} 次），或随时消耗 {points} 星愿积分转动。保底：10 抽必出红+，30 抽必出金+，60 抽必出虹阶终极大奖。
resultCollect = 收入背包
resultAgain = 再转一次

[overlay.wish]
sideTitle = ✧ 星愿圣盘 · 四档星愿卡
costFree = 本周礼遇免费（计入今日次数）
costCash = 本次消耗现金 {price}（身家阶梯 {rate}%）
ruleText = 仅产出灰（20分）/红（60分）/金（200分）/虹（800分）四档星愿卡。每周 1 次免费、每日限 2 次、每周付费限 5 次（按 2%/4%/8%/12%/18% 阶梯递增，底价 20 万，不支持连抽与积分购买）。保底：10 抽必出红+，30 抽必出金+。
lockedText = 星愿圣盘尚未启封。计级身家达到 100 万元，或完成任意 1 笔人物奖池提现后自动解锁。
dailyFullText = 今日星愿圣盘已达 2 次上限，请明日再来。
weeklyFullText = 本周星愿圣盘付费额度（5/5）已用尽，下周一刷新。
resultTitle = 圣盘赐卡
resultTip = 获得【{cardName}】，基础价值 {points} 星愿积分。可直接兑换，或带入暗夜赌场押注翻倍。
resultGoCasino = 去赌场加押
resultRedeem = 立即兑换
resultKeep = 存入背包

[overlay.casino]
sideTitle = ❖ 暗夜赌场 · 37 格押注台
selectBetLabel = 第一步：选择押注色区
selectCardLabel = 第二步：押上星愿卡（整张梭哈）
noCardHint = 背包里还没有星愿卡，先去「星愿圣盘」抽一张再来。
goIdle = 请先选区放卡
ruleText = 押中即原卡价值翻倍（绯红/黑曜 ×2，翡翠 ×36），可一路连赌不设上限；押错则整张卡连同累积价值彻底销毁。
winTitle = 押中翻倍
winGreenTitle = 翡翠圣格 · ×36 暴涨
winNormal = 押中翻倍！卡牌价值跃升至 {value} 星愿积分。继续加押，还是立刻收手兑换？
winGreen = 翡翠圣格命中 · ×36 暴涨！卡牌价值飙升至 {value} 星愿积分！
loseTitle = 满盘皆输
lose = 满盘皆输。价值 {value} 分的星愿卡已被暗夜彻底吞噬。
btnAgain = 继续加押
btnCashOut = 收手兑换
btnNextCard = 再选一张
cashOutOk = 落袋为安，已兑换 +{value} 星愿积分。

[bag]
emptyHint = 背包还空着。去「轮盘」页转一局奇遇，或到「星愿商城」挑件稀罕物。
btnGoBet = 去赌场加押
btnRedeem = 立即兑换
statusReady = 待使用
statusScheduled = 已排期
statusUsed = 已使用

[shop]
btnBuy = ✦ {price} 兑换
btnUpgrade = ✦ {price} 进阶
btnOwned = 已觉醒
btnMaxLevel = 已满阶
btnUnlocked = 已解锁
buyOk = 兑换成功，已收入囊中。
upgradeOk = 进阶成功，当前已达 Lv.{level}。
insufficientPoints = 星愿积分不足，还需要 {gap} 积分。

[mine]
abilityGoShop = 前往星愿商城

[errors]
WHEEL_FREE_USED = 今日免费次数已用完。
WHEEL_DAILY_LIMIT = 今日命运轮盘现金次数已达上限，可切换 120 星愿积分继续转动。
WISH_LOCKED = 星愿圣盘尚未解锁（需计级身家满 100 万或完成 1 笔提现）。
WISH_DAILY_LIMIT = 今日星愿圣盘已达 2 次上限，请明日再来。
WISH_WEEKLY_LIMIT = 本周星愿圣盘付费次数已达上限，下周一刷新。
INSUFFICIENT_CASH = 可用现金不足，无法支付本次费用。
INSUFFICIENT_POINTS = 星愿积分不足。
UNKNOWN_ITEM = 未找到对应卡牌或商品，请刷新后重试。
SHOP_MAX_LEVEL = 该异能已达最高阶（Lv.3）。
SHOP_ALREADY_OWNED = 该项权限已拥有，无需重复兑换。
GENERATION_BUSY = 正文正在生成中，请稍候再操作。
STALE_REVISION = 终端状态已更新，请重试一次。
STALE_SOURCE = 当前消息楼层已变化，请刷新后重试。
WHEEL_BRIDGE_TIMEOUT = 轮盘连接超时，请关闭后重新打开。
```
