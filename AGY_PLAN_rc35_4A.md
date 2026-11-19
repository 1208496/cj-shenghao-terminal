# 《神豪终端》情色张力与机制提纯方案（rc.35 · 4A 定稿）

> **致执行 Agent（DSH）的硬性指令**：凡涉及本方案中的世界书（`src/content/literary.json`）、更新协议（`src/content/protocol.txt`）、状态说明（`src/content/state-context.txt`）与脚本内置文案（`src/runtime/settlement.js`、`src/ui/screens.js`），**DSH 必须 100% 逐字复制粘贴本方案代码块中的定稿文本，一个字、一个标点都不准自行发挥或缩写**。

---

## 第 1 部分：诊断（当前机制中压制色气的 6 个具体卡点）

### 诊断 1：高门槛「0=硬拒绝」死锁了前中期 80% 的推拉与半推半就（`settlement.js` + `literary.json` + `protocol.txt`）
- **具体位置**：`src/runtime/settlement.js` 第 272–285 行 `LIMIT_GATES` 与 `syncLimits(c)`；`src/content/literary.json` 的 `score` 条目第 66 行；`src/content/protocol.txt` 第 8 行。
- **压制机理**：`LIMIT_GATES` 将门槛设在 `cosplay:30, exposure:40, foreplay:50, intercourse:65, publicPlay:72, creampie:75, anal:82, multi:90`，低于门槛一律赋 `0（拒绝）`。同时 `score` 与 `protocol.txt` 用强禁止令规定「当对应尺度为 0 时必须明确推拒、冷脸避开或言语警告，严禁写顺从就范」。开局预设女性好感仅 30–55、堕落为 0（如江映 30 分，除丝袜外全为 0；林叙宁 35 分，手口与实战全为 0）。大模型对禁止性指令极度敏感，看到 `0` 就把角色写成贞洁烈女或职场防狼标兵。而神豪题材最核心的色气恰恰在于**「尺度尚未完全达标，但在重金砸盘、权力压迫、暗伤破防或高情欲值（arousal）催化下，她嘴上抗拒、指尖发抖却半推半就默许越界」**的灰色张力区。一刀切的 `0=硬拒绝` 直接掐死了从暧昧到上手的黄金推拉期。

### 诊断 2：协议末尾的 `<JSONPatch>` 抄写模板太「纯爱伟光正」，模型照抄出安全牌（`protocol.txt`）
- **具体位置**：`src/content/protocol.txt` 第 20 行（正戏合并示例）与第 23 行（事后温存退潮示例）。
- **压制机理**：大模型是典型的「示例复读机」。第 20 行示例里的 `currentThought` 是「他居然看出了我对着那盆旧雪松发呆的原因……替我把画廊布展的难题一并揽下后……」，第 23 行事后示例是「闹完这一场反倒踏实了些；明天一早还要去画廊盯布展，先借着夜色歇一会儿」。这两个全卡唯一的 JSONPatch 示范把性爱写成了「感动之余的礼貌办事」，事后立刻跳回「明天早起搞事业」，毫无肉体余韵、羞耻拉扯、汁水黏腻感与食髓知味的生理悸动。模型每轮照着这几行示例依葫芦画瓢，导致输出的 `currentThought`、`currentCondition` 与正文收尾普遍端着一股「文艺青年谈工作」的性冷淡风。

### 诊断 3：现场「此刻」面板把最勾人的 5 个色气字段阉割或锁死在三层折叠下（`screens.js`）
- **具体位置**：`src/ui/screens.js` 第 65–70 行 `secretPanel(c)`、第 75–82 行 `experiencePanel(c)` 与 `sceneBlocks(c)`、第 92 行 `scene()`。
- **压制机理**：玩家在聊天时高频盯着的是「此刻（Scene）」页，而非点进二级「人物详情」。但在 `scene()` 中：
  1. 人物卡片默认折叠（`expanded.has(c.id)`），展开后 `sceneSectionByChar` 默认是 `null`（2×2 方块全关），玩家必须连点两次才能看到私密状态；
  2. 更致命的是，现场「此刻」页调用的 `secretPanel(c)` 相比详情页的 `fleshPanel` 与 `experiencePanel`，**人为删掉了 `abilityComment`（对你肉体的评价）、`fetishes`（性癖与弱点）、`weakness`（软肋）、`anusLook/anusState`（后庭状态）以及 8 项 `limit-grid` 尺度格子**！玩家在现场挑逗或实战时，根本看不到她的性癖锚点、后庭反应和被操后的肉体评价，视觉反馈链严重断裂。

