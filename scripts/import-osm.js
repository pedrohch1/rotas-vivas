'use strict';
// Importação OPCIONAL, única e limitada; nunca utilizada automaticamente ao abrir o jogo.
// Não é navegação viária: a malha é usada somente para deslocamento fictício no jogo.
const fs=require('node:fs');const path=require('node:path');const {fromOverpass,validateNetwork}=require('../osmroads');
const south=-23.865,west=-46.775,north=-23.798,east=-46.677;
const q=`[out:json][timeout:50];(way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|service|track)$"](${south},${west},${north},${east}););(._;>;);out body;`;
const endpoint=process.env.OVERPASS_URL||'https://overpass.kumi.systems/api/interpreter';
(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),65000);
 try{
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'RotasVivas/0.4 (local map import; game prototype)'},body:new URLSearchParams({data:q}),signal:controller.signal});
  if(!res.ok)throw Error('API OSM respondeu HTTP '+res.status);
  const json=await res.json(),network=fromOverpass(json);validateNetwork(network);
  if(network.edges.length<100)throw Error('Importação incompleta: poucas ruas disponíveis.');
  const dir=path.join(__dirname,'..','data');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'osm-network.json');fs.writeFileSync(file+'.tmp',JSON.stringify(network));fs.renameSync(file+'.tmp',file);
  console.log(`Rede OSM salva: ${Object.keys(network.nodes).length} nós, ${network.edges.length} segmentos. Reinicie o servidor para ativá-la.`);
 }catch(e){console.error('Não foi possível importar a rede OSM:',e.message);process.exitCode=1;}finally{clearTimeout(timer)}
})();
