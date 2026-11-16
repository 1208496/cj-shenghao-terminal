import {add,poolParts} from './engine.js';

const labels={SHOPPING:'购物消费（商品未记录）',DINING:'餐饮消费（商品未记录）',TRAVEL:'出行消费（项目未记录）',GIFT:'赠礼（商品未记录）',TRANSFER_OUT:'现金转赠',PROPERTY_PURCHASE:'房产购买',VEHICLE_PURCHASE:'车辆购买',ASSET_TRANSFER:'已有资产转赠'};
export function consumptionHistory(s,cid,{page=0,pageSize=20}={}){
  const ledger=Object.values(s.finance.ledger),rewards=Object.values(s.rewardEvents),rows=[];
  for(const l of ledger){
    if(!['OUT','NONE'].includes(l.direction))continue;
    const allocation=l.allocations.find(a=>a.personRef===cid);if(!allocation)continue;
    const refunds=ledger.filter(r=>r.refundOf===l.eventId||l.kind==='ASSET_TRANSFER'&&r.assetId===l.assetId&&r.kind==='REFUND'&&r.createdRevision>l.createdRevision);
    const refundedCents=refunds.reduce((n,r)=>add(n,l.kind==='ASSET_TRANSFER'?r.amountCents:(r.allocations.find(a=>a.personRef===cid)?.amountCents||0)),0);
    const credits=rewards.filter(r=>r.relatedLedgerId===l.entryId&&r.characterId===cid);
    const paymentRefundedCents=refunds.reduce((n,r)=>add(n,r.amountCents),0);
    rows.push({transactionId:l.entryId,sourceFactId:l.eventId,kind:l.kind,itemName:l.itemName||l.memo||labels[l.kind]||'消费（商品未记录）',merchantOrPlace:l.merchantOrPlace,sceneTime:l.recordedAtScene,paidCents:l.amountCents,allocatedCents:allocation.amountCents,netAllocatedCents:Math.max(0,allocation.amountCents-refundedCents),refundedCents,paymentRefundedCents,refunds,poolCreditEventIds:credits.map(r=>r.eventId),poolCreditCents:credits.reduce((n,r)=>add(n,r.cashbackCents-r.refundedCents),0),pendingCents:credits.filter(r=>!r.withdrawalId).reduce((n,r)=>add(n,r.cashbackCents-r.refundedCents),0),withdrawalIds:[...new Set(credits.map(r=>r.withdrawalId).filter(Boolean))],assetId:l.assetId,status:paymentRefundedCents>0?(paymentRefundedCents>= (l.kind==='ASSET_TRANSFER'?allocation.amountCents:l.amountCents)?'已退款':'部分退款'):l.kind==='ASSET_TRANSFER'?'已转赠':l.kind==='GIFT'?'已赠与':'已完成'});
  }
  rows.reverse();const sum=k=>rows.reduce((n,r)=>add(n,r[k]),0),withdrawals=Object.values(s.withdrawals).filter(w=>w.characterId===cid).reverse();
  const pages=Math.max(1,Math.ceil(rows.length/pageSize)),current=Math.max(0,Math.min(Math.trunc(page)||0,pages-1));
  return {rows:rows.slice(current*pageSize,(current+1)*pageSize),count:rows.length,page:current,pages,paidCents:sum('paidCents'),netAllocatedCents:sum('netAllocatedCents'),pendingSpendCents:poolParts(s,cid).spend,withdrawals,withdrawnCents:withdrawals.reduce((n,w)=>add(n,w.paidCents),0)};
}
