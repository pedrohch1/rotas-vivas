'use strict';
const assert=require('node:assert/strict');const FIELD=require('../field');
function make(){return {code:'TEST05',field:FIELD.create(),money:100,intel:0,reputation:0,inventory:{metal:0},players:{},towns:[{name:'Cidade',prosperity:33}],nodes:[{stock:10,max:80},{stock:75,max:80}]};}
function walk(w,p,kind,now){FIELD.start(w,p,kind,now);const id=p.fieldExpedition.id;for(let i=0;i<3;i++)FIELD.step(w,p,{id,cell:{x:-25900+2*i,y:-13200},accuracy:8,ageMs:50,speed:0},now+(i+1)*75000);return p.fieldDecision.id;}
{
 const w=make(),p={name:'Lia'};w.players.lia=p;FIELD.migrate(w);
 const id=walk(w,p,'infra',Date.UTC(2026,10,17));assert.equal(FIELD.privateStatus(p).decision.id,id);
 assert.equal(FIELD.publicPlayer(p).decision,undefined,'o estado público não deve incluir escolha privada');
 const prior=w.inventory.metal;assert.match(FIELD.resolveDecision(w,p,id,'materiais').message,/2 metais/);
 assert.equal(w.inventory.metal,prior+2);assert.equal(FIELD.privateStatus(p).decision,null);
 assert.throws(()=>FIELD.resolveDecision(w,p,id,'materiais'),/encerrada/);
}
{
 const w=make(),p={name:'Sol'};w.players.sol=p;FIELD.migrate(w);
 const id=walk(w,p,'comercio',Date.UTC(2026,10,18));
 assert.throws(()=>FIELD.resolveDecision(w,p,id,'exploit'),/válida/);
 assert.equal(p.fieldDecision.id,id);
 FIELD.resolveDecision(w,p,id,'socorro');assert.equal(w.towns[0].prosperity,42);
}
{
 const w=make(),p={name:'Rui'};w.players.rui=p;FIELD.migrate(w);
 let id=walk(w,p,'natureza',Date.UTC(2026,10,19));
 FIELD.resolveDecision(w,p,id,'recuperar');assert.equal(w.nodes[0].stock,22);assert.equal(w.nodes[1].stock,80);
 const old=w.intel;id=walk(w,p,'infra',Date.UTC(2026,10,20));FIELD.resolveDecision(w,p,id,'pesquisa');assert.equal(w.intel,old+3+3); // +3 da caminhada, +3 da escolha
}
{
 const w=make(),p={name:'Eva'};w.players.eva=p;FIELD.migrate(w);
 const id=walk(w,p,'natureza',Date.UTC(2026,10,21));
 const previous=w.money;FIELD.resolveDecision(w,p,id,'ignore');assert.equal(w.money,previous);
}
console.log('OK: encontros de campo, escolhas únicas, efeitos econômicos, rejeição de mensagens inválidas, sigilo e migração.');
