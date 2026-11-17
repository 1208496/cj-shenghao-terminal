# 《神豪终端》rc.28 实机三项问题 · 深度根因诊断与升级方案（交付 DSH 执行版）

> **工作区**：`E:\SHZDCHOSSS`
> **基线版本**：`2.0.0-rc.28`（成品 `dist/2.0.0-rc.28-checkpoint/神豪终端.json`）➔ 目标版本 **`2.0.0-rc.29`**（`cardContractRevision` 24 ➔ **25**）
> **玩家发行状态**：**尚未对外发行**（依据 `AGENTS.md`：按当前需求直接改进架构与协议，不为未发行的旧测试存档增加冗余迁移层，但保证解析安全）。
>
> ### 🚨 【执行纪律：严格遵守 `HANDOFF.md` 三大永久铁律】
> 1. **脚本兜底律**：UI 操作跨楼层回退/重放存活、公司名义支付强行折算 `USER` 扣款/余额拦截、建档事实数字与性格标签确定性回填修补，**全部由脚本层确定性兜底**，绝不赌大模型自觉。
> 2. **示例驱动律**：世界书与更新协议保持严格 JSONPatch 示例对齐，不破坏现有 309 条单测基线。
> 3. **文案逐字照抄律**：凡涉及 `src/content/literary.json`、`src/content/protocol.txt`、`src/content/state-context.txt` 的文字修改，**DSH 必须 100% 逐字复制粘贴本方案第四节代码块中的定稿原文，一个字、一个标点都不准自行发挥或缩写**。

---

## 一、 问题 1：界面操作绑定最后一条消息，回退楼层（`/del` / `/swipe`）静默撤销

### 1.1 根因判断（落到具体函数与数据流）

1. **写入端绑死单点楼层与正文指纹**：
   - 在 `src/runtime/host.js` 的 `mutateState(command, expectedLineage)`（第 130–142 行）中，玩家触发的纯 UI 操作（提现 `PLAYER_WITHDRAW`、九大档案建档 `PLAYER_BUILD_PROFILE`、锁定档案 `PLAYER_LOCK_PROFILE`、打星 `PLAYER_STAR`、隐藏/恢复 `PLAYER_HIDE/RESTORE`、添加/取消日程 `appointment`）会获取当前聊天精确最后一条消息 `const exact = messageList().at(-1)`（第 134 行）。
   - 随后，脚本将重放后的新状态 `next` 和操作日志 `cj_native_operations`（其结构为 `{branchKey, messageId: exact.message_id, swipeId: exact.swipe_id ?? 0, bodyFingerprint, items: [...]}`）通过 `native().replaceMvuData(vars, {type: 'message', message_id: exact.message_id})`（第 139 行）**唯一写入到最后一条消息对应的 swipe 槽位中**。
2. **读取端与重放端的刚性匹配导致静默丢失**：
   - 当玩家执行 `/del 1` 删除最后一楼（例如第 14 楼）时，第 14 楼连同其携带的 `vars.stat_data.shenghao` 和 `vars.cj_native_operations` 被物理销毁。
   - `host.js` 的 `readCurrent()`（第 35–45 行）从后往前扫描剩余楼层，命中第 13 楼的 `vars.stat_data.shenghao`，直接用第 13 楼的旧快照（提现前 ¥890,000、未建档状态）覆盖 `current`，**没有任何跨楼层日志对比或恢复机制**。
   - 同理，当玩家在当前楼层执行 `/swipe`（切换 swipe 分支）或 `/regen`（重新生成正文）时，`host.js` 第 88–92 行的 `VARIABLE_UPDATE_ENDED` 回调检查：
     ```js
     if(journal && journal.branchKey===branch() && journal.messageId===context.message.message_id && journal.swipeId===(context.message.swipe_id??0) && journal.bodyFingerprint===context.bodyFingerprint)
     ```
     由于新 swipe 的 `swipeId` 和 `bodyFingerprint` 均与旧 swipe 不同，原操作日志既不在新 swipe 的 `swipes_data` 里，指纹也对不上，导致玩家刚刚在当前楼层点过的「建档 / 提现 / 日程」在换 swipe 后同样被静默丢弃。

### 1.2 推荐方案：「操作分类幂等重放 + 聊天级持久操作日志（Chat-Level Operation Log）+ 跨回退自动愈合与 Toast 反馈」

将玩家 UI 操作与单条 AI 消息的正文指纹解耦，引入**聊天分支级追加式操作日志（`loadOpsLog / saveOpsLog`）**，并在 `readCurrent()` 与 `VARIABLE_UPDATE_ENDED` 两个入口实现**自动前向补齐（Auto-Heal Replay）**：

1. **聊天分支级持久操作日志（`host.js`）**：
   - 在 `localStorage`（键名 `cj-shenghao:ops:v1:${branch()}`）与当前楼层 `vars.cj_native_operations` 双写维护当前 `branch()` 的有序玩家操作队列 `items`（按 `operationId` 去重）。
   - 每条记录保存：`{ command, createdAtMessageId: exact.message_id, createdAtSwipeId: exact.swipe_id ?? 0, createdAt: Date.now() }`。
2. **两类 UI 操作的回退重放语义（严守 `/swipe` 分支一致性与经济恒等式）**：
   - **第一类：与楼层经济结果无关的独立玩家资产/配置操作**（`PLAYER_BUILD_PROFILE` 九大档案建档、`PLAYER_LOCK_PROFILE` 锁定档案、`PLAYER_STAR` 特别关注、`PLAYER_HIDE` / `PLAYER_RESTORE` 隐藏恢复、`appointment` 日程增改）：
     - **语义**：只要目标人物在回退后的楼层 `state.characters[personRef]` 中已存在，无论玩家删楼（`/del`）还是换分支（`/swipe`），该操作都 **100% 自动幂等重放并落盘到当前最新楼层**！玩家苦等 40 秒生成的九大档案、手动添加的日程、打星关注绝不会因为删楼或重roll正文而蒸发。
   - **第二类：依赖奖池与有效身家的提现操作**（`PLAYER_WITHDRAW`）：
     - **语义**：区分「提现发生在被回退楼层之前」与「提现所含的某笔消费/暴击就产生于刚被删掉或换掉的那一楼」：
       - **情况 A（池额与报价在回退后依然满足）**：例如第 13 楼温迎奖池已满 15.08 万，第 14 楼只是普通闲聊（无温迎新入池），玩家在第 14 楼点了提现，随后 `/del 1` 删掉第 14 楼或 `/swipe` 重生成第 14 楼。此时在第 13 楼（或新 swipe）状态上，`poolParts(state, cid).total === command.expectedPoolCents` 且 `withdrawalQuote` 一致，脚本**自动无损重放该笔提现**，钱和提现记录稳稳保留！
       - **情况 B（被删掉/换掉的那一楼正好看含了这笔提现所结算的消费或暴击）**：此时回退后的楼层里，那笔产生奖池的剧情事实已被玩家亲自撤销，奖池总额小于提现时的 `expectedPoolCents`（或好感/堕落退回解锁线以下）。若强行保留提现后的现金，会导致「剧情没花钱却凭空多出十倍提现」的刷钱漏洞，或破坏 `assertEconomy` 的 `REWARD_CLAIM_MISMATCH` 恒等式。因此，此时脚本**安全挂起/撤销该笔未锚定提现**，将原始未删楼层的奖池原封退回待领池，并通过 `api.notice` 向前端弹出明确醒目的 Toast 提示：
         > `「因回退楼层包含未确认的入池事件，上一笔提现已退回奖池，可随时重新领取。」`
