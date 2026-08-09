# URBIS - Mapa base específico para Movilidad

Cambios aplicados:

- Se agregó el mapa base `mobilityPoi` usando OpenStreetMap estándar.
- Este mapa muestra calles, nombres urbanos y puntos de interés como comercios/servicios cuando están disponibles en la zona.
- Al entrar a Movilidad, URBIS cambia automáticamente a `mobilityPoi`.
- Al salir de Movilidad, vuelve al mapa base anterior o al mapa normal `actual`.
- El selector Multimapas de Movilidad ahora incluye esta base como recomendada.
- `cambiarMapaBase(key, { silent:true })` permite cambiar el mapa sin abrir el panel de capas.

Nota: Google Streets ya existía como opción manual (`googleRoads`), pero se dejó `mobilityPoi` como valor automático para evitar depender de una API no configurada y mantener una base libre basada en OpenStreetMap.
