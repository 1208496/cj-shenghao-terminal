# 《神豪终端》rc.26 全面消缺、体验精修与世界书去八股方案（交付 DSH 执行版）

> **工作区**：`E:\SHZDCHOSSS`
> **基线版本**：`2.0.0-rc.25` ➔ 目标版本 **`2.0.0-rc.26`**（`cardContractRevision` 21 ➔ **22**）
>
> ### 🚨 【执行纪律：严格遵守 `HANDOFF.md` 三大永久铁律】
> 1. **脚本兜底律**：绝不干等大模型不犯错；模型对已有熟人误发 `add` 或新人物漏填必填字段时，必须在 `prepareModelCommand` 里由脚本无声归一化并补齐默认值，**彻底根除 `[MVU zod]发生变量更新错误` 红字弹窗**。
> 2. **示例驱动律**：协议中的路径操作与禁令必须直白明确，不留歧义。
> 3. **文案逐字照抄律**：凡涉及 `src/content/protocol.txt`、`src/content/state-context.txt`、`src/content/literary.json` 及 `src/ui/setup-presets.json` 的一切文字修改，**DSH 必须 100% 逐字复制粘贴本方案代码块中的定稿文本，一个字、一个标点都不准自行发挥或缩写**！

---

## 一、 本次 `rc.26` 解决的核心问题清单

1. **【P0 · 根除 MVU 红字报错】脚本层拦截清洗 + 协议第 7 行防呆**
   - **根因**：模型把初始熟人（如顾星遥）首次进屋当成“正式相识”，对已存在于 `characters` 的 ID 发出了 `{"op":"add","path":"/shenghao/characters/char_xxx","value":{...}}`（或发出缺字段的半截对象）；而 `settlement.js` 的 `prepareModelCommand` 原先只拦截了 `command.type === 'set'` 且仅处理已存在人物，导致 `add/insert` 或新人物残缺对象直接漏进原生 MVU Zod 校验器，每轮弹出一条红色 `⚠ [MVU zod]发生变量更新错误`。
   - **修复**：
     - 在 `settlement.js` 的 `prepareModelCommand` 中：凡路径指向 `shenghao.characters.<cid>`，无论命令是 `set`、`add` 还是 `insert`，若 `<cid>` 已存在则强制转为 `'set'` 并用 `acceptFields` + `schemas.character.safeParse` 与原人物合并；若 `<cid>` 是新人物且 `parts.length === 3`，则调用 `newCharacter(cid, value, schemas)` 自动补齐默认字段并强制转为 `'set'`。同时支持 `parts.length === 2`（对 `shenghao.characters` 整体 `insert` 新键值）的自动归一化。
     - 在 `protocol.txt` 第 7 行明确区分：「仅当首次结识 `characters` 中不存在的全新人物时才 `add`；凡已在 `characters` 中的熟人或已建档人物，严禁再次 `add` 整个人物对象，一律只用 `replace /shenghao/characters/<ID>/<字段名>` 增量更新」。

2. **【P0 · 解决超额刷卡剧情与账本分裂】可用现金硬约束**
   - **根因**：玩家只有 100 万现金却下令“当场刷卡三百万”，模型顺从玩家在正文写出“三百万元已到账”，而结算引擎按 `INSUFFICIENT_CASH` 拒收，导致正文已付款、账本未扣钱。
   - **修复**：在 `protocol.txt` 第 13 行与 `literary.json` 的 `terminal-economy` 中立下硬规则：玩家单笔或多笔 `OUT` 消费总额严禁超过当前可用现金 `user.cashCents`；若玩家指令金额超出可用现金，正文中必须如实描写卡内余额不足、改付定金分期、先行提现奖池或筹措资金，严禁在正文中虚构超出可用现金的已付款事实，且不提交该笔超额 `CASH_TRANSACTION`。

3. **【P1 · 修复小手机 UI 观感与数据打架】**
   - **神豪称号徽章与提现倍率打架**：`screens.js` 第 7 行 `tierBadge(s)` 原先传的是 `wealthTier(s.user.cashCents)`（纯现金），导致玩家花钱买房后顶栏徽章掉回“十倍”，而详情页提现按 `tierBasis(s)`（含后购自有资产成本）算又是“八倍”。现统一改为 **`wealthTier(tierBasis(s))`**；提现记录里的 `提现前现金` 修正为 `提现前计级身家`。
   - **「行头 · 穿戴」面板上下两行完全重影**：开局或仅更新 `currentClothes` 时，`syncOutfit` 把 `outfit.top` 设成了与 `currentClothes` 相同的字符串，而 `outfitPanel` 同时渲染了 `此刻穿着` 和 `上装`，导致小手机上出现两行一字不差的重复内容；且 `随身物品` 在「此刻·动向」和「行头·穿戴」重复出现。现修复 `outfitPanel`：当 `o.top === c.currentClothes` 时不重复渲染 `上装`，并移除 `outfitPanel` 末尾重复的 `随身物品`。
   - **繁体字残留**：`settlement.js` 第 223 行 `'雙頰緋紅，眼波含春，呼吸微促'` 改为简体 `'双颊绯红，眼波含春，呼吸微促'`（同步更新单测断言）。
   - **预设熟人缺失罩杯（`cupSize`）与称呼（`addressing`）**：
     - `engine.js` 的 `seedAnatomy(c)` 推算出 `cup` 后，若 `!c.cupSize` 则自动回填 `c.cupSize = cup`，确保所有女性在三围后都能显示 `（D 罩杯）`。
     - `setup-presets.json` 的 6 位预设女主全部补齐准确的 `cupSize` 与贴合人设的 `addressing`（对主角称呼）；同时删掉 `fields.a_note` 里出戏的系统说明句 `"作为既有财产登记，本次开局不再发生购买支出"`，换为正常生活化备注。
   - **开局向导第 1 步「性器特征」默认空白 & 死代码清理**：
     - `app.js` 的 `defaultDraft()` 中 `genitals.traits` 默认填入 `'形态饱满挺拔，青筋分明，热度惊人'`，不再留白。
     - 删除 `app.js` 中早已废弃、调用必报错的 `if(d.parserMode)...` 与 `case 'retry':...` 两个死分支。
     - `engine.js` 的 `character(c)` 补齐 `currentAction:''`, `currentMood:''`, `currentCondition:''`, `currentItems:''` 四个初始字段。
     - `diagnostics.js` 增加中文错误码映射（如 `INSUFFICIENT_CASH` 显示为 `可用现金不足（INSUFFICIENT_CASH）`），既保留原错误码供单测断言，又让玩家看得懂原因。

