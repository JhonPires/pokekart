-- Teste real com duas identidades temporárias. Nada persiste: sempre ROLLBACK.
BEGIN;
DO $setup$
DECLARE u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); foreign_part uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,raw_user_meta_data) VALUES
    (u,'{"nickname":"__mechanic_qa_rollback__"}'),(other_user,'{"nickname":"__mechanic_qa_rollback__"}');
  UPDATE public.profiles SET coins=10000,unlocked_karts=ARRAY['jolteon','onix'] WHERE id IN(u,other_user);
  INSERT INTO public.player_kart_parts(id,user_id,part_id,slot,remaining,purchase_id)
    VALUES(foreign_part,other_user,'motor_rotom','motor',10,gen_random_uuid());
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM set_config('pokekart.qa_uid',u::text,true);
  PERFORM set_config('pokekart.qa_other',other_user::text,true);
  PERFORM set_config('pokekart.qa_foreign_part',foreign_part::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $tests$
DECLARE state jsonb; snap jsonb; last_snap jsonb; purchase uuid:=gen_random_uuid();
  race uuid:=gen_random_uuid(); first_part uuid; second_part uuid; denied boolean; i integer;
BEGIN
  state:=public.mechanic_buy_part('motor_rotom',purchase);
  IF (state->>'coins')::integer<>9650 OR jsonb_array_length(state->'parts')<>1 THEN RAISE EXCEPTION 'Compra/saldo incorreto'; END IF;
  first_part:=(state->'parts'->0->>'id')::uuid;
  IF public.mechanic_buy_part('motor_rotom',purchase)<>state THEN RAISE EXCEPTION 'Compra repetida não é idempotente'; END IF;
  denied:=false;
  BEGIN PERFORM public.mechanic_buy_part('nitro_cyndaquil',purchase); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'ID de compra reutilizado para outra peça'; END IF;
  denied:=false;
  BEGIN PERFORM public.mechanic_equip_part(current_setting('pokekart.qa_foreign_part')::uuid,'jolteon'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Equipou peça de outro jogador'; END IF;
  PERFORM public.mechanic_equip_part(first_part,'jolteon');
  PERFORM public.mechanic_equip_part(first_part,'onix');
  IF NOT EXISTS(SELECT 1 FROM public.player_kart_parts WHERE id=first_part AND kart_id='onix' AND remaining=10) THEN RAISE EXCEPTION 'Transferência alterou durabilidade'; END IF;
  PERFORM public.mechanic_equip_part(first_part,NULL);
  PERFORM public.mechanic_equip_part(first_part,'jolteon');
  state:=public.mechanic_buy_part('motor_rotom',gen_random_uuid());
  SELECT id INTO second_part FROM public.player_kart_parts WHERE user_id=auth.uid() AND id<>first_part;
  PERFORM public.mechanic_equip_part(second_part,'jolteon');
  IF (SELECT count(*) FROM public.player_kart_parts WHERE kart_id='jolteon' AND slot='motor')<>1
    OR EXISTS(SELECT 1 FROM public.player_kart_parts WHERE id=first_part AND kart_id IS NOT NULL) THEN RAISE EXCEPTION 'Slot duplicado'; END IF;
  denied:=false;
  BEGIN PERFORM public.mechanic_equip_part(second_part,'kart_inexistente'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Kart inválido aceito'; END IF;
  snap:=public.mechanic_start_race(race,'jolteon');
  IF (snap->'physics'->>'accel')::numeric<>41.04 OR (snap->'parts'->0->>'remaining')::integer<>9 THEN RAISE EXCEPTION 'Buff/consumo incorreto'; END IF;
  IF public.mechanic_start_race(race,'jolteon')<>snap OR NOT EXISTS(SELECT 1 FROM public.player_kart_parts WHERE id=second_part AND remaining=9) THEN RAISE EXCEPTION 'Consumo duplicado'; END IF;
  denied:=false;
  BEGIN PERFORM public.mechanic_start_race(race,'onix'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Corrida reutilizada para outro kart'; END IF;
  FOR i IN 2..10 LOOP last_snap:=public.mechanic_start_race(gen_random_uuid(),'jolteon'); END LOOP;
  IF (last_snap->'physics'->>'accel')::numeric<>41.04 OR (last_snap->'parts'->0->>'remaining')::integer<>0 THEN RAISE EXCEPTION 'Última carga perdeu buff'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.player_kart_parts WHERE id=second_part AND remaining=0 AND kart_id IS NULL) THEN RAISE EXCEPTION 'Peça não expirou'; END IF;
  snap:=public.mechanic_start_race(gen_random_uuid(),'jolteon');
  IF (snap->'physics'->>'accel')::numeric<>38 OR jsonb_array_length(snap->'parts')<>0 THEN RAISE EXCEPTION 'Buff permaneceu após expirar'; END IF;
  denied:=false;
  BEGIN UPDATE public.player_kart_parts SET remaining=100 WHERE id=first_part; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Cliente pode adulterar durabilidade'; END IF;
  UPDATE public.profiles SET coins=0 WHERE id=auth.uid();
  denied:=false;
  BEGIN PERFORM public.mechanic_buy_part('motor_rotom',gen_random_uuid()); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied OR (public.mechanic_state()->>'coins')::integer<>0 THEN RAISE EXCEPTION 'Compra sem saldo aceita'; END IF;
  PERFORM set_config('request.jwt.claim.sub',current_setting('pokekart.qa_other'),true);
  IF EXISTS(SELECT 1 FROM public.player_kart_parts WHERE user_id=current_setting('pokekart.qa_uid')::uuid)
    OR EXISTS(SELECT 1 FROM public.mechanic_races WHERE user_id=current_setting('pokekart.qa_uid')::uuid) THEN RAISE EXCEPTION 'RLS expõe outro jogador'; END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  denied:=false;
  BEGIN PERFORM public.mechanic_state(); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied OR has_function_privilege('anon','public.mechanic_start_race(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Acesso anônimo permitido'; END IF;
  RAISE NOTICE 'Mecânica: compra, idempotência, slots, transferência, expiração, última carga e RLS aprovados.';
END $tests$;
RESET ROLE;
ROLLBACK;
SELECT 'Testes transacionais aprovados' AS resultado,
  (SELECT count(*) FROM public.profiles WHERE nickname='__mechanic_qa_rollback__') AS perfis_temporarios_restantes;