### 诊断 4：金钱消费与「堕落度 / 情欲值」在结算层完全断联，「砸钱砸不出肉体动摇」（`settlement.js` + `engine.js`）
- **具体位置**：`src/runtime/settlement.js` 第 75–81 行 `CORRUPTION_CHANGE` 触发器；`src/core/engine.js` 第 1122–1134 行、`CASH_TRANSACTION`（第 1140–1178 行）与 `ASSET_TRANSFER`（第 1179–1186 行）。
- **压制机理**：在这张「神豪」卡里，玩家花 1200 万买大平层送她、或砸 300 万替她平账，在 `engine.js` 里只冷冰冰地算进 `SPEND_CREDIT` 奖池，**对她的 `corruption`（堕落度）与 `arousal`（情欲值）没有任何脚本级联动加成**！而在 `settlement.js:76`，如果模型当轮因为专注写商业解围而忘了手写 `corruption` 新值，她的堕落度就纹丝不动；即便模型写了，`prowessBonus` 也只在已发生肉体接触时生效。这导致「钞能力」和「色气」脱节成了两张皮——钱花出去了，女人的世俗防线（堕落度）和当场荷尔蒙（情欲值）没有被巨额金钱砸出裂痕，玩家体会不到「重金砸穿矜持、让她呼吸发烫主动献身」的神豪爽感。

### 诊断 5：世界书 `private-life` 缺失「情欲五段生理锚点」与「背德擦边/半公开」强制描写指令（`literary.json`）
- **具体位置**：`src/content/literary.json` 第 411–413 行 `private-life` 条目；`HANDOFF.md` 第 92 行已记录「`private-life` 回滚（五段反应删除）」。
- **压制机理**：rc.33 把 `private-life` 里的情欲五段具体身体反应删掉了，现在 `private-life` 第一段大谈「翠湖公寓、云玺湾大平层、听涛山庄」房产置业，第二段聊 `hiddenScar` 梦呓，直到第三段才概括式地提了一句床笫实战。结果是：当 `arousal` 处于 **25–55（撩拨期）** 和 **55–80（前戏期）** 时，世界书里没有任何关于「隔衣顶弄、呼吸失序、大腿夹紧磨蹭、丝袜勒痕、分泌物濡湿底裤、办公室/车内/试衣间半公开偷欢」的感官白描指引。模型在非本垒回合就会自动退化回正经喝茶聊天，缺了最勾人的「日常擦边与前戏拉丝感」。

### 诊断 6：脚本兜底的 `vaginaState` 与 `complexion` 静态单调，且「事后回落」一刀切清空了下体余韵（`settlement.js`）
- **具体位置**：`src/runtime/settlement.js` 第 231–246 行（`vaginaState` 兜底）与第 265–268 行（`AROUSAL_COMPLEXION`）。
- **压制机理**：
  1. 在 `settlement.js:230-245` 中，当上一轮刚实战完、本轮进入「事后温存（`arousal` 被 `arousalGuard` 压回 12）」时，`sexNow` 为 `false` 且 `arousal < 40`，脚本如果遇到模型没重写 `vaginaState`，就会直接执行 `else c.physiology.vaginaState = ''`！上一轮刚被巨物内射灌满的穴口，下一轮事后温存时在面板上瞬间变成空白，毫无「精液顺着大腿根缓慢滑落、穴口微张合不拢」的事后淫靡余韵。
  2. `AROUSAL_COMPLEXION` 无论情欲是 50（刚被撩拨）还是 95（高潮失神），全员写死同一句 `'双颊绯红，眼波含春，呼吸微促'`，没有按情欲段位与性格原型呈现从「耳根烧红、眼神闪躲」到「泪眼迷离、吐舌失神」的递进色气。

