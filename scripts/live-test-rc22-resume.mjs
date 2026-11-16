// rc.22 实机续跑：接管已有空间，从开局向导一路测到手机界面断言。
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/live-test-rc22-resume.mjs')"
const CONFIG = {
  spaceId: 2,
  playerName: "测试员",
  tierText: "小康人家",
  waitForReplyMs: 180000,
  contacts: [
    { name: "苏晚", age: 26, job: "平面设计师", relation: "同事", affection: 40, corruption: 0, cup: "C", addressing: "陆总", tags: "安静、认真", appearance: "及肩短发，眼睛偏圆，笑起来有浅梨涡", body: "身形偏瘦，肩线干净", height: 168, weight: 50, bust: 86, waist: 62, hip: 89, shoe: 37, notes: "同一栋写字楼的设计师", present: true },
    { name: "林知夏", age: 28, job: "律所合伙人", relation: "甲乙方", affection: 30, corruption: 10, cup: "D", addressing: "北辰", tags: "冷静、强硬", appearance: "长发挽起，眼角微挑，戴细金框眼镜", body: "骨相清晰，腿长", height: 172, weight: 55, bust: 90, waist: 64, hip: 92, shoe: 38, notes: "合作过的律师，脾气不好但讲理", present: false },
  ],
};
const fs = await import("node:fs/promises");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const shotDir = `C:/Users/Administrator/ego/live-test/${stamp}-rc22`;
await fs.mkdir(shotDir, { recursive: true });
const steps = [];
const record = (step, ok, detail) => {
  steps.push({ step, ok, detail });
  console.log(`[live-test] ${ok ? "OK  " : "FAIL"} ${step}${ok ? "" : ": " + JSON.stringify(detail).slice(0, 400)}`);
};

const task = await takeOverTaskSpace(CONFIG.spaceId);
const page = (await task.pages())[0];
record("space", true, { spaceId: task.spaceId });

const dropPopups = async () => {
  const cleared = [];
  for (let i = 0; i < 5; i += 1) {
    const hit = await page.evaluate(() => {
      const out = [];
      for (const popup of [...document.querySelectorAll(".popup")]) {
        const btn = popup.querySelector(".popup-button-ok") || popup.querySelector('[class*="popup-button"]');
        if (!btn || !(btn.offsetWidth || btn.offsetHeight)) continue;
        out.push((btn.textContent || "").trim());
        btn.click();
      }
      return out;
    });
    if (!hit.length) break;
    cleared.push(...hit);
    await page.waitForTimeout(1500);
  }
  return cleared;
};

// API 连接状态（刷新后可能需要重连）
const apiState = await page.evaluate(() => (document.querySelector("#API-status-top")?.className || "").slice(0, 80));
if (!(apiState.includes("fa-plug") && !apiState.includes("exclamation"))) {
  try {
    await page.evaluate(() => document.querySelector("#API-status-top")?.click());
    await page.waitForTimeout(1200);
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "连接" && (b.offsetWidth || b.offsetHeight));
      btn?.click();
      return !!btn;
    });
    await page.waitForTimeout(5000);
    record("reconnect-api", clicked, { clicked });
  } catch (e) {
    record("reconnect-api", false, String(e).slice(0, 200));
  }
} else {
  record("reconnect-api", true, { already: apiState });
}

const wizardState = () =>
  page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    return {
      hasWizard: !!doc?.getElementById("wizard"),
      people: doc?.querySelectorAll(".person-preview").length ?? 0,
      buttons: [...(doc?.querySelectorAll("button") ?? [])].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 30),
      text: (doc?.body?.innerText || "").replace(/\s+/g, " ").slice(0, 200),
    };
  });

let ws = await wizardState();
if (!ws.hasWizard) {
  const dialogs = await dropPopups();
  await page.evaluate(() => window.SillyTavern?.getContext?.().reloadCurrentChat?.());
  await page.waitForTimeout(4000);
  ws = { ...(await wizardState()), dialogs };
}
record("wizard-ready", ws.hasWizard, ws);
if (!ws.hasWizard) {
  console.log(JSON.stringify({ shotDir, summary: `${steps.filter((s) => s.ok).length}/${steps.length}`, steps }, null, 2));
  throw new Error("wizard not rendered");
}

