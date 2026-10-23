-- 002 · roles
-- La tabla de roles, las funciones es_admin / es_gerencia / es_anunciante, y el
-- cierre de los permisos que hoy están abiertos.
--
-- MEDIDO en la base viva el 2026-10-23: anon y authenticated tienen TODOS los
-- permisos de tabla en las cinco tablas (también TRUNCATE, TRIGGER y
-- REFERENCES, que la seguridad por fila no frena), y los privilegios por
-- defecto del esquema se los dan a cualquier tabla o función nueva. Es lo que
-- Supabase trae de fábrica. La regla aprobada es «toda escritura exige rol»,
-- y con permisos así de anchos la única barrera sería la política: un olvido
-- en una sola tabla nueva la dejaría abierta. Desde acá se invierte: nada se
-- concede por omisión y cada migración concede lo suyo, por columna cuando
-- hace falta. Falla cerrado.

-- 1 · Cerrar lo abierto, y que lo nuevo nazca cerrado.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 2 · Un esquema privado, que la API no expone, para lo que corre con
-- privilegios de dueño.
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated, service_role;

-- 3 · Los roles. Un usuario puede tener varios. `cliente` es el de toda
-- cuenta y no hace falta escribirlo; ser cliente nunca da otro permiso.
create table public.roles_usuario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null constraint roles_usuario_rol_check
    check (rol in ('cliente', 'anunciante', 'gerencia', 'admin')),
  asignado_por uuid references auth.users(id) on delete set null,
  creada_en timestamptz not null default now(),
  constraint roles_usuario_unico unique (user_id, rol)
);
alter table public.roles_usuario enable row level security;

-- La consulta del rol corre con privilegios de dueño para que la política de
-- roles_usuario pueda preguntar «¿es admin?» sin llamarse a sí misma.
create function privado.tiene_rol(p_rol text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.roles_usuario r
                 where r.user_id = (select auth.uid()) and r.rol = p_rol)
$$;
revoke execute on function privado.tiene_rol(text) from public;
grant execute on function privado.tiene_rol(text) to authenticated;

-- Admin y gerencia exigen la sesión con el segundo paso (TOTP, nivel aal2):
-- sin él, el rol existe y no da ningún permiso (prompt 6.5).
create function public.sesion_con_dos_pasos() returns boolean
  language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;
create function public.es_admin() returns boolean
  language sql stable set search_path = '' as $$
  select privado.tiene_rol('admin') and public.sesion_con_dos_pasos()
$$;
create function public.es_gerencia() returns boolean
  language sql stable set search_path = '' as $$
  select privado.tiene_rol('gerencia') and public.sesion_con_dos_pasos()
$$;
create function public.es_anunciante() returns boolean
  language sql stable set search_path = '' as $$
  select privado.tiene_rol('anunciante')
$$;
grant execute on function public.sesion_con_dos_pasos(), public.es_admin(),
  public.es_gerencia(), public.es_anunciante() to authenticated;

grant select on public.roles_usuario to authenticated;
grant insert (user_id, rol, asignado_por), delete on public.roles_usuario to authenticated;

create policy "cada quien ve sus roles; el admin, todos" on public.roles_usuario
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()));
-- Solo el admin asigna gerencia y admin; el rol anunciante se obtiene con su
-- función (013), nunca escribiendo acá.
create policy "solo el admin asigna roles" on public.roles_usuario
  for insert to authenticated
  with check ((select public.es_admin()) and rol in ('gerencia', 'admin')
              and asignado_por = (select auth.uid()));
create policy "solo el admin retira roles" on public.roles_usuario
  for delete to authenticated using ((select public.es_admin()));

-- 4 · Lo que el público SÍ puede leer de las tablas que ya existían.
-- viviendas: todas las columnas MENOS `ubicacion`, que es la puerta de la casa.
-- La ubicación pública llega en la 005.
grant select (id, nombre, tipo, precio_cop, area_m2, habitaciones, banos,
  parqueaderos, barrio, estado, publicada, creada_en, actualizada_en,
  operacion, slug, descripcion, por_que_comprar, administracion_cop, estrato,
  antiguedad_anios, destacada, direccion_aproximada, ocultar_ubicacion_exacta,
  vistas, es_ejemplo)
  on public.viviendas to anon, authenticated;
grant select on public.vivienda_fotos, public.puntos_interes to anon, authenticated;

-- El admin escribe viviendas y fotos. La política decide la fila; el permiso
-- de columna decide qué columnas.
grant insert, update, delete on public.viviendas, public.vivienda_fotos to authenticated;
create policy "admin escribe viviendas" on public.viviendas
  for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "admin y gerencia ven todas las viviendas" on public.viviendas
  for select to authenticated using ((select public.es_admin()) or (select public.es_gerencia()));
create policy "admin escribe fotos" on public.vivienda_fotos
  for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- 5 · Las funciones que ya existían vuelven a tener dueño claro.
-- rls_auto_enable devuelve event_trigger y no se puede invocar por la API,
-- pero corre con privilegios de dueño y el auditor de Supabase lo marca: se le
-- quita la ejecución a todos menos al dueño.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
