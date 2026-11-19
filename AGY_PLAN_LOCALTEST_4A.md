# 《通用角色卡本地测试（零 API）》架构与 Skill 实施方案

> **定位**：与 `ego-tavern-card-test`（调 API 实机测试 Skill）并列的**零 API 姊妹版通用 Skill**（`zero-api-card-test` v2.0）。
> **适用对象**：任意 SillyTavern 角色卡（形态 A 纯文本卡 / 形态 B 带开局前端卡 / 形态 C 逐楼状态栏卡 / 形态 D 悬浮/固定 HUD 卡 / 形态 E MVU-Zod 变量驱动卡，以及混合形态卡）。
> **运行基线**：真实运行中的 SillyTavern 测试实例（`http://127.0.0.1:8001/`，绝对禁止触碰 `8000` 玩家实例），由 `ego-browser` 驱动，全程 `apiCalls === 0`。

---

## 0. 委托方原话锚点与纠偏对照

> **委托方原话（最高权重）**：
> 「现在的测试方法完全跑偏了，我希望的零API测试方法呢，是你做本地测试，什么是本地测试？就是不调用API，测试角色卡的功能，怎么测试？大概方向：必须在真实运行中的酒馆里面，但不必调用api，DSH自己改存档数据自己测，测试功能是否正常，测试交互，而且覆盖面很大，只除了专门需要调用API的场景比如看变量是否正常输出，但这是另一个方面的问题，变量输出本身就和所选的模型有关，甚至可以自己开一个子智能体，自己发消息，子智能体回复的这种做法，虽然我不是很推荐。」

### 现状五条事实缺陷 → 本方案根治路径对照表

| # | 现状事实缺陷 | 跑偏根因 | 本方案根治机制 |
|---|---|---|---|
| 1 | **断言绑死某版实现形状**（写死 5 页顺序、`.wheel-card === 3`、`#wfSvg .ring`，rc.36→rc.37 类名一改全碎） | 把「特定版本的 CSS 选择器与元素个数」当成了测试逻辑写死在 runner 代码里 | **三层解耦**：通用 runner 只认「动作原语 + 断言谓词」；定位走 **L1 测试契约 (`data-test`) → L2 语义/ARIA 角色与可见文本 → L3 启发式 DOM 探针**；卡专属预期抽离为声明式 `suite.json` 数据文件 |
| 2 | **预置状态绑死版本**（手写字面量与 inventory 条目，rc.37 新增 `cardCode/poolTier/serialNo` 后预置失步） | 靠人工手抄字段构造 JSONL，未与卡内 schema / 初始化引擎联动 | **四路状态合成管线**：① 卡内 Zod/JSON Schema 反射自动填充默认值 → ② 调用卡自身初始化/兜底函数 (`completeInitialState` / `[InitVar]` 解析) → ③ 克隆真实聊天存档打最小 RFC6902 JSONPatch → ④ 运行时内存直接注入 (`replaceMvuData` / `insertOrAssignVariables`) |
| 3 | **一次失败不区分归因层**（`WHEEL_SETTLE_TIMEOUT` 无法区分「按钮 disabled 没点上」还是「revision 冲突被拒」，需人工二次写脚本取证） | `waitFor` 只在超时末态抛一个布尔快照，点击前、点击瞬时、引擎执行期没有分层拦截与自动取证 | **7 层确定性故障归因状态机 (F1–F7)**：`uiAct` 在点击前必检存在性 (F1)、可见/遮挡 (F2)、可交互/非 disabled (F3)，点击后分流瞬时响应 (F4)、状态变更/错误码 (F5)、DOM 重绘同步 (F6)、测试脚本异常 (F7)，失败当场落盘 8 项证据包 |
| 4 | **覆盖面远小于功能面**（291 行只测 8 个点，rc.37 新增 9 类交互与结算一条没测） | 每测一个功能都要手写几十行命令式 `page.evaluate`，边际成本过高 | **10 层全覆盖矩阵 + 数据驱动契约表**：用声明式「前置状态 patch + 动作序列 + 状态/DOM 差分断言」描述功能，新增 9 类功能只需在 `suite.json` 追加数据块，0 行 runner 代码改动 |
| 5 | **只服务单张卡**（写死 `#cj-shenghao-phone-frame`、`__CJ_SHENGHAO_V2__`、`cupSize`） | 把单卡私有全局变量和 DOM ID 硬编码进测试引擎 | **五形态动态发现与适配器协议**：基于 `card-probe` + `survey` 自动发现 `mounted` 浮层、楼层 iframe、MVU `stat_data` 命名空间与运行时桥接对象 |

---

## 一、定义与边界：本地测试 vs 调 API 实机测试

### 1.1 什么是角色卡「本地测试（零 API）」

**定义**：在**真实运行的 SillyTavern 实例（8001）**中完成角色卡正规导入与组件挂载后，**切断或绕过一切向外部大语言模型（LLM）发送生成请求的动作**，由测试者（DSH）通过**直接构造/修改存档数据（JSONL 楼层、`chat_metadata`、MVU `stat_data`、运行时状态树）+ 合成含状态标记的假楼层 + 驱动真实浏览器 UI 交互**，对角色卡的静态结构、组件挂载、状态容错、界面渲染、交互流转、本地结算引擎、持久化回退及跨 iframe 通信进行全覆盖验证。

它必须同时满足两条硬基线：
1. **真酒馆环境**：不是纯 Node 单测，也不是脱离酒馆的静态 HTML 假宿主（`.work/harness/host.html` 仅作纯 UI 快速预览，不能替代本地测试）。它跑在真实的 SillyTavern DOM、真实的 `SillyTavern.getContext()`、真实的 `TavernHelper` 与 `Mvu` 扩展生命周期、真实的 `TH-script` / `TH-message` 同源沙箱 iframe 树下。
2. **零 API 消耗**：全程不点击酒馆发送按钮触发 LLM 生成、不调 `generateRaw`、不在向导末步挂 `waitGen: true`、不在最后一楼向右空滑触发续写。网络审计哨兵记录到的生成端点请求数必须恒等于 `0`。

### 1.2 可操作的判据分界线（一条规则定分流）

> **分流黄金判据（因果输入源测试）**：
> 设待验证断言为 $P$。问：**当把「LLM 服务端返回的字符串」替换为「测试脚本按规则直接写入存档/楼层的数据 $D$」时，断言 $P$ 要检验的代码路径或渲染结果是否发生改变？**
> - **若不改变**（即 $P$ 检验的是：`D` 写入后，酒馆/正则/MVU/卡内脚本/UI 是否正确解析、计算、渲染、响应交互并持久化） $\Longrightarrow$ **100% 归入「本地测试（零 API）」**。
> - **若改变**（即 $P$ 检验的恰恰是：**真实 LLM 读了当前提示词后，能不能遵循协议吐出合法的 $D$**，或者真实流式生成生命周期本身与前端的竞态） $\Longrightarrow$ **归入「调 API 实机测试（`ego-tavern-card-test`）」**。

形式化判定表（执行前逐项勾选）：

```
[待测项 X]
  ├─ Q1: X 的被测主体是「卡内 JS/HTML/CSS/正则/Zod/世界书配置」还是「外部 LLM 的指令遵循能力」？
  │     ├─ 卡内代码/配置 ──► 进入 Q2
  │     └─ 外部 LLM 遵循能力（如：模型会不会漏写字段、会不会越权写字段、文风对不对） ──► 【调 API 测试】
  │
  └─ Q2: 触发 X 所需的输入，能否通过「修改存档变量 / 注入合成楼层 / 触发酒馆事件 / 点击界面控件」构造？
        ├─ 能（哪怕原流程是在 AI 回复后触发，只要能用合成 AI 楼层 + 触发 MESSAGE_RECEIVED / MVU 解析替代） ──► 【本地测试（零 API）】
        └─ 不能（唯一触发源是真实流式生成通道的网路 I/O 锁或后端 token 流） ──► 【调 API 测试】
```

### 1.3 永远归「调 API 实机测试」的能力清单及原因

以下问题**永远无法**靠本地测试回答，因为被测函数是 $f_{\text{LLM}}(\text{Prompt}) \to \text{RawOutput}$，本地测试一旦手动构造 $\text{RawOutput}$，就等于把被测对象本身 mock 掉了：

| 序号 | 永远归调 API 一侧的场景 | 为什么本地测试无法回答 |
|---|---|---|
| A1 | **模型协议遵循率**：修改世界书协议（如 `protocol.txt`）或示例后，LLM 是否按格式输出 `<UpdateVariable>` / `<JSONPatch>` / `<status>` 块 | 本地测试可以验证「给定一段含 `<UpdateVariable>` 的文本，解析器能不能解析」，但无法验证「真实模型读了新提示词会不会忘写、写错路径或编造非法枚举」 |
| A2 | **模型字段完整度与越权写倾向**：新登场人物时 LLM 是否按 `pendingBasicProfiles` 补齐身高/体重/三围，是否试图篡改被锁定的只读字段 | 本地测试能测「结算器能不能拦住越权命令」，但测不出「模型在多轮长上下文后还有多高概率记得补齐待办字段」 |
| A3 | **子请求生成功能的Prompt有效性**：卡内调 `TavernHelper.generateRaw`（如「AI 一句话扩展角色」「AI 生成长期档案」）时，真实模型返回的 JSON 结构合格率与事实锚定率 | 本地可注入假返回值测 `parseProfileJSON` 和 `anchorProfileFacts` 的容错，但测不出真实模型在该 system prompt 下会不会吐 Markdown 废话或漏字段 |
| A4 | **世界书与正文对模型文风/叙事的引导效果**：尺度阀门、心绪链词库、防八股规则在真实生成正文中的文学表现 | 纯模型生成质量与注意力分布问题，无本地代码可测 |
| A5 | **真实流式生成期（Streaming）的实时增量渲染与网络中断恢复**：流式吐字过程中正则半闭合标签闪现、真实生成通道的 `GENERATION_BUSY` 锁与用户取消请求竞态 | 本地虽可置位 `generating=true` 测按钮禁用态，但真实后端 SSE 流式分块与酒馆 `stopGenerationById` 的底层网络销毁只能在真请求中重现 |

---

## 二、覆盖面矩阵：角色卡可在本地验证的 10 层能力穷举

本矩阵适用于**任意形态（A/B/C/D/E）**的角色卡。每一层均规定**确定性、可编程执行的断言类型**，严禁出现「目视检查是否正常」之类不可判定的描述。

