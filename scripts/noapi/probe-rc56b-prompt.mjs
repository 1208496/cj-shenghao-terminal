// 零成本取证：看 8001 当前 prompt 里有没有我们的注入补丁 / protocol / presentThoughtIds
const SPACE_NAME = 'NOAPI-RC56B-LIVE';
let task, page;
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === SPACE_NAME);
if (!entry) { task = await taskSpace(SPACE_NAME); page = (await task.pages())[0] ?? await task.newPage(); }
else if (entry.ownership === 'agent') { task = await taskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }
else { task = await takeOverTaskSpace(entry.id); }
if (!page) { const tabs = await task.tabs(); const st = tabs.find((x) => String(x.url || '').includes('127.0.0.1:8001')) || tabs[0]; page = st.label ? task.page(st.label) : await task.adopt(st.page); }
console.log('[PROBE] page', page.label, await page.url());

const info = await page.evaluate(async () => {
  const out = {};
  const H = window.TavernHelper || window.ST_TavernHelper;
  out.hasInjectFn = typeof H?.injectPrompts === 'function';
  try { out.prompts = (await H?.getPrompts?.()) || null; } catch (e) { out.promptsError = String(e?.message || e); }
  try {
    const ctx = window.SillyTavern.getContext();
    out.ctx = {
      model: ctx.onlineStatus || null,
      settings: { openai_max_tokens: ctx.textCompletionSettings?.openai_max_tokens ?? null, responseLength: ctx.textCompletionSettings?.responseLength ?? null, max_tokens: ctx.textCompletionSettings?.max_tokens ?? null },
      stop: (ctx.textCompletionSettings?.stop || []).slice(0, 8),
    };
  } catch (e) { out.ctxError = String(e?.message || e); }
  // 最近一条助手消息里有没有补丁块
  try {
    const msgs = window.SillyTavern.getContext().chat || [];
    const last = msgs[msgs.length - 1] || {};
    out.lastMesLen = String(last.mes || '').length;
  } catch {}
  return out;
});
console.log(JSON.stringify(info, null, 1));
await task.finish({ keep: [] });
