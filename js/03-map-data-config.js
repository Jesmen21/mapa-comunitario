// ==========================================
  // CLASIFICACIONES INTACTAS Y EXPANDIDAS (15 DIMENSIONES)
  // ==========================================
  const map = L.map('map', { maxZoom: 22 }).setView(window.URBIS_CONFIG.DEFAULT_CENTER, window.URBIS_CONFIG.DEFAULT_ZOOM);
  // window.map queda apuntando al <div id="map"> por auto-globals del navegador
  // (no a esta instancia de Leaflet), lo que rompe cualquier código que use
  // `window.map || window.urbisMap` para encontrar el mapa real (ej. el
  // optimizador de zoom): como window.map ya es "verdadero" (es un nodo DOM),
  // el `||` nunca llega a mirar urbisMap. Sobrescribimos ambos con la
  // instancia real de Leaflet para que cualquier código que la busque la
  // encuentre, sin tener que tocar cada punto que la consulta.
  window.urbisMap = map;
  window.map = map;
  // Al hacer mucho zoom, las bases CARTO (pálidas) se realzan con un filtro
  // (clase urbis-deep-zoom) para que las vías no se pierdan al upscalar.
  function _urbisActualizarDeepZoom(){ try{ document.body.classList.toggle('urbis-deep-zoom', map.getZoom() >= 19); }catch(e){} }
  map.on('zoomend', _urbisActualizarDeepZoom);
  map.whenReady(_urbisActualizarDeepZoom);
  let tempMarker = null;
  let charts = {};
  let zonasLayer = L.layerGroup().addTo(map);
  let rutaLayer = L.layerGroup().addTo(map);
  let userTraceLayer = L.layerGroup().addTo(map);
  let autoMapeoCucutaLayer = L.layerGroup().addTo(map);
  let controlVialLayer = L.layerGroup().addTo(map);
  let controlVialData = [];
  let autoMapeoCucutaCategorias = {};
  let autoMapeoCucutaData = [];
  let autoMapeoCucutaRegistros = [];
  let autoMapeoAutoCargado = false;
  let anexandoAutoMapeoMasivo = false;
  let userWatchId = null;
  let userPositionMarker = null;
  let userLastLatLng = null;
  let gpsTrail = [];
  let modoRutaManual = false;
  let rutaManualOrigen = null;
  let simLayer = L.layerGroup().addTo(map); // capa antigua reservada, sin simulación activa
  let zonaImpactoLayer = L.layerGroup().addTo(map); // zonas de afección visual por reporte
