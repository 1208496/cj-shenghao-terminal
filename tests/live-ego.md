# 实机测试流程 · ego lite 驱动 SillyTavern

> 2026-11-17 首次跑通并落地。目的：把「导入整卡 → 连 API → 走开局 → 验证变量界面」这条实机链路变成可重复执行的动作，而不是每次靠记忆手点。
> 本文件只记录实测有效的步骤与判据。没跑过的写「未验证」。

## 前置

| 项 | 值 |
| --- | --- |
| 浏览器 | ego lite 0.6.3.14（`--startup-ego-browser-service` 后台服务，无主窗口属正常） |
| 酒馆 | `http://127.0.0.1:8000/` |
| 前置认证 | HTTP Basic，`user` / `98`，realm `SillyTavern` |
| 跑法 | `ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/live-test-ego.mjs')"` |
| 脚本 | `scripts/live-test-ego.mjs`（顶部 CONFIG 区改卡路径 / 开关） |

Windows 下必须写 `.mjs` 文件再 `-e "await import(...)"`；PowerShell 5.1 会破坏 `-e` 里的引号和中日韩字符。

## 七步流程与判据

### 1. 过 Basic 认证

不走原生认证弹窗（会卡住导航），直接注入请求头：

```js
await page.cdp("Network.enable", {});
await page.cdp("Network.setExtraHTTPHeaders", { headers: { Authorization: "Basic " + btoa("user:98") } });
await page.goto("http://127.0.0.1:8000/");
```

判据：`document.title === "SillyTavern"`，`#send_form` 可见。
注意：请求头是**每个 Node 进程**都要重设的，脚本每轮开头都要执行。

### 2. 连接 API

- 点击 `#API-status-top`（插头图标，其父链是 `#sys-settings-button.drawer`）打开「API 连接配置」抽屉
- 点抽屉里**可见且文本恰好为「连接」**的按钮

**不要用 `#api_button`** —— 它在 `#kobold_api_block` 里，是 0×0 的隐藏按钮。自定义 OpenAI 源真正的按钮在 `#openai_api` 内。

判据：`#API-status-top` 的 class 从 `fa-plug-circle-exclamation` 变成 `fa-plug`，且无 error toast。
当前配置：聊天补全来源 = 自定义（兼容 OpenAI），端点 `https://catiecli.sukaka.top/v1`，模型由用户在 UI 里选。

### 3. 清确认弹窗

导入前后会连环弹三类，逐个用原生 `click()` 点掉（ego 的指针点击会被模态拦截，报 `intercepts pointer events`）：

1. 角色标签导入 → 点「全部导入」
2. 内置正则询问 → 点「确定」
3. 酒馆助手嵌入式脚本 → 点「确认」

判据：`#dialogs` 内无可见弹出；这些按钮不在 `#dialogs` 里的容器也可能出现，所以按「全页扫描可见且文本匹配 `确认|确定|是|OK` 的叶子元素」来找更稳。

### 4. 导入整卡

```js
await page.click("#rightNavDrawerIcon");                    // 角色管理抽屉
await page.setInputFiles("#character_import_file", [CARD_PATH]);
```

判据：toast 出现「角色已创建：<名>」，`#rm_print_characters_block .character_select` 数量增加。
注意：同名卡重复导入会被重命名（如 `神豪终端19.png`），`chid` 每次不同，不要写死。

### 5. 打开该角色

```js
const hit = [...document.querySelectorAll("#rm_print_characters_block .character_select")]
  .find(c => (c.querySelector(".avatar")?.getAttribute("title") || "").includes("神豪"));
hit.querySelector(".avatar").click();
```

判据：`#chat .mes` 出现 1 条 assistant 开场；`#TH-message--0--0` iframe 的 `srcdoc` 长度 > 100KB（开场向导已渲染）。

### 6. 走开局向导

开场向导在 iframe `#TH-message--0--0` 内（srcdoc，同源，可直接 `contentDocument`）。手机界面在 `#cj-shenghao-phone-frame`。

