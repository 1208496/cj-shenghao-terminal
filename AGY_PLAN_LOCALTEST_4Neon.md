# 通用角色卡本地测试（零 API）方案设计

> **定位**：与 `ego-tavern-card-test`（调 API 实机测试 Skill）并列的零 API 姊妹 Skill 设计方案，适用于**任意** SillyTavern 角色卡（纯文本卡 / 开局前端卡 / 逐楼状态栏卡 / 悬浮界面卡 / MVU-Zod 变量卡及其任意组合）。
> **核心特征**：运行在真实 SillyTavern 测试实例（端口 `8001`）与真实浏览器（ego）中，通过**本地改写存档/楼层数据 + 真实 DOM/跨 iframe 交互驱动 + 本地引擎断言**覆盖除“模型生成行为”外的全部功能面，全程 `apiCalls === 0`。
> **承接关系**：直接升级替代当前绑定单一项目的 `zero-api-card-test`（`v1.0.0`），将其改造为跨卡通用 Skill（沿用名称 `zero-api-card-test` 升级至 `v2.0.0`，或并行命名为 `local-tavern-card-test`，正文统一以 `zero-api-card-test v2` 指代）。

---

## 一、定义与边界

### 1.1 什么叫“本地测试（零 API）”

在**真实运行的 SillyTavern 测试实例（`127.0.0.1:8001`）**中，不连接或不调用任何 LLM 推理端点，通过以下三种本地输入手段驱动角色卡运行，并对其**组件生效、状态解析、界面渲染、用户交互、本地引擎结算、持久化与回退**执行自动化断言：

1. **导入真实卡文件**：走酒馆正规 UI 导入流程，验证世界书、正则、内嵌脚本生效。
2. **本地注入可控存档/楼层**：直接构造或 patch 测试聊天 `.jsonl`（或通过酒馆运行时变量接口注入），跳过模型生成即可直达任意剧情节点、数值边界或交互状态。
3. **真实浏览器交互驱动**：在主页面与各层同源 iframe 内执行符合浏览器事件模型的输入、点击、切换、刷新、删楼、切 swipe 等操作，并捕获状态与 DOM 变化。

### 1.2 与“调 API 实机测试”的可操作判定规则

面对任意一条待测需求 `Q`，执行以下三步判定函数（禁止凭感觉猜测）：

```text
DECIDE(Q):
  1. 若 Q 的通过与否取决于「LLM 在给定 Prompt/世界书/协议下输出了什么文本或变量指令」
     → 必须归【调 API 实机测试】（ego-tavern-card-test），且只跑最少必要轮次（通常 1 轮）。
  2. 否则，若 Q 依赖「SillyTavern 真实运行时（导入链、世界书绑定、正则引擎、TavernHelper/MVU 生命周期、
     真实跨 iframe 通信、聊天持久化、刷新/删楼/swipe 回调）」
     → 归【本地测试（零 API）】（本方案，8001 实例）。
  3. 否则，若 Q 仅依赖纯函数计算或隔离组件样式，不涉及酒馆宿主对象
     → 归【离线单测 / 假宿主仿真】（npm test / harness.html），但最终 UI/桥接仍须回 8001 零 API 复核。
```

**一句话操作判据**：把模型输出替换为“人工构造的合法楼层/合法变量快照”后，测试结论是否依然成立？
- **依然成立** → 必须走本地测试（零 API）。
- **不再成立**（因为被测对象本身就是“模型能否产出这份合法文本/指令”）→ 归调 API 侧。

### 1.3 零 API 哨兵（硬约束自证）

本地测试不是靠“口头约定不点发送”，而是靠运行时哨兵强制证伪：

| 哨兵层 | 监听目标 | 触发即判 `F8_ZERO_API_VIOLATION` |
|---|---|---|
| 网络层（主文档 + 同源 iframe） | `window.fetch`、`XMLHttpRequest.prototype.open` | URL 命中 `/api/(backends|openai|anthropic|google|openrouter|novelai|horde|kobold|textgen)`、`/generate\b`、`/chat/completions` |
| 酒馆事件层 | `ctx.eventSource` 的 `GENERATION_STARTED`（`dryRun !== true`） | 任何非 dryRun 生成启动事件 |
| 酒馆助手层 | `window.TavernHelper.generate` / `generateRaw` | 代理包装器记录到任意调用 |
| DOM 层 | `#mes_stop` 的 `getComputedStyle().display !== 'none'` | 任意轮询点检测到生成态激活 |

---

## 二、覆盖面矩阵（10 层可本地验证能力）

> 适用形态沿用 `card-shapes.md`：`A` 纯卡、`B` 开局前端、`C` 逐楼状态栏、`D` 悬浮/固定界面、`E` MVU/变量驱动（多形态可叠加）。

