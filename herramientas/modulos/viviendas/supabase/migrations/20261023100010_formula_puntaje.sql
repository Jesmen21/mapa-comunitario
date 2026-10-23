-- 010 · la fórmula del puntaje, en tablas y con rastro (falla 3)
--
-- Antes: 25 puntos por punto cercano, tope 100, promedio simple, y la fila del
-- análisis no guardaba con qué se calculó.
--
-- Ahora (propuesta §4.4, aprobada con la base de datos):
--   aporte de un punto   = puntos_por_poi × max(0, 1 − distancia / radio)
--   puntaje de categoría = min(tope, suma de aportes)
--   total                = media PONDERADA por el peso de cada categoría
-- Los números viven en `formulas_puntaje` (versionada) y en `categorias_poi`.
-- Cada corrida guarda la COPIA de la fórmula y de los pesos que usó, su
-- estado, y el detalle punto por punto, así que «Colegio a 400 m» y el número
-- salen de la misma fila.
--
-- Dos reglas del proyecto que la función cumple:
--   * SIN MEDIR no es cero. Si una categoría que cuenta no tiene NINGÚN punto
--     activo en 2 km, su puntaje es NULL y no entra al total: ese cero no
--     mediría la cuadra, mediría que la capa está vacía ahí (la clase A de
--     CLAUDE.md). Con puntos en la zona y ninguno en el radio, es un 0 medido.
--   * Todas las distancias se miden desde el punto PÚBLICO (005): es el que el
--     mapa dibuja, así que el texto no lo contradice, y no deja triangular la
--     casa. Cuando la vivienda no oculta su ubicación, el público es el exacto.
--
-- Una fórmula no se edita: se crea otra versión y se activa. Así una corrida
-- vieja sigue diciendo la verdad sobre con qué se calculó.

create table public.formulas_puntaje (
  id uuid primary key default gen_random_uuid(),
  version integer not null constraint formulas_version_unica unique,
  nombre text not null,
  decaimiento text not null default 'lineal' constraint formulas_decaimiento_check check (decaimiento in ('lineal')),
  puntos_por_poi numeric(6,2) not null constraint formulas_puntos_check check (puntos_por_poi > 0),
  tope_por_categoria numeric(6,2) not null constraint formulas_tope_check check (tope_por_categoria > 0),
  radio_por_defecto integer not null default 500,
  radios_permitidos integer[] not null default '{300,500,1000}',
  radio_zona_m integer not null default 2000,
  activa boolean not null default false,
  nota text not null,
  creada_en timestamptz not null default now(),
  creada_por uuid default auth.uid(),
  constraint formulas_radio_permitido check (radio_por_defecto = any (radios_permitidos))
);
create unique index formulas_una_activa on public.formulas_puntaje (activa) where activa;

create function privado.formula_inmutable() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'activa') is distinct from (to_jsonb(old) - 'activa') then
    raise exception 'Una fórmula no se edita: crea una versión nueva y actívala.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger formulas_inmutables before update on public.formulas_puntaje
  for each row execute function privado.formula_inmutable();

insert into public.formulas_puntaje (version, nombre, puntos_por_poi, tope_por_categoria, activa, nota)
values (1, 'Decaimiento lineal con tope', 66.67, 100, true,
  'Propuesta de la Fase 0, §4.4. Con tres puntos a media distancia una categoría llega al tope (3 × 66,67 × 0,5 = 100). Pesos en categorias_poi.');

alter table public.analisis_ubicacion
  alter column puntaje_total drop not null,
  add column formula_id uuid references public.formulas_puntaje(id),
  add column formula_copia jsonb,
  add column categorias_copia jsonb,
  add column puntajes jsonb,
  add column estado text not null default 'formula_anterior'
    constraint analisis_estado_check check (estado in ('ok', 'sin_datos_en_zona', 'formula_anterior')),
  add column punto text constraint analisis_punto_check check (punto in ('publico', 'exacto'));
alter table public.analisis_ubicacion alter column estado drop default;
comment on column public.analisis_ubicacion.puntaje_total is 'NULL = SIN MEDIR: ninguna categoría que cuenta tiene puntos en la zona.';
comment on column public.analisis_ubicacion.detalle is 'Desde la fórmula 1: un objeto por punto dentro del radio, con su distancia desde el punto público y su aporte.';

drop function public.calcular_analisis_ubicacion(uuid, integer);

