// 标准全流程（8001 测试酒馆）：新 space → 打开 → 连 API → 酒馆里导入卡 → 处理弹窗 → 开卡 → 处理弹窗
// → 世界书关卡 → MVU 关卡 → 填开局 → 开始我的人生 → 等回复 → 小手机关卡
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-std-flow-8001.mjs')"
import * as L from "./ego-lib-8001.mjs";

await L.run("全流程", async () => {
  const { page } = await L.newSpace("8001 标准流程");

  // 1. 打开 + 连 API
  await L.openTavern(page);
  await L.connectApi(page);

  // 2. 在酒馆界面里导入卡（setInputFiles 到 #character_import_file，绝不往 data 目录里拷文件）
  const chid = await L.importCard(page);

  // 3. 开卡（等 1 秒再点），把「世界书 / 内置正则 / 嵌入式脚本」弹窗逐个点掉
  await page.waitForTimeout(1000);
  await L.openCard(page, chid);

  // 4. 世界书关卡：不过就走「更多... → 导入角色卡的世界书」补；补不上就停
  await L.ensureWorldBook(page);

  // 5. MVU 关卡：不过 → 刷新页面、重连 API、重开这张卡、再点确认框，只重试 1 次
  let m = await L.waitMvu(page);
  L.log("MVU", m);
  if (!m.ok) {
    L.log("MVU 没起来 → 刷新页面重开卡（只试一次）");
    await L.openTavern(page);
    await L.connectApi(page);
    await L.openCard(page, chid);
    await L.ensureWorldBook(page);
    m = await L.waitMvu(page);
    L.log("MVU 复查", m);
    if (!m.ok) { await L.shot(page, "mvu-fail"); L.fail("MVU", m); }
  }

  // 6. 开局前提：聊天里只有开场白 1 楼，且向导 iframe 在
  const c0 = await L.chatState(page);
  if (c0.floors !== 1 || c0.lastIsUser !== false) L.fail("开局前提", { ...c0, msg: "已经开过局了，不准重填表，改跑 ego-regen-8001.mjs" });
  if (!m.m.wizardIframe) { await L.shot(page, "wizard-missing"); L.fail("开局前提", "开局向导 iframe 不在（嵌入式脚本/正则没启用）"); }

  // 7. 填开局
  const inWizard = (re) => page.evaluate((src) => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const b = [...(doc?.querySelectorAll("button") ?? [])].find((x) => new RegExp(src).test((x.textContent || "").trim()));
    b?.click();
    return !!b;
  }, re);
  await page.fill("#f_name", "测试员");
  if (!(await inWizard("富家公子哥"))) L.fail("开局表单", "找不到「富家公子哥」");
  await page.waitForTimeout(1000);
  for (let i = 0; i < 2; i += 1) { await inWizard("^下一步$"); await page.waitForTimeout(1000); }
  await inWizard("预览开局");
  await page.waitForTimeout(1500);
  const startDisabled = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    return [...(doc?.querySelectorAll("button") ?? [])].find((b) => /开始我的人生/.test(b.textContent || ""))?.disabled ?? null;
  });
  L.log("预览", { startDisabled });
  if (startDisabled !== false) { await L.shot(page, "preview-fail"); L.fail("预览开局", { startDisabled }); }

  // 8. 开局 → 等回复（唯一合法的长等待）
  const sig = await L.lastSig(page);
  await inWizard("开始我的人生");
  if (!(await L.waitReply(page, sig))) { await L.shot(page, "reply-timeout"); L.fail("开局回复", "150 秒没回（这时才可以考虑 ego-regen-8001.mjs）"); }

  // 9. 小手机 + 变量关卡
  await L.finalCheck(page, "开局");
});