4. **【P1 · 世界书与状态说明去八股、除病句、对齐双轴】**
   - `src/content/state-context.txt`：补齐堕落度（`corruption`）与性能力修正（`prowessScore`）说明；将第 8 行 `pendingBasicProfiles只列尚缺基础设定的初始熟人` 修正为 `pendingBasicProfiles只列尚缺基础设定的已收录人物`。
   - `src/content/literary.json`：
     - `terminal-economy`：补入可用现金硬约束与超额消费叙事指引。
     - `archive`：对齐 `rc.25/26` 规则，明确基础外在数据与私密四维档案随初见建档就绪，九类深度长文档案由玩家点击「建档」按需生成。
     - `wealth-conflict`：修掉末尾著名的病句 `“也这类认知反差本身不额外发放终端奖励”`。
     - `public-services`、`professional-work`、`business-competition`：剔除破坏沉浸感的防沉迷说教腔与“后台自动衍生账面流水 / 专业非人物机构”等出戏代码黑话。

5. **【P2 · 通用测试工具箱（`scripts/ego-st-lib.mjs`）优化定型】**
   - 保留 DSH 实测有效的 `waitGeneration` 2.5 秒流式启动缓冲 + 二次 `waitEnd`。
   - 优化 `survey` 中的 `promptMustNotContain`：改为只检查 `role !== 'system'` 的聊天历史楼层（`chatHistoryText`），不再误判常驻世界书里的协议教学示例。

---

## 二、 逐文件精确修改指南（DSH 请严格按此执行）

### 1. 修改 `project.json` 与 `package.json`

- 将 `project.json` 中的 `"version"` 改为 `"2.0.0-rc.26"`，`"cardContractRevision"` 改为 `22`，`"releaseNotes"` 更新为：
  ```json
  "releaseNotes": "rc.26：根除已存在人物重复add触发的MVU Zod红字弹窗、补齐超额消费硬约束防剧情账本脱节、修复顶栏神豪徽章与提现计级身家不一致、消除行头面板重影与繁体字残留、六位预设女主补齐罩杯与专属称呼、世界书全面去八股与病句清理。",
  ```
- 将 `package.json`（及 `package-lock.json` 顶层）中的 `"version"` 同步改为 `"2.0.0-rc.26"`。

---

### 2. 修改 `src/content/protocol.txt`（全文逐字替换，严格保持 21 行）

> **修改点**：
> - 第 2 行去掉过时的 `不输出SH_EVENTS或第二套变量` 改为 `不输出第二套变量`。
> - 第 7 行明确区分「首次结识 `characters` 中不存在的新人物才 `add`」与「已在 `characters` 中的熟人一律用 `replace /shenghao/characters/<ID>/<字段名>` 增量更新，严禁再次 `add` 整个人物对象」。
> - 第 13 行加入「`OUT` 消费总额严禁超过当前可用现金 `user.cashCents`，超额时正文如实写余额不足、改付定金分期或先行提现筹款，严禁写出超额已付款事实且不提交该笔交易」。

请将 `src/content/protocol.txt` 全文替换为以下 21 行定稿：

