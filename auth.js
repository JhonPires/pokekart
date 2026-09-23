// Substitua pelas suas chaves do painel do Supabase (Project Settings > API)
const SUPABASE_URL = 'https://ccazflqrpzngxvdwgpoq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjYXpmbHFycHpuZ3h2ZHdncG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MDIwMjAsImV4cCI6MjEwNDQ3ODAyMH0.lwOWX7-7wzNmBHNyp-6zWIusm5noA5s_zUak3qpOsVQ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado local do jogador logado e aba ativa do ranking
let currentUserProfile = null;
let activeLeaderboardTab = 'trophies'; // 'trophies', 'tracks_total' ou 'tracks_lap'

// Helper para sanitize de texto (prevenir XSS)
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Helper para formatar tempo (ms -> mm:ss.mmm)
function formatRecordTime(ms) {
  if (!ms || isNaN(ms) || ms === Infinity) return '--:--.---';
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
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    console.warn('Sessão de login expirada ou inválida. Limpando dados...');
    await supabaseClient.auth.signOut();
    if (window.location.pathname.includes('game.html')) {
      window.location.href = 'index.html';
    }
    return null;
  }

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

  if (currentUserProfile.selected_kart) {
    sessionStorage.setItem('pkart_selected_kart', currentUserProfile.selected_kart);
  }

  const sideNickEl = document.getElementById('sideMenuNick');
  if (sideNickEl && data.nickname) {
    sideNickEl.innerText = data.nickname;
  }

  return currentUserProfile;
}

// Salvar / Atualizar Kart Selecionado
async function updateSelectedKart(kartId) {
  if (!currentUserProfile) return;

  const isBase = kartId === 'jolteon' || kartId === 'charizard';
  const isPermanent = currentUserProfile.unlocked_karts && currentUserProfile.unlocked_karts.includes(kartId);
  const dailyFree = JSON.parse(localStorage.getItem('pkart_free_karts') || '[]');
  const isTemporary = dailyFree.includes(kartId);

  if (!isBase && !isPermanent && !isTemporary) return;

  const { error } = await supabaseClient
    .from('profiles')
    .update({ selected_kart: kartId, updated_at: new Date() })
    .eq('id', currentUserProfile.id);

  if (!error) {
    currentUserProfile.selected_kart = kartId;
  }
}

// Adicionar Moedas, Troféus e Estatísticas após a corrida
async function addRewards(coinsEarned, trophiesEarned, isWin = false, isLoss = false) {
  if (!currentUserProfile) return;

  const newCoins = currentUserProfile.coins + coinsEarned;
  const newTrophies = Math.max(0, currentUserProfile.trophies + trophiesEarned);

  // Usa os nomes corretos do Supabase
  const newWins = (currentUserProfile.races_won || 0) + (isWin ? 1 : 0);
  const newLosses = (currentUserProfile.races_lost || 0) + (isLoss ? 1 : 0);
  const newPlayed = (currentUserProfile.races_played || 0) + 1; // Atualiza o total de corridas

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      coins: newCoins,
      trophies: newTrophies,
      races_won: newWins,
      races_lost: newLosses,
      races_played: newPlayed,
      updated_at: new Date()
    })
    .eq('id', currentUserProfile.id);

  if (!error) {
    // Atualiza a cache local instantaneamente
    currentUserProfile.coins = newCoins;
    currentUserProfile.trophies = newTrophies;
    currentUserProfile.races_won = newWins;
    currentUserProfile.races_lost = newLosses;
    currentUserProfile.races_played = newPlayed;
  }
}

let isLoginMode = false;

