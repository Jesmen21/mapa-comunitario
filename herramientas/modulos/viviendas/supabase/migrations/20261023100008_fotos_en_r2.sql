-- 008 · las fotos viven en R2
--
-- `ruta` (una ruta del bucket de Supabase) se reemplaza por la clave del objeto
-- en R2 y las tres URL que genera el navegador al subir, en WebP. 0 filas
-- medidas en la base viva el 2026-10-23: no hay nada que migrar.
--
-- «Valida tamaño y formato antes de aceptarlos» (prompt §7): la base es la
-- última barrera, no la única. La función que firma la subida (Fase 3) valida
-- primero. El techo de 5 MB por archivo es un tope duro de la base; el peso que
-- se pide de verdad (mucho menor) lo decide la Fase 3 con medición.

alter table public.vivienda_fotos drop column ruta;
alter table public.vivienda_fotos
  add column clave_r2 text not null
    constraint fotos_clave_unica unique
    constraint fotos_clave_formato check (clave_r2 ~ '^[a-z0-9/_.-]+\.webp$'),
  add column url_miniatura text not null constraint fotos_url_miniatura_https check (url_miniatura ~ '^https://'),
  add column url_mediana text not null constraint fotos_url_mediana_https check (url_mediana ~ '^https://'),
  add column url_grande text not null constraint fotos_url_grande_https check (url_grande ~ '^https://'),
  add column ancho integer not null constraint fotos_ancho_check check (ancho between 1 and 8192),
  add column alto integer not null constraint fotos_alto_check check (alto between 1 and 8192),
  add column peso_bytes integer not null constraint fotos_peso_check check (peso_bytes between 1 and 5242880),
  add column es_portada boolean not null default false,
  add column texto_alternativo text constraint fotos_alt_largo check (char_length(texto_alternativo) <= 160);
create unique index vivienda_fotos_una_portada on public.vivienda_fotos (vivienda_id) where es_portada;
create index vivienda_fotos_vivienda_idx on public.vivienda_fotos (vivienda_id, orden);
