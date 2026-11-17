// ego 驱动测试酒馆 8001 的公共函数（给 ego-std-flow-8001.mjs / ego-regen-8001.mjs 用）
// 原则：每一步都有「关卡」，关卡不过就停下截图报告，绝不带病往下走。
import fs from "node:fs";

export const BASE = "http://127.0.0.1:8001/";
export const CARD = "E:/SHZDCHOSSS/.work/test-card/神豪终端-localmvu.json";
export const SHOT_DIR = "C:/Users/Administrator/ego/std-flow";
export const SPACE_FILE = SHOT_DIR + "/last-space.txt";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const T0 = Date.now();
const STAMP = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
export const log = (n, x) =>
  console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${n}` + (x !== undefined ? " " + JSON.stringify(x) : ""));

export class Stop extends Error {}
export const fail = (step, detail) => {
  throw new Stop(`${step} :: ${JSON.stringify(detail)}`);
};

export async function shot(page, name) {
  const p = `${SHOT_DIR}/${STAMP}-${name}.png`;
  try { await page.screenshot({ path: p }); log("截图", p); } catch (e) { log("截图失败", String(e).slice(0, 80)); }
  return p;
}

// ---------- space ----------
export async function newSpace(label) {
  const task = await taskSpace(label + " " + Date.now());
  const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
  fs.writeFileSync(SPACE_FILE, String(task.spaceId));
  log("新 space", { id: task.spaceId, 记录到: SPACE_FILE });
  return { task, page };
}

export async function attachLastSpace() {
  if (!fs.existsSync(SPACE_FILE)) fail("找 space", "没有 last-space.txt，先跑 ego-std-flow-8001.mjs");
  const id = Number(fs.readFileSync(SPACE_FILE, "utf8").trim());
  const entry = (await listTaskSpaces()).find((s) => s.id === id);
  if (!entry) fail("找 space", { id, msg: "space 不存在了，重新跑完整流程" });
  if (entry.ownership === "user") fail("找 space", { id, msg: "控制权在用户手里，停下问用户，不准自己抢" });
  const task = await taskSpace(id);
  const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
  log("接管 space", { id });
  return { task, page };
}

// ---------- 打开 / 连 API ----------
export async function openTavern(page) {
  await page.goto(BASE, { timeout: 25000 });
  let st = null;
  for (let i = 0; i < 40; i += 1) {
    st = await page.evaluate(() => ({
      ready: document.readyState,
      preloader: !!document.getElementById("preloader"),
      sendForm: !!document.getElementById("send_form"),
    }));
    if (st.ready === "complete" && !st.preloader && st.sendForm) break;
    await page.waitForTimeout(300);
  }
  log("打开酒馆", st);
  if (st.preloader || !st.sendForm) { await shot(page, "open-fail"); fail("打开酒馆", st); }
}

export async function connectApi(page) {
  await page.evaluate(() => document.querySelector("#API-status-top")?.click());
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const pool = [...document.querySelectorAll("button, .menu_button, div, span")]
      .filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
    pool.find((el) => (el.textContent || "").trim() === "连接")?.click();
  });
  let ok = false;
  for (let i = 0; i < 10 && !ok; i += 1) {
    await page.waitForTimeout(800);
    ok = await page.evaluate(() => {
      const c = document.querySelector("#API-status-top")?.className || "";
      return c.includes("fa-plug") && !c.includes("exclamation");
    });
  }
  await page.evaluate(() => document.querySelector("#API-status-top")?.click()); // 收起抽屉
  await page.waitForTimeout(600);
  log("连 API", { ok });
  if (!ok) { await shot(page, "api-fail"); fail("连 API", "插头仍是感叹号"); }
}

// ---------- 弹窗：逐个认名字处理，不认识的不准瞎点 ----------
const POPUP_RULES = [
  { name: "标签导入", match: "导入标签|Import Tags", btn: "^(全部导入|Import All)$" },
  { name: "世界书导入(打开卡时)", match: "embedded World/Lorebook|内嵌.*世界书", btn: "^(是|Yes)$" },
  { name: "世界书导入确认", match: "Are you sure you want to import|确定要导入", btn: "^(是|Yes|确定|OK)$" },
  { name: "内置正则", match: "内置正则|embedded regex", btn: "^(是|确定|确认|Yes|OK)$" },
  { name: "酒馆助手嵌入式脚本", match: "嵌入式脚本", btn: "^(确认|确定|是)$" },
];

export async function readPopups(page) {
  return page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight);
    return [...document.querySelectorAll(".popup")].filter(vis).map((p) => ({
      text: (p.innerText || "").replace(/\s+/g, " ").slice(0, 120),
      buttons: [...p.querySelectorAll("button, div, span, a")]
        .filter((el) => el.children.length === 0 && vis(el))
        .map((el) => (el.textContent || "").trim())
        .filter((t) => t && t.length <= 8),
    }));
  });
}

// 一直处理到「连续 quietMs 毫秒没有任何弹窗」为止；遇到不认识的弹窗 → 截图 + 停
export async function handlePopups(page, tag, { quietMs = 3000, maxMs = 25000 } = {}) {
  const done = [];
  const t0 = Date.now();
  let lastSeen = Date.now();
  while (Date.now() - t0 < maxMs) {
    const pops = await readPopups(page);
    if (!pops.length) {
      if (Date.now() - lastSeen >= quietMs) break;
      await page.waitForTimeout(400);
      continue;
    }
    lastSeen = Date.now();
    const r = await page.evaluate((rules) => {
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight);
      for (const p of [...document.querySelectorAll(".popup")].filter(vis)) {
        const txt = (p.innerText || "").replace(/\s+/g, " ");
        const rule = rules.find((x) => new RegExp(x.match, "i").test(txt));
        if (!rule) return { unknown: txt.slice(0, 160) };
        const leaf = [...p.querySelectorAll("button, div, span, a")].filter((el) => el.children.length === 0 && vis(el));
        const b = leaf.find((el) => new RegExp(rule.btn, "i").test((el.textContent || "").trim()));
        if (!b) return { noButton: rule.name, txt: txt.slice(0, 120) };
        const label = (b.textContent || "").trim();
        b.click();
        return { clicked: rule.name + " → " + label };
      }
      return null;
    }, POPUP_RULES);
    if (r?.unknown || r?.noButton) { await shot(page, `${tag}-popup-unknown`); fail(`${tag} 弹窗`, r); }
    if (r?.clicked) { done.push(r.clicked); log(`${tag} 弹窗`, r.clicked); }
    await page.waitForTimeout(1000);
  }
  const left = await readPopups(page);
  if (left.length) { await shot(page, `${tag}-popup-left`); fail(`${tag} 弹窗没清完`, left); }
  log(`${tag} 弹窗全部处理完`, done);
  return done;
}

// 世界书导入后酒馆会自动展开世界书面板，把它收起来，免得挡住
export async function closeWorldDrawer(page) {
  await page.evaluate(() => {
    const open = document.querySelector("#WorldInfo.openDrawer");
    if (open) document.querySelector("#WIDrawerIcon")?.click();
  });
  await page.waitForTimeout(600);
}

// ---------- 导卡 / 开卡 ----------
export async function importCard(page) {
  await page.evaluate(() => {
    if (!document.querySelector("#right-nav-panel.openDrawer")) document.querySelector("#rightNavDrawerIcon")?.click();
  });
  await page.waitForTimeout(1500);
  const prev = await page.evaluate(() =>
    [...document.querySelectorAll("#rm_print_characters_block .character_select")]
      .map((c) => c.querySelector(".avatar")?.getAttribute("title") || ""));
  await page.setInputFiles("#character_import_file", [CARD]);
  await page.waitForTimeout(2500);
  await handlePopups(page, "导卡");
  const fresh = await page.evaluate((p) =>
    [...document.querySelectorAll("#rm_print_characters_block .character_select")]
      .map((c) => ({ chid: c.getAttribute("data-chid"), title: c.querySelector(".avatar")?.getAttribute("title") || "" }))
      .filter((x) => !p.includes(x.title)), prev);
  log("新导入的卡", fresh);
  if (fresh.length !== 1) { await shot(page, "import-fail"); fail("导卡", { 期望新增1张: fresh }); }
  return fresh[0].chid;
}

export async function openCard(page, chid) {
  await page.evaluate(() => {
    if (!document.querySelector("#right-nav-panel.openDrawer")) document.querySelector("#rightNavDrawerIcon")?.click();
  });
  await page.waitForTimeout(1000);
  const ok = await page.evaluate((id) => {
    const a = document.querySelector(`#rm_print_characters_block [data-chid="${id}"] .avatar`);
    a?.click();
    return !!a;
  }, chid);
  if (!ok) fail("开卡", { chid, msg: "角色列表里找不到这张卡" });
  await page.waitForTimeout(2000); // 确认框 0.5–1.2 秒后才出，先等
  await handlePopups(page, "开卡");
  await closeWorldDrawer(page);
}

