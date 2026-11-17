// 角色卡静态体检（纯 Node，不需要浏览器，不需要酒馆）
// 用途：拿到任何一张卡，先跑这个，知道它「有什么」，再决定测什么。
// 跑法：node E:/SHZDCHOSSS/scripts/card-probe.mjs "<卡的 .png 或 .json 路径>" [--out 报告.json]
import fs from "node:fs";
import zlib from "node:zlib";

const file = process.argv[2];
const outIdx = process.argv.indexOf("--out");
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
if (!file) { console.error("用法: node card-probe.mjs <card.png|card.json> [--out report.json]"); process.exit(2); }

// ---------- 读卡 ----------
function readPngCard(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("不是 PNG");
  let off = 8;
  const found = {};
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      const z = data.indexOf(0);
      const key = data.toString("latin1", 0, z);
      let val;
      if (type === "tEXt") val = data.toString("latin1", z + 1);
      else if (type === "zTXt") val = zlib.inflateSync(data.subarray(z + 2)).toString("latin1");
      else {
        // iTXt: key\0 compFlag compMethod lang\0 transKey\0 text
        const flag = data[z + 1];
        let p = z + 3;
        p = data.indexOf(0, p) + 1; p = data.indexOf(0, p) + 1;
        const raw = data.subarray(p);
        val = (flag ? zlib.inflateSync(raw) : raw).toString("utf8");
      }
      found[key.toLowerCase()] = val;
    }
    off += 12 + len;
  }
  const b64 = found.ccv3 || found.chara;
  if (!b64) throw new Error("PNG 里没有 chara / ccv3 元数据，这不是角色卡（或者元数据被图片工具洗掉了）");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

const buf = fs.readFileSync(file);
const card = /\.png$/i.test(file) ? readPngCard(buf) : JSON.parse(buf.toString("utf8").replace(/^\uFEFF/, ""));
const d = card.data ?? card; // v1 卡没有 data 层
const ext = d.extensions ?? {};

// ---------- 小工具 ----------
const HTML_RE = /<(html|head|body|div|style|script|table|span|iframe|canvas|svg)\b|```html/i;
const RENDER_RE = /html>|<head>|<body/i; // 酒馆助手只把含这些的代码块渲染成 iframe
const URL_RE = /https?:\/\/[^\s"'`)<>\\]+/g;
const urls = new Set();
const grabUrls = (s) => { for (const m of String(s ?? "").matchAll(URL_RE)) urls.add(m[0].replace(/[.,;]+$/, "")); };
const short = (s, n = 60) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
const tagsIn = (s) => [...new Set([...String(s ?? "").matchAll(/<([A-Za-z_][\w-]*)\s*\/?>/g)].map((m) => m[1]))]
  .filter((t) => !/^(br|p|div|span|b|i|u|em|strong|img|hr|li|ul|ol|table|tr|td|th|style|script|html|head|body|font|center|small|q|code|pre|details|summary|a|h\d)$/i.test(t));

// ---------- 基本 ----------
const greetings = [d.first_mes, ...(d.alternate_greetings ?? [])];
greetings.forEach(grabUrls);
const basic = {
  name: d.name,
  spec: card.spec ?? "v1",
  version: d.character_version ?? null,
  creator: d.creator ?? null,
  descriptionChars: (d.description ?? "").length,
  personalityChars: (d.personality ?? "").length,
  scenarioChars: (d.scenario ?? "").length,
  mesExampleChars: (d.mes_example ?? "").length,
  systemPrompt: !!d.system_prompt,
  postHistory: !!d.post_history_instructions,
  depthPrompt: ext.depth_prompt?.prompt ? { depth: ext.depth_prompt.depth, role: ext.depth_prompt.role, chars: ext.depth_prompt.prompt.length } : null,
  greetings: greetings.map((g, i) => ({
    index: i,
    chars: (g ?? "").length,
    html: HTML_RE.test(g ?? ""),
    rendersAsIframe: RENDER_RE.test(g ?? ""),
    customTags: tagsIn(g),
    head: short(g, 50),
  })),
  linkedWorldName: ext.world || null,
  macrosInDescription: [...new Set(((d.description ?? "") + (d.first_mes ?? "")).match(/\{\{[^}]+\}\}/g) ?? [])].slice(0, 15),
};

