# 《神豪终端》零 API + 免开局表单 · 实机测试方案

> 适用版本：`2.0.0-rc.36`（`schemaVersion: 3` / `cardContractRevision: 31`）
> 测试实例：`http://127.0.0.1:8001/`（`E:\Ajiuguanagentceshi\SillyTavern`，数据目录 `data\default-user`）
> 红线：**严禁触碰 8000 实例；严禁将测试脚手架打入发行卡；严禁产生任何模型 API 调用；不得修改角色卡源码、世界书或构建产物。**

---

## A 方案对比与选定

### 1. 候选方案对比

| 维度 | 方案 ①：预置 JSONL 存档注入（+ 零 API 网络熔断） | 方案 ②：卡内测试入口（`?test=1` / 隐藏按钮 / 世界书开关） | 方案 ③：独立 Harness（加载真 `runtime.js` + 真 MVU） | 方案 ④：页面内 `Mvu.replaceMvuData` 热注入（不改盘） |
|---|---|---|---|---|
| **真 `host.js` / 真 MVU / 真 Zod 4** | ✅ 全真 | ✅ 全真 | ⚠️ 缺酒馆壳层与真实 `SillyTavern.getContext()` | ✅ 全真 |
| **真 TavernHelper 跨 iframe 身份** | ✅ 全真（脚本在 `TH-script--*` iframe，小手机与轮盘在顶层 body） | ✅ 全真 | ❌ 无法复现 `event.source !== window.parent` 等真酒馆差异 | ✅ 全真 |
| **真正则与世界书（含 `[InitVar]` 校验）** | ✅ 全真 | ✅ 全真 | ❌ 无酒馆正则与世界书引擎 | ⚠️ 跳过冷加载与 `[InitVar]` 链路 |
| **落盘与刷新回读 / `CHAT_CHANGED` / 删楼 / 切 swipe** | ✅ 全真（完整测 JSONL 读写与 `applyMissingPlayerOps`） | ✅ 可测，但启动路径失真 | ❌ 无真实 JSONL 落盘与酒馆事件 | ❌ 刷新前才测得到，无法验证初始冷读盘 |
| **是否污染发行卡** | ✅ **零污染**（完全外部脚本） | ❌ **污染发行卡**（必须改卡内代码或维护双分支构建，违反硬要求） | ✅ 零污染 | ✅ 零污染 |
| **零 API 保证** | ✅ 不点开局提交 + Playwright 网络熔断 | ✅ 跳过提交 | ✅ 天然离线 | ✅ 不点提交 |
| **切换测试矩阵速度** | 快（2–5 秒：写 JSONL + `/chat-load` 或刷新） | 快 | 极快（<1 秒） | 极快（<1 秒） |
| **主要代价 / 盲区** | 每次切矩阵需写盘并切聊天或刷新页 | 违反「测试代码不进发行卡」红线，维护风险高 | 不能替代实机，仅适合 UI 样式与布局初筛 | 不能测冷启动读盘与 `[InitVar]` 冲突 |

### 2. 选定结论

**选定：方案 ①「预置 JSONL 存档注入 + Playwright 零 API 熔断」作为唯一实机验收主方案**；现有 `.work/harness/host.html`（方案 ③）仅保留为 UI 样式快筛辅助，绝不替代实机。

核心依据：
1. **100% 跑真 runtime**：真 `host.js`、真 `schema-entry.js`（Zod 4）、真 MagVarUpdate、真 `TH-script--*` 独立 iframe 身份、真 `#cj-shenghao-phone-frame` / `#cj-shenghao-wheel-frame` 双顶层 iframe、真正则与世界书。
2. **零发行卡污染**：不改动 `src/`、`dist/` 或角色卡内任何一行代码。
3. **可完整覆盖所有必测项**：冷加载、五页导航、三盘全屏与握手、背包与商城、`PLAYER_*` 本地引擎结算、MVU `replaceMvuData` 落盘与刷新回读、`CHAT_CHANGED` / 删楼 / 切 swipe 回归。

---

## B 预置状态规格

### 1. Zod 必填字段与可省字段清单（对照 `src/runtime/schema.js`）

