-- LA FÓRMULA DEL PUNTAJE, contra un caso FABRICADO cuyas cifras están hechas a
-- mano (CLAUDE.md: la rama con material se mide contra un caso fabricado, no
-- contra el registro). Fórmula 1: 66,67 puntos por punto a distancia cero,
-- decaimiento lineal hasta el radio, tope 100, pesos 1 · 1 · 0,8 · 0,8.
--
-- La vivienda NO oculta su ubicación, así que el punto público es el exacto y
-- las distancias se pueden poner a mano. Radio 500 m. Lejos de todo lo de
-- ejemplo (unos 30 km al norte), para que nada más caiga en la zona.
--   educación    dos puntos, a 100 y 250 m: 66,67·0,8 + 66,67·0,5 = 53,34 + 33,34 = 86,68 → 87
--   transporte   cuatro puntos a 250 m: 4 · 33,34 = 133,36 → tope → 100
--   comercio     uno a 1.500 m: fuera del radio, dentro de la zona de 2 km → 0 MEDIDO
--   zonas verdes ninguno en 2 km → SIN MEDIR, fuera del total
--   total        (1·86,68 + 1·100 + 0,8·0) / (1 + 1 + 0,8) = 66,67 → 67
begin;

create temp table f (clave text primary key, id uuid) on commit drop;
insert into public.viviendas (nombre, precio_cop, ubicacion, ocultar_ubicacion_exacta, publicada)
values ('Caso fabricado', 1, extensions.st_setsrid(extensions.st_makepoint(-72.5, 8.17), 4326)::extensions.geography, false, true);
insert into f select 'v', id from public.viviendas where nombre = 'Caso fabricado';

insert into public.puntos_interes (nombre, categoria, ubicacion, fuente)
select n, c, extensions.st_project((select ubicacion from public.viviendas where id = (select id from f)), m, radians(r)), 'ejemplo'
from (values ('E1', 'educacion', 100, 0), ('E2', 'educacion', 250, 90),
             ('T1', 'transporte', 250, 180), ('T2', 'transporte', 250, 200), ('T3', 'transporte', 250, 220), ('T4', 'transporte', 250, 240),
             ('C1', 'comercio', 1500, 45)) as x(n, c, m, r);

insert into f select 'a', public.calcular_analisis_ubicacion((select id from f where clave = 'v'), 500);

