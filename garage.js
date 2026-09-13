// garage.js - Atualizado com Novos Karts e Sistema de Rotação Gratuita

let scene, camera, renderer, currentMesh, controls;
let selectedKartId = 'jolteon';
let garageRequestId = 0;

// Recupera a lista de karts gratuitos do dia salvos no localStorage pelo index.html
const dailyFreeKarts = JSON.parse(localStorage.getItem('pkart_free_karts') || '[]');

const POKEAPI_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

const KART_POKEMON_IDS = {
  'jolteon': 135, 'charizard': 6, 'zoroark': 571, 'togetic': 176, 'flygon': 330,
  'gengar': 94, 'oshawott': 501, 'snorlax': 143, 'golem': 76, 'jinx': 124,
  'sudowoodo': 185, 'sylveon': 700, 'umbreon': 197, 'pikachu': 25, 'gliscor': 472,
  'mewtwo': 150, 'zekrom': 644, 'swampert': 260, 'rayquaza': 384, 'espeon': 196,
  'tatsugiri': 978, 'scyther': 123,
  'ninetales': 38, 'arcanine': 59, 'lucario': 448, 'dialga': 483, 'zapdos': 145,
  'luxray': 405, 'staraptor': 398, 'dragonite': 149, 'tangela': 114, 'sneasel': 215,
  // Novos 3D Adicionados
  'darkrai': 491, 'moltres': 146, 'weezing': 110, 'swellow': 277, 'articuno': 144
};