| 路径 | 必填 / 可省 | 类型与约束 | 省略时的行为 |
|---|---|---|---|
| `schemaVersion` | **必填** | 字面量 `3` | Zod 校验失败，小手机不出现 |
| `meta.initialized` | **必填** | 字面量 `true` | `host.js` 第 78 行直接跳过该楼层，小手机不出现 |
| `meta.initKey` | **必填** | `^[a-zA-Z0-9_-]{1,100}$` | 必填；**每套测试矩阵必须用新值**，否则 `host.js` 会把旧 `localStorage` 操作日志重放进来 |
| `meta.branchKey` | **必填** | `string`（可填 `"test:init"`，读盘时 `host.js` 第 78 行会用当前 `characterId:chatId` 覆盖） | Zod 报错 |
| `meta.revision` | **必填** | 非负整数（如 `1`） | Zod 报错 |
| `meta.sourceAnchor` | **必填** | `anchor \| null`（可填 `null`） | 填 `null` 即可过 Zod；若末楼是 `assistant` 且正文 >5 字，填 `null` 会触发 `NATIVE_NOT_PROCESSED` 诊断，**故预置末楼应为 `is_user: true` 或将 `sourceAnchor.messageId` 对齐末楼 ID** |
| `user` | **必填** | 必填：`id: "USER"`, `name`, `age`(1–120), `beautyScore`(1–100), `gender`, `appearance`, `occupation`, `background`, `city`, `location`, `workLifeDescription`, `cashCents`(整数≥0), `initialCashCents`(整数≥0), `currentClothes`, `currentPose`, `currentAction` | 缺任一必填项 Zod 报错；`prowessScore`(70)、`sexualAbility`(全70)、`genitals`、`body`、`heightCm`/`weightKg`/`shoeSizeEu`(null)、`abilities`([]) 均可省，由 Zod 自动补默认值 |
| `world` | **必填** | 必填：`date`(`YYYY-MM-DD`), `time`(`HH:mm`) | `weather`(`"晴"`)、`timeZone`(`"Asia/Shanghai"`) 可省 |
| `scene` | **必填** | `sceneId`, `location`, `timeHint`, `presentCharacterIds`(`string[]`), `temporaryActors`(`[]`), `sceneRevision`(整数≥0) | 缺任一项 Zod 报错 |
| `characters` | **必填** | `Record<id, Character>`（可为 `{}`）。每名角色必填：`id`, `name`, `age`, `beautyScore`(1–100 或 `null`), `affection`(0–100), `relationshipLabel`(1–12字) | 其余字段（`corruption`, `aliases`, `occupation`, `personalityTags`, `physiology`, `outfit`, `intimacy`, `limits`, `trackingState` 等）均有 `.default()`/`.prefault()`，可省略 |
| `identityMap` | **必填** | `Record<string, string>`（可 `{}`） | Zod 报错 |
| `hiddenTemporary` | **必填** | `Record<string, Temp \| boolean>`（可 `{}`） | Zod 报错 |
| `finance` | **必填** | `{ ledger: {}, assets: {} }` | Zod 报错 |
| `rewardEvents` | **必填** | `Record<string, RewardEvent>`（可 `{}`） | Zod 报错 |
| `withdrawals` | **必填** | `Record<id, Withdrawal>`（可 `{}`） | Zod 报错；若非空则直接解锁星愿圣盘 |
| `recoveries` | **必填** | `Record<string, Recovery>`（可 `{}`） | Zod 报错 |
| `operationHistory` | **必填** | `Record<string, OpRecord>`（可 `{}`） | Zod 报错 |
| `notifications` | **必填** | `Record<string, Notification>`（可 `{}`） | Zod 报错 |
| `facts` | **必填** | `Record<string, unknown>`（可放 `{ "__testMarker": { "noapi": true } }`） | Zod 报错 |
| `calendar` | **必填** | `{ appointments: {} }` | Zod 报错 |
| `pendingEvents` | 可省 | `unknown[]` | 默认 `[]` |
| `_context` | 可省 | `string` | 默认 `""`，首次执行任意 `PLAYER_*` 操作后由 `refreshContext()` 自动重写 |
| `wheel` | 可省 | `wheelState`（含 `starPoints`, `pityRed/Gold/Rainbow`, `wishWeekKey`, `casinoRound` 等） | 带 `.prefault({})`，省略时自动补齐全 0 默认值（命运轮盘免费可用、0 积分、0 保底） |
| `inventory` | 可省 | `Record<id, InventoryItem>` | 默认 `{}`（空背包） |

### 2. 可直接照抄的最小可用 `stat_data.shenghao` JSON（已核对 100% 过 Zod 4）

```json
{
  "schemaVersion": 3,
  "meta": {
    "initialized": true,
    "initKey": "noapi_test_min_001",
    "branchKey": "test:placeholder",
    "revision": 1,
    "sourceAnchor": null
  },
  "user": {
    "id": "USER",
    "name": "陆时行",
    "age": 26,
    "beautyScore": 82,
    "gender": "男",
    "appearance": "短发利落，眉眼沉稳",
    "occupation": "独立投资人",
    "background": "在云澜市打拼三年的青年投资人",
    "city": "云澜市",
    "location": "江城区·翠湖公寓客厅",
    "workLifeDescription": "平时居家看盘，周末健身看书",
    "cashCents": 20000000,
    "initialCashCents": 20000000,
    "currentClothes": "深灰居家卫衣与长裤",
    "currentPose": "靠在沙发上看手机",
    "currentAction": "查看终端面板"
  },
  "world": {
    "date": "2026-11-20",
    "time": "10:00"
  },
  "scene": {
    "sceneId": "scene_test_001",
    "location": "江城区·翠湖公寓客厅",
    "timeHint": "上午",
    "presentCharacterIds": ["char_test_a"],
    "temporaryActors": [],
    "sceneRevision": 1
  },
  "characters": {
    "char_test_a": {
      "id": "char_test_a",
      "name": "沈清弦",
      "age": 24,
      "beautyScore": 88,
      "affection": 45,
      "relationshipLabel": "合租室友"
    }
  },
  "identityMap": {},
  "hiddenTemporary": {},
  "finance": {
    "ledger": {},
    "assets": {}
  },
  "rewardEvents": {},
  "withdrawals": {},
  "recoveries": {},
  "operationHistory": {},
  "notifications": {},
  "facts": {
    "__testMarker": {
      "noapi": true,
      "preset": "empty_bag"
    }
  },
  "calendar": {
    "appointments": {}
  }
}
```

### 3. 如何让 MVU 认这份状态（基于 8001 实机 JSONL 与 `host.js` 源码核实）

1. **写在哪一条消息**：
   - **第 0 行**（JSONL 行号 0）：`chat_metadata` 对象（含 `user_name`、`character_name`、`chat_metadata: { variables: {} }`）。**不需要**设置 `variables_initialized`（实机为 `undefined`）。
   - **第 1 行**（0 楼，`is_user: false`）：保留开场白文本与 `<CJ_SHENGHAO_OPENING/>`，其 `variables` 写：
     ```json
     [{
       "initialized_lorebooks": { "神豪终端 · v2.0.0-rc.36": [] },
       "stat_data": { "shenghao": null },
       "schema": "没有用别管这个"
     }]
     ```
   - **第 2 行**（1 楼，`is_user: true`）：**把合法的 `stat_data.shenghao` 写在这里的 `variables[0].stat_data.shenghao`**，同楼带上：
     - `initialized_lorebooks: { "<当前角色卡绑定世界书名>": [] }`（必须包含卡绑定的世界书名，例如 `"神豪终端 · v2.0.0-rc.36"`）
     - `schema: "没有用别管这个"`（与 MagVarUpdate 实机存储格式一致）
   - 若要测试「删楼回退 / 切 swipe」，再追加 **第 3 行**（2 楼，`is_user: false`，带两条 `swipes` 和对应的 `variables[0]`/`variables[1]`，且 `sourceAnchor.messageId` 设为 `2`）。
2. **`[InitVar]` 会不会把状态重置成 `null`？不会**，原因有二：
   - `scripts/build.mjs` 第 46 行生成的 `[InitVar]` 条目默认 `disabled: true`；
   - 只要楼层 `variables[0].initialized_lorebooks` 已包含当前绑定的世界书名，MVU 就判定已完成初始化，**不会再执行 `[InitVar]` 覆写**。