3. **同楼层换 `/swipe` 或重解析时的无损继承（`VARIABLE_UPDATE_ENDED` & `readCurrent`）**：
   - 移除 `host.js` 第 89 行要求 `journal.swipeId === context.message.swipe_id && journal.bodyFingerprint === context.bodyFingerprint` 的苛刻限制！
   - 改为遍历该聊天分支操作日志 `opsLog.items`：凡 `!state.operationHistory[opId]` 的玩家操作，逐条尝试 `replayPlayerCommand`（用 `try/catch` 隔离单条失败：若某条 `PLAYER_WITHDRAW` 因分支奖池变化抛出 `WITHDRAWAL_REVIEW_REQUIRED` 或 `WITHDRAWAL_LOCKED`，仅跳过该笔提现并记录 `revertedWithdrawals` 通知，其余建档/日程/打星操作照常生效）。
   - 在 `readCurrent()` 命中最新有效楼层 `found` 后，若检测到 `opsLog.items` 中存在尚未写入 `found.state.operationHistory` 的可重放操作，立即在内存中完成补齐并回写当前楼层 `replaceMvuData`，确保 `/del 1` 后无需等到下一轮 AI 回复，界面当场就能保住建档、日程与合规提现！

### 1.3 备选方案及否决理由

- **备选方案 A：把提现后的现金和九大档案拆到独立于 MVU 的外部存储（如 `localStorage` 覆盖层），渲染时强行覆盖 `state.user.cashCents`**
  - **否决理由**：彻底破坏 `engine.js` 第 348–365 行 `assertEconomy(s)` 的核心账本恒等式（`user.cashCents === initialCashCents + income - expense` 及 `rewardEvents[rid].withdrawalId === w.withdrawalId`）。一旦玩家删掉产生消费的那一楼，外部强盖的 `cashCents` 会与楼层内 `finance.ledger` 失步，导致下一轮结算直接抛出 `LEDGER_MISMATCH` 阻断游戏。
- **备选方案 B：拦截酒馆的 `/del` 和 `/swipe` 按钮，弹窗禁止玩家回退带有 UI 操作的楼层**
  - **否决理由**：SillyTavern 的删除消息、滑动 swipe、斜杠命令 `/del` 属于宿主核心高频操作，强行拦截宿主 DOM 或阻止斜杠命令不仅侵入性极高、容易随酒馆版本失效，而且剥夺了玩家重 roll 不满意正文的自由。通过「聊天级操作日志 + 智能重放 + 池变退回原池并弹 Toast」既保住了所有能保的操作，又严守了账本自洽。

---

## 二、 问题 2：「公司账户流水」绕开 `user.cashCents` 硬约束

### 2.1 根因判断（落到具体函数与数据流）

1. **结算引擎存在 `payer !== 'USER'` 早退后门**：
   - 在 `src/core/engine.js` 的 `applyEvent` -> `case 'CASH_TRANSACTION'`（第 438 行）中，有一行极其危险的早退代码：
     ```js
     if(e.direction==='OUT' && e.payer!=='USER')return;
     ```
   - 同时，在 `src/content/protocol.txt` 第 13 行写有：`payer:USER或外部付款者`。
   - 这导致了双重漏洞：
     - **漏洞路径 1（完全不提事件）**：当玩家开局身份是「晟世资本 执行合伙人」且现金只有 100 万，却在对话中指令“签 300 万全款合同、让公司财务走对公流水”时，大模型在思考块里推理出：“个人现金只有 100 万不够付 300 万，但走晟世资本对公账户不属于个人现金 `user.cashCents`”，于是正文中痛快写下“三百万全款合同当场签妥、财务下午打款”，同时在 `<UpdateVariable>` 里**直接不提交 `CASH_TRANSACTION`**（或只给女主加好感与破防分）。
     - **漏洞路径 2（借 `payer: "COMPANY"` 逃避扣款）**：即便模型提交了 `direction: 'OUT'` 的 `CASH_TRANSACTION`，只要它把 `payer` 写成 `'COMPANY'` 或 `'晟世资本'`，第 438 行 `if(e.direction==='OUT' && e.payer!=='USER') return;` 就会**静默跳过整笔交易**——既不校验 `s.user.cashCents >= e.amountCents`，也不扣减分毫现金，但正文里的 300 万排面、好感度暴涨和行为暴击奖池却全数白嫖到手！

### 2.2 推荐方案：「路线 (b) 提示词与结算引擎双层铁腕收口（个人与公司资金池合一 + 废除 OUT 外部付款者免扣后门 + 超额造词拦截）」

结合本项目已确认的经济基线，采用 **路线 (b) 双层收紧方案**（不增设复杂的第二套公司资金字段，而是将玩家名下公司/家族可调配流动资金与 `user.cashCents` 严格合一）：

