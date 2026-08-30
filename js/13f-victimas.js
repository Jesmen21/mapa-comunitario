/* URBIS · ¿HUBO GENTE HERIDA? (js/13f)
   ─────────────────────────────────────────────────────────────────────────
   Hasta ahora un accidente de tránsito se publicaba con dirección, foto y una
   nota libre de 180 caracteres. Quien quisiera decir que hubo un muerto tenía
   que escribirlo en la nota, y ahí queda como texto suelto que ningún análisis
   puede contar. Es la diferencia entre un mapa que dice "aquí hubo choques" y
   uno que dice dónde se está matando gente — que es lo que de verdad mueve a
   una secretaría de tránsito o de gestión del riesgo.

   Tres decisiones que sostienen esto:

   · "NO SE SABE" NO ES "NO HUBO". Es la misma regla que la ficha del edificio,
     y aquí importa el doble: quien pasa por un accidente casi nunca sabe si
     hay heridos dentro del carro. Si la ausencia de dato se leyera como
     "cero víctimas", el mapa acabaría diciendo que en la ciudad no se muere
     nadie. Sin registrar, "no se sabe" y "ninguno" son TRES cosas distintas y
     se guardan distinto.

   · CIFRAS PEQUEÑAS Y EXACTAS, LUEGO UN TRAMO. Hasta tres se cuenta con la
     vista y la gente acierta; de ahí para arriba se estima. Pedir un número
     libre invita a inventar. Entre uno y dos fallecidos hay una diferencia que
     importa; entre siete y nueve, en un reporte ciudadano, no la hay.

   · SIN IDENTIFICAR A NADIE. Ni nombres, ni placas, ni el estado de una
     persona concreta. Se cuenta cuántas, no quiénes.

   No aplica al conflicto armado, a propósito: un conteo de muertos de una
   masacre o un atentado es una cifra política que publican autoridades con
   verificación, y equivocarla tiene consecuencias para la comunidad y para
   quien reporta. La lista de qué reportes lo piden vive en js/03c
   (URBIS_VICTIMAS_IDS). */
