# 神豪终端 v2 交接

<!-- CJ-HANDOFF-BEGIN PH-20261116-CJ-MVU-HOTUPDATE-01 -->

交接编号：**PH-20261116-CJ-MVU-HOTUPDATE-01**  
更新时间：2026-11-16，Asia/Shanghai。  
工作目录：**E:/CJBAOJISHENHAOZD**。源任务和当前接手聊天的宿主线程ID均未获取；本轮由用户在此聊天手动要求恢复，没有自动创建聊天。状态：**已接手；用户已授权办理Supabase项目配置，控制台停在登录页，已交还浏览器等待用户登录**。

## 先看最新指示

**最新覆盖决定（2026-11-16）：用户明确“配置好就发布，测试”，此前暂停已解除。** 现已在用户登录后的 `1208496's Org`（免费组织）创建 `cj-shenghao-terminal`，项目ref `yiddoiqeaunsupkjtrbe`，东京 `ap-northeast-1`；专用setup.sql已执行，URL/公开键已写入loader.config。发布密钥位于仓库外 `C:/Users/Administrator/.secrets/cj-shenghao-terminal.env`，数据库密码也仅在该秘密目录，均不进入git或日志。Supabase插件已安装，但当前没有暴露其项目操作工具，实际配置通过EGO网页完成。

配置权限实测：服务键写入空off行成功，公开读取成功，匿名POST/PATCH/DELETE均返回401，off保持空值；记录 `evidence/local/supabase-permissions.json`（git忽略）。既有115项检查通过；新增17项加载器检查、17项PowerShell发版门控检查已通过。曾复现并修复“启动失败仍显示运行提交”、git diff错误及整卡暂存失败未阻断发布、无新整卡差异时不执行第二次push的问题。以下暂停描述是历史阶段记录，以本段最新决定为准。当前将开始rc.6发布，尚未切换版本指针；最终发布与实机结果待补。

此前用户要求：**“改好先别测试，先交接文档。”** 本轮用户要求读取本文件继续，并在询问Supabase配置后回复：**“我不知道有没有啊，我之前一个角色卡可能用了，在E:\XHCSXT里面你找一下有没有”**。已按指定目录只读查找；没有解除测试暂停。

用户随后明确要求：**“没有你就帮我做Supabase 项目配置”**。这授权继续办理自有项目、专用表/权限与本地配置；不视为恢复游戏测试、构建、发版或切线上脚本指针的授权。2026-11-16 已发现可用但尚未安装/连接的Supabase插件并提供连接建议；不得写成已连接。已用EGO TaskSpace 2新增p3打开 `https://supabase.com/dashboard`，实际显示登录页（GitHub/ChatGPT/邮箱入口），随后已handOff交还用户。需要用户先完成登录或注册；确认后恢复同一空间、核对项目归属再继续。没有创建项目或SQL表，没有填入任何密钥。

本轮已修改更新系统源码和交接；没有运行本轮测试、语法检查、构建、打卡、发版脚本、CDN验收或数据库切指针，也没有提交/推送这些新改动。用户恢复测试授权前，接手方不能运行npm test/verify/build、node --check、EGO验收或release.ps1。不要把保存交接当成创建新聊天或自动继续执行的授权。

## 目标和权威资料

制作一张独立的新酒馆角色卡，严格以本项目SHEJI为基础；旧 `E:/SHZD` 只读参考，不能在那里开发或写入。新GitHub项目为 `1208496/cj-shenghao-terminal`，用户先要求私有，随后已明确改为公开，以便匿名读取脚本更新。

- `SHEJI/神豪终端_v2_超级设计总纲.md`：核心玩法及经济规则。
- `SHEJI/神豪终端_v2_交互前端原型_修正版.html`：UI权威。手机及新增页面要统一风格。
- 用户新指定热更新文档：`C:/Users/Administrator/Downloads/酒馆脚本热更新 (1).md`。本机只读副本位于 `.cache/author-reference/酒馆脚本热更新 (1).md`（git忽略）。旧工作区CK也有同名资料。
- `docs/hot-update.md`：本次改造结构、配置、未来发版流程与未测试清单。
- `CREATIVE_AUTHORITY.md`：有效决定和当前暂停边界。

