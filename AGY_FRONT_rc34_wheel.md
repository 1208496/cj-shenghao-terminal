# 《神豪终端》rc.34 命运轮盘前端集成说明（无指针 · 三环同心 · 金光跳环版）

> **预览成品**：`.work/wheel-proto-v2.html`（单文件独立运行，零外网依赖，53 条文案逐字对齐 `AGY_COPY_rc34_wheel.md`）。  
> **设计口径**：严格落实 YG 最新定案——**三环同心 + 取消 12 点圣矛指针 + 三层流动金光指示 + 外→中→内→目标环四段逆时针跳环 + 日历小轮盘 FLIP 双向开合 + 确定性防 SL 随机**。  
> **本轮范围**：仅产出前端成品与集成说明，未改动 `src/` 下任何现有文件。

---

## 一、文件落位与模块划分

施工时按以下路径落入源码树（不污染 `src/content/` 以外的既有模块）：

| 路径 | 状态 | 职责 | 估算增量（打包后） |
|---|---|---|---:|
| `src/core/wheel-pool.js` | 新增 | 53 条定稿只读奖池表（逐字拷贝 `AGY_COPY_rc34_wheel.md`）+ 环位/槽位/整数权重/动作元数据 | ~11 KB |
| `src/core/wheel.js` | 新增 | 64-bit FNV-1a 确定性抽样、四档保底、每日免费与百分比阶梯定价、停格角度计算 | ~4 KB |
| `src/ui/wheel-svg.js` | 新增 | 680×680 三环同心哥特星盘 SVG 生成器、53 枚哥特符号、72 枚纯路径伪拉丁铭文环、尖拱/玫瑰窗分隔带、三层流动金光渲染与光波粒子特效 | ~12 KB |
| `src/ui/wheel-overlay.js` | 新增 | 挂载于 host 侧的全屏轮盘浮层控制器：FLIP 双向开合状态机、四段逆时针 rAF 编排引擎、底部轻浮揭晓卡、三套主题同步 | ~8 KB |
| `src/ui/screens.js` | 局部修改 | `calendar()` 顶部插入「精美小轮盘入口按钮」（含 `#miniWheelAnchor` 微缩三环 SVG 徽章与实时报价徽标） | ~1.5 KB |
| `src/ui/app.js` / `src/ui/style.css` | 局部修改 | 绑定入口点击事件，计算主视口坐标并调用 `api.openWheel(originRect)`；补充入口按钮样式 | ~2 KB |
| `src/runtime/host.js` | 局部修改 | 暴露 `api.openWheel / closeWheel` 桥接，在 host 侧挂载独立浮层，并处理小手机压暗与滚动后最新坐标重算 | ~2.5 KB |
| **合计净增量** | — | **远低于 ≤ 70 KB 体积红线**（当前整卡 ~1.39 MB → 预计 ~1.43 MB） | **~41 KB** |

---

## 二、日历按钮接入与 Host 侧 Overlay 架构

### 2.1 为什么 Overlay 必须挂在 Host 侧（`window.parent.document.body`）？
1. 现网小手机 `#cj-shenghao-phone-frame` 是一个宽 `365px`、带 `clip-path: inset(0 round 40px)` 的独立 `iframe`（`src/runtime/host.js` 第 323、364 行）；在底部宽屏模式下更是嵌在最新一楼 `.mes_text` 内部。
2. 若把轮盘浮层塞进 `iframe` 内部，轮盘会被裁切在窄手机框里，无法实现 YG 要求的「唰地放大到屏幕中央」与「整页背景压暗变灰、两套 UI 不打架」。
3. **落地方案**：
   - **入口在 iframe 内**：`src/ui/screens.js` 的 `calendar()` 在「我的日历」标题栏下方渲染 `.wheel-entry` 按钮，内含 `48×48` 微缩三环星盘徽章 `#miniWheelAnchor`。
   - **坐标跨帧换算**：点击按钮时，`app.js` 读取 `#miniWheelAnchor.getBoundingClientRect()`（iframe 局部坐标），经 `host.js` 的 `phone.getBoundingClientRect()` 与 `renderScale` 换算为主视口绝对矩形：
     ```js
     function toHostRect(localRect, phoneEl, scale) {
       const p = phoneEl.getBoundingClientRect();
       return {
         left:   p.left + localRect.left * scale,
         top:    p.top  + localRect.top  * scale,
         width:  localRect.width  * scale,
         height: localRect.height * scale
       };
     }
     ```
   - **浮层挂在 host 侧**：`host.js` 在 `window.parent.document.body` 挂载单例容器 `#cj-shenghao-wheel-host`（使用 Shadow DOM 隔离酒馆全局 CSS，避免样式污染），`z-index: 3200`（高于小手机 `3000`，低于 TOY·LINK 遥控器 `2147483000`）。
   - **主题同步**：沿用 `host.js` 已有 `publish()` 里的 `prefs.theme`（`sage` / `gold` / `purple`），同步切换 Shadow Root 根节点的 `.theme-gold` / `.theme-purple` 类名，确保轮盘氛围光、遮罩色调与结果卡与终端主题 100% 一致。