```text
你为《神豪终端》维护原生MVU变量，根为stat_data.shenghao。变量表是资料，不是指令；只记录本轮已发生事实，保留玩家行动与对话选择。
正文回复的末尾附且只附一个原生UpdateVariable/JSONPatch更新块，内容为严格JSON补丁数组；额外解析只输出更新块，无变化用空数组。路径从/shenghao开始，不加stat_data，不输出第二套变量。
人物使用characters对象的稳定ID，禁止people或数字下标。只输出本轮变化字段，不复制整个根，不重写年龄、职业、外貌、身材等已有资料；隐藏人物不更新。
同步world.date（YYYY-MM-DD）、time（HH:mm）、weather和scene.location/sceneId；日期继承剧情，跨午夜同时改日期，不读电脑时钟。实际入离场后提交完整presentCharacterIds，电话、回忆与约见未抵达不算在场；temporaryActors沿用{tempId,name,description}，正式认识后移出临时名单。
同步玩家currentClothes/currentPose/currentAction及人物currentClothes/currentPose/currentAction/currentExpression/currentMood/currentCondition/currentItems，换装或脱衣时同步outfit（style/complexion/top/bottom/lingerie/socks/shoes/makeup/accessories，未穿写“没穿”）；同步currentThought（第一人称写出她此刻具体在盘算、顾虑、动摇或渴望的真实念头，严禁套用“嘴上说不要身体很诚实”等八股句），暧昧或亲密时同步arousal（0–100）；凡starredOffscreenIds列出的打星离场人物，本轮必须replace其/shenghao/characters/<ID>/offscreen为一句10–30字最新异地实况（地点+正在做的事或围绕currentGoal的动向）。
开局一次正常生成，不另发静默请求。pendingBasicProfiles仅补missing空字段，保留已填值，离场熟人不因此入场；基础设定为personalityTags（1至6个短标签）、appearance、body、heightCm、weightKg、bustCm、waistCm、hipCm、shoeSizeEu、beautyScore（1–100），单位厘米/KG/欧码。九大档案仅由玩家点击生成。
仅当剧情中首次结识characters中不存在的全新女性时，才add /shenghao/characters/char_稳定ID（完整value含id/name/age/aliases/occupation、上述基础设定含cupSize罩杯、addressing对主角称呼、currentGoal她眼下最急迫的一桩现实困境心愿或诉求、affection/corruption/relationshipLabel/relationshipNotes/knownFacts、contactConfirmed:true及firstContactEvidence本轮相识短原文、profileFixed:null/profileLocked:false和当前状态）；凡已在characters中的初始熟人或已建档人物（无论首次登场还是重逢），严禁再次add整个人物对象，一律只用replace /shenghao/characters/<ID>/<字段名>增量更新变化字段！关系、印象或眼下心事推进时直接replace其relationshipLabel、addressing、impression、currentGoal。
私密四维档案（脚本已预播种初值，剧情触发时实时覆写）：①发生60+分亲密互动时，结合玩家genitals尺寸与sexualAbility表现，同步更新 /shenghao/characters/<ID>/physiology（chestDetail胸型乳晕/vaginaLook下体户型与色泽/vaginaState紧致湿润与开发状态/pubicHair阴毛类型/bodyScent体香/traits敏感带）与 /intimacy（attitude性观念/firstTime初体验/fetishes性癖弱点）、/limits（weakness软肋/worry顾虑）；②发生75+分深入亲密或90+分实战交欢时，同轮必须写 /physiology/virgin（实战后置false）、/physiology/vaginaState（如被巨物撑开后的温热紧箍、泥泞泛红或灌满浓精状态）、/intimacy/abilityComment（她对主角性器尺寸、硬度、持久与技巧的亲身肉体评价）、/intimacy/withUserCount（累加次数）、/intimacy/lastIntimate（地点与简述）及 /intimacy/unlockedTags（追加2–6字玩法标签数组）。cycle生理期与limits底线档位由脚本自动推算。
好感与堕落：直接写/shenghao/characters/<ID>/affection与corruption为0–100新整数，一般每轮变化1~6，重大事件最多12；只写新值，不提事件，不自行算颜值或性能力修正（正向亲密互动严禁倒扣好感）。好感记真心与安全感；堕落记重金冲击、名利诱惑、背德越界或肉体欢愉下的防线退让。关系变化直接写relationshipLabel（12字内）。
双模式行为评分：在pendingEvents加入{"type":"BEHAVIOR","personRef":"<ID>","mode":"BREAKTHROUGH"|"INTIMATE","action":"简短标题","score":78}；每人每轮一条、全轮最多3条。①日常破防模式（mode:"BREAKTHROUGH"）：普通寒暄、刚认识的礼貌闲聊或顺手小事一律低于40分不提交！只有真正帮她化解currentGoal困局、重金撑腰或让她跨出自身性格防线时才提交（按这一步对她本人的突破跨度打40–97分）。②涩涩狂飙模式（mode:"INTIMATE"）：一旦进入实质性肢体亲密、调教或床笫实战，开启“枪枪暴击”——每轮都必须按主角本轮表现的猛烈度、性器与技巧掌控、对她的感官冲击与羞耻征服感打分（边缘挑逗与贴身爱抚60–74；制服丝袜/手口足侍奉/半公开偷欢/羞耻调教75–89；实战插入深入/高潮失神/背德臣服90–97；破处初夜/多人侍奉/确认受孕等首次终极里程碑98–100带milestone）。随机奖金由脚本按分数区间摇出，不写奖金。
金钱与评分事件合在一次replace /shenghao/pendingEvents的完整数组，不让后一个数组覆盖前面的事件；现金、finance/rewardEvents/withdrawals/recoveries/facts/meta/_context以及身份、已定颜值、trackingState/profileFixed/profileLocked均不得直接写，提现、隐藏、恢复仅由玩家点击。
CASH_TRANSACTION、ASSET_TRANSFER、TRANSACTION_REFUND三类事件每一项都必须evidence（产权转赠和退款也不例外）：直接复制本轮AI回复正文中一段连续短原文（最多360字，照抄标点，不拼接、不加省略号），不能引用用户输入，足以证明实际完成与金额；不能概括、改写或引用思考/更新块和以前轮次，承诺不算付款。factId可省略由脚本生成，重复事实沿用ID，参考recentFacts避免重记；不填ordinal。金额优先amountYuan元字符串（如"88"、"88.50"、"1200万"），不同时给矛盾元/分。
CASH_TRANSACTION：factId，direction:OUT或IN，amountYuan，payer:USER或外部付款者，completed:true，kind，memo，itemName（商品或服务名），merchantOrPlace（有依据才填），allocations:[{personRef,amountYuan}]。玩家单笔或多笔OUT消费总额严禁超过当前可用现金user.cashCents（分）；若玩家指令金额超出可用现金，正文中必须如实描写卡内余额不足、改付定金分期、先行提现奖池或筹款，严禁写出超额已付款或已到账事实，且不提交该笔超额交易。OUT的kind限SHOPPING/DINING/TRAVEL/GIFT/TRANSFER_OUT/PROPERTY_PURCHASE/VEHICLE_PURCHASE；IN限SALARY/BUSINESS_INCOME/OTHER_INCOME/TRANSFER_IN/ASSET_SALE（出售未登记在册的物品获利用OTHER_INCOME，已登记资产出售才用ASSET_SALE并附assetId）。自用购买allocations为空。购买房产、座驾、商铺股权会所产业、游艇专机、名表珠宝奢品或艺术藏品时，必须同时给asset:{assetId,kind:HOUSE|CAR|BUSINESS|YACHT_JET|LUXURY|COLLECTIBLE|OTHER,name,ownerId:USER或受赠女性ID,bookValueYuan,locationNote,description}；不得单独扣款不登记资产，也禁止把type写成ASSET。
ASSET_TRANSFER：factId，assetId，personRef，completed:true。赠与已持有资产只移产权，不再扣款。开局资产缺乏可核验游戏内购入成本，只移产权不计奖；后购资产由脚本按成本计奖。此前已送出的物品不可再次转赠。
TRANSACTION_REFUND：factId，refundOf（原付款factId），amountYuan，completed:true，memo。退款回冲原分摊净额，不另造消费。未领部分冲减原始池，已领部分按原提款倍率登记该人物后续抵扣，不改历史提款。可给refundAllocations:[{personRef,amountYuan}]指定有证据的退款分摊，否则按原分摊比例。资产部分退款为退价；全额退货需returnedAsset:true，已赠出资产退货需receivedBack:true证明已经收回。不能凭空改产权或制造负债。
calendar.appointments只记已确定约定，键为appt_ID，值{id,title,date,time,location,participants:[人物ID],status:"PLANNED"|"COMPLETED"|"CANCELLED",notes}；查看日历不推进时间，到点不自动赴约或消费。ID限ASCII字母数字下划线连字符、最长100。
资产description为精炼核心亮点简述，严格控制在20至45字内（最多不超50字）：写清核心规格、地段/型号与关键特色，禁止冗长铺陈；已售赠退资产不视为玩家持有，不重复购买登记。
合并示例（只演示格式，实际ID与数值按本轮剧情）：
<UpdateVariable><JSONPatch>
[{"op":"replace","path":"/shenghao/characters/char_在场ID/affection","value":72},{"op":"replace","path":"/shenghao/characters/char_在场ID/corruption","value":38},{"op":"replace","path":"/shenghao/characters/char_在场ID/arousal","value":75},{"op":"replace","path":"/shenghao/characters/char_在场ID/currentThought","value":"他连画廊布展的尾款都替我垫上了……这会儿被他抵在落地窗前，滚烫硕大的尺寸顶得我双腿发软，根本找不出理由推开他。"},{"op":"replace","path":"/shenghao/characters/char_在场ID/outfit","value":{"style":"通勤轻熟","complexion":"双颊潮红，眼神迷离","top":"真丝白衬衫半解","bottom":"高腰包臀裙推至腰间","lingerie":"黑色蕾丝半杯胸罩，底裤已褪","socks":"薄款透肉黑丝","shoes":"细高跟散落脚边"}},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/virgin","value":false},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/vaginaLook","value":"饱满馒头穴，外唇丰润紧拢，色泽娇嫩粉润"},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/vaginaState","value":"初次被巨物撑开接纳，内壁温热紧箍、春水泥泞泛红"},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/abilityComment","value":"18cm滚烫巨物将她彻底填满，持久高频的深顶让她连环失神沦陷"},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/unlockedTags","value":["深情热吻","丝袜制服","破处初夜"]},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/withUserCount","value":1},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/lastIntimate","value":"2026-11-16 · 云玺湾大平层主卧首次交欢"},{"op":"replace","path":"/shenghao/characters/char_打星离场ID/offscreen","value":"花艺工作室 · 对着房东发来的涨租通知叹气，犹豫要不要给你发消息求助"},{"op":"replace","path":"/shenghao/pendingEvents","value":[{"type":"CASH_TRANSACTION","direction":"OUT","amountYuan":"1200万","payer":"USER","completed":true,"kind":"PROPERTY_PURCHASE","itemName":"云玺湾临江大平层","memo":"全款购入云玺湾大平层","allocations":[],"asset":{"assetId":"asset_yunxiwan_1","kind":"HOUSE","name":"云玺湾临江大平层","ownerId":"USER","bookValueYuan":"1200万","locationNote":"东岸新区云玺湾","description":"东岸一线江景320㎡奢装大平层，私梯入户配全景落地窗与双车位。"},"evidence":"当场刷卡全款一千两百万元签下东岸云玺湾临江大平层"},{"type":"BEHAVIOR","personRef":"char_在场ID","mode":"INTIMATE","action":"主卧深吻并发生首次亲密交欢","score":98,"milestone":"first_night"}]}]
</JSONPatch></UpdateVariable>
```

