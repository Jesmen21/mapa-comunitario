/* URBIS · Llevarse el sector a la calle
   ═══════════════════════════════════════════════════════════════════════
   «Lo intangible» es la herramienta hecha para la calle: se camina el barrio
   y se marca dónde está oscuro, dónde huele mal, dónde uno no pasaría de
   noche. Y la calle es justo donde esta aplicación estaba más floja, porque
   sin señal el mapa queda gris — y sobre un mapa gris no se puede señalar
   nada.

   Esto baja las teselas del sector ANTES de salir y las guarda en un depósito
   propio del navegador. El service worker las sirve después, con señal o sin
   ella. No es magia ni es «modo offline»: es traerse el papel del mapa antes
   de ir, que es lo que uno hace desde siempre.

   Lo que NO resuelve, y hay que decirlo donde se lea: analizar un sector,
   medir el trazado o preguntarle al Servicio Geológico siguen necesitando
   red. Lo de la calle es marcar, y para marcar hace falta ver.             */
(function () {
  'use strict';

  var DEPOSITO = 'urbis-teselas-v1';

  /* Los tres acercamientos que sirven caminando, y por qué esos:
       16 · la manzana entera y el barrio alrededor, para ubicarse;
       17 · la cuadra, que es la escala a la que se marca una zona;
       18 · el predio, para poner un punto donde de verdad va.
     Bajar el 19 multiplicaría por cuatro el peso para ganar un detalle que a
     pie no se usa. */
  var ZOOMS = [16, 17, 18];

  /* Se guarda el mapa QUE ESTÁ PUESTO, preguntándoselo a Leaflet, y no uno
     escrito acá. La primera versión traía la plantilla del mapa base por
     omisión y el modo educativo muestra el satélite: bajaba dos mil teselas
     de un mapa que nadie estaba mirando y dejaba la pantalla igual de gris.

     Además se pide la dirección con el propio `getTileUrl` de la capa. Eso
     resuelve de una vez el subdominio —Leaflet reparte entre a, b, c y d con
     una cuenta suya, determinista pero suya—, el sufijo de pantalla retina y
     cualquier parámetro que la capa agregue. La clave con la que se guarda
     queda idéntica, carácter por carácter, a la que el mapa va a pedir. */
  var PLANTILLA_RESPALDO =
    'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

  function capaBase() {
    var m = window.map, hallada = null;
    if (!m || !m.eachLayer) return null;
    try {
      m.eachLayer(function (l) {
        if (!hallada && l && l._url && typeof l.getTileUrl === 'function') hallada = l;
      });
    } catch (e) {}
    return hallada;
  }

  function xDe(lng, z) { return Math.floor((lng + 180) / 360 * Math.pow(2, z)); }
  function yDe(lat, z) {
    var r = lat * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
  }

  function caja(pts) {
    var s = Infinity, n = -Infinity, o = Infinity, e = -Infinity;
    pts.forEach(function (p) {
      s = Math.min(s, p.lat); n = Math.max(n, p.lat);
      o = Math.min(o, p.lng); e = Math.max(e, p.lng);
    });
    return { s: s, n: n, o: o, e: e };
  }

  /* El contorno de lo que hay que llevarse, con un margen. El margen no es
     capricho: quien camina se sale del área que dibujó —a buscar una esquina,
     a rodear un muro— y encontrarse el gris justo en el borde es peor que no
     haber guardado nada. */
  function teselasDe(contorno, margenM) {
    if (!contorno || contorno.length < 2) return [];
    var c = caja(contorno);
    var m = margenM == null ? 250 : margenM;
    var dLat = m / 110540;
    var latMedia = (c.s + c.n) / 2;
    var dLng = m / (111320 * Math.cos(latMedia * Math.PI / 180));
    c = { s: c.s - dLat, n: c.n + dLat, o: c.o - dLng, e: c.e + dLng };

    var lista = [];
    ZOOMS.forEach(function (z) {
      var x0 = xDe(c.o, z), x1 = xDe(c.e, z);
      var y0 = yDe(c.n, z), y1 = yDe(c.s, z);   // el norte tiene la Y menor
      for (var x = x0; x <= x1; x++) {
        for (var y = y0; y <= y1; y++) {
          lista.push({ z: z, x: x, y: y });
        }
      }
    });
    return lista;
  }

  /* La dirección de una tesela, armada como la arma Leaflet — pero con el
     zoom que se le pide.

     No se puede llamar a `capa.getTileUrl()`: ese método toma la X y la Y de
     lo que se le pasa y el ZOOM del mapa que se está mirando, porque está
     pensado para pintar lo que hay en pantalla y no para descargar otra
     escala. Con el mapa en 15, guardaba las coordenadas del 16, 17 y 18 todas
     con z=15: ciento cuarenta y nueve direcciones distintas, todas
     equivocadas, y ni una sola coincidía después con lo que el mapa pedía.

     Así que se rellena la misma plantilla con la misma cuenta de subdominio
     que usa Leaflet —`|x + y| módulo cuántos haya`, que es determinista— y su
     mismo sufijo de pantalla retina. La clave queda idéntica, carácter por
     carácter, a la que el mapa va a pedir. */
  function urlDe(t, capa) {
    var c = capa === undefined ? capaBase() : capa;
    var Lf = window.L;
    if (c && c._url && Lf && Lf.Util && Lf.Util.template) {
      try {
        var op = c.options || {};
        var subs = op.subdomains;
        var arr = typeof subs === 'string' ? subs.split('') : (subs || []);
        var y = t.y;
        // TMS cuenta la Y al revés. Ninguna capa de URBIS lo usa hoy, pero
        // cambiar de mapa base no debería obligar a volver acá.
        if (op.tms) y = Math.pow(2, t.z) - t.y - 1;
        var datos = {
          r: (Lf.Browser && Lf.Browser.retina) ? '@2x' : '',
          s: arr.length ? arr[Math.abs(t.x + t.y) % arr.length] : '',
          x: t.x, y: y, z: t.z
        };
        return Lf.Util.template(c._url, Lf.Util.extend(datos, op));
      } catch (e) {}
    }
    return PLANTILLA_RESPALDO
      .replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y);
  }

  /* Cuánto pesa, antes de bajarlo. Una tesela de dibujo ronda los 20 kB y una
     de satélite los 35: se toma la del mapa que esté puesto y se redondea
     hacia arriba, porque prometer de menos y pasarse es peor que al revés
     cuando alguien está mirando su plan de datos.

     Es una estimación y se dice como tal: una respuesta opaca no deja leer su
     tamaño, así que ni siquiera después de bajarlas se sabe el peso exacto. */
  function esFoto(capa) {
    var u = (capa && capa._url) || '';
    return /arcgisonline|maptiles\.arcgis|lyrs=[sy]/.test(u);
  }
  function estimar(contorno, margenM) {
    var n = teselasDe(contorno, margenM).length;
    var kbPorTesela = esFoto(capaBase()) ? 35 : 20;
    return { teselas: n, kbPorTesela: kbPorTesela,
             kb: Math.round(n * kbPorTesela),
             mb: Math.round(n * kbPorTesela / 1024 * 10) / 10,
             foto: esFoto(capaBase()) };  // el satélite pesa y además no da CORS
  }

  function hayDeposito() {
    return typeof caches !== 'undefined' && !!caches.open;
  }

  /* Bajar y guardar, de a cuatro. Con un solo subdominio el navegador ya
     limita las conexiones simultáneas al mismo servidor, así que pedir más
     en paralelo no acelera: solo llena la memoria de un teléfono con
     respuestas a medio leer. */
  function guardar(contorno, margenM, avisar) {
    if (!hayDeposito()) {
      return Promise.reject(new Error('Este navegador no deja guardar el mapa para después.'));
    }
    var lista = teselasDe(contorno, margenM);
    if (!lista.length) return Promise.reject(new Error('No hay área que guardar.'));

    var total = lista.length, hechas = 0, fallos = 0, cancelado = false;
    var estado = {
      total: total, hechas: 0, fallos: 0,
      cancelar: function () { cancelado = true; }
    };

    /* La capa se resuelve UNA vez, antes de empezar: si el estudiante cambia
       de mapa base a mitad de la descarga, lo que ya bajó y lo que falta
       seguirían siendo del mismo mapa, que es lo único que sirve. */
    var capa = capaBase();
    var pr = caches.open(DEPOSITO).then(function (cache) {
      var siguiente = 0;
      function uno() {
        if (cancelado || siguiente >= lista.length) return Promise.resolve();
        var i = siguiente++;
        var url = urlDe(lista[i], capa);
        /* Primero CORS, y solo si no se puede, opaca. La diferencia no es de
           purismo: Chromium cobra la cuota de una respuesta OPACA con un
           relleno de varios megas cada una, para no filtrar su tamaño real.
           Con ciento cincuenta teselas opacas eso pasa del gigabyte contado y
           el navegador empieza a rechazar: en la prueba de campo se guardaban
           ciento catorce de ciento cuarenta y nueve y las últimas se perdían
           sin explicación.

           Los mapas de dibujo mandan cabeceras CORS y así pesan lo que pesan.
           Los de satélite no, y con esos no queda más que la opaca — por eso
           se avisa de que un mapa de foto ocupa mucho más. */
        return fetch(url, { mode: 'cors', cache: 'no-store' })
          .catch(function () { return fetch(url, { mode: 'no-cors', cache: 'no-store' }); })
          .then(function (res) { return cache.put(url, res); })
          .catch(function () { fallos++; })
          .then(function () {
            hechas++;
            estado.hechas = hechas; estado.fallos = fallos;
            if (avisar && hechas % 5 === 0) avisar(estado);
            return uno();
          });
      }
      var hilos = [];
      for (var h = 0; h < 4; h++) hilos.push(uno());
      return Promise.all(hilos);
    }).then(function () {
      estado.hechas = hechas; estado.fallos = fallos;
      estado.cancelado = cancelado;
      if (avisar) avisar(estado);
      return estado;
    });

    pr.estado = estado;
    return pr;
  }

  // Qué hay guardado. Se cuenta de verdad, no se recuerda: el navegador puede
  // vaciar el depósito por su cuenta cuando le falta espacio.
  function medida() {
    if (!hayDeposito()) return Promise.resolve({ teselas: 0, mb: 0, hay: false });
    return caches.open(DEPOSITO)
      .then(function (c) { return c.keys(); })
      .then(function (ks) {
        return { teselas: ks.length, mb: Math.round(ks.length * 20 / 1024 * 10) / 10,
                 hay: ks.length > 0 };
      })
      .catch(function () { return { teselas: 0, mb: 0, hay: false }; });
  }

  function borrar() {
    if (!hayDeposito()) return Promise.resolve(false);
    return caches.delete(DEPOSITO).catch(function () { return false; });
  }

  window.URBIS_SIN_SENAL = {
    DEPOSITO: DEPOSITO, ZOOMS: ZOOMS,
    teselasDe: teselasDe, estimar: estimar, urlDe: urlDe, capaBase: capaBase,
    guardar: guardar, medida: medida, borrar: borrar
  };
})();
