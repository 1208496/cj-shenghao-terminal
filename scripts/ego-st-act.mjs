// 通用酒馆单步/批量动作执行器（任何角色卡通用）
// 读取 C:/Users/Administrator/ego/st-run/action.json（可以是单个动作对象，或动作数组）：
// 支持的 op：
//   { "op": "survey", "tag": "看状态" }                                   → 只观察不操作
//   { "op": "send", "text": "你好" }                                      → 发消息并等 AI 回复完
//   { "op": "regenerate" }                                                → 点左下角菜单「重新生成」并等回复完
//   { "op": "continue" }                                                  → 点左下角菜单「继续」并等回复完
//   { "op": "swipe", "dir": "right" }                                     → 滑最后一楼（0 楼切开场白 / AI 楼换回复）
//   { "op": "newChat" }                                                   → 开始新聊天
//   { "op": "slash", "cmd": "/echo test" }                                → 执行酒馆斜杠命令
//   { "op": "fill", "frame": "#TH-message--0--0", "selector": "#f_name", "value": "测试员" } → 填输入框/下拉框（frame 可省）
//   { "op": "click", "frame": "#TH-message--0--0", "text": "开始", "waitGen": true }        → 点按钮（waitGen=true 时等 AI 生成完）
//   { "op": "wait", "ms": 1500 }                                          → 停顿
//   { "op": "reload" }                                                    → 刷新网页、重连 API、装探针（测持久化用）
//   { "op": "deleteLast", "count": 1 }                                    → 用 /del 删最后 N 楼
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-st-act.mjs')"
import * as L from "./ego-st-lib.mjs";

await L.run("通用动作执行", async () => {
  const cfg = L.loadConfig();
  L.setExtraPopupRules(cfg.extraPopupRules);
  L.setPromptHistoryExclude(cfg.promptHistoryExclude);
  const st = L.loadState();
  const raw = L.readJson(L.ACTION_FILE, null);
  if (!raw) L.fail("读动作", `先写 ${L.ACTION_FILE}`);
  const actions = Array.isArray(raw) ? raw : [raw];

  const { page } = await L.attachSpace();
  await L.installProbes(page);
  await L.handlePopups(page, "动作前清弹窗", { quietMs: 1000 });

  for (let i = 0; i < actions.length; i += 1) {
    const a = actions[i];
    const tag = a.tag || `${i + 1}-${a.op}`;
    L.log(`执行 [${tag}]`, a);

    if (a.op === "survey") {
      // 仅观察
    } else if (a.op === "wait") {
      await page.waitForTimeout(a.ms ?? 1000);
    } else if (a.op === "send") {
      const r = await L.sendText(page, a.text);
      L.log("send 结果", r);
      if (!r.ok) { await L.shot(page, `${tag}-fail`); L.fail(tag, r); }
    } else if (a.op === "regenerate") {
      const r = await L.regenerate(page);
      L.log("regenerate 结果", r);
      if (!r.ok) { await L.shot(page, `${tag}-fail`); L.fail(tag, r); }
    } else if (a.op === "continue") {
      const r = await L.continueGen(page);
      L.log("continue 结果", r);
      if (!r.ok) { await L.shot(page, `${tag}-fail`); L.fail(tag, r); }
    } else if (a.op === "swipe") {
      const r = await L.swipe(page, a.dir || "right");
      L.log("swipe 结果", r);
      if (!r.ok) { await L.shot(page, `${tag}-fail`); L.fail(tag, r); }
    } else if (a.op === "newChat") {
      await L.newChat(page);
    } else if (a.op === "slash") {
      const r = await L.slash(page, a.cmd);
      L.log("slash 结果", r);
      if (r.error) L.fail(tag, r);
    } else if (a.op === "deleteLast") {
      const r = await L.slash(page, `/del ${a.count ?? 1}`);
      L.log("deleteLast 结果", r);
      await page.waitForTimeout(1000);
    } else if (a.op === "fill") {
      const r = await L.uiFill(page, a);
      L.log("fill 结果", r);
      if (!r.ok) { await L.shot(page, `${tag}-fail`); L.fail(tag, r); }
      await page.waitForTimeout(a.waitMs ?? 600);
    } else if (a.op === "click") {
      const sig = a.waitGen ? await L.lastSig(page) : null;
      const r = await L.uiClick(page, a);
      L.log("click 结果", r);
      if (!r.ok) { await L.shot(page, `${tag}-fail`); L.fail(tag, r); }
      if (a.waitGen) {
        const g = await L.waitGeneration(page, sig);
        L.log("click 触发生成结果", g);
        if (!g.ok) { await L.shot(page, `${tag}-gen-fail`); L.fail(tag, g); }
      } else {
        await page.waitForTimeout(a.waitMs ?? 1000);
      }
    } else if (a.op === "reload") {
      await L.openTavern(page);
      await L.connectApi(page);
      await L.installProbes(page);
      await L.handlePopups(page, "刷新后弹窗", { quietMs: 1500 });
      await page.waitForTimeout(2000);
    } else {
      L.fail(tag, `未知的 op: ${a.op}`);
    }

    await L.handlePopups(page, `${tag}-后清弹窗`, { quietMs: 1000 });
  }

  const sv = await L.survey(page, st.baseline, cfg);
  L.log("动作后全面观察 (survey)", sv);
  await L.shot(page, actions.at(-1)?.tag || actions.at(-1)?.op || "act");
});
