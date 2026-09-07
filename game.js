// ------------------------------------------------------------
// SETUP BÁSICO
// ------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 60, 260);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Luz
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

// ------------------------------------------------------------
// PISTA - LOOP OVAL
// ------------------------------------------------------------
const TRACK_PRESETS = {
  oval: [
    new THREE.Vector3(0, 0, -70),
    new THREE.Vector3(50, 0, -65),
    new THREE.Vector3(80, 0, -20),
    new THREE.Vector3(75, 0, 25),
    new THREE.Vector3(40, 0, 55),
    new THREE.Vector3(0, 0, 75),
    new THREE.Vector3(-45, 0, 60),
    new THREE.Vector3(-75, 0, 20),
    new THREE.Vector3(-80, 0, -25),
    new THREE.Vector3(-45, 0, -65)
  ],
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
  crash1: [
    new THREE.Vector3(25, 0, 35),
    new THREE.Vector3(45, 0, 15),
    new THREE.Vector3(50, 0, -35),
    new THREE.Vector3(45, 0, -50),
    new THREE.Vector3(10, 0, -50),
    new THREE.Vector3(-10, 0, -45),
    new THREE.Vector3(-45, 0, -50),
    new THREE.Vector3(-55, 0, -35),
    new THREE.Vector3(-55, 0, 0),
    new THREE.Vector3(-50, 0, 15),
    new THREE.Vector3(-30, 0, 10),
    new THREE.Vector3(-20, 0, -25),
    new THREE.Vector3(-15, 0, -35),
    new THREE.Vector3(-10, 0, -10),
    new THREE.Vector3(-5, 0, -35),
    new THREE.Vector3(0, 0, -25),
    new THREE.Vector3(-5, 0, 25),
    new THREE.Vector3(-20, 0, 50),
    new THREE.Vector3(-10, 0, 65),
    new THREE.Vector3(10, 0, 55)
  ]
};

function getTrackCurve(presetName = 'oval') {
  const points = TRACK_PRESETS[presetName] || TRACK_PRESETS.oval;
  return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
}

const trackCurve = getTrackCurve('circuitoE');
const trackWidth = 10;

const TRACK_SAMPLE_COUNT = 360;
const trackSamples = [];
for (let i = 0; i < TRACK_SAMPLE_COUNT; i++) {
  const t = i / TRACK_SAMPLE_COUNT;
  const point = trackCurve.getPointAt(t);
  const tangent = trackCurve.getTangentAt(t).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  trackSamples.push({ t, point, normal });
}

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
    dir.y = 0;
    dir.normalize();

    let side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

    if (i > 0) {
      const prevSide = sideVectors[i - 1];
      if (side.dot(prevSide) < 0) {
        side.negate();
      }
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
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;

    indices.push(a, b, c);
    indices.push(b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

const trackTexCanvas = document.createElement('canvas');
trackTexCanvas.width = 64; trackTexCanvas.height = 256;
const tctx = trackTexCanvas.getContext('2d');
tctx.fillStyle = '#4a4a52'; tctx.fillRect(0, 0, 64, 256);
tctx.strokeStyle = 'rgba(255,255,255,0.55)';
tctx.lineWidth = 2;
tctx.setLineDash([14, 14]);
tctx.beginPath(); tctx.moveTo(32, 0); tctx.lineTo(32, 256); tctx.stroke();
tctx.strokeStyle = 'rgba(255,255,255,0.9)'; tctx.setLineDash([]);
tctx.lineWidth = 1;
tctx.beginPath();
tctx.moveTo(2, 0);
tctx.lineTo(2, 256);
tctx.moveTo(62, 0);
tctx.lineTo(62, 256);
tctx.stroke();

const trackTexture = new THREE.CanvasTexture(trackTexCanvas);
trackTexture.wrapS = THREE.RepeatWrapping;
trackTexture.wrapT = THREE.RepeatWrapping;
trackTexture.repeat.set(1, 10);
trackTexture.needsUpdate = true;

const trackMesh = new THREE.Mesh(
  buildTrackMesh(),
  new THREE.MeshStandardMaterial({ map: trackTexture, roughness: 0.9, side: THREE.DoubleSide })
);
trackMesh.receiveShadow = true;
scene.add(trackMesh);

const grass = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshStandardMaterial({ color: 0x5a9c4a, roughness: 1 })
);
grass.rotation.x = -Math.PI / 2;
grass.position.y = -0.02;
grass.receiveShadow = true;
scene.add(grass);

function createStripedTireTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#ff5722'; ctx.fillRect(0, 20, 128, 25); ctx.fillRect(0, 75, 128, 25);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const blackTireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
const stripedTireMat = new THREE.MeshStandardMaterial({ map: createStripedTireTexture(), roughness: 0.8 });

function addTires() {
  const tireGeo = new THREE.TorusGeometry(0.5, 0.25, 12, 24);

  for (let i = 0; i < 120; i++) {
    const t = i / 120;
    const point = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const currentMat = (i % 2 === 0) ? blackTireMat : stripedTireMat;

    for (const side of [1, -1]) {
      const pos = point.clone().addScaledVector(normal, side * (trackWidth / 2 + 0.8));
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
      scene.add(tireStack);
    }
  }
}
addTires();

function addStartFinishLine() {
  const point = trackCurve.getPointAt(0);
  const tangent = trackCurve.getTangentAt(0).normalize();
  const heading = Math.atan2(tangent.x, tangent.z);

  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const cctx = c.getContext('2d');

  const cols = 16;
  const rows = 4;
  const sqW = 256 / cols;
  const sqH = 64 / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cctx.fillStyle = ((x + y) % 2 === 0) ? '#ffffff' : '#111111';
      cctx.fillRect(x * sqW, y * sqH, sqW, sqH);
    }
  }

  const checkerTex = new THREE.CanvasTexture(c);

  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(trackWidth, 3.2),
    new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.6 })
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.rotation.z = heading;
  stripe.position.set(point.x, 0.04, point.z);
  stripe.receiveShadow = true;
  scene.add(stripe);

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512; signCanvas.height = 96;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = 'rgba(20,20,20,0.85)';
  sctx.fillRect(0, 0, 512, 96);
  sctx.fillStyle = '#FFD54F';
  sctx.font = 'bold 42px sans-serif';
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.fillText('LARGADA / CHEGADA', 256, 48);

  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 0.8),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide })
  );
  sign.position.set(point.x, 2.3, point.z);
  sign.rotation.y = -heading;
  scene.add(sign);
}
addStartFinishLine();

