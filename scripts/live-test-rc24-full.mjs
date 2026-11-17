// rc.24 全链路实机测试 v2：
//   导入（本地 MVU 镜像卡）→ 等 MVU 就绪 → 开局（富家公子哥 + 手动熟人）→ 四宫格/我的页
//   → 寒暄不发奖 → 涩涩 INTIMATE → 收入 → 买房 → 提现倍率
// 跑法：见 .work/run-rc24-full.cmd；进度同步写到 .work/rc24-full.progress.log。
// 说明：这是本机酒馆的测试聊天，允许模型生成成人向剧情。

const CONFIG = {
  stUrl: "http://127.0.0.1:8000/",
  basicUser: "user",
  basicPass: "98",
  cardPath: "E:/SHZDCHOSSS/.work/test-card/神豪终端-localmvu.json",
  playerName: "测试员",
  presetText: "富家公子哥",
  manualContact: {
    name: "苏晚", age: 26, job: "平面设计师", relation: "同事", affection: 85, corruption: 20,
    cup: "C", addressing: "陆总", tags: "安静、认真", appearance: "及肩短发，眼睛偏圆，笑起来有浅梨涡",
    body: "身形偏瘦，肩线干净", height: 168, weight: 50, bust: 86, waist: 62, hip: 89, shoe: 37,
    notes: "同一栋写字楼的设计师", goal: "月底前要交清母亲住院的八万手术尾款，她一直没跟同事开口", present: true,
  },
  casualLine: "早，路上堵得厉害吗？先坐，我顺路带了杯拿铁。",
  spicyLine: "我把她抵在落地窗前吻了上去，手顺着她的腰探进裙摆，低声说今晚哪儿也不许去。",
  incomeLine: "我刚把手上一幅画卖给画廊，对方全款转账一千五百万，钱已经到账。",
  purchaseLine: "我刷卡一千二百万，全款买下云玺湾1801大平层，产权登记在我名下。",
  waitForReplyMs: 300000,
  keepSpace: true,
};

const fs = await import("node:fs/promises");
const fss = await import("node:fs");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const shotDir = `C:/Users/Administrator/ego/live-test/rc24-full-${stamp}`;
const progressFile = "E:/SHZDCHOSSS/.work/rc24-full.progress.log";
await fs.mkdir(shotDir, { recursive: true });
fss.writeFileSync(progressFile, `# run ${stamp}\n`, "utf8");

const steps = [];
const log = (line) => { try { fss.appendFileSync(progressFile, line + "\n", "utf8"); } catch {} console.log(line); };
const record = (step, ok, detail) => {
  steps.push({ step, ok, detail });
  log(`[rc24full] ${ok ? "OK  " : "FAIL"} ${step}` + (ok ? "" : ": " + JSON.stringify(detail).slice(0, 900)));
};

const task = await taskSpace("实机全链路 神豪终端 rc.24 " + Date.now());
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
record("space", true, { spaceId: task.spaceId });
log(`[rc24full] shots=${shotDir}`);

const injectAuth = async () => {
  const auth = "Basic " + Buffer.from(`${CONFIG.basicUser}:${CONFIG.basicPass}`, "utf8").toString("base64");
  await page.cdp("Network.enable", {});
  await page.cdp("Network.setExtraHTTPHeaders", { headers: { Authorization: auth } });
};

