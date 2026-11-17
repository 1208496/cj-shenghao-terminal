# 《神豪终端》rc.27 升级方案：365px 窄屏女性信息高亮分层、真实下胸围罩杯算法 & 「悬浮小手机 ⇄ 固定正文底部」双模式（交付 DSH 执行版）

> **工作区**：`E:\SHZDCHOSSS`
> **基线版本**：`2.0.0-rc.26` ➔ 目标版本 **`2.0.0-rc.27`**（`cardContractRevision` 22 ➔ **23**）
>
> ### 🚨 【执行纪律：严格遵守 `HANDOFF.md` 三大永久铁律】
> 1. **脚本兜底律**：罩杯推算、句首核心词染色、隔衣未知小锁标、悬浮/正文底部挂载切换均由脚本确定性完成，不增加模型负担。
> 2. **示例驱动律**：不动 `protocol.txt` 的 JSONPatch 格式，100% 兼容现有世界书与模型输出。
> 3. **文案逐字照抄律**：凡涉及 `src/ui/setup-presets.json` 等文件的数据与文本修改，**DSH 必须 100% 照抄本方案代码块中的定稿，不准自行缩略**。

---

## 一、 本次 `rc.27` 三大核心升级总览

1. **【科学罩杯推算公式 + 6 位预设女主身材三围差异化】**
   - **修复原算法乌龙**：原 `inferCupSize(bust, waist)` 直接用 `上胸围 - 腰围` 计算罩杯，而正常女性下胸围（肋骨围）比腰围大 7～10cm，导致开局所有女性算出来清一色全是 D 罩杯。
   - **新公式（`inferCupSize(bust, waist, height = 165)`）**：
     先由腰围与身高推算真实下胸围 $\text{underbust} = \text{waist} + 6 + \max(0, (\text{height} - 160) \times 0.15)$，再按上胸围减下胸围的差值 $\Delta = \text{bust} - \text{underbust}$ 判定：
     - $\Delta < 11 \Rightarrow \text{A}$
     - $11 \le \Delta < 13.5 \Rightarrow \text{B}$
     - $13.5 \le \Delta < 16 \Rightarrow \text{C}$
     - $16 \le \Delta < 18.5 \Rightarrow \text{D}$
     - $18.5 \le \Delta < 21 \Rightarrow \text{E}$
     - $\Delta \ge 21 \Rightarrow \text{F}$
   - **拉开 6 位预设女主的真实身材光谱**：
     - **乔沐**（24岁·咖啡店主）：`163cm / 47kg`，三围 **`80 / 59 / 85`** ➔ **B 罩杯**（娇小元气少女）
     - **林叙宁**（27岁·视觉设计师）：`169cm / 52kg`，三围 **`83 / 61 / 89`** ➔ **B 罩杯**（清冷高挑禁欲系御姐）
     - **温迎**（25岁·花艺师）：`166cm / 50kg`，三围 **`84 / 60 / 88`** ➔ **C 罩杯**（温婉纤细）
     - **顾星遥**（30岁·科技创始人）：`167cm / 53kg`，三围 **`86 / 61 / 90`** ➔ **C 罩杯**（修身西装轻熟曲线）
     - **沈清弦**（26岁·财经编辑）：`170cm / 55kg`，三围 **`89 / 61 / 91`** ➔ **D 罩杯**（端庄知性外表下的反差丰满）
     - **江映**（28岁·健身教练）：`172cm / 60kg`，三围 **`92 / 62 / 95`** ➔ **E 罩杯**（极具视觉冲击的健美火辣身材）

