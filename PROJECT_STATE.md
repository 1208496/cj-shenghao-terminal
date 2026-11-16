# 神豪终端 v2 交接

维护约定：每次项目任务或可验收阶段结束前主动更新本文件，不等用户提醒；规则已写入根AGENTS.md。以顶部当前状态为准，后续版本段落为历史。

<!-- SH-HANDOFF-BEGIN PH-20261116-rc11-loading -->
## 当前交接：rc.11开局加载修复已验证，正在按用户授权发布

2026-11-16（Asia/Shanghai），E:\CJBAOJISHENHAOZD。用户要求参考桌面V1.2.26.png修复开局卡顿，随后明确要求“推送GITHUB切换指针”。本轮发布授权包含验证、构建、GitHub推送、CDN核对与作者测试指针；不代表向玩家发行。没有创建新聊天。

- 当前源码 2.0.0-rc.11，cardContractRevision=7、schemaVersion=3。包含此前未发布rc.10的中型世界书、固定云澜和资产描述；经济规则沿用下方rc.10有效决定，不加旧档兼容层。
- 表单先本地绘制/恢复聊天草稿，后台连接；三步与预览可先填写，确认提交仍需依赖。first_mes从161387字节减为342字节，界面移入随卡显示正则；状态刷新保留输入节点/焦点。MVU END补释放忙碌锁，修复开局初始化只START/END时残留busy。
- 本地候选 dist/2.0.0-rc.11-checkpoint/神豪终端.json，SHA256 d41afe6c45df85ea861cb494892bacbd92bcaeb76423ca7dd5e1c3353082ff7f。rc.10候选保留，未覆盖。
- 226项测试通过，checkpoint build/check通过；真实ST1.19.0/助手4.12.0：无主程序可填写三步及预览、未就绪禁止提交、草稿恢复、依赖就绪允许提交、parseMessage结束释放busy且无楼层写入、焦点选区保持、提示词清理通过。证据 evidence/rc11-opening-loading.md及同前缀JSON。不能据此称全功能验收完成。
- EGO空间3、p1，独立角色「神豪终端 rc11 加载修复」，仅1条开局消息，无正式游戏初始化。表单草稿为合成验收数据。已恢复旧临时模型pg-gemini-4-hydrogen-low，旧fetch包装移除；旧4A正文请求结果仍未知。
- 发布前Git为main，HEAD=b232a6abbf639c44e8401a1c408c858f1e482699；rc.10与本轮修改未提交。线上最后已核验仍rc.9/ref7195a9a；下面发布回执将以实际执行结果补充，不提前记成功。
- 正在执行：scripts/release.ps1。下一步核对正式整卡/CDN/ref，记录真实提交和SHA；发布后提醒重新导入rc.11整卡（开场白、正则、世界书均变化，旧卡只切指针不足以更新）。全功能、移动端、低速公网及真实模型验收缺口沿用，不扩写成通过。

<!-- SH-HANDOFF-END PH-20261116-rc11-loading -->

## 以下交接为历史，当前版本与本轮授权以上方为准

<!-- SH-HANDOFF-BEGIN PH-20261116-rc10-test-01 -->
## 历史交接：rc.10修改已落地，全功能实机测试未完成

交接编号：`PH-20261116-rc10-test-01`。更新时间：2026-11-16（Asia/Shanghai）。目录：`E:\CJBAOJISHENHAOZD`。源任务编号、接手任务编号：未取得／未创建。状态：**本地材料已核对，等待接手核验；浏览器因控制权交回而停止**。用户本次只要求写交接文档，不自动新建聊天、不恢复网页、不提交或推送。

### 目标、版本和成品

当前目标是完成“神豪终端”所有功能的实机验收，修复发现的问题，并把实际模型行为、受控测试夹具、自动测试分别记录。世界书扩写和资产描述已经实现，不必重新生成。全功能验收尚未完成，不能据223项自动测试声称全部功能通过。

| 项目 | 当前事实 |
| --- | --- |
| 本地源码 | `2.0.0-rc.10`，`cardContractRevision=6`，`schemaVersion=3` |
| Git | `main`，HEAD=`b232a6abbf639c44e8401a1c408c858f1e482699`；rc.10源码、成品、证据及本文均未提交，保留工作区改动 |
| 本地验收整卡 | `dist/2.0.0-rc.10-checkpoint/神豪终端.json`；内嵌本体，不读取线上指针 |
| 本地整卡SHA256 | `7d777fd0279d3af36ba493463c77b9eb0d0f9bda3f419922091422621be474cb`（本次交接读取实际文件） |
| 线上最后已核验版本 | rc.9，本体/ref/fallback=`7195a9ac880de135468d22a10da6fcb28307743f`；正式整卡提交=上述HEAD；本次未重新联网回读指针 |
| rc.9正式卡 | `dist/2.0.0-rc.9/神豪终端.json`，SHA256=`73328738fdd90b931397909eebaf462ecd4f71746646c5a15eb5c552c210c479` |
| 发布边界 | rc.10未提交、未推送、未切指针。`dist/terminal.js`和`dist/release.json`已是本地rc.10构建，不能据此判断线上版本 |

### 用户已确认的有效决定