1. **第一层（脚本结算层兜底，`src/core/engine.js`）**：
   - **彻底堵死第 438 行 `payer !== 'USER'` 免扣后门**：
     - 在 `normalizeEvent`（`src/core/engine.js` 第 603 行附近）与 `applyEvent` 的 `CASH_TRANSACTION`（第 438 行）中：凡 `direction === 'OUT'` 的交易，**无论模型将 `payer` 写成 `'USER'`、`'COMPANY'`、`'CORPORATE'`、`'晟世资本'` 还是省略，脚本一律强制归一化为 `e.payer = 'USER'`**！
     - 删除 `if(e.direction==='OUT' && e.payer!=='USER') return;`，让所有 `OUT` 交易无一例外进入第 445 行的硬校验：`if(e.direction==='OUT') requireRule(s.user.cashCents >= e.amountCents, 'INSUFFICIENT_CASH');`。
   - **新增「正文对公/家族垫付绕过现金」结算后置审计（`settleNative` / `processEvents`）**：
     - 在 `src/runtime/diagnostics.js` 新增诊断码 `CORPORATE_BYPASS_BLOCKED`（或复用 `INSUFFICIENT_CASH` 提示）。
2. **第二层（世界书与协议层定稿收口，`literary.json` + `protocol.txt` + `state-context.txt`）**：
   - 在 `src/content/literary.json` 的 `terminal-economy` 条目、`src/content/protocol.txt` 第 13 行、`src/content/state-context.txt` 第 6 行中，**明确写入「个人与公司/项目可调配资金统一记于 `user.cashCents`，严禁借公司对公账户、财务拨款、家族基金或集团走账名义绕过余额约束」**：
     - 玩家在剧情中可以口述“走公司公账/让财务打款”作为叙事排面，但**只要是由玩家拍板促成的付款、注资、采购、免债或商务派单，其可动用流动资金上限就是 `user.cashCents`，且完成付款时必须提交 `payer:"USER"` 的 `OUT` 类 `CASH_TRANSACTION` 实扣 `user.cashCents`**。
     - 若玩家指令的金额超出当前 `user.cashCents`（例如现金 100 万却要求签 300 万全款），**严禁模型用“动用公司公账/财务调拨”替玩家凭空补足差额**！正文中必须如实写出：财务/助理汇报当前可立调流动资金仅余 `user.cashCents`（如 100 万），只能先签意向书/付可承受范围内的首期定金、或等玩家先从终端提现奖池/变卖资产注入资金后再划拨尾款；且未实际扣款的意向/定金之外部分绝不入账、不按全款给破防高分。

### 2.3 备选方案及否决理由

- **备选方案 A（路线 a）：在 `user` 或 `finance` 下新增一套独立的 `companyCashCents / creditLimitCents`（公司账户额度与授信体系）**
  - **否决理由**：
    1. **动摇神豪终端核心爽感循环**：「花个人现金 ➔ 进女主奖池 ➔ 十倍提现回血 ➔ 升神豪等级」是全卡唯一的经济发动机。如果给「富家公子哥 / 合伙人」额外发几百万甚至几千万的公司公账额度，开局 100 万现金档位将名存实亡，且「花公账的钱算不算个人消费入池、计不计入 `tierBasis`」会引发一连串套利漏洞。
    2. **工程改动面过大**：需要改 Zod Schema、改开局向导第 2 步表单、改「我的」页面财富卡片、改账本明细区分公私账户，完全背离最小改动面原则。直接规定「`user.cashCents` 即玩家当前唯一可自由调配的流动资金池（含个人卡与名下公司可立调头寸）」既符合直觉，又是零 Schema 破坏的治本之策。

---

## 三、 问题 3：建档失败/超时缺少用户可见反馈，30–50 秒等待期体验盲区

### 3.1 根因判断（落到具体函数与数据流）

1. **`app.js` 建档确认分支吞掉了本该冒泡到顶层的异常，且未清理忙碌状态或保留弹窗**：
   - 在 `src/ui/app.js` 的 `actions(e)`（第 122–186 行）中，整个点击事件处理器外层其实包着一个统一的 `try { ... } catch(error) { console.warn('[神豪终端界面]', error.message); notify(errorText(error)); b.disabled=false; if(setup)wizard(); }`（第 186 行）。
   - 第 155 行的建档分支写成了：
     ```js
     if(d.confirmBuild){if(d.lineage!==view.lineage)throw Error('STALE_SOURCE');b.disabled=true;b.textContent='正在建档…';try{view=await api.buildProfile(d.confirmBuild,d.lineage);closeModal();phone();notify('九大档案已保存');}finally{b.disabled=false;b.textContent='确认建档';}}
     ```
   - 为什么失败路径下用户依然面临体验断层与潜在静默失败？
     - **原因 A（`generateProfile` 的 JSON 解析异常与未映射错误码）**：在 `src/runtime/host.js` 第 104 行 `const parsed = JSON.parse(result.trim()...)` 中，若大模型返回了带前缀说明文字的 JSON、截断的 JSON、或者 `H.generateRaw` 抛出了底层网络异常，抛出的错误是原生 `SyntaxError` 或未知 `Error`，其 `error.message` 不在 `app.js` 第 22 行 `errorText(e)` 的映射表中，只能退化为含糊不清的 `'本次记录尚未完成，请稍后重试。'`。
     - **原因 B（`PROFILE_FACT_CONFLICT` 严苛逐字校验极易误杀正常建档）**：在 `src/runtime/host.js` 第 151–152 行：
       ```js
       const required=[['identity',c.name],['identity',String(c.age)],['identity',c.occupation],...c.personalityTags.map(v=>['personality',v]),['appearance',c.appearance],['body',c.body],...['heightCm','weightKg','bustCm','waistCm','hipCm','shoeSizeEu'].map(k=>['body',String(c[k])])];
       for(const [section,value] of required)if(value&&value!=='null')requireRule(completed.profile[section].includes(value),'PROFILE_FACT_CONFLICT');
       ```
       大模型在生成 70–150 字的 `appearance` 或 `body` 档案时，极常对长达 40 字的输入 `c.appearance` 做轻微语序润色，或把鞋码 `37` 写成 `三十七码`、忽略某一个性格标签。一旦有一处没做到 100% 子串逐字匹配，脚本直接抛 `PROFILE_FACT_CONFLICT` 丢弃整份耗时 40 秒生成的九大档案！这直接违反了 **【永久铁律 1：脚本兜底律】**（能由脚本确定性补齐的已知事实，绝不因为模型漏字就炸报错丢结果）。
     - **原因 C（`publish()` 重绘冲掉模态框状态与无阶段计时/取消入口）**：在 `host.js` 第 147 行 `buildProfile` 执行 `setupBusy = true; publish();` 时，`app.js` 的 `receive(v)` 会触发 `phone()` 重绘；而 30–50 秒等待期间，模态框里只有死板的 `正在建档…` 四个字，既没有经过秒数提示，也没有「取消建档」按钮（弹窗的取消按钮在建档开始后若被误点或点击遮罩关闭，后台生成仍在跑，完成后若失败用户完全看不到弹窗里的上下文）。