// ---- 开局向导 ----
const filled = await page.evaluate((name) => {
  const doc = document.getElementById("TH-message--0--0").contentDocument;
  const win = doc.defaultView;
  const setVal = (el, v) => {
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
    el.dispatchEvent(new win.Event("change", { bubbles: true }));
    return true;
  };
  const ok = setVal(doc.getElementById("f_name"), name);
  return { ok, value: doc.getElementById("f_name")?.value ?? null };
}, CONFIG.playerName);
await page.waitForTimeout(400);

const tier = await page.evaluate((tierText) => {
  const doc = document.getElementById("TH-message--0--0").contentDocument;
  const btn = [...doc.querySelectorAll("button")].find((b) => (b.textContent || "").includes(tierText));
  btn?.click();
  return !!btn;
}, CONFIG.tierText);
await page.waitForTimeout(700);

const nextClicks = await page.evaluate(() => {
  const doc = document.getElementById("TH-message--0--0").contentDocument;
  let n = 0;
  for (let i = 0; i < 4; i += 1) {
    const next = [...doc.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "下一步");
    if (!next) break;
    next.click();
    n += 1;
  }
  return n;
});
await page.waitForTimeout(1200);

const contactResults = [];
for (const person of CONFIG.contacts) {
  const r = await page.evaluate((p) => {
    const doc = document.getElementById("TH-message--0--0").contentDocument;
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
    const hasCup = !!doc.getElementById("f_c_cupSize");
    const hasCorruption = !!doc.getElementById("f_c_corruption");
    const save = [...modal.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "添加");
    if (!save) return { error: "no save button", missing };
    save.click();
    return { saved: true, missing, hasCup, hasCorruption };
  }, person);
  contactResults.push({ name: person.name, ...r });
  await page.waitForTimeout(1300);
}
record("add-contacts", contactResults.every((r) => r.saved) && contactResults.every((r) => r.hasCup && r.hasCorruption), contactResults);

const afterContacts = await wizardState();
record("contacts-listed", afterContacts.people === 2, afterContacts);

const preview = await page.evaluate(() => {
  const doc = document.getElementById("TH-message--0--0").contentDocument;
  const btn = [...doc.querySelectorAll("button")].find((b) => /预览开局/.test(b.textContent || ""));
  btn?.click();
  return !!btn;
});
await page.waitForTimeout(1800);

const summaryText = await page.evaluate(() => {
  const doc = document.getElementById("TH-message--0--0").contentDocument;
  return {
    text: (doc.body.innerText || "").replace(/\s+/g, " ").slice(0, 300),
    hasStart: [...doc.querySelectorAll("button")].some((b) => /开始我的人生/.test(b.textContent || "")),
  };
});

const before = await page.evaluate(() => document.querySelectorAll("#chat .mes").length);
const started = await page.evaluate(() => {
  const doc = document.getElementById("TH-message--0--0")?.contentDocument;
  const btn = [...(doc?.querySelectorAll("button") ?? [])].find((b) => /开始我的人生/.test(b.textContent || ""));
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
await page.waitForTimeout(3000);
const reply = await page.evaluate(() => {
  const mes = [...document.querySelectorAll("#chat .mes")];
  const last = mes.at(-1);
  return { mesCount: mes.length, lastIsUser: last?.getAttribute("is_user") === "true", lastLen: (last?.querySelector(".mes_text")?.innerText || "").length, lastHead: (last?.querySelector(".mes_text")?.innerText || "").replace(/\s+/g, " ").slice(0, 200) };
});
record("run-opening", started && generated, { filled, tier, nextClicks, preview, summaryText, started, generated, reply });

// ---- 手机界面 ----
await page.waitForTimeout(2500);
const open = await page.evaluate(() => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  const folded = doc?.getElementById("folded");
  if (folded && (folded.className || "").includes("folded")) folded.click();
  return { hasFold: !!folded, appEmpty: !(doc?.getElementById("app")?.innerHTML || "").length };
});
await page.waitForTimeout(2500);

const scene = await page.evaluate(() => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  const cards = [...(doc?.querySelectorAll("[data-expand]") ?? [])];
  cards[0]?.click();
  return { expandable: cards.length, text: (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 500) };
});
await page.waitForTimeout(1000);
const sceneExpanded = await page.evaluate(() => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  return (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 1200);
});
record("phone-scene", /♥ 好感/.test(sceneExpanded) && /❖ 堕落/.test(sceneExpanded), { open, scene, sceneExpanded });