// ---------- 关卡：世界书 ----------
export async function worldState(page) {
  return page.evaluate(() => {
    const ctx = window.SillyTavern?.getContext?.() || {};
    const ch = (ctx.characters || [])[ctx.characterId];
    const world = ch?.data?.extensions?.world || "";
    const names = [...document.querySelectorAll("#world_editor_select option")].map((o) => (o.textContent || "").trim());
    return {
      char: ch?.avatar ?? null,
      hasEmbedded: !!ch?.data?.character_book,
      world,
      exists: !!world && names.includes(world),
      globeLit: !!document.querySelector("#world_button.world_set"),
    };
  });
}

// 世界书不在 → 走「更多... → 导入角色卡的世界书 → 是」（hh01-import-lore3 实测成功的路线）
export async function ensureWorldBook(page) {
  let w = await worldState(page);
  log("世界书检查", w);
  if (w.world && w.exists && w.globeLit) return w;
  if (!w.hasEmbedded) { await shot(page, "world-noembed"); fail("世界书", { msg: "这张卡没有内嵌世界书，卡本身有问题", w }); }

  log("世界书缺失 → 走 更多... → 导入角色卡的世界书");
  const sel = await page.evaluate(() => {
    const s = document.getElementById("char-management-dropdown");
    if (!s) return { ok: false };
    const i = [...s.options].findIndex((o) => /Import Card Lore|导入角色卡的世界书/i.test((o.textContent || "").trim()));
    if (i < 0) return { ok: false, opts: [...s.options].map((o) => (o.textContent || "").trim()) };
    s.selectedIndex = i;
    s.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  });
  if (!sel.ok) { await shot(page, "world-nodropdown"); fail("世界书", sel); }
  await page.waitForTimeout(1500);
  await handlePopups(page, "导世界书");
  await page.waitForTimeout(1500);
  await closeWorldDrawer(page);
  w = await worldState(page);
  log("世界书复查", w);
  if (!(w.world && w.exists && w.globeLit)) { await shot(page, "world-fail"); fail("世界书", w); }
  return w;
}

