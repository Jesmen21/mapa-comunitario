# URBIS - mapa estético para Movilidad

Cambio aplicado:

- El mapa automático de Movilidad (`mobilityPoi`) dejó de usar OpenStreetMap estándar, porque se veía cargado y con demasiada información visual.
- Ahora usa una base CARTO clara (`light_all`), más limpia, minimalista y estética.
- Mantiene calles y etiquetas urbanas, pero reduce el ruido visual para que la ruta, el pin y los controles de URBIS resalten mejor.
- Se corrigió además una clave duplicada en los mapas base: el mapa oscuro ahora usa `cartoDarkMatter` y el claro conserva `cartoLightMatter`.

Objetivo visual:

- Menos saturación de nombres.
- Más espacio visual para la ruta.
- Apariencia más moderna y tipo app.
- Mejor contraste con el láser/ruta celeste y los pines.
