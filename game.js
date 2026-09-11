// ------------------------------------------------------------
// SETUP BÁSICO DA CORRIDA E AMBIENTE APRIMORADO
// ------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
let raceStartTime = 0;
let totalRaceTimeMs = 0;
let raceTimerInterval = null;
let currentTreeGroup = null;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function setupEnhancedEnvironment(scene) {
  const skyColor = 0x87CEEB;
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.FogExp2(skyColor, 0.0035);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));

  const sun = new THREE.DirectionalLight(0xfff5e6, 1.3);
  sun.position.set(40, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
  scene.add(sun);

  respawnTreesForTrack();
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
  { id: 'scyther', name: 'Scyther Kart', modelUrl: getKartUrl('scyther.glb'), stats: { accel: 31, maxSpeed: 33, turnSpeed: 3.6, turboBonus: 1.2, driftRate: 1.4, driftControl: 1.2, grip: 0.80 } }
];

const urlParams = new URLSearchParams(window.location.search);
const playerNickname = (urlParams.get('nick') || 'JOGADOR').toUpperCase();
const selectedKartId = urlParams.get('kart') || 'jolteon';
const roomCodeParam = urlParams.get('room');
const customTrackParam = urlParams.get('customTrack');
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

let trackMesh = null;
function buildAndAddTrackMesh() {
  trackMesh = new THREE.Mesh(
    buildTrackMesh(),
    new THREE.MeshStandardMaterial({ map: trackTexture, roughness: 0.9, side: THREE.DoubleSide })
  );
  trackMesh.receiveShadow = true;
  trackElementsGroup.add(trackMesh);
}

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
    trackElementsGroup.add(kerbMesh);
  });
}

function createStripedGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const stripeHeight = 32;
  for (let i = 0; i < 256; i += stripeHeight) {
    ctx.fillStyle = (i / stripeHeight) % 2 === 0 ? '#43a047' : '#2e7d32';
    ctx.fillRect(0, i, 256, stripeHeight);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(50, 50);
  return texture;
}

