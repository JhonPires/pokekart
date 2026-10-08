// Paint the loading screen before the synchronous scene setup and keep it until the first ready frames.
(() => {
  const screen = document.getElementById('raceLoadingScreen');
  const status = document.getElementById('raceLoadingStatus');
  const gameSrc = document.currentScript.dataset.gameSrc;
  let failed = false;

  window.RaceLoading = {
    get failed() { return failed; },
    nextPaint: () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    setStatus(message) { if (!failed) status.textContent = message; },
    hide() {
      if (failed) return;
      screen.setAttribute('aria-busy', 'false');
      screen.hidden = true;
    },
    fail(message) {
      failed = true;
      screen.hidden = false;
      screen.style.zIndex = '20002';
      screen.setAttribute('aria-busy', 'false');
      document.getElementById('raceLoadingTitle').textContent = 'NÃO FOI POSSÍVEL PREPARAR A CORRIDA';
      status.textContent = message || 'Confira sua conexão e tente novamente.';
      screen.querySelector('.race-loading-bar').hidden = true;
      document.getElementById('raceLoadingActions').hidden = false;
    }
  };
  document.getElementById('raceLoadingRetry').onclick = () => window.location.reload();
  window.addEventListener('error', event => {
    if (!screen.hidden && event.filename && event.filename.includes('/game.js')) {
      console.error('[Corrida] Falha na inicialização:', event.error);
      window.RaceLoading.fail();
    }
  });

  window.RaceLoading.nextPaint().then(() => {
    window.RaceLoading.setStatus('Montando a pista...');
    const script = document.createElement('script');
    script.src = gameSrc;
    script.onerror = () => window.RaceLoading.fail();
    document.body.appendChild(script);
  });
})();
