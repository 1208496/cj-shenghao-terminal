# 交接文档 · 神豪终端（现行唯一权威 · 保持 ≤240 行）

> 本文件由 YG 于 2026-11-17 指定为《神豪终端》角色卡项目**唯一现行交接载体**。
> GPT 时代的 `PROJECT_STATE.md` 已归档为 `docs/legacy/PROJECT_STATE_gpt-legacy.md`，只作历史参考。
> 旧版本细节不进本文件：rc.24–rc.37 的施工与实机记录整块迁到
> `E:\AGY_ARCHIVE\SHZD_HISTORY\HANDOFF_rc24_to_rc37_archive.md`（1,347 行）。
> 本文件记录事实，不构成新规则，也不扩大任何授权。未知写「未确认」，没跑过的写「未验证」。

## 【永久铁律】变量与提示词（2026-11-17 YG 采纳，永久有效）

> 1. **脚本兜底律**：能由脚本按日期、分数、次数确定性推算或兜底的字段，绝不干等大模型手写。
> 2. **示例驱动律**：必须由大模型生成文本的字段，必须给「当轮触发条件 + 顶层待办索引 + 协议末尾 `<JSONPatch>` 完整抄写示例」。
> 3. **文案逐字照抄律**：世界书 / 协议 / 状态说明 / 开场白及所有玩家可见文案，必须 100% 逐字复制方案定稿。
> 4. **照抄原型律**（2026-11-22，见项目级 `AGENTS.md` §4–§6）：凡角色卡项目，执行者必须百分百照抄 agy 给出的方案与原型——DOM、类名、CSS 数值、SVG 路径、文案、字段、交互逐字逐值搬运；发现问题先报告并获 YG 同意才可改。

---

## 0. 当前状态（2026-11-24 03:1x 更新；**rc.56 已正式发行**，电脑版 + 手机版双形态产出）

| 项 | 值 |
|---|---|
| 源码版本 | **`2.0.0-rc.56`（正式发行版）** / `cardContractRevision 33` |
| 工作树 | **干净**，HEAD=`a716b42`，已在 origin/release |
| 线上更新指针 | **`e5c00bf` / rc.56**（2026-11-24 01:3x 已切并回读校验）；回滚点 `528c6ae` / rc.55 |
| 玩家发行状态 | **已发行**（2026-11-24，YG 明确指示「确认为已向玩家发行、已为正式版本」）—— 自此改字段须考虑旧存档兼容，见 `AGENTS.md` §2.3 |
| 单测 | `npm test` **529 / 529**（rc.55 新增 28 条） |
| 构建 | `npm run build` → **BUILD_OK** + `npm run check` → **CHECK_OK**（fallbackRef 已抬到 `34a4b48`） |
| 整卡（双版本） | **电脑版**＝`dist/2.0.0-rc.56/神豪终端-rc56-电脑版.png`（3.16 MB，热更新，指针 `e5c00bf`）｜**手机版**＝`dist/2.0.0-rc.56-checkpoint/神豪终端-rc56-手机版.png`（9.19 MB，内联）。卡面源图 `assets/card-face-rc56.png`（480×720，已入库） |
| 零 API | RC53+53b 四条 `rc53.*` ✔；**rc54 私域三装置 7/7 ✔（76 断言，`apiCalls: 0`，连跑两遍同结果）**（`.work/noapi/suite-result-1795439871427.json`）；rc50.toylink-stack-color / scroll-keep 仍待重校 |

### 0.998 玩家实测：开局「登记资产」被整单校验挡住（2026-11-24 03:1x–03:4x；**YG 选 A，已修，未提交**）

