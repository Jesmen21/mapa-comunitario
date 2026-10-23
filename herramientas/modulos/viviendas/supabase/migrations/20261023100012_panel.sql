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