2. **【专为 `365px` 小手机窄屏定制的女性信息视觉分层（胶囊标签 + 左键右值 + 重点提亮）】**
   - 彻底告别原先从头到尾全是 `.muted` 暗灰字、一眼看过去找不到重点的体检单样式，针对小手机扣掉边距后约 `300px` 的实际内容区及 `1.0 / 1.15 / 1.3` 三档字号缩放，采用 5 层窄屏视觉结构：
     1. **顶部紧凑状态胶囊横条（`.cj-chips`）**：
        - `【🌹 欲念 · 私密 / 肉体】` 顶部一行展示：`🌿 安全期`（或 `🔥 排卵期·易孕` 暖橙标）+ `💮 处女 · 未经人事`（或 `🌺 非处女` 樱粉标）+ `⛓️ L3 渐入佳境`（魅紫标）。
        - `【📋 身姿 · 基础】` 顶部展示：`30岁 · 科技公司联合创始人` + `✦ 颜值 81/100`（暖金标）+ `C 罩杯 · 86/61/90`（樱粉标）+ `称呼「你」`，紧接着一行 **3 格微型数字卡（`.mini-stats`）** 并排展示 `身高 167 CM | 体重 53 KG | 鞋码 37（欧码）`，性格标签渲染为独立的翠绿小胶囊。
     2. **左 4 字固定宽（`58px`）+ 右侧自适应正文虚线行（`.kv`）**：
        - 左栏统一精简为 4 字以内（如 `胸部详情`、`下体户型`、`紧致状态`、`阴毛类型`、`敏感带`、`体香特征`），设 `white-space: nowrap`，绝不在窄屏里自己断成两行。
     3. **句首核心词自动提亮染色（`leadHighlight`）**：
        - 对 `chestDetail`（如 `C罩杯丰盈圆润型，...`）、`vaginaLook`（如 `微绽蝴蝶唇 · ...`）、`vaginaState`（如 `处子般极度紧窄，...`）自动把第一个标点（`，；。·`）前的核心词包上 `<b class="hl-pink">` 或 `<b class="hl-plum">`，一眼抓住重点！
     4. **「未知」自动转精致小锁标**：
        - 在 `【👗 行头 · 穿戴 / 穿搭】` 中，若 `lingerie`（内衣）或 `socks`（丝袜）的值为 `"未知"` / `"尚未记录"` / `"不明"`，自动渲染为 `<span class="chip-tag chip-pink">🔒 隔衣未知</span>`。
     5. **「💭 心声」与「🎯 眼下心事」左竖条高亮卡 + 八大底线 2×4 变色小格**：
        - 心声（`.thought-card`）与眼下心事（`.goal-card`）改为带左侧 `3px` 主题色条与柔和底色的独立卡片；
        - 八大底线（`.limit-grid`）改为 2 列 × 4 行紧凑卡片格：`0·拒绝` 半透明弱化（`opacity: 0.52`），`1·犹豫` 普通标，`2·要条件` 暖金高亮标，`3·主动` 樱粉高亮标。

3. **【「⚙ 终端设置」新增 `悬浮小手机 ⇄ 固定正文底部` 双模式切换】**
   - 在「⚙ 终端设置」页面顶部新增一行 **「显示位置」**（`prefs.displayDock`：`'float'` 默认 | `'bottom'`）：
     - **`悬浮小手机`（`'float'`）**：与现行完全一致，挂在 `document.body` 上，`position: fixed`，支持自由拖拽与缩放，折叠时为屏幕右侧 `74×108` 的竖向小手机图标。
     - **`固定正文底部`（`'bottom'`）**：
       - `host.js` 自动查找酒馆聊天容器 `#chat` 中**最后一条消息的 `.mes_block`**（即 `#chat > .mes:last-child .mes_block`），将 `#cj-shenghao-phone-frame` 直接 `append` 到该 `.mes_block` 的最底部（紧随「本轮变量更新」折叠框之后；若聊天为空则临时退回 `document.body`）。
       - **折叠态（横条模式）**：在 `bottom` 模式下折叠时，`app.js` 渲染一条与正文等宽（`100%` 宽、高 `54px`）的精致圆角横条 `button#folded.folded-bar`，左侧显示 `✦ 神豪终端 · 日期时间 · 当前地点`，右侧显示 `可用现金 ¥xxx · 展开 ⌄`（有未读暴击通知时亮起圆点）。
       - **展开态（内嵌模式）**：点击横条后，在正文底部原地展开 `width: 365px; height: 680px` 的完整小手机界面（`position: relative; display: block; margin: 10px auto 4px; transform: none`），不遮挡任何小说正文，随聊天滚动条自然滚动；新消息生成或切换楼层时自动跟随迁移到最新一楼底部；在底部模式下自动禁用拖拽手柄。

---

## 二、 逐文件精确修改指南（DSH 请严格照此执行）

### 1. 修改 `project.json` 与 `package.json`

- 将 `project.json` 中的 `"version"` 改为 `"2.0.0-rc.27"`，`"cardContractRevision"` 改为 `23`，`"releaseNotes"` 更新为：
  ```json
  "releaseNotes": "rc.27：365px窄屏女角色信息视觉重构（状态胶囊横条/左键右值虚线行/句首核心词染色/隔衣未知锁标/底线四档变色格）、真实下胸围罩杯推算公式与六位预设女主身材差异化、终端设置新增「悬浮小手机⇄固定正文底部」双模式切换。",
  ```
- 将 `package.json`（及 `package-lock.json` 顶层）中的 `"version"` 同步改为 `"2.0.0-rc.27"`。

---

### 2. 修改 `src/core/engine.js`（真实下胸围罩杯公式）