const dismissPopups = async (rounds = 15) => {
  const cleared = [];
  for (let i = 0; i < rounds; i += 1) {
    const hit = await page.evaluate(() => {
      const out = [];
      const visible = (el) => !!(el.offsetWidth || el.offsetHeight);
      const isOk = (t) => /^(确认|确定|是|OK|全部导入|启用|继续)$/i.test(t);
      const click = (el, label) => { try { el.click(); out.push(label); } catch {} };
      for (const popup of [...document.querySelectorAll(".popup, .dialog, [role='dialog']")]) {
        const leaves = [...popup.querySelectorAll("button, div, span, a")].filter((el) => el.children.length === 0 && visible(el));
        const ok = leaves.find((el) => isOk((el.textContent || "").trim()));
        if (ok) click(ok, ((popup.innerText || "").replace(/\s+/g, " ").slice(0, 26)) + " → " + (ok.textContent || "").trim());
      }
      return out;
    });
    if (!hit.length) break;
    cleared.push(...hit);
    await page.waitForTimeout(1300);
  }
  return cleared;
};
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
        cycle: c.physiology?.cycle, arousal: c.arousal, virgin: c.physiology?.virgin,
        hymenNote: c.physiology?.hymenNote, vaginaState: c.physiology?.vaginaState,
        abilityComment: c.intimacy?.abilityComment, tags: c.intimacy?.unlockedTags,
        outfitTop: c.outfit?.top, outfitSocks: c.outfit?.socks, complexion: c.outfit?.complexion,
        scaleLevel: c.limits?.scaleLevel, limits: c.limits,
      };
    }
    const rewards = Object.values(best.rewardEvents || {}).map((r) => ({
      amountCents: r.cashbackCents, label: r.label ?? null, mode: r.mode ?? null, score: r.score ?? null, title: r.title ?? null,
    }));
    const assets = Object.values(best.finance?.assets || {}).filter((a) => a.ownerId === "USER" && a.status === "OWNED")
      .map((a) => ({ assetId: a.assetId, name: a.name, kind: a.kind, basisCents: a.basisCents, initial: a.acquisitionIsInitial }));
    return {
      mes: chat.length, initialized: true, revision: best.meta.revision, date: best.world?.date, time: best.world?.time,
      cash: best.user?.cashCents, prowess: best.user?.prowessScore, genitals: best.user?.genitals,
      people, rewards, assets,
      withdrawals: Object.values(best.withdrawals || {}).map((w) => ({ multiplier: w.multiplier, preCashCents: w.preCashCents, paidCents: w.paidCents, tierLabel: w.tierLabel })),
      tier: (() => { try { return JSON.parse(best._context || "{}").user?.wealthTier; } catch { return null; } })(),
    };
  });

const sendLine = async (line) => {
  const before = await page.evaluate(() => document.querySelectorAll("#chat .mes").length);
  await page.evaluate((text) => {
    const ta = document.getElementById("send_textarea");
    const proto = window.HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(ta, text);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("send_but")?.click();
  }, line);
  let replied = false;
  try {
    await page.waitForFunction((n) => document.querySelectorAll("#chat .mes").length > n + 1, before, { timeout: CONFIG.waitForReplyMs });
    replied = true;
  } catch {}
  await page.waitForTimeout(7000);
  return replied;
};

const withPhone = (fn, arg) =>
  page.evaluate(
    ({ body, arg }) => {
      const doc = document.getElementById("cj-shenghao-phone-frame")?.contentDocument;
      if (!doc) return { error: "no phone frame" };
      const run = new Function("doc", "arg", "return (" + body + ")(doc, arg);");
      return run(doc, arg);
    },
    { body: fn.toString(), arg },
  );

const openPhone = async () => {
  await withPhone((doc) => {
    const folded = doc.getElementById("folded");
    if (folded && folded.className.includes("folded")) folded.click();
    return { opened: !!folded };
  });
  await page.waitForTimeout(2200);
};

const goTab = async (tab) => {
  await withPhone((doc, t) => { doc.querySelector(`[data-tab="${t}"]`)?.click(); return t; }, tab);
  await page.waitForTimeout(900);
};

// ---------- 1. 打开酒馆 / 连 API ----------
try {
  await injectAuth();
  await page.goto(CONFIG.stUrl, { timeout: 60000 });
  await page.waitForSelector("#send_form", { state: "visible", timeout: 45000 });
  record("open-st", true, { title: await page.title() });
} catch (error) { record("open-st", false, String(error).slice(0, 240)); }

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
} catch (error) { record("connect-api", false, String(error).slice(0, 240)); }