const women = await page.evaluate(() => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  doc?.querySelector('[data-tab="women"]')?.click();
  return true;
});
await page.waitForTimeout(900);
const womenText = await page.evaluate(() => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  return (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 800);
});
record("phone-women", /称呼「陆总」/.test(womenText) && /好感满70或堕落满60/.test(womenText), { women, womenText });

const target = await page.evaluate(() => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  const cards = [...(doc?.querySelectorAll("[data-detail]") ?? [])];
  const hit = cards.find((c) => (c.innerText || "").includes("林知夏")) ?? cards.at(-1);
  if (!hit) return { error: "no detail card" };
  const id = hit.getAttribute("data-detail");
  hit.click();
  return { id, name: (hit.innerText || "").replace(/\s+/g, " ").slice(0, 40) };
});
await page.waitForTimeout(1000);
const detailText = await page.evaluate(() => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  return (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 1600);
});
const star = await page.evaluate((id) => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  const btn = doc?.querySelector('[data-star="' + id + '"]');
  if (!btn) return { error: "no star" };
  const before = btn.textContent.trim();
  btn.click();
  return { before, id };
}, target.id);
await page.waitForTimeout(1600);
const afterStar = await page.evaluate((id) => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  return { text: doc?.querySelector('[data-star="' + id + '"]')?.textContent.trim() ?? null };
}, target.id);
record("phone-detail", !!target.id && /私密与亲密记录/.test(detailText) && /堕落度/.test(detailText) && afterStar.text === "★ 已关注", { target, detailText: detailText.slice(0, 600), star, afterStar });

await page.evaluate(() => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  doc?.querySelector('[data-act="back-women"]')?.click();
  doc?.querySelector('[data-tab="scene"]')?.click();
});
await page.waitForTimeout(1500);
const sceneAfterStar = await page.evaluate(() => {
  const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
  return (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 1000);
});
record("phone-offscreen", /★ 特别关注 · 异地实况/.test(sceneAfterStar) && /林知夏/.test(sceneAfterStar), { sceneAfterStar });

await page.evaluate(() => {
  const f = document.getElementById("cj-shenghao-phone-frame");
  if (!f) return;
  window.__livePhoneBackup = f.getAttribute("style") || "";
  f.style.setProperty("position", "fixed", "important");
  f.style.setProperty("left", "18px", "important");
  f.style.setProperty("top", "64px", "important");
  f.style.setProperty("right", "auto", "important");
  f.style.setProperty("z-index", "2147483000", "important");
  f.style.setProperty("transform", "none", "important");
});
await page.waitForTimeout(900);
const phoneShot = `${shotDir}/phone.png`;
await page.screenshot({ path: phoneShot }).catch(() => null);
await page.evaluate(() => {
  const f = document.getElementById("cj-shenghao-phone-frame");
  if (f) { f.setAttribute("style", window.__livePhoneBackup || ""); delete window.__livePhoneBackup; }
});
const chatShot = `${shotDir}/chat.png`;
await page.screenshot({ path: chatShot }).catch(() => null);
record("screenshots", true, { phoneShot, chatShot });

console.log(JSON.stringify({ spaceId: task.spaceId, shotDir, summary: `${steps.filter((s) => s.ok).length}/${steps.length} 步通过`, failed: steps.filter((s) => !s.ok).map((s) => s.step), steps }, null, 2));
