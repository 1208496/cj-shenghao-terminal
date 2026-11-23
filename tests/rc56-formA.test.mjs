import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNumericInput,clampInteger,parseDecimal,validateField,validateStep,
  validateAssetDraft,validateContactDraft,findFirstDraftIssue,sanitizeLoadedDraft,
  SETUP_FIELD_RULES,SETUP_FIELD_HINTS,SETUP_FIELD_ERRORS,errorTextFor,STEP_FIELDS,
} from '../src/ui/setup-required.js';
import {BEAUTY_HINT,PROWESS_HINT,DRAFT_WARN_TEXT,DRAFT_WARN_BTN,BODY_EMPTY_TEXT,BODY_MISSING_TPL} from '../src/ui/opening-copy.generated.js';
import {fieldOptions,playerBodyOptions,resolveGenderBucket} from '../src/ui/setup-options.js';
import {openingPresets,applyOpeningPreset} from '../src/ui/opening-presets.js';
import {draft} from './fixtures.mjs';
// 夹具的 appearance/body/background 是空的（引擎允许），但表单层把这些当必填；测试基底先补满。
const base=(extra={})=>draft({appearance:'黑色短发，五官清晰',body:'体型匀称',background:'在云澜市打拼三年',currentLocation:'江城区·临江大平层',startDate:'2026-01-05',startTime:'09:00',...extra});

// ---- 输入清洗（方案 §2.5） ----
test('rc56-formA 整数框清洗：全角转半角、禁止小数点、粘贴带单位也能救',()=>{
  assert.equal(normalizeNumericInput('２４'),'24');
  assert.equal(normalizeNumericInput('２４.５'),'245');
  assert.equal(normalizeNumericInput('178cm'),'178');
  assert.equal(normalizeNumericInput('abc'),'');
});
test('rc56-formA 小数框清洗：只留一个点，全角句号也转',()=>{
  assert.equal(normalizeNumericInput('７２．５',{allowDecimal:true}),'72.5');
  assert.equal(normalizeNumericInput('72。5',{allowDecimal:true}),'72.5');
  assert.equal(normalizeNumericInput('72.5.6',{allowDecimal:true}),'72.56');
  assert.equal(normalizeNumericInput('72.5 kg',{allowDecimal:true}),'72.5');
});
test('rc56-formA 失焦钳位：整数夹到范围，空值返回 null',()=>{
  assert.equal(clampInteger('17',18,80),18);
  assert.equal(clampInteger('95',18,80),80);
  assert.equal(clampInteger('',18,80),null);
  assert.equal(clampInteger('24',18,80),24);
});
test('rc56-formA 小数保留一位且不静默钳位',()=>{
  assert.equal(parseDecimal('178.56',140,230),178.6);
  assert.equal(parseDecimal('42.5',34,52),42.5);
  assert.equal(parseDecimal('1.75',140,230),null);
  assert.equal(parseDecimal('300',35,200),null);
});

// ---- 逐字段校验（方案 §4.3 文案键） ----
test('rc56-formA validateField 覆盖必填/范围/格式/金额/标签',()=>{
  assert.equal(validateField('age',''),'age_required');
  assert.equal(validateField('age','17'),'age_range');
  assert.equal(validateField('heightCm',''),'');
  assert.equal(validateField('heightCm','1.75'),'heightCm_meters');
  assert.equal(validateField('heightCm','300'),'heightCm_range');
  assert.equal(validateField('shoeSizeEu','60'),'shoeSizeEu_range');
  assert.equal(validateField('startDate','2026-02-30'),'startDate_invalid');
  assert.equal(validateField('startDate','2026-01-05'),'');
  assert.equal(validateField('startTime','9:00'),'startTime_invalid');
  assert.equal(validateField('startTime','09:00'),'');
  assert.equal(validateField('a_value','abc'),'a_value_invalid');
  assert.equal(validateField('a_value','150万'),'');
  assert.equal(validateField('c_personalityTags','a、b、c、d、e、f、g'),'c_personalityTags_count');
  assert.equal(validateField('c_personalityTags','一二三四五六七八九十一二三'),'c_personalityTags_len');
  assert.equal(validateField('c_relation','一二三四五六七八九十一二三'),'c_relation_tooLong');
});

test('rc56-formA 每个带规则的字段都有常驻限制说明与错误文案',()=>{
  const OWN_HINT=new Set(['beautyScore','prowessScore']);
  const missingHint=Object.keys(SETUP_FIELD_RULES).filter(k=>!OWN_HINT.has(k)&&!SETUP_FIELD_HINTS[k]);
  assert.deepEqual(missingHint,[],'缺 hint 的字段：'+missingHint.join(','));
  assert.ok(Object.keys(SETUP_FIELD_HINTS).length>=50);
  assert.ok(Object.keys(SETUP_FIELD_ERRORS).length>=42);
  // 文案必须是方案定稿（抽查三条，逐字）
  assert.equal(errorTextFor('heightCm_meters'),'身高需填厘米数（140–230），例如 175，请勿填米数。');
  assert.equal(errorTextFor('weightKg_range'),'体重须在 35–200 KG 之间，或留空由模型补全。');
  assert.equal(SETUP_FIELD_HINTS.age,'必填 · 18–80 整数');
});

