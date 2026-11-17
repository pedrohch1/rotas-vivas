'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.join(__dirname,'..'),store=fs.mkdtempSync(path.join(os.tmpdir(),'rv5-delivery-'));
const port=47500+Math.floor(Math.random()*700),code='D'+Math.random().toString(36).slice(2,7).toUpperCase();
const delay=ms=>new Promise(r=>setTimeout(r,ms));let server;
async function start(){server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:store,DRIVE_SPEED:'5000'},stdio:['ignore','pipe','pipe']});for(let i=0;i<70;i++){await delay(80);try{if((await fetch('http://127.0.0.1:'+port+'/health')).ok)return}catch{}}throw Error('Servidor não iniciou')}
async function stop(){if(!server)return;const s=server;server=null;s.kill('SIGTERM');await new Promise(r=>s.once('close',r))}
async function client(name,token=''){const ws=new WebSocket('ws://127.0.0.1:'+port+'/socket'),buffer=[];ws.onmessage=e=>buffer.push(JSON.parse(e.data));await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});const read=async(pred,ms=16000)=>{let start=Date.now();while(Date.now()-start<ms){const i=buffer.findIndex(pred);if(i!==-1)return buffer.splice(i,1)[0];await delay(15)}throw Error('Timeout '+name+' '+JSON.stringify(buffer.slice(-3)))};
 ws.send(JSON.stringify({type:'join',room:code,name,token}));const joined=await read(x=>x.type==='joined'),state=await read(x=>x.type==='state'&&x.you);return {ws,read,joined,state,act:(action,extra={})=>ws.send(JSON.stringify({type:'action',action,...extra}))}}
(async()=>{let a,b;try{await start();a=await client('Alice');b=await client('Bruna');
 const contract=a.state.world.contracts.find(c=>c.type==='madeira');assert.ok(contract,'primeiro contrato de madeira disponível');
 const first=a.state.world.inventory.madeira;
 a.act('prepareDelivery',{scope:'contract',id:contract.id});
 const loaded=await a.read(m=>m.type==='state'&&m.world.players[a.state.you].cargo.madeira>=contract.qty);
 assert.equal(loaded.world.inventory.madeira,first-contract.qty);assert.equal(loaded.world.players[a.state.you].route.id,contract.town);
 const other=await b.read(m=>m.type==='state'&&m.world.inventory.madeira===first-contract.qty);
 assert.equal(other.world.players[a.state.you].cargo.madeira,contract.qty);
 // Insuficiência não debita nem dinheiro nem estoque e não cria rota falsa.
 b.act('prepareDelivery',{scope:'contract',id:contract.id});
 assert.match((await b.read(m=>m.type==='notice'&&m.error)).message,/Faltam/);
 b.act('prepareDelivery',{scope:'contract',id:99999});assert.match((await b.read(m=>m.type==='notice'&&m.error)).message,/não encontrada/);
 const arrived=await a.read(m=>m.type==='state'&&!m.world.players[a.state.you].route&&m.world.players[a.state.you].cargo.madeira===contract.qty,16000);
 assert.ok(arrived.world.players[a.state.you].cargo.madeira>=contract.qty);
 a.act('contract',{id:contract.id});let paid=await a.read(m=>m.type==='state'&&!m.world.contracts.some(c=>c.id===contract.id));
 assert.equal(paid.world.players[a.state.you].cargo.madeira||0,0);
 const amount=paid.world.money;
 a.act('contract',{id:contract.id});assert.match((await a.read(m=>m.type==='notice'&&m.error)).message,/concluído/);
 a.ws.close();b.ws.close();await stop();
 await start();a=await client('Alice',a.joined.token);assert.equal(a.state.world.money,amount);
 assert.ok(!a.state.world.contracts.some(c=>c.id===contract.id));
 console.log('OK: entrega guiada carrega, parte, sincroniza, paga uma vez e persiste após reinício; rejeita estoques insuficientes.');
}finally{a?.ws?.close();b?.ws?.close();await stop();fs.rmSync(store,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
