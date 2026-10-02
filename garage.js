// garage.js - Atualizado com Novos Karts e Sistema de Rotação Gratuita

let scene, camera, renderer, currentMesh, controls;
let selectedKartId = 'jolteon';
let garageRequestId = 0;

const POKEAPI_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

function getRegionByDex(dexId) {
  if (!dexId) return 'Desconhecida';
  if (dexId <= 151) return 'Kanto';
  if (dexId <= 251) return 'Johto';
  if (dexId <= 386) return 'Hoenn';
  if (dexId <= 493) return 'Sinnoh';
  if (dexId <= 649) return 'Unova';
  if (dexId <= 721) return 'Kalos';
  if (dexId <= 809) return 'Alola';
  if (dexId <= 905) return 'Galar';
  return 'Paldea';
}

function getKartUrl(filename) {
  return `./models/${filename}`;
}

// Catálogo Completo
let KART_CATALOG = [];

async function carregarKartsDaGaragem() {
  try {
    // Adicionado 'pokemon_dex_id' na query do Supabase
    const { data, error } = await supabaseClient.from('karts').select('id, name, price, concept_img, stats, pokemon_dex_id, activated');
    if (error) throw error;

    if (data && data.length > 0) {
      KART_CATALOG = data.map(dbKart => ({
        id: dbKart.id,
        name: dbKart.name,
        price: dbKart.price || 0,
        conceptImg: dbKart.concept_img || `img/${dbKart.id}.png`,
        modelUrl: getKartUrl(`${dbKart.id}.glb`),
        stats: dbKart.stats || { speed: 80, accel: 80, handling: 80 },
        dexId: dbKart.pokemon_dex_id || null,
        activated: dbKart.activated !== false
      }));
    }
  } catch (err) {
    console.error("Erro ao carregar catálogo da garagem:", err);
    KART_CATALOG = [{
      id: 'jolteon',
      name: 'Jolteon Kart',
      price: 0,
      conceptImg: 'img/jolteon.png',
      modelUrl: getKartUrl('jolteon.glb'),
      stats: { speed: 75, accel: 90, handling: 85 },
      dexId: 135,
      activated: true
    }];
  }
}

let dailyFreeKarts = [];

function updateDailyFreeKarts() {
  const now = new Date();
  const dateSeed = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();

  let s = dateSeed;
  function seededRandom() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }

  // CORREÇÃO: Filtra para remover o Jolteon e apenas karts ativos
  const availableKarts = KART_CATALOG
    .filter(k => k.id !== 'jolteon' && k.activated !== false)
    .map(k => k.id);
  availableKarts.sort();

  for (let i = availableKarts.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [availableKarts[i], availableKarts[j]] = [availableKarts[j], availableKarts[i]];
  }

  dailyFreeKarts = availableKarts.slice(0, 4);
  sessionStorage.setItem('pkart_daily_free', JSON.stringify(dailyFreeKarts));
}

document.addEventListener('DOMContentLoaded', async () => {
  init3DViewport();

  if (typeof fetchPlayerProfile === 'function') {
    await fetchPlayerProfile();
  }

  // 1. Espera os dados do Supabase
  await carregarKartsDaGaragem();

  // 2. Só agora define a rotação grátis (pois precisa do KART_CATALOG preenchido)
  updateDailyFreeKarts();

  updateHeaderData();

  if (currentUserProfile && currentUserProfile.selected_kart) {
    selectedKartId = currentUserProfile.selected_kart;
  }

  renderKartGrid();
  selectKart(selectedKartId);

  const btnBack = document.getElementById('btnBack');
  if (btnBack) btnBack.onclick = () => window.location.href = 'index.html';
});

function updateHeaderData() {
  const nickEl = document.getElementById('playerNickname');
  const coinsEl = document.getElementById('playerCoins');

  if (currentUserProfile) {
    if (nickEl) nickEl.innerText = currentUserProfile.nickname || 'Piloto';
    if (coinsEl) coinsEl.innerText = currentUserProfile.coins || 0;
  }
}

