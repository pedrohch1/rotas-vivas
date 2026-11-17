'use strict';
// Não depende de APIs reais: cobre efeitos no mundo, coleção cooperativa e recompensas únicas.
const assert=require('node:assert/strict');
const F=require('../field');
const now=Date.UTC(2026,10,17,12,0,0);
const w={code:'ATLAS4',money:400,intel:0,reputation:0,
 field:F.create(),nodes:[{id:'bosque',stock:2,max:90},{id:'minerio',stock:30,max:80}],
 towns:[{id:'lago',name:'Lago',prosperity:40,target:{madeira:20,metal:10},stock:{madeira:1,metal:3}},{id:'serra',name:'Serra',prosperity:55,target:{madeira:8},stock:{madeira:7}}],
 players:{},missions:[]};
for(let i=0;i<3;i++)w.players['p'+i]={id:'p'+i,name:'Pessoa '+i};
F.migrate(w);
let previousAtlas=0;
for(const [i,category] of ['park','garden','library','marketplace','community','viewpoint'].entries()){
 const player=w.players['p'+Math.floor(i/2)];
 const cell={x:-26000+i*3,y:-13200};
 const poi={lat:(cell.y+.5)*F.CELL,lng:(cell.x+.5)*F.CELL};
 const result=F.visitPoint(w,player,{poiId:`node/${1000+i}`,category,poi,cell,accuracy:11,ageMs:100,speed:0},now+i*80000);
 assert.match(result.message,/Atlas Vivo/);
 assert.equal(w.field.atlas.length,++previousAtlas);
 assert.equal(w.field.poiHistory.length,i+1);
 if(i===2)assert.match(result.message,/Atlas 3\/6 completo/);
 if(i===5)assert.match(result.message,/Atlas 6\/6 completo/);
 const money=w.money,signals=w.field.signals;
 assert.throws(()=>F.visitPoint(w,player,{poiId:`node/${1000+i}`,category,poi,cell,accuracy:11,ageMs:100,speed:0},now+i*80000+1000),/já foi descoberto/);
 assert.equal(w.money,money);assert.equal(w.field.signals,signals);
}
assert.equal(w.nodes[0].stock,14);
assert.equal(w.nodes[1].stock,42);
assert.equal(w.towns[0].stock.madeira,6,'mercado deve recuperar o estoque mais escasso');
assert.equal(w.towns[0].prosperity,49,'mercado +2 e comunidade +7 na cidade mais carente');
assert.equal(w.field.signals,12,'seis locais + dois bônus de coleção distintos');
assert.deepEqual(w.field.atlasMilestones,[3,6]);
assert.equal(w.money,400+6*45+250+650+45);
assert.equal(w.intel,6+3+2+2+6);
const out=JSON.stringify(F.publicBoard(w));
assert.ok(!out.includes('node/1000')&&!out.includes('-26000'));
assert.deepEqual(F.publicBoard(w).atlas,['park','garden','library','marketplace','community','viewpoint']);
// V2 load: mundos anteriores não possuíam atlas. Os projetos e outras conquistas não devem sumir.
const old={field:{signals:8,projects:{cartografia:true}},players:{legacy:{id:'legacy'}}};
F.migrate(old);
assert.deepEqual(old.field.atlas,[]);assert.deepEqual(old.field.atlasMilestones,[]);
assert.equal(old.field.projects.cartografia,true);assert.equal(old.field.signals,8);
console.log('OK: Atlas Vivo 6 categorias, efeitos distintos nas cidades e fontes, marcos 3/6, premiações únicas, migração e privacidade.');
