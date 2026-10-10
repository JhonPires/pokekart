-- Mecânica Pokémon: catálogo separado dos cosméticos; operações atômicas por RPC.
BEGIN;
CREATE TABLE IF NOT EXISTS public.mechanic_parts (
  id text PRIMARY KEY, name text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('motor','transmissao','freios','nitro','pneus')),
  price integer NOT NULL CHECK (price > 0), durability integer NOT NULL CHECK (durability BETWEEN 1 AND 100),
  description text NOT NULL, icon text NOT NULL,
  modifiers jsonb NOT NULL CHECK (jsonb_typeof(modifiers) = 'object'),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (id, slot)
);
CREATE TABLE IF NOT EXISTS public.player_kart_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  part_id text NOT NULL, slot text NOT NULL,
  remaining integer NOT NULL CHECK (remaining >= 0),
  kart_id text REFERENCES public.karts(id),
  purchase_id uuid NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (part_id, slot) REFERENCES public.mechanic_parts(id, slot),
  UNIQUE (user_id, purchase_id),
  CHECK (remaining > 0 OR kart_id IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS player_kart_parts_equipped_slot
  ON public.player_kart_parts(user_id, kart_id, slot) WHERE kart_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS player_kart_parts_owner ON public.player_kart_parts(user_id);
CREATE TABLE IF NOT EXISTS public.mechanic_races (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  race_id uuid NOT NULL, kart_id text NOT NULL REFERENCES public.karts(id),
  snapshot jsonb NOT NULL, started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, race_id)
);
ALTER TABLE public.mechanic_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_kart_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_races ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mechanic_catalog_read ON public.mechanic_parts;
CREATE POLICY mechanic_catalog_read ON public.mechanic_parts FOR SELECT TO authenticated USING (active);
DROP POLICY IF EXISTS mechanic_inventory_read ON public.player_kart_parts;
CREATE POLICY mechanic_inventory_read ON public.player_kart_parts FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS mechanic_races_read ON public.mechanic_races;
CREATE POLICY mechanic_races_read ON public.mechanic_races FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.mechanic_parts, public.player_kart_parts, public.mechanic_races FROM anon, authenticated;
GRANT SELECT ON public.mechanic_parts, public.player_kart_parts, public.mechanic_races TO authenticated;

INSERT INTO public.mechanic_parts(id,name,slot,price,durability,description,icon,modifiers) VALUES
 ('motor_rotom','Motor Rotom','motor',350,10,'+8% de aceleração. Recupere velocidade mais rápido.','icones/tematicos/raio.svg','{"accel":0.08}'),
 ('transmissao_klink','Transmissão Klink','transmissao',400,10,'+4% de velocidade máxima para as retas.','icones/tematicos/configuracoes.png','{"maxSpeed":0.04}'),
 ('freios_bronzor','Freios Bronzor','freios',200,10,'+12% de força de frenagem.','icones/tematicos/escudo.png','{"brakeDecel":0.12}'),
 ('nitro_cyndaquil','Nitro Cyndaquil','nitro',300,10,'+10% na duração de turbos de item, pista e largada. Não altera o mini-turbo de drift.','icones/tematicos/turbo.png','{"turboBonus":0.10}'),
 ('pneus_donphan','Pneus Donphan','pneus',150,10,'+0,04 de aderência e +4% no controle do drift.','icones/tematicos/kart.png','{"grip_add":0.04,"driftControl":0.04}')
ON CONFLICT (id) DO NOTHING;

