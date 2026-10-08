// Shared presentation for static UI, database catalogs and dynamically created race panels.
(() => {
  'use strict';
  const ownScript = document.currentScript;
  const asset = path => new URL(path, ownScript.src).href;
  const themed = name => asset(`icones/tematicos/${name}.png`);
  const existing = name => asset(`icones/${name}.png`);
  const badge = name => asset(`img/insig_${name}.png`);
  const sticker = name => asset(`emojis/${name}.png`);
  const entries = [
    ['⚙', 'configuracoes', 'Configurações'], ['🎯', 'alvo', 'Objetivo'],
    ['🏅', 'medalha', 'Medalha'], ['🥇', 'medalha', 'Primeiro lugar'],
    ['🎒', 'mochila', 'Inventário'], ['🪙', 'moeda', 'Moedas'],
    ['⭐', 'estrela', 'Estrela'], ['🌟', 'estrela', 'Destaque'], ['✨', 'estrela', 'Destaque'],
    ['🎮', 'controle', 'Controles'], ['🏠', 'lobby', 'Lobby'],
    ['💰', 'bolsa-moedas', 'Recompensa em moedas'], ['🌍', 'mundo', 'Região'],
    ['🌐', 'mundo', 'Salas online'], ['🗺', 'mundo', 'Mapa'],
    ['💨', 'vento', 'Rastro'], ['🔥', 'fogo', 'Fogo'], ['💧', 'agua', 'Água'],
    ['🌊', 'agua', 'Surf'], ['🛣', 'rota', 'Traçado da pista'],
    ['🔄', 'atualizar', 'Atualizar'], ['↺', 'atualizar', 'Reposicionar kart'], ['🔍', 'buscar', 'Buscar'],
    ['🏁', 'bandeira', 'Corrida'], ['🧹', 'limpar', 'Limpar'], ['🗑', 'limpar', 'Excluir'],
    ['💾', 'salvar', 'Salvar'], ['🛡', 'escudo', 'Proteção'],
    ['🎨', 'pintura', 'Criador de pistas'], ['✏', 'pintura', 'Editar'],
    ['📍', 'ponto', 'Ponto da pista'], ['🔗', 'circuito', 'Circuito'],
    ['🚀', 'turbo', 'Turbo'], ['🎟', 'passe', 'Passe de batalha'],
    ['🏷', 'passe', 'Título'], ['🪪', 'passe', 'Título'],
    ['⚠', 'alerta', 'Atenção'], ['🏎', 'kart', 'Kart'], ['🚪', 'porta', 'Entrada'],
    ['🛠', 'ferramentas', 'Ferramentas'], ['⌛', 'tempo', 'Tempo'], ['⏳', 'tempo', 'Tempo'],
    ['🤖', 'bot', 'Bots'], ['👤', 'perfil', 'Perfil do piloto'],
    ['📱', 'celular', 'Direção por giroscópio'], ['🧢', 'perfil', 'Treinador'],
    ['🔒', 'bloqueio', 'Bloqueado'], ['📅', 'calendario', 'Login diário'],
    ['💬', 'conversa', 'Reações'], ['💊', 'revive', 'Revive'],
    ['🥚', 'ovo-sorte', 'Ovo da Sorte'], ['🏙', 'cidade', 'Cidade'],
    ['⛏', 'cavar', 'Cavar'], ['🟣', 'lodo', 'Lodo'], ['💩', 'lama', 'Lama'],
    ['🍬', 'doce-raro', 'Doce Raro']
  ];
  const icons = new Map(entries.map(([token, name, label]) => [token, { src: themed(name), label }]));
  const add = (tokens, src, label) => tokens.forEach(token => icons.set(token, { src, label }));
  add(['🎁', '📦'], existing('recompensa'), 'Recompensa');
  add(['🏆', '👑'], existing('liga'), 'Liga');
  add(['🎡'], existing('roleta'), 'Roleta diária');
  add(['📜'], existing('notas'), 'Notas e missões');
  add(['🛒', '🛍'], existing('loja'), 'Loja e garagem');
  add(['🎵', '🎶', '🔊'], existing('music'), 'Música e som');
  add(['🥈', '🥉', '💎'], themed('medalha'), 'Medalha');
  add(['🖼'], themed('escudo'), 'Borda');
  add(['✋'], themed('mover-mapa'), 'Mover mapa');
  add(['📸'], themed('buscar'), 'Visualizar');
  add(['🌿', '🍃'], badge('celadon'), 'Planta');
  add(['❄', '🧊'], badge('mahogany'), 'Gelo');
  add(['⚡'], themed('turbo'), 'Velocidade');
  add(['🪨'], badge('pewter'), 'Pedra');
  add(['☣', '☠'], themed('lodo'), 'Veneno');
  add(['🔮', '🌀'], badge('saffron'), 'Psíquico');
  add(['👻', '🌙'], sticker('gengar'), 'Fantasma');
  add(['🐉'], sticker('dragonite'), 'Dragão');
  add(['🥊'], badge('cianwood'), 'Lutador');
  add(['🐛'], badge('azalea'), 'Inseto');
  add(['🪽'], badge('violet'), 'Voador');
  add(['⚖'], badge('petalburg'), 'Normal');
  add(['💣'], themed('alerta'), 'Armadilha Rocket');
  add(['❌'], themed('alerta'), 'Derrota');

  const pattern = new RegExp(`(${[...icons.keys()].join('|')})[\\uFE0E\\uFE0F]*`, 'gu');
  const excluded = 'script,style,textarea,input,select,option,svg,canvas,pre,code,[contenteditable],.pk-icon,[data-poke-icons="off"],#ppNickname,#profileNameDisplay,#sideNickname';
  function makeIcon(token, info) {
    const span = document.createElement('span');
    span.className = 'pk-icon';
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', info.label);
    const image = document.createElement('img');
    image.src = info.src;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    const source = document.createElement('span');
    source.className = 'pk-icon-source';
    source.setAttribute('aria-hidden', 'true');
    source.textContent = token;
    image.addEventListener('error', () => {
      // Preserve the recognizable original symbol if an asset is unavailable.
      image.remove(); source.className = ''; source.removeAttribute('aria-hidden');
    }, { once: true });
    span.append(image, source);
    return span;
  }
  function convert(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const text = node.data;
    pattern.lastIndex = 0;
    if (!pattern.test(text)) return;
    pattern.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      fragment.append(document.createTextNode(text.slice(cursor, match.index)));
      let info = icons.get(match[1]);
      if (match[1] === '⚡' && (node.parentElement.closest('[data-value="electric"]') || /Elétric|Surge/i.test(node.parentElement.textContent))) {
        info = { src: badge('vermilion'), label: 'Elétrico' };
      }
      fragment.append(makeIcon(match[0], info));
      cursor = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
  function refresh(root) {
    if (root.nodeType === Node.TEXT_NODE) return convert(root);
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(convert);
  }
  window.PokeIcons = { refresh };
  function start() {
    refresh(document.body);
    const observer = new MutationObserver(records => {
      // Only inspect added/changed content. No full-document scan in the race loop.
      for (const record of records) {
        if (record.type === 'characterData') convert(record.target);
        else record.addedNodes.forEach(refresh);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
