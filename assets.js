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

async function preloadAllKarts(onProgress) {
  const loader = new THREE.GLTFLoader();
  let loadedCount = 0;

  const promises = ASSET_LIST.map(asset => {
    return new Promise((resolve) => {
      // Faz um fetch rápido para validar se o servidor retornou 200 OK e não um HTML/LFS
      fetch(asset.url, { method: 'HEAD' }).then(res => {
        const contentType = res.headers.get('content-type') || '';

        if (!res.ok || contentType.includes('text/html')) {
          console.warn(`[Preloader] O arquivo ${asset.url} não foi encontrado no servidor (404).`);
          resolve();
          return;
        }

        loader.load(
          asset.url,
          (gltf) => {
            if (!window.KART_ASSETS) window.KART_ASSETS = {};
            window.KART_ASSETS[asset.id] = gltf.scene;
            loadedCount++;
            if (onProgress) onProgress(loadedCount / ASSET_LIST.length);
            resolve();
          },
          undefined,
          (err) => {
            console.warn(`[Preloader] Erro ao processar o arquivo 3D de ${asset.id}:`, err);
            resolve();
          }
        );
      }).catch(() => resolve());
    });
  });

  await Promise.all(promises);
}