import {PROFILE_KEYS} from '../src/core/engine.js';
export function economyScene(q,x,b){
 const evidence='验收记录：所有列出的支付、产权转移、退款与互动均已完成，金额明确，双方自愿。';
 const e=(type,fields={},ordinal=0)=>({type,...fields,ordinal,evidence});
 const events=[
  e('SCENE_REPLACE',{sceneId:'acceptance_terrace',location:'花店门前露台',timeHint:'午后',presentCharacterIds:[q,x],temporaryActors:[{tempId:'temp_acceptance',name:'露台访客',description:'明确成年的30岁女性，尚未与玩家交流',adultConfirmed:true}]}),
  e('CURRENT_STATE',{personRef:'USER',currentClothes:'浅灰衬衫',currentPose:'站在露台边',currentAction:'整理随身物品'}),
  e('CURRENT_STATE',{personRef:x,currentClothes:'深绿围裙',currentPose:'站在花桶旁',currentExpression:'轻松'}),
  e('CASH_TRANSACTION',{factId:'fixture_car_purchase',direction:'OUT',payer:'USER',amountCents:3000000,kind:'VEHICLE_PURCHASE',completed:true,allocations:[],asset:{assetId:'fixture_car',kind:'CAR',name:'验收旅行车',ownerId:'USER'}}),
  e('ASSET_TRANSFER',{factId:'fixture_car_transfer',personRef:x,assetId:'fixture_car',completed:true}),
  e('CASH_TRANSACTION',{factId:'fixture_salary',direction:'IN',payer:'EMPLOYER',amountCents:500000,kind:'SALARY',completed:true,allocations:[],memo:'验收工资'}),
  e('CASH_TRANSACTION',{factId:'fixture_dinner',direction:'OUT',payer:'USER',amountCents:10000,kind:'DINING',completed:true,allocations:[{personRef:q,amountCents:6000},{personRef:x,amountCents:4000}],memo:'验收多人用餐'}),
  e('TRANSACTION_REFUND',{factId:'fixture_refund',refundOf:'fixture_dinner',amountCents:5000,completed:true,memo:'验收部分退款'}),
  e('SIGNIFICANT_BEHAVIOR_SCORE',{factId:'fixture_support',personRef:x,action:'验收重要支持',score:86,reason:'双方自愿的独立重要事件',completed:true,consensual:true,independent:true}),
  e('AFFECTION_CHANGE',{personRef:b,delta:1})
 ].map((v,i)=>({...v,ordinal:i}));
 return '【受控验收场景：非模型生成】\n'+evidence+'\n<SH_EVENTS>'+JSON.stringify({schemaVersion:2,events})+'</SH_EVENTS>';
}
export function frozenScene(x){const evidence='验收记录：玩家实际支付100元赠礼，该人物收到礼物并自愿拥抱，互动完整发生。';return '【受控隐藏验收】\n'+evidence+'\n<SH_EVENTS>'+JSON.stringify({schemaVersion:2,events:[{ordinal:0,type:'CASH_TRANSACTION',factId:'fixture_hidden_gift',direction:'OUT',payer:'USER',amountCents:10000,kind:'GIFT',completed:true,allocations:[{personRef:x,amountCents:10000}],evidence},{ordinal:1,type:'AFFECTION_CHANGE',personRef:x,delta:5,evidence},{ordinal:2,type:'SIGNIFICANT_BEHAVIOR_SCORE',factId:'fixture_hidden_hug',personRef:x,action:'隐藏期拥抱',score:90,reason:'仅用于冻结验收',completed:true,consensual:true,independent:true,evidence}]})+'</SH_EVENTS>';}
