-- URBIS VIVIENDAS · lo que falta de la Fase 1, para pegar en el editor SQL de Supabase
--
-- Por qué a mano: el conector de Supabase pide confirmación antes de cualquier
-- `delete from` o `drop` de un objeto, y esa confirmación no le llega a la
-- sesión de Claude: la llamada se corta a los 60 s sin tocar la base (medido el
-- 2026-10-23 con un `drop policy if exists` que no tenía nada que borrar).
-- Siete de las catorce migraciones traen una de esas órdenes. Las que no, ya
-- entraron por el conector: 001 (partes 1 a 3), 002 y 003.
--
-- CÓMO SE CORRE
--   1. supabase.com → proyecto urbis-viviendas → SQL Editor → New query.
--   2. Pegar ESTE archivo entero y pulsar Run. Si el editor pregunta por las
--      operaciones destructivas, confirmar: son las siete de arriba, y la única
--      que borra datos es la de los datos de ejemplo.
--   3. Debe terminar con una fila de cifras (la última consulta). Si sale un
--      error, la transacción se deshace entera y la base queda como estaba.
--
-- Lo que contiene, en orden: 001 parte 4, 004 a 014 tal cual están en el
-- repositorio, y los datos de ejemplo. No contiene ninguna clave.

begin;

do $$ begin
  if to_regclass('public.perfiles') is null then
    raise exception 'Falta la 003: este archivo va después de lo que aplicó el conector.';
  end if;
  if to_regclass('public.ajustes') is not null then
    raise exception 'La 004 ya está aplicada: este archivo ya corrió una vez. No se vuelve a correr.';
  end if;
end $$;

-- ═══ 001 · viviendas_campos, parte 4 (las partes 1 a 3 ya entraron por el conector) ═══
-- Un solo comando para borrar TODO lo de ejemplo: viviendas marcadas (con sus
-- fotos, análisis y solicitudes, por cascada) y puntos con fuente 'ejemplo'.
-- Solo lo corre quien tiene la base: postgres o service_role, nunca la app.
create function public.borrar_datos_de_ejemplo() returns jsonb
  language plpgsql set search_path = '' as $$
declare v int; p int;
begin
  delete from public.viviendas where es_ejemplo;
  get diagnostics v = row_count;
  delete from public.puntos_interes where fuente = 'ejemplo';
  get diagnostics p = row_count;
  return jsonb_build_object('viviendas_borradas', v, 'puntos_borrados', p);
end $$;
revoke execute on function public.borrar_datos_de_ejemplo() from public, anon, authenticated;


-- ═══ 20261023100004_interesados_seguros.sql ═══
-- 004 · interesados seguros (falla 2)
--
-- Hoy cualquiera, sin sesión, inserta datos personales: la política dice
-- `with check (true)` para anon. Pasa a: solo un cliente con sesión, a nombre
-- propio, sobre una vivienda publicada, y con límite de envíos. Nadie lee la
-- tabla salvo el dueño de cada solicitud y el admin.
--
-- Los límites viven en una tabla de AJUSTES y no en el código: son decisiones
-- de producto y se cambian sin migración. Los valores de arranque (5 por día,
-- 1 abierta por vivienda) son una PROPUESTA y están anotados para Daniel.

create table public.ajustes (
  clave text primary key constraint ajustes_clave_formato check (clave ~ '^[a-z0-9_]+$'),
  valor jsonb not null,
  razon text not null,
  actualizado_en timestamptz not null default now()
);
alter table public.ajustes enable row level security;
comment on table public.ajustes is 'Números de producto configurables. Cada uno con su razón.';

insert into public.ajustes (clave, valor, razon) values
  ('solicitudes_por_dia', '5', 'Propuesta de la Fase 1, sin decidir por Daniel: tope de solicitudes de visita por usuario en 24 h.'),
  ('solicitudes_abiertas_por_vivienda', '1', 'Propuesta de la Fase 1, sin decidir por Daniel: una solicitud sin cerrar por usuario y vivienda.');

create function public.ajuste_entero(p_clave text) returns integer
  language sql stable security definer set search_path = '' as $$
  select (valor #>> '{}')::integer from public.ajustes where clave = p_clave
$$;
revoke execute on function public.ajuste_entero(text) from public, anon, authenticated;

-- 0 filas medidas en la base viva el 2026-10-23, así que la columna nace
-- obligatoria sin migrar nada.
alter table public.interesados
  add column user_id uuid not null references auth.users(id) on delete cascade,
  add column estado text not null default 'nueva'
    constraint interesados_estado_check check (estado in ('nueva', 'contactada', 'visita_agendada', 'cerrada')),
  add column atendida_en timestamptz,
  add constraint interesados_telefono_formato check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint interesados_largos check (char_length(nombre) between 1 and 120
                                           and char_length(coalesce(mensaje, '')) <= 1000);
create index interesados_user_idx on public.interesados (user_id, creada_en);

drop policy "registrar interesado" on public.interesados;

create function privado.limitar_solicitudes() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_dia int := public.ajuste_entero('solicitudes_por_dia');
  v_abiertas int := public.ajuste_entero('solicitudes_abiertas_por_vivienda');
begin
  if (select count(*) from public.interesados
      where user_id = new.user_id and creada_en > now() - interval '24 hours') >= v_dia then
    raise exception 'Llegaste al límite de % solicitudes en 24 horas.', v_dia using errcode = 'P0001';
  end if;
  if (select count(*) from public.interesados
      where user_id = new.user_id and vivienda_id = new.vivienda_id and estado <> 'cerrada') >= v_abiertas then
    raise exception 'Ya tienes una solicitud abierta para esta vivienda.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function privado.limitar_solicitudes() from public;
create trigger interesados_limite before insert on public.interesados
  for each row execute function privado.limitar_solicitudes();

grant select, insert (vivienda_id, nombre, telefono, mensaje, user_id) on public.interesados to authenticated;
grant update (estado, atendida_en) on public.interesados to authenticated;

create policy "un cliente con sesion pide visita a su nombre" on public.interesados
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.viviendas v where v.id = vivienda_id and v.publicada));
create policy "cada quien ve sus solicitudes; el admin, todas" on public.interesados
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()));
create policy "solo el admin atiende solicitudes" on public.interesados
  for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- La parte del perfil que esperaba a esta tabla: el admin lee el perfil de