// ------------------------------------------------------------
// SISTEMA DE SELEÇÃO E CARREGAMENTO DE MULTI-KARTS
// ------------------------------------------------------------
const gltfLoader = new THREE.GLTFLoader();
const KART_MODEL_SCALE = 2.2;
const KART_MODEL_YAW_OFFSET = 0;

// Banco de Dados de Karts com verificação blindada das variáveis no window
const KART_DATABASE = [
  {
    id: 'jolteon',
    name: 'Jolteon Kart',
    image: './img/jolteon2.png',
    // getBase64: () => window.KART_JOLTEON_BASE64 || window.KART_MODEL_BASE64 || null,
    modelUrl: 'https://jhonpires.github.io/pokekart/models/jolteon.glb',
    template: null
  },
  {
    id: 'zoroark',
    name: 'Zoroark Kart',
    image: './img/zoroark2.png',
    // getBase64: () => window.KART_ZOROARK_BASE64 || null,
    modelUrl: 'https://cdn.jsdelivr.net/gh/JhonPires/pokekart@v1.0/zoroark.glb',
    template: null
  },
  {
    id: 'togetic',
    name: 'Togetic Kart',
    image: './img/togetic2.png',
    // getBase64: () => window.KART_TOGETIC_BASE64 || null,
    modelUrl: 'https://cdn.jsdelivr.net/gh/JhonPires/pokekart@v1.0/togetic.glb',
    template: null
  },
  {
    id: 'charizard',
    name: 'Charizard Kart',
    image: './img/charizard2.png',
    // getBase64: () => window.KART_CHARIZARD_BASE64 || null,
    modelUrl: 'https://cdn.jsdelivr.net/gh/JhonPires/pokekart@v1.0/charizard.glb',
    template: null
  },
  {
    id: 'flygon',
    name: 'Flygon Kart',
    image: './img/flygon2.png',
    // getBase64: () => window.KART_FLYGON_BASE64 || null,
    modelUrl: 'https://cdn.jsdelivr.net/gh/JhonPires/pokekart@v1.0/flygon.glb',
    template: null
  },
  {
    id: 'gengar',
    name: 'Gengar Kart',
    image: './img/gengar2.png',
    // getBase64: () => window.KART_GENGAR_BASE64 || null,
    modelUrl: 'https://cdn.jsdelivr.net/gh/JhonPires/pokekart@v1.0/gengar.glb',
    template: null
  },
  {
    id: 'oshawott',
    name: 'Oshawott Kart',
    image: './img/oshawott2.png',
    // getBase64: () => window.KART_OSHAWOTT_BASE64 || null,
    modelUrl: 'https://cdn.jsdelivr.net/gh/JhonPires/pokekart@v1.0/oshawott.glb',
    template: null
  },
  {
    id: 'snorlax',
    name: 'Snorlax Kart',
    image: './img/snorlax2.png',
    // getBase64: () => window.KART_SNORLAX_BASE64 || null,
    modelUrl: 'https://cdn.jsdelivr.net/gh/JhonPires/pokekart@v1.0/snorlax.glb',
    template: null
  }
];

