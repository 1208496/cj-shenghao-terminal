# 《神豪终端》rc.28 升级方案：宽屏内嵌底部面板模式、反差巨乳三层罩杯算法 & 开局表单完善（性器下拉预设 + 已有资产可编辑）（交付 DSH 执行版）

> **工作区**：`E:\SHZDCHOSSS`
> **基线版本**：`2.0.0-rc.27` ➔ 目标版本 **`2.0.0-rc.28`**（`cardContractRevision` 23 ➔ **24**）
>
> ### 🚨 【执行纪律：严格遵守 `HANDOFF.md` 三大永久铁律】
> 1. **脚本兜底律**：三层罩杯推算、宽屏底部内嵌自适应高度、开局表单下拉选项与资产编辑全部由脚本确定性完成。
> 2. **示例驱动律**：不动 `protocol.txt` 的 JSONPatch 格式，100% 兼容现有世界书与全部单元测试。
> 3. **文案逐字照抄律**：凡涉及 `src/ui/setup-presets.json` 等文件的数据与预设文案，**DSH 必须 100% 照抄本方案代码块中的定稿，不准自行缩略**。

---

## 一、 本次 `rc.28` 四大核心任务总览

### 1. 「固定正文底部」彻底升级为 **100% 满宽 · 去手机壳 · 顶栏一体化宽屏面板**
- **解决 `rc.27` 痛点**：`rc.27` 切到「固定正文底部」时，只是把 `365px` 宽、带黑色刘海和粗边框的竖屏小手机塞进了消息底部，导致两边全是大片黑边空隙，而且内部还要在 `680px` 高的小框里二次滚动。
- **`rc.28` 宽屏内嵌变形（参考 `.panel.is-inline` 设计思想，100% 原创样式）**：
  1. **脱掉手机外壳与刘海**：当 `view.prefs.displayDock === 'bottom'` 时，外层容器 `<div class="phone is-bottom-dock" id="phone">` 宽度设为 **`100%`**（与头顶的「▶ 本轮变量更新」折叠条完全等宽对齐！），隐藏手机刘海听筒（`.phone.is-bottom-dock::before { display: none }`），去掉 `7px` 粗边框与 `40px` 大圆角，改为 **`1px solid var(--ui-line)` + `16px` 圆角** 的宽屏内嵌面板。
  2. **一体化宽屏顶栏（导航栏上移）**：在宽屏底部模式下，将原本在底部的三个导航按钮（`⌂ 此刻 / ♡ 她们 / ▣ 我的`）直接放进顶栏中央（或隐藏底部 `.bottom` 导航栏，在 `.phone-hd` 中展示胶囊式切换条），右侧放 `⚙`（设置）与 `−`（收起），禁用拖拽光标。
  3. **内部网格自动舒展为宽屏多列**：
     - 宽屏模式下，2×2 的 `.dossier-grid`（四方块按钮）在宽度充足时（`min-width: 520px`）自动排成 **1×4 四列一字排开**；
     - 「她们」列表、「持有资产」列表在宽屏模式下自动变为 **左右双列网格（`grid-template-columns: repeat(2, minmax(0, 1fr))`）**；
     - 「此刻」页面展开人物时，状态行与四方块区域自然舒展，不再局促。
  4. **高度随内容自适应（告别套娃滚动条）**：
     - 在 `host.js` 的 `api.geometry` 中，当处于 `bottom` 展开态时，读取 `phone.contentDocument?.documentElement?.scrollHeight`（或由 `app.js` 在 `phone()` 渲染完后传入实际内容高度 `docHeight`），将 `#cj-shenghao-phone-frame` 的高度设为 `Math.max(320, Math.min(docHeight + 4, 1400)) + 'px'`，并在 `app.js` 中监听面板内点击/展开变化后同步调用 `api.geometry` 刷新高度，让底部面板像原生楼层卡片一样随内容自然伸缩！

