// 实机测试驱动脚本：ego lite + 本机 SillyTavern + 神豪终端整卡
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/live-test-ego.mjs')"
// 流程说明与踩坑清单见 tests/live-ego.md
//
// 注意：ego 的每个 Node 进程都是独立的，变量不跨进程；本脚本自己建空间、自己过认证。

const CONFIG = {
  stUrl: "http://127.0.0.1:8000/",
  basicUser: "user",
  basicPass: "98",
  cardPath: "E:/SHZDCHOSSS/dist/2.0.0-rc.21/神豪终端.json",
  characterMatch: "神豪",
  playerName: "测试员",
  tierText: "小康人家",
  spaceId: null, // 填已有 spaceId 可接管重跑；null 则新建
  waitForReplyMs: 120000,
  keepSpace: true, // true = 跑完不关闭，留给人工继续看
};

const fs = await import("node:fs/promises");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const shotDir = `C:/Users/Administrator/ego/live-test/${stamp}`;
await fs.mkdir(shotDir, { recursive: true });

const steps = [];
const record = (step, ok, detail) => {
  steps.push({ step, ok, detail });
  if (!ok) console.log(`[live-test] FAIL ${step}: ${JSON.stringify(detail).slice(0, 300)}`);
};

// ---------- 空间与页面 ----------
const existing = CONFIG.spaceId ? (await listTaskSpaces()).find((s) => s.id === CONFIG.spaceId) : null;
let task;
if (!existing) task = await taskSpace("实机测试 神豪终端");
else if (existing.ownership === "agent") task = await taskSpace(existing.id);
else task = await takeOverTaskSpace(existing.id);

let page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
record("space", true, { spaceId: task.spaceId, page: page.label });

// ---------- 认证（每个进程都要重设） ----------
async function injectAuth() {
  const auth = "Basic " + Buffer.from(`${CONFIG.basicUser}:${CONFIG.basicPass}`, "utf8").toString("base64");
  await page.cdp("Network.enable", {});
  await page.cdp("Network.setExtraHTTPHeaders", { headers: { Authorization: auth } });
}

const clickByText = (matcherSource, { exact = true } = {}) =>
  page.evaluate(
    ({ matcherSource, exact }) => {
      const re = new RegExp(matcherSource);
      const pool = [...document.querySelectorAll("button, .menu_button, [class*='button'], .popup-button-ok, div, span")]
        .filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
      const hit = pool.find((el) => {
        const t = (el.textContent || "").trim();
        return exact ? re.test(t) : re.test(t);
      });
      if (!hit) return null;
      hit.click();
      return (hit.textContent || "").trim().slice(0, 20);
    },
    { matcherSource, exact },
  );

// ---------- 1. 打开酒馆 ----------
try {
  await injectAuth();
  await page.goto(CONFIG.stUrl, { timeout: 60000 });
  await page.waitForSelector("#send_form", { state: "visible", timeout: 45000 });
  record("open-st", true, { url: await page.url(), title: await page.title() });
} catch (error) {
  record("open-st", false, String(error).slice(0, 220));
}

// ---------- 2. 连接 API ----------
try {
  await injectAuth();
  await page.click("#API-status-top", { label: "open API drawer" }).catch(async () => {
    await page.evaluate(() => document.querySelector("#API-status-top")?.click());
  });
  await page.waitForTimeout(1200);
  const clicked = await clickByText("^连接$");
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => ({
    iconCls: (document.querySelector("#API-status-top")?.className || "").slice(0, 90),
    toasts: [...document.querySelectorAll(".toast, .toast-message, .toast-body")].map((t) => t.textContent.trim().slice(0, 80)),
  }));
  const connected = state.iconCls.includes("fa-plug") && !state.iconCls.includes("exclamation");
  record("connect-api", !!clicked && connected, { clicked, ...state });
} catch (error) {
  record("connect-api", false, String(error).slice(0, 220));
}

// ---------- 3. 清确认弹窗 ----------
try {
  const cleared = [];
  for (let i = 0; i < 6; i += 1) {
    const hit = await clickByText("^(确认|确定|是|OK|启用)$");
    if (!hit) break;
    cleared.push(hit);
    await page.waitForTimeout(1400);
  }
  const tagged = await clickByText("^全部导入$");
  if (tagged) {
    cleared.push(tagged);
    await page.waitForTimeout(1500);
  }
  record("clear-dialogs", true, { cleared });
} catch (error) {
  record("clear-dialogs", false, String(error).slice(0, 220));
}

