// ego 通用酒馆操作库（任何角色卡都能用）——给 ego-st-setup.mjs / ego-st-act.mjs 用
// 设计：只做「酒馆本身」的通用动作 + 把页面上看到的东西如实报出来；卡特有的判断交给测试者看 survey 结果做。
import fs from "node:fs";

export const BASE = "http://127.0.0.1:8001/";
export const RUN_DIR = "C:/Users/Administrator/ego/st-run";
export const SHOT_DIR = RUN_DIR + "/shots";
export const CONFIG_FILE = RUN_DIR + "/config.json";
export const ACTION_FILE = RUN_DIR + "/action.json";
export const STATE_FILE = RUN_DIR + "/state.json";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const T0 = Date.now();
export const log = (n, x) =>
  console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${n}` + (x !== undefined ? " " + JSON.stringify(x) : ""));
export class Stop extends Error {}
export const fail = (step, detail) => { throw new Stop(`${step} :: ${JSON.stringify(detail)}`); };

export const readJson = (p, dflt) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "")) : dflt);
export const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2));
export const loadConfig = () => {
  const c = readJson(CONFIG_FILE, null);
  if (!c?.card) fail("配置", `先写 ${CONFIG_FILE}，至少要有 "card": "卡的绝对路径"`);
  return c;
};
export const loadState = () => readJson(STATE_FILE, {});
export const saveState = (patch) => { const s = { ...loadState(), ...patch }; writeJson(STATE_FILE, s); return s; };

let shotSeq = 0;
export async function shot(page, name) {
  shotSeq += 1;
  const p = `${SHOT_DIR}/${new Date().toISOString().replace(/[-:T]/g, "").slice(4, 14)}-${String(shotSeq).padStart(2, "0")}-${name}.png`;
  try { await page.screenshot({ path: p }); log("截图", p); } catch (e) { log("截图失败", String(e).slice(0, 80)); }
  return p;
}

// ================= space =================
export async function newSpace(label) {
  const task = await taskSpace(label + " " + Date.now());
  const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
  saveState({ spaceId: task.spaceId });
  log("新 space", { id: task.spaceId });
  return { task, page };
}
export async function attachSpace() {
  const { spaceId } = loadState();
  if (!spaceId) fail("接管", "state.json 里没有 spaceId，先跑 ego-st-setup.mjs");
  const entry = (await listTaskSpaces()).find((s) => s.id === spaceId);
  if (!entry) fail("接管", { spaceId, msg: "space 已不存在，重跑 ego-st-setup.mjs" });
  if (entry.ownership === "user") fail("接管", { spaceId, msg: "控制权在用户手里，停下问用户，不准抢" });
  const task = await taskSpace(spaceId);
  const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
  return { task, page };
}

// ================= 打开 / API =================
export async function openTavern(page) {
  await page.goto(BASE, { timeout: 25000 });
  let st = null;
  for (let i = 0; i < 40; i += 1) {
    st = await page.evaluate(() => ({ ready: document.readyState, preloader: !!document.getElementById("preloader"), sendForm: !!document.getElementById("send_form") }));
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
    const pool = [...document.querySelectorAll("button, .menu_button, div, span")].filter((el) => el.children.length === 0 && (el.offsetWidth || el.offsetHeight));
    pool.find((el) => (el.textContent || "").trim() === "连接")?.click();
  });
  let ok = false;
  for (let i = 0; i < 10 && !ok; i += 1) {
    await page.waitForTimeout(800);
    ok = await page.evaluate(() => { const c = document.querySelector("#API-status-top")?.className || ""; return c.includes("fa-plug") && !c.includes("exclamation"); });
  }
  await page.evaluate(() => document.querySelector("#API-status-top")?.click());
  await page.waitForTimeout(600);
  log("连 API", { ok });
  if (!ok) { await shot(page, "api-fail"); fail("连 API", "插头仍是感叹号"); }
}

// ================= 弹窗 =================
// 酒馆和常用扩展会弹的框。卡自己弹的框：在 config.json 的 extraPopupRules 里补，不准写万能规则。
export const BASE_POPUP_RULES = [
  { name: "标签导入", match: "导入标签|Import Tags", btn: "^(全部导入|Import All)$" },
  { name: "内嵌世界书(打开卡时，每卡只弹一次)", match: "embedded World/Lorebook", btn: "^(是|Yes)$" },
  { name: "导入世界书确认", match: "Are you sure you want to import|确定要导入", btn: "^(是|Yes|确定|OK)$" },
  { name: "内置正则", match: "内置正则|embedded regex", btn: "^(是|确定|确认|Yes|OK)$" },
  { name: "酒馆助手嵌入式脚本", match: "嵌入式脚本|embedded script", btn: "^(确认|确定|是|Yes)$" },
  { name: "开始新聊天", match: "Start new chat|开始新聊天", btn: "^(是|Yes|确定|OK)$" },
];
let extraRules = [];
export const setExtraPopupRules = (r) => { extraRules = Array.isArray(r) ? r : []; };
// promptMustNotContain 只应查聊天历史。世界书注入的条目要排除，但不能靠写死某张卡的句子
// （别的卡的协议条目常用 role:user / assistant 按深度注入）；默认按"本轮激活过的世界书正文"排除，
// 另可用 config.promptHistoryExclude 追加正则，对付非世界书来源的注入。
let historyExclude = [];
export const setPromptHistoryExclude = (r) => { historyExclude = Array.isArray(r) ? r : []; };

export async function readPopups(page) {
  return page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight);
    return [...document.querySelectorAll(".popup")].filter(vis).map((p) => ({
      text: (p.innerText || "").replace(/\s+/g, " ").slice(0, 200),
      buttons: [...p.querySelectorAll("button, div, span, a")].filter((el) => el.children.length === 0 && vis(el)).map((el) => (el.textContent || "").trim()).filter((t) => t && t.length <= 10),
    }));
  });
}

export async function handlePopups(page, tag, { quietMs = 3000, maxMs = 25000 } = {}) {
  const rules = [...BASE_POPUP_RULES, ...extraRules];
  const done = [];
  const t0 = Date.now();
  let lastSeen = Date.now();
  while (Date.now() - t0 < maxMs) {
    const pops = await readPopups(page);
    if (!pops.length) { if (Date.now() - lastSeen >= quietMs) break; await page.waitForTimeout(400); continue; }
    lastSeen = Date.now();
    const r = await page.evaluate((rs) => {
      const vis = (el) => !!(el.offsetWidth || el.offsetHeight);
      for (const p of [...document.querySelectorAll(".popup")].filter(vis)) {
        const txt = (p.innerText || "").replace(/\s+/g, " ");
        const rule = rs.find((x) => new RegExp(x.match, "i").test(txt));
        const leaf = [...p.querySelectorAll("button, div, span, a")].filter((el) => el.children.length === 0 && vis(el));
        if (!rule) return { unknown: txt.slice(0, 200), buttons: leaf.map((e) => (e.textContent || "").trim()).filter((t) => t && t.length <= 10) };
        const b = leaf.find((el) => new RegExp(rule.btn, "i").test((el.textContent || "").trim()));
        if (!b) return { noButton: rule.name, txt: txt.slice(0, 160) };
        const label = (b.textContent || "").trim();
        b.click();
        return { clicked: rule.name + " → " + label };
      }
      return null;
    }, rules);
    if (r?.unknown || r?.noButton) { await shot(page, `${tag}-unknown-popup`); fail(`${tag} 遇到不认识的弹窗（读懂后在 config.extraPopupRules 里补规则，或问用户）`, r); }
    if (r?.clicked) { done.push(r.clicked); log(`${tag} 弹窗`, r.clicked); }
    await page.waitForTimeout(1000);
  }
  const left = await readPopups(page);
  if (left.length) { await shot(page, `${tag}-popup-left`); fail(`${tag} 弹窗没清完`, left); }
  log(`${tag} 弹窗处理完`, done);
  return done;
}

export async function closeDrawers(page) {
  await page.evaluate(() => {
    for (const d of document.querySelectorAll(".drawer-content.openDrawer:not(.pinnedOpen)")) {
      d.parentElement?.querySelector(".drawer-icon")?.click();
    }
  });
  await page.waitForTimeout(600);
}

// ================= 页面基线（用来认出「卡自己挂上去的东西」） =================
export async function takeBaseline(page) {
  return page.evaluate(() => ({
    body: [...document.body.children].map((e) => e.id || e.tagName + "." + [...e.classList].join(".")),
    sheld: [...(document.getElementById("sheld")?.children ?? [])].map((e) => e.id || e.tagName + "." + [...e.classList].join(".")),
  }));
}

// ================= 导卡 / 开卡 =================
export async function openRightPanel(page) {
  await page.evaluate(() => { if (!document.querySelector("#right-nav-panel.openDrawer")) document.querySelector("#rightNavDrawerIcon")?.click(); });
  await page.waitForTimeout(1200);
}

export async function importCard(page, cardPath) {
  if (!fs.existsSync(cardPath)) fail("导卡", { cardPath, msg: "文件不存在" });
  await openRightPanel(page);
  const prev = await page.evaluate(() => [...document.querySelectorAll("#rm_print_characters_block .character_select")].map((c) => c.querySelector(".avatar")?.getAttribute("title") || ""));
  await page.setInputFiles("#character_import_file", [cardPath.replace(/\\/g, "/")]);
  await page.waitForTimeout(2500);
  await handlePopups(page, "导卡");
  const fresh = await page.evaluate((p) => [...document.querySelectorAll("#rm_print_characters_block .character_select")]
    .map((c) => ({ chid: c.getAttribute("data-chid"), avatar: c.querySelector(".avatar")?.getAttribute("title") || "" }))
    .filter((x) => !p.includes(x.avatar)), prev);
  log("新导入的卡", fresh);
  if (fresh.length !== 1) { await shot(page, "import-fail"); fail("导卡", { 期望新增1张: fresh }); }
  return fresh[0];
}

// 以 avatar 文件名找卡（chid 刷新后会变，avatar 不变）
export async function openCardByAvatar(page, avatar) {
  await openRightPanel(page);
  const ok = await page.evaluate((av) => {
    // 新版酒馆把 .avatar 的 title 换成 "[Character] 名字\nFile: 文件.png"，精确等号匹配不到卡。
    const rows = [...document.querySelectorAll("#rm_print_characters_block .character_select")];
    const row = rows.find((c) => { const t = c.querySelector(".avatar")?.getAttribute("title") || ""; return t === av || t.includes(av); });
    const a = row?.querySelector(".avatar");
    a?.click();
    return !!a;
  }, avatar);
  if (!ok) fail("开卡", { avatar, msg: "角色列表里没有这张卡" });
  await page.waitForTimeout(2000);
  await handlePopups(page, "开卡");
  await closeDrawers(page);
}

// ================= 卡在酒馆里的实际状态 =================
export async function cardRuntime(page) {
  return page.evaluate(() => {
    const ctx = window.SillyTavern?.getContext?.() || {};
    const ch = (ctx.characters || [])[ctx.characterId];
    const ext = ch?.data?.extensions || {};
    const worlds = [...document.querySelectorAll("#world_editor_select option")].map((o) => (o.textContent || "").trim());
    const regexAllowed = (ctx.extensionSettings?.character_allowed_regex || []).includes(ch?.avatar);
    return {
      name: ch?.name ?? null,
      avatar: ch?.avatar ?? null,
      chatId: ctx.chatId ?? null,
      hasEmbeddedBook: !!ch?.data?.character_book,
      world: ext.world || null,
      worldExists: !!ext.world && worlds.includes(ext.world),
      globeLit: !!document.querySelector("#world_button.world_set"),
      regexCount: (ext.regex_scripts || []).length,
      regexAllowed,
      thScriptsInCard: (ext.tavern_helper?.scripts || ext.TavernHelper_scripts || []).length,
      thScriptIframes: document.querySelectorAll('iframe[id^="TH-script--"]').length,
      tavernHelper: typeof window.TavernHelper,
      mvu: typeof window.Mvu,
      greetings: 1 + (ch?.data?.alternate_greetings?.length || 0),
    };
  });
}

// 关卡：卡里带的东西都要在酒馆里「生效」。返回问题列表（空 = 全过）
export function cardGateProblems(rt) {
  const p = [];
  if (rt.hasEmbeddedBook && !(rt.world && rt.worldExists && rt.globeLit)) p.push("内嵌世界书没导入/没绑定（地球按钮不亮）");
  if (!rt.hasEmbeddedBook && rt.world && !rt.worldExists) p.push(`卡链接了世界书「${rt.world}」但酒馆里没有，向用户要世界书文件`);
  if (rt.regexCount && !rt.regexAllowed) p.push("卡带的局部正则没被允许（内置正则弹窗没点）");
  if (rt.thScriptsInCard && rt.thScriptIframes === 0) p.push("卡带酒馆助手脚本，但一个脚本 iframe 都没起来（嵌入式脚本确认框没点）");
  return p;
}

// 补导内嵌世界书：更多... → 导入角色卡的世界书 → 是
export async function importCardLore(page) {
  const sel = await page.evaluate(() => {
    const s = document.getElementById("char-management-dropdown");
    if (!s) return { ok: false };
    const i = [...s.options].findIndex((o) => /Import Card Lore|导入角色卡的世界书/i.test((o.textContent || "").trim()));
    if (i < 0) return { ok: false };
    s.selectedIndex = i;
    s.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  });
  if (!sel.ok) fail("补导世界书", "找不到「导入角色卡的世界书」");
  await page.waitForTimeout(1500);
  await handlePopups(page, "补导世界书");
  await page.waitForTimeout(1500);
  await closeDrawers(page);
}

// ================= 探针：记录世界书触发、最终提示词、页面报错 =================
export async function installProbes(page, { promptHistoryExclude = historyExclude } = {}) {
  return page.evaluate((patterns) => {
    if (window.__agy?.installed) return "已装";
    const ctx = window.SillyTavern?.getContext?.();
    const A = (window.__agy = { installed: true, wi: [], injected: [], prompt: null, errors: [], toasts: [] });
    const extraExclude = (patterns || []).flatMap((p) => { try { return [new RegExp(p, "i")]; } catch { return []; } });
    const ev = ctx.eventSource, T = ctx.eventTypes || ctx.event_types;
    // 「世界书注入」按正文识别：记住本轮激活过的条目正文前缀，提示词里带这些前缀的消息不算聊天历史。
    // 这样对任何卡都成立，与协议条目用什么 role、插在哪个深度无关。
    const squash = (v) => String(v ?? "").replace(/\s+/g, " ");
    ev.on(T.WORLD_INFO_ACTIVATED, (arr) => {
      const entries = arr || [];
      A.wi.push({ at: Date.now(), entries: entries.map((e) => `${e.world}::${e.comment || e.uid}`) });
      if (A.wi.length > 30) A.wi.shift();
      for (const e of entries) {
        const body = squash(e?.content).trim();
        if (body) A.injected.push(body.slice(0, 80));
      }
      if (A.injected.length > 300) A.injected.splice(0, A.injected.length - 300);
    });
    const isInjected = (m) => {
      const t = squash(m.content);
      return A.injected.some((p) => t.includes(p)) || extraExclude.some((re) => re.test(t));
    };
    ev.on(T.CHAT_COMPLETION_PROMPT_READY, (d) => {
      if (d?.dryRun) return;
      const msgs = d?.chat || [];
      const line = (m) => `[${m.role}] ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`;
      A.prompt = { at: Date.now(), count: msgs.length, chars: msgs.reduce((n, m) => n + String(m.content ?? "").length, 0),
        roles: msgs.map((m) => `${m.role}:${String(m.content ?? "").length}`),
        text: msgs.map(line).join("\n"),
        historyText: msgs.filter((m) => m.role !== "system" && !isInjected(m)).map(line).join("\n") };
    });
    window.addEventListener("error", (e) => A.errors.push(String(e.message || e).slice(0, 200)));
    window.addEventListener("unhandledrejection", (e) => A.errors.push("Promise: " + String(e.reason?.message || e.reason).slice(0, 200)));
    new MutationObserver(() => {
      for (const t of document.querySelectorAll("#toast-container .toast:not([data-agy])")) {
        t.setAttribute("data-agy", "1");
        A.toasts.push((t.classList.contains("toast-error") ? "❌ " : t.classList.contains("toast-warning") ? "⚠ " : "") + (t.innerText || "").replace(/\s+/g, " ").slice(0, 160));
        if (A.toasts.length > 40) A.toasts.shift();
      }
    }).observe(document.body, { childList: true, subtree: true });
    return "新装";
  }, promptHistoryExclude);
}

// ================= 等生成 =================
export const lastSig = (page) => page.evaluate(() => {
  const c = window.SillyTavern?.getContext?.()?.chat || [];
  const m = c.at(-1);
  return { n: c.length, mes: m?.mes || "", swipe: m?.swipe_id ?? 0 };
});
const isGenerating = (page) => page.evaluate(() => { const s = document.getElementById("mes_stop"); return !!s && getComputedStyle(s).display !== "none"; });

export async function waitGeneration(page, sig, { timeout = 180000 } = {}) {
  const t0 = Date.now();
  let started = false;
  while (Date.now() - t0 < 10000) { // 10 秒内必须看到「开始生成」或内容变化
    const cur = await lastSig(page);
    if ((await isGenerating(page)) || cur.n !== sig.n || cur.mes !== sig.mes || cur.swipe !== sig.swipe) { started = true; break; }
    await page.waitForTimeout(300);
  }
  if (!started) return { ok: false, why: "10 秒内没开始生成（按钮没点到 / API 断了 / 有弹窗挡着）" };
  const waitEnd = async () => {
    while (Date.now() - t0 < timeout) {
      if (!(await isGenerating(page))) break;
      await page.waitForTimeout(1500);
    }
  };
  await waitEnd();
  // 有的环境点完按钮要 2–4 秒才真正开始流式生成；这里补一段缓冲，
  // 否则「还没开始」会被误判成「超时仍在生成」。
  await page.waitForTimeout(2500);
  if (await isGenerating(page)) await waitEnd();
  await page.waitForTimeout(2500); // 给脚本/MVU 落盘留时间
  const cur = await lastSig(page);
  const lastIsUser = await page.evaluate(() => (window.SillyTavern?.getContext?.()?.chat || []).at(-1)?.is_user ?? null);
  if (await isGenerating(page)) return { ok: false, why: "超时仍在生成" };
  if (lastIsUser !== false) return { ok: false, why: "最后一条还是用户消息（模型没回 / 报错了，看 toasts）" };
  if (cur.mes.trim().length === 0) return { ok: false, why: "回复是空的" };
  return { ok: true, chars: cur.mes.length };
}

// ================= 动作 =================
export async function sendText(page, text) {
  const sig = await lastSig(page);
  await page.evaluate((t) => {
    const ta = document.getElementById("send_textarea");
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(ta, t);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("send_but")?.click();
  }, text);
  return waitGeneration(page, sig);
}
async function clickId(page, id) {
  const ok = await page.evaluate((i) => { const b = document.getElementById(i); b?.click(); return !!b; }, id);
  if (!ok) fail("点击", `#${id} 不存在`);
}
export async function regenerate(page) { const s = await lastSig(page); await clickId(page, "option_regenerate"); return waitGeneration(page, s); }
export async function continueGen(page) { const s = await lastSig(page); await clickId(page, "option_continue"); return waitGeneration(page, s); }
export async function swipe(page, dir = "right") {
  const s = await lastSig(page);
  const ok = await page.evaluate((d) => { const b = document.querySelector(`#chat .last_mes .swipe_${d}`); b?.click(); return !!b; }, dir);
  if (!ok) fail("滑动", "最后一楼没有滑动箭头（用户消息不能滑 / 开场白只有 1 个）");
  // 向右滑到头会触发新生成；滑到已有的 swipe 不生成
  await page.waitForTimeout(1500);
  if (await isGenerating(page)) return waitGeneration(page, s);
  const cur = await lastSig(page);
  return { ok: cur.swipe !== s.swipe, swipeFrom: s.swipe, swipeTo: cur.swipe };
}
export async function slash(page, cmd) {
  return page.evaluate(async (c) => {
    const ctx = window.SillyTavern.getContext();
    const r = await ctx.executeSlashCommandsWithOptions(c, { handleParserErrors: true, handleExecutionErrors: true });
    return { pipe: String(r?.pipe ?? "").slice(0, 300), error: r?.isError ?? false };
  }, cmd);
}
export async function newChat(page) {
  await clickId(page, "option_start_new_chat");
  await page.waitForTimeout(1200);
  await handlePopups(page, "新聊天");
  await page.waitForTimeout(1500);
}