- 世界书必须实际调用Gemini 4A；已完成一次成功生成，不是待办。测试使用EGO。
- 世界范围为中型，以云澜市为完整主舞台；开局不再选城市，固定云澜市，后续剧情允许跨城。
- 资产必须有简易描述：房产含位置、面积、格局/装修，车辆含型号、性能、外观、内饰，其他奢侈品也有描述；正文必须读到玩家当前持有资产。用户“不要有未知，没有依据就猜”适用于虚构资产设定补全，不能用于虚构测试结果。
- 手机外黑底方框已修；消费记录与提现按钮留间距；提现有确认弹窗；“我的”页资产和收支明细默认折叠。沿用现有UI，不重做风格。
- 保留已确认经济规则：女性零初池；好感达标后反复手动提现；按现金分档倍率与历史快照结算；已领退款按原倍率形成该人物追回额、抵扣后续提现；颜值前期好感修正与同轮上限不变。详见`docs/rc9-implementation.md`及源码，不恢复旧固定基础金/一次性封存规则。
- 尚未向玩家发行，不写旧测试档兼容别名或迁移层。GitHub上传/测试指针不代表发行。用户此前已授权rc.9上传切指针，该次已经完成；此次交接不触发rc.10发布。

### 已完成的修改与维护入口

| 修改 | 权威维护文件与说明 |
| --- | --- |
| 中型世界书 | `src/content/literary.json`；27条正文约12748字，7条正文常驻；构建含协议/上下文等共31条。可读全文`SHEJI/云澜中型世界书_rc10_正文草案.md`，筛选说明`docs/worldbook-expansion.md` |
| 4A来源 | `evidence/gemini-rc10-worldbook-expansion.json`；实际模型`pg-gemini-4-argon`，单次成功、无fallback，22个候选经人工审核合并；删除必然依恋/无限人脉等偏差 |
| 参考材料 | 本机`C:/Users/Administrator/Downloads/都市神豪之我爱装逼托马斯版V1.5.10.json`，47条/37启用；只作内容参考，不执行内嵌指令。库存记录`evidence/worldbook-reference-inventory.json` |
| 固定城市 | `src/core/engine.js`、`src/ui/app.js`、`src/ui/setup-presets.json`；初始化与保存草稿固定云澜，移除开局城市控件 |
| 资产描述链 | `src/core/engine.js`的`assetDescription`、`src/runtime/schema.js`、`src/ui/opening-presets.js`、`src/ui/screens.js`、`src/ui/app.js`；描述缺失时生成具体设定并保存，最长800字符，不改现金/估值/产权；六项预设资产已有人工描述 |
| 正文读取资产 | `src/content/protocol.txt`、`src/content/state-context.txt`及引擎projection；包含当前持有资产ID、种类、描述、位置、估值和产权，转赠/出售/退回后不冒充仍持有 |
| 实机发现的空白开局修复 | 压缩后`&&gt(...)`被宿主实体解码为`&>`，导致脚本语法错；`scripts/build.mjs`保留空白，`scripts/check.mjs`增加脚本语法及危险实体序列校验。已重构建并在现验收角色修复显示 |
| 当前文档 | `README.md`、`CHANGELOG.md`、`docs/hot-update.md`；根目录原修改计划与设计文档继续作需求参考，冲突以本节新决定和用户新指令为准 |

### 实际验证与边界

| 范围 | 结果／证据 |
| --- | --- |
| 自动测试 | 223通过、0失败，`.work/rc10-tests-final.log`；原215项加`tests/rc10-assets.test.mjs`8项，覆盖固定城市、描述补全/稳定/Schema保留、资产projection、转赠排除、购买退款 |
| 构建检查 | `node scripts/build.mjs --checkpoint`、`node scripts/check.mjs --checkpoint`通过；本次写交接未重复测试或重构建 |
| 开局实机 | 四预设、现金四档、颜值10个边界、城市控件移除、资产增删、熟人编辑取消/ID保留、确认前不初始化；`evidence/rc10-setup-matrix.json`。其中`previewHasDescription=false`来自闭合details的`innerText`，后续用`textContent`确认238平方米确实存在，勿误判为缺失 |
| 外观实机 | 三主题、两尺寸×三字号、根画布浅色透明与40px裁剪、折叠恢复、“我的”默认收起及切分类保持展开、车描述显示；`evidence/rc10-appearance-matrix.json`，截图`evidence/local/rc10-scene.png` |
| 图片实机 | 玩家头像、本地女性头像和竖立绘独立上传、contain、原图预览通过；`evidence/rc10-images.json`及`.work/rc10-images-01.mjs`/`02.mjs`。URL校验、移除、刷新持久化本轮未完成 |
| 真实正文请求 | 观测实际30条消息请求包含资产238平方米/米色真皮/资产ID/description、云澜扩写场所及pendingEvents协议；只留布尔检查，不保存完整私密提示。证明请求已发送，不等于模型正确使用 |
| 正文生成 | 原模型`pg-gemini-4-hydrogen-low`档案生成成功两次；首轮正文长时间无返回，在隔离测试聊天停止，没有产生新扣款事实。临时切4A对照请求已发起，最终结果未观察，不能判成功或失败 |
| 历史rc.9经济实机 | 100元消费→十倍1000元；已领后退20元→追回200元；再消费50元→实到300元；刷新、重开、Swipe回退验证见历史段和`evidence/rc9-runtime-summary.json`。这是旧版本受控夹具证据，不冒充rc.10全流程模型验收 |
| 仍待验证 | 日历新增/编辑/冲突/跨日；九类档案手动生成和锁；隐藏/恢复冻结与临时人物；支付拆分/购买/赠送/转让/出售/退款/反复提现及分页；两种解析模式最终请求；刷新/切聊天/Swipe/编辑删除；资产在真实回复中的使用；跨城、长期剧情；移动端原生指针/键盘及最终新鲜导入 |

