// 由 .work/gen-casino-catalog.mjs 从 AGY_PLAN_rc35_casino.md 逐字生成，请勿手改。
// 改文案 = 改那份方案，再重跑生成脚本。
export const WISH_CARDS = {
 "gray": {
  "name": "灰烬星愿卡",
  "tierLabel": "灰阶 · I",
  "basePoints": 20
 },
 "red": {
  "name": "绯红星愿卡",
  "tierLabel": "红阶 · II",
  "basePoints": 60
 },
 "gold": {
  "name": "鎏金星愿卡",
  "tierLabel": "金阶 · III",
  "basePoints": 200
 },
 "rainbow": {
  "name": "虹光星愿卡",
  "tierLabel": "虹阶 · IV",
  "basePoints": 800
 }
};

export const CASINO_BETS = {
 "red": {
  "name": "绯红框",
  "multText": "×2",
  "oddsText": "18 / 37 格"
 },
 "black": {
  "name": "黑曜框",
  "multText": "×2",
  "oddsText": "18 / 37 格"
 },
 "green": {
  "name": "翡翠框",
  "multText": "×36",
  "oddsText": "1 / 37 格"
 }
};

export const CASINO_UI = {
 "currencyName": "星愿积分",
 "modeNames": {
  "play": "命运轮盘",
  "casino": "暗夜赌场"
 },
 "calendarEntry": {
  "title": "命运与暗夜轮盘",
  "badge": "双模式",
  "sub": "玩法轮盘 53 格 · 暗夜赌场 37 格"
 },
 "minePortals": {
  "abilityTitle": "异能（仅主角持有）",
  "abilityEmpty": "尚未觉醒异能，前往星愿商城兑换",
  "bagTitle": "我的背包",
  "bagSub": "星愿卡 · 抽奖与商城物品",
  "shopTitle": "星愿商城",
  "shopSub": "异能 · 超现实奇物 · 终极大奖"
 },
 "cards": {
  "gray": {
   "name": "灰烬星愿卡",
   "tierLabel": "灰阶 · I",
   "basePoints": 20
  },
  "red": {
   "name": "绯红星愿卡",
   "tierLabel": "红阶 · II",
   "basePoints": 60
  },
  "gold": {
   "name": "鎏金星愿卡",
   "tierLabel": "金阶 · III",
   "basePoints": 200
  },
  "rainbow": {
   "name": "虹光星愿卡",
   "tierLabel": "虹阶 · IV",
   "basePoints": 800
  }
 },
 "bets": {
  "red": {
   "name": "绯红框",
   "multText": "×2",
   "oddsText": "18 / 37 格"
  },
  "black": {
   "name": "黑曜框",
   "multText": "×2",
   "oddsText": "18 / 37 格"
  },
  "green": {
   "name": "翡翠框",
   "multText": "×36",
   "oddsText": "1 / 37 格"
  }
 },
 "buttons": {
  "drawFreeCard": "领取今日星愿卡",
  "drawDoneToday": "今日免费卡已领",
  "cashOut": "收手兑换",
  "returnCard": "收回背包",
  "goIdle": "请先放卡",
  "goSpinning": "转动中…",
  "playSpinByPoints": "消耗 120 星愿积分抽 1 次",
  "bagGoBet": "去赌场加押",
  "bagRedeem": "立即兑换",
  "shopBuy": "确认兑换",
  "shopUpgrade": "进阶强化",
  "shopOwned": "已觉醒"
 },
 "prompts": {
  "casinoRule": "押中即原卡价值翻倍（红/黑 ×2，绿 ×36），可一路连赌不设上限；押错则整张卡连同累积价值彻底销毁。",
  "winNormal": "押中翻倍！卡牌价值跃升至 {value} 星愿积分。继续加押，还是立刻收手兑换？",
  "winGreen": "翡翠圣格命中 · ×36 暴涨！卡牌价值飙升至 {value} 星愿积分！",
  "lose": "满盘皆输。价值 {value} 分的星愿卡已被暗夜彻底吞噬。",
  "cashOutOk": "落袋为安，已兑换 +{value} 星愿积分。",
  "insufficientPoints": "星愿积分不足，还需要 {gap} 积分。"
 }
};