| 层级 | 验证范围 | 适用形态 | 可执行的断言类型（必须量化或布尔可证） |
|---|---|---|---|
| **L1 卡载体与静态结构** | PNG/JSON 解析、V2/V3 规范、体积、内嵌世界书/正则/脚本完整性、外链清单 | A–E | `fileSize <= budgetBytes`（如 3 MB）；`spec_version` 合法；正则 `findRegex` 可编译无异常；世界书条目数/UID 唯一性；外链 URL 清单与允许域匹配 |
| **L2 导入与组件生效** | 正规 UI 导入、弹窗链处理、世界书绑定、正则允许、脚本 iframe 挂载、全局运行时对象就位 | A–E | 新增角色数 `=== 1`；若含内嵌书则 `worldExists && globeLit`；`regexAllowed === true`（当 `regexCount > 0`）；`thScriptIframes >= expectedScripts`；`typeof TavernHelper/Mvu === 'object'`（按形态）；残留 `.popup` 为 `0` |
| **L3 状态层** | 存档注入回读、schema 校验、初始值/默认值补齐、边界值容错、`initKey` 隔离 | E（及 B/D） | 注入后宿主读出的状态对象非空且通过卡侧/探针校验；关键路径值与注入 patch 逐项相等；无 `zod`/解析 error toast；换 `initKey` 后旧分支缓存不污染新状态 |
| **L4 渲染层** | 0 楼多开场白、逐楼正则替换、状态栏 HTML/iframe、悬浮面板与详情页、长文本/空态/泄漏检测 | A–E | 0 楼逐个 swipe 切换后正文非空且互异；AI 楼层注入含正则标记的测试文本后 `htmlBlocks > 0` 或楼层 `iframes.length > 0`；`leaks` 为空（无原样标签/`{{宏}}`/`<% %>`/`undefined`/`NaN`/`[object Object]`）；长文本无横向溢出（`scrollWidth <= clientWidth + 2`） |
| **L5 交互层** | 折叠/展开、Tab 切换、表单必填校验、禁用态拦截、弹层/确认框开关、搜索/筛选 | B/C/D | 点击后目标视图激活标识（`aria-current`/`aria-selected`/可见面板）切换；表单缺必填项提交被拦截且焦点移至首个缺失控件；禁用态控件点击后状态 revision 与 DOM 无副作用；弹层打开后可按关闭按钮或 `Escape` 关闭且恢复滚动锁 |
| **L6 结算层** | 纯本地确定性引擎：抽奖、买卖、扣减、兑换、保底计数、限次、门槛锁、珍藏锁、库存联动 | D/E | 执行本地操作后：`revision === prevRev + 1`（或指定状态路径按预期规则变化）；余额/积分/库存数量满足精确前后差值公式；达到限次/余额不足/锁定态时操作被拒绝且状态回滚/不变；保底临界预置触发保底结果 |
| **L7 持久化与回退层** | 整页刷新回读、切聊天再切回、`/del` 删楼、`/swipe` 切分支、新聊天隔离 | A–E | 刷新 → 重选卡 → 重开测试聊天后，关键状态与 `revision` 不倒退；切至另一聊天再切回无串数据；`/del 1` 后末楼退回且状态/操作日志按卡预期重放或回退；切 swipe 后楼层与状态同步切换；重复 iframe 数为 `1`（无泄漏双挂载） |
| **L8 跨 iframe 与宿主桥** | 宿主↔子 iframe 握手、nonce/channel 鉴权、几何尺寸、全屏覆盖、滚动锁、卸载清理 | B/D | 打开子 iframe 后在超时内完成握手（挂载 DOM 节点数 > 0 且无错误队列）；全屏 iframe `rect` 覆盖 `[0, 0, vw, vh]`（误差 ≤ 2px）；子面板不越界（`side.right <= vw + 2 && bottom <= vh + 2`）；关闭后 `document.body.style.overflow` 恢复原值 |
| **L9 响应式、主题与字号** | 桌面/窄屏视口（如 `1920×1080` / `457×926` / `375×812`）、停靠模式、主题切换、字号档、防重叠 | C/D | 切视口后关键容器不裁剪、无元素重叠（`max(0, a.right - b.left) === 0`）；折叠条高度符合契约且无意外滚动条（`scrollHeight <= clientHeight + 1`）；图标/关闭按钮几何居中偏差 `<= 2px`；切主题后 CSS 变量或根类变化且对比度/可见性正常 |
| **L10 体积、依赖与断网降级** | 卡包体积红线、外链资源可达性、CDN/图床阻断时的内联兜底降级 | A–E | 静态扫描外链列表；在仅拦截外部域（仍零模型 API）或模拟离线/失败资源时，核心界面仍能渲染、图片有 fallback/占位、无未捕获 `pageerror` |

---

## 三、通用性设计（不限某一张卡）

### 3.1 允许硬编码 vs 禁止硬编码的边界

| 区域 | 是否允许硬编码 | 内容举例 |
|---|---|---|
| **酒馆宿主层** | **允许**（集中在 `st-selectors.mjs` 单点维护） | `#character_import_file`、`#right-nav-panel`、`#chat .mes`、`.mes_text`、`#world_button.world_set`、`#toast-container`、`.popup`、`window.SillyTavern.getContext()`、`window.TavernHelper`、`window.Mvu` |
| **测试契约层** | **允许协议名，禁止业务值** | 属性名 `data-testid` / `data-test-state` / `data-test-count`、全局可选探针接口名 `window.__ST_CARD_TEST__` |
| **具体角色卡实现层** | **严禁写进通用脚本** | 特定 iframe id（如 `#cj-shenghao-phone-frame`）、特定类名（如 `.wheel-hub-grid`）、特定全局对象名（如 `__CJ_SHENGHAO_V2__`）、特定业务字段名（如 `cupSize`、`starPoints`）、固定 tab 顺序或按钮个数 |

### 3.2 测试契约层（Test Contract）与无契约降级栈

为了解决“换一版改类名就全挂”和“换一张外部卡没有契约也能测”的双重需求，定位与断言采用**两级契约 + 四级定位降级栈**：

#### A. 可选测试契约（推荐自研卡接入，外部卡零改造跳过）
1. **DOM 语义锚点**（只标“它是什么角色”，不绑样式类名）：
   - `data-testid="<domain>.<role>"`（例如 `nav.tab`、`panel.root`、`action.submit`、`result.banner`）
   - `data-test-key="<stable-id>"`（区分同类列表项，如某张卡/某个 tab）
   - `data-test-state="idle|busy|locked|disabled|ready"`（消除“盲等动画/盲猜禁用态”）
2. **卡侧测试清单（`card-test.manifest.json`，放在卡项目或测试配置目录，不属于通用 Skill 代码）**：
   声明该卡独有的：状态根路径、预置补丁集、契约检查表、业务断言规则（数据驱动，见第七节）。
