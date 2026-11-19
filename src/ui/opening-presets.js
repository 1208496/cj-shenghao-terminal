import {contactPresets} from './setup-options.js';

export const cashOptions=[0,10000,100000,1000000];
const common={gender:'男',appearance:'黑色短发，五官清晰，目光平和',body:'体型匀称，肩背舒展，平时保持适度活动',city:'云澜市',startDate:'2026-11-16',startTime:'09:00',weather:'晴，微风'};
export const openingPresets=[
 {id:'broke',label:'穷光蛋开局',cashYuan:0,fields:{occupation:'正在找工作',background:'近期工作告一段落，积蓄已经花完，打算从临时工作和新的机会重新开始。没有未结债务，日常开销需要自己逐步挣取。',currentLocation:'江城区·合租房',workLifeDescription:'正在整理简历、寻找工作，日常以步行和公交出行为主。'},assets:[],contacts:['cafe_neighbor']},
 {id:'worker',label:'上班族牛马',cashYuan:10000,fields:{occupation:'广告公司项目执行',background:'在城市里靠工资独立生活，工作节奏紧，手头留着一万元应急金。没有既有房产和车辆，期待逐渐改善生活。',currentLocation:'江城区·地铁口出租屋',workLifeDescription:'工作日常要赶方案、盯进度，忙时加班，周末尽量补觉或和朋友吃顿便饭。'},assets:[{kind:'OTHER',name:'办公笔记本电脑',description:"14英寸深灰金属轻薄本（16G/512G），窄边框高色域屏，日常改方案与办公主力。",bookValueCents:600000,locationNote:'本人住所'}],contacts:['design_colleague']},
 {id:'comfortable',label:'小康人家',cashYuan:100000,fields:{occupation:'企业部门主管',background:'工作与家庭经济状况稳定，已经拥有一套普通住房和一辆家用车，另留十万元现金。既有资产产权清晰，没有未结债务。',currentLocation:'江城区·翠湖公寓',workLifeDescription:'日常工作有忙有闲，重视家庭与个人生活，假日喜欢散步、阅读或短途出行。'},assets:[{kind:'HOUSE',name:'翠湖公寓两居室',description:"约92㎡南向两室两厅，浅木风精装带生活阳台与固定车位，楼下生活配套齐全。",bookValueCents:150000000,locationNote:'江城区'},{kind:'CAR',name:'家用轿车',description:"银灰色丰田卡罗拉1.5L自动挡，黑色织物内饰整洁，动力平顺，日常代步通勤。",bookValueCents:10000000,locationNote:'住宅停车位'}],contacts:['florist_friend','uni_alumni']},
 {id:'wealthy',label:'富家公子哥',cashYuan:1000000,fields:{occupation:'家族企业项目负责人',background:'成长于经济宽裕的家庭，目前尝试独立负责项目，手头有一百万元可用现金。名下住房、车辆和腕表均为既有资产，没有未结债务。',currentLocation:'江城区·临江大平层',workLifeDescription:'日程相对自由，同时要处理项目事务和商务沟通，业余保持运动，也愿意接触不同领域的新事物。'},assets:[{kind:'HOUSE',name:'临江大平层',description:"约238㎡四室两厅一线江景大平层，胡桃木石材精装，配书房、健身区与双地下车位。",bookValueCents:800000000,locationNote:'江城区临江住宅区'},{kind:'CAR',name:'豪华轿车',description:"曜石黑奔驰S级长轴（3.0T六缸），米色真皮行政后排带独立空调，静谧尊贵。",bookValueCents:120000000,locationNote:'住宅地下车库'},{kind:'LUXURY',name:'机械腕表',description:"40mm精钢自动机械腕表，银白放射纹表盘配蓝宝石镜面与棕色鳄鱼皮带，背透机芯。",bookValueCents:1500000,locationNote:'本人持有'}],contacts:['startup_partner','gym_coach']}
];

export function applyOpeningPreset(draft,presetId,makeId=()=>crypto.randomUUID()){
  const preset=openingPresets.find(p=>p.id===presetId);if(!preset)throw Error('INVALID_DRAFT');
  return {...draft,...common,...preset.fields,name:draft.name,age:draft.age,initialCashCents:preset.cashYuan*100,openingPresetId:preset.id,
    initialAssets:preset.assets.map(a=>({...a,assetId:'asset_'+makeId(),ownershipNote:'本人全额所有，无债务'})),
    contacts:preset.contacts.map(id=>{const p=contactPresets.find(p=>p.presetId===id);if(!p)throw Error('INVALID_DRAFT');return {...structuredClone(p),id:'char_'+makeId(),present:false};})};
}
