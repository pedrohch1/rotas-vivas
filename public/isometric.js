/* Rotas Vivas — cenário isométrico 2.5D determinístico, sem downloads de imagens. */
(function (global) {
'use strict';
const BASE={lat:-23.8299,lng:-46.7198};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=(x,y,k=0)=>{let n=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(k|0,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295};
function iso(x,y){return {x:(x-y)*.9,y:(x+y)*.44}}
function deiso(x,y){return {x:(x/.9+y/.44)/2,y:(y/.44-x/.9)/2}}
function project(pos, center, zoom, merc){const p=merc(pos.lat,pos.lng,zoom),c=merc(center.lat,center.lng,zoom),q=iso(p.x-c.x,p.y-c.y);return q;}
function unproject(x,y, center, zoom, merc,inverse){const c=merc(center.lat,center.lng,zoom),d=deiso(x,y);return inverse(c.x+d.x,c.y+d.y,zoom)}
function polygon(ctx,pts,color,stroke){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.65;ctx.stroke()}}
function cube(ctx,x,y,s,height,roof,left,right){const a=iso(-s/2,-s/2),b=iso(s/2,-s/2),c=iso(s/2,s/2),d=iso(-s/2,s/2);const shift=pts=>pts.map(p=>[x+p.x,y+p.y]);let v=shift([a,b,c,d]),t=v.map(p=>[p[0],p[1]-height]);
 polygon(ctx,[v[3],v[2],t[2],t[3]],left,'#34433a55');polygon(ctx,[v[1],v[2],t[2],t[1]],right,'#34433a55');polygon(ctx,t,roof,'#ffffff33');return {top:t,ground:v};}
function tree(ctx,x,y,seed,size=1){const h=15*size+seed*15*size;ctx.fillStyle='#46573755';ctx.beginPath();ctx.ellipse(x+4,y+2,8*size,3*size,0,0,7);ctx.fill();ctx.fillStyle='#786743';ctx.fillRect(x-1,y-h/2,3,h/2+3);const top=y-h;polygon(ctx,[[x,top],[x-10*size,y-h*.27],[x+9*size,y-h*.26]],seed>.6?'#347b4f':'#3d9657');polygon(ctx,[[x,top+7],[x-12*size,y-h*.1],[x+12*size,y-h*.09]],'#206a47');ctx.strokeStyle='#9bc57666';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,top+3);ctx.lineTo(x-7*size,y-h*.3);ctx.stroke()}
function rock(ctx,x,y,k){let s=4+k*8;polygon(ctx,[[x,y-s],[x+s,y-2],[x+s*.4,y+s*.35],[x-s,y+1]],'#c4c4a4');polygon(ctx,[[x,y-s],[x-s,y+1],[x-1,y+2]],'#a2aa95')}
function building(ctx,x,y,key,industrial=false){let k=hash(key,41,2),s=industrial?19+k*11:12+k*8,h=industrial?13+k*38:6+k*25;let walls=['#f1dec3','#c9d3c6','#d8b599','#b6cbd1','#e7e2cc','#c9a58d'];let roof=['#b75e55','#6d7f80','#a59a83','#6a8c75','#826d5f'];let color=walls[Math.floor(hash(key,8)*walls.length)],rf=roof[Math.floor(hash(key,11)*roof.length)];cube(ctx,x,y,s,h,rf,color,'#9aafa6'); if(h>16){ctx.fillStyle='#eef9e8bb';ctx.fillRect(x+s*.26,y-h*.54,3,4);ctx.fillRect(x-s*.32,y-h*.44,3,4)}if(industrial&&k>.55){ctx.fillStyle='#827e78';ctx.fillRect(x+4,y-h-16,5,18);ctx.fillStyle='#e0e8d7aa';ctx.fillRect(x+5,y-h-24,4,7)} }
function groundTile(ctx,x,y,s,color){const a=iso(-s/2,-s/2),b=iso(s/2,-s/2),c=iso(s/2,s/2),d=iso(-s/2,s/2);polygon(ctx,[[x+a.x,y+a.y],[x+b.x,y+b.y],[x+c.x,y+c.y],[x+d.x,y+d.y]],color)}
function drawWorld({ctx,w,h,center,zoom,merc,world,sites}){
 const centerMerc=merc(center.lat,center.lng,zoom),baseMerc=merc(BASE.lat,BASE.lng,zoom);
 const inView=(x,y,pad=65)=>x>-pad&&y>-pad&&x<w+pad&&y<h+pad;
 const worldToScreen=(u,v)=>{const q=iso(u+baseMerc.x-centerMerc.x,v+baseMerc.y-centerMerc.y);return [q.x+w/2,q.y+h/2]};
 ctx.fillStyle='#9fc88c';ctx.fillRect(0,0,w,h);
 const centerLocal={x:centerMerc.x-baseMerc.x,y:centerMerc.y-baseMerc.y},range=deiso(w/2+100,h/2+100);
 // Visível: recorte em torno do ponto central, incluindo cantos do mapa rotacionado.
 const s=34,extent=Math.ceil((Math.abs(range.x)+Math.abs(range.y)+180)/s),cx=Math.round(centerLocal.x/s),cy=Math.round(centerLocal.y/s);
 const centroids=(sites||[]).filter(a=>a.id==='base'||a.target).map(a=>{const p=merc(a.lat,a.lng,zoom);return {x:p.x-baseMerc.x,y:p.y-baseMerc.y,id:a.id}});
 const lake=merc(-23.8421,-46.7553,zoom),waterAxis=lake.x-baseMerc.x;
 let tiles=0;
 for(let sum=-2*extent;sum<=2*extent;sum++){
  for(let ix=-extent;ix<=extent;ix++){
    const iy=sum-ix;if(iy<-extent||iy>extent)continue;
    const i=ix+cx,j=iy+cy,u=i*s,v=j*s,[x,y]=worldToScreen(u,v);if(!inView(x,y,65))continue;tiles++;
    const n=hash(i,j),jitter=hash(i,j,3),inCity=centroids.reduce((best,c)=>Math.min(best,Math.hypot(u-c.x,v-c.y)),Infinity),city=inCity<160,industrial=inCity<85;
    const riverX=waterAxis+48*Math.sin(v/205+.7),riverDist=Math.abs(u-riverX),water=riverDist<60;
    const farm=(!city&&u>40&&v<(-120)&&v>-390&&hash(Math.floor(i/7),Math.floor(j/7),5)>.38);
    const grass=water?'#73c3c8':farm?(n>.5?'#c6ba58':'#adb04a'):city?(n>.6?'#b4d4a2':'#a8c996'):(n>.6?'#a8d494':n>.28?'#aed09a':'#9fc58e');
    groundTile(ctx,x,y,s,grass);
    if(water){if(riverDist>43){ctx.strokeStyle='#e5dfad';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-6,y);ctx.lineTo(x+7,y+2);ctx.stroke()}else if(n>.87){ctx.strokeStyle='#c4e9d8bb';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-8,y+2);ctx.lineTo(x+1,y);ctx.stroke()}continue}
    if(city){const street=(Math.abs(i)%5===0||Math.abs(j)%5===0),main=(Math.abs(i)%10===0||Math.abs(j)%10===0);
      if(street){groundTile(ctx,x,y,s,main?'#606b68':'#737e78');ctx.strokeStyle='#e2e6d888';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.stroke()}
      else if(n>.16)building(ctx,x,y,i*91+j*17,industrial&&jitter>.4);
    }else if(farm){if(i%2===0){ctx.strokeStyle=n>.5?'#756a2f77':'#e1d46d88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-9,y+5);ctx.lineTo(x+8,y-3);ctx.stroke()}}
    else if(n>.71){tree(ctx,x,y,jitter,.7+.65*jitter);if(jitter>.87)tree(ctx,x+12,y-5,hash(i,j,17),.6)}
    else if(n<.035)rock(ctx,x,y,jitter);
  }
 }
 // Roads of the active cooperative are drawn across both rural and urban terrain.
 if(world?.roads?.points){for(const [a,b] of world.roads.edges||[]){const ap=world.roads.points[a],bp=world.roads.points[b];if(!ap||!bp)continue;const p1=merc(ap.lat,ap.lng,zoom),p2=merc(bp.lat,bp.lng,zoom),aa=iso(p1.x-centerMerc.x,p1.y-centerMerc.y),bb=iso(p2.x-centerMerc.x,p2.y-centerMerc.y);const x1=aa.x+w/2,y1=aa.y+h/2,x2=bb.x+w/2,y2=bb.y+h/2;if(!inView(x1,y1,400)&&!inView(x2,y2,400))continue;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle='#d8d4ba';ctx.lineWidth=12;ctx.stroke();ctx.strokeStyle='#535d58';ctx.lineWidth=8;ctx.stroke();ctx.setLineDash([7,8]);ctx.strokeStyle='#e7e6d577';ctx.lineWidth=.9;ctx.stroke();ctx.setLineDash([])}}
 // Permanent improvements visible on terrain.
 if(world?.projects?.find(p=>p.id==='ponte'&&p.completed)){const a=world.projects.find(p=>p.id==='ponte'),p=merc(a.lat,a.lng,zoom),q=iso(p.x-centerMerc.x,p.y-centerMerc.y);ctx.fillStyle='#ddd9bc';ctx.fillRect(q.x+w/2-25,q.y+h/2-3,50,6)}
 return tiles;
}
function drawTruck(ctx,x,y,isYou,label){ctx.save();ctx.translate(x,y);ctx.fillStyle=isYou?'#253a2e':'#233d4b';ctx.beginPath();ctx.ellipse(1,8,21,7,0,0,7);ctx.fill();cube(ctx,0,-2,22,13,isYou?'#e2bb62':'#83bdd4',isYou?'#c59e45':'#76a9b4',isYou?'#a57b32':'#5a899c');ctx.fillStyle='#30433e';ctx.fillRect(-14,7,7,4);ctx.fillRect(9,7,7,4);ctx.restore();if(label){ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillStyle='#183b36';ctx.fillRect(x-36,y-44,72,18);ctx.fillStyle='#f5ffe8';ctx.fillText(String(label).slice(0,13),x,y-31)}}
global.RotasScene={drawWorld,drawTruck,iso,deiso,project,unproject,hash};
})(typeof window!=='undefined'?window:globalThis);
