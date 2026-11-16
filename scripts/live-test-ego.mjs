// 实机测试驱动脚本：ego lite + 本机 SillyTavern + 神豪终端整卡（rc.22）
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/live-test-ego.mjs')"
// 流程说明与踩坑清单见 tests/live-ego.md
//
// 注意：ego 的每个 Node 进程都是独立的，变量不跨进程；本脚本自己建空间、自己过认证。
// rc.22 起导入卡按「导入前后新增的卡片」识别，不再按名字模糊匹配（旧卡也叫「神豪…」）。

const CONFIG = {
  stUrl: "http://127.0.0.1:8000/",
  basicUser: "user",
  basicPass: "98",
  cardPath: "E:/SHZDCHOSSS/dist/2.0.0-rc.23/神豪终端.json",
  characterMatch: "神豪终端", // 仅作兜底文本校验；真正的定位靠「新增卡片」
  playerName: "测试员",
  tierText: "小康人家",
  contacts: [
    { name: "苏晚", age: 26, job: "平面设计师", relation: "同事", affection: 40, corruption: 0, cup: "C", addressing: "陆总", tags: "安静、认真", appearance: "及肩短发，眼睛偏圆，笑起来有浅梨涡", body: "身形偏瘦，肩线干净", height: 168, weight: 50, bust: 86, waist: 62, hip: 89, shoe: 37, notes: "同一栋写字楼的设计师", present: true },
    { name: "林知夏", age: 28, job: "律所合伙人", relation: "甲乙方", affection: 30, corruption: 10, cup: "D", addressing: "北辰", tags: "冷静、强硬", appearance: "长发挽起，眼角微挑，戴细金框眼镜", body: "骨相清晰，腿长", height: 172, weight: 55, bust: 90, waist: 64, hip: 92, shoe: 38, notes: "合作过的律师，脾气不好但讲理", present: false },
  ],
  spaceId: null, // 填已有 spaceId 可接管重跑；null 则新建
  reuseChid: null, // 填已导入角色的 chid 可跳过导入，直接测这张卡
  waitForReplyMs: 150000,
  keepSpace: true, // true = 跑完不关闭，留给人工继续看
};

const fs = await import("node:fs/promises");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const shotDir = `C:/Users/Administrator/ego/live-test/${stamp}`;
await fs.mkdir(shotDir, { recursive: true });

const steps = [];
const record = (step, ok, detail) => {
  steps.push({ step, ok, detail });
  if (!ok) console.log(`[live-test] FAIL ${step}: ${JSON.stringify(detail).slice(0, 400)}`);
  else console.log(`[live-test] OK   ${step}`);
};

// ---------- 空间与页面 ----------
const existing = CONFIG.spaceId ? (await listTaskSpaces()).find((s) => s.id === CONFIG.spaceId) : null;
let task;
if (!existing) task = await taskSpace("实机测试 神豪终端 rc.22");
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
// SillyTavern 的确认按钮是 <div class="popup-button-ok">，不是 <button>；
// 按文本找 button 会全部漏掉（实测把开场 iframe 卡死在这里）。
const dismissPopups = async (rounds = 6) => {
  const cleared = [];
  for (let i = 0; i < rounds; i += 1) {
    const hit = await page.evaluate(() => {
      const out = [];
      for (const popup of [...document.querySelectorAll(".popup")]) {
        const btn = popup.querySelector(".popup-button-ok") || popup.querySelector('[class*="popup-button"]');
        if (!btn || !(btn.offsetWidth || btn.offsetHeight)) continue;
        out.push({ popup: (popup.innerText || "").replace(/\s+/g, " ").slice(0, 50), button: (btn.textContent || "").trim() });
        btn.click();
      }
      return out;
    });
    if (!hit.length) break;
    cleared.push(...hit);
    await page.waitForTimeout(1600);
  }
  return cleared;
};
try {
  record("clear-dialogs", true, { cleared: await dismissPopups() });
} catch (error) {
  record("clear-dialogs", false, String(error).slice(0, 220));
}

