/* URBIS · EL CALOR, PINTADO Y PUESTO SOBRE EL MAPA (js/56)
   ─────────────────────────────────────────────────────────────────────────
   El motor devuelve `flujo.mapaCalor`: tres mallas de 26×26 —a pie de día,
   a pie de noche, en vehículo— con el movimiento estimado en cada celda de
   un cuadrado de lado 2·radio centrado en el punto analizado. Hasta la v806
   se pintaban como tres cuadritos de colores con una cruz en el medio: se
   veía DÓNDE dentro del cuadrado, pero no sobre qué calle.

   Este archivo hace dos cosas y vive aparte porque las hacen TRES módulos
   que no comparten código —el análisis de empresas (js/62), el del curso
   (js/65) y el informe en papel (js/63)— y cada uno tenía su copia de la
   rampa de colores y del dibujo. Tres copias, y la que se quede atrás.

   1. Pinta la malla a su tamaño real y la reescala con suavizado. 676
      divs por capa pesarían tres veces más y no añadirían un dato: la
      malla no tiene más resolución.

   2. La pone SOBRE el mapa vivo, con Leaflet, en el sitio exacto que mide:
      el cuadrado se calcula con la misma conversión metros→grados que usa
      el motor para armar la malla. Si acá se usara otra fórmula, la mancha
      caería una cuadra corrida del dato y nadie lo notaría, porque una
      mancha de calor se ve igual de convincente en cualquier parte.       */