已知开发边界：热替换整组脚本后曾暂留busy，单独重载本体恢复；最终新鲜导入与生命周期回归尚未完成。EGO在缩放iframe上的原生点击有偏移，部分操作用DOM click完成，不能写成触屏/鼠标点位全面通过。新增操作应等待真实状态条件，不用强制清busy来掩盖问题。

### 浏览器断点与临时设置（接手优先）

- EGO空间`3`，原管理页`p1`，酒馆`http://127.0.0.1:8000/`。最近测试角色为**神豪终端 rc10 全功能验收**，通过`.work/rc10-test-card.json`独立导入；不得改用户原角色/聊天。SillyTavern 1.19.0、TavernHelper 4.12.0、原生Mvu和Zod4已核验。
- 最后执行`.work/rc10-observe-story.mjs`返回`Control of this task space is with the user`。按EGO硬停止规则未重试、未夺回、未finish；用户仅要求写交接不构成恢复网页授权。收到明确继续测试后，在同一空间按当次EGO文档恢复，先检查tabs/角色/聊天，不假定旧p1标签始终有效，也不另开空间绕过。
- 最后成功观测存档：玩家云澜验收玩家、28岁、颜值95、现金100000000分（100万元）、3项资产、顾星遥/江映两位熟人，世界时间09:00。对照生成前消息数2。此为最后已知状态，恢复后必须重新读取，不能假定请求仍在运行或重发。
- 临时模型原值`pg-gemini-4-hydrogen-low`保存在`window.__rc10OriginalModel`，临时对照值`pg-gemini-4-argon`。`.work/rc10-model-retry.mjs`已执行过，**不可重跑**以免覆盖原值或重复触发。失去控制后尚未恢复原模型。
- 请求观测包装保留`window.__rc10OriginalFetch`、`window.__rc10RequestChecks`、可能的`window.__rc10GenerationError`。恢复时先保存脱敏布尔结果，再恢复fetch和原模型；若页面已刷新，钩子可能自然消失，但模型设置仍需核对。不得输出API密钥、登录信息、完整全局提示或其他私密世界书。
- `.work/rc10-observe-story.mjs`、`.work/rc10-generation-observe.mjs`可参考观察方式；`.work/rc10-reload-fixed.mjs`、`rc10-rebind-core.mjs`为已执行开发修复，不能盲重放。EGO每次命令是新Node进程；PowerShell用UTF-8 `.mjs`文件加`ego-browser nodejs -e "await import('file:///E:/CJBAOJISHENHAOZD/.work/新文件.mjs')"`，避免复杂内联脚本损坏引号。只能使用本次读到的驱动API。

### 接手顺序和完成标准

1. 先只读核对根`AGENTS.md`、本交接编号、`git status`、版本与成品SHA。保留现有未提交修改，先读相关技能；继续测试以用户明确指令为前提。
2. 获得继续指令后，恢复EGO同一空间，确认仍是rc.10独立测试角色，读取消息数、busy、错误和4A实际结果。已有请求先查，不盲目重新生成。收集脱敏证据后恢复原模型/fetch临时设置。
3. 将本轮结果集中整理为`evidence/rc10-full-runtime.md`（尚未创建），按上表待测项逐项验收；受控事实夹具明确标记，真实模型结果另记。修改UI或协议后按影响范围测试、构建并重新导入精确成品，不据热重载直接宣布最终包通过。
4. 修复失败项，完成最终新鲜导入、原生操作和生命周期矩阵；记录实际通过/失败/未验证，更新本文。长聊、CDN或正式包未测即保留缺口，不填成通过。
5. rc.10如要发布，结合用户当时指令按项目release门控执行测试→本体推送→CDN核对→同契约fallback→正式整卡构建/check→整卡推送→作者指针回读；本次只保存交接，不执行发布。

可复制开场白：

> $project-handoff 恢复并继续测试。项目 E:\CJBAOJISHENHAOZD，读取 PROJECT_STATE.md 的 PH-20261116-rc10-test-01，先核对版本和未提交改动。继续 rc.10 全功能实机验收；先恢复 EGO 空间3、核对4A请求结果并恢复临时模型/fetch，再做待测矩阵。保护原角色，区分自动测试/受控夹具/模型实际行为，维护交接文档；本轮不发布rc.10。

本机引用说明：以上`.work`、`.cache`、`evidence/local`及外部Downloads文件仅当前机器可用，可能不随Git交接。使用同目录接续时可读；换机器需另行准备，不据Git仓库假定它们都存在。
<!-- SH-HANDOFF-END PH-20261116-rc10-test-01 -->

## 以下均为历史记录（不作为当前操作状态）

## 历史：暂停测试期间的云澜世界书扩写（2026-11-16）