| 层级 | 适用形态 | 子项能力点 | 可执行的断言类型（机器判据） |
|---|---|---|---|
| **L1 卡载体与静态结构层** | 全形态 (A–E) | ① PNG `tEXt/iTXt/zTXt` 的 `chara`/`ccv3` Base64 解码完整性<br>② CCv2/CCv3 规范必填键 (`name`, `first_mes`, `data.extensions`)<br>③ 世界书死条目（`enabled && !constant && keys.length===0`）<br>④ 正则语法合法性与 `placement`/`promptOnly`/`markdownOnly` 标志<br>⑤ 内嵌脚本数量与外网 URL 清单 | 1. **JSON 结构断言**：`Buffer.byteLength <= 3 * 1024 * 1024`（或卡自定上限），JSON parse 零异常<br>2. **零死条目断言**：`lore.noKeyNotConstant.length === 0`<br>3. **正则预编译断言**：对每条 `findRegex` 执行 `new RegExp()` 零语法错误 |
| **L2 导入与组件生效层** | 全形态 (A–E) | ① 走酒馆 UI `#character_import_file` 正规导入与弹窗链清空<br>② 内嵌世界书自动绑定与地球图标点亮 (`#world_button.world_set`)<br>③ 局部正则获批 (`character_allowed_regex.includes(avatar)`)<br>④ 酒馆助手脚本沙箱启动 (`iframe[id^="TH-script--"]`)<br>⑤ 运行时全局单例就位 (`TavernHelper`, `Mvu`, 卡自定义桥接对象) | 1. **弹窗净空断言**：`document.querySelectorAll('.popup:not([style*="display: none"])').length === 0`<br>2. **组件关卡布尔断言**：`rt.worldExists === true && rt.globeLit === true`、`rt.regexAllowed === true`、`rt.thScriptIframes === rt.thScriptsInCard`<br>3. **零启动异常断言**：`window.__agy.errors.length === 0` 且无 `toast-error` |
| **L3 状态层（Schema 与初始状态）** | B, E | ① `[InitVar]` 或卡内初始化器生成的默认状态树完整性<br>② Zod / JSON Schema 校验器对合法状态的通过率<br>③ 校验器对畸形/越界/原型污染字段（`__proto__`、负数金额、非法日期）的拦截与默认值回退 (`prefault`/`default`)<br>④ 脚本兜底衍生字段（如根据日期推算周期、根据分数推算等级、空行头自动补默认） | 1. **Schema 反射断言**：`schema.safeParse(state).success === true`，扁平叶子键集合 `Object.keys(flat(state)).length >= minExpectedKeys`<br>2. **边界注入负向断言**：向 `stat_data` 注入越界值后触发 `readCurrent()`，断言宿主不崩溃、不弹红 toast、非法字段回退至先验值或默认值<br>3. **衍生不变量断言**：如 `state.user.cashCents >= 0`、关联 ID 引用完整性 (`presentCharacterIds ⊆ Object.keys(characters)`) |
| **L4 渲染层（逐楼/状态栏/面板/详情）** | A, B, C, D, E | ① 形态 A/B：0 楼多开场白 (`alternate_greetings`) 渲染与宏展开 (`{{user}}`, `{{char}}`)<br>② 形态 C：向末楼注入含状态标签的合成 AI 消息后，正则将其替换为 HTML/iframe 状态栏，且无裸标签泄漏<br>③ 形态 D：悬浮/底部面板根据注入的存档状态精确渲染数值、列表、空状态占位、长文本截断/折行<br>④ 形态 E + M10：EJS 模板 `<% %>` 与 `{{getvar}}` 在显示侧和提示词侧（`CHAT_COMPLETION_PROMPT_READY` dryRun）均展开干净 | 1. **零泄漏正则断言**：楼层 `.mes_text.innerText` 匹配 `/<\/?[A-Za-z_][\w-]*[^>]*>|\{\{[^}]+\}\}|<%[\s\S]*?%>|\[object Object\]|\bundefined\b|\bNaN\b/` 结果数组为空 (`leaks.length === 0`)<br>2. **状态→DOM 投影一致性断言**：给定状态路径值 $V$（如 `cashCents: 150000000`），目标容器文本归一化后匹配期望格式化值（`1,500,000` 或 `150万`）<br>3. **提示词净空断言**：触发 dryRun prompt 组装后，`historyText` 不含美化 HTML 标签与 `<UpdateVariable>` 原文 |
| **L5 交互层（控件/导航/表单/弹层）** | B, C, D | ① 折叠态 ⇄ 展开态切换（含拖拽球 `pointerdown/up` + `click`）<br>② 一级导航 Tab / 二级分类筛选 Tab 遍历切换与激活态 (`aria-current` / `.active`)<br>③ 列表项点击进详情弹层 / 抽屉、关闭按钮（叉号、`Escape` 键、遮罩点击）返回<br>④ 表单输入校验（空值拦截、数值上下限、必填项未填时提交按钮 `disabled`）<br>⑤ 禁用态守卫（余额不足、次数用尽、加锁物品、生成忙碌 `busy=true` 时按钮不可触发动作） | 1. **状态机迁移断言**：点击入口 $A$ 后，目标视图容器 `offsetWidth > 0 && offsetHeight > 0 && getComputedStyle(el).visibility !== 'hidden'`；点击关闭后回到原视图<br>2. **导航遍历完备性断言**：对自动发现的所有导航项 $T_1 \dots T_n$ 依次点击，每次激活项唯一且内容区 DOM 签名发生变化，遍历全程 `console.error === 0`<br>3. **禁用态幂等断言**：当控件满足禁用条件时，断言 `el.disabled === true || el.getAttribute('aria-disabled') === 'true' || pointerEvents === 'none'`，且强行触发点击后 `state.meta.revision` 不变 |
| **L6 结算层（纯本地引擎运算）** | D, E | ① 随机/抽奖/开包引擎（免费抽、现金抽、积分抽、连抽/一包多卡、保底计数器推进与触发清零、每日/每周限次扣减）<br>② 赌场/博弈引擎（选卡/押注、禁用档位限制、胜负判定、连胜倍率、单卡封顶、收手兑换积分、败北销毁）<br>③ 商城/交易/提现引擎（积分/现金扣减、库存/持仓新增、重复购买升阶、门槛解锁、账本流水 `ledger` 记账）<br>④ 背包/日程/奇物联动（珍藏锁开关、玩法券排期写日历、取消日程退回 `READY`、日程完成后核销为 `USED`、奇物使用与效果生效）<br>⑤ 模型提案本地结算器（直接向 `settleNative` / `COMMAND_PARSED` 喂合成命令，验白名单过滤、好感/堕落/情欲护栏 `arousalGuard`、私密档案自动补齐 `syncPrivateRecords`） | 1. **会计恒等式与差分断言**：执行操作前快照 $S_0$，操作后 $S_1$，断言 `S1.meta.revision === S0.meta.revision + 1`、`S1.operationHistory[opId].status === 'COMMITTED'`、货币差额 $\Delta \text{cash} + \text{cost} === 0$<br>2. **保底与限次边界断言**：预置 `pity = max - 1` 抽一次后，断言产出必为目标稀有度且 `pity === 0`；预置 `todaySpins = limit` 后，断言操作被拒 (`DAILY_LIMIT_REACHED`) 且状态不变<br>3. **联动闭环断言**：排期后 `item.status === 'SCHEDULED' && appointments[id].status === 'PLANNED'`；将日程置为 `COMPLETED` 并触发结算后，`item.status === 'USED'` |
| **L7 持久化与回退层** | A, C, D, E | ① 网页硬刷新 (`page.goto(BASE)`) → 重新选卡进聊天 → 状态、界面、revision 完整回读不回退<br>② 切换 swipe 分支（0 楼切 greeting，或末楼在两个带不同 `stat_data` 的 swipe 间左右切换）→ 界面立即反映对应分支数据<br>③ 删楼 (`/del 1`) → 状态回退至上一楼，且若卡实现了分支级操作日志（如 `localStorage` ops log），验证合法玩家操作自动重放、不再成立的提现自动撤回并提示<br>④ 切换聊天存档 (`openCharacterChat`) / 新开聊天 (`newChat`) → 旧聊天状态不串入新聊天（`initKey` / `branchKey` 隔离） | 1. **刷新幂等断言**：刷新重进后 `deepEqual(readState(), stateBeforeReload) === true` 且挂载 iframe 数量恒为 1（无重复挂载泄漏）<br>2. **分支跟随断言**：在预置双 swipe 楼层执行 `swipe('right')`，断言 `readState().meta.sourceAnchor.swipeId === 1` 且 UI 显示分支 B 特征值<br>3. **删楼回退/重放断言**：在楼层 2 执行本地操作使 `rev: 2 → 3`，执行 `/del 1` 回楼层 1，断言要么回退至楼层 1 原始状态（标准 MVU 卡），要么重放后 `rev` 与账目严格自洽（带 ops 重放的卡） |
| **L8 跨 iframe 与宿主桥层** | B, C, D | ① 父子/兄弟 iframe `postMessage` 握手协议（`READY` → `INIT` → `BUILT` / `STATE_SYNC`）与 `channel + nonce` 校验<br>② 子 iframe 发起操作请求 (`OP_REQ`) → 宿主落盘 → 返回结果 (`OP_RES`) 的异步往返<br>③ 几何同步与停靠模式切换（悬浮 `position: fixed` + `transform: scale` ⇄ 嵌底 `.mes_text` 末尾 `position: relative`）<br>④ 全屏浮层锁宿主滚动 (`body.style.overflow === 'hidden'`) 与关闭后还原 | 1. **握手完成断言**：打开子界面后 ≤ 5s 内握手状态 `ready === true && built === true`，重试计数 ≤ 上限<br>2. **宿主键位与滚动锁断言**：全屏态下顶层发 `Escape` 键（非 spinning 时）能关闭子 frame，且关闭后 `document.body.style.overflow` 恢复原值<br>3. **停靠容器迁移断言**：切换 `dock: 'bottom'` 后，`phoneFrame.parentElement.matches('.mes_text, .mes_block') === true`；切回 `'float'` 后 `parentElement === document.body` |
| **L9 响应式、主题与几何层** | B, C, D | ① 多视口尺寸适配：桌面宽屏 (`1920×1080`)、紧凑笔记本 (`1280×800`)、手机竖屏 (`457×926`、`375×812`)<br>② 多主题切换（如 `sage` / `gold` / `purple` 或酒馆亮暗色）CSS 变量传播与对比度<br>③ 字号档位放大后，键值对行（`.kv`）、按钮、顶栏标题、关闭叉号不溢出、不重叠、不产生意外滚动条 | 1. **视口包含断言（零裁切）**：目标面板与侧栏 `rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 2 && rect.bottom <= innerHeight + 2`<br>2. **零重叠与对齐几何断言**：同行左右元素 `leftEl.getBoundingClientRect().right <= rightEl.getBoundingClientRect().left + 1`；居中图标中心点与容器中心点偏差 `Math.abs(cx1 - cx2) <= 1.5`<br>3. **折叠条零溢出断言**：折叠态高度 `Math.abs(rect.height - expectedHeight) <= 1` 且 `scrollHeight <= clientHeight + 1` |
| **L10 体积、性能与外网降级层** | 全形态 (A–E) | ① 卡文件总字节数与内嵌资源膨胀监控<br>② 复杂界面（如多环 SVG 轮盘、百人列表）打开与动画期间的主线程长任务 (`PerformanceObserver('longtask')`) 与 DOM 节点数上限<br>③ 外网依赖（CDN 脚本、远程图床、Google Fonts）断网/超时拦截下的内联兜底降级（界面不白屏、头像回退内联清单或占位符） | 1. **性能预算断言**：打开复杂子界面全过程 `longtasks.filter(t => t.duration > 100).length === 0`，SVG/列表总节点数 `<= budget`<br>2. **断网降级断言**：在页面注入 `fetch/Image` 离线模拟（对非 `127.0.0.1:8001` 的外部 URL 立即 reject），断言卡组件仍能完成初始化、头像/图标回退至本地兜底且零未捕获异常 |

