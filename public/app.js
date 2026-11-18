'use strict';
(()=>{
const $=id=>document.getElementById(id), money=n=>Math.round(Number(n)||0).toLocaleString('pt-BR'), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const UPGRADES=[['fleet','🚚','Carroceria reforçada','◆520 · ⚙️3 · ◈2','+12 de capacidade em todos os caminhões'],['navigation','🧭','Central de navegação','◆450 · ⚙️2 · ◈3','Piloto automático 35% mais rápido'],['network','📦','Rede de distribuição','◆560 · 🪚6 · ◈4','Venda de produtos com bônus de 8%']];
 const RES={madeira:['🪵','Madeira'],minerio:['🪨','Minério'],sucata:['🔩','Sucata'],tabuas:['🪚','Tábuas'],metal:['⚙️','Metal']};
const BASE={id:'base',name:'Depósito Central',emoji:'🏭',lat:-23.8299,lng:-46.7198};
let socket=null,world=null,you=null,room=null,myField=null,selected='base',mode='pc',mobileTab='map',reconnectTimer=null;
window.RotasBridge={state:()=>({world,you,mode,selected}),send:(action,details)=>send(action,details),routeTo:id=>routeTo(id),setMode:m=>setMode(m),near:s=>near(s)};
let center={lat:BASE.lat,lng:BASE.lng},zoom=13.6,drag=null,follow=false,gpsPosition=null,gpsTarget=null,tileCache=new Map(),markerHits=[],vehicleMotion=new Map(),gpsWatchId=null,nearbyPOIs=[],poiCache=null;
const canvas=$('map'),ctx=canvas.getContext('2d',{alpha:false});
$('playerName').value=localStorage.getItem('rv-name')||'';
$('roomCode').value=new URLSearchParams(location.search).get('sala')||localStorage.getItem('rv-room')||'';
function notice(message,error=false){let el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=message;$('toasts').append(el);setTimeout(()=>el.remove(),4600)}
function send(action,details={}){if(!socket||socket.readyState!==1){notice('Sem conexão com a sala.',true);return;}socket.send(JSON.stringify({type:'action',action,...details}));}
function connect(){const name=$('playerName').value.trim(),code=$('roomCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);if(name.length<2||code.length<4){$('joinStatus').textContent='Informe nome e sala (4+ caracteres).';return;}
  const proto=location.protocol==='https:'?'wss:':'ws:';
  if(reconnectTimer)clearTimeout(reconnectTimer);if(socket)socket.close();socket=new WebSocket(proto+'//'+location.host+'/socket');const thisSocket=socket;$('joinStatus').textContent='Conectando...';
  socket.addEventListener('open',()=>{socket.send(JSON.stringify({type:'join',name,room:code,token:localStorage.getItem('rv-token-'+code)||''}));});
  socket.addEventListener('message',e=>{let msg;try{msg=JSON.parse(e.data)}catch{return}
    if(msg.type==='joined'){room=msg.room;localStorage.setItem('rv-token-'+room,msg.token);localStorage.setItem('rv-room',room);localStorage.setItem('rv-name',name);history.replaceState(null,'','?sala='+encodeURIComponent(room));$('joinVeil').classList.add('hidden');$('connection').textContent='● Online · '+room;$('connection').classList.add('on');notice('Bem-vindo! Sua sala é '+room+'.');}
    else if(msg.type==='state'){recordMotion(msg.world);world=msg.world;you=msg.you;myField=msg.myField||null;updateUI();if(mode==='gps')renderGps();if(typeof CustomEvent==='function'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('rotas:state',{detail:{world,you,mode}}));}
    else if(msg.type==='effect'){notice(msg.message);if(typeof CustomEvent==='function'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('rotas:effect',{detail:msg}));}
    else if(msg.type==='notice'){notice(msg.message,!!msg.error);$('joinStatus').textContent=msg.error?msg.message:'';}
  });
  socket.addEventListener('close',()=>{if(socket!==thisSocket)return;if(world){$('connection').textContent='● Reconectando';$('connection').classList.remove('on');notice('Conexão interrompida. Tentando reconectar...',true)}else $('joinStatus').textContent='Servidor indisponível.';reconnectTimer=setTimeout(()=>{if(socket===thisSocket)connect()},3200)});
  socket.addEventListener('error',()=>{$('joinStatus').textContent='Erro de conexão. Verifique se o servidor está ativo.'});
}
$('joinBtn').onclick=connect;$('playerName').onkeydown=$('roomCode').onkeydown=e=>{if(e.key==='Enter')connect()};
$('newRoomBtn').onclick=()=>{$('roomCode').value=Array.from(crypto.getRandomValues(new Uint8Array(8)),v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');connect()};
$('shareBtn').onclick=async()=>{const url=location.origin+'/?sala='+encodeURIComponent(room||$('roomCode').value);try{await navigator.clipboard.writeText(url);notice('Link da sala copiado.')}catch{notice('Compartilhe este link: '+url)}};
$('chatForm').addEventListener('submit',e=>{e.preventDefault();const input=$('chatInput'),message=input.value.trim();if(message.length>=2){send('chat',{message});input.value=''}});
 $('helpBtn').onclick=()=>{$('helpModal').classList.remove('hidden')};$('closeHelp').onclick=$('gotIt').onclick=()=>{$('helpModal').classList.add('hidden')};
$('baseBtn').onclick=()=>routeTo('base');$('unloadBtn').onclick=()=>send('unload');$('recenterBtn').onclick=()=>{follow=false;center=mode==='gps'&&gpsPosition?{lat:gpsPosition.lat,lng:gpsPosition.lng}:{lat:BASE.lat,lng:BASE.lng};zoom=mode==='gps'?15:13.6;draw()};
$('zoomIn').onclick=()=>{zoom=Math.min(17,zoom+1);draw()};$('zoomOut').onclick=()=>{zoom=Math.max(10,zoom-1);draw()};
$('pcMode').onclick=()=>setMode('pc');$('gpsMode').onclick=()=>setMode('gps');$('panelToggle').onclick=()=>{document.body?.classList?.toggle('panels-open');draw()};$('closePanels').onclick=()=>{document.body?.classList?.remove('panels-open');draw()};
function setMode(m){if(m!=='gps')stopGpsWatch();if(typeof CustomEvent==='function'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('rotas:mode',{detail:{mode:m}}));mode=m;zoom=m==='pc'?13.6:Math.max(15,zoom);document.body?.classList?.toggle('mode-gps',m==='gps');document.body?.classList?.toggle('mode-pc',m==='pc');if(world)send('setMode',{mode:m});$('quickAction').hidden=m!=='pc'||selected==='base';$('pcMode').classList.toggle('selected',m==='pc');$('gpsMode').classList.toggle('selected',m==='gps');$('driveHelp').style.display=m==='gps'?'none':'';$('mapSubtitle').textContent=m==='gps'?'Mapa real · OpenStreetMap + waypoints':'Mundo isométrico · Região Sul';let pane=$('gpsPanel');if(m==='gps'){if(!pane){pane=document.createElement('div');pane.id='gpsPanel';pane.className='gps-panel';$('map').parentElement.appendChild(pane)}renderGps();draw();toggleGpsWatch()}else{if(pane)pane.remove();if(gpsPosition){center={lat:BASE.lat,lng:BASE.lng};gpsPosition=null}draw()}}
const POI_LABELS={park:['🌳','Parque público'],garden:['🌷','Jardim público'],library:['📚','Biblioteca'],marketplace:['🛒','Mercado público'],community:['🏛️','Centro comunitário'],viewpoint:['🔭','Mirante']};
const POI_EFFECTS={park:'Recupera fontes de recursos',garden:'Ajuda a recuperar recursos',library:'+3 pesquisas adicionais',marketplace:'Abastece cidade com maior escassez',community:'Ajuda a cidade mais necessitada',viewpoint:'+2 pesquisas e +45 créditos'};
const DECISION_UI={
 infra:{title:'🧭 Uma rota inesperada',story:'Sua caminhada identificou possibilidades para a cooperativa.',choices:[['materiais','🔩 Recuperar 2 metais','Útil para construir e melhorar indústrias'],['pesquisa','🔬 Ganhar 3 pesquisas','Desbloqueia projetos e tecnologia']]},
 comercio:{title:'📦 Nova oportunidade comercial',story:'Os dados coletados podem apoiar o comércio ou uma cidade.',choices:[['capital','◆ Receber 150 créditos','Acelera os próximos investimentos'],['socorro','🏘️ Ajudar a cidade mais carente','Melhora sua prosperidade em 9 pontos']]},
 natureza:{title:'🌿 Descoberta ambiental',story:'Sua observação pode recuperar recursos ou gerar conhecimento.',choices:[['recuperar','🌱 Recuperar fontes','Aumenta o estoque das fontes de coleta'],['estudar','🔬 Ganhar 3 pesquisas','Ajuda a desenvolver novas estruturas']]}
};
const FIELD_DEFS={infra:['🧭','Cartografia viva','Descubra corredores e possibilidades de transporte.','Rede cartográfica'],comercio:['📦','Pulso comercial','Observe a economia local e crie novas demandas.','Feira itinerante'],natureza:['🌿','Observatório verde','Caminhe e observe novos ambientes na região.','Observatório de recursos']};
const FIELD_DISPATCHES=[['rota','📋','Nova operação','1 sinal'],['reflorestamento','🌱','Recuperar recursos','1 sinal'],['cidades','🏘️','Mutirão de abastecimento','2 sinais']];
const FIELD_WORKS=[['cartografia','🧭','Rede de cartografia','2 sinais · ◆170','Piloto automático +15%'],['feira','🛍️','Feira itinerante','3 sinais · ◆230','Contratos +10%'],['observatorio','🌱','Observatório de recursos','4 sinais · ◆290','Regeneração de fontes +3']];
function renderGps(message=''){
 const pane=$('gpsPanel');if(!pane)return;const priorScroll=pane.querySelector('.field-interface')?.scrollTop||0,wasMore=!!pane.querySelector('.gps-more[open]');
 const f=world?.field||{signals:0,completed:0,themeCounts:{},projects:{}},st=myField||{},running=!!st.active;
 const steps=['Marque o primeiro setor','Caminhe para um segundo setor','Valide o terceiro setor'];
 const options=Object.entries(FIELD_DEFS).map(([key,[icon,name,description]])=>`<button class="field-option" data-gps="start" data-kind="${key}"><span class="field-option-icon">${icon}</span><span><strong>${name}</strong><small>${description}</small></span><span class="field-option-count">${f.themeCounts?.[key]||0} ✓</span></button>`).join('');
 const decision=st.decision&&DECISION_UI[st.decision.kind];
 const choicePanel=decision?`<section class="field-story" aria-label="Descoberta da expedição"><span class="eyebrow">NOVA DESCOBERTA · SUA ESCOLHA IMPORTA</span><h3>${decision.title}</h3><p>${decision.story}</p><div class="field-story-choices">${decision.choices.map(([id,label,detail])=>`<button class="field-story-choice" data-gps="decision" data-choice="${id}" data-decision-id="${st.decision.id}"><strong>${label}</strong><small>${detail}</small></button>`).join('')}</div><button class="btn small outline" data-gps="decision" data-choice="ignore" data-decision-id="${st.decision.id}">Deixar para depois</button></section>`:'';
 const boxes=FIELD_WORKS.map(([id,icon,name,cost,perk])=>`<div class="field-work ${f.projects?.[id]?'built':''}"><strong>${icon} ${name}</strong><small>${perk}</small><div><span>${f.projects?.[id]?'✓ Funcionando':cost}</span><button class="btn small outline" data-gps="build" data-project="${id}" ${f.projects?.[id]?'disabled':''}>${f.projects?.[id]?'Construído':'Implantar'}</button></div></div>`).join('');
 pane.innerHTML=`<div class="gps-card field-interface"><div class="gps-heading"><div class="gps-icon">◎</div><div><span class="eyebrow">MODO CAMPO · GPS REAL</span><h2>${running?esc(FIELD_DEFS[st.kind]?.[1]||'Expedição ativa'):'Sua cidade é o tabuleiro'}</h2></div></div>
 <div class="gps-map-commands"><button class="btn small primary" data-gps="centerGps">${gpsWatchId===null?'⌖ Localizar-me':'⌖ Minha posição'}</button><button class="btn small outline" data-gps="searchPoi">📍 Encontrar lugares</button></div><div class="field-stats"><span><b>◎ ${f.signals||0}</b><small>Sinais compartilhados</small></span><span><b>🥾 ${f.completed||0}</b><small>Expedições concluídas</small></span><span><b>${st.today||0}/3</b><small>Hoje (UTC)</small></span></div>
 ${choicePanel}
 ${running?`<div class="field-journey"><div class="field-stepper">${[0,1,2].map(n=>`<span class="${n<st.steps?'done':n===st.steps?'current':''}">${n<st.steps?'✓':n+1}</span>`).join('')}</div><h3>${steps[Math.min(st.steps,2)]}</h3><p>Faça uma leitura em uma área pública acessível. Entre etapas, caminhe setores distantes cerca de <strong>330 metros no mapa</strong> e aguarde <strong>65 segundos</strong>. Não precisa seguir uma rota predeterminada.</p><div class="field-radar"><div class="radar-circle"><div class="radar-center">◎</div><div class="radar-line"></div></div><div><b>${st.steps}/3 setores</b><small>Prazo de 2 horas · expedição salva automaticamente</small><small id="fieldProximity">${gpsPosition?esc(gpsGuidance(gpsPosition)):'Ative a bússola para ver a distância aproximada'}</small></div></div><div class="gps-actions"><button class="btn primary" data-gps="step">⌖ Registrar etapa ${Math.min(st.steps+1,3)}/3</button><button class="btn outline" data-gps="watch">${gpsWatchId!==null?'◉ Desligar bússola':'◎ Bússola ao vivo'}</button><button class="btn outline" data-gps="abandon">Encerrar</button></div></div>`:
 `<p class="field-intro">Explore fisicamente três setores de sua região e transforme as descobertas em novas missões, pesquisa e construções. <strong>Somente as expedições a pé produzem sinais de campo.</strong></p><div class="field-options">${st.decision?'':options}</div><div class="gps-actions"><button class="btn outline" data-gps="virtual">🛰️ Expedição remota · ◆85</button></div>`}
 ${message?`<div class="gps-result" role="status">${esc(message)}</div>`:''}
 <details class="gps-more" ${wasMore?'open':''}><summary>📒 Atlas, lugares próximos e melhorias <span>⌄</span></summary><div class="field-works-title">ATLAS VIVO · EXPLORAÇÃO COOPERATIVA</div>
 <div class="field-atlas"><div class="field-atlas-heading"><strong>📒 ${f.atlas?.length||0}/6 tipos de locais explorados</strong><span>${f.atlasMilestones?.includes(6)?'Coleção completa':f.atlasMilestones?.includes(3)?'Primeiro marco alcançado':'Bônus coletivos em 3 e 6 tipos'}</span></div><div class="atlas-categories">${Object.entries(POI_LABELS).map(([id,[icon,label]])=>`<span class="atlas-item ${f.atlas?.includes(id)?'done':''}" title="${label}: ${POI_EFFECTS[id]}">${icon} ${label} ${f.atlas?.includes(id)?'✓':''}</span>`).join('')}</div><small>Categorias distintas completam o atlas da cooperativa e rendem sinais de campo, pesquisas e créditos extras.</small></div>
 <div class="field-works-title">LUGARES REAIS · DESCOBERTAS ÚNICAS</div><p class="field-poi-desc">Cada primeira visita a um ponto público gera uma operação e um sinal de campo. <strong>O efeito depende do local:</strong> parques recuperam recursos; bibliotecas geram pesquisas; mercados abastecem cidades; centros comunitários ajudam a população; mirantes ajudam a cartografia. Os amigos só veem a categoria, não qual lugar você visitou.</p>
 <button class="btn small outline" data-gps="searchPoi">🔎 Procurar lugares públicos próximos</button>
 <div class="field-poi-list">${nearbyPOIs.length?nearbyPOIs.map(q=>`<div class="field-poi"><span class="field-poi-icon">${POI_LABELS[q.category]?.[0]||'📍'}</span><span><b>${esc(q.name)}</b><small>${POI_EFFECTS[q.category]||POI_LABELS[q.category]?.[1]||'Local público'} · ${gpsPosition?Math.round(haversine(gpsPosition,q))+' m':'Próximo de você'}</small></span><button class="btn small outline" data-gps="visitPoi" data-poi="${esc(q.id)}">Visitar</button></div>`).join(''):'<p class="field-poi-empty">Os locais próximos aparecerão aqui. A busca é opcional.</p>'}</div>
 <div class="field-works-title">PROJETOS GERADOS PELAS CAMINHADAS</div><div class="field-work-list">${boxes}</div><div class="field-works-title">MOBILIZE A EQUIPE COM SINAIS DE CAMPO</div><div class="field-dispatch-list">${FIELD_DISPATCHES.map(([id,icon,name,cost])=>`<div class="field-dispatch"><span>${icon} ${name}<small>${cost}</small></span><button class="btn small outline" data-gps="dispatch" data-dispatch="${id}">Ativar</button></div>`).join('')}</div>
 </details><p class="gps-caution">A busca de lugares usa um serviço externo do OpenStreetMap e envia sua posição aproximada ao provedor SOMENTE ao tocar em buscar. O ponto no mapa não garante acesso público nem horário de funcionamento. Jogue parado, nunca ao dirigir ou atravessar ruas. Não entre em propriedades privadas, áreas isoladas ou restritas. O jogo envia quadrículas aproximadas (~200 m) apenas durante a operação; o histórico preserva hashes, não suas coordenadas exatas. GPS depende de HTTPS e permissão do aparelho. A localização pode ser falsificada: ainda é um protótipo.</p></div>`; const card=pane.querySelector('.field-interface');if(card)card.scrollTop=priorScroll;updateGpsWaypoint();
}
function handleGpsAction(btn){
 const kind=btn.dataset.kind,action=btn.dataset.gps;
 if(action==='start')send('fieldStart',{kind});
 else if(action==='decision')send('fieldDecision',{id:btn.dataset.decisionId,choice:btn.dataset.choice});
 else if(action==='step')fieldRead();
 else if(action==='abandon'){if(confirm('Encerrar a expedição em andamento?'))send('fieldAbandon')}
 else if(action==='virtual')send('virtual');
 else if(action==='build')send('fieldBuild',{project:btn.dataset.project});
 else if(action==='dispatch')send('fieldDispatch',{dispatch:btn.dataset.dispatch});
 else if(action==='watch')toggleGpsWatch();else if(action==='centerGps'){if(!gpsPosition){if(gpsWatchId===null)toggleGpsWatch();else getGPS(updateGpsLive)}else{center={lat:gpsPosition.lat,lng:gpsPosition.lng};zoom=Math.max(15,zoom);draw()}}
 else if(action==='searchPoi')searchPublicPlaces();
 else if(action==='visitPoi')visitPublicPlace(btn.dataset.poi);
}
function gpsGuidance(pos){const st=myField||{},cell=st.lastCell;if(!pos)return 'Sem leitura de localização';
 if(pos.accuracy>85)return 'Sinal fraco ±'+Math.round(pos.accuracy)+' m · tente céu aberto';
 if(!cell)return 'Primeiro setor disponível · registre a etapa 1/3';
 const centerCell={lat:(cell.y+.5)*.0018,lng:(cell.x+.5)*.0018};
 const distance=haversine(pos,centerCell),secs=Math.max(0,Math.ceil((st.nextAfter-Date.now())/1000));
 return `${Math.round(distance)} m do setor anterior · ${distance<330?'caminhe mais '+Math.ceil(330-distance)+' m':'novo setor próximo'}${secs?' · aguarde '+secs+' s':''}`;
}
function updateGpsLive(pos){gpsPosition={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};if(!drag){center={lat:gpsPosition.lat,lng:gpsPosition.lng};zoom=Math.max(zoom,15)}draw();updateGpsWaypoint();const label=$('fieldProximity');if(label)label.textContent=gpsGuidance(gpsPosition)}
function stopGpsWatch(){if(gpsWatchId!==null&&navigator.geolocation?.clearWatch)navigator.geolocation.clearWatch(gpsWatchId);gpsWatchId=null;}
function toggleGpsWatch(){if(gpsWatchId!==null){stopGpsWatch();renderGps('Bússola desligada.');return}
 if(!window.isSecureContext||!navigator.geolocation?.watchPosition){renderGps('A bússola exige localização autorizada em uma conexão HTTPS.');return}
 gpsWatchId=navigator.geolocation.watchPosition(updateGpsLive,err=>{stopGpsWatch();renderGps('Bússola: '+err.message)},{enableHighAccuracy:true,maximumAge:3000,timeout:22000});renderGps('Bússola ligada somente enquanto este modo estiver aberto.');}
function getGPS(onSuccess){
 if(!window.isSecureContext||!navigator.geolocation){renderGps('A localização requer permissão e HTTPS.');return}
 navigator.geolocation.getCurrentPosition(onSuccess,err=>renderGps('Não foi possível consultar seu GPS: '+err.message),{enableHighAccuracy:true,maximumAge:0,timeout:18000});
}
async function searchPublicPlaces(){
 renderGps('Procurando pontos públicos mapeados. A consulta externa é opcional e não guarda sua posição no servidor do jogo…');
 getGPS(async pos=>{
  updateGpsLive(pos);const {latitude:lat,longitude:lng}=pos.coords;
  if(poiCache&&Date.now()-poiCache.time<1200000&&haversine({lat,lng},poiCache.center)<380){nearbyPOIs=poiCache.items;gpsTarget=nearbyPOIs[0]?.id||null;renderGps('Resultado em cache: '+nearbyPOIs.length+' lugares.');return}
  const coarseLat=(Math.floor(lat/.003)+.5)*.003,coarseLng=(Math.floor(lng/.003)+.5)*.003;const loc=coarseLat.toFixed(4)+','+coarseLng.toFixed(4);
  const q=`[out:json][timeout:10];(nwr["leisure"~"^(park|garden)$"](around:1150,${loc});nwr["amenity"~"^(library|marketplace|community_centre)$"](around:1150,${loc});nwr["tourism"="viewpoint"](around:1150,${loc}););out center tags 60;`;
  const aborter=new AbortController(),timer=setTimeout(()=>aborter.abort(),8500);
  try{
   const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:q}),signal:aborter.signal});
   if(!response.ok)throw Error('Serviço indisponível ('+response.status+')');
   const data=await response.json();if(!Array.isArray(data.elements))throw Error('Resposta cartográfica inválida');
   const result=[];
   for(const item of data.elements){const t=item.tags||{},latitude=item.lat??item.center?.lat,longitude=item.lon??item.center?.lon;
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||['private','no'].includes(t.access))continue;
    const category=t.leisure==='park'?'park':t.leisure==='garden'?'garden':t.amenity==='library'?'library':t.amenity==='marketplace'?'marketplace':t.amenity==='community_centre'?'community':t.tourism==='viewpoint'?'viewpoint':null;
    if(!category)continue;const poi={id:item.type+'/'+item.id,lat:latitude,lng:longitude,category,name:String(t['name:pt']||t.name||POI_LABELS[category][1]).slice(0,70)};
    if(haversine({lat,lng},poi)>1200)continue;
    if(!result.some(x=>x.id===poi.id))result.push(poi);
   }
   nearbyPOIs=result.sort((a,b)=>haversine({lat,lng},a)-haversine({lat,lng},b)).slice(0,7);
   poiCache={time:Date.now(),center:{lat,lng},items:nearbyPOIs};gpsTarget=nearbyPOIs[0]?.id||null;renderGps(nearbyPOIs.length?nearbyPOIs.length+' lugares próximos encontrados. Visite somente aqueles acessíveis com segurança.':'Nenhum ponto público desse tipo registrado nas proximidades. Você pode continuar a expedição livre.');draw();
  }catch(e){nearbyPOIs=[];renderGps('Os dados de locais públicos não estão disponíveis agora. As expedições livres continuam funcionando. '+e.message)}finally{clearTimeout(timer)}
 });
}
function visitPublicPlace(id){const poi=nearbyPOIs.find(p=>p.id===id);if(!poi){renderGps('Selecione um lugar da busca primeiro.');return}
 renderGps('Confirmando sua proximidade ao lugar, sem enviar a posição exata para a sala…');
 getGPS(pos=>{
  const lat=pos.coords.latitude,lng=pos.coords.longitude;updateGpsLive(pos);
  if(pos.coords.accuracy>85){renderGps('Sinal GPS fraco (±'+Math.round(pos.coords.accuracy)+' m). Tente uma área aberta.');return}
  const meters=haversine({lat,lng},poi);if(meters>180){renderGps('Ainda falta aproximadamente '+Math.round(meters-180)+' m para validar este lugar. Use apenas vias públicas e seguras.');return}
  const cell={x:Math.floor(lng/.0018),y:Math.floor(lat/.0018)};
  send('poiVisit',{poiId:poi.id,category:poi.category,poi:{lat:poi.lat,lng:poi.lng},cell,accuracy:pos.coords.accuracy,ageMs:Math.max(0,Date.now()-pos.timestamp),speed:Number.isFinite(pos.coords.speed)&&pos.coords.speed>=0?pos.coords.speed:null});renderGps('Visita enviada para validação. Você não precisa compartilhar a localização exata com os amigos.');
 });
}
function fieldRead(){
 if(!window.isSecureContext){renderGps('É necessário HTTPS ou localhost para ler o GPS.');return}
 if(!navigator.geolocation){renderGps('Este navegador não disponibiliza geolocalização.');return}
 if(!myField?.active){renderGps('Selecione uma expedição antes de registrar etapas.');return}
 renderGps('Procurando sinal GPS com boa precisão… mantenha o celular parado.');
 const id=myField.id;
 navigator.geolocation.getCurrentPosition(pos=>{
  const {latitude:lat,longitude:lng,accuracy,speed}=pos.coords;
  updateGpsLive(pos);zoom=15.6;draw();
  if(accuracy>85){renderGps('Precisão de ±'+Math.round(accuracy)+' m, acima do permitido (85 m). Tente uma área aberta.');return;}
  const cell={x:Math.floor(lng/.0018),y:Math.floor(lat/.0018)};
  const ageMs=Math.max(0,Date.now()-pos.timestamp);
  send('fieldStep',{id,cell,accuracy,ageMs,speed:Number.isFinite(speed)&&speed>=0?speed:null});
  renderGps('Levantamento enviado · precisão ±'+Math.round(accuracy)+' m. Aguarde a confirmação do servidor.');
 },err=>renderGps('Não foi possível obter sua localização: '+err.message+'. Verifique a permissão de GPS.'),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
}
function renderFieldBoard(){const f=world.field||{},hist=(f.history||[]).slice(-4).reverse();$('fieldSignals').textContent='◎ '+money(f.signals||0);$('fieldCount').textContent=(f.completed||0)+' CONCLUÍDAS';
 $('fieldBoard').innerHTML=`<div class="field-balance">◎ <strong>${f.signals||0} sinais</strong><span>Obtidos caminhando</span></div>${FIELD_WORKS.map(([id,icon,name,cost,bonus])=>`<div class="field-board-work"><span>${icon} ${name}</span><strong>${f.projects?.[id]?'✓ Ativo':cost}</strong></div>`).join('')}<div class="field-board-history">${hist.length?hist.map(x=>`<p>${FIELD_DEFS[x.kind]?.[0]||'📍'} <b>${esc(x.by)}</b> percorreu ${x.meters} m · +${x.signals} sinais</p>`).join(''):'<p>Inicie uma expedição por GPS para abrir novas construções.</p>'}</div><button class="btn small primary" data-gps-open="1">🥾 Explorar pelo GPS</button>`;

}
function youObj(){return world?.players?.[you]||null}
function sites(){return [BASE,...(world?.nodes||[]),...(world?.towns||[]),...(world?.projects||[]).filter(p=>(world?.discoveries?.[p.kind]||0)>0)]}
function getSite(id){return sites().find(s=>s.id===id)}
function haversine(a,b){let toRad=Math.PI/180;let dLat=(b.lat-a.lat)*toRad,dLng=(b.lng-a.lng)*toRad;let h=Math.sin(dLat/2)**2+Math.cos(a.lat*toRad)*Math.cos(b.lat*toRad)*Math.sin(dLng/2)**2;return 12742000*Math.asin(Math.sqrt(h))}
function near(s){return !!(youObj()&&s&&haversine(youObj(),s)<=320)}
function routeTo(id){selected=id;send('route',{target:id});follow=true;updateUI()}
function updateUI(){if(!world)return;const p=youObj();if(!p)return;
 $('money').textContent='◆ '+money(world.money);$('intel').textContent='◈ '+money(world.intel);$('reputation').textContent='★ '+money(world.reputation);renderFieldBoard();$('onlineCount').textContent=Object.values(world.players).filter(x=>x.online).length+'/4';$('dayCount').textContent='DIA '+String(world.day).padStart(2,'0');$('tasksCount').textContent=world.contracts.length+' CONTRATOS';$('mapSubtitle').textContent=mode==='pc'?'Mundo isométrico · Região Sul':world.roadMode==='osm'?'São Paulo · malha viária OSM':'São Paulo · ruas reais / OpenStreetMap';
 $('playersList').innerHTML=Object.values(world.players).map((p,i)=>`<div class="player"><span class="avatar">${esc(p.name[0].toUpperCase())}</span><span class="player-name">${esc(p.name)}${p.id===you?' (você)':''}${p.mode==='gps'?' 🥾':''}</span><i class="${p.online?'':'off'}"></i>${world.owner===you&&!p.online&&p.id!==you?`<button class="btn mini" data-remove-player="${p.id}" title="Liberar vaga de jogador offline">Liberar</button>`:''}</div>`).join('');
 const milestones=[['primeiraIndustria','Construir uma serraria'],['primeiraProducao','Produzir o primeiro lote'],['primeiraEntrega','Concluir uma entrega'],['primeiraDescoberta','Descobrir uma oportunidade (GPS ou remoto)'],['primeiroProjeto','Concluir um projeto regional'],['primeiraExpedicao','Concluir uma caminhada GPS de três etapas']];
 const done=milestones.filter(([id])=>world.milestones?.[id]).length;$('milestoneCount').textContent=done+'/'+milestones.length;$('milestones').innerHTML=milestones.map(([id,label])=>`<div class="milestone ${world.milestones?.[id]?'done':''}">${world.milestones?.[id]?'✓':'○'} <span>${label}</span></div>`).join('');
 $('inventory').innerHTML=Object.entries(RES).map(([key,[emoji,name]])=>`<div class="resource"><span>${emoji}</span><span class="res-name">${name}</span><strong>${money(world.inventory[key])}</strong></div>`).join('');
 const factoryList=[['serraria','🪚','Serraria','◆360 · 6 madeiras'],['fundicao','⚙️','Fundição','◆420 · 6 sucatas'],['logistica','🚛','Centro logístico','◆620 · 4 metais · 2 pesquisas']];
 $('factories').innerHTML=factoryList.map(([id,icon,title,cost])=>`<div class="factory"><div class="factory-icon">${icon}</div><div><strong>${title}</strong><small>${world.factories[id]?(id==='logistica'?'Capacidade ampliada':(world.factoryActive?.[id]?'Automação ligada':'Automação pausada')):cost}</small></div>${world.factories[id]?(id==='logistica'?'<span class="ready">● Ativa</span>':`<button class="btn small ${world.factoryActive?.[id]?'warn':'outline'}" data-toggle-factory="${id}">${world.factoryActive?.[id]?'Pausar':'Automatizar'}</button>`):`<button class="btn" ${near(BASE)?`data-build="${id}"`:'data-route="base"'}>${near(BASE)?'Construir':'↗ Construir na base'}</button>`}</div>`).join('');
 const capacity=(world.factories.logistica?32:20)+(world.upgrades?.fleet?12:0),units=Object.values(p.cargo).reduce((a,b)=>a+b,0);$('cargoCount').textContent=units+'/'+capacity;
 $('upgrades').innerHTML=UPGRADES.map(([id,icon,label,cost,bonus])=>`<div class="upgrade"><div><strong>${icon} ${label}</strong><small>${bonus}</small></div>${world.upgrades?.[id]?'<span class="ready">✓ Ativa</span>':`<button class="btn small outline" ${near(BASE)?`data-upgrade="${id}"`:'data-route="base"'} title="${cost}">${near(BASE)?'Instalar '+cost:'↗ Instalar na base'}</button>`}</div>`).join('');
 $('cargo').innerHTML=units?Object.entries(p.cargo).map(([r,q])=>`<span class="cargo-pill">${RES[r]?.[0]||''} ${esc(RES[r]?.[1]||r)} ×${q}</span>`).join(''):'<span class="muted">Vazio. Carregue na base ou colete em campo.</span>';
 $('contracts').innerHTML=world.contracts.map(c=>{const t=world.towns.find(t=>t.id===c.town),has=(p.cargo[c.type]||0)>=c.qty,here=near(t),days=(c.deadlineDay||world.day+35)-world.day;return `<div class="contract"><h3>${esc(t.name)}</h3><div class="contract-meta"><span>${RES[c.type][0]} ${c.qty} × ${RES[c.type][1]}</span><strong>◆ ${money(c.reward)}</strong></div><p>${here?'Você está no destino.':has?'Carga pronta para transporte.':'Produza e carregue os recursos.'} <span class="deadline ${days<=3?'urgent':''}">· ${days} dias restantes</span></p><button class="btn ${here&&has?'primary':''}" data-contract="${c.id}" data-target="${esc(t.id)}">${here&&has?'✓ Entregar e receber':has?'🚚 Partir para a cidade':near(BASE)?'📦 Preparar e partir':'↗ Ir preparar carga'}</button></div>`}).join('');
 renderProjects();renderEvent();renderRegions();renderMissions();renderGoal(p);renderChat();renderInitiatives();
 $('market').innerHTML=world.towns.map(t=>`<div class="market-row"><span>${esc(t.name)}</span><span>Tábuas ◆${marketPrice(t,'tabuas')} · Metal ◆${marketPrice(t,'metal')}</span></div>`).join('');
 $('logs').innerHTML=world.logs.slice(0,8).map(l=>`<p><time>${new Date(l.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time>${esc(l.text)}</p>`).join('');
 renderSelected();if(p.route){$('statusText').textContent='A caminho de '+(getSite(p.route.id)?.name||'destino');$('distanceText').textContent=money(remainingRoute(p))+' m · cerca de '+Math.max(1,Math.ceil(remainingRoute(p)/(world.routeSpeed||25)/60))+' min (jogo)';}else{$('statusText').textContent='Selecione um local e navegue com o caminhão.';$('distanceText').textContent='Caminhão estacionado';}
 if(follow&&mode==='pc')center={lat:p.lat,lng:p.lng};draw();}
function marketPrice(t,r){if(world?.markets?.[t.id]?.[r]!=null)return world.markets[t.id][r];let ix=Object.keys(RES).indexOf(r);const base={madeira:15,minerio:22,sucata:18,tabuas:48,metal:65}[r],evt=world.event;const mult=evt&&evt.until>=world.day&&evt.town===t.id&&evt.resource===r?evt.multiplier:1;const shortage=t.target?.[r]?Math.max(.68,Math.min(1.52,1+(t.target[r]-(t.stock?.[r]||0))/t.target[r]*.52)):1;return Math.max(5,Math.round(base*t.factor*t.priceFactor*mult*shortage*(world.upgrades?.network?1.08:1)*(1+.07*Math.sin(world.priceWave+ix))))}
function remainingRoute(p){let route=p.route;if(!route)return 0;let last=p,meters=0;for(const point of route.points.slice(route.index)){meters+=haversine(last,point);last=point}return meters;}
let lastChatRendered='';
 function renderChat(){const messages=world.chat||[],el=$('chatMessages'),signature=messages.map(x=>x.id).join(',');if(signature===lastChatRendered)return;
  lastChatRendered=signature;el.innerHTML=messages.length?messages.map(m=>`<div class="chat-line"><span>${esc(m.by)} · ${new Date(m.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span><p>${esc(m.message)}</p></div>`).join(''):'<p class="muted">Converse com os amigos sobre rotas, obras e entregas.</p>';el.scrollTop=el.scrollHeight;
 }
 function selectedAction(){const s=getSite(selected),p=youObj();if(!s||!p)return null;if(!near(s))return {label:'↗ Ir',do:()=>routeTo(s.id)};
 if(s.type&&s.stock>0)return {label:'⛏️ Coletar',do:()=>send('collect',{node:s.id})};
 if(s.kind&&!s.completed)return {label:'🏗️ Entregar materiais',do:()=>send('deliverProject',{project:s.id})};
 if(s.id==='base'){if(Object.values(p.cargo||{}).some(q=>q>0))return {label:'📦 Descarregar',do:()=>send('unload')};if(world.factories.serraria&&world.inventory.madeira>=2)return {label:'🪚 Produzir tábuas',do:()=>send('craft',{recipe:'tabuas'})};return {label:'📋 Abrir depósito',do:()=>{document.querySelector('[data-mobile="base"]')?.click()}}}
 const contract=world.contracts.find(c=>c.town===s.id&&(p.cargo[c.type]||0)>=c.qty);
 if(contract)return {label:'✓ Entregar contrato',do:()=>send('contract',{id:contract.id})};
 const selling=Object.entries(p.cargo||{}).find(([r,q])=>q>0);
 if(selling)return {label:'💰 Vender carga',do:()=>send('sell',{town:s.id,resource:selling[0]})};
 return {label:'↗ Ver contratos',do:()=>{document.querySelector('[data-mobile="actions"]')?.click()}};
 }
 function renderQuick(){const el=$('quickAction'),site=getSite(selected);if(!site||!world){el.hidden=true;return}el.hidden=mode!=='pc';
  const hasPing=(world.pings||[]).some(x=>x.target===site.id),action=selectedAction();
  el.innerHTML=`<div><strong>${esc(site.emoji||'📍')} ${esc(site.name)}</strong><small>${hasPing?'📌 Sinalizado pela equipe':near(site)?'Você está no local':'Escolha uma ação ou navegue'}</small></div>${site.id==='base'?'':`<button class="btn small outline" data-ping="${esc(site.id)}">📌</button>`}<button class="btn small primary" id="contextDo">${action?.label||'↗ Ir'}</button><button class="quick-close" id="closeQuick" aria-label="Fechar seleção">×</button>`;
  el.querySelector('#contextDo').onclick=()=>selectedAction()?.do();el.querySelector('#closeQuick').onclick=()=>{selected='base';el.hidden=true;draw()};
 }
 function renderGoal(p){
  let message='';const w=world;
  if(!w.factories.serraria)message='🎯 Comece construindo a serraria no depósito para produzir tábuas.';
  else if((w.inventory.tabuas||0)<3&&!w.milestones?.primeiraProducao)message='🎯 Produza um lote na serraria para abastecer as cidades.';
  else if(w.missions?.length)message='🎯 Operação disponível: '+w.missions[0].title+' — '+w.missions[0].qty+' × '+RES[w.missions[0].resource][1]+'.';
  else if(w.contracts.length)message='🎯 Entregas em aberto: '+w.contracts[0].qty+' × '+RES[w.contracts[0].type][1]+' para '+(w.towns.find(t=>t.id===w.contracts[0].town)?.name||'cidade')+'.';
  else message='🎯 Explore uma região pelo GPS ou organize uma expedição virtual para descobrir oportunidades.';
  const goal=$('goalHint');
  goal.innerHTML=`<span>${esc(message)}</span><button type="button" class="btn small primary" data-nextstep="1">${!w.factories.serraria?'🏭 Ir construir':!w.milestones?.primeiraProducao?'🪚 Produzir lote':w.missions?.length||w.contracts?.length?'📦 Fazer entrega':'🥾 Explorar'}</button>`;
 }
 function performNextStep(){const w=world,p=youObj();if(!w||!p)return;
   if(!w.factories.serraria){if(near(BASE))send('build',{build:'serraria'});else routeTo('base');return;}
   if(!w.milestones?.primeiraProducao){if(near(BASE))send('craft',{recipe:'tabuas'});else routeTo('base');return;}
   const scope=w.missions?.length?'mission':'contract',job=w.missions?.[0]||w.contracts?.[0];
   if(!job){setMode('gps');return;}
   const type=scope==='mission'?job.resource:job.type,dest=w.towns.find(t=>t.id===job.town);
   if(near(dest)&&(p.cargo[type]||0)>=job.qty){send(scope==='mission'?'completeMission':'contract',{id:job.id});return;}
   if((p.cargo[type]||0)>=job.qty){routeTo(dest.id);return;}
   if(near(BASE))send('prepareDelivery',{scope,id:job.id});else routeTo('base');
 }
 function renderInitiatives(){const defs=[['deliveries','📦','Rede de abastecimento',25,15],['production','🏭','Polo industrial',12,8],['recovery','♻️','Economia circular',20,12]];
  $('initiatives').innerHTML=defs.map(([id,emoji,name,base,step])=>{const entry=world.initiatives?.[id]||{tier:1,progress:0};const target=base+step*(entry.tier-1),pct=Math.max(0,Math.min(100,Math.round(entry.progress/target*100)));
   return `<div class="initiative"><div class="initiative-head"><strong>${emoji} ${name}</strong><span>NV ${entry.tier}</span></div><div class="meter"><div style="width:${pct}%"></div></div><small>${entry.progress} / ${target} · prêmio em créditos, pesquisa e reputação</small></div>`;
  }).join('');
 }
 function renderRegions(){const el=$('townsState');if(!el)return;
  el.innerHTML=world.towns.map(t=>{
   const prosperity=Math.round(t.prosperity??60);
   const shortage=Object.entries(t.target||{}).map(([r,target])=>({r,gap:Math.max(0,target-(t.stock?.[r]||0)),ratio:Math.max(0,target-(t.stock?.[r]||0))/Math.max(1,target)})).sort((a,b)=>b.ratio-a.ratio)[0];
   return `<div class="town-health"><div class="town-head"><strong>${esc(t.name)}</strong><span class="${prosperity<35?'danger':prosperity>70?'ready':'muted'}">${prosperity}%</span></div><div class="meter"><div style="width:${prosperity}%"></div></div><small>Maior necessidade: ${shortage?`${RES[shortage.r][0]} ${RES[shortage.r][1]} (${shortage.gap} un.)`:'Sem dados'}</small></div>`;
  }).join('');
 }
 function renderMissions(){const el=$('missions');if(!el)return;const items=world.missions||[];
  $('missionsCount').textContent=items.length+' ATIVAS';
  el.innerHTML=items.length?items.map(m=>{const t=world.towns.find(x=>x.id===m.town),has=(youObj()?.cargo[m.resource]||0)>=m.qty,here=near(t);
   return `<div class="mission"><div class="mission-title"><strong>✦ ${esc(m.title)}</strong><span class="deadline ${(m.deadlineDay-world.day)<=3?'urgent':''}">D${m.deadlineDay}</span></div><p>${esc(m.description)}</p><small>📦 ${RES[m.resource][0]} ${m.qty} × ${RES[m.resource][1]} → ${esc(t?.name||m.town)}</small><div class="mission-bottom"><span>◆${money(m.reward)} · ◈2 · ★5</span><button class="btn small ${here&&has?'primary':'outline'}" data-mission="${m.id}">${here&&has?'✓ Entregar':has?'🚚 Ir até a cidade':near(BASE)?'📦 Preparar e partir':'↗ Voltar à base'}</button></div></div>`;
  }).join(''):'<p class="muted">Nenhuma missão por enquanto. Explore pelo GPS ou organize expedições remotas.</p>';
 }
 function renderProjects(){const visible=world.projects.filter(pr=>(world.discoveries?.[pr.kind]||0)>0);$('projectsCount').textContent=visible.length+'/3 DESCOBERTOS';
 $('projects').innerHTML=visible.length?visible.map(pr=>{const count=Object.entries(pr.need).reduce((a,[r,q])=>a+Math.min(pr.delivered[r]||0,q),0),need=Object.values(pr.need).reduce((a,b)=>a+b,0),pct=Math.round(count/need*100);return `<div class="project"><div class="project-head"><strong>${pr.emoji} ${esc(pr.name)}</strong><span>${pr.completed?'✓ Concluído':pr.funded?'Financiado':'Em aberto'}</span></div><p>${esc(pr.description)}</p><div class="project-track"><div style="width:${pct}%"></div></div><small>Materiais ${count}/${need} · ${Object.entries(pr.need).map(([r,q])=>RES[r][0]+(pr.delivered[r]||0)+'/'+q).join(' ')}</small><div class="project-actions">${pr.completed?'<span class="ready">Impacto permanente ativo</span>':`<button class="btn small" data-route="${pr.id}">↗ Obra</button>${pr.funded?'':`<button class="btn small outline" data-fund="${pr.id}">Financiar ◆${pr.fund} ◈${pr.intel}</button>`}`}</div></div>`}).join(''):'<p class="muted">Explore quadrantes via GPS ou complete expedições remotas para descobrir projetos que mudam o mapa.</p>';
 }
function renderEvent(){const evt=world.event,active=evt&&evt.until>=world.day;$('eventPanel').hidden=!active;if(!active)return;const town=world.towns.find(t=>t.id===evt.town);$('eventDetail').textContent=`📈 ${town?.name||'Mercado'} precisa de ${RES[evt.resource]?.[1]||'materiais'}: +${Math.round((evt.multiplier-1)*100)}% no preço de venda até o dia ${evt.until}.`;}
function renderSelected(){const el=$('selectedPlace'),s=getSite(selected),p=youObj();if(!s||!p){el.innerHTML='<span class="muted">Selecione um local no mapa.</span>';return}
 const distance=Math.round(haversine(p,s)),here=near(s);let content=`<div class="selected-symbol">${s.emoji||'📍'}</div><h3>${esc(s.name)}</h3><p>${distance.toLocaleString('pt-BR')} metros do seu caminhão · ${here?'Você está próximo':'Fora do alcance'}</p>`;
 if(s.id!=='base'){content+=`<button class="btn ${here?'outline':'primary'}" data-route="${esc(s.id)}">↗ ${here?'Definir rota':'Viajar para cá'}</button><button class="btn outline" data-ping="${esc(s.id)}">📌 Sinalizar</button>`}
 if(s.kind){const needs=Object.entries(s.need).map(([r,q])=>`${RES[r][0]} ${RES[r][1]}: ${s.delivered[r]||0}/${q}`).join(' · ');content+=`<div class="line"></div><p>${esc(s.description)}</p><p>${needs}</p><p>${s.completed?'✓ Projeto concluído e operando.':s.funded?'Financiamento confirmado.':'Financiamento: ◆'+s.fund+' · ◈'+s.intel}</p>`;if(!s.completed){if(!s.funded)content+=`<button class="btn small outline" data-fund="${s.id}">Financiar projeto</button>`;content+=`<button class="btn primary" data-donate="${s.id}" ${here?'':'disabled'}>Entregar materiais da carroceria</button>`}}
 else if(s.id==='base'){content+='<div class="line"></div><strong>Carregar materiais</strong><div style="margin-top:8px">';for(const [r,[emoji,name]] of Object.entries(RES)){content+=`<button class="btn small" data-load="${r}" ${here&&world.inventory[r]>0?'':'disabled'}>${emoji} ${name} +10</button>`}content+='</div><div class="line"></div><strong>Produção</strong><div style="margin-top:8px">';if(world.factories.serraria)content+=`<button class="btn small" data-craft="tabuas" ${here?'':'disabled'}>🪚 Produzir tábuas</button>`;if(world.factories.fundicao)content+=`<button class="btn small" data-craft="metal" ${here?'':'disabled'}>⚙️ Produzir metal</button>`;if(!world.factories.serraria&&!world.factories.fundicao)content+='<p>Construa instalações para iniciar a produção.</p>';content+='</div><div class="line"></div><button class="btn small outline" data-unload="1" '+(here?'':'disabled')+'>Descarregar caminhão</button>'}
 else if(s.type){content+=`<div class="line"></div><p>${RES[s.type][0]} ${RES[s.type][1]} disponível: ${s.stock} unidades.</p><button class="btn primary" data-collect="${esc(s.id)}" ${here&&s.stock>0?'':'disabled'}>Coletar até 10 unidades</button>`}
 else{content+=`<div class="line"></div><p>Prosperidade da cidade: ${Math.round(s.prosperity??60)}%. As entregas recuperam estoques e podem melhorar sua economia.</p>`;content+='<div class="line"></div><strong>Vender carga no mercado</strong><div style="margin-top:8px">';const carged=Object.entries(p.cargo).filter(([,q])=>q>0);if(!carged.length)content+='<p>Seu caminhão está vazio.</p>';for(const [r,q] of carged){content+=`<button class="btn small" data-sell="${r}" data-town="${s.id}" ${here?'':'disabled'}>Vender ${q} ${RES[r][1]} · ◆${money(q*marketPrice(s,r))}</button>`}content+='</div>'}
 el.innerHTML=content;renderQuick();
}
// Ações delegadas para elementos dinâmicos.
document.addEventListener('click',e=>{const b=e.target.closest('[data-build],[data-craft],[data-load],[data-collect],[data-contract],[data-route],[data-unload],[data-sell],[data-fund],[data-donate],[data-toggle-factory],[data-remove-player],[data-upgrade],[data-mission],[data-ping],[data-gps-open],[data-gps],[data-nextstep]');if(!b||!world)return;
 if(b.dataset.nextstep)performNextStep();else if(b.dataset.gps)handleGpsAction(b);else if(b.dataset.gpsOpen)setMode('gps');else if(b.dataset.ping)send('ping',{target:b.dataset.ping});else if(b.dataset.upgrade)send('upgrade',{upgrade:b.dataset.upgrade});else if(b.dataset.mission){const m=world.missions.find(x=>x.id===Number(b.dataset.mission));if(m){const dest=world.towns.find(t=>t.id===m.town);if(near(dest)&&(youObj()?.cargo[m.resource]||0)>=m.qty)send('completeMission',{id:m.id});else if((youObj()?.cargo[m.resource]||0)<m.qty){if(near(BASE))send('prepareDelivery',{scope:'mission',id:m.id});else{notice('Vamos preparar a carga na base.');routeTo('base')}}else routeTo(dest.id)}}else if(b.dataset.removePlayer)send('removePlayer',{player:b.dataset.removePlayer});else if(b.dataset.fund)send('fundProject',{project:b.dataset.fund});else if(b.dataset.donate)send('deliverProject',{project:b.dataset.donate});else if(b.dataset.toggleFactory)send('toggleFactory',{factory:b.dataset.toggleFactory});else if(b.dataset.build)send('build',{build:b.dataset.build});else if(b.dataset.craft)send('craft',{recipe:b.dataset.craft});else if(b.dataset.load)send('load',{resource:b.dataset.load,qty:10});else if(b.dataset.collect)send('collect',{node:b.dataset.collect});else if(b.dataset.unload)send('unload');else if(b.dataset.route)routeTo(b.dataset.route);else if(b.dataset.sell)send('sell',{town:b.dataset.town,resource:b.dataset.sell});else if(b.dataset.contract){const c=world.contracts.find(x=>x.id===Number(b.dataset.contract)),t=c&&world.towns.find(x=>x.id===c.town);if(c&&(youObj()?.cargo[c.type]||0)<c.qty){if(near(BASE))send('prepareDelivery',{scope:'contract',id:c.id});else{notice('Vamos preparar a carga na base.');routeTo('base')}}else if(c&&near(t))send('contract',{id:c.id});else if(t)routeTo(t.id)};
});
function proj(lat,lng,z=zoom){let size=256*2**z;let sin=Math.sin(lat*Math.PI/180);return {x:(lng+180)/360*size,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size}}
function inverse(x,y,z=zoom){const size=256*2**z,n=Math.PI-2*Math.PI*y/size;return {lng:x/size*360-180,lat:180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n)))}}
function toScreen(pos,w=canvas.clientWidth,h=canvas.clientHeight){if(mode==='pc'&&window.RotasScene){const q=window.RotasScene.project(pos,center,zoom,proj);return {x:q.x+w/2,y:q.y+h/2}}let at=proj(pos.lat,pos.lng),c=proj(center.lat,center.lng);return {x:(at.x-c.x)+w/2,y:(at.y-c.y)+h/2}}
function fromScreen(x,y){if(mode==='pc'&&window.RotasScene)return window.RotasScene.unproject(x-canvas.clientWidth/2,y-canvas.clientHeight/2,center,zoom,proj,inverse);let c=proj(center.lat,center.lng);return inverse(c.x+x-canvas.clientWidth/2,c.y+y-canvas.clientHeight/2)}
function ensureTile(z,x,y){const key=z+'/'+x+'/'+y;let tile=tileCache.get(key);if(tile)return tile;let img=new Image();tile={img,ok:false,failed:false};tileCache.set(key,tile);img.onload=()=>{tile.ok=true;draw()};img.onerror=()=>{tile.failed=true;draw()};img.src='https://tile.openstreetmap.org/'+z+'/'+x+'/'+y+'.png';
 if(tileCache.size>140){const it=tileCache.keys();for(let i=0;i<35;i++)tileCache.delete(it.next().value)}return tile}
