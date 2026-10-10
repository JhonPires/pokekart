const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'shock-warning.js'), 'utf8'), context);
const { createQueue, delay } = context.window.PokeShockWarning;
const active = new Set(['player', 'bot']);
const shielded = new Set();
const impacts = [];
const queue = createQueue({ isActive: id => active.has(id), onImpact: id => impacts.push({ id, blocked: shielded.has(id) }) });
assert.equal(delay, 3);
assert.equal(queue.add('one', 'player'), true);
assert.equal(queue.add('one', 'player'), false, 'Repeated network packet cannot duplicate damage');
assert.equal(queue.add('missing', 'gone'), false);
queue.update(2.5, false);
assert.equal(impacts.length, 0, 'No instant damage');
assert.equal(queue.remaining('player'), .5);
queue.update(10, true);
assert.equal(queue.remaining('player'), .5, 'Pause must stop the countdown');
shielded.add('player');
queue.update(.5, false);
assert.deepEqual(impacts, [{ id: 'player', blocked: true }], 'Shield equipped during warning blocks at impact');
assert.equal(queue.remaining('player'), Infinity);
queue.update(5, false);
assert.equal(impacts.length, 1, 'Impact occurs exactly once');
queue.add('two', 'player');
shielded.delete('player');
queue.update(3, false);
assert.equal(impacts[1].blocked, false, 'An expired shield cannot block the impact');
queue.add('three', 'bot');
active.delete('bot');
queue.update(3, false);
assert.equal(impacts.length, 2, 'Finishing or disconnected targets must not receive damage');
queue.add('four', 'player');
queue.update(1, false);
queue.add('five', 'player');
assert.equal(queue.remaining('player'), 2, 'New attacks must not postpone an earlier warning');
queue.update(2, false);
assert.equal(impacts.length, 3);
assert.equal(queue.remaining('player'), 1);
queue.update(1, false);
assert.equal(impacts.length, 4);
console.log('Shock warning: reaction window, pause, impact-time shields, duplicates, multiple attacks and finished targets passed.');

// Execute the game's actual impact handler and Master Ball HUD update.
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const hud = {};
const trackers = new Map([['local', { finished: false }]]);
const bot = { isBot: true, finished: false, shieldTimer: 0, collectedMasterBalls: 5, obj: { group: { position: {} } } };
const integration = vm.createContext({
  PokeShockWarning: { ...context.window.PokeShockWarning, createWarningUI: () => ({ update() {} }) },
  raceStarted: true, isPaused: false, raceTrackers: trackers, remoteKarts: new Map([['bot', bot]]),
  isShieldActive: false, physics: { stunTimer: 0 }, collectedMasterBalls: 5,
  kart: { position: {} }, currentItem: null, racePeer: { id: 'local-peer' },
  document: { getElementById: () => hud }, triggerSparkEffect() {},
  playHitSfx() {}, showRaceFeedback() {}, playRaceCue() {}
});
vm.runInContext(game.slice(game.indexOf('function updateMasterBallHUD()'), game.indexOf('// Define o modo final')), integration);
vm.runInContext(game.slice(game.indexOf('const shockWarningUI ='), game.indexOf('function castShockAbility()')), integration);
const hit = (id, target = 'local', seconds = 3) => {
  integration.queueShockAttack(target, id);
  integration.updateShockAttacks(seconds);
};
hit('local-hit', 'local', 2);
assert.equal(integration.collectedMasterBalls, 5, 'Warning must not remove balls before impact');
integration.updateShockAttacks(1);
assert.equal(integration.collectedMasterBalls, 2, 'Actual ray impact removes three balls');
assert.equal(hud.innerText, 2, 'HUD immediately reflects lost balls');
hit('low-balance');
assert.equal(integration.collectedMasterBalls, 0, 'Ball count cannot become negative');
integration.collectedMasterBalls = 5;
integration.queueShockAttack('defend', 'local');
integration.isShieldActive = true;
integration.updateShockAttacks(3);
assert.equal(integration.collectedMasterBalls, 5, 'Shield blocks ball loss');
integration.isShieldActive = false;
hit('network-hit', 'local-peer');
assert.equal(integration.collectedMasterBalls, 2, 'Network targets use the same ball loss handler');
hit('bot-hit', 'bot');
assert.equal(bot.collectedMasterBalls, 2, 'Bots lose three balls too');
hit('bot-low', 'bot');
assert.equal(bot.collectedMasterBalls, 0);
bot.collectedMasterBalls = 5;
bot.shieldTimer = 1;
hit('bot-shield', 'bot');
assert.equal(bot.collectedMasterBalls, 5, 'Bot shield blocks ball loss');
trackers.get('local').finished = true;
hit('finished');
assert.equal(integration.collectedMasterBalls, 2, 'Finished player cannot lose balls');
console.log('Shock impact: local/network ball loss, HUD sync, zero clamp, shield protection and bots passed.');
