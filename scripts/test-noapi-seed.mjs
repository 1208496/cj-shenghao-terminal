// scripts/test-noapi-seed.mjs
// 用法：
//   生成测试聊天（默认隔离副本，不动原聊天）：
//     node scripts/test-noapi-seed.mjs --char 神豪终端4 --preset three_cards
//   覆盖指定已有聊天（先自动备份）：
//     node scripts/test-noapi-seed.mjs --char 神豪终端4 --preset max_pity --target "某聊天.jsonl"
//   一键还原 / 清理所有测试聊天：
//     node scripts/test-noapi-seed.mjs --restore
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { createSchema } from '../src/runtime/schema.js';
import { completeInitialState } from '../src/runtime/settlement.js';

const ST_ROOT = path.resolve('E:/Ajiuguanagentceshi/SillyTavern');
const CHATS_ROOT = path.join(ST_ROOT, 'data', 'default-user', 'chats');
const BACKUP_ROOT = path.resolve('E:/SHZDCHOSSS/.work/test-noapi-backups');
const MANIFEST_PATH = path.join(BACKUP_ROOT, 'manifest.json');
const TEST_PREFIX = '__NOAPI_TEST_';
const DEFAULT_BOOK = '神豪终端 · v2.0.0-rc.36';

function assertSafePath(p) {
  const abs = path.resolve(p);
  if (!abs.toLowerCase().startsWith(ST_ROOT.toLowerCase())) {
    throw new Error(`SAFETY_BLOCK: 路径越界，只允许操作 8001 实例目录：${abs}`);
  }
  if (/8000/.test(abs)) {
    throw new Error(`SAFETY_BLOCK: 禁止任何涉及 8000 的路径：${abs}`);
  }
  return abs;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const name = k.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[name] = true;
    else { out[name] = next; i++; }
  }
  return out;
}

