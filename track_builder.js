// track_builder.js - Criador de Pistas PokéKart

let canvas, ctx;
let points = [];
let items = [];
let boosts = [];
let isClosed = true;
const trackWidth = 10; // Largura da pista em metros

let currentMode = 'nodes'; // 'nodes' | 'items' | 'boosts'
let selectedPointIndex = -1;
let hoveredPointIndex = -1;
let isDragging = false;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let lastMousePos = { x: 0, y: 0 };

// Câmera (Pan e Zoom)
let cameraOffset = { x: 0, y: 0 };
let zoom = 2.0; // Pixels por metro

// Pista Padrão de Exemplo
const PRESET_TRACK = [
  { x: 0, z: -100 },
  { x: 60, z: -100 },
  { x: 60, z: -30 },
  { x: 40, z: 0 },
  { x: 80, z: 40 },
  { x: 40, z: 100 },
  { x: -40, z: 100 },
  { x: -70, z: 30 },
  { x: -30, z: -30 },
  { x: -60, z: -100 }
];

document.addEventListener('DOMContentLoaded', async () => {
  canvas = document.getElementById('trackCanvas');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Inicializa com o traçado padrão
  loadPreset();

  // Configurações de Eventos da Interface
  setupUIEvents();
  setupCanvasEvents();

  // Verifica Perfil e Permissões de Admin
  if (typeof fetchPlayerProfile === 'function') {
    const profile = await fetchPlayerProfile();
    if (profile && profile.is_admin) {
      const btnAdmin = document.getElementById('btnAdmin');
      if (btnAdmin) btnAdmin.style.display = 'inline-flex';
    }
  }

  render();
});

function resizeCanvas() {
  const container = document.getElementById('workspace');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  render();
}

function loadPreset() {
  points = PRESET_TRACK.map(p => ({ ...p }));
  items = [
    { t: 0.25 },
    { t: 0.50 },
    { t: 0.75 }
  ];

  isClosed = true;
  updateInfo();
  render();
}

// ------------------------------------------------------------
// TRANSFORMAÇÕES DE COORDENADAS (Mundo <-> Tela)
// ------------------------------------------------------------
function worldToScreen(wx, wz) {
  return {
    x: canvas.width / 2 + (wx - cameraOffset.x) * zoom,
    y: canvas.height / 2 + (wz - cameraOffset.y) * zoom
  };
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - canvas.width / 2) / zoom + cameraOffset.x,
    z: (sy - canvas.height / 2) / zoom + cameraOffset.y
  };
}

// ------------------------------------------------------------
// CÁLCULO DE SPLINE VIA THREE.JS
// ------------------------------------------------------------
function getSplineCurve() {
  if (points.length < 2) return null;
  const v3Points = points.map(p => new THREE.Vector3(p.x, 0, p.z));
  return new THREE.CatmullRomCurve3(v3Points, isClosed, 'centripetal', 0.5);
}

// ------------------------------------------------------------
// RENDERIZAÇÃO DO EDITOR
// ------------------------------------------------------------
function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  const curve = getSplineCurve();

  if (curve && points.length >= 2) {
    const segments = Math.max(100, points.length * 30);
    const samples = curve.getSpacedPoints(segments);

    // 1. Asfalto da Pista
    ctx.beginPath();
    ctx.lineWidth = trackWidth * zoom;
    ctx.strokeStyle = '#334155';
    ctx.lineCap = isClosed ? 'round' : 'square';
    ctx.lineJoin = 'round';

    samples.forEach((pt, i) => {
      const scr = worldToScreen(pt.x, pt.z);
      if (i === 0) ctx.moveTo(scr.x, scr.y);
      else ctx.lineTo(scr.x, scr.y);
    });

    if (isClosed) ctx.closePath();
    ctx.stroke();

    // 2. Linha Central Branca Tracejada
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.setLineDash([8 * (zoom / 2), 8 * (zoom / 2)]);

    samples.forEach((pt, i) => {
      const scr = worldToScreen(pt.x, pt.z);
      if (i === 0) ctx.moveTo(scr.x, scr.y);
      else ctx.lineTo(scr.x, scr.y);
    });

    if (isClosed) ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Zebras / Bordas Coloridas
    drawKerbs(samples);

    // 4. Linha de Chegada / Largada
    if (points.length >= 3) {
      drawStartFinish(curve);
    }

    // 5. Pads de Turbo
    drawBoosts(curve);

    // 6. Caixas de Itens (Pokébolas)
    drawItems(curve);
  }

  // 7. Handles / Pontos do Traçado
  if (currentMode === 'nodes') {
    drawPointHandles();
  }

  updateInfo();
}

