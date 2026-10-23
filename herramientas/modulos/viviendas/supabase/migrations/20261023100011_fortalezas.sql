-- 011 · una fortaleza dice de dónde sale, o no existe
--
-- La regla de credibilidad (prompt §4) llevada a la base: una fortaleza apunta
-- a un punto de interés, o declara por qué no tiene base («La vendedora la
-- remodeló en 2025»). Una fortaleza sin ninguna de las dos cosas no se puede
-- guardar.
--
-- La distancia NO se escribe a mano: la calcula la base, desde el punto
-- público, y se vuelve a calcular si la vivienda o el punto se mueven. Una
-- distancia tecleada es una cifra que envejece sola.

create table public.vivienda_fortalezas (
  id uuid primary key default gen_random_uuid(),
  vivienda_id uuid not null references public.viviendas(id) on delete cascade,
  texto text not null constraint fortalezas_texto_largo check (char_length(texto) between 1 and 140),
  poi_id uuid references public.puntos_interes(id) on delete cascade,
  distancia_m integer,
  sin_base_razon text constraint fortalezas_razon_largo check (char_length(sin_base_razon) between 10 and 300),
  origen text not null default 'manual' constraint fortalezas_origen_check check (origen in ('plantilla', 'manual')),
  orden integer not null default 0,
  creada_en timestamptz not null default now(),
  constraint fortalezas_con_base check (poi_id is not null or sin_base_razon is not null),
  constraint fortalezas_distancia_solo_con_punto check (distancia_m is null or poi_id is not null)
);
create index vivienda_fortalezas_vivienda_idx on public.vivienda_fortalezas (vivienda_id, orden);

create function privado.fortaleza_distancia() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.poi_id is null then
    new.distancia_m := null;
  else
    select round(extensions.st_distance(p.ubicacion, v.ubicacion_publica))
      into new.distancia_m
    from public.puntos_interes p, public.viviendas v
    where p.id = new.poi_id and v.id = new.vivienda_id;
  end if;
  return new;
end $$;
revoke execute on function privado.fortaleza_distancia() from public;
create trigger fortalezas_distancia before insert or update on public.vivienda_fortalezas
  for each row execute function privado.fortaleza_distancia();

create function privado.fortalezas_recalcular() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'viviendas' then
    update public.vivienda_fortalezas set poi_id = poi_id where vivienda_id = new.id and poi_id is not null;
  else
    update public.vivienda_fortalezas set poi_id = poi_id where poi_id = new.id;
  end if;
  return null;
end $$;
revoke execute on function privado.fortalezas_recalcular() from public;
-- «of ubicacion» y no «of ubicacion_publica»: la pública la pone un disparador
-- BEFORE, y UPDATE OF solo mira las columnas que la orden nombra.
create trigger viviendas_fortalezas_recalcular after update of ubicacion, ocultar_ubicacion_exacta on public.viviendas
  for each row execute function privado.fortalezas_recalcular();
create trigger puntos_fortalezas_recalcular after update of ubicacion on public.puntos_interes
  for each row execute function privado.fortalezas_recalcular();

alter table public.vivienda_fortalezas enable row level security;
grant select on public.vivienda_fortalezas to anon, authenticated;
grant insert (vivienda_id, texto, poi_id, sin_base_razon, origen, orden),
      update (texto, poi_id, sin_base_razon, orden), delete
  on public.vivienda_fortalezas to authenticated;
create policy "se ven las de viviendas publicadas" on public.vivienda_fortalezas
  for select to anon, authenticated
  using (exists (select 1 from public.viviendas v where v.id = vivienda_id and v.publicada));
create policy "admin escribe fortalezas" on public.vivienda_fortalezas
  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

-- Las de PLANTILLA salen del último análisis: el punto más cercano de cada
-- categoría que cuenta, dentro del radio. Una categoría sin puntos no produce
-- fortaleza: no se inventa nada. Las manuales no se tocan.
create function public.generar_fortalezas(p_vivienda uuid) returns integer
  language plpgsql set search_path = '' as $$
declare
  v_detalle jsonb;
  n integer;
begin
  if not public.es_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'Solo el admin genera fortalezas.' using errcode = '42501';
  end if;
  select a.detalle into v_detalle from public.analisis_ubicacion a
  where a.vivienda_id = p_vivienda and a.estado = 'ok'
  order by a.calculado_en desc limit 1;
  if v_detalle is null then raise exception 'La vivienda no tiene un análisis con la fórmula vigente.'; end if;

  delete from public.vivienda_fortalezas where vivienda_id = p_vivienda and origen = 'plantilla';
  insert into public.vivienda_fortalezas (vivienda_id, texto, poi_id, origen, orden)
  select p_vivienda,
         coalesce(d ->> 'subcategoria', d ->> 'nombre') || ' a ' || greatest(50, round((d ->> 'metros')::numeric / 50) * 50)::integer || ' m',
         (d ->> 'poi_id')::uuid, 'plantilla', row_number() over (order by (d ->> 'metros')::numeric)
  from (select distinct on (e ->> 'categoria') e as d
        from jsonb_array_elements(v_detalle) e
        order by e ->> 'categoria', (e ->> 'metros')::numeric) cercanos;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.generar_fortalezas(uuid) from public, anon;
grant execute on function public.generar_fortalezas(uuid) to authenticated, service_role;
