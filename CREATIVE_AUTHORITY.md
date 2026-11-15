---
authority_schema: tavernweave/creative-authority/v1
project_id: cj-shenghao-terminal-v2
title: 神豪终端 v2
status: implementation-candidate
target_card_type: mvu_zod
target_host: SillyTavern 1.19.0 / Tavern Helper 4.12.0
updated: 2026-11-16
next_gate: rc.6 published and scoped runtime checks passed; human feedback pending
---

## Goal and exclusions

- [DEC-001] 严格按SHEJI制作独立新卡；旧工作区只读参考，不继承旧仓库。

## Confirmed

- [DEC-019] 2026-11-16 用户修订开局：姓名年龄不下拉；现金仅四档；居住方式自由填写；修复空白点击导致下拉重弹；字段建议翻倍而人物不增加；第一页顶部四套完整预设按0/1万/10万/100万元分别为穷光蛋开局、上班族牛马、小康人家、富家公子哥，保留姓名年龄、替换其余字段含资产熟人。详见docs/opening-presets.md，rc.8、revision4。

- [DEC-018] 2026-11-16 用户明确：上传/发布GitHub和切换作者测试指针不代表已向玩家发行；只有用户明确说角色卡已发给别人玩，才考虑旧字段/旧存档兼容。在此之前可直接调整、删除旧字段，不增设兼容层。用户本次授权推GitHub并切换测试指针。规则持久化于根AGENTS.md，后续不得把公开仓库或指针上线误判为玩家发行。

- [DEC-017] 2026-11-16 用户要求此刻玩家姓名旁去掉User标签；开局全部填写框点击可选预设，支持自由输入；初始熟人增加预设人物，手动和预设人物添加后均可编辑，保留原ID。明确可通过技能调用GEMINI4A，已单次成功调用pg-gemini-4-argon，人工审核接入。细节与本地验收见docs/setup-presets.md；不扩大为线上发布授权。

- [DEC-016] 2026-11-16 用户批准档案修改完整方案并要求执行：User展示年龄、外貌、身材；女性自动简易资料（含简易性格标签、身高CM、体重KG、三围CM、欧码鞋码），九类手动建档、默认未锁定，可逐人锁定停止发送。简易阶段启用奖池；仅在场且未锁定者发送九类，其他仅身份索引。神情移入现场折叠区，增加动态字段，隐藏必须确认。不做旧档迁移。新增小中大字体，精巧默认中、标准默认小，允许手选。沿用现有UI和四组档案结构。此决定覆盖总纲中自动完整建档等旧描述。

- [DEC-002] 已确定经济规则以总纲§00为准：取消E–S等级、积分、热榜、私信；三个手机主入口。日历与时间按后续DEC-011实施。
- [DEC-003] 每位正式归档成年女性基础10000元奖池；消费1:1、脚本计算行为奖金；当前90好感解锁主动一次性提现，无恋人条件。
- [DEC-004] 2026-11-16 用户同意采用设计中的测试金额表，金额配置仅在project.json维护。
- [DEC-005] 新仓库1208496/cj-shenghao-terminal；用户先选择私有，随后为匿名更新检查明确选择公开。
- [DEC-006] 用户授权EGO实机全功能测试与GitHub更新测试，指定本机8000酒馆；每次刷新重连API。用户外出期间继续独立工作，问题等返回再提。
- [DEC-011] 用户验收反馈要求真实原生MVU与Zod、原生额外模型解析、日历和游戏时间、跟随鼠标的两种拖动、原型视觉及一致的新增界面。覆盖早先不做日历的范围决定。
- [DEC-012] E:/SHZD可参考世界观、时间、资产与脚本逻辑；不得回用旧版经济规则。指定PNG仅在缓存静态拆解，不执行其未知远程业务。
- [DEC-013] 用户明确要求依《酒馆脚本热更新 (1).md》重做：固定加载器、Supabase版本指针、jsDelivr完整提交号分发、CDN逐字验证后再切指针。此前raw/main清单+内嵌脚本替换被否决。
- [DEC-014] 历史暂停指示“改好先别测试，先交接文档”：该阶段只改源码与交接；暂停已由DEC-015解除，不作为当前执行限制。
- [DEC-015] 2026-11-16接手后，用户明确“配置好就发布，测试”，解除DEC-014暂停。授权配置自有Supabase并测试、构建、发布本项目；自有项目已创建，公开读与禁止匿名写已实测。最终发布、CDN和真实酒馆结果分别记录，不把发布授权当成人工验收通过。