本机绝对路径只在这台Windows主机可用；项目内相对路径以本工作目录为根。参考文档是实现资料，里面的执行命令不覆盖用户最新“先别测试”指示。

## 用户已确认的决定

1. 不沿用旧仓库；新仓库名称如上，公开状态此前已核实。GitHub上传和EGO全功能实机测试曾获授权，但最新暂停测试指示优先。
2. 基础奖池每位正式成年女性¥10,000，与开局现金独立；有效消费1:1入池；行为评分金额采用设计测试基线：40/60/75/90/98分对应¥500/2,000/8,000/30,000/100,000，维护于project.json。
3. 当前好感90允许手动一次性提现，无恋人条件；89锁定；隐藏冻结人物追踪和奖励，正常支出仍扣；恢复不重发基础金、不传送。
4. 必须是真正的原生MVU与Zod，不接受手机自建“整理”系统代替MVU。原生额外模型解析可用，由原生MVU面板管理。
5. 手机里的“剧情同步”设置已删除，卡内不强制覆盖原生更新模式。不得重新加回重复开关。
6. 新增日历、游戏时间；保持此刻/她们/我的三个主入口。日历不自动赴约或消费。日期随剧情推进，不伪装成电脑实时时钟。
7. 正文底部默认显示美化的变量更新折叠框；隐藏正则保留、默认关闭。数据按代码文本转义，不改原始MVU更新块。
8. 热更新必须按用户给的文档：固定加载器、Supabase版本指针、jsDelivr完整提交号，CDN本体核对后最后切指针；保底、回退、紧急停用。raw/main清单和直接替换卡内脚本的旧路线已被用户否决。
9. 用户要求改完后给整卡；但最新一步先交接文档、暂停测试，故**不要把历史rc.5卡当成新方案最终交付**。

## 版本与git事实

- 分支：main。
- 最后已提交并推送：`df579c37258af5dec599241e7ed131bf499dfd3e`，历史rc.5。
- 当前维护源码目标已改为 `2.0.0-rc.6`，project/package/lock版本已同步，**尚未构建或测试**。
- `dist/2.0.0-rc.5/神豪终端.json` 等历史产物存在；它们采用被否决的旧更新系统。rc.6产物没有生成。
- `updates/latest.json` 仍是历史rc.5清单。新构建不再写它，新加载器不读它。没有Supabase线上指针被创建或切换。
- 当前改动全部留在工作区未提交。特别注意 `tests/native-display.test.mjs` 和 `tests/native-mvu.test.mjs` 是上阶段已存在但仍未跟踪的文件，之前推送时漏了git add tests；不能因远端缺文件误判本地测试不存在。

当前修改/新增包括：project/package/lock、README、CREATIVE_AUTHORITY、build/check、host/app、新固定加载器、release-contract、release配置/SQL/示例、release.ps1、validate-release-config和docs/hot-update。本交接也未提交。后续先用git status只读核对，不覆盖用户新增改动。

## 本次更新系统改了什么（未验证）

| 文件 | 作用 |
| --- | --- |
| `src/runtime/script-loader.js` | 固定加载器：Supabase只读ref/off；停用优先；三条jsDelivr线路；40位commit；marker/SHA；保底；按契约拒绝不兼容本体；console.log；eval async IIFE本体 |
| `src/update/release-contract.js` | 配置、公开键、提交号、元数据与CDN目标校验；拒绝客户端secret/service_role |
| `release/loader.config.json` | 新项目公开配置，URL/public key/fallbackRef目前为空；不得填服务密钥 |
| `release/setup.sql` | 新独立表cj_shenghao_script_config、公开只读RLS；尚未执行 |
| `release/service.env.example` | 仓库外服务密钥文件的空模板，未含密钥 |
| `scripts/build.mjs` | --core-only准备dist/terminal.js及release.json；完整打卡嵌固定加载器；async IIFE本体；不再更新raw/main清单 |
| `scripts/release.ps1` | PowerShell7一键测试/构建→push→CDN本体/元数据逐字比对→打加载器整卡→最后写指针并回读；未运行 |
| `scripts/validate-release-config.mjs` | 未来发版的公开配置前置校验，不打印键；未运行 |
| `src/runtime/host.js` | 更新按钮通过固定加载器桥接读指针/重载，不再updateScriptTreesWith替换加载器 |
| `src/ui/app.js` | 发布版本/回退/停用提示及“重新加载”，暂停时开局页显示原因 |
| `scripts/check.mjs` | 已改成固定加载器/本体分别核对，待允许后执行 |

