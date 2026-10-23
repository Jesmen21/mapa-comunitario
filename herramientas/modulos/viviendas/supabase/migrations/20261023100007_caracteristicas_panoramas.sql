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
