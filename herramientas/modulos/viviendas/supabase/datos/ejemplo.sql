-- DATOS DE EJEMPLO · las seis viviendas de las maquetas (ESPEC.md §6), para que
-- la plataforma de la Fase 2 tenga con qué pintarse.
--
-- TODO lo de este archivo es de ejemplo y lo dice: las viviendas llevan
-- `es_ejemplo = true` y los puntos `fuente = 'ejemplo'`. Las coordenadas son
-- INVENTADAS, puestas a ojo dentro de Cúcuta, y no son las de esos barrios: el
-- nombre del barrio es el de la maqueta, la posición no es un dato. Se borra
-- todo con:
--     select public.borrar_datos_de_ejemplo();
--
-- Es idempotente: empieza borrando lo de ejemplo que haya (también las dos
-- casas del esquema inicial, que contaban como venta y habrían hecho decir a la
-- Home «7 viviendas en venta» con 5 en la maqueta).

select public.borrar_datos_de_ejemplo();

with nuevas (n, nombre, barrio, tipo, operacion, precio, hab, banos, parq, area, estrato, lat, lng, destacada, descripcion) as (values
  (1, 'Casa de dos pisos con patio', 'Caobos', 'Casa', 'venta', 285000000, 3, 2, 1, 120, 4, 7.9005, -72.4990, true,
      'Casa de dos pisos con patio trasero, cocina abierta y terraza.'),
  (2, 'Apartamento con balcón', 'La Riviera', 'Apartamento', 'venta', 210000000, 2, 1, 0, 68, 4, 7.9080, -72.4930, false,
      'Apartamento en tercer piso con balcón y buena ventilación.'),
  (3, 'Casa esquinera remodelada', 'Prados del Este', 'Casa', 'venta', 340000000, 4, 3, 2, 160, 5, 7.8960, -72.4800, true,
      'Casa esquinera remodelada, con dos parqueaderos y jardín.'),
  (4, 'Apartaestudio amoblado', 'Quinta Oriental', 'Apartamento', 'arriendo', 1200000, 1, 1, 0, 42, 4, 7.8890, -72.4960, false,
      'Apartaestudio amoblado, listo para entrar a vivir.'),
  (5, 'Casa de un piso con garaje', 'Los Pinos', 'Casa', 'venta', 198000000, 3, 2, 1, 98, 3, 7.8820, -72.5050, false,
      'Casa de un piso con garaje cubierto y patio de ropas.'),
  (6, 'Apartamento en torre con piscina', 'Ceiba II', 'Apartamento', 'venta', 265000000, 3, 2, 1, 84, 4, 7.9150, -72.5000, false,
      'Apartamento en torre con piscina, gimnasio y portería.'))
insert into public.viviendas (nombre, barrio, tipo, operacion, precio_cop, habitaciones, banos, parqueaderos,
  area_m2, estrato, ubicacion, destacada, descripcion, publicada, es_ejemplo, ocultar_ubicacion_exacta)
select nombre, barrio, tipo, operacion, precio, hab, banos, parq, area, estrato,
       extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
       destacada, descripcion, true, true, true
from nuevas order by n;

-- Los puntos de ejemplo, a distancias y rumbos fijos de cada vivienda.
with patron (subcategoria, categoria, metros, rumbo) as (values
  ('Colegio', 'educacion', 400, 20), ('Jardín infantil', 'educacion', 650, 200),
  ('Ruta de bus', 'transporte', 150, 110), ('Paradero', 'transporte', 420, 290),
  ('Supermercado', 'comercio', 300, 70), ('Tienda', 'comercio', 120, 160), ('Droguería', 'comercio', 520, 330),
  ('Parque', 'zonas_verdes', 450, 250))
insert into public.puntos_interes (nombre, subcategoria, categoria, ubicacion, fuente, modulo_origen)
select p.subcategoria || ' de ejemplo · ' || v.barrio, p.subcategoria, p.categoria,
       extensions.st_project(v.ubicacion, p.metros, radians(p.rumbo)), 'ejemplo', 'ejemplo'
from public.viviendas v cross join patron p
where v.es_ejemplo;

select public.calcular_analisis_ubicacion(id) from public.viviendas where es_ejemplo;
select public.generar_fortalezas(id) from public.viviendas where es_ejemplo;

insert into public.vivienda_caracteristicas (vivienda_id, icono, texto, orden)
select v.id, c.icono, c.texto, c.orden
from public.viviendas v
cross join (values ('cocina', 'Cocina integral', 1), ('ventilacion', 'Buena ventilación', 2),
                   ('agua', 'Agua caliente', 3)) as c(icono, texto, orden)
where v.es_ejemplo;
