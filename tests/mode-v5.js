'use strict';
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.join(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'rv-v5mode-'));
const port=48500+Math.floor(Math.random()*500),code='M'+Math.random().toString(36).slice(2,7).toUpperCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let processServer;
(async()=>{let a,b;try{
 processServer=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:dir,ECONOMY_STEP_MS:'1200'},stdio:'pipe'});
 for(let i=0;i<60;i++){await sleep(70);try{if((await fetch('http://127.0.0.1:'+port+'/health')).ok)break}catch{}}
 async function connect(name){const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`),msgs=[];
  ws.onmessage=e=>msgs.push(JSON.parse(e.data));await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
  async function read(pred,ms=5000){const since=Date.now();while(Date.now()-since<ms){const i=msgs.findIndex(pred);if(i>=0)return msgs.splice(i,1)[0];await sleep(20)}throw Error('Sem resposta: '+name+JSON.stringify(msgs.slice(-2)))}
  ws.send(JSON.stringify({type:'join',name,room:code}));await read(m=>m.type==='joined');const state=await read(m=>m.type==='state');
  return {ws,read,state,act:(action,values={})=>ws.send(JSON.stringify({type:'action',action,...values}))};}
 a=await connect('Ana');b=await connect('Bia');
 a.act('setMode',{mode:'gps'});await a.read(m=>m.type==='state'&&m.world.players[a.state.you].mode==='gps');
 b.act('setMode',{mode:'gps'});let st=await b.read(m=>m.type==='state'&&m.world.players[b.state.you].mode==='gps');
 const day=st.world.day;await sleep(2650);b.act('setMode',{mode:'pc'});
 st=await b.read(m=>m.type==='state'&&m.world.players[b.state.you].mode==='pc');assert.equal(st.world.day,day,'dias não correm durante caminhada coletiva');
 st=await b.read(m=>m.type==='state'&&m.world.day>day,5000);assert.ok(st.world.day>day,'dias voltam a avançar no PC');
 a.act('setMode',{mode:'invalid'});assert.match((await a.read(m=>m.type==='notice'&&m.error)).message,/Modo inválido/);
 console.log('OK: relógio econômico congela durante expedição GPS coletiva e retoma com PC; modo inválido rejeitado.');
}finally{a?.ws?.close();b?.ws?.close();if(processServer){processServer.kill('SIGTERM');await new Promise(r=>processServer.once('close',r))}fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