let selectedKartIndex = 0;

function base64ToArrayBuffer(base64) {
  if (!base64 || typeof base64 !== 'string') return null;
  const cleanBase64 = base64.replace(/^data:.*?;base64,/, '').trim();
  const binaryString = window.atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function loadKartTemplate(kartEntry, callback) {
  // Se o modelo já foi carregado anteriormente, reaproveita da memória
  if (kartEntry.template) {
    if (callback) callback(kartEntry.template);
    return;
  }

  if (!kartEntry.modelUrl) {
    console.warn(`[GLB] URL para "${kartEntry.name}" não encontrada.`);
    if (callback) callback(null);
    return;
  }

  // Carrega o arquivo binário .glb sob demanda
  gltfLoader.load(
    kartEntry.modelUrl,
    (gltf) => {
      kartEntry.template = gltf.scene;
      if (callback) callback(kartEntry.template);
    },
    undefined,
    (err) => {
      console.error(`[GLB] Erro ao carregar arquivo de ${kartEntry.name}:`, err);
      if (callback) callback(null);
    }
  );
}

function applyModelToGroup(group, templateScene, chassisColor) {
  while (group.children.length) group.remove(group.children[0]);
  if (templateScene) {
    const instance = templateScene.clone(true);
    instance.scale.setScalar(KART_MODEL_SCALE);
    instance.rotation.y = KART_MODEL_YAW_OFFSET;
    instance.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    group.add(instance);
  } else {
    // Exibe a caixa caso o Base64 esteja ausente ou falhar
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.9, 2.2),
      new THREE.MeshStandardMaterial({ color: chassisColor })
    );
    fallback.position.y = 0.45;
    group.add(fallback);
  }
}

function createKart(chassisColor) {
  const group = new THREE.Group();
  scene.add(group);
  return { group, wheels: [] };
}

// ------------------------------------------------------------
// INICIALIZAÇÃO DO KART LOCAL
// ------------------------------------------------------------
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
};

function setLocalKartModel(kartEntry) {
  loadKartTemplate(kartEntry, (template) => {
    if (!kart) {
      localKartObj = createKart(0xE53935);
      kart = localKartObj.group;
      wheels = localKartObj.wheels;
    }
    applyModelToGroup(kart, template, 0xE53935);

    const START_LINE_T = 0.98;
    const startPoint = trackCurve.getPointAt(START_LINE_T);
    const startTangent = trackCurve.getTangentAt(START_LINE_T);
    kart.position.copy(startPoint);
    kart.rotation.y = Math.atan2(startTangent.x, startTangent.z);
    physics.heading = kart.rotation.y;
  });
}

// Seletor no Lobby
const btnPrevKart = document.getElementById('btnPrevKart');
const btnNextKart = document.getElementById('btnNextKart');
const kartPreviewImg = document.getElementById('kartPreview');
const kartNameTxt = document.getElementById('kartName');

function updateKartSelectorUI() {
  const current = KART_DATABASE[selectedKartIndex];
  if (kartPreviewImg) kartPreviewImg.src = current.image;
  if (kartNameTxt) kartNameTxt.innerText = current.name;
  setLocalKartModel(current);
}

if (btnPrevKart) {
  btnPrevKart.onclick = () => {
    selectedKartIndex = (selectedKartIndex - 1 + KART_DATABASE.length) % KART_DATABASE.length;
    updateKartSelectorUI();
  };
}

if (btnNextKart) {
  btnNextKart.onclick = () => {
    selectedKartIndex = (selectedKartIndex + 1) % KART_DATABASE.length;
    updateKartSelectorUI();
  };
}

updateKartSelectorUI();