-- quien pidió una visita, y de nadie más.
create policy "el admin lee el perfil de quien pidio visita" on public.perfiles
  for select to authenticated
  using ((select public.es_admin())
         and exists (select 1 from public.interesados i where i.user_id = perfiles.user_id));

-- Los ajustes: los lee admin y gerencia; los cambia el admin.
grant select, update (valor, razon, actualizado_en) on public.ajustes to authenticated;
create policy "admin y gerencia leen ajustes" on public.ajustes
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));
create policy "el admin cambia ajustes" on public.ajustes
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));


-- ═══ 20261023100005_vista_publica.sql ═══
-- 005 · vista pública (falla 1: la ubicación exacta sale al público)
--
-- MEDIDO en la base viva el 2026-10-23: las dos casas de ejemplo están
-- publicadas y `ubicacion` se entrega a anon con 4 y 3 decimales.
--
-- Cómo se cierra, y por qué así y no con una vista de privilegios de dueño:
--   * `ubicacion_publica` es una COLUMNA, calculada por disparador. Cuando
--     `ocultar_ubicacion_exacta` es verdadero, el punto se desplaza entre 80 y
--     150 m en un rumbo fijo para cada vivienda; si es falso, es el exacto.
--   * El desplazamiento es determinista por vivienda (no cambia entre
--     recargas, así que no se puede promediar) y lleva una SAL secreta: sin
--     ella, quien conozca el id y el método podría deshacerlo. La sal vive en
--     `privado.secretos`, que la API no alcanza.
--   * anon y authenticated NO tienen permiso de columna sobre `ubicacion`
--     (002). La vista es de privilegios del que consulta (security_invoker),
--     así que no abre nada que la tabla no abra: no hay puerta lateral.
--   * Lo que se muestra deriva de `publicada` (falla 7): la vista solo trae las
--     publicadas, con su `estado` para que la ficha diga «Apartada» o «Vendida».
--
-- Y lo que esta migración decide del análisis, anotado para Daniel: TODA
-- distancia pública se mide desde el punto público. Si se midiera desde el
-- exacto, tres distancias redondeadas a 50 m bastan para triangular la casa
-- con más precisión que el desplazamiento; y el mapa, que dibuja el radio
-- alrededor del punto público, contradiría al texto (regla de credibilidad).

create table privado.secretos (
  clave text primary key,
  valor text not null,
  creada_en timestamptz not null default now()
);
revoke all on privado.secretos from public, anon, authenticated;
insert into privado.secretos (clave, valor)
values ('sal_ubicacion', encode(extensions.gen_random_bytes(32), 'hex'));

alter table public.viviendas add column ubicacion_publica extensions.geography(Point, 4326);

create function privado.desplazar_punto(p_id uuid, p_punto extensions.geography) returns extensions.geography
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_sal text := (select valor from privado.secretos where clave = 'sal_ubicacion');
  v_h text := md5(p_id::text || v_sal);
  v_rumbo double precision := (abs(('x' || substr(v_h, 1, 8))::bit(32)::bigint) % 3600) / 10.0;
  v_metros double precision := 80 + (abs(('x' || substr(v_h, 9, 8))::bit(32)::bigint) % 7001) / 100.0;
begin
  if v_sal is null then
    raise exception 'Falta la sal de ubicación en privado.secretos: no se publica un punto sin desplazar.';
  end if;
  return extensions.st_project(p_punto, v_metros, radians(v_rumbo));
end $$;
revoke execute on function privado.desplazar_punto(uuid, extensions.geography) from public;

create function privado.poner_ubicacion_publica() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.ocultar_ubicacion_exacta then
    new.ubicacion_publica := privado.desplazar_punto(new.id, new.ubicacion);
  else
    new.ubicacion_publica := new.ubicacion;
  end if;
  return new;
end $$;
revoke execute on function privado.poner_ubicacion_publica() from public;

create trigger viviendas_ubicacion_publica
  before insert or update of ubicacion, ocultar_ubicacion_exacta on public.viviendas
  for each row execute function privado.poner_ubicacion_publica();

update public.viviendas set ocultar_ubicacion_exacta = ocultar_ubicacion_exacta;  -- calcula las que ya existen
alter table public.viviendas alter column ubicacion_publica set not null;
create index viviendas_ubicacion_publica_idx on public.viviendas using gist (ubicacion_publica);

grant select (ubicacion_publica) on public.viviendas to anon, authenticated;

create view public.viviendas_publicas with (security_invoker = true) as
select v.id, v.slug, v.nombre, v.tipo, v.operacion, v.precio_cop, v.administracion_cop,
       v.area_m2, v.habitaciones, v.banos, v.parqueaderos, v.estrato, v.antiguedad_anios,
       v.barrio, v.direccion_aproximada, v.descripcion, v.por_que_comprar,
       v.destacada, v.estado, v.vistas, v.es_ejemplo,
       v.ocultar_ubicacion_exacta as ubicacion_aproximada,
       v.ubicacion_publica as ubicacion,
       extensions.st_y(v.ubicacion_publica::extensions.geometry) as lat,
       extensions.st_x(v.ubicacion_publica::extensions.geometry) as lng,
       v.creada_en, v.actualizada_en
from public.viviendas v
where v.publicada;
comment on view public.viviendas_publicas is
  'Lo que la app pública y el mapa leen. Nunca el punto exacto cuando la vivienda lo oculta.';
grant select on public.viviendas_publicas to anon, authenticated;

