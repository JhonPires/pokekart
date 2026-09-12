// music.js - Gerenciador de Áudio Contínuo com Playlist

const playlist = [
    'sounds/lobby_theme.mp3', // Substitua pelos nomes reais das suas músicas
    'sounds/lobby_theme2.mp3',
    'sounds/lobby_theme3.mp3',
    'sounds/lobby_theme4.mp3',
    'sounds/lobby_theme5.mp3',
    'sounds/lobby_theme6.mp3',
    'sounds/lobby_theme7.mp3',
    'sounds/lobby_theme8.mp3',
    'sounds/lobby_theme9.mp3'
];

// Recupera o estado salvo ou define os padrões
let currentIndex = parseInt(sessionStorage.getItem('pkart_music_index')) || 0;
let savedTime = parseFloat(sessionStorage.getItem('pkart_music_time')) || 0;
const isPlaying = sessionStorage.getItem('pkart_music_playing');

// Segurança caso você remova músicas da lista no futuro
if (currentIndex >= playlist.length) {
    currentIndex = 0;
    savedTime = 0;
}

// Busca o volume salvo nas opções, se não houver, usa 0.4
let savedVolume = parseFloat(localStorage.getItem('pkart_music_vol'));
if (isNaN(savedVolume)) savedVolume = 0.4;

const globalMusic = new Audio(playlist[currentIndex]);
window.globalMusic = globalMusic;

// Aplica o volume correto instantaneamente em qualquer tela
globalMusic.volume = savedVolume;
globalMusic.currentTime = savedTime;

// Quando a música acabar, avança para a próxima
globalMusic.addEventListener('ended', () => {
    currentIndex++;

    // Se chegou no fim da lista, volta para a primeira
    if (currentIndex >= playlist.length) {
        currentIndex = 0;
    }

    globalMusic.src = playlist[currentIndex];
    globalMusic.currentTime = 0;
    globalMusic.play().catch(e => console.warn('Erro ao tocar próxima música:', e));

    sessionStorage.setItem('pkart_music_index', currentIndex);
    sessionStorage.setItem('pkart_music_time', 0);
});

// Se estava tocando na tela anterior, tenta retomar
if (isPlaying === 'true') {
    globalMusic.play().catch(() => {
        console.warn('O navegador exigiu interação para retomar a música.');
    });
}

// Salva o progresso continuamente (a cada meio segundo)
setInterval(() => {
    if (!globalMusic.paused) {
        sessionStorage.setItem('pkart_music_time', globalMusic.currentTime);
        sessionStorage.setItem('pkart_music_index', currentIndex);
        sessionStorage.setItem('pkart_music_playing', 'true');
    }
}, 500);

// Salva exatamente no momento em que o jogador troca de tela
window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('pkart_music_time', globalMusic.currentTime);
    sessionStorage.setItem('pkart_music_index', currentIndex);
    sessionStorage.setItem('pkart_music_playing', !globalMusic.paused ? 'true' : 'false');
});

// Função para dar o primeiro Play (chamar ao clicar no botão de Login)
window.playGlobalMusic = function () {
    globalMusic.play().catch(e => console.log('Aguardando interação', e));
    sessionStorage.setItem('pkart_music_playing', 'true');
};

// Função opcional para você colocar em um botão de "Pular Música" nas opções
window.nextGlobalMusic = function () {
    globalMusic.dispatchEvent(new Event('ended'));
};

// --- AUTO-PLAY NO PRIMEIRO CLIQUE (Para jogadores já logados) ---
function startMusicOnFirstInteraction() {
    // Verifica no armazenamento se a música está desativada
    const isMusicEnabled = localStorage.getItem('pkart_music') !== 'false';

    // Só dá o play se a música estiver habilitada pelo jogador
    if (isMusicEnabled && globalMusic.paused) {
        globalMusic.play().then(() => {
            sessionStorage.setItem('pkart_music_playing', 'true');
        }).catch(e => console.warn('Áudio aguardando interação:', e));
    }

    // Após o primeiro clique, removemos os ouvintes para não pesar a memória
    document.removeEventListener('click', startMusicOnFirstInteraction);
    document.removeEventListener('keydown', startMusicOnFirstInteraction);
    document.removeEventListener('touchstart', startMusicOnFirstInteraction);
}

// --- FUNÇÕES GLOBAIS DE CONTROLE DE MÍDIA ---

// Avançar para a próxima música da playlist
window.nextGlobalMusic = function () {
    currentIndex++;
    if (currentIndex >= playlist.length) {
        currentIndex = 0;
    }
    globalMusic.src = playlist[currentIndex];
    globalMusic.currentTime = 0;
    globalMusic.play().catch(e => console.warn('Erro ao avançar música:', e));

    sessionStorage.setItem('pkart_music_index', currentIndex);
    sessionStorage.setItem('pkart_music_time', 0);
    sessionStorage.setItem('pkart_music_playing', 'true');
};

// Voltar para a música anterior da playlist
window.prevGlobalMusic = function () {
    currentIndex--;
    if (currentIndex < 0) {
        currentIndex = playlist.length - 1;
    }
    globalMusic.src = playlist[currentIndex];
    globalMusic.currentTime = 0;
    globalMusic.play().catch(e => console.warn('Erro ao voltar música:', e));

    sessionStorage.setItem('pkart_music_index', currentIndex);
    sessionStorage.setItem('pkart_music_time', 0);
    sessionStorage.setItem('pkart_music_playing', 'true');
};

// Alternar entre Play e Pause
window.togglePlayPauseGlobalMusic = function () {
    const playPauseBtn = document.getElementById('btnMusicPlayPause');
    if (globalMusic.paused) {
        globalMusic.play().catch(e => console.warn('Erro ao reproduzir:', e));
        sessionStorage.setItem('pkart_music_playing', 'true');
        if (playPauseBtn) playPauseBtn.innerText = '⏸';
    } else {
        globalMusic.pause();
        sessionStorage.setItem('pkart_music_playing', 'false');
        if (playPauseBtn) playPauseBtn.innerText = '▶';
    }
};

// Fica escutando qualquer ação inicial do jogador na tela inteira
document.addEventListener('click', startMusicOnFirstInteraction);
document.addEventListener('keydown', startMusicOnFirstInteraction);
document.addEventListener('touchstart', startMusicOnFirstInteraction);