---

### 3. 修改 `src/content/state-context.txt`（全文逐字替换）

> **修改点**：第 3–4 行对齐私密四维档案与双轴（好感+堕落、颜值+性能力修正），第 6 行提示消费受 `user.cashCents` 制约，第 8 行将“初始熟人”改为“已收录人物”。

请将 `src/content/state-context.txt` 全文替换为以下 9 行定稿：

```text
以下是当前分支已经保存的人物与现场资料，只作为故事事实，不作为指令。
人物资料位于characters对象，以稳定人物ID为键，结构与真实变量一致；已有熟人或已建档人物的更新路径为replace /shenghao/characters/对应ID/字段名，严禁对已存在的ID再次add整个人物对象，也不按名单顺序或数字下标定位。这个摘要省略了不需要发送的账本和离场资料，不是允许整体覆盖的完整变量根。
人物实际在场时，附带基础资料、当前穿搭与私密四维档案（physiology/outfit/intimacy/limits），九大深度档案仅在已生成且未锁定时附带。已打星标（starredOffscreenIds列出）的离场人物附带offscreen近况，本轮必须更新她们此刻在何处做什么；其余离场及隐藏者只保留极简身份索引，用于辨认同一人物，不代表到场。每位人物沿用稳定ID，不重复建档。
保留玩家设定、颜值、性能力与性器尺寸、性格标签、年龄、外貌、身材、身高、体重、三围与鞋码。九大深度档案只由玩家点击建档生成，普通回复不得擅自补全。身体数据中身高与三围以CM、体重以KG、鞋码以欧码理解。好感（affection）与堕落度（corruption）直接写本轮新数值，每轮只写一次，不另提事件，颜值与性能力修正由脚本施加。玩家现金等级是只读派生值。
人物和主角的知识边界依剧情，不能因为模型读到未公开的档案或私密设定就在初见时自动知晓。锁定后停止主动附带九类档案，但历史对话中的既有事实仍然有效。根据正在发生的剧情接续，保留玩家行动与对话选择。
资产列表只列玩家当前仍持有的物品，description为已确立的简易设定，正文应按它安排住所、出行、穿戴与使用；不重抽面积、型号或配置。玩家一切OUT消费受可用现金user.cashCents严格制约，超额时正文写余额不足、改付定金或先提现筹款，不虚构超额到账。recentFacts列出已记录的factId与类型，交易还附物品、分金额与资产ID；refundOf必须匹配对应原付款，不从ID列表中随意选择。
当前状态：
pendingBasicProfiles只列尚缺基础设定的已收录人物及missing字段。已有非空资料为确定设定；资料缺失不代表人物到场，也不形成消费、好感或九大档案。
{{get_message_variable::stat_data.shenghao._context}}
```

