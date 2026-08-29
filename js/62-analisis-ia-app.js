/* URBIS · Análisis de Implantación IA — APP/UI (js/62)
   Orquesta la página standalone: mapa Leaflet propio, wizard de 4 pasos,
   bottom sheet deslizable (panel derecho en escritorio vía CSS), dashboard
   con Chart.js y llamado al motor + datos. */
(function(){
  'use strict';

  const CENTRO_CUCUTA = [7.8891, -72.4967];
  const ALTURAS_SHEET = { wizard: .58, peek: 0, analizando: .40, resultados: .62, full: .92 }; // fracción de viewport (peek usa px fijos)
  const PEEK_PX = 96;

  const S = {
    map: null, capaBase: null, satelite: true,
    marcadorLote: null, circuloRadio: null, capaPOIs: null,
    lote: null,            // {lat, lng}
    radioM: 500,
    tipoEstudio: 'completo',
    proyectoId: '',
    direccionAprox: '',
    resultado: null,
    charts: {},
    analizando: false,
    // Modo mixto (Constructor de proyecto)
    modo: 'simple',          // 'simple' | 'mixto'
    usosMixto: [],           // [{id,nombre,icono,esCustom,...}]
    config: {},              // configuración del edificio
    ultimosElementos: null,  // POIs crudos de Overpass, en memoria para recalcular sin red
    tabActiva: 'nuevo'        // 'nuevo' | 'guardados'
  };

  const $ = id => document.getElementById(id);

  // ── Usos agregados a mano ───────────────────────────────────────────────
  //
  // El análisis solo puede ver lo que está mapeado, y en Cúcuta falta mucho
  // por mapear: un gimnasio de cadena a media cuadra del lote puede no existir
  // en OpenStreetMap y el informe lo lee como un vacío de mercado. Esto deja
  // señalarlo a mano, con su categoría exacta de la Matriz, y que cuente en
  // todo lo que sigue: flujo, mapas de calor, oportunidades, FODA y PDF.
  //
  // Se guardan por coordenada y no por lote: un local existe donde existe, así
  // que sirve para cualquier análisis futuro que lo alcance en su radio. Y se
  // guardan aparte de la caché del entorno, que se borra sola cada 24 h.
  const USOS_MANUALES_KEY = 'aia_usos_manuales_v1';

  function leerUsosManuales(){
    try {
      const v = JSON.parse(localStorage.getItem(USOS_MANUALES_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch(e) { return []; }
  }
  function escribirUsosManuales(lista){
    try { localStorage.setItem(USOS_MANUALES_KEY, JSON.stringify(lista)); } catch(e) {}
  }
  function agregarUsoManual(uso){
    const lista = leerUsosManuales();
    lista.push(Object.assign({ id: 'm' + Date.now(), creado: new Date().toISOString() }, uso));
    escribirUsosManuales(lista);
    return lista;
  }
  function borrarUsoManual(id){
    const lista = leerUsosManuales().filter(u => u.id !== id);
    escribirUsosManuales(lista);
    return lista;
  }
  // Editar en vez de borrar y volver a crear: así el uso conserva su id y su
  // fecha de creación, y quien revise después ve que es el mismo punto
  // corregido y no uno nuevo que apareció de la nada.
  function editarUsoManual(id, cambios){
    const lista = leerUsosManuales();
    const i = lista.findIndex(u => u.id === id);
    if (i < 0) return lista;
    lista[i] = Object.assign({}, lista[i], cambios, { editado: new Date().toISOString() });
    escribirUsosManuales(lista);
    return lista;
  }
  // Los que caen dentro del radio analizado, con la forma de un elemento de
  // Overpass para que el motor no tenga que saber de dónde vienen.
  function elementosManuales(centro, radioM){
    return leerUsosManuales()
      .filter(u => window.AIA_MOTOR.haversineM(centro, { lat: u.lat, lng: u.lng }) <= radioM)
      .map(u => {
        const tags = { 'urbis:sub': u.sub, 'urbis:manual': 'si' };
        if (u.nombre) tags.name = u.nombre;
        // Mismas etiquetas que usa el modo educativo: la altura pesa en el
        // flujo peatonal y el frente decide si el local hace acera. Un uso
        // agregado desde la calle merece contar con el mismo detalle que uno
        // levantado por un curso — es el mismo trabajo de campo.
        if (u.pisos > 0) {
          tags['building:levels'] = String(u.pisos);
          tags['urbis:intensidad'] = String(u.pisos);
        }
        // `frenteActivo` se resuelve al guardar, no aquí: es una propiedad del
        // dato, no de cómo se lea. Solo se etiqueta si de verdad se registró —
        // un `undefined` no puede convertirse en 'muerto'.
        if (u.plantaBaja && (u.frenteActivo === true || u.frenteActivo === false)) {
          tags['urbis:planta_baja'] = u.plantaBaja;
          tags['urbis:frente'] = u.frenteActivo ? 'activo' : 'muerto';
        }
        return { type: 'node', id: u.id, lat: u.lat, lon: u.lng, tags };
      });
  }

  // Los desplegables de la ficha se arman desde window.URBIS_EDIFICIO, que es
  // la misma fuente que usa el formulario de mapeo. Mantener una segunda lista
  // aquí garantizaría que un día digan cosas distintas.
  function llenarSelectsFicha(){
    const EDIF = window.URBIS_EDIFICIO;
    if (!EDIF) return;
    [['aia-uso-material', EDIF.MATERIALIDAD],
     ['aia-uso-planta',   EDIF.PLANTA_BAJA],
     ['aia-uso-epoca',    EDIF.EPOCA]].forEach(function (par) {
      const sel = $(par[0]);
      if (!sel || sel.options.length) return;
      sel.innerHTML = (par[1] || []).map(v =>
        '<option value="' + v + '">' + v + '</option>').join('');
    });
  }

  // Lo que el analista dejó en la ficha, ya normalizado. Devuelve solo lo
  // registrado de verdad: "sin registrar", "no se sabe" y "otro" no son
  // observaciones y no pueden entrar al cálculo como si lo fueran.
  function leerFichaFormulario(){
    const EDIF = window.URBIS_EDIFICIO;
    const out = {};
    if (!EDIF) return out;
    const util = v => {
      const t = String(v || '').trim();
      return (!t || t === EDIF.SIN_REGISTRAR || t === EDIF.NO_SE_SABE || t === EDIF.OTRO)
        ? '' : t;
    };
    const mat = util($('aia-uso-material') && $('aia-uso-material').value);
    const pb  = util($('aia-uso-planta') && $('aia-uso-planta').value);
    const ep  = util($('aia-uso-epoca') && $('aia-uso-epoca').value);
    const pisos = parseInt($('aia-uso-pisos') && $('aia-uso-pisos').value, 10);
    if (mat) out.materialidad = mat;
    if (ep) out.epoca = ep;
    if (isFinite(pisos) && pisos > 0) out.pisos = Math.min(pisos, 60);
    if (pb) {
      out.plantaBaja = pb;
      out.frenteActivo = !EDIF.esFrenteMuerto(pb);
    }
    if (mat || ep) {
      const v = EDIF.vulnerabilidadDe(mat, ep);
      if (v) out.vulnerabilidad = v.nivel;
    }
    return out;
  }

  // Agrega las fichas de los usos manuales dentro del radio, con la misma
  // forma que produce el modo educativo, para que el informe tenga una sola
  // manera de leerlas venga de donde venga el levantamiento.
  function edificacionDeManuales(centro, radioM){
    const EDIF = window.URBIS_EDIFICIO;
    if (!EDIF) return null;
    const e = { total:0, conEpoca:0, conMaterial:0, evaluables:0,
                porEpoca:{}, porMaterial:{}, alta:0, media:0, baja:0,
                anteriores1984:0, patrimonio:0, enObra:0,
                noSeSabe:0, otros:0, textosOtro:[] };
    leerUsosManuales()
      .filter(u => window.AIA_MOTOR.haversineM(centro, { lat:u.lat, lng:u.lng }) <= radioM)
      .forEach(function (u) {
        if (!u.materialidad && !u.epoca && !(u.pisos > 0) && !u.plantaBaja) return;
        e.total++;
        if (u.epoca) {
          e.conEpoca++;
          e.porEpoca[u.epoca] = (e.porEpoca[u.epoca] || 0) + 1;
          if (u.epoca === 'Anterior a 1950') e.patrimonio++;
          if (/Anterior a 1950|1950 – 1983/.test(u.epoca)) e.anteriores1984++;
          if (u.epoca === 'En construcción') e.enObra++;
        }
        if (u.materialidad) {
          e.conMaterial++;
          e.porMaterial[u.materialidad] = (e.porMaterial[u.materialidad] || 0) + 1;
        }
        const v = EDIF.vulnerabilidadDe(u.materialidad || '', u.epoca || '');
        if (v) {
          e.evaluables++;
          if (v.nivel === 'Alta') e.alta++; else if (v.nivel === 'Media') e.media++; else e.baja++;
        }
      });
    return e.total ? e : null;
  }

  // ── Panel "Agregar uso" ─────────────────────────────────────────────────
  let usoPendiente = null;   // { lat, lng } señalado y todavía sin guardar
  let editandoId = null;     // id del uso que se está corrigiendo, o null

  // El desplegable se arma desde la Matriz, agrupado por grupo: así ofrece
  // exactamente las mismas categorías con las que cuenta el análisis, y no
  // hace falta mantener una segunda lista que se desincronice.
  function llenarSelectUsos(){
    const sel = $('aia-uso-sub');
    if (!sel || sel.options.length) return;
    const M = window.AIA_MOTOR;
    const porGrupo = {};
    M.TAXONOMIA.forEach(t => {
      // Las vías y ciclorrutas no son puntos que alguien vaya a señalar, y
      // 'personalizado' no es una categoría real de la Matriz.
      if (t.sub === 'via_arteria' || t.sub === 'ciclorruta') return;
      (porGrupo[t.grupo] = porGrupo[t.grupo] || []).push(t);
    });
    sel.innerHTML = '<option value="">Elige una categoría…</option>';
    Object.keys(M.GRUPOS).forEach(g => {
      const lista = porGrupo[g];
      if (!lista || !lista.length) return;
      const og = document.createElement('optgroup');
      og.label = M.GRUPOS[g].i + ' ' + M.GRUPOS[g].t;
      // Una misma subcategoría puede aparecer dos veces en la Matriz (misma
      // categoría alcanzada por etiquetas distintas): en el desplegable no.
      const vistos = {};
      lista.forEach(t => {
        if (vistos[t.sub]) return;
        vistos[t.sub] = 1;
        const o = document.createElement('option');
        o.value = t.sub;
        o.textContent = t.icono + ' ' + t.nombre;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
  }

  function refrescarBotonUso(){
    const b = $('aia-uso-guardar');
    if (b) b.disabled = !(usoPendiente && $('aia-uso-sub').value);
  }

  function ubicarUsoManual(lat, lng){
    usoPendiente = { lat, lng };
    S.ubicandoUso = false;
    const btn = $('aia-uso-tocar');
    if (btn) { btn.classList.remove('activo'); btn.textContent = '📍 Tocar en el mapa'; }
    $('aia-uso-donde').innerHTML = '📍 Ubicación: <b>' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</b>';
    // Marca provisional: se ve dónde va a quedar antes de confirmarlo.
    if (S.marcaUso) S.map.removeLayer(S.marcaUso);
    S.marcaUso = L.circleMarker([lat, lng], { radius: 9, color: '#ffffff', weight: 2.4,
      dashArray: '3 2', fillColor: '#22d3ee', fillOpacity: .85 }).addTo(S.map);
    refrescarBotonUso();
  }

  function nombreDeSub(sub){
    const t = window.AIA_MOTOR.TAXONOMIA.find(x => x.sub === sub);
    return t ? t.icono + ' ' + t.nombre : sub;
  }

  function pintarListaUsosManuales(){
    const cont = $('aia-uso-lista');
    const cuenta = $('aia-uso-cuenta');
    if (!cont) return;
    const M = window.AIA_MOTOR;
    const lista = leerUsosManuales();
    if (cuenta) cuenta.textContent = lista.length;
    if (!lista.length) {
      cont.innerHTML = '<p class="aia-uso-vacio">Todavía no has agregado ningún uso. ' +
        'Usa la pestaña “Agregar” para señalar los locales que existen en la calle ' +
        'pero que no están en el mapa abierto.</p>';
      return;
    }
    // Cada uno con su distancia al lote y si entra o no en el radio: un uso
    // fuera del radio no cuenta en el análisis, y sin decirlo parecería que
    // el motor lo está ignorando por error.
    const filas = lista.map(u => {
      const d = S.lote ? Math.round(M.haversineM(S.lote, { lat: u.lat, lng: u.lng })) : null;
      const fuera = d != null && d > S.radioM;
      return { u: u, d: d, fuera: fuera };
    }).sort((a, b) => (a.d == null ? 1e9 : a.d) - (b.d == null ? 1e9 : b.d));
    const dentro = filas.filter(f => f.d != null && !f.fuera).length;

    cont.innerHTML =
      '<p class="aia-uso-resumen">' + lista.length +
        (lista.length === 1 ? ' uso agregado' : ' usos agregados') +
        (S.lote ? ' · <b>' + dentro + '</b> dentro del radio de este análisis' : '') + '</p>' +
      filas.map(f =>
        '<div class="aia-uso-item' + (f.fuera ? ' fuera' : '') + '" data-ver="' + f.u.id + '">' +
          '<span>' + escHTML(nombreDeSub(f.u.sub)) +
            (f.u.nombre ? '<b>' + escHTML(f.u.nombre) + '</b>' : '') +
            '<em>' + (f.d == null ? 'sin lote fijado'
                      : (f.fuera ? 'a ' + f.d + ' m · fuera del radio, no cuenta'
                                 : 'a ' + f.d + ' m')) + '</em>' +
          '</span>' +
          '<button type="button" class="ed" data-editar="' + f.u.id + '" title="Editar">✏️</button>' +
          '<button type="button" class="bo" data-borrar="' + f.u.id + '" title="Eliminar">🗑️</button>' +
        '</div>').join('');

    // Tocar la fila centra el mapa en ese uso: con cientos de puntos, es la
    // única forma de saber cuál es el que se está por corregir.
    cont.querySelectorAll('[data-ver]').forEach(fila => {
      fila.addEventListener('click', ev => {
        if (ev.target.closest('button')) return;
        const u = leerUsosManuales().find(x => x.id === fila.dataset.ver);
        if (!u) return;
        S.map.panTo([u.lat, u.lng]);
        resaltarUso(u);
      });
    });
    cont.querySelectorAll('[data-editar]').forEach(b => {
      b.addEventListener('click', () => empezarEdicion(b.dataset.editar));
    });
    cont.querySelectorAll('[data-borrar]').forEach(b => {
      b.addEventListener('click', () => {
        const u = leerUsosManuales().find(x => x.id === b.dataset.borrar);
        if (!u) return;
        // Borrar cambia el análisis, así que se confirma nombrando cuál es:
        // en una lista de varios, un toque equivocado se lleva el que no era.
        const etq = nombreDeSub(u.sub) + (u.nombre ? ' · ' + u.nombre : '');
        if (!confirm('¿Eliminar este uso del análisis?\n\n' + etq)) return;
        borrarUsoManual(u.id);
        if (editandoId === u.id) cancelarEdicion();
        pintarListaUsosManuales();
        if (S.resultado) ejecutarAnalisis();
      });
    });
  }

  // Marca temporal para señalar cuál es el uso que se está mirando.
  function resaltarUso(u){
    if (S.marcaUso) S.map.removeLayer(S.marcaUso);
    S.marcaUso = L.circleMarker([u.lat, u.lng], { radius: 11, color: '#ffffff', weight: 2.6,
      dashArray: '3 2', fillColor: '#22d3ee', fillOpacity: .8 }).addTo(S.map);
  }

  // ── Editar un uso ya puesto ─────────────────────────────────────────────
  function empezarEdicion(id){
    const u = leerUsosManuales().find(x => x.id === id);
    if (!u) return;
    editandoId = id;
    usoPendiente = { lat: u.lat, lng: u.lng };
    llenarSelectUsos();
    llenarSelectsFicha();
    verPestanaUso('agregar');
    $('aia-uso-titulo').textContent = '✏️ Corregir este uso';
    $('aia-uso-sub').value = u.sub;
    $('aia-uso-nombre').value = u.nombre || '';
    $('aia-uso-donde').innerHTML = '📍 Ubicación: <b>' + Number(u.lat).toFixed(6) + ', ' +
      Number(u.lng).toFixed(6) + '</b><small>Toca el mapa si quieres moverlo.</small>';
    $('aia-uso-guardar').textContent = 'Guardar cambios y re-analizar';
    S.map.panTo([u.lat, u.lng]);
    resaltarUso(u);
    refrescarBotonUso();
  }

  function cancelarEdicion(){
    editandoId = null;
    $('aia-uso-titulo').textContent = '➕ Agregar un uso al análisis';
    $('aia-uso-guardar').textContent = 'Agregar y re-analizar';
  }

  function verPestanaUso(cual){
    const p = $('aia-agregar-uso');
    if (!p) return;
    p.querySelectorAll('[data-uso-tab]').forEach(b =>
      b.classList.toggle('activo', b.dataset.usoTab === cual));
    $('aia-uso-panel-agregar').hidden = cual !== 'agregar';
    $('aia-uso-panel-mios').hidden = cual !== 'mios';
    if (cual === 'mios') pintarListaUsosManuales();
  }

  function abrirAgregarUso(){
    llenarSelectUsos();
    llenarSelectsFicha();
    pintarListaUsosManuales();
    const p = $('aia-agregar-uso');
    if (p) p.hidden = false;
    // Con usos ya puestos, lo más probable es que se venga a revisarlos o a
    // corregir uno; en la primera vez, a agregar el primero.
    verPestanaUso(leerUsosManuales().length ? 'mios' : 'agregar');
    refrescarBotonUso();
    if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function cerrarAgregarUso(){
    const p = $('aia-agregar-uso');
    if (p) p.hidden = true;
    S.ubicandoUso = false;
    usoPendiente = null;
    cancelarEdicion();
    if (S.marcaUso) { S.map.removeLayer(S.marcaUso); S.marcaUso = null; }
    const btn = $('aia-uso-tocar');
    if (btn) { btn.classList.remove('activo'); btn.textContent = '📍 Tocar en el mapa'; }
    $('aia-uso-donde').innerHTML = '📍 Ubicación: <b>sin definir</b>';
    $('aia-uso-nombre').value = '';
    $('aia-uso-sub').value = '';
    verPestanaUso('agregar');
  }

  // ── Mapa ────────────────────────────────────────────────────────────────
  const TILE_SAT = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
  const TILE_CLARO = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  function initMapa(){
    S.map = L.map('aia-map', { zoomControl: false, maxZoom: 21 }).setView(CENTRO_CUCUTA, 15);
    S.capaBase = L.tileLayer(TILE_SAT, { maxNativeZoom: 21, maxZoom: 21, attribution: '&copy; Google' }).addTo(S.map);
    S.capaPOIs = L.layerGroup().addTo(S.map);
    S.map.on('click', e => {
      // Con el modo de agregar uso encendido, el toque ubica el uso; si no,
      // mueve el lote como siempre. Sin esta bifurcación, señalar el gimnasio
      // movería el punto de análisis y habría que empezar de nuevo.
      if (S.ubicandoUso) { ubicarUsoManual(e.latlng.lat, e.latlng.lng); return; }
      setLote(e.latlng.lat, e.latlng.lng);
    });
  }

  function alternarBase(){
    S.satelite = !S.satelite;
    S.map.removeLayer(S.capaBase);
    S.capaBase = L.tileLayer(S.satelite ? TILE_SAT : TILE_CLARO, {
      maxNativeZoom: S.satelite ? 21 : 20, maxZoom: 21,
      attribution: S.satelite ? '&copy; Google' : '&copy; CARTO &copy; OSM'
    }).addTo(S.map);
    $('aia-btn-capas').textContent = S.satelite ? '🗺️' : '🛰️';
  }

  function setLote(lat, lng, texto){
    S.lote = { lat, lng };
    S.direccionAprox = texto || '';
    if (!S.marcadorLote) {
      S.marcadorLote = L.marker([lat, lng], { draggable: true }).addTo(S.map);
      S.marcadorLote.on('dragend', () => {
        const p = S.marcadorLote.getLatLng();
        setLote(p.lat, p.lng);
      });
    } else {
      S.marcadorLote.setLatLng([lat, lng]);
    }
    actualizarCirculo();
    S.map.panTo([lat, lng]);
    $('aia-lote-estado').innerHTML = '📍 Lote: <b>' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</b>' +
      (S.direccionAprox ? '<br><small>' + escHTML(S.direccionAprox) + '</small>' : '');
    $('aia-lote-estado').classList.add('ok');
    refrescarBotonAnalizar();
  }

  // ── El radio de importancia ─────────────────────────────────────────────
  //
  // Un círculo de 1 km sugiere que todo lo de adentro pesa igual, y no es
  // así: la panadería de la esquina interviene en el lote mucho más que un
  // supermercado a 900 m. En vez de un aro, se dibujan anillos que se van
  // desvaneciendo hacia afuera — la misma curva de decaimiento que usa el
  // análisis. Así, desde que se pone el punto, se ve de qué está hablando el
  // número antes de leer una sola cifra.
  const ANILLOS_CORTE = [200, 400, 700];
  function actualizarCirculo(){
    if (!S.lote) return;
    const centro = [S.lote.lat, S.lote.lng];
    if (!S.capaAnillos) S.capaAnillos = L.layerGroup().addTo(S.map);
    S.capaAnillos.clearLayers();
    // De fuera hacia adentro, para que el más cercano quede encima.
    ANILLOS_CORTE.concat([S.radioM]).filter(r => r <= S.radioM)
      .slice().reverse().forEach(function (r, i) {
        L.circle(centro, {
          radius: r, color: '#22d3ee', weight: 1, opacity: .35,
          // Cada anillo hacia adentro pinta un poco más: el acumulado hace
          // que el centro se vea claramente más "cargado" que el borde.
          fillColor: '#22d3ee', fillOpacity: .05 + i * .045, interactive: false
        }).addTo(S.capaAnillos);
      });
    if (!S.circuloRadio) {
      S.circuloRadio = L.circle(centro, {
        radius: S.radioM, color: '#22d3ee', weight: 2, fill: false
      }).addTo(S.map);
    } else {
      S.circuloRadio.setLatLng(centro);
      S.circuloRadio.setRadius(S.radioM);
    }
  }

  // ── Capa de estratificación ─────────────────────────────────────────────
  // El análisis decía "estrato predominante 3", que es un promedio y esconde
  // justo lo que importa: por dónde pasa el borde entre el 2 y el 4.
  async function alternarEstratos(){
    const btn = $('aia-btn-estratos');
    if (S.capaEstratos) {
      S.map.removeLayer(S.capaEstratos);
      S.capaEstratos = null;
      if (btn) btn.classList.remove('activo');
      const ley = $('aia-estrato-leyenda'); if (ley) ley.hidden = true;
      return;
    }
    if (!S.lote) return;
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    try {
      const d = await window.AIA_DATOS.manzanasEstrato(S.lote.lat, S.lote.lng, S.radioM);
      if (!d) { alert('El DANE no devolvió manzanas con estrato para este radio.'); return; }
      S.capaEstratos = L.layerGroup();
      d.manzanas.forEach(m => {
        L.polygon(m.anillos, { color: m.color, weight: .8, opacity: .9,
                               fillColor: m.color, fillOpacity: .45 })
          .bindPopup('<b>' + escHTML(m.etiqueta) + '</b>')
          .addTo(S.capaEstratos);
      });
      S.capaEstratos.addTo(S.map);
      // Debajo de los puntos: la capa es de fondo, no puede taparlos.
      try { S.capaEstratos.eachLayer(l => l.bringToBack && l.bringToBack()); } catch(e) {}
      if (btn) btn.classList.add('activo');
      pintarLeyendaEstratos(d);
    } catch(e) {
      alert('No se pudo cargar la estratificación: ' + (e && e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🎨 Estratos'; }
    }
  }

  function pintarLeyendaEstratos(d){
    const ley = $('aia-estrato-leyenda');
    if (!ley) return;
    const presentes = [];
    d.manzanas.forEach(m => { if (presentes.indexOf(m.estrato) === -1) presentes.push(m.estrato); });
    // "Sin estrato" va al final: es la excepción del mapa (industrial,
    // dotacional, lotes), no el escalón anterior al 1.
    presentes.sort((a, b) => (a === 0) - (b === 0) || a - b);
    ley.innerHTML = '<b>Estratificación DANE</b>' +
      presentes.map(n => '<span><i style="background:' + (d.colores[n] || d.colores[0]) + '"></i>' +
        (n ? n : 'S/E') + '</span>').join('') +
      '<em>S/E = sin estrato (industrial, dotacional o lotes)</em>';
    ley.hidden = false;
  }

  function pintarPOIs(pois){
    S.capaPOIs.clearLayers();
    (pois || []).forEach(p => {
      // El que se puso a mano se dibuja con aro blanco y más grande: hay que
      // poder distinguir de un vistazo lo observado de lo añadido.
      L.circleMarker([p.lat, p.lng], {
        radius: p.manual ? 8 : (p.grupo === 'otro' ? 7 : 5),
        color: p.manual ? '#ffffff' : '#0b1220', weight: p.manual ? 2.4 : 1.2,
        dashArray: p.manual ? '3 2' : null,
        fillColor: p.color, fillOpacity: p.grupo === 'otro' ? .95 : .85
      }).bindPopup('<b>' + p.icono + ' ' + escHTML(p.nombre) + '</b><br>' +
        escHTML(window.AIA_MOTOR.GRUPOS[p.grupo].t) + ' · ' + p.distM + ' m' +
        (p.manual ? '<br><em>Agregado por ti</em>' : ''))
        .addTo(S.capaPOIs);
    });
  }

  function escHTML(s){ return String(s == null ? '' : s).replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function etiquetaUso(u){ return u.icono + ' ' + escHTML(u.nombre) + (u.cantidad > 1 ? ' ×' + u.cantidad : ''); }

  // ── Bottom sheet ────────────────────────────────────────────────────────
  function esDesktop(){ return matchMedia('(min-width:1024px)').matches; }

  function setSheetState(estado){
    const sheet = $('aia-sheet');
    sheet.dataset.estado = estado;
    if (!esDesktop()) {
      const h = estado === 'peek' ? PEEK_PX : Math.round(innerHeight * (ALTURAS_SHEET[estado] || .58));
      sheet.style.height = h + 'px';
    } else {
      sheet.style.height = '';
    }
    $('aia-wizard').hidden = !(estado === 'wizard' || estado === 'peek');
    $('aia-cargando').hidden = estado !== 'analizando';
    $('aia-resultados').hidden = !(estado === 'resultados' || estado === 'full');
    setTimeout(() => { try { S.map.invalidateSize(); } catch(e) {} }, 320);
  }

  function initSheetDrag(){
    const handle = $('aia-sheet-handle');
    const sheet = $('aia-sheet');
    let arrastrando = false, inicioY = 0, alturaInicio = 0;

    handle.addEventListener('pointerdown', e => {
      if (esDesktop()) return;
      arrastrando = true; inicioY = e.clientY; alturaInicio = sheet.offsetHeight;
      sheet.classList.add('arrastrando');
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', e => {
      if (!arrastrando) return;
      const h = Math.max(PEEK_PX, Math.min(innerHeight * .94, alturaInicio + (inicioY - e.clientY)));
      sheet.style.height = h + 'px';
    });
    handle.addEventListener('pointerup', () => {
      if (!arrastrando) return;
      arrastrando = false;
      sheet.classList.remove('arrastrando');
      // Snap al estado más cercano según altura final.
      const h = sheet.offsetHeight, vh = innerHeight;
      const enResultados = !!S.resultado;
      let destino;
      if (h < vh * .22) destino = 'peek';
      else if (enResultados) destino = h > vh * .75 ? 'full' : 'resultados';
      else destino = 'wizard';
      setSheetState(destino);
    });
    handle.addEventListener('click', () => {
      if (sheet.dataset.estado === 'peek') setSheetState(S.resultado ? 'resultados' : 'wizard');
    });
  }

  // ── Wizard ──────────────────────────────────────────────────────────────
  function refrescarBotonAnalizar(){
    const proyectoListo = S.modo === 'mixto' ? S.usosMixto.length > 0 : !!S.proyectoId;
    const listo = !!(S.lote && S.tipoEstudio && proyectoListo);
    const btn = $('aia-btn-analizar');
    btn.disabled = !listo || S.analizando;
    // El radio va en el propio botón: así siempre se ve con qué distancia se
    // va a correr el análisis antes de tocarlo.
    btn.textContent = listo ? ('⚡ ANALIZAR ' + textoRadio() + ' A LA REDONDA') : '⚡ Elige lote, estudio y proyecto';
  }

  function textoRadio(){ return S.radioM >= 1000 ? (S.radioM / 1000) + ' km' : S.radioM + ' m'; }

  function initWizard(){
    // Paso 1 — búsqueda de dirección
    let timerBusqueda = null;
    $('aia-buscar-direccion').addEventListener('input', e => {
      const q = e.target.value.trim();
      clearTimeout(timerBusqueda);
      if (q.length < 3) { $('aia-sugerencias').hidden = true; return; }
      timerBusqueda = setTimeout(async () => {
        const res = await window.AIA_DATOS.buscarDireccion(q + ', Cúcuta');
        const ul = $('aia-sugerencias');
        ul.innerHTML = '';
        res.slice(0, 6).forEach(r => {
          const li = document.createElement('li');
          li.textContent = r.nombre;
          li.addEventListener('click', () => {
            setLote(r.lat, r.lng, r.nombre);
            ul.hidden = true;
            $('aia-buscar-direccion').value = r.nombre.split(',')[0];
          });
          ul.appendChild(li);
        });
        ul.hidden = res.length === 0;
      }, 350);
    });

    // Paso 1 — coordenadas / enlace Maps (alternar mini-formularios)
    $('aia-btn-coords').addEventListener('click', () => {
      $('aia-form-coords').hidden = !$('aia-form-coords').hidden;
      $('aia-form-gmaps').hidden = true;
    });
    $('aia-btn-gmaps').addEventListener('click', () => {
      $('aia-form-gmaps').hidden = !$('aia-form-gmaps').hidden;
      $('aia-form-coords').hidden = true;
    });
    $('aia-coords-ok').addEventListener('click', () => {
      const lat = parseFloat($('aia-lat').value), lng = parseFloat($('aia-lng').value);
      if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        alert('Coordenadas inválidas. Ejemplo: 7.8891 y -72.4967'); return;
      }
      setLote(lat, lng);
      $('aia-form-coords').hidden = true;
    });
    $('aia-gmaps-ok').addEventListener('click', () => {
      const p = window.AIA_DATOS.parsearEnlaceMaps($('aia-gmaps-url').value);
      if (!p) { alert('No pude leer coordenadas de ese enlace. Usa un enlace de Google Maps con la ubicación fijada (debe contener @lat,lng).'); return; }
      setLote(p.lat, p.lng);
      $('aia-form-gmaps').hidden = true;
    });

    // Paso 2 — radio
    const slider = $('aia-radio-slider');
    const pintarRadio = () => {
      $('aia-radio-valor').textContent = textoRadio();
      document.querySelectorAll('#aia-radio-presets button').forEach(b => {
        b.classList.toggle('activo', Number(b.dataset.radio) === S.radioM);
      });
      actualizarCirculo();
      refrescarBotonAnalizar();
    };
    slider.addEventListener('input', () => { S.radioM = Number(slider.value); pintarRadio(); });
    document.querySelectorAll('#aia-radio-presets button').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.radio === 'custom') { slider.focus(); return; }
        S.radioM = Number(b.dataset.radio);
        slider.value = S.radioM;
        pintarRadio();
      });
    });
    pintarRadio();

    // Paso 3 — tipo de estudio
    document.querySelectorAll('#aia-paso-estudio .aia-chip').forEach(b => {
      b.addEventListener('click', () => {
        S.tipoEstudio = b.dataset.estudio;
        document.querySelectorAll('#aia-paso-estudio .aia-chip').forEach(x => x.classList.toggle('activo', x === b));
        refrescarBotonAnalizar();
      });
    });

    // Paso 4 — proyecto (modo simple: un solo uso del grid de siempre)
    document.querySelectorAll('#aia-paso-proyecto .aia-proy').forEach(b => {
      b.addEventListener('click', () => {
        S.modo = 'simple';
        S.proyectoId = b.dataset.proyecto;
        document.querySelectorAll('#aia-paso-proyecto .aia-proy').forEach(x => x.classList.toggle('activo', x === b));
        $('aia-resumen-mixto').hidden = true;
        $('aia-proyectos-grid').hidden = false;
        refrescarBotonAnalizar();
      });
    });

    $('aia-btn-analizar').addEventListener('click', ejecutarAnalisis);
    $('aia-btn-reanalizar').addEventListener('click', ejecutarAnalisis);
    // Re-analizar reusa lo que se descargó hoy; esto en cambio tira esa copia
    // y vuelve a preguntar. Es la salida para el caso "abrieron un local nuevo
    // (o alguien acaba de mapearlo) y el análisis sigue sin verlo".
    // `forzarDatos` basta: la consulta forzada reescribe la entrada guardada
    // de este lote. No se borra la caché entera para no castigar a los demás
    // análisis del día, que siguen siendo válidos.
    const btnRefrescar = $('aia-btn-refrescar');
    if (btnRefrescar) btnRefrescar.addEventListener('click', () => {
      S.forzarDatos = true;
      ejecutarAnalisis();
    });
    $('aia-btn-nuevo').addEventListener('click', () => {
      S.resultado = null;
      S.capaPOIs.clearLayers();
      // El nombre es del proyecto anterior: si no se limpia, el siguiente
      // análisis (de otro lote) hereda por accidente el nombre equivocado.
      const nombreInput = $('aia-nombre-proyecto');
      if (nombreInput) nombreInput.value = '';
      setSheetState('wizard');
    });
    const btnAgregar = $('aia-btn-agregar-uso');
    if (btnAgregar) btnAgregar.addEventListener('click', () => {
      const p = $('aia-agregar-uso');
      if (p && p.hidden) abrirAgregarUso(); else cerrarAgregarUso();
    });
    const btnTocar = $('aia-uso-tocar');
    if (btnTocar) btnTocar.addEventListener('click', () => {
      S.ubicandoUso = !S.ubicandoUso;
      btnTocar.classList.toggle('activo', S.ubicandoUso);
      btnTocar.textContent = S.ubicandoUso ? '👆 Toca el sitio en el mapa' : '📍 Tocar en el mapa';
    });
    const selUso = $('aia-uso-sub');
    if (selUso) selUso.addEventListener('change', refrescarBotonUso);
    const btnGuardarUso = $('aia-uso-guardar');
    if (btnGuardarUso) btnGuardarUso.addEventListener('click', () => {
      const sub = $('aia-uso-sub').value;
      if (!sub || !usoPendiente) return;
      const datos = Object.assign(
        { lat: usoPendiente.lat, lng: usoPendiente.lng, sub: sub,
          nombre: ($('aia-uso-nombre').value || '').trim() },
        leerFichaFormulario());
      // El mismo botón guarda uno nuevo o corrige el que se estaba editando:
      // dos botones distintos para la misma acción confunden más de lo que
      // aclaran, y el título del panel ya dice en cuál de las dos se está.
      if (editandoId) editarUsoManual(editandoId, datos);
      else agregarUsoManual(datos);
      cerrarAgregarUso();
      ejecutarAnalisis();
    });
    const btnCancelarUso = $('aia-uso-cancelar');
    if (btnCancelarUso) btnCancelarUso.addEventListener('click', cerrarAgregarUso);
    const btnVolver = $('aia-uso-volver');
    if (btnVolver) btnVolver.addEventListener('click', cerrarAgregarUso);
    const panelUsos = $('aia-agregar-uso');
    if (panelUsos) panelUsos.querySelectorAll('[data-uso-tab]').forEach(b => {
      b.addEventListener('click', () => {
        // Cambiar de pestaña cancela una edición a medias: quedarse con el
        // formulario cargado invitaría a guardar cambios sobre un uso que ya
        // no se está viendo.
        if (b.dataset.usoTab === 'mios' && editandoId) cancelarEdicion();
        verPestanaUso(b.dataset.usoTab);
      });
    });

    $('aia-btn-informe').addEventListener('click', abrirExportar);
    $('aia-btn-capas').addEventListener('click', alternarBase);
    const btnEstr = $('aia-btn-estratos');
    if (btnEstr) btnEstr.addEventListener('click', alternarEstratos);
    $('aia-btn-guardar').addEventListener('click', guardarAnalisisActual);

    // Tabs "Nuevo análisis" / "Mis análisis"
    document.querySelectorAll('.aia-tab').forEach(b => {
      b.addEventListener('click', () => setTab(b.dataset.tab));
    });

    initConstructor();
    initExportar();
    $('aia-btn-comparar').addEventListener('click', renderComparacion);
  }

  // ── Constructor de proyecto (modo mixto) ─────────────────────────────────
  function initConstructor(){
    const grid = $('aia-constructor-usos');
    grid.innerHTML = window.AIA_MOTOR.USOS_PROGRAMA.map(u =>
      '<button type="button" class="aia-chip aia-chip-uso" data-uso="' + u.id + '">' + u.icono + ' ' + escHTML(u.nombre) + '</button>'
    ).join('');

    let seleccion = [];   // usos del catálogo elegidos (objetos completos)
    let personalizados = []; // usos custom agregados en esta sesión del Constructor

    function refrescarConstructor(){
      document.querySelectorAll('#aia-constructor-usos .aia-chip-uso').forEach(b => {
        b.classList.toggle('activo', seleccion.some(u => u.id === b.dataset.uso));
      });
      $('aia-constructor-usos-custom').innerHTML = personalizados.map(u =>
        '<span class="aia-chip aia-chip-custom activo">' + u.icono + ' ' + escHTML(u.nombre) +
        '<button type="button" class="aia-chip-x" data-quitar-custom="' + u.id + '">×</button></span>'
      ).join('');
      document.querySelectorAll('[data-quitar-custom]').forEach(b => {
        b.addEventListener('click', () => {
          personalizados = personalizados.filter(u => u.id !== b.dataset.quitarCustom);
          refrescarConstructor();
        });
      });
      const total = seleccion.length + personalizados.length;
      const btnAplicar = $('aia-constructor-aplicar');
      btnAplicar.disabled = total === 0;
      btnAplicar.textContent = 'Aplicar (' + total + ' uso' + (total === 1 ? '' : 's') + ' seleccionado' + (total === 1 ? '' : 's') + ')';
    }

    $('aia-btn-abrir-constructor').addEventListener('click', () => {
      // Precarga con lo que ya estaba elegido, para poder editar sin perder nada.
      seleccion = window.AIA_MOTOR.USOS_PROGRAMA.filter(u => S.usosMixto.some(x => x.id === u.id));
      personalizados = S.usosMixto.filter(u => u.esCustom);
      refrescarConstructor();
      $('aia-constructor').hidden = false;
    });
    $('aia-btn-editar-mixto').addEventListener('click', () => $('aia-btn-abrir-constructor').click());
    $('aia-constructor-cerrar').addEventListener('click', () => { $('aia-constructor').hidden = true; });

    grid.addEventListener('click', e => {
      const b = e.target.closest('.aia-chip-uso');
      if (!b) return;
      const id = b.dataset.uso;
      const enSeleccion = seleccion.some(u => u.id === id);
      if (enSeleccion) {
        seleccion = seleccion.filter(u => u.id !== id);
      } else {
        const usoBase = window.AIA_MOTOR.USOS_PROGRAMA.find(u => u.id === id);
        let usoFinal = usoBase;
        // Los usos "por definir" piden cantidad para recomendar un negocio por
        // unidad; los contables (vivienda, parqueadero, cajero…) la piden
        // porque la oferta propia entra en la autocompetencia del score.
        if (usoBase.generico || usoBase.contable) {
          const unidad = usoBase.unidad || 'unidades';
          const pregunta = usoBase.generico
            ? '¿Cuántas unidades de "' + usoBase.nombre + '" tendrá el proyecto? URBIS te recomendará el mejor negocio para cada una.'
            : '¿Cuántos/as ' + unidad + ' tendrá el proyecto? Déjalo en 1 si no lo sabes todavía.';
          const cant = parseInt(prompt(pregunta, '1'), 10);
          usoFinal = Object.assign({}, usoBase, { cantidad: (cant > 0 ? cant : 1) });
        }
        seleccion = seleccion.concat(usoFinal);
      }
      refrescarConstructor();
    });

    $('aia-btn-agregar-personalizado').addEventListener('click', () => {
      const input = $('aia-uso-personalizado-input');
      const texto = input.value.trim();
      if (!texto) return;
      const usos = window.AIA_MOTOR.normalizarUsos([texto]);
      if (!personalizados.some(u => u.id === usos[0].id)) personalizados = personalizados.concat(usos[0]);
      input.value = '';
      refrescarConstructor();
    });

    $('aia-constructor-aplicar').addEventListener('click', () => {
      S.modo = 'mixto';
      S.usosMixto = seleccion.concat(personalizados);
      S.config = leerConfigConstructor();
      $('aia-constructor').hidden = true;
      $('aia-proyectos-grid').hidden = true;
      document.querySelectorAll('#aia-paso-proyecto .aia-proy').forEach(x => x.classList.remove('activo'));
      $('aia-resumen-mixto').hidden = false;
      $('aia-resumen-chips').innerHTML = S.usosMixto.map(u => etiquetaUso(u)).join(' + ');
      refrescarBotonAnalizar();
      // Si ya hay un análisis en pantalla, recalcula al instante (sin red).
      if (S.resultado && S.ultimosElementos) recalcularMixto();
    });
  }

  function leerConfigConstructor(){
    const campos = ['pisos','areaConstruidaM2','apartamentos','oficinas','localesComerciales',
      'habitacionesHotel','consultorios','parqueaderos','areaComercialM2','areaResidencialM2',
      'areaHotelM2','areaInstitucionalM2'];
    const cfg = {};
    campos.forEach(c => { const v = Number($('cfg-' + c).value); if (v) cfg[c] = v; });
    return cfg;
  }

  // Recalcula el análisis mixto con los datos YA descargados (sin red) —
  // se usa al agregar/quitar un uso desde los chips de resultados.
  function recalcularMixto(){
    if (!S.ultimosElementos || !S.lote) return;
    const resultado = window.AIA_MOTOR.analizarMixto({
      elementos: S.ultimosElementos, radioM: S.radioM, centro: S.lote,
      tipoEstudio: S.tipoEstudio, direccionAprox: S.direccionAprox,
      usos: S.usosMixto, config: S.config
    });
    // La ficha de los usos levantados en campo va al resultado con la misma
    // forma que en el modo educativo, para que el informe la lea igual venga
    // de un curso o de un analista parado frente al inmueble.
    const edif = edificacionDeManuales(S.lote, S.radioM);
    if (edif) resultado.campo = { edificacion: edif };
    S.resultado = resultado;
    pintarPOIs(resultado.pois);
    renderResultados(resultado);
  }

  function quitarUsoMixto(id){
    S.usosMixto = S.usosMixto.filter(u => u.id !== id);
    if (!S.usosMixto.length) { alert('El proyecto necesita al menos un uso. Agrega otro antes de quitar este.'); S.usosMixto.push(window.AIA_MOTOR.USOS_PROGRAMA[0]); }
    $('aia-resumen-chips').innerHTML = S.usosMixto.map(u => etiquetaUso(u)).join(' + ');
    recalcularMixto();
  }

  // ── Tabs "Nuevo análisis" / "Mis análisis" ──────────────────────────────
  function setTab(tab){
    S.tabActiva = tab;
    document.querySelectorAll('.aia-tab').forEach(b => b.classList.toggle('activo', b.dataset.tab === tab));
    $('aia-tab-nuevo').hidden = tab !== 'nuevo';
    $('aia-tab-guardados').hidden = tab !== 'guardados';
    if (tab === 'guardados') {
      renderGuardados();
      setSheetState('full');
    } else {
      setSheetState(S.resultado ? 'resultados' : 'wizard');
    }
  }

  // ── Análisis ────────────────────────────────────────────────────────────
  const FRASES_CARGA = [
    'Consultando el entorno urbano…', 'Leyendo datos abiertos de OpenStreetMap…',
    'Clasificando usos con la Matriz URBIS…', 'Calculando densidades y demanda…',
    'Evaluando competencia y complementarios…', 'Redactando el análisis…'
  ];

  async function ejecutarAnalisis(){
    if (!S.lote || S.analizando) return;
    S.analizando = true;
    refrescarBotonAnalizar();
    setSheetState('analizando');
    let iFrase = 0;
    $('aia-cargando-msg').textContent = FRASES_CARGA[0];
    const timerFrases = setInterval(() => {
      iFrase = (iFrase + 1) % FRASES_CARGA.length;
      $('aia-cargando-msg').textContent = FRASES_CARGA[iFrase];
    }, 1600);

    try {
      // `S.forzarDatos` lo enciende el botón de recargar: salta la caché de 24 h
      // y vuelve a pedir el entorno. Sin esto, un local abierto o mapeado hoy
      // no aparecía hasta el día siguiente y parecía un fallo del análisis.
      const descargados = await window.AIA_DATOS.consultarEntorno(
        S.lote.lat, S.lote.lng, S.radioM, S.forzarDatos);
      S.forzarDatos = false;
      // Los usos que el usuario señaló a mano entran aquí, con la misma forma
      // que los descargados: de ahí en adelante el motor los trata igual.
      const elementos = descargados.concat(elementosManuales(S.lote, S.radioM));
      S.ultimosElementos = elementos;
      // Ciudad/departamento/país para titular el informe. No bloquea el
      // análisis: si falla, el informe simplemente omite esa línea.
      try { S.ubicacion = await window.AIA_DATOS.ubicacionDe(S.lote.lat, S.lote.lng); } catch(e) { S.ubicacion = null; }
      // Censo DANE 2018: población y estrato reales. Se consulta el radio
      // analizado y también los de la comparativa, porque si un anillo cayera
      // a la estimación heurística la tabla contradiría los KPI del encabezado.
      // Si el servicio no responde, `dane` queda null y el motor usa su
      // estimación de siempre: el análisis nunca se bloquea por esto.
      const radiosDane = window.AIA_MOTOR.RADIOS_COMPARATIVA
        .filter(r => r < S.radioM).concat([S.radioM])
        .filter((r, i, a) => a.indexOf(r) === i);
      const danePorRadio = {};
      try {
        // El municipio decide qué tasa de crecimiento del DANE se aplica para
        // traer el censo de 2018 hasta hoy. Va después de `ubicacionDe`, que
        // ya se resolvió arriba; si falló, la proyección simplemente no se
        // aplica y el análisis trabaja con el censo tal cual.
        const municipio = (S.ubicacion && S.ubicacion.ciudad) || '';
        const res = await Promise.all(radiosDane.map(r =>
          window.AIA_DATOS.consultarDANE(S.lote.lat, S.lote.lng, r, municipio).catch(() => null)));
        radiosDane.forEach((r, i) => { if (res[i]) danePorRadio[r] = res[i]; });
      } catch(e) { /* sin censo: sigue con la heurística */ }
      S.dane = danePorRadio[S.radioM] || null;

      const comun = { elementos, radioM: S.radioM, centro: S.lote,
                      tipoEstudio: S.tipoEstudio, direccionAprox: S.direccionAprox,
                      dane: S.dane, danePorRadio };
      const resultado = S.modo === 'mixto'
        ? window.AIA_MOTOR.analizarMixto(Object.assign({}, comun,
            { usos: S.usosMixto, config: S.config }))
        : await window.AIA_MOTOR.analizar(Object.assign({}, comun,
            { proyectoId: S.proyectoId }));
      // Nombre propio del proyecto (paso 5, opcional): si el usuario escribió
      // uno, reemplaza el nombre que el motor arma solo a partir del programa
      // ("Comercial (por definir) + Oficina...") — así el análisis se
      // reconoce por el proyecto real ("Libertadores Plaza") y no por su
      // combinación de usos, tanto al guardarlo como en el título del PDF.
      const nombreInput = $('aia-nombre-proyecto');
      const nombrePropio = (nombreInput && nombreInput.value || '').trim();
      if (nombrePropio) resultado.meta.proyectoNombre = nombrePropio;
      // La ficha de los usos levantados en campo, igual que arriba.
      const edifRe = edificacionDeManuales(S.lote, S.radioM);
      if (edifRe) resultado.campo = { edificacion: edifRe };
      S.resultado = resultado;
      pintarPOIs(resultado.pois);
      renderResultados(resultado);
      setSheetState('resultados');
    } catch(err) {
      alert('No se pudo completar el análisis: ' + (err && err.message || err));
      setSheetState('wizard');
    } finally {
      clearInterval(timerFrases);
      S.analizando = false;
      refrescarBotonAnalizar();
    }
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  // ── Aviso de "uso sin definir" (grupo 'otro') ────────────────────────────
  // Pedido explícito: asignar cada punto sin clasificar a una categoría REAL
  // de la Matriz de Usos (no solo un rótulo de pantalla) — la regla queda en
  // localStorage (AIA_MOTOR.guardarReglaPersonalizada) y desde ese momento
  // se reconoce en CUALQUIER análisis futuro, sin tocar código ni desplegar.
  const GRUPOS_MATRIZ_OPCIONES = [
    ['vivienda','🏠 Vivienda y ocio'], ['comercio','🏬 Comercio y economía'],
    ['institucional','🏛️ Institucional y gobierno'], ['industria','🏭 Industria y logística'],
    ['salud','🚑 Salud y emergencias'], ['cultura','🎭 Cultura, educación y culto'],
    ['servicios','🚛 Servicios e infraestructura'], ['ambiente','🌳 Ambiente y zona rural'],
    ['riesgo','⚠️ Riesgo / suelo sin definir'], ['mixtos','🧩 Usos combinados']
  ];

  function nombrarUsosSinDefinir(r){
    const nombresUnicos = [...new Set((r.pois || [])
      .filter(p => p.grupo === 'otro' && p.nombre && p.nombre !== 'Otro (uso por definir)')
      .map(p => p.nombre))];
    if (!nombresUnicos.length) {
      alert('Los puntos sin clasificar de este radio no tienen nombre propio en OpenStreetMap, así que no se pueden identificar por nombre para guardarlos.');
      return;
    }
    const listaOpciones = GRUPOS_MATRIZ_OPCIONES.map((o, i) => (i + 1) + '. ' + o[1]).join('\n');
    let asignados = 0;
    nombresUnicos.forEach(nombre => {
      const resp = prompt('¿A qué categoría de la Matriz de Usos pertenece "' + nombre + '"?\nEscribe el número:\n\n' + listaOpciones, '');
      if (resp == null) return;
      const idx = parseInt(resp, 10) - 1;
      const opcion = GRUPOS_MATRIZ_OPCIONES[idx];
      if (!opcion) return;
      window.AIA_MOTOR.guardarReglaPersonalizada(nombre, opcion[0]);
      asignados++;
    });
    if (asignados > 0) {
      alert('✅ ' + asignados + ' uso(s) guardado(s) en la Matriz de Usos de tu celular. Se reconocerán automáticamente en todos tus análisis futuros.');
      ejecutarAnalisis(); // recalcula con la clasificación nueva (usa caché, sin red)
    }
  }

  // Respaldo cuando el portapapeles no está disponible (o lo bloquea el
  // navegador): se muestra el texto para seleccionarlo a mano.
  function mostrarPendientes(txt){
    const pre = $('aia-pend-lista');
    if (!pre) return;
    pre.textContent = txt;
    pre.hidden = !pre.hidden;
    if (!pre.hidden) pre.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function renderResultados(r){
    const s = r.stats;
    const G = window.AIA_MOTOR.GRUPOS, C = window.AIA_MOTOR.GRUPO_COLOR;
    const esMixto = r.modo === 'mixto';
    const nOtro = s.porGrupo.otro || 0;
    // El motor ya archivó solo los usos sin categoría de ESTE análisis; aquí
    // se muestra tanto lo de este radio como el acumulado de todos los
    // análisis, que es lo que se revisa para decidir categorías nuevas.
    const band = window.AIA_MOTOR.resumenPendientes();
    // Cuántos de los puntos los puso el usuario. Declararlo no es un detalle:
    // un informe que no distinga lo observado de lo añadido por el propio
    // interesado no se puede auditar, y ante un cliente esa diferencia pesa.
    const nMan = s.manuales || 0;
    $('aia-aviso-otro').hidden = nOtro === 0 && band.patrones === 0 && nMan === 0;
    if (!$('aia-aviso-otro').hidden) {
      $('aia-aviso-otro').innerHTML =
        (nMan > 0
          ? '<p class="aia-aviso-manual">✍️ ' +
            (nMan === 1 ? 'Un uso de este análisis lo agregaste tú'
                        : nMan + ' usos de este análisis los agregaste tú') +
            ' y no viene' + (nMan === 1 ? '' : 'n') + ' del mapa abierto. ' +
            'Cuenta' + (nMan === 1 ? '' : 'n') + ' igual que los demás y sale' +
            (nMan === 1 ? '' : 'n') + ' con aro blanco en el mapa.</p>'
          : '') +
        (nOtro > 0
          ? '<p>❓ Se ' + (nOtro === 1 ? 'encontró 1 uso' : 'encontraron ' + nOtro + ' usos') +
            ' sin clasificar en este radio (aparecen en fucsia en el mapa). ' +
            '<button type="button" id="aia-btn-nombrar-otro">🏷️ Agregar a la Matriz de Usos</button></p>'
          : '') +
        (band.patrones > 0
          ? '<div class="aia-bandeja">' +
            '<b>🗂️ Bandeja de usos sin categoría</b>' +
            '<small>URBIS lleva guardados <b>' + band.patrones + '</b> ' +
              (band.patrones === 1 ? 'patrón distinto' : 'patrones distintos') +
              ' (' + band.apariciones + ' apariciones) de todos tus análisis. ' +
              'Cópialos y pégalos en el chat para decidir a qué categoría va cada uno — ' +
              'y si alguno no encaja en ninguna, creamos una categoría nueva.</small>' +
            '<div class="aia-bandeja-btns">' +
              '<button type="button" id="aia-btn-copiar-pend">📋 Copiar para revisar</button>' +
              '<button type="button" id="aia-btn-ver-pend">👁️ Ver lista</button>' +
              '<button type="button" id="aia-btn-limpiar-pend" class="aia-bandeja-borrar">🗑️</button>' +
            '</div><pre id="aia-pend-lista" hidden></pre></div>'
          : '');
      if (nOtro > 0) $('aia-btn-nombrar-otro').addEventListener('click', () => nombrarUsosSinDefinir(r));
      if (band.patrones > 0) {
        $('aia-btn-copiar-pend').addEventListener('click', () => {
          const txt = window.AIA_MOTOR.exportarPendientes();
          const ok = () => alert('✅ Copiado. Pégalo en el chat con Claude para clasificar estos usos.');
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(ok, () => mostrarPendientes(txt));
          } else mostrarPendientes(txt);
        });
        $('aia-btn-ver-pend').addEventListener('click',
          () => mostrarPendientes(window.AIA_MOTOR.exportarPendientes()));
        $('aia-btn-limpiar-pend').addEventListener('click', () => {
          if (!confirm('¿Vaciar la bandeja de usos sin categoría?\n\nSe perderá el acumulado de todos los análisis.')) return;
          window.AIA_MOTOR.olvidarPendientes();
          renderResultados(r);
        });
      }
    }

    $('aia-res-titulo').innerHTML = '<b>' + escHTML(r.meta.proyectoNombre) + '</b> · ' + r.meta.radioM + ' m' +
      (r.meta.direccionAprox ? '<br><small>' + escHTML(r.meta.direccionAprox) + '</small>' : '');

    $('aia-kpis').innerHTML =
      kpi(s.poblacionEstimada.toLocaleString('es-CO'),
          s.poblacionProyectada
            ? 'Habitantes (' + s.anioProyeccion + ', proyectado)'
            : (s.poblacionEsCensal ? 'Habitantes (DANE ' + s.censoAnio + ')' : 'Población estimada')) +
      (s.estrato ? kpi('E' + s.estrato.predominante,
          s.estrato.minimo === s.estrato.maximo ? 'Estrato' : 'Estrato (' + s.estrato.minimo + '–' + s.estrato.maximo + ')',
          '#FABD0A') : '') +
      (s.personasPorVivienda ? kpi(s.personasPorVivienda, 'Personas por vivienda') : '') +
      kpi(s.total, 'Usos identificados') +
      kpi(s.densidadPorHa, 'Usos por hectárea') +
      kpi(s.movilidad.nViasArterias, 'Vías arterias') +
      kpi(s.movilidad.paradasBus, 'Paradas transporte') +
      ((s.porGrupo.otro || 0) > 0 ? kpi(s.porGrupo.otro, 'Usos por definir', '#FF00AA') : '');

    // Viabilidad o ranking
    if (r.viabilidad) {
      const v = r.viabilidad;
      const color = v.nivel === 'Alta' ? '#4ade80' : (v.nivel === 'Media' ? '#f5b942' : '#f87171');
      $('aia-viabilidad').hidden = false;
      $('aia-ranking').hidden = true;
      $('aia-viabilidad').innerHTML =
        '<div class="aia-score-wrap">' +
        '<div class="aia-gauge" style="--pct:' + v.score + ';--col:' + color + '"><span>' + v.score + '</span><small>/100</small></div>' +
        '<div class="aia-score-info"><span class="aia-nivel" style="background:' + color + '">Viabilidad ' + v.nivel + (esMixto ? ' del conjunto' : '') + '</span>' +
        '<ul>' + v.argumentos.map(a => '<li>' + escHTML(a) + '</li>').join('') + '</ul></div></div>' +
        (v.subscores ? '<div class="aia-subscores">' + Object.entries(v.subscores).map(([k, val]) =>
          '<div class="aia-subscore"><label>' + etiquetaSub(k) + '</label>' +
          '<div class="aia-barra"><i style="width:' + val + '%;background:' + color + '"></i></div><b>' + val + '</b></div>'
        ).join('') + '</div>' : '') +
        bloqueCompetencia(v);
    } else if (r.ranking) {
      $('aia-viabilidad').hidden = true;
      $('aia-ranking').hidden = false;
      $('aia-ranking').innerHTML = '<h3>🏆 Usos recomendados para este lote</h3>' +
        r.ranking.map((it, i) => {
          const color = it.nivel === 'Alta' ? '#4ade80' : (it.nivel === 'Media' ? '#f5b942' : '#f87171');
          return '<div class="aia-rank-item"><span class="aia-rank-pos">' + (i + 1) + '</span>' +
            '<div class="aia-rank-info"><b>' + it.icono + ' ' + escHTML(it.nombre) + '</b><small>' + escHTML(it.razon) + '</small></div>' +
            '<span class="aia-rank-score" style="color:' + color + '">' + it.score + '</span></div>';
        }).join('');
    }

    // Modo mixto: chips editables, desglose por uso, compatibilidad, recomendaciones.
    $('aia-usos-chips').hidden = !esMixto;
    $('aia-desglose-usos').hidden = !esMixto;
    $('aia-compatibilidad').hidden = !esMixto;
    $('aia-recomendaciones').hidden = !esMixto || !r.recomendaciones.length;
    if (esMixto) {
      $('aia-usos-chips').innerHTML = '<h3>🧩 Programa del proyecto</h3><div class="aia-chips">' +
        r.usos.map(u => '<span class="aia-chip activo">' + etiquetaUso(u) +
          (r.usos.length > 1 ? '<button type="button" class="aia-chip-x" data-quitar-uso="' + u.id + '">×</button>' : '') +
          '</span>').join('') +
        '<button type="button" class="aia-chip aia-chip-agregar" id="aia-btn-agregar-uso-resultado">➕</button></div>';
      document.querySelectorAll('[data-quitar-uso]').forEach(b => {
        b.addEventListener('click', () => quitarUsoMixto(b.dataset.quitarUso));
      });
      const btnAgregar = document.getElementById('aia-btn-agregar-uso-resultado');
      if (btnAgregar) btnAgregar.addEventListener('click', () => $('aia-btn-abrir-constructor').click());

      $('aia-desglose-usos').innerHTML = '<h3>📊 Desglose por uso</h3>' + r.desglosePorUso.map(d => {
        const color = d.nivel === 'Alta' ? '#4ade80' : (d.nivel === 'Media' ? '#f5b942' : '#f87171');
        return '<div class="aia-desglose-item"><span>' + d.icono + ' ' + escHTML(d.nombre) + '</span>' +
          '<div class="aia-barra"><i style="width:' + d.score + '%;background:' + color + '"></i></div>' +
          '<b style="color:' + color + '">' + d.score + '</b></div>';
      }).join('');

      $('aia-compatibilidad').innerHTML = '<h3>🤝 Compatibilidad del Proyecto</h3>' +
        (r.compatibilidad.length ? r.compatibilidad.map(c =>
          '<div class="aia-compat-item"><div class="aia-compat-par">' + c.iconoA + ' ' + escHTML(c.usoA) + ' + ' + c.iconoB + ' ' + escHTML(c.usoB) + '</div>' +
          '<div class="aia-compat-estrellas">' + '★'.repeat(c.estrellas) + '☆'.repeat(5 - c.estrellas) + '</div>' +
          '<p>' + escHTML(c.motivo) + '</p></div>'
        ).join('') : '<p class="aia-foda-vacio">Agrega un segundo uso para ver compatibilidad.</p>');

      if (r.recomendaciones.length) {
        $('aia-recomendaciones').innerHTML = '<h3>💡 Recomendaciones inteligentes</h3><ul>' +
          r.recomendaciones.map(t => '<li>' + escHTML(t) + '</li>').join('') + '</ul>';
      }

      const ru = r.recomendacionesUnidades || [];
      $('aia-recomend-unidades').hidden = ru.length === 0;
      if (ru.length) {
        $('aia-recomend-unidades').innerHTML = ru.map(g =>
          '<h3>' + g.icono + ' ¿Qué poner en tus ' + g.cantidad + ' unidad' + (g.cantidad === 1 ? '' : 'es') + ' de "' + escHTML(g.usoNombre) + '"?</h3>' +
          '<div class="aia-unidad-opciones">' + g.opciones.map(o => {
            const color = o.nivel === 'Alta' ? '#4ade80' : (o.nivel === 'Media' ? '#f5b942' : '#f87171');
            return '<div class="aia-unidad-op"><span class="aia-unidad-cant">' + o.unidadesSugeridas + '×</span>' +
              '<span class="aia-unidad-nombre">' + o.icono + ' ' + escHTML(o.nombre) + '</span>' +
              '<span class="aia-unidad-score" style="color:' + color + '">' + o.score + '</span></div>';
          }).join('') + '</div>'
        ).join('');
      }
    }

    // FODA
    const f = r.foda;
    const cajaFoda = (titulo, icono, items, clase) =>
      '<div class="aia-foda-card ' + clase + '"><h4>' + icono + ' ' + titulo + '</h4><ul>' +
      (items.length ? items.map(t => '<li>' + escHTML(t) + '</li>').join('') : '<li class="aia-foda-vacio">Sin hallazgos relevantes.</li>') +
      '</ul></div>';
    $('aia-foda').innerHTML =
      cajaFoda('Fortalezas', '💪', f.fortalezas, 'f') +
      cajaFoda('Debilidades', '⚠️', f.debilidades, 'd') +
      cajaFoda('Oportunidades', '🚀', f.oportunidades, 'o') +
      cajaFoda('Riesgos', '🛑', f.riesgos, 'r');

    renderFlujo(r);
    renderIndicadores(r);
    renderCharts(r);

    // Tarjetas por grupo
    $('aia-tarjetas-categorias').innerHTML = Object.keys(G).filter(g => (s.porGrupo[g] || 0) > 0)
      .sort((a, b) => (s.porGrupo[b] || 0) - (s.porGrupo[a] || 0))
      .map(g => '<div class="aia-cat-card" style="--col:' + C[g] + '">' +
        '<div class="aia-cat-head"><span>' + G[g].i + ' ' + escHTML(G[g].t) + '</span><b>' + s.porGrupo[g] + '</b></div>' +
        '<ul>' + (s.topPorGrupo[g] || []).map(p => '<li>' + p.icono + ' ' + escHTML(p.nombre) + ' <small>' + p.distM + ' m</small></li>').join('') + '</ul></div>')
      .join('');

    renderTablaPuntos(r);

    $('aia-conclusion').innerHTML = '<h3>📋 Conclusión técnica</h3><p>' + escHTML(r.conclusion) + '</p>';
  }

  // ── Flujo peatonal y vehicular ───────────────────────────────────────────
  // El informe en PDF ya traía este bloque, pero quien decide dónde poner una
  // cafetería lo hace mirando la pantalla, no exportando un PDF. Va en la app
  // con la misma lectura para que no haya que interpretar dos cosas distintas.
  // ── Mapa de calor: la malla del motor pintada como imagen ──────────────
  // Se dibuja en un lienzo del tamaño REAL del dato (26×26) y se reescala con
  // suavizado. Pintar 676 divs por capa recargaría el móvil sin añadir ni un
  // dato: la malla no tiene más resolución de la que tiene.
  const RAMPAS_CALOR = {
    peaton:  [[0,[ 32,140, 90, 0]], [.25,[120,190, 60,110]], [.5,[245,205, 60,170]],
              [.75,[240,140, 40,205]], [1,[214, 40, 40,230]]],
    vehiculo:[[0,[ 30, 90,170, 0]], [.25,[ 70,130,220,110]], [.5,[110,110,225,170]],
              [.75,[150, 70,205,205]], [1,[120, 20,150,230]]]
  };
  function pngCalorApp(capa, n, tipo){
    try {
      const ramp = RAMPAS_CALOR[tipo] || RAMPAS_CALOR.peaton;
      const mezcla = t => {
        for (let i = 1; i < ramp.length; i++) {
          if (t <= ramp[i][0]) {
            const a = ramp[i-1], b = ramp[i], k = (t - a[0]) / (b[0] - a[0] || 1);
            return [0,1,2,3].map(c => Math.round(a[1][c] + (b[1][c] - a[1][c]) * k));
          }
        }
        return ramp[ramp.length-1][1];
      };
      const c = document.createElement('canvas'); c.width = c.height = n;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(n, n);
      for (let k = 0; k < n * n; k++) {
        const v = capa[k], px = k * 4;
        if (v == null || v < 0) { img.data[px + 3] = 0; continue; }
        const col = mezcla(Math.max(0, Math.min(1, v / 100)));
        img.data[px] = col[0]; img.data[px+1] = col[1]; img.data[px+2] = col[2]; img.data[px+3] = col[3];
      }
      ctx.putImageData(img, 0, 0);
      const g = document.createElement('canvas'); g.width = g.height = 240;
      const gx = g.getContext('2d');
      gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high';
      gx.drawImage(c, 0, 0, 240, 240);
      return g.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  // ── Quiénes son los competidores ────────────────────────────────────────
  // "3 competidores" obliga a salir a buscarlos. Con nombre y distancia se
  // puede ir a verlos el mismo día, que es lo que hace cualquiera antes de
  // firmar un arriendo.
  function bloqueCompetencia(v){
    if (!v || v.nCompetidores == null) return '';
    const lista = v.competidores || [];
    const anon = v.competidoresSinNombre || 0;
    if (!v.nCompetidores) {
      return '<div class="aia-nucleo">✅ <b>Sin competencia directa</b> identificada en el radio. ' +
        'Ojo: el mapa abierto no lo ve todo — si conoces un competidor que no aparece, ' +
        'agrégalo con “Agregar uso” y vuelve a analizar.</div>';
    }
    return '<h4 class="aia-flujo-sub">Competencia directa (' + v.nCompetidores + ')</h4>' +
      (lista.length
        ? '<ul class="aia-comp">' + lista.map(c =>
            '<li><span>' + escHTML(c.icono + ' ' + c.nombre) +
            '<small>' + escHTML(c.rubro) + '</small></span>' +
            '<b>' + c.distM + ' m</b></li>').join('') + '</ul>'
        : '') +
      (anon
        ? '<p class="aia-flujo-nota">' + anon +
          (anon === 1 ? ' competidor más está en el mapa sin nombre'
                      : ' competidores más están en el mapa sin nombre') +
          ': cuentan igual en el puntaje, solo que no se pueden citar.</p>'
        : '');
  }

  // ── El radio de importancia, en cifras ──────────────────────────────────
  // El mapa ya muestra los anillos; aquí se dice cuánto pesa cada uno y qué
  // hay dentro. Un radio de 1 km no es una bolsa donde todo cuenta igual.
  function bloqueAnillos(s){
    const an = s.anillos || [];
    if (!an.length) return '';
    const max = Math.max.apply(null, an.map(x => x.peso)) || 1;
    const filas = an.map(x =>
      '<li><span>' + x.etiqueta + '</span>' +
      '<i><b style="width:' + Math.round(100 * x.peso / max) + '%"></b></i>' +
      '<b>' + x.peso + '%</b></li>' +
      (x.ejemplos.length
        ? '<p class="aia-anillo-ej">' + x.n + ' usos · ' + x.comercios + ' de comercio — ' +
          escHTML(x.ejemplos.map(e => e.nombre + ' (' + e.distM + ' m)').join(', ')) + '</p>'
        : '<p class="aia-anillo-ej">' + x.n + ' usos · ' + x.comercios + ' de comercio</p>')
    ).join('');
    const nuc = (s.nucleos || [])[0];
    return '<h4 class="aia-flujo-sub">Radio de importancia</h4>' +
      '<p class="aia-flujo-nota">Cuánto de la influencia sobre el lote viene de cada distancia. ' +
      'Lo de cerca pesa más: no es lo mismo un supermercado a 100 m que a 900 m.</p>' +
      '<ul class="aia-anillos">' + filas + '</ul>' +
      (nuc
        ? '<div class="aia-nucleo">🏬 La concentración comercial que más interviene: ' +
          '<b>' + nuc.n + ' locales a ~' + nuc.distM + ' m</b>, sobre todo de ' +
          escHTML(nuc.rubroDominante.toLowerCase()) + '.' +
          (nuc.nombres.length ? ' Por ejemplo: ' + escHTML(nuc.nombres.join(', ')) + '.' : '') +
          '</div>'
        : '');
  }

  function renderFlujo(r){
    const cont = $('aia-flujo');
    if (!cont) return;
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    cont.hidden = !f;
    if (!f) return;

    const col = v => v >= 70 ? '#4ade80' : v >= 50 ? '#22d3ee' : v >= 30 ? '#f5b942' : '#f87171';
    const medidor = (etq, ico, v, nivel) =>
      '<div class="aia-flujo-med"><div class="aia-flujo-cab"><span>' + ico + ' ' + etq + '</span>' +
      '<b style="color:' + col(v) + '">' + v + '/100 · ' + escHTML(nivel) + '</b></div>' +
      '<div class="aia-barra"><i style="width:' + v + '%;background:' + col(v) + '"></i></div></div>';

    const franja = (etq, v) =>
      '<div class="aia-flujo-hora"><small>' + etq + '</small>' +
      '<div class="aia-barra"><i style="width:' + v + '%;background:#22d3ee"></i></div>' +
      '<b>' + v + '</b></div>';

    const lectura = f.dominante === 'ninguno'
      ? 'No pasa casi nadie, ni a pie ni en carro: aquí el negocio tendría que traer su propia clientela, no capturarla del flujo.'
      : f.dominante === 'peatonal'
      ? 'El entorno mueve más gente a pie que en carro: favorece formatos de paso, vitrina a la calle y estancia corta.'
      : f.dominante === 'vehicular'
        ? 'El entorno mueve más carro que peatón: sin parqueo resuelto, el flujo pasa de largo sin convertirse en cliente.'
        : 'El entorno reparte parejo entre peatón y carro: conviene resolver los dos accesos y no apostar a uno solo.';

    const gen = (f.generadores || []).slice(0, 8);
    const listaGen = gen.length
      ? '<ul class="aia-flujo-gen">' + gen.map(g =>
          '<li><span>' + escHTML(g.nombre) + '</span><small>×' + g.n + '</small><b>' + g.aporte + '</b></li>'
        ).join('') + '</ul>'
      : '<p class="aia-flujo-vacio">No se identificaron generadores de peatones en el radio.</p>';

    // Lo que RESTA. Un análisis que solo suma miente por omisión: el tramo de
    // bodegas o los locales cerrados con reja son lo que corta el recorrido a
    // pie, y quien va a poner un local necesita verlo tanto como lo que suma.
    const pen = (f.penalizadores || []).slice(0, 4);
    const listaResta = pen.length
      ? '<h4 class="aia-flujo-sub">Qué rompe el recorrido a pie</h4>' +
        '<ul class="aia-flujo-gen aia-flujo-resta">' + pen.map(pp =>
          '<li><span>' + escHTML(pp.nombre) + ' · ' + escHTML(pp.motivo) + '</span>' +
          '<small>×' + pp.n + '</small><b>−' + pp.resta + '</b></li>').join('') + '</ul>' +
        '<p class="aia-flujo-nota">Descuenta ' + (f.restaPeaton || 0) + ' de ' + (f.sumaBruta || 0) +
        ' puntos brutos de atracción peatonal.</p>'
      : '';

    // Qué atrae VEHÍCULOS, que no es lo mismo que qué atrae peatones: a una
    // ferretería o a una bodega no se llega a pie con la compra al hombro.
    const genV = (f.generadoresVehiculo || []).slice(0, 5);
    const listaVeh = genV.length
      ? '<h4 class="aia-flujo-sub">Qué atrae vehículos</h4>' +
        '<ul class="aia-flujo-gen">' + genV.map(g =>
          '<li><span>' + escHTML(g.nombre) + '</span><small>×' + g.n + '</small><b>' + g.aporte + '</b></li>'
        ).join('') + '</ul>'
      : '';

    // ── Mapas de calor ────────────────────────────────────────────────────
    // El flujo es UN número para todo el radio y eso promedia lo que más
    // importa: pegado al gimnasio pasa gente que 300 m más allá no pasa.
    // Estas tres capas reparten el mismo cálculo sobre la malla del motor.
    const mapasCalor = (function(){
      const mc = f.mapaCalor;
      if (!mc) return '';
      const panel = (capa, foco, titulo, sub, tipo) => {
        const png = pngCalorApp(capa, mc.n, tipo);
        return '<figure class="aia-calor-panel">' +
          '<figcaption>' + escHTML(titulo) + '<em>' + escHTML(sub) + '</em></figcaption>' +
          '<div class="aia-calor-lienzo">' +
            (png ? '<img src="' + png + '" alt="' + escHTML(titulo) + '">'
                 : '<div class="aia-calor-vacio"></div>') +
            '<i class="aia-calor-centro"></i>' +
          '</div>' +
          '<small>' + (foco ? escHTML(foco.texto) : 'sin actividad suficiente') + '</small>' +
          '</figure>';
      };
      return '<h4 class="aia-flujo-sub">Dónde está el movimiento</h4>' +
        '<div class="aia-calor">' +
          panel(mc.peatonalDia, mc.focoDia, 'A pie · día', 'mañana a tarde', 'peaton') +
          panel(mc.peatonalNoche, mc.focoNoche, 'A pie · noche', 'después de las 7 p.m.', 'peaton') +
          panel(mc.vehicular, mc.focoVehicular, 'En vehículo', 'vías y atractores', 'vehiculo') +
        '</div>' +
        '<p class="aia-flujo-nota">La cruz es el lote. Cada capa se colorea contra su propio ' +
          'máximo: dice DÓNDE se concentra el movimiento dentro del radio, no cuánto.' +
          (mc.fiable ? '' : ' Con pocos puntos mapeados es indicativo: conviene contrastarlo en campo.') +
        '</p>';
    })();

    cont.innerHTML =
      '<h3>🚶🚗 Flujo peatonal y vehicular</h3>' +
      medidor('Flujo peatonal', '🚶', f.peatonal, f.nivelPeatonal) +
      medidor('Flujo vehicular', '🚗', f.vehicular, f.nivelVehicular) +
      '<p class="aia-flujo-lectura">' + escHTML(lectura) + '</p>' +
      '<p class="aia-flujo-lectura"><b>Hora fuerte: ' + escHTML(f.franjaFuerte) + '.</b> ' +
        // Se distingue el parqueadero que está mapeado del que el formato
        // implica: en el mapa abierto casi nadie dibuja el patio de un D1.
        escHTML(f.parqueaderos > 0
          ? f.parqueaderos + (f.parqueaderos === 1 ? ' parqueadero mapeado' : ' parqueaderos mapeados') + ' en el radio.'
          : (f.parqueoProbable && f.parqueoProbable.length)
            ? 'Sin parqueadero mapeado, pero hay ' +
              f.parqueoProbable.slice(0, 3).map(q => q.nombre.toLowerCase()).join(', ') +
              ': formatos que normalmente traen el suyo.'
            : 'Sin parqueadero mapeado ni formatos que suelan traer el suyo.') + '</p>' +
      (f.consejoUbicacion
        ? '<p class="aia-flujo-donde"><b>📍 Dónde ubicarse</b>' + escHTML(f.consejoUbicacion) + '</p>' : '') +
      '<div class="aia-flujo-horas">' + franja('Mañana', f.franjas.manana) +
        franja('Mediodía', f.franjas.mediodia) + franja('Tarde', f.franjas.tarde) +
        franja('Noche', f.franjas.noche || 0) + '</div>' +
      (f.vidaNocturna
        ? '<p class="aia-flujo-lectura">🌙 <b>La zona sigue viva de noche.</b> Es un dato de negocio, ' +
          'no un detalle: cambia el horario de apertura y hasta el formato del local.</p>'
        : '') +
      mapasCalor +
      // Tránsito y combustible: rangos de orden de magnitud, no aforos.
      (function(){
        const t = f.trafico;
        if (!t) return '';
        const miles = n => n.toLocaleString('es-CO');
        const fila = (ico, etq, val, pie) =>
          '<div class="aia-traf-fila"><span>' + ico + ' ' + etq + '</span><b>' + val + '</b></div>' +
          '<p class="aia-traf-pie">' + escHTML(pie) + '</p>';
        return '<h4 class="aia-flujo-sub">Tránsito y combustible</h4>' +
          fila('🚗', 'Carros por día',
               t.estimable ? miles(t.carrosDiaMin) + '–' + miles(t.carrosDiaMax) : '—',
               t.estimable
                 ? 'Por ' + t.corredor.nombre + ', vía ' + t.corredor.jerarquia + ' a ' + t.corredor.distM + ' m.'
                 : 'Sin vía arteria en el radio: no hay corredor del que estimarlo.') +
          fila('⛽', 'Litros al mes',
               t.estaciones ? miles(t.litrosMesMin) + '–' + miles(t.litrosMesMax) : '—',
               t.estaciones
                 ? t.estaciones + (t.estaciones === 1 ? ' estación' : ' estaciones') + ' de servicio en el radio.'
                 : 'Sin estaciones de servicio en el radio.');
      })() +
      bloqueAnillos(r.stats || {}) +
      '<h4 class="aia-flujo-sub">Qué trae gente a pie</h4>' + listaGen +
      listaResta + listaVeh +
      // Un flujo bajo por calle vacía y uno bajo por zona sin mapear se ven
      // idénticos en el número. Distinguirlos evita descartar una ubicación
      // buena por un hueco de datos.
      (f.avisoDatos ? '<p class="aia-flujo-aviso">⚠️ ' + escHTML(f.avisoDatos) + '</p>' : '') +
      '<p class="aia-flujo-nota">Potencial de flujo estimado a partir de los usos del entorno y la malla vial. No es un aforo: no hay conteo de personas ni de vehículos. Los carros por día y los litros al mes son rangos de orden de magnitud según la jerarquía de la vía y el número de estaciones — no son mediciones ni cifras de ventas. Sirve para comparar ubicaciones entre sí y para dimensionar el formato, no para proyectar ventas.</p>';
  }

  // ── Tabla completa de puntos ─────────────────────────────────────────────
  let ordenTabla = 'distancia'; // 'distancia' | 'categoria'
  function renderTablaPuntos(r){
    const G = window.AIA_MOTOR.GRUPOS;
    const cont = $('aia-tabla-puntos');
    const pintar = () => {
      const pois = (r.pois || []).slice().sort((a, b) =>
        ordenTabla === 'distancia' ? a.distM - b.distM : (a.grupo === b.grupo ? a.distM - b.distM : a.grupo.localeCompare(b.grupo)));
      const filas = pois.map(p =>
        '<tr><td>' + p.icono + ' ' + escHTML(p.nombre) + '</td>' +
        '<td><span class="aia-tabla-dot" style="background:' + p.color + '"></span>' + escHTML(G[p.grupo].t) + '</td>' +
        '<td class="aia-tabla-num">' + p.distM + ' m</td></tr>'
      ).join('');
      cont.innerHTML = '<h3>📍 Todos los puntos del radio (' + pois.length + ')</h3>' +
        '<div class="aia-tabla-orden">' +
        '<button type="button" class="' + (ordenTabla === 'distancia' ? 'activo' : '') + '" data-orden="distancia">Por cercanía</button>' +
        '<button type="button" class="' + (ordenTabla === 'categoria' ? 'activo' : '') + '" data-orden="categoria">Por categoría</button>' +
        '</div>' +
        '<div class="aia-tabla-puntos-wrap"><table class="aia-tabla-puntos-tbl"><thead><tr><th>Punto</th><th>Grupo (Matriz URBIS)</th><th class="aia-tabla-num">Distancia</th></tr></thead>' +
        '<tbody>' + (filas || '<tr><td colspan="3" class="aia-foda-vacio">Sin puntos identificados en este radio.</td></tr>') + '</tbody></table></div>';
      cont.querySelectorAll('[data-orden]').forEach(b => b.addEventListener('click', () => { ordenTabla = b.dataset.orden; pintar(); }));
    };
    pintar();
  }

  // ── Indicadores urbanos (Fase 2) ────────────────────────────────────────
  function renderIndicadores(r){
    const i = r.indicadores;
    const cont = $('aia-indicadores');
    cont.hidden = !i;
    if (!i) return;
    const col = t => /muy alta|alto potencial|fuerte transformaci|riesgo bajo|alta actividad/i.test(t) ? '#4ade80'
      : /(^|\s)alta|en transformaci|potencial medio|moderada|riesgo medio/i.test(t) ? '#22d3ee'
      : /media|en transici|riesgo alto|especializado/i.test(t) ? '#f5b942' : '#f87171';
    const fila = (etq, val, nivel, detalle) =>
      '<div class="aia-ind"><div class="aia-ind-top"><span>' + etq + '</span>' +
      '<b style="color:' + col(nivel) + '">' + escHTML(nivel) + '</b></div>' +
      '<div class="aia-barra"><i style="width:' + val + '%;background:' + col(nivel) + '"></i></div>' +
      (detalle ? '<small>' + escHTML(detalle) + '</small>' : '') + '</div>';

    const so = i.scoreOportunidad;
    const colSO = so.valor >= 75 ? '#4ade80' : so.valor >= 60 ? '#22d3ee' : so.valor >= 45 ? '#f5b942' : '#f87171';
    const opos = (i.oportunidades.lista || []).slice(0, 4);
    const est = Math.max(1, Math.min(5, Math.round(so.valor / 20)));

    // El estrato encabeza el bloque: es dato duro del censo (no estimación) y
    // es lo que define a qué precio se puede vender y qué producto construir.
    const ind = i.estrato;
    const bloqueEstrato = (ind && ind.disponible)
      ? '<div class="aia-estrato">' +
          '<div class="aia-estrato-cab"><b>🏷️ Estrato socioeconómico</b>' +
            '<span class="aia-estrato-fuente">Censo DANE 2018</span></div>' +
          '<div class="aia-estrato-num"><b>' + ind.predominante + '</b>' +
            '<small>predominante' + (ind.homogeneo ? '' : ' · rango ' + ind.minimo + '–' + ind.maximo) + '</small></div>' +
          '<div class="aia-estrato-barras">' +
            ind.reparto.map(x => {
              const pct = Math.round(100 * x.manzanas / Math.max(1, ind.manzanasConEstrato));
              return '<div class="aia-estrato-fila"><span>Estrato ' + x.estrato + '</span>' +
                '<i><b style="width:' + pct + '%"></b></i>' +
                '<em>' + x.manzanas + ' mz · ' + pct + '%</em></div>';
            }).join('') +
          '</div>' +
          '<p class="aia-estrato-txt">' + escHTML(ind.detalle) + '</p>' +
        '</div>'
      : '';

    // ── Crecimiento de la población ───────────────────────────────────────
    // El censo tiene ocho años y leerlo como si fuera hoy subestima la
    // demanda. Se dibujan las dos cifras juntas —lo contado y lo proyectado—
    // porque no valen igual: una se observó y la otra se estima.
    const st = r.stats || {};
    const bloqueCrecimiento = (st.poblacionProyectada && (st.serieProyeccion || []).length)
      ? (function(){
          const s = st;
          const serie = s.serieProyeccion;
          const min = Math.min.apply(null, serie.map(x => x.poblacion));
          const max = Math.max.apply(null, serie.map(x => x.poblacion));
          const rango = Math.max(1, max - min);
          const W = 100, H = 34;   // en unidades del viewBox, se estira solo
          const px = i2 => (i2 / (serie.length - 1)) * W;
          const py = v => H - ((v - min) / rango) * (H - 4) - 2;
          const linea = serie.map((x, i2) => (i2 ? 'L' : 'M') + px(i2).toFixed(2) + ' ' + py(x.poblacion).toFixed(2)).join(' ');
          // Lo que va después del año en curso se dibuja punteado: es
          // proyección hacia adelante y no debe leerse igual que el tramo
          // que llega hasta hoy.
          const iHoy = serie.findIndex(x => x.futuro);
          const corte = iHoy > 0 ? iHoy - 1 : serie.length - 1;
          const solido = serie.slice(0, corte + 1)
            .map((x, i2) => (i2 ? 'L' : 'M') + px(i2).toFixed(2) + ' ' + py(x.poblacion).toFixed(2)).join(' ');
          const area = solido + ' L' + px(corte).toFixed(2) + ' ' + H + ' L0 ' + H + ' Z';
          const hoy = serie[corte];
          return '<div class="aia-crece">' +
            '<div class="aia-demo-cab"><b>📈 Cómo ha crecido la población</b>' +
              '<span class="aia-demo-fuente">DANE · proyecciones ' + s.censoAnio + '–' +
                serie[serie.length - 1].anio + '</span></div>' +
            '<div class="aia-crece-cifras">' +
              '<div><small>Censo ' + s.censoAnio + '</small><b>' +
                s.poblacionCenso.toLocaleString('es-CO') + '</b><em>contado</em></div>' +
              '<div class="flecha">→</div>' +
              '<div class="hoy"><small>' + s.anioProyeccion + '</small><b>' +
                s.poblacionProyectada.toLocaleString('es-CO') + '</b><em>proyectado</em></div>' +
              '<div class="delta">+' + s.crecimientoPct + '%</div>' +
            '</div>' +
            '<svg class="aia-crece-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
              '<path d="' + area + '" fill="rgba(34,211,238,.16)"/>' +
              '<path d="' + solido + '" fill="none" stroke="#22d3ee" stroke-width="1.1" ' +
                'vector-effect="non-scaling-stroke"/>' +
              '<path d="' + linea + '" fill="none" stroke="#22d3ee" stroke-width="1.1" ' +
                'stroke-dasharray="3 2" opacity=".55" vector-effect="non-scaling-stroke"/>' +
              '<circle cx="0" cy="' + py(serie[0].poblacion).toFixed(2) + '" r="1.6" fill="#22d3ee"/>' +
              '<circle cx="' + px(corte).toFixed(2) + '" cy="' + py(hoy.poblacion).toFixed(2) +
                '" r="1.6" fill="#fff" stroke="#22d3ee" stroke-width=".8"/>' +
            '</svg>' +
            '<div class="aia-crece-eje"><span>' + serie[0].anio + '</span>' +
              '<span>' + hoy.anio + '</span>' +
              '<span>' + serie[serie.length - 1].anio + '</span></div>' +
            '<p class="aia-demo-txt">Crece ' + (s.tasaAnualDane * 100).toFixed(2) +
              '% al año. El tramo punteado es proyección hacia adelante. ' +
              escHTML(s.advertenciaProyeccion || '') + '</p>' +
          '</div>';
        })()
      : (st.poblacionEsCensal
          ? '<p class="aia-demo-txt">Sin proyección de población para este municipio: ' +
            'el análisis trabaja con el conteo del censo de ' + st.censoAnio + ' tal cual.</p>'
          : '');

    // Estructura demográfica del censo. Se titula "sexo y edad" a propósito:
    // el CNPV 2018 registra sexo, no identidad de género, y el informe no debe
    // atribuirle al DANE una medición que no hizo.
    const dm = i.demografia;
    const bloqueDemo = (dm && dm.disponible)
      ? '<div class="aia-demo">' +
          '<div class="aia-demo-cab"><b>👥 Población por sexo y edad</b>' +
            '<span class="aia-demo-fuente">Censo DANE 2018</span></div>' +
          '<div class="aia-demo-sexo">' +
            '<div class="aia-demo-barra">' +
              '<i class="muj" style="width:' + dm.pctMujeres + '%"></i>' +
              '<i class="hom" style="width:' + dm.pctHombres + '%"></i>' +
            '</div>' +
            '<div class="aia-demo-leyenda">' +
              '<span><b class="muj"></b>Mujeres ' + dm.pctMujeres + '% <em>(' + dm.mujeres.toLocaleString('es-CO') + ')</em></span>' +
              '<span><b class="hom"></b>Hombres ' + dm.pctHombres + '% <em>(' + dm.hombres.toLocaleString('es-CO') + ')</em></span>' +
            '</div>' +
          '</div>' +
          '<div class="aia-demo-edades">' +
            dm.tramos.map(t =>
              '<div class="aia-demo-fila"><span>' + t.icono + ' ' + t.etiqueta + '</span>' +
              '<i><b style="width:' + Math.min(100, t.pct * 2) + '%"></b></i>' +
              '<em>' + t.pct + '%</em></div>').join('') +
          '</div>' +
          (dm.envejecimiento != null
            ? '<div class="aia-demo-indice"><b>' + dm.envejecimiento + '</b>' +
              '<small>mayores de 65 por cada 100 menores de 15</small></div>'
            : '') +
          '<p class="aia-demo-txt">' + escHTML(dm.detalle) + '</p>' +
        '</div>'
      : '';

    cont.innerHTML = bloqueEstrato + bloqueCrecimiento + bloqueDemo +
      // Pedido explícito: "oportunidad urbana" se leía sin saber qué medía.
      // El subtítulo aclara que es una nota del LUGAR (sirva lo que sirva
      // construirse ahí), distinta de Viabilidad, que es la del PROYECTO
      // concreto — ese es el indicador que de verdad dice si conviene o no.
      '<h3>🏆 Oportunidad urbana <em>· qué tan buen sitio es, sin importar qué se construya</em></h3>' +
      '<div class="aia-so"><div class="aia-so-est">' + '★'.repeat(est) + '☆'.repeat(5 - est) + '</div>' +
      '<div class="aia-so-info"><b style="color:' + colSO + '">' + so.valor + '<small>/100</small></b>' +
      '<span style="background:' + colSO + '">Oportunidad ' + escHTML(so.nivel) + '</span></div></div>' +
      '<p class="aia-ind-nota">👉 El indicador que resume si <b>tu proyecto</b> conviene o no es ' +
      '<b>Viabilidad</b> (arriba, con las estrellas grandes) — este de aquí solo describe el lugar.</p>' +

      '<h3>📐 Indicadores del sector</h3>' +
      fila('Diversidad de usos', i.diversidad.valor, i.diversidad.nivel, i.diversidad.detalle) +
      fila('Actividad comercial', Math.min(100, i.comercio.total * 2), i.comercio.nivel, i.comercio.detalle) +
      fila('Expansión (suelo libre)', i.expansion.valor, i.expansion.nivel, i.expansion.detalle) +
      fila('Transformación (obras)', i.transformacion.valor, i.transformacion.nivel, i.transformacion.detalle) +
      fila('Riesgo urbano', i.riesgos.valor, i.riesgos.nivel, i.riesgos.detalle) +
      (i.riesgos.señales.length ? '<ul class="aia-ind-lista">' + i.riesgos.señales.map(s => '<li>' + escHTML(s) + '</li>').join('') + '</ul>' : '') +

      (opos.length ? '<h3>💡 Oportunidades por categoría</h3><ul class="aia-ind-lista">' +
        opos.map(o => '<li><b>' + escHTML(o.nombre) + '</b> — ' + escHTML(o.texto) + '</li>').join('') + '</ul>' : '') +

      (i.estacionalidad.notas.length ? '<h3>📅 Estacionalidad</h3><ul class="aia-ind-lista">' +
        i.estacionalidad.notas.map(t => '<li>' + escHTML(t) + '</li>').join('') + '</ul>' : '') +

      bloqueMultiRadio(r) +

      '<details class="aia-ind-externo"><summary>⚪ Datos que requieren fuente externa (' + i.requiereFuenteExterna.length + ')</summary>' +
      '<ul class="aia-ind-lista">' + i.requiereFuenteExterna.map(t => '<li>' + escHTML(t) + '</li>').join('') + '</ul>' +
      '<small>URBIS no simula estos datos: se muestran aquí para saber qué falta conseguir.</small></details>';
  }

  // Comparativa multi-radio (Fase 3). Sale de los mismos datos ya descargados,
  // así que no cuesta ninguna consulta adicional.
  function bloqueMultiRadio(r){
    const m = r.multiRadio;
    if (!m || !m.anillos || m.anillos.length < 2) return '';
    const etq = v => v >= 1000 ? (v / 1000) + ' km' : v + ' m';
    return '<h3>🎯 El entorno según la distancia</h3>' +
      '<table class="aia-tbl-radios"><tr><th>Radio</th><th>Usos</th><th>Usos/ha</th>' +
      '<th>Comercio</th><th>Equip.</th><th>Hab. est.</th></tr>' +
      m.anillos.map(a => '<tr' + (a.esAnalizado ? ' class="act"' : '') + '><td>' + etq(a.radioM) + '</td>' +
        '<td>' + a.total + '</td><td>' + a.densidadPorHa + '</td><td>' + a.comercio + '</td>' +
        '<td>' + a.equipamientos + '</td><td>' + a.poblacionEstimada.toLocaleString('es-CO') + '</td></tr>').join('') +
      '</table><p class="aia-radio-lectura">' + escHTML(m.lectura) + '</p>';
  }

  function kpi(valor, etiqueta, color){
    return '<div class="aia-kpi"' + (color ? ' style="border-color:' + color + '"' : '') + '><b' + (color ? ' style="color:' + color + '"' : '') + '>' + valor + '</b><small>' + etiqueta + '</small></div>';
  }

  function etiquetaSub(k){
    return { demanda:'Demanda', competencia:'Competencia', complementarios:'Complementarios', movilidad:'Movilidad', entorno:'Entorno' }[k] || k;
  }

  function renderCharts(r){
    const s = r.stats;
    const G = window.AIA_MOTOR.GRUPOS, C = window.AIA_MOTOR.GRUPO_COLOR;
    const gruposConDatos = Object.keys(G).filter(g => (s.porGrupo[g] || 0) > 0);
    const opBase = {
      responsive: true,
      plugins: { legend: { labels: { color: '#e2e8f0', font: { size: 11 } } } }
    };

    destruirChart('barras');
    S.charts.barras = new Chart($('aia-chart-barras'), {
      type: 'bar',
      data: {
        labels: gruposConDatos.map(g => G[g].i + ' ' + G[g].t.split(' ')[0]),
        datasets: [{ label: 'Usos', data: gruposConDatos.map(g => s.porGrupo[g]), backgroundColor: gruposConDatos.map(g => C[g]) }]
      },
      options: Object.assign({}, opBase, {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#cbd5e1', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.06)' } },
          y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,.06)' } }
        }
      })
    });

    destruirChart('donut');
    const up = s.usoPredominante;
    const upKeys = Object.keys(up).filter(k => up[k] > 0);
    const upColores = { residencial:'#ff8a4a', comercial:'#e5484d', institucional:'#3b82f6', servicios:'#14b8a6', industrial:'#8b6f47', mixto:'#6366f1', ambiental:'#22c55e' };
    S.charts.donut = new Chart($('aia-chart-donut'), {
      type: 'doughnut',
      data: {
        labels: upKeys.map(k => k[0].toUpperCase() + k.slice(1) + ' ' + up[k] + '%'),
        datasets: [{ data: upKeys.map(k => up[k]), backgroundColor: upKeys.map(k => upColores[k]), borderColor: '#0b1220', borderWidth: 2 }]
      },
      options: Object.assign({}, opBase, { cutout: '58%' })
    });

    destruirChart('radar');
    S.charts.radar = new Chart($('aia-chart-radar'), {
      type: 'radar',
      data: {
        labels: gruposConDatos.map(g => G[g].t.split(' ')[0]),
        datasets: [{
          label: 'Usos por grupo', data: gruposConDatos.map(g => s.porGrupo[g]),
          backgroundColor: 'rgba(34,211,238,.25)', borderColor: '#22d3ee', pointBackgroundColor: '#22d3ee'
        }]
      },
      options: Object.assign({}, opBase, {
        scales: { r: {
          ticks: { color: '#94a3b8', backdropColor: 'transparent' },
          grid: { color: 'rgba(255,255,255,.12)' }, angleLines: { color: 'rgba(255,255,255,.12)' },
          pointLabels: { color: '#e2e8f0', font: { size: 10 } }
        } }
      })
    });
  }

  function destruirChart(nombre){
    if (S.charts[nombre]) { try { S.charts[nombre].destroy(); } catch(e) {} S.charts[nombre] = null; }
  }

  // ── Guardar / Mis análisis / Comparar ───────────────────────────────────
  const GUARDADOS_KEY = 'aia_analisis_guardados_v1';
  const GUARDADOS_MAX = 30;

  function leerGuardados(){
    try { const arr = JSON.parse(localStorage.getItem(GUARDADOS_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
    catch(e) { return []; }
  }
  function escribirGuardados(arr){
    try { localStorage.setItem(GUARDADOS_KEY, JSON.stringify(arr.slice(-GUARDADOS_MAX))); }
    catch(e) { alert('No se pudo guardar: el almacenamiento local está lleno. Borra algún análisis antiguo desde "Mis análisis".'); }
  }

  function guardarAnalisisActual(){
    if (!S.resultado) return;
    const nombre = prompt('Nombre para este análisis:', S.resultado.meta.proyectoNombre || 'Análisis sin nombre');
    if (nombre == null) return; // cancelado
    const guardados = leerGuardados();
    guardados.push({
      id: 'aia_' + Date.now(), nombre: nombre.trim() || 'Análisis sin nombre', ciudad: 'Cúcuta',
      fechaISO: new Date().toISOString(), lat: S.lote.lat, lng: S.lote.lng, radioM: S.radioM,
      modo: S.modo, usosMixto: S.usosMixto, config: S.config, resultado: S.resultado
    });
    escribirGuardados(guardados);
    alert('✅ Análisis guardado. Búscalo en la pestaña "Mis análisis".');
  }

  let comparando = new Set();

  function renderGuardados(){
    const guardados = leerGuardados().slice().reverse();
    comparando = new Set([...comparando].filter(id => guardados.some(g => g.id === id)));
    const lista = $('aia-guardados-lista');
    if (!guardados.length) {
      lista.innerHTML = '<p class="aia-foda-vacio">Todavía no has guardado ningún análisis. Analiza un lote y toca "💾 Guardar".</p>';
    } else {
      lista.innerHTML = guardados.map(g => {
        const v = g.resultado.viabilidad;
        const nivel = v ? v.nivel : (g.resultado.ranking ? 'Ranking' : '—');
        const color = nivel === 'Alta' ? '#4ade80' : (nivel === 'Media' ? '#f5b942' : (nivel === 'Baja' ? '#f87171' : '#94a3b8'));
        return '<div class="aia-guardado-card" data-id="' + g.id + '">' +
          '<label class="aia-guardado-check"><input type="checkbox" data-comparar="' + g.id + '" ' + (comparando.has(g.id) ? 'checked' : '') + '></label>' +
          '<div class="aia-guardado-info" data-abrir="' + g.id + '">' +
          '<b>' + escHTML(g.nombre) + '</b><small>' + escHTML(g.ciudad) + ' · ' + new Date(g.fechaISO).toLocaleDateString('es-CO') + ' · ' + g.radioM + ' m</small>' +
          '<small>' + escHTML(g.resultado.meta.proyectoNombre) + '</small></div>' +
          '<span class="aia-guardado-nivel" style="color:' + color + '">' + nivel + (v ? ' ' + v.score : '') + '</span>' +
          '<button type="button" class="aia-guardado-borrar" data-borrar="' + g.id + '">🗑️</button>' +
          '</div>';
      }).join('');
    }
    document.querySelectorAll('[data-abrir]').forEach(el => el.addEventListener('click', () => restaurarGuardado(el.dataset.abrir)));
    document.querySelectorAll('[data-comparar]').forEach(el => el.addEventListener('change', () => {
      if (el.checked) comparando.add(el.dataset.comparar); else comparando.delete(el.dataset.comparar);
      refrescarBotonComparar();
    }));
    document.querySelectorAll('[data-borrar]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('¿Eliminar este análisis guardado?')) return;
      escribirGuardados(leerGuardados().filter(g => g.id !== el.dataset.borrar));
      comparando.delete(el.dataset.borrar);
      renderGuardados();
    }));
    refrescarBotonComparar();
    $('aia-comparacion').hidden = true;
  }

  function refrescarBotonComparar(){
    const btn = $('aia-btn-comparar');
    btn.hidden = comparando.size < 2;
    $('aia-comparar-n').textContent = comparando.size;
  }

  function restaurarGuardado(id){
    const g = leerGuardados().find(x => x.id === id);
    if (!g) return;
    S.resultado = g.resultado;
    S.lote = { lat: g.lat, lng: g.lng };
    S.radioM = g.radioM;
    S.modo = g.modo;
    S.usosMixto = g.usosMixto || [];
    S.config = g.config || {};
    S.ultimosElementos = null; // restaurado desde caché guardada, no hay POIs crudos en memoria
    setLote(g.lat, g.lng, g.resultado.meta.direccionAprox);
    S.map.setZoom(15);
    pintarPOIs(g.resultado.pois);
    renderResultados(g.resultado);
    setTab('nuevo');
    setSheetState('resultados');
  }

  function renderComparacion(){
    const guardados = leerGuardados().filter(g => comparando.has(g.id));
    if (guardados.length < 2) return;
    const filaFoda = (g, tipo) => (g.resultado.foda[tipo] || []).slice(0, 2).join(' · ') || '—';
    $('aia-comparacion').hidden = false;
    $('aia-comparacion').innerHTML = '<h3>⚖️ Comparación de análisis</h3>' +
      '<div class="aia-tabla-comparar-wrap"><table class="aia-tabla-comparar"><thead><tr><th>Criterio</th>' +
      guardados.map(g => '<th>' + escHTML(g.nombre) + '</th>').join('') + '</tr></thead><tbody>' +
      '<tr><td>Proyecto</td>' + guardados.map(g => '<td>' + escHTML(g.resultado.meta.proyectoNombre) + '</td>').join('') + '</tr>' +
      '<tr><td>Radio</td>' + guardados.map(g => '<td>' + g.radioM + ' m</td>').join('') + '</tr>' +
      '<tr><td>Viabilidad</td>' + guardados.map(g => { const v = g.resultado.viabilidad; return '<td>' + (v ? v.nivel + ' (' + v.score + ')' : '—') + '</td>'; }).join('') + '</tr>' +
      '<tr><td>Usos identificados</td>' + guardados.map(g => '<td>' + g.resultado.stats.total + '</td>').join('') + '</tr>' +
      '<tr><td>Población estimada</td>' + guardados.map(g => '<td>' + g.resultado.stats.poblacionEstimada.toLocaleString('es-CO') + '</td>').join('') + '</tr>' +
      '<tr><td>Uso predominante</td>' + guardados.map(g => { const up = g.resultado.stats.usoPredominante; const top = Object.keys(up).reduce((a,b)=>up[a]>=up[b]?a:b); return '<td>' + top + ' (' + up[top] + '%)</td>'; }).join('') + '</tr>' +
      '<tr><td>Fortalezas</td>' + guardados.map(g => '<td>' + filaFoda(g, 'fortalezas') + '</td>').join('') + '</tr>' +
      '<tr><td>Riesgos</td>' + guardados.map(g => '<td>' + filaFoda(g, 'riesgos') + '</td>').join('') + '</tr>' +
      '<tr><td>Oportunidades</td>' + guardados.map(g => '<td>' + filaFoda(g, 'oportunidades') + '</td>').join('') + '</tr>' +
      '</tbody></table></div>';
    $('aia-comparacion').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Las gráficas de pantalla son de tema oscuro y en un informe impreso se
  // verían mal. Se vuelven a dibujar en canvas sueltos con tema claro y
  // sin animación (render inmediato) solo para exportarlas como imagen.
  // Las gráficas se rasterizan a PNG, así que no heredan el CSS del informe:
  // hay que pintarlas con los colores del estilo elegido o, en el estilo
  // oscuro, quedarían con texto gris sobre fondo negro.
  function capturarChartsClaro(estilo){
    const r = S.resultado;
    if (!r || typeof Chart === 'undefined') return {};
    const E = (window.AIA_INFORME && window.AIA_INFORME.ESTILOS) || {};
    const t = E[estilo] || E.institucional ||
      { chartTxt:'#2f3f4e', chartTxt2:'#5a6a7a', chartGrid:'#eef2f6', chartFondo:'#ffffff' };
    const G = window.AIA_MOTOR.GRUPOS, C = window.AIA_MOTOR.GRUPO_COLOR, s = r.stats;
    const out = {};

    const render = (cfg, w, h) => {
      try {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ch = new Chart(cv, cfg);
        // El canvas es transparente: se pinta el fondo blanco por debajo
        // para que el PNG no salga con fondo negro al imprimir.
        const ctx = cv.getContext('2d');
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = t.chartFondo;
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.restore();
        const url = cv.toDataURL('image/png');
        ch.destroy();
        return url;
      } catch(e) { return ''; }
    };

    const grupos = Object.keys(G).filter(g => (s.porGrupo[g] || 0) > 0)
      .sort((a, b) => s.porGrupo[b] - s.porGrupo[a]);

    out.barras = render({
      type: 'bar',
      data: { labels: grupos.map(g => G[g].t), datasets: [{ data: grupos.map(g => s.porGrupo[g]), backgroundColor: grupos.map(g => C[g]), borderRadius: 3 }] },
      options: {
        indexAxis: 'y', responsive: false, animation: false, devicePixelRatio: 2,
        layout: { padding: 8 },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: t.chartTxt2, font: { size: 15 } }, grid: { color: t.chartGrid }, border: { display: false } },
          y: { ticks: { color: t.chartTxt, font: { size: 15 } }, grid: { display: false }, border: { display: false } }
        }
      }
    }, 1200, 430);

    const up = s.usoPredominante;
    const upKeys = Object.keys(up).filter(k => up[k] > 0).sort((a, b) => up[b] - up[a]);
    const upColores = { residencial:'#ff8a4a', comercial:'#e5484d', institucional:'#3b82f6', servicios:'#14b8a6', industrial:'#8b6f47', mixto:'#6366f1', ambiental:'#22c55e' };
    out.donut = render({
      type: 'doughnut',
      data: {
        labels: upKeys.map(k => k[0].toUpperCase() + k.slice(1) + ' (' + up[k] + '%)'),
        datasets: [{ data: upKeys.map(k => up[k]), backgroundColor: upKeys.map(k => upColores[k] || '#94a3b8'), borderColor: t.chartFondo, borderWidth: 2 }]
      },
      options: {
        responsive: false, animation: false, devicePixelRatio: 2, cutout: '58%',
        layout: { padding: 8 },
        plugins: { legend: { position: 'right', labels: { color: t.chartTxt, font: { size: 15 }, boxWidth: 13, padding: 8 } } }
      }
    }, 1200, 400);

    return out;
  }

  // ── Exportar PDF con previsualización (Paso A → Paso B) ─────────────────
  function initExportar(){
    let orientacion = 'horizontal';
    // El estilo elegido se recuerda: quien ya definió cómo entrega sus
    // informes no quiere volver a escogerlo en cada análisis.
    const ESTILO_KEY = 'aia_estilo_informe_v1';
    let estilo = localStorage.getItem(ESTILO_KEY) || 'institucional';

    document.querySelectorAll('.aia-orient-btn').forEach(b => {
      b.addEventListener('click', () => {
        orientacion = b.dataset.orientacion;
        document.querySelectorAll('.aia-orient-btn').forEach(x => x.classList.toggle('activo', x === b));
      });
    });

    const btnsEstilo = document.querySelectorAll('.aia-estilo-btn');
    const pintarEstilo = () => btnsEstilo.forEach(x => x.classList.toggle('activo', x.dataset.estilo === estilo));
    btnsEstilo.forEach(b => {
      b.addEventListener('click', () => {
        estilo = b.dataset.estilo;
        localStorage.setItem(ESTILO_KEY, estilo);
        pintarEstilo();
      });
    });
    pintarEstilo();

    $('aia-exportar-cerrar').addEventListener('click', () => { $('aia-exportar').hidden = true; });

    $('aia-exp-previsualizar').addEventListener('click', () => {
      if (!S.resultado) return;
      try {
        const opciones = {
          titulo: $('aia-exp-titulo').value.trim() || S.resultado.meta.proyectoNombre,
          subtitulo: $('aia-exp-subtitulo').value.trim(),
          orientacion, estilo, autor: $('aia-exp-autor').value.trim(),
          ubicacion: S.ubicacion
        };
        const html = window.AIA_INFORME.construirHTMLEjecutivo(S.resultado, capturarChartsClaro(estilo), opciones);
        $('aia-exportar-iframe').srcdoc = html;
        $('aia-exportar-form').hidden = true;
        $('aia-exportar-preview').hidden = false;
        S._htmlInformeActual = html;
      } catch(err) {
        alert('No se pudo generar la previsualización: ' + (err && err.message || err));
      }
    });

    // Documento de trabajo aparte: listado completo agrupado por categoría.
    $('aia-exp-listado').addEventListener('click', () => {
      if (!S.resultado) return;
      try {
        const html = window.AIA_INFORME.construirHTMLListado(S.resultado, {
          titulo: $('aia-exp-titulo').value.trim() || S.resultado.meta.proyectoNombre,
          ubicacion: S.ubicacion
        });
        window.AIA_INFORME.abrirVentanaImpresion(html);
      } catch(err) {
        alert('No se pudo generar el listado: ' + (err && err.message || err));
      }
    });

    $('aia-exp-editar').addEventListener('click', () => {
      $('aia-exportar-preview').hidden = true;
      $('aia-exportar-form').hidden = false;
    });

    $('aia-exp-confirmar').addEventListener('click', () => {
      if (S._htmlInformeActual) window.AIA_INFORME.abrirVentanaImpresion(S._htmlInformeActual);
    });
  }

  function abrirExportar(){
    if (!S.resultado) return;
    $('aia-exp-titulo').value = S.resultado.meta.proyectoNombre || '';
    $('aia-exp-subtitulo').value = S.resultado.meta.direccionAprox || '';
    $('aia-exportar-form').hidden = false;
    $('aia-exportar-preview').hidden = true;
    $('aia-exportar').hidden = false;
  }

  // Superficie mínima de lectura para poder inspeccionar y probar el estado
  // desde fuera. Solo getters: nada de aquí modifica el análisis.
  window.AIA_APP = {
    get lote(){ return S.lote; },
    get resultado(){ return S.resultado; },
    get ultimoResultado(){ return S.resultado && S.resultado.stats; },
    get usosManuales(){ return leerUsosManuales(); }
  };

  // ── Arranque ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initMapa();
    initWizard();
    initSheetDrag();
    setSheetState('wizard');
    addEventListener('resize', () => setSheetState($('aia-sheet').dataset.estado || 'wizard'));
  });
})();
