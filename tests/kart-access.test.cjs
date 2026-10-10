const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
const functions = source.slice(source.indexOf('async function fetchPlayerProfile()'), source.indexOf('// Adicionar Moedas'));
let now = '2026-10-09T23:59:59Z';
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
}
const catalog = Array.from({ length: 18 }, (_, i) => ({ id: `kart${i}`, activated: true }));
catalog.push({ id: 'disabled', activated: false });
let saved;
let catalogError = null;
const writes = [];
const storage = new Map();
const context = vm.createContext({
  Date: Clock, console, window: { location: { pathname: '/game.html', replace() {} } },
  document: { getElementById: () => null },
  sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
  currentUserProfile: null,
  supabaseClient: {
    auth: { getSession: async () => ({ data: { session: {} } }), getUser: async () => ({ data: { user: { id: 'player' } } }) },
    from(table) {
      return {
        select() {
          if (table === 'karts') return Promise.resolve({ data: catalogError ? null : catalog, error: catalogError });
          return { eq: () => ({ single: async () => ({ data: structuredClone(saved) }) }) };
        },
        update(patch) { return { eq: async () => { writes.push(patch); Object.assign(saved, patch); return {}; } }; }
      };
    }
  }
});
vm.runInContext(functions, context);
const daily = () => Array.from(context.getDailyFreeKartIds(catalog));
const profile = selected => ({ id: 'player', starter_choice_completed: true, starter_kart_id: 'owned', unlocked_karts: ['owned'], selected_kart: selected });

(async () => {
  const yesterday = daily();
  now = '2026-10-10T00:00:00Z';
  const today = daily();
  const expired = yesterday.find(id => !today.includes(id));
  assert(expired, 'Fixture must include a rental that expires at UTC midnight');
  assert(!today.includes('disabled'));
  assert.deepEqual(Array.from(context.getDailyFreeKartIds([...catalog].reverse())), today, 'Catalog order must not change the rotation');

  saved = profile(expired);
  storage.set('pkart_selected_kart', expired);
  storage.set('pkart_daily_free', JSON.stringify(yesterday));
  const repaired = await context.fetchPlayerProfile();
  assert.equal(repaired.selected_kart, 'owned', 'Race profile load must reject an expired rental');
  assert.equal(storage.get('pkart_selected_kart'), 'owned');
  assert.equal(saved.selected_kart, 'owned', 'Fallback must be saved, not just applied to the preview');
  assert.deepEqual(JSON.parse(storage.get('pkart_daily_free')), today);
  const writeCount = writes.length;
  assert.equal((await context.fetchPlayerProfile()).selected_kart, 'owned', 'Garage reload must not restore the expired rental');
  assert.equal(writes.length, writeCount, 'Do not repeat an already persisted repair');

  saved = profile(today[0]);
  assert.equal((await context.fetchPlayerProfile()).selected_kart, today[0], 'Current rental remains usable');
  saved = profile(expired);
  saved.unlocked_karts = JSON.stringify(['owned', expired]);
  assert.equal((await context.fetchPlayerProfile()).selected_kart, expired, 'A purchased kart must survive its rotation expiry');

  now = '2026-10-09T23:59:59Z';
  saved = profile(expired);
  await context.fetchPlayerProfile();
  now = '2026-10-10T00:00:00Z';
  assert.equal(await context.validateEquippedKart(context.currentUserProfile, catalog), 'owned', 'An open garage must repair selection when the day changes');
  storage.set('pkart_daily_free', JSON.stringify(yesterday));
  assert.equal(await context.updateSelectedKart(expired), false, 'A stale cache must not authorize equipping an expired rental');
  assert.equal(saved.selected_kart, 'owned');
  assert.equal(await context.updateSelectedKart(today[0]), true);
  assert.equal(saved.selected_kart, today[0]);
  assert.equal(storage.get('pkart_selected_kart'), today[0]);

  saved = profile(expired);
  catalogError = { message: 'offline' };
  const beforeFailure = writes.length;
  assert.equal(await context.fetchPlayerProfile(), null, 'Do not start a race with an unverified rental when the catalog fails');
  assert.equal(writes.length, beforeFailure, 'Catalog failures must not permanently erase a valid rental');
  saved = profile('owned');
  assert.equal((await context.fetchPlayerProfile()).selected_kart, 'owned', 'Owned karts do not depend on the daily catalog request');
  console.log('Kart access: expiry, persistence, ownership, UTC rollover and stale cache checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