-- El admin necesita el punto exacto para el panel. Sale por una función que
-- pregunta el rol, nunca por un permiso de columna (que alcanzaría a toda
-- cuenta con sesión).
create function public.ubicacion_exacta(p_vivienda uuid)
  returns table (lat double precision, lng double precision)
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el admin ve la ubicación exacta.' using errcode = '42501';
  end if;
  return query
    select extensions.st_y(v.ubicacion::extensions.geometry), extensions.st_x(v.ubicacion::extensions.geometry)
    from public.viviendas v where v.id = p_vivienda;
end $$;
revoke execute on function public.ubicacion_exacta(uuid) from public, anon;
grant execute on function public.ubicacion_exacta(uuid) to authenticated;


-- ═══ 20261023100006_mapa_por_area.sql ═══
-- 006 · el mapa pide solo lo que se ve
--
-- viviendas_en_area: las viviendas publicadas dentro del rectángulo visible,
-- con los filtros del buscador. Lee de la vista pública, así que hereda que el
-- punto nunca sea el exacto cuando la vivienda lo oculta.
--
-- La función de puntos de interés por área y zoom (pois_en_area) va en la 009,
-- y no acá como decía la propuesta: usa `activo` y `categorias_poi`, que nacen
-- en esa migración.
--
-- Consultas parametrizadas: la función recibe valores, nunca texto que se pegue
-- en SQL. Sin `execute format`.

create function public.viviendas_en_area(
  p_oeste double precision, p_sur double precision,
  p_este double precision, p_norte double precision,
  p_operacion text default null,
  p_precio_min bigint default null, p_precio_max bigint default null,
  p_habitaciones_min integer default null, p_banos_min integer default null,
  p_tipo text default null,
  p_limite integer default 200)
returns setof public.viviendas_publicas
language sql stable set search_path = '' as $$
  select vp.*
  from public.viviendas_publicas vp
  where vp.ubicacion operator(extensions.&&)
        extensions.st_makeenvelope(p_oeste, p_sur, p_este, p_norte, 4326)::extensions.geography
    and (p_operacion is null or vp.operacion = p_operacion)
    and (p_precio_min is null or vp.precio_cop >= p_precio_min)
    and (p_precio_max is null or vp.precio_cop <= p_precio_max)
    and (p_habitaciones_min is null or vp.habitaciones >= p_habitaciones_min)
    and (p_banos_min is null or vp.banos >= p_banos_min)
    and (p_tipo is null or vp.tipo = p_tipo)
  order by vp.destacada desc, vp.actualizada_en desc
  limit least(greatest(coalesce(p_limite, 200), 1), 500)
$$;
grant execute on function public.viviendas_en_area(double precision, double precision,
  double precision, double precision, text, bigint, bigint, integer, integer, text, integer)
  to anon, authenticated;


-- ═══ 20261023100007_caracteristicas_panoramas.sql ═══
-- 007 · «Lo que ofrece esta vivienda» y el recorrido 360°
--
-- Las panorámicas viven en R2: acá solo la clave y la URL. Una sola panorámica
-- de inicio por vivienda (índice parcial), y un enlace solo une panorámicas de
-- la MISMA vivienda: una flecha que lleve a la cocina de otra casa es un
-- defecto que la base rechaza, no algo que la interfaz tenga que recordar.

create table public.vivienda_caracteristicas (
  id uuid primary key default gen_random_uuid(),
  vivienda_id uuid not null references public.viviendas(id) on delete cascade,
  icono text not null constraint caracteristicas_icono_formato check (icono ~ '^[a-z0-9-]{1,40}$'),
  texto text not null constraint caracteristicas_texto_largo check (char_length(texto) between 1 and 80),
  orden integer not null default 0,
  creada_en timestamptz not null default now()
);
create index vivienda_caracteristicas_vivienda_idx on public.vivienda_caracteristicas (vivienda_id, orden);

create table public.vivienda_panoramas (
  id uuid primary key default gen_random_uuid(),
  vivienda_id uuid not null references public.viviendas(id) on delete cascade,
  nombre text not null constraint panoramas_nombre_largo check (char_length(nombre) between 1 and 40),
  clave_r2 text not null constraint panoramas_clave_unica unique
    constraint panoramas_clave_formato check (clave_r2 ~ '^[a-z0-9/_.-]+\.(webp|jpg|jpeg)$'),
  url text not null constraint panoramas_url_https check (url ~ '^https://'),
  orden integer not null default 0,
  angulo_inicial numeric(6,2) not null default 0
    constraint panoramas_angulo_check check (angulo_inicial >= -360 and angulo_inicial <= 360),
  es_inicio boolean not null default false,
  creada_en timestamptz not null default now()
);
create unique index vivienda_panoramas_un_inicio on public.vivienda_panoramas (vivienda_id) where es_inicio;

create table public.vivienda_panorama_enlaces (
  id uuid primary key default gen_random_uuid(),
  desde_id uuid not null references public.vivienda_panoramas(id) on delete cascade,
  hacia_id uuid not null references public.vivienda_panoramas(id) on delete cascade,
  yaw numeric(6,2) not null constraint enlaces_yaw_check check (yaw >= -360 and yaw <= 360),
  pitch numeric(5,2) not null default 0 constraint enlaces_pitch_check check (pitch >= -90 and pitch <= 90),
  etiqueta text constraint enlaces_etiqueta_largo check (char_length(etiqueta) <= 40),
  creada_en timestamptz not null default now(),
  constraint enlaces_no_a_si_misma check (desde_id <> hacia_id)
);

create function privado.enlace_misma_vivienda() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if (select vivienda_id from public.vivienda_panoramas where id = new.desde_id) is distinct from
     (select vivienda_id from public.vivienda_panoramas where id = new.hacia_id) then
    raise exception 'Un enlace solo une panorámicas de la misma vivienda.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function privado.enlace_misma_vivienda() from public;
create trigger enlaces_misma_vivienda before insert or update on public.vivienda_panorama_enlaces
  for each row execute function privado.enlace_misma_vivienda();