用户明确“暂停测试”，改为参考Downloads《都市神豪之我爱装逼托马斯版V1.5.10.json》的世界书，筛选适合本卡条目并调用Gemini4A。已确认中型范围，且取消开局选择城市，固定云澜市。原全功能矩阵暂停，未擅自继续；正式整卡刚导入独立角色“神豪终端 rc9 正式整卡全功能验收”，线上加载器实际运行7195a9a，fallback=false；其他正式整卡全功能项目尚未测。EGO空间3在本轮结束时报告已不归Agent控制，按硬停止未重新接管。

参考共47条（37启用）。已读与筛选世界、动态人物、事件延续、消费观念、圈层、反全知、对手、关系网及交易；不执行其中代码/指令，不套对方变量。筛选依据docs/worldbook-expansion.md。pg-gemini-4-argon已单次成功生成22个世界与场景候选，fallbackUsed=false；回执evidence/gemini-rc10-worldbook-expansion.json已读核对。审核合并后27条正文，维护源src/content/literary.json，可读全文SHEJI/云澜中型世界书_rc10_正文草案.md。修正了必然依恋/无限可调用人脉等候选偏差，细节见docs/worldbook-expansion.md。现有档案、好感、日历等条目继续保留，经济规则不变。新源码版本rc.10、cardContractRevision=6，尚未测试、构建或发布；线上仍rc.9。城市字段已从开局UI与建议选项移除，初始化固定云澜市，后续剧情跨城可正常进行。

追加用户需求已实现到维护源码：资产均有description（房产位置/面积/格局/装修，车辆型号/性能/外观/内饰，其他奢侈品款式/材质/特点）。用户明确“不要有未知，没有依据就猜”，因此描述缺失时合理生成具体设定并保存，不改估值、现金和产权。六项开局预设资产已有描述，自定义资产表单可填写描述，购买事件可给description；默认文字由assetDescription补足。schema/初始化/购买/“我的”显示/正文projection/_context与协议均已同步，正文读取当前玩家仍持有资产完整简述、位置、价值和产权信息，转赠或出售后不再当作玩家持有。尚未运行测试或打包，不能声称功能验收通过。

下一步：用户当前要求暂停测试，保持暂停。可以先审阅正文草案与资产描述；收到恢复指令后再验证rc.10描述链、固定城市和世界书加载，并按当前完整矩阵继续。线上仍rc.9的7195a9a，不会因本地rc.10源码而自动更新。

## 已完成发布、测试暂停：rc.9 GitHub发布与全功能实机验收（2026-11-16）

用户已明确授权“上传到GITHUB，更换指针，然后开始实机测试，该角色卡的所有功能”。按现有release.ps1门控执行：测试→本体提交推送→CDN核对→同契约fallback→正式整卡构建/check→整卡推送→切作者测试指针并回读，之后新鲜导入正式整卡逐项验收。发布成功：本体/ref/fallback=7195a9ac880de135468d22a10da6fcb28307743f，整卡提交=b232a6a（完整ID以git log为准）；215项npm test与正式build/check通过，本体及元数据CDN逐字核对通过。正式卡dist/2.0.0-rc.9/神豪终端.json，SHA256=73328738fdd90b931397909eebaf462ecd4f71746646c5a15eb5c552c210c479。旧ref=62bbd3ab84f952d2e46c9a3739692d463b411862。现开始正式整卡全功能实机矩阵，未写成已通过；下方本地候选为发布前历史，不据其“未授权发布”含义阻止本次操作。尚未向玩家发行。

## 发布前阶段：rc.9 玩法改造，本地候选（2026-11-16）

用户要求执行根目录《神豪终端_rc8_下一版完整修改计划.md》，并指定世界书调用Gemini4A、使用EGO测试。隔离分支 `codex/rc9-recurring-rewards`，基线7d1f8af；本轮源码尚未提交/推送，作者测试指针仍为rc.8，本轮未改线上配置。尚未向玩家发行，AGENTS优先于计划中的迁移建议：schemaVersion=3新聊天，不写旧档迁移层，保留rc.8成品及原聊天。

已实现：女性零初池、反复提现、五档现金倍率与历史快照、奖励领用归属、已领退款按原倍率记人物追回额并抵扣以后提现；统一账本投影人物消费记录（20条分页）和提现历史；1–100颜值与前期好感修正、普通同轮限12/有证据重大转折限30；开局颜值默认60；等级标签；模型协议支持元字符串与程序事实ID；世界书去开发历史、自然事件与按需场景条目。详细决定见docs/rc9-implementation.md，后续计划覆盖历史基础金/封存规则。

Gemini：evidence/gemini-rc9-worldbook.json，pg-gemini-4-argon成功、fallbackUsed=false。人工审核修正“女方单方面做事才奖励”和“查看即生成九类”等候选偏差，维护源src/content/literary.json。没有向世界书加入女性名单；用户可选初始熟人继续保留。

最新本地整卡：`dist/2.0.0-rc.9-checkpoint/神豪终端.json`，SHA256 `bf5f1ae1d1c68e12a7cac7d246c152715b95c15e28a282f6670c90891bbcee18`。内嵌本体，不读取线上指针。cardContractRevision=5；正式固定加载器整卡未产出，不可把rc.8 fallback套给新契约。215项npm test通过；之后仅修表单非法颜值检查及CSS/phone模板，checkpoint build/check再通过。最近UI修复后56项经济/几何定向测试通过。不是完整计划验收通过。

