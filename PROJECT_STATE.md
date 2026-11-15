# 神豪终端 v2 交接

维护约定：每次项目任务或可验收阶段结束前主动更新本文件，不等用户提醒；规则已写入根AGENTS.md。以顶部当前状态为准，后续版本段落为历史。

## 当前工作：rc.8 开局修正（2026-11-16）

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