---

## 三、通用性设计：如何做到「不限某一张卡」

### 3.1 为什么现有脚本一换版本/一换卡就碎？

因为现有 `test-noapi-run.mjs` 把**三件不同维度的事**混写在了同一个 JS 文件里：
1. **酒馆宿主与浏览器驱动机制**（通用的：选卡、切聊天、零 API 哨兵、跨 iframe 点击、截图、故障取证）；
2. **界面语义动作与断言引擎**（通用的：点导航 Tab、点按钮、断言列表项数量、断言状态字段变化、断言元素不越界）；
3. **单卡单版本的具体 DOM 选择器与业务预期**（专有的：`#cj-shenghao-phone-frame`、`['scene','women','mine','wealth','wheel']`、`.wheel-card === 3`）。

**通用化核心原则**：**引擎与卡解耦，代码与数据解耦，契约优先、探测兜底。**

### 3.2 允许硬编码的边界 vs 严禁硬编码的禁区

| 维度 | 允许在 Skill 通用脚本中硬编码（SillyTavern 平台不变量） | 严禁在通用脚本中硬编码（必须走探测或卡级配置） |
|---|---|---|
| **端口与环境** | `http://127.0.0.1:8001/`、`8000` 端口阻断守卫、ego `RUN_DIR` | 具体项目路径（如 `E:/SHZDCHOSSS`）、具体角色名（如 `神豪终端4`） |
| **酒馆宿主 DOM** | `#send_form`, `#send_textarea`, `#send_but`, `#mes_stop`, `#chat .mes`, `.mes_text`, `.popup`, `#toast-container`, `#world_button`, `#character_import_file`, `iframe[id^="TH-script--"]`, `iframe[id^="TH-message--"]` | 卡自己挂载的浮层 ID（如 `#cj-shenghao-phone-frame`）、卡内部类名（如 `.wheel-hub-grid`, `.kv-k`）、卡内部按钮 ID（如 `#wfGo`, `#f_name`） |
| **酒馆与扩展 API** | `window.SillyTavern.getContext()`, `window.TavernHelper`, `window.Mvu`, `ctx.chat`, `ctx.characters`, `ctx.selectCharacterById`, `ctx.openCharacterChat` | 卡私有的全局命名空间（如 `window.__CJ_SHENGHAO_V2__`）或私有变量根键（如 `stat_data.shenghao`） |
| **生成端点特征** | 酒馆后端生成路由正则 `/\/api\/(backends\|openai\|anthropic\|google\|openrouter\|novelai\|horde\|kobold\|textgen)\|\/generate\b\|\/chat\/completions/` | 某张卡特有的图床 URL 或热更新 Supabase 地址 |

### 3.3 三级元素定位与「测试契约层 (`data-test`)」设计

为了同时支持「正在积极开发的自有卡」和「拿来即测的第三方外部卡」，定位器采用 **L1 契约 → L2 语义 → L3 启发式探测** 三级降级架构：

```
locate(doc, targetSpec)
  ├── L1: 显式测试契约 (Test Contract) —— 自有卡推荐，改类名/改排版永不破
  │     匹配 [data-test="<key>"], [data-testid="<key>"], [data-act="<key>"]
  │
  ├── L2: 无障碍语义与可见文本 (Semantic & Role) —— 跨版本稳定，贴近真实用户感知
  │     匹配 role="tab" / nav button + 可见文本正则 / aria-label / placeholder / title
  │
  └── L3: 启发式结构探针 (Heuristic DOM Probe) —— 零契约外部卡自动兜底
        自动识别导航栏、卡片网格、键值对行、弹窗关闭键、主行动按钮
```

#### （1）L1 测试契约规范（供自有卡演进使用，轻量无侵入）
在角色卡 HTML 模板中，只要给关键交互点挂上 `data-test` 属性，无论 CSS 类名怎么重命名、DOM 层级怎么挪动，测试脚本一行不用改：
- 容器级：`data-test="root-panel"`、`data-test="fold-trigger"`、`data-test="nav-bar"`
- 导航项：`data-test="nav-tab:<tabId>"`（如 `data-test="nav-tab:wheel"`）
- 动作键：`data-test="act:<actionName>"`（如 `data-test="act:open-wheel"`、`data-test="act:spin-go"`、`data-test="act:close-modal"`）
- 状态展示槽：`data-test-bind="<statePath>"`（如 `data-test-bind="user.cashCents"`，测试引擎可自动校验该 DOM 节点的显示值是否与状态树对应路径一致！）

#### （2）L3 无契约启发式探测器（`discoverUiMap(doc)`，对任意卡生效）
当被测卡没有任何 `data-test` 时，通用探针在目标文档（主页面挂载浮层或楼层 iframe）中自动扫描并聚类出 6 类标准交互组件：

```js
// 启发式 UI 结构自动发现伪代码（运行于目标 iframe contentDocument 内）
function discoverUiMap(doc) {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  return {
    // 1. 折叠入口：尺寸较小 (<120x120) 或带 fold/mini/ball/toggle 特征词的可点击块
    foldTriggers: [...doc.querySelectorAll('[class*="fold"], [class*="mini"], [class*="ball"], [class*="float-btn"]')]
      .filter(vis),
    // 2. 导航 Tab 栏：位于容器顶部或底部的 nav / [role=tablist] / 含 ≥3 个同级按钮的横排容器
    navTabs: (() => {
      const explicit = [...doc.querySelectorAll('nav button, [role="tab"], [data-tab]')].filter(vis);
      if (explicit.length >= 2) return explicit.map(el => ({ key: el.dataset.tab || el.innerText.trim(), el }));
      // 启发式：找 children 均为同标签且 ≥3 个的 flex/grid 横排容器
      const bars = [...doc.querySelectorAll('div, ul, footer, header')].filter(c => {
        if (!vis(c)) return false;
        const kids = [...c.children].filter(vis);
        return kids.length >= 3 && kids.length <= 8 && new Set(kids.map(k => k.tagName)).size === 1
          && Math.abs(kids[0].getBoundingClientRect().top - kids.at(-1).getBoundingClientRect().top) < 12;
      });
      return (bars[0] ? [...bars[0].children] : []).map(el => ({ key: el.innerText.trim(), el }));
    })(),
    // 3. 子筛选 Tab（如资产分类、背包分类、盘面切换）
    subTabs: [...doc.querySelectorAll('[data-asset-tab], [data-cat], [data-filter], [class*="tabs"] button, [class*="modes"] button')].filter(vis),
    // 4. 关闭/返回按钮：右上角 × / ✕ / Close / 返回
    closeButtons: [...doc.querySelectorAll('button, [role="button"], .close, [class*="close"]')].filter(el =>
      vis(el) && /^(×|✕|✖|X|关闭|返回|收起)$/i.test(el.innerText.trim() || el.getAttribute('aria-label') || '')
    ),
    // 5. 表单输入控件
    inputs: [...doc.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(vis),
    // 6. 可点击功能按钮
    buttons: [...doc.querySelectorAll('button, [role="button"], input[type="submit"], a[href]')].filter(vis),
  };
}
```

### 3.4 五种卡形态的自动分派（对接 `card-shapes.md`）

通用流程启动时，先运行 `card-probe.mjs`（离线静态特征）+ `survey()`（运行时 ` baseline` 差分与 `floors` 扫描），算出卡的形态位图 `shapes = { A, B, C, D, E }`（一张卡可同时命中多个形态，如《神豪终端》= `B + C(折叠更新框) + D(小手机+全屏轮盘) + E(MVU-Zod)`），然后自动分派零 API 测试策略：

| 形态 | 静态+动态识别判据 | 零 API 本地测试分派策略 |
|---|---|---|
| **形态 A：无开局前端纯卡** | `greetings.length >= 1` 且 `floors[0].iframes` 无表单控件，`mounted` 为空，`varsKeys === 0` | ① 0 楼 `swipe` 遍历所有 `alternate_greetings`；② 检查每条 greeting 的宏展开与 `leaks === []`；③ 注入 1 楼用户消息 + 2 楼合成 AI 消息，验正则显示与 prompt 侧替换；④ 验 `/del`、`/swipe`、刷新保持 |
| **形态 B：带开局前端 / 建档向导卡** | `floors[0].iframes` 存在且 `inner.controls` 含 `input/select/button` | **双轨测试（均不调 API）**：<br>① **轨 1（测向导 UI 本身）**：在 0 楼 iframe 内遍历预设选择、输入框填写、步骤切换、非法值拦截；**在点最后一步「开始/提交」前，用拦截器 stub 掉 `triggerSlash('/trigger')` 和 `generateRaw`**，使提交只执行本地状态初始化与第 1 楼写入，不发 API 请求！<br>② **轨 2（测开局后的主界面）**：直接通过存档注入写入已初始化的第 1 楼状态，跳过向导直达主界面 |
| **形态 C：逐楼固定状态栏卡** | `regex` 含 `placement: AI输出` 且替换为 HTML/iframe，或 AI 楼层 `.mes_text` 含状态块 | ① 构造含标准状态块（从世界书协议示例中提取或由模板合成）的假 AI 楼层追加到聊天；② 触发酒馆渲染刷新 (`reloadCurrentChat`)；③ 断言最新楼 `htmlBlocks > 0` 或 `iframes.length > 0` 且 `leaks === []`；④ 触发 dryRun prompt 组装，断言美化 HTML 被 `promptOnly` 正则剥离、不污染上下文 |
| **形态 D：全局固定 / 悬浮界面卡** | `survey.mounted` 非空（`body` 或 `#sheld` 下新增可见元素/iframe），或末楼 `.mes_text` 挂载持久化面板 | ① 自动从 `mounted` 提取宿主浮层 iframe ID（不写死 ID）；② 验折叠/展开切换；③ 自动发现所有导航 Tab 与子 Tab 并遍历点击；④ 验子浮层（如全屏轮盘/详情弹窗）打开、跨 iframe 握手、关闭；⑤ 验多视口几何零越界与停靠切换 |
| **形态 E：MVU / 变量驱动卡** | `typeof window.Mvu === 'object'` 或脚本调用 `getVariables`/`replaceMvuData`，或楼层 `variables[0].stat_data` 非空 | ① 自动探测 `stat_data` 下的根命名空间（或顶层扁平键）；② 注入多种边界预置存档，验 UI 数值绑定一致性；③ 驱动本地结算操作（抽奖/买卖/排期）或直接喂合成 `<UpdateVariable>` 命令给 MVU 解析器，验增量更新、Schema 守卫、刷新持久化与 `/del` `/swipe` 回滚一致性 |