- 现象「登记资产显示请检查年龄、好感及金额，写什么都无效」→ **根因**：`app.js` 的 `save-asset` 用 `validateDraft(next)` 校验**整份开局草稿**，草稿里年龄 18–80 / 身高 140–230 / 体重 35–200 / 鞋码 34–52 任一项越界即必失败；`setup-required.js` 第 01 步只要求年龄 ≥1，故 17 / 90 能过闸，问题被推迟到第 02 步才爆，提示不点名不聚焦。
- **已修（A：早拦 + 定位，文案零新增）**：`setup-required.js` 新增 `SETUP_INTEGER_RANGES` + `blameIntegerField(draft)`（口径同 engine）；`app.js` 在 `next` / `save-asset` / `save-contact` 校验前先点名、`collect()` 两处抛错带字段、`catch` 里关弹窗 + 跳回该字段所在步骤 + 聚焦滚动。颜值/性能力**不进**范围表（越界时 collect 当场拦，且渲染 `beautyTier` 会抛错，试过已回退，留单测锁住）。
- 验证：`npm test` **534 / 534**（新增 `tests/rc56-setup-range.test.mjs` 5 条，含边界与 engine 的对照矩阵）；rc.56 产物上实测——旧草稿身高 1.75 点登记：修前弹窗不关、光标停弹窗，修后**弹窗关闭 + 跳回 01 步 + 光标 `f_heightCm`**；年龄 17/90、身高 1.75、体重 300、鞋码 60、颜值 150 五项在第 01 步当场点名；正路 01→02→登记→03→预览全通。diff `.work/diff-rc56-setup-range.patch`，脚本 `.work/repro/ego-round{1..8}.mjs`，报告 `reports/rc56-登记资产报错诊断-20261124.md`。
- **rc56-formA（开局表单限制可见/越界输入/预设补齐）已按 4N 方案实施完毕**：新增 `opening-copy.generated.js`（脚本抠取的 50 条说明 + 42 条错误文案）、`setup-required.js` 规则与校验层、`setup-options.js` 性别分档下拉、四预设身体数据、`field()` 重写与 CSS 块；`npm test` **548/548**；**补：颜值/性能力数字框改 text 后 `.beauty-inputs input[type=number]` 宽度规则失效、滑块被挤成小点，已改成 `[type=number],[type=text]` 并复测；**同批还漏了滑块→数字框的 `input` 监听（拖滑块不回写），已补 `slider.addEventListener` 并验证双向（拖 80→数字 80、键入 95→滑块 95、草稿同步）**（滑轨 209px / 数字框 78px，截图 `.work/shots/rc56-formA/05-beauty-slider-fixed.jpg`）**；AC-01~AC-17 在 rc.56-checkpoint 产物上全过（截图 `.work/shots/rc56-formA/`）；3 处方案未覆盖的偏离已获 YG 批准（2026-11-24「可以啊，就按A保留吧」），清单 132 条全回填（MATCH 125 / APPROVED 7）、自检 9/9 PASS（`.work/selfcheck-rc56-formA.md`）；**rc56b 阶段 1（称呼动态化＋多人同场心声覆盖）已实施**：`PLAYER_SET_ADDRESSING`、`_context.presentThoughtIds`、`asciiIdFor` 中文名路径纠偏、`ROUND_FIELD_AUDIT` 审计、过渡 `injectPrompts` 补丁、详情页「改称呼」与「调试观察」开关（文案脚本抠取）；`npm test` **556/556**；清单 `.work/checklist-rc56b.md`（MATCH 28/APPROVED 13）、自检 9/9、报告 `reports/rc56b-交付-20261124.md`；**阶段 2 世界书定稿待发版**；R-1/R-2 结论改用 YG 真机存档复核（`神豪终端 - 2026-11-24@04h27m30s631ms.jsonl`）：三人同场 `currentThought` 三人齐全、`present=3`；玩家「以后叫我辰辰就可以」当轮落库 `addressing=辰辰`，另两人不变；`_context` 带 `presentThoughtIds` → **rc56b 阶段 1 在真机成立**；我自己那 3 份种子聊天零补丁是**种子占位开场**导致（非卡缺陷），后续真实生成取证一律用真机正常聊天，不再用占位种子。`npm run check` 因 dist 仍为发行态而红，发版构建后重跑。`- 交付：**内联测试卡** `dist/2.0.0-rc.56-checkpoint/神豪终端-rc56-内联-资产登记修复.png`（9.65 MB，chara 与本次构建 `神豪终端.json` 哈希一致，浏览器实测 A/B/C 三案通过，交 YG 自测）。未做：未提交 Git、未升版本号、未切指针、电脑版热更新卡未重出（它取线上指针代码，装它也测不到修复）。真机 8001 未复跑；旧发行 PNG 备份 `.backups/rc56-dist-png/`，`dist/` 根目录跟踪文件已还原。

### 0.7 RC53 / RC53b TOY·LINK 极简版（2026-11-23 18:46–20:03）

- 方案 `RC53总方案/02_方案_4N-极简版与实验版.md`（497 行）+ `03_方案_4N-模式锁与清空状态.md`（283 行，**冲突以 03 为准**）；清单 `.work/checklist-rc53-toylink-lite.md`（34 条）、自检 `.work/selfcheck-rc53.md` 9/9。
- 结论：**同一 bridge 两个视图**；档位 `TOY_LITE_GEARS=[30,60,90]` 落在现有 `pow`；极简版独立注入 ID `cj_shenghao_toylink_lite`（`in_chat/depth:1/system`），事件态→`GENERATION_ENDED` 降级为持续态；**模式锁** `activeMode: null|'lite'|'lab'` 随分支存进现有 key；被锁一侧写命令返回 `TOYLINK_MODE_LOCKED`；「清空状态」= 关宽屏 → 停 100ms 定时器 → 撤 3 个注入 → 清内存态 → 删当前分支 TOY key（不碰输入框）。
- UI：手机内嵌面板（`workshopOpen='toylink-lite'`），**不加新 iframe**；我的页卡片与背包 `it_toylink` 唯一入口都进它，实验版只能从面板底部「切换实验版（宽屏）」进；实验版三件套零改动。rc53b 补：切换按钮改紫→粉渐变、项圈工坊隐藏手机头部 ⚙/×、商城补 `it_imprint`（3000✦，持久奇物）。
- **YG 批准的两处偏离 03**（2026-11-23 18:46「可以，开工」）：① 摘光最后一人**不自动解锁**、刷新也不自愈清锁，只有「清空状态」解锁；② `buildToyLitePromptBlock` 区分 `ctx.gear`（1–3 序号）与 `ctx.pow`（30/60/90）。
- 本批修掉：清空后 `run.selectedId` 丢失导致「为她佩戴」失败（`resetAll()` 补 `currentSelected()`）。
- 验证：`npm test` 501/501；`BUILD_OK`；零 API 3/3 + 4/4 PASS（`apiCalls: 0`）；截图 `.work/shots/rc53*/shoot/`。**未验证**：未解锁态档位按钮无 `:disabled` 视觉（方案 CSS 未含，未自行补）、真实生成未跑、实验版原玩法未回归。

### 0.9 私域三装置测试清单（2026-11-23 21:20，**零 API 部分已执行完**）

- 产物：`reports/私域三装置测试清单-20261123.md`（40 条：项圈 12 / 印记 12 / TOY 16）+ 本轮验收报告 `reports/rc54-私域三装置零API-20261123.md`。
- **已完成**：清单 §六 的 7 条零 API 用例全写完并跑通 —— `rc54.device-shop-{choker,imprint,toylink}`、`rc54.device-imprint-locked-save`、`rc54.device-choker-locked-workshop`、`rc54.device-persist-reload`、`rc54.device-bag-toylink-entry`；**7/7 PASS、76 断言、`apiCalls: 0`**，连跑两遍同结果（`.work/noapi/suite-result-1795439705464.json` / `…-1795439871427.json`）。清单对应条目的「现状」列已改为已覆盖。
- 测试侧新增：seed preset `device_shop*`（12000 分 / 三解锁位 false / char_a 82-10 达标、char_b 48-25 未达标）、`device_ready`（三件 true）、`device_bag_legacy`（背包留一枚 `it_toylink`）；seed 新增 `--unique`（聊天名带随机后缀）；config `presets` 补齐；ctl `only: "rc54."`。执行器未改。
- **三条发现**（详见报告 §四）：① 背包 `it_toylink` 入口是死代码（`engine.js:1195` 载入即删条目，`app.js:146` 按钮永不渲染），T-14 改为迁移取证用例，死分支是否删待 YG；② 我的页装置卡被 `nav.bottom` 覆盖属点击门误报（365×730 下卡 673–755、底栏 662–724，绕过门能进工坊），用例改先滚 260px，既有 `rc47.workshop-choker-gate` 同因失败待重校；③ `host.js:95-102` 的操作日志在 `initKey` 为空时跳过校验、会重放上一局操作，测试侧用 `--unique` 规避，是否算缺陷待 YG。
- 8001 测试聊天用 `--unique` 生成，全部登记在 `.work/test-noapi-backups/manifest.json`，可 `node scripts/test-noapi-seed.mjs --restore` 一键回收。

### 0.95 私域三装置真实生成（2026-11-23 21:3x–21:5x，4 轮已跑完）

- 报告 `reports/rc54-真实生成-20261123.md`；驱动 `scripts/noapi/live-rc54-devices.mjs`；原文 `.work/live-rc54/round-{1,2,3}.md`（剥思考块 `-clean.md`、剥补丁 `-narrative.md`）、结构化结果 `live-result.json`。前置：`__NOAPI_TEST_device_ready__mwtb1axy`，项圈玫瑰金+Eternal、印记下腹+魅魔心翼+陆氏私有、TOY 戴上未开启；模型保持 8001 现状 `pg-gemini-4-hydrogen`（未动任何 API 设置）。**注入确实进了 prompt**：模型思考块逐字复述 `wheel-ui-copy.js:978` worn 态模板（「已佩戴·未开启，严禁写震动」）。
- 结果（**4 轮**，各 1 轮不重试、共约 19.3k 字）：**R-01 / R-02 / R-03 / R-04 / R-05 达成**（第 1 轮「玫瑰金色的细颈链…小巧的铭牌」；第 4 轮把镜头推到下腹后印记写足「魅魔心翼 + 陆氏私有」；未开启不写震动；2 档中等失态；2→3 有落差且不重写置入）；**R-06 部分**（三件同场缺项圈痕迹；「TOY 关闭后仍写震动」实测**未达成**）。**教训**：初版把 R-01 判成未达成是只数关键词（正文用「细颈链/铭牌」，不含「项圈」二字），判「没写」必须读上下文；叙事正文已抽成 `round-{1..4}-narrative.md`。
- **发现 A**：项圈字段第 1 轮即被取用；印记前 3 轮零引用、第 4 轮镜头到下腹立刻写足 → **字段通道有效，生效条件是镜头可见；注入只提供「必须写」的强制性，不提供可见性**。
- **发现 B（YG 21:5x 点破，已按代码核实）**：TOY 停止后正文仍写「三档运行中」。① MVU 的 `currentItems/currentAction/vaginaState` 仍是第 3 轮模型写的「开启3档强烈震动」，脚本不回改；② 刷新把运行态静默复位成「未开启」，但**没有任何路径把这条事实通知注入**——`toylink-bridge.js:795-796` 初始化 `load()` 恢复了「佩戴中+模式锁 lite」却不调 `syncLiteInjection()`，注入只在 `onBranchChange()`（只认 `CHAT_CHANGED`）与用户点 `wear/unwear/start/stop/gear` 时挂；重进同一聊天又不碰面板 → 整轮零 sync。修法 T1/T2/T3 在报告 §五，**YG 21:5x 定为小瑕疵、暂不修**。
- **发现 C（真实数据损失）**：模型把 `accessories` 写成用「、」连接的串时，`engine.js:1174` 的 `【誓约项圈】[^；;]*` 吃到串尾，派生后只剩项圈段——第 3 轮实测丢了珍珠耳坠/细金链手表/木质发簪；本地复现 `.work/live-rc54/accessory-regex-proof.txt`。修法 C1/C2/C3 待 YG，本轮一行源码未改。
- 环境注意：ST 的「API 已连接」是页面级状态，新开页面一律回落成未连接、发送会被静默拦掉（本轮踩了两次，两次都没发出消息、没花钱）；驱动里必须先点一次「连接」按钮（只点按钮，不改设置）。

### 0.96 补测四件（2026-11-23 21:5x–22:1x，**四件全跑完**）

- 报告 `reports/rc54-补测四件-20261123.md`。**①商城全量**：11 件消耗奇物（✦6270）+ 14 项异能（✦21050）逐件购买、已拥有态、背包落库、使用通道抽样 —— `rc54.shop-consumables-all` / `-abilities-all` / `-consumable-use-sampling` 全 PASS（`apiCalls: 0`）；新 preset `device_shop_bulk`（30000 分）。坑：商城弹窗第 5 项起被底部「关闭」遮挡且每次重渲染复位，用例改为逐项 `scrollTo .shop-list`（只设 scrollTop，不注入样式）。
- **②实验版回归**：**rc52 那 6 条宽屏用例从 rc.53 起就是坏的**（入口改成「极简版 → 切实验版」，旧用例仍点 `[data-toylink]` 直等宽屏，单跑即 F1）——HANDOFF 之前一直标它们「已覆盖」，属误记。已补入口四步修好，7/7 PASS；新增 `rc54.toywide-nine-modes`（九模逐个切换 + pill 与 `.tl-mode-btn.on` 断言）。
- **③RC52 佩戴引导词**：1 轮真实生成（9328 字 / 54 s）**达成** —— 正文写全「看见跳蛋僵住 → 掀裙 → 推入触感 → 收线整理衣物 → 双腿微颤」，且 `震动/震颤/嗡` 全 0（未开启）。`clearPendingWear` **已补第 2 句验**（4897 字 / 33 s，同聊天）：思考块无 worn 注入措辞、正文 `跳蛋/戴上/置入/震动` 全 0 → 判为「注入已撤」（强旁证，非直读注入本体）。
- **④extra 解析模式**（YG 自行切模式）：1 轮通过 —— 正文 6831 字 / 52 s，`revision` 1→3、好感 82→83、时间 10:00→10:02、39 个 op 全落；正文自带 patch 全是 `replace` 绝对值，与额外解析结果一致、**不叠加**。8001 已由 YG 切回「随AI输出」；extra 下设备注入与解析失败降级**不验**（YG 22:2x 决定）。
- **事故（§1.3）**：本轮 dump `mvu_settings` 时把额外解析配置的 `sk-...` 密钥打进了对话。已改为只读字段名/非敏感值，密钥未落任何文件；**建议 YG 轮换该 key**。

### 0.996 rc.56 正式发行（2026-11-24 01:3x，YG「推GIT，RC56正式版版本，改指针，确认为已向玩家发行」）

- **版本**：`2.0.0-rc.55` → **`2.0.0-rc.56`**（`package.json` / `project.json`），`releaseNotes` 已改写为本版内容。
- **卡面换新**：YG 提供 480×720 卡面图 → 存入 `assets/card-face-rc56.png`（入库），两版整卡均以它为底图。
- **提交**：`e5c00bf`（源码 + `safe-crypto.js` + 卡面 + 报告，17 文件）→ `a716b42`（`dist/2.0.0-rc.56` 产物，13 文件）；均已在 origin/release。
- **指针**：`cj_shenghao_terminal_v2_ref = e5c00bf6f0d6fc52677ecbf3b22d1fdc81dd78f9`，写入后回读一致；紧急开关仍为 `""`。**回滚点 `528c6ae` / rc.55。**
- **链路全绿**：`npm test` 529/529 → `--core-only` → 推送 → CDN 核对（`testingcf` 第 1 次未就绪，自动重试后通过）→ `npm run build` BUILD_OK → `npm run check` CHECK_OK → 切指针 + 回读。
- **双版本产出**：电脑版 `dist/2.0.0-rc.56/神豪终端-rc56-电脑版.png`（3.16 MB，`supabase-commit-loader`）｜手机版 `dist/2.0.0-rc.56-checkpoint/神豪终端-rc56-手机版.png`（9.19 MB，`embedded-checkpoint`）。
- **发行状态变更**：**未发行 → 已发行**（依据 YG 2026-11-24 明确陈述，符合 `AGENTS.md` §2.1 的「明确陈述」条件）。**自此修改字段须按 §2.3 考虑旧存档与旧字段的兼容或迁移**，不再按未发行期「可直接删改」处理。
### 0.995 手机端适配（2026-11-24 01:0x，YG 实测驱动）

- **现象**：YG 用内联版整卡在手机上打开，开局表单能渲染，但四个开局按钮全不可用，提交报「操作未能完成（TypeError）」。
- **根因**：`crypto.randomUUID()` / `crypto.subtle` / `structuredClone` 都受 Secure context 限制，只在 HTTPS 或 localhost 存在。玩家用 `http://IP:端口` 打开时前两个是 `undefined`。全卡共 **18 处**依赖（`randomUUID` 15 处：host.js×10 / app.js / wheel-frame×2 / imprint-frame / opening-presets；`subtle` 2 处：script-loader、timeline；`structuredClone` 1 处：opening-presets）。桌面端一律走 `127.0.0.1`（安全上下文），所以从开发到测试从未暴露。
- **已修（源码，未提交未发布）**：新增 `src/runtime/safe-crypto.js` —— `uuid()`（原生 → `getRandomValues`（不受此限制）→ Math.random）、`sha256Hex()`（Web Crypto → 纯 JS，实测与 Node 标准实现 9 例全一致）、`deepClone()`。18 处调用点全部替换；产物扫描 `crypto.randomUUID` 0 处，`crypto.subtle` 仅兜底模块内部一处且带可选链保护。
- **验证**：`npm test` 529/529；`build --checkpoint` BUILD_OK；桌面零 API 用例 `rc54.device-shop-choker` PASS（`apiCalls: 0`）；**YG 手机实测开局正常，确认可用**。
- **发行形态结论（YG 2026-11-24 定）**：**电脑端是主战场，用热更新版（指针 `528c6ae`，localhost 属安全上下文，无此问题）**；**手机端给内联版整卡** `dist/2.0.0-rc.55-checkpoint/神豪终端-rc55-checkpoint.png`（8.53 MB，本体内联、不联网、无远程 loader）。**不为手机端改造发布链路，本次不发版、不切指针。**
- **发行形态（YG 2026-11-24 定，长期规则）**：以后每次继续做，都要产出**两个版本**——**电脑版＝热更新**（走 Supabase 指针 + CDN，电脑上 localhost 属安全上下文，无兼容问题）；**手机版＝内嵌格式**（即现在的 checkpoint 整卡，本体内联、不联网、无远程 loader）。手机版沿用当前内嵌形态，**不为它改造发布链路**。- **未做**：源码改动留在工作区未提交（下次发版自带）；`schema-entry.js` 的 `mvu_zod` CDN import 仍是潜在隐患（仅当酒馆助手未提供全局 `z` 时才走，实测手机端未触发）。
### 0.99 rc.55 正式发布（2026-11-23 23:3x，YG「发GIT升版本号，改指针」）

