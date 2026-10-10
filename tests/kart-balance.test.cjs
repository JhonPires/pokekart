const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const balance = require('../kart-balance.js');
const readJSON = name => JSON.parse(fs.readFileSync(path.join(root, 'supabase/balanceamento', name), 'utf8').replace(/^\uFEFF/, ''));
const initial = readJSON('catalogo-antes-20261009.json');
const before = readJSON('catalogo-revalidado-20261009.json');
const after = readJSON('catalogo-proposto-20261009.json');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

// Executa o trecho REAL de integração do jogador, até o deslocamento do kart.
// Sem paredes, adversários, relevos ou coleta de itens: não é um teste de volta.
function engine(stats, dt = 1 / 60) {
  class Vector3 { constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});} }
  const state = {
    THREE: { Vector3, MathUtils: { clamp:(n,a,b)=>Math.max(a,Math.min(b,n)) } },
    PokeKartBalance: balance,
    physics: { ...stats, speed:0, heading:0, maxReverse:-10, brakeDecel:30, friction:10, hopTimer:0,
      driftFactor:0, driftCharge:0, driftTier:0, driftDirection:0, turboTimer:0 },
    kart: { userData:{}, rotation:{y:0}, position:{distance:0, addScaledVector(v,s){this.distance+=Math.abs(s);} } },
    keys:{KeyW:true}, isPaused:false, raceStarted:true, raceTrackers:new Map(), remoteKarts:new Map(),
    collectedMasterBalls:0, isRooted:false, isControlInverted:false, isGasBrakeInverted:false,
    mobileGasActive:false, mobileBrakeActive:false, mobileLeftActive:false, mobileRightActive:false,
    mobileDriftActive:false, isMobile:false, rocketBoxAtiva:false,
    showRaceFeedback(){}, playRaceCue(){}
  };
  vm.createContext(state);
  vm.runInContext(fs.readFileSync(path.join(root,'race-rules.js'),'utf8').replace('window.PokeRaceRules','globalThis.PokeRaceRules'), state);
  const start = game.indexOf('function updatePhysics(dt)');
  const end = game.indexOf('  // Lógica do empurrão', start);
  assert(start >= 0 && end > start);
  vm.runInContext(game.slice(start,end) + '\n}',state);
  return { state, step(){state.updatePhysics(dt);} };
}

function benchmark(stats, scenario, hz=60) {
  const sim=engine(stats,1/hz), {state:s}=sim;
  let boosted=0;
  for(let frame=0; frame<30*hz; frame++) {
    if(scenario==='recuperacao' && frame%(2*hz)===0) s.physics.speed=0;
    if(scenario==='nitro' && frame%(6*hz)===0) s.physics.turboTimer=2*stats.turboBonus;
    if(scenario==='drift') {
      s.keys.Space=frame%(3*hz)<hz;
      s.keys.KeyA=s.keys.Space;
    }
    if(s.physics.turboTimer>0) boosted+=1/hz;
    sim.step();
  }
  return {distance:+s.kart.position.distance.toFixed(2), boosted:+boosted.toFixed(2)};
}