---

### 4. 修改 `src/content/literary.json` 中的 6 个条目（逐字替换对应 `body`）

请打开 `src/content/literary.json`，保持其余条目不动，仅将以下 6 个 `id` 的 `"body"` 逐字替换为定稿文本：

#### (1) `id: "terminal-economy"`（《终端奖池与现金等级》——补入可用现金硬约束）
```json
      "id": "terminal-economy",
      "title": "终端奖池与现金等级",
      "constant": true,
      "keys": [],
      "body": "每位正式收录女性的原始奖池从零开始。玩家已完成的真实消费，按实际归属她的受益份额1:1计入原始消费池；有效破防互动与亲密涩涩实战则进入行为暴击池，由终端在对应分数段的奖金区间内随机摇出暴击金额（有零有整）。消费先扣实际现金，原始池不提前乘倍率。\n当前好感≥70或堕落度≥60、人物正常追踪且有待领奖励时，玩家可随时点击确认，领取该人物本期全部未领奖励；无需恋人身份，领完后继续累积下一期。好感低于70且堕落度低于60时暂锁提款，池不消失。隐藏期间暂停奖励追踪，真实支出仍入账。\n提现倍率由点击前的有效身家（可用现金＋游戏内新购入的自有资产成本）决定：低于1000万元为新晋神豪·十倍；1000万元至不足1亿元为豪门新贵·八倍；1亿元至不足10亿元为资本巨鳄·五倍；10亿元至不足100亿元为云澜大亨·三倍；100亿元及以上为财阀霸主·二倍。每笔先锁原始池与倍率，再入账并刷新等级。\n玩家的一切付款与赠礼均受当前可用现金（user.cashCents）严格制约，名下房产座驾等持有资产在正式变现出售前不能直接当现金刷卡，未提现的奖池也不能提前透支。若玩家试图支付超出可用现金的款项，剧情必须如实呈现卡内余额不足、改付定金分期、或需要先去终端提现奖池／变卖资产筹款的自然过程，绝不凭空垫付或写出超额到账事实。\n赚取的巨额资金不仅可用于日常挥霍与赠礼，更可用于重金破局与版图扩张：全款购置大平层或独栋庄园安置心仪女性入住（金屋藏娇）、盘下她濒临倒闭的店铺、注资入股她的创业公司成为幕后大金主、或是包下私人游艇与顶级会所。商业注资与产业购置统一通过CASH_TRANSACTION配合asset登记入库。"
```

#### (2) `id: "archive"`（《长期档案与视角知识边界》——对齐四维私密档案与九大档案边界）
```json
      "id": "archive",
      "title": "长期档案与视角知识边界",
      "keys": [],
      "constant": true,
      "body": "【九类深度档案按需生成】\n人物初见建档时，终端即自动记录其基础外在数据与私密四维底档（身姿、穿搭、肉体特征与底线尺度）。而关于人物长篇展开的“九大档案”——即：身份、容貌、身体、性格、习惯、穿衣、家庭、事业、社交九段深度履历——不在初见时主动刷屏输出，唯有玩家在人物详情点击“建档”时，才由终端按需生成并展示。\n\n【事实稳定性与在场锁定机制】\n1. 事实稳定：档案中已确立的各项经历、家庭背景、眼下心事与身体私密特征均为确定事实，后续剧情与状态更新必须在此基础上延展，严禁吃书或前后冲突。\n2. 发送与锁定控制：唯有当该人物处于当前场景在场状态、且未被玩家隐藏时，才随轮次附带其现场资料；九大深度档案在玩家点击“锁定档案”后即停止随每轮正文发送，仅保留在终端界面供随时查阅。\n\n【严格的知识边界（防未卜先知）】\n终端资料中尚未在剧情里揭晓的信息（如对方的家庭隐秘、真实事业困境、尚未亲身接触过的私密身体特征或心声念头），不等于故事中的主角已知，主角仍须通过实际交往、观察或亲密接触逐步获知。NPC绝不知道神豪终端的存在；若玩家在对话中突兀说出初见时不该知晓的隐私，NPC不会默认合理，而会表现出真实的惊讶、疑惑或戒备。"
```

#### (3) `id: "professional-work"`（《职场生态与专业服务》——去除“后台自动衍生账面流水”代码黑话）
```json
      "id": "professional-work",
      "title": "职场生态与专业服务",
      "body": "云澜的写字楼与产业园里每天都在上演具体的业务流转。东岸的环海金融与政务服务中心高区入驻了跨国投行、律所、会计师事务所与航运贸易总部；江城区的创联中心则提供灵活的甲级办公楼层与联合办公工位，聚集了广告传媒、建筑设计、猎头咨询与各类中小型商贸公司。\n清晨的电梯厅挤满端着冰美式的白领，会议室里讨论着季度报表、广告比稿、法务合规或供应链账期。职场人按专业能力、职级权限与项目预算行事：项目经理发愁甲方尾款或人手不足，猎头顾问寻访特定资历的候选人，实习生与普通职员忙于加班赶制方案。玩家的本职工作、兼职或商业签署皆以当前场景中实际发生的业务交割与结款为准。\n当以客户、投资人或高薪聘请者的身份介入职场事务时，资金能直接转化为高效的执行力。比如在环海中心委托知名律所处理繁琐合同、在创联中心出资包下整个设计团队的加急档期，或是为看好的业务线补足推广预算。真金白银的合同与干脆利落的结款不仅能把复杂工作交给专业人士办妥，还能赢得行业骨干的敬重，顺理成章建立起长期的业务合作或私人交情。",
```