- **版本**：`2.0.0-rc.39` → **`2.0.0-rc.55`**（`package.json` / `project.json`），已提交。
- **提交**：`34a4b48`（源码 + 测试 + 报告 + 已跟踪 dist 的清理，643 项）→ `528c6ae`（`check.mjs` 规则调整 + `dist/2.0.0-rc.55` 产物）；均已在 origin/release。
- **指针**：`cj_shenghao_terminal_v2_ref = 528c6ae56bf6eb865ae7bd9dafc4d5a8a3bc2634`，脚本写入后回读一致；紧急开关 `…_off` 仍为 `""`（未启用）。**回滚点 `b75bcc4` / rc.37。**
- **链路全绿**：`npm test` 529/529 → `--core-only` → 提交推送 → CDN 三域名核对通过 → `fallbackRef` 抬到 `34a4b48` → `npm run build` BUILD_OK → `npm run check` CHECK_OK → 切指针 + 回读。
- **改了一条发布规则（YG 同意）**：`scripts/check.mjs:40` 的 `native generation ownership` 禁词里去掉了 `injectPrompts`。原因是 rc.50 的 TOY·LINK 用它往 `in_tag` 塞状态说明块，不碰请求 mode 与 raw 消息；而 `npm run build` 从 rc.37 起一直被 `fallbackRef` 闸拦住，这一行**从未真正执行过**（功能先于规则）。防越权的四项仍保留：`setChatMessages` / 两个 `cj-native-*` 边界标记 / `不输出UpdateVariable`。备份 `.backups/check.mjs.bak-20261123-233125`。
- **`.gitignore` 补三条**（YG 选择方案目录不入库）：`RC*总方案/`、`RC*截图方案/`、`dist/**/*.png`、`dist/*-checkpoint/`；另加 `.backups/`、`.agents/`。避免 500 MB 整卡 PNG 进仓库。
- **仍然未发行**：玩家发行状态不变（§2.1）。指针切换只影响作者测试更新通道。
### 0.98 rc.55 审查缺陷修复（2026-11-23 22:4x–23:0x，YG「开始修复角色卡！」+「B-05 确认修」+「B-01 保持」）

