-- SEGURIDAD POR ROL (prompt §10): qué lee y qué escribe cada uno —el público
-- con la llave anon, un cliente, el admin sin y con el segundo paso, gerencia y
-- un anunciante—, incluida la ubicación oculta, los perfiles y las transacciones.
-- Todo corre en una transacción que se deshace al final.
begin;

-- Material: dos clientes, un admin, una gerencia y un anunciante, más una
-- vivienda publicada, una sin publicar y una transacción.
create temp table t (clave text primary key, id uuid) on commit drop;
grant select on t to anon, authenticated;
insert into t values
  ('ana', pr.usuario('ana.cliente')), ('beto', pr.usuario('beto.cliente')),
  ('admin', pr.usuario('daniel.admin')), ('gerencia', pr.usuario('gerencia.uno')),
  ('anunciante', pr.usuario('carla.anuncia'));
insert into public.roles_usuario (user_id, rol) select id, 'admin' from t where clave = 'admin';
insert into public.roles_usuario (user_id, rol) select id, 'gerencia' from t where clave = 'gerencia';
insert into public.roles_usuario (user_id, rol) select id, 'anunciante' from t where clave = 'anunciante';
insert into t select 'publicada', id from public.viviendas where publicada and es_ejemplo order by nombre limit 1;
insert into public.viviendas (nombre, precio_cop, ubicacion, publicada)
values ('Borrador interno', 100000000, extensions.st_setsrid(extensions.st_makepoint(-72.5, 7.9), 4326)::extensions.geography, false);
insert into t select 'borrador', id from public.viviendas where nombre = 'Borrador interno';
insert into public.transacciones (tipo, categoria, monto_cop, ocurrida_en, concepto, registrada_por)
select 'ingreso', 'venta', 1000, now(), 'prueba', id from t where clave = 'admin';

-- ── el público, con la llave anon ─────────────────────────────────────────
select pr.anon();
do $$ begin
  perform pr.ok('anon no lee la ubicación exacta de la tabla',
    pr.error('select ubicacion from public.viviendas limit 1') like '42501%',
    'la columna ubicacion se dejó leer: ' || coalesce(pr.error('select ubicacion from public.viviendas limit 1'), 'sin error'));
  perform pr.ok('anon lee la vista pública y solo las publicadas',
    (select count(*) from public.viviendas_publicas) = (select count(*) from public.viviendas_publicas where id <> (select id from t where clave = 'borrador'))
    and not exists (select 1 from public.viviendas_publicas where id = (select id from t where clave = 'borrador'))
    and (select count(*) from public.viviendas_publicas) > 0,
    'la vista trae ' || (select count(*) from public.viviendas_publicas) || ' filas, borrador incluido: ' ||
    exists (select 1 from public.viviendas_publicas where id = (select id from t where clave = 'borrador')));
  perform pr.ok('anon no pide visita sin sesión',
    pr.error(format('insert into public.interesados (vivienda_id, nombre, telefono) values (%L, %L, %L)',
      (select id from t where clave = 'publicada'), 'X', '+573001234567')) like '42501%',
    'la inserción anónima pasó');
  perform pr.ok('anon no escribe viviendas',
    pr.error('update public.viviendas set precio_cop = 1') like '42501%', 'el update anónimo pasó');
  perform pr.ok('anon no puede vaciar una tabla (TRUNCATE, que la seguridad por fila no frena)',
    pr.error('truncate public.viviendas cascade') like '42501%', 'TRUNCATE pasó');
  perform pr.ok('anon no lee perfiles, transacciones ni bitácora',
    pr.error('select 1 from public.perfiles') like '42501%' and pr.error('select 1 from public.transacciones') like '42501%'
    and pr.error('select 1 from public.bitacora') like '42501%',
    'perfiles: ' || coalesce(pr.error('select 1 from public.perfiles'), 'abierto') ||
    ' · transacciones: ' || coalesce(pr.error('select 1 from public.transacciones'), 'abierto'));
  -- Se mide el PERMISO y no el error: las funciones vuelven a preguntar el rol
  -- por dentro, así que con el permiso abierto igual contestarían «no», y esta
  -- aserción no vería que la primera barrera se cayó.
  perform pr.ok('anon no tiene permiso de ejecutar las funciones de escritura ni las del panel',
    not exists (select 1 from unnest(array['public.calcular_analisis_ubicacion(uuid,integer)', 'public.importar_mapeos(jsonb,text,boolean)',
      'public.borrar_datos_de_ejemplo()', 'public.proponer_punto_local(text,text,double precision,double precision,boolean)',
      'public.generar_fortalezas(uuid)', 'public.registrar_pago(uuid)', 'public.ubicacion_exacta(uuid)', 'public.hacerme_anunciante()']) f
      where has_function_privilege('anon', f, 'execute')),
    'anon puede ejecutar: ' || coalesce((select string_agg(f, ', ') from unnest(array['public.calcular_analisis_ubicacion(uuid,integer)',
      'public.importar_mapeos(jsonb,text,boolean)', 'public.borrar_datos_de_ejemplo()', 'public.generar_fortalezas(uuid)',
      'public.registrar_pago(uuid)', 'public.ubicacion_exacta(uuid)', 'public.hacerme_anunciante()']) f
      where has_function_privilege('anon', f, 'execute')), ''));
  perform pr.ok('anon registra un evento anónimo y no lo puede leer',
    pr.error($q$insert into public.eventos (sesion_id, tipo) values (gen_random_uuid(), 'visita')$q$) is null
    and pr.error('select 1 from public.eventos') like '42501%',
    'insertar: ' || coalesce(pr.error($q$insert into public.eventos (sesion_id, tipo) values (gen_random_uuid(), 'visita')$q$), 'ok') ||
    ' · leer: ' || coalesce(pr.error('select 1 from public.eventos'), 'abierto'));
