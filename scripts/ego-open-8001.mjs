// 在当前已导入的卡上直接开局（手册第三节 7–10 步）：刷新 → 关卡 → 填表 → 开始我的人生 → 终检
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-open-8001.mjs')"
import * as L from "./ego-lib-8001.mjs";

await L.run("开局", async () => {
  const { page } = await L.attachLastSpace();
  await L.openTavern(page);
  await L.connectApi(page);
  await L.handlePopups(page, "开局前");

  // 确认当前挂着的就是这张卡；不是就按 title 精确点开它
  const cur = await page.evaluate(() => {
    const ctx = window.SillyTavern?.getContext?.() || {};
    const ch = (ctx.characters || [])[ctx.characterId];
    return { avatar: ch?.avatar ?? null, floors: (ctx.chat || []).length };
  });
  L.log("当前角色", cur);
  if (cur.avatar !== "神豪终端.png") {
    await page.evaluate(() => {
      if (!document.querySelector("#right-nav-panel.openDrawer")) document.querySelector("#rightNavDrawerIcon")?.click();
    });
    await page.waitForTimeout(1200);
    const hit = await page.evaluate(() => {
      const a = [...document.querySelectorAll("#rm_print_characters_block .character_select")]
        .find((c) => (c.querySelector(".avatar")?.getAttribute("title") || "").includes("神豪终端"));
      a?.querySelector(".avatar")?.click();
      return !!a;
    });
    if (!hit) L.fail("打开卡", "角色列表里没有 神豪终端");
    await page.waitForTimeout(2000);
    await L.handlePopups(page, "开局前开卡");
    await L.closeWorldDrawer(page);
  }

  await L.ensureWorldBook(page);
  const m = await L.waitMvu(page);
  L.log("MVU", m);
  if (!m.ok) { await L.shot(page, "mvu-fail"); L.fail("MVU", m); }

  const c0 = await L.chatState(page);
  L.log("开局前提", c0);
  if (c0.floors !== 1 || c0.lastIsUser !== false) L.fail("开局前提", { ...c0, msg: "不是 1 楼，改跑 ego-regen-8001.mjs" });
  if (!m.m.wizardIframe) { await L.shot(page, "wizard-missing"); L.fail("开局前提", "开局向导 iframe 不在"); }

  await L.fillAndStartOpening(page, "测试员");
  await L.finalCheck(page, "开局");
});