3. **MVU 加载时会不会重算/覆盖？不会**：
   - 仅切换聊天 / 刷新页面加载 JSONL 时，MVU 只读取楼层 `variables[swipe_id ?? 0]`，不触发模型解析；
   - `host.js` 第 77–79 行 `readCurrent()` 从末楼倒序调用 `Mvu.getMvuData({ type: 'message', message_id })`，命中 `vars.stat_data.shenghao.meta.initialized === true` 并通过 `schemas().state.parse(...)` 即立刻接管状态。
4. **必须规避的 `localStorage` 残留坑**：
   - `host.js` 第 32–44 行会在 `localStorage['cj-shenghao:ops:v1:' + branchKey]` 记录玩家本地操作日志。若新预置状态的 `meta.initKey` 与上次相同，加载时会把旧操作重放进新状态。
   - **硬规则**：每次注入必须生成唯一 `meta.initKey`（如 `noapi_test_<preset>_<Date.now()>`），触发 `host.js` 第 39 行自动丢弃旧日志。

### 4. 如何绕过开局表单

- **精确判定条件**：
  - `src/runtime/host.js` 第 71 行：`if (phone) phone.style.display = view.state ? 'block' : 'none';`
  - `src/ui/app.js` 第 89 行：开局表单 `wizard()` 检测到 `if (view?.state)` 后直接渲染「你的人生已启程」状态卡，不再显示 `#wizard` 表单与「开始我的人生」按钮。
- **出现时延**：`host.js` 初始化末尾（第 476 行）立即 `await readCurrent()`，另有 `500ms` 轮询与 `70ms` 防抖。MVU 与 Zod 注册就绪后，**100ms–700ms 内** `#cj-shenghao-phone-frame` 变为 `display: block`。
- **展开方式**：小手机初始为折叠态（iframe 内显示 `#folded` 按钮）。自动化脚本点击 `#folded` 即可展开 5 页主界面；也可在打开前预先写入 `localStorage['cj-shenghao:ui:v3:' + branchKey]` 的 `prefs`（如 `{ displayDock: 'bottom', dockExpanded: true, randomAvatar: false }`）实现底部停靠直接展开。
- **无需修改 `setupDraft` / `setupStep`**。

### 5. 如何保证零 API（三层硬断电）

1. **行为层**：脚本绝不调用 `connectApi()`，绝不点击「开始我的人生」「模型一键补全设定」「确认建档」，绝不发送聊天消息或 `/trigger`。
2. **网络层硬熔断（Playwright `page.route`）**：对所有酒馆生成接口直接 `route.abort('blockedbyclient')` 并递增 `apiViolations` 计数器（任一命中即判整轮测试 **FAIL**）：
   - 拦截模式：`/api/backends/**`、`/api/openai/**`、`/api/anthropic/**`、`/api/google/**`、`/api/openrouter/**`、`/api/novelai/**`、`/api/horde/**`、`/api/kobold/**`、`/api/textgen/**`、`**/generate`、`**/chat/completions`。
3. **JS 运行时哨兵（`page.addInitScript`）**：在页面加载前包一层 `window.fetch` 审计钩子，记录任何发往上述路径的请求 URL 到 `window.__NOAPI_VIOLATIONS__`；测试结束时断言 `window.__NOAPI_VIOLATIONS__.length === 0`。
4. **副作用**：`page.route` 与 `addInitScript` 仅活在本次 Playwright 浏览器上下文内，**不改 8001 的 `settings.json` 或任何 API 配置**，对 YG 手动使用零影响。

---

## C 一键脚本

下面两份脚本可直接落盘到 `scripts/` 运行（Node 24 + 项目已有 `zod`；运行脚本支持直接 `node` + Playwright 或通过 `ego-browser nodejs` 执行）。

### 1. 预置存档生成 / 备份 / 还原脚本：`scripts/test-noapi-seed.mjs`

