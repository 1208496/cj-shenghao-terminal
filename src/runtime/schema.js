export function createSchema(z) {
  const text=z.string().max(1500),short=z.string().max(150),id=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).refine(v=>!['__proto__','constructor','prototype'].includes(v));
  const money=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},'日期不存在');
  const profile=z.object(Object.fromEntries(['identity','appearance','body','personality','habits','style','family','career','social'].map(k=>[k,z.string().min(1).max(1500)])));
  const anchor=z.object({branchKey:z.string(),messageId:z.number().int(),swipeId:z.number().int(),fingerprint:z.string()});
  const character=z.object({id,name:z.string().min(1).max(50),age:z.number().int().min(18).max(120),aliases:z.array(short).max(20).default([]),occupation:short.default(''),
    affection:z.number().int().min(0).max(100),relationshipLabel:z.string().min(1).max(12),relationshipNotes:text.default(''),relationshipEvidence:text.default(''),
    profileFixed:profile,contactConfirmed:z.boolean().default(false),firstContactEvidence:text.default(''),
    trackingState:z.enum(['RECORDED','HIDDEN']).default('RECORDED'),rewardBaseCents:z.literal(1000000).default(1000000),
    withdrawal:z.object({status:z.literal('COMMITTED'),operationId:id,amountCents:money,sourceAnchor:anchor}).nullable().default(null),
    currentClothes:text.default(''),currentPose:text.default(''),currentAction:text.default(''),currentExpression:text.default(''),avatarRef:short.nullable().default(null),portraitRef:short.nullable().default(null)}).passthrough();
  const temp=z.object({tempId:id,name:short,description:text,adultConfirmed:z.boolean()});
  const event=z.object({type:z.enum(['CASH_TRANSACTION','ASSET_TRANSFER','TRANSACTION_REFUND','SIGNIFICANT_BEHAVIOR_SCORE']),factId:id,evidence:z.string().min(1).max(700)}).passthrough();
  const appointment=z.object({id,title:z.string().min(1).max(80),date,time:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    location:short,participants:z.array(id).max(30).default([]),status:z.enum(['PLANNED','CANCELLED','COMPLETED']).default('PLANNED'),notes:text.default('')});
  const world=z.object({date,time:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),weather:short.default('晴'),timeZone:z.literal('Asia/Shanghai').default('Asia/Shanghai')});
  const asset=z.object({assetId:id,kind:z.enum(['HOUSE','CAR','LUXURY','OTHER']),name:short,ownerId:z.string(),bookValueCents:money,basisCents:money.nullable(),status:z.enum(['OWNED','TRANSFERRED','SOLD','RETURNED']),acquisitionEventId:z.string(),acquisitionIsInitial:z.boolean(),locationNote:text.default(''),ownershipNote:text.default('')}).passthrough();
  const ledger=z.object({entryId:z.string(),eventId:z.string(),kind:z.string(),direction:z.enum(['IN','OUT']),amountCents:money,payerId:z.string(),beneficiaryCharacterId:z.string().nullable(),allocations:z.array(z.object({personRef:id,amountCents:money})),assetId:z.string().nullable(),status:z.string(),refundOf:z.string().nullable(),sourceAnchor:anchor,memo:text,recordedAtScene:short,createdRevision:z.number().int()}).passthrough();
  const state=z.object({schemaVersion:z.literal(2),meta:z.object({initialized:z.literal(true),initKey:id,branchKey:z.string(),revision:z.number().int().nonnegative(),sourceAnchor:anchor.nullable()}).passthrough(),
    user:z.object({id:z.literal('USER'),name:z.string().min(1).max(50),age:z.number().int().min(18).max(120),gender:short,appearance:text,occupation:short,background:text,city:short,location:short,housingMode:short,residenceDescription:text,workLifeDescription:text,cashCents:money,initialCashCents:money,currentClothes:text,currentPose:text,currentAction:text}).passthrough(),
    world,scene:z.object({sceneId:id,location:short,timeHint:short,presentCharacterIds:z.array(id).max(100),temporaryActors:z.array(temp).max(30),sceneRevision:z.number().int().nonnegative()}),
    characters:z.record(id,character),identityMap:z.record(z.string(),z.string()),hiddenTemporary:z.record(z.string(),z.union([temp,z.boolean()])),
    finance:z.object({ledger:z.record(z.string(),ledger),assets:z.record(id,asset)}),rewardEvents:z.record(z.string(),z.object({eventId:z.string(),characterId:id,eventType:z.enum(['SPEND_CREDIT','CRITICAL']),cashbackCents:money,valid:z.boolean()}).passthrough()),
    operationHistory:z.record(z.string(),z.object({type:z.string(),status:z.enum(['COMMITTED','FAILED','PENDING']),revision:z.number().int()}).passthrough()),
    notifications:z.record(z.string(),z.object({notificationId:z.string(),relatedEventId:z.string(),type:z.string()}).passthrough()),facts:z.record(z.string(),z.unknown()),
    calendar:z.object({appointments:z.record(id,appointment)}),pendingEvents:z.array(event).max(40).default([]),_context:z.string().default('')}).passthrough();
  return {root:z.object({shenghao:state.nullable().default(null)}).passthrough(),state,character,world,appointment};
}
