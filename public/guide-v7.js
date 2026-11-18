'use strict';
// Guia contextual e HUD da Alfa 0.7: lê o mesmo estado que o jogo principal.
(() => {
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const res={madeira:['🪵','Madeira'],minerio:['🪨','Minério'],sucata:['🔩','Sucata'],tabuas:['🪚','Tábuas'],metal:['⚙️','Metal']};
 const stepData=[
  {icon:'🌍',title:'Por que estamos aqui?',body:'Vocês são uma cooperativa que ajuda cidades a prosperar. O mundo produz e consome. Cada entrega diminui a escassez e fortalece uma cidade. O grande objetivo é conectar toda a região.',tip:'Olhe o painel à esquerda para ver o capítulo atual da campanha.'},
  {icon:'🏭',title:'Produção: da madeira à tábua',body:'Comece no Depósito Central. Construa a serraria (◆360 e 6 madeiras) e produza tábuas: a cada 2 madeiras, você recebe 1 tábua. Depósitos guardam recursos para toda a equipe.',tip:'Botões de construção e produção ficam na coluna esquerda.'},
  {icon:'🚚',title:'Caminhão: a peça que conecta tudo',body:'Você controla um caminhão próprio. Ele coleta recursos na floresta, na pedreira ou no pátio; carrega mercadorias no depósito; entrega nas cidades. Todos veem o movimento no mesmo mapa.',tip:'O cartão CARGA exibe tudo que você transporta. Clique num local para traçar uma rota.'},
  {icon:'📦',title:'Contratos: a cidade precisa de você',body:'Escolha um pedido na coluna direita. Na base, use Preparar e partir. Seu caminhão pega a carga disponível e segue pela rota. Ao chegar, clique em Entregar e receber para concluir.',tip:'Entregar aumenta o caixa compartilhado, a reputação e o estoque da cidade.'},
  {icon:'🗺️',title:'GPS: descobrir muda o mundo',body:'No celular, troque para Explorar GPS, permita localização e visite lugares públicos ou complete caminhadas em três setores distintos. Isso gera sinais para melhorias exclusivas da cooperativa.',tip:'Nunca use o jogo ao dirigir ou entre em propriedade privada.'},
  {icon:'🎯',title:'O que fazer agora?',body:'Siga a meta do capítulo no painel esquerdo e o Próximo passo abaixo do mapa. Não precisa aprender tudo: o jogo explica o que falta para produzir, carregar, viajar e entregar.',tip:'Você pode reabrir este guia no botão ? a qualquer momento.'}
 ];
 let tourIndex=0,shown=false,lastPlayer=null,lastChapter=0,latest=null;
 const layout=$('app')?.querySelector('.layout');if(!layout)return;
 const left=layout.querySelector('.leftbar'),right=layout.querySelector('.rightbar');
 const campaign=document.createElement('section');campaign.id='rvCampaign';campaign.className='rv-campaign boxed';left.querySelector('.section-title')?.after(campaign);
 const truck=document.createElement('section');truck.id='rvTruck';truck.className='rv-truck boxed';left.querySelector('.section-title')?.after(truck);campaign.after(truck);
 const guide=document.createElement('section');guide.id='rvGuide';guide.className='rv-guide boxed';right.querySelector('.section-title')?.after(guide);
 const more=document.createElement('button');more.id='rvMore';more.type='button';more.className='btn outline rv-more';more.textContent='＋ Exibir sistemas avançados';left.append(more);
 const baseButton=document.createElement('button');baseButton.id='rvMobileBase';baseButton.type='button';baseButton.className='btn small outline';baseButton.textContent='🏭 Base';$('panelToggle')?.before(baseButton);
 baseButton.onclick=()=>{document.body.classList.remove('panels-open');document.body.classList.toggle('rv-base-open')};
 $('panelToggle')?.addEventListener('click',()=>{document.body.classList.remove('rv-base-open')});
 const mini=document.createElement('button');mini.id='rvGuideOpen';mini.className='btn rv-guide-open';mini.textContent='? Como jogar';right.append(mini);
 const flame=document.createElement('div');flame.id='rvFloat';flame.className='rv-float';flame.setAttribute('aria-live','polite');$('map').parentNode.append(flame);
 const modal=document.createElement('div');modal.id='rvTour';modal.className='rv-tour-back';modal.hidden=true;
 modal.innerHTML=`<section class="rv-tour" role="dialog" aria-modal="true" aria-labelledby="rvTourTitle"><div class="rv-tour-upper"><strong>ROTAS VIVAS · TUTORIAL</strong><button type="button" id="rvTourClose" aria-label="Fechar tutorial">×</button></div><div id="rvTourBody"></div><div class="rv-tour-foot"><span id="rvTourCounter"></span><div><button class="btn outline" id="rvTourBack">Anterior</button><button class="btn primary" id="rvTourNext">Continuar</button></div></div></section>`;
 document.body.append(modal);
 left.querySelectorAll('.panel.boxed,.panel:not(.contracts-panel)').forEach((el,i)=>{if(![2,3,5].includes(i))el.classList.add('rv-advanced')});
 right.querySelectorAll('.panel').forEach(el=>{if(!el.classList.contains('selected-place')&&!el.classList.contains('contracts-panel'))el.classList.add('rv-advanced')});
 const stepRendered=()=>{let st=stepData[tourIndex];$('rvTourBody').innerHTML=`<div class="rv-tour-icon">${st.icon}</div><h2 id="rvTourTitle">${st.title}</h2><p>${st.body}</p><div class="rv-tour-tip"><strong>NA PRÁTICA</strong><span>${st.tip}</span></div><div class="rv-tour-dots">${stepData.map((_,i)=>`<span class="${i===tourIndex?'active':''}"></span>`).join('')}</div>`;$('rvTourCounter').textContent=`${tourIndex+1} de ${stepData.length}`;$('rvTourBack').disabled=tourIndex===0;$('rvTourNext').textContent=tourIndex===stepData.length-1?'Começar a jogar':'Continuar'};
 const openTour=(i=0)=>{tourIndex=i;stepRendered();modal.hidden=false;document.body.classList.add('rv-tour-open')};
 const closeTour=()=>{modal.hidden=true;document.body.classList.remove('rv-tour-open');try{localStorage.setItem('rv-tour-seen-v7','1')}catch{}};
 $('rvTourClose').onclick=closeTour;$('rvTourBack').onclick=()=>{tourIndex=Math.max(0,tourIndex-1);stepRendered()};$('rvTourNext').onclick=()=>{if(tourIndex<stepData.length-1){tourIndex++;stepRendered()}else closeTour()};
 modal.addEventListener('click',e=>{if(e.target===modal)closeTour()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeTour()});
 $('rvGuideOpen').onclick=()=>openTour(0);$('helpBtn').onclick=()=>openTour(0);more.onclick=()=>{const active=document.body.classList.toggle('rv-expanded');more.textContent=active?'− Ocultar sistemas avançados':'＋ Exibir sistemas avançados'};
 const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
 const formattedTime=s=>s<60?`${Math.max(1,Math.ceil(s))} s`:`${Math.ceil(s/60)} min`;
 function goalInfo(w){const t=w.towns||[],total=t.reduce((a,x)=>a+(x.delivered||0),0),works=(w.projects||[]).filter(x=>x.completed).length,chapter=w.campaign?.chapter||1;
  if(chapter===1){const a=!!w.milestones?.primeiraProducao,b=!!w.milestones?.primeiraEntrega;return {chapter,title:'Primeiros abastecimentos',description:'Faça funcionar a primeira cadeia produtiva e ajude uma cidade.',progress:Number(a)+Number(b),total:2,checks:[[a,'Produzir tábuas ou metal'],[b,'Concluir uma entrega']]}};
  if(chapter===2)return {chapter,title:'Conectar a região',description:'As entregas financiam obras que encurtam caminhos e ampliam a economia.',progress:Math.min(35,total)/35+(works?1:0),total:2,checks:[[total>=35,`${Math.min(35,total)} / 35 unidades entregues às cidades`],[works>=1,`${works} / 1 obra regional concluída`]]};
  if(chapter===3){const ok=t.filter(x=>x.prosperity>=65).length;return {chapter,title:'Recuperar as três cidades',description:'Entregue o que está faltando para elevar a prosperidade.',progress:ok/3+(Math.min(works,2)/2),total:2,checks:[[ok===3,`${ok} / 3 cidades com prosperidade ≥ 65`],[works>=2,`${Math.min(works,2)} / 2 obras concluídas`]]}};
  return {chapter,title:'Sua região, suas escolhas',description:'As cidades continuam precisando de abastecimento. Expanda sua logística, explore pelo GPS e crie uma região cada vez melhor.',progress:1,total:1,checks:[[true,'Três capítulos regionais concluídos'],[true,'Continue objetivos coletivos e contratos']]};
 }
 function recommended(w,p){const contract=(w.contracts||[]).find(c=>c.town&&(p.cargo?.[c.type]||0)>=c.qty);
  const nearTown=contract&&w.towns.find(t=>t.id===contract.town&&Math.hypot(p.lat-t.lat,p.lng-t.lng)<.003);
  if(nearTown)return {label:`✓ Entregar ${contract.qty} ${res[contract.type]?.[1]||contract.type} em ${nearTown.name}`,detail:'Sua carga já está no destino. Confirme a entrega para receber o pagamento.',action:'deliver',id:contract.id};
  if(p.route)return {label:'🚚 Acompanhe o caminhão',detail:'A carga está a caminho. A chegada não conclui o contrato sozinha.',action:'none'};
  if(!w.factories?.serraria)return {label:'🏭 Construir a serraria',detail:'Na base, gaste ◆360 e 6 madeiras para desbloquear a produção.',action:'next'};
  if(!w.milestones?.primeiraProducao)return {label:'🪚 Produzir as primeiras tábuas',detail:'Cada lote consome 2 madeiras por tábua. Produza na base.',action:'next'};
  const c=(w.contracts||[])[0];return c?{label:`📦 Preparar entrega para ${(w.towns.find(t=>t.id===c.town)||{}).name||'cidade'}`,detail:`São necessárias ${c.qty} ${res[c.type]?.[1]||c.type}. O caminhão busca a carga no depósito.`,action:'next'}:{label:'🌍 Explorar e desenvolver',detail:'Procure oportunidades no mapa ou no GPS.',action:'next'};
 }
 function show(w,you){const p=w.players?.[you];if(!p)return;latest={w,you};
  const c=goalInfo(w);if(lastChapter&&lastChapter!==c.chapter){showFloat(`🏅 Capítulo ${lastChapter} concluído!`,true)}lastChapter=c.chapter;
  campaign.innerHTML=`<div class="rv-panel-kicker">A MISSÃO DA COOPERATIVA</div><h3>Capítulo ${c.chapter} · ${escape(c.title)}</h3><p>${escape(c.description)}</p><div class="rv-progress"><i style="width:${Math.min(100,100*c.progress/c.total)}%"></i></div><div class="rv-checks">${c.checks.map(([ok,label])=>`<div class="${ok?'done':''}"><span>${ok?'✓':'○'}</span>${escape(label)}</div>`).join('')}</div><button class="rv-textbutton" id="rvWhy">Por que isso importa? →</button>`;
  $('rvWhy').onclick=()=>openTour(0);
  const load=Object.values(p.cargo||{}).reduce((a,v)=>a+v,0),capacity=(w.factories?.logistica?32:20)+(w.upgrades?.fleet?12:0),route=p.route;
  let rest=0;if(route){let at=p;for(const point of route.points.slice(route.index||0)){const R=6371000,dLat=(point.lat-at.lat)*Math.PI/180,dLon=(point.lng-at.lng)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(at.lat*Math.PI/180)*Math.cos(point.lat*Math.PI/180)*Math.sin(dLon/2)**2;rest+=2*R*Math.asin(Math.sqrt(a));at=point;}}
  const site=route&&[...(w.towns||[]),...(w.nodes||[]),...(w.projects||[]),{id:'base',name:'Depósito Central'}].find(s=>s.id===route.id);
  truck.innerHTML=`<div class="rv-truck-head"><span>🚚 MEU CAMINHÃO</span><span>${load}/${capacity} espaços</span></div><div class="rv-load-bar"><i style="width:${Math.min(100,load/capacity*100)}%"></i></div><div class="rv-loads">${Object.entries(p.cargo||{}).filter(([,q])=>q>0).map(([key,q])=>`<span>${res[key]?.[0]||'📦'} ${escape(res[key]?.[1]||key)} <b>×${q}</b></span>`).join('')||'<span class="rv-empty">Carroceria vazia · colete ou carregue na base</span>'}</div><div class="rv-route">${route?`<b>↗ ${escape(site?.name||'Destino')}</b><small>${(rest/1000).toFixed(1)} km · ${formattedTime(rest/(w.routeSpeed||25))} estimados no jogo</small>`:'<b>● Estacionado</b><small>Selecione um lugar no mapa para traçar uma rota</small>'}</div><small class="rv-eta-note">Trajetos do jogo · sem trânsito em tempo real</small>`;
  const rec=recommended(w,p);guide.innerHTML=`<span class="rv-panel-kicker">FAÇA AGORA</span><h3>${escape(rec.label)}</h3><p>${escape(rec.detail)}</p><button class="btn primary" id="rvDo">${rec.action==='deliver'?'Concluir entrega →':'Mostrar próximo passo →'}</button><button class="rv-textbutton" id="rvMoreOptions">Ver todos os contratos e sistemas</button>`;
  $('rvDo').onclick=()=>{if(rec.action==='deliver')window.RotasBridge?.send('contract',{id:rec.id});else if(rec.action==='next')document.querySelector('[data-nextstep]')?.click();else $('map')?.scrollIntoView({block:'center'})};
  $('rvMoreOptions').onclick=()=>{document.body.classList.add('rv-expanded');more.textContent='− Ocultar sistemas avançados';right.querySelector('.contracts-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'})};
  if(!shown&&document.getElementById('joinVeil').classList.contains('hidden')){shown=true;try{if(!localStorage.getItem('rv-tour-seen-v7'))setTimeout(()=>openTour(0),600)}catch{}}
 }
 function showFloat(message,wide=false){flame.textContent=message;flame.classList.remove('rv-pop');void flame.offsetWidth;flame.classList.add('rv-pop');if(wide)flame.style.background='#174b35';else flame.style.background='';}
 window.addEventListener('rotas:state',e=>show(e.detail.world,e.detail.you));
 window.addEventListener('rotas:effect',e=>showFloat(e.detail.message||'Ação concluída'));
 window.addEventListener('rotas:mode',e=>{document.body.classList.toggle('rv-gps-mode',e.detail.mode==='gps')});
 document.addEventListener('click',e=>{const b=e.target.closest('button[data-contract],button[data-nextstep],button[data-load],button[data-collect],button[data-craft],button[data-build],button[data-mission],button[data-unload],button[data-sell]');if(!b||b.disabled)return;b.classList.add('rv-pending');setTimeout(()=>b.classList.remove('rv-pending'),550)},true);
})();