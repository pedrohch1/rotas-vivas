'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');
const root=path.join(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'rv4-conc-'));
const port=45400+Math.floor(Math.random()*800),code='GC'+Math.random().toString(36).slice(2,6).toUpperCase();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let processServer;
async function boot(){processServer=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:dir},stdio:'pipe'});for(let i=0;i<50;i++){await wait(100);try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)return}catch{}}throw Error('servidor não iniciou');}
const players=[];
async function join(name){const socket=new WebSocket(`ws://127.0.0.1:${port}/socket`),msgs=[];socket.addEventListener('message',e=>msgs.push(JSON.parse(e.data)));
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});socket.send(JSON.stringify({type:'join',room:code,name}));
 const read=async(predicate,ms=5000)=>{const until=Date.now()+ms;while(Date.now()<until){const i=msgs.findIndex(predicate);if(i>=0)return msgs.splice(i,1)[0];await wait(15);}throw Error(name+' timeout '+JSON.stringify(msgs.slice(-4).map(m=>({type:m.type,error:m.error,message:m.message,signals:m.world?.field?.signals,missions:m.world?.missions?.length}))))};
 await read(m=>m.type==='joined');const state=await read(m=>m.type==='state');const p={name,socket,msgs,read,act(action,arg={}){socket.send(JSON.stringify({type:'action',action,...arg}))}};players.push(p);return {p,state};}
(async()=>{try{
 await boot();const initial=[];for(let i=0;i<4;i++){const x=await join('Amigo '+i);initial.push(x.state);}
 assert.equal(Object.keys(initial.at(-1).world.players).length,4);
 const cell={x:-26000,y:-13200},point={lat:(cell.y+.5)*.0018,lng:(cell.x+.5)*.0018};
 const payload={poiId:'way/300031',category:'park',poi:point,cell,accuracy:10,ageMs:0,speed:0};
 for(const p of players)p.act('poiVisit',payload);
 const responses=await Promise.all(players.map(p=>p.read(m=>m.type==='notice'&&m.message&&(/Novo local|já foi descoberto/.test(m.message)))));
 assert.equal(responses.filter(m=>!m.error).length,1);assert.equal(responses.filter(m=>m.error).length,3);
 const latest=(await players[0].read(m=>m.type==='state'&&m.world.field.landmarkCount===1)).world;
 assert.equal(latest.field.signals,1);assert.equal(latest.field.landmarkCount,1);assert.deepEqual(latest.field.atlas,['park']);assert.equal(latest.intel,1);assert.equal(latest.money,1145);assert.equal(latest.field.poiHistory.length,1);
 assert.ok(!('landmarks' in latest.field));for(const p of Object.values(latest.players))assert.ok(!('poiLastCell' in p));
 players[0].act('fieldDispatch',{dispatch:'rota'});
 const dispatched=(await players[0].read(m=>m.type==='state'&&m.world.field.signals===0&&m.world.missions.some(x=>x.kind==='comercio'))).world;
 assert.equal(dispatched.missions.length,2);assert.ok(dispatched.missions.some(m=>m.kind==='comercio'));
 players[0].act('fieldDispatch',{dispatch:'rota'});assert.match((await players[0].read(m=>m.type==='notice'&&m.error)).message,/Faltam/);
 for(const p of players)p.act('fieldStart',{kind:'infra'});
 const states=await Promise.all(players.map(p=>p.read(m=>m.type==='state'&&m.myField?.active)));
 assert.equal(new Set(states.map(s=>s.myField.id)).size,4,'quatro expedições pessoais independentes');
 for(const p of players)p.socket.close();processServer.kill('SIGTERM');await new Promise(resolve=>processServer.once('close',resolve));processServer=null;
 const saved=JSON.parse(fs.readFileSync(path.join(dir,code+'.json')));
 assert.equal(saved.field.landmarks.length,1);assert.equal(saved.field.poiHistory.length,1);assert.deepEqual(saved.field.atlas,['park']);assert.equal(saved.field.signals,0);assert.ok(!JSON.stringify(saved).includes('way/300031'));
 console.log('OK: 4 amigos concorrentes, um único prêmio para POI compartilhado, operações com sinais, 4 expedições independentes e salvamento íntegro.');
}finally{for(const p of players)p.socket.close();if(processServer){processServer.kill('SIGTERM');await new Promise(r=>processServer.once('close',r));}fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
