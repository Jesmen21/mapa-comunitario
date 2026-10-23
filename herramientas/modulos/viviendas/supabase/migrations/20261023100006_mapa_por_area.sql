-- 006 · el mapa pide solo lo que se ve
--
-- viviendas_en_area: las viviendas publicadas dentro del rectángulo visible,
-- con los filtros del buscador. Lee de la vista pública, así que hereda que el
-- punto nunca sea el exacto cuando la vivienda lo oculta.
--
-- La función de puntos de interés por área y zoom (pois_en_area) va en la 009,
-- y no acá como decía la propuesta: usa `activo` y `categorias_poi`, que nacen
-- en esa migración.
--
-- Consultas parametrizadas: la función recibe valores, nunca texto que se pegue
-- en SQL. Sin `execute format`.

create function public.viviendas_en_area(
  p_oeste double precision, p_sur double precision,
  p_este double precision, p_norte double precision,
  p_operacion text default null,
  p_precio_min bigint default null, p_precio_max bigint default null,
  p_habitaciones_min integer default null, p_banos_min integer default null,
  p_tipo text default null,
  p_limite integer default 200)
returns setof public.viviendas_publicas
language sql stable set search_path = '' as $$
  select vp.*
  from public.viviendas_publicas vp
  where vp.ubicacion operator(extensions.&&)
        extensions.st_makeenvelope(p_oeste, p_sur, p_este, p_norte, 4326)::extensions.geography
    and (p_operacion is null or vp.operacion = p_operacion)
    and (p_precio_min is null or vp.precio_cop >= p_precio_min)
    and (p_precio_max is null or vp.precio_cop <= p_precio_max)
    and (p_habitaciones_min is null or vp.habitaciones >= p_habitaciones_min)
    and (p_banos_min is null or vp.banos >= p_banos_min)
    and (p_tipo is null or vp.tipo = p_tipo)
  order by vp.destacada desc, vp.actualizada_en desc
  limit least(greatest(coalesce(p_limite, 200), 1), 500)
$$;
grant execute on function public.viviendas_en_area(double precision, double precision,
  double precision, double precision, text, bigint, bigint, integer, integer, text, integer)
  to anon, authenticated;