| 步 | 操作 | 控件 |
| --- | --- | --- |
| 01 塑造身份 | 填姓名、选开局档 | `#f_name`，`#f_age`，`#f_gender`，`#f_occupation`，`#beautySlider`/`#beautyNumber`，`#f_appearance`，`#f_body`，`#f_background`；档位按钮文本含「穷光蛋开局 / 上班族牛马 / 小康人家 / 富家公子哥」 |
| 02 设定起点 | 确认现金与资产 | 现金 chip：`¥0 / ¥10,000 / ¥100,000 / ¥1,000,000`（选中项 class 含 `on`）；「＋ 登记资产」 |
| 03 已有关系 | 熟人列表 | 「＋ 添加初始熟人」，按钮「预览开局」 |
| 最终确认 | 点「开始我的人生」 | 预览行显示「<名>，<age>岁 · 城市 / 初始现金 / 已有资产 N 项 / 初始熟人 N 位」 |

填值必须走原生 setter + `dispatchEvent("input"/"change")`，直接赋 `value` 不会触发卡的校验状态：

```js
const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value").set;
setter.call(el, v);
el.dispatchEvent(new win.Event("input", { bubbles: true }));
el.dispatchEvent(new win.Event("change", { bubbles: true }));
```

判据：`#chat .mes` 从 1 变 3（user 开局消息 + assistant 首轮正文）；user 消息里含完整开局设定文本。

### 7. 验证变量与界面

- `#chat .mes` 最后一条是 assistant 正文，长度数百字
- 手机浮层：点 `#cj-shenghao-phone-frame` 内的按钮 `#folded`（文本「✦神豪终端」）展开
- tab：`⌂此刻` / `♡她们` / `▣我的`

数值交叉校验（本次实测通过）：

| 项 | 手机显示 | 应对得上 |
| --- | --- | --- |
| 总资产 | ¥1,700,000 | 现金 100,000 + 资产 1,600,000 |
| 持有资产 | ¥1,600,000 | 公寓 1,500,000 + 车 100,000 |
| 等级 | 见习·十倍 | 正文「可用现金十万元，等级为见习·十倍」 |
| 颜值 | 60/100 | 表单 `#beautyNumber` |
| 时间 | 2026-11-16 星期一 09:00 | 开局设定「起始日期时间」 |

## 踩过的坑（按代价排序）

0. **确认弹窗的按钮是 `<div class="popup-button-ok">`，不是 `<button>`**（2026-11-17 rc.22 实机第一次踩到，代价最大）。按「文本找 button」会一个都点不到，于是「内置世界书 / 内置正则 / 酒馆助手嵌入式脚本」三个确认一直挂着：正则没启用 → 开场 `<div data-cj-opening>` 不会被替换成 iframe → `#TH-message--0--0` 不存在 → 看起来完全像「脚本没有加载」。正确做法：循环点所有可见的 `.popup .popup-button-ok`，直到没有 `.popup`，再检查 `#TH-message--0--0`；仍缺失就调用 `SillyTavern.getContext().reloadCurrentChat()` 重渲染一次。脚本里已封装为 `dismissPopups()`。
0b. **导入卡不能按名字模糊匹配**：`characterMatch: "神豪"` 会 `pop()` 到最后一张同名旧卡（实测打到了「都市神豪之我爱装逼托马斯版」），后面全在测错卡。改成「记录导入前的卡片 title 集合，导入后取差集」，并用 `data-chid` 打开；重复跑时用 `reuseChid` 直接复用已导入的角色。
0c. **开局前手机 iframe 的 `#app` 是空的，这是正常现象**：`state` 还是 null 时宿主只创建 74×108 的折叠位，界面要等开局提交、MVU 初始化后才渲染。判据要用「开局后 `#cj-shenghao-phone-frame .phone-screen` 有文本」，不要用「iframe 存在」。
1. **用户一碰 ego 窗口，控制权就判给用户**，我的指令立刻被暂停，报 `Control of this task space is with the user`。这是硬停止，不能自己抢。恢复要 `takeOverTaskSpace(spaceId)`，且必须用户明确说继续。跑长流程前先跟用户说好别点窗口。
2. **`#api_button` 是隐藏的 kobold 按钮**（0×0）。点它等于没点，插头一直是感叹号。要按可见文本「连接」找。
3. **ego 的 `page.screenshot()` 只截视口的约 0.8 倍**，右侧会被裁。手机浮层贴右边缘 4px 且有 `transform: matrix(0.82,…)`，截图里直接被切掉。绕法：临时把 `#cj-shenghao-phone-frame` 设成 `position:fixed; left:20px; top:70px; transform:none; z-index:2147483000`，截完还原原 `style` 属性。CDP `Page.captureScreenshot` + `clip` 更差（坐标是文档坐标、输出还按 DPR 1.25 放大）。
4. **百度搜索结果页会让该 tab 的截图永久超时**（`EGO_PAGE_UNRESPONSIVE`），原始 CDP 也救不回。换 `task.newPage()` 即恢复；不要在同一个 tab 死磕。
5. **ego 这个 Chromium 里 jsDelivr 全域 + raw.githubusercontent 都是 `Failed to fetch`**，而台面 `Invoke-WebRequest` 能通、unpkg 与 api.github.com 能通。卡的「固定加载器」每次打开都走 jsDelivr 拉 `dist/terminal.js`，会弹红字「脚本没有下载或启动成功」。这是 **ego 环境问题，不是卡的问题**（同一张卡用用户自己的浏览器导入就正常）；实测红字不阻塞开局与变量界面。
6. `page.events()` 是 async 且返回事件名数组，不是 EventEmitter；`waitForEvent` 只支持 `popup` / `download`，没有 screencast。想抓 console 得先 `page.cdp("egoAutomated.disable")` 再 `Runtime.enable`，且拿不到推送回调。

