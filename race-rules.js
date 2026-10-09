(function () {
  'use strict';
  const driftLevels = [
    { level: 1, charge: .8, duration: .8, color: '#38bdf8', label: 'TURBO I' },
    { level: 2, charge: 1.6, duration: 1.3, color: '#ffad45', label: 'TURBO II' },
    { level: 3, charge: 2.5, duration: 1.9, color: '#d18cff', label: 'TURBO III' }
  ];
  const profiles = {
    easy: { think: .5, lookAhead: 12, risk: 1.3, driftLevel: 1, cornerGrip: .88, cornerPenalty: .12, driftCooldown: 3, cornerAccel: 30 },
    normal: { think: .32, lookAhead: 19, risk: 3, driftLevel: 2, cornerGrip: .94, cornerPenalty: .08, driftCooldown: 2.8, cornerAccel: 34 },
    hard: { think: .2, lookAhead: 26, risk: 5, driftLevel: 3, cornerGrip: 1, cornerPenalty: 0, driftCooldown: 2.5, cornerAccel: 38 }
  };
  function driftTier(charge) {
    for (let i = driftLevels.length - 1; i >= 0; i--) {
      if (charge >= driftLevels[i].charge) return driftLevels[i];
    }
    return null;
  }
  function chooseLane({ halfWidth, currentLane, preferredLane, obstacles, profile }) {
    const lanes = [-halfWidth * .7, preferredLane, 0, halfWidth * .7];
    const score = lane => {
      let cost = Math.abs(lane - currentLane) * .14 + Math.abs(lane - preferredLane) * .12;
      for (const o of obstacles) {
        if (o.ahead < -2 || o.ahead > profile.lookAhead) continue;
        const clearance = Math.abs(lane - o.lateral);
        if (clearance < o.radius + 1.2) {
          cost += (o.radius + 1.2 - clearance) * profile.risk * (1 - Math.max(0, o.ahead) / (profile.lookAhead + 1));
        }
      }
      return cost;
    };
    return lanes.reduce((best, lane) => score(lane) < score(best) ? lane : best, lanes[0]);
  }
  function botCornerFactor(curve, profile) {
    return 1 - Math.min(profile.cornerPenalty, Math.max(0, Math.abs(curve) - .25) * .3);
  }
  function planBotCorner(samples, index, spacing, { speed, maxSpeed, turnSpeed, trackWidth, profile }) {
    const brake = 26;
    const preview = Math.max(14, speed * speed / (2 * brake) + 10);
    let safeSpeed = maxSpeed;
    let tightness = 0;
    for (let distance = 0; distance <= preview; distance += 2) {
      const sample = samples[(index + Math.round(distance / spacing)) % samples.length];
      const curvature = Math.abs(sample.curvature || 0);
      if (distance < 14) tightness = Math.max(tightness, curvature);
      if (curvature < .08) continue; // Ordinary corners retain the existing race pace.
      const cornerSpeed = Math.min(Math.sqrt(profile.cornerAccel / curvature), turnSpeed * 1.6 / curvature);
      safeSpeed = Math.min(safeSpeed, Math.sqrt(cornerSpeed * cornerSpeed + 2 * brake * Math.max(0, distance - 3)));
    }
    const tight = tightness >= .06;
    const lookAhead = tight ? Math.max(3, Math.min(trackWidth * .55, 5.5)) : 6 + speed * .35;
    return { safeSpeed: Math.max(3, safeSpeed), lookAhead, tight };
  }
  // Separate entry and exit thresholds prevent noise from releasing repeated boosts.
  function stepBotDrift(bot, dt, { curve, profile, eligible, boosting, rate = 1 }) {
    bot.driftCooldown = Math.max(0, (bot.driftCooldown || 0) - dt);
    const magnitude = Math.abs(curve);
    if (!eligible || boosting || magnitude >= .85) {
      bot.driftCharge = 0; bot.driftDirection = 0; bot.driftExitTime = 0;
      return null;
    }
    if (!bot.driftDirection) {
      if (bot.driftCooldown > 0 || magnitude < .18) return null;
      bot.driftDirection = Math.sign(curve);
      bot.driftCharge = 0; bot.driftExitTime = 0;
    }
    const exiting = magnitude < .07 || Math.sign(curve) !== bot.driftDirection;
    bot.driftExitTime = exiting ? (bot.driftExitTime || 0) + dt : 0;
    if (bot.driftExitTime >= .2) {
      const tier = driftTier(bot.driftCharge);
      bot.driftCharge = 0; bot.driftDirection = 0; bot.driftExitTime = 0;
      bot.driftCooldown = profile.driftCooldown;
      return tier;
    }
    if (!exiting) {
      const cap = driftLevels[profile.driftLevel - 1].charge;
      bot.driftCharge = Math.min(cap, (bot.driftCharge || 0) + dt * rate);
    }
    return null;
  }
  function shouldUseItem(id, s) {
    if (s.disabled || s.age < s.reaction) return false;
    if (id === 'SHIELD') return !s.shielded && (s.threat || s.age >= 8);
    if (id === 'DIG') return s.rank > 1 || s.age >= 8;
    if (s.age >= 8) return true;
    if (['TURBO', 'BLAINE_BOOST', 'SURF'].includes(id)) return s.curve < .32 && !s.boosting;
    if (['ICE', 'LODO', 'FUMACA', 'ROCKET_BOX', 'BROCK_ROCK', 'MISTY_WATER', 'KOGA_SMOKE', 'SABRINA_VORTEX'].includes(id)) return s.behind < 25;
    if (id === 'SOM') return Math.min(s.ahead, s.behind) < 12;
    return s.ahead < 45 || s.behind < 20;
  }
  window.PokeRaceRules = { driftLevels, driftTier, profiles, chooseLane, shouldUseItem, botCornerFactor, stepBotDrift, planBotCorner };
})();
