-- 014 · el retiro del bucket `viviendas-fotos`
--
-- Las imágenes van a R2 (decisión 3-02). MEDIDO en la base viva el
-- 2026-10-23: el bucket es público y tiene 0 objetos.
--
-- Supabase prohíbe borrar de las tablas de storage por SQL (disparador
-- storage.protect_delete) y deja hacerlo declarando storage.allow_delete_query
-- en la sesión. La protección existe para no dejar objetos huérfanos; por eso
-- esta migración COMPRUEBA primero que el bucket siga vacío y, si no lo está,
-- se detiene sin borrar nada. Un bucket con archivos se retira por la API de
-- Storage, que borra los archivos con él, nunca desde acá.

do $$
declare n bigint;
begin
  if not exists (select 1 from storage.buckets where id = 'viviendas-fotos') then
    raise notice 'El bucket viviendas-fotos ya no existe: nada que retirar.';
    return;
  end if;
  select count(*) into n from storage.objects where bucket_id = 'viviendas-fotos';
  if n > 0 then
    raise exception 'El bucket viviendas-fotos tiene % objetos: no se retira por SQL. Vacíalo por la API de Storage.', n;
  end if;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = 'viviendas-fotos';
  perform set_config('storage.allow_delete_query', 'false', true);
end $$;