(function () {
  'use strict';

  const PREFIJO = 'VICTIMAS_URBIS:';
  const NO_SE_SABE = 'no_se_sabe';

  // Escala de conteo. '' = no registrado; NO_SE_SABE = se miró y no se pudo
  // saber; el resto son observaciones.
  const ESCALA = [
    { v: '0', etiqueta: 'Ninguno' },
    { v: '1', etiqueta: '1' },
    { v: '2', etiqueta: '2' },
    { v: '3', etiqueta: '3' },
    { v: '4+', etiqueta: '4 o más' },
    { v: NO_SE_SABE, etiqueta: 'No se sabe' }
  ];

  function slot() {
    if (window.URBIS_SLOTS && window.URBIS_SLOTS.victimas != null) return window.URBIS_SLOTS.victimas;
    return null;
  }

  /* ¿Este tipo de reporte pregunta por víctimas? Se resuelve por el catálogo,
     que es la única fuente de verdad de las categorías. */
  window.urbisPreguntaPorVictimas = function (idOEtiqueta) {
    const ids = window.URBIS_VICTIMAS_IDS;
    if (!ids) return false;
    if (ids.has(String(idOEtiqueta || ''))) return true;
    // También por etiqueta, porque el guardado (js/12) solo conoce el texto.
    const cat = window.URBIS_QUICK_REPORTS || {};
    const buscado = String(idOEtiqueta || '').trim().toLowerCase();
    let si = false;
    Object.keys(cat).forEach(function (k) {
      if (si) return;
      if (String(cat[k].label || '').trim().toLowerCase() === buscado) si = ids.has(k);
    });
    return si;
  };

  function valido(v) {
    const t = String(v == null ? '' : v).trim();
    return ESCALA.some(function (e) { return e.v === t; }) ? t : '';
  }

  /* Lee lo guardado. Devuelve siempre los tres estados posibles bien
     separados, porque de eso depende que el análisis no mienta. */
  window.urbisLeerVictimas = function (descripcion) {
    const idx = slot();
    const vacio = { registrado: false, heridos: '', fallecidos: '',
                    heridosSabidos: false, fallecidosSabidos: false,
                    nHeridos: null, nFallecidos: null, resumen: '' };
    if (idx == null) return vacio;
    const raw = String(String(descripcion || '').split(' | ')[idx] || '');
    if (raw.indexOf(PREFIJO) !== 0) return vacio;
    let o;
    try { o = JSON.parse(decodeURIComponent(raw.slice(PREFIJO.length))); }
    catch (e) { return vacio; }

    const h = valido(o.h), f = valido(o.f);
    if (!h && !f) return vacio;
    const num = function (v) {
      // '4+' no es un número: devolver 4 sería inventar un dato exacto que
      // nadie observó. Quien sume que decida qué hacer con el tramo.
      if (v === '' || v === NO_SE_SABE || v === '4+') return null;
      return parseInt(v, 10);
    };
    const r = { registrado: true, heridos: h, fallecidos: f,
                heridosSabidos: !!h && h !== NO_SE_SABE,
                fallecidosSabidos: !!f && f !== NO_SE_SABE,
                nHeridos: num(h), nFallecidos: num(f), resumen: '' };
    r.resumen = window.urbisResumenVictimas(r);
    return r;
  };

  /* Cómo se cuenta en pantalla. Nunca dice "0 fallecidos" cuando nadie lo
     miró: eso sería afirmar lo que no se observó. */
  window.urbisResumenVictimas = function (v) {
    if (!v || !v.registrado) return '';
    const trozo = function (valor, uno, varios) {
      if (!valor) return '';
      if (valor === NO_SE_SABE) return 'no se sabe si hay ' + varios;
      if (valor === '0') return 'sin ' + varios;
      if (valor === '1') return '1 ' + uno;
      if (valor === '4+') return '4 o más ' + varios;
      return valor + ' ' + varios;
    };
    const f = trozo(v.fallecidos, 'fallecido', 'fallecidos');
    const h = trozo(v.heridos, 'herido', 'heridos');
    return [f, h].filter(Boolean).join(' · ');
  };

  /* Escribe la respuesta en la descripción y la devuelve. `heridos` y
     `fallecidos` son valores de la escala; '' deja el campo sin registrar. */
  window.urbisGuardarVictimas = function (descripcion, heridos, fallecidos) {
    const idx = slot();
    if (idx == null) return String(descripcion || '');
    const h = valido(heridos), f = valido(fallecidos);
    const d = String(descripcion || '').split(' | ');
    for (let k = 0; k < idx; k++) if (d[k] === undefined) d[k] = '';
    d[idx] = (!h && !f) ? '' : (PREFIJO + encodeURIComponent(JSON.stringify({ h: h, f: f })));
    return d.join(' | ');
  };

  // ── El bloque del formulario ─────────────────────────────────────────────
  function opciones(nombre) {
    return ESCALA.map(function (e) {
      return '<option value="' + e.v + '"' + (e.v === NO_SE_SABE ? ' selected' : '') + '>' +
             e.etiqueta + '</option>';
    }).join('');
  }

  /* HTML para insertar en el panel de reporte rápido. Arranca cerrado con una
     sola pregunta: la mayoría de los reportes no tienen víctimas y no hay por
     qué hacerles llenar dos selectores para decir que no. */
  window.urbisBloqueVictimas = function () {
    return '' +
      '<div class="urbis-victimas" id="urbis-victimas">' +
        '<b class="uv2-pregunta">¿Hay personas heridas o fallecidas?</b>' +
        '<div class="uv2-opciones">' +
          '<button type="button" class="uv2-op" data-uv2="no">No, nadie</button>' +
          '<button type="button" class="uv2-op" data-uv2="si">Sí, hay</button>' +
          '<button type="button" class="uv2-op" data-uv2="nose">No lo sé</button>' +
        '</div>' +
        '<div class="uv2-detalle" hidden>' +
          '<label>Heridos<select id="uv2-heridos">' + opciones() + '</select></label>' +
          '<label>Fallecidos<select id="uv2-fallecidos">' + opciones() + '</select></label>' +
          '<small>Cuenta cuántas personas, sin nombres, placas ni fotos de nadie.</small>' +
        '</div>' +
      '</div>';
  };

  /* Conecta los botones del bloque. Guarda la elección en el propio elemento
     para que el guardado la lea sin depender del orden del DOM. */
  window.urbisActivarBloqueVictimas = function (raiz) {
    const bloque = (raiz || document).querySelector('#urbis-victimas');
    if (!bloque) return;
    const detalle = bloque.querySelector('.uv2-detalle');
    bloque.querySelectorAll('.uv2-op').forEach(function (b) {
      b.addEventListener('click', function () {
        bloque.querySelectorAll('.uv2-op').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        const r = b.getAttribute('data-uv2');
        bloque.dataset.uv2Respuesta = r;
        detalle.hidden = (r !== 'si');
      });
    });
  };

  /* Lee lo que quedó marcado en el formulario. Devuelve {heridos, fallecidos}
     con los valores de la escala.

     El caso "no lo sé" y el caso "no contestó" se guardan DISTINTO: el primero
     es una observación ("miré y no pude saberlo") y el segundo es un vacío. Si
     los uniéramos, un reporte que nadie contestó parecería uno donde alguien
     miró, y el mapa afirmaría cosas que nadie vio. */
  window.urbisLeerFormularioVictimas = function (raiz) {
    const bloque = (raiz || document).querySelector('#urbis-victimas');
    if (!bloque) return { heridos: '', fallecidos: '' };
    const r = bloque.dataset.uv2Respuesta || '';
    if (r === 'no') return { heridos: '0', fallecidos: '0' };
    if (r === 'nose') return { heridos: NO_SE_SABE, fallecidos: NO_SE_SABE };
    if (r === 'si') {
      return { heridos: (bloque.querySelector('#uv2-heridos') || {}).value || NO_SE_SABE,
               fallecidos: (bloque.querySelector('#uv2-fallecidos') || {}).value || NO_SE_SABE };
    }
    return { heridos: '', fallecidos: '' };   // no contestó: sin registrar
  };

  window.URBIS_VICTIMAS_ESCALA = ESCALA.slice();
  window.URBIS_VICTIMAS_NO_SE_SABE = NO_SE_SABE;
})();