---

## 四、存档注入的通用方法（不知道对方卡 Schema 时如何造状态）

在零 API 测试中，**「怎么不靠大模型生成，就让角色卡进入任意想要的合法状态」**是核心基石。针对未知卡或频繁迭代的卡，设计**四条互补的状态合成路径**与**一套绝对安全的隔离还原机制**。

### 4.1 状态存储位置与运行时桥接的自动发现

不同角色卡在酒馆里存状态的方式有 4 种，通用注入器先按以下顺序自动嗅探目标卡的「状态槽位签名（State Slot Descriptor）」：

1. **MVU 楼层变量槽（最常见于现代复杂卡）**：读取 `chat_metadata` 或 JSONL 每行消息的 `variables[swipe_id].stat_data` + `initialized_lorebooks: { "<世界书名>": [] }`。若 `stat_data` 下有唯一顶层对象键（如 `stat_data.shenghao`），记录 `rootKey = "shenghao"`；若直接是平铺键值对，记录 `rootKey = null`。
2. **TavernHelper 聊天/角色变量槽**：通过 `TavernHelper.getVariables({ type: 'chat' })` 或 `{ type: 'message', message_id }` 读写 `ctx.chatMetadata.variables`。
3. **世界书 `[InitVar]` 条目声明**：扫描角色卡绑定的世界书，找 `comment` 含 `[InitVar]` 的条目，其 `content` 即为卡作者定义的合法初始 JSON 或 YAML 字面量。
4. **卡自带运行时全局对象（Runtime Bridge）**：扫描 `window` 对象相比空酒馆基线新增的全局变量（排除 `__agy` 等探针），识别出带有 `read / getState / action / submit / inspect / schema` 等方法的桥接单例（如 `window.__CJ_SHENGHAO_V2__` 和 `window.__CJ_SHENGHAO_SCHEMA__`）。

### 4.2 造出合法、可控、可复现起始状态的四条路径

```
                  ┌──────────────────────────────────────────────┐
                  │         通用存档状态合成器 (State Seeder)      │
                  └──────────────────────┬───────────────────────┘
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
[路径 A: Schema 反射派生]        [路径 B: 真实存档克隆+Patch]      [路径 C: 卡自有种子/向导拦截]
 读 Zod / [InitVar] 树           克隆现有合规 .jsonl 末楼          调 completeInitialState 或
 自动填 default/prefault         只打最小 RFC6902 JSONPatch        拦截向导 submit 的本地落盘
 (适合：版本频繁加字段的自有卡)   (适合：完全黑盒的第三方复杂卡)     (适合：带形态 B 向导的卡)
```

#### 路径 A：从卡自带 Schema（Zod 反射）或 `[InitVar]` 自动派生（抗版本漂移主力）
- **原理**：
  - 若卡在运行时暴露了 Zod schema（如 `window.__*_SCHEMA__` 或源码 `createSchema(z)`），不用手写全量字段！用通用 **Zod 默认值行走器（`zodWalkDefaults(schema, overrides)`）**：沿着 `ZodObject.shape` 递归，遇到 `ZodDefault` / `ZodPrefault` 直接取其默认值；遇到无默认值的必填叶子（`ZodString` / `ZodNumber` / `ZodEnum` / `ZodLiteral`），按约束（`min/max/regex/enumValues`）自动生成最小合法值，最后深合并测试预置的 `overrides`（如只指定 `{ "user.cashCents": 150000000 }`），再过一遍 `schema.parse()`。
  - 若是无 Zod 的普通 MVU 卡，直接解析该卡世界书中的 `[InitVar]` 条目正文作为 base state，再合并 `overrides`。
- **为什么能彻底解决「现状缺陷 2（rc.37 加了 `cardCode/poolTier/serialNo` 预置没跟上）」**：
  - 因为 `schema.js` 里 `cardCode`、`poolTier`、`serialNo`、`locked` 都定义了 `.default(null)` / `.default(0)` / `.default(false)`！只要预置器在构造 `inventory` 条目时，对每个条目调用一次 `schemas.state.shape.inventory.element.parse(partialItem)`（或由 schema 反射器自动补齐），哪怕只传 `{ itemId, category, refId, rarity, obtainedDate }`，新增的 4 个字段都会由 Zod **自动补齐合法默认值**，永远不会因为版本加字段而失步。
- **适用条件**：卡带有 Zod Schema（运行时或源码可访问）或世界书含 `[InitVar]`。
- **失败模式与降级**：若某个新增必填字段既无 `.default()` 又带复杂 `.refine()` 校验（如特殊校验和），反射器会捕获 `ZodError.issues`，打印出缺失的具体路径，并自动降级到路径 B 或路径 C。

#### 路径 B：克隆真实合规存档 + 最小 Patch（黑盒卡万能方案）
- **原理**：拿一份已经走过开局的真实聊天存档（或随卡附带的 golden 样本楼层），深拷贝其末楼的 `variables[swipe_id].stat_data`，然后**只对本次测试关心的 1~3 个字段打 JSONPatch / 路径赋值**（同时强制刷新 `meta.initKey = "noapi_" + Date.now()` 以斩断旧 `localStorage` 操作日志重放），其余几百个未知字段原封不动保留。
- **适用条件**：完全不知道内部 Schema 的第三方复杂卡，或想在某个特定的真实剧情存档现场复现 bug。
- **失败模式与降级**：若卡做过破坏性大版本升级（旧存档连卡自己的 `readCurrent` 都过不了），克隆出的旧状态会被卡拒绝；此时必须先走一次路径 C 生成新版基线快照。

#### 路径 C：走卡自己的种子函数 / 拦截开局向导本地提交（100% 原生合法）
- **原理**：
  - **子路 C1（源码/运行时种子函数）**：直接调用卡自身的初始化合成器（如 `initialize(draft)` + `completeInitialState(base, draft)`），让卡自己的 `seedAnatomy`、`seedOutfit`、`computeCycle`、`refreshContext` 把所有关联字段算好。
  - **子路 C2（实机向导无 API 提交拦截）**：对于形态 B（带开局向导）的黑盒卡，在浏览器里挂上 **`interceptTriggerOnly()`**（把 `TavernHelper.triggerSlash` 中触发 AI 生成的 `/trigger` 和 `SillyTavern.getContext().generate` 替换为空操作 `async () => {}`，但**保留** `createChatMessages` 与 `replaceMvuData`），然后在 0 楼向导點「预设 → 开始」。卡自己的向导代码会完整算出初始状态并写入第 1 楼，同时**不发任何 API 请求**！随后把这第 1 楼提取出来存为该版本的基准模板（Golden Seed）。
- **适用条件**：任何带开局向导（形态 B）或暴露了初始化 API 的卡。
- **失败模式**：极少数卡把「状态初始化」放在「收到第 1 条 AI 回复之后」而非向导提交时；此时需配合注入一条含 `[InitVar]` 或 `<UpdateVariable>` 的合成第 2 楼。

#### 路径 D：运行时内存热注入（免重开聊天的快速连续测试）
- **原理**：在同一个已打开的测试聊天里，连续验证 10 种边界状态（如：空包 → 满保底 → 百万身家 → 锁定卡）时，无需每次重写磁盘 `.jsonl` 并刷新网页；直接在浏览器端调用 `window.Mvu.replaceMvuData(patchedVars, { type: 'message', message_id: lastId })` 或 `TavernHelper.insertOrAssignVariables(...)`，并触发卡的状态重读（或发一条 `MESSAGE_UPDATED` 事件），耗时从 6 秒缩短到 **50 毫秒**。（注：测「L7 持久化与刷新回读」时仍须走磁盘 `.jsonl` 注入）。

### 4.3 隔离手段与铁律（绝不污染玩家存档）

```
[安全边界守卫 assertSafeTarget]
  ├─ 1. 端口与目录双重锁死：只认 8001 与 E:/Ajiuguanagentceshi/SillyTavern/data/default-user/chats/
  │     路径中含 "8000" 或 "C:\jiuguan" 立即 throw SAFETY_BLOCK
  ├─ 2. 独立聊天文件命名：默认只写 __NOAPI_TEST_<suite>_<preset>.jsonl，绝不直接改玩家原有聊天
  ├─ 3. 独立 initKey 与 localStorage 命名空间：每次 seed 生成唯一 initKey ("noapi_" + preset + "_" + ts)，
  │     测试结束清理 localStorage 中含 test branchKey / initKey 的键
  └─ 4. 事务级 Manifest 备份与 --restore 一键清场：
        凡创建或覆盖任何文件，先写 .work/noapi-backups/manifest.json；
        --restore 逆序删除所有 created 测试聊天、还原所有 overwritten 备份、清空测试 localStorage
```

---

## 五、交互驱动的通用方法：怎么在真实酒馆里稳定地「点到东西」

在真实酒馆里驱动角色卡 UI，最大的敌人是**多层嵌套同源 iframe、自定义 Pointer 手势监听、异步状态锁（`busy`）导致的瞬时 `disabled`、以及弹窗/抽屉遮挡**。

### 5.1 跨 iframe 递归定位器（Frame Tree Resolver）

酒馆里的角色卡界面可能存在于 4 个位置：
1. 顶层 `document`（直接挂在 `body` 或 `#sheld` 上的浮层 div）；
2. 顶层挂载的独立 iframe（如 `#cj-shenghao-phone-frame`、全屏 `#cj-shenghao-wheel-frame`）；
3. 聊天楼层内的消息 iframe（`#chat .mes iframe`，如 `#TH-message--0--0`）；
4. 酒馆助手后台脚本 iframe（`iframe[id^="TH-script--"]`，通常 `0×0` 不可见，承载运行时逻辑）。