create function public.calcular_analisis_ubicacion(p_vivienda uuid, p_radio integer default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  f public.formulas_puntaje;
  v_punto extensions.geography;
  v_oculta boolean;
  v_radio integer;
  v_cats jsonb;
  v_detalle jsonb;
  v_puntajes jsonb := '{}'::jsonb;
  v_suma numeric := 0;
  v_pesos numeric := 0;
  v_total integer;
  v_id uuid;
  c record;
begin
  if not public.es_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'Solo el admin corre el análisis.' using errcode = '42501';
  end if;
  select * into f from public.formulas_puntaje where activa;
  if not found then raise exception 'No hay una fórmula activa en formulas_puntaje.'; end if;
  v_radio := coalesce(p_radio, f.radio_por_defecto);
  if not (v_radio = any (f.radios_permitidos)) then
    raise exception 'Radio % no permitido por la fórmula %: %', v_radio, f.version, f.radios_permitidos;
  end if;
  select v.ubicacion_publica, v.ocultar_ubicacion_exacta into v_punto, v_oculta
  from public.viviendas v where v.id = p_vivienda;
  if v_punto is null then raise exception 'No existe la vivienda %.', p_vivienda; end if;

  select jsonb_agg(jsonb_build_object('clave', clave, 'peso', peso) order by orden)
    into v_cats from public.categorias_poi where cuenta_para_analisis;
  if v_cats is null then raise exception 'Ninguna categoría cuenta para el análisis.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'poi_id', p.id, 'nombre', p.nombre, 'subcategoria', p.subcategoria, 'categoria', p.categoria,
           'metros', round(extensions.st_distance(p.ubicacion, v_punto)::numeric),
           'aporte', round(f.puntos_por_poi * greatest(0, 1 - extensions.st_distance(p.ubicacion, v_punto) / v_radio)::numeric, 2),
           'es_ejemplo', p.fuente = 'ejemplo')
           order by extensions.st_distance(p.ubicacion, v_punto)), '[]'::jsonb)
    into v_detalle
  from public.puntos_interes p
  join public.categorias_poi cp on cp.clave = p.categoria and cp.cuenta_para_analisis
  where p.activo and extensions.st_dwithin(p.ubicacion, v_punto, v_radio);

  for c in
    select cp.clave, cp.peso,
           (select count(*) from public.puntos_interes p
             where p.activo and p.categoria = cp.clave
               and extensions.st_dwithin(p.ubicacion, v_punto, f.radio_zona_m)) as en_zona,
           (select coalesce(sum((d ->> 'aporte')::numeric), 0) from jsonb_array_elements(v_detalle) d
             where d ->> 'categoria' = cp.clave) as suma,
           (select count(*) from jsonb_array_elements(v_detalle) d where d ->> 'categoria' = cp.clave) as en_radio
    from public.categorias_poi cp where cp.cuenta_para_analisis order by cp.orden
  loop
    if c.en_zona = 0 then
      v_puntajes := v_puntajes || jsonb_build_object(c.clave,
        jsonb_build_object('puntaje', null, 'en_radio', 0, 'en_zona', 0, 'lectura', 'SIN MEDIR: sin puntos en la zona'));
    else
      v_puntajes := v_puntajes || jsonb_build_object(c.clave,
        jsonb_build_object('puntaje', round(least(f.tope_por_categoria, c.suma)), 'en_radio', c.en_radio, 'en_zona', c.en_zona));
      v_suma := v_suma + c.peso * least(f.tope_por_categoria, c.suma);
      v_pesos := v_pesos + c.peso;
    end if;
  end loop;

  v_total := case when v_pesos > 0 then round(v_suma / v_pesos) end;

  insert into public.analisis_ubicacion (vivienda_id, radio_m, puntaje_total, detalle, formula_id,
    formula_copia, categorias_copia, puntajes, estado, punto)
  values (p_vivienda, v_radio, v_total, v_detalle, f.id, to_jsonb(f), v_cats, v_puntajes,
    case when v_total is null then 'sin_datos_en_zona' else 'ok' end,
    case when v_oculta then 'publico' else 'exacto' end)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.calcular_analisis_ubicacion(uuid, integer) from public, anon;
grant execute on function public.calcular_analisis_ubicacion(uuid, integer) to authenticated, service_role;

alter table public.formulas_puntaje enable row level security;
grant select on public.formulas_puntaje to anon, authenticated;
grant insert, update (activa) on public.formulas_puntaje to authenticated;
create policy "todos leen las formulas" on public.formulas_puntaje for select to anon, authenticated using (true);
create policy "admin crea y activa formulas" on public.formulas_puntaje
  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

-- El análisis: el público lo lee de las viviendas publicadas (la política de
-- la línea base ya lo dice); el admin escribe a través de la función.
grant select on public.analisis_ubicacion to anon, authenticated;
grant insert on public.analisis_ubicacion to authenticated;
create policy "admin registra analisis" on public.analisis_ubicacion
  for insert to authenticated with check ((select public.es_admin()));
create policy "admin y gerencia leen todos los analisis" on public.analisis_ubicacion
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));

-- Las dos casas de ejemplo, recalculadas con la fórmula 1. Sus filas viejas se
-- quedan con estado 'formula_anterior': no se borra una corrida.
select public.calcular_analisis_ubicacion(id) from public.viviendas;
