/* URBIS · Cortar el terreno por donde uno diga
   ═══════════════════════════════════════════════════════════════════════
   El motor devuelve dos cortes fijos: A–A′ de occidente a oriente y B–B′ de
   norte a sur, los dos por el medio del área. Están bien para leer el
   relieve de un sector, pero un proyecto no se corta por el medio del
   rectángulo: se corta por donde el terreno decide algo. Por la ladera que
   se va a aterrazar, por el eje de la calle a la que da el lote, por la
   quebrada.

   Así que el estudiante marca dos puntos en el mapa y sale su corte, con la
   letra que le toque: C–C′, D–D′, y así.

   Lo hace el TELÉFONO, sin pedir nada. La ficha ya guarda la rejilla de
   cotas cruda —dieciocho por dieciocho, dos kilobytes— justamente para esto.
   Pedirle al servicio de elevación un perfil nuevo por cada corte sería una
   consulta de red por cada raya que alguien dibuje, y encima no funcionaría
   sin señal, que es cuando se está parado en el terreno.

   Dos decisiones sobre la exactitud, dichas donde se toman:

   · Entre cuatro cotas se INTERPOLA. La rejilla tiene un punto cada sesenta
     metros y un corte cae casi siempre entre cuatro; tomar la más cercana
     haría un perfil escalonado que parece una escalera y no un terreno. La
     interpolación bilineal es la misma que usa cualquier programa de SIG
     para esto.

   · Pero eso NO inventa precisión: entre dos puntos de la rejilla el terreno
     puede hacer lo que quiera. El corte sirve para leer la forma del
     relieve, no para sacar una cota. Eso ya lo dice la ficha del terreno y
     vale igual para estos.                                                */
(function () {
  'use strict';

  /* Las letras. A y B son del motor, así que se empieza en C. Se mira qué
     letras hay YA —no cuántos cortes hay— porque uno se puede borrar: con un
     contador, borrar el C y hacer otro daría dos D. */
  var ABC = 'CDEFGHIJKLMNÑOPQRSTUVWXYZ';
  function siguienteLetra(perfiles) {
    var usadas = {};
    (perfiles || []).forEach(function (p) {
      var l = String((p && p.marca) || '').toUpperCase();
      if (l) usadas[l] = true;
    });
    for (var i = 0; i < ABC.length; i++) {
      if (!usadas[ABC.charAt(i)]) return ABC.charAt(i);
    }
    return '?';
  }

  function metrosEntre(a, b) {
    var dLat = (b.lat - a.lat) * 110540;
    var dLng = (b.lng - a.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);
    return Math.hypot(dLat, dLng);
  }

  /* El corte entre dos puntos.

     La cota la da QUIEN LLAMA, con su propia función. No se interpola acá:
     la aplicación ya tiene un `cotaEn` bilineal escrito para su rejilla, y
     una segunda versión con otra forma de datos —que fue la primera versión
     de este archivo— es dos verdades sobre lo mismo esperando a discrepar.
     Se aprendió hoy, con el centro del análisis, y no vale la pena
     aprenderlo dos veces.

     Además así este archivo se puede probar sin montar nada: se le pasa una
     función de cota y ya. */
  function cortar(cota, a, b, opciones) {
    if (typeof cota !== 'function' || !a || !b) return null;
    var op = opciones || {};
    var largo = metrosEntre(a, b);
    if (largo < 20) return null;                 // dos toques casi en el mismo sitio
    var n = Math.max(12, Math.min(80, Math.round(largo / 15)));
    var puntos = [], traza = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var lat = a.lat + (b.lat - a.lat) * t;
      var lng = a.lng + (b.lng - a.lng) * t;
      var z = cota(lat, lng);
      if (z === null || z === undefined || !isFinite(z)) continue;
      puntos.push({
        d: Math.round(largo * t),
        z: Math.round(z * 10) / 10,
        dentro: typeof op.dentro === 'function' ? !!op.dentro({ lat: lat, lng: lng }) : true
      });
      traza.push({ lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 });
    }
    /* Con menos de tres cotas no hay silueta que dibujar: pasa cuando alguien
       corta por fuera del área analizada, donde no hay rejilla. */
    if (puntos.length < 3) return null;
    return { puntos: puntos, traza: traza, largoM: Math.round(largo) };
  }

  /* El corte ya con su nombre, listo para meterlo entre los del motor: misma
     forma, así que la ficha, la lámina, el PDF y las líneas del mapa lo
     tratan igual sin enterarse de que este lo dibujó una persona. */
  function corteNuevo(cota, a, b, perfiles, opciones) {
    var c = cortar(cota, a, b, opciones);
    if (!c) return null;
    var L = siguienteLetra(perfiles);
    return {
      id: L + L,
      marca: L, marcaFin: L + '′',
      etiqueta: L + '–' + L + '′ (' + rumbo(a, b) + ')',
      aMano: true,
      puntos: c.puntos, traza: c.traza, largoM: c.largoM
    };
  }

  /* Cómo se llama la dirección del corte, en palabras. Los dos del motor
     dicen «de occidente a oriente» y «de norte a sur»; los de a mano tienen
     que decirlo igual o la lámina mezcla dos idiomas. */
  function rumbo(a, b) {
    var dLat = b.lat - a.lat;
    var dLng = (b.lng - a.lng) * Math.cos(a.lat * Math.PI / 180);
    if (Math.abs(dLng) > Math.abs(dLat) * 2) {
      return dLng > 0 ? 'de occidente a oriente' : 'de oriente a occidente';
    }
    if (Math.abs(dLat) > Math.abs(dLng) * 2) {
      return dLat > 0 ? 'de sur a norte' : 'de norte a sur';
    }
    var ns = dLat > 0 ? 'sur' : 'norte';
    var oe = dLng > 0 ? 'occidente' : 'oriente';
    return 'del ' + ns + '-' + oe + ' al opuesto';
  }

  window.URBIS_CORTES = {
    cortar: cortar, corteNuevo: corteNuevo, siguienteLetra: siguienteLetra,
    rumbo: rumbo
  };
})();
