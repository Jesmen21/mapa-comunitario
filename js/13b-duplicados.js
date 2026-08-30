/* URBIS · ¿ESTO YA ESTÁ REPORTADO? (js/13b)
   ─────────────────────────────────────────────────────────────────────────
   Diez vecinos ven el mismo poste caído y salen diez marcadores encima del
   mismo poste. El mapa se ve lleno y no dice nada: ni la alcaldía sabe si son
   diez problemas o uno, ni el vecino once sabe si ya avisaron.

   Un reporte con doce apoyos pesa en una mesa de trabajo. Doce reportes
   sueltos son ruido. Así que antes de publicar se mira si ya hay algo igual
   ahí mismo y se ofrece SUMARSE en vez de repetir.

   Dos decisiones que importan:

   · Se PREGUNTA, no se bloquea. El parecido lo calcula una fórmula; quien
     está parado en la esquina sabe si son dos huecos distintos o el mismo, y
     esa persona decide. Un duplicado de más es molesto; un reporte real
     bloqueado es un problema que nadie vuelve a contar.

   · Sumarse no es "no hacer nada": registra que el problema SIGUE OCURRIENDO
     hoy. Eso refresca el reporte viejo, que es exactamente lo que el mapa
     necesita (ver la vigencia en js/12). Quien llegó a reportar aportó
     información aunque no haya creado un marcador nuevo.

   No tiene dependencias de la app grande: la usa igual URBIS completo y la
   app liviana de reportes, que comparten el mismo formulario. */
