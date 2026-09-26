// =======================================================
// POKEKART - MOTOR DO MODO HUB (hub.js)
// =======================================================

// =======================================================
// POKEKART - MOTOR DO MODO HUB (hub.js)
// =======================================================

// 1. LER PARÂMETROS E ESTADO (Via Storage, sem URL)
const nick = sessionStorage.getItem('pkart_nickname') || 'Player';
const kartId = sessionStorage.getItem('pkart_selected_kart') || 'jolteon';

// Lê o estado completo da torre guardado ao sair do Lobby
const towerState = JSON.parse(localStorage.getItem('pkart_tower_state') || '{"floor": 1, "biome": "grass", "maxFloors": 5, "leader": "Desconhecido"}');

const biome = towerState.biome || 'grass';
const maxFloors = towerState.maxFloors || 5;
const leaderName = towerState.leader || 'Desconhecido';
const andarAtual = towerState.floor || 1;

const gymName = leaderName !== 'Desconhecido' ? `Ginásio de ${leaderName}` : 'Torre Pokémon';

// --- INJETAR DADOS NA HUD ---
document.getElementById('hudGymName').innerText = gymName;
document.getElementById('hudLeaderName').innerText = leaderName;
document.getElementById('hudFloorCount').innerText = `Andar ${andarAtual} / ${maxFloors}`;

// Calcula a percentagem da barra de progresso
const percentagemProgresso = (andarAtual / maxFloors) * 100;
document.getElementById('hudProgressBar').style.width = `${percentagemProgresso}%`;

// Se for o Boss, a barra fica vermelha/laranja para indicar perigo
if (andarAtual === maxFloors) {
    document.getElementById('hudProgressBar').style.background = 'linear-gradient(90deg, #ef4444, #f59e0b)';
    document.getElementById('hudFloorCount').innerText = '🔥 LÍDER DO GINÁSIO 🔥';
    document.getElementById('hudFloorCount').style.color = '#ef4444';
}

// 2. CONFIGURAÇÃO THREE.JS
const scene = new THREE.Scene();
// --- SISTEMA DE BIOMAS NO HUB ---
const biomeColors = {
    grass: { sky: 0x87ceeb, ground: 0x2d8a3a },
    water: { sky: 0x4fc3f7, ground: 0x0288d1 },
    dirt: { sky: 0xcd853f, ground: 0x8b4513 },
    city: { sky: 0x1a1a2e, ground: 0x333333 },
    poison: { sky: 0x4a148c, ground: 0x2e003e },
    ghost: { sky: 0x000000, ground: 0x1c1c1c },
    lava: { sky: 0x3e1010, ground: 0x1a0505 }
};

const currentBiomeColors = biomeColors[biome] || biomeColors['grass'];

// --- CÉU COM DEGRADÊ (GRADIENT SKY) E NÉVOA ---
const corTopo = new THREE.Color(currentBiomeColors.sky);
// Mistura a cor do céu com um pouco de branco para criar a cor do horizonte
const corHorizonte = corTopo.clone().lerp(new THREE.Color(0xdcecff), 0.4);

scene.background = corHorizonte; // Fundo base

// Cria a textura em degradê
const canvasCeu = document.createElement('canvas');
canvasCeu.width = 2;
canvasCeu.height = 512;
const ctxCeu = canvasCeu.getContext('2d');
const gradiente = ctxCeu.createLinearGradient(0, 0, 0, 512);

gradiente.addColorStop(0, corTopo.getStyle()); // Azul/Roxo forte no topo
gradiente.addColorStop(1, corHorizonte.getStyle()); // Cor clara no horizonte
ctxCeu.fillStyle = gradiente;
ctxCeu.fillRect(0, 0, 2, 512);

const texturaCeu = new THREE.CanvasTexture(canvasCeu);

// Cria um domo gigante à volta do mapa para o céu
const ceuGeo = new THREE.SphereGeometry(180, 32, 16);
const ceuMat = new THREE.MeshBasicMaterial({ map: texturaCeu, side: THREE.BackSide, fog: false });
const domoCeu = new THREE.Mesh(ceuGeo, ceuMat);
scene.add(domoCeu);

