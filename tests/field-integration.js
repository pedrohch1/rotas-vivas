'use strict';
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const root=path.join(__dirname,'..'),store=fs.mkdtempSync(path.join(os.tmpdir(),'rv4-field-'));
const port=43000+Math.floor(Math.random()*1200),code='F'+Math.random().toString(36).slice(2,7).toUpperCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let processServer=null;
async function boot(){processServer=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:store},stdio:'pipe'});
 for(let i=0;i<75;i++){await sleep(75);try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)return}catch{}}throw Error('Servidor não inicializou');}
async function stop(){if(processServer){const current=processServer;processServer=null;current.kill('SIGTERM');await new Promise(resolve=>current.once('close',resolve));}}
function client(name,token=''){const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`),msgs=[];const read=async(pred,timeout=5000)=>{const start=Date.now();while(Date.now()-start<timeout){const idx=msgs.findIndex(pred);if(idx>=0)return msgs.splice(idx,1)[0];await sleep(15);}throw Error(`Timeout em ${name}: ${JSON.stringify(msgs.slice(-2))}`)};
 ws.addEventListener('message',e=>msgs.push(JSON.parse(e.data)));
 const open=new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
 return {ws,read,async join(){await open;ws.send(JSON.stringify({type:'join',room:code,name,token}));const joined=await read(m=>m.type==='joined');const state=await read(m=>m.type==='state'&&m.you);return {joined,state}},action(action,extra={}){ws.send(JSON.stringify({type:'action',action,...extra}))},close(){ws.close()}};
}
function editElapsed(id){const file=path.join(store,code+'.json');const world=JSON.parse(fs.readFileSync(file));const p=Object.values(world.players).find(p=>p.id===id);assert.ok(p?.fieldExpedition);const last=p.fieldExpedition.steps.at(-1);last.time=Date.now()-100000;p.fieldExpedition.lastAt=last.time;fs.writeFileSync(file,JSON.stringify(world));}
(async()=>{let a,b,token,id;try{
 await boot();a=client('Caminhante');let joined=await a.join();token=joined.joined.token;id=joined.state.you;
 assert.equal(joined.state.world.field.signals,0);
 a.action('fieldStart',{kind:'infra'});let state=(await a.read(m=>m.type==='state'&&m.myField?.active)).myField;
 assert.equal(state.steps,0);assert.ok(state.id);const expeditionId=state.id;
 b=client('Parceira');let other=await b.join();assert.ok(!('lastCell' in other.state.world.players[id].fieldStatus));assert.ok(!('visited' in other.state.world.field));assert.equal(other.state.myField?.active,false);
 b.action('fieldStep',{id:expeditionId,cell:{x:-25900,y:-13000},accuracy:10,ageMs:0});
 assert.match((await b.read(m=>m.type==='notice'&&m.error)).message,/expirou|outra|expedição/);
 a.action('fieldStep',{id:expeditionId,cell:{x:-26000,y:-13200},accuracy:10,ageMs:0,speed:0});
 assert.equal((await a.read(m=>m.type==='state'&&m.myField?.steps===1)).myField.steps,1);
 a.action('fieldStep',{id:expeditionId,cell:{x:-25999,y:-13200},accuracy:10,ageMs:0});
 assert.match((await a.read(m=>m.type==='notice'&&m.error)).message,/Aguarde/);
 a.close();b.close();await stop();
 editElapsed(id);
 await boot();a=client('Caminhante',token);joined=await a.join();assert.equal(joined.state.myField.steps,1);assert.ok(joined.state.myField.lastCell);
 assert.equal(joined.state.world.players[id].fieldStatus.steps,1);assert.ok(!('lastCell' in joined.state.world.players[id].fieldStatus));
 a.action('fieldStep',{id:expeditionId,cell:{x:-25998,y:-13200},accuracy:10,ageMs:0,speed:0});
 assert.equal((await a.read(m=>m.type==='state'&&m.myField?.steps===2)).myField.steps,2);
 a.close();await stop();editElapsed(id);
 await boot();a=client('Caminhante',token);joined=await a.join();assert.equal(joined.state.myField.steps,2);
 a.action('fieldStep',{id:expeditionId,cell:{x:-25996,y:-13200},accuracy:10,ageMs:0,speed:0});
 const result=(await a.read(m=>m.type==='state'&&m.world.field.completed===1)).world;
 assert.equal(result.field.signals,2);assert.equal(result.field.visitedCount,3);assert.equal(result.field.themeCounts.infra,1);assert.equal(result.players[id].fieldStatus.today,1);assert.equal(result.players[id].fieldStatus.steps,0);assert.ok(result.missions.some(m=>m.kind==='infra'));
 a.action('fieldStep',{id:expeditionId,cell:{x:-25997,y:-13200},accuracy:10,ageMs:0,speed:0});
 assert.match((await a.read(m=>m.type==='notice'&&m.error)).message,/expirou|expedição/);
 a.action('fieldBuild',{project:'cartografia'});const upgraded=(await a.read(m=>m.type==='state'&&m.world.field.projects.cartografia)).world;
 assert.equal(upgraded.field.signals,0);const credits=upgraded.money;
 a.action('fieldBuild',{project:'cartografia'});assert.match((await a.read(m=>m.type==='notice'&&m.error)).message,/já/);
 a.close();await stop();await boot();a=client('Caminhante',token);joined=await a.join();assert.equal(joined.state.world.money,credits);assert.equal(joined.state.world.field.projects.cartografia,true);
 assert.equal(joined.state.world.field.completed,1);assert.ok(!('visited' in joined.state.world.field));
 console.log('OK: GPS real de 3 etapas via WebSocket, 2 clientes, distância, validação, segurança básica, 3 reinícios, pesquisa, obra e privacidade.');
}finally{a?.close();b?.close();await stop();fs.rmSync(store,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
