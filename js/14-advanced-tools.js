// ==========================================
// URBIS V6: raster 5m con relieve térmico, paleta continua y ajuste por zoom
// ==========================================
let advancedDrawMode = false;
let advancedAreaPoints = [];
let advancedAreaLayer = L.layerGroup().addTo(map);
let advancedRasterLayer = L.layerGroup().addTo(map);
let advancedRasterGenerated = false;
let advancedAreaBounds = null;
let advancedLastRasterType = 'comercio';
let advancedRasterCellsMeta = [];
const ADVANCED_RASTER_CELL_METERS = 5;
const ADVANCED_RASTER_MAX_CELLS = 90000; // protección para no congelar móviles si el área es enorme
const ADVANCED_RASTER_RADIUS_METERS = 65; // radio de influencia por punto para suavizar el calor

function crearAcordeonParaPanel(panel, titulo, abierto = false) {
    if(!panel || panel.dataset.accordionWrapped === 'true') return;
    const details = document.createElement('details');
    details.className = 'urbis-accordion';
    if(abierto) details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = titulo;
    const body = document.createElement('div');
    body.className = 'accordion-body';
    panel.parentNode.insertBefore(details, panel);
    details.appendChild(summary);
    details.appendChild(body);
    panel.dataset.accordionWrapped = 'true';
    body.appendChild(panel);
}

function activarAcordeonesMoviles() {
    crearAcordeonParaPanel(document.querySelector('#page-mobility .map-tools'), '🧭 Herramientas de campo', true);
    crearAcordeonParaPanel(document.getElementById('traffic-control-panel'), '📷 Control vial', false);
    crearAcordeonParaPanel(document.getElementById('route-real-panel'), '🧭 Guía para llegar', false);
    document.querySelectorAll('#page-events .events-panel').forEach((panel, idx) => {
        crearAcordeonParaPanel(panel, idx === 0 ? '🎪 Crear evento' : '📅 Agenda urbana', idx === 0);
    });
    crearAcordeonParaPanel(document.getElementById('layers-toggles'), '🧩 Capas activas', true);
    crearAcordeonParaPanel(document.getElementById('automap-panel'), '🧭 AutoMapeo Cúcuta / OSM', false);
    crearAcordeonParaPanel(document.getElementById('zona-analysis'), '🌊🕳️ Zonas ciudadanas', false);
    crearAcordeonParaPanel(document.querySelector('#page-stats .dashboard-container'), '📊 Gráficos analíticos', true);
}

function actualizarAdvancedStatus(texto) {
    const el = document.getElementById('advanced-area-status');
    if(el) el.innerHTML = texto;
}

function actualizarRasterStatus(texto) {
    const el = document.getElementById('advanced-raster-status');
    if(el) el.innerHTML = texto;
}

window.activarDibujoAreaAnalisis = function() {
    if(userRole !== 'admin' && userRole !== 'edu') {
        alert('El modo avanzado está disponible para Arquitecto/Admin y Modo Educativo.');
        return;
    }
    advancedDrawMode = true;
    advancedAreaPoints = [];
    advancedAreaBounds = null;
    advancedAreaLayer.clearLayers();
    actualizarAdvancedStatus('✏️ Modo dibujo activo: toca varios puntos en el mapa. Con 3 puntos o más ya puedes generar el raster. Doble clic para cerrar.');
    map.getContainer().style.cursor = 'crosshair';
};

window.usarVistaActualComoArea = function() {
    if(userRole !== 'admin' && userRole !== 'edu') return;
    advancedDrawMode = false;
    map.getContainer().style.cursor = '';
    advancedAreaLayer.clearLayers();
    const b = map.getBounds();
    advancedAreaBounds = b;
    const rect = L.rectangle(b, { color: '#b8ebe6', weight: 2, fillColor: '#b8ebe6', fillOpacity: .08, dashArray: '6 6' }).addTo(advancedAreaLayer);
    rect.bindTooltip('Área de análisis: vista actual', { permanent: false });
    actualizarAdvancedStatus('▣ Área seleccionada desde la vista actual del mapa.');
};

