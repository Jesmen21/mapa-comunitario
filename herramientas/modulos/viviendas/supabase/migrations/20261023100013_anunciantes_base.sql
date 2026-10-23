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
