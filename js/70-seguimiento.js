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
    { k: 'fortalezas',    t: 'Fortalezas',    d: 'Lo que ha hecho bien',     c: 'f', i: '💪', col: '#0E86BC' },
    { k: 'debilidades',   t: 'Debilidades',   d: 'Fallas propias',           c: 'd', i: '⚠️', col: '#D99A32' },
    { k: 'oportunidades', t: 'Oportunidades', d: 'Lo que puede aprovechar',  c: 'o', i: '🚀', col: '#527C91' },
    { k: 'amenazas',      t: 'Amenazas',      d: 'Riesgos que no controla',  c: 'a', i: '🌩️', col: '#C95A55' }
  ];

  // ── Color ────────────────────────────────────────────────────────────────
  // El color de cada categoría sale del JSON. Para que cualquier hex quede
  // armónico sin retocarlo a mano, no se usa a plena saturación: se derivan un
  // tinte muy claro (fondo del disco) y un borde suave. Así el color identifica
  // sin gritar, y una categoría nueva funciona sola.
  function hexRGB(h) {
    var s = String(h || '').replace('#', '');
    if (s.length === 3) s = s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
    var n = parseInt(s, 16);
    return isNaN(n) ? [110,120,128] : [(n>>16)&255, (n>>8)&255, n&255];
  }
  function mezcla(hex, pct, haciaBlanco) {
    var c = hexRGB(hex), d = haciaBlanco ? 255 : 0;
    return 'rgb(' + c.map(function (v) {
      return Math.round(v + (d - v) * pct);
    }).join(',') + ')';
  }
  function pintarColorCategoria(nodo, id) {
    var c = (cat(id) || {}).color || '#6E7880';
    nodo.style.setProperty('--cc', c);
    nodo.style.setProperty('--cbg', mezcla(c, 0.88, true));
    nodo.style.setProperty('--cbd', mezcla(c, 0.68, true));
  }
  function disco(id, pequeno) {
    var d = el('span', 'sp-disco' + (pequeno ? ' sp-disco-s' : ''), (cat(id) || {}).icono || '•');
    d.setAttribute('aria-hidden', 'true');
    pintarColorCategoria(d, id);
    return d;
  }

  // Identidad de cada sección. El número 01–05 no es adorno: estas secciones sí
  // son una progresión (de los hechos al análisis), que es lo que las numera.
  // Cada sección lleva DOS tonos: `c` va en texto pequeño (el número) y debe
  // pasar 4.5:1; `m` es la marca —riel e icono— donde basta 3:1 y conviene el
  // tono vivo. El ámbar es el caso que obliga a separarlos: vivo da 2.44:1.
  var SECS = {
    hoy:             { n: '00', c: '#0B6E9B', m: '#34CCFE', t: 'Al día',           d: 'Lo último publicado, como un muro.' },
    balance:         { n: '06', c: '#7A4A6B', m: '#A96A94', t: 'Balance del periodo', d: 'El patrón que dejan todos los hechos juntos.' },
    timeline:        { n: '01', c: '#0B6E9B', m: '#0E86BC', t: 'Línea de tiempo',  d: 'Hechos y decisiones documentadas.' },
    contradicciones: { n: '02', c: '#8A5D12', m: '#D99A32', t: 'Contradicciones',  d: 'Cambios de postura y posiciones en tensión.' },
    foda:            { n: '03', c: '#5D5FA8', m: '#5D5FA8', t: 'Balance FODA',     d: 'Fortalezas, debilidades, oportunidades y amenazas.' },
    temas:           { n: '04', c: '#06405A', m: '#0A5678', t: 'Temas de fondo',   d: 'Contexto que no pertenece a una fecha concreta.' },
    indicadores:     { n: '05', c: '#946A00', m: '#C79200', t: 'Indicadores',      d: 'Deuda, dólar y cifras que se pueden seguir.' }
  };
  var ICONOS = {
    timeline:        '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>',
    contradicciones: '<path d="M8 4v11"/><path d="M5 12l3 3 3-3"/><path d="M16 20V9"/><path d="M13 12l3-3 3 3"/>',
    foda:            '<path d="M4 20V10M10 20V4M16 20v-7M22 20h-2"/><path d="M2 20h20"/>',
    temas:           '<path d="M4 6h16M4 12h16M4 18h10"/>',
    indicadores:     '<path d="M3 17l5-6 4 4 6-8"/><path d="M15 7h4v4"/>'
  };
  function pintarSeccion(nodo, v) {
    var s = SECS[v]; if (!s) return;
    nodo.style.setProperty('--sc', s.c);          // texto (accesible)
    nodo.style.setProperty('--sc-mark', s.m);     // riel e icono (vivo)
    nodo.style.setProperty('--sc-bg', mezcla(s.m, 0.9, true));
  }
  function icoSeccion(v) {
    var s = el('span', 'sp-sec-ico');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg viewBox="0 0 24 24">' + (ICONOS[v] || '') + '</svg>';
    return s;
  }

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
      case 'hoy': case 'balance':
      case 'timeline': case 'contradicciones': case 'foda': case 'temas': case 'indicadores':
        return { v: 'home' };
      case 'lista': return { v: 'timeline' };
      // Desde el muro se entra a un hecho sin pasar por la lista de temas: el
      // atrás tiene que devolver al muro, no a un sitio donde nunca estuvo.
      case 'hecho':
        if (r.desde === 'hoy') return { v: 'hoy' };
        return r.tema ? { v: 'lista', tema: r.tema } : { v: 'timeline' };
      case 'tema': return { v: 'temas' };
      default: return { v: 'home' };
    }
  }

  function rutaAHash(r) {
    switch (r.v) {
      case 'home': return '#/';
      case 'hoy': return '#/al-dia';
      case 'balance': return '#/balance';
      case 'timeline': return '#/linea-de-tiempo';
      case 'lista': return '#/linea-de-tiempo/' + encodeURIComponent(r.tema || 'todos');
      case 'hecho': return '#/hecho/' + r.i +
        (r.desde === 'hoy' ? '?d=hoy' : (r.tema ? '?t=' + encodeURIComponent(r.tema) : ''));
      case 'contradicciones': return '#/contradicciones';
      case 'foda': return '#/balance-foda';
      case 'temas': return '#/temas-de-fondo';
      case 'indicadores': return '#/indicadores';
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
      case 'al-dia':         return { v: 'hoy' };
      case 'balance':        return { v: 'balance' };
      case 'linea-de-tiempo':
        return partes[1] ? { v: 'lista', tema: decodeURIComponent(partes[1]) } : { v: 'timeline' };
      case 'hecho':          return { v: 'hecho', i: +partes[1] || 0, tema: extra.t || '',
                                      desde: extra.d || '' };
      case 'contradicciones':return { v: 'contradicciones' };
      case 'balance-foda':   return { v: 'foda' };
      case 'temas-de-fondo': return { v: 'temas' };
      case 'indicadores':    return { v: 'indicadores' };
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
      case 'hoy': return 'Al día';
      case 'balance': return 'Balance del periodo';
      case 'timeline': return 'Línea de tiempo';
      case 'lista': return r.tema === 'todos' ? 'Todos los temas' : cat(r.tema).nombre;
      case 'hecho': return (D.entradas[r.i] || {}).titulo || 'Hecho';
      case 'contradicciones': return 'Contradicciones';
      case 'foda': return 'Balance FODA';
      case 'temas': return 'Temas de fondo';
      case 'indicadores': return 'Indicadores';
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

    if (r.v === 'hoy') pintarMuro();
    if (r.v === 'balance') pintarBalance();
    if (r.v === 'timeline') pintarTemas();
    if (r.v === 'lista') pintarLista(r.tema);
    if (r.v === 'hecho') pintarHecho(r.i);
    if (r.v === 'contradicciones') pintarContradicciones();
    if (r.v === 'foda') pintarFoda();
    if (r.v === 'temas') pintarTemasFondo();
    if (r.v === 'tema') pintarTemaFondo(r.i);
    if (r.v === 'indicadores') pintarIndicadores();

    // La cabecera de cada vista toma el color de su sección
    var vh = document.querySelector('.sp-view.on .sp-vhead');
    if (vh) pintarSeccion(vh, r.v === 'lista' || r.v === 'hecho' ? 'timeline'
                            : (r.v === 'tema' ? 'temas' : r.v));

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

    var ICO_STAT = {
      hechos: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>',
      cx: '<path d="M8 4v11"/><path d="M5 12l3 3 3-3"/><path d="M16 20V9"/><path d="M13 12l3-3 3 3"/>',
      foda: '<path d="M4 20V10M10 20V4M16 20v-7"/><path d="M2 20h20"/>',
      medios: '<path d="M4 5h13v14H4z"/><path d="M17 9h3v8a2 2 0 0 1-4 0"/><path d="M7 9h7M7 13h7"/>'
    };
    var stats = [
      { n: nHechos, t: 'Hechos registrados', i: ICO_STAT.hechos },
      { n: nCx, t: 'Contradicciones documentadas', i: ICO_STAT.cx },
      { n: nFoda, t: 'Puntos del FODA', i: ICO_STAT.foda },
      { n: Object.keys(dominios).length, t: 'Medios citados', i: ICO_STAT.medios }
    ];
    var cont = vaciar($('sp-stats'));
    stats.forEach(function (s) {
      var d = el('div', 'sp-stat');
      var ic = el('span', 'sp-stat-ico');
      ic.setAttribute('aria-hidden', 'true');
      ic.innerHTML = '<svg viewBox="0 0 24 24">' + s.i + '</svg>';
      d.appendChild(ic);
      var body = el('div', 'sp-stat-body');
      body.appendChild(el('dd', null, String(s.n)));
      body.appendChild(el('dt', null, s.t));
      d.appendChild(body);
      cont.appendChild(d);
    });

    pintarAccesoMuro();

    var cuenta = { timeline: nHechos, contradicciones: nCx, foda: nFoda, temas: nTemas,
                   indicadores: null, balance: null };
    var nav = vaciar($('sp-secciones'));
    ['timeline', 'contradicciones', 'foda', 'temas', 'indicadores', 'balance'].forEach(function (v) {
      var s = SECS[v];
      var b = el('button', 'sp-sec'); b.type = 'button';
      pintarSeccion(b, v);
      b.appendChild(icoSeccion(v));
      var mid = el('span');
      var t = el('span', 'sp-sec-t', s.t);
      mid.appendChild(el('span', 'sp-sec-n', s.n));
      mid.appendChild(t);
      mid.appendChild(el('span', 'sp-sec-d', s.d + (cuenta[v] ? '  ·  ' + cuenta[v] : '')));
      b.appendChild(mid);
      var go = el('span', 'sp-sec-go');
      go.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
      b.appendChild(go);
      b.addEventListener('click', function () { ir({ v: v }); });
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
      b.appendChild(disco(id));

      // Rango de fechas y último titular: enseña qué hay dentro antes de
      // entrar, usando datos que ya existen — sin inventar descripciones.
      var deTema = (D.entradas || []).filter(function (e) { return e.categoria === id; });
      var fechas = deTema.map(function (e) { return e.fecha; }).filter(Boolean).sort();
      var body = el('div', 'sp-tema-body');
      body.appendChild(el('span', 'sp-tema-n', cat(id).nombre));
      if (fechas.length) {
        var rango = fechas.length > 1 && fechas[0] !== fechas[fechas.length - 1]
          ? 'del ' + fechaCorta(fechas[0]).replace(' 2026', '') + ' al ' + fechaCorta(fechas[fechas.length - 1]).replace(' 2026', '')
          : fechaCorta(fechas[0]);
        body.appendChild(el('span', 'sp-tema-meta', rango));
      }
      if (deTema[0] && deTema[0].titulo) {
        body.appendChild(el('span', 'sp-tema-ult', deTema[0].titulo));
      }
      b.appendChild(body);
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

  // Acceso destacado al muro desde la portada: enseña de una lo más reciente,
  // que es lo que la mayoría viene a ver, sin obligar a elegir categoría.
  function pintarAccesoMuro() {
    var cont = vaciar($('sp-acceso-muro'));
    var recientes = (D.entradas || []).slice()
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0; })
      .slice(0, 3);
    if (!recientes.length) return;

    var b = el('button', 'sp-nuevo'); b.type = 'button';
    var top = el('div', 'sp-nuevo-top');
    top.appendChild(el('span', 'sp-nuevo-vivo', 'AL DÍA'));
    top.appendChild(el('span', 'sp-nuevo-f', 'Última publicación: ' +
      diaEtiqueta(recientes[0].fecha).toLowerCase()));
    b.appendChild(top);

    var ul = el('ul', 'sp-nuevo-list');
    recientes.forEach(function (e) {
      var li = el('li');
      li.appendChild(disco(e.categoria, true));
      li.appendChild(el('span', null, e.titulo || ''));
      ul.appendChild(li);
    });
    b.appendChild(ul);

    var go = el('span', 'sp-nuevo-go', 'Ver el muro completo →');
    b.appendChild(go);
    b.addEventListener('click', function () { ir({ v: 'hoy' }); });
    cont.appendChild(b);
  }

  // ══ MURO "AL DÍA" ═════════════════════════════════════════════════════════
  // Entra por fecha, no por tema: es para quien solo quiere saber qué pasó
  // hoy. Se agrupa por día y se ordena de lo más nuevo a lo más viejo — el
  // array del JSON no viene ordenado y no se puede confiar en su orden.
  var muroTema = 'todos';

  function diaEtiqueta(iso) {
    var d = diasDesde(iso);
    if (d === 0) return 'Hoy';
    if (d === 1) return 'Ayer';
    if (d < 7) return 'Hace ' + d + ' días';
    return fechaLarga(iso);
  }

  function pintarMuro() {
    var todas = (D.entradas || []).map(function (e, i) { return { e: e, i: i }; })
      .filter(function (o) { return muroTema === 'todos' || o.e.categoria === muroTema; })
      .sort(function (a, b) { return a.e.fecha < b.e.fecha ? 1 : a.e.fecha > b.e.fecha ? -1 : 0; });

    pintarLeyenda();
    pintarChipsMuro();
    $('sp-hoy-count').textContent = todas.length === 1
      ? '1 publicación' : todas.length + ' publicaciones';

    var cont = vaciar($('sp-muro'));
    if (!todas.length) { cont.appendChild(vacio()); return; }

    var diaActual = null;
    todas.forEach(function (o) {
      if (o.e.fecha !== diaActual) {
        diaActual = o.e.fecha;
        var sep = el('div', 'sp-dia');
        sep.appendChild(el('span', 'sp-dia-t', diaEtiqueta(o.e.fecha)));
        sep.appendChild(el('span', 'sp-dia-f', fechaCorta(o.e.fecha)));
        cont.appendChild(sep);
      }
      cont.appendChild(tarjetaMuro(o));
    });
  }

  // Leyenda de los sellos, plegada. Va aquí y no solo en el modal de ayuda
  // porque es donde se ven los sellos: explicar lejos de lo explicado no
  // enseña a nadie. Se pinta una sola vez.
  function pintarLeyenda() {
    var cont = $('sp-hoy-leyenda');
    if (!cont || cont.firstChild) return;

    var d = el('details', 'sp-leyenda');
    var s = el('summary', null, '¿Qué significan los sellos de cada tarjeta?');
    d.appendChild(s);

    var caja = el('div', 'sp-leyenda-caja');
    ['verificado', 'disputado', 'declaracion'].forEach(function (k) {
      var t = TIPOS[k];
      var fila = el('div', 'sp-leyenda-fila');
      fila.appendChild(tag(t.cls, t.t));
      fila.appendChild(el('span', null, t.ayuda));
      caja.appendChild(fila);
    });
    var extra = el('div', 'sp-leyenda-fila');
    extra.appendChild(el('b', null, 'La otra versión'));
    extra.appendChild(el('span', null,
      'Cuando el Gobierno o la parte señalada respondió, su respuesta va dentro ' +
      'de la misma tarjeta. No se publica una acusación sin su descargo.'));
    caja.appendChild(extra);

    var pie = el('p', 'sp-leyenda-pie',
      'Ningún hecho entra aquí sin enlace a la fuente. Si un dato no está publicado, ' +
      'se dice que falta en vez de estimarlo.');
    caja.appendChild(pie);

    d.appendChild(caja);
    cont.appendChild(d);
  }

  function pintarChipsMuro() {
    var cont = vaciar($('sp-hoy-chips'));
    // Solo se ofrecen los temas que existen: un filtro que devuelve cero
    // resultados es una promesa incumplida.
    var cuenta = {};
    (D.entradas || []).forEach(function (e) {
      cuenta[e.categoria] = (cuenta[e.categoria] || 0) + 1;
    });
    var lista = [{ id: 'todos', n: 'Todo', ico: '📋', c: (D.entradas || []).length }];
    Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a]; })
      .forEach(function (id) {
        lista.push({ id: id, n: cat(id).nombre, ico: cat(id).icono, c: cuenta[id] });
      });

    lista.forEach(function (x) {
      var b = el('button', 'sp-chip' + (muroTema === x.id ? ' on' : '')); b.type = 'button';
      b.setAttribute('aria-pressed', muroTema === x.id ? 'true' : 'false');
      if (x.id !== 'todos') pintarColorCategoria(b, x.id);
      b.appendChild(el('span', 'sp-chip-i', x.ico || '•'));
      b.appendChild(el('span', 'sp-chip-n', x.n));
      b.appendChild(el('span', 'sp-chip-c', String(x.c)));
      b.addEventListener('click', function () { muroTema = x.id; pintarMuro(); });
      cont.appendChild(b);
    });
  }

  function tarjetaMuro(o) {
    var e = o.e;
    var art = el('article', 'sp-post');
    pintarColorCategoria(art, e.categoria);

    // Cabecera tipo publicación: quién (el tema) y cuándo.
    var top = el('div', 'sp-post-top');
    top.appendChild(disco(e.categoria));
    var quien = el('div', 'sp-post-quien');
    quien.appendChild(el('b', null, cat(e.categoria).nombre));
    var cuando = el('span', null, fechaCorta(e.fecha) +
      (e.precision === 'aproximada' ? ' · fecha aproximada' : ''));
    quien.appendChild(cuando);
    top.appendChild(quien);
    var ti = TIPOS[e.tipoFuente];
    if (ti) top.appendChild(tag(ti.cls, ti.t, ti.ayuda));
    art.appendChild(top);

    // Imagen opcional: el JSON puede traer `imagen` y `alt` el día que haya
    // material propio. Sin `alt` no se pinta: una foto sin descripción no informa.
    if (e.imagen && e.alt) {
      var fig = el('figure', 'sp-post-img');
      var img = document.createElement('img');
      img.src = e.imagen; img.alt = e.alt; img.loading = 'lazy';
      fig.appendChild(img);
      if (e.credito) fig.appendChild(el('figcaption', null, e.credito));
      art.appendChild(fig);
    }

    var cuerpo = el('div', 'sp-post-cuerpo');
    cuerpo.appendChild(el('h3', null, e.titulo || ''));
    if (e.detalle) cuerpo.appendChild(el('p', null, e.detalle));
    art.appendChild(cuerpo);

    if (e.contrapunto) {
      var cp = el('div', 'sp-post-cp');
      cp.appendChild(el('b', null, 'La otra versión'));
      cp.appendChild(el('p', null, e.contrapunto));
      art.appendChild(cp);
    }

    var pie = el('div', 'sp-post-pie');
    var nf = fuentesDe(e).length;
    pie.appendChild(el('span', 'sp-post-src', nf + (nf === 1 ? ' fuente' : ' fuentes')));
    var ver = el('button', 'sp-post-ver'); ver.type = 'button';
    ver.textContent = 'Abrir y ver fuentes →';
    ver.addEventListener('click', function () { ir({ v: 'hecho', i: o.i, desde: 'hoy' }); });
    pie.appendChild(ver);
    art.appendChild(pie);
    return art;
  }

  // ══ BALANCE DEL PERIODO ═══════════════════════════════════════════════════
  var SIGNOS = {
    riesgo: { t: 'Señal de alerta', c: '#C95A55', i: '▲' },
    logro:  { t: 'A favor',         c: '#1F7A4B', i: '●' },
    neutro: { t: 'Todavía sin leer', c: '#527C91', i: '■' }
  };

  function pintarBalance() {
    var cont = vaciar($('sp-balance'));
    var b = (D.balances || [])[0];
    if (!b) { cont.appendChild(vacio()); return; }

    // Aviso primero: quien llega aquí tiene que saber que esto NO es un hecho.
    var av = el('div', 'sp-interp');
    av.appendChild(el('b', null, 'Esto es interpretación, no un hecho'));
    av.appendChild(el('p', null, b.entradilla || ''));
    cont.appendChild(av);

    var cab = el('div', 'sp-bal-cab');
    cab.appendChild(el('h3', null, b.titulo || ''));
    cab.appendChild(el('p', 'sp-bal-rango',
      'Del ' + fechaCorta(b.desde) + ' al ' + fechaCorta(b.corte) +
      ' · ' + diasDesde(b.desde) + ' días de gobierno'));
    cont.appendChild(cab);

    if (b.resumen) cont.appendChild(el('p', 'sp-bal-resumen', b.resumen));

    // Las señales llevan icono + color + etiqueta escrita: el color solo
    // nunca puede ser el único canal que distingue riesgo de logro.
    (b.señales || []).forEach(function (s) {
      var g = SIGNOS[s.signo] || SIGNOS.neutro;
      var n = el('div', 'sp-senal');
      n.style.setProperty('--sg', g.c);
      var h = el('div', 'sp-senal-top');
      h.appendChild(el('span', 'sp-senal-i', g.i));
      h.appendChild(el('span', 'sp-senal-k', g.t));
      n.appendChild(h);
      n.appendChild(el('h4', null, s.t || ''));
      n.appendChild(el('p', null, s.d || ''));
      cont.appendChild(n);
    });

    if ((b.loQueFalta || []).length) {
      var f = el('section', 'sp-falta');
      f.appendChild(el('h4', null, 'Lo que falta por verse'));
      var ul = el('ul');
      b.loQueFalta.forEach(function (x) { ul.appendChild(el('li', null, x)); });
      f.appendChild(ul);
      cont.appendChild(f);
    }

    if (b.metodo) {
      var m = el('section', 'sp-metodo');
      m.appendChild(el('h4', null, 'Cómo se hizo este balance'));
      m.appendChild(el('p', null, b.metodo));
      cont.appendChild(m);
    }
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
      pintarColorCategoria(b, e.categoria);

      var top = el('div', 'sp-h-top');
      top.appendChild(disco(e.categoria, true));
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

      var ICO_EST = { documentada: '✅', tension: '⚖️', desmentida: '❌' };
      var head = el('div', 'sp-cx-head');
      var izq = el('div', 'sp-cx-head-l');
      var ic = el('span', 'sp-disco sp-disco-s', ICO_EST[x.estado] || '•');
      ic.setAttribute('aria-hidden', 'true');
      var colEst = x.estado === 'desmentida' ? '#C95A55' : (x.estado === 'tension' ? '#D99A32' : '#0E86BC');
      ic.style.setProperty('--cbg', mezcla(colEst, 0.88, true));
      ic.style.setProperty('--cbd', mezcla(colEst, 0.68, true));
      izq.appendChild(ic);
      izq.appendChild(el('h3', null, x.tema || ''));
      head.appendChild(izq);
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
      var ic = el('span', 'sp-fodatab-ico', b.i);
      ic.setAttribute('aria-hidden', 'true');
      ic.style.setProperty('--fbg', mezcla(b.col, 0.88, true));
      t.appendChild(ic);
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

  // ══ GRÁFICAS ══════════════════════════════════════════════════════════════
  // SVG escrito a mano: sin librerías ni dependencias de red, y con control
  // total del contraste. Marcas finas, rejilla discreta y etiqueta directa en
  // cada dato — que además es obligatoria: el ámbar de "en tensión" queda en
  // 2.44:1 sobre blanco, por debajo del mínimo para marcas, y la etiqueta es
  // el canal que lo compensa.
  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(t, attrs) {
    var n = document.createElementNS(NS, t);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function miles(n) {
    return Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  // Línea del dólar. Una sola serie: sin caja de leyenda, el título la nombra.
  function grafDolar(d, compacta) {
    var pts = (d.puntos || []).filter(function (p) { return p && p.v != null; });
    if (pts.length < 2) return null;

    var W = 640, H = compacta ? 120 : 210;
    var mL = 8, mR = 8, mT = 14, mB = compacta ? 22 : 34;
    var vs = pts.map(function (p) { return p.v; });
    var min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
    var pad = (max - min) * 0.25 || 1;
    min -= pad; max += pad;
    var X = function (i) { return mL + (W - mL - mR) * (i / (pts.length - 1)); };
    var Y = function (v) { return mT + (H - mT - mB) * (1 - (v - min) / (max - min)); };

    // La clase es necesaria: el CSS no puede estirar "cualquier svg dentro de
    // .sp-graf" porque ahí también viven los iconitos de las fuentes.
    var svg = svgEl('svg', { class: 'sp-lienzo', viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'El dólar pasó de ' + miles(pts[0].v) + ' a ' + miles(pts[pts.length-1].v) + ' pesos' });

    // Rejilla: solo dos guías, recesivas
    [0, 1].forEach(function (k) {
      var y = mT + (H - mT - mB) * k;
      svg.appendChild(svgEl('line', { x1: mL, x2: W - mR, y1: y, y2: y,
        stroke: '#E1E5E7', 'stroke-width': 1 }));
    });

    var dLine = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i) + ' ' + Y(p.v); }).join(' ');
    var dArea = dLine + ' L' + X(pts.length - 1) + ' ' + (H - mB) + ' L' + X(0) + ' ' + (H - mB) + ' Z';

    var gid = 'spgrad' + Math.random().toString(36).slice(2, 8);
    var defs = svgEl('defs');
    var lg = svgEl('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' });
    lg.appendChild(svgEl('stop', { offset: '0', 'stop-color': '#34CCFE', 'stop-opacity': '.28' }));
    lg.appendChild(svgEl('stop', { offset: '1', 'stop-color': '#34CCFE', 'stop-opacity': '0' }));
    defs.appendChild(lg); svg.appendChild(defs);

    svg.appendChild(svgEl('path', { d: dArea, fill: 'url(#' + gid + ')' }));
    svg.appendChild(svgEl('path', { d: dLine, fill: 'none', stroke: '#0E86BC', 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    pts.forEach(function (p, i) {
      // La posesión se marca con una guía vertical: es el punto de referencia
      // de todo el módulo.
      if (p.hito) {
        svg.appendChild(svgEl('line', { x1: X(i), x2: X(i), y1: mT - 4, y2: H - mB,
          stroke: '#946A00', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      }
      var ultimo = i === pts.length - 1;
      svg.appendChild(svgEl('circle', { cx: X(i), cy: Y(p.v), r: ultimo ? 5 : 3.5,
        fill: ultimo ? '#0E86BC' : '#FFFFFF', stroke: '#0E86BC', 'stroke-width': 2 }));

      if (compacta) return;
      var t = svgEl('text', { x: X(i), y: H - mB + 15, 'text-anchor':
        i === 0 ? 'start' : (ultimo ? 'end' : 'middle'),
        fill: '#5F6B72', 'font-size': '11', 'font-weight': '600' });
      t.textContent = fechaCorta(p.f).replace(' 2026', '');
      svg.appendChild(t);

      if (i === 0 || ultimo || p.hito) {
        var v = svgEl('text', { x: X(i), y: Y(p.v) - 11, 'text-anchor':
          i === 0 ? 'start' : (ultimo ? 'end' : 'middle'),
          fill: '#152229', 'font-size': '12', 'font-weight': '700' });
        v.textContent = miles(p.v);
        svg.appendChild(v);
      }
    });
    return svg;
  }

  // Composición de las contradicciones. Los estados son ESTADO, no series
  // arbitrarias: llevan color reservado y siempre con etiqueta, nunca color solo.
  function grafContradicciones() {
    var casos = ((D.contradicciones || {}).casos) || [];
    if (!casos.length) return null;
    var orden = [
      { k: 'documentada', t: 'Documentadas', c: '#0E86BC' },
      { k: 'tension',     t: 'En tensión',   c: '#D99A32' },
      { k: 'desmentida',  t: 'Desmentidas',  c: '#C95A55' }
    ];
    var total = casos.length;
    var datos = orden.map(function (o) {
      return { o: o, n: casos.filter(function (x) { return x.estado === o.k; }).length };
    }).filter(function (x) { return x.n; });

    var cont = el('div');
    var W = 640, H = 42, gap = 3;
    var svg = svgEl('svg', { class: 'sp-lienzo', viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': datos.map(function (x) { return x.n + ' ' + x.o.t.toLowerCase(); }).join(', ') });
    var x = 0;
    datos.forEach(function (x1, i) {
      var w = (W - gap * (datos.length - 1)) * (x1.n / total);
      var r = svgEl('rect', { x: x, y: 0, width: Math.max(0, w), height: H, rx: 5, fill: x1.o.c });
      svg.appendChild(r);
      // Etiqueta dentro cuando cabe: es el alivio de contraste exigido
      if (w > 44) {
        var t = svgEl('text', { x: x + w / 2, y: H / 2 + 5, 'text-anchor': 'middle',
          fill: '#FFFFFF', 'font-size': '15', 'font-weight': '700' });
        t.textContent = x1.n;
        svg.appendChild(t);
      }
      x += w + gap;
    });
    cont.appendChild(svg);

    var leg = el('div', 'sp-leg');
    datos.forEach(function (x1) {
      var s = el('span');
      var i = el('i'); i.style.background = x1.o.c; i.setAttribute('aria-hidden', 'true');
      s.appendChild(i);
      s.appendChild(el('span', null, x1.o.t + ' · ' + x1.n));
      leg.appendChild(s);
    });
    cont.appendChild(leg);
    return cont;
  }

  // Deuda: medidor por entidad. Es una razón contra un techo (desembolsado
  // sobre comprometido), que es justo lo que un medidor muestra mejor que una barra.
  function grafDeuda(d) {
    var cont = el('div');
    (d.lineas || []).forEach(function (l) {
      var m = el('div', 'sp-medidor');
      var top = el('div', 'sp-med-top');
      top.appendChild(el('span', 'sp-med-n', l.n));
      top.appendChild(el('span', 'sp-med-v',
        (l.desembolsado != null ? miles(l.desembolsado) + ' de ' : '') + miles(l.comprometido) + ' M USD'));
      m.appendChild(top);

      var track = el('div', 'sp-med-track');
      var pct = l.desembolsado != null && l.comprometido
        ? Math.max(0, Math.min(100, l.desembolsado * 100 / l.comprometido)) : 0;
      var fill = el('div', 'sp-med-fill');
      fill.style.width = pct + '%';
      if (pct >= 18) fill.textContent = Math.round(pct) + '% girado';
      track.appendChild(fill);
      m.appendChild(track);
      if (l.e) m.appendChild(el('p', 'sp-med-e', l.e));
      cont.appendChild(m);
    });

    if (d.aparte) {
      var ap = el('div', 'sp-med-aparte');
      ap.appendChild(el('b', null, d.aparte.n + ' · ' + miles(d.aparte.v) + ' M USD'));
      ap.appendChild(el('span', null, d.aparte.e || ''));
      cont.appendChild(ap);
    }
    return cont;
  }

  function tarjetaGrafica(titulo, unidad, cuerpo, nota, fuentes, extra) {
    var c = el('section', 'sp-graf');
    c.appendChild(el('h3', 'sp-graf-h', titulo));
    if (unidad) c.appendChild(el('p', 'sp-graf-u', unidad));
    if (extra) c.appendChild(extra);
    if (cuerpo) c.appendChild(cuerpo);
    if (nota) c.appendChild(el('p', 'sp-graf-nota', nota));
    if (fuentes && fuentes.length) {
      var w = el('div', 'sp-graf-src');
      var f = el('div', 'sp-fuentes');
      pintarFuentes(f, fuentes);
      w.appendChild(f);
      c.appendChild(w);
    }
    return c;
  }

  function pintarIndicadores() {
    var ind = D.indicadores || {};
    var cont = vaciar($('sp-graficas'));

    // 1 · Dólar
    if (ind.dolar) {
      var pts = ind.dolar.puntos || [];
      var extra = null;
      if (pts.length >= 2) {
        var a = pts[0].v, z = pts[pts.length - 1].v, dif = z - a;
        var pct = (dif / a) * 100;
        extra = el('div', 'sp-cifra');
        extra.appendChild(el('b', null, miles(z)));
        var dl = el('span', 'sp-delta ' + (dif <= 0 ? 'sp-delta-baja' : 'sp-delta-sube'),
          (dif <= 0 ? '▼ ' : '▲ ') + miles(Math.abs(dif)) + ' (' + Math.abs(pct).toFixed(1) + '%)');
        extra.appendChild(dl);
        extra.appendChild(el('span', 'sp-med-v', 'desde el ' + fechaCorta(pts[0].f)));
      }
      cont.appendChild(tarjetaGrafica(ind.dolar.titulo, ind.dolar.unidad,
        grafDolar(ind.dolar, false), ind.dolar.leyenda, ind.dolar.fuentes, extra));
    }

    // 2 · Deuda
    if (ind.deuda) {
      cont.appendChild(tarjetaGrafica(ind.deuda.titulo, ind.deuda.unidad,
        grafDeuda(ind.deuda), ind.deuda.leyenda, ind.deuda.fuentes));
    }

    // 3 · Contradicciones (se calcula de los propios casos, sin datos nuevos)
    var g = grafContradicciones();
    if (g) {
      cont.appendChild(tarjetaGrafica('Cómo se reparten las contradicciones',
        ((D.contradicciones || {}).casos || []).length + ' casos registrados', g,
        'Una contradicción documentada no es lo mismo que una acusación: las desmentidas se publican precisamente para señalar que circulan y son falsas.',
        null));
    }
  }

  // Mini gráfica del dólar en la portada, para que la primera pantalla no
  // arranque plana y se vea de una que hay datos vivos.
  function pintarHeroGrafica() {
    var cont = vaciar($('sp-hero-graf'));
    var d = (D.indicadores || {}).dolar;
    if (!d || !(d.puntos || []).length) return;
    var pts = d.puntos, a = pts[0].v, z = pts[pts.length - 1].v, dif = z - a;
    var pct = (dif / a) * 100;

    var b = el('button', 'sp-hero-graf'); b.type = 'button';
    var top = el('div', 'sp-hero-graf-top');
    top.appendChild(el('span', 'sp-hero-graf-t', d.titulo));
    var dl = el('span', 'sp-delta ' + (dif <= 0 ? 'sp-delta-baja' : 'sp-delta-sube'),
      (dif <= 0 ? '▼ ' : '▲ ') + miles(Math.abs(dif)) + ' (' + Math.abs(pct).toFixed(1) + '%)');
    top.appendChild(dl);
    b.appendChild(top);
    var g = grafDolar(d, true);
    if (g) b.appendChild(g);
    b.appendChild(el('p', 'sp-med-e', miles(z) + ' pesos · ' + fechaLarga(pts[pts.length - 1].f)));
    b.addEventListener('click', function () { ir({ v: 'indicadores' }); });
    cont.appendChild(b);
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
      pintarHeroGrafica();
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