test('rc56-formA 其它定稿文案逐字进代码',()=>{
  assert.equal(BEAUTY_HINT,'1–100 整数；仅影响好感未达70时的有效正面互动，不会逐轮自动加减。');
  assert.equal(PROWESS_HINT,'1–100 整数；只在她亲身体会过的亲密互动里修正堕落度，不影响日常好感。');
  assert.equal(DRAFT_WARN_TEXT,'检测到已保存的草稿中有项数据超出范围，请先修正后再继续。');
  assert.equal(DRAFT_WARN_BTN,'去修改');
  assert.equal(BODY_EMPTY_TEXT,'留空（开场由模型自动补全）');
  assert.equal(BODY_MISSING_TPL,'（{missingLabels}留空，开场由模型自动补全）');
});

// ---- 整步与弹窗校验（方案 §2.4） ----
test('rc56-formA 资产弹窗只校验本次字段，旧草稿越界不再连坐',()=>{
  const legacy=base({heightCm:1.75});
  assert.ok(validateStep(legacy,0));
  assert.equal(validateAssetDraft({a_name:'临江大平层',a_value:'85000000',a_note:'',a_description:'',a_owner:''},0,false),null);
  assert.equal(validateAssetDraft({a_name:'',a_value:'0'},0,false).code,'a_name_required');
  assert.equal(validateAssetDraft({a_name:'x',a_value:'abc'},0,false).code,'a_value_invalid');
  assert.equal(validateAssetDraft({a_name:'x',a_value:'0'},100,false).code,'a_limit');
  assert.equal(validateAssetDraft({a_name:'x',a_value:'0'},100,true),null,'编辑已有资产不受 100 项上限限制');
});
test('rc56-formA 熟人弹窗只校验本次字段',()=>{
  assert.equal(validateContactDraft({c_name:'温迎',c_age:'26'},0,false),null);
  assert.equal(validateContactDraft({c_name:'温迎',c_age:'16'},0,false).code,'c_age_range');
  assert.equal(validateContactDraft({c_name:'',c_age:'26'},0,false).code,'c_name_required');
  assert.equal(validateContactDraft({c_name:'温迎',c_age:'26'},20,false).code,'c_limit');
  assert.equal(validateContactDraft({c_name:'温迎',c_age:'26',c_heightCm:'1.65'},0,false).code,'c_heightCm_meters');
});
test('rc56-formA findFirstDraftIssue 跨步定位',()=>{
  assert.equal(findFirstDraftIssue(base({heightCm:1.75})).step,0);
  assert.equal(findFirstDraftIssue(base({heightCm:1.75})).key,'heightCm');
  assert.equal(findFirstDraftIssue(base({startDate:'2026-02-30'})).step,1);
  const badAsset=findFirstDraftIssue(base({initialAssets:[{assetId:'a1',name:'',bookValueCents:100}]}));
  assert.equal(badAsset.scope,'asset');
  assert.equal(findFirstDraftIssue(base()),null);
});
test('rc56-formA sanitizeLoadedDraft 只静默钳位颜值与性能力',()=>{
  const a=sanitizeLoadedDraft({beautyScore:150,prowessScore:0,heightCm:1.75,age:17});
  assert.equal(a.beautyScore,100);
  assert.equal(a.prowessScore,1);
  assert.equal(a.heightCm,1.75,'身高越界必须保留原值让玩家自己改');
  assert.equal(a.age,17);
  const b=sanitizeLoadedDraft({beautyScore:NaN,prowessScore:undefined});
  assert.equal(b.beautyScore,60);
  assert.equal(b.prowessScore,70);
});
test('rc56-formA STEP_FIELDS 覆盖两步全部可校验字段',()=>{
  assert.ok(STEP_FIELDS[0].includes('age')&&STEP_FIELDS[0].includes('heightCm'));
  assert.ok(STEP_FIELDS[1].includes('startDate')&&STEP_FIELDS[1].includes('startTime'));
  for(const k of STEP_FIELDS[0].concat(STEP_FIELDS[1]))assert.ok(SETUP_FIELD_RULES[k],'缺规则：'+k);
});

// ---- 预设与下拉（方案 §3） ----
test('rc56-formA 四个开局预设补齐身体数据并与方案一致',()=>{
  const expect={broke:[178,68,42],worker:[178,72,42],comfortable:[180,74,43],wealthy:[183,76,43]};
  let n=0;
  for(const p of openingPresets){
    const d=applyOpeningPreset(base(),p.id,()=>String(++n));
    assert.deepEqual([d.heightCm,d.weightKg,d.shoeSizeEu],expect[p.id],p.id);
  }
  const fromPreset=applyOpeningPreset(base(),'broke',()=>'x');
  assert.equal(fromPreset.heightCm,178,'common 基准值应生效');
});
test('rc56-formA 玩家身体数据下拉按性别分档，且全部落在引擎合法区间',()=>{
  assert.deepEqual(fieldOptions('heightCm',{gender:'男'}),playerBodyOptions.male.heightCm);
  assert.deepEqual(fieldOptions('heightCm',{gender:'女'}),playerBodyOptions.female.heightCm);
  assert.deepEqual(fieldOptions('heightCm',{gender:'非二元'}),playerBodyOptions.neutral.heightCm);
  assert.deepEqual(fieldOptions('heightCm'),playerBodyOptions.male.heightCm,'性别未填默认男性档');
  assert.equal(resolveGenderBucket('男'),'male');
  assert.equal(resolveGenderBucket('女'),'female');
  assert.equal(resolveGenderBucket(''),'male');
  for(const bucket of Object.values(playerBodyOptions)){
    for(const v of bucket.heightCm)assert.ok(Number(v)>=140&&Number(v)<=230,v);
    for(const v of bucket.weightKg)assert.ok(Number(v)>=35&&Number(v)<=200,v);
    for(const v of bucket.shoeSizeEu)assert.ok(Number(v)>=34&&Number(v)<=52,v);
  }
});