window.limpiarAreaAnalisis = function() {
    advancedDrawMode = false;
    advancedAreaPoints = [];
    advancedAreaBounds = null;
    advancedAreaLayer.clearLayers();
    advancedRasterLayer.clearLayers();
    advancedRasterGenerated = false;
    map.getContainer().style.cursor = '';
    actualizarAdvancedStatus('Área: todavía no seleccionada. Puedes dibujar un polígono con clics en el mapa.');
    actualizarRasterStatus('Raster limpiado. Selecciona un área y vuelve a generar.');
};

function agregarPuntoAreaAnalisis(latlng) {
    advancedAreaPoints.push(latlng);
    L.marker(latlng, {
        icon: L.divIcon({ className: 'draw-area-root', html: '<div class="draw-area-point"></div>', iconSize: [16,16], iconAnchor: [8,8] }),
        interactive: false
    }).addTo(advancedAreaLayer);

    if(advancedAreaPoints.length >= 2) {
        L.polyline(advancedAreaPoints, { color: '#f5bfd6', weight: 2, dashArray: '4 6' }).addTo(advancedAreaLayer);
    }
    if(advancedAreaPoints.length >= 3) {
        advancedAreaLayer.clearLayers();
        const poly = L.polygon(advancedAreaPoints, { color: '#b8ebe6', weight: 2, fillColor: '#b8ebe6', fillOpacity: .09 }).addTo(advancedAreaLayer);
        advancedAreaPoints.forEach(p => L.marker(p, { icon: L.divIcon({ className: 'draw-area-root', html: '<div class="draw-area-point"></div>', iconSize: [16,16], iconAnchor: [8,8] }), interactive: false }).addTo(advancedAreaLayer));
        advancedAreaBounds = poly.getBounds();
    }
    actualizarAdvancedStatus(`✏️ Puntos marcados: <b>${advancedAreaPoints.length}</b>. ${advancedAreaPoints.length >= 3 ? 'Ya puedes generar el raster.' : 'Marca mínimo 3 puntos.'}`);
}

function obtenerBoundsAnalisis() {
    if(advancedAreaBounds) return advancedAreaBounds;
    return map.getBounds();
}

