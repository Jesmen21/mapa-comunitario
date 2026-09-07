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
  /* El registro CERRADO del gobierno anterior (assets/data/seguimiento-petro.json).
     Vive aparte porque no cambia: la rutina diaria no lo toca y así su diff no
     engorda. Se carga en segundo plano, después del registro vivo, y si no
     llega la pestaña lo dice en vez de quedarse en blanco. */
  var DA = null;
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

  // El módulo se revisa cada 6 horas (10:00, 16:00, 22:00 y 04:00, hora de
  // Colombia). Antes se anunciaba "próxima revisión el <fecha>": con una sola
  // pasada al día esa fecha era exacta, pero con cuatro se queda corta — promete
  // mañana cuando la siguiente pasada es en seis horas, y anunciar de menos es
  // justo lo que resta credibilidad al módulo. Se anuncia la cadencia, que sí es
  // cierta siempre; `actualizado` sigue siendo el sello real de frescura. El
  // campo `proximaActualizacion` del JSON se conserva como dato.
  var CADENCIA_REVISION = 'se revisa cada 6 horas';

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
  /* El registro del gobierno anterior trae sus propias categorías —Paz Total,
     Reformas— que no existen en el vivo. Sin el segundo parámetro, la ficha
     del anterior mostraría el identificador crudo en vez del nombre. */
  function cat(id, reg) {
    var c = (reg || D).categorias;
    return (c && c[id]) || (D.categorias && D.categorias[id]) || { nombre: id, icono: '•' };
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

  // Identidad de cada sección. El número no es adorno: es el orden de lectura,
  // de lo más polémico a lo más metodológico (ver ORDEN_SECS).
  // Cada sección lleva DOS tonos: `c` va en texto pequeño (el número) y debe
  // pasar 4.5:1; `m` es la marca —riel e icono— donde basta 3:1 y conviene el
  // tono vivo. El ámbar es el caso que obliga a separarlos: vivo da 2.44:1.
  // El orden es por POLÉMICA, no por cronología ni por método: lo que el
  // lector quiere leer primero va primero. La ficha abre el módulo.
  var ORDEN_SECS = ['ficha', 'contradicciones', 'hoy', 'timeline', 'balance',
                    'extranjera', 'indicadores', 'temas', 'foda'];
  var SECS = {
    ficha:           { n: '00', c: '#6B4B16', m: '#A67C2E', t: 'Ficha del gobernante', d: 'Fiabilidad, casos, contradicciones y rasgos, contados sobre el registro.' },
    contradicciones: { n: '01', c: '#8A5D12', m: '#D99A32', t: 'Contradicciones',  d: 'Cambios de postura y posiciones en tensión.' },
    hoy:             { n: '02', c: '#0B6E9B', m: '#34CCFE', t: 'Al día',           d: 'Lo último publicado, como un muro.' },
    timeline:        { n: '03', c: '#0B6E9B', m: '#0E86BC', t: 'Línea de tiempo',  d: 'Hechos y decisiones documentadas.' },
    balance:         { n: '04', c: '#7A4A6B', m: '#A96A94', t: 'Balance del periodo', d: 'El patrón que dejan todos los hechos juntos.' },
    extranjera:      { n: '05', c: '#0F6E62', m: '#2AA391', t: 'Participación extranjera', d: 'Hechos documentados donde interviene un actor de fuera.' },
    indicadores:     { n: '06', c: '#946A00', m: '#C79200', t: 'Indicadores',      d: 'Deuda, dólar y cifras que se pueden seguir.' },
    temas:           { n: '07', c: '#06405A', m: '#0A5678', t: 'Temas de fondo',   d: 'Contexto que no pertenece a una fecha concreta.' },
    foda:            { n: '08', c: '#5D5FA8', m: '#5D5FA8', t: 'Balance FODA',     d: 'Fortalezas, debilidades, oportunidades y amenazas.' }
  };
  var ICONOS = {
    hoy:             '<path d="M4 5h16v14H4z"/><path d="M4 10h16M9 10v9"/>',
    balance:         '<path d="M12 3v18"/><path d="M5 8l7-3 7 3"/><path d="M3 14l2-6 2 6a2 2 0 0 1-4 0zM17 14l2-6 2 6a2 2 0 0 1-4 0z"/>',
    extranjera:      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>',
    timeline:        '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>',
    contradicciones: '<path d="M8 4v11"/><path d="M5 12l3 3 3-3"/><path d="M16 20V9"/><path d="M13 12l3-3 3 3"/>',
    foda:            '<path d="M4 20V10M10 20V4M16 20v-7M22 20h-2"/><path d="M2 20h20"/>',
    temas:           '<path d="M4 6h16M4 12h16M4 18h10"/>',
    indicadores:     '<path d="M3 17l5-6 4 4 6-8"/><path d="M15 7h4v4"/>',
    ficha:           '<path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 8.7l5.4-.8z"/>'
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
      case 'extranjera': case 'ficha':
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
      case 'extranjera': return '#/participacion-extranjera';
      case 'ficha': return '#/ficha-del-gobernante';
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
      case 'participacion-extranjera': return { v: 'extranjera' };
      case 'ficha-del-gobernante': return { v: 'ficha' };
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
      case 'extranjera': return 'Participación extranjera';
      case 'ficha': return 'Ficha del gobernante';
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
    if (p) { ir(p); return; }
    /* De vuelta a la aplicación, con el modo con el que se entró: el APK de
       URBIS_CO llega acá como seguimiento.html?app=ciudadano, y si la vuelta
       fuera a index.html a secas, la app instalada aparecería completa. */
    var modo = '';
    try { modo = new URLSearchParams(location.search).get('app') || ''; } catch (e) {}
    location.href = 'index.html' + (/^[a-z_]+$/.test(modo) ? '?app=' + modo : '');
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
    if (r.v === 'extranjera') pintarExtranjera();
    if (r.v === 'ficha') pintarFicha();

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

    pintarPlacaPortada();
    pintarAccesoMuro();

    var cuenta = { timeline: nHechos, extranjera: hechosExtranjeros().length,
                   contradicciones: nCx, foda: nFoda, temas: nTemas, hoy: nHechos,
                   indicadores: null, balance: null, ficha: null };
    var nav = vaciar($('sp-secciones'));
    ORDEN_SECS.forEach(function (v) {
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
      'Actualizado el ' + fechaLarga(D.actualizado) + ' · ' + CADENCIA_REVISION +
      ' · ' + diasDesde(D.posesion) + ' días de gobierno.';

    $('sp-upd-txt').textContent = fechaCorta(D.actualizado);
    $('sp-upd').title = 'Actualizado el ' + fechaLarga(D.actualizado) +
                        '. El seguimiento ' + CADENCIA_REVISION + '.';
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
    // Con índice, para poder abrir el hecho completo desde aquí.
    var recientes = (D.entradas || []).map(function (e, i) { return { e: e, i: i }; })
      .sort(porDiaYPolemica)
      .slice(0, 4);
    if (!recientes.length) return;

    var caja = el('section', 'sp-nuevo');
    caja.setAttribute('aria-label', 'Lo último publicado');

    var top = el('div', 'sp-nuevo-top');
    top.appendChild(el('span', 'sp-nuevo-vivo', 'AL DÍA'));
    top.appendChild(el('span', 'sp-nuevo-f', 'Última publicación: ' +
      diaEtiqueta(recientes[0].e.fecha).toLowerCase()));
    // Cuántas van en los últimos siete días: dice de un vistazo si el
    // seguimiento está al día o si lleva tiempo quieto.
    var semana = (D.entradas || []).filter(function (x) { return diasDesde(x.fecha) <= 7; }).length;
    if (semana > 0) {
      top.appendChild(el('span', 'sp-nuevo-semana', semana +
        (semana === 1 ? ' registro esta semana' : ' registros esta semana')));
    }
    caja.appendChild(top);

    // ── La última publicación, desplegada ─────────────────────────────────
    // Antes solo se veía su título dentro de una lista de tres. Un titular
    // suelto no dice nada: obliga a entrar para saber de qué se trata, y ese
    // toque de más es justo el que la gente no da. Aquí va con su fecha, su
    // tema, el detalle y la fuente, para poder enterarse sin salir de la
    // portada.
    var p0 = recientes[0];
    var dest = el('article', 'sp-nuevo-dest');
    pintarColorCategoria(dest, p0.e.categoria);

    var meta = el('div', 'sp-nuevo-meta');
    meta.appendChild(disco(p0.e.categoria, true));
    meta.appendChild(el('span', 'sp-nuevo-tema', (cat(p0.e.categoria) || {}).nombre || ''));
    meta.appendChild(el('span', 'sp-nuevo-fecha', fechaLarga(p0.e.fecha)));
    var ti = TIPOS[p0.e.tipoFuente];
    if (ti) {
      var tag = el('span', 'sp-tag sp-tag-' + ti.cls, ti.t);
      tag.title = ti.ayuda;
      meta.appendChild(tag);
    }
    dest.appendChild(meta);

    dest.appendChild(el('h3', 'sp-nuevo-tit', p0.e.titulo || ''));
    if (p0.e.detalle) dest.appendChild(el('p', 'sp-nuevo-det', p0.e.detalle));
    // El contrapunto se anuncia pero no se despliega: en la portada cabe el
    // hecho, y la otra versión es justamente la razón para entrar a leerlo.
    if (p0.e.contrapunto) {
      dest.appendChild(el('p', 'sp-nuevo-cp', '⚖️ Tiene contrapunto: hay una versión que matiza o contradice esto.'));
    }
    var abrir = el('button', 'sp-nuevo-abrir', 'Leer el hecho completo y sus fuentes →');
    abrir.type = 'button';
    abrir.addEventListener('click', function () { ir({ v: 'hecho', i: p0.i, desde: 'hoy' }); });
    dest.appendChild(abrir);
    caja.appendChild(dest);

    // ── Y lo que vino antes ───────────────────────────────────────────────
    var resto = recientes.slice(1);
    if (resto.length) {
      caja.appendChild(el('p', 'sp-nuevo-antes', 'Antes de eso'));
      var ul = el('ul', 'sp-nuevo-list');
      resto.forEach(function (o) {
        var li = el('li');
        var bt = el('button', 'sp-nuevo-item'); bt.type = 'button';
        bt.appendChild(disco(o.e.categoria, true));
        var tx = el('span', 'sp-nuevo-item-tx');
        tx.appendChild(el('b', null, o.e.titulo || ''));
        tx.appendChild(el('em', null, diaEtiqueta(o.e.fecha)));
        bt.appendChild(tx);
        bt.addEventListener('click', function () { ir({ v: 'hecho', i: o.i, desde: 'hoy' }); });
        li.appendChild(bt);
        ul.appendChild(li);
      });
      caja.appendChild(ul);
    }

    var go = el('button', 'sp-nuevo-go', 'Ver el muro completo →');
    go.type = 'button';
    go.addEventListener('click', function () { ir({ v: 'hoy' }); });
    caja.appendChild(go);
    cont.appendChild(caja);
  }

  // ══ MURO "AL DÍA" ═════════════════════════════════════════════════════════
  // Entra por fecha, no por tema: es para quien solo quiere saber qué pasó
  // hoy. Se agrupa por día y se ordena de lo más nuevo a lo más viejo — el
  // array del JSON no viene ordenado y no se puede confiar en su orden— y,
  // dentro del mismo día, por polémica (ver polemicaDe).
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
      .sort(porDiaYPolemica);

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

    var lista = entradasFiltradas(filtro.tema).sort(porDiaYPolemica);
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
  // ══ PARTICIPACIÓN EXTRANJERA ══════════════════════════════════════════════
  // Cuenta hechos documentados en los que interviene un actor de fuera del
  // país. NO calcula un "porcentaje de injerencia": ese número no existe.
  // Ninguna institución lo publica, no hay metodología aceptada y no hay
  // denominador posible —¿el total de qué?—. Ponerlo sería inventarlo, y
  // saldría con el sello de URBIS pareciendo un dato. La regla del módulo ya
  // lo dice para las gráficas: si un dato no está publicado, se deja en nulo
  // y se dice, no se estima. Acá se aplica igual.
  //
  // Lo que sí se puede hacer, y es lo que hace esta sección: contar hechos
  // que ya están registrados con su fuente, y dejar que cada quien los lea.
  var CATS_EXTRANJERAS = ['eeuu', 'israel', 'exterior'];

  function hechosExtranjeros() {
    return (D.entradas || []).map(function (e, i) { return { e: e, i: i }; })
      .filter(function (x) { return CATS_EXTRANJERAS.indexOf(x.e.categoria) !== -1; })
      .sort(function (a, b) { return String(b.e.fecha || '').localeCompare(String(a.e.fecha || '')); });
  }

  function pintarExtranjera() {
    var lista = hechosExtranjeros();
    var total = (D.entradas || []).length;
    var cont = vaciar($('sp-extlist'));

    // Recuento por actor, calculado de los datos y no escrito a mano: si
    // mañana la rutina agrega una entrada, el número se mueve solo.
    var porCat = {};
    lista.forEach(function (x) { porCat[x.e.categoria] = (porCat[x.e.categoria] || 0) + 1; });

    var resumen = el('div', 'sp-ext-resumen');
    var enc = el('p', 'sp-ext-cifra');
    enc.appendChild(el('b', null, String(lista.length)));
    enc.appendChild(document.createTextNode(
      ' hecho' + (lista.length === 1 ? '' : 's') + ' documentado' + (lista.length === 1 ? '' : 's') +
      ', de ' + total + ' registrados en total'));
    resumen.appendChild(enc);

    var chips = el('div', 'sp-ext-chips');
    CATS_EXTRANJERAS.forEach(function (k) {
      if (!porCat[k]) return;
      var c = cat(k);
      var ch = el('span', 'sp-ext-chip');
      ch.style.setProperty('--cc', c.color || '#0F6E62');
      ch.textContent = (c.icono || '') + ' ' + c.nombre + ' · ' + porCat[k];
      chips.appendChild(ch);
    });
    resumen.appendChild(chips);
    cont.appendChild(resumen);

    // El aviso NO es decorativo: es lo que impide que este recuento se lea
    // como una medición de influencia, que es justo lo que no es.
    var nota = el('div', 'sp-ext-nota');
    nota.appendChild(el('b', null, 'Qué es y qué no es este número'));
    var ul = el('ul');
    [
      'Es un recuento de hechos que URBIS ya registró CON FUENTE. Cada uno se puede abrir y comprobar.',
      'NO es un porcentaje de injerencia extranjera. Ese dato no existe: nadie lo publica y no hay forma honesta de calcularlo. Si algún día ves una cifra así en cualquier lado, preguntá de dónde salió el denominador.',
      'Una denuncia no cuenta acá. Si alguien acusa a un operador extranjero de ofrecerle algo a un político, eso entra a la línea de tiempo como denuncia, con su fuente y su contrapunto, pero no suma a este recuento hasta que esté documentado.',
      'Que un hecho aparezca no significa que sea indebido. Un tratado, una visita oficial y una presión encubierta son cosas distintas: acá se listan, no se juzgan.'
    ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    nota.appendChild(ul);
    cont.appendChild(nota);

    if (!lista.length) {
      cont.appendChild(el('p', 'sp-h-meta', 'Todavía no hay hechos registrados en estas categorías.'));
      return;
    }

    lista.forEach(function (x) {
      var c = cat(x.e.categoria);
      var b = el('button', 'sp-ext-item'); b.type = 'button';
      b.style.setProperty('--cc', c.color || '#0F6E62');
      var head = el('div', 'sp-ext-item-head');
      head.appendChild(el('span', 'sp-ext-item-cat', (c.icono || '') + ' ' + c.nombre));
      head.appendChild(el('span', 'sp-ext-item-fecha', fechaCorta ? fechaCorta(x.e.fecha) : (x.e.fecha || '')));
      b.appendChild(head);
      b.appendChild(el('h3', null, x.e.titulo || ''));
      // El campo del nombre es `n`, no `t`. Sin esto la ficha mostraba la URL
      // entera y la lista se volvía ilegible.
      var f = fuentesDe(x.e);
      if (f.length) {
        var nombres = f.map(function (y) {
          if (y.n) return String(y.n).split(' · ')[0];
          try { return new URL(y.u).hostname.replace(/^www\./, ''); } catch (er) { return ''; }
        }).filter(Boolean);
        // sin repetir: varias fuentes del mismo medio se ven como una
        nombres = nombres.filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (nombres.length) {
          b.appendChild(el('p', 'sp-ext-item-fuente',
            (nombres.length === 1 ? 'Fuente: ' : 'Fuentes: ') + nombres.join(' · ')));
        }
      }
      // Un hecho disputado no puede verse igual que uno verificado: es
      // exactamente la diferencia que este recuento pide no confundir.
      if (x.e.tipoFuente === 'disputado') {
        b.appendChild(el('p', 'sp-ext-item-contra', '⚖️ Dato disputado entre fuentes'));
      } else if (x.e.contrapunto) {
        b.appendChild(el('p', 'sp-ext-item-contra', '⚖️ Tiene contrapunto registrado'));
      }
      b.addEventListener('click', function () { ir({ v: 'hecho', i: x.i }); });
      cont.appendChild(b);
    });
  }

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

  /* ══ LA FICHA DEL GOBERNANTE ═══════════════════════════════════════════════
     Pedido: una ficha de personaje al estilo de los generales de Rome: Total
     War —rasgos, y un nivel de fiabilidad que se mueva con lo que va haciendo—.
     Y desde la v791, que sea lo PRIMERO que se ve al abrir el módulo, con lo
     más polémico arriba: casos de corrupción, después contradicciones, después
     rasgos. Lo metodológico va abajo y pequeño, pero va.

     El estilo se toma prestado; el contenido, no. En un juego la fiabilidad es
     un número que decide el diseñador. Acá se trata de una persona real, así
     que la ficha no puede tener ni una cifra que no salga de contar el
     registro. De ahí las tres reglas de esta sección:

     · NADA se escribe a mano aquí. Cada medida es una cuenta sobre lo que ya
       está en el JSON —hechos, su naturaleza declarada, casos de corrupción
       con su estado probatorio, casos de contradicción—. Por eso se actualiza
       sola: cuando la revisión de cada seis horas agrega un hecho, la ficha
       cambia en la siguiente carga, sin que nadie toque código.
     · Cada cuenta dice QUÉ MIDE DE VERDAD. «Claridad» no mide honestidad:
       mide cuánto de lo registrado quedó verificado por terceros. Confundir
       las dos cosas es el error que convierte un tablero en una calumnia con
       estética de tablero.
     · El veredicto lleva su regla impresa al lado, y debajo van los casos que
       lo forman, con nombre. Si alguien no está de acuerdo, puede ver
       exactamente qué se contó y discutirlo.

     La escalera se clasifica por cómo se ha MOSTRADO, sin esperar a que se
     repare: no hay peldaño intermedio de gracia ni promedio que compense. Tres
     cuentas ponen cada una un techo, y el veredicto es el peor de los tres.
     Un caso de corrupción confirmado ya baja a «poco fiable» aunque todo lo
     demás esté limpio; lo que no está confirmado se muestra, con su etiqueta,
     y no pesa. */

  // Debajo de esto no hay veredicto que dar: se dice «sin datos suficientes»,
  // que es la respuesta honesta cuando el registro todavía es corto.
  var FICHA_MIN_CASOS = 3;
  var FICHA_MIN_HECHOS = 20;

  // La escalera, de mejor a peor. El ÍNDICE es el orden: cada techo devuelve
  // un índice y el veredicto es el mayor de los tres.
  var ESCALERA = [
    { id: 'inquebrantable', t: 'Confiabilidad inquebrantable',
      d: 'Ningún caso de corrupción confirmado, ningún cambio de postura contado y 85 % o más del registro verificado por terceros.' },
    { id: 'fiable', t: 'Fiable',
      d: 'Sin casos confirmados. Como mucho un cambio de postura contado, o entre 70 y 84 % del registro verificado.' },
    { id: 'dudosa', t: 'Dudosa',
      d: 'Sin casos confirmados. Un caso de corrupción en investigación; o dos cambios de postura contados; o entre 50 y 69 % del registro verificado.' },
    { id: 'poco-fiable', t: 'Poco fiable',
      d: 'Un caso de corrupción confirmado; o dos o más en investigación; o tres o más cambios de postura contados; o menos del 50 % del registro verificado.' },
    { id: 'nada-fiable', t: 'Nada fiable',
      d: 'Dos o más casos de corrupción confirmados.' }
  ];
  // Los tres techos. Cada función devuelve el PEOR peldaño que esa cuenta
  // permite; ninguna puede subir lo que otra bajó.
  //
  // Los casos de corrupción pesan por su estado probatorio, y desde la v792
  // también los que están EN PROCESO: un caso en investigación por una
  // autoridad ya baja a «dudosa»; dos o más, a «poco fiable». Pesan menos
  // que un confirmado (uno: «poco fiable»; dos: «nada fiable») porque una
  // investigación abierta no es un fallo, pero no se espera a que se
  // resuelva para que cuente. Un señalamiento —un medio o un actor político,
  // sin autoridad detrás— se muestra y no pesa.
  var TECHOS = {
    casos:    { t: 'Casos de corrupción (confirmados y en investigación)',
                f: function (conf, inv) {
                  var porConf = conf >= 2 ? 4 : conf >= 1 ? 3 : 0;
                  var porInv  = inv  >= 2 ? 3 : inv  >= 1 ? 2 : 0;
                  return Math.max(porConf, porInv);
                } },
    palabra:  { t: 'Cambios de postura contados',     f: function (n)   { return n >= 3 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0; } },
    claridad: { t: 'Registro verificado por terceros', f: function (pct) { return pct == null ? 0 : pct < 50 ? 3 : pct < 70 ? 2 : pct < 85 ? 1 : 0; } }
  };
  // El estado probatorio de un caso de corrupción. Pesan `confirmado` y
  // `en-investigacion` (este, menos); un señalamiento no.
  var ESTADOS_CASO = {
    'confirmado':       { t: 'Confirmado',       cls: 'conf', pesa: true,
                          d: 'Hay fallo, sanción, documento oficial o reconocimiento del propio implicado.' },
    'en-investigacion': { t: 'En investigación', cls: 'inv',  pesa: true,
                          d: 'Hay proceso abierto por una autoridad. Pesa, menos que un confirmado: uno baja a «dudosa», dos a «poco fiable».' },
    'senalamiento':     { t: 'Señalamiento',     cls: 'sen',  pesa: false,
                          d: 'Lo dice un medio o un actor político; ninguna autoridad se ha pronunciado. Se muestra; no pesa.' },
    'archivado':        { t: 'Archivado sin hallazgo', cls: 'arch', pesa: false,
                          d: 'Una autoridad lo revisó y lo cerró sin encontrar mérito. Se muestra; no pesa.' },
    'por-documentar':   { t: 'Por documentar',   cls: 'pend', pesa: false, oculto: true,
                          d: 'Nombrado pero todavía sin hecho ni fuente. No se muestra ni pesa.' }
  };
  var ORDEN_CASO = { 'confirmado': 0, 'en-investigacion': 1, 'senalamiento': 2, 'archivado': 3, 'por-documentar': 4 };

  function casosDeCx(dd) { return (((dd || D).contradicciones || {}).casos || []); }
  function casosDeCorrupcion(dd) { return (((dd || D).casos || {}).lista || []); }

  // Un caso de contradicción pesa si el registro lo dio por documentado y no
  // lleva `cuenta:false`. Lo segundo es del dato, no del código: quien
  // documenta el caso es quien sabe si es un giro de discurso o un asunto
  // personal que no dice nada sobre su palabra.
  function casoCuenta(c) { return c.estado === 'documentada' && c.cuenta !== false; }

  function hechosDelMandato(dd, corte) {
    var desde = dd.posesion || '';
    return (dd.entradas || []).filter(function (e) {
      if (!e.fecha) return false;
      if (desde && e.fecha < desde) return false;
      return corte ? e.fecha <= corte : true;
    });
  }

  /* ── Polémica ──────────────────────────────────────────────────────────────
     Lo que el lector quiere leer primero. Es una puntuación explícita, no un
     criterio editorial escondido: pesa el tema (corrupción, legitimidad,
     desinformación arriba), que la naturaleza del dato esté en disputa, y que
     haya otra versión al lado. Se publica para poder probarla con entradas de
     mentira. En el muro y en la línea de tiempo manda primero la FECHA y
     dentro del mismo día la polémica; en la ficha manda solo la polémica. */
  var POLEMICA_CAT = { corrupcion: 5, legitimidad: 4, informacion: 4,
                       emergencia: 2, eeuu: 2, israel: 2, servicios: 2 };
  function polemicaDe(e) {
    if (!e) return 0;
    var p = POLEMICA_CAT[e.categoria] || 1;
    if (e.tipoFuente === 'disputado') p += 3;
    else if (e.tipoFuente === 'declaracion') p += 1;
    if (e.contrapunto) p += 2;
    return p;
  }
  // Comparador para pares {e, i}: fecha descendente, luego polémica
  // descendente, luego el orden del registro (estable).
  function porDiaYPolemica(a, b) {
    if (a.e.fecha !== b.e.fecha) return a.e.fecha < b.e.fecha ? 1 : -1;
    var d = polemicaDe(b.e) - polemicaDe(a.e);
    return d || (a.i - b.i);
  }

  /* ── Rasgos ────────────────────────────────────────────────────────────────
     Al estilo Total War, pero derivados de CUENTAS con umbral declarado, no
     redactados a mano. Cada rasgo dice cuántos de cuántos y cuál es el
     umbral; si la cuenta no llega, el rasgo no aparece. `de` es el
     denominador y `umbral` es un porcentaje, salvo `absoluto`, que es una
     cantidad. */
  var RE_DENUNCIA = /denunci|gobierno anterior|administraci[oó]n anterior|libro de la verdad|gobierno petro/i;
  var RASGOS = [
    { id: 'decreta', t: 'Gobierna por decreto', umbral: 30,
      d: 'Una parte grande de lo registrado son actos de gobierno y decretos.',
      cuenta: function (ent) { return { n: ent.filter(function (e) { return e.categoria === 'gobierno'; }).length, de: ent.length, deT: 'hechos' }; } },
    { id: 'emergencia', t: 'Gobierna en emergencia', umbral: 15,
      d: 'Las emergencias ocupan una parte grande de la agenda registrada.',
      cuenta: function (ent) { return { n: ent.filter(function (e) { return e.categoria === 'emergencia'; }).length, de: ent.length, deT: 'hechos' }; } },
    { id: 'disputado', t: 'Bajo disputa', umbral: 10,
      d: 'Una parte del registro quedó en versiones enfrentadas que ningún tercero dirimió.',
      cuenta: function (ent) {
        var con = ent.filter(function (e) { return e.tipoFuente; });
        return { n: con.filter(function (e) { return e.tipoFuente === 'disputado'; }).length, de: con.length, deT: 'hechos con naturaleza declarada' }; } },
    { id: 'exterior', t: 'Mira hacia afuera', umbral: 10,
      d: 'Israel, Estados Unidos y la política exterior pesan en el registro.',
      cuenta: function (ent) { return { n: ent.filter(function (e) { return e.categoria === 'israel' || e.categoria === 'eeuu' || e.categoria === 'exterior'; }).length, de: ent.length, deT: 'hechos' }; } },
    { id: 'denunciante', t: 'Denuncia al gobierno anterior', umbral: 30,
      d: 'Buena parte de lo registrado sobre corrupción son denuncias suyas contra la administración anterior, no casos propios.',
      cuenta: function (ent) {
        var corr = ent.filter(function (e) { return e.categoria === 'corrupcion'; });
        return { n: corr.filter(function (e) { return RE_DENUNCIA.test((e.titulo || '') + ' ' + (e.detalle || '')); }).length,
                 de: corr.length, deT: 'hechos de corrupción (se cuentan los que nombran una denuncia o al gobierno anterior)' }; } },
    { id: 'cambia', t: 'Cambia de postura', umbral: 2, absoluto: true,
      d: 'Hay cambios de postura documentados con las dos declaraciones.',
      cuenta: function (ent, dd) {
        var cx = casosDeCx(dd);
        return { n: cx.filter(casoCuenta).length, de: cx.length, deT: 'casos de postura revisados' }; } }
  ];
  function rasgosDe(dd, ent) {
    var out = [];
    RASGOS.forEach(function (r) {
      var c = r.cuenta(ent, dd);
      if (!c.de) return;
      var pct = Math.round(100 * c.n / c.de);
      var pasa = r.absoluto ? c.n >= r.umbral : pct >= r.umbral;
      if (!pasa) return;
      out.push({ id: r.id, t: r.t, d: r.d, n: c.n, de: c.de, deT: c.deT, pct: pct,
                 umbral: r.absoluto ? r.umbral + ' o más' : r.umbral + ' %' });
    });
    return out;
  }

  /* La ficha entera, calculada. Dos parámetros y ninguna lectura de fuera:
     `dd` es el registro y `corte` permite rehacerla con lo que había en una
     fecha pasada, que es como se dibuja la serie de abajo —la misma función,
     no una copia con otras reglas—. Que sea pura es lo que permite probarla
     con registros de mentira: se le pasa uno con un caso confirmado y tiene
     que decir «poco fiable», sin tocar el JSON de verdad. */
  function fichaDe(dd, corte) {
    if (!dd) dd = {};
    var ent = hechosDelMandato(dd, corte);
    var cx = casosDeCx(dd);

    var palabra = { revisados: cx.length, contadas: 0, noCuentan: 0, tension: 0, desmentidas: 0, casos: [] };
    cx.forEach(function (c, i) {
      if (c.estado === 'documentada') {
        if (casoCuenta(c)) { palabra.contadas++; palabra.casos.push({ c: c, i: i, pesa: true }); }
        else { palabra.noCuentan++; palabra.casos.push({ c: c, i: i, pesa: false }); }
      } else if (c.estado === 'tension') { palabra.tension++; palabra.casos.push({ c: c, i: i, pesa: false }); }
      else if (c.estado === 'desmentida') { palabra.desmentidas++; palabra.casos.push({ c: c, i: i, pesa: false }); }
    });
    // Los que cuentan, primero.
    palabra.casos.sort(function (a, b) { return (b.pesa ? 1 : 0) - (a.pesa ? 1 : 0) || (a.i - b.i); });

    // Casos de corrupción con estado probatorio. Los sin fecha o posteriores
    // al corte no entran a la serie; los `por-documentar` nunca se pintan.
    var casos = { confirmados: 0, enInvestigacion: 0, senalamientos: 0, archivados: 0, porDocumentar: 0, lista: [] };
    casosDeCorrupcion(dd).forEach(function (c, i) {
      var est = ESTADOS_CASO[c.estado];
      if (!est) return;
      if (c.estado === 'por-documentar') { casos.porDocumentar++; return; }
      if (corte && (!c.fecha || c.fecha > corte)) return;
      if (c.estado === 'confirmado') casos.confirmados++;
      else if (c.estado === 'en-investigacion') casos.enInvestigacion++;
      else if (c.estado === 'archivado') casos.archivados++;
      else casos.senalamientos++;
      casos.lista.push({ c: c, i: i, pesa: est.pesa });
    });
    casos.lista.sort(function (a, b) {
      var d = (ORDEN_CASO[a.c.estado] || 0) - (ORDEN_CASO[b.c.estado] || 0);
      if (d) return d;
      if (a.c.fecha !== b.c.fecha) return a.c.fecha < b.c.fecha ? 1 : -1;
      return a.i - b.i;
    });

    var claridad = { conTipo: 0, verificado: 0, disputado: 0, declaracion: 0, sinTipo: 0, pct: null };
    ent.forEach(function (e) {
      var t = e.tipoFuente || '';
      if (t === 'verificado') { claridad.verificado++; claridad.conTipo++; }
      else if (t === 'disputado') { claridad.disputado++; claridad.conTipo++; }
      else if (t === 'declaracion') { claridad.declaracion++; claridad.conTipo++; }
      else claridad.sinTipo++;
    });
    if (claridad.conTipo) claridad.pct = Math.round(100 * claridad.verificado / claridad.conTipo);

    var hasta = corte || (new Date()).toISOString().slice(0, 10);
    var dias = Math.max(1, Math.round(
      (new Date(hasta + 'T00:00:00') - new Date((dd.posesion || hasta) + 'T00:00:00')) / 86400000));
    var ritmo = { hechos: ent.length, dias: dias, porSemana: Math.round(10 * 7 * ent.length / dias) / 10 };

    var porCat = {};
    ent.forEach(function (e) { porCat[e.categoria] = (porCat[e.categoria] || 0) + 1; });
    var alcance = {
      activos: Object.keys(porCat).length,
      total: Object.keys(dd.categorias || {}).length,
      top: Object.keys(porCat).map(function (k) { return { k: k, n: porCat[k] }; })
        .sort(function (a, b) { return b.n - a.n; }).slice(0, 3)
    };

    // Los tres techos y el peor de ellos.
    var techos = {
      casos:    { i: TECHOS.casos.f(casos.confirmados, casos.enInvestigacion),
                  n: casos.confirmados + casos.enInvestigacion, t: TECHOS.casos.t,
                  detalle: casos.confirmados + ' conf. · ' + casos.enInvestigacion + ' en inv.' },
      palabra:  { i: TECHOS.palabra.f(palabra.contadas), n: palabra.contadas,  t: TECHOS.palabra.t },
      claridad: { i: TECHOS.claridad.f(claridad.pct),    n: claridad.pct,      t: TECHOS.claridad.t }
    };
    var peor = Math.max(techos.casos.i, techos.palabra.i, techos.claridad.i);
    var manda = Object.keys(techos).filter(function (k) { return techos[k].i === peor && peor > 0; });

    var v;
    if (palabra.revisados < FICHA_MIN_CASOS || ritmo.hechos < FICHA_MIN_HECHOS) {
      v = { id: 'sin-datos', t: 'Sin datos suficientes',
            d: 'Hacen falta al menos ' + FICHA_MIN_CASOS + ' casos de postura revisados y ' +
               FICHA_MIN_HECHOS + ' hechos registrados. Todavía no los hay.' };
    } else {
      v = ESCALERA[peor];
    }

    return { corte: hasta, palabra: palabra, casos: casos, claridad: claridad, ritmo: ritmo,
             alcance: alcance, techos: techos, manda: manda, veredicto: v,
             rasgos: rasgosDe(dd, ent) };
  }

  function fichaHasta(corte) { return fichaDe(D, corte); }

  // La serie: la misma ficha rehecha semana a semana desde la posesión. Es lo
  // que contesta «¿va mejorando o empeorando?» sin que nadie lo opine.
  //
  // Con una salvedad que se dice en pantalla y no se disimula: los casos de
  // contradicción NO llevan fecha en el registro, así que en esta serie no se
  // mueven. Lo que se mueve es lo fechado —los hechos, su verificación y los
  // casos de corrupción—.
  function serieFicha() {
    var desde = D.posesion; if (!desde) return [];
    var t0 = new Date(desde + 'T00:00:00').getTime();
    var hoy = Date.now();
    var out = [];
    for (var t = t0 + 7 * 86400000; t <= hoy + 6 * 86400000; t += 7 * 86400000) {
      var parcial = t > hoy;
      var iso = new Date(parcial ? hoy : t).toISOString().slice(0, 10);
      var f = fichaHasta(iso);
      out.push({ corte: iso, hechos: f.ritmo.hechos, pct: f.claridad.pct,
                 nuevos: 0, parcial: parcial, veredicto: f.veredicto.id });
      if (parcial) break;
    }
    out.forEach(function (p, i) { p.nuevos = p.hechos - (i ? out[i - 1].hechos : 0); });
    return out;
  }

  /* Se publica la función PURA además de la que lee el registro cargado: es
     lo que deja comprobar la escalera del veredicto, los techos, los rasgos y
     la polémica contra registros armados a mano, sin tener que inventar
     hechos en el JSON público. */
  window.URBIS_SEG_FICHA = { calcular: fichaHasta, calcularCon: fichaDe,
                             serie: serieFicha, escalera: ESCALERA, techos: TECHOS,
                             estadosCaso: ESTADOS_CASO, rasgos: RASGOS,
                             polemica: polemicaDe, ordenar: porDiaYPolemica,
                             minimos: { casos: FICHA_MIN_CASOS, hechos: FICHA_MIN_HECHOS } };

  // ── Piezas de dibujo ──────────────────────────────────────────────────────
  // Barra apilada: cada tramo es una CUENTA, no un porcentaje inventado. Si un
  // tramo es cero no se dibuja, y el total va escrito al lado.
  function barraCuentas(tramos) {
    var total = tramos.reduce(function (a, b) { return a + b.n; }, 0);
    var b = el('div', 'sp-fi-barra');
    b.setAttribute('role', 'img');
    b.setAttribute('aria-label', tramos.filter(function (x) { return x.n; })
      .map(function (x) { return x.n + ' ' + x.t; }).join(', ') || 'sin datos');
    if (!total) { b.appendChild(el('span', 'sp-fi-tramo sp-fi-vacio')); return b; }
    tramos.forEach(function (x) {
      if (!x.n) return;
      var s = el('span', 'sp-fi-tramo sp-fi-c-' + x.c);
      s.style.flexGrow = String(x.n);
      s.title = x.n + ' · ' + x.t;
      b.appendChild(s);
    });
    return b;
  }

  // Con `t1` se escribe el singular. Sin esto la leyenda dice «1 documentados
  // que no cuentan», y una ficha que no sabe contar hasta uno no invita a
  // creerle el resto de las cuentas.
  function leyendaCuentas(tramos) {
    var l = el('div', 'sp-fi-leg');
    tramos.forEach(function (x) {
      if (!x.n && x.ocultarEnCero) return;
      var i = el('span', 'sp-fi-legit');
      i.appendChild(el('i', 'sp-fi-pt sp-fi-c-' + x.c));
      i.appendChild(el('b', null, String(x.n)));
      i.appendChild(el('span', null, (x.n === 1 && x.t1) ? x.t1 : x.t));
      l.appendChild(i);
    });
    return l;
  }

  function medida(o) {
    var c = el('section', 'sp-fi-medida');
    var h = el('header', 'sp-fi-medh');
    h.appendChild(el('h4', null, o.nombre));
    h.appendChild(el('span', 'sp-fi-cifra', o.cifra));
    c.appendChild(h);
    c.appendChild(el('p', 'sp-fi-mide', o.mide));
    c.appendChild(barraCuentas(o.tramos));
    c.appendChild(leyendaCuentas(o.tramos));
    if (o.ir) {
      var b = el('button', 'sp-fi-ver'); b.type = 'button';
      b.appendChild(el('span', null, o.irTxt || 'Ver la evidencia'));
      b.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
      b.addEventListener('click', function () { ir(o.ir); });
      c.appendChild(b);
    }
    return c;
  }

  function flechaIr() {
    var go = el('span', 'sp-sec-go');
    go.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
    return go;
  }
  function inicialesDe(nombre) {
    return String(nombre || '?').split(/\s+/)
      .filter(function (w) { return w.length > 2; }).slice(0, 2)
      .map(function (w) { return w[0].toUpperCase(); }).join('');
  }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  // La línea de las tres cuentas que producen el veredicto. Va debajo del
  // veredicto en la placa: se entiende de un vistazo por qué dice lo que dice.
  function cuentasDe(f) {
    return plural(f.casos.confirmados, 'caso confirmado', 'casos confirmados') + ' · ' +
           f.casos.enInvestigacion + ' en investigación · ' +
           plural(f.palabra.contadas, 'cambio de postura', 'cambios de postura') + ' · ' +
           (f.claridad.pct == null ? 'sin verificación declarada' : f.claridad.pct + ' % verificado');
  }

  /* La placa. La misma en la portada (dentro de un botón que lleva a la
     ficha) y arriba de la ficha. Sin retrato: no se usa la cara de una
     persona real como si fuera la miniatura de un personaje. Va un sello con
     sus iniciales. El veredicto es el texto más grande del módulo. */
  function placaDe(f, reg) {
    reg = reg || D;
    var cerrado = !!reg.cerrado;
    var placa = el('div', 'sp-fi-placa sp-fi-v-' + f.veredicto.id + (cerrado ? ' sp-fi-placa-cerrada' : ''));
    var cab = el('div', 'sp-fi-placa-cab');
    var sello = el('div', 'sp-fi-sello', inicialesDe(reg.presidente));
    sello.setAttribute('aria-hidden', 'true');
    cab.appendChild(sello);
    var pt = el('div', 'sp-fi-placat');
    pt.appendChild(el('p', 'sp-fi-cargo',
      (cerrado ? 'Gobierno anterior · ' : 'Presidente de la República · ') + (reg.periodo || '')));
    pt.appendChild(el('p', 'sp-fi-nombre', reg.presidente || '—'));
    pt.appendChild(el('p', 'sp-fi-dias', (cerrado
        ? 'Mandato terminado el ' + fechaCorta(reg.entrega) + ' · '
        : 'Día ' + diasDesde(reg.posesion) + ' de gobierno · ') +
      plural(f.ritmo.hechos, 'hecho registrado', 'hechos registrados')));
    cab.appendChild(pt);
    placa.appendChild(cab);
    placa.appendChild(el('p', 'sp-fi-vlabel', 'Fiabilidad'));
    placa.appendChild(el('p', 'sp-fi-vval', f.veredicto.t));
    placa.appendChild(el('p', 'sp-fi-cuentas', cuentasDe(f)));
    return placa;
  }

  // La portada abre en el perfil: la placa es lo primero, dentro de un botón.
  function pintarPlacaPortada() {
    var host = $('sp-hero-ficha'); if (!host) return;
    vaciar(host);
    var f = fichaHasta(null);
    var b = el('button', 'sp-placa-btn'); b.type = 'button';
    b.setAttribute('aria-label', 'Ficha del gobernante: ' + f.veredicto.t + '. ' + cuentasDe(f) + '. Abrir la ficha completa.');
    b.appendChild(placaDe(f));
    var pie = el('span', 'sp-placa-pie');
    pie.appendChild(el('span', null, 'Abrir la ficha del gobernante: casos, contradicciones y rasgos'));
    pie.appendChild(flechaIr());
    b.appendChild(pie);
    b.addEventListener('click', function () { ir({ v: 'ficha' }); });
    host.appendChild(b);
  }

  function tarjetaCaso(o) {
    var c = o.c, est = ESTADOS_CASO[c.estado];
    var art = el('article', 'sp-fi-cc sp-fi-cc-' + est.cls + (o.pesa ? ' pesa' : ''));
    var head = el('header', 'sp-fi-cc-head');
    head.appendChild(tag(est.cls === 'conf' ? 'no' : (est.cls === 'inv' ? 'dis' : (est.cls === 'arch' ? 'ok' : 'dec')), est.t, est.d));
    // `fecha` siempre existe porque ordena y recorta la serie. Cuando la fuente
    // no da el día —«archivado en 2021»— el registro pone el texto real en
    // `fechaTexto` y eso es lo que se lee: inventar un 1 de enero en pantalla
    // sería afirmar un dato que nadie tiene.
    if (c.fechaTexto) head.appendChild(el('span', 'sp-fi-cc-fecha', c.fechaTexto));
    else if (c.fecha) head.appendChild(el('span', 'sp-fi-cc-fecha', fechaCorta(c.fecha)));
    art.appendChild(head);
    art.appendChild(el('h4', null, c.titulo || ''));
    if (c.queSeConfirmo) {
      var q = el('p', 'sp-fi-cc-que');
      q.appendChild(el('b', null, est.pesa ? 'Qué se confirmó: ' : 'Qué hay: '));
      q.appendChild(document.createTextNode(c.queSeConfirmo));
      art.appendChild(q);
    }
    if (c.quienLoConfirmo) {
      var w = el('p', 'sp-fi-cc-quien');
      w.appendChild(el('b', null, 'Quién: '));
      w.appendChild(document.createTextNode(c.quienLoConfirmo));
      art.appendChild(w);
    }
    if (c.monto) art.appendChild(el('p', 'sp-fi-cc-monto', 'Monto: ' + c.monto));
    if (Array.isArray(c.implicados) && c.implicados.length) {
      art.appendChild(el('p', 'sp-fi-cc-imp', 'Implicados: ' + c.implicados.join(', ')));
    }
    // El motivo, en minúscula y sin el «se muestra; no pesa» que ya dice la frase.
    var motivo = est.d.replace(/\.?\s*Se muestra; no pesa.*$/, '.');
    art.appendChild(el('p', 'sp-fi-cc-pesa', !est.pesa
      ? 'No pesa en el veredicto: ' + motivo.charAt(0).toLowerCase() + motivo.slice(1)
      : (c.estado === 'confirmado' ? 'Pesa en el veredicto.'
         : 'Pesa en el veredicto, menos que un confirmado: no se espera a que la investigación se resuelva.')));
    var fl = el('div', 'sp-fuentes');
    pintarFuentes(fl, c.fuentes || []);
    art.appendChild(fl);
    return art;
  }

  function tarjetaCx(o) {
    var c = o.c;
    var it = el('button', 'sp-fi-caso' + (o.pesa ? ' pesa' : '')); it.type = 'button';
    var head = el('span', 'sp-fi-caso-head');
    head.appendChild(el('span', 'sp-fi-marca', o.pesa ? '●' : '○'));
    head.appendChild(el('b', null, c.tema || 'Caso'));
    var est = ESTADOS[c.estado] || ESTADOS.documentada;
    head.appendChild(tag(est.cls, est.t));
    it.appendChild(head);
    if (c.antes || c.despues) {
      var par = el('span', 'sp-fi-caso-par');
      var a = el('span', 'sp-fi-caso-mom'); a.appendChild(el('b', null, 'Antes')); a.appendChild(el('span', null, c.antes || '')); par.appendChild(a);
      var d = el('span', 'sp-fi-caso-mom'); d.appendChild(el('b', null, c.estado === 'desmentida' ? 'Verificadores' : 'Después')); d.appendChild(el('span', null, c.despues || '')); par.appendChild(d);
      it.appendChild(par);
    }
    it.appendChild(el('span', 'sp-fi-casod', o.pesa
      ? 'Cuenta: cambio de postura documentado.'
      : (c.estado === 'desmentida' ? 'No cuenta: la acusación fue desmentida por los verificadores.'
        : c.estado === 'tension' ? 'No cuenta: es una tensión interna del programa, no dos frases opuestas.'
        : 'No cuenta: el registro lo documenta, pero anotó que no es señalamiento de hipocresía.')));
    it.addEventListener('click', function () { ir({ v: 'contradicciones' }); });
    return it;
  }

  function seccionFicha(cls, titulo, dek) {
    var s = el('section', 'sp-fi-sec ' + cls);
    var h = el('header', 'sp-fi-sech');
    h.appendChild(el('h3', null, titulo));
    if (dek) h.appendChild(el('p', 'sp-fi-mide', dek));
    s.appendChild(h);
    return s;
  }

  /* ── La pestaña de al lado: cómo fue Petro y cómo va De la Espriella ──────
     Pedido del dueño. Se hizo tabla de cifras y NO una segunda ficha con
     veredicto, y la razón se dice en pantalla: la escalera está pensada para
     un mandato en curso, con casos que se mueven; aplicarla a uno cerrado
     compararía cuatro años contra unas semanas y el resultado sería una
     cifra con aire de sentencia. Acá cada fila lleva su fuente y dice si es
     comparable o no; donde no lo es, se escribe por qué en vez de rellenar
     con una estimación. */
  function comparacion() { return (D && D.comparacion) || null; }

  function filaComparativa(fila, cmp) {
    var art = el('article', 'sp-cmp-fila' + (fila.comparable ? ' sp-cmp-comparable' : ''));
    var h = el('header', 'sp-cmp-head');
    h.appendChild(el('h4', null, fila.titulo));
    h.appendChild(el('span', 'sp-cmp-unidad', fila.unidad));
    art.appendChild(h);

    var par = el('div', 'sp-cmp-par');
    var a = el('div', 'sp-cmp-lado sp-cmp-antes');
    a.appendChild(el('b', null, cmp.predecesor.nombre));
    a.appendChild(el('span', 'sp-cmp-periodo', cmp.predecesor.periodo));
    var va = el('p', 'sp-cmp-valor');
    if (fila.petro.inicio && fila.petro.inicio !== '—') {
      va.appendChild(el('span', 'sp-cmp-ini', fila.petro.inicio));
      va.appendChild(el('span', 'sp-cmp-flecha', '→'));
    }
    va.appendChild(el('b', null, fila.petro.fin));
    a.appendChild(va);
    a.appendChild(el('small', null, fila.petro.texto));
    par.appendChild(a);

    var b = el('div', 'sp-cmp-lado sp-cmp-ahora');
    b.appendChild(el('b', null, cmp.actual.nombre));
    b.appendChild(el('span', 'sp-cmp-periodo', cmp.actual.periodo));
    var vb = el('p', 'sp-cmp-valor');
    vb.appendChild(el('b', null, fila.ahora.valor));
    b.appendChild(vb);
    b.appendChild(el('small', null, fila.ahora.texto));
    par.appendChild(b);
    art.appendChild(par);

    if (!fila.comparable) {
      art.appendChild(el('p', 'sp-cmp-aviso', 'Todavía no se pueden comparar: el gobierno actual no tiene un periodo cerrado de esta cifra.'));
    }
    art.appendChild(el('p', 'sp-cmp-lectura', fila.lectura));
    var fl = el('div', 'sp-fuentes');
    pintarFuentes(fl, fila.fuentes || []);
    art.appendChild(fl);
    return art;
  }

  function pintarComparacion(cont) {
    var cmp = comparacion();
    vaciar(cont);
    if (!cmp) { cont.appendChild(el('p', 'sp-fi-nada', 'Todavía no hay comparación cargada.')); return; }

    var av = el('div', 'sp-interp');
    av.appendChild(el('b', null, 'Cuatro años contra unas semanas'));
    av.appendChild(el('p', null, cmp._nota));
    cont.appendChild(av);

    var lista = el('div', 'sp-cmp-lista');
    (cmp.filas || []).forEach(function (f) { lista.appendChild(filaComparativa(f, cmp)); });
    cont.appendChild(lista);

    // ── Lo que se dijo y era falso, en las dos direcciones ────────────────
    var di = cmp.desinformacion;
    if (di) {
      var s = seccionFicha('sp-cmp-desinfo', 'Lo que se dijo y era falso', di._nota);
      var c1 = el('div', 'sp-cmp-bloque sp-cmp-contra');
      c1.appendChild(el('h4', null, di.contra.titulo));
      (di.contra.casos || []).forEach(function (x) {
        var it = el('article', 'sp-cmp-bulo');
        it.appendChild(el('b', null, x.t));
        it.appendChild(el('p', null, x.d));
        var f1 = el('div', 'sp-fuentes');
        pintarFuentes(f1, [{ n: 'La Silla Vacía · Detector de Mentiras', u: x.u }]);
        it.appendChild(f1);
        c1.appendChild(it);
      });
      s.appendChild(c1);

      var c2 = el('div', 'sp-cmp-bloque sp-cmp-suya');
      c2.appendChild(el('h4', null, di.suya.titulo));
      c2.appendChild(el('p', null, di.suya.resumen));
      var f2 = el('div', 'sp-fuentes');
      pintarFuentes(f2, [{ n: 'La Silla Vacía · el manual de desinformación de Gustavo Petro', u: di.suya.u }]);
      c2.appendChild(f2);
      s.appendChild(c2);
      cont.appendChild(s);
    }
  }

  /* Las dos pestañas de la sección: la ficha del gobernante actual y la
     comparación con el anterior. Se recuerda cuál estaba abierta mientras
     dure la visita, pero no se guarda: al volver mañana se entra por la
     ficha, que es lo que el módulo promete en la portada. */
  var pestanaFicha = 'ficha';

  function pintarPestanas(cont) {
    var cmp = comparacion();
    if (!cmp) return null;
    var nav = el('nav', 'sp-cmp-tabs');
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Ficha del gobernante y comparación');
    [{ id: 'ficha', t: D.presidente || 'El gobernante', d: 'Fiabilidad, casos y rasgos' },
     { id: 'anterior', t: cmp.predecesor.nombre, d: 'La misma ficha, el gobierno anterior' },
     { id: 'comparacion', t: 'Cómo fue y cómo va', d: 'Las cifras, lado a lado' }
    ].forEach(function (p) {
      var b = el('button', 'sp-cmp-tab' + (p.id === pestanaFicha ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', p.id === pestanaFicha ? 'true' : 'false');
      b.appendChild(el('b', null, p.t));
      b.appendChild(el('small', null, p.d));
      b.addEventListener('click', function () {
        if (pestanaFicha === p.id) return;
        pestanaFicha = p.id;
        pintarFicha();
        try { cont.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {}
      });
      nav.appendChild(b);
    });
    return nav;
  }

  function pintarFicha() {
    var cont = vaciar($('sp-ficha'));
    var tabs = pintarPestanas(cont);
    if (tabs) cont.appendChild(tabs);

    if (tabs && pestanaFicha === 'comparacion') {
      var caja = el('div', 'sp-cmp');
      cont.appendChild(caja);
      pintarComparacion(caja);
      return;
    }

    /* La MISMA función de cálculo para los dos registros: fichaDe es pura y
       recibe el registro, así que el gobierno anterior no se mide con una
       copia con otras reglas. Que sea la misma es justo lo que hace válida
       la comparación —y también lo que obliga al aviso de abajo—. */
    var reg = (pestanaFicha === 'anterior') ? DA : D;
    if (pestanaFicha === 'anterior' && !reg) {
      cont.appendChild(el('p', 'sp-fi-nada', 'No se pudo cargar el registro del gobierno anterior. Vuelve a entrar en un momento.'));
      return;
    }
    var f = fichaDe(reg, reg.cerrado ? reg.entrega : null);

    /* El aviso que no se puede quitar. Los dos veredictos salen de la misma
       regla, pero no del mismo tiempo: cuatro años dan margen para que una
       denuncia llegue a fallo y se vuelva un caso «confirmado»; un mes, no.
       Poner los dos peldaños uno al lado del otro favorece SIEMPRE al
       gobierno más joven, y eso hay que decirlo donde se lee el peldaño, no
       en una nota al pie. */
    if (reg.cerrado) {
      var av = el('div', 'sp-interp sp-fi-aviso-tiempo');
      av.appendChild(el('b', null, 'Este peldaño no se compara de frente con el otro'));
      av.appendChild(el('p', null,
        'Los dos salen de la misma regla, pero no del mismo tiempo. Un mandato de cuatro años le da margen a una ' +
        'denuncia para llegar a fallo y convertirse en un caso confirmado, que es lo que más pesa; uno de semanas, no. ' +
        'Comparar los dos peldaños de frente favorece siempre al gobierno más joven. Para comparar de verdad están las ' +
        'cifras de la pestaña de al lado.'));
      if (reg.cobertura) av.appendChild(el('p', 'sp-fi-mide', reg.cobertura));
      cont.appendChild(av);
    }

    var izq = el('div', 'sp-fi-izq');
    var der = el('div', 'sp-fi-der');
    var rejilla = el('div', 'sp-fi-rejilla');
    rejilla.appendChild(izq);
    rejilla.appendChild(der);
    cont.appendChild(rejilla);

    // ── 1 · Placa y veredicto ──────────────────────────────────────────────
    izq.appendChild(placaDe(f, reg));

    var ver = el('section', 'sp-fi-ver-box sp-fi-v-' + f.veredicto.id);
    var esc = el('div', 'sp-fi-esc');
    esc.setAttribute('aria-label', 'Escalera: ' + ESCALERA.map(function (x) { return x.t; }).join(', '));
    ESCALERA.forEach(function (x) {
      var p = el('span', 'sp-fi-paso' + (x.id === f.veredicto.id ? ' on' : ''), x.t);
      p.title = x.d;
      esc.appendChild(p);
    });
    ver.appendChild(esc);
    ver.appendChild(el('p', 'sp-fi-vregla', f.veredicto.d));
    // Qué manda: el peor de los tres techos, con nombre.
    var tl = el('ul', 'sp-fi-techos');
    ['casos', 'palabra', 'claridad'].forEach(function (k) {
      var t = f.techos[k];
      var li = el('li', 'sp-fi-techo' + (f.manda.indexOf(k) !== -1 ? ' manda' : ''));
      li.appendChild(el('span', 'sp-fi-techo-t', t.t));
      li.appendChild(el('b', null, k === 'claridad' ? (t.n == null ? '—' : t.n + ' %') : (t.detalle || String(t.n))));
      li.appendChild(el('span', 'sp-fi-techo-p', '→ como mucho «' + ESCALERA[t.i].t + '»'));
      tl.appendChild(li);
    });
    ver.appendChild(tl);
    ver.appendChild(el('p', 'sp-fi-vnota', f.manda.length
      ? 'El veredicto es el peor de los tres techos. Aquí manda: ' +
        f.manda.map(function (k) { return f.techos[k].t.toLowerCase(); }).join(' y ') + '.'
      : 'Ninguna de las tres cuentas baja el veredicto.'));
    izq.appendChild(ver);

    // ── 2 · Casos de corrupción ────────────────────────────────────────────
    var sc = seccionFicha('sp-fi-secc', 'Casos de corrupción',
      'Atribuidos al gobernante o a su gobierno, con su estado probatorio. Pesan los confirmados y, ' +
      'menos, los que una autoridad tiene en investigación; un señalamiento y un caso que una autoridad ' +
      'ya archivó se muestran con su etiqueta y no mueven el veredicto. Las denuncias del Gobierno ' +
      'contra la administración anterior no son casos suyos: están en la línea de tiempo.');
    var grupos = [
      { k: 'confirmado', t: 'Confirmados', n: f.casos.confirmados },
      { k: 'en-investigacion', t: 'En investigación', n: f.casos.enInvestigacion },
      { k: 'senalamiento', t: 'Señalamientos', n: f.casos.senalamientos },
      { k: 'archivado', t: 'Archivados sin hallazgo', n: f.casos.archivados }
    ];
    var hayCasos = false;
    grupos.forEach(function (g) {
      var lista = f.casos.lista.filter(function (o) { return o.c.estado === g.k; });
      if (!lista.length) return;
      hayCasos = true;
      var gr = el('div', 'sp-fi-grupo sp-fi-grupo-' + ESTADOS_CASO[g.k].cls);
      gr.appendChild(el('h4', 'sp-fi-grupo-t', g.t + ' · ' + g.n));
      lista.forEach(function (o) { gr.appendChild(tarjetaCaso(o)); });
      sc.appendChild(gr);
    });
    if (!hayCasos) {
      sc.appendChild(el('p', 'sp-fi-nada', 'Ningún caso de corrupción documentado en el registro' +
        (f.casos.porDocumentar ? ' · ' + plural(f.casos.porDocumentar, 'caso nombrado por documentar', 'casos nombrados por documentar') + ', que no se muestran hasta tener hecho y fuente.' : '.')));
    } else if (f.casos.porDocumentar) {
      sc.appendChild(el('p', 'sp-fi-nada', plural(f.casos.porDocumentar, 'caso más nombrado por documentar', 'casos más nombrados por documentar') +
        ': no se muestra ni pesa hasta tener hecho y fuente.'));
    }
    der.appendChild(sc);

    // ── 3 · Contradicciones ────────────────────────────────────────────────
    var scx = seccionFicha('sp-fi-seccx', 'Contradicciones',
      'Cambios de postura con las dos declaraciones documentadas. Primero los que cuentan; ' +
      'después los que el registro anotó como no contados, las tensiones y lo desmentido.');
    if (f.palabra.casos.length) {
      var lc = el('div', 'sp-fi-casos');
      f.palabra.casos.forEach(function (o) { lc.appendChild(tarjetaCx(o)); });
      scx.appendChild(lc);
      var verCx = el('button', 'sp-fi-ver'); verCx.type = 'button';
      verCx.appendChild(el('span', null, 'Ver los casos con sus dos fuentes'));
      verCx.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
      verCx.addEventListener('click', function () { ir({ v: 'contradicciones' }); });
      scx.appendChild(verCx);
    } else {
      scx.appendChild(el('p', 'sp-fi-nada', 'Ningún caso de postura revisado todavía.'));
    }
    der.appendChild(scx);

    // ── 4 · Rasgos ─────────────────────────────────────────────────────────
    var sr = seccionFicha('sp-fi-secr', 'Rasgos',
      'Derivados de cuentas, no redactados: cada rasgo dice cuántos de cuántos y cuál es el umbral. ' +
      'Si la cuenta no llega, el rasgo no aparece.');
    if (f.rasgos.length) {
      var rg = el('div', 'sp-fi-rasgos');
      f.rasgos.forEach(function (r) {
        var a = el('article', 'sp-fi-rasgo sp-fi-r-' + r.id);
        var hd = el('header');
        hd.appendChild(el('b', null, r.t));
        hd.appendChild(el('span', 'sp-fi-rpct', r.pct + ' %'));
        a.appendChild(hd);
        a.appendChild(el('p', null, r.d));
        a.appendChild(el('p', 'sp-fi-rcuenta', r.n + ' de ' + r.de + ' ' + r.deT + ' · umbral: ' + r.umbral));
        rg.appendChild(a);
      });
      sr.appendChild(rg);
    } else {
      sr.appendChild(el('p', 'sp-fi-nada', 'Ninguna cuenta llega a su umbral todavía.'));
    }
    der.appendChild(sr);

    // ── 5 · Cómo va ────────────────────────────────────────────────────────
    /* La serie semanal solo tiene sentido en un mandato EN CURSO: en uno
       cerrado de cuatro años serían más de doscientas columnas y la pregunta
       que contesta —«¿va mejorando?»— ya no aplica. */
    var serie = reg.cerrado ? [] : serieFicha();
    if (serie.length) {
      var ev = seccionFicha('sp-fi-serie', 'Cómo va',
        'La misma ficha rehecha semana a semana. Las barras son los hechos nuevos de cada semana; ' +
        'la cifra de abajo, la parte verificada del registro acumulado. Los casos de postura no ' +
        'llevan fecha en el registro, así que en esta serie no se mueven: lo que se mueve es lo fechado.');
      var maxN = serie.reduce(function (a, p) { return Math.max(a, p.nuevos); }, 1);
      var g = el('div', 'sp-fi-graf');
      serie.forEach(function (p) {
        var col = el('div', 'sp-fi-col' + (p.parcial ? ' parcial' : ''));
        col.title = fechaCorta(p.corte) + ' · ' + p.nuevos + ' hechos nuevos · ' +
                    (p.pct == null ? 'sin verificación declarada' : p.pct + ' % verificado') +
                    (p.parcial ? ' · semana todavía en curso' : '');
        var bar = el('span', 'sp-fi-bar');
        bar.style.height = Math.max(3, Math.round(100 * p.nuevos / maxN)) + '%';
        col.appendChild(bar);
        col.appendChild(el('span', 'sp-fi-pct', p.pct == null ? '—' : p.pct + '%'));
        /* La última columna casi siempre es una semana a medias. Sin decirlo,
           su barra corta se lee como una caída de actividad que no ocurrió. */
        col.appendChild(el('span', 'sp-fi-sem', p.parcial ? 'en curso'
          : fechaCorta(p.corte).replace(/ \d{4}$/, '')));
        g.appendChild(col);
      });
      ev.appendChild(g);
      der.appendChild(ev);
    }

    // ── 6 · Método ─────────────────────────────────────────────────────────
    var met = seccionFicha('sp-fi-metodo', 'Método',
      'La escalera completa con sus umbrales, y las cuentas de las que sale cada techo.');
    var ol = el('ol', 'sp-fi-escalera');
    ESCALERA.forEach(function (x) {
      var li = el('li', 'sp-fi-esc-li sp-fi-v-' + x.id + (x.id === f.veredicto.id ? ' on' : ''));
      li.appendChild(el('b', null, x.t));
      li.appendChild(el('span', null, x.d));
      ol.appendChild(li);
    });
    met.appendChild(ol);
    met.appendChild(el('p', 'sp-fi-mide',
      'El veredicto es el peor de los tres techos: no hay promedio ni compensación. Hacen falta al menos ' +
      FICHA_MIN_CASOS + ' casos de postura revisados y ' + FICHA_MIN_HECHOS + ' hechos registrados; ' +
      'con menos se dice «sin datos suficientes». Un caso de corrupción pesa si está confirmado o si una autoridad lo tiene en investigación (menos); un señalamiento no; ' +
      'una contradicción, solo si está documentada con las dos declaraciones y el registro no la marcó como no contada; ' +
      'lo desmentido nunca suma en contra.'));

    var meds = el('div', 'sp-fi-meds');
    meds.appendChild(medida({
      nombre: 'Palabra',
      cifra: f.palabra.contadas + ' de ' + f.palabra.revisados,
      mide: 'De los casos donde el seguimiento pudo comparar lo que dijo antes con lo que dice ahora, cuántos quedaron documentados como cambio.',
      tramos: [
        { c: 'mal', n: f.palabra.contadas,    t: 'cambios contados', t1: 'cambio contado' },
        { c: 'med', n: f.palabra.tension,     t: 'en tensión' },
        { c: 'gris', n: f.palabra.noCuentan,  t: 'documentados que no cuentan', t1: 'documentado que no cuenta' },
        { c: 'ok',  n: f.palabra.desmentidas, t: 'acusaciones desmentidas', t1: 'acusación desmentida' }
      ],
      ir: { v: 'contradicciones' }, irTxt: 'Ver los casos con sus dos fuentes'
    }));
    meds.appendChild(medida({
      nombre: 'Claridad',
      cifra: (f.claridad.pct == null ? '—' : f.claridad.pct + ' %'),
      mide: 'De lo registrado con naturaleza declarada, qué parte confirmaron varios medios y qué parte quedó en versiones enfrentadas o en una sola voz. Mide el registro, no la intención.',
      tramos: [
        { c: 'ok',  n: f.claridad.verificado,  t: 'verificados', t1: 'verificado' },
        { c: 'med', n: f.claridad.disputado,   t: 'disputados', t1: 'disputado' },
        { c: 'mal', n: f.claridad.declaracion, t: 'de una sola voz' },
        { c: 'gris', n: f.claridad.sinTipo,    t: 'sin naturaleza declarada' }
      ],
      ir: { v: 'lista', tema: 'todos' }, irTxt: 'Ver la línea de tiempo'
    }));
    meds.appendChild(medida({
      nombre: 'Ritmo',
      cifra: String(f.ritmo.porSemana).replace('.', ',') + ' / semana',
      mide: 'Hechos registrados por semana desde la posesión. Mide actividad que llega a los medios, no aciertos.',
      tramos: [{ c: 'act', n: f.ritmo.hechos, t: 'hechos en ' + f.ritmo.dias + ' días', t1: 'hecho en ' + f.ritmo.dias + ' días' }],
      ir: { v: 'timeline' }, irTxt: 'Ver por temas'
    }));
    meds.appendChild(medida({
      nombre: 'Frentes',
      cifra: f.alcance.activos + ' de ' + f.alcance.total,
      mide: 'En cuántos de los frentes que sigue el módulo hay al menos un hecho.',
      tramos: f.alcance.top.map(function (x, i) {
        return { c: ['act', 'med', 'gris'][i], n: x.n, t: cat(x.k, reg).nombre };
      }).concat([{ c: 'gris2', n: f.ritmo.hechos - f.alcance.top.reduce(function (a, b) { return a + b.n; }, 0), t: 'los demás frentes' }]),
      ir: { v: 'timeline' }, irTxt: 'Ver por temas'
    }));
    met.appendChild(meds);

    var ul = el('ul', 'sp-fi-limites');
    [
      'No es una nota de gestión. Nada de lo que se cuenta aquí mide si una decisión fue buena para el país.',
      'No mide honestidad. Mide casos confirmados, constancia del discurso y verificabilidad del registro, que son otra cosa.',
      'Depende del registro: si un hecho no está documentado con fuente, para esta ficha no existe. Cubre desde la posesión, no la vida anterior de la persona.',
      'Una acusación desmentida no suma en contra. Se deja a la vista, marcada como desmentida.'
    ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    met.appendChild(ul);
    met.appendChild(el('p', 'sp-fi-mide', reg.cerrado
      ? 'Registro cerrado el ' + fechaLarga(reg.entrega) + '. No se actualiza: el mandato terminó.'
      : 'Última actualización del registro: ' + fechaLarga(reg.actualizado) + ' · ' + CADENCIA_REVISION + '.'));
    der.appendChild(met);
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
  // Formato del valor según lo que mide la serie. Un 52,4 no se lee igual que
  // 3.098 ni que "1 operación".
  function valorSerie(v, d) {
    var f = d && d.formato;
    if (f === 'pct') return String(v).replace('.', ',') + '%';
    if (f === 'entero') return String(Math.round(v));
    return miles(v);
  }

  // ── Comparación por fuente ────────────────────────────────────────────────
  // Cada encuestadora mide y pregunta distinto, así que NO se promedian: se
  // ponen una al lado de la otra con su nombre y su fecha. Barras horizontales
  // porque lo que se compara son magnitudes entre pocas opciones nombradas.
  function grafPorFuente(d, compacta) {
    var grupos = d.grupos || [];
    if (!grupos.length) return null;
    var cont = el('div', 'sp-fuentes-graf');
    // En la portada solo cabe lo que el título promete —la aprobación de la
    // gestión—; el bloque histórico se ve al abrir la gráfica completa.
    var visibles = compacta ? grupos.slice(0, 1) : grupos;

    visibles.forEach(function (g, gi) {
      var bloque = el('section', 'sp-fg-grupo');
      bloque.appendChild(el('h4', null, g.titulo || ''));
      if (g.nota && !compacta) bloque.appendChild(el('p', 'sp-fg-nota', g.nota));

      // La escala es común a todo el gráfico para que las barras se puedan
      // comparar entre grupos, no solo dentro de cada uno.
      var todas = grupos.reduce(function (a, x) {
        return a.concat((x.medidas || []).map(function (m) { return m.v; }),
                        x.referencia ? [x.referencia.v] : []);
      }, []);
      var max = Math.max.apply(null, todas.concat([1]));
      var tope = Math.ceil(max / 10) * 10;

      (g.medidas || []).forEach(function (m) {
        var fila = el('div', 'sp-fg-fila');
        var cab = el('div', 'sp-fg-cab');
        var nom = el('b', null, m.n || 'Fuente');
        // Un número sin saber quién lo midió no vale: el sello va pegado al
        // nombre, no escondido en una nota al pie.
        if (m.calidad === 'cuestionada') {
          nom.appendChild(tag('dis', 'metodología cuestionada',
            'Esta consultora no publica su metodología completa.'));
        }
        cab.appendChild(nom);
        cab.appendChild(el('span', 'sp-fg-val', String(m.v).replace('.', ',') + '%'));
        fila.appendChild(cab);

        var riel = el('div', 'sp-fg-riel');
        var barra = el('i');
        barra.style.width = (m.v / tope * 100).toFixed(1) + '%';
        barra.style.background = gi === 0 ? (d.color || '#0B6E9B') : '#8FA6B2';
        // La barra de una fuente cuestionada va rayada: se ve distinta aunque
        // no se lea la etiqueta, y sin depender solo del color.
        if (m.calidad === 'cuestionada') fila.classList.add('dudosa');
        riel.appendChild(barra);
        fila.appendChild(riel);

        if (!compacta) {
          var pie = [];
          if (m.f) pie.push(fechaCorta(m.f));
          if (m.e) pie.push(m.e);
          if (pie.length) fila.appendChild(el('small', null, pie.join(' · ')));

          // Ficha de la fuente: quién es, cómo mide y qué se le reprocha.
          if (m.quien || m.como || m.reparos) {
            var det = el('details', 'sp-fg-ficha');
            det.appendChild(el('summary', null, '¿Quién lo mide y cómo?'));
            var cuerpo = el('div');
            if (m.quien) { cuerpo.appendChild(el('b', null, 'Quién')); cuerpo.appendChild(el('p', null, m.quien)); }
            if (m.como) { cuerpo.appendChild(el('b', null, 'Cómo')); cuerpo.appendChild(el('p', null, m.como)); }
            if (m.reparos) {
              cuerpo.appendChild(el('b', 'rep', 'Qué se le reprocha'));
              cuerpo.appendChild(el('p', 'rep', m.reparos));
            }
            det.appendChild(cuerpo);
            fila.appendChild(det);
          }
        }
        bloque.appendChild(fila);
      });

      // La referencia (el resultado real) va como línea marcada, no como una
      // barra más: es un hecho, no una estimación.
      if (g.referencia) {
        var r = el('div', 'sp-fg-ref');
        r.appendChild(el('b', null, r0(g.referencia.v) + '%'));
        var t = el('div');
        t.appendChild(el('span', null, g.referencia.n || 'Resultado'));
        if (g.referencia.e) t.appendChild(el('small', null, g.referencia.e));
        r.appendChild(t);
        bloque.appendChild(r);
      }
      cont.appendChild(bloque);
    });
    return cont;
  }
  function r0(v) { return String(v).replace('.', ','); }

  // Serie temporal genérica. Nació para el dólar y ahora la usan también deuda,
  // aprobación y bombardeos: mismo lenguaje visual para todo lo que se sigue en
  // el tiempo, con el color propio de cada indicador.
  function grafSerie(d, compacta) {
    // Algunos indicadores no son una línea en el tiempo sino una comparación
    // entre fuentes; se delega sin que quien llama tenga que saberlo.
    if (d && d.vista === 'porFuente') return grafPorFuente(d, compacta);
    var pts = (d.puntos || []).filter(function (p) { return p && p.v != null; });
    if (!pts.length) return null;

    var col = d.color || '#0E86BC';
    // Una sola medición no es una línea: se dibuja el punto y se dice que aún
    // no hay serie, en vez de fingir una tendencia con un solo dato.
    if (pts.length === 1) {
      var caja = el('div', 'sp-unico');
      caja.style.setProperty('--c', col);
      caja.appendChild(el('b', null, valorSerie(pts[0].v, d)));
      caja.appendChild(el('span', null, fechaCorta(pts[0].f)));
      if (pts[0].e) caja.appendChild(el('small', null, pts[0].e));
      caja.appendChild(el('em', null, 'Una sola medición · aún no hay serie'));
      return caja;
    }

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
      'aria-label': (d.titulo || 'Serie') + ': de ' + valorSerie(pts[0].v, d) + ' a ' + valorSerie(pts[pts.length-1].v, d) });

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
    lg.appendChild(svgEl('stop', { offset: '0', 'stop-color': col, 'stop-opacity': '.28' }));
    lg.appendChild(svgEl('stop', { offset: '1', 'stop-color': col, 'stop-opacity': '0' }));
    defs.appendChild(lg); svg.appendChild(defs);

    svg.appendChild(svgEl('path', { d: dArea, fill: 'url(#' + gid + ')' }));
    svg.appendChild(svgEl('path', { d: dLine, fill: 'none', stroke: col, 'stroke-width': 2,
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
        fill: ultimo ? col : '#FFFFFF', stroke: col, 'stroke-width': 2 }));

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
        v.textContent = valorSerie(p.v, d);
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

  // ══ CONSULTA PROPIA DE URBIS ══════════════════════════════════════════════
  // Va SEPARADA de las encuestadoras a propósito: responde quien quiere, así
  // que mide a esta comunidad y no al país. Mezclarla con las casas
  // encuestadoras sería darle una autoridad que no tiene.
  var CONSULTA_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw-P002YjsFDWoNguJG10Y5MJVwEenSRaSdqJKe1c31wJ1n2e1_bxMfHTF0XziQbOdioA/exec';
  var _consultaCache = null;

  // Id estable por dispositivo. No identifica a nadie: es un número aleatorio
  // guardado en el propio navegador, solo para que el backend pueda descartar
  // votos repetidos del mismo aparato.
  function dispositivoId() {
    var k = 'urbis_consulta_disp';
    try {
      var v = localStorage.getItem(k);
      if (!v) {
        v = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return 'd-sin-storage'; }
  }
  function miVoto(id) {
    try { return localStorage.getItem('urbis_consulta_' + id) || ''; } catch (e) { return ''; }
  }
  function guardarMiVoto(id, k) {
    try { localStorage.setItem('urbis_consulta_' + id, k); } catch (e) {}
  }

  function consultaAPI(payload) {
    return fetch(CONSULTA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.text(); }).then(function (t) {
      try { return JSON.parse(t); } catch (e) { return { ok: false }; }
    });
  }

  function pintarConsulta(cont) {
    var c = (D.indicadores || {}).consulta;
    if (!c) return;
    var caja = el('section', 'sp-graf sp-consulta');
    caja.style.setProperty('--c', c.color || '#7A4A6B');

    caja.appendChild(el('h3', 'sp-graf-h', c.titulo || 'Consulta'));
    caja.appendChild(el('p', 'sp-consulta-preg', c.pregunta || ''));

    var aviso = el('div', 'sp-consulta-aviso');
    aviso.appendChild(el('b', null, 'No es una encuesta representativa'));
    aviso.appendChild(el('p', null, c.aviso || ''));
    caja.appendChild(aviso);

    var zona = el('div', 'sp-consulta-zona');
    caja.appendChild(zona);
    cont.appendChild(caja);

    render();

    function render() {
      vaciar(zona);
      var ya = miVoto(c.id);
      if (ya) { resultados(ya); return; }

      var ops = el('div', 'sp-consulta-ops');
      (c.opciones || []).forEach(function (o) {
        var b = el('button', 'sp-consulta-op'); b.type = 'button';
        b.style.setProperty('--oc', o.c);
        b.textContent = o.t;
        b.addEventListener('click', function () { votar(o.k, ops); });
        ops.appendChild(b);
      });
      zona.appendChild(ops);
    }

    function votar(k, ops) {
      Array.prototype.forEach.call(ops.children, function (n) { n.disabled = true; });
      guardarMiVoto(c.id, k);            // el voto local vale aunque falle la red
      consultaAPI({ action: 'consulta_voto', consulta: c.id, opcion: k, dispositivo: dispositivoId() })
        .then(function (out) { _consultaCache = (out && out.ok) ? out : null; })
        .catch(function () { _consultaCache = null; })
        .then(function () { render(); });
    }

    function resultados(ya) {
      var carga = el('p', 'sp-consulta-cargando', 'Contando votos…');
      zona.appendChild(carga);

      var pinta = function (conteo, total, error) {
        vaciar(zona);
        var lista = el('div', 'sp-consulta-res');
        (c.opciones || []).forEach(function (o) {
          var n = (conteo && conteo[o.k]) || 0;
          var pct = total ? (n / total * 100) : 0;
          var fila = el('div', 'sp-consulta-fila' + (ya === o.k ? ' tuyo' : ''));
          var cab = el('div', 'sp-consulta-cab');
          cab.appendChild(el('b', null, o.t + (ya === o.k ? ' · tu voto' : '')));
          cab.appendChild(el('span', null, total ? pct.toFixed(1).replace('.', ',') + '%' : '—'));
          fila.appendChild(cab);
          var riel = el('div', 'sp-consulta-riel');
          var barra = el('i');
          barra.style.width = pct.toFixed(1) + '%';
          barra.style.background = o.c;
          riel.appendChild(barra);
          fila.appendChild(riel);
          fila.appendChild(el('small', null, total ? (n + (n === 1 ? ' voto' : ' votos')) : 'sin datos'));
          lista.appendChild(fila);
        });
        zona.appendChild(lista);

        zona.appendChild(el('p', 'sp-consulta-total',
          error
            ? 'Tu voto quedó guardado en este dispositivo, pero aún no se pudo sincronizar el total.'
            : total + (total === 1 ? ' respuesta' : ' respuestas') + ' hasta ahora'));
      };

      consultaAPI({ action: 'consulta_resultados', consulta: c.id })
        .then(function (out) {
          if (out && out.ok && out.conteo) {
            var t = 0;
            Object.keys(out.conteo).forEach(function (k) { t += out.conteo[k] || 0; });
            pinta(out.conteo, t, false);
          } else {
            // Backend aún sin la acción: se muestra el voto propio, sin inventar
            // un total que no existe.
            var solo = {}; solo[ya] = 1;
            pinta(solo, 0, true);
          }
        })
        .catch(function () {
          var solo = {}; solo[ya] = 1;
          pinta(solo, 0, true);
        });
    }
  }

  function pintarIndicadores() {
    var ind = D.indicadores || {};
    var cont = vaciar($('sp-graficas'));

    // 1 · Las cuatro series temporales, en el mismo orden que la portada
    HERO_SERIES.forEach(function (k) {
      var d = ind[k];
      if (!d) return;
      // Comparación por fuente: no lleva cifra-resumen ni delta, porque el
      // gráfico entero ES la comparación.
      if (d.vista === 'porFuente') {
        if (!(d.grupos || []).length) return;
        cont.appendChild(tarjetaGrafica(d.titulo, d.unidad,
          grafSerie(d, false), d.leyenda, d.fuentes, null));
        return;
      }
      if (!(d.puntos || []).length) return;
      var pts = d.puntos;
      var ultimo = pts[pts.length - 1];
      var extra = null;
      if (pts.length >= 2) {
        var a = pts[0].v, z = ultimo.v, dif = z - a;
        extra = el('div', 'sp-cifra');
        extra.appendChild(el('b', null, valorSerie(z, d)));
        var sube = dif > 0;
        var clase = 'sp-delta-neutra';
        if (d.sentido === 'sube-bueno') clase = sube ? 'sp-delta-buena' : 'sp-delta-mala';
        else if (d.sentido === 'sube-malo') clase = sube ? 'sp-delta-mala' : 'sp-delta-buena';
        var txt = dif === 0 ? 'sin cambio'
          : (sube ? '▲ ' : '▼ ') + valorSerie(Math.abs(dif), d) +
            (a ? ' (' + Math.abs((dif / a) * 100).toFixed(1) + '%)' : '');
        extra.appendChild(el('span', 'sp-delta ' + clase, txt));
        extra.appendChild(el('span', 'sp-med-v', 'desde el ' + fechaCorta(pts[0].f)));
      }
      cont.appendChild(tarjetaGrafica(d.titulo, d.unidad,
        grafSerie(d, false), d.leyenda, d.fuentes, extra));
    });

    // 2 · Deuda
    if (ind.deuda) {
      cont.appendChild(tarjetaGrafica(ind.deuda.titulo, ind.deuda.unidad,
        grafDeuda(ind.deuda), ind.deuda.leyenda, ind.deuda.fuentes));
    }

    // 2b · Consulta propia, justo después de las encuestadoras para que se lea
    //      el contraste, pero con su propio marco y su advertencia.
    pintarConsulta(cont);

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
  // Lo primero de la portada: cuatro series con el mismo lenguaje visual.
  // El orden es deliberado — dólar y deuda son la plata, aprobación es el
  // respaldo político y bombardeos es la política de seguridad.
  var HERO_SERIES = ['dolar', 'deudaSerie', 'aprobacion', 'bombardeos'];

  function pintarHeroGrafica() {
    var cont = vaciar($('sp-hero-graf'));
    var ind = D.indicadores || {};
    var hay = HERO_SERIES.filter(function (k) {
      var d = ind[k];
      if (!d) return false;
      if (d.vista === 'porFuente') return (d.grupos || []).length > 0;
      return (d.puntos || []).length > 0;
    });
    if (!hay.length) return;

    cont.appendChild(el('h2', 'sp-hero-h', 'Cómo va el gobierno, en números'));
    var rejilla = el('div', 'sp-hero-grid');

    hay.forEach(function (k) {
      var d = ind[k];
      // En una comparación por fuente no hay "último punto": la cifra que
      // representa al indicador es la primera medida del primer grupo, que es
      // la que mide lo que dice el título (la gestión, no la elección).
      var pts, ultimo;
      if (d.vista === 'porFuente') {
        var m0 = ((d.grupos[0] || {}).medidas || [])[0] || {};
        pts = [];
        ultimo = { v: m0.v, f: m0.f, e: m0.n };
      } else {
        pts = d.puntos;
        ultimo = pts[pts.length - 1];
      }

      var b = el('button', 'sp-hero-graf'); b.type = 'button';
      b.style.setProperty('--c', d.color || '#0E86BC');

      var top = el('div', 'sp-hero-graf-top');
      top.appendChild(el('span', 'sp-hero-graf-t', d.titulo));

      // El delta solo aparece si hay de dónde calcularlo, y su color depende
      // de lo que signifique subir en ESA serie: más deuda no es lo mismo que
      // más aprobación. Donde subir no es ni bueno ni malo, va neutro.
      if (pts.length >= 2) {
        var a = pts[0].v, z = ultimo.v, dif = z - a;
        var sube = dif > 0;
        var clase = 'sp-delta-neutra';
        if (d.sentido === 'sube-bueno') clase = sube ? 'sp-delta-buena' : 'sp-delta-mala';
        else if (d.sentido === 'sube-malo') clase = sube ? 'sp-delta-mala' : 'sp-delta-buena';
        var txt = (sube ? '▲ ' : (dif < 0 ? '▼ ' : '')) +
          valorSerie(Math.abs(dif), d) + (a ? ' (' + Math.abs((dif / a) * 100).toFixed(1) + '%)' : '');
        top.appendChild(el('span', 'sp-delta ' + clase, dif === 0 ? 'sin cambio' : txt));
      }
      b.appendChild(top);

      var g = grafSerie(d, true);
      if (g) b.appendChild(g);

      b.appendChild(el('p', 'sp-hero-pie',
        valorSerie(ultimo.v, d) + ' · ' + fechaCorta(ultimo.f)));
      b.addEventListener('click', function () { ir({ v: 'indicadores' }); });
      rejilla.appendChild(b);
    });

    cont.appendChild(rejilla);
    cont.appendChild(el('p', 'sp-hero-nota',
      'Toca cualquiera para ver la gráfica completa, su fuente y qué la explica.'));
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
      // El anterior, después: nada de lo que se ve al abrir depende de él.
      fetch('assets/data/seguimiento-petro.json?v=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (a) {
          if (!a) return;
          DA = a;
          try { if (pestanaFicha !== 'ficha' || document.querySelector('.sp-cmp-tab')) pintarFicha(); } catch (e) {}
        })
        .catch(function () {});
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