3. **可选只读诊断钩子**（`window.__ST_CARD_TEST__`）：
   若卡愿意暴露，统一提供 `{ getState(), getRevision(), isBusy(), getLastError() }`；未暴露时自动退回 `TavernHelper.getVariables` / `Mvu.getMvuData`。

#### B. 四级元素定位降级栈（无契约时自动向下回退）

```text
Level 1 [契约定位]   [data-testid="..."]（+ 可选 [data-test-key="..."]）
Level 2 [ARIA/语义]  role + aria-label / aria-current / aria-controls / name / type
Level 3 [控件+文本]  交互控件集合（button/a/input/select/[role=button]）∩ 可见 ∩ 文本正则
Level 4 [结构启发式] 仅用于探索/自动发现（如 mounted 新增 iframe、floors[0] 表单控件扫描），
                     绝不在断言里硬编码 nth-child 或纯视觉 CSS 类名
```

### 3.3 按 5 种卡形态自动分派

复用 `card-probe.mjs` 的离线静态探测 + `cardRuntime()` 的实机探测，生成 `cardProfile = { shapes: Set<'A'|'B'|'C'|'D'|'E'>, ... }`，通用引擎按形态自动拼装必跑层：

| 形态 | 识别信号（离线 + 实机） | 自动启用的本地测试层 | 自动跳过的层 |
|---|---|---|---|
| **A 纯文本卡** | 无脚本 iframe、无 `mounted`、无 MVU/变量 | L1、L2、L4（多开场白 swipe + 正则泄漏）、L7（刷新/删楼）、L10 | L3、L6、L8 |
| **B 开局前端卡** | `floors[0].iframes` 含表单控件 | A 集合 + L5（表单必填校验/步进/禁用态，**不点最终触发生成的提交**）+ L8（楼层 iframe 几何） | L6（除非前端自带本地试算） |
| **C 逐楼状态栏卡** | 含 `AI输出+仅显示` 正则或楼层 HTML/iframe 模板 | A 集合 + L4（注入含状态标记的合成 AI 楼层，验正则渲染与零泄漏）+ L9（窄屏状态栏防溢出） | L8（若无顶层浮层） |
| **D 悬浮/固定界面卡** | `mounted` 相对基线新增可见节点/iframe | A 集合 + L5（展开/折叠/导航/弹层）+ L8（跨 iframe 握手/几何/滚动锁）+ L9（视口/停靠/主题） | — |
| **E MVU/变量驱动卡** | `Mvu` 存在或卡含 `[InitVar]`/`getVariables` | A 集合 + L3（存档注入与校验）+ L6（若有本地操作引擎）+ L7（刷新/删楼/swipe 状态一致性） | — |

---

## 四、存档注入的通用方法（未知 Schema 场景）

> 委托方核心要求：“在真实运行中的酒馆里面，但不必调用 api，DSH 自己改存档数据自己测”。

### 4.1 三条通用状态构造路径

在不知道目标卡内部 schema 时，按优先级选择构造路径：

| 路径 | 构造方式 | 适用条件 | 典型失败模式与防呆 |
|---|---|---|---|
| **P1：克隆真实存档 + 最小 JSON Patch**（最通用，零 schema 依赖） | 取该卡任意一份已跑通开局的 `.jsonl` 样本（或导卡后人工/历史留存的 1 份黄金基线存档），复制为独立测试聊天，仅对目标路径应用最小 JSON Patch（如改余额、加道具、改好感、改保底计数）并刷新 `initKey`/时间戳 | **几乎适用于任意外部卡/自研卡（形态 C/D/E）**；不需要读懂全量 schema | ① 基线存档过旧导致升版缺必填字段 → 结合 P3 或在 `L3` 立即报 `SCHEMA_DRIFT`；② 未同步改写 `initialized_lorebooks` 或楼层锚点指纹 → 写入前保留基线 `initialized_lorebooks` 并重算/清除过期缓存键 |
| **P2：从卡载体/世界书/运行时元数据派生** | 离线解析卡内 `[InitVar]` 世界书条目、`chat_metadata.variables` 默认值、或卡内嵌的 JSON Schema / Zod 导出，生成最小合法骨架，再叠声明式 patch；对纯文本/形态 C 卡，直接构造合成的 `is_user:false` AI 楼层（含正则所需标签或状态块） | **有清晰 `[InitVar]` 或形态 A/C 卡**；适合零样本冷启动 | ① `[InitVar]` 初始值为 `null`（如延迟到开局向导才初始化的卡）→ 检测到根为 `null` 时自动降级到 P1 或 P3；② 世界书名与卡绑定名不一致导致 `[InitVar]` 覆盖注入状态 → 注入前从 `cardRuntime().world` 动态读取当前绑定世界书名写入 `initialized_lorebooks` |
| **P3：调用卡自有初始化/兜底函数** | 当被测卡属于当前工作区项目（或暴露了构建/测试入口）时，由 `card-test.manifest.json` 声明 `stateBuilder` 脚本路径，直接调用卡自身的 `createSchema` + `completeInitialState` / `initialize`，把“必填字段与默认值”永远交给卡代码自己算，测试只提供业务 diff | **高频迭代的自研卡**（彻底消除“预置手抄字段落后于新版本”的缺陷） | ① 测试脚本直接引用内部私有函数名导致重构断裂 → 约束 manifest 只调单一稳定的导出入口，并在构建单测中校验该入口可执行 |

**补充：非变量楼层注入（覆盖形态 A/C）**
对不依赖 MVU 变量的卡，同样可通过 `.jsonl` 注入：
- 注入多条合成对话楼层（含长文本、特殊字符、卡内正则需要匹配的状态标签），打开该聊天后即可零 API 验证：**正则替换是否正确、状态栏是否渲染、是否存在裸标签泄漏、删楼/切 swipe 是否正常**。

