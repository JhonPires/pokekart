/* Daily roulette: one entry per reward, weighted draws and confirmed delivery. */
(() => {
  const items = {
    rare_candy: { name: 'Doce Raro', icon: 'doce-raro', detail: 'Use para ganhar XP' },
    amulet_coin: { name: 'Moeda Amuleto', icon: 'moeda', detail: 'Dobra moedas na próxima corrida' },
    lucky_egg: { name: 'Ovo da Sorte', icon: 'ovo-sorte', detail: 'Dobra XP na próxima corrida' },
    revive: { name: 'Revive', icon: 'revive', detail: 'Uma nova chance na torre' }
  };
  const defaults = [
    { type: 'coins', amount: 100, weight: 1 },
    { type: 'consumable', item_id: 'rare_candy', quantity: 1, weight: 1 },
    { type: 'consumable', item_id: 'amulet_coin', quantity: 1, weight: 1 },
    { type: 'coins', amount: 300, weight: 1 },
    { type: 'consumable', item_id: 'lucky_egg', quantity: 1, weight: 1 },
    { type: 'consumable', item_id: 'revive', quantity: 1, weight: 1 }
  ];
  const iconURL = name => `icones/tematicos/${name}.png`;
  const colors = ['#725023', '#355875', '#386350', '#735232', '#504778', '#713e58'];
  const date = () => { const d = new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`; };
  const sameDay = (a, b) => !!a && String(a).split('-').map(Number).join('-') === String(b).split('-').map(Number).join('-');
  function normalize(config) {
    if (typeof config === 'string') { try { config = JSON.parse(config); } catch { config = null; } }
    // Replace only the original six-coin preset; custom admin tables retain their values.
    const legacy = Array.isArray(config) && config.length === 6 &&
      config.every(p => p?.type === 'coins') &&
      config.map(p => Number(p.amount)).sort((a, b) => a - b).join(',') === '10,50,100,200,300,500';
    const source = !Array.isArray(config) || legacy ? defaults : config;
    const rewards = new Map();
    for (const p of source) {
      if (!p || typeof p !== 'object') continue;
      const weight = Number(p.weight ?? p.peso ?? 1);
      if (!Number.isFinite(weight) || weight <= 0) continue;
      let reward;
      if (p.type === 'coins') {
        const amount = Number(p.amount);
        if (!Number.isSafeInteger(amount) || amount <= 0) continue;
        reward = { type: 'coins', amount, label: `${amount.toLocaleString('pt-BR')} moedas`, icon: 'moeda', detail: 'Saldo para usar na loja', short: String(amount), key: `coins:${amount}` };
      } else if (p.type === 'consumable' || p.type === 'item') {
        const itemId = p.item_id || (typeof p.amount === 'string' ? p.amount : null);
        const item = items[itemId];
        const quantity = Number(p.quantity ?? (typeof p.amount === 'number' ? p.amount : 1));
        if (!item || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
        reward = { type: 'consumable', item_id: itemId, quantity, label: `${quantity}× ${item.name}`, icon: item.icon, detail: item.detail, short: `${quantity}×`, key: `${itemId}:${quantity}` };
      } else continue;
      if (rewards.has(reward.key)) rewards.get(reward.key).weight += weight;
      else rewards.set(reward.key, { ...reward, weight });
    }
    if (!rewards.size || !Number.isFinite([...rewards.values()].reduce((n, p) => n + p.weight, 0))) return normalize(defaults);
    return [...rewards.values()];
  }
  function draw(rewards, random = Math.random()) {
    const total = rewards.reduce((sum, p) => sum + p.weight, 0);
    let cursor = Math.min(Math.max(random, 0), 1 - Number.EPSILON) * total;
    for (let i = 0; i < rewards.length; i++) { cursor -= rewards[i].weight; if (cursor < 0) return i; }
    return rewards.length - 1;
  }
  function delivery(profile, prize, today) {
    const update = { last_spin_date: today };
    if (prize.type === 'coins') update.coins = (Number(profile.coins) || 0) + prize.amount;
    else {
      let inventory = profile.inventory;
      if (typeof inventory === 'string') { try { inventory = JSON.parse(inventory); } catch { inventory = {}; } }
      if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) inventory = {};
      update.inventory = { ...inventory, [prize.item_id]: (Number(inventory[prize.item_id]) || 0) + prize.quantity };
    }
    return update;
  }
  function mount(options) {
    const modal = document.getElementById('rouletteModalOverlay');
    const wheel = document.getElementById('rouletteWheel');
    const button = document.getElementById('btnSpinRoulette');
    const close = document.getElementById('btnCloseRoulette');
    const status = document.getElementById('rouletteStatus');
    const result = document.getElementById('rouletteResult');
    const resultIcon = document.getElementById('rouletteResultIcon');
    const resultTitle = document.getElementById('rouletteResultTitle');
    const list = document.getElementById('roulettePrizes');
    let rewards = normalize(), configuration, spinning = false, pending = null, rotation = 0, opener;
    function message(state, title, text, icon = 'estrela') {
      result.dataset.state = state; resultTitle.textContent = title; status.textContent = text; resultIcon.src = iconURL(icon);
    }
    function render() {
      if (spinning || pending) return;
      rewards = normalize(configuration);
      wheel.replaceChildren(); list.replaceChildren();
      const angle = 360 / rewards.length, total = rewards.reduce((n, p) => n + p.weight, 0), stops = [];
      rewards.forEach((prize, i) => {
        const start = i * angle, end = start + angle;
        stops.push(`${colors[i % colors.length]} ${start}deg ${end - .7}deg`, `#ffe79888 ${end - .7}deg ${end}deg`);
        const radians = (start + angle / 2) * Math.PI / 180;
        const sector = document.createElement('div'); sector.className = 'roulette-sector';
        sector.style.left = `${50 + Math.sin(radians) * 32}%`; sector.style.top = `${50 - Math.cos(radians) * 32}%`;
        const img = document.createElement('img'); img.src = iconURL(prize.icon); img.alt = '';
        const amount = document.createElement('span'); amount.textContent = prize.short;
        sector.append(img, amount); wheel.append(sector);
        const card = document.createElement('li'); card.className = 'roulette-prize-card'; card.dataset.index = i; card.title = prize.detail;
        const copy = document.createElement('div'); copy.className = 'roulette-prize-copy';
        const name = document.createElement('strong'); name.textContent = prize.label;
        const detail = document.createElement('small'); detail.textContent = prize.detail; copy.append(name, detail);
        const chance = document.createElement('span'); chance.className = 'roulette-chance';
        chance.textContent = `${(prize.weight / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
        card.append(img.cloneNode(), copy, chance); list.append(card);
      });
      wheel.style.background = `conic-gradient(${stops.join(',')})`;
    }
    function check() {
      if (spinning) return;
      if (pending) { button.disabled = false; button.textContent = 'RESGATAR PRÊMIO'; return; }
      const profile = options.getProfile(), claimed = profile && sameDay(profile.last_spin_date, date());
      button.disabled = !!claimed; button.textContent = claimed ? 'VOLTE AMANHÃ' : 'GIRAR AGORA';
      if (claimed) message('claimed', 'Giro usado', 'Seu próximo giro gratuito estará disponível amanhã (UTC).');
      else message('ready', 'Um giro gratuito por dia', profile ? 'Gire e descubra sua recompensa!' : 'Entre na sua conta para girar e receber a recompensa.');
    }
    function dismiss() {
      if (spinning) return;
      modal.style.display = 'none'; opener?.focus();
    }
    document.getElementById('menuBtnRoulette').onclick = event => {
      opener = event.currentTarget; render(); check(); modal.style.display = 'flex'; close.focus();
    };
    close.onclick = dismiss;
    modal.addEventListener('click', event => { if (event.target === modal) dismiss(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
      if (event.key === 'Tab') {
        const focusable = [...modal.querySelectorAll('button:not(:disabled)')];
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    async function claim() {
      const { profile, prize, today, index, previousDate } = pending;
      try {
        if (options.getProfile()?.id !== profile.id) throw new Error('Entre novamente na conta que iniciou este giro.');
        const update = delivery(profile, prize, today);
        await options.persist({ ...profile, last_spin_date: previousDate }, update);
        Object.assign(profile, update);
        try { localStorage.setItem('pkart_last_spin', today); } catch { /* The server already confirmed delivery. */ }
        pending = null;
        message('won', 'Recompensa recebida', `Você ganhou ${prize.label}! ${prize.type === 'coins' ? 'As moedas já estão no seu saldo.' : 'O item já está na sua mochila.'}`, prize.icon);
        list.children[index]?.classList.add('is-winner');
        button.textContent = 'VOLTE AMANHÃ'; button.disabled = true;
        try { options.onUpdate?.(); } catch (error) { console.warn('Atualização da interface da roleta:', error); }
      } catch (error) {
        message('error', 'Prêmio reservado', `Não foi possível confirmar a entrega. ${error.message || 'Tente novamente.'}`, prize.icon);
        button.textContent = 'RESGATAR PRÊMIO'; button.disabled = false;
      } finally { spinning = false; close.setAttribute('aria-disabled', 'false'); modal.setAttribute('aria-busy', 'false'); }
    }
    button.onclick = async () => {
      if (spinning) return;
      const profile = options.getProfile();
      if (!profile) { message('ready', 'Entre para jogar', 'Faça login pelo menu do lobby e volte para seu giro gratuito.'); return; }
      if (!pending && sameDay(profile.last_spin_date, date())) { check(); return; }
      spinning = true; button.disabled = true; close.setAttribute('aria-disabled', 'true'); modal.setAttribute('aria-busy', 'true');
      if (pending) { button.textContent = 'RESGATANDO...'; await claim(); return; }
      const index = draw(rewards), prize = rewards[index], angle = 360 / rewards.length;
      pending = { profile, prize, index, today: date(), previousDate: profile.last_spin_date };
      list.querySelectorAll('.is-winner').forEach(el => el.classList.remove('is-winner'));
      button.textContent = 'GIRANDO...'; message('spinning', 'Boa sorte, piloto!', 'Seu prêmio está a caminho.');
      const target = (360 - (index + .5) * angle) % 360;
      const delta = (target - rotation % 360 + 360) % 360;
      rotation += 5 * 360 + delta; wheel.style.transform = `rotate(${rotation}deg)`;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      await new Promise(resolve => setTimeout(resolve, reduced ? 200 : 4100));
      button.textContent = 'RESGATANDO...'; await claim();
    };
    render();
    return { setPrizes(config) { configuration = config; render(); }, render, check };
  }
  function toConfig(config) {
    return normalize(config).map(p => p.type === 'coins'
      ? { label: p.label, type: p.type, amount: p.amount, weight: p.weight }
      : { label: p.label, type: p.type, item_id: p.item_id, quantity: p.quantity, weight: p.weight });
  }
  window.PokeRoulette = { normalize, toConfig, draw, delivery, mount, date, sameDay };
})();