### 2.2 打开/关闭时如何处置小手机与防打架？
- **打开（FLIP 放大）**：
  - `host.js` 为 `#cj-shenghao-phone-frame` 施加压暗锁定样式（`filter: brightness(.36) saturate(.45); pointer-events: none`），**不强制折叠成悬浮球**——这样小手机与背景一起退居暗景，绝不与轮盘打架，同时保留日历页内按钮的真实位置供关闭时精准缩回。
  - 轮盘容器从 `originRect` 以 Web Animations API（`480ms`, `cubic-bezier(0.22, 1.18, 0.36, 1)`，带 `-24deg -> 0deg` 轻旋与物理过冲）放大至屏幕中央，背景遮罩同步 `320ms` 淡入。
- **关闭（反向 FLIP 缩回）**：
  - 支持三种关闭途径：右上角 `×` 按钮、`Escape` 键、点击遮罩空白处。
  - 关闭瞬间向 iframe 请求一次最新 `#miniWheelAnchor.getBoundingClientRect()` 并重新经 `toHostRect()` 换算；若日历已将按钮滚出可视区或用户切走了页面，自动钳位到小手机可视区对应边缘，**绝不缩到空气里**。
  - 轮盘以 `360ms`（`cubic-bezier(0.4, 0, 0.2, 1)`）缩回按钮矩形；缩到位后解除小手机压暗、通知 iframe 触发按钮物理回弹动画（`miniBounce`, `360ms`），遮罩最后 `190ms` 淡出卸载。
  - **可打断与防连点**：维护四态状态机 `closed | opening | open | closing` 与 `activeAnims` 数组。连点打开直接忽略（绝不产生双实例）；开合途中按 ESC 或再点入口会 `cancel()` 当前动画并平滑接管。
  - **与 TOY·LINK 联动**：若玩家在轮盘揭晓 `#53` 后点击「启动终端装置」，先关闭轮盘、再折叠小手机（`folded = true`），最后调用 `win.__TOYLINK__.open()`。

---

## 三、四段逆时针跳环旋转编排与视觉衔接

取消原方案的 12 点圣矛指针，改为三环固定、由**三层流动金光**（拖尾残影 + 高亮光斑主体 + 中心呼吸星芒）在格子上高速游走。坐标系以 12 点钟为 `0°`，**逆时针为角度递减（负方向）**，由 `requestAnimationFrame` 时间轴驱动：

