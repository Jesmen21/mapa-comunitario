/* ═══════════════════════════════════════════════════════════════════════════
   URBIS · Seguimiento Presidencial
   Lee assets/data/seguimiento-presidencial.json y arma la línea de tiempo.
   Toda la información vive en el JSON: la actualización semanal es editar ese
   archivo, sin tocar código.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DATOS = null;
  var filtro = 'todos';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Solo se permiten enlaces http(s): evita que un javascript: en el JSON
  // termine siendo ejecutable desde la ficha.
  function urlSegura(u) {
    var s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }

  var MESES = ['enero','febrero','marzo','abril','mayo','junio',
               'julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function fechaLarga(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return String(iso || '');
    var d = parseInt(p[2], 10), m = parseInt(p[1], 10) - 1;
    return d + ' de ' + (MESES[m] || '') + ' de ' + p[0];
  }

  function diasDesde(iso) {
    var t = new Date(iso + 'T00:00:00').getTime();
    if (isNaN(t)) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }

  function cat(id) {
    return (DATOS.categorias && DATOS.categorias[id]) || { nombre: id, icono: '•', color: '#1E7A4B' };
  }

  function tarjeta(e) {
    var c = cat(e.categoria);
    var url = urlSegura(e.url);
    var contra = e.contrapunto
      ? '<div class="sp-contra"><b>⚖️ CONTRAPUNTO</b><span>' + esc(e.contrapunto) + '</span></div>'
      : '';
    var fuente = url
      ? '<a class="sp-fuente" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">🔗 ' + esc(e.fuente || 'Fuente') + '</a>'
      : '<span class="sp-fuente">' + esc(e.fuente || 'Sin fuente') + '</span>';
    return '<article class="sp-item" style="border-left-color:' + esc(c.color) + '">' +
      '<span class="sp-item-cat">' + esc(c.icono) + ' ' + esc(c.nombre) + '</span>' +
      '<h3>' + esc(e.titulo) + '</h3>' +
      (e.detalle ? '<p>' + esc(e.detalle) + '</p>' : '') +
      contra + fuente +
    '</article>';
  }

  function pintarTimeline() {
    var cont = $('sp-timeline');
    var lista = (DATOS.entradas || []).filter(function (e) {
      return filtro === 'todos' || e.categoria === filtro;
    });

    if (!lista.length) {
      cont.innerHTML = '<div class="sp-vacio">No hay hechos registrados en este tema todavía.</div>';
      return;
    }

    // Agrupar por fecha, manteniendo el orden del JSON (más reciente primero).
    var html = '';
    var fechaActual = null;
    lista.forEach(function (e) {
      if (e.fecha !== fechaActual) {
        fechaActual = e.fecha;
        var aprox = e.precision === 'aproximada'
          ? ' <span class="aprox">· fecha aproximada</span>' : '';
        html += '<div class="sp-fecha">' + esc(fechaLarga(e.fecha)) + aprox + '</div>';
      }
      html += tarjeta(e);
    });
    cont.innerHTML = html;
  }

  function pintarFiltros() {
    var cont = $('sp-filtros');
    var entradas = DATOS.entradas || [];
    var conteo = {};
    entradas.forEach(function (e) { conteo[e.categoria] = (conteo[e.categoria] || 0) + 1; });

    var html = '<button class="sp-chip on" data-cat="todos">Todo <span class="n">' + entradas.length + '</span></button>';
    Object.keys(DATOS.categorias || {}).forEach(function (id) {
      if (!conteo[id]) return; // no mostrar temas sin hechos
      var c = cat(id);
      html += '<button class="sp-chip" data-cat="' + esc(id) + '">' +
        esc(c.icono) + ' ' + esc(c.nombre) + ' <span class="n">' + conteo[id] + '</span></button>';
    });
    cont.innerHTML = html;

    cont.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-cat]');
      if (!b) return;
      filtro = b.getAttribute('data-cat');
      Array.prototype.forEach.call(cont.querySelectorAll('.sp-chip'), function (x) {
        x.classList.toggle('on', x === b);
      });
      pintarTimeline();
    });
  }

  // Balance FODA. Se marca visualmente como INTERPRETACIÓN, distinto de la
  // línea de tiempo que son hechos citados.
  function pintarFoda() {
    var cont = $('sp-foda');
    var f = DATOS.foda;
    if (!cont) return;
    if (!f) { cont.innerHTML = ''; return; }

    var bloques = [
      { k: 'fortalezas',    t: 'Fortalezas',    ico: '💪', sub: 'Lo que ha hecho bien',        cls: 'ok' },
      { k: 'debilidades',   t: 'Debilidades',   ico: '⚠️', sub: 'Fallas propias',             cls: 'mal' },
      { k: 'oportunidades', t: 'Oportunidades', ico: '🚀', sub: 'Lo que puede aprovechar',    cls: 'ok2' },
      { k: 'amenazas',      t: 'Amenazas',      ico: '🌩️', sub: 'Riesgos que no controla',    cls: 'mal2' }
    ];

    cont.innerHTML = bloques.map(function (b) {
      var lista = f[b.k] || [];
      if (!lista.length) return '';
      return '<div class="sp-foda-card sp-foda-' + b.cls + '">' +
        '<div class="sp-foda-head"><span>' + b.ico + '</span><div><b>' + b.t + '</b>' +
          '<small>' + esc(b.sub) + '</small></div><i>' + lista.length + '</i></div>' +
        '<ul>' + lista.map(function (x) {
          return '<li><b>' + esc(x.t) + '</b><span>' + esc(x.d) + '</span></li>';
        }).join('') + '</ul>' +
      '</div>';
    }).join('');
  }

  function pintarTransversales() {
    var cont = $('sp-transversales');
    var lista = DATOS.transversales || [];
    if (!lista.length) { cont.innerHTML = ''; return; }
    cont.innerHTML = lista.map(function (t) {
      return tarjeta({
        categoria: t.categoria, titulo: t.titulo, detalle: t.detalle,
        fuente: t.fuente, url: t.url, contrapunto: t.contrapunto
      });
    }).join('');
  }

  function pintarCabecera() {
    $('sp-nombre').textContent = DATOS.presidente || '—';
    $('sp-periodo').textContent = 'Periodo ' + (DATOS.periodo || '') +
      ' · posesión el ' + fechaLarga(DATOS.posesion);
    $('sp-dias').textContent = diasDesde(DATOS.posesion);

    var total = (DATOS.entradas || []).length + (DATOS.transversales || []).length;
    $('sp-total').textContent = total;

    // Fuentes distintas (dominio), para que el número signifique algo.
    var dominios = {};
    (DATOS.entradas || []).concat(DATOS.transversales || []).forEach(function (e) {
      var u = urlSegura(e.url);
      if (!u) return;
      try { dominios[new URL(u).hostname.replace(/^www\./, '')] = true; } catch (x) {}
    });
    $('sp-fuentes').textContent = Object.keys(dominios).length;

    $('sp-actualizado').textContent = fechaLarga(DATOS.actualizado);
    $('sp-proxima').textContent = fechaLarga(DATOS.proximaActualizacion);
    $('sp-sub').textContent = 'Actualizado el ' + fechaLarga(DATOS.actualizado);
  }

  function error(msg) {
    $('sp-timeline').innerHTML = '<div class="sp-vacio">' + esc(msg) + '</div>';
    $('sp-sub').textContent = 'Error al cargar';
  }

  fetch('assets/data/seguimiento-presidencial.json?v=' + Date.now())
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (j) {
      DATOS = j;
      pintarCabecera();
      pintarFiltros();
      pintarTimeline();
      pintarFoda();
      pintarTransversales();
    })
    .catch(function (e) {
      error('No se pudo cargar el seguimiento (' + e.message + '). Revisa tu conexión y vuelve a intentar.');
    });
})();