function buildPresetState(preset, initKey) {
  const schemas = createSchema(z);
  const base = {
    schemaVersion: 3,
    meta: { initialized: true, initKey, branchKey: 'test:noapi', revision: 1, sourceAnchor: null },
    user: {
      id: 'USER', name: '陆时行', age: 26, beautyScore: 82, gender: '男',
      appearance: '短发利落，眉眼沉稳', occupation: '独立投资人',
      background: '在云澜市打拼三年的青年投资人', city: '云澜市',
      location: '江城区·翠湖公寓客厅', workLifeDescription: '平时居家看盘，周末健身看书',
      cashCents: 20000000, initialCashCents: 20000000,
      currentClothes: '深灰居家卫衣与长裤', currentPose: '靠在沙发上看手机', currentAction: '查看终端面板',
      abilities: [],
    },
    world: { date: '2026-11-20', time: '10:00', weather: '晴', timeZone: 'Asia/Shanghai' },
    scene: {
      sceneId: 'scene_noapi_01', location: '江城区·翠湖公寓客厅', timeHint: '上午',
      presentCharacterIds: ['char_a'], temporaryActors: [], sceneRevision: 1,
    },
    characters: {
      char_a: { id: 'char_a', name: '沈清弦', age: 24, beautyScore: 88, affection: 45, relationshipLabel: '合租室友', occupation: '建筑设计师' },
      char_b: { id: 'char_b', name: '陆晚晴', age: 25, beautyScore: 91, affection: 62, relationshipLabel: '学姐', occupation: '艺术策展人' },
    },
    identityMap: {}, hiddenTemporary: {},
    finance: { ledger: {}, assets: {} },
    rewardEvents: {}, withdrawals: {}, recoveries: {},
    operationHistory: {}, notifications: {},
    facts: { __testMarker: { noapi: true, preset, createdAt: new Date().toISOString() } },
    calendar: { appointments: {} },
    pendingEvents: [], _context: '',
    wheel: {}, inventory: {},
  };

  let s = schemas.state.parse(completeInitialState(base, { startDate: '2026-11-20', startTime: '10:00' }));

  if (preset === 'empty_bag') {
    // 20 万起步、未提现、空背包、星愿圣盘锁定、命运轮盘免费可用
    s.user.cashCents = 20000000;
    s.user.initialCashCents = 20000000;
  } else if (preset === 'three_cards') {
    s.user.cashCents = 150000000; // 150 万
    s.wheel.starPoints = 600;
    s.inventory = {
      card_gray_1: { itemId: 'card_gray_1', source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_gray', rarity: 'gray', obtainedDate: '2026-11-20', status: 'READY', currentPoints: 20, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      card_red_1:  { itemId: 'card_red_1',  source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_red',  rarity: 'red',  obtainedDate: '2026-11-20', status: 'READY', currentPoints: 60, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      card_gold_1: { itemId: 'card_gold_1', source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_gold', rarity: 'gold', obtainedDate: '2026-11-20', status: 'READY', currentPoints: 200, winStreak: 1, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      prize_1:     { itemId: 'prize_1',     source: 'WHEEL',       category: 'WHEEL_PRIZE', refId: 'w14',     rarity: 'red',  obtainedDate: '2026-11-20', status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
    };
  } else if (preset === 'wish_unlocked') {
    s.user.cashCents = 250000000; // 250 万 >= 100 万解锁星愿圣盘
    s.wheel.starPoints = 300;
    s.wheel.wishWeekKey = '2026-W47';
    s.wheel.wishWeekFreeUsed = false;
    s.wheel.wishTodayDate = '2026-11-20';
    s.wheel.wishTodaySpins = 0;
  } else if (preset === 'high_wealth') {
    s.user.cashCents = 5000000000; // 5000 万
    s.user.abilities = [
      { abilityId: 'ab_voice', level: 2, obtainedDate: '2026-11-19' },
      { abilityId: 'ab_gaze',  level: 1, obtainedDate: '2026-11-19' },
    ];
    s.finance.assets = {
      asset_house_1: { assetId: 'asset_house_1', kind: 'HOUSE', name: '云澜湾江景大平层', ownerId: 'USER', bookValueCents: 3800000000, basisCents: 3800000000, status: 'OWNED', acquisitionEventId: 'init', acquisitionIsInitial: true, description: '320㎡南向一线江景平层，带双车位', locationNote: '东岸滨江', ownershipNote: '本人全额所有' },
      asset_car_1:   { assetId: 'asset_car_1',   kind: 'CAR',   name: '保时捷 911 GT3',   ownerId: 'USER', bookValueCents: 260000000,  basisCents: 260000000,  status: 'OWNED', acquisitionEventId: 'init', acquisitionIsInitial: true, description: '哑光黑选装碳陶刹车', locationNote: '地下车库 B2', ownershipNote: '本人全额所有' },
    };
    s.wheel.starPoints = 1200;
  } else if (preset === 'max_pity') {
    s.user.cashCents = 500000000; // 500 万
    s.wheel.starPoints = 4000;
    // 各保底计数器压到 schema 上限（rc.37 收紧了卡包保底：cardPityRed ≤3、cardPityGold ≤9）
    s.wheel.pityRed = 9;
    s.wheel.pityGold = 29;
    s.wheel.pityRainbow = 59;
    s.wheel.cardPityRed = 3;
    s.wheel.cardPityGold = 9;
    s.wheel.lowPackPityRed = 4;
    s.wheel.lastFreeDate = '2026-11-20'; // 跳过免费，便于测付费/积分抽保底
    s.wheel.wishWeekKey = '2026-W47';
    s.wheel.wishWeekFreeUsed = false;
  } else {
    throw new Error(`未知 preset: ${preset}（可选：empty_bag | three_cards | wish_unlocked | high_wealth | max_pity）`);
  }

  // 账本恒等式兜底（2026-11-20 新增）：
  // assertEconomy 要求 cash === initialCash + (income − expense)（engine.js:1063）。
  // 预置是人为设定的起始现金，若只改 cashCents 不改 initialCashCents，任何提交类操作
  // 都会被 replayPlayerCommand → assertState 以 LEDGER_MISMATCH 拒掉，
  // 表现成"点了没反应"（rc.37 轮盘 GO 卡点的真因）。
  const ledgerTotals = Object.values(s.finance.ledger || {}).reduce((a, e) => {
    if (e.direction === 'IN') a.income += e.amountCents;
    else if (e.direction === 'OUT') a.expense += e.amountCents;
    return a;
  }, { income: 0, expense: 0 });
  s.user.initialCashCents = s.user.cashCents - (ledgerTotals.income - ledgerTotals.expense);

  return schemas.state.parse(s);
}

function makeChatLines({ charName, bookName, state, withSwipeFloor }) {
  const initBooks = { [bookName]: [] };
  const l0 = {
    user_name: state.user.name,
    character_name: charName,
    chat_metadata: { integrity: crypto.randomUUID(), variables: {}, extensions: {} },
  };
  const l1 = {
    name: charName, is_user: false, is_system: false,
    send_date: '2026-11-20 09:59:00',
    mes: '【测试开场占位】\n\n<CJ_SHENGHAO_OPENING/>',
    swipe_id: 0, swipes: ['【测试开场占位】\n\n<CJ_SHENGHAO_OPENING/>'],
    variables: [{ initialized_lorebooks: initBooks, stat_data: { shenghao: null }, schema: '没有用别管这个' }],
  };
  const l2 = {
    name: state.user.name, is_user: true, is_system: false,
    send_date: '2026-11-20 10:00:00',
    mes: `【零API测试预置锚点 · ${state.facts.__testMarker.preset}】`,
    variables: [{ initialized_lorebooks: initBooks, stat_data: { shenghao: state }, schema: '没有用别管这个' }],
  };
  const lines = [l0, l1, l2];
  if (withSwipeFloor) {
    const s2 = structuredClone(state);
    s2.meta.revision = state.meta.revision + 1;
    s2.meta.sourceAnchor = { branchKey: 'test:noapi', messageId: 2, swipeId: 0, fingerprint: 'noapi_floor2_s0' };
    const s2Alt = structuredClone(state);
    s2Alt.meta.revision = state.meta.revision + 1;
    s2Alt.meta.sourceAnchor = { branchKey: 'test:noapi', messageId: 2, swipeId: 1, fingerprint: 'noapi_floor2_s1' };
    lines.push({
      name: charName, is_user: false, is_system: false,
      send_date: '2026-11-20 10:01:00',
      mes: '（测试回归用 2 楼 · 分支 A）',
      swipe_id: 0,
      swipes: ['（测试回归用 2 楼 · 分支 A）', '（测试回归用 2 楼 · 分支 B）'],
      variables: [
        { initialized_lorebooks: initBooks, stat_data: { shenghao: s2 }, schema: '没有用别管这个' },
        { initialized_lorebooks: initBooks, stat_data: { shenghao: s2Alt }, schema: '没有用别管这个' },
      ],
    });
  }
  return lines.map((x) => JSON.stringify(x)).join('\n') + '\n';
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { records: [] };
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}
function saveManifest(m) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2), 'utf8');
}