- 范围：codex 审查 14 条里**修了 12 条**，**B-01 按 YG 指示保持原样**，**B-11 与 B-14 的 `.phone` 一处待 YG 定文案/口径**。清单 `.work/checklist-rc55-bugfix.md`，报告 **`reports/rc55-审查缺陷修复-20261123.md`**（全批，含逐条行号与验证）。
- **改动**：`engine.js`（B-08 `SHOP_HISTORY_MAX`+五处截断、B-05 免费包计数归零、B-07 去重键补 `asset.assetId`、B-12 `PERFUME_AROUSAL_STEP` 与撤销链重算）｜`settlement.js`（B-06 保护 `choker`/`imprints`、B-03 票券绑日程、B-04 人物 id 收敛到落库键）｜`host.js`（B-02 写前重核 epoch/分支/楼层/swipe、B-09 切聊先失效 current 并在新 state 读回后恢复注入、B-13 销毁移除 TOY iframe）｜`toylink-bridge.js`（B-09 `onBranchChange` 清 `liteEvent`）｜`workshop.js`（B-10 草稿优先）｜`style.css:737`（B-14 单层选择器）。
- **B-01 保持原样的理由（实测）**：收紧证据兜底后 527 条里 7 条老测试变红，4 条只是「模型改写证据」或「差一个标点」；且 `settleEvents` 走 partial 模式，拒单**不抛错只进 diagnostics**，真机表现为静默丢单。改动与为它加的标点补丁已全部撤回，`engine.js` 该段与 rc.25 原文逐字一致。
- **验证**：新增 `tests/rc55-bugfix.test.mjs` 28 条；`npm test` **529 / 529**；`build --checkpoint` **BUILD_OK**。反向验证：第一批回退后 **5 红 1 绿**、第二批抽样 **3 红**、B-03 单独 **1 红 1 绿**。
- **待 YG**：无。B-11 已按 YG「你自己写一条就行了」完成（新增定稿 `wearInputDraft`，保存成功后读 `fillInput` 调 `api.fillChatInput(...,{autoSend:false})`，勾选时用既有 `wearAndFillToast`）；B-14 的 `style.css:732`（`.phone`）按 YG 决定**不处理**——工坊换肤本来由 `:has()` 那组（`:932-940`）负责且正常，732 是原型残留死代码。
- **真机验收（8001，2026-11-23 23:1x–23:3x）**：旧 PID 7044 结束、重启 PID 16468（2.1s 就绪）；`神豪终端-rc55b.png` 已装（备份 `.backups/8001-card-神豪终端7-20261123-230632.png`）。**通过四条**：B-10 换款预览跟手（YG 手点）、B-08 商城购买（YG 手点）、B-11 勾选后引导词进输入框（YG 亲眼看到）、**B-05 跨日免费包后仍能按 ¥2,000 首档买付费包**（我加 preset `pack_crossperiod` + 三帧截图，决定性一帧 `.work/shots/rc55/shoot/pack-3-after-confirm.png` 显示「现金启封 ¥2,000」，修复前会显示「今日已启满」）。
- **只能靠单测的两条**：B-03（修复点在 `settleNative` 的 `syncWheelInventory`，零 API 不结算就触发不到）、B-09（注入在 prompt 层，界面看不见，真机要切聊+生成一轮）。**仍未验证**：B-02 真机时序、B-13 重载后 iframe 数量、B-14 计算样式、B-08 老存档近 200 条场景；**未提交 Git、未改版本号**。

