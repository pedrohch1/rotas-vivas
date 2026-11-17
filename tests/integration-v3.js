'use strict';
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const root=path.join(__dirname,'..'),store=fs.mkdtempSync(path.join(os.tmpdir(),'rv3-'));
const port=37000+Math.floor(Math.random()*1300),code='Z'+Math.random().toString(36).slice(2,7).toUpperCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let server,socket,events=[],waiters=[];
async function start(){server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:store,DRIVE_SPEED:'5000'},stdio:'pipe'});
 let ready=false;for(let i=0;i<50;i++){await sleep(100);try{if((await fetch('http://127.0.0.1:'+port+'/health')).ok){ready=true;break}}catch{}}assert.ok(ready,'servidor inicia');}
async function stop(){if(server){server.kill('SIGTERM');await new Promise(r=>server.once('close',r));server=null}}
async function connect(token){socket=new WebSocket('ws://127.0.0.1:'+port+'/socket');await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});events=[];waiters=[];socket.addEventListener('message',e=>{events.push(JSON.parse(e.data));for(const fn of [...waiters])fn()});socket.send(JSON.stringify({type:'join',room:code,name:'Engenheira',token}));const joined=await wait(m=>m.type==='joined');const state=await wait(m=>m.type==='state');return {joined,state};}
function wait(pred,timeout=8000){return new Promise((resolve,reject)=>{let timer=setTimeout(()=>reject(new Error('Timeout, last events '+JSON.stringify(events.slice(-3)))),timeout);const check=()=>{const i=events.findIndex(pred);if(i<0)return;clearTimeout(timer);waiters=waiters.filter(fn=>fn!==check);resolve(events.splice(i,1)[0])};waiters.push(check);check()})}
function act(action,params={}){events=[];socket.send(JSON.stringify({type:'action',action,...params}));}
async function change(action,params,pred){act(action,params);return (await wait(m=>m.type==='state'&&pred(m.world,m.you))).world}
async function travel(id,lat,lng){act('route',{target:id});return (await wait(m=>m.type==='state'&&!m.world.players[m.you].route&&Math.abs(m.world.players[m.you].lat-lat)<.00005&&Math.abs(m.world.players[m.you].lng-lng)<.00005,12000)).world}
(async()=>{try{
 await start();const {joined,state}=await connect();const token=joined.token;
 assert.equal(state.world.roadMode,'virtual');assert.ok(state.world.towns[0].target.tabuas>0);assert.ok(state.world.contracts[0].deadlineDay>1);
 let w=await change('build',{build:'fundicao'},w=>w.factories.fundicao);
 w=await change('craft',{recipe:'metal'},w=>w.inventory.metal===3);
 w=await change('gps',{cellHash:'e'.repeat(64),theme:'natureza'},w=>w.discoveries.natureza===1);
 assert.equal(w.missions.length,1);const mission=w.missions[0];assert.equal(mission.kind,'natureza');assert.equal(mission.resource,'madeira');assert.equal(mission.town,'serra');
 w=await change('upgrade',{upgrade:'fleet'},w=>w.upgrades.fleet);assert.equal(w.money,300);assert.equal(w.inventory.metal,0);
 act('load',{resource:'madeira',qty:.5});assert.match((await wait(m=>m.type==='notice'&&m.error)).message,/Quantidade inválida/);
 w=await change('load',{resource:'madeira',qty:5},(w,id)=>w.players[id].cargo.madeira===5);
 await travel('serra',-23.8498,-46.6897);
 const prosperity=w.towns.find(t=>t.id==='serra').prosperity;
 w=await change('completeMission',{id:mission.id},w=>w.missions.length===0);
 assert.ok(w.towns.find(t=>t.id==='serra').prosperity>=prosperity);assert.ok(w.intel>=2);assert.ok(w.reputation>=5);
 act('completeMission',{id:mission.id});assert.match((await wait(m=>m.type==='notice'&&m.error)).message,/não está mais disponível/);
 w=await change('chat',{message:'Levem tábuas para o porto!'},w=>w.chat.length===1);
 assert.match(w.chat[0].message,/Levem tábuas/);act('chat',{message:'spam'});assert.match((await wait(m=>m.type==='notice'&&m.error)).message,/Aguarde/);
 w=await change('ping',{target:'lago'},w=>w.pings.length===1);assert.equal(w.pings[0].by,'Engenheira');
 const savedMoney=w.money;socket.close();await stop();
 const file=path.join(store,code+'.json');assert.ok(fs.existsSync(file));const persisted=JSON.parse(fs.readFileSync(file));assert.equal(persisted.upgrades.fleet,true);assert.equal(persisted.missions.length,0);
 await start();const next=await connect(token);assert.equal(next.joined.token,token);assert.equal(next.state.world.money,savedMoney);
 assert.equal(next.state.world.upgrades.fleet,true);assert.equal(next.state.world.chat.length,1);assert.equal(next.state.world.pings.length,1);assert.ok(!('scanned' in next.state.world));
 console.log('OK: missão GPS temática, entrega real, melhoria, segurança de inventário, persistência e reconexão.');
}finally{socket?.close();await stop();fs.rmSync(store,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
