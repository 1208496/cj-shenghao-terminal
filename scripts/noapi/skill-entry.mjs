// 项目侧入口：告诉 Skill 里的通用执行器"项目根在哪"，然后直接跑套件。
//
// 为什么需要这一层：`ego-browser nodejs -e` 里的 process.cwd() 是 ego 安装目录，
// 不是你的项目目录；env 和 argv 也传不进去。所以用 import.meta.url 反推项目根。
//
// 用法（在项目根执行）：
//   ego-browser nodejs -e "await import('file:///E:/项目/scripts/noapi/skill-entry.mjs')"
//
// 换成你自己的 Skill 安装路径与项目结构即可。

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
globalThis.__NOAPI_PROJECT_ROOT__ = path.resolve(HERE, '..', '..');

const SKILL = process.env.NOAPI_SKILL_DIR
  || 'file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/run-suite.mjs';

const which = globalThis.__NOAPI_ENTRY__ || 'run-suite';
await import(which === 'discover'
  ? SKILL.replace('run-suite.mjs', 'discover.mjs')
  : SKILL);
