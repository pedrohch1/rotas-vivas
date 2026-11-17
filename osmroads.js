'use strict';
// Roteamento OPCIONAL na malha do OpenStreetMap. Dados só são importados explicitamente.
// Veículos não trafegam por ciclovias, calçadas ou vias de acesso privado.
const fs=require('node:fs');
const {distance}=require('./roads');
const HIGHWAYS=new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','residential','unclassified','living_street','service','track']);
const round=n=>Math.round(n*1e6)/1e6;
function fromOverpass(json){
 if(!json||!Array.isArray(json.elements))throw Error('Resposta OSM inválida');
 const rawNodes=new Map();for(const el of json.elements)if(el.type==='node'&&Number.isFinite(el.lat)&&Number.isFinite(el.lon))rawNodes.set(el.id,{lat:round(el.lat),lng:round(el.lon)});
 const edges=[];const referenced=new Set();
 for(const way of json.elements){if(way.type!=='way'||!HIGHWAYS.has(way.tags?.highway)||way.tags.access==='private'||way.tags.motor_vehicle==='no'||way.tags.vehicle==='no'||!Array.isArray(way.nodes))continue;
  const reversed=way.tags.oneway==='-1',oneway=way.tags.oneway==='yes'||way.tags.oneway==='1'||way.tags.oneway==='true'||reversed||way.tags.junction==='roundabout';
  for(let i=1;i<way.nodes.length;i++){
   let a=way.nodes[i-1],b=way.nodes[i];if(!rawNodes.has(a)||!rawNodes.has(b)||a===b)continue;if(reversed)[a,b]=[b,a];
   referenced.add(a);referenced.add(b);edges.push([a,b,oneway?1:0]);
  }
 }
 const nodes={};for(const id of referenced)nodes[id]=rawNodes.get(id);
 return {version:1,source:'OpenStreetMap contributors · ODbL',createdAt:new Date().toISOString(),nodes,edges};
}
function validateNetwork(net){if(!net||net.version!==1||typeof net.nodes!=='object'||!Array.isArray(net.edges)||net.edges.length>250000||Object.keys(net.nodes).length>150000)throw Error('Rede viária inválida ou grande demais');
 for(const e of net.edges)if(e.length!==3||!net.nodes[e[0]]||!net.nodes[e[1]])throw Error('Aresta da rede não possui nós');return true;}
function loadNetwork(file){try{if(!fs.existsSync(file))return null;const net=JSON.parse(fs.readFileSync(file,'utf8'));validateNetwork(net);return net;}catch(e){console.error('Rede OSM indisponível:',e.message);return null;}}
function buildAdjacency(net){const adj=new Map();for(const id of Object.keys(net.nodes))adj.set(String(id),[]);
 for(const [a,b,direction] of net.edges){const u=String(a),v=String(b),cost=distance(net.nodes[u],net.nodes[v]);if(!Number.isFinite(cost)||cost<=0)continue;
  adj.get(u).push([v,cost]);if(!direction)adj.get(v).push([u,cost]);
 }return adj;}
function closestNode(net,point){let best=null,min=Infinity;for(const [id,geo] of Object.entries(net.nodes)){const d=distance(point,geo);if(d<min){min=d;best=id}}return best?{id:best,meters:min}:null;}
class MinHeap {constructor(){this.items=[]}push(value){let i=this.items.length;this.items.push(value);while(i>0){const p=(i-1)>>1;if(this.items[p][0]<=value[0])break;this.items[i]=this.items[p];i=p}this.items[i]=value}
 pop(){const a=this.items;if(!a.length)return null;const head=a[0],last=a.pop();if(a.length){let i=0;while(true){let c=i*2+1;if(c>=a.length)break;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=last[0])break;a[i]=a[c];i=c}a[i]=last}return head}}
function shortest(net,adj,origin,destination,bridgeBuilt,sites){
 const nearest={};if(bridgeBuilt){for(const id of ['base','ponte','lago']){const pt=sites.find(p=>p.id===id);if(pt){const node=closestNode(net,pt);if(node)nearest[id]={...node,point:pt}}}}
 const extras=new Map();function link(a,b){if(!a||!b)return;const d=distance(a.point,b.point);if(!extras.has(a.id))extras.set(a.id,[]);if(!extras.has(b.id))extras.set(b.id,[]);extras.get(a.id).push([b.id,d]);extras.get(b.id).push([a.id,d]);}
 if(bridgeBuilt&&nearest.base&&nearest.ponte&&nearest.lago){link(nearest.base,nearest.ponte);link(nearest.ponte,nearest.lago);}
 const dist=new Map([[origin,0]]),prev=new Map(),heap=new MinHeap();heap.push([0,origin]);
 while(heap.items.length){const [d,u]=heap.pop();if(d>dist.get(u))continue;if(u===destination)break;
  for(const [v,cost] of [...(adj.get(u)||[]),...(extras.get(u)||[])]){const nd=d+cost;if(nd<(dist.get(v)??Infinity)){dist.set(v,nd);prev.set(v,u);heap.push([nd,v]);}}
 }
 if(!dist.has(destination))return null;const ids=[destination];while(ids[0]!==origin){const previous=prev.get(ids[0]);if(!previous||ids.length>net.edges.length+5)return null;ids.unshift(previous);}return ids;
}
function reduceWaypoints(points,tolerance=6){if(points.length<3)return points;const simplified=[points[0]];let anchor=0;
 // Conserva curvas significativas e elimina pontos quase colineares.
 function deviation(p,a,b){const dx=b.lng-a.lng,dy=b.lat-a.lat,k=(dx*(p.lng-a.lng)+dy*(p.lat-a.lat))/(dx*dx+dy*dy||1);const at={lat:a.lat+dy*Math.min(1,Math.max(0,k)),lng:a.lng+dx*Math.min(1,Math.max(0,k))};return distance(p,at)}
 for(let i=2;i<points.length;i++){if(deviation(points[i-1],points[anchor],points[i])>tolerance){simplified.push(points[i-1]);anchor=i-1}}simplified.push(points.at(-1));return simplified;}
function routeOnNetwork(start,target,net,sites,bridgeBuilt=false,adj=null){if(!net)return null;
 const from=closestNode(net,start),to=closestNode(net,target);if(!from||!to)return null;
 // Locais do jogo continuam fictícios: o primeiro/último trecho conecta o local à rua mais próxima.
 if(from.meters>2200||to.meters>2200)return null;
 const adjacency=adj||buildAdjacency(net),ids=shortest(net,adjacency,from.id,to.id,bridgeBuilt,sites);if(!ids)return null;
 const coords=[{lat:start.lat,lng:start.lng},...ids.map(id=>net.nodes[id]),{lat:target.lat,lng:target.lng}];
 const meters=coords.slice(1).reduce((n,p,i)=>n+distance(coords[i],p),0);
 const points=reduceWaypoints(coords.slice(1),7).map(p=>({lat:round(p.lat),lng:round(p.lng)}));
 return {points,meters,via:ids.length,source:'osm'};
}
module.exports={fromOverpass,validateNetwork,loadNetwork,buildAdjacency,routeOnNetwork,reduceWaypoints};
