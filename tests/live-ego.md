# 最高测试角色卡流程（唯一权威 · 2026-11-17 实测跑通）

> 本文件是**唯一现行**的实机测试流程，取代旧的 `tests/legacy/live-ego_20261117-old.md`（旧文件只作历史参考，不再更新、不再照抄）。
> 所有步骤与数值都是 2026-11-17 晚上在 ego lite 0.6.3.14 + 本机酒馆 1.19.0 上实测出来的，不是推测。

## 铁律（先看这条）

1. **除了等模型回复，任何"卡住需要等"都是故障**。等 API 回正文可以等 1–3 分钟；打开网址、连 API、导入卡、开卡、填表、点确认框，每一步都应该是**几秒内出结论**。超过 10 秒没结论就停下来取证据，别硬等。
2. **判"回复到了"只看最后一条是不是用户消息**，不要用楼层数增加来判断 —— 你自己发的那条用户消息也会涨楼层，会把"还没回"误判成"回了"。
3. 原生浏览器弹窗（HTTP Basic 登录框）必须由人点掉；ego 的脚本 API 碰不到它。
4. **动作之间要留一拍**：导入卡后等 1 秒再点卡；打开卡后等确认框出现并点「确认」——那个框是卡内脚本的启用开关，点不到就等于没启用，MVU 永远起不来。框不出现就刷新页面重开卡，别在同一文档里反复重试。

## 前置

| 项 | 值 |
| --- | --- |
| 浏览器 | ego lite 0.6.3.14，`ego-browser skill` 可打印官方用法 |
| **测试专用酒馆** | **`http://127.0.0.1:8001/`**（目录 `E:\SillyTavern-test`，从 `C:\jiuguan\SillyTavern` 复制而来：代码 + 四个第三方扩展全带、`data` 全新独立） |
| 认证 | **测试实例已关闭 Basic 认证**，不再需要登录，也不会再弹浏览器原生登录框 |
| 启动 | 双击 `E:\SillyTavern-test\启动测试实例.cmd`，或 `node server.js`（工作目录 `E:\SillyTavern-test`） |
| 测试卡 | `.work/test-card/神豪终端-localmvu.json`（MVU 走同源 `http://127.0.0.1:8001/cj-mvu-bundle.js`） |
| API | 自定义（兼容 OpenAI）`https://catiecli.sukaka.top/v1`，每个新 space 打开后都要点一次「连接」 |

> 用户本人的酒馆 `127.0.0.1:8000`（目录 `C:\jiuguan\SillyTavern`）**不再用于测试**，避免测试产生的角色卡副本、聊天记录、世界书导入污染他的数据。

## 流程（实测耗时写在括号里）

### 1. 开 space + 注认证头（< 2 秒）

```js
const task = await taskSpace("rc24 全流程 " + Date.now());
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
await page.cdp("Network.enable", {});
await page.cdp("Network.setExtraHTTPHeaders", {
  headers: { Authorization: "Basic " + Buffer.from("user:98", "utf8").toString("base64") },
});
```

### 2. 打开网址（实测 553ms 就 `readyState=complete`）

```js
await page.goto("http://127.0.0.1:8000/", { timeout: 20000 });
await page.waitForTimeout(4000);   // 只为取样，不是为了等它"好"
```

取样判据：`document.readyState === "complete"`、`#send_form` 存在、`preloader === null`。
**`#preloader` 还挂着就是故障**（多半是模块请求被原生登录框堵住），不是"再等等"。

### 3. 连 API（5 秒内看结果）

```js
await page.evaluate(() => document.querySelector("#API-status-top")?.click());  // JS 点击，绕开遮罩
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const pool = [...document.querySelectorAll("button, .menu_button, div, span")]
    .filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
  pool.find((el) => (el.textContent || "").trim() === "连接")?.click();
});
await page.waitForTimeout(5000);
```

判据：`#API-status-top` 的 class 含 `fa-plug` 且不含 `exclamation`。
不要用 `#api_button`（隐藏的 kobold 按钮，0×0）。

### 4. 导入最新卡（约 4 秒）

```js
await page.evaluate(() => document.querySelector("#rightNavDrawerIcon")?.click());
await page.waitForTimeout(1200);
const prev = await page.evaluate(() =>
  [...document.querySelectorAll("#rm_print_characters_block .character_select")]
    .map((c) => c.querySelector(".avatar")?.getAttribute("title") || ""));
await page.setInputFiles("#character_import_file", ["E:/SHZDCHOSSS/.work/test-card/神豪终端-localmvu.json"]);
await page.waitForTimeout(3500);
```

新版找卡方式：**导入前后 title 差集**（同名卡会被改名成 `神豪终端10.png`，chid 每次不同，不能写死，也不要按名字模糊匹配 —— 会点到旧卡）。