将 `src/core/engine.js` 第 91–95 行的 `inferCupSize` 函数及第 108 行的调用修改为：

```js
// Estimate realistic underbust from waist and height, then map (bust - underbust)
// onto standard cup steps so normal waists do not inflate every woman to D cup.
export function inferCupSize(bust,waist,height=165){
  const b=Number(bust)||0,w=Number(waist)||0,h=Number(height)||165;
  if(!(b>0&&w>0&&b>w))return 'C';
  const underbust=w+6+Math.max(0,(h-160)*0.15);
  const diff=b-underbust;
  return diff>=21?'F':diff>=18.5?'E':diff>=16?'D':diff>=13.5?'C':diff>=11?'B':'A';
}
```
并将第 108 行 `seedAnatomy(c)` 中的调用改为传入 `c.heightCm`：
```js
  const cup = c.cupSize || (c.bustCm && c.waistCm ? inferCupSize(c.bustCm, c.waistCm, c.heightCm) : 'C');
  if (!c.cupSize) c.cupSize = cup;
```

---

### 3. 修改 `src/ui/setup-presets.json`（6 位预设女主身材三围与罩杯差异化定稿）

打开 `src/ui/setup-presets.json`，将 `contacts` 数组中 6 位预设女主的身高体重三围与 `"cupSize"` 更新如下（其余字段保持不变）：

1. **`florist_friend`（温迎 · 花艺工作室主理人 ➔ C 罩杯）**：
   `"heightCm": 166, "weightKg": 50, "bustCm": 84, "waistCm": 60, "hipCm": 88, "shoeSizeEu": 37, "cupSize": "C", "addressing": "你"`
2. **`design_colleague`（林叙宁 · 资深视觉设计师 ➔ B 罩杯）**：
   `"heightCm": 169, "weightKg": 52, "bustCm": 83, "waistCm": 61, "hipCm": 89, "shoeSizeEu": 38, "cupSize": "B", "addressing": "你"`
3. **`cafe_neighbor`（乔沐 · 独立咖啡馆店主 ➔ B 罩杯）**：
   `"heightCm": 163, "weightKg": 47, "bustCm": 80, "waistCm": 59, "hipCm": 85, "shoeSizeEu": 36, "cupSize": "B", "addressing": "哥"`
4. **`uni_alumni`（沈清弦 · 财经杂志编辑 ➔ D 罩杯）**：
   `"heightCm": 170, "weightKg": 55, "bustCm": 89, "waistCm": 61, "hipCm": 91, "shoeSizeEu": 38, "cupSize": "D", "addressing": "学弟"`
5. **`gym_coach`（江映 · 私人健身教练 ➔ E 罩杯）**：
   `"heightCm": 172, "weightKg": 60, "bustCm": 92, "waistCm": 62, "hipCm": 95, "shoeSizeEu": 39, "cupSize": "E", "addressing": "老板"`
6. **`startup_partner`（顾星遥 · 科技公司联合创始人 ➔ C 罩杯）**：
   `"heightCm": 167, "weightKg": 53, "bustCm": 86, "waistCm": 61, "hipCm": 90, "shoeSizeEu": 37, "cupSize": "C", "addressing": "你"`

---

### 4. 修改 `src/ui/screens.js`（窄屏视觉分层 + 设置页新增「显示位置」切换）

> **重要兼容要求**：所有原有的测试断言文本（如 `年龄：30岁`、`颜值：81/100`、`三围：85／63／90 CM（C 罩杯）`、`🎯 眼下心事：`、`💭 心声：<i>...</i>`、`生理周期：`、`处子状态：处女`、`阴部户型与色泽：`、`敏感带详情：`、`穿搭风格：`、`上装：`、`袜子／丝袜：`、`鞋履：`、`性观念：`、`与你亲密次数：`、`最近一次性行为：`、`当前开放档位：L`、`手口侍奉：`、`多人同欢：` 等）**必须 100% 保留在渲染出的 HTML 文本中**（通过将冒号包含在 `.kv-k` 标签内或隐藏辅助文本实现），确保全套现有单元测试零破坏通过！

请将 `src/ui/screens.js` 中的 `basicRows`、`statusPanel`、`outfitPanel`、`virginText`、`fleshPanel`、`secretPanel`、`experiencePanel`、`scene`、`detail`、`settings` 更新为以下实现：