alter table public.vivienda_caracteristicas enable row level security;
alter table public.vivienda_panoramas enable row level security;
alter table public.vivienda_panorama_enlaces enable row level security;

grant select on public.vivienda_caracteristicas, public.vivienda_panoramas,
  public.vivienda_panorama_enlaces to anon, authenticated;
grant insert, update, delete on public.vivienda_caracteristicas, public.vivienda_panoramas,
  public.vivienda_panorama_enlaces to authenticated;

create policy "se ven las de viviendas publicadas" on public.vivienda_caracteristicas
  for select to anon, authenticated
  using (exists (select 1 from public.viviendas v where v.id = vivienda_id and v.publicada));
create policy "admin escribe caracteristicas" on public.vivienda_caracteristicas
  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "se ven las de viviendas publicadas" on public.vivienda_panoramas
  for select to anon, authenticated
  using (exists (select 1 from public.viviendas v where v.id = vivienda_id and v.publicada));
create policy "admin escribe panoramas" on public.vivienda_panoramas
  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "se ven los de viviendas publicadas" on public.vivienda_panorama_enlaces
  for select to anon, authenticated
  using (exists (select 1 from public.vivienda_panoramas p join public.viviendas v on v.id = p.vivienda_id
                 where p.id = desde_id and v.publicada));
create policy "admin escribe enlaces" on public.vivienda_panorama_enlaces
  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));


-- ═══ 20261023100008_fotos_en_r2.sql ═══
-- 008 · las fotos viven en R2
--
-- `ruta` (una ruta del bucket de Supabase) se reemplaza por la clave del objeto
-- en R2 y las tres URL que genera el navegador al subir, en WebP. 0 filas
-- medidas en la base viva el 2026-10-23: no hay nada que migrar.
--
-- «Valida tamaño y formato antes de aceptarlos» (prompt §7): la base es la
-- última barrera, no la única. La función que firma la subida (Fase 3) valida
-- primero. El techo de 5 MB por archivo es un tope duro de la base; el peso que
-- se pide de verdad (mucho menor) lo decide la Fase 3 con medición.

alter table public.vivienda_fotos drop column ruta;
alter table public.vivienda_fotos
  add column clave_r2 text not null
    constraint fotos_clave_unica unique
    constraint fotos_clave_formato check (clave_r2 ~ '^[a-z0-9/_.-]+\.webp$'),
  add column url_miniatura text not null constraint fotos_url_miniatura_https check (url_miniatura ~ '^https://'),
  add column url_mediana text not null constraint fotos_url_mediana_https check (url_mediana ~ '^https://'),
  add column url_grande text not null constraint fotos_url_grande_https check (url_grande ~ '^https://'),
  add column ancho integer not null constraint fotos_ancho_check check (ancho between 1 and 8192),
  add column alto integer not null constraint fotos_alto_check check (alto between 1 and 8192),
  add column peso_bytes integer not null constraint fotos_peso_check check (peso_bytes between 1 and 5242880),
  add column es_portada boolean not null default false,
  add column texto_alternativo text constraint fotos_alt_largo check (char_length(texto_alternativo) <= 160);
create unique index vivienda_fotos_una_portada on public.vivienda_fotos (vivienda_id) where es_portada;
create index vivienda_fotos_vivienda_idx on public.vivienda_fotos (vivienda_id, orden);


-- ═══ 20261023100009_categorias_y_espejo.sql ═══
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


-- ═══ 20261023100010_formula_puntaje.sql ═══
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


-- ═══ 20261023100011_fortalezas.sql ═══
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


-- ═══ 20261023100012_panel.sql ═══
-- 012 · las tablas del panel (prompt 6.2 y 12.1)
--
-- Tres reglas que la base hace cumplir, para que no dependan de la interfaz:
--   * Nadie BORRA desde la app. No hay permiso DELETE en ninguna de estas
--     tablas: una transacción anulada se marca, no se borra.
--   * Nadie EDITA la bitácora ni las interacciones: solo las escriben los
--     disparadores. Gerencia lee todo y no escribe nada.
--   * Lo anónimo y lo identificable van en tablas distintas. `eventos` no lleva
--     usuario, ni IP, ni nada personal: solo un identificador de sesión al azar
--     que genera el navegador. `interacciones` sí va ligada a una cuenta.
--
-- La bitácora no copia datos personales: de `interesados` guarda el cambio de
-- estado y no el nombre ni el teléfono, y de `viviendas` dice que la ubicación
-- cambió sin escribir la coordenada (gerencia lee la bitácora y no debe ver
-- la puerta de la casa).

create table public.transacciones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null constraint transacciones_tipo_check check (tipo in ('ingreso', 'egreso')),
  categoria text not null constraint transacciones_categoria_check check (categoria in
    ('venta', 'arriendo', 'comision', 'cuota_plataforma', 'publicidad', 'hosting', 'otros')),
  monto_cop bigint not null constraint transacciones_monto_check check (monto_cop > 0),
  ocurrida_en timestamptz not null,
  concepto text not null constraint transacciones_concepto_largo check (char_length(concepto) between 1 and 200),
  estado text not null default 'pendiente' constraint transacciones_estado_check
    check (estado in ('pendiente', 'pagada', 'anulada')),
  vivienda_id uuid references public.viviendas(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  pago_programado_id uuid,
  registrada_por uuid not null default auth.uid() references auth.users(id),
  anulada_en timestamptz,
  motivo_anulacion text,
  creada_en timestamptz not null default now(),
  constraint transacciones_anulada_con_motivo check ((estado = 'anulada') = (anulada_en is not null and motivo_anulacion is not null))
);
comment on column public.transacciones.monto_cop is 'Siempre positivo. El signo lo pone el tipo: un egreso resta.';