// A névoa AGORA usa a cor do horizonte para uma fusão perfeita!
scene.fog = new THREE.Fog(corHorizonte.getHex(), 40, 130);

// Luzes
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

// Quando for criar o chão (floorMat), use a cor do bioma:
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- NOVO CHÃO E RUA COMPACTA ---
const espacamento = 30; // Distância entre os andares (antes era 60)

// --- NOVO CHÃO COM TEXTURA PROCEDURAL (Grama/Terra) ---
const compEstrada = (maxFloors * espacamento) + 60;

// 1. Criar a textura rústica via Canvas
const canvasChao = document.createElement('canvas');
canvasChao.width = 256;
canvasChao.height = 256;
const ctxChao = canvasChao.getContext('2d');

// Pinta o fundo com a cor do bioma (ex: o Roxo ou Verde)
const corBase = new THREE.Color(currentBiomeColors.ground);
ctxChao.fillStyle = corBase.getStyle();
ctxChao.fillRect(0, 0, 256, 256);

// Desenha 5000 pequenas manchas para parecer relva ou terra irregular
for (let i = 0; i < 5000; i++) {
    // Mistura folhinhas mais escuras e mais claras
    ctxChao.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 2 + Math.random() * 3; // Largura
    const h = 2 + Math.random() * 6; // Altura (ligeiramente esticado)
    ctxChao.fillRect(x, y, w, h);
}

// 2. Transforma o Canvas em textura repetível
const texturaChao = new THREE.CanvasTexture(canvasChao);
texturaChao.wrapS = THREE.RepeatWrapping;
texturaChao.wrapT = THREE.RepeatWrapping;
texturaChao.repeat.set(30, (compEstrada + 40) / 10); // Repete a textura pelo mapa todo

// 3. Aplica a textura no material do chão
const floorGeo = new THREE.PlaneGeometry(100, compEstrada + 40);
const floorMat = new THREE.MeshStandardMaterial({
    map: texturaChao, // <- Usa a textura em vez de uma cor sólida
    roughness: 0.9
});

const floorMesh = new THREE.Mesh(floorGeo, floorMat);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.z = -(compEstrada / 2) + 20;
scene.add(floorMesh);

// --- TEXTURA DE PARALELEPÍPEDO (CALÇADA) ---
// Criamos uma textura de tijolos proceduralmente com Canvas HTML
const canvasCalcada = document.createElement('canvas');
canvasCalcada.width = 228;
canvasCalcada.height = 228;
const ctx = canvasCalcada.getContext('2d');

// Fundo da calçada (cinzento base)
ctx.fillStyle = '#9ca3af';
ctx.fillRect(0, 0, 228, 228);

// Linhas das pedras (cinzento escuro)
ctx.strokeStyle = '#6b7280';
ctx.lineWidth = 4;
for (let y = 0; y < 228; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(228, y); ctx.stroke();
    const offset = (y % 64 === 0) ? 0 : 32;
    for (let x = offset; x < 228; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 32); ctx.stroke();
    }
}

// Transformamos o desenho numa textura Three.js repetível
const texturaCalcada = new THREE.CanvasTexture(canvasCalcada);
texturaCalcada.wrapS = THREE.RepeatWrapping;
texturaCalcada.wrapT = THREE.RepeatWrapping;
texturaCalcada.repeat.set(1, compEstrada / 2);

const calcadaMat = new THREE.MeshStandardMaterial({ map: texturaCalcada, roughness: 1 });

// Calçada Esquerda (A rua tem 12 de largura, logo a berma fica nos 8)
const calcadaEsq = new THREE.Mesh(new THREE.PlaneGeometry(4, compEstrada), calcadaMat);
calcadaEsq.rotation.x = -Math.PI / 2;
calcadaEsq.position.set(-8, 0.10, -(compEstrada / 2) + 20);
scene.add(calcadaEsq);

// Calçada Direita
const calcadaDir = new THREE.Mesh(new THREE.PlaneGeometry(4, compEstrada), calcadaMat);
calcadaDir.rotation.x = -Math.PI / 2;
calcadaDir.position.set(8, 0.10, -(compEstrada / 2) + 20);
scene.add(calcadaDir);

