-- 001 · viviendas_campos
-- Los campos que pide el prompt (sección 7), el disparador de actualizada_en
-- (falla 6) y la marca de los datos de ejemplo (falla 5).
--
-- Regla del proyecto que esta migración cuida: una cifra sin medir es NULL y
-- un cero es un cero medido. Por eso ningún campo numérico nuevo lleva valor
-- por omisión, y a `parqueaderos` se le QUITA el `default 0` que traía: con él,
-- una vivienda cargada sin ese dato publicaba «0 parqueaderos», que es una
-- afirmación, no un vacío. Las dos filas que ya existen conservan su valor.

alter table public.viviendas
  add column operacion text not null default 'venta'
    constraint viviendas_operacion_check check (operacion in ('venta', 'arriendo')),
  add column slug text,
  add column descripcion text,
  add column por_que_comprar text,
  add column administracion_cop bigint
    constraint viviendas_administracion_check check (administracion_cop >= 0),
  add column estrato smallint
    constraint viviendas_estrato_check check (estrato between 1 and 6),
  add column antiguedad_anios smallint
    constraint viviendas_antiguedad_check check (antiguedad_anios between 0 and 300),
  add column destacada boolean not null default false,
  add column direccion_aproximada text,
  add column ocultar_ubicacion_exacta boolean not null default true,
  add column vistas integer not null default 0
    constraint viviendas_vistas_check check (vistas >= 0),
  add column es_ejemplo boolean not null default false;

alter table public.viviendas alter column parqueaderos drop default;

alter table public.viviendas
  add constraint viviendas_cantidades_check check (
    (habitaciones is null or habitaciones >= 0) and
    (banos is null or banos >= 0) and
    (parqueaderos is null or parqueaderos >= 0) and
    (area_m2 is null or area_m2 > 0));

comment on column public.viviendas.precio_cop is
  'En venta, el precio de venta. En arriendo, el canon mensual.';
comment on column public.viviendas.administracion_cop is
  'Cuota mensual de administración. NULL = sin dato; 0 = no paga. Sirve para venta y arriendo.';
comment on column public.viviendas.es_ejemplo is
  'Dato de ejemplo. Se borra entero con select public.borrar_datos_de_ejemplo();';

-- El slug: legible y único. Se arma del nombre más seis caracteres del id, así
-- que dos viviendas con el mismo nombre no chocan.
create function public.slug_de(p_texto text) returns text
  language sql immutable set search_path = '' as $$
  select nullif(trim(both '-' from regexp_replace(
           translate(lower(coalesce(p_texto, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou'),
           '[^a-z0-9]+', '-', 'g')), '')
$$;

create function public.viviendas_poner_slug() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := coalesce(public.slug_de(new.nombre), 'vivienda') || '-' ||
                substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  return new;
end $$;

create trigger viviendas_slug before insert or update of slug on public.viviendas
  for each row execute function public.viviendas_poner_slug();

update public.viviendas set slug = null;   -- dispara el slug en las filas que ya existen
alter table public.viviendas
  alter column slug set not null,
  add constraint viviendas_slug_unico unique (slug),
  add constraint viviendas_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- actualizada_en se mueve sola.
create function public.tocar_actualizada_en() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.actualizada_en := now();
  return new;
end $$;

create trigger viviendas_actualizada_en before update on public.viviendas
  for each row execute function public.tocar_actualizada_en();

-- Las dos casas que trajo el esquema inicial son de ejemplo (prompt §11).
update public.viviendas set es_ejemplo = true where barrio = 'Barrio ejemplo';

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
