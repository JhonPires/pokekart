// music.js - Gerenciador de Áudio Contínuo com Playlist

const playlist = [
    'sounds/lobby_theme.mp3', // Substitua pelos nomes reais das suas músicas
    'sounds/lobby_theme2.mp3',
    'sounds/lobby_theme3.mp3'
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

// Fica escutando qualquer ação inicial do jogador na tela inteira
document.addEventListener('click', startMusicOnFirstInteraction);
document.addEventListener('keydown', startMusicOnFirstInteraction);
document.addEventListener('touchstart', startMusicOnFirstInteraction);