// ---------- 2. 导入整卡 ----------
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
    cards.forEach((c, i) => { if (!prev.includes(titles[i]) && titles[i].includes("神豪终端")) fresh.push({ chid: c.getAttribute("data-chid"), title: titles[i] }); });
    return { total: cards.length, fresh };
  }, beforeTitles);
  chid = found.fresh.at(-1)?.chid ?? null;
  record("import-card", !!chid, { ...found, dialogs });
} catch (error) { record("import-card", false, String(error).slice(0, 300)); }

// ---------- 3. 打开角色 ----------
try {
  const opened = await page.evaluate((id) => {
    const card = [...document.querySelectorAll("#rm_print_characters_block .character_select")].find((c) => c.getAttribute("data-chid") === id);
    if (!card) return null;
    (card.querySelector(".avatar") ?? card).click();
    return { chid: id };
  }, chid);
  await page.waitForTimeout(3500);
  const openDialogs = await dismissPopups();
  await page.waitForTimeout(1500);
  let hasWizard = await page.evaluate(() => !!document.getElementById("TH-message--0--0")?.contentDocument?.getElementById("wizard"));
  if (!hasWizard) {
    await dismissPopups();
    await page.evaluate(() => window.SillyTavern?.getContext?.().reloadCurrentChat?.());
    await page.waitForTimeout(4000);
    hasWizard = await page.evaluate(() => !!document.getElementById("TH-message--0--0")?.contentDocument?.getElementById("wizard"));
  }
  record("open-character", !!opened && hasWizard, { opened, hasWizard, openDialogs });
} catch (error) { record("open-character", false, String(error).slice(0, 300)); }

// ---------- 4. 等 MVU 就绪 ----------
try {
  let ready = false, info = null;
  for (let i = 0; i < 45; i += 1) {
    if (i % 2 === 0) await dismissPopups(3);
    info = await page.evaluate(() => {
      const doc = document.getElementById("TH-message--0--0")?.contentDocument;
      if (!doc) return { doc: false, mvu: typeof window.Mvu };
      const next = [...doc.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "下一步");
      return {
        doc: true, mvu: typeof window.Mvu, schema: !!window.__CJ_SHENGHAO_SCHEMA__,
        nextDisabled: next?.disabled ?? null,
        status: (doc.body.innerText || "").replace(/\s+/g, " ").slice(0, 120),
      };
    });
    if (info?.doc && info.nextDisabled === false) { ready = true; break; }
    await page.waitForTimeout(2000);
  }
  record("wizard-ready", ready, info);
} catch (error) { record("wizard-ready", false, String(error).slice(0, 300)); }