const grassMat = new THREE.MeshStandardMaterial({
  color: 0x388e3c,
  map: createStripedGrassTexture(),
  roughness: 0.9
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
      } catch (e) {
        console.warn('[Game] Falha ao salvar no cache:', e);
      }
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

if (btnReturnLobbyEl) {
  btnReturnLobbyEl.onclick = () => { window.location.href = 'index.html'; };
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
      if (iconEl) iconEl.innerText = '❓';
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

// Intercepta a primeira interação para carregar permissões visuais de tela no celular no momento da corrida (Garante Fullscreen no Load)
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
// -------------------------------------------------------------

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

  // Integramos entradas físicas com Mobile e PC
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

  // Sobrescreve pelo giroscópio no Mobile com zona morta
  if (isMobile) {
    if (Math.abs(gyroTurnInput) > 0.1) {
      turnInput = gyroTurnInput;
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
    const maxGrassSpeed = 4.5;
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
  const rawT = nearestTrackSample(position).sample.t;

  if (!tr) {
    tr = { lapCount: 1, lastRawT: rawT, progress: 0, finished: false, finishTime: Infinity };
    raceTrackers.set(key, tr);
    return tr;
  }
  if (tr.finished) return tr;

  let deltaT = rawT - tr.lastRawT;

  if (deltaT < -0.5) deltaT += 1.0;
  else if (deltaT > 0.5) deltaT -= 1.0;

  tr.lastRawT = rawT;
  tr.progress += deltaT;
  tr.lapCount = Math.floor(tr.progress) + 1;

  if (tr.lapCount > TOTAL_LAPS) {
    tr.finished = true;
    tr.finishTime = Date.now();
    tr.lapCount = TOTAL_LAPS;
  }

  return tr;
}

let localFinishNotified = false;
async function showFinishOverlay(place) {
  const rewards = {
    1: { coins: 150, trophies: 25 },
    2: { coins: 90, trophies: 12 },
    3: { coins: 50, trophies: 4 },
    4: { coins: 20, trophies: 1 }
  };

  const currentReward = rewards[place] || { coins: 10, trophies: 0 };
  const finalTimeMs = Math.round(totalRaceTimeMs);
  const formattedTime = formatTime(finalTimeMs);
  let isNewRecord = false;

  if (typeof supabaseClient !== 'undefined') {
    try {
      const { data, error } = await supabaseClient.rpc('grant_race_reward', {
        p_place: place,
        p_track_id: customTrackParam || 'default'
      });
      if (error) {
        console.error('[Supabase RPC Error]:', error.message);
      } else {
        console.log('[Supabase RPC Success]:', data);
      }
    } catch (err) {
      console.error('[Recompensas] Falha ao atribuir via RPC:', err);
    }
  }

  const currentTrackId = customTrackParam || 'default';
  if (typeof currentUserProfile !== 'undefined' && currentUserProfile && typeof supabaseClient !== 'undefined') {
    try {
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
          best_time_ms: finalTimeMs
        });
        isNewRecord = true;
      } else if (finalTimeMs < existingRecord.best_time_ms) {
        await supabaseClient.from('track_records').update({
          best_time_ms: finalTimeMs,
          created_at: new Date()
        }).eq('id', existingRecord.id);
        isNewRecord = true;
      }
    } catch (err) {
      console.warn('Erro ao salvar recorde de tempo:', err);
    }
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
    <div style="font-size:22px; margin: 10px 0;">Sua Posição: <strong>${place}º lugar</strong></div>
    <div style="font-size:26px; color:#38bdf8; font-weight:bold; margin-bottom: 5px;">
      Tempo Total: ${formattedTime} ${isNewRecord ? '🔥 <span style="color:#22c55e; font-size:18px;">(NOVO RECORDE!)</span>' : ''}
    </div>
    <div style="font-size:18px; color:#4CAF50; margin-bottom: 20px;">
      Recompensa: +${currentReward.coins} 🪙 | ${currentReward.trophies >= 0 ? '+' : ''}${currentReward.trophies} 🏆
    </div>
    <button id="btnRestart" style="background:#FFD54F; color:#0f172a; border:none; padding:12px 24px; font-size:18px; font-weight:bold; border-radius:8px; cursor:pointer;">Continuar</button>
  `;

  document.body.appendChild(overlay);
  document.getElementById('btnRestart').onclick = () => window.location.href = 'index.html';
}

// ------------------------------------------------------------
// POKÉBOLAS, ARMADILHAS E HABILIDADES NO (E)
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
        box.active = true;
        box.mesh.visible = true;
      }
      return;
    }

    box.mesh.rotation.y += dt * 2.0;
    box.mesh.position.y = box.baseY + Math.sin(performance.now() * 0.005) * 0.15;

    if (kart && box.mesh.position.distanceTo(kart.position) < 1.6) {
      disableItemBox(box.id);
      sendNetworkEvent({ t: 'take_box', boxId: box.id });

      if (!currentItem) {
        getItemFromBox();
      }
    }
  });
}

function getItemFromBox() {
  const skillKeys = Object.keys(SKILLS);
  const randomKey = skillKeys[Math.floor(Math.random() * skillKeys.length)];
  currentItem = SKILLS[randomKey];

  const iconEl = document.getElementById('itemIcon');
  if (iconEl) iconEl.innerText = currentItem.icon;
}

const placedTraps = [];
let trapNextId = 0;

function createTrapMesh(trapData) {
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
    const geo = new THREE.CylinderGeometry(1.8, 1.8, 0.05, 16);
    const mat = trapData.type === 'ICE' ? iceTrapMat : lodoTrapMat;

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

  if (!targetPeerId) {
    let bestBehindProgress = -1;
    for (const [pid, entry] of remoteKarts.entries()) {
      if (entry.progress < myProgress && entry.progress > bestBehindProgress) {
        bestBehindProgress = entry.progress;
        targetPeerId = pid;
      }
    }
  }

  if (targetPeerId) {
    sendNetworkEvent({ t: 'apply_stun', targetId: targetPeerId });
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && currentItem && raceStarted) {
    useEquippedSkill(currentItem);
    currentItem = null;

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
    console.log('[Multiplayer] Modo Solo ativado (sem código de sala).');
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
    console.log('[Multiplayer HOST] Registrando Host da corrida com ID:', racePeerId);
    if (racePeer) racePeer.destroy();

    racePeer = new Peer(racePeerId, peerOpts);

    racePeer.on('open', (id) => {
      console.log('[Multiplayer HOST] Servidor de corrida ativo e escutando conexões no ID:', id);
    });

    racePeer.on('connection', (conn) => {
      console.log('[Multiplayer HOST] Convidado conectou no jogo:', conn.peer);

      conn.on('open', () => {
        activeGuestConns.set(conn.peer, conn);
        console.log(`[Multiplayer HOST] Jogadores conectados na pista: ${activeGuestConns.size + 1}`);

        setTimeout(() => {
          console.log('[Multiplayer HOST] Disparando contagem regressiva unificada!');
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

    racePeer.on('error', (err) => {
      console.error('[Multiplayer HOST ERROR]', err);
    });

  } else {
    console.log('[Multiplayer GUEST] Inicializando Convidado no Slot:', _slotParam);
    if (racePeer) racePeer.destroy();

    racePeer = new Peer(peerOpts);

    racePeer.on('open', (myId) => {
      console.log('[Multiplayer GUEST] ID local criado:', myId);

      let attemptCount = 0;
      const maxAttempts = 25;

      function tryConnectToHost() {
        attemptCount++;
        console.log(`[Multiplayer GUEST] Tentando conectar ao Host (${attemptCount}/${maxAttempts})...`);

        if (hostConn) {
          try { hostConn.close(); } catch (e) { }
        }

        hostConn = racePeer.connect(racePeerId, { reliable: true });

        hostConn.on('open', () => {
          console.log('[Multiplayer GUEST] CONECTADO AO HOST DA CORRIDA COM SUCESSO!');

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
                slot: _slotParam,
                progress: myTracker ? myTracker.progress : 0,
                lapCount: myTracker ? myTracker.lapCount : 1,
                finished: myTracker ? myTracker.finished : false
              });
            }
          }, 1000 / 30);
        });

        hostConn.on('data', (data) => {
          if (data.t === 'start_countdown') {
            console.log('[Multiplayer GUEST] Recebeu ordem do Host para disparar contagem!');
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

      setTimeout(tryConnectToHost, 1000);

      racePeer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          console.warn('[Multiplayer GUEST] Host ainda não abriu a sala 3D. Tentando novamente em 1.5s...');
          if (attemptCount < maxAttempts) {
            setTimeout(tryConnectToHost, 1500);
          }
        } else {
          console.error('[Multiplayer GUEST PEER ERROR]', err);
        }
      });
    });
  }
}

let netTimer = 0;
function networkTick(dt) {
  if (!isHost || !racePeer) return;

  netTimer += dt;
  if (netTimer < 1 / 30) return;
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
  for (const [pid, entry] of remoteKarts.entries()) {
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
// CLASSIFICAÇÃO DA HUD (TOTALMENTE REESCRITA E ROBUSTA)
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
    if (a.tr.finished && b.tr.finished) return (a.tr.finishTime || 0) - (b.tr.finishTime || 0);
    if (a.tr.finished) return -1;
    if (b.tr.finished) return 1;

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
    if (speedEl) speedEl.innerText = Math.floor(Math.abs(physics.speed) * 3.6);
    if (speedFillEl) speedFillEl.style.width = `${Math.min(100, (Math.abs(physics.speed) / physics.maxSpeed) * 100)}%`;

    if (raceStarted && !tr.finished) {
      totalRaceTimeMs = performance.now() - raceStartTime;
      if (timerEl) timerEl.innerText = formatTime(totalRaceTimeMs);
    }

    if (tr.finished && !localFinishNotified) {
      localFinishNotified = true;
      showFinishOverlay(myRank);
    }
  }
}

// ------------------------------------------------------------
// CÁLCULO E DESENHO DINÂMICO DO MINIMAPA
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

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(radius, 0); ctx.lineTo(radius, height);
  ctx.moveTo(0, radius); ctx.lineTo(width, radius);
  ctx.arc(radius, radius, radius * 0.5, 0, Math.PI * 2);
  ctx.stroke();

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

  ctx.save();
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 6;
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
  ctx.restore();

  const startPos = worldToMinimap(currentTrackPoints[0].x, currentTrackPoints[0].z);
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(startPos.x, startPos.y, 3, 0, Math.PI * 2);
  ctx.fill();

  for (const entry of remoteKarts.values()) {
    if (entry.obj && entry.obj.group) {
      const pos = worldToMinimap(entry.obj.group.position.x, entry.obj.group.position.z);

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
    const pulseRadius = 5 + Math.sin(performance.now() * 0.008) * 1.5;

    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pulseRadius + 3, 0, Math.PI * 2);
    ctx.fill();

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