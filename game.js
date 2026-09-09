// ------------------------------------------------------------
// SETUP BÁSICO DA CORRIDA
// ------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 60, 260);

const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Luz Principal
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

// ------------------------------------------------------------
// DATABASE E URLS
// ------------------------------------------------------------
function getKartUrl(filename) {
  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  return isLocal ? `./models/${filename}` : `https://media.githubusercontent.com/media/JhonPires/pokekart/main/models/${filename}`;
}

const KART_DATABASE = [
  {
    id: 'jolteon',
    name: 'Jolteon Kart',
    modelUrl: getKartUrl('jolteon.glb'),
    stats: { accel: 32, maxSpeed: 29, turnSpeed: 3.2, turboBonus: 1.0, driftRate: 1.5, driftControl: 1.1, grip: 0.85 }
  },
  {
    id: 'zoroark',
    name: 'Zoroark Kart',
    modelUrl: getKartUrl('zoroark.glb'),
    stats: { accel: 27, maxSpeed: 31, turnSpeed: 3.2, turboBonus: 1.0, driftRate: 1.4, driftControl: 1.2, grip: 0.75 }
  },
  {
    id: 'togetic',
    name: 'Togetic Kart',
    modelUrl: getKartUrl('togetic.glb'),
    stats: { accel: 28.5, maxSpeed: 28.5, turnSpeed: 4.0, turboBonus: 1.2, driftRate: 1.1, driftControl: 1.0, grip: 0.80 }
  },
  {
    id: 'charizard',
    name: 'Charizard Kart',
    modelUrl: getKartUrl('charizard.glb'),
    stats: { accel: 25, maxSpeed: 33, turnSpeed: 3.4, turboBonus: 1.6, driftRate: 1.0, driftControl: 0.8, grip: 0.65 }
  },
  {
    id: 'flygon',
    name: 'Flygon Kart',
    modelUrl: getKartUrl('flygon.glb'),
    stats: { accel: 26, maxSpeed: 35, turnSpeed: 3.1, turboBonus: 1.1, driftRate: 1.6, driftControl: 1.1, grip: 0.70 }
  },
  {
    id: 'gengar',
    name: 'Gengar Kart',
    modelUrl: getKartUrl('gengar.glb'),
    stats: { accel: 29, maxSpeed: 30, turnSpeed: 3.3, turboBonus: 1.0, driftRate: 1.3, driftControl: 1.3, grip: 0.55 }
  },
  {
    id: 'oshawott',
    name: 'Oshawott Kart',
    modelUrl: getKartUrl('oshawott.glb'),
    stats: { accel: 31, maxSpeed: 30, turnSpeed: 3.2, turboBonus: 1.1, driftRate: 1.0, driftControl: 1.0, grip: 0.70 }
  },
  {
    id: 'snorlax',
    name: 'Snorlax Kart',
    modelUrl: getKartUrl('snorlax.glb'),
    stats: { accel: 21, maxSpeed: 38, turnSpeed: 3.0, turboBonus: 2.0, driftRate: 0.8, driftControl: 1.1, grip: 0.85 }
  }
];

const urlParams = new URLSearchParams(window.location.search);
const playerNickname = (urlParams.get('nick') || 'JOGADOR').toUpperCase();
const selectedKartId = urlParams.get('kart') || 'jolteon';
const roomCodeParam = urlParams.get('room');
const playerSlotParam = parseInt(urlParams.get('slot') || '0', 10);

let selectedKartIndex = KART_DATABASE.findIndex(k => k.id === selectedKartId);
if (selectedKartIndex === -1) selectedKartIndex = 0;

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
  ]
};

function getTrackCurve() {
  return new THREE.CatmullRomCurve3(TRACK_PRESETS.circuitoE, true, 'centripetal', 0.5);
}