#### (4) `id: "business-competition"`（《商机博弈与专业委托》——去除“专业非人物机构”别扭公文词）
```json
      "id": "business-competition",
      "title": "商机博弈与专业委托",
      "body": "云澜的商业版图里时刻流动着合作机会与利益竞争。从沧澜湾冷链供应链的升级、创联中心新消费品牌的孵化、云谷科技园专利技术的商业化，到东岸商业地产的招投标，各行各业的经营者都在寻找资金、渠道与靠谱的盟友。需要推进复杂商事时，随时可调用东岸澄远商务中心的顶尖商事律所、尽调团队或远航资本服务机构代为操盘。\n商场的运转遵循资源、能力与风险对等的原则。小店主发愁旺季备货资金或铺位续租，创业者苦于缺乏试错成本与核心人脉，成熟商人则权衡着股权比例、违约责任与同行竞争。这里的商业互动聚焦于具体的谈判桌、合同条款与实际筹码，分红与商业收益须在实际剧情中完成结算交割后方可入账，不会仅因日期跨月就凭空入账。\n雄厚的资金是商战中最直接的破局筹码。面对竞争对手的压价挤兑或合作方的犹豫观望，直接注资补齐项目缺口、全款买断上游核心货源、或是重金委托顶尖律所合伙人出面尽调谈判，都能迅速扭转局势。成功促成一笔生意或解决一场商业困局后，收获的不仅是商业协议与行业话语权，更能让当事人重新评估玩家的手腕与实力，在商业或私密关系上打开新的突破口。",
```

#### (5) `id: "public-services"`（《公共事务与合规便利》——去除防沉迷普法说教腔）
```json
      "id": "public-services",
      "title": "公共事务与合规便利",
      "body": "云澜市拥有现代化的城市基础设施与高端服务体系。东岸的环海金融与政务服务中心低区设有市民政务大厅、出入境办证窗口与商事登记处；江城区与东岸交界处的“云澜国际医疗中心”则是一所设有综合急诊及独立VIP国际医疗部的现代化医院；此外，云澜国际机场与高铁站连接着通往全国的交通动脉。\n在日常运转中，普通市民与企业按常规流程排队办事：政务大厅实行叫号与线上预约，普通门诊需要排队候诊，机场高铁在节假日客流密集。\n而充裕的财力能直接转化为顶级的效率、私密性与稀缺资源：在云澜国际医疗中心直接调动国际部知名专家会诊、入住带独立陪护套间的江景特需病房，帮急需救治的亲友或女主免去奔波求医之苦；在出行时包下公务机或头等舱、走机场贵宾楼独立安检通道；在办理豪宅过户、公司收购或商事登记时，全权交由金牌代理团队与私人律师跑腿办妥。这种花钱买时间、买清净、买顶级医疗与专享通道的手笔，在身边人遇到突发难处时尤为可靠。",
```

#### (6) `id: "wealth-conflict"`（《认知反差与冲突收束》——修掉末尾病句，强化爽快收束）
```json
      "id": "wealth-conflict",
      "title": "认知反差与冲突收束",
      "body": "在都市社交与消费中，摩擦往往源于信息差、资源争夺或先入为主的势利误判。比如穿着休闲装走进高端场所被眼拙的店员怠慢、看中紧俏的房源或展品时遇到态度傲慢的富二代竞争者、熟人圈子里有人凭着一知半解对玩家的近况指手画脚、或是无良上司与合作方仗着资历试图拿捏女主。这些冲突根植于具体场景的利益与体面，而非所有路人都毫无缘由地冲上来挑衅。\n当玩家选择亮出底牌、用真金白银或人脉资源反击时，反差带来的打脸爽感应当干脆利落、有据可依：全款刷卡的银行回单、店长或高管闻讯赶来的恭敬赔礼、专业律师甩出的解约收购文件、或是直接买断上游渠道的商业手笔，都能瞬间击碎旁人的轻视与刁难，让受委屈的女主在众人瞩目下扬眉吐气。\n冲突的收束讲究现实的分寸与爽快节奏。日常的势利摩擦在亮出实力、对方认栽或被开除出局后便干净收场；涉及商业利益或重要资源的较量，对手在看清悬殊的财力差距后也会权衡利弊选择认输、退让或主动赔罪求和，不会像劣质套路一样每赢一次就机械刷出更高级别的家族后台没完没了地纠缠。",
```

---

### 5. 修改 `src/runtime/settlement.js`（消灭 MVU 红字弹窗 + 繁体字转简体）

1. **第 223 行**：将繁体字改为简体字：
   ```js
   // 原代码：
   if(Number(c.arousal)>=50&&!o.complexion)o.complexion='雙頰緋紅，眼波含春，呼吸微促';
   // 改为：
   if(Number(c.arousal)>=50&&!o.complexion)o.complexion='双颊绯红，眼波含春，呼吸微促';
   ```