// 在主页面或某个 iframe 里点控件 / 填值（开场前端、状态栏、悬浮界面都用这个）
// target: { frame?: "iframe 的 id 或 CSS 选择器", selector?: "...", text?: "按钮文字（正则）", index?: 0 }
export async function uiClick(page, target) {
  return page.evaluate((t) => {
    const fr = t.frame ? (document.getElementById(t.frame) || document.querySelector(t.frame)) : null;
    if (t.frame && !fr) return { ok: false, why: "找不到 frame " + t.frame };
    const doc = fr ? fr.contentDocument : document;
    if (!doc) return { ok: false, why: "frame 不同源，读不到 contentDocument" };
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    let cands = t.selector ? [...doc.querySelectorAll(t.selector)] : [...doc.querySelectorAll("button, a, [role=button], input[type=button], input[type=submit], .menu_button, [onclick], label, li, div, span")];
    if (t.text) cands = cands.filter((el) => new RegExp(t.text).test((el.innerText || el.value || "").trim()) && (t.selector || el.children.length <= 2));
    cands = cands.filter(vis);
    const el = cands[t.index ?? 0];
    if (!el) return { ok: false, why: "没找到匹配的可见元素", count: cands.length };
    el.click();
    return { ok: true, clicked: (el.innerText || el.value || el.tagName).trim().slice(0, 40), total: cands.length };
  }, target);
}
export async function uiFill(page, target) {
  return page.evaluate((t) => {
    const fr = t.frame ? (document.getElementById(t.frame) || document.querySelector(t.frame)) : null;
    const doc = fr ? fr.contentDocument : document;
    const win = fr ? fr.contentWindow : window;
    const el = doc?.querySelector(t.selector);
    if (!el) return { ok: false, why: "找不到 " + t.selector };
    const proto = el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? win.HTMLSelectElement.prototype : win.HTMLInputElement.prototype;
    if (el.type === "checkbox" || el.type === "radio") el.checked = !!t.value;
    else Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(t.value));
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
    el.dispatchEvent(new win.Event("change", { bubbles: true }));
    return { ok: true, value: el.type === "checkbox" ? el.checked : el.value };
  }, target);
}