end $$;
reset role;

-- ── un cliente con sesión (Ana) ───────────────────────────────────────────
select pr.como((select id from t where clave = 'ana'), 'aal1');
do $$
declare v uuid := (select id from t where clave = 'publicada');
begin
  perform pr.ok('el cliente pide visita a su nombre',
    pr.error(format('insert into public.interesados (vivienda_id, nombre, telefono, user_id) values (%L, %L, %L, %L)',
      v, 'Ana', '+573001234567', auth.uid())) is null, 'la solicitud propia no entró');
  perform pr.ok('el cliente no pide visita a nombre de otro',
    pr.error(format('insert into public.interesados (vivienda_id, nombre, telefono, user_id) values (%L, %L, %L, %L)',
      v, 'Ana', '+573001234567', (select id from t where clave = 'beto'))) like '42501%', 'entró a nombre de Beto');
  perform pr.ok('el límite de envíos frena una segunda solicitud abierta a la misma vivienda',
    pr.error(format('insert into public.interesados (vivienda_id, nombre, telefono, user_id) values (%L, %L, %L, %L)',
      v, 'Ana', '+573001234567', auth.uid())) like 'P0001%', 'la segunda solicitud entró');
  perform pr.ok('el cliente ve su perfil y ningún otro',
    (select count(*) from public.perfiles) = 1 and (select user_id from public.perfiles) = auth.uid(),
    've ' || (select count(*) from public.perfiles) || ' perfiles');
  perform pr.ok('el cliente no se da a sí mismo el rol de admin',
    pr.error(format($q$insert into public.roles_usuario (user_id, rol, asignado_por) values (%L, 'admin', %L)$q$, auth.uid(), auth.uid())) like '42501%',
    'se asignó admin');
  perform pr.ok('el cliente no ve la ubicación exacta por la función del panel',
    pr.error(format('select * from public.ubicacion_exacta(%L)', v)) like '42501%', 'la función le contestó');
  perform pr.ok('el cliente no ve transacciones aunque existan',
    (select count(*) from public.transacciones) = 0, 've ' || (select count(*) from public.transacciones));
  perform pr.ok('el cliente guarda un favorito suyo y no uno a nombre de otro',
    pr.error(format('insert into public.favoritos (user_id, vivienda_id) values (%L, %L)', auth.uid(), v)) is null
    and pr.error(format('insert into public.favoritos (user_id, vivienda_id) values (%L, %L)', (select id from t where clave = 'beto'), v)) like '42501%',
    'propio: ' || coalesce(pr.error(format('insert into public.favoritos (user_id, vivienda_id) values (%L, %L)', auth.uid(), v)), 'ok'));