// Catálogo Completo (32 Karts)
const KART_CATALOG = [
  { id: 'jolteon', name: 'Jolteon Kart', price: 0, conceptImg: 'img/jolteon.png', stats: { speed: 75, accel: 90, handling: 85 } },
  { id: 'charizard', name: 'Charizard Kart', price: 0, conceptImg: 'img/charizard.png', stats: { speed: 85, accel: 70, handling: 60 } },
  { id: 'zoroark', name: 'Zoroark Kart', price: 800, conceptImg: 'img/zoroark.png', stats: { speed: 80, accel: 75, handling: 80 } },
  { id: 'togetic', name: 'Togetic Kart', price: 1000, conceptImg: 'img/togetic.png', stats: { speed: 70, accel: 80, handling: 95 } },
  { id: 'flygon', name: 'Flygon Kart', price: 1500, conceptImg: 'img/flygon.png', stats: { speed: 90, accel: 70, handling: 75 } },
  { id: 'gengar', name: 'Gengar Kart', price: 2000, conceptImg: 'img/gengar.png', stats: { speed: 78, accel: 85, handling: 65 } },
  { id: 'oshawott', name: 'Oshawott Kart', price: 2200, conceptImg: 'img/oshawott.png', stats: { speed: 78, accel: 88, handling: 75 } },
  { id: 'snorlax', name: 'Snorlax Kart', price: 3500, conceptImg: 'img/snorlax.png', stats: { speed: 98, accel: 55, handling: 85 } },
  { id: 'sudowoodo', name: 'Sudowoodo Kart', price: 1200, conceptImg: 'img/sudowoodo.png', stats: { speed: 65, accel: 75, handling: 90 } },
  { id: 'golem', name: 'Golem Kart', price: 1800, conceptImg: 'img/golem.png', stats: { speed: 92, accel: 60, handling: 70 } },
  { id: 'jinx', name: 'Jynx Kart', price: 2400, conceptImg: 'img/jinx.png', stats: { speed: 82, accel: 82, handling: 80 } },
  { id: 'umbreon', name: 'Umbreon Kart', price: 3000, conceptImg: 'img/umbreon.png', stats: { speed: 88, accel: 85, handling: 85 } },
  { id: 'sylveon', name: 'Sylveon Kart', price: 3200, conceptImg: 'img/sylveon.png', stats: { speed: 84, accel: 92, handling: 90 } },
  { id: 'pikachu', name: 'Pikachu Kart', price: 500, conceptImg: 'img/pikachu.png', stats: { speed: 80, accel: 85, handling: 80 } },
  { id: 'gliscor', name: 'Gliscor Kart', price: 2600, conceptImg: 'img/gliscor.png', stats: { speed: 82, accel: 80, handling: 85 } },
  { id: 'mewtwo', name: 'Mewtwo Kart', price: 4500, conceptImg: 'img/mewtwo.png', stats: { speed: 95, accel: 88, handling: 82 } },
  { id: 'zekrom', name: 'Zekrom Kart', price: 4200, conceptImg: 'img/zekrom.png', stats: { speed: 94, accel: 85, handling: 75 } },
  { id: 'swampert', name: 'Swampert Kart', price: 2800, conceptImg: 'img/swampert.jpeg', stats: { speed: 86, accel: 84, handling: 80 } },
  { id: 'rayquaza', name: 'Rayquaza Kart', price: 5000, conceptImg: 'img/rayquaza.jpeg', stats: { speed: 98, accel: 90, handling: 78 } },
  { id: 'espeon', name: 'Espeon Kart', price: 3100, conceptImg: 'img/espeon.png', stats: { speed: 86, accel: 88, handling: 88 } },
  { id: 'tatsugiri', name: 'Tatsugiri Kart', price: 2100, conceptImg: 'img/tatsugiri.png', stats: { speed: 76, accel: 92, handling: 92 } },
  { id: 'scyther', name: 'Scyther Kart', price: 2500, conceptImg: 'img/scyther.png', stats: { speed: 88, accel: 82, handling: 84 } },
  { id: 'ninetales', name: 'Ninetales Kart', price: 1600, conceptImg: 'img/ninetales.png', stats: { speed: 84, accel: 82, handling: 85 } },
  { id: 'arcanine', name: 'Arcanine Kart', price: 2100, conceptImg: 'img/arcanine.png', stats: { speed: 88, accel: 85, handling: 80 } },
  { id: 'lucario', name: 'Lucario Kart', price: 2700, conceptImg: 'img/lucario.png', stats: { speed: 86, accel: 84, handling: 86 } },
  { id: 'dialga', name: 'Dialga Kart', price: 4600, conceptImg: 'img/dialga.png', stats: { speed: 96, accel: 70, handling: 75 } },
  { id: 'zapdos', name: 'Zapdos Kart', price: 4100, conceptImg: 'img/zapdos.png', stats: { speed: 92, accel: 88, handling: 80 } },
  { id: 'luxray', name: 'Luxray Kart', price: 2300, conceptImg: 'img/luxray.png', stats: { speed: 82, accel: 85, handling: 82 } },
  { id: 'staraptor', name: 'Staraptor Kart', price: 1800, conceptImg: 'img/staraptor.png', stats: { speed: 85, accel: 88, handling: 84 } },
  { id: 'dragonite', name: 'Dragonite Kart', price: 3800, conceptImg: 'img/dragonite.png', stats: { speed: 94, accel: 75, handling: 82 } },
  { id: 'tangela', name: 'Tangela Kart', price: 900, conceptImg: 'img/tangela.png', stats: { speed: 70, accel: 80, handling: 95 } },
  { id: 'sneasel', name: 'Sneasel Kart', price: 1400, conceptImg: 'img/sneasel.png', stats: { speed: 80, accel: 90, handling: 88 } },
  { id: 'darkrai', name: 'Darkrai Kart', price: 4800, conceptImg: 'img/darkrai.png', stats: { speed: 95, accel: 88, handling: 82 } },
  { id: 'moltres', name: 'Moltres Kart', price: 4200, conceptImg: 'img/moltres.png', stats: { speed: 92, accel: 85, handling: 80 } },
  { id: 'weezing', name: 'Weezing Kart', price: 1500, conceptImg: 'img/weezing.png', stats: { speed: 75, accel: 80, handling: 85 } },
  { id: 'swellow', name: 'Swellow Kart', price: 2000, conceptImg: 'img/swellow.png', stats: { speed: 82, accel: 90, handling: 88 } },
  { id: 'articuno', name: 'Articuno Kart', price: 4200, conceptImg: 'img/articuno.png', stats: { speed: 92, accel: 85, handling: 83 } }
];

