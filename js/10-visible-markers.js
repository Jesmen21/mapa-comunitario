// ==========================================
  // MARCADORES VISIBLES PARA TODOS
  // ==========================================

  // ── Paleta de zonas de impacto ───────────────────────────────────────────────
  // interactive:false → las zonas NUNCA capturan clics (no bloquean Mover ni la
  // selección de marcadores debajo).
  const IMPACTO_VIA   = { color:'#FF6500', weight:5, opacity:.85, fillOpacity:.22, dashArray:'6 4', interactive:false };
  const IMPACTO_SEG   = { color:'#ef4444', weight:1.5, opacity:.6, fillOpacity:.12, interactive:false };
  const IMPACTO_AGUA  = { color:'#3b82f6', weight:1.5, opacity:.55, fillOpacity:.1, interactive:false };
  const IMPACTO_VERDE = { color:'#22c55e', weight:1.5, opacity:.55, fillOpacity:.1, interactive:false };
  const IMPACTO_GRAL  = { color:'#f59e0b', weight:1.5, opacity:.5, fillOpacity:.08, interactive:false };

  const TIPOS_VIA = new Set(['🚗 Reportes de Tráfico']);
  const ITEMS_VIA = ['hueco','bache','vía','via','carretera','derrumbe','deslizamiento','árbol caído','arbol caido','alcantarilla','cuneta','señal','señaliz','semáforo','semaforo','puente','pavimento','capa asfáltica','capa asfaltica'];
  const ITEMS_SEG = ['inseguridad','robo','hurto','pandillas','peligro','zona peligrosa','conflicto','guerrilla','droga','preventiva','sismo','ciclón','ciclon','tsunami','tormenta','geológico','geologico'];
  const ITEMS_AGUA = ['inundación','inundacion','drenaje','fuga','agua','lluvia'];

  function clasificarImpacto(tipo, elemento) {
    const el = (elemento || '').toLowerCase();
    if(TIPOS_VIA.has(tipo) || ITEMS_VIA.some(k => el.includes(k))) return 'via';
    if(ITEMS_SEG.some(k => el.includes(k))) return 'seguridad';
    if(ITEMS_AGUA.some(k => el.includes(k))) return 'agua';
    if((tipo || '').includes('Áreas Verdes') || (tipo || '').includes('Ambiental')) return 'verde';
    return 'general';
  }

  // ── Orientación de la zona de vía a la calzada real (OSRM) ───────────────────
  // _impactoGen se incrementa en cada recarga (pintarPuntos) para descartar
  // resultados OSRM que lleguen tarde tras un clearLayers.
  let _impactoGen = 0;
  window.urbisBumpImpactoGen = function(){ _impactoGen++; };
  const _viaCache = {};
  let _viaQueue = Promise.resolve(); // cola secuencial para no saturar OSRM público

  function _rumbo(aLat, aLng, bLat, bLng){
    const toR = x => x*Math.PI/180;
    const y = Math.sin(toR(bLng-aLng))*Math.cos(toR(bLat));
    const x = Math.cos(toR(aLat))*Math.sin(toR(bLat)) - Math.sin(toR(aLat))*Math.cos(toR(bLat))*Math.cos(toR(bLng-aLng));
    return Math.atan2(y, x); // radianes, 0 = norte
  }

  function dibujarSegmentoVia(lat, lng, bearingRad, gen, esFinal){
    if(typeof zonaImpactoLayer === 'undefined') return;
    if(gen != null && gen !== _impactoGen) return;
    const len = 0.000060; // ~6.5 m a cada lado del punto
    const dLat = Math.cos(bearingRad)*len;
    const dLng = Math.sin(bearingRad)*len/Math.cos(lat*Math.PI/180);
    const opts = esFinal ? IMPACTO_VIA : Object.assign({}, IMPACTO_VIA, { opacity:.45, dashArray:'3 5' });
    L.polyline([[lat-dLat, lng-dLng],[lat+dLat, lng+dLng]], opts).addTo(zonaImpactoLayer);
  }

  async function snapBearingOSRM(lat, lng){
    const key = lat.toFixed(5)+','+lng.toFixed(5);
    if(key in _viaCache) return _viaCache[key];
    const probe = async (la, ln) => {
      try{
        const u = `https://router.project-osrm.org/nearest/v1/driving/${ln},${la}?number=1`;
        const r = await fetch(u);
        if(!r.ok) return null;
        const j = await r.json();
        const w = j && j.waypoints && j.waypoints[0];
        return (w && w.location) ? [w.location[1], w.location[0]] : null; // [lat,lng]
      }catch(e){ return null; }
    };
    const p1 = await probe(lat, lng);
    const eastLng = lng + 0.00011/Math.cos(lat*Math.PI/180); // ~12 m al este
    const p2 = await probe(lat, eastLng);
    let bearing = null;
    if(p1 && p2 && (p1[0] !== p2[0] || p1[1] !== p2[1])){
      bearing = _rumbo(p1[0], p1[1], p2[0], p2[1]);
    }
    const info = { snap: p1, bearing };
    _viaCache[key] = info;
    return info;
  }

  function dibujarZonaImpacto(lat, lng, tipo, elemento) {
    if(typeof zonaImpactoLayer === 'undefined') return;
    const clase = clasificarImpacto(tipo, elemento);
    const D = 0.000045; // ~5 metros en grados

    if(clase === 'via') {
      // UNA sola línea naranja orientada a la calzada real (OSRM /nearest).
      // No se dibuja provisional para no dejar una segunda línea perpendicular.
      const gen = _impactoGen;
      _viaQueue = _viaQueue.then(()=> snapBearingOSRM(lat, lng)).then(info=>{
        if(gen !== _impactoGen) return; // hubo recarga: no dibujar líneas viejas
        const sLat = (info && info.snap) ? info.snap[0] : lat;
        const sLng = (info && info.snap) ? info.snap[1] : lng;
        const b = (info && info.bearing != null) ? info.bearing : Math.PI/4;
        dibujarSegmentoVia(sLat, sLng, b, gen, true);
      }).catch(()=>{});
    } else if(clase === 'seguridad') {
      L.circle([lat, lng], { radius:100, ...IMPACTO_SEG }).addTo(zonaImpactoLayer);
    } else if(clase === 'agua') {
      L.circle([lat, lng], { radius:30, ...IMPACTO_AGUA }).addTo(zonaImpactoLayer);
    } else if(clase === 'verde') {
      L.circle([lat, lng], { radius:20, ...IMPACTO_VERDE }).addTo(zonaImpactoLayer);
    } else {
      L.circle([lat, lng], { radius:15, ...IMPACTO_GRAL }).addTo(zonaImpactoLayer);
    }
  }

  // ── Mover reporte ─────────────────────────────────────────────────────────────
  window.__urbisMovingReport = null;

  let _urbisMoveHalo = null;

  function _urbisLimpiarModoMover() {
    document.body.classList.remove('urbis-moving-mode');
    const banner = document.getElementById('urbis-move-banner');
    if(banner) banner.hidden = true;
    try{ if(_urbisMoveHalo) { map.removeLayer(_urbisMoveHalo); _urbisMoveHalo = null; } }catch(e){}
    // Restaura las zonas de impacto ocultadas durante el movimiento.
    try{ if(typeof zonaImpactoLayer !== 'undefined' && !map.hasLayer(zonaImpactoLayer)) map.addLayer(zonaImpactoLayer); }catch(e){}
  }

  function iniciarMoverReporte(oldLat, oldLng) {
    window.__urbisMovingReport = { lat: oldLat, lng: oldLng };
    window.urbisDisableReportMapClick = false;
    // Cierra el popup del marcador para que el siguiente toque en el mapa sea limpio.
    try{ map.closePopup(); }catch(e){}
    // Asegura estar en la pantalla de mapa en móvil.
    try{ if(window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') window.UrbisMobileAppV58.show('map'); }catch(e){}
    // Oculta toda la interfaz: queda solo el mapa + el aviso pedagógico.
    document.body.classList.add('urbis-moving-mode');
    // Oculta las zonas de impacto (radio/línea) para no estorbar al reubicar.
    try{ if(typeof zonaImpactoLayer !== 'undefined' && map.hasLayer(zonaImpactoLayer)) map.removeLayer(zonaImpactoLayer); }catch(e){}
    const banner = document.getElementById('urbis-move-banner');
    if(banner) { banner.hidden = false; }
    // Halo pulsante sobre la gota que se va a mover, para que se vea cuál es.
    try{
      const la = parseFloat(String(oldLat).replace(',', '.')), ln = parseFloat(String(oldLng).replace(',', '.'));
      if(_urbisMoveHalo) { map.removeLayer(_urbisMoveHalo); _urbisMoveHalo = null; }
      _urbisMoveHalo = L.circleMarker([la, ln], { radius:18, color:'#FF6500', weight:3, fillColor:'#FF6500', fillOpacity:.25, className:'urbis-move-halo' }).addTo(map);
      map.setView([la, ln], Math.max(map.getZoom(), 17));
    }catch(e){}
    document.getElementById('detail-content') && (document.getElementById('detail-content').innerHTML = '');
  }

  window.urbisCancelarMoverReporte = function(){
    window.__urbisMovingReport = null;
    _urbisLimpiarModoMover();
  };

  function confirmarMoverReporte(newLat, newLng) {
    const r = window.__urbisMovingReport;
    if(!r) return false;
    window.__urbisMovingReport = null;
    _urbisLimpiarModoMover();
    const sidebar = document.getElementById('sidebar');
    if(sidebar) sidebar.style.opacity = '';
    window.urbisDBUpdate('lat', r.lat, { lat: String(newLat.toFixed(7)), lng: String(newLng.toFixed(7)) }).then(res => {
      if(res && res.ok === false && res.status) throw new Error('HTTP ' + res.status);
      if(typeof playSuccessSound === 'function') playSuccessSound();
      setTimeout(()=>{ try{ cargarPuntos(); }catch(e){} }, 600);
    }).catch(err => alert('Error al mover el reporte: ' + (err && err.message || err)));
    return true;
  }

  function eliminarReporte(lat) {
    if(!confirm('¿Eliminar este reporte? Esta acción no se puede deshacer.')) return;
    const doDelete = (typeof window.urbisBorrarPorLat === 'function')
      ? window.urbisBorrarPorLat(lat)
      : window.urbisDBDelete('lat', String(lat));
    doDelete
      .then(() => {
        const sidebar = document.getElementById('sidebar');
        if(sidebar) sidebar.style.opacity = '';
        const ic = document.getElementById('info-content');
        if(ic) ic.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px;">Reporte eliminado.</p>';
        setTimeout(()=>{ try{ cargarPuntos(); }catch(e){} }, 600);
      }).catch(err => alert('Error al eliminar: ' + err.message));
  }
  window.urbisEliminarReporte = eliminarReporte;
  window.urbisIniciarMoverReporte = iniciarMoverReporte;

  window.urbisAbrirFotoFull = function(src){
    if(!src) return;
    const lb = document.createElement('div');
    lb.className = 'urbis-foto-lightbox';
    lb.innerHTML = `<span class="lb-close">×</span><img src="${src}" alt="Evidencia">`;
    lb.addEventListener('click', ()=> lb.remove());
    document.body.appendChild(lb);
  };

  function crearMarcadorUrbano(lat, lng, dimKey, p) {
    const d = p.descripcion.split(' | ');
    const estadoValidacion = d[BASE_OFFSET + 1] || "Aprobado"; 
    
    const config = dimensiones[dimKey] || { color: "#ffffff", shape: "circle" };
    let marker;
    
    let markerColor = estadoValidacion === "Pendiente" ? "#ff9f43" : config.color; 
    let opacity = estadoValidacion === "Pendiente" ? 0.9 : 1; 

    // Detección PREMIUM robusta: quita acentos con rango unicode explícito (̀-ͯ)
    // y, como respaldo, detecta cualquier EVENTO cuya descripción diga "premium" (así no falla
    // por el acento de "Áurea" ni aunque el item venga distinto).
    const _quitarAc = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    const _itemLow = _quitarAc(d[0]);
    const _descLow = _quitarAc(p.descripcion);
    const esPremium = _itemLow.indexOf('coliseo dorado') !== -1 || _itemLow.indexOf('sol solidario') !== -1
      || _itemLow.indexOf('aurea') !== -1
      || (_itemLow.indexOf('evento') !== -1 && _descLow.indexOf('premium') !== -1);
    const iconoWaze = obtenerIconoWaze(dimKey, d[0]);
    const emojiReporte = obtenerIconoReporte(dimKey, d[0]);
    if (esPremium) {
      // Evento PREMIUM "Evento Áurea": gota dorada (PNG del usuario) que brilla. Si el PNG
      // falla, queda la gota SVG de respaldo detrás.
      // Icono = la gota dorada que el usuario dejó en assets/brand/aurea.png.
      // Si la imagen fallara al cargar, queda como respaldo la gota SVG kawaii (rellenos sólidos)
      // para que NUNCA se vea solo el aura sin icono.
      const _aureaSVG = '<svg viewBox="0 0 48 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">'+
        '<path d="M24 3 C40 22 40 39 24 57 C8 39 8 22 24 3 Z" fill="#F4A300" stroke="#8a5600" stroke-width="1.6"/>'+
        '<path d="M24 7 C33 20 35 33 27 47 C30 36 26 24 22 16 C22.6 12.5 23.2 9.5 24 7 Z" fill="#FFD23F"/>'+
        '<ellipse cx="17.5" cy="22" rx="3.4" ry="8" fill="#ffffff" opacity=".55"/>'+
        '<circle cx="19" cy="36" r="2.2" fill="#7a4d00"/><circle cx="29" cy="36" r="2.2" fill="#7a4d00"/>'+
        '<path d="M19.5 42 Q24 46 28.5 42" stroke="#7a4d00" stroke-width="1.9" fill="none" stroke-linecap="round"/>'+
        '<circle cx="14.5" cy="41" r="2" fill="#ff9bb0" opacity=".5"/><circle cx="33.5" cy="41" r="2" fill="#ff9bb0" opacity=".5"/>'+
      '</svg>';
      const html = `<div class="urbis-aurea" style="position:relative;width:68px;height:68px;display:flex;align-items:center;justify-content:center;">`+
        `<span class="au-ring"></span><span class="au-ring au-ring2"></span><span class="au-glow"></span>`+
        `<img class="au-img" src="assets/brand/aurea.png?v=288" alt="Gota Áurea" style="position:relative;z-index:3;width:56px;height:56px;display:block;object-fit:contain;filter:drop-shadow(0 5px 9px rgba(150,100,0,.5));" onerror="this.onerror=null;this.style.display='none';var s=this.parentNode.querySelector('.au-svg');if(s){s.style.display='block';}">`+
        `<span class="au-svg" style="position:relative;z-index:3;width:50px;height:58px;display:none;filter:drop-shadow(0 5px 9px rgba(150,100,0,.5));">${_aureaSVG}</span>`+
      `</div>`;
      marker = L.marker([lat, lng], { icon: L.divIcon({ className: 'urbis-coliseo-root', html, iconSize:[68,68], iconAnchor:[34,34], popupAnchor:[0,-34] }), zIndexOffset: 2000 });
    } else if (iconoWaze) {
      marker = L.marker([lat, lng], { icon: crearIconoWaze(iconoWaze, dimKey, d[0]) });
    } else {
      marker = L.marker([lat, lng], { icon: crearIconoCategoriaGenerica(config.shape, markerColor, opacity, emojiReporte, dimKey, d[0]) });
    }
    
    let creadorNombre = (d[BASE_OFFSET + 2] || 'Anónimo').split(/\s+/)[0];
    let rolRaw = d[BASE_OFFSET + 3] || "Sistema";
    let likes = parseInt(d[BASE_OFFSET + 4]) || 0;
    let fotoURLPopup = d[BASE_OFFSET];

    const SIN_ESTADO = new Set(['🚨 Alertas y Riesgos Urbanos','🚗 Reportes de Tráfico','Áreas Verdes y Ambiental','Animal y Bienestar']);
    let creadorRol = rolRaw === 'citizen' ? 'Ciudadano' : (rolRaw === 'edu' ? 'Universidad' : (rolRaw === 'gov' ? 'Funcionario/JAC' : 'Administrador'));
    let metaTemporalPopup = obtenerMetaTemporal(p);
    const mostrarEstadoPopup = !SIN_ESTADO.has(p.tipo);
    let tagValidacion = estadoValidacion === "Pendiente" ? "⚠️ Por validar" : (mostrarEstadoPopup ? `Estado: ${d[3] || 'N/A'}` : '');
    if(metaTemporalPopup.temporal) tagValidacion += metaTemporalPopup.archivado ? ' · Archivado' : ` · Expira ${formatearFechaHora(metaTemporalPopup.expira)}`;
    let likeBadge = likes > 0 ? `<span class="badge-like">👍 ${likes}</span>` : '';
    let fotoMiniPopup = (fotoURLPopup && fotoURLPopup !== 'N/A' && fotoURLPopup.trim()) ? `<img class="popup-foto-big" src="${fotoURLPopup}" alt="Evidencia" onclick="window.urbisAbrirFotoFull && window.urbisAbrirFotoFull(this.src)">` : '';
    let descPopup = (d[2] && d[2].trim() && d[2] !== 'N/A') ? `<div class="popup-desc">${d[2]}</div>` : '';

    // Botones de dueño dentro del popup (en móvil el popup ES el detalle visible).
    let popupOwnerBtns = '';
    try {
      if(typeof esAutorDelReporte === 'function' && esAutorDelReporte(p)) {
        popupOwnerBtns = `<div class="popup-owner-actions">
          <button class="po-edit" onclick="window.urbisEditarReporteMovil ? window.urbisEditarReporteMovil('${p.lat}') : (window.prepararEdicion && window.prepararEdicion('${p.lat}'))">✏️ Editar</button>
          <button class="po-move" onclick="window.urbisIniciarMoverReporte && window.urbisIniciarMoverReporte('${p.lat}','${p.lng}')">📍 Mover</button>
          <button class="po-del" onclick="window.eliminarPunto && window.eliminarPunto('${p.lat}')">🗑️ Eliminar</button>
        </div>`;
      }
    } catch(e){}

    // Botón de comentarios (para TODOS: comentar reportes/eventos de otros).
    let nComent = 0;
    try { nComent = (typeof window.urbisContarComentarios === 'function') ? window.urbisContarComentarios(p.lat) : 0; } catch(e){}
    const tituloComent = String(d[1] || d[0] || 'Reporte').replace(/'/g, '’').replace(/"/g, '');
    const popupComentarBtn = `<button class="po-coment" onclick="window.urbisAbrirComentarios && window.urbisAbrirComentarios('${p.lat}', '${tituloComent}')">💬 Comentar${nComent ? ' (' + nComent + ')' : ''}</button>`;

    if (esPremium) {
      const notasP = String(d[2] || '');
      const sacar = (re, def) => { const m = notasP.match(re); return m ? m[1].trim() : def; };
      const premio = sacar(/Premio:\s*([^·|]+)/i, 'Premio sorpresa');
      const detalleP = sacar(/Detalle:\s*([^·|]+)/i, 'Reto de habilidad. El que más puntos haga, gana.');
      let finP = sacar(/termina\s*([^·|]+)/i, '');
      if(!finP){ try{ finP = formatearFechaHora(metaTemporalPopup.expira); }catch(e){} }
      // Cada Evento Áurea tiene su PROPIA tabla de juego (id derivado de su ubicación),
      // separada del minijuego libre. Solo se entra a jugar premium desde esta gota.
      const aureaJuegoId = 'aurea_' + String(p.lat).replace(/[^0-9]/g,'');
      const tituloEsc = String(d[1] || 'Evento Áurea').replace(/'/g, '’').replace(/"/g, '');
      const terminado = !!(metaTemporalPopup && metaTemporalPopup.archivado);
      const premioEsc = String(premio).replace(/'/g, '’').replace(/"/g, '');
      const finEsc = String(finP || '').replace(/'/g, '’').replace(/"/g, '');
      const botonPremium = terminado
        ? `<button class="cp-play cp-aurea" onclick="window.urbisMenuAurea && window.urbisMenuAurea('${aureaJuegoId}','${tituloEsc}','${premioEsc}','${finEsc}',true)">🏆 Ver ranking del evento</button>`
        : `<button class="cp-play cp-aurea" onclick="window.urbisMenuAurea && window.urbisMenuAurea('${aureaJuegoId}','${tituloEsc}','${premioEsc}','${finEsc}',false)">🏆 Entrar al menú de juego premium</button>`;
      // Solo quien creó el evento (o admin/JAC) puede archivarlo: lo saca del mapa
      // para TODOS mientras lo conserva en la línea de tiempo/histórico de URBIS.
      let archivarAureaBtn = '';
      try {
        if(typeof esAutorDelReporte === 'function' && esAutorDelReporte(p)) {
          archivarAureaBtn = `<button class="cp-archivar-aurea" onclick="window.urbisArchivarEventoAurea && window.urbisArchivarEventoAurea('${p.lat}')">📦 Archivar evento</button>`;
        }
      } catch(e){}
      marker.bindPopup(`
        <div class="coliseo-popup">
          <div class="cp-badge">✨ EVENTO ÁUREA · PREMIUM</div>
          <div class="cp-title">${d[1] || 'Evento Áurea'}</div>
          <div class="cp-prize">🏆 El #1 se lleva <b>${premio}</b> <small>(dinero real)</small></div>
          <div class="cp-desc">📜 ${detalleP}</div>
          ${finP ? `<div class="cp-end">${terminado ? '🏁 Evento finalizado' : '⏳ Termina'}: <b>${finP}</b></div>` : ''}
          <div class="cp-note">${terminado ? 'Este evento ya terminó. Mira el ranking final 👇' : 'Solo se compite desde aquí. El ganador será contactado por URBIS (chat/notificación) para enviarle el dinero. 🏦'}</div>
          ${botonPremium}
          <button class="cp-play cp-practica" onclick="window.UrbisMobileAppV58 && window.UrbisMobileAppV58.show('games')">🕹️ Practicar gratis en el arcade</button>
          ${popupComentarBtn}
          ${archivarAureaBtn}
          ${popupOwnerBtns}
        </div>
      `, { maxWidth: 300, minWidth: 250, className: 'urbis-popup urbis-coliseo-popup' });
    } else {
      marker.bindPopup(`
        <div class="popup-header" style="color:${markerColor}">${p.tipo}</div>
        <span class="popup-title">${construirBadgeIcono(p.tipo, d[0], 'popup-icon-badge')}${d[1] || d[0]} ${likeBadge}</span>
        ${fotoMiniPopup}
        ${descPopup}
        ${tagValidacion ? `<span class="popup-state">${tagValidacion}</span>` : ''}
        <div class="popup-author">👤 <b>${creadorNombre}</b></div>
        ${popupComentarBtn}
        ${popupOwnerBtns}
    `, { maxWidth: 280, minWidth: 230, className: 'urbis-popup' });
    }
    
    marker.on('click', function(e) {
      // En modo Mover, tocar cualquier marcador reubica aquí (no abre su popup).
      if(window.__urbisMovingReport) { L.DomEvent.stopPropagation(e); confirmarMoverReporte(e.latlng.lat, e.latlng.lng); return; }
      L.DomEvent.stopPropagation(e); if(tempMarker) { map.removeLayer(tempMarker); tempMarker = null; } mostrarDetalles(p);
    });
    // Solo los reportes ciudadanos temporales (alertas, vías, seguridad...) tienen
    // zona de impacto. El auto-mapeo comercial/usos NO, para no inundar el mapa.
    try { if(obtenerMetaTemporal(p).temporal) dibujarZonaImpacto(lat, lng, p.tipo, d[0]); } catch(e){}
    return marker;
  }
  // Exponer para el renderizador FORZADO de la gota Áurea (capa propia siempre visible).
  window.urbisCrearMarcadorUrbano = crearMarcadorUrbano;

  function mostrarDetalles(p) {
    if(typeof setSidebarTab === 'function') setSidebarTab('alerts');
    let d = p.descripcion.split(' | ');
    let stClass = d[3] === "Bueno" ? "st-bueno" : (d[3] === "Regular" ? "st-regular" : "st-malo");
    let dimColor = dimensiones[p.tipo] ? dimensiones[p.tipo].color : "var(--cyan)";
    
    const SIN_ESTADO_DET = new Set(['🚨 Alertas y Riesgos Urbanos','🚗 Reportes de Tráfico','Áreas Verdes y Ambiental','Animal y Bienestar']);
    const mostrarEstadoDet = !SIN_ESTADO_DET.has(p.tipo);
    let fotoURL = d[BASE_OFFSET];
    let estadoValidacion = d[BASE_OFFSET + 1] || "Aprobado";
    let creadorNombre = (d[BASE_OFFSET + 2] || 'Anónimo').split(/\s+/)[0];
    let rolRaw = d[BASE_OFFSET + 3] || "Sistema";
    let likes = parseInt(d[BASE_OFFSET + 4]) || 0;
    
    let correoVal = d[BASE_OFFSET + 5] || "No registrado";
    let cedulaVal = d[BASE_OFFSET + 6] || "No registrada";
    let barrioVal = d[BASE_OFFSET + 7] || "No registrado";
    
    let creadorRol = rolRaw === 'citizen' ? 'Ciudadano' : (rolRaw === 'edu' ? 'Universidad' : (rolRaw === 'gov' ? 'Funcionario/JAC' : 'Administrador'));

    document.getElementById('dashboard-section').style.display = 'none'; 
    
    let fotoHTML = (fotoURL && fotoURL !== "N/A" && fotoURL.trim() !== "")
      ? `<figure class="foto-evidencia" onclick="window.urbisAbrirFotoFull && window.urbisAbrirFotoFull(this.querySelector('img').src)">
           <img src="${fotoURL}" class="foto-preview-big" alt="Evidencia">
           <figcaption>📷 Toca para ampliar</figcaption>
         </figure>`
      : '';

    let usosActivosHTML = '';
    for(let j=0; j<todosLosUsos.length; j++) {
        if(d[6+j] === "SI") { usosActivosHTML += `<div class="usage-item" style="background:var(--cyan); border-color:var(--cyan); color:#000; font-weight:bold;">✅ ${todosLosUsos[j]}</div>`; }
    }
    
    // Simplificación de vista para el ciudadano al ver los detalles
    let seccionUsosDisplay = (usosActivosHTML === '') ? 'none' : 'block';

    let alertaValidacionHTML = estadoValidacion === "Pendiente" 
        ? `<div class="alert-validacion">⚠️ ESTE REPORTE AÚN ESTÁ POR VALIDARSE POR EL ADMINISTRADOR</div>` 
        : '';
        
    let likeButtonText = likes > 0 ? `👍 APOYAR ESTE REPORTE (${likes})` : `👍 APOYAR ESTE REPORTE`;

    let botonesHTML = `
        <button class="btn-edit" style="background:#b8ebe6;color:#000;" onclick="iniciarRutaHacia('${p.lat}', '${p.lng}')">🧭 IR A ESTE PUNTO</button>
        <div class="u52-report-validate-actions">
          <button onclick="validarReporteCiudadano('${p.lat}', 'confirm', this)">✅ Confirmar</button>
          <button onclick="validarReporteCiudadano('${p.lat}', 'ongoing', this)">🔄 Sigue ocurriendo</button>
          <button onclick="validarReporteCiudadano('${p.lat}', 'gone', this)">👌 Ya no está</button>
          <button onclick="validarReporteCiudadano('${p.lat}', 'wrong', this)">🚩 Información incorrecta</button>
        </div>
        <button class="btn-like" onclick="darLike('${p.lat}', this)">${likeButtonText}</button>
        <button class="btn-cancelar" onclick="cancelarRegistro()">VOLVER AL MAPA</button>
    `;

    const _rolEf = (typeof window !== 'undefined' && window.userRole) ? window.userRole : userRole;
    if (_rolEf !== 'admin' && _rolEf !== 'gov' && puedeGestionarReporte(p)) {
        botonesHTML = `
            <div class="owner-actions">
                <small>Este reporte fue creado por ti.</small>
                <div class="owner-actions-btns">
                  <button class="btn-owner-edit" onclick="prepararEdicion('${p.lat}')">✏️ Editar</button>
                  <button class="btn-owner-move" onclick="window.urbisIniciarMoverReporte('${p.lat}','${p.lng}')">📍 Mover</button>
                  <button class="btn-owner-del" onclick="eliminarPunto('${p.lat}')">🗑️ Eliminar</button>
                </div>
            </div>
        ` + botonesHTML;
    }
    
    let datosPrivadosHTML = ``;
    if (_rolEf === 'admin' || _rolEf === 'gov') {
        datosPrivadosHTML = `
        <div class="private-data">
            🔒 Datos de Registro (Solo Admin):<br>
            Cédula: ${cedulaVal} | Correo: ${correoVal}
        </div>`;
        
        if(estadoValidacion === "Pendiente") {
            botonesHTML = `<button class="btn-approve" onclick="aprobarPunto('${p.lat}', this)">✅ APROBAR REPORTE</button>` + botonesHTML;
        }
        botonesHTML = `
            <div class="owner-actions-btns" style="margin-bottom:6px;">
              <button class="btn-owner-edit" onclick="prepararEdicion('${p.lat}')">✏️ Editar</button>
              <button class="btn-owner-move" onclick="window.urbisIniciarMoverReporte('${p.lat}','${p.lng}')">📍 Mover</button>
              <button class="btn-owner-del" onclick="eliminarPunto('${p.lat}')">🗑️ Eliminar</button>
            </div>
        ` + botonesHTML;
    }

    let tituloEstado = estadoValidacion === "Pendiente" ? `<span class="status-tag st-pendiente">EN REVISIÓN</span>` : (mostrarEstadoDet ? `<span class="status-tag ${stClass}">${d[3] || 'N/A'}</span>` : '');
    let popularBadge = likes >= 5 ? `<span class="badge-like" style="background:var(--fuchsia); color:white; box-shadow:0 0 8px var(--fuchsia);">🔥 Reporte Comunitario Popular</span>` : '';
    let ownerBadge = etiquetaPropietarioReporte(p);
    let metaTemporalDetalle = obtenerMetaTemporal(p);
    function tiempoRelativo(fecha){ if(!fecha) return ''; const ms=Date.now()-new Date(fecha).getTime(); if(isNaN(ms)||ms<0) return ''; const mins=Math.floor(ms/60000); if(mins<1) return 'Hace un momento'; if(mins<60) return `Hace ${mins} min`; const hrs=Math.floor(mins/60); if(hrs<24) return `Hace ${hrs}h`; const days=Math.floor(hrs/24); return `Hace ${days} día${days>1?'s':''}`; }
    let iconoDetalleHTML = construirBadgeIcono(p.tipo, d[0], 'detail-icon-badge');
    const _trCreado = tiempoRelativo(metaTemporalDetalle.creado);
    const _trLabel = _trCreado ? ` <span style="font-size:.7rem;color:#00b89e;font-weight:700;">(${_trCreado})</span>` : '';
    let temporalHTML = metaTemporalDetalle.temporal ? `<div style="margin-top:8px;"><span class="ttl-pill ${metaTemporalDetalle.archivado ? 'ttl-archived' : 'ttl-active'}">${metaTemporalDetalle.archivado ? 'ARCHIVADO' : 'TEMPORAL ACTIVO'}</span><span style="font-size:.72rem;color:#aeb6c2;"> Creado: ${formatearFechaHora(metaTemporalDetalle.creado)}${_trLabel} · Expira: ${formatearFechaHora(metaTemporalDetalle.expira)}</span></div>` : `<div style="margin-top:8px;"><span class="ttl-pill ttl-active">PERMANENTE</span><span style="font-size:.72rem;color:#aeb6c2;"> Creado: ${formatearFechaHora(metaTemporalDetalle.creado)}${_trLabel}</span></div>`;

    document.getElementById('info-content').innerHTML = `
      <div class="header-identificador" style="border-left-color: ${dimColor}; color: ${dimColor}; display:flex; align-items:center; gap:8px;">${iconoDetalleHTML}<span>${d[1] || d[0]}</span> ${tituloEstado}</div>
      <div class="form-section">
        
        ${alertaValidacionHTML}
        
        <div class="alert-autor">
            <span style="font-size:0.7rem; color:#aaa;">👤 AUTOR DEL REPORTE:</span><br>
            <b style="color:#fff;">${creadorNombre}</b> <span style="font-size:0.7rem; color:var(--cyan);">(${creadorRol})</span><br>
            <span style="font-size:0.75rem; color:#ccc;">📍 Barrio: ${barrioVal}</span>
            <div style="margin-top:5px;">${popularBadge} ${ownerBadge}</div>
            ${temporalHTML}
            ${datosPrivadosHTML}
        </div>

        <label style="font-size:0.7rem; color:var(--cyan);">CLASIFICACIÓN TÉCNICA:</label>
        <div style="color:#fff; font-weight:bold; font-size:1.1rem; display:flex; align-items:center; gap:8px;">${construirBadgeIcono(p.tipo, d[0])}<span>${p.tipo} - ${d[0]}</span></div>
        <p style="font-size:0.9rem; color:#ccc; margin-top:10px; background:#1a1a1a; padding:10px; border-radius:4px; border-left: 3px solid var(--cyan);">${d[2] || 'Sin notas.'}</p>
        
        ${fotoHTML}

        <div style="display:${seccionUsosDisplay};">
            <hr style="border-color:#444; margin-top: 15px;">
            <label style="font-size:0.7rem; color:var(--cyan); display:block; margin-bottom:5px;">USOS ACTIVOS EN LA MATRIZ:</label>
            <div class="usage-grid" style="margin-bottom: 15px;">${usosActivosHTML}</div>
        </div>
        
        ${botonesHTML}
      </div>`;
  }

  window.cancelarRegistro = function() {
    if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
    try{ if(typeof window.urbisCerrarEdicionOverlay === 'function') window.urbisCerrarEdicionOverlay(); }catch(e){}
    _urbisCategoriaPendiente = null;
    construirSelectorCategorias(null, null);
    document.getElementById('dashboard-section').style.display = 'block';
  };

  // Escapa un texto para insertarlo dentro de un atributo onclick="...('texto')".
  function _escJsAttr(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

  // Categoría/alerta elegida desde CUALQUIERA de los dos paneles (Alertas o
  // Mapeo Técnico) ANTES de tocar el mapa: flujo "elijo qué quiero reportar ->
  // toco el mapa para ubicarlo". Se guarda junto con su origen para saber en
  // qué panel mostrar el banner/cancelar. null = sin selección pendiente.
  let _urbisCategoriaPendiente = null; // { dim, label?, origen: 'alerts' | 'tecnico' }

  // Construye el panel de ALERTAS leyendo el MISMO catálogo que usa Android
  // (window.URBIS_QUICK_REPORT_SECTIONS, definido en js/20). Vínculo Android↔PC
  // pedido explícito: una sola fuente de datos e iconos — si se agrega o quita
  // una alerta ahí, se agrega o quita en las dos plataformas, sin excepción.
  // Mapeo Técnico ya NO vive aquí — es su propio módulo en el sidebar.
  // Si aún no hay lat/lng (el usuario solo abrió la pestaña, no ha tocado el
  // mapa), las tarjetas quedan en modo "elegir primero" y arman la ubicación
  // en el siguiente clic sobre el mapa.
  function construirSelectorCategorias(lat, lng) {
    const tieneUbicacion = lat != null && lng != null;
    let subtitulo = userRole === 'admin' ? '(Modo Arquitecto)' : (userRole === 'edu' ? '(Universidad)' : '(Ciudadano)');
    const pendienteAqui = _urbisCategoriaPendiente && _urbisCategoriaPendiente.origen === 'alerts' ? _urbisCategoriaPendiente : null;

    let banner = tieneUbicacion
      ? `<h3>📍 Nuevo Registro ${subtitulo}</h3>`
      : (pendienteAqui
          ? `<div class="cats-pending-banner">📍 Toca el mapa para ubicar tu <b>${pendienteAqui.label}</b><button class="cats-pending-cancel" onclick="window.urbisCancelarSeleccionCategoria()">✕ Cancelar</button></div>`
          : `<h3>📍 Reportar en el mapa ${subtitulo}</h3><p style="color:#aaa; font-size:0.82rem; margin-top:-6px;">Elige qué quieres reportar. Luego toca el mapa para ubicarlo. (Mismo catálogo que en Android)</p>`);

    const secciones = window.URBIS_QUICK_REPORT_SECTIONS || [];
    let html = banner;

    secciones.forEach(sec => {
        html += `<div class="urbis-alert-section">
            <div class="urbis-alert-section-head"><span>${sec.icon}</span><b>${sec.label}</b></div>`;
        if(sec.hint) {
            html += sec.sensitive
              ? `<div class="urbis-alert-privacy">${sec.hint}</div>`
              : `<p class="urbis-alert-section-hint">${sec.hint}</p>`;
        }
        html += `<div class="cats-container">`;
        sec.items.forEach(([id, icon, label, dim]) => {
            const accion = tieneUbicacion
              ? `window.urbisAbrirFormularioAlerta('${_escJsAttr(dim)}', '${_escJsAttr(label)}', ${lat}, ${lng})`
              : `window.urbisElegirCategoriaSinUbicacion('${_escJsAttr(dim)}','alerts','${_escJsAttr(label)}')`;
            html += `<div class="cat-card card-alert" style="border-left: 5px solid #ff4757;" onclick="${accion}">
                <div class="cat-icon-emoji">${icon}</div>
                <div><div class="cat-title" style="color:#ff4757;">${label}</div></div>
            </div>`;
        });
        html += `</div></div>`;
    });

    if(tieneUbicacion) html += `<button class="btn-cancelar" onclick="cancelarRegistro()">❌ CANCELAR</button>`;

    document.getElementById('info-content').innerHTML = html;
  }
  window.urbisConstruirSelectorCategorias = construirSelectorCategorias;

  // Abre el formulario estándar de escritorio (formPaso2) pero con el ítem
  // específico YA preseleccionado (ej. "Área preventiva"), igual que Android
  // preselecciona su tarjeta elegida — en vez del dropdown genérico con TODOS
  // los ítems de la dimensión.
  window.urbisAbrirFormularioAlerta = function(dim, label, lat, lng) {
    formPaso2(dim, lat, lng);
    const sel = document.getElementById('sel-item');
    if(sel) sel.value = label;
  };

  // Construye el panel de MAPEO TÉCNICO: la matriz de usos completa (todas
  // las categorías de `dimensiones`), ahora como módulo propio en el sidebar
  // (antes vivía escondido dentro de Alertas, solo para admin/edu).
  function construirSelectorTecnico(lat, lng) {
    const tieneUbicacion = lat != null && lng != null;
    const pendienteAqui = _urbisCategoriaPendiente && _urbisCategoriaPendiente.origen === 'tecnico' ? _urbisCategoriaPendiente : null;

    let banner = tieneUbicacion
      ? `<h3>🧩 Mapeo Técnico — Nuevo Registro</h3>`
      : (pendienteAqui
          ? `<div class="cats-pending-banner">📍 Toca el mapa para ubicar tu <b>${pendienteAqui.dim}</b><button class="cats-pending-cancel" onclick="window.urbisCancelarSeleccionCategoria()">✕ Cancelar</button></div>`
          : `<h3>🧩 Mapeo Técnico</h3><p style="color:#aaa; font-size:0.82rem; margin-top:-6px;">Matriz de usos completa. Elige una capa urbana y toca el mapa para ubicarla.</p>`);

    let html = `${banner}
        <div class="cats-container">`;

    Object.keys(dimensiones).forEach(dk => {
        let dim = dimensiones[dk];
        let accion = tieneUbicacion ? `formPaso2('${dk}', ${lat}, ${lng})` : `window.urbisElegirCategoriaSinUbicacion('${dk}','tecnico')`;
        html += `<div class="cat-card" style="border-left: 5px solid ${dim.color};" onclick="${accion}">
            <div class="cat-icon">${construirBadgeIcono(dk, dim.items && dim.items[0] ? dim.items[0] : dk)}</div>
            <div><div class="cat-title">${dk}</div><div class="cat-desc">${dim.desc}</div></div>
        </div>`;
    });

    html += `</div>`;
    if(tieneUbicacion) html += `<button class="btn-cancelar" onclick="cancelarRegistro()">❌ CANCELAR</button>`;

    document.getElementById('info-content-tecnico').innerHTML = html;
  }
  window.urbisConstruirSelectorTecnico = construirSelectorTecnico;

  // Ambas pestañas SIEMPRE muestran su selector, aunque no se haya tocado el
  // mapa (antes Alertas salía vacía con un simple "toca el mapa...", y Mapeo
  // Técnico ni siquiera existía como módulo propio).
  window.urbisRenderSelectorCategorias = function() {
    const ic = document.getElementById('info-content');
    if(!ic) return;
    if(ic.querySelector('.form-section')) return; // no pisar un formulario ya abierto
    construirSelectorCategorias(null, null);
  };
  window.urbisRenderSelectorTecnico = function() {
    const ic = document.getElementById('info-content-tecnico');
    if(!ic) return;
    construirSelectorTecnico(null, null);
  };

  // El usuario eligió una categoría/alerta SIN haber tocado el mapa todavía:
  // queda pendiente (con su panel de origen) y el próximo clic en el mapa la
  // ubica. `label` solo aplica al flujo de Alertas (alerta específica del
  // catálogo unificado); Mapeo Técnico sigue eligiendo la dimensión completa.
  window.urbisElegirCategoriaSinUbicacion = function(dim, origen, label) {
    _urbisCategoriaPendiente = { dim, label, origen: origen || 'alerts' };
    if(origen === 'tecnico') construirSelectorTecnico(null, null);
    else construirSelectorCategorias(null, null);
  };
  window.urbisCancelarSeleccionCategoria = function() {
    const origen = _urbisCategoriaPendiente && _urbisCategoriaPendiente.origen;
    _urbisCategoriaPendiente = null;
    if(origen === 'tecnico') construirSelectorTecnico(null, null);
    else construirSelectorCategorias(null, null);
  };

  // PESTAÑAS INTELIGENTES Y EFECTO GOTA
  map.on('click', function(e) {
    // Mover reporte: PRIMERO, antes de cualquier guard, porque es una acción
    // explícita del usuario y no debe tragarse por otros modos.
    if(window.__urbisMovingReport) { confirmarMoverReporte(e.latlng.lat, e.latlng.lng); return; }
    // V96: no bloquear el mapa en Movilidad; permitir reportes y selección normal.
    if (window.urbisMobilityDestinationOnly || window.urbisDisableReportMapClick) {
      return;
    }
    if(window.__urbisSuppressNormalMapClickUntil && Date.now() < window.__urbisSuppressNormalMapClickUntil) return;
    if(routeRealAutoDestino) { manejarClickDestinoRutaReal(e.latlng); return; }
    if(modoUbicacionEvento) { manejarClickUbicacionEvento(e.latlng); return; }
    if(modoRutaManual) { manejarClickRuta(e.latlng); return; }
    playDropSound();

    let lat = e.latlng.lat.toFixed(7), lng = e.latlng.lng.toFixed(7);
    mostrarPopupLlegarAqui(lat, lng);
    // setSidebarTab('alerts') dispara un auto-render diferido (setTimeout) del
    // selector SIN ubicación, pensado para cuando el usuario abre la pestaña a
    // mano. Aquí el click YA va a construir la vista CON ubicación un poco más
    // abajo — sin esta bandera, ese auto-render llega después y la pisa con la
    // versión sin coordenadas (carrera de renders).
    window.__urbisSkipAlertsAutoRender = true;
    setSidebarTab('alerts');
    if (tempMarker) { map.removeLayer(tempMarker); }
    tempMarker = L.marker([lat, lng], { icon: L.divIcon({ className: 'temp-marker', html: '<div class="pulse-ring"></div><div class="pulse-dot"></div>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(map);

    document.getElementById('dashboard-section').style.display = 'none';

    // Ya había una categoría/alerta elegida desde Alertas o Mapeo Técnico (sin
    // ubicación): saltar directo al formulario con este punto, sin volver a
    // mostrar la lista. El formulario siempre se abre en el panel de Alertas
    // (única implementación de formPaso2), así que el tab ya cambió arriba.
    if(_urbisCategoriaPendiente) {
        const { dim, label } = _urbisCategoriaPendiente;
        _urbisCategoriaPendiente = null;
        if(label) window.urbisAbrirFormularioAlerta(dim, label, lat, lng);
        else formPaso2(dim, lat, lng);
        return;
    }

    construirSelectorCategorias(lat, lng);
  });


  // Selección de destino por presión larga.
  // Mantener presionado 2 segundos inicia el flujo limpio de movilidad.
  // Un toque/click corto sigue funcionando para reportes normales.
  (function configurarDestinoPorPresionLarga() {
    let longPressTimer = null;
    let longPressLatLng = null;
    const LONG_PRESS_MS = 2000;

    function puedeIniciarDestinoPorPresionLarga() {
      if(typeof advancedDrawMode !== 'undefined' && advancedDrawMode) return false;
      if(typeof modoUbicacionEvento !== 'undefined' && modoUbicacionEvento) return false;
      if(typeof modoRutaManual !== 'undefined' && modoRutaManual) return false;
      if(typeof routeRealAutoDestino !== 'undefined' && routeRealAutoDestino) return false;
      return true;
    }

    function cancelarPresionLarga() {
      if(longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressLatLng = null;
    }

    function iniciarTemporizadorDestino(e) {
      if(!puedeIniciarDestinoPorPresionLarga()) return;
      cancelarPresionLarga();
      longPressLatLng = e.latlng;
      longPressTimer = setTimeout(() => {
        if(!longPressLatLng || !puedeIniciarDestinoPorPresionLarga()) return;
        window.__urbisSuppressNormalMapClickUntil = Date.now() + 900;
        try { map.closePopup(); } catch(err) {}
        if(typeof playSuccessSound === 'function') playSuccessSound();
        if(typeof iniciarRutaRapidaAqui === 'function') {
          iniciarRutaRapidaAqui(longPressLatLng.lat, longPressLatLng.lng);
        }
        cancelarPresionLarga();
      }, LONG_PRESS_MS);
    }

    map.on('mousedown', iniciarTemporizadorDestino);
    map.on('touchstart', iniciarTemporizadorDestino);
    map.on('mouseup mouseout dragstart zoomstart touchend touchcancel', cancelarPresionLarga);
  })();