// ---------- 4. 导入整卡（按新增卡片识别） ----------
let importedChid = CONFIG.reuseChid ? String(CONFIG.reuseChid) : null;
try {
  await injectAuth();
  await page.click("#rightNavDrawerIcon", { label: "open character list" }).catch(() => {});
  await page.waitForSelector("#character_import_file", { state: "attached", timeout: 15000 });

  if (!CONFIG.reuseChid) {
    const beforeTitles = await page.evaluate(() =>
      [...document.querySelectorAll("#rm_print_characters_block .character_select")].map(
        (c) => c.querySelector(".avatar")?.getAttribute("title") || "",
      ),
    );

    await page.setInputFiles("#character_import_file", [CONFIG.cardPath]);
    await page.waitForTimeout(3500);
    // 三类确认：标签导入 / 内置世界书 / 内置正则 / 酒馆助手嵌入式脚本
    const dialogs = [...(await dismissPopups()), ...(await dismissPopups()), ...(await dismissPopups())];

    const found = await page.evaluate((prev) => {
      const cards = [...document.querySelectorAll("#rm_print_characters_block .character_select")];
      const titles = cards.map((c) => c.querySelector(".avatar")?.getAttribute("title") || "");
      const fresh = [];
      cards.forEach((c, i) => {
        if (!prev.includes(titles[i])) fresh.push({ chid: c.getAttribute("data-chid"), title: titles[i] });
      });
      return {
        total: cards.length,
        fresh,
        toasts: [...document.querySelectorAll(".toast, .toast-message")].map((t) => t.textContent.trim().slice(0, 70)).slice(0, 5),
      };
    }, beforeTitles);

    const hit = found.fresh.at(-1) ?? null;
    importedChid = hit?.chid ?? null;
    record("import-card", !!hit && (hit.title || "").includes(CONFIG.characterMatch), { ...found, hit, dialogs });
  } else {
    const known = await page.evaluate((chid) => {
      const card = [...document.querySelectorAll("#rm_print_characters_block .character_select")].find(
        (c) => c.getAttribute("data-chid") === chid,
      );
      return card ? { chid, title: card.querySelector(".avatar")?.getAttribute("title") || "" } : null;
    }, String(CONFIG.reuseChid));
    record("import-card", !!known, { reuse: true, known });
  }
} catch (error) {
  record("import-card", false, String(error).slice(0, 260));
}

// ---------- 5. 打开刚导入的角色 ----------
try {
  const openChid = async () =>
    page.evaluate((chid) => {
      const card = [...document.querySelectorAll("#rm_print_characters_block .character_select")].find(
        (c) => c.getAttribute("data-chid") === chid,
      );
      if (!card) return null;
      (card.querySelector(".avatar") ?? card).click();
      return { chid, title: card.querySelector(".avatar")?.getAttribute("title") || "" };
    }, importedChid);
  const readState = () =>
    page.evaluate(() => {
      const frame = document.getElementById("TH-message--0--0");
      const doc = frame?.contentDocument;
      return {
        mesCount: document.querySelectorAll("#chat .mes").length,
        openingSrcdocLen: (frame?.getAttribute("srcdoc") || "").length,
        openingText: (doc?.body.innerText || "").replace(/\s+/g, " ").slice(0, 120),
        hasWizard: !!doc?.getElementById("wizard"),
        popups: [...document.querySelectorAll(".popup")].map((p) => (p.innerText || "").replace(/\s+/g, " ").slice(0, 60)),
      };
    });

  const opened = await openChid();
  await page.waitForTimeout(4500);
  let state = await readState();
  if (!state.hasWizard) {
    // 正则/脚本确认没走完时开场 iframe 不会生成：补点弹窗并重新渲染该聊天。
    const dialogs = await dismissPopups();
    await page.evaluate(() => window.SillyTavern?.getContext?.().reloadCurrentChat?.());
    await page.waitForTimeout(4000);
    state = { ...(await readState()), dialogs };
  }
  record("open-character", !!opened && state.hasWizard, { opened, ...state });
} catch (error) {
  record("open-character", false, String(error).slice(0, 260));
}

