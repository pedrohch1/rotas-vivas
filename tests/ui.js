'use strict';
// Verificação da camada de interface com DOM e canvas simulados (não substitui teste visual em navegador).
const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),elements=new Map();
const noop=()=>{};let ws;
function element(id){return {id,clientWidth:900,clientHeight:530,width:900,height:530,value:'',textContent:'',innerHTML:'',style:{},dataset:{},
 classList:{add:noop,remove:noop,toggle:noop},listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},append:noop,appendChild:noop,remove:noop,
 querySelector(){return element('child')},closest(){return null},setPointerCapture:noop,getBoundingClientRect(){return {left:0,top:0}}};}
for(const id of ids)elements.set(id,element(id));
const ctx=new Proxy({measureText:txt=>({width:String(txt).length*6})},{get(target,key){return key in target?target[key]:noop},set(){return true}});
elements.get('map').getContext=()=>ctx;elements.get('map').parentElement={appendChild:el=>elements.set(el.id,el)};
const fakeDocument={getElementById:id=>elements.get(id),createElement:()=>element('new'),querySelectorAll:()=>[],addEventListener:noop};
const fakeWindow={isSecureContext:true,addEventListener:noop};
class MockSocket{constructor(url){this.url=url;this.readyState=1;this.listeners={};this.sent=[];ws=this;}addEventListener(e,fn){this.listeners[e]=fn;}send(text){this.sent.push(JSON.parse(text));}close(){}emit(type,msg){this.listeners[type]?.(type==='message'?{data:JSON.stringify(msg)}:{})}}
const local={getItem:()=>'',setItem:noop};
const context={window:fakeWindow,document:fakeDocument,navigator:{},WebSocket:MockSocket,URLSearchParams,location:{search:'',protocol:'http:',host:'localhost:3000',origin:'http://localhost:3000'},history:{replaceState:noop},crypto:require('node:crypto').webcrypto,localStorage:local,Image:class{set src(value){this.url=value;}},TextEncoder,setTimeout:noop,setInterval:noop,devicePixelRatio:1};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8'),context,{filename:'app.js'});
elements.get('playerName').value='Teste';elements.get('roomCode').value='TSTU02';elements.get('joinBtn').onclick();ws.emit('open');
assert.ok(ws.sent[0].type==='join');
ws.emit('message',{type:'joined',token:'dummy-token',room:'TSTU02'});
const base={lat:-23.8299,lng:-46.7198},pr={id:'ponte',name:'Ponte das Conexões',emoji:'🌉',kind:'infra',lat:-23.8366,lng:-46.7425,description:'Ligação regional',need:{madeira:10,metal:5},fund:240,intel:3,delivered:{madeira:4},funded:true,completed:false};
const state={code:'TSTU02',owner:'p1',money:1000,intel:8,reputation:15,day:3,priceWave:0,inventory:{madeira:12,minerio:8,sucata:4,tabuas:1,metal:6},
 factories:{serraria:true,fundicao:false,logistica:false},factoryActive:{serraria:false,fundicao:false},upgrades:{fleet:false,navigation:true,network:false},missions:[{id:1,kind:'infra',title:'Manutenção de vias',resource:'metal',qty:3,town:'lago',description:'Reforçar as vias.',reward:240,deadlineDay:12}],players:{p1:{id:'p1',name:'Teste',online:true,lat:base.lat,lng:base.lng,cargo:{madeira:5},route:null}},
 projects:[pr],discoveries:{infra:1,comercio:0,natureza:0},milestones:{primeiraIndustria:true},event:{town:'lago',resource:'metal',multiplier:1.35,until:6},
 nodes:[{id:'bosque',name:'Reserva',type:'madeira',emoji:'🌲',lat:-23.8041,lng:-46.7356,stock:90}],towns:[{id:'lago',name:'Porto do Lago',lat:-23.8421,lng:-46.7553,factor:1.2,priceFactor:1,emoji:'⚓',prosperity:42,target:{metal:12},stock:{metal:2}}],
 contracts:[{id:1,town:'lago',type:'metal',qty:3,reward:450}],logs:[{time:Date.now(),text:'Começou'}],roads:{points:{base,ponte:{lat:pr.lat,lng:pr.lng}},edges:[['base','ponte']]}};
ws.emit('message',{type:'state',you:'p1',world:state});
assert.ok(elements.get('projects').innerHTML.includes('Ponte das Conexões'));
assert.ok(elements.get('milestones').innerHTML.includes('Construir uma serraria'));
assert.ok(elements.get('factories').innerHTML.includes('Automatizar'));
assert.ok(elements.get('eventDetail').textContent.includes('35%'));
assert.ok(elements.get('selectedPlace').innerHTML.includes('Carregar materiais'));
assert.ok(elements.get('missions').innerHTML.includes('Manutenção de vias'));
assert.ok(elements.get('townsState').innerHTML.includes('42%'));
assert.ok(elements.get('upgrades').innerHTML.includes('Central de navegação'));
assert.ok(elements.get('goalHint').innerHTML.includes('Produza um lote'));assert.ok(elements.get('fieldBoard').innerHTML.includes('Expedição')||elements.get('fieldBoard').innerHTML.includes('expedição'));
state.milestones.primeiraProducao=true;ws.emit('message',{type:'state',you:'p1',world:state});assert.ok(elements.get('goalHint').innerHTML.includes('Manutenção de vias'));
state.field={signals:4,completed:3,themeCounts:{infra:2,comercio:1,natureza:0},projects:{cartografia:true,feira:false,observatorio:false},atlas:['park','library'],atlasMilestones:[],poiHistory:[],history:[]};
ws.emit('message',{type:'state',you:'p1',world:state,myField:{active:false,today:1,maxToday:3}});
elements.get('gpsMode').onclick();assert.ok(elements.get('gpsPanel').innerHTML.includes('Sua cidade é o tabuleiro'));assert.ok(elements.get('gpsPanel').innerHTML.includes('Cartografia viva'));
assert.ok(elements.get('gpsPanel').innerHTML.includes('ATLAS VIVO'));
assert.ok(elements.get('gpsPanel').innerHTML.includes('2/6 tipos'));
assert.ok(elements.get('gpsPanel').innerHTML.includes('Biblioteca ✓'));
assert.ok(elements.get('gpsPanel').innerHTML.includes('Parque público ✓'));
assert.ok(elements.get('gpsPanel').innerHTML.includes('Abastece cidade com maior escassez'));
console.log('OK: interface renderiza projetos, marcos, fábricas, eventos, GPS, Atlas Vivo, efeitos de lugares públicos e mapa sem exceções.');
