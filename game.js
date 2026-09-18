// ------------------------------------------------------------
// SETUP BÁSICO DA CORRIDA E AMBIENTE APRIMORADO
// ------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
const victorySound = new Audio('sounds/victory.mp3');

// Renderizador normal (sem toneMapping agressivo)
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Setup de Pós-Processamento (Bloom Suave)
const composer = new THREE.EffectComposer(renderer);
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

// CORREÇÃO: Força menor (0.15) e Threshold alto (0.95)
// Isso impede que o asfalto cinza brilhe, aplicando brilho apenas no que for muito claro
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.15, 0.4, 0.95);
composer.addPass(bloomPass);

// --- CRIAÇÃO DA BARRA DE DRIFT NA TELA ---
const driftBarContainer = document.createElement('div');
driftBarContainer.style.cssText = 'position: absolute; bottom: 25%; left: 50%; transform: translateX(-50%); width: 180px; height: 10px; background: rgba(0,0,0,0.6); border: 2px solid rgba(255,255,255,0.8); border-radius: 8px; display: none; z-index: 100; overflow: hidden;';
const driftBarFill = document.createElement('div');
driftBarFill.style.cssText = 'width: 0%; height: 100%; background: #facc15; transition: width 0.1s, background-color 0.2s; box-shadow: 0 0 8px #facc15;';
driftBarContainer.appendChild(driftBarFill);
document.body.appendChild(driftBarContainer);

let raceStartTime = 0;
let totalRaceTimeMs = 0;
let raceTimerInterval = null;
let currentTreeGroup = null;
let lapStartTime = 0; // Marca o início da volta atual
let localLapTimes = []; // Guarda o tempo de cada volta completa

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function createCloudSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#4fa3e0');
  grad.addColorStop(0.55, '#9bd4f4');
  grad.addColorStop(1, '#d9f0ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  function drawCloud(cx, cy, scale, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    const blobs = [[0, 0, 55], [48, 8, 40], [-48, 8, 40], [22, -14, 34], [-22, -14, 34]];
    blobs.forEach(([bx, by, r]) => {
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  for (let i = 0; i < 16; i++) {
    const cx = Math.random() * canvas.width;
    const cy = 40 + Math.random() * (canvas.height * 0.42);
    const scale = 0.5 + Math.random() * 0.85;
    drawCloud(cx, cy, scale, 0.75 + Math.random() * 0.2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function setupEnhancedEnvironment(scene) {
  // Gera um céu com gradiente
  function createSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#1a4a76'); // Topo do céu (azul profundo)
    grad.addColorStop(0.5, '#5cb8ff'); // Meio do céu
    grad.addColorStop(1.0, '#aaddff'); // Horizonte (quase branco)
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 512);
    return new THREE.CanvasTexture(canvas);
  }

  scene.background = createSkyTexture();
  scene.fog = new THREE.Fog(0xaaddff, 60, 280); // Substitui a neblina antiga pela nova

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));

  const sun = new THREE.DirectionalLight(0xfff5e6, 1.3);
  sun.position.set(40, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
  scene.add(sun);

  respawnTreesForTrack();

  // Adiciona as nuvens e pedras ao redor da pista
  spawnClouds(scene);
  // spawnRocks(scene);
}

// function spawnRocks(targetScene) {
//   const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
//   const rockMat = new THREE.MeshStandardMaterial({
//     color: 0x6e7a85,
//     roughness: 0.9,
//     flatShading: true
//   });

//   const pointsSource = (typeof trackCheckpoints !== 'undefined' && trackCheckpoints.length > 0) ? trackCheckpoints : [];
//   if (pointsSource.length === 0) return;

//   // Percorre o traçado e posiciona as pedras nas laterais exatas usando vetores perpendiculares
//   for (let i = 0; i < pointsSource.length; i += 2) {
//     const p1 = pointsSource[i];
//     const p2 = pointsSource[(i + 1) % pointsSource.length];

//     // Direção do segmento da pista
//     const dirX = p2.x - p1.x;
//     const dirZ = (p2.z || p2.y) - (p1.z || p1.y);
//     const len = Math.hypot(dirX, dirZ);
//     if (len === 0) continue;

//     // Normalização
//     const nx = dirX / len;
//     const nz = dirZ / len;

//     // Vetor perpendicular (joga para a lateral da pista)
//     const perpX = -nz;
//     const perpZ = nx;

//     // Escolhe o lado (esquerdo ou direito) e uma distância segura na grama (entre 48 e 75 unidades para fora)
//     const side = Math.random() > 0.5 ? 1 : -1;
//     const distance = 48 + Math.random() * 27;

//     const rx = p1.x + perpX * (side * distance);
//     const rz = (p1.z || p1.y) + perpZ * (side * distance);

//     const rock = new THREE.Mesh(rockGeo, rockMat);
//     rock.position.set(rx, 0, rz);

//     const s = 0.6 + Math.random() * 1.2;
//     rock.scale.set(s, s * 0.6, s);
//     rock.rotation.y = Math.random() * Math.PI;
//     rock.castShadow = true;
//     rock.receiveShadow = true;

//     targetScene.add(rock);
//   }
// }

const maxDustParticles = 40;

function spawnDustParticle(x, y, z) {
  if (dustParticles.length >= maxDustParticles) {
    const old = dustParticles.shift();
    if (old) {
      scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
    }
  }

  // Geometria menor (raio 0.12 em vez de 0.2)
  const geo = new THREE.DodecahedronGeometry(0.12, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc5c5c5,
    roughness: 1.0,
    transparent: true,
    opacity: 0.45,
    flatShading: true
  });

  const mesh = new THREE.Mesh(geo, mat);

  const headingQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), physics.heading);
  const localOffset = new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.03, -0.85).applyQuaternion(headingQuat);

  mesh.position.set(x + localOffset.x, y + localOffset.y, z + localOffset.z);

  scene.add(mesh);
  dustParticles.push({
    mesh: mesh,
    scaleSpeed: 0.008 + Math.random() * 0.01, // Crescimento mais lento e discreto
    life: 0.45 // Some mais rápido
  });
}

function updateDustParticles() {
  for (let i = dustParticles.length - 1; i >= 0; i--) {
    const p = dustParticles[i];
    if (!p || !p.mesh || !p.mesh.material) continue;

    p.life -= 0.04;
    p.mesh.scale.addScalar(p.scaleSpeed);
    p.mesh.material.opacity = Math.max(0, p.life * 0.5);

    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      dustParticles.splice(i, 1);
    }
  }
}

function spawnClouds(targetScene) {
  const cloudGeo = new THREE.DodecahedronGeometry(6, 0); // Estilo Low-Poly
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    flatShading: true // Dá aquele visual facetado e estiloso
  });

  for (let i = 0; i < 40; i++) {
    const cloudGroup = new THREE.Group();
    const clumpCount = 3 + Math.floor(Math.random() * 4);

    for (let j = 0; j < clumpCount; j++) {
      const mesh = new THREE.Mesh(cloudGeo, cloudMat);
      mesh.position.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 12
      );
      const scale = 0.5 + Math.random() * 0.8;
      mesh.scale.set(scale, scale, scale);
      mesh.rotation.set(Math.random(), Math.random(), Math.random());
      cloudGroup.add(mesh);
    }

    cloudGroup.position.set(
      (Math.random() - 0.5) * 500,
      45 + Math.random() * 50, // Altura das nuvens
      (Math.random() - 0.5) * 500
    );
    targetScene.add(cloudGroup);
  }
}

// ------------------------------------------------------------
// DATABASE E URLS
// ------------------------------------------------------------
function getKartUrl(filename) {
  return `./models/${filename}`;
}

const KART_DATABASE = [
  { id: 'jolteon', name: 'Jolteon Kart', modelUrl: getKartUrl('jolteon.glb'), stats: { accel: 32, maxSpeed: 29, turnSpeed: 3.2, turboBonus: 1.0, driftRate: 1.5, driftControl: 1.1, grip: 0.85 } },
  { id: 'zoroark', name: 'Zoroark Kart', modelUrl: getKartUrl('zoroark.glb'), stats: { accel: 27, maxSpeed: 31, turnSpeed: 3.2, turboBonus: 1.0, driftRate: 1.4, driftControl: 1.2, grip: 0.75 } },
  { id: 'togetic', name: 'Togetic Kart', modelUrl: getKartUrl('togetic.glb'), stats: { accel: 28.5, maxSpeed: 28.5, turnSpeed: 4.0, turboBonus: 1.2, driftRate: 1.1, driftControl: 1.0, grip: 0.80 } },
  { id: 'charizard', name: 'Charizard Kart', modelUrl: getKartUrl('charizard.glb'), stats: { accel: 25, maxSpeed: 33, turnSpeed: 3.4, turboBonus: 1.6, driftRate: 1.0, driftControl: 0.8, grip: 0.65 } },
  { id: 'flygon', name: 'Flygon Kart', modelUrl: getKartUrl('flygon.glb'), stats: { accel: 26, maxSpeed: 35, turnSpeed: 3.1, turboBonus: 1.1, driftRate: 1.6, driftControl: 1.1, grip: 0.70 } },
  { id: 'gengar', name: 'Gengar Kart', modelUrl: getKartUrl('gengar.glb'), stats: { accel: 29, maxSpeed: 30, turnSpeed: 3.3, turboBonus: 1.0, driftRate: 1.3, driftControl: 1.3, grip: 0.55 } },
  { id: 'oshawott', name: 'Oshawott Kart', modelUrl: getKartUrl('oshawott.glb'), stats: { accel: 31, maxSpeed: 30, turnSpeed: 3.2, turboBonus: 1.1, driftRate: 1.0, driftControl: 1.0, grip: 0.70 } },
  { id: 'snorlax', name: 'Snorlax Kart', modelUrl: getKartUrl('snorlax.glb'), stats: { accel: 21, maxSpeed: 38, turnSpeed: 3.0, turboBonus: 2.0, driftRate: 0.8, driftControl: 1.1, grip: 0.85 } },
  { id: 'golem', name: 'Golem Kart', modelUrl: getKartUrl('golem.glb'), stats: { accel: 22, maxSpeed: 34, turnSpeed: 2.9, turboBonus: 1.5, driftRate: 0.9, driftControl: 1.0, grip: 0.80 } },
  { id: 'jinx', name: 'Jynx Kart', modelUrl: getKartUrl('jinx.glb'), stats: { accel: 28, maxSpeed: 30, turnSpeed: 3.5, turboBonus: 1.2, driftRate: 1.3, driftControl: 1.1, grip: 0.75 } },
  { id: 'sudowoodo', name: 'Sudowoodo Kart', modelUrl: getKartUrl('sudowoodo.glb'), stats: { accel: 24, maxSpeed: 28, turnSpeed: 3.8, turboBonus: 1.3, driftRate: 1.1, driftControl: 1.2, grip: 0.85 } },
  { id: 'sylveon', name: 'Sylveon Kart', modelUrl: getKartUrl('sylveon.glb'), stats: { accel: 32, maxSpeed: 31, turnSpeed: 3.7, turboBonus: 1.2, driftRate: 1.2, driftControl: 1.1, grip: 0.80 } },
  { id: 'umbreon', name: 'Umbreon Kart', modelUrl: getKartUrl('umbreon.glb'), stats: { accel: 30, maxSpeed: 32, turnSpeed: 3.5, turboBonus: 1.3, driftRate: 1.4, driftControl: 1.2, grip: 0.85 } },
  { id: 'pikachu', name: 'Pikachu Kart', modelUrl: getKartUrl('pikachu.glb'), stats: { accel: 33, maxSpeed: 30, turnSpeed: 3.6, turboBonus: 1.3, driftRate: 1.3, driftControl: 1.2, grip: 0.80 } },
  { id: 'gliscor', name: 'Gliscor Kart', modelUrl: getKartUrl('gliscor.glb'), stats: { accel: 29, maxSpeed: 31, turnSpeed: 3.5, turboBonus: 1.2, driftRate: 1.5, driftControl: 1.2, grip: 0.75 } },
  { id: 'mewtwo', name: 'Mewtwo Kart', modelUrl: getKartUrl('mewtwo.glb'), stats: { accel: 33, maxSpeed: 36, turnSpeed: 3.6, turboBonus: 1.4, driftRate: 1.3, driftControl: 1.3, grip: 0.80 } },
  { id: 'zekrom', name: 'Zekrom Kart', modelUrl: getKartUrl('zekrom.glb'), stats: { accel: 30, maxSpeed: 36, turnSpeed: 3.2, turboBonus: 1.7, driftRate: 1.2, driftControl: 1.0, grip: 0.75 } },
  { id: 'swampert', name: 'Swampert Kart', modelUrl: getKartUrl('swampert.glb'), stats: { accel: 29, maxSpeed: 32, turnSpeed: 3.3, turboBonus: 1.4, driftRate: 1.1, driftControl: 1.1, grip: 0.90 } },
  { id: 'rayquaza', name: 'Rayquaza Kart', modelUrl: getKartUrl('rayquaza.glb'), stats: { accel: 32, maxSpeed: 37, turnSpeed: 3.4, turboBonus: 1.8, driftRate: 1.4, driftControl: 1.1, grip: 0.75 } },
  { id: 'espeon', name: 'Espeon Kart', modelUrl: getKartUrl('espeon.glb'), stats: { accel: 31, maxSpeed: 32, turnSpeed: 3.7, turboBonus: 1.3, driftRate: 1.3, driftControl: 1.2, grip: 0.80 } },
  { id: 'tatsugiri', name: 'Tatsugiri Kart', modelUrl: getKartUrl('tatsugiri.glb'), stats: { accel: 34, maxSpeed: 29, turnSpeed: 3.9, turboBonus: 1.2, driftRate: 1.6, driftControl: 1.3, grip: 0.70 } },
  { id: 'scyther', name: 'Scyther Kart', modelUrl: getKartUrl('scyther.glb'), stats: { accel: 31, maxSpeed: 33, turnSpeed: 3.6, turboBonus: 1.2, driftRate: 1.4, driftControl: 1.2, grip: 0.80 } },
  { id: 'ninetales', name: 'Ninetales Kart', modelUrl: getKartUrl('ninetales.glb'), stats: { accel: 31, maxSpeed: 33, turnSpeed: 3.5, turboBonus: 1.3, driftRate: 1.4, driftControl: 1.2, grip: 0.80 } },
  { id: 'arcanine', name: 'Arcanine Kart', modelUrl: getKartUrl('arcanine.glb'), stats: { accel: 34, maxSpeed: 35, turnSpeed: 3.2, turboBonus: 1.5, driftRate: 1.3, driftControl: 1.1, grip: 0.85 } },
  { id: 'lucario', name: 'Lucario Kart', modelUrl: getKartUrl('lucario.glb'), stats: { accel: 32, maxSpeed: 34, turnSpeed: 3.6, turboBonus: 1.4, driftRate: 1.5, driftControl: 1.3, grip: 0.82 } },
  { id: 'dialga', name: 'Dialga Kart', modelUrl: getKartUrl('dialga.glb'), stats: { accel: 25, maxSpeed: 38, turnSpeed: 2.9, turboBonus: 1.8, driftRate: 1.0, driftControl: 1.0, grip: 0.90 } },
  { id: 'zapdos', name: 'Zapdos Kart', modelUrl: getKartUrl('zapdos.glb'), stats: { accel: 35, maxSpeed: 34, turnSpeed: 3.4, turboBonus: 1.6, driftRate: 1.2, driftControl: 1.1, grip: 0.75 } },
  { id: 'luxray', name: 'Luxray Kart', modelUrl: getKartUrl('luxray.glb'), stats: { accel: 33, maxSpeed: 32, turnSpeed: 3.3, turboBonus: 1.4, driftRate: 1.3, driftControl: 1.2, grip: 0.80 } },
  { id: 'staraptor', name: 'Staraptor Kart', modelUrl: getKartUrl('staraptor.glb'), stats: { accel: 34, maxSpeed: 31, turnSpeed: 3.5, turboBonus: 1.2, driftRate: 1.4, driftControl: 1.2, grip: 0.78 } },
  { id: 'dragonite', name: 'Dragonite Kart', modelUrl: getKartUrl('dragonite.glb'), stats: { accel: 28, maxSpeed: 36, turnSpeed: 3.1, turboBonus: 1.7, driftRate: 1.1, driftControl: 1.1, grip: 0.85 } },
  { id: 'tangela', name: 'Tangela Kart', modelUrl: getKartUrl('tangela.glb'), stats: { accel: 30, maxSpeed: 29, turnSpeed: 3.8, turboBonus: 1.1, driftRate: 1.5, driftControl: 1.3, grip: 0.95 } },
  { id: 'sneasel', name: 'Sneasel Kart', modelUrl: getKartUrl('sneasel.glb'), stats: { accel: 36, maxSpeed: 30, turnSpeed: 3.7, turboBonus: 1.2, driftRate: 1.6, driftControl: 1.4, grip: 0.70 } },
  { id: 'darkrai', name: 'Darkrai Kart', modelUrl: getKartUrl('darkrai.glb'), stats: { accel: 34, maxSpeed: 37, turnSpeed: 3.5, turboBonus: 1.6, driftRate: 1.5, driftControl: 1.3, grip: 0.75 } },
  { id: 'moltres', name: 'Moltres Kart', modelUrl: getKartUrl('moltres.glb'), stats: { accel: 33, maxSpeed: 36, turnSpeed: 3.4, turboBonus: 1.7, driftRate: 1.3, driftControl: 1.1, grip: 0.78 } },
  { id: 'weezing', name: 'Weezing Kart', modelUrl: getKartUrl('weezing.glb'), stats: { accel: 24, maxSpeed: 30, turnSpeed: 3.1, turboBonus: 1.2, driftRate: 1.0, driftControl: 1.1, grip: 0.88 } },
  { id: 'swellow', name: 'Swellow Kart', modelUrl: getKartUrl('swellow.glb'), stats: { accel: 35, maxSpeed: 33, turnSpeed: 3.8, turboBonus: 1.3, driftRate: 1.6, driftControl: 1.4, grip: 0.72 } },
  { id: 'articuno', name: 'Articuno Kart', modelUrl: getKartUrl('articuno.glb'), stats: { accel: 32, maxSpeed: 35, turnSpeed: 3.5, turboBonus: 1.5, driftRate: 1.4, driftControl: 1.2, grip: 0.82 } },
  { id: 'blastoise', name: 'Blastoise Kart', modelUrl: getKartUrl('blastoise.glb'), stats: { accel: 28, maxSpeed: 34, turnSpeed: 3.3, turboBonus: 1.4, driftRate: 1.3, driftControl: 1.1, grip: 0.85 } },
  { id: 'venusaur', name: 'Venusaur Kart', modelUrl: getKartUrl('venusaur.glb'), stats: { accel: 29, maxSpeed: 33, turnSpeed: 3.4, turboBonus: 1.3, driftRate: 1.3, driftControl: 1.2, grip: 0.85 } },
  { id: 'ceruledge', name: 'Ceruledge Kart', modelUrl: getKartUrl('ceruledge.glb'), stats: { accel: 33, maxSpeed: 36, turnSpeed: 3.6, turboBonus: 1.6, driftRate: 1.5, driftControl: 1.3, grip: 0.78 } },
  { id: 'infernape', name: 'Infernape Kart', modelUrl: getKartUrl('infernape.glb'), stats: { accel: 34, maxSpeed: 35, turnSpeed: 3.7, turboBonus: 1.5, driftRate: 1.5, driftControl: 1.3, grip: 0.75 } },
  { id: 'empoleon', name: 'Empoleon Kart', modelUrl: getKartUrl('empoleon.glb'), stats: { accel: 30, maxSpeed: 34, turnSpeed: 3.3, turboBonus: 1.4, driftRate: 1.3, driftControl: 1.2, grip: 0.82 } },
  { id: 'torterra', name: 'Torterra Kart', modelUrl: getKartUrl('torterra.glb'), stats: { accel: 27, maxSpeed: 33, turnSpeed: 3.1, turboBonus: 1.3, driftRate: 1.2, driftControl: 1.1, grip: 0.88 } },
  { id: 'hooh', name: 'Ho-Oh Kart', modelUrl: getKartUrl('hooh.glb'), stats: { accel: 36, maxSpeed: 39, turnSpeed: 3.5, turboBonus: 1.9, driftRate: 1.6, driftControl: 1.3, grip: 0.72 } },
  { id: 'hydreigon', name: 'Hydreigon Kart', modelUrl: getKartUrl('hydreigon.glb'), stats: { accel: 34, maxSpeed: 37, turnSpeed: 3.6, turboBonus: 1.7, driftRate: 1.4, driftControl: 1.2, grip: 0.78 } },
  { id: 'lunala', name: 'Lunala Kart', modelUrl: getKartUrl('lunala.glb'), stats: { accel: 35, maxSpeed: 38, turnSpeed: 3.6, turboBonus: 1.8, driftRate: 1.5, driftControl: 1.3, grip: 0.75 } },
  { id: 'alakazam', name: '🥄 Alakazam Kart', modelUrl: getKartUrl('alakazam.glb'), stats: { accel: 35, maxSpeed: 32, turnSpeed: 3.6, turboBonus: 1.3, driftRate: 1.4, driftControl: 1.2, grip: 0.75 } },
  { id: 'onix', name: '🪨 Onix Kart', modelUrl: getKartUrl('onix.glb'), stats: { accel: 20, maxSpeed: 36, turnSpeed: 2.8, turboBonus: 1.5, driftRate: 0.9, driftControl: 1.0, grip: 0.95 } },
  { id: 'starmie', name: '⭐ Starmie Kart', modelUrl: getKartUrl('starmie.glb'), stats: { accel: 33, maxSpeed: 35, turnSpeed: 3.8, turboBonus: 1.4, driftRate: 1.5, driftControl: 1.2, grip: 0.80 } },
  { id: 'victreebel', name: '🌿 Victreebel Kart', modelUrl: getKartUrl('victreebel.glb'), stats: { accel: 29, maxSpeed: 31, turnSpeed: 3.2, turboBonus: 1.2, driftRate: 1.3, driftControl: 1.1, grip: 0.85 } },
  { id: 'rhydon', name: '🛡️ Rhydon Kart', modelUrl: getKartUrl('rhydon.glb'), stats: { accel: 23, maxSpeed: 37, turnSpeed: 2.9, turboBonus: 1.7, driftRate: 1.0, driftControl: 1.1, grip: 0.90 } },
  { id: 'persian', name: '🐈 Persian Kart', modelUrl: getKartUrl('persian.glb'), stats: { accel: 34, maxSpeed: 33, turnSpeed: 3.5, turboBonus: 1.3, driftRate: 1.4, driftControl: 1.2, grip: 0.80 } },
  { id: 'kyogre', name: '🌊 Kyogre Kart', modelUrl: getKartUrl('kyogre.glb'), stats: { accel: 30, maxSpeed: 36, turnSpeed: 3.3, turboBonus: 1.7, driftRate: 1.3, driftControl: 1.2, grip: 0.82 } },
  { id: 'groudon', name: '🌋 Groudon Kart', modelUrl: getKartUrl('groudon.glb'), stats: { accel: 24, maxSpeed: 37, turnSpeed: 3.0, turboBonus: 1.8, driftRate: 1.0, driftControl: 1.0, grip: 0.90 } },
  { id: 'suicune', name: '💧 Suicune Kart', modelUrl: getKartUrl('suicune.glb'), stats: { accel: 32, maxSpeed: 34, turnSpeed: 3.6, turboBonus: 1.4, driftRate: 1.4, driftControl: 1.2, grip: 0.85 } },
  { id: 'entei', name: '🔥 Entei Kart', modelUrl: getKartUrl('entei.glb'), stats: { accel: 34, maxSpeed: 35, turnSpeed: 3.3, turboBonus: 1.5, driftRate: 1.3, driftControl: 1.1, grip: 0.80 } },
  { id: 'raikou', name: '⚡ Raikou Kart', modelUrl: getKartUrl('raikou.glb'), stats: { accel: 36, maxSpeed: 35, turnSpeed: 3.7, turboBonus: 1.5, driftRate: 1.5, driftControl: 1.3, grip: 0.78 } },
  { id: 'giratina', name: '🕳️ Giratina Kart', modelUrl: getKartUrl('giratina.glb'), stats: { accel: 27, maxSpeed: 39, turnSpeed: 3.1, turboBonus: 2.0, driftRate: 1.2, driftControl: 1.1, grip: 0.80 } },
  { id: 'arceus', name: '✨ Arceus Kart', modelUrl: getKartUrl('arceus.glb'), stats: { accel: 35, maxSpeed: 40, turnSpeed: 3.8, turboBonus: 2.1, driftRate: 1.6, driftControl: 1.4, grip: 0.85 } },
  { id: 'mew', name: '🔮 Mew Kart', modelUrl: getKartUrl('mew.glb'), stats: { accel: 36, maxSpeed: 34, turnSpeed: 4.1, turboBonus: 1.4, driftRate: 1.7, driftControl: 1.4, grip: 0.75 } },
  { id: 'celebi', name: '🌿 Celebi Kart', modelUrl: getKartUrl('celebi.glb'), stats: { accel: 35, maxSpeed: 32, turnSpeed: 4.0, turboBonus: 1.3, driftRate: 1.6, driftControl: 1.3, grip: 0.80 } },
  { id: 'lugia', name: '🌪️ Lugia Kart', modelUrl: getKartUrl('lugia.glb'), stats: { accel: 33, maxSpeed: 38, turnSpeed: 3.6, turboBonus: 1.8, driftRate: 1.4, driftControl: 1.2, grip: 0.78 } },
];

