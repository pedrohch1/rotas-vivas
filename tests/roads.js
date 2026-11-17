'use strict';
const assert=require('node:assert/strict');const {graph,pathFor,distance}=require('../roads');
const sites=[{id:'base',lat:-23.8299,lng:-46.7198},{id:'lago',lat:-23.8421,lng:-46.7553},
{id:'bosque',lat:-23.8041,lng:-46.7356},{id:'reciclagem',lat:-23.8224,lng:-46.7638},
{id:'pedreira',lat:-23.8561,lng:-46.7154},{id:'palmeiras',lat:-23.8107,lng:-46.6884},
{id:'serra',lat:-23.8498,lng:-46.6897},{id:'ponte',lat:-23.8366,lng:-46.7425},
{id:'terminal',lat:-23.8125,lng:-46.705},{id:'pesquisa',lat:-23.8461,lng:-46.7068}];
const old=pathFor(sites[0],'lago',sites,false),improved=pathFor(sites[0],'lago',sites,true);
assert.ok(old.meters>6500);assert.ok(improved.meters<old.meters*.65);
assert.ok(old.points.length>2);assert.ok(improved.via.includes('ponte'));
assert.ok(distance(sites[0],sites[0])<.01);assert.ok(graph(sites,true).edges.length>graph(sites,false).edges.length);
assert.equal(pathFor(sites[0],'inexistente',sites),null);
console.log('OK: redes viárias, cálculo de caminhos, melhoria da ponte e destinos inexistentes.');