### 2. 支持「童颜巨乳 / 娇小反差」的三层罩杯算法（`inferCupSize` 升级）
- **解决痛点**：纯靠固定身高腰围公式，会抹杀二次元/爽文中经典的「152cm 娇小萝莉体型却拥有 E/F 杯巨乳」或「模型在文字里写了巨乳但没填 `cupSize` 字段」的反差人物。
- **三层优先级算法**：
  1. **第一层（文字描述与显式字段优先）**：
     - 若 `c.cupSize` 已明确填写（如 `'E'`），直接采用；
     - 若未填 `cupSize`，先扫描 `c.body` 与 `c.appearance`：
       - 若正则匹配到明确罩杯字样 `/([A-G])\s*(?:罩杯|杯)/i`，直接提取该字母；
       - 若匹配到大胸反差词 `/巨乳|爆乳|波涛汹涌|傲人双峰|呼之欲出|极度丰满|豪乳|酥胸硕大/`，直接按人物 ID 哈希保底给 **`'E'` 或 `'F'`**（哪怕她身高只有 150cm）！
       - 若匹配到平胸词 `/平胸|贫乳|飞机场|青涩微隆|一马平川/`，直接给 **`'A'`**。
  2. **第二层（双向身高骨架修正公式——娇小细腰天然加成罩杯）**：
     - 将下胸围估算公式中的 `Math.max(0, (h - 160) * 0.15)` 改为**双向浮动** `(h - 160) * 0.22`（不截断负数！）：
       $$\text{underbust} = w + 8.5 + (h - 160) \times 0.22$$
     - 效果：160cm 以上的 6 位预设熟人算出来依然 **100% 是 B / B / C / C / D / E**；而一个 **150cm、腰围 55cm、胸围 83cm** 的娇小妹子，因为骨架纤细（$\text{underbust} = 55 + 8.5 - 2.2 = 61.3\text{cm}$，$\Delta = 83 - 61.3 = 21.7\text{cm} \ge 21$），算出来直接就是 **F 罩杯（童颜巨乳）**！
  3. **第三层（无三围野生人物哈希分布）**：
     - 当野生人物连 `bustCm / waistCm` 都没填时，不再死板返回 `'C'`，而是按人物 `id/name` 哈希在 `['B', 'C', 'C', 'D', 'D', 'E', 'F']` 中确定性抽取，让野生人物也有概率刷出 E/F 杯反差尤物！

### 3. 开局表单补齐「性器长度 / 粗度 / 特征」下拉预设选项
- **解决痛点**：开局向导第 1 步（塑造身份）里，「性器长度（`_gen_length`）」「性器粗度（`_gen_girth`）」「性器特征（`_gen_traits`）」三个输入框点击时没有弹出下拉预设菜单。
- **修复**：在 `src/ui/setup-options.js` 的 `numericAndDate` 中补上 `_gen_length` 与 `_gen_girth` 的常用尺寸选项，并在 `src/ui/setup-presets.json` 的 `fields` 中补上 6 条极具神豪爽文张力的 `_gen_traits` 预设描述！点击输入框即可一键点选，选完也可自由修改。

### 4. 开局表单「已有资产」支持点击「编辑」（与初始熟人体验完全对齐）
- **解决痛点**：开局向导第 2 步（设定起点）里的「已有资产」列表，无论是点开局预设带出来的资产，还是玩家自己添加的资产，只有「移除」按钮，没有「编辑」按钮，想改个名字、估值或描述只能删了重填。
- **修复**：
  - 在 `app.js` 新增 `editingAssetId = null` 状态变量；
  - 在第 2 步资产列表每项右侧加上 `<div class="choice-row"><button class="mini-btn" data-edit-asset="${esc(a.assetId)}">编辑</button><button class="mini-btn" data-remove-asset="${esc(a.assetId)}">移除</button></div>`；
  - 改造 `assetForm(assetId = null)`：当传入 `assetId` 时，弹窗标题变为 `编辑已有资产`，自动回填该资产的类别（`a_kind`）、名称（`a_name`）、估值元（`a_value`）、存放地点（`a_note`）、简易描述（`a_description`）、产权说明（`a_owner`），保存时原位替换该资产并保留原 `assetId`！

---

