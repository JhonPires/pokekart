(function (root) {
  'use strict';
  const slots = Object.freeze({ motor: 'Motor', transmissao: 'Transmissão', freios: 'Freios', nitro: 'Nitro', pneus: 'Pneus' });
  const caps = Object.freeze({ accel: .15, maxSpeed: .08, brakeDecel: .25, turnSpeed: .10, turboBonus: .20, driftRate: .12, driftControl: .10 });
  function newId() {
    if (root.crypto.randomUUID) return root.crypto.randomUUID();
    const bytes = root.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  function applyParts(base, parts) {
    const result = { ...root.PokeKartBalance.normalize(base), brakeDecel: 30 };
    const totals = {};
    for (const part of parts) for (const [key, value] of Object.entries(part.modifiers || {})) {
      if (Number.isFinite(value) && value > 0) totals[key] = (totals[key] || 0) + value;
    }
    for (const [key, cap] of Object.entries(caps)) result[key] *= 1 + Math.min(cap, totals[key] || 0);
    result.grip = Math.min(.98, result.grip + Math.min(.08, totals.grip_add || 0));
    return result;
  }
  function createService(client, getProfile) {
    let state = { catalog: [], parts: [], coins: 0 };
    async function call(name, args) {
      let request = client.rpc(name, args);
      if (request.abortSignal && typeof AbortSignal !== 'undefined' && AbortSignal.timeout) request = request.abortSignal(AbortSignal.timeout(12000));
      const { data, error } = await request;
      if (error) throw new Error(error.message || 'Não foi possível salvar. Confira sua conexão.');
      if (!data) throw new Error('Resposta da mecânica indisponível. Tente novamente.');
      return data;
    }
    function accept(data) {
      state = data;
      const profile = getProfile();
      if (profile && Number.isFinite(data.coins)) profile.coins = data.coins;
      return state;
    }
    return {
      get state() { return state; },
      load: async () => accept(await call('mechanic_state')),
      buy: async (id, requestId) => accept(await call('mechanic_buy_part', { p_part_id: id, p_purchase_id: requestId })),
      equip: async (id, kartId) => accept(await call('mechanic_equip_part', { p_instance_id: id, p_kart_id: kartId })),
      startRace: (kartId, raceId) => call('mechanic_start_race', { p_kart_id: kartId, p_race_id: raceId }),
      equipped(kartId) {
        return state.parts.filter(p => p.kart_id === kartId && p.remaining > 0).map(p => ({ ...p,
          ...state.catalog.find(c => c.id === p.part_id), instanceId: p.id }));
      }
    };
  }
  let service;
  function raceRequest(kartId, storage, uuid) {
    const key='pkart_mechanic_pending_race';
    let pending;
    try { pending=JSON.parse(storage.getItem(key)); } catch (_) {}
    if (!pending || pending.kartId!==kartId || !/^[0-9a-f-]{36}$/i.test(pending.id || '')) {
      pending={kartId,id:uuid()}; storage.setItem(key,JSON.stringify(pending));
    }
    return {id:pending.id,complete(){
      try {if(JSON.parse(storage.getItem(key))?.id===pending.id)storage.removeItem(key);}catch(_){}
    }};
  }
  function getService() {
    if (!service) service = createService(supabaseClient, () => currentUserProfile);
    return service;
  }
  root.PokeKartMechanic = { slots, caps, applyParts, createService, getService, raceRequest, newId };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PokeKartMechanic;
})(typeof window !== 'undefined' ? window : globalThis);
