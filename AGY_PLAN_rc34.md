# 《神豪终端》rc.34 施工方案 · 日历哥特命运轮盘、背包联动与 TOY·LINK 共存

> **定位**：技术设计与落地施工方案（供 DSH 逐块执行）。  
> **版本目标**：`2.0.0-rc.34` / `cardContractRevision: 29`（新增 `wheel`、`inventory` 字段与 `calendar.appointments` 扩展字段，玩家尚未正式发行，不留旧存档兼容层）。  
> **文案铁律**：奖池 53 条定稿文案位于 `AGY_COPY_rc34_wheel.md`，施工时由脚本直接读取/逐字搬运，**一个字、一个标点都不许改**。本方案中所有新增的 `protocol.txt` / `state-context.txt` 段落均已给出 100% 逐字定稿代码块，DSH 必须逐字复制落盘。  
> **经济铁律**：不改动 `user.cashCents`、`finance.assets` 七类、身家与 `tierBasis` 口径、`wealthTier` 提现倍率、`poolParts` 与 `rewardEvents` 暴击规则。轮盘系统完全外挂在旁边，付费抽奖走 `finance.ledger` 正规支出入账，保证 `assertEconomy(s)` 100% 守恒。

---

## 一、轮盘本体设计

### 1.1 结构决策：三环同心哥特天文钟（总计 53 格，1:1 对应 01–53 号）

**为什么不做单圈 53 格？**  
小手机悬浮态宽 `365px`，弹窗内轮盘 SVG 可视直径约 `296px`（底部宽屏模式最大 `336px`）。若单圈硬塞 53 格，每格圆心角仅 `6.79°`，符号圈半径 `R=112px` 处弧长只有 `13.3px`，哥特符号会挤成看不清的细针，既不精美也不好看。

**定案：三环同心哥特星盘（Gothic Astrolabe Wheel），共 53 格（30 + 16 + 6 + 1）**：

| 层级 | 对应稀有度 | 格数 | 奖池编号 | 半径区间（320×320 viewBox） | 单格圆心角 | 色系与视觉质感 |
|---|---|---:|---|---|---|---|
| **外环（Outer Ring）** | 灰（常规） | **30 格** | `01`–`30` | `R = 104 ~ 144` | `12.0°` | 哥特石板灰 + 暗银雕线（`#2a2d36` / `#383c48` 交替，描边 `#7b8294`） |
| **中环（Middle Ring）** | 红（珍稀） | **16 格** | `31`–`46` | `R = 68 ~ 100` | `22.5°` | 天鹅绒绯红 + 玫瑰暗金（`#5c1727` / `#7d2036` 交替，描边 `#d98a98`） |
| **内环（Inner Ring）** | 金（传说） | **6 格** | `47`–`52` | `R = 40 ~ 64` | `60.0°` | 黑曜鎏金 + 琥珀高光（`#755318` / `#a67a26` 交替，描边 `#f6d786`） |
| **星核（Core Halo）** | 虹（终极） | **1 格** | `53` | `R = 34 ~ 40`（环绕 GO 键） | `360°` 全环 | 全息虹彩流光环（`conic-gradient` 紫/青/金/玫红呼吸光） |

- **盘面面积比例**：灰外环约 46%、红中环约 29%、金内环约 16%、虹星核与 GO 键约 9%。玩家一眼就能通过「越往里越稀有、颜色从灰→红→金→虹」直觉判断好坏，但格子上只刻哥特符号不写字，保留神秘感。
- **12 点钟圣矛指针**：固定在顶部正中，尖端向下穿透外/中/内三环。每环各自错位旋转（外环顺时针、中环逆时针、内环顺时针），最后逐环「咔嗒」锁停：
  - 抽中**灰**：内环与中环停在暗位，外环将中奖灰格精准锁停在 12 点指针下；
  - 抽中**红**：外环先停在「暗银符门」，指针红光穿透至中环，中环将中奖红格锁停在 12 点；
  - 抽中**金**：外、中环均停在符门，金色光束贯入内环，内环将中奖金格锁停在 12 点；
  - 抽中**虹（#53）**：三环符门全部在 12 点对齐成垂直圣光柱，直贯中心虹环，触发全屏虹彩开奖动效。

### 1.2 53 格哥特符号体系（纯 SVG 24×24 viewBox，照表可画）

> 统一绘制规范：`viewBox="0 0 24 24"`，`fill="none"`，`stroke="currentColor"`，`stroke-width="1.5"`，`stroke-linecap="round"`，`stroke-linejoin="round"`。外环符号尺寸 `13px`，中环 `15px`，内环 `18px`，核心 `20px`。

#### 外环 · 灰阶 30 格（`01`–`30`，冷银描边 `#cfd5e3`）

| 编号 | 槽位 | 符号名 | 形状描述（SVG 构图要点） | 隐喻含义 | 颜色 |
|---:|---:|---|---|---|---|
| 01 | 0 | 断沙漏 | 上下双尖三角相接，腰部一横杠 | 十分钟倒计时 | 灰 |
| 02 | 1 | 麦穗环 | 弯弧柄上对称三对菱形叶 | 一年烟火早食 | 灰 |
| 03 | 2 | 荆棘匙 | 菱形匙柄 + 竖杆 + 两侧锯齿 | 破门免队特权 | 灰 |
| 04 | 3 | 四辐轮 | 外圆 + 十字辐条 + 中心点 | 专车随候 | 灰 |
| 05 | 4 | 独眼幕 | 拱门外框 + 内部菱形睁眼 | 暗厅包场观影 | 灰 |
| 06 | 5 | 爆星芒 | 八芒不等长射线，中心空心小圆 | 江边夜空烟花 | 灰 |
| 07 | 6 | 冠顶环 | 大圆环 + 顶部三尖小冠 + 八短辐 | 摩天轮最高点 | 灰 |
| 08 | 7 | 银钟罩 | 半圆拱罩 + 顶珠 + 水平托盘线 | 餐点免单送达 | 灰 |
| 09 | 8 | 双锋剪 | 交叉双斜线 + 下方双圆环柄 | 造型重塑 | 灰 |
| 10 | 9 | 猫瞳印 | 尖耳倒三角轮廓 + 竖长纺锤瞳 | 灵猫认主 | 灰 |
| 11 | 10 | 拱桥月 | 弧形石桥 + 下方波纹 + 上方新月 | 古镇临河双人夜 | 灰 |
| 12 | 11 | 潮汐窗 | 哥特尖拱窗框 + 底部三道波浪 | 听海阳台 | 灰 |
| 13 | 12 | 单翼羽 | 斜向羽轴 + 右侧四道锐羽齿 | 云端升舱 | 灰 |
| 14 | 13 | 雾泉碗 | 浅碗弧线 + 上方三道 S 形轻烟 | 山间私汤 | 灰 |
| 15 | 14 | 翼门徽 | 双扇微开尖拱门 + 顶部小双翼 | 贵宾专属通道 | 灰 |
| 16 | 15 | 罗盘针 | 菱形细长指针 + 四向短刻度 | 说走就走 | 灰 |
| 17 | 16 | 帐篷星 | 尖顶三角帐 + 中缝门 + 顶上四角星 | 房车露营 | 灰 |
| 18 | 17 | 裁缝针 | 斜穿细针 + 针眼 + S 形丝线 | 手工高定 | 灰 |
| 19 | 18 | 烛台叉 | 三齿细叉 + 底部菱形底座 | 私厨晚宴 | 灰 |
| 20 | 19 | 疾风箭 | 三条平行流线 + 尖锐箭头 | 跑车疾驰 | 灰 |
| 21 | 20 | 圣杯爵 | 高脚尖底酒杯 + 杯口一滴星点 | 窖藏年份酒 | 灰 |
| 22 | 21 | 领结徽 | 对称尖角蝶结 + 中心菱扣 | 贴身管家 | 灰 |
| 23 | 22 | 折纸信 | 斜折三角纸巾 + 右角小封蜡点 | 陌生号码便签 | 灰 |
| 24 | 23 | 毒尾杯 | 倒三角鸡尾酒杯 + 细长高脚 + 樱桃点 | 她请的那杯酒 | 灰 |
| 25 | 24 | 交错环 | 两个相交偏心细圆环 | 命定偶遇 | 灰 |
| 26 | 25 | 连指结 | 两条交缠的倒 U 形弧线 | 初次牵手 | 灰 |
| 27 | 26 | 封蜡函 | 横矩形信封 + 尖折盖 + 中央菱印 | 烫金邀约函 | 灰 |
| 28 | 27 | 丝带匣 | 方形礼盒 + 十字丝带 + 顶上双环结 | 投其所好礼盒 | 灰 |
| 29 | 28 | 莲掌印 | 向上五瓣尖莲轮廓 + 底部弧线 | 舒缓推拿 | 灰 |
| 30 | 29 | 雨伞尖 | 哥特尖顶伞面 + 弯钩伞柄 + 两点雨滴 | 雨中共伞 | 灰 |