```javascript
// scripts/test-noapi-seed.mjs
// 用法：
//   生成测试聊天（默认隔离副本，不动原聊天）：
//     node scripts/test-noapi-seed.mjs --char 神豪终端27 --preset three_cards
//   覆盖指定已有聊天（先自动备份）：
//     node scripts/test-noapi-seed.mjs --char 神豪终端27 --preset max_pity --target "某聊天.jsonl"
//   一键还原 / 清理所有测试聊天：
//     node scripts/test-noapi-seed.mjs --restore
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { createSchema } from '../src/runtime/schema.js';
import { completeInitialState } from '../src/runtime/settlement.js';

const ST_ROOT = path.resolve('E:/Ajiuguanagentceshi/SillyTavern');
const CHATS_ROOT = path.join(ST_ROOT, 'data', 'default-user', 'chats');
const BACKUP_ROOT = path.resolve('E:/SHZDCHOSSS/.work/test-noapi-backups');
const MANIFEST_PATH = path.join(BACKUP_ROOT, 'manifest.json');
const TEST_PREFIX = '__NOAPI_TEST_';
const DEFAULT_BOOK = '神豪终端 · v2.0.0-rc.36';

function assertSafePath(p) {
  const abs = path.resolve(p);
  if (!abs.toLowerCase().startsWith(ST_ROOT.toLowerCase())) {
    throw new Error(`SAFETY_BLOCK: 路径越界，只允许操作 8001 实例目录：${abs}`);
  }
  if (/8000/.test(abs)) {
    throw new Error(`SAFETY_BLOCK: 禁止任何涉及 8000 的路径：${abs}`);
  }
  return abs;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const name = k.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[name] = true;
    else { out[name] = next; i++; }
  }
  return out;
}

function buildPresetState(preset, initKey) {
  const schemas = createSchema(z);
  const base = {
    schemaVersion: 3,
    meta: { initialized: true, initKey, branchKey: 'test:noapi', revision: 1, sourceAnchor: null },
    user: {
      id: 'USER', name: '陆时行', age: 26, beautyScore: 82, gender: '男',
      appearance: '短发利落，眉眼沉稳', occupation: '独立投资人',
      background: '在云澜市打拼三年的青年投资人', city: '云澜市',
      location: '江城区·翠湖公寓客厅', workLifeDescription: '平时居家看盘，周末健身看书',
      cashCents: 20000000, initialCashCents: 20000000,
      currentClothes: '深灰居家卫衣与长裤', currentPose: '靠在沙发上看手机', currentAction: '查看终端面板',
      abilities: [],
    },
    world: { date: '2026-11-20', time: '10:00', weather: '晴', timeZone: 'Asia/Shanghai' },
    scene: {
      sceneId: 'scene_noapi_01', location: '江城区·翠湖公寓客厅', timeHint: '上午',
      presentCharacterIds: ['char_a'], temporaryActors: [], sceneRevision: 1,
    },
    characters: {
      char_a: { id: 'char_a', name: '沈清弦', age: 24, beautyScore: 88, affection: 45, relationshipLabel: '合租室友', occupation: '建筑设计师' },
      char_b: { id: 'char_b', name: '陆晚晴', age: 25, beautyScore: 91, affection: 62, relationshipLabel: '学姐', occupation: '艺术策展人' },
    },
    identityMap: {}, hiddenTemporary: {},
    finance: { ledger: {}, assets: {} },
    rewardEvents: {}, withdrawals: {}, recoveries: {},
    operationHistory: {}, notifications: {},
    facts: { __testMarker: { noapi: true, preset, createdAt: new Date().toISOString() } },
    calendar: { appointments: {} },
    pendingEvents: [], _context: '',
    wheel: {}, inventory: {},
  };

  let s = schemas.state.parse(completeInitialState(base, { startDate: '2026-11-20', startTime: '10:00' }));

  if (preset === 'empty_bag') {
    // 20 万起步、未提现、空背包、星愿圣盘锁定、命运轮盘免费可用
    s.user.cashCents = 20000000;
    s.user.initialCashCents = 20000000;
  } else if (preset === 'three_cards') {
    s.user.cashCents = 150000000; // 150 万
    s.wheel.starPoints = 600;
    s.inventory = {
      card_gray_1: { itemId: 'card_gray_1', source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_gray', rarity: 'gray', obtainedDate: '2026-11-20', status: 'READY', currentPoints: 20, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      card_red_1:  { itemId: 'card_red_1',  source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_red',  rarity: 'red',  obtainedDate: '2026-11-20', status: 'READY', currentPoints: 60, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      card_gold_1: { itemId: 'card_gold_1', source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_gold', rarity: 'gold', obtainedDate: '2026-11-20', status: 'READY', currentPoints: 200, winStreak: 1, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      prize_1:     { itemId: 'prize_1',     source: 'WHEEL',       category: 'WHEEL_PRIZE', refId: 'w14',     rarity: 'red',  obtainedDate: '2026-11-20', status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
    };
  } else if (preset === 'wish_unlocked') {
    s.user.cashCents = 250000000; // 250 万 >= 100 万解锁星愿圣盘
    s.wheel.starPoints = 300;
    s.wheel.wishWeekKey = '2026-W47';
    s.wheel.wishWeekFreeUsed = false;
    s.wheel.wishTodayDate = '2026-11-20';
    s.wheel.wishTodaySpins = 0;
  } else if (preset === 'high_wealth') {
    s.user.cashCents = 5000000000; // 5000 万
    s.user.abilities = [
      { abilityId: 'ab_voice', level: 2, obtainedDate: '2026-11-19' },
      { abilityId: 'ab_gaze',  level: 1, obtainedDate: '2026-11-19' },
    ];
    s.finance.assets = {
      asset_house_1: { assetId: 'asset_house_1', kind: 'HOUSE', name: '云澜湾江景大平层', ownerId: 'USER', bookValueCents: 3800000000, basisCents: 3800000000, status: 'OWNED', acquisitionEventId: 'init', acquisitionIsInitial: true, description: '320㎡南向一线江景平层，带双车位', locationNote: '东岸滨江', ownershipNote: '本人全额所有' },
      asset_car_1:   { assetId: 'asset_car_1',   kind: 'CAR',   name: '保时捷 911 GT3',   ownerId: 'USER', bookValueCents: 260000000,  basisCents: 260000000,  status: 'OWNED', acquisitionEventId: 'init', acquisitionIsInitial: true, description: '哑光黑选装碳陶刹车', locationNote: '地下车库 B2', ownershipNote: '本人全额所有' },
    };
    s.wheel.starPoints = 1200;
  } else if (preset === 'max_pity') {
    s.user.cashCents = 500000000; // 500 万
    s.wheel.starPoints = 4000;
    s.wheel.pityRed = 9;
    s.wheel.pityGold = 29;
    s.wheel.pityRainbow = 59;
    s.wheel.cardPityRed = 9;
    s.wheel.cardPityGold = 29;
    s.wheel.lastFreeDate = '2026-11-20'; // 跳过免费，便于测付费/积分抽保底
    s.wheel.wishWeekKey = '2026-W47';
    s.wheel.wishWeekFreeUsed = false;
  } else {
    throw new Error(`未知 preset: ${preset}（可选：empty_bag | three_cards | wish_unlocked | high_wealth | max_pity）`);
  }

  return schemas.state.parse(s);
}

function makeChatLines({ charName, bookName, state, withSwipeFloor }) {
  const initBooks = { [bookName]: [] };
  const l0 = {
    user_name: state.user.name,
    character_name: charName,
    chat_metadata: { integrity: crypto.randomUUID(), variables: {}, extensions: {} },
  };
  const l1 = {
    name: charName, is_user: false, is_system: false,
    send_date: '2026-11-20 09:59:00',
    mes: '【测试开场占位】\n\n<CJ_SHENGHAO_OPENING/>',
    swipe_id: 0, swipes: ['【测试开场占位】\n\n<CJ_SHENGHAO_OPENING/>'],
    variables: [{ initialized_lorebooks: initBooks, stat_data: { shenghao: null }, schema: '没有用别管这个' }],
  };
  const l2 = {
    name: state.user.name, is_user: true, is_system: false,
    send_date: '2026-11-20 10:00:00',
    mes: `【零API测试预置锚点 · ${state.facts.__testMarker.preset}】`,
    variables: [{ initialized_lorebooks: initBooks, stat_data: { shenghao: state }, schema: '没有用别管这个' }],
  };
  const lines = [l0, l1, l2];
  if (withSwipeFloor) {
    const s2 = structuredClone(state);
    s2.meta.revision = state.meta.revision + 1;
    s2.meta.sourceAnchor = { branchKey: 'test:noapi', messageId: 2, swipeId: 0, fingerprint: 'noapi_floor2_s0' };
    const s2Alt = structuredClone(state);
    s2Alt.meta.revision = state.meta.revision + 1;
    s2Alt.meta.sourceAnchor = { branchKey: 'test:noapi', messageId: 2, swipeId: 1, fingerprint: 'noapi_floor2_s1' };
    lines.push({
      name: charName, is_user: false, is_system: false,
      send_date: '2026-11-20 10:01:00',
      mes: '（测试回归用 2 楼 · 分支 A）',
      swipe_id: 0,
      swipes: ['（测试回归用 2 楼 · 分支 A）', '（测试回归用 2 楼 · 分支 B）'],
      variables: [
        { initialized_lorebooks: initBooks, stat_data: { shenghao: s2 }, schema: '没有用别管这个' },
        { initialized_lorebooks: initBooks, stat_data: { shenghao: s2Alt }, schema: '没有用别管这个' },
      ],
    });
  }
  return lines.map((x) => JSON.stringify(x)).join('\n') + '\n';
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { records: [] };
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}
function saveManifest(m) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2), 'utf8');
}

function restoreAll() {
  const m = readManifest();
  for (const rec of [...m.records].reverse()) {
    assertSafePath(rec.targetFile);
    if (rec.kind === 'created') {
      if (fs.existsSync(rec.targetFile)) fs.unlinkSync(rec.targetFile);
      console.log('[RESTORE] 已删除测试聊天:', rec.targetFile);
    } else if (rec.kind === 'overwritten' && rec.backupFile && fs.existsSync(rec.backupFile)) {
      fs.copyFileSync(rec.backupFile, rec.targetFile);
      console.log('[RESTORE] 已还原原聊天:', rec.targetFile);
    }
  }
  saveManifest({ records: [] });
  console.log('[RESTORE_OK] 8001 测试现场已全部清场还原。');
}

const args = parseArgs(process.argv.slice(2));
if (args.restore) {
  restoreAll();
  process.exit(0);
}

const charFolder = args.char || '神豪终端27';
const preset = args.preset || 'empty_bag';
const bookName = args.book || DEFAULT_BOOK;
const withSwipeFloor = Boolean(args['with-swipe-floor']);
const charDir = assertSafePath(path.join(CHATS_ROOT, charFolder));
fs.mkdirSync(charDir, { recursive: true });

const initKey = `noapi_test_${preset}_${Date.now()}`;
const state = buildPresetState(preset, initKey);
const content = makeChatLines({ charName: charFolder.replace(/\d+$/, ''), bookName, state, withSwipeFloor });

let targetFile;
const m = readManifest();
if (args.target) {
  targetFile = assertSafePath(path.join(charDir, args.target));
  if (fs.existsSync(targetFile)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
    const backupFile = path.join(BACKUP_ROOT, `${Date.now()}-${path.basename(targetFile)}`);
    fs.copyFileSync(targetFile, backupFile);
    m.records.push({ kind: 'overwritten', targetFile, backupFile, at: new Date().toISOString() });
  } else {
    m.records.push({ kind: 'created', targetFile, at: new Date().toISOString() });
  }
} else {
  const chatName = `${TEST_PREFIX}${preset}.jsonl`;
  targetFile = assertSafePath(path.join(charDir, chatName));
  if (!m.records.some((r) => r.targetFile === targetFile)) {
    m.records.push({ kind: 'created', targetFile, at: new Date().toISOString() });
  }
}

fs.writeFileSync(targetFile, content, 'utf8');
saveManifest(m);
console.log(JSON.stringify({
  ok: true,
  preset,
  initKey,
  chatFile: path.basename(targetFile),
  chatId: path.basename(targetFile, '.jsonl'),
  targetFile,
}, null, 2));
```