create table public.pagos_programados (
  id uuid primary key default gen_random_uuid(),
  concepto text not null constraint pagos_concepto_largo check (char_length(concepto) between 1 and 200),
  tipo text not null constraint pagos_tipo_check check (tipo in ('ingreso', 'egreso')),
  categoria text not null constraint pagos_categoria_check check (categoria in
    ('venta', 'arriendo', 'comision', 'cuota_plataforma', 'publicidad', 'hosting', 'otros')),
  monto_cop bigint not null constraint pagos_monto_check check (monto_cop > 0),
  periodicidad text not null constraint pagos_periodicidad_check
    check (periodicidad in ('unica', 'semanal', 'mensual', 'trimestral', 'anual')),
  proxima_fecha date not null,
  dias_aviso integer not null default 3 constraint pagos_aviso_check check (dias_aviso between 0 and 60),
  estado text not null default 'activo' constraint pagos_estado_check check (estado in ('activo', 'pausado', 'terminado')),
  creada_por uuid not null default auth.uid() references auth.users(id),
  creada_en timestamptz not null default now()
);
alter table public.transacciones
  add constraint transacciones_pago_fk foreign key (pago_programado_id) references public.pagos_programados(id) on delete set null;

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null,
  tipo text not null constraint eventos_tipo_check check (tipo in
    ('visita', 'ficha_vista', 'busqueda', 'busqueda_sin_resultados', 'toque_agendar_visita', 'mapa_abierto', 'compartir')),
  vivienda_id uuid references public.viviendas(id) on delete set null,
  ruta text constraint eventos_ruta_largo check (char_length(ruta) <= 300),
  detalle jsonb not null default '{}'::jsonb constraint eventos_detalle_peso check (pg_column_size(detalle) <= 2000),
  creada_en timestamptz not null default now()
);
create index eventos_creada_idx on public.eventos (creada_en);

create table public.interacciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null constraint interacciones_tipo_check check (tipo in
    ('registro', 'confirmacion_correo', 'inicio_sesion', 'ficha_abierta', 'favorito_agregado', 'favorito_quitado',
     'busqueda', 'toque_agendar_visita', 'solicitud_enviada', 'solicitud_cambio_estado',
     'visita_agendada', 'visita_realizada', 'transaccion_registrada')),
  vivienda_id uuid references public.viviendas(id) on delete set null,
  detalle jsonb not null default '{}'::jsonb constraint interacciones_detalle_peso check (pg_column_size(detalle) <= 2000),
  creada_en timestamptz not null default now()
);
create index interacciones_user_idx on public.interacciones (user_id, creada_en desc);

create table public.metricas_diarias (
  fecha date not null,
  metrica text not null,
  dimension text not null default '',
  valor bigint not null,
  calculada_en timestamptz not null default now(),
  primary key (fecha, metrica, dimension)
);

create table public.bitacora (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  registro_id text,
  accion text not null constraint bitacora_accion_check check (accion in ('crear', 'editar', 'borrar')),
  cambios jsonb not null default '{}'::jsonb,
  actor uuid,
  creada_en timestamptz not null default now()
);
create index bitacora_creada_idx on public.bitacora (creada_en desc);

-- La bitácora, por disparador. TG_ARGV lleva las columnas que NO se copian:
-- se dice que cambiaron, sin el valor.
create function privado.anotar_bitacora() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_nuevo jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_viejo jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_cambios jsonb := '{}'::jsonb;
  v_clave text;
  v_ocultas text[] := coalesce(tg_argv, '{}');
begin
  for v_clave in select jsonb_object_keys(coalesce(v_nuevo, v_viejo)) loop
    if v_clave in ('actualizada_en', 'creada_en') then continue; end if;
    if tg_op = 'UPDATE' and (v_nuevo -> v_clave) is not distinct from (v_viejo -> v_clave) then continue; end if;
    v_cambios := v_cambios || jsonb_build_object(v_clave,
      case when v_clave = any (v_ocultas) then to_jsonb('(cambió; el valor no se guarda)'::text)
           when tg_op = 'DELETE' then v_viejo -> v_clave
           else v_nuevo -> v_clave end);
  end loop;
  if tg_op = 'UPDATE' and v_cambios = '{}'::jsonb then return null; end if;
  insert into public.bitacora (tabla, registro_id, accion, cambios, actor)
  values (tg_table_name, coalesce(v_nuevo, v_viejo) ->> 'id',
          case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'editar' else 'borrar' end,
          v_cambios, auth.uid());
  return null;
end $$;
revoke execute on function privado.anotar_bitacora() from public;

create trigger bitacora_viviendas after insert or update or delete on public.viviendas
  for each row execute function privado.anotar_bitacora('ubicacion', 'ubicacion_publica');
create trigger bitacora_fotos after insert or update or delete on public.vivienda_fotos
  for each row execute function privado.anotar_bitacora();
create trigger bitacora_transacciones after insert or update or delete on public.transacciones
  for each row execute function privado.anotar_bitacora();
create trigger bitacora_pagos after insert or update or delete on public.pagos_programados
  for each row execute function privado.anotar_bitacora();
create trigger bitacora_roles after insert or update or delete on public.roles_usuario
  for each row execute function privado.anotar_bitacora();
create trigger bitacora_formulas after insert or update on public.formulas_puntaje
  for each row execute function privado.anotar_bitacora();
create trigger bitacora_categorias after insert or update or delete on public.categorias_poi
  for each row execute function privado.anotar_bitacora();
create trigger bitacora_ajustes after insert or update on public.ajustes
  for each row execute function privado.anotar_bitacora();
create trigger bitacora_interesados after update of estado, atendida_en on public.interesados
  for each row execute function privado.anotar_bitacora('nombre', 'telefono', 'mensaje', 'user_id');

