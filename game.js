(()=>{'use strict';
const cv=document.getElementById('game'),g=cv.getContext('2d');
const el=id=>document.getElementById(id);
const W=960,H=540,TOP=76,BOTTOM=469,LEVEL_COUNT=9,PI=Math.PI;
const themes=[
  {name:'Coral Cove',deep:'#07527c',light:'#39c5db',floor:'#e8c78b',coral:['#ff758e','#ffaf62','#9a67d8'],fish:'#ffdb57',speed:1},
  {name:'Crystal Caverns',deep:'#062953',light:'#2a8ea9',floor:'#6f95b7',coral:['#65edee','#b39cfa','#87d1ff'],fish:'#80e7ff',speed:1.18},
  {name:'Midnight Reef',deep:'#05142f',light:'#184f87',floor:'#486a91',coral:['#b669f4','#f38ccc','#46f5db'],fish:'#ffd46c',speed:1.35}
];
const labels=['First Splash','Coral Dash','Octopus Alley','Crystal Trail','Glitter Grottos','The Deep Crossing','Moonlit Waters','Tentacle Tunnel','Ocean Champion'];
const keyState={up:false,down:false,dash:false};
const pointerMap=new Map();let mode='menu',selected=0,unlocked=1,best=0,totalBest=0,muted=false,audioCtx=null;
const saveKey='little-shark-ocean-quest-v1';
try{const data=JSON.parse(localStorage.getItem(saveKey)||'{}');unlocked=Math.min(LEVEL_COUNT,Math.max(1,Number(data.unlocked)||1));best=Math.max(0,Number(data.best)||0);totalBest=Math.max(0,Number(data.totalBest)||0);muted=!!data.muted;}catch{}
let level=0,worldWidth=3500,player={},coins=[],treasures=[],enemies=[],powerups=[],bursts=[],checkpoint=180,camera=0,score=0,lives=3,frame=0,invincible=0,shield=0,dashTime=0,dashReady=true,toastUntil=0,toastText='',totalRun=0,combo=0,comboUntil=0,trail=[];
function store(){try{localStorage.setItem(saveKey,JSON.stringify({unlocked,best,totalBest,muted}));}catch{}}
function sound(freq=500,ms=80,type='sine',vol=.035){if(muted||mode==='menu')return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audioCtx.currentTime);gain.gain.setValueAtTime(vol,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+ms/1000);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+ms/1000);}catch{}}
function toast(str){toastText=str;toastUntil=performance.now()+1350;el('toast').textContent=str;el('toast').style.opacity='1';}
function rand(seed){let t=seed+0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
function loadLevel(index){level=index;score=0;lives=3;frame=0;checkpoint=110;camera=0;invincible=105;shield=0;dashTime=0;dashReady=true;combo=0;comboUntil=0;trail=[];worldWidth=2550+Math.floor(index/3)*330+(index%3)*260;player={x:260,y:248,w:67,h:37,vx:0,vy:0,face:1};const danger=index;const count=35+index*6;
 coins=[];treasures=[];enemies=[];powerups=[];bursts=[];
 for(let i=0;i<count;i++){let x=250+i*(worldWidth-540)/count;let y=135+rand(i*73+index*107)*260;coins.push({x,y,got:false});if(i%5===1&&x<worldWidth-160){coins.push({x:x+24,y:y-27,got:false},{x:x+49,y:y+3,got:false});}}
 // Extra ocean collectibles: seashells, starfish, gems and treasure chests.
 const kinds=['shell','starfish','gem','chest'];
 const spacing=155,amount=Math.floor((worldWidth-520)/spacing);
 for(let i=0;i<amount;i++){
  const kind=kinds[(i+Math.floor(i/4)+index)%kinds.length];
  const x=345+i*spacing+rand(550+i*9+index*31)*45;
  const y=116+rand(710+i*41+index*17)*295;
  if(x<worldWidth-165)treasures.push({x,y,kind,got:false,phase:rand(855+i*29+index)*PI*2});
 }
 for(let i=0;i<7+danger*2;i++){const x=490+i*(worldWidth-950)/(6+danger*2);enemies.push({x,baseY:140+rand(index*109+i*23)*235,y:0,phase:rand(i*53+index*11)*6,alive:true,hit:0,r:22+Math.min(10,Math.floor(index/3)*4),pattern:i%3,drift:10+rand(i*31+index*9)*35,tempo:.024+rand(i*19+3)*.025});}
 for(let i=0;i<2;i++)powerups.push({x:1150+i*(worldWidth-1550)/2,y:180+((i+index)%3)*70,type:i===0?'shield':'bonus',got:false});
 updateHUD();}
function updateHUD(){el('world').textContent=`WORLD ${Math.floor(level/3)+1} · LEVEL ${level%3+1}`;el('pearls').textContent=`⭐ ${score}`;el('hearts').textContent='❤️'.repeat(Math.max(0,lives));el('best').textContent=`BEST ${Math.max(best,score)}`;el('sound').textContent=muted?'🔇':'🔊';}
function choices(){const root=el('worldselect');root.innerHTML='';for(let i=0;i<LEVEL_COUNT;i++){let b=document.createElement('button');b.className='level-choice'+(selected===i?' selected':'');b.textContent=i<unlocked?`${Math.floor(i/3)+1}-${i%3+1}`:'🔒 '+`${Math.floor(i/3)+1}-${i%3+1}`;b.disabled=i>=unlocked;b.addEventListener('click',()=>{selected=i;choices();el('primary').textContent=`PLAY ${themes[Math.floor(selected/3)].name.toUpperCase()} ${selected%3+1}`;});root.appendChild(b);}}
function overlay(title,description,button){el('title').textContent=title;el('description').innerHTML=description;el('primary').textContent=button;choices();el('overlay').style.display='grid';}
function start(i=selected){selected=i;loadLevel(i);mode='playing';el('overlay').style.display='none';releaseAll();sound(540,110);}
function win(){if(mode!=='playing')return;mode='won';unlocked=Math.max(unlocked,Math.min(LEVEL_COUNT,level+2));best=Math.max(best,score);totalRun+=score;totalBest=Math.max(totalRun,totalBest);store();sound(840,290,'triangle');const all=level===LEVEL_COUNT-1;selected=all?0:level+1;overlay(all?'🏆 Ocean Champion!':'🌟 Level Complete!',`Great swimming! You scored <b>${score} points</b>.<br>${all?'You finished all three ocean worlds!':'Next: '+labels[selected]}.`,all?'PLAY AGAIN':'NEXT LEVEL');}
function lose(){if(mode!=='playing')return;mode='lost';store();sound(165,280,'sawtooth');selected=level;overlay('🫧 Out of Hearts',`The octopuses got you! You scored <b>${score} points</b>.<br>Try this level again.`, 'TRY AGAIN');}
function hurt(){if(invincible>0||dashTime>0)return;if(shield){shield=0;invincible=55;toast('🛡️ Shield saved you!');sound(230,120);return;}lives--;invincible=95;sound(150,220,'square');if(lives<=0){lose();return;}player.x=Math.max(checkpoint,player.x-80);camera=Math.max(0,Math.min(worldWidth-W,player.x-270));player.y=240;player.vx=0;player.vy=0;toast('❤️ Watch out for octopuses!');updateHUD();}
function resetKeys(){Object.keys(keyState).forEach(k=>keyState[k]=false);}
function releaseAll(){pointerMap.clear();document.querySelectorAll('[data-action]').forEach(b=>b.classList.remove('pressed'));resetKeys();}
function syncPointers(){let pressed=new Set(pointerMap.values());for(const k of Object.keys(keyState))keyState[k]=pressed.has(k)||!!keyboard[k];document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('pressed',pressed.has(b.dataset.action)));}
const keyboard={up:false,down:false,dash:false};
for(const button of document.querySelectorAll('[data-action]')){
 button.addEventListener('pointerdown',e=>{e.preventDefault();if(mode!=='playing')return;pointerMap.set(e.pointerId,button.dataset.action);try{button.setPointerCapture(e.pointerId);}catch{}syncPointers();});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,e=>{if(pointerMap.delete(e.pointerId))syncPointers();});
}
for(const ev of ['pointerup','pointercancel'])window.addEventListener(ev,e=>{if(pointerMap.delete(e.pointerId))syncPointers();},true);
window.addEventListener('blur',()=>{releaseAll();Object.keys(keyboard).forEach(k=>keyboard[k]=false);if(mode==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseAll();Object.keys(keyboard).forEach(k=>keyboard[k]=false);if(mode==='playing')pause();}});
document.addEventListener('contextmenu',e=>{if(e.target.closest('button,canvas,#controls'))e.preventDefault();});
document.addEventListener('selectstart',e=>{if(e.target.closest('button,#controls,canvas'))e.preventDefault();});
const codeMap={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'dash'};
document.addEventListener('keydown',e=>{const k=codeMap[e.code];if(k){e.preventDefault();keyboard[k]=true;syncPointers();}if(e.code==='KeyP'&&!e.repeat)pause();});
document.addEventListener('keyup',e=>{const k=codeMap[e.code];if(k){e.preventDefault();keyboard[k]=false;syncPointers();}});
function pause(){if(mode==='playing'){mode='paused';releaseAll();overlay('⏸️ Paused','Your ocean adventure is safe. Resume when ready.','RESUME');}else if(mode==='paused'){mode='playing';el('overlay').style.display='none';}}
el('pause').addEventListener('click',pause);
el('sound').addEventListener('click',()=>{muted=!muted;store();updateHUD();});
el('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw Error('not supported');}catch{toast('For iPhone: Safari → Share → Add to Home Screen');}});
el('primary').addEventListener('click',()=>{if(mode==='paused'){pause();return;}start(selected);});
const near=(x,y,cx,cy,r)=>Math.hypot(x-cx,y-cy)<r;
const treasureValues={shell:3,starfish:5,gem:8,chest:15};
const treasureNames={shell:'SEASHELL',starfish:'STARFISH',gem:'GEM',chest:'TREASURE CHEST'};
function addBurst(x,y,text){bursts.push({x,y,text,life:48});if(bursts.length>12)bursts.shift();}
function tick(){frame++;if(mode!=='playing')return;const speed=(6.0+level*.15)*(shield?1.03:1);const yAxis=(keyState.down?1:0)-(keyState.up?1:0);player.vx=speed;player.vy=yAxis*7.1;
 if(keyState.dash&&dashReady){dashTime=24;dashReady=false;sound(750,140,'sawtooth');}if(!keyState.dash)dashReady=true;
 let multiplier=dashTime>0?3.1:1;if(dashTime>0)dashTime--;
 player.face=1;
 const prevX=player.x;player.x=Math.min(worldWidth-115,player.x+player.vx*multiplier);player.y=Math.max(TOP+20,Math.min(BOTTOM-38,player.y+player.vy));
 if(invincible>0)invincible--;
 if(frame%3===0){trail.push({x:player.x,y:player.y,age:0,dash:dashTime>0});if(trail.length>22)trail.shift();}for(const b of trail)b.age++;trail=trail.filter(b=>b.age<28);
 if(frame>comboUntil)combo=0;
 for(const c of coins){if(!c.got&&near(player.x,player.y,c.x,c.y,34)){c.got=true;combo=Math.min(10,combo+1);comboUntil=frame+145;const bonus=combo>=5?2:1;score+=bonus;if(combo===5)toast('🔥 PEARL RUSH! DOUBLE POINTS');sound(550+combo%6*75,65,'triangle');}}
 for(const t of treasures){
  if(t.got||t.x<prevX-42||t.x>player.x+42)continue;
  if(Math.abs(t.y-player.y)<43){
    t.got=true;const points=treasureValues[t.kind];score+=points;
    addBurst(t.x,t.y,'+'+points);toast('✨ '+treasureNames[t.kind]+' +'+points);
    sound(690+points*17,120,'triangle');
  }
 }
 for(const b of bursts)b.life--;bursts=bursts.filter(b=>b.life>0);
 for(const p of powerups){if(!p.got&&near(player.x,player.y,p.x,p.y,40)){p.got=true;if(p.type==='shield'){shield=1;toast('🛡️ Bubble shield!');}else{score+=10;toast('✨ 10 bonus pearls!');}sound(910,180,'sine');}}
 for(const e of enemies){if(!e.alive)continue;e.y=e.baseY+Math.sin(frame*e.tempo*(1+level*.04)+e.phase)*(e.pattern===1?62:32);e.liveX=e.x+(e.pattern===0?0:Math.sin(frame*(e.tempo*.65)+e.phase)*e.drift);if(near(player.x,player.y,e.liveX,e.y,e.r+28)){if(dashTime>0){e.alive=false;score+=10;toast('⚡ DASH HIT! +10');sound(680,140,'triangle');}else hurt();}}
 checkpoint=Math.max(checkpoint,Math.floor((player.x-100)/650)*650+110);
 if(player.x>=worldWidth-130)win();camera=Math.max(0,Math.min(worldWidth-W,player.x-270));
 best=Math.max(best,score);updateHUD();}
function circle(x,y,r,color){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,2*PI);g.fill();}
function ellipse(x,y,rx,ry,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,2*PI);g.fill();}
function polygon(points,color){g.fillStyle=color;g.beginPath();g.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)g.lineTo(...points[i]);g.closePath();g.fill();}
function seaweed(x,y,h,col){g.strokeStyle=col;g.lineWidth=7;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x-19,y-h*.4,x+16,y-h*.65,x,y-h);g.stroke();}
function coral(x,y,scale,color){g.save();g.translate(x,y);g.scale(scale,scale);g.strokeStyle=color;g.lineWidth=11;g.lineCap='round';for(let b=-1;b<=1;b++){g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(b*18,-35,b*22,-72);g.stroke();g.beginPath();g.moveTo(b*10,-38);g.lineTo(b*34,-50);g.stroke();}g.restore();}
function drawBackground(t){let bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,t.light);bg.addColorStop(.63,t.deep);bg.addColorStop(1,'#06233e');g.fillStyle=bg;g.fillRect(0,0,W,H);
 for(let i=0;i<11;i++){let px=((i*153-camera*.11)%(W+400)+(W+400))%(W+400)-100;polygon([[px,0],[px+45,0],[px+205,H]],'rgba(200,245,254,.055)');}
 for(let i=0;i<24;i++){const x=((i*203-camera*.2)%(W+350)+(W+350))%(W+350)-110;const y=60+(i*67)%345;ellipse(x,y,20+(i%4)*11,11+(i%3)*6,'#89e4e824');}
 for(let i=0;i<20;i++){let x=((i*151+frame*.3*(i%2?1:-1)-camera*.35)%(W+300)+(W+300))%(W+300)-120;let y=75+(i*43)%330;const s=2+(i%3);circle(x,y,s,'#d1faff78');}
 const floorY=485;g.fillStyle=t.floor;g.beginPath();g.moveTo(0,H);g.lineTo(0,floorY);for(let x=0;x<=W+28;x+=28)g.lineTo(x,floorY+Math.sin((x+camera)*.016)*8);g.lineTo(W,H);g.fill();
 for(let i=0;i<37;i++){const wx=i*161+40,px=wx-camera*.72;if(px<-110||px>W+110)continue;seaweed(px,490,26+(i%5)*14,i%2?'#39a88e':'#188e8c');if(i%3===0)coral(px+25,488,.38+(i%3)*.08,t.coral[i%3]);}
 for(let i=0;i<11;i++){let x=i*340+140-camera*.58;if(x<-80||x>W+80)continue;ellipse(x,476,62,19,'#04294762');}
}
function drawPearl(c){const x=c.x-camera;if(x<-40||x>W+40)return;let bounce=Math.sin(frame*.08+c.x*.02)*3;circle(x,c.y+bounce,14,'#cb791c');circle(x,c.y+bounce,10,'#ffdc52');circle(x-3,c.y-3+bounce,4,'#fff6b3');}
function drawTreasure(t){
 const x=t.x-camera,y=t.y+Math.sin(frame*.065+t.phase)*5;
 if(x<-55||x>W+55)return;
 g.save();g.translate(x,y);
 g.shadowColor='#fff4b0';g.shadowBlur=10+Math.sin(frame*.09+t.phase)*5;
 if(t.kind==='shell'){g.font='33px system-ui';g.textAlign='center';g.fillText('🐚',0,11);}
 else if(t.kind==='starfish'){g.font='35px system-ui';g.textAlign='center';g.fillText('⭐',0,12);}
 else if(t.kind==='gem'){g.font='35px system-ui';g.textAlign='center';g.fillText('💎',0,12);}
 else {
  g.fillStyle='#884521';g.fillRect(-21,-7,42,30);g.fillStyle='#ffcb52';g.fillRect(-21,-12,42,13);
  g.strokeStyle='#e89b36';g.lineWidth=3;g.strokeRect(-21,-12,42,35);
  g.fillStyle='#ffe376';g.fillRect(-4,-11,8,32);g.fillStyle='#fff3b2';g.fillRect(-3,3,6,7);
 }
 g.restore();
}
function drawBursts(){
 g.save();g.textAlign='center';g.font='bold 23px system-ui';
 for(const b of bursts){const x=b.x-camera;if(x<-70||x>W+70)continue;
   g.globalAlpha=Math.max(0,b.life/48);g.fillStyle='#fff5a6';g.fillText(b.text,x,b.y-20+(48-b.life)*-.65);
 }
 g.restore();
}
function drawOctopus(e,t){if(!e.alive)return;const x=(e.liveX??e.x)-camera,y=e.y;if(x<-100||x>W+100)return;g.save();g.translate(x,y);let b=Math.sin(frame*.12+e.phase)*4;for(let k=-2;k<=2;k++){g.strokeStyle=t.coral[2];g.lineWidth=9;g.lineCap='round';g.beginPath();g.moveTo(k*7,8);g.quadraticCurveTo(k*12,29+b,k*18,20-b);g.stroke();}ellipse(0,-5,27,26,t.coral[2]);ellipse(-9,-9,7,9,'white');ellipse(10,-9,7,9,'white');circle(-7,-9,3,'#11335b');circle(12,-9,3,'#11335b');g.strokeStyle='#58267a';g.lineWidth=2;g.beginPath();g.arc(2,4,6,.1,PI-.1);g.stroke();g.restore();}
function drawShark(){const x=player.x-camera,y=player.y;if(invincible&&Math.floor(frame/5)%2===0)return;g.save();g.translate(x,y);g.scale(player.face,1);let flap=Math.sin(frame*.23)*7;
 polygon([[-24,-1],[-70,-30+flap],[-65,13],[-23,15]],'#e4bb31');polygon([[-11,-15],[-9,-43],[22,-19]],'#f0c943');polygon([[-12,13],[-14,31],[14,14]],'#efc12c');ellipse(1,0,43,25,'#fbd85b');ellipse(19,10,24,13,'#fff7db');ellipse(27,-7,5.5,6,'#fff');circle(29,-7,3,'#122e51');ellipse(37,5,4,2,'#a66756');g.strokeStyle='#925e5e';g.lineWidth=2;g.beginPath();g.arc(27,10,10,.15,1.5);g.stroke();ellipse(9,9,7,4,'#f2ac8b');
 if(shield){g.strokeStyle='#a7f8ff';g.lineWidth=4;g.beginPath();g.arc(0,0,53,0,PI*2);g.stroke();}
 if(dashTime>0){g.strokeStyle='#f6ffff';g.lineWidth=3;for(let i=0;i<3;i++){g.beginPath();g.moveTo(-90-i*15,-10+i*11);g.lineTo(-55-i*12,-10+i*11);g.stroke();}}
 g.restore();}