### 3.2 推荐方案：「脚本确定性事实锚定（根除 `PROFILE_FACT_CONFLICT` 误杀）+ 建档实时秒表与可取消机制 + 显式 Catch 弹窗内红字与 Toast 双重反馈」

1. **脚本兜底修补 `completed.profile`，根除 `PROFILE_FACT_CONFLICT` 误杀（`src/runtime/host.js` `buildProfile` / `generateProfile`）**：
   - **JSON 容错提取**：在 `generateProfile`（第 104 行）中，若直接 `JSON.parse` 失败，自动截取第一个 `{` 到最后一个 `}` 之间的 JSON 对象再解析；仍失败则明确抛出 `RuleError('INVALID_PROFILE')`。
   - **事实锚定兜底（遵照铁律 1）**：在 `buildProfile`（第 150–152 行）拿到 `completed.profile` 后，只要 9 大分段本身是非空有效文本（通过 `profile(parsed)` 校验），若模型在某分段漏掉了必填硬事实（如 `identity` 漏了年龄/职业，`personality` 漏了某个 `personalityTags`，`appearance` 未完整包含原 `c.appearance`，`body` 漏了身高体重三围鞋码数字），**由脚本自动在对应分段末尾或句首平滑补齐该事实锚点**（例如 `body` 缺少数字时自动补上 `（身高${c.heightCm}cm，体重${c.weightKg}kg，三围${c.bustCm}/${c.waistCm}/${c.hipCm}cm，鞋码${c.shoeSizeEu}码）`），只在 `completed.profile[ identity ]` 居然写错了人物名字（出现了其他在册人物姓名）时才抛 `PROFILE_FACT_CONFLICT`！这样建档成功率从“看模型心情”直接提升到 **接近 100%**。
2. **新增 `cancelBuildProfile()` 接口与合理化超时（`src/runtime/host.js` + `src/runtime/setup-profiles.js`）**：
   - 将建档的 `generationWithTimeout` 超时时间定为 **`90000`（90 秒）**（原 120 秒过长，玩家干等两分钟体验太差；实测正常生成在 30–50 秒）。
   - 在 `host.js` 维护当前建档请求 ID `activeBuildRequestKey = null`，并在 `api` 上暴露 `cancelBuildProfile()`：调用 `H.stopGenerationById?.(activeBuildRequestKey)` 并立即中断等待、抛出 `RuleError('BUILD_CANCELLED')`，释放 `setupBusy = false`。
3. **UI 建档模态框升级：实时读秒进度 + 「取消建档」按钮 + 显式 `catch` 错误横幅与 Toast 双提示（`src/ui/app.js`）**：
   - 在 `d.confirmBuild` 分支中：
     - 启动一个 `1000ms` 的 `setInterval` 计时器，将按钮文案动态更新为 `正在建档… (${elapsed}s)`，并在模态框正文中展示进度提示：`正在结合基础设定与过往经历生成九大档案（通常需 25–50 秒），请勿关闭页面…`。
     - 将模态框左侧的「取消」按钮在建档期间切换为可点击的 `data-act="cancel-build"`（「中止建档」），并禁止点击半透明遮罩层误关弹窗。
     - **补齐显式 `catch (err)` 分支**：一旦 `api.buildProfile` 抛出异常（超时 `MODEL_TIMEOUT`、手动取消 `BUILD_CANCELLED`、格式错误 `INVALID_PROFILE`、事实冲突 `PROFILE_FACT_CONFLICT` 等），在 `catch` 中：
       1. 立即调用 `notify(errorText(err))` 弹出顶层 Toast；
       2. 同时在当前建档模态框内部插入醒目的 `.error-note` 错误说明条（如 `建档未完成：准备人物资料超时（已超过90秒），请检查模型连接后点击「重试建档」。`），将确认按钮文案改为 `重试建档`，让玩家一眼看清失败原因并可当场一键重试！
     - 在 `errorText(e)` 中补齐 `INVALID_PROFILE` 与 `BUILD_CANCELLED` 的中文映射。

### 3.3 备选方案及否决理由

- **备选方案 A：把九大档案生成改成后台静默执行，关掉弹窗让玩家继续发消息聊天，生成完再自动写入**
  - **否决理由**：SillyTavern 的生成通道（`generateRaw` 与主聊天生成）在大多数反代/API 下不支持并发，且后台静默生成完成时，玩家可能已经发出了新一轮聊天消息并改变了 `revision` 与 `lineage`，导致 `mutateState` 必然因 `STALE_SOURCE` 或 `GENERATION_BUSY` 写入失败，白白浪费 40 秒 Token。保持模态框前台等待 + 读秒进度 + 可随时中止 + 失败原地重试，是最稳健的交互闭环。

---

## 四、 改动点清单与世界书/协议 100% 逐字定稿

### 4.1 改动文件总览表

| 序号 | 文件路径 | 函数 / 位置（基于 rc.28 行号） | 改动性质 | 是否动世界书 (`worldbookHash`) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `project.json` / `package.json` | 顶层 `version`、`cardContractRevision`、`releaseNotes` | 版本升至 `2.0.0-rc.29`，`cardContractRevision` 24 ➔ `25` | **是**（修订号变化） |
| 2 | `src/runtime/host.js` | `loadOpsLog` / `saveOpsLog` / `reconcileOpsLog`（新增）、`readCurrent`（35–45 行）、`bindMvu` 的 `VARIABLE_UPDATE_ENDED`（77–94 行）、`mutateState`（130–142 行） | **问题 1**：新增聊天分支级玩家操作日志与跨 `/del`、`/swipe` 自动重放愈合机制；不满足池额的提现自动退回原池并通知前端 | 否（属 runtime） |
| 3 | `src/runtime/host.js` | `generateProfile`（99–111 行）、`buildProfile`（144–155 行）、`api.cancelBuildProfile`（新增） | **问题 3**：JSON 容错提取、90s 超时、支持中途取消建档、脚本自动锚定补齐硬事实（根除 `PROFILE_FACT_CONFLICT` 误杀） | 否（属 runtime） |
| 4 | `src/core/engine.js` | `applyEvent` 的 `CASH_TRANSACTION`（434–446 行）、`normalizeEvent`（580–626 行） | **问题 2**：废除 `e.direction==='OUT' && e.payer!=='USER'` 免扣早退后门；所有 `OUT` 交易强制归一化 `payer='USER'` 并严格执行 `cashCents >= amountCents` 校验 | 否（属 runtime/core） |
| 5 | `src/ui/app.js` | `errorText`（22 行）、`actions` 建档分支 `d.confirmBuild`（154–155 行）、`closeModal` / 遮罩点击保护、`receive`（192–196 行） | **问题 1 & 3**：建档读秒计时器、中止建档按钮、显式 `catch` 弹窗内错误横幅 + Toast、展示回退提现退回通知 | 否（属 UI） |
| 6 | `src/content/literary.json` | `terminal-economy` 条目（第 11–16 行） | **问题 2**：明确公司/公账/家族流动资金与 `user.cashCents` 合一，严禁借公账名义绕过现金上限 | **是**（世界书正文变更） |
| 7 | `src/content/protocol.txt` | 第 13 行 `CASH_TRANSACTION` 规则段 | **问题 2**：明确 `OUT` 的 `payer` 固定为 `USER`，任何以公司公账/财务调拨名义的支付均须按 `OUT` 扣减 `user.cashCents` | **是**（协议正文变更） |
| 8 | `src/content/state-context.txt` | 第 6 行资产与消费约束段 | **问题 2**：同步写入公私流动资金合一、严禁借对公流水免扣或超额付款的硬约束 | **是**（状态说明变更） |