```js
  const pill=(text,tone='')=>`<span class="chip-tag${tone?' chip-'+tone:''}">${text}</span>`;
  // Highlight the leading phrase before the first separator so key traits pop on a 365px screen.
  const lead=(value,tone='hl-pink')=>{
    const s=String(value??'').trim();if(!s)return '';
    const m=s.match(/^([^，,；;。·]{2,18})([，,；;。·][\s\S]*)$/);
    return m?`<b class="${tone}">${esc(m[1])}</b>${esc(m[2])}`:esc(s);
  };
  const kv=(label,html)=>html?`<div class="kv"><span class="kv-k">${label}：</span><span class="kv-v">${html}</span></div>`:'';
  const line=(label,value,tone='')=>{
    const s=typeof value==='string'?value.trim():'';if(!s)return '';
    if(/^(未知|不明|尚未记录|未记录)$/.test(s))return kv(label,pill('🔒 隔衣未知','pink'));
    return kv(label,tone?lead(s,tone):esc(s));
  };
  const counted=(label,value)=>Number(value)>0?kv(label,`<b>${esc(value)}</b>`):'';
  const goalBox=goal=>typeof goal==='string'&&goal.trim()?`<div class="muted goal goal-card">🎯 眼下心事：${esc(goal)}</div>`:'';
  const thoughtBox=thought=>typeof thought==='string'&&thought.trim()?`<div class="muted thought thought-card">💭 心声：<i>${esc(thought)}</i></div>`:'';
  const basicRows=c=>{
    const bwh=[c.bustCm,c.waistCm,c.hipCm].some(v=>v==null)?'尚未记录':[c.bustCm,c.waistCm,c.hipCm].map(esc).join('／')+' CM'+(c.cupSize?'（'+esc(c.cupSize)+' 罩杯）':'');
    const tags=(c.personalityTags||[]).filter(Boolean);
    return `<div class="chips">${pill(`年龄：${c.age}岁`)}${pill(`颜值：${c.beautyScore==null?'尚未记录':c.beautyScore+'/100'}`,'amber')}${c.cupSize?pill(`${esc(c.cupSize)} 罩杯`,'pink'):''}${c.addressing?pill(`称呼你：${esc(c.addressing)}`):''}</div>`
      +`<div class="mini-stats"><div class="mini-stat"><small>身高</small><b>身高：${unit(c.heightCm,' CM')}</b></div><div class="mini-stat"><small>体重</small><b>体重：${unit(c.weightKg,' KG')}</b></div><div class="mini-stat"><small>鞋码</small><b>鞋码：${unit(c.shoeSizeEu,'（欧码）')}</b></div></div>`
      +kv('职业',`<b>${esc(c.occupation||'尚未记录')}</b>`)
      +kv('三围',`<b class="hl-pink">${bwh}</b>`)
      +kv('性格标签',tags.length?tags.map(t=>pill(esc(t),'green')).join(' ')+' <span class="sr-only">'+tags.map(esc).join(' · ')+'</span>':'尚未记录')
      +kv('外貌',esc(c.appearance||'尚未记录'))
      +kv('身材',esc(c.body||'尚未记录'))
      +(c.impression?kv('对你的印象',esc(c.impression)):'')
      +goalBox(c.currentGoal);
  };
```

以及四个私密面板函数：