(function () {
  'use strict';

  /* A pie: de verde (poco) a rojo (mucho). Vehicular en azul-morado para
     que las dos capas no se confundan al verlas una al lado de la otra.
     Cada parada es [posición 0..1, [r, g, b, alfa]]; la primera es
     transparente para que las celdas sin movimiento dejen ver el mapa. */
  var RAMPAS = {
    peaton:   [[0, [ 32, 140,  90,   0]], [.25, [120, 190,  60, 110]], [.5, [245, 205,  60, 170]],
               [.75, [240, 140,  40, 205]], [1, [214,  40,  40, 230]]],
    vehiculo: [[0, [ 30,  90, 170,   0]], [.25, [ 70, 130, 220, 110]], [.5, [110, 110, 225, 170]],
               [.75, [150,  70, 205, 205]], [1, [120,  20, 150, 230]]]
  };

  /* Las tres capas, con su nombre y su rampa, en el orden en que se
     muestran. Los módulos no repiten estos textos: los toman de acá. */
  var CAPAS = [
    { id: 'dia',      capa: 'peatonalDia',   foco: 'focoDia',       tipo: 'peaton',
      t: 'A pie · día',   sub: 'mañana a tarde' },
    { id: 'noche',    capa: 'peatonalNoche', foco: 'focoNoche',     tipo: 'peaton',
      t: 'A pie · noche', sub: 'después de las 7 p.m.' },
    { id: 'vehiculo', capa: 'vehicular',     foco: 'focoVehicular', tipo: 'vehiculo',
      t: 'En vehículo',   sub: 'vías y atractores' }
  ];
  function capaPorId(id) {
    for (var i = 0; i < CAPAS.length; i++) if (CAPAS[i].id === id) return CAPAS[i];
    return null;
  }

  function colorRampa(ramp, t) {
    for (var i = 1; i < ramp.length; i++) {
      if (t <= ramp[i][0]) {
        var a = ramp[i - 1], b = ramp[i], k = (t - a[0]) / (b[0] - a[0] || 1);
        return [0, 1, 2, 3].map(function (c) { return Math.round(a[1][c] + (b[1][c] - a[1][c]) * k); });
      }
    }
    return ramp[ramp.length - 1][1];
  }

  /* La rampa como degradado CSS, para la leyenda. Sale de los mismos
     números que el dibujo: una leyenda pintada aparte con «más o menos
     estos colores» es la manera de que un día no coincidan. */
  function degradado(tipo) {
    var ramp = RAMPAS[tipo] || RAMPAS.peaton;
    return 'linear-gradient(to right,' + ramp.map(function (p) {
      var c = p[1];
      // La primera parada es transparente en el mapa; en la leyenda se deja
      // ver tenue para que la barra no empiece en la nada.
      var alfa = Math.max(0.25, c[3] / 255);
      return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alfa.toFixed(2) + ') ' + Math.round(p[0] * 100) + '%';
    }).join(',') + ')';
  }

  function png(capa, n, tipo, tam) {
    try {
      if (!capa || !n) return '';
      var ramp = RAMPAS[tipo] || RAMPAS.peaton;
      var c = document.createElement('canvas'); c.width = c.height = n;
      var ctx = c.getContext('2d');
      var img = ctx.createImageData(n, n);
      for (var k = 0; k < n * n; k++) {
        var v = capa[k], px = k * 4;
        if (v == null || v < 0) { img.data[px + 3] = 0; continue; }
        var col = colorRampa(ramp, Math.max(0, Math.min(1, v / 100)));
        img.data[px] = col[0]; img.data[px + 1] = col[1]; img.data[px + 2] = col[2]; img.data[px + 3] = col[3];
      }
      ctx.putImageData(img, 0, 0);
      var lado = tam || 240;
      var g = document.createElement('canvas'); g.width = g.height = lado;
      var gx = g.getContext('2d');
      gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high';
      gx.drawImage(c, 0, 0, lado, lado);
      return g.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  /* El cuadrado que cubre la malla, en grados: [[sur, oeste], [norte, este]].
     Misma conversión que el motor (110540 m por grado de latitud, 111320·cos
     por grado de longitud). Si el dato no trae centro o radio, no hay dónde
     ponerlo y se devuelve null en vez de inventar un sitio. */
  function limites(mc) {
    var c = mc && mc.centro, r = Number(mc && mc.radioM);
    if (!c || !isFinite(c.lat) || !isFinite(c.lng) || !(r > 0)) return null;
    var dLat = r / 110540;
    var dLng = r / (111320 * Math.cos(c.lat * Math.PI / 180));
    return [[c.lat - dLat, c.lng - dLng], [c.lat + dLat, c.lng + dLng]];
  }

  /* Dónde cae el punto más activo dentro de la miniatura, en porcentaje.
     El motor manda la celda (i, j) del máximo; se marca su centro. */
  function focoPct(foco, n) {
    if (!foco || !n || !isFinite(foco.i) || !isFinite(foco.j)) return null;
    return { left: ((foco.i + 0.5) / n * 100).toFixed(1), top: ((foco.j + 0.5) / n * 100).toFixed(1) };
  }

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /* Las tres miniaturas. `cls` es el prefijo de clases del módulo que las
     pide (`edu-calor` o `aia-calor-panel`), porque cada panel tiene su hoja
     de estilos; lo que va igual en los tres —el punto del foco, el atributo
     que dice qué capa es— sale de acá. Cada miniatura es un botón: tocarla
     pone esa capa sobre el mapa. */
  function miniaturas(mc, cls, activa) {
    if (!mc) return '';
    return CAPAS.map(function (C) {
      var src = png(mc[C.capa], mc.n, C.tipo);
      var foco = mc[C.foco], f = focoPct(foco, mc.n);
      return '<figure class="' + cls + (activa === C.id ? ' act' : '') + '" data-capa="' + C.id + '" ' +
          'role="button" tabindex="0" title="Ver sobre el mapa">' +
        '<figcaption>' + esc(C.t) + '<em>' + esc(C.sub) + '</em></figcaption>' +
        '<div class="' + cls + '-lienzo">' +
          (src ? '<img src="' + src + '" alt="' + esc(C.t) + '">' : '<div class="' + cls + '-vacio"></div>') +
          (f ? '<i class="urb-calor-foco" style="left:' + f.left + '%;top:' + f.top + '%"></i>' : '') +
          '<i class="urb-calor-centro"></i>' +
        '</div>' +
        '<small>' + (foco ? esc(foco.texto) : 'sin actividad suficiente') + '</small>' +
        '</figure>';
    }).join('');
  }

  /* Los botones para elegir qué capa va sobre el mapa, y el de quitarla. */
  function botones(activa) {
    return '<div class="urb-calor-botones" role="group" aria-label="Capa sobre el mapa">' +
      '<span>Sobre el mapa:</span>' +
      CAPAS.map(function (C) {
        return '<button type="button" data-capa="' + C.id + '"' +
          (activa === C.id ? ' class="act" aria-pressed="true"' : ' aria-pressed="false"') + '>' +
          esc(C.t) + '</button>';
      }).join('') +
      '<button type="button" data-capa="" class="quitar"' + (activa ? '' : ' hidden') + '>Quitar</button>' +
      '</div>';
  }

  function leyenda() {
    return '<div class="urb-calor-leyendas">' +
      '<div class="urb-calor-leyenda"><span>a pie · menos</span><i style="background:' + degradado('peaton') + '"></i><span>más</span></div>' +
      '<div class="urb-calor-leyenda"><span>vehículo · menos</span><i style="background:' + degradado('vehiculo') + '"></i><span>más</span></div>' +
      '</div>';
  }

  /* ── Sobre el mapa ─────────────────────────────────────────────────────
     Un controlador por mapa. Guarda la capa y la marca del foco para poder
     cambiarlas o quitarlas sin dejar restos; un `L.imageOverlay` nuevo por
     cada clic dejaría las anteriores debajo, cada vez más opaco el mapa. */
  function cuadradoVisible(map, lim) {
    try {
      var b = map.getBounds && map.getBounds();
      if (!b || typeof b.contains !== 'function' || !lim) return true;
      return b.contains(lim);
    } catch (e) { return true; }
  }

  function enMapa(map) {
    var capa = null, marca = null, activa = '', datos = null;

    function quitar() {
      try { if (capa && map) map.removeLayer(capa); } catch (e) {}
      try { if (marca && map) map.removeLayer(marca); } catch (e) {}
      capa = null; marca = null; activa = '';
    }

    /* Pone la capa `id` del mapaCalor `mc`. Devuelve true si la puso;
       false si no había dónde (sin Leaflet, sin mapa, sin límites). Con
       `encuadrar`, lleva el mapa al cuadrado del dato. */
    function mostrar(mc, id, opciones) {
      var o = opciones || {};
      var C = capaPorId(id), lim = limites(mc);
      if (!C || !lim || !map || typeof L === 'undefined' || !L.imageOverlay) return false;
      var src = png(mc[C.capa], mc.n, C.tipo, 520);
      if (!src) return false;
      quitar();
      capa = L.imageOverlay(src, lim, {
        opacity: o.opacidad || 0.72, interactive: false, className: 'urb-calor-capa',
        pane: o.pane || 'overlayPane'
      }).addTo(map);
      var foco = mc[C.foco];
      if (foco && isFinite(foco.lat) && isFinite(foco.lng) && L.circleMarker) {
        marca = L.circleMarker([foco.lat, foco.lng], {
          radius: 7, color: '#ffffff', weight: 2.2, fillColor: C.tipo === 'vehiculo' ? '#7c3aed' : '#dc2626',
          fillOpacity: 0.95, className: 'urb-calor-marca', interactive: true
        }).addTo(map);
        if (marca.bindTooltip) {
          marca.bindTooltip('Punto más activo · ' + C.t + ': ' + foco.texto,
            { direction: 'top', offset: [0, -6], className: 'urb-calor-tip' });
        }
      }
      activa = id; datos = mc;
      /* `encuadrar`: true lleva el mapa al sector; false no lo toca; 'auto'
         lo lleva solo si el cuadrado entero NO cabe en lo que se ve — un
         guardado abierto con el mapa en otra parte, o un análisis hecho tan
         de cerca que el calor queda casi todo fuera de pantalla. También
         puede ser una función (map, límites) → boolean, para quien sabe
         qué parte del mapa tapa su propio panel. */
      var enc = o.encuadrar;
      if (typeof enc === 'function') enc = !!enc(map, lim);
      else if (enc === 'auto') enc = !cuadradoVisible(map, lim);
      if (enc !== false && map.fitBounds) {
        try { map.fitBounds(lim, o.ajuste || { padding: o.margen || [24, 24], maxZoom: 17 }); } catch (e) {}
      }
      return true;
    }

    return {
      mostrar: mostrar,
      quitar: quitar,
      get activa() { return activa; },
      get capa() { return capa; },
      get marca() { return marca; },
      get datos() { return datos; },
      limites: function () { return limites(datos); }
    };
  }

  window.URBIS_CALOR = {
    CAPAS: CAPAS,
    RAMPAS: RAMPAS,
    png: png,
    limites: limites,
    focoPct: focoPct,
    degradado: degradado,
    miniaturas: miniaturas,
    botones: botones,
    leyenda: leyenda,
    enMapa: enMapa
  };
})();