> **⚠️ 世界书变更特别标注**：本次方案修改了 `src/content/literary.json`、`src/content/protocol.txt`、`src/content/state-context.txt` 以及 `project.json` 的 `cardContractRevision`，构建后 **`worldbookHash` 必然改变**。按项目铁律，DSH 必须 100% 逐字复制下方 4.2 节的定稿文本写入对应文件，且测试时需重新导入整卡。

---

### 4.2 世界书与协议定稿原文（DSH 必须 100% 逐字照抄，严禁增删改任何一个标点）

#### 定稿 1：`src/content/literary.json` 中 `"id": "terminal-economy"` 条目的完整定稿
请将 `src/content/literary.json` 第 11–16 行的 `terminal-economy` 对象完整替换为以下 JSON（**100% 逐字复制**）：

```json
    {
      "id": "terminal-economy",
      "title": "终端奖池与现金等级",
      "constant": true,
      "keys": [],
      "body": "每位正式收录女性的原始奖池从零开始。玩家已完成的真实消费，按实际归属她的受益份额1:1计入原始消费池；有效破防互动与亲密涩涩实战则进入行为暴击池，由终端在对应分数段的奖金区间内随机摇出暴击金额（有零有整）。消费先扣实际现金，原始池不提前乘倍率。\n当前好感≥70或堕落度≥60、人物正常追踪且有待领奖励时，玩家可随时点击确认，领取该人物本期全部未领奖励；无需恋人身份，领完后继续累积下一期。好感低于70且堕落度低于60时暂锁提款，池不消失。隐藏期间暂停奖励追踪，真实支出仍入账。\n提现倍率由点击前的有效身家（可用现金＋游戏内新购入的自有资产成本）决定：低于1000万元为新晋神豪·十倍；1000万元至不足1亿元为豪门新贵·八倍；1亿元至不足10亿元为资本巨鳄·五倍；10亿元至不足100亿元为云澜大亨·三倍；100亿元及以上为财阀霸主·二倍。每笔先锁原始池与倍率，再入账并刷新等级。\n玩家的一切付款、注资、采购、免债与赠礼均受当前可用现金（user.cashCents）严格制约。user.cashCents代表玩家当前唯一可自由调配的全部流动资金（已包含个人银行卡及名下公司、项目、家族可供玩家支配的流动头寸），名下房产座驾等持有资产在正式变现出售前不能直接当现金刷卡，未提现的奖池也不能提前透支。正文中虽可描写“让公司财务走对公账户／动用专项流水”作为叙事排面，但凡由玩家拍板促成的实际资金支出，一律视作动用user.cashCents并必须提交payer为USER的OUT交易实扣余额；严禁借“公司公账、集团拨款、家族基金或财务走账”名义免扣个人现金或绕过余额上限。若玩家试图支付超出可用现金的款项，剧情必须如实呈现当前可调配流动资金不足（财务或银行提示可用头寸仅余user.cashCents）、改签意向书或仅付可承受范围内的首期定金、或需要先去终端提现奖池／变卖资产筹款的自然过程，绝不凭空垫付或写出超额到账事实。\n赚取的巨额资金不仅可用于日常挥霍与赠礼，更可用于重金破局与版图扩张：全款购置大平层或独栋庄园安置心仪女性入住（金屋藏娇）、盘下她濒临倒闭的店铺、注资入股她的创业公司成为幕后大金主、或是包下私人游艇与顶级会所。商业注资与产业购置统一通过CASH_TRANSACTION配合asset登记入库。"
    },
```

#### 定稿 2：`src/content/protocol.txt` 第 13 行的完整定稿
请将 `src/content/protocol.txt` 第 13 行（即 `CASH_TRANSACTION：...` 这一整行，其余 20 行保持一字不动）完整替换为以下文本（**100% 逐字复制**）：

```text
CASH_TRANSACTION：factId，direction:OUT或IN，amountYuan，payer:OUT固定写USER（IN可写EXTERNAL），completed:true，kind，memo，itemName（商品或服务名），merchantOrPlace（有依据才填），allocations:[{personRef,amountYuan}]。user.cashCents（分）为玩家唯一可调配的全部流动资金池（含个人卡与名下公司/项目/家族可调拨头寸），凡玩家拍板促成的付款、注资、收购、代偿或派单，无论正文表述为个人刷卡还是公司对公账户走账，均必须提交direction:OUT且payer:USER的CASH_TRANSACTION实扣user.cashCents，严禁借公司公账名义不提交易或把payer写成公司免扣！单笔或多笔OUT总额严禁超过user.cashCents；若玩家指令金额超出可用现金，正文中必须如实描写可调拨流动资金不足、改签意向或仅付余额内的首期定金、先行提现奖池或筹款，严禁写出超额已付款或已到账事实，且不提交该笔超额交易。OUT的kind限SHOPPING/DINING/TRAVEL/GIFT/TRANSFER_OUT/PROPERTY_PURCHASE/VEHICLE_PURCHASE；IN限SALARY/BUSINESS_INCOME/OTHER_INCOME/TRANSFER_IN/ASSET_SALE（出售未登记在册的物品获利用OTHER_INCOME，已登记资产出售才用ASSET_SALE并附assetId）。自用购买allocations为空。购买房产、座驾、商铺股权会所产业、游艇专机、名表珠宝奢品或艺术藏品时，必须同时给asset:{assetId,kind:HOUSE|CAR|BUSINESS|YACHT_JET|LUXURY|COLLECTIBLE|OTHER,name,ownerId:USER或受赠女性ID,bookValueYuan,locationNote,description}；不得单独扣款不登记资产，也禁止把type写成ASSET。
```