// ================= 全面观察（每个动作之后都跑） =================
export async function survey(page, baseline, opts = {}) {
  const s = await page.evaluate(({ base, depth }) => {
    const ctx = window.SillyTavern?.getContext?.() || {};
    const chat = ctx.chat || [];
    const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight));
    const txt = (el, n = 120) => (el?.innerText || "").replace(/\s+/g, " ").slice(0, n);
    const idOf = (e) => e.id || e.tagName + "." + [...e.classList].join(".");

    // 每楼的渲染情况（只看最后 depth 楼）
    const mesEls = [...document.querySelectorAll("#chat .mes")].slice(-depth);
    const floors = mesEls.map((m) => {
      const id = Number(m.getAttribute("mesid"));
      const mt = m.querySelector(".mes_text");
      const plain = mt?.innerText || "";
      const iframes = [...m.querySelectorAll("iframe")].map((f) => {
        let inner = null;
        try {
          const d = f.contentDocument;
          inner = d ? {
            text: (d.body?.innerText || "").replace(/\s+/g, " ").slice(0, 100),
            controls: [...d.querySelectorAll("button, input, select, textarea, a[href], [role=button]")].filter((e) => e.offsetWidth || e.offsetHeight)
              .slice(0, 25).map((e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${e.type && e.tagName === "INPUT" ? "[" + e.type + "]" : ""} ${((e.innerText || e.value || e.placeholder || "").trim()).slice(0, 16)}${e.disabled ? " (禁用)" : ""}`),
          } : "不同源";
        } catch { inner = "不同源"; }
        return { id: f.id || null, w: f.offsetWidth, h: f.offsetHeight, inner };
      });
      return {
        mesid: id,
        who: m.getAttribute("is_user") === "true" ? "用户" : m.getAttribute("is_system") === "true" ? "系统" : "AI",
        swipes: chat[id]?.swipes?.length ?? 1,
        swipeId: chat[id]?.swipe_id ?? 0,
        textChars: plain.length,
        head: plain.replace(/\s+/g, " ").slice(0, 80),
        htmlBlocks: mt ? mt.querySelectorAll("div, table, details, style").length : 0,
        iframes,
        // 通用「漏了」检查：没被正则吃掉的标签、没替换的宏、JS 垃圾值
        leaks: [
          ...[...new Set(plain.match(/<\/?[A-Za-z_][\w-]*[^>]*>/g) ?? [])].slice(0, 6).map((x) => "原样标签 " + x.slice(0, 40)),
          ...[...new Set(plain.match(/\{\{[^}]{1,30}\}\}/g) ?? [])].slice(0, 4).map((x) => "未替换宏 " + x),
          ...(/<%[\s\S]*?%>/.test(plain) ? ["EJS 原样 <% %>"] : []),
          ...(/\[object Object\]|\bundefined\b|\bNaN\b/.test(plain) ? ["出现 [object Object]/undefined/NaN"] : []),
        ],
      };
    });

    // 卡挂到页面上的东西（相对基线新增的、可见的）
    const extra = [];
    for (const e of document.body.children) if (!base.body.includes(idOf(e)) && vis(e) && !/^(toast-container|SCRIPT|STYLE|LINK)/.test(idOf(e))) extra.push(e);
    for (const e of document.getElementById("sheld")?.children ?? []) if (!base.sheld.includes(idOf(e)) && vis(e)) extra.push(e);
    const mounted = extra.map((e) => {
      const r = e.getBoundingClientRect();
      let inner = txt(e, 80);
      if (e.tagName === "IFRAME") { try { inner = (e.contentDocument?.body?.innerText || "").replace(/\s+/g, " ").slice(0, 80) || `(iframe html ${e.contentDocument?.documentElement?.outerHTML?.length ?? 0} 字)`; } catch { inner = "不同源"; } }
      return { el: idOf(e).slice(0, 60), pos: getComputedStyle(e).position, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], inViewport: r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight, inner };
    });

    // 变量（酒馆助手接口；没有酒馆助手就读聊天元数据）
    let vars = null;
    try {
      const TH = window.TavernHelper;
      if (TH?.getVariables) {
        const last = chat.length - 1;
        vars = { message: TH.getVariables({ type: "message", message_id: last }), chat: TH.getVariables({ type: "chat" }) };
      } else vars = { chat: ctx.chatMetadata?.variables ?? null };
    } catch (e) { vars = { error: String(e).slice(0, 120) }; }

    const A = window.__agy || {};
    return {
      chat: { id: ctx.chatId ?? null, floors: chat.length, lastIsUser: chat.at(-1)?.is_user ?? null },
      popups: [...document.querySelectorAll(".popup")].filter(vis).map((p) => txt(p, 100)),
      floors,
      mounted,
      vars,
      wiLast: A.wi?.at(-1) ?? null,
      prompt: A.prompt ? { count: A.prompt.count, chars: A.prompt.chars } : null,
      promptText: A.prompt?.text ?? "",
      promptHistoryText: A.prompt?.historyText ?? "",
      errors: (A.errors || []).slice(-10),
      toasts: (A.toasts || []).slice(-10),
    };
  }, { base: baseline || { body: [], sheld: [] }, depth: opts.depth ?? 3 });

  // 提示词检查（config.promptMustContain / promptMustNotContain）
  // 应含：查全量 Prompt；不应含：只查聊天历史楼层，避免误伤常驻世界书里的协议教学示例。
  const checks = [];
  for (const k of opts.promptMustContain ?? []) checks.push({ 提示词应含: k, ok: s.promptText.includes(k) });
  for (const k of opts.promptMustNotContain ?? []) checks.push({ 提示词不应含: k, ok: !s.promptHistoryText.includes(k) });
  const promptText = s.promptText; delete s.promptText; delete s.promptHistoryText;
  s.promptChecks = checks;

  // 变量与上一次相比改了哪些（只比较叶子路径）
  const flat = (o, p = "", out = {}) => { if (o && typeof o === "object") { for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, out); } else out[p] = o; return out; };
  const prevFile = RUN_DIR + "/vars-last.json";
  const prev = readJson(prevFile, null);
  const nowFlat = flat(s.vars?.message ?? s.vars?.chat ?? {});
  if (prev) {
    const changed = Object.keys({ ...prev, ...nowFlat }).filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(nowFlat[k]));
    s.varsChanged = changed.slice(0, 40).map((k) => `${k}: ${JSON.stringify(prev[k])?.slice(0, 40)} → ${JSON.stringify(nowFlat[k])?.slice(0, 40)}`);
    if (changed.length > 40) s.varsChanged.push(`…共 ${changed.length} 处`);
  }
  writeJson(prevFile, nowFlat);
  writeJson(`${RUN_DIR}/vars-${Date.now()}.json`, s.vars);
  if (promptText) fs.writeFileSync(RUN_DIR + "/prompt-last.txt", promptText);
  s.varsKeys = Object.keys(nowFlat).length;
  delete s.vars; // 全量变量写在文件里，不刷屏
  return s;
}

export async function run(name, fn) {
  try { await fn(); console.log(`RESULT=PASS ${name}`); }
  catch (e) {
    console.log(`RESULT=FAIL ${name} :: ${e instanceof Stop ? e.message : String(e?.stack || e).slice(0, 500)}`);
    console.log("→ 停下，把这行 + 截图路径原样报告给用户，不要换路子硬试。");
  }
}
