# URBIS V16

Correcciones: género solo femenino/masculino y menús desplegables legibles.


## V18

- Al tocar un destino en el mapa, URBIS cambia automáticamente a una pantalla limpia de movilidad.
- La barra lateral y los controles secundarios se ocultan de inmediato.
- El usuario ve una tarjeta central para elegir cómo llegar e iniciar el recorrido.


## V19
- Agrega voz GPS con Web Speech API para indicaciones, giros, alertas de tráfico, cámaras/fotomultas, retenes y novedades de movilidad cercanas.

## V36 - Corrección de contraste

- Se mantiene la identidad URBIS Ciudad viva con logo y tipografía.
- Se recupera alto contraste en login, sidebar y paneles internos.
- La marca verde se usa como acento sobre una base oscura/premium para mejorar legibilidad.


## V38 - Foco por módulo

- Los accesos funcionan como menú principal.
- Al entrar a un módulo se ocultan los demás accesos.
- Se agregó botón minimalista para volver al menú de accesos.


## V63
- Voz GPS con instrucciones por progreso sobre ruta.
- Alertas URBIS de movilidad anunciadas solo si afectan la ruta.
- Registro local de eventos de movilidad para futura sincronización con Excel/SheetDB.


## URBIS V69 - Corrección modo Movilidad

Cambios aplicados:
- Se ocultaron controles de Tráfico, Cámaras y Alertas dentro del mapa de Movilidad cuando no tienen función real.
- El tráfico se renderiza únicamente sobre la ruta activa, no como capa global del mapa.
- Se agregó render visual por segmentos: verde fluido, naranja moderado y rojo congestión.
- Se piden rutas alternativas al motor de rutas público usado por la demo y se dibuja una alternativa si está disponible.
- Se agregó configuración `URBIS_CONFIG.TRAFFIC` para conectar luego Google Directions, Mapbox Traffic, HERE u OpenRouteService mediante backend/proxy seguro.
- Se corrigió el render de avatares PNG para respetar transparencia alpha y evitar fondos negros en Android, iPhone y PWA.


## URBIS V70 · Movilidad contextual
- Movilidad ahora transforma la barra inferior: Runner pasa a Destinos y Perfil pasa a Multimapas solo dentro del modo Movilidad.
- Fuera de Movilidad se restaura la interfaz original: Runner, Perfil e iconografía normal.
- Se elimina el botón duplicado Ubicar en Movilidad; queda solo el GPS minimalista del header.
- Multimapas usa el selector real de mapas base existente, sin botones decorativos.
- Destinos muestra estados reales o vacíos limpios, sin métricas inventadas.