-- Função privada: mesma rotação UTC e embaralhamento usados em auth.js.
CREATE OR REPLACE FUNCTION public.mechanic_can_use_kart(p_user uuid, p_kart text)
RETURNS boolean LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE ids text[]; seed bigint; i integer; j integer; swap text; day_utc date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=p_user
    AND (p_kart = ANY(coalesce(p.unlocked_karts, ARRAY[]::text[])) OR p.starter_kart_id=p_kart)) THEN RETURN true; END IF;
  SELECT array_agg(id ORDER BY id) INTO ids FROM public.karts WHERE activated IS DISTINCT FROM false;
  seed := extract(year FROM day_utc)::bigint*10000 + extract(month FROM day_utc)::bigint*100 + extract(day FROM day_utc)::bigint;
  IF coalesce(array_length(ids,1),0) < 1 THEN RETURN false; END IF;
  IF array_length(ids,1)>1 THEN
    FOR i IN REVERSE array_length(ids,1)..2 LOOP
      seed := (seed*9301+49297)%233280;
      j := floor(seed::numeric/233280*i)::integer+1;
      swap:=ids[i]; ids[i]:=ids[j]; ids[j]:=swap;
    END LOOP;
  END IF;
  RETURN p_kart = ANY(ids[1:4]);
END $fn$;
REVOKE ALL ON FUNCTION public.mechanic_can_use_kart(uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mechanic_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE uid uuid := auth.uid(); balance integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Faça login para acessar a Mecânica Pokémon.'; END IF;
  SELECT coins INTO balance FROM public.profiles WHERE id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
  RETURN jsonb_build_object('coins',coalesce(balance,0),
    'catalog',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.slot,p.id) FROM public.mechanic_parts p WHERE active),'[]'::jsonb),
    'parts',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.purchased_at,p.id) FROM public.player_kart_parts p WHERE user_id=uid AND remaining>0),'[]'::jsonb));
END $fn$;