end $$;
reset role;

-- ── Beto no ve lo de Ana ──────────────────────────────────────────────────
select pr.como((select id from t where clave = 'beto'), 'aal1');
do $$ begin
  perform pr.ok('un cliente no ve las solicitudes ni los favoritos de otro',
    (select count(*) from public.interesados) = 0 and (select count(*) from public.favoritos) = 0,
    'solicitudes visibles: ' || (select count(*) from public.interesados) || ' · favoritos: ' || (select count(*) from public.favoritos));
end $$;
reset role;

-- ── el admin SIN el segundo paso ──────────────────────────────────────────
select pr.como((select id from t where clave = 'admin'), 'aal1');
do $$ begin
  perform pr.ok('el admin sin segundo paso (aal1) no tiene ningún permiso de admin',
    (select count(*) from public.transacciones) = 0
    and pr.error(format('select * from public.ubicacion_exacta(%L)', (select id from t where clave = 'publicada'))) like '42501%',
    've ' || (select count(*) from public.transacciones) || ' transacciones');
end $$;
reset role;

-- ── el admin con el segundo paso ──────────────────────────────────────────
select pr.como((select id from t where clave = 'admin'), 'aal2');
do $$
declare v uuid := (select id from t where clave = 'publicada');
begin
  perform pr.ok('el admin ve la ubicación exacta por su función, y es distinta de la pública',
    (select lat from public.ubicacion_exacta(v)) is not null
    and (select lat from public.ubicacion_exacta(v)) <> (select lat from public.viviendas_publicas where id = v),
    'exacta ' || coalesce((select lat from public.ubicacion_exacta(v))::text, 'nula'));
  perform pr.ok('el admin lee el perfil de quien pidió visita y no el de quien no',
    exists (select 1 from public.perfiles where user_id = (select id from t where clave = 'ana'))
    and not exists (select 1 from public.perfiles where user_id = (select id from t where clave = 'beto')),
    'Ana visible: ' || exists (select 1 from public.perfiles where user_id = (select id from t where clave = 'ana')) ||
    ' · Beto visible: ' || exists (select 1 from public.perfiles where user_id = (select id from t where clave = 'beto')));
  perform pr.ok('el admin registra una transacción y nadie la puede borrar',
    pr.error($q$insert into public.transacciones (tipo, categoria, monto_cop, ocurrida_en, concepto) values ('egreso', 'hosting', 25, now(), 'Supabase')$q$) is null
    and pr.error('delete from public.transacciones') like '42501%',
    'borrar: ' || coalesce(pr.error('delete from public.transacciones'), 'se dejó borrar'));
  update public.viviendas set precio_cop = 123456789,
    ubicacion = extensions.st_setsrid(extensions.st_makepoint(-72.4991, 7.9006), 4326)::extensions.geography
  where id = v;
  perform pr.ok('el admin publica y edita viviendas, ubicación incluida',
    (select precio_cop from public.viviendas where id = v) = 123456789
    and (select lat from public.ubicacion_exacta(v)) between 7.90059 and 7.90061,
    'precio ' || (select precio_cop from public.viviendas where id = v));
  perform pr.ok('nadie escribe la bitácora a mano, ni el admin',
    pr.error($q$insert into public.bitacora (tabla, accion) values ('x', 'crear')$q$) like '42501%'
    and pr.error('delete from public.bitacora') like '42501%', 'se dejó escribir');
end $$;
reset role;