do $$
declare a public.analisis_ubicacion := (select x from public.analisis_ubicacion x where id = (select id from f where clave = 'a'));
begin
  perform pr.ok('fórmula · dos colegios a 100 y 250 m suman 87 con decaimiento lineal',
    (a.puntajes #>> '{educacion,puntaje}')::int = 87, 'educación = ' || coalesce(a.puntajes #>> '{educacion,puntaje}', 'nulo'));
  perform pr.ok('fórmula · cuatro paraderos a 250 m suman 133 y el tope los deja en 100',
    (a.puntajes #>> '{transporte,puntaje}')::int = 100, 'transporte = ' || coalesce(a.puntajes #>> '{transporte,puntaje}', 'nulo'));
  perform pr.ok('fórmula · sin puntos en el radio pero con puntos en la zona es un 0 MEDIDO',
    (a.puntajes #>> '{comercio,puntaje}')::int = 0 and (a.puntajes #>> '{comercio,en_zona}')::int = 1,
    'comercio = ' || coalesce(a.puntajes ->> 'comercio', 'nulo'));
  perform pr.ok('fórmula · sin ningún punto en 2 km la categoría queda SIN MEDIR, no en 0',
    (a.puntajes -> 'zonas_verdes' -> 'puntaje') = 'null'::jsonb and a.puntajes #>> '{zonas_verdes,lectura}' like 'SIN MEDIR%',
    'zonas verdes = ' || coalesce(a.puntajes ->> 'zonas_verdes', 'nulo'));
  perform pr.ok('fórmula · el total es la media ponderada y deja fuera la categoría SIN MEDIR',
    a.puntaje_total = 67, 'total = ' || coalesce(a.puntaje_total::text, 'nulo') || ' (con la SIN MEDIR como 0 habría dado 51)');
  perform pr.ok('fórmula · la corrida guarda la copia de la fórmula y de los pesos que usó',
    (a.formula_copia ->> 'version')::int = 1 and jsonb_array_length(a.categorias_copia) = 4 and a.estado = 'ok',
    'copia: ' || coalesce(a.formula_copia ->> 'version', 'sin fórmula') || ' · pesos: ' || coalesce(jsonb_array_length(a.categorias_copia)::text, 'sin pesos'));
  perform pr.ok('fórmula · el detalle trae cada punto del radio con su distancia',
    jsonb_array_length(a.detalle) = 6 and (select (d ->> 'metros')::int from jsonb_array_elements(a.detalle) d where d ->> 'nombre' = 'E1') between 99 and 101,
    'puntos en el detalle: ' || jsonb_array_length(a.detalle));
end $$;

-- Una fórmula no se edita, y cambiar un peso no reescribe una corrida vieja.
update public.categorias_poi set peso = 0.5 where clave = 'comercio';
do $$ begin
  perform pr.ok('fórmula · una fórmula no se edita: hay que crear otra versión',
    pr.error('update public.formulas_puntaje set puntos_por_poi = 99 where version = 1') like '42501%', 'se dejó editar');
  perform pr.ok('fórmula · cambiar un peso no toca la copia guardada en la corrida vieja',
    (select (c ->> 'peso')::numeric from public.analisis_ubicacion a, jsonb_array_elements(a.categorias_copia) c
      where a.id = (select id from f where clave = 'a') and c ->> 'clave' = 'comercio') = 0.8,
    'la copia ahora dice otra cosa');
  perform pr.ok('fórmula · un radio fuera de los permitidos se rechaza',
    pr.error(format('select public.calcular_analisis_ubicacion(%L, 750)', (select id from f where clave = 'v'))) is not null,
    'aceptó 750 m');
end $$;

-- Sin ningún punto en la zona, el total es SIN MEDIR.
insert into public.viviendas (nombre, precio_cop, ubicacion, ocultar_ubicacion_exacta)
values ('En el desierto', 1, extensions.st_setsrid(extensions.st_makepoint(-71.0, 11.5), 4326)::extensions.geography, false);
do $$
declare a public.analisis_ubicacion; v uuid;
begin
  v := public.calcular_analisis_ubicacion((select id from public.viviendas where nombre = 'En el desierto'));
  select * into a from public.analisis_ubicacion where id = v;
  perform pr.ok('fórmula · sin datos en la zona el total queda NULL con su estado, no en 0',
    a.puntaje_total is null and a.estado = 'sin_datos_en_zona', 'total = ' || coalesce(a.puntaje_total::text, 'nulo') || ' · estado ' || a.estado);
end $$;

-- Las distancias públicas se miden desde el punto PÚBLICO.
update public.viviendas set ocultar_ubicacion_exacta = true where id = (select id from f where clave = 'v');
do $$
declare a public.analisis_ubicacion; v uuid;
begin
  v := public.calcular_analisis_ubicacion((select id from f where clave = 'v'));
  select * into a from public.analisis_ubicacion where id = v;
  perform pr.ok('fórmula · con la ubicación oculta, la distancia sale del punto público y no del exacto',
    a.punto = 'publico' and
    (select (d ->> 'metros')::int from jsonb_array_elements(a.detalle) d where d ->> 'nombre' = 'T1') =
    (select round(extensions.st_distance(p.ubicacion, v.ubicacion_publica))::int from public.puntos_interes p, public.viviendas v
      where p.nombre = 'T1' and v.id = (select id from f where clave = 'v')),
    'punto = ' || coalesce(a.punto, 'nulo'));
end $$;

-- Las fortalezas: salen de datos reales, y una sin base no existe.
update public.viviendas set ocultar_ubicacion_exacta = false where id = (select id from f where clave = 'v');
select public.calcular_analisis_ubicacion((select id from f where clave = 'v'));
select public.generar_fortalezas((select id from f where clave = 'v'));
do $$ begin
  perform pr.ok('fortalezas · una por categoría con puntos en el radio, del punto más cercano, y ninguna inventada',
    (select count(*) from public.vivienda_fortalezas where vivienda_id = (select id from f where clave = 'v')) = 2
    and exists (select 1 from public.vivienda_fortalezas where vivienda_id = (select id from f where clave = 'v') and texto = 'E1 a 100 m'),
    'fortalezas: ' || (select string_agg(texto, ' · ') from public.vivienda_fortalezas where vivienda_id = (select id from f where clave = 'v')));
  perform pr.ok('fortalezas · una fortaleza sin punto y sin razón no se puede guardar',
    pr.error(format($q$insert into public.vivienda_fortalezas (vivienda_id, texto) values (%L, 'Excelente ubicación')$q$,
      (select id from f where clave = 'v'))) like '23514%', 'se guardó «Excelente ubicación» sin respaldo');
end $$;
insert into public.vivienda_fortalezas (vivienda_id, texto, poi_id, distancia_m)
values ((select id from f where clave = 'v'), 'T1 cerca', (select id from public.puntos_interes where nombre = 'T1'), 5);
do $$ begin
  perform pr.ok('fortalezas · la distancia la calcula la base, aunque alguien escriba otra',
    (select distancia_m from public.vivienda_fortalezas where texto = 'T1 cerca') between 249 and 251,
    'distancia guardada: ' || coalesce((select distancia_m::text from public.vivienda_fortalezas where texto = 'T1 cerca'), 'nula'));
end $$;

rollback;
