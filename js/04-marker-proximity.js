/* URBIS V46 MOBILE FIX - panel de capas bottom sheet + safe mobile */
// ==========================================
  // URBIS V6 ESTABLE: AGRUPAR / COMPACTAR SIN ROMPER LOGIN
  // ==========================================
  let urbisProximityMarkers = [];
  let urbisProximityClusterLayer = L.layerGroup().addTo(map);
  let urbisProximityTimer = null;

  function urbisResetProximityRegistry(source = null) {
      if(source) {
          urbisProximityMarkers = urbisProximityMarkers.filter(item => item.source !== source);
      } else {
          urbisProximityMarkers = [];
      }
      if(urbisProximityClusterLayer) urbisProximityClusterLayer.clearLayers();
  }

  function urbisRegisterProximityMarker(marker, baseLatLng, meta = {}, source = 'report') {
      if(!marker || !baseLatLng) return;
      const latlng = L.latLng(baseLatLng);
      urbisProximityMarkers.push({ marker, latlng, meta: meta || {}, source });
  }

  function urbisDistancePx(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
  }

  function urbisBuildProximityGroups(thresholdPx = 38) {
      const items = urbisProximityMarkers
          .filter(item => item && item.marker && item.latlng)
          .filter(item => {
              try { return map.hasLayer(item.marker); }
              catch(e) { return false; }
          })
          .map(item => ({
              ...item,
              point: map.latLngToLayerPoint(item.latlng)
          }));

      const visited = new Set();
      const groups = [];

      for(let i = 0; i < items.length; i++) {
          if(visited.has(i)) continue;

          const queue = [i];
          const group = [];
          visited.add(i);

          while(queue.length) {
              const current = queue.shift();
              group.push(items[current]);

              for(let j = 0; j < items.length; j++) {
                  if(visited.has(j)) continue;
                  if(urbisDistancePx(items[current].point, items[j].point) <= thresholdPx) {
                      visited.add(j);
                      queue.push(j);
                  }
              }
          }

          groups.push(group);
      }

      return groups;
  }

  function urbisCreateGeneralClusterIcon(count, sampleEmoji = '📍') {
      const safeCount = Number(count) || 0;
      return L.divIcon({
          className: 'urbis-cluster-root',
          html: `<div class="urbis-cluster-icon" data-count="${safeCount}" title="${safeCount} puntos cercanos">${sampleEmoji}</div>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21]
      });
  }

  function urbisGroupCenterLatLng(group) {
      const lat = group.reduce((acc, item) => acc + item.latlng.lat, 0) / group.length;
      const lng = group.reduce((acc, item) => acc + item.latlng.lng, 0) / group.length;
      return L.latLng(lat, lng);
  }

  function urbisSetMarkerDisplay(marker, displayValue) {
      const el = marker && marker.getElement ? marker.getElement() : null;
      if(el) el.style.display = displayValue;
  }

  function urbisSetMarkerCompact(marker, compact) {
      const el = marker && marker.getElement ? marker.getElement() : null;
      if(el) el.classList.toggle('urbis-compact-root', !!compact);
  }

  function urbisApplyProximityMode() {
      // V34: desactivado. Ya no compacta, oculta ni agrupa marcadores.
      // Esto evita que en móvil los iconos “vuelen” o se reacomoden al hacer zoom.
      if(urbisProximityClusterLayer) urbisProximityClusterLayer.clearLayers();
      urbisProximityMarkers.forEach(item => {
          urbisSetMarkerDisplay(item.marker, '');
          urbisSetMarkerCompact(item.marker, false);
      });
  }

  function urbisApplyProximityModeDebounced() {
      clearTimeout(urbisProximityTimer);
      urbisApplyProximityMode();
  }

  // V34: sin listeners de zoom/move para no recalcular posiciones visuales durante gestos táctiles.
  map.whenReady(urbisApplyProximityMode);

  let modoSimuladorGPS = false;
  let simPointA = null;
  let simPointB = null;
  let simVehicleMarker = null;
  let simAnimationTimer = null;
  let simAnimationProgress = 0;
  let simRouteInfo = null;
  let simRoutePath = [];
  let simBaseRouteLine = null;
  let simCompletedRouteLine = null;
  let simRemainingRouteLine = null;
  let routeRealPointA = null;
  let routeRealPointB = null;
  let routeRealMode = 'car';
  let routeRealGeoJSON = null;
  let routeRealSteps = [];
  let routeRealLastResult = null;
  let routeRealAutoDestino = false;
  let ultimoDestinoRapido = null;
  let timelineSelectedTime = null;
  let timelineLiveMode = true;
  const TTL_HORAS_REPORTES_TEMPORALES = window.URBIS_CONFIG.TEMP_REPORT_TTL_HOURS;
  const TIMELINE_EXTRA_OFFSET = 8; 

  // ── Ficha del edificio: materialidad y pisos ──────────────────────────────
  // La descripción es una cadena separada por " | " con posiciones fijas, así
  // que un campo nuevo SOLO puede ir al final: meterlo en medio corre todos los
  // índices y rompe cuanto se haya mapeado. Estos dos van después del bloque
  // temporal; en un registro viejo salen vacíos y toman su valor por defecto.
  // Se calculan, no se escriben a mano, porque BASE_OFFSET depende de cuántos
  // usos tenga la matriz y esa lista crece.
  // No se guarda el índice en una constante: depende de cuántos usos tenga la
  // matriz, y esa lista crece. `leerEdificio` lo calcula en cada llamada.
  // El vocabulario del edificio (listas, salidas y el cruce de vulnerabilidad)
  // vive en js/03b, porque la página de análisis también lo necesita y no puede
  // cargar este archivo: js/04 arrastra Leaflet y el mapa entero. Aquí se toman
  // esas constantes del objeto ya publicado.
  // Se lee en cada llamada y NO se captura al cargar: js/03b puede publicarse
  // antes o después según la página, y una copia tomada en el momento
  // equivocado dejaría stubs silenciosos calculando mal para siempre. Un
  // vocabulario ausente es un error de despliegue, no un caso a tolerar: se
  // avisa por consola en vez de devolver datos inventados.
  let avisado = false;
  function VOC(){
    const v = window.URBIS_EDIFICIO;
    if (v && v.vulnerabilidadDe) return v;
    if (!avisado) {
      avisado = true;
      console.error('URBIS: falta js/03b-edificio-vocabulario.js — la ficha del ' +
                    'edificio no se podrá interpretar.');
    }
    return null;
  }
  const MATERIALIDAD_NA = 'Sin registrar';
  function valorUtil(v){
    const V = VOC();
    return V ? V.valorUtil(v) : '';
  }
  function vulnerabilidadDe(mat, ep){
    const V = VOC();
    return V ? V.vulnerabilidadDe(mat, ep) : null;
  }
  function esFrenteMuertoVoc(v){
    const V = VOC();
    return V ? V.esFrenteMuerto(v) : false;
  }

  // Dónde tiene sentido preguntar por materialidad y pisos. En un hueco de la
  // vía o una alerta de tráfico no hay edificio que describir, y preguntarlo
  // solo estorba a quien reporta.
  const CATEGORIAS_EDIFICIO = new Set([
    'Vivienda y Residencial', 'Comercio y Servicios', 'Grandes Equipamientos',
    'Áreas Deportivas', 'Salud y Emergencias', 'Patrimonio y Turismo',
    'Industria y Logística', 'Oficinas y Co-working', 'Servicios Ocultos',
    'Animal y Bienestar'
  ]);
  function esCategoriaEdificio(cat){ return CATEGORIAS_EDIFICIO.has(String(cat || '')); }

  // ¿El texto guardado es de verdad un valor del vocabulario del edificio?
  // La casilla de la materialidad se compartió durante un tiempo con las
  // validaciones ciudadanas y con la carpeta de Pro City (ver URBIS_SLOTS), así
  // que ahí puede haber un blob "VALIDACIONES_URBIS:…" o un código de carpeta
  // de seis caracteres. Nada de eso es una observación de campo: si no está en
  // la lista, el dato NO se registró, y decirlo así es lo único honesto.
  function delVocabulario(valor, lista){
    const t = String(valor || '').trim();
    if (!t) return '';
    return (lista || []).indexOf(t) !== -1 ? t : '';
  }

  // Lee la ficha del edificio de una descripción ya guardada.
  function leerEdificio(descripcion){
    const d = String(descripcion || '').split(' | ');
    const V0 = VOC();
    const base = URBIS_SLOTS.edificioMaterialidad;
    const mat = delVocabulario(d[base], V0 && V0.MATERIALIDAD);
    const pisosCrudo = parseInt(d[base + 1], 10);
    // Un edificio siempre tiene al menos un piso: 0 o vacío significa "no lo
    // registraron", no "no tiene". Se devuelve 1 para que el análisis no
    // castigue a lo que se mapeó antes de que este campo existiera.
    const pisos = isFinite(pisosCrudo) && pisosCrudo > 0 ? Math.min(pisosCrudo, 60) : 1;
    const epocaCruda = delVocabulario(d[base + 3], V0 && V0.EPOCA);
    const epoca = valorUtil(epocaCruda);
    const pbCruda = delVocabulario(d[base + 2], V0 && V0.PLANTA_BAJA);
    const plantaBaja = valorUtil(pbCruda);
    const otroTexto = (d[base + 4] || '').trim();
    const crudos = [mat, pbCruda, epocaCruda];
    const V = V0;
    /* Piso por piso. Si el estudiante repartió los usos por planta y no
       escribió el número de pisos, el número es cuántas plantas repartió:
       no se le puede pedir que lo diga dos veces. */
    const usosPorPiso = (V0 && V0.leerPisos) ? V0.leerPisos(d[URBIS_SLOTS.edificioUsosPorPiso]) : [];
    const pisosDeUsos = usosPorPiso.length ? usosPorPiso[usosPorPiso.length - 1].piso : 0;
    const pisosFinal = (isFinite(pisosCrudo) && pisosCrudo > 0) ? pisos : (pisosDeUsos || pisos);
    return {
      materialidad: mat && mat !== 'undefined' ? mat : MATERIALIDAD_NA,
      // Utilizable para cálculo: '' en cuanto sea "sin registrar", "no se sabe"
      // u "otro". El valor crudo se conserva para poder informarlo.
      materialidadUtil: valorUtil(mat),
      noSeSabe: crudos.filter(v => V && v === V.NO_SE_SABE).length,
      otros: crudos.filter(v => V && v === V.OTRO).length,
      otroTexto: otroTexto && otroTexto !== 'undefined' ? otroTexto : '',
      pisos: pisosFinal,
      pisosRegistrados: (isFinite(pisosCrudo) && pisosCrudo > 0) || pisosDeUsos > 0,
      usosPorPiso: usosPorPiso,
      mezcla: (V0 && V0.mezclaDe) ? V0.mezclaDe(usosPorPiso) : { pisos: 0, usos: [], mixto: false, resumen: '' },
      plantaBaja: plantaBaja,
      // null = no se registró, y entonces el análisis se comporta como siempre.
      // Distinguirlo de `false` importa: "no lo miramos" no es "no hay frente".
      frenteActivo: plantaBaja ? !esFrenteMuertoVoc(plantaBaja) : null,
      epoca: epoca,
      enObra: epoca === 'En construcción',
      vulnerabilidad: vulnerabilidadDe(valorUtil(mat), epoca),
      idxMaterialidad: URBIS_SLOTS.edificioMaterialidad,
      idxPisos: URBIS_SLOTS.edificioPisos,
      idxPlantaBaja: URBIS_SLOTS.edificioPlantaBaja,
      idxEpoca: URBIS_SLOTS.edificioEpoca,
      idxOtroTexto: URBIS_SLOTS.edificioOtroTexto,
      idxUsosPorPiso: URBIS_SLOTS.edificioUsosPorPiso
    };
  }

  // Los usos que el estudiante marcó en la matriz, por nombre.
  function leerUsosMarcados(descripcion){
    const d = String(descripcion || '').split(' | ');
    const out = [];
    for (let j = 0; j < todosLosUsos.length; j++) {
      if ((d[6 + j] || '').toUpperCase() === 'SI') out.push(todosLosUsos[j]);
    }
    return out;
  }

  const mapasBase = {
    actual: {
      nombre: 'Mapa actual urbano', desc: 'Base limpia por defecto para edición y reportes.', icon: '□', badge: 'DEF',
      layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 22, maxNativeZoom: 20, className: 'urbis-tile-boost', attribution: '&copy; OpenStreetMap &copy; CARTO' })
    },
    mobilityPoi: {
      nombre: 'Movilidad estética', desc: 'Base minimalista para rutas: calles limpias, etiquetas suaves y puntos urbanos sin saturar la pantalla.', icon: '🚗', badge: 'GPS',
      layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 22, maxNativeZoom: 20, className: 'urbis-tile-boost', attribution: '&copy; OpenStreetMap &copy; CARTO' })
    },
    esriHD: {
      nombre: 'Satélite HD', desc: 'Imagen aérea de alta definición para lectura urbana.', icon: '◇', badge: 'HD',
      layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 19, attribution: 'Tiles &copy; Esri' })
    },
    esriClarity: {
      nombre: 'Satélite Clarity', desc: 'Alternativa satelital con contraste para cubiertas y lotes.', icon: '◌', badge: 'SAT',
      layer: L.tileLayer('https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 19, attribution: 'Tiles &copy; Esri' })
    },
    googleSat: {
      nombre: 'Satélite urbano', desc: 'Vista aérea detallada para manzanas y edificaciones.', icon: '▣', badge: 'SAT',
      layer: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 22, maxNativeZoom: 21, attribution: 'Imagery &copy; Google' })
    },
    googleHybrid: {
      nombre: 'Satélite + vías', desc: 'Imagen con nombres de calles para diagnóstico territorial.', icon: '▧', badge: 'HÍB',
      layer: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 22, maxNativeZoom: 21, attribution: 'Imagery &copy; Google' })
    },
    googleTerrain: {
      nombre: 'Relieve urbano', desc: 'Terreno y formas del suelo para lectura topográfica.', icon: '△', badge: 'TOPO',
      layer: L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', { maxZoom: 22, maxNativeZoom: 21, attribution: 'Imagery &copy; Google' })
    },
    googleRoads: {
      nombre: 'Google calles', desc: 'Base clara de vías, útil para ciudadanía y rutas.', icon: '═', badge: 'VÍA',
      layer: L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 22, maxNativeZoom: 21, attribution: 'Map data &copy; Google' })
    },
    googleTerrainHybrid: {
      nombre: 'Terreno + vías', desc: 'Relieve con nombres y estructura vial.', icon: '▵', badge: 'REL',
      layer: L.tileLayer('https://mt1.google.com/vt/lyrs=t,r&x={x}&y={y}&z={z}', { maxZoom: 22, maxNativeZoom: 21, attribution: 'Map data &copy; Google' })
    },
    cartoDarkMatter: {
      nombre: 'Nocturno urbano', desc: 'Mapa oscuro para resaltar puntos, heatmaps y rutas.', icon: '●', badge: 'NOC',
      layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 22, maxNativeZoom: 20, className: 'urbis-tile-boost', attribution: '&copy; OpenStreetMap &copy; CARTO' })
    },
    cartoLightMatter: {
      nombre: 'Claro técnico', desc: 'Base limpia para planos, edición y lectura de capas.', icon: '○', badge: 'TEC',
      layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 22, maxNativeZoom: 20, className: 'urbis-tile-boost', attribution: '&copy; OpenStreetMap &copy; CARTO' })
    },
    osmHumanitarian: {
      nombre: 'Humanitario OSM', desc: 'Lectura comunitaria de servicios, barrios y referencias.', icon: '✚', badge: 'COM',
      layer: L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 22, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap contributors, HOT' })
    }
  };
  let mapaBaseActual = 'googleHybrid';
  mapasBase[mapaBaseActual].layer.addTo(map);

  window.URBIS_BASEMAPS = window.URBIS_BASEMAPS || {};
  window.URBIS_BASEMAPS.defaultKey = 'googleHybrid';
  window.URBIS_BASEMAPS.mobilityKey = 'mobilityPoi';
  window.URBIS_BASEMAPS.getCurrent = function(){ return mapaBaseActual; };
  window.URBIS_BASEMAPS.has = function(key){ return !!mapasBase[key]; };
  window.URBIS_BASEMAPS.list = function(){
      return Object.keys(mapasBase).map(key => ({
          key,
          nombre: mapasBase[key].nombre,
          desc: mapasBase[key].desc,
          icon: mapasBase[key].icon,
          badge: mapasBase[key].badge,
          active: key === mapaBaseActual
      }));
  };

  // ── Miniatura real de cada mapa ──────────────────────────────────────────
  // Un símbolo (□ ◇ ▣) no dice cómo se ve el mapa; hay que probarlos uno por
  // uno para saber cuál se quiere. En vez de dibujar iconos, se pide UN tile
  // real de la propia capa sobre Cúcuta: la miniatura ES el mapa.
  function _tileMiniatura(layer, lat, lng, z) {
      // Fórmula estándar de Slippy Map (la misma que usa Leaflet internamente).
      const n = Math.pow(2, z);
      const x = Math.floor((lng + 180) / 360 * n);
      const latRad = lat * Math.PI / 180;
      const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
      let url = '';
      try { url = layer._url || ''; } catch (e) { return ''; }
      if (!url) return '';
      return url
        .replace('{s}', 'a')            // subdominio cualquiera de los válidos
        .replace('{z}', z)
        .replace('{x}', x)
        .replace('{y}', y)
        .replace('{r}', '');            // sin @2x: la miniatura es pequeña
  }

  function renderBasemapOptions() {
      const cont = document.getElementById('basemap-options');
      if(!cont) return;
      const c = (window.URBIS_CONFIG && window.URBIS_CONFIG.DEFAULT_CENTER) || [7.8939, -72.5078];
      cont.innerHTML = Object.keys(mapasBase).map(key => {
          const m = mapasBase[key];
          const src = _tileMiniatura(m.layer, c[0], c[1], 14);
          // El símbolo queda de respaldo: si el tile no carga (sin red, o una
          // capa con URL no estándar), el botón sigue siendo reconocible.
          const mini = src
            // Sin loading="lazy" a propósito: el panel puede estar colapsado
            // (0x0) cuando se renderiza, y en ese estado el navegador nunca
            // llega a pedir una imagen diferida. Son 12 tiles de ~15 KB y solo
            // se piden al abrir el panel.
            ? `<span class="basemap-mini" data-fallback="${m.icon}"><img src="${src}" alt="" decoding="async" onerror="this.parentNode.classList.add('sin-tile')"></span>`
            : `<span class="basemap-mini sin-tile" data-fallback="${m.icon}"></span>`;
          return `<button class="basemap-option ${key === mapaBaseActual ? 'active' : ''}" onclick="cambiarMapaBase('${key}')">
              ${mini}
              <span><span class="basemap-name">${m.nombre}</span><span class="basemap-desc">${m.desc}</span></span>
              <span class="basemap-badge">${m.badge}</span>
          </button>`;
      }).join('');
  }

  function syncBasemapA11y(isOpen) {
      const toggleBtn = document.querySelector('.map-toggle-btn');
      const backdrop = document.getElementById('basemap-backdrop');
      if(toggleBtn) toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.classList.toggle('basemap-panel-open', !!isOpen);
      if(backdrop) {
          if(isOpen) backdrop.removeAttribute('hidden');
          else backdrop.setAttribute('hidden', '');
      }
  }

  window.abrirBasemapPanel = function() {
      const panel = document.getElementById('basemap-panel');
      if(!panel) return;
      renderBasemapOptions();
      panel.classList.add('visible');
      syncBasemapA11y(true);
  };

  window.cerrarBasemapPanel = function() {
      const panel = document.getElementById('basemap-panel');
      if(!panel) return;
      panel.classList.remove('visible');
      panel.style.removeProperty('--drag-offset');
      syncBasemapA11y(false);
  };

  window.toggleBasemapPanel = function(forceOpen) {
      const panel = document.getElementById('basemap-panel');
      if(!panel) return;
      const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('visible');
      if(nextOpen) window.abrirBasemapPanel();
      else window.cerrarBasemapPanel();
  };

  window.cambiarMapaBase = function(key, options) {
      if(!mapasBase[key]) return;
      const silent = !!(options && options.silent);
      if(key === mapaBaseActual) {
          renderBasemapOptions();
          return;
      }
      map.removeLayer(mapasBase[mapaBaseActual].layer);
      mapasBase[key].layer.addTo(map);
      mapasBase[key].layer.bringToBack();
      mapaBaseActual = key;
      renderBasemapOptions();
      if(!silent && typeof window.abrirBasemapPanel === 'function') window.abrirBasemapPanel();
  };

  function initBasemapPanelUX() {
      const panel = document.getElementById('basemap-panel');
      if(!panel || panel.dataset.urbisInit === '1') return;
      panel.dataset.urbisInit = '1';

      document.addEventListener('keydown', ev => {
          if(ev.key === 'Escape') window.cerrarBasemapPanel();
      });

      panel.addEventListener('click', ev => ev.stopPropagation());

      let startY = 0;
      let dragging = false;
      const start = ev => {
          if(window.innerWidth > 760) return;
          const target = ev.target;
          if(!target.closest('.basemap-title') && !target.closest('.basemap-sheet-handle')) return;
          dragging = true;
          startY = ev.touches ? ev.touches[0].clientY : ev.clientY;
          panel.style.transition = 'none';
      };
      const move = ev => {
          if(!dragging) return;
          const currentY = ev.touches ? ev.touches[0].clientY : ev.clientY;
          const delta = Math.max(0, currentY - startY);
          panel.style.setProperty('--drag-offset', `${delta}px`);
          if(delta > 0 && ev.cancelable) ev.preventDefault();
      };
      const end = ev => {
          if(!dragging) return;
          const currentY = ev.changedTouches ? ev.changedTouches[0].clientY : ev.clientY;
          const delta = Math.max(0, currentY - startY);
          dragging = false;
          panel.style.removeProperty('transition');
          if(delta > 70) {
              window.cerrarBasemapPanel();
          } else {
              panel.style.setProperty('--drag-offset', '0px');
              setTimeout(() => panel.style.removeProperty('--drag-offset'), 220);
          }
      };
      panel.addEventListener('touchstart', start, { passive: true });
      panel.addEventListener('touchmove', move, { passive: false });
      panel.addEventListener('touchend', end, { passive: true });
      panel.addEventListener('mousedown', start);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);

      window.addEventListener('resize', () => {
          if(window.innerWidth > 760) panel.style.removeProperty('--drag-offset');
      });
    }

  document.addEventListener('DOMContentLoaded', () => {
      renderBasemapOptions();
      initBasemapPanelUX();
      syncBasemapA11y(false);
  });

  const dimensiones = {
    // 🔴 REPORTE RÁPIDO (CIUDADANO Waze-Style)
    "🚨 Alertas y Riesgos Urbanos": { icon: "⚠️", desc: "Huecos, inundaciones, apagones, inseguridad", color: "#ff0000", shape: "diamond", items: ["Hueco / Bache rompe-llantas", "Zona inundada / Mal drenaje", "Apagón / Sector sin luz", "Alcantarilla sin tapa / Fuga", "Invasión de espacio público", "Conflictos de ruido extremo", "Zona abandonada / Insegura", "Zona de basura acumulada", "Árbol en riesgo de caer", "Consumo de drogas", "Presencia de guerrilla", "Área preventiva", "Retén ilegal de tránsito"] },
    // "Punto de control policial" separado de "Retén / Presencia policial"
    // (pedido explícito): un puesto fijo de Policía no es lo mismo que un
    // retén móvil de tránsito, y varios reportes ciudadanos ya usaban ese
    // título específico.
    "🚗 Reportes de Tráfico": { icon: "🚓", desc: "Retenes, choques, congestión, mal parqueo", color: "#e84118", shape: "diamond", items: ["Retén / Presencia policial", "Punto de control policial", "Retén militar", "Accidente de tránsito", "Congestión / Tráfico pesado", "Vehículo abandonado / Mal parqueado", "Semáforo dañado", "Peligro vial inminente"] },
    "🎪 Eventos Comunitarios": { icon: "🎪", desc: "Deporte, cultura, recreación y comunidad", color: "#d8cffc", shape: "marker", items: ["Fútbol / microfútbol", "Tenis / pádel", "Ajedrez / juegos de mesa", "Atletismo / carrera", "Show / concierto comunitario", "Festival / feria barrial", "Clase abierta / taller", "Reunión comunitaria"] },
    
    // ⚙️ MAPEO TÉCNICO (ARQUITECTURA)
    "Vivienda y Residencial": { icon: "🏠", desc: "Casas, apartamentos, obra negra", color: "#7f8c8d", shape: "marker", items: ["Casa de un piso", "Casa de dos pisos", "Casa de tres pisos", "Casa con antejardín", "Casa con garaje", "Casa patio", "Edificio de apartamentos (Baja)", "Torre residencial (+6 pisos)", "Conjunto cerrado", "Unidad residencial", "Bloque VIS", "Casa con local comercial", "Vivienda con taller/bodega", "En construcción/Obra negra", "Ruina"] },
    "Comercio y Servicios": { icon: "🛍️", desc: "Alimentos, gastronomía, salud", color: "#e84393", shape: "marker", items: ["Tienda de barrio", "Supermercado / Minimarket", "Frutería / Carnicería / Panadería", "Restaurante formal", "Comidas rápidas (fijo)", "Puesto ambulante", "Cafetería / Hoyo 19 / Juan Valdez", "Bar / Discoteca / Licorera", "Droguería", "Consultorio / Clínica / Veterinaria", "Peluquería / Barbería / Gimnasio", "Ferretería / Taller", "Cajero / Banco / Parqueadero"] },
    "Grandes Equipamientos": { icon: "🏟️", desc: "Malls, estadios, alcaldías, iglesias", color: "#2c3e50", shape: "marker", items: ["Centro comercial (Mall)", "San Andresito / Gran almacén", "Estadio / Coliseo", "Alcaldía / Gobernación", "CAI / Estación Policía / Bomberos", "Universidad / Colegio / Escuela", "Catedral / Iglesia / Templo"] },
    "Áreas Deportivas": { icon: "⚽", desc: "Canchas, skateparks", color: "#e67e22", shape: "circle", items: ["Polideportivo cemento", "Cancha múltiple techada", "Cancha de césped natural", "Cancha sintética", "Cancha de tierra/arena", "Cancha de voleibol", "Cancha de tenis / Pádel", "Skatepark / Pista de atletismo", "Calistenia"] },
    "Áreas Verdes y Ambiental": { icon: "🌳", desc: "Parques, arborización, canales", color: "#27ae60", shape: "circle", items: ["Parque metropolitano", "Parque infantil", "Plazoleta / Plaza dura", "Árbol gigante (+15m)", "Árbol mediano / pequeño", "Arbusto", "Árbol frutal", "Árbol seco / Cactus", "Árbol en riesgo / invasivo", "Sombra efectiva", "Zona dura (sin sombra)", "Canal de drenaje / Río", "Punto Ecológico (Reciclaje)"] },
    "Infraestructura y Peatonal": { icon: "🚶", desc: "Andenes, vías, semáforos", color: "#8e44ad", shape: "circle", items: ["Andén continuo", "Andén interrumpido", "Sin andén / Bordillo", "Rampa de acceso", "Calle asfaltada / adoquinada", "Calle de tierra", "Ciclorruta", "Poste concreto / madera", "Luminaria LED/Sodio", "Cableado expuesto", "Banca de parque", "Caneca de basura", "Paradero de bus", "Semáforo vehicular / peatonal"] },
    "Servicios Ocultos": { icon: "🚰", desc: "Alcantarillas, hidrantes", color: "#f1c40f", shape: "circle", items: ["Alcantarilla de rejilla", "Tapa de alcantarilla (Manhole)", "Hidrante operativo", "Hidrante no operativo", "Fuga de agua / Canal obstruido", "Armario técnico / Fibra óptica"] },
    "Salud y Emergencias": { icon: "🚑", desc: "Botiquines, DEA, rutas ambulancias", color: "#c0392b", shape: "marker", items: ["Desfibrilador (DEA)", "Punto de encuentro sismos", "Acceso ambulancias", "Centro radiología/laboratorio"] },
    "Patrimonio y Turismo": { icon: "🏛️", desc: "Monumentos, murales, historia", color: "#d35400", shape: "marker", items: ["Estatua / Placa", "Mural / Grafiti", "Edificio de conservación", "Ruinas arqueológicas", "Tótem / Centro turista"] },
    "Industria y Logística": { icon: "🏭", desc: "Zonas de carga, bodegas, fábricas", color: "#8d6e63", shape: "marker", items: ["Zona carga/descarga", "Bahía camiones", "Fábrica / Planta", "Taller / Carpintería", "Bodega reciclaje (Chatarrería)"] },
    "Animal y Bienestar": { icon: "🐾", desc: "Comederos, parques caninos, riesgos", color: "#1abc9c", shape: "circle", items: ["Comedero comunitario", "Parque canino", "Zona presencia animales", "Enjambre reportado"] },
    "Infraestructura Smart": { icon: "🔌", desc: "Wi-Fi, sensores, paneles solares", color: "#00a8ff", shape: "marker", items: ["Zona Wi-Fi", "Antena 5G", "Sensor aire/ruido", "Panel solar público", "Cargador VE / Celulares"] },
    "Oficinas y Co-working": { icon: "🏢", desc: "Negocios, notarías, gubernamental", color: "#3f51b5", shape: "marker", items: ["Centro de negocios", "Espacio Co-working", "Oficina gubernamental", "Notaría / Cámara de Comercio"] },

    // 🛡️ SEGURIDAD NACIONAL Y CONFLICTO ARMADO — agosto 2026.
    // Va aparte de "Alertas y Riesgos Urbanos" porque no es lo mismo un robo
    // que un hecho del conflicto: cambia la autoridad competente (GAULA,
    // Fiscalía, DDHH), cambia la urgencia y cambia el riesgo de quien reporta.
    "🛡️ Seguridad Nacional y Conflicto": { icon: "🛡️", desc: "Hechos del conflicto armado y delitos de alto impacto", color: "#7f1d1d", shape: "diamond", items: ["Secuestro", "Extorsión / vacuna", "Homicidio", "Masacre", "Desaparición", "Atentado con explosivos", "Mina antipersona / MAP", "Amenaza a la comunidad", "Amenaza a líder social", "Reclutamiento de menores", "Ejecución extrajudicial", "Combate armado", "Retén ilegal armado", "Presencia de grupo armado", "Desplazamiento forzado", "Confinamiento de comunidad", "Panfleto amenazante"] },

    // 🌪️ RIESGOS MAYORES (desastres naturales y terreno) — nuevo, julio 2026
    // "Sismo" y "terremoto" son EL MISMO fenómeno: terremoto es solo el nombre
    // coloquial de un sismo fuerte, no hay umbral oficial que los separe. Tener
    // los dos como opciones distintas obligaba al ciudadano a elegir entre
    // sinónimos, así que van en un único ítem y la magnitud la aporta el dato.
    "🌪️ Desastres Naturales y Clima": { icon: "🌪️", desc: "Sismos, ciclones, tormentas, tsunamis, derrumbes", color: "#5b21b6", shape: "diamond", items: ["Sismo / Terremoto", "Ciclón", "Tormenta", "Tsunami", "Derrumbe"] },
    "⛰️ Riesgos del Terreno": { icon: "⛰️", desc: "Inestabilidad del suelo y daño geológico", color: "#78350f", shape: "diamond", items: ["Daño geológico"] }
  };




  const KAWAII_ICON_REGISTRY = {
    "accidente de transito": "assets/icons/kawaii-uses/accidente_de_transito.png",
    "reten presencia policial": "assets/icons/kawaii-uses/reten_presencia_policial.png",
    "alertas y riesgos urbanos": "assets/icons/kawaii-uses/alertas_y_riesgos_urbanos.png",
    "zona inundable": "assets/icons/kawaii-uses/zona_inundable.png",
    "zona de basura acumulada": "assets/icons/kawaii-uses/zona_de_basura_acumulada.png",
    "conflictos de uso": "assets/icons/kawaii-uses/conflictos_de_uso.png"
  };

  const KAWAII_ICON_ALIAS = [
    { patterns: ["accidente de transito", "choque", "accidente"], asset: "assets/icons/kawaii-uses/accidente_de_transito.png" },
    { patterns: ["reten", "presencia policial", "operativo policial"], asset: "assets/icons/kawaii-uses/reten_presencia_policial.png" },
    { patterns: ["hueco", "bache", "senal danada", "semáforo dañado", "semaforo danado", "alumbrado", "inseguridad", "alerta", "riesgo urbano"], asset: "assets/icons/kawaii-uses/alertas_y_riesgos_urbanos.png" },
    { patterns: ["inundacion", "inundable", "zona inundable"], asset: "assets/icons/kawaii-uses/zona_inundable.png" },
    { patterns: ["basura", "residuos", "escombros", "zona de basura acumulada"], asset: "assets/icons/kawaii-uses/zona_de_basura_acumulada.png" },
    { patterns: ["conflictos de uso", "ocupacion indebida"], asset: "assets/icons/kawaii-uses/conflictos_de_uso.png" },
  ];
  const KAWAII_ICON_KEYS = Object.keys(KAWAII_ICON_REGISTRY).sort((a,b)=> b.length - a.length);

  function normalizarUsoKawaii(texto) {
      return String(texto || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
  }

  function obtenerRutaIconoUso(tipo, elemento) {
      const texto = normalizarUsoKawaii(`${tipo || ''} ${elemento || ''}`);
      if(!texto) return '';
      for(const rule of KAWAII_ICON_ALIAS) {
          if(rule.patterns.some(p => texto.includes(p))) return rule.asset;
      }
      for(const key of KAWAII_ICON_KEYS) {
          if(texto.includes(key)) return KAWAII_ICON_REGISTRY[key];
      }
      return '';
  }

  function construirHTMLMarkerKawaii(asset, markerColor, opacity, shape = 'marker') {
      const cleanOpacity = Math.min(1, Math.max(.35, Number(opacity) || 1));
      if(shape === 'diamond') {
          return `<div class="marker-stack marker-stack-kawaii is-diamond" style="--marker-base-w:26px; --marker-base-h:26px; opacity:${cleanOpacity}"><svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><rect x="13" y="4" width="15" height="15" transform="rotate(45 13 11.5)" fill="${markerColor}" stroke="#ffffff" stroke-width="1.2" rx="3"/></svg><span class="marker-kawaii marker-kawaii-diamond"><span class="marker-kawaii-bubble"><img src="${asset}" alt=""></span></span></div>`;
      }
      if(shape === 'circle') {
          return `<div class="marker-stack marker-stack-kawaii is-circle" style="--marker-base-w:24px; --marker-base-h:24px; opacity:${cleanOpacity}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="${markerColor}" stroke="#ffffff" stroke-width="1.2"/></svg><span class="marker-kawaii marker-kawaii-circle"><span class="marker-kawaii-bubble"><img src="${asset}" alt=""></span></span></div>`;
      }
      return `<div class="marker-stack marker-stack-kawaii is-marker" style="--marker-base-w:28px; --marker-base-h:36px; opacity:${cleanOpacity}"><svg viewBox="0 0 28 36" width="28" height="36" aria-hidden="true"><path d="M14 1.8C7.1 1.8 1.7 7.2 1.7 14.1c0 9 12.3 20.1 12.3 20.1s12.3-11.1 12.3-20.1C26.3 7.2 20.9 1.8 14 1.8Z" fill="${markerColor}" stroke="#ffffff" stroke-width="1.2"/></svg><span class="marker-kawaii marker-kawaii-marker"><span class="marker-kawaii-bubble"><img src="${asset}" alt=""></span></span></div>`;
  }

  function construirBadgeKawaii(asset, clase, alt) {
      return `<span class="${clase} kawaii-icon-badge"><img src="${asset}" alt="${alt || 'Ícono'}"></span>`;
  }

  window.urbisGetUsoKawaiiIcon = obtenerRutaIconoUso;

  const ALERT_CATS_DOT = {
    '🚨 Alertas y Riesgos Urbanos': '#ef4444',
    '🚗 Reportes de Tráfico':       '#f59e0b',
    'Áreas Verdes y Ambiental':     '#22c55e',
    'Animal y Bienestar':           '#22c55e'
  };

  function crearHTMLAlertaKawaii(asset, dotColor, opacity, label){
    const op = Math.min(1, Math.max(.35, Number(opacity)||1));
    return `<div class="urbis-alerta-kawaii" style="opacity:${op}" title="${label||''}"><span class="urbis-alerta-img"><img src="${asset}" alt="${label||''}"></span><span class="urbis-alerta-dot" style="background:${dotColor}"></span></div>`;
  }
  window.urbisCrearHTMLAlertaKawaii = crearHTMLAlertaKawaii;

  // Misma gota (burbuja + punto) pero con un EMOJI específico por tipo, para
  // reportes sin PNG dedicado (hueco 🕳️, árbol 🌳, etc.). Así cada reporte se
  // reconoce a simple vista sin necesidad de crear imágenes nuevas.
  function crearHTMLAlertaEmoji(emoji, dotColor, opacity, label){
    const op = Math.min(1, Math.max(.35, Number(opacity)||1));
    return `<div class="urbis-alerta-kawaii" style="opacity:${op}" title="${label||''}"><span class="urbis-alerta-img"><span class="urbis-alerta-emoji">${emoji||'📍'}</span></span><span class="urbis-alerta-dot" style="background:${dotColor}"></span></div>`;
  }
  window.urbisCrearHTMLAlertaEmoji = crearHTMLAlertaEmoji;

  function obtenerIconoItem(tipo, elemento) {
      const t = `${tipo || ''} ${elemento || ''}`.toLowerCase();
      if(t.includes('evento') || t.includes('festival') || t.includes('feria')) return '🎪';
      if(t.includes('show') || t.includes('concierto')) return '🎤';
      if(t.includes('ajedrez') || t.includes('juegos')) return '♟️';
      if(t.includes('fútbol') || t.includes('microfútbol') || t.includes('futbol') || t.includes('microfutbol')) return '⚽';
      if(t.includes('tenis') || t.includes('pádel') || t.includes('padel')) return '🎾';
      if(t.includes('atletismo') || t.includes('carrera')) return '🏃';
      if(t.includes('taller') || t.includes('clase abierta')) return '🎨';
      if(t.includes('reunión comunitaria') || t.includes('reunion comunitaria')) return '🤝';
      if(t.includes('hueco') || t.includes('bache')) return '🕳️';
      if(t.includes('inund') || t.includes('drenaje') || t.includes('fuga')) return '🌊';
      if(t.includes('retén') || t.includes('reten')) return '🚧';
      if(t.includes('cerrada') || t.includes('bloqueada') || t.includes('desvío') || t.includes('desvio')) return '⛔';
      if(t.includes('accidente') || t.includes('choque')) return '💥';
      if(t.includes('congest') || t.includes('tráfico') || t.includes('trafico')) return '🚗';
      if(t.includes('casa de un piso')) return '🏡';
      if(t.includes('casa de dos pisos')) return '🏘️';
      if(t.includes('casa de tres pisos')) return '🏢';
      if(t.includes('apartamento') || t.includes('torre')) return '🏙️';
      if(t.includes('conjunto') || t.includes('unidad residencial') || t.includes('bloque vis')) return '🏘️';
      if(t.includes('construcción') || t.includes('obra')) return '🏗️';
      if(t.includes('ruina')) return '🧱';
      if(t.includes('tienda')) return '🏪';
      if(t.includes('supermercado') || t.includes('minimarket')) return '🛒';
      if(t.includes('frutería') || t.includes('fruteria') || t.includes('panadería') || t.includes('panaderia') || t.includes('carnicería') || t.includes('carniceria')) return '🍎';
      if(t.includes('restaurante')) return '🍽️';
      if(t.includes('comidas rápidas') || t.includes('comidas rapidas')) return '🍔';
      if(t.includes('cafetería') || t.includes('cafeteria') || t.includes('juan valdez') || t.includes('hoyo 19')) return '☕';
      if(t.includes('bar') || t.includes('discoteca') || t.includes('licorera')) return '🍸';
      if(t.includes('droguería') || t.includes('drogueria')) return '💊';
      if(t.includes('clínica') || t.includes('clinica') || t.includes('consultorio') || t.includes('veterinaria')) return '🏥';
      if(t.includes('peluquería') || t.includes('peluqueria') || t.includes('barbería') || t.includes('barberia')) return '✂️';
      if(t.includes('ferretería') || t.includes('ferreteria') || t.includes('taller')) return '🔧';
      if(t.includes('banco') || t.includes('cajero')) return '🏦';
      if(t.includes('mall') || t.includes('centro comercial')) return '🏬';
      if(t.includes('estadio') || t.includes('coliseo')) return '🏟️';
      if(t.includes('alcaldía') || t.includes('alcaldia') || t.includes('gobernación') || t.includes('gobernacion')) return '🏛️';
      if(t.includes('policía') || t.includes('policia') || t.includes('bomberos') || t.includes('cai')) return '👮';
      if(t.includes('universidad') || t.includes('colegio') || t.includes('escuela')) return '🎓';
      if(t.includes('iglesia') || t.includes('catedral') || t.includes('templo')) return '⛪';
      if(t.includes('polideportivo') || t.includes('cancha múltiple') || t.includes('cancha multiple')) return '🏟️';
      if(t.includes('césped') || t.includes('cesped')) return '⚽';
      if(t.includes('sintética') || t.includes('sintetica')) return '🥅';
      if(t.includes('voleibol')) return '🏐';
      if(t.includes('tenis') || t.includes('pádel') || t.includes('padel')) return '🎾';
      if(t.includes('skatepark')) return '🛹';
      if(t.includes('calistenia')) return '💪';
      if(t.includes('parque metropolitano') || t.includes('parque infantil')) return '🌳';
      if(t.includes('plazoleta') || t.includes('plaza dura')) return '⛲';
      if(t.includes('árbol gigante') || t.includes('árbol gigante') || t.includes('arbol gigante')) return '🌳';
      if(t.includes('árbol mediano') || t.includes('árbol mediano / pequeño') || t.includes('arbol mediano') || t.includes('árbol pequeño') || t.includes('arbol pequeño')) return '🌲';
      if(t.includes('arbusto')) return '🌿';
      if(t.includes('árbol frutal') || t.includes('arbol frutal')) return '🍊';
      if(t.includes('cactus')) return '🌵';
      if(t.includes('árbol en riesgo') || t.includes('arbol en riesgo') || t.includes('invasivo')) return '⚠️';
      if(t.includes('sombra efectiva')) return '🟢';
      if(t.includes('zona dura')) return '☀️';
      if(t.includes('canal de drenaje') || t.includes('río') || t.includes('rio')) return '🏞️';
      if(t.includes('reciclaje')) return '♻️';
      if(t.includes('andén') || t.includes('anden')) return '🚶';
      if(t.includes('rampa')) return '♿';
      if(t.includes('ciclorruta')) return '🚲';
      if(t.includes('luminaria')) return '💡';
      if(t.includes('poste')) return '🪵';
      if(t.includes('cableado')) return '🔌';
      if(t.includes('banca')) return '🪑';
      if(t.includes('caneca')) return '🗑️';
      if(t.includes('paradero')) return '🚏';
      if(t.includes('semáforo') || t.includes('semaforo')) return '🚦';
      if(t.includes('alcantarilla') || t.includes('manhole')) return '🕳️';
      if(t.includes('hidrante')) return '🚒';
      if(t.includes('armario técnico') || t.includes('armario tecnico') || t.includes('fibra óptica') || t.includes('fibra optica')) return '📡';
      if(t.includes('desfibrilador')) return '❤️';
      if(t.includes('punto de encuentro')) return '📍';
      if(t.includes('ambulancias')) return '🚑';
      if(t.includes('radiología') || t.includes('radiologia') || t.includes('laboratorio')) return '🧪';
      if(t.includes('estatua') || t.includes('placa')) return '🗿';
      if(t.includes('mural') || t.includes('grafiti')) return '🎨';
      if(t.includes('conservación') || t.includes('conservacion')) return '🏛️';
      if(t.includes('ruinas')) return '🧱';
      if(t.includes('tótem') || t.includes('totem') || t.includes('turista')) return '🧭';
      if(t.includes('carga') || t.includes('descarga')) return '📦';
      if(t.includes('camiones')) return '🚚';
      if(t.includes('fábrica') || t.includes('fabrica') || t.includes('planta')) return '🏭';
      if(t.includes('bodega')) return '🏬';
      if(t.includes('comedero')) return '🐶';
      if(t.includes('parque canino')) return '🐕';
      if(t.includes('animales')) return '🐾';
      if(t.includes('enjambre')) return '🐝';
      if(t.includes('wi-fi') || t.includes('wifi')) return '📶';
      if(t.includes('antena')) return '📡';
      if(t.includes('sensor')) return '🛰️';
      if(t.includes('panel solar')) return '🔆';
      if(t.includes('cargador ve') || t.includes('celulares')) return '🔋';
      if(t.includes('negocios') || t.includes('co-working') || t.includes('coworking')) return '💼';
      if(t.includes('oficina gubernamental')) return '🏢';
      if(t.includes('notaría') || t.includes('notaria') || t.includes('cámara de comercio') || t.includes('camara de comercio')) return '📄';
      return (dimensiones[tipo] && dimensiones[tipo].icon) ? dimensiones[tipo].icon : '📍';
  }

  // Coincidencia EXACTA con el catálogo de reportes rápidos (js/20,
  // URBIS_QUICK_REPORTS) — esa es la fuente de verdad real: el ícono que el
  // usuario YA VIO y TOCÓ al elegir el tipo de reporte. Se prueba antes que
  // las reglas por palabra clave de abajo (obtenerIconoWaze/obtenerIconoItem)
  // para que el ícono nunca cambie entre "antes de reportar" y "ya
  // reportado". Bug real encontrado: al ampliar la taxonomía (v359-360),
  // ~24 categorías nuevas no tenían ninguna regla por palabra clave y caían
  // en el genérico ⚠️ (naranja mientras está "Pendiente" de validar);
  // además "Fuga de gas" coincidía por accidente con la regla de "fuga" de
  // agua y mostraba 🌊 en vez de 🔥. js/20 carga DESPUÉS de este archivo,
  // pero la consulta es en tiempo de EJECUCIÓN (cuando ya se pinta un
  // marcador), momento en el que window.URBIS_QUICK_REPORTS ya existe.
  let _urbisQuickReportsPorLabel = null;
  function _urbisIconoDelCatalogo(elemento) {
      try{
          const catalogo = window.URBIS_QUICK_REPORTS;
          if(!catalogo) return null;
          if(!_urbisQuickReportsPorLabel || _urbisQuickReportsPorLabel._src !== catalogo){
              const mapa = new Map();
              Object.values(catalogo).forEach(r => { if(r && r.label && !mapa.has(r.label)) mapa.set(r.label, r.icon); });
              mapa._src = catalogo;
              _urbisQuickReportsPorLabel = mapa;
          }
          return _urbisQuickReportsPorLabel.get(elemento) || null;
      }catch(e){ return null; }
  }
  function obtenerIconoReporte(tipo, elemento) {
      const iconoCatalogo = _urbisIconoDelCatalogo(elemento);
      if(iconoCatalogo) return iconoCatalogo;
      const iconoWaze = obtenerIconoWaze(tipo, elemento);
      if(iconoWaze) return iconoWaze.emoji;
      return obtenerIconoItem(tipo, elemento);
  }

  function construirBadgeIcono(tipo, elemento, clase = 'mini-icon-badge') {
      // Misma regla que usan los marcadores del mapa (crearIconoWaze /
      // crearIconoCategoriaGenerica): el PNG genérico "alertas_y_riesgos_
      // urbanos.png" coincide para CUALQUIER ítem de esa dimensión (porque
      // "alerta" es substring de "Alertas y Riesgos Urbanos"), así que sin
      // esta excepción "Mis reportes"/popups mostraban ese ícono naranja
      // genérico para reportes que YA tienen un emoji propio y específico
      // (💧 inundación, 🛡️ área preventiva, 💉 sustancias, etc.).
      const asset = obtenerRutaIconoUso(tipo, elemento);
      const iconoWaze = obtenerIconoWaze(tipo, elemento);
      const esGenerico = !asset || (iconoWaze && iconoWaze.forzarEmoji) || /alertas_y_riesgos_urbanos\.png$/i.test(asset);
      if(asset && !esGenerico) return construirBadgeKawaii(asset, clase, elemento || tipo);
      return `<span class="${clase}">${obtenerIconoReporte(tipo, elemento)}</span>`;
  }

  function crearIconoCategoriaGenerica(shape, markerColor, opacity, emoji, tipo, elemento) {
      let html = '';
      const cleanOpacity = Math.min(1, Math.max(.35, Number(opacity) || 1));
      let kawaiiAsset = obtenerRutaIconoUso(tipo, elemento);
      // Este es el punto de entrada para ítems SIN patrón en obtenerIconoWaze
      // (ej. "Presencia de guerrilla"). "alerta" es substring de "Alertas y
      // Riesgos Urbanos", así que obtenerRutaIconoUso SIEMPRE resuelve el PNG
      // genérico para cualquier ítem de esa dimensión — se descarta aquí para
      // que caiga en el emoji específico que ya trae `emoji` (obtenerIconoReporte).
      if(/alertas_y_riesgos_urbanos\.png$/i.test(kawaiiAsset)) kawaiiAsset = '';
      if(kawaiiAsset) {
          const dotColor = ALERT_CATS_DOT[tipo];
          if(dotColor){
              html = crearHTMLAlertaKawaii(kawaiiAsset, dotColor, cleanOpacity, elemento || tipo);
              return L.divIcon({ className: 'urbis-report-root urbis-alerta-root animated-marker', html, iconSize:[42,52], iconAnchor:[21,52], popupAnchor:[0,-46] });
          }
          html = construirHTMLMarkerKawaii(kawaiiAsset, markerColor, cleanOpacity, 'marker');
          return L.divIcon({ className: 'urbis-report-root urbis-report-pin animated-marker urbis-report-kawaii', html, iconSize: [48,56], iconAnchor:[24,56], popupAnchor:[0,-46] });
      }
      // BUG real ("doble ícono"): sin PNG dedicado, esto caía al marcador
      // genérico de figura SVG + emoji encima (marker-emoji), que para algo
      // como 💣 se veía como dos íconos superpuestos (la figura de color +
      // el emoji). Si la dimensión tiene color de alerta, se usa la misma
      // burbuja limpia (emoji + punto de color) que ya usan los reportes con
      // PNG — un solo ícono, sin la figura de color detrás. Las figuras de
      // color por categoría quedan exclusivas de UrbisProCity.
      const dotColorEmoji = ALERT_CATS_DOT[tipo];
      if(dotColorEmoji){
          // Pedido explícito: los reportes de atentado/artefacto explosivo
          // deben resaltar más que el resto — anillo pulsante rojo + ícono
          // más grande, para que salten a la vista de inmediato en el mapa.
          const esCritico = /atentado|artefacto explosivo/i.test(elemento || '');
          html = crearHTMLAlertaEmoji(emoji, dotColorEmoji, cleanOpacity, elemento || tipo);
          if(esCritico){
              html = `<span class="urbis-alerta-critica-ring"></span>${html}`;
              return L.divIcon({ className: 'urbis-report-root urbis-alerta-root urbis-alerta-critica animated-marker', html, iconSize:[54,64], iconAnchor:[27,64], popupAnchor:[0,-58] });
          }
          return L.divIcon({ className: 'urbis-report-root urbis-alerta-root animated-marker', html, iconSize:[42,52], iconAnchor:[21,52], popupAnchor:[0,-46] });
      }
      if(shape === 'diamond') {
          html = `<div class="marker-stack" style="--marker-base-w:22px; --marker-base-h:22px; opacity:${cleanOpacity}"><svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><rect x="11" y="3" width="13" height="13" transform="rotate(45 11 10)" fill="${markerColor}" stroke="#ffffff" stroke-width="1.2" rx="2"/></svg><span class="marker-emoji">${emoji}</span></div>`;
          return L.divIcon({ className: 'urbis-report-root urbis-report-diamond animated-marker', html, iconSize: [40,40], iconAnchor:[20,20] });
      }
      if(shape === 'marker') {
          html = `<div class="marker-stack" style="--marker-base-w:24px; --marker-base-h:30px; opacity:${cleanOpacity}"><svg viewBox="0 0 24 30" width="24" height="30" aria-hidden="true"><path d="M12 1C6.2 1 1.5 5.7 1.5 11.5C1.5 19.2 12 29 12 29S22.5 19.2 22.5 11.5C22.5 5.7 17.8 1 12 1Z" fill="${markerColor}" stroke="#ffffff" stroke-width="1.1"/></svg><span class="marker-emoji marker">${emoji}</span></div>`;
          return L.divIcon({ className: 'urbis-report-root urbis-report-pin animated-marker', html, iconSize: [42,48], iconAnchor:[21,48] });
      }
      html = `<div class="marker-stack" style="--marker-base-w:22px; --marker-base-h:22px; opacity:${cleanOpacity}"><svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="${markerColor}" stroke="#ffffff" stroke-width="1.2"/></svg><span class="marker-emoji circle">${emoji}</span></div>`;
      return L.divIcon({ className: 'urbis-report-root urbis-report-circle animated-marker', html, iconSize: [40,40], iconAnchor:[20,20] });
  }

  const usosBase = ["Comercial", "Residencial", "Institucional", "Ocio / Negocio", "Deportivo", "Esp. Público", "Zona Baldía"];
  const usosExtra = [
    "Mobiliario Urbano", "Gestión de Residuos / Reciclaje", "Industrial (Pesada/Ligera)", 
    "Logístico / Almacenamiento", "Salud (Clínicas/Hospitales)", "Emergencias (Bomberos/Rescate)", 
    "Religioso / Culto", "Cultural / Patrimonio", "Educativo (Básico/Superior)", 
    "Transporte (Terminales/Estaciones)", "Infra. Servicios (Plantas)", "Gubernamental / Administrativo", 
    "Militar / Policial", "Seguridad / Judicial", "Turístico / Hotelero", "Agropecuario / Rural", 
    "Protección Ambiental", "Forestal", "Extractivo (Minería/Canteras)", "Parqueadero / Estacionamiento",
    "Servicios Funerarios", "Comunicaciones / Antenas", "Cuidado Animal (Veterinaria)",
    "Mixto (Residencial-Comercial)", "Mixto (Residencial-Industrial)", "Zona de Riesgo",
    "En Obra / Construcción", "Abandono / Ruina", "Espacio Residual", "Asentamiento Informal"
  ];
  const todosLosUsos = usosBase.concat(usosExtra);
  const BASE_OFFSET = 6 + todosLosUsos.length; 

  // ═══ MAPA ÚNICO DE POSICIONES LIBRES DEL REGISTRO ═══════════════════════
  // La descripción es un string separado por " | " y cada función lo corta por
  // posición. Durante un tiempo TRES funciones distintas calcularon por su
  // cuenta "la primera casilla libre" y las tres llegaron al mismo número
  // (BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 5): la ficha del edificio, las
  // validaciones ciudadanas y la carpeta de Pro City se estaban pisando entre
  // ellas. Un punto de Pro City publicado dentro de una carpeta borraba la
  // materialidad del edificio; confirmar un reporte la borraba también.
  //
  // Desde aquí las casillas se reparten UNA sola vez. Quien necesite una nueva
  // la añade al final de esta tabla y nunca vuelve a calcularla por su lado.
  // Las posiciones NO se pueden reordenar: hay datos guardados en ellas.
  const URBIS_SLOTS = {
    edificioMaterialidad: BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 5,  // ficha: 5 casillas
    edificioPisos:        BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 6,
    edificioPlantaBaja:   BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 7,
    edificioEpoca:        BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 8,
    edificioOtroTexto:    BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 9,
    validaciones:         BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 10, // ¿sigue vigente?
    carpetaProCity:       BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 11,
    denuncias:            BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 12, // moderación
    victimas:             BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 13, // heridos/fallecidos
    // El edificio piso por piso: "1:Comercio;2-3:Vivienda". Al final, como
    // toda casilla nueva; el vocabulario y su lectura viven en js/03b.
    edificioUsosPorPiso:  BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 14
  };
  // La casilla que las tres funciones se disputaban. Se conserva con nombre
  // propio porque hay registros viejos con validaciones o con código de carpeta
  // guardados ahí, y hay que seguir sabiendo leerlos.
  const URBIS_SLOT_DISPUTADO = URBIS_SLOTS.edificioMaterialidad;
  window.URBIS_SLOTS = URBIS_SLOTS;
  window.URBIS_SLOT_DISPUTADO = URBIS_SLOT_DISPUTADO;

  // La ficha del edificio la leen el formulario, el guardado y el análisis
  // educativo, cada uno en su archivo: se expone una sola implementación para
  // que las posiciones del registro no se calculen en tres sitios distintos.
  // Lo que SÍ depende del registro serializado y por eso se queda aquí.
  /* Quién levantó un punto y cuándo. Vive acá, junto a BASE_OFFSET, por la
     misma razón que la ficha del edificio: las posiciones del registro se
     calculan UNA vez y en un solo sitio. Tres funciones calculándolas por su
     cuenta ya se pisaron los datos una vez.

     Devuelve el nombre y el rol y NADA MÁS. En esas casillas también están el
     correo y la cédula de quien reportó, y la vista del curso no los necesita
     para nada: contar cuántos puntos levantó cada estudiante no requiere
     tener su documento a mano. Lo que no se expone no se filtra. */
  window.URBIS_AUTOR = Object.assign(window.URBIS_AUTOR || {}, {
    de: function (descripcion) {
      const d = String(descripcion || '').split(' | ');
      return {
        nombre: (d[BASE_OFFSET + 2] || '').trim(),
        rol: (d[BASE_OFFSET + 3] || '').trim()
      };
    },
    cuando: function (p) {
      const d = String((p && p.descripcion) || '').split(' | ');
      const iso = d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET];
      let f = iso ? new Date(iso) : null;
      if (!f || isNaN(f.getTime())) {
        const raw = (p && p.fecha) || '';
        const m = String(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        f = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0) : new Date(raw);
      }
      return (f && !isNaN(f.getTime())) ? f : null;
    }
  });

  window.URBIS_EDIFICIO = Object.assign(window.URBIS_EDIFICIO || {}, {
    esCategoriaEdificio: esCategoriaEdificio,
    leer: leerEdificio,
    /* Qué campos de la ficha NO se registraron. Hace falta aparte de leer()
       porque leer() normaliza —un edificio sin pisos anotados devuelve 1, para
       que el análisis no castigue lo mapeado antes de que el campo
       existiera—, y para saber qué falta por llenar hay que ver el crudo. Con
       leer() solo, «sin pisos» daría cero siempre. */
    faltantes: function (descripcion) {
      const d = String(descripcion || '').split(' | ');
      const V0 = VOC();
      const base = URBIS_SLOTS.edificioMaterialidad;
      const pisos = parseInt(d[base + 1], 10);
      /* «Sin registrar», «No se sabe» y «Otro» SON valores del vocabulario
         —están en la lista— pero no son una observación: `valorUtil` los
         devuelve vacíos y por eso se pasa por ahí. Sin ese filtro, un edificio
         al que le pusieron «No se sabe» contaría como ficha completa, que es
         justo lo contrario de lo que esta vista tiene que mostrar. */
      const util = (V0 && V0.valorUtil) ? V0.valorUtil : function (x) { return String(x || '').trim(); };
      return {
        materialidad: !util(delVocabulario(d[base], V0 && V0.MATERIALIDAD)),
        pisos: !(isFinite(pisos) && pisos > 0),
        epoca: !util(delVocabulario(d[base + 3], V0 && V0.EPOCA))
      };
    },
    usosMarcados: leerUsosMarcados,
    todosLosUsos: function(){ return todosLosUsos.slice(); }
  });


  const categoriasRapidas = ["🚗 Reportes de Tráfico", "🚨 Alertas y Riesgos Urbanos", "Áreas Verdes y Ambiental", "Salud y Emergencias"];

  // Extensión tipo Waze sin eliminar las categorías originales
  dimensiones["🚨 Alertas y Riesgos Urbanos"].items = Array.from(new Set([
      ...dimensiones["🚨 Alertas y Riesgos Urbanos"].items,
      "Zona de inundación activa", "Zona de huecos frecuentes", "Vía cerrada por emergencia", "Paso restringido por riesgo"
  ]));
  dimensiones["🚗 Reportes de Tráfico"].items = Array.from(new Set([
      ...dimensiones["🚗 Reportes de Tráfico"].items,
      "Vía cerrada", "Obra en vía", "Ruta bloqueada", "Retén de tránsito", "Desvío obligatorio", "Tráfico lento por lluvia"
  ]));

  // Matriz de Usos (zonificación / uso del suelo) como categoría propia de
  // mapeo técnico — pedido explícito para URBIS Pro City. Reutiliza la MISMA
  // lista de 37 usos que ya se usa en el checklist de cada reporte
  // (usosBase+usosExtra), esta vez como un punto propio georreferenciable.
  dimensiones["🗺️ Matriz de Usos"] = {
    icon: "🗺️", desc: "Clasificación de uso del suelo (zonificación)",
    color: "#546e7a", shape: "marker", items: todosLosUsos.slice()
  };
