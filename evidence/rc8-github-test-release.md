# rc.8 作者测试发布（2026-11-16）

用户仍未声明向玩家发行。按既有GitHub推送与作者测试指针授权更新，兼容规则见根AGENTS.md。

| 项目 | 结果 |
| --- | --- |
| 本体提交、测试ref、fallback | 62bbd3ab84f952d2e46c9a3739692d463b411862 |
| 固定加载器整卡提交 | 36f22c76b06208995f0fb75336d24c2c52b11580 |
| off公开读取 | 空字符串 |
| 版本/契约revision | 2.0.0-rc.8 / 4 |
| 整卡 | dist/2.0.0-rc.8/神豪终端.json |
| 整卡SHA-256 | 5dc60157f41d89c4da7559917fdb571ae5d5099318f7aaaa563eca9d24d5a4f6 |
| 本体SHA-256 | d40b0dccd32038642a23ba636ed3c6e4b847807f5d9ed9d1bb96a976322ebc9b |
| 卡契约hash | dd2fbc3f8a58cf5cf909d3a6ff262802f7df8f3bb6b73277fd687bce2b6fa8e2 |
| 上一个测试ref | d83b4055f10e43e133e12275bc640e3d00c438e6 |

现有release.ps1完成162项测试→本体构建/语法→本体推送→CDN本体和元数据逐字核对→兼容新契约fallback→正式整卡构建/check→整卡推送→最后写ref并回读。另以公开客户端键读取ref/off和CDN元数据，值与本地一致。待发布文件扫描无密钥形状，私有凭证不进仓库。

功能、数据和验收范围见docs/opening-presets.md。本轮浏览器模拟桥接已回读空白一次关闭、程序焦点不重弹、选项选择后关闭、姓名年龄保留、四档现金无输入框、居住自由输入及资产熟人进入开局预览。截图接口在设备模拟时连续超时，未将截图当成通过证据；没有把本地桥接验证写成新整卡已完整实机验收。

GitHub检查：[Validate card #43765588317](https://github.com/1208496/cj-shenghao-terminal/actions/runs/43765588317)，已完成且success。
