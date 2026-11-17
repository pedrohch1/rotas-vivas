'use strict';
const assert=require('node:assert/strict');const {fromOverpass,buildAdjacency,routeOnNetwork,validateNetwork,reduceWaypoints}=require('../osmroads');
const nodes=[
 {id:1,type:'node',lat:-23.830,lon:-46.720},
 {id:2,type:'node',lat:-23.830,lon:-46.719},
 {id:3,type:'node',lat:-23.830,lon:-46.718},
 {id:4,type:'node',lat:-23.831,lon:-46.719}
];
const ways=[{type:'way',id:10,nodes:[1,2,3],tags:{highway:'residential',oneway:'yes'}},
 {type:'way',id:11,nodes:[3,4,1],tags:{highway:'service'}},
 {type:'way',id:12,nodes:[1,3],tags:{highway:'footway'}},
 {type:'way',id:13,nodes:[1,3],tags:{highway:'residential',access:'private'}}];
const net=fromOverpass({elements:[...nodes,...ways]});validateNetwork(net);assert.equal(net.edges.length,4);
const adj=buildAdjacency(net);assert.ok(adj.get('1').some(x=>x[0]==='2'));assert.ok(!adj.get('2').some(x=>x[0]==='1'));
const sites=[{id:'base',lat:nodes[0].lat,lng:nodes[0].lon},{id:'ponte',lat:nodes[1].lat,lng:nodes[1].lon},{id:'lago',lat:nodes[2].lat,lng:nodes[2].lon}];
const backwards=routeOnNetwork(sites[2],sites[0],net,sites,false,adj);
assert.ok(backwards&&backwards.via>=3,'one-way reverse must go through alternate road');
const forwards=routeOnNetwork(sites[0],sites[2],net,sites,false,adj);assert.ok(forwards&&forwards.meters<backwards.meters);
assert.ok(routeOnNetwork(sites[0],sites[2],net,sites,true,adj));
assert.ok(reduceWaypoints([{lat:0,lng:0},{lat:.001,lng:0},{lat:.002,lng:0}],5).length<=2);
assert.throws(()=>fromOverpass({elements:null}));
console.log('OK: importador OSM, vias privadas/pedestres rejeitadas, mão única e Dijkstra geográfico.');