const GYM_LEADERS = ['BROCK', 'MISTY', 'LT. SURGE', 'ERIKA', 'KOGA', 'SABRINA', 'BLAINE', 'GIOVANNI', 'FALKNER', 'BUGSY', 'WHITNEY', 'MORTY'];

const urlParams = new URLSearchParams(window.location.search);
const aiDifficultyParam = urlParams.get('ai') || 'none';
const playerNickname = (urlParams.get('nick') || 'JOGADOR').toUpperCase();
const selectedKartId = urlParams.get('kart') || 'jolteon';
const roomCodeParam = urlParams.get('room');
const customTrackParam = urlParams.get('customTrack');
const playerSlotParam = parseInt(urlParams.get('slot') || '0', 10);
const totalPlayersParam = parseInt(urlParams.get('players') || '1', 10);
let selectedKartIndex = KART_DATABASE.findIndex(k => k.id === selectedKartId);
if (selectedKartIndex === -1) selectedKartIndex = 0;

// Variáveis para controle de punição e estado ativo da partida
let corridaAtivaParaPunicao = true;
let lastSnapshotReceivedTime = Date.now();

// ------------------------------------------------------------
// PISTA E OBSTÁCULOS
// ------------------------------------------------------------
const TRACK_PRESETS = {
  circuitoE: [
    new THREE.Vector3(0, 0, -100),
    new THREE.Vector3(60, 0, -100),
    new THREE.Vector3(60, 0, -30),
    new THREE.Vector3(40, 0, 0),
    new THREE.Vector3(80, 0, 40),
    new THREE.Vector3(40, 0, 100),
    new THREE.Vector3(-40, 0, 100),
    new THREE.Vector3(-70, 0, 30),
    new THREE.Vector3(-30, 0, -30),
    new THREE.Vector3(-60, 0, -100)
  ],
  circuitoOval: [
    new THREE.Vector3(0, 0, -120),
    new THREE.Vector3(80, 0, -120),
    new THREE.Vector3(120, 0, -80),
    new THREE.Vector3(120, 0, 80),
    new THREE.Vector3(80, 0, 120),
    new THREE.Vector3(-80, 0, 120),
    new THREE.Vector3(-120, 0, 80),
    new THREE.Vector3(-120, 0, -80),
    new THREE.Vector3(-80, 0, -120)
  ],
  circuitoZigueZague: [
    new THREE.Vector3(0, 0, -120),
    new THREE.Vector3(80, 0, -120),
    new THREE.Vector3(80, 0, -40),
    new THREE.Vector3(-80, 0, 0),
    new THREE.Vector3(-80, 0, 80),
    new THREE.Vector3(80, 0, 120),
    new THREE.Vector3(0, 0, 120),
    new THREE.Vector3(-120, 0, 0)
  ]
};

// Captura a pista escolhida na URL. Se não houver, usa o circuitoE por padrão.
const selectedTrackParam = urlParams.get('track') || 'circuitoE';

function getTrackCurve() {
  const trackPoints = TRACK_PRESETS[selectedTrackParam] || TRACK_PRESETS.circuitoE;
  return new THREE.CatmullRomCurve3(trackPoints, true, 'centripetal', 0.5);
}

let trackCurve = getTrackCurve();
let currentTrackPoints = trackCurve.getSpacedPoints(150);
let trackWidth = 10;
const trackElementsGroup = new THREE.Group();
scene.add(trackElementsGroup);

const TRACK_SAMPLE_COUNT = 360;
const trackSamples = [];

function updateTrackSamples() {
  trackSamples.length = 0;
  for (let i = 0; i < TRACK_SAMPLE_COUNT; i++) {
    const t = i / TRACK_SAMPLE_COUNT;
    const point = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    trackSamples.push({ t, point, normal });
  }
  currentTrackPoints = trackCurve.getSpacedPoints(150);
}

updateTrackSamples();

function nearestTrackSample(position) {
  let best = trackSamples[0], bestDist = Infinity, bestIndex = 0;
  for (let i = 0; i < trackSamples.length; i++) {
    const d = trackSamples[i].point.distanceToSquared(position);
    if (d < bestDist) { bestDist = d; best = trackSamples[i]; bestIndex = i; }
  }
  return { sample: best, index: bestIndex };
}

function buildTrackMesh() {
  const segments = 500;
  const positions = [];
  const uvs = [];
  const indices = [];

  const points = trackCurve.getSpacedPoints(segments);
  const sideVectors = [];

  for (let i = 0; i <= segments; i++) {
    const pPrev = points[(i - 1 + segments) % segments];
    const pNext = points[(i + 1) % segments];

    const dir = new THREE.Vector3().subVectors(pNext, pPrev);
    dir.y = 0; dir.normalize();

    let side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

    if (i > 0) {
      const prevSide = sideVectors[i - 1];
      if (side.dot(prevSide) < 0) side.negate();
    }
    sideVectors.push(side);

    const current = points[i % segments];
    const left = current.clone().addScaledVector(side, trackWidth / 2);
    const right = current.clone().addScaledVector(side, -trackWidth / 2);

    positions.push(left.x, 0.03, left.z);
    positions.push(right.x, 0.03, right.z);

    const progress = i / segments;
    uvs.push(0, progress);
    uvs.push(1, progress);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2; const b = i * 2 + 1;
    const c = (i + 1) * 2; const d = (i + 1) * 2 + 1;
    indices.push(a, b, c); indices.push(b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

const trackTexCanvas = document.createElement('canvas');
trackTexCanvas.width = 256;
trackTexCanvas.height = 512;
const tctx = trackTexCanvas.getContext('2d');

// Fundo do asfalto
tctx.fillStyle = '#3a3a40';
tctx.fillRect(0, 0, 256, 512);

// Gerador de ruído processual (pedregulhos do asfalto)
for (let i = 0; i < 40000; i++) {
  tctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
  tctx.fillRect(Math.random() * 256, Math.random() * 512, 1, 1);
}

// Faixa central tracejada
tctx.strokeStyle = 'rgba(255,255,255,0.7)';
tctx.lineWidth = 4;
tctx.setLineDash([30, 30]);
tctx.beginPath();
tctx.moveTo(128, 0);
tctx.lineTo(128, 512);
tctx.stroke();

// Faixas laterais contínuas
tctx.strokeStyle = 'rgba(255,255,255,0.85)';
tctx.setLineDash([]);
tctx.lineWidth = 3;
tctx.beginPath();
tctx.moveTo(8, 0); tctx.lineTo(8, 512);
tctx.moveTo(248, 0); tctx.lineTo(248, 512);
tctx.stroke();

const trackTexture = new THREE.CanvasTexture(trackTexCanvas);
trackTexture.wrapS = THREE.RepeatWrapping;
trackTexture.wrapT = THREE.RepeatWrapping;
trackTexture.repeat.set(1, 10);
trackTexture.needsUpdate = true;

let trackMesh = null;
function buildAndAddTrackMesh() {
  trackMesh = new THREE.Mesh(
    buildTrackMesh(),
    new THREE.MeshStandardMaterial({
      map: trackTexture,
      roughness: 0.75, // Permite refletir levemente o sol
      metalness: 0.1,  // Tira o aspecto fosco
      side: THREE.DoubleSide
    })
  );
  trackMesh.receiveShadow = true;
  trackElementsGroup.add(trackMesh);
}

function createKerbTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const stripeWidth = 64;
  for (let i = 0; i < 256; i += stripeWidth) {
    ctx.fillStyle = (i / stripeWidth) % 2 === 0 ? '#d32f2f' : '#f5f5f5';
    ctx.fillRect(i, 0, stripeWidth, 256);
  }

  // Adiciona sujeira de pneu nas zebras
  for (let i = 0; i < 15000; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 1);
  return texture;
}

const kerbMaterial = new THREE.MeshStandardMaterial({
  map: createKerbTexture(),
  roughness: 0.7,
  metalness: 0.1
});

function addTrackKerbs() {
  const segments = 500;
  const kerbWidth = 0.8;
  const points = trackCurve.getSpacedPoints(segments);

  [-1, 1].forEach(sideSign => {
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
      const pPrev = points[(i - 1 + segments) % segments];
      const pNext = points[(i + 1) % segments];

      const dir = new THREE.Vector3().subVectors(pNext, pPrev);
      dir.y = 0;
      dir.normalize();

      const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const current = points[i % segments];

      const innerEdge = current.clone().addScaledVector(normal, sideSign * (trackWidth / 2));
      const outerEdge = current.clone().addScaledVector(normal, sideSign * (trackWidth / 2 + kerbWidth));

      positions.push(innerEdge.x, 0.035, innerEdge.z);
      positions.push(outerEdge.x, 0.035, outerEdge.z);

      const progress = i / segments;
      uvs.push(progress * 12, 0);
      uvs.push(progress * 12, 1);
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;

      if (sideSign === 1) {
        indices.push(a, b, c);
        indices.push(b, d, c);
      } else {
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const kerbMesh = new THREE.Mesh(geo, kerbMaterial);
    kerbMesh.receiveShadow = true;
    trackElementsGroup.add(kerbMesh);
  });
}

function createStripedGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const stripeHeight = 64;
  for (let i = 0; i < 512; i += stripeHeight) {
    ctx.fillStyle = (i / stripeHeight) % 2 === 0 ? '#3b8940' : '#2d6a31';
    ctx.fillRect(0, i, 512, stripeHeight);
  }

  // Ruído vertical para simular fios de grama
  for (let i = 0; i < 90000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 60);
  return texture;
}

const grassMat = new THREE.MeshStandardMaterial({
  map: createStripedGrassTexture(),
  roughness: 0.95, // Grama absorve luz
  metalness: 0.0
});

const grass = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), grassMat);
grass.rotation.x = -Math.PI / 2;
grass.position.y = -0.02;
grass.receiveShadow = true;
scene.add(grass);

function createStripedTireTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const stripeWidth = 16;
  for (let i = 0; i < 128; i += stripeWidth) {
    ctx.fillStyle = (i / stripeWidth) % 2 === 0 ? '#ffffff' : '#e53935';
    ctx.fillRect(i, 0, stripeWidth, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const blackTireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
const stripedTireMat = new THREE.MeshStandardMaterial({ map: createStripedTireTexture(), roughness: 0.8 });

function addTires() {
  const tireGeo = new THREE.TorusGeometry(0.5, 0.25, 12, 24);
  const tireCount = 120;
  for (let i = 0; i < tireCount; i++) {
    const t = i / tireCount;
    const point = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const currentMat = (i % 2 === 0) ? blackTireMat : stripedTireMat;

    for (const side of [1, -1]) {
      const pos = point.clone().addScaledVector(normal, side * (trackWidth / 2 + 3.5));
      const tireStack = new THREE.Group();

      const tireBottom = new THREE.Mesh(tireGeo, currentMat);
      tireBottom.rotation.x = Math.PI / 2;
      tireBottom.position.y = 0.25;
      tireBottom.castShadow = true;
      tireStack.add(tireBottom);

      const tireTop = tireBottom.clone();
      tireTop.position.y = 0.7;
      tireStack.add(tireTop);

      tireStack.position.set(pos.x, 0, pos.z);
      trackElementsGroup.add(tireStack);
    }
  }
}

function addStartFinishLine() {
  const point = trackCurve.getPointAt(0);
  const tangent = trackCurve.getTangentAt(0).normalize();
  const heading = Math.atan2(tangent.x, tangent.z);

  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const cctx = c.getContext('2d');
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 16; x++) {
      cctx.fillStyle = ((x + y) % 2 === 0) ? '#ffffff' : '#111111';
      cctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }

  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(trackWidth, 3.2),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.6 })
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.rotation.z = heading;
  stripe.position.set(point.x, 0.04, point.z);
  stripe.receiveShadow = true;
  trackElementsGroup.add(stripe);
}

const boostPadsList = [];
const boostPadMat = new THREE.MeshStandardMaterial({
  color: 0xfacc15,
  emissive: 0xca8a04,
  roughness: 0.3
});
const boostPadGeo = new THREE.PlaneGeometry(trackWidth * 0.75, 3.2);

function spawnBoostPads(customBoosts) {
  boostPadsList.length = 0;
  if (!customBoosts || !customBoosts.length) return;

  customBoosts.forEach(b => {
    const pt = trackCurve.getPointAt(b.t);
    const tangent = trackCurve.getTangentAt(b.t).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);

    const pad = new THREE.Mesh(boostPadGeo, boostPadMat);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = heading;
    pad.position.set(pt.x, 0.045, pt.z);
    trackElementsGroup.add(pad);

    boostPadsList.push({ position: new THREE.Vector3(pt.x, 0, pt.z) });
  });
}

function checkBoostPads() {
  if (!kart) return;
  for (const pad of boostPadsList) {
    if (kart.position.distanceTo(pad.position) < 3.5) {
      if (physics.turboTimer < 1.0) {
        physics.turboTimer = 1.3 * (physics.turboBonus || 1.0);
      }
    }
  }
}

buildAndAddTrackMesh();
addTrackKerbs();
addTires();
addStartFinishLine();
setupEnhancedEnvironment(scene);

function respawnTreesForTrack() {
  if (currentTreeGroup) {
    scene.remove(currentTreeGroup);
    currentTreeGroup.traverse(child => { if (child.geometry) child.geometry.dispose(); });
    currentTreeGroup = null;
  }

  currentTreeGroup = new THREE.Group();

  const treeCount = 120;
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 2.5, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
  const leavesGeo = new THREE.ConeGeometry(2, 5, 6);
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.8 });

  const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const leavesInstanced = new THREE.InstancedMesh(leavesGeo, leavesMat, treeCount);
  const dummy = new THREE.Object3D();

  let spawned = 0;
  let attempts = 0;
  const maxAttempts = 1500;
  const MIN_DISTANCE_FROM_TRACK = (trackWidth / 2) + 14.0;

  while (spawned < treeCount && attempts < maxAttempts) {
    attempts++;

    const radius = 35 + Math.random() * 220;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const treePos = new THREE.Vector3(x, 0, z);

    const { sample } = nearestTrackSample(treePos);
    const distToTrack = sample.point.distanceTo(treePos);

    if (distToTrack >= MIN_DISTANCE_FROM_TRACK) {
      const scale = 0.8 + Math.random() * 0.5;

      dummy.position.set(x, 1.25 * scale, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunkInstanced.setMatrixAt(spawned, dummy.matrix);

      dummy.position.set(x, (2.5 + 2.0) * scale, z);
      dummy.updateMatrix();
      leavesInstanced.setMatrixAt(spawned, dummy.matrix);

      spawned++;
    }
  }

  trunkInstanced.count = spawned;
  leavesInstanced.count = spawned;
  trunkInstanced.instanceMatrix.needsUpdate = true;
  leavesInstanced.instanceMatrix.needsUpdate = true;

  currentTreeGroup.add(trunkInstanced);
  currentTreeGroup.add(leavesInstanced);
  scene.add(currentTreeGroup);
}

