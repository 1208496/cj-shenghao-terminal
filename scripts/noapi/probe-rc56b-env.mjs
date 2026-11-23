// 零成本：读 8001 当前模型/预设/更新方式（不生成）
const SPACE_NAME = 'NOAPI-RC56B-LIVE';
let task, page;
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === SPACE_NAME);
if (!entry) { task = await taskSpace(SPACE_NAME); page = (await task.pages())[0] ?? await task.newPage(); }
else if (entry.ownership === 'agent') { task = await taskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }
else { task = await takeOverTaskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }
if (!String(await page.url()).includes('127.0.0.1:8001')) await page.goto('http://127.0.0.1:8001/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function', undefined, { timeout: 60000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const ctx = window.SillyTavern.getContext();
  const s = ctx.textCompletionSettings || {};
  const cs = ctx.chatCompletionSettings || {};
  return {
    api: ctx.mainApi ?? null,
    onlineStatus: ctx.onlineStatus ?? null,
    model: s.model ?? cs.model ?? null,
    reverseProxy: s.reverse_proxy ?? null,
    chatCompletionSource: cs.chat_completion_source ?? null,
    mvuMode: ctx.extensionSettings?.mvu_settings?.['更新方式'] ?? null,
    presetName: ctx.power_user?.preset_name ?? null,
    presetSettings: cs.preset_settings_openai ?? s.preset_settings ?? null,
    maxTokens: s.openai_max_tokens ?? cs.openai_max_tokens ?? null,
    responseLength: s.response_length ?? null,
  };
});
console.log(JSON.stringify(info, null, 1));
await task.finish({ keep: [] });