// ---------- 5. 开局：姓名 / 性能力 / 富家公子哥 / 手动熟人 ----------
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
    const nameOk = setVal(doc.getElementById("f_name"), name);
    const prowessEl = doc.getElementById("prowessNumber");
    if (prowessEl) {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value").set.call(prowessEl, "90");
      prowessEl.dispatchEvent(new win.Event("input", { bubbles: true }));
      prowessEl.dispatchEvent(new win.Event("change", { bubbles: true }));
    }
    return { name: nameOk, prowessField: !!prowessEl, prowessHind: doc.getElementById("prowessHint")?.textContent ?? null, genitalsField: !!doc.getElementById("f__gen_length") };
  }, CONFIG.playerName);
  await page.waitForTimeout(600);

  const presetClicked = await page.evaluate((t) => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const btn = [...(doc?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").includes(t));
    btn?.click();
    return !!btn;
  }, CONFIG.presetText);
  await page.waitForTimeout(1600);

  // step0 → step1 → step2（熟人页）
  for (let i = 0; i < 2; i += 1) {
    await page.evaluate(() => {
      const doc = document.getElementById("TH-message--0--0")?.contentDocument;
      const next = [...(doc?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").trim() === "下一步");
      next?.click();
      return !!next;
    });
    await page.waitForTimeout(1000);
  }
  const stepLabel = await page.evaluate(() => (document.getElementById("TH-message--0--0")?.contentDocument?.body.innerText || "").replace(/\s+/g, " ").slice(0, 90));

  const manual = await page.evaluate((p) => {
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
      c_name: p.name, c_age: String(p.age), c_relation: p.relation, c_aff: String(p.affection), c_corruption: String(p.corruption),
      c_beauty: "80", c_job: p.job, c_cupSize: p.cup, c_addressing: p.addressing, c_personalityTags: p.tags,
      c_appearance: p.appearance, c_body: p.body, c_heightCm: String(p.height), c_weightKg: String(p.weight),
      c_bustCm: String(p.bust), c_waistCm: String(p.waist), c_hipCm: String(p.hip), c_shoeSizeEu: String(p.shoe),
      c_notes: p.notes, c_goal: p.goal,
    };
    const missing = [];
    for (const [k, v] of Object.entries(values)) {
      const el = doc.getElementById("f_" + k);
      if (!el) missing.push(k); else setVal(el, v);
    }
    const present = doc.getElementById("c_present");
    if (present) present.checked = p.present;
    const goalValue = doc.getElementById("f_c_goal")?.value ?? null;
    const save = [...modal.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "添加");
    if (!save) return { error: "no save", missing };
    save.click();
    return { saved: true, missing, goalValue };
  }, CONFIG.manualContact);
  await page.waitForTimeout(1500);

  const people = await page.evaluate(() => document.getElementById("TH-message--0--0")?.contentDocument?.querySelectorAll(".person-preview").length ?? 0);

  const preview = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const btn = [...(doc?.querySelectorAll("button") ?? [])].find((b) => /预览开局/.test(b.textContent || ""));
    btn?.click();
    return !!btn;
  });
  await page.waitForTimeout(2000);
  const previewText = await page.evaluate(() => (document.getElementById("TH-message--0--0")?.contentDocument?.body.innerText || "").replace(/\s+/g, " ").slice(0, 240));

  const startState = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const btn = [...(doc?.querySelectorAll("button") ?? [])].find((b) => /开始我的人生/.test(b.textContent || ""));
    return { exists: !!btn, disabled: btn?.disabled ?? null };
  });
  const diag = await page.evaluate(() => {
    const doc = document.getElementById("TH-message--0--0")?.contentDocument;
    const view = window.__CJ_SHENGHAO_V2__?.read?.();
    return {
      name2: window.SillyTavern?.getContext?.()?.name2 ?? null,
      Mvu: typeof window.Mvu, schema: !!window.__CJ_SHENGHAO_SCHEMA__, loader: !!window.__CJ_MVU_LOADER__, host: !!window.__CJ_SHENGHAO_V2__,
      nativeReady: view?.nativeReady ?? null, busy: view?.busy ?? null, error: view?.error ?? null,
      note: (doc?.querySelector(".error-note, .notice")?.innerText || "").slice(0, 120),
    };
  });
  const before = await page.evaluate(() => document.querySelectorAll("#chat .mes").length);
  const forced = startState.disabled === true;
  if (forced) {
    await page.evaluate(() => {
      const doc = document.getElementById("TH-message--0--0")?.contentDocument;
      const btn = [...(doc?.querySelectorAll("button") ?? [])].find((b) => /开始我的人生/.test(b.textContent || ""));
      if (btn) { btn.disabled = false; btn.click(); }
    });
  }
  if (!startState.disabled) {
    await page.evaluate(() => {
      const doc = document.getElementById("TH-message--0--0")?.contentDocument;
      [...(doc?.querySelectorAll("button") ?? [])].find((b) => /开始我的人生/.test(b.textContent || ""))?.click();
    });
  }
  let generated = false;
  try {
    await page.waitForFunction((n) => document.querySelectorAll("#chat .mes").length > n + 1, before, { timeout: CONFIG.waitForReplyMs });
    generated = true;
  } catch {}
  await page.waitForTimeout(8000);
  const opening = await readState();
  if (!(generated && people === 3 && opening.initialized === true)) await page.screenshot({ path: `${shotDir}/opening-fail.png` }).catch(() => null);
  record("run-opening", generated && people === 3 && opening.initialized === true, {
    filled, presetClicked, stepLabel, manual, people, preview, previewText, startState, diag, forced, generated, opening,
  });
} catch (error) { record("run-opening", false, String(error).slice(0, 500)); }

