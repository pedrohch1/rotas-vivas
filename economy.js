'use strict';
// Economia regional determinística e pequena, isolada para permitir testes sem servidor.
const TARGETS = {
  palmeiras:{madeira:13,minerio:4,sucata:7,tabuas:22,metal:13},
  serra:{madeira:8,minerio:12,sucata:10,tabuas:14,metal:25},
  lago:{madeira:23,minerio:7,sucata:18,tabuas:15,metal:10}
};
const CONSUMPTION = {
  palmeiras:{madeira:1,tabuas:2,metal:1},
  serra:{minerio:1,tabuas:1,metal:2},
  lago:{madeira:2,sucata:1,tabuas:1}
};
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
function initTown(t){
 t.target={...(TARGETS[t.id]||TARGETS.palmeiras),...(t.target||{})};
 t.stock={...Object.fromEntries(Object.entries(t.target).map(([k,v])=>[k,Math.floor(v*.55)])),...(t.stock||{})};
 t.prosperity=clamp(Number.isFinite(t.prosperity)?t.prosperity:60,0,100);
 t.priceFactor=Number.isFinite(t.priceFactor)?t.priceFactor:1;
 return t;
}
function scarcity(t,r){const target=Math.max(1,t.target?.[r]||10),amount=clamp(t.stock?.[r]||0,0,target*2);return clamp(1+(target-amount)/target*.52,.68,1.52)}
function townPrice(w,t,r,res){
 if(!res[r])return 0;
 const event=w.event&&w.event.until>=w.day&&w.event.town===t.id&&w.event.resource===r?w.event.multiplier:1;
 const wave=1+.07*Math.sin(w.priceWave+Object.keys(res).indexOf(r));
 return Math.max(5,Math.round(res[r].price*t.factor*t.priceFactor*scarcity(t,r)*event*wave*(w.upgrades?.network?1.08:1)));
}
function delivery(t,r,qty){
 if(!Number.isInteger(qty)||qty<=0||!t.target?.[r])return;
 const before=t.stock[r]||0;t.stock[r]=Math.min(999, before+qty);
 const recovered=before<t.target[r] ? Math.min(qty,t.target[r]-before):0;
 t.prosperity=clamp(t.prosperity+recovered*.65,0,100);
 t.delivered=(t.delivered||0)+qty;
 t.priceFactor=clamp(t.priceFactor-.006,.86,1.35);
}
function dailyEconomy(w,onEvent){
 let shortages=0;
 for(const t of w.towns){initTown(t);const rates=CONSUMPTION[t.id]||CONSUMPTION.palmeiras;
  let missing=0;for(const [r,qty] of Object.entries(rates)){
   const actual=Math.min(qty,t.stock[r]||0);t.stock[r]-=actual;missing+=qty-actual;
  }
  // NPCs também abastecem cidades, evitando que só quatro pessoas sustentem toda a região.
  if(w.day%3===0){const keys=Object.keys(t.target);const r=keys[(w.day/3+t.id.length)%keys.length|0];
   const amount=2+(w.day%4);t.stock[r]=Math.min(t.target[r]*2,(t.stock[r]||0)+amount);
  }
  t.prosperity=clamp(t.prosperity+(missing?-missing*.85:.25),0,100);
  shortages+=missing;
  t.priceFactor=clamp(t.priceFactor+.01,.86,1.35);
 }
 if(shortages>0&&w.day%5===0)onEvent?.(`🏘️ A região enfrenta escassez de ${shortages} unidades. Abastecimentos podem recuperar as cidades.`);
}
function contractCandidate(w,cycle){
 if(w.contractSeq<=cycle.length){const [town,type,qty]=cycle[(w.contractSeq-1)%cycle.length];return {town,type,qty};}
 let best=null;
 for(const town of w.towns){
  for(const [type,target] of Object.entries(town.target||{})){
   // Prioriza carências ainda não cobertas por contrato aberto e alterna ciclos.
   const pending=w.contracts.some(c=>c.town===town.id&&c.type===type);
   const gap=Math.max(0,target-(town.stock[type]||0));
   const score=gap/Math.max(1,target)+(pending?-2:0)+((w.contractSeq+town.id.length+type.length)%7)*.017;
   if(!best||score>best.score)best={town:town.id,type,qty:clamp(Math.ceil(gap*.48),3,12),score};
  }
 }
 return best||{town:'palmeiras',type:'madeira',qty:6};
}
function addContract(w,cycle,res){const chosen=contractCandidate(w,cycle);
 const t=w.towns.find(t=>t.id===chosen.town);const initial=w.contractSeq<=3;
 const urgency=initial?1:scarcity(t,chosen.type);
 const reward=Math.round((chosen.qty*res[chosen.type].price*1.82*urgency+90)*(w.projects?.find(p=>p.id==='terminal')?.completed?1.15:1));
 const contract={id:w.contractSeq++,town:chosen.town,type:chosen.type,qty:chosen.qty,reward,deadlineDay:w.day+(initial?35:15),createdDay:w.day};
 w.contracts.push(contract);return contract;
}
function expireContracts(w,cycle,res,onEvent){let expired=0;
 const remain=[];for(const c of w.contracts){if(c.deadlineDay&&c.deadlineDay<w.day){expired++;const t=w.towns.find(t=>t.id===c.town);if(t)t.prosperity=clamp(t.prosperity-3,0,100);w.reputation=Math.max(0,w.reputation-3);}else remain.push(c)}
 w.contracts=remain;for(let i=0;i<expired;i++)addContract(w,cycle,res);
 if(expired)onEvent?.(`⌛ ${expired} contrato(s) expiraram. A cooperativa perdeu reputação e as cidades tiveram prejuízos.`);
 return expired;
}
module.exports={initTown,scarcity,townPrice,delivery,dailyEconomy,addContract,expireContracts};
