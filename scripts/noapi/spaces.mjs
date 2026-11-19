// scripts/noapi/spaces.mjs —— ego space 生命周期管理
//
// 背景：ego 的规矩是「一个用户目标 = 一个 TaskSpace」，用完必须 finish({keep:[]})。
// 我之前的脚本每个都新建 space 又不收，把窗口堆成了十几个 —— 这个脚本负责清理，
// 并给其它脚本提供"复用同一个 space"的入口。
//
// 用法：
//   ego-browser nodejs -e "await import('file:///E:/SHZDCHOSSS/scripts/noapi/spaces.mjs')"            # 列出
//   ego-browser nodejs -e "process.env.NOAPI_SPACES='close-all' ; await import('...')"                # 关掉所有 NOAPI-* 空间
//   ego-browser nodejs -e "process.env.NOAPI_SPACES='open'; await import('...')"                      # 打开/复用唯一的 NOAPI-HARNESS 空间

// 控制参数走文件，不靠 env/argv —— 实测 `ego-browser nodejs -e` 里 env 与 argv 都不可靠。
import fs from 'node:fs';
import path from 'node:path';

const CTL = 'E:\\SHZDCHOSSS\\.work\\noapi\\spaces-ctl.json';
let ctl = {};
try { ctl = JSON.parse(fs.readFileSync(CTL, 'utf8')); } catch { }
const MODE = ctl.mode || process.env.NOAPI_SPACES || 'list';
const PREFIX = ctl.prefix || process.env.NOAPI_SPACES_PREFIX || 'NOAPI';
const KEEP_NAME = ctl.name || process.env.NOAPI_SPACE_NAME || 'NOAPI-HARNESS';

async function closeOne(space) {
  const id = space.id ?? space.spaceId;
  // 依次尝试：正常接管 → 用户控制中 → 已 finish 但保留页面
  try { const t = await taskSpace(id); await t.finish({ keep: [] }); return { id, ok: true, how: 'taskSpace' }; } catch (e1) {
    try { const t = await takeOverTaskSpace(id); await t.finish({ keep: [] }); return { id, ok: true, how: 'takeOver' }; } catch (e2) {
      try { const t = await claimTaskSpace(id); await t.finish({ keep: [] }); return { id, ok: true, how: 'claim' }; } catch (e3) {
        return { id, ok: false, err: `${e1.message} | ${e2.message} | ${e3.message}` };
      }
    }
  }
}

const spaces = await listTaskSpaces();
console.log('SPACES', spaces.length);
for (const s of spaces) console.log(` - id=${s.id} name="${s.name}" ownership=${s.ownership} pages=${s.pages ?? s.pageCount ?? '?'}`);

if (MODE === 'close-all' || MODE === 'close') {
  // 只关自己（ownership === 'agent'）的空间；控制权在用户手里的空间是硬停，
  // 不准自行 takeOver 抢回来。
  const want = (s) => (PREFIX === '*' ? true : String(s.name || '').startsWith(PREFIX)) && s.ownership === 'agent';
  const targets = spaces.filter(want);
  const skipped = spaces.filter((s) => (PREFIX === '*' ? true : String(s.name || '').startsWith(PREFIX)) && s.ownership !== 'agent');
  console.log(`\nCLOSING ${targets.length} space(s) matching "${PREFIX}*"（跳过 ${skipped.length} 个控制权不在我手里的）`);
  const results = [];
  for (const s of targets) results.push(await closeOne(s));
  for (const r of results) console.log(r.ok ? `✔ closed ${r.id} via ${r.how}` : `✘ failed ${r.id}: ${r.err}`);
  for (const s of skipped) console.log(`… skipped ${s.id} "${s.name}" ownership=${s.ownership}`);
  const after = await listTaskSpaces();
  console.log(`\nREMAIN ${after.length}`);
  for (const s of after) console.log(` - id=${s.id} name="${s.name}" ownership=${s.ownership}`);
} else if (MODE === 'open') {
  const found = spaces.find((s) => s.name === KEEP_NAME);
  if (found) {
    const t = await taskSpace(found.id);
    console.log('REUSED', found.id, KEEP_NAME, 'pages=', (await t.pages()).length);
  } else {
    const t = await taskSpace(KEEP_NAME);
    console.log('CREATED', t.spaceId, KEEP_NAME);
  }
}