---

## 第 2 部分：落地方案（按 P0 / P1 / P2 优先级排列，共 8 条）

### 【P0-1】把 `limits` 从「0=死板防狼」升级为「0=严词拒绝 / 1=半推半就擦边可破」，并整体下调门槛、引入情欲破防借位
1. **改什么**：`src/runtime/settlement.js` 第 272–285 行 `LIMIT_GATES` 与 `syncLimits(c)`；`src/content/literary.json` 的 `score` 条目第 66 行第二段；`src/content/protocol.txt` 第 8 行①。
2. **怎么改**：
   - **脚本逻辑（`settlement.js:272-285`）**：将 `LIMIT_GATES` 下调为 `{cosplay:20, exposure:30, foreplay:40, intercourse:55, publicPlay:60, creampie:68, anal:75, multi:85}`；在 `syncLimits(c)` 计算 `openness` 时，叠加上当前情欲值的临时破防冲动：`const arousalBoost = Math.max(0, ((Number(c.arousal)||0) - 45) * 0.35); const openness = Math.max(Number(c.affection)||0, (Number(c.corruption)||0)*1.2) + arousalBoost;`（当她被撩到情欲 75+ 时，临时+10.5 开放度，刚好把 `0拒绝` 顶上 `1犹豫/半推半就`）。同时修补 H7 漏洞：在 `engine.js:1221` 把 `const mode = (e.mode === 'INTIMATE' || REAL_SEX.test(String(e.action||''))) ? 'INTIMATE' : (e.mode || '');` 堵死漏写 `mode` 绕过阀门。
   - **协议定稿（替换 `protocol.txt` 第 8 行 `①...不写顺从就范；`）**：
```text
①每轮涉亲密互动前先对照limits（0拒绝/1半推半就/2要筹码或氛围/3主动迎合）：对应项为0时她会按性格抗拒或退开；但若对应项为1（半推半就），或本轮伴随重金砸盘、破解心结、微醺独处且情欲值arousal≥55，允许写出她“嘴上羞恼推拒、身体却在滚烫触碰下发软默许”的越界拉扯！
```
   - **世界书定稿（替换 `literary.json` 中 `score` 条目 `禁止套用“嘴上说不要...不产生正向BEHAVIOR暴击！` 段落）**：
```text
每轮涉及肢体接触或私密要求时，先核对limits（L0–L6及八项细分：0抗拒、1半推半就、2要筹码或烘托、3主动索取）：当尺度为0且无重金破局或情绪铺垫而强行越界时，她会按性格推拒或冷脸避开（违背底线的粗暴强推不给暴击）；但当尺度已达1（半推半就）、或玩家刚以巨额消费/强势撑腰击穿其心理防线时，必须细腻写出她从呼吸慌乱、指尖轻颤抗拒到被气息包裹后半推半就默许采撷的破防全过程！
```
3. **为什么更色**：直接打通「前中期推拉摩擦感」与「尺度推进」。预设熟人开局就能进入 `cosplay/exposure/foreplay = 1` 的可撩拨区间，且情欲上来后能借位跨过下一档，彻底告别贞洁烈女式的机械拒绝。
4. **风险**：`LIMIT_GATES` 下调后，原有的 `tests/` 中若硬编码断言了特定好感对应的 `limits` 数值（如好感 30 全 0），需同步更新单测期望值（未验证具体哪几条单测写死了旧阈值，DSH 跑 `npm test` 对齐即可）。

---

### 【P0-2】彻底重写 `protocol.txt` 的正戏与事后 `<JSONPatch>` 示例，注入高张力肉欲、汁水与背德心声
1. **改什么**：`src/content/protocol.txt` 第 20 行（合并示例中的 `currentThought`、`outfit`、`vaginaState`、`abilityComment`）与第 23 行（事后温存退潮示例整行）。
2. **怎么改**：用以下 100% 逐字定稿替换对应内容：
   - **第 20 行内部字段替换定稿**：