通用定位函数 `resolveTargetFrame(page, frameSpec)` 支持三种指定方式，绝不要求写死具体 ID：
- `frameSpec = "auto-mounted"`：自动从 `survey.mounted` 中按面积/z-index 选当前可见的顶层业务 iframe（若全屏浮层已打开则优先命中全屏 iframe，否则命中悬浮面板 iframe）；
- `frameSpec = { floor: 0, index: 0 }`：定位第 $N$ 楼内的第 $M$ 个可见 iframe；
- `frameSpec = "selectorOrId"`：显式 CSS 选择器或元素特征。

### 5.2 为什么 `el.click()` 经常不触发真实交互？——全序列事件派发器

**本项目已踩过的实机深坑**：小手机折叠球绑定的是 `pointerdown` → 位移判定 → `pointerup` 手势（用来区分「拖拽位置」和「点击展开」）；此外许多现代 UI 组件监听的是 `mousedown/mouseup` 或依赖 `PointerEvent` 的 `isPrimary/button/clientX/clientY`。单纯调 DOM `el.click()` 只派发一个坐标为 `(0,0)` 的合成 `MouseEvent('click')`，**根本不会触发 `pointerdown` / `pointerup`**，导致折叠球纹丝不动、卡包撕开手势不响应。

因此，通用交互原语 `uiAct(page, action)` 内部严禁裸调 `el.click()`，必须执行**真实几何中心点的全序列事件链（Full Pointer-Mouse-Click Sequence）**：

```js
// 在目标 iframe 的 contentWindow (win) 与 contentDocument (doc) 中执行的通用点击内核
function dispatchRealTap(el) {
  const win = el.ownerDocument.defaultView;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const opts = {
    bubbles: true, cancelable: true, composed: true, view: win,
    clientX: cx, clientY: cy, screenX: cx, screenY: cy,
    button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true,
  };
  el.dispatchEvent(new win.PointerEvent('pointerover', opts));
  el.dispatchEvent(new win.PointerEvent('pointerenter', { ...opts, bubbles: false }));
  el.dispatchEvent(new win.PointerEvent('pointerdown', opts));
  el.dispatchEvent(new win.MouseEvent('mousedown', opts));
  if (typeof el.focus === 'function') el.focus({ preventScroll: true });
  el.dispatchEvent(new win.PointerEvent('pointerup', { ...opts, buttons: 0 }));
  el.dispatchEvent(new win.MouseEvent('mouseup', { ...opts, buttons: 0 }));
  el.dispatchEvent(new win.MouseEvent('click', { ...opts, buttons: 0, detail: 1 }));
}
```
对于拖拽类交互（如「拖动撕开卡包」「拖拽悬浮球位移」），提供 `dispatchRealDrag(el, { dx, dy, steps: 8 })`，按步插值派发 `pointerdown` → $N$ 次 `pointermove` → `pointerup`。

### 5.3 点击前的「三道预检闸门」（消灭 `disabled`、遮挡与动画期误点）

针对**现状缺陷 3**（刚进聊天或刚打开轮盘时，`view.busy` / `mvuBusy` 尚未落定，按钮处于瞬时 `disabled`，脚本直接 `.click()` 落在禁用按钮上导致静默无反应），通用点击器在派发事件前必须通过 **Pre-Act Gate（默认等待上限 5000ms，轮询间隔 120ms）**：

1. **Gate 1：几何可见与稳定（Visibility & Motion Stability）**
   - `rect.width > 1 && rect.height > 1`，`display !== 'none'`，`visibility !== 'hidden'`，`opacity > 0.05`。
   - **动画稳定检测**：连续两次采样（间隔 80ms）元素的 `(rect.left, rect.top, rect.width, rect.height)` 变化均 `<= 1px`，防止在抽屉滑出或扇形展开动画半途点歪。
2. **Gate 2：非禁用与宿主空闲（Interactable & Host Idle）**
   - 检查 `el.disabled !== true`、`el.getAttribute('aria-disabled') !== 'true'`、`!el.classList.contains('disabled')`、`getComputedStyle(el).pointerEvents !== 'none'`。
   - 若探测到卡运行时存在 `busy()` / `inspect().busyReasons` 接口，等待 `busy === false` 后再点（**除非当前测试用例显式声明 `expectDisabled: true` 专门测禁用态拦截**）。
3. **Gate 3：命中测试防遮挡（Hit-Test / Occlusion Check）**
   - 在目标 `doc` 内计算中心点 `(cx, cy)` 处的 `topEl = doc.elementFromPoint(cx, cy)`，断言 `el.contains(topEl) || topEl.contains(el)`；
   - 同时在顶层酒馆 `window.document` 检查该 iframe 对应屏幕坐标处是否被酒馆未关闭的左右抽屉（`#right-nav-panel.openDrawer`、`#WorldInfo.openDrawer`）、`#preloader` 或 `.popup` 遮挡！若被抽屉挡住，自动先调 `closeDrawers(page)`。

### 5.4 确认框与 Toast 的统一读取与归类

每次交互动作前后，探针自动采集两路反馈通道：
- **酒馆顶层通道**：`#toast-container .toast`（按 `.toast-error` / `.toast-warning` / `.toast-info` 分类记录文本与时间戳）+ `.popup` 模态框。
- **卡内自建 Toast / Notice / Modal 通道**：在目标 iframe 内挂 `MutationObserver` 监控含 `toast / notice / alert / msg / result / modal / dialog` 类名或 `[role="alert"]`、`[role="status"]` 的新增可见文本。

### 5.5 如何精确区分「点了没反应」与「点了但断言判据写错」

每次 `uiAct(click)` 执行时，自动记录一份**四维反应指纹（Reaction Delta）**：
1. $\Delta \text{DOM}$：目标 iframe 内 DOM 树的文本长度、可见节点数、激活类名（`active/on/open/selected`）的哈希变化；
2. $\Delta \text{State}$：宿主状态树 `revision`、`varsChanged`（扁平变量叶子 diff）、`operationHistory` 末条记录；
3. $\Delta \text{Msg}$：跨 iframe `postMessage` 队列新增消息（如 `WHEEL_OP_REQ` → `WHEEL_OP_RES`）；
4. $\Delta \text{Feedback}$：新增的顶层/卡内 Toast、Notice、Console Error。

**判定矩阵**：
- 若 $\Delta \text{DOM} = 0 \land \Delta \text{State} = 0 \land \Delta \text{Msg} = 0 \land \Delta \text{Feedback} = 0$ $\Longrightarrow$ **确认为「F4 点击无任何可观测反应」**（事件监听未绑上，或被内部早退守卫静默 return）。
- 若 $\Delta \text{Msg}$ 有 `OP_REQ/OP_RES(ok:false, errorCode)` 或 $\Delta \text{Feedback}$ 有错误 toast，但 $\Delta \text{State} = 0$ $\Longrightarrow$ **确认为「F5 交互已触发引擎，但被业务规则拒绝」**（如 `STALE_REVISION`、`INSUFFICIENT_FUNDS`、`DAILY_LIMIT`）。
- 若 $\Delta \text{State} \neq 0$（状态已变、`revision` 已加 1）或 $\Delta \text{DOM} \neq 0$（画面已更新），但用户写的断言选择器没匹配上 $\Longrightarrow$ **确认为「F6/F7 状态或画面已更新，但渲染未同步或断言选择器过时」**，直接打印出实际变化的 DOM 节点和 `varsChanged`！

---

## 六、失败归因层（F1–F7 确定性分类与自动取证规范）

> **设计目标**：彻底终结「报错只给一个 `TIMEOUT`，还要人工再写脚本去查是 `disabled` 还是 `STALE_REVISION`」的返工循环。**任何一次失败，单看落盘的 `failure-evidence.json` + 截图，必须在 10 秒内直接定位到根因层级。**

### 6.1 七层失败分类与判定流水线

```
[执行用例 Step]
  │
  ├─ 1. 查找目标 Frame 与元素 ── 找不到 ──► 【F1_ELEMENT_MISSING】（契约/选择器缺失或 iframe 未挂载）
  │
  ├─ 2. 检查可见性与遮挡 ──────── 0x0 / hidden / 被抽屉或弹窗挡住 ──► 【F2_ELEMENT_NOT_VISIBLE】
  │
  ├─ 3. 检查可交互态与宿主锁 ──── disabled / pointer-events:none / busy=true 超时未释放 ──► 【F3_ELEMENT_NOT_INTERACTABLE】
  │
  ├─ 4. 派发真实事件序列并采样 Reaction Delta
  │     ├─ 四维变化全为 0 ──► 【F4_NO_REACTION】（点击了可见可用元素，但无 DOM/State/Msg/Toast 任何反应）
  │     │
  │     ├─ 有 Msg/Toast/Error 但 State 未按预期改变 ──► 【F5_STATE_REJECTED_OR_UNCHANGED】
  │     │     （细分：STALE_REVISION / BUSY_LOCK / RULE_GUARD_REJECT / ZOD_PARSE_FAIL / JS_EXCEPTION）
  │     │
  │     └─ State 已正确改变 (revision 递增/字段已变)，但 UI 断言超时 ──► 【F6_RENDER_DESYNC_OR_ASSERT_DRIFT】
  │           （细分：状态变了但视图未重绘 vs 视图已重绘但断言选择器与新版 DOM 不匹配）
  │
  └─ 5. 脚本语法/运行时崩溃 / 违反零 API 哨兵 ──► 【F7_HARNESS_OR_VIOLATION_ERROR】
```

### 6.2 每类失败强制自动落盘的 8 项取证清单（Evidence Bundle）

一旦任何一步判定失败，框架在 `throw` 之前自动调用 `captureFailureEvidence(page, step, category)`，在 `reports/noapi-evidence/<timestamp>-<stepId>/` 下写出完整证据包：