document.addEventListener('DOMContentLoaded', async () => {
  init3DViewport();

  if (typeof fetchPlayerProfile === 'function') {
    await fetchPlayerProfile();
  }

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

  let unlockedList = (currentUserProfile && Array.isArray(currentUserProfile.unlocked_karts))
    ? currentUserProfile.unlocked_karts
    : ['jolteon', 'charizard'];

  // Mistura os Karts do Jogador com a Rotação Diária
  unlockedList = Array.from(new Set([...unlockedList, ...dailyFreeKarts]));

  KART_CATALOG.forEach((kart) => {
    const isUnlocked = unlockedList.includes(kart.id);
    const pokemonId = KART_POKEMON_IDS[kart.id];
    const thumbSrc = pokemonId ? `${POKEAPI_SPRITE_BASE}${pokemonId}.png` : 'img/jolteon.png';

    // Verifica se o kart está liberado APENAS pela rotação gratuita (e não porque o jogador comprou)
    const isFreeRotation = dailyFreeKarts.includes(kart.id) && !(currentUserProfile && currentUserProfile.unlocked_karts && currentUserProfile.unlocked_karts.includes(kart.id));

    const card = document.createElement('div');
    card.className = `kart-card ${isUnlocked ? '' : 'locked'}`;
    card.dataset.kartId = kart.id;

    // Injeta a label verde de GRÁTIS HOJE se for da rotação, senão exibe o preço ou OK
    let priceLabelHtml = '';
    if (isFreeRotation) {
      priceLabelHtml = `<div class="kart-card-price" style="color:#22c55e;">GRÁTIS HOJE</div>`;
    } else if (isUnlocked) {
      priceLabelHtml = `<div class="kart-card-price" style="color:#38bdf8;">OK</div>`;
    } else {
      priceLabelHtml = `<div class="kart-card-price">🪙 ${kart.price}</div>`;
    }

    card.innerHTML = `
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

    // Lógica para adicionar o texto GRÁTIS HOJE no título do Painel Lateral
    const isFreeRotation = dailyFreeKarts.includes(kartData.id) && !(currentUserProfile && currentUserProfile.unlocked_karts && currentUserProfile.unlocked_karts.includes(kartData.id));
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
    }

    const conceptImg = document.getElementById('kartConceptImg');
    if (conceptImg) conceptImg.src = kartData.conceptImg;

    updateActionButton(kartData, isFreeRotation);
  }

  loadKartModel(kartId);
}

function updateActionButton(kartData, isFreeRotation) {
  const btnAction = document.getElementById('btnAction');
  if (!btnAction) return;

  const unlockedList = (currentUserProfile && Array.isArray(currentUserProfile.unlocked_karts))
    ? currentUserProfile.unlocked_karts
    : ['jolteon', 'charizard'];

  // Considera como "Destravado" se ele estiver na lista de compras OU na rotação gratuita
  const isUnlocked = unlockedList.includes(kartData.id) || isFreeRotation;

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
    btnAction.innerText = `COMPRAR (🪙 ${kartData.price})`;
    btnAction.style.background = '#facc15';
    btnAction.style.color = '#0f172a';
    btnAction.style.cursor = 'pointer';
    btnAction.disabled = false;
    btnAction.onclick = () => buyKart(kartData.id, kartData.price);
  }
}

async function equipKart(kartId) {
  if (typeof updateSelectedKart === 'function') {
    await updateSelectedKart(kartId);
  }
  sessionStorage.setItem('pkart_selected_kart', kartId);
  selectKart(kartId);
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