### 2. 一键实机断言脚本：`scripts/test-noapi-run.mjs`

```javascript
// scripts/test-noapi-run.mjs
// 用法（需 8001 正在运行；通过 ego-browser 或已安装的 playwright 执行）：
//   node scripts/test-noapi-run.mjs --avatar 神豪终端27.png --char 神豪终端27 --preset three_cards
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:8001/';
const SHOT_DIR = path.resolve('E:/SHZDCHOSSS/reports/noapi-test-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

// 端口硬红线校验
if (new URL(BASE_URL).port !== '8001') {
  throw new Error('SAFETY_BLOCK: 仅允许连接 8001 测试实例');
}

const API_BLOCK_PATTERNS = [
  '**/api/backends/**',
  '**/api/openai/**',
  '**/api/anthropic/**',
  '**/api/google/**',
  '**/api/openrouter/**',
  '**/api/novelai/**',
  '**/api/horde/**',
  '**/api/kobold/**',
  '**/api/textgen/**',
  '**/generate',
  '**/chat/completions',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[k.slice(2)] = true;
    else { out[k.slice(2)] = next; i++; }
  }
  return out;
}

async function waitWheelIdleAndResult(page, wheelFrame, prevRevision, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const api = window.__CJ_SHENGHAO_V2__;
      const dbg = api?.wheelDebug?.() || {};
      const rev = api?.read?.()?.state?.meta?.revision ?? 0;
      return { spinning: !!dbg.spinning, rev };
    });
    const resultOn = await wheelFrame.locator('#wfResult.on').isVisible().catch(() => false);
    const ringSpinning = await wheelFrame.locator('#wfSvg .ring.is-spinning').count().catch(() => 1);
    if (resultOn && ringSpinning === 0 && !state.spinning && state.rev > prevRevision) {
      return state;
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`WHEEL_SETTLE_TIMEOUT: prevRevision=${prevRevision}`);
}

const args = parseArgs(process.argv.slice(2));
const avatar = args.avatar || '神豪终端27.png';
const charFolder = args.char || avatar.replace(/\.png$/i, '');
const preset = args.preset || 'empty_bag';
const dock = args.dock || 'float';

// 1. 生成并注入预置存档
const seedRaw = execFileSync(process.execPath, [
  path.resolve('E:/SHZDCHOSSS/scripts/test-noapi-seed.mjs'),
  '--char', charFolder,
  '--preset', preset,
  ...(args['with-swipe-floor'] ? ['--with-swipe-floor'] : []),
], { encoding: 'utf8' });
const seed = JSON.parse(seedRaw);
console.log('[SEED_OK]', seed.chatId, seed.initKey);

const browser = await chromium.launch({ headless: args.headed ? false : true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

// 2. 零 API 硬熔断与 JS 哨兵
const apiViolations = [];
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
for (const pattern of API_BLOCK_PATTERNS) {
  await page.route(pattern, async (route) => {
    apiViolations.push({ url: route.request().url(), method: route.request().method() });
    await route.abort('blockedbyclient');
  });
}
await page.addInitScript(() => {
  window.__NOAPI_VIOLATIONS__ = [];
  const origFetch = window.fetch.bind(window);
  window.fetch = function (...fArgs) {
    const url = String(fArgs[0]?.url || fArgs[0] || '');
    if (/\/api\/(backends|openai|anthropic|google|openrouter)|\/generate\b|\/chat\/completions/.test(url)) {
      window.__NOAPI_VIOLATIONS__.push(url);
    }
    return origFetch(...fArgs);
  };
});

try {
  // 3. 打开 8001（不连 API！）
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => document.readyState === 'complete' && !document.getElementById('preloader') && !!document.getElementById('send_form'), { timeout: 25000 });

  // 4. 打开指定角色卡并切换到测试聊天（不触发生成）
  await page.evaluate(async ({ av, chatId }) => {
    const ctx = window.SillyTavern.getContext();
    const idx = ctx.characters.findIndex((c) => c.avatar === av);
    if (idx < 0) throw new Error(`CHAR_NOT_FOUND:${av}`);
    await ctx.selectCharacterById(idx);
    await new Promise((r) => setTimeout(r, 800));
    await window.openCharacterChat(chatId);
  }, { av: avatar, chatId: seed.chatId });

  // 5. 等待真实 host.js + MVU + Zod 识别预置状态并显示小手机
  await page.waitForFunction((expectedInitKey) => {
    const frame = document.getElementById('cj-shenghao-phone-frame');
    const api = window.__CJ_SHENGHAO_V2__;
    const v = api?.read?.();
    return !!frame && getComputedStyle(frame).display !== 'none' && v?.state?.meta?.initKey === expectedInitKey;
  }, seed.initKey, { timeout: 15000 });

  // 可选修改 prefs（如切换底部停靠 / 关闭随机头像）
  await page.evaluate((displayDock) => {
    window.__CJ_SHENGHAO_V2__.preferences({ displayDock, randomAvatar: false });
  }, dock);

  // 6. 展开小手机并断言 5 个 Tab 全部渲染
  const phoneFrame = page.frameLocator('#cj-shenghao-phone-frame');
  const foldedBtn = phoneFrame.locator('#folded');
  if (await foldedBtn.isVisible().catch(() => false)) {
    await foldedBtn.click();
  }
  const expectedTabs = ['scene', 'women', 'mine', 'wealth', 'wheel'];
  for (const t of expectedTabs) {
    await phoneFrame.locator(`[data-tab="${t}"]`).first().waitFor({ state: 'visible', timeout: 5000 });
  }

  // 逐页切换截图
  for (const t of expectedTabs) {
    await phoneFrame.locator(`[data-tab="${t}"]`).first().click();
    await phoneFrame.locator(`[data-tab="${t}"][aria-current="page"]`).first().waitFor({ state: 'visible', timeout: 3000 });
  }
  const phoneShot = path.join(SHOT_DIR, `${preset}-phone-wheel-tab.png`);
  await page.screenshot({ path: phoneShot });

  // 7. 打开全屏轮盘并验证真跨 iframe 握手（WHEEL_READY -> WHEEL_INIT -> WHEEL_BUILT）
  await phoneFrame.locator('[data-open-wheel="play"]').first().click();
  await page.waitForFunction(() => {
    const f = document.getElementById('cj-shenghao-wheel-frame');
    const d = window.__CJ_SHENGHAO_V2__?.wheelDebug?.();
    return !!f && getComputedStyle(f).display !== 'none' && d?.open && d?.ready;
  }, { timeout: 10000 });

  const wheelFrame = page.frameLocator('#cj-shenghao-wheel-frame');
  await wheelFrame.locator('#wfSvg .ring').first().waitFor({ state: 'visible', timeout: 8000 });

  // 量测轮盘视口边界，确保不裁切
  const wheelGeom = await wheelFrame.locator('#wfRoot').evaluate(() => {
    const svgRect = document.getElementById('wfSvg')?.getBoundingClientRect();
    const sideRect = document.getElementById('wfSide')?.getBoundingClientRect();
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      svg: svgRect ? { w: Math.round(svgRect.width), h: Math.round(svgRect.height), right: Math.round(svgRect.right), bottom: Math.round(svgRect.bottom) } : null,
      side: sideRect ? { w: Math.round(sideRect.width), right: Math.round(sideRect.right), bottom: Math.round(sideRect.bottom) } : null,
      wheelErrs: window.__CJ_WHEEL_ERR__ || [],
    };
  });
  if (!wheelGeom.side || wheelGeom.side.right > wheelGeom.vw + 2 || wheelGeom.wheelErrs.length > 0) {
    throw new Error(`WHEEL_GEOM_OR_ERR_FAIL: ${JSON.stringify(wheelGeom)}`);
  }

  // 8. 触发一次零 API 命运轮盘抽取并等待确定性完成判据
  const prevRev = await page.evaluate(() => window.__CJ_SHENGHAO_V2__.read().state.meta.revision);
  await wheelFrame.locator('#wfGo').click();
  const afterSpin = await waitWheelIdleAndResult(page, wheelFrame, prevRev, 15000);

  const wheelShot = path.join(SHOT_DIR, `${preset}-wheel-result.png`);
  await page.screenshot({ path: wheelShot });

  // 9. 验证刷新回读持久化
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction((rev) => {
    const v = window.__CJ_SHENGHAO_V2__?.read?.();
    return v?.state?.meta?.revision >= rev;
  }, afterSpin.rev, { timeout: 15000 });

  // 10. 最终零 API 与零报错断言
  const jsViolations = await page.evaluate(() => window.__NOAPI_VIOLATIONS__ || []);
  if (apiViolations.length || jsViolations.length) {
    throw new Error(`ZERO_API_VIOLATION: net=${JSON.stringify(apiViolations)} js=${JSON.stringify(jsViolations)}`);
  }
  if (pageErrors.length) {
    throw new Error(`PAGE_ERRORS: ${JSON.stringify(pageErrors)}`);
  }

  console.log(JSON.stringify({
    status: 'PASS',
    preset,
    revisionAfterSpin: afterSpin.rev,
    wheelGeom,
    shots: [phoneShot, wheelShot],
    apiCalls: 0,
  }, null, 2));
} finally {
  await browser.close();
}
```