EGO空间3，p1酒馆；独立角色“神豪终端 rc9 独立验收”，聊天 `神豪终端 rc9 独立验收 - 2026-11-16@21h28m05s106ms`；酒馆1.19.0、助手4.12.0、原生MVU/Zod就绪。已用保存的API连接，模型pg-gemini-4-hydrogen-low完成开局正文与原生状态同步；其后以明确标记的隔离事实夹具验证，不能称为模型自主消费验收。玩家颜值95持久化，女性初池0。首消费100元→十倍实到1000元；退款20元→原倍率追回200元；新消费50元→理论500元、抵扣200元、实到300元。刷新/重开角色并重连API后余额101170元、两笔提款保留。切楼4到无交易Swipe回到100900元/一笔提款，切回恢复。直接parseMessage重解析经济不重发，但meta等完整JSON不相等且会暂留busy，刷新恢复，不能宣称完整状态逐字相同。摘要evidence/rc9-runtime-summary.json；原始证据evidence/local。

用户随后反馈并已修：深紫手机外黑色矩形来自文档color-scheme与宿主不一致；phone模板根节点标识surface，外层固定浅色透明画布、深色只在圆角手机内，EGO截图核对黑底消失；iframe容器随展开/折叠设置圆角裁剪，弹窗遮罩也不露矩形四角。提现按钮与消费记录增加14px间距。确认弹窗已验证先展示原池/倍率/抵扣/实到；打开和取消均不改整份存档。证据evidence/rc9-confirmation.json与evidence/local/rc9-purple-transparent-fixed.png、rc9-confirmation.png。新增第三笔10元书签消费仅供确认取消测试，未提现；当前余额101160元、提款仍2笔、待领原池10元。

新增用户反馈已实现：“我的”页持有资产、收支明细改为独立折叠区，默认关闭，标题显示项数/笔数。会话内保留展开选择，资产筛选或页面重绘不会关掉刚展开的列表；切换聊天重置默认关闭，仅为UI内存状态，不改MVU账本。EGO实机验证默认关闭、独立展开、资产分类后保留、键盘Enter展开账单、返回页面保留、再次关闭；证据evidence/rc9-mine-collapse.json与首次默认收起截图evidence/local/rc9-mine-collapsed.png；末次底部截图未覆盖右侧手机，不作视觉证据。checkpoint构建/check通过，测试角色已热重载；未为此低影响UI改动新增单元测试。

验证边界：EGO原生指针在缩放iframe上出现点击偏移，部分按钮用DOM click完成；不能当作触屏/鼠标点位全通过。三主题详情DOM无横向溢出，深紫截图已看；其他图片、日历、折叠、全部主题和尺寸矩阵未全重跑。100轮离线账本测试已过，不是50–100轮真实模型长聊；额外解析最终请求、完整模型行为、跨城长聊、正式CDN/指针/回退仍待验收。最新表单/CSS/容器已在测试角色热重载，开局旧消息载体仍为初次导入版，最终包需要重新导入完整新卡复核。

下一步：先核对git与该独立验收角色，继续计划F完整实机矩阵（两种解析模式、模型真实付款、头像立绘、三主题交互和长期剧情），修复发现的问题后再按G门控正式发布；补全README/更新日志及最终证据。不得将当前候选当作全计划完成或已上线。密钥/登录信息不写入交接。

## 历史：rc.8 开局修正（2026-11-16）

用户进一步要求：姓名/年龄不下拉；现金仅四档；居住方式可自由输入；修复空白点击使下拉反复重弹；字段选项翻倍、人物仍为6位；第一页提供穷光蛋开局/上班族牛马/小康人家/富家公子哥，分别0/1万/10万/100万元，除姓名年龄外填好全部设定、资产、熟人。已实现，见docs/opening-presets.md与DEC-019。

当前源码版本rc.8、cardContractRevision=4；162项测试、checkpoint及正式整卡构建/check通过。浏览器模拟桥接验证空白一次关闭、恢复焦点/选中不重弹、姓名年龄保留、现金无输入框、居住自由填写和资产熟人进入预览。页面截图接口在设备模拟下超时，不据此宣称截图验收；交互DOM回读有效。

已按既有授权推送GitHub并切作者测试指针：本体/ref/fallback=`62bbd3ab84f952d2e46c9a3739692d463b411862`，整卡提交=`36f22c76b06208995f0fb75336d24c2c52b11580`，off为空，公开读取与CDN元数据核对一致。当前固定加载器整卡 `dist/2.0.0-rc.8/神豪终端.json`，SHA256=`5dc60157f41d89c4da7559917fdb571ae5d5099318f7aaaa563eca9d24d5a4f6`。详细回执见evidence/rc8-github-test-release.md。EGO空间3已finish，保留酒馆页p1，下次claim后重新adopt。下方rc.7为历史发布事实，不据其旧ref判断当前测试版本。

发布后交接整理已随 `ac727a3` 推送；新增交接约定的文档提交以git log为准。当前没有待自动执行的功能修改。下一步是用户导入rc.8新整卡进行体验验收；若收到反馈，先核对卡版本、运行提交、具体聊天/楼层后按影响范围修复。rc.8完整新开局的真实酒馆端到端回归、两种解析模式最终请求和完整分支矩阵仍未全部重跑，不把162项自动测试或GitHub CI等同用户验收。

## 发布语义与兼容规则（持续有效，以下rc.7回执为历史）