### 4.2 隔离与防污染铁律

1. **端口与路径双重硬锁**：
   - `assertSafeInstance(url)` 强制 `port === '8001'`，出现 `8000` 直接抛 `SAFETY_BLOCK`。
   - `assertSafePath(p)` 强制 `path.resolve(p)` 位于 `E:\Ajiuguanagentceshi\SillyTavern\data\default-user\chats\` 子树内。
2. **独立测试聊天前缀**：默认写入 `__LOCALTEST_<cardSlug>_<caseId>.jsonl`，绝不覆盖玩家或历史正常聊天。
3. **分支与缓存隔离**：
   - 每次注入生成唯一 `chat_metadata.integrity`（UUID）；若卡存在 `initKey` / `branchKey` 类字段（由 manifest 声明或启发式探测 `meta.initKey`），每轮自动换新值，防止 `localStorage` 旧操作日志重放污染。
   - 测试完成后支持清理本测试聊天对应的 `localStorage` 键前缀（按 `chatId` 匹配）。
4. **备份清单与一键回滚**：
   - 所有写入（新建或显式 `--target` 覆盖）均登记到 `.work/localtest-backups/manifest.json`；
   - `--restore` 按逆序删除新建测试聊天、还原被覆盖文件，且必须校验还原后磁盘状态一致。
5. **写入新鲜度守卫**：
   - 驱动器调用 seed 子进程时，禁止复用 `ego.exe` 当 `node`（显式解析 `node` 可执行文件），强制通过 `--out <file>` 交换元数据并校验 `mtimeMs >= seedStart`，杜绝“子进程没跑却拿旧存档假绿”。

---

## 五、交互驱动的通用方法（稳定点到东西）

### 5.1 跨 iframe 寻址模型

真实酒馆存在三类 iframe：
1. **楼层内嵌 iframe**：位于 `#chat .mes[mesid="N"] iframe`（如 `#TH-message--0--0`）。
2. **顶层挂载 iframe**：位于 `document.body > iframe` 或 `#sheld > iframe`（悬浮面板、全屏覆盖层）。
3. **嵌套子 iframe**：挂载 iframe 内部再嵌子页。

通用定位器接受统一路径对象 `framePath`（字符串数组，空数组代表主文档）：
- 支持按 `id`、CSS 选择器、或**特征探针**（如 `{ mountedIndex: 0 }`、`{ floorMesid: -1, index: 0 }`、`{ containsTestId: "wheel.root" }`）逐层解析 `contentDocument`。
- 每层访问前检查同源可读性；若不同源立即报 `F0_CROSS_ORIGIN_FRAME`，不静默返回空。

### 5.2 真实事件链（解决 `el.click()` 无效）

项目已踩过坑：折叠球/拖拽控件监听 `pointerdown` → `pointerup`（判断位移 `< 5px` 才算点击），纯合成 `el.click()` 完全不触发。因此统一封装 `smartInteract(page, framePath, locator, action)`：

```js
// 伪代码：真实指针点击序列（在目标元素所属 window 上下文内构造事件）
function dispatchRealClick(win, el) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const common = { bubbles: true, cancelable: true, view: win, clientX: cx, clientY: cy, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  el.scrollIntoView({ block: 'center', inline: 'center' });
  el.dispatchEvent(new win.PointerEvent('pointerover', common));
  el.dispatchEvent(new win.PointerEvent('pointerenter', { ...common, bubbles: false }));
  el.dispatchEvent(new win.PointerEvent('pointerdown', common));
  el.dispatchEvent(new win.MouseEvent('mousedown', common));
  el.focus?.({ preventScroll: true });
  el.dispatchEvent(new win.PointerEvent('pointerup', { ...common, buttons: 0 }));
  el.dispatchEvent(new win.MouseEvent('mouseup', { ...common, buttons: 0 }));
  el.dispatchEvent(new win.MouseEvent('click', { ...common, buttons: 0 }));
}
```

- **填写输入**：必须走目标 `win` 的原型链 `HTMLInputElement/HTMLTextAreaElement/HTMLSelectElement.prototype.value` setter + `input` + `change` 事件，且严禁传入 `undefined`。

### 5.3 点击前四道可交互门（Actionability Gate）

在派发点击前，必须在超时窗口内连续满足四道门，否则**不盲点**，直接进入精确归因：

1. **存在门**：定位器匹配到至少 1 个节点（若未指定 `index` 且匹配 > 1 个，记录歧义警告）。
2. **可见门**：`getComputedStyle(el).display !== 'none'`、`visibility !== 'hidden'`、`opacity > 0`、`rect.width > 0 && rect.height > 0`。
3. **可点门**：
   - 非禁用：`!el.disabled && el.getAttribute('aria-disabled') !== 'true' && getComputedStyle(el).pointerEvents !== 'none'`；
   - 未被遮挡：在目标文档执行 `doc.elementFromPoint(cx, cy)`，命中节点必须等于 `el` 或为 `el` 的后代（若被 `#preloader`、`.popup` 或其它遮罩挡住，直接记录挡路元素选择器与文本）；
   - 非 busy/动画中：若存在 `[data-test-state="busy"]` 或元素 `getBoundingClientRect()` 在连续 2 帧（120ms）内仍在位移，先等待稳定。
4. **无阻塞弹窗门**：主页面 `.popup`（除本次预期要点的弹窗本身外）必须为空。

### 5.4 确认框与 Toast 的统一采集

- **主页面 Toast**：挂载 `MutationObserver` 监听 `#toast-container .toast`，记录时间戳、级别（info/warn/error）、完整文本。
- **iframe 局部 Toast / 状态提示**：进入任意同源 iframe 时，按契约 `[data-testid*="toast"]`、`[role="alert"]`、`[aria-live]` 自动附挂观察器，一并汇总到当前步骤的事件流。
- **弹窗处理**：复用 `BASE_POPUP_RULES` + `config.extraPopupRules`；凡遇到未声明弹窗，**绝不瞎点确定**，立即截图 + 落盘原文并终止。