const trackCurve = getTrackCurve();
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
trackTexCanvas.width = 64; trackTexCanvas.height = 256;
const tctx = trackTexCanvas.getContext('2d');
tctx.fillStyle = '#4a4a52'; tctx.fillRect(0, 0, 64, 256);
tctx.strokeStyle = 'rgba(255,255,255,0.55)';
tctx.lineWidth = 2; tctx.setLineDash([14, 14]);
tctx.beginPath(); tctx.moveTo(32, 0); tctx.lineTo(32, 256); tctx.stroke();
tctx.strokeStyle = 'rgba(255,255,255,0.9)'; tctx.setLineDash([]);
tctx.lineWidth = 1;
tctx.beginPath();
tctx.moveTo(2, 0); tctx.lineTo(2, 256);
tctx.moveTo(62, 0); tctx.lineTo(62, 256);
tctx.stroke();

const trackTexture = new THREE.CanvasTexture(trackTexCanvas);
trackTexture.wrapS = THREE.RepeatWrapping; trackTexture.wrapT = THREE.RepeatWrapping;
trackTexture.repeat.set(1, 10);
trackTexture.needsUpdate = true;

const trackMesh = new THREE.Mesh(
  buildTrackMesh(),
  new THREE.MeshStandardMaterial({ map: trackTexture, roughness: 0.9, side: THREE.DoubleSide })
);
trackMesh.receiveShadow = true;
scene.add(trackMesh);

function createKerbTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const stripeWidth = 32;
  for (let i = 0; i < 128; i += stripeWidth) {
    ctx.fillStyle = (i / stripeWidth) % 2 === 0 ? '#e53935' : '#ffffff';
    ctx.fillRect(i, 0, stripeWidth, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 1);
  return texture;
}

const kerbMaterial = new THREE.MeshStandardMaterial({
  map: createKerbTexture(),
  roughness: 0.6
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
    scene.add(kerbMesh);
  });
}
addTrackKerbs();

function createStripedGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const stripeHeight = 32;
  for (let i = 0; i < 256; i += stripeHeight) {
    ctx.fillStyle = (i / stripeHeight) % 2 === 0 ? '#519e3e' : '#438a32';
    ctx.fillRect(0, i, 256, stripeHeight);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  return texture;
}

const grass = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshStandardMaterial({ map: createStripedGrassTexture(), roughness: 0.9 })
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
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
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
  scene.add(stripe);
}
addStartFinishLine();

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
const gltfLoader = new THREE.GLTFLoader();
const KART_MODEL_SCALE = 2.2;

function loadKartTemplate(kartEntry, callback) {
  if (kartEntry.template) {
    if (callback) callback(kartEntry.template);
    return;
  }
  gltfLoader.load(
    kartEntry.modelUrl,
    (gltf) => {
      kartEntry.template = gltf.scene;
      if (callback) callback(kartEntry.template);
    },
    undefined,
    (err) => {
      console.error(`[GLB] Erro ao carregar ${kartEntry.name}:`, err);
      if (callback) callback(null);
    }
  );
}