| 归因代码 | 分类名称 | 自动落盘的必选证据字段（写入 `evidence.json` + `shot.png`） | 一眼定责判据（怎么读证据） |
|---|---|---|---|
| **F1** | `ELEMENT_MISSING` | ① 当前已挂载的所有 iframe 列表 (`id, rect, display`)<br>② 目标 frame 内 `discoverUiMap()` 扫出的所有可见按钮/Tab/契约属性清单<br>③ 候选模糊匹配建议（Levenshtein / 文本包含）<br>④ 整页截图 | 若 `mounted` 无该 frame → 组件未启动；若 `discoverUiMap` 里有同义按钮但类名变了 → **版本样式漂移，更新契约或降级到文本匹配** |
| **F2** | `ELEMENT_NOT_VISIBLE` | ① 目标元素 `rect` 与 `computedStyle` (`display, visibility, opacity, transform`)<br>② 祖先链中第一个 `display:none` 或 `overflow:hidden` 的节点路径<br>③ `elementFromPoint(cx, cy)` 实际命中的遮挡元素 outerHTML（含顶层抽屉/弹窗状态）<br>④ 整页截图 | 若命中 `#right-nav-panel` 或 `.popup` → 宿主抽屉/弹窗未关；若祖先 `.folded` 未展开 → **前置展开步骤未生效** |
| **F3** | `ELEMENT_NOT_INTERACTABLE` | ① 元素 `disabled`、`aria-disabled`、`className`、`pointerEvents`<br>② 宿主桥 `inspect()` 快照：`busyReasons: { generation, setup, mvu, extra }`<br>③ 当前状态树中决定该按钮可用性的关联字段（如 `cashCents`, `todaySpins`, `selectedCardId`） | **直接破案 rc.37 的 GO 卡点**：若 `el.disabled === true` 且 `busyReasons.mvu === true` → 进聊天后 MVU 初始化未落定；若 `selectedCardId === ""` → 前置选卡没点上 |
| **F4** | `NO_REACTION` | ① 派发事件序列日志 (`pointerdown/up/click` 的坐标与返回值)<br>② 点击前后 1500ms 内 `postMessage` 帧记录（`wheelDbg` / `__agy.msgs`）<br>③ 目标元素绑定的内联属性 (`onclick`, `dataset.*`) 与祖先委托容器<br>④ Console log / warn / error 完整尾部 | 若 `postMessage` 有发出 `OP_REQ` 但无 `OP_RES` → 跨 frame `channel/nonce` 或 `event.source` 校验丢包；若完全无消息 → 事件监听器未绑定到该节点 |
| **F5** | `STATE_REJECTED_OR_UNCHANGED` | ① 点击前后宿主状态 `revision` 对比与 `lineage` 哈希<br>② `operationHistory` 最近 5 条记录及 `errorCode`（如 `STALE_REVISION`, `GENERATION_BUSY`, `WITHDRAWAL_REVIEW_REQUIRED`）<br>③ 顶层与卡内新增 Toast 原文 (`__agy.toasts`)<br>④ MVU / Zod 报错栈 (`diagnostics`) | **直接破案另一半假设**：若见 `errorCode: "STALE_REVISION"` 或 toast 提示版本过期 → 子 frame 持有的 `view.revision` 未在 `WHEEL_STATE_SYNC` 中同步最新值 |
| **F6** | `RENDER_DESYNC_OR_ASSERT_DRIFT` | ① 状态树实际 diff (`varsChanged`：列出哪些字段已经变了！)<br>② 目标容器点击前后的 DOM diff（新增/变化的文本节点与类名）<br>③ 失败断言所查选择器在当前文档中的实际匹配数与邻近 HTML 片段<br>④ 整页截图 | 若 `varsChanged` 已含新结果且 DOM 文本已变，但断言查的 `#wfResult.on` 为空 → **渲染正常，是断言选择器写死旧类名**；若 DOM 完全未变 → `publish()` 未触发子页重绘 |
| **F7** | `HARNESS_OR_VIOLATION_ERROR` | ① `__NOAPI_VIOLATIONS__` 捕获到的违规请求 URL 与调用栈 (`new Error().stack`)<br>② 页面未捕获异常 `pageErrors` 与 `unhandledrejection`<br>③ 预置文件 `mtimeMs` 与 `initKey` 校验结果 | 若 `__NOAPI_VIOLATIONS__` 非空 → 某按钮误触发了真实生成（如漏拦截 `/trigger` 或点了 `buildProfile`），按调用栈直接定位触发源 |

---

## 七、版本漂移防护：一天迭代数版，测试怎么自动跟上

角色卡在密集开发期（如 rc.34 → rc.35 → rc.36 → rc.37），一天之内可能改导航结构、改 CSS 类名、给 Schema 加字段、改商城商品数量。为防止「每次改卡都要重写测试脚本」，建立三层防漂移机制：

### 7.1 改动分级：哪些零成本自动通过 vs 哪些必须报「契约缺失」

| 卡的改动类型 | 测试系统行为 | 为什么这样设计 |
|---|---|---|
| **1. 纯样式与布局类名重构**（如 `.wheel-wallet` 改名 `.wheel-topbar`，`.portal` 改名 `.wheel-card`，但 `data-test` 或按钮可见文本未变） | **零成本自动通过** | 定位器走 L1 `data-test` 或 L2 语义文本/角色，不读具体装饰性 CSS 类名；几何断言只量 `getBoundingClientRect()` 是否越界/重叠 |
| **2. Schema 新增带默认值的字段**（如 `inventory` 新增 `cardCode/poolTier/serialNo/locked`） | **零成本自动通过** | 预置生成器通过卡内 `createSchema(z)` 动态 parse 补齐所有默认值，不靠手抄字段列表 |
| **3. 导航 Tab / 商城分类 / 卡池条目的增删或顺序调整** | **通用遍历层自动跟随 + 契约层精确报 diff** | 通用烟雾测试（Smoke Traversal）动态读取当前 DOM 的所有 Tab 并逐个点通（保证不崩、不白屏、无泄漏）；若声明式 `suite.json` 里钉死了契约数量，则报清晰的 `CONTRACT_DRIFT: 期望 5 页，实测 6 页 [新增: xxx]`，只需改一行 JSON 数据 |
| **4. 关键交互入口被删或核心契约属性丢失**（如打开轮盘的入口按钮 `[data-open-wheel]` 被误删，或折叠球点击不再展开） | **严禁静默放过，立即报 `F1_ELEMENT_MISSING` 或 `F4_NO_REACTION`** | 核心功能入口属于必测契约，缺失必须阻断并输出候选 DOM 列表 |

### 7.2 推荐在卡源码中植入的轻量自描述契约（Runtime Self-Manifest）

对于自有角色卡（如《神豪终端》），只需在运行时桥接对象（或构建产物元数据）上暴露一个极简的只读 `manifest()`（或由测试侧脚本从源码 `src/core/` 直接 import 常量表）：
- **从源码常量直接派生断言**：比如导航顺序、商城 14-11-5 商品数、12 款卡面代号，本来就定义在卡的源码常量（如 `src/core/wheel-ui-copy.js`、`src/core/wheel.js`）里！测试套件直接 `import` 卡的源码常量作为期望值（Single Source of Truth），而不是在测试脚本里手抄一遍魔术数字 `3`、`8`、`12`。卡源码改了商品数，测试期望自动同步，同时实机验证 UI 渲染出的 DOM 数量是否与源码常量严格相等。

### 7.3 数据驱动用例组织（只加 JSON/数据块，不改 Runner 代码）

将测试拆为**不变的执行引擎（`noapi-runner.mjs`）**与**声明式用例集（`suites/<card-or-feature>.suite.json`）**。当 rc.37 新增「星愿卡包三段流程、珍藏锁、商城分类」时，只往 `suite.json` 里追加声明式 case，不改一行 runner 代码：

```json
{
  "suite": "rc37-packs-and-bag",
  "preset": "three_cards",
  "presetPatch": {
    "wheel.starPoints": 800,
    "inventory.card_gold_1.cardCode": "c01",
    "inventory.card_gold_1.poolTier": "high",
    "inventory.card_gold_1.serialNo": 7,
    "inventory.card_gold_1.locked": false
  },
  "cases": [
    {
      "id": " folding-bar-56px",
      "desc": "底部停靠折叠条高度恒为 56px 且无滚动条",
      "steps": [
        { "op": "callBridge", "fn": "preferences", "args": [{ "displayDock": "bottom" }] },
        { "op": "click", "frame": "auto-mounted", "target": { "contract": "fold-close", "text": "收起|折叠" } }
      ],
      "asserts": [
        { "type": "geom", "frame": "auto-mounted", "selector": "body", "height": 56, "tolerance": 1, "noScrollY": true }
      ]
    },
    {
      "id": "card-lock-blocks-casino",
      "desc": "开启珍藏锁后该卡不可在赌场押注或兑换",
      "steps": [
        { "op": "click", "frame": "auto-mounted", "target": { "tab": "wheel" } },
        { "op": "click", "frame": "auto-mounted", "target": { "contract": "open-bag", "text": "背包|卡册" } },
        { "op": "click", "frame": "auto-mounted", "target": { "contract": "toggle-lock:card_gold_1" } }
      ],
      "asserts": [
        { "type": "state", "path": "inventory.card_gold_1.locked", "equals": true },
        { "type": "dom", "frame": "auto-mounted", "selector": "[data-item-id='card_gold_1'] [data-act='redeem']", "disabled": true }
      ]
    }
  ]
}
```

---

## 八、必须调 API 的那一份清单（明确出界判据）

本地零 API 测试覆盖面虽可达角色卡代码逻辑的 **90% 以上**，但以下 **6 类场景**一旦出现，必须明确判定为**出界（Out of Scope for Local Zero-API Test）**，移交姊妹 Skill `ego-tavern-card-test` 执行单轮真实生成验证：

| 编号 | 必须调 API 的场景 | 出界判据（满足任一即不可只靠零 API 结案） | 最低 API 消耗控制纪律 |
|---|---|---|---|
| **API-1** | **世界书协议 / `<UpdateVariable>` / `<JSONPatch>` 示例改动验收** | 本轮修改了 `protocol.txt`、`literary.json`、`state-context.txt` 中指导模型输出格式的文字或示例 | **只生成 1 轮**：在零 API 预置好的目标状态存档上直接发 1 句触发词，看模型输出与 MVU 落盘，严禁从开局向导重新花多轮跑 |
| **API-2** | **模型待办索引（如 `pendingBasicProfiles` / `pendingProfileFields`）触发与抄写率** | 验证模型看到 `_context` 里的待办提示后，是否会在当轮回复末尾主动写出对应的补全命令 | 预置一份含缺省字段的存档 → **真实生成 1 轮** → 查 `varsChanged` |
| **API-3** | **世界书关键词激活链与最终组装 Prompt 实测（含扩展注入顺序）** | 虽然 `CHAT_COMPLETION_PROMPT_READY (dryRun)` 可零 API 测静态组装，但涉及「生成前动态钩子脚本改写提示词 + 模型实际采纳度」时需实测 | 先用 dryRun 零 API 调通内容，最后 **1 轮真实生成**确认端到端 |
| **API-4** | **卡内独立子请求（`generateRaw`：如长期建档 `buildProfile`、一句话扩展 `expandContact`）的提示词回归** | 修改了 `generateRaw` 里的 `ordered_prompts` 系统提示词，需验证真实模型返回的 JSON 是否含全部 9 大段落且逐字包含锚定事实 | 预置未建档角色 → 点 1 次「生成档案」→ 取 `window.__CJ_BUILD_DEBUG__` 核验（**仅 1 次 API 调用**） |
| **API-5** | **真实流式生成期并发锁（`GENERATION_BUSY`）与中途停止（`#mes_stop`）** | 验证真实网络 SSE 流式吐字期间，玩家狂点小手机提现/抽奖/删楼是否被严密拦住且流结束后锁正常释放 | 在上述 API-1 的那 1 轮真实生成过程中，顺带执行一次生成期并发点击断言，**0 额外请求** |
| **API-6** | **正文文风、尺度阀门与人物语气验收** | 修改了文学描写规则、原型词库或尺度门槛，需由人或评审模型检验小说正文质量 | 归属模型能力测试或单轮实机验收 |