async function loadCustomTrack(trackParam) {
  let trackData = null;

  if (trackParam === 'preview') {
    const raw = sessionStorage.getItem('pkart_custom_track_data');
    if (raw) {
      try { trackData = JSON.parse(raw); } catch (e) { console.error('Erro ao ler preview da pista:', e); }
    }
  } else if (typeof supabaseClient !== 'undefined') {
    try {
      const { data, error } = await supabaseClient
        .from('custom_tracks')
        .select('*')
        .eq('id', trackParam)
        .single();

      if (!error && data && data.track_data) {
        trackData = data.track_data;
      }
    } catch (err) {
      console.warn('Erro ao carregar pista customizada do Supabase:', err);
    }
  }

  if (trackData && trackData.points && trackData.points.length >= 3) {
    const pts = trackData.points.map(p => new THREE.Vector3(p.x, 0, p.z));
    trackCurve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    if (trackData.width) trackWidth = trackData.width;

    while (trackElementsGroup.children.length > 0) {
      const c = trackElementsGroup.children[0];
      trackElementsGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
    }

    updateTrackSamples();
    buildAndAddTrackMesh();
    addTrackKerbs();
    addTires();
    addStartFinishLine();
    spawnItemBoxes(trackData.items);
    respawnTreesForTrack();

    if (kart) {
      const grid = getGridPosition(playerSlotParam);
      kart.position.copy(grid.pos);
      kart.rotation.y = grid.heading;
      physics.heading = grid.heading;
      physics.speed = 0;
    }

    let botIndex = 1;
    for (const [id, bot] of remoteKarts.entries()) {
      if (bot.isBot) {
        const botGrid = getGridPosition(botIndex);
        bot.obj.group.position.copy(botGrid.pos);
        bot.obj.group.rotation.y = botGrid.heading;
        bot.heading = botGrid.heading;
        bot.speed = 0;
        bot.progress = 0;
        bot.lapCount = 1;
        bot.laneOffset = (Math.random() - 0.5) * (trackWidth - 3);
        botIndex++;
      }
    }
  }
}

if (customTrackParam) {
  loadCustomTrack(customTrackParam);
}

// ------------------------------------------------------------
// GRID DE LARGADA
// ------------------------------------------------------------
function getGridPosition(gridIndex) {
  const START_LINE_T = 0.98;
  const basePoint = trackCurve.getPointAt(START_LINE_T);
  const tangent = trackCurve.getTangentAt(START_LINE_T).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

  const row = Math.floor(gridIndex / 2);
  const col = gridIndex % 2;

  const lateralOffset = (col === 0 ? -1 : 1) * 2.2;
  const rowOffset = -row * 4.5;

  const pos = basePoint.clone()
    .addScaledVector(normal, lateralOffset)
    .addScaledVector(tangent, rowOffset);

  const heading = Math.atan2(tangent.x, tangent.z);

  return { pos, heading };
}

// ------------------------------------------------------------
// CARREGAMENTO 3D E FÍSICA DO KART
// ------------------------------------------------------------
const KART_MODEL_SCALE = 2.2;

async function loadKartTemplate(kartEntry, callback) {
  if (kartEntry.template) {
    if (callback) callback(kartEntry.template);
    return;
  }

  if (window.KART_ASSETS && window.KART_ASSETS[kartEntry.id]) {
    kartEntry.template = window.KART_ASSETS[kartEntry.id];
    if (callback) callback(kartEntry.template);
    return;
  }

  const loader = new THREE.GLTFLoader();
  if (typeof THREE.DRACOLoader !== 'undefined') {
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);
  }

  const targetCacheName = typeof CACHE_NAME !== 'undefined' ? CACHE_NAME : 'pkart-3d-models-v2';

  try {
    if ('caches' in window) {
      const cache = await caches.open(targetCacheName);
      const cachedResponse = await cache.match(kartEntry.modelUrl);
      if (cachedResponse) {
        const arrayBuffer = await cachedResponse.arrayBuffer();
        loader.parse(arrayBuffer, './models/', (gltf) => {
          if (!window.KART_ASSETS) window.KART_ASSETS = {};
          window.KART_ASSETS[kartEntry.id] = gltf.scene;
          kartEntry.template = gltf.scene;
          if (callback) callback(kartEntry.template);
        });
        return;
      }
    }
  } catch (err) {
    console.warn('[Game] Erro ao carregar Cache Storage:', err);
  }

  try {
    const response = await fetch(kartEntry.modelUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    if ('caches' in window) {
      try {
        const cache = await caches.open(targetCacheName);
        cache.put(kartEntry.modelUrl, response.clone());
      } catch (e) { }
    }

    const arrayBuffer = await response.arrayBuffer();
    loader.parse(arrayBuffer, './models/', (gltf) => {
      if (!window.KART_ASSETS) window.KART_ASSETS = {};
      window.KART_ASSETS[kartEntry.id] = gltf.scene;
      kartEntry.template = gltf.scene;
      if (callback) callback(kartEntry.template);
    });
  } catch (err) {
    console.error(`[GLB] Erro ao carregar ${kartEntry.name}:`, err);
    if (callback) callback(null);
  }
}

function applyModelToGroup(group, templateScene, chassisColor) {
  // Limpa os modelos 3D antigos, mas PRESERVA os efeitos visuais
  for (let i = group.children.length - 1; i >= 0; i--) {
    if (!group.children[i].userData.isEffect) {
      group.remove(group.children[i]);
    }
  }

  if (templateScene) {
    const instance = templateScene.clone(true);
    instance.scale.setScalar(KART_MODEL_SCALE);
    instance.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
    group.add(instance);
  } else {
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.9, 2.2),
      new THREE.MeshStandardMaterial({ color: chassisColor })
    );
    fallback.position.y = 0.45;
    group.add(fallback);
  }
}

// --- FUNÇÕES DE EFEITOS VISUAIS ---
function createShieldEffect() {
  const geo = new THREE.SphereGeometry(1.5, 32, 32);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00bfff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
  const shield = new THREE.Mesh(geo, mat);
  shield.visible = false;
  return shield;
}

function createPoisonEffect() {
  const group = new THREE.Group();
  const particleCount = 6;
  const geo = new THREE.SphereGeometry(0.2, 8, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xaa44ff,
    transparent: true,
    opacity: 0.75
  });

  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    const angle = (i / particleCount) * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * 1.0, 0.4, Math.sin(angle) * 1.0);
    group.add(mesh);
    particles.push({ mesh, angle, radius: 1.0 + Math.random() * 0.3 });
  }

  group.userData.particles = particles;
  group.visible = false;
  return group;
}

function createBoostEffect() {
  const group = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.25, 1.2, 8);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });

  const flameLeft = new THREE.Mesh(geo, mat);
  flameLeft.position.set(-0.4, 0.3, -1.2);
  const flameRight = new THREE.Mesh(geo, mat);
  flameRight.position.set(0.4, 0.3, -1.2);

  group.add(flameLeft, flameRight);
  group.visible = false;
  return group;
}

function createSurfEffect() {
  const group = new THREE.Group();

  // Cria dois anéis (ondas) que ficarão embaixo do kart
  const geo = new THREE.RingGeometry(0.8, 1.5, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00bfff, // Azul ciano brilhante
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const wave1 = new THREE.Mesh(geo, mat);
  wave1.rotation.x = -Math.PI / 2; // Deita no chão
  wave1.position.y = 0.1; // Pouco acima do chão

  const wave2 = new THREE.Mesh(geo, mat.clone());
  wave2.rotation.x = -Math.PI / 2;
  wave2.position.y = 0.05;

  group.add(wave1, wave2);
  group.userData.wave1 = wave1;
  group.userData.wave2 = wave2;
  group.visible = false;

  return group;
}

function createDigEffect() {
  const group = new THREE.Group();

  // Pequenos montes de terra/rochas girando ao redor do kart ou no chão
  const geo = new THREE.ConeGeometry(0.4, 0.8, 5);
  const mat = new THREE.MeshBasicMaterial({ color: 0x5c4033 }); // Marrom terra

  for (let i = 0; i < 3; i++) {
    const mound = new THREE.Mesh(geo, mat);
    const angle = (i / 3) * Math.PI * 2;
    mound.position.set(Math.cos(angle) * 1.2, 0.2, Math.sin(angle) * 1.2);
    group.add(mound);
  }

  group.visible = false;
  return group;
}

// --- ATUALIZE SUA FUNÇÃO CREATEKART ---
function createKart(chassisColor) {
  const group = new THREE.Group();
  scene.add(group);

  const shieldMesh = createShieldEffect();
  const poisonMesh = createPoisonEffect();
  const boostMesh = createBoostEffect();
  const surfMesh = createSurfEffect(); // NOVO EFEITO AQUÁTICO

  // Etiqueta os efeitos para o sistema saber que não deve deletá-los
  shieldMesh.userData.isEffect = true;
  poisonMesh.userData.isEffect = true;
  boostMesh.userData.isEffect = true;
  surfMesh.userData.isEffect = true;

  group.add(shieldMesh, poisonMesh, boostMesh, surfMesh);

  return { group, wheels: [], shieldMesh, poisonMesh, boostMesh, surfMesh };
}

let localKartObj, kart, wheels;

const physics = {
  velocity: new THREE.Vector3(),
  speed: 0,
  heading: 0,
  maxSpeed: 32,
  maxReverse: -10,
  accel: 22,
  brakeDecel: 30,
  friction: 10,
  turnSpeed: 2.4,
  driftFactor: 0,
  isDrifting: false,
  driftDirection: 0,
  driftCharge: 0,
  turboTimer: 0,
  stunTimer: 0,
  spinTimer: 0
};

let localKartLoaded = false;
let countdownStarted = false;

function checkAndStartCountdown() {
  if (localKartLoaded && !countdownStarted && !roomCodeParam) {
    countdownStarted = true;
    setTimeout(() => { startCountdown(); }, 1500);
  }
}

function setLocalKartModel(kartEntry) {
  loadKartTemplate(kartEntry, (template) => {
    if (!kart) {
      localKartObj = createKart(0xE53935);
      kart = localKartObj.group;
      wheels = localKartObj.wheels;
    }
    applyModelToGroup(kart, template, 0xE53935);

    if (kartEntry.stats) {
      physics.accel = kartEntry.stats.accel;
      physics.maxSpeed = kartEntry.stats.maxSpeed;
      physics.turnSpeed = kartEntry.stats.turnSpeed;
      physics.turboBonus = kartEntry.stats.turboBonus || 1.0;
      physics.driftRate = kartEntry.stats.driftRate || 1.0;
    }

    const grid = getGridPosition(playerSlotParam);
    kart.position.copy(grid.pos);
    kart.rotation.y = grid.heading;
    physics.heading = grid.heading;

    localKartLoaded = true;
    checkAndStartCountdown();
  });
}

setLocalKartModel(KART_DATABASE[selectedKartIndex]);

// ------------------------------------------------------------
// CONTROLES E CÂMERA
// ------------------------------------------------------------
let isPaused = false;
const pauseMenuEl = document.getElementById('pauseMenu');
const btnReturnLobbyEl = document.getElementById('btnReturnLobby');

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    isPaused = !isPaused;
    if (pauseMenuEl) pauseMenuEl.style.display = isPaused ? 'flex' : 'none';
  }
});

// --- NOVA FUNÇÃO DE PUNIÇÃO DA TORRE ---
function registrarDerrotaTorre() {
  const modeLocal = urlParams.get('mode');
  // Só pune se estiver no modo torre e a corrida ainda não tiver acabado legitimamente
  if (modeLocal === 'tower' && corridaAtivaParaPunicao) {
    localStorage.setItem('pkart_tower_result', 'lose');
    localStorage.removeItem('pkart_tower_state');
    localStorage.removeItem('pkart_pending_tower_save');

    // Tenta avisar o banco de dados antes da tela fechar
    if (typeof supabaseClient !== 'undefined' && typeof currentUserProfile !== 'undefined' && currentUserProfile) {
      currentUserProfile.tower_state = null;
      supabaseClient.from('profiles').update({ tower_state: null }).eq('id', currentUserProfile.id);
    }
  }
}

if (btnReturnLobbyEl) {
  btnReturnLobbyEl.onclick = () => {
    registrarDerrotaTorre(); // Aplica a derrota antes de sair
    corridaAtivaParaPunicao = false;
    window.location.href = 'index.html';
  };
}

const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// --- INTEGRAÇÃO MOBILE (GIROSCÓPIO + CONTROLES INVISÍVEIS) ---
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let gyroTurnInput = 0;
let mobileGasActive = false;
let mobileBrakeActive = false;

function setupMobileControls() {
  if (!isMobile) return;

  const controlsContainer = document.createElement('div');
  controlsContainer.id = 'mobileControls';
  controlsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; touch-action: none; display: flex; pointer-events: none;';

  const leftArea = document.createElement('div');
  leftArea.style.cssText = 'width: 50%; height: 100%; display: flex; flex-direction: column; pointer-events: auto;';

  const btnItem = document.createElement('div');
  btnItem.style.cssText = 'flex: 1; width: 100%; display: flex; align-items: center; justify-content: center;';

  const btnBrake = document.createElement('div');
  btnBrake.style.cssText = 'flex: 1; width: 100%; display: flex; align-items: center; justify-content: center;';

  leftArea.appendChild(btnItem);
  leftArea.appendChild(btnBrake);

  const btnGas = document.createElement('div');
  btnGas.style.cssText = 'width: 50%; height: 100%; pointer-events: auto; display: flex; align-items: center; justify-content: center;';

  controlsContainer.appendChild(leftArea);
  controlsContainer.appendChild(btnGas);
  document.body.appendChild(controlsContainer);

  btnGas.addEventListener('touchstart', (e) => { e.preventDefault(); mobileGasActive = true; });
  btnGas.addEventListener('touchend', (e) => { e.preventDefault(); mobileGasActive = false; });
  btnGas.addEventListener('touchcancel', (e) => { e.preventDefault(); mobileGasActive = false; });

  btnBrake.addEventListener('touchstart', (e) => { e.preventDefault(); mobileBrakeActive = true; });
  btnBrake.addEventListener('touchend', (e) => { e.preventDefault(); mobileBrakeActive = false; });
  btnBrake.addEventListener('touchcancel', (e) => { e.preventDefault(); mobileBrakeActive = false; });

  btnItem.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (currentItem && raceStarted) {
      useEquippedSkill(currentItem);
      currentItem = null;
      const iconEl = document.getElementById('itemIcon');
      if (iconEl) iconEl.innerHTML = ITEM_ICON_DEFAULT;
    }
  });
}

async function enableMobileExperience() {
  if (!isMobile) return;

  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }

    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(e => console.warn("Lock de rotação ignorado:", e));
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') return;
    }

    window.addEventListener('deviceorientation', (event) => {
      let tilt = event.beta;
      tilt = THREE.MathUtils.clamp(tilt, -40, 40);
      gyroTurnInput = -(tilt / 40);
    });

    setupMobileControls();

  } catch (err) {
    console.warn("Erro ao configurar modo mobile:", err);
  }
}

if (isMobile) {
  const startOverlay = document.createElement('div');
  startOverlay.id = 'mobileStartOverlay';
  startOverlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,0.95); color: #FFD54F; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; font-size: 22px; font-weight: bold; font-family: sans-serif; text-align: center; padding: 20px;';
  startOverlay.innerHTML = '🎮 MODO MOBILE ATIVADO<br><br><span style="font-size:16px; color:#38bdf8;">Toque na tela para travar a rotação e ativar o giroscópio</span>';
  document.body.appendChild(startOverlay);

  startOverlay.addEventListener('touchstart', (e) => {
    e.preventDefault();
    enableMobileExperience();
    startOverlay.remove();
  }, { once: true });
}

const ZOOM_LEVELS = [20];
let currentZoomIndex = 0;
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'c') {
    currentZoomIndex = (currentZoomIndex + 1) % ZOOM_LEVELS.length;
    camera.fov = ZOOM_LEVELS[currentZoomIndex];
    camera.updateProjectionMatrix();
  }
});

let raceStarted = false;
let countdownInProgress = false;

function startCountdown() {
  if (countdownInProgress || raceStarted) return;
  countdownInProgress = true;

  const overlay = document.getElementById('countdownOverlay');
  if (!overlay) return;

  let count = 3;
  overlay.style.display = 'flex';
  overlay.style.color = '#FFD54F';
  overlay.innerText = count;

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      overlay.innerText = count;
    } else if (count === 0) {
      overlay.innerText = 'GO!';
      overlay.style.color = '#4CAF50';
      raceStarted = true;
      raceStartTime = performance.now();
      lapStartTime = performance.now(); // Inicia o cronómetro da 1ª volta
      localLapTimes = []; // Limpa registos anteriores
    } else {
      clearInterval(timer);
      overlay.style.display = 'none';
      countdownInProgress = false;
    }
  }, 1000);
}

function updatePhysics(dt) {
  if (!kart || isPaused || !raceStarted) return;

  if (physics.spinTimer > 0) {
    physics.spinTimer -= dt;
    physics.speed = 0;
    kart.rotation.y += dt * 12;
    return;
  }

  if (physics.stunTimer > 0) {
    physics.stunTimer -= dt;
    physics.speed = 0;
    return;
  }

  if (isControlInverted) {
    controlInvertTimer -= dt;
    if (controlInvertTimer <= 0) isControlInverted = false;
  }

  const raceOver = raceTrackers.get('local')?.finished;

  const forward = !raceOver && (keys['KeyW'] || keys['ArrowUp'] || mobileGasActive);
  const backward = !raceOver && (keys['KeyS'] || keys['ArrowDown'] || mobileBrakeActive);

  let rawLeft = !raceOver && (keys['KeyA'] || keys['ArrowLeft']);
  let rawRight = !raceOver && (keys['KeyD'] || keys['ArrowRight']);

  const left = isControlInverted ? rawRight : rawLeft;
  const right = isControlInverted ? rawLeft : rawRight;
  const driftKey = !raceOver && keys['Space'];

  if (forward) physics.speed += physics.accel * dt;
  else if (backward) physics.speed -= physics.brakeDecel * dt;
  else {
    if (physics.speed > 0) physics.speed = Math.max(0, physics.speed - physics.friction * dt);
    else if (physics.speed < 0) physics.speed = Math.min(0, physics.speed + physics.friction * dt);
  }

  let currentMax = physics.maxSpeed;
  if (physics.turboTimer > 0) {
    physics.turboTimer -= dt;
    currentMax *= 1.4;
  }

  physics.speed = THREE.MathUtils.clamp(physics.speed, physics.maxReverse, currentMax);

  let turnInput = (left ? 1 : 0) - (right ? 1 : 0);

  if (physics.speed < -0.1) {
    turnInput *= -1;
  }

  if (isMobile) {
    if (Math.abs(gyroTurnInput) > 0.1) {
      turnInput = gyroTurnInput;
      if (physics.speed < -0.1) turnInput *= -1;
    } else {
      turnInput = 0;
    }
  }

  const movingFactor = THREE.MathUtils.clamp(Math.abs(physics.speed) / physics.maxSpeed, 0.2, 1);
  const canDrift = driftKey && (left || right) && Math.abs(physics.speed) > physics.maxSpeed * 0.35;

  if (turnInput !== 0 && !canDrift && physics.speed > 8) {
    const gripPenalty = 18 * (1.1 - (physics.grip || 0.7));
    physics.speed = Math.max(5, physics.speed - gripPenalty * dt);
  }

  if (canDrift && !backward) {
    if (!physics.isDrifting) {
      physics.isDrifting = true;
      physics.driftDirection = turnInput !== 0 ? Math.sign(turnInput) : (left ? 1 : -1);
      physics.driftCharge = 0;
    }
    physics.driftCharge += dt * (physics.driftRate || 1.0);

    const driftSteer = physics.turnSpeed * (physics.driftControl || 1.0);
    physics.heading += physics.driftDirection * driftSteer * 0.38 * movingFactor * dt;
    physics.driftFactor = Math.min(1, physics.driftFactor + dt * 2.5);
  } else {
    if (physics.isDrifting && physics.driftCharge > 0.8) {
      physics.turboTimer = 0.8;
    }
    physics.isDrifting = false;
    physics.driftCharge = 0;
    physics.driftFactor = Math.max(0, physics.driftFactor - dt * 3);

    physics.heading += turnInput * physics.turnSpeed * 0.45 * movingFactor * dt;
  }

  const slideBlend = physics.driftFactor * 0.45;
  const slipHeading = physics.heading - physics.driftDirection * slideBlend;
  const moveDir = new THREE.Vector3(Math.sin(slipHeading), 0, Math.cos(slipHeading));

  kart.position.addScaledVector(moveDir, physics.speed * dt);
  kart.rotation.y = physics.heading;

  enforceTrackBoundary();
}

