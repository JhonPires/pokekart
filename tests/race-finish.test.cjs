const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'game.js'), 'utf8');

function race() {
  const standings = {};
  const s = {
    now: 1000, performance: { now: () => s.now }, raceStartTime: 1000, raceStarted: true,
    totalRaceTimeMs: 90000, TOTAL_LAPS: 3, lapStartTime: 1000, localLapTimes: [],
    nearestTrackSample: p => ({ sample: { t: p.t } }),
    document: { getElementById: () => standings }, kart: {},
    playerNickname: 'Player', selectedKartId: 'alakazam', KART_DATABASE: [],
    remoteKarts: new Map(), friendLabel: id => id, window: {}
  };
  vm.createContext(s);
  vm.runInContext(source.slice(source.indexOf('const raceTrackers ='), source.indexOf('let localFinishNotified =')), s);
  vm.runInContext(source.slice(source.indexOf('function updateStandings()'), source.indexOf('let driftHudHidden =')), s);
  vm.runInContext(source.slice(source.indexOf('function handleRemoteKartState('), source.indexOf('function removeRemoteKart(')), s);
  vm.runInContext('globalThis.trackers = raceTrackers;', s);
  function prepare(key) {
    s.trackers.set(key, { progress: 2.99, lapCount: 3, lastRawT: .99, finished: false, finishTime: Infinity });
    if (key !== 'local') s.remoteKarts.set(key, { nickname: key, kartId: key,
      target: { pos: { set() {} }, ry: 0, speed: 0 } });
  }
  function arrive(key, elapsed) { s.now = 1000 + elapsed; return s.updateRaceTracker(key, { t: .01 }); }
  const order = () => Array.from(s.updateStandings(), r => r.key).join(',');
  return { s, prepare, arrive, order };
}

test('jogador em primeiro: bots têm tempos próprios e preservam a ordem de chegada', () => {
  const r = race();
  // Ordem de criação propositalmente diferente da ordem de chegada.
  for (const id of ['local', 'onix', 'scizor', 'blastoise']) r.prepare(id);
  assert.equal(r.arrive('local', 104995).finishTime, 104995);
  assert.equal(r.arrive('scizor', 108200).finishTime, 108200);
  assert.equal(r.order().split(',').slice(0,2).join(','), 'local,scizor');
  r.arrive('blastoise', 111350);
  r.arrive('onix', 116800);
  assert.equal(r.order(), 'local,scizor,blastoise,onix');
  assert.equal(r.s.totalRaceTimeMs, 104995, 'Tempo local permanece congelado');
  assert.equal(new Set(Array.from(r.s.trackers.values(), tr => tr.finishTime)).size, 4);
  r.s.now += 10000;
  assert.equal(r.s.updateRaceTracker('scizor', {t:.5}).finishTime, 108200, 'Chegada não é recalculada');
});

test('jogador em segundo: bots anteriores e posteriores não copiam o HUD', () => {
  const r = race();
  for (const id of ['local', 'bot4', 'bot3', 'bot1']) r.prepare(id);
  r.arrive('bot1', 98000);
  assert.equal(r.s.totalRaceTimeMs, 90000, 'Registro do bot independe do HUD desatualizado');
  r.arrive('local', 105000);
  r.arrive('bot3', 112000);
  r.arrive('bot4', 118000);
  assert.equal(r.order(), 'bot1,local,bot3,bot4');
  assert.equal(r.s.totalRaceTimeMs, 105000);
});

test('empate no milissegundo mantém quem chegou antes, apesar da ordem do Map', () => {
  const r = race();
  for (const id of ['local', 'onix', 'scizor', 'blastoise']) r.prepare(id);
  r.arrive('local', 100000);
  r.arrive('scizor', 110000.1);
  r.arrive('blastoise', 110000.2);
  r.arrive('onix', 110000.3);
  assert.equal(r.order(), 'local,scizor,blastoise,onix');
  assert.equal(r.order(), 'local,scizor,blastoise,onix');
});

test('pacotes de rede mantêm o tempo informado e não reabrem uma chegada', () => {
  const r = race(); r.prepare('remote');
  r.s.now = 120000;
  r.s.handleRemoteKartState('remote', {finished:true, finishTime:112000, progress:3, lapCount:3});
  assert.equal(r.s.trackers.get('remote').finishTime,112000);
  r.s.now = 130000;
  r.s.handleRemoteKartState('remote', {finished:true, progress:3, lapCount:3});
  assert.equal(r.s.trackers.get('remote').finishTime,112000);
  r.s.handleRemoteKartState('remote', {finished:false, progress:2.9, lapCount:3});
  assert.equal(r.s.trackers.get('remote').finished,true);
  assert.equal(r.s.remoteKarts.get('remote').finished,true);
  assert.equal(r.s.trackers.get('remote').finishTime,112000);
});

test('rede sem tempo usa relógio ativo uma vez, sem copiar o tempo local', () => {
  const r = race(); r.prepare('remote');
  r.s.now=121000;
  r.s.handleRemoteKartState('remote', {finished:true, finishTime:0, progress:3, lapCount:3});
  assert.equal(r.s.trackers.get('remote').finishTime,120000);
  r.s.now=131000;
  r.s.handleRemoteKartState('remote', {finished:true, finishTime:0, progress:3, lapCount:3});
  assert.equal(r.s.trackers.get('remote').finishTime,120000);
});
