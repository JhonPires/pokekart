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
  { id: 'jolteon', name: 'Jolteon Kart', modelUrl: getKartUrl('jolteon.glb'), template: null },
  { id: 'zoroark', name: 'Zoroark Kart', modelUrl: getKartUrl('zoroark.glb'), template: null },
  { id: 'togetic', name: 'Togetic Kart', modelUrl: getKartUrl('togetic.glb'), template: null },
  { id: 'charizard', name: 'Charizard Kart', modelUrl: getKartUrl('charizard.glb'), template: null },
  { id: 'flygon', name: 'Flygon Kart', modelUrl: getKartUrl('flygon.glb'), template: null },
  { id: 'gengar', name: 'Gengar Kart', modelUrl: getKartUrl('gengar.glb'), template: null },
  { id: 'oshawott', name: 'Oshawott Kart', modelUrl: getKartUrl('oshawott.glb'), template: null },
  { id: 'snorlax', name: 'Snorlax Kart', modelUrl: getKartUrl('snorlax.glb'), template: null }
];

const urlParams = new URLSearchParams(window.location.search);
const playerNickname = (urlParams.get('nick') || 'JOGADOR').toUpperCase();
const selectedKartId = urlParams.get('kart') || 'zoroark';
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
};

// CONTROLE DE ASSETS PRONTOS
let localKartLoaded = false;
let countdownStarted = false;

function checkAndStartCountdown() {
  // Só inicia a contagem uma única vez e quando o kart local já estiver pronto na pista
  if (localKartLoaded && !countdownStarted) {
    countdownStarted = true;

    // Aguarda 1.5 segundos extras após o carregamento para estabilizar a cena
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

    const grid = getGridPosition(playerSlotParam);
    kart.position.copy(grid.pos);
    kart.rotation.y = grid.heading;
    physics.heading = grid.heading;

    // Marca como carregado e dispara o fluxo da largada
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

// VARIÁVEL DE CONTROLE DA CORRIDA
let raceStarted = false; // Bloqueia o movimento durante a contagem

// ------------------------------------------------------------
// SISTEMA DE CONTAGEM REGRESSIVA (START RACE)
// ------------------------------------------------------------
function startCountdown() {
  const overlay = document.getElementById('countdownOverlay');
  if (!overlay) return;

  let count = 3;
  overlay.style.display = 'flex';
  overlay.innerText = count;

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      overlay.innerText = count;
    } else if (count === 0) {
      overlay.innerText = 'GO!';
      overlay.style.color = '#4CAF50'; // Fica verde no "GO!"
      raceStarted = true; // Libera os karts para acelerar
    } else {
      clearInterval(timer);
      overlay.style.display = 'none'; // Esconde a overlay
    }
  }, 1000);
}

