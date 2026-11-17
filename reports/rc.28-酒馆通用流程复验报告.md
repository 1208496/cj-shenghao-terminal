# rc.28 复验报告：宽屏底部内嵌面板 / 三层罩杯 / 开局表单补齐

> 卡：`E:\SHZDCHOSSS\dist\2.0.0-rc.28-checkpoint\神豪终端.json`（checkpoint 构建，2026-11-18 01:2x）
> 实例：`http://127.0.0.1:8001/`，ego lite 驱动，space 6 / 7，导入后 `chid=6`、`chid=7`
> 流程：`tests/DSH-酒馆全卡通用测试手册.md` 抽测（组件关卡 / 开局前端 / 变量 / 悬浮界面），只验 rc.28 改动面
> 截图：`C:/Users/Administrator/ego/st-run/shots/`（本报告关键 6 张另存 `reports/rc.28-shots/`）

## 1. 组件生效关

| 项 | 实测 |
| --- | --- |
| 世界书 | `神豪终端 · v2.0.0-rc.28`，`worldExists=true`、`globeLit=true` |
| 正则 / 脚本 | `regexCount=10`、`regexAllowed=true`、`thScriptIframes=5` |
| MVU | `tavernHelper=object`、`mvu=object`、`[MVU]变量初始化成功` |
| 提示词检查 | `promptChecks` 两项 `ok:true` |
| 判定 | **PASS**（两次导入均过） |

## 2. 开局前端（M6）

| 验收点 | 实测 | 截图 |
| --- | --- | --- |
| 性器特征下拉 | 点输入框弹出 6 条定稿描述，点第 3 条后 `#f__gen_traits` 变成「尺寸傲人且硬度极佳，表面脉络盘绕，持久滚烫」 | `r28-wizard-gen-traits` |
| 性器长度 / 粗度下拉 | `16cm 18cm 20cm 22cm 24cm` / `4.2cm 4.8cm 5.2cm 5.6cm 6.0cm`，选 20cm 生效 | `r28-wizard-gen-girth` |
| 已有资产编辑 | 第 2 步 3 张资产卡都有「编辑 / 移除」；点编辑弹「编辑已有资产」，类别、名称、估值 8000000、地点、描述、产权全部回填 | `r28-asset-edit-filled` |
| 保存修改 | 改名「临江大平层·编辑验证」、估值 888000000 后原位替换：列表仍是 3 项，卡面变成 `¥888,000,000` + 新描述（没有新增重复项） | `r28-asset-saved` |
| 走完向导 | 预览「测试员，24岁 · ¥1,000,000 · 已有资产 3 项 · 初始熟人 2 位」→ 开始生成成功 | `r28-preview` |

## 3. 宽屏底部内嵌面板（本次核心）

同一段实测（`page.evaluate` 在 iframe 与父页面同时取值，单位 CSS px）：

| 观测 | 数值 |
| --- | --- |
| `.mes_text` 容器 | `w=728, left=480` |
| 「▶ 本轮变量更新」折叠条 | `w=698, left=480, right=1178` |
| 面板 iframe（底部模式） | `w=698, left=480, right=1178` —— **与折叠条左右边缘完全一致** |
| 手机刘海 `::before` | `display:none` |
| 边框 / 圆角 | `0.64px / 16px`（悬浮态仍是 `6.4px / 40px`） |
| 顶栏导航 | `.wide-nav` 3 个胶囊（此刻 / 她们 / 我的），底部 `.bottom` 导航 `display:none` |
| 折叠按钮 | 图标变成 `−` |
| 内部滚动 | `#phoneScreen` `overflow-y: visible`（宽屏模式不再套内层滚动条） |
| 高度自适应 | 此刻 519→523；她们 287→291；人物详情+面板 1831→1835；折叠横条 52 |
| 多列 | 她们列表 `327.48px ×2`；四方块 `160.24px ×4` |
| 挂载位置 | 始终是最后一楼（`inLastMes=true`），发新楼后自动迁移并保持展开 |

截图：

- `r28d-open-centered`：宽屏面板紧贴「本轮变量更新」下方，左右边界对齐，无刘海黑边。
- `r28b-dock-scene`：此刻页在宽屏下的舒展效果。
- `r28b-dock-women`：她们页双列。
- `r28b-dock-detail`：人物详情四方块排成 1×4。
- 折叠横条（`r28b-dock-bar` 量到 `698×52`，文案「✦ 神豪终端 2026-11-16 09:38 · 江城区·临江大平层 ¥1,000,000 点击展开 ⌄」）。该横条位于超长消息末尾，视口截图抓不到，故以尺寸与文案为证据。

## 4. 变量与罩杯