### 0.97 Codex 只读审查最新整卡（2026-11-23 22:2x–22:4x；想法池 #40 已执行）

- 调用：`codex exec -m gpt-6.2-sol`（reasoning high、`-s read-only`、session `01a208ca-4f21-7462-9bb4-2e325148b493`、183k tokens）。提示词 `.work/codex-prompt-rc53d-bugreview-20261123.md`、原始输出 `.work/codex-review-rc53d-bug-20261123.md`、**核实报告 `reports/rc54-codex审查最新整卡BUG-20261123.md`（派工以此为准）**。
- **14 条的行号与源码片段全部对得上**（我逐条 read 核过）：2 P0（B-02 切聊覆写同号楼层、B-08 商城第 201 次购买**永久锁死**——我由 P1 升 P0，历史无截断、不可自愈）；6 P1（B-03 票券被旧日程释放、B-04 新人物 id≠路径键、B-05 免费包继承旧计数、B-06 整对象清 choker/imprints、B-07 同句多资产去重、B-09 切聊注入串聊天）；5 P2（B-10 换款预览分叉、B-11 fillInput 无效、B-12 双香水撤销、B-13 TOY iframe 残留）；1 P3（B-14）。
- **三处修正**：① B-01「无证据扣款」是 `engine.js:1631` 注释明文的 rc.25「保证零漏单」有意兜底，属经济口径，**不派工，待 YG 选 A 保持/B 仅缺证据时兜底/C 删兜底**（我倾向 B）；② B-14 只有 `style.css:732`（.phone）与 `737`（类嵌自身）真失效，741/744 等「注释 + 后代选择器」是正常命中，不能当 bug 改；③ B-09 与已知「TOY 停止后注入不同步」同根因，应合并一次修。
- **未验证**：codex 侧 `pwsh` 子进程被系统拒绝（`CreateProcessAsUserW failed: 5`），它靠 MCP `node_repl` 读码 + 内存探针，**`npm test` 未跑**，501/501 是旧值；探针复现我未重放，只核源码路径；需真机验证的 6 条全未跑。**本轮一行源码未改。**

### 0.6 RC52 详情（2026-11-23 03:35–04:15，方案 4N，详见 `RC52总方案/`）