// Controles do teclado
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

const TOTAL_LAPS = 3;
const speedfill = document.getElementById('speedfill');
const turboLabel = document.getElementById('turboLabel');
const lapcountEl = document.getElementById('lapcount');
const standingsListEl = document.getElementById('standingsList');
if (document.getElementById('totallaps')) {
  document.getElementById('totallaps').textContent = TOTAL_LAPS;
}

// ------------------------------------------------------------
// MENU DE PAUSA (ESC)
// ------------------------------------------------------------
let isPaused = false;
const pauseMenuEl = document.getElementById('pauseMenu');
const btnReturnLobbyEl = document.getElementById('btnReturnLobby');

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (lobbyEl && lobbyEl.style.display === 'none') {
      isPaused = !isPaused;
      if (pauseMenuEl) pauseMenuEl.style.display = isPaused ? 'flex' : 'none';
    }
  }
});

if (btnReturnLobbyEl) {
  btnReturnLobbyEl.onclick = () => {
    isPaused = false;
    if (pauseMenuEl) pauseMenuEl.style.display = 'none';

    if (kart) {
      const START_LINE_T = 0.98;
      const startPoint = trackCurve.getPointAt(START_LINE_T);
      const startTangent = trackCurve.getTangentAt(START_LINE_T);
      kart.position.copy(startPoint);
      kart.rotation.y = Math.atan2(startTangent.x, startTangent.z);
      physics.heading = kart.rotation.y;
      physics.speed = 0;
    }

    if (lobbyEl) lobbyEl.style.display = 'flex';
  };
}

function updatePhysics(dt) {
  if (!kart || isPaused) return;

  const raceOver = raceTrackers.get('local')?.finished;
  const forward = !raceOver && (keys['KeyW'] || keys['ArrowUp']);
  const backward = !raceOver && (keys['KeyS'] || keys['ArrowDown']);
  const left = !raceOver && (keys['KeyA'] || keys['ArrowLeft']);
  const right = !raceOver && (keys['KeyD'] || keys['ArrowRight']);
  const driftKey = !raceOver && keys['Space'];

  if (forward) {
    physics.speed += physics.accel * dt;
  } else if (backward) {
    physics.speed -= physics.brakeDecel * dt;
  } else {
    if (physics.speed > 0) physics.speed = Math.max(0, physics.speed - physics.friction * dt);
    else if (physics.speed < 0) physics.speed = Math.min(0, physics.speed + physics.friction * dt);
  }

  let currentMax = physics.maxSpeed;
  if (physics.turboTimer > 0) {
    physics.turboTimer -= dt;
    currentMax *= 1.4;
  }

  physics.speed = THREE.MathUtils.clamp(physics.speed, physics.maxReverse, currentMax);

  const turnInput = (left ? 1 : 0) - (right ? 1 : 0);
  const movingFactor = THREE.MathUtils.clamp(Math.abs(physics.speed) / physics.maxSpeed, 0.15, 1);
  const canDrift = driftKey && (left || right) && Math.abs(physics.speed) > physics.maxSpeed * 0.4;

  if (canDrift && !backward) {
    if (!physics.isDrifting) {
      physics.isDrifting = true;
      physics.driftDirection = turnInput !== 0 ? Math.sign(turnInput) : (left ? 1 : -1);
      physics.driftCharge = 0;
    }
    physics.driftCharge += dt;
    physics.heading += physics.driftDirection * physics.turnSpeed * 0.6 * movingFactor * dt;
    physics.driftFactor = Math.min(1, physics.driftFactor + dt * 2);
  } else {
    if (physics.isDrifting) {
      if (physics.driftCharge > 1.6) {
        physics.turboTimer = 1.1;
        flashTurbo();
      } else if (physics.driftCharge > 0.8) {
        physics.turboTimer = 0.55;
        flashTurbo();
      }
    }
    physics.isDrifting = false;
    physics.driftCharge = 0;
    physics.driftFactor = Math.max(0, physics.driftFactor - dt * 3);
    physics.heading += turnInput * physics.turnSpeed * movingFactor * dt;
  }

  const slideBlend = physics.driftFactor * 0.35;
  const slipHeading = physics.heading - physics.driftDirection * slideBlend;
  const moveDir = new THREE.Vector3(Math.sin(slipHeading), 0, Math.cos(slipHeading));

  kart.position.addScaledVector(moveDir, physics.speed * dt);
  kart.rotation.y = physics.heading;

  enforceTrackBoundary();

  const targetTilt = physics.isDrifting ? physics.driftDirection * 0.18 : 0;
  kart.rotation.z += (targetTilt - kart.rotation.z) * Math.min(1, dt * 6);

  wheels.forEach(w => w.rotation.x -= physics.speed * dt * 2);

  if (speedfill) {
    const pct = THREE.MathUtils.clamp((physics.speed / (physics.maxSpeed * 1.4)) * 100, 0, 100);
    speedfill.style.width = pct + '%';
  }
}

