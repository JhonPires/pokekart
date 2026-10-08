// Shared playlist and compact controls for every page that loads background music.
(() => {
  const playlist = Array.from({ length: 9 }, (_, i) => `sounds/lobby_theme${i ? i + 1 : ''}.mp3`);
  const read = (storage, key) => { try { return storage.getItem(key); } catch { return null; } };
  const write = (storage, key, value) => { try { storage.setItem(key, String(value)); } catch { /* Playback works without storage. */ } };
  const clampVolume = value => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : .4;
  let index = Number.parseInt(read(sessionStorage, 'pkart_music_index'), 10);
  if (!Number.isInteger(index) || index < 0 || index >= playlist.length) index = 0;
  let resumeTime = Number(read(sessionStorage, 'pkart_music_time'));
  if (!Number.isFinite(resumeTime) || resumeTime < 0) resumeTime = 0;
  let wanted = read(localStorage, 'pkart_music') !== 'false' && read(localStorage, 'pkart_music_playing') !== 'false' && read(sessionStorage, 'pkart_music_playing') !== 'false';
  let failure = '';
  const audio = new Audio(playlist[index]);
  audio.preload = 'metadata';
  audio.volume = clampVolume(Number.parseFloat(read(localStorage, 'pkart_music_vol')));
  window.globalMusic = audio;
  function state() { return { index, total: playlist.length, paused: audio.paused, wanted, volume: audio.volume, failure }; }
  function notify() { window.dispatchEvent(new CustomEvent('pkart:music-change', { detail: state() })); }
  function saveProgress() {
    write(sessionStorage, 'pkart_music_index', index);
    write(sessionStorage, 'pkart_music_time', resumeTime || audio.currentTime || 0);
    write(sessionStorage, 'pkart_music_playing', wanted);
  }
  function savePreference() {
    write(localStorage, 'pkart_music', wanted);
    write(localStorage, 'pkart_music_playing', wanted);
    saveProgress();
  }
  async function play() {
    failure = '';
    try { await audio.play(); }
    catch (error) {
      if (wanted && error.name !== 'AbortError') failure = error.name === 'NotAllowedError' ? 'Toque em reproduzir para iniciar o áudio.' : 'Não foi possível tocar esta faixa. Tente a próxima.';
    }
    notify();
  }
  function setPlaying(enabled) {
    wanted = enabled; savePreference();
    if (enabled) return play();
    audio.pause(); failure = ''; notify(); return Promise.resolve();
  }
  function changeTrack(delta) {
    index = (index + delta + playlist.length) % playlist.length;
    resumeTime = 0; failure = ''; audio.src = playlist[index];
    saveProgress(); notify();
    if (wanted) return play();
    return Promise.resolve();
  }
  audio.addEventListener('loadedmetadata', () => {
    if (resumeTime > 0) {
      audio.currentTime = Number.isFinite(audio.duration) ? Math.min(resumeTime, Math.max(0, audio.duration - .1)) : resumeTime;
      resumeTime = 0;
    }
    notify();
  });
  audio.addEventListener('ended', () => { changeTrack(1); });
  ['play', 'pause', 'volumechange'].forEach(event => audio.addEventListener(event, notify));
  audio.addEventListener('error', () => { failure = 'Faixa indisponível. Tente a próxima música.'; notify(); });
  setInterval(() => { if (!audio.paused) saveProgress(); }, 2000);
  window.addEventListener('pagehide', saveProgress);
  window.addEventListener('beforeunload', saveProgress);
  window.addEventListener('storage', event => {
    if (!['pkart_music', 'pkart_music_playing', 'pkart_music_vol'].includes(event.key)) return;
    audio.volume = clampVolume(Number.parseFloat(read(localStorage, 'pkart_music_vol')));
    wanted = read(localStorage, 'pkart_music') !== 'false' && read(localStorage, 'pkart_music_playing') !== 'false';
    saveProgress();
    if (wanted && audio.paused) play();
    else if (!wanted) audio.pause();
    notify();
  });
  window.playGlobalMusic = () => wanted ? play() : Promise.resolve();
  window.nextGlobalMusic = () => changeTrack(1);
  window.prevGlobalMusic = () => changeTrack(-1);
  window.togglePlayPauseGlobalMusic = () => setPlaying(audio.paused);
  window.PokeMusic = { state, setPlaying, setVolume(value) { audio.volume = clampVolume(Number(value)); write(localStorage, 'pkart_music_vol', audio.volume); notify(); } };
  function firstInteraction(event) {
    // Explicit controls already handle this gesture; do not undo a pause.
    if (event.target.closest?.('.music-player')) return;
    if (wanted && audio.paused) play();
    document.removeEventListener('click', firstInteraction);
    document.removeEventListener('keydown', firstInteraction);
  }
  document.addEventListener('click', firstInteraction);
  document.addEventListener('keydown', firstInteraction);
  if (wanted && read(sessionStorage, 'pkart_music_playing') === 'true') play();
  function mountPlayer() {
    const player = document.querySelector('.music-player');
    if (!player) return;
    const get = id => player.querySelector(`#${id}`);
    const button = get('btnMusicPlayPause'), options = get('musicOptions'), toggle = get('btnMusicOptions'), slider = get('musicVolumeSlider');
    function update() {
      const s = state(), label = s.paused ? 'Reproduzir música' : 'Pausar música';
      button.textContent = s.paused ? '▶' : '⏸'; button.title = label; button.setAttribute('aria-label', label);
      get('musicTrackText').textContent = `Faixa ${String(s.index + 1).padStart(2, '0')} / ${String(s.total).padStart(2, '0')}`;
      get('musicStatusText').textContent = s.paused ? 'PAUSADA' : s.volume === 0 ? 'SEM SOM' : 'TOCANDO';
      get('menuBtnMusicToggle').setAttribute('aria-label', s.wanted ? 'Desativar música' : 'Ativar música');
      slider.value = s.volume; get('musicVolumeValue').value = `${Math.round(s.volume * 100)}%`;
      get('musicFeedback').textContent = s.failure || (s.paused ? 'Reproduza quando quiser.' : 'A trilha continua ao trocar de tela.');
    }
    toggle.onclick = () => { options.hidden = !options.hidden; toggle.setAttribute('aria-expanded', String(!options.hidden)); toggle.title = options.hidden ? 'Opções de música' : 'Recolher opções'; };
    player.addEventListener('keydown', event => { if (event.key === 'Escape' && !options.hidden) { options.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); event.stopPropagation(); } });
    button.onclick = window.togglePlayPauseGlobalMusic;
    get('btnMusicPrev').onclick = window.prevGlobalMusic;
    get('btnMusicNext').onclick = window.nextGlobalMusic;
    get('menuBtnMusicToggle').onclick = () => setPlaying(!wanted);
    slider.addEventListener('input', () => window.PokeMusic.setVolume(slider.value));
    window.addEventListener('pkart:music-change', update); update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPlayer, { once: true });
  else mountPlayer();
})();