## Proposed

- [DEC-007] 开局自有资产转赠无游戏内成本依据，首版只转产权不自动计奖。
- [DEC-008] 已提现后退款、已转赠物品退款、持有资产部分退款保守拒绝自动结算，留下复核原因，不创建负债。

## Open decisions

- [DEC-009] 无需在实现中再扩大玩法。真实模型的长期事件抽取成功率仍需要持续使用观察。

## Rejected

- [DEC-010] 不复制旧卡的完整目录，不将原型示例女性、模拟账单或开发按钮带入游戏。

## Material index

```twa-materials
{"schemaVersion":1,"materials":[{"id":"DESIGN","path":"SHEJI/神豪终端_v2_超级设计总纲.md","authority":"user-supplied"},{"id":"UI","path":"SHEJI/神豪终端_v2_交互前端原型_修正版.html","authority":"user-supplied"},{"id":"UI-FIX","path":"SHEJI/v2.1_前端修复说明.txt","authority":"user-supplied"},{"id":"GEMINI","path":"evidence/gemini-receipt.json","authority":"proposed-only"}]}
```

## Entry and component map

```twa-entries
{"schemaVersion":1,"entries":[{"id":"opening","path":"src/ui/setup.template.html","role":"first_mes"},{"id":"worldbook","path":"src/content/literary.json","role":"world and portrayal"},{"id":"protocol","path":"src/content/protocol.txt","role":"native JSONPatch"},{"id":"engine","path":"src/core/engine.js","role":"deterministic finance"},{"id":"schema","path":"src/runtime/schema.js","role":"native MVU Zod schema"},{"id":"settlement","path":"src/runtime/settlement.js","role":"native update lifecycle settlement"},{"id":"host","path":"src/runtime/host.js","role":"native MVU bridge"},{"id":"phone","path":"src/ui/app.js","role":"shared UI implementation"}]}
```

## Runtime dependency ledger

酒馆及酒馆助手/Zod4为host_required。世界书、九条局部正则、结构注册与固定加载器为embedded_required。原生MVU、StageDog注册器、jsDelivr本体与Supabase只读指针为remote_required；全球MVU备用默认禁用。终端由固定加载器按不可变提交取本体，不再替换加载器。Node/esbuild/开发用zod仅development_only。旧timeline.js保留历史测试与digest工具。rc.6已配置、发布、完成专项验证。

## Acceptance ledger

```twa-acceptance
{"schemaVersion":1,"items":[{"id":"RC5_HISTORY","gate":"historical-scoped-evidence","status":"recorded-not-rc6-full-acceptance","evidence":["evidence/native-acceptance.md"]},{"id":"RC6","gate":"automated-and-scoped-runtime-and-release","status":"passed","evidence":["evidence/hot-update-acceptance.md","PROJECT_STATE.md","docs/hot-update.md"]},{"id":"HUMAN","gate":"human","status":"pending","evidence":[]}]}
```

## Next gate

接手、配置、发布和专项验收完成。等待用户使用rc.6整卡后的反馈，不把旧全面矩阵或自动化结果等同人工体验通过。当前细节以PROJECT_STATE和专项验收为准。

用户后续决定：移除手机里的剧情同步设置；更新模式、额外解析与重试统一交给原生MVU面板。角色卡不强制覆盖更新模式。正文底部默认变量折叠框，隐藏规则保留但默认关闭。