// Preenche a barra superior e ativa as ações do Lobby com os dados do Supabase
async function updateLobbyUI() {
  const profile = await fetchPlayerProfile();
  if (profile) {
    const headerNick = document.getElementById('playerHeaderNick');
    const coinsText = document.getElementById('playerCoinsText');
    const trophiesText = document.getElementById('playerTrophiesText');

    if (headerNick) headerNick.innerText = profile.nickname || 'Piloto';
    if (coinsText) coinsText.innerText = profile.coins || 0;
    if (trophiesText) trophiesText.innerText = profile.trophies || 0;

    if (typeof updateLeagueUI === 'function') {
      updateLeagueUI(profile.trophies || 0);
    }

    if (typeof KART_DATABASE !== 'undefined' && profile.selected_kart) {
      const equippedIndex = KART_DATABASE.findIndex(k => k.id === profile.selected_kart);
      if (equippedIndex !== -1 && typeof selectedIndex !== 'undefined') {
        selectedIndex = equippedIndex;
        if (typeof updatePreview === 'function') updatePreview();
      }
    }
  }

  const btnStartRace = document.getElementById('btnStartRace');
  if (btnStartRace) {
    btnStartRace.addEventListener('click', (e) => {
      if (typeof roomCode === 'undefined' || !roomCode) {
        e.preventDefault();
        const selectedKart = profile ? (profile.selected_kart || 'jolteon') : 'jolteon';
        const nickname = profile ? profile.nickname : 'JOGADOR';
        window.location.href = `game.html?nick=${encodeURIComponent(nickname)}&kart=${selectedKart}&slot=0&players=1`;
      }
    });
  }

  // Carrega o ranking inicial corretamente chamando a nova função unificada
  await loadLeaderboardData();
}

// --- SISTEMA DE RANKINGS UNIFICADO (3 ABAS) ---

const tabTrophies = document.getElementById('tabLeaderboardTrophies');
const tabTracksTotal = document.getElementById('tabLeaderboardTracksTotal');
const tabTracksLap = document.getElementById('tabLeaderboardTracksLap');
const trackSelectorBox = document.getElementById('trackRecordSelectorBox');

// Função para atualizar o estilo visual das abas
function updateTabStyles(activeBtn) {
  [tabTrophies, tabTracksTotal, tabTracksLap].forEach(btn => {
    if (!btn) return;
    btn.className = 'btn';
    btn.style.background = 'rgba(7, 28, 49, .68)';
    btn.style.color = '#5bd5ff';
    btn.style.border = '1px solid #128dcc';
  });
  if (activeBtn) {
    activeBtn.className = 'btn primary';
    activeBtn.style.background = 'linear-gradient(135deg, #27c8ff, #078be8)';
    activeBtn.style.color = '#031525';
    activeBtn.style.border = '1px solid #52d6ff';
  }
}

// Configurar os cliques das 3 abas
if (tabTrophies && tabTracksTotal && tabTracksLap) {
  tabTrophies.onclick = () => {
    activeLeaderboardTab = 'trophies';
    updateTabStyles(tabTrophies);
    if (trackSelectorBox) trackSelectorBox.style.display = 'none';
    loadLeaderboardData();
  };

  tabTracksTotal.onclick = () => {
    activeLeaderboardTab = 'tracks_total';
    updateTabStyles(tabTracksTotal);
    if (trackSelectorBox) trackSelectorBox.style.display = 'block';
    const currentTrackVal = document.getElementById('leaderboardTrackSelect')?.value || 'default';
    loadLeaderboardData(currentTrackVal);
  };

  tabTracksLap.onclick = () => {
    activeLeaderboardTab = 'tracks_lap';
    updateTabStyles(tabTracksLap);
    if (trackSelectorBox) trackSelectorBox.style.display = 'block';
    const currentTrackVal = document.getElementById('leaderboardTrackSelect')?.value || 'default';
    loadLeaderboardData(currentTrackVal);
  };
}

