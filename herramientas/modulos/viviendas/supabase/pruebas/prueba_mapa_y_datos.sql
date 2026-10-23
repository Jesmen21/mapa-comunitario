-- EL MAPA, LOS DATOS DE EJEMPLO Y LO DEMÁS DEL ESQUEMA.
begin;

select pr.anon();
do $$ begin
  perform pr.ok('mapa · las viviendas del rectángulo y solo ellas',
    (select count(*) from public.viviendas_en_area(-72.51, 7.895, -72.49, 7.905)) between 1 and 5
    and (select count(*) from public.viviendas_en_area(-73.5, 6.0, -73.4, 6.1)) = 0,
    'en el rectángulo: ' || (select count(*) from public.viviendas_en_area(-72.51, 7.895, -72.49, 7.905)));
  perform pr.ok('mapa · el filtro de operación separa venta de arriendo',
    (select count(*) from public.viviendas_en_area(-73, 7.5, -72, 8.5, 'arriendo')) = 1
    and (select count(*) from public.viviendas_en_area(-73, 7.5, -72, 8.5, 'venta')) = 5,
    'arriendo ' || (select count(*) from public.viviendas_en_area(-73, 7.5, -72, 8.5, 'arriendo')) ||
    ' · venta ' || (select count(*) from public.viviendas_en_area(-73, 7.5, -72, 8.5, 'venta')));
  perform pr.ok('mapa · con el mapa alejado no se piden puntos de interés; acercado sí',
    (select count(*) from public.pois_en_area(-73, 7.5, -72, 8.5, 12)) = 0
    and (select count(*) from public.pois_en_area(-73, 7.5, -72, 8.5, 15)) > 0,
    'zoom 12: ' || (select count(*) from public.pois_en_area(-73, 7.5, -72, 8.5, 12)) ||
    ' · zoom 15: ' || (select count(*) from public.pois_en_area(-73, 7.5, -72, 8.5, 15)));
  perform pr.ok('mapa · la vista pública nunca trae el punto exacto de una vivienda que lo oculta',
    not exists (select 1 from public.viviendas_publicas where ubicacion_aproximada
                and extensions.st_distance(ubicacion, (select ubicacion_publica from public.viviendas v where v.id = viviendas_publicas.id)) > 0.01),
    'hay una vista con otro punto que el público');
end $$;
reset role;

do $$ begin
  perform pr.ok('vista pública · todo punto oculto está desplazado entre 80 y 150 m del exacto',
    (select count(*) from public.viviendas where ocultar_ubicacion_exacta) > 0
    and not exists (select 1 from public.viviendas where ocultar_ubicacion_exacta
                    and extensions.st_distance(ubicacion, ubicacion_publica) not between 79.5 and 150.5),
    'fuera de rango: ' || (select count(*) from public.viviendas where ocultar_ubicacion_exacta
                    and extensions.st_distance(ubicacion, ubicacion_publica) not between 79.5 and 150.5));
  perform pr.ok('vista pública · el desplazamiento no cambia entre recargas: el mismo id da el mismo punto',
    (select bool_and(extensions.st_equals(ubicacion_publica::extensions.geometry,
                     privado.desplazar_punto(id, ubicacion)::extensions.geometry))
     from public.viviendas where ocultar_ubicacion_exacta), 'el punto cambió');
  perform pr.ok('datos de ejemplo · seis viviendas de la maqueta, cinco en venta y una en arriendo, todas marcadas',
    (select count(*) from public.viviendas where es_ejemplo and publicada and operacion = 'venta') = 5
    and (select count(*) from public.viviendas where es_ejemplo and publicada and operacion = 'arriendo') = 1
    and not exists (select 1 from public.viviendas where not es_ejemplo),
    'venta ' || (select count(*) from public.viviendas where es_ejemplo and operacion = 'venta') ||
    ' · arriendo ' || (select count(*) from public.viviendas where es_ejemplo and operacion = 'arriendo'));
end $$;
create temp table borrado on commit drop as select public.borrar_datos_de_ejemplo() as res;
insert into public.viviendas (nombre, precio_cop, ubicacion) values ('Casa Ñandú Ávila', 1, extensions.st_setsrid(extensions.st_makepoint(-72.5, 7.9), 4326)::extensions.geography);
do $$ begin
  perform pr.ok('datos de ejemplo · un solo comando los borra y no toca nada más',
    ((select res from borrado) ->> 'viviendas_borradas')::int = 6
    and not exists (select 1 from public.viviendas where es_ejemplo)
    and not exists (select 1 from public.puntos_interes where fuente = 'ejemplo')
    and exists (select 1 from public.categorias_poi),
    'quedaron ' || (select count(*) from public.viviendas where es_ejemplo) || ' viviendas de ejemplo');
  perform pr.ok('esquema · el slug nace solo, único y con formato',
    (select slug from public.viviendas where nombre = 'Casa Ñandú Ávila') ~ '^casa-nandu-avila-[0-9a-f]{6}$',
    'slug: ' || coalesce((select slug from public.viviendas where nombre = 'Casa Ñandú Ávila'), 'nulo'));
  perform pr.ok('esquema · un parqueadero sin dato queda NULL, no 0',
    (select parqueaderos from public.viviendas where nombre = 'Casa Ñandú Ávila') is null,
    'quedó en ' || coalesce((select parqueaderos::text from public.viviendas where nombre = 'Casa Ñandú Ávila'), 'nulo'));
  perform pr.ok('esquema · el bucket de Supabase quedó retirado',
    not exists (select 1 from storage.buckets where id = 'viviendas-fotos'), 'el bucket sigue');
  perform pr.ok('esquema · rls_auto_enable ya no se deja ejecutar por anon ni por authenticated',
    not has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
    and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute'),
    'anon puede: ' || has_function_privilege('anon', 'public.rls_auto_enable()', 'execute'));
  perform pr.ok('esquema · toda tabla de public tiene la seguridad por fila activa',
    not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity),
    'sin RLS: ' || coalesce((select string_agg(relname, ', ') from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity), ''));
  perform pr.ok('esquema · una tabla nueva nace sin permisos para anon ni authenticated',
    pr.error('create table public.tabla_nueva_de_prueba (x int)') is null
    and not has_table_privilege('anon', 'public.tabla_nueva_de_prueba', 'select')
    and not has_table_privilege('authenticated', 'public.tabla_nueva_de_prueba', 'insert'),
    'anon lee la tabla nueva: ' || has_table_privilege('anon', 'public.tabla_nueva_de_prueba', 'select'));
end $$;

rollback;
