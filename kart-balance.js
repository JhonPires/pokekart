(function (root) {
  'use strict';
  // Bases competitivas. Preço e desbloqueio não participam da física.
  const profiles = {
    velocidade: { maxSpeed: 34, accel: 27, turnSpeed: 3.25, grip: .80, driftRate: 1.25, driftControl: 1.00, turboBonus: 1.15 },
    arrancada: { maxSpeed: 32.6, accel: 38, turnSpeed: 3.5, grip: .86, driftRate: 1.4, driftControl: 1.08, turboBonus: 1.35 },
    curvas: { maxSpeed: 32.8, accel: 32, turnSpeed: 3.95, grip: .93, driftRate: 1.4, driftControl: 1.12, turboBonus: 1.20 },
    drift: { maxSpeed: 32.5, accel: 30, turnSpeed: 3.6, grip: .83, driftRate: 1.7, driftControl: 1.20, turboBonus: 1.30 },
    equilibrado: { maxSpeed: 33.2, accel: 33, turnSpeed: 3.6, grip: .88, driftRate: 1.5, driftControl: 1.08, turboBonus: 1.25 }
  };
  const labels = { velocidade: 'Velocidade', arrancada: 'Arrancada', curvas: 'Curvas', drift: 'Drift', equilibrado: 'Equilibrado' };
  for (const value of Object.values(profiles)) Object.freeze(value);
  Object.freeze(profiles);
  function normalize(values = {}) {
    const result = {};
    for (const [key, fallback] of Object.entries(profiles.equilibrado)) {
      result[key] = typeof values[key] === 'number' && Number.isFinite(values[key]) && values[key] > 0 ? values[key] : fallback;
    }
    return result;
  }
  function displayStats(values, style) {
    const p = normalize(values);
    const percent = (value, ceiling) => Math.max(0, Math.min(100, Math.round(value / ceiling * 100)));
    // Escalas fixas; há espaço acima das bases para as futuras peças.
    return {
      speed: percent(p.maxSpeed, 40),
      accel: percent(p.accel, 45),
      handling: percent(p.turnSpeed, 4.5),
      ...(Object.hasOwn(labels, style) ? { style } : {})
    };
  }
  root.PokeKartBalance = Object.freeze({ profiles, labels: Object.freeze(labels), normalize, displayStats });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PokeKartBalance;
})(typeof window !== 'undefined' ? window : globalThis);
