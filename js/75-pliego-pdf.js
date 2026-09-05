/* URBIS · El pliego, en PDF y del tamaño que es.

   El problema, dicho con una captura del diálogo de Android encima: al
   imprimir la lámina, el teléfono abre SU cuadro de «Guardar como PDF» y
   ofrece su propia lista de papeles —Carta, Oficio, Tabloide, ANSI, Arch—.
   Ninguno mide 90 × 60. El `@page { size: 900mm 600mm }` de la hoja lo lee
   el navegador de escritorio; el servicio de impresión del sistema lo
   ignora y encaja la lámina en el papel que él eligió. El resultado es un
   pliego reducido a una hoja carta con márgenes, que no sirve para colgar
   ni para plotear.

   Así que el PDF se arma acá, sin pedirle permiso al sistema y sin pasar por
   otra pestaña: la lámina se dibuja sobre un lienzo del tamaño exacto y se
   empaqueta en un PDF de una página de 900 × 600 mm, que se baja como
   archivo. Lo que se abre después es el archivo, ya con su tamaño escrito
   dentro.

   Cómo, sin traer ninguna biblioteca:

     1. La lámina es HTML con SVG adentro. Se vuelve a serializar como XML
        —con DOMParser y XMLSerializer, que arreglan de paso las etiquetas
        que el HTML permite dejar abiertas— y se mete en un `<foreignObject>`
        dentro de un SVG del tamaño del papel.
     2. Ese SVG se carga como imagen y se dibuja en un lienzo. Es el propio
        navegador el que compone la lámina: mismas fuentes, mismos colores,
        mismos dibujos.
     3. El lienzo se pasa a JPEG y el JPEG se envuelve en un PDF escrito a
        mano. Un PDF de una página con una imagen son seis objetos y una
        tabla de posiciones; no hace falta más.

   Lo que se pierde: el texto queda dibujado, no seleccionable. Es el precio
   de no traer un motor de PDF de un megabyte a una aplicación que se usa en
   la calle con datos móviles. A cambio, el pliego sale del tamaño que es.  */
