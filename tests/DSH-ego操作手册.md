# DSH 必读 · ego 操作测试酒馆手册（2026-11-17 YG 定）

> 这份是写给 DSH 的**操作手册**，优先级高于 `tests/live-ego.md` 里的旧代码片段。
> 写这份的原因：DSH 在 8001 测试酒馆上反复出现「弹窗不点、世界书没导就开局、开过局还重填表、小手机没出来也不发现、绕过酒馆直接拷卡」。
> **按本手册一步一步做，每一步过了关卡才准走下一步。不准自己发明捷径。**

---

## 〇、先背下来的 7 条禁令

| # | 禁止 | 为什么 |
| --- | --- | --- |
| 1 | **禁止把卡的 json/png 直接拷进 `data\default-user\characters`（或 worlds）冒充导入** | 拷进去的卡不会走导入弹窗，世界书不会导入、不会绑定。卡**只能**在酒馆界面里导入：右上角色管理 → 导入 → 选文件（ego 里就是 `setInputFiles("#character_import_file", …)`），然后把弹窗一个个按「是/确认」 |
| 2 | **禁止页面上挂着弹窗就往下走** | 每一步结束都要确认 `.popup` 一个都没有。看到弹窗先读字、认出是哪一种（见第二节表格），再点对应按钮 |
| 3 | **禁止世界书没导入就开局** | 没世界书 = MVU / 小手机全废，开出来的局毫无测试价值 |
| 4 | **禁止开过局之后重填开局表** | 只要聊天里已经有你的开局消息（楼层 ≥ 2），一律点 **「重新生成」**，不准再点「开始我的人生」 |
| 5 | **禁止对不认识的弹窗瞎点「确定」** | 截图 + 原文报告给用户 |
| 6 | **禁止用 8000 端口、禁止注入 Basic 认证头** | 8000 是用户自己的酒馆，不准碰；8001 测试实例没有登录。`live-ego.md` 第 1、2 步里的 `127.0.0.1:8000` 和 `Authorization` 头是**过时代码，不要照抄** |
| 7 | **禁止卡住硬等** | 除了等模型回复（最长 150 秒），任何一步 10 秒没结论就是故障：停下、截图、报告 |

---

## 一、环境（只认这些）

| 项 | 值 |
| --- | --- |
| 测试酒馆 | `http://127.0.0.1:8001/`，目录 `E:\Ajiuguanagentceshi\SillyTavern`，无需登录 |
| 启动 | 在该目录 `node server.js`；日志 `agent-test.out.log` / `agent-test.err.log` |
| 测试卡 | `E:\SHZDCHOSSS\.work\test-card\神豪终端-localmvu.json` |
| 世界书名 | `神豪终端 · v2.0.0-rc.24`（版本变了名字跟着变） |
| 脚本 | `E:\SHZDCHOSSS\scripts\ego-std-flow-8001.mjs`（全流程）、`ego-regen-8001.mjs`（重新生成）、`ego-lib-8001.mjs`（公共函数） |
| 截图输出 | `C:\Users\Administrator\ego\std-flow\`，上次的 space 号记在 `last-space.txt` |

跑法（Windows 必须写成 .mjs 再 import，PowerShell 会弄坏 `-e` 里的中文）：

```powershell
ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-std-flow-8001.mjs')"
ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-regen-8001.mjs')"
```

脚本最后一行一定是 `RESULT=PASS …` 或 `RESULT=FAIL …`。**FAIL 就停**，把那一行和截图路径原样报告，不要自己换路子硬试。

---

## 二、弹窗对照表（看到弹窗先查这张表）

| 什么时候出现 | 弹窗里的字（认这个） | 点哪个按钮 |
| --- | --- | --- |
| 导入卡后 | 「为 神豪终端 导入标签」 | **全部导入** |
| **第一次打开这张卡时** | 「This character has an embedded World/Lorebook. Would you like to import it now?」 | **是** ← 这就是世界书，漏了就没世界书 |
| 打开卡时 | 「此角色含有内置正则。」 | **是 / 确定** |
| 打开卡时（0.5–1.2 秒后才出） | 「角色卡 '神豪终端NN.png' 中包含酒馆助手可用的嵌入式脚本 是否现在就启用它们?」 | **确认**（可能同时两条，都点） |
| 手动补导世界书时 | 「Are you sure you want to import '神豪终端 · v2.0.0-rc.24'?」 | **是** |

要点：

- 按钮是 `<div class="popup-button-ok">`，**不是 `<button>`**，按「可见叶子元素 + 文字」找，用 JS `click()`。
- 打开卡后**先等 2 秒**再扫弹窗，弹窗是陆续出来的；扫到「连续 3 秒没有弹窗」才算清完。扫一次是空的不代表没有。
- **世界书弹窗每张卡一辈子只弹一次**（酒馆会记 `AlertWI_<卡名>`）。错过了它不会再出现 → 只能走第四节的「补导世界书」。这就是「重开卡也没世界书」的原因。
- 世界书导入成功后酒馆会自动展开世界书面板，要把它收起来（再点一下 `#WIDrawerIcon`）。

---

## 三、标准全流程（= `ego-std-flow-8001.mjs`）

