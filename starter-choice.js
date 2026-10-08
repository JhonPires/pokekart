(() => {
  const starters = [
    { id: 'charizard', name: 'Charizard', type: 'Fogo', color: '#fb923c' },
    { id: 'venusaur', name: 'Venusaur', type: 'Planta', color: '#4ade80' },
    { id: 'blastoise', name: 'Blastoise', type: 'Água', color: '#38bdf8' }
  ];
  let pendingChoice = null;

  window.ensureStarterChoice = function (profile) {
    if (profile.starter_choice_completed !== false) return Promise.resolve(profile);
    if (pendingChoice) return pendingChoice;
    pendingChoice = new Promise(resolve => openChoice(profile, resolve));
    return pendingChoice;
  };

  function openChoice(profile, resolve) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const greeting = `Olá! Sou o Professor Carvalho. Sua nova aventura nas pistas começa aqui! Escolha seu primeiro parceiro: Charizard, Venusaur ou Blastoise. Qual deles vai correr ao seu lado?`;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const overlay = document.createElement('div');
    overlay.className = 'pk-modal-overlay starter-overlay';
    overlay.innerHTML = `
      <section class="pk-modal starter-dialog" role="dialog" aria-modal="true" aria-labelledby="starterTitle" aria-describedby="starterHelp">
        <header class="starter-heading"><small>UMA NOVA AVENTURA</small><h2 id="starterTitle">Escolha seu primeiro kart</h2></header>
        <div class="starter-professor">
          <img src="https://play.pokemonshowdown.com/sprites/trainers/oak.png" alt="Professor Carvalho">
          <div><strong>Professor Carvalho</strong><p class="starter-speech" aria-label="${greeting}"></p><button class="starter-skip" type="button">Mostrar texto completo</button></div>
        </div>
        <div class="starter-table" role="radiogroup" aria-label="Karts iniciais">
          ${starters.map(kart => `<button type="button" class="starter-card" role="radio" aria-checked="false" data-kart="${kart.id}" style="--starter-color:${kart.color}">
            <div class="starter-stage" aria-hidden="true"><img class="starter-fallback" src="img/${kart.id}.png" alt=""></div>
            <strong>${kart.name}</strong><small>${kart.type}</small>
          </button>`).join('')}
        </div>
        <p class="starter-help" id="starterHelp">Selecione um kart e confirme. Você poderá escolher apenas um como parceiro inicial.</p>
        <button class="starter-confirm" type="button" disabled>Escolha seu parceiro</button>
        <p class="starter-status" role="status"></p>
        <button class="starter-signout" type="button">Sair da conta</button>
      </section>`;
    const inertElements = [...document.body.children].map(element => ({ element, inert: element.inert }));
    inertElements.forEach(({ element }) => { element.inert = true; });
    document.body.appendChild(overlay);
    const cards = [...overlay.querySelectorAll('.starter-card')];
    const confirm = overlay.querySelector('.starter-confirm');
    const speech = overlay.querySelector('.starter-speech');
    const skip = overlay.querySelector('.starter-skip');
    const status = overlay.querySelector('.starter-status');
    let selected = null;
    let saving = false;
    let closed = false;
    let letter = 0;
    const finishText = () => { speech.textContent = greeting; skip.hidden = true; clearInterval(typeTimer); };
    const typeTimer = setInterval(() => {
      speech.textContent = greeting.slice(0, ++letter);
      if (letter >= greeting.length) finishText();
    }, 26);
    skip.onclick = finishText;
    if (reducedMotion) finishText();

    const previews = [];
    let animationId = 0;
    let lastFrame = performance.now();
    let lastRender = 0;
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      previews.forEach(preview => resizePreview(preview));
    }) : null;

    function choose(kartId) {
      if (saving) return;
      selected = starters.find(kart => kart.id === kartId);
      cards.forEach(card => card.setAttribute('aria-checked', String(card.dataset.kart === kartId)));
      confirm.disabled = false;
      confirm.textContent = `Começar com ${selected.name}`;
      status.textContent = '';
    }
    cards.forEach((card, index) => {
      card.onclick = () => choose(card.dataset.kart);
      card.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
        cards[next].focus(); choose(cards[next].dataset.kart);
      });
      createPreview(card).then(preview => {
        if (!preview) return;
        if (closed) { preview.renderer.dispose(); return; }
        previews.push(preview); observer?.observe(preview.stage);
        resizePreview(preview);
      });
    });
    overlay.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const focusable = [...overlay.querySelectorAll('button:not(:disabled)')].filter(button => !button.hidden);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    cards[0].focus();

    function animate(now) {
      if (closed) return;
      animationId = requestAnimationFrame(animate);
      if (document.hidden || now - lastRender < 32) return;
      const delta = Math.min((now - lastFrame) / 1000, .1);
      lastFrame = lastRender = now;
      previews.forEach(preview => {
        const active = preview.card.matches(':hover') || document.activeElement === preview.card || selected?.id === preview.card.dataset.kart;
        if (!reducedMotion && preview.pivot) {
          if (active) preview.pivot.rotation.y += delta * .85;
          preview.pivot.position.y += ((active ? .06 : 0) - preview.pivot.position.y) * .15;
        }
        preview.renderer.render(preview.scene, preview.camera);
      });
    }
    animationId = requestAnimationFrame(animate);

    function cleanup() {
      closed = true;
      clearInterval(typeTimer); cancelAnimationFrame(animationId); observer?.disconnect();
      previews.forEach(preview => preview.renderer.dispose());
      overlay.remove();
      document.body.style.overflow = previousOverflow;
      inertElements.forEach(({ element, inert }) => { element.inert = inert; });
      if (previousFocus?.isConnected) previousFocus.focus();
      pendingChoice = null;
    }
    overlay.querySelector('.starter-signout').onclick = async () => {
      if (saving) return;
      await supabaseClient.auth.signOut();
      cleanup(); window.location.reload();
    };
    confirm.onclick = async () => {
      if (!selected || saving) return;
      saving = true; confirm.disabled = true; confirm.textContent = 'Preparando sua aventura…';
      try {
        const { data, error } = await supabaseClient.rpc('choose_starter_kart', { p_kart_id: selected.id });
        if (error) throw error;
        if (!data?.starter_choice_completed) throw new Error('Não foi possível confirmar a escolha. Tente novamente.');
        currentUserProfile = data;
        sessionStorage.setItem('pkart_selected_kart', data.selected_kart);
        if (typeof sortKartsByAvailability === 'function') sortKartsByAvailability();
        if (typeof previewRenderer !== 'undefined' && previewRenderer && typeof updatePreview === 'function') updatePreview();
        cleanup(); resolve(data);
      } catch (error) {
        status.textContent = error.code === 'PGRST202'
          ? 'A escolha inicial ainda precisa ser ativada no servidor. Tente novamente mais tarde.'
          : error.message || 'Não foi possível salvar sua escolha. Tente novamente.';
        saving = false; confirm.disabled = false; confirm.textContent = `Começar com ${selected.name}`;
      }
    };
  }

  function resizePreview(preview) {
    const width = Math.max(1, preview.stage.clientWidth), height = Math.max(1, preview.stage.clientHeight);
    preview.renderer.setSize(width, height);
    preview.camera.aspect = width / height; preview.camera.updateProjectionMatrix();
  }

  async function createPreview(card) {
    if (!window.THREE || !THREE.GLTFLoader) return null;
    const stage = card.querySelector('.starter-stage');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputEncoding = THREE.sRGBEncoding;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
      camera.position.set(0, 1.0, 3.6); camera.lookAt(0, .55, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 1.25));
      const light = new THREE.DirectionalLight(0xffffff, 1.7); light.position.set(3, 5, 4); scene.add(light);
      const loader = new THREE.GLTFLoader();
      if (THREE.DRACOLoader) {
        const draco = new THREE.DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/'); loader.setDRACOLoader(draco);
      }
      const kartId = card.dataset.kart;
      const source = window.KART_ASSETS?.[kartId] || await new Promise((resolve, reject) => {
        loader.load(`models/${kartId}.glb`, gltf => resolve(gltf.scene), undefined, reject);
      });
      window.KART_ASSETS = window.KART_ASSETS || {}; window.KART_ASSETS[kartId] = source;
      const model = source.clone(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const scale = 1.65 / Math.max(size.x, size.y, size.z, .001);
      model.scale.multiplyScalar(scale);
      model.position.add(new THREE.Vector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale));
      const pivot = new THREE.Group(); pivot.add(model); pivot.rotation.y = -.4; scene.add(pivot);
      stage.appendChild(renderer.domElement); stage.querySelector('.starter-fallback').hidden = true;
      return { card, stage, renderer, scene, camera, pivot };
    } catch (_) {
      renderer?.dispose(); // A imagem local continua disponível se o 3D falhar.
      return null;
    }
  }
})();