#### 定稿 3：`src/content/state-context.txt` 第 6 行的完整定稿
请将 `src/content/state-context.txt` 第 6 行（即 `资产列表只列玩家当前仍持有的物品...` 这一整行，其余 8 行保持一字不动）完整替换为以下文本（**100% 逐字复制**）：

```text
资产列表只列玩家当前仍持有的物品，description为已确立的简易设定，正文应按它安排住所、出行、穿戴与使用；不重抽面积、型号或配置。user.cashCents为玩家唯一可调配的全部流动资金（含个人与名下公司公账可调拨头寸），一切由玩家促成的OUT支出（含商业注资与对公打款）均受user.cashCents严格制约并实扣余额，严禁借公司账户名义免扣或透支；超额时正文写可调拨头寸不足、改付定金或先提现筹款，不虚构超额到账。recentFacts列出已记录的factId与类型，交易还附物品、分金额与资产ID；refundOf必须匹配对应原付款，不从ID列表中随意选择。
```

---

### 4.3 核心代码改动细则（供 DSH 精确落地）

#### 1. `src/core/engine.js`（问题 2 结算层收口）
- **位置 1：`applyEvent` -> `case 'CASH_TRANSACTION'`（约第 434–446 行）**：
  - 将第 438 行的 `if(e.direction==='OUT' && e.payer!=='USER')return;` **删除**，替换为：
    ```js
    if(e.direction==='OUT') e.payer='USER';
    ```
  - 效果：任何 `direction: 'OUT'` 的交易（哪怕模型写了 `payer: '晟世资本'` 或 `'COMPANY'`）都会被强制视为 `'USER'` 支出，继续向下执行第 445 行的 `if(e.direction==='OUT')requireRule(s.user.cashCents>=e.amountCents,'INSUFFICIENT_CASH');`！一旦超额（如 100 万现金想付 300 万），直接抛出 `INSUFFICIENT_CASH` 被拦截并产生诊断提示，绝不放行。
- **位置 2：`normalizeEvent`（约第 595–610 行）**：
  - 对所有 `e.type === 'CASH_TRANSACTION'` 且 `(e.direction || 'OUT') === 'OUT'` 的事件，补一句确定性归一化：
    ```js
    if(e.type==='CASH_TRANSACTION' && e.direction==='OUT') e.payer='USER';
    ```

#### 2. `src/runtime/host.js`（问题 1 聊天级操作日志与自动愈合 + 问题 3 建档兜底与取消）
- **新增聊天分支级操作日志存储与愈合函数（约第 25 行 `persistPrefs` 下方）**：
  - `loadOpsLog()`：读取 `win.localStorage.getItem('cj-shenghao:ops:v1:' + branch())`，返回 `{ branchKey: branch(), items: [] }`。
  - `saveOpsLog(items)`：将去重后的操作数组写回 `cj-shenghao:ops:v1:${branch()}`。
  - `applyMissingPlayerOps(state, anchor)`：
    - 遍历 `loadOpsLog().items` 中所有 `opId = cmd.operationId || cmd.value?.operationId` 尚未出现在 `state.operationHistory` 中的命令；
    - 对每条命令在 `try { state = replayPlayerCommand(state, cmd, anchor, schemas()); committed.push(cmd); } catch (err) { ... }` 中执行：
      - 若 `cmd.kind === 'action' && cmd.value.type === 'PLAYER_WITHDRAW'` 且因回退楼层导致奖池缩水/未达标而抛出 `WITHDRAWAL_REVIEW_REQUIRED` 或 `WITHDRAWAL_LOCKED`：将该 `cmd` 从 `opsLog` 中移除（避免后续死循环），并将提示信息 `'因回退楼层包含未确认的入池事件，上一笔提现已退回奖池，可随时重新领取。'` 推入一次性通知 `pendingNotice`。
      - 若 `cmd.kind === 'action' && cmd.value?.personRef && !state.characters[cmd.value.personRef]`（例如该人物是在被删掉的那一楼才初见建档的新人物）：同样安全跳过并从 `opsLog` 移除。
    - 若有成功补齐的 `committed.length > 0`，调用 `refreshContext(state)` 并返回 `{ state, healed: true, notice }`。
- **在 `mutateState`（第 130–142 行）中同步写入 `opsLog`**：
  - 当 `mutateState` 成功写入 `exact.message_id` 的 MVU 变量后，将该 `command` 追加进 `loadOpsLog().items` 并调用 `saveOpsLog`。
- **在 `readCurrent()`（第 35–45 行）与 `VARIABLE_UPDATE_ENDED`（第 88–92 行）中接入 `applyMissingPlayerOps`**：
  - 在 `VARIABLE_UPDATE_ENDED`（第 88–92 行）：不仅读取当前 swipe 的 `cj_native_operations`，还将 `loadOpsLog().items` 合并去重后执行 `applyMissingPlayerOps`，使同一楼层 `/swipe` 切换或重新生成后，建档、日程、打星及合规提现自动重放。
  - 在 `readCurrent()`（第 39–44 行）：当找到最新初始化楼层 `m`（例如刚执行完 `/del 1` 退回上一楼）且 `!busy()` 时，若检测到 `loadOpsLog().items` 中有未包含在 `state.operationHistory` 里的操作，立即调用 `applyMissingPlayerOps(state, anchor)`；若 `healed === true`，自动调用 `native().replaceMvuData(vars, {type:'message', message_id: m.message_id})` 将补齐后的状态持久化到回退后的顶楼！若有 `notice`（如提现因池变退回原池），写入 `api.notice` 供前端 `receive()` 弹出 Toast。