// ---------- 关卡：MVU / 开局向导 ----------
export async function mvuState(page) {
  return page.evaluate(() => ({
    mvu: typeof window.Mvu,
    schema: typeof window.__CJ_SHENGHAO_SCHEMA__,
    loader: typeof window.__CJ_MVU_LOADER__,
    host: typeof window.__CJ_SHENGHAO_V2__,
    wizardIframe: !!document.getElementById("TH-message--0--0"),
  }));
}

export async function waitMvu(page, ms = 12000) {
  let m = null;
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    m = await mvuState(page);
    if (m.mvu === "object" && m.schema === "object" && m.host === "object") return { ok: true, m };
    await page.waitForTimeout(400);
  }
  return { ok: false, m };
}

export async function chatState(page) {
  return page.evaluate(() => {
    const chat = window.SillyTavern?.getContext?.()?.chat || [];
    return { floors: chat.length, lastIsUser: chat.at(-1)?.is_user ?? null };
  });
}

// ---------- 等模型回复（唯一允许的长等待） ----------
// 先在点按钮「之前」调用 lastSig() 记下最后一条，点完再 waitReply(page, sig)。
// 判据：最后一条不是用户消息，且和点之前不是同一条（楼层数或正文变了）。
export async function lastSig(page) {
  return page.evaluate(() => {
    const c = window.SillyTavern?.getContext?.()?.chat || [];
    return { n: c.length, mes: c.at(-1)?.mes || "" };
  });
}

const isGenerating = (page) =>
  page.evaluate(() => {
    const s = document.getElementById("mes_stop");
    return !!s && getComputedStyle(s).display !== "none"; // 酒馆用 style.display 控制，不是 displayNone 类
  });

