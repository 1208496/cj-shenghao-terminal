# rc.7 GitHub与作者测试指针发布

日期：2026-11-16（Asia/Shanghai）。用户授权发布GitHub，并明确发布时更换更新指针以方便作者测试。

这不代表角色卡已向玩家正式发行。只有用户明确说已发布给别人玩，才考虑旧字段与玩家存档兼容。已写入AGENTS.md、DEC-018、PROJECT_STATE.md。

| 项目 | 实际结果 |
| --- | --- |
| GitHub仓库 | https://github.com/1208496/cj-shenghao-terminal |
| 分支 | main |
| 本体提交 | d83b4055f10e43e133e12275bc640e3d00c438e6 |
| 固定加载器整卡提交 | 3665d61e2b2bdbf42f80c93ea47a500bb3edfea6 |
| ref公开读取 | d83b4055f10e43e133e12275bc640e3d00c438e6 |
| fallback | d83b4055f10e43e133e12275bc640e3d00c438e6 |
| off | 空字符串 |
| 整卡 | dist/2.0.0-rc.7/神豪终端.json |
| 整卡SHA-256 | df37ea23ba787630b372bd799bf7a22a89303c81c1f9d1313c111cf45c75fd3b |
| 本体SHA-256 | 444414974b544a096dda9af9f7489186de42b8f349b34154fade2336d82ea256 |
| 卡契约hash | 7577ff8c237077837001c44a81a814cfba4358c8a792659b7c0c32fb1ee4d9b8 |
| 上一个测试ref | 86bc407ac4424abff18e054b6acb51b688ea0d67 |

执行现有 `scripts/release.ps1`：160项测试→本体构建/语法→本体提交与push→jsDelivr本体和元数据逐字比对→更新fallback至已验证新本体→正式整卡构建/check→整卡提交与push→最后写ref并回读。之后以公开publishable读取再次核对ref/off及CDN元数据。

本体与整卡使用相同代码，不把两个打包提交之间的差异当成跨功能版本升级。GitHub Actions改为始终构建并检查完整开发checkpoint，避免新契约第一阶段提交误用旧fallback；正式发布仍由release.ps1执行兼容本体和CDN门控。

本地扫描46个待发布文件未发现私钥/密钥形状；.work、.cache、evidence/local与私密env不入库。公开Supabase键是既有客户端配置，不包含服务secret。发布服务凭证由仓库外文件读取。

整卡提交的GitHub Actions已完成且success：[Validate card #43763569168](https://github.com/1208496/cj-shenghao-terminal/actions/runs/43763569168)。真实酒馆/界面验收范围继续以docs/profile-update.md和docs/setup-presets.md为准，本次没有把GitHub推送当成用户体验验收。