- **在 `generateProfile` 与 `buildProfile`（第 99–155 行）中强化建档容错、事实兜底与取消控制**：
  - 新增模块级变量 `let activeBuildKey = null;`。
  - `generateProfile` 中：`generationWithTimeout(request, { timeoutMs: 90000, stop: () => H.stopGenerationById?.(requestKey) })`；JSON 解析前先用正则提取首尾花括号 `/\{[\s\S]*\}/`，解析失败抛 `new RuleError('INVALID_PROFILE')`。
  - `buildProfile` 中：
    - 记录 `activeBuildKey = 'cj-build-' + crypto.randomUUID()`；
    - 拿到 `completed.profile` 后，执行**脚本确定性事实补齐（Anchor Back-fill）**：
      - 若 `!completed.profile.identity.includes(c.name)`，在句首补 `${c.name}，`；
      - 若 `!completed.profile.identity.includes(String(c.age))`，补 `（${c.age}岁）`；
      - 若 `c.occupation && !completed.profile.identity.includes(c.occupation)`，补 `，现职${c.occupation}`；
      - 若 `c.appearance && !completed.profile.appearance.includes(c.appearance)`，在 `completed.profile.appearance` 句首拼接 `${c.appearance}。` 并截断至 750 字内；
      - 若 `c.body` 或身高体重三围鞋码数字未完整出现在 `completed.profile.body` 中，自动将缺失的设定句与数值汇总（如 `${c.body}（身高${c.heightCm}cm、体重${c.weightKg}kg、三围${c.bustCm}/${c.waistCm}/${c.hipCm}cm、鞋码${c.shoeSizeEu}码）。`）前置拼入 `completed.profile.body` 并截断至 750 字内；
      - 若 `c.personalityTags` 中有标签未出现在 `completed.profile.personality`，将缺失标签以 `性格兼具${missingTags.join('、')}的特质。` 前置拼入 `completed.profile.personality`。
    - 如此一来，第 151–152 行的 `required` 校验将 **100% 稳定通过**，再也不会因为大模型润色了半句话就炸 `PROFILE_FACT_CONFLICT` 丢弃 40 秒的生成结果！
  - 在 `api` 对象新增：
    ```js
    cancelBuildProfile(){if(!activeBuildKey)return false;const k=activeBuildKey;activeBuildKey=null;try{H.stopGenerationById?.(k);}catch{}setupBusy=false;publish();return true;}
    ```

#### 3. `src/ui/app.js`（问题 3 建档进度/取消/错误反馈 + 问题 1 回退 Toast 展示）
- **扩充 `errorText(e)`（第 22 行）**：
  - 新增键值：`INVALID_PROFILE: '模型返回的档案格式有误，请点击重试。'`、`BUILD_CANCELLED: '已取消本次人物建档。'`，并将 `MODEL_TIMEOUT` 文案优化为 `'建档生成超时（已超过90秒），请检查模型连接后重试。'`。
- **改造 `d.buildProfile` 与 `d.confirmBuild`（第 154–155 行）**：
  - 点击 `d.confirmBuild` 时：
    - 锁定模态框不允许通过点击背景遮罩关闭（设置模块变量 `buildingProfile = true`）；
    - 将模态框内的取消按钮设为 `<button class="btn secondary" data-act="cancel-build">中止建档</button>`；
    - 启动每秒更新的计时器 `buildTimer`：更新按钮文字 `正在建档… (${sec}s)`，并在模态框内 `#buildStatusNote` 显示实时提示；
    - 使用显式 `try { ... } catch (err) { ... } finally { ... }`：
      - 成功时：`closeModal(); phone(); notify('九大档案已保存');`
      - `catch (err)` 时：调用 `notify(errorText(err))`，且如果并非用户主动取消（`err?.message !== 'BUILD_CANCELLED'`），**保留模态框打开**，在模态框内 `#buildStatusNote` 渲染红字错误条 `<p class="error-note">${esc(errorText(err))}</p>`，并将确认按钮文字设为 `重试建档`（`b.disabled = false`），方便玩家直接点重试！
  - 在 `switch(a)` 中新增 `case 'cancel-build'`：调用 `api.cancelBuildProfile?.()`，清理计时器，关闭模态框并 `notify('已取消本次人物建档。')`。
- **在 `receive(v)`（第 192–196 行）中消费 `v.notice`**：
  - 若 `v.notice` 非空，自动调用 `notify(v.notice)` 并调用 `api.clearNotice?.()`，确保 `/del 1` 触发提现退回原池时，玩家立即在屏幕上看到清晰的 Toast 说明。

---

## 五、 兼容性影响说明

1. **本项目尚未对玩家发行**（`AGENTS.md` 明确规定：不设旧存档兼容负担）。
2. **对现有测试存档（如 8001 实例 space 3 的 14 楼存档）的实际影响**：
   - **MVU Zod Schema 零破坏**：本方案**完全不改动 `src/runtime/schema.js` 的任何字段结构**（`schemaVersion` 仍为 `3`）。因此，space 3 现有的 14 楼游玩存档无需清空即可直接读取全部 713 个变量字段。
   - **世界书与修订号更新**：由于修改了 `literary.json`、`protocol.txt`、`state-context.txt` 并将 `cardContractRevision` 升至 `25`，`worldbookHash` 会改变。在 8001 实例验收时，需重新导入新构建的 `dist/2.0.0-rc.29-checkpoint/神豪终端.json`（或同步更新绑定的世界书与脚本）。
   - **旧楼层操作日志表现**：已有存档在升级前的历史楼层没有 `localStorage` 里的 `cj-shenghao:ops:v1:` 记录，升级后的一切新提现、新建档、新日程、新打星将立即进入跨楼层保护。

---

## 六、 验证计划（单元测试 + 8001 实机最小复现剧本）

### 6.1 自动化单元测试（`tests/` 新增用例，目标全量 PASS）

在 `tests/` 下新增或扩充以下确定性单测（无需联网）：
1. **问题 1 单测（跨楼层/跨 swipe 玩家操作愈合与提现安全退回）**：
   - **用例 1A（建档/日程/打星跨删楼存活）**：在楼层 2 执行 `PLAYER_BUILD_PROFILE`、添加日程 `appt_1`、打星 `PLAYER_STAR` 写入 `opsLog`；模拟 `/del 1` 退回楼层 1 的初始状态后调用 `applyMissingPlayerOps`，断言九大档案、`appt_1` 和 `starred=true` 全部自动恢复到楼层 1，且 `revision` 正确递增。
   - **用例 1B（非本楼入池的提现跨删楼存活）**：在楼层 2 产生 11 万消费入池（好感 75），楼层 3 为无消费纯闲聊，玩家在楼层 3 点击 `PLAYER_WITHDRAW` 提现 110 万；模拟 `/del 1` 删掉楼层 3 退回楼层 2，断言提现被自动无损重放，`cashCents` 仍为提现后金额。
   - **用例 1C（本楼入池的提现跨删楼安全退回原池并产出 Notice）**：在楼层 2 原有 5 万消费池，楼层 3 新增 10 万消费池（共 15 万），玩家在楼层 3 提现 150 万；模拟 `/del 1` 删掉楼层 3 退回楼层 2（此时池内仅 5 万，不等于 `expectedPoolCents: 15000000`），断言该笔 150 万提现不强行入账（避免刷钱与 `REWARD_CLAIM_MISMATCH`），楼层 2 的 5 万原池完好无损可重新提现，且返回明确的 `notice` 提示文案。