function recordMotion(next){const now=typeof performance==='undefined'?Date.now():performance.now();for(const [id,p] of Object.entries(next.players||{})){const prior=world?.players?.[id];if(prior&&(Math.abs(p.lat-prior.lat)+Math.abs(p.lng-prior.lng))>0){const current=vehicleMotion.get(id);const from=current&&now-current.since<950?{lat:current.from.lat+(current.to.lat-current.from.lat)*Math.min(1,(now-current.since)/950),lng:current.from.lng+(current.to.lng-current.from.lng)*Math.min(1,(now-current.since)/950)}:{lat:prior.lat,lng:prior.lng};vehicleMotion.set(id,{from,to:{lat:p.lat,lng:p.lng},since:now});}}}
function vehicleAt(p){const m=vehicleMotion.get(p.id);if(!m)return p;const progress=Math.min(1,((typeof performance==='undefined'?Date.now():performance.now())-m.since)/950);return {lat:m.from.lat+(m.to.lat-m.from.lat)*progress,lng:m.from.lng+(m.to.lng-m.from.lng)*progress}}
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(mode==='pc'&&window.RotasScene){window.RotasScene.drawWorld({ctx,w,h,center,zoom,merc:proj,world,sites:sites()})}else{ctx.fillStyle='#b3d9bc';ctx.fillRect(0,0,w,h)}
 // Tiles OSM reais, carregados apenas para a área visível, nunca em lote.
 const iz=Math.max(10,Math.min(17,Math.floor(zoom))),scale=2**(zoom-iz),c=proj(center.lat,center.lng,iz),tileStartX=Math.floor((c.x-w/(2*scale))/256),tileEndX=Math.ceil((c.x+w/(2*scale))/256),tileStartY=Math.floor((c.y-h/(2*scale))/256),tileEndY=Math.ceil((c.y+h/(2*scale))/256);
 if(mode==='gps'){ctx.globalAlpha=1;for(let tx=tileStartX;tx<=tileEndX;tx++)for(let ty=tileStartY;ty<=tileEndY;ty++){if(tx<0||ty<0||tx>=2**iz||ty>=2**iz)continue;const t=ensureTile(iz,tx,ty),sx=(tx*256-c.x)*scale+w/2,sy=(ty*256-c.y)*scale+h/2;if(t.ok)ctx.drawImage(t.img,sx,sy,256*scale+1,256*scale+1)}ctx.globalAlpha=1;}
 if(mode==='gps'){ctx.fillStyle='rgba(255,255,240,0.05)';ctx.fillRect(0,0,w,h);}
 // Linha de rota destacada também sobre o terreno isométrico.
 if(mode==='pc'&&youObj()?.route){const truck=youObj(),points=truck.route.points.slice(truck.route.index||0);ctx.save();ctx.beginPath();const start=toScreen(truck);ctx.moveTo(start.x,start.y);for(const wp of points){const q=toScreen(wp);ctx.lineTo(q.x,q.y)}ctx.strokeStyle='#143c35';ctx.lineWidth=10;ctx.setLineDash([]);ctx.stroke();ctx.strokeStyle='#f6e17f';ctx.lineWidth=5;ctx.setLineDash([12,6]);ctx.stroke();ctx.setLineDash([]);ctx.restore();}

 // Corredores de transporte sobre a cartografia; terreno do jogo é inteiramente fictício.
 if(mode==='gps'&&world?.roads){for(const [a,b] of world.roads.edges){let x=toScreen(world.roads.points[a]),y=toScreen(world.roads.points[b]);ctx.beginPath();ctx.moveTo(x.x,x.y);ctx.lineTo(y.x,y.y);ctx.strokeStyle=(a==='ponte'||b==='ponte')&&world.projects.find(pr=>pr.id==='ponte')?.completed?'rgba(141,247,171,.86)':'rgba(169,222,199,.34)';ctx.lineWidth=4;ctx.stroke();ctx.lineWidth=1;ctx.strokeStyle='#122e2c';ctx.stroke();}
 const p=youObj();if(p?.route){ctx.beginPath();let at=toScreen(p);ctx.moveTo(at.x,at.y);for(const point of p.route.points.slice(p.route.index)){const pt=toScreen(point);ctx.lineTo(pt.x,pt.y)}ctx.setLineDash([10,5]);ctx.lineWidth=4;ctx.strokeStyle='#d6ff90';ctx.stroke();ctx.setLineDash([]);}
 }
 markerHits=[];
 if(mode==='gps')for(const s of sites())drawTerrain(s);
 for(const s of sites())drawMarker(s);
 if(mode==='gps'){for(const q of nearbyPOIs){const pt=toScreen(q);if(pt.x<-60||pt.y<-60||pt.x>w+60||pt.y>h+60)continue;const active=gpsTarget===q.id;ctx.save();ctx.shadowColor='#234c45aa';ctx.shadowBlur=9;ctx.shadowOffsetY=4;ctx.beginPath();ctx.arc(pt.x,pt.y,active?24:19,0,2*Math.PI);ctx.fillStyle=active?'#f8d77c':'#fafcf4';ctx.fill();ctx.strokeStyle=active?'#35584c':'#6b8877';ctx.lineWidth=3;ctx.stroke();ctx.restore();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=(active?22:19)+'px system-ui';ctx.fillText(POI_LABELS[q.category]?.[0]||'📍',pt.x,pt.y);if(active){ctx.font='bold 11px system-ui';const name=String(q.name).slice(0,28);const lw=Math.max(100,ctx.measureText(name).width+22);ctx.fillStyle='#143c32';rounded(ctx,pt.x-lw/2,pt.y+28,lw,23,7);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(name,pt.x,pt.y+40)}markerHits.push({id:'poi:'+q.id,x:pt.x,y:pt.y,w:70,r:24})}
  const target=nearbyPOIs.find(q=>q.id===gpsTarget);if(target&&gpsPosition){const a=toScreen(gpsPosition),b=toScreen(target);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.setLineDash([8,7]);ctx.lineWidth=4;ctx.strokeStyle='#fc9537';ctx.stroke();ctx.setLineDash([])} }
  for(const ping of (world?.pings||[])){const target=getSite(ping.target);if(!target)continue;const pt=toScreen(target);ctx.fillStyle='#ffe19f';ctx.font='22px system-ui';ctx.textAlign='center';ctx.fillText('📍',pt.x+23,pt.y-10)}
 if(world){Object.values(world.players).forEach((p,i)=>{const o=toScreen(vehicleAt(p));if(o.x<-70||o.y<-70||o.x>w+70||o.y>h+70)return;ctx.beginPath();ctx.arc(o.x,o.y,19,0,Math.PI*2);ctx.fillStyle=p.id===you?'rgba(172,245,137,.28)':'rgba(109,214,232,.26)';ctx.fill();ctx.beginPath();ctx.arc(o.x,o.y,13,0,Math.PI*2);ctx.fillStyle=p.id===you?'#b3f2a2':'#b8e3f1';ctx.fill();ctx.textAlign='center';ctx.textBaseline='middle';if(mode==='pc'&&window.RotasScene)window.RotasScene.drawTruck(ctx,o.x,o.y,p.id===you,p.name);else{ctx.font='16px sans-serif';ctx.fillText('🚚',o.x,o.y+1);ctx.font='bold 10px system-ui';ctx.fillStyle='#fff';ctx.fillText(p.name,o.x,o.y-28)}})}
 if(gpsPosition&&mode==='gps'){const a=toScreen(gpsPosition),r=Math.max(20,Math.min(150,gpsPosition.accuracy/3));ctx.beginPath();ctx.arc(a.x,a.y,r,0,2*Math.PI);ctx.fillStyle='rgba(37,120,235,.12)';ctx.fill();ctx.strokeStyle='rgba(43,108,213,.35)';ctx.stroke();ctx.beginPath();ctx.arc(a.x,a.y,11,0,2*Math.PI);ctx.fillStyle='#2576eb';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();}
 $('coordinates').textContent=Math.abs(center.lat).toFixed(3)+'° '+(center.lat<0?'S':'N')+' · '+Math.abs(center.lng).toFixed(3)+'° '+(center.lng<0?'O':'L');}
