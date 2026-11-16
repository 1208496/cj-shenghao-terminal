// rc.23 干净聊天实机验收：走开局向导 → 开局 → 读变量
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/live-test-rc23.mjs')"
const CONFIG = {
  spaceId: 3,
  playerName: "测试员",
  tierText: "小康人家",
  waitForReplyMs: 240000,
  contacts: [
    { name: "苏晚", age: 26, job: "平面设计师", relation: "同事", affection: 40, corruption: 0, cup: "C", addressing: "陆总", tags: "安静、认真", appearance: "及肩短发，眼睛偏圆，笑起来有浅梨涡", body: "身形偏瘦，肩线干净", height: 168, weight: 50, bust: 86, waist: 62, hip: 89, shoe: 37, notes: "同一栋写字楼的设计师", present: true },
    { name: "林知夏", age: 28, job: "律所合伙人", relation: "甲乙方", affection: 30, corruption: 10, cup: "D", addressing: "北辰", tags: "冷静、强硬", appearance: "长发挽起，眼角微挑，戴细金框眼镜", body: "骨相清晰，腿长", height: 172, weight: 55, bust: 90, waist: 64, hip: 92, shoe: 38, notes: "合作过的律师，脾气不好但讲理", present: false },
  ],
};
const steps = [];
const record = (step, ok, detail) => {
  steps.push({ step, ok, detail });
  console.log(`[rc23] ${ok ? "OK  " : "FAIL"} ${step}${ok ? "" : ": " + JSON.stringify(detail).slice(0, 500)}`);
};

const task = await taskSpace(CONFIG.spaceId);
const page = (await task.pages())[0];
const auth = "Basic " + Buffer.from("user:98", "utf8").toString("base64");
await page.cdp("Network.enable", {});
await page.cdp("Network.setExtraHTTPHeaders", { headers: { Authorization: auth } });

const state = () =>
  page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    return {
      mes: document.querySelectorAll("#chat .mes").length,
      wizard: !!doc?.getElementById("wizard"),
      people: doc?.querySelectorAll(".person-preview").length ?? 0,
      api: (document.querySelector("#API-status-top")?.className || "").includes("fa-plug"),
      mvu: !!window.Mvu,
      host: !!window.__CJ_SHENGHAO_V2__,
      schema: !!window.__CJ_SHENGHAO_SCHEMA__,
    };
  });

record("precheck", (await state()).wizard, await state());

// ---- 1. 姓名 + 档位 ----
const fill = await page.evaluate((name) => {
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

const tier = await page.evaluate((t) => {
  const doc = document.getElementById("TH-message--0--0").contentDocument;
  const btn = [...doc.querySelectorAll("button")].find((b) => (b.textContent || "").includes(t));
  btn?.click();
  return !!btn;
}, CONFIG.tierText);
await page.waitForTimeout(800);

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

// ---- 2. 两位初始熟人 ----
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
    const fieldIds = [...modal.querySelectorAll("input,textarea")].map((e) => e.id || e.dataset.field);
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
    for (const [k, v] of Object.entries(values)) {
      const el = doc.getElementById("f_" + k);
      if (!el) missing.push(k);
      else setVal(el, v);
    }
    const present = doc.getElementById("c_present");
    if (present) present.checked = p.present === true;
    const hasCup = !!doc.getElementById("f_c_cupSize");
    const hasCorruption = !!doc.getElementById("f_c_corruption");
    const save = [...modal.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "添加");
    if (!save) return { error: "no save", missing, fieldIds };
    save.click();
    return { saved: true, missing, hasCup, hasCorruption, fieldIds };
  }, person);
  contactResults.push({ name: person.name, ...r });
  await page.waitForTimeout(1300);
}
const afterContacts = await state();
record("contacts", contactResults.every((r) => r.saved) && afterContacts.people === 2, { contactResults, afterContacts });

// ---- 3. 预览 + 开始 ----
const preview = await page.evaluate(() => {
  const doc = document.getElementById("TH-message--0--0").contentDocument;
  const btn = [...doc.querySelectorAll("button")].find((b) => /预览开局/.test(b.textContent || ""));
  btn?.click();
  return !!btn;
});
await page.waitForTimeout(1800);

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
} catch {}
await page.waitForTimeout(6000);

const vars = await page.evaluate(() => {
  const n = (window.SillyTavern?.getContext?.()?.chat || []).length;
  let best = null;
  for (let i = n - 1; i >= 0; i -= 1) {
    try {
      const v = window.Mvu?.getMvuData?.({ type: "message", message_id: i });
      if (v?.stat_data?.shenghao?.meta?.initialized) { best = v.stat_data.shenghao; break; }
    } catch {}
  }
  const people = {};
  for (const [, v] of Object.entries(best?.characters || {})) {
    people[v.name] = {
      id: v.id, aff: v.affection, cor: v.corruption, cycle: v.physiology?.cycle,
      virgin: v.physiology?.virgin, tags: v.intimacy?.unlockedTags, starred: v.starred, offs: v.offscreen,
    };
  }
  return { mes: n, rev: best?.meta?.revision ?? null, people, starredOffscreenIds: (() => { try { return JSON.parse(best?._context || "{}").starredOffscreenIds; } catch { return null; } })() };
});
record("opening", started && generated, { fill, tier, nextClicks, preview, started, generated, vars });
console.log(JSON.stringify({ summary: `${steps.filter((s) => s.ok).length}/${steps.length}`, steps, vars }, null, 2));