2. **问题 2 单测（公司公账 `payer` 强制归一化与超额拦截）**：
   - **用例 2A（`payer: "COMPANY"` 强制扣减个人现金）**：玩家现金 500 万，模型提交 `{type:'CASH_TRANSACTION', direction:'OUT', payer:'晟世资本对公账户', amountYuan:'300万', kind:'TRANSFER_OUT', completed:true, evidence:'...'}`，断言不再被第 438 行早退跳过，而是强制归一化为 `payer:'USER'` 并实扣 `user.cashCents` 300 万、记入账本！
   - **用例 2B（现金不足时借公司名义支付被 `INSUFFICIENT_CASH` 拦截）**：玩家现金 100 万，模型提交上述 300 万对公交易，断言 `settleNative` 拒绝该笔交易，`diagnostics` 包含 `INSUFFICIENT_CASH`，`user.cashCents` 保持 100 万不变。
3. **问题 3 单测（建档事实锚定补齐与错误码映射）**：
   - **用例 3A（模型润色漏字时脚本自动补齐，不抛 `PROFILE_FACT_CONFLICT`）**：模拟模型返回的 9 段档案中 `body` 漏掉了鞋码 `37`、`appearance` 略改了措辞、`personality` 漏了第 2 个标签，断言脚本自动将缺失事实补入对应段落并通过 `buildProfile` 全套校验。
   - **用例 3B（`errorText` 覆盖全部建档错误码）**：断言 `INVALID_PROFILE`、`BUILD_CANCELLED`、`MODEL_TIMEOUT`、`PROFILE_FACT_CONFLICT` 均返回清晰的中文指引。

### 6.2 8001 酒馆实例最小实机复现剧本（Ego 浏览器）

构建 `node scripts/build.mjs --checkpoint` 并通过 `node scripts/check.mjs --checkpoint` 后，在 8001 实例执行以下 3 步最小剧本：
1. **剧本 1（验证问题 3 建档进度、取消与成功落盘）**：
   - 打开人物详情 ➔ 点击「建档」➔ 点击「确认建档」；
   - 观察按钮是否实时跳秒 `正在建档… (1s/2s...)` 且左侧出现「中止建档」；
   - 先点一次「中止建档」，验证立即停止并弹出 Toast `已取消本次人物建档。`；
   - 再次点击「确认建档」等待完成，验证 9 段档案完整生成且零 `PROFILE_FACT_CONFLICT` 误杀。
2. **剧本 2（验证问题 1 删楼/换 swipe 不丢建档与提现）**：
   - 在当前最新楼层完成一次「建档」与一次「奖池提现」（或添加一条日程）；
   - 执行 `/del 1` 删除最后一条 AI 回复（或执行 `/swipe` 切换分支）；
   - 检查小手机面板：确认刚生成的**九大档案、日程依然完好保留**；若被删楼层未改变奖池基数，**提现后的现金与提现记录同样完好保留**；若被删楼层恰好包含刚才入池的那笔消费，确认屏幕弹出 Toast 提示且原池金额完好待领。
3. **剧本 3（验证问题 2 公司公账超额付款被硬约束拦住）**：
   - 在玩家现金为 ¥890,000（89 万）的状态下，发送玩家指令：`“我现在就跟顾星遥签那份300万的全款注资合同，走我们晟世资本的对公账户，让财务今天下午直接把三百万全款打过去！”`
   - 观察 AI 回复正文与变量结算：确认模型在正文中写出「财务核对后汇报目前可调拨流动头寸仅余 89 万，无法直接划拨 300 万全款，建议先付 80 万首期款或等你从其他渠道调集资金」，或者若模型强行提交 300 万 `CASH_TRANSACTION`，确认脚本将其拦截并报错 `可用现金不足（INSUFFICIENT_CASH）`，绝不出现“正文三百万全款到账且不扣一分钱”的无限资金漏洞。

---

## 七、 风险与代价评估

| 维度 | 问题 1（UI 操作跨回退保留） | 问题 2（封堵公司账户无限资金通道） | 问题 3（建档事实兜底与进度/错误反馈） |
| :--- | :--- | :--- | :--- |
| **不做会怎样** | 玩家耗费 40 秒且消耗数千 Token 生成的九大档案、或刚领到的百万提现，会因为一次随手 `/del 1` 或 `/swipe` 重 roll 正文而瞬间清零且毫无提示，挫败感极强。 | 任何带“总裁/合伙人/富二代”头衔的开局，玩家只需一句“走公司公账/让家族财务付”就能在 0 现金下无限刷几千万排面与女主暴击奖池，彻底击穿神豪经济闭环。 | 模型偶发润色漏掉一个三围数字或鞋码就会触发 `PROFILE_FACT_CONFLICT` 废掉整份档案，且超时/报错时玩家面对死板按钮毫无头绪，误以为卡死。 |
| **做了可能引入什么新问题及防范措施** | **潜在风险**：若玩家开启全新聊天或跨分支回退太远，旧 `opsLog` 可能残留。<br>**防范**：`opsLog` 严格以 `branch()`（`characterId:chatId`）加 `state.meta.initKey` 双重隔离；新开局 `initKey` 变化时自动清空旧日志，且单条重放包在独立 `try/catch` 内，绝不污染主状态。 | **潜在风险**：部分习惯口嗨“公司公账有几个亿”的玩家会发现模型开始如实提醒流动头寸只有 `user.cashCents`。<br>**防范**：世界书中明确允许保留“让财务走公账”的叙事排面（只要金额在 `user.cashCents` 以内即可正常公账支付并实扣），只拦截超出 `user.cashCents` 的空手套白狼，兼顾总裁排面与数值硬核。 | **潜在风险**：脚本自动前置补齐缺失数字时，若拼接生硬可能影响文风。<br>**防范**：仅当模型未按要求写出某项硬事实时才触发括号或短句补齐，模型正常输出时原样保留。 |
