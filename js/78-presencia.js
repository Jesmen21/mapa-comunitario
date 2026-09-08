/* URBIS · PRESENCIA: DÓNDE ESTÁN MIS AMIGOS (js/78)
   ─────────────────────────────────────────────────────────────────────────
   Hasta la v811 la ubicación de los amigos era un subproducto del sistema
   de reportes: una fila «ubicacion_<usuario>» en la misma hoja, escrita en
   SILENCIO cada 45 segundos por un «radar» que arrancaba con cualquier
   pantalla de mapa, y pintada para TODOS los usuarios que alguna vez
   compartieron —amigos o no— con la última fila que hubiera, aunque tuviera
   73 días. Ni consentimiento, ni frescura, ni precisión.

   Esto lo reemplaza. Tres reglas, y las tres están acá y no repartidas:

   1. NADIE comparte sin haberlo pedido. Compartir es un interruptor con
      duración (una hora, ocho, un día, hasta apagarlo), y apagarlo deja
      escrito que se apagó. Sin interruptor encendido, este módulo no toca
      el GPS ni escribe una fila.

   2. Solo se ve a los AMIGOS MUTUOS que están compartiendo AHORA: fila en
      «on» y de hace menos de 24 horas. Lo demás no se pinta: se lista con
      su motivo («dejó de compartir», «sin ubicación reciente»), que es
      distinto de esconderlo.

   3. La posición se muestra con lo que el GPS dijo de ella: la precisión
      en metros como un círculo, y hace cuánto. Una posición sin su
      antigüedad se lee como presente, y eso es mentir con un punto.

   La fila sigue siendo la misma (tipo «ubicacion_<usuario>», una por
   persona, actualizada por tipo) para no tocar el servidor: cambia lo que
   va en `descripcion` —usuario~~~precisión~~~estado— y quién la lee. Las
   filas viejas, con solo el usuario, se siguen leyendo.               */