- 承载：`toylink.template.html` + `toylink.css` + `toylink-frame.js` → `toylink.html`（153KB）→ `host.js` 内联；顶层 iframe，通道 `CJ_SHENGHAO_TOYLINK_V1`（**不校验 event.source**）。现场 / 别处两套口径 + 佩戴链路（一次性注入 `cj_shenghao_toylink_wear`，摘下撤回）；世界书与 `worldbookHash` 未变。YG 三条默认：佩戴后不自动关宽屏 / 摘下不弹确认 / 注入单 ID 覆盖。
- 验证：490/490；零 API 7/7；真实生成一轮（10,800 字）现场口径干净，**「戴上要写进正文」未触发**。遗留：整卡 +0.53MB 未瘦身、`rc50.toylink-stack-color` 待重校、P1 双女同频 / P2 预设曲谱未做。

### 0.4 RC49 印记工坊独立宽屏（2026-11-22 22:2x–23:1x）

- 产出 `imprint.template.html` + `imprint.css` + `imprint-frame.js`，构建后内联进 `runtime.js`（不动 `targets` / `worldbookHash`）；通道 `CJ_SHENGHAO_IMPRINT_V1`，`host.js` 加 `openImprint/closeImprint`。修 4H 交付三处：帧侧 `event.source` 校验在真酒馆必假 → 改认 channel + nonce；READY/ack 双向兜底重发；模板清掉原型演示值。
- 验收：印记 4 条 4/4 PASS（`apiCalls: 0`）。**截图教训**：不要用 `page.screenshot()+CDP` 模拟视口，iframe 按旧宽排版会切掉右栏。备份 `.backups/src-backup-20261122-2209/`、`.backups/8001-card-神豪终端7-20261122-2256.png`。

### 0.1 早前（2026-11-22 03:2x–05:2x）完成的四件事

- **A 截图工具 / B 头像库**：栅格系数 `rasterK = PNG宽 ÷ 视口CSS宽` 每次必测（见过 1.25 / 1.5625），已固化为 `ego-pixel-shot` + 项目级 `ego-precise-screenshot`（报告 `reports/rc48-*.md`）；头像库 60 → 88 张（`0088bd0` → `1e769db`，卡内 `avatar-manifest.generated.js` 随 `9686192`），备份 `.work/avatars-backup-20261122-0452`。
- **C 工坊四处缺陷 / D 对照原型三处收敛**：修 `data-ws-pattern` 分发、`composeImprint` 未传部位、`wsOpen` 硬写 `group:'all'`、补 `.phone:has(.workshop-page.is-imprint)` 壳色（`--ui-frame:#251a2b`）；标题缩到 `13px × 字体缩放`、删手机头部英文副标、项圈舞台补颈部剪影 `NECK_SIL`（取自 `rc47-proto-choker.html:616`）。

### 0.2 仍未验证 / 未做（2026-11-24 01:1x 重写）

- **手机端**：crypto 兜底修复后 YG 已实测开局可用。仍未验：手机上的 TOY 实验版宽屏、印记宽屏、三主题切换。
- **电脑端热更新**：指针 `528c6ae` 跑的是 crypto 修复**之前**的代码；工作区那批修复未提交未推送，下次发版才带上。
- **功能面未验**：RC52「佩戴引导词进正文 + 摘下撤注入」、extra 解析模式下设备注入与解析失败降级、实验版九模/寸止回归；印记工坊「已解锁」横幅仍是功能缺失（非未测）。
- **旧用例待重校**：`rc50.toylink-stack-color`、`rc50.toylink-scroll-keep`、`rc47.workshop-choker-gate` —— 均为用例侧问题（旧选择器 / 滚动量不足致 F3），非卡缺陷。
- **潜在隐患**：`schema-entry.js` 的 `mvu_zod` CDN import，仅在酒馆助手未提供全局 `z` 时才会走；实测手机端未触发。

### 0.3 `fallbackRef` 闸是什么（本轮已查明，写清免得再问）

`scripts/build.mjs` 取 `releaseConfig.fallbackRef` 指向的提交里的 `dist/release.json`，比 `worldbookHash`；不等就抛「保底提交不兼容当前世界书/正则/结构」，除非走 `--checkpoint`。
现状：保底提交是 rc.37（`44e1389c…`），当前源码算出 `d264da24…`，故正式构建被拦。
原因：整卡发布带两套加载器，保底指向最后一次正式发布；世界书改了而保底没抬 → 回退会拿到旧世界书配新状态。
影响：`npm run build` / `npm run check` 失败；单测、8001 实机、`--checkpoint` 构建均正常。
出路：①用 `--checkpoint`（现在就这么做）；②先正式发布并验证再把 `fallbackRef` 抬到新提交；③不建议改算法绕过。

---

## 1. 版本与指针（三个号错开，最容易混）

| 位置 | 版本 | 说明 |
|---|---|---|
| 线上指针 | `b75bcc4` / rc.37 | 作者测试用；rc.29(`4591deb`) 可回滚 |
| 源码工作树 | rc.39 / rev 33，内部已按 rc.46→rc.53b 计 | 改动都在这里，未提交未推未切指针 |
| 本地构建 | `dist/2.0.0-rc.39-checkpoint/` | 最新整卡 `神豪终端-rc53d.png`（8,908,389 B，20:07） |

---

## 2. 环境与测试通道

- **8001 测试实例**：`E:\Ajiuguanagentceshi\SillyTavern`（8000 是 YG 日常实例，永不测试）。
- **启动**：`cd <实例>` → `node --max-old-space-size=8192 server.js`（`Start.bat` 会先跑 npm install，慢）。
- **零 API**：skill `zero-api-card-test`；种子 `node scripts/test-noapi-seed.mjs --char 神豪终端7 --preset <preset> --out .work/noapi/seed.json`；只跑指定用例改 `.work/noapi/noapi-ctl.json` 的 `only`。用例写 `seedArgs:["--unique"]` 时聊天名带随机后缀（避开卡内按 `characterId:chatId` 缓存的操作日志重放），回收用 `--restore`。
- **跑批入口**：`ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/.work/noapi/run-suite-rc51.mjs')"`（本地副本，space 名 `NOAPI-RC51`；与 skill 版有漂移，改执行器要两边同步）。
- **点装置卡前先滚动**：365×730 视口下我的页装置卡会落进 `nav.bottom`（top=662），用例里先 `scrollTo .phone-screen 260` 再点，否则点击门判「被 button.tab.active 遮挡」（§8.10 误报，卡本身可点）。
- **整卡导出**：`node scripts/pack-card-png.mjs <底图.png> dist/…/神豪终端.json dist/…/输出.png`，再覆盖 8001 的 `characters/神豪终端7.png`（改前先备份）。
- **截图**：本项目**唯一入口** `shoot-simple.mjs`（项目 skill `ego-precise-screenshot` 内）——整视口拍 + 可选 `crop` 抠元素，裁切走全局 `ego-pixel-shot/scripts/crop-simple.mjs`；不做像素级反复校准（项目 AGENTS §8.8）。实测：卡内小手机 `crop .phone` → 467×936，一次成功。`shoot.mjs` 的精确流程本项目默认不启用。
- **ego space**：只复用 `ownership==='agent'` 的同名 space，别人名下一律不接管；收尾 `finishSpace(task)`。`NOAPI-HARNESS` 归用户所有，别碰。
- **agy**：调用按全局 `AGENTS.md` §2 报批；探测/额度/日志留痕规则照旧。