> **铁律联动**：即便是上述必须调 API 的场景，也**必须先用零 API 存档注入把前置状态一步到位准备好**（例如要测「好感 85 + 堕落 60 时的亲密回合协议输出」，先用零 API 注入该状态，再花 **1 次** API 发消息；绝不允许花 20 轮 API 从开局慢慢聊到 85 好感！）。

---

## 九、子智能体冒充模型（Subagent Mock LLM）：可行做法、四大具体代价与明确结论

委托方原话提及：*「甚至可以自己开一个子智能体，自己发消息，子智能体回复的这种做法，虽然我不是很推荐。」*
本节给出其技术实现路径，并严格论证为什么在常规测试中**得不偿失**。

### 9.1 技术上可行的两种做法

1. **做法 A（拦截 `fetch` / `generateRaw` 转发给本地子智能体或确定性回放器）**：
   - 在浏览器端重写 `window.fetch`（拦截 `/api/backends/chat-completions/generate`）和 `TavernHelper.generateRaw`；
   - 当酒馆发起生成时，拦截器提取组装好的 `messages`（含世界书与协议），写入本地交换文件 `.work/mock-llm-req.json`，唤醒一个后台子智能体（或本地脚本）按协议拼出一段假正文 + `<UpdateVariable>...</UpdateVariable>`，再伪造 HTTP 200 / SSE 流式响应喂回给酒馆前端。
2. **做法 B（免拦截，子智能体直接调用 `createChatMessages` 塞入合成 AI 楼层）**：
   - 不走酒馆发送按钮，由子智能体读当前状态 `_context`，自己写一段带 `<UpdateVariable>` 的 AI 回复文本，通过 `TavernHelper.createChatMessages([{ role: 'assistant', message: fakeReply }])` 插入末楼，并手动触发 `Mvu.parseMessage` 走完 `COMMAND_PARSED → settleNative → VARIABLE_UPDATE_ENDED` 结算链。

### 9.2 四条具体且致命的代价

| # | 具体代价 | 详细机理分析 |
|---|---|---|
| **代价 1** | **测不出真实模型的协议遵循盲区（假阳性 False Positive）** | 子智能体是由测试者看着源码和协议刚叮嘱出来的「作弊考生」，它会刻意写出完美符合 Zod schema 的 `<UpdateVariable>`；而真实玩家所用的各种模型（Claude / Gemini / DeepSeek）在长上下文下的漏字段、格式坍塌、引号未转义，子智能体完全复现不出来——**测过了也毫无参考价值**。 |
| **代价 2** | **子智能体本身同样消耗额度与时间，违背「零成本快速回归」初衷** | 无论是唤醒一个 agy 子智能体还是本地调另一个 LLM，读入几万字的酒馆组装 Prompt 再生成回复，不仅每次耗时 15~40 秒（比本地直接改状态慢 300 倍），而且消耗的是更昂贵的 Agent 会话配额，完全背离了「零 API 秒级回归」的目标。 |
| **代价 3** | **产出的非确定性楼层会污染后续断言基线（Baseline Drift）** | 自动化回归测试要求**输入确定 $\Rightarrow$ 输出确定**。子智能体每次即兴编造的剧情文本、随机增减的好感度与场记事件各不相同，会导致后续所有针对数值、指纹（`bodyFingerprint`）、资产列表的确定性断言全部失效。 |
| **代价 4** | **做法 B 绕过了酒馆真实的提示词组装管线，做法 A 则极易与酒馆流式状态机死锁** | 做法 B 直接塞楼层，根本没走酒馆的 `WORLD_INFO_ACTIVATED` 和 `CHAT_COMPLETION_PROMPT_READY`，世界书配错了也发现不了；做法 A 伪造酒馆各后端（OpenAI/Claude/酒馆中转）的 SSE chunk 格式极度脆弱，SillyTavern 稍微改一行流解析代码就会导致 `#mes_stop` 永远卡死。 |

### 9.3 明确结论

> **结论：明确不推荐开启子智能体冒充 LLM 回复。**
> - **唯一允许的替代形态（纯确定性契约夹具回放，零智能体）**：如果要测试卡内 **`settleNative` / `COMMAND_PARSED` 收到 `<UpdateVariable>` 后的本地解析与兜底逻辑**（例如：测试当模型只写了 `score: 95` 时，脚本的 `syncPrivateRecords` 会不会自动把 `virgin` 置为 `false` 并补齐 `unlockedTags`），应当使用**固定的静态测试夹具（Deterministic Fixture String）**直接喂给 MVU 解析器，10 毫秒内确定性跑完，**绝不开启子智能体现场写回复**。
> - **除非**：处于完全无外部 API 网路连接的离线封闭环境，且仅需录制一段端到端演示视频（Demo Walkthrough）供人工观看剧情与 UI 联动效果，才可临时启用做法 A。

---

## 十、Skill 落地结构（`zero-api-card-test` v2.0 完整蓝图）

对标 `ego-tavern-card-test` 的目录与模块化规范，将现有的单卡脚本升级为通用 Skill **`zero-api-card-test`**。施工方可直接按以下目录树、章节大纲与函数签名建档落地。

### 10.1 目录树

```
C:\Users\Administrator\.agents\skills\zero-api-card-test\
├── SKILL.md                           # 核心方法论、分流判据、5 阶段标准流、7 条铁律、F1-F7 故障速查
├── references\
│   ├── coverage-matrix.md             # 10 层本地测试能力矩阵与每层可执行断言规范
│   ├── state-seeding.md               # 4 路通用存档状态合成方法、隔离备份与 --restore 规范
│   ├── interaction-and-contracts.md   # L1-L3 元素定位、真实 Pointer 事件序列、跨 iframe 桥接与防漂移契约
│   ├── failure-taxonomy.md            # F1-F7 失败归因状态机与 8 项自动取证包 schema
│   └── suite-schema-and-report.md     # 声明式 suite.json 编写规范与零 API 验收报告模板
└── scripts\
    ├── noapi-lib.mjs                  # 通用零 API 核心库（安全守卫、零 API 哨兵、跨 frame 定位、真实点击、F1-F7 取证）
    ├── noapi-seed.mjs                 # 通用存档合成与还原器（Zod 反射 / InitVar / 克隆+Patch / 内存热注入 / --restore）
    ├── noapi-discover.mjs             # 角色卡运行时结构与 UI 地图自动探测器（输出 stateSlot + uiMap + 建议用例）
    └── noapi-run.mjs                  # 通用套件执行器（驱动通用烟雾遍历 + 声明式 suite.json + 产出证据与报告）
```

### 10.2 `SKILL.md` 章节目录大纲

1. **Frontmatter & 一句话定位**：在真实酒馆（8001）零模型 API 消耗地验证任意 SillyTavern 角色卡的功能、状态、交互、本地引擎结算与持久化。
2. **0. 开测前分流：因果输入源黄金判据**（零 API vs 调 API 的精确分界表 + 6 项永远出界清单）。
3. **1. 环境与安全铁律**（锁死 8001、严禁碰 8000、零 API 网络哨兵、独立 `__NOAPI_TEST_` 聊天与 `initKey`、`--restore` 清场）。
4. **2. 五阶段标准工作流**：
   - 阶段 1：静态体检（复用 `card-probe.mjs`）+ 组件生效关（复用/调用正规导卡，**不连 API**）；
   - 阶段 2：运行时槽位与 UI 地图自动探测（`noapi-discover.mjs`）；
   - 阶段 3：存档状态合成与注入（`noapi-seed.mjs`，四条路径按形态选配）；
   - 阶段 4：通用交互遍历 + 声明式功能套件执行（`noapi-run.mjs`）；
   - 阶段 5：F1–F7 自动归因取证、清场还原与验收报告生成。
5. **3. 五种卡形态（A–E）的零 API 专属测法**（含形态 B 向导无 API 提交拦截法、形态 C 合成楼层泄漏检测法）。
6. **4. 交互与断言纪律**（`dispatchRealTap` 全事件链、点击前三道预检闸门、整页截图 + DOM 几何数值量测）。
7. **5. F1–F7 失败归因速查表**（看 `evidence.json` 直接定责，禁止盲目写二次取证脚本）。
8. **6. 交付门禁**（断言清单逐条 PASS/FAIL + 证据/截图路径 + `apiCalls: 0` + 未验证项明示）。

### 10.3 `references/` 五份参考文档职责清单

| 文件名 | 一句话职责 |
|---|---|
| `references/coverage-matrix.md` | 穷举 L1–L10 十层本地可测能力点、对应的机器可执行断言谓词与正负向测试用例设计标准。 |
| `references/state-seeding.md` | 详解不知道卡 Schema 时的四条合法状态构造路径（Zod 反射、`[InitVar]` 解析、存档克隆+Patch、向导拦截/内存热注入）及 `manifest.json` 事务还原机制。 |
| `references/interaction-and-contracts.md` | 规定 L1(`data-test`) / L2(语义角色与文本) / L3(启发式 `discoverUiMap`) 三级定位器、跨 iframe `PointerEvent+MouseEvent` 全序列派发与版本防漂移规范。 |
| `references/failure-taxonomy.md` | 定义 F1–F7 七层故障归因判据流、每层强制落盘的 8 项自动取证数据结构（`evidence.json`）及典型故障破案指南。 |
| `references/suite-schema-and-report.md` | 定义数据驱动测试套件 `suite.json` 的动作原语（`ops`）、断言类型（`asserts`）JSON Schema，以及零 API 实机验收报告标准模板。 |

### 10.4 `scripts/` 四个核心脚本骨架（函数签名与调用顺序）