#### 中环 · 红阶 16 格（`31`–`46`，玫瑰金描边 `#ffd1d8`）

| 编号 | 槽位 | 符号名 | 形状描述（SVG 构图要点） | 隐喻含义 | 颜色 |
|---:|---:|---|---|---|---|
| 31 | 0 | 圣光塔 | 竖直哥特尖塔 + 两侧向外三道放射线 | 全城大屏点亮 | 红 |
| 32 | 1 | 闭锁门 | 双开尖拱宫门 + 中央挂锁菱形 | 商场闭店独享 | 红 |
| 33 | 2 | 三星冕 | 拱形厨帽轮廓 + 顶部三枚四角星 | 米其林三星主厨 | 红 |
| 34 | 3 | 棕榈岛 | 小弧岛 + 弯干 + 顶部五道散叶 + 波纹 | 热带水上别墅 | 红 |
| 35 | 4 | 极光幕 | 穹顶玻璃拱 + 上方两条波浪垂帘线 | 北欧极光玻璃屋 | 红 |
| 36 | 5 | 鸟居印 | 双横梁微翘 + 双竖柱哥特化简笔 | 东京私定行程 | 红 |
| 37 | 6 | 铁轨星 | 两条透视收拢铁轨 + 远处雪山尖顶 | 欧洲豪华列车 | 红 |
| 38 | 7 | 齿轮表 | 圆形表盘 + 十二点指针 + 四向表耳 | 限量名表 | 红 |
| 39 | 8 | 烈马盾 | 尖底纹章盾 + 内部斜向闪电折线 | 超跑过户钥匙 | 红 |
| 40 | 9 | 拍卖槌 | 斜置木槌头 + 长柄 + 下方弧形底座 | 拍卖会举牌权 | 红 |
| 41 | 10 | 银翼矢 | 锐角三角机翼 + 细长机身中轴 | 公务机随飞 | 红 |
| 42 | 11 | 山巅堡 | 山峰折线 + 峰顶双尖塔屋檐 | 半山豪宅试住 | 红 |
| 43 | 12 | 荆棘心 | 哥特尖底心形 + 斜绕一道带刺细枝 | 一日女友 | 红 |
| 44 | 13 | 钥匙孔 | 哥特尖顶门牌 + 中央圆孔加梯形锁眼 | 顶层套房密约 | 红 |
| 45 | 14 | 双月泉 | 两个相拥弯月 + 下方三道温泉水波 | 私汤双人夜 | 红 |
| 46 | 15 | 秘典瞳 | 竖立翻开的书页 + 中央一只秘眼 | 解锁私密档案页 | 红 |

#### 内环 · 金阶 6 格（`47`–`52`，鎏金描边 `#fff0be`）

| 编号 | 槽位 | 符号名 | 形状描述（SVG 构图要点） | 隐喻含义 | 颜色 |
|---:|---:|---|---|---|---|
| 47 | 0 | 领主岛 | 王冠底托 + 山峦轮廓 + 底部波浪线 | 私人海岛产权 | 金 |
| 48 | 1 | 巨锚帆 | 哥特铁锚 + 顶部三角巨帆叠加 | 百米超级游艇 | 金 |
| 49 | 2 | 铭文碑 | 尖顶方尖碑 + 中轴三道铭文横刻 | 地标冠名一年 | 金 |
| 50 | 3 | 行星环 | 中心圆球 + 倾斜椭圆星环 + 两点星辰 | 商业太空席位 | 金 |
| 51 | 4 | 聚光瞳 | 电影胶片双齿框 + 中央放射聚光菱瞳 | 一日 AV 男主 | 金 |
| 52 | 5 | 五芒帆 | 五角星冠 + 下方游艇船首剪影 | 后宫出海一周 | 金 |

#### 星核 · 虹阶 1 格（`53`，全息流光描边）

| 编号 | 槽位 | 符号名 | 形状描述（SVG 构图要点） | 隐喻含义 | 颜色 |
|---:|---:|---|---|---|---|
| 53 | 0 | 终极圣印 | 八芒星芒嵌套双层玫瑰花窗圆环，正中悬浮菱形神眼 | 终端最终愿望（终极大奖） | 虹 |

### 1.3 概率权重、保底机制与确定性停格

**基础概率（每抽）**：
- 灰（30 条）：总权重 `7200`（`72.0%`，单条 `240`）
- 红（16 条）：总权重 `2200`（`22.0%`，单条 `137.5` → 统一放大 2 倍用整数权重：灰 `480×30=14400`，红 `275×16=4400`，金 `183×6=1098` + 补 `2` 给 #51/#52 各 +1 → `1100`，虹 `100×1=100`，总权重 `20000`，精确无浮点误差！）
  - 灰：`14400 / 20000 = 72.0%`
  - 红：`4400 / 20000 = 22.0%`
  - 金：`1100 / 20000 = 5.5%`
  - 虹：`100 / 20000 = 0.5%`