| 阶段 | 所在环 | 方向 | 圈数 / 角度 | 时长 | 缓动函数 | 视觉目的 |
|---|---|---|---|---:|---|---|
| **段 1 · 外环巡航** | 外环（灰 30 格） | 逆时针 | `1.25` 圈（`-450°`） | `1050 ms` | 前 35% `easeInQuad` 加速 + 后 65% 匀速 | 从静止拉起金色拖尾，建立旋转动势 |
| **跳环衔接 A** | 外环 → 中环 | 逆时针 | 微滑 `-18°` | `140 ms` | 线性 | 同方位角绘制径向收缩金色光弧桥（`R=256→168`）+ 流星光球滑入中环，**绝不闪断** |
| **段 2 · 中环疾走** | 中环（红 16 格） | 逆时针 | `1.5` 圈（`-540°`） | `1000 ms` | 恒定高速（`linear`） | 半径缩小、单格变宽，节奏提速升温 |
| **跳环衔接 B** | 中环 → 内环 | 逆时针 | 微滑 `-22°` | `140 ms` | 线性 | 同方位角径向收缩光弧桥（`R=168→99`），金光汇入鎏金内环 |
| **段 3 · 内环聚能** | 内环（金 6 格） | 逆时针 | `2.0` 圈（`-720°`） | `950 ms` | `easeInOutQuad` | 快速掠过 12 格金格，核心充能感拉满 |
| **跳环衔接 C** | 内环 → 目标环 | 逆时针 | 微滑 `-24°` | `160 ms` | 线性 | 依预计算结果跃迁：`outer` 向外爆发至 `R=256`、`middle` 至 `R=168`、`inner` 留环震荡、`core` 向内坍缩至 `R=59` 虹环 |
| **段 4 · 目标环锁停** | 目标环（灰/红/金/虹） | 逆时针 | 精确角差 + 1~2 整圈 | `1650~1850 ms` | `easeOutQuart`（`1-(1-t)^4`） | 末段拖尾逐步收拢，一格一格阻尼滑停，**0° 误差锁死在目标格中心** |
| **定格炸定** | 目标格 | — | — | `~680 ms` | 物理冲击 | 全盘按稀有度分级震动 + 双层能量光波扩散 + 12~18 枚星芒粒子绽放 + 该格进入金色呼吸态 |

> 注：当系统开启 `prefers-reduced-motion: reduce` 时，所有旋转与开合时长自动压缩至 14%（约 `0.7s` 内完成），保持清晰反馈且不眩晕。

---

## 四、揭晓方式设计

采用 **「盘面金光炸定 + 轮盘上移让位 + 底部轻浮结果卡」** 的双层揭晓：
1. **0 ms（停格瞬间）**：目标格金光炸定并保持呼吸脉冲，目标符号变为炽白高光，玩家第一眼直接从盘面确认落在哪一环、哪一格。
2. **260 ms 后**：轮盘平滑上移 `22px` 并微缩至 `0.94`，在轮盘正下方弹出黑曜鎏金结果卡（不覆盖轮盘本体），一眼呈现：放大版哥特符号徽章、`NO.xx` 编号、稀有度与保底标记、奖品名称、效果摘要，以及高亮引用的**定稿正文提示语**。
3. **随时退出/连抽**：点结果卡右上 `×` 可收起卡片端详盘面；点卡片内「再转一次」或直接点盘心 `GO` 键立即收卡开启下一抽。

---

## 五、视觉质感提升对比（v2 vs 原型 `.work/wheel-proto.html`）

| 维度 | 旧原型 `.work/wheel-proto.html` | 升级成品 `.work/wheel-proto-v2.html` |
|---|---|---|
| **构图与符号尺寸** | `640×640` viewBox，外/中/内符号 `17 / 19 / 21px`，无托环 | 升级 `680×680` viewBox，符号放大一档至 **`21 / 24 / 27px`**，每枚符号外增加极细金色虚线徽章托环 |
| **外圈铭文环** | 仅简单短刻度线 | 新增 **72 枚纯 SVG 路径伪拉丁/哥特符文刻字环**（12 种几何符文循环 + 12 宫菱形星标，零字体依赖，96s 极慢自转） |
| **盘面金属质感** | 单一纯色平铺扇区 + 单层描边 | 改为 **6 套多段径向金属渐变**（奇偶明暗交替）+ 外框金属倒角环 + 双层蚀刻细金缝（`1.8px` 暗槽 + `0.7px` 鎏金丝）+ 暗角与左上拉丝高光 |
| **三环分隔带** | 环与环之间仅留空隙与单细线 | 外/中环之间加 **30 瓣哥特尖拱花窗带 + 拱顶金珠**；中/内环之间加 **16 瓣玫瑰花窗菱形镂空带**；内/星核之间加 **24 齿圣光齿环** |
| **指示方式** | 静态 12 点圣矛指针 + 整环 CSS 旋转 | **完全移除指针**，改为三层流动金光（4 格动态衰减拖尾 + 柔光高光扇区 + 中心呼吸星芒）+ 跳环径向光弧桥 |
| **中奖冲击力** | 停转后静默弹卡 | 新增 **4 档分级全盘物理震动** + **双层扩散光波** + **12~18 枚星芒粒子绽放** |
| **入口与主题融合** | 直接全屏展示，无入口无关闭、单配色 | 还原小手机日历页 + **微缩三环入口按钮** + **FLIP 双向开合（含滚动重算与回弹）** + 完整接入 **绿/金/紫三套主题变量** |