// Cor da rua
const pathColors = { grass: 0xd2b48c, water: 0xeeeeee, dirt: 0x3e2723, city: 0x111111, poison: 0x1a1a1a, ghost: 0x222222, lava: 0x0a0a0a };
const corDaRua = pathColors[biome] || 0xd2b48c;
const streetMat = new THREE.MeshStandardMaterial({ color: corDaRua, roughness: 0.9 });

// Rua Principal Central
const mainRoadGeo = new THREE.PlaneGeometry(12, compEstrada);
const mainRoad = new THREE.Mesh(mainRoadGeo, streetMat);
mainRoad.rotation.x = -Math.PI / 2;
mainRoad.position.set(0, 0.1, -(compEstrada / 2) + 20);
scene.add(mainRoad);

// --- FAIXA BRANCA CENTRAL NA RUA ---
// Cria várias pequenas faixas brancas ao longo da rua para formar a linha tracejada
const faixaGeo = new THREE.PlaneGeometry(0.8, 4);
const faixaMat = new THREE.MeshBasicMaterial({ color: (biome == 'water') ? 0x0a0a0a : 0xffffff });

const espacamentoFaixas = 16;
const totalFaixas = Math.floor(compEstrada / espacamentoFaixas);

for (let j = 0; j < totalFaixas; j++) {
    const faixa = new THREE.Mesh(faixaGeo, faixaMat);
    faixa.rotation.x = -Math.PI / 2;
    // Posiciona no centro exato da rua (x = 0), ligeiramente acima dela (y = 0.12) para não piscar
    faixa.position.set(0, 0.12, 10 - (j * espacamentoFaixas));
    scene.add(faixa);
}

// Ramificações ligando a rua principal às portas das casas
for (let i = 1; i < maxFloors; i++) {
    const zPos = -(i * espacamento);
    const xPos = (i % 2 === 0 ? 18 : -18); // Casas um pouco mais coladas à rua

    const branchGeo = new THREE.PlaneGeometry(18, 8);
    const branch = new THREE.Mesh(branchGeo, streetMat);
    branch.rotation.x = -Math.PI / 2;
    branch.position.set(xPos / 2, 0.11, zPos);
    scene.add(branch);
}

// 3. VARIÁVEIS DE JOGO
// --- CONFIGURAÇÃO DO LOADER PARA KARTS COMPRIMIDOS ---
const gltfLoader = new THREE.GLTFLoader();
if (typeof THREE.DRACOLoader !== 'undefined') {
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(dracoLoader);
}

let playerKart = null;
let casasNoMapa = [];
let transicaoEmAndamento = false;

// Controlos
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
let kartSpeed = 0;
const maxSpeed = 0.4;       // Reduzido de 0.8 para 0.4
const acceleration = 0.02;  // Reduzido de 0.02 para 0.01
const turnSpeed = 0.05;     // Mantém a curva igual ou ajuste se preferir

window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

