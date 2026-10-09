(function () {
    'use strict';
    const buffers = new Map();
    const pending = new Map();
    const lastPlayed = new Map();
    let context = null;

    function keyOf(kart) {
        const dex = Number(kart && kart.dexId);
        if (Number.isInteger(dex) && dex > 0) return String(dex);
        const name = String(kart && kart.id || '').toLowerCase();
        return /^[a-z0-9-]+$/.test(name) ? name : null;
    }

    async function request(url, type) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(url, { signal: controller.signal, cache: 'force-cache' });
            if (!response.ok) throw new Error('Som indisponível');
            return await response[type]();
        } finally { clearTimeout(timeout); }
    }

    function prepare(kart) {
        const key = keyOf(kart);
        if (!context || !key) return Promise.resolve(false);
        if (buffers.has(key)) return Promise.resolve(true);
        if (pending.has(key)) return pending.get(key);
        const loading = (async () => {
            try {
                // Vozes selecionadas pelo projeto têm prioridade sobre os gritos dos jogos.
                const name = String(kart && kart.id || '').toLowerCase();
                const file = /^[a-z0-9-]+$/.test(name) ? name : key;
                try {
                    const bytes = await request(`sounds/horns/${file}.mp3`, 'arrayBuffer');
                    buffers.set(key, await context.decodeAudioData(bytes));
                    return true;
                } catch (_) { /* Sem voz local, mantém a buzina anterior disponível. */ }
                const pokemon = await request(`https://pokeapi.co/api/v2/pokemon/${key}/`, 'json');
                const cries = pokemon.cries || {};
                for (const url of [...new Set([cries.latest, cries.legacy].filter(Boolean))]) {
                    // Apenas os arquivos do catálogo de sons da PokéAPI.
                    if (!url.startsWith('https://raw.githubusercontent.com/PokeAPI/cries/')) continue;
                    try {
                        const bytes = await request(url, 'arrayBuffer');
                        buffers.set(key, await context.decodeAudioData(bytes));
                        return true;
                    } catch (_) { /* Tenta a versão clássica quando necessário. */ }
                }
            } catch (_) { /* A corrida continua mesmo sem conexão ou áudio. */ }
            return false;
        })().finally(() => pending.delete(key));
        pending.set(key, loading);
        return loading;
    }

    function play(kart, { channel = 'local', gain = 1, pan = 0 } = {}) {
        const key = keyOf(kart);
        if (!context || context.state === 'closed' || !key || gain <= 0.001) return false;
        if (!buffers.has(key)) { prepare(kart); return false; }
        const now = performance.now();
        if (now - (lastPlayed.get(channel) ?? -Infinity) < 1500) return false;
        try {
            if (context.state === 'suspended') context.resume().catch(() => {});
            const source = context.createBufferSource();
            const volume = context.createGain();
            source.buffer = buffers.get(key);
            volume.gain.value = Math.min(1, Math.max(0, gain)) * 0.65;
            source.connect(volume);
            let panner = null;
            if (context.createStereoPanner) {
                panner = context.createStereoPanner();
                panner.pan.value = Math.min(1, Math.max(-1, pan));
                volume.connect(panner).connect(context.destination);
            } else volume.connect(context.destination);
            source.onended = () => { source.disconnect(); volume.disconnect(); if (panner) panner.disconnect(); };
            source.start();
            lastPlayed.set(channel, now);
            return true;
        } catch (_) { return false; }
    }

    window.PokeHorns = { init(audioContext) { context = audioContext; }, prepare, play };
})();