### 5.5 区分“点了没反应” vs “点了但断言判据写错”

每次点击前后强制执行**双快照差分（Before/After Probe）**：

| 观测维度 | 采集内容 |
|---|---|
| 1. DOM 变更计数 | 在目标文档（及主文档）挂短暂 `MutationObserver`（窗口 800ms），统计 `addedNodes / removedNodes / attrChanges` |
| 2. Toast / 弹窗增量 | 点击后新增的 toast 文本或弹窗 |
| 3. 宿主状态差分 | 点击前后 `getVariables` / `Mvu` / `__ST_CARD_TEST__.getState()` 的叶子路径 diff 与 revision 变化 |
| 4. 控制台错误增量 | 点击后新增的 `error` / `unhandledrejection`（主文档 + iframe） |

**自动判别规则**：
- 若 4 个维度**全为 0 变化** → 归因 `F4_NO_REACTION`（真没反应：事件未绑定、被逻辑早退、或点偏了）。
- 若 1/2/3 中**至少一项发生了实质变化**，但后续断言未命中 → 绝不报“没反应”，而是把真实变化 diff 打出来，按变化落点归因到 `F5_STATE_UNCHANGED`（UI 动了/弹了错误 toast 但状态没提交）、`F6_RENDER_STALE`（状态变了但渲染没跟上）或 `F7_HARNESS_ERROR`（状态和渲染都按新逻辑变了，是断言期望写旧了）。

---

## 六、失败归因层（自动取证，一步定位）

任何失败都必须携带唯一归因码 + 结构化取证包（`reports/localtest-evidence/<runId>-<step>.json` + 整页截图 `.png`），彻底终结“只报一个 `TIMEOUT`、还要人工写二次取证脚本”的现状。

### 6.1 归因分类表

| 归因码 | 含义 | 典型示例（抽象） | 必落盘自动取证项 |
|---|---|---|---|
| `F0_GATE_OR_ENV` | 环境/导卡/组件生效关未过 | 8001 未起、世界书未绑、脚本 iframe 未起、iframe 不同源 | `cardRuntime()`、`cardGateProblems()`、弹窗残留、控制台错误、截图 |
| `F1_CONTRACT_MISSING` | 契约锚点或目标元素不存在 | 节点未渲染、新版删改了 `data-testid`、进错了页面/欢迎页 | 当前 `chatId/avatar`、目标 `framePath` 是否存在、该文档所有 `data-testid` 与可见控件清单、截图 |
| `F2_NOT_VISIBLE` | 元素存在 DOM 中但不可见 | `display:none`、折叠态未展开、宽高为 0 | 匹配元素的 `computedStyle(display/visibility/opacity)`、`rect`、最近隐藏祖先节点、截图 |
| `F3_NOT_INTERACTABLE` | 元素可见但不可点 | **`disabled=true`**、`aria-disabled`、`pointer-events:none`、被遮罩/抽屉挡住、处于 `busy` 态 | `disabled`/`aria-disabled`、卡侧 `busy` 状态、`elementFromPoint` 实际命中元素的 tag/id/class/text、活跃 `.popup`、截图 |
| `F4_NO_REACTION` | 通过了可点门且派发了真实点击，但无任何可观测反应 | 事件监听缺失、handler 静默 return、跨 iframe 消息被静默丢弃 | 点击坐标、MutationObserver 统计（全 0）、点击前后状态快照（相等）、新增错误与 toast（空）、跨 iframe 消息日志（若有）、截图 |
| `F5_STATE_UNCHANGED` | 点击有 UI 反应或 toast/错误，但宿主状态未按预期变更 | **`STALE_REVISION`**、余额不足、限次拦截、校验拒绝、写回失败 | 新增 toast 文本、点击前后 `revision` 与状态 diff、最近操作历史/诊断字段（若存在）、新增 console 错误、截图 |
| `F6_RENDER_STALE` | 宿主状态已正确变更，但界面未同步渲染或渲染出错 | 状态 revision 已前进但结果区未显示、列表数与状态不一致、出现 `undefined`/越界 | 状态前后 diff、目标 DOM 文本与节点数、关键容器 `rect` 与视口对比、截图 |
| `F7_HARNESS_ERROR` | 测试脚本/配置/断言自身错误 | seed 未写出（`mtime` 过旧）、正则语法错、非法参数、超时配置过短 | 脚本堆栈、`seed` 文件时间戳、入参配置快照 |
| `F8_ZERO_API_VIOLATION` | 触发了禁止的模型 API 请求 | 误点触发生成按钮、脚本自动调了 `generateRaw` | 哨兵拦截到的完整 URL / 调用栈 / 触发步骤名、立即中止后续步骤 |

### 6.2 用回溯案例校验设计有效性

回顾现状缺陷 3：`FAIL WHEEL_SETTLE_TIMEOUT { ok:false, rev:1, spinning:false, result:"" }`。
套用本归因层后，**同一次运行**就会自动给出确定结论：
- 若是假设 ①（按钮当时 `disabled` 或 `busy`）：在点击前就会直接停在 **`F3_NOT_INTERACTABLE`**，取证包写明 `disabled: true, busy: true`，0 秒定位，不会白等 20 秒超时。
- 若是假设 ②（`STALE_REVISION`）：点击通过可点门，MutationObserver 捕获到错误 toast，revision 未变，直接停在 **`F5_STATE_UNCHANGED`**，取证包附上 `toasts: ["...STALE_REVISION..."], revBefore: 1, revAfter: 1`，一步定案。

---

## 七、版本漂移防护（高频迭代如何不碎）

### 7.1 漂移分级策略

