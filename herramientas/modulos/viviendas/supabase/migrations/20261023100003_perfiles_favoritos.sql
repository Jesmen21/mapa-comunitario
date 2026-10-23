-- 003 · perfiles y favoritos
--
-- El perfil nace solo, con la cuenta: un disparador sobre auth.users lo crea
-- con el `usuario` que el registro manda en los metadatos. Si el usuario falta
-- o no tiene el formato, el registro FALLA entero: una cuenta sin usuario
-- válido no puede existir a medias.
--
-- El correo vive en auth.users y acá se COPIA por disparador, nunca a mano:
-- dos sitios que guardan el mismo correo se separan el día que alguien lo
-- cambia en uno solo (clase B). El disparador de actualización lo mantiene.
--
-- Formato del usuario: el mismo de URBIS, /^[a-z0-9._-]{5,30}$/ (js/02 de
-- mapa-comunitario), para que unificar cuentas algún día no obligue a nadie a
-- cambiarse el nombre.

create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  urbis_id text constraint perfiles_urbis_id_unico unique,
  usuario text not null
    constraint perfiles_usuario_formato check (usuario ~ '^[a-z0-9._-]{5,30}$'),
  correo text,
  nombre text constraint perfiles_nombre_largo check (char_length(nombre) <= 120),
  telefono text
    constraint perfiles_telefono_formato check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  es_mayor_de_edad boolean,
  fecha_nacimiento date
    constraint perfiles_fecha_nacimiento_check check (fecha_nacimiento > date '1900-01-01'),
  acepto_datos_en timestamptz,
  acepto_terminos_anunciante_en timestamptz,
  creada_en timestamptz not null default now(),
  ultima_actividad_en timestamptz
);
-- «único sin distinguir mayúsculas»: el formato ya obliga minúsculas, y el
-- índice sobre lower() lo garantiza aunque alguien afloje el formato mañana.
create unique index perfiles_usuario_unico on public.perfiles (lower(usuario));
comment on column public.perfiles.telefono is 'Opcional. Formato E.164: + código de país y número, p. ej. +573001234567.';
comment on column public.perfiles.es_mayor_de_edad is 'NULL = no contestado. Pendiente P6 de Daniel: casilla o fecha.';

alter table public.perfiles enable row level security;

create function privado.crear_perfil() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (user_id, usuario, correo, acepto_datos_en, es_mayor_de_edad)
  values (new.id,
          lower(new.raw_user_meta_data ->> 'usuario'),
          new.email,
          nullif(new.raw_user_meta_data ->> 'acepto_datos_en', '')::timestamptz,
          (new.raw_user_meta_data ->> 'es_mayor_de_edad')::boolean);
  return new;
end $$;
revoke execute on function privado.crear_perfil() from public;

create function privado.copiar_correo() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  update public.perfiles set correo = new.email where user_id = new.id;
  return new;
end $$;
revoke execute on function privado.copiar_correo() from public;

create trigger perfiles_al_registrarse after insert on auth.users
  for each row execute function privado.crear_perfil();
create trigger perfiles_copiar_correo after update of email on auth.users
  for each row execute function privado.copiar_correo();

-- Cada quien ve y edita lo suyo. El admin lee el perfil de quien pidió una
-- visita (la política de esa parte llega con `interesados`, en la 004).
grant select on public.perfiles to authenticated;
grant update (nombre, telefono, es_mayor_de_edad, fecha_nacimiento, acepto_datos_en, ultima_actividad_en)
  on public.perfiles to authenticated;
create policy "cada quien ve su perfil" on public.perfiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "cada quien edita su perfil" on public.perfiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.favoritos (
  user_id uuid not null references auth.users(id) on delete cascade,
  vivienda_id uuid not null references public.viviendas(id) on delete cascade,
  creada_en timestamptz not null default now(),
  primary key (user_id, vivienda_id)
);
alter table public.favoritos enable row level security;
grant select, insert, delete on public.favoritos to authenticated;
create policy "cada quien ve sus favoritos" on public.favoritos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "cada quien guarda favoritos de viviendas publicadas" on public.favoritos
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.viviendas v where v.id = vivienda_id and v.publicada));
create policy "cada quien quita sus favoritos" on public.favoritos
  for delete to authenticated using (user_id = (select auth.uid()));
