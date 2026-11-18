'use strict';
// Exercita uma obra COMPLETA: financiamento, transporte real de materiais e mudança da rede.
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const port=33500+Math.floor(Math.random()*1000),room='P'+Math.random().toString(36).slice(2,7).toUpperCase();
const root=path.join(__dirname,'..'),server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DRIVE_SPEED:'5000',REMOTE_EXPEDITION_MS:'1000',ROUTING_ENABLED:'0'},stdio:'pipe'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let socket,events=[],waiters=[];
function wait(pred,timeout=9000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Esperando '+pred.toString().slice(0,90)+'; últimas mensagens '+JSON.stringify(events.slice(-3)))),timeout);
 const check=()=>{const ix=events.findIndex(pred);if(ix>=0){clearTimeout(timer);waiters=waiters.filter(fn=>fn!==check);resolve(events.splice(ix,1)[0]);}};waiters.push(check);check();});}
function act(action,props={}){events=[];socket.send(JSON.stringify({type:'action',action,...props}));}
async function change(action,props,pred){act(action,props);const state=await wait(m=>m.type==='state'&&pred(m.world,m.you));assert.ok(state.world);return state.world;}
async function travel(target,lat,lng){act('route',{target});const done=await wait(m=>m.type==='state'&&!m.world.players[m.you].route&&
 Math.abs(m.world.players[m.you].lat-lat)<.000025&&Math.abs(m.world.players[m.you].lng-lng)<.000025,10000);
 return done.world;}
(async()=>{try{
 let ready=false;for(let i=0;i<40;i++){await sleep(90);try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok){ready=true;break;}}catch{}}
 assert.ok(ready,'servidor inicia');socket=new WebSocket(`ws://127.0.0.1:${port}/socket`);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 socket.addEventListener('message',e=>{events.push(JSON.parse(e.data));waiters.forEach(fn=>fn());});
 socket.send(JSON.stringify({type:'join',room,name:'Construtor'}));await wait(m=>m.type==='joined');await wait(m=>m.type==='state');
 let w=await change('gps',{cellHash:'0'.repeat(64)},w=>w.discoveries.infra===1);
 assert.equal(w.projects.find(p=>p.id==='ponte').completed,false);
 w=await change('virtual',{},w=>w.intel>=3);
 w=await change('fundProject',{project:'ponte'},w=>w.projects.find(p=>p.id==='ponte').funded);
 w=await change('build',{build:'fundicao'},w=>w.factories.fundicao);
 w=await change('craft',{recipe:'metal'},w=>w.inventory.metal>=3);
 w=await change('load',{resource:'madeira',qty:10},(w,id)=>w.players[id].cargo.madeira===10);
 await travel('ponte',-23.8366,-46.7425);
 w=await change('deliverProject',{project:'ponte'},w=>w.projects.find(p=>p.id==='ponte').delivered.madeira===10);
 await travel('base',-23.8299,-46.7198);
 w=await change('load',{resource:'metal',qty:3},(w,id)=>w.players[id].cargo.metal===3);
 await travel('ponte',-23.8366,-46.7425);
 w=await change('deliverProject',{project:'ponte'},w=>w.projects.find(p=>p.id==='ponte').delivered.metal===3);
 await travel('pedreira',-23.8561,-46.7154);
 w=await change('collect',{node:'pedreira'},(w,id)=>w.players[id].cargo.minerio>=4);
 await travel('base',-23.8299,-46.7198);
 w=await change('unload',{},w=>w.inventory.minerio>=10);
 w=await change('craft',{recipe:'metal'},w=>w.inventory.metal>=2);
 w=await change('load',{resource:'metal',qty:2},(w,id)=>w.players[id].cargo.metal>=2);
 await travel('ponte',-23.8366,-46.7425);
 w=await change('deliverProject',{project:'ponte'},w=>w.projects.find(p=>p.id==='ponte').completed);
 assert.equal(w.projects.find(p=>p.id==='ponte').completed,true);
 assert.ok(w.roads.edges.some(([a,b])=>a==='base'&&b==='ponte'),'atalho foi aberto');
 assert.equal(w.milestones.primeiroProjeto,true);assert.ok(w.reputation>=34);
 console.log('OK: ponte financiada, materiais transportados, obra concluída e rota permanentemente encurtada.');
}finally{socket?.close();server.kill('SIGINT');await sleep(300);const f=path.join(root,'data',room+'.json');if(fs.existsSync(f))fs.unlinkSync(f);}})().catch(e=>{console.error(e);process.exitCode=1;});