## rc.22 实机验收记录（2026-11-17）

跑法：先 `scripts/live-test-ego.mjs`（导入链路），再 `scripts/live-test-rc22-resume.mjs`（向导 + 界面断言）。

| 断言 | 结果 | 证据 |
| --- | --- | --- |
| 导入 rc.22 整卡 | ✅ | 新增卡 `chid 31`「神豪终端」，标签已导入 |
| 内置世界书 / 正则 / 嵌入式脚本 | ✅ | 按 `.popup-button-ok` 点掉后 `#TH-message--0--0` srcdoc 171,740 字符 |
| 开局向导 + 两位初始熟人 | ✅ | 表单出现 `f_c_cupSize` / `f_c_corruption`，四人列表（含卡自带的温迎、沈清弦） |
| 此刻页双轴 | ✅ | 「♥ 好感 43/100 · ❖ 堕落 2/100」，奖池 **¥5,000**（50 分微光暴击 ×10） |
| 基础档案 | ✅ | 「称呼你：陆总」「三围 86／62／89 CM（C 罩杯）」 |
| 她们页 | ✅ | 副标题「平面设计师 · 称呼「陆总」 · ♥ 41 · ❖ 0」，提示语「好感满70或堕落满60即可提现」 |
| 详情页双数值 + 提现文案 | ✅ | 「♥ 41 好感度 · 朋友与信任」「❖ 0 堕落度 · 矜持自守」「♥ 好感达70 或 ❖ 堕落达60 解锁提现」 |
| 私密与亲密记录卡 | ✅ | 展开后「处子状态：未知 / 孕期：未孕 / 还没有已解锁的亲密体验」 |
| ★ 特别关注 | ✅ | 点击后按钮变「★ 已关注」，此刻页出现「★ 特别关注 · 异地实况 (1) · 林知夏 · 近况尚未同步」 |
| 堕落度实机写入 | ✅ | 一轮对话后 `corruption 0 → 2`，facts 出现 `CORRUPTION_CHANGE finalDelta=2`；`currentThought` 同时写入 |

**未验证**：`physiology` / `intimacy` 在真实亲密剧情推进后的实际落盘（本轮只到试探牵手，没有发生亲密行为）；`★` 打星后模型是否真的每轮更新 `offscreen`（本轮显示「近况尚未同步」）。

## 已知未验证

- 刷新页面后重新连接 API 的完整回归（用户说每次刷新都要重连）——流程同上第 2 步，**未单独立项验证**。
- 连续多轮对话下变量是否逐轮更新（只看了一轮）。
- 「她们」tab 在有在场角色时的渲染。
- 卡更新后（改 Supabase 指针）加载器能否在 jsDelivr 受阻时走 fallback。
