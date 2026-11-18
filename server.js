'use strict';
// Rotas Vivas — servidor HTTP + WebSocket, sem dependências externas.
// Protótipo de 4 pessoas; NÃO é uma implementação de segurança de produção.
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {graph,pathFor,distance}=require('./roads');
const ECO=require('./economy');
const {grantMission,expireMissions}=require('./missions');
const PROGRESSION=require('./progression');
const FIELD=require('./field');
const {loadNetwork,buildAdjacency,routeOnNetwork}=require('./osmroads');
const NAV=require('./navigation');
const REMOTE_EXPEDITION_MS=Math.max(1000,Math.min(3600000,Number(process.env.REMOTE_EXPEDITION_MS)||12*60*1000));
const DRIVE_SPEED_OVERRIDE=Number(process.env.DRIVE_SPEED)>0;
const DRIVE_SPEED=Math.max(5,Math.min(5000,Number(process.env.DRIVE_SPEED)||13));
const ECONOMY_STEP_MS=Math.max(1000,Math.min(600000,Number(process.env.ECONOMY_STEP_MS)||120000));
const PORT=Number(process.env.PORT||3000);
const ROOT=path.join(__dirname,'public');
const DATA=path.resolve(process.env.DATA_DIR||path.join(__dirname,'data'));
fs.mkdirSync(DATA,{recursive:true});
const OSM_ROADS=loadNetwork(path.join(DATA,'osm-network.json'));
const OSM_ADJ=OSM_ROADS?buildAdjacency(OSM_ROADS):null;
const rooms=new Map();
const sockets=new Set();
const BASE={lat:-23.8299,lng:-46.7198};
const TOWNS=[
 {id:'palmeiras',name:'Vila das Palmeiras',lat:-23.8107,lng:-46.6884,emoji:'🏘️',factor:1.12},
 {id:'serra',name:'Alto da Serra',lat:-23.8498,lng:-46.6897,emoji:'🏙️',factor:1.30},
 {id:'lago',name:'Porto do Lago',lat:-23.8421,lng:-46.7553,emoji:'⚓',factor:1.20}
];
const NODES=[
 {id:'bosque',name:'Reserva do Cedro',type:'madeira',lat:-23.8041,lng:-46.7356,emoji:'🌲',max:90},
 {id:'pedreira',name:'Pedreira Aurora',type:'minerio',lat:-23.8561,lng:-46.7154,emoji:'⛏️',max:80},
 {id:'reciclagem',name:'Pátio de Reuso',type:'sucata',lat:-23.8224,lng:-46.7638,emoji:'♻️',max:85}
];
const PROJECTS=[
 {id:'ponte',name:'Ponte das Conexões',emoji:'🌉',kind:'infra',lat:-23.8366,lng:-46.7425,
  description:'Abra uma ligação curta entre o depósito e o Porto do Lago.',need:{madeira:10,metal:5},fund:240,intel:3},
 {id:'terminal',name:'Terminal Regional',emoji:'🚉',kind:'comercio',lat:-23.8125,lng:-46.7050,
  description:'Aumenta o pagamento dos contratos em 15%.',need:{tabuas:8,sucata:8},fund:360,intel:3},
 {id:'pesquisa',name:'Estação Ambiental',emoji:'🔬',kind:'natureza',lat:-23.8461,lng:-46.7068,
  description:'Acelera a recuperação dos pontos de coleta.',need:{tabuas:8,metal:4},fund:320,intel:4}
];
const UPGRADES={fleet:{label:'Carroceria reforçada',money:520,metal:3,intel:2,description:'Capacidade de todos os caminhões: +12.'},navigation:{label:'Central de navegação',money:450,metal:2,intel:3,description:'Piloto automático 35% mais rápido.'},network:{label:'Rede de distribuição',money:560,tabuas:6,intel:4,description:'Venda em todos os mercados: +8%.'}};
const DISCOVERY={infra:'Infraestrutura',comercio:'Comércio regional',natureza:'Meio ambiente'};
const RES={madeira:{name:'Madeira',emoji:'🪵',price:15},minerio:{name:'Minério',emoji:'🪨',price:22},sucata:{name:'Sucata',emoji:'🔩',price:18},tabuas:{name:'Tábuas',emoji:'🪚',price:48},metal:{name:'Metal',emoji:'⚙️',price:65}};
const CONTRACT_CYCLE=[['palmeiras','tabuas',6],['serra','metal',5],['lago','madeira',12],['palmeiras','metal',3],['serra','tabuas',9],['lago','sucata',11],['palmeiras','madeira',13],['lago','metal',6]];
let saveDirty=new Set();
function effect(ws,kind,message,resource=null,amount=0){send(ws,{type:'effect',kind,message,resource,amount});}
function log(world,message){world.logs.unshift({time:Date.now(),text:message});world.logs=world.logs.slice(0,28)}
function createWorld(code){
 const world={code,createdAt:Date.now(),updatedAt:Date.now(),money:1100,reputation:0,intel:0,day:1,priceWave:0,
  inventory:{madeira:14,minerio:6,sucata:10,tabuas:0,metal:0},field:FIELD.create(),factories:{serraria:false,fundicao:false,logistica:false},factoryActive:{serraria:false,fundicao:false},upgrades:{fleet:false,navigation:false,network:false},missions:[],missionSeq:1,pings:[],chat:[],initiatives:PROGRESSION.init({}),
  nodes:NODES.map(n=>({...n,stock:n.max})),towns:TOWNS.map(t=>ECO.initTown({...t,delivered:0,priceFactor:1})),
  players:{},contracts:[],contractSeq:1,scanned:[],discoveries:{infra:0,comercio:0,natureza:0},surveys:0,projects:PROJECTS.map(pr=>({...pr,delivered:{},funded:false,completed:false})),milestones:{},event:null,logs:[],lastEconomy:Date.now(),lastProduction:Date.now()};
  addContract(world);addContract(world);addContract(world);
  log(world,'A cooperativa recebeu um depósito, um caminhão por jogador e recursos iniciais.');
  return world;
}
function addContract(w){return ECO.addContract(w,CONTRACT_CYCLE,RES);}
function upgradeWorld(w){
 // Migração de salvamentos existentes da Alfa 0.1 sem perda de estoque, contratos ou progresso.
 w.factoryActive??={serraria:false,fundicao:false};w.discoveries??={infra:0,comercio:0,natureza:0};
 w.surveys??=0;w.milestones??={};w.campaign??={chapter:1,finished:[]};w.campaign.chapter??=1;w.campaign.finished??=[];w.event??=null;w.owner??=Object.keys(w.players||{})[0]||null;
 FIELD.migrate(w);w.upgrades??={fleet:false,navigation:false,network:false};w.pings??=[];w.chat??=[];w.missions??=[];PROGRESSION.init(w);w.missionSeq??=Math.max(1,...w.missions.map(m=>m.id+1));
 w.towns.forEach(t=>ECO.initTown(t));for(const c of w.contracts)c.deadlineDay??=w.day+35;
 w.projects??=PROJECTS.map(pr=>({...pr,delivered:{},funded:false,completed:false}));
 for(const pr of PROJECTS){let existing=w.projects.find(x=>x.id===pr.id);if(!existing)w.projects.push({...pr,delivered:{},funded:false,completed:false});
  else{Object.assign(existing,{...pr,delivered:existing.delivered||{},funded:!!existing.funded,completed:!!existing.completed});}}
 for(const player of Object.values(w.players)){player.surveys??=0;player.gpsDiscoveries??=0;player.remoteExpedition??=null;
  if(player.route&&!Array.isArray(player.route.points))player.route=null;
  player.mode??='pc';}
 return w;
}

