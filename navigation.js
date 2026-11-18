'use strict';
// Rotas de carro via roteador compatível com OSRM. Nunca enviamos GPS pessoal.
const {distance}=require('./roads');
const cache=new Map();let lastExternalRequest=0;
const ttl=15*60*1000,round=n=>Math.round(n*1e6)/1e6;
function lineLength(start,points){let prev=start,total=0;for(const p of points){total+=distance(prev,p);prev=p}return total;}
function simplify(points,max=160){
 if(points.length<=max)return points;
 const result=[];for(let i=0;i<max;i++)result.push(points[Math.round(i*(points.length-1)/(max-1))]);return result;
}
function parseDrivingRoute(json,start,target){
 if(json?.code!=='Ok'||!Array.isArray(json.routes)||!json.routes.length)return null;
 const route=json.routes[0],coords=route.geometry?.coordinates;
 if(!Number.isFinite(route.distance)||route.distance<=0||route.distance>150000||!Number.isFinite(route.duration)||route.duration<=0||route.duration>86400||!Array.isArray(coords)||coords.length<2||coords.length>25000)return null;
 const points=coords.map(c=>Array.isArray(c)&&c.length>=2&&Number.isFinite(c[0])&&Number.isFinite(c[1])?{lat:round(c[1]),lng:round(c[0])}:null);
 if(points.some(p=>!p||Math.abs(p.lat)>90||Math.abs(p.lng)>180))return null;
 const snapStart=distance(start,points[0]),snapEnd=distance(target,points.at(-1));
 if(snapStart>1200||snapEnd>1200)return null;
 const shape=simplify(points,160);shape.push({lat:round(target.lat),lng:round(target.lng)});
 const geometryMeters=lineLength(start,shape),durationSeconds=Math.max(20,Math.round(route.duration+snapStart/8+snapEnd/8));
 return {source:'osm-driving',meters:Math.round(route.distance+snapStart+snapEnd),points:shape,durationSeconds,geometryMeters};
}
async function fetchDrivingRoute(start,target,fetcher=globalThis.fetch){
 if(process.env.ROUTING_ENABLED!=='1'||typeof fetcher!=='function')return null;
 const point=p=>round(p.lng).toFixed(6)+','+round(p.lat).toFixed(6);
 const key=point(start)+';'+point(target),now=Date.now(),hit=cache.get(key);
 if(hit&&hit.expires>now)return hit.route;
 // Serviço de demonstração: máximo de uma requisição por segundo por processo.
 if(now-lastExternalRequest<1150)return null;lastExternalRequest=now;
 const service=(process.env.ROUTING_BASE_URL||'https://router.project-osrm.org').replace(/\/+$/,'');
 if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(service))return null;
 try{
  const url=service+'/route/v1/driving/'+key+'?overview=full&geometries=geojson&steps=false';
  const response=await fetcher(url,{signal:AbortSignal.timeout(4500),headers:{Accept:'application/json','User-Agent':'RotasVivas/0.8 (non-commercial cooperative game)'}});
  if(!response.ok)return null;
  const plan=parseDrivingRoute(await response.json(),start,target);
  if(plan){cache.set(key,{route:plan,expires:now+ttl});if(cache.size>80)cache.delete(cache.keys().next().value);}
  return plan;
 }catch{return null;}
}
function enrichRoute(start,plan){
 const geometryMeters=lineLength(start,plan.points),durationSeconds=plan.durationSeconds||Math.max(45,Math.ceil(geometryMeters/12.5));
 return {...plan,geometryMeters,durationSeconds,pace:Math.max(.5,geometryMeters/durationSeconds)};
}
module.exports={parseDrivingRoute,fetchDrivingRoute,enrichRoute,lineLength};
