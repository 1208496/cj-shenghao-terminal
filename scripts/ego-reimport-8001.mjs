// 重新导入同一张卡：验证酒馆导入弹窗链（标签 → 世界书 → 内置正则 → 嵌入式脚本 → 世界书确认）
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/ego-reimport-8001.mjs')"
import fs from "node:fs";
import * as L from "./ego-lib-8001.mjs";

await L.run("重新导入卡", async () => {
  // 控制权此前在用户手里，用户明确说「继续」后接管
  const id = Number(fs.readFileSync(L.SPACE_FILE, "utf8").trim());
  await takeOverTaskSpace(id);
  L.log("接管 space", id);
  const { page } = await L.attachLastSpace();
  await L.openTavern(page);

  // 记录导入前的角色列表（title 集合，用于差集，绝不按名字模糊找卡）
  const prev = await page.evaluate(() =>
    [...document.querySelectorAll("#rm_print_characters_block .character_select")]
      .map((c) => c.querySelector(".avatar")?.getAttribute("title") || ""));
  L.log("导入前角色数", prev.length);

  await page.evaluate(() => {
    if (!document.querySelector("#right-nav-panel.openDrawer")) document.querySelector("#rightNavDrawerIcon")?.click();
  });
  await page.waitForTimeout(1500);

  await page.setInputFiles("#character_import_file", [L.CARD]);
  await page.waitForTimeout(2500);
  const importPopups = await L.handlePopups(page, "重导");

  const fresh = await page.evaluate((p) =>
    [...document.querySelectorAll("#rm_print_characters_block .character_select")]
      .map((c) => ({ chid: c.getAttribute("data-chid"), title: c.querySelector(".avatar")?.getAttribute("title") || "" }))
      .filter((x) => !p.includes(x.title)), prev);
  L.log("新增的卡", fresh);
  if (fresh.length !== 1) { await L.shot(page, "reimport-fail"); L.fail("重导", { 期望新增1张: fresh }); }

  // 打开新导入的这张卡（不复用旧卡），把「世界书 / 内置正则 / 嵌入式脚本」弹窗逐个点掉
  await page.waitForTimeout(1000);
  await page.evaluate((id) => {
    document.querySelector(`#rm_print_characters_block [data-chid="${id}"] .avatar`)?.click();
  }, fresh[0].chid);
  await page.waitForTimeout(2000);
  const openPopups = await L.handlePopups(page, "重导开卡");
  await L.closeWorldDrawer(page);

  const w = await L.worldState(page);
  const m = await L.waitMvu(page);
  const c = await L.chatState(page);
  const report = { 新增卡: fresh[0], 导入弹窗: importPopups, 开卡弹窗: openPopups, 世界书: w, 聊天楼层: c, MVU: m };
  L.log("重导结果", report);
  await L.shot(page, "重导-result");

  if (!(w.world && w.exists && w.globeLit)) L.fail("重导世界书", w);
  if (c.floors !== 1) L.fail("重导开局前提", { ...c, msg: "新卡应该只有开场白 1 楼" });
});
