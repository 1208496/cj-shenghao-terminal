# rc.11 开局加载修复（2026-11-16）

用户要求读取 PROJECT_STATE，参考桌面 V1.2.26.png 修复开局加载卡顿；随后明确授权推送 GitHub、切换作者测试指针。尚未向玩家发行。

## 原因与修改

- 参考卡 SHA256：c116d6817d528f596df32d54ce8795ab8fc9031d4d3e26c83894946770ee6552，3163833字节。只读拆解位于本机 .work/opening-reference-20261116，未执行其代码，未把参考卡内容入库。原始消息用 CustomOpening 短载体，局部显示正则展开内嵌 HTML，表单本地 ready 绑定；只参考加载结构。
- 原卡 app.js 先等父级终端桥接，100×100ms 后才显示错误；在此之前 app 为空。现直接恢复当前聊天 UI 草稿并绘制表单，后台轮询连接；三步填写和预览可先进行，提交仍受依赖、忙碌状态及宿主原有校验保护。
- 原卡把整套 HTML/JS 放入 first_mes。现改为 CJ_SHENGHAO_OPENING 短标记，由随卡显示正则展开、提示词正则移除。原消息 161387 bytes，现 342 bytes。整体角色卡并未按此比例变小，远程依赖也未被删除。
- 复用每个聊天的 cj-shenghao:ui:v3 草稿键；输入即时保存，连接交接前同步已编辑草稿；跨聊天不转写草稿。状态通知只更新提示与按钮，不替换正在填写的 DOM。
- 实机暴露 MVU 开局初始化/parseMessage 只发 STARTED/ENDED、不发 BEFORE_MESSAGE_UPDATE，旧代码会遗留 mvuBusy。现在在对应 ENDED 释放忙碌标记并调度读取；没有强行定时清 busy。
- ST 1.19.0 正则引擎采用替换回调，不将 $$ 还原为 $。首次候选的美元符号转义已撤销，构建拒绝 $n / 命名捕获等宿主替换标记，避免损坏模板字符串。

## 权威源、依赖及工作流

维护源：src/ui/app.js、src/ui/setup-draft.js、src/runtime/opening-display.js、src/runtime/host.js、scripts/build.mjs、scripts/check.mjs；未重设计 UI、未改经济规则。rc.11 包含此前未发布的 rc.10 世界书、固定云澜和资产描述。cardContractRevision=7，schemaVersion仍为3，需要重新导入新整卡以更新开局/正则/世界书。

已有 node scripts/build.mjs --dry-run --checkpoint 核对新输出目录；build --checkpoint 写 dist/2.0.0-rc.11-checkpoint、dist/terminal.js、dist/release.json 及被忽略的中间文件 src/ui/phone.html；check --checkpoint 只读检查。rc.10 成品保留。本次迭代重复构建的是同一未发布候选，最终哈希为 d41afe6c45df85ea861cb494892bacbd92bcaeb76423ca7dd5e1c3353082ff7f。正式发布另用 scripts/release.ps1。

仍随卡内嵌 Zod注册、国内MVU加载器、关闭的全球备用及终端；宿主为 SillyTavern 1.19.0 / TavernHelper 4.12.0。MVU固定提交 d03b7dc8a6ebf9bd611c7e2dc91f3b35462deebc；结构注册和MVU仍有HTTPS依赖。表单本地可填不等于断网可开始游戏。

路由回执：TavernWeave snapshot 2026-08-18，components/pipeline；ST-A0/A2/A6/D1/D4；无设计候选。API依据：本机 .cache/helper/@types/function、同提交 .cache/mvu/src/function/initvar/variable_init.ts 和 update_variables.ts；运行中读取的 /scripts/extensions/regex/engine.js（本机 .work/host-regex-engine.js）。

## 已验证

- 226项自动测试全部通过；日志 .work/rc11-tests-final.log。checkpoint build/check 通过，新增短载体、宿主替换保真、草稿聊天隔离、存储失效回归。
- EGO空间3独立角色「神豪终端 rc11 加载修复」新鲜导入本地候选；未改用户原角色。主脚本未启用时三步及预览可用，提交禁用，只有1条消息且无正式初始化。证据 rc11-opening-offline-form.json（受控DOM操作）。
- 修复后的本体通过角色脚本接口更新，再完整刷新并重开独立角色；实际运行脚本内容/开关逐项等于最终成品，显示正则完全相同，实际消息等于成品 first_mes；宿主角色字段仅LF→CRLF，规范化后一致。见 rc11-opening-reload.json。
- 输入与键盘返回、草稿恢复；parseMessage 结束 busy=false、不写楼层变量、输入节点/焦点/选区保留。见 rc11-opening-connect.json。截图 evidence/local/rc11-opening.png 已查看。
- 依赖就绪后最终预览按钮可提交，busy=false，仍1条消息；没有为此发送正文或付费生成。
- 真实宿主提示词正则移除标记和界面代码，保留开场叙述。真实网络模型请求未在本轮发送。
- 同一EGO内受控双iframe加载原/新维护成品，故意不提供终端桥接：新表单2.7ms创建，约109ms观察时可见；原约112.5ms时仍空白。见 rc11-opening-controlled-timing.json。这是隔离浏览器机制检查，不是冷缓存全链路速度承诺。

## 边界与后续

- 首次候选有美元符号问题，已经修复；本体 busy 修复发生在新鲜导入之后，随后经持久更新、完整刷新和成品逐项比对。完整最终正式包需要发布后再次导入检查线上加载器。
- 原生点位点击曾有等待条件与实际步骤不一致，后续读取确认已返回，并用键盘继续；不把本轮称作移动端触控全面验收。窄屏、低速公网、冷缓存CDN、真实模型开局及rc.10全功能矩阵仍待验。
- 本轮恢复交接时酒馆在首页，旧4A请求的最终结果不可确认；已恢复 pg-gemini-4-hydrogen-low 并移除旧fetch包装，未重发请求。后续整页刷新移除临时诊断对象。

## 发布后补验

正式整卡SHA256 417080e7aef33e13d907669feb1f2487ec5927669c70c538ce729b9c08f82f3a；已新鲜导入独立正式验收角色，消息/正则/脚本与正式包一致。线上ref=e2f4058112cc29c4b547e8cc44a3d5501b6f0ddd，fallback=false、pointerAvailable=true、nativeReady=true、busy=false。见 rc11-release-runtime.json 与 rc11-release-receipt.json。原先“最终正式包待导入”的缺口由此关闭；完整模型/玩法/移动设备缺口不变。浏览器已finish保留结果页。
