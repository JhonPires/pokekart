// Executar com Node. Apenas gera arquivos locais; não acessa nem altera o banco.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const balance = require('../../kart-balance.js');
const initial = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalogo-antes-20261009.json'), 'utf8').replace(/^\uFEFF/, ''));
const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalogo-revalidado-20261009.json'), 'utf8').replace(/^\uFEFF/, ''));
// Preserva os preços revisados pelo usuário após o backup inicial.
const recentPrices = new Set(before.filter(k => initial.find(old => old.id === k.id)?.price !== k.price).map(k => k.id));
const groups = {
  velocidade: `aerodactyl arcanine charizard dodrio dragonite electrode entei garchomp groudon gyarados hooh hydreigon kyogre latios lugia moltres pidgeot raikou rayquaza salamence skarmory staraptor swellow tauros tyranitar zapdos zekrom`,
  arrancada: `aipom blaziken cacnea chikorita cyndaquil deoxys dugtrio electabuzz flareon granbull hariyama hitmonchan hitmonlee houndoom infernape jolteon luxray machamp magikarp magmar meowth miltank oshawott persian pikachu pinsir primeape psyduck qwilfish raichu raticate totodile toxicroak ursaring zangoose`,
  curvas: `alakazam altaria azumarill bellossom butterfree celebi clefable dewgong espeon gallade gardevoir girafarig heracross hitmontop hypno latias leafeon ledian mew milotic mrmime ninetales noctowl roselia sandslash sceptile scizor scyther starmie suicune sylveon togetic vaporeon venusaur vileplume wigglytuff`,
  drift: `absol arbok ariados articuno bannete beedrill ceruledge darkrai dusknoir gengar giratina glaceon glalie gliscor golbat jinx kabutops kingdra lunala misdreavus muk murkrow seviper shiftry sneasel tangela tatsugiri tentacruel umbreon victreebel weezing yanma zoroark`,
  equilibrado: `aggron ampharos arceus blastoise blissey cloyster dialga donphan empoleon exeggutor flygon golem lapras lucario magneton marowak metagross mewtwo octillery omastar onix parasect piloswine poliwrath porygon probopass rhydon snorlax sudowoodo swampert torkoal torterra wobbuffet`
};
// Faixas de acesso/coleção, independentes do perfil de pilotagem.
const priceGroups = {
  800: `aipom arbok ariados beedrill butterfree cacnea chikorita clefable cyndaquil golbat ledian magikarp meowth murkrow parasect pidgeot pikachu psyduck qwilfish raticate roselia sandslash tangela totodile wigglytuff yanma`,
  1600: `azumarill bellossom blissey cloyster dewgong dodrio dugtrio electabuzz electrode exeggutor girafarig glalie granbull hitmonchan hitmonlee hitmontop hypno magmar magneton marowak miltank misdreavus mrmime noctowl octillery omastar persian piloswine poliwrath porygon primeape seviper shiftry tauros torkoal victreebel weezing wobbuffet zangoose`,
  2400: `absol aerodactyl aggron altaria ampharos bannete donphan dusknoir flareon gallade gardevoir glaceon golem hariyama heracross houndoom jinx jolteon kabutops kingdra lapras leafeon milotic ninetales pinsir probopass scizor scyther skarmory tentacruel toxicroak ursaring vaporeon`,
  3200: `blastoise blaziken charizard dragonite garchomp gengar gyarados machamp metagross salamence sceptile snorlax tyranitar venusaur`
};
const leaders = new Set('onix starmie raichu vileplume muk alakazam arcanine rhydon'.split(' '));
function indexGroups(groups) {
  const index = new Map();
  for (const [group, ids] of Object.entries(groups)) for (const id of ids.split(/\s+/)) {
    assert(!index.has(id), `ID repetido: ${id}`);
    assert(before.some(k => k.id === id), `ID desconhecido: ${id}`);
    index.set(id, group);
  }
  return index;
}
const styles = indexGroups(groups), prices = indexGroups(priceGroups);
assert.equal(styles.size, before.length, 'Todos os karts precisam de perfil explícito');
const after = before.map(k => {
  const style = styles.get(k.id), physics = { ...balance.profiles[style] };
  const exclusive = k.price >= 9999997 || k.activated === false || leaders.has(k.id) || recentPrices.has(k.id);
  assert(exclusive || prices.has(k.id), `Preço não definido: ${k.id}`);
  return { ...k, price: exclusive ? k.price : Number(prices.get(k.id)), physics, stats: balance.displayStats(physics, style) };
});
const write = (name, text) => fs.writeFileSync(path.join(__dirname, name), text + '\n', 'utf8');
write('catalogo-proposto-20261009.json', JSON.stringify(after, null, 2));
function sql(from, to, action) {
  const changes = from.map((k, i) => ({ before: k, after: to[i] }));
  return `-- ${action}. Atualiza somente preço, stats e physics; mantém IDs e desbloqueios.
-- Operação atômica. Aborta integralmente se algum cadastro divergir do snapshot.
DO $balance$
DECLARE
  changes jsonb := $catalog$${JSON.stringify(changes)}$catalog$::jsonb;
  matches integer;
  affected integer;
BEGIN
  LOCK TABLE public.karts IN SHARE ROW EXCLUSIVE MODE;
  SELECT count(*) INTO matches FROM public.karts k
    JOIN jsonb_array_elements(changes) c ON k.id = c->'before'->>'id'
    WHERE to_jsonb(k) @> (c->'before');
  IF matches <> ${from.length} THEN
    RAISE EXCEPTION 'Catálogo mudou: % de ${from.length} registros correspondem. Recarregue os dados antes de continuar.', matches;
  END IF;
  UPDATE public.karts k SET
    price = (c->'after'->>'price')::integer,
    stats = c->'after'->'stats', physics = c->'after'->'physics'
    FROM jsonb_array_elements(changes) c WHERE k.id = c->'before'->>'id';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> ${from.length} THEN RAISE EXCEPTION 'Quantidade inesperada: %', affected; END IF;
  RAISE NOTICE '${action}: % karts.', affected;
END $balance$;
SELECT count(*) AS total, count(*) FILTER (WHERE stats ? 'style') AS com_perfil FROM public.karts;`;
}
write('aplicar-20261009.sql', sql(before, after, 'Balanceamento aplicado'));
write('reverter-20261009.sql', sql(after, before, 'Balanceamento revertido'));
const table = after.map((k,i) => `| ${k.id} | ${balance.labels[k.stats.style]} | ${before[i].price} → ${k.price} | ${k.physics.maxSpeed} | ${k.physics.accel} | ${k.physics.turnSpeed} | ${k.physics.grip} | ${k.physics.driftRate} | ${k.physics.driftControl} | ${k.physics.turboBonus} |`).join('\n');
write('catalogo-comparativo.md', `# Catálogo de balanceamento — 1.9.8\n\n${after.length} karts. Valores-base, sem Master Balls, itens ou dificuldade dos bots.\n\nPreços especiais, ajustes recentes de preço, ativação, IDs, líderes e desbloqueios preservados. Preços comerciais em quatro faixas de coleção, sem aumento de desempenho por preço. Karts do mesmo perfil têm a mesma física; isso é intencional e facilita testar e manter o equilíbrio.\n\n| Kart | Perfil | Preço antes → depois | Vel. | Acel. | Direção | Aderência | Carga drift | Controle drift | Duração nitro |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${table}`);
console.log(JSON.stringify({total:after.length, profiles:Object.fromEntries(Object.keys(groups).map(s=>[s,after.filter(k=>k.stats.style===s).length])), pricesChanged:after.filter((k,i)=>k.price!==before[i].price).length}));