function normalizarTextoRaster(valor) {
    return String(valor ?? '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ñ/g, 'n');
}

function coordRaster(p) {
    const lat = parseFloat(String(p.lat ?? p.latitude ?? '').replace(',', '.'));
    const lng = parseFloat(String(p.lng ?? p.lon ?? p.longitude ?? '').replace(',', '.'));
    if(!isFinite(lat) || !isFinite(lng)) return null;
    return L.latLng(lat, lng);
}

function puntoDentroBoundsRaster(p, bounds) {
    const ll = coordRaster(p);
    return !!ll && bounds.contains(ll);
}

function obtenerPartesDescripcionRaster(p) {
    return String(p.descripcion || '').split(' | ');
}

function obtenerElementoNombreTextoRaster(p) {
    const d = obtenerPartesDescripcionRaster(p);
    return `${p.tipo || ''} ${p.nombre || ''} ${p.cat || ''} ${d[0] || ''} ${d[1] || ''} ${d[2] || ''} ${p.descripcion || ''}`;
}

function obtenerUsosMatrizDePunto(p) {
    const d = obtenerPartesDescripcionRaster(p);
    const usos = [];

    // Puntos URBIS manuales/anexados: posiciones 6 + índice, igual que formularios, detalles y gráficos.
    if(Array.isArray(todosLosUsos)) {
        todosLosUsos.forEach((uso, idx) => {
            const val = String(d[6 + idx] || '').trim().toUpperCase();
            if(val === 'SI' || val === 'SÍ' || val === 'TRUE' || val === '1') usos.push(uso);
        });
    }

    // AutoMapeo / OSM: ya viene clasificado con nombres de la Matriz de Usos Multidimensional.
    if(Array.isArray(p.usosUrbis)) {
        p.usosUrbis.forEach(u => { if(u && !usos.includes(u)) usos.push(u); });
    }

    // Fallback por iconografía, categoría y texto para datos antiguos o incompletos.
    const txt = normalizarTextoRaster(obtenerElementoNombreTextoRaster(p));
    const fallback = [
        ['Comercial', ['comercio','comercial','tienda','restaurante','cafeteria','cafe','banco','cajero','mall','centro comercial','supermercado','drogueria','barberia','ferreteria','panaderia','carniceria','bar','licorera','minimarket','mercado']],
        ['Ocio / Negocio', ['restaurante','cafeteria','comidas rapidas','bar','discoteca','show','concierto','hotel','turismo','museo','evento']],
        ['Residencial', ['vivienda','residencial','casa','apartamento','conjunto','unidad residencial','torre residencial']],
        ['Institucional', ['institucional','alcaldia','gobernacion','colegio','universidad','policia','bomberos','cai','iglesia','templo']],
        ['Esp. Público', ['parque','plaza','plazoleta','espacio publico','banca','caneca','arbol','sombra']],
        ['Protección Ambiental', ['parque','arbol','verde','ambiental','forestal','jardin','zona verde']],
        ['Deportivo', ['cancha','deportivo','futbol','microfutbol','tenis','padel','skatepark','calistenia','gimnasio']],
        ['Salud (Clínicas/Hospitales)', ['salud','clinica','hospital','consultorio','veterinaria','drogueria','farmacia']],
        ['Educativo (Básico/Superior)', ['educacion','colegio','escuela','universidad','jardin infantil']],
        ['Zona de Riesgo', ['riesgo','inseguridad','insegura','hueco','bache','inundacion','inundada','accidente','reten','trafico','congestion','via cerrada','apagon']]
    ];
    fallback.forEach(([uso, keys]) => {
        if(keys.some(k => txt.includes(k)) && !usos.includes(uso)) usos.push(uso);
    });
    return usos;
}

function pesoPorIconografiaYUso(tipo, usos, p) {
    const txt = normalizarTextoRaster(obtenerElementoNombreTextoRaster(p));
    const u = usos.map(normalizarTextoRaster).join(' | ');
    let peso = 0;

    if(tipo === 'comercio') {
        if(u.includes('comercial')) peso += 1.8;
        if(u.includes('ocio / negocio')) peso += 1.0;
        if(u.includes('parqueadero')) peso += .45;
        if(txt.includes('restaurante') || txt.includes('tienda') || txt.includes('supermercado') || txt.includes('cafeteria') || txt.includes('banco') || txt.includes('mall') || txt.includes('drogueria') || txt.includes('barberia') || txt.includes('ferreteria')) peso += 1.2;
        if((p.tipo || '').toLowerCase().includes('comercio')) peso += 1.2;
    }
    else if(tipo === 'inseguridad') {
        if(u.includes('zona de riesgo')) peso += 1.8;
        if(txt.includes('inseguridad') || txt.includes('insegura') || txt.includes('hueco') || txt.includes('bache') || txt.includes('inund') || txt.includes('accidente') || txt.includes('reten') || txt.includes('trafico') || txt.includes('via cerrada') || txt.includes('apagon')) peso += 1.6;
        if((p.tipo || '').includes('🚨') || (p.tipo || '').includes('Tráfico')) peso += 1.0;
    }
    else if(tipo === 'verde') {
        if(u.includes('esp. publico')) peso += 1.2;
        if(u.includes('proteccion ambiental') || u.includes('forestal')) peso += 1.8;
        if(txt.includes('parque') || txt.includes('arbol') || txt.includes('jardin') || txt.includes('verde') || txt.includes('sombra')) peso += 1.3;
        if((p.tipo || '').toLowerCase().includes('verde') || (p.tipo || '').toLowerCase().includes('ambiental')) peso += 1.2;
    }
    else if(tipo === 'altura') {
        if(txt.includes('torre')) peso += 2.0;
        if(txt.includes('edificio')) peso += 1.4;
        if(txt.includes('apartamento')) peso += 1.2;
        if(txt.includes('tres pisos') || txt.includes('+6') || txt.includes('6 pisos')) peso += 1.5;
        if(txt.includes('dos pisos')) peso += .8;
        if(txt.includes('centro comercial') || txt.includes('mall')) peso += 1.0;
    }
    else if(tipo === 'llenos-vacios') {
        // Para llenos/vacíos cuenta cualquier punto construido o uso urbano activo.
        if(usos.length) peso += 1.0;
        if(u.includes('residencial') || u.includes('comercial') || u.includes('institucional') || u.includes('industrial') || u.includes('salud') || u.includes('educativo')) peso += 1.0;
        if(txt.includes('edificio') || txt.includes('casa') || txt.includes('local') || txt.includes('centro comercial') || txt.includes('bodega')) peso += 1.0;
    }
    else {
        peso = usos.length ? Math.min(3, usos.length) : 0;
    }

    return peso;
}

function obtenerFuenteRasterDatos() {
    const manualesBase = (typeof datosVisiblesActuales === 'function' ? datosVisiblesActuales() : (Array.isArray(globalData) ? globalData : []));
    const manuales = manualesBase.map(p => ({ ...p, __fuente: 'Matriz URBIS' }));
    const automap = (Array.isArray(autoMapeoCucutaRegistros) ? autoMapeoCucutaRegistros : [])
        .map(p => ({ ...p, __fuente: 'AutoMapeo OSM' }));
    return manuales.concat(automap).filter(p => !!coordRaster(p));
}

function puntosAnaliticosRaster(tipo, bounds) {
    return obtenerFuenteRasterDatos()
        .map(p => {
            const latlng = coordRaster(p);
            const usos = obtenerUsosMatrizDePunto(p);
            const peso = pesoPorIconografiaYUso(tipo, usos, p);
            return { p, latlng, usos, peso };
        })
        .filter(x => x.latlng && x.peso > 0 && bounds.contains(x.latlng));
}

function distanciaMetrosRaster(a, b) {
    return map.distance(a, b);
}

function metricasRasterBounds(bounds, cellMeters = ADVANCED_RASTER_CELL_METERS) {
    const center = bounds.getCenter();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    const altoM = map.distance([south, center.lng], [north, center.lng]);
    const anchoM = map.distance([center.lat, west], [center.lat, east]);

    let rows = Math.max(1, Math.ceil(altoM / cellMeters));
    let cols = Math.max(1, Math.ceil(anchoM / cellMeters));
    let escalaUsada = cellMeters;

    // Si el usuario toma un área enorme, mantenemos la app estable.
    // En áreas normales usa 5m reales; en áreas gigantes sube la escala solo lo necesario.
    const total = rows * cols;
    if(total > ADVANCED_RASTER_MAX_CELLS) {
        const factor = Math.sqrt(total / ADVANCED_RASTER_MAX_CELLS);
        escalaUsada = Math.ceil(cellMeters * factor);
        rows = Math.max(1, Math.ceil(altoM / escalaUsada));
        cols = Math.max(1, Math.ceil(anchoM / escalaUsada));
    }

    return { altoM, anchoM, rows, cols, escalaUsada };
}

function latLngDesdeIndiceRaster(bounds, r, c, rows, cols) {
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const s = south + (north - south) * (r / rows);
    const n = south + (north - south) * ((r + 1) / rows);
    const w = west + (east - west) * (c / cols);
    const e = west + (east - west) * ((c + 1) / cols);
    return { s, n, w, e, centro: L.latLng((s + n) / 2, (w + e) / 2) };
}

function clampRaster(v, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number(v) || 0));
}