// ---------- 6. 走开局向导（含两位初始熟人） ----------
try {
  const opening = () =>
    page.evaluate(() => {
      const doc = document.getElementById("TH-message--0--0")?.contentDocument;
      return {
        hasWizard: !!doc?.getElementById("wizard"),
        people: doc?.querySelectorAll(".person-preview").length ?? 0,
        buttons: [...(doc?.querySelectorAll("button") ?? [])].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 24),
      };
    });

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

  const tier = await page.evaluate((tierText) => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const btn = [...doc.querySelectorAll("button")].find((b) => (b.textContent || "").includes(tierText));
    btn?.click();
    return !!btn;
  }, CONFIG.tierText);
  await page.waitForTimeout(700);

  const nextClicks = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    let clicked = 0;
    for (let i = 0; i < 4; i += 1) {
      const next = [...doc.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "下一步");
      if (!next) break;
      next.click();
      clicked += 1;
    }
    return clicked;
  });
  await page.waitForTimeout(1200);

  const contactResults = [];
  for (const person of CONFIG.contacts) {
    const r = await page.evaluate((p) => {
      const doc = document.getElementById("TH-message--0--0")?.contentDocument;
      if (!doc) return { error: "no opening doc" };
      const win = doc.defaultView;
      const opener = [...doc.querySelectorAll("button")].find((b) => (b.textContent || "").includes("添加初始熟人"));
      if (!opener) return { error: "no add-contact button" };
      opener.click();
      const modal = doc.getElementById("modal");
      if (!modal) return { error: "no modal" };
      const setVal = (el, v) => {
        if (!el) return false;
        const proto = el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
        el.dispatchEvent(new win.Event("input", { bubbles: true }));
        el.dispatchEvent(new win.Event("change", { bubbles: true }));
        return true;
      };
      const values = {
        c_name: p.name, c_age: String(p.age), c_relation: p.relation, c_aff: String(p.affection),
        c_corruption: String(p.corruption), c_beauty: "60", c_job: p.job, c_cupSize: p.cup,
        c_addressing: p.addressing, c_personalityTags: p.tags, c_appearance: p.appearance, c_body: p.body,
        c_heightCm: String(p.height), c_weightKg: String(p.weight), c_bustCm: String(p.bust),
        c_waistCm: String(p.waist), c_hipCm: String(p.hip), c_shoeSizeEu: String(p.shoe), c_notes: p.notes,
      };
      const missing = [];
      for (const [key, value] of Object.entries(values)) {
        const el = doc.getElementById("f_" + key);
        if (!el) missing.push(key);
        else setVal(el, value);
      }
      const present = doc.getElementById("c_present");
      if (present) present.checked = p.present === true;
      const save = [...modal.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "添加");
      if (!save) return { error: "no save button", missing };
      save.click();
      return { saved: true, missing, cupFieldOnForm: !!doc.getElementById("f_c_cupSize"), corruptionFieldOnForm: !!doc.getElementById("f_c_corruption") };
    }, person);
    contactResults.push({ person: person.name, ...r });
    await page.waitForTimeout(1200);
  }

  const afterContacts = await opening();

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
      text: (doc?.body.innerText || "").replace(/\s+/g, " ").slice(0, 260),
      hasStart: [...(doc?.querySelectorAll("button") ?? [])].some((b) => /开始我的人生/.test(b.textContent || "")),
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
    await page.waitForFunction((n) => document.querySelectorAll("#chat .mes").length > n + 1, before, { timeout: CONFIG.waitForReplyMs });
    generated = true;
  } catch {
    generated = false;
  }
  await page.waitForTimeout(2000);

  const reply = await page.evaluate(() => {
    const mes = [...document.querySelectorAll("#chat .mes")];
    const last = mes[mes.length - 1];
    return {
      mesCount: mes.length,
      lastIsUser: last?.getAttribute("is_user") === "true",
      lastLen: (last?.querySelector(".mes_text")?.innerText || "").length,
      lastHead: (last?.querySelector(".mes_text")?.innerText || "").replace(/\s+/g, " ").slice(0, 200),
      hasPhoneFrame: !!document.getElementById("cj-shenghao-phone-frame"),
    };
  });

  record("run-opening", !!started && (afterContacts.people === 2), { ...fill, tier, nextClicks, contactResults, afterContacts, preview, summary, generated, reply });
} catch (error) {
  record("run-opening", false, String(error).slice(0, 300));
}

