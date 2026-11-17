'use strict';
// Missões curtas que nascem tanto de GPS quanto de expedições virtuais.
const MISSIONS={
 infra:[{title:'Manutenção de vias',resource:'metal',qty:3,town:'palmeiras',description:'Uma rota comercial precisa de novas estruturas.'},{title:'Reforço de pontes',resource:'tabuas',qty:4,town:'lago',description:'As equipes locais precisam de materiais para reforçar travessias.'}],
 comercio:[{title:'Feira regional',resource:'tabuas',qty:4,town:'palmeiras',description:'Pequenos comerciantes precisam de bancadas e estruturas.'},{title:'Rede de oficinas',resource:'sucata',qty:6,town:'serra',description:'Oficinas locais precisam de peças reutilizáveis.'}],
 natureza:[{title:'Revitalizar a reserva',resource:'madeira',qty:5,town:'serra',description:'Manutenção controlada de trilhas e passarelas.'},{title:'Coleta de recicláveis',resource:'sucata',qty:5,town:'lago',description:'A comunidade organiza uma campanha de reaproveitamento.'}]
};
function grantMission(w,kind,log,by){if(!MISSIONS[kind]||w.missions.length>=4)return null;
 const pool=MISSIONS[kind];const def=pool[(w.missionSeq-1)%pool.length];
 if(w.missions.some(m=>m.title===def.title))return null;
 const mission={id:w.missionSeq++,kind,...def,reward:150+def.qty*24,deadlineDay:w.day+18,createdBy:by};
 w.missions.push(mission);log?.(`📌 Nova operação: ${mission.title}. Descoberta de ${by} gerou um serviço coletivo.`);return mission;
}
function expireMissions(w,log){const before=w.missions.length;w.missions=w.missions.filter(m=>!m.deadlineDay||m.deadlineDay>=w.day);
 const count=before-w.missions.length;if(count)log?.(`⌛ ${count} oportunidade(s) de campo encerradas. Novas descobertas podem gerar mais.`);return count;
}
module.exports={MISSIONS,grantMission,expireMissions};