```json
{"op":"replace","path":"/shenghao/characters/char_在场ID/currentThought","value":"他刚砸下千万替我摆平了画廊死局，此刻被他滚烫粗硕的性器寸寸撑开紧窄内壁，羞耻感和灭顶的酸胀快感一起涌上来……哪怕理智叫我克制，双腿还是不由自主死死缠住了他的腰。"}
```
   - **第 23 行（事后温存退潮示例）整行替换定稿**：
```json
[{"op":"replace","path":"/shenghao/characters/char_在场ID/arousal","value":16},{"op":"replace","path":"/shenghao/characters/char_在场ID/currentCondition","value":"高潮余韵未散，腿根与微张花唇间仍沾着湿亮爱液与白浊，正懒软地蜷在你怀里平复急促呼吸"},{"op":"replace","path":"/shenghao/characters/char_在场ID/ physiology/vaginaState","value":"刚被滚烫尺寸彻底开发灌满，内壁软肉犹自一缩一颤地缓缓吐出余精"},{"op":"replace","path":"/shenghao/characters/char_在场ID/currentThought","value":"明明刚才叫得那么丢人，现在连指尖都使不上力气……被他这样揽在怀里摩挲着腰窝，身体深处居然还残留着被填满的滚烫错觉。"}]
```
   *(注：写入 `protocol.txt` 第 23 行时去掉 `/ physiology/` 中的空格，即 `/shenghao/characters/char_在场ID/physiology/vaginaState`)*
3. **为什么更色**：作用在「示例驱动」核心环。模型每轮必看协议末尾最后三行，把原本「明天一早还要去画廊盯布展」的性冷淡工作狂心声，换成「被寸寸撑开、腿根沾着白浊、余韵一缩一颤」的感官定稿后，模型生成的每轮 `currentThought`、`currentCondition` 和事后描写会立刻染上湿润黏腻的情色余韵。
4. **风险**：零架构风险，纯协议文本替换，需重算 `worldbookHash` / 构建检查。

---

### 【P0-3】重写世界书 `private-life`：补回「情欲五段生理锚点」与「日常背德擦边 / 五原型床笫失态」硬指令
1. **改什么**：`src/content/literary.json` 第 411–413 行 `private-life` 条目的 `body`（替换第 2、3 自然段）。
2. **怎么改**：保持 `private-life` 第 1 自然段不变，将第 2、3 自然段替换为以下逐字定稿（两段各约 115 字，紧凑高密度）：
```text
私密互动必须按情欲值（arousal）五段写出递进的生理与心理失控，严禁跳过前戏直接快进或用含糊辞藻略写：1.日常（0–15）克制得体，偶有视线交错；2.撩拨（25–55）在办公室、车内、试衣间或沙发贴身耳语、隔衣摩挲，呼吸变沉、耳根发热、大腿暗自夹紧磨蹭；3.前戏（55–80）褪去半边衣衫或扯开丝袜，结合她的胸型乳晕（chestDetail）、阴毛（pubicHair）、名器户型（vaginaLook）与敏感带（traits），详写乳首充血挺立、透明爱液濡湿底裤拉丝、花唇微张吸吮指尖的羞耻战栗（排卵期尤甚）。
4.正戏（85–100）严格贴合玩家genitals尺寸特征与sexualAbility档位，直白滚烫地白描冠头破开紧窄嫩肉的寸寸撑胀感、内壁层叠褶皱的绞紧吞吐、汁水交融声响，以及贴合她性格底色的失态反差（清冷者咬唇溃堤的破碎哭腔、高傲者对镜被从身后贯入时的失神求饶、纯情者眼尾泛红的生涩痉挛、沉沦者主动夹腰求灌满内射）；5.事后（5–20）详写高潮痉挛后的失力瘫软、穴口微张溢精的淫靡余韵与枕畔温存剖白（此时最易自然触动hiddenScar）。
```
3. **为什么更色**：直接补齐「氛围铺垫 + 身体反馈 + 心理落差」。给模型明确规定了 `arousal 25–55` 写什么（半公开隔衣擦边、大腿夹紧）、`55–80` 写什么（底裤湿透拉丝、乳首挺立）、`85–100` 写什么（五种性格截然不同的被操哭腔与失态）、`5–20` 写什么（穴口溢精余韵），让前戏、擦边、实战、事后每一段都有抓手。
4. **风险**：常驻世界书增加约 180 字符（约 110 token），对 4 万 token 上下文影响可忽略不计。