### 5. 点确认框（每次 1.1 秒轮询，最多 10 轮）

确认框按钮是 `<div class="popup-button-ok">`，**不是 `<button>`**；按「可见叶子元素 + 文本匹配」点击最稳：

```js
for (let i = 0; i < 10; i += 1) {
  const hit = await page.evaluate(() => {
    const out = [];
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight);
    for (const p of [...document.querySelectorAll(".popup, .dialog, [role='dialog']")]) {
      const leaf = [...p.querySelectorAll("button, div, span, a")]
        .filter((el) => el.children.length === 0 && vis(el));
      const ok = leaf.find((el) => /^(确认|确定|是|OK|全部导入|启用|继续)$/i.test((el.textContent || "").trim()));
      if (ok) { ok.click(); out.push((ok.textContent || "").trim()); }
    }
    return out;
  });
  if (!hit.length) break;
  await page.waitForTimeout(1100);
}
```

### 6. 打开卡 + 校验 MVU（约 3 秒，但**必须先等一拍再点**）

**节奏要点（2026-11-17 YG 实测纠正，这条比什么都重要）**：

- 导完卡**先等 1 秒再点卡**，别连点。
- 点开卡之后约 0.5–1.2 秒才会弹这个框，原文是：**「角色卡 '神豪终端NN.png' 中包含酒馆助手可用的嵌入式脚本 是否现在就启用它们?」**，按钮文字是 **「确认」**（同一时刻可能出现两条，都点）。
- **点了它才是真正启用卡内脚本**；框没弹出来 = 脚本没启用 = MVU 一定起不来。此时**刷新酒馆页面 → 重新点开这张卡 → 确认框会重新弹出 → 点「确认」**，MVU 会自己加载、开局立刻可用（YG 实测有效）。
- **等足 2 秒再点**：框虽然出现了，脚本还没加载完，太早点会点到别的按钮（比如另一个「确定」），等于没启用。打开卡 → 等 ≥2 秒 → 先截图看清是哪个框 → **只点「嵌入式脚本」那个框里的「确认」**。
- 启用状态**按角色记住**：同一张卡确认过一次后，再打开不再弹框，MVU 直接起（实测：`神豪终端19.png` 第二次打开时 `mvu/schema/host` 立即可用）。
- 从「最近的聊天」列表里找条目要注意分隔符是长横「–」，不是短横「-」，按短横匹配会一个都选不中。
- 常见错法：扫描确认框的动作跑在框出现**之前**，扫到空就当没有 —— 要等框出现再扫，别提前下结论。
- 不要在同一文档里反复重开聊天：ES 模块会按 URL 缓存失败的 import，同一页面再试也没用。

```js
await page.waitForTimeout(1000);      // 导入后先停一拍，别急着点
await page.evaluate((id) => document.querySelector(`[data-chid="${id}"] .avatar`)?.click(), chid);
await page.waitForTimeout(1200);      // 等确认框真正出现
// 再跑一遍第 5 步的确认框清理（按钮文本「确认」/「是」）
```

判据：`typeof window.Mvu === "object"`、`__CJ_SHENGHAO_SCHEMA__` / `__CJ_MVU_LOADER__` / `__CJ_SHENGHAO_V2__` 全为 object，且 toast 出现「[MVU]变量初始化成功」。
这条不过 → 先查「酒馆助手嵌入式脚本」是否启用（刷新重开卡、点确认），再看原生登录框，不要继续。

### 7. 填开局表单（每步 0.9 秒）

```js
await page.fill("#f_name", "测试员");
await page.evaluate(() => {
  const doc = document.getElementById("TH-message--0--0")?.contentDocument;
  [...(doc?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").includes("富家公子哥"))?.click();
});
// 下一步 ×2 → 预览开局
await page.evaluate(() => {
  const doc = document.getElementById("TH-message--0--0")?.contentDocument;
  [...(doc?.querySelectorAll("button") ?? [])].find((b) => /预览开局/.test(b.textContent || ""))?.click();
});
```

向导在 iframe `#TH-message--0--0` 内（同源 srcdoc，可直接 `contentDocument`）。
判据：预览出现「测试员，24岁 · 云澜市 / 初始现金 ¥1,000,000 / 已有资产 3 项 / 初始熟人 2 位」，且「开始我的人生」`disabled === false`。

### 8. 点开局，等第一楼正文（唯一合法的长等待）

```js
await page.evaluate(() => {
  const doc = document.getElementById("TH-message--0--0")?.contentDocument;
  [...(doc?.querySelectorAll("button") ?? [])].find((b) => /开始我的人生/.test(b.textContent || ""))?.click();
});
await page.waitForFunction(() => {
  const c = window.SillyTavern?.getContext?.()?.chat || [];
  return c.length > 0 && c.at(-1)?.is_user === false;     // ← 只认「最后一条不是用户消息」
}, undefined, { timeout: 150000 });
```

