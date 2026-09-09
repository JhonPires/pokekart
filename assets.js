// assets.js - Gerenciador de Carregamento Global
window.KART_ASSETS = {};

const ASSET_LIST = [
  { id: 'jolteon', url: './models/jolteon.glb' },
  { id: 'charizard', url: './models/charizard.glb' },
  { id: 'zoroark', url: './models/zoroark.glb' },
  { id: 'togetic', url: './models/togetic.glb' },
  { id: 'flygon', url: './models/flygon.glb' },
  { id: 'gengar', url: './models/gengar.glb' },
  { id: 'oshawott', url: './models/oshawott.glb' },
  { id: 'snorlax', url: './models/snorlax.glb' },
  { id: 'golem', url: './models/golem.glb' },
  { id: 'jinx', url: './models/jinx.glb' },
  { id: 'sudowoodo', url: './models/sudowoodo.glb' },
  { id: 'sylveon', url: './models/sylveon.glb' },
  { id: 'umbreon', url: './models/umbreon.glb' }
];

const CACHE_NAME = 'pkart-3d-models-v1';

async function preloadAllKarts(onProgress) {
  if (!window.KART_ASSETS) window.KART_ASSETS = {};
  const loader = new THREE.GLTFLoader();
  let loadedCount = 0;

  // Cria um renderizador fantasma temporário para forçar o envio dos shaders para a placa de vídeo
  const dummyRenderer = new THREE.WebGLRenderer({ antialias: false });
  const dummyScene = new THREE.Scene();
  const dummyCamera = new THREE.PerspectiveCamera();

  const cacheAvailable = 'caches' in window;
  let cache = null;

  if (cacheAvailable) {
    try { cache = await caches.open(CACHE_NAME); } catch (e) { }
  }

  const promises = ASSET_LIST.map(async (asset) => {
    try {
      let arrayBuffer = null;

      if (cache) {
        const cachedResponse = await cache.match(asset.url);
        if (cachedResponse) arrayBuffer = await cachedResponse.arrayBuffer();
      }

      if (!arrayBuffer) {
        const response = await fetch(asset.url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        if (cache) cache.put(asset.url, response.clone());
        arrayBuffer = await response.arrayBuffer();
      }

      return new Promise((resolve) => {
        loader.parse(arrayBuffer, './models/', (gltf) => {
          const modelScene = gltf.scene;

          // PRÉ-AQUECIMENTO DA GPU: Compila materiais e texturas antes do jogador clicar
          dummyScene.add(modelScene);
          dummyRenderer.compile(dummyScene, dummyCamera);
          dummyScene.remove(modelScene);

          window.KART_ASSETS[asset.id] = modelScene;
          loadedCount++;

          if (onProgress) onProgress(loadedCount / ASSET_LIST.length);
          resolve();
        }, () => resolve());
      });
    } catch (err) {
      return Promise.resolve();
    }
  });

  await Promise.all(promises);
  dummyRenderer.dispose(); // Descarta o renderizador temporário
}