function restoreAll() {
  const m = readManifest();
  for (const rec of [...m.records].reverse()) {
    assertSafePath(rec.targetFile);
    if (rec.kind === 'created') {
      if (fs.existsSync(rec.targetFile)) fs.unlinkSync(rec.targetFile);
      console.log('[RESTORE] 已删除测试聊天:', rec.targetFile);
    } else if (rec.kind === 'overwritten' && rec.backupFile && fs.existsSync(rec.backupFile)) {
      fs.copyFileSync(rec.backupFile, rec.targetFile);
      console.log('[RESTORE] 已还原原聊天:', rec.targetFile);
    }
  }
  saveManifest({ records: [] });
  console.log('[RESTORE_OK] 8001 测试现场已全部清场还原。');
}

const args = parseArgs(process.argv.slice(2));
if (args.restore) {
  restoreAll();
  process.exit(0);
}

const charFolder = args.char || '神豪终端4';
const preset = args.preset || 'empty_bag';
const bookName = args.book || DEFAULT_BOOK;
const withSwipeFloor = Boolean(args['with-swipe-floor']);
const charDir = assertSafePath(path.join(CHATS_ROOT, charFolder));
fs.mkdirSync(charDir, { recursive: true });

const initKey = `noapi_test_${preset}_${Date.now()}`;
const state = buildPresetState(preset, initKey);
const content = makeChatLines({ charName: charFolder.replace(/\d+$/, ''), bookName, state, withSwipeFloor });

let targetFile;
const m = readManifest();
if (args.target) {
  targetFile = assertSafePath(path.join(charDir, args.target));
  if (fs.existsSync(targetFile)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
    const backupFile = path.join(BACKUP_ROOT, `${Date.now()}-${path.basename(targetFile)}`);
    fs.copyFileSync(targetFile, backupFile);
    m.records.push({ kind: 'overwritten', targetFile, backupFile, at: new Date().toISOString() });
  } else {
    m.records.push({ kind: 'created', targetFile, at: new Date().toISOString() });
  }
} else {
  const chatName = `${TEST_PREFIX}${preset}.jsonl`;
  targetFile = assertSafePath(path.join(charDir, chatName));
  if (!m.records.some((r) => r.targetFile === targetFile)) {
    m.records.push({ kind: 'created', targetFile, at: new Date().toISOString() });
  }
}

fs.writeFileSync(targetFile, content, 'utf8');
saveManifest(m);
const result = {
  ok: true,
  preset,
  initKey,
  chatFile: path.basename(targetFile),
  chatId: path.basename(targetFile, '.jsonl'),
  targetFile,
};
if (args.out) fs.writeFileSync(path.resolve(String(args.out)), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
