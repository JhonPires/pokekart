// garage.js - Versão Otimizada com Cache Imediato e Lógica do Supabase

let scene, camera, renderer, currentMesh, controls;
let selectedKartId = 'jolteon';
let garageRequestId = 0;

// Base de Sprites da PokeAPI (Renderização Imediata sem Fetch)
const POKEAPI_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

const KART_POKEMON_IDS = {
  'jolteon': 135,
  'charizard': 6,
  'zoroark': 571,
  'togetic': 176,
  'flygon': 330,
  'gengar': 94,
  'oshawott': 501,
  'snorlax': 143,
  'golem': 76,
  'jinx': 124,
  'sudowoodo': 185,
  'sylveon': 700,
  'umbreon': 197,
  'pikachu': 25,
  'gliscor': 472,
  'mewtwo': 150,
  'zekrom': 644,
  'swampert': 260,
  'rayquaza': 384,
  'espeon': 196,
  'tatsugiri': 978,
  'scyther': 123
};

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
  { id: 'scyther', name: 'Scyther Kart', price: 2500, conceptImg: 'img/scyther.png', stats: { speed: 88, accel: 82, handling: 84 } }
];

// Inicialização da Garagem
document.addEventListener('DOMContentLoaded', async () => {
  init3DViewport();

  // Tenta carregar perfil do Supabase
  if (typeof fetchPlayerProfile === 'function') {
    await fetchPlayerProfile();
  }

  // Preenche dados da Topbar
  updateHeaderData();

  // Se o jogador tiver um kart equipado, seleciona ele por padrão
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

// Configuração da Cena 3D com Rotação Automática Inteligente
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

  // Estado de interação do usuário
  let isUserInteracting = false;
  let resumeAutoRotateTimeout = null;

  if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.autoRotate = false;

    // Quando começa a arrastar/girar, pausa a rotação automática
    controls.addEventListener('start', () => {
      isUserInteracting = true;
      if (resumeAutoRotateTimeout) {
        clearTimeout(resumeAutoRotateTimeout);
      }
    });

    // Quando solta o mouse/touch, espera 2 segundos e retoma a rotação
    controls.addEventListener('end', () => {
      resumeAutoRotateTimeout = setTimeout(() => {
        isUserInteracting = false;
      }, 2000); // 2000ms = 2 segundos
    });
  }

  function animate() {
    requestAnimationFrame(animate);

    // Gira automaticamente apenas se o usuário não estiver interagindo
    if (currentMesh && !isUserInteracting) {
      currentMesh.rotation.y += 0.01;
    }

    if (controls) controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

async function loadKartModel(kartId) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = 'block';

  const requestId = ++garageRequestId;

  // 1. Limpa o modelo 3D atual da cena
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

  // 2. RAM CACHE (window.KART_ASSETS) - 0ms
  if (window.KART_ASSETS && window.KART_ASSETS[kartId]) {
    attachMeshToScene(window.KART_ASSETS[kartId]);
    return;
  }

  // 3. DISK CACHE (CacheStorage)
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
      if (cachedResponse) {
        arrayBuffer = await cachedResponse.arrayBuffer();
      }
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

  // 4. NETWORK FALLBACK COM SALVAMENTO NO CACHE
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

// Renderiza a Lista de Cards
function renderKartGrid() {
  const gridEl = document.getElementById('kartList');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  const unlockedList = (currentUserProfile && Array.isArray(currentUserProfile.unlocked_karts))
    ? currentUserProfile.unlocked_karts
    : ['jolteon', 'charizard'];

  KART_CATALOG.forEach((kart) => {
    const isUnlocked = unlockedList.includes(kart.id);
    const pokemonId = KART_POKEMON_IDS[kart.id];
    const thumbSrc = pokemonId ? `${POKEAPI_SPRITE_BASE}${pokemonId}.png` : 'img/jolteon.png';

    const card = document.createElement('div');
    card.className = `kart-card ${isUnlocked ? '' : 'locked'}`;
    card.dataset.kartId = kart.id;

    card.innerHTML = `
      <img src="${thumbSrc}" class="kart-thumb" alt="${kart.name}">
      <div class="kart-card-name">${kart.name.split(' ')[0]}</div>
      ${!isUnlocked ? `<div class="kart-card-price">🪙 ${kart.price}</div>` : `<div class="kart-card-price" style="color:#22c55e;">OK</div>`}
    `;

    card.onclick = () => selectKart(kart.id);
    gridEl.appendChild(card);
  });
}

// Seleção Instantânea do Kart
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
    if (nameEl) nameEl.innerText = kartData.name;

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

    updateActionButton(kartData);
  }

  loadKartModel(kartId);
}

// Gerenciamento Preciso do Botão de Ação
function updateActionButton(kartData) {
  const btnAction = document.getElementById('btnAction');
  if (!btnAction) return;

  const unlockedList = (currentUserProfile && Array.isArray(currentUserProfile.unlocked_karts))
    ? currentUserProfile.unlocked_karts
    : ['jolteon', 'charizard'];

  const isUnlocked = unlockedList.includes(kartData.id);
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
    btnAction.innerText = 'EQUIPAR KART';
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

// Ação de Equipar Kart
async function equipKart(kartId) {
  if (typeof updateSelectedKart === 'function') {
    await updateSelectedKart(kartId);
  }
  sessionStorage.setItem('pkart_selected_kart', kartId);
  selectKart(kartId);
}

// Ação de Comprar Kart no Supabase
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