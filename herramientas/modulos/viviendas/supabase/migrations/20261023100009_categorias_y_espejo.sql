-- 009 · categorías en tabla, el espejo de la capa de mapeos y su importador
--
-- Falla 4: `categoria` era una restricción rígida de cuatro valores, y la capa
-- de URBIS tiene más. Pasa a la tabla `categorias_poi`, y cada categoría dice
-- si cuenta para el análisis y cuánto pesa.
--
-- El espejo (prompt §7.3, etapa 1): la verdad está en la capa de URBIS; acá se
-- copia en un solo sentido, por archivo, con un importador idempotente. La
-- clave es `urbis_mapeo_id`: reimportar no duplica, un punto cambiado se
-- actualiza, uno que no cambió no se toca, y uno que desaparece de un archivo
-- COMPLETO se desactiva (nunca se borra: borrar es esconder).
--
-- Un punto que se agrega desde este módulo no es definitivo: queda
-- `pendiente_enviar_a_urbis` y, antes de crearlo, se buscan coincidencias
-- cercanas para que Daniel decida si es el mismo.

create table public.categorias_poi (
  clave text primary key constraint categorias_clave_formato check (clave ~ '^[a-z0-9_]{2,40}$'),
  nombre text not null,
  icono text not null constraint categorias_icono_formato check (icono ~ '^[a-z0-9-]{1,40}$'),
  cuenta_para_analisis boolean not null default false,
  peso numeric(4,2) not null default 0 constraint categorias_peso_check check (peso >= 0 and peso <= 10),
  orden integer not null default 0,
  creada_en timestamptz not null default now(),
  constraint categorias_cuenta_con_peso check (not cuenta_para_analisis or peso > 0)
);
comment on table public.categorias_poi is
  'Las categorías de los puntos de interés. Los pesos de arranque son la propuesta de la Fase 0 (§4.4) y se cambian acá, no en el código.';

insert into public.categorias_poi (clave, nombre, icono, cuenta_para_analisis, peso, orden) values
  ('educacion', 'Educación', 'escuela', true, 1.0, 1),
  ('transporte', 'Transporte', 'bus', true, 1.0, 2),
  ('comercio', 'Comercio', 'tienda', true, 0.8, 3),
  ('zonas_verdes', 'Zonas verdes', 'arbol', true, 0.8, 4),
  ('salud', 'Salud', 'salud', false, 0, 5),
  ('seguridad', 'Seguridad', 'escudo', false, 0, 6),
  ('otros', 'Otros', 'punto', false, 0, 99);

alter table public.puntos_interes drop constraint puntos_interes_categoria_check;
alter table public.puntos_interes
  add constraint puntos_interes_categoria_fk foreign key (categoria)
    references public.categorias_poi(clave) on update cascade,
  add column urbis_mapeo_id text constraint puntos_urbis_mapeo_id_unico unique,
  add column modulo_origen text,
  add column subcategoria text,
  add column descripcion text constraint puntos_descripcion_largo check (char_length(descripcion) <= 2000),
  add column miniatura_url text constraint puntos_miniatura_https check (miniatura_url ~ '^https://'),
  add column geometria extensions.geography(Geometry, 4326),
  add column activo boolean not null default true,
  add column sincronizado_en timestamptz,
  add column hash_contenido text,
  add column pendiente_enviar_a_urbis boolean not null default false,
  add column actualizado_en_urbis timestamptz;
alter table public.puntos_interes
  add constraint puntos_con_origen check (urbis_mapeo_id is not null or pendiente_enviar_a_urbis or fuente = 'ejemplo');
create index puntos_interes_categoria_idx on public.puntos_interes (categoria) where activo;

create table public.sincronizaciones_mapeos (
  id uuid primary key default gen_random_uuid(),
  archivo text not null,
  completo boolean not null,
  iniciada_en timestamptz not null default now(),
  terminada_en timestamptz,
  estado text not null default 'corriendo' constraint sincronizaciones_estado_check
    check (estado in ('corriendo', 'ok', 'fallida')),
  leidos integer not null default 0,
  insertados integer not null default 0,
  actualizados integer not null default 0,
  sin_cambios integer not null default 0,
  desactivados integer not null default 0,
  rechazados integer not null default 0,
  detalle jsonb not null default '[]'::jsonb,
  ejecutada_por uuid default auth.uid()
);

