# URBIS Cleanup — 2026-05-11

## Cambios realizados

### 1. Limpieza de versiones viejas
- Se eliminó la carpeta `.git` del entregable para reducir peso.
- Se movieron módulos JS/CSS no cargados o neutralizados a `_legacy_removed/`.
- El proyecto queda más liviano y con menos ruido para continuar desarrollo.

### 2. Separación móvil / escritorio
- Nuevo `js/00-app-shell.js`.
- Nuevo `css/00-app-shell.css`.
- El body recibe clases de modo:
  - `urbis-shell-mobile`
  - `urbis-shell-desktop`
- En móvil se oculta el panel desktop y se prioriza la app móvil.
- En escritorio se oculta la capa móvil y el shell flotante de movilidad.

### 3. Movilidad con estado centralizado
- Nuevo `js/37-mobility-state-controller.js`.
- Expone `window.URBIS_MOBILITY_STATE` con:
  - `setOrigin()`
  - `setDestination()`
  - `clearDestination()`
  - `setTransport()`
  - `requestGPS()`
  - `startRoute()`
  - `finishRoute()`
  - `snapshot()`
- Mantiene compatibilidad con funciones existentes como `iniciarRutaHacia()` y `limpiarRutaReal()`.
- Sincroniza variables antiguas usadas por el proyecto: `destinoSeleccionado`, `urbisDestinoSeleccionado`, `destinoActual`, `routeRealPointA`, `routeRealPointB`.

## Archivos nuevos

- `js/00-app-shell.js`
- `js/37-mobility-state-controller.js`
- `css/00-app-shell.css`
- `docs/URBIS-CLEANUP-2026-05-11.md`

## Archivos movidos a `_legacy_removed/`

- `js/00-mobile-boot-priority.js`
- `js/00-mobile-clean-boot.js`
- `js/19-mobile-own-app.js`
- `js/24-mobile-login-rescue.js`
- `js/25-sheetdb-resilience.js`
- `js/26-android-splash-boot.js`
- `js/29-mobility-compact-controller.js`
- `js/30-destination-transport-bubble.js`
- `js/31-force-destination-flow.js`
- `js/34-destination-architect-flow.js`
- `js/35-mobility-search-persistent.js`
- `css/00-mobile-clean-boot.css`
- `css/18-mobile-login-rescue.css`
- `css/19-mobile-boot-priority.css`
- `css/20-android-splash-boot.css`
- `css/31-mobility-compact-ui.css`
- `css/32-destination-transport-bubble.css`
- `css/33-force-destination-flow.css`
- `css/34-destination-architect-flow.css`

## Validación realizada

- Se verificó que todos los scripts referenciados en `index.html` existan.
- Se verificó que todos los CSS importados en `css/main.css` existan.
- Se ejecutó `node --check` sobre los archivos JS y no se detectaron errores de sintaxis.

## Pendiente recomendado

- Probar visualmente en navegador con vista móvil y escritorio.
- Luego migrar autenticación admin/JAC a backend o Firebase/Supabase.
- En una siguiente fase, dividir `05-helpers-temporal-security.js`, porque todavía concentra demasiada lógica histórica.
