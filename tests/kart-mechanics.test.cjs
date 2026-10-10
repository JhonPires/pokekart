const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const balance=require('../kart-balance.js');
const mechanic=require('../kart-mechanics.js');
const base=balance.profiles.equilibrado;
const parts=[{modifiers:{accel:.08}},{modifiers:{maxSpeed:.04}},{modifiers:{brakeDecel:.12}},
  {modifiers:{turboBonus:.1}},{modifiers:{grip_add:.04,driftControl:.04}}];

test('peças aplicam bônus sobre a base, com limites e sem acumular a cada abertura',()=>{
  const original=JSON.stringify(base),p=mechanic.applyParts(base,parts);
  assert.equal(p.accel,base.accel*1.08);assert.equal(p.maxSpeed,base.maxSpeed*1.04);
  assert.equal(p.brakeDecel,30*1.12);assert.equal(p.turboBonus,base.turboBonus*1.1);
  assert.equal(p.grip,base.grip+.04);assert.equal(p.driftControl,base.driftControl*1.04);
  assert.deepEqual(mechanic.applyParts(base,parts),p);assert.equal(JSON.stringify(base),original);
  const capped=mechanic.applyParts(base,[{modifiers:{accel:100,maxSpeed:100,grip_add:100,driftControl:100}}]);
  assert.equal(capped.accel,base.accel*1.15);assert.equal(capped.maxSpeed,base.maxSpeed*1.08);
  assert(capped.grip<=.98);assert.equal(capped.driftControl,base.driftControl*1.1);
});
test('inventário filtra pelo kart e durabilidade e só atualiza moedas após salvar',async()=>{
  const profile={coins:1000};const calls=[];
  const data={coins:650,catalog:[{id:'motor',modifiers:{accel:.08}}],parts:[
    {id:'one',part_id:'motor',kart_id:'jolteon',remaining:1},
    {id:'two',part_id:'motor',kart_id:'onix',remaining:10},
    {id:'three',part_id:'motor',kart_id:'jolteon',remaining:0}]};
  const service=mechanic.createService({rpc:async(name,args)=>{calls.push({name,args});return{data,error:null};}},()=>profile);
  await service.buy('motor','purchase-uuid');assert.equal(profile.coins,650);
  assert.equal(calls[0].args.p_part_id,'motor');assert.equal(calls[0].args.p_purchase_id,'purchase-uuid');
  assert.equal(service.equipped('jolteon').length,1);assert.equal(service.equipped('jolteon')[0].instanceId,'one');
  assert.equal(service.equipped('jolteon')[0].modifiers.accel,.08);
  const failing=mechanic.createService({rpc:async()=>({error:{message:'Moedas insuficientes.'}})},()=>profile);
  await assert.rejects(failing.buy('motor','another'),/Moedas insuficientes/);assert.equal(profile.coins,650);
});
test('requisição incerta reutiliza ID; largada confirmada libera um ID para a próxima corrida',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const first=mechanic.raceRequest('onix',storage,()=> '11111111-1111-4111-8111-111111111111');
  const retry=mechanic.raceRequest('onix',storage,()=>{throw new Error('Não deve gerar outro ID')});
  assert.equal(first.id,retry.id);retry.complete();
  const next=mechanic.raceRequest('onix',storage,()=> '22222222-2222-4222-8222-222222222222');assert.notEqual(first.id,next.id);
});

function countdown(fail=false){
  const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
  let interval,after,resolveStart;
  const overlay={style:{}};
  const request={id:'race',completed:false,complete(){this.completed=true;}};
  const snapshot={physics:{...base,accel:base.accel*1.08,brakeDecel:33.6},parts:[{remaining:0}]};
  const s={window:{RaceLoading:{failed:false,hide(){},fail(message){this.failed=true;this.message=message;}}},
    PokeKartBalance:balance,PokeKartMechanic:{raceRequest:()=>request,getService:()=>({startRace:()=>new Promise((res,rej)=>{resolveStart=()=>fail?rej(new Error('offline')):res(snapshot);})})},
    crypto:{randomUUID:()=> 'race'},sessionStorage:{},selectedKartId:'jolteon',physics:{...base},
    raceSceneReady:true,raceStartRequested:false,countdownInProgress:false,raceStarted:false,raceReadyTimeout:0,
    document:{getElementById:()=>overlay},performance:{now:()=>1000},gasPressedTime:0,countdownStartTime:0,
    raceStartTime:0,raceFinishSequence:2,totalRaceTimeMs:0,lapStartTime:0,localLapTimes:[],
    clearTimeout(){},clearInterval(){},setInterval(fn){interval=fn;return 1;},setTimeout(fn){after=fn;}};
  vm.createContext(s);vm.runInContext(source.slice(source.indexOf('function startCountdown()'),source.indexOf('function updatePhysics(dt)')),s);
  s.startCountdown();return {s,overlay,request,step:()=>interval(),resolve:()=>resolveStart(),hide:()=>after()};
}
test('largada espera o servidor e aplica a última carga antes do primeiro frame',async()=>{
  const r=countdown();await r.step();await r.step();const pending=r.step();
  assert.equal(r.s.raceStarted,false);assert.equal(r.request.completed,false);
  r.resolve();await pending;
  assert.equal(r.s.raceStarted,true);assert.equal(r.s.physics.accel,base.accel*1.08);
  assert.equal(r.s.physics.brakeDecel,33.6);assert.equal(r.request.completed,true);
  r.hide();assert.equal(r.s.countdownInProgress,false);
});
test('falha ao confirmar durabilidade bloqueia largada e preserva ID para tentar de novo',async()=>{
  const r=countdown(true);await r.step();await r.step();const pending=r.step();r.resolve();await pending;
  assert.equal(r.s.raceStarted,false);assert.equal(r.request.completed,false);assert.equal(r.s.window.RaceLoading.failed,true);
  assert.match(r.s.window.RaceLoading.message,/offline/);
});
