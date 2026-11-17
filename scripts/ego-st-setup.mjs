// 通用酒馆建档 / 导卡 / 首次全面观察（任何角色卡通用）
// 读取 C:/Users/Administrator/ego/st-run/config.json:
// {
//   "card": "E:/路径/某张卡.png 或 .json",
//   "reuseAvatar": "可选，已导过的卡直接填 avatar 文件名（如 某张卡.png），不填就新导入",
//   "extraPopupRules": [ { "name": "卡自弹窗", "match": "弹窗特征词", "btn": "^(确定|是)$" } ],
//   "promptMustContain": [],
//   "promptMustNotContain": []
// }
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-st-setup.mjs')"
import fs from "node:fs";
import * as L from "./ego-st-lib.mjs";

await L.run("通用建档与开卡", async () => {
  const cfg = L.loadConfig();
  L.setExtraPopupRules(cfg.extraPopupRules);

  // 清掉上一次的变量基线
  try { fs.unlinkSync(L.RUN_DIR + "/vars-last.json"); } catch {}

  const { page } = await L.newSpace("通用测卡 " + (cfg.name || ""));

  // 1. 打开酒馆 + 连 API + 记录空页面基线（用来认出卡自己往页面挂了什么悬浮窗/状态栏）
  await L.openTavern(page);
  await L.connectApi(page);
  const baseline = await L.takeBaseline(page);

  // 2. 挂探针（监听世界书触发、最终 Prompt、报错、Toast）
  await L.installProbes(page);

  // 3. 导卡或复用已导入的卡（严禁直接拷文件进 data 目录）
  let avatar = cfg.reuseAvatar || null;
  if (!avatar) {
    const imported = await L.importCard(page, cfg.card);
    avatar = imported.avatar;
  }

  // 4. 等 1 秒 → 打开卡 → 等 2 秒 → 处理弹窗
  await page.waitForTimeout(1000);
  await L.openCardByAvatar(page, avatar);

  // 5. 关卡检查：卡里带了什么（世界书 / 正则 / 酒馆助手脚本），酒馆里就必须生效什么
  let rt = await L.cardRuntime(page);
  L.log("卡运行态", rt);

  // 如果卡有内嵌世界书但没绑上（比如之前点漏过弹窗），自动走「更多... → 导入角色卡的世界书」补救
  if (rt.hasEmbeddedBook && !(rt.world && rt.worldExists && rt.globeLit)) {
    L.log("内嵌世界书未绑定 → 自动从角色面板补导");
    await L.importCardLore(page);
    rt = await L.cardRuntime(page);
    L.log("补导后运行态", rt);
  }

  // 如果卡带了酒馆助手脚本或正则但没起来，刷新重开卡试一次（等弹窗点确认）
  let problems = L.cardGateProblems(rt);
  if (problems.length) {
    L.log("首次关卡未全过，刷新重开卡重试一次", problems);
    await L.openTavern(page);
    await L.connectApi(page);
    await L.installProbes(page);
    await L.openCardByAvatar(page, avatar);
    rt = await L.cardRuntime(page);
    problems = L.cardGateProblems(rt);
  }
  if (problems.length) {
    await L.shot(page, "gate-fail");
    L.fail("卡组件生效关卡", { problems, rt });
  }

  // 再等 2 秒让卡内脚本异步渲染完（比如开局向导、悬浮小手机、MVU 初始化）
  await page.waitForTimeout(2000);
  const sv = await L.survey(page, baseline, cfg);
  L.saveState({ avatar, baseline, runtime: rt });
  L.log("首次全面观察 (survey)", sv);
  await L.shot(page, "setup-ready");
});