---

### 【P1-1】建立「钞能力 ➔ 堕落度 & 情欲值」脚本确定性联动（砸钱即催化荷尔蒙与防线松动）
1. **改什么**：`src/core/engine.js` 第 1173–1177 行（`CASH_TRANSACTION` 结算末尾）与第 1182–1186 行（`ASSET_TRANSFER` 结算末尾）；`src/runtime/settlement.js` 第 135–147 行 `arousalGuard`。
2. **怎么改**：
   - 在 `engine.js` 的 `CASH_TRANSACTION`（当 `allocations` 为在场或目标女性消费）与 `ASSET_TRANSFER`（向女性转赠房产/座驾/奢品）成功记账后，按单笔受益金额 `beneficiaryCents` 自动施加「钞能力冲击」：
     - 若单笔为她消费或转赠达 `¥50,000+`（5,000,000 分）：当轮自动为该女性追加保底 `corruption = Math.min(100, (c.corruption||0) + (beneficiaryCents>=100000000 ? 4 : beneficiaryCents>=20000000 ? 2 : 1))`（模型若已写了更高正向堕落增长则取较大值，不重复叠加超限）；
     - 若该女性本轮在场（`s.scene.presentCharacterIds.includes(cid)`）且受益达 `¥20,000+`：自动将其 `arousal` 抬升至保底区间 `Math.max(c.arousal||0, beneficiaryCents>=100000000 ? 48 : 32)`（直接推入「25–55 撩拨心猿意马期」），并在 `settlement.js` 的 `arousalGuard` 中识别 `spendBoosted` 标志，本轮不执行 `-20` 日常扣减。
3. **为什么更色**：打通「神豪消费 ➔ 肉体动摇」的核心机制闭环。玩家豪掷百万买下大平层或顶奢珠宝送她时，哪怕正文还在写交接钥匙，面板上的「堕落度」和「情欲值（32~48）」已经当场跳动升温，下一轮她的状态直接带着「双颊微热、心防松动、尺度借位开启」进入投影，完美兑现神豪卡「拿钱砸软高冷女神双腿」的题材爽点。
4. **风险**：可能改变现有经济单测中对 `corruption` 和 `arousal` 在纯转账轮次恒为 0 的断言（未验证具体单测用例数），建议仅在 `beneficiaryCents >= 5000000`（5万元以上重金）时触发，避开买早点、喝咖啡等小额测试。

---

### 【P1-2】打通现场「此刻」面板的色气信息流：默认展开首位在场女主 + 补齐欲念页缺失的性癖、评价与底线格
1. **改什么**：`src/ui/screens.js` 第 65–70 行 `secretPanel(c)`、第 87–93 行 `scene()`。
2. **怎么改**：
   - **默认展开（`screens.js:92`）**：在 `scene()` 渲染在场女性列表时，若 `expanded.size === 0 && people.length === 1`，默认视同展开第一位在场女性（或保持 `expanded` 集合，但在 `app.js` 首次载入有在场女性时自动把 `people[0].id` 加入 `expanded`），减少一层无意义的点击。
   - **扩充 `secretPanel(c)`（替换 `screens.js:65-70`）**：把原本在现场被阉割掉的 `abilityComment`（对你的评价）、`fetishes`（性癖与弱点）、`weakness`（软肋）和 8 项 `limit-grid` 浓缩进现场的「🌹 欲念 · 私密」面板：