### 3. 一键还原命令

```powershell
# 删除所有 __NOAPI_TEST_*.jsonl 测试聊天，并还原任何被覆盖的原聊天备份
node E:\SHZDCHOSSS\scripts\test-noapi-seed.mjs --restore
```

---

## D 测试矩阵与断言

### 1. 五套预置状态矩阵 + 回归专项

| 编号 | Preset | 核心预置状态 | 操作路径（全零 API） | 必须断言项 |
|---|---|---|---|---|
| **M1** | `empty_bag` | 现金 20 万、无提现、空背包、0 积分、命运免费可用 | 展开手机 → 切 5 Tab → 开背包 → 切星愿圣盘 → 切暗夜赌场 → 命运轮盘免费抽 1 次 | ① 5 个 `[data-tab]` 均可见；② 背包显示空提示；③ 星愿圣盘 `#wfGo` disabled 且显示锁定说明；④ 赌场显示无卡提示且 `#wfGo` disabled；⑤ 命运免费抽后 `revision + 1`、`totalSpins === 1`、背包新增 1 项且刷新回读一致 |
| **M2** | `three_cards` | 现金 150 万、600 积分、灰/红/金 3 张星愿卡 + 1 张红奖券 | 开背包 → 兑换灰卡（`PLAYER_CARD_REDEEM`）→ 开商城买 1 项异能（`PLAYER_SHOP_BUY`）→ 开赌场选红卡押红/黑（`PLAYER_CASINO_BET`） | ① 灰卡从 `inventory` 移除、`starPoints` 增加 20；② 商城扣分正确、`user.abilities` 新增对应 `abilityId`、`shopHistory` +1；③ 赌场结算后 `casinoRound === 1`，若胜则 `currentPoints` 翻倍且 `winStreak === 1`，若负则该卡从 `inventory` 销毁 |
| **M3** | `wish_unlocked` | 现金 250 万（≥100 万解锁）、本周免费未用、今日 0/2 | 开星愿圣盘 → 点 GO 免费抽卡（`PLAYER_CARD_DRAW`）→ 现金再抽 1 次 → 验证第 3 次被每日上限拦住 | ① 解锁态 `#wfGo` 可点；② 第 1 抽 `costCents === 0`、`wishWeekFreeUsed === true`、`inventory` 新增 `WISH_CARD`，结果卡含「前往赌场/直接兑换/收入背包」按钮；③ 第 2 抽按 2% 阶梯扣款并写 `finance.ledger`；④ 第 3 抽 `#wfGo` disabled（`WISH_DAILY_LIMIT`） |
| **M4** | `high_wealth` | 现金 5000 万、房产+豪车资产、2 项异能、2 位熟人 | 切财富页 → 切我的页 → 切她们页给 `char_b` 打星（`PLAYER_STAR`）→ 切底部停靠 → 命运轮盘现金抽 | ① 财富页总资产 = 现金 + 两项资产估值；② 我的页显示 `2 项` 异能胶囊；③ `char_b.starred === true` 落盘；④ `displayDock='bottom'` 时 `#cj-shenghao-phone-frame` 迁入 `.mes_text` 且 `width: 100%`；⑤ 命运轮盘现金价封顶 ¥50,000（不按 5000 万无限膨胀） |
| **M5** | `max_pity` | 500 万现金、4000 积分、`pityRainbow=59`、`cardPityGold=29`、`lastFreeDate` 已用 | 命运轮盘选 120 积分抽 → 星愿圣盘免费抽 → 检查保底归零 | ① 命运轮盘必出虹核（`NO.53`），`starPoints` 减 120，`pityRainbow === 0`；② 星愿圣盘必出 `gold` 或 `rainbow` 卡，`cardPityGold === 0` |
| **R1** | `three_cards` + `--with-swipe-floor` | 2 楼双 swipe 回归场景 | ① 切另一聊天再切回（`CHAT_CHANGED`）；② 在 2 楼打星后执行 `/del 1` 删楼；③ 切 2 楼 swipe | ① 切聊天时全屏轮盘自动关闭（`open === false`）、小手机无串台；② 删 2 楼后 `host.js` 通过 `applyMissingPlayerOps()` 自动把打星重放到 1 楼并补写 MVU（`char_b.starred === true`）；③ 切 swipe 后 `readCurrent()` 重读新 swipe 状态且零报错 |