## 二、 逐文件精确修改指南（DSH 请严格照此执行）

### 1. 修改 `project.json` 与 `package.json`

- 将 `project.json` 中的 `"version"` 改为 `"2.0.0-rc.28"`，`"cardContractRevision"` 改为 `24`，`"releaseNotes"` 更新为：
  ```json
  "releaseNotes": "rc.28：固定正文底部升级为100%满宽去手机壳宽屏内嵌面板（顶栏一体化导航+双列网格+自适应高度）、支持娇小巨乳反差的三层罩杯推算算法、开局表单补齐性器尺寸与特征下拉预设、已有资产支持二次编辑。",
  ```
- 将 `package.json`（及 `package-lock.json` 顶层）中的 `"version"` 同步改为 `"2.0.0-rc.28"`。

---

### 2. 修改 `src/core/engine.js`（三层反差罩杯算法 `inferCupSize` + `seedAnatomy`）

将 `src/core/engine.js` 第 91–115 行的 `inferCupSize` 与 `seedAnatomy` 开头部分替换为：

```js
// rc.28：三层罩杯推算——①文字关键词（巨乳/贫乳/X罩杯）优先；②双向身高骨架修正
// （150cm 娇小细腰天然加成大罩杯，160cm+ 预设熟人保持 B/B/C/C/D/E）；③无三围时按哈希分布。
export function inferCupSize(bust,waist,height=165,textHint='',seedHash=0){
  const hint=String(textHint||'');
  const explicit=hint.match(/([A-G])\s*(?:罩杯|杯)/i);
  if(explicit)return explicit[1].toUpperCase();
  if(/巨乳|爆乳|波涛汹涌|傲人双峰|呼之欲出|极度丰满|豪乳|酥胸硕大|童颜巨乳/.test(hint))return (Number(seedHash)||0)%2===0?'E':'F';
  if(/平胸|贫乳|飞机场|青涩微隆|一马平川/.test(hint))return 'A';
  const b=Number(bust)||0,w=Number(waist)||0,h=Number(height)||165;
  if(!(b>0&&w>0&&b>w)){
    const pool=['B','C','C','D','D','E','F'];
    return pool[(Number(seedHash)||0)%pool.length];
  }
  const underbust=w+8.5+(h-160)*0.22;
  const diff=b-underbust;
  return diff>=21?'F':diff>=18.5?'E':diff>=16?'D':diff>=13.5?'C':diff>=11?'B':'A';
}
// rc.25 铁律 1：女性私密肉体档案由脚本确定性播种，绝不留给模型从空白开始填。
// Every field is filled only when blank, so plot-driven rewrites always win.
export function seedAnatomy(c) {
  if (!c || typeof c !== 'object') return c;
  c.physiology = c.physiology && typeof c.physiology === 'object' ? c.physiology : {};
  c.intimacy = c.intimacy && typeof c.intimacy === 'object' ? c.intimacy : {};
  c.limits = c.limits && typeof c.limits === 'object' ? c.limits : {};
  const h = Number('0x' + fnv(String(c.id || c.name || 'char')).slice(0, 8));
  const pick = arr => arr[h % arr.length];
  const pick2 = (arr, shift) => arr[Math.floor(h / shift) % arr.length];
  const isVirgin = c.physiology.virgin !== false && (c.intimacy.withUserCount || 0) === 0 && (c.intimacy.sexPartnerCount || 0) === 0;
  if (c.physiology.virgin === null || c.physiology.virgin === undefined) c.physiology.virgin = isVirgin;
  const hint = `${c.body || ''} ${c.appearance || ''}`;
  const cup = c.cupSize || inferCupSize(c.bustCm, c.waistCm, c.heightCm, hint, h);
  if (!c.cupSize) c.cupSize = cup;
```