---

## 六、确定性随机算法、权重保底与角度换算（完整伪代码）

### 6.1 核心原则
1. **先算死，再表演**：点击 `GO` 后立刻执行确定性抽样并提交状态，动画只是对已确定结果 `prize` 的视觉演绎，绝不允许「转到哪算哪」。
2. **确定性防 SL 大法**：种子严格由四个剧情确定性字段拼接，**不含 `Math.random()`、时间戳或随机 UUID**：
   ```text
   rollSeed = "${branchKey}|${world.date}|d${todaySpinIndex}|t${wheel.totalSpins}"
   ```
   同一存档分支（`branchKey`）、同一剧情日（`world.date`）、当日第 `N` 次抽（`todaySpinIndex ∈ [1..6]`）、累计第 `M` 抽（`totalSpins`），无论删楼、换 swipe 还是刷新重来，结果 100% 一致。
3. **整数权重（总权重 `20000`，零浮点误差）**：
   - 灰（外环 30 格，`01–30`）：`480 × 30 = 14400`（`72.0%`）
   - 红（中环 16 格，`31–46`）：`275 × 16 = 4400`（`22.0%`）
   - 金（内环 6 格，`47–52`）：`183 × 4 + 184 × 2 = 1100`（`5.5%`）
   - 虹（星核 1 格，`53`）：`100 × 1 = 100`（`0.5%`）
4. **四档保底规则**：
   - **灰档**：常规池（无保底）。
   - **红保底（10 抽）**：`pityRed >= 9` 时剔除灰池，仅在红/金/虹按原权重抽；抽中红及以上后 `pityRed = 0`。
   - **金保底（30 抽）**：`pityGold >= 29` 时仅在金/虹按原权重抽；抽中金或虹后 `pityGold = 0`。
   - **虹保底（60 抽）**：`!toyLinkUnlocked && pityRainbow >= 59` 时必出 `#53` 虹奖；出虹后 `pityRainbow = 0` 且 `toyLinkUnlocked = true`（此后保留 0.5% 自然出虹，不再触发硬保底）。
5. **每日免费与付费阶梯**：
   - 每日按 `world.date` 享 **1 次免费** + 最多 **5 次付费**（每日上限 **6 抽**）。
   - 付费基准为总身家 `totals(s).total`，实扣可用现金 `user.cashCents`，向下取整至整百元、保底 `¥1,000`；5 档费率严格沿用 **`2% / 4% / 8% / 12% / 18%`**。
6. **三环格数与停格角度换算**：
   - 外环 `30` 格：`step = 12.0°`，第 `slot` 格中心角 `targetCenter = (slot + 0.5) * 12.0`。
   - 中环 `16` 格：`step = 22.5°`，第 `slot` 格中心角 `targetCenter = (slot + 0.5) * 22.5`。
   - 内环 `6` 格：`step = 60.0°`，第 `slot` 格中心角 `targetCenter = (slot + 0.5) * 60.0`。
   - 星核 `1` 格：`360°` 全环，`targetCenter = 0°`。

### 6.2 完整伪代码