-- Las interacciones que la base sabe sola: registro, solicitud enviada, cambio
-- de estado de una solicitud, transacción ligada a un usuario.
create function privado.anotar_interaccion() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'perfiles' then
    insert into public.interacciones (user_id, tipo) values (new.user_id, 'registro');
  elsif tg_table_name = 'interesados' and tg_op = 'INSERT' then
    insert into public.interacciones (user_id, tipo, vivienda_id, detalle)
    values (new.user_id, 'solicitud_enviada', new.vivienda_id, jsonb_build_object('solicitud', new.id));
  elsif tg_table_name = 'interesados' then
    insert into public.interacciones (user_id, tipo, vivienda_id, detalle)
    values (new.user_id, 'solicitud_cambio_estado', new.vivienda_id,
            jsonb_build_object('solicitud', new.id, 'de', old.estado, 'a', new.estado));
  elsif tg_table_name = 'transacciones' and new.user_id is not null then
    insert into public.interacciones (user_id, tipo, vivienda_id, detalle)
    values (new.user_id, 'transaccion_registrada', new.vivienda_id,
            jsonb_build_object('transaccion', new.id, 'tipo', new.tipo, 'ocurrida_en', new.ocurrida_en));
  end if;
  return null;
end $$;
revoke execute on function privado.anotar_interaccion() from public;
create trigger interacciones_registro after insert on public.perfiles
  for each row execute function privado.anotar_interaccion();
create trigger interacciones_solicitud after insert on public.interesados
  for each row execute function privado.anotar_interaccion();
create trigger interacciones_solicitud_estado after update of estado on public.interesados
  for each row when (old.estado is distinct from new.estado) execute function privado.anotar_interaccion();
create trigger interacciones_transaccion after insert on public.transacciones
  for each row execute function privado.anotar_interaccion();

-- Pagar un pago programado: crea la transacción pagada y mueve la fecha.
create function public.registrar_pago(p_pago uuid) returns uuid
  language plpgsql set search_path = '' as $$
declare p public.pagos_programados; v_tx uuid;
begin
  if not public.es_admin() then raise exception 'Solo el admin registra pagos.' using errcode = '42501'; end if;
  select * into p from public.pagos_programados where id = p_pago and estado = 'activo' for update;
  if not found then raise exception 'No hay un pago activo con ese id.'; end if;
  insert into public.transacciones (tipo, categoria, monto_cop, ocurrida_en, concepto, estado, pago_programado_id)
  values (p.tipo, p.categoria, p.monto_cop, now(), p.concepto, 'pagada', p.id) returning id into v_tx;
  update public.pagos_programados set
    proxima_fecha = case p.periodicidad
      when 'semanal' then p.proxima_fecha + 7
      when 'mensual' then (p.proxima_fecha + interval '1 month')::date
      when 'trimestral' then (p.proxima_fecha + interval '3 months')::date
      when 'anual' then (p.proxima_fecha + interval '1 year')::date
      else p.proxima_fecha end,
    estado = case when p.periodicidad = 'unica' then 'terminado' else 'activo' end
  where id = p.id;
  return v_tx;
end $$;
revoke execute on function public.registrar_pago(uuid) from public, anon;
grant execute on function public.registrar_pago(uuid) to authenticated;

alter table public.transacciones enable row level security;
alter table public.pagos_programados enable row level security;
alter table public.eventos enable row level security;
alter table public.interacciones enable row level security;
alter table public.metricas_diarias enable row level security;
alter table public.bitacora enable row level security;

-- Lectura: admin y gerencia. Escritura: el admin, sin DELETE.
grant select on public.transacciones, public.pagos_programados, public.eventos,
  public.interacciones, public.metricas_diarias, public.bitacora to authenticated;
grant insert (tipo, categoria, monto_cop, ocurrida_en, concepto, estado, vivienda_id, user_id),
      update (estado, anulada_en, motivo_anulacion, concepto)
  on public.transacciones to authenticated;
grant insert (concepto, tipo, categoria, monto_cop, periodicidad, proxima_fecha, dias_aviso, estado),
      update (concepto, monto_cop, periodicidad, proxima_fecha, dias_aviso, estado)
  on public.pagos_programados to authenticated;

create policy "admin y gerencia leen transacciones" on public.transacciones
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));
create policy "admin registra transacciones" on public.transacciones
  for insert to authenticated with check ((select public.es_admin()) and registrada_por = (select auth.uid()));
create policy "admin corrige o anula transacciones" on public.transacciones
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "admin y gerencia leen pagos" on public.pagos_programados
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));
create policy "admin programa pagos" on public.pagos_programados
  for insert to authenticated with check ((select public.es_admin()) and creada_por = (select auth.uid()));
create policy "admin edita pagos" on public.pagos_programados
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

-- Los eventos anónimos los escribe cualquier visitante, sin usuario. Los leen
-- admin y gerencia.
grant insert (sesion_id, tipo, vivienda_id, ruta, detalle) on public.eventos to anon, authenticated;
create policy "cualquiera registra un evento anonimo" on public.eventos
  for insert to anon, authenticated with check (true);
create policy "admin y gerencia leen eventos" on public.eventos
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));

-- Las interacciones del lado del cliente (ficha abierta, favorito, búsqueda,
-- toque en «Agendar visita») las escribe la persona, a su nombre y solo de esos
-- tipos; las demás, los disparadores.
grant insert (user_id, tipo, vivienda_id, detalle) on public.interacciones to authenticated;
create policy "cada quien anota sus interacciones de cliente" on public.interacciones
  for insert to authenticated
  with check (user_id = (select auth.uid()) and tipo in
    ('inicio_sesion', 'ficha_abierta', 'favorito_agregado', 'favorito_quitado', 'busqueda', 'toque_agendar_visita'));
create policy "admin y gerencia leen interacciones" on public.interacciones
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));

create policy "admin y gerencia leen metricas" on public.metricas_diarias
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));
create policy "admin y gerencia leen la bitacora" on public.bitacora
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));


