const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const energy=require('../energy-ball.js');
const shot={id:'a',owner:'caster',x:0,z:0,dx:0,dz:1};
test('trajetória reta para frente/trás, prazo limitado e pausa',()=>{
  const sim=energy.createSimulation();sim.add(shot);sim.add({...shot,id:'b',dz:-1});
  sim.update(.5);assert.equal(sim.shots.get('a').z,32);assert.equal(sim.shots.get('b').z,-32);
  sim.update(1,true);assert.equal(sim.shots.get('a').z,32);
  sim.update(3);assert.equal(sim.shots.size,0);
});
test('colisão contínua acerta o primeiro kart e ignora dono, finalizados e outra altura',()=>{
  const hits=[];const sim=energy.createSimulation({getTargets:()=>[
    {id:'caster',x:0,y:1,z:2},{id:'finished',x:0,y:1,z:5,finished:true},
    {id:'bridge',x:0,y:12,z:7},{id:'far',x:0,y:1,z:22},{id:'near',x:0,y:1,z:12}],onHit:(s,t)=>hits.push(t.id)});
  sim.add(shot);sim.update(.5);assert.deepEqual(hits,['near']);assert.equal(sim.shots.size,0);
  sim.update(.5);assert.equal(hits.length,1);
});
test('réplicas de rede são visuais, pacotes duplicados e inválidos não criam projéteis extras',()=>{
  let hits=0,removed=0;
  const sim=energy.createSimulation({getTargets:()=>[{id:'other',x:0,y:1,z:4}],onHit:()=>hits++,onRemove:()=>removed++});
  assert(sim.add(shot));assert(!sim.add(shot));assert(!sim.add({...shot,id:'invalid',dx:NaN}));
  sim.update(.5,false,false);assert.equal(hits,0);assert.equal(sim.shots.size,1);
  sim.remove('a');sim.remove('a');assert.equal(removed,1);assert(!sim.add(shot));
});
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
function impactContext(shield=false){
  const bot={isBot:true,finished:false,shieldTimer:0,speed:30,stunTimer:0,turboTimer:2,collectedMasterBalls:5,obj:{group:{position:{x:1,y:0,z:0}}}};
  const s={energyImpacts:new Map(),performance:{now:()=>100},racePeer:{id:'me'},remoteKarts:new Map([['bot',bot]]),
    raceTrackers:new Map(),isShieldActive:shield,isHost:true,roomCodeParam:'room',kart:{position:{}},
    physics:{speed:30,stunTimer:0,turboTimer:2,isDrifting:true,driftCharge:1},balls:5,
    playHitSfx(){},showRaceFeedback(){},triggerSparkEffect(){}};
  s.loseMasterBalls=n=>s.balls=Math.max(0,s.balls-n);
  vm.createContext(s);vm.runInContext(source.slice(source.indexOf('function applyEnergyImpact('),source.indexOf('\nfunction spawnDigProjectile(')),s);
  return {s,bot};
}
test('impacto real aplica stun, cancela turbo, remove três bolas uma vez e respeita escudo/chegada',()=>{
  const {s,bot}=impactContext();s.applyEnergyImpact('me','hit');
  assert.equal(s.physics.stunTimer,1);assert.equal(s.physics.speed,0);assert.equal(s.physics.turboTimer,0);assert.equal(s.balls,2);
  s.applyEnergyImpact('me','hit');assert.equal(s.balls,2);
  s.applyEnergyImpact('bot','bot-hit');assert.equal(bot.stunTimer,1);assert.equal(bot.collectedMasterBalls,2);
  const protectedPlayer=impactContext(true);protectedPlayer.s.applyEnergyImpact('me','shield');assert.equal(protectedPlayer.s.balls,5);assert.equal(protectedPlayer.s.physics.stunTimer,0);
  const protectedBot=impactContext();protectedBot.bot.shieldTimer=3;protectedBot.s.applyEnergyImpact('bot','shield');assert.equal(protectedBot.bot.collectedMasterBalls,5);assert.equal(protectedBot.bot.stunTimer,0);
  const finished=impactContext();finished.s.raceTrackers.set('local',{finished:true});finished.s.applyEnergyImpact('me','finish');assert.equal(finished.s.balls,5);
});
test('host recebe pedidos; cliente recebe apenas visual e impacto direcionado sem duplicar dano',()=>{
  const {s}=impactContext();const launches=[],spawns=[],removed=[];
  s.launchEnergyBall=(id,back)=>launches.push([id,back]);s.spawnEnergyBall=shot=>spawns.push(shot);
  s.energySimulation={remove:id=>removed.push(id)};
  vm.runInContext(source.slice(source.indexOf('function handleNetworkMessage('),source.indexOf('\nfunction handleRemoteKartState(')),s);
  s.handleNetworkMessage({t:'energy_request',casterId:'guest',backwards:true});assert.deepEqual(launches,[['guest',true]]);
  s.handleNetworkMessage({t:'energy_hit',targetId:'me',shotId:'untrusted'});assert.equal(s.balls,5);
  s.isHost=false;s.handleNetworkMessage({t:'energy_request',casterId:'guest'});assert.equal(launches.length,1);
  s.handleNetworkMessage({t:'energy_spawn',shot:{id:'network-shot'}});assert.equal(spawns.length,1);
  s.handleNetworkMessage({t:'energy_hit',targetId:'me',shotId:'network-shot'});
  s.handleNetworkMessage({t:'energy_hit',targetId:'me',shotId:'network-shot'});
  assert.equal(s.balls,2);assert.equal(s.physics.stunTimer,1);assert(removed.includes('network-shot'));
});