// ---------- 4. 导入整卡 ----------
let importedName = null;
try {
  await injectAuth();
  await page.click("#rightNavDrawerIcon", { label: "open character list" }).catch(() => {});
  await page.waitForSelector("#character_import_file", { state: "attached", timeout: 15000 });
  await page.setInputFiles("#character_import_file", [CONFIG.cardPath]);
  await page.waitForTimeout(2500);
  await clickByText("^全部导入$");
  await page.waitForTimeout(1200);
  await clickByText("^(确认|确定)$");
  await page.waitForTimeout(1500);

  const found = await page.evaluate((match) => {
    const cards = [...document.querySelectorAll("#rm_print_characters_block .character_select")];
    const hit = cards.filter((c) => (c.querySelector(".avatar")?.getAttribute("title") || "").includes(match)).pop();
    return {
      total: cards.length,
      chid: hit?.getAttribute("data-chid") ?? null,
      title: hit?.querySelector(".avatar")?.getAttribute("title") ?? null,
      toasts: [...document.querySelectorAll(".toast, .toast-message")].map((t) => t.textContent.trim().slice(0, 60)).slice(0, 5),
    };
  }, CONFIG.characterMatch);
  importedName = found.title;
  record("import-card", !!found.chid, found);
} catch (error) {
  record("import-card", false, String(error).slice(0, 220));
}

// ---------- 5. 打开该角色 ----------
try {
  const opened = await page.evaluate((match) => {
    const cards = [...document.querySelectorAll("#rm_print_characters_block .character_select")];
    const hit = cards.filter((c) => (c.querySelector(".avatar")?.getAttribute("title") || "").includes(match)).pop();
    if (!hit) return null;
    (hit.querySelector(".avatar") ?? hit).click();
    return { chid: hit.getAttribute("data-chid") };
  }, CONFIG.characterMatch);
  await page.waitForTimeout(4000);
  const state = await page.evaluate(() => {
    const frame = document.getElementById("TH-message--0--0");
    return {
      mesCount: document.querySelectorAll("#chat .mes").length,
      openingSrcdocLen: (frame?.getAttribute("srcdoc") || "").length,
    };
  });
  record("open-character", !!opened && state.openingSrcdocLen > 100000, { opened, ...state });
} catch (error) {
  record("open-character", false, String(error).slice(0, 220));
}

// ---------- 6. 走开局向导 ----------
try {
  const fill = await page.evaluate((playerName) => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    if (!doc) return { error: "no opening doc" };
    const win = doc.defaultView;
    const setVal = (el, v) => {
      if (!el) return false;
      const proto = el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
      el.dispatchEvent(new win.Event("input", { bubbles: true }));
      el.dispatchEvent(new win.Event("change", { bubbles: true }));
      return true;
    };
    const okName = setVal(doc.getElementById("f_name"), playerName);
    return { nameFilled: okName, name: doc.getElementById("f_name")?.value ?? null };
  }, CONFIG.playerName);

  await page.waitForTimeout(500);

  const advanced = await page.evaluate((tierText) => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const btns = [...doc.querySelectorAll("button")];
    const tier = btns.find((b) => (b.textContent || "").includes(tierText));
    tier?.click();
    return { tierClicked: !!tier };
  }, CONFIG.tierText);
  await page.waitForTimeout(600);

  const nextClicks = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const clicked = [];
    for (let i = 0; i < 4; i += 1) {
      const next = [...doc.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "下一步");
      if (!next) break;
      next.click();
      clicked.push(i);
    }
    return clicked.length;
  });
  await page.waitForTimeout(1500);

  const preview = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const btn = [...doc.querySelectorAll("button")].find((b) => /预览开局/.test(b.textContent || ""));
    btn?.click();
    return !!btn;
  });
  await page.waitForTimeout(1800);

  const summary = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    return {
      headings: [...doc.querySelectorAll("h1,h2,h3")].map((h) => h.textContent.trim().slice(0, 20)),
      text: (doc.body.innerText || "").replace(/\s+/g, " ").slice(0, 200),
      hasStart: [...doc.querySelectorAll("button")].some((b) => /开始我的人生/.test(b.textContent || "")),
    };
  });

  const before = await page.evaluate(() => document.querySelectorAll("#chat .mes").length);
  const started = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const btn = [...doc.querySelectorAll("button")].find((b) => /开始我的人生/.test(b.textContent || ""));
    btn?.click();
    return !!btn;
  });

  let generated = false;
  try {
    await page.waitForFunction((n) => document.querySelectorAll("#chat .mes").length > n + 1, before, {
      timeout: CONFIG.waitForReplyMs,
    });
    generated = true;
  } catch {
    generated = false;
  }
  await page.waitForTimeout(1500);

  const reply = await page.evaluate(() => {
    const mes = [...document.querySelectorAll("#chat .mes")];
    const last = mes[mes.length - 1];
    return {
      mesCount: mes.length,
      lastIsUser: last?.getAttribute("is_user") === "true",
      lastLen: (last?.querySelector(".mes_text")?.innerText || "").length,
      lastHead: (last?.querySelector(".mes_text")?.innerText || "").replace(/\s+/g, " ").slice(0, 220),
    };
  });

  record("run-opening", !!started && generated, { ...fill, ...advanced, nextClicks, preview, summary, reply });
} catch (error) {
  record("run-opening", false, String(error).slice(0, 260));
}