> **验算确认**：6 位预设熟人（乔沐 80/59/163、林叙宁 83/61/169、温迎 84/60/166、顾星遥 86/61/167、沈清弦 89/61/170、江映 92/62/172）代入 `w + 8.5 + (h - 160) * 0.22`，算出的 $\Delta$ 分别为 `11.84 (B)`、`11.52 (B)`、`14.18 (C)`、`14.96 (C)`、`17.30 (D)`、`18.86 (E)`，与预设的 **`B / B / C / C / D / E` 100% 严丝合缝**！同时 `150cm / 84胸 / 55腰` 的娇小妹子算出 $\Delta = 22.7 \Rightarrow \mathbf{F}$ 罩杯！

---

### 3. 修改 `src/ui/setup-options.js` 与 `src/ui/setup-presets.json`（补齐性器长度/粗度/特征下拉预设）

1. **`src/ui/setup-options.js` 第 3 行**：在 `numericAndDate` 对象中新增 `_gen_length` 和 `_gen_girth` 两个键：
   ```js
   _gen_length:['16cm','18cm','20cm','22cm','24cm'],_gen_girth:['4.2cm','4.8cm','5.2cm','5.6cm','6.0cm'],
   ```
2. **`src/ui/setup-presets.json` 的 `fields` 对象中**：新增 `"_gen_traits"` 预设数组（共 6 条，逐字照抄）：
   ```json
    "_gen_traits": [
      "形态饱满挺拔，青筋分明，热度惊人",
      "柱身粗壮笔直，冠头饱满硕大，充血后极具视觉压迫感",
      "尺寸傲人且硬度极佳，表面脉络盘绕，持久滚烫",
      "匀称修长，棱角分明，爆发力与持久度兼备",
      "前端微翘易顶敏感深处，柱身粗硕滚烫，存在感极强",
      "天赋异禀的巨物规格，青筋虬结，兼具惊人充血量与续航力"
    ],
   ```

---

### 4. 修改 `src/ui/app.js`（已有资产支持「编辑」 + 宽屏底部内嵌模式渲染与自适应高度）

#### (1) 开局表单「已有资产」编辑功能：
1. 在 `src/ui/app.js` 第 16 行 `let editingContactId=null` 旁增加 `editingAssetId=null`：
   ```js
   let editingContactId=null,editingAssetId=null,consumptionPage=0,withdrawalPreview=null;
   ```
2. 在第 36 行（`step === 1` 的已有资产列表渲染）中，把原先只有「移除」按钮的卡片改为带「编辑 + 移除」双按钮（与第 3 步熟人列表完全同款）：
   ```js
   ${d.initialAssets.map(a=>`<div class="person-preview"><b>${esc(a.name)}</b><span>${yuan(a.bookValueCents)} · ${esc(a.ownershipNote)}<br>${esc(assetDescription(a))}</span><div class="choice-row"><button class="mini-btn" data-edit-asset="${esc(a.assetId)}">编辑</button><button class="mini-btn" data-remove-asset="${esc(a.assetId)}">移除</button></div></div>`).join('')||'<p class="notice">开局资产按既有财产登记，不形成新的收入或支出。</p>'}
   ```
3. 改造第 61 行 `assetForm(assetId=null)` 函数，支持新增与编辑两种模式回填：
   ```js
   function assetForm(assetId=null){
     editingAssetId=assetId;
     const existing=assetId?draft.initialAssets.find(x=>x.assetId===assetId):null;
     const kind=existing?.kind||'HOUSE';
     const yuanVal=existing?String(Math.round((existing.bookValueCents||0)/100)):'0';
     showModal(`<h3>${existing?'编辑已有资产':'登记已有资产'}</h3><div class="field"><label for="a_kind">类别</label><select id="a_kind">${[['HOUSE','房产'],['CAR','座驾'],['BUSINESS','产业（商铺／股权／公司／会所）'],['YACHT_JET','游艇专机'],['LUXURY','奢品（名表／珠宝／箱包）'],['COLLECTIBLE','藏品（名画／古董／名酒）'],['OTHER','其他']].map(([k,label])=>`<option value="${k}" ${kind===k?'selected':''}>${label}</option>`).join('')}</select></div>${field('名称','a_name',existing?.name||'')}${field('估值（元）','a_value',yuanVal)}${field('位置／存放地点','a_note',existing?.locationNote||'')}${field('简易描述（50字内）','a_description',existing?.description||'',{area:true})}<p class="notice">描述写核心亮点即可：房产写面积与地段，座驾写型号与内饰，奢品与藏品写材质与来历。留空会按资产设定补全。</p>${field('产权说明','a_owner',existing?.ownershipNote||'本人全额所有，无债务')}<p class="notice">本版登记本人全额拥有的资产；份额与负债暂不计入。</p>${rowButtons(existing?'保存修改':'登记','save-asset')}`);
   }
   ```