function applyModelToGroup(group, templateScene, chassisColor) {
  while (group.children.length) group.remove(group.children[0]);
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

function createKart(chassisColor) {
  const group = new THREE.Group();
  scene.add(group);
  return { group, wheels: [] };
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
  if (localKartLoaded && !countdownStarted) {
    countdownStarted = true;
    setTimeout(() => {
      startCountdown();
    }, 1500);
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

if (btnReturnLobbyEl) {
  btnReturnLobbyEl.onclick = () => {
    window.location.href = 'index.html';
  };
}

const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

const ZOOM_LEVELS = [20, 25];
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
  const forward = !raceOver && (keys['KeyW'] || keys['ArrowUp']);
  const backward = !raceOver && (keys['KeyS'] || keys['ArrowDown']);

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

  const turnInput = (left ? 1 : 0) - (right ? 1 : 0);
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
    const maxGrassSpeed = 4.5; // ~16 km/h na grama
    if (physics.speed > maxGrassSpeed) {
      physics.speed = THREE.MathUtils.lerp(physics.speed, maxGrassSpeed, 0.1);
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
function updateCamera(dt) {
  if (!kart) return;
  const desired = kart.position.clone().add(camOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.heading));
  desired.y = kart.position.y + 5;
  camera.position.lerp(desired, Math.min(1, dt * 4));
  camera.lookAt(kart.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
}

// ------------------------------------------------------------
// SISTEMA DE CORRIDA E CHECKPOINTS
// ------------------------------------------------------------
const TOTAL_LAPS = 3;
const raceTrackers = new Map();

function updateRaceTracker(key, position) {
  let tr = raceTrackers.get(key);
  if (!tr) {
    tr = { lapCount: 1, lastRawT: 0, progress: 0, finished: false, finishTime: null, passedMidpoint: false };
    raceTrackers.set(key, tr);
  }
  if (tr.finished) return tr;

  const rawT = nearestTrackSample(position).sample.t;

  if (rawT > 0.4 && rawT < 0.6) {
    tr.passedMidpoint = true;
  }

  if (tr.lastRawT > 0.85 && rawT < 0.15) {
    if (tr.passedMidpoint) {
      if (tr.lapCount >= TOTAL_LAPS) {
        if (!tr.finished) {
          tr.finished = true;
          tr.finishTime = Date.now(); // Carimbo sincronizado absoluto
        }
      } else {
        tr.lapCount++;
      }
      tr.passedMidpoint = false;
    }
  }

  tr.lastRawT = rawT;
  tr.progress = tr.finished ? TOTAL_LAPS : (tr.lapCount - 1) + rawT;
  return tr;
}

let localFinishNotified = false;
async function showFinishOverlay(place) {
  const rewards = {
    1: { coins: 150, trophies: 25 },
    2: { coins: 90, trophies: 12 },
    3: { coins: 50, trophies: 4 },
    4: { coins: 20, trophies: -5 }
  };

  const currentReward = rewards[place] || { coins: 10, trophies: 0 };

  if (typeof addRewards === 'function') {
    await addRewards(currentReward.coins, currentReward.trophies);
  }

  const overlay = document.createElement('div');
  overlay.id = 'finishOverlay';
  overlay.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85); display: flex; flex-direction: column;
    align-items: center; justify-content: center; z-index: 300; color: #fff;
  `;
  overlay.innerHTML = `
    <h1 style="margin:0; color:#FFD54F; font-size:40px;">🏁 Corrida Finalizada!</h1>
    <div style="font-size:24px; margin: 15px 0;">Você terminou em ${place}º lugar!</div>
    <div style="font-size:20px; color:#4CAF50; margin-bottom: 20px;">
      Recompensa: +${currentReward.coins} 🪙 | ${currentReward.trophies >= 0 ? '+' : ''}${currentReward.trophies} 🏆
    </div>
    <button id="btnRestart" style="background:#FFD54F; color:#0f172a; border:none; padding:12px 24px; font-size:18px; font-weight:bold; border-radius:8px; cursor:pointer;">Continuar</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById('btnRestart').onclick = () => window.location.href = 'index.html';
}

// ------------------------------------------------------------
// POKÉBOLAS, ARMADILHAS E HABILIDADES NO (X)
// ------------------------------------------------------------
const SKILLS = {
  TURBO: { id: 'TURBO', name: 'Aceleração de Fogo', icon: '🔥' },
  ICE: { id: 'ICE', name: 'Gelo na Pista', icon: '❄️' },
  LODO: { id: 'LODO', name: 'Lodo Obscuro', icon: '💩' },
  SHIELD: { id: 'SHIELD', name: 'Proteção', icon: '🛡️' },
  CHOQUE: { id: 'CHOQUE', name: 'Trovoada Elétrica', icon: '⚡' },
  FUMACA: { id: 'FUMACA', name: 'Cortina de Fumaça', icon: '💨' }
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

const iceTrapMat = new THREE.MeshStandardMaterial({ color: 0x80deea, transparent: true, opacity: 0.8, roughness: 0.1 });
const lodoTrapMat = new THREE.MeshStandardMaterial({ color: 0x4a148c, transparent: true, opacity: 0.85, roughness: 0.9 });
const fumacaTrapMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a,
  transparent: true,
  opacity: 0.7,
  roughness: 1.0,
  depthWrite: false
});

const fumacaCoreMat = new THREE.MeshStandardMaterial({
  color: 0x111111,
  transparent: true,
  opacity: 0.85,
  roughness: 1.0,
  depthWrite: false
});

const itemBoxes = [];
function spawnItemBoxes() {
  const sphereGeo = new THREE.SphereGeometry(0.45, 16, 16);
  const samplePoints = [0.15, 0.4, 0.65, 0.88];
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
        mesh,
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
  if (box) {
    box.active = false;
    box.mesh.visible = false;
    box.respawnTimer = 7.0;
  }
}

function updateItemBoxes(dt) {
  itemBoxes.forEach(box => {
    if (!box.active) {
      box.respawnTimer -= dt;
      if (box.respawnTimer <= 0) {
        box.active = true;
        box.mesh.visible = true;
      }
      return;
    }

    box.mesh.rotation.y += dt * 1.8;
    box.mesh.position.y = box.baseY + Math.sin(performance.now() * 0.004) * 0.12;

    if (kart && box.mesh.position.distanceTo(kart.position) < 1.4) {
      disableItemBox(box.id);
      sendNetworkEvent({ t: 'take_box', boxId: box.id });

      if (!currentItem) {
        getItemFromBox();
      }
    }
  });
}

// Quando pega uma Pokébola na pista
function getItemFromBox() {
  const skillKeys = Object.keys(SKILLS);
  const randomKey = skillKeys[Math.floor(Math.random() * skillKeys.length)];
  currentItem = SKILLS[randomKey];

  // Atualiza o ícone central
  const iconEl = document.getElementById('itemIcon');
  if (iconEl) iconEl.innerText = currentItem.icon;
}

const placedTraps = [];
let trapNextId = 0;

function createTrapMesh(trapData) {
  let geo, mat;

  if (trapData.type === 'FUMACA') {
    const group = new THREE.Group();

    const outerGeo = new THREE.CylinderGeometry(1.8, 1.8, 1.2, 16);
    const outerMesh = new THREE.Mesh(outerGeo, fumacaTrapMat);
    outerMesh.position.y = 0.6;
    group.add(outerMesh);

    const innerGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.9, 12);
    const innerMesh = new THREE.Mesh(innerGeo, fumacaCoreMat);
    innerMesh.position.y = 0.5;
    group.add(innerMesh);

    group.position.set(trapData.x, 0, trapData.z);
    scene.add(group);

    placedTraps.push({
      id: trapData.id,
      mesh: group,
      outerMesh: outerMesh,
      innerMesh: innerMesh,
      type: trapData.type,
      active: true
    });
    return;

  } else {
    geo = new THREE.CylinderGeometry(1.8, 1.8, 0.05, 16);
    mat = trapData.type === 'ICE' ? iceTrapMat : lodoTrapMat;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(trapData.x, 0.03, trapData.z);
    scene.add(mesh);

    placedTraps.push({
      id: trapData.id,
      mesh: mesh,
      type: trapData.type,
      active: true
    });
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

    if (trap.type === 'FUMACA' && trap.outerMesh) {
      trap.outerMesh.rotation.y += dt * 0.4;
      trap.innerMesh.rotation.y -= dt * 0.8;
    }

    const hitRadius = trap.type === 'FUMACA' ? 2.0 : 1.8;

    if (kart && trap.mesh.position.distanceTo(kart.position) < hitRadius) {
      if (trap.type !== 'FUMACA') {
        trap.active = false;
        removeTrapMesh(trap.id);
        sendNetworkEvent({ t: 'destroy_trap', trapId: trap.id });
      }

      if (!isShieldActive) {
        if (trap.type === 'ICE') {
          physics.speed = 0;
          physics.spinTimer = 0.8;
        } else if (trap.type === 'LODO') {
          isControlInverted = true;
          controlInvertTimer = 3.0;
        } else if (trap.type === 'FUMACA') {
          physics.speed *= 0.85;
        }
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
    if (entry.progress > myProgress && entry.progress < bestAheadProgress) {
      bestAheadProgress = entry.progress;
      targetPeerId = pid;
    }
  }

  if (targetPeerId) {
    sendNetworkEvent({ t: 'apply_stun', targetId: targetPeerId });
  }
}

// Quando usa a habilidade ao pressionar a tecla [X]
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyX' && currentItem && raceStarted) {
    useEquippedSkill(currentItem);
    currentItem = null;

    // Reseta o ícone central para a interrogação
    const iconEl = document.getElementById('itemIcon');
    if (iconEl) iconEl.innerText = '❓';
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
  }
}

// ------------------------------------------------------------
// MULTIPLAYER E TRANSMISSÃO DE EVENTOS
// ------------------------------------------------------------
const remoteKarts = new Map();
let racePeer = null;
let hostConn = null;
const activeGuestConns = new Map();
let isHost = (playerSlotParam === 0 && Boolean(roomCodeParam));

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
}

