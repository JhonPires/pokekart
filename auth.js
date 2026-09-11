// Substitua pelas suas chaves do painel do Supabase (Project Settings > API)
const SUPABASE_URL = 'https://ccazflqrpzngxvdwgpoq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjYXpmbHFycHpuZ3h2ZHdncG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MDIwMjAsImV4cCI6MjEwNDQ3ODAyMH0.lwOWX7-7wzNmBHNyp-6zWIusm5noA5s_zUak3qpOsVQ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado local do jogador logado e modo do ranking
let currentUserProfile = null;
let currentLeaderboardMode = 'trophies'; // 'trophies' | 'tracks'

// Helper para sanitize de texto (prevenir XSS)
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Helper para formatar tempo (ms -> mm:ss.mmm)
function formatRecordTime(ms) {
  if (!ms || isNaN(ms)) return '--:--.---';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

// Cadastrar com Email e Senha
async function signUpPlayer(email, password, nickname) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { nickname } }
  });
  if (error) throw error;
  return data;
}

// Fazer Login
async function loginPlayer(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await fetchPlayerProfile();
  return data;
}

// Carregar Perfil do Jogador Logado
async function fetchPlayerProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Erro ao buscar perfil:', error);
    return null;
  }

  currentUserProfile = data;

  // --- NOVA VERIFICAÇÃO DE KART EXPIRADO ---
  // Se o kart equipado no banco não for permanente e não estiver na rotação de hoje, volta para o Jolteon
  if (currentUserProfile.selected_kart) {
    const currentKart = currentUserProfile.selected_kart;
    const isBase = currentKart === 'jolteon' || currentKart === 'charizard';
    const isPermanent = currentUserProfile.unlocked_karts && currentUserProfile.unlocked_karts.includes(currentKart);
    const dailyFree = JSON.parse(localStorage.getItem('pkart_free_karts') || '[]');
    const isTemporary = dailyFree.includes(currentKart);

    if (!isBase && !isPermanent && !isTemporary) {
      console.warn('[Sistema] Kart expirado detectado. Revertendo para kart padrão.');
      await updateSelectedKart('jolteon');
    }
  }
  // -----------------------------------------

  // Atualiza o nickname no Menu Lateral
  const sideNickEl = document.getElementById('sideMenuNick');
  if (sideNickEl && data.nickname) {
    sideNickEl.innerText = data.nickname;
  }

  return currentUserProfile;
}

// Salvar / Atualizar Kart Selecionado
async function updateSelectedKart(kartId) {
  if (!currentUserProfile) return;

  // Valida se o kart é padrão, comprado permanentemente ou se é grátis hoje
  const isBase = kartId === 'jolteon' || kartId === 'charizard';
  const isPermanent = currentUserProfile.unlocked_karts && currentUserProfile.unlocked_karts.includes(kartId);
  const dailyFree = JSON.parse(localStorage.getItem('pkart_free_karts') || '[]');
  const isTemporary = dailyFree.includes(kartId);

  // Se o jogador não tem acesso legal ao kart, bloqueia
  if (!isBase && !isPermanent && !isTemporary) return;

  const { error } = await supabaseClient
    .from('profiles')
    .update({ selected_kart: kartId, updated_at: new Date() })
    .eq('id', currentUserProfile.id);

  if (!error) {
    currentUserProfile.selected_kart = kartId;
  }
}

// Adicionar Moedas e Troféus após a corrida (Chamado no game.js ao finalizar a corrida)
async function addRewards(coinsEarned, trophiesEarned) {
  if (!currentUserProfile) return;

  const newCoins = currentUserProfile.coins + coinsEarned;
  const newTrophies = Math.max(0, currentUserProfile.trophies + trophiesEarned);

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      coins: newCoins,
      trophies: newTrophies,
      updated_at: new Date()
    })
    .eq('id', currentUserProfile.id);

  if (!error) {
    currentUserProfile.coins = newCoins;
    currentUserProfile.trophies = newTrophies;
  }
}

let isLoginMode = false;

