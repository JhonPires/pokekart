// garage.js - Versão Otimizada com Cache Imediato e Lógica do Supabase

let scene, camera, renderer, currentMesh;
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
  'umbreon': 197
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
  { id: 'sylveon', name: 'Sylveon Kart', price: 3200, conceptImg: 'img/sylveon.png', stats: { speed: 84, accel: 92, handling: 90 } }
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

// Configuração da Cena 3D do Laboratório
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

  function animate() {
    requestAnimationFrame(animate);
    if (currentMesh) currentMesh.rotation.y += 0.01;
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

  // Helper para ocultar o spinner e adicionar à cena com segurança
  const attachMeshToScene = (gltfScene) => {
    if (requestId !== garageRequestId) return;

    currentMesh = gltfScene.clone(true);
    currentMesh.scale.setScalar(2.0);
    currentMesh.position.set(0, 0, 0);
    scene.add(currentMesh);

    // Oculta o indicador "Carregando modelo 3D..."
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
  const targetCacheName = typeof CACHE_NAME !== 'undefined' ? CACHE_NAME : 'pkart-3d-models-v1';

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

  // 4. NETWORK FALLBACK
  loader.load(
    modelUrl,
    (gltf) => {
      if (!window.KART_ASSETS) window.KART_ASSETS = {};
      window.KART_ASSETS[kartId] = gltf.scene;

      attachMeshToScene(gltf.scene);
    },
    undefined,
    (err) => {
      console.warn(`[Garagem] Erro ao carregar ${modelUrl}:`, err);
      if (spinner) spinner.style.display = 'none';
    }
  );
}
// Renderiza a Lista de Cards (Executado Apenas Uma Vez)
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

// Seleção Instantânea do Kart (Sem Recriar a Lista Inteira)
function selectKart(kartId) {
  selectedKartId = kartId;

  // Atualiza borda do card selecionado sem causar re-render na lista
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
    // Atualiza nome
    const nameEl = document.getElementById('kartName');
    if (nameEl) nameEl.innerText = kartData.name;

    // Atualiza barras de estatísticas
    if (kartData.stats) {
      const speedBar = document.getElementById('barSpeed');
      const accelBar = document.getElementById('barAccel');
      const handlingBar = document.getElementById('barHandling');

      if (speedBar) speedBar.style.width = `${kartData.stats.speed}%`;
      if (accelBar) accelBar.style.width = `${kartData.stats.accel}%`;
      if (handlingBar) handlingBar.style.width = `${kartData.stats.handling}%`;
    }

    // Atualiza imagem da Ficha Técnica
    const conceptImg = document.getElementById('kartConceptImg');
    if (conceptImg) conceptImg.src = kartData.conceptImg;

    // Atualiza o estado do botão Principal (COMPRAR vs EQUIPAR)
    updateActionButton(kartData);
  }

  // Renderiza o 3D instantaneamente
  loadKartModel(kartId);
}

// Gerenciamento Preciso do Botão de Ação (Comprar vs Equipar)
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