function drawGrid() {
  const gridSize = 20 * zoom; // 20 metros
  const offsetX = (canvas.width / 2 - cameraOffset.x * zoom) % gridSize;
  const offsetY = (canvas.height / 2 - cameraOffset.y * zoom) % gridSize;

  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let x = offsetX; x < canvas.width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = offsetY; y < canvas.height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();

  // Eixos centrais mais visíveis
  const center = worldToScreen(0, 0);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(center.x, 0); ctx.lineTo(center.x, canvas.height);
  ctx.moveTo(0, center.y); ctx.lineTo(canvas.width, center.y);
  ctx.stroke();
}

function drawKerbs(samples) {
  const kerbDist = (trackWidth / 2) * zoom;
  const len = samples.length;

  for (let i = 0; i < len - 1; i++) {
    const p1 = worldToScreen(samples[i].x, samples[i].z);
    const p2 = worldToScreen(samples[i + 1].x, samples[i + 1].z);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dLen = Math.hypot(dx, dy);
    if (dLen === 0) continue;

    const nx = -dy / dLen;
    const ny = dx / dLen;

    const isRed = (Math.floor(i / 3) % 2 === 0);
    ctx.strokeStyle = isRed ? '#ef4444' : '#f8fafc';
    ctx.lineWidth = 3;

    // Lado esquerdo
    ctx.beginPath();
    ctx.moveTo(p1.x + nx * kerbDist, p1.y + ny * kerbDist);
    ctx.lineTo(p2.x + nx * kerbDist, p2.y + ny * kerbDist);
    ctx.stroke();

    // Lado direito
    ctx.beginPath();
    ctx.moveTo(p1.x - nx * kerbDist, p1.y - ny * kerbDist);
    ctx.lineTo(p2.x - nx * kerbDist, p2.y - ny * kerbDist);
    ctx.stroke();
  }
}

