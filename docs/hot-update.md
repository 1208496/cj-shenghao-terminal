# 固定加载器与版本指针

rc.6已于2026-11-16完成构建、公开仓库推送、CDN核对、Supabase指针上线和专项实机验证。用户“配置好就发布，测试”已解除此前暂停。见 [专项验收](../evidence/hot-update-acceptance.md)和 [PROJECT_STATE](../PROJECT_STATE.md)。

## 结构与当前配置

- 卡内e3b93f04固定加载器：src/runtime/script-loader.js。
- 本体dist/terminal.js，头部 `// CJ_SHENGHAO_TERMINAL_CORE`，async IIFE。
- dist/release.json为同一不可变提交内的版本/SHA/卡契约元数据，不是线上指针。
- 自有Supabase项目cj-shenghao-terminal，东京，`https://yiddoiqeaunsupkjtrbe.supabase.co`。
- 表cj_shenghao_script_config：cj_shenghao_terminal_v2_ref存40位提交；cj_shenghao_terminal_v2_off非空则停用。
- 线上ref B=`86bc407ac4424abff18e054b6acb51b688ea0d67`；fallback A=`622242380854a06beba7aa951b617cdc749fcbb5`；off为空。
- A/B的core及元数据字节相同，B增加完整加载器卡。本轮切换不冒充跨功能版本升级。

加载器先读Supabase；off优先，再依testingcf、fastly、cdn三条jsDelivr线路尝试完整提交。失败转内嵌fallback，核对marker/SHA/卡契约；启动成功才记录实际运行提交。不用@main或raw/main，不替换固定加载器。

保底仍需CDN：能处理指针不可读或指定目标不可达，不是在完全断网时首次下载本体。全部失败明确提示，不伪造启动成功。

## 权限与密钥

release/setup.sql已执行，RLS启用，公开角色只有SELECT，服务角色SELECT/INSERT/UPDATE。实测公开读成功，匿名POST/PATCH/DELETE均401。

release/loader.config.json已填写URL、公开publishable键和fallback。公开键可进卡；服务secret键仅存仓库外 `C:/Users/Administrator/.secrets/cj-shenghao-terminal.env`，变量SUPABASE_SERVICE_KEY由发布端读取。不要输出值或填入客户端配置。

现代publishable/secret键放apikey，旧anon/service_role JWT兼容Bearer，见 [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)。客户端配置校验拒绝服务键。未复用SugarOS参考项目，未改旧工程。[自有项目主页](https://supabase.com/dashboard/project/yiddoiqeaunsupkjtrbe)。

## 后续发版

在本项目main分支使用PowerShell7：

```powershell
pwsh -NoProfile -File scripts/release.ps1 -Message "改动说明"
```

流程：公开配置/remote/分支校验→当前149项检查→core构建/语法→提交/push→CDN本体和元数据逐字比对→保底兼容检查→完整卡构建/check→整卡提交/push→最后写ref并回读。

首次Bootstrap已完成，通常不再传-Bootstrap。检查/stage/diff/commit/push/CDN失败均不切指针；写入后的回读失败要先查服务器状态，不能假定指针没动。常规发版不自动清off。GitHub Actions取完整历史以核对fallback；初始无fallback的core提交仅做core gate，整卡提交做完整gate。

## 回退、停用与兼容

回退先核对目标完整提交的CDN及卡契约，再改ref。off非空在加载器下次运行时阻止本体；清空再重新加载恢复，不会向已运行客户端广播停用。

世界书、开场白、正则、结构变化需重导整卡。修改共享app.js里的开局行为/API也要提高cardContractRevision并发整卡。仅换手机脚本不能更新这些卡内内容。

旧内嵌完整版玩家须先导入一次rc.6加载器整卡，以后才自动按指针取更新。本次成品dist/2.0.0-rc.6/神豪终端.json，历史rc.5不是新方案交付。