// ---------- 7. 手机界面取证 ----------
try {
  const shotMain = `${shotDir}/chat.png`;
  await page.screenshot({ path: shotMain }).catch(() => null);

  const phoneInfo = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    if (!doc) return { error: "no phone frame" };
    const folded = doc.getElementById("folded");
    const opened = folded && !(folded.className || "").includes("foldedshow");
    if (folded && doc.getElementById("folded")?.className?.includes("folded")) folded.click();
    return { clickedLauncher: !!folded };
  });
  await page.waitForTimeout(2000);

  const phoneText = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    return (doc?.body.innerText || "").replace(/\s+/g, " ").slice(0, 700);
  });

  // 手机浮层贴右边缘且带 0.82 缩放，ego 截图会裁掉；临时挪到左上取证后还原
  await page.evaluate(() => {
    const f = document.getElementById("cj-shenghao-phone-frame");
    if (!f) return;
    window.__livePhoneBackup = f.getAttribute("style") || "";
    f.style.setProperty("position", "fixed", "important");
    f.style.setProperty("left", "20px", "important");
    f.style.setProperty("top", "70px", "important");
    f.style.setProperty("right", "auto", "important");
    f.style.setProperty("z-index", "2147483000", "important");
    f.style.setProperty("transform", "none", "important");
  });
  await page.waitForTimeout(900);
  const shotPhone = `${shotDir}/phone.png`;
  await page.screenshot({ path: shotPhone }).catch(() => null);
  await page.evaluate(() => {
    const f = document.getElementById("cj-shenghao-phone-frame");
    if (f) {
      f.setAttribute("style", window.__livePhoneBackup || "");
      delete window.__livePhoneBackup;
    }
  });

  const income = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    const tab = [...(doc?.querySelectorAll(".tab") ?? [])].find((t) => /我的/.test(t.textContent || ""));
    tab?.click();
    return !!tab;
  });
  await page.waitForTimeout(1600);
  const wealthText = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    return (doc?.body.innerText || "").replace(/\s+/g, " ").slice(0, 500);
  });

  record("phone-evidence", true, { shotMain, shotPhone, phoneInfo, phoneText, mineTabClicked: income, wealthText });
} catch (error) {
  record("phone-evidence", false, String(error).slice(0, 240));
}

// ---------- 收尾 ----------
const ok = steps.filter((s) => s.ok).length;
const failed = steps.filter((s) => !s.ok).map((s) => s.step);
console.log(
  JSON.stringify(
    {
      spaceId: task.spaceId,
      page: page.label,
      shotDir,
      summary: `${ok}/${steps.length} 步通过`,
      failed,
      steps,
      keptSpace: CONFIG.keepSpace,
    },
    null,
    2,
  ),
);

if (!CONFIG.keepSpace) await task.finish({ keep: [] });
