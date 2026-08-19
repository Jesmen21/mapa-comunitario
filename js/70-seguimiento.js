/* ═══════════════════════════════════════════════════════════════════════════
   URBIS · Seguimiento Presidencial
   Lee assets/data/seguimiento-presidencial.json y lo renderiza como una serie
   de VISTAS (portada → tema → lista → detalle). Toda la información sigue
   viviendo en el JSON: actualizar contenido = editar datos, nunca código.

   La navegación es por rutas hash, así el botón atrás del navegador y el de la
   barra hacen lo mismo, y un enlace profundo abre donde debe.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var D = null;                 // datos del JSON
  var ruta = { v: 'home' };     // vista actual
  var filtro = { tema: 'todos', tipo: 'todos' };
  var fodaSel = 'fortalezas';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  // Solo http(s): evita que un javascript: en el JSON sea clicable.
  function urlSegura(u) {
    var s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }

  var MESES = ['enero','febrero','marzo','abril','mayo','junio',
               'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var MESES_C = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  function fechaLarga(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return String(iso || '');
    return parseInt(p[2], 10) + ' de ' + (MESES[+p[1] - 1] || '') + ' de ' + p[0];
  }
  function fechaCorta(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return String(iso || '');
    return parseInt(p[2], 10) + ' ' + (MESES_C[+p[1] - 1] || '') + ' ' + p[0];
  }
  function diasDesde(iso) {
    var t = new Date(iso + 'T00:00:00').getTime();
    return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }
  function cat(id) {
    return (D.categorias && D.categorias[id]) || { nombre: id, icono: '•' };
  }
  function fuentesDe(e) {
    if (Array.isArray(e.fuentes) && e.fuentes.length) return e.fuentes;
    if (e.fuente || e.url) return [{ n: e.fuente, u: e.url }];
    return [];
  }

  var TIPOS = {
    verificado:  { t: 'Verificado',   cls: 'ok',  ayuda: 'Confirmado por varios medios.' },
    disputado:   { t: 'Disputado',    cls: 'dis', ayuda: 'Hay versiones enfrentadas y ningún tercero las ha dirimido.' },
    declaracion: { t: 'Declaración',  cls: 'dec', ayuda: 'Lo dijo una sola parte y no está corroborado.' }
  };
  var ESTADOS = {
    documentada: { t: 'Documentada',  cls: 'ok' },
    tension:     { t: 'En tensión',   cls: 'dec' },
    desmentida:  { t: 'Desmentida',   cls: 'no' }
  };
  var FODA = [
    { k: 'fortalezas',    t: 'Fortalezas',    d: 'Lo que ha hecho bien',     c: 'f' },
    { k: 'debilidades',   t: 'Debilidades',   d: 'Fallas propias',           c: 'd' },
    { k: 'oportunidades', t: 'Oportunidades', d: 'Lo que puede aprovechar',  c: 'o' },
    { k: 'amenazas',      t: 'Amenazas',      d: 'Riesgos que no controla',  c: 'a' }
  ];

  function tag(clase, texto, titulo) {
    var s = el('span', 'sp-tag sp-tag-' + clase, texto);
    if (titulo) s.title = titulo;
    return s;
  }

  // ── Enlaces de fuente ─────────────────────────────────────────────────────
  var ICO_EXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"/><path d="M19 5l-8 8"/>' +
                '<path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>';

  function pintarFuentes(cont, lista) {
    vaciar(cont);
    if (!lista.length) {
      cont.appendChild(el('p', 'sp-h-meta', 'Sin fuente registrada.'));
      return;
    }
    lista.forEach(function (f) {
      var u = urlSegura(f.u);
      var n;
      if (u) {
        n = el('a', 'sp-fuente');
        n.href = u; n.target = '_blank'; n.rel = 'noopener noreferrer';
        n.innerHTML = ICO_EXT;
        n.appendChild(el('span', null, f.n || 'Fuente'));
      } else {
        n = el('span', 'sp-fuente');
        n.appendChild(el('span', null, f.n || 'Sin fuente'));
      }
      cont.appendChild(n);
    });
  }

  // ══ RUTAS ═════════════════════════════════════════════════════════════════
  // Cada ruta sabe su padre: así el botón atrás sube un nivel de verdad, en vez
  // de devolver siempre al inicio (y funciona igual con un enlace profundo).
  function padreDe(r) {
    switch (r.v) {
      case 'home': return null;
      case 'timeline': case 'contradicciones': case 'foda': case 'temas': return { v: 'home' };
      case 'lista': return { v: 'timeline' };
      case 'hecho': return r.tema ? { v: 'lista', tema: r.tema } : { v: 'timeline' };
      case 'tema': return { v: 'temas' };
      default: return { v: 'home' };
    }
  }

  function rutaAHash(r) {
    switch (r.v) {
      case 'home': return '#/';
      case 'timeline': return '#/linea-de-tiempo';
      case 'lista': return '#/linea-de-tiempo/' + encodeURIComponent(r.tema || 'todos');
      case 'hecho': return '#/hecho/' + r.i + (r.tema ? '?t=' + encodeURIComponent(r.tema) : '');
      case 'contradicciones': return '#/contradicciones';
      case 'foda': return '#/balance-foda';
      case 'temas': return '#/temas-de-fondo';
      case 'tema': return '#/tema/' + r.i;
      default: return '#/';
    }
  }

  function hashARuta(h) {
    var s = String(h || '').replace(/^#\/?/, '');
    if (!s) return { v: 'home' };
    var q = s.split('?'), partes = q[0].split('/').filter(Boolean);
    var extra = {};
    if (q[1]) q[1].split('&').forEach(function (kv) {
      var p = kv.split('='); extra[p[0]] = decodeURIComponent(p[1] || '');
    });
    switch (partes[0]) {
      case 'linea-de-tiempo':
        return partes[1] ? { v: 'lista', tema: decodeURIComponent(partes[1]) } : { v: 'timeline' };
      case 'hecho':          return { v: 'hecho', i: +partes[1] || 0, tema: extra.t || '' };
      case 'contradicciones':return { v: 'contradicciones' };
      case 'balance-foda':   return { v: 'foda' };
      case 'temas-de-fondo': return { v: 'temas' };
      case 'tema':           return { v: 'tema', i: +partes[1] || 0 };
      default:               return { v: 'home' };
    }
  }

  function ir(r, reemplazar) {
    var h = rutaAHash(r);
    if (location.hash !== h) {
      if (reemplazar) history.replaceState(null, '', h);
      else history.pushState(null, '', h);
    }
    aplicar(r);
  }

  window.addEventListener('popstate', function () { aplicar(hashARuta(location.hash)); });
  window.addEventListener('hashchange', function () { aplicar(hashARuta(location.hash)); });

  // ── Migas y botón atrás ───────────────────────────────────────────────────
  function tituloDe(r) {
    switch (r.v) {
      case 'home': return 'Resumen';
      case 'timeline': return 'Línea de tiempo';
      case 'lista': return r.tema === 'todos' ? 'Todos los temas' : cat(r.tema).nombre;
      case 'hecho': return (D.entradas[r.i] || {}).titulo || 'Hecho';
      case 'contradicciones': return 'Contradicciones';
      case 'foda': return 'Balance FODA';
      case 'temas': return 'Temas de fondo';
      case 'tema': return (D.transversales[r.i] || {}).titulo || 'Tema';
      default: return '';
    }
  }

  function pintarMigas(r) {
    var c = vaciar($('sp-crumbs'));
    var cadena = [], cur = r;
    while (cur) { cadena.unshift(cur); cur = padreDe(cur); }

    // En móvil la ruta completa no cabe: se muestra solo dónde estás.
    var compacto = window.matchMedia('(max-width: 719px)').matches;
    if (compacto) {
      if (r.v !== 'home') c.appendChild(el('span', 'sp-now', tituloDe(r)));
      return;
    }
    cadena.forEach(function (n, i) {
      if (i) c.appendChild(el('span', 'sp-sep', '/'));
      if (i === cadena.length - 1) {
        c.appendChild(el('span', 'sp-now', tituloDe(n)));
      } else {
        var b = el('button', null, tituloDe(n));
        b.type = 'button';
        b.addEventListener('click', function () { ir(n); });
        c.appendChild(b);
      }
    });
  }

  function pintarAtras(r) {
    var p = padreDe(r);
    var btn = $('sp-back');
    $('sp-back-txt').textContent = p ? tituloDe(p) : 'URBIS';
    btn.setAttribute('aria-label', p ? 'Volver a ' + tituloDe(p) : 'Volver a URBIS');
  }

  $('sp-back').addEventListener('click', function () {
    var p = padreDe(ruta);
    if (p) ir(p); else location.href = 'index.html';
  });

  // ══ VISTAS ════════════════════════════════════════════════════════════════
  function aplicar(r) {
    ruta = r;
    var vistas = document.querySelectorAll('.sp-view');
    Array.prototype.forEach.call(vistas, function (v) {
      v.classList.toggle('on', v.getAttribute('data-view') === r.v);
    });

    if (r.v === 'timeline') pintarTemas();
    if (r.v === 'lista') pintarLista(r.tema);
    if (r.v === 'hecho') pintarHecho(r.i);
    if (r.v === 'contradicciones') pintarContradicciones();
    if (r.v === 'foda') pintarFoda();
    if (r.v === 'temas') pintarTemasFondo();
    if (r.v === 'tema') pintarTemaFondo(r.i);

    pintarMigas(r);
    pintarAtras(r);
    $('sp-foot').hidden = false;
    window.scrollTo({ top: 0, behavior: 'auto' });

    // Foco al encabezado de la vista, para que el lector de pantalla anuncie
    // dónde quedó tras navegar.
    var activa = document.querySelector('.sp-view.on h1, .sp-view.on h2');
    if (activa) { activa.setAttribute('tabindex', '-1'); activa.focus({ preventScroll: true }); }
  }

  // ── Portada ───────────────────────────────────────────────────────────────
  function pintarHome() {
    $('sp-presi').textContent = D.presidente || '—';
    $('sp-periodo').textContent = '· Periodo ' + (D.periodo || '') + ' · posesión el ' + fechaLarga(D.posesion);

    var nHechos = (D.entradas || []).length;
    var nTemas = (D.transversales || []).length;
    var nCx = ((D.contradicciones || {}).casos || []).length;
    var nFoda = FODA.reduce(function (a, b) { return a + (((D.foda || {})[b.k]) || []).length; }, 0);

    var dominios = {};
    (D.entradas || []).concat(D.transversales || []).forEach(function (e) {
      fuentesDe(e).forEach(function (f) {
        var u = urlSegura(f.u); if (!u) return;
        try { dominios[new URL(u).hostname.replace(/^www\./, '')] = true; } catch (x) {}
      });
    });

    var stats = [
      { n: nHechos, t: 'Hechos registrados' },
      { n: nCx, t: 'Contradicciones documentadas' },
      { n: nFoda, t: 'Puntos del FODA' },
      { n: Object.keys(dominios).length, t: 'Medios citados' }
    ];
    var cont = vaciar($('sp-stats'));
    stats.forEach(function (s) {
      var d = el('div', 'sp-stat');
      d.appendChild(el('dd', null, String(s.n)));
      d.appendChild(el('dt', null, s.t));
      cont.appendChild(d);
    });

    var secs = [
      { n: '01', v: 'timeline',        t: 'Línea de tiempo', d: 'Hechos y decisiones documentadas.', c: nHechos },
      { n: '02', v: 'contradicciones', t: 'Contradicciones', d: 'Cambios de postura y posiciones en tensión.', c: nCx },
      { n: '03', v: 'foda',            t: 'Balance FODA',    d: 'Fortalezas, debilidades, oportunidades y amenazas.', c: nFoda },
      { n: '04', v: 'temas',           t: 'Temas de fondo',  d: 'Contexto que no pertenece a una fecha concreta.', c: nTemas }
    ];
    var nav = vaciar($('sp-secciones'));
    secs.forEach(function (s) {
      var b = el('button', 'sp-sec'); b.type = 'button';
      b.appendChild(el('span', 'sp-sec-n', s.n));
      var mid = el('span');
      mid.appendChild(el('span', 'sp-sec-t', s.t));
      mid.appendChild(el('span', 'sp-sec-d', s.d));
      b.appendChild(mid);
      var go = el('span', 'sp-sec-go');
      go.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
      b.appendChild(go);
      b.addEventListener('click', function () { ir({ v: s.v }); });
      nav.appendChild(b);
    });

    $('sp-nextup').textContent =
      'Actualizado el ' + fechaLarga(D.actualizado) + ' · próxima revisión el ' + fechaLarga(D.proximaActualizacion) +
      ' · ' + diasDesde(D.posesion) + ' días de gobierno.';

    $('sp-upd-txt').textContent = fechaCorta(D.actualizado);
    $('sp-upd').title = 'Actualizado el ' + fechaLarga(D.actualizado) +
                        '. Próxima revisión el ' + fechaLarga(D.proximaActualizacion) + '.';
  }

  // ── Línea de tiempo · temas ───────────────────────────────────────────────
  function conteoPorTema() {
    var c = {};
    (D.entradas || []).forEach(function (e) { c[e.categoria] = (c[e.categoria] || 0) + 1; });
    return c;
  }

  function pintarTemas() {
    var c = conteoPorTema();
    var cont = vaciar($('sp-tl-temas'));

    var todos = el('button', 'sp-tema'); todos.type = 'button';
    todos.appendChild(el('span', 'sp-tema-n', 'Todos los temas'));
    todos.appendChild(el('span', 'sp-tema-c', String((D.entradas || []).length)));
    todos.addEventListener('click', function () { ir({ v: 'lista', tema: 'todos' }); });
    cont.appendChild(todos);

    Object.keys(D.categorias || {}).forEach(function (id) {
      if (!c[id]) return;                       // sin hechos, no se muestra
      var b = el('button', 'sp-tema'); b.type = 'button';
      b.appendChild(el('span', 'sp-tema-n', cat(id).nombre));
      b.appendChild(el('span', 'sp-tema-c', String(c[id])));
      b.addEventListener('click', function () { ir({ v: 'lista', tema: id }); });
      cont.appendChild(b);
    });
  }

  // ── Línea de tiempo · lista ───────────────────────────────────────────────
  // 'sin' agrupa las entradas que no declaran tipoFuente. Sin esa opción el
  // filtro mentiría: la mayoría de entradas no lleva ese campo y cualquier
  // elección devolvería una lista vacía sin explicar por qué.
  function coincideTipo(e, tipo) {
    if (tipo === 'todos') return true;
    var t = e.tipoFuente || '';
    return tipo === 'sin' ? !t : t === tipo;
  }

  function entradasFiltradas(tema, tipo) {
    tipo = tipo == null ? filtro.tipo : tipo;
    return (D.entradas || []).map(function (e, i) { return { e: e, i: i }; })
      .filter(function (o) {
        if (tema && tema !== 'todos' && o.e.categoria !== tema) return false;
        return coincideTipo(o.e, tipo);
      });
  }

  function pintarLista(tema) {
    filtro.tema = tema || 'todos';
    $('sp-lista-h').textContent = filtro.tema === 'todos' ? 'Todos los temas' : cat(filtro.tema).nombre;
    $('sp-lista-cat').textContent = 'Línea de tiempo';

    montarCombo();
    actualizarContadorFiltros();

    var lista = entradasFiltradas(filtro.tema);
    $('sp-lista-count').textContent = lista.length === 1
      ? '1 hecho registrado' : lista.length + ' hechos registrados';

    var cont = vaciar($('sp-hechos'));
    if (!lista.length) { cont.appendChild(vacio()); return; }

    lista.forEach(function (o) {
      var e = o.e;
      var b = el('button', 'sp-hecho'); b.type = 'button';

      var top = el('div', 'sp-h-top');
      var f = el('span', 'sp-h-fecha', fechaCorta(e.fecha));
      if (e.precision === 'aproximada') {
        f.appendChild(el('span', 'sp-h-aprox', ' · aprox.'));
      }
      top.appendChild(f);
      var ti = TIPOS[e.tipoFuente];
      if (ti) top.appendChild(tag(ti.cls, ti.t, ti.ayuda));
      b.appendChild(top);

      b.appendChild(el('h3', null, e.titulo || ''));
      if (e.detalle) b.appendChild(el('p', 'sp-h-dek', e.detalle));

      var foot = el('div', 'sp-h-foot');
      var nf = fuentesDe(e).length;
      var meta = cat(e.categoria).nombre + ' · ' + nf + (nf === 1 ? ' fuente' : ' fuentes');
      if (e.contrapunto) meta += ' · con contrapunto';
      foot.appendChild(el('span', 'sp-h-meta', meta));
      var go = el('span', 'sp-h-go');
      go.appendChild(el('span', null, 'Ver detalle'));
      go.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
      foot.appendChild(go);
      b.appendChild(foot);

      b.addEventListener('click', function () {
        ir({ v: 'hecho', i: o.i, tema: filtro.tema });
      });
      cont.appendChild(b);
    });
  }

  function vacio() {
    var d = el('div', 'sp-vacio');
    d.appendChild(el('b', null, 'No encontramos resultados'));
    d.appendChild(el('p', null, 'Prueba con otro tema o elimina algún filtro.'));
    var b = el('button', 'sp-btn sp-btn-ghost', 'Limpiar filtros'); b.type = 'button';
    b.addEventListener('click', function () {
      filtro.tipo = 'todos';
      ir({ v: 'lista', tema: 'todos' }, true);
    });
    d.appendChild(b);
    return d;
  }

  // ── Combobox accesible ────────────────────────────────────────────────────
  function montarCombo() {
    // El host se REEMPLAZA por un nodo limpio, no se vacía: vaciar() borra los
    // hijos pero deja vivos los listeners del host, y como esto se remonta en
    // cada lista se iban acumulando. El listener viejo abría el menú primero y
    // el nuevo, al verlo ya abierto, nunca marcaba aria-expanded="true" — se
    // veía abierto pero un lector de pantalla lo anunciaba cerrado.
    var viejo = $('sp-combo');
    var host = el('div', 'sp-combo');
    host.id = 'sp-combo';
    viejo.replaceWith(host);
    var c = conteoPorTema();

    var opciones = [{ id: 'todos', n: 'Todos los temas', c: (D.entradas || []).length }];
    Object.keys(D.categorias || {}).forEach(function (id) {
      if (c[id]) opciones.push({ id: id, n: cat(id).nombre, c: c[id] });
    });

    var btn = el('button', 'sp-combo-btn'); btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="sp-combo-lab">Tema:</span>';
    var etiqueta = el('span', null, filtro.tema === 'todos' ? 'Todos' : cat(filtro.tema).nombre);
    btn.appendChild(etiqueta);
    btn.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>');

    var lb = el('div', 'sp-combo-list');
    lb.setAttribute('role', 'listbox');
    lb.setAttribute('aria-label', 'Elegir tema');

    var idx = Math.max(0, opciones.findIndex(function (o) { return o.id === filtro.tema; }));

    opciones.forEach(function (o, i) {
      var op = el('button', 'sp-combo-opt'); op.type = 'button';
      op.setAttribute('role', 'option');
      op.setAttribute('aria-selected', o.id === filtro.tema ? 'true' : 'false');
      op.appendChild(el('span', null, o.n));
      op.appendChild(el('span', 'n', String(o.c)));
      op.addEventListener('click', function () {
        cerrar();
        ir({ v: 'lista', tema: o.id });
      });
      op.addEventListener('mouseenter', function () { marcar(i); });
      lb.appendChild(op);
    });

    function marcar(i) {
      idx = i;
      Array.prototype.forEach.call(lb.children, function (n, j) {
        n.classList.toggle('hi', j === i);
      });
      if (lb.children[i]) lb.children[i].scrollIntoView({ block: 'nearest' });
    }
    function abrir() {
      host.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      marcar(idx);
      document.addEventListener('click', fuera, true);
    }
    function cerrar() {
      host.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', fuera, true);
    }
    function fuera(ev) { if (!host.contains(ev.target)) cerrar(); }

    btn.addEventListener('click', function () {
      host.classList.contains('open') ? cerrar() : abrir();
    });
    host.addEventListener('keydown', function (ev) {
      var abierto = host.classList.contains('open');
      if (ev.key === 'Escape' && abierto) { ev.preventDefault(); cerrar(); btn.focus(); return; }
      if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') ) {
        ev.preventDefault();
        if (!abierto) { abrir(); return; }
        marcar(Math.min(opciones.length - 1, Math.max(0, idx + (ev.key === 'ArrowDown' ? 1 : -1))));
        return;
      }
      if ((ev.key === 'Enter' || ev.key === ' ') && abierto) {
        ev.preventDefault();
        cerrar();
        ir({ v: 'lista', tema: opciones[idx].id });
      }
    });

    host.appendChild(btn);
    host.appendChild(lb);
  }

  // ── Detalle de un hecho ───────────────────────────────────────────────────
  function pintarHecho(i) {
    var e = (D.entradas || [])[i];
    if (!e) { ir({ v: 'timeline' }, true); return; }

    $('sp-d-fecha').textContent = fechaLarga(e.fecha) +
      (e.precision === 'aproximada' ? ' · fecha aproximada' : '');
    $('sp-d-h').textContent = e.titulo || '';
    $('sp-d-body').textContent = e.detalle || '';

    var cc = vaciar($('sp-d-contra'));
    if (e.contrapunto) {
      var box = el('div', 'sp-d-contra');
      box.appendChild(el('h3', null, 'Contrapunto'));
      box.appendChild(el('p', null, e.contrapunto));
      cc.appendChild(box);
    }

    var s = vaciar($('sp-d-sello'));
    var ti = TIPOS[e.tipoFuente];
    if (ti) {
      s.appendChild(tag(ti.cls, ti.t));
      s.appendChild(el('p', 'sp-h-meta', ti.ayuda));
    } else {
      s.appendChild(el('p', 'sp-h-meta', 'Sin clasificar.'));
    }

    $('sp-d-cat').textContent = cat(e.categoria).nombre;
    pintarFuentes($('sp-d-fuentes'), fuentesDe(e));
  }

  // ── Contradicciones ───────────────────────────────────────────────────────
  function pintarContradicciones() {
    var casos = ((D.contradicciones || {}).casos) || [];
    var cont = vaciar($('sp-cxlist'));
    if (!casos.length) { cont.appendChild(el('p', 'sp-h-meta', 'No hay casos registrados.')); return; }

    casos.forEach(function (x) {
      var est = ESTADOS[x.estado] || ESTADOS.documentada;
      var art = el('article', 'sp-cx sp-cx-' + (x.estado === 'desmentida' ? 'des' : x.estado));

      var head = el('div', 'sp-cx-head');
      head.appendChild(el('h3', null, x.tema || ''));
      head.appendChild(tag(est.cls, est.t));
      art.appendChild(head);

      var par = el('div', 'sp-cx-par');
      var a = el('div', 'sp-cx-mom sp-cx-antes');
      a.appendChild(el('b', null, 'Antes'));
      a.appendChild(el('p', null, x.antes || ''));
      par.appendChild(a);
      var b = el('div', 'sp-cx-mom sp-cx-desp');
      b.appendChild(el('b', null, x.estado === 'desmentida' ? 'Lo que dicen los verificadores' : 'Después'));
      b.appendChild(el('p', null, x.despues || ''));
      par.appendChild(b);
      art.appendChild(par);

      if (x.matiz) {
        var m = el('div', 'sp-cx-matiz');
        m.appendChild(el('b', null, 'Matiz'));
        m.appendChild(el('p', null, x.matiz));
        art.appendChild(m);
      }

      var src = el('div', 'sp-cx-src');
      src.appendChild(el('b', null, 'Fuentes'));
      var fl = el('div', 'sp-fuentes');
      pintarFuentes(fl, x.fuentes || []);
      src.appendChild(fl);
      art.appendChild(src);

      cont.appendChild(art);
    });
  }

  // ── FODA ──────────────────────────────────────────────────────────────────
  function pintarFoda() {
    var f = D.foda || {};
    var tabs = vaciar($('sp-fodatabs'));

    FODA.forEach(function (b) {
      var n = (f[b.k] || []).length;
      var t = el('button', 'sp-fodatab'); t.type = 'button';
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', b.k === fodaSel ? 'true' : 'false');
      var mid = el('span');
      mid.appendChild(el('span', 'sp-fodatab-t', b.t));
      mid.appendChild(el('span', 'sp-fodatab-d', b.d));
      t.appendChild(mid);
      t.appendChild(el('span', 'sp-fodatab-c', String(n)));
      t.addEventListener('click', function () { fodaSel = b.k; pintarFoda(); });
      tabs.appendChild(t);
    });

    var meta = FODA.filter(function (x) { return x.k === fodaSel; })[0] || FODA[0];
    var lista = f[fodaSel] || [];
    var cont = vaciar($('sp-fodalist'));
    cont.className = 'sp-fodalist sp-foda-' + meta.c;
    cont.setAttribute('aria-label', meta.t);

    if (!lista.length) { cont.appendChild(el('p', 'sp-h-meta', 'Sin puntos registrados.')); return; }
    lista.forEach(function (x) {
      var d = el('div', 'sp-fodaitem');
      d.appendChild(el('b', null, x.t || ''));
      d.appendChild(el('p', null, x.d || ''));
      cont.appendChild(d);
    });
  }

  // ── Temas de fondo ────────────────────────────────────────────────────────
  function pintarTemasFondo() {
    var lista = D.transversales || [];
    var cont = vaciar($('sp-tflist'));
    if (!lista.length) { cont.appendChild(el('p', 'sp-h-meta', 'No hay temas registrados.')); return; }
    lista.forEach(function (t, i) {
      var b = el('button', 'sp-tf'); b.type = 'button';
      b.appendChild(el('h3', null, t.titulo || ''));
      if (t.detalle) b.appendChild(el('p', null, t.detalle));
      var foot = el('div', 'sp-h-foot');
      var nf = fuentesDe(t).length;
      foot.appendChild(el('span', 'sp-h-meta', cat(t.categoria).nombre + ' · ' + nf + (nf === 1 ? ' fuente' : ' fuentes')));
      var go = el('span', 'sp-h-go');
      go.appendChild(el('span', null, 'Ver detalle'));
      go.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
      foot.appendChild(go);
      b.appendChild(foot);
      b.addEventListener('click', function () { ir({ v: 'tema', i: i }); });
      cont.appendChild(b);
    });
  }

  function pintarTemaFondo(i) {
    var t = (D.transversales || [])[i];
    if (!t) { ir({ v: 'temas' }, true); return; }
    $('sp-t-cat').textContent = cat(t.categoria).nombre;
    $('sp-t-h').textContent = t.titulo || '';
    $('sp-t-body').textContent = t.detalle || '';

    var cc = vaciar($('sp-t-contra'));
    if (t.contrapunto) {
      var box = el('div', 'sp-d-contra');
      box.appendChild(el('h3', null, 'Contrapunto'));
      box.appendChild(el('p', null, t.contrapunto));
      cc.appendChild(box);
    }
    pintarFuentes($('sp-t-fuentes'), fuentesDe(t));
  }

  // ── Panel de filtros ──────────────────────────────────────────────────────
  var pendiente = { tema: 'todos', tipo: 'todos' };

  function opcion(cont, texto, activo, onClick) {
    var b = el('button', 'sp-opt', texto); b.type = 'button';
    b.setAttribute('aria-pressed', activo ? 'true' : 'false');
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(cont.children, function (n) { n.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      onClick();
    });
    cont.appendChild(b);
    return b;
  }

  // Los conteos de naturaleza dependen del tema elegido en el panel, así que se
  // repintan al cambiarlo. Un número que no corresponde con lo que vas a ver es
  // peor que no ponerlo.
  function pintarTiposEnPanel() {
    var cp = vaciar($('sp-f-tipo'));
    var base = (D.entradas || []).filter(function (e) {
      return pendiente.tema === 'todos' || e.categoria === pendiente.tema;
    });
    var cuenta = function (k) {
      return base.filter(function (e) { return coincideTipo(e, k); }).length;
    };

    opcion(cp, 'Todas · ' + base.length, pendiente.tipo === 'todos', function () { pendiente.tipo = 'todos'; });
    Object.keys(TIPOS).forEach(function (k) {
      var n = cuenta(k);
      if (!n) return;                       // no ofrecer un filtro que da cero
      opcion(cp, TIPOS[k].t + ' · ' + n, pendiente.tipo === k, function () { pendiente.tipo = k; });
    });
    var sin = cuenta('sin');
    if (sin) {
      opcion(cp, 'Sin clasificar · ' + sin, pendiente.tipo === 'sin', function () { pendiente.tipo = 'sin'; });
    }
  }

  function abrirFiltros() {
    pendiente = { tema: filtro.tema, tipo: filtro.tipo };
    var c = conteoPorTema();

    var ct = vaciar($('sp-f-tema'));
    opcion(ct, 'Todos · ' + (D.entradas || []).length, pendiente.tema === 'todos', function () {
      pendiente.tema = 'todos';
      if (!hayResultados()) pendiente.tipo = 'todos';
      pintarTiposEnPanel();
    });
    Object.keys(D.categorias || {}).forEach(function (id) {
      if (!c[id]) return;
      opcion(ct, cat(id).nombre + ' · ' + c[id], pendiente.tema === id, function () {
        pendiente.tema = id;
        if (!hayResultados()) pendiente.tipo = 'todos';
        pintarTiposEnPanel();
      });
    });

    pintarTiposEnPanel();
    abrirPanel($('sp-sheet'));
  }

  function hayResultados() {
    return entradasFiltradas(pendiente.tema, pendiente.tipo).length > 0;
  }

  // El tema ya se ve en el título y en el selector: contarlo aquí duplicaría
  // información. El contador refleja solo el filtro que no es visible de otro modo.
  function actualizarContadorFiltros() {
    var n = filtro.tipo !== 'todos' ? 1 : 0;
    var b = $('sp-fcount');
    b.hidden = n === 0;
    b.textContent = String(n);
    $('sp-filterbtn').setAttribute('aria-label',
      n ? 'Filtrar · 1 filtro activo: ' + (TIPOS[filtro.tipo] ? TIPOS[filtro.tipo].t : 'sin clasificar') : 'Filtrar');
  }

  $('sp-filterbtn').addEventListener('click', abrirFiltros);
  $('sp-f-apply').addEventListener('click', function () {
    filtro.tipo = pendiente.tipo;
    cerrarPanel($('sp-sheet'));
    ir({ v: 'lista', tema: pendiente.tema }, true);
  });
  $('sp-f-clear').addEventListener('click', function () {
    pendiente = { tema: 'todos', tipo: 'todos' };
    filtro.tipo = 'todos';
    cerrarPanel($('sp-sheet'));
    ir({ v: 'lista', tema: 'todos' }, true);
  });

  // ── Paneles ───────────────────────────────────────────────────────────────
  var ultimoFoco = null;

  function abrirPanel(p) {
    ultimoFoco = document.activeElement;
    p.hidden = false;
    document.body.style.overflow = 'hidden';
    var f = p.querySelector('button, a, [tabindex]');
    if (f) f.focus();
  }
  function cerrarPanel(p) {
    p.hidden = true;
    document.body.style.overflow = '';
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.sp-sheet'), function (p) {
    p.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) cerrarPanel(p);
    });
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    Array.prototype.forEach.call(document.querySelectorAll('.sp-sheet'), function (p) {
      if (!p.hidden) cerrarPanel(p);
    });
  });
  $('sp-info').addEventListener('click', function () { abrirPanel($('sp-modal')); });

  window.addEventListener('resize', function () { pintarMigas(ruta); });

  // ── Arranque ──────────────────────────────────────────────────────────────
  fetch('assets/data/seguimiento-presidencial.json?v=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (j) {
      D = j;
      $('sp-loading').hidden = true;
      pintarHome();
      aplicar(hashARuta(location.hash));
    })
    .catch(function (e) {
      $('sp-loading').hidden = true;
      var m = $('sp-main');
      var d = el('div', 'sp-vacio');
      d.appendChild(el('b', null, 'No se pudo cargar el seguimiento'));
      d.appendChild(el('p', null, 'Revisa tu conexión y vuelve a intentar. (' + e.message + ')'));
      var b = el('button', 'sp-btn sp-btn-solid', 'Reintentar'); b.type = 'button';
      b.addEventListener('click', function () { location.reload(); });
      d.appendChild(b);
      m.appendChild(d);
    });
})();