- 开局落盘 514 字段，`user.name=测试员`、`cashCents=100000000`、`world.date=2026-11-16`。
- 发「让她来家里看方案」后 `revision 1→3`、`presentCharacterIds` 写入顾星遥、时间 09:00→09:30，`errors=[]`、toasts 无 zod 报错。
- 预设罩杯实测：`顾星遥 167/86/61 → C`、`江映 172/92/62 → E`，与三层算法第二层结果一致。

## 5. 自动化验证

| 命令 | 结果 |
| --- | --- |
| `npm test` | **309 / 309 通过**（rc.27 的 306 + rc.28 新增 3 条） |
| `node scripts/build.mjs --checkpoint` | `BUILD_OK dist/2.0.0-rc.28-checkpoint/` |
| `node scripts/check.mjs --checkpoint` | `CHECK_OK` |
| 成品抽查 | `version=2.0.0-rc.28`、世界书 31 条、`protocol` 21 行、`phone.html` 含 `is-bottom-dock / wide-nav / wide-tab / women-grid`、runtime 含 `width:"100%"` 与高度限幅 |
| 哈希 | `worldbookHash 39ea2608e81c…`、runtime sha256（见 `dist/2.0.0-rc.28-checkpoint/release.json`） |

## 6. 与方案字面不同的三处（都已实测确认必要）

1. **高度上限 1600 → 2400**：方案 §5 写 `Math.min(height,1600)`（§1.4 又写 1400）。实测人物详情+面板内容 1831px，按 1600 会截断并出现 iframe 内滚动条，违背「绝不截断」的目标，故放宽到 2400。
2. **挂载点 `.mes_block` → 优先 `.mes_text`**：折叠条长在 `.mes_text` 里，挂在 `.mes_block` 时面板比折叠条宽 30px、左偏 0，实测对不齐；改挂 `.mes_text` 后三者（文本容器/折叠条/面板）左右边缘完全一致。
3. **新增 `.wide-nav` / `.wide-tab` / `.women-grid`**：方案要求顶栏一体化导航与「她们」双列，但没有给容器与样式；补了最小实现（`women()` 外面加一层 `.women-grid`，默认单列，只有底部模式才双列）。

## 7. 未验证

- 三套主题（sage / gold / purple）在宽屏内嵌下的观感：暖金与深曜雾紫已各拍一张宽屏「她们」页（`r28x3-wide-gold` / `r28x3-wide-purple`），配色正常；但主题 × 剖面面板的组合没拍全。
- 320px 以下的极窄屏：宽屏模式本来就要求容器够宽，未构造。
- 「巨乳 / 贫乳」文字改判只做了单测，实机没有野生角色带这类描述。
- 折叠横条的实际观感截图（尺寸与文案已量到，见 §3）。
- 正式（非 checkpoint）整卡与线上指针切换：本轮未发布。

## 8. rc.28.1 长标签压字修复（YG 实机发现）

**现象**：`阴部户型与色泽 / 阴部紧致与状态 / 后庭外观与状态 / 敏感带与体香` 等 6～7 字标签压到右侧数值上，悬浮与宽屏两种模式都有。

**根因**：`.kv` 写死 `64px` 标签列 + `.kv-k` `nowrap`，medium 字号下 7 个字约 96px，越出网格线。

**修法**：`.kv` 标签列改 `8.2em`（随 `--cj-font-scale` 等比），`.kv-k` 加 `min-width:0 + 省略号` 兜底，`.limit-cell` 的标签与徽章补 `min-width:0 / flex-shrink:0`。

**实测**（逐行比较 `kv-k` 右边界与 `kv-v` 左边界）：

| 模式 | 行数 | 最大重叠 | 标签列宽 | 间隙 |
| --- | --- | --- | --- | --- |
| 悬浮（iframe 299px） | 10 | **0** | 94px | 7px |
| 宽屏底部（iframe 698px） | 10 | **0** | 94px | 7px |

截图：`r28x3-float-flesh`（悬浮 299px，可见标签与数值已分开）、`r28x3-wide-gold` / `r28x3-wide-purple`（暖金 / 雾紫主题的宽屏「她们」页，配色正常）。

**取证说明**：宽屏模式的 "flesh" 截图与悬浮那张逐字节相同（抓拍时机问题，模式切换后立即截图拍到了同一帧），所以**宽屏只有 DOM 数值证据**（10 行 overlap=0）；宽屏外观仍以 rc.28 阶段拍的 `r28b-dock-scene` / `r28b-dock-detail` 为准（那两张是修复前的 64px 版本）。折叠横条同样只有尺寸与文案证据（`698×52`），`r28x3-bar` 实际拍到的是聊天正文、不是横条。

**未完成**：加宽到 8.2em 后重建并导入（`chid=9`）重新开局时，测试 API 站没有返回，未能拍到 8.2em 的实机截图；7 字标签是否完整显示需下一轮实测确认。已改的 CSS 与单测/构建检查均通过（309 / 309、`BUILD_OK`、`CHECK_OK`）。

