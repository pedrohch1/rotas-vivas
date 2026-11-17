'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},Math};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/isometric.js'),'utf8'),context);
const scene=context.window.RotasScene;assert.ok(scene,'Módulo visual carregado');
const merc=(lat,lng,z)=>{const size=256*2**z,sin=Math.sin(lat*Math.PI/180);return {x:(lng+180)/360*size,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size}}
const inverse=(x,y,z)=>{const size=256*2**z,n=Math.PI-2*Math.PI*y/size;return {lng:x/size*360-180,lat:180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n)))}}
const center={lat:-23.8299,lng:-46.7198};for(const p of [center,{lat:-23.8421,lng:-46.7553},{lat:-23.8041,lng:-46.7356}]){const xy=scene.project(p,center,13.6,merc),rev=scene.unproject(xy.x,xy.y,center,13.6,merc,inverse);assert.ok(Math.abs(p.lat-rev.lat)<1e-8&&Math.abs(p.lng-rev.lng)<1e-8,'Clique e navegação preservam coordenadas')}
let paths=0,rects=0;const ctx=new Proxy({beginPath:()=>{paths++},fillRect:()=>{rects++}},{get(o,k){return k in o?o[k]:()=>{}},set(){return true}});
const tileCount=scene.drawWorld({ctx,w:900,h:590,center,zoom:13.6,merc,world:{roads:{points:{},edges:[]},projects:[]},sites:[{id:'base',...center},{id:'lago',lat:-23.8421,lng:-46.7553,target:{}}]});
assert.ok(tileCount>50&&tileCount<10000);assert.ok(paths>100&&rects>0,'Terreno e construções renderizados');scene.drawTruck(ctx,300,300,true,'Jogador');assert.ok(paths>100);console.log('OK: mundo 2.5D, projeção reversível, terreno e veículos sem erro.');