function drawTerrain(s){
 const pos=toScreen(s),w=canvas.clientWidth,h=canvas.clientHeight;
 if(pos.x<-160||pos.y<-160||pos.x>w+160||pos.y>h+160)return;
 const scale=Math.max(.65,Math.min(1.9,2**((zoom-13.6)*.43))),x=pos.x,y=pos.y;
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 if(s.type==='madeira'){
  ctx.fillStyle='rgba(46,110,66,.25)';ctx.beginPath();ctx.ellipse(0,0,83,69,0,0,Math.PI*2);ctx.fill();
  for(const [dx,dy,r] of [[-43,-30,16],[-7,-53,14],[42,-30,18],[-54,21,16],[-5,35,20],[42,26,15]]){ctx.beginPath();ctx.arc(dx,dy,r,0,Math.PI*2);ctx.fillStyle='#2d704c99';ctx.fill();ctx.strokeStyle='#7fbd80aa';ctx.lineWidth=1.5;ctx.stroke();}
 }else if(s.type==='minerio'){
  ctx.fillStyle='#787d70aa';ctx.beginPath();ctx.ellipse(0,0,77,51,0,0,Math.PI*2);ctx.fill();
  for(const [dx,dy,r] of [[-45,-15,20],[30,-37,17],[54,20,17],[-18,38,16]]){ctx.beginPath();ctx.moveTo(dx-r,dy+r/2);ctx.lineTo(dx,dy-r);ctx.lineTo(dx+r,dy+r/2);ctx.closePath();ctx.fillStyle='#b4b7a2aa';ctx.fill();}
 }else if(s.type==='sucata'){
  ctx.fillStyle='#47686599';ctx.fillRect(-66,-42,132,86);for(const [dx,dy] of [[-51,-27],[22,-26],[-45,16],[18,18]]){ctx.fillStyle='#b39b67bb';ctx.fillRect(dx,dy,31,17);ctx.strokeStyle='#e2cea388';ctx.strokeRect(dx,dy,31,17);}
 }else if(s.id==='base'){
  ctx.fillStyle='#25443dcc';ctx.fillRect(-87,-51,174,103);ctx.strokeStyle='#8abbaa';ctx.lineWidth=1.5;ctx.strokeRect(-87,-51,174,103);
  for(const [dx,dy,icon,active] of [[-64,-31,'🏭',true],[30,-30,'🪚',!!world?.factories?.serraria],[-64,18,'⚙️',!!world?.factories?.fundicao],[30,18,'📦',!!world?.factories?.logistica]]){
   ctx.fillStyle=active?'#497960':'#264741';ctx.fillRect(dx,dy,42,31);ctx.strokeStyle=active?'#c1deb2':'#528675';ctx.strokeRect(dx,dy,42,31);ctx.font='19px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(icon,dx+21,dy+16);
  }
 }else if(s.target){
  ctx.fillStyle='rgba(63,101,100,.30)';ctx.beginPath();ctx.arc(0,0,74,0,Math.PI*2);ctx.fill();
  for(const [dx,dy] of [[-50,-42],[34,-49],[-52,22],[34,22]]){ctx.fillStyle='#8bb2a277';ctx.fillRect(dx,dy,26,29);ctx.strokeStyle='#adcab799';ctx.strokeRect(dx,dy,26,29);ctx.fillStyle='#203a38';ctx.fillRect(dx+6,dy+12,8,9)}
 }else if(s.kind){
  ctx.beginPath();ctx.arc(0,0,62,0,Math.PI*2);ctx.setLineDash([4,7]);ctx.lineWidth=3;ctx.strokeStyle=s.completed?'#b5f198':'#eacb86';ctx.stroke();ctx.setLineDash([]);
  if(!s.completed){const progress=Object.entries(s.need).reduce((sum,[r,q])=>sum+Math.min(q,s.delivered?.[r]||0),0)/Math.max(1,Object.values(s.need).reduce((a,b)=>a+b,0));ctx.beginPath();ctx.arc(0,0,62,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.lineWidth=5;ctx.strokeStyle='#a4ef8c';ctx.stroke();}
 }
 ctx.restore();
}
function drawMarker(s){const pos=toScreen(s);if(pos.x<-100||pos.y<-100||pos.x>canvas.clientWidth+100||pos.y>canvas.clientHeight+100)return;
 const chosen=s.id===selected,r=s.id==='base'?19:16;
 ctx.beginPath();ctx.arc(pos.x,pos.y,r+7,0,2*Math.PI);ctx.fillStyle=chosen?'#a9ef7b55':'#051d24aa';ctx.fill();ctx.beginPath();ctx.arc(pos.x,pos.y,r,0,2*Math.PI);ctx.fillStyle=chosen?'#b8ef9b':'#153a39';ctx.fill();ctx.strokeStyle=chosen?'#f1ffed':'#83b19c';ctx.lineWidth=2;ctx.stroke();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='19px sans-serif';ctx.fillText(s.emoji||'📌',pos.x,pos.y+1);
 ctx.font='600 11px system-ui';const label=s.name,width=Math.max(65,ctx.measureText(label).width+21);const lx=pos.x-width/2,ly=pos.y+r+8;ctx.fillStyle=chosen?'#b8ef9b':'rgba(7,28,30,.93)';rounded(ctx,lx,ly,width,23,6);ctx.fill();ctx.fillStyle=chosen?'#102720':'#e1ede6';ctx.fillText(label,pos.x,ly+12);
 if(s.target){const prosperity=Math.max(0,Math.min(100,s.prosperity??60));ctx.fillStyle='#122b28';ctx.fillRect(pos.x-21,pos.y+37,42,4);ctx.fillStyle=prosperity<35?'#f8ac8a':prosperity>70?'#bafa92':'#f6cf79';ctx.fillRect(pos.x-21,pos.y+37,42*prosperity/100,4)}
  markerHits.push({id:s.id,x:pos.x,y:pos.y,w:Math.max(width,44),r:r+8});}
function updateGpsWaypoint(){const el=$('gpsWaypoint');if(!el)return;const q=nearbyPOIs.find(q=>q.id===gpsTarget);el.hidden=mode!=='gps'||!q;if(!q)return;const dist=gpsPosition?Math.round(haversine(gpsPosition,q))+' m de você':'Ative o GPS para calcular distância';el.innerHTML=`<div><strong>${POI_LABELS[q.category]?.[0]||'📍'} ${esc(q.name)}</strong><small>${esc(dist)} · ponto público mapeado</small></div><button class="btn small primary" data-gps="visitPoi" data-poi="${esc(q.id)}">Registrar visita</button><button class="quick-close" id="waypointClose" aria-label="Fechar">×</button>`;el.querySelector('#waypointClose').onclick=()=>{gpsTarget=null;el.hidden=true;draw()}}
function rounded(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function mapClick(x,y){const hit=markerHits.slice().reverse().find(m=>Math.abs(x-m.x)<Math.max(25,m.w/2)&&y>m.y-30&&y<m.y+60);if(hit?.id.startsWith('poi:')){gpsTarget=hit.id.slice(4);updateGpsWaypoint();draw();return}if(hit){selected=hit.id;follow=false;renderSelected();$('statusText').textContent='Local selecionado: '+(getSite(selected)?.name||selected)}else{const geo=fromScreen(x,y);$('statusText').textContent='Clique em um marcador para calcular uma rota pelos corredores fictícios.';}draw()}
const touchPoints=new Map();let pinch=null;
canvas.addEventListener('pointerdown',e=>{touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(touchPoints.size===2){const a=[...touchPoints.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom};drag=null;return}drag={x:e.clientX,y:e.clientY,center:{...center},moved:false}});
canvas.addEventListener('pointermove',e=>{if(touchPoints.has(e.pointerId))touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size===2&&pinch){const a=[...touchPoints.values()],distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch.distance>10){zoom=Math.max(10,Math.min(17,pinch.zoom+Math.log2(Math.max(1,distance)/pinch.distance)));draw()}return}if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){follow=false;let origin=proj(drag.center.lat,drag.center.lng);if(mode==='pc'&&window.RotasScene){const d=window.RotasScene.deiso(dx,dy);center=inverse(origin.x-d.x,origin.y-d.y)}else center=inverse(origin.x-dx,origin.y-dy);draw()}});
canvas.addEventListener('pointerup',e=>{touchPoints.delete(e.pointerId);if(pinch){if(touchPoints.size<2)pinch=null;drag=null;return}if(!drag)return;const moved=drag.moved;drag=null;if(!moved){const r=canvas.getBoundingClientRect();mapClick(e.clientX-r.left,e.clientY-r.top)}});
canvas.addEventListener('pointercancel',e=>{touchPoints.delete(e.pointerId);pinch=null;drag=null});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(10,Math.min(17,zoom+(e.deltaY<0?.28:-.28)));draw()},{passive:false});
const keys=new Set();window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;const k=e.key.toLowerCase();if(k==='e'&&mode==='pc'&&world){e.preventDefault();selectedAction()?.do();return}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();keys.add(k)}});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
setInterval(()=>{if(!world||mode==='gps')return;let dx=0,dy=0;if(keys.has('w')||keys.has('arrowup'))dy++;if(keys.has('s')||keys.has('arrowdown'))dy--;if(keys.has('a')||keys.has('arrowleft'))dx--;if(keys.has('d')||keys.has('arrowright'))dx++;if(dx||dy){follow=true;send('drive',{dx,dy})}},145);
let mobileKey=null;document.querySelectorAll('[data-dx]').forEach(btn=>{btn.addEventListener('pointerdown',e=>{e.preventDefault();mobileKey={dx:Number(btn.dataset.dx),dy:Number(btn.dataset.dy)};btn.setPointerCapture(e.pointerId)});const stop=()=>{mobileKey=null};btn.addEventListener('pointerup',stop);btn.addEventListener('pointercancel',stop)});
setInterval(()=>{if(mobileKey&&mode==='pc'&&world){follow=true;send('drive',mobileKey)}},155);
window.addEventListener('resize',draw);document.querySelectorAll('[data-mobile]').forEach(b=>b.onclick=()=>{mobileTab=b.dataset.mobile;document.querySelectorAll('[data-mobile]').forEach(x=>x.classList.toggle('selected',x===b));$('app').querySelector('.layout').classList.remove('mobile-actions','mobile-base');if(mobileTab==='actions')$('app').querySelector('.layout').classList.add('mobile-actions');if(mobileTab==='base')$('app').querySelector('.layout').classList.add('mobile-base');draw()});
// O GPS exige HTTPS; as ruas OSM são a base cartográfica, não a malha de direção.
if(navigator.serviceWorker?.register){navigator.serviceWorker.register('/sw.js').catch(()=>{})}
draw();
let lastAnim=0;function animationFrame(now){if(now-lastAnim>100&&world&&mode==='pc'&&Object.values(world.players||{}).some(p=>p.route||(vehicleMotion.has(p.id)&&now-vehicleMotion.get(p.id).since<1000))){lastAnim=now;draw();}requestAnimationFrame(animationFrame)}if(typeof requestAnimationFrame==='function')requestAnimationFrame(animationFrame);
})();