// 4. CARREGAR MODELOS
function carregarMundo() {
    // A. Carregar o Kart do Jogador
    // A. Carregar o Kart do Jogador (Dinâmico)
    gltfLoader.load(
        `models/${kartId}.glb`,
        (gltf) => {
            // 1. Cria um grupo invisível que vai ser o "verdadeiro" playerKart
            playerKart = new THREE.Group();

            // 2. Pega o modelo 3D visual e roda 180 graus (Math.PI)
            const modeloVisual = gltf.scene;
            modeloVisual.rotation.y = Math.PI;

            // 3. Coloca o modelo visual dentro do grupo
            playerKart.add(modeloVisual);

            // 4. Aplica a escala e posição ao grupo principal
            // Antes estava 1.5. Mude para 2.5 (ou 3.0) para aumentar o tamanho
            playerKart.scale.set(2.5, 2.5, 2.5);

            playerKart.position.set(0, 0, -(espacamento) + 25);
            scene.add(playerKart);

            esconderLoading();
        },
        undefined,
        (err) => {
            console.warn("Ficheiro do kart não encontrado, a carregar bloco genérico.");
            const kartGeo = new THREE.BoxGeometry(2, 2, 4);
            playerKart = new THREE.Mesh(kartGeo, new THREE.MeshStandardMaterial({ color: 0x21c7ff }));
            playerKart.position.set(0, 1, -(andarAtual * 60) + 70);
            scene.add(playerKart);
            esconderLoading();
        }
    );
    // B. Gerar as Casas (Reta Compacta)
    for (let i = 1; i <= maxFloors; i++) {
        const isBoss = (i === maxFloors);
        const zPos = -(i * espacamento);
        const xPos = isBoss ? 0 : (i % 2 === 0 ? 18 : -18);

        // Rotação: Boss olha para frente, casas laterais olham para o meio da rua
        let rotacaoY = 0;
        if (isBoss) {
            rotacaoY = 0; // 180 graus (olha para o jogador)
        } else {
            rotacaoY = Math.PI / 2; // Vira 90º para esquerda ou direita
        }

        const nomeFicheiro = isBoss ? 'ginasio_pewter.glb' : `casa_pewter.glb`;
        let status = 'bloqueado';
        if (i < andarAtual) status = 'concluido';
        else if (i === andarAtual) status = 'ativo';

        let pilarDeLuz = null;
        if (status === 'ativo') {
            const luzGeo = new THREE.CylinderGeometry(2, 2, 40, 16);
            const luzMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
            pilarDeLuz = new THREE.Mesh(luzGeo, luzMat);
            pilarDeLuz.position.set(xPos, 20, zPos);
            scene.add(pilarDeLuz);
        }

        gltfLoader.load(
            `casas_models/${nomeFicheiro}`,
            (gltf) => {
                const modeloCasa = gltf.scene;
                const escala = isBoss ? 14 : 12;
                modeloCasa.scale.set(escala, escala, escala);

                modeloCasa.rotation.y = rotacaoY;
                modeloCasa.position.set(xPos, 0, zPos);

                // modeloCasa.traverse((child) => {
                //     if (child.isMesh) {
                //         child.userData.materialOriginal = child.material;
                //         if (status === 'concluido') 
                //             child.material = new THREE.MeshStandardMaterial({ color: 0x555555, transparent: true, opacity: 0.5 });
                //         else if (status === 'bloqueado') child.material = new THREE.MeshStandardMaterial({ color: 0x555555, wireframe: true });
                //     }
                // });

                if (pilarDeLuz) modeloCasa.pilar = pilarDeLuz;
                scene.add(modeloCasa);
                casasNoMapa.push({ mesh: modeloCasa, floor: i, status: status, isBoss: isBoss });
            },
            undefined,
            (err) => {
                // Fallback do Cubo
                const tamanho = isBoss ? 15 : 8;
                const casaGeo = new THREE.BoxGeometry(tamanho, tamanho, tamanho);
                let cor = status === 'concluido' ? 0x555555 : (status === 'ativo' ? 0x22c55e : 0xef4444);
                const casaMat = new THREE.MeshStandardMaterial({ color: cor, wireframe: status === 'bloqueado', transparent: status === 'concluido', opacity: status === 'concluido' ? 0.4 : 1 });
                const casaMesh = new THREE.Mesh(casaGeo, casaMat);
                casaMesh.position.set(xPos, tamanho / 2, zPos);
                casaMesh.rotation.y = rotacaoY;
                if (pilarDeLuz) casaMesh.pilar = pilarDeLuz;
                scene.add(casaMesh);
                casasNoMapa.push({ mesh: casaMesh, floor: i, status: status, isBoss: isBoss });
            }
        );
    }
}

let arvoreModeloGlobal = null;

function carregarCenarioDecorativo() {
    // 1. Carrega a árvore 3D uma única vez
    gltfLoader.load('casas_models/arvore.glb', (gltf) => {
        arvoreModeloGlobal = gltf.scene;

        // 2. Espalha árvores pelas laterais da rua com base no número de andares
        const espacamento = 30;

        for (let i = 0; i <= maxFloors; i++) {
            const zPos = -(i * espacamento) + 15;
            // Se quiser uma floresta mais densa, pode adicionar mais uma fileira mais afastada:
            criarArvoreInstanciada(-8, zPos); //esquerda
            criarArvoreInstanciada(8, zPos); //direita
        }
    },
        undefined,
        (err) => {
            console.warn("Modelo models/arvore.glb não encontrado. O cenário ficará sem árvores decorativas.");
        }
    );
}

