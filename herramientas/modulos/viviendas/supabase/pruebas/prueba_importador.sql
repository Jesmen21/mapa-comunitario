-- EL IMPORTADOR DE MAPEOS (prompt §10): reimportar el mismo archivo no
-- duplica; un punto cambiado se actualiza; un punto nuevo local queda
-- pendiente y avisa de coincidencias cercanas. Más lo que el contrato exige.
begin;

create temp table r (n int primary key, res jsonb) on commit drop;
create temp table archivo (j jsonb) on commit drop;
insert into archivo values ('[
  {"urbis_mapeo_id": "edu-001", "modulo_origen": "educativo", "nombre": "Colegio Santa Ana", "categoria": "educacion",
   "subcategoria": "Colegio", "lat": 7.9101, "lng": -72.4901, "activo": true, "actualizado_en": "2026-10-23T14:05:00-05:00"},
  {"urbis_mapeo_id": "com-001", "modulo_origen": "comercial", "nombre": "Tienda La Esquina", "categoria": "comercio",
   "lat": 7.9105, "lng": -72.4905},
  {"urbis_mapeo_id": "par-001", "modulo_origen": "eventos", "nombre": "Parque Central", "categoria": "zonas_verdes",
   "lat": 7.9110, "lng": -72.4910,
   "geometria_geojson": {"type": "Polygon", "coordinates": [[[-72.4912,7.9108],[-72.4908,7.9108],[-72.4908,7.9112],[-72.4912,7.9112],[-72.4912,7.9108]]]}}
]');

insert into r select 1, public.importar_mapeos((select j from archivo), 'mapeos-1.json');
insert into r select 2, public.importar_mapeos((select j from archivo), 'mapeos-1.json');
do $$ begin
  perform pr.ok('importador · la primera vez inserta los tres',
    ((select res from r where n = 1) ->> 'insertados')::int = 3, coalesce((select res::text from r where n = 1), 'sin resultado'));
  perform pr.ok('importador · reimportar el mismo archivo no duplica ni reescribe',
    ((select res from r where n = 2) ->> 'insertados')::int = 0 and ((select res from r where n = 2) ->> 'actualizados')::int = 0
    and ((select res from r where n = 2) ->> 'sin_cambios')::int = 3
    and (select count(*) from public.puntos_interes where urbis_mapeo_id in ('edu-001', 'com-001', 'par-001')) = 3,
    coalesce((select res::text from r where n = 2), 'sin resultado'));
  perform pr.ok('importador · un polígono entra con su geometría y su punto',
    (select extensions.geometrytype(geometria::extensions.geometry) from public.puntos_interes where urbis_mapeo_id = 'par-001') = 'POLYGON',
    'geometría: ' || coalesce((select extensions.geometrytype(geometria::extensions.geometry) from public.puntos_interes where urbis_mapeo_id = 'par-001'), 'nula'));
end $$;

update archivo set j = jsonb_set(j, '{1,nombre}', '"Tienda La Esquina Express"');
insert into r select 3, public.importar_mapeos((select j from archivo), 'mapeos-2.json');
do $$ begin
  perform pr.ok('importador · un punto cambiado se actualiza y los demás no',
    ((select res from r where n = 3) ->> 'actualizados')::int = 1 and ((select res from r where n = 3) ->> 'sin_cambios')::int = 2
    and (select nombre from public.puntos_interes where urbis_mapeo_id = 'com-001') = 'Tienda La Esquina Express',
    coalesce((select res::text from r where n = 3), 'sin resultado'));
end $$;

insert into r select 4, public.importar_mapeos('[
  {"urbis_mapeo_id": "x-1", "modulo_origen": "comercial", "nombre": "Foto en base64", "categoria": "comercio",
   "lat": 7.91, "lng": -72.49, "miniatura_url": "data:image/jpeg;base64,AAAA"},
  {"urbis_mapeo_id": "x-2", "modulo_origen": "comercial", "nombre": "Categoría rara", "categoria": "discoteca", "lat": 7.91, "lng": -72.49},
  {"urbis_mapeo_id": "x-3", "modulo_origen": "comercial", "nombre": "En Madrid", "categoria": "comercio", "lat": 40.4, "lng": -3.7},
  {"urbis_mapeo_id": "x-4", "modulo_origen": "comercial", "nombre": "Bueno", "categoria": "comercio", "lat": 7.91, "lng": -72.49},
  {"urbis_mapeo_id": "x-4", "modulo_origen": "comercial", "nombre": "Repetido", "categoria": "comercio", "lat": 7.91, "lng": -72.49}
]', 'malos.json');
do $$ begin
  perform pr.ok('importador · rechaza una miniatura en base64, una categoría desconocida, un punto fuera de Colombia y un id repetido, y dice por qué',
    ((select res from r where n = 4) ->> 'rechazados')::int = 4 and ((select res from r where n = 4) ->> 'insertados')::int = 1
    and (select count(*) from jsonb_array_elements((select res from r where n = 4) -> 'detalle') d where d ->> 'motivo' is not null) = 4,
    coalesce((select res -> 'detalle' from r where n = 4)::text, 'sin detalle'));
end $$;

-- Un archivo COMPLETO sin el parque: se desactiva, no se borra, y el público ya no lo ve.
insert into r select 5, public.importar_mapeos((select j - 2 from archivo), 'completo.json', true);
do $$ begin
  perform pr.ok('importador · un punto que falta en un archivo completo se desactiva y no se borra',
    ((select res from r where n = 5) ->> 'desactivados')::int >= 1
    and exists (select 1 from public.puntos_interes where urbis_mapeo_id = 'par-001' and not activo),
    coalesce((select res::text from r where n = 5), 'sin resultado'));
  perform pr.ok('importador · cada corrida queda en sincronizaciones con sus cuentas',
    (select count(*) from public.sincronizaciones_mapeos where estado = 'ok') = 5, 'corridas: ' || (select count(*) from public.sincronizaciones_mapeos));
end $$;
select pr.anon();
do $$ begin
  perform pr.ok('importador · el público no ve un punto desactivado',
    not exists (select 1 from public.puntos_interes where urbis_mapeo_id = 'par-001'), 'lo ve');
end $$;
reset role;

-- Un punto local propuesto a 10 m de la tienda: avisa y no se crea solo.
insert into r select 6, public.proponer_punto_local('Tiendita', 'comercio', 7.91059, -72.4905);
insert into r select 7, public.proponer_punto_local('Tiendita', 'comercio', 7.91059, -72.4905, true);
do $$ begin
  perform pr.ok('importador · un punto local cercano a otro avisa la coincidencia y no se crea',
    (select res -> 'creado' from r where n = 6) = 'null'::jsonb and jsonb_array_length((select res -> 'coincidencias' from r where n = 6)) >= 1,
    coalesce((select res::text from r where n = 6), 'sin resultado'));
  perform pr.ok('importador · confirmado, queda pendiente de enviar a URBIS y sin id de URBIS',
    exists (select 1 from public.puntos_interes where id = ((select res ->> 'creado' from r where n = 7))::uuid
            and pendiente_enviar_a_urbis and urbis_mapeo_id is null),
    coalesce((select res::text from r where n = 7), 'sin resultado'));
end $$;

rollback;