export const ABILITIES = [
 {
  "abilityId": "ab_micro",
  "name": "微表情洞悉",
  "tag": "读心微相",
  "effect": "一眼看穿对方瞬间的口是心非、心动与隐瞒，提前捕捉未显影的暗伤线索",
  "rarity": "red",
  "price": 350,
  "upgradable": true,
  "levelText": "是（Lv1–3）",
  "lore": "仅主角察觉细微神态破绽，不引发对方怀疑",
  "impact": "纯叙事：正文允许描写主角提前看破敷衍、吃醋与暗伤端倪"
 },
 {
  "abilityId": "ab_sober",
  "name": "宿醉免疫体",
  "tag": "千杯不醉",
  "effect": "酒精与疲劳极速代谢，酒局推杯换盏永远保持绝对清醒与从容气场",
  "rarity": "red",
  "price": 400,
  "upgradable": false,
  "levelText": "否",
  "lore": "饮酒不醉不乱性，次日无宿醉",
  "impact": "纯叙事：酒局与夜场博弈中主角始终清醒掌控节奏"
 },
 {
  "abilityId": "ab_scent",
  "name": "余韵留香",
  "tag": "体香催情",
  "effect": "贴近时散发令女性心率加速的冷冽费洛蒙，亲密接触时对方情欲升温更快",
  "rarity": "red",
  "price": 450,
  "upgradable": true,
  "levelText": "是（Lv1–3）",
  "lore": "旁人只觉你身上气味极有侵略性且让人上瘾",
  "impact": "数值+叙事：脚本 arousalGuard 在撩拨/亲密轮次将 arousal 下限额外 +8（Lv2 +12，Lv3 +16）"
 },
 {
  "abilityId": "ab_voice",
  "name": "语感共鸣",
  "tag": "言灵共情",
  "effect": "低沉磁性的声线直击心防，日常安抚、劝说与拆解心结时更容易击中软肋",
  "rarity": "red",
  "price": 500,
  "upgradable": true,
  "levelText": "是（Lv1–3）",
  "lore": "语调自带安抚与蛊惑质感，易令人卸下戒心",
  "impact": "数值+叙事：脚本结算好感正向增量时额外 +1（Lv2 +2，Lv3 +3）"
 },
 {
  "abilityId": "ab_master",
  "name": "技艺通晓",
  "tag": "大师通艺",
  "effect": "钢琴、品酒、马术、高尔夫、多国语言等顶奢社交技艺一学即达大师水准",
  "rarity": "red",
  "price": 550,
  "upgradable": false,
  "levelText": "否",
  "lore": "任何高端圈层社交场合皆游刃有余",
  "impact": "纯叙事：社交/慕强博弈中可直接碾压对手与圈内名流"
 },
 {
  "abilityId": "ab_stealth",
  "name": "夜色隐匿",
  "tag": "无痕匿迹",
  "effect": "弱化周遭无关路人与监控的注意力，半公开场合亲密或私密出行极难被察觉",
  "rarity": "gold",
  "price": 900,
  "upgradable": true,
  "levelText": "是（Lv1–3）",
  "lore": "路人视线自然滑开，不留把柄",
  "impact": "纯叙事：大幅降低半公开偷欢被撞破的风险，正文按此演绎"
 },
 {
  "abilityId": "ab_stamina",
  "name": "龙精虎猛",
  "tag": "无尽精力",
  "effect": "体能与恢复力超越常人极限，彻夜欢愉或连轴商战皆毫无疲态",
  "rarity": "gold",
  "price": 1100,
  "upgradable": true,
  "levelText": "是（Lv1–3）",
  "lore": "精力深不见底，事后仍游刃有余",
  "impact": "数值+叙事：脚本判定床笫战力时 prowessScore 视同额外 +8/+12/+16（上限 100）"
 },
 {
  "abilityId": "ab_aura",
  "name": "气场压制",
  "tag": "王者威压",
  "effect": "无需提高音量，一个眼神即可令嚣张对手、势利高管与宵小当场失语退缩",
  "rarity": "gold",
  "price": 1200,
  "upgradable": true,
  "levelText": "是（Lv1–3）",
  "lore": "无形压迫感让敌对者本能胆寒",
  "impact": "纯叙事：打脸、谈判、护短场景可一锤定音"
 },
 {
  "abilityId": "ab_fate",
  "name": "巧合编织",
  "tag": "命运巧遇",
  "effect": "每日可微调一次城市里的偶然事件——骤雨、空包厢、同乘电梯或偶遇",
  "rarity": "gold",
  "price": 1400,
  "upgradable": false,
  "levelText": "否",
  "lore": "一切显得天衣无缝，旁人只道缘分使然",
  "impact": "纯叙事：主角主动发念头时，正文顺理成章制造有利巧合"
 },
 {
  "abilityId": "ab_mind",
  "name": "心灵窃听",
  "tag": "表层读心",
  "effect": "对视三秒即可清晰听见对方此刻表层的真实心声与盘算",
  "rarity": "gold",
  "price": 1600,
  "upgradable": true,
  "levelText": "是（Lv1–3）",
  "lore": "仅主角能听见对方未说出口的念头",
  "impact": "纯叙事（破知识边界）：允许主角在剧情中直接获知在场女性的 currentThought"
 },
 {
  "abilityId": "ab_memory",
  "name": "记忆微调",
  "tag": "印象重塑",
  "effect": "柔化或淡化对方对某次尴尬失言或越界试探的戒备记忆，使其自然圆融",
  "rarity": "gold",
  "price": 1800,
  "upgradable": true,
  "levelText": "是（Lv1–3）",
  "lore": "不篡改核心人格，只抹平短期抵触尖刺",
  "impact": "纯叙事：越界试探被拒后可一键化解冷场与隔阂"
 },
 {
  "abilityId": "ab_gaze",
  "name": "惑心凝视",
  "tag": "魅瞳蛊心",
  "effect": "四目相对时令对方防线大幅松动、理智在悸动中沉沦",
  "rarity": "rainbow",
  "price": 2800,
  "upgradable": true,
  "levelText": "是（Lv1–3）",
  "lore": "凝视带来难以抗拒的晕眩与顺从冲动",
  "impact": "数值+叙事：脚本结算堕落度正向增量时额外 +2/+3/+5"
 },
 {
  "abilityId": "ab_rewind",
  "name": "因果逆流",
  "tag": "回溯三刻",
  "effect": "每日一次将现实局部回溯三分钟，唯有主角保留记忆，重写说错的话或错过的瞬间",
  "rarity": "rainbow",
  "price": 3500,
  "upgradable": false,
  "levelText": "否",
  "lore": "旁人毫无察觉，只觉当下发展顺理成章",
  "impact": "纯叙事：主角可随时在正文发动三分钟局部时间回溯"
 },
 {
  "abilityId": "ab_stop",
  "name": "时停十分钟",
  "tag": "绝对时停",
  "effect": "每日一次冻结周遭百米内的时间流逝十分钟，唯有主角在静止世界里自由行动",
  "rarity": "rainbow",
  "price": 4500,
  "upgradable": false,
  "levelText": "否",
  "lore": "恢复流动时旁人不会察觉时间断层，仅残留细微身体异样感",
  "impact": "纯叙事：终极都市异能，可布景、脱困、端详或肆意触碰"
 }
];

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.abilityId, a]));

