// rc.24 实机验收：导入新卡 → 开局向导（含 c_goal）→ 开局 → 眼下心事渲染 → 一轮纯寒暄不发暴击 → 读原生变量
// 跑法：ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/live-test-rc24.mjs')"
// 前置：本机酒馆 http://127.0.0.1:8000/（Basic user/98）、ego lite、已配置可用的聊天补全 API。
// 注意：跑的时候不要动 ego 窗口，一碰控制权就判给用户，脚本会硬停。

const CONFIG = {
  stUrl: "http://127.0.0.1:8000/",
  basicUser: "user",
  basicPass: "98",
  cardPath: "E:/SHZDCHOSSS/dist/2.0.0-rc.24-checkpoint/神豪终端.json",
  playerName: "测试员",
  tierText: "小康人家",
  contacts: [
    {
      name: "苏晚", age: 26, job: "平面设计师", relation: "同事", affection: 40, corruption: 0, cup: "C", addressing: "陆总",
      tags: "安静、认真", appearance: "及肩短发，眼睛偏圆，笑起来有浅梨涡", body: "身形偏瘦，肩线干净",
      height: 168, weight: 50, bust: 86, waist: 62, hip: 89, shoe: 37, notes: "同一栋写字楼的设计师", present: true,
      goal: "月底前要交清母亲住院的八万手术尾款，她一直没跟同事开口",
    },
    {
      name: "林知夏", age: 28, job: "律所合伙人", relation: "甲乙方", affection: 30, corruption: 10, cup: "D", addressing: "北辰",
      tags: "冷静、强硬", appearance: "长发挽起，眼角微挑，戴细金框眼镜", body: "骨相清晰，腿长",
      height: 172, weight: 55, bust: 90, waist: 64, hip: 92, shoe: 38, notes: "合作过的律师，脾气不好但讲理", present: false,
      goal: "正被对方当事人施压要求撤下一桩证据，她硬扛着不肯松口",
    },
  ],
  casualLine: "早，路上堵得厉害吗？先坐，我顺路带了杯拿铁。",
  waitForReplyMs: 240000,
  keepSpace: true,
};

const fs = await import("node:fs/promises");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const shotDir = `C:/Users/Administrator/ego/live-test/rc24-${stamp}`;
await fs.mkdir(shotDir, { recursive: true });

const steps = [];
const record = (step, ok, detail) => {
  steps.push({ step, ok, detail });
  console.log(`[rc24] ${ok ? "OK  " : "FAIL"} ${step}${ok ? "" : ": " + JSON.stringify(detail).slice(0, 600)}`);
};

const task = await taskSpace("实机验收 神豪终端 rc.24 " + Date.now());
let page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
record("space", true, { spaceId: task.spaceId, page: page.label });

const injectAuth = async () => {
  const auth = "Basic " + Buffer.from(`${CONFIG.basicUser}:${CONFIG.basicPass}`, "utf8").toString("base64");
  await page.cdp("Network.enable", {});
  await page.cdp("Network.setExtraHTTPHeaders", { headers: { Authorization: auth } });
};

