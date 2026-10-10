-- Novos karts: modelos, imagens e GIFs conferidos no projeto.
-- Nao altera karts ja cadastrados. Pode ser executado novamente.
-- Banette preserva o id bannete; o jogo carrega models/banette.glb por compatibilidade.
-- Deoxys, Latios e Latias seguem o preco especial existente: 9999999.
BEGIN;

INSERT INTO public.karts
  (id, name, price, concept_img, stats, physics, pokemon_dex_id, activated)
VALUES
  ('dusknoir', 'Dusknoir', 3200, 'img/dusknoir.png', '{"speed":80,"accel":76,"handling":82}'::jsonb, '{"accel":29,"maxSpeed":33,"turnSpeed":3.4,"grip":0.9,"driftRate":1.5,"turboBonus":1.6,"driftControl":1.4}'::jsonb, 477, true),
  ('gallade', 'Gallade', 3400, 'img/gallade.png', '{"speed":88,"accel":84,"handling":88}'::jsonb, '{"accel":32,"maxSpeed":35,"turnSpeed":3.7,"grip":0.82,"driftRate":1.6,"turboBonus":1.5,"driftControl":1.5}'::jsonb, 475, true),
  ('toxicroak', 'Toxicroak', 3200, 'img/toxicroak.png', '{"speed":85,"accel":87,"handling":86}'::jsonb, '{"accel":33,"maxSpeed":34,"turnSpeed":3.8,"grip":0.78,"driftRate":1.7,"turboBonus":1.5,"driftControl":1.5}'::jsonb, 454, true),
  ('probopass', 'Probopass', 2800, 'img/probopass.png', '{"speed":76,"accel":70,"handling":78}'::jsonb, '{"accel":27,"maxSpeed":32,"turnSpeed":3.2,"grip":0.95,"driftRate":1.3,"turboBonus":1.6,"driftControl":1.4}'::jsonb, 476, true),
  ('glaceon', 'Glaceon', 3200, 'img/glaceon.png', '{"speed":85,"accel":82,"handling":88}'::jsonb, '{"accel":31,"maxSpeed":34,"turnSpeed":3.7,"grip":0.84,"driftRate":1.6,"turboBonus":1.5,"driftControl":1.5}'::jsonb, 471, true),
  ('leafeon', 'Leafeon', 3200, 'img/leafeon.png', '{"speed":82,"accel":90,"handling":94}'::jsonb, '{"accel":34,"maxSpeed":33,"turnSpeed":4.0,"grip":0.82,"driftRate":1.8,"turboBonus":1.5,"driftControl":1.6}'::jsonb, 470, true),
  ('garchomp', 'Garchomp', 3800, 'img/garchomp.png', '{"speed":95,"accel":78,"handling":80}'::jsonb, '{"accel":29,"maxSpeed":38,"turnSpeed":3.2,"grip":0.85,"driftRate":1.2,"turboBonus":1.8,"driftControl":1.1}'::jsonb, 445, true),
  ('deoxys', 'Deoxys', 9999999, 'img/deoxys.png', '{"speed":94,"accel":92,"handling":82}'::jsonb, '{"accel":35,"maxSpeed":37,"turnSpeed":3.5,"grip":0.7,"driftRate":1.7,"turboBonus":1.7,"driftControl":1.4}'::jsonb, 386, true),
  ('latios', 'Latios', 9999999, 'img/latios.png', '{"speed":95,"accel":84,"handling":84}'::jsonb, '{"accel":31,"maxSpeed":38,"turnSpeed":3.5,"grip":0.78,"driftRate":1.5,"turboBonus":1.7,"driftControl":1.3}'::jsonb, 381, true),
  ('latias', 'Latias', 9999999, 'img/latias.png', '{"speed":90,"accel":90,"handling":90}'::jsonb, '{"accel":34,"maxSpeed":36,"turnSpeed":3.8,"grip":0.82,"driftRate":1.7,"turboBonus":1.6,"driftControl":1.5}'::jsonb, 380, true),
  ('torkoal', 'Torkoal', 2400, 'img/torkoal.png', '{"speed":72,"accel":74,"handling":80}'::jsonb, '{"accel":28,"maxSpeed":31,"turnSpeed":3.3,"grip":0.94,"driftRate":1.3,"turboBonus":1.6,"driftControl":1.4}'::jsonb, 324, true),
  ('roselia', 'Roselia', 1800, 'img/roselia.png', '{"speed":76,"accel":86,"handling":92}'::jsonb, '{"accel":33,"maxSpeed":32,"turnSpeed":3.9,"grip":0.83,"driftRate":1.8,"turboBonus":1.4,"driftControl":1.6}'::jsonb, 315, true),
  ('cacnea', 'Cacnea', 1200, 'img/cacnea.png', '{"speed":72,"accel":80,"handling":84}'::jsonb, '{"accel":31,"maxSpeed":31,"turnSpeed":3.6,"grip":0.86,"driftRate":1.6,"turboBonus":1.4,"driftControl":1.5}'::jsonb, 331, true),
  ('bannete', 'Banette', 2800, 'img/banette.png', '{"speed":84,"accel":85,"handling":93}'::jsonb, '{"accel":32,"maxSpeed":34,"turnSpeed":3.9,"grip":0.62,"driftRate":2.0,"turboBonus":1.7,"driftControl":1.5}'::jsonb, 354, true),
  ('altaria', 'Altaria', 3200, 'img/altaria.png', '{"speed":84,"accel":82,"handling":90}'::jsonb, '{"accel":31,"maxSpeed":34,"turnSpeed":3.8,"grip":0.86,"driftRate":1.7,"turboBonus":1.5,"driftControl":1.6}'::jsonb, 334, true)
ON CONFLICT (id) DO NOTHING
RETURNING id, name, price, pokemon_dex_id, activated;

COMMIT;

-- Conferencia dos 15 registros apos a execucao.
SELECT id, name, price, concept_img, stats, physics, pokemon_dex_id, activated
FROM public.karts
WHERE id IN ('dusknoir', 'gallade', 'toxicroak', 'probopass', 'glaceon', 'leafeon', 'garchomp', 'deoxys', 'latios', 'latias', 'torkoal', 'roselia', 'cacnea', 'bannete', 'altaria')
ORDER BY id;