### 2. 轮盘与手机自动化的坑与稳定等待判据

| 常见坑 | 源码成因 | 稳定处理方式（严禁拍脑袋 `sleep`） |
|---|---|---|
| 找不到手机或轮盘里的元素 | 两者均为顶层 `srcdoc` iframe（`#cj-shenghao-phone-frame`、`#cj-shenghao-wheel-frame`） | Playwright 一律用 `page.frameLocator('#cj-shenghao-phone-frame')` / `page.frameLocator('#cj-shenghao-wheel-frame')` |
| 打开轮盘瞬间点 GO 无反应或报空白 | 跨 iframe `postMessage` 握手需走完 `WHEEL_READY → WHEEL_INIT → WHEEL_BUILT` | 等待 `wheelDebug().open && wheelDebug().ready` **且** `#wfSvg .ring`（或赌场 `#casinoBead`）visible |
| 转动动画 4.6–5.65 秒导致提前截图或超时 | `wheel-frame.js` 第 308–341 行：`play` 5.65s、`wish` 4.9s、`casino` 4.6s | 联合等待 4 条件同时成立：① `#wfResult.on` 可见；② `#wfSvg .ring.is-spinning` 数量为 `0`；③ `wheelDebug().spinning === false`；④ `state.meta.revision > prevRevision` |
| 小手机 `getBoundingClientRect` 尺寸对不上 | 悬浮态外层 iframe 有 `transform: scale(0.82)`（`host.js` 第 449 行），内部坐标系仍是 `365×730` | 测视口越界时：手机测**顶层 iframe 外框**的 `getBoundingClientRect()`；轮盘（`scale=1` 全屏）直接测内部 `#wfSvg` 与 `#wfSide` 的 `right <= window.innerWidth`、`bottom <= window.innerHeight` |
| 窄屏 375px 布局量测拿到旧坐标 | `resize` 触发 `api.geometry()` 重排需要下一帧 | `setViewportSize({ width: 375, height: 812 })` 后等 `requestAnimationFrame` 两帧再量测 |
| 粒子动画导致 Playwright 截图超时 | `wheel-frame.js` 第 179 行粒子画布在 1.6s 后自动停帧 | 在结果卡出现后等待 `1700ms` 或传 `animations: 'disabled'` 截静态验收图 |