```js
  const statusPanel=c=>{
    const chips=[c.currentMood?pill('✨ 心情：'+esc(c.currentMood),'amber'):'',c.currentExpression?pill('神情：'+esc(c.currentExpression)):''].filter(Boolean).join('');
    return (chips?`<div class="chips">${chips}</div>`:'')
      +[['姿态','currentPose'],['动作','currentAction'],['神情','currentExpression'],['心情','currentMood'],['身体状态','currentCondition'],['随身物品','currentItems']].filter(([,key])=>typeof c[key]==='string'&&c[key].trim()).map(([label,key])=>kv(label,key==='currentAction'?`<b>${esc(c[key])}</b>`:esc(c[key]))).join('')
      +goalBox(c.currentGoal);
  };
  const outfitPanel=c=>{
    const o=c.outfit||{},top=o.top&&o.top!==c.currentClothes?o.top:'';
    const chips=[o.style?pill('👗 '+esc(o.style),'amber'):'',o.complexion?pill('✨ '+esc(o.complexion),'pink'):''].filter(Boolean).join('');
    return (chips?`<div class="chips">${chips}</div>`:'')
      +[line('此刻穿着',c.currentClothes,'hl-strong'),line('穿搭风格',o.style),line('面部气色',o.complexion),line('上装',top,'hl-strong'),line('下装',o.bottom,'hl-strong'),line('内衣内裤',o.lingerie),line('袜子／丝袜',o.socks),line('鞋履',o.shoes),line('妆造',o.makeup),line('随身配饰',o.accessories)].filter(Boolean).join('');
  };
  const cycleTone=cycle=>/排卵|易孕/.test(cycle)?'amber':/月经|经期/.test(cycle)?'pink':'green';
  const virginText=p=>kv('处子状态',`<span class="chip-tag ${p.virgin===false?'chip-plum':'chip-pink'}">${p.virgin===false?'非处女':'处女'}</span> <span class="muted">（${esc(p.hymenNote||'尚未记录')}）</span>`);
  const fleshPanel=c=>{
    const p=c.physiology||{};
    const chips=[p.cycle?pill('🌿 '+esc(p.cycle),cycleTone(p.cycle)):'',pill(p.virgin===false?'🌺 非处女':'💮 处女',p.virgin===false?'plum':'pink'),pill(`🌡️ 情动度：${axis(c.arousal??0)}/100`,axis(c.arousal??0)>=50?'pink':'')].filter(Boolean).join('');
    return `<div class="chips">${chips}</div>`
      +[line('生理周期',p.cycle),line('孕期',p.pregnancy),virginText(p),line('胸部详情',p.chestDetail,'hl-pink'),line('阴部户型与色泽',p.vaginaLook,'hl-pink'),line('阴部紧致与状态',p.vaginaState,'hl-plum'),line('阴毛类型',p.pubicHair),kv('后庭外观与状态',`${esc(p.anusLook||'尚未记录')} · ${esc(p.anusState||'尚未记录')}`),kv('体香与特征',`${esc(p.bodyScent||'尚未记录')}${p.tattooScar?' · 纹身／疤痕：'+esc(p.tattooScar):''}`),line('敏感带详情',p.traits,'hl-strong')].filter(Boolean).join('');
  };
  const secretPanel=c=>{
    const p=c.physiology||{},l=c.limits||{};
    const chips=[p.cycle?pill('🌿 '+esc(p.cycle),cycleTone(p.cycle)):'',pill(p.virgin===false?'🌺 非处女':'💮 处女',p.virgin===false?'plum':'pink'),pill('⛓️ '+esc(scaleText(l.scaleLevel)),'plum')].filter(Boolean).join('');
    return `<div class="chips">${chips}</div>`
      +[line('生理周期',p.cycle),virginText(p),line('胸部详情',p.chestDetail,'hl-pink'),line('阴部户型与色泽',p.vaginaLook,'hl-pink'),line('阴部紧致与状态',p.vaginaState,'hl-plum'),line('阴毛类型',p.pubicHair),line('敏感带与体香',[p.traits,p.bodyScent].filter(x=>typeof x==='string'&&x.trim()).join(' · '),'hl-strong'),kv('当前开放档位',`<b class="hl-plum">${esc(scaleText(l.scaleLevel))}</b>`),tagCloud(c)].filter(Boolean).join('');
  };
  const limitCell=(label,val)=>{
    const n=Math.max(0,Math.min(3,Number(val)||0)),tone=n===3?'chip-pink':n===2?'chip-amber':n===1?'':'';
    return `<div class="limit-cell${n===0?' locked':''}"><span>${label}</span><span class="limit-badge ${tone}">${n} · ${limitText(n)}</span></div>`;
  };
  const experiencePanel=c=>{
    const i=c.intimacy||{},l=c.limits||{};
    const chips=[pill('⛓️ '+esc(scaleText(l.scaleLevel)),'plum'),i.firstTime?pill(esc(i.firstTime),'pink'):''].filter(Boolean).join('');
    return `<div class="chips">${chips}</div>`
      +[line('性观念',i.attitude,'hl-strong'),line('对你的评价',i.abilityComment,'hl-pink'),counted('交往人数',i.partnersCount),counted('性经验人数',i.sexPartnerCount),line('初体验',i.firstTime),line('过往经历',i.experience),line('性癖与弱点',i.fetishes,'hl-plum'),counted('与你亲密次数',i.withUserCount),line('最近一次性行为',i.lastIntimate),line('最近自慰',i.lastMasturbation),tagCloud(c),'<div class="limit-sep"></div>',line('软肋',l.weakness,'hl-strong'),line('最怕顾虑',l.worry),kv('当前开放档位',`<b class="hl-plum">${esc(scaleText(l.scaleLevel))}</b>`),'<div class="limit-grid">'+[['露点展示','exposure'],['手口侍奉','foreplay'],['实战插入','intercourse'],['丝袜制服','cosplay'],['无套内射','creampie'],['后庭开发','anal'],['半公开偷欢','publicPlay'],['多人同欢','multi']].map(([label,key])=>limitCell(label,l[key])).join('')+'</div>'].filter(Boolean).join('');
  };
```