// ---------- 6. 脚本兜底与预设钩子 ----------
try {
  const s = await readState();
  const names = Object.keys(s.people || {});
  const goals = Object.values(s.people || {}).map((p) => p.currentGoal || "");
  const withGoal = goals.filter((g) => g.length > 0).length;
  const limitsDerived = Object.values(s.people || {}).every((p) => typeof p.scaleLevel === "number");
  const outfitFilled = Object.values(s.people || {}).some((p) => (p.outfitTop || "").length > 0);
  record("fallback-and-goals", names.length === 3 && withGoal >= 3 && limitsDerived && outfitFilled, {
    names, goals, withGoal, limitsDerived, outfitFilled, prowess: s.prowess, genitals: s.genitals, cash: s.cash, tier: s.tier,
  });
} catch (error) { record("fallback-and-goals", false, String(error).slice(0, 400)); }

// ---------- 7. 手机界面：四宫格 + 我的页 ----------
try {
  await page.waitForTimeout(1500);
  await openPhone();
  await goTab("women");
  const detailOpen = await withPhone((doc) => {
    const cards = [...doc.querySelectorAll("[data-detail]")];
    const hit = cards.find((c) => (c.innerText || "").includes("苏晚")) ?? cards[0];
    if (!hit) return { error: "no detail entry" };
    hit.click();
    return { id: hit.getAttribute("data-detail"), name: (hit.innerText || "").slice(0, 20) };
  });
  await page.waitForTimeout(1200);

  const header = await withPhone((doc) => {
    const screen = doc.querySelector(".phone-screen");
    const text = (screen?.innerText || "").replace(/\s+/g, " ");
    return { text: text.slice(0, 240), bars: screen ? screen.querySelectorAll(".bar").length : 0, hasPrivateGrid: !!doc.querySelector('[data-private-section="0"]') };
  });

  const panels = {};
  for (const i of [0, 1, 2, 3]) {
    panels[i] = await withPhone((doc, idx) => {
      doc.querySelector(`[data-private-section="${idx}"]`)?.click();
      const panel = doc.querySelector(".private-panel");
      return { text: (panel?.innerText || "").replace(/\s+/g, " ").slice(0, 900), tagCount: panel ? panel.querySelectorAll(".tag").length : 0 };
    }, i);
    await page.waitForTimeout(500);
  }
  await withPhone((doc) => { doc.querySelector('[data-private-section="0"]')?.click(); return true; });
  await page.screenshot({ path: `${shotDir}/detail-panels.png` }).catch(() => null);

  await goTab("mine");
  const mine = await withPhone((doc) => (doc.querySelector(".phone-screen")?.innerText || "").replace(/\s+/g, " ").slice(0, 600));
  await page.screenshot({ path: `${shotDir}/mine.png` }).catch(() => null);

  const okPanels = /私密四维档案/.test(header.text) && header.bars === 0 && header.hasPrivateGrid
    && /情动|胸部详情|生理周期/.test(panels[0].text) && /穿搭风格|上半身外装/.test(panels[1].text)
    && /性观念|与你亲密次数/.test(panels[2].text) && /开放档位：L/.test(panels[3].text) && /手口侍奉：/.test(panels[3].text);
  const okMine = /性能力：90\/100/.test(mine) && /性器：18cm/.test(mine) && /堕落加成 \+3/.test(mine);
  record("phone-panels", okPanels, { header, panels, detailOpen });
  record("phone-mine", okMine, { mine });
} catch (error) { record("phone-panels", false, String(error).slice(0, 500)); }

// ---------- 8. 纯寒暄 ----------
try {
  const before = await readState();
  const replied = await sendLine(CONFIG.casualLine);
  const after = await readState();
  const newRewards = (after.rewards || []).slice((before.rewards || []).length);
  record("casual-no-crit", replied && newRewards.length === 0, { replied, beforeRewards: before.rewards?.length, newRewards });
} catch (error) { record("casual-no-crit", false, String(error).slice(0, 400)); }

