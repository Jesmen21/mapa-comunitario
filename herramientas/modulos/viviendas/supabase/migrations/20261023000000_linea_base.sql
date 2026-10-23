-- LÍNEA BASE · el esquema que Daniel aplicó a mano con urbis_viviendas.sql,
-- copiado tal cual, sin la consulta final de verificación.
-- En la base viva NO se aplica: ya está. Existe para que una base nueva (la
-- local de pruebas o una rama) empiece desde el mismo punto que la viva.
-- Comprobado contra la base viva el 2026-10-23: mismas 5 tablas, columnas,
-- políticas, función y bucket.

create extension if not exists postgis with schema extensions;

-- 1. Viviendas
create table public.viviendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text,
  precio_cop bigint not null check (precio_cop >= 0),
  area_m2 numeric(8,2),
  habitaciones int,
  banos int,
  parqueaderos int default 0,
  barrio text,
  ubicacion extensions.geography(Point, 4326) not null,
  estado text not null default 'disponible'
    check (estado in ('disponible', 'apartada', 'vendida')),
  publicada boolean not null default false,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
create index viviendas_ubicacion_idx on public.viviendas using gist (ubicacion);

-- 2. Fotos (los archivos van en el bucket viviendas-fotos)
create table public.vivienda_fotos (
  id uuid primary key default gen_random_uuid(),
  vivienda_id uuid not null references public.viviendas(id) on delete cascade,
  ruta text not null,
  orden int not null default 0,
  creada_en timestamptz not null default now()
);

-- 3. Puntos de interés del entorno
create table public.puntos_interes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null
    check (categoria in ('educacion', 'transporte', 'comercio', 'zonas_verdes')),
  ubicacion extensions.geography(Point, 4326) not null,
  fuente text,
  creada_en timestamptz not null default now()
);
create index puntos_interes_ubicacion_idx on public.puntos_interes using gist (ubicacion);

-- 4. Análisis de ubicación (guarda cada corrida con su fecha y radio)
create table public.analisis_ubicacion (
  id uuid primary key default gen_random_uuid(),
  vivienda_id uuid not null references public.viviendas(id) on delete cascade,
  radio_m int not null default 500,
  puntaje_total int not null,
  detalle jsonb not null,
  calculado_en timestamptz not null default now()
);

-- 5. Interesados (datos personales: solo se puede insertar, nunca leer desde la app)
create table public.interesados (
  id uuid primary key default gen_random_uuid(),
  vivienda_id uuid not null references public.viviendas(id) on delete cascade,
  nombre text not null,
  telefono text not null,
  mensaje text,
  creada_en timestamptz not null default now()
);

-- Cálculo del análisis (fórmula provisional: 25 puntos por punto cercano, máximo 100)
create or replace function public.calcular_analisis_ubicacion(p_vivienda uuid, p_radio int default 500)
returns void
language plpgsql
set search_path = public, extensions
as $$
declare
  v_punto geography;
  v_detalle jsonb;
  v_total int;
begin
  select ubicacion into v_punto from public.viviendas where id = p_vivienda;

  select coalesce(jsonb_object_agg(cat, puntaje), '{}'::jsonb) into v_detalle
  from (
    select c.cat, least(100, count(p.id) * 25)::int as puntaje
    from (values ('educacion'), ('transporte'), ('comercio'), ('zonas_verdes')) as c(cat)
    left join public.puntos_interes p
      on p.categoria = c.cat and st_dwithin(p.ubicacion, v_punto, p_radio)
    group by c.cat
  ) t;

  select coalesce(round(avg(value::int)), 0)::int into v_total
  from jsonb_each_text(v_detalle);

  insert into public.analisis_ubicacion (vivienda_id, radio_m, puntaje_total, detalle)
  values (p_vivienda, p_radio, v_total, v_detalle);
end;
$$;
revoke execute on function public.calcular_analisis_ubicacion(uuid, int) from public, anon, authenticated;

-- Seguridad: RLS en todas las tablas
alter table public.viviendas enable row level security;
alter table public.vivienda_fotos enable row level security;
alter table public.puntos_interes enable row level security;
alter table public.analisis_ubicacion enable row level security;
alter table public.interesados enable row level security;

grant select on public.viviendas, public.vivienda_fotos,
  public.puntos_interes, public.analisis_ubicacion to anon, authenticated;
grant insert on public.interesados to anon, authenticated;
grant all on all tables in schema public to service_role;

create policy "ver viviendas publicadas" on public.viviendas
  for select to anon, authenticated using (publicada);

create policy "ver fotos de viviendas publicadas" on public.vivienda_fotos
  for select to anon, authenticated
  using (exists (select 1 from public.viviendas v where v.id = vivienda_id and v.publicada));

create policy "ver puntos de interes" on public.puntos_interes
  for select to anon, authenticated using (true);

create policy "ver analisis de viviendas publicadas" on public.analisis_ubicacion
  for select to anon, authenticated
  using (exists (select 1 from public.viviendas v where v.id = vivienda_id and v.publicada));

create policy "registrar interesado" on public.interesados
  for insert to anon, authenticated with check (true);

-- Bucket público para fotos
insert into storage.buckets (id, name, public)
values ('viviendas-fotos', 'viviendas-fotos', true)
on conflict (id) do nothing;

-- Datos de ejemplo (borrar cuando cargues los reales)
insert into public.viviendas (nombre, tipo, precio_cop, area_m2, habitaciones, banos, parqueaderos, barrio, ubicacion, publicada)
values
  ('Casa tipo A', 'Casa', 285000000, 78, 3, 2, 1, 'Barrio ejemplo',
   st_setsrid(st_makepoint(-72.5078, 7.8939), 4326)::geography, true),
  ('Casa tipo B', 'Casa', 210000000, 56, 2, 1, 0, 'Barrio ejemplo',
   st_setsrid(st_makepoint(-72.5060, 7.8950), 4326)::geography, true);

insert into public.puntos_interes (nombre, categoria, ubicacion, fuente)
values
  ('Colegio ejemplo', 'educacion', st_setsrid(st_makepoint(-72.5105, 7.8955), 4326)::geography, 'ejemplo'),
  ('Paradero ejemplo', 'transporte', st_setsrid(st_makepoint(-72.5070, 7.8935), 4326)::geography, 'ejemplo'),
  ('Parque ejemplo', 'zonas_verdes', st_setsrid(st_makepoint(-72.5085, 7.8915), 4326)::geography, 'ejemplo'),
  ('Tienda ejemplo', 'comercio', st_setsrid(st_makepoint(-72.5050, 7.8945), 4326)::geography, 'ejemplo'),
  ('Supermercado ejemplo', 'comercio', st_setsrid(st_makepoint(-72.5090, 7.8960), 4326)::geography, 'ejemplo');

select public.calcular_analisis_ubicacion(id) from public.viviendas;
