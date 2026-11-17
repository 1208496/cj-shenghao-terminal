// 重新生成（8001 测试酒馆）：已经开过局后用。接管上一次的 space → 清弹窗 → 世界书关卡 → MVU 关卡
// → 点「重新生成」→ 等回复 → 小手机关卡
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-regen-8001.mjs')"
import * as L from "./ego-lib-8001.mjs";

await L.run("重新生成", async () => {
  const { page } = await L.attachLastSpace();

  // 1. 先把挂着的弹窗按名字处理掉（不认识的会停）
  await L.handlePopups(page, "接管", { quietMs: 1500 });

  // 2. 前提：确实已经开过局（有用户的开局消息）
  const c0 = await L.chatState(page);
  L.log("聊天状态", c0);
  if (c0.floors < 2) L.fail("重新生成前提", { ...c0, msg: "还没开局，不能点重新生成，跑 ego-std-flow-8001.mjs" });

  // 3. 世界书关卡（没有就当场在酒馆里补导入），MVU 关卡
  await L.ensureWorldBook(page);
  const m = await L.waitMvu(page);
  L.log("MVU", m);
  if (!m.ok) { await L.shot(page, "regen-mvu-fail"); L.fail("MVU", { ...m, msg: "MVU 没起来，重新生成也没用 → 重跑 ego-std-flow-8001.mjs" }); }

  // 4. 点「重新生成」（左下 ☰ 菜单里的 #option_regenerate，JS 点击）
  const sig = await L.lastSig(page);
  const clicked = await page.evaluate(() => {
    const b = document.getElementById("option_regenerate");
    b?.click();
    return !!b;
  });
  L.log("点重新生成", { clicked });
  if (!clicked) L.fail("重新生成", "找不到 #option_regenerate");

  if (!(await L.waitReply(page, sig))) { await L.shot(page, "regen-timeout"); L.fail("重新生成回复", "150 秒没回"); }

  // 5. 小手机 + 变量关卡
  await L.finalCheck(page, "重新生成");
});