同时：
- 在 `scene()` 和 `detail(c)` 中，把原先内联拼接的 `${c.currentThought?'<div class="muted thought">...</div>':''}` 统一替换为 `${thoughtBox(c.currentThought)}`，把 `detail(c)` 里的 `${c.currentGoal?'<div class="muted goal">...</div>':''}` 替换为 `${goalBox(c.currentGoal)}`。
- 在 `settings()`（第 57 行）中，在「手机尺寸」上方新增 **「显示位置」** 设置项：
  ```js
  <div class="settingrow"><div><b>显示位置</b><div class="muted">悬浮在屏幕一侧，或嵌在最新正文底部</div></div><div class="choice-row"><button class="chip ${view.prefs.displayDock!=='bottom'?'on':''}" data-display-dock="float" aria-pressed="${view.prefs.displayDock!=='bottom'}">悬浮小手机</button><button class="chip ${view.prefs.displayDock==='bottom'?'on':''}" data-display-dock="bottom" aria-pressed="${view.prefs.displayDock==='bottom'}">固定正文底部</button></div></div>
  ```

---

### 5. 修改 `src/runtime/host.js` 与 `src/ui/app.js`（支持「悬浮小手机 ⇄ 固定正文底部」动态挂载）

#### (1) `src/runtime/host.js`：
1. 在 `host.js` 中新增一个挂载点同步函数 `syncDockMount()`，负责根据 `prefs.displayDock` 把 `phone` iframe 挂到 `win.document.body`（悬浮模式）或 `#chat > .mes:last-child .mes_block`（固定正文底部模式）：
   ```js
   function lastMesBlock(){
     const chat=win.document.getElementById('chat');if(!chat)return null;
     const list=chat.querySelectorAll(':scope > .mes');
     for(let i=list.length-1;i>=0;i--){const b=list[i].querySelector('.mes_block');if(b)return b;}
     return null;
   }
   function syncDockMount(){
     if(!phone||disposed)return 'float';
     if(prefs.displayDock==='bottom'){
       const target=lastMesBlock();
       if(target){
         if(phone.parentElement!==target||target.lastElementChild!==phone)target.append(phone);
         return 'bottom';
       }
     }
     if(phone.parentElement!==win.document.body)win.document.body.append(phone);
     return 'float';
   }
   ```
2. 修改 `api.geometry`（约第 174 行）：
   当处于 `bottom` 模式且已挂载到消息内时，使用 `position: relative` 流式居中布局（折叠态为 `100%` 宽 × `56px` 高横条，展开态为 `min(100%, 365px)` 宽 × `680px` 高面板）；当处于 `float` 模式时保持原有的 `position: fixed` 与缩放逻辑：
   ```js
   api.geometry=({width=layout.width,height=layout.height,scale=1,left,top})=>{
     const mode=syncDockMount();
     if(mode==='bottom'){
       const isBar=height<=120;
       layout={width:isBar?365:width,height,scale:1};renderScale=1;lastZoom=1;
       const radius=isBar?'16px':'34px';
       Object.assign(phone.style,{
         position:'relative',left:'auto',top:'auto',
         width:isBar?'100%':'min(100%, '+width+'px)',
         height:(isBar?56:Math.min(height,680))+'px',
         margin:isBar?'10px 0 4px':'12px auto 6px',
         transform:'none',borderRadius:radius,clipPath:'inset(0 round '+radius+')',
         zIndex:'10'
       });
       return;
     }
     const {ratio,left:x,top:y,zoom}=phoneGeometry({width,height,scale,left,top},{innerWidth:win.innerWidth,innerHeight:win.innerHeight,devicePixelRatio:win.devicePixelRatio,referenceDpr,pinchScale:win.visualViewport?.scale});
     layout={width,height,scale};renderScale=ratio;lastZoom=zoom;
     const radius=width>100?'40px':'18px';
     Object.assign(phone.style,{position:'fixed',margin:'0',zIndex:'3000',width:width+'px',height:height+'px',transform:'scale('+ratio+')',left:x+'px',top:y+'px',borderRadius:radius,clipPath:'inset(0 round '+radius+')'});
   };
   ```
3. 在 `publish()` 中（第 32 行）：调用 `syncDockMount()`，这样每当新楼层渲染（`CHARACTER_MESSAGE_RENDERED` / `USER_MESSAGE_RENDERED`）或切换 `prefs.displayDock` 时，若处于 `bottom` 模式，小手机会自动平滑迁移到最新一楼的正文底部！

