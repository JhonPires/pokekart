(function () {
  'use strict';
  const delay = 3;

  function createQueue({ isActive, onImpact }) {
    const attacks = new Map();
    return {
      add(id, targetId) {
        if (!id || attacks.has(id) || !isActive(targetId)) return false;
        attacks.set(id, { targetId, remaining: delay });
        return true;
      },
      remaining(targetId) {
        let remaining = Infinity;
        for (const attack of attacks.values()) {
          if (attack.targetId === targetId) remaining = Math.min(remaining, attack.remaining);
        }
        return remaining;
      },
      update(dt, paused) {
        for (const [id, attack] of attacks) {
          if (!isActive(attack.targetId)) { attacks.delete(id); continue; }
          if (paused) continue;
          attack.remaining -= dt;
          if (attack.remaining <= 0) {
            attacks.delete(id);
            onImpact(attack.targetId);
          }
        }
      }
    };
  }

  function createWarningUI() {
    const style = document.createElement('style');
    style.textContent = `
      #shockWarning[hidden], #shockVignette[hidden] { display: none !important; }
      #shockVignette { position: fixed; inset: 0; pointer-events: none; z-index: 98;
        box-shadow: inset 0 0 70px rgba(255, 212, 59, .4); animation: shockPulse .8s ease-in-out infinite alternate; }
      #shockWarning { position: fixed; top: 23%; left: 50%; transform: translateX(-50%);
        pointer-events: none; z-index: 110; display: grid; grid-template-columns: 34px 1fr auto;
        gap: 10px; align-items: center; padding: 10px 14px; border: 1px solid #ffd43b; border-radius: 12px;
        background: linear-gradient(120deg, rgba(33, 30, 12, .95), rgba(7, 20, 37, .95));
        box-shadow: 0 0 18px #ffd43b40; color: #fff; font-family: Inter, 'Segoe UI', sans-serif; }
      #shockWarning img { width: 32px; height: 32px; }
      #shockWarning strong { display: block; font-size: 13px; color: #ffd43b; letter-spacing: .8px; }
      #shockWarning small { display: block; margin-top: 3px; font-size: 10px; color: #e8dfb6; }
      #shockWarning b { font-size: 25px; font-variant-numeric: tabular-nums; min-width: 49px; text-align: right; }
      #shockWarning.shielded { border-color: #38bdf8; box-shadow: 0 0 18px #38bdf840; }
      #shockWarning.shielded strong, #shockWarning.shielded small { color: #7dd3fc; }
      @keyframes shockPulse { to { opacity: .45; } }
      @media (max-height: 500px) { #shockWarning { top: 21%; padding: 7px 10px; gap: 7px; }
        #shockWarning img { width: 26px; height: 26px; } #shockWarning b { font-size: 22px; } }
      @media (prefers-reduced-motion: reduce) { #shockVignette { animation: none; } }
    `;
    document.head.appendChild(style);
    const vignette = document.createElement('div');
    vignette.id = 'shockVignette';
    vignette.hidden = true;
    vignette.setAttribute('aria-hidden', 'true');
    const panel = document.createElement('div');
    panel.id = 'shockWarning';
    panel.hidden = true;
    panel.setAttribute('role', 'status');
    panel.innerHTML = '<img src="icones/tematicos/raio.svg" alt=""><div><strong>RAIO A CAMINHO</strong><small>Use o escudo para se defender</small></div><b></b>';
    document.body.append(vignette, panel);
    const timer = panel.querySelector('b');
    const hint = panel.querySelector('small');
    return {
      update(remaining, shielded, hasShield) {
        const visible = Number.isFinite(remaining);
        panel.hidden = vignette.hidden = !visible;
        if (!visible) return;
        panel.classList.toggle('shielded', shielded);
        timer.textContent = Math.max(0, remaining).toFixed(1) + 's';
        hint.textContent = shielded ? 'Escudo ativo — mantenha até o impacto' : hasShield ? 'Use seu escudo agora!' : 'Prepare-se para o impacto';
      }
    };
  }
  window.PokeShockWarning = { delay, createQueue, createWarningUI };
})();
