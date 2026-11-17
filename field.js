'use strict';
// Expedições de campo com progressão real: três levantamentos em setores separados.
// Recebe apenas coordenadas ARREDONDADAS para quadrículas de ~180–200m; nunca as coordenadas exatas.
// Não é uma prova antifraude criptográfica: um cliente modificado pode fabricar dados de GPS.
const crypto=require('crypto');
const CELL=0.0018;
const KINDS={
 infra:{name:'Cartografia viva',emoji:'🧭',intro:'Identifique conexões, levante um corredor e valide uma rota.',steps:['Marque o início de uma rota segura','Caminhe até outro setor e faça o levantamento','Valide um terceiro setor para fechar o corredor']},
 comercio:{name:'Pulso comercial',emoji:'📦',intro:'Mapeie a movimentação regional e identifique oportunidades de abastecimento.',steps:['Observe a dinâmica do primeiro setor público','Compare o movimento comercial em outra área','Confirme as necessidades de um terceiro setor']},
 natureza:{name:'Observatório verde',emoji:'🌿',intro:'Investigue a diversidade de ambientes urbanos e naturais.',steps:['Registre o primeiro ponto de observação','Caminhe a outro setor e amplie o levantamento','Feche um trajeto com mais uma observação']}
};
const PROJECTS={
 cartografia:{name:'Rede de cartografia comunitária',kind:'infra',cost:2,money:170,bonus:'Piloto automático 15% mais veloz.'},
 feira:{name:'Feira cooperativa itinerante',kind:'comercio',cost:3,money:230,bonus:'Contratos concluídos pagam 10% a mais.'},
 observatorio:{name:'Observatório de recursos',kind:'natureza',cost:4,money:290,bonus:'Recursos naturais regeneram mais rápido.'}
};
const MAX_DAY=3,EXPIRY_MS=2*60*60*1000,MIN_GAP_MS=65000,MAX_ACCURACY=85,MIN_METERS=330;
const cellsToMeters=(a,b)=>{const deg=Math.PI/180,lat1=(a.y+.5)*CELL*deg,lat2=(b.y+.5)*CELL*deg,dlat=lat2-lat1,dlon=(b.x-a.x)*CELL*deg,h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)))};
function create(){return {signals:0,completed:0,themeCounts:{infra:0,comercio:0,natureza:0},visited:[],projects:{cartografia:false,feira:false,observatorio:false},history:[],combos:0,landmarks:[],poiHistory:[],atlas:[],atlasMilestones:[]}}
function migrate(w){w.field??=create();const f=w.field;f.signals=Number.isSafeInteger(f.signals)&&f.signals>=0?f.signals:0;f.completed??=0;f.visited??=[];f.history??=[];f.poiHistory??=[];f.landmarks??=[];f.atlas??=[];f.atlasMilestones??=[];f.combos??=0;f.themeCounts??={infra:0,comercio:0,natureza:0};f.projects??={cartografia:false,feira:false,observatorio:false};for(const k of Object.keys(PROJECTS))f.projects[k]??=false;
 for(const p of Object.values(w.players||{})){p.fieldExpedition??=null;p.fieldDecision??=null;p.fieldRuns??=0;p.fieldDay??='';p.fieldToday??=0;p.poiDay??='';p.poiToday??=0;p.poiTotal??=0;p.lastPoi??=0;p.poiLastCell??=null;if(p.poiDay!==dayKey(Date.now()))p.poiLastCell=null;}
 return f;}