function hexToRgbRaster(hex) {
    const clean = String(hex || '').replace('#', '').trim();
    const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
    return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16)
    };
}

function rgbToHexRaster({ r, g, b }) {
    const toHex = v => Math.round(clampRaster(v, 0, 255)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mezclarColorRaster(a, b, t) {
    const ca = hexToRgbRaster(a);
    const cb = hexToRgbRaster(b);
    const k = clampRaster(t);
    return rgbToHexRaster({
        r: ca.r + (cb.r - ca.r) * k,
        g: ca.g + (cb.g - ca.g) * k,
        b: ca.b + (cb.b - ca.b) * k
    });
}

function interpolarPaletaRaster(n, stops) {
    const x = clampRaster(n);
    for(let i = 0; i < stops.length - 1; i++) {
        const a = stops[i];
        const b = stops[i + 1];
        if(x >= a[0] && x <= b[0]) {
            return mezclarColorRaster(a[1], b[1], (x - a[0]) / Math.max(0.0001, b[0] - a[0]));
        }
    }
    return stops[stops.length - 1][1];
}

function ajusteVisualRasterPorZoom() {
    const z = typeof map?.getZoom === 'function' ? map.getZoom() : 15;
    if(z <= 13) return { gamma: .58, opacityScale: 1.24, minVisible: .030, label: 'vista general' };
    if(z <= 15) return { gamma: .68, opacityScale: 1.10, minVisible: .034, label: 'vista media' };
    if(z <= 17) return { gamma: .78, opacityScale: .98, minVisible: .038, label: 'vista urbana' };
    return { gamma: .92, opacityScale: .86, minVisible: .042, label: 'detalle 5m' };
}

function etiquetaIntensidadRaster(n) {
    if(n >= .84) return 'impacto crítico';
    if(n >= .66) return 'impacto alto';
    if(n >= .46) return 'impacto medio-alto';
    if(n >= .28) return 'impacto medio';
    if(n >= .13) return 'impacto bajo';
    return 'impacto muy bajo';
}

function colorHeatPorNormalizado(n) {
    const ajuste = ajusteVisualRasterPorZoom();
    const base = clampRaster(n);
    const perceptual = Math.pow(base, ajuste.gamma);

    // Paleta continua tipo relieve: azul profundo → celeste → verde → amarillo → naranja → rojo.
    // No salta por bloques; interpola el color para que el cambio sea gradual.
    const fillColor = interpolarPaletaRaster(perceptual, [
        [0.00, '#1d4ed8'], // azul: impacto mínimo real
        [0.14, '#38bdf8'], // celeste
        [0.30, '#22c55e'], // verde
        [0.50, '#facc15'], // amarillo
        [0.70, '#fb923c'], // naranja
        [0.86, '#ef4444'], // rojo
        [1.00, '#7f1d1d']  // rojo oscuro: foco máximo
    ]);

    const fillOpacity = clampRaster((0.06 + Math.pow(base, .62) * 0.66) * ajuste.opacityScale, 0.04, 0.78);
    let clase = 'heat-relief';
    if(base >= .78) clase += ' heat-peak';
    else if(base >= .50) clase += ' heat-high';
    else if(base >= .27) clase += ' heat-mid';
    else clase += ' heat-low';
    return { fillColor, fillOpacity, clase, label: etiquetaIntensidadRaster(base), zoomLabel: ajuste.label };
}

function colorEspecialRaster(tipo, scoreNorm, scoreAbs) {
    if(tipo === 'llenos-vacios') {
        return scoreAbs > .20
            ? { fillColor: '#23232b', fillOpacity: Math.max(.24, Math.min(.68, .25 + scoreNorm * .5)), clase: 'empty-built', label: 'lleno urbano' }
            : { fillColor: '#ffffff', fillOpacity: .05, clase: 'empty-void', label: 'vacío probable' };
    }
    if(tipo === 'verde') {
        return scoreNorm >= .18
            ? { fillColor: '#2ed573', fillOpacity: Math.max(.28, Math.min(.62, .30 + scoreNorm * .36)), clase: 'green-area', label: 'cobertura verde' }
            : { fillColor: '#3b82f6', fillOpacity: .03, clase: 'heat-empty', label: 'sin verde detectado' };
    }
    if(tipo === 'altura') {
        if(scoreNorm >= .72) return { fillColor: '#222222', fillOpacity: .68, clase: 'height-high', label: 'altura alta' };
        if(scoreNorm >= .36) return { fillColor: '#737373', fillOpacity: .48, clase: 'height-mid', label: 'altura media' };
        if(scoreNorm >= .12) return { fillColor: '#d1d5db', fillOpacity: .24, clase: 'height-low', label: 'altura baja' };
        return { fillColor: '#ffffff', fillOpacity: .03, clase: 'heat-empty', label: 'sin volumen detectado' };
    }
    return colorHeatPorNormalizado(scoreNorm);
}

function crearRasterGrid(tipo) {
    const bounds = obtenerBoundsAnalisis();
    const metricas = metricasRasterBounds(bounds, ADVANCED_RASTER_CELL_METERS);
    const rows = metricas.rows;
    const cols = metricas.cols;
    const puntos = puntosAnaliticosRaster(tipo, bounds);
    const radio = Math.max(ADVANCED_RASTER_RADIUS_METERS, metricas.escalaUsada * 8);
    const sigma = radio / 2.35;

    // Matriz numérica de alta precisión: cada celda representa aprox. 5m cuando el área lo permite.
    // Para no dibujar una grilla visible, solo renderizamos celdas con intensidad real.
    const scores = new Float32Array(rows * cols);
    const directCounts = new Uint16Array(rows * cols);
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();

    function idx(r, c) { return r * cols + c; }
    function rowFromLat(lat) {
        return Math.max(0, Math.min(rows - 1, Math.floor(((lat - south) / (north - south)) * rows)));
    }
    function colFromLng(lng) {
        return Math.max(0, Math.min(cols - 1, Math.floor(((lng - west) / (east - west)) * cols)));
    }

    const radiusCells = Math.max(2, Math.ceil(radio / metricas.escalaUsada));
    puntos.forEach(x => {
        const pr = rowFromLat(x.latlng.lat);
        const pc = colFromLng(x.latlng.lng);
        directCounts[idx(pr, pc)] += 1;

        const r0 = Math.max(0, pr - radiusCells);
        const r1 = Math.min(rows - 1, pr + radiusCells);
        const c0 = Math.max(0, pc - radiusCells);
        const c1 = Math.min(cols - 1, pc + radiusCells);

        for(let r = r0; r <= r1; r++) {
            for(let c = c0; c <= c1; c++) {
                const celda = latLngDesdeIndiceRaster(bounds, r, c, rows, cols);
                const d = distanciaMetrosRaster(celda.centro, x.latlng);
                if(d > radio) continue;
                const influencia = Math.exp(-(d * d) / (2 * sigma * sigma));
                scores[idx(r, c)] += x.peso * influencia;
            }
        }
    });

    let maxScore = 0;
    for(let i = 0; i < scores.length; i++) if(scores[i] > maxScore) maxScore = scores[i];

    const cells = [];
    const minNormVisible = tipo === 'llenos-vacios' ? 0 : 0.045;
    for(let r = 0; r < rows; r++) {
        for(let c = 0; c < cols; c++) {
            const pos = idx(r, c);
            const score = scores[pos];
            const norm = maxScore > 0 ? score / maxScore : 0;
            if(tipo !== 'llenos-vacios' && norm < minNormVisible) continue;

            const estilo = colorEspecialRaster(tipo, norm, score);
            const isEmpty = estilo.clase === 'heat-empty' || (tipo !== 'llenos-vacios' && score <= 0.01);
            if(isEmpty && tipo !== 'llenos-vacios') continue;

            const celda = latLngDesdeIndiceRaster(bounds, r, c, rows, cols);
            const cell = L.rectangle([[celda.s, celda.w], [celda.n, celda.e]], {
                stroke: false,              // grilla invisible
                fillColor: estilo.fillColor,
                fillOpacity: estilo.fillOpacity,
                interactive: true,
                className: `raster-cell raster-cell-5m ${estilo.clase}`
            });
            cell.__urbisRasterMeta = { tipo, norm, score, directos: directCounts[pos], escala: metricas.escalaUsada };
            cell.bindTooltip(`Raster ${tipo}: ${estilo.label}<br>Resolución: ~${metricas.escalaUsada} m/celda<br>Intensidad: ${(norm * 100).toFixed(0)}%<br>Rango visual: ${estilo.zoomLabel || ajusteVisualRasterPorZoom().label}<br>Puntos directos: ${directCounts[pos]}`, { sticky: true });
            cells.push(cell);
        }
    }

    return { cells, puntos, maxScore, rows, cols, bounds, escalaUsada: metricas.escalaUsada, totalCeldas: rows * cols };
}


function aplicarEstiloRasterPorZoom() {
    if(!advancedRasterGenerated || !Array.isArray(advancedRasterCellsMeta) || !advancedRasterCellsMeta.length) return;
    advancedRasterCellsMeta.forEach(({ cell, tipo, norm, score }) => {
        if(!cell || typeof cell.setStyle !== 'function') return;
        const estilo = colorEspecialRaster(tipo, norm, score);
        cell.setStyle({ fillColor: estilo.fillColor, fillOpacity: estilo.fillOpacity, stroke: false });
    });
    const status = document.getElementById('advanced-raster-status');
    if(status && status.innerHTML.includes('Raster conectado')) {
        const ajuste = ajusteVisualRasterPorZoom();
        status.innerHTML = status.innerHTML.replace(/Rango visual: <b>.*?<\/b>\./, `Rango visual: <b>${ajuste.label}</b>.`);
    }
}

map.on('zoomend', aplicarEstiloRasterPorZoom);

function activarCheckboxRasterSegunTipo(tipo) {
    const mapIds = {
        'comercio': 'toggle-raster-heat',
        'inseguridad': 'toggle-raster-heat',
        'usos': 'toggle-raster-heat',
        'llenos-vacios': 'toggle-raster-empty',
        'verde': 'toggle-raster-green',
        'altura': 'toggle-raster-height'
    };
    ['toggle-raster-heat','toggle-raster-empty','toggle-raster-green','toggle-raster-height'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.checked = id === mapIds[tipo];
    });
}

window.generarRasterDemo = function() {
    if(userRole !== 'admin' && userRole !== 'edu') return;
    const tipo = document.getElementById('advanced-raster-type')?.value || 'comercio';
    advancedLastRasterType = tipo;
    if(!advancedAreaBounds) usarVistaActualComoArea();

    advancedRasterLayer.clearLayers();
    advancedRasterCellsMeta = [];
    const resultado = crearRasterGrid(tipo);
    resultado.cells.forEach(cell => {
        cell.addTo(advancedRasterLayer);
        if(cell.__urbisRasterMeta) advancedRasterCellsMeta.push({ cell, ...cell.__urbisRasterMeta });
    });
    if(!map.hasLayer(advancedRasterLayer)) advancedRasterLayer.addTo(map);
    advancedRasterGenerated = true;
    activarCheckboxRasterSegunTipo(tipo);

    const totalFuente = obtenerFuenteRasterDatos().length;
    const manuales = (typeof datosVisiblesActuales === 'function' ? datosVisiblesActuales() : (Array.isArray(globalData) ? globalData : [])).length;
    const automap = Array.isArray(autoMapeoCucutaRegistros) ? autoMapeoCucutaRegistros.length : 0;
    const puntosUsados = resultado.puntos.length;

    if(puntosUsados === 0) {
        actualizarRasterStatus(`⚠️ No encontré puntos compatibles con <b>${tipo}</b> dentro del área. Datos disponibles: <b>${totalFuente}</b> (${manuales} URBIS + ${automap} OSM). Prueba con <b>Recargar lugares</b> en AutoMapeo o usa una zona con marcadores comerciales/urbanos.`);
        return;
    }

    actualizarRasterStatus(`✅ Raster conectado a Matriz de Usos: <b>${tipo}</b>. Puntos usados dentro del área: <b>${puntosUsados}</b>. Fuente total: <b>${manuales}</b> URBIS + <b>${automap}</b> AutoMapeo OSM. Resolución: <b>~${resultado.escalaUsada} m/celda</b>. Celdas calculadas: <b>${resultado.totalCeldas}</b>. Celdas visibles: <b>${resultado.cells.length}</b>. Máxima intensidad: <b>${resultado.maxScore.toFixed(2)}</b>. Rango visual: <b>${ajusteVisualRasterPorZoom().label}</b>.`);
};

window.toggleRasterLayer = function(kind) {
    if(!advancedRasterGenerated) generarRasterDemo();
    const anyChecked = ['toggle-raster-heat','toggle-raster-empty','toggle-raster-green','toggle-raster-height'].some(id => document.getElementById(id)?.checked);
    if(anyChecked) {
        if(!map.hasLayer(advancedRasterLayer)) advancedRasterLayer.addTo(map);
    } else if(map.hasLayer(advancedRasterLayer)) {
        map.removeLayer(advancedRasterLayer);
    }
};

window.actualizarVistaRasterPreview = function() {
    if(advancedRasterGenerated) generarRasterDemo();
};

window.previsualizarImagenRaster = function(input) {
    const file = input.files && input.files[0];
    const cont = document.getElementById('raster-image-preview');
    if(!file || !cont) return;
    const reader = new FileReader();
    reader.onload = e => {
        cont.innerHTML = `<img src="${e.target.result}" alt="Imagen raster cargada"><div style="margin-top:8px;">Imagen cargada. Siguiente fase: conectar detección de edificios/vegetación.</div>`;
    };
    reader.readAsDataURL(file);
};

map.on('click', (ev) => {
    if(!advancedDrawMode) return;
    agregarPuntoAreaAnalisis(ev.latlng);
});

map.on('dblclick', () => {
    if(advancedDrawMode && advancedAreaPoints.length >= 3) {
        advancedDrawMode = false;
        map.getContainer().style.cursor = '';
        actualizarAdvancedStatus(`Área cerrada con <b>${advancedAreaPoints.length}</b> puntos. Puedes generar el raster.`);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    activarAcordeonesMoviles();
    const adv = document.getElementById('tab-btn-advanced');
    if(adv) adv.style.display = 'none';
});
