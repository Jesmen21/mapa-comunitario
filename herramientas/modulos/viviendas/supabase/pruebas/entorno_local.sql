-- ENTORNO LOCAL · lo mínimo de Supabase para probar las migraciones fuera de
-- la nube. SOLO para la base local de pruebas: en Supabase todo esto ya existe.
--
-- Cada pieza imita lo MEDIDO en la base viva el 2026-10-23, no lo que se supone:
--   * auth.uid() lee las dos variables que lee la de Supabase (copiada de
--     pg_get_functiondef en la base viva);
--   * los privilegios por defecto del esquema public dan TODO a anon y a
--     authenticated, igual que allá (pg_default_acl medido). Si acá fueran más
--     estrictos que en la nube, las pruebas pasarían en local y fallarían allá;
--   * storage.buckets lleva el mismo disparador protect_delete;
--   * la función rls_auto_enable con SECURITY DEFINER y ejecutable por anon,
--     como allá, para que la migración que se la quita tenga qué quitar.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;

create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
create or replace function storage.protect_delete() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), 'false') != 'true' then
    raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.' using errcode = '42501';
  end if;
  return null;
end $$;
drop trigger if exists protect_buckets_delete on storage.buckets;
create trigger protect_buckets_delete before delete on storage.buckets for each statement execute function storage.protect_delete();

-- Los privilegios por defecto medidos en la base viva.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- rls_auto_enable, como en la base viva (cuerpo resumido: solo importa su firma
-- y sus permisos; el disparador de eventos no se crea en local).
create or replace function public.rls_auto_enable() returns event_trigger
  language plpgsql security definer as $$ begin null; end $$;
grant execute on function public.rls_auto_enable() to anon, authenticated;