-- ═══ 20261023100013_anunciantes_base.sql ═══
-- 013 · la base para los anunciantes (prompt 12.2), sin construir la versión
--
-- La versión para anunciantes se construye en la Fase 7 y espera decisiones de
-- Daniel (pago, verificación, condiciones legales). Lo que se deja listo acá es
-- solo lo que la base tiene que hacer cumplir desde ahora:
--   * una vivienda sin propietario es de URBIS; con propietario, de un
--     particular, y la ficha lo dice (`de_particular`, calculada, nunca escrita);
--   * el anunciante ve y edita SOLO lo suyo, y solo en borrador o rechazado;
--   * solo el admin publica, rechaza o revisa: un anunciante no puede tocar
--     `publicada`, `revisada_por`, `revisada_en` ni `motivo_rechazo`;
--   * el rol anunciante se obtiene aceptando los términos, con su función.

alter table public.viviendas
  add column propietario_id uuid references auth.users(id) on delete set null,
  add column estado_revision text constraint viviendas_revision_check check (estado_revision in
    ('borrador', 'en_revision', 'publicado', 'rechazado', 'pausado', 'cerrado')),
  add column motivo_rechazo text,
  add column revisada_por uuid references auth.users(id) on delete set null,
  add column revisada_en timestamptz,
  add column de_particular boolean generated always as (propietario_id is not null) stored,
  add constraint viviendas_particular_con_revision check (propietario_id is null or estado_revision is not null),
  add constraint viviendas_rechazo_con_motivo check (estado_revision is distinct from 'rechazado' or motivo_rechazo is not null);
create index viviendas_propietario_idx on public.viviendas (propietario_id) where propietario_id is not null;

grant select (de_particular) on public.viviendas to anon, authenticated;
-- El anunciante tiene que ver en qué va SU anuncio y por qué se rechazó. El
-- permiso es de columna para toda cuenta con sesión, pero la fila la decide la
-- política: un anuncio rechazado o en revisión solo lo ven su dueño y el admin.
-- `propietario_id` NO se abre: diría qué cuenta vende cada vivienda publicada.
grant select (estado_revision, motivo_rechazo, revisada_en) on public.viviendas to authenticated;

create or replace view public.viviendas_publicas with (security_invoker = true) as
select v.id, v.slug, v.nombre, v.tipo, v.operacion, v.precio_cop, v.administracion_cop,
       v.area_m2, v.habitaciones, v.banos, v.parqueaderos, v.estrato, v.antiguedad_anios,
       v.barrio, v.direccion_aproximada, v.descripcion, v.por_que_comprar,
       v.destacada, v.estado, v.vistas, v.es_ejemplo,
       v.ocultar_ubicacion_exacta as ubicacion_aproximada,
       v.ubicacion_publica as ubicacion,
       extensions.st_y(v.ubicacion_publica::extensions.geometry) as lat,
       extensions.st_x(v.ubicacion_publica::extensions.geometry) as lng,
       v.creada_en, v.actualizada_en,
       v.de_particular
from public.viviendas v
where v.publicada;

-- Lo que un anunciante NO puede cambiar, aunque la política le deje la fila.
create function privado.proteger_revision() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if public.es_admin() or current_user in ('postgres', 'service_role') then return new; end if;
  if tg_op = 'INSERT' then
    if new.publicada or new.revisada_por is not null or new.revisada_en is not null or new.motivo_rechazo is not null
       or new.destacada or new.es_ejemplo or new.estado_revision is distinct from 'borrador' then
      raise exception 'Un anuncio nuevo nace en borrador y sin revisar.' using errcode = '42501';
    end if;
  elsif new.publicada is distinct from old.publicada or new.revisada_por is distinct from old.revisada_por
     or new.revisada_en is distinct from old.revisada_en or new.motivo_rechazo is distinct from old.motivo_rechazo
     or new.destacada is distinct from old.destacada or new.es_ejemplo is distinct from old.es_ejemplo
     or new.propietario_id is distinct from old.propietario_id
     or (new.estado_revision is distinct from old.estado_revision and new.estado_revision <> 'en_revision') then
    raise exception 'Solo el admin publica, revisa o rechaza un anuncio.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger viviendas_proteger_revision before insert or update on public.viviendas
  for each row execute function privado.proteger_revision();

create policy "el anunciante ve lo suyo" on public.viviendas
  for select to authenticated using (propietario_id = (select auth.uid()));
create policy "el anunciante crea borradores" on public.viviendas
  for insert to authenticated
  with check ((select public.es_anunciante()) and propietario_id = (select auth.uid()));
create policy "el anunciante edita en borrador o rechazado" on public.viviendas
  for update to authenticated
  using (propietario_id = (select auth.uid()) and estado_revision in ('borrador', 'rechazado'))
  with check (propietario_id = (select auth.uid()) and estado_revision in ('borrador', 'rechazado', 'en_revision'));

-- El rol de anunciante, a cambio de aceptar los términos.
create function public.hacerme_anunciante() returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Hace falta una sesión.' using errcode = '42501'; end if;
  update public.perfiles set acepto_terminos_anunciante_en = now()
  where user_id = auth.uid() and acepto_terminos_anunciante_en is null;
  insert into public.roles_usuario (user_id, rol) values (auth.uid(), 'anunciante')
  on conflict (user_id, rol) do nothing;
end $$;
revoke execute on function public.hacerme_anunciante() from public, anon;
grant execute on function public.hacerme_anunciante() to authenticated;


-- ═══ 20261023100014_retiro_bucket.sql ═══
-- 014 · el retiro del bucket `viviendas-fotos`
--
-- Las imágenes van a R2 (decisión 3-02). MEDIDO en la base viva el
-- 2026-10-23: el bucket es público y tiene 0 objetos.
--
-- Supabase prohíbe borrar de las tablas de storage por SQL (disparador
-- storage.protect_delete) y deja hacerlo declarando storage.allow_delete_query
-- en la sesión. La protección existe para no dejar objetos huérfanos; por eso
-- esta migración COMPRUEBA primero que el bucket siga vacío y, si no lo está,
-- se detiene sin borrar nada. Un bucket con archivos se retira por la API de
-- Storage, que borra los archivos con él, nunca desde acá.