```javascript
  const secretPanel=c=>{
    const p=c.physiology||{},i=c.intimacy||{},l=c.limits||{};
    const chips=[p.cycle?pill('🌿 '+esc(p.cycle),cycleTone(p.cycle)):'',pill(p.virgin===false?'🌺 非处女':'💮 处女',p.virgin===false?'plum':'pink'),pill('⛓️ '+esc(scaleText(l.scaleLevel)),'plum')].filter(Boolean).join('');
    const grid='<div class="limit-grid">'+[['露点展示','exposure'],['手口侍奉','foreplay'],['实战插入','intercourse'],['丝袜制服','cosplay'],['无套内射','creampie'],['后庭开发','anal'],['半公开偷欢','publicPlay'],['多人同欢','multi']].map(([label,key])=>limitCell(label,l[key])).join('')+'</div>';
    return `<div class="chips">${chips}</div>`
      +[line('生理周期',p.cycle),virginText(p),line('胸部详情',p.chestDetail,'hl-pink'),line('阴部户型与色泽',p.vaginaLook,'hl-pink'),line('阴部紧致与状态',p.vaginaState,'hl-plum'),line('阴毛类型',p.pubicHair),line('敏感带与体香',[p.traits,p.bodyScent].filter(x=>typeof x==='string'&&x.trim()).join(' · '),'hl-strong'),line('性癖与兴奋点',i.fetishes,'hl-plum'),line('心理软肋',l.weakness,'hl-strong'),line('对你的肉体评价',i.abilityComment,'hl-pink'),kv('当前开放档位',`<b class="hl-plum">${esc(scaleText(l.scaleLevel))}</b>`),grid,tagCloud(c)].filter(Boolean).join('');
  };
```
3. **为什么更色**：作用在「玩家 UI 视觉刺激与信息可及性」。玩家在现场聊天时点开「🌹 欲念 · 私密」，一眼就能同时看到她的馒头穴状态、敏感带、性癖（如「在办公室被反锁房门强势拥吻毫无抵抗力」）、对玩家大肉棒的评价以及 8 个尺度格子的解锁进度，直接给玩家提供下一轮怎么下口、怎么挑逗的行动指南。
4. **风险**：窄屏（365px）下「🌹 欲念 · 私密」展开后高度会增加约 180px，但 `.phone-screen` 已有纵向滚动，不会撑破布局（未在 8001 实机测量高度，建议结合 rc.28 的 8.2em 标签宽度一并核对）。

---

### 【P1-3】修复 `settlement.js` 事后回合清空 `vaginaState` 的断档，并把 `complexion` 与 `vaginaState` 升级为五段递进淫靡描写
1. **改什么**：`src/runtime/settlement.js` 第 231–246 行（`vaginaState` 兜底分支）与第 265–268 行（`syncOutfit` 中的 `AROUSAL_COMPLEXION`）。
2. **怎么改**：
   - **修复事后余韵清空 & 分段扩充 `vaginaState`（替换 `settlement.js:231-246`）**：当 `prevRoundHadSex && !sexNow`（即刚做完进入事后温存轮）且模型未手写新 `vaginaState` 时，绝不清空为 `''`，而是自动切为「事后余韵态」；同时把日常情动细分为 `40–54 / 55–74 / 75–84` 三阶：
```javascript
    const creampie=(c.intimacy?.unlockedTags||[]).some(t=>/内射|灌满|中出/.test(t));
    const prowess=s.user?.prowessScore??70;
    if(sexNow&&!wroteVagina){
      c.physiology.vaginaState=creampie
        ?(prowess>=75
          ?'经受巨物深度开发，内壁滚烫痉挛，花穴微张、深处灌满浓稠精液'
          :'经受深入交合开发，内壁温热痉挛，花穴深处灌满滚烫精液')
        :(prowess>=75
          ?'刚经受强悍肉体充分开发，内壁温热紧箍、春水泥泞泛红，余韵微颤'
          :'刚经历亲密交欢，内壁温热湿润、软肉轻颤，犹带缠绵余韵');
    }else if(!sexNow&&!wroteVagina){
      const arousal=Number(c.arousal)||0;
      if(prevRoundHadSex&&arousal<=25){
        c.physiology.vaginaState=creampie
          ?'高潮余韵未散，被撑开的花唇微张难以闭合，温热白浊正顺着腿根缓慢滑落'
          :'刚退下交欢热潮，红肿娇嫩的花唇微微翕张，内壁软肉仍偶有余韵轻颤';
      }else if(arousal>=75)c.physiology.vaginaState='情欲沸腾，滚烫爱液彻底湿透底裤并顺着大腿内侧拉丝滑落，花穴空虚地一张一翕渴望填满';
      else if(arousal>=55)c.physiology.vaginaState='情动难耐，透明爱液泌出湿透底裤，花唇充血微张、阴蒂敏感挺立';
      else if(arousal>=35)c.physiology.vaginaState='芳心微乱，秘处温热湿润，花缝随急促呼吸轻度收缩泌水';
      else c.physiology.vaginaState='';
    }
```
   - **气色分两档递进（替换 `settlement.js:265-268`）**：