do $$ begin
  perform pr.ok('la bitácora anota el cambio sin copiar la coordenada ni datos personales',
    exists (select 1 from public.bitacora where tabla = 'viviendas' and accion = 'editar')
    and not exists (select 1 from public.bitacora where cambios::text ~ '0101000020|\+57'),
    'filas de viviendas: ' || (select count(*) from public.bitacora where tabla = 'viviendas'));
end $$;

-- ── gerencia ──────────────────────────────────────────────────────────────
select pr.como((select id from t where clave = 'gerencia'), 'aal2');
do $$ begin
  perform pr.ok('gerencia lee transacciones y bitácora',
    (select count(*) from public.transacciones) > 0 and (select count(*) from public.bitacora) > 0,
    'transacciones ' || (select count(*) from public.transacciones) || ' · bitácora ' || (select count(*) from public.bitacora));
  -- La acción va en su propia sentencia: dentro de una sola, las subconsultas
  -- leen la foto de antes y no verían el cambio aunque hubiera entrado.
  update public.viviendas set precio_cop = 1 where id = (select id from t where clave = 'publicada');
  perform pr.ok('gerencia no escribe nada',
    pr.error($q$insert into public.transacciones (tipo, categoria, monto_cop, ocurrida_en, concepto) values ('ingreso', 'otros', 1, now(), 'x')$q$) like '42501%'
    and (select precio_cop from public.viviendas where id = (select id from t where clave = 'publicada')) <> 1,
    'insertar transacción: ' || coalesce(pr.error($q$insert into public.transacciones (tipo, categoria, monto_cop, ocurrida_en, concepto) values ('ingreso', 'otros', 1, now(), 'x')$q$), 'pasó') ||
    ' · precio tras el update de gerencia: ' || (select precio_cop from public.viviendas where id = (select id from t where clave = 'publicada')));
  perform pr.ok('gerencia no ve teléfonos ni correos: ni perfiles ajenos ni solicitudes',
    (select count(*) from public.perfiles) = 1 and (select count(*) from public.interesados) = 0,
    'perfiles ' || (select count(*) from public.perfiles) || ' · solicitudes ' || (select count(*) from public.interesados));
end $$;
reset role;

-- ── un anunciante ─────────────────────────────────────────────────────────
select pr.como((select id from t where clave = 'anunciante'), 'aal1');
do $$
declare v uuid;
begin
  perform pr.ok('el anunciante crea un borrador propio',
    pr.error(format($q$insert into public.viviendas (nombre, precio_cop, ubicacion, propietario_id, estado_revision)
      values ('Mi casa', 150000000, extensions.st_setsrid(extensions.st_makepoint(-72.5, 7.9), 4326)::extensions.geography, %L, 'borrador')$q$,
      auth.uid())) is null, 'el borrador no entró');
  perform pr.ok('el anunciante no puede publicarse solo',
    pr.error(format($q$insert into public.viviendas (nombre, precio_cop, ubicacion, propietario_id, estado_revision, publicada)
      values ('Publicada sola', 1, extensions.st_setsrid(extensions.st_makepoint(-72.5, 7.9), 4326)::extensions.geography, %L, 'borrador', true)$q$,
      auth.uid())) like '42501%'
    and pr.error($q$update public.viviendas set publicada = true where nombre = 'Mi casa'$q$) like '42501%',
    'se publicó solo');
  perform pr.ok('el anunciante no ve el borrador interno de URBIS',
    not exists (select 1 from public.viviendas where nombre = 'Borrador interno'), 'lo vio');
  update public.viviendas set estado_revision = 'en_revision' where nombre = 'Mi casa';
  update public.viviendas set precio_cop = 2 where nombre = 'Mi casa';
  perform pr.ok('en revisión el anunciante ya no puede editar',
    (select precio_cop from public.viviendas where nombre = 'Mi casa') = 150000000
    and (select estado_revision from public.viviendas where nombre = 'Mi casa') = 'en_revision',
    'precio ahora ' || (select precio_cop from public.viviendas where nombre = 'Mi casa'));
end $$;
reset role;

rollback;