**三重保底（全由脚本维护，状态存于 `state.wheel`）**：
1. **10 抽红保底**：当 `wheel.pityRed >= 9`（连续 9 抽全是灰），第 10 抽剔除灰池，只在红/金/虹中按比例抽（红 78.57% / 金 19.64% / 虹 1.79%）；抽中红及以上后 `pityRed` 归零。
2. **30 抽金保底**：当 `wheel.pityGold >= 29`（连续 29 抽未出金或虹），第 30 抽只在金/虹中抽（金 91.67% / 虹 8.33%）；抽中金或虹后 `pityGold` 归零。
3. **60 抽虹保底**：当 `!wheel.toyLinkUnlocked && wheel.pityRainbow >= 59`，第 60 抽必出虹色终极大奖 `#53`；抽中 `#53` 后 `pityRainbow` 归零，且 `toyLinkUnlocked` 永久置 `true`（之后再次抽奖仍保留 0.5% 自然出虹概率，但不再触发 60 抽硬保底）。

**确定性随机与停格实现（绝不交给模型、绝不用 `Math.random()`）**：
- 抽奖动作 `PLAYER_WHEEL_SPIN` 由前端点击中心 `GO` 生成唯一 `operationId = crypto.randomUUID()` 传入。
- `engine.js` 使用既有 64-bit FNV-1a 哈希函数 `fnv()`：
  ```js
  const rollSeed = `${s.meta.initKey}:${s.world.date}:${s.wheel.totalSpins}:${op.operationId}`;
  const h = BigInt('0x' + fnv(rollSeed));
  const ticket = Number(h % BigInt(totalWeight));
  ```
- **优势**：每次点击前因 `operationId` 未知而完全不可预测；一旦提交，在删楼重放 / 换 swipe / 多端校验中 100% 确定性得出同一个奖品、同一笔扣款、同一个道具 ID（`itemId = 'item_' + fnv(rollSeed + ':item').slice(0, 12)`）。
- **停格角度反算**：
  - 后端返回 `result = { prizeId, rarity, ring, slotIndex, itemId, costCents, assetId }`。
  - 前端按 `ring` 与 `slotIndex` 精确计算三环目标角：
    - 中奖环：`targetDeg = 360 * 5 - (slotIndex + 0.5) * (360 / ringCount)`（保证该格正中心停在 12 点指针正下方）；
    - 非中奖环：若抽中更内层，外层环停在预设的 `0°` 符门对齐位；若抽中更外层，内层环停在错位暗角。
  - 动画时长 `4.2s`，缓动 `cubic-bezier(0.12, 0.88, 0.18, 1)`，停稳后 280ms 弹出结果卡。`prefers-reduced-motion: reduce` 时缩至 `0.35s`。

### 1.4 中心 GO 按钮与按下反馈

- 圆形黑曜石浮雕章（直径 `68px`），外圈为哥特玫瑰花窗细齿 + 虹彩微呼吸光环。
- 按钮双行文案：上行鎏金衬线大字 `GO`，下行状态小字：
  - 今日未用免费次：`今日免费`（暖金呼吸光）
  - 今日付费档：`¥xx万`（或 `¥x,xxx`，按实时报价显示）
  - 现金不足：按钮变暗红边框，下行显示 `现金不足`（点击仍弹出筹款提示面板，不静默死点）
  - 今日达上限（6 抽）：显示 `明日再来`，置灰禁用
- 按下反馈：`transform: scale(0.92)` 压感 + 金色脉冲波纹扩散；旋转期间按钮锁死防连点并显示旋转星芒图标。

### 1.5 每日一次口径与「按账户百分比扣钱」定价公式

1. **每日免费判定口径：按 `world.date`（剧情日期）**
   - 与 `computeCycle`、`sameDayCrits` 暴击衰减及 `protocol.txt` 第 4 行完全一致，绝不读电脑真实时钟。
   - 判定：`isFree = (s.wheel.lastFreeDate !== s.world.date)`。跨日自动恢复 1 次免费并重置当日付费次数 `todayPaidSpins = 0`。

2. **再抽定价公式（制造「为了抽奖卖房卖车」的核心设计）**：
   - **定价基准：`wealthBase = totals(s).total`（可用现金 `user.cashCents` + 名下持有资产总估值 `totals(s).assets`）**。
   - **扣款来源：实扣 `user.cashCents`（可用现金）**。
   - **为什么这样定？** 若只按现金百分比扣，现金越少越便宜，玩家永远不会缺钱、永远不会动卖房卖车的念头；而按「总身家」阶梯定价、用「可用现金」实扣，当玩家身家 5000 万但手里现金只剩 150 万时，第 3 抽报价 400 万会当场触发「现金不足」——想再搏一把金/虹大奖，就真的得去正文里把名下超跑或公寓挂急售变现，完美兑现 YG 原话的爽感与荒诞感！
   - **当日付费阶梯比例（每日免费 1 次 + 最多付费 5 次 = 每日上限 6 抽）**：

     | 当日第 N 次付费抽 | `todayPaidSpins` | 费率（占总身家） | 举例（总身家 5000 万） |
     |---:|---:|---:|---:|
     | 第 1 次付费 | 0 → 1 | **2%** | ¥100 万 |
     | 第 2 次付费 | 1 → 2 | **4%** | ¥200 万 |
     | 第 3 次付费 | 2 → 3 | **8%** | ¥400 万 |
     | 第 4 次付费 | 3 → 4 | **12%** | ¥600 万 |
     | 第 5 次付费 | 4 → 5 | **18%** | ¥900 万 |

   - **取整与保底**：
     ```js
     const RATES = [0.02, 0.04, 0.08, 0.12, 0.18];
     const MIN_SPIN_CENTS = 100000; // ¥1,000 保底，防止极低资产白嫖
     const raw = Math.floor(totals(s).total * RATES[todayPaidSpins]);
     const costCents = Math.max(MIN_SPIN_CENTS, Math.floor(raw / 10000) * 10000); // 向下取整到整百元
     ```
   - **账本守恒（不破 `assertEconomy`）**：
     - 扣款时：`s.user.cashCents = add(s.user.cashCents, -costCents)`，同时调用 `addLedger(s, op.operationId, { factId: op.operationId, kind: 'WHEEL_SPIN', direction: 'OUT', amountCents: costCents, payer: 'USER', allocations: [], itemName: '命运轮盘', memo: `命运轮盘抽奖（当日第${paidIndex}次付费）` }, anchor)`。
     - `assertEconomy` 校验 `cashCents === initialCashCents + income - expense` 100% 通过。
   - **余额不足兜底**：
     - 绝对禁止负现金或透支（`requireRule(s.user.cashCents >= costCents, 'INSUFFICIENT_CASH')`）。
     - 当 `cashCents < costCents` 时，弹窗展示：**本次需 `¥X` / 当前可用现金 `¥Y` / 缺口 `¥Z`**，并提供三个可执行入口：
       1. 若有可提现女性奖池 → 一键跳转「她们」页提现；
       2. 若 `totals(s).assets >= costCents - cashCents` → 提供「💸 去正文变卖资产筹款」按钮（生成可复制正文草稿，列出现有名下资产名称与估值，方便玩家直接发正文急售套现！）；
       3. 提示「或推进剧情至次日，免费再转一次」。