```javascript
  const AROUSAL_HIGH='双颊潮红滚烫，眼尾泛起湿润春意，檀口微张喘息凌乱';
  const AROUSAL_MID='耳根与脸颊浮起羞意绯红，眼神闪躲含春，呼吸微促';
  const AROUSAL_SET=new Set([AROUSAL_HIGH,AROUSAL_MID,'双颊绯红，眼波含春，呼吸微促']);
  const wroteComplexion=typeof o.complexion==='string'&&o.complexion&&o.complexion!==String(prior.outfit?.complexion||'');
  const ar=Number(c.arousal)||0;
  if(ar>=75){if(!wroteComplexion)o.complexion=AROUSAL_HIGH;}
  else if(ar>=45){if(!wroteComplexion)o.complexion=AROUSAL_MID;}
  else if(AROUSAL_SET.has(o.complexion)){o.complexion='';seedOutfit(c);}
```
3. **为什么更色**：作用在「身体反馈的连续性与颗粒度」。不仅解决了「刚内射完下一轮事后温存穴口状态变空白」的出戏 Bug（顺带覆盖 `HANDOFF.md` 缺测清单 T2），而且让玩家从撩拨（35+）、前戏（55+）、临门一脚（75+）、实战（88+）到事后溢精（12）都能在面板上看到极其色气的下体与气色动态演变。
4. **风险**：`tests/rc32-arousal.test.mjs` 若有断言事后 `vaginaState === ''` 的用例，需更新为断言包含 `'余韵'`（未验证该单测是否断言了此字段）。

---

### 【P2-1】强化「排卵期 / 经前期」对情欲底座与肉体描写的生理催化（`settlement.js` + `state-context.txt`）
1. **改什么**：`src/runtime/settlement.js` 第 135–147 行 `arousalGuard` 与第 295 行 `applyCycles`；`src/content/state-context.txt` 第 5 行。
2. **怎么改**：
   - 在 `settlement.js` 的 `syncPrivateRecords` 中，若在场女性当前 `c.physiology.cycle` 包含 `'排卵'`（即 `排卵期·易孕` 或 `排卵日·极易孕`），且本轮处于在场互动（`inScene`），其日常情欲自然回落底线从 `0` 抬升至 `18`（即日常也自带微热骚动），且当发生 `score >= 60` 的撩拨时，`arousal` 额外 `+8`；
   - 在 `src/content/state-context.txt` 第 5 行末尾追加一句定稿（58 字）：
```text
当在场人物cycle处于“排卵期·易孕”或“排卵日·极易孕”时，其体感温度升高、敏感带阈值降低，面对肢体触碰更易动情湿润乃至产生背德受孕悸动。
```
3. **为什么更色**：把原本只作为静态文本展示的 `cycle（生理周期）` 变成真正驱动情欲与描写的活机制。遇到排卵日的女主，不用怎么撩就已经 `arousal 18+`，上手更容易湿透，内射时的背德危险感直接拉满。
4. **风险**：低风险。仅对在场且处于排卵期（28 天中占 5 天）的女性生效，不会污染离场人物。

---

### 【P2-2】打星离场动态（`offscreen`）在亲密破防后注入「思春与身体余韵」指令（`protocol.txt`）
1. **改什么**：`src/content/protocol.txt` 第 5 行末尾关于 `offscreen` 的说明（及第 20 行示例中的 `offscreen`）。
2. **怎么改**：
   - 将 `protocol.txt` 第 5 行末尾 `凡starredOffscreenIds列出的打星离场人物……动向）。` 替换为以下定稿（92 字）：