let turboFlashTimer = 0;
function flashTurbo() {
  if (turboLabel) {
    turboLabel.style.opacity = '1';
    turboFlashTimer = 0.8;
  }
}

// ------------------------------------------------------------
// COLISÃO COM A BORDA
// ------------------------------------------------------------
const BOUNDARY_MARGIN = 0.6;
const boundaryLimit = trackWidth / 2 + BOUNDARY_MARGIN;

function enforceTrackBoundary() {
  if (!kart) return;
  const { sample } = nearestTrackSample(kart.position);
  const offset = new THREE.Vector3().subVectors(kart.position, sample.point);
  const lateral = offset.dot(sample.normal);

  if (Math.abs(lateral) > boundaryLimit) {
    const sign = Math.sign(lateral);
    const along = offset.clone().addScaledVector(sample.normal, -lateral);
    kart.position.copy(sample.point.clone().add(along).addScaledVector(sample.normal, sign * boundaryLimit));
    physics.speed *= 0.55;
  }
}

// ------------------------------------------------------------
// PROGRESSO DE CORRIDA (Com validação de checkpoint)
// ------------------------------------------------------------
const raceTrackers = new Map();

function updateRaceTracker(key, position) {
  let tr = raceTrackers.get(key);
  if (!tr) {
    tr = { lapCount: 1, lastT: 0, progress: 0, finished: false, finishTime: null, passedMidpoint: false };
    raceTrackers.set(key, tr);
  }
  if (tr.finished) return tr;

  const t = nearestTrackSample(position).sample.t;

  if (t > 0.4 && t < 0.6) {
    tr.passedMidpoint = true;
  }

  if (tr.lastT > 0.85 && t < 0.15) {
    if (tr.passedMidpoint) {
      if (tr.lapCount >= TOTAL_LAPS) {
        tr.finished = true;
        tr.finishTime = performance.now();
      } else {
        tr.lapCount++;
      }
      tr.passedMidpoint = false;
    }
  }

  tr.lastT = t;
  tr.progress = tr.finished ? TOTAL_LAPS : (tr.lapCount - 1) + t;
  return tr;
}

function updateStandingsHUD() {
  const rows = [{ key: 'local', label: 'Você', tr: raceTrackers.get('local') }];
  for (const pid of remoteKarts.keys()) {
    rows.push({ key: pid, label: friendLabel(pid), tr: raceTrackers.get(pid) });
  }
  rows.forEach(r => { if (!r.tr) r.tr = { progress: 0, finished: false, finishTime: Infinity }; });

  rows.sort((a, b) => {
    if (a.tr.finished && b.tr.finished) return a.tr.finishTime - b.tr.finishTime;
    if (a.tr.finished) return -1;
    if (b.tr.finished) return 1;
    return b.tr.progress - a.tr.progress;
  });

  if (standingsListEl) {
    standingsListEl.innerHTML = rows
      .map((r, i) => `${i + 1}º ${r.label}${r.tr.finished ? ' 🏁' : ''}`)
      .join('<br>');
  }

  return rows;
}