// SillyTavern 的确认按钮是 .popup-button-ok，不是 <button>
const dismissPopups = async (rounds = 8) => {
  const cleared = [];
  for (let i = 0; i < rounds; i += 1) {
    const hit = await page.evaluate(() => {
      const out = [];
      for (const popup of [...document.querySelectorAll(".popup")]) {
        const btn = popup.querySelector(".popup-button-ok") || popup.querySelector('[class*="popup-button"]');
        if (!btn || !(btn.offsetWidth || btn.offsetHeight)) continue;
        out.push((popup.innerText || "").replace(/\s+/g, " ").slice(0, 40));
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

// 读最新一层的原生 MVU 变量
const readState = () =>
  page.evaluate(() => {
    const chat = window.SillyTavern?.getContext?.()?.chat || [];
    let best = null;
    for (let i = chat.length - 1; i >= 0; i -= 1) {
      try {
        const v = window.Mvu?.getMvuData?.({ type: "message", message_id: i });
        if (v?.stat_data?.shenghao?.meta?.initialized) { best = v.stat_data.shenghao; break; }
      } catch {}
    }
    if (!best) return { mes: chat.length, initialized: false };
    const people = {};
    for (const [, c] of Object.entries(best.characters || {})) {
      people[c.name] = {
        id: c.id, affection: c.affection, corruption: c.corruption, currentGoal: c.currentGoal ?? null,
        cycle: c.physiology?.cycle, arousal: c.arousal, starred: c.starred, offscreen: c.offscreen,
      };
    }
    const rewards = Object.values(best.rewardEvents || {}).map((r) => ({
      type: r.eventType, amountCents: r.cashbackCents, label: r.label ?? null, mode: r.mode ?? null, score: r.score ?? null, title: r.title ?? null,
    }));
    const w = Object.values(best.withdrawals || {});
    return {
      mes: chat.length, initialized: true, revision: best.meta.revision, date: best.world?.date, time: best.world?.time,
      cash: best.user?.cashCents, tier: (() => { try { return JSON.parse(best._context || "{}").user?.wealthTier; } catch { return null; } })(),
      people, rewards, withdrawals: w.map((x) => ({ multiplier: x.multiplier, preCashCents: x.preCashCents, paidCents: x.paidCents })),
    };
  });

// ---------- 1. 打开酒馆 ----------
try {
  await injectAuth();
  await page.goto(CONFIG.stUrl, { timeout: 60000 });
  await page.waitForSelector("#send_form", { state: "visible", timeout: 45000 });
  record("open-st", true, { title: await page.title() });
} catch (error) {
  record("open-st", false, String(error).slice(0, 240));
}

// ---------- 2. 连接 API ----------
try {
  await injectAuth();
  await page.click("#API-status-top", { label: "open API drawer" }).catch(() => page.evaluate(() => document.querySelector("#API-status-top")?.click()));
  await page.waitForTimeout(1200);
  const clicked = await page.evaluate(() => {
    const pool = [...document.querySelectorAll("button, .menu_button, div, span")].filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
    const hit = pool.find((el) => (el.textContent || "").trim() === "连接");
    if (!hit) return null;
    hit.click();
    return true;
  });
  await page.waitForTimeout(5000);
  const cls = await page.evaluate(() => (document.querySelector("#API-status-top")?.className || "").slice(0, 90));
  record("connect-api", !!clicked && cls.includes("fa-plug") && !cls.includes("exclamation"), { clicked, cls });
} catch (error) {
  record("connect-api", false, String(error).slice(0, 240));
}

// ---------- 3. 导入整卡（按新增卡片识别） ----------
let chid = null;
try {
  await injectAuth();
  await page.click("#rightNavDrawerIcon", { label: "open character list" }).catch(() => {});
  await page.waitForSelector("#character_import_file", { state: "attached", timeout: 15000 });
  const beforeTitles = await page.evaluate(() => [...document.querySelectorAll("#rm_print_characters_block .character_select")].map((c) => c.querySelector(".avatar")?.getAttribute("title") || ""));
  await page.setInputFiles("#character_import_file", [CONFIG.cardPath]);
  await page.waitForTimeout(3500);
  const dialogs = [...(await dismissPopups()), ...(await dismissPopups())];
  const found = await page.evaluate((prev) => {
    const cards = [...document.querySelectorAll("#rm_print_characters_block .character_select")];
    const titles = cards.map((c) => c.querySelector(".avatar")?.getAttribute("title") || "");
    const fresh = [];
    cards.forEach((c, i) => { if (!prev.includes(titles[i])) fresh.push({ chid: c.getAttribute("data-chid"), title: titles[i] }); });
    return { total: cards.length, fresh, toasts: [...document.querySelectorAll(".toast, .toast-message")].map((t) => t.textContent.trim().slice(0, 60)).slice(0, 4) };
  }, beforeTitles);
  chid = found.fresh.at(-1)?.chid ?? null;
  record("import-card", !!chid, { ...found, dialogs });
} catch (error) {
  record("import-card", false, String(error).slice(0, 300));
}

// ---------- 4. 打开角色，等开局向导 ----------
try {
  const opened = await page.evaluate((id) => {
    const card = [...document.querySelectorAll("#rm_print_characters_block .character_select")].find((c) => c.getAttribute("data-chid") === id);
    if (!card) return null;
    (card.querySelector(".avatar") ?? card).click();
    return { chid: id, title: card.querySelector(".avatar")?.getAttribute("title") || "" };
  }, chid);
  await page.waitForTimeout(4500);
  let hasWizard = await page.evaluate(() => !!document.getElementById("TH-message--0--0")?.contentDocument?.getElementById("wizard"));
  let retried = false;
  if (!hasWizard) {
    await dismissPopups();
    await page.evaluate(() => window.SillyTavern?.getContext?.().reloadCurrentChat?.());
    await page.waitForTimeout(4000);
    hasWizard = await page.evaluate(() => !!document.getElementById("TH-message--0--0")?.contentDocument?.getElementById("wizard"));
    retried = true;
  }
  record("open-character", !!opened && hasWizard, { opened, hasWizard, retried });
} catch (error) {
  record("open-character", false, String(error).slice(0, 300));
}

// ---------- 5. 开局向导：姓名 + 档位 + 两位带眼下心事的熟人 ----------
try {
  const filled = await page.evaluate((name) => {
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
    return { name: setVal(doc.getElementById("f_name"), name), goalFieldExists: !!doc.getElementById("f_c_goal") };
  }, CONFIG.playerName);
  await page.waitForTimeout(500);

  await page.evaluate((t) => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    [...(doc?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").includes(t))?.click();
  }, CONFIG.tierText);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    for (let i = 0; i < 4; i += 1) {
      const next = [...(doc?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").trim() === "下一步");
      if (!next) break;
      next.click();
    }
  });
  await page.waitForTimeout(1200);

  const contactResults = [];
  for (const person of CONFIG.contacts) {
    const r = await page.evaluate((p) => {
      const doc = document.getElementById("TH-message--0--0")?.contentDocument;
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
        c_goal: p.goal,
      };
      const missing = [];
      for (const [k, v] of Object.entries(values)) {
        const el = doc.getElementById("f_" + k);
        if (!el) missing.push(k);
        else setVal(el, v);
      }
      const present = doc.getElementById("c_present");
      if (present) present.checked = p.present === true;
      const save = [...modal.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "添加");
      if (!save) return { error: "no save button", missing };
      save.click();
      return { saved: true, missing, goalValue: doc.getElementById("f_c_goal")?.value ?? null };
    }, person);
    contactResults.push({ name: person.name, ...r });
    await page.waitForTimeout(1200);
  }

  const people = await page.evaluate(() => document.getElementById("TH-message--0--0")?.contentDocument?.querySelectorAll(".person-preview").length ?? 0);
  await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    [...(doc?.querySelectorAll("button") ?? [])].find((b) => /预览开局/.test(b.textContent || ""))?.click();
  });
  await page.waitForTimeout(1800);
  const summaryText = await page.evaluate(() => (document.getElementById("TH-message--0--0")?.contentDocument?.body.innerText || "").replace(/\s+/g, " ").slice(0, 200));

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
  const opening = await readState();
  record("run-opening", started && generated && people === 2 && opening.initialized === true, { filled, people, contactResults, summaryText, generated, opening });
} catch (error) {
  record("run-opening", false, String(error).slice(0, 400));
}

// ---------- 6. currentGoal 落盘 + 手机渲染 ----------
try {
  const opening = await readState();
  const goals = Object.fromEntries(Object.entries(opening.people || {}).map(([k, v]) => [k, v.currentGoal]));
  const goalsSaved = CONFIG.contacts.every((p) => (goals[p.name] || "").includes(p.goal.slice(0, 8)));

  const phone = () =>
    page.evaluate(() => {
      const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
      return { hasPhone: !!doc?.getElementById("phone"), text: (doc?.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ") };
    });
  await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    const folded = doc?.getElementById("folded");
    if (folded && folded.className.includes("folded")) folded.click();
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    doc?.querySelector('[data-tab="scene"]')?.click();
    const first = doc?.querySelector("[data-expand]");
    first?.click();
  });
  await page.waitForTimeout(1200);
  const sceneText = (await phone()).text;

  await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    doc?.querySelector('[data-tab="women"]')?.click();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
    const hit = doc?.querySelector("[data-detail]");
    hit?.click();
  });
  await page.waitForTimeout(1000);
  const detailText = (await phone()).text;

  await page.screenshot({ path: `${shotDir}/detail.png` }).catch(() => null);
  record("current-goal", goalsSaved && /🎯 眼下心事/.test(sceneText) && /🎯 眼下心事/.test(detailText), {
    goals, goalsSaved,
    sceneHasGoal: (sceneText.match(/🎯 眼下心事[^。]{0,40}/g) || []).slice(0, 2),
    detailHasGoal: (detailText.match(/🎯 眼下心事[^。]{0,40}/g) || []).slice(0, 2),
    shotDir,
  });
} catch (error) {
  record("current-goal", false, String(error).slice(0, 400));
}

// ---------- 7. 纯寒暄一轮：不应产生暴击 ----------
try {
  const before = await readState();
  await page.evaluate((line) => {
    const ta = document.getElementById("send_textarea");
    const proto = window.HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(ta, line);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("send_but")?.click();
  }, CONFIG.casualLine);
  const mesBefore = before.mes;
  let replied = false;
  try {
    await page.waitForFunction((n) => document.querySelectorAll("#chat .mes").length > n + 1, mesBefore, { timeout: CONFIG.waitForReplyMs });
    replied = true;
  } catch {}
  await page.waitForTimeout(6000);
  const after = await readState();
  const newRewards = (after.rewards || []).slice((before.rewards || []).length);
  const casualClean = replied && newRewards.length === 0;
  record("casual-no-crit", casualClean, {
    replied, beforeRewards: before.rewards, afterRewards: after.rewards, newRewards,
    lastReply: await page.evaluate(() => {
      const mes = [...document.querySelectorAll("#chat .mes")];
      const last = mes.at(-1);
      return {
        isUser: last?.getAttribute("is_user") === "true",
        text: (last?.querySelector(".mes_text")?.innerText || "").replace(/\s+/g, " ").slice(0, 300),
      };
    }),
    shotDir,
  });
} catch (error) {
  record("casual-no-crit", false, String(error).slice(0, 400));
}

const ok = steps.filter((s) => s.ok).length;
console.log(JSON.stringify({ spaceId: task.spaceId, shotDir, summary: `${ok}/${steps.length} 步通过`, failed: steps.filter((s) => !s.ok).map((s) => s.step), steps }, null, 2));
if (!CONFIG.keepSpace) await task.finish({ keep: [] });
