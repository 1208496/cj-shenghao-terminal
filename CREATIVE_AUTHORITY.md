---
authority_schema: tavernweave/creative-authority/v1
project_id: cj-shenghao-terminal-v2
title: 神豪终端 v2
status: implementation-candidate
target_card_type: hybrid
target_host: SillyTavern 1.19.0 / Tavern Helper 4.12.0
updated: 2026-11-16
next_gate: EGO real SillyTavern full feature acceptance
---

## Goal and exclusions

- [DEC-001] 严格按SHEJI制作独立新卡；旧工作区只读参考，不继承旧仓库。

## Confirmed

- [DEC-002] 已确定规则以总纲§00为准：取消E–S等级、积分、热榜、私信、复杂日历；三个手机入口。
- [DEC-003] 每位正式归档成年女性基础10000元奖池；消费1:1、脚本计算行为奖金；当前90好感解锁主动一次性提现，无恋人条件。
- [DEC-004] 2026-11-16 用户同意采用设计中的测试金额表，金额配置仅在project.json维护。
- [DEC-005] 新仓库1208496/cj-shenghao-terminal；用户先选择私有，随后为匿名更新检查明确选择公开。
- [DEC-006] 用户授权EGO实机全功能测试与GitHub更新测试，指定本机8000酒馆；每次刷新重连API。用户外出期间继续独立工作，问题等返回再提。

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
{"schemaVersion":1,"entries":[{"id":"opening","path":"src/ui/setup.template.html","role":"first_mes"},{"id":"worldbook","path":"src/content/literary.json","role":"four literary entries"},{"id":"protocol","path":"src/content/protocol.txt","role":"single event protocol"},{"id":"engine","path":"src/core/engine.js","role":"deterministic authority"},{"id":"timeline","path":"src/runtime/timeline.js","role":"selected swipe replay and commit"},{"id":"host","path":"src/runtime/host.js","role":"Tavern Helper bridge"},{"id":"phone","path":"src/ui/app.js","role":"shared UI implementation"}]}
```

## Runtime dependency ledger

酒馆及酒馆助手为host_required。五条世界书、三条局部正则、一个结算与手机脚本均embedded_required。此版不加载远程执行代码；更新是经玩家确认与SHA-256核验的显式替换。MVU为optional，外部MVU不可写本卡现金权威。Node/esbuild仅development_only。

## Acceptance ledger

```twa-acceptance
{"schemaVersion":1,"items":[{"id":"OFFLINE","gate":"automated","status":"passed","evidence":["tests/engine.test.mjs","tests/timeline.test.mjs"]},{"id":"RUNTIME","gate":"real-sillytavern","status":"planned","evidence":[]}]}
```

## Next gate

在EGO中核对导入的2.0.0-alpha.1实际加载、开局、模型提取、UI、回退、图片和GitHub更新。不用离线测试替代真实酒馆证据。记录用户可复核的失败与限制后再交付。
