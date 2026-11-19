# zero-api-card-test v2.0 固化记录

> 2026-11-20 04:35。从项目内脚本固化为**通用 Skill**（与 `ego-tavern-card-test` 并列，不是它的子集）。

## 一、为什么固化成 Skill，而不是留在项目里

项目里原来那份 `test-noapi-run.mjs` 只对《神豪终端》rc.37 有效：八处断言写死 rc.37 的类名与数量（`.wheel-hub-grid` / `.wheel-topbar-acts` 恰好 2 个 / `#wfSvg .ring` / `#wfGo` / `wf-modes` 恰好 3 个），卡一重构就要整段重写，而且改脚本本身没有测试保护——所以每次「卡更新」都会退化成「重写脚本」，而不是「测卡」。

固化后：**执行器零业务知识**，卡的差异全在 `config.json` + `suite.json`。

## 二、Skill 内容

```
SKILL.md                    三条硬规矩 / 五步流程 / 断言只认三类 / F0–F9 / 换卡最小步骤
references/
  method.md                 定义与边界（唯一判据）、六类永远归调 API、10 层覆盖面矩阵、卡形态 A–E
  attribution.md            F0–F9 码表、一眼定责判据、证据包 schema、自检要求
  harness.md                space 生命周期、哨兵、跨 frame、四道门、指针链、快照、执行器
  seeding.md                预置三条路径、隔离、账本恒等式坑、schema 漂移坑
  pitfalls.md               21 条实测坑（分 ego / 跨 iframe / 交互断言 / 假绿 / 报告纪律）
  report-template.md        验收报告模板（断言清单 + 证据 + 未通过归因 + 未验证）
scripts/noapi/
  codes.mjs                 F0–F9 归因（纯函数）
  guards.mjs                8001 白名单 + C:\jiuguan 硬拦（按盘符+路径段判，不误伤 Ajiuguanagentceshi）
  runtime.mjs               哨兵（全同源 frame、block 模式）/ 四道门 / 真实指针链 / snap / allText / attachSpace / finishSpace
  spaces.mjs                space 清理与复用
  selftest.mjs              离线归因自检 27 条
  run-suite.mjs             数据驱动执行器（ctl 驱动，卡无关）
  discover.mjs              结构探测（只发现，不断言）
templates/
  noapi-ctl.json            控制文件（ego 里 env/argv 不可靠，参数走这里）
  card.config.json          卡常量 + 播种命令 + frame 路径
  card.suite.json           用例模板
  project-entry.mjs         项目侧入口（靠 import.meta.url 反推项目根）
```

## 三、抽掉的项目耦合（这轮真正的工作量）

| 原本写死 | 现在 |
|---|---|
| `taskSpace('NOAPI-XXX ' + 时间戳)` | `attachSpace()` 复用同名 space + `finishSpace()` 收尾 |
| 播种脚本路径与参数 | `config.seed = {bin,args,chatIdTemplate}`，`{char}/{avatar}/{preset}` 占位符 |
| `cj-shenghao-phone-frame` / `-wheel-frame` | `config.frames` 路径数组 |
| `window.__CJ_SHENGHAO_V2__` | `config.hostApi`，且装成**实时 getter**（早期取值会捕成 null：酒馆就绪时卡对象还没建，进聊天时才创建并 destroy 重建） |
| 项目相对路径 | `projectRoot`（ctl 指定）+ `globalThis.__NOAPI_PROJECT_ROOT__` |
| `process.execPath` 当 node | `NODE_BIN` 解析（ego 里它是 ego.exe） |

## 四、固化后回归（都是真跑）

| 项 | 结果 |
|---|---|
| Skill 离线自检 `node selftest.mjs` | **27/27 通过** |
| 用 Skill 版跑项目套件（经项目 `skill-entry.mjs`） | **8/8 PASS，`apiCalls: 0`** |
| 用项目 shim（转发到 Skill 版）跑同一套件 | **8/8 PASS，`apiCalls: 0`** |
| 跑完 `listTaskSpaces()` | 只剩 YG 自己的 space（`ownership=user`），无 agent 残留 |

