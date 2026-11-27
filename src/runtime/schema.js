export function createSchema(z) {
  const text=z.string().max(1500),short=z.string().max(150),id=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).refine(v=>!['__proto__','constructor','prototype'].includes(v));
  const money=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},'日期不存在');
  const profile=z.object(Object.fromEntries(['identity','appearance','body','personality','habits','style','family','career','social'].map(k=>[k,z.string().trim().min(1).max(750)])));
  const anchor=z.object({branchKey:z.string(),messageId:z.number().int(),swipeId:z.number().int(),fingerprint:z.string()});
  const beauty=z.number().int().min(1).max(100);
  const narrative=max=>z.string().transform(v=>v.trim().slice(0,max));
  const affection=z.preprocess(v=>{const n=typeof v==='number'||typeof v==='string'&&v.trim()?Number(v):NaN;return Number.isSafeInteger(n)?Math.max(0,Math.min(100,n)):v;},z.number().int().min(0).max(100));
  const corruption=z.preprocess(v=>{const n=typeof v==='number'||typeof v==='string'&&v.trim()?Number(v):NaN;return Number.isSafeInteger(n)?Math.max(0,Math.min(100,n)):0;},z.number().int().min(0).max(100)).default(0);
  // rc.46：三装置（誓约项圈 / 专属印记）的枚举与容器。全部由脚本独占写入，模型只读。
  const chokerStyleEnum=z.enum(['obsidian_velvet','rose_gold_lock','crimson_thorn','silver_studs','pearl_strand','satin_ribbon','minimal_torc']);
  const imprintPatternEnum=z.enum(['succubus_heart','tally_zheng','thorn_crown','lunar_sigil','abyss_butterfly','rose_vine','obsidian_chain','astral_crest','coiled_serpent','chain_cross','rose_window','fallen_wings','astrolabe_ring','bound_heart','spade_thorns']);
  const imprintPlacementEnum=z.enum(['lower_abdomen','left_breast','right_breast','lower_back','left_glute','right_glute','clavicle','nape','scapula','left_thigh_inner','right_thigh_inner','left_thigh_outer','right_thigh_outer','left_calf','right_calf','left_arm','right_arm','left_wrist','right_wrist']);
  const imprintScaleEnum=z.enum(['sm','md','lg']);
  const imprintTextLayoutEnum=z.enum(['arc_wrap','above','below','side_stamp']);
  const imprintFontEnum=z.enum(['script','gothic','seal']);
  const imprintColorEnum=z.enum(['crimson','gold','obsidian','violet']);
  const pendingAbilityUse=z.object({
    abilityId:short,
    usedRevision:z.number().int().nonnegative().nullable().default(null),
    usedFloorId:z.number().int().nonnegative().nullable().default(null),
    usedSwipeId:z.number().int().nonnegative().nullable().default(null),
    targetCharacterId:id.nullable().default(null),
    usedDraftText:z.string().max(2000).nullable().default(null)
  });
  const characterChoker=z.object({worn:z.boolean().default(false),styleId:chokerStyleEnum.default('obsidian_velvet'),inscription:narrative(24).default(''),wornDate:date.nullable().default(null)});
  const imprintEntry=z.object({
    placement:imprintPlacementEnum,
    patternEnabled:z.boolean().default(true),
    patternId:imprintPatternEnum.default('succubus_heart'),
    patternScale:imprintScaleEnum.default('md'),
    patternColor:imprintColorEnum.default('crimson'),
    textEnabled:z.boolean().default(true),
    text:narrative(24).default(''),
    textLayout:imprintTextLayoutEnum.default('arc_wrap'),
    textScale:imprintScaleEnum.default('md'),
    textAngle:z.number().int().min(-30).max(30).default(0),
    font:imprintFontEnum.default('script'),
    textColor:imprintColorEnum.default('gold'),
    updatedDate:date.nullable().default(null)
  }).superRefine((v,ctx)=>{
    if(!v.patternEnabled&&!v.textEnabled)ctx.addIssue({code:'custom',message:'IMPRINT_INVALID'});
    if(v.textEnabled&&!v.text.trim())ctx.addIssue({code:'custom',message:'IMPRINT_INVALID'});
  });
  const characterImprints=z.object({
    priorScar:narrative(150).default(''),
    // rc.46 修复：z.record(enum, …) 在 zod 4 里会把枚举键当成「必须齐备」，导致只刻 1 处时整卡校验报
    // 「其余 18 处 expected object, received undefined」。改为 partialRecord，键名仍受枚举约束。
    items:z.partialRecord(imprintPlacementEnum,imprintEntry).default({})
  }).superRefine((v,ctx)=>{
    const entries=Object.entries(v.items||{});
    if(entries.length>19)ctx.addIssue({code:'custom',message:'IMPRINT_LIMIT_REACHED'});
    for(const [key,item] of entries)if(item.placement!==key)ctx.addIssue({code:'custom',message:'IMPRINT_DUPLICATE_PLACEMENT'});
  });
  const character=z.object({id,name:z.string().min(1).max(50),age:z.number().int().min(18).max(80),beautyScore:beauty.nullable(),aliases:z.array(short).max(20).default([]),occupation:short.default(''),
    affection,corruption,relationshipLabel:narrative(12).pipe(z.string().min(1)),relationshipNotes:narrative(1500).default(''),relationshipEvidence:text.default(''),
    personalityTags:z.array(z.string().trim().min(1).max(12)).max(6).default([]),appearance:z.string().max(500).default(''),body:z.string().max(500).default(''),weightKg:z.number().min(25).max(250).nullable().default(null),heightCm:z.number().min(100).max(230).nullable().default(null),bustCm:z.number().min(40).max(200).nullable().default(null),waistCm:z.number().min(30).max(200).nullable().default(null),hipCm:z.number().min(40).max(200).nullable().default(null),shoeSizeEu:z.number().min(25).max(55).nullable().default(null),knownFacts:z.preprocess(v=>Array.isArray(v)?v.filter(x=>typeof x==='string').join('；'):v,narrative(1200)).default(''),knownFactsEvidence:text.default(''),profileFixed:profile.nullable().default(null),profileLocked:z.boolean().default(false),contactConfirmed:z.boolean().default(false),firstContactEvidence:text.default(''),
    cupSize:z.string().trim().max(8).default(''),addressing:narrative(20).default(''),impression:narrative(300).default(''),starred:z.boolean().default(false),
    trackingState:z.enum(['RECORDED','HIDDEN']).default('RECORDED'),
    currentClothes:narrative(1500).default(''),currentPose:narrative(1500).default(''),currentAction:narrative(1500).default(''),currentExpression:narrative(1500).default(''),currentMood:narrative(1500).default(''),currentCondition:narrative(1500).default(''),currentItems:narrative(1500).default(''),
    currentThought:narrative(300).default(''),lastSexSceneRevision:z.number().int().nonnegative().default(0),arousal:z.preprocess(v=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):0;},z.number().int().min(0).max(100)).default(0),offscreen:narrative(200).default(''),recentGoal:narrative(200).default(''),longTermDream:narrative(200).default(''),hiddenScar:narrative(300).default(''),
    // Private records stay two flat sub-objects so JSONPatch can address
    // /characters/<id>/physiology/cycle directly, and unlockedTags accepts
    // either a tag array or a separated string from the model.
    // rc.24: the four private panels read these flat sub-objects directly.
    physiology:z.object({cycle:narrative(40).default(''),pregnancy:narrative(40).default('未孕'),virgin:z.boolean().nullable().default(null),hymenNote:narrative(80).default(''),chestDetail:narrative(200).default(''),vaginaLook:narrative(200).default(''),vaginaState:narrative(200).default(''),pubicHair:narrative(120).default(''),anusLook:narrative(150).default(''),anusState:narrative(150).default(''),bodyScent:narrative(120).default(''),tattooScar:narrative(150).default(''),traits:narrative(400).default('')}).prefault({}),
    outfit:z.object({style:narrative(100).default(''),complexion:narrative(120).default(''),top:narrative(200).default(''),bottom:narrative(200).default(''),lingerie:narrative(200).default(''),socks:narrative(150).default(''),shoes:narrative(150).default(''),makeup:narrative(150).default(''),accessories:narrative(150).default('')}).prefault({}),
    intimacy:z.object({attitude:narrative(60).default(''),abilityComment:narrative(200).default(''),partnersCount:z.number().int().nonnegative().default(0),sexPartnerCount:z.number().int().nonnegative().default(0),firstTime:narrative(150).default(''),experience:narrative(200).default(''),fetishes:narrative(200).default(''),unlockedTags:z.preprocess(v=>{const list=Array.isArray(v)?v:(typeof v==='string'&&v.trim()?v.split(/[、,，/／;；·|]/):[]);const seen=new Set();const out=[];for(const item of list){const tag=String(item??'').trim();if(!tag||seen.has(tag))continue;seen.add(tag);out.push(tag);}return out.slice(-24);},z.array(z.string().trim().min(1).max(16)).max(24)).default([]),withUserCount:z.number().int().nonnegative().default(0),lastIntimate:narrative(120).default(''),lastMasturbation:narrative(120).default('')}).prefault({}),
    limits:z.object({scaleLevel:z.number().int().min(0).max(6).default(0),weakness:narrative(200).default(''),worry:narrative(200).default(''),exposure:z.number().int().min(0).max(3).default(0),foreplay:z.number().int().min(0).max(3).default(0),intercourse:z.number().int().min(0).max(3).default(0),cosplay:z.number().int().min(0).max(3).default(0),creampie:z.number().int().min(0).max(3).default(0),anal:z.number().int().min(0).max(3).default(0),publicPlay:z.number().int().min(0).max(3).default(0),multi:z.number().int().min(0).max(3).default(0)}).prefault({}),
    // rc.46：个体装置（真值源在角色身上，脚本独占写）
    choker:characterChoker.nullable().default(null),
    imprints:characterImprints.nullable().default(null),
    avatarRef:short.nullable().default(null),portraitRef:short.nullable().default(null)});
  const temp=z.object({tempId:id,name:short,description:text});
  const appointment=z.object({id,title:z.string().min(1).max(80),date,time:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    location:short,participants:z.array(id).max(30).default([]),status:z.enum(['PLANNED','CANCELLED','COMPLETED']).default('PLANNED'),notes:text.default(''),
    // rc.34：这张日程是不是从背包里的轮盘奖券排进来的；空值表示玩家手写约定。
    sourceItemId:id.nullable().default(null),prizeId:short.nullable().default(null)});
  // rc.34 / rc.35 / rc.36：三盘轮盘、星愿积分、背包、主角异能。全部由脚本独占写入，模型无权修改。
  const wheelState=z.object({
    // 一、命运轮盘（玩法轮盘）：便宜、高频
    lastFreeDate:date.nullable().default(null),
    todayPaidDate:date.nullable().default(null),
    todayPaidSpins:z.number().int().min(0).max(8).default(0),
    totalSpins:z.number().int().nonnegative().default(0),
    pityRed:z.number().int().min(0).max(9).default(0),
    pityGold:z.number().int().min(0).max(29).default(0),
    pityRainbow:z.number().int().min(0).max(59).default(0),
    discoveredPrizeIds:z.array(short).max(53).default([]),
    // 二、星愿圣盘：限制多、要贵（取代旧 lastFreeCardDate）
    wishWeekKey:z.string().max(12).default(''),
    wishWeekFreeUsed:z.boolean().default(false),
    wishWeekPaidSpins:z.number().int().min(0).max(5).default(0),
    wishTodayDate:date.nullable().default(null),
    wishTodaySpins:z.number().int().min(0).max(2).default(0),
    totalCardsDrawn:z.number().int().nonnegative().default(0),
    // rc.37：保底计数器口径改按「包」（每包 3 张）
    cardPityRed:z.number().int().min(0).max(3).default(0),
    cardPityGold:z.number().int().min(0).max(9).default(0),
    // rc.37 低阶星尘卡包：开局即开，每日 1 包免费 + 2 包现金
    lowPackTodayDate:date.nullable().default(null),
    lowPackTodayFreeUsed:z.boolean().default(false),
    lowPackTodayPaid:z.number().int().min(0).max(2).default(0),
    lowPackPityRed:z.number().int().min(0).max(4).default(0),
    // rc.37 一卡一印：全局铸造序号 + 12 款卡面图鉴
    cardSerialSeq:z.number().int().nonnegative().default(0),
    discoveredCardCodes:z.preprocess(v=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'))].slice(0,12):[],z.array(short).max(12).default([])),
    // 三、暗夜赌场
    casinoRound:z.number().int().nonnegative().default(0),
    casinoTotalWins:z.number().int().nonnegative().default(0),
    casinoTotalLosses:z.number().int().nonnegative().default(0),
    casinoBestWinPoints:z.number().int().nonnegative().default(0),
    // 公共：货币、解锁、商城
    toyLinkUnlocked:z.boolean().default(false),
    chokerUnlocked:z.boolean().default(false),
    // rc.50：专属私密印记改为商城付费解锁（YG 2026-11-23 定 D-2 / 3000 星愿积分）
    imprintUnlocked:z.boolean().default(false),
    unlockedSecretPages:z.array(id).max(100).default([]),
    starPoints:z.number().int().nonnegative().default(0),
    shopHistory:z.array(z.object({purchaseId:id,catalogId:short,costPoints:z.number().int().nonnegative(),date}).passthrough()).max(200).default([]),
    // rc.46：补齐异能待撤锚点声明 —— 此前漏声明，Zod 默认 strip 会在落库时整组剔除，
    // 导致「我的」页永远读不到 pendingAbilityUses、异能发动后没有撤销入口。
    pendingAbilityUses:z.record(id,pendingAbilityUse).default({})
  }).prefault({});
  const inventoryItem=z.object({
    itemId:id,
    source:z.enum(['WHEEL','CASINO_CARD','SHOP']).default('WHEEL'),
    category:z.enum(['WHEEL_PRIZE','WISH_CARD','SURREAL_ITEM']).default('WHEEL_PRIZE'),
    refId:short,
    rarity:z.enum(['gray','red','gold','rainbow']),
    obtainedDate:date,
    status:z.enum(['READY','SCHEDULED','USED']).default('READY'),
    currentPoints:z.number().int().nonnegative().nullable().default(null),
    winStreak:z.number().int().nonnegative().default(0),
    scheduledAppointmentId:id.nullable().default(null),
    targetCharacterIds:z.array(id).max(5).default([]),
    assetId:id.nullable().default(null),
    usedDate:date.nullable().default(null),
    // rc.37：一卡一印。卡面代号、产出池、铸造序号与珍藏锁。
    cardCode:short.nullable().default(null),
    poolTier:z.enum(['low','high']).nullable().default(null),
    serialNo:z.number().int().nonnegative().default(0),
    locked:z.boolean().default(false),
    // rc.43：待撤锚点 —— 正文生成前可撤销，生成后自动失效。
    usedRevision:z.number().int().nonnegative().nullable().default(null),
    usedFloorId:z.number().int().nonnegative().nullable().default(null),
    usedSwipeId:z.number().int().nonnegative().nullable().default(null),
    pendingUndo:z.boolean().default(false),
    undoSnapshot:z.record(z.string(),z.any()).nullable().default(null),
    usedDraftText:z.string().max(2000).nullable().default(null),
    wishKind:z.enum(['ASSET','ROMANCE','POWER','CUSTOM']).nullable().default(null),
    wishText:z.string().max(300).nullable().default(null)
  });
  // rc.42：异能不再升级 —— 一次性解锁、效果恒定，没有 level。
  const userAbility=z.object({abilityId:short,obtainedDate:date});
  const world=z.object({date,time:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),weather:short.default('晴'),timeZone:z.literal('Asia/Shanghai').default('Asia/Shanghai')});
  // rc.25: seven asset classes, with aliases and Chinese wording mapped onto
  // the enum so old saves and model shortcuts still parse.
  const assetKindEnum=z.preprocess(v=>{
    const raw=String(v||'').trim().toUpperCase();
    if(['HOUSE','CAR','BUSINESS','YACHT_JET','LUXURY','COLLECTIBLE','OTHER'].includes(raw))return raw;
    if(/房|宅|别墅|平层|公寓|庄园|PROPERTY/.test(raw))return 'HOUSE';
    if(/车|跑车|座驾|轿车|SUV|MPV|VEHICLE|AUTO/.test(raw))return 'CAR';
    if(/商铺|店铺|公司|股权|产业|企业|会所|酒庄|工厂|工作室|集团|基金|矿|院线|SHOP|COMPANY|EQUITY|STOCK|STORE/.test(raw))return 'BUSINESS';
    if(/游艇|专机|飞机|直升机|湾流|YACHT|JET|BOAT|PLANE|AIRCRAFT/.test(raw))return 'YACHT_JET';
    if(/表|腕表|珠宝|钻|翡翠|包|高定|首饰|WATCH|JEWELRY|BAG/.test(raw))return 'LUXURY';
    if(/画|古董|藏品|艺术|瓷器|字画|雕塑|名酒|红酒|威士忌|ART|ANTIQUE|PAINTING|WINE|COLLECTION/.test(raw))return 'COLLECTIBLE';
    return 'OTHER';
  },z.enum(['HOUSE','CAR','BUSINESS','YACHT_JET','LUXURY','COLLECTIBLE','OTHER']));
  const asset=z.object({assetId:id,kind:assetKindEnum,name:short,ownerId:z.string(),bookValueCents:money,basisCents:money.nullable(),status:z.enum(['OWNED','TRANSFERRED','SOLD','RETURNED']),acquisitionEventId:z.string(),acquisitionIsInitial:z.boolean(),description:z.string().min(1).max(800),locationNote:text.default(''),ownershipNote:text.default(''),valuationPending:z.boolean().default(false),valuationTier:z.enum(['ENTRY','MID','HIGH','TOP']).nullable().default(null),isCustom:z.boolean().default(false)}).passthrough();
  const ledger=z.object({entryId:z.string(),eventId:z.string(),kind:z.string(),direction:z.enum(['IN','OUT','NONE']),amountCents:money,payerId:z.string(),beneficiaryCharacterId:z.string().nullable(),allocations:z.array(z.object({personRef:id,amountCents:money})),assetId:z.string().nullable(),status:z.string(),refundOf:z.string().nullable(),sourceAnchor:anchor,memo:text,itemName:short,merchantOrPlace:short,recordedAtScene:short,createdRevision:z.number().int()}).passthrough();
  const withdrawal=z.object({withdrawalId:id,characterId:id,status:z.literal('COMMITTED'),basePoolCents:money,spendCents:money,criticalCents:money,preCashCents:money,tierId:short,tierLabel:short,multiplier:z.union([z.literal(10),z.literal(8),z.literal(5),z.literal(3),z.literal(2),z.literal(1)]),grossCents:money,paidCents:money,recoveryCents:money,allocations:z.record(z.string(),money),recoveryAllocations:z.record(z.string(),money),sourceAnchor:anchor,recordedAtScene:short});
  const recovery=z.object({recoveryId:z.string(),characterId:id,rewardEventId:z.string(),withdrawalId:id,refundLedgerId:z.string(),refundedBaseCents:money,amountCents:money,settledCents:money,sourceAnchor:anchor});
  const state=z.object({schemaVersion:z.literal(3),meta:z.object({initialized:z.literal(true),initKey:id,branchKey:z.string(),revision:z.number().int().nonnegative(),sourceAnchor:anchor.nullable()}).passthrough(),
    user:z.object({id:z.literal('USER'),name:z.string().min(1).max(50),age:z.number().int().min(18).max(80),beautyScore:beauty,prowessScore:beauty.default(70),
      sexualAbility:z.object({stamina:beauty.default(70),hardness:beauty.default(70),technique:beauty.default(70),volume:beauty.default(70)}).prefault({}),
      genitals:z.object({length:short.default('18cm'),girth:short.default('4.8cm'),traits:narrative(300).default('形态饱满挺拔，青筋分明，热度惊人')}).prefault({}),
      gender:short,appearance:text,body:text.default(''),heightCm:z.number().min(140).max(230).nullable().default(null),weightKg:z.number().min(35).max(200).nullable().default(null),shoeSizeEu:z.number().min(34).max(52).nullable().default(null),occupation:short,background:text,city:short,location:short,workLifeDescription:text,cashCents:money,initialCashCents:money,currentClothes:text,currentPose:text,currentAction:text,abilities:z.array(userAbility).max(30).default([])}).passthrough(),
    world,scene:z.object({sceneId:id,location:short,timeHint:short,presentCharacterIds:z.array(id).max(100),temporaryActors:z.array(temp).max(30),sceneRevision:z.number().int().nonnegative()}),
    characters:z.record(id,character),identityMap:z.record(z.string(),z.string()),hiddenTemporary:z.record(z.string(),z.union([temp,z.boolean()])),
    finance:z.object({ledger:z.record(z.string(),ledger),assets:z.record(id,asset),retiredBasisCents:money.default(0),customAssetDate:date.nullable().default(null),customAssetCount:z.number().int().min(0).default(0)}),rewardEvents:z.record(z.string(),z.object({eventId:z.string(),characterId:id,eventType:z.enum(['SPEND_CREDIT','CRITICAL']),cashbackCents:money,refundedCents:money,withdrawalId:id.nullable(),claimedCents:money,valid:z.boolean()}).passthrough()),withdrawals:z.record(id,withdrawal),recoveries:z.record(z.string(),recovery),
    operationHistory:z.record(z.string(),z.object({type:z.string(),status:z.enum(['COMMITTED','FAILED','PENDING']),revision:z.number().int()}).passthrough()),
    notifications:z.record(z.string(),z.object({notificationId:z.string(),relatedEventId:z.string(),type:z.string()}).passthrough()),facts:z.record(z.string(),z.unknown()),
    // Transport only: event validation belongs to settlement, one item at a time.
    calendar:z.object({appointments:z.record(id,appointment)}),pendingEvents:z.array(z.unknown()).max(40).default([]),_context:z.string().default(''),
    // rc.34 / rc.35：脚本独占的轮盘状态与背包（模型无权写入）
    wheel:wheelState,inventory:z.record(id,inventoryItem).default({})}).passthrough();
  return {root:z.object({shenghao:state.nullable().default(null)}).passthrough(),state,character,world,appointment};
}

