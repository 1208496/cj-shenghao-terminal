# 运行依赖与来源

| 依赖 | 来源与固定版本 | 用途 / 许可 |
| --- | --- | --- |
| SillyTavern | 实机1.19.0 | 宿主 |
| Tavern Helper | 实机4.12.0；声明参考4.12.1提交4b3ab7a5396369b15f4a1d9e5b2ced4aee84ec85 | 消息、世界书、脚本、Zod4能力 |
| MagVarUpdate | [上游](https://github.com/MagicalAstrogy/MagVarUpdate/tree/d03b7dc8a6ebf9bd611c7e2dc91f3b35462deebc) | 原生MVU；MIT |
| StageDog mvu_zod | [上游](https://github.com/StageDog/tavern_resource/blob/290eb3b610b6c3cab2cd437e0f111bcc23c4bf53/util/mvu_zod.ts) | registerMvuSchema；[PolyForm Noncommercial 1.0.0](https://github.com/StageDog/tavern_resource/blob/290eb3b610b6c3cab2cd437e0f111bcc23c4bf53/LICENSE) |

MVU从testingcf.jsdelivr.net固定提交加载；全球备用为cdn.jsdelivr.net同一提交。注册器也使用固定提交并提供这两条线路，可能继续加载其上游声明的运行库。角色卡不复制未知外部业务脚本或服务配置。联网不可用时不可声称变量框架已就绪。

开局档案生成仍使用酒馆当前API；这是人物资料准备。剧情额外解析由原生MVU负责，遵循MVU面板的接口与模型配置。手机没有自定义第二解析器。

本地开发使用esbuild 0.25.12和zod 4.6.7。浏览器实际结构使用宿主提供的Zod4，不打包另一份实例替代宿主。
