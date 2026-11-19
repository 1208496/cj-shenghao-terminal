import {cashOptions,openingPresets,applyOpeningPreset} from './opening-presets.js';
import {contactPresets,contactPresetValues,installFieldOptions} from './setup-options.js';
import {createScreens} from './screens.js';
import {setupDraftStore} from './setup-draft.js';
import {missingInStep} from './setup-required.js';
import {WHEEL_POOL_BY_ID} from '../core/wheel-pool.js';
import {CASINO_UI,ABILITY_BY_ID,SURREAL_ITEM_BY_ID,ABILITIES,SURREAL_ITEMS} from '../core/casino-catalog.js';
import {RARITY_VISUAL,cardGlyph,CARD_CODES} from './card-art.js';
import {WHEEL_COPY,fill} from '../core/wheel-ui-copy.js';
import {setupStatus} from './setup-status.js';
import {assignAll,findItem} from './avatar-pool.js';
import {loadManifest,avatarUrl} from '../runtime/avatar-manifest.js';
import {upgradeCost} from '../core/casino.js';
import {cents,validateDraft,userProfileTags,PROFILE_KEYS,PROFILE_LABELS,poolParts,totals,stage,canWithdraw,wealthTier,beautyTier,prowessTier,withdrawalQuote,assetDescription} from '../core/engine.js';
const $=id=>document.getElementById(id);
const esc=v=>String(v ?? '').replace(/[&<>"']/g,c=>String.fromCharCode(38)+({'&':'amp;','<':'lt;','>':'gt;','"':'quot;',"'":'#39;'}[c]));
const yuan=n=>'¥'+new Intl.NumberFormat('zh-CN',{minimumFractionDigits:n%100?2:0,maximumFractionDigits:2}).format(n/100);
const uid=()=>crypto.randomUUID();
const setup=document.body.dataset.surface==='setup';
const draftStore=setup?setupDraftStore(window.parent):null;
let draftEdited=false,connectionExpired=false;
const fieldOptionsUI=installFieldOptions({enabled:setup});
let mineExpanded=new Set();
let editingContactId=null,editingAssetId=null,consumptionPage=0,withdrawalPreview=null;
// rc.33 修复：熟人弹窗会话令牌。AI 补全回来时若弹窗已换人/已关闭，结果直接丢弃，避免幽灵回填。
let contactToken=0;
// rc.33：AI 补全返回的 hiddenScar 不进表单（保持知识边界），用内存暂存到保存那一刻。
let pendingHiddenScar='';
let reviewedUpdate=null,calendarOpen=false,calendarMonth='',selectedDate='';
let api=null,view=null,tab='scene',detail=null,section=null,privateSection=null,settings=false,hidden=false,assetTab='ALL',folded=true,expanded=new Set(),sceneSection=new Map(),seen=new Set(),imageCache={},currentMedia='',modalReturn=null,lastSignature='',activeChat='',dragged=false,dragCancel=null,pendingOperation=null,draft=null,step=0,preview=false,unsubscribe=null,toastTimer=null,fxTimer=null,buildTimer=null,buildingProfile=false;
const defaultDraft=()=>({name:'',age:24,beautyScore:60,prowessScore:70,genitals:{length:'18cm',girth:'4.8cm',traits:'形态饱满挺拔，青筋分明，热度惊人'},gender:'',appearance:'',body:'',occupation:'',background:'',startDate:'2026-01-05',startTime:'09:00',weather:'晴',initialCashCents:1000000,city:'云澜市',currentLocation:'江城区·公寓',workLifeDescription:'',initialAssets:[],contacts:[]});
function notify(t){$('toast').textContent=t;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3500);}
function theme(){const size=view?.prefs.fontSize||(view?.prefs.phoneSize==='standard'?'small':'medium');document.documentElement.style.setProperty('--cj-font-scale',setup?'1':({small:1,medium:1.15,large:1.3}[size]||1));document.documentElement.classList.toggle('theme-gold',view?.prefs.theme==='gold');document.documentElement.classList.toggle('theme-purple',view?.prefs.theme==='purple');}
function errorText(e){return ({PROFILE_FACT_CONFLICT:'生成资料与基础信息不一致，请重试建档。',PROFILE_ALREADY_BUILT:'该人物已经完成建档。',INVALID_BASIC_PROFILE:'请检查身体数据范围与性格标签（最多6个，每个最多12字）。',MONEY_OVERFLOW:'金额超出安全计算范围，本次操作未入账。',WITHDRAWAL_REVIEW_REQUIRED:'余额、倍率或奖池已变化，请重新确认提现。',INVALID_MONEY:'金额最多填写两位小数，可填写万或亿。',INVALID_DRAFT:'请完整填写开局信息。',INVALID_TEXT:'请检查必填内容和文字长度。',INVALID_INTEGER:'请检查年龄、好感及金额。',DRAFT_LIMIT:'最多20位初始熟人、100项开局资产。',PROFILE_INCOMPLETE:'人物资料尚未完整，请保留设定后重试。',INSUFFICIENT_CASH:'可用余额不足。',STALE_SOURCE:'故事已经变化，请重新确认。',STALE_REVISION:'记录已经变化，请重新确认。',GENERATION_BUSY:'请等本次故事记录完成。',WITHDRAWAL_LOCKED:'当前尚不能提现。',OPENING_ALREADY_STARTED:'故事已经开始，请回到聊天继续。',MODEL_TIMEOUT:'档案生成没有完成，请点击重试。',INVALID_PROFILE:'模型返回的档案格式有误，请点击重试。',BUILD_CANCELLED:'已取消本次人物建档。',UPDATE_UNAVAILABLE:'暂时无法检测更新。',CONTACT_NAME_REQUIRED:'请先点击「模型一键补全设定」，或点开「自定义全部设定」填写姓名与年龄。',CONTACT_BRIEF_REQUIRED:'请先在主框里写一句角色描述（至少两个字），再点模型补全。'})[e?.message] || '本次记录尚未完成，请稍后重试。';}
function field(label,key,value,{type='text',area=false,min,max,required=false,placeholder=''}={}){
  // Setup dates share the editable suggestion dropdown; validation still uses the schema.
  if(setup&&['date','time'].includes(type))type='text';
  const ph=placeholder?` placeholder="${esc(placeholder)}"`:'';
  const fid='f_'+key;return `<div class="field"><label for="${fid}">${label}${required?' <span class="required">*</span>':''}</label>${area?`<textarea id="${fid}" data-field="${key}" maxlength="1200"${ph}>${esc(value)}</textarea>`:`<input id="${fid}" data-field="${key}" value="${esc(value)}" type="${type}" ${min===undefined?'':`min="${min}"`} ${max===undefined?'':`max="${max}"`} ${type==='number'?'step="1"':''} maxlength="500" ${required?'required':''}${ph}>`}</div>`;
}
// 想法池 07：开局表单必填校验，规则在 setup-required.js；拦截点统一放在「下一步」。
// 想法池 07：可留空的身体数据在表单里是空数字框，collect() 不能把它们读成 0，
// 否则 validateDraft 会按范围校验报错、模型补全机制也失效。
const SETUP_NULLABLE_NUMBERS=new Set(['heightCm','weightKg','shoeSizeEu']);
// rc.36：轮盘搬到顶层全屏 iframe，由 host 托管；手机这边只负责发起与结算后刷新。
async function runWheelOp(op){
  const payload={...op,operationId:uid(),expectedRevision:view.state.meta.revision};
  const next=await api.action(payload,view.lineage);
  view=next;
  const hist=next.state?.operationHistory?.[payload.operationId];
  return {view:next,result:hist?.result||{}};
}
let bagTab = 'cards', shopTab = 'ability';
function segTabs(list, active, attr) {
  return `<div class="seg-tabs" role="tablist">${list.map(([id, label]) => `<button class="seg-tab ${active === id ? 'on' : ''}" role="tab" aria-selected="${active === id}" data-${attr}="${id}">${esc(label)}</button>`).join('')}</div>`;
}
function cardName(it) {
  const c = WHEEL_COPY.cards?.[it.cardCode] || {};
  return c.name || it.cardCode || it.rarity;
}
function binderTile(it) {
  const v = RARITY_VISUAL[it.rarity] || RARITY_VISUAL.gray;
  const c = WHEEL_COPY.cards?.[it.cardCode] || { motto: '' };
  const locked = !!it.locked;
  // 按钮放在卡面下方：卡面只承载美术与数值，不在正面盖操作键。
  return `<div class="binder-item">
    <div class="wish-card rar-${esc(it.rarity)}" data-rarity="${esc(it.rarity)}" style="--wc-rim:${v.rim};--wc-t1:${v.tone1};--wc-t2:${v.tone2};--wc-halo:${v.halo}">
      <div class="wc-top"><span class="wc-tier">${esc(v.stamp)}</span><span class="wc-pool">${esc(it.poolTier === 'low' ? WHEEL_COPY.packs.ui.poolLowBadge : WHEEL_COPY.packs.ui.poolHighBadge)}</span><span class="wc-serial">${esc(WHEEL_COPY.packs.ui.serialPrefix + String(it.serialNo || 0).padStart(4, '0'))}</span></div>
      <div class="wc-mid">${cardGlyph(it.cardCode, v.rim)}</div>
      <div class="wc-bot"><b class="wc-name">${esc(cardName(it))}</b><small class="wc-motto">${esc(c.motto || '')}</small><span class="wc-points">${esc(String(it.currentPoints ?? 0))}</span></div>
      ${it.winStreak ? `<span class="wc-streak">${esc(fill(WHEEL_COPY.packs.ui.streakBadge, { n: it.winStreak }))}</span>` : ''}
      ${locked ? '<span class="wc-lock">🔒</span>' : ''}
    </div>
    <div class="wc-acts">
      <button class="cj-act" data-open-wheel="casino" data-card-id="${esc(it.itemId)}" ${locked || view.busy ? 'disabled' : ''}>${esc(WHEEL_COPY.bag.binder.btnBet)}</button>
      <button class="cj-act" data-redeem-card="${esc(it.itemId)}" ${locked || view.busy ? 'disabled' : ''}>${esc(WHEEL_COPY.bag.binder.btnRedeem)}</button>
      <button class="cj-act" data-lock-card="${esc(it.itemId)}" data-locked="${locked ? '1' : ''}" aria-label="${esc(locked ? WHEEL_COPY.bag.binder.btnUnlock : WHEEL_COPY.bag.binder.btnLock)}">${locked ? '🔓' : '🔒'}</button>
    </div>
  </div>`;
}
function bagModal() {
  const s = view.state, items = Object.values(s.inventory || {}), pts = s.wheel?.starPoints || 0;
  const cards = items.filter((i) => i.category === 'WISH_CARD');
  const prizes = items.filter((i) => i.category === 'WHEEL_PRIZE');
  const surreal = items.filter((i) => i.category === 'SURREAL_ITEM');
  const codex = new Set((s.wheel?.discoveredCardCodes || []).filter((c) => CARD_CODES.includes(c)));
  const sortedCards = [...cards].sort((a, b) => Number(!!b.locked) - Number(!!a.locked) || (b.currentPoints || 0) - (a.currentPoints || 0));
  let body = '';
  if (bagTab === 'cards') {
    body = cards.length
      ? `<div class="binder-bar"><span>${esc(fill(WHEEL_COPY.bag.binder.codexProgress, { count: Math.min(CARD_CODES.length, codex.size) }))}</span><span>✦ ${pts}</span></div><div class="card-binder-grid">${sortedCards.map(binderTile).join('')}</div>`
      : `<div class="empty-card"><b>${esc(WHEEL_COPY.bag.binder.emptyTitle)}</b><p class="muted">${esc(WHEEL_COPY.bag.binder.emptySub)}</p><button class="cj-act primary" data-open-wheel="pack">${esc(WHEEL_COPY.bag.binder.emptyCta)}</button></div>`;
  } else if (bagTab === 'prizes') {
    body = prizes.length
      ? `<div class="bag-list">${prizes.map((it) => {
        const prize = WHEEL_POOL_BY_ID[it.refId] || { name: it.refId, summary: '' };
        const st = it.status === 'USED' ? WHEEL_COPY.bag.prizes.statusUsed : it.status === 'SCHEDULED' ? WHEEL_COPY.bag.prizes.statusScheduled : WHEEL_COPY.bag.prizes.statusReady;
        const acts = it.status === 'READY'
          ? `<button class="cj-act primary" data-use-prize="${esc(it.itemId)}" ${view.busy ? 'disabled' : ''}>${esc(WHEEL_COPY.bag.prizes.btnUse)}</button>`
          : it.status === 'SCHEDULED'
            ? `<button class="cj-act" data-view-schedule="${esc(it.scheduledAppointmentId || '')}">${esc(WHEEL_COPY.bag.prizes.btnViewCal)}</button><button class="cj-act" data-cancel-schedule="${esc(it.scheduledAppointmentId || '')}">${esc(WHEEL_COPY.bag.prizes.btnCancelSchedule)}</button>`
            : '';
        return `<div class="bag-item" data-rarity="${esc(it.rarity)}"><div class="bag-main"><div class="bag-title"><b>NO.${esc(prize.no || '')} ${esc(prize.name)}</b><span class="bag-chip">${esc(st)}</span></div><div class="bag-text">${esc(prize.summary || '')}</div>${acts ? `<div class="bag-actions">${acts}</div>` : ''}</div></div>`;
      }).join('')}</div>`
      : `<div class="empty-card"><b>${esc(WHEEL_COPY.bag.prizes.emptyTitle)}</b><p class="muted">${esc(WHEEL_COPY.bag.prizes.emptySub)}</p><button class="cj-act primary" data-open-wheel="play">${esc(WHEEL_COPY.bag.prizes.emptyCta)}</button></div>`;
  } else {
    body = surreal.length
      ? `<div class="bag-list">${surreal.map((it) => {
        const d = SURREAL_ITEM_BY_ID[it.refId] || { name: it.refId, effect: '', consumable: false };
        const used = it.status === 'USED';
        const tag = used ? WHEEL_COPY.bag.surreal.tagUsed : d.consumable ? WHEEL_COPY.bag.surreal.tagConsumable : WHEEL_COPY.bag.surreal.tagPermanent;
        const act = used ? ''
          : d.consumable ? `<button class="cj-act primary" data-use-item="${esc(it.itemId)}" ${view.busy ? 'disabled' : ''}>${esc(WHEEL_COPY.bag.surreal.btnUse)}</button>`
            : it.refId === 'it_toylink' ? `<button class="cj-act primary" data-toylink>${esc(WHEEL_COPY.bag.surreal.btnToyLink)}</button>`
              : `<button class="cj-act" data-use-prompt="${esc(it.itemId)}">${esc(WHEEL_COPY.bag.surreal.btnPrompt)}</button>`;
        return `<div class="bag-item" data-rarity="${esc(it.rarity)}"><div class="bag-main"><div class="bag-title"><b>${esc(d.name)}</b><span class="bag-chip">${esc(tag)}</span></div><div class="bag-text">${esc(d.effect || '')}</div>${act ? `<div class="bag-actions">${act}</div>` : ''}</div></div>`;
      }).join('')}</div>`
      : `<div class="empty-card"><b>${esc(WHEEL_COPY.bag.surreal.emptyTitle)}</b><p class="muted">${esc(WHEEL_COPY.bag.surreal.emptySub)}</p><button class="cj-act primary" data-act="open-shop">${esc(WHEEL_COPY.bag.surreal.emptyCta)}</button></div>`;
  }
  showModal(`<h3>${esc(WHEEL_COPY.wheels.hub.bagTitle)}</h3><div class="bag-summary"><div><small>✦ ${esc(WHEEL_COPY.wheels.hub.pointsLabel)}</small><b>${pts}</b></div><div><small>🃏 ${esc(WHEEL_COPY.wheels.hub.cardsLabel)}</small><b>${cards.length}</b></div></div>
    ${segTabs([['cards', WHEEL_COPY.bag.tabs.cards], ['prizes', WHEEL_COPY.bag.tabs.prizes], ['surreal', WHEEL_COPY.bag.tabs.surreal]], bagTab, 'bag-tab')}
    ${body}<div class="row"><button class="cj-act wfull" data-act="cancel">关闭</button></div>`);
}
function shopModal() {
  const s = view.state, pts = s.wheel?.starPoints || 0;
  const owned = Object.fromEntries((s.user.abilities || []).map((a) => [a.abilityId, a.level]));
  const abilityRow = (a) => {
    const lv = owned[a.abilityId] || 0;
    const maxed = lv >= 3;
    const price = lv ? upgradeCost(a, lv) : a.price;
    const label = lv ? (maxed ? WHEEL_COPY.shop.btnMaxLevel : fill(WHEEL_COPY.shop.btnUpgrade, { price })) : fill(WHEEL_COPY.shop.btnBuy, { price: a.price });
    const dots = [1, 2, 3].map((n) => `<i class="${n <= lv ? 'on' : ''}"></i>`).join('');
    const ownedLabel = lv && !a.upgradable ? WHEEL_COPY.shop.btnOwned : (lv ? 'Lv.' + lv : '');
    return `<div class="shop-item" data-rarity="${esc(a.rarity)}"><div class="shop-main"><div class="shop-title"><b>${esc(a.name)}</b><span class="bag-chip">${esc(a.tag)}</span></div><div class="shop-sub">${esc(a.effect)}</div><div class="shop-level">${dots}${ownedLabel ? `<small>${esc(ownedLabel)}</small>` : ''}</div></div>${maxed ? `<span class="shop-owned">${esc(WHEEL_COPY.shop.btnMaxLevel)}</span>` : lv && !a.upgradable ? `<span class="shop-owned">${esc(WHEEL_COPY.shop.btnOwned)}</span>` : `<button class="cj-act primary" data-shop-buy="${esc(a.abilityId)}" data-price="${price}">${esc(label)}</button>`}</div>`;
  };
  const itemRow = (i) => `<div class="shop-item" data-rarity="${esc(i.rarity)}"><div class="shop-main"><div class="shop-title"><b>${esc(i.name)}</b><span class="bag-chip">${esc(i.tag)}</span></div><div class="shop-sub">${esc(i.effect)}</div></div><button class="cj-act primary" data-shop-buy="${esc(i.itemId)}" data-price="${i.price}">${esc(fill(WHEEL_COPY.shop.btnBuy, { price: i.price }))}</button></div>`;
  const rows = shopTab === 'ability'
    ? ABILITIES.map(abilityRow).join('')
    : SURREAL_ITEMS.filter((i) => (shopTab === 'consumable' ? i.consumable === true : i.consumable !== true)).map(itemRow).join('');
  showModal(`<h3>${esc(WHEEL_COPY.wheels.hub.shopTitle)}</h3><p class="muted">✦ ${pts} ${esc(CASINO_UI.currencyName)}</p>
    ${segTabs([['ability', WHEEL_COPY.shop.tabs.ability], ['consumable', WHEEL_COPY.shop.tabs.consumable], ['permanent', WHEEL_COPY.shop.tabs.permanent]], shopTab, 'shop-tab')}
    <div class="shop-list">${rows}</div><div class="row"><button class="cj-act wfull" data-act="cancel">关闭</button></div>`);
}
function saveDraft(){draftEdited=true;const patch={setupDraft:draft,setupStep:step};if(api&&api.read().chatKey===activeChat)api.preferences(patch);else draftStore?.write(activeChat,patch);}
// rc.37 使用通道：玩法券排进日程 / 奇物使用 / 奇物叙事引导。
function prizeScheduleForm(itemId){
  const it=view.state.inventory?.[itemId];const prize=WHEEL_POOL_BY_ID[it?.refId]||{};
  const people=Object.values(view.state.characters).filter(c=>c.trackingState==='RECORDED');
  showModal(`<h3>${esc(WHEEL_COPY.bag.prizes.scheduleTitle)}</h3><p class="muted">NO.${esc(prize.no||'')} ${esc(prize.name||'')}</p>
    <div class="form-row">${field('日期','pz_date',view.state.world.date,{type:'date'})}${field('时间','pz_time',view.state.world.time,{type:'time'})}</div>
    ${field('地点','pz_location',view.state.scene.location)}
    <div class="field"><label for="pz_who">同行人物（可不选）</label><select id="pz_who">${'<option value="">不指定</option>'}${people.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>
    ${field('备注','pz_notes',prize.hint||'',{area:true})}
    <div class="row"><button class="btn secondary" data-act="cancel">取消</button><button class="btn" data-save-prize="${esc(itemId)}">${esc(WHEEL_COPY.bag.prizes.scheduleSubmit)}</button></div>`);
}
function useItemForm(itemId){
  const it=view.state.inventory?.[itemId];const def=SURREAL_ITEM_BY_ID[it?.refId]||{name:it?.refId||''};
  const people=Object.values(view.state.characters).filter(c=>c.trackingState==='RECORDED');
  const needTarget=it?.refId==='it_mirror';
  showModal(`<h3>${esc(WHEEL_COPY.bag.surreal.useTitle)}</h3><p class="muted">${esc(def.name)}</p>
    ${needTarget?`<div class="field"><label for="ui_target">${esc(WHEEL_COPY.bag.surreal.useTargetLabel)}</label><select id="ui_target">${people.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>`:''}
    <div class="row"><button class="btn secondary" data-act="cancel">取消</button><button class="btn" data-confirm-use-item="${esc(itemId)}">${esc(WHEEL_COPY.bag.surreal.useConfirm)}</button></div>`);
}
function promptForm(itemId){
  const it=view.state.inventory?.[itemId];const def=SURREAL_ITEM_BY_ID[it?.refId]||{name:it?.refId||'',effect:''};
  showModal(`<h3>${esc(WHEEL_COPY.bag.surreal.promptTitle)}</h3><p class="muted">${esc(WHEEL_COPY.bag.surreal.promptSub)}</p><textarea class="story-draft" readonly>${esc(def.effect||'')}</textarea><div class="row"><button class="btn" data-act="cancel">关闭</button></div>`);
}
function collect(){draft.city='云澜市';if($('beautyNumber')){const value=Number($('beautyNumber').value);if(!$('beautyNumber').value||!Number.isInteger(value)||value<1||value>100)throw Error('INVALID_INTEGER');draft.beautyScore=value;}if($('prowessNumber')){const value=Number($('prowessNumber').value);if(!$('prowessNumber').value||!Number.isInteger(value)||value<1||value>100)throw Error('INVALID_INTEGER');draft.prowessScore=value;}if($('f__gen_length'))draft.genitals={length:$('f__gen_length').value.trim()||'18cm',girth:$('f__gen_girth').value.trim()||'4.8cm',traits:$('f__gen_traits').value.trim()};let changed=false;document.querySelectorAll('#wizard [data-field]').forEach(el=>{const k=el.dataset.field;if(k.startsWith('_'))return;value=el.type==='number'?(el.value===''&&SETUP_NULLABLE_NUMBERS.has(k)?null:Number(el.value)):el.value;if(draft[k]!==value&&k!=='name'&&k!=='age')changed=true;draft[k]=value;});if(changed)delete draft.openingPresetId;}
function wizard(){fieldOptionsUI.close();
  if(view?.state){$('app').innerHTML=`<section class="setup"><div class="narrative"><h2>你的人生已启程</h2><p>${esc(view.state.user.name)} · ${esc(view.state.scene.location)}</p><p>本次开局已保留，可从聊天继续。打开右下角终端，查看此刻、她们和我的。</p>${view.error?`<p class="error-note">${esc(view.error)}</p>`:''}</div></section>`;return;}
  const d=draft;
  let body='';
  if(preview){body=`<h2 class="sec-title">确认你的起点</h2><p>${esc(d.name)}，${esc(d.age)}岁 · ${esc(d.city)}</p><p>初始现金 <b>${yuan(d.initialCashCents)}</b> · 已有资产 ${d.initialAssets.length} 项 · 初始熟人 ${d.contacts.length} 位</p><p class="notice">开始后将保存这次开局，并从你的设定展开故事。初始熟人缺失的简易资料会随开场正文一起补齐，九大档案可在人物详情中手动建档。</p><div class="card" style="margin:12px 0"><div class="settingrow" style="border-bottom:0;padding:2px 0 8px"><div><b>随机头像</b><div class="muted">开局起为新认识的女性自动配一张脸</div></div><div class="choice-row" role="group" aria-label="是否启用随机头像"><button type="button" class="chip ${view?.prefs?.randomAvatar!==false?'on':''}" data-setup-random-avatar="on" aria-pressed="${view?.prefs?.randomAvatar!==false}">开启（推荐）</button><button type="button" class="chip ${view?.prefs?.randomAvatar===false?'on':''}" data-setup-random-avatar="off" aria-pressed="${view?.prefs?.randomAvatar===false}">关闭</button></div></div><p class="notice" style="margin:0"><b>开启</b>：按颜值从图库随机配一张脸，配好后固定不变，第一次看图要联网。<br><b>关闭</b>：显示姓名首字，可以自己上传头像。<br>进游戏后可以在「终端设置」里改。</p></div><details><summary>查看完整设定</summary><pre style="white-space:pre-wrap;font:inherit">${esc(setupSummary(d))}</pre></details>`;}
  else if(step===0)body=`<div class="opening-presets" role="group" aria-label="开局预设">${openingPresets.map(p=>`<button type="button" class="mini-btn ${d.openingPresetId===p.id?'selected':''}" data-opening-preset="${p.id}" aria-pressed="${d.openingPresetId===p.id}"><b>${p.label}</b><small>${yuan(p.cashYuan*100)}</small></button>`).join('')}</div><p class="notice">一键填写其他设定、资产与熟人，姓名和年龄保留；填写后仍可修改。带下拉建议的输入框点击即可选用预设词条。</p><h2 class="sec-title">你是谁？</h2><p class="sub">从你的名字开始，定义自己的都市人生。</p><div class="form-row">${field('姓名','name',d.name,{required:true,placeholder:'输入你的名字（如：陆时行、陈默）'})}${field('年龄','age',d.age,{type:'number',min:1,max:120,required:true,placeholder:'18–60 整数（如：24）'})}</div><div class="form-row">${field('性别','gender',d.gender,{required:true,placeholder:'如：男（点击可选，或自由填写）'})}${field('职业','occupation',d.occupation,{required:true,placeholder:'当前身份或行业（如：独立建筑师、投行合伙人）'})}</div><div class="form-row">${field('身高（CM，选填）','heightCm',d.heightCm??'',{type:'number',min:140,max:230,placeholder:'可留空，由模型自动补全（如：183）'})}${field('体重（KG，选填）','weightKg',d.weightKg??'',{type:'number',min:35,max:200,placeholder:'可留空，由模型自动补全（如：75）'})}</div>${field('鞋码（欧码，选填）','shoeSizeEu',d.shoeSizeEu??'',{type:'number',min:34,max:52,placeholder:'可留空，由模型自动补全（如：43）'})}${beautyControl(d.beautyScore)}${prowessControl(d.prowessScore??70)}<div class="form-row">${field('性器长度','_gen_length',d.genitals?.length||'18cm',{placeholder:'带单位（如：18cm、20cm）'})}${field('性器粗度','_gen_girth',d.genitals?.girth||'4.8cm',{placeholder:'直径或周长（如：4.8cm、5.2cm）'})}</div>${genitalTraits(d.genitals?.traits||'')}${field('外貌与气质','appearance',d.appearance,{area:true,required:true,placeholder:'写发型五官、穿衣风格与给人的第一印象（如：黑色短发利落，鼻梁高挺，常戴金丝半框眼镜，眼神沉稳内敛）'})}${field('身材','body',d.body,{area:true,required:true,placeholder:'写体型骨架与锻炼痕迹（如：宽肩窄腰体型匀称，常年游泳保持着紧实流畅的胸腹肌理）'})}${field('背景经历','background',d.background,{area:true,required:true,placeholder:'写来云澜市的经历、目前的经济境遇与人生念想（如：在云澜市打拼三年的青年设计师，刚独立接手工作室，渴望在东岸站稳脚跟）'})}`;
  else if(step===1)body=`<h2 class="sec-title">选择生活的起点</h2><p class="sub">初始现金与你们未来的专属奖池分别计算。</p><div class="field"><label>初始现金（元）</label><div class="choice-row" role="group" aria-label="初始现金">${cashOptions.map(n=>`<button type="button" class="chip ${d.initialCashCents===n*100?'on':''}" data-cash="${n}" aria-pressed="${d.initialCashCents===n*100}">${yuan(n*100)}</button>`).join('')}</div></div><p class="notice">开局城市：云澜市</p>${field('当前地点','currentLocation',d.currentLocation,{required:true,placeholder:'格式：城区·具体场所（如：江城区·翠湖公寓客厅、东岸商业区·写字楼下咖啡座）'})}${field('工作与生活','workLifeDescription',d.workLifeDescription,{area:true,placeholder:'写日常作息、工作节奏与闲暇爱好（如：平时居家画图办公，周末喜欢逛独立书店、健身或约熟人小酌）'})}<div class="form-row">${field('起始日期','startDate',d.startDate,{type:'date',required:true,placeholder:'YYYY-MM-DD（如：2026-01-05）'})}${field('起始时间','startTime',d.startTime,{type:'time',required:true,placeholder:'HH:mm（如：09:00）'})}</div>${field('天气','weather',d.weather,{placeholder:'写天气与体感（如：晴，微风、雨后初霁，空气微凉）'})}<div class="section-head"><h3>已有资产</h3><button class="mini-btn" data-act="add-asset">＋ 登记资产</button></div>${d.initialAssets.map(a=>`<div class="person-preview"><b>${esc(a.name)}</b><span>${yuan(a.bookValueCents)} · ${esc(a.ownershipNote)}<br>${esc(assetDescription(a))}</span><div class="choice-row"><button class="mini-btn" data-edit-asset="${esc(a.assetId)}">编辑</button><button class="mini-btn" data-remove-asset="${esc(a.assetId)}">移除</button></div></div>`).join('')||'<p class="notice">开局资产按既有财产登记，不形成新的收入或支出。</p>'}`;
  else body=`<h2 class="sec-title">生活里熟悉的人</h2><p class="sub">可不添加。只有当下同场景的人才会显示在「此刻」。</p>${d.contacts.map(c=>`<div class="person-preview"><b>${esc(c.name)} · ${c.age}岁</b><span>${esc(c.relationshipLabel)} · 好感 ${c.affection} · ${c.present?'此刻在场':'暂不在场'}</span><div class="choice-row"><button class="mini-btn" data-edit-contact="${esc(c.id)}">编辑</button><button class="mini-btn" data-remove-contact="${esc(c.id)}">移除</button></div></div>`).join('')}<div class="field"><label for="setupContactPreset">预设熟人</label><select id="setupContactPreset" data-contact-preset-picker><option value="">选择人物后编辑资料…</option>${contactPresets.map(p=>`<option value="${esc(p.presetId)}">${esc(p.label)} · ${p.age}岁 · ${esc(p.occupation)}</option>`).join('')}</select></div><button class="btn secondary full" data-act="add-contact">＋ 添加初始熟人</button><p class="notice">每位正式熟人的奖池从零累积，实际消费与重要互动会形成待领奖励。最多20位，缺失的简易资料随开场正文补齐，九大档案按需手动建档。</p>`;
  $('app').innerHTML=`<main class="setup"><section id="wizard" class="wizard"><div class="wizard-hero"><div class="eyebrow">神豪终端 / 自由人生</div><h1>你的故事，由你定义。</h1><p>身份、财富和熟悉的人，都由你书写。</p><div class="steps">${[0,1,2].map(i=>`<div class="${i<=step?'active':''}"></div>`).join('')}</div><div class="step-label">${preview?'最后一步 · 确认起点':['01 · 塑造身份','02 · 设定起点','03 · 已有关系'][step]}</div></div><div class="wizard-body">${body}${view.error?`<p class="error-note">${esc(view.error)}</p>`:''}<div class="wizard-actions"><button class="btn secondary" data-act="back" ${step===0&&!preview||view.busy?'disabled':''}>返回</button><button class="btn" data-act="next" ${view.busy||!view.nativeReady?'disabled':''}>${preview?'开始我的人生':step===2?'预览开局':'下一步'}</button></div></div></section></main>`;
  for(const el of [$('beautySlider'),$('beautyNumber')].filter(Boolean))el.addEventListener('input',()=>{const score=Number(el.value);if(!Number.isInteger(score)||score<1||score>100){el.setCustomValidity('请输入1–100整数');return;}el.setCustomValidity('');draft.beautyScore=score;$('beautySlider').value=score;$('beautyNumber').value=score;const t=beautyTier(score);$('beautyHint').textContent=t.label+' · 好感加成 '+(t.modifier>0?'+':'')+t.modifier;saveDraft();});
  for(const el of [$('prowessSlider'),$('prowessNumber')].filter(Boolean))el.addEventListener('input',()=>{const score=Number(el.value);if(!Number.isInteger(score)||score<1||score>100){el.setCustomValidity('请输入1–100整数');return;}el.setCustomValidity('');draft.prowessScore=score;$('prowessSlider').value=score;$('prowessNumber').value=score;const t=prowessTier(score);$('prowessHint').textContent=t.label+' · 堕落加成 '+(t.modifier>0?'+':'')+t.modifier;saveDraft();});
  document.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('input',()=>{try{collect();saveDraft();}catch{}}));
  updateSetupConnection();
}
function updateSetupConnection(){
  if(!setup||!$('wizard'))return;
  let status=$('setupConnection');
  if(!status){status=document.createElement('p');status.id='setupConnection';status.className='notice';status.setAttribute('role','status');document.querySelector('.wizard-actions').before(status);}
  const stopped=window.parent.__CJ_SHENGHAO_SCRIPT_LOADER__?.inspect?.().off;
  status.textContent=view.busy?setupStatus(view):view.nativeReady?'':stopped?'终端暂时停用：'+stopped+'。仍可填写并保存草稿。':connectionExpired?'连接尚未完成，可继续填写；开始前请检查角色脚本与网络，页面会自动重连。':'可先填写设定，终端正在后台连接；连接完成后即可开始。';
  status.hidden=!status.textContent;
  document.querySelector('[data-act="next"]').disabled=!!view.busy||(preview&&(!api||!view.nativeReady||!!stopped));
  document.querySelector('[data-act="back"]').disabled=!!view.busy||(step===0&&!preview);
}
function prowessControl(score){const t=prowessTier(score);return `<div class="field beauty-control"><label for="prowessSlider">性能力 · 1–100</label><div class="beauty-inputs"><input id="prowessSlider" type="range" min="1" max="100" step="1" value="${score}" aria-describedby="prowessHint"><input id="prowessNumber" type="number" min="1" max="100" step="1" value="${score}" aria-label="性能力数值"></div><p id="prowessHint" class="notice">${t.label} · 堕落加成 ${t.modifier>0?'+':''}${t.modifier}</p><small class="muted">只在她亲身体会过的亲密互动里修正堕落度，不影响日常好感。</small></div>`;}
function genitalTraits(value){return `<div class="field"><label for="f__gen_traits">性器特征</label><textarea id="f__gen_traits" data-field="_gen_traits" rows="2" maxlength="300" placeholder="写形状、青筋脉络、温度或实战特质（点击可选预设，如：柱身粗壮笔直，青筋分明，充血后热度惊人）">${esc(value)}</textarea></div>`;}
function beautyControl(score){const t=beautyTier(score);return `<div class="field beauty-control"><label for="beautySlider">颜值 · 1–100</label><div class="beauty-inputs"><input id="beautySlider" type="range" min="1" max="100" step="1" value="${score}" aria-describedby="beautyHint"><input id="beautyNumber" type="number" min="1" max="100" step="1" value="${score}" aria-label="颜值数值"></div><p id="beautyHint" class="notice">${t.label} · 好感加成 ${t.modifier>0?'+':''}${t.modifier}</p><small class="muted">仅影响好感未达70时的有效正面互动，不会逐轮自动加减。</small></div>`;}
function setupSummary(d){const bodyNums=[d.heightCm?`身高${d.heightCm}CM`:'',d.weightKg?`体重${d.weightKg}KG`:'',d.shoeSizeEu?`鞋码${d.shoeSizeEu}码`:''].filter(Boolean).join(' / ')||'留空（开场由模型自动补全）';const tags=userProfileTags({user:{...d,cashCents:d.initialCashCents}}).map(t=>t.text).join(' · ');return `姓名：${d.name}\n年龄：${d.age}\n个人标签：${tags}\n身体数据：${bodyNums}\n颜值：${d.beautyScore}/100\n性能力：${d.prowessScore??70}/100（${d.genitals?.length||'18cm'} / ${d.genitals?.girth||'4.8cm'}）\n性别：${d.gender}\n外貌：${d.appearance}\n身材：${d.body}\n职业：${d.occupation}\n经历：${d.background}\n城市：${d.city}\n地点：${d.currentLocation}\n生活：${d.workLifeDescription}\n资产：${d.initialAssets.map(a=>a.name+' '+yuan(a.bookValueCents)+' · '+assetDescription(a)).join('、')||'无'}\n熟人：${d.contacts.map(c=>c.name+' '+c.relationshipLabel+' '+c.affection+'好感').join('、')||'无'}\n随机头像：${view?.prefs?.randomAvatar===false?'关闭（显示姓名首字或自行上传）':'开启（按颜值档抽卡随机配图）'}`;}
function showModal(html){fieldOptionsUI.close();modalReturn=document.activeElement;const match=html.match(/^<h3>([\s\S]*?)<\/h3>/);$('modal').innerHTML='<div class="modal-head"><h3>'+(match?match[1]:'查看详情')+'</h3><button class="modal-close" data-act="cancel" aria-label="关闭弹窗"><span>×</span></button></div><div class="modal-body">'+(match?html.slice(match[0].length):html)+'</div>';$('modalOverlay').style.display='flex';$('modal').focus();syncBottomHeight();}
function closeModal(){contactToken+=1;api?.cancelExpandContact?.();fieldOptionsUI.close();$('modalOverlay').style.display='none';$('modal').innerHTML='';modalReturn?.focus?.();syncBottomHeight();}
// rc.29：建档期间给读秒、可中止、失败在弹窗里说明原因，不再只留一个死按钮。
function stopBuildTimer(){clearInterval(buildTimer);buildTimer=null;}
function startBuildUI(){
  buildingProfile=true;stopBuildTimer();
  const modal=$('modal'),body=modal?.querySelector('.modal-body');
  if(body&&!body.querySelector('#buildStatusNote'))body.insertAdjacentHTML('beforeend','<p class="notice" id="buildStatusNote">正在结合基础设定与过往经历生成九大档案，请勿关闭页面…</p>');
  for(const el of modal?.querySelectorAll('[data-act="cancel"]')||[]){el.dataset.act='cancel-build';if(el.classList.contains('btn'))el.textContent='中止建档';}
  const t0=Date.now();
  const tick=()=>{const sec=Math.floor((Date.now()-t0)/1000);const live=$('modal')?.querySelector('[data-confirm-build]');if(!live)return;live.disabled=true;live.textContent='正在建档… ('+sec+'s)';};
  tick();buildTimer=setInterval(tick,500);
}
function failBuildUI(error){
  stopBuildTimer();buildingProfile=false;
  const modal=$('modal'),body=modal?.querySelector('.modal-body');
  body?.querySelector('#buildStatusNote')?.remove();
  if(body&&!body.querySelector('.error-note'))body.insertAdjacentHTML('beforeend','<p class="error-note">'+esc(errorText(error))+'</p>');
  const confirm=modal?.querySelector('[data-confirm-build]');
  if(confirm){confirm.disabled=false;confirm.textContent='重试建档';}
  for(const el of modal?.querySelectorAll('[data-act="cancel-build"]')||[]){el.dataset.act='cancel';if(el.classList.contains('btn'))el.textContent='关闭';}
}
const rowButtons=(text,action)=>`<div class="row"><button class="btn secondary" data-act="cancel">取消</button><button class="btn" data-act="${action}">${text}</button></div>`;
function assetForm(assetId=null){
  editingAssetId=assetId;
  const existing=assetId?draft.initialAssets.find(x=>x.assetId===assetId):null;
  const kind=existing?.kind||'HOUSE';
  const yuanVal=existing?String(Math.round((existing.bookValueCents||0)/100)):'0';
  showModal(`<h3>${existing?'编辑已有资产':'登记已有资产'}</h3><div class="field"><label for="a_kind">类别</label><select id="a_kind">${[['HOUSE','房产'],['CAR','座驾'],['BUSINESS','产业（商铺／股权／公司／会所）'],['YACHT_JET','游艇专机'],['LUXURY','奢品（名表／珠宝／箱包）'],['COLLECTIBLE','藏品（名画／古董／名酒）'],['OTHER','其他']].map(([k,label])=>`<option value="${k}" ${kind===k?'selected':''}>${label}</option>`).join('')}</select></div>${field('名称','a_name',existing?.name||'',{placeholder:'如：翠湖公寓两居室、保时捷911、百达翡丽鹦鹉螺'})}${field('估值（元）','a_value',yuanVal,{placeholder:'支持数字或带万/亿（如：1500000 或 150万）'})}${field('位置／存放地点','a_note',existing?.locationNote||'',{placeholder:'如：江城区临江住宅区、住宅地下车库、本人随身佩戴'})}${field('简易描述（50字内）','a_description',existing?.description||'',{area:true,placeholder:'写核心规格与亮点（如：约180㎡南向江景平层，胡桃木精装带私人车位；留空将自动生成）'})}<p class="notice">描述写核心亮点即可：房产写面积与地段，座驾写型号与内饰，奢品与藏品写材质与来历。留空会按资产设定补全。</p>${field('产权说明','a_owner',existing?.ownershipNote||'本人全额所有，无债务',{placeholder:'如：本人全额所有，无债务'})}<p class="notice">本版登记本人全额拥有的资产；份额与负债暂不计入。</p>${rowButtons(existing?'保存修改':'登记','save-asset')}`);
}
function contactForm(presetId='',contactId=null){contactToken+=1;editingContactId=contactId;pendingHiddenScar='';showModal(`<h3>${contactId?'编辑初始熟人':'添加初始熟人'}</h3>
<div class="field"><label for="contactPreset">预设人物</label><select id="contactPreset" data-contact-preset-edit><option value="">自由填写</option>${contactPresets.map(p=>`<option value="${esc(p.presetId)}">${esc(p.label)}</option>`).join('')}</select></div>
<div class="field"><label for="f_c_brief">一句话描述角色</label><textarea id="f_c_brief" data-field="c_brief" rows="3" maxlength="400" placeholder="一句话描述角色（比如：高冷毒舌的富家千金发小，23岁，平时爱损我其实偷偷在意我…）"></textarea></div>
<div class="row" style="justify-content:space-between;margin:-4px 0 10px"><button type="button" class="btn secondary" data-act="ai-fill-contact">✨ 模型一键补全设定</button><button type="button" class="mini-btn" data-act="toggle-contact-custom" aria-expanded="${contactId?'true':'false'}">${contactId?'收起自定义设定 ▴':'自定义全部设定 ▾'}</button></div>
<p class="notice" id="contactAiStatus">写一句话点「模型一键补全设定」，自动帮你填好姓名、外貌三围、近期目标和私密身体细节；想逐项自己捏人，点右边「自定义全部设定」即可。</p>
<div id="contactCustomFields" ${contactId?'':'hidden'}>
  ${field('姓名','c_name','',{placeholder:'如：温迎、沈清弦（必填）'})}${field('年龄','c_age',24,{type:'number',min:1,max:120,placeholder:'18–60 整数（如：25）'})}${field('与你的关系','c_relation','朋友',{placeholder:'如：合租室友、设计同事、大学学姐、健身私教'})}${field('初始好感（0–100）','c_aff',40,{type:'number',min:0,max:100,placeholder:'陌生 0–20 / 熟人 30–50 / 暧昧 60+'})}${field('初始堕落度（0–100）','c_corruption',0,{type:'number',min:0,max:100,placeholder:'清白矜持填 0；有越界或沉沦过往可填 20–60'})}${field('颜值（1–100）','c_beauty',60,{type:'number',min:1,max:100,placeholder:'清秀 65 / 美艳 80 / 倾城 90+'})}${field('职业','c_job','',{placeholder:'如：花艺主理人、财经编辑、独立插画师'})}${field('罩杯（如 C）','c_cupSize','',{placeholder:'A–G 单字母（留空将按三围与身材自动推算）'})}${field('她对你的称呼（如 哥哥）','c_addressing','',{placeholder:'如：你、学弟、老板、陆先生'})}${field('性格标签（用顿号或逗号分隔）','c_personalityTags','',{placeholder:'1–6 个短词（如：高冷、知性、慢热、护短）'})}${field('外貌','c_appearance','',{area:true,placeholder:'写发型五官、妆容与日常穿搭风格（如：乌黑长发及腰，眉目清冷端庄，常穿剪裁得体的通勤风衣）'})}${field('身材','c_body','',{area:true,placeholder:'写身形比例与体态特点（如：身材高挑匀称，常年练习瑜伽使腰臀线条格外柔美紧致）'})}${[['身高（CM）','heightCm','如：168'],['体重（KG）','weightKg','如：52'],['胸围（CM）','bustCm','如：86'],['腰围（CM）','waistCm','如：60'],['臀围（CM）','hipCm','如：90'],['鞋码（欧码）','shoeSizeEu','如：37']].map(([label,k,ph])=>field(label,'c_'+k,'',{placeholder:ph})).join('')}${field('近期目标（选填）','c_recentGoal','',{area:true,placeholder:'她眼下正奔忙的具体事务（留空将按性格原型自动生成）'})}${field('长期梦想（选填）','c_longTermDream','',{area:true,placeholder:'她心底真正向往的人生愿景（留空将按性格原型自动生成）'})}${field('已知设定与经历','c_notes','',{area:true,placeholder:'写你们是怎么认识的、平时的相处氛围（如：楼下咖啡馆店主，常去买手冲而熟络，偶尔分享新烤点心）'})}
  <div class="section-head"><h3>私密身体预设（选填，留空由系统自动生成）</h3></div>
  <div class="field"><label for="f_c_virgin">处子状态</label><select id="f_c_virgin"><option value="">未指定（随人物设定生成）</option><option value="true">仍是处子</option><option value="false">非处女（已有过往）</option></select></div>
  ${field('胸部详情与乳晕','c_chestDetail','',{area:true,placeholder:'如：D罩杯饱满水滴型，淡樱粉色乳晕，轻触即敏锐挺立（留空自动生成）'})}${field('阴部户型与色泽','c_vaginaLook','',{area:true,placeholder:'如：一线天玉缝，外唇丰润紧拢，色泽白皙浅粉（留空自动生成）'})}${field('阴毛类型','c_pubicHair','',{placeholder:'如：天生白虎 / 修剪整齐的浅色倒三角（留空自动生成）'})}${field('体香特征','c_bodyScent','',{placeholder:'如：清冽雪松尾调与雨后白茶冷香（留空自动生成）'})}${field('敏感带详情','c_traits','',{area:true,placeholder:'如：后颈与耳垂极度敏锐，被温热呼吸贴近低语时会瞬间战栗腿软（留空自动生成）'})}
  <input type="hidden" id="f_c_attitude"><input type="hidden" id="f_c_fetishes">
</div>
<label class="checkline"><input id="c_present" type="checkbox">她此刻与你在同一场景</label>
${rowButtons(contactId?'保存修改':'添加','save-contact')}`);if(contactId){const c=draft.contacts.find(x=>x.id===contactId);if(c){fillContactFields(c);$('c_present').checked=!!c.present;const brief=$('f_c_brief');if(brief)brief.value=c.briefDescription||'';const ph=c.physiology||{};for(const k of ['chestDetail','vaginaLook','pubicHair','bodyScent','traits']){const el=$('f_c_'+k);if(el)el.value=ph[k]||'';}if($('f_c_virgin'))$('f_c_virgin').value=ph.virgin===true?'true':ph.virgin===false?'false':'';
      pendingHiddenScar=c.hiddenScar||'';if($('f_c_attitude'))$('f_c_attitude').value=c.intimacy?.attitude||'';if($('f_c_fetishes'))$('f_c_fetishes').value=c.intimacy?.fetishes||'';}}else if(presetId)fillContactPreset(presetId);}
const CONTACT_AI_TEXT={
  pending:sec=>`正在按你的描述构思人设与细节… (${sec}s)`,
  done:'已补全全部设定与私密细节，可直接点「添加」，也可以点「自定义全部设定」微调。',
  offline:'终端后台还没连上，可以先点开「自定义全部设定」手动填写。',
  failed:'这次补全没成功，请点按钮重试，或点开「自定义全部设定」自己填。',
  preset:'已填入这位预设熟人的完整资料，可直接添加，或点开「自定义全部设定」微调。'
};;
function applyExpandedContact(v){if(!v)return;pendingHiddenScar=typeof v.hiddenScar==='string'?v.hiddenScar:'';if($('contactPreset'))$('contactPreset').value='';const map={c_name:v.name,c_age:v.age,c_job:v.occupation,c_relation:v.relationshipLabel,c_aff:v.affection,c_corruption:v.corruption,c_beauty:v.beautyScore,c_cupSize:v.cupSize,c_addressing:v.addressing,c_personalityTags:(v.personalityTags||[]).join('、'),c_appearance:v.appearance,c_body:v.body,c_heightCm:v.heightCm,c_weightKg:v.weightKg,c_bustCm:v.bustCm,c_waistCm:v.waistCm,c_hipCm:v.hipCm,c_shoeSizeEu:v.shoeSizeEu,c_recentGoal:v.recentGoal,c_longTermDream:v.longTermDream,c_notes:v.notes,c_chestDetail:v.chestDetail,c_vaginaLook:v.vaginaLook,c_pubicHair:v.pubicHair,c_bodyScent:v.bodyScent,c_traits:v.traits,c_attitude:v.attitude,c_fetishes:v.fetishes};for(const [key,value] of Object.entries(map)){const el=$('f_'+key);if(el)el.value=value??'';}if($('f_c_virgin'))$('f_c_virgin').value=v.virgin===true?'true':v.virgin===false?'false':'';}
async function fillContactByAi(button){const status=$('contactAiStatus'),say=text=>{if(status)status.textContent=text;};const brief=($('f_c_brief')?.value||'').trim();if(brief.length<2)throw Error('CONTACT_BRIEF_REQUIRED');if(!api||!api.expandContact){say(CONTACT_AI_TEXT.offline);return;}const myToken=contactToken;button.disabled=true;let seconds=0;say(CONTACT_AI_TEXT.pending(seconds));const timer=setInterval(()=>say(CONTACT_AI_TEXT.pending(++seconds)),1000);try{const filled=await api.expandContact(brief);if(myToken!==contactToken||!$('f_c_brief'))return;applyExpandedContact(filled);say(CONTACT_AI_TEXT.done);const box=$('contactCustomFields');if(box)box.hidden=false;const toggle=document.querySelector('[data-act="toggle-contact-custom"]');if(toggle){toggle.setAttribute('aria-expanded','true');toggle.textContent='收起自定义设定 ▴';}}catch(error){console.warn('[神豪终端界面]',error.message);if(myToken===contactToken){const code=/^[A-Z_]+$/.test(String(error.message))?'（'+error.message+'）':'';say(CONTACT_AI_TEXT.failed+code);}}finally{clearInterval(timer);button.disabled=false;}}
function fillContactFields(p){for(const [key,value] of Object.entries(contactPresetValues(p))){const input=$('f_'+key);if(input)input.value=value??'';}}
function fillContactPreset(presetId){const p=contactPresets.find(p=>p.presetId===presetId);if(!p)return;contactToken+=1;api?.cancelExpandContact?.();pendingHiddenScar='';if($('f_c_attitude'))$('f_c_attitude').value='';if($('f_c_fetishes'))$('f_c_fetishes').value='';fillContactFields(p);$('c_present').checked=false;$('contactPreset').value=presetId;const st=$('contactAiStatus');if(st)st.textContent=CONTACT_AI_TEXT.preset;}
const val=k=>$('f_'+k).value;
const woman=id=>view.state.characters[id];
const visible=()=>Object.values(view.state.characters).filter(c=>c.trackingState==='RECORDED');
const rel=c=>`<span class="tag pink">${esc(c.relationshipLabel)}</span>`;
function mediaKey(pid,slot){return view.chatKey+':'+pid+':'+slot;}
// rc.31 随机头像：清单内联保底（测试期带 data URL），远程可用时覆盖；选中后写进 avatarRef 固定。
let avatarManifest=null,avatarBaseUrl='';
function randomAvatarUrl(pid){
  if(!view?.prefs||view.prefs.randomAvatar===false||!avatarManifest)return '';
  const c=view.state?.characters?.[pid];
  if(!c||c.beautyScore===null||c.beautyScore===undefined)return '';
  let id=c.avatarRef;
  if(!id){
    const assign=assignAll(view.state.characters,{tiers:avatarManifest.tiers,items:avatarManifest.items,chatSeed:view.state.meta?.initKey||''});
    id=assign[pid]||'';
  }
  if(!id)return '';
  return avatarUrl(findItem(avatarManifest.items,id),avatarManifest,avatarBaseUrl);
}
function image(pid,slot,alt){
  const k=mediaKey(pid,slot),url=imageCache[k];
  if(url)return `<img data-media="${esc(k)}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">`;
  if(slot==='avatar'){const rand=randomAvatarUrl(pid);if(rand)return `<img data-rand-avatar="${esc(pid)}" src="${esc(rand)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">`;}
  return '';
}
function avatar(c){return `<div class="avatar">${image(c.id,'avatar',c.name)||esc(c.name.slice(0,1))}</div>`;}
const screens=createScreens({data:()=>({view,expanded,section,privateSection,assetTab,mineExpanded,consumptionPage,calendarMonth,selectedDate,sceneSectionByChar:sceneSection}),esc,yuan,image,avatar});
const sceneScreen=()=>screens.scene(),womenScreen=()=>screens.women(),detailScreen=c=>screens.detail(c),mineScreen=()=>screens.mine(),wealthScreen=()=>screens.wealth(),wheelScreen=()=>screens.wheelHub(),settingsScreen=()=>screens.settings(),hiddenScreen=()=>screens.hidden();
function phone(){
  if(!view?.state){$('app').innerHTML='';api.geometry?.({width:58,height:92});return;}
  if(detail&&!view.state.characters[detail]){detail=null;section=null;}
  if(folded){
    if(view.prefs.displayDock==='bottom'){const s=view.state;
      // rc.37：折叠条 = 52px 条 + 2×2 边框 = 56px，正好等于 iframe 视口，不再挤出一条滚动条。
      document.body.classList.remove('is-bottom-dock');
      document.body.classList.add('is-folded-bar');
      $('app').innerHTML=`<button class="folded folded-bar show" id="folded" aria-label="打开神豪终端"><span class="folded-bar-left"><b>✦ 神豪终端</b><small>${esc(s.world.date)} ${esc(s.world.time)} · ${esc(s.scene.location)}</small></span><span class="folded-bar-right"><b>${yuan(s.user.cashCents)}</b><small>点击展开 ⌄</small>${pendingNotices().length?'<span class="dot" style="display:block"></span>':''}</span></button>`;
      api.geometry?.({width:365,height:56});
      return;
    }
    document.body.classList.remove('is-bottom-dock');
    document.body.classList.add('is-folded-bar');
    $('app').innerHTML=`<button class="folded show" id="folded" aria-label="打开神豪终端"><span class="cam"></span><b>✦</b><small>神豪终端</small>${pendingNotices().length?'<span class="dot" style="display:block"></span>':''}</button>`;api.geometry?.({width:58,height:92});bindDrag($('folded'),true);return;
  }
  document.body.classList.remove('is-folded-bar');
  const old=$('phoneScreen')?.scrollTop || 0;
  const isBottom=view.prefs.displayDock==='bottom';
  document.body.classList.toggle('is-bottom-dock',isBottom);
  const title=calendarOpen?'日历':hidden?'已隐藏人物':settings?'终端设置':detail?'人物档案':({scene:WHEEL_COPY.nav.scene,women:WHEEL_COPY.nav.women,mine:WHEEL_COPY.nav.mine,wealth:WHEEL_COPY.nav.wealth,wheel:WHEEL_COPY.nav.wheel}[tab]);
  const body=calendarOpen?screens.calendar():hidden?hiddenScreen():settings?settingsScreen():detail&&woman(detail)?detailScreen(woman(detail)):tab==='scene'?sceneScreen():tab==='women'?womenScreen():tab==='wealth'?wealthScreen():tab==='wheel'?wheelScreen():mineScreen();
  const tabs=[['scene','⌂',WHEEL_COPY.nav.scene],['women','♡',WHEEL_COPY.nav.women],['mine','▣',WHEEL_COPY.nav.mine],['wealth','◈',WHEEL_COPY.nav.wealth],['wheel','✦',WHEEL_COPY.nav.wheel]];
  const wideNav=isBottom?`<div class="wide-nav" role="group" aria-label="终端导航">${tabs.map(([id,icon,name])=>`<button class="wide-tab ${tab===id?'active':''}" data-tab="${id}" aria-current="${tab===id?'page':'false'}"><span class="i" aria-hidden="true">${icon}</span>${name}</button>`).join('')}</div>`:'';
  $('app').innerHTML=`<div class="phone${isBottom?' is-bottom-dock':''}" id="phone"><header class="phone-hd" id="phoneHandle"><div><b>${title}</b><div class="muted" style="font-size:calc(9px * var(--cj-font-scale,1))">YOUR STORY · YOUR FORTUNE</div></div>${wideNav}<div class="hdbtns"><button class="roundbtn" data-act="settings" id="gear" aria-label="打开设置">⚙</button><button class="roundbtn" data-act="fold" id="fold" aria-label="${isBottom?'收起终端':'折叠手机'}">${isBottom?'−':'×'}</button></div></header><main class="phone-screen" id="phoneScreen">${view.error?`<div class="error-note" role="status">${esc(view.error)}</div>`:''}${view.busy?'<p class="notice" role="status">正在记录这段故事……</p>':''}${body}</main><nav class="bottom" aria-label="终端导航" ${settings||detail||hidden||calendarOpen?'style="display:none"':''}>${tabs.map(([id,icon,name])=>`<button class="tab ${tab===id?'active':''}" data-tab="${id}" aria-current="${tab===id?'page':'false'}"><span class="i" aria-hidden="true">${icon}</span>${name}</button>`).join('')}</nav></div>`;
  if(isBottom)syncBottomHeight();else{const standard=view.prefs.phoneSize==='standard';api.geometry?.({width:365,height:730,scale:standard?1:.82});}
  $('phoneScreen').scrollTop=old;if(!isBottom)bindDrag($('phoneHandle'),false);wireImages();loadMedia();playPending();
}
// rc.28：底部宽屏模式不再套 680px 固定高，而是按内容自然伸缩。
function syncBottomHeight(){
  if(setup||folded||view?.prefs?.displayDock!=='bottom'||!$('phone'))return;
  const modalH=$('modalOverlay')?.style.display==='flex'?460:0;
  const h=Math.max(260,modalH,$('phone').scrollHeight+4);
  api?.geometry?.({width:365,height:h,wide:true});
}
function bindDrag(handle,mini){let controller=null;if(!handle||!api?.dragStart)return;handle.addEventListener('pointerdown',e=>{if(controller||e.button!==0||e.target.closest('button')&&e.target.closest('button')!==handle)return;e.preventDefault();dragged=true;handle.setPointerCapture(e.pointerId);controller=api.dragStart({x:e.clientX,y:e.clientY,mini},result=>{dragged=result.moved;if(mini&&!result.moved){folded=false;phone();}clearTimeout(dragCancel);dragCancel=setTimeout(()=>dragged=false,250);});});handle?.addEventListener('pointermove',e=>controller?.move({x:e.clientX,y:e.clientY}));handle?.addEventListener('pointerup',()=>{const active=controller;controller=null;active?.end();});handle?.addEventListener('pointercancel',()=>{controller?.cancel();controller=null;});}
function pendingNotices(){return Object.values(view?.state?.notifications||{}).filter(n=>!seen.has(n.notificationId)&&view.state.rewardEvents[n.relatedEventId]&&woman(view.state.rewardEvents[n.relatedEventId].characterId)?.trackingState==='RECORDED');}
function playPending(){if(folded||$('fx').classList.contains('show'))return;const n=pendingNotices()[0];if(!n)return;const e=view.state.rewardEvents[n.relatedEventId];seen.add(n.notificationId);api.preferences({seen:[...seen]});showFx(e.label,e.score+'分','+ '+yuan(e.cashbackCents),'已计入'+woman(e.characterId).name+'专属奖池 · 当前 '+yuan(poolParts(view.state,e.characterId).total));}
function showFx(title,score,money,note){$('fx').innerHTML=`<div class="fx-inner"><div class="crown">✦ ✧ ✦</div><div class="over">属于你们的瞬间</div><h2>${esc(title)}</h2><div class="score">${esc(score)}</div><div class="money">${esc(money)}</div><p>${esc(note)}</p><button data-act="close-fx">继续</button></div>`;$('fx').classList.add('show');$('fx').focus();clearTimeout(fxTimer);fxTimer=setTimeout(closeFx,3000);}
function closeFx(){$('fx').classList.remove('show');clearTimeout(fxTimer);setTimeout(playPending,100);}
async function operationProfileLock(personRef,locked){view=await api.action({operationId:uid(),type:'PLAYER_LOCK_PROFILE',personRef,locked,expectedRevision:view.state.meta.revision},view.lineage);phone();}
async function operation(type,personRef,tempId){const op=pendingOperation?.type===type&&pendingOperation?.personRef===personRef?pendingOperation:{operationId:uid(),type,personRef,tempId,expectedRevision:view.state.meta.revision};pendingOperation=op;const next=await api.action(op,view.lineage);pendingOperation=null;view=next;return next;}
async function db(){return new Promise((resolve,reject)=>{const req=indexedDB.open('cj-shenghao-media-v2',1);req.onupgradeneeded=()=>req.result.createObjectStore('images');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function mediaStore(k,value){const connection=await db();return new Promise((resolve,reject)=>{const tx=connection.transaction('images',value===undefined?'readonly':'readwrite'),store=tx.objectStore('images');let request;if(value===undefined)request=store.get(k);else if(value===null)request=store.delete(k);else request=store.put(value,k);tx.oncomplete=()=>{connection.close();resolve(request.result);};tx.onerror=()=>{connection.close();reject(tx.error);};});}
async function loadMedia(){const chat=view.chatKey,people=['USER',...Object.keys(view.state.characters)];let changed=false;for(const p of people)for(const slot of ['avatar','portrait']){const k=mediaKey(p,slot);if(Object.hasOwn(imageCache,k))continue;try{imageCache[k]=(await mediaStore(k))||'';if(imageCache[k])changed=true;}catch{imageCache[k]='';}}if(changed&&chat===view.chatKey)phone();}
function wireImages(){document.querySelectorAll('img[data-media],img[data-rand-avatar]').forEach(img=>img.addEventListener('error',()=>{img.replaceWith(document.createTextNode(img.closest('.avatar,.user-avatar-btn')?(img.alt||'人').slice(0,1):'暂无立绘'));}));}
function imageEditor(pid,slot){currentMedia=pid+':'+slot;const url=imageCache[mediaKey(pid,slot)]||'';showModal(`<h3>${pid==='USER'?'我的头像':slot==='avatar'?'人物头像':'人物立绘'}</h3>${pid!=='USER'?`<div class="image-slot-switch"><button class="mini-btn" data-edit-image="${esc(pid)}:avatar">人物头像</button><button class="mini-btn" data-edit-image="${esc(pid)}:portrait">人物立绘</button></div>`:''}<div class="image-editor-preview">${url?`<img src="${esc(url)}" alt="当前图片">`:'姓名头像与主题立绘占位'}</div><div class="field"><label for="mediaFile">本地上传</label><input id="mediaFile" type="file" accept="image/png,image/jpeg,image/webp"></div>${field('HTTPS 图片链接','image_url',url.startsWith('https:')?url:'')}<p class="notice">图片保存在当前浏览器，不随聊天跨设备同步。支持PNG、JPEG、WebP，原图不超过8MB。</p><div class="row"><button class="btn secondary" data-act="cancel">关闭</button><button class="btn secondary" data-act="clear-image">移除</button><button class="btn" data-act="save-url">保存链接</button></div>`);$('mediaFile').onchange=async()=>{try{const file=$('mediaFile').files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('BAD_IMAGE');const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error('BAD_IMAGE');}const scale=Math.min(1,(slot==='avatar'?480:1400)/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const value=canvas.toDataURL('image/webp',0.85);await saveImage(value);closeModal();phone();notify('图片已保存');}catch{notify('图片暂时无法保存，请换一张较小的图片。');}};}
async function saveImage(value){const [pid,slot]=currentMedia.split(':'),k=mediaKey(pid,slot);await mediaStore(k,value);imageCache[k]=value||'';}
async function actions(e){const b=e.target.closest('button,[data-preview-image]');if(!b)return;try{
  if(b.id==='folded'){if(dragged)return;folded=false;if(view.prefs.displayDock==='bottom')api.preferences({dockExpanded:true});phone();return;}
  const d=b.dataset,a=d.act;
  if(d.setupRandomAvatar){const on=d.setupRandomAvatar==='on';const patch={randomAvatar:on};if(api&&api.read().chatKey===activeChat)api.preferences(patch);else{draftStore?.write(activeChat,patch);if(view)view={...view,prefs:{...(view.prefs||{}),...patch}};}lastSignature='';wizard();return;}
  if(d.cash){collect();draft.initialCashCents=cents(d.cash);delete draft.openingPresetId;saveDraft();wizard();}
  if(d.openingPreset){collect();draft=applyOpeningPreset(draft,d.openingPreset);preview=false;saveDraft();wizard();}
  if(d.removeAsset){draft.initialAssets=draft.initialAssets.filter(x=>x.assetId!==d.removeAsset);saveDraft();wizard();}
  if(d.editAsset){collect();assetForm(d.editAsset);}
  if(d.editContact){contactForm('',d.editContact);}
  if(d.removeContact){draft.contacts=draft.contacts.filter(x=>x.id!==d.removeContact);saveDraft();wizard();}
  if(d.tab){calendarOpen=false;tab=d.tab;detail=null;settings=false;hidden=false;phone();$('phoneScreen').scrollTop=0;}
  if(d.consumptionPage!==undefined){consumptionPage=Number(d.consumptionPage);phone();}
  if(d.detail){detail=d.detail;section=null;privateSection=null;consumptionPage=0;phone();$('phoneScreen').scrollTop=0;}
  if(d.expand){expanded.has(d.expand)?expanded.delete(d.expand):expanded.add(d.expand);phone();}
  if(d.star){await operation('PLAYER_STAR',d.star);phone();notify(woman(d.star).starred?'已加入特别关注，离场时会同步异地实况':'已取消特别关注');}
  if(d.section!==undefined){section=section===Number(d.section)?null:Number(d.section);phone();}
  if(d.privateSection!==undefined){privateSection=privateSection===Number(d.privateSection)?null:Number(d.privateSection);phone();}
  if(d.sceneSection){const [cid,index]=String(d.sceneSection).split(':');sceneSection.set(cid,sceneSection.get(cid)===Number(index)?null:Number(index));phone();}
  if(d.assetTab){assetTab=d.assetTab;phone();}
  if(d.openWheel){closeModal();api.openWheel?.(d.openWheel,{cardId:d.cardId||''});return;}
  if(d.act==='open-bag'){bagModal();return;}
  if(d.act==='open-shop'){shopModal();return;}
  if(d.redeemCard){try{const next=await runWheelOp({type:'PLAYER_CARD_REDEEM',cardId:d.redeemCard});view=next.view;bagModal();notify(fill(WHEEL_COPY.overlay.casino.cashOutOk,{value:next.result?.points??0}));}catch(e){notify(errorText(e));}return;}
  if(d.bagTab){bagTab=d.bagTab;bagModal();return;}
  if(d.shopTab){shopTab=d.shopTab;shopModal();return;}
  if(d.lockCard){try{const next=await runWheelOp({type:'PLAYER_CARD_LOCK',cardId:d.lockCard,locked:!d.locked});view=next.view;bagModal();notify(d.locked?WHEEL_COPY.bag.binder.unlockedToast:WHEEL_COPY.bag.binder.lockedToast);}catch(e){notify(errorText(e));}return;}
  if(d.usePrize){prizeScheduleForm(d.usePrize);return;}
  if(d.savePrize){
    const who=$('pz_who')?.value||'';
    try{const next=await runWheelOp({type:'PLAYER_USE_WHEEL_PRIZE',itemId:d.savePrize,date:val('pz_date'),time:val('pz_time'),location:val('pz_location'),notes:val('pz_notes'),participants:who?[who]:[]});view=next.view;closeModal();phone();notify(WHEEL_COPY.bag.prizes.scheduleOk);}
    catch(e){notify(errorText(e));}
    return;
  }
  if(d.viewSchedule){
    const a=view.state.calendar?.appointments?.[d.viewSchedule];
    if(a)showModal(`<h3>${esc(a.title)}</h3><p class="muted">${esc(a.date)} ${esc(a.time)} · ${esc(a.location)}</p><p>${esc(a.notes||'')}</p><div class="row"><button class="btn" data-act="cancel">关闭</button></div>`);
    return;
  }
  if(d.cancelSchedule){
    const a=view.state.calendar?.appointments?.[d.cancelSchedule];
    if(!a)return;
    try{view=await api.appointment({...a,status:'CANCELLED'},view.lineage);bagModal();notify(WHEEL_COPY.bag.prizes.cancelOk);}catch(e){notify(errorText(e));}
    return;
  }
  if(d.useItem){useItemForm(d.useItem);return;}
  if(d.confirmUseItem){
    const target=$('ui_target')?.value||'';
    try{const next=await runWheelOp({type:'PLAYER_USE_SURREAL_ITEM',itemId:d.confirmUseItem,targetCharacterId:target||undefined});view=next.view;const res=next.result||{};closeModal();bagModal();
      const def=SURREAL_ITEM_BY_ID[res.refId]||{name:''};
      if(res.effectSummary==='mirror')notify(fill(WHEEL_COPY.bag.surreal.mirrorOk,{target:woman(target)?.name||''}));
      else if(res.effectSummary==='perfume')notify(WHEEL_COPY.bag.surreal.perfumeOk);
      else notify(fill(WHEEL_COPY.bag.surreal.useOk,{name:def.name||''}));}
    catch(e){notify(errorText(e));}
    return;
  }
  if(d.usePrompt){promptForm(d.usePrompt);return;}
  if(d.toylink){const t=window.parent.__TOYLINK__;if(t&&typeof t.open==='function'){closeModal();t.open();}else notify(WHEEL_COPY.bag.surreal.toylinkMissing);return;}
  if(d.shopBuy){try{await runWheelOp({type:'PLAYER_SHOP_BUY',catalogId:d.shopBuy});closeModal();shopModal();}catch(e){if(e?.message==='INSUFFICIENT_POINTS'){const price=Number(b.dataset.price)||0;notify(fill(WHEEL_COPY.shop.insufficientPoints,{gap:Math.max(0,price-(view.state.wheel?.starPoints||0))}));}else notify(errorText(e));}return;}
  if(d.theme){api.preferences({theme:d.theme});theme();phone();}
  if(d.phoneSize){api.preferences({phoneSize:d.phoneSize,fontSize:d.phoneSize==='standard'?'small':'medium'});theme();phone();}
  if(d.displayDock){api.preferences({displayDock:d.displayDock,dockExpanded:d.displayDock==='bottom'?!folded:view.prefs.dockExpanded});phone();notify(d.displayDock==='bottom'?'已固定到最新消息正文底部':'已切换为悬浮小手机');}
  if(d.fontSize){api.preferences({fontSize:d.fontSize});theme();phone();}
  if(d.randomAvatar){api.preferences({randomAvatar:d.randomAvatar==='on'});lastSignature='';phone();}
  if(d.monthStep){const [y,m]=(calendarMonth||view.state.world.date.slice(0,7)).split('-').map(Number),date=new Date(Date.UTC(y,m-1+Number(d.monthStep),1));calendarMonth=date.toISOString().slice(0,7);selectedDate=calendarMonth+'-01';phone();}
  if(d.day){selectedDate=d.day;phone();}
  if(d.cancelAppointment){const item=view.state.calendar.appointments[d.cancelAppointment];await api.appointment({...item,status:'CANCELLED'},view.lineage);phone();}
  if(d.prepareAppointment){const text=await api.prepareAppointment(d.prepareAppointment);showModal('<h3>接续这个约定</h3><p>以下文字可复制到正文继续，当前日期与地点不会自动改变。</p><textarea class="story-draft" readonly>'+esc(text)+'</textarea><div class="row"><button class="btn" data-act="cancel">关闭</button></div>');}
  if(d.editImage){const [pid,slot]=d.editImage.split(':');imageEditor(pid,slot);}
  if(d.previewImage){const [pid,slot]=d.previewImage.split(':'),url=imageCache[mediaKey(pid,slot)];if(url)showModal(`<div class="image-viewer"><img src="${esc(url)}" alt="完整图片"></div><div class="row"><button class="btn" data-act="cancel">关闭</button><button class="btn secondary" data-edit-image="${esc(pid)}:${esc(slot)}">更换图片</button></div>`);else imageEditor(pid,slot);}
  if(d.withdraw){const c=woman(d.withdraw),q=withdrawalQuote(view.state,c.id);withdrawalPreview={personRef:c.id,revision:view.state.meta.revision,quote:JSON.stringify(q)};showModal(`<h3>确认提现</h3><p>${esc(c.name)} · 本期原始奖池 ${yuan(q.total)}</p><p>${esc(q.tier.label)} · 理论到账 ${yuan(q.gross)}</p>${q.debt?`<p>退款追回抵扣 ${yuan(q.recoveryCents)}，待抵扣余额 ${yuan(q.debt-q.recoveryCents)}</p>`:''}<p><b>本次实到 ${yuan(q.paidCents)}</b></p><p class="muted">本期领清后，新消费与有效互动继续积累。倍率以本次确认时的余额为准。</p><div class="row"><button class="btn secondary" data-act="cancel">取消</button><button class="btn gold" data-confirm-withdraw="${esc(c.id)}" data-lineage="${esc(view.lineage)}">确认提现</button></div>`);}
  if(d.confirmWithdraw){if(d.lineage!==view.lineage)throw Error('STALE_SOURCE');const c=woman(d.confirmWithdraw);if(withdrawalPreview?.personRef!==c.id||withdrawalPreview.revision!==view.state.meta.revision||withdrawalPreview.quote!==JSON.stringify(withdrawalQuote(view.state,c.id)))throw Error('WITHDRAWAL_REVIEW_REQUIRED');b.disabled=true;const opId=await operation('PLAYER_WITHDRAW',c.id);closeModal();const w=Object.values(view.state.withdrawals).filter(w=>w.characterId===c.id).at(-1);if(w){showFx('提现成功',w.tierLabel,'+ '+yuan(w.paidCents),'本期原始奖池 '+yuan(w.basePoolCents)+(w.recoveryCents?' · 抵扣 '+yuan(w.recoveryCents):'')+' · 已转入可用余额');}phone();}
  if(d.hide){const c=woman(d.hide);showModal(`<h3>隐藏${esc(c.name)}？</h3><p>隐藏后，她将从“此刻”和“她们”中移除，暂停状态追踪与奖池累计。已有资料和奖池保留，可在设置中恢复；隐藏期间奖励不追补，真实支出仍会扣款。</p><div class="row"><button class="btn secondary" data-act="cancel">取消</button><button class="btn" data-confirm-hide="${esc(c.id)}" data-lineage="${esc(view.lineage)}">确认隐藏</button></div>`);}
  if(d.confirmHide){if(d.lineage!==view.lineage)throw Error('STALE_SOURCE');b.disabled=true;await operation('PLAYER_HIDE',d.confirmHide);closeModal();detail=null;phone();notify('已隐藏，可在设置中恢复');}
  if(d.buildProfile){showModal(`<h3>补全人物档案？</h3><p>将根据基础资料和已有经历，补全九大档案。建档后，该人物在场且档案未锁定时，每轮正文生成都会读取完整档案，增加输入量。你可以随时锁定档案，停止自动发送。</p><div class="row"><button class="btn secondary" data-act="cancel">取消</button><button class="btn" data-confirm-build="${esc(d.buildProfile)}" data-lineage="${esc(view.lineage)}">确认建档</button></div>`);}
  if(d.confirmBuild){if(d.lineage!==view.lineage)throw Error('STALE_SOURCE');b.disabled=true;startBuildUI();
    try{view=await api.buildProfile(d.confirmBuild,d.lineage);stopBuildTimer();buildingProfile=false;closeModal();phone();notify('九大档案已保存');}
    catch(error){notify(errorText(error));if(error?.message==='BUILD_CANCELLED')closeModal();else failBuildUI(error);}
    return;}
  if(d.lockProfile){const c=woman(d.lockProfile);if(c.profileLocked){await operationProfileLock(c.id,false);notify('已解除锁定，人物在场时将随每轮正文发送九大档案。');}else showModal(`<h3>锁定这份档案？</h3><p>锁定后，从下一次生成起，不再自动发送该人物的九大档案。档案内容保留，仍可查看；在场时仍发送简易资料和当前状态。</p><div class="row"><button class="btn secondary" data-act="cancel">取消</button><button class="btn" data-confirm-lock="${esc(c.id)}" data-lineage="${esc(view.lineage)}">确认锁定</button></div>`);}
  if(d.confirmLock){if(d.lineage!==view.lineage)throw Error('STALE_SOURCE');b.disabled=true;await operationProfileLock(d.confirmLock,true);closeModal();}
  if(d.restore){await operation('PLAYER_RESTORE',d.restore);phone();notify('已恢复原有档案');}
  if(d.hideTemp){showModal(`<h3>不再关注这位人物？</h3><p>将从现场列表移除，可在设置中恢复关注。</p><div class="row"><button class="btn secondary" data-act="cancel">取消</button><button class="btn" data-confirm-hide-temp="${esc(d.hideTemp)}" data-lineage="${esc(view.lineage)}">确认</button></div>`);}
  if(d.confirmHideTemp){if(d.lineage!==view.lineage)throw Error('STALE_SOURCE');b.disabled=true;await operation('PLAYER_HIDE_TEMP',undefined,d.confirmHideTemp);closeModal();phone();}
  if(d.restoreTemp){await operation('PLAYER_RESTORE_TEMP',undefined,d.restoreTemp);phone();}
  switch(a){
    case 'calendar':calendarOpen=true;settings=false;detail=null;calendarMonth=view.state.world.date.slice(0,7);selectedDate=view.state.world.date;phone();break;
    case 'close-calendar':calendarOpen=false;tab='scene';phone();break;
    case 'add-appointment':showModal('<h3>添加约定</h3>'+field('事项','ap_title','')+'<div class="form-row">'+field('日期','ap_date',selectedDate||view.state.world.date,{type:'date'})+field('时间','ap_time',view.state.world.time,{type:'time'})+'</div>'+field('地点','ap_location',view.state.scene.location)+field('备注','ap_notes','',{area:true})+rowButtons('保存约定','save-appointment'));break;
    case 'save-appointment':await api.appointment({id:'appt_'+uid(),title:val('ap_title').trim(),date:val('ap_date'),time:val('ap_time'),location:val('ap_location'),notes:val('ap_notes'),participants:[],status:'PLANNED'},view.lineage);closeModal();phone();notify('约定已保存');break;
    case 'next':collect();if(preview){if(!api||!view.nativeReady||view.busy)return;b.disabled=true;await api.submit(draft);wizard();}else{const missing=missingInStep(draft,step);if(missing.length){const el=document.querySelector(`#wizard [data-field="${missing[0]}"]`);el?.focus();el?.scrollIntoView?.({block:'center'});throw Error('INVALID_TEXT');}if(step===2){validateDraft(draft);preview=true;}else step++;saveDraft();wizard();}break;
    case 'back':collect();if(preview)preview=false;else step=Math.max(0,step-1);saveDraft();wizard();break;
    case 'add-asset':collect();assetForm(null);break;
    case 'save-asset':{const name=val('a_name').trim();if(!name)throw Error('INVALID_TEXT');const kind=$('a_kind').value,bookValueCents=cents(val('a_value')),locationNote=val('a_note'),ownershipNote=val('a_owner').trim()||'本人全额所有，无债务';const item={assetId:editingAssetId||'asset_'+uid(),kind,name,bookValueCents,ownershipNote,locationNote,description:assetDescription({name,kind,bookValueCents,locationNote,description:val('a_description')})};const next={...draft,initialAssets:editingAssetId?draft.initialAssets.map(old=>old.assetId===editingAssetId?item:old):[...draft.initialAssets,item]};validateDraft(next);draft=next;editingAssetId=null;saveDraft();closeModal();wizard();break;}
    case 'add-contact':contactForm();break;
    case 'toggle-contact-custom':{const box=$('contactCustomFields');if(box){box.hidden=!box.hidden;b.setAttribute('aria-expanded',String(!box.hidden));b.textContent=box.hidden?'自定义全部设定 ▾':'收起自定义设定 ▴';}break;}
    case 'ai-fill-contact':{await fillContactByAi(b);break;}
    case 'save-contact':{const brief=val('c_brief').trim();const name=val('c_name').trim();if(!name){const box=$('contactCustomFields');if(box)box.hidden=false;const tb=document.querySelector('[data-act="toggle-contact-custom"]');if(tb){tb.setAttribute('aria-expanded','true');tb.textContent='收起自定义设定 ▴';}throw Error('CONTACT_NAME_REQUIRED');}const physiology={virgin:val('c_virgin')==='true'?true:val('c_virgin')==='false'?false:null,chestDetail:val('c_chestDetail'),vaginaLook:val('c_vaginaLook'),pubicHair:val('c_pubicHair'),bodyScent:val('c_bodyScent'),traits:val('c_traits')};const c={id:editingContactId||'char_'+uid(),name,age:Number(val('c_age')),beautyScore:val('c_beauty').trim()===''?undefined:Number(val('c_beauty')),affection:val('c_aff').trim()===''?40:Number(val('c_aff')),corruption:Number(val('c_corruption')||0),occupation:val('c_job'),cupSize:val('c_cupSize').trim(),addressing:val('c_addressing').trim(),relationshipLabel:val('c_relation'),personalityTags:val('c_personalityTags').split(/[、,，]/).map(x=>x.trim()).filter(Boolean),appearance:val('c_appearance'),body:val('c_body'),...Object.fromEntries(['heightCm','weightKg','bustCm','waistCm','hipCm','shoeSizeEu'].map(k=>[k,val('c_'+k).trim()?Number(val('c_'+k)):null])),notes:val('c_notes'),recentGoal:val('c_recentGoal').trim(),longTermDream:val('c_longTermDream').trim(),hiddenScar:pendingHiddenScar||(editingContactId?draft.contacts.find(x=>x.id===editingContactId)?.hiddenScar:contactPresets.find(p=>p.presetId===$('contactPreset')?.value)?.hiddenScar)||'',briefDescription:brief,physiology,intimacy:{attitude:val('c_attitude').trim(),fetishes:val('c_fetishes').trim()},present:$('c_present').checked};const next={...draft,contacts:editingContactId?draft.contacts.map(old=>old.id===editingContactId?c:old):[...draft.contacts,c]};validateDraft(next);draft=next;editingContactId=null;saveDraft();closeModal();wizard();break;}
    case 'cancel':closeModal();break;
    case 'cancel-build':{stopBuildTimer();buildingProfile=false;api.cancelBuildProfile?.();closeModal();notify('已取消本次人物建档。');break;}
    case 'fold':{folded=true;closeModal();if(view.prefs.displayDock==='bottom')api.preferences({dockExpanded:false});phone();break;}
    case 'settings':calendarOpen=false;settings=!settings;detail=null;hidden=false;phone();break;
    case 'close-settings':settings=false;hidden=false;phone();break;
    case 'hidden-list':hidden=true;phone();break;
    case 'back-settings':hidden=false;settings=true;phone();break;
    case 'back-women':detail=null;section=null;privateSection=null;tab='women';phone();break;
    case 'close-fx':closeFx();break;
    case 'check-update':b.disabled=true;try{const r=await api.checkUpdate();reviewedUpdate=r;showModal('<h3>'+(r.paused?'脚本已暂停':r.newer?(r.rollback?'可用回退版本 ':'有新版本 ')+esc(r.version):'版本检查')+'</h3><p>当前版本 '+esc(r.current)+'<br>公开版本 '+esc(r.version)+'</p><p>'+(r.newer?(r.canApply?'发布本体会在下次打开时自动加载，也可现在重新加载终端。':'本次包含世界书或变量结构变化，请下载并导入新版角色卡。'):(r.paused?'发布者已暂停脚本，请查看下方说明。':r.current===r.version?'当前已是发布版本。':'当前运行版本与发布指针不同。'))+'</p>'+(r.notes?'<p class="notice">'+esc(r.notes)+'</p>':'')+'<div class="row"><button class="btn secondary" data-act="cancel">关闭</button>'+(r.newer?(r.canApply?'<button class="btn" data-act="apply-update">重新加载</button>':'<a target="_blank" rel="noopener noreferrer" href="'+esc(r.url)+'">查看新版</a>'):'')+'</div>');}catch{showModal('<h3>暂时无法检测更新</h3><p>暂时无法取得发布版本，请检查网络后重试。</p><div class="row"><button class="btn secondary" data-act="cancel">关闭</button><button class="btn" data-act="check-update">重试</button></div>');}finally{b.disabled=false;}break;
    case 'apply-update':b.disabled=true;await api.applyUpdate(reviewedUpdate);closeModal();notify('更新已完成，请重新打开终端。');break;
    case 'save-url':{const url=new URL(val('image_url'));if(url.protocol!=='https:'||url.username||url.password)throw Error('BAD_IMAGE');await saveImage(url.href);closeModal();phone();break;}
    case 'clear-image':await saveImage(null);closeModal();phone();break;
  }
}catch(error){console.warn('[神豪终端界面]',error.message);notify(errorText(error));b.disabled=false;if(setup)wizard();}}
document.addEventListener('click',actions);
document.addEventListener('toggle',e=>{if(e.target.matches?.('details[data-mine-section]')){const key=e.target.dataset.mineSection;e.target.open?mineExpanded.add(key):mineExpanded.delete(key);}requestAnimationFrame(syncBottomHeight);},true);
document.addEventListener('change',e=>{if(e.target.matches('[data-contact-preset-picker]')&&e.target.value){const id=e.target.value;e.target.value='';contactForm(id);}if(e.target.matches('[data-contact-preset-edit]')&&e.target.value)fillContactPreset(e.target.value);});
$('modalOverlay').addEventListener('click',e=>{if(e.target===$('modalOverlay')&&!buildingProfile)closeModal();});
document.addEventListener('keydown',e=>{if(fieldOptionsUI.keydown(e))return;if(e.key==='Escape'){if(!buildingProfile)closeModal();closeFx();}if(e.key==='Tab'&&$('modalOverlay').style.display==='flex'){const nodes=[...$('modal').querySelectorAll('button,input,textarea,select,a')].filter(x=>!x.disabled);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
function receive(v){const keepForm=setup&&activeChat===v.chatKey&&!v.state&&!view?.state&&!!$('wizard');view=v;if(v.prefs?.displayDock==='bottom'&&typeof v.prefs.dockExpanded==='boolean')folded=!v.prefs.dockExpanded;if(activeChat!==v.chatKey||!draft){activeChat=v.chatKey;draftEdited=false;mineExpanded=new Set();draft={...defaultDraft(),...(v.prefs.setupDraft||{}),city:'云澜市'};consumptionPage=0;step=v.prefs.setupStep||0;preview=false;seen=new Set(v.prefs.seen||[]);detail=null;settings=false;hidden=false;sceneSection=new Map();calendarOpen=false;calendarMonth='';selectedDate='';lastSignature='';imageCache={};closeModal();$('fx').classList.remove('show');}
  theme();const signature=JSON.stringify([v.state?.meta.revision,v.state?.meta.sourceAnchor,v.lineage,v.busy,v.setupProgress,v.error,v.pending,v.nativeReady,v.prefs.theme,v.prefs.phoneSize,v.prefs.fontSize,v.prefs.displayDock,v.prefs.randomAvatar,v.notice]);
  if(signature===lastSignature)return;lastSignature=signature;
  // rc.29：回退楼层导致提现被退回奖池时，host 会挂一条一次性提示。
  if(v.notice){notify(v.notice);api?.clearNotice?.();}
  if(!v.state||!Object.values(v.state.notifications).some(n=>seen.has(n.notificationId))){$('fx').classList.remove('show');clearTimeout(fxTimer);}
  if(setup){if(keepForm)updateSetupConnection();else wizard();}else phone();}
function connect(){
  try{const next=window.parent.__CJ_SHENGHAO_V2__;
    if(next&&next!==api){unsubscribe?.();api=next;const incoming=api.read();
      if(setup&&draftEdited&&incoming.chatKey===activeChat&&!incoming.state)api.preferences({setupDraft:draft,setupStep:step});
      const localPrefs=draftStore?.read(activeChat)||{};
      if(setup&&typeof localPrefs.randomAvatar==='boolean'&&incoming.chatKey===activeChat&&!incoming.state&&incoming.prefs?.randomAvatar!==localPrefs.randomAvatar)api.preferences({randomAvatar:localPrefs.randomAvatar});
      lastSignature='';unsubscribe=api.subscribe(receive);
    }else if(!next){unsubscribe?.();unsubscribe=null;api=null;
      if(setup){const key=draftStore.chatKey();if(!view||key!==activeChat)receive({state:null,prefs:draftStore.read(key),chatKey:key,nativeReady:false,busy:false,error:''});else{view.nativeReady=false;view.busy=false;updateSetupConnection();}}
    }
  }catch{if(setup)updateSetupConnection();}
}
if(setup){const key=draftStore.chatKey();receive({state:null,prefs:draftStore.read(key),chatKey:key,nativeReady:false,busy:false,error:''});}
connect();
// 随机头像清单：远程优先，失败用构建内联的保底（测试期是内嵌 data URL）。
loadManifest({}).then((result)=>{avatarManifest=result.manifest;avatarBaseUrl=result.manifest?.baseUrl||'';if(avatarManifest){lastSignature='';if(view?.state)phone();}}).catch(()=>{});
const bridgeTimer=setInterval(connect,300);
const connectionTimer=setTimeout(()=>{connectionExpired=true;updateSetupConnection();},10000);
window.addEventListener('pagehide',()=>{unsubscribe?.();clearInterval(bridgeTimer);clearTimeout(connectionTimer);clearTimeout(toastTimer);clearTimeout(fxTimer);clearTimeout(dragCancel);});