(function () {
  'use strict';

  var CLAVE = 'urbis_presencia_v1';
  var VIVO_MS = 5 * 60000, RECIENTE_MS = 60 * 60000, VISIBLE_MS = 24 * 3600000;
  // Cuándo vale la pena escribir otra vez: se movió lo suficiente para que
  // el punto cambie de cuadra, o pasó tiempo suficiente para que «hace 2
  // min» se vuelva «hace 5». Nunca dos escrituras en menos de 20 s: el
  // servidor es una hoja de cálculo, no un socket.
  var MIN_METROS = 20, MAX_SIN_ESCRIBIR_MS = 90000, MIN_ENTRE_ESCRITURAS_MS = 20000;
  var REFRESCO_MS = 45000;

  /* Dependencias por nombre, para poder probar el módulo sin la aplicación
     entera. En producción todas salen de `window`. */
  var dep = {
    ahora: function () { return Date.now(); },
    mapa: function () { return window.map; },
    L: function () { return window.L; },
    usuario: function () { return (window.urbisUsuarioActual && window.urbisUsuarioActual()) || ''; },
    filas: function () { return window.urbisUbicaciones || []; },
    relaciones: function () { return window.urbisRelaciones || []; },
    amigosServidor: function () { return window.urbisAmigosFromServer || null; },
    avatarDe: function (u) {
      var k = String(u || '').toLowerCase(), id = '';
      try { var fa = (window._urbisAmigosMap || {})[k]; if (fa && fa.avatar) id = String(fa.avatar).trim(); } catch (e) {}
      if (!id) { var row = (window.urbisAvatares || []).find(function (p) { return String(p.lng || '').toLowerCase() === k; }); if (row) id = String(row.descripcion || '').trim(); }
      return /^avatar[-_][a-z0-9-]+$/i.test(id) ? 'assets/avatars/' + id + '.png' : '';
    },
    actualizar: function (tipo, campos) { return window.urbisDBUpdate('tipo', tipo, campos); },
    crear: function (fila) { return window.urbisGuardarFila(fila); },
    leerTodo: function () { return window.urbisDBRead ? window.urbisDBRead({ forzar: true }) : Promise.resolve([]); },
    geo: function () { return navigator.geolocation; },
    guardar: function (v) { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch (e) {} },
    cargar: function () { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } }
  };
  function configurar(d) { Object.keys(d || {}).forEach(function (k) { dep[k] = d[k]; }); }

  // ── Leer una fila ─────────────────────────────────────────────────────
  function partes(s) { return String(s || '').split(/Â?§|~~~/); }
  function leerFila(f) {
    if (!f) return null;
    var p = partes(f.descripcion);
    var usuario = (p[0] || '').trim().toLowerCase();
    if (!usuario) return null;
    var lat = parseFloat(String(f.lat || '').replace(',', '.')), lng = parseFloat(String(f.lng || '').replace(',', '.'));
    var t = new Date(f.fecha || 0).getTime();
    return {
      usuario: usuario, lat: lat, lng: lng,
      acc: Math.max(0, parseInt(p[1], 10) || 0),
      estado: (p[2] || 'on').trim().toLowerCase() === 'off' ? 'off' : 'on',
      fecha: f.fecha || '', ms: isNaN(t) ? Infinity : Math.max(0, dep.ahora() - t),
      valida: isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0)
    };
  }
  function frescura(ms) {
    return ms < VIVO_MS ? 'vivo' : ms < RECIENTE_MS ? 'reciente' : ms < VISIBLE_MS ? 'viejo' : 'nada';
  }
  function haceCuanto(ms) {
    if (!isFinite(ms)) return 'sin datos';
    var m = Math.floor(ms / 60000);
    if (m < 1) return 'hace un momento';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.floor(m / 60); if (h < 24) return 'hace ' + h + ' h';
    var d = Math.floor(h / 24); return 'hace ' + d + (d === 1 ? ' día' : ' días');
  }
  /* La mejor fila por usuario: la más reciente. */
  function ultimaPorUsuario() {
    var out = {};
    dep.filas().forEach(function (f) {
      var r = leerFila(f);
      if (!r) return;
      if (!out[r.usuario] || r.ms < out[r.usuario].ms) out[r.usuario] = r;
    });
    return out;
  }

  // ── Quiénes son mis amigos (mutuos) ───────────────────────────────────
  // La misma regla que la lista de contactos: los dos lados tienen que
  // tener la relación. Se prefiere la lista del servidor si llegó.
  function amigos() {
    var yo = String(dep.usuario() || '').toLowerCase();
    var srv = dep.amigosServidor();
    if (Array.isArray(srv) && srv.length) {
      return srv.map(function (f) { return String(f.usuario || '').toLowerCase(); }).filter(function (u) { return u && u !== 'sin_usuario' && u !== yo; });
    }
    var mios = {}, dev = {};
    dep.relaciones().forEach(function (r) {
      var p = partes(r.descripcion);
      var d = (p[0] || '').trim().toLowerCase(), c = (p[1] || '').trim().toLowerCase();
      if (d === yo && c && c !== 'sin_usuario') mios[c] = true;
      if (c === yo && d) dev[d] = true;
    });
    return Object.keys(mios).filter(function (k) { return dev[k]; });
  }

  /* Lo que se ve y lo que no, con su motivo. */
  function amigosUbicados() {
    var ult = ultimaPorUsuario();
    return amigos().map(function (u) {
      var r = ult[u];
      var motivo = !r ? 'nunca compartió' : r.estado === 'off' ? 'dejó de compartir' : !r.valida ? 'posición inválida'
                 : frescura(r.ms) === 'nada' ? 'sin ubicación reciente (' + haceCuanto(r.ms) + ')' : '';
      return { usuario: u, fila: r || null, visible: !motivo, motivo: motivo, frescura: r ? frescura(r.ms) : 'nada' };
    }).sort(function (a, b) { return (b.visible - a.visible) || ((a.fila ? a.fila.ms : Infinity) - (b.fila ? b.fila.ms : Infinity)); });
  }

  // ── La capa ──────────────────────────────────────────────────────────
  var capa = null, marcas = {}, timer = null, chip = null, activa = false;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function distanciaM(a, b) {
    var R = 6371000, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    var x = Math.sin(dLat / 2), y = Math.sin(dLng / 2);
    var h = x * x + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * y * y;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function miPosicion() {
    if (compartiendo.ultimaPos) return compartiendo.ultimaPos;
    var yo = String(dep.usuario() || '').toLowerCase(), r = ultimaPorUsuario()[yo];
    return r && r.valida && frescura(r.ms) !== 'nada' ? { lat: r.lat, lng: r.lng } : null;
  }
  function popupDe(a) {
    var r = a.fila, mi = miPosicion();
    var dist = mi ? distanciaM(mi, r) : null;
    return '<div class="urb-pres-pop"><b>@' + esc(a.usuario) + '</b>' +
      '<span class="f-' + a.frescura + '">' + (a.frescura === 'vivo' ? '🟢 en línea · ' : '') + esc(haceCuanto(r.ms)) + '</span>' +
      (r.acc ? '<small>precisión ±' + r.acc + ' m</small>' : '<small>precisión no reportada</small>') +
      (dist != null ? '<small>a ' + (dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m') + ' de ti</small>' : '') +
      '<a href="https://www.google.com/maps/dir/?api=1&destination=' + r.lat.toFixed(6) + ',' + r.lng.toFixed(6) + '" target="_blank" rel="noopener">Cómo llegar</a>' +
      '</div>';
  }
  function iconoDe(a) {
    var L = dep.L(), src = dep.avatarDe(a.usuario);
    var ini = (a.usuario[0] || '?').toUpperCase();
    return L.divIcon({
      className: '',
      html: '<div class="urb-pres-marca f-' + a.frescura + '" title="@' + esc(a.usuario) + '">' +
        (src ? '<img src="' + src + '" alt="" onerror="this.parentNode.textContent=\'' + ini + '\'">' : '<span>' + ini + '</span>') +
        '</div>',
      iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -20]
    });
  }
  function pintar() {
    var L = dep.L(), m = dep.mapa();
    if (!L || !m) return [];
    if (!capa) capa = L.layerGroup().addTo(m); else capa.clearLayers();
    marcas = {};
    var lista = amigosUbicados();
    lista.filter(function (a) { return a.visible; }).forEach(function (a) {
      var r = a.fila;
      if (r.acc > 0 && L.circle) {
        L.circle([r.lat, r.lng], { radius: r.acc, color: '#0e7490', weight: 1, opacity: .5, fillColor: '#22d3ee', fillOpacity: .12, interactive: false, className: 'urb-pres-precision' }).addTo(capa);
      }
      var mk = L.marker([r.lat, r.lng], { icon: iconoDe(a), zIndexOffset: 800 }).addTo(capa);
      if (mk.bindPopup) mk.bindPopup(popupDe(a), { className: 'urb-pres-popup' });
      marcas[a.usuario] = mk;
    });
    pintarChip(lista);
    return lista;
  }
  function pintarChip(lista) {
    var m = dep.mapa(), cont = m && m.getContainer ? m.getContainer() : null;
    if (!cont) return;
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'urbis-presencia-chip';
      chip.className = 'urb-pres-chip';
      cont.appendChild(chip);
      chip.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.accion === 'quitar') quitar();
        if (b.dataset.accion === 'ir' && marcas[b.dataset.u]) { try { m.setView(marcas[b.dataset.u].getLatLng(), Math.max(m.getZoom(), 16)); marcas[b.dataset.u].openPopup(); } catch (e) {} }
      });
      try { var L = dep.L(); if (L && L.DomEvent) { L.DomEvent.disableClickPropagation(chip); L.DomEvent.disableScrollPropagation(chip); } } catch (e) {}
    }
    var vis = lista.filter(function (a) { return a.visible; }), no = lista.filter(function (a) { return !a.visible; });
    chip.innerHTML = '<div class="urb-pres-chip-cab"><b>👥 ' + (vis.length ? vis.length + (vis.length === 1 ? ' amigo en el mapa' : ' amigos en el mapa') : 'Ningún amigo compartiendo ahora') + '</b>' +
      '<button type="button" data-accion="quitar" aria-label="Cerrar">✕</button></div>' +
      (vis.length ? '<ul>' + vis.map(function (a) {
        return '<li><button type="button" data-accion="ir" data-u="' + esc(a.usuario) + '"><i class="f-' + a.frescura + '"></i>@' + esc(a.usuario) + ' <small>' + esc(haceCuanto(a.fila.ms)) + '</small></button></li>';
      }).join('') + '</ul>' : '') +
      (no.length ? '<p>' + no.slice(0, 4).map(function (a) { return '@' + esc(a.usuario) + ': ' + esc(a.motivo); }).join(' · ') + (no.length > 4 ? ' …' : '') + '</p>' : '') +
      (!amigos().length ? '<p>Todavía no tienes amigos mutuos en URBIS.</p>' : '') +
      (!compartiendo.activo ? '<p class="urb-pres-yo">Tú no estás compartiendo. Se enciende en Amigos › Compartir mi ubicación.</p>' : '');
    chip.hidden = false;
  }
  function refrescar() {
    return Promise.resolve(dep.leerTodo()).then(function (rows) {
      var arr = Array.isArray(rows) ? rows : [];
      if (arr.length) {
        window.urbisUbicaciones = arr.filter(function (p) { return String((p && p.tipo) || '').toLowerCase().indexOf('ubicacion') !== -1; });
      }
      if (activa) pintar();
    }).catch(function () {});
  }
  function ver(opciones) {
    var o = opciones || {};
    activa = true;
    var lista = pintar();
    var vis = lista.filter(function (a) { return a.visible; });
    if (o.encuadrar !== false && vis.length) {
      try {
        var m = dep.mapa();
        if (vis.length === 1) m.setView([vis[0].fila.lat, vis[0].fila.lng], 16);
        else m.fitBounds(vis.map(function (a) { return [a.fila.lat, a.fila.lng]; }), { padding: [60, 60], maxZoom: 16 });
      } catch (e) {}
    }
    if (timer) clearInterval(timer);
    timer = setInterval(function () { if (document.hidden) return; refrescar(); }, REFRESCO_MS);
    return lista;
  }
  function verUno(usuario) {
    var lista = ver({ encuadrar: false });
    var a = lista.find(function (x) { return x.usuario === String(usuario || '').toLowerCase(); });
    if (a && a.visible) {
      try { dep.mapa().setView([a.fila.lat, a.fila.lng], 16); marcas[a.usuario].openPopup(); } catch (e) {}
      return { ok: true };
    }
    return { ok: false, motivo: a ? a.motivo : 'no es un amigo mutuo' };
  }
  function quitar() {
    activa = false;
    if (timer) { clearInterval(timer); timer = null; }
    try { if (capa) capa.clearLayers(); } catch (e) {}
    if (chip) chip.hidden = true;
    marcas = {};
  }

  // ── Compartir ────────────────────────────────────────────────────────
  var compartiendo = { activo: false, hasta: 0, watchId: null, ultimaPos: null, ultimaEscritura: null, escrituras: 0, error: '' };
  function tipoDe(u) { return 'ubicacion_' + String(u || '').toLowerCase().replace(/[^a-z0-9._-]/g, ''); }
  function debeEscribir(prev, pos, ahora) {
    if (!prev) return true;
    var dt = ahora - prev.t;
    if (dt < MIN_ENTRE_ESCRITURAS_MS) return false;
    if (dt >= MAX_SIN_ESCRIBIR_MS) return true;
    return distanciaM(prev, pos) >= MIN_METROS;
  }
  function escribir(pos, estado) {
    var u = dep.usuario();
    if (!u) return Promise.resolve(false);
    var fecha = new Date(dep.ahora()).toISOString();
    var desc = String(u).toLowerCase() + '~~~' + Math.round(pos.acc || 0) + '~~~' + (estado || 'on');
    var campos = { lat: pos.lat.toFixed(7), lng: pos.lng.toFixed(7), fecha: fecha, descripcion: desc };
    var fila = { tipo: tipoDe(u), lat: campos.lat, lng: campos.lng, descripcion: desc, fecha: fecha };
    compartiendo.ultimaEscritura = { lat: pos.lat, lng: pos.lng, t: dep.ahora() };
    compartiendo.escrituras++;
    // La tarjeta de Amigos dice cuándo fue la última posición enviada: se
    // vuelve a pintar con cada escritura, si está en pantalla.
    if (document.getElementById('urbis-presencia-tarjeta')) montarTarjeta();
    // En la caché local queda YA, para que «hace un momento» sea verdad aunque el servidor tarde.
    var arr = (window.urbisUbicaciones = window.urbisUbicaciones || []);
    var i = arr.findIndex(function (f) { var r = leerFila(f); return r && r.usuario === String(u).toLowerCase(); });
    if (i >= 0) arr[i] = fila; else arr.push(fila);
    return Promise.resolve(dep.actualizar(tipoDe(u), campos)).then(function (res) {
      if (!res || (!res.updated && res.ok !== true) || res.updated === 0) return dep.crear(fila);
      return res;
    }).catch(function (e) { compartiendo.error = (e && e.message) || String(e); return false; });
  }
  function alRecibir(p) {
    var pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy || 0 };
    compartiendo.ultimaPos = pos;
    if (compartiendo.hasta && dep.ahora() > compartiendo.hasta) { dejarDeCompartir('vencio'); return; }
    if (debeEscribir(compartiendo.ultimaEscritura, pos, dep.ahora())) escribir(pos, 'on');
    if (activa) pintarChip(amigosUbicados());
  }
  function compartir(minutos) {
    var geo = dep.geo();
    if (!dep.usuario()) return { ok: false, motivo: 'Necesitas una sesión iniciada para compartir tu ubicación.' };
    if (!geo || !geo.watchPosition) return { ok: false, motivo: 'Este dispositivo no permite leer el GPS.' };
    if (compartiendo.watchId != null) { try { geo.clearWatch(compartiendo.watchId); } catch (e) {} }
    compartiendo.activo = true;
    compartiendo.hasta = minutos > 0 ? dep.ahora() + minutos * 60000 : 0;
    compartiendo.ultimaEscritura = null;
    compartiendo.error = '';
    dep.guardar({ activo: true, hasta: compartiendo.hasta, desde: dep.ahora() });
    compartiendo.watchId = geo.watchPosition(alRecibir, function (err) {
      compartiendo.error = (err && err.message) || 'sin GPS';
      if (typeof dep.alError === 'function') dep.alError(err);
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    montarTarjeta();
    return { ok: true, hasta: compartiendo.hasta };
  }
  function dejarDeCompartir(motivo) {
    var geo = dep.geo();
    if (compartiendo.watchId != null && geo && geo.clearWatch) { try { geo.clearWatch(compartiendo.watchId); } catch (e) {} }
    compartiendo.watchId = null;
    var estaba = compartiendo.activo;
    compartiendo.activo = false;
    compartiendo.hasta = 0;
    dep.guardar({ activo: false, hasta: 0, motivo: motivo || 'apagado' });
    // Se deja escrito que se apagó: los amigos ven «dejó de compartir», no un punto viejo.
    var p = estaba ? (compartiendo.ultimaPos || (compartiendo.ultimaEscritura ? { lat: compartiendo.ultimaEscritura.lat, lng: compartiendo.ultimaEscritura.lng, acc: 0 } : null)) : null;
    var fin = p ? escribir(p, 'off') : Promise.resolve(false);
    montarTarjeta();
    return fin;
  }
  /* Al arrancar: si la persona dejó el interruptor encendido y no venció,
     se retoma. Si no, NADA: ni GPS ni escritura. Es lo que reemplaza al
     radar silencioso. */
  function reanudar() {
    var g = dep.cargar();
    if (!g || !g.activo) return false;
    if (g.hasta && dep.ahora() > g.hasta) { dep.guardar({ activo: false, hasta: 0, motivo: 'vencio' }); return false; }
    if (compartiendo.activo) return true;
    var min = g.hasta ? Math.max(1, Math.round((g.hasta - dep.ahora()) / 60000)) : 0;
    return compartir(min).ok;
  }
  function estadoCompartir() {
    return { activo: compartiendo.activo, hasta: compartiendo.hasta, escrituras: compartiendo.escrituras,
             ultimaEscritura: compartiendo.ultimaEscritura, error: compartiendo.error };
  }

  // ── La tarjeta en la pantalla de Amigos ──────────────────────────────
  function tarjetaHTML() {
    var e = compartiendo;
    var hastaTxt = e.activo ? (e.hasta ? 'hasta las ' + new Date(e.hasta).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : 'hasta que lo apagues') : '';
    var ult = e.ultimaEscritura ? haceCuanto(dep.ahora() - e.ultimaEscritura.t) : '';
    return '<div class="u52-card urb-pres-tarjeta' + (e.activo ? ' on' : '') + '" id="urbis-presencia-tarjeta">' +
      '<div class="urb-pres-tarjeta-cab"><span>' + (e.activo ? '📡' : '📍') + '</span><div>' +
        '<b>' + (e.activo ? 'Compartiendo tu ubicación con tus amigos' : 'Compartir mi ubicación con mis amigos') + '</b>' +
        '<small>' + (e.activo
          ? hastaTxt + (ult ? ' · última posición enviada ' + ult : ' · esperando el GPS…') + (e.error ? ' · ' + esc(e.error) : '')
          : 'Solo tus amigos mutuos la ven, con la precisión del GPS y hace cuánto. Nada se envía si no lo enciendes.') + '</small>' +
      '</div></div>' +
      (e.activo
        ? '<button type="button" class="u52-primary" data-pres="apagar">Dejar de compartir</button>'
        : '<div class="urb-pres-duraciones">' +
            '<button type="button" data-pres="60">1 hora</button>' +
            '<button type="button" data-pres="480">8 horas</button>' +
            '<button type="button" data-pres="1440">Un día</button>' +
            '<button type="button" data-pres="0">Hasta apagar</button>' +
          '</div>') +
      '</div>';
  }
  function montarTarjeta() {
    var ancla = document.querySelector('.u52-amigos-card');
    if (!ancla) return null;
    var prev = document.getElementById('urbis-presencia-tarjeta');
    var html = tarjetaHTML();
    if (prev) { prev.outerHTML = html; }
    else { ancla.insertAdjacentHTML('beforebegin', html); }
    var t = document.getElementById('urbis-presencia-tarjeta');
    t.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-pres]'); if (!b) return;
      var v = b.getAttribute('data-pres');
      if (v === 'apagar') { dejarDeCompartir('apagado'); return; }
      var r = compartir(parseInt(v, 10) || 0);
      if (!r.ok && r.motivo) alert(r.motivo);
    });
    return t;
  }

  window.URBIS_PRESENCIA = {
    configurar: configurar,
    leerFila: leerFila, frescura: frescura, haceCuanto: haceCuanto,
    amigos: amigos, amigosUbicados: amigosUbicados, ultimaPorUsuario: ultimaPorUsuario,
    ver: ver, verUno: verUno, quitar: quitar, refrescar: refrescar, pintar: pintar,
    get activa() { return activa; },
    get capa() { return capa; },
    compartir: compartir, dejarDeCompartir: dejarDeCompartir, reanudar: reanudar,
    estadoCompartir: estadoCompartir, debeEscribir: debeEscribir,
    tarjetaHTML: tarjetaHTML, montarTarjeta: montarTarjeta,
    LIMITES: { VIVO_MS: VIVO_MS, RECIENTE_MS: RECIENTE_MS, VISIBLE_MS: VISIBLE_MS, MIN_METROS: MIN_METROS,
               MAX_SIN_ESCRIBIR_MS: MAX_SIN_ESCRIBIR_MS, MIN_ENTRE_ESCRITURAS_MS: MIN_ENTRE_ESCRITURAS_MS }
  };
})();