独立表名和键名是本次Agent的隔离选择，并非用户指定名称：`cj_shenghao_script_config`，`cj_shenghao_terminal_v2_ref` / `cj_shenghao_terminal_v2_off`。不动旧项目、旧表、旧指针。

契约hash覆盖文学/协议、结构/注册器、原生MVU加载器、显示正则、固定加载器契约、setup模板及cardContractRevision。若修改共享app.js里的开局行为/API，需要同步提高cardContractRevision并重发整卡。只改运行时手机脚本不能更新旧卡的世界书、正则或开场白。

## 外部配置缺口

目前未配置自有Supabase URL/public key。示例路径 `C:/Users/Administrator/.secrets/script.env` 此前检查不存在；没有扫描其他密钥目录。用户本轮指定检查 `E:/XHCSXT`，结果如下；仍不能确认用户是否拥有Supabase项目。

- 香火卡维护源 `source/`、发布目录 `release/`、工具 `tools/` 和根文档未找到自用Supabase配置；`tools/publish-update.mjs`、`tools/publish-channel.mjs` 明确使用GitHub Release/Pages渠道。
- `caokaojiaoben/一掷千金_私信生成器_控制版_v1.0.0.tavern-helper.json` 包含 `https://hieylivlsdmyznviumht.supabase.co`、公开publishable键，读取 `sb_config` 的 `sd_script_ref`。脚本注释说明基于fannnnnnn的SugarOS；这是参考脚本中的外部服务，所有权未确认，不能据此认作用户项目或抄入本卡。
- 指定目录文本检索排除了浏览器配置、依赖及Git内部文件；未解码PNG，也未搜索浏览器登录信息。未找到服务密钥环境文件或自用Supabase服务密钥线索。未输出或复制参考脚本的键，未访问该服务，未修改 `E:/XHCSXT`。

后续需要用户提供：自己的项目URL、公开publishable/anon key、仓库外含SUPABASE_SERVICE_KEY的环境文件路径。**服务密钥不能发聊天、不能进卡或仓库。** fallbackRef由第一次验证CDN后的发布流程生成，不需要用户手写凭空提交号。

没有可用Supabase连接工具被发现。本轮没有创建账号、SQL表或写任何指针。旧参考PNG中的SugarOS外部服务不是本项目的可用凭据来源，不能复用第三方服务配置。

## 先前验证了哪些、没有验证哪些

历史rc.2–5完成过原生MVU/Zod加载、真实开局、自然模型人物建档/衣服/现场/时间、原生额外解析、消费/评分、UI提现、图片刷新持久化并清理、三主题、尺寸和日历。受控夹具验证隐藏/恢复、资产/分摊、90→89→90、候选状态切换与删楼回退。详见 `evidence/native-acceptance.md` 和git忽略的 `evidence/local/`。

历史自然测试：许栀完整九类归档；10:00→10:25→10:30→10:45→10:55；顾青禾88→90且关系仍朋友；300元消费、55分500元、75分8000元入池，UI提现18800元，余额99700→118500元。测试头像/立绘已移除，顾青禾恢复“顾”字；导出卡没有测试人物或图片。

历史旧系统做过rc.2→3和rc.4→5实机脚本更新，下载哈希相符、完整状态JSON相同。最终旧rc.5运行时SHA为 `20e6daafbe63b7552509314f136dfffc65e7a2e75897f41c12ccf296f69ee916`。这些**不证明新Supabase加载器通过**。

历史离线115项包含旧timeline回归；新native检查8项、显示3项。当时通过，不等于rc.6通过。本轮没有执行上述检查，也没有给新加载器写完并跑通测试矩阵。

