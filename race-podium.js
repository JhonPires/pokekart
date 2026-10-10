(function () {
  'use strict';
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function sprite(racer) {
    const img = element('img', 'podium-pokemon');
    const dex = Number(racer.dexId);
    img.src = `pokemons/poke_${Number.isInteger(dex) && dex > 0 ? dex : 25}.gif`;
    img.alt = 'Pokémon de ' + racer.name;
    img.onerror = () => { img.onerror = null; img.src = 'pokemons/poke_25.gif'; };
    return img;
  }
  function mount(container) {
    container.classList.add('finish-results');
    const celebration = element('section', 'podium-celebration');
    celebration.setAttribute('aria-label', 'Pódio da corrida');
    const status = element('div', 'podium-status');
    const stage = element('div', 'podium-stage');
    celebration.append(status, stage);
    const classification = element('section', 'podium-classification');
    classification.setAttribute('aria-label', 'Classificação completa');
    classification.append(element('h3', 'podium-list-title', 'CLASSIFICAÇÃO'));
    const list = element('ol', 'podium-list');
    classification.append(list);
    container.replaceChildren(celebration, classification);
    return { stage, status, list };
  }
  function update(container, racers, formatTime) {
    const view = container.__podiumView || (container.__podiumView = mount(container));
    const finished = racers.every(r => r.tr.finished);
    view.status.textContent = finished ? 'RESULTADO FINAL' : 'AGUARDANDO CHEGADAS';
    const leaders = racers.slice(0, 3);
    view.stage.dataset.count = leaders.length;
    // Atualiza apenas quando um lugar muda: os GIFs continuam animando entre os frames.
    const podiumSig = leaders.map(r => r.tr.finished ? `${r.key}|${r.name}|${r.dexId}|${r.tr.finishTime}` : 'pending').join(';');
    if (view.stage.__sig !== podiumSig) {
      view.stage.__sig = podiumSig;
      const slots = leaders.map((racer, index) => {
        const place = index + 1;
        const slot = element('div', `podium-slot podium-place-${place}${racer.tr.finished ? '' : ' is-pending'}${racer.key === 'local' && racer.tr.finished ? ' is-local' : ''}`);
        slot.style.order = leaders.length === 1 ? 0 : [1, 0, 2][index];
        slot.setAttribute('aria-label', `${place}º lugar: ${racer.tr.finished ? racer.name : 'aguardando chegada'}`);
        const avatar = element('div', 'podium-avatar');
        if (racer.tr.finished) {
          if (place === 1) avatar.append(element('span', 'podium-crown', '★'));
          avatar.append(sprite(racer));
        } else avatar.append(element('span', 'podium-waiting', '· · ·'));
        const name = element('strong', 'podium-name', racer.tr.finished ? racer.name : 'Aguardando');
        name.title = racer.tr.finished ? racer.name : 'Aguardando chegada';
        const detail = element('span', 'podium-detail', racer.tr.finished ? (racer.key === 'local' ? 'VOCÊ' : 'FINALIZOU') : 'NA PISTA');
        const step = element('div', 'podium-step');
        step.append(element('b', 'podium-place', `${place}º`));
        slot.append(avatar, name, detail, step);
        return slot;
      });
      view.stage.replaceChildren(...slots);
    }
    const listSig = racers.map(r => `${r.key}|${r.name}|${r.dexId}|${r.tr.finished}|${r.tr.finishTime}`).join(';');
    if (view.list.__sig === listSig) return;
    view.list.__sig = listSig;
    view.list.replaceChildren(...racers.map((racer, index) => {
      const row = element('li', 'podium-row' + (racer.key === 'local' ? ' is-local' : ''));
      row.append(element('b', 'podium-row-place', `${index + 1}º`), sprite(racer));
      const identity = element('div', 'podium-identity');
      const name = element('strong', '', racer.name);
      name.title = racer.name;
      identity.append(name, element('small', '', racer.key === 'local' ? 'VOCÊ' : 'PILOTO'));
      const time = element('span', 'podium-time', racer.tr.finished ? formatTime(racer.tr.finishTime) : 'Na pista');
      row.append(identity, time);
      return row;
    }));
  }
  window.PokeRacePodium = { update };
})();