#### （1）`scripts/noapi-lib.mjs`（通用内核库）

```js
// 1. 安全与环境守卫
export const BASE_URL = "http://127.0.0.1:8001/";
export function assertSafePortAndPath(urlOrPath); // 非 8001 或含 8000/C:\jiuguan 立即 throw SAFETY_BLOCK

// 2. 零 API 哨兵（审计 + 可选硬阻断模式）
export async function installZeroApiSentinel(page, { block = true } = {});
// 拦截 window.fetch / XMLHttpRequest / TavernHelper.generateRaw / triggerSlash('/trigger')
// 命中生成端点立即记入 window.__NOAPI_VIOLATIONS__（含调用栈）；block=true 时直接 reject 阻断外发
export async function assertZeroApiViolations(page);

// 3. 运行时槽位与桥接嗅探
export async function detectCardBridges(page);
// 返回 { hasMvu, mvuRootKey, thVarsType, runtimeGlobalName, schemaGlobalName, mountedFrames, floorFrames }

// 4. 跨 iframe 递归解析与 L1->L2->L3 三级元素定位
export async function resolveFrame(page, frameSpec); // "top" | "auto-mounted" | {floor, index} | "#id"
export async function locateElement(page, frameSpec, targetSpec);
// targetSpec: { contract?, role?, text?, selector?, index? } -> 返回定位层级 (L1/L2/L3) 与元素句柄摘要

// 5. 点击前三道预检闸门 + 全序列真实事件派发 + 四维反应采样
export async function preActGate(page, frameSpec, targetSpec, { waitIdleMs = 5000, expectDisabled = false });
// 依次检验存在性(F1) -> 可见与无遮挡(F2) -> 非 disabled 且宿主 !busy(F3)
export async function uiAct(page, actionSpec);
// 支持 op: "tap" | "drag" | "fill" | "key" | "callBridge" | "injectFloor" | "mutateVars" | "reloadKeepChat"
// 内部执行 dispatchRealTap / dispatchRealDrag，采样 { deltaDom, deltaState, deltaMsg, deltaFeedback }

// 6. 多维可执行断言引擎
export async function runAssert(page, assertSpec);
// 支持 type: "state" | "dom" | "geom" | "noLeaks" | "handshake" | "persistence" | "perf" | "offlineFallback"

// 7. F1-F7 故障自动归因与 8 项证据包落盘
export async function classifyAndCaptureFailure(page, step, rawError, evidenceDir);
// 自动归类为 F1..F7，采集 DOM/Style/HitTest/BusyReasons/OpHistory/Toasts/VarsDiff/Shot 写入 evidence.json
```

#### （2）`scripts/noapi-seed.mjs`（通用存档合成与还原器）

```js
// CLI 入口：
//   node noapi-seed.mjs --char <角色目录> --strategy <schema|initvar|clone|intercept> [--preset <名>] [--patch <json>] [--out <seed.json>]
//   node noapi-seed.mjs --restore

export function reflectZodDefaults(zodSchema, overrides = {});   // 路径 A1：递归行走 Zod schema 自动补齐所有默认值
export function extractInitVarFromCard(cardPathOrWorldFile);     // 路径 A2：从世界书 [InitVar] 提取初始状态树
export function cloneAndPatchChat(sourceJsonlPath, rfc6902Patches, newInitKey); // 路径 B：克隆现有存档末楼并打最小 Patch
export function buildChatJsonl({ charName, bookName, stateRootKey, state, extraSwipeFloor });
export function writeIsolatedSeed({ charFolder, presetName, jsonlContent, targetFile }); // 写 __NOAPI_TEST_*.jsonl 并登记 manifest
export function restoreAllSeeds(); // 逆序回滚 manifest.json 中的全部 created/overwritten 记录
```

#### （3）`scripts/noapi-discover.mjs`（运行时结构与 UI 地图探测器）

```js
// 跑法：ego-browser nodejs -e "await import('file:///.../noapi-discover.mjs')"
// 调用顺序：
//   1. attachSpace / openTavern(8001) -> installZeroApiSentinel(page)
//   2. selectCharacterByAvatar(page, avatar) -> openCharacterChat(page, seedChatId)
//   3. bridges = await detectCardBridges(page)
//   4. 对每个 mountedFrame 和 floorFrame 执行 discoverUiMap(doc)
//   5. 输出 discovery-report.json（含发现的导航 Tab 列表、折叠触发器、子分类、表单控件、建议生成的 smoke suite）
```

#### （4）`scripts/noapi-run.mjs`（通用套件执行器）

```js
// 跑法：ego-browser nodejs -e "await import('file:///.../noapi-run.mjs')"
// 调用顺序：
//   1. 读取 suite.json（若未指定 suite，则自动运行 built-in 通用烟雾套件：组件关卡 -> 挂载检测 -> 折叠展开 -> 全 Tab 遍历 -> 零泄漏检查 -> 刷新回读）
//   2. 调用 noapi-seed.mjs 准备隔离测试存档（校验 mtimeMs 新鲜度与唯一 initKey）
//   3. 打开 8001（不连 API）-> 装 installZeroApiSentinel(page, { block: true }) -> 选卡 -> 进预置聊天
//   4. 循环执行 suite.cases[]：
//        a. 若 case 含 presetPatch，走路径 D (replaceMvuData) 热更新状态或切预置聊天
//        b. 逐步执行 case.steps[] -> 调用 preActGate + uiAct
//        c. 逐步执行 case.asserts[] -> 调用 runAssert
//        d. 任一步失败 -> 触发 classifyAndCaptureFailure(F1..F7) 落盘完整证据包
//   5. 执行 assertZeroApiViolations(page) 确认 apiCalls === 0
//   6. 输出结构化 JSON 结果与 Markdown 验收报告，按参数执行 --restore 清场
```

---

## 十一、实施顺序与风险控制（分步落地与防误伤规范）

为确保落地过程零事故、可增量验证，并在样本卡《神豪终端 `2.0.0-rc.37`》上立即解决现有卡点、补齐 9 类缺失覆盖，分为 **4 步**实施：

### 步骤总览表

| 步骤 | 交付物 | 验证方式（如何证明这一步成了） | 是否触碰 8001 实例 / 玩家目录 |
|---|---|---|---|
| **Step 1：先建 F1–F7 取证与真实交互内核 (`noapi-lib.mjs`) + 当场破案 rc.37 轮盘 GO 卡点** | `noapi-lib.mjs`（含 `preActGate`、`dispatchRealTap`、`classifyAndCaptureFailure`、零 API 哨兵） | 在 8001 上对 `神豪终端5.png` (rc.37) 运行单步轮盘 GO 诊断：无需人工猜，直接由 F3/F5 证据包给出确定性结论并跑通抽奖落盘 | **触碰 8001**（只读选卡 + 读 `__NOAPI_TEST_` 聊天，不碰 8000） |
| **Step 2：升级 Schema 反射通用预置器 (`noapi-seed.mjs`)** | `noapi-seed.mjs`（通过 `schemas.state` 自动补齐 `inventory` 新增字段 + 4 路状态合成 + `--restore`） | 运行 `node noapi-seed.mjs` 生成 5 套预置 + rc.37 卡包预置，断言生成的 `inventory` 条目自动带齐 `cardCode/poolTier/serialNo/locked` 且 `schemas.state.parse` 100% 通过；测 `--restore` 后目录净空 | **触碰 8001 `chats/<测试角色>/`**（仅写 `__NOAPI_TEST_*.jsonl`） |
| **Step 3：落地 UI 自动探测器 (`noapi-discover.mjs`) 与数据驱动执行器 (`noapi-run.mjs`)** | `noapi-discover.mjs`、`noapi-run.mjs`、样本卡声明式套件 `suites/shenghao-rc37.suite.json` | ① 不给任何类名配置跑 `noapi-discover.mjs`，确认自动扫出小手机 5 个 Tab、轮盘入口、卡册/商城子 Tab；<br>② 跑 `shenghao-rc37.suite.json`，一次性覆盖 rc.37 全部新增点（星愿卡包两池与三段启封、12 款卡面与编号、珍藏锁、图鉴 `N/12`、商城 `14/11/5`、玩法券排期与取消、奇物生效、折叠条 `56px`、叉号居中），断言全绿且 `apiCalls === 0` | **触碰 8001** |
| **Step 4：封装为全局通用 Skill (`zero-api-card-test` v2.0)** | 更新 `C:\Users\Administrator\.agents\skills\zero-api-card-test\SKILL.md`、`references/*.md`、`scripts/*.mjs`，更新项目 `HANDOFF.md` | 用一张**非《神豪终端》形态**的卡（或构造形态 A/C 最小样本卡）跑通用烟雾套件，验证零代码修改直接通过 | 仅写 Skill 目录与 8001 测试聊天 |

### 风险控制与防误伤硬措施

1. **8000 玩家日常实例物理级隔离**：
   - 所有脚本顶部第一行执行 `assertSafePortAndPath()`：硬编码校验 `new URL(BASE_URL).port === '8001'`，文件读写路径必须以 `E:\Ajiuguanagentceshi\SillyTavern\data\default-user\chats\` 或项目 `.work\` 开头；凡字符串中匹配 `/8000|C:[/\\]jiuguan/i`，立即抛出 `SAFETY_BLOCK` 并终止进程。
2. **零 API 双重保险（不仅审计，而且默认硬阻断）**：
   - 现有脚本只记 `window.__NOAPI_VIOLATIONS__.push(url)` 但仍放行 `of(...a)`，这意味着一旦误点还是会真花钱！
   - 新方案 `installZeroApiSentinel(page, { block: true })` 在拦截到生成路由、`/trigger` 斜杠命令或 `TavernHelper.generateRaw` 时，**不仅记录违规调用栈，而且立即返回 `Promise.reject(new Error('ZERO_API_SENTINEL_BLOCKED'))`**，从物理上保证哪怕测试脚本点错了按钮，也**绝不可能发出任何一个消耗额度的网络包**。
3. **测试存档与浏览器 `localStorage` 双清场**：
   - 每次预置强制使用 `__NOAPI_TEST_` 文件名前缀与 `noapi_<preset>_<timestamp>` 独立 `initKey`；
   - `--restore` 不仅按 `manifest.json` 清理 `.jsonl` 文件，同时可在浏览器端一键清理 `localStorage` 中带有 `test:noapi` 分支标记的缓存键，确保 8001 实例不留任何垃圾状态。
4. **ego Space 控制权礼让**：
   - 复用 `attachSpace()` 铁律：若检测到当前 space `ownership === "user"`，立即停手询问，绝不抢夺用户正在手动操作的浏览器窗口。