| 改动类型 | 测试应当如何响应 | 实现保障 |
|---|---|---|
| **样式/类名重构**（`.wheel-wallet` → `.wheel-topbar`） | **零成本 PASS** | 断言只认 `data-testid` / ARIA / 语义控件，不碰视觉类名 |
| **文案润色**（按钮字微调、标题改词） | **零成本 PASS** | 定位用 `data-testid` 而非全文精确匹配；仅在专门的文案断言用例里检词 |
| **状态新增带默认值的可选字段** | **零成本 PASS** | 存档注入走 P3（调卡自身初始化/兜底）或 P1（克隆基线 + 最小 patch），不手抄全量状态字面量 |
| **删除/改名契约锚点、破坏必填字段、改交互语义** | **明确报 `F1_CONTRACT_MISSING` / `SCHEMA_DRIFT`**（严禁静默跳过） | 契约清单显式声明必检项；缺失即红灯，迫使开发者同步更新契约或修复漏渲染 |

### 7.2 数据驱动用例组织（只加数据，不改驱动代码）

通用 runner 不含任何具体卡的业务逻辑。每张卡的测试套由纯 JSON/MJS 数据表描述（`<card-repo>/tests/localtest/*.suite.json`）：

```json
{
  "suite": "economy-and-panels",
  "cardProfileExpect": ["D", "E"],
  "seed": {
    "strategy": "P3_BUILDER",
    "preset": "rich_inventory",
    "patch": { "wallet.points": 600 }
  },
  "cases": [
    {
      "id": "open-panel-and-switch-tabs",
      "steps": [
        { "op": "ensureExpanded", "frame": { "containsTestId": "panel.root" }, "trigger": { "testId": "panel.toggle" } },
        { "op": "assertCount", "frame": { "containsTestId": "panel.root" }, "target": { "testId": "nav.tab" }, "min": 2 },
        { "op": "click", "frame": { "containsTestId": "panel.root" }, "target": { "testId": "nav.tab", "key": "shop" } },
        { "op": "assertVisible", "frame": { "containsTestId": "panel.root" }, "target": { "testId": "shop.list" } }
      ]
    },
    {
      "id": "local-engine-action-and-persist",
      "steps": [
        { "op": "snapshotState", "as": "before" },
        { "op": "click", "frame": { "containsTestId": "modal.root" }, "target": { "testId": "action.go" } },
        { "op": "waitStateChanged", "from": "before", "expect": { "revisionDelta": ">=1" }, "timeoutMs": 12000 },
        { "op": "assertVisible", "frame": { "containsTestId": "modal.root" }, "target": { "testId": "result.card" } },
        { "op": "reloadAndReopen" },
        { "op": "assertState", "expect": { "revision": ">=before.revision+1" } }
      ]
    }
  ]
}
```

**版本跟进机制**：
- 卡新增 1 个功能（例如新卡包流程、珍藏锁、商城分类）→ 只需在 `cases` 数组追加一段声明式步骤，**0 行通用引擎代码修改**。
- 可配一条轻量单测（构建期运行）：扫描卡模板里所有 `data-testid`，与 `*.suite.json` 引用的 `testId` 做集合校验，**构建阶段就能提前发现契约漂移**，不必等到开浏览器才炸。

---

## 八、必须调 API 的那一份清单（永远出界）

以下场景的真值取决于**外部大模型的实际输出行为**，本地测试**永远无法替代**，必须交由 `ego-tavern-card-test` 执行（且遵循“只跑最少必要 1 轮”纪律）：

| 编号 | 永远出界的场景 | 判定依据 | 为什么本地测试答不了 |
|---|---|---|---|
| **O1** | 模型是否遵守提示词与更新协议（如正确输出 `<UpdateVariable>` / `<JSONPatch>` / 状态块格式） | 结论取决于 LLM 指令遵循能力 | 本地注入的是人造合法输出，绕过了模型生成本身 |
| **O2** | 世界书条目激活后的实际上下文组装质量与模型对世界书设定的采纳度 | 结论取决于真实 Prompt 下的 LLM 语义理解 | 虽然 `dryRun` 可看激活列表，但模型是否“读懂并照写”只有真生成才知道 |
| **O3** | 端到端生成后 MVU/解析器对“真实脏输出”的容错与写回（如模型漏字段、越权写只读字段、格式畸形） | 结论取决于模型真实犯错分布 | 人工构造畸形样本只能测已知容错逻辑，测不出新模型/新协议引发的真实偏移 |
| **O4** | 正文文风、人设一致性、叙事节奏、尺度遵循、建档/补全类 `generateRaw` 输出质量 | 结论取决于生成文本内容 | 属于语言生成质量，与本地脚本无关 |
| **O5** | 真实流式生成期并发锁（如 `GENERATION_BUSY` 期间用户点 UI 被正确拦截、中止生成后锁释放） | 结论取决于真实生成生命周期事件时序 | 本地测试禁止触发非 dryRun 生成（`F8` 红线） |
| **O6** | 历史楼层清洗正则对真实模型长上下文 token 膨胀与提示词去污染的端到端验收 | 结论取决于真实生成前的 `CHAT_COMPLETION_PROMPT_READY`（非 dryRun） | 需真实发送一次以校验最终发往模型的 payload |

---

## 九、子智能体冒充模型（可行性、代价与结论）

委托方明确提到“可以自己开一个子智能体，自己发消息，子智能体回复，虽然我不是很推荐”。

### 9.1 技术可行做法

1. **本地 Mock OpenAI 代理端点**：在 `127.0.0.1:<port>` 起一个极简 HTTP 服务实现 `/v1/chat/completions`，8001 酒馆将 API 指向该本地地址；请求到达时，代理把收到的 `messages` 转交给一个本地子智能体（或脚本规则）生成回复并按 SSE/JSON 返回给酒馆。
2. **伪造对话注入**：由子智能体阅读卡描述后生成一段回复文本，再由脚本通过酒馆接口写为最新 AI 楼层并手动触发 MVU 解析。

