// NeoTurf Masters Online — MVP 2D HD fiel arcade
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const W = 1000, H = 600;
const socket = io();

// Estado local
let room = null, mySocketId = null;
let hole = { tee:{x:120,y:300}, hole:{x:880,y:300}, par:4, wind:{angle:0.6,power:5} };
let players = [{ name:'Yo (local)', x:120, y:300, shots:0, holed:false, color:'#fff' }];
let meIndex = 0, turnIndex = 0;
let aim = 0, meter = null; // {phase:'power'|'impact', p:0, dir:1, power:0}
let ballAnim = null;
let myName = 'Yo';

const COLORS = ['#ffffff','#ffd54f','#4fc3f7','#ef9a9a'];

socket.on('connect', ()=> mySocketId = socket.id);
socket.on('state', (s)=>{
  room = s; hole = s.hole; players = s.players.map((p,i)=>({...p,color:COLORS[i%4]}));
  meIndex = players.findIndex(p=>p.socketId===mySocketId);
  if(meIndex<0) meIndex=0;
  turnIndex = s.turnIndex;
  updateStatus();
});

// --- Terreno ---
function dist(x1,y1,x2,y2){return Math.hypot(x2-x1,y2-y1);}
function getLie(x,y){
  if(dist(x,y,hole.hole.x,hole.hole.y)<90) return 'green';
  // bunkers
  if(((x-550)/55)**2+((y-230)/32)**2<1) return 'bunker';
  if(((x-700)/60)/1,0){}
  if(((x-700)/60)**2+((y-390)/34)**2<1) return 'bunker';
  // fairway: capsula tee->hole ancho 120
  const t=clamp(((x-hole.tee.x)*(hole.hole.x-hole.tee.x)+(y-hole.tee.y)*(hole.hole.y-hole.tee.y))/((760)**2+1),0,1);
  const px=hole.tee.x+760*t, py=300;
  if(dist(x,y,px,py)<70) return 'fairway';
  if(x<20||x>W-20||y<20||y>H-20) return 'ob';
  return 'rough';
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function clubFor(d,onGreen){
  if(onGreen) return {name:'PUTTER',max:60,prec:1.0};
  if(d>180) return {name:'DRIVER 1W',max:260,prec:0.92};
  if(d>110) return {name:'IRON 5i',max:170,prec:0.96};
  if(d>40) return {name:'WEDGE PW',max:90,prec:1.0};
  return {name:'PUTTER',max:60,prec:1.0};
}

// --- Input ---
document.addEventListener('keydown',e=>{
  if(e.code==='ArrowLeft') aim-=0.03;
  if(e.code==='ArrowRight') aim+=0.03;
  if(e.code==='Space'){ e.preventDefault(); onSpace(); }
  if(e.code==='KeyR') autoAim();
});
cv.addEventListener('click',()=>{ onSpace(); });
cv.addEventListener('mousemove',(e)=>{
  if(meter||ballAnim) return;
  const r=cv.getBoundingClientRect();
  const mx=(e.clientX-r.left)*(W/r.width), my=(e.clientY-r.top)*(H/r.height);
  const me=players[meIndex];
  if(me) aim=Math.atan2(my-me.y,mx-me.x);
});

function myTurn(){ if(!room) return true; return turnIndex===meIndex; }

function onSpace(){
  const me=players[meIndex];
  if(!me||me.holed||ballAnim) return;
  if(room && !myTurn()){ flash('Espera tu turno…'); return; }
  if(!meter){ meter={phase:'power',p:0,dir:1}; }
  else if(meter.phase==='power'){ meter.power=meter.p; meter.phase='impact'; meter.p=0.5; meter.dir=meter.power>0.5?-1:1; }
  else { shoot(meter.power, meter.p); meter=null; }
}
function autoAim(){
  const me=players[meIndex];
  aim=Math.atan2(hole.hole.y-me.y,hole.hole.x-me.x);
}

function shoot(power,impact){
  const me=players[meIndex];
  const lie=getLie(me.x,me.y);
  const dHole=dist(me.x,me.y,hole.hole.x,hole.hole.y);
  const onGreen=lie==='green';
  const club=clubFor(dHole,onGreen);
  // precisión: distancia al centro 0.5
  const acc=Math.abs(impact-0.5)*2; // 0 perfecto
  let angErr=(acc**1.2)*0.35*(lie==='rough'?1.8:lie==='bunker'?2.4:1)*club.prec;
  if(Math.random()<0.5) angErr*=-1;
  let effPow=power;
  if(lie==='rough') effPow*=0.75;
  if(lie==='bunker') effPow*=0.6;
  if(lie==='green'&&!onGreen){}
  const maxD=club.max;
  let baseD=effPow*maxD;
  // viento
  const wA=hole.wind.angle, wP=hole.wind.power;
  const shotA=aim+angErr;
  // descomponer
  const wx=Math.cos(wA)*wP, wy=Math.sin(wA)*wP;
  const windAlong=Math.cos(shotA-wA)*wP;
  baseD+=windAlong*4;
  const windSide=Math.sin(wA-shotA)*wP;
  const tx=me.x+Math.cos(shotA)*baseD + Math.cos(wA+Math.PI/2)*windSide*2;
  const ty=me.y+Math.sin(shotA)*baseD + Math.sin(wA+Math.PI/2)*windSide*2;
  // animación vuelo
  ballAnim={x0:me.x,y0:me.y,x1:tx,y1:ty,t:0,high:!onGreen};
  me._from={x:me.x,y:me.y};
  me._to={x:tx,y:ty};
}

function finishShot(){
  const me=players[meIndex];
  let {x1,y1}=ballAnim; ballAnim=null;
  // rodadura / freno según lie destino
  const lie=getLie(x1,y1);
  let roll = lie==='green'?0.25:lie==='fairway'?0.15:lie==='rough'?0.03:lie==='bunker'?0.0:0.1;
  const me2=players[meIndex];
  const dx=x1-me2.x, dy=y1-me2.y;
  x1+=dx*roll; y1+=dy*roll;
  x1=clamp(x1,10,W-10); y1=clamp(y1,10,H-10);
  me2.x=x1; me2.y=y1; me2.shots++;
  const dHole=dist(x1,y1,hole.hole.x,hole.hole.y);
  // putt: si muy cerca, emboca
  const puttDist = lie==='green'?12:8;
  if(dHole<puttDist){ me2.holed=true; flash(`¡${me2.name} emboca en ${me2.shots}!`); }
  else autoAim();
  if(room){
    socket.emit('shoot',{x:x1,y:y1,shots:me2.shots},()=>{});
  }
  updateStatus();
}

// --- Render HD ---
let grass=null;
function makeGrass(){
  grass=document.createElement('canvas'); grass.width=W; grass.height=H;
  const g=grass.getContext('2d');
  g.fillStyle='#2f8f3e'; g.fillRect(0,0,W,H);
  for(let i=0;i<9000;i++){
    g.fillStyle=`rgba(${20+Math.random()*40|0},${120+Math.random()*60|0},${40+Math.random()*30|0},0.25)`;
    g.fillRect(Math.random()*W,Math.random()*H,2,2);
  }
}
makeGrass();

function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(grass,0,0);
  // fairway capsule
  ctx.fillStyle='#43b04d';
  ctx.beginPath();
  ctx.ellipse(500,300,390,72,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#4ec45a';
  ctx.beginPath(); ctx.ellipse(500,300,360,58,0,0,Math.PI*2); ctx.fill();
  // green
  const grd=ctx.createRadialGradient(hole.hole.x,hole.hole.y,10,hole.hole.x,hole.hole.y,95);
  grd.addColorStop(0,'#5be06e'); grd.addColorStop(1,'#35a244');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(hole.hole.x,hole.hole.y,90,0,7); ctx.fill();
  ctx.strokeStyle='#ffffff88'; ctx.setLineDash([6,6]); ctx.beginPath(); ctx.arc(hole.hole.x,hole.hole.y,90,0,7); ctx.stroke(); ctx.setLineDash([]);
  // bunkers
  for(const [bx,by,rx,ry] of [[550,230,55,32],[700,390,60,34]]){
    ctx.fillStyle='#e8d48a'; ctx.beginPath(); ctx.ellipse(bx,by,rx,ry,0,0,7); ctx.fill();
    ctx.fillStyle='#d9c06f'; ctx.beginPath(); ctx.ellipse(bx,by,rx-8,ry-8,0,0,7); ctx.fill();
  }
  // agua decorativa
  ctx.fillStyle='#3aa7e0'; ctx.beginPath(); ctx.ellipse(430,500,140,42,0,0,7); ctx.fill();
  ctx.fillStyle='#ffffff33'; ctx.beginPath(); ctx.ellipse(400,492,70,10,-0.2,0,7); ctx.fill();
  // arboles
  for(const [tx,ty] of [[200,120],[320,480],[640,120],[830,150],[150,450],[920,470]]){
    ctx.fillStyle='#1d5c27'; ctx.beginPath(); ctx.arc(tx,ty,26,0,7); ctx.fill();
    ctx.fillStyle='#2f8f3e'; ctx.beginPath(); ctx.arc(tx-6,ty-6,16,0,7); ctx.fill();
  }
  // tee + hoyo
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(hole.tee.x,hole.tee.y,6,0,7); ctx.fill();
  ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(hole.hole.x,hole.hole.y,7,0,7); ctx.fill();
  ctx.fillStyle='#e00'; ctx.fillRect(hole.hole.x-1,hole.hole.y-42,3,42);
  ctx.fillStyle='#ff0'; ctx.beginPath(); ctx.moveTo(hole.hole.x+2,hole.hole.y-42); ctx.lineTo(hole.hole.x+26,hole.hole.y-35); ctx.lineTo(hole.hole.x+2,hole.hole.y-28); ctx.fill();

  // línea apuntado
  const me=players[meIndex];
  if(me&&!me.holed&&!ballAnim){
    const dHole=dist(me.x,me.y,hole.hole.x,hole.hole.y);
    const club=clubFor(dHole,getLie(me.x,me.y)==='green');
    document.getElementById('club').textContent=`Palo: ${club.name} · Dist: ${dHole|0}m · Lie: ${getLie(me.x,me.y)} · Viento ${vientoTxt()}`;
    ctx.strokeStyle='#ffffffcc'; ctx.setLineDash([8,6]);
    ctx.beginPath(); ctx.moveTo(me.x,me.y);
    ctx.lineTo(me.x+Math.cos(aim)*Math.min(160,club.max),me.y+Math.sin(aim)*Math.min(160,club.max));
    ctx.stroke(); ctx.setLineDash([]);
    // punto caída estimada
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(me.x+Math.cos(aim)*Math.min(160,club.max),me.y+Math.sin(aim)*Math.min(160,club.max),3,0,7); ctx.fill();
  }
  // jugadores / bolas
  players.forEach((p,i)=>{
    if(ballAnim&&i===meIndex) return; // la bola animada se dibuja aparte
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.x+2,p.y+4,7,3,0,0,7); ctx.fill();
    ctx.fillStyle=p.color||'#fff'; ctx.beginPath(); ctx.arc(p.x,p.y,6,0,7); ctx.fill();
    ctx.fillStyle='#000'; ctx.font='11px system-ui'; ctx.fillText(`${p.name} (${p.shots})`,p.x-20,p.y-12);
    if(room&&i===turnIndex&&!p.holed){ ctx.strokeStyle='#ffeb3b'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(p.x,p.y,10,0,7); ctx.stroke(); ctx.lineWidth=1; }
  });
  // anim bola
  if(ballAnim){
    ballAnim.t+=0.02;
    const t=Math.min(1,ballAnim.t);
    const x=ballAnim.x0+(ballAnim.x1-ballAnim.x0)*t;
    const y=ballAnim.y0+(ballAnim.y1-ballAnim.y0)*t - (ballAnim.high?Math.sin(t*Math.PI)*90:Math.sin(t*Math.PI)*10);
    const shx=ballAnim.x0+(ballAnim.x1-ballAnim.x0)*t, shy=ballAnim.y0+(ballAnim.y1-ballAnim.y0)*t;
    ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(shx,shy,6,3,0,0,7); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x,y,6,0,7); ctx.fill();
    if(ballAnim.t>=1) finishShot();
  }
  // meter
  if(meter){
    if(meter.phase==='power'){ meter.p+=0.025*meter.dir; if(meter.p>1){meter.p=1;meter.dir=-1;} if(meter.p<0){meter.p=0;meter.dir=1;} }
    else { meter.p+=0.04*meter.dir; if(meter.p>1){meter.p=1;meter.dir=-1;} if(meter.p<0){meter.p=0;meter.dir=1;} }
    document.getElementById('power').style.width=(meter.phase==='power'?meter.p*100:meter.power*100)+'%';
    document.getElementById('cursor').style.left=(meter.p*100)+'%';
  }
  // viento flecha
  drawWind();
  requestAnimationFrame(draw);
}
function vientoTxt(){
  const dirs=['E','SE','S','SO','O','NO','N','NE'];
  const i=((hole.wind.angle/(Math.PI*2)*8)+8|0)%8;
  return `${dirs[i]} ${hole.wind.power.toFixed(1)}m/s`;
}
function drawWind(){
  ctx.save(); ctx.translate(90,70);
  ctx.fillStyle='#000a'; ctx.beginPath(); ctx.arc(0,0,30,0,7); ctx.fill();
  ctx.strokeStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,30,0,7); ctx.stroke();
  ctx.rotate(hole.wind.angle);
  ctx.fillStyle='#4fc3f7'; ctx.fillRect(0,-3,20+hole.wind.power*1.5,6);
  ctx.beginPath(); ctx.moveTo(22+hole.wind.power*1.5,0); ctx.lineTo(12+hole.wind.power*1.5,-7); ctx.lineTo(12+hole.wind.power*1.5,7); ctx.fill();
  ctx.restore();
  ctx.fillStyle='#fff'; ctx.font='12px system-ui'; ctx.fillText(vientoTxt(),55,105);
}
let flashT=null;
function flash(m){ const s=document.getElementById('status'); s.textContent=m; clearTimeout(flashT); flashT=setTimeout(updateStatus,2500); }
function updateStatus(){
  const el=document.getElementById('status');
  if(!room){ el.textContent=`Local · Golpes: ${players[0].shots} · Pulsa ESPACIO para tirar.`; return; }
  const t=players[turnIndex];
  el.innerHTML=`Sala <b>${room.code}</b> · Par ${room.hole.par} · Turno: <b>${t?t.name:'—'}</b>${t&&t.socketId===mySocketId?' (¡te toca!)':''}<br>`+
    players.map(p=>`${p.name}: ${p.shots} ${p.holed?'✅':''}`).join(' · ');
  document.getElementById('roomLabel').textContent='Sala '+room.code;
}

// sala UI
document.getElementById('btnCreate').onclick=()=>{
  myName=document.getElementById('name').value||'Yo';
  socket.emit('create-room',{name:myName},(r)=>{ if(r.state){room=r.state;hole=r.state.hole;players=r.state.players.map((p,i)=>({...p,color:COLORS[i%4]}));meIndex=0;turnIndex=0;autoAim();updateStatus();} });
};
document.getElementById('btnJoin').onclick=()=>{
  myName=document.getElementById('name').value||'Yo';
  const code=document.getElementById('code').value;
  socket.emit('join-room',{code,name:myName},(r)=>{
    if(r.error) return flash(r.error);
    room=r.state;hole=r.state.hole;players=r.state.players.map((p,i)=>({...p,color:COLORS[i%4]}));
    meIndex=players.findIndex(p=>p.socketId===mySocketId); turnIndex=r.state.turnIndex; autoAim(); updateStatus();
  });
};
autoAim(); updateStatus(); draw();