function init3DViewport() {
  const container = document.getElementById('kartViewport');
  if (!container) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 1.4, 4.2);
  camera.lookAt(0, 0.3, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  let isUserInteracting = false;
  let resumeAutoRotateTimeout = null;

  if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.autoRotate = false;

    controls.addEventListener('start', () => {
      isUserInteracting = true;
      if (resumeAutoRotateTimeout) clearTimeout(resumeAutoRotateTimeout);
    });

    controls.addEventListener('end', () => {
      resumeAutoRotateTimeout = setTimeout(() => { isUserInteracting = false; }, 2000);
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    if (currentMesh && !isUserInteracting) currentMesh.rotation.y += 0.01;
    if (controls) controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

async function loadKartModel(kartId) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = 'block';

  const requestId = ++garageRequestId;

  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  const attachMeshToScene = (gltfScene) => {
    if (requestId !== garageRequestId) return;
    currentMesh = gltfScene.clone(true);
    currentMesh.scale.setScalar(2.0);
    currentMesh.position.set(0, 0, 0);
    scene.add(currentMesh);
    if (spinner) spinner.style.display = 'none';
  };

  if (window.KART_ASSETS && window.KART_ASSETS[kartId]) {
    attachMeshToScene(window.KART_ASSETS[kartId]);
    return;
  }

  const modelUrl = `./models/${kartId}.glb`;
  const loader = new THREE.GLTFLoader();
  if (typeof THREE.DRACOLoader !== 'undefined') {
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);
  }

  const targetCacheName = typeof CACHE_NAME !== 'undefined' ? CACHE_NAME : 'pkart-3d-models-v2';

  try {
    let arrayBuffer = null;
    if ('caches' in window) {
      const cache = await caches.open(targetCacheName);
      const cachedResponse = await cache.match(modelUrl);
      if (cachedResponse) arrayBuffer = await cachedResponse.arrayBuffer();
    }

    if (arrayBuffer) {
      loader.parse(arrayBuffer, './models/', (gltf) => {
        if (!window.KART_ASSETS) window.KART_ASSETS = {};
        window.KART_ASSETS[kartId] = gltf.scene;
        attachMeshToScene(gltf.scene);
      });
      return;
    }
  } catch (err) {
    console.warn('[Garagem] Erro ao ler CacheStorage:', err);
  }

  try {
    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    if ('caches' in window) {
      try {
        const cache = await caches.open(targetCacheName);
        cache.put(modelUrl, response.clone());
      } catch (e) {
        console.warn('[Garagem] Falha ao salvar no cache:', e);
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    loader.parse(arrayBuffer, './models/', (gltf) => {
      if (!window.KART_ASSETS) window.KART_ASSETS = {};
      window.KART_ASSETS[kartId] = gltf.scene;
      attachMeshToScene(gltf.scene);
    });
  } catch (err) {
    console.warn(`[Garagem] Erro ao carregar ${modelUrl}:`, err);
    if (spinner) spinner.style.display = 'none';
  }
}

function renderKartGrid() {
  const gridEl = document.getElementById('kartList');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  // 1. Trava de segurança para ler os karts do banco de dados
  let userKarts = ['jolteon', 'charizard'];
  if (typeof currentUserProfile !== 'undefined' && currentUserProfile && currentUserProfile.unlocked_karts) {
    if (Array.isArray(currentUserProfile.unlocked_karts)) {
      userKarts = currentUserProfile.unlocked_karts;
    } else {
      try {
        userKarts = JSON.parse(currentUserProfile.unlocked_karts);
        if (!Array.isArray(userKarts)) userKarts = [currentUserProfile.unlocked_karts];
      } catch (e) {
        userKarts = [currentUserProfile.unlocked_karts];
      }
    }
  }

  // 2. Mistura os Karts do Jogador com a Rotação Diária
  let unlockedList = Array.from(new Set([...userKarts, ...dailyFreeKarts]));

  // 🛡️ 3. TRAVA DE EXPIRAÇÃO AUTOMÁTICA
  const currentEquipped = sessionStorage.getItem('pkart_selected_kart');
  if (currentEquipped && !unlockedList.includes(currentEquipped)) {
    sessionStorage.setItem('pkart_selected_kart', 'jolteon');
    selectedKartId = 'jolteon';
  }

  // 🔄 4. SISTEMA DE ORDENAÇÃO (FILTRO)
  let catalogToRender = [...KART_CATALOG]; // Cria uma cópia para não estragar a lista original

  // 🌍 4.1. FILTRO POR REGIÃO
  const regionSelect = document.getElementById('garageRegionSelect');
  const regionMode = regionSelect ? regionSelect.value : 'all';
  if (regionMode !== 'all') {
    catalogToRender = catalogToRender.filter(k => getRegionByDex(k.dexId) === regionMode);
  }

  const sortSelect = document.getElementById('garageSortSelect');
  const sortMode = sortSelect ? sortSelect.value : 'default';

  if (sortMode === 'price_asc') {
    catalogToRender.sort((a, b) => a.price - b.price);
  } else if (sortMode === 'price_desc') {
    catalogToRender.sort((a, b) => b.price - a.price);
  } else if (sortMode === 'owned') {
    catalogToRender.sort((a, b) => {
      const aIsActive = unlockedList.includes(a.id) ? 1 : 0;
      const bIsActive = unlockedList.includes(b.id) ? 1 : 0;

      // Se ambos tiverem o mesmo status (ambos bloqueados ou ambos ativos), desempata pelo preço
      if (bIsActive === aIsActive) {
        return a.price - b.price;
      }
      return bIsActive - aIsActive;
    });
  } else {
    // 🌟 ORDENAÇÃO PADRÃO POR POKÉDEX (dexId)
    catalogToRender.sort((a, b) => (a.dexId || 9999) - (b.dexId || 9999));
  }

  // Mostra mensagem se nenhum kart na região
  if (catalogToRender.length === 0) {
    gridEl.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #64748b; font-size: 13px; padding: 30px 0;">Nenhum kart encontrado nesta região.</div>';
    return;
  }

  // 5. Renderiza os cartões na ordem escolhida
  catalogToRender.forEach((kart) => {
    const isUnlocked = unlockedList.includes(kart.id);

    const thumbSrc = kart.dexId ? `${POKEAPI_SPRITE_BASE}${kart.dexId}.png` : 'img/jolteon.png';

    const isFreeRotation = dailyFreeKarts.includes(kart.id) && !userKarts.includes(kart.id);

    // Recupera a lista de karts já visualizados
    const seenKarts = JSON.parse(localStorage.getItem('pkart_seen_karts') || '[]');
    const isNew = !seenKarts.includes(kart.id);

    const card = document.createElement('div');
    card.className = `kart-card ${isUnlocked ? '' : 'locked'}`;
    card.dataset.kartId = kart.id;
    card.style.position = 'relative'; // Garante que a etiqueta flutue corretamente no canto

    let priceLabelHtml = '';
    if (isFreeRotation) {
      priceLabelHtml = `<div class="kart-card-price" style="color:#22c55e;">GRÁTIS HOJE</div>`;
    } else if (isUnlocked) {
      priceLabelHtml = `<div class="kart-card-price" style="color:#38bdf8;">OK</div>`;
    } else {
      priceLabelHtml = `<div class="kart-card-price">🪙 ${kart.price}</div>`;
    }

    // HTML da etiqueta de NOVO (animada com CSS inline básico)
    const newBadgeHtml = isNew ?
      `<div class="kart-card-new-badge" style="position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; font-size: 10px; font-weight: 900; padding: 4px 8px; border-radius: 12px; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.5); border: 2px solid #0f172a;">NOVO</div>`
      : '';

    card.innerHTML = `
      ${newBadgeHtml}
      <img src="${thumbSrc}" class="kart-thumb" alt="${kart.name}">
      <div class="kart-card-name">${kart.name.split(' ')[0]}</div>
      ${priceLabelHtml}
    `;

    card.onclick = () => selectKart(kart.id);
    gridEl.appendChild(card);
  });
}

function selectKart(kartId) {
  selectedKartId = kartId;
  // --- NOVO: MARCAR KART COMO VISTO ---
  let seenKarts = JSON.parse(localStorage.getItem('pkart_seen_karts') || '[]');
  if (!seenKarts.includes(kartId)) {
    seenKarts.push(kartId);
    localStorage.setItem('pkart_seen_karts', JSON.stringify(seenKarts));

    // Remove a etiqueta de "NOVO" em tempo real da interface
    const selectedCard = document.querySelector(`.kart-card[data-kart-id="${kartId}"]`);
    if (selectedCard) {
      const badge = selectedCard.querySelector('.kart-card-new-badge');
      if (badge) badge.remove();
    }
  }

  const cards = document.querySelectorAll('.kart-card');
  cards.forEach(card => {
    if (card.dataset.kartId === kartId) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  const kartData = KART_CATALOG.find(k => k.id === kartId);
  if (kartData) {
    const nameEl = document.getElementById('kartName');

    // 🛡️ TRAVA DE SEGURANÇA PARA LER O BANCO
    let userKarts = ['jolteon', 'charizard'];
    if (typeof currentUserProfile !== 'undefined' && currentUserProfile && currentUserProfile.unlocked_karts) {
      if (Array.isArray(currentUserProfile.unlocked_karts)) {
        userKarts = currentUserProfile.unlocked_karts;
      } else {
        try {
          userKarts = JSON.parse(currentUserProfile.unlocked_karts);
          if (!Array.isArray(userKarts)) userKarts = [currentUserProfile.unlocked_karts];
        } catch (e) {
          userKarts = [currentUserProfile.unlocked_karts];
        }
      }
    }

    const isFreeRotation = dailyFreeKarts.includes(kartData.id) && !userKarts.includes(kartData.id);

    if (nameEl) {
      nameEl.innerHTML = isFreeRotation ? `${kartData.name} <span style="color:#22c55e; font-size:12px;">(GRÁTIS)</span>` : kartData.name;
    }

    if (kartData.stats) {
      const speedBar = document.getElementById('barSpeed');
      const accelBar = document.getElementById('barAccel');
      const handlingBar = document.getElementById('barHandling');

      if (speedBar) speedBar.style.width = `${kartData.stats.speed}%`;
      if (accelBar) accelBar.style.width = `${kartData.stats.accel}%`;
      if (handlingBar) handlingBar.style.width = `${kartData.stats.handling}%`;

      // --- NOVO: LÓGICA DE BARRAS PREENCHIDAS PARA COMPARAÇÃO ---
      const currentlyEquippedId = (typeof currentUserProfile !== 'undefined' && currentUserProfile && currentUserProfile.selected_kart)
        ? currentUserProfile.selected_kart
        : sessionStorage.getItem('pkart_selected_kart') || 'jolteon';

      const equippedData = KART_CATALOG.find(k => k.id === currentlyEquippedId);
      const isComparing = (kartId !== currentlyEquippedId);

      if (equippedData && equippedData.stats) {
        const eqSpeed = document.getElementById('barEquippedSpeed');
        const eqAccel = document.getElementById('barEquippedAccel');
        const eqHandling = document.getElementById('barEquippedHandling');

        if (eqSpeed) {
          eqSpeed.style.width = `${equippedData.stats.speed}%`;
          eqSpeed.style.display = isComparing ? 'block' : 'none'; // Esconde se for o próprio kart equipado
        }
        if (eqAccel) {
          eqAccel.style.width = `${equippedData.stats.accel}%`;
          eqAccel.style.display = isComparing ? 'block' : 'none';
        }
        if (eqHandling) {
          eqHandling.style.width = `${equippedData.stats.handling}%`;
          eqHandling.style.display = isComparing ? 'block' : 'none';
        }
      }
    }

    const conceptImg = document.getElementById('kartConceptImg');
    if (conceptImg) conceptImg.src = kartData.conceptImg;

    // Chama o botão atualizado
    if (typeof updateActionButton === 'function') {
      updateActionButton(kartData, isFreeRotation);
    }
  }

  // Carrega o modelo 3D
  if (typeof loadKartModel === 'function') {
    loadKartModel(kartId);
  }
}

async function equipKart(kartId) {
  let userKarts = ['jolteon', 'charizard'];
  if (typeof currentUserProfile !== 'undefined' && currentUserProfile && currentUserProfile.unlocked_karts) {
    if (Array.isArray(currentUserProfile.unlocked_karts)) {
      userKarts = currentUserProfile.unlocked_karts;
    } else {
      try {
        userKarts = JSON.parse(currentUserProfile.unlocked_karts);
        if (!Array.isArray(userKarts)) userKarts = [currentUserProfile.unlocked_karts];
      } catch (e) {
        userKarts = [currentUserProfile.unlocked_karts];
      }
    }
  }

  const isFreeRotation = dailyFreeKarts.includes(kartId) && !userKarts.includes(kartId);
  const isPermanentlyUnlocked = userKarts.includes(kartId);

  if (!isPermanentlyUnlocked && !isFreeRotation) {
    alert('Este kart está bloqueado!');
    return;
  }

  // 1. Salva na sessão imediatamente para uso rápido
  sessionStorage.setItem('pkart_selected_kart', kartId);
  if (typeof currentUserProfile !== 'undefined' && currentUserProfile) {
    currentUserProfile.selected_kart = kartId;

    // CORREÇÃO: "Tranca" o kart temporariamente no inventário local.
    // Isso impede que o Lobby ative a segurança e resete pro Jolteon!
    if (isFreeRotation && !userKarts.includes(kartId)) {
      if (Array.isArray(currentUserProfile.unlocked_karts)) {
        currentUserProfile.unlocked_karts.push(kartId);
      } else {
        currentUserProfile.unlocked_karts = JSON.stringify([...userKarts, kartId]);
      }
    }
  }
  // 🛡️ 2. CORREÇÃO: Salva no Supabase SEMPRE. 
  // Isso impede que o auth.js do Lobby puxe um dado velho e resete seu kart.
  if (typeof currentUserProfile !== 'undefined' && currentUserProfile && typeof supabaseClient !== 'undefined') {
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        selected_kart: kartId,
        updated_at: new Date()
      })
      .eq('id', currentUserProfile.id);

    if (error) {
      console.warn('Erro ao salvar kart selecionado no banco:', error.message);
    }
  }

  selectKart(kartId);
  renderKartGrid();
}

function updateActionButton(kartData, isFreeRotation) {
  const btnAction = document.getElementById('btnAction');
  if (!btnAction) return;

  // 🛡️️ TRAVA DE SEGURANÇA
  let userKarts = ['jolteon', 'charizard'];
  if (currentUserProfile && currentUserProfile.unlocked_karts) {
    if (Array.isArray(currentUserProfile.unlocked_karts)) {
      userKarts = currentUserProfile.unlocked_karts;
    } else {
      try {
        userKarts = JSON.parse(currentUserProfile.unlocked_karts);
        if (!Array.isArray(userKarts)) userKarts = [currentUserProfile.unlocked_karts];
      } catch (e) {
        userKarts = [currentUserProfile.unlocked_karts];
      }
    }
  }

  const isUnlocked = userKarts.includes(kartData.id) || isFreeRotation;
  const equippedKartId = currentUserProfile ? currentUserProfile.selected_kart : sessionStorage.getItem('pkart_selected_kart');
  const isEquipped = equippedKartId === kartData.id;

  if (isEquipped) {
    btnAction.innerText = 'EQUIPADO';
    btnAction.style.background = '#64748b';
    btnAction.style.color = '#fff';
    btnAction.style.cursor = 'default';
    btnAction.disabled = true;
    btnAction.onclick = null;
  } else if (isUnlocked) {
    btnAction.innerText = isFreeRotation ? 'EQUIPAR (TEMPORÁRIO)' : 'EQUIPAR KART';
    btnAction.style.background = '#22c55e';
    btnAction.style.color = '#0f172a';
    btnAction.style.cursor = 'pointer';
    btnAction.disabled = false;
    btnAction.onclick = () => equipKart(kartData.id);
  } else {
    // AQUI ESTÁ A LÓGICA DE BLOQUEIO DA COMPRA
    if (kartData.activated === false) {
      btnAction.innerText = 'INDISPONÍVEL';
      btnAction.style.background = '#475569'; // Cinza escuro para indicar bloqueio
      btnAction.style.color = '#94a3b8';
      btnAction.style.cursor = 'not-allowed';
      btnAction.disabled = true;
      btnAction.onclick = null;
    } else {
      btnAction.innerText = `COMPRAR (🪙 ${kartData.price})`;
      btnAction.style.background = '#facc15';
      btnAction.style.color = '#0f172a';
      btnAction.style.cursor = 'pointer';
      btnAction.disabled = false;
      btnAction.onclick = () => buyKart(kartData.id, kartData.price);
    }
  }
}

async function buyKart(kartId, price) {
  if (!currentUserProfile) {
    alert('Você precisa estar logado para comprar karts!');
    return;
  }

  if (currentUserProfile.coins < price) {
    alert('Moedas insuficientes para comprar este Kart!');
    return;
  }

  const newCoins = currentUserProfile.coins - price;
  const updatedUnlocked = Array.from(new Set([...currentUserProfile.unlocked_karts, kartId]));

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      coins: newCoins,
      unlocked_karts: updatedUnlocked,
      updated_at: new Date()
    })
    .eq('id', currentUserProfile.id);

  if (error) {
    alert('Erro ao processar compra: ' + error.message);
    return;
  }

  currentUserProfile.coins = newCoins;
  currentUserProfile.unlocked_karts = updatedUnlocked;

  updateHeaderData();
  renderKartGrid();
  selectKart(kartId);
}