**用户尚未明确向玩家发行角色卡。GitHub发布与作者测试指针切换均不算玩家发行。只有用户明确说已发布给别人玩，才需要考虑旧字段/旧存档兼容；此前允许直接改、删字段，不为旧测试存档建立兼容层。**规则同时写入根AGENTS.md与DEC-018。

本轮GitHub推送、CDN核对和作者测试指针切换已成功：本体提交 `d83b4055f10e43e133e12275bc640e3d00c438e6`，整卡提交 `3665d61e2b2bdbf42f80c93ea47a500bb3edfea6`。Supabase公开读取ref为本体提交，off为空；fallback同本体提交。正常固定加载器整卡为 `dist/2.0.0-rc.7/神豪终端.json`，SHA-256 `df37ea23ba787630b372bd799bf7a22a89303c81c1f9d1313c111cf45c75fd3b`。160项本地测试、正式整卡构建/check及CDN逐字核对通过。发布细节见 `evidence/rc7-github-test-release.md`。文档补录提交以git log为准。

注意：下方“本地验收版本”段落记录此前构建与验收阶段，当时“未推送/未切指针”的描述已由本节覆盖。这是作者测试发布，用户仍未确认向玩家发行。当前开局/卡契约有变化，测试使用新rc.7整卡；无需为旧测试存档增设兼容层。

## 历史阶段：rc.7 本地验收版本（2026-11-16）

本节优先于下方rc.6历史交接。用户本轮批准完整修改方案并要求执行，随后增加性格标签、体重KG、身高/三围CM、设置小中大字号与尺寸联动，以及浏览器缩放不累计缩小。

- 源码已实现：玩家年龄/外貌/身材展示；女性自动简易资料；手动九类建档与确认提示；逐人锁定停止发送；在场未锁定者完整资料、其他仅身份索引；现场神情移入展开区，补充动态字段，按后续要求移除关系备注栏；正式/临时人物隐藏确认；小中大字号、精巧默认中/标准默认小；浏览器DPR补偿与临时窗口适配分离。UI沿用原样式、三主题、四组档案入口。无旧档迁移。
- 当前配置版本2.0.0-rc.7、cardContractRevision=3，工作区有未提交修改。权威决定DEC-016/017，细节、数据归属、证据边界见 `docs/profile-update.md`、`docs/setup-presets.md`。总纲首段已注明新决定覆盖自动完整建档等旧描述。
- 后续开局调整已落地：此刻移除User标签，全部填写框可选预设并自由改写；初始熟人有6位预设成年女性；所有已添加熟人可编辑、取消不改、保存保留原ID。4A通过gemini-card-authoring单次调用pg-gemini-4-argon成功、无fallback，原始候选回执evidence/gemini-setup-presets.json，人工审核后的源src/ui/setup-presets.json。160项测试和本地浏览器点验通过，320px不溢出；本轮未声称重新导入酒馆验收。
- 本地整卡 `dist/2.0.0-rc.7-checkpoint/神豪终端.json`；**内嵌当前本体的本地验收卡**，不读取线上指针，不冒充正式热更新发布。附同版世界书、结构、正则和固定版本MVU依赖。
- `npm test` 160项通过，`node scripts/build.mjs --checkpoint`、`node scripts/check.mjs --checkpoint`通过。普通生产构建继续要求兼容fallback，不可为构建成功而指向rc.6旧契约。
- 真实酒馆独立角色 `神豪终端 rc7 独立验收`，聊天 `神豪终端 rc7 独立验收 - 2026-11-16@04h51m39s418ms`：模型简易生成（九类null）、九类手动生成、锁定排除_context、奖池不变、刷新重开后九类与锁定保留。最新本体在该测试角色脚本iframe临时加载，DPR/视口模拟80–200%往返，物理尺寸保持一致、所选0.82不变。字体三档及320px三主题溢出检查在本地预览桥接完成。
- 普通开局剧情预设首轮未提供有效原生更新，仍会出现可重试提示；没有放宽校验。未重跑全部额外解析/分支/经济矩阵，用户最终体验与正式发布待定。不要把静态共享上下文路由当成两模式最终请求抓包验收。
- 本轮未Git提交/推送、未改Supabase指针；线上仍为下方rc.6的B提交。`dist/terminal.js`和`dist/release.json`是rc.7构建输出，尚未推送，不据此宣称线上更新。
- EGO空间3已finish，保留p2酒馆独立测试结果页；下次claim后重新adopt。不要重跑.work旧脚本，其角色/楼层/测试状态绑定本轮。
- 下一步如继续：先git status和核对本地验收卡；按用户反馈完善验收。若用户要求正式热更新发布，按现有release流程验证新契约本体、CDN与fallback后再切指针，产出正式整卡；不要直接把旧fallback套给新结构。

---

<!-- CJ-HANDOFF-BEGIN PH-20261116-CJ-MVU-HOTUPDATE-01 -->

交接编号：**PH-20261116-CJ-MVU-HOTUPDATE-01**。更新时间：2026-11-16，Asia/Shanghai。
工作目录：**E:/CJBAOJISHENHAOZD**。本轮由用户手动要求接手；宿主聊天ID未获取，没有自动创建聊天。
状态：**rc.6已构建、推送并上线，专项离线与真实酒馆验证完成；用户最终体验验收待定。**

## 当前有效授权

