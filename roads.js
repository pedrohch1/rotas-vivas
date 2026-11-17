'use strict';
// Rede viária LÚDICA desenhada sobre geografia OSM. Não representa rotas reais.
// Cada ponto é uma coordenada ilustrativa; o jogo utiliza Dijkstra e comprimentos geodésicos.
const junctions={
 nC:{lat:-23.8130,lng:-46.7190},nW:{lat:-23.8059,lng:-46.7309},
 nE:{lat:-23.8130,lng:-46.7010},eC:{lat:-23.8293,lng:-46.7002},
 sE:{lat:-23.8455,lng:-46.7016},sC:{lat:-23.8491,lng:-46.7228},
 wN:{lat:-23.8160,lng:-46.7433},wW:{lat:-23.8219,lng:-46.7580},wS:{lat:-23.8325,lng:-46.7515}
};
const links=[
 ['base','nC'],['nC','nW'],['nW','bosque'],['nC','nE'],['nE','palmeiras'],
 ['nE','terminal'],['nE','eC'],['eC','sE'],['sE','serra'],['sE','pesquisa'],
 ['sE','sC'],['sC','pedreira'],['sC','base'],['base','wN'],['wN','nW'],
 ['wN','wW'],['wW','reciclagem'],['wW','wS'],['wS','lago'],['wS','ponte']
];
const bridgeLinks=[['base','ponte'],['ponte','lago']];
function distance(a,b){const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;return 12742000*Math.asin(Math.sqrt(h));}
function graph(sites,bridgeBuilt=false){const points={...junctions};for(const p of sites)points[p.id]={lat:p.lat,lng:p.lng};
 const edges=[...links,...(bridgeBuilt?bridgeLinks:[])].filter(([a,b])=>points[a]&&points[b]);return {points,edges};}
function pathFor(start,target,sites,bridgeBuilt=false){const g=graph(sites,bridgeBuilt),ids=Object.keys(g.points);
 if(!g.points[target])return null;
 // Motoristas fora da estrada entram pelo cruzamento mais próximo; isso não teletransporta o veículo.
 let closest=ids[0],near=Infinity;
 for(const id of ids){const d=distance(start,g.points[id]);if(d<near){near=d;closest=id;}}
 const dist=Object.fromEntries(ids.map(id=>[id,Infinity])),prev={},visited=new Set();dist[closest]=0;
 while(visited.size<ids.length){let current=null,best=Infinity;for(const id of ids)if(!visited.has(id)&&dist[id]<best){current=id;best=dist[id];}
 if(!current||current===target)break;visited.add(current);
 for(const [a,b] of g.edges){const next=a===current?b:b===current?a:null;if(!next||visited.has(next))continue;
 const cost=distance(g.points[current],g.points[next]);if(best+cost<dist[next]){dist[next]=best+cost;prev[next]=current;}}
 }
 if(!Number.isFinite(dist[target]))return null;
 const backwards=[target];while(backwards[0]!==closest)backwards.unshift(prev[backwards[0]]);
 const coords=backwards.map(id=>({...g.points[id]}));
 if(distance(start,coords[0])<30)coords.shift();
 const segments=[{lat:start.lat,lng:start.lng},...coords];
 const meters=segments.slice(1).reduce((sum,p,i)=>sum+distance(segments[i],p),0);
 return {points:coords,meters,via:backwards};}
module.exports={graph,pathFor,distance};
