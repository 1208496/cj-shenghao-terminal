import {consumptionHistory} from '../core/consumption.js';
import {userProfileTags,beautyTier,poolParts,totals,stage,corruptionStage,canWithdraw,PROFILE_KEYS,PROFILE_LABELS,wealthTier,withdrawalQuote,prowessTier,tierBasis,PRIVATE_COPY} from '../core/engine.js';
import {ABILITY_BY_ID,SURREAL_ITEM_BY_ID,CASINO_UI} from '../core/casino-catalog.js';
import {WHEEL_COPY,fill} from '../core/wheel-ui-copy.js';
import {CACHE_COPY} from '../core/cache-copy.js';
import {playWheelQuote} from '../core/wheel.js';
import {wishWheelQuote,lowPackQuote} from '../core/casino.js';
import {WHEEL_POOL_BY_ID} from '../core/wheel-pool.js';
import {renderWorkshop} from './workshop.js';
import {checkDeviceThreshold} from '../core/device-catalog.js';
import {CARD_CODES} from './card-art.js';
import {renderCardFace} from './card-face.js';

export function createScreens({data,esc,yuan,image,avatar}){
  const groups=[['身份与形象',['identity','appearance','body','style'],'基础身份、形象风格','♧'],['性格与喜好',['personality','habits'],'价值观、习惯与喜好','♡'],['成长与经历',['family','career'],'家庭、成长和事业','▤'],['情感与关系',['social'],'感情观与人际背景','♧']];
  const unit=(v,u)=>v===null||v===undefined?'尚未记录':esc(v)+u;
  const tierBadge=s=>{const t=wealthTier(tierBasis(s));return `<span class="wealth-tier tier-${t.id}">${t.label}</span>`;};
  // rc.27：365px 窄屏视觉分层——状态胶囊横条 + 左键右值虚线行 + 句首核心词染色。
  const pill=(text,tone='')=>`<span class="chip-tag${tone?' chip-'+tone:''}">${text}</span>`;
  const lead=(value,tone='hl-pink')=>{const s=String(value??'').trim();if(!s)return '';const m=s.match(/^([^，,；;。·]{2,18}?)\s*([，,；;。·][\s\S]*)$/);return m?`<b class="${tone}">${esc(m[1])}</b>${esc(m[2])}`:esc(s);};
  const kv=(label,html)=>html?`<div class="kv"><span class="kv-k">${label}：</span><span class="kv-v">${html}</span></div>`:'';
  const line=(label,value,tone='')=>{const s=typeof value==='string'?value.trim():'';if(!s)return '';if(/^(未知|不明|尚未记录|未记录)$/.test(s))return kv(label,pill('🔒 隔衣未知','pink'));return kv(label,tone?lead(s,tone):esc(s));};
  const counted=(label,value)=>Number(value)>0?kv(label,`<b>${esc(value)}</b>`):'';
  const goalsBox=(c,showDream=true)=>{
const rg=typeof c?.recentGoal==='string'?c.recentGoal.trim():'';
const ld=showDream&&typeof c?.longTermDream==='string'?c.longTermDream.trim():'';
return (rg?`<div class="muted goal goal-card">🎯 近期目标：${esc(rg)}</div>`:'')
 +(ld?`<div class="muted goal dream-card">✨ 长期梦想：${esc(ld)}</div>`:'');
};
  const thoughtBox=thought=>typeof thought==='string'&&thought.trim()?`<div class="muted thought thought-card">💭 心声：<i>${esc(thought)}</i></div>`:'';
  const basicRows=c=>{
    const bwh=[c.bustCm,c.waistCm,c.hipCm].some(v=>v==null)?'尚未记录':[c.bustCm,c.waistCm,c.hipCm].map(esc).join('／')+' CM'+(c.cupSize?'（'+esc(c.cupSize)+' 罩杯）':'');
    const tags=(c.personalityTags||[]).filter(Boolean);
    return `<div class="chips">${pill(`年龄：${c.age}岁`)}${pill(`颜值：${c.beautyScore==null?'尚未记录':c.beautyScore+'/100'}`,'amber')}${c.cupSize?pill(`${esc(c.cupSize)} 罩杯`,'pink'):''}${c.addressing?pill(`称呼你：${esc(c.addressing)}`):''}</div>`
      +`<div class="mini-stats"><div class="mini-stat"><small>身高：</small><b>${unit(c.heightCm,' CM')}</b></div><div class="mini-stat"><small>体重：</small><b>${unit(c.weightKg,' KG')}</b></div><div class="mini-stat"><small>鞋码：</small><b>${unit(c.shoeSizeEu,'（欧码）')}</b></div></div>`
      +kv('职业',`<b>${esc(c.occupation||'尚未记录')}</b>`)
      +kv('三围',`<b class="hl-pink">${bwh}</b>`)
      +kv('性格标签',tags.length?tags.map(t=>pill(esc(t),'green')).join(' '):'尚未记录')
      +kv('外貌',esc(c.appearance||'尚未记录'))
      +kv('身材',esc(c.body||'尚未记录'))
      +(c.impression?kv('对你的印象',esc(c.impression)):'')
      +goalsBox(c,true);
  };
  // rc.50：女性档案姓名行的三条件标签（项圈 / 印记 / 跳蛋）。未满足条件则完全不渲染该节点。
  // 文案、类名、data-*、aria-label、出现顺序逐字取自 RC50 方案 §4.1–§4.2。
  const toyStateOf=()=>{try{const t=window.parent?.__CJ_SHENGHAO_V2__?.toyLinkState?.();if(!t)return null;return {...t,activeTargetId:t.targetId??null};}catch{return null;}};
  // rc.53：极简版面板直接读同一份快照（单一真相源，不另建状态）
  const toySnapshot=()=>{try{return window.parent?.__CJ_SHENGHAO_V2__?.toyLinkState?.()||null;}catch{return null;}};
  const deviceTagsHtml=(c,toy)=>{
    const out=[];
    if(c?.choker?.worn===true)out.push('<span class="tag dev-tag dev-choker" data-device-tag="choker" aria-label="已佩戴誓约项圈">项圈</span>');
    if(Boolean(c?.imprints?.items&&Object.keys(c.imprints.items).length>0))out.push('<span class="tag dev-tag dev-imprint" data-device-tag="imprint" aria-label="已铭刻专属印记">印记</span>');
    const wearingToy=Boolean(toy&&Array.isArray(toy.wearingIds)&&toy.wearingIds.includes(c.id))||Boolean(toy&&toy.running&&toy.targetId===c.id);
    if(wearingToy)out.push('<span class="tag dev-tag dev-toy" data-device-tag="toy" aria-label="已佩戴跳蛋">跳蛋</span>');
    return out.join('');
  };
  const cName=(c,toy)=>`<strong>${esc(c.name)}</strong> <span class="tag pink">${esc(c.relationshipLabel)}</span>${deviceTagsHtml(c,toy)}`;
  // rc.24: the four private panels mirror the dossier grid — one click opens one
  // panel, and every field comes from the script-maintained private records.
  // rc.25：此刻与人物详情共用同一套点击方块。名字行给三轴，展开区只留心声、
  // 三条进度条与 2×2 方块，原来那 20 行文字瀑布流彻底拆掉。
  const scaleText=n=>['L0 守身如玉','L1 心防初动','L2 半推半就','L3 渐入佳境','L4 主动迎合','L5 放浪形骸','L6 彻底放浪'][Math.max(0,Math.min(6,Number(n)||0))];
  const limitText=n=>['拒绝','犹豫','要条件','主动'][Math.max(0,Math.min(3,Number(n)||0))];
  const axis=n=>Math.max(0,Math.min(100,Number(n)||0));
  const axisLine=c=>`♥ 好感 ${axis(c.affection)}/100 · ❖ 堕落 ${axis(c.corruption??0)}/100 · 🌡️ 情欲 ${axis(c.arousal??0)}/100`;
  const axisBars=c=>`<div class="dual-axis"><div class="muted">♥ 好感度：${axis(c.affection)}/100 · ${esc(stage(axis(c.affection)))}</div><div class="bar"><div style="width:${axis(c.affection)}%"></div></div><div class="muted">❖ 堕落度：${axis(c.corruption??0)}/100 · ${esc(corruptionStage(axis(c.corruption??0)))}</div><div class="bar corruption-bar"><div style="width:${axis(c.corruption??0)}%"></div></div><div class="muted">🌡️ 情欲值：${axis(c.arousal??0)}/100</div><div class="bar arousal-bar"><div style="width:${axis(c.arousal??0)}%"></div></div></div>`;
  const tagCloud=c=>{const tags=(c.intimacy?.unlockedTags||[]).filter(Boolean);return tags.length?'<div class="tag-cloud">'+tags.map(t=>'<span class="tag pink">'+esc(t)+'</span>').join('')+'</div>':'';};
  const statusPanel=c=>{
    const chips=[c.currentExpression?pill('神情：'+esc(c.currentExpression)):'',c.currentMood?pill('✨ 心情：'+esc(c.currentMood),'amber'):''].filter(Boolean).join('');
    return (chips?`<div class="chips">${chips}</div>`:'')
      +[['姿态','currentPose'],['动作','currentAction'],['身体状态','currentCondition'],['随身物品','currentItems']].filter(([,key])=>typeof c[key]==='string'&&c[key].trim()).map(([label,key])=>kv(label,key==='currentAction'?`<b>${esc(c[key])}</b>`:esc(c[key]))).join('')
      +goalsBox(c,false);
  };
  // rc.39 问题 6：穿搭只以 outfit 九项为准，去掉重复的「此刻穿着／穿搭风格／面部气色」。
  const outfitPanel=c=>{
    const o=c.outfit||{};
    const chips=[o.style?pill('👗 '+esc(o.style),'amber'):'',o.complexion?pill('✨ '+esc(o.complexion),'pink'):''].filter(Boolean).join('');
    const detailLines=[
      line('上装',o.top,'hl-strong'),
      line('下装',o.bottom,'hl-strong'),
      line('内衣内裤',o.lingerie),
      line('袜子／丝袜',o.socks),
      line('鞋履',o.shoes),
      line('妆造',o.makeup),
      line('随身配饰',o.accessories)
    ].filter(Boolean);
    // 只有九项全空时才用 currentClothes 兜底，绝不重复展示
    if(!detailLines.length&&c.currentClothes)detailLines.push(line('此刻穿着',c.currentClothes,'hl-strong'));
    return (chips?`<div class="chips">${chips}</div>`:'')+detailLines.join('');
  };
  const cycleTone=cycle=>/排卵|易孕/.test(cycle)?'amber':/月经|经期/.test(cycle)?'pink':'green';
  // rc.38 A-5：virgin===null 是"尚未确认"，原先一律显示成「处女」，这里改三态。
  const virginLabel=p=>p.virgin===false?PRIVATE_COPY.virgin.virginFalse:p.virgin===true?PRIVATE_COPY.virgin.virginTrue:PRIVATE_COPY.virgin.virginUnknown;
  const virginTone=p=>p.virgin===false?'chip-plum':p.virgin===true?'chip-pink':'chip-muted';
  const virginText=p=>kv('处子状态',`<span class="chip-tag ${virginTone(p)}">${esc(virginLabel(p))}</span> <span class="muted">（${esc(p.virgin===null||p.virgin===undefined?PRIVATE_COPY.virgin.virginUnknownNote:(p.hymenNote||'尚未记录'))}）</span>`);
  const fleshPanel=c=>{
    const p=c.physiology||{};
    const chips=[p.cycle?pill('🌿 '+esc(p.cycle),cycleTone(p.cycle)):'',pill(esc(virginLabel(p)),virginTone(p).replace('chip-','')),pill(`🌡️ 情欲值：${axis(c.arousal??0)}/100`,axis(c.arousal??0)>=50?'pink':'')].filter(Boolean).join('');
    return `<div class="chips">${chips}</div>`
      +[line('孕期',p.pregnancy),virginText(p),line('胸部详情',p.chestDetail,'hl-pink'),line('阴部户型与色泽',p.vaginaLook,'hl-pink'),line('阴部紧致与状态',p.vaginaState,'hl-plum'),line('阴毛类型',p.pubicHair),kv('后庭外观与状态',`${esc(p.anusLook||'尚未记录')} · ${esc(p.anusState||'尚未记录')}`),kv('体香与特征',`${esc(p.bodyScent||'尚未记录')}${p.tattooScar?' · 纹身／疤痕：'+esc(p.tattooScar):''}`),line('敏感带详情',p.traits,'hl-strong')].filter(Boolean).join('');
  };
  const secretPanel=c=>{
    const p=c.physiology||{},l=c.limits||{};
    const chips=[p.cycle?pill('🌿 '+esc(p.cycle),cycleTone(p.cycle)):'',pill(esc(virginLabel(p)),virginTone(p).replace('chip-','')),pill('⛓️ '+esc(scaleText(l.scaleLevel)),'plum')].filter(Boolean).join('');
    return `<div class="chips">${chips}</div>`
      +[virginText(p),line('胸部详情',p.chestDetail,'hl-pink'),line('阴部户型与色泽',p.vaginaLook,'hl-pink'),line('阴部紧致与状态',p.vaginaState,'hl-plum'),line('阴毛类型',p.pubicHair),line('敏感带与体香',[p.traits,p.bodyScent].filter(x=>typeof x==='string'&&x.trim()).join(' · '),'hl-strong'),tagCloud(c)].filter(Boolean).join('');
  };
  const limitCell=(label,val)=>{
    const n=Math.max(0,Math.min(3,Number(val)||0)),tone=n===3?'chip-pink':n===2?'chip-amber':n===1?'':'';
    return `<div class="limit-cell${n===0?' locked':''}"><span>${label}：</span><span class="limit-badge ${tone}">${n} · ${limitText(n)}</span></div>`;
  };
  const experiencePanel=c=>{
    const i=c.intimacy||{},l=c.limits||{};
    const chips=[pill('⛓️ '+esc(scaleText(l.scaleLevel)),'plum'),i.firstTime?pill(esc(i.firstTime),'pink'):''].filter(Boolean).join('');
    return `<div class="chips">${chips}</div>`
      +[line('性观念',i.attitude,'hl-strong'),line('对你的评价',i.abilityComment,'hl-pink'),counted('交往人数',i.partnersCount),counted('性经验人数',i.sexPartnerCount),line('过往经历',i.experience),line('性癖与弱点',i.fetishes,'hl-plum'),counted('与你亲密次数',i.withUserCount),line('最近一次性行为',i.lastIntimate),line('最近自慰',i.lastMasturbation),tagCloud(c),'<div class="limit-sep"></div>',line('软肋',l.weakness,'hl-strong'),line('最怕顾虑',l.worry),'<div class="limit-grid">'+[['露点展示','exposure'],['手口侍奉','foreplay'],['实战插入','intercourse'],['丝袜制服','cosplay'],['无套内射','creampie'],['后庭开发','anal'],['半公开偷欢','publicPlay'],['多人同欢','multi']].map(([label,key])=>limitCell(label,l[key])).join('')+'</div>'].filter(Boolean).join('');
  };
  const detailBlocks=c=>[['身姿 · 基础','年龄三围、颜值性格、外貌身材与目标愿景','📋',basicRows(c)],['欲念 · 肉体','胸型乳晕、下体户型色泽、阴毛与敏感带','🌹',fleshPanel(c)],['行头 · 穿搭','上装下装、内衣丝袜、鞋履与妆造','👗',outfitPanel(c)],['经历 · 尺度','性观念、器大活好评价、解锁玩法与底线','🔥',experiencePanel(c)]];
  const sceneBlocks=c=>[['此刻 · 动向','姿态、动作、神情、心情与近期目标','🎬',statusPanel(c)],['行头 · 穿戴','上装下装、内衣丝袜、鞋履与妆造','👗',outfitPanel(c)],['身姿 · 基础','年龄三围、颜值性格与外貌身材','📋',basicRows(c)],['欲念 · 私密','周期、处子、下体户型与敏感带','🌹',secretPanel(c)]];
  const blockGrid=(blocks,active,attr)=>`<div class="dossier-grid">${blocks.map(([name,description,icon],i)=>`<button class="${active===i?'selected':''}" ${attr(i)} aria-expanded="${active===i}"><span>${icon} ${name}<span class="section-caret">${active===i?'−':'+'}</span></span><small>${description}</small></button>`).join('')}</div>${active!==null&&active!==undefined&&blocks[active]?`<div class="card dossier-panel" style="margin-top:10px"><b>${blocks[active][0]}</b>${blocks[active][3]||'<p class="muted">这一栏还没有记录，等下一次接触再补上。</p>'}</div>`:''}`;
  const privateRecord=c=>{const {privateSection}=data(),blocks=detailBlocks(c);
    return `<div class="section-head"><h3>人物与私密档案</h3><span class="muted">${privateSection===null||privateSection===undefined?'2×2 四方块 · 点击展开':'点击收起'}</span></div>${blockGrid(blocks,privateSection,i=>`data-private-section="${i}"`)}`;};
  const clock=s=>`${s.world.date} ${s.world.time}`;
  function scene(){const {view,expanded,sceneSectionByChar}=data(),s=view.state,people=s.scene.presentCharacterIds.map(id=>s.characters[id]).filter(c=>c?.trackingState==='RECORDED');
    const starred=Object.values(s.characters).filter(c=>c.trackingState==='RECORDED'&&c.starred&&!s.scene.presentCharacterIds.includes(c.id));
    return `<button class="world-time-card" data-act="calendar" aria-label="打开日历"><span class="date-emblem">${Number(s.world.date.slice(-2))}<small>${s.world.date.slice(5,7)}月</small></span><span class="world-time-copy"><b>${esc(s.world.date)} ${weekday(s.world.date)}</b><small>${esc(s.world.weather)} · 点击查看日程</small></span><span class="world-clock">${esc(s.world.time)}<small>›</small></span></button>
    <div class="card"><div class="scene-info"><button type="button" class="user-avatar-btn" data-edit-image="USER:avatar" aria-label="更换玩家头像">${image('USER','avatar',s.user.name)||`<span>${esc(s.user.name.slice(0,1))}</span>`}</button><div style="flex:1;min-width:0"><div><b>${esc(s.user.name)}</b> ${tierBadge(s)}</div><div class="muted">颜值 ${s.user.beautyScore}/100</div><div class="muted">${esc(s.user.city)} · ${esc(s.scene.location)}</div><div class="muted">${esc(s.user.occupation||'自由生活')}</div></div></div><div class="scene-status"><div><span>穿着</span>${esc(s.user.currentClothes||'尚无穿着记录')}</div><div><span>此刻</span>${esc(s.user.currentPose||s.user.currentAction||'故事刚刚开始')}</div></div></div>
    <div class="section-head"><h3>现场的她们 <span class="muted">(${people.length})</span></h3><span class="muted">当前场景</span></div>
    ${people.map(c=>{const open=expanded.has(c.id),block=sceneSectionByChar?.get?.(c.id);return `<div class="card"><button class="expand" data-expand="${esc(c.id)}" aria-expanded="${open}"><div class="char-row">${avatar(c)}<div class="body"><div class="char-name-row">${cName(c,toyStateOf())}</div><span class="small">${axisLine(c)}</span></div><div class="right-amount">${yuan(poolParts(s,c.id).total)}</div><span class="muted">⌄</span></div></button>${open?`<div class="scene-expanded">${thoughtBox(c.currentThought)}${axisBars(c)}<div class="scene-blocks">${blockGrid(sceneBlocks(c),block===undefined?null:block,i=>`data-scene-section="${esc(c.id)}:${i}"`)}</div><button class="btn secondary full" style="margin-top:10px;padding:7px" data-detail="${esc(c.id)}">查看人物档案 →</button></div>`:''}</div>`;}).join('')}
    ${starred.length?`<details class="card starred-offscreen"><summary>★ 特别关注 · 异地实况 <span class="muted">(${starred.length})</span></summary>${starred.map(c=>`<div class="muted"><b>${esc(c.name)}</b> · ${esc(c.offscreen||'近况尚未同步')}</div>`).join('')}<p class="muted">她们不在场，只在剧情推进时用一句近况更新。</p></details>`:''}
    ${s.scene.temporaryActors.map(t=>`<div class="card"><div class="section-head" style="margin:0 0 7px"><b>${esc(t.name)}</b><span class="tag gray">尚未相识</span></div><div class="muted">${esc(t.description)}</div><button class="text-link" data-hide-temp="${esc(t.tempId)}">不再关注</button></div>`).join('')}
    ${!people.length&&!s.scene.temporaryActors.length?'<div class="card muted empty-state">此刻没有在场女性。<br>真实相遇后，她们会出现在这里。</div>':''}<p class="muted screen-footnote">仅显示实际在场的人；隐藏人物不会显示。</p>`;
  }
  function women(){const {view}=data(),s=view.state,people=Object.values(s.characters).filter(c=>c.trackingState==='RECORDED');return `<div class="section-head"><h3>已收录的她们</h3><span class="muted">共${people.length}位</span></div><p class="muted" style="margin:0 2px 10px">正式认识后收录简易资料，九大档案可在详情中手动建档。好感满70或堕落满60即可提现，无需确定恋爱关系。</p><div class="women-grid">${people.map(c=>`<button class="expand" data-detail="${esc(c.id)}"><div class="card"><div class="char-row">${avatar(c)}<div class="body"><div class="char-name-row">${cName(c,toyStateOf())}${c.starred?' <span class="tag gold star-flag">★</span>':''}</div><span class="small">${esc(c.occupation)}${c.addressing?' · 称呼「'+esc(c.addressing)+'」':''} · ♥ ${c.affection} · ❖ ${c.corruption??0}</span><div class="bar"><div style="width:${c.affection}%"></div></div></div><div style="text-align:right"><div class="right-amount">${yuan(poolParts(s,c.id).total)}</div><span class="tag ${canWithdraw(s,c.id)?'gold':'gray'}">${canWithdraw(s,c.id)?'可提现':poolParts(s,c.id).total?'累积中':'继续积累'}</span></div></div></div></button>`).join('')||'<div class="card muted empty-state">暂无收录人物。一次真实的交流，会开启新的相识。</div>'}</div>`;}
  function detail(c){const {view,section,consumptionPage}=data(),s=view.state,p=poolParts(s,c.id),q=withdrawalQuote(s,c.id),history=consumptionHistory(s,c.id,{page:consumptionPage}),ready=canWithdraw(s,c.id),portrait=image(c.id,'portrait',c.name+' · 人物立绘');return `<button class="backlink" data-act="back-women">← 返回她们</button><div style="height:9px"></div><div class="cover ${portrait?'has-image':''}" data-preview-image="${esc(c.id)}:portrait" role="button" tabindex="0" aria-label="查看或设置人物立绘">${portrait||'<span class="silhouette">✧</span>'}<div class="coverlabel">${esc(c.name)} · 人物立绘</div></div>
    <div class="card" style="margin-top:-8px;position:relative"><div class="char-row">${avatar(c)}<div class="body"><div class="char-name-row"><strong style="font-size:calc(16px * var(--cj-font-scale,1))">${esc(c.name)}</strong> <span class="tag pink">${esc(c.relationshipLabel)}</span>${deviceTagsHtml(c,toyStateOf())} <button class="mini-btn star-btn ${c.starred?'on':''}" data-star="${esc(c.id)}" aria-pressed="${!!c.starred}">${c.starred?'★ 已关注':'☆ 特别关注'}</button></div><span class="small">${c.age}岁 · ${esc(c.occupation)}</span></div></div>${axisBars(c)}${thoughtBox(c.currentThought)}${goalsBox(c,true)}<div class="image-buttons" style="margin-top:9px"><button class="mini-btn" data-edit-image="${esc(c.id)}:avatar">更换头像</button><button class="mini-btn" data-edit-image="${esc(c.id)}:portrait">更换立绘</button></div></div>
    <div class="pool"><div class="muted">本期未领原始奖池 · ${ready?'可提现':p.total?'累积中':'继续积累'}</div><div class="pval">${yuan(p.total)}</div><div class="split"><div class="split-item"><small>消费入池</small><strong>${yuan(p.spend)}</strong></div><div class="split-item"><small>暴击入池</small><strong>${yuan(p.crit)}</strong></div></div><p>${tierBadge(s)} · 预计实到 <b>${yuan(q.paidCents)}</b></p>${q.debt?`<p class="muted">退款待抵扣 ${yuan(q.debt)} · 本次抵扣 ${yuan(q.recoveryCents)}</p>`:''}</div><button class="btn full ${ready?'gold':'secondary'}" data-withdraw="${esc(c.id)}" ${ready&&!view.busy?'':'disabled'}>${ready?'✦ 领取本期全部奖励':(c.affection<70&&(c.corruption??0)<60)?'♥ 好感达70 或 ❖ 堕落达60 解锁提现':'本期已领清 · 继续积累'}</button>
    ${privateRecord(c)}
    <div class="section-head"><h3>九大档案</h3><span class="muted">${c.profileFixed?(c.profileLocked?'已锁定':'未锁定'):'尚未建档'}</span></div>${c.profileFixed?`<button class="mini-btn" data-lock-profile="${esc(c.id)}" ${view.busy?'disabled':''}>${c.profileLocked?'解除锁定':'锁定档案'}</button><p class="muted">${c.profileLocked?'已锁定，九大档案不随每轮正文发送。':'人物在场时，九大档案随每轮正文发送。'}</p>`:`<button class="btn secondary full" data-build-profile="${esc(c.id)}" ${view.busy?'disabled':''}>建档</button><p class="muted">根据基础资料和已有经历补全九大档案。</p>`}${c.profileFixed?`<div class="dossier-grid">${groups.map(([name,keys,description,icon],i)=>`<button class="${section===i?'selected':''}" data-section="${i}" aria-expanded="${section===i}"><span>${icon} ${name}<span class="section-caret">${section===i?'−':'+'}</span></span><small>${description}</small></button>`).join('')}</div>${section!==null?`<div class="card dossier-panel" style="margin-top:10px"><b>${groups[section][0]}</b>${groups[section][1].map(k=>`<h4>${PROFILE_LABELS[PROFILE_KEYS.indexOf(k)]}</h4><p class="dossier-text">${esc(c.profileFixed[k])}</p>`).join('')}</div>`:''}`:''}
    <details class="card consumption"><summary>消费记录 · ${history.count}笔</summary><div class="basic-grid muted"><span>历史整单实付 ${yuan(history.paidCents)}</span><span>她的有效净消费 ${yuan(history.netAllocatedCents)}</span><span>当前未领消费入池 ${yuan(history.pendingSpendCents)}</span></div><p class="muted">历史实付含已退款整单；多人消费看她的分摊。转赠只计权益，不重复付现金。</p>${history.rows.map(r=>`<details class="consumption-row"><summary><span><b>${esc(r.itemName)}</b><small>${esc(r.sceneTime)} · ${esc(r.status)}</small></span><span>${yuan(r.paidCents)}<small>她的净份额 ${yuan(r.netAllocatedCents)}</small></span></summary><div class="muted">${r.kind==='ASSET_TRANSFER'?'已有资产转赠／按成本计奖':'现金消费'}${r.merchantOrPlace?' · '+esc(r.merchantOrPlace):''}<br>原分摊 ${yuan(r.allocatedCents)} · 有效入池 ${yuan(r.poolCreditCents)} · 尚未领取 ${yuan(r.pendingCents)}${r.refundedCents?'<br>她的退款份额 '+yuan(r.refundedCents):''}${r.refunds.map(f=>'<br>退款 '+esc(f.recordedAtScene)+' · '+yuan(f.amountCents)+'（整单）').join('')}${r.withdrawalIds.map(id=>{const w=s.withdrawals[id];return '<br>关联提现 '+esc(w.recordedAtScene)+' · '+esc(w.tierLabel)+' · 整批实到 '+yuan(w.paidCents);}).join('')}</div></details>`).join('')||'<p class="muted">尚无消费记录</p>'}${history.pages>1?`<div class="choice-row"><button class="mini-btn" data-consumption-page="${history.page-1}" ${history.page===0?'disabled':''}>上一页</button><span>${history.page+1}/${history.pages}</span><button class="mini-btn" data-consumption-page="${history.page+1}" ${history.page===history.pages-1?'disabled':''}>下一页</button></div>`:''}</details>
    <details class="card"><summary>提现记录 · 累计实到 ${yuan(history.withdrawnCents)}</summary>${history.withdrawals.slice(0,100).map(w=>`<details class="consumption-row"><summary><span>${esc(w.recordedAtScene)}<small>${esc(w.tierLabel)}</small></span><b>${yuan(w.paidCents)}</b></summary><p class="muted">原始奖池 ${yuan(w.basePoolCents)}（消费 ${yuan(w.spendCents)} / 暴击 ${yuan(w.criticalCents)}）<br>提现前计级身家 ${yuan(w.preCashCents)}<br>理论到账 ${yuan(w.grossCents)} · 退款抵扣 ${yuan(w.recoveryCents)}<br>状态：已入账</p></details>`).join('')||'<p class="muted">尚无提现记录</p>'}</details>
    <div class="section-head"><h3>最近暴击</h3></div><div class="card">${Object.values(s.rewardEvents).filter(e=>e.characterId===c.id&&e.eventType==='CRITICAL').slice(-8).reverse().map(e=>`<div class="ledger-row"><div class="txt"><b>${esc(e.title||e.label||e.score+'分')}</b><div class="muted">${esc(e.label?e.label+' · ':'')}${e.score}分 · 已入奖池</div></div><span class="v green">+${yuan(e.cashbackCents)}</span></div>`).join('')||'<span class="muted">尚无暴击记录</span>'}</div><button class="btn ghost full" data-hide="${esc(c.id)}">隐藏该人物</button>`;}
  function mine(){const {view}=data(),s=view.state;
    // rc.34 / rc.35：主角异能栏 + 背包/商城双入口（文案取自定稿 CASINO_UI）
    // rc.39 问题 4：异能显示正名 + 等级徽章 + 效果说明（原来只有一排 tag）
    const abilities=(s.user.abilities||[]).map(a=>{
      const d=ABILITY_BY_ID[a.abilityId];if(!d)return '';
      const lvText=WHEEL_COPY.mine.abilityOwnedBadge;
      // rc.43：异能可发动，正文生成前可撤销。
      const pendingAb=!!(s.wheel?.pendingAbilityUses||{})[a.abilityId];
      return `<div class="ability-item" data-ability-id="${esc(d.abilityId)}" data-rarity="${esc(d.rarity)}">
      <div class="ability-item-head">
        <div class="ability-item-title"><b>${esc(d.name)}</b><span class="ability-tag">${esc(d.tag)}</span></div>
        <span class="ability-lv">${esc(lvText)}</span>
      </div>
      <p class="ability-desc">${esc(d.effect)}</p>
      <div class="ability-actions"><button class="cj-act ${pendingAb?'':'primary'}" data-use-ability="${esc(d.abilityId)}">${esc(pendingAb?WHEEL_COPY.mine.abilityBtnUndo:WHEEL_COPY.mine.abilityBtnUse)}</button>${pendingAb?`<span class="bag-chip">${esc(WHEEL_COPY.mine.abilityPendingBadge)}</span>`:''}</div>
    </div>`;
    }).filter(Boolean).join('');
    const abilityCards=`<div class="card ability-card">
      <div class="ability-head"><b>⚡ ${esc(CASINO_UI.minePortals.abilityTitle)}</b><span class="muted">${esc(fill(WHEEL_COPY.mine.abilityCount,{count:(s.user.abilities||[]).length}))}</span></div>
      ${abilities?`<div class="ability-list">${abilities}</div>`:`<p class="muted ability-empty">${esc(CASINO_UI.minePortals.abilityEmpty)}</p>`}
    </div>`;
    return `<div class="card user-profile"><button class="user-avatar-btn" data-edit-image="USER:avatar" aria-label="更换玩家头像">${image('USER','avatar',s.user.name)||esc(s.user.name.slice(0,1))}</button><div style="flex:1;min-width:0"><div><b>${esc(s.user.name)} · ${s.user.age}岁</b> ${tierBadge(s)}</div><div class="muted">${esc(s.user.gender||'男')} · ${esc(s.user.occupation||'自由生活')} · ${esc(s.user.city)}</div><span class="user-avatar-hint">点击头像更换图片</span></div><div class="user-description"><div class="chips">${userProfileTags(s).map(t=>pill(esc(t.text),t.tone)).join('')}</div><div class="mini-stats"><div class="mini-stat"><small>身高：</small><b>${s.user.heightCm==null?'待补全':esc(s.user.heightCm)+' CM'}</b></div><div class="mini-stat"><small>体重：</small><b>${s.user.weightKg==null?'待补全':esc(s.user.weightKg)+' KG'}</b></div><div class="mini-stat"><small>鞋码：</small><b>${s.user.shoeSizeEu==null?'待补全':esc(s.user.shoeSizeEu)+'（欧码）'}</b></div></div>${kv('颜值魅力',`<b>${s.user.beautyScore}/100</b> · ${esc(beautyTier(s.user.beautyScore).label)}（好感修正 ${beautyTier(s.user.beautyScore).modifier>0?'+':''}${beautyTier(s.user.beautyScore).modifier}）`)}${kv('床笫战力',`<b class="hl-pink">${s.user.prowessScore??70}/100</b> · ${esc(prowessTier(s.user.prowessScore??70).label)}（堕落加成 ${prowessTier(s.user.prowessScore??70).modifier>0?'+':''}${prowessTier(s.user.prowessScore??70).modifier}）`)}${kv('性器规格',`<b class="hl-plum">长 ${esc(s.user.genitals?.length||'18cm')} ／ 粗 ${esc(s.user.genitals?.girth||'4.8cm')}</b>${s.user.genitals?.traits?' · '+esc(s.user.genitals.traits):''}`)}${kv('外貌气质',esc(s.user.appearance||'未填写'))}${kv('身材体态',esc(s.user.body||'未填写'))}</div></div>${deviceCards(s)}${abilityCards}`;}

  function wealth(){const {view,assetTab,mineExpanded}=data(),s=view.state,t=totals(s);
    const labels={HOUSE:'房产',CAR:'座驾',BUSINESS:'产业',YACHT_JET:'游艇专机',LUXURY:'奢品',COLLECTIBLE:'藏品',OTHER:'其他'};
    const assetKinds=[['ALL','全部'],['HOUSE','房产'],['CAR','座驾'],['BUSINESS','产业'],['YACHT_JET','游艇专机'],['LUXURY','奢品'],['COLLECTIBLE','藏品'],['OTHER','其他']];
    return `<div class="section-head"><h3>我的财富</h3><span class="muted">收益与资产</span></div>`+`<div class="pool"><div class="muted">总资产估值</div><div class="pval">${yuan(t.total)}</div><div class="split"><div class="split-item"><small>可用现金</small><strong>${yuan(t.cash)}</strong></div><div class="split-item"><small>持有资产</small><strong>${yuan(t.assets)}</strong></div></div></div><div class="card"><div class="summary-grid"><div><span class="muted">累计收入</span><b class="green">${yuan(t.income)}</b></div><div><span class="muted">累计支出</span><b>${yuan(t.expense)}</b></div></div><p class="muted" style="margin-bottom:0">不含开局现金与既有资产，未提现奖池不计入财富。</p></div><details class="mine-section" data-mine-section="assets" ${mineExpanded?.has('assets-closed')?'':'open'}><summary class="section-head"><h3>持有资产</h3><span class="muted">${Object.values(s.finance.assets).filter(a=>a.status==='OWNED'&&a.ownerId==='USER').length}项 <button type="button" class="mini-btn asset-add-btn" data-register-asset="1" aria-label="${esc(WHEEL_COPY.wealthAsset.btnOpenAria)}">${esc(WHEEL_COPY.wealthAsset.btnOpenShort)}</button> <span class="fold-caret" aria-hidden="true">›</span></span></summary><div class="asset-tabs">${assetKinds.map(([k,label])=>`<button class="${assetTab===k?'on':''}" data-asset-tab="${k}">${label}</button>`).join('')}</div>${Object.values(s.finance.assets).filter(a=>a.status==='OWNED'&&a.ownerId==='USER'&&(assetTab==='ALL'||a.kind===assetTab)).map(a=>`<div class="asset-mini"><div class="asset-head"><div class="asset-title"><b>${esc(a.name)}</b><span class="muted">${esc(labels[a.kind]||'其他')} · ${esc(a.locationNote||a.ownershipNote||'个人持有')}</span></div><span class="right-amount">${a.valuationPending?esc(WHEEL_COPY.wealthAsset.pendingBadge):yuan(a.bookValueCents)}</span></div><p class="muted asset-description">${esc(a.description)}</p><div class="asset-actions"><button class="mini-btn asset-del" data-delete-asset="${esc(a.assetId)}">${esc(WHEEL_COPY.wealthAsset.btnDelete)}</button></div></div>`).join('')||'<div class="card muted">暂无这类资产。</div>'}</details><details class="mine-section" data-mine-section="ledger" ${mineExpanded?.has('ledger')?'open':''}><summary class="section-head"><h3>收支明细</h3><span class="muted">${Object.keys(s.finance.ledger).length}笔 <span class="fold-caret" aria-hidden="true">›</span></span></summary><div class="card">${Object.values(s.finance.ledger).slice(-100).reverse().map(l=>`<div class="ledger-row"><div class="txt"><b>${esc(l.memo)}</b><div class="muted">${esc(l.recordedAtScene)}${s.withdrawals[l.entryId]?` · 原池 ${yuan(s.withdrawals[l.entryId].basePoolCents)} ×${s.withdrawals[l.entryId].multiplier} · 抵扣 ${yuan(s.withdrawals[l.entryId].recoveryCents)}`:l.direction==='NONE'?(l.kind==='ASSET_GRANT'?' · 资产入账':l.kind==='ASSET_DELETE'?' · 删除资产':l.kind==='ASSET_VALUATION'?' · 资产补估值':' · 产权转赠'):''}</div></div><span class="v ${l.direction==='IN'?'green':'red'}">${l.direction==='IN'?'+':l.direction==='OUT'?'−':''}${yuan(l.amountCents)}</span></div>`).join('')||'<span class="muted">暂无游戏内收支，初始资金不计作收入。</span>'}</div></details>`;}
  // rc.46：三入口徽章（零 filter、单 SVG ≤8 图元，与三重盘台同族）
  const miniToySvg=`<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="29" fill="none" stroke="#d9b878" stroke-width="1.2" opacity=".82"/>
  <circle cx="32" cy="32" r="23" fill="none" stroke="#a864f0" stroke-width="5" stroke-dasharray="6 3 2 3" opacity=".9"/>
  <circle cx="32" cy="32" r="15" fill="none" stroke="#7b8294" stroke-width="1.6" opacity=".8"/>
  <path d="M18 34 L24 34 L27 26 L32 40 L36 30 L39 34 L46 34" fill="none" stroke="#ff9ce6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="32" r="2.6" fill="#ff9ce6"/>
</svg>`;
  const miniChokerSvg=`<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="29" fill="none" stroke="#d9b878" stroke-width="1.2" opacity=".8"/>
  <circle cx="32" cy="30" r="21" fill="none" stroke="#e0566f" stroke-width="4" stroke-dasharray="2 6" opacity=".85"/>
  <circle cx="32" cy="30" r="14" fill="none" stroke="#2a2232" stroke-width="5" opacity=".9"/>
  <path d="M32 44 L37 50 L32 57 L27 50 Z" fill="none" stroke="#ffd2dc" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="32" cy="50" r="1.5" fill="#ffd2dc"/>
</svg>`;
  const miniImprintSvg=`<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="29" fill="none" stroke="#f28cb0" stroke-width="1.2" opacity=".82"/>
  <circle cx="32" cy="32" r="23.5" fill="none" stroke="#d9b878" stroke-width="1.4" stroke-dasharray="4 4" opacity=".85"/>
  <path d="M32 42 C22 36 15 30 15 24 C15 19 19 16 23 16 C27 16 30 19 32 23 C34 19 37 16 41 16 C45 16 49 19 49 24 C49 30 42 36 32 42 Z" fill="none" stroke="#ffb8d6" stroke-width="2"/>
  <path d="M20 46 L44 46" stroke="#f28cb0" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
</svg>`;
  function deviceStates(s){
    const women=Object.values(s.characters||{}).filter(c=>c.trackingState==='RECORDED');
    const worn=women.filter(c=>c.choker?.worn);
    const marks=women.filter(c=>c.imprints&&Object.keys(c.imprints.items||{}).length);
    let toy={mounted:false,open:false,preview:false,running:false,modeName:'',pow:0,targetId:null,wearingIds:[]};
    try{toy=window.parent?.__CJ_SHENGHAO_V2__?.toyLinkState?.()||toy;}catch{toy=toy;}
    return {
      toy,
      toyUnlocked:!!s.wheel?.toyLinkUnlocked,
      chokerUnlocked:!!s.wheel?.chokerUnlocked,
      imprintUnlocked:!!s.wheel?.imprintUnlocked,
      worn, marks,
      wornNames:worn.map(c=>c.name).join('、'),
      markSummary:marks.map(c=>`${c.name}（${Object.keys(c.imprints.items||{}).length}处）`).join('、')
    };
  }
  function deviceCards(s){
    const d=WHEEL_COPY.mine.devices,st=deviceStates(s);
    const targetName=(()=>{const id=st.toy.targetId;return (id&&s.characters?.[id]?.name)||'';})();
    // rc.53：五态（未解锁 / 实验版占用 / 运行中 / 已佩戴 / 就绪），运行中按档位展示
    const gearList=WHEEL_COPY.workshop.toylinkLite.gears;
    const gearOf=(pow)=>{const n=Number(pow)||0;return n<=45?1:n<=75?2:3;};
    const gearLabel=gearList[gearOf(st.toy.pow)-1].label;
    const wornIds=Array.isArray(st.toy.wearingIds)?st.toy.wearingIds:[];
    const wornNames=wornIds.map(id=>s.characters?.[id]?.name).filter(Boolean).join('、');
    const labLocked=st.toy.activeMode==='lab';
    const toyBadge=!st.toyUnlocked?d.toylink.badgeLocked:labLocked?d.toylink.badgeLabLocked:(st.toy.running?d.toylink.badgeActive:(wornIds.length?fill(d.toylink.badgeWorn,{count:wornIds.length}):d.toylink.badgeReady));
    // rc.47：已解锁但没有任何达标女性时，卡片改为门槛提示
    const toyHasEligible=(()=>{const cs=s?.characters?Object.values(s.characters):[];return cs.some(c=>checkDeviceThreshold(c).eligible);})();
    const labSummary=st.toy.running?`${targetName||'目标'} · ${WHEEL_COPY.workshop.toylinkLite.dotLive}`:fill(WHEEL_COPY.workshop.toylinkLite.wornCount,{count:wornIds.length});
    const toyMeta=!st.toyUnlocked?d.toylink.metaLocked
      :labLocked?fill(d.toylink.metaLabLocked,{summary:labSummary})
      :st.toy.running?fill(d.toylink.metaActive,{name:targetName||'目标',gearLabel})
      :(wornIds.length?fill(d.toylink.metaWorn,{names:wornNames||targetName}):(toyHasEligible?d.toylink.metaReady:d.toylink.metaNoEligible));
    const chokerBadge=!st.chokerUnlocked?d.choker.badgeLocked:(st.worn.length?fill(d.choker.badgeWorn,{count:st.worn.length}):d.choker.badgeReady);
    const chokerMeta=!st.chokerUnlocked?d.choker.metaLocked:(st.worn.length?fill(d.choker.metaWorn,{names:st.wornNames}):d.choker.metaReady);
    const imprintBadge=!st.imprintUnlocked?d.imprint.badgeLocked:(st.marks.length?fill(d.imprint.badgeEngraved,{count:st.marks.length}):d.imprint.badgeEmpty);
    const imprintMeta=!st.imprintUnlocked?d.imprint.metaLocked:(st.marks.length?fill(d.imprint.metaEngraved,{summary:st.markSummary}):d.imprint.metaEmpty);
    const card=(cls,icon,title,badge,meta,attr,state)=>`<button type="button" class="wcard-b device-card ${cls}" ${attr} data-device-state="${esc(state)}">
      <span class="mini-wheel-anchor device-badge" aria-hidden="true">${icon}</span>
      <span class="wcard-b-copy"><span class="wcard-b-top"><b>${esc(title)}</b><span class="wcard-b-badge">${esc(badge)}</span></span><span class="wcard-b-meta">${esc(meta)}</span></span>
      <span class="wcard-b-arrow" aria-hidden="true">›</span></button>`;
    return `<div class="sec-kicker"><span>${esc(d.secTitle)}</span><small>${esc(d.secSub)}</small></div>
    <div class="wheel-hub-stack mine-device-stack">
      ${card('is-toylink',miniToySvg,d.toylink.title,toyBadge,toyMeta,`data-toylink="1" aria-label="${esc(d.toylink.ariaLabel)}"`,st.toyUnlocked?'unlocked':'locked')}
      ${card('is-choker',miniChokerSvg,d.choker.title,chokerBadge,chokerMeta,`data-open-workshop="choker" aria-label="${esc(d.choker.ariaLabel)}"`,st.chokerUnlocked?'unlocked':'locked')}
      ${card('is-imprint',miniImprintSvg,d.imprint.title,imprintBadge,imprintMeta,`data-open-workshop="imprint" aria-label="${esc(d.imprint.ariaLabel)}"`,st.imprintUnlocked?'unlocked':'locked')}
    </div>`;
  }

  // rc.39 问题 5 + 追加：B 版轮盘页（顶栏并排双指标 → 三重盘台 → 背包/卡册/商城 → TOY·LINK）
  function wheelHub(){const {view}=data(),s=view.state,w=s.wheel||{};
    const allItems=Object.values(s.inventory||{});
    const cards=allItems.filter(i=>i.category==='WISH_CARD');
    const bagActiveCount=allItems.filter(i=>(i.category==='WHEEL_PRIZE'||i.category==='SURREAL_ITEM')&&i.status!=='USED').length;
    const codexCount=new Set((w.discoveredCardCodes||[]).filter(Boolean)).size;
    const pq=playWheelQuote(w,s.world.date,tierBasis(s));
    const lq=lowPackQuote(w,s.world.date);
    const wq=wishWheelQuote(w,s.world.date,tierBasis(s),Object.keys(s.withdrawals||{}).length>0);
    const playBadge=pq.freeAvailable?WHEEL_COPY.wheels.cards.play.badgeFree:pq.cashAvailable?fill(WHEEL_COPY.wheels.cards.play.badgeCash,{price:yuan(pq.costCents)}):fill(WHEEL_COPY.wheels.cards.play.badgePoints,{points:pq.costPoints});
    const packBadge=!wq.unlocked?WHEEL_COPY.wheels.cards.wish.badgeLowOnly:wq.mode==='free'?WHEEL_COPY.wheels.cards.wish.badgeHighFree:WHEEL_COPY.wheels.cards.wish.badgeReady;
    const highShort=!wq.unlocked?WHEEL_COPY.wheels.cards.wish.highLockedShort:fill(WHEEL_COPY.wheels.cards.wish.highCountShort,{today:wq.todaySpins,limit:wq.dailyLimit});
    const casinoBadge=cards.length?fill(WHEEL_COPY.wheels.cards.casino.badgeReady,{count:cards.length}):WHEEL_COPY.wheels.cards.casino.badgeEmpty;
    // rc.41：三重盘台入口徽章（零 filter、低节点，1800 视口也稳）
    const miniPlaySvg=`<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="mwPlayR" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#9b6bff"/><stop offset="35%" stop-color="#3cd7e6"/><stop offset="68%" stop-color="#f6df9d"/><stop offset="100%" stop-color="#ff8bc6"/></linearGradient></defs>
  <circle cx="32" cy="32" r="29" fill="none" stroke="#d9b878" stroke-width="1.2" opacity=".78"/>
  <circle cx="32" cy="32" r="24" fill="none" stroke="#7b8294" stroke-width="6.5" stroke-dasharray="3.2 1.8" opacity=".88"/>
  <circle cx="32" cy="32" r="16.5" fill="none" stroke="#b83451" stroke-width="5.5" stroke-dasharray="4.2 2.2" opacity=".94"/>
  <circle cx="32" cy="32" r="10.2" fill="none" stroke="#dfa73a" stroke-width="4" stroke-dasharray="6 4.6" opacity=".95"/>
  <circle cx="32" cy="32" r="6" fill="none" stroke="url(#mwPlayR)" stroke-width="2.2"/>
  <circle cx="32" cy="32" r="3.2" fill="#f6e3b0"/>
</svg>`;
    const miniPackSvg=`<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="mwPackR" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#d8b4ff"/><stop offset="50%" stop-color="#7cecf0"/><stop offset="100%" stop-color="#ff9cd2"/></linearGradient></defs>
  <circle cx="32" cy="32" r="29" fill="none" stroke="url(#mwPackR)" stroke-width="1.2" opacity=".8"/>
  <circle cx="32" cy="32" r="23.5" fill="none" stroke="#b482f0" stroke-width="2" stroke-dasharray="5 4" opacity=".85"/>
  <circle cx="32" cy="32" r="17.5" fill="none" stroke="#f6df9d" stroke-width="1.2" stroke-dasharray="2 3.5" opacity=".75"/>
  <rect x="22" y="18" width="20" height="28" rx="3.5" fill="#221734" stroke="url(#mwPackR)" stroke-width="1.5"/>
  <path d="M32 23L34.4 29.6L41 32L34.4 34.4L32 41L29.6 34.4L23 32L29.6 29.6Z" fill="#fff0c4"/>
</svg>`;
    const miniCasinoSvg=`<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="29" fill="none" stroke="#d9b878" stroke-width="1.6" opacity=".85"/>
  <circle cx="32" cy="32" r="23.5" fill="none" stroke="#222633" stroke-width="7.5"/>
  <circle cx="32" cy="32" r="23.5" fill="none" stroke="#b52643" stroke-width="7.5" stroke-dasharray="4 4"/>
  <circle cx="32" cy="10.2" r="2.6" fill="#2cc986" stroke="#f6e3b0" stroke-width=".7"/>
  <circle cx="32" cy="32" r="16.5" fill="#17111b" stroke="#d9b878" stroke-width="1.3"/>
  <path d="M32 19V45M19 32H45" stroke="#f2cf84" stroke-width="2" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="4.2" fill="#f6e3b0" stroke="#472f0e" stroke-width="1.2"/>
</svg>`;
    return `<div class="wheel-banner-stats" data-wheel-stats>
      <div class="wb-cell"><span class="wb-ico" aria-hidden="true">✦</span><b class="wb-num">${w.starPoints||0}</b><small class="wb-lbl">${esc(WHEEL_COPY.wheels.hub.pointsLabel)}</small></div>
      <span class="wb-div" aria-hidden="true"></span>
      <div class="wb-cell"><span class="wb-ico" aria-hidden="true">🃏</span><b class="wb-num">${cards.length}</b><small class="wb-lbl">${esc(WHEEL_COPY.wheels.hub.cardsLabel)}</small></div>
    </div>
    <div class="sec-kicker"><span>${esc(WHEEL_COPY.wheels.hub.secWheels)}</span><small>${esc(WHEEL_COPY.wheels.hub.secWheelsSub)}</small></div>
    <div class="wheel-hub-stack">
      <button type="button" class="wcard-b is-play" data-open-wheel="play">
        <span class="mini-wheel-anchor" data-wheel-anchor="play">${miniPlaySvg}</span>
        <span class="wcard-b-copy">
          <span class="wcard-b-top"><b>${esc(WHEEL_COPY.wheels.cards.play.title)}</b><span class="wcard-b-badge">${esc(playBadge)}</span></span>
          <span class="wcard-b-meta">${esc(fill(WHEEL_COPY.wheels.cards.play.metaLine,{paid:pq.paidToday,limit:pq.paidLimit,pRed:w.pityRed||0,pGold:w.pityGold||0,pRainbow:w.pityRainbow||0}))}</span>
        </span>
        <span class="wcard-b-arrow" aria-hidden="true">›</span>
      </button>
      <button type="button" class="wcard-b is-pack" data-open-wheel="pack">
        <span class="mini-wheel-anchor is-cw" data-wheel-anchor="pack">${miniPackSvg}</span>
        <span class="wcard-b-copy">
          <span class="wcard-b-top"><b>${esc(WHEEL_COPY.wheels.cards.wish.title)}</b><span class="wcard-b-badge">${esc(packBadge)}</span></span>
          <span class="wcard-b-meta">${esc(fill(WHEEL_COPY.wheels.cards.wish.metaLine,{lowUsed:lq.todayPacks,highStatus:highShort}))}</span>
        </span>
        <span class="wcard-b-arrow" aria-hidden="true">›</span>
      </button>
      <button type="button" class="wcard-b is-casino" data-open-wheel="casino">
        <span class="mini-wheel-anchor is-fast" data-wheel-anchor="casino">${miniCasinoSvg}</span>
        <span class="wcard-b-copy">
          <span class="wcard-b-top"><b>${esc(WHEEL_COPY.wheels.cards.casino.title)}</b><span class="wcard-b-badge">${esc(casinoBadge)}</span></span>
          <span class="wcard-b-meta">${esc(fill(WHEEL_COPY.wheels.cards.casino.metaLine,{wins:w.casinoTotalWins||0,losses:w.casinoTotalLosses||0,best:w.casinoBestWinPoints||0}))}</span>
        </span>
        <span class="wcard-b-arrow" aria-hidden="true">›</span>
      </button>
    </div>
    <div class="sec-kicker"><span>${esc(WHEEL_COPY.wheels.hub.secAssets)}</span><small>${esc(WHEEL_COPY.wheels.hub.secAssetsSub)}</small></div>
    <div class="dock-list" data-wheel-dock>
      <button type="button" class="dock-row" data-act="open-bag">
        <span class="dock-icon" aria-hidden="true">🎒</span>
        <span class="dock-copy"><b>${esc(WHEEL_COPY.wheels.hub.bagBtn)}</b><small>${esc(WHEEL_COPY.wheels.hub.bagRowSub)}</small></span>
        <span class="dock-tail">${esc(fill(WHEEL_COPY.wheels.hub.bagCountUnit,{count:bagActiveCount}))}<i aria-hidden="true">›</i></span>
      </button>
      <button type="button" class="dock-row" data-act="open-binder">
        <span class="dock-icon" aria-hidden="true">🃏</span>
        <span class="dock-copy"><b>${esc(WHEEL_COPY.wheels.hub.binderBtn)}</b><small>${esc(fill(WHEEL_COPY.wheels.hub.binderRowSub,{codex:Math.min(12,codexCount)}))}</small></span>
        <span class="dock-tail">${esc(fill(WHEEL_COPY.wheels.hub.cardCountUnit,{count:cards.length}))}<i aria-hidden="true">›</i></span>
      </button>
      <button type="button" class="dock-row" data-act="open-shop">
        <span class="dock-icon" aria-hidden="true">✦</span>
        <span class="dock-copy"><b>${esc(WHEEL_COPY.wheels.hub.shopBtn)}</b><small>${esc(WHEEL_COPY.wheels.hub.shopRowSub)}</small></span>
        <span class="dock-tail">${esc(WHEEL_COPY.wheels.hub.shopShort)}<i aria-hidden="true">›</i></span>
      </button>
    </div>`;
  }

  function settings(){const {view}=data();const cardFxq=['high','medium','low'].includes(view.prefs?.cardFxQuality)?view.prefs.cardFxQuality:'medium';const cardFxRow=`<div class="settingrow"><div><b>${esc(WHEEL_COPY.cardFace.settingTitle)}</b><div class="muted">${esc(WHEEL_COPY.cardFace.settingSub)}</div></div><div class="choice-row">${[['high',WHEEL_COPY.cardFace.qualityHigh],['medium',WHEEL_COPY.cardFace.qualityMed],['low',WHEEL_COPY.cardFace.qualityLow]].map(([id,label])=>`<button class="chip ${cardFxq===id?'on':''}" data-card-fxq="${id}" aria-pressed="${cardFxq===id}">${esc(label)}</button>`).join('')}</div></div>`;return `<div class="section-head"><h3>终端设置</h3><button class="backlink" data-act="close-settings">返回</button></div><div class="card"><div class="settingrow"><div><b>检测更新</b><div class="muted">当前版本 ${esc(view.version)}</div></div><button class="mini-btn" data-act="check-update">检测更新</button></div><div class="settingrow"><div><b>显示位置</b><div class="muted">悬浮在屏幕一侧，或嵌在最新正文底部</div></div><div class="choice-row"><button class="chip ${view.prefs.displayDock!=='bottom'?'on':''}" data-display-dock="float" aria-pressed="${view.prefs.displayDock!=='bottom'}">悬浮小手机</button><button class="chip ${view.prefs.displayDock==='bottom'?'on':''}" data-display-dock="bottom" aria-pressed="${view.prefs.displayDock==='bottom'}">固定正文底部</button></div></div><div class="settingrow"><div><b>手机尺寸</b><div class="muted">整体比例同步调整</div></div><div class="choice-row"><button class="chip ${view.prefs.phoneSize!=='standard'?'on':''}" data-phone-size="compact">精巧</button><button class="chip ${view.prefs.phoneSize==='standard'?'on':''}" data-phone-size="standard">标准</button></div></div><div class="settingrow"><div><b>字体大小</b><div class="muted">精巧默认中，标准默认小</div></div><div class="choice-row">${[['small','小'],['medium','中'],['large','大']].map(([size,label])=>`<button class="chip ${(view.prefs.fontSize||(view.prefs.phoneSize==='standard'?'small':'medium'))===size?'on':''}" data-font-size="${size}" aria-pressed="${(view.prefs.fontSize||(view.prefs.phoneSize==='standard'?'small':'medium'))===size}">${label}</button>`).join('')}</div></div><div class="settingrow"><div><b>随机头像</b><div class="muted">按颜值档从图库随机配一张，选定后固定不变</div></div><div class="choice-row"><button class="chip ${view.prefs.randomAvatar!==false?'on':''}" data-random-avatar="on" aria-pressed="${view.prefs.randomAvatar!==false}">开</button><button class="chip ${view.prefs.randomAvatar===false?'on':''}" data-random-avatar="off" aria-pressed="${view.prefs.randomAvatar===false}">关</button></div></div>${cardFxRow}<div class="settingrow" style="display:block"><b>外观主题</b><div class="settings-swatch">${[['sage','鼠尾草绿','#d9e5d4'],['gold','香槟暖金','#efd9b5'],['purple','深曜雾紫','#49335f']].map(([id,name,color])=>`<button class="swatch ${view.prefs.theme===id||!view.prefs.theme&&id==='sage'?'sel':''}" data-theme="${id}"><span class="preview" style="background:${color}"></span>${name}</button>`).join('')}</div></div><div class="settingrow"><div><b>${esc(CACHE_COPY.settingTitle)}</b><div class="muted">${esc(CACHE_COPY.settingSub)}</div></div><button class="mini-btn" data-clear-cache>${esc(CACHE_COPY.settingBtn)}</button></div><div class="settingrow"><div><b>已隐藏人物</b><div class="muted">恢复原人物与奖池，不追补隐藏期奖励。</div></div><button class="mini-btn" data-act="hidden-list">查看 ›</button></div></div>`;}
  function hidden(){const {view}=data(),s=view.state,people=Object.values(s.characters).filter(c=>c.trackingState==='HIDDEN');return `<div class="section-head"><h3>已隐藏人物</h3><button class="backlink" data-act="back-settings">返回设置</button></div><div class="card muted">隐藏期间不更新好感、档案和奖池。恢复沿用原身份与历史记录，从恢复时继续累积。</div>${people.map(c=>`<div class="card"><div class="char-row">${avatar(c)}<div class="body"><b>${esc(c.name)}</b><div class="muted">${esc(c.relationshipLabel)} · ${yuan(poolParts(s,c.id).total)}</div></div><button class="mini-btn" data-restore="${esc(c.id)}" ${view.busy?'disabled':''}>恢复</button></div></div>`).join('')}${Object.entries(s.hiddenTemporary).map(([id,t])=>`<div class="card"><b>${esc(t.name||'现场人物')}</b><span class="tag gray">尚未相识</span><button class="mini-btn" data-restore-temp="${esc(id)}">恢复关注</button></div>`).join('')}${!people.length&&!Object.keys(s.hiddenTemporary).length?'<div class="card muted">没有已隐藏的人物。</div>':''}`;}
  function calendar(){const {view,calendarMonth,selectedDate}=data(),s=view.state,month=calendarMonth||s.world.date.slice(0,7),selected=selectedDate||s.world.date,[year,m]=month.split('-').map(Number),start=(new Date(Date.UTC(year,m-1,1)).getUTCDay()+6)%7,count=new Date(Date.UTC(year,m,0)).getUTCDate(),items=Object.values(s.calendar.appointments);
    return `<div class="section-head"><h3>我的日历</h3><button class="backlink" data-act="close-calendar">返回此刻</button></div><div class="card calendar-card"><div class="calendar-title"><button class="mini-btn" data-month-step="-1" aria-label="上个月">‹</button><b>${year}年 ${m}月</b><button class="mini-btn" data-month-step="1" aria-label="下个月">›</button></div><div class="calendar-grid">${['一','二','三','四','五','六','日'].map(x=>`<span class="calendar-week">${x}</span>`).join('')}${Array.from({length:start},()=>'<span></span>').join('')}${Array.from({length:count},(_,i)=>{const d=month+'-'+String(i+1).padStart(2,'0');return `<button class="calendar-day ${d===selected?'selected':''} ${d===s.world.date?'today':''}" data-day="${d}" aria-label="${d}">${i+1}${items.some(e=>e.date===d&&e.status==='PLANNED')?'<i></i>':''}</button>`;}).join('')}</div></div><div class="section-head"><h3>${esc(selected)} ${weekday(selected)}</h3><button class="mini-btn" data-act="add-appointment">＋ 添加约定</button></div>${items.filter(e=>e.date===selected).sort((a,b)=>a.time.localeCompare(b.time)).map(e=>`<div class="card appointment"><div class="appointment-time">${esc(e.time)}<small>${e.status==='PLANNED'?'已约定':e.status==='COMPLETED'?'已完成':'已取消'}</small></div><div class="appointment-body"><b>${esc(e.title)}</b><div class="muted">${esc(e.location)}</div><p class="muted">${esc(e.notes)}</p>${e.status==='PLANNED'?`<div class="choice-row"><button class="mini-btn" data-prepare-appointment="${esc(e.id)}">在正文继续</button><button class="text-link" data-cancel-appointment="${esc(e.id)}">取消约定</button></div>`:''}</div></div>`).join('')||'<div class="card muted empty-state">这一天还没有约定。<br>留一点空白，给即兴发生的生活。</div>'}<p class="muted screen-footnote">故事时间：${esc(clock(s))}。查看日历不会推进剧情。</p>`;}
  // rc.40：星愿卡册独立成页（不再复用背包弹窗的 cards 分页）。
  const RARITY_RANK = { rainbow: 3, gold: 2, red: 1, gray: 0 };

  function binder() {
    const { view, binderFilter, expandedStacks } = data(), s = view.state, w = s.wheel || {};
    const allCards = Object.values(s.inventory || {}).filter((i) => i.category === 'WISH_CARD');
    const codex = new Set((w.discoveredCardCodes || []).filter((c) => CARD_CODES.includes(c)));
    const activeFilter = ['all', 'rainbow', 'gold', 'red', 'gray'].includes(binderFilter) ? binderFilter : 'all';
    const cardFxq = ['high', 'medium', 'low'].includes(view.prefs?.cardFxQuality) ? view.prefs.cardFxQuality : 'medium';
    const limit = 12;
    const open = expandedStacks instanceof Set ? expandedStacks : new Set();

    const counts = { all: allCards.length, rainbow: 0, gold: 0, red: 0, gray: 0 };
    for (const c of allCards) if (Object.hasOwn(counts, c.rarity)) counts[c.rarity] += 1;

    const cardFaceOf = (it, size) => renderCardFace({
      rarity: it.rarity,
      cardCode: it.cardCode,
      points: it.currentPoints ?? 0,
      poolTier: it.poolTier,
      serialNo: it.serialNo,
      winStreak: it.winStreak,
      locked: !!it.locked,
      size,
    });

    const tierDefs = [
      ['rainbow', WHEEL_COPY.binderPage.filterRainbow],
      ['gold', WHEEL_COPY.binderPage.filterGold],
      ['red', WHEEL_COPY.binderPage.filterRed],
      ['gray', WHEEL_COPY.binderPage.filterGray],
    ];
    const filterDefs = [['all', WHEEL_COPY.binderPage.filterAll], ...tierDefs];

    const pool = (activeFilter === 'all' ? allCards : allCards.filter((c) => c.rarity === activeFilter))
      .slice()
      .sort((a, b) =>
        Number(!!b.locked) - Number(!!a.locked)
        || (b.currentPoints || 0) - (a.currentPoints || 0)
        || (b.serialNo || 0) - (a.serialNo || 0)
      );

    const sections = [];
    for (const [rarity, tierName] of tierDefs) {
      const group = pool.filter((c) => c.rarity === rarity);
      if (!group.length) continue;
      const chunks = [];
      for (let i = 0; i < group.length; i += limit) chunks.push(group.slice(i, i + limit));
      chunks.forEach((chunk, ci) => {
        const key = `${rarity}:${ci}`;
        const isOpen = open.has(key);
        const top = chunk[0];
        const stackTitle = chunks.length > 1 ? `${tierName} · ${ci + 1}` : tierName;
        const lockedCnt = chunk.filter((x) => x.locked).length;
        const hasStreak = chunk.some((x) => (x.winStreak || 0) > 0);
        if (isOpen) {
          sections.push(`<section class="binder-stack is-expanded" data-binder-stack="${esc(key)}" data-rarity="${esc(rarity)}" data-expanded="true" data-stack-count="${chunk.length}">
            <div class="stack-open-bar">
              <span class="stack-badge">${esc(stackTitle)} · ${chunk.length}</span>
              <button type="button" class="mini-btn" data-stack-toggle="${esc(key)}">${esc(WHEEL_COPY.bag.binder.btnCollapse)}</button>
            </div>
            <div class="card-binder-grid">${chunk.map((it) => `<div class="binder-item" data-binder-card="${esc(it.itemId)}" data-rarity="${esc(it.rarity)}">
              ${cardFaceOf(it, 'md')}
              <button type="button" class="wc-gear" data-card-menu="${esc(it.itemId)}" aria-label="${esc(WHEEL_COPY.bag.binder.cardMenuAria)}">⚙</button>
            </div>`).join('')}</div>
          </section>`);
        } else {
          const depth = Math.min(2, chunk.length - 1);
          sections.push(`<section class="binder-stack is-stacked" data-binder-stack="${esc(key)}" data-rarity="${esc(rarity)}" data-expanded="false" data-stack-count="${chunk.length}">
            <button type="button" class="stack-deck" data-stack-toggle="${esc(key)}">
              ${depth >= 2 ? `<span class="stack-layer layer-2 wc-${esc(rarity)}" aria-hidden="true"></span>` : ''}
              ${depth >= 1 ? `<span class="stack-layer layer-1 wc-${esc(rarity)}" aria-hidden="true"></span>` : ''}
              <span class="stack-front">${cardFaceOf(top, 'md')}</span>
              <span class="stack-count">×${chunk.length}</span>
              <span class="stack-flags">${lockedCnt ? `<span>🔒${lockedCnt}</span>` : ''}${hasStreak ? '<span>🔥</span>' : ''}</span>
            </button>
          </section>`);
        }
      });
    }

    const bodyHtml = !allCards.length
      ? `<div class="empty-card"><b>${esc(WHEEL_COPY.bag.binder.emptyTitle)}</b><p class="muted">${esc(WHEEL_COPY.bag.binder.emptySub)}</p><button type="button" class="cj-act primary" data-open-wheel="pack">${esc(WHEEL_COPY.bag.binder.emptyCta)}</button></div>`
      : !sections.length
        ? `<div class="empty-card"><b>${esc(WHEEL_COPY.binderPage.filterEmptyTitle)}</b><p class="muted">${esc(WHEEL_COPY.binderPage.filterEmptySub)}</p></div>`
        : `<div class="binder-decks" data-binder-grid>${sections.join('')}</div>`;

    return `<div class="binder-page" data-screen="binder">
      <div class="section-head">
        <button type="button" class="backlink" data-act="close-binder">${esc(WHEEL_COPY.binderPage.backBtn)}</button>
        <span class="muted">${esc(fill(WHEEL_COPY.bag.binder.codexProgress, { count: Math.min(CARD_CODES.length, codex.size) }))}</span>
      </div>
      <div class="wheel-banner-stats binder-summary">
        <div class="wb-cell"><span class="wb-ico" aria-hidden="true">✦</span><b class="wb-num">${w.starPoints || 0}</b><small class="wb-lbl">${esc(WHEEL_COPY.wheels.hub.pointsLabel)}</small></div>
        <span class="wb-div" aria-hidden="true"></span>
        <div class="wb-cell"><span class="wb-ico" aria-hidden="true">🃏</span><b class="wb-num">${allCards.length}</b><small class="wb-lbl">${esc(WHEEL_COPY.wheels.hub.cardsLabel)}</small></div>
      </div>
      <div class="binder-fxq-bar">
        <span class="binder-fxq-lbl">${esc(WHEEL_COPY.cardFace.settingTitle)}</span>
        <div class="choice-row">
          ${[
            ['high', WHEEL_COPY.cardFace.qualityHigh],
            ['medium', WHEEL_COPY.cardFace.qualityMed],
            ['low', WHEEL_COPY.cardFace.qualityLow],
          ].map(([id, label]) => `<button type="button" class="chip ${cardFxq === id ? 'on' : ''}" data-card-fxq="${id}" aria-pressed="${cardFxq === id}">${esc(label)}</button>`).join('')}
        </div>
      </div>
      <div class="binder-filters" role="tablist" aria-label="${esc(WHEEL_COPY.wheels.hub.binderTitle)}">
        ${filterDefs.map(([id, label]) => `<button type="button" class="chip ${activeFilter === id ? 'on' : ''}" role="tab" aria-selected="${activeFilter === id}" data-binder-filter="${id}">${esc(label)} <small>${counts[id]}</small></button>`).join('')}
      </div>
      ${bodyHtml}
    </div>`;
  }

  // rc.46：手机内工坊（渲染细节在 workshop.js）。rc.49：印记工坊已独立为顶层 iframe，这里只剩项圈工坊。
  // rc.53：新增 toylink-lite（极简遥控面板），直接读宿主同一份 toyLinkState 快照。
  function workshop(kind){
    const {view,workshopUi}=data();
    if(kind==='toylink-lite')return `<div class="workshop-page is-toylink-lite" data-screen="workshop-toylink-lite" data-workshop="toylink-lite">${renderWorkshop('toylink-lite',{state:view?.state,toy:toySnapshot()})}</div>`;
    if(kind!=='choker')return '';
    const ui=workshopUi;
    const title=WHEEL_COPY.workshop.choker.title;
    const head='';
    if(!ui||ui.kind!==kind)return `<div class="workshop-page is-${esc(kind)}" data-screen="workshop-${esc(kind)}" data-workshop="${esc(kind)}"><div class="section-head"><button type="button" class="backlink" data-act="close-workshop">${esc(WHEEL_COPY.workshop.common.backBtn)}</button></div></div>`;
    return `<div class="workshop-page is-${esc(kind)}" data-screen="workshop-${esc(kind)}" data-workshop="${esc(kind)}">${head}${renderWorkshop(kind,{state:view.state,ui})}</div>`;
  }

  return {scene,women,detail,mine,wealth,wheelHub,settings,hidden,calendar,binder,workshop};
}
function weekday(date){return '星期'+['日','一','二','三','四','五','六'][new Date(date+'T00:00:00Z').getUTCDay()];}