function drawGate(){let x=worldWidth-90-camera;g.save();g.translate(x,268);g.shadowColor='#7ff5fb';g.shadowBlur=30;g.lineWidth=15;g.strokeStyle='#8ef2fd';g.beginPath();g.ellipse(0,0,35,92,0,0,PI*2);g.stroke();g.shadowBlur=0;g.font='bold 16px system-ui';g.fillStyle='#e8ffff';g.textAlign='center';g.fillText('FINISH',0,-113);g.restore();}
function drawSpeedEffects(){
 g.save();
 for(const b of trail){const x=b.x-camera,y=b.y;if(x<-50||x>W+50)continue;const fade=1-b.age/28;
  g.globalAlpha=fade*(b.dash?.65:.25);circle(x-32,y+Math.sin(b.age)*5,b.dash?12:5,b.dash?'#fff3ac':'#b8f9ff');
 }
 if(mode==='playing'&&dashTime>0){g.strokeStyle='#ffffff65';g.lineWidth=3;
  for(let i=0;i<10;i++){const x=(i*167+frame*27)%W,y=80+(i*43)%360;g.beginPath();g.moveTo(x,y);g.lineTo(x-67,y);g.stroke();}}
 g.restore();
}
function drawWorld(){const theme=themes[Math.floor(level/3)];drawBackground(theme);drawSpeedEffects();for(const c of coins)if(!c.got)drawPearl(c);for(const t of treasures)if(!t.got)drawTreasure(t);drawBursts();for(const p of powerups){if(p.got)continue;const x=p.x-camera;circle(x,p.y,18,p.type==='shield'?'#80f3ff':'#ffd76a');g.font='24px system-ui';g.textAlign='center';g.fillText(p.type==='shield'?'🛡️':'⭐',x,p.y+8);}for(const e of enemies)drawOctopus(e,theme);drawGate();drawShark();if(mode==='playing'){if(combo>=3){g.fillStyle='#fff6a8';g.font='bold 19px system-ui';g.textAlign='center';g.fillText('PEARL COMBO ×'+combo+(combo>=5?' · 2X SCORE':''),W/2,65);}g.fillStyle='#ffffffaa';g.font='bold 14px system-ui';g.textAlign='right';g.fillText(`${Math.min(100,Math.floor(player.x/(worldWidth-100)*100))}% →`,W-15,70);}}
let prev=0,acc=0;function loop(now){const dt=Math.min(50,now-prev||16.67);prev=now;acc+=dt;while(acc>=16.667){if(mode==='playing')tick();else frame++;acc-=16.667;}drawWorld();if(performance.now()>toastUntil)el('toast').style.opacity='0';requestAnimationFrame(loop);}loadLevel(0);choices();updateHUD();requestAnimationFrame(loop);
})();