```text
凡starredOffscreenIds列出的打星离场人物，本轮replace其/shenghao/characters/<ID>/offscreen为一句15–38字最新异地实况：若尚未亲密则写其围绕recentGoal的动向；若已发生过深入亲密或corruption≥45，须写出她在职场/居所独处时回味欢愉余韵、腿间微热或暗自挑选丝袜等待你召见的私密状态。
```
   - 将第 20 行示例中的 `offscreen` 替换为：
```json
{"op":"replace","path":"/shenghao/characters/char_打星离场ID/offscreen","value":"花艺工作室 · 修剪花枝时腿心仍残留着昨夜被你顶弄的酸软感，正看着手机等你的消息"}
```
3. **为什么更色**：作用在「离场牵挂与多女主后宫张力」。以前不管操没操过、堕落多高，女一离场后 `offscreen` 全在写「修剪高山杜鹃、核对报表」这种正经日报；改后，一旦被你开发过，她在公司开会或看店时都会带着「腿心酸软、挑选黑丝等你召见」的私密余韵，让小手机「★ 特别关注」栏变成真正的后宫春情监控器。
4. **风险**：无代码风险，纯提示词与示例增强。

---

## 第 3 部分：示例对照（改前 vs 改后）

### 对照 1：中低好感（好感 42 / 堕落 25 / 情欲 62）在办公室隔着丝袜抚摸大腿（对应 P0-1 + P0-3）
- **【改前（触发 `foreplay: 0` 硬拒绝禁令，模型写得像普法栏目）】**
  > 沈清弦脸色一冷，迅速后退半步避开你的手掌，将西装裙摆严密地拢好。她蹙起眉头，声音清冷而克制：「陆先生，请你自重。我们今天只谈东岸基金的采访底稿，如果你再有这种越界的举动，我想我们没有继续谈下去的必要了。」（`arousal: 15`，无暴击）
- **【改后（`foreplay` 降门槛至 40 已达 `1·半推半就`，叠加情欲破防与 `private-life` 擦边指令）】**
  > 沈清弦指尖猛地攥紧桌沿，0D黑丝包裹的修长小腿像过电般绷紧。「别在这……外面还有编辑部的人……」她声音发颤，想推开你手腕却使不上力，冷白耳根烧得通红。随着你滚烫的指腹隔着薄透丝袜慢条斯理滑向大腿内侧根部，她呼吸彻底失序，双腿既羞耻地夹紧磨蹭，又半推半就地任由你掀开开叉裙摆，底裤边缘已沁出一小片温热湿意。（`arousal: 68`）

### 对照 2：正戏内射刚结束进入事后温存轮的 `<JSONPatch>` 与面板状态（对应 P0-2 + P1-3）
- **【改前（照抄旧版第 23 行示例 + `settlement.js` 事后清空 `vaginaState`）】**
  > - `arousal`: `12`
  > - `vaginaState`: `""`（被脚本置空，面板上这一栏直接消失）
  > - `currentCondition`: `"刚退下情潮，正垂眸把散落的发丝拢到耳后，呼吸已趋平稳"`
  > - `currentThought`: `"闹完这一场反倒踏实了些；明天一早还要去画廊盯布展，先借着夜色歇一会儿。"`
- **【改后（新协议第 23 行定稿 + `settlement.js` 事后溢精余韵兜底）】**
  > - `arousal`: `16`
  > - `vaginaState`: `"高潮余韵未散，被撑开的花唇微张难以闭合，温热白浊正顺着腿根缓慢滑落"`
  > - `currentCondition`: `"高潮余韵未散，腿根与微张花唇间仍沾着湿亮爱液与白浊，正懒软地蜷在你怀里平复急促呼吸"`
  > - `currentThought`: `"明明刚才叫得那么丢人，现在连指尖都使不上力气……被他这样揽在怀里摩挲着腰窝，身体深处居然还残留着被填满的滚烫错觉。"`
