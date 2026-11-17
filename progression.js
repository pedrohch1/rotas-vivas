'use strict';
// Objetivos coletivos cíclicos: metas paralelas, não uma campanha linear obrigatória.
const GOALS={
 deliveries:{name:'Rede de abastecimento',emoji:'📦',description:'Entregue mercadorias às cidades, por contratos, vendas ou operações.',base:25,increment:15,reward:280,intel:1,reputation:8},
 production:{name:'Polo industrial',emoji:'🏭',description:'Produza tábuas e metal, manualmente ou por automação.',base:12,increment:8,reward:260,intel:2,reputation:5},
 recovery:{name:'Economia circular',emoji:'♻️',description:'Recupere sucata nos pontos de coleta.',base:20,increment:12,reward:240,intel:1,reputation:7}
};
function init(w){w.initiatives??=Object.fromEntries(Object.keys(GOALS).map(id=>[id,{tier:1,progress:0}]));
 for(const id of Object.keys(GOALS)){w.initiatives[id]??={tier:1,progress:0};}return w.initiatives;}
function goal(id,tier){const def=GOALS[id];return def?{...def,target:def.base+def.increment*(tier-1)}:null}
function advance(w,id,qty,log){if(!GOALS[id]||!Number.isInteger(qty)||qty<=0)return 0;init(w);
 const entry=w.initiatives[id];entry.progress+=qty;let earned=0;
 while(entry.progress>=goal(id,entry.tier).target){const def=goal(id,entry.tier);entry.progress-=def.target;entry.tier++;
  w.money+=def.reward;w.intel+=def.intel;w.reputation+=def.reputation;earned++;
  log?.(`🌟 Objetivo coletivo completo: ${def.name} — nível ${entry.tier-1}. Recompensas: +${def.reward} créditos, +${def.intel} pesquisa e +${def.reputation} reputação.`);
 }return earned;
}
module.exports={GOALS,init,goal,advance};