// Preenche a barra superior e ativa as ações do Lobby com os dados do Supabase
async function updateLobbyUI() {
  // 1. Dados do Jogador Logado
  const profile = await fetchPlayerProfile();
  if (profile) {
    const headerNick = document.getElementById('playerHeaderNick');
    const coinsText = document.getElementById('playerCoinsText');
    const trophiesText = document.getElementById('playerTrophiesText'); // Correção aqui (remoção do .innerText)

    if (headerNick) headerNick.innerText = profile.nickname || 'Piloto';
    if (coinsText) coinsText.innerText = profile.coins || 0;
    if (trophiesText) trophiesText.innerText = profile.trophies || 0; // Correção aqui (usando 'profile' em vez de 'profileData')

    // Sincroniza o seletor de kart do lobby com o kart equipado no perfil do jogador
    if (typeof KART_DATABASE !== 'undefined' && profile.selected_kart) {
      const equippedIndex = KART_DATABASE.findIndex(k => k.id === profile.selected_kart);
      if (equippedIndex !== -1 && typeof selectedIndex !== 'undefined') {
        selectedIndex = equippedIndex;
        if (typeof updatePreview === 'function') updatePreview();
      }
    }
  }

  // 2. Configura os Botões do Lobby (Respeitando o Multiplayer)
  const btnStartRace = document.getElementById('btnStartRace');
  if (btnStartRace) {
    // Removemos o .onclick direto daqui para deixar o gerenciador global do index.html funcionar,
    // mas garantimos que se clicar sem sala, ele joga solo com o kart e nick corretos do perfil.
    btnStartRace.addEventListener('click', (e) => {
      if (typeof roomCode === 'undefined' || !roomCode) {
        e.preventDefault();
        const selectedKart = profile ? (profile.selected_kart || 'jolteon') : 'jolteon';
        const nickname = profile ? profile.nickname : 'JOGADOR';
        window.location.href = `game.html?nick=${encodeURIComponent(nickname)}&kart=${selectedKart}&slot=0`;
      }
    });
  }

  // 3. Busca e Renderiza o Ranking Inicial (Troféus)
  await loadTrophiesLeaderboard();
}

// Renderiza o Ranking Global por Troféus
async function loadTrophiesLeaderboard() {
  const listEl = document.getElementById('leaderboardList');
  const titleEl = document.getElementById('leaderboardColumnTitle');
  if (!listEl) return;

  if (titleEl) titleEl.innerText = 'TROFÉUS';

  if (typeof supabaseClient === 'undefined') {
    listEl.innerHTML = '<div style="text-align:center; color:#ef4444; font-size:12px;">Erro ao conectar Supabase</div>';
    return;
  }

  const { data: topPlayers, error } = await supabaseClient
    .from('profiles')
    .select('nickname, trophies')
    .order('trophies', { ascending: false })
    .limit(10);

  if (error || !topPlayers) {
    console.error('Erro ao buscar ranking:', error);
    listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px;">Falha ao carregar ranking</div>';
    return;
  }

  listEl.innerHTML = '';

  topPlayers.forEach((player, index) => {
    let posBadge = `${index + 1}º`;
    if (index === 0) posBadge = '🥇 1º';
    else if (index === 1) posBadge = '🥈 2º';
    else if (index === 2) posBadge = '🥉 3º';

    const item = document.createElement('div');
    item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-size: 14px;';
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-weight: bold;">
        <span style="font-size: 13px; color: #94a3b8; min-width: 38px;">${posBadge}</span>
        <span style="color: #f8fafc; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 130px;">${escapeHtml(player.nickname || 'Anônimo')}</span>
      </div>
      <div style="font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 4px;">
        <span>🏆</span> ${player.trophies || 0}
      </div>
    `;

    listEl.appendChild(item);
  });
}

// Renderiza o Ranking de Recordes por Pista (Join track_records -> profiles)
async function loadTrackRecordsLeaderboard(trackId) {
  const listEl = document.getElementById('leaderboardList');
  const titleEl = document.getElementById('leaderboardColumnTitle');
  if (!listEl) return;

  if (titleEl) titleEl.innerText = 'TEMPO';
  listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px; padding-top:10px;">Carregando recordes...</div>';

  try {
    const { data: records, error } = await supabaseClient
      .from('track_records')
      .select('best_time_ms, profiles ( nickname )')
      .eq('track_id', trackId || 'default')
      .order('best_time_ms', { ascending: true }) // Menor tempo primeiro
      .limit(10);

    if (error) throw error;

    if (!records || records.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px; padding-top:10px;">Nenhum recorde registrado nesta pista ainda!</div>';
      return;
    }

    listEl.innerHTML = '';
    records.forEach((rec, index) => {
      let posBadge = `${index + 1}º`;
      if (index === 0) posBadge = '🥇 1º';
      else if (index === 1) posBadge = '🥈 2º';
      else if (index === 2) posBadge = '🥉 3º';

      const nick = rec.profiles ? rec.profiles.nickname : 'Piloto';
      const timeStr = formatRecordTime(rec.best_time_ms);

      const item = document.createElement('div');
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-size: 14px;';
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; font-weight: bold;">
          <span style="font-size: 13px; color: #94a3b8; min-width: 38px;">${posBadge}</span>
          <span style="color: #f8fafc; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 120px;">${escapeHtml(nick)}</span>
        </div>
        <div style="font-weight: bold; color: #facc15; font-family: monospace; font-size: 13px;">
          ⏱️ ${timeStr}
        </div>
      `;
      listEl.appendChild(item);
    });

  } catch (err) {
    console.error('Erro ao buscar recordes:', err);
    listEl.innerHTML = '<div style="text-align:center; color:#ef4444; font-size:12px;">Erro ao carregar recordes</div>';
  }
}

