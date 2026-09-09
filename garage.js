// URL base para os sprites oficiais (Artwork) da PokeAPI
// Usamos essa URL direta para evitar fazer uma requisição de API por kart, o que seria lento.
// Basta trocar o número no final pelo ID do Pokémon.
const POKEAPI_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

// Mapeamento dos IDs dos Pokémons na PokeAPI para cada Kart
const KART_POKEMON_IDS = {
  'jolteon': 135,
  'charizard': 6,
  'zoroark': 571,
  'togetic': 176,
  'flygon': 330,
  'gengar': 94,
  'oshawott': 501,
  'snorlax': 143,
  // Novos Pokémons
  'golem': 76,
  'jinx': 124, // Jynx na PokeAPI usa o ID 124
  'sudowoodo': 185,
  'sylveon': 700,
  'umbreon': 197
};

// Atualize os caminhos no KART_CATALOG
const KART_CATALOG = [
  { id: 'jolteon', name: 'Jolteon Kart', price: 0, conceptImg: 'img/jolteon.png', modelUrl: 'models/jolteon.glb', stats: { speed: 75, accel: 90, handling: 85 } },
  { id: 'charizard', name: 'Charizard Kart', price: 0, conceptImg: 'img/charizard.png', modelUrl: 'models/charizard.glb', stats: { speed: 85, accel: 70, handling: 60 } },
  { id: 'zoroark', name: 'Zoroark Kart', price: 800, conceptImg: 'img/zoroark.png', modelUrl: 'models/zoroark.glb', stats: { speed: 80, accel: 75, handling: 80 } },
  { id: 'togetic', name: 'Togetic Kart', price: 1000, conceptImg: 'img/togetic.png', modelUrl: 'models/togetic.glb', stats: { speed: 70, accel: 80, handling: 95 } },
  { id: 'flygon', name: 'Flygon Kart', price: 1500, conceptImg: 'img/flygon.png', modelUrl: 'models/flygon.glb', stats: { speed: 90, accel: 70, handling: 75 } },
  { id: 'gengar', name: 'Gengar Kart', price: 2000, conceptImg: 'img/gengar.png', modelUrl: 'models/gengar.glb', stats: { speed: 78, accel: 85, handling: 65 } },
  { id: 'oshawott', name: 'Oshawott Kart', price: 2200, conceptImg: 'img/oshawott.png', modelUrl: 'models/oshawott.glb', stats: { speed: 78, accel: 88, handling: 75 } },
  { id: 'snorlax', name: 'Snorlax Kart', price: 3500, conceptImg: 'img/snorlax.png', modelUrl: 'models/snorlax.glb', stats: { speed: 98, accel: 55, handling: 85 } },
  // Novos Karts com Preços e Atributos Balanceados
  { id: 'sudowoodo', name: 'Sudowoodo Kart', price: 1200, conceptImg: 'img/sudowoodo.png', modelUrl: 'models/sudowoodo.glb', stats: { speed: 65, accel: 75, handling: 90 } },
  { id: 'golem', name: 'Golem Kart', price: 1800, conceptImg: 'img/golem.png', modelUrl: 'models/golem.glb', stats: { speed: 92, accel: 60, handling: 70 } },
  { id: 'jinx', name: 'Jynx Kart', price: 2400, conceptImg: 'img/jinx.png', modelUrl: 'models/jinx.glb', stats: { speed: 82, accel: 82, handling: 80 } },
  { id: 'umbreon', name: 'Umbreon Kart', price: 3000, conceptImg: 'img/umbreon.png', modelUrl: 'models/umbreon.glb', stats: { speed: 88, accel: 85, handling: 85 } },
  { id: 'sylveon', name: 'Sylveon Kart', price: 3200, conceptImg: 'img/sylveon.png', modelUrl: 'models/sylveon.glb', stats: { speed: 84, accel: 92, handling: 90 } }
];

let playerProfile = null;
let selectedKartId = 'jolteon';
let scene, camera, renderer, currentMesh;

window.addEventListener('DOMContentLoaded', async () => {
  init3DViewport();
  await loadUserData();
  renderKartGrid();
  selectKart(playerProfile.selected_kart || 'jolteon');

  document.getElementById('btnBack').onclick = () => window.location.href = 'index.html';
});

let isMouseDown = false;
let previousMousePosition = { x: 0, y: 0 };

