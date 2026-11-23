// 零成本复核：装卡后打开聊天，看过渡注入是否注册上（不再生成）
const SPACE_NAME = 'NOAPI-RC56B-LIVE';
let task, page;
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === SPACE_NAME);
if (!entry) { task = await taskSpace(SPACE_NAME); page = (await task.pages())[0] ?? await task.newPage(); }
else if (entry.ownership === 'agent') { task = await taskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }
else { task = await takeOverTaskSpace(entry.id); page = (await task.pages())[0] ?? await task.newPage(); }
if (!String(await page.url()).includes('127.0.0.1:8001')) await page.goto('http://127.0.0.1:8001/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function', undefined, { timeout: 60000 });
await page.waitForTimeout(3000);
// 打开 rc56b 那份聊天，让卡内脚本跑起来
await page.evaluate(async () => {
  const ctx = window.SillyTavern.getContext();
  const idx = ctx.characters.findIndex((x) => x.avatar === '神豪终端7.png');
  if (idx >= 0) await ctx.selectCharacterById(idx);
  if (typeof ctx.openCharacterChat === 'function') await ctx.openCharacterChat('__NOAPI_TEST_three_women_live__mwtpgmvb');
});
await page.waitForTimeout(9000);
const info = await page.evaluate(() => {
  const ctx = window.SillyTavern.getContext();
  const H = window.TavernHelper || window.ST_TavernHelper || null;
  const ext = ctx.extensionPrompts || {};
  const ours = Object.entries(ext).filter(([k, v]) => String(k).includes('cj_shenghao') || JSON.stringify(v || {}).includes('终端变量补充'));
  return {
    helperInjects: (() => { try { return (H?.getInjectPrompts?.() || []).map((x) => x?.id); } catch { return 'n/a'; } })(),
    extensionPromptKeys: Object.keys(ext).slice(0, 20),
    ourPrompts: ours.map(([k, v]) => ({ key: k, position: v?.position, depth: v?.depth, role: v?.role, len: String(v?.value || '').length })),
    apiReady: !!document.getElementById('API-status-top'),
    hostAlive: !!window.__CJ_SHENGHAO_V2__?.inspect,
  };
});
console.log(JSON.stringify(info, null, 1));
await task.finish({ keep: [] });
