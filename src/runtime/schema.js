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
  const character=z.object({id,name:z.string().min(1).max(50),age:z.number().int().min(1).max(120),beautyScore:beauty.nullable(),aliases:z.array(short).max(20).default([]),occupation:short.default(''),
    affection,corruption,relationshipLabel:narrative(12).pipe(z.string().min(1)),relationshipNotes:narrative(1500).default(''),relationshipEvidence:text.default(''),
    personalityTags:z.array(z.string().trim().min(1).max(12)).max(6).default([]),appearance:z.string().max(500).default(''),body:z.string().max(500).default(''),weightKg:z.number().min(25).max(250).nullable().default(null),heightCm:z.number().min(100).max(230).nullable().default(null),bustCm:z.number().min(40).max(200).nullable().default(null),waistCm:z.number().min(30).max(200).nullable().default(null),hipCm:z.number().min(40).max(200).nullable().default(null),shoeSizeEu:z.number().min(25).max(55).nullable().default(null),knownFacts:z.preprocess(v=>Array.isArray(v)?v.filter(x=>typeof x==='string').join('；'):v,narrative(1200)).default(''),knownFactsEvidence:text.default(''),profileFixed:profile.nullable().default(null),profileLocked:z.boolean().default(false),contactConfirmed:z.boolean().default(false),firstContactEvidence:text.default(''),
    cupSize:z.string().trim().max(8).default(''),addressing:narrative(20).default(''),impression:narrative(300).default(''),starred:z.boolean().default(false),
    trackingState:z.enum(['RECORDED','HIDDEN']).default('RECORDED'),
    currentClothes:narrative(1500).default(''),currentPose:narrative(1500).default(''),currentAction:narrative(1500).default(''),currentExpression:narrative(1500).default(''),currentMood:narrative(1500).default(''),currentCondition:narrative(1500).default(''),currentItems:narrative(1500).default(''),
    currentThought:narrative(300).default(''),arousal:z.preprocess(v=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):0;},z.number().int().min(0).max(100)).default(0),offscreen:narrative(200).default(''),currentGoal:narrative(200).default(''),
    // Private records stay two flat sub-objects so JSONPatch can address
    // /characters/<id>/physiology/cycle directly, and unlockedTags accepts
    // either a tag array or a separated string from the model.
    // rc.24: the four private panels read these flat sub-objects directly.
    physiology:z.object({cycle:narrative(40).default(''),pregnancy:narrative(40).default('未孕'),virgin:z.boolean().nullable().default(null),hymenNote:narrative(80).default(''),chestDetail:narrative(200).default(''),vaginaLook:narrative(200).default(''),vaginaState:narrative(200).default(''),pubicHair:narrative(120).default(''),anusLook:narrative(150).default(''),anusState:narrative(150).default(''),bodyScent:narrative(120).default(''),tattooScar:narrative(150).default(''),traits:narrative(400).default('')}).prefault({}),
    outfit:z.object({style:narrative(100).default(''),complexion:narrative(120).default(''),top:narrative(200).default(''),bottom:narrative(200).default(''),lingerie:narrative(200).default(''),socks:narrative(150).default(''),shoes:narrative(150).default(''),makeup:narrative(150).default(''),accessories:narrative(150).default('')}).prefault({}),
    intimacy:z.object({attitude:narrative(60).default(''),abilityComment:narrative(200).default(''),partnersCount:z.number().int().nonnegative().default(0),sexPartnerCount:z.number().int().nonnegative().default(0),firstTime:narrative(150).default(''),experience:narrative(200).default(''),fetishes:narrative(200).default(''),unlockedTags:z.preprocess(v=>Array.isArray(v)?v:(typeof v==='string'&&v.trim()?v.split(/[、,，/／;；·|]/):[]),z.array(z.string().trim().min(1).max(16)).max(24)).default([]),withUserCount:z.number().int().nonnegative().default(0),lastIntimate:narrative(120).default(''),lastMasturbation:narrative(120).default('')}).prefault({}),
    limits:z.object({scaleLevel:z.number().int().min(0).max(6).default(0),weakness:narrative(200).default(''),worry:narrative(200).default(''),exposure:z.number().int().min(0).max(3).default(0),foreplay:z.number().int().min(0).max(3).default(0),intercourse:z.number().int().min(0).max(3).default(0),cosplay:z.number().int().min(0).max(3).default(0),creampie:z.number().int().min(0).max(3).default(0),anal:z.number().int().min(0).max(3).default(0),publicPlay:z.number().int().min(0).max(3).default(0),multi:z.number().int().min(0).max(3).default(0)}).prefault({}),
    avatarRef:short.nullable().default(null),portraitRef:short.nullable().default(null)});
  const temp=z.object({tempId:id,name:short,description:text});
  const appointment=z.object({id,title:z.string().min(1).max(80),date,time:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    location:short,participants:z.array(id).max(30).default([]),status:z.enum(['PLANNED','CANCELLED','COMPLETED']).default('PLANNED'),notes:text.default('')});
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
  const asset=z.object({assetId:id,kind:assetKindEnum,name:short,ownerId:z.string(),bookValueCents:money,basisCents:money.nullable(),status:z.enum(['OWNED','TRANSFERRED','SOLD','RETURNED']),acquisitionEventId:z.string(),acquisitionIsInitial:z.boolean(),description:z.string().min(1).max(800),locationNote:text.default(''),ownershipNote:text.default('')}).passthrough();
  const ledger=z.object({entryId:z.string(),eventId:z.string(),kind:z.string(),direction:z.enum(['IN','OUT','NONE']),amountCents:money,payerId:z.string(),beneficiaryCharacterId:z.string().nullable(),allocations:z.array(z.object({personRef:id,amountCents:money})),assetId:z.string().nullable(),status:z.string(),refundOf:z.string().nullable(),sourceAnchor:anchor,memo:text,itemName:short,merchantOrPlace:short,recordedAtScene:short,createdRevision:z.number().int()}).passthrough();
  const withdrawal=z.object({withdrawalId:id,characterId:id,status:z.literal('COMMITTED'),basePoolCents:money,spendCents:money,criticalCents:money,preCashCents:money,tierId:short,tierLabel:short,multiplier:z.union([z.literal(10),z.literal(8),z.literal(5),z.literal(3),z.literal(2),z.literal(1)]),grossCents:money,paidCents:money,recoveryCents:money,allocations:z.record(z.string(),money),recoveryAllocations:z.record(z.string(),money),sourceAnchor:anchor,recordedAtScene:short});
  const recovery=z.object({recoveryId:z.string(),characterId:id,rewardEventId:z.string(),withdrawalId:id,refundLedgerId:z.string(),refundedBaseCents:money,amountCents:money,settledCents:money,sourceAnchor:anchor});
  const state=z.object({schemaVersion:z.literal(3),meta:z.object({initialized:z.literal(true),initKey:id,branchKey:z.string(),revision:z.number().int().nonnegative(),sourceAnchor:anchor.nullable()}).passthrough(),
    user:z.object({id:z.literal('USER'),name:z.string().min(1).max(50),age:z.number().int().min(1).max(120),beautyScore:beauty,prowessScore:beauty.default(70),
      sexualAbility:z.object({stamina:beauty.default(70),hardness:beauty.default(70),technique:beauty.default(70),volume:beauty.default(70)}).prefault({}),
      genitals:z.object({length:short.default('18cm'),girth:short.default('4.8cm'),traits:narrative(300).default('形态饱满挺拔，青筋分明，热度惊人')}).prefault({}),
      gender:short,appearance:text,body:text.default(''),occupation:short,background:text,city:short,location:short,housingMode:short,residenceDescription:text,workLifeDescription:text,cashCents:money,initialCashCents:money,currentClothes:text,currentPose:text,currentAction:text}).passthrough(),
    world,scene:z.object({sceneId:id,location:short,timeHint:short,presentCharacterIds:z.array(id).max(100),temporaryActors:z.array(temp).max(30),sceneRevision:z.number().int().nonnegative()}),
    characters:z.record(id,character),identityMap:z.record(z.string(),z.string()),hiddenTemporary:z.record(z.string(),z.union([temp,z.boolean()])),
    finance:z.object({ledger:z.record(z.string(),ledger),assets:z.record(id,asset)}),rewardEvents:z.record(z.string(),z.object({eventId:z.string(),characterId:id,eventType:z.enum(['SPEND_CREDIT','CRITICAL']),cashbackCents:money,refundedCents:money,withdrawalId:id.nullable(),claimedCents:money,valid:z.boolean()}).passthrough()),withdrawals:z.record(id,withdrawal),recoveries:z.record(z.string(),recovery),
    operationHistory:z.record(z.string(),z.object({type:z.string(),status:z.enum(['COMMITTED','FAILED','PENDING']),revision:z.number().int()}).passthrough()),
    notifications:z.record(z.string(),z.object({notificationId:z.string(),relatedEventId:z.string(),type:z.string()}).passthrough()),facts:z.record(z.string(),z.unknown()),
    // Transport only: event validation belongs to settlement, one item at a time.
    calendar:z.object({appointments:z.record(id,appointment)}),pendingEvents:z.array(z.unknown()).max(40).default([]),_context:z.string().default('')}).passthrough();
  return {root:z.object({shenghao:state.nullable().default(null)}).passthrough(),state,character,world,appointment};
}
