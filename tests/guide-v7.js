'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rv-guide-')),port=49100+Math.floor(Math.random()*700),delay=ms=>new Promise(r=>setTimeout(r,ms));
let child,ws;const inbox=[];
async function take(fn,limit=16000){const start=Date.now();while(Date.now()-start<limit){const i=inbox.findIndex(fn);if(i>=0)return inbox.splice(i,1)[0];await delay(20)}throw Error('Timeout de evento');}
async function run(){try{
 child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:dir,DRIVE_SPEED:'5000'},stdio:'ignore'});
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:'+port+'/health')).ok)break}catch{}await delay(65)}
 for(const name of ['guide-v7.js','guide-v7.css'])assert.equal((await fetch('http://127.0.0.1:'+port+'/'+name)).status,200);
 ws=new WebSocket('ws://127.0.0.1:'+port+'/socket');ws.onmessage=e=>inbox.push(JSON.parse(e.data));await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no});
 const act=(action,extra={})=>ws.send(JSON.stringify({type:'action',action,...extra}));ws.send(JSON.stringify({type:'join',name:'Guia',room:'GUIDE07'}));await take(m=>m.type==='joined');
 let w=(await take(m=>m.type==='state')).world;assert.equal(w.campaign.chapter,1);const player=Object.keys(w.players)[0];
 act('build',{build:'serraria'});await take(m=>m.type==='effect'&&m.kind==='build');act('craft',{recipe:'tabuas'});const made=await take(m=>m.type==='effect'&&m.kind==='craft');assert.ok(made.amount>0);
 act('route',{target:'bosque'});await take(m=>m.type==='state'&&m.world.players[player].route?.id==='bosque');await take(m=>m.type==='state'&&m.world.logs?.[0]?.text.includes('chegou a Reserva do Cedro'),18000);
 act('collect',{node:'bosque'});assert.equal((await take(m=>m.type==='effect'&&m.kind==='collect')).amount,10);act('collect',{node:'bosque'});await take(m=>m.type==='effect'&&m.kind==='collect');
 act('route',{target:'base'});await take(m=>m.type==='state'&&m.world.players[player].route?.id==='base');await take(m=>m.type==='state'&&m.world.logs?.[0]?.text.includes('chegou a Depósito Central'),18000);
 act('unload');await take(m=>m.type==='effect'&&m.kind==='unload');
 w=(await take(m=>m.type==='state'&&m.world.inventory.madeira>=12)).world;const c=w.contracts.find(c=>c.type==='madeira');assert.ok(c);
 act('prepareDelivery',{scope:'contract',id:c.id});await take(m=>m.type==='effect'&&m.kind==='route');await take(m=>m.type==='state'&&m.world.logs?.[0]?.text.includes('chegou a Porto do Lago'),18000);
 act('contract',{id:c.id});await take(m=>m.type==='effect'&&m.kind==='delivery');w=(await take(m=>m.type==='state'&&m.world.campaign.chapter===2)).world;assert.equal(w.campaign.finished.length,1);
 act('contract',{id:c.id});assert.match((await take(m=>m.type==='notice'&&m.error)).message,/concluído/);
 console.log('OK: campanha, coleta, produção, entrega, feedback e validação de repetição.');
 }finally{ws?.close();if(child){child.kill();await new Promise(done=>child.once('close',done))}fs.rmSync(dir,{recursive:true,force:true})}}
run().catch(e=>{console.error(e);process.exitCode=1});