function enforceTrackBoundary() {
  if (!kart) return;
  const { sample } = nearestTrackSample(kart.position);
  const offset = new THREE.Vector3().subVectors(kart.position, sample.point);
  const lateral = offset.dot(sample.normal);

  const halfWidth = trackWidth / 2;
  const kerbWidth = 0.8;
  const grassStart = halfWidth + kerbWidth;

  if (Math.abs(lateral) > grassStart && Math.abs(lateral) <= (grassStart + 3.2)) {
    const maxGrassSpeed = 10;
    // SE ESTIVER SURFANDO, IGNORA A PENALIDADE DE VELOCIDADE DA GRAMA!
    if (physics.speed > maxGrassSpeed && !physics.isSurfing) {
      physics.speed = THREE.MathUtils.lerp(physics.speed, maxGrassSpeed, 0.07);
    }
  }

  if (Math.abs(lateral) > (grassStart + 3.3)) {
    const sign = Math.sign(lateral);
    const along = offset.clone().addScaledVector(sample.normal, -lateral);
    kart.position.copy(sample.point.clone().add(along).addScaledVector(sample.normal, sign * (grassStart + 3.3)));
    physics.speed = 0;
  }
}

const camOffset = new THREE.Vector3(0, 3.5, -8);
const camOffsetReverse = new THREE.Vector3(0, 3.5, 10); // Câmera vai para a frente do kart
let wasLookingBack = false;

function updateCamera(dt) {
  if (!kart) return;

  const isLookingBack = keys['KeyQ'];

  // Se segurar Q, usa o offset da frente. Se soltar, usa o original (-8)
  const activeOffset = isLookingBack ? camOffsetReverse : camOffset;

  // A MESMA MATEMÁTICA ORIGINAL SUA QUE DEIXA O DRIFT SUAVE
  const desired = kart.position.clone().add(activeOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.heading));
  desired.y = kart.position.y + 5;

  // O "teleporte" instantâneo apenas para a câmera não atravessar o kart dando enjoo
  if (isLookingBack !== wasLookingBack) {
    camera.position.copy(desired);
    wasLookingBack = isLookingBack;
  } else {
    // O seu lerp original
    camera.position.lerp(desired, Math.min(1, dt * 4));
  }

  // O SEGREDO: Se estiver olhando para trás, manda a câmera focar 20 metros atrás da pista
  // Se estiver normal, foca no kart como no seu código original
  const lookOffset = isLookingBack ? new THREE.Vector3(0, 1.2, -20) : new THREE.Vector3(0, 1.2, 0);
  camera.lookAt(kart.position.clone().add(lookOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.heading)));
}

// ------------------------------------------------------------
// RASTRO DE DERRAPAGEM (marcas de pneu) E POEIRA DO DRIFT
// ------------------------------------------------------------
const skidMarks = [];
const dustParticles = [];
let skidSpawnTimer = 0;
const SKID_MARK_MAX = 240;

function spawnSkidMarkPair() {
  if (!kart) return;
  const headingQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), physics.heading);
  const rearOffset = new THREE.Vector3(0, 0, -1.05);
  const laterals = [-0.55, 0.55];

  laterals.forEach((lateralX) => {
    const localPos = rearOffset.clone().add(new THREE.Vector3(lateralX, 0, 0));
    localPos.applyQuaternion(headingQuat);
    const worldPos = kart.position.clone().add(localPos);
    worldPos.y = 0.035;

    const geo = new THREE.PlaneGeometry(0.22, 0.85);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -physics.heading;
    mesh.position.copy(worldPos);
    mesh.renderOrder = 1;
    scene.add(mesh);
    skidMarks.push({ mesh, life: 3.5, maxLife: 3.5 });
  });

  while (skidMarks.length > SKID_MARK_MAX) {
    const old = skidMarks.shift();
    scene.remove(old.mesh);
    old.mesh.geometry.dispose();
    old.mesh.material.dispose();
  }
}

function spawnDustPuff() {
  if (!kart) return;
  const count = 6;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.4;
    positions[i * 3 + 1] = Math.random() * 0.15;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    velocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.7));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xcbb98f, size: 0.26, transparent: true, opacity: 0.5, depthWrite: false });
  const points = new THREE.Points(geo, mat);

  const headingQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), physics.heading);
  const localPos = new THREE.Vector3(0, 0.15, -1.1).applyQuaternion(headingQuat);
  points.position.copy(kart.position.clone().add(localPos));

  scene.add(points);
  dustParticles.push({ points, velocities, age: 0, life: 0.9 });
}