### 9.2 四条具体代价

| # | 具体代价 | 后果 |
|---|---|---|
| **1** | **模型失配，产生假绿/假红** | 协议遵循率、JSONPatch 畸形率、漏字段概率高度绑定目标玩家模型（如 DeepSeek/Claude/Gemini 各自脾气完全不同）。用子智能体（另一模型）冒充，它要么比目标模型更“听话”掩盖协议歧义（假绿），要么不熟悉目标格式乱报错（假红），结论无法迁移。 |
| **2** | **非确定性污染后续断言基线** | 子智能体每次回复的数值增量、新增人物、触发事件都不可精确复现；同一条回归用例跑两次可能走到不同分支，破坏本地测试“确定性、可重复、秒级定位”的核心优势。 |
| **3** | **仍消耗外部推理成本与高延迟** | 子智能体本身仍消耗模型 token（甚至比直接调一次廉价测试模型更贵）且耗时数十秒，违背“零 API、低成本高频跑全矩阵”的初衷；若是方案 2（绕过酒馆 Prompt 组装），还丢失了真实世界书注入与提示词裁剪链路。 |
| **4** | **维护复杂度暴涨** | 需要额外维护本地 Mock 网关、SSE 流式协议兼容、8001 API 配置切换与还原，且容易因配置未还原污染后续正常调 API 验收。 |

### 9.3 明确结论

**不推荐，默认禁用。**
**唯一例外（“除非……”）**：仅当需要验证“流式生成进行中（`GENERATION_BUSY`）的并发锁/中止生成按钮行为”，且现场完全没有可用外部 API 或明确禁止产生任何外部计费时，才允许使用**纯确定性静态 Mock 网关**（固定延迟 2 秒后吐出预写好的常量字符串，**不接任何子智能体**）做极窄范围的并发锁专项验证，用完立刻切回。

---

## 十、Skill 落地结构（供施工方直接建目录）

目录位置：`C:\Users\Administrator\.agents\skills\zero-api-card-test\`（原地升级至 `v2.0.0`，与 `ego-tavern-card-test` 并列）。

### 10.1 目录树

```text
zero-api-card-test/
├── SKILL.md
├── references/
│   ├── boundary-and-matrix.md
│   ├── contract-and-locators.md
│   ├── seed-strategies.md
│   ├── interaction-and-attribution.md
│   └── report-template.md
└── scripts/
    ├── local-st-lib.mjs
    ├── local-st-seed.mjs
    ├── local-st-runner.mjs
    └── local-st-evidence.mjs
```

### 10.2 `SKILL.md` 章节目录

1. Frontmatter（`name: zero-api-card-test`, `version: 2.0.0`，明确触发词与禁用边界）
2. `## 0. 开测前分流（先判要不要调 API）`（三步判定函数 + 永远出界速查表）
3. `## 1. 准备与配置`（`localtest.config.json`、卡形态探测复用 `card-probe.mjs`、8001 探活）
4. `## 2. 四阶段标准流程`
   - 阶段 1：静态体检 + 正规导卡与组件生效关（零 API，不调 `connectApi`）
   - 阶段 2：存档/楼层注入（P1/P2/P3 选路 + 隔离备份）
   - 阶段 3：数据驱动交互与断言执行（跨 iframe + 真实事件链 + 零 API 哨兵）
   - 阶段 4：自动取证归因 + 报告产出 + `--restore` 清场
5. `## 3. 硬禁令与安全红线`（绝不碰 8000、绝不直接拷卡进 `characters/`、零 API 哨兵违约即停、不认识弹窗绝不瞎点、刷新后必重选卡进聊天）
6. `## 4. 失败归因速查（F0–F8）`
7. `## 5. 纯 UI 离线仿真与真酒馆复核的关系`
8. `## 6. 参考索引`（指向 5 份 `references/`）

### 10.3 `references/` 文件职责清单

| 文件 | 一句话职责 |
|---|---|
| `references/boundary-and-matrix.md` | 定义零 API 判定规则、L1–L10 覆盖面矩阵、5 种卡形态分派表及永远出界的调 API 清单 |
| `references/contract-and-locators.md` | 规定 `data-testid`/`data-test-*` 契约规范、`card-test.manifest.json` 结构与四级元素定位降级栈 |
| `references/seed-strategies.md` | 详述 P1/P2/P3 三条存档与楼层注入路径、`initialized_lorebooks` 与 `initKey` 隔离、备份与 `--restore` 机制 |
| `references/interaction-and-attribution.md` | 详述跨 iframe 寻址、真实指针事件链、四道可交互门、点击前后双快照差分与 F0–F8 自动取证字段规范 |
| `references/report-template.md` | 给出零 API 验收报告骨架（必含断言表、归因证据路径、截图路径、`apiCalls: 0` 哨兵证明与未验证项） |

### 10.4 `scripts/` 骨架（函数签名与调用顺序）

