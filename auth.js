// Substitua pelas suas chaves do painel do Supabase (Project Settings > API)
const SUPABASE_URL = 'https://ccazflqrpzngxvdwgpoq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjYXpmbHFycHpuZ3h2ZHdncG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MDIwMjAsImV4cCI6MjEwNDQ3ODAyMH0.lwOWX7-7wzNmBHNyp-6zWIusm5noA5s_zUak3qpOsVQ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado local do jogador logado
let currentUserProfile = null;

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
  return data;
}

// Salvar / Atualizar Kart Selecionado
async function updateSelectedKart(kartId) {
  if (!currentUserProfile) return;
  if (!currentUserProfile.unlocked_karts.includes(kartId)) return;

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

// Preenche o modal e ativa as ações do Lobby com os dados do Supabase
async function updateLobbyUI() {
  // 1. Dados do Jogador Logado
  const profile = await fetchPlayerProfile();
  if (profile) {
    const nickInput = document.getElementById('playerNicknameInput');
    const coinsText = document.getElementById('playerCoinsText');
    const trophiesText = document.getElementById('playerTrophiesText');

    if (nickInput) {
      nickInput.value = profile.nickname;
      nickInput.disabled = true;
      nickInput.readOnly = true;
    }

    if (coinsText) coinsText.innerText = profile.coins;
    if (trophiesText) trophiesText.innerText = profile.trophies;

    // Sincroniza o seletor de kart do lobby com o kart equipado no perfil do jogador
    if (typeof KART_DATABASE !== 'undefined' && profile.selected_kart) {
      const equippedIndex = KART_DATABASE.findIndex(k => k.id === profile.selected_kart);
      if (equippedIndex !== -1 && typeof selectedIndex !== 'undefined') {
        selectedIndex = equippedIndex;
        if (typeof updatePreview === 'function') updatePreview();
      }
    }
  }

  // 2. Configura os Botões do Lobby
  const btnGarage = document.getElementById('btnOpenGarage');
  if (btnGarage) {
    btnGarage.onclick = () => window.location.href = 'garage.html';
  }

  const btnStartRace = document.getElementById('btnStartRace');
  if (btnStartRace) {
    btnStartRace.onclick = () => {
      const selectedKart = profile ? (profile.selected_kart || 'jolteon') : 'jolteon';
      const nickname = profile ? profile.nickname : 'JOGADOR';
      window.location.href = `game.html?nick=${encodeURIComponent(nickname)}&kart=${selectedKart}`;
    };
  }

  // 3. Busca e Renderiza o Ranking Global
  await loadLeaderboard();
}

// Função para buscar os TOP 10 Jogadores com mais Troféus no Supabase
async function loadLeaderboard() {
  const listEl = document.getElementById('leaderboardList');
  if (!listEl) return;

  if (typeof supabaseClient === 'undefined') {
    listEl.innerHTML = '<div style="text-align:center; color:#ef4444; font-size:12px;">Erro ao conectar Supabase</div>';
    return;
  }

  // Busca do banco ordenando por maior quantidade de troféus
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
    const item = document.createElement('div');
    item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-size: 14px;';

    // Destaque para os 3 primeiros colocados (Ouro, Prata e Bronze)
    let posBadge = `${index + 1}º`;
    if (index === 0) posBadge = '🥇 1º';
    else if (index === 1) posBadge = '🥈 2º';
    else if (index === 2) posBadge = '🥉 3º';

    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-weight: bold;">
        <span style="font-size: 13px; color: #94a3b8; min-width: 38px;">${posBadge}</span>
        <span style="color: #f8fafc; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 130px;">${player.nickname || 'Anônimo'}</span>
      </div>
      <div style="font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 4px;">
        <span>🏆</span> ${player.trophies || 0}
      </div>
    `;

    listEl.appendChild(item);
  });
}

// Inicialização dos Eventos e Autenticação
document.addEventListener('DOMContentLoaded', async () => {
  const modal = document.getElementById('authModal');
  const toggleBtn = document.getElementById('toggleAuthMode');
  const submitBtn = document.getElementById('btnAuthSubmit');
  const title = document.getElementById('authTitle');
  const nickInput = document.getElementById('authNick');

  // Verifica se o jogador já está logado ao abrir a página
  const profile = await fetchPlayerProfile();
  if (profile) {
    if (modal) modal.style.display = 'none';
    console.log('Jogador logado:', profile.nickname);
  }

  // Alterna entre modo Cadastro e Login
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      isLoginMode = !isLoginMode;
      title.innerText = isLoginMode ? 'Entrar na Conta' : 'Criar Conta';
      submitBtn.innerText = isLoginMode ? 'ENTRAR' : 'CADASTRAR';
      toggleBtn.innerText = isLoginMode ? 'Não tem conta? Cadastrar-se' : 'Já tem uma conta? Entrar';
      nickInput.style.display = isLoginMode ? 'none' : 'block';
    };
  }

  // Envio do Formulário
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const email = document.getElementById('authEmail').value;
      const password = document.getElementById('authPassword').value;
      const nickname = document.getElementById('authNick').value;

      try {
        if (isLoginMode) {
          await loginPlayer(email, password);
        } else {
          if (!nickname) { alert('Digite um nickname!'); return; }
          await signUpPlayer(email, password, nickname);
          await loginPlayer(email, password);
        }
        if (modal) modal.style.display = 'none';
        window.location.reload(); // Recarrega para aplicar os dados logados no menu
      } catch (err) {
        alert('Erro ao autenticar: ' + err.message);
      }
    };
  }

  // Atualiza a Interface do Lobby
  updateLobbyUI();
});