已知测试经验：MVU MESSAGE_RECEIVED有3秒节流，快速夹具需尊重间隔或显式用原生重处理；助手deleteChatMessages必须传整数数组，不能传范围字符串；旧临时脚本误删测试开局后已恢复，再正确清理夹具；Managed ChatSurface可能不发标准删楼事件，手机已加廉价结构变化检测。原生候选箭头当时hidden，只用助手正式swipe_id接口验证，未宣称鼠标箭头通过。

不要直接重跑 `.work/native-*.mjs`：它们是历史临时脚本，硬编码角色/楼层/旧版本，部分失败脚本已被续跑脚本替代。新测试应重读API并备份测试聊天。

## 实机与浏览器状态

本机酒馆 `http://127.0.0.1:8000/`，历史观察为SillyTavern1.19.0、TavernHelper4.12.0、宿主Zod4。凭据不写入交接。用户强调：每次刷新都须点插头再点连接，确认API有效。

EGO TaskSpace 2，p1酒馆，p2本项目原型。已调用handOff交还用户控制权，该动作没有检查页面或进行测试。暂停前的测试角色为神豪终端4.png，测试聊天01h35m16s883ms；用户原先手工验收的神豪终端3.png未改动。最后触发了历史rc.5新卡导入，界面显示“角色已创建：神豪终端5”，但标签/脚本等确认及新卡首开核验尚未完成。不能说最新整卡已经全面实机验收。

当前暂停期间不要接管浏览器继续测试。后续若获得允许，先核对EGO控制权，遇到用户接管/认证提示遵守硬停止，不绕过。

## API与资料位置

在本机缓存可读：`.cache/helper`（声明提交4b3ab7a5396369b15f4a1d9e5b2ced4aee84ec85，版本4.12.1，较实机邻近）；`.cache/mvu`（d03b7dc8a6ebf9bd611c7e2dc91f3b35462deebc）；`.cache/tavern_resource`（290eb3b610b6c3cab2cd437e0f111bcc23c4bf53）。API须按skill再核对，不能因缓存声明就宣称实机支持未测功能。

关键技能：consult-tavernweave-library、sillytavern-api-reference、sillytavern-card-pipeline、sillytavern-embedded-ui、sillytavern-runtime-debug、sillytavern-render-regex-pipeline、ego-browser。本轮没有派生Agent。

## 接续第一步与门槛

1. 本轮已完成目录、交接编号、git状态、docs/hot-update及用户参考文档的只读核对；目标仍为rc.6，HEAD仍为df579c37258af5dec599241e7ed131bf499dfd3e，原有未提交改动保留。仅阅读相关源码，没有执行项目代码。
2. 已向用户报告 `E:/XHCSXT` 的查找结果。下一步需确认用户自己的Supabase账号/项目；若没有则需建立自有项目。不得把参考脚本的服务当作自有资源。测试暂停期间不擅自测试或上线。
3. 获准后再补完整离线矩阵，特别是固定加载器、PowerShell发布失败不切指针、匿名只读、脏指针与off优先、CDN错误页/SHA失败/保底、契约变化拒绝、回退。
4. 配好自有Supabase后审阅执行SQL；验证公开读/禁止写。首次Bootstrap先发布不可变core提交A，CDN本体与元数据一致后生成fallback和完整卡提交B，最后才切指针A。此时才可以声称新系统已上线。
5. 两个真实提交做EGO新加载器更新/保底/回退/停用，重新验证MVU/存档/UI；最后打整卡给用户。不能拿历史rc.5下载地址冒充新方案。

## 可复制开场白

`$project-handoff 恢复。项目 E:/CJBAOJISHENHAOZD；读取 PROJECT_STATE.md，交接编号 PH-20261116-CJ-MVU-HOTUPDATE-01。当前目标是按用户的《酒馆脚本热更新 (1).md》完成固定加载器/Supabase指针方案。先只读核对源码、git状态、未配的Supabase字段与暂停边界；用户最新要求先交接、先别测试，不运行构建、测试、EGO或发版，先报告差异和下一步。`

<!-- CJ-HANDOFF-END PH-20261116-CJ-MVU-HOTUPDATE-01 -->