#### (2) `src/ui/app.js`：
1. **折叠态自适应（第 77 行 `phone()` 内）**：
   - 当 `view.prefs.displayDock === 'bottom'` 时，折叠按钮 `#folded` 渲染为**正文底部横条样式（`.folded.folded-bar.show`）**，显示当前时间、地点与可用现金，且不绑定拖拽：
     ```js
     if(folded){
       const isBottom=view.prefs.displayDock==='bottom',s=view.state;
       if(isBottom){
         $('app').innerHTML=`<button class="folded folded-bar show" id="folded" aria-label="打开神豪终端"><span class="folded-bar-left"><b>✦ 神豪终端</b><small>${esc(s.world.date)} ${esc(s.world.time)} · ${esc(s.scene.location)}</small></span><span class="folded-bar-right"><b>${yuan( s.user.cashCents )}</b><small>点击展开 ⌄</small>${pendingNotices().length?'<span class="dot" style="display:block"></span>':''}</span></button>`;
         api.geometry?.({width:365,height:56});
         return;
       }
       $('app').innerHTML=`<button class="folded show" id="folded" aria-label="打开神豪终端"><span class="cam"></span><b>✦</b><small>神豪终端</small>${pendingNotices().length?'<span class="dot" style="display:block"></span>':''}</button>`;
       api.geometry?.({width:74,height:108,...view.prefs.miniPosition});
       bindDrag($('folded'),true);
       return;
     }
     ```
   - 当展开时（第 83 行）：仅在 `view.prefs.displayDock !== 'bottom'` 时调用 `bindDrag($('phoneHandle'), false)`（底部固定模式无需拖拽）。
2. **点击事件处理（`actions` 函数内）**：
   - 第 99 行 `if(b.id==='folded')`：当 `view.prefs.displayDock === 'bottom'` 时，直接 `folded=false; phone(); return;`，不覆盖悬浮坐标 `phonePosition`。
   - 第 148 行 `case 'fold'`：当 `view.prefs.displayDock === 'bottom'` 时，直接 `folded=true; closeModal(); phone(); break;`，不覆盖 `miniPosition`。
   - 新增 `if(d.displayDock)` 分支（放在 `if(d.phoneSize)` 旁）：
     ```js
     if(d.displayDock){api.preferences({displayDock:d.displayDock});phone();notify(d.displayDock==='bottom'?'已固定到最新消息正文底部':'已切换为悬浮小手机');}
     ```
3. **签名监听（第 169 行 `receive(v)` 内）**：
   在 `signature` 数组中加入 `v.prefs.displayDock`，确保切换显示位置时立即触发重绘。

---

### 6. 修改 `src/ui/style.css`（窄屏胶囊、左键右值、高亮色与正文底部横条样式）

在 `src/ui/style.css` 末尾追加以下 CSS（自动适配 `sage` / `gold` / `purple` 三套主题与 `--cj-font-scale` 字号缩放）：

