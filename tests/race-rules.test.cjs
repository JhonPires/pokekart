const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'race-rules.js'), 'utf8'), context);
const rules = context.window.PokeRaceRules;

assert.equal(rules.driftTier(.79), null, 'An unfinished drift must not award a boost');
assert.equal(rules.driftTier(.8).level, 1, 'The first threshold is inclusive');
assert.equal(rules.driftTier(1.59).level, 1, 'The second tier requires its full charge');
assert.equal(rules.driftTier(1.6).level, 2);
assert.equal(rules.driftTier(2.49).level, 2);
assert.equal(rules.driftTier(2.5).level, 3);
assert(rules.driftTier(2.5).duration > rules.driftTier(1.6).duration);
assert(rules.driftTier(1.6).duration > rules.driftTier(.8).duration);

const situation = { age: 3, reaction: 1, curve: .1, rank: 2,
  ahead: 15, behind: 30, threat: false, shielded: false, boosting: false, disabled: false };
assert(!rules.shouldUseItem('SHIELD', situation), 'Save defense while there is no threat');
assert(rules.shouldUseItem('SHIELD', { ...situation, threat: true }), 'Defend against an incoming threat');
assert(!rules.shouldUseItem('SHIELD', { ...situation, threat: true, shielded: true }), 'Do not waste an active shield');
assert(rules.shouldUseItem('TURBO', situation), 'Boost on a straight');
assert(!rules.shouldUseItem('TURBO', { ...situation, curve: .7 }), 'Wait for the tight corner to end');
assert(!rules.shouldUseItem('TURBO', { ...situation, boosting: true }), 'Save the item while already boosting');
assert(!rules.shouldUseItem('ROCKET_BOX', situation), 'Save a trap if no racer is following');
assert(rules.shouldUseItem('ROCKET_BOX', { ...situation, behind: 8 }), 'Drop a trap for a nearby follower');
assert(!rules.shouldUseItem('SOM', situation), 'Wait until an opponent is in range');
assert(rules.shouldUseItem('SOM', { ...situation, ahead: 5 }));
assert(!rules.shouldUseItem('DIG', { ...situation, rank: 1 }), 'The leader cannot attack with Dig');
assert(!rules.shouldUseItem('CHOQUE', { ...situation, disabled: true }), 'Respect stun and skill cooldown');
assert(!rules.shouldUseItem('CHOQUE', { ...situation, age: .2 }), 'Do not react instantly');
assert(rules.shouldUseItem('ICE', { ...situation, age: 8 }), 'Avoid holding ordinary items indefinitely');

const lane = rules.chooseLane({ halfWidth: 4, currentLane: 0, preferredLane: 0,
  obstacles: [{ ahead: 6, lateral: 0, radius: 1.3 }], profile: rules.profiles.hard });
assert(Math.abs(lane) >= 2, 'Choose a clear lane instead of driving into a rock');
assert(Math.abs(lane) <= 4, 'An avoidance decision must remain within the track');
assert.equal(rules.chooseLane({ halfWidth: 4, currentLane: 0, preferredLane: 0,
  obstacles: [{ ahead: -10, lateral: 0, radius: 1.3 }], profile: rules.profiles.hard }), 0,
  'A hazard already behind the bot must not trigger an avoidance maneuver');
assert(rules.profiles.easy.think > rules.profiles.hard.think, 'Easy opponents react less often');
console.log('Race rules: drift thresholds, defense, item timing and safe lane choices passed.');

const hard = rules.profiles.hard;
assert.equal(rules.botCornerFactor(.6, hard), 1, 'Hard bots retain their pace through ordinary corners');
assert(rules.botCornerFactor(.6, rules.profiles.easy) >= .88, 'Corner braking stays within its difficulty budget');
const bot = {};
const drift = (curve, options = {}) => rules.stepBotDrift(bot, 1 / 60,
  { curve, profile: hard, eligible: true, boosting: false, rate: 1, ...options });
for (let i = 0; i < 180; i++) assert.equal(drift(.12), null, 'Small bends alone must not start a drift');
assert(!bot.driftCharge);
for (let i = 0; i < 160; i++) assert.equal(drift(.3), null, 'A continuing corner must not release a boost');
for (let i = 0; i < 120; i++) assert.equal(drift(i % 2 ? .09 : .06), null,
  'Noise around the exit threshold must not create repeated boosts');
let boosts = 0;
for (let i = 0; i < 20; i++) { const tier = drift(0); if (tier) { boosts++; assert.equal(tier.level, 3); } }
assert.equal(boosts, 1, 'One complete maneuver awards exactly one boost');
for (let i = 0; i < 120; i++) assert.equal(drift(.3), null, 'The bot cannot immediately start another drift');
assert(!bot.driftCharge, 'Cooldown prevents charging before another maneuver');
bot.driftCooldown = 0;
for (let i = 0; i < 60; i++) drift(.3);
drift(0, { eligible: false });
assert.equal(bot.driftCharge, 0, 'A collision or leaving the track cancels the charge');
assert.equal(bot.driftDirection, 0);
bot.driftCooldown = 0;
for (let i = 0; i < 60; i++) drift(.3, { boosting: true });
assert.equal(bot.driftCharge, 0, 'An active item boost must not also charge another drift');
console.log('Bot regression checks: hard corner speed, noisy curves, one boost per maneuver, cooldown and cancellations passed.');

const samples = Array.from({ length: 200 }, () => ({ curvature: 0 }));
const driving = { speed: 36, maxSpeed: 40, turnSpeed: 1.6, trackWidth: 8, profile: hard };
const straight = rules.planBotCorner(samples, 0, 1, driving);
assert.equal(straight.safeSpeed, 40, 'Straight sections retain the full speed, including turbo');
samples[10].curvature = .25;
const approaching = rules.planBotCorner(samples, 0, 1, driving);
assert(approaching.safeSpeed < 36, 'Brake before reaching a hairpin');
assert(approaching.lookAhead <= 4.4, 'Do not aim across a narrow hairpin');
const atCorner = rules.planBotCorner(samples, 10, 1, driving);
assert(atCorner.safeSpeed < approaching.safeSpeed, 'The apex needs less speed than its approach');
assert(atCorner.safeSpeed <= driving.turnSpeed * 1.6 / .25, 'Respect the kart steering limit');
const wrapped = rules.planBotCorner(samples, 190, 1, driving);
assert(wrapped.safeSpeed < 40, 'Preview corners across the start/finish boundary');
console.log('Hairpin checks: early braking, short steering target, steering limit and closed-track preview passed.');