function advanceCampaign(w){
 const c=w.campaign||(w.campaign={chapter:1,finished:[]});
 const d=w.towns.reduce((a,t)=>a+(t.delivered||0),0);
 const works=w.projects.filter(p=>p.completed).length;
 const level=c.chapter||1;
 let done=false,title='';
 if(level===1&&w.milestones.primeiraProducao&&w.milestones.primeiraEntrega){done=true;title='Primeira rede de abastecimento';}
 if(level===2&&d>=35&&works>=1){done=true;title='Primeira ligação regional';}
 if(level===3&&w.towns.every(t=>t.prosperity>=65)&&works>=2){done=true;title='Cidades fortalecidas';}
 if(done){c.finished.push({chapter:level,title,at:Date.now()});c.chapter=level+1;w.money+=320;w.intel+=3;w.reputation+=15;
  log(w,'🏅 Capítulo '+level+' concluído: '+title+'! +320 créditos, +3 pesquisas e +15 reputação.');dirty(w);}
}
function rewardMilestone(w,id,message,credits,reputation=0,intel=0){
 if(w.milestones[id])return;w.milestones[id]=true;w.money+=credits;w.reputation+=reputation;w.intel+=intel;
 log(w,`🏆 Marco alcançado: ${message} (+${credits} créditos${intel?', +'+intel+' pesquisa':''}).`);
}
function unlockDiscovery(w,kind,by){w.discoveries[kind]=(w.discoveries[kind]||0)+1;
 grantMission(w,kind,text=>log(w,text),by);
 const pr=w.projects.find(p=>p.kind===kind);if(w.discoveries[kind]===1)log(w,`🗺️ ${by} descobriu um projeto: ${pr.name}!`);
 else log(w,`🧭 ${by} ampliou o levantamento de ${DISCOVERY[kind].toLowerCase()}.`);
}
function completeProject(w,project,by){if(project.completed||!project.funded)return;
 if(Object.entries(project.need).some(([res,qty])=>(project.delivered[res]||0)<qty))return;
 project.completed=true;w.reputation+=22;log(w,`🎉 ${by} concluiu ${project.name}! ${project.description}`);
 rewardMilestone(w,'primeiroProjeto','primeiro projeto regional',180,12);
}
function loadWorld(code){if(rooms.has(code))return rooms.get(code);
 let world;const file=path.join(DATA,code+'.json');
 try{world=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')world=createWorld(code);else throw Error('Não foi possível carregar a sala com segurança. Salve uma cópia do arquivo e verifique sua integridade.');}
 world=upgradeWorld(world);for(let p of Object.values(world.players)){p.online=false;p.route=null;}
 rooms.set(code,world);return world;
}
function dirty(w){w.updatedAt=Date.now();saveDirty.add(w.code);}
function save(){for(const code of [...saveDirty]){const w=rooms.get(code);if(!w){saveDirty.delete(code);continue;}const f=path.join(DATA,code+'.json');const tmp=f+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(w));fs.renameSync(tmp,f);saveDirty.delete(code)}catch(e){console.error('Falha ao salvar sala',code,e.message)}}}
setInterval(save,1800).unref();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{save();process.exit(0)});
function dist(a,b){const R=6371000,dr=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180;const h=Math.sin(dr/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function near(p,target){return dist(p,target)<=320}
async function planTo(w,p,target){
 const sites=[{id:'base',...BASE},...w.nodes,...w.towns,...w.projects];
 const hasBridge=!!w.projects.find(x=>x.id==='ponte')?.completed;
 // Ponte construída continua criando um atalho fictício especial.
 const real=!(hasBridge&&target.id==='lago')?await NAV.fetchDrivingRoute(p,target):null;
 return real||(OSM_ROADS&&routeOnNetwork(p,target,OSM_ROADS,sites,hasBridge,OSM_ADJ))||pathFor(p,target.id,sites,hasBridge);
}
function commitRoute(p,target,planned){
 const r=NAV.enrichRoute(p,planned);
 p.route={id:target.id,lat:target.lat,lng:target.lng,points:r.points,index:0,meters:r.meters,source:r.source||'virtual',durationSeconds:r.durationSeconds,pace:r.pace};
}
function capText(s,n){return String(s||'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,n)}
function ensurePlayer(ws){if(!ws.player||!ws.world||!ws.world.players[ws.player])throw Error('Entre em uma sala primeiro.');return ws.world.players[ws.player]}
function inventoryQty(o){return Object.values(o).reduce((a,b)=>a+b,0)}
function price(w,t,type){return ECO.townPrice(w,t,type,RES)}
function activeCount(w){return Object.values(w.players).filter(p=>p.online).length}
function safeWorld(w){const {scanned,field:privateField,...rest}=w;const sites=[{id:'base',...BASE},...w.nodes,...w.towns,...w.projects];const road=OSM_ROADS?{points:{},edges:[]}:graph(sites,!!w.projects.find(p=>p.id==='ponte')?.completed);return {...rest,routeSpeed:DRIVE_SPEED,field:FIELD.publicBoard(w),roads:road,roadMode:OSM_ROADS?'osm':'virtual',markets:Object.fromEntries(w.towns.map(t=>[t.id,Object.fromEntries(Object.keys(RES).map(r=>[r,price(w,t,r)]))])),players:Object.fromEntries(Object.entries(w.players).map(([id,p])=>{const {token,lastGps,lastVirtual,lastManual,lastChat,lastPing,fieldExpedition,fieldDecision,poiLastCell,...safe}=p;return [id,{...safe,fieldStatus:FIELD.publicPlayer(p)}]}))}}
function packJSON(obj){const data=Buffer.from(JSON.stringify(obj));if(data.length>65536)throw Error('Payload grande');let h;if(data.length<126){h=Buffer.from([0x81,data.length])}else if(data.length<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(data.length,2)}else{h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(data.length),2)}return Buffer.concat([h,data])}
function send(ws,obj){if(ws.socket&&!ws.socket.destroyed){try{ws.socket.write(packJSON(obj))}catch{}}}
function broadcast(w){advanceCampaign(w);const snapshot=safeWorld(w);for(const ws of sockets)if(ws.world?.code===w.code)send(ws,{type:'state',you:ws.player,world:snapshot,online:activeCount(w),myField:ws.player?FIELD.privateStatus(w.players[ws.player]):null})}
function toast(ws,message,error=false){send(ws,{type:'notice',message,error})}
function connect(ws,msg){const code=String(msg.room||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
 const name=capText(msg.name,20);const token=capText(msg.token,80);
 if(!/^[A-Z0-9]{4,8}$/.test(code)||name.length<2)throw Error('Informe um nome e uma sala de 4 a 8 caracteres.');
 if(ws.world&&ws.player)throw Error('Esta conexão já entrou em uma sala.');
 const w=loadWorld(code);
 let player=Object.values(w.players).find(p=>p.token===token&&token.length>20);
 if(!player){if(Object.keys(w.players).length>=4)throw Error('Esta sala já tem quatro jogadores.');let id=crypto.randomBytes(6).toString('hex');player={id,name,token:crypto.randomBytes(24).toString('hex'),lat:BASE.lat,lng:BASE.lng,cargo:{},route:null,online:true,lastManual:0,lastGps:0,lastVirtual:0,lastChat:0,lastPing:0,scans:0,surveys:0,gpsDiscoveries:0,fieldExpedition:null,fieldRuns:0,fieldDay:'',fieldToday:0};w.players[id]=player;}
 for(const other of sockets)if(other!==ws&&other.world?.code===code&&other.player===player.id){send(other,{type:'notice',message:'Sua sessão foi aberta em outra janela.',error:true});other.socket.end();}
 player.name=name;player.online=true;player.mode='pc';if(!w.owner)w.owner=player.id;ws.world=w;ws.player=player.id;
 send(ws,{type:'joined',token:player.token,room:code});log(w,`${name} entrou na cooperativa.`);dirty(w);broadcast(w);
}
async function act(ws,msg){const w=ws.world;const p=ensurePlayer(ws);const type=msg.action;
 if(type==='setMode'){
  const next=String(msg.mode||'');if(!['pc','gps'].includes(next))throw Error('Modo inválido.');
  if(p.mode!==next){p.mode=next;dirty(w);broadcast(w);}return;
 }
 if(type==='chat'){
  if(Date.now()-(p.lastChat||0)<1500)throw Error('Aguarde antes de enviar outra mensagem.');
  const message=capText(msg.message,160);if(!message||message.length<2)throw Error('Digite uma mensagem de pelo menos dois caracteres.');
  p.lastChat=Date.now();w.chat.push({id:crypto.randomBytes(5).toString('hex'),by:p.name,player:p.id,message,time:Date.now()});w.chat=w.chat.slice(-35);
  dirty(w);broadcast(w);return;
 }
 if(type==='ping'){
  if(Date.now()-(p.lastPing||0)<4500)throw Error('Aguarde antes de marcar outro local.');
  const target=[{id:'base',name:'Depósito Central'},...w.towns,...w.nodes,...w.projects.filter(pr=>w.discoveries[pr.kind]>0)].find(s=>s.id===msg.target);
  if(!target)throw Error('Selecione um local válido no mapa.');
  p.lastPing=Date.now();w.pings=w.pings.filter(x=>x.target!==target.id&&x.expires>Date.now());
  w.pings.push({target:target.id,by:p.name,expires:Date.now()+120000});w.pings=w.pings.slice(-5);
  log(w,'📍 '+p.name+' sinalizou '+target.name+' para o grupo.');dirty(w);broadcast(w);return;
 }
 if(type==='upgrade'){
  if(!near(p,BASE))throw Error('Melhorias da frota são instaladas no depósito.');
  const key=String(msg.upgrade),cost=UPGRADES[key];if(!cost)throw Error('Melhoria desconhecida.');
  if(w.upgrades[key])throw Error('Melhoria já instalada.');
  if(w.money<cost.money||w.intel<cost.intel)throw Error('Faltam créditos ou pesquisas.');
  for(const [r,q] of Object.entries(cost)){if(RES[r]&&(w.inventory[r]||0)<q)throw Error('Faltam '+RES[r].name+' no depósito.');}
  w.money-=cost.money;w.intel-=cost.intel;for(const [r,q] of Object.entries(cost))if(RES[r])w.inventory[r]-=q;
  w.upgrades[key]=true;log(w,'🔧 '+p.name+' instalou '+cost.label+'. '+cost.description);dirty(w);broadcast(w);return;
 }
 if(type==='route'){
  const target=[{id:'base',...BASE},...w.nodes,...w.towns,...w.projects.filter(x=>w.discoveries[x.kind]>0)].find(s=>s.id===msg.target);
  if(!target)throw Error('Destino não encontrado ou projeto não descoberto.');
  const planned=await planTo(w,p,target);
  if(!planned)throw Error('Não existe uma estrada até o destino.');
  commitRoute(p,target,planned);
  dirty(w);toast(ws,`Rota ${planned.source==='osm-driving'?'pelas ruas reais (sem tráfego ao vivo)':planned.source==='osm'?'na malha OSM':'pela malha fictícia'}: ${(planned.meters/1000).toFixed(1)} km · ${Math.max(1,Math.ceil(p.route.durationSeconds/60))} min estimados.`);broadcast(w);return;
 }
 if(type==='drive'){
  if(Date.now()-p.lastManual<115)return;
  const dx=Math.max(-1,Math.min(1,Number(msg.dx)||0)),dy=Math.max(-1,Math.min(1,Number(msg.dy)||0));if(!dx&&!dy)return;
  p.route=null;p.lastManual=Date.now();p.lat=Math.max(BASE.lat-.085,Math.min(BASE.lat+.085,p.lat+dy*0.00009));p.lng=Math.max(BASE.lng-.105,Math.min(BASE.lng+.105,p.lng+dx*0.00010));dirty(w);broadcast(w);return;
 }
 if(type==='collect'){
  const node=w.nodes.find(n=>n.id===msg.node);if(!node)throw Error('Local não encontrado.');
  if(!near(p,node))throw Error('Aproxime o caminhão do ponto de coleta.');
  let qty=Math.min(10,node.stock,(w.factories.logistica?32:20)+(w.upgrades.fleet?12:0)-inventoryQty(p.cargo));
  if(qty<=0)throw Error('Sem estoque ou caminhão cheio.');
  node.stock-=qty;p.cargo[node.type]=(p.cargo[node.type]||0)+qty;
  if(node.type==='sucata')PROGRESSION.advance(w,'recovery',qty,message=>log(w,message));
  log(w,`${p.name} coletou ${qty} × ${RES[node.type].name}.`);effect(ws,'collect',`+${qty} ${RES[node.type].name} no caminhão`,node.type,qty);dirty(w);broadcast(w);return;
 }
 if(type==='load'){
  if(!near(p,BASE))throw Error('Retorne ao depósito da cooperativa.');
  const r=String(msg.resource);if(!RES[r])throw Error('Recurso inválido.');
  const requested=Number(msg.qty);if(!Number.isInteger(requested)||requested<1||requested>32)throw Error('Quantidade inválida (1 a 32).');
  const qty=Math.min(requested,w.inventory[r]||0,(w.factories.logistica?32:20)+(w.upgrades.fleet?12:0)-inventoryQty(p.cargo));
  if(qty<=0)throw Error('Estoque insuficiente ou caminhão cheio.');
  w.inventory[r]-=qty;p.cargo[r]=(p.cargo[r]||0)+qty;log(w,`${p.name} carregou ${qty} × ${RES[r].name}.`);effect(ws,'load',`+${qty} ${RES[r].name} carregados`,r,qty);dirty(w);broadcast(w);return;
 }
 if(type==='unload'){
  if(!near(p,BASE))throw Error('Descarregue somente no depósito.');
  let total=inventoryQty(p.cargo);if(!total)throw Error('Caminhão vazio.');
  for(const [r,q] of Object.entries(p.cargo))w.inventory[r]=(w.inventory[r]||0)+q;
  p.cargo={};log(w,`${p.name} descarregou ${total} unidades.`);effect(ws,'unload',`${total} unidades transferidas ao depósito`);dirty(w);broadcast(w);return;
 }
 if(type==='build'){
  if(!near(p,BASE))throw Error('Volte à base para construir.');
  const costs={serraria:{money:360,madeira:6,intel:0},fundicao:{money:420,sucata:6,intel:0},logistica:{money:620,metal:4,intel:2}};
  const key=String(msg.build);const c=costs[key];if(!c)throw Error('Projeto desconhecido.');
  if(w.factories[key])throw Error('Projeto já construído.');if(w.money<c.money||w.intel<c.intel)throw Error('Faltam créditos ou inteligência.');
  for(const [r,q] of Object.entries(c)){if(r!=='money'&&r!=='intel'&&(w.inventory[r]||0)<q)throw Error(`Falta ${RES[r].name}.`)}
  w.money-=c.money;w.intel-=c.intel;for(const [r,q] of Object.entries(c)){if(r!=='money'&&r!=='intel')w.inventory[r]-=q;}
  w.factories[key]=true;if(key==='serraria')rewardMilestone(w,'primeiraIndustria','primeira indústria construída',90);log(w,`${p.name} construiu: ${key==='serraria'?'Serraria':key==='fundicao'?'Fundição':'Centro logístico'}.`);effect(ws,'build',`Construção concluída: ${key}`);dirty(w);broadcast(w);return;
 }
 if(type==='toggleFactory'){
  const name=String(msg.factory);if(!['serraria','fundicao'].includes(name)||!w.factories[name])throw Error('Instalação inexistente.');
  w.factoryActive[name]=!w.factoryActive[name];log(w,`${p.name} ${w.factoryActive[name]?'ativou':'pausou'} a produção automática em ${name}.`);dirty(w);broadcast(w);return;
 }
 if(type==='craft'){
  if(!near(p,BASE))throw Error('Produção disponível somente na base.');
  let r=msg.recipe,recipe=r==='tabuas'?{factory:'serraria',input:'madeira',need:2,output:'tabuas'}:r==='metal'?{factory:'fundicao',input:'minerio',need:2,output:'metal'}:null;
  if(!recipe)throw Error('Receita inválida.');if(!w.factories[recipe.factory])throw Error('Construa a instalação primeiro.');
  const max=Math.min(5,Math.floor((w.inventory[recipe.input]||0)/recipe.need));if(max<1)throw Error('Matéria-prima insuficiente no depósito.');
  w.inventory[recipe.input]-=max*recipe.need;w.inventory[recipe.output]+=max;
  PROGRESSION.advance(w,'production',max,message=>log(w,message));rewardMilestone(w,'primeiraProducao','primeiro lote produzido',40);log(w,`${p.name} produziu ${max} × ${RES[recipe.output].name}.`);effect(ws,'craft',`+${max} ${RES[recipe.output].name} produzidos`,recipe.output,max);dirty(w);broadcast(w);return;
 }
 // Atalho amigável: prepara um contrato ou operação, carrega exatamente o necessário
 // e parte pelas estradas. Não remove materiais se falta estoque, capacidade ou rota.
 if(type==='prepareDelivery'){
  if(!near(p,BASE))throw Error('Vá até a base para preparar a entrega.');
  const scope=String(msg.scope||''),id=Number(msg.id);
  const job=scope==='contract'?w.contracts.find(c=>c.id===id):scope==='mission'?w.missions.find(m=>m.id===id):null;
  if(!job)throw Error('Entrega não encontrada ou expirada.');
  if(scope==='mission'&&job.deadlineDay<w.day)throw Error('Operação já expirada.');
  const town=w.towns.find(t=>t.id===job.town);if(!town)throw Error('Cidade do destino não encontrada.');
  const resource=scope==='contract'?job.type:job.resource;
  if(!RES[resource]||!Number.isInteger(job.qty)||job.qty<1)throw Error('Carga do contrato inválida.');
  const missing=Math.max(0,job.qty-(p.cargo[resource]||0));
  const capacity=(w.factories.logistica?32:20)+(w.upgrades.fleet?12:0);
  if(missing>capacity-inventoryQty(p.cargo))throw Error('O caminhão não tem espaço para esta entrega. Descarregue materiais na base.');
  if((w.inventory[resource]||0)<missing)throw Error(`Faltam ${missing-(w.inventory[resource]||0)} × ${RES[resource].name} no depósito. Colete recursos ou produza antes de partir.`);
  const planned=await planTo(w,p,town);if(!planned)throw Error('Ainda não existe uma rota até esta cidade.');
  if((w.inventory[resource]||0)<missing)throw Error('Estoque alterado durante o cálculo da rota. Tente novamente.');
  if(missing){w.inventory[resource]-=missing;p.cargo[resource]=(p.cargo[resource]||0)+missing;}
  commitRoute(p,town,planned);
  log(w,`🚚 ${p.name} preparou ${job.qty} × ${RES[resource].name} e saiu para ${town.name}.`);
  dirty(w);effect(ws,'route',`Carga pronta: ${job.qty} ${RES[resource].name}. Partindo para ${town.name}.`,resource,missing);broadcast(w);return;
 }
 if(type==='contract'){
  const contract=w.contracts.find(c=>c.id===msg.id);if(!contract)throw Error('Contrato já concluído.');
  const town=w.towns.find(t=>t.id===contract.town);if(!near(p,town))throw Error('Leve o caminhão até a cidade do contrato.');
  if((p.cargo[contract.type]||0)<contract.qty)throw Error('O caminhão não tem os itens exigidos.');
  p.cargo[contract.type]-=contract.qty;if(!p.cargo[contract.type])delete p.cargo[contract.type];
  const contractReward=Math.round(contract.reward*(w.field.projects.feira?1.1:1));w.money+=contractReward;w.reputation+=8;ECO.delivery(town,contract.type,contract.qty);
  PROGRESSION.advance(w,'deliveries',contract.qty,message=>log(w,message));rewardMilestone(w,'primeiraEntrega','primeiro contrato concluído',110,3,1);
  w.contracts=w.contracts.filter(c=>c!==contract);addContract(w);
  log(w,`✓ ${p.name} concluiu contrato em ${town.name}: +${contractReward} créditos.`);effect(ws,'delivery',`Contrato concluído: +${contractReward} créditos e +8 reputação`);dirty(w);broadcast(w);return;
 }
 if(type==='sell'){
  const town=w.towns.find(t=>t.id===msg.town);if(!town||!near(p,town))throw Error('Estacione perto de uma cidade.');
  const r=String(msg.resource);const qty=p.cargo[r]||0;if(!RES[r]||qty<1)throw Error('Não há este item no caminhão.');
  const credits=qty*price(w,town,r);w.money+=credits;ECO.delivery(town,r,qty);PROGRESSION.advance(w,'deliveries',qty,message=>log(w,message));delete p.cargo[r];
  log(w,`${p.name} vendeu ${qty} × ${RES[r].name} em ${town.name}: +${credits} créditos.`);effect(ws,'delivery',`Venda concluída: +${credits} créditos`);dirty(w);broadcast(w);return;
 }
 if(type==='poiVisit'){const result=FIELD.visitPoint(w,p,msg);grantMission(w,result.kind,message=>log(w,message),p.name+' (local público)');log(w,`🏙️ ${p.name} descobriu um ponto público de ${result.kind}.`);dirty(w);toast(ws,result.message);broadcast(w);return;}
 if(type==='fieldDispatch'){const result=FIELD.dispatch(w,String(msg.dispatch||''));if(result.key==='rota'){const mission=grantMission(w,'comercio',message=>log(w,message),p.name+' (dados de campo)');if(!mission){w.field.signals+=FIELD.DISPATCHES.rota.cost;throw Error('Já há uma operação semelhante em aberto. Guarde o sinal para depois.');}}log(w,`📡 ${p.name} ativou ${FIELD.DISPATCHES[result.key].name}.`);dirty(w);toast(ws,result.message);broadcast(w);return;}
 if(type==='fieldDecision'){
  const result=FIELD.resolveDecision(w,p,String(msg.id||''),String(msg.choice||''));
  log(w,`🎒 ${p.name}: ${result.message}`);dirty(w);toast(ws,result.message);broadcast(w);return;
 }
 if(type==='fieldStart'){
  const result=FIELD.start(w,p,String(msg.kind||''));log(w,`🧭 ${p.name} iniciou uma expedição de campo (${FIELD.KINDS[msg.kind].name}).`);dirty(w);toast(ws,result.message);broadcast(w);return;
 }
 if(type==='fieldAbandon'){const result=FIELD.abandon(p);dirty(w);toast(ws,result.message);broadcast(w);return;}
 if(type==='fieldStep'){
  const result=FIELD.step(w,p,msg);
  if(result.finished){unlockDiscovery(w,result.kind,p.name+' (expedição real)');log(w,`🥾 ${p.name} concluiu uma expedição a pé (${result.walked} m, ${result.signals} sinais de campo).`);rewardMilestone(w,'primeiraExpedicao','primeira expedição real a pé',105,6,1);}
  else log(w,`📍 ${p.name} registrou etapa ${result.step}/3 de uma expedição de campo.`);
  dirty(w);toast(ws,result.message);broadcast(w);return;
 }
 if(type==='fieldBuild'){const result=FIELD.build(w,String(msg.project||''));log(w,`🏕️ ${p.name} construiu ${FIELD.PROJECTS[msg.project].name}.`);dirty(w);toast(ws,result.message);broadcast(w);return;}
 if(type==='gps'){
  const today=new Date().toISOString().slice(0,10);if(p.scansDate!==today){p.scansDate=today;p.scansToday=0;}if(p.scansToday>=8)throw Error('Limite de oito levantamentos por dia atingido.');
  const cellHash=String(msg.cellHash||'');if(!/^[a-f0-9]{64}$/.test(cellHash))throw Error('Levantamento GPS inválido.');
  const now=Date.now();if(now-p.lastGps<45000)throw Error('Aguarde antes de registrar outro levantamento.');
  if(w.scanned.includes(cellHash))throw Error('Este quadrante já foi pesquisado nesta sala. Caminhe para outra região.');
  p.lastGps=now;p.scans++;p.scansToday++;w.scanned.push(cellHash);w.scanned=w.scanned.slice(-900);
  w.intel+=2;w.money+=35;p.gpsDiscoveries++;const suggested=String(msg.theme||'');
  const kind=['infra','comercio','natureza'].includes(suggested)?suggested:['infra','comercio','natureza'][parseInt(cellHash.slice(0,2),16)%3];
  unlockDiscovery(w,kind,p.name);rewardMilestone(w,'primeiraDescoberta','primeira descoberta de campo',65);
  log(w,`📍 ${p.name} encontrou dados de ${DISCOVERY[kind].toLowerCase()}: +2 pesquisas e +35 créditos.`);
  toast(ws,`Levantamento confirmado: ${DISCOVERY[kind]}. Confira os projetos regionais.`);dirty(w);broadcast(w);return;
 }
 if(type==='virtual'){
  if(p.remoteExpedition)throw Error('Uma expedição remota já está em andamento. Acompanhe no modo GPS.');
  if(w.money<85)throw Error('São necessários 85 créditos para enviar a equipe remota.');
  const now=Date.now();w.money-=85;p.lastVirtual=now;p.remoteExpedition={startedAt:now,readyAt:now+REMOTE_EXPEDITION_MS};
  log(w,`🛰️ ${p.name} iniciou uma expedição remota: retorno em ${Math.ceil(REMOTE_EXPEDITION_MS/60000)} min. Caminhadas presenciais oferecem vantagens exclusivas.`);
  dirty(w);effect(ws,'remote',`Expedição enviada! Retorno em ${Math.ceil(REMOTE_EXPEDITION_MS/60000)} min.`);broadcast(w);return;
 }
 if(type==='completeMission'){
  const id=Number(msg.id),m=w.missions.find(m=>m.id===id);if(!m)throw Error('Esta operação não está mais disponível.');
  if(m.deadlineDay<w.day)throw Error('O prazo desta operação terminou.');
  const town=w.towns.find(t=>t.id===m.town);if(!town||!near(p,town))throw Error('Dirija até a cidade da operação.');
  if((p.cargo[m.resource]||0)<m.qty)throw Error('Carregamento insuficiente para esta operação.');
  p.cargo[m.resource]-=m.qty;if(!p.cargo[m.resource])delete p.cargo[m.resource];
  ECO.delivery(town,m.resource,m.qty);PROGRESSION.advance(w,'deliveries',m.qty,message=>log(w,message));w.money+=m.reward;w.reputation+=5;w.intel+=2;w.missions=w.missions.filter(x=>x!==m);
  log(w,'⭐ '+p.name+' concluiu '+m.title+': +'+m.reward+' créditos, +2 pesquisas e +5 reputação.');effect(ws,'delivery',`Operação concluída: +${m.reward} créditos e +2 pesquisas`);dirty(w);broadcast(w);return;
 }
 if(type==='removePlayer'){
  if(w.owner!==p.id)throw Error('Somente o fundador pode liberar uma vaga.');const id=String(msg.player||'');
  if(id===p.id||!w.players[id]||w.players[id].online)throw Error('Só é possível remover outros participantes que estejam offline.');
  const old=w.players[id].name;delete w.players[id];log(w,`${p.name} liberou a vaga de ${old}.`);dirty(w);broadcast(w);return;
 }
 if(type==='fundProject'){
  const project=w.projects.find(x=>x.id===msg.project);if(!project||!w.discoveries[project.kind])throw Error('Descubra este projeto primeiro.');
  if(project.completed||project.funded)throw Error('Projeto já financiado.');
  if(w.money<project.fund||w.intel<project.intel)throw Error('Créditos ou pesquisas insuficientes.');
  w.money-=project.fund;w.intel-=project.intel;project.funded=true;
  log(w,`${p.name} financiou ${project.name}. Materiais podem ser entregues no canteiro.`);completeProject(w,project,p.name);dirty(w);broadcast(w);return;
 }
 if(type==='deliverProject'){
  const project=w.projects.find(x=>x.id===msg.project);if(!project||!w.discoveries[project.kind])throw Error('Projeto ainda não descoberto.');
  if(project.completed)throw Error('Projeto concluído.');if(!near(p,project))throw Error('Leve o caminhão até o canteiro de obras.');
  let total=0;for(const [res,qty] of Object.entries(project.need)){
   const required=Math.max(0,qty-(project.delivered[res]||0));const amount=Math.min(required,p.cargo[res]||0);
   if(amount>0){project.delivered[res]=(project.delivered[res]||0)+amount;p.cargo[res]-=amount;
    if(!p.cargo[res])delete p.cargo[res];total+=amount;}
  }
  if(!total)throw Error('Seu caminhão não possui os materiais que faltam na obra.');
  log(w,`${p.name} entregou ${total} unidades para ${project.name}.`);completeProject(w,project,p.name);dirty(w);broadcast(w);return;
 }
 throw Error('Ação desconhecida.');
}
function gameTick(){const now=Date.now();for(const w of rooms.values()){
 // Sala inativa congela a economia; expedições remotas usam o relógio real.
 if(!Object.values(w.players).some(p=>p.online))continue;
 let finishedRemote=false;
 for(const p of Object.values(w.players)){
  if(!p.remoteExpedition||p.remoteExpedition.readyAt>now)continue;
  p.remoteExpedition=null;w.intel+=1;w.surveys++;p.surveys++;finishedRemote=true;
  if(w.surveys%2===0){const options=['infra','comercio','natureza'].sort((a,b)=>w.discoveries[a]-w.discoveries[b]);unlockDiscovery(w,options[0],p.name+' (expedição remota)');rewardMilestone(w,'primeiraDescoberta','primeira descoberta regional',65);}
  log(w,`🛰️ Expedição remota de ${p.name} concluída: +1 pesquisa${w.surveys%2===0?' e uma descoberta':''}.`);
 }
 if(finishedRemote){dirty(w);broadcast(w);}
 // Expedições GPS são atividades reais, de vários minutos. Se todos estão
 // caminhando, o relógio econômico, os veículos e as fábricas aguardam.
 // Se ao menos um operador continua no PC, o mundo permanece em andamento.
 if(!Object.values(w.players).some(p=>p.online&&p.mode!=='gps')){
  w.lastEconomy=now;w.lastProduction=now;continue;
 }
 let changed=false;
 const beforePings=w.pings.length;w.pings=w.pings.filter(x=>x.expires>now);if(w.pings.length!==beforePings)changed=true;
 for(const p of Object.values(w.players)){
  if(!p.route)continue;
  let remaining=(DRIVE_SPEED_OVERRIDE?DRIVE_SPEED:(p.route.pace||DRIVE_SPEED))*(w.upgrades.navigation?1.35:1)*(w.field.projects.cartografia?1.15:1),iterations=0;
  while(p.route&&remaining>0&&iterations++<24){
   const next=p.route.points[p.route.index];
   if(!next){p.lat=p.route.lat;p.lng=p.route.lng;
    log(w,`🚚 ${p.name} chegou a ${[...w.towns,...w.nodes,...w.projects,{id:'base',name:'Depósito Central'}].find(x=>x.id===p.route.id)?.name||'destino'}.`);
    p.route=null;break;}
   const d=distance(p,next);
   if(d<=remaining+1){p.lat=next.lat;p.lng=next.lng;p.route.index++;remaining-=d;}
   else{const frac=remaining/d;p.lat+=(next.lat-p.lat)*frac;p.lng+=(next.lng-p.lng)*frac;remaining=0;}
  }
  changed=true;
 }
 if(now-w.lastEconomy>ECONOMY_STEP_MS){w.lastEconomy=now;w.day++;w.priceWave+=.55;
  ECO.dailyEconomy(w,msg=>log(w,msg));ECO.expireContracts(w,CONTRACT_CYCLE,RES,msg=>log(w,msg));expireMissions(w,msg=>log(w,msg));
  const ecology=w.projects.find(pr=>pr.id==='pesquisa')?.completed;
  for(const n of w.nodes)n.stock=Math.min(n.max,n.stock+(ecology?8:4)+(w.field.projects.observatorio?3:0));
  for(const t of w.towns)t.priceFactor=Math.min(1.4,t.priceFactor+.045);
  if(w.day%4===0){const i=Math.floor(w.day/4)%w.towns.length,k=(Math.floor(w.day/4)+1)%Object.keys(RES).length;
   w.event={town:w.towns[i].id,resource:Object.keys(RES)[k],multiplier:1.35,until:w.day+3};
   log(w,`📈 Alta de demanda em ${w.towns[i].name}: ${RES[w.event.resource].name} valorizado por 4 dias.`);
  }changed=true;
 }
 if(now-w.lastProduction>16000){w.lastProduction=now;
  if(w.factories.serraria&&w.factoryActive.serraria&&w.inventory.madeira>=2){w.inventory.madeira-=2;w.inventory.tabuas+=1;PROGRESSION.advance(w,'production',1,message=>log(w,message));rewardMilestone(w,'primeiraProducao','primeiro lote produzido',40);changed=true;}
  if(w.factories.fundicao&&w.factoryActive.fundicao&&w.inventory.minerio>=2){w.inventory.minerio-=2;w.inventory.metal+=1;PROGRESSION.advance(w,'production',1,message=>log(w,message));rewardMilestone(w,'primeiraProducao','primeiro lote produzido',40);changed=true;}
 }
 if(changed){dirty(w);broadcast(w)}
 }}
setInterval(gameTick,1000).unref();
const TYPES={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const srv=http.createServer((req,res)=>{
 const raw=(req.url||'/').split('?')[0];if(raw==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
 let urlpath;try{urlpath=decodeURIComponent(raw)}catch{res.writeHead(400);res.end('Bad URL');return;}const file=path.resolve(ROOT,'.'+(urlpath==='/'?'/index.html':urlpath));
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
 fs.readFile(file,(err,buffer)=>{if(err){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':file.endsWith('sw.js')?'no-cache':'public, max-age=120','X-Content-Type-Options':'nosniff','Permissions-Policy':'geolocation=(self)'});res.end(buffer);
 });
});
srv.on('upgrade',(req,socket)=>{
 if(req.url!=='/socket'||req.headers.upgrade?.toLowerCase()!=='websocket'){socket.destroy();return;}
 const origin=req.headers.origin;
 if(origin){try{const from=new URL(origin),host=new URL('http://'+req.headers.host);if(from.host!==host.host){socket.destroy();return;}}catch{socket.destroy();return;}}
 const key=req.headers['sec-websocket-key'];if(!key||!/^[-+/=A-Za-z0-9]{20,60}$/.test(key)){socket.destroy();return;}
 const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 const ws={socket,buffer:Buffer.alloc(0),world:null,player:null,rateStart:Date.now(),rateCount:0};sockets.add(ws);
 socket.on('data',chunk=>{
  ws.buffer=Buffer.concat([ws.buffer,chunk]);if(ws.buffer.length>100000){socket.destroy();return;}
  while(ws.buffer.length>=2){let b=ws.buffer,opcode=b[0]&15,mask=Boolean(b[1]&128),len=b[1]&127,offset=2;
   if(len===126){if(b.length<4)break;len=b.readUInt16BE(2);offset=4}
   else if(len===127){if(b.length<10)break;let v=b.readBigUInt64BE(2);if(v>65536n){socket.destroy();return;}len=Number(v);offset=10}
   if(!mask||len>65536){socket.destroy();return;}if(b.length<offset+4+len)break;
   const key=b.subarray(offset,offset+4);offset+=4;const buf=b.subarray(offset,offset+len);
   for(let i=0;i<len;i++)buf[i]^=key[i%4];ws.buffer=b.subarray(offset+len);
   if(opcode===8){socket.end();return}
   if(opcode===9){socket.write(Buffer.from([0x8a,0]));continue}
   if(opcode!==1)continue;
   try{const msg=JSON.parse(buf.toString('utf8'));const now=Date.now();if(now-ws.rateStart>=1000){ws.rateStart=now;ws.rateCount=0;}if(++ws.rateCount>25)throw Error('Muitas ações ao mesmo tempo; tente novamente.');if(msg.type==='join')connect(ws,msg);else if(msg.type==='action'){
    if((ws.pendingActions||0)>=12)throw Error('Muitas ações pendentes. Aguarde a rota anterior.');
    ws.pendingActions=(ws.pendingActions||0)+1;
    ws.actionQueue=(ws.actionQueue||Promise.resolve()).then(()=>act(ws,msg)).catch(e=>toast(ws,e.message||'Não foi possível executar a ação.',true)).finally(()=>{ws.pendingActions--;});
   }else throw Error('Mensagem inválida.');}
   catch(e){toast(ws,e.message||'Ocorreu um erro.',true)}
  }
 });
 const cleanup=()=>{sockets.delete(ws);if(ws.world&&ws.player){const stillConnected=[...sockets].some(other=>other.world?.code===ws.world.code&&other.player===ws.player);const p=ws.world.players[ws.player];if(p&&!stillConnected){p.online=false;p.route=null;dirty(ws.world);broadcast(ws.world)}}};
 socket.on('close',cleanup);socket.on('error',()=>{});
});
srv.listen(PORT,'0.0.0.0',()=>console.log(`Rotas Vivas em http://localhost:${PORT}`));