function removeRemoteKart(peerId) {
  const entry = remoteKarts.get(peerId);
  if (entry) {
    scene.remove(entry.obj.group);
    remoteKarts.delete(peerId);
  }
  activeGuestConns.delete(peerId);
}

function initRaceMultiplayer() {
  if (!roomCodeParam) return;

  const roomClean = roomCodeParam.trim().toLowerCase();
  const racePeerId = `pkart-race-${roomClean}`;

  if (isHost) {
    racePeer = new Peer(racePeerId);

    racePeer.on('connection', (conn) => {
      conn.on('open', () => {
        activeGuestConns.set(conn.peer, conn);

        setTimeout(() => {
          conn.send({ t: 'start_countdown' });
        }, 2500);
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
    racePeer = new Peer();

    racePeer.on('open', () => {
      let attempts = 0;

      function connectToHost() {
        attempts++;
        hostConn = racePeer.connect(racePeerId, { reliable: true });

        hostConn.on('open', () => {
          setInterval(() => {
            if (kart && hostConn && hostConn.open) {
              const myTracker = raceTrackers.get('local');
              hostConn.send({
                t: 'state',
                x: kart.position.x,
                y: kart.position.y,
                z: kart.position.z,
                ry: physics.heading,
                speed: physics.speed,
                nick: playerNickname,
                kartId: selectedKartId,
                slot: playerSlotParam,
                progress: myTracker ? myTracker.progress : 0,
                lapCount: myTracker ? myTracker.lapCount : 1,
                finished: myTracker ? myTracker.finished : false
              });
            }
          }, 1000 / 30); // 30 FPS para transmissão fluida
        });

        hostConn.on('data', (data) => {
          if (data.t === 'start_countdown') {
            startCountdown();
          } else if (data.t === 'snapshot' && data.karts) {
            for (const [peerId, state] of Object.entries(data.karts)) {
              if (peerId !== racePeer.id) {
                handleRemoteKartState(peerId, state);
              }
            }
          } else {
            handleNetworkMessage(data);
          }
        });

        hostConn.on('close', () => {
          if (attempts < 8) setTimeout(connectToHost, 800);
        });

        hostConn.on('error', () => {
          if (attempts < 8) setTimeout(connectToHost, 800);
        });
      }

      setTimeout(connectToHost, 300);
    });
  }

  if (!roomCodeParam) {
    setTimeout(startCountdown, 500);
  }
}

let netTimer = 0;
function networkTick(dt) {
  if (!isHost || !racePeer) return;

  netTimer += dt;
  if (netTimer < 1 / 30) return; // 30 FPS
  netTimer = 0;

  const myTracker = raceTrackers.get('local');
  const snapshot = {
    [racePeer.id]: {
      x: kart ? kart.position.x : 0,
      y: kart ? kart.position.y : 0,
      z: kart ? kart.position.z : 0,
      ry: physics.heading,
      speed: physics.speed,
      nick: playerNickname,
      kartId: selectedKartId,
      slot: playerSlotParam,
      progress: myTracker ? myTracker.progress : 0,
      lapCount: myTracker ? myTracker.lapCount : 1,
      finished: myTracker ? myTracker.finished : false
    }
  };

  for (const [pid, entry] of remoteKarts.entries()) {
    snapshot[pid] = {
      x: entry.target.pos.x,
      y: entry.target.pos.y,
      z: entry.target.pos.z,
      ry: entry.target.ry,
      speed: entry.target.speed,
      nick: entry.nickname,
      kartId: entry.kartId,
      progress: entry.progress,
      lapCount: entry.lapCount,
      finished: entry.finished
    };
  }

  for (const conn of activeGuestConns.values()) {
    if (conn.open) {
      conn.send({ t: 'snapshot', karts: snapshot });
    }
  }
}

function updateRemoteKarts(dt) {
  for (const entry of remoteKarts.values()) {
    const g = entry.obj.group;

    // 1. PREDIÇÃO (Dead Reckoning)
    if (Math.abs(entry.target.speed) > 1) {
      const moveDir = new THREE.Vector3(
        Math.sin(entry.target.ry),
        0,
        Math.cos(entry.target.ry)
      );
      entry.target.pos.addScaledVector(moveDir, entry.target.speed * dt);
    }

    // 2. INTERPOLAÇÃO (Lerp suave)
    const lerpFactor = Math.min(1, dt * 18);
    g.position.lerp(entry.target.pos, lerpFactor);

    // 3. SUAVIZAÇÃO DA ROTAÇÃO
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
      racers.push({
        key: pid,
        name: entry.nickname || friendLabel(pid),
        tr: raceTrackers.get(pid)
      });
    }
  }

  racers.forEach(r => {
    if (!r.tr) r.tr = { progress: 0, finished: false, finishTime: Infinity };
  });

  racers.sort((a, b) => {
    if (a.tr.finished && b.tr.finished) return a.tr.finishTime - b.tr.finishTime;
    if (a.tr.finished) return -1;
    if (b.tr.finished) return 1;
    return b.tr.progress - a.tr.progress;
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

    if (lapEl) lapEl.innerText = tr.lapCount;
    if (speedEl) speedEl.innerText = Math.floor(Math.abs(physics.speed) * 3.6);
    if (speedFillEl) speedFillEl.style.width = `${Math.min(100, (Math.abs(physics.speed) / physics.maxSpeed) * 100)}%`;

    if (tr.finished && !localFinishNotified) {
      localFinishNotified = true;
      showFinishOverlay(myRank);
    }
  }
}

// CONFIGURAÇÃO DO MINIMAPA 2D
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

// Normaliza as coordenadas 3D para o Canvas 2D
function mapToMinimap(x, z) {
  // Ajuste a escala (0.65) e os offsets conforme o tamanho da sua pista
  const scale = 0.65;
  const cx = 80; // Centro X do canvas (160/2)
  const cy = 80; // Centro Y do canvas (160/2)

  return {
    x: cx + x * scale,
    y: cy + z * scale
  };
}

function drawMinimap() {
  if (!minimapCtx || !kart) return;

  minimapCtx.clearRect(0, 0, 160, 160);

  // 1. Desenha o traçado da Pista
  minimapCtx.beginPath();
  minimapCtx.lineWidth = 6;
  minimapCtx.strokeStyle = '#475569';

  const segments = 100;
  for (let i = 0; i <= segments; i++) {
    const pt = trackCurve.getPointAt(i / segments);
    const mPt = mapToMinimap(pt.x, pt.z);
    if (i === 0) minimapCtx.moveTo(mPt.x, mPt.y);
    else minimapCtx.lineTo(mPt.x, mPt.y);
  }
  minimapCtx.closePath();
  minimapCtx.stroke();

  // 2. Desenha os Oponentes Remotos (Pontos Azuis)
  if (typeof remoteKarts !== 'undefined') {
    for (const entry of remoteKarts.values()) {
      const pos = entry.obj.group.position;
      const mPt = mapToMinimap(pos.x, pos.z);

      minimapCtx.beginPath();
      minimapCtx.arc(mPt.x, mPt.y, 4, 0, Math.PI * 2);
      minimapCtx.fillStyle = '#38bdf8';
      minimapCtx.fill();
    }
  }

  // 3. Desenha o Jogador Local (Ponto Amarelo/Dourado com Borda)
  const myPt = mapToMinimap(kart.position.x, kart.position.z);
  minimapCtx.beginPath();
  minimapCtx.arc(myPt.x, myPt.y, 5, 0, Math.PI * 2);
  minimapCtx.fillStyle = '#FFD54F';
  minimapCtx.fill();
  minimapCtx.lineWidth = 1.5;
  minimapCtx.strokeStyle = '#ffffff';
  minimapCtx.stroke();
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
  updateCamera(dt);
  updateItemBoxes(dt);
  updateTraps(dt);
  networkTick(dt);
  updateRemoteKarts(dt);
  updateHUD();
  drawMinimap();

  renderer.render(scene, camera);
}
animate();