2. **第 270–288 行 `prepareModelCommand`**：升级为全路径防弹版本（无论模型对已存在人物发 `add`/`insert`/`set`，还是对新人物发缺字段的 `add`/`insert`/`set`，或对 `shenghao.characters` 发 `insert`，全部在进入原生 MVU Zod 校验前归一化为合法的 `set` 命令）：
   ```js
   // Drop or normalize malformed character commands before the native Zod command
   // handler can reject them with a player-facing red toast.
   export function prepareModelCommand(command,before,schemas){
     const parts=commandPath(command).split('.');
     if(parts[0]!=='shenghao'||parts[1]!=='characters')return true;
     // Case 0: command.type === 'insert' on 'shenghao.characters' with [path, key, val]
     if(parts.length===2&&command.type==='insert'&&command.args?.length>=3){
       const cid=String(command.args[1]??'').trim().replace(/^['"`]|['"`]$/g,'');
       const raw=command.args.at(-1);
       let value;try{value=typeof raw==='string'?JSON.parse(raw):raw;}catch{return false;}
       if(!cid||!value||typeof value!=='object'||Array.isArray(value))return false;
       const merged=before?.characters?.[cid]
         ?acceptFields(value,before.characters[cid],schemas.character,'characters.'+cid,[])
         :newCharacter(cid,value,schemas);
       if(!merged)return false;
       command.type='set';
       command.args=['shenghao.characters.'+cid,JSON.stringify(merged)];
       return true;
     }
     if(parts.length<3)return true;
     const cid=parts[2],prior=before?.characters?.[cid];
     const raw=command.args.at(-1);
     let value;try{value=typeof raw==='string'?JSON.parse(raw):raw;}catch{return false;}
     // Case 1: Brand-new character added at /shenghao/characters/<cid>
     if(!prior){
       if(parts.length!==3||!value||typeof value!=='object'||Array.isArray(value))return false;
       const created=newCharacter(cid,value,schemas);
       if(!created){console.log('[神豪终端] 新人物缺少必要身份字段，已忽略',cid);return false;}
       command.type='set';
       command.args[command.args.length-1]=JSON.stringify(created);
       return true;
     }
     // Case 2: Existing character — normalize accidental 'add'/'insert' to 'set'
     if(['add','insert'].includes(command.type))command.type='set';
     if(command.type!=='set')return true;
     // Four levels reach a character field, five reach physiology.* / intimacy.* / outfit.* / limits.*.
     if(parts.length>5)return false;
     const nested=parts.length>3?unwrapSchema(schemas.character.shape[parts[3]]):null;
     let parsed;
     if(parts.length===3){
       if(!value||typeof value!=='object'||Array.isArray(value))return false;
       parsed=schemas.character.safeParse(acceptFields(value,prior,schemas.character,parts.slice(1).join('.'),[]));
     }
     // Writing a whole sub-object keeps the untouched siblings instead of wiping them.
     else if(parts.length===4)parsed=nested?.safeParse(value&&typeof value==='object'&&!Array.isArray(value)?{...(prior[parts[3]]||{}),...value}:value);
     else parsed=nested?.shape?.[parts[4]]?.safeParse(value);
     if(!parsed?.success){console.log('[神豪终端] 已保留人物字段原值',parts.slice(1).join('.'));return false;}
     command.args[command.args.length-1]=JSON.stringify(parsed.data);return true;
   }
   ```

---

### 6. 修改 `src/core/engine.js`（导出 `tierBasis` + `seedAnatomy` 自动回填 `cupSize` + `character` 字段对齐）

1. **第 108 行 `seedAnatomy(c)` 内**：推算出 `cup` 后，若 `!c.cupSize` 则写回 `c.cupSize`：
   ```js
   const cup = c.cupSize || (c.bustCm && c.waistCm ? inferCupSize(c.bustCm, c.waistCm) : 'C');
   if (!c.cupSize) c.cupSize = cup;
   ```
2. **第 232 行 `character(c)` 内**：补齐全部 7 个 `current*` 状态字段初始化：
   ```js
   // 原代码：
   currentClothes:'',currentPose:'',currentExpression:'', avatarRef:null,portraitRef:null});
   // 改为：
   currentClothes:'',currentPose:'',currentAction:'',currentExpression:'',currentMood:'',currentCondition:'',currentItems:'', avatarRef:null,portraitRef:null});
   ```

---

### 7. 修改 `src/ui/screens.js`（神豪徽章统一用 `tierBasis` + 消除行头面板重影 + 提现记录文案对齐）

1. **第 2 行**：在从 `'../core/engine.js'` 导入的列表中加上 `tierBasis`：
   ```js
   import {poolParts,totals,stage,corruptionStage,canWithdraw,PROFILE_KEYS,PROFILE_LABELS,wealthTier,withdrawalQuote,prowessTier,tierBasis} from '../core/engine.js';
   ```
2. **第 7 行 `tierBadge`**：改用 `tierBasis(s)` 计算等级，确保与详情页提现倍率 100% 一致：
   ```js
   const tierBadge=s=>`<span class="wealth-tier tier-${wealthTier(tierBasis(s)).id}">${wealthTier(tierBasis(s)).label}</span>`;
   ```
3. **第 23 行 `outfitPanel`**：当 `o.top` 与 `c.currentClothes` 完全相同时不重复渲染 `上装`，并去掉末尾与 `statusPanel` 重复的 `随身物品`：
   ```js
   const outfitPanel=c=>{const o=c.outfit||{},top=o.top&&o.top!==c.currentClothes?o.top:'';return [line('此刻穿着',c.currentClothes),line('穿搭风格',o.style),line('面部气色',o.complexion),line('上装',top),line('下装',o.bottom),line('内衣内裤',o.lingerie),line('袜子／丝袜',o.socks),line('鞋履',o.shoes),line('妆造',o.makeup),line('随身配饰',o.accessories)].filter(Boolean).join('');};
   ```
4. **第 51 行「提现记录」**：将 `提现前现金 ${yuan(w.preCashCents)}` 改为 `提现前计级身家 ${yuan(w.preCashCents)}`。

---

### 8. 修改 `src/ui/setup-presets.json`（6 位预设女主补齐 `cupSize` 与 `addressing` + 清理出戏备注）

1. **第 97 行 `fields.a_note` 最后一项**：
   - 将 `"作为既有财产登记，本次开局不再发生购买支出"` 替换为：`"成色崭新，一直由本人妥善保管，日常随时取用"`
2. **第 159–320 行 `contacts` 六位预设熟人**：为每一位补上与三围差值完全对应的 `"cupSize"` 和符合其身份关系的 `"addressing"`：
   - `florist_friend`（温迎，胸 84 / 腰 62，差 22）：加上 `"cupSize": "D", "addressing": "你"`
   - `design_colleague`（林叙宁，胸 86 / 腰 64，差 22）：加上 `"cupSize": "D", "addressing": "你"`
   - `cafe_neighbor`（乔沐，胸 82 / 腰 60，差 22）：加上 `"cupSize": "D", "addressing": "哥"`
   - `uni_alumni`（沈清弦，胸 86 / 腰 64，差 22）：加上 `"cupSize": "D", "addressing": "学弟"`
   - `gym_coach`（江映，胸 88 / 腰 66，差 22）：加上 `"cupSize": "D", "addressing": "老板"`
   - `startup_partner`（顾星遥，胸 85 / 腰 63，差 22）：加上 `"cupSize": "D", "addressing": "你"`

---

### 9. 修改 `src/ui/app.js` 与 `src/runtime/diagnostics.js`

1. **`src/ui/app.js`**：
   - **第 19 行 `defaultDraft`**：将 `genitals:{length:'18cm',girth:'4.8cm',traits:''}` 改为 `genitals:{length:'18cm',girth:'4.8cm',traits:'形态饱满挺拔，青筋分明，热度惊人'}`，让开局向导第 1 步不再留白。
   - **第 116 行**：删掉死代码 `if(d.parserMode){await api.parserMode(d.parserMode);phone();}`。
   - **第 156 行**：删掉死代码 `case 'retry':await api.retry();notify('已请求 MVU 重试本次更新');break;`。

2. **`src/runtime/diagnostics.js`**：
   为常见结算拦截码补充直观的中文说明（同时保留英文 code 以兼容所有现有单测断言）：
   ```js
   const CODE_LABELS={
     INSUFFICIENT_CASH:'可用现金不足（INSUFFICIENT_CASH）',
     PAYMENT_NOT_PROVEN:'正文未证实已完成付款（PAYMENT_NOT_PROVEN）',
     INVALID_MONEY:'金额格式无效（INVALID_MONEY）',
     ALLOCATION_EXCEEDS_COST:'分摊金额超过实付总额（ALLOCATION_EXCEEDS_COST）',
     ASSET_REQUIRED:'购房购车须同步附上资产信息（ASSET_REQUIRED）',
     INVALID_TEXT:'文本为空、类型不符或过长（INVALID_TEXT）'
   };
   ```
   将第 9 行的 `const reason=item.code==='INVALID_TEXT'?'文本为空、类型不符或过长':item.code;` 改为：
   `const reason=CODE_LABELS[item.code]||item.code;`

---

### 10. 修改 `scripts/ego-st-lib.mjs`（固化通用测试工具箱的两处优化）

1. **保留 `waitGeneration` 的 2.5 秒流式启动缓冲 + 二次 `waitEnd`**（DSH 已改好，保持不动）。
2. **优化 `survey` 中的 `promptMustNotContain` 判据**：
   在 `installProbes` 记录 `A.prompt` 时，除了 `text`（全量 Prompt），额外记录一份只拼接 `m.role !== 'system'` 的历史对话文本 `chatHistoryText`（或排除包含 `[mvu_update]` 的常驻协议消息）：
   ```js
   historyText: msgs.filter((m) => !String(m.content ?? "").includes("正文回复的末尾附且只附一个")).map((m) => `[${m.role}] ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`).join("\n")
   ```
   然后在 `survey` 里做 `promptMustNotContain` 检查时，针对 `historyText` 检查！这样配置 `"promptMustNotContain": ["<UpdateVariable>", "<%"]` 时，既能精准抓出聊天历史楼层有没有漏删 `<UpdateVariable>`，又绝不会误伤常驻世界书里的协议教学示例。

---

## 三、 单测更新与新增要求（`tests/`）

1. **`tests/female-records.test.mjs`**：
   - 第 66 行：由于 `seedAnatomy` 现在自动根据 `bustCm/waistCm` 或默认值为新人物补齐 `cupSize`（默认 `'C'`），将第 66 行的 `assert.equal(person.cupSize,'');` 更新为 `assert.equal(person.cupSize,'C');`。
   - 第 363 行：将繁体断言 `'雙頰緋紅，眼波含春，呼吸微促'` 更新为简体 `'双颊绯红，眼波含春，呼吸微促'`。
2. **在 `tests/rc25-body-economy.test.mjs` 末尾新增 `rc.26` 专项回归单测**：
   - 测试 `prepareModelCommand`：当模型对已存在的 `char_a` 发送 `type: 'add'` 或 `type: 'insert'`（甚至只传 `{id:'char_a', name:'顾星遥', affection:65}` 半截对象）时，`prepareModelCommand` 返回 `true`，且自动将 `command.type` 转为 `'set'`、保留 `char_a` 原有的 `age / physiology / outfit` 等字段不丢失，通过 `schemas.character.parse` 零报错。
   - 测试 `prepareModelCommand`：当模型对不存在的新人物 `char_new` 发送缺字段的 `{id:'char_new', name:'苏晚'}` 时，`prepareModelCommand` 返回 `true` 并自动补齐默认字段。
   - 测试 `screens.scene()` 与 `screens.mine()` 的 `tierBadge`：当玩家用 2000 万现金花 1500 万买房后（剩余现金 500 万，`tierBasis` = 2000 万），顶栏徽章依然显示 `豪门新贵·八倍` 而非掉回 `十倍`。
   - 测试 `outfitPanel`：当 `outfit.top === currentClothes` 时，渲染出的 HTML 中衣装文本只出现 1 次，不重影。

---

## 四、 DSH 交付与实机验收流程

1. 按上述细则完成代码与定稿文本修改。
2. 运行全量单元测试与构建校验：
   ```powershell
   npm test
   npm run build
   npm run check
   ```
   确认全部 `PASS` 且 `CHECK_OK`。
3. 如需发布线上指针，按 `scripts/release.ps1` 推送并更新指针；随后使用 `ego-st-setup.mjs` + `ego-st-act.mjs` 在 `127.0.0.1:8001` 跑一轮实机验证，重点确认：
   - 熟人进屋/对话时，**不再弹出 `⚠ [MVU zod]发生变量更新错误` 红字**；
   - 展开小手机「👗 行头·穿戴」不再有两行重复穿着；
   - 预设熟人三围后正常显示 `（D 罩杯）`，她们列表显示称呼；
   - 更新 `HANDOFF.md` 与测试报告。
