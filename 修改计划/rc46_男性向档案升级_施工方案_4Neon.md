# 《神豪终端》男性向女性档案升级 · DSH 可执行施工方案（rc46 · 4Neon）

> **设计来源**：[AGY_REVIEW_rc45_4Neon_男性向档案设计.md](file:///E:/SHZDCHOSSS/AGY_REVIEW_rc45_4Neon_%E7%94%B7%E6%80%A7%E5%90%91%E6%A1%A3%E6%A1%88%E8%AE%BE%E8%AE%A1.md)  
> **基准源码**：工作区 `E:\SHZDCHOSSS` 当前工作树（rc.33 代码基线）  
> **施工铁律**：
> 1. **文案逐字照抄律**：本方案所有标注为「100% 逐字定稿」的代码块（含 `protocol.txt`、`state-context.txt`、脚本兜底文案、UI 提示词与引导句），**DSH 必须 100% 逐字复制粘贴，一个字、一个标点都不准自行发挥或缩写**。
> 2. **不删任何现有字段**：7 条升级全部为增量扩展或缺陷修复，不删除任何已有字段。
> 3. **脚本兜底原则**：凡可确定性推算/沉淀/防护的逻辑全部在 `engine.js` 与 `settlement.js` 兜底，不赌大模型不犯错。
> 4. **前端只读解耦**：浏览/已读状态（如私信已读）一律存 `prefs`，**绝不在查看页面时调用 `mutateState`**，防止污染 `revision` 与操作重放日志。

---

## 一、总览与文件改动清单

7 条建议**全部技术可行、无破坏性冲突、全部落地**。涉及 8 个源码文件（不触碰 `literary.json` 与 `setup-presets.json`）：

| 文件 | 涉及条目 | 主要改动摘要 |
|---|---|---|
| `src/runtime/schema.js` | #1 #2 #3 #5 #6 #7 | 新增 `physiology.bodyMarks`、`intimacy.lastMasturbationRevision`、`intimacy.favoriteSensations`、`giftsFromUser`、`milestones`、`lastMessage`；`lastMasturbation` 上限 120→180 |
| `src/core/engine.js` | #1 #2 #3 #4 #5 #6 #7 | `privateDefaults`/`character` 补默认字段；导出 `LIMIT_GATES`/`LIMIT_LABELS`/`limitProgress`/`tacticalHint`/`addictionStage`/`topUserProwessTrait`；新增 `recordGiftFromUser` 接入 `CASH_TRANSACTION`/`ASSET_TRANSFER`/`TRANSACTION_REFUND`；更新 `projection(s)` |
| `src/runtime/settlement.js` | #1 #2 #3 #4 #5 #6 #7 | 锁表加 `giftsFromUser` 与 `lastMasturbationRevision`；复用 `engine.js` 的 `LIMIT_GATES`；修复 `vaginaState` 退潮清零并加开发基线与后庭演进；加 `bodyMarks`/`lastMasturbationRevision`/`abilityComment` 进阶/`favoriteSensations`/`milestones` 双轨合并/`lastMessage` 补时间 |
| `src/content/protocol.txt` | #1 #2 #3 #5 #6 #7 | 逐字替换第 5、8、10、20 行（完整定稿见第三节） |
| `src/content/state-context.txt` | #2 #3 #6 #7 | 逐字替换第 3 行（完整定稿见第三节） |
| `src/runtime/host.js` | #7 | 新增 `api.prepareReplyMessage(cid)` |
| `src/ui/screens.js` | #1 #2 #3 #4 #5 #6 #7 | 升级 `fleshPanel`、`outfitPanel`、`experiencePanel`、`scene`、`women`、`detail`；新增赠礼架、攻略风向、底线松动微光、契合度徽章、大事记时间轴、私信气泡 |
| `src/ui/app.js` + `src/ui/style.css` | #2 #3 #4 #5 #6 #7 | `app.js` 接私信未读红点、打开详情自动标已读、`data-reply-message` 弹窗；`style.css` 补对应窄屏/宽屏自适应样式 |

---

## 二、7 条升级的完整落地方案

---

### 条目 1：身体开发与专属印记的「永久留痕」（修退潮清零 + 后庭/部位演进）

#### 1.1 字段定义（Zod Schema + 默认值）

**文件 1**：`src/runtime/schema.js` 第 22 行  
将 `physiology` 定义替换为以下完整行（新增 `bodyMarks`）：

```js
    physiology:z.object({cycle:narrative(40).default(''),pregnancy:narrative(40).default('未孕'),virgin:z.boolean().nullable().default(null),hymenNote:narrative(80).default(''),chestDetail:narrative(200).default(''),vaginaLook:narrative(200).default(''),vaginaState:narrative(200).default(''),pubicHair:narrative(120).default(''),anusLook:narrative(150).default(''),anusState:narrative(150).default(''),bodyScent:narrative(120).default(''),tattooScar:narrative(150).default(''),traits:narrative(400).default(''),bodyMarks:narrative(200).default('')}).prefault({}),
```

**文件 2**：`src/core/engine.js` 第 911 行（`privateDefaults()`）  
在 `physiology` 对象末尾补 `bodyMarks:''`：

```js
  physiology:{cycle:'',pregnancy:'未孕',virgin:null,hymenNote:'',chestDetail:'',vaginaLook:'',vaginaState:'',pubicHair:'',anusLook:'',anusState:'',bodyScent:'',tattooScar:'',traits:'',bodyMarks:''},
```

#### 1.2 播种与脚本兜底

**文件**：`src/runtime/settlement.js`  
1. 第 1 行 import 补入 `archetypeOf`（如尚未导入）：
```js
import {clone,settleEvents,applyOperation,poolParts,withdrawalQuote,projection,requireRule,computeCycle,seedAnatomy,seedOutfit,archetypeOf,LIMIT_GATES,addictionStage,topUserProwessTrait} from '../core/engine.js';
```

2. 在 `src/runtime/settlement.js` 第 168 行（`addTag` 函数之后）新增以下确定性推演函数（**文案 100% 逐字定稿**）：

```js
// rc.46 条目1：身体开发常态基线与后庭演进（退潮不归零，留痕不可逆）
const LIVE_VAGINA_STATE_RE=/^(?:经受巨物深度开发|经受深入交合开发|刚经受强悍肉体充分开发|刚经历亲密交欢|情动难耐，透明爱液|芳心微乱，秘处温热)/;
const DEFAULT_ANUS_STATE_RE=/^(?:未经开发，紧致闭合|禁区防线严密，毫厘未开|极度紧窄羞涩，从未受过|保持着完全陌生的紧缩状态)/;
function developedVaginaBaseline(count,prowess){
  const high=prowess>=75;
  if(count>=10)return high
    ?'早已被你的尺寸彻底养熟定型，平日想起你便会暗自发潮，一经深入便本能软化吮吸、紧裹不放'
    :'已被你反复温存调教得熟软敏感，常态温润多汁，只要贴近你便会悄然泌水迎合';
  if(count>=6)return high
    ?'深处软肉已记住你的粗长轮廓，常态紧致而柔韧，略受挑逗便迅速充血发烫、春水充沛'
    :'甬道已被你开发得温软贴合，弹性与吸力俱佳，动情时极易层层裹紧';
  if(count>=3)return high
    ?'历经数次深入开发后褪去生涩，内壁既紧箍又顺滑，被你触碰时本能微张迎合'
    :'已熟悉你的节奏与温度，常态温热紧实，前戏片刻便会湿润软化';
  return high
    ?'初经你的强悍尺寸开拓，内壁仍保留着紧致与微酸的记忆，一触即颤'
    :'初尝与你交融的滋味，秘处紧致羞涩却已悄然记住你的体温';
}
function autoBodyMark(count,tags,prowess){
  const hasAnal=tags.some(t=>/后庭|肛|菊/.test(t));
  const hasCreampie=tags.some(t=>/内射|灌满|中出/.test(t));
  if(hasAnal)return '后庭禁区已被你亲手破开，从抗拒紧绷转为在指腹打圈时本能微张战栗';
  if(count>=10)return prowess>=75
    ?'整具身体已被你的粗长与持久彻底养熟，深夜独处想起你的重量也会下意识夹腿发潮'
    :'身子彻底认准了你的气息与力道，只要被你扣住腰身便会本能软化迎合';
  if(count>=6)return hasCreampie
    ?'已习惯被你深顶至花芯并滚烫灌满的充实感，小腹微胀的余韵总让她失神回味'
    :'敏感带已被你摸透并越发敏锐，平日里一句贴耳低语就能让她腿根发软';
  if(count>=3)return '褪去最初的生涩防备，被你按住敏感处时身体会先于理智诚实发烫泌水';
  if(count>=1)return '身上首次烙下属于你的占有印记，初夜的滚烫与酸软成了挥之不去的身体记忆';
  return '';
}
```

3. 替换 `src/runtime/settlement.js` 第 231–246 行（`vaginaState` 分支）为以下完整代码（含退潮保基线、后庭演进、`bodyMarks` 兜底）：

```js
    const prowess=s.user?.prowessScore??70;
    const withCount=Number(c.intimacy?.withUserCount)||0;
    const unlocked=c.intimacy?.unlockedTags||[];
    if(sexNow&&!wroteVagina){
      const creampie=unlocked.some(t=>/内射|灌满|中出/.test(t));
      c.physiology.vaginaState=creampie
        ?(prowess>=75
          ?'经受巨物深度开发，内壁滚烫痉挛，花穴微张、深处灌满浓稠精液'
          :'经受深入交合开发，内壁温热痉挛，花穴深处灌满滚烫精液')
        :(prowess>=75
          ?'刚经受强悍肉体充分开发，内壁温热紧箍、春水泥泞泛红，余韵微颤'
          :'刚经历亲密交欢，内壁温热湿润、软肉轻颤，犹带缠绵余韵');
    }else if(!sexNow&&!wroteVagina){
      const arousal=Number(c.arousal)||0;
      if(arousal>=65)c.physiology.vaginaState='情动难耐，透明爱液泌出湿透底裤，花唇充血微张、阴蒂敏感挺立';
      else if(arousal>=40)c.physiology.vaginaState='芳心微乱，秘处温热湿润，内壁随呼吸轻度收缩';
      else if(withCount>0){
        // rc.46：已与玩家实战过，退潮只从即时动态回落到「被你开发后的常态基线」，绝不清零退回初见模板；模型亲手写过的自定义常态保留。
        if(!c.physiology.vaginaState||LIVE_VAGINA_STATE_RE.test(c.physiology.vaginaState)){
          c.physiology.vaginaState=developedVaginaBaseline(withCount,prowess);
        }
      }else if(LIVE_VAGINA_STATE_RE.test(c.physiology.vaginaState||'')){
        c.physiology.vaginaState='';
        seedAnatomy(c);
      }
    }
    // rc.46：后庭常态自动演进（模型亲手改写过则尊重模型原值）
    const priorAnus=String(prior.physiology?.anusState||'');
    const wroteAnus=typeof c.physiology.anusState==='string'&&c.physiology.anusState.trim()&&c.physiology.anusState!==priorAnus;
    if(!wroteAnus&&(!c.physiology.anusState||DEFAULT_ANUS_STATE_RE.test(c.physiology.anusState))){
      const hasAnalTag=unlocked.some(t=>/后庭|肛|菊/.test(t));
      if(hasAnalTag){
        c.physiology.anusState=withCount>=6
          ?'已被你亲手开发熟润，指腹轻揉褶皱便会羞耻微张，接纳深入时紧箍吸吮'
          :'禁区防线已被你破开，虽仍紧窄羞涩，却已能在充分润滑与安抚下颤抖接纳';
      }else if((c.limits?.anal||0)>=2){
        c.physiology.anusState='心理防线已悄然松动，紧致褶皱在被指尖逗弄擦过时会羞耻发烫、不再本能死绷';
      }
    }
    // rc.46：专属开发留痕兜底（跨越 1/3/6/10 节点或新解锁后庭/内射时自动更新，不覆盖模型手写）
    const priorMarks=String(prior.physiology?.bodyMarks||'');
    const wroteMarks=typeof c.physiology.bodyMarks==='string'&&c.physiology.bodyMarks.trim()&&c.physiology.bodyMarks!==priorMarks;
    if(!wroteMarks&&(withCount>0)){
      const crossedMilestone=countIncreased&&[1,3,6,10].includes(withCount);
      const newlyAnal=unlocked.some(t=>/后庭|肛|菊/.test(t))&&!(prior.intimacy?.unlockedTags||[]).some(t=>/后庭|肛|菊/.test(t));
      if(!c.physiology.bodyMarks||crossedMilestone||newlyAnal){
        const mark=autoBodyMark(withCount,unlocked,prowess);
        if(mark)c.physiology.bodyMarks=mark;
      }
    }
```

#### 1.3 协议定稿
见本文 **第三节 · `protocol.txt` 第 8 行与第 20 行**。

#### 1.4 UI 呈现

**文件**：`src/ui/screens.js` 第 59–64 行（`fleshPanel`）  
替换为：

```js
  const fleshPanel=c=>{
    const p=c.physiology||{},cnt=Number(c.intimacy?.withUserCount)||0;
    const chips=[p.cycle?pill('🌿 '+esc(p.cycle),cycleTone(p.cycle)):'',pill(p.virgin===false?'🌺 非处女':'💮 处女',p.virgin===false?'plum':'pink'),cnt>0?pill(`✦ 已被你开发 ${cnt} 次`,'plum'):'',pill(`🌡️ 情欲值：${axis(c.arousal??0)}/100`,axis(c.arousal??0)>=50?'pink':'')].filter(Boolean).join('');
    return `<div class="chips">${chips}</div>`
      +[line('生理周期',p.cycle),line('孕期',p.pregnancy),virginText(p),line('胸部详情',p.chestDetail,'hl-pink'),line('阴部户型与色泽',p.vaginaLook,'hl-pink'),line('阴部紧致与状态',p.vaginaState,'hl-plum'),line('阴毛类型',p.pubicHair),kv('后庭外观与状态',`${esc(p.anusLook||'尚未记录')} · ${esc(p.anusState||'尚未记录')}`),line('专属开发留痕',p.bodyMarks,'hl-plum'),kv('体香与特征',`${esc(p.bodyScent||'尚未记录')}${p.tattooScar?' · 纹身／疤痕：'+esc(p.tattooScar):''}`),line('敏感带详情',p.traits,'hl-strong')].filter(Boolean).join('');
  };
```

#### 1.5 验收要点
- **单测**：构造 `withUserCount=1`、`arousal=90` 实战轮 → 下一轮日常退潮（`arousal=10`，模型未写 `vaginaState`）→ 断言 `c.physiology.vaginaState` **不为空**且包含「初经」或「初尝」，不再退回 `seedAnatomy` 的初始模板；断言 `c.physiology.bodyMarks` 非空。
- **单测**：给角色加 `unlockedTags: ['后庭开发']` → 断言 `anusState` 脱离「禁区防线严密」变为已开发态。
- **实机**：人物详情「欲念 · 肉体」顶部可见 `✦ 已被你开发 N 次` 胶囊，底部可见「专属开发留痕」行。

---

### 条目 2：激活「偷窥她独处时的深夜私密与自慰实况」

#### 2.1 字段定义（Zod Schema + 默认值）

**文件 1**：`src/runtime/schema.js` 第 24 行  
`intimacy` 中将 `lastMasturbation` 上限扩为 `180`，新增 `lastMasturbationRevision`（与条目 5 的 `favoriteSensations` 一并合并写入）：

```js
    intimacy:z.object({attitude:narrative(60).default(''),abilityComment:narrative(200).default(''),favoriteSensations:narrative(100).default(''),partnersCount:z.number().int().nonnegative().default(0),sexPartnerCount:z.number().int().nonnegative().default(0),firstTime:narrative(150).default(''),experience:narrative(200).default(''),fetishes:narrative(200).default(''),unlockedTags:z.preprocess(v=>Array.isArray(v)?v:(typeof v==='string'&&v.trim()?v.split(/[、,，/／;；·|]/):[]),z.array(z.string().trim().min(1).max(16)).max(24)).default([]),withUserCount:z.number().int().nonnegative().default(0),lastIntimate:narrative(120).default(''),lastMasturbation:narrative(180).default(''),lastMasturbationRevision:z.number().int().nonnegative().default(0)}).prefault({}),
```

**文件 2**：`src/core/engine.js` 第 913 行（`privateDefaults().intimacy`）  
补齐 `favoriteSensations:''` 与 `lastMasturbationRevision:0`：

```js
  intimacy:{attitude:'',abilityComment:'',favoriteSensations:'',partnersCount:0,sexPartnerCount:0,firstTime:'',experience:'',fetishes:'',unlockedTags:[],withUserCount:0,lastIntimate:'',lastMasturbation:'',lastMasturbationRevision:0},
```

#### 2.2 播种、锁表与投影

**文件 1**：`src/runtime/settlement.js`
1. 第 64 行后加锁，防止模型直接篡改 `lastMasturbationRevision` 或意外清空 `lastMasturbation`：
```js
    if(proposed.intimacy&&typeof proposed.intimacy==='object'){
      proposed.intimacy.lastMasturbationRevision=Number(prior.intimacy?.lastMasturbationRevision||0);
      if(proposed.intimacy.lastMasturbation===''&&prior.intimacy?.lastMasturbation)proposed.intimacy.lastMasturbation=prior.intimacy.lastMasturbation;
    }
```
2. 在 `syncPrivateRecords` 循环内（第 247 行 `syncOutfit` 之前）记录刷新版本号：
```js
    const prevMast=String(prior.intimacy?.lastMasturbation||'').trim();
    const nextMast=String(c.intimacy?.lastMasturbation||'').trim();
    if(nextMast&&nextMast!==prevMast)c.intimacy.lastMasturbationRevision=s.scene.sceneRevision;
    else if(!nextMast&&prevMast)c.intimacy.lastMasturbation=prevMast;
```

**文件 2**：`src/core/engine.js` 第 1470–1476 行（`projection(s)`）
- 在场人物投影的 `intimacy` 剥离 `lastMasturbationRevision`（不喂给模型省 token）。
- 打星离场人物视图附带 `arousal: c.arousal` 与 `...(c.intimacy?.lastMasturbation?{lastMasturbation:c.intimacy.lastMasturbation}:{})`。
- 顶层新增 `nightMasturbationCandidates`（仅当 `world.time` 在 `22:00–05:59` 区间时输出最多 2 位满足离场且 `starred || affection>=45 || corruption>=35 || arousal>=40` 的女性 ID；白天不输出该键，0 token 浪费）。具体完整 `projection(s)` 替换块见 **第四节汇总**。

#### 2.3 协议定稿
见本文 **第三节 · `protocol.txt` 第 5 行、第 8 行与第 20 行**。

#### 2.4 UI 呈现

**文件 1**：`src/ui/screens.js`
1. `experiencePanel(c)` 中，替换原 `line('最近自慰',i.lastMasturbation)` 为（需把 `s` 传入或在 `createScreens` 内通过 `data().view.state` 读取 `sceneRevision`）：
```js
    const curRev=data().view?.state?.scene?.sceneRevision||0;
    const freshMast=!!(i.lastMasturbation&&Number(i.lastMasturbationRevision)===curRev&&curRev>0);
    const mastBlock=i.lastMasturbation
      ?`<div class="mast-card${freshMast?' is-fresh':''}"><div class="mast-head"><span>🌙 深夜私密 · 最近自慰</span>${freshMast?'<span class="chip-tag chip-pink pulse-badge">✦ 昨夜新刷新</span>':''}</div><div class="mast-body">${esc(i.lastMasturbation)}</div></div>`
      :'';
```
2. `scene()` 第 93 行打星异地实况中，若该离场女性本轮刚刷新 `lastMasturbation`，在她的 `offscreen` 下方附一行微亮入口：
```js
    ${starred.length?`<details class="card starred-offscreen"><summary>★ 特别关注 · 异地实况 <span class="muted">(${starred.length})</span></summary>${starred.map(c=>{const fresh=c.intimacy?.lastMasturbation&&Number(c.intimacy?.lastMasturbationRevision)===s.scene.sceneRevision&&s.scene.sceneRevision>0;return `<div class="muted"><b>${esc(c.name)}</b> · ${esc(c.offscreen||'近况尚未同步')}${fresh?` <button type="button" class="mini-pill-link" data-detail="${esc(c.id)}">✦ 昨夜私密</button>`:''}</div>`;}).join('')}<p class="muted">她们不在场，只在剧情推进时用一句近况更新。</p></details>`:''}
```

#### 2.5 验收要点
- **单测**：模型在深夜（`23:30`）replace `/shenghao/characters/c1/intimacy/lastMasturbation` → 断言 `c1.intimacy.lastMasturbationRevision === s.scene.sceneRevision`；下一轮模型未提该字段 → 断言原文保留且 `lastMasturbationRevision` 不变（不再标「新刷新」）；若模型误传 `""` → 断言原值不被清空。
- **单测**：`world.time = "23:10"` 时 `projection(s).nightMasturbationCandidates` 包含符合条件的离场女性；`world.time = "14:00"` 时该键为 `undefined`。
- **实机**：跨夜刷新后，「经历 · 尺度」里出现浅粉边框的「🌙 深夜私密 · 最近自慰」卡片与「✦ 昨夜新刷新」角标；「此刻」打星异地实况旁出现可点击的「✦ 昨夜私密」按钮。

---

### 条目 3：「你花的钱，长在了她身上」—— 专属赠礼穿戴与金屋供养陈列架

#### 3.1 字段定义（Zod Schema + 默认值）

**文件 1**：`src/runtime/schema.js`
1. 在第 10 行后定义 `giftItem`：
```js
  const giftItem=z.object({giftId:short.default(''),name:short,kind:z.enum(['HOUSE','CAR','LUXURY','LINGERIE','GIFT','OTHER']).default('GIFT'),amountCents:money.default(0),date:z.string().max(20).default(''),note:narrative(60).default('')});
```
2. 在第 26 行 `character` 末尾（`portraitRef` 前）新增：
```js
    giftsFromUser:z.array(giftItem).max(10).default([]),
```

**文件 2**：`src/core/engine.js` 第 938 行（`character()` 返回对象）  
补 `giftsFromUser:[],`

#### 3.2 播种、锁表与脚本自动沉淀（零模型负担）

**文件 1**：`src/runtime/settlement.js` 第 63 行  
将 `'giftsFromUser'` 加入不可写锁表数组，防止模型捏造或抹除：
```js
    for(const k of ['id','name','age','profileFixed','profileLocked','aliases','trackingState','starred','avatarRef','portraitRef','contactConfirmed','firstContactEvidence','giftsFromUser'])proposed[k]=clone(prior[k]??null);
```

**文件 2**：`src/core/engine.js`
1. 在第 1134 行（`case 'RELATIONSHIP_CHANGE'` 上方）新增纯函数 `classifyGiftKind` 与 `recordGiftFromUser`、`removeGiftFromUser`：

```js
function classifyGiftKind(txKind,assetKindVal,name=''){
  const raw=`${assetKindVal||''} ${name||''}`;
  if(txKind==='PROPERTY_PURCHASE'||assetKindVal==='HOUSE'||/房|平层|别墅|公寓|庄园|豪宅/.test(raw))return 'HOUSE';
  if(txKind==='VEHICLE_PURCHASE'||assetKindVal==='CAR'||/车|保时捷|迈巴赫|法拉利|劳斯莱斯|宾利|奔驰|宝马|座驾/.test(raw))return 'CAR';
  if(/内衣|胸罩|底裤|丝袜|黑丝|白丝|蕾丝|吊带袜|睡裙|睡衣|情趣|旗袍|高跟/.test(raw))return 'LINGERIE';
  if(assetKindVal==='LUXURY'||/表|钻|项链|手镯|耳环|戒指|珠宝|爱马仕|香奈儿|迪奥|LV|高定|包/.test(raw))return 'LUXURY';
  return 'GIFT';
}
function recordGiftFromUser(s,cid,item){
  const c=s.characters?.[cid];if(!c||!tracked(c))return;
  c.giftsFromUser=Array.isArray(c.giftsFromUser)?c.giftsFromUser:[];
  const name=String(item.name||'').trim().slice(0,150);if(!name)return;
  const giftId=String(item.giftId||'').trim().slice(0,150);
  if(giftId&&c.giftsFromUser.some(g=>g.giftId===giftId))return;
  c.giftsFromUser.push({giftId,name,kind:item.kind||'GIFT',amountCents:Math.max(0,Math.round(Number(item.amountCents)||0)),date:String(s.world?.date||'').slice(0,20),note:String(item.note||'').trim().slice(0,60)});
  if(c.giftsFromUser.length>10){
    const major=c.giftsFromUser.filter(g=>g.kind==='HOUSE'||g.kind==='CAR');
    const rest=c.giftsFromUser.filter(g=>g.kind!=='HOUSE'&&g.kind!=='CAR');
    const topVal=[...rest].sort((a,b)=>b.amountCents-a.amountCents).slice(0,4);
    const keepSet=new Set([...major,...topVal]);
    const latest=rest.filter(g=>!keepSet.has(g)).slice(-(Math.max(0,10-keepSet.size)));
    c.giftsFromUser=c.giftsFromUser.filter(g=>keepSet.has(g)||latest.includes(g)).slice(-10);
  }
}
function removeGiftFromUser(s,giftId){
  if(!giftId)return;
  for(const c of Object.values(s.characters||{})){
    if(Array.isArray(c?.giftsFromUser))c.giftsFromUser=c.giftsFromUser.filter(g=>g.giftId!==giftId);
  }
}
```

2. 在 `src/core/engine.js` `CASH_TRANSACTION` 第 1176 行后插入沉淀钩子：
```js
      if(e.direction==='OUT'&&['GIFT','SHOPPING','PROPERTY_PURCHASE','VEHICLE_PURCHASE'].includes(e.kind)){
        const itemLabel=e.asset?.name||e.itemName||e.memo;
        const gKind=classifyGiftKind(e.kind,e.asset?.kind,itemLabel);
        const recipients=new Map();
        for(const a of allocations)if(a.amountCents>0)recipients.set(a.personRef,a.amountCents);
        if(e.asset&&e.asset.ownerId&&e.asset.ownerId!=='USER'&&!recipients.has(e.asset.ownerId))recipients.set(e.asset.ownerId,e.amountCents);
        for(const [cid,amt] of recipients)recordGiftFromUser(s,cid,{giftId:e.factId,name:itemLabel,kind:gKind,amountCents:amt,note:e.merchantOrPlace||''});
      }
```

3. 在 `src/core/engine.js` `ASSET_TRANSFER` 第 1185 行后插入沉淀钩子：
```js
      recordGiftFromUser(s,e.personRef,{giftId:a.acquisitionEventId||e.factId,name:a.name,kind:classifyGiftKind('GIFT',a.kind,a.name),amountCents:a.bookValueCents||basis,note:a.locationNote||''});
```

4. 在 `src/core/engine.js` `TRANSACTION_REFUND` 第 1215 行（`return;` 前）插入退货清理：
```js
      if(returned+e.amountCents===original.amountCents||e.returnedAsset===true)removeGiftFromUser(s,original.eventId);
```

#### 3.3 协议与状态说明定稿
见本文 **第三节 · `state-context.txt` 第 3 行** 与 **`protocol.txt` 第 5 行**。

#### 3.4 UI 呈现

**文件**：`src/ui/screens.js`
1. 在 `createScreens` 内新增 `giftsShelf(c, compact=false)` 辅助函数（放在 `goalsBox` 旁）：
```js
  const GIFT_ICONS={HOUSE:'🏠',CAR:'🚗',LUXURY:'💎',LINGERIE:'🎀',GIFT:'🎁',OTHER:'✦'};
  const giftsShelf=(c,compact=false)=>{
    const list=Array.isArray(c?.giftsFromUser)?c.giftsFromUser:[];
    if(!list.length)return '';
    const items=[...list].reverse().slice(0,compact?6:10);
    return `<div class="gifts-shelf${compact?' is-compact':''}"><div class="gifts-title">✦ 你的专属馈赠与供养 <span class="muted">(${list.length})</span></div><div class="gifts-tags">${items.map(g=>`<span class="gift-pill kind-${String(g.kind||'GIFT').toLowerCase()}">${GIFT_ICONS[g.kind]||'🎁'} <b>${esc(g.name)}</b>${g.amountCents?` <small>${yuan(g.amountCents)}</small>`:''}</span>`).join('')}</div></div>`;
  };
```
2. 在 `outfitPanel(c)`（第 54 行 `return` 末尾）追加 `+giftsShelf(c,true)`（仅在有赠礼时渲染）。
3. 在 `detail(c)`（第 101 行 `${privateRecord(c)}` 之前）插入 `${giftsShelf(c,false)}`。

#### 3.5 验收要点
- **单测**：结算一笔 `CASH_TRANSACTION`（`kind:'GIFT'`，`itemName:'酒红蕾丝吊带袜套装'`，`allocations:[{personRef:'c1',amountCents:1280000}]`）→ 断言 `c1.giftsFromUser` 自动出现 `kind:'LINGERIE'` 条目，且 `projection(s).characters.c1.giftsFromUser` 包含 `'酒红蕾丝吊带袜套装(1.28万元)'`。
- **单测**：全额退款该笔交易 → 断言 `c1.giftsFromUser` 自动移除该条目；连续送 12 件礼物（含 1 套房产）→ 断言数组长度锁定 10 且房产不被挤掉。
- **实机**：人物详情页奖池下方与「行头 · 穿搭」内展示「✦ 你的专属馈赠与供养」标签条，图标与金额清晰不换行错位。

---

### 条目 4：把「底线格子」升级成「差一步就破防的攻略诱饵」

> 本条 **0 Schema 改动、0 协议改动、0 Token 增量**，100% 脚本与前端确定性派生。

#### 4.1 导出单一真相源与派生算法

**文件 1**：`src/core/engine.js`（放在 `corruptionStage` 函数下方，约第 75 行）  
新增并导出以下常量与函数（**攻略提示文案 100% 逐字定稿**）：

```js
export const LIMIT_GATES={cosplay:30,exposure:40,foreplay:50,intercourse:65,creampie:75,publicPlay:72,anal:82,multi:90};
export const LIMIT_LABELS={exposure:'露点展示',foreplay:'手口侍奉',intercourse:'实战插入',cosplay:'丝袜制服',creampie:'无套内射',anal:'后庭开发',publicPlay:'半公开偷欢',multi:'多人同欢'};
const LIMIT_STAGE_NAMES=['拒绝','犹豫','要条件','主动'];
export function limitProgress(c,key){
  const threshold=LIMIT_GATES[key];
  const cur=Math.max(0,Math.min(3,Number(c?.limits?.[key])||0));
  if(threshold===undefined||cur>=3)return {level:cur,nextLevel:3,nextThreshold:null,gap:0,near:false,pct:100};
  const openness=Math.max(Number(c?.affection)||0,(Number(c?.corruption)||0)*1.15);
  const nextThreshold=threshold+cur*15;
  const prevThreshold=cur===0?Math.max(0,threshold-25):threshold+(cur-1)*15;
  const gap=Math.max(0,Math.ceil(nextThreshold-openness));
  const pct=Math.max(0,Math.min(100,Math.round(((openness-prevThreshold)/Math.max(1,nextThreshold-prevThreshold))*100)));
  return {level:cur,nextLevel:cur+1,nextThreshold,gap,near:gap>0&&gap<=10,pct};
}
export function tacticalHint(c){
  if(!c)return '';
  const cycle=String(c.physiology?.cycle||'');
  const arousal=Number(c.arousal)||0;
  const weakness=String(c.limits?.weakness||'').trim();
  const candidates=Object.keys(LIMIT_GATES).map(key=>({key,label:LIMIT_LABELS[key],...limitProgress(c,key)})).filter(x=>x.level<3).sort((a,b)=>a.gap-b.gap);
  const next=candidates[0];
  const parts=[];
  if(/排卵|易孕/.test(cycle))parts.push('正值排卵易孕期，身体本能燥热、防线比平日更脆弱');
  else if(/月经|经期/.test(cycle))parts.push('正值经期，适合贴身照料、言语温存与边缘安抚，不宜硬推正戏');
  else if(arousal>=55)parts.push('此刻情欲已起，趁热贴近极易顺水推舟');
  if(next&&next.near){
    parts.push(`「${next.label}」只差约 ${next.gap} 点开放度即可升至「${LIMIT_STAGE_NAMES[next.nextLevel]}」${weakness?'，顺着她的软肋下手最容易半推半就':'，找准独处时机极易松口'}`);
  }else if(next){
    parts.push(`下一道最易撬动的防线是「${next.label}」（距「${LIMIT_STAGE_NAMES[next.nextLevel]}」约差 ${next.gap} 点开放度）`);
  }else{
    parts.push('八项尺度已全面向你敞开，可随心主导节奏');
  }
  return parts.join('；')+'。';
}
```

**文件 2**：`src/runtime/settlement.js` 第 272 行  
删除本地重复定义的 `const LIMIT_GATES={...};`，改为使用第 1 行从 `../core/engine.js` 导入的 `LIMIT_GATES`。

#### 4.2 UI 呈现

**文件**：`src/ui/screens.js`
1. 第 2 行 import 补入 `limitProgress,tacticalHint,addictionStage`。
2. 替换第 71–74 行 `limitCell` 为：
```js
  const limitCell=(label,key,c)=>{
    const prog=limitProgress(c,key),n=prog.level;
    const tone=n===3?'chip-pink':n===2?'chip-amber':n===1?'':'';
    return `<div class="limit-cell${n===0?' locked':''}${prog.near?' near':''}"><div class="limit-top"><span>${label}</span><span class="limit-badge ${tone}">${n} · ${limitText(n)}</span></div>${prog.near?`<div class="limit-near-tip">🔥 差 ${prog.gap} 点松动</div>`:''}${n<3?`<div class="limit-mini-bar"><i style="width:${prog.pct}%"></i></div>`:''}</div>`;
  };
```
3. 在 `experiencePanel(c)` 中，于 `<div class="limit-sep"></div>` 紧下方插入：
```js
    const hint=tacticalHint(c);
    const hintBox=hint?`<div class="tactical-card"><b>✦ 此刻突破风向：</b>${esc(hint)}</div>`:'';
```
并将底部 `limit-grid` 里的 `.map(([label,key])=>limitCell(label,l[key]))` 改为 `.map(([label,key])=>limitCell(label,key,c))`。

#### 4.3 验收要点
- **单测**：角色 `affection=60, corruption=0` 时，`limitProgress(c, 'intercourse')` 返回 `level:0, nextThreshold:65, gap:5, near:true`；`cycle='排卵期'` 时 `tacticalHint(c)` 同时包含「排卵易孕期」与「实战插入」「差约 5 点开放度」。
- **实机**：底线格中差 ≤10 点松动的格子呈柔和金粉色边框并显示 `🔥 差 N 点松动` 与底部细进度条；365px 窄屏与宽屏 4 列均无文字溢出。

---

### 条目 5：让玩家开局捏的「器大活好」真正闭环到每个女人的身体成瘾感上

#### 5.1 字段定义（Zod Schema + 默认值）
已在条目 2.1 中合并写入 `src/runtime/schema.js:24`（`intimacy.favoriteSensations: narrative(100).default('')`）与 `src/core/engine.js:913`（`favoriteSensations:''`）。`addictionLevel` **不存库**，由纯脚本实时派生。

#### 5.2 派生函数与脚本兜底

**文件 1**：`src/core/engine.js`（紧接 `tacticalHint` 之后新增并导出，**文案 100% 逐字定稿**）：

```js
export function topUserProwessTrait(user){
  const sa=user?.sexualAbility||{};
  const dims=[
    ['stamina',Number(sa.stamina)||70,'惊人的持久耐力与不竭体力'],
    ['hardness',Number(sa.hardness)||70,'滚烫坚挺的惊人硬度与压迫感'],
    ['technique',Number(sa.technique)||70,'精准游走敏感带的细腻掌控技巧'],
    ['volume',Number(sa.volume)||70,'滚烫浓稠、灌满深处的充沛射精量']
  ].sort((a,b)=>b[1]-a[1]);
  const length=String(user?.genitals?.length||'').trim();
  const girth=String(user?.genitals?.girth||'').trim();
  const sizeText=length&&girth?`${length}/${girth} 的饱满尺寸`:(length||girth||'炽热充实的尺寸');
  return {key:dims[0][0],score:dims[0][1],label:dims[0][2],sizeText};
}
export function addictionStage(c,user){
  const count=Number(c?.intimacy?.withUserCount)||0;
  if(count<=0)return null;
  const corr=Number(c?.corruption)||0;
  const prowess=Number(user?.prowessScore)||70;
  const score=count*12+corr*0.45+(prowess-50)*0.4;
  if(count===1||score<35)return {id:'first',label:'初尝禁果',tone:'pink'};
  if(score<65)return {id:'craving',label:'食髓知味',tone:'amber'};
  if(score<95)return {id:'synced',label:'深度契合',tone:'plum'};
  return {id:'addicted',label:'离你难眠',tone:'plum'};
}
```

**文件 2**：`src/runtime/settlement.js`  
替换第 203–210 行的 `abilityComment` 静态赋值块为以下阶梯演进兜底（**文案 100% 逐字定稿**）：

```js
      const prowess=s.user?.prowessScore??70;
      const stageInfo=addictionStage(c,s.user);
      const topTrait=topUserProwessTrait(s.user);
      const AUTO_ABILITY_RE=/^(?:尺寸惊人且持久滚烫|滚烫充实且节奏沉稳|虽非猛烈冲击，但细腻耐心|初尝你|每次与你交欢都越发|彻底迷恋被你的|身子已经彻底离不了)/;
      const curComment=String(c.intimacy.abilityComment||'').trim();
      const shouldRefreshAbility=!curComment||(countIncreased&&AUTO_ABILITY_RE.test(curComment));
      if(shouldRefreshAbility&&stageInfo){
        if(stageInfo.id==='addicted'){
          c.intimacy.abilityComment=`身子已经彻底离不了你的${topTrait.sizeText}与${topTrait.label}，独处深夜总会下意识夹腿回味被你填满失神的滋味`;
        }else if(stageInfo.id==='synced'){
          c.intimacy.abilityComment=`彻底迷恋被你的${topTrait.label}支配到腿软失神的掌控感，每次深入都让她由衷沉沦`;
        }else if(stageInfo.id==='craving'){
          c.intimacy.abilityComment=`每次与你交欢都越发食髓知味，${topTrait.sizeText}带来的滚烫充实让她防线一退再退`;
        }else{
          c.intimacy.abilityComment=prowess>=75
            ?`初尝你的${topTrait.sizeText}便被顶得几乎招架不住，滚烫而极具侵略性的存在感让她羞耻又悸动`
            :prowess>=50
              ?'滚烫充实且节奏沉稳，紧密贴合的深入交融让她由衷迷恋'
              :'虽非猛烈冲击，但细腻耐心的前戏爱抚与温存耳语依然让她羞耻动情';
        }
      }
      if((c.intimacy.withUserCount||0)>=2&&!String(c.intimacy.favoriteSensations||'').trim()){
        const arch=archetypeOf(c);
        const byArch={
          cool:`平日越克制，越招架不住你的${topTrait.label}，被强势顶开理智时会彻底失声`,
          proud:`嘴上不肯认输，身体却最迷恋你的${topTrait.sizeText}与掌控节奏时的绝对压迫感`,
          sunny:`最受不了你的${topTrait.label}，每次被折腾得满身薄汗发抖却又忍不住主动缠上来`,
          warm:`格外依恋被你从容包裹、以${topTrait.label}一点点融化进怀里的滚烫充实感`,
          pure:`羞耻却诚实地迷恋着你的${topTrait.sizeText}，每次被温柔又霸道地填满都会红着眼尾求饶`
        };
        c.intimacy.favoriteSensations=byArch[arch]||byArch.warm;
      }
```
> **注意**：需将 `countIncreased` 的计算从第 224 行提前到 `if(realSex)`（第 194 行）之前，确保 `if(realSex)` 内部可以读取 `countIncreased`。

#### 5.3 协议定稿
见本文 **第三节 · `protocol.txt` 第 8 行与第 20 行**。

#### 5.4 UI 呈现

**文件**：`src/ui/screens.js`（`experiencePanel(c)` 第 75–80 行）  
1. 顶部 `chips` 补入肉体契合度胶囊：
```js
    const s=data().view?.state,addict=addictionStage(c,s?.user);
    const chips=[pill('⛓️ '+esc(scaleText(l.scaleLevel)),'plum'),addict?pill('💘 '+esc(addict.label),addict.tone):'',i.firstTime?pill(esc(i.firstTime),'pink'):''].filter(Boolean).join('');
```
2. 在 `line('对你的评价',i.abilityComment,'hl-pink')` 紧下方插入：
```js
    line('最迷恋你的特质',i.favoriteSensations,'hl-plum'),
```

#### 5.5 验收要点
- **单测**：`withUserCount` 从 `1 → 3 → 6 → 10` 递增时，`addictionStage` 依次输出 `初尝禁果 → 食髓知味 → 深度契合 → 离你难眠`；当玩家 `sexualAbility.stamina=95`（最高）时，脚本自动生成的 `abilityComment` 与 `favoriteSensations` 明确呼应「持久耐力」与 `genitals` 尺寸；若模型亲手改写了 `abilityComment`，下轮递增时不覆盖模型手写文本。
- **实机**：「经历 · 尺度」头部亮出 `💘 食髓知味` 等阶段徽章，正文出现「最迷恋你的特质」一行。

---

### 条目 6：「攻略编年史」—— 破防高光 + 私密征服双轨时间轴

#### 6.1 字段定义（Zod Schema + 默认值）

**文件 1**：`src/runtime/schema.js`
1. 在第 10 行后定义 `milestoneItem`：
```js
  const milestoneItem=z.object({id:short.default(''),date:z.string().max(16).default(''),location:short.default(''),kind:z.enum(['HEART','INTIMATE']).default('HEART'),text:narrative(60)});
```
2. 在第 26 行 `character` 末尾新增：
```js
    milestones:z.array(milestoneItem).max(12).default([]),
```

**文件 2**：`src/core/engine.js` 第 938 行（`character()` 返回对象）  
补 `milestones:[],`

#### 6.2 脚本自动兜底 + 模型润色双轨合并

**文件**：`src/runtime/settlement.js`
1. 在 `settleNative` 中（第 83 行 `s.characters[cid]=acceptFields(...)` 之后），对 `milestones` 做**历史保护合并**（模型绝不能删掉旧编年史，只能追加或润色同日条目）：
```js
    const prevMs=Array.isArray(prior.milestones)?prior.milestones:[];
    const nextMs=Array.isArray(s.characters[cid].milestones)?s.characters[cid].milestones:[];
    if(prevMs.length||nextMs.length){
      const merged=clone(prevMs);
      for(const item of nextMs){
        const txt=String(item?.text||'').trim();if(!txt)continue;
        if(merged.some(m=>m.text===txt||(m.id&&item.id&&m.id===item.id)))continue;
        const d=item.date||String(s.world?.date||'').slice(5);
        const loc=item.location||String(s.scene?.location||'').slice(0,18);
        const kind=item.kind==='INTIMATE'?'INTIMATE':'HEART';
        const sameDayIdx=merged.findIndex(m=>m.date===d&&m.kind===kind&&String(m.id||'').startsWith('auto_'));
        const rec={id:item.id||`model_${s.scene.sceneRevision}_${merged.length}`,date:d,location:loc,kind,text:txt.slice(0,60)};
        if(sameDayIdx>=0)merged[sameDayIdx]=rec;
        else merged.push(rec);
      }
      s.characters[cid].milestones=merged.slice(-12);
    }
```

2. 在 `syncPrivateRecords` 中（`behaviors` 收集处第 177–182 行，补存 `rec.mode=e.mode||rec.mode||''` 和 `rec.milestone=e.milestone||rec.milestone||''`；然后在循环内 `syncOutfit` 之前）加入脚本自动记事兜底：
```js
    // rc.46 条目6：攻略编年史自动兜底（score>=75 或初夜破处，且本轮模型未主动新增同 kind 编年史时自动补一条）
    const priorMsCount=(prior.milestones||[]).length;
    const modelAddedMs=(c.milestones||[]).length>priorMsCount;
    const msDate=String(s.world?.date||'').slice(5);
    const msLoc=String(s.scene?.location||'').trim().slice(0,18);
    const firstNightThisRound=realSex&&prior.physiology?.virgin!==false&&c.physiology?.virgin===false;
    if(!modelAddedMs&&(firstNightThisRound||behavior.score>=75)){
      const kind=(firstNightThisRound||behavior.mode==='INTIMATE'||sexNow)?'INTIMATE':'HEART';
      const rawText=firstNightThisRound
        ?'初夜交付于你，防线彻底瓦解'
        :String(behavior.text||'').trim().slice(0,55);
      if(rawText){
        c.milestones=Array.isArray(c.milestones)?c.milestones:[];
        const dup=c.milestones.some(m=>m.date===msDate&&m.kind===kind&&m.text===rawText);
        if(!dup){
          c.milestones.push({id:`auto_${s.scene.sceneRevision}_${kind}`,date:msDate,location:msLoc,kind,text:rawText});
          c.milestones=c.milestones.slice(-12);
        }
      }
    }
```

3. 兼容模型用 `add` 往 `/shenghao/characters/<cid>/milestones/-` 追加元素：在 `prepareModelCommand` 第 351 行放行 `parts[3]==='milestones'` 的 `parts.length===4` 数组整体写入（已由现有 `parts.length===4` 路径支持，只需确认 `Array.isArray(value)` 时不走 `{...(prior[parts[3]]||{}),...value}` 对象展开——**现有第 359 行已判断 `!Array.isArray(value)`，天然兼容！**）。

#### 6.3 协议定稿
见本文 **第三节 · `protocol.txt` 第 10 行与第 20 行**。

#### 6.4 UI 呈现

**文件**：`src/ui/screens.js`
1. 新增 `milestonesBlock(c)` 函数（放在 `giftsShelf` 旁）：
```js
  const milestonesBlock=c=>{
    const list=Array.isArray(c?.milestones)?[...c.milestones].reverse():[];
    if(!list.length)return '';
    const renderItem=m=>`<div class="ms-item kind-${m.kind==='INTIMATE'?'intimate':'heart'}"><div class="ms-meta"><span class="ms-dot">${m.kind==='INTIMATE'?'🔥':'💗'}</span><span>${esc(m.date)}${m.location?' · '+esc(m.location):''}</span></div><div class="ms-text">${esc(m.text)}</div></div>`;
    const head=list.slice(0,4).map(renderItem).join('');
    const rest=list.slice(4).map(renderItem).join('');
    return `<div class="section-head"><h3>✦ 我们的大事记</h3><span class="muted">共 ${list.length} 段</span></div><div class="card ms-list">${head}${rest?`<details class="ms-more"><summary>展开更早的 ${list.length-4} 段回忆</summary>${rest}</details>`:''}</div>`;
  };
```
2. 在 `detail(c)` 第 101 行 `${privateRecord(c)}` 之后插入 `${milestonesBlock(c)}`。

#### 6.5 验收要点
- **单测**：提交一条 `score:82, mode:'BREAKTHROUGH', action:'替她摆平画廊恶意压价'` → 断言 `c.milestones` 自动追加 1 条 `kind:'HEART'` 记录且 `projection(s).characters[cid].milestones` 带出紧凑字符串；下一轮模型传空数组 `[]` → 断言旧记录不丢失。
- **单测**：连续新增 15 条 → 断言长度封顶 12 条。
- **实机**：人物详情页在四方块与九大档案之间出现「✦ 我们的大事记」双色时间轴（💗 粉 / 🔥 紫），超过 4 条自动折叠展开。

---

### 条目 7：「她主动发来的一条未读私信」—— 活人终端钩子

#### 7.1 字段定义（Zod Schema + 默认值）

**文件 1**：`src/runtime/schema.js`
1. 在第 10 行后定义 `lastMessageSchema`（容错：允许模型传 `null` 或纯字符串，自动归一化）：
```js
  const lastMessageSchema=z.preprocess(v=>{
    if(v==null)return {time:'',text:''};
    if(typeof v==='string')return {time:'',text:v};
    return v;
  },z.object({time:z.string().max(24).default(''),text:narrative(90).default('')})).prefault({});
```
2. 在第 26 行 `character` 末尾新增：
```js
    lastMessage:lastMessageSchema,
```

**文件 2**：`src/core/engine.js` 第 938 行（`character()` 返回对象）  
补 `lastMessage:{time:'',text:''},`

#### 7.2 播种与脚本兜底

**文件**：`src/runtime/settlement.js`
1. 在 `syncPrivateRecords` 中（`syncOutfit` 之前）补全时间与防清空保护：
```js
    // rc.46 条目7：私信补时间戳与防意外清空
    const prevMsgText=String(prior.lastMessage?.text||'').trim();
    const curMsgText=String(c.lastMessage?.text||'').trim();
    if(curMsgText){
      if(!String(c.lastMessage?.time||'').trim()){
        c.lastMessage.time=`${String(s.world?.date||'').slice(5)} ${String(s.world?.time||'')}`.trim();
      }
    }else if(prevMsgText){
      c.lastMessage=clone(prior.lastMessage);
    }
```

#### 7.3 宿主引导句接口

**文件**：`src/runtime/host.js` 第 311 行（`prepareAppointment` 紧下方）新增：

```js
  async prepareReplyMessage(cid){
    const c=current?.state.characters[cid];
    requireRule(c&&c.lastMessage?.text,'MESSAGE_UNAVAILABLE');
    return '我看到了'+c.name+'发来的私信：「'+c.lastMessage.text+'」。我想现在回复或联系她（请先保留我具体的回复内容与决定，不要替我自动发消息或跳转场景）：';
  },
```

#### 7.4 协议定稿
见本文 **第三节 · `protocol.txt` 第 5 行与第 20 行**。

#### 7.5 前端未读红点与 UI 呈现

**文件 1**：`src/ui/app.js`
1. 在第 184 行 `pendingNotices()` 旁新增私信未读判定（纯前端 `prefs.readMessages` 记录已读签名，**零 `mutateState`**）：
```js
function msgSig(c){const m=c?.lastMessage;return m?.text?`${m.time||''}|${m.text}`:'';}
function isMsgUnread(c){const sig=msgSig(c);if(!sig)return false;return (view?.prefs?.readMessages?.[c.id]||'')!==sig;}
function unreadMessages(){return Object.values(view?.state?.characters||{}).filter(c=>c.trackingState==='RECORDED'&&isMsgUnread(c));}
function markMsgRead(cid){const c=woman(cid),sig=msgSig(c);if(!sig||!isMsgUnread(c))return;const next={...(view?.prefs?.readMessages||{}),[cid]:sig};api?.preferences?.({readMessages:next});}
```
2. 第 159 行与第 163 行折叠态红点条件，由 `pendingNotices().length` 改为 `(pendingNotices().length||unreadMessages().length)`。
3. 第 208 行点击进入人物详情 `if(d.detail)` 时，顺手调用 `markMsgRead(d.detail);`：
```js
  if(d.detail){detail=d.detail;section=null;privateSection=null;consumptionPage=0;markMsgRead(d.detail);phone();$('phoneScreen').scrollTop=0;}
```
4. 第 223 行（`prepareAppointment` 紧下方）新增点击回应私信弹窗：
```js
  if(d.replyMessage){const text=await api.prepareReplyMessage(d.replyMessage);showModal('<h3>在正文回应她</h3><p>以下引导句可复制到输入框后接上你的回复，不会替你自动发言。</p><textarea class="story-draft" readonly>'+esc(text)+'</textarea><div class="row"><button class="btn" data-act="cancel">关闭</button></div>');}
```
5. 第 152 行传给 `createScreens` 的选项里增加 `isMsgUnread`：`createScreens({data:()=>({...}),esc,yuan,image,avatar,isMsgUnread})`。
6. 第 275 行 `signature` 数组末尾补入 `v.prefs.readMessages`（确保标已读后立刻重绘清红点）。

**文件 2**：`src/ui/screens.js`
1. 第 4 行解构接收 `isMsgUnread=()=>false`。
2. `women()`（第 97 行）：在每位女性卡片的姓名行追加未读私信徽标，并在卡片下方预览私信原文：
```js
  const msgPreview=c=>c.lastMessage?.text?`<div class="msg-preview${isMsgUnread(c)?' is-unread':''}">💬 ${esc(c.lastMessage.text)}</div>`:'';
```
在 `women()` 卡片 `${c.starred?...}` 后追加 `${isMsgUnread(c)?' <span class="tag pink">💬 新私信</span>':''}`，并在 `.char-row` 闭合后追加 `${msgPreview(c)}`。
3. `detail(c)`（第 99 行）：在头部卡片 `${goalsBox(c,true)}` 后插入私信气泡块：
```js
  const messageBox=c=>c.lastMessage?.text?`<div class="dm-card"><div class="dm-head"><b>💬 她发来的私信</b><span class="muted">${esc(c.lastMessage.time||'刚刚')}</span></div><p class="dm-text">「${esc(c.lastMessage.text)}」</p><button type="button" class="mini-btn" data-reply-message="${esc(c.id)}">在正文回应她 →</button></div>`:'';
```

#### 7.6 验收要点
- **单测**：模型 replace `/shenghao/characters/c2/lastMessage` 为 `{"text":"刚洗完澡试了你送的裙子"}`（漏写 `time`）→ 断言脚本自动补齐 `time`；模型只传纯字符串 → 断言归一化为 `{time, text}`；下轮未提 → 断言保留。
- **实机**：离场女性发来私信后，折叠态小手机/底部横条亮红点；「她们」列表该人物出现 `💬 新私信` 与一行预览；点进人物详情后红点消失，头部出现私信气泡；点「在正文回应她 →」弹出只读引导句复制框，不自动发送消息。

---

## 三、协议与状态说明 100% 逐字定稿（DSH 严禁改动一字一标点）

> **强制纪律**：DSH 必须将下方代码块 **100% 逐字复制粘贴**到对应文件的对应行，不得缩写、润色或删改任何标点。

### 3.1 `src/content/protocol.txt` 逐行定稿

#### 替换第 5 行（原第 5 行整行替换）：
```text
同步玩家currentClothes/currentPose/currentAction及人物currentClothes/currentPose/currentAction/currentExpression/currentMood/currentCondition/currentItems，换装或脱衣时同步outfit（style/complexion/top/bottom/lingerie/socks/shoes/makeup/accessories，未穿写“没穿”）；若该人物giftsFromUser非空，穿搭、住所与配饰描写须自然体现她正住着、戴着或穿着你送的物品；同步currentThought（第一人称写出她此刻具体在盘算、顾虑、动摇或渴望的真实念头，严禁套用“嘴上说不要身体很诚实”等八股句）；每轮同步在场人物情欲值arousal（0–100，代表这一刻她想不想和你做：日常平淡0–15、心猿意马被撩动25–55、脱衣前戏升温55–80、正戏交欢85–100；完事进入事后相拥平复时必须大幅回落到5–20，唯有刚完事她主动开口要“再来一次”或玩家趁余韵继续讨要时才回补到65–80）；凡starredOffscreenIds列出的打星离场人物，本轮replace其/shenghao/characters/<ID>/offscreen为一句10–30字最新异地实况（地点+正在做的事或围绕recentGoal的动向）；跨时段、跨夜或出现社交涟漪时，可择1位不在场的打星或高关系女性replace /shenghao/characters/<ID>/lastMessage为{"time":"MM-DD HH:mm","text":"60字内贴合性格的主动私信"}（宁缺毋滥，不每轮硬刷）。
```

#### 替换第 8 行（原第 8 行整行替换）：
```text
私密四维档案与底线约束：①每轮涉亲密互动前先对照limits开放档位（0拒绝/1犹豫/2要条件/3主动），若玩家要求对应项为0（拒绝），正文中她会按性格推拒或避开，不写顺从就范；②发生60+分有效亲密互动时，按玩家实际genitals尺寸与sexualAbility档位，更新 /shenghao/characters/<ID>/physiology（chestDetail/vaginaLook/vaginaState/pubicHair/anusState/bodyScent/traits/bodyMarks）与 /intimacy（attitude/firstTime/fetishes）、/limits（weakness/worry）；③发生75+分深入亲密或90+分实战交欢时，同轮写 /physiology/virgin（实战后置false）、/physiology/vaginaState（写出被你开发后的真实状态）、/physiology/bodyMarks（解锁新部位或跨越次数节点时增量覆写被你亲手改变的永久身体留痕）、/intimacy/abilityComment（每次withUserCount递增时按当前次数阶段与玩家genitals/sexualAbility突出项刷新她的最新体感评价）、/intimacy/favoriteSensations（写出她最迷恋你的1–2个身体或技巧特征）、/intimacy/withUserCount（累加次数）、/intimacy/lastIntimate（地点与简述）及 /intimacy/unlockedTags（追加2–6字玩法标签数组）；④若顶层nightMasturbationCandidates非空（深夜22:00后或跨夜），可择1位最有张力的离场女性replace /shenghao/characters/<ID>/intimacy/lastMasturbation（写清时间、想起你时的触发锚点与独处细节，未发生则保持原值不清空）。cycle生理期与limits底线档位由脚本自动推算。
```

#### 替换第 10 行（原第 10 行整行替换）：
```text
双模式行为评分：在pendingEvents加入{"type":"BEHAVIOR","personRef":"<ID>","mode":"BREAKTHROUGH"|"INTIMATE","action":"简短标题","score":78}；每人每轮一条、全轮最多3条。①日常破防模式（mode:"BREAKTHROUGH"）：普通寒暄、刚认识的闲聊或顺手小事低于40分不提交！唯有实质推进其recentGoal、触及并宽慰其hiddenScar暗伤心结、重金撑腰或让她跨出性格防线时才提交（按这一步对她本人的突破跨度打40–97分）。②涩涩突破模式（mode:"INTIMATE"）：仅当本轮亲密尺度达到其limits许可范围（非0拒绝）且相比上一轮有实质推进、解锁新玩法标签或达成高潮/情感破防节点时提交（纯粹重复上一轮同一动作不重复提交高分；边缘挑逗与贴身爱抚60–74；丝袜制服/手口足侍奉/半公开偷欢75–89；实战插入深入/高潮失神/背德臣服90–97；破处初夜/多人侍奉/确认受孕等首次终极里程碑98–100带milestone）。③大事记编年史：75+分高光或初夜会自动记入milestones，若想留下更有画面感的记忆锚点，可同轮向/shenghao/characters/<ID>/milestones追加一条{"date":"MM-DD","location":"地点","kind":"HEART"|"INTIMATE","text":"45字内画面感短句"}（只追加不删旧记录）。随机奖金与同日衰减由脚本自动计算，不写奖金。
```

#### 替换第 20 行（原第 20 行合并示例整行替换）：
```text
[{"op":"replace","path":"/shenghao/characters/char_在场ID/affection","value":72},{"op":"replace","path":"/shenghao/characters/char_在场ID/corruption","value":38},{"op":"replace","path":"/shenghao/characters/char_在场ID/arousal","value":92},{"op":"replace","path":"/shenghao/characters/char_在场ID/currentThought","value":"他居然看出了我对着那盆旧雪松发呆的原因……替我把画廊布展的难题一并揽下后，此刻被他滚烫的手掌扣住腰窝，我再也装不出平日的冷静了。"},{"op":"replace","path":"/shenghao/characters/char_在场ID/recentGoal","value":"筹备下月在云澜当代艺术中心的个人主题花艺展"},{"op":"replace","path":"/shenghao/characters/char_在场ID/hiddenScar","value":"早年与初恋合伙的工作室被对方背叛贱卖，留下一盆枯死的雪松盆景，从此不敢轻信任何合伙承诺；今夜微醺后首次向你吐露当年旧事，心防大幅松动"},{"op":"replace","path":"/shenghao/characters/char_在场ID/outfit","value":{"style":"通勤轻熟","complexion":"双颊潮红，眼神迷离","top":"真丝白衬衫半解","bottom":"高腰包臀裙推至腰间","lingerie":"黑色蕾丝半杯胸罩，底裤已褪","socks":"薄款透肉黑丝","shoes":"细高跟散落脚边"}},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/virgin","value":false},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/vaginaLook","value":"饱满馒头穴，外唇丰润紧拢，色泽娇嫩粉润"},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/vaginaState","value":"初次被滚烫尺寸撑开接纳，内壁温热紧箍、春水泥泞泛红"},{"op":"replace","path":"/shenghao/characters/char_在场ID/physiology/bodyMarks","value":"初次被你的强悍尺寸彻底开拓，敏感腰窝与花芯已牢牢记住你的体温与力道"},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/abilityComment","value":"充沛滚烫的尺寸将她彻底填满，沉稳持久的节奏让她连环失神沦陷"},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/favoriteSensations","value":"最招架不住你扣住腰窝深顶时的滚烫硬度与不竭耐力"},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/unlockedTags","value":["深情热吻","丝袜制服","破处初夜"]},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/withUserCount","value":1},{"op":"replace","path":"/shenghao/characters/char_在场ID/intimacy/lastIntimate","value":"2026-11-16 · 云玺湾大平层主卧首次交欢"},{"op":"replace","path":"/shenghao/characters/char_在场ID/milestones","value":[{"date":"11-16","location":"云玺湾主卧","kind":"INTIMATE","text":"微醺吐露旧伤后将处子初夜交付于你，咬着肩头失神求饶"}]},{"op":"replace","path":"/shenghao/characters/char_打星离场ID/offscreen","value":"花艺工作室 · 修剪刚运到的高山杜鹃，对着窗外夜色想起你白天的提议"},{"op":"replace","path":"/shenghao/characters/char_打星离场ID/intimacy/lastMasturbation","value":"11-16 23:40 · 换上你挑的真丝睡裙想起下午耳畔低语，关灯咬着枕角自己泄了一次"},{"op":"replace","path":"/shenghao/characters/char_打星离场ID/lastMessage","value":{"time":"11-16 23:52","text":"刚试了你寄来的酒红蕾丝，肩带好像有点紧……明晚有空来帮我调吗？"}},{"op":"replace","path":"/shenghao/pendingEvents","value":[{"type":"CASH_TRANSACTION","direction":"OUT","amountYuan":"1200万","payer":"USER","completed":true,"kind":"PROPERTY_PURCHASE","itemName":"云玺湾临江大平层","memo":"全款购入云玺湾大平层","allocations":[],"asset":{"assetId":"asset_yunxiwan_1","kind":"HOUSE","name":"云玺湾临江大平层","ownerId":"USER","bookValueYuan":"1200万","locationNote":"东岸新区云玺湾","description":"东岸一线江景320㎡奢装大平层，私梯入户配全景落地窗与双车位。"},"evidence":"当场刷卡全款一千两百万元签下东岸云玺湾临江大平层"},{"type":"BEHAVIOR","personRef":"char_在场ID","mode":"INTIMATE","action":"主卧深吻并发生首次亲密交欢","score":98,"milestone":"first_night"}]}]
```

### 3.2 `src/content/state-context.txt` 逐行定稿

#### 替换第 3 行（原第 3 行整行替换）：
```text
人物实际在场时，附带基础资料、当前穿搭、近期目标（recentGoal）、长期梦想（longTermDream）、隐藏暗伤伏笔（hiddenScar）、私密四维档案（physiology/outfit/intimacy/limits）、玩家赠礼供养清单（giftsFromUser）与共同大事记（milestones），九大深度档案仅在已生成且未锁定时附带。已打星标（starredOffscreenIds列出）的离场人物附带recentGoal、hiddenScar、offscreen近况、赠礼摘要与最近私信/自慰记录，本轮必须更新她们此刻在何处做什么；深夜时nightMasturbationCandidates列出可触发独处深夜私密的离场女性；其余离场及隐藏者只保留极简身份索引，用于辨认同一人物，不代表到场。每位人物沿用稳定ID，不重复建档。
```

---

## 四、`projection(s)` 完整替换代码（`src/core/engine.js` 第 1467–1478 行）

为避免多处零散改动打架，直接整块替换 `projection(s)` 中 `view` 与返回对象部分：

```js
  const stripIntimacy=i=>{if(!i)return undefined;const out=clone(i);delete out.lastMasturbationRevision;return out;};
  const view=c=>{
    const base={id:c.id,name:c.name,aliases:c.aliases,trackingState:c.trackingState};
    if(!tracked(c))return base;
    const gifts=Array.isArray(c.giftsFromUser)&&c.giftsFromUser.length?c.giftsFromUser:null;
    const ms=Array.isArray(c.milestones)&&c.milestones.length?c.milestones:null;
    const dm=c.lastMessage?.text?c.lastMessage:null;
    if(s.scene.presentCharacterIds.includes(c.id))return {...base,age:c.age,beautyScore:c.beautyScore,occupation:c.occupation,...basicProfile(c),affection:c.affection,corruption:c.corruption??0,relationshipLabel:c.relationshipLabel,relationshipNotes:c.relationshipNotes,knownFacts:c.knownFacts,addressing:c.addressing,impression:c.impression,currentClothes:c.currentClothes,currentPose:c.currentPose,currentAction:c.currentAction,currentExpression:c.currentExpression,currentMood:c.currentMood,currentCondition:c.currentCondition,currentItems:c.currentItems,currentThought:c.currentThought,arousal:c.arousal,recentGoal:c.recentGoal??'',longTermDream:c.longTermDream??'',hiddenScar:c.hiddenScar??'',...(gifts?{giftsFromUser:gifts.slice(-6).map(g=>`${g.name}(${formatYuanReadable(g.amountCents)})`)}:{}),...(ms?{milestones:ms.slice(-6).map(m=>`${m.date}·${m.location}·${m.kind==='INTIMATE'?'私密':'破防'}：${m.text}`)}:{}),...(c.physiology?{physiology:clone(c.physiology)}:{}),...(c.outfit?{outfit:clone(c.outfit)}:{}),...(c.intimacy?{intimacy:stripIntimacy(c.intimacy)}:{}),...(c.limits?{limits:clone(c.limits)}:{}),...(c.profileFixed&&!c.profileLocked?{profileFixed:c.profileFixed}:{})};
    return c.starred?{...base,relationshipLabel:c.relationshipLabel,affection:c.affection,corruption:c.corruption??0,arousal:c.arousal,recentGoal:c.recentGoal??'',hiddenScar:c.hiddenScar??'',starred:true,offscreen:c.offscreen,...(gifts?{giftsFromUser:gifts.slice(-3).map(g=>g.name)}:{}),...(c.intimacy?.lastMasturbation?{lastMasturbation:c.intimacy.lastMasturbation}:{}),...(dm?{lastMessage:dm}:{})}:base;
  };
  const characters=Object.fromEntries(Object.values(s.characters).map(c=>[c.id,view(c)]));
  // Top-level to-do list so the model cannot miss off-stage starred women.
  const starredOffscreenIds=Object.values(s.characters).filter(c=>tracked(c)&&c.starred&&!s.scene.presentCharacterIds.includes(c.id)).map(c=>c.id);
  const hour=Number(String(s.world?.time||'12:00').split(':')[0]);
  const isLateNight=Number.isFinite(hour)&&(hour>=22||hour<6);
  const nightMasturbationCandidates=isLateNight
    ?Object.values(s.characters).filter(c=>tracked(c)&&!s.scene.presentCharacterIds.includes(c.id)&&(c.starred||c.affection>=45||(c.corruption??0)>=35||(c.arousal??0)>=40)).slice(0,2).map(c=>c.id)
    :[];
  return {schemaVersion:3,revision:s.meta.revision,starredOffscreenIds,...(nightMasturbationCandidates.length?{nightMasturbationCandidates}:{}),user:{...s.user,cashYuan:formatYuanReadable(s.user.cashCents),wealthTier:wealthTier(tierBasis(s)),pendingProfileFields:['heightCm','weightKg','shoeSizeEu'].filter(k=>s.user[k]==null)},scene:s.scene,characters,pendingBasicProfiles,
    assets:Object.values(s.finance.assets).filter(a=>a.ownerId==='USER'&&a.status==='OWNED').map(a=>({assetId:a.assetId,name:a.name,kind:a.kind,description:a.description,locationNote:a.locationNote,ownershipNote:a.ownershipNote,bookValueCents:a.bookValueCents,bookValueYuan:formatYuanReadable(a.bookValueCents)})),
    recentFacts:Object.entries(s.facts).slice(-60).map(([factId,f])=>{const l=ledgerByFact.get(factId);return {factId,type:f.type,...(l?{kind:l.kind,itemName:l.itemName,amountCents:l.amountCents,amountYuan:formatYuanReadable(l.amountCents),assetId:l.assetId,refundOf:l.refundOf}:{})};}),rule:'只提出新事实，不直接写现金、奖池或提现。付款前先核对user.cashYuan可用现金；已列factId不得再次入账；退款的refundOf按交易名称、金额与资产匹配原付款factId，不猜ID。'};
```

---

## 五、CSS 增量样式（追加至 `src/ui/style.css` 末尾）

```css
/* rc.46：男性向档案升级样式（赠礼陈列架 / 攻略风向 / 底线松动 / 深夜私密 / 大事记 / 主动私信） */
.gifts-shelf{margin:8px 0;padding:9px 10px;border-radius:12px;border:1px solid var(--ui-amber-border);background:var(--ui-amber-bg)}
.gifts-shelf.is-compact{margin:8px 0 2px;padding:7px 9px}
.gifts-title{font-size:calc(11px * var(--cj-font-scale,1));font-weight:700;color:var(--ui-amber);margin-bottom:6px}
.gifts-tags{display:flex;flex-wrap:wrap;gap:5px}
.gift-pill{display:inline-flex;align-items:center;gap:4px;padding:2.5px 8px;border-radius:999px;font-size:calc(10px * var(--cj-font-scale,1));background:var(--ui-card);border:1px solid var(--ui-line);color:var(--ui-ink)}
.gift-pill.kind-house,.gift-pill.kind-car{border-color:var(--ui-amber-border);background:var(--ui-soft)}
.gift-pill.kind-lingerie{border-color:var(--ui-pink-border);color:var(--ui-pink)}
.gift-pill small{color:var(--ui-sub);font-size:calc(9px * var(--cj-font-scale,1))}

.tactical-card{border-left:3px solid var(--ui-amber);background:var(--ui-amber-bg);border-radius:9px;padding:7px 9px;margin:6px 0 8px;font-size:calc(10.5px * var(--cj-font-scale,1));line-height:1.6;color:var(--ui-ink)}
.tactical-card b{color:var(--ui-amber)}

.limit-cell{flex-direction:column;align-items:stretch;gap:3px}
.limit-top{display:flex;align-items:center;justify-content:space-between;gap:4px;width:100%}
.limit-top>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis}
.limit-cell.near{opacity:1;border-color:var(--ui-amber-border);background:var(--ui-amber-bg);box-shadow:0 0 0 1px var(--ui-amber-border)}
.limit-near-tip{font-size:calc(9px * var(--cj-font-scale,1));font-weight:700;color:var(--ui-amber);line-height:1.2}
.limit-mini-bar{height:3px;border-radius:999px;background:var(--ui-line);overflow:hidden}
.limit-mini-bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--ui-amber),var(--ui-pink));border-radius:999px}

.mast-card{margin:7px 0;padding:8px 10px;border-radius:10px;border:1px solid var(--ui-pink-border);background:var(--ui-pink-bg)}
.mast-card.is-fresh{box-shadow:0 0 0 1px var(--ui-pink-border)}
.mast-head{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:calc(10.5px * var(--cj-font-scale,1));font-weight:700;color:var(--ui-pink);margin-bottom:4px}
.mast-body{font-size:calc(11px * var(--cj-font-scale,1));line-height:1.6;color:var(--ui-ink)}
.pulse-badge{animation:cjPulse 1.8s ease-in-out infinite}
@keyframes cjPulse{0%,100%{opacity:1}50%{opacity:.62}}
@media(prefers-reduced-motion:reduce){.pulse-badge{animation:none}}
.mini-pill-link{border:1px solid var(--ui-pink-border);background:var(--ui-pink-bg);color:var(--ui-pink);border-radius:999px;padding:1px 7px;font-size:calc(9.5px * var(--cj-font-scale,1));font-weight:700;cursor:pointer;vertical-align:middle}

.ms-list{padding:10px 12px}
.ms-item{position:relative;padding:6px 0 6px 12px;border-left:2px solid var(--ui-pink-border);margin-left:4px}
.ms-item.kind-intimate{border-left-color:var(--ui-plum-border)}
.ms-meta{display:flex;align-items:center;gap:5px;font-size:calc(10px * var(--cj-font-scale,1));color:var(--ui-sub);margin-bottom:2px}
.ms-text{font-size:calc(11px * var(--cj-font-scale,1));line-height:1.55;color:var(--ui-ink)}
.ms-more{margin-top:6px}.ms-more summary{cursor:pointer;font-size:calc(10.5px * var(--cj-font-scale,1));color:var(--ui-accent);font-weight:600}

.msg-preview{margin-top:6px;padding:5px 8px;border-radius:8px;background:var(--ui-soft);font-size:calc(10.5px * var(--cj-font-scale,1));color:var(--ui-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msg-preview.is-unread{background:var(--ui-pink-bg);color:var(--ui-pink);font-weight:600}
.dm-card{margin-top:8px;padding:9px 10px;border-radius:11px;border:1px solid var(--ui-pink-border);background:var(--ui-pink-bg)}
.dm-head{display:flex;align-items:center;justify-content:space-between;font-size:calc(11px * var(--cj-font-scale,1));color:var(--ui-pink);margin-bottom:4px}
.dm-text{margin:0 0 7px;font-size:calc(11.5px * var(--cj-font-scale,1));line-height:1.6;color:var(--ui-ink)}
```

---

## 六、上下文 Token 预算精确核算

按中文约 `0.8 token / 字`、JSON 键名与标点约 `0.35 token / 字符` 核算，假设典型中后期场景：**1 位在场女性 + 2 位打星离场女性 + 3 位普通离场女性**：

| 条目 | 在场人物投影增量（1人） | 打星离场投影增量（2人） | 顶层投影增量 | 每轮动态增量（满载） |
|---|---|---|---|---|
| **1. 身体开发永久留痕** | `physiology.bodyMarks`（~45 字） | 0 | 0 | **+55 tok** |
| **2. 深夜自慰实况** | `lastMasturbation`（原字段非空，~50 字）；`Revision` 不进投影 | 2 人 `arousal` + `lastMasturbation` | 深夜才有 `nightMasturbationCandidates`（~20 tok） | **+160 tok**（白天约 +15） |
| **3. 专属赠礼陈列架** | `giftsFromUser` 最多 6 条扁平字符串 | 2 人各最多 3 条品名 | 0 | **+115 tok**（无赠礼 = 0） |
| **4. 底线松动 & 攻略风向** | **纯前端/脚本派生，不进投影** | 0 | 0 | **+0 tok** |
| **5. 肉体成瘾反馈** | `intimacy.favoriteSensations`（~35 字）；`addictionLevel` 不存库 | 0 | 0 | **+40 tok** |
| **6. 攻略编年史** | `milestones` 最近 6 条扁平单行字符串 | 0（不喂离场） | 0 | **+155 tok** |
| **7. 主动未读私信** | 0（仅离场打星视图附带） | 2 人中通常 1 人有近条 | 0 | **+55 tok** |
| **动态投影小计** | — | — | — | **+580 tok**（开局前 5 轮约 **+50~120 tok**） |
| **常驻世界书增量** | `protocol.txt` + `state-context.txt` 新增约 430 汉字 | — | — | **+345 tok**（固定） |
| **整轮总增量** | — | — | — | **≈ +925 tokens**（占 40k 基准上下文的 **~2.3%**） |

---

## 七、DSH 施工顺序与现有单测影响预警

1. **建议施工顺序**：
   - 第一步：`src/runtime/schema.js` + `src/core/engine.js`（数据结构 + 派生函数 + 赠礼沉淀 + `projection`）
   - 第二步：`src/runtime/settlement.js`（锁表 + 退潮保基线 + 后庭/留痕/成瘾/编年史/自慰/私信兜底）
   - 第三步：`src/content/protocol.txt` + `src/content/state-context.txt`（严格逐字替换）
   - 第四步：`src/runtime/host.js` + `src/ui/screens.js` + `src/ui/app.js` + `src/ui/style.css`
   - 第五步：新增 `tests/rc46-male-archive.test.mjs` 覆盖 7 条核心断言，跑 `npm test` + `build --checkpoint` + `check --checkpoint`。
2. **现有单测影响预警（需 DSH 提前排查）**：
   - `tests/rc32-arousal.test.mjs` 或 `tests/rc33-review-guards.test.mjs` 中若有断言「事后退潮后 `vaginaState === ''`」的用例，需同步更新为断言「已实战角色回落到开发基线、未实战角色回落到初始常态」。
   - 因改动了 `protocol.txt` 与 `state-context.txt`，`worldbookHash` 会变化，正式发版前需同步递增 `cardContractRevision`（由 YG 决定合入版本时执行）。
