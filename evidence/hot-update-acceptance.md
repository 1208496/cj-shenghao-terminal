# rc.6 固定加载器专项验收

日期：2026-11-16，Asia/Shanghai。用户明确“配置好就发布，测试”。自动化、线上发布、真实酒馆与人工体验分别记录；人工最终体验仍pending。

## 发布身份

| 项目 | 结果 |
| --- | --- |
| 版本/类型 | 2.0.0-rc.6 / mvu_zod |
| 本体提交A | 622242380854a06beba7aa951b617cdc749fcbb5 |
| 整卡提交B、最终线上ref | 86bc407ac4424abff18e054b6acb51b688ea0d67 |
| fallbackRef | A |
| core SHA-256 | 086e544436642afde82254ea3255ef43ace667e9011213abd0ed8d8fb6ad9297 |
| 整卡JSON SHA-256 | bd89e80d7800c3dfcd4c2ef97f5d14369b6a9f07225c84d1e8ebee5a755059f8 |
| 契约hash | 6a59e02aca8d479f88e959a8423e0d2d332c1f832ab4aa3c0a4a8e3df6c7d5a6 |
| 成品 | dist/2.0.0-rc.6/神豪终端.json；本轮无PNG |

A/B的core和元数据相同，B增加整卡。测试两真实提交间的分发切换，不声称跨功能版本升级。release.ps1先验证A的CDN，再打整卡和切指针A；实机阶段再次验证B的CDN后最终切B。

本地149项通过（既有115+加载器17+发布门控17），完整构建、语法、artifact check通过。GitHub Actions [A](https://github.com/1208496/cj-shenghao-terminal/actions/runs/43754948244)、[B](https://github.com/1208496/cj-shenghao-terminal/actions/runs/43754958165)均success。

最终又从B的公开CDN匿名下载完整角色卡JSON，SHA-256与本地成品逐字节一致；公开回读ref=B、off为空。整理记录没有重建或改动已验证成品。

发布门控夹具实际执行release.ps1，替换git/npm/HTTP外部操作，覆盖配置、测试、core/整卡构建、语法、stage、diff、commit、push、CDN失败不写指针，以及写入后回读不符。不是仅用源码字符串断言。

## 权限与真实模型

Supabase自有项目yiddoiqeaunsupkjtrbe，表cj_shenghao_script_config。服务写入、公开读取成功；匿名POST/PATCH/DELETE均401。setup.sql撤销公开角色全部表权限后只授SELECT，启用RLS。最终off空字符串。

宿主SillyTavern1.19.0 / TavernHelper4.12.0 / Zod4，8000端口。新导入JSON分配为神豪终端6.png，测试聊天03h54m08s265ms。世界书rc.6；Zod注册/国内MVU/固定加载器启用，全球备用关闭，能力实际就绪。

真实模型生成苏宁禾九类初始档案；原生额外解析推进10:00→10:05→10:08、记录衣着。300元付款令现金100000→99700元；65分按配置记2000元奖金。基础10000+消费300+行为2000，UI手动提现12300元后余额112000元，关系仍朋友。

首轮受当前写作预设影响没有更新块，原生额外解析重试后记录。付款第一次证据包含改写，被校验拒绝，没有误扣；原生重试返回逐字证据后正常入账。保留这一限制，不把模型首次成功率写成100%。额外模式测试后恢复原“随AI输出”，没有强制覆盖模式或新增手机同步开关。

## 真实热更新矩阵

| 场景 | 观察 | 原生MVU完整JSON |
| --- | --- | --- |
| UI检测并重新加载A→B | 更新提示、实际ref=B、单手机 | 与基线相同 |
| 指针回退B→A | 实际ref=A，不强制升版 | 相同 |
| 浏览器封锁项目指针请求 | fallback=A，pointerAvailable=false | 相同 |
| 封锁B的CDN请求 | fallback=A，pointerAvailable=true | 相同 |
| 清除网络封锁 | 运行B，无fallback | 相同 |
| off非空后重载 | 无运行本体，无手机 | 相同 |
| 清off并重载 | 恢复B，单手机 | 相同 |
| 整页刷新、点插头重连、重开聊天 | API有效，B，余额112000元 | 相同 |

比较包含整份Mvu.getMvuData，不只比余额。临时CDP网络封锁已在finally清除；off测试后清空。停用是下次加载生效，不是在线广播。完全断网启动、跨功能版本升级、不同契约线上演练不在本轮实机结论内；对应拒绝/失败逻辑有离线矩阵。

测试数据只在独立聊天，未进入成品；旧角色、旧聊天未覆盖，导入前有备份。本轮未重跑旧隐藏/恢复、图片、日历、资产、swipe完整矩阵，其历史范围见native-acceptance.md。没有物理手机硬件或用户人工验收结论。

完整本地证据在git忽略的evidence/local：supabase-permissions.json、rc6-imported-identity.json、rc6-update-baseline.json、rc6-native-before-updates.json、rc6-runtime-matrix.json。全视口截图rc6-phone-cdp.png已目视核对；常规EGO截图在125%缩放截断右侧，因此改用CDP捕获。

## 交付边界

卡内四脚本、世界书、正则已按构建和导入核对；MVU/StageDog/终端本体为固定提交远程依赖，公开指针为远程服务，酒馆助手和Zod4为宿主能力。Node/esbuild/开发用zod不作为玩家安装要求。卡/世界书版本一致，历史产物保留。

服务键和数据库密码在仓库外；公开键按设计嵌入加载器。未输出密钥、未复用第三方项目，无新依赖或架构重写。修复只覆盖加载器运行标记和发布失败门控，并补对应回归。

技能路由：card-pipeline，资料库快照2026-08-18，A0/A2/D1/D4；API声明取项目缓存并在目标宿主探测，真实执行用runtime-debug/EGO。Supabase参考当前API安全/API keys官方文档。源码/离线/发布/人工门独立保留，最终体验等用户反馈。
