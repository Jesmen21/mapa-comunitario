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
