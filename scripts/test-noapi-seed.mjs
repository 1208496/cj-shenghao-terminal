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
  } else if (preset === 'many_cards') {
    // rc.40：叠卡/上限/展开取证用——11 张灰 + 5 张红 + 1 金 + 1 虹（含锁定与连胜各一张）。
    s.user.cashCents = 150000000;
    s.wheel.starPoints = 900;
    const mk = (itemId, rarity, points, extra = {}) => ({ itemId, source: 'CASINO_CARD', category: 'WISH_CARD', refId: `card_${rarity}`, rarity, obtainedDate: '2026-11-20', status: 'READY', currentPoints: points, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null, ...extra });
    s.inventory = {};
    for (let i = 0; i < 11; i++) s.inventory[`card_gray_${i + 1}`] = mk(`card_gray_${i + 1}`, 'gray', 20 + i, { serialNo: 100 + i });
    for (let i = 0; i < 5; i++) s.inventory[`card_red_${i + 1}`] = mk(`card_red_${i + 1}`, 'red', 60 + i * 10, { serialNo: 200 + i });
    s.inventory[`card_red_3`].locked = true;
    s.inventory[`card_gray_2`].winStreak = 3;
    s.inventory[`card_gold_1`] = mk('card_gold_1', 'gold', 200, { serialNo: 301, winStreak: 1 });
    s.inventory[`card_rainbow_1`] = mk('card_rainbow_1', 'rainbow', 800, { serialNo: 401 });
  } else if (preset === 'three_cards') {
    s.user.cashCents = 150000000; // 150 万
    s.wheel.starPoints = 600;
    // rc.38 B7：让 offstage 的 char_b 高好感，projection 才会生成 incomingPing。
    s.characters.char_b.affection = 80;
    s.inventory = {
      card_gray_1: { itemId: 'card_gray_1', source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_gray', rarity: 'gray', obtainedDate: '2026-11-20', status: 'READY', currentPoints: 20, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      card_red_1:  { itemId: 'card_red_1',  source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_red',  rarity: 'red',  obtainedDate: '2026-11-20', status: 'READY', currentPoints: 60, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      card_gold_1: { itemId: 'card_gold_1', source: 'CASINO_CARD', category: 'WISH_CARD', refId: 'card_gold', rarity: 'gold', obtainedDate: '2026-11-20', status: 'READY', currentPoints: 200, winStreak: 1, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      prize_1:     { itemId: 'prize_1',     source: 'WHEEL',       category: 'WHEEL_PRIZE', refId: 'w14',     rarity: 'red',  obtainedDate: '2026-11-20', status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      surreal_1:   { itemId: 'surreal_1',   source: 'SHOP',        category: 'SURREAL_ITEM', refId: 'it_perfume', rarity: 'red', obtainedDate: '2026-11-20', status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
    };
  } else if (preset === 'two_women') {
    // rc.38 A4：两位已收录人物同时在场，用来验「此刻」多女渲染与后宫张力前提。
    s.user.cashCents = 50000000;
    s.user.initialCashCents = 50000000;
    s.scene.presentCharacterIds = ['char_a', 'char_b'];
    s.characters.char_a.affection = 78; s.characters.char_a.corruption = 45;
    s.characters.char_b.affection = 82; s.characters.char_b.corruption = 60;
    s.wheel.starPoints = 300;
  } else if (preset === 'rc47_gate' || preset === 'rc47_gate_locked') {
    // rc.47：门槛用例 —— char_a 达标（好感 82）、char_b 未达标（48/25）；两人都已刻印/已佩戴，
    // 用来验「历史跌破门槛不自动摘除，但新增/覆盖被拦，抹除与摘下仍可」。
    s.user.cashCents = 50000000;
    s.user.initialCashCents = 50000000;
    s.scene.presentCharacterIds = ['char_a', 'char_b'];
    s.wheel.chokerUnlocked = preset !== 'rc47_gate_locked';
    s.wheel.toyLinkUnlocked = true;
    s.wheel.starPoints = 800;
    s.characters.char_a.affection = 82; s.characters.char_a.corruption = 10;
    s.characters.char_b.affection = 48; s.characters.char_b.corruption = 25;
    const mark = (p) => ({placement: p, patternEnabled: true, patternId: 'tally_zheng', patternScale: 'md', patternColor: 'crimson', textEnabled: true, text: '陆氏私有', textLayout: 'arc_wrap', textScale: 'md', textAngle: 0, font: 'script', textColor: 'gold', updatedDate: '2026-11-20'});
    s.characters.char_a.imprints = {priorScar: '', items: {nape: mark('nape')}};
    s.characters.char_b.imprints = {priorScar: '', items: {nape: mark('nape')}};
    s.characters.char_a.choker = {worn: true, styleId: 'rose_gold_lock', inscription: 'Eternal', wornDate: '2026-11-20'};
    s.characters.char_b.choker = {worn: true, styleId: 'obsidian_velvet', inscription: '', wornDate: '2026-11-20'};  } else if (preset.startsWith('device_shop') || preset === 'device_ready' || preset === 'device_bag_legacy') {
    // rc.54：私域三装置「购买 → 解锁 → 界面变 → 工坊可用」端到端用例专用档。
    // 星愿积分 12000（三件合计 8400，够连买）；两位已收录女性一达标一未达标。
    // device_shop：三解锁位全 false（验购买链）；device_ready：三件全 true、未佩戴未落印（验落库与刷新回读）。
    s.user.cashCents = 50000000;
    s.user.initialCashCents = 50000000;
    s.scene.presentCharacterIds = ['char_a', 'char_b'];
    s.wheel.starPoints = preset === 'device_bag_legacy' ? 500 : (preset === 'device_shop_bulk' ? 30000 : 12000);
    s.wheel.chokerUnlocked = preset === 'device_ready';
    s.wheel.imprintUnlocked = preset === 'device_ready';
    s.wheel.toyLinkUnlocked = preset === 'device_ready';
    s.characters.char_a.affection = 82; s.characters.char_a.corruption = 10;
    s.characters.char_b.affection = 48; s.characters.char_b.corruption = 25;
    if (preset === 'device_bag_legacy') {
      // 旧存档形态：背包里还留着 it_toylink 空壳奇物（rc.46 前的写法）。
      // 用来验「载入即迁移成解锁位」与「背包入口是否还存在」。
      s.inventory = {
        item_legacy_toy: { itemId: 'item_legacy_toy', source: 'SHOP', category: 'SURREAL_ITEM', refId: 'it_toylink', rarity: 'rainbow', obtainedDate: '2026-11-20', status: 'READY', currentPoints: null, winStreak: 0, scheduledAppointmentId: null, targetCharacterIds: [], assetId: null, usedDate: null },
      };
    }
  } else if (preset === 'choker_unlocked') {
    // rc.46：项圈工坊「已解锁」态，用来验 佩戴 → 档案胶囊联动（不碰玩家存档）
    s.user.cashCents = 50000000;
    s.user.initialCashCents = 50000000;
    s.wheel.chokerUnlocked = true;
    s.wheel.starPoints = 500;
    s.scene.presentCharacterIds = ['char_a', 'char_b'];
    s.characters.char_a.affection = 70; s.characters.char_b.affection = 55;
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
  } else if (preset === 'pack_crossperiod') {
    // rc.55 / B-05：昨天买满 2 个付费包、昨天也领过免费包。今天进界面应当能重新领免费包，
    // 领完后付费计数必须归零，否则下一次报价会把昨天的 2 次当成今天的，直接报「今日已满」。
    s.world.date = '2026-01-05';
    s.user.cashCents = 50000000;
    s.wheel.lowPackTodayDate = '2026-01-04';
    s.wheel.lowPackTodayFreeUsed = true;
    s.wheel.lowPackTodayPaid = 2;
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
    throw new Error(`未知 preset: ${preset}（可选：empty_bag | three_cards | two_women | choker_unlocked | rc47_gate | rc47_gate_locked | device_shop | device_bag_legacy | wish_unlocked | high_wealth | max_pity）`);
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
  // --unique：每次播种用一个新的聊天名（后缀取时间戳）。
  // 用途：同一 preset 反复跑同一批用例时，卡内按 branch（characterId:chatId）缓存的
  // 操作日志（host.js loadOpsLog）不会与上一次运行的日志撞键；否则状态已重置、
  // 日志仍在，会被 applyMissingPlayerOps 重放回已购买/已佩戴的状态。
  const tag = args.unique ? '__' + Date.now().toString(36) : '';
  const chatName = `${TEST_PREFIX}${preset}${tag}.jsonl`;
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