function updateDriftEffects(dt) {
  if (kart && physics.isDrifting && Math.abs(physics.speed) > 5) {
    skidSpawnTimer += dt;
    if (skidSpawnTimer > 0.045) {
      spawnSkidMarkPair();
      spawnDustPuff();
      skidSpawnTimer = 0;
    }
  }

  for (let i = skidMarks.length - 1; i >= 0; i--) {
    const sm = skidMarks[i];
    if (!sm || !sm.mesh || !sm.mesh.material) continue; // SEGURANÇA
    sm.life -= dt;
    sm.mesh.material.opacity = Math.max(0, (sm.life / sm.maxLife) * 0.32);
    if (sm.life <= 0) {
      scene.remove(sm.mesh);
      if (sm.mesh.geometry) sm.mesh.geometry.dispose();
      if (sm.mesh.material) sm.mesh.material.dispose();
      skidMarks.splice(i, 1);
    }
  }

  for (let i = dustParticles.length - 1; i >= 0; i--) {
    const d = dustParticles[i];
    if (!d || !d.points || !d.points.geometry || !d.points.material) continue; // SEGURANÇA
    d.age += dt;
    const posAttr = d.points.geometry.attributes.position;
    if (posAttr) {
      for (let j = 0; j < d.velocities.length; j++) {
        posAttr.array[j * 3] += d.velocities[j].x * dt;
        posAttr.array[j * 3 + 1] += d.velocities[j].y * dt;
        posAttr.array[j * 3 + 2] += d.velocities[j].z * dt;
      }
      posAttr.needsUpdate = true;
    }
    d.points.material.opacity = Math.max(0, 0.5 * (1 - d.age / d.life));
    if (d.age >= d.life) {
      scene.remove(d.points);
      if (d.points.geometry) d.points.geometry.dispose();
      if (d.points.material) d.points.material.dispose();
      dustParticles.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------
// SISTEMA DE CORRIDA E CHECKPOINTS
// ------------------------------------------------------------
const TOTAL_LAPS = 3;
const raceTrackers = new Map();

function updateRaceTracker(key, position) {
  let tr = raceTrackers.get(key);
  const rawT = nearestTrackSample(position).sample.t;

  if (!tr) {
    let initialProgress = rawT > 0.5 ? rawT - 1.0 : rawT;
    tr = { lapCount: 1, lastRawT: rawT, progress: initialProgress, finished: false, finishTime: Infinity };
    raceTrackers.set(key, tr);
    return tr;
  }

  if (tr.finished) return tr;

  let deltaT = rawT - tr.lastRawT;

  if (deltaT < -0.5) deltaT += 1.0;
  else if (deltaT > 0.5) deltaT -= 1.0;

  if (Math.abs(deltaT) > 0.25) {
    deltaT = 0;
  }

  tr.lastRawT = rawT;
  const previousLap = tr.lapCount; // Guarda a volta anterior
  tr.progress += deltaT;
  tr.lapCount = Math.max(1, Math.floor(tr.progress) + 1);

  // Se o jogador local completou uma volta, guarda o tempo!
  if (key === 'local' && tr.lapCount > previousLap && previousLap <= TOTAL_LAPS) {
    const now = performance.now();
    localLapTimes.push(now - lapStartTime);
    lapStartTime = now; // Reinicia para a próxima volta
  }

  if (tr.lapCount > TOTAL_LAPS) {
    tr.finished = true;
    tr.finishTime = Date.now();
    tr.lapCount = TOTAL_LAPS;
  }

  return tr;
}

let localFinishNotified = false;
let finishLeaderboardEl = null;

async function showFinishOverlay(place) {
  corridaAtivaParaPunicao = false; // Desativa punição ao terminar corretamente

  // --- COLOQUE ESTE BLOCO LOGO AQUI ---
  const modeParam = urlParams.get('mode');
  if (modeParam === 'tower') {
    const currentFloor = parseInt(urlParams.get('floor') || '1', 10);
    const currentGymId = urlParams.get('gym') || '';
    const maxFloorsVal = parseInt(urlParams.get('maxFloors') || '5', 10);
    const leader = urlParams.get('leader') || '';
    const leaderKart = urlParams.get('leaderkart') || urlParams.get('leaderKart') || '';

    if (place === 1) {
      localStorage.setItem('pkart_tower_result', 'win');

      const nextFloor = currentFloor + 1;
      const towerState = { gymId: currentGymId, floor: nextFloor, maxFloors: maxFloorsVal };

      // 🛡️ Salva local e cria a "encomenda" garantida para o Lobby enviar ao Supabase
      localStorage.setItem('pkart_tower_state', JSON.stringify(towerState));
      localStorage.setItem('pkart_pending_tower_save', JSON.stringify(towerState));

      if (typeof supabaseClient !== 'undefined' && typeof currentUserProfile !== 'undefined' && currentUserProfile) {
        currentUserProfile.tower_state = towerState;
        supabaseClient.from('profiles').update({ tower_state: towerState }).eq('id', currentUserProfile.id);
      }
    } else {
      localStorage.setItem('pkart_tower_result', 'lose');
      localStorage.removeItem('pkart_tower_state');
    }
  }
  // -------------------------------------

  victorySound.play().catch(e => console.warn('Bloqueio de autoplay de áudio:', e));
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 150, spread: 100, origin: { y: 0.6 },
      colors: ['#facc15', '#38bdf8', '#ffffff'], zIndex: 99999
    });
  }

  const overlay = document.createElement('div');
  overlay.id = 'finishOverlay';
  overlay.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(11, 19, 41, 0.85); display: flex; flex-direction: column;
    align-items: center; justify-content: center; z-index: 9999; font-family: 'Segoe UI', Tahoma, sans-serif;
  `;

  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    #finishOverlay ::-webkit-scrollbar { width: 6px; }
    #finishOverlay ::-webkit-scrollbar-thumb { background: #38bdf8; border-radius: 4px; }
  `;
  overlay.appendChild(style);

  const card = document.createElement('div');
  card.style.cssText = `
    background: rgba(15, 23, 42, 0.85); 
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(56, 189, 248, 0.4); 
    border-radius: 20px; 
    padding: 32px 24px; 
    width: 380px; 
    box-shadow: 0 20px 50px rgba(0,0,0,0.8), inset 0 0 20px rgba(56, 189, 248, 0.1);
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  `;

  card.innerHTML = `
    <h2 style="margin:0; color:#FFD54F; font-size:26px; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">🏁 CORRIDA FINALIZADA</h2>
    <div style="width: 100%; text-align: center; background: rgba(15, 23, 42, 0.8); border: 1px solid #334155; border-radius: 8px; padding: 12px; box-sizing: border-box;">
       <div style="color:#94a3b8; font-size: 13px; margin-bottom: 4px;">Seu Tempo: <span id="finalTimeDisplay" style="color:#fff; font-weight:bold;">Processando...</span></div>
       <div id="rewardDisplay" style="font-size:15px; color:#facc15; font-weight:bold;">Sincronizando Recompensas...</div>
    </div>
  `;

  finishLeaderboardEl = document.createElement('div');
  finishLeaderboardEl.style.cssText = `
    width: 100%; display: flex; flex-direction: column; gap: 6px; 
    max-height: 220px; overflow-y: auto; padding-right: 4px;
  `;
  card.appendChild(finishLeaderboardEl);

  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 5px;';

  const baseBtnStyle = `border: none; padding: 12px; font-size: 14px; font-weight: bold; border-radius: 8px; cursor: pointer; width: 100%; transition: transform 0.1s;`;

  // Se for corrida Multiplayer
  if (typeof roomCodeParam !== 'undefined' && roomCodeParam) {
    const btnKeep = document.createElement('button');
    btnKeep.style.cssText = baseBtnStyle + 'background: #22c55e; color: #0f172a; box-shadow: 0 4px 0 #16a34a;';
    btnKeep.innerText = isHost ? 'Manter Sala e Voltar' : 'Voltar para a Sala';
    btnKeep.onmousedown = () => btnKeep.style.transform = 'translateY(4px)';
    btnKeep.onmouseup = () => btnKeep.style.transform = 'translateY(0)';
    btnKeep.onclick = () => window.location.href = `index.html?rejoin=${roomCodeParam}&host=${isHost}`;

    const btnLeave = document.createElement('button');
    btnLeave.style.cssText = baseBtnStyle + 'background: #ef4444; color: #fff; box-shadow: 0 4px 0 #b91c1c;';
    btnLeave.innerText = isHost ? 'Fechar Sala' : 'Sair da Sala';
    btnLeave.onmousedown = () => btnLeave.style.transform = 'translateY(4px)';
    btnLeave.onmouseup = () => btnLeave.style.transform = 'translateY(0)';
    btnLeave.onclick = () => {
      if (isHost && typeof executarSaidaDaSala === 'function') executarSaidaDaSala();
      window.location.href = 'index.html';
    };

    buttonsContainer.appendChild(btnKeep);
    buttonsContainer.appendChild(btnLeave);
  } else {
    // --- MODO SOLO / TORRE ---
    const isTower = modeParam === 'tower';

    // 🛡️ CORREÇÃO: Usa diretamente a variável "place === 1", ignorando delay do localStorage
    if (isTower && place === 1) {
      const currentFloor = parseInt(urlParams.get('floor') || '1', 10);
      const gymId = urlParams.get('gym') || '';
      const leader = urlParams.get('leader') || '';
      // Correção do case-sensitive para pegar o kart do líder corretamente
      const leaderKart = urlParams.get('leaderkart') || urlParams.get('leaderKart') || '';
      const maxFloorsVal = parseInt(urlParams.get('maxFloors') || '5', 10);

      const btnNextFloor = document.createElement('button');
      btnNextFloor.style.cssText = baseBtnStyle + 'background: linear-gradient(90deg, #22c55e, #16a34a); color: #fff; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);';
      btnNextFloor.innerHTML = '<span>Próximo Andar ➡️</span>';
      btnNextFloor.onmousedown = () => btnNextFloor.style.transform = 'translateY(4px)';
      btnNextFloor.onmouseup = () => btnNextFloor.style.transform = 'translateY(0)';

      btnNextFloor.onclick = () => {
        // Envia direto para o andar +1
        const targetFloor = currentFloor + 1;
        window.location.href = `game.html?nick=${urlParams.get('nick')}&kart=${urlParams.get('kart')}&slot=0&ai=hard&players=1&mode=tower&floor=${targetFloor}&gym=${gymId}&maxFloors=${maxFloorsVal}&leader=${encodeURIComponent(leader)}&leaderkart=${leaderKart}`;
      };
      buttonsContainer.appendChild(btnNextFloor);
    }

    // 🔥 NOVO: Botão "Jogar Novamente" (Aparece no Solo normal, ou se perder na Torre)
    if (!isTower) {
      const btnPlayAgain = document.createElement('button');
      btnPlayAgain.style.cssText = baseBtnStyle + 'background: linear-gradient(90deg, #facc15, #eab308); color: #451a03; box-shadow: 0 4px 15px rgba(250, 204, 21, 0.4); margin-bottom: 4px;';
      btnPlayAgain.innerHTML = '🔄 Jogar Novamente';
      btnPlayAgain.onmousedown = () => btnPlayAgain.style.transform = 'translateY(4px)';
      btnPlayAgain.onmouseup = () => btnPlayAgain.style.transform = 'translateY(0)';

      // Recarrega a página exatamente como está (mesma pista, kart e dificuldade)
      btnPlayAgain.onclick = () => window.location.reload();
      buttonsContainer.appendChild(btnPlayAgain);
    }

    const btnRestart = document.createElement('button');
    btnRestart.style.cssText = baseBtnStyle + 'background: linear-gradient(90deg, var(--accent, #8757ff), #0867d8); color: #fff; box-shadow: 0 4px 15px var(--glow, rgba(129,75,255,0.35));';
    btnRestart.innerText = 'Voltar ao Lobby';
    btnRestart.onmousedown = () => btnRestart.style.transform = 'translateY(4px)';
    btnRestart.onmouseup = () => btnRestart.style.transform = 'translateY(0)';
    btnRestart.onclick = () => window.location.href = 'index.html';
    buttonsContainer.appendChild(btnRestart);
  }

  card.appendChild(buttonsContainer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const finalTimeMs = Math.round(totalRaceTimeMs);
  // Calcula a volta mais rápida (se não houver, usa o tempo final como fallback de segurança)
  const bestLapMs = localLapTimes.length > 0 ? Math.round(Math.min(...localLapTimes)) : finalTimeMs;
  const formattedTime = formatTime(finalTimeMs);
  const formattedBestLap = formatRecordTime(bestLapMs); // Usa a mesma função de formatação de tempo
  let isNewRecord = false;
  let isNewLapRecord = false;

  if (typeof supabaseClient !== 'undefined' && typeof currentUserProfile !== 'undefined' && currentUserProfile) {
    try {
      const currentTrackId = customTrackParam || 'default';
      const { data: existingRecord } = await supabaseClient
        .from('track_records')
        .select('*')
        .eq('user_id', currentUserProfile.id)
        .eq('track_id', currentTrackId)
        .single();

      if (!existingRecord) {
        await supabaseClient.from('track_records').insert({
          user_id: currentUserProfile.id,
          track_id: currentTrackId,
          best_time_ms: finalTimeMs,
          best_lap_ms: bestLapMs,
          kart_id: selectedKartId
        });
        isNewRecord = true;
        isNewLapRecord = true;
      } else {
        // Atualiza os tempos separadamente. Só atualiza se bateu o recorde específico.
        const updates = { kart_id: selectedKartId, created_at: new Date() };

        if (finalTimeMs < existingRecord.best_time_ms) {
          updates.best_time_ms = finalTimeMs;
          isNewRecord = true;
        }

        if (!existingRecord.best_lap_ms || bestLapMs < existingRecord.best_lap_ms) {
          updates.best_lap_ms = bestLapMs;
          isNewLapRecord = true;
        }

        // Só faz a chamada à DB se houver algo para atualizar
        if (isNewRecord || isNewLapRecord) {
          await supabaseClient.from('track_records').update(updates).eq('id', existingRecord.id);
        }
      }
    } catch (err) { }
  }

  // Atualiza o HTML para mostrar ambos os tempos
  document.getElementById('finalTimeDisplay').innerHTML = `
      ${formattedTime} ${isNewRecord ? '<span style="color:#22c55e; margin-left: 5px;">🔥 NOVO RECORDE TOTAL!</span>' : ''}
      <br>
      <span style="color:#94a3b8; font-size: 11px;">Volta mais rápida: <span style="color:#fff;">${formattedBestLap}</span> ${isNewLapRecord ? '<span style="color:#38bdf8;">⚡ RECORDE DE VOLTA!</span>' : ''}</span>
    `;
  // --- CÁLCULO DE MOEDAS E XP (PASSE DE BATALHA) ---
  const currentTrackDifficulty = urlParams.get('difficulty') || 'easy'; // 'easy', 'normal', 'hard'
  const TRACK_DIFFICULTY_MULTIPLIERS = { easy: 1.0, normal: 1.5, hard: 2.5 };
  const trackMultiplier = TRACK_DIFFICULTY_MULTIPLIERS[currentTrackDifficulty] || 1.0;

  const baseCoinsByPosition = { 1: 120, 2: 80, 3: 50, 4: 25 };
  const baseCoins = baseCoinsByPosition[place] || 20;
  const totalCoinsEarned = Math.round(baseCoins * trackMultiplier);

  // Define XP baseado na posição e multiplica pela dificuldade
  const baseXPByPosition = { 1: 50, 2: 30, 3: 20, 4: 10 };
  const earnedXP = Math.round((baseXPByPosition[place] || 10) * trackMultiplier);

  let updatePayload = {}; // Objeto para atualizar o Supabase em 1 única chamada!

  if (typeof currentUserProfile !== 'undefined' && currentUserProfile) {
    // 1. Atualiza Moedas
    const novoSaldoCoins = (currentUserProfile.coins || 0) + totalCoinsEarned;
    currentUserProfile.coins = novoSaldoCoins;
    updatePayload.coins = novoSaldoCoins;

    // 2. Atualiza XP do Passe de Batalha
    const novoXP = (currentUserProfile.xp || 0) + earnedXP;
    currentUserProfile.xp = novoXP;
    updatePayload.xp = novoXP;

    // 3. Gatilho de Conquistas (Achievements)
    let unlockedAchvs = currentUserProfile.unlocked_achievements || [];
    if (typeof unlockedAchvs === 'string') {
      try { unlockedAchvs = JSON.parse(unlockedAchvs); } catch (e) { unlockedAchvs = []; }
    }
    let achvsModified = false;

    const checkUnlock = (id) => {
      if (!unlockedAchvs.includes(id)) {
        unlockedAchvs.push(id);
        achvsModified = true;
      }
    };

    if (place === 1) checkUnlock('first_win');
    if (typeof roomCodeParam !== 'undefined' && roomCodeParam) checkUnlock('social');
    if (urlParams.get('mode') === 'tower' && place === 1) checkUnlock('tower_climber');
    if (novoSaldoCoins >= 2000) checkUnlock('rich');

    if (achvsModified) {
      currentUserProfile.unlocked_achievements = unlockedAchvs;
      updatePayload.unlocked_achievements = unlockedAchvs;
    }

    // 4. Progresso de Missões Diárias
    if (currentUserProfile.daily_missions && currentUserProfile.daily_missions.list) {
      let missionsModified = false;
      const modeLocalParam = urlParams.get('mode');

      currentUserProfile.daily_missions.list.forEach(mission => {
        if (mission.claimed) return; // Se já resgatou, ignora

        let fezProgresso = false;
        if (mission.id === 'm_play') fezProgresso = true;
        if (mission.id === 'm_win' && place === 1) fezProgresso = true;
        if (mission.id === 'm_solo' && modeLocalParam !== 'tower' && !roomCodeParam) fezProgresso = true;
        if (mission.id === 'm_multi' && roomCodeParam) fezProgresso = true;
        if (mission.id === 'm_tower' && modeLocalParam === 'tower' && place === 1) fezProgresso = true;

        if (fezProgresso) {
          mission.progress += 1;
          missionsModified = true;
        }
      });

      if (missionsModified) {
        updatePayload.daily_missions = currentUserProfile.daily_missions;
      }
    }

    // 5. Salva TUDO no banco de dados de uma vez (Performance++)
    if (typeof supabaseClient !== 'undefined' && Object.keys(updatePayload).length > 0) {
      supabaseClient.from('profiles').update(updatePayload).eq('id', currentUserProfile.id).then(({ error }) => {
        if (error) console.error('Erro ao salvar progresso da corrida:', error);
      });
    }
  }

  // Monta o HTML base de recompensas visuais
  let rewardHTML = `
    <div style="color:#facc15; font-size:16px;">💰 +${totalCoinsEarned} Moedas <span style="font-size:11px; color:#94a3b8;">(${currentTrackDifficulty.toUpperCase()} ${trackMultiplier}x)</span></div>
    <div style="color:#21c7ff; font-size:14px; margin-top: 4px;">⭐ +${earnedXP} XP <span style="font-size:11px; color:#94a3b8;">(Passe)</span></div>
  `;

  // REQUISITO ATUALIZADO: Apenas ranca/ganha troféus se for sala multiplayer COM EXATAMENTE 4 JOGADORES REAIS
  const isRankedMatch = typeof roomCodeParam !== 'undefined' && roomCodeParam && roomCodeParam.trim() !== '' && totalPlayersParam === 4;

  if (typeof supabaseClient !== 'undefined' && isRankedMatch) {
    try {
      const { data, error } = await supabaseClient.rpc('processar_trofeus_partida', {
        posicao_final: place
      });

      if (error) throw error;

      if (data && data.success) {
        const ganhoTrofeus = data.delta_trofeus > 0 ? `+${data.delta_trofeus}` : data.delta_trofeus;
        const corRank = data.delta_trofeus >= 0 ? '#22c55e' : '#ef4444';

        rewardHTML += `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);"><span style="color:${corRank}">${ganhoTrofeus} 🏆</span> <span style="color:#94a3b8; font-size: 11px;">(Rank Total: ${data.new_trophies})</span></div>`;

        if (data.promoted) {
          sessionStorage.setItem('pending_promotion', JSON.stringify({
            trophies: data.new_trophies,
            league: data.league
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao processar troféus:', err);
    }
  }

  document.getElementById('rewardDisplay').innerHTML = rewardHTML;
}

// ------------------------------------------------------------
// POKÉBOLAS, ARMADILHAS E HABILIDADES NO (E)
// ------------------------------------------------------------
const ITEM_ICON_DEFAULT = '<svg viewBox="0 0 24 24" width="30" height="30"><circle cx="12" cy="12" r="10" fill="none" stroke="#3a5a78" stroke-width="1.6"/><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="#8da5bd" font-family="Arial, sans-serif">?</text></svg>';

const SKILLS = {
  TURBO: {
    id: 'TURBO', name: 'Aceleração de Fogo',
    icon: '<div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; font-size: 36px; line-height: 1;">🔥</div>'
  },
  ICE: {
    id: 'ICE', name: 'Gelo na Pista',
    icon: '<svg viewBox="0 0 24 24" width="34" height="34" stroke="#8fe3ff" stroke-width="1.8" fill="none" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="4" y1="7" x2="20" y2="17"/><line x1="20" y1="7" x2="4" y2="17"/></svg>'
  },
  LODO: {
    id: 'LODO', name: 'Lodo Obscuro',
    icon: '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 2c4 5 7 9 7 13a7 7 0 0 1-14 0c0-4 3-8 7-13z" fill="#6a2fa0"/></svg>'
  },
  SHIELD: {
    id: 'SHIELD', name: 'Proteção',
    icon: '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z" fill="rgba(40,201,255,0.25)" stroke="#28c9ff" stroke-width="1.8"/></svg>'
  },
  CHOQUE: {
    id: 'CHOQUE', name: 'Trovoada Elétrica',
    icon: '<svg viewBox="0 0 24 24" width="34" height="34"><polygon points="13,2 4,14 11,14 9,22 20,9 12,9" fill="#ffd43b"/></svg>'
  },
  FUMACA: {
    id: 'FUMACA', name: 'Cortina de Fumaça',
    icon: '<svg viewBox="0 0 24 24" width="34" height="34"><circle cx="7" cy="15" r="3.2" fill="#9aa7b3" opacity="0.85"/><circle cx="12" cy="12" r="4" fill="#9aa7b3" opacity="0.85"/><circle cx="17" cy="15" r="3.2" fill="#9aa7b3" opacity="0.85"/></svg>'
  },
  SURF: {
    id: 'SURF', name: 'Surf Aquático',
    icon: '<div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; font-size: 34px;">🌊</div>'
  },
  LAMA: {
    id: 'LAMA', name: 'Ataque de Lama',
    icon: '<div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; font-size: 34px;">💩</div>'
  },
  DIG: {
    id: 'DIG', name: 'Ataque Cavar',
    icon: '<div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; font-size: 34px;">⛏️</div>'
  },
};

let currentItem = null;
let isShieldActive = false;
let isControlInverted = false;
let controlInvertTimer = 0;

function createPokeballTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#e53935'; ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#212121'; ctx.fillRect(0, 58, 128, 12);
  ctx.beginPath(); ctx.arc(64, 64, 20, 0, Math.PI * 2); ctx.fillStyle = '#212121'; ctx.fill();
  ctx.beginPath(); ctx.arc(64, 64, 12, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

const pokeballMat = new THREE.MeshStandardMaterial({
  map: createPokeballTexture(),
  roughness: 0.3,
  metalness: 0.1
});

const iceTrapMat = new THREE.MeshStandardMaterial({
  map: createIceTexture(), transparent: true, roughness: 0.15, depthWrite: false, side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
});
const lodoTrapMat = new THREE.MeshStandardMaterial({
  map: createMudTexture(), transparent: true, roughness: 0.85, depthWrite: false, side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
});
const smokeHazeMat = new THREE.MeshBasicMaterial({
  map: createSmokeHazeTexture(),
  transparent: true,
  opacity: 0.99, // Aumentado para dar mais destaque
  depthWrite: false,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4
});

const fumacaCoreMat = new THREE.MeshStandardMaterial({
  color: 0x111111,
  transparent: true,
  opacity: 0.85,
  roughness: 1.0,
  depthWrite: false
});

const itemBoxes = [];
const sphereGeo = new THREE.SphereGeometry(0.45, 16, 16);

function spawnItemBoxes(customItems) {
  itemBoxes.forEach(b => {
    if (b.mesh) scene.remove(b.mesh);
  });
  itemBoxes.length = 0;

  let samplePoints = [0.15, 0.40, 0.65, 0.88];
  if (customItems && customItems.length > 0) {
    samplePoints = customItems.map(it => it.t);
  }

  let boxId = 0;

  samplePoints.forEach(t => {
    const point = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    [-2.8, 0, 2.8].forEach(offset => {
      const mesh = new THREE.Mesh(sphereGeo, pokeballMat);
      const pos = point.clone().addScaledVector(normal, offset);
      mesh.position.set(pos.x, 0.6, pos.z);
      mesh.rotation.z = Math.PI / 6;
      mesh.castShadow = true;
      scene.add(mesh);

      itemBoxes.push({
        id: boxId++,
        mesh: mesh,
        baseY: 0.6,
        active: true,
        respawnTimer: 0
      });
    });
  });
}
spawnItemBoxes();

function disableItemBox(boxId) {
  const box = itemBoxes.find(b => b.id === boxId);
  if (box && box.active) {
    box.active = false;
    box.mesh.visible = false;
    box.respawnTimer = 5.0;
  }
}

function updateItemBoxes(dt) {
  itemBoxes.forEach(box => {
    if (!box.active) {
      box.respawnTimer -= dt;
      if (box.respawnTimer <= 0) {
        box.active = true; box.mesh.visible = true;
      }
      return;
    }

    box.mesh.rotation.y += dt * 2.0;
    box.mesh.position.y = box.baseY + Math.sin(performance.now() * 0.005) * 0.15;

    if (kart && box.mesh.position.distanceTo(kart.position) < 1.6) {
      disableItemBox(box.id);
      sendNetworkEvent({ t: 'take_box', boxId: box.id });
      if (!currentItem) getItemFromBox();
      return;
    }

    for (const [id, bot] of remoteKarts.entries()) {
      if (bot.isBot && !bot.finished && box.mesh.position.distanceTo(bot.obj.group.position) < 1.6) {
        disableItemBox(box.id);
        if (!bot.currentItem) {
          const skillKeys = Object.keys(SKILLS);
          bot.currentItem = SKILLS[skillKeys[Math.floor(Math.random() * skillKeys.length)]];
          bot.itemUseTimer = 1.0 + Math.random() * 2.0;
        }
        break;
      }
    }
  });
}

function getItemFromBox() {
  let skillKeys = Object.keys(SKILLS);

  // Calcula a posição atual do jogador na corrida
  const racers = updateStandings();
  const myRank = racers.findIndex(r => r.key === 'local') + 1;

  // Se estiver em 1º lugar, remove o 'DIG' da lista de itens disponíveis no sorteio
  if (myRank === 1) {
    skillKeys = skillKeys.filter(key => key !== 'DIG');
  }

  const randomKey = skillKeys[Math.floor(Math.random() * skillKeys.length)];
  currentItem = SKILLS[randomKey];

  const iconEl = document.getElementById('itemIcon');
  if (iconEl) iconEl.innerHTML = currentItem.icon;
}

const placedTraps = [];
let trapNextId = 0;

function createTrapMesh(trapData) {
  if (trapData.type === 'FUMACA') {
    const group = new THREE.Group();
    group.position.set(trapData.x, 0, trapData.z);
    scene.add(group);

    // Gera a nuvem volumétrica forçando a cor escura em todas as partículas
    for (let p = 0; p < 20; p++) {
      spawnAmbientPuff(new THREE.Vector3(trapData.x, 0.2, trapData.z), {
        color: 0x222225,       // Cor cinza-escura firme
        opacity: 0.4,         // Altamente opaca para não esbranquiçar
        scale: 3.5,            // Bem volumosa
        scaleVariance: 1.2,
        riseSpeed: 0.12,
        riseVariance: 0.15,
        growth: 0.5,
        life: 2.8,             // Tempo de duração prolongado
        spread: 2.4            // Bem distribuída
      });
    }

    placedTraps.push({
      id: trapData.id,
      mesh: group,
      type: trapData.type,
      active: true,
      puffTimer: 0,
      life: 12.0
    });
    return;
  } else {
    // Se for LODO
    if (trapData.type === 'LODO') {
      const group = new THREE.Group();
      const count = 6;

      for (let i = 0; i < count; i++) {
        const radius = i === 0 ? 0.55 : (0.18 + Math.random() * 0.28);
        const geo = new THREE.CircleGeometry(radius, 24);
        geo.rotateX(-Math.PI / 2);

        const mat = lodoTrapMat.clone();
        mat.opacity = 0.95;

        const mesh = new THREE.Mesh(geo, mat);

        const angle = Math.random() * Math.PI * 2;
        const dist = i === 0 ? 0 : 0.5 + Math.random() * 1.4;
        const offsetX = i === 0 ? 0 : Math.cos(angle) * dist;
        const offsetZ = i === 0 ? 0 : Math.sin(angle) * dist;

        mesh.position.set(offsetX, 0.04, offsetZ);
        mesh.renderOrder = 1;
        group.add(mesh);
      }

      group.position.set(trapData.x, 0, trapData.z);
      scene.add(group);

      placedTraps.push({
        id: trapData.id,
        mesh: group,
        type: trapData.type,
        active: true,
        puffTimer: 0
      });
      return;
    }

    // Se for GELO (ICE) - agora com o mesmo estilo de placas espalhadas
    if (trapData.type === 'ICE') {
      const group = new THREE.Group();
      const count = 5;

      for (let i = 0; i < count; i++) {
        const radius = i === 0 ? 0.6 : (0.2 + Math.random() * 0.3);
        const geo = new THREE.CircleGeometry(radius, 24);
        geo.rotateX(-Math.PI / 2);

        const mat = iceTrapMat.clone();
        mat.opacity = 0.85;

        const mesh = new THREE.Mesh(geo, mat);

        const angle = Math.random() * Math.PI * 2;
        const dist = i === 0 ? 0 : 0.4 + Math.random() * 1.2;
        const offsetX = i === 0 ? 0 : Math.cos(angle) * dist;
        const offsetZ = i === 0 ? 0 : Math.sin(angle) * dist;

        mesh.position.set(offsetX, 0.04, offsetZ);
        mesh.renderOrder = 1;
        group.add(mesh);
      }

      group.position.set(trapData.x, 0, trapData.z);
      scene.add(group);

      placedTraps.push({
        id: trapData.id,
        mesh: group,
        type: trapData.type,
        active: true,
        puffTimer: 0
      });
      return;
    }
  }
}

function dropTrapOnTrack(type) {
  if (!kart) return;

  const backVector = new THREE.Vector3(0, 0, -2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.heading);
  const trapPos = kart.position.clone().add(backVector);

  const trapData = {
    id: playerSlotParam + '-' + (trapNextId++),
    x: trapPos.x,
    z: trapPos.z,
    type: type
  };

  createTrapMesh(trapData);
  sendNetworkEvent({ t: 'spawn_trap', trap: trapData });
}

function removeTrapMesh(trapId) {
  const index = placedTraps.findIndex(t => t.id === trapId);
  if (index !== -1) {
    scene.remove(placedTraps[index].mesh);
    placedTraps.splice(index, 1);
  }
}

function updateTraps(dt) {
  placedTraps.forEach((trap) => {
    if (!trap.active) return;
    // Faz a fumaça (ou armadilha com tempo) sumir após expirar
    if (trap.life !== undefined) {
      trap.life -= dt;
      if (trap.life <= 0) {
        trap.active = false;
        removeTrapMesh(trap.id);
        return; // Sai do loop para essa armadilha
      }
    }

    if (trap.type === 'FUMACA') {
      trap.puffTimer += dt;
      if (trap.puffTimer > 0.32) {
        trap.puffTimer = 0;
        spawnAmbientPuff(trap.mesh.position.clone().setY(0.15), {
          color: 0x222225, opacity: 1, scale: 0.9, scaleVariance: 0.8,
          riseSpeed: 0.4, riseVariance: 0.25, growth: 0.8, growthVariance: 0.8,
          life: 1.6, lifeVariance: 0.9, spread: 1.9
        });
      }
    } else if (trap.type === 'LODO') {
      trap.puffTimer += dt;
      if (trap.puffTimer > 0.9) {
        trap.puffTimer = 0;
        spawnAmbientPuff(trap.mesh.position.clone().setY(0.06), {
          color: 0xcfa8ff, opacity: 0.4, scale: 0.16, scaleVariance: 0.1,
          riseSpeed: 0.15, riseVariance: 0.1, growth: 0.05, growthVariance: 0.05,
          life: 0.7, lifeVariance: 0.3, spread: 1.2
        });
      }
    }

    const hitRadius = trap.type === 'FUMACA' ? 2.0 : 1.8;

    if (kart && trap.mesh.position.distanceTo(kart.position) < hitRadius) {
      if (trap.type !== 'FUMACA') {
        trap.active = false;
        removeTrapMesh(trap.id);
        sendNetworkEvent({ t: 'destroy_trap', trapId: trap.id });
      }
      if (!isShieldActive) {
        if (trap.type === 'ICE') { physics.speed = 0; physics.spinTimer = 0.8; }
        else if (trap.type === 'LODO') { isControlInverted = true; controlInvertTimer = 3.0; }
        else if (trap.type === 'FUMACA') { physics.speed *= 0.85; }
      }
    }

    for (const [id, bot] of remoteKarts.entries()) {
      if (!bot.isBot || bot.finished || !trap.active) continue;

      if (trap.mesh.position.distanceTo(bot.obj.group.position) < hitRadius) {
        if (trap.type !== 'FUMACA') {
          trap.active = false;
          removeTrapMesh(trap.id);
        }
        if (bot.shieldTimer <= 0) {
          if (trap.type === 'ICE') { bot.speed = 0; bot.spinTimer = 0.8; }
          else if (trap.type === 'LODO') { bot.speed *= 0.4; bot.poisonTimer = 3.0; }
          else if (trap.type === 'FUMACA') { bot.speed *= 0.85; }
        }
        break;
      }
    }
  });
}

function triggerSparkEffect(targetPos) {
  const pGroup = new THREE.Group();
  const pGeo = new THREE.BufferGeometry();
  const pCount = 20;
  const posArray = new Float32Array(pCount * 3);

  for (let i = 0; i < pCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 1.5;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xffff00, size: 0.3 });
  const pSystem = new THREE.Points(pGeo, pMat);
  pGroup.add(pSystem);
  pGroup.position.copy(targetPos);
  scene.add(pGroup);

  let timer = 0;
  const interval = setInterval(() => {
    timer += 0.1;
    pSystem.rotation.y += 0.5;
    if (timer >= 1.0) {
      clearInterval(interval);
      scene.remove(pGroup);
    }
  }, 50);
}

function castShockAbility() {
  if (!kart) return;
  const myProgress = raceTrackers.get('local')?.progress || 0;
  let targetPeerId = null;

  let bestAheadProgress = Infinity;
  for (const [pid, entry] of remoteKarts.entries()) {
    if (!entry.finished && entry.progress > myProgress && entry.progress < bestAheadProgress) {
      bestAheadProgress = entry.progress;
      targetPeerId = pid;
    }
  }

  if (!targetPeerId) {
    let bestBehindProgress = -1;
    for (const [pid, entry] of remoteKarts.entries()) {
      if (!entry.finished && entry.progress < myProgress && entry.progress > bestBehindProgress) {
        bestBehindProgress = entry.progress;
        targetPeerId = pid;
      }
    }
  }

  if (targetPeerId) {
    const tBot = remoteKarts.get(targetPeerId);
    if (tBot && tBot.isBot) {
      if (tBot.shieldTimer <= 0) {
        tBot.stunTimer = 1.0;
        triggerSparkEffect(tBot.obj.group.position);
      }
    } else {
      sendNetworkEvent({ t: 'apply_stun', targetId: targetPeerId });
    }
  }
}

function castMudAbility() {
  if (!kart) return;
  const myProgress = raceTrackers.get('local')?.progress || 0;
  let targetPeerId = null;
  let bestAheadProgress = Infinity;

  // Procura o adversário imediatamente à frente
  for (const [pid, entry] of remoteKarts.entries()) {
    if (!entry.finished && entry.progress > myProgress && entry.progress < bestAheadProgress) {
      bestAheadProgress = entry.progress;
      targetPeerId = pid;
    }
  }

  if (targetPeerId) {
    const tBot = remoteKarts.get(targetPeerId);
    if (tBot && tBot.isBot) {
      if (tBot.shieldTimer <= 0) {
        // Punição para Bots: Corta velocidade e faz o bot perder o traçado
        tBot.speed *= 0.6;
        tBot.laneOffset += (Math.random() > 0.5 ? 4 : -4);
      }
    } else {
      // Dispara o evento de rede para o jogador real
      sendNetworkEvent({ t: 'apply_mud', targetId: targetPeerId });
    }
  }
}

function castDigAbility(casterId = 'local') {
  let leaderId = null;
  let maxProgress = -1;

  const localTracker = raceTrackers.get('local');
  if (localTracker && !localTracker.finished) {
    maxProgress = localTracker.progress;
    leaderId = 'local';
  }

  for (const [pid, entry] of remoteKarts.entries()) {
    if (!entry.finished && entry.progress > maxProgress) {
      maxProgress = entry.progress;
      leaderId = pid;
    }
  }

  // Se o líder for o próprio atirador (você ou o bot), ele mira no 2º lugar
  if (leaderId === casterId) {
    let secondBest = -1;
    leaderId = null;

    if (casterId !== 'local' && localTracker && !localTracker.finished) {
      secondBest = localTracker.progress;
      leaderId = 'local';
    }

    for (const [pid, entry] of remoteKarts.entries()) {
      if (pid !== casterId && !entry.finished && entry.progress > secondBest) {
        secondBest = entry.progress;
        leaderId = pid;
      }
    }
  }

  if (leaderId) {
    // Spawna saindo do atirador correto
    spawnDigProjectile(casterId, leaderId);

    // Avisa a rede
    if (casterId === 'local') {
      sendNetworkEvent({ t: 'spawn_dig', casterId: 'local', targetId: leaderId });
    } else if (typeof isHost !== 'undefined' && isHost) {
      broadcastEvent({ t: 'spawn_dig', casterId: casterId, targetId: leaderId });
    }
  }
}

function triggerDigExplosion(targetId) {
  let targetKartObj = null;

  if (targetId === 'local') {
    physics.speed = 0;       // Zera a velocidade completamente
    physics.stunTimer = 1.0; // Fica atordoado por 1s
    if (kart) targetKartObj = kart;
  } else if (remoteKarts.has(targetId)) {
    targetKartObj = remoteKarts.get(targetId).obj.group;
  }

  if (targetKartObj) {
    // 🔥 TRAVA DE SEGURANÇA: Se já estiver pulando, ignora novos impactos
    if (targetKartObj.userData.isJumping) return;

    // Tranca o cadeado
    targetKartObj.userData.isJumping = true;

    const startY = targetKartObj.position.y;
    const startRotX = targetKartObj.rotation.x;
    const startRotZ = targetKartObj.rotation.z;

    let jumpTime = 0;

    const jumpInterval = setInterval(() => {
      // Ajuste o 0.05 para um valor menor (ex: 0.03) se quiser que ele fique mais tempo no ar
      jumpTime += 0.05;

      // 1. Pula para o alto
      targetKartObj.position.y = startY + Math.sin(jumpTime * Math.PI) * 3.5;

      // 2. Efeito de TREMOR
      if (jumpTime < 1) {
        targetKartObj.rotation.x = startRotX + (Math.random() - 0.5) * 0.5;
        targetKartObj.rotation.z = startRotZ + (Math.random() - 0.5) * 0.5;
      }

      if (jumpTime >= 1) {
        clearInterval(jumpInterval);

        // Abre o cadeado novamente
        targetKartObj.userData.isJumping = false;

        if (targetId === 'local' || remoteKarts.has(targetId)) {
          // Crava o kart no chão original com exatidão
          targetKartObj.position.y = startY;
          targetKartObj.rotation.x = startRotX;
          targetKartObj.rotation.z = startRotZ;
        }
      }
    }, 16);
  }
}

const activeDigs = []; // Guarda as animações que estão viajando

function spawnDigProjectile(casterId, targetId) {
  const group = new THREE.Group();

  const geo = new THREE.DodecahedronGeometry(0.5, 0);
  const mat1 = new THREE.MeshBasicMaterial({ color: 0x3b240e });
  const mat2 = new THREE.MeshBasicMaterial({ color: 0x5c3a21 });

  // Pedras muito mais "achatadas" no eixo Y, como se fossem o asfalto levantando
  const rock1 = new THREE.Mesh(geo, mat1);
  rock1.scale.set(0.8, 0.2, 0.8);

  const rock2 = new THREE.Mesh(geo, mat2);
  rock2.scale.set(0.5, 0.15, 0.5);
  rock2.position.set(0.3, 0.05, -0.3);

  const rock3 = new THREE.Mesh(geo, mat2);
  rock3.scale.set(0.5, 0.15, 0.5);
  rock3.position.set(-0.3, 0.05, 0.3);

  group.add(rock1, rock2, rock3);

  let startPos = new THREE.Vector3();
  if (casterId === 'local' && kart) {
    startPos.copy(kart.position);
  } else if (remoteKarts.has(casterId)) {
    const rKart = remoteKarts.get(casterId);
    startPos.copy(rKart.isBot ? rKart.obj.group.position : rKart.target.pos);
  }

  group.position.copy(startPos);
  group.position.y = 0.05; // Bem colado no chão
  scene.add(group);

  activeDigs.push({ mesh: group, targetId: targetId, casterId: casterId, isLocalCaster: (casterId === 'local') });
}

function updateDigProjectiles(dt) {
  const trackLength = trackCurve.getLength();

  for (let i = activeDigs.length - 1; i >= 0; i--) {
    const dig = activeDigs[i];
    let targetPos = null;

    if (dig.targetId === 'local' && kart) {
      targetPos = kart.position;
    } else if (remoteKarts.has(dig.targetId)) {
      const rKart = remoteKarts.get(dig.targetId);
      targetPos = rKart.isBot ? rKart.obj.group.position : rKart.target.pos;
    }

    if (targetPos) {
      const directDist = dig.mesh.position.distanceTo(targetPos);

      if (directDist < 3.0) {
        // BATEU!
        scene.remove(dig.mesh);
        dig.mesh.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });
        activeDigs.splice(i, 1);

        const isBotCaster = dig.casterId !== 'local' && remoteKarts.has(dig.casterId) && remoteKarts.get(dig.casterId).isBot;
        const isSinglePlayer = typeof roomCodeParam === 'undefined' || !roomCodeParam;

        // Quem dispara o dano? O jogador local (se ele atirou) ou o controlador do Bot (Host ou Single Player)
        if (dig.isLocalCaster || (isBotCaster && (isHost || isSinglePlayer))) {
          if (dig.targetId === 'local') {
            triggerDigExplosion('local'); // BOOM em você!
          } else {
            sendNetworkEvent({ t: 'trigger_dig', targetId: dig.targetId });
            triggerDigExplosion(dig.targetId);

            const targetBot = remoteKarts.get(dig.targetId);
            if (targetBot && targetBot.isBot) {
              targetBot.speed = 0;
              targetBot.stunTimer = 2.5;
            }
          }
        }
      } else {
        // NAVEGAÇÃO PELA PISTA
        let moveDir = new THREE.Vector3();

        if (directDist < 25.0) {
          moveDir.subVectors(targetPos, dig.mesh.position);
        } else {
          const { sample } = nearestTrackSample(dig.mesh.position);
          let lookAheadT = sample.t + (18.0 / trackLength);
          if (lookAheadT > 1.0) lookAheadT -= 1.0;

          const pathTarget = trackCurve.getPointAt(lookAheadT);
          moveDir.subVectors(pathTarget, dig.mesh.position);
        }

        moveDir.y = 0;
        moveDir.normalize();

        // 🚀 Velocidade de perseguição extremamente alta
        const speed = 55;
        dig.mesh.position.addScaledVector(moveDir, speed * dt);

        // 🪨 EFEITO SUBTERRÂNEO: Fica preso ao chão e vibra intensamente
        dig.mesh.position.y = 0.12;

        // Tremor aleatório nos eixos X e Z para simular rachaduras violentas
        dig.mesh.rotation.x = (Math.random() - 0.5) * 0.6;
        dig.mesh.rotation.z = (Math.random() - 0.5) * 0.6;

        // Gira a base rapidamente no eixo Y para parecer que a terra está revolvendo
        dig.mesh.rotation.y += 20 * dt;
      }
    } else {
      scene.remove(dig.mesh);
      activeDigs.splice(i, 1);
    }
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && currentItem && raceStarted) {
    useEquippedSkill(currentItem);
    currentItem = null;

    const iconEl = document.getElementById('itemIcon');
    if (iconEl) iconEl.innerHTML = ITEM_ICON_DEFAULT;
  }
});

function useEquippedSkill(skill) {
  switch (skill.id) {
    case 'TURBO':
      physics.turboTimer = 2.5 * (physics.turboBonus || 1.0);
      break;

    case 'SHIELD':
      isShieldActive = true;
      setTimeout(() => { isShieldActive = false; }, 5000);
      break;

    case 'ICE':
      dropTrapOnTrack('ICE');
      break;

    case 'LODO':
      dropTrapOnTrack('LODO');
      break;

    case 'CHOQUE':
      castShockAbility();
      break;

    case 'FUMACA':
      dropTrapOnTrack('FUMACA');
      break;

    case 'SURF':
      physics.isSurfing = true;
      // Duração de 4.5 segundos apenas mantendo a velocidade na grama
      setTimeout(() => {
        physics.isSurfing = false;
      }, 4500);
      break;

    case 'LAMA':
      castMudAbility();
      break;

    case 'DIG':
      const classificacao = updateStandings();
      const posicaoLocal = classificacao.findIndex(r => r.key === 'local') + 1;

      if (posicaoLocal === 1) {
        // Impede o uso e devolve o item para o inventário visual e lógico 
        // (necessário pois o evento de tecla/toque limpa o slot antes desta função rodar)
        setTimeout(() => {
          currentItem = SKILLS.DIG;
          const iconEl = document.getElementById('itemIcon');
          if (iconEl) iconEl.innerHTML = SKILLS.DIG.icon;
        }, 10);
        console.warn("Ataque Cavar não pode ser usado pelo 1º colocado!");
        break; // Interrompe a execução sem ativar a habilidade
      }

      castDigAbility('local');
      break;
  }
}

// ------------------------------------------------------------
// MULTIPLAYER E TRANSMISSÃO DE EVENTOS
// ------------------------------------------------------------
const remoteKarts = new Map();
let racePeer = null;
let hostConn = null;
const activeGuestConns = new Map();

const _urlParams = new URLSearchParams(window.location.search);
const _roomParam = _urlParams.get('room');
const _slotParam = _urlParams.has('slot') ? parseInt(_urlParams.get('slot'), 10) : 0;

const isHost = Boolean(_roomParam) && _slotParam === 0;

function friendLabel(peerId) {
  return 'AMIGO ' + peerId.slice(-4).toUpperCase();
}

function sendNetworkEvent(payload) {
  if (isHost) {
    broadcastEvent(payload);
  } else if (hostConn && hostConn.open) {
    hostConn.send(payload);
  }
}

function broadcastEvent(payload) {
  for (const conn of activeGuestConns.values()) {
    if (conn.open) {
      conn.send(payload);
    }
  }
}

function handleNetworkMessage(data) {
  if (data.t === 'take_box') {
    disableItemBox(data.boxId);
    if (isHost) broadcastEvent(data);
  } else if (data.t === 'spawn_trap') {
    if (!placedTraps.some(t => t.id === data.trap.id)) {
      createTrapMesh(data.trap);
    }
    if (isHost) broadcastEvent(data);
  } else if (data.t === 'destroy_trap') {
    removeTrapMesh(data.trapId);
    if (isHost) broadcastEvent(data);
  } else if (data.t === 'apply_stun') {
    if (racePeer && data.targetId === racePeer.id) {
      if (!isShieldActive) {
        physics.stunTimer = 1.0;
        if (kart) triggerSparkEffect(kart.position);
      }
    } else if (isHost) {
      broadcastEvent(data);
    }
  } else if (data.t === 'apply_mud') {
    if (racePeer && data.targetId === racePeer.id) {
      if (!isShieldActive) {
        // Ativa a mancha na tela!
        const mudUI = document.getElementById('mudOverlay');
        if (mudUI) {
          mudUI.style.opacity = '0.95'; // Suja a tela
          setTimeout(() => { mudUI.style.opacity = '0'; }, 3500); // Limpa após 3.5s
        }
      }
    } else if (isHost) {
      broadcastEvent(data);
    }

  } else if (data.t === 'spawn_dig') {
    // Alguém atirou o Dig, vamos mostrar a animação na nossa tela!
    spawnDigProjectile(data.casterId, data.targetId);
    if (isHost) broadcastEvent(data);

  } else if (data.t === 'trigger_dig') {
    if (racePeer && data.targetId === racePeer.id) {
      triggerDigExplosion('local');
    } else {
      triggerDigExplosion(data.targetId); // 🔥 Mostra a animação do coitado voando para todos na sala
    }
    if (isHost) {
      broadcastEvent(data);
    }
  }
}

function handleRemoteKartState(peerId, data) {
  let entry = remoteKarts.get(peerId);

  if (!entry) {
    const remoteKartData = KART_DATABASE.find(k => k.id === data.kartId) || KART_DATABASE[0];
    const obj = createKart(0x1E88E5);

    loadKartTemplate(remoteKartData, (template) => {
      applyModelToGroup(obj.group, template, 0x1E88E5);
    });

    entry = {
      obj,
      nickname: data.nick || friendLabel(peerId),
      kartId: data.kartId,
      target: { pos: new THREE.Vector3(), ry: 0, speed: 0 },
      progress: 0,
      lapCount: 1,
      finished: false
    };
    remoteKarts.set(peerId, entry);
  }

  if (data.kartId && entry.kartId !== data.kartId) {
    entry.kartId = data.kartId;
    const remoteKartData = KART_DATABASE.find(k => k.id === data.kartId);
    if (remoteKartData) {
      loadKartTemplate(remoteKartData, (template) => {
        applyModelToGroup(entry.obj.group, template, 0x1E88E5);
      });
    }
  }

  entry.target.pos.set(data.x, data.y, data.z);
  entry.target.ry = data.ry;
  entry.target.speed = data.speed;

  entry.progress = typeof data.progress === 'number' ? data.progress : 0;
  entry.lapCount = data.lapCount || 1;
  entry.finished = Boolean(data.finished);
  entry.isPoisoned = Boolean(data.poisoned);
  entry.isShieldActive = Boolean(data.shield);
  entry.isTurboActive = Boolean(data.turbo);

  raceTrackers.set(peerId, {
    progress: entry.progress,
    lapCount: entry.lapCount,
    finished: entry.finished,
    finishTime: data.finishTime || (entry.finished ? Date.now() : Infinity)
  });
}

function removeRemoteKart(peerId) {
  const entry = remoteKarts.get(peerId);
  if (entry) {
    scene.remove(entry.obj.group);
    remoteKarts.delete(peerId);
  }
  activeGuestConns.delete(peerId);
  raceTrackers.delete(peerId);
}

function initRaceMultiplayer() {
  if (!_roomParam) {
    setTimeout(startCountdown, 500);
    return;
  }

  const roomClean = _roomParam.trim().toLowerCase();
  const racePeerId = `pkart-race-${roomClean}`;

  const peerOpts = {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  };

  if (isHost) {
    if (racePeer) racePeer.destroy();
    racePeer = new Peer(racePeerId, peerOpts);

    racePeer.on('open', (id) => { });

    racePeer.on('connection', (conn) => {
      conn.on('open', () => {
        activeGuestConns.set(conn.peer, conn);
        setTimeout(() => {
          broadcastEvent({ t: 'start_countdown' });
          if (!raceStarted && !countdownInProgress) {
            startCountdown();
          }
        }, 1000);
      });

      conn.on('data', (data) => {
        if (data.t === 'state') {
          handleRemoteKartState(conn.peer, data);
        } else {
          handleNetworkMessage(data);
        }
      });

      conn.on('close', () => removeRemoteKart(conn.peer));
      conn.on('error', () => removeRemoteKart(conn.peer));
    });

  } else {
    if (racePeer) racePeer.destroy();
    racePeer = new Peer(peerOpts);

    racePeer.on('open', (myId) => {
      let attemptCount = 0;
      const maxAttempts = 40; // Aumentamos para dar mais tempo ao Host carregar

      function tryConnectToHost() {
        attemptCount++;
        if (hostConn) {
          try { hostConn.close(); } catch (e) { }
        }

        console.log(`[Multiplayer] Tentativa ${attemptCount} de conectar ao Host (${racePeerId})...`);
        hostConn = racePeer.connect(racePeerId, { reliable: true });

        hostConn.on('open', () => {
          console.log("[Multiplayer] Conectado ao Host com sucesso!");
          lastSnapshotReceivedTime = Date.now();

          setInterval(() => {
            if (kart && hostConn && hostConn.open) {
              const myTracker = raceTrackers.get('local');
              hostConn.send({
                t: 'state',
                x: (kart && !isNaN(kart.position.x)) ? kart.position.x : 0,
                y: (kart && !isNaN(kart.position.y)) ? kart.position.y : 0,
                z: (kart && !isNaN(kart.position.z)) ? kart.position.z : 0,
                ry: !isNaN(physics.heading) ? physics.heading : 0,
                speed: !isNaN(physics.speed) ? physics.speed : 0,
                nick: playerNickname,
                kartId: selectedKartId,
                slot: _slotParam,
                progress: (myTracker && !isNaN(myTracker.progress)) ? myTracker.progress : 0,
                lapCount: myTracker ? myTracker.lapCount : 1,
                finished: myTracker ? myTracker.finished : false,
                poisoned: isControlInverted,
                shield: isShieldActive,
                turbo: physics.turboTimer > 0
              });
            }
          }, 1000 / 30);
        });

        hostConn.on('data', (data) => {
          // Atualiza o relógio de snapshot imediatamente para não causar timeout no loading/countdown
          if (data.t === 'snapshot') {
            lastSnapshotReceivedTime = Date.now();
          }

          // 🛡️ SEGURANÇA: Se o kart local ainda não carregou o modelo 3D, ignora snapshots para não crashar
          if (!kart) {
            if (data.t === 'snapshot') return;
          }
          if (data.t === 'host_disconnected' && !window.jaSurgiuAlertaDeQueda) {
            const myTracker = raceTrackers.get('local');
            if (myTracker && myTracker.finished) return;

            window.jaSurgiuAlertaDeQueda = true;
            corridaAtivaParaPunicao = false;
            alert("⚠️ O Host encerrou a sala.");
            window.location.href = 'index.html';
          } else if (data.t === 'start_countdown') {
            if (!raceStarted && !countdownInProgress) {
              startCountdown();
            }
          } else if (data.t === 'snapshot' && data.karts) {
            for (const [peerId, state] of Object.entries(data.karts)) {
              if (racePeer && peerId !== racePeer.id) {
                handleRemoteKartState(peerId, state);
              }
            }
          } else {
            handleNetworkMessage(data);
          }
        });
      }

      // 🛡️ Damos 2 segundos iniciais para o Host abrir a sala antes de tentar a 1ª vez
      setTimeout(tryConnectToHost, 2000);

      racePeer.on('error', (err) => {
        if (err.type === 'peer-unavailable' && attemptCount < maxAttempts) {
          console.warn(`[Multiplayer] Host ainda não respondeu. Nova tentativa em 2s (${attemptCount}/${maxAttempts})...`);
          setTimeout(tryConnectToHost, 2000);
        } else if (attemptCount >= maxAttempts) {
          alert("❌ Não foi possível conectar ao Host. A sala pode ter sido fechada.");
          window.location.href = 'index.html';
        }
      });
    });
  }
}

let netTimer = 0;
function networkTick(dt) {
  // Watchdog para convidados: se o host cair, expulsa para o lobby sem punição
  if (!isHost && typeof roomCodeParam !== 'undefined' && roomCodeParam) {
    if (Date.now() - lastSnapshotReceivedTime > 4000) {
      const myTracker = raceTrackers.get('local');
      if (myTracker && myTracker.finished) return;

      corridaAtivaParaPunicao = false;
      alert("⚠️ A conexão com o Host foi perdida. A corrida foi encerrada.");
      window.location.href = 'index.html';
      return;
    }
  }

  if (!isHost || !racePeer) return;

  netTimer += dt;
  if (netTimer < 1 / 30) return;
  netTimer = 0;

  const myTracker = raceTrackers.get('local');

  // 🛡️ Garante números inteiros/limpos para evitar o erro do BinaryPack
  const safeX = (kart && !isNaN(kart.position.x)) ? Number(kart.position.x.toFixed(2)) : 0;
  const safeY = (kart && !isNaN(kart.position.y)) ? Number(kart.position.y.toFixed(2)) : 0;
  const safeZ = (kart && !isNaN(kart.position.z)) ? Number(kart.position.z.toFixed(2)) : 0;
  const safeRy = !isNaN(physics.heading) ? Number(physics.heading.toFixed(3)) : 0;
  const safeSpeed = !isNaN(physics.speed) ? Number(physics.speed.toFixed(1)) : 0;
  const safeProgress = (myTracker && !isNaN(myTracker.progress)) ? Number(myTracker.progress.toFixed(4)) : 0;
  const safeFinishTime = (myTracker && myTracker.finishTime && myTracker.finishTime !== Infinity) ? myTracker.finishTime : 0;

  const snapshot = {
    [racePeer.id]: {
      x: safeX,
      y: safeY,
      z: safeZ,
      ry: safeRy,
      speed: safeSpeed,
      nick: playerNickname,
      kartId: selectedKartId,
      slot: playerSlotParam,
      progress: safeProgress,
      lapCount: myTracker ? myTracker.lapCount : 1,
      finished: myTracker ? myTracker.finished : false,
      finishTime: safeFinishTime,
      poisoned: isControlInverted,
      shield: isShieldActive,
      turbo: physics.turboTimer > 0
    }
  };

  for (const [pid, entry] of remoteKarts.entries()) {
    const remoteTracker = raceTrackers.get(pid);
    const rPos = entry.isBot ? entry.obj.group.position : entry.target.pos;
    const rFinish = (remoteTracker && remoteTracker.finishTime && remoteTracker.finishTime !== Infinity) ? remoteTracker.finishTime : 0;

    snapshot[pid] = {
      x: (rPos && !isNaN(rPos.x)) ? Number(rPos.x.toFixed(2)) : 0,
      y: (rPos && !isNaN(rPos.y)) ? Number(rPos.y.toFixed(2)) : 0,
      z: (rPos && !isNaN(rPos.z)) ? Number(rPos.z.toFixed(2)) : 0,
      ry: !isNaN(entry.isBot ? entry.heading : entry.target.ry) ? Number((entry.isBot ? entry.heading : entry.target.ry).toFixed(3)) : 0,
      speed: !isNaN(entry.isBot ? entry.speed : entry.target.speed) ? Number((entry.isBot ? entry.speed : entry.target.speed).toFixed(1)) : 0,
      nick: entry.nickname,
      kartId: entry.kartId,
      progress: (entry.progress && !isNaN(entry.progress)) ? Number(entry.progress.toFixed(4)) : 0,
      lapCount: entry.lapCount || 1,
      finished: Boolean(entry.finished),
      poisoned: entry.isBot ? (entry.stunTimer > 0) : Boolean(entry.isPoisoned),
      shield: entry.isBot ? (entry.shieldTimer > 0) : Boolean(entry.isShieldActive),
      turbo: entry.isBot ? (entry.turboTimer > 0) : Boolean(entry.isTurboActive),
      finishTime: rFinish
    };
  }

  for (const conn of activeGuestConns.values()) {
    if (conn.open) {
      try {
        conn.send({ t: 'snapshot', karts: snapshot });
      } catch (e) {
        // Silencia para não poluir o console, mas impede o crash
      }
    }
  }
}

function updateRemoteKarts(dt) {
  for (const [pid, entry] of remoteKarts.entries()) {
    if (entry.isBot) continue;
    const g = entry.obj.group;

    if (Math.abs(entry.target.speed) > 1) {
      const moveDir = new THREE.Vector3(
        Math.sin(entry.target.ry),
        0,
        Math.cos(entry.target.ry)
      );
      entry.target.pos.addScaledVector(moveDir, entry.target.speed * dt);
    }

    const lerpFactor = Math.min(1, dt * 18);
    g.position.lerp(entry.target.pos, lerpFactor);

    let diffY = entry.target.ry - g.rotation.y;
    while (diffY < -Math.PI) diffY += Math.PI * 2;
    while (diffY > Math.PI) diffY -= Math.PI * 2;

    g.rotation.y += diffY * lerpFactor;
  }
}

initRaceMultiplayer();

// ------------------------------------------------------------
// CLASSIFICAÇÃO DA HUD
// ------------------------------------------------------------
function updateStandings() {
  const standingsEl = document.getElementById('standingsList');
  if (!standingsEl || !kart) return [];

  const racers = [
    { key: 'local', name: playerNickname, tr: raceTrackers.get('local') }
  ];

  if (typeof remoteKarts !== 'undefined' && remoteKarts) {
    for (const [pid, entry] of remoteKarts.entries()) {
      const tr = raceTrackers.get(pid) || { progress: 0, lapCount: 1, finished: false, finishTime: Infinity };
      racers.push({
        key: pid,
        name: entry.nickname || friendLabel(pid),
        tr: tr
      });
    }
  }

  racers.forEach(r => {
    if (!r.tr) r.tr = { progress: 0, lapCount: 1, finished: false, finishTime: Infinity };
  });

  racers.sort((a, b) => {
    // Se ambos finalizaram, quem tem o menor finishTime (chegou primeiro) fica na frente
    if (a.tr.finished && b.tr.finished) {
      return (a.tr.finishTime || 0) - (b.tr.finishTime || 0);
    }
    // Quem já finalizou tem prioridade absoluta sobre quem ainda está correndo
    if (a.tr.finished) return -1;
    if (b.tr.finished) return 1;

    // Se ninguém finalizou, ordena pelo progresso na pista
    const progA = typeof a.tr.progress === 'number' ? a.tr.progress : 0;
    const progB = typeof b.tr.progress === 'number' ? b.tr.progress : 0;

    return progB - progA;
  });

  standingsEl.innerHTML = racers.map((r, index) => {
    const isMe = r.key === 'local';
    const highlightStyle = isMe ? 'color: #FFD54F; font-weight: bold;' : 'color: #cbd5e1;';
    const finishedFlag = r.tr.finished ? ' 🏁' : '';
    return `<div style="${highlightStyle}">${index + 1}º ${r.name}${finishedFlag}</div>`;
  }).join('');

  return racers;
}

function updateHUD() {
  const nameEl = document.getElementById('hud-player-name');
  if (nameEl) nameEl.innerText = playerNickname;

  if (kart) {
    const tr = updateRaceTracker('local', kart.position);

    const racers = updateStandings();
    const myRank = racers.findIndex(r => r.key === 'local') + 1;

    const lapEl = document.getElementById('hud-current-lap');
    const speedEl = document.getElementById('hud-speed');
    const speedFillEl = document.getElementById('speedfill');
    const timerEl = document.getElementById('hud-race-timer');

    if (lapEl) lapEl.innerText = tr.lapCount;

    const currentSpeedKmH = Math.floor(Math.abs(physics.speed) * 3.6);
    if (speedEl) speedEl.innerText = currentSpeedKmH;

    if (speedFillEl) {
      const maxPossibleSpeed = physics.maxSpeed * (physics.turboTimer > 0 ? 1.4 : 1.0) * 3.6;
      const speedPercent = Math.min(100, (currentSpeedKmH / maxPossibleSpeed) * 100);

      speedFillEl.style.width = `${speedPercent}%`;

      if (speedPercent > 85) {
        speedFillEl.style.boxShadow = '0 0 12px rgba(255, 75, 85, 0.8)';
      } else {
        speedFillEl.style.boxShadow = '0 0 10px rgba(39, 200, 255, 0.6)';
      }
    }

    // Lógica da Barra de Drift
    if (physics.isDrifting && physics.driftCharge > 0) {
      driftBarContainer.style.display = 'block';
      const maxCharge = 0.8; // Valor exato que ativa o turbo no seu código
      let percent = Math.min(100, (physics.driftCharge / maxCharge) * 100);
      driftBarFill.style.width = percent + '%';

      // Muda a cor da barra dependendo do nível de carga
      if (percent >= 100) {
        driftBarFill.style.background = '#22c55e'; // Verde brilhante quando o turbo tá pronto
        driftBarFill.style.boxShadow = '0 0 12px #22c55e';
      } else if (percent > 50) {
        driftBarFill.style.background = '#f97316'; // Laranja na metade
        driftBarFill.style.boxShadow = '0 0 10px #f97316';
      } else {
        driftBarFill.style.background = '#facc15'; // Amarelo no início
        driftBarFill.style.boxShadow = '0 0 8px #facc15';
      }
    } else {
      driftBarContainer.style.display = 'none';
      driftBarFill.style.width = '0%';
    }

    if (raceStarted && !tr.finished) {
      totalRaceTimeMs = performance.now() - raceStartTime;
      if (timerEl) timerEl.innerText = formatTime(totalRaceTimeMs);
    }

    if (tr.finished && !localFinishNotified) {
      localFinishNotified = true;
      showFinishOverlay(myRank);
    }

    if (finishLeaderboardEl) {
      finishLeaderboardEl.innerHTML = racers.map((r, index) => {
        const isMe = r.key === 'local';
        const bgColor = isMe ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.7)';
        const borderColor = isMe ? '#38bdf8' : '#334155';
        const nameColor = isMe ? '#FFD54F' : '#f8fafc';

        const status = r.tr.finished
          ? '<span style="color:#22c55e;">🏁 Finalizou</span>'
          : '<span style="color:#94a3b8;">Correndo...</span>';

        return `
          <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: bold; color: ${nameColor}; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;">
              <span style="color:#cbd5e1; margin-right: 10px; display: inline-block;">${index + 1}º</span>${r.name}
            </div>
            <div style="font-size: 13px; font-weight: bold;">${status}</div>
          </div>
        `;
      }).join('');
    }
  }
}

// ------------------------------------------------------------
// MINIMAPA
// ------------------------------------------------------------
function getTrackBounds(trackPoints) {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  trackPoints.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  });

  const padding = 45;
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minZ: minZ - padding,
    maxZ: maxZ + padding,
    width: (maxX - minX) + (padding * 2),
    height: (maxZ - minZ) + (padding * 2)
  };
}

