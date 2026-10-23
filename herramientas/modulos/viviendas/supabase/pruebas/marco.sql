-- MARCO DE PRUEBAS · solo para pruebas, nunca se aplica a la base viva.
--
-- pr.ok(nombre, condición, detalle) imprime «ok · nombre» o «FALLA · nombre — detalle».
-- El detalle dice QUÉ mitad falló: una aserción de este proyecto imprimió seis
-- veces el texto del verde estando en rojo (CLAUDE.md, v973).
-- pr.error(sql) corre una orden y devuelve el código de error, o null si pasó.
-- pr.como(usuario, aal) pone la sesión de ese usuario; pr.anon() la del público.

create schema if not exists pr;
grant usage on schema pr to anon, authenticated;

create or replace function pr.ok(p_nombre text, p_cond boolean, p_detalle text default '') returns void
  language plpgsql as $$
begin
  if coalesce(p_cond, false) then raise notice 'ok · %', p_nombre;
  else raise notice 'FALLA · % — %', p_nombre, coalesce(p_detalle, '(sin detalle)'); end if;
end $$;

create or replace function pr.error(p_sql text) returns text
  language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

create or replace function pr.como(p_usuario uuid, p_aal text default 'aal2') returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_usuario, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pr.anon() returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function pr.usuario(p_usuario text) returns uuid
  language plpgsql as $$
declare v uuid;
begin
  insert into auth.users (email, raw_user_meta_data)
  values (p_usuario || '@ejemplo.test', jsonb_build_object('usuario', p_usuario))
  returning id into v;
  return v;
end $$;

grant execute on all functions in schema pr to anon, authenticated;