// Função central para carregar e renderizar os dados do ranking ativo
async function loadLeaderboardData(trackId = 'default') {
  const listContainer = document.getElementById('leaderboardList');
  if (!listContainer) return;

  listContainer.innerHTML = '<div style="text-align: center; color: var(--muted); font-size: 13px; padding-top: 20px;">Carregando...</div>';

  if (typeof supabaseClient === 'undefined') return;

  try {
    if (activeLeaderboardTab === 'trophies') {
      // 1. Ranking Geral por Troféus
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('nickname, trophies, avatar')
        .order('trophies', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!data || data.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: var(--muted); font-size: 13px; padding-top: 20px;">Sem registos.</div>';
        return;
      }

      let html = '';
      data.forEach((row, index) => {
        let posBadge = `${index + 1}º`;
        if (index === 0) posBadge = '🥇 1º';
        else if (index === 1) posBadge = '🥈 2º';
        else if (index === 2) posBadge = '🥉 3º';

        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; font-size: 14px;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: bold;">
              <span style="font-size: 13px; color: #94a3b8; min-width: 38px;">${posBadge}</span>
              <span style="color: #f8fafc; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 130px;">${escapeHtml(row.nickname || 'Piloto')}</span>
            </div>
            <div style="font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 4px;">
              <span>🏆</span> ${row.trophies || 0}
            </div>
          </div>
        `;
      });
      listContainer.innerHTML = html;

    } else if (activeLeaderboardTab === 'tracks_total') {
      // 2. Recordes de Pista (Tempo Total)
      const { data, error } = await supabaseClient
        .from('track_records')
        .select('best_time_ms, kart_id, profiles(nickname)')
        .eq('track_id', trackId)
        .order('best_time_ms', { ascending: true })
        .limit(20);

      if (error) throw error;
      if (!data || data.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: var(--muted); font-size: 12px; padding-top: 10px;">Ainda não há recordes nesta pista!</div>';
        return;
      }

      let html = '';
      data.forEach((row, index) => {
        let posBadge = `${index + 1}º`;
        if (index === 0) posBadge = '🥇 1º';
        else if (index === 1) posBadge = '🥈 2º';
        else if (index === 2) posBadge = '🥉 3º';

        const timeFormatted = formatRecordTime(row.best_time_ms);
        const nick = row.profiles?.nickname || 'Piloto';

        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; font-size: 14px;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: bold;">
              <span style="font-size: 13px; color: #94a3b8; min-width: 38px;">${posBadge}</span>
              <span style="color: #f8fafc; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 130px;">${escapeHtml(nick)}</span>
            </div>
            <div style="font-weight: bold; color: #facc15; font-family: monospace; font-size: 13px;">
              ⏱️ ${timeFormatted}
            </div>
          </div>
        `;
      });
      listContainer.innerHTML = html;

    } else {
      // 3. Recordes de Volta Mais Rápida (best_lap_ms)
      const { data, error } = await supabaseClient
        .from('track_records')
        .select('best_lap_ms, profiles(nickname)')
        .eq('track_id', trackId)
        .order('best_lap_ms', { ascending: true })
        .limit(20);

      if (error) throw error;
      if (!data || data.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: var(--muted); font-size: 12px; padding-top: 10px;">Ainda não há registos de volta rápida nesta pista!</div>';
        return;
      }

      let html = '';
      data.forEach((row, index) => {
        let posBadge = `${index + 1}º`;
        if (index === 0) posBadge = '🥇 1º';
        else if (index === 1) posBadge = '🥈 2º';
        else if (index === 2) posBadge = '🥉 3º';

        const lapFormatted = formatRecordTime(row.best_lap_ms);
        const nick = row.profiles?.nickname || 'Piloto';

        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; font-size: 14px;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: bold;">
              <span style="font-size: 13px; color: #94a3b8; min-width: 38px;">${posBadge}</span>
              <span style="color: #f8fafc; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 130px;">${escapeHtml(nick)}</span>
            </div>
            <div style="color: #38bdf8; font-weight: bold; font-family: monospace; font-size: 13px;">
              ⚡ ${lapFormatted}
            </div>
          </div>
        `;
      });
      listContainer.innerHTML = html;
    }
  } catch (err) {
    console.error("Erro ao carregar leaderboard:", err);
    listContainer.innerHTML = '<div style="text-align: center; color: #ff4b55; font-size: 13px; padding-top: 20px;">Erro ao carregar dados.</div>';
  }
}

// Integração com o seletor de pistas personalizado do modal
const rankDropdownMenu = document.getElementById('rankDropdownMenu');
if (rankDropdownMenu) {
  rankDropdownMenu.addEventListener('click', (e) => {
    const opt = e.target.closest('.customDropdownOption');
    if (opt) {
      const trackVal = opt.getAttribute('data-value') || 'default';
      loadLeaderboardData(trackVal);
    }
  });
}

const leaderboardTrackSelect = document.getElementById('leaderboardTrackSelect');
if (leaderboardTrackSelect) {
  leaderboardTrackSelect.onchange = () => {
    loadLeaderboardData(leaderboardTrackSelect.value);
  };
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
      activeLeaderboardTab = 'trophies';
      if (tabTrophies) updateTabStyles(tabTrophies);
      if (trackSelectorBox) trackSelectorBox.style.display = 'none';
      loadLeaderboardData();
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