### 1.6 轮盘视觉体积预算

| 新增模块 | 估算未压缩体积 | 说明 |
|---|---:|---|
| `src/core/wheel-pool.js` | ~14 KB | 53 条定稿只读表 + 动作元数据 |
| `src/core/wheel.js` | ~6 KB | 定价、保底、FNV 抽样、角度与状态流转 |
| `src/ui/wheel-svg.js` | ~18 KB | 三环 SVG 星盘生成器 + 53 枚 24×24 哥特 `<symbol>` |
| `src/ui/wheel-modal.js` + `screens.js` / `app.js` / `style.css` | ~16 KB | 轮盘弹窗、旋转动画、开奖卡、背包页 |
| `schema.js` / `settlement.js` / `host.js` / `protocol.txt` | ~6 KB | Schema、动作重放、协议与 TD 桥接 |
| **总增量** | **~60 KB** | 当前整卡 `~1.39 MB` → 预计 `~1.45 MB`，距离 `3.00 MB` 上限余量 `~1.55 MB` |

---

## 二、奖池数据层与 53 条逐条动作映射

### 2.1 静态数据表 `src/core/wheel-pool.js`

不存入 MVU 存档，由代码静态导出 `WHEEL_POOL`（53 项数组）与 `WHEEL_BY_ID`（`w01`–`w53` 映射）。字段定义：

```js
{
  id: 'w01',                // 稳定 ID：w01..w53
  no: '01',                 // 对应 AGY_COPY_rc34_wheel.md 编号
  name: '...',              // 100% 逐字拷贝 AGY_COPY_rc34_wheel.md，禁止改动
  rarity: 'gray',           // 'gray' | 'red' | 'gold' | 'rainbow'
  ring: 'outer',            // 'outer' | 'middle' | 'inner' | 'core'
  slotIndex: 0,             // 所在环格子下标
  symbolId: 'g01',          // 哥特符号 ID
  weight: 480,              // 整数权重（灰480 / 红275 / 金183~184 / 虹100）
  actionType: 'VOUCHER',    // 'VOUCHER' | 'ASSET' | 'ENCOUNTER' | 'TARGET' | 'PRIVATE_PAGE' | 'WISH'
  repeatable: true,         // 全 53 条均可重复中奖（#53 首次解锁 TOY·LINK，再中得新许愿券）
  canSchedule: true,        // 是否支持排入日历日期
  needsTarget: false,       // 排期/使用时是否要求选定档案女性
  maxTargets: 0,            // 目标人数上限（0=不选，1=单选，5=最多5人）
  assetSpec: null,          // 仅 actionType==='ASSET' 填写：{ kind, bookValueCents, locationNote, description }
  summary: '...',           // 100% 逐字拷贝「抽中后发生什么」
  promptHint: '...'         // 100% 逐字拷贝「正文提示语」
}
```

### 2.2 动作类型与脚本执行规则

| `actionType` | 抽中时脚本动作 | 排入日历 / 使用时脚本动作 | 对经济/人物系统的影响 |
|---|---|---|---|
| `VOUCHER` | 写入 `state.inventory[itemId]`（`status:'READY'`） | 写入 `calendar.appointments[apptId]`（附 `sourceItemId` 与 `prizeId`），`inventory` 置 `SCHEDULED` | 零现金变动；到日期进 `_context.todaySchedules` 提示正文 |
| `ASSET` | **同时**写入 `finance.assets[assetId]`（`ownerId:'USER'`, `status:'OWNED'`, `basisCents:0`, `acquisitionIsInitial:false`, `acquisitionEventId:opId`）**且**在 `inventory` 写入一张体验排期券（携带 `assetId`） | 玩家既可在「我的→持有资产」直接看到/在正文出售变现，也可将背包券排入日历触发提车/登岛/首航剧情 | `basisCents: 0` 确保转赠不凭空刷返现池、不污染 `tierBasis`，也不破坏 `assertEconomy` 现金守恒；若后续出售则按正常 `ASSET_SALE` 进现金 |
| `ENCOUNTER` | 写入 `state.inventory[itemId]`（`status:'READY'`） | 排入日历后，到日期进 `todaySchedules`，附带标记 `hintMode:'NEW_ENCOUNTER'`，引导模型正文安排新陌生女性出场（走既有 `temporaryActors` 或新 `characters` 流程） | 不自动造假人，交给正文自然演绎与现有建档流程 |
| `TARGET` | 写入 `state.inventory[itemId]`（`status:'READY'`） | 排期弹窗要求勾选 `1` 位（或 `#52` 最多 `5` 位）已收录女性写入 `targetCharacterIds` 及日程 `participants` | 不直接篡改好感/堕落；正文演绎后按正常 `affection/corruption/BEHAVIOR` 结算 |
| `PRIVATE_PAGE` | 写入 `state.inventory[itemId]`（`status:'READY'`） | 选择 1 位档案女性立即使用或排期：脚本将其 ID 加入 `wheel.unlockedSecretPages[cid]`，并在 `todaySchedules` 提示正文揭晓/补写她的一页深度私密档案 | 不破坏 `seedAnatomy`，允许模型本轮补充私密细节 |
| `WISH` | 写入 `state.inventory[itemId]`（`status:'READY'`）**且**永久置 `state.wheel.toyLinkUnlocked = true` | 排入日历或立即点击「兑现愿望」触发正文提示语；同时解锁并可一键呼出 TOY·LINK 装置（见第四节） | 终极大奖特权永久保留在当前分支 |

### 2.3 53 条全量映射表（逐条对应 `AGY_COPY_rc34_wheel.md`）