(function () {
  'use strict';

  // A qué distancia dos reportes de LO MISMO son, con toda probabilidad, el
  // mismo hecho. 80 m es aproximadamente una cuadra: el GPS de un teléfono en
  // ciudad se equivoca decenas de metros y la gente marca "por donde es", no
  // sobre el objeto exacto.
  const RADIO_MISMO_HECHO = 80;
  // Reportes de la misma categoría pero de otra cosa: no son duplicados, pero
  // saber que ahí al lado ya hay algo evita repetir el viaje. Solo se informa.
  const RADIO_VECINDAD = 40;

  function quitarAcentos(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function metrosEntre(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 +
              Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ¿Los dos reportes hablan de la misma cosa? El catálogo es cerrado (125
  // tipos), así que casi siempre es una coincidencia exacta. Se contempla
  // además que uno contenga al otro porque hay tipos que se escribieron dos
  // veces con distinto detalle a lo largo del tiempo ("Hueco" / "Hueco en la
  // vía"), y para el vecino son el mismo hueco.
  function mismoAsunto(a, b) {
    const x = quitarAcentos(a), y = quitarAcentos(b);
    if (!x || !y) return false;
    if (x === y) return true;
    return (x.length >= 6 && y.length >= 6) && (x.indexOf(y) !== -1 || y.indexOf(x) !== -1);
  }

  function datos() {
    try {
      if (Array.isArray(window.globalData)) return window.globalData;
      if (typeof globalData !== 'undefined' && Array.isArray(globalData)) return globalData;
    } catch (e) {}
    return [];
  }

  // Un reporte archivado o vencido ya no está en el mapa: publicar otra vez
  // sobre él es correcto, no es un duplicado.
  function sigueEnElMapa(p) {
    try {
      if (typeof obtenerMetaTemporal !== 'function') return true;
      const m = obtenerMetaTemporal(p);
      if (m && m.archivado) return false;
      if (m && m.temporal && m.expira && new Date(m.expira).getTime() < Date.now()) return false;
    } catch (e) {}
    return true;
  }

  function diasDe(p) {
    try {
      if (typeof window.urbisVigenciaReporte === 'function') {
        const v = window.urbisVigenciaReporte(p);
        if (v && v.dias != null) return v.dias;
      }
    } catch (e) {}
    return null;
  }

  /* Devuelve { mismos, vecinos } ordenados por cercanía. `mismos` son los
     candidatos a duplicado; `vecinos` es contexto, nunca dispara la pregunta. */
  window.urbisBuscarDuplicados = function (categoria, item, lat, lng) {
    const centro = { lat: parseFloat(lat), lng: parseFloat(lng) };
    const vacio = { mismos: [], vecinos: [] };
    if (!isFinite(centro.lat) || !isFinite(centro.lng)) return vacio;

    const mismos = [], vecinos = [];
    datos().forEach(function (p) {
      if (!p || p.tipo !== categoria) return;
      const plat = parseFloat(String(p.lat).replace(',', '.'));
      const plng = parseFloat(String(p.lng).replace(',', '.'));
      if (!isFinite(plat) || !isFinite(plng)) return;
      const metros = metrosEntre(centro, { lat: plat, lng: plng });
      if (metros > RADIO_MISMO_HECHO) return;
      if (!sigueEnElMapa(p)) return;

      const d = String(p.descripcion || '').split(' | ');
      const ficha = { punto: p, metros: Math.round(metros), item: d[0] || '',
                      titulo: (d[1] || '').trim(), dias: diasDe(p) };
      if (mismoAsunto(d[0], item)) mismos.push(ficha);
      else if (metros <= RADIO_VECINDAD) vecinos.push(ficha);
    });
    mismos.sort(function (a, b) { return a.metros - b.metros; });
    vecinos.sort(function (a, b) { return a.metros - b.metros; });
    return { mismos: mismos, vecinos: vecinos };
  };

  function cuando(dias) {
    if (typeof window.urbisHaceCuanto === 'function') return window.urbisHaceCuanto(dias);
    return dias == null ? '' : ('hace ' + dias + ' días');
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Muestra la pregunta y resuelve con lo que la persona decida:
       'sumarse'  → se suma al reporte que ya existe (no se crea uno nuevo)
       'publicar' → es otra cosa, sigue adelante
       'cancelar' → cerró sin decidir; no se publica nada  */
  window.urbisPreguntarDuplicado = function (hallazgo, item) {
    const mismos = (hallazgo && hallazgo.mismos) || [];
    if (!mismos.length) return Promise.resolve('publicar');

    return new Promise(function (resolver) {
      const previo = document.getElementById('urbis-dup-overlay');
      if (previo) previo.remove();

      const n = mismos.length;
      const lista = mismos.slice(0, 3).map(function (c) {
        const nombre = c.titulo && c.titulo !== 'N/A' ? c.titulo : c.item;
        const edad = c.dias != null ? ' · reportado ' + cuando(c.dias) : '';
        return '<button type="button" class="ud-card" data-lat="' + esc(c.punto.lat) + '">' +
                 '<div class="ud-card-txt"><b>' + esc(nombre) + '</b>' +
                 '<small>A ' + c.metros + ' m de aquí' + esc(edad) + '</small></div>' +
                 '<span class="ud-card-go">Es este →</span>' +
               '</button>';
      }).join('');

      const vecinos = (hallazgo.vecinos || []).length;
      const notaVecinos = vecinos
        ? '<div class="ud-vecinos">Además hay ' + vecinos +
          (vecinos === 1 ? ' reporte' : ' reportes') + ' de otra cosa muy cerca.</div>'
        : '';

      const ov = document.createElement('div');
      ov.id = 'urbis-dup-overlay';
      ov.className = 'urbis-dup-overlay';
      ov.innerHTML =
        '<div class="urbis-dup" role="dialog" aria-modal="true" aria-labelledby="ud-title">' +
          '<div class="ud-head">' +
            '<h3 id="ud-title">' + (n === 1 ? 'Esto ya está reportado aquí' : 'Ya hay ' + n + ' reportes de esto aquí') + '</h3>' +
            '<p>Si es el mismo caso, súmate al reporte que ya existe: uno con muchos apoyos pesa mucho más que muchos repetidos, y de paso queda dicho que <b>sigue ocurriendo hoy</b>.</p>' +
          '</div>' +
          '<div class="ud-lista">' + lista + '</div>' +
          notaVecinos +
          '<button type="button" class="ud-otro">No, lo mío es otro caso distinto</button>' +
          '<button type="button" class="ud-cancelar">Cancelar</button>' +
        '</div>';
      document.body.appendChild(ov);

      let resuelto = false;
      function cerrar(res) {
        if (resuelto) return;
        resuelto = true;
        try { ov.remove(); } catch (e) {}
        resolver(res);
      }

      ov.querySelectorAll('.ud-card').forEach(function (b) {
        b.addEventListener('click', function () {
          const lat = b.getAttribute('data-lat');
          try {
            if (typeof window.validarReporteCiudadano === 'function') {
              // "Sigue ocurriendo": es información nueva y de hoy sobre un
              // reporte viejo, que es justo lo que hacía falta.
              window.validarReporteCiudadano(lat, 'ongoing', null);
            }
          } catch (e) {}
          cerrar('sumarse');
        });
      });
      ov.querySelector('.ud-otro').addEventListener('click', function () { cerrar('publicar'); });
      ov.querySelector('.ud-cancelar').addEventListener('click', function () { cerrar('cancelar'); });
      // Tocar fuera equivale a cancelar: no se publica por accidente.
      ov.addEventListener('click', function (e) { if (e.target === ov) cerrar('cancelar'); });
    });
  };

  /* Punto de entrada para el guardado: decide si hay que preguntar y qué
     hacer. Devuelve 'publicar' cuando el reporte debe seguir su camino. */
  window.urbisRevisarDuplicadoAntesDePublicar = function (categoria, item, lat, lng) {
    let hallazgo;
    try { hallazgo = window.urbisBuscarDuplicados(categoria, item, lat, lng); }
    catch (e) { return Promise.resolve('publicar'); } // ante la duda, publicar
    if (!hallazgo.mismos.length) return Promise.resolve('publicar');
    return window.urbisPreguntarDuplicado(hallazgo, item);
  };
})();