test('catálogo cobre todos os IDs e preserva desbloqueios, modelos e exclusividades',()=>{
  assert.equal(after.length,164);
  assert.equal(new Set(after.map(k=>k.id)).size,164);
  for(const [i,k] of after.entries()) {
    const old=before[i];
    for(const field of ['id','name','concept_img','pokemon_dex_id','activated']) assert.deepEqual(k[field],old[field]);
    if(initial.find(k=>k.id===old.id).price!==old.price || old.price>=9999997 || old.activated===false || ['onix','starmie','raichu','vileplume','muk','alakazam','arcanine','rhydon'].includes(k.id)) assert.equal(k.price,old.price);
    else assert([800,1600,2400,3200].includes(k.price));
    assert.deepEqual(k.physics,balance.profiles[k.stats.style]);
    assert.deepEqual(k.stats,balance.displayStats(k.physics,k.stats.style));
  }
});
test('nenhum perfil domina todos os atributos de outro; iniciais são competitivos',()=>{
  for(const [a,p] of Object.entries(balance.profiles)) for(const [b,q] of Object.entries(balance.profiles)) {
    if(a!==b) assert(Object.keys(p).some(k=>p[k]<q[k]),`${a} domina ${b}`);
  }
  for(const id of ['charizard','blastoise','venusaur']) assert(balance.profiles[after.find(k=>k.id===id).stats.style]);
});
test('cada faixa comercial oferece os cinco perfis, sem pagar por física superior',()=>{
  for(const price of [800,1600,2400,3200]) {
    const styles=new Set(after.filter(k=>k.price===price).map(k=>k.stats.style));
    assert.equal(styles.size,5,`faixa ${price}`);
  }
});
test('troca de kart aplica todos os atributos sem herdar valores do anterior',async()=>{
  const s={ PokeKartBalance:balance, physics:{...balance.profiles.velocidade}, kart:{position:{copy(){}},rotation:{}},
    loadKartTemplate:async(entry,cb)=>cb({}), applyModelToGroup(){}, getGridPosition(){return{pos:{},heading:0};},
    playerSlotParam:0, checkAndStartCountdown(){} };
  vm.createContext(s);
  const start=game.indexOf('function setLocalKartModel('), end=game.indexOf('// ------------------------------------------------------------',start);
  vm.runInContext(game.slice(start,end),s);
  await s.setLocalKartModel({stats:balance.profiles.curvas});
  for(const [k,v] of Object.entries(balance.profiles.curvas)) assert.equal(s.physics[k],v);
  await s.setLocalKartModel({});
  for(const [k,v] of Object.entries(balance.profiles.equilibrado)) assert.equal(s.physics[k],v);
});
test('atributos têm efeito na integração real e os estilos vencem situações diferentes',()=>{
  const results=Object.fromEntries(Object.entries(balance.profiles).map(([id,p])=>[id,Object.fromEntries(['reta','recuperacao','nitro','drift'].map(s=>[s,benchmark(p,s)]))]));
  const best=kind=>Object.keys(results).sort((a,b)=>results[b][kind].distance-results[a][kind].distance)[0];
  assert.equal(best('reta'),'velocidade');
  assert.equal(best('recuperacao'),'arrancada');
  assert.equal(best('drift'),'drift');
  const a=engine(balance.profiles.curvas), b=engine(balance.profiles.velocidade);
  for(const sim of [a,b]) { sim.state.physics.speed=33;sim.state.keys.KeyA=true;sim.step(); }
  assert(a.state.physics.heading>b.state.physics.heading);
  const low=engine({...balance.profiles.equilibrado,grip:.75}),high=engine({...balance.profiles.equilibrado,grip:.93});
  for(const sim of [low,high]) {sim.state.physics.speed=33.2;sim.state.keys.KeyA=true;sim.step();}
  assert(high.state.physics.speed>low.state.physics.speed);
  for(const sim of [a,b]) {sim.state.keys.Space=true;sim.step();}
  assert(a.state.physics.heading>b.state.physics.heading);
  console.log('Bancada real (30s, distância; não são voltas): '+JSON.stringify(results));
});
test('valores inválidos não contaminam física; barras são limitadas e derivadas da física',()=>{
  assert.deepEqual(balance.normalize({accel:NaN,maxSpeed:-2,grip:Infinity}),balance.profiles.equilibrado);
  assert.equal(balance.displayStats({maxSpeed:40}).speed,100);
  assert.equal(balance.displayStats({maxSpeed:100}).speed,100);
  assert.equal(balance.displayStats(balance.profiles.curvas).handling,88);
});
test('migração e reversão têm guardas atômicas para todos os registros',()=>{
  for(const name of ['aplicar','reverter']) {
    const sql=fs.readFileSync(path.join(root,`supabase/balanceamento/${name}-20261009.sql`),'utf8');
    assert(sql.includes('LOCK TABLE public.karts IN SHARE ROW EXCLUSIVE MODE'));
    assert(sql.includes('IF matches <> 164'));
    const changes=JSON.parse(sql.split('$catalog$')[1]);
    assert.deepEqual(changes.map(c=>c.before),name==='aplicar'?before:after);
    assert.deepEqual(changes.map(c=>c.after),name==='aplicar'?after:before);
  }
});