(function () {
  'use strict';

  var PX_POR_MM = 96 / 25.4;          // el milímetro del navegador
  var PT_POR_MM = 72 / 25.4;          // el milímetro del PDF

  /* La resolución. 150 puntos por pulgada es lo que pide una imprenta para
     algo que se mira de cerca; 90 × 60 cm a 150 ppp son 5.315 × 3.543 píxeles
     y unos 75 MB de lienzo, que un teléfono de gama media no siempre puede
     reservar. Se intenta de más a menos y se usa la primera que el navegador
     acepte de verdad —se comprueba, no se supone—. A 96 ppp el pliego sigue
     siendo legible a un metro, que es como se mira una lámina colgada. */
  var CALIDADES = [120, 96, 72];

  function medirEnPx(mm) { return Math.round(mm * PX_POR_MM); }

  /* La lámina, como una imagen SVG del tamaño del papel.

     El `<style>` de la hoja viaja dentro del `<foreignObject>`: ahí no hay
     `<head>` que valga y sin él la lámina saldría sin una sola regla. */
  function svgDeLaLamina(html, anchoMM, altoMM, escala) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    /* Las reglas de `html, body` —la tipografía, el color de la tinta, el
       ajuste de color para impresión— también valen para el envoltorio.

       Dentro de un `foreignObject` no hay `html` ni `body`: hay un `div`. Sin
       esto, la primera prueba salió con la lámina entera compuesta en la
       fuente por defecto del navegador, con serifas: el mismo pliego con otra
       letra. Se añade el envoltorio a esos selectores en vez de repetir la
       tipografía acá, para que siga siendo la de la hoja aunque cambie. */
    var estilos = Array.prototype.map.call(doc.querySelectorAll('style'), function (s) {
      return String(s.textContent || '').replace(/html\s*,\s*body\s*\{/g,
        'html,body,.urbis-pliego-raiz{');
    }).join('\n');
    var ser = new XMLSerializer();
    var cuerpo = Array.prototype.map.call(doc.body.childNodes, function (n) {
      return ser.serializeToString(n);
    }).join('');
    var w = medirEnPx(anchoMM), h = medirEnPx(altoMM);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(w * escala) +
      '" height="' + Math.round(h * escala) + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" class="urbis-pliego-raiz" style="width:' + w +
      'px;height:' + h + 'px;margin:0;padding:0;background:#fff">' +
      '<style>' + estilos + '</style>' + cuerpo +
      '</div></foreignObject></svg>';
  }

  /* El SVG viaja como `data:` y NO como `blob:`.

     MEDIDO en el navegador de este proyecto: una imagen SVG cargada desde una
     URL de blob MANCHA el lienzo —`Tainted canvases may not be exported`— y
     entonces no hay JPEG, no hay PDF y no hay lámina. Desde una `data:` no.
     Es la misma imagen y el mismo origen; la regla del navegador distingue
     igual, así que se usa la que funciona.

     En base64 y no en porcentajes: la lámina son doscientos y pico kilobytes
     y el porcentaje los triplica. Se codifica a UTF-8 antes, por trozos,
     porque `btoa` no entiende ni una tilde y un `apply` con medio millón de
     argumentos revienta la pila. */
  function comoDataURL(svgTexto) {
    var bytes = new TextEncoder().encode(svgTexto);
    var s = '', paso = 8192;
    for (var i = 0; i < bytes.length; i += paso) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + paso));
    }
    return 'data:image/svg+xml;base64,' + btoa(s);
  }

  function dibujar(svgTexto, w, h) {
    return new Promise(function (listo, falla) {
      var url = comoDataURL(svgTexto);
      var im = new Image();
      var reloj = setTimeout(function () {
        falla(new Error('la lámina tardó demasiado en dibujarse'));
      }, 30000);
      im.onload = function () {
        clearTimeout(reloj);
        try {
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          var x = c.getContext('2d');
          if (!x) throw new Error('sin lienzo');
          // Fondo blanco: un JPEG no tiene transparencia y sin esto el papel
          // saldría negro donde la lámina no pinta nada.
          x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
          x.drawImage(im, 0, 0, w, h);
          listo(c);
        } catch (e) { falla(e); }
      };
      im.onerror = function () {
        clearTimeout(reloj);
        falla(new Error('el navegador no pudo dibujar la lámina'));
      };
      im.src = url;
    });
  }

  // De «data:image/jpeg;base64,…» a los bytes de verdad.
  function bytesDe(dataUrl) {
    var coma = dataUrl.indexOf(',');
    var cruda = atob(dataUrl.slice(coma + 1));
    var a = new Uint8Array(cruda.length);
    for (var i = 0; i < cruda.length; i++) a[i] = cruda.charCodeAt(i);
    return a;
  }

  function texto(s) {
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff;
    return a;
  }

  /* El PDF, escrito a mano.

     Seis objetos: catálogo, árbol de páginas, la página, el flujo que dibuja,
     la imagen y los metadatos. Lo único delicado es la tabla `xref`: guarda
     en qué byte empieza cada objeto, así que hay que ir contando mientras se
     escribe. Un byte de más y el archivo no abre. */
  function pdfConImagen(jpeg, imW, imH, anchoMM, altoMM, titulo) {
    var W = (anchoMM * PT_POR_MM).toFixed(2), H = (altoMM * PT_POR_MM).toFixed(2);
    var trozos = [], largo = 0, posiciones = [];
    function poner(x) {
      var b = (x instanceof Uint8Array) ? x : texto(x);
      trozos.push(b); largo += b.length;
    }
    function objeto(n, cuerpo, flujo) {
      posiciones[n] = largo;
      poner(n + ' 0 obj\n' + cuerpo + '\n');
      if (flujo) { poner('stream\n'); poner(flujo); poner('\nendstream\n'); }
      poner('endobj\n');
    }
    var fecha = (function () {
      var d = new Date(), dd = function (v) { return (v < 10 ? '0' : '') + v; };
      return 'D:' + d.getFullYear() + dd(d.getMonth() + 1) + dd(d.getDate()) +
             dd(d.getHours()) + dd(d.getMinutes()) + dd(d.getSeconds());
    })();
    var limpio = String(titulo || 'Lámina URBIS').replace(/[\\()\r\n]/g, ' ');

    poner('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objeto(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objeto(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + ']' +
      ' /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
    var dibujo = W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do';
    objeto(4, '<< /Length ' + dibujo.length + ' >>', dibujo);
    objeto(5, '<< /Type /XObject /Subtype /Image /Width ' + imW + ' /Height ' + imH +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
      jpeg.length + ' >>', jpeg);
    objeto(6, '<< /Title (' + limpio + ') /Producer (URBIS Pro City) /Creator (URBIS Pro City)' +
      ' /CreationDate (' + fecha + ') >>');

    var inicioXref = largo;
    var xref = 'xref\n0 7\n0000000000 65535 f \n';
    for (var n = 1; n <= 6; n++) {
      xref += ('0000000000' + posiciones[n]).slice(-10) + ' 00000 n \n';
    }
    poner(xref);
    poner('trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + inicioXref + '\n%%EOF\n');

    var total = new Uint8Array(largo), i = 0;
    trozos.forEach(function (t) { total.set(t, i); i += t.length; });
    return new Blob([total], { type: 'application/pdf' });
  }

  /* Cuánto lienzo aguanta este teléfono. No se pregunta: se prueba. Un
     `canvas` demasiado grande no lanza ningún error —devuelve un lienzo en
     blanco, que es peor—, así que se pinta un píxel y se lee. */
  function cabeElLienzo(w, h) {
    try {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var x = c.getContext('2d');
      if (!x) return false;
      x.fillStyle = '#123456'; x.fillRect(0, 0, 2, 2);
      var d = x.getImageData(0, 0, 1, 1).data;
      return d[0] === 0x12 && d[1] === 0x34 && d[2] === 0x56;
    } catch (e) { return false; }
  }

  /* ¿Se dibujó algo, o quedó un papel en blanco?

     Es la falla silenciosa de este camino: un lienzo demasiado grande para el
     teléfono NO lanza ningún error —se reserva, se dibuja encima y sale todo
     blanco—, y entonces el PDF pesa lo que pesa y no tiene nada dentro. Se
     mira una parrilla de puntos repartidos por la hoja; si TODOS son del mismo
     color, no se dibujó la lámina.

     Se muestrea con `getImageData` de a un píxel y no la hoja entera: leer
     dieciocho millones de píxeles para saber si hay algo cuesta más que
     dibujarlos. */
  function tieneDibujo(lienzo) {
    try {
      var x = lienzo.getContext('2d');
      var w = lienzo.width, h = lienzo.height, distintos = 0, primero = null;
      for (var i = 1; i <= 6; i++) {
        for (var j = 1; j <= 6; j++) {
          var d = x.getImageData(Math.round(w * i / 7), Math.round(h * j / 7), 1, 1).data;
          var clave = d[0] + ',' + d[1] + ',' + d[2];
          if (primero === null) primero = clave;
          else if (clave !== primero) distintos++;
        }
      }
      return distintos > 0;
    } catch (e) { return false; }
  }

  /* Un intento completo a una resolución: componer, dibujar, comprobar que
     hay algo y comprimir. Cualquier tropiezo devuelve null y el de arriba
     baja un escalón. */
  async function intentar(html, anchoMM, altoMM, dpi) {
    var base = { w: medirEnPx(anchoMM), h: medirEnPx(altoMM) };
    var k = dpi / 96;
    var w = Math.round(base.w * k), h = Math.round(base.h * k);
    if (!cabeElLienzo(w, h)) return null;
    var lienzo = await dibujar(svgDeLaLamina(html, anchoMM, altoMM, k), w, h);
    if (!tieneDibujo(lienzo)) { lienzo.width = lienzo.height = 1; return null; }
    var url = lienzo.toDataURL('image/jpeg', 0.92);
    lienzo.width = lienzo.height = 1;     // decenas de megabytes: se sueltan ya
    if (!/^data:image\/jpeg/.test(url) || url.length < 5000) return null;
    return { jpeg: bytesDe(url), w: w, h: h, dpi: dpi };
  }

  /* ── Armar el PDF ──────────────────────────────────────────────────────
     Se prueba de más fino a más grueso y se hace TODO el camino en cada
     intento, no solo reservar el lienzo.

     Estaba al revés: se elegía la resolución comprobando que el lienzo se
     pudiera reservar, y con eso se daba por buena. Pero reservar es lo barato:
     lo que se cae en un teléfono es dibujar dieciocho millones de píxeles y
     comprimirlos, y eso pasaba DESPUÉS de haber elegido. El fallo llegaba al
     final, se caía al camino viejo —el cuadro de impresión de Android, con su
     lista de papeles— y desde afuera se veía como si el botón nuevo no
     hiciera nada: «al darle guardar PDF me sale esa opción azul otra vez».

     Y se empieza en 120 y no en 150: a 90 cm de ancho son 4.252 píxeles, que
     es más de lo que resuelve un plotter a un metro de distancia, y le quita
     al teléfono un tercio de la memoria del intento. */
  async function generar(html, opts) {
    var o = opts || {};
    var anchoMM = o.anchoMM || 900, altoMM = o.altoMM || 600;
    var avisar = typeof o.alAvisar === 'function' ? o.alAvisar : function () {};
    var fallos = [];
    for (var i = 0; i < CALIDADES.length; i++) {
      var dpi = CALIDADES[i];
      try {
        avisar('Dibujando la lámina a ' + dpi + ' puntos por pulgada…');
        var r = await intentar(html, anchoMM, altoMM, dpi);
        if (r) {
          var blob = pdfConImagen(r.jpeg, r.w, r.h, anchoMM, altoMM, o.titulo);
          return { blob: blob, dpi: dpi, bytes: blob.size, ancho: r.w, alto: r.h,
                   intentos: i + 1, bajadas: fallos };
        }
        fallos.push(dpi + ' ppp: no cupo');
      } catch (e) {
        fallos.push(dpi + ' ppp: ' + ((e && e.message) || e));
      }
    }
    throw new Error('no se pudo componer la imagen del pliego (' + fallos.join('; ') + ')');
  }

  function bajar(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nombre;
    a.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { a.remove(); } catch (e) {}
      URL.revokeObjectURL(url);
    }, 4000);
  }

  window.URBIS_PLIEGO_PDF = {
    generar: generar,
    bajar: bajar,
    // Para que quien lo llame pueda decir «este navegador no puede» antes de
    // ofrecer el botón, en vez de después de un minuto de espera.
    disponible: function () {
      return typeof Blob === 'function' && typeof URL !== 'undefined' &&
             typeof URL.createObjectURL === 'function' &&
             typeof DOMParser === 'function' && typeof XMLSerializer === 'function' &&
             !!document.createElement('canvas').getContext;
    }
  };
})();
