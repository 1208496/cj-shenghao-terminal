// 零成本取证（第二版）：把页面导航到 8001 后，读 TavernHelper 注入表与采样参数
const SPACE_NAME = 'NOAPI-RC56B-LIVE';
let task, page;
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === SPACE_NAME);
if (!entry) { task = await taskSpace(SPACE_NAME); page = (await task.pages())[0] ?? await task.newPage(); }
else if (entry.ownership === 'agent') { task = await taskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }
else { task = await takeOverTaskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }

if (!String(await page.url()).includes('127.0.0.1:8001')) await page.goto('http://127.0.0.1:8001/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function', undefined, { timeout: 60000 });
await page.waitForTimeout(4000);

const info = await page.evaluate(() => {
  const ctx = window.SillyTavern.getContext();
  const H = window.TavernHelper || window.ST_TavernHelper || null;
  const ext = ctx.extensionPrompts || {};
  const ours = Object.entries(ext).filter(([k, v]) => String(k).includes('cj_shenghao') || JSON.stringify(v || {}).includes('终端变量补充'));
  const settings = ctx.textCompletionSettings || {};
  return {
    hasTavernHelper: !!H,
    hasInject: typeof H?.injectPrompts === 'function',
    extensionPromptKeys: Object.keys(ext).slice(0, 40),
    ourPrompts: ours.map(([k, v]) => ({ key: k, position: v?.position, depth: v?.depth, role: v?.role, len: String(v?.value || '').length, head: String(v?.value || '').slice(0, 60) })),
    maxTokens: settings.openai_max_tokens ?? settings.max_tokens ?? null,
    responseLength: settings.response_length ?? settings.responseLength ?? null,
    stopStrings: (settings.stop || []).slice(0, 10),
    model: ctx.characters?.length ? 'chars-loaded' : 'no-chars',
    mvuMode: ctx.extensionSettings?.mvu_settings?.['更新方式'] ?? null,
    mvuKeys: Object.keys(ctx.extensionSettings?.mvu_settings || {}).slice(0, 12),
    helperInjects: (() => { try { return (H?.getInjectPrompts?.() || []).map((x) => x?.id); } catch { return 'n/a'; } })(),
  };
});
console.log(JSON.stringify(info, null, 1));
await task.finish({ keep: [] });