export const SURREAL_ITEMS = [
 {
  "itemId": "it_whisky",
  "name": "真言威士忌",
  "tag": "真言酒",
  "kindText": "消耗奇物",
  "effect": "饮下一口，半小时内对方无法对你撒谎，问什么答什么",
  "rarity": "red",
  "price": 150,
  "lore": "入口醇厚微甜，对方毫无察觉",
  "impact": "纯叙事：套出真实心意、秘密或商业底牌",
  "consumable": true
 },
 {
  "itemId": "it_incense",
  "name": "微醺忘忧香",
  "tag": "忘忧香",
  "kindText": "消耗奇物",
  "effect": "点燃后散发雪松与白桃暗香，抚平戒备、疲惫与道德负罪感",
  "rarity": "red",
  "price": 180,
  "lore": "仅被视作高级定制香薰",
  "impact": "纯叙事：大幅软化高冷或纠结对象的心理防线",
  "consumable": true
 },
 {
  "itemId": "it_leave",
  "name": "完美替身请假条",
  "tag": "免责假条",
  "kindText": "消耗奇物",
  "effect": "写上她姓名与日期，她的公司/学校/家庭会自然替她空出完整一天假期",
  "rarity": "red",
  "price": 200,
  "lore": "所有手续与口径自动严丝合缝",
  "impact": "纯叙事：无后顾之忧地带走忙碌对象独处",
  "consumable": true
 },
 {
  "itemId": "it_umbrella",
  "name": "暴雨召唤伞",
  "tag": "唤雨伞",
  "kindText": "消耗奇物",
  "effect": "撑开瞬间方圆三公里落下恰到好处的急雨，顺理成章留人同车或留宿",
  "rarity": "red",
  "price": 220,
  "lore": "旁人只当沿海天气骤变",
  "impact": "纯叙事：强力制造共伞、留宿、换衣场景",
  "consumable": true
 },
 {
  "itemId": "it_concealer",
  "name": "无痕遮瑕露",
  "tag": "隐痕露",
  "kindText": "消耗奇物",
  "effect": "涂抹后一秒隐去吻痕、红印与疲态，唯有主角视线可见，外人毫无察觉",
  "rarity": "red",
  "price": 240,
  "lore": "方便亲密后体面返场或职场偷欢",
  "impact": "纯叙事：解除吻痕顾虑，助推大胆玩法",
  "consumable": true
 },
 {
  "itemId": "it_earring",
  "name": "心跳共振耳钉",
  "tag": "共鸣耳钉",
  "kindText": "持久奇物",
  "effect": "成对佩戴后，无论相隔多远都能隐约感知对方此刻的情绪与心率起伏",
  "rarity": "red",
  "price": 280,
  "lore": "外观如极简白金耳钉",
  "impact": "纯叙事：异地也能精准感知她心动或低落瞬间",
  "consumable": false
 },
 {
  "itemId": "it_mirror",
  "name": "私密窥心镜",
  "tag": "窥心镜",
  "kindText": "消耗奇物",
  "effect": "对任意已收录女性使用，立刻在正文揭晓她最隐秘的过往暗伤与真实癖好",
  "rarity": "gold",
  "price": 480,
  "lore": "镜面一闪即逝，旁人不可见",
  "impact": "脚本+叙事：加入 wheel.unlockedSecretPages，破除暗伤隐藏门槛",
  "consumable": true
 },
 {
  "itemId": "it_watch",
  "name": "情绪温控怀表",
  "tag": "氛围怀表",
  "kindText": "持久奇物",
  "effect": "轻拨表冠，让室内氛围在「浪漫暧昧 / 奢靡沉沦 / 静谧安心」间悄然切换",
  "rarity": "gold",
  "price": 550,
  "lore": "复古黑曜怀表，无声改写环境张力",
  "impact": "纯叙事：自由定调当前场景氛围",
  "consumable": false
 },
 {
  "itemId": "it_rose_seal",
  "name": "契约玫瑰印章",
  "tag": "誓约印",
  "kindText": "消耗奇物",
  "effect": "盖在信笺或肌肤上，令对方在接下来 24 小时内对你的一个合理指令无法拒绝",
  "rarity": "gold",
  "price": 650,
  "lore": "化作淡红暗纹，对方视作甘愿赴约",
  "impact": "纯叙事：强制推进一次约会、换装或试探",
  "consumable": true
 },
 {
  "itemId": "it_door_key",
  "name": "任意门钥匙扣",
  "tag": "瞬移钥",
  "kindText": "消耗奇物",
  "effect": "推开面前任意一扇房门，直接通往你名下房产或预约好的私密套房",
  "rarity": "gold",
  "price": 750,
  "lore": "旁人会自然忽略通勤空白",
  "impact": "纯叙事：零耗时瞬移转场，制造惊艳浪漫",
  "consumable": true
 },
 {
  "itemId": "it_elixir",
  "name": "冻龄秘露",
  "tag": "驻颜露",
  "kindText": "消耗奇物",
  "effect": "赠予任意女性服下，令其容颜永驻巅峰、肌肤焕发光泽（不改颜值分）",
  "rarity": "gold",
  "price": 800,
  "lore": "包装如顶级奢华安瓶",
  "impact": "纯叙事：极高情绪价值赠礼，大幅打动爱美女性",
  "consumable": true
 },
 {
  "itemId": "it_pillow",
  "name": "双生梦境枕",
  "tag": "同梦枕",
  "kindText": "持久奇物",
  "effect": "入睡前默念她的名字，今夜她将与你在同一场极度真实的梦境中相会",
  "rarity": "gold",
  "price": 900,
  "lore": "醒来仍有余温与清晰记忆",
  "impact": "纯叙事：开辟肆无忌惮的梦境私密剧场",
  "consumable": false
 },
 {
  "itemId": "it_hourglass",
  "name": "逆转十分钟沙漏",
  "tag": "回溯沙漏",
  "kindText": "消耗奇物",
  "effect": "倒转沙漏，将当前场景强行退回十分钟前，唯有你保留全部记忆",
  "rarity": "rainbow",
  "price": 1200,
  "lore": "一次性强力悔棋道具",
  "impact": "纯叙事：关键对话或选择翻车时强行重来",
  "consumable": true
 },
 {
  "itemId": "it_perfume",
  "name": "欲望潮汐香水",
  "tag": "潮汐香",
  "kindText": "消耗奇物",
  "effect": "喷洒于颈侧或室内，瞬间将周围女性感官敏感度放大数倍，轻触即生颤栗",
  "rarity": "rainbow",
  "price": 1400,
  "lore": "气味若有似无，效果直击感官",
  "impact": "数值+叙事：当轮使用后，在场女性 arousal 立即 +25（上限 100）",
  "consumable": true
 },
 {
  "itemId": "it_choker",
  "name": "黑曜誓约项圈",
  "tag": "誓约项圈",
  "kindText": "持久奇物",
  "effect": "佩戴后在旁人眼中只是寻常细颈链，唯有她与你知晓这是绝对臣服的私密烙印",
  "rarity": "rainbow",
  "price": 1800,
  "lore": "视觉认知遮蔽，日常可公开佩戴",
  "impact": "纯叙事：高堕落/专属关系的终极支配象征",
  "consumable": false
 },
 {
  "itemId": "it_toylink",
  "name": "TOY·LINK 终端控制模块",
  "tag": "终极大奖",
  "kindText": "永久解锁",
  "effect": "直接激活 wheel.toyLinkUnlocked = true，无需等命运轮盘 60 抽保底，立刻解锁并可呼出 TOY·LINK 实体遥控器",
  "rarity": "rainbow",
  "price": 3600,
  "lore": "复用 rc.34 方案 A 桥接与世界书防穿帮逻辑",
  "impact": "脚本解锁：永久置 toyLinkUnlocked = true，开放一键呼出 TD",
  "consumable": false
 }
];

export const SURREAL_ITEM_BY_ID = Object.fromEntries(SURREAL_ITEMS.map((i) => [i.itemId, i]));

// 命定签 → 稀有度的基础星愿积分（与 WISH_CARDS 保持一致）
export const CARD_POINTS = Object.fromEntries(
  Object.entries(WISH_CARDS).map(([k, v]) => [k, v.basePoints])
);