---

## 3. 验证矩阵（rc54 全批）

| 层 | 结果 | 证据 |
|---|---|---|
| 单测 | **501 / 501**（本轮未改卡内源码） | `npm test` |
| 构建 | 本轮未重新构建（无源码改动，整卡仍 rc53d） | `dist/2.0.0-rc.39-checkpoint/` |
| 契约 | 未跑（`npm run check` 需正式产物） | — |
| 零 API | 三装置 **7 / 7**（76 断言）；补测四件里商城 3 条 + 宽屏 7 条（含新增九模）全 PASS；全部 `apiCalls: 0` | `.work/noapi/suite-result-1795439871427.json`、`…-1795442808948.json` |
| 截图 | **本轮无**（未改玩家可见界面；断言落在 `data-*`、语义文本、MVU 字段） | — |
| 真实生成 | 三装置 **4 轮**（R-01~R-05 达成、R-06 部分）+ RC52 佩戴引导词 **1 轮**（达成）+ extra 模式 **1 轮**（回写正常） | `reports/rc54-真实生成-20261123.md`、`reports/rc54-补测四件-20261123.md` |
| 点击门取证 | 我的页装置卡被 `nav.bottom` 覆盖属误报；绕过门 `.click()` 可进工坊 | `.work/rc54-diag/`（诊断脚本 + 可见性输出） |
| 报告 | 清单 §六 7 条全跑通；三条发现 | `reports/rc54-私域三装置零API-20261123.md` |

---

## 4. 下一步（按优先级）

0. **双版本产出**（YG 2026-11-24 定，长期）：每次继续做都要同时出**电脑版＝热更新**与**手机版＝内嵌 checkpoint 整卡**，手机版沿用现内嵌形态。
1. **待 YG 拍板**：① 开局「登记资产」整单校验缺陷已按 A 修好并验证（§0.998），**待提交/发版**；② 两份 4N 方案已到——`reports/rc56-开局表单方案-4N-20261124.md`（表单限制与预设补齐，不强制重导入，但开局表单本身是卡内正则，新表单须随新整卡送达）与 `reports/rc56-称呼与多人覆盖方案-4N-20261124.md`（称呼动态化＋多人 `currentThought` 漏写，含纯脚本热更的阶段 1 与必重导入的阶段 2），实施顺序等你定。其余无待决——crypto 修复已随 rc.56 提交并发行，两版整卡已产出到 `dist/2.0.0-rc.56*/`。**唯一需要 YG 自己做的**：整卡 PNG 不在 Git 里（`dist/**/*.png` 被忽略），请自行另存备份。
2. **旧用例重校**：`rc50.toylink-stack-color`、`rc50.toylink-scroll-keep`、`rc47.workshop-choker-gate`（用例侧，非卡缺陷）。
3. **瘦身**（可选）：`toylink.html` 153KB 内联了 `WHEEL_COPY` 全文，可改成随 `view` 下发。
4. **P1/P2 与项圈宽屏**：双女同频 / 预设曲谱 / 项圈工坊改宽屏，方案里无可照抄细则，要做先派 agy。
5. **发布链**：`fallbackRef` 已在 rc.55 发布时抬到 `34a4b48`；下次发版由 YG 单独发话。

## 5. 方案与留痕位置

