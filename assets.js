// assets.js - Gerenciador de Carregamento Global
window.KART_ASSETS = {};

const ASSET_LIST = [
  { id: 'jolteon', url: 'models/jolteon.glb' },
  { id: 'charizard', url: 'models/charizard.glb' },
  { id: 'zoroark', url: 'models/zoroark.glb' },
  { id: 'togetic', url: 'models/togetic.glb' },
  { id: 'flygon', url: 'models/flygon.glb' },
  { id: 'gengar', url: 'models/gengar.glb' },
  { id: 'oshawott', url: 'models/oshawott.glb' },
  { id: 'snorlax', url: 'models/snorlax.glb' }
];

async function preloadAllKarts(onProgress) {
  const loader = new THREE.GLTFLoader();
  let loadedCount = 0;

  const validAssets = ASSET_LIST.filter(asset => asset.url && asset.id);

  const promises = validAssets.map(asset => {
    return new Promise((resolve) => {
      loader.load(
        asset.url,
        (gltf) => {
          if (!window.KART_ASSETS) window.KART_ASSETS = {};
          window.KART_ASSETS[asset.id] = gltf.scene;
          loadedCount++;
          if (onProgress) onProgress(loadedCount / validAssets.length);
          resolve();
        },
        undefined,
        (err) => {
          console.warn(`[Preloader] Erro ao carregar ${asset.id}`, err);
          resolve();
        }
      );
    });
  });

  await Promise.all(promises);
}