4. 在 `actions(e)` 中：
   - 在 `if(d.removeAsset)` 旁新增：`if(d.editAsset){collect();assetForm(d.editAsset);}`
   - 将 `case 'add-asset':` 改为：`case 'add-asset':collect();assetForm(null);break;`
   - 将 `case 'save-asset':` 改为支持原位修改或新增：
     ```js
     case 'save-asset':{const name=val('a_name').trim();if(!name)throw Error('INVALID_TEXT');const kind=$('a_kind').value,bookValueCents=cents(val('a_value')),locationNote=val('a_note'),ownershipNote=val('a_owner').trim()||'本人全额所有，无债务';const item={assetId:editingAssetId||'asset_'+uid(),kind,name,bookValueCents,ownershipNote,locationNote,description:assetDescription({name,kind,bookValueCents,locationNote,description:val('a_description')})};const next={...draft,initialAssets:editingAssetId?draft.initialAssets.map(old=>old.assetId===editingAssetId?item:old):[...draft.initialAssets,item]};validateDraft(next);draft=next;editingAssetId=null;saveDraft();closeModal();wizard();break;}
     ```

#### (2) 「固定正文底部 · 宽屏内嵌模式」的顶栏一体化渲染与自适应高度：
在 `src/ui/app.js` 的 `phone()` 函数（第 74–91 行）中：
- 判断 `const isBottom = view.prefs.displayDock === 'bottom';`
- 给 `document.body.classList.toggle('is-bottom-dock', isBottom);`
- 当展开渲染 `<div class="phone ${isBottom?'is-bottom-dock':''}" id="phone">` 时：
  - 在 `.phone-hd` 中，若 `isBottom` 为真，把三个主导航 Tab（`⌂ 此刻 / ♡ 她们 / ▣ 我的`）作为 `.wide-nav` 嵌入顶栏中间（当不在二级子页面或即使在子页面也可快速切 Tab），右侧折叠按钮图标显示为 `−`（收起）；
  - 渲染完毕后，若 `isBottom` 为真，测量 `$('phone').offsetHeight`（自然内容高度），调用 `api.geometry?.({width:365, height:Math.max(260, $('phone').offsetHeight + 4), wide:true})`！
  - 此外，当在底部模式下打开弹窗（`showModal` / `closeModal`）或触发 `details` 折叠切换（`toggle` 事件）时，如果 `view?.prefs?.displayDock === 'bottom' && !folded`，在 `requestAnimationFrame` 中自动调用一次 `syncBottomHeight()` 更新 iframe 高度，确保展开子面板或弹窗时绝不被截断：
    ```js
    function syncBottomHeight(){
      if(setup||folded||view?.prefs?.displayDock!=='bottom'||!$('phone'))return;
      const modalH=$('modalOverlay')?.style.display==='flex'?460:0;
      const h=Math.max(260,modalH,$('phone').scrollHeight+4);
      api?.geometry?.({width:365,height:h,wide:true});
    }
    ```
    （在 `phone()` 末尾、`showModal()`、`closeModal()` 以及 `document.addEventListener('toggle', ...)` 中均调一次 `syncBottomHeight()`）。

---

### 5. 修改 `src/runtime/host.js`（底部宽屏模式 `width: 100%` 满宽无边框挂载）

将 `src/runtime/host.js` 第 194–202 行的 `api.geometry` 中 `mode === 'bottom'` 分支修改为 **100% 满宽**（不再写 `min(100%, 365px)`！）：