function guardCell(cell){if(!cell||!Number.isInteger(cell.x)||!Number.isInteger(cell.y)||Math.abs(cell.x)>100000||Math.abs(cell.y)>50000)throw Error('Quadrícula GPS inválida.');const lat=(cell.y+.5)*CELL,lng=(cell.x+.5)*CELL;if(lat< -85||lat>85||lng< -180||lng>180)throw Error('Coordenadas fora do mapa.');return {x:cell.x,y:cell.y};}
function dayKey(now){return new Date(now).toISOString().slice(0,10)}
function todayCount(p,now){return p.fieldDay===dayKey(now)?(p.fieldToday||0):0}
function start(w,p,kind,now=Date.now()){
 if(!KINDS[kind])throw Error('Escolha um levantamento válido.');
 if(p.fieldExpedition&&p.fieldExpedition.expires>now)throw Error('Finalize a expedição atual antes de iniciar outra.');
 if(todayCount(p,now)>=MAX_DAY)throw Error('Você já concluiu três expedições hoje. Volte amanhã.');
 p.fieldExpedition={id:crypto.randomBytes(8).toString('hex'),kind,started:now,expires:now+EXPIRY_MS,steps:[],lastAt:0};
 return {message:`Expedição “${KINDS[kind].name}” iniciada. ${KINDS[kind].steps[0]}`};
}
function abandon(p){if(!p.fieldExpedition)throw Error('Nenhuma expedição para encerrar.');p.fieldExpedition=null;return {message:'Expedição encerrada; nenhum progresso de outras pessoas foi perdido.'};}
function publicPlayer(p,now=Date.now()){
 const e=p.fieldExpedition,active=e&&e.expires>now?e:null;
 return {active:!!active,id:active?.id||null,kind:active?.kind||null,steps:active?.steps.length||0,expires:active?.expires||0,runs:p.fieldRuns||0,today:todayCount(p,now),maxToday:MAX_DAY};
}
function privateStatus(p){const st=publicPlayer(p);const last=p?.fieldExpedition?.steps?.at(-1);return {...st,nextAfter:last?last.time+MIN_GAP_MS:0,lastCell:last?{...last.cell}:null,decision:p.fieldDecision?{id:p.fieldDecision.id,kind:p.fieldDecision.kind}:null};}
function publicBoard(w){const f=migrate(w);return {signals:f.signals,completed:f.completed,combos:f.combos,themeCounts:f.themeCounts,projects:f.projects,visitedCount:f.visited.length,landmarkCount:f.landmarks.length,atlas:f.atlas.slice(),atlasMilestones:f.atlasMilestones.slice(),poiHistory:f.poiHistory.slice(-10),history:f.history.slice(-12)}}
function step(w,p,input,now=Date.now()){
 const e=p.fieldExpedition;if(!e||e.expires<=now){p.fieldExpedition=null;throw Error('A expedição expirou. Inicie uma nova.');}
 if(todayCount(p,now)>=MAX_DAY)throw Error('Limite diário de expedições concluídas.');
 if(input.id!==e.id)throw Error('Esta etapa pertence a outra expedição.');
 const acc=Number(input.accuracy),age=Number(input.ageMs),speed=input.speed==null?null:Number(input.speed);
 if(!Number.isFinite(acc)||acc<0||acc>MAX_ACCURACY)throw Error('Precisão insuficiente. Tente ao ar livre quando o GPS estiver estável (até 85 m).');
 if(!Number.isFinite(age)||age<0||age>30000)throw Error('Leitura de GPS antiga. Atualize sua posição.');
 if(speed!==null&&(!Number.isFinite(speed)||speed<0||speed>5.5))throw Error('Levantamento disponível somente parado ou caminhando, nunca em veículo.');
 const cell=guardCell(input.cell);const previous=e.steps[e.steps.length-1];
 if(e.steps.some(s=>s.cell.x===cell.x&&s.cell.y===cell.y))throw Error('Você já registrou esse setor na expedição. Caminhe para outro.');
 if(previous){const elapsed=now-previous.time;if(elapsed<MIN_GAP_MS)throw Error(`Aguarde mais ${Math.ceil((MIN_GAP_MS-elapsed)/1000)} s e caminhe com segurança até outro setor.`);
  const meters=cellsToMeters(previous.cell,cell);if(meters<MIN_METERS)throw Error('Setor muito próximo. Explore outro setor público: a separação geográfica mínima entre centros de setores é de 330 m.');
  if(meters/(elapsed/1000)>5.5)throw Error('Deslocamento incompatível com uma exploração a pé.');
 }
 const h=crypto.createHash('sha256').update(`${w.code}|field-v1|${cell.x}|${cell.y}`).digest('hex');
 const newSector=!w.field.visited.includes(h);if(newSector){w.field.visited.push(h);w.field.visited=w.field.visited.slice(-3000)}
 e.steps.push({cell,time:now,newSector});e.lastAt=now;
 if(e.steps.length<3)return {finished:false,step:e.steps.length,newSector,message:`Etapa ${e.steps.length}/3 registrada${newSector?' · setor inédito':''}. ${KINDS[e.kind].steps[e.steps.length]}`};
 const walked=cellsToMeters(e.steps[0].cell,e.steps[1].cell)+cellsToMeters(e.steps[1].cell,e.steps[2].cell);
 const firstTime=e.steps.filter(s=>s.newSector).length;
 const signals=firstTime>=2?2:1;
 w.field.signals+=signals;w.field.completed++;w.field.themeCounts[e.kind]=(w.field.themeCounts[e.kind]||0)+1;
 const diversity=Math.min(...Object.keys(KINDS).map(k=>w.field.themeCounts[k]||0));
 const synergy=diversity>w.field.combos;if(synergy){w.field.combos=diversity;w.field.signals+=2;w.money+=240;w.reputation+=10;}
 w.money+=120+firstTime*15;w.intel+=3;w.reputation+=6;
 const previousToday=todayCount(p,now);p.fieldRuns++;p.fieldDay=dayKey(now);p.fieldToday=previousToday+1;p.fieldExpedition=null;
 p.fieldDecision={id:crypto.randomBytes(7).toString('hex'),kind:e.kind,createdAt:now};
 const record={id:crypto.randomBytes(6).toString('hex'),by:p.name,player:p.id,kind:e.kind,time:now,meters:Math.round(walked),newSectors:firstTime,signals};
 w.field.history.push(record);w.field.history=w.field.history.slice(-24);
 return {finished:true,step:3,newSector,signals,synergy,kind:e.kind,firstTime,walked:Math.round(walked),message:`Expedição concluída! ${Math.round(walked)} m explorados, +${signals} sinal(is) de campo, +3 pesquisas e +${120+firstTime*15} créditos.${synergy?' Equipe completou os três tipos: +2 sinais e +240 créditos!':''}`};
}
function build(w,key){const pr=PROJECTS[key];if(!pr)throw Error('Projeto de campo inexistente.');const f=migrate(w);if(f.projects[key])throw Error('Este projeto já está operando.');if(!f.themeCounts[pr.kind])throw Error('Conclua uma expedição do tema correspondente primeiro.');if(f.signals<pr.cost||w.money<pr.money)throw Error('Faltam sinais de campo ou créditos.');
 f.signals-=pr.cost;w.money-=pr.money;f.projects[key]=true;w.reputation+=12;return {message:`${pr.name} entrou em operação! ${pr.bonus}`};
}
function distancePointToCell(poi,cell){const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const lat=clamp(poi.lat,cell.y*CELL,(cell.y+1)*CELL),lng=clamp(poi.lng,cell.x*CELL,(cell.x+1)*CELL);const deg=Math.PI/180,dl=(poi.lat-lat)*deg,dc=(poi.lng-lng)*deg;const h=Math.sin(dl/2)**2+Math.cos(poi.lat*deg)*Math.cos(lat*deg)*Math.sin(dc/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));}
const POI_CATEGORIES={park:'natureza',garden:'natureza',library:'comercio',marketplace:'comercio',community:'comercio',viewpoint:'infra'};
// Cada categoria alimenta uma parte diferente do simulador, evitando check-ins indistinguíveis.
// Atlas compartilha somente categorias, nunca coordenadas ou identificadores de locais reais.
function poiEffect(w,category){
 if(category==='park'||category==='garden'){
  const change=category==='park'?7:5;
  const restored=(w.nodes||[]).reduce((sum,n)=>{const old=n.stock;n.stock=Math.min(n.max,n.stock+change);return sum+n.stock-old},0);
  return restored?`Fontes naturais recuperaram ${restored} unidades.`:'As fontes naturais já estão recuperadas.';
 }
 if(category==='library'){w.intel+=3;return 'Biblioteca: +3 pesquisas de conhecimento regional.';}
 if(category==='marketplace'){
  let choice=null;
  for(const town of w.towns||[])for(const [type,target] of Object.entries(town.target||{})){
   const missing=Math.max(0,target-(town.stock?.[type]||0));
   if(!choice||missing>choice.missing)choice={town,type,missing};
  }
  if(!choice||!choice.missing){w.money+=30;return 'Mercado abastecido: +30 créditos de comércio.';}
  const qty=Math.min(5,choice.missing);choice.town.stock[choice.type]=(choice.town.stock[choice.type]||0)+qty;
  choice.town.prosperity=Math.min(100,(choice.town.prosperity||0)+2);
  return `Mercado: ${qty} unidades de ${choice.type} disponíveis em ${choice.town.name}.`;
 }
 if(category==='community'){
  const town=(w.towns||[]).slice().sort((a,b)=>a.prosperity-b.prosperity)[0];
  if(town){town.prosperity=Math.min(100,(town.prosperity||0)+7);return `Centro comunitário: ${town.name} ganhou 7 pontos de prosperidade.`;}
  w.reputation+=3;return 'Centro comunitário: +3 de reputação.';
 }
 w.intel+=2;w.money+=45;return 'Mirante: +2 pesquisas e +45 créditos de cartografia.';
}