alter table public.categorias_poi enable row level security;
alter table public.sincronizaciones_mapeos enable row level security;

-- Lectura pública: las categorías y los puntos ACTIVOS. Escritura: el admin.
grant select on public.categorias_poi to anon, authenticated;
grant insert, update on public.categorias_poi to authenticated;
create policy "todos leen categorias" on public.categorias_poi for select to anon, authenticated using (true);
create policy "admin escribe categorias" on public.categorias_poi
  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

drop policy "ver puntos de interes" on public.puntos_interes;
create policy "se ven los puntos activos" on public.puntos_interes
  for select to anon, authenticated using (activo);
grant insert, update on public.puntos_interes to authenticated;
create policy "admin escribe puntos" on public.puntos_interes
  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

grant select on public.sincronizaciones_mapeos to authenticated;
create policy "admin y gerencia leen sincronizaciones" on public.sincronizaciones_mapeos
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));
grant insert, update on public.sincronizaciones_mapeos to authenticated;
create policy "admin escribe sincronizaciones" on public.sincronizaciones_mapeos
  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

-- Puntos por área visible y por zoom. Con el mapa muy alejado no se piden: una
-- ciudad entera de puntos es lo que el prompt prohíbe («nunca completas»).
insert into public.ajustes (clave, valor, razon) values
  ('pois_zoom_minimo', '14', 'Propuesta de la Fase 1: por debajo de este zoom el mapa no pide puntos de interés.'),
  ('pois_maximo_por_consulta', '800', 'Propuesta de la Fase 1: tope de puntos por consulta del mapa.');

create function public.pois_en_area(
  p_oeste double precision, p_sur double precision,
  p_este double precision, p_norte double precision,
  p_zoom integer, p_categorias text[] default null)