- rc.46：`RC46总方案/`（`00_施工总表.md` 是入口，`04_待办与缺陷.md` 记 D1–D10）
- rc.47：`RC47总方案/`（`02_方案_4N.md` + `03_原型/rc47-proto-imprint.html` / `rc47-proto-choker.html`）
- rc.48 / rc.49：`RC48截图方案/`（四份模型方案 + 合议路线）、`RC49总方案/`（`02_方案_4N.md` + `03_原型/rc49-proto-imprint-wide.html`）；清单 `.work/checklist-rc49-imprint.md`
- rc.50：`RC50总方案/00_施工总表.md`（入口与留痕）+ `03_4N-跳蛋轻量前端与实现方案.md` + `04_原型/rc50-proto-toylink-lite.html`；清单 `.work/checklist-rc50-toylink.md`、自检 `.work/selfcheck-rc50.md`、施工前快照 `.backups/rc50-before-20261123/`（旧的 `02_方案_4N-三装置与TOY.md` 仍保留为第一轮原文）
- rc.51：`RC51总方案/00_施工总表.md` + `02_方案_4A-跳蛋玩法.md`；清单 `.work/checklist-rc51-toylink.md`、自检 `.work/selfcheck-rc51.md`
- rc.53：`RC53总方案/00_施工总表.md`（入口与留痕 §6）+ `02_方案_4N-极简版与实验版.md`（497 行）+ `03_方案_4N-模式锁与清空状态.md`（283 行，冲突以它为准）；清单 `.work/checklist-rc53-toylink-lite.md`、自检 `.work/selfcheck-rc53.md`、diff `.work/diff-rc53.patch``
- rc.52：`RC52总方案/00_施工总表.md`（入口与留痕）+ `02_方案_4N-TOY宽屏与佩戴链路.md`（413 行）+ `03_原型/toy-wide-proto.html`；清单 `.work/checklist-rc52-toywide.md`、自检 `.work/selfcheck-rc52.md`、diff `.work/diff-rc52.patch`、比对 `.work/rc52-{copy-compare.txt,css-note.txt}`
- rc.56：无总方案目录（缺陷修复 + 手机端适配 + 对外材料）。**对外三份材料** `reports/rc56-4A-帖子详细介绍教程-20261124.md`（4A **直读源码**出品，`conversation_id` `0b50b36b-5c04-4b79-92f6-e1e534599ff1`；帖子终稿实测全字符 2072，YG 接受）；审查与修复报告 `reports/rc54-codex审查最新整卡BUG-20261123.md`、`reports/rc55-审查缺陷修复-20261123.md`；发帖参考 `C:\Users\Administrator\Desktop\wen\wa.txt`；卡面源图 `assets/card-face-rc56.png`
- 想法池：`想法池\未实施想法.md` —— **当前为空**。#40（GPT-6.2-SOL 查最新整卡 BUG）已于 2026-11-23 22:2x 执行完审查，迁入 `想法池\已完成想法.md`（**修复未开始**）；#39（项圈工坊改宽屏）已按 YG 2026-11-23 20:4x 指示删除；#38 跳蛋玩法单薄已实施（rc.51/rc.52）迁入同一文件，#37 / #36 也在其中（项圈工坊未独立，条目内如实标注）。收录门槛写在文件头：只收 YG 明确要记入的想法。
- 规则：`AGENTS.md` 新增 **§8.10**（先怀疑脚本与用例）与 **§8.11**（新 UI 必须自拍对比原型），2026-11-23 YG 明确。
- 报告：`reports/rc48-*.md`、`reports/rc46-工坊回抄-交付报告-20261122.md`、`reports/rc47-交付报告-20261122.md`、`reports/私域三装置测试清单-20261123.md`（40 条，零 API 与真实生成都已执行）、`reports/rc54-私域三装置零API-20261123.md`、`reports/rc54-真实生成-20261123.md`、`reports/rc54-补测四件-20261123.md`、`reports/rc54-codex审查最新整卡BUG-20261123.md`（14 条缺陷 + 逐条核实 + 派工顺序）、`reports/rc56-开局表单方案-4N-20261124.md`、`reports/rc56-称呼与多人覆盖方案-4N-20261124.md`（两份 4N 方案，留痕见各自文件头）；4N 留痕：A `bd29a195-96aa-4a70-ba1e-4d75547d8f2d`（log cli-20261124_033536）、B `ecaf6b76-4b6d-4bca-b212-6cef6ed6df07`（log cli-20261124_034017）

---

## 6. 历史索引（详情见归档）

| 版本 | 一句话结论 |
|---|---|
| rc.47 | 两座工坊高定 + 三装置门槛（好感≥70 或 堕落≥60）+ 删自戴 |
| rc.46 | 数据地基与四项修复 + TOY·LINK 内嵌 + 两座工坊首批 |
| rc.45 | WB-3 常驻合并 + WB-4 关键词收敛 + 3 条 UI 用例 |
| rc.43 | 5 P0 + 6 P1 + 可撤销使用 + 世界书递归放开 |
| rc.41 | 内测三问题修复 + 玩法纯化 + 三重盘台入口特效 |
| rc.40 | 统一卡面 / 卡册独立页 / 叠卡 / 背包可删 / 圣典红阶 |
| rc.38 | 引擎与契约消缺 + 内容层瘦身 + 情欲双联开关 |
| rc.37 | 星愿卡包；三页重做；背包使用通道；四个实机缺陷修复 |
| rc.36 | 三独立盘 + 顶层全屏 iframe；五页导航；零 API 通道落地 |

> 归档：`E:\AGY_ARCHIVE\SHZD_HISTORY\HANDOFF_rc24_to_rc37_archive.md`（1,347 行）。

---

## 7. 旁支工作线 · 工具链与规则（2026-11-22，不属角色卡工程）

- **截图工具已固化为轻量版**：本项目唯一入口 `shoot-simple.mjs`（`ego-precise-screenshot` skill 内）——整视口拍 + 可选 `crop` 抠元素；裁切走全局 `ego-pixel-shot/scripts/crop-simple.mjs`（`rect × 栅格系数`，不做角标/遮罩/自证）。ctl 模板 `.work/noapi/shot-simple-ctl.json`。实测：卡内小手机 `crop .phone` → **467×936**，CDP 一次成功。`shoot.mjs` 精确流程本项目默认不启用（项目 AGENTS §8.8）。踩坑：**卡内小手机默认折叠，任何拍手机的 ctl 第一步都要 `clickIn .folded`**。

- **产物**：脚本 `scripts/dsh-codex/` 四个——`invoke-codex.ps1`（调用器）、`quota-codex.ps1`（查额度）、`parse-codex-jsonl.ps1`（JSONL 解析）、`probe-codex.ps1`（仅手动验通道用，非流程门禁）；报告 `reports/DSH接入Codex方案-20261122.md`（agy 4N 出的方案，725 行）、`reports/DSH-Codex阶段0-1验收与探针实测-20261122.md`、`reports/AGENTS优化建议-ClaudeOpus-20261122.md`。
- **当前状态**：Codex 额度已耗尽（桌面端剩 1%，`2026-11-23 01:35` 重置）。**阶段 2 实测待重置后做**——`workspace-write` 档、`exec resume` 续接、`invoke-codex.ps1` 的首次真实非探针调用。
- **已验证**：`codex-cli 0.167.1` 可调用（`codex.cmd`，ChatGPT 登录态）；`exec --json` 会话字段是 **`thread_id`**，事件为 `thread.started` / `turn.started` / `item.completed` / `turn.completed`；`-s read-only` 在 Windows 可用；`--ephemeral` 不落 `sessions/`；查额度只能走 `codex app-server` 的 `account/rateLimits/read`（CLI 无 `/usage`）。
- **未验证**：`workspace-write` 档、`exec resume` 的 `-s/-C` 继承、登录失效行为、`codex doctor --json` 结构、`logs_2.sqlite` 表结构。
- **规则已大改**：`~/.dsh/AGENTS.md` 210 → 81 行（§2 闸门扩到 codex 与 `subagent_antigravity`；§3 探针只剩 4A；§10 放额度与硬排除）；项目 `AGENTS.md` 选型表同步。条文不在此复述，直接读两份 AGENTS。
- **模型分工修正依据**：`E:\AGY_ARCHIVE\MODEL_TEST\rc46-双模型能力对照测试报告-20261119.md`——4N 在技术文档语境直接写器官词，只有创作输出语境才收紧成代称。