// Configura as Abas e Seletores do Ranking
function setupLeaderboardTabs() {
  const btnTrophies = document.getElementById('tabLeaderboardTrophies');
  const btnTracks = document.getElementById('tabLeaderboardTracks');
  const trackSelectorBox = document.getElementById('trackRecordSelectorBox');
  const trackSelect = document.getElementById('leaderboardTrackSelect');

  if (btnTrophies && btnTracks) {
    // Clique na Aba TROFÉUS
    btnTrophies.onclick = () => {
      currentLeaderboardMode = 'trophies';

      // Estilo Ativo (Azul com texto escuro)
      btnTrophies.style.background = '#38bdf8';
      btnTrophies.style.color = '#0f172a';
      btnTrophies.style.border = 'none';

      // Estilo Inativo (Transparente com texto cinza)
      btnTracks.style.background = 'transparent';
      btnTracks.style.color = '#94a3b8';
      btnTracks.style.border = '1px solid #334155';

      if (trackSelectorBox) trackSelectorBox.style.display = 'none';
      loadTrophiesLeaderboard();
    };

    // Clique na Aba RECORDES
    btnTracks.onclick = () => {
      currentLeaderboardMode = 'tracks';

      // Estilo Ativo (Azul com texto escuro)
      btnTracks.style.background = '#38bdf8';
      btnTracks.style.color = '#0f172a';
      btnTracks.style.border = 'none';

      // Estilo Inativo (Transparente com texto cinza)
      btnTrophies.style.background = 'transparent';
      btnTrophies.style.color = '#94a3b8';
      btnTrophies.style.border = '1px solid #334155';

      if (trackSelectorBox) trackSelectorBox.style.display = 'block';
      const selectedTrack = trackSelect ? trackSelect.value : 'default';
      loadTrackRecordsLeaderboard(selectedTrack);
    };
  }

  if (trackSelect) {
    trackSelect.onchange = () => {
      if (currentLeaderboardMode === 'tracks') {
        loadTrackRecordsLeaderboard(trackSelect.value);
      }
    };
  }
}