let localFinishNotified = false;
function showFinishOverlay(place, totalRacers) {
  const overlay = document.createElement('div');
  overlay.id = 'finishOverlay';
  overlay.innerHTML = `
    <h1 style="margin:0;">🏁 Corrida Finalizada!</h1>
    <div style="font-size:20px;">Você terminou em ${place}º lugar${totalRacers > 1 ? ' de ' + totalRacers : ''}!</div>
    <button id="btnRestart" class="lobbyBtn">Jogar novamente</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById('btnRestart').onclick = () => location.reload();
}

let hudTimer = 0;

// ------------------------------------------------------------
// SISTEMA DE ÁUDIO
// ------------------------------------------------------------
const sounds = {
  engine: new Audio('https://assets.mixkit.co/active_storage/sfx/2808/2808-preview.mp3'),
  brake: new Audio('https://assets.mixkit.co/active_storage/sfx/2809/2809-preview.mp3'),
  hit: new Audio('https://assets.mixkit.co/active_storage/sfx/2810/2810-preview.mp3')
};

sounds.engine.loop = true;
sounds.engine.volume = 0.3;
sounds.brake.loop = true;
sounds.brake.volume = 0.4;
sounds.hit.volume = 0.6;

let audioInitialized = false;
window.addEventListener('click', () => {
  if (!audioInitialized) {
    sounds.engine.play().catch(() => { });
    sounds.engine.pause();
    audioInitialized = true;
  }
}, { once: true });

function updateAudio(physics, keys) {
  if (!audioInitialized || !kart || isPaused) {
    if (sounds.engine && !sounds.engine.paused) sounds.engine.pause();
    return;
  }

  const currentSpeed = Math.abs(physics.speed || 0);
  const isAccelerating = keys['ArrowUp'] || keys['w'] || keys['W'];
  const isBraking = keys['ArrowDown'] || keys['s'] || keys['S'];

  if (currentSpeed > 0.1 || isAccelerating) {
    if (sounds.engine.paused) sounds.engine.play().catch(() => { });
    sounds.engine.playbackRate = Math.min(2.0, Math.max(0.8, 0.8 + (currentSpeed / 50)));
  } else {
    sounds.engine.pause();
  }

  if (isBraking && currentSpeed > 2.0) {
    if (sounds.brake.paused) sounds.brake.play().catch(() => { });
  } else {
    sounds.brake.pause();
  }
}

// ------------------------------------------------------------
// ZOOM DA CÂMERA
// ------------------------------------------------------------
const ZOOM_LEVELS = [20, 25];
let currentZoomIndex = 1;

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'c') {
    currentZoomIndex = (currentZoomIndex + 1) % ZOOM_LEVELS.length;
    camera.fov = ZOOM_LEVELS[currentZoomIndex];
    camera.updateProjectionMatrix();
  }
});

const camOffset = new THREE.Vector3(0, 5, -9);

function updateCamera(dt) {
  if (!kart) return;

  const desired = kart.position.clone().add(
    camOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.heading)
  );
  desired.y = kart.position.y + 5;
  camera.position.lerp(desired, Math.min(1, dt * 4));

  const lookAt = kart.position.clone();
  lookAt.y += 1.2;
  camera.lookAt(lookAt);

  if (camera.fov !== ZOOM_LEVELS[currentZoomIndex]) {
    camera.fov = ZOOM_LEVELS[currentZoomIndex];
    camera.updateProjectionMatrix();
  }
}

// ------------------------------------------------------------
// MULTIPLAYER (PeerJS)
// ------------------------------------------------------------
const remoteKarts = new Map();
const REMOTE_COLORS = [0x1E88E5, 0x43A047, 0x8E24AA, 0xFB8C00, 0x00ACC1, 0xD81B60];

function remoteColorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return REMOTE_COLORS[hash % REMOTE_COLORS.length];
}

function getOrCreateRemoteKart(peerId) {
  if (remoteKarts.has(peerId)) return remoteKarts.get(peerId);
  const obj = createKart(remoteColorFromId(peerId));
  const entry = { obj, target: { pos: obj.group.position.clone(), ry: 0, rz: 0, speed: 0 } };
  remoteKarts.set(peerId, entry);
  updateConnStatus();
  return entry;
}

function removeRemoteKart(peerId) {
  const entry = remoteKarts.get(peerId);
  if (!entry) return;
  scene.remove(entry.obj.group);
  remoteKarts.delete(peerId);
  updateConnStatus();
}

function shortestAngleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function randomRoomCode(len = 5) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

let peer = null;
let isHost = false;
let hostConnection = null;
const guestConnections = new Map();

const lobbyEl = document.getElementById('lobby');
const lobbyStatusEl = document.getElementById('lobbyStatus');
const roomCodeEl = document.getElementById('roomCodeDisplay');
const connStatusEl = document.getElementById('connStatus');
const playerListEl = document.getElementById('playerList');
const btnStartRaceEl = document.getElementById('btnStartRace');

function friendLabel(peerId) {
  return 'Amigo ' + peerId.replace('pkart-', '').slice(-4).toUpperCase();
}

function renderPlayerList(players) {
  if (!playerListEl) return;
  playerListEl.innerHTML = players
    .map(p => `• ${p.label}${p.id === peer.id ? ' (você)' : ''}`)
    .join('<br>');
}

function broadcastRoster() {
  const players = [{ id: peer.id, label: 'Host' }];
  for (const pid of guestConnections.keys()) players.push({ id: pid, label: friendLabel(pid) });
  renderPlayerList(players);
  const payload = { t: 'roster', players };
  for (const conn of guestConnections.values()) if (conn.open) conn.send(payload);
}

function updateConnStatus() {
  if (!connStatusEl) return;
  if (!peer) { connStatusEl.textContent = ''; return; }
  if (isHost) {
    connStatusEl.textContent = `Hospedando sala • ${remoteKarts.size} amigo(s) conectado(s)`;
  } else if (hostConnection) {
    connStatusEl.textContent = hostConnection.open ? 'Conectado à sala' : 'Conectando...';
  }
}

function handleGuestData(peerId, data) {
  if (data.t !== 'state') return;
  const entry = getOrCreateRemoteKart(peerId);
  entry.target.pos.set(data.x, data.y, data.z);
  entry.target.ry = data.ry;
  entry.target.rz = data.rz;
  entry.target.speed = data.speed;
}

function handleHostData(data) {
  if (data.t === 'roster') { renderPlayerList(data.players); return; }
  if (data.t === 'start') { if (lobbyEl) lobbyEl.style.display = 'none'; return; }
  if (data.t !== 'snapshot') return;
  for (const [peerId, s] of Object.entries(data.karts)) {
    if (peerId === peer.id) continue;
    const entry = getOrCreateRemoteKart(peerId);
    entry.target.pos.set(s.x, s.y, s.z);
    entry.target.ry = s.ry;
    entry.target.rz = s.rz;
    entry.target.speed = s.speed;
  }
}

function startHosting() {
  if (lobbyStatusEl) lobbyStatusEl.textContent = 'Criando sala...';
  const code = randomRoomCode();
  peer = new Peer('pkart-' + code.toLowerCase());
  peer.on('open', () => {
    isHost = true;
    if (roomCodeEl) {
      roomCodeEl.style.display = 'block';
      roomCodeEl.textContent = code;
    }
    if (btnStartRaceEl) btnStartRaceEl.style.display = 'inline-block';
    if (lobbyStatusEl) lobbyStatusEl.textContent = 'Sala criada! Mande esse código pros seus amigos.';
    broadcastRoster();
    updateConnStatus();
  });
  peer.on('connection', (conn) => {
    guestConnections.set(conn.peer, conn);
    conn.on('data', (data) => handleGuestData(conn.peer, data));
    conn.on('close', () => { guestConnections.delete(conn.peer); removeRemoteKart(conn.peer); broadcastRoster(); updateConnStatus(); });
    conn.on('open', () => broadcastRoster());
    updateConnStatus();
  });
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      if (lobbyStatusEl) lobbyStatusEl.textContent = 'Código já em uso, tentando outro...';
      startHosting();
    } else {
      if (lobbyStatusEl) lobbyStatusEl.textContent = 'Erro ao criar sala: ' + err.type;
      console.error('[PeerJS]', err);
    }
  });
}

function joinRoom(code) {
  if (lobbyStatusEl) lobbyStatusEl.textContent = 'Conectando...';
  peer = new Peer();
  peer.on('open', () => {
    hostConnection = peer.connect('pkart-' + code.trim().toLowerCase());
    hostConnection.on('open', () => {
      if (lobbyStatusEl) lobbyStatusEl.textContent = 'Conectado! Aguardando o host iniciar a corrida...';
      updateConnStatus();
    });
    hostConnection.on('data', handleHostData);
    hostConnection.on('close', () => { if (lobbyStatusEl) lobbyStatusEl.textContent = 'Conexão com a sala perdida.'; });
  });
  peer.on('error', (err) => {
    if (lobbyStatusEl) lobbyStatusEl.textContent = 'Não achei essa sala (código errado ou sala fechada).';
    console.error('[PeerJS]', err);
  });
}

if (document.getElementById('btnHost')) document.getElementById('btnHost').onclick = startHosting;
if (document.getElementById('btnJoin')) document.getElementById('btnJoin').onclick = () => { document.getElementById('joinBox').style.display = 'flex'; };
if (document.getElementById('btnConnect')) document.getElementById('btnConnect').onclick = () => {
  const code = document.getElementById('joinCode').value.trim();
  if (code) joinRoom(code);
};
if (document.getElementById('btnPlaySolo')) document.getElementById('btnPlaySolo').onclick = () => { if (lobbyEl) lobbyEl.style.display = 'none'; };
if (btnStartRaceEl) btnStartRaceEl.onclick = () => {
  const payload = { t: 'start' };
  for (const conn of guestConnections.values()) if (conn.open) conn.send(payload);
  if (lobbyEl) lobbyEl.style.display = 'none';
};

let netTimer = 0;
const NET_INTERVAL = 1 / 12;
function networkTick(dt) {
  if (!peer || !peer.id || !kart || isPaused) return;
  netTimer += dt;
  if (netTimer < NET_INTERVAL) return;
  netTimer = 0;

  const myState = { x: kart.position.x, y: kart.position.y, z: kart.position.z, ry: physics.heading, rz: kart.rotation.z, speed: physics.speed };

  if (isHost) {
    const karts = { [peer.id]: myState };
    for (const [pid, entry] of remoteKarts) {
      karts[pid] = { x: entry.target.pos.x, y: entry.target.pos.y, z: entry.target.pos.z, ry: entry.target.ry, rz: entry.target.rz, speed: entry.target.speed };
    }
    const payload = { t: 'snapshot', karts };
    for (const conn of guestConnections.values()) {
      if (conn.open) conn.send(payload);
    }
  } else if (hostConnection && hostConnection.open) {
    hostConnection.send({ t: 'state', ...myState });
  }
}

function updateRemoteKarts(dt) {
  for (const entry of remoteKarts.values()) {
    const g = entry.obj.group;
    const smoothing = Math.min(1, dt * 8);
    g.position.lerp(entry.target.pos, smoothing);
    g.rotation.y += shortestAngleDiff(g.rotation.y, entry.target.ry) * smoothing;
    g.rotation.z += (entry.target.rz - g.rotation.z) * smoothing;
    entry.obj.wheels.forEach(w => w.rotation.x -= entry.target.speed * dt * 2);
  }
}

function updateHUD(currentSpeed, maxSpeed, currentLap, position) {
  const hudPlayerName = document.getElementById('hud-player-name');
  const hudCurrentLap = document.getElementById('hud-current-lap');
  const hudTotalLaps = document.getElementById('hud-total-laps');
  const hudPosition = document.getElementById('hud-position');
  const hudSpeed = document.getElementById('hud-speed');
  const hudSpeedBar = document.getElementById('speedfill');

  if (hudPlayerName) hudPlayerName.innerText = "VOCÊ";
  if (hudCurrentLap) hudCurrentLap.innerText = currentLap || 1;
  if (hudTotalLaps) hudTotalLaps.innerText = "3";
  if (hudPosition) hudPosition.innerText = `${position || 1}º`;

  const displaySpeed = Math.floor(currentSpeed * 3.6);
  if (hudSpeed) hudSpeed.innerText = displaySpeed;

  if (hudSpeedBar) {
    const speedPercentage = Math.min(100, Math.max(0, ((currentSpeed || 0) / (maxSpeed || 1.5)) * 100));
    hudSpeedBar.style.width = `${speedPercentage}%`;
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

  // updateAudio(physics, keys);
  updatePhysics(dt);
  updateCamera(dt);
  updateRemoteKarts(dt);
  networkTick(dt);

  if (turboFlashTimer > 0) {
    turboFlashTimer -= dt;
    if (turboFlashTimer <= 0 && turboLabel) turboLabel.style.opacity = '0';
  }

  hudTimer += dt;
  if (hudTimer > 0.15) {
    hudTimer = 0;

    if (kart) {
      const localTr = updateRaceTracker('local', kart.position);
      for (const pid of remoteKarts.keys()) {
        updateRaceTracker(pid, remoteKarts.get(pid).obj.group.position);
      }

      if (lapcountEl) lapcountEl.textContent = localTr.lapCount;

      const rows = updateStandingsHUD();
      const myRank = rows.findIndex(r => r.key === 'local') + 1 || 1;

      const speed = Math.abs(physics.speed);
      const maxSpd = physics.maxSpeed;
      updateHUD(speed, maxSpd, localTr.lapCount, myRank);

      if (localTr.finished && !localFinishNotified) {
        localFinishNotified = true;
        const place = rows.findIndex(r => r.key === 'local') + 1;
        showFinishOverlay(place, rows.length);
      }
    }
  }

  renderer.render(scene, camera);
}
animate();