function criarArvoreInstanciada(x, z) {
    if (!arvoreModeloGlobal) return;

    // Clona a árvore base (operação extremamente leve para o navegador)
    const arvore = arvoreModeloGlobal.clone();

    // Ajuste a escala conforme o tamanho em que modelou no Blender (ex: 1.5 ou 2)
    arvore.scale.set(4.5, 4.5, 4.5);
    arvore.position.set(x, 0, z);

    // Dá uma rotação aleatória para que cada árvore fique ligeiramente diferente
    arvore.rotation.y = Math.random() * Math.PI * 2;

    scene.add(arvore);
}

function esconderLoading() {
    const loading = document.getElementById('loadingScreen');
    loading.style.opacity = '0';
    setTimeout(() => loading.style.display = 'none', 500);

    // --- INICIA A MÚSICA ASSIM QUE O HUB CARREGA ---
    if (typeof window.globalMusic !== 'undefined') {
        const isMusicEnabled = localStorage.getItem('pkart_music') !== 'false';
        const vol = parseFloat(localStorage.getItem('pkart_music_vol')) || 0.4;
        window.globalMusic.volume = vol;
        if (isMusicEnabled) {
            window.globalMusic.play().catch(() => { });
        }
    }
}

// 5. MOTOR FÍSICO DO HUB (Movimento, Limites e Câmara)
function atualizarKart() {
    if (!playerKart) return;

    const acelera = keys.w || keys.ArrowUp;
    const trava = keys.s || keys.ArrowDown;
    const esq = keys.a || keys.ArrowLeft;
    const dir = keys.d || keys.ArrowRight;

    // Aceleração Básica
    if (acelera) kartSpeed += acceleration;
    else if (trava) kartSpeed -= acceleration;
    else kartSpeed *= 0.95; // Fricção natural

    // Zera a velocidade se ela for insignificante (resolve o problema de virar parado)
    if (Math.abs(kartSpeed) < 0.01) kartSpeed = 0;

    kartSpeed = Math.max(Math.min(kartSpeed, maxSpeed), -maxSpeed / 2);

    // Rotação (só vira se o kart estiver realmente a andar)
    if (kartSpeed !== 0) {
        // Se estiver de ré, inverte o lado da curva para ficar natural
        const turn = (kartSpeed > 0 ? 1 : -1) * turnSpeed;
        if (esq) playerKart.rotation.y += turn;
        if (dir) playerKart.rotation.y -= turn;
    }

    // Movimento
    playerKart.position.x -= Math.sin(playerKart.rotation.y) * kartSpeed;
    playerKart.position.z -= Math.cos(playerKart.rotation.y) * kartSpeed;

    // --- LIMITES DO MAPA (PAREDES INVISÍVEIS) ---
    const limiteX = 35; // Mais estreito, impede que vá muito longe na relva
    const limiteZMax = 25;
    const limiteZMin = -(maxFloors * espacamento) - 25; // Limite logo após o Ginásio

    if (playerKart.position.x > limiteX) playerKart.position.x = limiteX;
    if (playerKart.position.x < -limiteX) playerKart.position.x = -limiteX;
    if (playerKart.position.z > limiteZMax) playerKart.position.z = limiteZMax;
    if (playerKart.position.z < limiteZMin) playerKart.position.z = limiteZMin;

    // --- CÂMARA SUAVE (LERP) ---
    // Aproximamos a câmara: de (0, 6, 15) para (0, 3, 7)
    const idealCameraPos = new THREE.Vector3(0, 3, 7);
    idealCameraPos.applyQuaternion(playerKart.quaternion);
    idealCameraPos.add(playerKart.position);

    camera.position.lerp(idealCameraPos, 0.1);

    const lookAtTarget = new THREE.Vector3().copy(playerKart.position);
    // Reduzimos também a altura para onde a câmara olha, para ficar focada no piloto
    lookAtTarget.y += 1;
    camera.lookAt(lookAtTarget);
}