function drawMinimap() {
  const canvas = document.getElementById('minimapCanvas');
  if (!canvas || !currentTrackPoints || currentTrackPoints.length === 0) return;
  const ctx = canvas.getContext('2d');

  const width = canvas.width;
  const height = canvas.height;
  const radius = width / 2;

  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.beginPath();
  ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
  ctx.clip();

  const bgGrad = ctx.createRadialGradient(radius, radius, 10, radius, radius, radius);
  bgGrad.addColorStop(0, '#1e293b');
  bgGrad.addColorStop(1, '#0b1329');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const bounds = getTrackBounds(currentTrackPoints);
  const mapSize = Math.min(width, height);
  const scale = mapSize / Math.max(bounds.width, bounds.height);
  const offsetX = (width - bounds.width * scale) / 2;
  const offsetY = (height - bounds.height * scale) / 2;

  function worldToMinimap(x, z) {
    return {
      x: offsetX + (x - bounds.minX) * scale,
      y: offsetY + (z - bounds.minZ) * scale
    };
  }

  ctx.beginPath();
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  currentTrackPoints.forEach((pt, i) => {
    const pos = worldToMinimap(pt.x, pt.z);
    if (i === 0) ctx.moveTo(pos.x, pos.y);
    else ctx.lineTo(pos.x, pos.y);
  });
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.5;
  currentTrackPoints.forEach((pt, i) => {
    const pos = worldToMinimap(pt.x, pt.z);
    if (i === 0) ctx.moveTo(pos.x, pos.y);
    else ctx.lineTo(pos.x, pos.y);
  });
  ctx.closePath();
  ctx.stroke();

  // Renderiza karts remotos e BOTS no minimapa corretamente (usando group.position se for bot)
  for (const entry of remoteKarts.values()) {
    const posReal = entry.isBot ? entry.obj.group.position : entry.target.pos;
    if (posReal) {
      const pos = worldToMinimap(posReal.x, posReal.z);

      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (kart) {
    const pos = worldToMinimap(kart.position.x, kart.position.z);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(radius, radius, radius - 1.5, 0, Math.PI * 2);
  ctx.stroke();
}

// ------------------------------------------------------------
// INTELIGÊNCIA ARTIFICIAL (BOTS)
// ------------------------------------------------------------
function spawnBots() {
  if (roomCodeParam && !isHost) return;
  const modeParam = urlParams.get('mode');
  if (!roomCodeParam && aiDifficultyParam === 'none' && modeParam !== 'tower') return;

  const diffSettings = { easy: 0.75, normal: 0.90, hard: 1.10 };
  const diffMult = diffSettings[aiDifficultyParam] || 0.90;

  // Se for o Modo Torre, queremos EXATAMENTE 1 bot que seja o Líder
  if (modeParam === 'tower') {
    const currentFloor = parseInt(urlParams.get('floor') || '1', 10);
    const totalFloors = parseInt(urlParams.get('totalFloors') || '10', 10);

    // Se NÃO for o último andar, fazemos o fluxo normal (vários bots)
    if (currentFloor !== totalFloors) {
      const maxSlots = 4;
      const botCount = maxSlots - totalPlayersParam;

      const diffSettings = { easy: 0.75, normal: 0.90, hard: 1.10 };
      const diffMult = diffSettings[aiDifficultyParam] || 0.90;

      for (let i = 0; i < botCount; i++) {
        const randomKart = KART_DATABASE[Math.floor(Math.random() * KART_DATABASE.length)];
        const botSlot = totalPlayersParam + i;
        const botId = 'bot-' + botSlot;

        const obj = createKart(0x555555);
        loadKartTemplate(randomKart, (template) => { applyModelToGroup(obj.group, template, 0x555555); });

        const grid = getGridPosition(botSlot);
        obj.group.position.copy(grid.pos);
        obj.group.rotation.y = grid.heading;

        const laneOffset = (Math.random() - 0.5) * (trackWidth - 3);
        const randomLeaderName = GYM_LEADERS[Math.floor(Math.random() * GYM_LEADERS.length)];

        remoteKarts.set(botId, {
          isBot: true,
          obj: obj,
          nickname: randomLeaderName,
          kartId: randomKart.id,
          stats: randomKart.stats,
          speed: 0,
          heading: grid.heading,
          laneOffset: laneOffset,
          diffMult: diffMult,
          progress: 0,
          lapCount: 1,
          finished: false,
          target: { pos: new THREE.Vector3(), ry: 0, speed: 0 },
          stunTimer: 0, spinTimer: 0, shieldTimer: 0, turboTimer: 0, poisonTimer: 0,
          currentItem: null, itemUseTimer: 0
        });
      }
      return; // Sai da função para não duplicar os bots da torre
    }

    // Se FOR o último andar, spawna apenas o Líder de Ginásio exclusivo
    const leaderName = decodeURIComponent(urlParams.get('leader') || 'LÍDER DE GINÁSIO');
    const leaderKartId = urlParams.get('leaderkart') || 'jolteon';
    const leaderKartData = KART_DATABASE.find(k => k.id === leaderKartId) || KART_DATABASE[0];
    const botSlot = 1; // Slot 1 para o bot na torre
    const obj = createKart(0x555555);

    loadKartTemplate(leaderKartData, (template) => { applyModelToGroup(obj.group, template, 0x555555); });

    const grid = getGridPosition(botSlot);
    obj.group.position.copy(grid.pos);
    obj.group.rotation.y = grid.heading;

    const laneOffset = (Math.random() - 0.5) * (trackWidth - 3);
    remoteKarts.set('bot-leader', {
      isBot: true,
      obj: obj,
      nickname: leaderName,
      kartId: leaderKartData.id,
      stats: leaderKartData.stats,
      speed: 0,
      heading: grid.heading,
      laneOffset: laneOffset,
      diffMult: diffMult,
      progress: 0,
      lapCount: 1,
      finished: false,
      target: { pos: new THREE.Vector3(), ry: 0, speed: 0 },
      stunTimer: 0, spinTimer: 0, shieldTimer: 0, turboTimer: 0, poisonTimer: 0,
      currentItem: null, itemUseTimer: 0
    });
    return;
  }

  const maxSlots = 4;
  const botCount = maxSlots - totalPlayersParam;

  if (botCount <= 0) return;

  for (let i = 0; i < botCount; i++) {
    const randomKart = KART_DATABASE[Math.floor(Math.random() * KART_DATABASE.length)];
    const botSlot = totalPlayersParam + i;
    const botId = 'bot-' + botSlot;

    const obj = createKart(0x555555);
    loadKartTemplate(randomKart, (template) => { applyModelToGroup(obj.group, template, 0x555555); });

    const grid = getGridPosition(botSlot);
    obj.group.position.copy(grid.pos);
    obj.group.rotation.y = grid.heading;

    const laneOffset = (Math.random() - 0.5) * (trackWidth - 3);
    const randomLeaderName = GYM_LEADERS[Math.floor(Math.random() * GYM_LEADERS.length)];
    remoteKarts.set(botId, {
      isBot: true,
      obj: obj,
      nickname: randomLeaderName,//+ ' ' + randomKart.name.split(' ')[0].toUpperCase(),
      kartId: randomKart.id,
      stats: randomKart.stats,
      speed: 0,
      heading: grid.heading,
      laneOffset: laneOffset,
      diffMult: diffMult,
      progress: 0,
      lapCount: 1,
      finished: false,
      target: { pos: new THREE.Vector3(), ry: 0, speed: 0 },
      stunTimer: 0,
      spinTimer: 0,
      shieldTimer: 0,
      turboTimer: 0,
      poisonTimer: 0,
      currentItem: null,
      itemUseTimer: 0
    });
  }
}
spawnBots();

function updateBots(dt) {
  if (!raceStarted) return;

  const trackLength = trackCurve.getLength();

  for (const [id, bot] of remoteKarts.entries()) {
    if (!bot.isBot || bot.finished) continue;

    if (bot.shieldTimer > 0) bot.shieldTimer -= dt;
    if (bot.turboTimer > 0) bot.turboTimer -= dt;
    if (bot.poisonTimer > 0) bot.poisonTimer -= dt;

    if (bot.itemUseTimer > 0) {
      bot.itemUseTimer -= dt;
      if (bot.itemUseTimer <= 0 && bot.currentItem) {
        useBotSkill(id, bot, bot.currentItem);
        bot.currentItem = null;
      }
    }

    if (bot.spinTimer > 0) {
      bot.spinTimer -= dt;
      bot.speed = 0;
      bot.obj.group.rotation.y += dt * 12;
      continue;
    }
    if (bot.stunTimer > 0) {
      bot.stunTimer -= dt;
      bot.speed = 0;
      continue;
    }

    let maxSpd = bot.stats.maxSpeed * bot.diffMult;
    if (bot.turboTimer > 0) maxSpd *= 1.4;
    bot.speed += bot.stats.accel * dt;

    const { sample } = nearestTrackSample(bot.obj.group.position);
    const offsetVec = new THREE.Vector3().subVectors(bot.obj.group.position, sample.point);
    const lateral = offsetVec.dot(sample.normal);

    const lookAheadDistance = 6.0 + (bot.speed * 0.35);
    let lookAheadT = sample.t + (lookAheadDistance / trackLength);
    if (lookAheadT > 1) lookAheadT -= 1.0;

    const targetPt = trackCurve.getPointAt(lookAheadT);
    const targetTangent = trackCurve.getTangentAt(lookAheadT).normalize();
    const targetNormal = new THREE.Vector3(-targetTangent.z, 0, targetTangent.x).normalize();

    const halfWidth = trackWidth / 2;
    const safeZone = halfWidth - 1.5;
    const grassStart = halfWidth + 0.8;
    const wallStart = grassStart + 3.0;

    if (Math.abs(lateral) > safeZone) {
      bot.laneOffset = THREE.MathUtils.lerp(bot.laneOffset, 0, dt * 3.0);

      if (Math.abs(lateral) > grassStart) {
        const maxGrassSpeed = 5.5;
        maxSpd = Math.min(maxSpd, maxGrassSpeed);
        if (bot.speed > maxGrassSpeed) {
          bot.speed = THREE.MathUtils.lerp(bot.speed, maxGrassSpeed, 0.15);
        }
      }

      if (Math.abs(lateral) > wallStart) {
        const sign = Math.sign(lateral);
        const correction = Math.abs(lateral) - wallStart;
        bot.obj.group.position.addScaledVector(sample.normal, -sign * correction);
      }
    }

    if (bot.speed > maxSpd) bot.speed = maxSpd;

    targetPt.addScaledVector(targetNormal, bot.laneOffset);

    const offset = targetPt.clone().sub(bot.obj.group.position);
    const desiredHeading = Math.atan2(offset.x, offset.z);

    let diffHeading = desiredHeading - bot.heading;
    while (diffHeading < -Math.PI) diffHeading += Math.PI * 2;
    while (diffHeading > Math.PI) diffHeading -= Math.PI * 2;

    if (Math.abs(diffHeading) > 1.2) {
      bot.speed *= 0.95;
    }

    const panicTurnMult = Math.abs(lateral) > safeZone ? 3.5 : 2.0;
    const turnSpd = bot.stats.turnSpeed * panicTurnMult;

    bot.heading += Math.sign(diffHeading) * Math.min(Math.abs(diffHeading), turnSpd * dt);

    const moveDir = new THREE.Vector3(Math.sin(bot.heading), 0, Math.cos(bot.heading));
    bot.obj.group.position.addScaledVector(moveDir, bot.speed * dt);
    bot.obj.group.rotation.y = bot.heading;

    const tr = updateRaceTracker(id, bot.obj.group.position);
    bot.progress = tr.progress;
    bot.lapCount = tr.lapCount;
    bot.finished = tr.finished;
  }
}

function useBotSkill(botId, bot, skill) {
  switch (skill.id) {
    case 'TURBO':
      bot.turboTimer = 2.5 * (bot.stats.turboBonus || 1.0);
      break;
    case 'SHIELD':
      bot.shieldTimer = 5.0;
      break;
    case 'ICE':
    case 'LODO':
    case 'FUMACA':
      const backVector = new THREE.Vector3(0, 0, -2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), bot.heading);
      const trapPos = bot.obj.group.position.clone().add(backVector);
      createTrapMesh({ id: botId + '-' + Math.random(), x: trapPos.x, z: trapPos.z, type: skill.id });
      break;
    case 'CHOQUE':
      let targetId = null;
      let bestAheadProgress = Infinity;
      const myTr = raceTrackers.get('local');

      if (myTr && !myTr.finished && myTr.progress > bot.progress && myTr.progress < bestAheadProgress) {
        bestAheadProgress = myTr.progress; targetId = 'local';
      }

      for (const [pid, entry] of remoteKarts.entries()) {
        if (pid !== botId && !entry.finished && entry.progress > bot.progress && entry.progress < bestAheadProgress) {
          bestAheadProgress = entry.progress; targetId = pid;
        }
      }

      if (!targetId) {
        let bestBehindProgress = -1;
        if (myTr && !myTr.finished && myTr.progress < bot.progress && myTr.progress > bestBehindProgress) {
          bestBehindProgress = myTr.progress; targetId = 'local';
        }
        for (const [pid, entry] of remoteKarts.entries()) {
          if (pid !== botId && !entry.finished && entry.progress < bot.progress && entry.progress > bestBehindProgress) {
            bestBehindProgress = entry.progress; targetId = pid;
          }
        }
      }

      if (targetId === 'local' && !isShieldActive) {
        physics.stunTimer = 1.0;
        if (kart) triggerSparkEffect(kart.position);
      } else if (targetId) {
        const tBot = remoteKarts.get(targetId);
        if (tBot && tBot.isBot && tBot.shieldTimer <= 0) {
          tBot.stunTimer = 1.0;
          triggerSparkEffect(tBot.obj.group.position);
        }
      }
      break;
    case 'LAMA':
      // O Bot tenta sujar a tela de quem estiver na frente dele
      let mudTargetId = null;
      let mudBestAhead = Infinity;
      const localTr = raceTrackers.get('local');

      if (localTr && !localTr.finished && localTr.progress > bot.progress && localTr.progress < mudBestAhead) {
        mudBestAhead = localTr.progress; mudTargetId = 'local';
      }
      for (const [pid, entry] of remoteKarts.entries()) {
        if (pid !== botId && !entry.finished && entry.progress > bot.progress && entry.progress < mudBestAhead) {
          mudBestAhead = entry.progress; mudTargetId = pid;
        }
      }

      if (mudTargetId === 'local' && !isShieldActive) {
        const mudUI = document.getElementById('mudOverlay');
        if (mudUI) {
          mudUI.style.opacity = '0.95';
          setTimeout(() => { mudUI.style.opacity = '0'; }, 3500);
        }
      } else if (mudTargetId) {
        const tBot = remoteKarts.get(mudTargetId);
        if (tBot && tBot.isBot && tBot.shieldTimer <= 0) {
          tBot.speed *= 0.6;
          tBot.laneOffset += (Math.random() > 0.5 ? 4 : -4);
        }
      }
      break;

    case 'DIG':
      castDigAbility(botId); // Agora o bot atira o poder como ele mesmo!
      break;
  }
}

// ------------------------------------------------------------
// TEXTURAS E GEOMETRIA ORGÂNICA DAS ARMADILHAS (decals planos)
// ------------------------------------------------------------
function createBlobShape(radius, points, irregularity) {
  const shape = new THREE.Shape();
  const angleStep = (Math.PI * 2) / points;
  for (let i = 0; i <= points; i++) {
    const angle = i * angleStep;
    const r = radius * (1 - irregularity / 2 + Math.random() * irregularity);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createTrapDecalGeometry(radius, points, irregularity) {
  const shape = createBlobShape(radius, points, irregularity);
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function createIceTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(200,240,250,0.95)');
  grad.addColorStop(0.7, 'rgba(140,215,235,0.85)');
  grad.addColorStop(1, 'rgba(140,215,235,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    let x = size / 2 + (Math.random() - 0.5) * size * 0.3;
    let y = size / 2 + (Math.random() - 0.5) * size * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * 60;
      y += (Math.random() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 10; i++) {
    const x = size / 2 + (Math.random() - 0.5) * size * 0.6;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

function createMudTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(74,20,140,0.95)');
  grad.addColorStop(0.75, 'rgba(50,10,95,0.9)');
  grad.addColorStop(1, 'rgba(50,10,95,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 18; i++) {
    const x = size / 2 + (Math.random() - 0.5) * size * 0.6;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.6;
    const r = 8 + Math.random() * 22;
    ctx.fillStyle = `rgba(30,5,60,${0.2 + Math.random() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(200,150,255,0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const x = size / 2 + (Math.random() - 0.5) * size * 0.5;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 3 + Math.random() * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function createSmokeHazeTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(45, 45, 50, 1.0)'); // Centro bem denso
  grad.addColorStop(0.5, 'rgba(55, 55, 60, 0.95)');
  grad.addColorStop(1, 'rgba(35, 35, 40, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createPuffTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}


const puffTexture = createPuffTexture();

const trapParticles = [];

function spawnAmbientPuff(position, options = {}) {
  const {
    color = 0xffffff,
    opacity = 0.5,
    scale = 0.9,
    scaleVariance = 0.5,
    riseSpeed = 0.35,
    riseVariance = 0.25,
    growth = 0.5,
    growthVariance = 0.4,
    life = 1.6,
    lifeVariance = 0.6,
    spread = 1.6
  } = options;

  const mat = new THREE.SpriteMaterial({ map: puffTexture, color, transparent: true, opacity, depthWrite: false, blending: THREE.NormalBlending });
  const sprite = new THREE.Sprite(mat);
  const s = scale + Math.random() * scaleVariance;
  sprite.scale.set(s, s, 1);
  sprite.position.copy(position);
  sprite.position.x += (Math.random() - 0.5) * spread;
  sprite.position.z += (Math.random() - 0.5) * spread;
  scene.add(sprite);

  trapParticles.push({
    sprite,
    age: 0,
    life: life + Math.random() * lifeVariance,
    riseSpeed: riseSpeed + Math.random() * riseVariance,
    growth: growth + Math.random() * growthVariance,
    baseOpacity: opacity
  });
}

function updateTrapParticles(dt) {
  for (let i = trapParticles.length - 1; i >= 0; i--) {
    const p = trapParticles[i];
    p.age += dt;

    // A fumaça continua subindo e crescendo normalmente
    p.sprite.position.y += p.riseSpeed * dt;
    p.sprite.scale.x += p.growth * dt;
    p.sprite.scale.y += p.growth * dt;

    // TRAVA A OPACIDADE NO MÁXIMO (Evita qualquer tom branco ou translúcido)
    p.sprite.material.opacity = p.baseOpacity;

    // Remove a fumaça subitamente assim que o tempo acaba
    if (p.age >= p.life) {
      scene.remove(p.sprite);
      p.sprite.material.dispose();
      trapParticles.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------
// SISTEMA ANTI-ABANDONO E SAÍDA DA SALA
// ------------------------------------------------------------
const isRankedMatchGlobal = typeof roomCodeParam !== 'undefined' && roomCodeParam && roomCodeParam.trim() !== '' && totalPlayersParam === 4;
let isLeavingRoom = false;

function executarSaidaDaSala() {
  if (isLeavingRoom) return;
  isLeavingRoom = true;

  // 1. Se for o Host, avisa os convidados independentemente de ser ranqueada ou não
  if (isHost && typeof activeGuestConns !== 'undefined') {
    for (const conn of activeGuestConns.values()) {
      if (conn.open) conn.send({ t: 'host_disconnected' });
    }
  }

  // 2. Só aplica a punição de troféus se for ranqueada E a corrida estiver ativa
  if (isRankedMatchGlobal && corridaAtivaParaPunicao && navigator.onLine) {
    aplicarPunicaoAbandonoSincrona();
  }
}

// Intercepta F5 para evitar abandono sem punição
window.addEventListener('keydown', (e) => {
  if (e.code === 'F5') {
    if (typeof roomCodeParam !== 'undefined' && roomCodeParam) {
      e.preventDefault();
      executarSaidaDaSala();
      corridaAtivaParaPunicao = false;
      setTimeout(() => { window.location.href = 'index.html'; }, 50);
    } else if (urlParams.get('mode') === 'tower') {
      registrarDerrotaTorre(); // Reseta a torre ao dar F5
      corridaAtivaParaPunicao = false;
    }
  }
});

// Garante o fechamento limpo se fechar a aba no "X", trocar de URL ou a conexão cair e matar a página
window.addEventListener('pagehide', () => {
  if (typeof roomCodeParam !== 'undefined' && roomCodeParam) {
    executarSaidaDaSala();
  }
  if (urlParams.get('mode') === 'tower') {
    registrarDerrotaTorre(); // Reseta a torre ao fechar o navegador
  }
});

function aplicarPunicaoAbandonoSincrona() {
  if (typeof supabaseClient === 'undefined') return;
  const supabaseUrl = supabaseClient.supabaseUrl;
  const supabaseKey = supabaseClient.supabaseKey;

  supabaseClient.auth.getSession().then(({ data }) => {
    const token = data?.session?.access_token;
    if (token) {
      const endpoint = `${supabaseUrl}/rest/v1/rpc/punir_abandono_partida`;
      const payload = JSON.stringify({});

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseKey
          },
          keepalive: true
        }).catch(() => { });
      }
    }
  });
}

function updateKartEffects(dt) {
  const time = performance.now();

  // 1. Atualiza o jogador local
  if (localKartObj) {
    if (isShieldActive) {
      localKartObj.shieldMesh.visible = true;
      localKartObj.shieldMesh.rotation.y += 2 * dt;
      localKartObj.shieldMesh.rotation.z += 1 * dt;
    } else {
      localKartObj.shieldMesh.visible = false;
    }

    // O Lodo ativa a inversão de controle localmente
    if (isControlInverted) {
      localKartObj.poisonMesh.visible = true;
      const timeSec = performance.now() * 0.003;
      localKartObj.poisonMesh.userData.particles.forEach((p, idx) => {
        p.mesh.position.x = Math.cos(timeSec + idx) * p.radius;
        p.mesh.position.z = Math.sin(timeSec + idx) * p.radius;
        p.mesh.position.y = 0.3 + Math.sin(timeSec * 2 + idx) * 0.2;
      });
    } else {
      localKartObj.poisonMesh.visible = false;
    }

    // --- NOVA ANIMAÇÃO DO SURF ---
    if (physics.isSurfing) {
      localKartObj.surfMesh.visible = true;
      const t = performance.now() * 0.005;
      // Faz as ondas girarem em direções opostas e pulsarem de tamanho
      localKartObj.surfMesh.userData.wave1.rotation.z = t;
      localKartObj.surfMesh.userData.wave1.scale.setScalar(1.0 + Math.sin(t * 1.5) * 0.15);

      localKartObj.surfMesh.userData.wave2.rotation.z = -t * 0.8;
      localKartObj.surfMesh.userData.wave2.scale.setScalar(1.3 + Math.cos(t * 1.5) * 0.15);
    } else {
      localKartObj.surfMesh.visible = false;
    }

    // --- CORREÇÃO: SÓ MOSTRA FOGO SE NÃO ESTIVER SURFANDO ---
    if (physics.turboTimer > 0 && !physics.isSurfing) {
      localKartObj.boostMesh.visible = true;
      localKartObj.boostMesh.scale.z = 0.8 + Math.random() * 0.5;
    } else {
      localKartObj.boostMesh.visible = false;
    }
  }

  // 2. Atualiza bots e jogadores remotos
  for (const [id, bot] of remoteKarts.entries()) {
    if (!bot.obj) continue;

    const hasShield = bot.shieldTimer > 0 || bot.isShieldActive;
    const hasTurbo = bot.turboTimer > 0 || bot.isTurboActive;

    // CORREÇÃO: O veneno agora usa exclusivamente o poisonTimer para bots e isPoisoned para remotos
    const hasPoison = (bot.isBot && bot.poisonTimer > 0) || Boolean(bot.isPoisoned);

    // Escudo
    if (hasShield) {
      bot.obj.shieldMesh.visible = true;
      bot.obj.shieldMesh.rotation.y += 2 * dt;
      bot.obj.shieldMesh.rotation.z += 1 * dt;
    } else {
      bot.obj.shieldMesh.visible = false;
    }

    // Boost (Chamas)
    if (hasTurbo) {
      bot.obj.boostMesh.visible = true;
      bot.obj.boostMesh.scale.z = 0.8 + Math.random() * 0.5;
    } else {
      bot.obj.boostMesh.visible = false;
    }

    // Veneno (Bolinhas roxas)
    if (hasPoison) {
      bot.obj.poisonMesh.visible = true;
      const timeSec = performance.now() * 0.003;
      bot.obj.poisonMesh.userData.particles.forEach((p, idx) => {
        p.mesh.position.x = Math.cos(timeSec + idx) * p.radius;
        p.mesh.position.z = Math.sin(timeSec + idx) * p.radius;
        p.mesh.position.y = 0.3 + Math.sin(timeSec * 2 + idx) * 0.2;
      });
    } else {
      bot.obj.poisonMesh.visible = false;
    }
  }
}

// ------------------------------------------------------------
// LOOP PRINCIPAL
// ------------------------------------------------------------
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  updatePhysics(dt);
  updateDriftEffects(dt);
  updateBots(dt);
  updateCamera(dt);
  updateItemBoxes(dt);
  updateTraps(dt);
  updateTrapParticles(dt);
  networkTick(dt);
  updateRemoteKarts(dt);
  updateKartEffects(dt);
  updateHUD();
  drawMinimap();

  // --- ATUALIZAÇÃO E CRIAÇÃO DAS PARTÍCULAS DE POEIRA ---
  updateDustParticles();
  if (kart && Math.abs(physics.speed) > 15) {
    // Reduzido para soltar menos partículas por segundo
    if (Math.random() < 0.25) {
      spawnDustParticle(kart.position.x, kart.position.y, kart.position.z);
    }
  }
  // -----------------------------------------------------
  updateDigProjectiles(dt);
  composer.render();
}

animate();