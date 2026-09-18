// garage.js - Atualizado com Novos Karts e Sistema de Rotação Gratuita

let scene, camera, renderer, currentMesh, controls;
let selectedKartId = 'jolteon';
let garageRequestId = 0;

const POKEAPI_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

const KART_POKEMON_IDS = {
  'jolteon': 135, 'charizard': 6, 'zoroark': 571, 'togetic': 176, 'flygon': 330,
  'gengar': 94, 'oshawott': 501, 'snorlax': 143, 'golem': 76, 'jinx': 124,
  'sudowoodo': 185, 'sylveon': 700, 'umbreon': 197, 'pikachu': 25, 'gliscor': 472,
  'mewtwo': 150, 'zekrom': 644, 'swampert': 260, 'rayquaza': 384, 'espeon': 196,
  'tatsugiri': 978, 'scyther': 123,
  'ninetales': 38, 'arcanine': 59, 'lucario': 448, 'dialga': 483, 'zapdos': 145,
  'luxray': 405, 'staraptor': 398, 'dragonite': 149, 'tangela': 114, 'sneasel': 215,
  'darkrai': 491, 'moltres': 146, 'weezing': 110, 'swellow': 277, 'articuno': 144,
  'alakazam': 65, 'onix': 95, 'starmie': 121, 'victreebel': 71, 'rhydon': 112, 'persian': 53,
  'blastoise': 9, 'venusaur': 3, 'ceruledge': 937, 'infernape': 392,
  'empoleon': 395, 'torterra': 389, 'hooh': 250, 'hydreigon': 635, 'lunala': 792,
  'kyogre': 382, 'groudon': 383, 'suicune': 245, 'entei': 244, 'raikou': 243,
  'giratina': 487, 'arceus': 493, 'mew': 151, 'celebi': 251, 'lugia': 249
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
  { id: 'articuno', name: 'Articuno Kart', price: 4200, conceptImg: 'img/articuno.png', stats: { speed: 92, accel: 85, handling: 83 } },
  { id: 'alakazam', name: 'Alakazam Kart', price: 3400, conceptImg: 'img/alakazam.png', stats: { speed: 90, accel: 85, handling: 88 } },
  { id: 'onix', name: 'Onix Kart', price: 2900, conceptImg: 'img/onix.png', stats: { speed: 85, accel: 65, handling: 70 } },
  { id: 'starmie', name: 'Starmie Kart', price: 2700, conceptImg: 'img/starmie.png', stats: { speed: 86, accel: 88, handling: 89 } },
  { id: 'victreebel', name: 'Victreebel Kart', price: 1900, conceptImg: 'img/victreebel.png', stats: { speed: 78, accel: 79, handling: 80 } },
  { id: 'rhydon', name: 'Rhydon Kart', price: 2600, conceptImg: 'img/rhydon.png', stats: { speed: 88, accel: 72, handling: 74 } },
  { id: 'persian', name: 'Persian Kart', price: 1600, conceptImg: 'img/persian.png', stats: { speed: 84, accel: 90, handling: 87 } },
  { id: 'blastoise', name: 'Blastoise Kart', price: 3200, conceptImg: 'img/blastoise.png', stats: { speed: 88, accel: 80, handling: 82 } },
  { id: 'venusaur', name: 'Venusaur Kart', price: 3200, conceptImg: 'img/venusaur.png', stats: { speed: 86, accel: 82, handling: 84 } },
  { id: 'ceruledge', name: 'Ceruledge Kart', price: 4600, conceptImg: 'img/ceruledge.png', stats: { speed: 94, accel: 88, handling: 85 } },
  { id: 'infernape', name: 'Infernape Kart', price: 3800, conceptImg: 'img/infernape.png', stats: { speed: 91, accel: 90, handling: 86 } },
  { id: 'empoleon', name: 'Empoleon Kart', price: 3500, conceptImg: 'img/empoleon.png', stats: { speed: 89, accel: 83, handling: 83 } },
  { id: 'torterra', name: 'Torterra Kart', price: 3500, conceptImg: 'img/torterra.png', stats: { speed: 87, accel: 78, handling: 80 } },
  { id: 'hooh', name: 'Ho-Oh Kart', price: 6000, conceptImg: 'img/hooh.png', stats: { speed: 99, accel: 92, handling: 80 } },
  { id: 'hydreigon', name: 'Hydreigon Kart', price: 5200, conceptImg: 'img/hydreigon.png', stats: { speed: 96, accel: 89, handling: 84 } },
  { id: 'lunala', name: 'Lunala Kart', price: 6000, conceptImg: 'img/lunala.png', stats: { speed: 98, accel: 90, handling: 86 } },
  { id: 'kyogre', name: 'Kyogre Kart', price: 7000, conceptImg: 'img/kyogre.png', stats: { speed: 95, accel: 85, handling: 82 } },
  { id: 'groudon', name: 'Groudon Kart', price: 7000, conceptImg: 'img/groudon.png', stats: { speed: 96, accel: 80, handling: 80 } },
  { id: 'suicune', name: 'Suicune Kart', price: 6500, conceptImg: 'img/suicune.png', stats: { speed: 90, accel: 88, handling: 86 } },
  { id: 'entei', name: 'Entei Kart', price: 6500, conceptImg: 'img/entei.png', stats: { speed: 92, accel: 90, handling: 83 } },
  { id: 'raikou', name: 'Raikou Kart', price: 6500, conceptImg: 'img/raikou.png', stats: { speed: 94, accel: 92, handling: 85 } },
  { id: 'giratina', name: 'Giratina Kart', price: 8500, conceptImg: 'img/giratina.png', stats: { speed: 97, accel: 82, handling: 81 } },
  { id: 'arceus', name: 'Arceus Kart', price: 10000, conceptImg: 'img/arceus.png', stats: { speed: 99, accel: 94, handling: 90 } },
  { id: 'mew', name: 'Mew Kart', price: 8000, conceptImg: 'img/mew.png', stats: { speed: 90, accel: 95, handling: 92 } },
  { id: 'celebi', name: 'Celebi Kart', price: 7500, conceptImg: 'img/celebi.png', stats: { speed: 88, accel: 93, handling: 90 } },
  { id: 'lugia', name: 'Lugia Kart', price: 8500, conceptImg: 'img/lugia.png', stats: { speed: 98, accel: 88, handling: 85 } },
];