CREATE OR REPLACE FUNCTION public.mechanic_buy_part(p_part_id text, p_purchase_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE uid uuid := auth.uid(); balance integer; part public.mechanic_parts; previous text;
BEGIN
  IF uid IS NULL OR p_purchase_id IS NULL THEN RAISE EXCEPTION 'Compra inválida. Faça login novamente.'; END IF;
  SELECT coins INTO balance FROM public.profiles WHERE id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
  SELECT part_id INTO previous FROM public.player_kart_parts WHERE user_id=uid AND purchase_id=p_purchase_id;
  IF FOUND THEN
    IF previous<>p_part_id THEN RAISE EXCEPTION 'Identificador de compra já utilizado.'; END IF;
    RETURN public.mechanic_state();
  END IF;
  SELECT * INTO part FROM public.mechanic_parts WHERE id=p_part_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Peça indisponível.'; END IF;
  IF coalesce(balance,0)<part.price THEN RAISE EXCEPTION 'Moedas insuficientes.'; END IF;
  UPDATE public.profiles SET coins=coins-part.price WHERE id=uid;
  INSERT INTO public.player_kart_parts(user_id,part_id,slot,remaining,purchase_id)
    VALUES(uid,part.id,part.slot,part.durability,p_purchase_id);
  RETURN public.mechanic_state();
END $fn$;

CREATE OR REPLACE FUNCTION public.mechanic_equip_part(p_instance_id uuid, p_kart_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE uid uuid := auth.uid(); item public.player_kart_parts;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Faça login para equipar peças.'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=uid FOR UPDATE;
  SELECT * INTO item FROM public.player_kart_parts WHERE id=p_instance_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Peça não encontrada no seu inventário.'; END IF;
  IF item.remaining<=0 THEN RAISE EXCEPTION 'Esta peça está esgotada.'; END IF;
  IF p_kart_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.karts WHERE id=p_kart_id) OR NOT public.mechanic_can_use_kart(uid,p_kart_id) THEN
      RAISE EXCEPTION 'Desbloqueie este kart ou use um kart da rotação diária.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.mechanic_parts WHERE id=item.part_id AND active) THEN RAISE EXCEPTION 'Peça indisponível.'; END IF;
    UPDATE public.player_kart_parts SET kart_id=NULL WHERE user_id=uid AND kart_id=p_kart_id AND slot=item.slot;
  END IF;
  UPDATE public.player_kart_parts SET kart_id=p_kart_id WHERE id=item.id;
  RETURN public.mechanic_state();
END $fn$;

CREATE OR REPLACE FUNCTION public.mechanic_start_race(p_race_id uuid, p_kart_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE uid uuid := auth.uid(); saved public.mechanic_races; item record; base jsonb; effective jsonb;
  parts jsonb := '[]'; modifiers jsonb := '{}'; change record; value numeric; cap numeric;
BEGIN
  IF uid IS NULL OR p_race_id IS NULL THEN RAISE EXCEPTION 'Corrida inválida. Faça login novamente.'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
  SELECT * INTO saved FROM public.mechanic_races WHERE user_id=uid AND race_id=p_race_id;
  IF FOUND THEN
    IF saved.kart_id<>p_kart_id THEN RAISE EXCEPTION 'Esta corrida já foi iniciada com outro kart.'; END IF;
    RETURN saved.snapshot;
  END IF;
  IF NOT public.mechanic_can_use_kart(uid,p_kart_id) THEN RAISE EXCEPTION 'Kart indisponível. Volte à garagem.'; END IF;
  SELECT physics || '{"brakeDecel":30}'::jsonb INTO base FROM public.karts WHERE id=p_kart_id;
  IF base IS NULL THEN RAISE EXCEPTION 'Atributos do kart indisponíveis.'; END IF;
  effective:=base;
  FOR item IN SELECT p.*,c.name,c.modifiers FROM public.player_kart_parts p
    JOIN public.mechanic_parts c ON c.id=p.part_id AND c.active
    WHERE p.user_id=uid AND p.kart_id=p_kart_id AND p.remaining>0 ORDER BY p.slot,p.id FOR UPDATE OF p
  LOOP
    parts:=parts || jsonb_build_array(jsonb_build_object('id',item.id,'part_id',item.part_id,'name',item.name,'slot',item.slot,'remaining',item.remaining-1));
    FOR change IN SELECT * FROM jsonb_each_text(item.modifiers) LOOP
      IF change.key IN ('accel','maxSpeed','brakeDecel','turnSpeed','turboBonus','driftRate','driftControl','grip_add') THEN
        modifiers:=jsonb_set(modifiers,ARRAY[change.key],to_jsonb(coalesce((modifiers->>change.key)::numeric,0)+greatest(0,change.value::numeric)));
      END IF;
    END LOOP;
    UPDATE public.player_kart_parts SET remaining=remaining-1,
      kart_id=CASE WHEN remaining=1 THEN NULL ELSE kart_id END WHERE id=item.id;
  END LOOP;
  FOR change IN SELECT * FROM jsonb_each_text(modifiers) LOOP
    IF change.key='grip_add' THEN
      effective:=jsonb_set(effective,'{grip}',to_jsonb(least(0.98,(base->>'grip')::numeric+least(0.08,change.value::numeric))));
    ELSE
      cap:=CASE change.key WHEN 'maxSpeed' THEN 0.08 WHEN 'brakeDecel' THEN 0.25 WHEN 'turboBonus' THEN 0.20
        WHEN 'accel' THEN 0.15 WHEN 'driftRate' THEN 0.12 ELSE 0.10 END;
      value:=(base->>change.key)::numeric*(1+least(cap,change.value::numeric));
      effective:=jsonb_set(effective,ARRAY[change.key],to_jsonb(value));
    END IF;
  END LOOP;
  saved.snapshot:=jsonb_build_object('race_id',p_race_id,'kart_id',p_kart_id,'physics',effective,'parts',parts);
  INSERT INTO public.mechanic_races(user_id,race_id,kart_id,snapshot) VALUES(uid,p_race_id,p_kart_id,saved.snapshot);
  RETURN saved.snapshot;
END $fn$;

REVOKE ALL ON FUNCTION public.mechanic_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mechanic_buy_part(text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mechanic_equip_part(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mechanic_start_race(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mechanic_state(), public.mechanic_buy_part(text,uuid), public.mechanic_equip_part(uuid,text), public.mechanic_start_race(uuid,text) TO authenticated;
COMMIT;
SELECT name,slot,price,durability FROM public.mechanic_parts ORDER BY slot;