| 编号 | 奖池名称（引用定稿） | 稀有度 | `actionType` | 目标选择 | 特殊脚本参数 / 落地说明 |
|---:|---|---|---|---|---|
| 01 | 便利店十分钟 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 02 | 早餐摊包一年 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 03 | 热门店插队卡 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 04 | 专车随叫一个月 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 05 | 老影院包场夜 | 灰 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1`（可邀人同看） |
| 06 | 江边五分钟烟花 | 灰 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 07 | 摩天轮最高点 | 灰 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 08 | 外卖霸王餐月卡 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 09 | 私人造型师一日 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 10 | 猫咖认养一只 | 灰 | `VOUCHER` | 无 | 背包票券（生活伴侣，不入大额房产/奢品资产库） |
| 11 | 古镇民宿双人夜 | 灰 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 12 | 海景房一晚 | 灰 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 13 | 头等舱升舱券 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 14 | 温泉山庄两日 | 灰 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 15 | 机场贵宾厅年卡 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 16 | 说走就走机票 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 17 | 房车露营周末 | 灰 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 18 | 手工西装一套 | 灰 | `VOUCHER` | 无 | 背包票券，量体交付由正文演绎 |
| 19 | 和牛私厨晚餐 | 灰 | `VOUCHER` | 可选 0–3 人 | `needsTarget:false, maxTargets:3` |
| 20 | 跑车试驾一日 | 灰 | `VOUCHER` | 无 | 试驾权，非过户资产，进背包票券 |
| 21 | 酒庄窖藏一支 | 灰 | `VOUCHER` | 可选 0–1 人 | 可自饮或赠人，进背包票券 |
| 22 | 三天私人管家 | 灰 | `VOUCHER` | 无 | 背包票券，可排期 |
| 23 | 酒吧留的号码 | 灰 | `ENCOUNTER` | 无 | 引导正文安排陌生女性出场（可转 `temporaryActors`） |
| 24 | 她请的那杯酒 | 灰 | `ENCOUNTER` | 无 | 引导正文今晚陌生女性主动请酒 |
| 25 | 刚好遇见你 | 灰 | `TARGET` | **必选 1 人** | `needsTarget:true, maxTargets:1` |
| 26 | 第一次牵手 | 灰 | `TARGET` | **必选 1 人** | `needsTarget:true, maxTargets:1` |
| 27 | 晚餐邀约函 | 灰 | `TARGET` | **必选 1 人** | `needsTarget:true, maxTargets:1` |
| 28 | 她会喜欢的礼盒 | 灰 | `TARGET` | **必选 1 人** | `needsTarget:true, maxTargets:1` |
| 29 | 上门推拿一次 | 灰 | `ENCOUNTER` | 无 | 引导正文高端会所技师上门 |
| 30 | 共撑一把伞 | 灰 | `TARGET` | **必选 1 人** | `needsTarget:true, maxTargets:1` |
| 31 | 全城大屏一小时 | 红 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 32 | 商场闭店购物 | 红 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 33 | 米其林主厨上门 | 红 | `VOUCHER` | 可选 0–3 人 | `needsTarget:false, maxTargets:3` |
| 34 | 海岛双人七日 | 红 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 35 | 极光玻璃屋 | 红 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 36 | 东京全包行程 | 红 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 37 | 欧洲列车包厢 | 红 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 38 | 名表一枚 | 红 | `ASSET` | 无 | 直发资产：`kind:'LUXURY'`, `bookValueCents:180000000`(180万), `basisCents:0`, `locationNote:'本人随身佩戴'`, `description:'顶级制表品牌限量款腕表，全国仅三枚，附原厂证书，可佩戴可转售。'` |
| 39 | 超跑钥匙 | 红 | `ASSET` | 无 | 直发资产：`kind:'CAR'`, `bookValueCents:680000000`(680万), `basisCents:0`, `locationNote:'专属地下车库'`, `description:'全新顶级超跑，牌照与过户手续齐备，随时可提车上路。'` |
| 40 | 拍卖会举牌权 | 红 | `VOUCHER` | 无 | 专项拍品额度券（5000万拍品额度由正文演绎，不直接塞现金） |
| 41 | 公务机一日 | 红 | `VOUCHER` | 可选 0–3 人 | `needsTarget:false, maxTargets:3` |
| 42 | 半山豪宅试住 | 红 | `VOUCHER` | 可选 0–1 人 | 试住权非产权，进背包票券 |
| 43 | 一日女友 | 红 | `TARGET` | **必选 1 人** | `needsTarget:true, maxTargets:1`（若档案无女性则允许留空由正文安排兼职美女） |
| 44 | 顶层套房密约 | 红 | `TARGET` | **必选 1 人** | `needsTarget:true, maxTargets:1` |
| 45 | 私汤双人夜 | 红 | `TARGET` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 46 | 私密档案一页 | 红 | `PRIVATE_PAGE` | **必选 1 人** | `needsTarget:true, maxTargets:1`；解锁并记入 `wheel.unlockedSecretPages` |
| 47 | 私人海岛一座 | 金 | `ASSET` | 无 | 直发资产：`kind:'HOUSE'`, `bookValueCents:15000000000`(1.5亿), `basisCents:0`, `locationNote:'专属私属海域'`, `description:'带私人码头与海景别墅的独立海岛产权，已正式登记名下，可自由命名。'` |
| 48 | 百米游艇 | 金 | `ASSET` | 无 | 直发资产：`kind:'YACHT_JET'`, `bookValueCents:28000000000`(2.8亿), `basisCents:0`, `locationNote:'云澜国际游艇港'`, `description:'百米级超级游艇配全职船员班底，停靠港自定，随时可起航出海。'` |
| 49 | 地标冠名一年 | 金 | `VOUCHER` | 无 | 背包票券，可排期 |
| 50 | 太空旅行席位 | 金 | `VOUCHER` | 可选 0–1 人 | `needsTarget:false, maxTargets:1` |
| 51 | 一日AV男主 | 金 | `TARGET` | 可选 0–3 人 | `needsTarget:false, maxTargets:3`（可指定档案女性，也可留空由片场安排） |
| 52 | 后宫出海一周 | 金 | `TARGET` | **必选 1–5 人** | `needsTarget:true, maxTargets:5` |
| 53 | 终端最终愿望 | 虹 | `WISH` | 无 | 永久置 `wheel.toyLinkUnlocked=true` + 发放虹色许愿券 + 解锁 TOY·LINK 联动入口 |

> 注：对于 `needsTarget: true` 的条目，若玩家当前 `characters` 里尚无任何已收录女性，UI 自动降级为「允许留空（由正文安排新人物）」，绝不把玩家卡死在无法使用状态。

---

## 三、背包、Schema 变更与日历联动

### 3.1 `src/runtime/schema.js` 新增与扩展字段

1. **扩展 `appointment`**（第 28–29 行）：
   ```js
   const appointment = z.object({
     id, title: z.string().min(1).max(80), date,
     time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
     location: short, participants: z.array(id).max(30).default([]),
     status: z.enum(['PLANNED','CANCELLED','COMPLETED']).default('PLANNED'),
     notes: text.default(''),
     sourceItemId: id.nullable().default(null),
     prizeId: short.nullable().default(null)
   });
   ```
2. **新增 `inventoryItem` 与 `wheelState`**：
   ```js
   const inventoryItem = z.object({
     itemId: id,
     prizeId: z.string().regex(/^w(?:0[1-9]|[1-4]\d|5[0-3])$/),
     rarity: z.enum(['gray','red','gold','rainbow']),
     obtainedDate: date,
     status: z.enum(['READY','SCHEDULED','USED']).default('READY'),
     scheduledAppointmentId: id.nullable().default(null),
     targetCharacterIds: z.array(id).max(5).default([]),
     assetId: id.nullable().default(null),
     usedDate: date.nullable().default(null)
   });
   const wheelState = z.object({
     lastFreeDate: date.nullable().default(null),
     todayPaidDate: date.nullable().default(null),
     todayPaidSpins: z.number().int().min(0).max(5).default(0),
     totalSpins: z.number().int().nonnegative().default(0),
     pityRed: z.number().int().min(0).max(9).default(0),
     pityGold: z.number().int().min(0).max(29).default(0),
     pityRainbow: z.number().int().min(0).max(59).default(0),
     toyLinkUnlocked: z.boolean().default(false),
     unlockedSecretPages: z.array(id).max(100).default([]),
     discoveredPrizeIds: z.array(short).max(53).default([])
   }).prefault({});
   ```
3. **挂载到 `state` 顶层**：
   - `wheel: wheelState`
   - `inventory: z.record(id, inventoryItem).default({})`
4. **权限隔离（`src/runtime/settlement.js`）**：
   - `settleNative` 第 52 行脚本独占白名单追加 `'wheel'` 与 `'inventory'`（模型绝对无法伪造抽奖、篡改保底或凭空刷道具）。
   - `allowModelCommand` 保持不放行 `wheel.*` 与 `inventory.*`；仅沿用既有的 `calendar.*` 放行，允许模型在正文完成日程后将 `calendar.appointments.<id>.status` 置为 `'COMPLETED'`。
   - **自动核销钩子（铁律一）**：在 `settleNative` 末尾（`applyCycles` 之后）新增 `syncWheelInventory(s)`：遍历 `s.calendar.appointments`，凡 `sourceItemId` 指向 `s.inventory[itemId]` 且日程状态为 `'COMPLETED'` 者，脚本自动将 `inventory[itemId].status = 'USED'`、`usedDate = s.world.date`；若日程被改为 `'CANCELLED'`，自动将其退回 `'READY'`、`scheduledAppointmentId = null`。
5. **背包上限与滚出规则**：
   - 活跃道具（`READY` + `SCHEDULED`）上限 **60 件**（超限时提示「背包已满，请先消耗或排期使用已有票券」再允许抽奖，防数据膨胀）。
   - 已核销道具（`USED`）最多保留最近 **40 件**，超出时按最早 `usedDate` 自动清理。

### 3.2 投影与「到时间正文提示今天日程」

**复用 `calendar.appointments` 主链路，不另起炉灶！**

在 `src/core/engine.js` 的 `projection(s)` 中新增两个轻量字段（为空则省略，零冗余 token）：
1. `todaySchedules`：筛选 `Object.values(s.calendar.appointments).filter(a => a.date === s.world.date && a.status === 'PLANNED')`，每项输出：
   ```js
   {
     id: a.id, time: a.time, title: a.title, location: a.location,
     participants: a.participants, notes: a.notes,
     ...(prize ? { prizeNo: prize.no, prizeSummary: prize.summary, promptHint: prize.promptHint } : {})
   }
   ```
2. `bagReadyItems`：筛选 `Object.values(s.inventory).filter(i => i.status === 'READY').slice(0, 12)`，每项只输出 `{ itemId, no, name, rarity }`，让模型知道玩家兜里还揣着哪些未排期票券（若玩家在正文主动口头掏出某张券也能接住）。

**闭环效果**：
- 只要剧情时间推进到 `world.date === appointment.date`，`_context.todaySchedules` 自动出现当天排好的轮盘票券及定稿 `promptHint`。
- 模型读到 `todaySchedules` 后，自然会在当轮正文里顺着 `promptHint` 提醒玩家今天的日程已就绪（仍遵守既有铁律：不替玩家自动赴约或自动扣款，留给玩家决定）。
- 玩家也可以在日历里点既有按钮「在正文继续」（`prepareAppointment` 增强：若该日程关联 `prizeId`，生成的接续文本自动附上定稿 `promptHint`），主动推进。

### 3.3 日历页与背包 UI 交互

在 `src/ui/screens.js` 的 `calendar()` 中改造：
1. **顶部哥特轮盘入口卡**（位于「我的日历」标题栏正下方）：
   - 黑曜石暗金细框卡片，左侧小型哥特星盘徽章，中间主标题 **「命运轮盘」** + 副标题（`今日免费 1 次` / `再抽 ¥xx万` / `今日已达上限`），右侧金色箭头 `开启 ›`。
   - 若 `s.wheel.toyLinkUnlocked === true`，卡片下方紧贴一条细窄的虹彩流光条：**「⚡ 终端隐藏装置 · TOY·LINK 已解锁 → 启动」**。
2. **双 Tab 切换条**：`📅 日程安排` | `🎒 命运背包 (${readyCount})`。
3. **背包 Tab 视图**：
   - 筛选胶囊：`待使用`（默认）/ `已排期` / `已核销` + 右上角「图鉴 ${discovered}/53」入口。
   - 卡片按稀有度从高到低（虹 → 金 → 红 → 灰）展示：左侧对应哥特符号徽章 + 稀有度色边，中间为定稿 `name` 与 `summary`，下方操作栏：
     - `READY` 状态：`📅 排进日历`（主按钮）+ `⚡ 今日启用`（快捷按今日排期并弹接续文本）
     - `SCHEDULED` 状态：显示「已排期至 YYYY-MM-DD HH:mm」+ `查看日程` / `退回背包`
     - `USED` 状态：灰化印章「已核销 · YYYY-MM-DD」
4. **新增 4 个原子玩家操作**（全部经 `applyOperation` + `replayPlayerCommand` + `cj-shenghao:ops:v1:` 日志重放）：
   - `PLAYER_WHEEL_SPIN`：校验免费/付费与余额 → 扣款记账（若付费）→ FNV 抽样 + 保底更新 → 写 `inventory`（及直发 `ASSET` / 置 `toyLinkUnlocked`）。
   - `PLAYER_SCHEDULE_ITEM`：把 `READY` 道具排进指定日期/时间/目标人物，原子创建 `calendar.appointments` 并双向绑定。
   - `PLAYER_UNSCHEDULE_ITEM`：取消日程并将关联道具退回 `READY`。
   - `PLAYER_USE_SECRET_PAGE`：对 `#46` 选定女性立即写入 `wheel.unlockedSecretPages` 并标 `USED`。