returns table (id uuid, nombre text, categoria text, subcategoria text,
               lat double precision, lng double precision,
               miniatura_url text, modulo_origen text, es_ejemplo boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, p.categoria, p.subcategoria,
         extensions.st_y(p.ubicacion::extensions.geometry), extensions.st_x(p.ubicacion::extensions.geometry),
         p.miniatura_url, p.modulo_origen, p.fuente = 'ejemplo'
  from public.puntos_interes p
  where p.activo
    and p_zoom >= public.ajuste_entero('pois_zoom_minimo')
    and p.ubicacion operator(extensions.&&)
        extensions.st_makeenvelope(p_oeste, p_sur, p_este, p_norte, 4326)::extensions.geography
    and (p_categorias is null or p.categoria = any (p_categorias))
  limit public.ajuste_entero('pois_maximo_por_consulta')
$$;
comment on function public.pois_en_area is
  'Corre con privilegios de dueño solo para leer los dos ajustes; devuelve únicamente puntos activos y columnas públicas.';
revoke execute on function public.pois_en_area(double precision, double precision, double precision, double precision, integer, text[]) from public;
grant execute on function public.pois_en_area(double precision, double precision, double precision, double precision, integer, text[]) to anon, authenticated;

-- EL IMPORTADOR. Recibe la lista del contrato de intercambio (§7.3) y devuelve
-- lo que hizo. Lo corre el admin desde el panel o el servidor con su llave;
-- con la sesión del admin pasa por la seguridad por fila como cualquier
-- escritura suya.
create function public.hash_mapeo(p jsonb) returns text
  language sql immutable set search_path = '' as $$
  select md5(jsonb_build_array(
    p ->> 'modulo_origen', p ->> 'nombre', p ->> 'categoria', p ->> 'subcategoria', p ->> 'descripcion',
    round((p ->> 'lat')::numeric, 7), round((p ->> 'lng')::numeric, 7),
    p -> 'geometria_geojson', p ->> 'miniatura_url', coalesce((p ->> 'activo')::boolean, true))::text)
$$;

create function public.importar_mapeos(p_puntos jsonb, p_archivo text, p_completo boolean default false)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_sinc uuid;
  v_p jsonb;
  v_id text;
  v_hash text;
  v_viejo text;
  v_geom extensions.geography;
  v_motivo text;
  v_vistos text[] := '{}';
  n_leidos int := 0; n_ins int := 0; n_act int := 0; n_igual int := 0; n_desact int := 0; n_rech int := 0;
  v_detalle jsonb := '[]'::jsonb;
begin
  if not (public.es_admin() or current_user in ('postgres', 'service_role')) then
    raise exception 'Solo el admin importa mapeos.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_puntos) is distinct from 'array' then
    raise exception 'El archivo tiene que ser una lista JSON de puntos (contrato de intercambio, §7.3).';
  end if;

  insert into public.sincronizaciones_mapeos (archivo, completo) values (p_archivo, p_completo)
  returning id into v_sinc;

  for v_p in select * from jsonb_array_elements(p_puntos) loop
    n_leidos := n_leidos + 1;
    v_id := nullif(trim(v_p ->> 'urbis_mapeo_id'), '');
    v_motivo := case
      when v_id is null then 'sin urbis_mapeo_id'
      when v_id = any (v_vistos) then 'urbis_mapeo_id repetido en el mismo archivo'
      when nullif(trim(v_p ->> 'nombre'), '') is null then 'sin nombre'
      when nullif(trim(v_p ->> 'modulo_origen'), '') is null then 'sin modulo_origen'
      when not exists (select 1 from public.categorias_poi c where c.clave = v_p ->> 'categoria') then
        'categoría desconocida: ' || coalesce(v_p ->> 'categoria', 'vacía')
      when jsonb_typeof(v_p -> 'lat') <> 'number' or jsonb_typeof(v_p -> 'lng') <> 'number' then 'lat o lng no son números'
      when (v_p ->> 'lat')::numeric not between -4.3 and 13.5
        or (v_p ->> 'lng')::numeric not between -82 and -66.8 then 'coordenada fuera de Colombia'
      when v_p ? 'miniatura_url' and v_p ->> 'miniatura_url' is not null
        and v_p ->> 'miniatura_url' !~ '^https://' then 'miniatura_url no es una URL https (una imagen en base64 no se acepta)'
      else null end;

    v_geom := null;
    if v_motivo is null and v_p ? 'geometria_geojson' and v_p -> 'geometria_geojson' <> 'null'::jsonb then
      begin
        v_geom := extensions.st_geomfromgeojson(
          case jsonb_typeof(v_p -> 'geometria_geojson') when 'string' then v_p ->> 'geometria_geojson'
               else (v_p -> 'geometria_geojson')::text end)::extensions.geography;
      exception when others then
        v_motivo := 'geometria_geojson no es GeoJSON válido';
      end;
    end if;

    if v_motivo is not null then
      n_rech := n_rech + 1;
      v_detalle := v_detalle || jsonb_build_object('n', n_leidos, 'urbis_mapeo_id', v_id, 'motivo', v_motivo);
      continue;
    end if;

    v_vistos := v_vistos || v_id;
    v_hash := public.hash_mapeo(v_p);
    select p.hash_contenido into v_viejo from public.puntos_interes p where p.urbis_mapeo_id = v_id;

    if not found then
      insert into public.puntos_interes (urbis_mapeo_id, modulo_origen, nombre, categoria, subcategoria,
        descripcion, ubicacion, geometria, miniatura_url, activo, fuente, hash_contenido,
        sincronizado_en, actualizado_en_urbis)
      values (v_id, v_p ->> 'modulo_origen', trim(v_p ->> 'nombre'), v_p ->> 'categoria', v_p ->> 'subcategoria',
        v_p ->> 'descripcion',
        extensions.st_setsrid(extensions.st_makepoint((v_p ->> 'lng')::float8, (v_p ->> 'lat')::float8), 4326)::extensions.geography,
        v_geom, v_p ->> 'miniatura_url', coalesce((v_p ->> 'activo')::boolean, true), 'urbis', v_hash,
        now(), nullif(v_p ->> 'actualizado_en', '')::timestamptz);
      n_ins := n_ins + 1;
    elsif v_viejo is distinct from v_hash then
      update public.puntos_interes p set
        modulo_origen = v_p ->> 'modulo_origen', nombre = trim(v_p ->> 'nombre'),
        categoria = v_p ->> 'categoria', subcategoria = v_p ->> 'subcategoria',
        descripcion = v_p ->> 'descripcion',
        ubicacion = extensions.st_setsrid(extensions.st_makepoint((v_p ->> 'lng')::float8, (v_p ->> 'lat')::float8), 4326)::extensions.geography,
        geometria = v_geom, miniatura_url = v_p ->> 'miniatura_url',
        activo = coalesce((v_p ->> 'activo')::boolean, true),
        hash_contenido = v_hash, sincronizado_en = now(),
        actualizado_en_urbis = nullif(v_p ->> 'actualizado_en', '')::timestamptz
      where p.urbis_mapeo_id = v_id;
      n_act := n_act + 1;
    else
      update public.puntos_interes p set sincronizado_en = now() where p.urbis_mapeo_id = v_id;
      n_igual := n_igual + 1;
    end if;
  end loop;

  if p_completo then
    update public.puntos_interes p set activo = false, sincronizado_en = now()
    where p.urbis_mapeo_id is not null and p.activo and not (p.urbis_mapeo_id = any (v_vistos));
    get diagnostics n_desact = row_count;
  end if;

  update public.sincronizaciones_mapeos set terminada_en = now(), estado = 'ok',
    leidos = n_leidos, insertados = n_ins, actualizados = n_act, sin_cambios = n_igual,
    desactivados = n_desact, rechazados = n_rech, detalle = v_detalle
  where id = v_sinc;

  return jsonb_build_object('sincronizacion', v_sinc, 'leidos', n_leidos, 'insertados', n_ins,
    'actualizados', n_act, 'sin_cambios', n_igual, 'desactivados', n_desact,
    'rechazados', n_rech, 'detalle', v_detalle);
end $$;
revoke execute on function public.importar_mapeos(jsonb, text, boolean) from public, anon;
grant execute on function public.importar_mapeos(jsonb, text, boolean) to authenticated, service_role;

-- Un punto propuesto desde este módulo. Si hay coincidencias cercanas y no se
-- confirmó, NO se crea: se devuelven para que Daniel decida.
create function public.proponer_punto_local(
  p_nombre text, p_categoria text, p_lat double precision, p_lng double precision,
  p_confirmar boolean default false)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_punto extensions.geography :=
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_coinc jsonb;
  v_id uuid;
begin
  if not public.es_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'Solo el admin propone puntos.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'categoria', p.categoria,
           'metros', round(extensions.st_distance(p.ubicacion, v_punto)::numeric))
           order by extensions.st_distance(p.ubicacion, v_punto)), '[]'::jsonb)
    into v_coinc
  from public.puntos_interes p
  where p.activo and (
    extensions.st_dwithin(p.ubicacion, v_punto, 25)
    or (extensions.st_dwithin(p.ubicacion, v_punto, 100) and public.slug_de(p.nombre) = public.slug_de(p_nombre)));

  if jsonb_array_length(v_coinc) > 0 and not p_confirmar then
    return jsonb_build_object('creado', null, 'coincidencias', v_coinc);
  end if;

  insert into public.puntos_interes (nombre, categoria, ubicacion, fuente, modulo_origen, pendiente_enviar_a_urbis)
  values (trim(p_nombre), p_categoria, v_punto, 'viviendas', 'viviendas', true)
  returning id into v_id;
  return jsonb_build_object('creado', v_id, 'coincidencias', v_coinc);
end $$;
revoke execute on function public.proponer_punto_local(text, text, double precision, double precision, boolean) from public, anon;
grant execute on function public.proponer_punto_local(text, text, double precision, double precision, boolean) to authenticated, service_role;
