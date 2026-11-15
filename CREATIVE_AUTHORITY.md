---
authority_schema: tavernweave/creative-authority/v1
project_id: cj-shenghao-terminal-v2
title: 神豪终端 v2
status: implementation-candidate
target_card_type: mvu_zod
target_host: SillyTavern 1.19.0 / Tavern Helper 4.12.0
updated: 2026-11-16
next_gate: EGO real SillyTavern full feature acceptance
---

## Goal and exclusions

- [DEC-001] 严格按SHEJI制作独立新卡；旧工作区只读参考，不继承旧仓库。

## Confirmed

- [DEC-002] 已确定经济规则以总纲§00为准：取消E–S等级、积分、热榜、私信；三个手机主入口。日历与时间按后续DEC-011实施。
- [DEC-003] 每位正式归档成年女性基础10000元奖池；消费1:1、脚本计算行为奖金；当前90好感解锁主动一次性提现，无恋人条件。
- [DEC-004] 2026-11-16 用户同意采用设计中的测试金额表，金额配置仅在project.json维护。
- [DEC-005] 新仓库1208496/cj-shenghao-terminal；用户先选择私有，随后为匿名更新检查明确选择公开。
- [DEC-006] 用户授权EGO实机全功能测试与GitHub更新测试，指定本机8000酒馆；每次刷新重连API。用户外出期间继续独立工作，问题等返回再提。
- [DEC-011] 用户验收反馈要求真实原生MVU与Zod、原生额外模型解析、日历和游戏时间、跟随鼠标的两种拖动、原型视觉及一致的新增界面。覆盖早先不做日历的范围决定。
- [DEC-012] E:/SHZD可参考世界观、时间、资产与脚本逻辑；不得回用旧版经济规则。指定PNG仅在缓存静态拆解，不执行其未知远程业务。

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

酒馆及酒馆助手/Zod4为host_required。世界书、九条局部正则、结构注册和结算手机脚本为embedded_required。原生MVU与StageDog注册器为remote_required，锁定提交与线路见docs/third-party.md；全球备用默认禁用。更新为玩家确认与SHA-256校验后替换。Node/esbuild/开发用zod仅development_only。旧timeline.js仅保留离线历史测试与digest工具，运行时不再调用其状态回放路径。

## Acceptance ledger

```twa-acceptance
{"schemaVersion":1,"items":[{"id":"OFFLINE","gate":"automated","status":"passed","evidence":["tests/engine.test.mjs","tests/native-mvu.test.mjs","tests/native-display.test.mjs"]},{"id":"RUNTIME","gate":"real-sillytavern","status":"scoped-passed-update-pending","evidence":["evidence/native-acceptance.md"]},{"id":"HUMAN","gate":"human","status":"pending","evidence":[]}]}
```

## Next gate

核对rc.2及后续修正候选的原生解析、提现、图片、分支和GitHub更新，不继承旧版通过结论。自然模型回合、受控消息夹具、离线测试分别列证据；最终视觉与玩法由用户验收。

用户后续决定：移除手机里的剧情同步设置；更新模式、额外解析与重试统一交给原生MVU面板。角色卡不强制覆盖更新模式。正文底部默认变量折叠框，隐藏规则保留但默认关闭。