// ---------- 9. 涩涩 INTIMATE ----------
try {
  const before = await readState();
  const replied = await sendLine(CONFIG.spicyLine);
  const after = await readState();
  const newRewards = (after.rewards || []).slice((before.rewards || []).length);
  const intimate = newRewards.find((r) => r.mode === "INTIMATE" || /春心微澜|羞耻破防|欲海沉沦|绝顶征服|极乐巅峰/.test(r.label || ""));
  const su = Object.values(after.people || {}).find((p) => (p.currentGoal || "").includes("手术尾款")) || {};
  record("intimate-crit", replied && !!intimate && intimate.amountCents % 100 === 0, {
    replied, newRewards, intimate, corruption: su.corruption, arousal: su.arousal,
    hymenNote: su.hymenNote, vaginaState: su.vaginaState, abilityComment: su.abilityComment, tags: su.tags,
  });
} catch (error) { record("intimate-crit", false, String(error).slice(0, 400)); }

// ---------- 10. 收入 ----------
try {
  const before = await readState();
  const replied = await sendLine(CONFIG.incomeLine);
  const after = await readState();
  record("income", replied && (after.cash || 0) > (before.cash || 0), { replied, cashBefore: before.cash, cashAfter: after.cash, tier: after.tier });
} catch (error) { record("income", false, String(error).slice(0, 400)); }

// ---------- 11. 买房 ----------
try {
  const before = await readState();
  const replied = await sendLine(CONFIG.purchaseLine);
  const after = await readState();
  const bought = (after.assets || []).find((a) => !a.initial && /大平层|云玺湾/.test(a.name || ""));
  record("purchase-asset", replied && !!bought, { replied, assetsBefore: before.assets, assetsAfter: after.assets, cash: after.cash, tier: after.tier });
} catch (error) { record("purchase-asset", false, String(error).slice(0, 400)); }

// ---------- 12. 提现倍率 ----------
try {
  await openPhone();
  await goTab("women");
  const opened = await withPhone((doc) => {
    const cards = [...doc.querySelectorAll("[data-detail]")];
    const hit = cards.find((c) => (c.innerText || "").includes("苏晚")) ?? cards[0];
    hit?.click();
    return !!hit;
  });
  await page.waitForTimeout(1200);
  const withdrawBtn = await withPhone((doc) => {
    const btn = doc.querySelector("[data-withdraw]");
    return { exists: !!btn, disabled: btn?.disabled ?? null, text: (btn?.textContent || "").trim() };
  });
  await withPhone((doc) => { doc.querySelector("[data-withdraw]")?.click(); return true; });
  await page.waitForTimeout(900);
  const modal = await withPhone((doc) => (doc.querySelector("#modal")?.innerText || "").replace(/\s+/g, " ").slice(0, 300));
  await withPhone((doc) => { doc.querySelector("[data-confirm-withdraw]")?.click(); return true; });
  await page.waitForTimeout(4000);
  const after = await readState();
  const w = (after.withdrawals || []).at(-1);
  const expectedTierBasis = (after.cash || 0) + (after.assets || []).reduce((n, a) => n + (a.initial ? 0 : a.basisCents || 0), 0);
  const cashOnlyTier = (after.cash || 0) >= 1e9 ? 8 : 10;
  record("withdraw-tier", !!opened && !!w && w.multiplier === (expectedTierBasis >= 1e9 ? 8 : 10), {
    opened, withdrawBtn, modal, withdrawal: w, cashOnlyTier, expectedTierBasis,
    tierBasisTier: expectedTierBasis >= 1e9 ? 8 : 10, cash: after.cash, assets: after.assets,
  });
  await page.screenshot({ path: `${shotDir}/withdraw.png` }).catch(() => null);
} catch (error) { record("withdraw-tier", false, String(error).slice(0, 500)); }

// ---------- 收尾 ----------
const ok = steps.filter((s) => s.ok).length;
const summary = { spaceId: task.spaceId, shotDir, summary: `${ok}/${steps.length}`, failed: steps.filter((s) => !s.ok).map((s) => s.step), steps };
log(JSON.stringify(summary, null, 2));
if (!CONFIG.keepSpace) await task.finish({ keep: [] });