function updatePhysics(dt) {
  // Impede aceleração e controle até a contagem terminar
  if (!kart || isPaused || !raceStarted) return;

  const raceOver = raceTrackers.get('local')?.finished;
  const forward = !raceOver && (keys['KeyW'] || keys['ArrowUp']);
  const backward = !raceOver && (keys['KeyS'] || keys['ArrowDown']);
  const left = !raceOver && (keys['KeyA'] || keys['ArrowLeft']);
  const right = !raceOver && (keys['KeyD'] || keys['ArrowRight']);
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
    if (physics.isDrifting && physics.driftCharge > 0.8) {
      physics.turboTimer = 0.8;
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
}

function enforceTrackBoundary() {
  if (!kart) return;
  const { sample } = nearestTrackSample(kart.position);
  const offset = new THREE.Vector3().subVectors(kart.position, sample.point);
  const lateral = offset.dot(sample.normal);

  if (Math.abs(lateral) > (trackWidth / 2 + 0.6)) {
    const sign = Math.sign(lateral);
    const along = offset.clone().addScaledVector(sample.normal, -lateral);
    kart.position.copy(sample.point.clone().add(along).addScaledVector(sample.normal, sign * (trackWidth / 2 + 0.6)));
    physics.speed *= 0.55;
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
const START_LINE_T = 0.98; // Ponto exato da linha de chegada na curva

function getAdjustedLapProgress(position) {
  const rawT = nearestTrackSample(position).sample.t;
  // Desloca o t para que a linha de chegada seja 0.0 e o fim da volta seja 1.0
  let lapT = rawT - START_LINE_T;
  if (lapT < 0) lapT += 1.0;
  return { rawT, lapT };
}

function updateRaceTracker(key, position) {
  let tr = raceTrackers.get(key);
  if (!tr) {
    tr = { lapCount: 1, lastRawT: 0, progress: 0, finished: false, finishTime: null, passedMidpoint: false };
    raceTrackers.set(key, tr);
  }
  if (tr.finished) return tr;

  const { rawT, lapT } = getAdjustedLapProgress(position);

  // Checkpoint no meio da pista
  if (rawT > 0.4 && rawT < 0.6) {
    tr.passedMidpoint = true;
  }

  // Avança de volta somente se cruzou a linha vindo da direção correta
  if (tr.lastRawT > 0.85 && rawT < 0.15) {
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

  tr.lastRawT = rawT;
  // O progresso total agora é: (Voltas Completadas) + (Progresso da Volta Atual de 0 a 1)
  tr.progress = tr.finished ? TOTAL_LAPS : (tr.lapCount - 1) + lapT;
  return tr;
}

let localFinishNotified = false;
function showFinishOverlay(place) {
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
    <button id="btnRestart" class="lobbyBtn" style="background:#FFD54F; color:#0f172a; border:none; padding:12px 24px; font-size:18px; font-weight:bold; border-radius:8px; cursor:pointer;">Jogar Novamente</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById('btnRestart').onclick = () => window.location.href = 'index.html';
}

// ------------------------------------------------------------
// MULTIPLAYER SINCRO (PEERJS)
// ------------------------------------------------------------
const remoteKarts = new Map();
let racePeer = null;
let hostConn = null;
const activeGuestConns = new Map();
let isHost = (playerSlotParam === 0 && Boolean(roomCodeParam));

function friendLabel(peerId) {
  return 'AMIGO ' + peerId.slice(-4).toUpperCase();
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

        // Dá um tempo de 2.5 segundos para o cliente carregar seus assets antes de mandar contar
        setTimeout(() => {
          conn.send({ t: 'start_countdown' });
        }, 2500);
      });

      conn.on('data', (data) => {
        if (data.t === 'state') {
          handleRemoteKartState(conn.peer, data);
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
          }, 1000 / 20);
        });

        hostConn.on('data', (data) => {
          // Cliente recebe a ordem do Host e inicia a contagem simultaneamente
          if (data.t === 'start_countdown') {
            setTimeout(() => {
              startCountdown();
            }, 1000); // Delay de tolerância para renders mais lentos
          }

          if (data.t === 'snapshot' && data.karts) {
            for (const [peerId, state] of Object.entries(data.karts)) {
              if (peerId !== racePeer.id) {
                handleRemoteKartState(peerId, state);
              }
            }
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

  // Se for partida solo (sem sala), inicia a contagem imediatamente
  if (!roomCodeParam) {
    setTimeout(startCountdown, 500);
  }
}

let netTimer = 0;
function networkTick(dt) {
  if (!isHost || !racePeer) return;

  netTimer += dt;
  if (netTimer < 1 / 20) return;
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
    const lerpSpeed = Math.min(1, dt * 12);

    g.position.lerp(entry.target.pos, lerpSpeed);
    g.rotation.y += (entry.target.ry - g.rotation.y) * lerpSpeed;
  }
}

initRaceMultiplayer();

// ------------------------------------------------------------
// CLASSIFICAÇÃO DA HUD
// ------------------------------------------------------------
function updateStandings() {
  const standingsEl = document.getElementById('standingsList');
  if (!standingsEl || !kart) return [];

  const localTracker = raceTrackers.get('local');
  const racers = [
    {
      key: 'local',
      name: playerNickname,
      progress: localTracker ? localTracker.progress : 0,
      finished: localTracker ? localTracker.finished : false
    }
  ];

  for (const [pid, entry] of remoteKarts.entries()) {
    racers.push({
      key: pid,
      name: entry.nickname,
      progress: entry.progress || 0,
      finished: entry.finished || false
    });
  }

  // Ordena corretamente pelo progresso real percorrido na pista
  racers.sort((a, b) => b.progress - a.progress);

  standingsEl.innerHTML = racers.map((r, index) => {
    const isMe = r.key === 'local';
    const highlightStyle = isMe ? 'color: #FFD54F; font-weight: bold;' : 'color: #cbd5e1;';
    const finishedFlag = r.finished ? ' 🏁' : '';
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
  networkTick(dt);
  updateRemoteKarts(dt);
  updateHUD();

  renderer.render(scene, camera);
}
animate();