// Configuração 3D corrigida (evita que a tela fique apenas azul/escura)
function init3DViewport() {
  const container = document.getElementById('kartViewport');
  scene = new THREE.Scene();
  // scene.background = new THREE.Color(0x0f172a);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 1.8, 5.0);
  camera.lookAt(0, 0.5, 0);

  // Iluminação ajustada para combinar com o laboratório
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5);
  // dirLight2.position.set(-5, 5, -5);
  // scene.add(dirLight2);

  // Ativa a transparência ({ alpha: true }) no WebGLRenderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // --- CONTROLE DE ROTAÇÃO MANUAL COM O MOUSE / TOUCH ---
  container.style.cursor = 'grab';

  container.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    container.style.cursor = 'grabbing';
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    isMouseDown = false;
    container.style.cursor = 'grab';
  });

  container.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !currentMesh) return;

    const deltaX = e.clientX - previousMousePosition.x;

    // Gira o modelo no eixo Y com base no movimento do mouse
    currentMesh.rotation.y += deltaX * 0.01;

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  // Suporte a Touch no Celular
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isMouseDown = true;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  });

  window.addEventListener('touchend', () => { isMouseDown = false; });

  container.addEventListener('touchmove', (e) => {
    if (!isMouseDown || !currentMesh || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - previousMousePosition.x;
    currentMesh.rotation.y += deltaX * 0.01;
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // Loop de Animação (Gira sozinho APENAS quando o jogador NÃO estiver arrastando)
  function animate() {
    requestAnimationFrame(animate);
    if (currentMesh && !isMouseDown) {
      currentMesh.rotation.y += 0.005; // Rotação automática suave
    }
    renderer.render(scene, camera);
  }
  animate();
}

async function loadUserData() {
  if (typeof fetchPlayerProfile === 'function') {
    playerProfile = await fetchPlayerProfile();
  }

  if (!playerProfile) {
    playerProfile = { nickname: 'JOGADOR', coins: 200, unlocked_karts: ['jolteon', 'charizard'], selected_kart: 'jolteon' };
  } else {
    // Garante que Charizard e Jolteon estejam sempre desbloqueados
    if (!playerProfile.unlocked_karts.includes('jolteon')) playerProfile.unlocked_karts.push('jolteon');
    if (!playerProfile.unlocked_karts.includes('charizard')) playerProfile.unlocked_karts.push('charizard');
  }

  document.getElementById('playerNickname').innerText = playerProfile.nickname;
  document.getElementById('playerCoins').innerText = playerProfile.coins;
}

async function renderKartGrid() {
  const gridEl = document.getElementById('kartList');
  if (!gridEl) return;
  gridEl.innerHTML = ''; // Limpa o grid existente

  // Criamos uma lista de promessas para renderizar todos os cards
  const cardPromises = KART_CATALOG.map(async (kart) => {
    const isUnlocked = playerProfile.unlocked_karts.includes(kart.id);
    const isSelected = kart.id === selectedKartId;

    // Busca o ID do Pokémon correspondente
    const pokemonId = KART_POKEMON_IDS[kart.id];

    // Constrói a URL da imagem da PokeAPI (Official Artwork)
    // Fallback para uma pokebola caso não encontre o ID mapeado
    const thumbSrc = pokemonId
      ? `${POKEAPI_SPRITE_BASE}${pokemonId}.png`
      : 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';

    // Cria o elemento do card
    const card = document.createElement('div');
    card.className = `kart-card ${isUnlocked ? '' : 'locked'} ${isSelected ? 'selected' : ''}`;

    // Monta o HTML interno do card usando a imagem da PokeAPI
    card.innerHTML = `
      <img src="${thumbSrc}" class="kart-thumb" onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';" alt="${kart.name}">
      <div class="kart-card-name">${kart.name.split(' ')[0]}</div>
      ${!isUnlocked ? `<div class="kart-card-price">🪙 ${kart.price}</div>` : `<div class="kart-card-price" style="color:#4caf50;">OK</div>`}
    `;

    // Adiciona o evento de clique
    card.onclick = () => selectKart(kart.id);

    return card;
  });

  // Aguarda todos os cards serem gerados
  const cards = await Promise.all(cardPromises);

  // Adiciona todos os cards ao grid de uma vez
  cards.forEach(card => gridEl.appendChild(card));
}

function updateStatsDisplay(kartId) {
  const kart = KART_CATALOG.find(k => k.id === kartId);
  if (!kart) return;

  // Atualiza os textos da ficha técnica
  const nameEl = document.getElementById('kartNameDisplay');
  if (nameEl) nameEl.innerText = kart.name;

  // Atualiza as barras de atributos
  if (kart.stats) {
    const speedBar = document.getElementById('statSpeed');
    const accelBar = document.getElementById('statAccel');
    const handlingBar = document.getElementById('statHandling');

    if (speedBar) speedBar.style.width = `${kart.stats.speed}%`;
    if (accelBar) accelBar.style.width = `${kart.stats.accel}%`;
    if (handlingBar) handlingBar.style.width = `${kart.stats.handling}%`;
  }
}

function selectKart(kartId) {
  selectedKartId = kartId;
  const kartData = KART_CATALOG.find(k => k.id === kartId);

  if (!kartData) return;

  // 1. Atualiza o Nome
  const nameEl = document.getElementById('kartName');
  if (nameEl) nameEl.innerText = kartData.name;

  // 2. Atualiza os Atributos
  const speedEl = document.getElementById('barSpeed');
  const accelEl = document.getElementById('barAccel');
  const handEl = document.getElementById('barHandling');

  if (speedEl) speedEl.style.width = `${kartData.stats.speed}%`;
  if (accelEl) accelEl.style.width = `${kartData.stats.accel}%`;
  if (handEl) handEl.style.width = `${kartData.stats.handling}%`;

  // 3. Atualiza a Imagem do Concept Art (Ficha Técnica)
  // Atualização da Imagem de Ficha Técnica
  const conceptImgEl = document.getElementById('kartConceptImg');
  if (conceptImgEl) {
    // Garante que não passe 'undefined' na URL
    const imgPath = kartData.conceptImg || kartData.previewImg || `img/${kartData.id}.png`;

    if (imgPath && !imgPath.includes('undefined')) {
      conceptImgEl.src = imgPath;
    } else {
      conceptImgEl.src = 'img/jolteon.png'; // Fallback seguro
    }

    conceptImgEl.onerror = () => {
      conceptImgEl.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
    };
  }

  // 4. Atualiza o Botão de Ação (Equipar / Comprar)
  const isUnlocked = playerProfile.unlocked_karts.includes(kartId);
  const isEquipped = playerProfile.selected_kart === kartId;
  const btn = document.getElementById('btnAction');

  if (btn) {
    if (isEquipped) {
      btn.className = 'btn-action equipped';
      btn.innerText = 'EQUIPADO';
      btn.onclick = null;
    } else if (isUnlocked) {
      btn.className = 'btn-action primary';
      btn.innerText = 'EQUIPAR';
      btn.onclick = () => equipKart(kartId);
    } else {
      btn.className = 'btn-action buy';
      btn.innerText = `COMPRAR (🪙 ${kartData.price})`;
      btn.onclick = () => buyKart(kartData);
    }
  }

  // 5. Recarrega o Grid visual para destacar o card selecionado e o Modelo 3D
  renderKartGrid();
 // Executa a atualização de atributos APENAS se a função existir
  if (typeof updateStatsDisplay === 'function') {
    updateStatsDisplay(kartId);
  }
  loadKartModel(kartData.id, kartData.modelUrl);
}

// Controle de requisição ativa para impedir sobreposição
let garageRequestId = 0; // Evita sobreposição ao clicar rápido

function loadKartModel(kartId) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = 'block';

  // Incrementa a requisição atual
  const requestId = ++garageRequestId;

  // 1. Limpa o modelo 3D atual da cena antes de colocar o novo
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  // 2. REUTILIZAÇÃO INSTANTÂNEA DO CACHE GLOBAL (0ms)
  if (window.KART_ASSETS && window.KART_ASSETS[kartId]) {
    if (requestId !== garageRequestId) return;

    currentMesh = window.KART_ASSETS[kartId].clone(true);
    currentMesh.scale.setScalar(2.0);
    currentMesh.position.set(0, 0, 0);
    scene.add(currentMesh);

    if (spinner) spinner.style.display = 'none';
    return;
  }

  // 3. FALLBACK: Se por algum motivo não estava no cache, carrega do caminho relativo
  const modelUrl = `./models/${kartId}.glb`;
  const loader = new THREE.GLTFLoader();

  loader.load(
    modelUrl,
    (gltf) => {
      // Se o usuário trocou de kart durante o download, descarta
      if (requestId !== garageRequestId) return;

      if (!window.KART_ASSETS) window.KART_ASSETS = {};
      window.KART_ASSETS[kartId] = gltf.scene;

      currentMesh = gltf.scene.clone(true);
      currentMesh.scale.setScalar(2.0);
      currentMesh.position.set(0, 0, 0);
      scene.add(currentMesh);

      if (spinner) spinner.style.display = 'none';
    },
    undefined,
    (err) => {
      if (requestId !== garageRequestId) return;
      console.warn(`[Garagem] Erro ao carregar ${modelUrl}`, err);
      if (spinner) spinner.style.display = 'none';
    }
  );
}

async function equipKart(kartId) {
  playerProfile.selected_kart = kartId;
  if (typeof supabaseClient !== 'undefined') {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      await supabaseClient.from('profiles').update({ selected_kart: kartId }).eq('id', user.id);
    }
  }
  selectKart(kartId);
}

async function buyKart(kartData) {
  if (playerProfile.coins < kartData.price) {
    alert('Moedas insuficientes!');
    return;
  }

  playerProfile.coins -= kartData.price;
  playerProfile.unlocked_karts.push(kartData.id);
  playerProfile.selected_kart = kartData.id;

  if (typeof supabaseClient !== 'undefined') {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      await supabaseClient.from('profiles').update({
        coins: playerProfile.coins,
        unlocked_karts: playerProfile.unlocked_karts,
        selected_kart: kartData.id
      }).eq('id', user.id);
    }
  }

  document.getElementById('playerCoins').innerText = playerProfile.coins;
  selectKart(kartData.id);
}