---

## 四、与 TD 跳蛋脚本（TOY·LINK v1.11.0）共存方案

### 4.1 已核实的 TD 真实接口（`TOY-LINK脚本 (2).json`）

- **类型与体积**：酒馆助手独立脚本（`type:"script"`, `id:"toylink-device-simulator"`, `v1.11.0`, `207.6 KB`, `content` 为 159 KB 压缩 JS，无源码）。
- **DOM 与层级**：挂在酒馆主页面 `window.parent.document.body`：
  - `#__toylink_host__`（Shadow DOM 面板，`z-index: 2147483000`，`pointer-events: none`）
  - `#__toylink_ball__`（可拖动贴边悬浮球，位置存 `localStorage['toylink_ball_pos']`）
- **暴露的全局 API**：`window.__TOYLINK__ = { version, host, root, ball, page, open, collapse, toggle, stop }`。
- **世界书机制**：默认 `manageWb: true`，启动时自动建/更新世界书 `'TOY·LINK 装置设定'` 并调用 `rebindCharWorldbooks('current', { primary: cur.primary, additional: add.concat(['TOY·LINK 装置设定']) })`。**注意**：它不覆盖主世界书，但它的第一条 `① 既成事实（常驻）` 会常驻告知 AI「角色身上已经戴着震动装置」——**若在玩家抽到 #53 前就绑定，会导致日常开局严重穿帮**。
- **变量与生成**：用 `getVariables / replaceVariables` 写聊天级独立键（不碰 `stat_data.shenghao`），用 `generate` 或 `triggerSlash` 触发回复；自带版本指针自动更新。