```css
/* rc.27：三套主题的扩展语义色（樱粉/魅紫/翠绿/暖金） */
:root{
  --ui-plum-bg:#f4eef8;--ui-plum:#734085;--ui-plum-border:#dcc7e3;
  --ui-green-bg:#e8f3e7;--ui-green:#3b6e4c;--ui-green-border:#c5dcc8;
  --ui-amber-bg:#fdf3df;--ui-amber:#965a1e;--ui-amber-border:#ebd1a7;
}
.theme-gold{
  --ui-plum-bg:#f6edf8;--ui-plum:#7b3b8c;--ui-plum-border:#dfc5e6;
  --ui-green-bg:#eaf5ec;--ui-green:#387049;--ui-green-border:#c3dec8;
  --ui-amber-bg:#fff4df;--ui-amber:#9c5718;--ui-amber-border:#ebd0a0;
}
.theme-purple{
  --ui-plum-bg:#412954;--ui-plum:#e4b8ff;--ui-plum-border:#6d488a;
  --ui-green-bg:#243d35;--ui-green:#9fe3b8;--ui-green-border:#3d695a;
  --ui-amber-bg:#473522;--ui-amber:#ffd596;--ui-amber-border:#785937;
}

/* rc.27：365px 窄屏女性信息分层样式 */
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0 8px}
.chip-tag{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;font-size:calc(10px * var(--cj-font-scale,1));font-weight:700;border:1px solid var(--ui-line);background:var(--ui-soft);color:var(--ui-strong);line-height:1.4}
.chip-pink{background:var(--ui-pink-bg);color:var(--ui-pink);border-color:var(--ui-pink-border)}
.chip-plum{background:var(--ui-plum-bg);color:var(--ui-plum);border-color:var(--ui-plum-border)}
.chip-green{background:var(--ui-green-bg);color:var(--ui-green);border-color:var(--ui-green-border)}
.chip-amber{background:var(--ui-amber-bg);color:var(--ui-amber);border-color:var(--ui-amber-border)}

.mini-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:6px 0 8px}
.mini-stat{background:var(--ui-card2);border:1px solid var(--ui-line);border-radius:10px;padding:5px 6px;text-align:center}
.mini-stat small{display:block;font-size:calc(9.5px * var(--cj-font-scale,1));color:var(--ui-sub);line-height:1.2}
.mini-stat b{font-size:calc(11px * var(--cj-font-scale,1));color:var(--ui-ink)}

.kv{display:grid;grid-template-columns:64px minmax(0,1fr);gap:7px;padding:5.5px 0;border-bottom:1px dashed var(--ui-line);align-items:baseline;font-size:calc(11px * var(--cj-font-scale,1));line-height:1.6}
.kv:last-child{border-bottom:0;padding-bottom:0}
.kv-k{color:var(--ui-sub);font-size:calc(10.5px * var(--cj-font-scale,1));font-weight:600;white-space:nowrap}
.kv-v{color:var(--ui-ink);min-width:0;overflow-wrap:anywhere}
.kv-v b{color:var(--ui-strong);font-weight:700}
.kv-v b.hl-pink{color:var(--ui-pink)}
.kv-v b.hl-plum{color:var(--ui-plum)}
.kv-v b.hl-strong{color:var(--ui-strong)}

.thought-card{border-left:3px solid var(--ui-pink);background:var(--ui-pink-bg);border-radius:9px;padding:7px 9px;margin:6px 0;color:var(--ui-ink)!important}
.goal-card{border-left:3px solid var(--ui-accent);background:var(--ui-soft);border-radius:9px;padding:7px 9px;margin-top:7px;color:var(--ui-ink)!important;font-weight:600}

.limit-cell{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:4.5px 7px;border-radius:8px;border:1px solid var(--ui-line);background:var(--ui-card2);font-size:calc(10.5px * var(--cj-font-scale,1));white-space:nowrap}
.limit-cell.locked{opacity:.52;background:transparent}
.limit-badge{font-size:calc(9.5px * var(--cj-font-scale,1));font-weight:700;padding:1px 6px;border-radius:6px;color:var(--ui-sub)}

/* rc.27：固定正文底部模式的折叠态横条 */
.folded.folded-bar{width:calc(100% - 4px)!important;height:48px!important;margin:2px!important;padding:0 14px!important;border-radius:14px!important;border-width:2px!important;flex-direction:row!important;justify-content:space-between!important;align-items:center!important;cursor:pointer!important}
.folded-bar-left,.folded-bar-right{display:flex;align-items:center;gap:8px;min-width:0}
.folded-bar-left b{font-size:calc(13px * var(--cj-font-scale,1));white-space:nowrap}
.folded-bar-left small{font-size:calc(10.5px * var(--cj-font-scale,1));opacity:.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.folded-bar-right{flex-shrink:0;position:relative}
.folded-bar-right b{font-size:calc(12.5px * var(--cj-font-scale,1))}
.folded-bar-right small{font-size:calc(10px * var(--cj-font-scale,1));opacity:.85}
```

---

## 三、 单元测试新增与验证要求（`tests/`）

1. 在 `tests/rc25-body-economy.test.mjs` 末尾新增 **`rc.27` 专项测试**：
   - **测试新罩杯推算公式 `inferCupSize`**：验证 6 位预设熟人（乔沐 B、林叙宁 B、温迎 C、顾星遥 C、沈清弦 D、江映 E）按各自三围身高推算的罩杯与预设 `cupSize` 完全一致，不再全员 D 罩杯。
   - **测试窄屏视觉分层 HTML**：验证 `screens.scene()` 与 `screens.detail()` 渲染出 `.chips`、`.kv`、`.hl-pink`、`.limit-cell`、`.thought-card`、`.goal-card`，且当 `outfit.lingerie = '未知'` 时自动渲染出 `🔒 隔衣未知` 胶囊。
   - **测试设置页「显示位置」开关**：验证 `screens.settings()` 包含 `data-display-dock="float"`（悬浮小手机）与 `data-display-dock="bottom"`（固定正文底部）两个切换按钮。
2. 运行全量测试与构建检查：
   ```powershell
   npm test
   npm run build
   npm run check
   ```
   确认全部 PASS，随后在 8001 测试酒馆用 ego 实机验证「悬浮小手机 ⇄ 固定正文底部」切换及新面板视觉效果并截图留存。
