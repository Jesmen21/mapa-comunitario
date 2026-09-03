/* URBIS · SOL (js/73)
   ─────────────────────────────────────────────────────────────────────────
   Dónde está el sol sobre un sector, y qué se deduce de eso para proyectar.

   No consulta nada. La posición del sol es geometría: con la latitud, la
   longitud y la fecha sale todo —salida, mediodía solar, puesta, altura,
   azimut, hacia dónde caen las sombras—, así que este módulo funciona sin
   red, sin clave y sin permiso de nadie. Es el único bloque del análisis que
   no depende de que alguien haya mapeado algo.

   El algoritmo es el clásico de posición solar (el mismo de suncalc, a su
   vez el del NOAA). Precisión de un minuto o dos en las horas y de una
   fracción de grado en los ángulos: de sobra para decidir hacia dónde abrir
   una fachada, que es para lo que se usa. No sirve para navegar.

   Una advertencia que el bloque muestra y que conviene entender: esto es el
   sol GEOMÉTRICO. No sabe si enfrente hay una montaña, una torre o un árbol.
   La sombra real de un lote de ladera se mide en el sitio; esto dice de dónde
   viene la luz, que es la mitad del problema.

   Uso:  URBIS_SOLAR.dia(new Date(), 7.89, -72.50)
         URBIS_SOLAR.anio(7.89, -72.50, 2026)                                */