### 4.2 三种落点方案对比

| 方案 | 做法 | 优点 | 缺点 / 风险 | 结论 |
|---|---|---|---|---|
| **方案 A：外部独立脚本 + 按需桥接呼出** | 保持 TD 作为独立酒馆助手脚本安装；本卡 `host.js` 只读探测 `win.__TOYLINK__`，在抽中 #53 解锁后通过本卡按钮一键呼出并按需绑定其附加世界书 | ① 零体积占用（省 207 KB）；② 保留 TD 原作者自动更新；③ 未装 TD 时可优雅降级；④ 两套源码零耦合、维护成本最低 | 玩家需额外导入一次 `TOY-LINK脚本.json` 并按提示关掉 TD 的自动建库开关（仅 1 次操作） | **强烈推荐** |
| **方案 B：把 TD 压缩 JS 内联打包进角色卡** | 把 159 KB 压缩 JS 塞进本卡脚本一起构建 | 玩家只需导一张卡 | ① 整卡暴涨 +210 KB；② 破坏 TD 自动更新（其更新器会覆盖独立脚本槽引发双实例冲突）；③ 无源码黑盒极难排错 | 不推荐 |
| **方案 C：放弃 TD 前端，纯文字/世界书模拟** | 不接入 TD，仅用世界书文字描写震动装置 | 零前端冲突 | 完全浪费 TD 精美遥控器 UI 与 9 种波形实时同步的核心乐趣 | 不推荐 |

### 4.3 推荐方案（方案 A）的具体落地细则

1. **加载顺序无关（完全解耦）**：
   - 无论《神豪终端》还是 TOY·LINK 谁先启动，本卡都不在启动时强依赖 `win.__TOYLINK__`，而是在打开日历/点击「⚡ 启动终端装置」时实时探测 `const tl = win.__TOYLINK__`。
2. **两套悬浮球不打架**：
   - **层级互不遮挡**：本卡小手机 `#cj-shenghao-phone-frame` 的 `z-index: 3000`，TD 面板 `#__toylink_host__` 的 `z-index: 2147483000`。当玩家从本卡点「启动 TOY·LINK」时，本卡自动先折叠小手机（`folded = true`），让 TD 遥控器清爽浮在最上层，绝不叠罗汉。
   - **停靠避让**：本卡折叠态计算默认位置时（`phone-geometry.js`），若用户未手动拖过 `miniPosition` 且检测到 `win.document.getElementById('__toylink_ball__')` 位于右侧底部，本卡自动把默认折叠位置上移 `110px`，两颗球上下错开、零重叠。
3. **世界书防穿帮协同（最关键）**：
   - **核心原则**：在 `state.wheel.toyLinkUnlocked === false` 时，`'TOY·LINK 装置设定'` **不应**挂在当前角色卡的 `additional` 世界书里。
   - **本卡启动/切聊天自检**：在 `host.js` 的 `readCurrent()` 里，若检测到当前聊天 `toyLinkUnlocked === false` 但 `H.getCharWorldbookNames('current').additional` 包含 `'TOY·LINK 装置设定'`，不静默硬删用户配置，而是在终端设置页显示一条温和提醒：「检测到 TOY·LINK 附加世界书已提前挂载，建议在 TOY·LINK 设置中关闭「自动建立并绑定世界书」，或点此【暂为本卡解绑】以免未抽奖前穿帮。」
   - **解锁后一键挂载 + 呼出**：抽中 `#53` 解锁后，玩家点「⚡ 启动终端装置」时，`host.js` 执行：
     1. 检查 `H.getWorldbookNames()` 中是否存在 `'TOY·LINK 装置设定'`，若存在且未挂在 `additional`，自动调用 `H.rebindCharWorldbooks('current', { primary: cur.primary, additional: [...add, 'TOY·LINK 装置设定'] })`；
     2. 折叠小手机并调用 `win.__TOYLINK__.open()` 直接弹开遥控器！
4. **未安装 / 卸载 / 关闭后的优雅降级**：
   - 若 `win.__TOYLINK__` 不存在：抽中 `#53` 依然正常发放虹色「终端最终愿望」凭证，可排入日历并在正文兑现任意愿望；点击「⚡ 启动终端装置」时弹出引导弹窗，说明两种玩法：① 直接在正文使用许愿券；② 导入 `TOY-LINK脚本.json` 并启用后刷新即可解锁实体遥控器。**绝不抛错、绝不卡死。**

---

## 五、施工顺序、验收判据与测试影响

### 5.1 分块施工顺序（每块可独立跑测试验收）