### 3. 本轮测试验收清单（全绿才算通过）

**结构断言**：
- [ ] `apiViolations.length === 0` 且 `window.__NOAPI_VIOLATIONS__.length === 0`（绝对零模型调用）
- [ ] `pageErrors.length === 0` 且轮盘内 `window.__CJ_WHEEL_ERR__.length === 0`
- [ ] `#cj-shenghao-phone-frame` 自动显现，且 0 楼未触碰「开始我的人生」
- [ ] 5 个 Tab（`scene` / `women` / `mine` / `wealth` / `wheel`）均可切换并渲染对应区块
- [ ] 轮盘全屏握手通过（`wheelDebug().ready === true`），`#wfSvg` 与 `#wfSide` 均在视口内无右溢出
- [ ] M1–M5 全部 `PLAYER_*` 操作均推进 `meta.revision`，且 `page.reload()` 后 MVU 回读数值完全一致
- [ ] R1（`CHAT_CHANGED` / 删楼重放 / 切 swipe）全部通过无状态丢失或报错

**视觉断言（人工或看图核对 `reports/noapi-test-shots/`）**：
- [ ] 悬浮态小手机不遮挡越界、圆角与配色正常；底部停靠态与正文同宽对齐
- [ ] 轮盘全屏（1920×1080 与 375×812 两套视口）盘面居中、右侧/底部操作栏与结果卡完整可见无截断

---

## E 风险、隔离与还原

### 1. 存档隔离策略

- **默认策略（强制）**：在 8001 的测试卡目录（如 `神豪终端27`）下，**只读写 `__NOAPI_TEST_<preset>.jsonl` 独立聊天文件**，不修改 YG 已有的聊天存档。
- **覆盖模式（可选 `--target`）**：仅当明确指定已有聊天时才覆写，且脚本在写盘前强制先复制原文件到 `.work/test-noapi-backups/<timestamp>-<filename>`，并登记到 `manifest.json`。
- **不新建污染卡**：复用 8001 现有测试卡（如 `神豪终端27.png`），不额外堆积 `神豪终端28…` 垃圾卡。

### 2. 防误触 8000 四道硬闸门

1. **端口白名单**：运行脚本启动即校验 `new URL(BASE_URL).port === '8001'`，不符立即终止。
2. **目录白名单**：写盘脚本 `assertSafePath()` 强制校验所有读写与删除目标均以 `E:\Ajiuguanagentceshi\SillyTavern\` 开头，且路径不含 `8000`。
3. **无共享配置读取**：不读取 8000 的任何目录、`settings.json` 或浏览器 profile。
4. **独立无痕上下文**：Playwright 每次新建干净 `BrowserContext`，不复用日常浏览器缓存。

### 3. 防止测试状态被误当正式存档

- 文件名强标识：`__NOAPI_TEST_<preset>.jsonl`，在酒馆「管理聊天文件」列表里一眼可辨。
- 状态内强标识：`meta.initKey` 强制 `noapi_test_*` 前缀；`facts.__testMarker` 记录 `{ noapi: true, preset, createdAt }`（过 Zod、不入玩家 UI）。
- 测完即清场：执行 `node scripts/test-noapi-seed.mjs --restore` 立即删掉所有测试聊天文件。

---

## F 给 DSH 的施工顺序

> 本施工全过程**不修改角色卡源码（`src/`）、不重构建（`dist/`）、不修改 8000 实例、不调用模型 API**。

1. **落盘两份外部测试脚本**
   - 将本方案 C 节的两份完整代码分别写入 `scripts/test-noapi-seed.mjs` 与 `scripts/test-noapi-run.mjs`。
   - **验证点**：运行 `node --check scripts/test-noapi-seed.mjs` 与 `node --check scripts/test-noapi-run.mjs` 均退出码 `0`。
   - **失败退回**：删除这两份新建脚本即可，零副作用。
2. **确认 8001 正在运行且目标卡已是 rc.36 重导版**
   - 核对 `http://127.0.0.1:8001/` 可访问，且目标卡（如 `神豪终端27.png`）已包含 rc.36 握手修复。
   - **验证点**：`curl -I http://127.0.0.1:8001/` 返回 `200`。
   - **失败退回**：若 8001 未启动，只启动 `E:\Ajiuguanagentceshi\SillyTavern`（8001）；绝不动 8000。
3. **先跑单套冒烟（`empty_bag`）验证 Zod 校验、读盘、零 API 熔断与握手**
   - 执行：`node scripts/test-noapi-run.mjs --avatar 神豪终端27.png --char 神豪终端27 --preset empty_bag`
   - **验证点**：终端输出 `status: "PASS"`、`apiCalls: 0`，`reports/noapi-test-shots/` 生成手机与轮盘两张截图。
   - **失败退回**：若 `CHAR_NOT_FOUND` 检查实际 avatar 名；若 `WHEEL_GEOM_OR_ERR_FAIL` 检查目标卡是否为修复握手后的 rc.36 构建；运行 `--restore` 清场。
4. **顺序跑完 M2–M5 与 R1 矩阵**
   - 依次对 `three_cards`、`wish_unlocked`、`high_wealth`、`max_pity` 执行一键脚本，并补跑 `--with-swipe-floor` 回归用例（含 375×812 窄屏视口）。
   - **验证点**：D 节验收清单结构断言全绿，截图核对无溢出/截断。
   - **失败退回**：保留失败 preset 的截图与控制台日志报给 YG，不擅自修改断言绕过失败。
5. **清场还原并更新记录**
   - 执行 `node scripts/test-noapi-seed.mjs --restore`。
   - **验证点**：`E:\Ajiuguanagentceshi\SillyTavern\data\default-user\chats\神豪终端27\` 下无残留 `__NOAPI_TEST_*.jsonl`。
   - 将验收结论与截图路径写入 `reports/` 并同步更新 `HANDOFF.md`。
