'use strict';
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rotas-remoto-')),port=36000+Math.floor(Math.random()*1800);
const root=path.join(__dirname,'..');
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:dir,DRIVE_SPEED:'5000',ROUTING_ENABLED:'0',REMOTE_EXPEDITION_MS:'1000'},stdio:'pipe'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,events=[],waiters=[];
function wait(test,timeout=4500){return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(new Error('Esperando evento '+JSON.stringify(events.slice(-3)))),timeout);
 const check=()=>{const idx=events.findIndex(test);if(idx>=0){clearTimeout(timer);waiters=waiters.filter(f=>f!==check);resolve(events.splice(idx,1)[0]);}};
 waiters.push(check);check();
})}
function act(action){ws.send(JSON.stringify({type:'action',action}));}
(async()=>{try{
 let okay=false;for(let i=0;i<45;i++){await sleep(90);try{if((await fetch('http://localhost:'+port+'/health')).ok){okay=true;break}}catch{}}assert.ok(okay);
 ws=new WebSocket('ws://localhost:'+port+'/socket');await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
 ws.onmessage=e=>{events.push(JSON.parse(e.data));waiters.forEach(f=>f())};
 ws.send(JSON.stringify({type:'join',name:'Expedicionario',room:'ROTE8'}));await wait(m=>m.type==='joined');await wait(m=>m.type==='state');
 act('virtual');const started=await wait(m=>m.type==='state'&&Object.values(m.world.players).some(p=>p.remoteExpedition));assert.equal(started.world.money,1015);assert.equal(started.world.intel,0);
 act('virtual');assert.match((await wait(m=>m.type==='notice'&&m.error)).message,/em andamento/);
 const done=await wait(m=>m.type==='state'&&m.world.intel===1);assert.equal(done.world.surveys,1);assert.equal(Object.values(done.world.players)[0].remoteExpedition,null);
 await sleep(1400);const health=await (await fetch('http://localhost:'+port+'/health')).json();assert.equal(health.ok,true);
 console.log('OK: expedição remota demorada, sem prêmio imediato nem ação duplicada.');
}finally{ws?.close();server.kill('SIGINT');await sleep(200);fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