// Gerenciamento do Menu Lateral (Drawer) e Modais Popup
function setupSideMenu() {
  const btnOpen = document.getElementById('btnOpenSideMenu');
  const btnClose = document.getElementById('btnCloseSideMenu');
  const drawer = document.getElementById('sideMenuDrawer');
  const overlay = document.getElementById('sideMenuOverlay');

  const btnRankings = document.getElementById('menuBtnRankings');
  const rankingModal = document.getElementById('rankingModalOverlay');
  const btnCloseRanking = document.getElementById('btnCloseRankingModal');
  const btnGarage = document.getElementById('menuBtnGarage');
  const btnLogout = document.getElementById('btnLogout');
  const btnTrackBuilder = document.getElementById('menuBtnTrackBuilder');

  if (btnTrackBuilder) {
    btnTrackBuilder.onclick = () => window.location.href = 'track_builder.html';
  }

  function openMenu() {
    if (drawer) drawer.style.left = '0px';
    if (overlay) overlay.style.display = 'block';
  }

  function closeMenu() {
    if (drawer) drawer.style.left = '-320px';
    if (overlay) overlay.style.display = 'none';
  }

  if (btnOpen) btnOpen.onclick = openMenu;
  if (btnClose) btnClose.onclick = closeMenu;
  if (overlay) overlay.onclick = closeMenu;

  // Abrir Modal de Rankings pelo Menu Lateral
  if (btnRankings) {
    btnRankings.onclick = () => {
      closeMenu();
      if (rankingModal) rankingModal.style.display = 'flex';
      loadTrophiesLeaderboard();
    };
  }

  if (btnCloseRanking) {
    btnCloseRanking.onclick = () => {
      if (rankingModal) rankingModal.style.display = 'none';
    };
  }

  // Redirecionar para a Garagem
  if (btnGarage) {
    btnGarage.onclick = () => window.location.href = 'garage.html';
  }

  // Ação de Sair da Conta (Logout)
  if (btnLogout) {
    btnLogout.onclick = async () => {
      if (confirm('Deseja realmente sair da sua conta?')) {
        await supabaseClient.auth.signOut();
        window.location.reload();
      }
    };
  }
}

// Inicialização dos Eventos e Autenticação
document.addEventListener('DOMContentLoaded', async () => {
  const modal = document.getElementById('authModal');
  const toggleBtn = document.getElementById('toggleAuthMode');
  const submitBtn = document.getElementById('btnAuthSubmit');
  const title = document.getElementById('authTitle');
  const nickInput = document.getElementById('authNick');

  setupLeaderboardTabs();
  setupSideMenu();

  // Verifica a sessão atual com o Supabase
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    if (modal) modal.style.display = 'none';
    await updateLobbyUI();
  } else {
    if (modal) modal.style.display = 'flex';
  }

  // Alterna entre modo Cadastro e Login
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      isLoginMode = !isLoginMode;
      if (title) title.innerText = isLoginMode ? 'Entrar na Conta' : 'Criar Conta';
      if (submitBtn) submitBtn.innerText = isLoginMode ? 'ENTRAR' : 'CADASTRAR';
      if (toggleBtn) toggleBtn.innerText = isLoginMode ? 'Não tem conta? Cadastrar-se' : 'Já tem uma conta? Entrar';
      if (nickInput) nickInput.style.display = isLoginMode ? 'none' : 'block';
    };
  }

  // Envio do Formulário de Auth
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const emailEl = document.getElementById('authEmail');
      const passEl = document.getElementById('authPassword');
      const nickEl = document.getElementById('authNick');

      const email = emailEl ? emailEl.value.trim() : '';
      const password = passEl ? passEl.value.trim() : '';
      const nickname = nickEl ? nickEl.value.trim() : '';

      try {
        if (isLoginMode) {
          await loginPlayer(email, password);
        } else {
          if (!nickname) { alert('Digite um nickname!'); return; }
          await signUpPlayer(email, password, nickname);
          await loginPlayer(email, password);
        }
        if (modal) modal.style.display = 'none';
        window.location.reload();
      } catch (err) {
        alert('Erro ao autenticar: ' + err.message);
      }
    };
  }
});