// 6. VERIFICAR COLISÃO E ENTRAR NA CORRIDA
function verificarColisoes() {
    if (transicaoEmAndamento || !playerKart) return;

    casasNoMapa.forEach(casa => {
        if (casa.status === 'ativo') {
            const distancia = playerKart.position.distanceTo(casa.mesh.position);
            const raioDeColisao = casa.isBoss ? 15 : 10;

            if (distancia < raioDeColisao) {
                transicaoEmAndamento = true;
                entrarNaCorrida(casa.floor);
            }
        }
    });
}

function getStyledNickname(nickname, equippedTitleId) {
    if (!equippedTitleId) return nickname;

    if (typeof storeItemsCache !== 'undefined' && storeItemsCache.titles) {
        const item = storeItemsCache.titles.find(t => t.id === equippedTitleId);
        if (item && item.metadata && item.metadata.nickname_style) {
            // Adicionamos display: inline-block por segurança para o gradiente funcionar no texto
            return `<span style="${item.metadata.nickname_style}; display: inline-block;">${nickname}</span>`;
        }
    }

    return nickname;
}

function getNickname() {
    const headerNickEl = document.getElementById('playerHeaderNick');
    if (headerNickEl && currentUserProfile) {
        const styledHtml = getStyledNickname(currentUserProfile.nickname || 'Piloto', currentUserProfile.equipped_title);
        headerNickEl.innerHTML = styledHtml;

        const nickText = currentUserProfile.nickname || 'JOGADOR';
        const finalNick = nickText.trim().toUpperCase();
        sessionStorage.setItem('pkart_nickname', finalNick);
        return finalNick;
    }

    const fallback = (currentUserProfile && currentUserProfile.nickname) ? currentUserProfile.nickname.toUpperCase() : 'JOGADOR';
    sessionStorage.setItem('pkart_nickname', fallback);
    return fallback;
}

function entrarNaCorrida(floorNumber) {
    // Transição (Fade out simples)
    document.body.style.transition = 'opacity 0.5s';
    document.body.style.opacity = '0';

    setTimeout(() => {
        // Atualiza o andar exato em que o jogador clicou no Hub
        let towerState = JSON.parse(localStorage.getItem('pkart_tower_state') || '{}');
        towerState.floor = floorNumber;
        localStorage.setItem('pkart_tower_state', JSON.stringify(towerState));

        // Redireciona 100% LIMPO! Nenhuma informação na URL.
        window.location.href = 'game.html';
    }, 500);
}



// --- ELEMENTOS DECORATIVOS PROCEDURAIS (SEM GLB) ---
function carregarCenarioProcedural() {
    const espacamento = 35; // O mesmo espaçamento das casas

    for (let i = 0; i <= maxFloors; i++) {
        const zPos = -(i * espacamento) + 10;

        // Espalha 4 elementos de cada lado da rua por andar para dar volume
        criarObjetoProcedural(-24, zPos, biome);
        criarObjetoProcedural(24, zPos, biome);
        criarObjetoProcedural(-32, zPos - 12, biome);
        criarObjetoProcedural(32, zPos - 12, biome);
    }
}

