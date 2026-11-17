'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');const {spawn}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rv3-hardening-')),root=path.join(__dirname,'..'),port=39200+Math.floor(Math.random()*500);
const bad='BAD123',broken='{invalid-json';fs.writeFileSync(path.join(dir,bad+'.json'),broken);
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATA_DIR:dir,PORT:String(port)},stdio:'pipe'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function connect(room){const ws=new WebSocket('ws://127.0.0.1:'+port+'/socket');await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=fail});let messages=[],onMessage;ws.addEventListener('message',e=>{messages.push(JSON.parse(e.data));onMessage?.()});
 function wait(pred){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('timeout '+JSON.stringify(messages.slice(-2)))),6000);onMessage=()=>{const found=messages.find(pred);if(found){clearTimeout(timeout);resolve(found)}};onMessage()})}
 ws.send(JSON.stringify({type:'join',room,name:'Testador'}));return {ws,wait};}
(async()=>{try{
 let ready=false;for(let i=0;i<40;i++){await sleep(100);try{if((await fetch('http://127.0.0.1:'+port+'/health')).ok){ready=true;break}}catch{}}assert.ok(ready);
 let resp=await fetch(`http://127.0.0.1:${port}/..%2F..%2Fserver.js`);assert.equal(resp.status,403);
 const rejected=await connect(bad);const badMessage=await rejected.wait(x=>x.type==='notice'&&x.error);assert.match(badMessage.message,/carregar/);rejected.ws.close();
 assert.equal(fs.readFileSync(path.join(dir,bad+'.json'),'utf8'),broken,'corrupted save must be preserved');
 let crossOrigin='';await new Promise(resolve=>{const socket=net.createConnection({host:'127.0.0.1',port},()=>{
  socket.write('GET /socket HTTP/1.1\r\nHost: 127.0.0.1:'+port+'\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: '+Buffer.from('1234567890123456').toString('base64')+'\r\nSec-WebSocket-Version: 13\r\nOrigin: https://site-atacante.example\r\n\r\n');
 });socket.on('data',data=>crossOrigin+=data.toString());socket.on('end',resolve);socket.on('close',resolve);socket.on('error',resolve);setTimeout(()=>{socket.destroy();resolve()},1000)});
 assert.ok(!crossOrigin.includes('101 Switching Protocols'),'cross-site WebSocket must be blocked');
 const good=await connect('GOOD123');await good.wait(x=>x.type==='joined');
 for(let i=0;i<50;i++)good.ws.send(JSON.stringify({type:'action',action:'drive',dx:1,dy:0}));
 const notice=await good.wait(x=>x.type==='notice'&&x.error&&x.message.includes('Muitas ações'));assert.ok(notice);
 good.ws.close();assert.equal((await fetch('http://127.0.0.1:'+port+'/health')).status,200);
 console.log('OK: salva arquivo corrompido, impede travessia de caminho, rejeita WebSocket externo e limita spam.');
}finally{server.kill('SIGTERM');await sleep(250);fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