(function () {
  'use strict';

  var RAD = Math.PI / 180;
  var DIA_MS = 86400000;
  var J1970 = 2440588, J2000 = 2451545;
  // Oblicuidad de la eclíptica: la inclinación del eje de la Tierra, que es
  // la razón de que existan las estaciones y de que el sol no salga siempre
  // por el mismo punto del horizonte.
  var OBL = RAD * 23.4397;
  // El sol se considera «salido» cuando su centro está 0.833° BAJO el
  // horizonte: 0.267° por su propio radio y el resto por la refracción de la
  // atmósfera, que lo levanta un poco antes de que asome de verdad.
  var H0 = RAD * -0.833;

  function aJuliano(fecha) { return fecha.valueOf() / DIA_MS - 0.5 + J1970; }
  function deJuliano(j) { return new Date((j + 0.5 - J1970) * DIA_MS); }
  function dias(fecha) { return aJuliano(fecha) - J2000; }

  function anomaliaMedia(d) { return RAD * (357.5291 + 0.98560028 * d); }
  function longitudEcliptica(M) {
    // Ecuación del centro: la órbita es una elipse, así que la Tierra no
    // avanza siempre a la misma velocidad y el sol se adelanta o se atrasa.
    var C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    var P = RAD * 102.9372;   // perihelio
    return M + C + P + Math.PI;
  }
  function declinacion(L) { return Math.asin(Math.sin(OBL) * Math.sin(L)); }
  function ascensionRecta(L) { return Math.atan2(Math.sin(L) * Math.cos(OBL), Math.cos(L)); }
  function tiempoSideral(d, lw) { return RAD * (280.16 + 360.9856235 * d) - lw; }

  function altitud(H, phi, dec) {
    return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  }
  /* Azimut medido desde el NORTE y creciendo hacia el este, que es como se
     lee una brújula y como se rotula un plano. La fórmula clásica lo da desde
     el sur, y usarla tal cual pone el amanecer al oeste: el error se ve en el
     dibujo pero no en el número, así que se convierte acá y no en cada sitio
     que lo use. */
  function azimut(H, phi, dec) {
    var a = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
    var g = a / RAD + 180;
    return (g + 360) % 360;
  }

  /* Posición del sol en un instante. Devuelve grados: altura sobre el
     horizonte (negativa de noche) y azimut desde el norte. */
  function posicion(fecha, lat, lng) {
    var lw = RAD * -lng, phi = RAD * lat, d = dias(fecha);
    var M = anomaliaMedia(d), L = longitudEcliptica(M);
    var dec = declinacion(L), ra = ascensionRecta(L);
    var H = tiempoSideral(d, lw) - ra;
    return {
      altitud: altitud(H, phi, dec) / RAD,
      azimut: azimut(H, phi, dec),
      declinacion: dec / RAD
    };
  }

  // ── Horas del día ───────────────────────────────────────────────────────
  function cicloJuliano(d, lw) { return Math.round(d - 0.0009 - lw / (2 * Math.PI)); }
  function transitoAprox(Ht, lw, n) { return 0.0009 + (Ht + lw) / (2 * Math.PI) + n; }
  function transitoSolar(ds, M, L) {
    return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  }
  function anguloHorario(h, phi, dec) {
    var c = (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    // Fuera de [-1,1] no hay salida ni puesta: sol de medianoche o noche
    // polar. En Colombia no pasa nunca, pero devolver NaN acá y dejar que
    // reviente más adelante sería un error difícil de encontrar.
    if (c > 1 || c < -1) return null;
    return Math.acos(c);
  }

  /* El día solar de un sitio: cuándo sale el sol, cuándo está más alto,
     cuándo se pone, y por qué punto del horizonte hace cada cosa. */
  function dia(fecha, lat, lng) {
    var lw = RAD * -lng, phi = RAD * lat;
    var d = dias(fecha || new Date());
    var n = cicloJuliano(d, lw);
    var ds = transitoAprox(0, lw, n);
    var M = anomaliaMedia(ds), L = longitudEcliptica(M), dec = declinacion(L);
    var Jcenit = transitoSolar(ds, M, L);
    var w = anguloHorario(H0, phi, dec);

    var salida = null, puesta = null;
    if (w !== null) {
      var Jset = transitoSolar(transitoAprox(w, lw, n), M, L);
      var Jrise = Jcenit - (Jset - Jcenit);
      salida = deJuliano(Jrise);
      puesta = deJuliano(Jset);
    }
    var cenit = deJuliano(Jcenit);
    var pCenit = posicion(cenit, lat, lng);

    return {
      salida: salida, cenit: cenit, puesta: puesta,
      // Altura máxima del sol: la del mediodía solar. Con 80° o más, la luz
      // cae casi vertical y la fachada recibe poco; el problema pasa a ser la
      // cubierta.
      alturaMaxima: Math.round(pCenit.altitud * 10) / 10,
      azimutCenit: Math.round(pCenit.azimut * 10) / 10,
      azimutSalida: salida ? Math.round(posicion(salida, lat, lng).azimut * 10) / 10 : null,
      azimutPuesta: puesta ? Math.round(posicion(puesta, lat, lng).azimut * 10) / 10 : null,
      declinacion: Math.round(dec / RAD * 100) / 100,
      duracionH: (salida && puesta) ? Math.round((puesta - salida) / 36000) / 100 : null
    };
  }

  // ── El año ──────────────────────────────────────────────────────────────
  /* Los dos días en que el sol pasa por el cenit. En el trópico —y Cúcuta
     está a 7,9° de latitud— el sol cruza el cenit DOS veces al año, no una
     ni ninguna: es la diferencia entre proyectar acá y copiar un manual
     europeo, donde el sol nunca llega a estar vertical. Esos dos días la
     fachada no recibe casi nada y la cubierta lo recibe todo. */
  function dosPasosCenitales(lat, anio) {
    if (Math.abs(lat) > 23.44) return [];   // fuera del trópico no ocurre
    var encontrados = [], anterior = null;
    for (var i = 0; i < 366; i++) {
      var f = new Date(Date.UTC(anio, 0, 1, 12));
      f.setUTCDate(f.getUTCDate() + i);
      var dec = posicion(f, lat, 0).declinacion;
      var dif = dec - lat;
      // El día en que la declinación cruza la latitud: ahí el sol pasa justo
      // por encima.
      if (anterior !== null && ((anterior < 0 && dif >= 0) || (anterior > 0 && dif <= 0))) {
        encontrados.push(new Date(f));
      }
      anterior = dif;
    }
    return encontrados;
  }

  function solsticios(lat, lng, anio) {
    // No se calcula el instante astronómico del solsticio: se toman los dos
    // días en que el sol culmina más alto y más bajo, que es lo que importa
    // para una fachada y se lee igual de bien.
    var alto = null, bajo = null;
    for (var i = 0; i < 366; i++) {
      var f = new Date(Date.UTC(anio, 0, 1, 12));
      f.setUTCDate(f.getUTCDate() + i);
      var h = dia(f, lat, lng).alturaMaxima;
      if (!alto || h > alto.altura) alto = { fecha: new Date(f), altura: h };
      if (!bajo || h < bajo.altura) bajo = { fecha: new Date(f), altura: h };
    }
    return { masAlto: alto, masBajo: bajo };
  }

  function anio(lat, lng, cual) {
    var a = cual || new Date().getFullYear();
    return { anio: a, cenitales: dosPasosCenitales(lat, a), solsticios: solsticios(lat, lng, a) };
  }

  // ── Traducciones ────────────────────────────────────────────────────────
  var RUMBOS = ['norte', 'nororiente', 'oriente', 'suroriente', 'sur', 'suroccidente', 'occidente', 'noroccidente'];
  function rumbo(az) {
    if (az == null) return '';
    return RUMBOS[Math.round(((az % 360) + 360) % 360 / 45) % 8];
  }
  // La sombra cae al lado opuesto del sol: es lo que hay que dibujar en la
  // planta, y confundirlo es el error clásico de una lámina de asoleamiento.
  function sombra(az) { return az == null ? null : (az + 180) % 360; }

  /* La fachada que se calienta. En el trópico el sol de la tarde entra por el
     occidente casi horizontal, y es el que de verdad recalienta: al mediodía
     está tan alto que la fachada apenas lo recibe. Que la culminación sea al
     norte o al sur depende de la época, y eso decide qué lado protege menos. */
  function fachadaCritica(d, lat) {
    var alNorte = d.azimutCenit > 315 || d.azimutCenit < 45;
    // Con el sol a 89° el azimut es ruido: un grado para un lado o para otro
    // cambia la respuesta y ninguna de las dos significa nada. Se dice.
    var casiVertical = d.alturaMaxima >= 85;
    return {
      tarde: 'occidente',
      casiVertical: casiVertical,
      culminacion: casiVertical ? 'vertical' : (alNorte ? 'norte' : 'sur'),
      // Con el sol muy alto, la fachada recibe poco y el problema es la
      // cubierta; con el sol bajo, al contrario.
      manda: d.alturaMaxima >= 75 ? 'cubierta' : 'fachada',
      lat: lat
    };
  }

  window.URBIS_SOLAR = {
    posicion: posicion, dia: dia, anio: anio,
    rumbo: rumbo, sombra: sombra, fachadaCritica: fachadaCritica
  };
})();
