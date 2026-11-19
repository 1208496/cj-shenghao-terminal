// 已固化到全局 Skill：C:\Users\Administrator\.agents\skills\zero-api-card-test\scripts\noapi\run-suite.mjs
// 本文件只做转发，避免项目内与 Skill 内两份执行器各自演化、行为漂移。
// 需要改执行器时改 Skill 里那份，改完用本文件回归一次即可。

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
globalThis.__NOAPI_PROJECT_ROOT__ = path.resolve(HERE, '..', '..');

await import('file:///C:/Users/Administrator/.agents/skills/zero-api-card-test/scripts/noapi/run-suite.mjs');