// ---------- 世界书 ----------
const book = d.character_book;
let lore = null;
if (book) {
  const es = Array.isArray(book.entries) ? book.entries : Object.values(book.entries ?? {});
  es.forEach((e) => grabUrls(e.content));
  const ejs = es.filter((e) => /<%[\s\S]*?%>/.test(e.content ?? ""));
  lore = {
    name: book.name ?? null,
    entries: es.length,
    enabled: es.filter((e) => e.enabled !== false).length,
    constant: es.filter((e) => e.constant).length,
    keyed: es.filter((e) => !e.constant && (e.keys ?? []).length).length,
    noKeyNotConstant: es.filter((e) => e.enabled !== false && !e.constant && !(e.keys ?? []).length).map((e) => e.comment || e.name || "?"),
    special: es.map((e) => e.comment || e.name || "").filter((c) => /^\[(InitVar|initvar|mvu_|config|GENERATE|RENDER|@@)/i.test(c) || /\[InitVar\]|mvu/i.test(c)).slice(0, 20),
    ejsTemplates: ejs.length,
    sample: es.slice(0, 8).map((e) => `${e.constant ? "🔵" : "🟢"} ${short(e.comment || e.name || (e.keys ?? []).join("/"), 30)}`),
  };
}

// ---------- 正则 ----------
const PLACE = { 1: "用户输入", 2: "AI输出", 3: "斜杠命令", 5: "世界书", 6: "推理" };
const regex = (ext.regex_scripts ?? []).map((r) => {
  grabUrls(r.replaceString);
  const rep = r.replaceString ?? "";
  const kind = r.promptOnly ? "只改提示词" : r.markdownOnly ? "只改显示" : "显示+提示词都改";
  return {
    name: r.scriptName,
    disabled: !!r.disabled,
    placement: (r.placement ?? []).map((p) => PLACE[p] ?? p).join("/"),
    kind,
    find: short(r.findRegex, 70),
    replaceIsHtml: HTML_RE.test(rep),
    replaceRendersIframe: RENDER_RE.test(rep),
    replaceChars: rep.length,
    minDepth: r.minDepth ?? null,
    maxDepth: r.maxDepth ?? null,
  };
});

// ---------- 酒馆助手脚本 ----------
const thScripts = [];
const walkScripts = (arr) => {
  for (const s of arr ?? []) {
    if (s?.type === "folder" || Array.isArray(s?.scripts)) { walkScripts(s.scripts ?? s.value); continue; }
    const c = s.content ?? "";
    grabUrls(c);
    thScripts.push({
      name: s.name,
      enabled: s.enabled !== false,
      chars: c.length,
      mvu: /\bMvu\b|mag_variable|stat_data|InitVar/i.test(c),
      mountsDom: /document\.body|\$\(\s*['"`]body|appendTo\(|#chat\b|insertAdjacentHTML|createElement\(\s*['"`](div|iframe)/i.test(c),
      buttons: /ScriptButtons|getButtonEvent|eventOnButton/.test(c),
      listensEvents: /eventOn|tavern_events|iframe_events/.test(c),
      variables: /getVariables|replaceVariables|insertOrAssignVariables|updateVariablesWith/.test(c),
      importsRemote: [...new Set([...c.matchAll(/import\s*\(?\s*['"`](https?:\/\/[^'"`]+)/g)].map((m) => m[1]))],
    });
  }
};
walkScripts(ext.tavern_helper?.scripts);
walkScripts(ext.TavernHelper_scripts); // 旧版字段

// ---------- 结论：卡的类型 + 该测哪些模块 ----------
const anyOpeningUi = basic.greetings.some((g) => g.html) ||
  regex.some((r) => !r.disabled && r.replaceIsHtml && basic.greetings.some((g) => g.customTags.some((t) => new RegExp(t, "i").test(r.find))));
const perMsgUi = regex.some((r) => !r.disabled && r.placement.includes("AI输出") && r.kind !== "只改提示词" && r.replaceIsHtml &&
  !basic.greetings.some((g) => g.customTags.some((t) => new RegExp(t, "i").test(r.find))));
const mvu = thScripts.some((s) => s.mvu) || !!lore?.special.some((c) => /InitVar|mvu/i.test(c));
const floating = thScripts.some((s) => s.enabled && s.mountsDom);

const features = {
  "纯文字": !book && !regex.length && !thScripts.length && !basic.greetings.some((g) => g.html),
  "多开场白": greetings.length > 1,
  "内嵌世界书": !!book,
  "只链接外部世界书(卡里没带)": !book && !!ext.world,
  "正则": regex.length > 0,
  "开场前端(开局页/表单)": anyOpeningUi,
  "逐楼状态栏/美化(正则把AI输出换成HTML)": perMsgUi,
  "酒馆助手脚本": thScripts.length > 0,
  "固定/悬浮界面(脚本挂到页面上)": floating,
  "MVU变量": mvu,
  "EJS模板(需 ST-Prompt-Template)": !!lore?.ejsTemplates,
  "依赖外网资源": urls.size > 0,
};

const plan = ["M0 基础对话（每张卡必测）", "M1 酒馆基本操作回归（重新生成/滑动/继续/删除/新聊天/刷新后保留）"];
if (features["多开场白"]) plan.push("M2 开场白逐个切换");
if (features["内嵌世界书"] || features["只链接外部世界书(卡里没带)"]) plan.push("M3 世界书：导入绑定 + 触发记录");
if (features["正则"]) plan.push("M4 正则：显示 / 提示词两侧分别核对");
if (features["酒馆助手脚本"]) plan.push("M5 酒馆助手脚本：启用 + 运行 + 报错");
if (features["开场前端(开局页/表单)"]) plan.push("M6 开场前端：逐个控件走通");
if (features["逐楼状态栏/美化(正则把AI输出换成HTML)"]) plan.push("M7 逐楼状态栏：每楼都渲染、数值随剧情变");
if (features["固定/悬浮界面(脚本挂到页面上)"]) plan.push("M8 固定/悬浮界面：出现、可交互、刷新后还在");
if (features["MVU变量"]) plan.push("M9 MVU 变量：初始化 + 逐轮更新 + 回滚");
if (features["EJS模板(需 ST-Prompt-Template)"]) plan.push("M10 EJS 模板：提示词里已展开、无 <% 残留");
if (features["依赖外网资源"]) plan.push("M11 外网依赖：逐个确认能访问，记进报告");

const report = { file, basic, lore, regex, thScripts, urls: [...urls].slice(0, 40), features, plan };

// ---------- 打印 ----------
const yes = Object.entries(features).filter(([, v]) => v).map(([k]) => k);
console.log(`\n=== 角色卡体检：${basic.name}（${basic.spec}${basic.version ? " · " + basic.version : ""}）===`);
console.log("特征：" + (yes.join("、") || "无"));
console.log(`开场白 ${greetings.length} 个；世界书 ${lore ? `${lore.entries} 条（常驻 ${lore.constant}，关键词 ${lore.keyed}）` : "无"}；正则 ${regex.length} 条；酒馆助手脚本 ${thScripts.length} 个；外网地址 ${urls.size} 个`);
if (lore?.noKeyNotConstant.length) console.log("⚠ 世界书里既不常驻又没关键词、永远不会触发的条目：" + lore.noKeyNotConstant.join("、"));
if (features["只链接外部世界书(卡里没带)"]) console.log(`⚠ 卡链接了世界书「${ext.world}」但卡里没带，导入后会缺世界书，要向用户要文件`);
if (features["EJS模板(需 ST-Prompt-Template)"]) console.log("⚠ 世界书含 EJS 模板，酒馆没装/没开 ST-Prompt-Template 时会原样漏进提示词");
for (const s of thScripts.filter((x) => x.importsRemote.length)) console.log(`⚠ 脚本「${s.name}」从外网加载：${s.importsRemote.join(" , ")}`);
console.log("\n应测模块：\n  " + plan.join("\n  "));
console.log("\n（完整明细加 --out 输出 JSON）");
if (outFile) { fs.writeFileSync(outFile, JSON.stringify(report, null, 2)); console.log("已写入 " + outFile); }
