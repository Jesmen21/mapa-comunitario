-- 005 · vista pública (falla 1: la ubicación exacta sale al público)
--
-- MEDIDO en la base viva el 2026-10-23: las dos casas de ejemplo están
-- publicadas y `ubicacion` se entrega a anon con 4 y 3 decimales.
--
-- Cómo se cierra, y por qué así y no con una vista de privilegios de dueño:
--   * `ubicacion_publica` es una COLUMNA, calculada por disparador. Cuando
--     `ocultar_ubicacion_exacta` es verdadero, el punto se desplaza entre 80 y
--     150 m en un rumbo fijo para cada vivienda; si es falso, es el exacto.
--   * El desplazamiento es determinista por vivienda (no cambia entre
--     recargas, así que no se puede promediar) y lleva una SAL secreta: sin
--     ella, quien conozca el id y el método podría deshacerlo. La sal vive en
--     `privado.secretos`, que la API no alcanza.
--   * anon y authenticated NO tienen permiso de columna sobre `ubicacion`
--     (002). La vista es de privilegios del que consulta (security_invoker),
--     así que no abre nada que la tabla no abra: no hay puerta lateral.
--   * Lo que se muestra deriva de `publicada` (falla 7): la vista solo trae las
--     publicadas, con su `estado` para que la ficha diga «Apartada» o «Vendida».
--
-- Y lo que esta migración decide del análisis, anotado para Daniel: TODA
-- distancia pública se mide desde el punto público. Si se midiera desde el
-- exacto, tres distancias redondeadas a 50 m bastan para triangular la casa
-- con más precisión que el desplazamiento; y el mapa, que dibuja el radio
-- alrededor del punto público, contradiría al texto (regla de credibilidad).

create table privado.secretos (
  clave text primary key,
  valor text not null,
  creada_en timestamptz not null default now()
);
revoke all on privado.secretos from public, anon, authenticated;
insert into privado.secretos (clave, valor)
values ('sal_ubicacion', encode(extensions.gen_random_bytes(32), 'hex'));

alter table public.viviendas add column ubicacion_publica extensions.geography(Point, 4326);

create function privado.desplazar_punto(p_id uuid, p_punto extensions.geography) returns extensions.geography
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_sal text := (select valor from privado.secretos where clave = 'sal_ubicacion');
  v_h text := md5(p_id::text || v_sal);
  v_rumbo double precision := (abs(('x' || substr(v_h, 1, 8))::bit(32)::bigint) % 3600) / 10.0;
  v_metros double precision := 80 + (abs(('x' || substr(v_h, 9, 8))::bit(32)::bigint) % 7001) / 100.0;
begin
  if v_sal is null then
    raise exception 'Falta la sal de ubicación en privado.secretos: no se publica un punto sin desplazar.';
  end if;
  return extensions.st_project(p_punto, v_metros, radians(v_rumbo));
end $$;
revoke execute on function privado.desplazar_punto(uuid, extensions.geography) from public;

create function privado.poner_ubicacion_publica() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.ocultar_ubicacion_exacta then
    new.ubicacion_publica := privado.desplazar_punto(new.id, new.ubicacion);
  else
    new.ubicacion_publica := new.ubicacion;
  end if;
  return new;
end $$;
revoke execute on function privado.poner_ubicacion_publica() from public;

create trigger viviendas_ubicacion_publica
  before insert or update of ubicacion, ocultar_ubicacion_exacta on public.viviendas
  for each row execute function privado.poner_ubicacion_publica();

update public.viviendas set ocultar_ubicacion_exacta = ocultar_ubicacion_exacta;  -- calcula las que ya existen
alter table public.viviendas alter column ubicacion_publica set not null;
create index viviendas_ubicacion_publica_idx on public.viviendas using gist (ubicacion_publica);

grant select (ubicacion_publica) on public.viviendas to anon, authenticated;

create view public.viviendas_publicas with (security_invoker = true) as
select v.id, v.slug, v.nombre, v.tipo, v.operacion, v.precio_cop, v.administracion_cop,
       v.area_m2, v.habitaciones, v.banos, v.parqueaderos, v.estrato, v.antiguedad_anios,
       v.barrio, v.direccion_aproximada, v.descripcion, v.por_que_comprar,
       v.destacada, v.estado, v.vistas, v.es_ejemplo,
       v.ocultar_ubicacion_exacta as ubicacion_aproximada,
       v.ubicacion_publica as ubicacion,
       extensions.st_y(v.ubicacion_publica::extensions.geometry) as lat,
       extensions.st_x(v.ubicacion_publica::extensions.geometry) as lng,
       v.creada_en, v.actualizada_en
from public.viviendas v
where v.publicada;
comment on view public.viviendas_publicas is
  'Lo que la app pública y el mapa leen. Nunca el punto exacto cuando la vivienda lo oculta.';
grant select on public.viviendas_publicas to anon, authenticated;

-- El admin necesita el punto exacto para el panel. Sale por una función que
-- pregunta el rol, nunca por un permiso de columna (que alcanzaría a toda
-- cuenta con sesión).
create function public.ubicacion_exacta(p_vivienda uuid)
  returns table (lat double precision, lng double precision)
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el admin ve la ubicación exacta.' using errcode = '42501';
  end if;
  return query
    select extensions.st_y(v.ubicacion::extensions.geometry), extensions.st_x(v.ubicacion::extensions.geometry)
    from public.viviendas v where v.id = p_vivienda;
end $$;
revoke execute on function public.ubicacion_exacta(uuid) from public, anon;
grant execute on function public.ubicacion_exacta(uuid) to authenticated;
