'use strict';
// Testes de integração com Node.js puro. Executar: npm test
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const port=32000+Math.floor(Math.random()*3000),code='T'+Math.random().toString(36).slice(2,7).toUpperCase();
const server=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DRIVE_SPEED:'5000'},stdio:['ignore','pipe','pipe']});
const clients=[];let seq=0;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function client(name,token){const socket=new WebSocket(`ws://127.0.0.1:${port}/socket`);clients.push(socket);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
 let messages=[],waiters=[];socket.addEventListener('message',e=>{const v=JSON.parse(e.data);messages.push(v);waiters.forEach(x=>x())});
 function wait(predicate,timeout=3000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Timeout '+name+' '+JSON.stringify(messages.slice(-2)))),timeout);function look(){const i=messages.findIndex(predicate);if(i>=0){clearTimeout(timer);waiters=waiters.filter(fn=>fn!==look);resolve(messages.splice(i,1)[0])}}waiters.push(look);look()})}
 socket.send(JSON.stringify({type:'join',name,room:code,token:token||''}));return {socket,wait,action:(action,data={})=>socket.send(JSON.stringify({type:'action',action,...data})),read:()=>messages};}
(async()=>{
 try{let ready=false;for(let i=0;i<30;i++){await pause(100);try{const res=await fetch(`http://127.0.0.1:${port}/health`);if(res.ok){ready=true;break}}catch{}}
 assert.ok(ready,'servidor deve iniciar');
 const a=await client('Alice'),j=await a.wait(m=>m.type==='joined');let snap=await a.wait(m=>m.type==='state');assert.equal(snap.world.money,1100);
 const b=await client('Bruno');await b.wait(m=>m.type==='joined');await b.wait(m=>m.type==='state');
 a.action('build',{build:'serraria'});const crafted=await a.wait(m=>m.type==='state'&&m.world.factories.serraria===true);assert.equal(crafted.world.money,830);assert.equal(crafted.world.inventory.madeira,8);assert.ok(!crafted.world.players[crafted.you].token,'token de sessão não deve ser enviado');assert.ok(!('scanned' in crafted.world),'quadrantes GPS não devem ser enviados');
 const synced=await b.wait(m=>m.type==='state'&&m.world.factories.serraria);assert.equal(synced.world.money,830);
 a.action('toggleFactory',{factory:'serraria'});let auto=await a.wait(m=>m.type==='state'&&m.world.factoryActive.serraria===true);assert.ok(auto.world.factoryActive.serraria);a.action('toggleFactory',{factory:'serraria'});await a.wait(m=>m.type==='state'&&m.world.factoryActive.serraria===false);
 a.action('craft',{recipe:'tabuas'});const produced=await a.wait(m=>m.type==='state'&&m.world.inventory.tabuas===4);assert.equal(produced.world.inventory.madeira,0);
 a.action('load',{resource:'tabuas',qty:4});let loaded=await a.wait(m=>m.type==='state'&&m.world.players[m.you]?.cargo.tabuas===4);assert.equal(loaded.world.inventory.tabuas,0);
 a.action('collect',{node:'bosque'});const err=await a.wait(m=>m.type==='notice'&&m.error);assert.match(err.message,/Aproxime/);
 a.action('virtual');let research=await a.wait(m=>m.type==='state'&&m.world.intel===1);assert.equal(research.world.money,785);
 a.action('gps',{cellHash:'0'.repeat(64)});research=await a.wait(m=>m.type==='state'&&m.world.intel===3);assert.equal(research.world.money,885);assert.equal(research.world.discoveries.infra,1);assert.ok(research.world.projects.find(p=>p.id==='ponte'));
 a.action('gps',{cellHash:'b'.repeat(64)});assert.match((await a.wait(m=>m.type==='notice'&&m.error)).message,/Aguarde/);
 a.action('fundProject',{project:'ponte'});const funded=await a.wait(m=>m.type==='state'&&m.world.projects.find(p=>p.id==='ponte').funded);assert.equal(funded.world.projects.find(p=>p.id==='ponte').funded,true);
 a.action('route',{target:'lago'});const riding=await a.wait(m=>m.type==='state'&&m.world.players[m.you].route?.points?.length>1);assert.ok(riding.world.players[riding.you].route.meters>6000);
 a.action('route',{target:'base'});await a.wait(m=>m.type==='state'&&m.world.players[m.you].route?.id==='base');
 const c=await client('Carla');await c.wait(m=>m.type==='joined');await c.wait(m=>m.type==='state');const d=await client('Diego');await d.wait(m=>m.type==='joined');await d.wait(m=>m.type==='state');const e=await client('Erica');const full=await e.wait(m=>m.type==='notice'&&m.error);assert.match(full.message,/quatro/);
 assert.ok(!snap.world.scanned,'estado público não deve revelar locais explorados');
 const offlineId=synced.you;b.socket.close();await a.wait(m=>m.type==='state'&&m.world.players[offlineId]?.online===false);
 a.action('removePlayer',{player:offlineId});await a.wait(m=>m.type==='state'&&!m.world.players[offlineId]);
 e.socket.send(JSON.stringify({type:'join',name:'Erica',room:code}));await e.wait(m=>m.type==='joined');
 const refilled=await e.wait(m=>m.type==='state');assert.equal(Object.keys(refilled.world.players).length,4);
 console.log('OK: HTTP, 4 jogadores, sincronização, automação, fábricas, descobertas GPS, projetos, Dijkstra e limites.');
 }finally{clients.forEach(c=>c.close());server.kill('SIGINT');await pause(300);const f=path.join(__dirname,'..','data',code+'.json');if(fs.existsSync(f))fs.unlinkSync(f);}
})().catch(e=>{console.error(e);process.exitCode=1});
