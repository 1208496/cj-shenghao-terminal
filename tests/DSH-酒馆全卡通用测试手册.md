# DSH 必读 · 酒馆全卡通用测试手册（2026-11-17 YG 定）

> **目标**：让你（DSH）真正**会用 SillyTavern（酒馆）**，碰到**任何一张角色卡**——不管是纯文字卡、多开场白卡、每楼底部带固定状态栏的卡、带开局表单前端的卡、还是挂悬浮小手机/MVU 变量的复杂卡——都能自己先摸清底细，再用统一的方法测穿它，绝不再死背某一张卡的 DOM 选择器。

---

## 〇、核心心法：拿到任何卡，先做「静态体检」，再按「模块表」测

以前你只会照抄《神豪终端》的脚本，换一张没有 `#TH-message--0--0` 或没有 `#cj-shenghao-phone-frame` 的卡你就懵了。
**真正的酒馆测试员只按三步走：**

1. **第一步：跑 `card-probe.mjs` 拆包体检（不用开浏览器，1 秒出结果）**
   拿到 `.png` 或 `.json` 卡，先看它肚子里装了什么：有几个开场白？有没有内嵌世界书？有没有正则？正则是改显示的（比如固定状态栏）还是改提示词的？有没有酒馆助手（TavernHelper）脚本？用没用 MVU 变量？有没有外网链接？
2. **第二步：跑 `ego-st-setup.mjs` 在酒馆里正规导卡并过「组件生效关」**
   卡里带了世界书，地球图标 `#world_button` 就必须亮（含 `world_set` 类）；卡里带了局部正则，就必须被允许；卡里带了酒馆助手脚本，`iframe[id^="TH-script--"]` 就必须跑起来。**卡里带了但酒馆里没生效 = 还没开始测就已经挂了**。
3. **第三步：看 `survey`（全面观察）结果，用 `ego-st-act.mjs` 按模块逐项验证**
   每个动作跑完，脚本都会自动给你吐出 `survey` 报告：当前几楼、每楼渲染出了什么文字/HTML/iframe、iframe 里有哪些按钮和输入框、页面上新挂了什么悬浮窗/状态栏、世界书刚触发了哪几条、最终发给模型的 Prompt 有没有漏掉的标签、变量哪几个字段变了。**你看着 `survey` 报告决定下一步点什么、发什么。**

---

## 一、全卡通用工具箱（4 个文件）

| 脚本路径 | 用途 | 什么时候跑 |
| --- | --- | --- |
| `E:\SHZDCHOSSS\scripts\card-probe.mjs` | **角色卡静态体检**（纯 Node，直接拆解 `.png` / `.json`） | 拿到任何新卡的第 0 步 |
| `E:\SHZDCHOSSS\scripts\ego-st-setup.mjs` | **通用建档与开卡**：开 space → 打开 8001 → 连 API → 记空页面基线 → 挂探针 → 在酒馆里导卡 → 认弹窗 → 校验卡组件全部生效 → 第一次 `survey` | 开始测一张卡的第 1 步 |
| `E:\SHZDCHOSSS\scripts\ego-st-act.mjs` | **通用动作执行器**：读 `action.json` 执行动作（发消息 / 点控件 / 填表 / 重新生成 / 继续 / 左右滑 / 新聊天 / 删楼 / 刷新），自动跑 `survey` + 截图 | 后续每一步交互与测试 |
| `E:\SHZDCHOSSS\scripts\ego-st-lib.mjs` | 上面两个脚本共用的酒馆操作底层库 | 不用直接跑 |