```js
// 常量定义
const PAID_RATES = [0.02, 0.04, 0.08, 0.12, 0.18]; // 占总身家比例
const MIN_SPIN_CENTS = 100000;                     // ¥1,000 保底
const RING_COUNTS = { outer: 30, middle: 16, inner: 6, core: 1 };

// 1. 64-bit FNV-1a 确定性哈希（原生 BigInt，零依赖）
function fnv1a64(input) {
  let h = 0xcbf29ce484222325n;
  const PRIME = 0x100000001b3n;
  const MASK  = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * PRIME) & MASK;
  }
  return h;
}

// 2. 计算当次抽奖报价（每日 1 免 + 5 付费阶梯）
function quoteWheelSpin(state) {
  const w = state.wheel;
  const isFree = (w.lastFreeDate !== state.world.date);
  const paidToday = (w.todayPaidDate === state.world.date) ? w.todayPaidSpins : 0;

  if (isFree) {
    return { allowed: true, isFree: true, costCents: 0, todaySpinIndex: 1 };
  }
  if (paidToday >= PAID_RATES.length) {
    return { allowed: false, reason: 'DAILY_LIMIT', isFree: false, costCents: 0 };
  }

  const rate = PAID_RATES[paidToday];
  const wealthBase = totals(state).total; // 现金 + 名下持有资产总估值
  const raw = Math.floor(wealthBase * rate);
  const costCents = Math.max(MIN_SPIN_CENTS, Math.floor(raw / 10000) * 10000);

  return {
    allowed: state.user.cashCents >= costCents,
    reason: state.user.cashCents >= costCents ? null : 'INSUFFICIENT_CASH',
    isFree: false,
    costCents,
    todaySpinIndex: 1 + paidToday + 1
  };
}

// 3. 确定性抽样与保底更新（结果在动画前完全算死）
function executeWheelSpin(state, pool) {
  const quote = quoteWheelSpin(state);
  if (!quote.allowed) throw new Error(quote.reason || 'SPIN_BLOCKED');

  const w = state.wheel;
  const rollSeed = `${state.meta.branchKey}|${state.world.date}|d${quote.todaySpinIndex}|t${w.totalSpins}`;
  const hash = fnv1a64(rollSeed);

  // 四档保底筛选候选池
  let candidates;
  if (!w.toyLinkUnlocked && w.pityRainbow >= 59) {
    candidates = pool.filter(p => p.rarity === 'rainbow');
  } else if (w.pityGold >= 29) {
    candidates = pool.filter(p => p.rarity === 'gold' || p.rarity === 'rainbow');
  } else if (w.pityRed >= 9) {
    candidates = pool.filter(p => p.rarity !== 'gray');
  } else {
    candidates = pool;
  }

  const totalWeight = candidates.reduce((sum, p) => sum + p.weight, 0);
  const ticket = Number(hash % BigInt(totalWeight));

  let cursor = 0;
  let prize = candidates[candidates.length - 1];
  for (const item of candidates) {
    cursor += item.weight;
    if (ticket < cursor) { prize = item; break; }
  }

  // 扣款记账与状态流转
  if (quote.isFree) {
    w.lastFreeDate = state.world.date;
    w.todayPaidDate = state.world.date;
    w.todayPaidSpins = 0;
  } else {
    state.user.cashCents -= quote.costCents;
    // addLedger(..., kind: 'WHEEL_SPIN', direction: 'OUT', amountCents: quote.costCents)
    w.todayPaidDate = state.world.date;
    w.todayPaidSpins += 1;
  }
  w.totalSpins += 1;

  // 更新保底计数器
  if (prize.rarity === 'rainbow') {
    w.pityRed = 0; w.pityGold = 0; w.pityRainbow = 0; w.toyLinkUnlocked = true;
  } else if (prize.rarity === 'gold') {
    w.pityRed = 0; w.pityGold = 0; w.pityRainbow = Math.min(59, w.pityRainbow + 1);
  } else if (prize.rarity === 'red') {
    w.pityRed = 0; w.pityGold = Math.min(29, w.pityGold + 1); w.pityRainbow = Math.min(59, w.pityRainbow + 1);
  } else {
    w.pityRed = Math.min(9, w.pityRed + 1);
    w.pityGold = Math.min(29, w.pityGold + 1);
    w.pityRainbow = Math.min(59, w.pityRainbow + 1);
  }

  // 4. 目标格中心角与第 4 段逆时针锁停角度换算
  const ringCount = RING_COUNTS[prize.ring];
  const stepDeg = 360 / ringCount;
  const targetCenterDeg = prize.ring === 'core' ? 0 : (prize.slotIndex + 0.5) * stepDeg;

  // 给定跳环落地角 landDeg（已归一化至 [0, 360)），计算逆时针精准到达 targetCenterDeg 的总角位移
  // ccwDelta = -(((landDeg - targetCenterDeg) % 360 + 360) % 360)
  // finalDeg = landDeg + ccwDelta - (extraTurns * 360)
  return { prize, quote, rollSeed, targetCenterDeg };
}
```