### 9. 读变量（每轮测试都靠它）

```js
const state = await page.evaluate(() => {
  const chat = window.SillyTavern?.getContext?.()?.chat || [];
  for (let i = chat.length - 1; i >= 0; i -= 1) {
    const v = window.Mvu?.getMvuData?.({ type: "message", message_id: i });
    if (v?.stat_data?.shenghao?.meta?.initialized) return v.stat_data.shenghao;
  }
  return null;
});
```

`facts` / `events` / `ledger` 可能是数组也可能是对象，读之前先 `Array.isArray(x) ? x : Object.values(x)`。

### 10. 发消息（别点 `#send_but`）

`#send_but` 有时是 0×0（点了报 `zero-sized bounding box`）。用原生 setter + JS 点击：

```js
await page.evaluate((text) => {
  const ta = document.getElementById("send_textarea");
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(ta, text);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("send_but")?.click();
}, line);
```

## 实测判据表（2026-11-17 本轮真跑出来的数）

| 环节 | 实测 |
| --- | --- |
| 打开网址 | 553ms `readyState=complete` |
| 连 API | `fa-plug`，无感叹号 |
| 导入卡 | 新卡 chid 8（同名自动改名 `神豪终端10.png`），确认框「全部导入」1 次 |
| MVU 就绪 | `Mvu/schema/loader/host` 全 object，toast「[MVU]变量初始化成功」，世界书 `神豪终端 · v2.0.0-rc.24` |
| 开局变量 | `cash=100000000`（¥1,000,000）、`prowess=70`、`date=2026-11-16`、`time=09:05`、`revision=1` |
| 初始熟人 | 顾星遥 ♥55 / 江映 ♥30，均带 `currentGoal`；`cycle` 脚本兜底（经前期·敏感 / 安全期）；`limits.scaleLevel` 3 / 1 |
| 纯寒暄 | 有回复，`rewardEvents` 空，`revision 1→2`（不发暴击 ✅） |
| 涩涩轮 | `rewardEvents` 1 条：**¥16,714（1,671,400 分，整元）**，称号 **羞耻破防**，`mode=INTIMATE`，评分 68；顾星遥 堕落 0→12、情动 48、自动标签「深情热吻/解锁新姿/贴身爱抚」；`revision 2→4` |

## 故障对照表（按踩坑代价排序）

| 症状 | 真实原因 | 处理 |
| --- | --- | --- |
| 开局表单「连接尚未完成」、「开始我的人生」灰、`window.Mvu` 永远 undefined | **「酒馆助手嵌入式脚本」确认框没点到 / 没弹出**，卡内脚本没启用（最常见）；其次是原生 HTTP Basic 登录框挂起模块请求 | 刷新页面 → 重新点开卡 → 点弹出来的「确认」；确认框始终不出现再查登录框。不要在同一文档里反复重开聊天 |
| `#preloader` 一直显示「正在初始化…」 | 同上一行（初始化里的模块拉不下来） | 同上，别等 |
| 点击报 `#preloader intercepts pointer events` | 遮罩还在 | 用 JS `element.click()`，或先确认遮罩真的消失 |
| 点 `#send_but` 报 `zero-sized bounding box` | 按钮在这一版布局里是 0×0 | 走第 10 步的原生 setter + JS 点击 |
| 以为「回了」，其实楼层增加的是自己的消息 | 判据用了楼层数 | 只认 `chat.at(-1).is_user === false` |
| `#TH-message--0--0` 不存在、开场只有纯文本 | 「酒馆助手嵌入式脚本」确认框没点掉 | 跑第 5 步的确认框清理，必要时 `reloadCurrentChat()` |
| `#api_button` 点了插头还是感叹号 | 那是 0×0 的 kobold 隐藏按钮 | 按可见文本「连接」找 |
| jsDelivr 相关红字 | （2026-11-17 复核）`cdn.jsdelivr.net` 与 `testingcf.jsdelivr.net` 的 `gh/`、`npm/+esm` 都 200；`cdn.skypack.dev` 与 `127.0.0.1:8123` 才是 Failed to fetch | 本地 bundle 同源托管即可，不必再改 CDN |

## 未验证（本流程还没覆盖到）

- 收入入账、买房后资产写入 `basisCents`。
- 提现按 `tierBasis`（现金 + 后购且仍持有的资产成本）算总身家倍率；前置是某个角色 `affection≥70 || corruption≥60`。
- 打星离场 `offscreen` 的逐轮更新、长对话通胀、多人同时在场。