证据：`.work/noapi/suite-result-1795120514070.json`（Skill 直跑）、`.work/noapi/suite-result-1795120612422.json`（shim 转发）。

## 五、显式写进 Skill 的两条"别再犯"

1. **ego space 纪律**：一目标一 space，用完 `finish({keep:[]})`；用户接管的 space 是硬停，不自行 takeOver。
2. **哨兵必须硬阻断**：命中生成路由直接 reject。原实现"记账后仍放行"，等于把"可能真花钱"写进测试工具里。

## 六、仍未做

1. 5 类"点击 → 等结算 → 断言状态+界面"的用例（卡包启封 3 张/翻面/编号、玩法券排期取消、奇物生效、低阶禁绿格与 240 封顶、珍藏锁禁押注兑换）。
2. 用例里的产品数字（商城 14/11/5、图鉴 /12）还是字面量，没接源码常量 SSOT。
3. `discover.mjs` 只 dump 结构，还没做到"探测完自动生成 suite 草稿"。

---

# 附录：v2.1 与 TW 规范对齐（2026-11-20 04:55）

## 起因

YG 指出：TW 酒馆专精技能早就装在 DSH 里（`C:\Users\Administrator\.dsh\profiles\desktop\node_modules\liarmttt-tavernweave-dsh\skills\`，**23 个，v2.4.0**，与侧边栏「TW SKILLS · 23」一致），而我上一轮找的是 `~/.agents/skills` 与 `.codex/skills`（Codex 客户端那份 28 个，同名 23 份逐字节相同），于是误判"这些不是我的"，从头手搓了一套。

## 读完 A0 与 runtime-debug 后改了什么

| 改动 | 依据 |
|---|---|
| SKILL.md 顶部新增「我在这套体系里的位置」：**本技能 = `sillytavern-runtime-debug` 的零生成执行通道**，不建立另一套验收工程 | runtime-debug 的边界声明 |
| 硬规矩第 1 条改成 **A0 前置**（写盘/改配置/装技能/动状态之前读检查单） | A0 第 2/5/6 层 |
| 新增 **test boundary** 步骤，照 runtime-debug 的必记项 | runtime-debug「Establish the test boundary」 |
| **状态分层**：`runtimeStatus`（本通道可判）与 `modelStatus`（恒为 `blocked`，原因：零生成）分开写 | E07 的分层状态写法 |
| 播种加红线表：只写测试前缀 / manifest 可回退 / 优先导入 UI 与 MVU 内存注入 / 不改真实存档制造错误 | runtime-debug「Do not overwrite files in an installation data directory as a default debugging technique」 |
| 归因码补「F0–F9 ↔ runtime-debug 按层诊断链」映射 | runtime-debug「Diagnose by layer」 |
| 报告模板重写：**boundary 表 + 11 维矩阵 + 分层状态 + observed 未执行保持 null**（我的断言清单降为 Data/Interaction 两维的细化） | runtime-debug「Acceptance matrix」+ E07 观察记录 |
| harness 增加「驱动不另造」：直接复用 `ego-tavern-card-test/scripts/ego-st-lib.mjs`，我只补哨兵/四道门/归因/套件 | YG 自建的执行层技能 |
| 能力缺口一律记 `runtimeBlockers`（ego 无 `route.abort`、覆写 fetch 拦不到 `<img>/<script>`），不许假装测过 | runtime-debug「Use a driver capability contract」 |

## 对齐后的自检

- `node scripts/noapi/selftest.mjs` → **27/27**（脚本未改，只改文档口径）。
- 文档一致性：`runtimeStatus`/`modelStatus`/`A0`/`ego-tavern-card-test`/`runtime-debug` 在 6 份文档中共 29 处引用，无残留"单一 PASS 即通过"的表述。

## 明确不做的事

- **不把 TW 的 23 个技能复制进本技能**，只引用路径与条款。
- **不写进 `node_modules`**：TW 是 tgz 安装，写进去升级即丢。本技能留在 `~/.agents/skills/`（用户级）。
- **不宣称覆盖 Security / 远程模块执行 / 模型行为**：这三块分别归 `sillytavern-rolecard-security`、runtime-debug 的 Dependencies 条、`ego-tavern-card-test` 的真实生成轮。