```js
// 1) local-st-lib.mjs —— 通用酒馆底座 + 哨兵 + 交互引擎（不含任何具体卡标识）
export function assertSafeInstance(baseUrl);                         // 强制 port === '8001'
export async function installZeroApiSentinel(page);                  // 包装 fetch/XHR/TavernHelper/GENERATION_STARTED
export async function readZeroApiViolations(page);                   // 返回违规记录数组
export async function resolveFrame(page, framePath);                 // 逐层解析主文档/楼层/挂载/嵌套 iframe
export async function locateElement(page, framePath, locator);       // 四级降级定位（testId → ARIA → 控件+文本 → 启发式）
export async function checkActionable(page, framePath, locator, opts); // 存在/可见/可点/无弹窗四道门，失败返回 F1/F2/F3
export async function smartClick(page, framePath, locator, opts);    // 四道门 + 双快照探针 + 真实 pointer/mouse 事件链
export async function smartFill(page, framePath, locator, value);    // 原型链 setter + input/change，禁 undefined
export async function readStateSnapshot(page, manifest);             // 优先 __ST_CARD_TEST__ → Mvu → TavernHelper → chatMetadata
export async function reloadAndReopen(page, { avatar, chatId });     // 刷新 8001 → 等就绪 → 重选卡 → 重开测试聊天

// 2) local-st-seed.mjs —— 通用存档/楼层注入与清场（纯 Node，独立子进程运行）
export function assertSafeChatPath(targetPath);                      // 锁死 8001 chats 子树，禁 8000
export async function buildSeedContent({ strategy, baseChat, patch, builderModule, bookName, initKey, synthFloors });
export async function writeIsolatedChat({ charFolder, caseId, content, targetFile, backupRoot });
export async function restoreAll({ backupRoot });                    // 按 manifest 逆序清场还原

// 3) local-st-evidence.mjs —— 失败归因与自动取证包落盘
export async function captureEvidence(page, { code, step, framePath, locator, beforeSnap, afterSnap, shotDir });
export function formatReportMarkdown({ meta, gate, results, evidencePaths, shotPaths, apiCalls });

// 4) local-st-runner.mjs —— 主入口调用顺序
// main():
//   loadConfig() → assertSafeInstance()
//   → runStaticProbe() (复用 card-probe.mjs)
//   → openTavern(8001) + installZeroApiSentinel()   // 不调 connectApi()
//   → ensureCardImportedAndGatePass()               // L2 组件生效关，不过则报 F0
//   → for each suite in config.suites:
//       execFileSync(resolveNodeBin(), ['local-st-seed.mjs', ...]) + verifyMtimeFreshness()
//       → selectCharByAvatar() → openCharacterChat(seed.chatId)
//       → for each case & step:
//           executeStep() (调用 smartClick / smartFill / assert* / reloadAndReopen)
//           on failure → captureEvidence() → 记录 F1–F7 并按 failFast 策略继续或中止
//       → assert readZeroApiViolations().length === 0 (否则 F8)
//   → writeReport() → optional restoreAll()
```

---

## 十一、实施顺序与风险控制

### 11.1 分阶段落地计划

| 阶段 | 实施内容 | 验证方式 | 是否碰 8001 / 文件系统 |
|---|---|---|---|
| **Phase 0：安全护栏与骨架** | 创建 `zero-api-card-test` v2 目录、5 份 `references/`、`assertSafeInstance`/`assertSafeChatPath` 与 `local-st-seed.mjs` 的 `--restore` 逻辑 | 纯 Node 单测：构造越界路径、8000 URL 必须抛 `SAFETY_BLOCK`；模拟新建/覆盖/还原验证磁盘一致性 | 仅临时目录，**不碰 8001** |
| **Phase 1：底座与交互引擎** | 落地 `local-st-lib.mjs`（四级定位、四道可交互门、真实事件链、双快照差分、零 API 哨兵）与 `local-st-evidence.mjs`（F0–F8 自动取证） | 在离线假宿主（`harness.html`）或最小静态测试页上注入故意制造的 F1–F6 与 F8 故障，验证每类均准确输出对应归因码与取证包 | **不碰 8001** |
| **Phase 2：通用 Runner 与数据驱动协议** | 落地 `local-st-runner.mjs` 与 `*.suite.json` 执行器；打通 `card-probe.mjs` 形态分派 | 用 1 张纯文本/形态 A 卡在 8001 跑通 L1/L2/L4/L7，确认无契约降级栈生效且 `apiCalls === 0` | **碰 8001**（仅读+独立前缀测试聊天） |
| **Phase 3：高复杂卡样本验证** | 以《神豪终端》当前版本作为验证样本：在卡侧补最小 `data-testid` 契约 + 写 `tests/localtest/*.suite.json`（走 P3 构造器，覆盖卡包、卡册、商城、玩法券、奇物、珍藏锁、折叠条、叉号居中），淘汰旧的硬编码 `test-noapi-run.mjs` | 在 8001 全量实跑样本 suite，核对所有用例 PASS、故意破坏一个禁用态/版本号验证 F3/F5 一步定位、验证 `--restore` 清场干净 | **碰 8001**（独立 `__LOCALTEST_*` 聊天） |
| **Phase 4：Skill 文档收口** | 补齐 `SKILL.md` 与 `references/` 实测校准，更新项目 `HANDOFF.md` | 新开干净会话，仅凭 `SKILL.md` 指导独立跑通一次外部形态卡 + 样本卡 | 只读 + 8001 |

### 11.2 防误伤风控清单

1. **绝不碰 8000 实例**：`BASE_URL` 端口白名单硬编码仅允许 `8001`；任何读写 `C:\jiuguan\SillyTavern` 的路径在 `assertSafeChatPath` 层直接拒绝。
2. **绝不覆盖玩家/历史聊天**：seed 默认只生成 `__LOCALTEST_*` 前缀新文件；只有显式传 `--target` 时才覆盖已有文件，且**必须先写入备份并落盘 `manifest.json` 成功后**才允许写目标文件。
3. **绝不篡改 8001 全局配置**：不为了测试方便去改酒馆 `auto_load_chat` / `auto_connect` / 全局世界书；刷新测试严格走“刷新 → 重选卡 → 重开测试聊天”。
4. **不抢用户 space**：接管 ego space 时保留 `ownership === 'user'` 保护，遇到用户正在操作立即停手汇报。
5. **契约侵入最小化**：对样本卡新增 `data-testid` 仅作为 HTML 属性附加，不改变现有样式、布局或运行时逻辑；对无契约外部卡零修改直接走降级栈。