function drawStartFinish(curve) {
  const pt = curve.getPointAt(0);
  const tangent = curve.getTangentAt(0);
  const scr = worldToScreen(pt.x, pt.z);

  const angle = Math.atan2(tangent.z, tangent.x);
  const halfWidth = (trackWidth / 2) * zoom;

  ctx.save();
  ctx.translate(scr.x, scr.y);
  ctx.rotate(angle);

  // Faixa quadriculada
  const numChecks = 8;
  const checkWidth = halfWidth * 2 / numChecks;
  for (let i = 0; i < numChecks; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#ffffff' : '#000000';
    ctx.fillRect(-6, -halfWidth + i * checkWidth, 12, checkWidth);
  }

  // Seta verde indicando o sentido da largada
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(4, -8);
  ctx.lineTo(4, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBoosts(curve) {
  boosts.forEach(b => {
    const pt = curve.getPointAt(b.t);
    const tangent = curve.getTangentAt(b.t);
    const scr = worldToScreen(pt.x, pt.z);
    const angle = Math.atan2(tangent.z, tangent.x);

    ctx.save();
    ctx.translate(scr.x, scr.y);
    ctx.rotate(angle);

    // Chevron Pad Amarelo/Verde
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-4, -10);
    ctx.lineTo(0, 0);
    ctx.lineTo(-4, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  });
}

function drawItems(curve) {
  items.forEach(it => {
    const pt = curve.getPointAt(it.t);
    const scr = worldToScreen(pt.x, pt.z);

    // Ícone de Pokébola
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 8, 0, Math.PI, false);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
  });
}

function drawPointHandles() {
  points.forEach((p, idx) => {
    const scr = worldToScreen(p.x, p.z);
    const isHovered = (idx === hoveredPointIndex);
    const isSelected = (idx === selectedPointIndex);

    ctx.beginPath();
    ctx.arc(scr.x, scr.y, isHovered || isSelected ? 9 : 7, 0, Math.PI * 2);

    if (idx === 0) {
      ctx.fillStyle = '#22c55e'; // Largada verde
    } else if (isSelected) {
      ctx.fillStyle = '#facc15';
    } else {
      ctx.fillStyle = '#38bdf8';
    }

    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rótulo do índice
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(idx + 1, scr.x, scr.y - 14);
  });
}

function updateInfo() {
  const infoPoints = document.getElementById('infoPoints');
  const infoClosed = document.getElementById('infoClosed');
  const infoLength = document.getElementById('infoLength');
  const infoItems = document.getElementById('infoItems');
  const infoBoosts = document.getElementById('infoBoosts');

  if (infoPoints) infoPoints.innerText = points.length;
  if (infoClosed) {
    infoClosed.innerText = isClosed ? 'Fechado' : 'Aberto';
    infoClosed.style.color = isClosed ? '#22c55e' : '#ef4444';
  }
  if (infoItems) infoItems.innerText = items.length;
  if (infoBoosts) infoBoosts.innerText = boosts.length;

  const curve = getSplineCurve();
  if (curve && points.length >= 2) {
    const len = Math.round(curve.getLength());
    if (infoLength) infoLength.innerText = `${len}m`;
  } else {
    if (infoLength) infoLength.innerText = '0m';
  }
}

// ------------------------------------------------------------
// INTERAÇÃO COM O MOUSE E EVENTOS DO CANVAS
// ------------------------------------------------------------
function setupCanvasEvents() {
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    lastMousePos = { x: mx, y: my };

    // Botão do meio ou segurando espaço -> Pan
    if (e.button === 1 || e.shiftKey) {
      isPanning = true;
      panStart = { x: mx, y: my };
      return;
    }

    if (e.button === 0) { // Clique esquerdo
      const clickedPoint = findNearestPoint(mx, my);

      if (currentMode === 'nodes') {
        if (clickedPoint !== -1) {
          selectedPointIndex = clickedPoint;
          isDragging = true;
        } else {
          // Adiciona novo nó
          const world = screenToWorld(mx, my);
          points.push(world);
          selectedPointIndex = points.length - 1;
          isDragging = true;
          render();
        }
      } else if (currentMode === 'items') {
        const curve = getSplineCurve();
        if (curve) {
          const t = findNearestTOnCurve(mx, my, curve);
          items.push({ t });
          render();
        }
      } else if (currentMode === 'boosts') {
        const curve = getSplineCurve();
        if (curve) {
          const t = findNearestTOnCurve(mx, my, curve);
          boosts.push({ t });
          render();
        }
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isPanning) {
      cameraOffset.x -= (mx - lastMousePos.x) / zoom;
      cameraOffset.y -= (my - lastMousePos.y) / zoom;
      lastMousePos = { x: mx, y: my };
      render();
      return;
    }

    if (isDragging && selectedPointIndex !== -1) {
      const world = screenToWorld(mx, my);
      points[selectedPointIndex] = world;
      render();
      return;
    }

    // Hover detection
    const oldHovered = hoveredPointIndex;
    hoveredPointIndex = findNearestPoint(mx, my);
    if (oldHovered !== hoveredPointIndex) {
      render();
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    isPanning = false;
  });

  // Zoom com a roda do mouse
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    zoom = Math.max(0.5, Math.min(6.0, zoom * zoomFactor));
    render();
  }, { passive: false });

  // Clique direito: remove ponto ou item
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (currentMode === 'nodes') {
      const pIdx = findNearestPoint(mx, my);
      if (pIdx !== -1 && points.length > 2) {
        points.splice(pIdx, 1);
        selectedPointIndex = -1;
        render();
      }
    } else if (currentMode === 'items') {
      const itIdx = findNearestItem(mx, my);
      if (itIdx !== -1) {
        items.splice(itIdx, 1);
        render();
      }
    } else if (currentMode === 'boosts') {
      const bIdx = findNearestBoost(mx, my);
      if (bIdx !== -1) {
        boosts.splice(bIdx, 1);
        render();
      }
    }
  });
}

function findNearestPoint(sx, sy) {
  const threshold = 14;
  for (let i = 0; i < points.length; i++) {
    const scr = worldToScreen(points[i].x, points[i].z);
    if (Math.hypot(scr.x - sx, scr.y - sy) <= threshold) {
      return i;
    }
  }
  return -1;
}

function findNearestTOnCurve(sx, sy, curve) {
  const samples = 200;
  let bestT = 0;
  let bestDist = Infinity;

  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const pt = curve.getPointAt(t);
    const scr = worldToScreen(pt.x, pt.z);
    const d = Math.hypot(scr.x - sx, scr.y - sy);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }
  return bestT;
}

function findNearestItem(sx, sy) {
  const curve = getSplineCurve();
  if (!curve) return -1;
  const threshold = 16;

  for (let i = 0; i < items.length; i++) {
    const pt = curve.getPointAt(items[i].t);
    const scr = worldToScreen(pt.x, pt.z);
    if (Math.hypot(scr.x - sx, scr.y - sy) <= threshold) {
      return i;
    }
  }
  return -1;
}

function findNearestBoost(sx, sy) {
  const curve = getSplineCurve();
  if (!curve) return -1;
  const threshold = 16;

  for (let i = 0; i < boosts.length; i++) {
    const pt = curve.getPointAt(boosts[i].t);
    const scr = worldToScreen(pt.x, pt.z);
    if (Math.hypot(scr.x - sx, scr.y - sy) <= threshold) {
      return i;
    }
  }
  return -1;
}