do $$
declare n bigint;
begin
  if not exists (select 1 from storage.buckets where id = 'viviendas-fotos') then
    raise notice 'El bucket viviendas-fotos ya no existe: nada que retirar.';
    return;
  end if;
  select count(*) into n from storage.objects where bucket_id = 'viviendas-fotos';
  if n > 0 then
    raise exception 'El bucket viviendas-fotos tiene % objetos: no se retira por SQL. Vacíalo por la API de Storage.', n;
  end if;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = 'viviendas-fotos';
  perform set_config('storage.allow_delete_query', 'false', true);
end $$;


-- ═══ datos/ejemplo.sql ═══
-- DATOS DE EJEMPLO · las seis viviendas de las maquetas (ESPEC.md §6), para que
-- la plataforma de la Fase 2 tenga con qué pintarse.
--
-- TODO lo de este archivo es de ejemplo y lo dice: las viviendas llevan
-- `es_ejemplo = true` y los puntos `fuente = 'ejemplo'`. Las coordenadas son
-- INVENTADAS, puestas a ojo dentro de Cúcuta, y no son las de esos barrios: el
-- nombre del barrio es el de la maqueta, la posición no es un dato. Se borra
-- todo con:
--     select public.borrar_datos_de_ejemplo();
--
-- Es idempotente: empieza borrando lo de ejemplo que haya (también las dos
-- casas del esquema inicial, que contaban como venta y habrían hecho decir a la
-- Home «7 viviendas en venta» con 5 en la maqueta).

select public.borrar_datos_de_ejemplo();

with nuevas (n, nombre, barrio, tipo, operacion, precio, hab, banos, parq, area, estrato, lat, lng, destacada, descripcion) as (values
  (1, 'Casa de dos pisos con patio', 'Caobos', 'Casa', 'venta', 285000000, 3, 2, 1, 120, 4, 7.9005, -72.4990, true,
      'Casa de dos pisos con patio trasero, cocina abierta y terraza.'),
  (2, 'Apartamento con balcón', 'La Riviera', 'Apartamento', 'venta', 210000000, 2, 1, 0, 68, 4, 7.9080, -72.4930, false,
      'Apartamento en tercer piso con balcón y buena ventilación.'),
  (3, 'Casa esquinera remodelada', 'Prados del Este', 'Casa', 'venta', 340000000, 4, 3, 2, 160, 5, 7.8960, -72.4800, true,
      'Casa esquinera remodelada, con dos parqueaderos y jardín.'),
  (4, 'Apartaestudio amoblado', 'Quinta Oriental', 'Apartamento', 'arriendo', 1200000, 1, 1, 0, 42, 4, 7.8890, -72.4960, false,
      'Apartaestudio amoblado, listo para entrar a vivir.'),
  (5, 'Casa de un piso con garaje', 'Los Pinos', 'Casa', 'venta', 198000000, 3, 2, 1, 98, 3, 7.8820, -72.5050, false,
      'Casa de un piso con garaje cubierto y patio de ropas.'),
  (6, 'Apartamento en torre con piscina', 'Ceiba II', 'Apartamento', 'venta', 265000000, 3, 2, 1, 84, 4, 7.9150, -72.5000, false,
      'Apartamento en torre con piscina, gimnasio y portería.'))
insert into public.viviendas (nombre, barrio, tipo, operacion, precio_cop, habitaciones, banos, parqueaderos,
  area_m2, estrato, ubicacion, destacada, descripcion, publicada, es_ejemplo, ocultar_ubicacion_exacta)
select nombre, barrio, tipo, operacion, precio, hab, banos, parq, area, estrato,
       extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
       destacada, descripcion, true, true, true
from nuevas order by n;

-- Los puntos de ejemplo, a distancias y rumbos fijos de cada vivienda.
with patron (subcategoria, categoria, metros, rumbo) as (values
  ('Colegio', 'educacion', 400, 20), ('Jardín infantil', 'educacion', 650, 200),
  ('Ruta de bus', 'transporte', 150, 110), ('Paradero', 'transporte', 420, 290),
  ('Supermercado', 'comercio', 300, 70), ('Tienda', 'comercio', 120, 160), ('Droguería', 'comercio', 520, 330),
  ('Parque', 'zonas_verdes', 450, 250))
insert into public.puntos_interes (nombre, subcategoria, categoria, ubicacion, fuente, modulo_origen)
select p.subcategoria || ' de ejemplo · ' || v.barrio, p.subcategoria, p.categoria,
       extensions.st_project(v.ubicacion, p.metros, radians(p.rumbo)), 'ejemplo', 'ejemplo'
from public.viviendas v cross join patron p
where v.es_ejemplo;

select public.calcular_analisis_ubicacion(id) from public.viviendas where es_ejemplo;
select public.generar_fortalezas(id) from public.viviendas where es_ejemplo;

insert into public.vivienda_caracteristicas (vivienda_id, icono, texto, orden)
select v.id, c.icono, c.texto, c.orden
from public.viviendas v
cross join (values ('cocina', 'Cocina integral', 1), ('ventilacion', 'Buena ventilación', 2),
                   ('agua', 'Agua caliente', 3)) as c(icono, texto, orden)
where v.es_ejemplo;

commit;

-- La medida de que entró todo: debe salir 22 tablas, 6 viviendas de ejemplo
-- (5 en venta y 1 en arriendo), el bucket retirado y la sal de ubicación puesta.
select (select count(*) from pg_tables where schemaname = 'public') as tablas,
       (select count(*) from public.viviendas where es_ejemplo and operacion = 'venta') as en_venta,
       (select count(*) from public.viviendas where es_ejemplo and operacion = 'arriendo') as en_arriendo,
       (select count(*) from storage.buckets where id = 'viviendas-fotos') as bucket_viejo,
       (select count(*) from privado.secretos where clave = 'sal_ubicacion') as sal_puesta;