| 步 | 动作 | 关卡（不过就停） |
| --- | --- | --- |
| 1 | 新开 task space，打开 `http://127.0.0.1:8001/` | `readyState=complete`、`#preloader` 消失、`#send_form` 存在。`#preloader` 一直挂着 = 故障，别等 |
| 2 | 点插头 `#API-status-top` → 点文字是「连接」的按钮 → 再点插头收起 | `#API-status-top` 含 `fa-plug` 且不含 `exclamation`。**不要点 `#api_button`**（0×0 的隐藏按钮） |
| 3 | 打开右侧角色管理 `#rightNavDrawerIcon` → **在酒馆里导入**：`setInputFiles("#character_import_file", [卡路径])` → 处理「导入标签 → 全部导入」 | 导入前后角色列表 title 做差集，**正好多 1 张**，拿它的 `data-chid`。不准按名字模糊找卡（会点到旧卡） |
| 4 | **等 1 秒** → 点这张卡的头像 → **等 2 秒** → 按第二节表格把弹窗全部处理掉 → 收起世界书面板 | 页面上 `.popup` 为 0 |
| 5 | **世界书关卡** | 三条同时满足：①当前角色 `data.extensions.world` 有值；②这个名字在世界书列表 `#world_editor_select` 里；③**角色面板上的地球按钮 `#world_button` 亮着（有 `world_set` 类）**。不满足 → 第四节补导，补完再查，还不过就停 |
| 6 | **MVU 关卡** | `window.Mvu`、`__CJ_SHENGHAO_SCHEMA__`、`__CJ_SHENGHAO_V2__` 都是 object，`#TH-message--0--0`（开局向导 iframe）存在。不过 → 刷新页面 → 重连 API → 重开这张卡 → 点「确认」框 → 再查；**只重试 1 次** |
| 7 | 开局前提 | 聊天**只有 1 楼**（开场白）。≥ 2 楼说明已经开过局 → 不准填表，去第五节 |
| 8 | 向导里：姓名「测试员」→ 点「富家公子哥」→「下一步」×2 →「预览开局」 | 「开始我的人生」`disabled === false` |
| 9 | 点「开始我的人生」，等回复（唯一合法的长等待，≤150 秒） | 最后一条**不是用户消息**，且跟点之前不是同一条。不要拿楼层数涨了当判据（你自己发的消息也会涨） |
| 10 | **小手机关卡** | MVU 变量 `meta.initialized` 为真；`#cj-shenghao-phone-frame` 存在，且里面 `.phone-screen` 有文字。**小手机没出来 = 这一局作废**，回头查世界书和 MVU |

---

## 四、补导世界书（世界书关卡不过时）

这是 `hh01-import-lore3.mjs` 实测成功的路线，界面上的操作是：

1. 右侧角色面板 → 「更多...」下拉框（`#char-management-dropdown`）
2. 选「**导入角色卡的世界书**」（Import Card Lore）
3. 弹出「Are you sure you want to import …?」→ 点 **是**
4. 出 toast「World/Lorebook imported」，世界书面板自动展开 → 收起
5. 回到第三节第 5 步重新做世界书关卡

> 不要为了省事去 `data\default-user\worlds` 里放文件、也不要只「链接到世界书」一个旧的同名世界书 —— 必须从**这张卡里**导入。

---

## 五、已经开过局时：重新生成（= `ego-regen-8001.mjs`）

什么时候用：

- 开局后发现世界书 / MVU / 小手机有问题，修好了（补导了世界书）
- 用户说「你刚刚已经开局了，现在点重新生成」

步骤：

1. 接管上一次的 space（号在 `last-space.txt`）。**如果控制权在用户手里，停下问用户，不准自己抢。**
2. 按第二节把挂着的弹窗处理掉
3. 确认聊天 ≥ 2 楼（已开过局）；只有 1 楼说明根本没开局 → 回第三节
4. 世界书关卡、MVU 关卡（世界书没有就当场按第四节补导）
5. 点「重新生成」：左下角 ☰（`#options_button`）菜单里的 `#option_regenerate`，用 JS `click()`
6. 等回复 → 小手机关卡

---

## 六、「重新开始」是什么意思

用户说「重新开始」= **从第三节第 1 步完整再来一遍**：新 space → 打开 → 连 API → **在酒馆里重新导入卡** → 逐个点弹窗 → 世界书关卡 → … 。
不是在旧聊天上点几下，也不是复用以前拷进去的卡。

---

## 七、症状 → 原因 → 处理

| 症状 | 真实原因 | 处理 |
| --- | --- | --- |
| 地球按钮不亮、没有世界书 | 世界书弹窗没点到 / 已经错过（只弹一次） / 卡是拷进来的不是导入的 | 第四节补导 |
| 「开始我的人生」是灰的、表单底部「连接尚未完成」、`window.Mvu` 一直 undefined | 「嵌入式脚本」确认框没点到 | 刷新 → 重开卡 → 点「确认」，只试一次 |
| 开场只有纯文本，没有向导 | 内置正则 / 嵌入式脚本没启用 | 同上 |
| 开局回了正文，但小手机没出来 | 世界书或 MVU 没就绪 | 补世界书 / 查 MVU → **点重新生成**（不是重开局） |
| 等回复一等就是好几分钟 | 旧脚本用 `#mes_stop:not(.displayNone)` 判断生成结束，这个条件**永远为真**，白等 3 分钟 | 用 `getComputedStyle(#mes_stop).display !== "none"`（新 lib 已改） |
| 点击报 `intercepts pointer events` / `zero-sized bounding box` | 遮罩 / 0×0 按钮 | 一律 JS `element.click()` |
| `Control of this task space is with the user` | 用户碰了 ego 窗口 | 停下，等用户明确说继续 |

---

## 八、每一步怎么向用户汇报

每跑完一步只汇报三样：**做了什么 / 关卡结果（贴 JSON）/ 截图路径**。
关卡不过就写「卡在第 N 步：原因」，然后**停下等用户**，不要连续换三种办法乱试。