export async function waitReply(page, sig) {
  let replied = false;
  try {
    await page.waitForFunction((b) => {
      const c = window.SillyTavern?.getContext?.()?.chat || [];
      const last = c.at(-1);
      return !!last && last.is_user === false && (c.length !== b.n || (last.mes || "") !== b.mes);
    }, sig, { timeout: 150000 });
    replied = true;
  } catch {}
  for (let i = 0; i < 60; i += 1) {
    if (!(await isGenerating(page))) break;
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(4000);
  log("模型回复", { replied });
  return replied;
}

// ---------- 关卡：小手机 + 变量 ----------
export async function finalCheck(page, tag) {
  // 小手机默认是折叠态（iframe 里只有「✦ 神豪终端」壳按钮），先展开再判内容
  const expanded = await page.evaluate(() => {
    const pd = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    const f = pd?.getElementById("folded");
    if (f && f.offsetWidth) { f.click(); return true; }
    return false;
  });
  if (expanded) { log("小手机展开", true); await page.waitForTimeout(1800); }

  const s = await page.evaluate(() => {
    const chat = window.SillyTavern?.getContext?.()?.chat || [];
    let s2 = null;
    for (let i = chat.length - 1; i >= 0; i -= 1) {
      try {
        const v = window.Mvu?.getMvuData?.({ type: "message", message_id: i });
        if (v?.stat_data?.shenghao?.meta?.initialized) { s2 = v.stat_data.shenghao; break; }
      } catch {}
    }
    const phone = document.getElementById("cj-shenghao-phone-frame");
    // 当前卡的小手机是 iframe 壳（#app + 折叠按钮 #folded），没有旧的 .phone-screen 类；
    // 判据改为「壳在 + 内部界面已渲染」（basic-grid / world-time-card / dossier-grid / char-row 任一）
    const pd = phone?.contentDocument;
    return {
      floors: chat.length,
      lastIsUser: chat.at(-1)?.is_user ?? null,
      mvuInit: !!s2,
      rev: s2?.meta?.revision ?? null,
      cash: s2?.user?.cashCents ?? null,
      date: s2?.world?.date ?? null,
      people: s2 ? Object.values(s2.characters || {}).map((c) => `${c.name} ♥${c.affection}/❖${c.corruption}`) : [],
      phoneFrame: !!phone,
      phoneMounted: !!pd?.getElementById("app"),
      phoneRendered: !!pd?.querySelector(".basic-grid, .world-time-card, .dossier-grid, .char-row"),
      phoneText: (pd?.body?.innerText || "").replace(/\s+/g, " ").slice(0, 120),
      head: (chat.at(-1)?.mes || "").replace(/\s+/g, " ").slice(0, 120),
    };
  });
  log(`${tag} 终检`, s);
  await shot(page, `${tag}-final`);
  if (s.lastIsUser !== false) fail(`${tag} 终检`, "最后一条还是用户消息 = 模型没回");
  if (!s.mvuInit) fail(`${tag} 终检`, "MVU 变量没初始化");
  if (!s.phoneFrame || !s.phoneMounted || !s.phoneRendered) fail(`${tag} 终检`, "小手机没出来（先查世界书、MVU，修好后跑 ego-regen-8001.mjs）");  return s;
}

// ---------- 填开局表 + 开始我的人生 + 等回复（std-flow 与 open 脚本共用）----------
export async function fillAndStartOpening(page, name = "测试员") {
  const inWizard = (re) => page.evaluate((src) => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const b = [...(doc?.querySelectorAll("button") ?? [])].find((x) => new RegExp(src).test((x.textContent || "").trim()));
    b?.click();
    return !!b;
  }, re);

  await page.fill("#f_name", name);
  if (!(await inWizard("富家公子哥"))) fail("开局表单", "找不到「富家公子哥」");
  await page.waitForTimeout(1000);
  for (let i = 0; i < 2; i += 1) { await inWizard("^下一步$"); await page.waitForTimeout(1000); }
  await inWizard("预览开局");
  await page.waitForTimeout(1500);
  const startDisabled = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    return [...(doc?.querySelectorAll("button") ?? [])].find((b) => /开始我的人生/.test(b.textContent || ""))?.disabled ?? null;
  });
  log("预览", { startDisabled });
  if (startDisabled !== false) { await shot(page, "preview-fail"); fail("预览开局", { startDisabled }); }

  const sig = await lastSig(page);
  await inWizard("开始我的人生");
  if (!(await waitReply(page, sig))) { await shot(page, "reply-timeout"); fail("开局回复", "150 秒没回（这时才可以考虑 ego-regen-8001.mjs）"); }
}

export async function run(name, fn) {
  try {
    await fn();
    console.log(`RESULT=PASS ${name}`);
  } catch (e) {
    console.log(`RESULT=FAIL ${name} :: ${e instanceof Stop ? e.message : String(e?.stack || e).slice(0, 400)}`);
    console.log("→ 停下，把上面这行和截图原样报告给用户，不要自己换路子硬试。");
  }
}