| 阶段 | 范围与涉及文件 | 验收判据 |
|---|---|---|
| **M1 · 数据层与核心引擎** | 新增 `src/core/wheel-pool.js`、`src/core/wheel.js`；修改 `src/core/engine.js`（`initialize` / `applyOperation` / `projection`） | 53 条与 `AGY_COPY_rc34_wheel.md` 逐字比对 100% 一致；FNV 确定性、三重保底、阶梯定价、`assertEconomy` 守恒单测全绿 |
| **M2 · Schema、结算与协议** | 修改 `src/runtime/schema.js`、`src/runtime/settlement.js`、`src/content/protocol.txt`、`src/content/state-context.txt`；`project.json` 升 `cardContractRevision: 29` | 模型无法直接写 `wheel`/`inventory`；日程 `COMPLETED` 自动核销背包道具；`CANCELLED` 自动退票；`todaySchedules` 正确进 `_context` |
| **M3 · Host 桥接与重放** | 修改 `src/runtime/host.js`、`src/runtime/phone-geometry.js` | `PLAYER_WHEEL_SPIN` / `PLAYER_SCHEDULE_ITEM` / `PLAYER_UNSCHEDULE_ITEM` 接入 `mutateState` 与 `ops` 日志；删楼/换 swipe 重放不吞奖不白嫖；TOY·LINK 探测、按需绑库与悬浮球避让通过 |
| **M4 · 哥特轮盘 SVG 与动效** | 新增 `src/ui/wheel-svg.js`、`src/ui/wheel-modal.js`；修改 `src/ui/style.css` | 365px 悬浮态与底部宽屏态均清晰锐利；三环错位旋转精准停格在 12 点指针下；灰/红/金/虹四档动效与三套主题（绿/金/紫）适配无违和；增量体积 ≤ 70 KB |
| **M5 · 日历+背包双 Tab 联动** | 修改 `src/ui/screens.js`、`src/ui/app.js` | 日历页入口按钮、日程/背包双 Tab、排进日历弹窗（含目标女性选择）、现金不足变现筹款引导全部跑通 |
| **M6 · 全量回归与实机验收** | 运行 `npm test`、`build --checkpoint`、`check --checkpoint`、8001 实机走一遍免费抽→付费抽→现金不足→排期→正文提示→核销→#53 呼出 TD | 现有 361 条 + 新增单测全绿；整卡 < 1.55 MB；8001 实机截图存档 |

### 5.2 现有单测影响核查与新增单测清单

**可能受影响的现有单测（已核对 `tests/` 目录）**：
1. `tests/native-mvu.test.mjs`：若存在对 `calendar.appointments` 或 `state` 根键的严格快照断言，需补充 `wheel`、`inventory` 与 `sourceItemId/prizeId` 默认值。
2. `tests/projection-paths.test.mjs`：确认新增可选投影键 `todaySchedules`、`bagReadyItems` 不影响原有路径白名单测试。
3. `tests/rc29-ops-replay.test.mjs`：确认 `replayPlayerCommand` 扩展新 `action` 类型后，原有提现/日程/打星重放用例全绿。
4. `tests/rc25-body-economy.test.mjs` / `tests/engine.test.mjs` / `tests/rc9-economy.test.mjs`：确认 `WHEEL_SPIN` 支出与直发资产（`basisCents: 0`）不破坏既有经济守恒与倍率断言。
5. `tests/release.test.mjs` / `tests/script-loader.test.mjs`：因 `cardContractRevision` 升 `29`，同步校验构建哈希与合同号。

**新增单测（4 份）**：
1. `tests/rc34-wheel-core.test.mjs`：逐字校验 53 条名称/摘要/提示语与 `AGY_COPY_rc34_wheel.md` 一致；测试每日免费按 `world.date` 重置、阶梯费率（2%/4%/8%/12%/18%）、¥1,000 保底、6 抽上限、余额不足报 `INSUFFICIENT_CASH`、10/30/60 抽保底、FNV 确定性、直发资产不污染 `tierBasis` 与 `assertEconomy`。
2. `tests/rc34-inventory-calendar.test.mjs`：测试入包、排期写日历、取消退票、模型写 `COMPLETED` 自动核销、背包上限 60、`todaySchedules` 按日进入 `_context`。
3. `tests/rc34-wheel-ops-replay.test.mjs`：测试抽奖与排期写入 `ops` 日志并在回退楼层后确定性重放。
4. `tests/rc34-toylink-bridge.test.mjs`：测试 `win.__TOYLINK__` 存在/缺失时的呼出与降级逻辑、未解锁不自动挂载附加世界书、解锁后按需挂载。

---

## 六、协议与状态说明新增段落（100% 逐字定稿）

> **DSH 铁律**：严禁修改 `protocol.txt` 与 `state-context.txt` 中与轮盘无关的既有内容；以下两段必须按指定行号位置 **100% 逐字插入**。

### 6.1 `src/content/protocol.txt` 新增规则（插在第 16 行之后，成为新的第 17 行）

```text
16.1 命运轮盘与背包日程：wheel与inventory由终端脚本维护，禁止模型直接写。若_context.todaySchedules非空，表示玩家今天有已排定的日程或命运轮盘票券，正文应顺着对应promptHint自然提示今日安排已就绪，由玩家决定是否前往或启用，不得替玩家自动赴约或扣款；当该日程或票券在正文中实际完成兑现后，同轮将对应/shenghao/calendar/appointments/<apptId>/status改为"COMPLETED"（脚本自动核销背包道具）。若票券属于陌生邂逅类且新人物出场，按既有temporaryActors或首次结识规则登记；若为私密档案解锁，同轮在正文揭晓并增量补写该女性physiology/intimacy细节。
```

### 6.2 `src/content/protocol.txt` 新增抄写示例（插在第 25 行末尾之后）

```text
今日轮盘日程兑现核销示例（仅当玩家在正文中实际完成对应日程时输出，放进同一个UpdateVariable块）：
[{"op":"replace","path":"/shenghao/calendar/appointments/appt_轮盘日程ID/status","value":"COMPLETED"}]
```

### 6.3 `src/content/state-context.txt` 新增说明（插在第 6 行之后，成为新的第 7 行）

```text
todaySchedules仅列出今天（与world.date一致）已排定且尚未完成的日程与命运轮盘票券（含定稿promptHint提示语），正文应自然提示今日日程已就绪但保留玩家决定权；bagReadyItems列出玩家背包中尚未排期的票券索引，只作事实参考。
```

---

## 七、补充建议与裁剪清单

### 建议补做（小成本高爽感）
1. **哥特符号图鉴（53 格收集墙）**：盲抽前轮盘格子不显示名称；每抽中一种，记录进 `wheel.discoveredPrizeIds`，在背包右上角可点开「图鉴 `N/53`」查看已点亮的哥特符号与对应奖品，未抽中的显示暗灰轮廓 + `???`，强化重玩动力。
2. **「卖房卖车筹款」一键草稿**：余额不足且名下有资产时，弹窗不仅提示缺口金额，还提供一个「生成急售变现正文」按钮（列出当前名下资产，生成类似「我决定立刻挂牌急售名下『XXX』变现筹款」的可编辑文本），把 YG 提到的「为了抽奖卖房卖车」打通成一句话就能玩起来的正文闭环。
3. **防连点与回退说明**：利用既有 `cj-shenghao:ops:v1:` 日志天然防止删楼刷奖；在弹窗底部加一行极简暗字「每次转动即时入账，同分支回退保留原结果」，避免玩家误以为是 bug。

### 建议裁剪（不做）
1. **不做「十连抽」按钮**：会破坏「每日免费 1 次 + 再抽按身家阶梯涨价、越抽越肉疼越纠结」的核心心理节奏，也容易误触一口气把现金抽穿。
2. **不把 TD 脚本打包塞进角色卡**：保持方案 A 外部独立脚本桥接，省 207 KB 卡体积且不破坏原作者自动更新。