恢复后用户先要求“没有你就帮我做Supabase 项目配置”，完成登录后明确 **“配置好就发布，测试”**，已解除上阶段“改好先别测试，先交接文档”的暂停。不要沿用旧暂停，不把发布授权写成人工验收通过。

本轮完成自有Supabase配置、测试、构建、GitHub推送、CDN核对、指针切换和真实酒馆专项测试。没有修改旧工作区，没有派生Agent。

## 成品与发布身份

- 整卡：`dist/2.0.0-rc.6/神豪终端.json`，V3 JSON，含世界书、正则、四条助手脚本；本轮没有生成PNG。
- 整卡SHA-256：`bd89e80d7800c3dfcd4c2ef97f5d14369b6a9f07225c84d1e8ebee5a755059f8`。
- 仓库：`https://github.com/1208496/cj-shenghao-terminal`，公开，main分支。
- 本体提交A：`622242380854a06beba7aa951b617cdc749fcbb5`。
- 整卡提交B：`86bc407ac4424abff18e054b6acb51b688ea0d67`。线上ref最终为B；内嵌fallbackRef为A。
- A/B的本体和元数据字节相同，实测两真实提交之间的指针切换，不宣称跨功能版本升级。
- 本体SHA-256：`086e544436642afde82254ea3255ef43ace667e9011213abd0ed8d8fb6ad9297`。
- 卡契约hash：`6a59e02aca8d479f88e959a8423e0d2d332c1f832ab4aa3c0a4a8e3df6c7d5a6`。
- 原有未提交源码和遗漏native测试随A提交，成品随B提交；之后仅整理文档/验收记录，不改已测产物。接手先git status核对新改动，文档提交号以git log为准。
- `updates/latest.json`及rc.5产物保留历史，新加载器不读旧清单，不以旧卡冒充本次交付。

## 自有Supabase已配置

- 用户组织 `1208496's Org`（免费）；项目 `cj-shenghao-terminal`，ref `yiddoiqeaunsupkjtrbe`，东京 `ap-northeast-1`。
- URL：`https://yiddoiqeaunsupkjtrbe.supabase.co`。
- 专用表：`public.cj_shenghao_script_config`。
- ref键：`cj_shenghao_terminal_v2_ref`，最终为B；off键：`cj_shenghao_terminal_v2_off`，最终空字符串，停用测试已清除。
- `release/setup.sql`已执行；RLS启用，公开角色只允许SELECT，服务角色SELECT/INSERT/UPDATE。新项目关闭自动公开新表，开启自动RLS。
- 公开URL/键/fallback在 `release/loader.config.json`。发布secret键仅在仓库外 `C:/Users/Administrator/.secrets/cj-shenghao-terminal.env`；数据库密码仅在同目录 `cj-shenghao-terminal-db.env`。**不要输出值，不进卡、不进git。**
- Supabase插件已安装，本轮无项目操作工具暴露；通过EGO控制台配置、PowerShell验证REST和发版。宿主Node直接请求项目REST遇ECONNRESET，PowerShell可用，不误判为数据库权限失败。
- 实测服务写入/公开读取成功，匿名POST/PATCH/DELETE均401；证据 `evidence/local/supabase-permissions.json`。

此前用户指定只读查找 `E:/XHCSXT`：香火卡自身使用GitHub Release/Pages；Supabase配置只在caokaojiaoben的SugarOS参考脚本中找到，所有权未确认，未复用。未修改该目录，未查浏览器登录资料或解码PNG。本项目已使用独立自有资源，不再向用户重复索要URL或公开键。

## 权威资料与有效决定

- `SHEJI/神豪终端_v2_超级设计总纲.md`：玩法/经济权威。
- `SHEJI/神豪终端_v2_交互前端原型_修正版.html`：UI权威，新增界面统一风格。
- 用户热更新文档：`C:/Users/Administrator/Downloads/酒馆脚本热更新 (1).md`，只读副本 `.cache/author-reference/酒馆脚本热更新 (1).md`。本机绝对路径仅适用于此Windows；项目内路径以工作目录为根。
- `CREATIVE_AUTHORITY.md`：决定和依赖账本；`docs/hot-update.md`：当前配置/发版；`evidence/hot-update-acceptance.md`：本轮专项验收。
- 旧 `E:/SHZD` 只读参考，不能在那里开发或写入，不继承旧仓库。

用户已确认：

1. 使用独立新公开仓库，匿名读取更新。
2. 明确成年且正式归档的女性各有¥10,000基础奖池，与开局现金独立；有效消费1:1入池。40/60/75/90/98分对应¥500/2,000/8,000/30,000/100,000，唯一配置在project.json。
3. 当前好感90可主动一次性提现，无恋人条件；89锁定。隐藏冻结追踪及奖励，真实支出仍扣；恢复不重发基础金、不传送。
4. 必须原生MVU与Zod；额外模型解析由原生MVU面板管理。手机不重建“剧情同步”开关，不强制覆盖原生更新模式。
5. 三入口为此刻/她们/我的；日历不自动赴约或消费，日期随剧情推进，不伪装电脑实时时钟。
6. 默认变量折叠框收起；优先隐藏正则保留、默认关闭。以代码文本转义，不改原始更新块。
7. 固定加载器→Supabase提交指针→jsDelivr完整提交本体；CDN核对后最后切指针，保底/回退/停用齐备。raw/main和直接替换卡内脚本的旧路线已否决。
8. 新方案交付整卡；世界书、正则、开场白和结构变化仍须重导整卡。只改手机脚本不能更新这些内容。