// ------------------------------------------------------------
// EVENTOS DA INTERFACE (BOTOES, MODAIS, SALVAMENTO)
// ------------------------------------------------------------
function setupUIEvents() {
  // Voltar ao Menu
  document.getElementById('btnBack').onclick = () => {
    window.location.href = 'index.html';
  };

  // Carregar Modelo Padrão
  document.getElementById('btnPreset').onclick = () => {
    if (confirm('Deseja carregar o circuito padrão de exemplo? O desenho atual será substituído.')) {
      loadPreset();
    }
  };

  // Limpar
  document.getElementById('btnClear').onclick = () => {
    if (confirm('Tem certeza que deseja limpar todo o circuito?')) {
      points = [];
      items = [];
      boosts = [];
      render();
    }
  };

  // Alternar Ferramentas
  const toolBtns = [
    { id: 'toolNodes', mode: 'nodes' },
    { id: 'toolItems', mode: 'items' },
    // { id: 'toolBoosts', mode: 'boosts' }
  ];

  toolBtns.forEach(t => {
    const btn = document.getElementById(t.id);
    if (btn) {
      btn.onclick = () => {
        toolBtns.forEach(o => document.getElementById(o.id)?.classList.remove('active'));
        btn.classList.add('active');
        currentMode = t.mode;
        render();
      };
    }
  });

  // Fechar / Abrir Circuito
  const btnLoop = document.getElementById('btnToggleLoop');
  const loopText = document.getElementById('loopText');
  if (btnLoop) {
    btnLoop.onclick = () => {
      isClosed = !isClosed;
      if (loopText) loopText.innerText = isClosed ? 'Abrir Circuito' : 'Fechar Circuito';
      render();
    };
  }

  // Centralizar Câmera
  document.getElementById('btnResetView').onclick = () => {
    cameraOffset = { x: 0, y: 0 };
    zoom = 2.0;
    render();
  };

  // Testar Pista no Jogo
  document.getElementById('btnTest').onclick = () => {
    if (!validateTrack()) return;

    const trackData = getTrackExportData();
    sessionStorage.setItem('pkart_custom_track_data', JSON.stringify(trackData));

    const selectedKart = sessionStorage.getItem('pkart_selected_kart') || 'jolteon';
    const nick = (sessionStorage.getItem('pkart_nickname') || 'PILOTO').toUpperCase();

    window.location.href = `game.html?nick=${encodeURIComponent(nick)}&kart=${selectedKart}&customTrack=preview`;
  };

  // Salvar Pista (Abre Modal)
  document.getElementById('btnSave').onclick = () => {
    if (!validateTrack()) return;
    document.getElementById('saveModal').style.display = 'flex';
  };

  document.getElementById('btnCloseSaveModal').onclick = () => {
    document.getElementById('saveModal').style.display = 'none';
  };

  // Confirmação de Salvamento no Supabase
  document.getElementById('btnConfirmSave').onclick = async () => {
    const nameInput = document.getElementById('trackNameInput');
    const descInput = document.getElementById('trackDescInput');
    const statusEl = document.getElementById('saveStatus');

    const name = nameInput.value.trim();
    const desc = descInput.value.trim();

    if (!name) {
      alert('Por favor, digite um nome para a pista!');
      return;
    }

    if (typeof supabaseClient === 'undefined') {
      alert('Erro: Supabase não está conectado.');
      return;
    }

    statusEl.innerText = 'Salvando pista no banco de dados...';
    statusEl.style.color = '#38bdf8';

    try {
      const profile = await fetchPlayerProfile();
      if (!profile) {
        alert('Você precisa estar logado para salvar uma pista!');
        statusEl.innerText = '';
        return;
      }

      const trackData = getTrackExportData();
      const isAdmin = Boolean(profile.is_admin);

      const { data, error } = await supabaseClient
        .from('custom_tracks')
        .insert({
          creator_id: profile.id,
          creator_name: profile.nickname || 'Piloto',
          name: name,
          description: desc,
          track_data: trackData,
          is_approved: isAdmin, // Admins auto-aprovam suas pistas
          status: isAdmin ? 'approved' : 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      statusEl.style.color = '#22c55e';
      statusEl.innerText = isAdmin
        ? 'Pista salva e aprovada automaticamente com sucesso!'
        : 'Pista enviada com sucesso! Ela ficará visível no Lobby assim que o Administrador aprovar.';

      setTimeout(() => {
        document.getElementById('saveModal').style.display = 'none';
        statusEl.innerText = '';
      }, 2500);

    } catch (err) {
      console.error('Erro ao salvar pista:', err);
      statusEl.style.color = '#ef4444';
      statusEl.innerText = 'Erro ao salvar: ' + err.message;
    }
  };

  // Modal de Moderação (Admin)
  const btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) {
    btnAdmin.onclick = () => {
      document.getElementById('adminModal').style.display = 'flex';
      loadModerationList();
    };
  }

  document.getElementById('btnCloseAdminModal').onclick = () => {
    document.getElementById('adminModal').style.display = 'none';
  };
}

function validateTrack() {
  if (points.length < 5) {
    alert('A pista precisa ter pelo menos 5 pontos para formar um circuito.');
    return false;
  }
  if (!isClosed) {
    alert('O circuito precisa ser fechado para funcionar na corrida. Clique em "Fechar Circuito".');
    return false;
  }
  const curve = getSplineCurve();
  if (curve && curve.getLength() < 120) {
    alert('A pista é muito curta! Desenhe um circuito maior com curvas e retas.');
    return false;
  }
  return true;
}

function getTrackExportData() {
  return {
    version: 1,
    width: trackWidth,
    points: points.map(p => ({ x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 })),
    items: items.map(it => ({ t: Math.round(it.t * 1000) / 1000 })),
    boosts: boosts.map(b => ({ t: Math.round(b.t * 1000) / 1000 }))
  };
}

// ------------------------------------------------------------
// PAINEL DE MODERAÇÃO DO ADMINISTRADOR
// ------------------------------------------------------------
async function loadModerationList() {
  const tbody = document.getElementById('moderationListBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Carregando...</td></tr>';

  try {
    const { data: tracks, error } = await supabaseClient
      .from('custom_tracks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!tracks || tracks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Nenhuma pista enviada ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    tracks.forEach(tr => {
      const trEl = document.createElement('tr');

      let statusBadge = `<span class="status-badge status-pending">Pendente</span>`;
      if (tr.status === 'approved' || tr.is_approved) statusBadge = `<span class="status-badge status-approved">Aprovada</span>`;
      if (tr.status === 'rejected') statusBadge = `<span class="status-badge status-rejected">Rejeitada</span>`;

      trEl.innerHTML = `
        <td>
          <div style="font-weight: bold; color: #facc15;">${escapeHtml(tr.name)}</div>
          <div style="font-size: 11px; color: #94a3b8;">${escapeHtml(tr.description || 'Sem descrição')}</div>
        </td>
        <td>${escapeHtml(tr.creator_name || 'Anônimo')}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right; display: flex; gap: 6px; justify-content: flex-end;">
          <button class="btn-builder" style="padding: 4px 8px; font-size: 11px;" onclick="testTrackById('${tr.id}')">🎮 Testar</button>
          <button class="btn-builder btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="moderateTrack('${tr.id}', true)">Aprovar ✅</button>
          <button class="btn-builder" style="background:#ef4444; border-color:#ef4444; padding: 4px 8px; font-size: 11px;" onclick="moderateTrack('${tr.id}', false)">Rejeitar ❌</button>
          <button class="btn-builder" style="background:#64748b; border-color:#64748b; padding: 4px 8px; font-size: 11px;" onclick="deleteTrack('${tr.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(trEl);
    });

  } catch (err) {
    console.error('Erro ao listar pistas na moderação:', err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444;">Erro: ${err.message}</td></tr>`;
  }
}

window.testTrackById = (trackId) => {
  const selectedKart = sessionStorage.getItem('pkart_selected_kart') || 'jolteon';
  const nick = (sessionStorage.getItem('pkart_nickname') || 'ADMIN').toUpperCase();
  window.location.href = `game.html?nick=${encodeURIComponent(nick)}&kart=${selectedKart}&customTrack=${trackId}`;
};

window.moderateTrack = async (trackId, approve) => {
  try {
    const { error } = await supabaseClient
      .from('custom_tracks')
      .update({
        is_approved: approve,
        status: approve ? 'approved' : 'rejected'
      })
      .eq('id', trackId);

    if (error) throw error;
    loadModerationList();
  } catch (err) {
    alert('Erro ao atualizar status: ' + err.message);
  }
};

window.deleteTrack = async (trackId) => {
  if (!confirm('Tem certeza que deseja excluir esta pista permanentemente?')) return;
  try {
    const { error } = await supabaseClient
      .from('custom_tracks')
      .delete()
      .eq('id', trackId);

    if (error) throw error;
    loadModerationList();
  } catch (err) {
    alert('Erro ao excluir pista: ' + err.message);
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