运行时目录统一在 `C:\Users\Administrator\ego\st-run\`：
- `config.json`：当前测哪张卡、有哪些额外弹窗规则、Prompt 里必须有/不准有什么词
- `action.json`：下一步要让 `ego-st-act.mjs` 执行的动作（单个对象或数组）
- `state.json`：自动保存的 `spaceId`、卡的 `avatar` 文件名、空页面 DOM 基线
- `vars-last.json` / `prompt-last.txt` / `shots/*.png`：每次动作自动落盘的变量快照、最新发送给模型的完整 Prompt、截图

---

## 二、常见角色卡的 5 种形态与判断方法（重中之重！）

不要再假设每张卡都有「开局向导」或「小手机」！跑完 `card-probe.mjs` 和 `ego-st-setup.mjs` 后，对照下表识别你手里的卡属于哪一种（一张卡可以同时占好几种）：

### 形态 A：无开局前端卡（最常见，占酒馆卡 80% 以上）
- **特征**：0 楼（开场白）就是一段剧情正文，或者带几个多选开场白（`alternate_greetings`），**没有表单、没有「开始我的人生」按钮**。
- **`survey` 表现**：`floors[0].iframes` 为空（或者只有纯展示的美化框，里面的 `controls` 没有表单输入框）。
- **怎么开局**：
  1. 如果 `greetings > 1`（多开场白），先在 0 楼测 `{"op": "swipe", "dir": "right"}` 和 `"left"`，确认每个开场白都能正常切换渲染。
  2. **不需要点任何开局按钮！直接在输入框发第一句玩家回复**（`{"op": "send", "text": "..."}`），生成出来的第 2 楼（`mesid=2`）就是 AI 的第一轮正文。

### 形态 B：带开局前端 / 建档向导卡（如《神豪终端》《一掷千金》）
- **特征**：0 楼是一个交互式 HTML/iframe 向导（选身份、加点、填名字），填完点提交按钮才会由脚本自动发出第 1 楼玩家设定并触发 AI 回复。
- **`survey` 表现**：`floors[0].iframes` 里有 iframe（例如 `#TH-message--0--0`），且 `inner.controls` 列出了 `input#...`、`button 下一步`、`button 开始...` 等控件。
- **怎么开局**：
  1. 看 `survey` 里 `floors[0].iframes[0].inner.controls` 列出的控件 ID 和按钮文字——**不要盲猜 ID，直接抄 `survey` 扫出来的！**
  2. 用 `action.json` 的 `fill` 和 `click` 走完向导，最后一步提交按钮加上 `"waitGen": true`，脚本就会自动等 AI 把第一轮正文生成完。

### 形态 C：逐楼固定状态栏卡（每条 AI 回复底部/顶部都有状态栏）
- **特征**：没有悬浮在屏幕角落的小手机，而是靠**卡内正则（`placement: AI输出` + `只改显示`）**或**世界书要求 AI 每次末尾输出 `<status>...</status>` / 代码块**，渲染在每一楼 `.mes_text` 里面（可能是折叠框 `<details>`、HTML `<div>/<table>`，也可能是每楼一个 `#TH-message--N--0` iframe）。
- **`survey` 表现**：AI 回复楼层（`floors` 里 `who === "AI"`）的 `htmlBlocks > 0` 或 `iframes.length > 0`，并且 `leaks` 为空。
- **怎么测**：
  1. **渲染检查**：每生成一轮 AI 回复，看最新一楼的 `htmlBlocks` 或 `iframes` 是否存在、里面有没有状态数值（时间、地点、好感度、生命值等）。
  2. **泄漏检查（极常见 Bug）**：看 `floors.at(-1).leaks`！如果正文里直接露出了 `<UpdateVariable>`、`</status>`、`{{getvar::...}}`、`[object Object]`、`NaN`，说明正则没匹配上或模型输出格式歪了。
  3. **提示词污染检查**：状态栏的美化 HTML 绝不该塞回给模型的上下文里（会烧光 token）。看 `prompt-last.txt` 里历史楼层是不是干净的文本（卡一般会配一条 `promptOnly` 正则把状态块从提示词里剥掉）。

### 形态 D：全局固定 / 悬浮界面卡（小手机、顶栏 HUD、侧边面板，如《神豪终端》《恶灵寄生》）
- **特征**：由酒馆助手脚本往 `document.body` 或 `#sheld` 上挂载一个 `position: fixed / absolute` 的浮层或 iframe，独立于聊天楼层存在。
- **`survey` 表现**：`mounted` 数组非空！会列出相对于空酒馆新增的 DOM 节点（`el`、坐标 `rect`、是否在视口内 `inViewport`、内部文字 `inner`）。
- **怎么测**：
  1. 看 `mounted` 里有没有它、宽高是不是正常（不能是 0×0）。
  2. 用 `{"op": "click", "frame": "浮层iframe选择器（若是iframe）", "text": "Tab文字"}` 点开各个 Tab，验证切换不报错、数值和正文一致。
  3. **截图防裁切**：如果 `mounted` 显示它在屏幕最右边或有 `transform: scale(...)`，截图前先用 `evaluate` 临时把它移到 `(left:20px, top:70px, transform:none)` 截完再还原，还要调 `closeDrawers` 把左右抽屉收起，免得被角色面板挡住。

### 形态 E：MVU / 酒馆助手变量卡（数值驱动型）
- **特征**：`card-probe.mjs` 显示 `MVU变量: true` 或脚本里调了 `getVariables / updateVariablesWith`，世界书里有 `[InitVar]` 或 `[mvu_update]`。
- **`survey` 表现**：每次动作后 `varsKeys > 0`，且一轮对话后 `varsChanged` 会自动列出「哪个字段从什么变成了什么」。
- **怎么测**：
  1. **初始化**：开卡或首轮后，`vars-last.json` 里必须有完整初始结构，不能是空的。
  2. **增量更新**：发一句明确会触发数值变化的行动（比如花钱、送礼、战斗、亲密互动），看 `varsChanged` 里对应字段有没有按规则变。
  3. **回滚/重生成一致性**：点 `regenerate` 或 `deleteLast` 删掉最新一轮后，变量应该退回上一楼的状态，不能无限叠加。

---

## 三、全卡通用测试流程（SOP：从 M0 到 M11）

不管测什么卡，严格按下面顺序走。**M0、M1 是所有卡必测；M2–M11 根据 `card-probe.mjs` 打印出的「应测模块」按需执行。**

### 阶段 1：静态体检（0 浏览器开销）
```powershell
node E:/SHZDCHOSSS/scripts/card-probe.mjs "<卡的路径.png或.json>" --out C:/Users/Administrator/ego/st-run/probe.json
```
读输出的「特征」和「应测模块」，心里有数后再写 `C:\Users\Administrator\ego\st-run\config.json`：
```json
{
  "name": "被测卡名字",
  "card": "E:/路径/被测卡.json",
  "extraPopupRules": [],
  "promptMustContain": [],
  "promptMustNotContain": ["<UpdateVariable>", "<%"]
}
```

### 阶段 2：正规导卡与组件生效关（`ego-st-setup.mjs`）
```powershell
ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-st-setup.mjs')"
```
- 脚本会自动：开新 space → 打开 `127.0.0.1:8001` → 连 API → 记空页面基线 → 装探针 → **在酒馆界面里导入卡** → 点掉「导入标签 / 内嵌世界书 / 内置正则 / 嵌入式脚本」弹窗 → 检查世界书/正则/脚本是否全部生效（世界书没绑上会自动走「更多... → 导入角色卡的世界书」补救）→ 输出首次 `survey`。
- **如果报 `遇到不认识的弹窗`**：看报错里打印出来的弹窗原文和按钮列表，如果确实是这张卡自带的合理弹窗，把规则加进 `config.json` 的 `extraPopupRules` 再跑；拿不准就停下问用户。

### 阶段 3：按模块执行测试（改 `action.json` → 跑 `ego-st-act.mjs`）

命令永远只有一条：
```powershell
ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-st-act.mjs')"
```

| 模块 | 什么时候测 | 具体怎么测（写进 `action.json`） | 合格判据（看 `survey` 输出） |
| --- | --- | --- | --- |
| **M0 基础开局与对话** | **所有卡必测** | • 形态 A（无开局前端）：直接 `{"op":"send","text":"（贴合卡设定的第一句话）"}`<br>• 形态 B（有开局前端）：按首次 `survey` 扫出的控件，用 `fill` + `click(..., "waitGen":true)` 提交开局，再发 1–2 轮日常对话 | `chat.lastIsUser === false`；AI 回复非空、人设/文风符合卡面；`errors` 无致命报错；`floors.at(-1).leaks` 无未闭合标签/宏泄漏 |
| **M1 酒馆基本操作回归** | **所有卡必测** | 依次测试酒馆核心操作：<br>1. **重新生成**：`{"op":"regenerate"}`<br>2. **继续生成**：`{"op":"continue"}`<br>3. **左右滑动切换回复**：`{"op":"swipe","dir":"left"}` 再 `"right"`<br>4. **刷新网页持久化**：`{"op":"reload"}` | 1. 重新生成后楼层数不变、`swipes` 计数 +1、状态栏/变量随之刷新且不重复叠加<br>2. 继续生成能在原回复后追加正文<br>3. 左右滑能切换不同 swipe，界面不崩<br>4. 刷新网页后聊天记录、变量、状态栏、悬浮窗全部都在 |
| **M2 多开场白切换** | `greetings > 1` | 先 `{"op":"newChat"}` 回到只有 0 楼的状态，然后连续 `{"op":"swipe","dir":"right"}` 遍历每一个开场白 | 每个开场白都能正常显示，里面的 HTML/正则/iframe 不报错、不漏源码 |
| **M3 世界书触发** | 有世界书 | 1. 看 `probe.json` 里常驻条目的名字和关键词条目的关键词<br>2. 发一句包含某个关键词的消息 `{"op":"send","text":"...关键词..."}` | `survey.wiLast.entries` 里能看到常驻条目 + 刚才被关键词命中的条目；`prompt-last.txt` 里确实包含了世界书内容 |
| **M4 正则（显示与提示词双侧）** | `regex > 0` | 生成一轮回复后，对比 `survey.floors.at(-1)`（显示侧）和 `C:\Users\Administrator\ego\st-run\prompt-last.txt`（提示词侧） | • `只改显示` 的正则：页面上渲染成了美化框/折叠框，且原标签不再裸露<br>• `只改提示词` 的正则：上一轮的 `<UpdateVariable>` 等指令块已从 `prompt-last.txt` 的历史消息里剥除，没有污染上下文 |
| **M5 酒馆助手脚本** | `thScripts > 0` | 看 `setup` 时的 `thScriptIframes` 数量，以及每轮对话后的 `survey.errors` 和 `survey.toasts` | 所有启用的脚本都已加载；没有 `Uncaught Error` 或红字错误 Toast |
| **M6 开场前端向导** | 有开场前端 | 根据 `floors[0].iframes[0].inner.controls` 列出的控件：测必填项校验、预设档位切换、自定义输入、最终提交 | 提交后能正常发出开局消息并触发 AI 首轮回复，玩家填的姓名/属性准确写进了正文和变量里 |
| **M7 逐楼固定状态栏** | 有逐楼状态栏 | 连续聊 2–3 轮（涵盖时间推进、地点移动、好感/数值变化），每轮看最新一楼的 `htmlBlocks` / `iframes` | 每一楼 AI 回复都稳定渲染出状态栏（没有哪一楼断掉变成纯文本）；状态栏里的数值随剧情真实变化 |
| **M8 全局悬浮窗/小手机** | `mounted` 非空 | 用 `click` 点开浮层里的各个面板/Tab/按钮，触发至少一次浮层内的交互动作 | 浮层可展开可收起；各 Tab 切换正常；显示的数据与当前楼层变量完全一致 |
| **M9 MVU / 变量系统** | 有变量系统 | 1. 测一轮「不该触发奖励/变动」的纯寒暄<br>2. 测一轮「明确触发数值变动」的行动<br>3. 测 `deleteLast` 删楼后重发 | 看 `survey.varsChanged`：纯寒暄不乱加分；关键行动准确修改对应字段且数值在合理范围内；删楼重发不产生脏数据残留 |
| **M10 EJS 提示词模板** | `ejsTemplates > 0` | 发一轮消息后检查 `prompt-last.txt` | `prompt-last.txt` 里绝不能出现 `<%` 或 `%>` 原文，条件分支已按当前变量正确展开 |
| **M11 外网资源依赖** | `urls.length > 0` | 看 `probe.json` 里的 `urls` 列表（字体、背景图、音频、外部 JS 模块） | 在报告里列出所有外网 URL，注明在 ego 浏览器里哪些能通、哪些 `Failed to fetch`，是否阻塞核心玩法 |

---

## 四、酒馆常用界面与底层 API 速查表（真正懂酒馆）

当你需要排查问题或写自定义动作时，查这张表，**不准盲猜选择器**：

### 1. 顶栏抽屉（点击图标展开/收起，打开时 `.drawer-content` 带 `openDrawer` 类）
| 图标 ID | 内容面板 ID | 是干什么的 |
| --- | --- | --- |
| `#ai-config-button` (`#leftNavDrawerIcon`) | `#left-nav-panel` | AI 预设参数（温度、最大回复长度、预设切换） |
| `#sys-settings-button` (`#API-status-top`) | `#rm_api_block` | **API 连接配置**（看插头是否有 `fa-plug` 且无 `exclamation`；点里面可见文字为「连接」的按钮，**别点 `#api_button`**） |
| `#AdvancedFormatting` 抽屉图标 | `#AdvancedFormatting` | 高级格式化（系统提示词、上下文模板、指导模式） |
| `#WIDrawerIcon` | `#WorldInfo` | **全局世界书面板**（导入角色世界书后它会自动展开，记得用 `closeDrawers` 收起，否则挡画面） |
| `#user-settings-button` | `#user-settings-block` | 用户设置（UI 主题、强力用户选项、`world_import_dialog` 等） |
| `#backgrounds-button` | `#bg_menu_content` | 聊天背景图 |
| `#extensions-settings-button` | `#rm_extensions_block` | **扩展管理**（正则 Regex、酒馆助手、小白盒 LittleWhiteBox、ST-Prompt-Template 等都在这里） |
| `#persona-management-button` | `#persona-management-block` | 玩家人设（Persona）管理 |
| `#rightNavDrawerIcon` | `#right-nav-panel` | **角色管理面板**（导卡 `#character_import_file`、角色列表 `#rm_print_characters_block .character_select`、地球按钮 `#world_button`、「更多...」下拉框 `#char-management-dropdown`） |

### 2. 聊天区与左下角 `☰` 菜单（`#options_button`）
| 选择器 | 用途 | 注意事项 |
| --- | --- | --- |
| `#send_textarea` / `#send_but` | 输入框 / 发送按钮 | `#send_but` 有时尺寸是 0×0，必须用原生 value setter + `input` 事件 + JS `click()`（已封装进 `sendText`） |
| `#mes_stop` | 停止生成按钮 | 判断是否正在生成：**必须看 `getComputedStyle(#mes_stop).display !== "none"`**，绝不能看 `.displayNone` 类！ |
| `#option_start_new_chat` | 开始新聊天 | 点击后会弹确认框，必须调 `handlePopups` 点掉 |
| `#option_select_chat` | 管理/切换当前角色的历史聊天存档 | 弹窗里列出所有聊天记录 |
| `#option_regenerate` | **重新生成**最后一楼 AI 回复 | 已经开过局/发过消息但没回或回错了，一律点它，**不准重填开局表** |
| `#option_continue` | **继续**（让 AI 接着最后一楼往下写） | — |
| `#option_impersonate` | 帮玩家代写一句话 | — |
| `#option_delete_mes` | 进入删除消息模式 | 脚本里直接调斜杠命令 `/del N` 更稳（已封装为 `deleteLast`） |
| `#chat .last_mes .swipe_left` / `.swipe_right` | 左右滑动切换同一楼的不同生成结果（0 楼则是切不同开场白） | — |

### 3. 浏览器控制台里的官方上下文 `window.SillyTavern.getContext()`
- `ctx.characters[ctx.characterId]`：当前角色卡完整对象（`name`、`avatar`、`data.extensions.world`、`data.character_book`、`data.extensions.regex_scripts`、`data.extensions.tavern_helper`）
- `ctx.chat`：当前聊天数组，每项 `{ name, is_user, is_system, mes, swipes, swipe_id, extra }`
- `ctx.chatId`：当前聊天存档名
- `ctx.reloadCurrentChat()`：重新渲染当前聊天（当刚启用正则或脚本、画面还没刷新时非常管用）
- `ctx.executeSlashCommandsWithOptions(cmd)`：直接执行任何酒馆斜杠命令（如 `/del 1`、`/send ...`、`/trigger`、`/getvar`、`/setvar`）
- `window.TavernHelper`：酒馆助手全局 API（`getVariables({type:"message"|"chat"|"character"|"global"})`、`insertOrAssignVariables` 等）
- `window.Mvu`：MVU 变量框架全局对象（用到了 MVU 的卡才会有，`Mvu.getMvuData({type:"message", message_id})`）

---

## 五、通用测试报告模板（测完任何卡都按这个写 `reports/<卡名>-测试报告.md`）

1. **角色卡画像（来自 `card-probe.mjs`）**：卡名、版本、形态分类（A/B/C/D/E 哪几类）、开场白数、世界书条数、正则条数、脚本个数、外网依赖。
2. **组件生效关结果（来自 `ego-st-setup.mjs`）**：导入弹窗处理情况、世界书是否绑定（`globeLit`）、局部正则是否启用、酒馆助手脚本 iframe 起了几个。
3. **分模块实测结果表（M0–M11）**：每个跑过的模块写清「做了什么动作 → 期望什么 → 实测看到什么（贴 `survey` 关键字段和截图名）→ PASS / FAIL」。
4. **发现的问题分类（极其重要，不要混为一谈！）**：
   - **卡本身的代码/配置 Bug**（如正则写错漏出标签、脚本报错、世界书条目没设关键词也没开常驻导致永远不触发）
   - **模型执行协议缺口**（如世界书要求模型写某个字段或状态栏格式，但模型漏写了）
   - **环境/网络问题**（如卡引用的某个外网 CDN 在当前网络拉不到）
5. **证据清单**：对应截图路径、`vars-*.json` 变量快照、`prompt-last.txt` 检查结论。