function visitPoint(w,p,input,now=Date.now()){
 const category=String(input.category||'');if(!POI_CATEGORIES[category])throw Error('Categoria de local desconhecida.');
 const id=String(input.poiId||'');if(!/^(node|way|relation)\/[0-9]{1,16}$/.test(id))throw Error('Identificador cartográfico inválido.');
 const poi=input.poi;if(!poi||!Number.isFinite(poi.lat)||!Number.isFinite(poi.lng)||Math.abs(poi.lat)>85||Math.abs(poi.lng)>180)throw Error('Ponto de interesse inválido.');
 const cell=guardCell(input.cell),acc=Number(input.accuracy),age=Number(input.ageMs),speed=input.speed==null?null:Number(input.speed);
 if(!Number.isFinite(acc)||acc>MAX_ACCURACY||acc<0||!Number.isFinite(age)||age<0||age>30000||speed!==null&&(!Number.isFinite(speed)||speed<0||speed>5.5))throw Error('Atualize o GPS a pé, com boa precisão, para validar o local.');
 
 if(distancePointToCell(poi,cell)>180)throw Error('Você está longe deste local. Aproxime-se apenas por vias públicas e acessíveis.');
 const hash=crypto.createHash('sha256').update(`${w.code}|osm-poi|${id}`).digest('hex');
 if(w.field.landmarks.includes(hash))throw Error('Este ponto já foi descoberto pela cooperativa. Visite outro local.');
 const day=dayKey(now),today=p.poiDay===day?p.poiToday||0:0;
 if(today>=2)throw Error('Limite de duas descobertas de locais por dia.');
 if(now-(p.lastPoi||0)<60000)throw Error('Aguarde um minuto entre descobertas e explore um novo local.');
 if(p.poiLastCell&&p.poiDay===day&&cellsToMeters(p.poiLastCell,cell)<145)throw Error('Este local é muito próximo do anterior. Explore outra área pública.');
 w.field.landmarks.push(hash);w.field.landmarks=w.field.landmarks.slice(-3000);
 p.poiDay=day;p.poiToday=today+1;p.poiTotal++;p.lastPoi=now;p.poiLastCell=cell;
 w.field.signals++;w.intel++;w.money+=45;w.reputation+=2;
 const firstCategory=!w.field.atlas.includes(category);
 if(firstCategory)w.field.atlas.push(category);
 const effect=poiEffect(w,category);
 let milestone='';
 for(const [required,signals,credits,research] of [[3,2,250,2],[6,4,650,6]]){
  if(w.field.atlas.length>=required&&!w.field.atlasMilestones.includes(required)){
   w.field.atlasMilestones.push(required);w.field.signals+=signals;w.money+=credits;w.intel+=research;
   milestone+=` Atlas ${required}/6 completo: +${signals} sinais, +${credits} créditos e +${research} pesquisas!`;
  }
 }
 const kind=POI_CATEGORIES[category],record={by:p.name,player:p.id,category,kind,time:now};
 w.field.poiHistory.push(record);w.field.poiHistory=w.field.poiHistory.slice(-15);
 return {kind,message:`Novo local público descoberto! +1 sinal de campo, +1 pesquisa e +45 créditos. ${effect}${firstCategory?' Nova categoria no Atlas Vivo!':''}${milestone}`};
}
// Decisão de campo opcional após cada caminhada. Aplica efeitos apenas uma vez no servidor.
// O identificador não revela nenhuma posição; somente o dono da sessão recebe a decisão.
const DECISIONS={
 infra:{title:'Um novo corredor foi identificado',story:'O levantamento revelou opções de infraestrutura. Qual prioridade você transmite para a equipe?',
  options:[{id:'materiais',label:'Recuperar materiais',detail:'+2 unidades de metal no depósito'},{id:'pesquisa',label:'Analisar o traçado',detail:'+3 pontos de pesquisa'}]},
 comercio:{title:'Uma cidade precisa de ajuda',story:'Seus registros revelaram uma demanda regional. Como a cooperativa deve responder?',
  options:[{id:'capital',label:'Negociar fornecimento',detail:'+150 créditos para a equipe'},{id:'socorro',label:'Apoiar a cidade',detail:'+9 de prosperidade à cidade com maior necessidade'}]},
 natureza:{title:'Um ecossistema surpreendente',story:'A equipe descobriu um caminho para ajudar os recursos naturais. Qual oportunidade aproveitar?',
  options:[{id:'recuperar',label:'Recuperar fontes',detail:'+12 de estoque em cada fonte'},{id:'estudar',label:'Registrar conhecimento',detail:'+3 pontos de pesquisa'}]}
};
function resolveDecision(w,p,id,choice){
 const pending=p.fieldDecision;
 if(!pending||pending.id!==id)throw Error('Esta decisão de campo já foi encerrada.');
 const kind=pending.kind,def=DECISIONS[kind];
 if(!def||!['ignore',...def.options.map(o=>o.id)].includes(choice))throw Error('Escolha uma opção válida.');
 // Cada caso valida previamente as estruturas necessárias para não consumir decisão em erro.
 if(choice==='socorro'&&(!Array.isArray(w.towns)||!w.towns.length))throw Error('Nenhuma cidade disponível.');
 if(choice==='recuperar'&&!Array.isArray(w.nodes))throw Error('Fontes indisponíveis.');
 let message='Decisão de campo ignorada sem penalidade.';
 if(choice==='materiais'){w.inventory.metal=(w.inventory.metal||0)+2;message='A cooperativa recuperou +2 metais para os projetos.';}
 if(choice==='pesquisa'||choice==='estudar'){w.intel+=3;message='O levantamento acrescentou +3 pesquisas à equipe.';}
 if(choice==='capital'){w.money+=150;message='Um acordo regional trouxe +150 créditos para a equipe.';}
 if(choice==='socorro'){const t=w.towns.slice().sort((a,b)=>(a.prosperity||0)-(b.prosperity||0))[0];t.prosperity=Math.min(100,(t.prosperity||0)+9);message=`${t.name} recebeu apoio e ganhou 9 pontos de prosperidade.`;}
 if(choice==='recuperar'){let gain=0;for(const n of w.nodes){const prev=n.stock;n.stock=Math.min(n.max,n.stock+12);gain+=n.stock-prev;}message=`As fontes da região recuperaram ${gain} unidades de recursos.`;}
 p.fieldDecision=null;
 return {message};
}
const DISPATCHES={
 rota:{name:'Mapear demanda urgente',cost:1,description:'Cria um contrato de campo para a equipe entregar no mundo virtual.'},
 reflorestamento:{name:'Recuperar recursos',cost:1,description:'Aumenta em até 15 unidades o estoque de cada fonte de coleta.'},
 cidades:{name:'Mutirão de abastecimento',cost:2,description:'Melhora em 12 pontos a prosperidade da cidade mais necessitada.'}
};
function dispatch(w,key){const x=DISPATCHES[key];if(!x)throw Error('Ação de campo desconhecida.');const f=migrate(w);
 if(f.signals<x.cost)throw Error('Faltam sinais de campo. Caminhe e conclua mais expedições.');
 if(key==='rota'&&w.missions.length>=4)throw Error('Há operações demais em aberto. Conclua uma antes de liberar outra.');
 if(key==='reflorestamento'&&!w.nodes.some(n=>n.stock<n.max))throw Error('Fontes com estoque cheio. Use este sinal quando houver necessidade.');
 if(key==='cidades'&&!w.towns.some(t=>(t.prosperity||0)<95))throw Error('As cidades já estão prósperas. Guarde os sinais para outra ocasião.');
 f.signals-=x.cost;
 if(key==='reflorestamento')for(const n of w.nodes)n.stock=Math.min(n.max,n.stock+15);
 if(key==='cidades'){const town=w.towns.slice().sort((a,b)=>a.prosperity-b.prosperity)[0];town.prosperity=Math.min(100,town.prosperity+12);return {key,message:`Mutirão fortaleceu ${town.name}: +12 de prosperidade.`};}
 return {key,message:key==='rota'?'Dados de campo liberaram uma nova operação de abastecimento.':'As equipes recuperaram recursos para as fontes da região.'};
}
module.exports={DECISIONS,resolveDecision,CELL,KINDS,PROJECTS,DISPATCHES,POI_CATEGORIES,visitPoint,MAX_DAY,MIN_GAP_MS,MIN_METERS,create,migrate,start,abandon,step,build,dispatch,publicBoard,publicPlayer,privateStatus,cellsToMeters,distancePointToCell};