// ---------- 7. 手机界面取证（rc.22 双轴 / 星级 / 私密卡） ----------
try {
  await page.waitForTimeout(2500);
  const phoneDoc = () => `document.getElementById("cj-shenghao-phone-frame")?.contentDocument`;

  const opened = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    if (!doc) return { error: "no phone frame" };
    const folded = doc.getElementById("folded");
    if (folded && folded.className.includes("folded")) folded.click();
    return { clickedLauncher: !!folded, hasPhone: !!doc.getElementById("phone") };
  });
  await page.waitForTimeout(2500);

  const sceneView = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    const list = [...(doc?.querySelectorAll("[data-expand]") ?? [])];
    const first = list[0];
    first?.click();
    return {
      expandable: list.length,
      text: (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 600),
    };
  });
  await page.waitForTimeout(900);
  const sceneExpanded = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    return (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 900);
  });
  record("phone-scene", sceneView.expandable > 0 && /好感/.test(sceneExpanded) && /堕落/.test(sceneExpanded), { ...sceneView, sceneExpanded });

  const womenView = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    doc?.querySelector('[data-tab="women"]')?.click();
    return true;
  });
  await page.waitForTimeout(900);
  const womenText = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    return (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 700);
  });
  record("phone-women", /称呼「陆总」/.test(womenText) && /❖/.test(womenText) && /好感满70或堕落满60/.test(womenText), { womenView, womenText });

  const target = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    const cards = [...(doc?.querySelectorAll("[data-detail]") ?? [])];
    const hit = cards.find((c) => (c.innerText || "").includes("林知夏")) ?? cards.at(-1);
    if (!hit) return { error: "no detail card" };
    const id = hit.getAttribute("data-detail");
    hit.click();
    return { id, name: (hit.innerText || "").replace(/\s+/g, " ").slice(0, 40) };
  });
  await page.waitForTimeout(900);
  const detailText = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    return (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 1400);
  });
  const beforeStar = detailText;
  const starred = await page.evaluate((id) => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    const btn = doc?.querySelector('[data-star="' + id + '"]');
    if (!btn) return { error: "no star button" };
    const before = btn.textContent.trim();
    btn.click();
    return { before, id };
  }, target.id);
  await page.waitForTimeout(1500);
  const afterStar = await page.evaluate((id) => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    const btn = doc?.querySelector('[data-star="' + id + '"]');
    return { text: btn?.textContent.trim() ?? null };
  }, target.id);
  record("phone-detail", !!target.id && /私密与亲密记录/.test(beforeStar) && /堕落度/.test(beforeStar) && !!starred.before && afterStar.text === "★ 已关注", { target, beforeStar: beforeStar.slice(0, 400), starred, afterStar });

  const offline = await page.evaluate((id) => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    doc?.querySelector('[data-act="back-women"]')?.click();
    doc?.querySelector('[data-tab="scene"]')?.click();
    return { id };
  }, target.id);
  await page.waitForTimeout(1500);
  const sceneAfterStar = await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    return (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 900);
  });
  record("phone-offscreen", /★ 特别关注 · 异地实况/.test(sceneAfterStar) && /林知夏/.test(sceneAfterStar), { offline, sceneAfterStar });

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
  record("phone-evidence", true, { shotPhone });
} catch (error) {
  record("phone-evidence", false, String(error).slice(0, 300));
}

// ---------- 收尾 ----------
const ok = steps.filter((s) => s.ok).length;
const failed = steps.filter((s) => !s.ok).map((s) => s.step);
console.log(
  JSON.stringify(
    { spaceId: task.spaceId, page: page.label, shotDir, summary: `${ok}/${steps.length} 步通过`, failed, steps, keptSpace: CONFIG.keepSpace },
    null,
    2,
  ),
);

if (!CONFIG.keepSpace) await task.finish({ keep: [] });
