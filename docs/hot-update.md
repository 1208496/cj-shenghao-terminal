# 固定加载器与版本指针

2026-11-16接手后，用户明确“配置好就发布，测试”，已解除下文历史暂停。自有项目 `cj-shenghao-terminal`（东京，ref `yiddoiqeaunsupkjtrbe`）已创建，setup.sql已执行，URL/公开键已配置；服务键仅存仓库外。服务写入、公开读取成功，匿名POST/PATCH/DELETE均被拒。加载器与PowerShell发版门控新增34项专项检查通过；最终发布和实机结果以PROJECT_STATE最新段落为准。

本轮按用户提供的 `C:/Users/Administrator/Downloads/酒馆脚本热更新 (1).md` 改造。旧项目 `E:/SHZD/CK/酒馆脚本热更新 (1).md` 也有同名参考。2026-11-16 用户要求“改好先别测试，先交接文档”，因此以下命令均未执行，未创建表、未切换线上指针、未生成rc.6整卡。

## 三个组成部分

- 卡内e3b93f04脚本只保留固定加载器：`src/runtime/script-loader.js`。每次打开先读Supabase，再按完整40位提交号下载脚本。
- 本体为 `dist/terminal.js`，文件头为 `// CJ_SHENGHAO_TERMINAL_CORE`。构建会包为async IIFE，供参考文档的eval加载方式使用。
- Supabase新独立表 `cj_shenghao_script_config` 的 `cj_shenghao_terminal_v2_ref` 行只存提交号；`cj_shenghao_terminal_v2_off` 非空即紧急停用。新表、新键是本次隔离旧项目的实现选择，SQL尚未执行。

三条CDN按testingcf、fastly、cdn顺序尝试，使用 `@完整提交号`。候选下载失败则尝试内嵌的fallbackRef；不使用@main，不使用raw.githubusercontent.com作为本体或版本源。marker与SHA-256均核对；日志使用console.log。

`dist/release.json` 是同一不可变提交内的版本/哈希/契约元数据，不是可变线上指针。世界书、开场白、正则、结构或加载器契约不兼容时，客户端不运行新本体，改用保底并提示导入整卡。手机按钮只读指针并重新加载原固定脚本，不再用updateScriptTreesWith替换加载器。

## 配置尚缺

`release/loader.config.json` 的supabaseUrl、publishableKey、fallbackRef目前为空。不能把它当作已配置可用的加载器。

需要用户自己的Supabase项目URL、公开publishable/anon key，以及仓库外保存 `SUPABASE_SERVICE_KEY` 的文件。参考路径 `C:/Users/Administrator/.secrets/script.env` 已检查不存在；其他密钥位置未扫描，用户是否已有项目未确认。不要要求用户把secret/service_role发到聊天或写进仓库。

2026-11-16 恢复后，按用户指定只读查找了 `E:/XHCSXT`：香火卡维护源和发布工具采用GitHub Release/Pages；Supabase地址及公开键只在 `caokaojiaoben` 的SugarOS参考脚本中找到，不能证明是用户自己的项目，未复制使用。未找到自用服务密钥文件线索；浏览器登录资料和PNG载荷未搜索。具体证据与范围见PROJECT_STATE的“外部配置缺口”。

公开键可嵌入加载器，secret只由发版脚本读取。现代sb_publishable_/sb_secret_用apikey；仅旧JWT anon/service_role同时使用Bearer，依据[Supabase官方迁移说明](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)。客户端配置校验会拒绝service_role和sb_secret_。

## 用户允许测试后的发版顺序

1. 配好自己的Supabase项目和公开配置，审阅并执行 `release/setup.sql`。只影响新独立表。
2. 把 `release/service.env.example` 的结构放到仓库外，填服务密钥；完整值不要进git。
3. 初次使用PowerShell7执行 `pwsh -NoProfile -File scripts/release.ps1 -Message "首次固定加载器" -Bootstrap -EnvFile "仓库外环境文件路径"`。
4. 脚本依次做测试、构建本体、语法检查、提交推送、核对CDN本体和元数据与本地完全一致、设置兼容fallback并打整卡，最后才更新Supabase指针并回读。任何前序步骤失败都不切指针。
5. 后续仍用同一发版命令，通常省略-Bootstrap。新版本只有脚本本体变化时，玩家下次开卡自动用新本体；已装完整内嵌脚本的旧玩家须先手动换一次加载器。

当前用户明确暂停测试，接手方不能因为上面写有命令就运行它。此文档是接续说明，不增加权限。

## 回退、停用和边界

回退把ref行改回已验证的旧提交；客户端按指针加载旧版，不强制只升不降。停用写off行，恢复删除该行或清空；常规发版脚本不自动清除off。指针访问失败时用内嵌fallback，不改存档。

世界书、开场白、正则不能靠这套脚本更新。现有构建契约检查相关内容；若修改共享app.js中的开局行为/API，也要同步提高cardContractRevision并重新发整卡，不把仅替换手机脚本当作更新了旧开场页。

## 下一步测试清单（尚未执行）

先补离线加载器与发版脚本夹具：正常指针、脏指针、缺行、停用优先、主CDN失败、错误页、marker错误、SHA错误、保底失败、契约不兼容、匿名写入被拒、语法/推送/CDN失败不切指针、切换回读不符。

再用自有Supabase和新GitHub仓库实测两个真实提交，在EGO酒馆验证自动取新版、回退、停用、断网保底、MVU原生状态和图片不丢失。rc.5旧方案的“115项通过”和旧热更新记录均不证明本轮实现已经通过。