若共享app.js的开局行为/API改变，也须提高cardContractRevision并重发整卡。契约hash覆盖文学/协议、结构/注册器、原生MVU加载器、显示正则、固定加载器及校验契约、setup模板和revision。

## 验证结果与边界

- 本地149项通过：既有115项，加加载器17、PowerShell发布门控17。完整构建、语法和artifact check通过；GitHub Actions对A/B均success，链接见专项验收。
- 修复启动失败仍标记运行提交、git diff异常/整卡stage失败未阻断流程、无整卡差异时不执行最终push的问题；SQL收敛公开只读。
- release.ps1实际完成测试→core构建→A提交/push→CDN核对→fallback/整卡构建/check→B提交/push→指针A回读。实机阶段核对B的CDN后最终切B。
- 新鲜导入 `神豪终端6.png`（宿主导入JSON后分配的文件名），卡/世界书rc.6；默认三条脚本开启，全球备用关闭；MVU、Zod实际就绪。
- 独立聊天 `神豪终端 - 2026-11-16@03h54m08s265ms`：真实模型生成苏宁禾九类档案；原生额外解析10:00→10:05→10:08并记录衣着。实际300元付款、65分2000元奖金；UI提现12300元，余额100000→99700→112000元，关系仍朋友。
- 首轮预设只写故事，没有更新块；原生额外解析重试后记录。付款首份证据改写被保守拒绝，原生重试逐字引用后正常入账。未放宽证据校验，不能声称模型首次解析永远成功。
- UI检测/重载A→B、回退A、指针不可读保底、B的CDN不可读保底、正常恢复B、off停本体/手机、清off恢复B、整页刷新/重连API/重开聊天：**每次完整Mvu.getMvuData JSON均与基线相同**。正常仅一个手机。
- A/B代码相同，不是跨功能版本升级；不同契约拒绝、脏指针、内容错误、全部CDN失败有离线矩阵，未冒充所有异常均线上演练。
- 保底仍需CDN，不是完全离线启动；测试的是指针或指定目标不可达、保底CDN可达。
- 未重跑旧全部隐藏/恢复、资产、日历、swipe、图片矩阵；其历史范围见evidence/native-acceptance.md。人类体验和物理手机硬件验收仍pending。

完整本地轨迹、聊天备份、截图在git忽略的evidence/local。全视口截图 `rc6-phone-cdp.png`；EGO常规截图在125%浏览器缩放下截断右侧，不能据此认定手机未显示。临时网络封锁已清除，原生更新方式恢复本轮开始的“随AI输出”。测试人物只在隔离聊天，未进入成品。

## 实机、浏览器与继续入口

本机酒馆 `http://127.0.0.1:8000/`；实测SillyTavern1.19.0 / TavernHelper4.12.0 / 宿主Zod4。用户强调整页刷新后 **点插头、再点连接，确认API有效**；本轮已执行，最终有效。

导入前旧测试聊天已备份evidence/local/rc6-before-import-chat.json；未改用户手验的神豪终端3.png，也未覆盖其他角色或聊天。

EGO TaskSpace2已finish，保留酒馆结果页和自有Supabase主页；p2原型中间页关闭。finish后旧p1/p3标签失效，下次claim同一空间并重新adopt返回页面。用户接管、登录或认证提示按EGO硬停止，不绕过。

API缓存：.cache/helper（4b3ab7a5396369b15f4a1d9e5b2ced4aee84ec85，声明4.12.1，较实机邻近）；.cache/mvu（d03b7dc8a6ebf9bd611c7e2dc91f3b35462deebc）；.cache/tavern_resource（290eb3b610b6c3cab2cd437e0f111bcc23c4bf53）。版本敏感API须按目标宿主核对，不能用邻近缓存代替实机证明。

经验：MVU MESSAGE_RECEIVED有3秒节流；deleteChatMessages传整数数组；Managed ChatSurface可能不发标准删楼事件。不要直接重跑旧.work/native-*.mjs或本轮.work/supabase-setup-20261116脚本：硬编码角色/楼层/指针，有失败后被新脚本替代的步骤。

当前没有待自动继续的发布动作。让用户使用rc.6整卡；如有反馈，核对git、具体角色/聊天、运行提交后按影响范围修复和验证。下一次授权发版：`pwsh -NoProfile -File scripts/release.ps1 -Message "改动说明"`，通常不再-Bootstrap。演练后必须恢复线上指针/off。

可复制开场白：

`$project-handoff 恢复。项目E:/CJBAOJISHENHAOZD；读取PROJECT_STATE.md，编号PH-20261116-CJ-MVU-HOTUPDATE-01。rc.6已发布，自有Supabase已配，线上B=86bc407ac4424abff18e054b6acb51b688ea0d67，fallbackA=622242380854a06beba7aa951b617cdc749fcbb5。先核对git和用户反馈，再按具体范围继续；不要沿用已解除的暂停，不输出密钥，不重跑一次性测试脚本。149项离线和专项实机通过，用户最终体验待反馈。`

<!-- CJ-HANDOFF-END PH-20261116-CJ-MVU-HOTUPDATE-01 -->