function criarObjetoProcedural(x, z, tipoBioma) {
    let objeto = new THREE.Group();

    if (tipoBioma === 'water') {
        // BOIA SALVA-VIDAS (Torus) NUM POSTE
        const mPoste = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
        const mBoia = new THREE.MeshStandardMaterial({ color: 0xef4444 }); // Vermelha

        // Poste cravado no chão
        const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3), mPoste);
        poste.position.y = 1.5;

        // A Boia redonda de anel
        const boia = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 12, 24), mBoia);
        boia.position.y = 2; // Fica pendurada no alto do poste
        boia.rotation.x = Math.PI / 8; // Levemente inclinada

        objeto.add(poste, boia);

    } else if (tipoBioma === 'ghost' || tipoBioma === 'poison') {
        // LÁPIDE (Base, Corpo e Topo arredondado)
        const mCinza = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 2), mCinza); base.position.y = 0.25;
        const corpo = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 1.2), mCinza); corpo.position.y = 2;
        const topo = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.2, 16), mCinza);
        topo.rotation.x = Math.PI / 2; topo.position.y = 3.5;
        objeto.add(base, corpo, topo);

    } else if (tipoBioma === 'lava') {
        // ROCHA VULCÂNICA (Dodecaedro escuro irregular)
        const mPedra = new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 1 });
        const rocha = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + Math.random(), 0), mPedra);
        rocha.position.y = 1;
        rocha.rotation.set(Math.random(), Math.random(), Math.random());
        objeto.add(rocha);

    } else {
        // // PINHEIROS / GRASS / DIRT / CITY (Estilo da sua imagem 3)
        // const mTronco = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
        // const mFolha = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
        // const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2, 8), mTronco); tronco.position.y = 1;

        // // Empilha 3 cones para fazer as camadas do pinheiro
        // const copa1 = new THREE.Mesh(new THREE.ConeGeometry(3.5, 4, 16), mFolha); copa1.position.y = 3;
        // const copa2 = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3, 16), mFolha); copa2.position.y = 5;
        // const copa3 = new THREE.Mesh(new THREE.ConeGeometry(2, 2.5, 16), mFolha); copa3.position.y = 6.5;

        // objeto.add(tronco, copa1, copa2, copa3);
    }

    // Deslocamento natural: para não ficarem perfeitamente alinhados como robôs
    objeto.position.set(x + (Math.random() * 6 - 3), 0, z + (Math.random() * 6 - 3));
    objeto.rotation.y = Math.random() * Math.PI * 2;

    // Aleatoriedade no tamanho das árvores/pedras
    const scaleRandom = 0.7 + Math.random() * 0.5;
    objeto.scale.set(scaleRandom, scaleRandom, scaleRandom);

    scene.add(objeto);
}

// --- NUVENS PROCEDURAIS ---
function criarNuvens() {
    const nuvemGeo = new THREE.SphereGeometry(2, 8, 8);
    const nuvemMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

    // Espalha 25 nuvens pelo céu do mapa
    for (let i = 0; i < 25; i++) {
        const grupoNuvem = new THREE.Group();
        const numeroDeBolas = 3 + Math.floor(Math.random() * 4); // Cada nuvem tem de 3 a 6 partes

        for (let j = 0; j < numeroDeBolas; j++) {
            const parte = new THREE.Mesh(nuvemGeo, nuvemMat);
            parte.position.set(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 6
            );
            const escala = 1 + Math.random() * 2;
            parte.scale.set(escala, escala, escala);
            grupoNuvem.add(parte);
        }

        // Posiciona a nuvem aleatoriamente no céu
        grupoNuvem.position.set(
            (Math.random() - 0.5) * 150,        // X (Largura)
            35 + Math.random() * 2,            // Y (Altura no céu)
            -(Math.random() * 250) + 30         // Z (Profundidade do mapa)
        );

        grupoNuvem.scale.y = 0.6; // Achata o grupo inteiro para a base ficar lisa
        scene.add(grupoNuvem);
    }
}


// 7. LOOP PRINCIPAL
function animate() {
    requestAnimationFrame(animate);
    atualizarKart();
    verificarColisoes();
    // Faz o pilar de luz do andar ativo pulsar (aumentar e diminuir)
    casasNoMapa.forEach(casa => {
        if (casa.status === 'ativo' && casa.mesh.pilar) {
            casa.mesh.pilar.scale.x = 1 + Math.sin(Date.now() * 0.003) * 0.2;
            casa.mesh.pilar.scale.z = 1 + Math.sin(Date.now() * 0.003) * 0.2;
        }
    });
    renderer.render(scene, camera);
}

// Inicia
carregarMundo();
carregarCenarioDecorativo();
carregarCenarioProcedural();
criarNuvens();
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 8. BOTÃO ABANDONAR TORRE (Voltar ao Lobby)
// Certifique-se de que o botão no seu hub.html tem este ID, ex: <button id="btnAbandonar">
const btnAbandonar = document.getElementById('btnAbandonar');

if (btnAbandonar) {
    btnAbandonar.addEventListener('click', () => {
        // Apenas volta para o lobby. O progresso continua salvo no localStorage!
        window.location.href = 'index.html';
    });
}