```js
api.geometry=({width=layout.width,height=layout.height,scale=1,left,top})=>{
  const mode=syncDockMount();
  if(mode==='bottom'){
    const isBar=height<=120;
    layout={width:365,height,scale:1};renderScale=1;lastZoom=1;
    const radius=isBar?'14px':'16px';
    Object.assign(phone.style,{
      position:'relative',left:'auto',top:'auto',
      width:'100%',
      height:(isBar?52:Math.max(260,Math.min(height,1600)))+'px',
      margin:'10px 0 6px',
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

---

### 6. 修改 `src/ui/style.css`（新增 `.is-bottom-dock` 宽屏内嵌样式）

在 `src/ui/style.css` 末尾追加以下宽屏内嵌模式专用样式（脱掉手机壳与刘海、取消内部固定高度滚动、启用宽屏多列网格）：

```css
/* rc.28：固定正文底部 · 100% 满宽内嵌宽屏面板模式（脱掉手机外壳与刘海） */
body.is-bottom-dock{overflow:visible!important}
.phone.is-bottom-dock{
  height:auto!important;min-height:0!important;max-height:none!important;
  border:1px solid var(--ui-line)!important;border-radius:16px!important;
  box-shadow:0 8px 26px var(--ui-shadow)!important;
  background:var(--ui-surface)!important;
}
.phone.is-bottom-dock::before{display:none!important}
.phone.is-bottom-dock .phone-hd{
  height:auto!important;min-height:48px!important;padding:10px 16px!important;
  border-bottom:1px solid var(--ui-line);cursor:default!important;
  flex-wrap:wrap;gap:10px;
}
.phone.is-bottom-dock .phone-screen{
  flex:none!important;height:auto!important;max-height:none!important;
  overflow:visible!important;padding:14px 16px 18px!important;
}
.phone.is-bottom-dock .bottom{
  border-top:1px solid var(--ui-line);min-height:52px;
}
@media(min-width:520px){
  .phone.is-bottom-dock .dossier-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
  .phone.is-bottom-dock .limit-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
  .phone.is-bottom-dock .mine-section[data-mine-section="assets"] .asset-mini{display:inline-flex;width:calc(50% - 5px);vertical-align:top;margin-right:5px}
}
```

---

## 三、 单元测试新增与实机验收要求（`tests/`）

1. **在 `tests/rc25-body-economy.test.mjs` 末尾新增 `rc.28` 专项单测**：
   - **测试三层反差罩杯推算 `inferCupSize`**：
     - 验证 6 位预设熟人（乔沐 B、林叙宁 B、温迎 C、顾星遥 C、沈清弦 D、江映 E）推算结果不变；
     - 验证 `150cm / 83胸 / 55腰` 的娇小细腰女性自动推算为 `F` 罩杯（童颜巨乳）；
     - 验证 `body` 含 `"身材娇小却有着惊人的巨乳"` 时，即使未填三围也自动推算为 `E` 或 `F` 罩杯；含 `"平胸少女"` 时推算为 `A` 罩杯。
   - **测试性器特征下拉预设**：验证 `fieldOptions('_gen_length')`、`fieldOptions('_gen_girth')`、`fieldOptions('_gen_traits')` 均返回非空预设数组。
   - **测试开局资产可编辑标记**：验证向导第 2 步渲染出的资产卡片同时包含 `data-edit-asset` 与 `data-remove-asset`。
   - **测试宽屏底部模式样式类**：验证切到 `displayDock: 'bottom'` 时，展开态容器包含 `is-bottom-dock` 类且 `host.js` 将 iframe 宽度设为 `100%`。
2. **运行全量校验与实机测试**：
   ```powershell
   npm test
   npm run build
   npm run check
   ```
   随后在 8001 测试酒馆用 ego 实机验证：
   - 开局第 1 步点击「性器特征 / 长度 / 粗度」能弹出下拉预设；第 2 步点「编辑」能修改已有资产；
   - 进局后切到「固定正文底部」，确认面板 **100% 铺满正文楼层宽度（与头顶「本轮变量更新」对齐，无手机刘海、无两侧黑边）**，截图留存并更新测试报告。