let dailyFreeKarts = [];

function updateDailyFreeKarts() {
  const now = new Date();
  const dateSeed = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();

  let s = dateSeed;
  function seededRandom() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }

  const availableKarts = KART_CATALOG.map(k => k.id).filter(id => id !== 'jolteon');
  availableKarts.sort();

  for (let i = availableKarts.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [availableKarts[i], availableKarts[j]] = [availableKarts[j], availableKarts[i]];
  }

  dailyFreeKarts = availableKarts.slice(0, 4);
}
// Calcula os karts imediatamente ao carregar o arquivo
updateDailyFreeKarts();

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
  }

  // 5. Renderiza os cartões na ordem escolhida
  catalogToRender.forEach((kart) => {
    const isUnlocked = unlockedList.includes(kart.id);
    const pokemonId = KART_POKEMON_IDS[kart.id];
    const thumbSrc = pokemonId ? `${POKEAPI_SPRITE_BASE}${pokemonId}.png` : 'img/jolteon.png';

    const isFreeRotation = dailyFreeKarts.includes(kart.id) && !userKarts.includes(kart.id);

    const card = document.createElement('div');
    card.className = `kart-card ${isUnlocked ? '' : 'locked'}`;
    card.dataset.kartId = kart.id;

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

  // 🛡️ TRAVA DE SEGURANÇA
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
    btnAction.innerText = `COMPRAR (🪙 ${kartData.price})`;
    btnAction.style.background = '#facc15';
    btnAction.style.color = '#0f172a';
    btnAction.style.cursor = 'pointer';
    btnAction.disabled = false;
    btnAction.onclick = () => buyKart(kartData.id, kartData.price);
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