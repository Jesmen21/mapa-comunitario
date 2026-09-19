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
    // Capa 1, compacta: solo lo declarado. En el muro no cabe la explicación
    // y una etiqueta de ausencia por cada entrada sería ruido; lo que falta
    // se cuenta en la ficha, que es donde se puede leer entero.
    var cm = capaUnoDe(e);
    if (cm.prueba.declarado)   top.appendChild(tag(cm.prueba.cls,   cm.prueba.t,   cm.prueba.d));
    if (cm.medicion.declarado) top.appendChild(tag(cm.medicion.cls, cm.medicion.t, cm.medicion.d));
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
    d.appendChild(el('p', null, 'Pruebe con otro tema o elimina algún filtro.'));
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

    /* La Capa 1 va DEBAJO del sello de fuente y separada de él, porque son
       dos ejes distintos y pegarlos los volvería a confundir. Cada uno dice
       qué significa: una etiqueta que el lector no sabe leer no informa. */
    var c1 = capaUnoDe(e);
    var cj = el('div', 'sp-c1');
    cj.appendChild(el('h4', null, 'Qué clase de afirmación es'));

    var fp = el('div', 'sp-c1-f');
    if (c1.prueba.declarado) { fp.appendChild(tag(c1.prueba.cls, c1.prueba.t)); fp.appendChild(el('span', null, c1.prueba.d)); }
    else if (c1.prueba.desconocido) { fp.appendChild(tag('cp-mal', c1.prueba.id)); fp.appendChild(el('span', null, 'Ese valor no está en la tabla de categorías probatorias, así que no se puede leer.')); }
    else fp.appendChild(el('span', 'sp-c1-falta', 'Categoría probatoria sin declarar.'));
    cj.appendChild(fp);

    var fm = el('div', 'sp-c1-f');
    if (c1.medicion.declarado) { fm.appendChild(tag(c1.medicion.cls, c1.medicion.t)); fm.appendChild(el('span', null, c1.medicion.d)); }
    else if (c1.medicion.desconocido) { fm.appendChild(tag('cp-mal', c1.medicion.id)); fm.appendChild(el('span', null, 'Ese valor no es ni actividad ni resultado.')); }
    else fm.appendChild(el('span', 'sp-c1-falta', 'Sin declarar si mide actividad o resultado.'));
    cj.appendChild(fm);
    s.appendChild(cj);

    /* El contrargumento oficial va en su propio bloque y no dentro del
       contrapunto: uno es lo que contestó el Gobierno y el otro es la
       advertencia de URBIS. Y el estado «no respondió» se pinta, porque es
       un dato; el «sin revisar» también, porque es nuestra deuda y
       esconderla la volvería un señalamiento. */
    var co = el('div', 'sp-c1-co sp-c1-co-' + c1.contra.estado);
    co.appendChild(el('b', null, c1.contra.t));
    if (c1.contra.texto) co.appendChild(el('p', null, c1.contra.texto));
    co.appendChild(el('p', 'sp-h-meta', c1.contra.d));
    cc.appendChild(co);

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
      'NO es un porcentaje de injerencia extranjera. Ese dato no existe: nadie lo publica y no hay forma honesta de calcularlo. Si algún día ve una cifra así en cualquier lado, pregunte de dónde salió el denominador.',
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

  /* EL NIVEL DE GOBIERNO DE UN CASO.
     Regla del pliego presidencial, y de las que no se pueden deducir: una
     decisión municipal o departamental no entra al veredicto de un gobierno
     NACIONAL, por más que la pieza que la publica la presente como nacional.
     Un desalojo que ordena una alcaldía y un decreto que firma la Presidencia
     se ven igual en un titular y no son lo mismo.

     Se DECLARA en el registro, no se adivina del texto. Deducirlo de si el
     título nombra una ciudad sería exactamente el error contrario: en este
     mismo registro hay veinticinco hechos que nombran Medellín, Barranquilla
     o Cúcuta y son todos actos del Gobierno nacional ocurridos allá.

     Sin declarar, el caso SIGUE PESANDO como hasta hoy y la ficha cuenta
     cuántos están así. No se le pone «nacional» por omisión: un valor por
     omisión es una afirmación que nadie escribió, y acá afirmaría de quién es
     una decisión. Lo que impide que esa rama la alcance un caso que pesa es
     `revisar.js`, que exige el nivel a todo caso confirmado o en investigación
     —la misma guarda que ya les exige quién, fecha y fuentes—.

     Un nivel escrito con un valor que no está en la tabla NO pesa, y la ficha
     dice el valor literal: un «Municipal» con mayúscula que pesara en silencio
     es peor que uno que se ve en rojo en la tarjeta. */
  var NIVELES = {
    'nacional':      { t: 'Nacional',      pesa: true },
    'departamental': { t: 'Departamental', pesa: false },
    'distrital':     { t: 'Distrital',     pesa: false },
    'municipal':     { t: 'Municipal',     pesa: false }
  };

  function nivelDeCaso(c) {
    var id = String((c && c.nivelGobierno) || '').trim();
    if (!id) return { id: '', t: 'sin declarar', pesa: true, declarado: false };
    var n = NIVELES[id];
    if (!n) return { id: id, t: id, pesa: false, declarado: false, desconocido: true };
    return { id: id, t: n.t, pesa: n.pesa, declarado: true };
  }

  /* La puerta, una sola, y devuelve un OBJETO con su razón — nunca un
     booleano—: «no pesa porque es municipal» y «no pesa porque su nivel está
     mal escrito» piden cosas distintas a quien lee la ficha, y un false las
     juntaría en una. Es la regla que la v876 escribió para `censoCiudad`. */
  function entraAlVeredicto(c) {
    var n = nivelDeCaso(c);
    if (n.desconocido) return { entra: false, razon: 'nivel-desconocido', nivel: n };
    if (!n.pesa)       return { entra: false, razon: 'otro-nivel',        nivel: n };
    return { entra: true, razon: '', nivel: n };
  }

  /* ═══ CAPA 1 DEL PLIEGO PRESIDENCIAL ═══════════════════════════════════
     Tres campos por registro que el pliego marca obligatorios, y que el
     módulo no tenía. Van juntos porque contestan tres preguntas distintas
     sobre la MISMA afirmación, y la trampa de todos ellos es la misma:
     parecerse a un campo que ya existe.

     LA REGLA DE ORO DEL PLIEGO: ninguna capa escribe en la capa anterior.
     Así que NINGUNO DE LOS TRES mueve el veredicto. La escalera de
     fiabilidad sigue saliendo de lo mismo que salía —casos, contradicciones
     y registro verificado— y estos tres se publican al lado. Un campo nuevo
     que cambiara en silencio el juicio público sobre una persona real es
     exactamente lo que el pliego prohíbe, y hay una aserción dedicada a que
     no pase.

     · CATEGORÍA PROBATORIA — qué CLASE de afirmación es (principio 4).
       NO es `tipoFuente`, y confundirlos es el error que el pliego nombra
       con todas las letras: `tipoFuente` mide la calidad de la FUENTE —quién
       lo cuenta y si está corroborado—; la categoría probatoria mide la
       naturaleza de la AFIRMACIÓN —si hay documento, si son dos hechos que
       coinciden, o si alguien está afirmando que uno causó el otro—. Son dos
       ejes y meterlos en uno deja el módulo sin servir para ninguna de las
       dos preguntas. Un medio impecable puede publicar una atribución
       causal, y un medio militante puede publicar un documento auténtico.

       Y TAMPOCO se deriva del `estado` de un caso de corrupción, que es lo
       primero que se le ocurre a cualquiera porque hoy coincidirían casi
       siempre. La pregunta que separa las dos cosas es la de siempre:
       ¿existe un cambio razonable que deba mover una y no la otra? Sí — un
       caso puede estar `en-investigacion`, que es un estado PROCESAL, y que
       lo que se le imputa sea una atribución causal que nadie ha probado.
       Derivarlas las ataría el día que se separen.

     · TIPO DE MEDICIÓN — actividad o resultado (principio 5). «Cuatro
       operativos en un día» y «la criminalidad bajó» hoy entran al registro
       como la misma clase de cosa. No lo son, y no se suman nunca: uno mide
       lo que el Gobierno HIZO y el otro lo que CAMBIÓ. Un resultado sin
       línea base y sin fecha de corte es descriptivo, no evaluativo, y eso
       se dice al lado de la etiqueta.

     · CONTRARGUMENTO OFICIAL — qué contestó el Gobierno (principio 12).
       El pliego lo declara obligatorio y dice por qué: un campo vacío es un
       dato. Significa que el Gobierno no respondió, no que no hubiera
       respuesta. Por eso son TRES estados y no dos, que es la distinción de
       la v899 entre «sin dato» y «panel fuera»:
         · un texto      → el Gobierno respondió, y esto fue lo que dijo;
         · `ausente`     → se buscó y no respondió. Es un DATO, y alimenta el
                           indicador I-06 del pliego;
         · sin declarar  → nadie lo ha revisado todavía. NO es un dato: es
                           trabajo pendiente, y se cuenta aparte.
       Juntar los dos últimos convertiría nuestra propia deuda en un
       señalamiento contra el Gobierno.

       OJO CON EL HOMÓNIMO: `contrapunto` ya existe en 114 entradas y es OTRA
       COSA — es la advertencia metodológica de URBIS sobre la propia
       entrada, no la respuesta del Gobierno. Usar ese campo para esto sería
       la colisión de nombres que este proyecto persigue desde la v885.

     En los tres, SIN DECLARAR no cambia nada de lo que el módulo hacía
     hasta hoy, y la ficha cuenta cuántos están así. Un valor por omisión
     sería una afirmación que nadie escribió. Y un valor escrito con una
     grafía que la tabla no conoce se ve —con el literal impreso— en vez de
     pasar por bueno en silencio: es la decisión de la v941 con el nivel de
     gobierno. */
  var CATEGORIA_PROBATORIA = {
    'hecho-probado': {
      t: 'Hecho probado', cls: 'cp-hp',
      d: 'Hay documento, acto administrativo o dato oficial que lo sostiene.' },
    'correlacion': {
      t: 'Correlación', cls: 'cp-co',
      d: 'Dos hechos coinciden en tiempo o en espacio. Que coincidan no dice que uno causara el otro.' },
    'atribucion-causal': {
      t: 'Atribución causal', cls: 'cp-ac',
      d: 'Alguien afirma que un hecho causó el otro. Lo que consta es la afirmación, no la causa.' },
    'en-circulacion': {
      t: 'Afirmación en circulación', cls: 'cp-ec',
      d: 'Circula sin documento que la sostenga. Se registra porque circula, no porque esté probada.' }
  };

  var TIPO_MEDICION = {
    'actividad': {
      t: 'Actividad', cls: 'tm-act',
      d: 'Lo que el Gobierno hizo: decretos firmados, operativos, anuncios, nombramientos.' },
    'resultado': {
      t: 'Resultado', cls: 'tm-res',
      d: 'Lo que cambió en el país. Sin línea base y fecha de corte es descriptivo, no evaluativo. ' +
         'Que una cifra se mida no dice quién la causó: eso lo separa la categoría probatoria.' },
    /* EL TERCER VALOR, QUE EL PLIEGO NO TRAE, Y POR QUÉ HACE FALTA.
       El pliego ofrece dos —actividad y resultado— y son los que alimentan
       los indicadores I-09 e I-10. Pero una parte grande de este registro no
       es ninguna de las dos: un juzgado que tumba un decreto, la JEP, Human
       Rights Watch, un expresidente que responde, un aliado extranjero que
       anuncia algo. Ahí el sujeto no es el Gobierno nacional y no hay una
       magnitud medida del país.

       Con solo dos valores, esas entradas tendrían que entrar forzadas en
       una de las dos o quedarse sin declarar. Lo primero contamina
       exactamente los dos indicadores que el principio 5 existe para no
       mezclar; lo segundo las confunde con las que nadie ha revisado, que es
       la misma conflación que el contrargumento evita con sus tres estados.
       Así que se nombra: no aplica, y se dice por qué. */
    /* EL NOMBRE, CORREGIDO EN LA v961. Se llamaba `no-aplica`, que dice lo
       que NO es. El motor de referencia lo nombra por lo que ES —contexto
       estructural— y tiene razón por la misma regla con la que este proyecto
       renombró «Continuidad del tejido» en la v879: un rótulo que solo niega
       deja que el lector suponga qué hay debajo. El hecho existe, está
       fechado y es del país; lo que no es, es una cuenta del Gobierno. */
    'contexto-estructural': {
      t: 'Contexto estructural', cls: 'tm-na',
      d: 'El sujeto no es el Gobierno nacional —un juez, un órgano de control, un tercero— o no hay una ' +
         'magnitud medida del país. Es el terreno sobre el que se gobierna, y por eso no alimenta ni el ' +
         'conteo de actividad ni el de resultados: sumarlo a cualquiera de los dos los falsearía.' }
  };

  /* Las tres puertas devuelven un OBJETO con su razón y nunca un booleano:
     «sin declarar» y «escrito con un valor que no conozco» piden cosas
     distintas a quien mantiene el registro. Es la regla de la v876. */
  function claseDe(tabla, valor) {
    var id = String(valor || '').trim();
    if (!id) return { id: '', t: 'sin declarar', declarado: false, desconocido: false };
    var x = tabla[id];
    if (!x) return { id: id, t: id, declarado: false, desconocido: true };
    return { id: id, t: x.t, cls: x.cls, d: x.d, declarado: true };
  }

  function categoriaProbatoriaDe(e) { return claseDe(CATEGORIA_PROBATORIA, e && e.categoriaProbatoria); }
  function tipoMedicionDe(e)        { return claseDe(TIPO_MEDICION,        e && e.tipoMedicion); }

  /* ── LOS DOS CAMPOS QUE LOS CRITERIOS NECESITAN (v961) ──────────────────
     El motor de referencia los pide, y la razón se ve al escribir los
     criterios de la Capa 2: sin ellos, «este hecho cuenta como mecanismo
     excepcional» vuelve a ser una opinión. Con ellos, la condición se puede
     escribir y cualquiera la rehace.

     Y son de otra clase que los tres de la v957. Aquellos son lecturas sobre
     la AFIRMACIÓN; estos dos se leen de la propia entrada sin juzgar al
     Gobierno: un decreto es un documento primario, un «anuncia» sin acto es
     un anuncio sin acto. Por eso se pueden declarar leyendo el registro, que
     es justamente lo que la categoría probatoria y el indicador no permiten.

     NO SE EXIGEN EN TODAS LAS ENTRADAS, y eso es deliberado: solo las que
     declaran un indicador pasan por el gate, así que solo esas los
     necesitan. Pedírselos a las 200 sería un trinquete que nadie puede
     bajar y que no protege nada. */
  var ESTADO_PROCESAL = {
    'en-firme': { t: 'En firme', cls: 'ep-fi',
      d: 'El acto está expedido y produce efectos.' },
    'en-tramite-legislativo': { t: 'En trámite legislativo', cls: 'ep-tl',
      d: 'Radicado en el Congreso. Todavía no es norma.' },
    'en-revision-judicial': { t: 'En revisión judicial', cls: 'ep-rj',
      d: 'Un juez o una corte lo está examinando. Puede caerse.' },
    'en-disputa-institucional': { t: 'En disputa institucional', cls: 'ep-di',
      d: 'Otro órgano del Estado se pronunció en contra con un acto suyo.' },
    'anunciado-sin-acto': { t: 'Anunciado, sin acto', cls: 'ep-an',
      d: 'Se anunció y no consta el acto administrativo. Un anuncio no es una medida.' }
  };

  var TIPO_EVIDENCIA = {
    /* LA REGLA, ESCRITA, porque sin ella este campo se vuelve una opinión:
       es documento primario cuando el acto está IDENTIFICADO por su número o
       su radicado —«Decreto 1384 de 2026»—, aunque la copia haya llegado por
       prensa; y es reporte periodístico cuando el hecho solo consta en el
       relato del medio. Que el enlace al documento falte es otra cosa y la
       vigila el control de calidad por su cuenta. */
    'documento-primario': { t: 'Documento primario', cls: 'te-dp',
      d: 'El decreto, la resolución, el fallo o el acta, identificados por su número o radicado. ' +
         'No necesita respaldo de medios.' },
    'dato-oficial': { t: 'Dato oficial', cls: 'te-do',
      d: 'Una cifra publicada por la entidad que la produce.' },
    'reporte-periodistico': { t: 'Reporte periodístico', cls: 'te-rp',
      d: 'Lo cuenta un medio. Sirve para saber qué pasó; no es el documento.' },
    'testimonio': { t: 'Testimonio', cls: 'te-ts',
      d: 'Lo dice alguien. Lo que consta es que lo dijo.' },
    'captura-de-pantalla': { t: 'Captura de pantalla', cls: 'te-cp',
      d: 'La forma más débil: se puede fabricar, y no prueba el hecho sino la existencia de la imagen.' }
  };

  function estadoProcesalDe(e) { return claseDe(ESTADO_PROCESAL, e && e.estadoProcesal); }
  function tipoEvidenciaDe(e)  { return claseDe(TIPO_EVIDENCIA,  e && e.tipoEvidencia); }

  /* El contrargumento no es una tabla de valores: es un texto, o la palabra
     `ausente`, o nada. Los tres estados van con nombre porque los tres piden
     una acción distinta. */
  function contrargumentoDe(e) {
    var v = (e && e.contrargumentoOficial);
    if (v === undefined || v === null || String(v).trim() === '') {
      return { estado: 'sin-revisar', t: 'Sin revisar', texto: '', esDato: false,
               d: 'Todavía nadie revisó si el Gobierno respondió. No es que no haya respondido: es que no lo hemos mirado.' };
    }
    /* LA CONSTANCIA DE BÚSQUEDA (v961). El motor de referencia la exige y la
       razón es la misma por la que este campo tiene tres estados y no dos:
       `ausente` AFIRMA que el Gobierno no respondió, y una afirmación sobre
       una persona real necesita algo detrás. Sin decir dónde se buscó y
       cuándo, «ausente» y «no lo miré» se escriben igual de fácil y se leen
       igual de mal — y el primero pesa en el indicador I-06.

       Así que son CUATRO estados y el cuarto es la guarda: un `ausente` a
       secas se ve, con su literal impreso, y NO pesa. No se tira ni se
       asciende, que es la decisión de la v931 con la fecha sin distinguir. */
    if (v && typeof v === 'object' && v.ausente) {
      var fu = (v.busco || []).filter(function (x) { return String(x || '').trim(); });
      if (fu.length && String(v.fecha || '').trim()) {
        return { estado: 'ausente', t: 'El Gobierno no respondió', texto: '', esDato: true,
                 busco: fu, fecha: String(v.fecha).trim(),
                 d: 'Se buscó una respuesta oficial en ' + fu.join(', ') + ' el ' + String(v.fecha).trim() +
                    ', y no la hay. Eso es un dato sobre el Gobierno, no un vacío del registro.' };
      }
      return { estado: 'ausente-sin-constancia', t: 'Ausente, sin constancia de búsqueda', texto: '',
               esDato: false, busco: fu,
               d: 'Dice que el Gobierno no respondió y no dice dónde se buscó ni cuándo. Afirmar un silencio ' +
                  'sin constancia es un señalamiento sin respaldo, así que se ve y no pesa en el indicador.' };
    }
    var s = String(v).trim();
    if (s.toLowerCase() === 'ausente') {
      return { estado: 'ausente-sin-constancia', t: 'Ausente, sin constancia de búsqueda', texto: '',
               esDato: false, busco: [],
               d: 'Escrito como la palabra suelta «ausente», sin dónde se buscó ni cuándo. Se escribe ' +
                  '{ ausente: true, busco: [...], fecha: "AAAA-MM-DD" } para que cuente.' };
    }
    return { estado: 'respondio', t: 'Respuesta oficial', texto: s, esDato: true,
             d: 'Lo que el Gobierno contestó sobre este hecho.' };
  }

  function capaUnoDe(e) {
    return { prueba: categoriaProbatoriaDe(e), medicion: tipoMedicionDe(e), contra: contrargumentoDe(e),
             procesal: estadoProcesalDe(e), evidencia: tipoEvidenciaDe(e) };
  }

  /* El recuento de la Capa 1 sobre un conjunto de entradas. No decide nada:
     cuenta. Lo que hace con él la ficha es publicarlo al lado del veredicto
     y nombrar lo que falta — que es lo que el pliego pide en su control de
     calidad: si un casillero falla, se publica CON la marca de la falla
     visible, no se publica sin ella. */
  function capaUnoDe_conjunto(lista) {
    var r = { n: (lista || []).length,
              prueba: { declarados: 0, sinDeclarar: 0, desconocidos: 0, por: {} },
              medicion: { actividad: 0, resultado: 0, 'contexto-estructural': 0, sinDeclarar: 0, desconocidos: 0 },
              contra: { respondio: 0, ausente: 0, sinConstancia: 0, sinRevisar: 0 } };
    (lista || []).forEach(function (e) {
      var c = capaUnoDe(e);
      if (c.prueba.declarado) { r.prueba.declarados++; r.prueba.por[c.prueba.id] = (r.prueba.por[c.prueba.id] || 0) + 1; }
      else if (c.prueba.desconocido) r.prueba.desconocidos++;
      else r.prueba.sinDeclarar++;
      if (c.medicion.declarado) r.medicion[c.medicion.id]++;
      else if (c.medicion.desconocido) r.medicion.desconocidos++;
      else r.medicion.sinDeclarar++;
      if (c.contra.estado === 'respondio') r.contra.respondio++;
      else if (c.contra.estado === 'ausente') r.contra.ausente++;
      else if (c.contra.estado === 'ausente-sin-constancia') r.contra.sinConstancia++;
      else r.contra.sinRevisar++;
    });
    return r;
  }

  /* ═══ CAPA 2 DEL PLIEGO PRESIDENCIAL · LOS INDICADORES ════════════════
     «Solo cuentas. No interpretas.» Cada indicador tiene que poder
     calcularse igual para cualquier gobierno nacional de Colombia con datos
     públicos — es el principio 1, la simetría.

     LA NORMALIZACIÓN ES OBLIGATORIA y el pliego dice por qué: «sin esto,
     comparar un mes contra cuatro años reproduce exactamente el error de
     períodos desiguales que este módulo existe para detectar». Así que todo
     sale por 100 días de gobierno, y el crudo va al lado — la tasa sin el
     conteo es tan ciega como el conteo sin la tasa.

     TRES DE LOS SIETE SE DECLARAN Y NO SE DEDUCEN. Los mecanismos
     excepcionales, los choques con órganos autónomos y la información
     obtenida por tutela no salen del texto de una entrada: decidir que un
     hecho es «un choque con un órgano autónomo» es una lectura, y deducirla
     de que el título nombre al DANE metería en la cuenta la entrada de la
     inflación, que cita al DANE como FUENTE. Van declarados en el registro,
     como el nivel de gobierno de la v941, y lo que no está declarado no
     cuenta y se dice cuántos hay así.

     DOS SALEN DE LA CAPA 1 y por eso aquella iba primero: la actividad
     reportada y los resultados verificados son `tipoMedicion`, y el
     principio 5 manda que no se sumen nunca. Acá van en renglones distintos
     y no hay ninguna línea que los junte. */
  /* ═══ LOS CRITERIOS, COMO DATOS (v961) ═════════════════════════════════
     «Los criterios van como DATOS, no como decisión caso por caso. Si un
     registro no encaja en ninguno, no se fuerza: queda sin declarar y se
     revisa el criterio.»

     Esto es lo que separa un conteo de un juicio. Hasta la v960 los tres
     indicadores declarables se declaraban a mano, entrada por entrada, y eso
     dejaba el módulo en la peor posición posible: una cifra sobre un
     gobierno real cuyo criterio no estaba escrito en ninguna parte. Con la
     definición, el `incluye` y el `excluye` a la vista, cualquiera rehace la
     clasificación y discute el criterio en vez de discutir el caso.

     Y se cobró en el acto. Aplicados a las siete entradas que ya declaraban
     indicador, los criterios RECHAZAN tres declaraciones que yo había hecho
     caso por caso —dos de ellas de la misma entrada—. El detalle está en la
     bitácora; lo que importa acá es la forma: el criterio escrito salió más
     estricto que mi lectura, y esa es exactamente la razón de escribirlo.

     ── DOS COSAS SE SEPARAN, Y NO SON LA MISMA ──
     `excluye` dice QUÉ NO ES de esta clase: si un hecho cae ahí, la
     declaración está mal y se quita del registro.
     `requiere` dice QUÉ PRUEBA HACE FALTA para contarlo: el hecho sí es de
     esta clase y le falta el papel. Ahí la declaración se queda y el
     indicador NO lo cuenta, diciendo qué falta.
     Juntarlos borraría la diferencia entre «esto no va acá» y «esto va acá y
     todavía no se puede sostener».

     ── LA DESVIACIÓN DEL MOTOR DE REFERENCIA, DECLARADA ──
     El motor filtra en silencio: `declara(r, id) && requiere(r)`. Acá no. Un
     hecho que declara un indicador y no pasa el gate se CUENTA APARTE y la
     ficha dice cuántos son y por qué — es la distinción de la v899 entre
     «sin dato» y «panel fuera», y la razón es la misma: un conteo que baja
     sin decir por qué se lee como que el hecho no existió. */

  /* LISTA CERRADA, y se consulta en vez de decidirse de memoria. La v961
     descubrió por qué hace falta: yo había metido al DANE entre los órganos
     autónomos en la descripción de I-05, y no lo es.

     El DANE es un departamento administrativo del Ejecutivo, con director de
     libre nombramiento del presidente; su independencia es TÉCNICA (Ley 2335),
     no constitucional. Un acto del Ejecutivo sobre él no es un choque entre
     poderes — es otra cosa, y esa otra cosa es I-13. */
  var ORGANOS_AUTONOMOS = [
    'Banco de la República',
    'Comisión Nacional del Servicio Civil (CNSC)',
    'Corte Constitucional',
    'Consejo de Estado',
    'Corte Suprema de Justicia',
    'Consejo Superior de la Judicatura',
    'Jurisdicción Especial para la Paz (JEP)',
    'Procuraduría General de la Nación',
    'Defensoría del Pueblo',
    'Contraloría General de la República',
    'Registraduría Nacional del Estado Civil',
    'Consejo Nacional Electoral (CNE)',
    'Entes universitarios autónomos (art. 69)'
  ];

  var EVIDENCIA_DURA = { 'documento-primario': 1, 'dato-oficial': 1 };

  var CRITERIOS = {
    'I-04': {
      definicion: 'Acto del Ejecutivo que se aparta del régimen ordinario invocando una facultad ' +
                  'extraordinaria, de emergencia o de excepción.',
      incluye: [
        'declaratoria de emergencia (económica, social, ecológica o conmoción interior)',
        /* Añadido al criterio del motor de referencia, con su razón: la
           declaratoria de desastre nacional de la Ley 1523 también aparta al
           Ejecutivo del régimen ordinario de contratación y de gasto, y el
           registro trae una. Un criterio es un dato, así que ampliarlo se ve
           en el diff en vez de resolverse a mano en una entrada. */
        'declaratoria de desastre nacional (Ley 1523)',
        'decreto expedido al amparo de una declaratoria de emergencia',
        'aplazamiento por acto administrativo de un plazo fijado en ley o reglamento',
        'directiva que altera el régimen ordinario de difusión de información pública',
        'autorización de plantas temporales por fuera del régimen de carrera',
        'plazo extraordinario por única vez sobre recursos de destinación específica'
      ],
      excluye: [
        'proyecto de ley ordinaria (es el cauce normal, no una excepción)',
        'nombramiento o retiro de un cargo de libre nombramiento y remoción (es el régimen ordinario)',
        'anuncio sin acto administrativo expedido',
        'acto de un gobierno anterior',
        'decisión de nivel municipal, distrital o departamental'
      ],
      requiere: function (c) {
        return c.procesal.id !== 'anunciado-sin-acto' && !!EVIDENCIA_DURA[c.evidencia.id];
      },
      falta: 'Pide un acto expedido y un documento primario o un dato oficial: un anuncio no es una medida.'
    },
    'I-05': {
      definicion: 'Diferencia entre el Ejecutivo y un órgano de autonomía constitucional que se ' +
                  'materializó en un acto institucional de cualquiera de los dos, no en declaraciones.',
      incluye: [
        'el órgano declara formalmente que un acto del Ejecutivo afecta su autonomía o competencia',
        'el órgano mantiene una decisión contraria a lo solicitado por el Ejecutivo',
        'una decisión judicial resuelve en contra del Ejecutivo en la controversia'
      ],
      excluye: [
        'crítica política de funcionarios o congresistas',
        'desacuerdo expresado sin acto institucional',
        'anuncio del Ejecutivo que el órgano aún no ha respondido',
        'tensión reportada solo por prensa, sin documento de ninguna de las partes',
        /* Escrito por un caso real: la CNSC expidió las Resoluciones 10537 y
           10543 de 2026 «en ejercicio de la autonomía del art. 130 Y DE
           CONFORMIDAD CON el Decreto 1384». De conformidad con, no en contra:
           es discrecionalidad que el propio decreto le otorgó. Un órgano que
           usa una facultad que el acto del Ejecutivo le reconoce no está
           chocando con él, y contarlo sería fabricar un choque. */
        'el órgano ejerce una facultad que el propio acto del Ejecutivo le reconoce',
        /* Y el otro: las entidades del Ejecutivo con independencia solo
           técnica —el DANE, las agencias reguladoras— no son órganos del
           art. 113. Esos casos tienen su propio indicador, I-13, para que no
           se pierdan por no caber acá. */
        'entidades del Ejecutivo con independencia solo técnica (van a I-13)'
      ],
      requiere: function (c) {
        return (c.procesal.id === 'en-disputa-institucional' || c.procesal.id === 'en-revision-judicial' ||
                c.procesal.id === 'en-firme') && c.evidencia.id !== 'captura-de-pantalla';
      },
      falta: 'Pide un acto institucional de una de las dos partes, y no una captura de pantalla.'
    },
    /* I-13 NO está en el pliego original: nace de que el caso del DANE no
       cabía en I-05 y perderlo sería perder un hecho real. Es la decisión de
       la v875 —no se arregla una exageración con un silencio— aplicada a un
       indicador: antes que forzar el caso en un indicador que no es el suyo o
       tirarlo, se nombra lo que es.

       CUENTA UNA COINCIDENCIA, NO UNA CAUSA, y eso va en la definición porque
       es lo que separa este indicador de un señalamiento: que una remoción
       coincida con una controversia sobre difusión es comprobable; que la
       haya CAUSADO es una atribución que el registro no sostiene. */
    'I-13': {
      definicion: 'Acto del Ejecutivo sobre una entidad que NO es autónoma constitucionalmente pero ' +
                  'tiene independencia técnica reconocida por ley —el DANE, las agencias técnicas o ' +
                  'reguladoras—. Cuenta la coincidencia documentada, no una causa probada.',
      incluye: [
        'instrucción sobre contenido, oportunidad o forma de difusión de información técnica',
        'remoción o bloqueo de nombramientos coincidente con una controversia sobre difusión'
      ],
      excluye: [
        'nombramiento o remoción ordinarios sin controversia documentada',
        'instrucción administrativa sin relación con el producto técnico',
        'entidades que SÍ son autónomas constitucionalmente (van a I-05)'
      ],
      requiere: function (c) { return !!EVIDENCIA_DURA[c.evidencia.id]; },
      falta: 'Pide el acto: un documento primario o un dato oficial, no el relato de un medio.'
    },
    'I-07': {
      definicion: 'Información pública solicitada por el cauce ordinario, no entregada en el término ' +
                  'legal, y entregada únicamente tras fallo o presentación de tutela.',
      incluye: ['derecho de petición vencido sin respuesta y documento entregado tras tutela'],
      excluye: [
        'información entregada dentro del término, aunque tarde',
        'información obtenida por filtración o por vía periodística',
        'solicitud aún dentro del término legal'
      ],
      requiere: function (c) { return c.evidencia.id === 'documento-primario'; },
      falta: 'Pide el documento que se entregó: sin él no consta que la tutela lo destrabara.'
    }
  };

  /* La puerta. Devuelve un objeto con su razón —nunca un booleano— porque
     «cuenta», «le faltan los campos para comprobarlo» y «los tiene y no
     cumple» son tres cosas que piden tres acciones distintas a quien
     mantiene el registro. Es la regla de la v876. */
  /* LA VÍA (v963). Un criterio con seis renglones de `incluye` deja sin decir
     POR CUÁL de los seis entra cada hecho, y eso es justo lo que hay que
     poder auditar: la v962 escribió en la bitácora que el caso del DANE
     entraba por dos vías y una de las dos era falsa —la remoción de Urdinola
     era anterior a la controversia y ordinaria—. Nadie lo habría visto,
     porque la declaración era solo `['I-13']`.

     Así que la vía se declara en la entrada y se comprueba contra el texto
     EXACTO del `incluye`. Citar por número sería la trampa de la v878 —el id
     que se separa de su título—: reordenar la lista repuntaría todas las
     citas en silencio. Con el texto, reescribir un renglón del criterio
     rompe las entradas que lo citan, que es lo correcto: hay que volver a
     mirarlas. */
  function viaDeclarada(e, id) {
    var m = (e && e.indicadoresPor) || {};
    var v = m[id];
    if (v && typeof v === 'object') return String(v.via || '').trim();
    return String(v || '').trim();
  }

  /* ── EN QUÉ ENTRADA DEL REGISTRO ESTÁ EL ACTO (v964) ──────────────────────
     La v963 hizo que cada declaración dijera por cuál renglón del criterio
     entra. Faltaba la otra mitad, y es la que se cobró: la única vía sólida
     de I-13 era la Directiva Presidencial 01 del 3 de septiembre, y ese acto
     NO estaba en el registro —vivía en el `contrapunto` de otra entrada—.

     Un indicador no puede contar lo que no está en el registro, aunque el
     hecho sea cierto: la cifra publicada tiene que poder abrirse y leerse.
     Así que la declaración nombra la ENTRADA que guarda el acto, y se
     comprueba que exista.

     La base es OBLIGATORIA, incluso cuando el acto es el de la propia
     entrada —ahí se nombra a sí misma—. Con la base opcional, el caso que
     esto vino a cazar habría pasado igual: su autor simplemente la habría
     omitido. Es el canje de la v880: entre fallar abierto y fallar cerrado,
     se falla cerrado.

     Una declaración de la v963 —cuyo valor es la vía a secas— queda por
     tanto SIN BASE, que es exactamente lo que era. No se asciende a lo que
     nadie escribió (v931). */
  function baseDeclarada(e, id) {
    var m = (e && e.indicadoresPor) || {};
    var v = m[id];
    return (v && typeof v === 'object') ? String(v.base || '').trim() : '';
  }

  function idsDelRegistro(dd) {
    var s = {};
    ((((dd || D) || {}).entradas) || []).forEach(function (e) { if (e && e.id) s[e.id] = true; });
    return s;
  }

  function pasaElCriterio(e, id, ids) {
    var cr = CRITERIOS[id];
    if (!cr) return { cuenta: false, motivo: 'sin-criterio', d: 'No hay criterio escrito para ' + id + '.' };
    var c = capaUnoDe(e);
    var via = viaDeclarada(e, id);
    if (!via) return { cuenta: false, motivo: 'sin-via', campo: 'indicadoresPor',
                       d: 'Declara ' + id + ' y no dice por cuál renglón del criterio entra.' };
    if (cr.incluye.indexOf(via) < 0) {
      return { cuenta: false, motivo: 'via-desconocida', via: via,
               d: 'Cita una vía que el criterio de ' + id + ' no tiene: «' + via + '».' };
    }
    /* La base, y sus dos maneras de faltar. Es UN estado —el acto no está en
       el registro— dicho con dos causas distintas, porque para quien escribe
       son dos tareas: poner el campo, o entrar el hecho. */
    var base = baseDeclarada(e, id);
    if (!base) {
      return { cuenta: false, motivo: 'sin-base-registrada', campo: 'indicadoresPor.base', via: via,
               d: 'Declara ' + id + ' y no dice en qué entrada del registro está el acto que cuenta.' };
    }
    if (!ids || !ids[base]) {
      return { cuenta: false, motivo: 'sin-base-registrada', via: via, base: base,
               d: 'El acto que cuenta no está en el registro: nombra la entrada «' + base + '» y ninguna ' +
                  'la tiene. Mientras el hecho no esté registrado con sus fuentes, la cifra no se puede abrir.' };
    }
    /* El nivel: el pliego prohíbe que un hecho subnacional alimente el score
       presidencial, y sin declararlo no se puede saber. Solo se les exige a
       las entradas que declaran indicador — pedírselo a las 200 sería un
       trinquete que no protege nada. */
    var nv = String((e && e.nivelGobierno) || '').trim();
    if (!nv) return { cuenta: false, motivo: 'sin-insumos', campo: 'nivelGobierno',
                      d: 'Declara ' + id + ' y no dice de qué nivel de gobierno es la decisión.' };
    if (nv !== 'nacional') return { cuenta: false, motivo: 'otro-nivel',
                                    d: 'Es una decisión ' + nv + ': no alimenta el score presidencial.' };
    if (!c.procesal.declarado) return { cuenta: false, motivo: 'sin-insumos', campo: 'estadoProcesal',
                                        d: 'Declara ' + id + ' y no dice en qué estado procesal está el acto.' };
    if (!c.evidencia.declarado) return { cuenta: false, motivo: 'sin-insumos', campo: 'tipoEvidencia',
                                         d: 'Declara ' + id + ' y no dice qué clase de evidencia lo sostiene.' };
    if (!cr.requiere(c)) return { cuenta: false, motivo: 'no-cumple', via: via, d: cr.falta };
    return { cuenta: true, motivo: '', d: '', via: via };
  }

  /* ── DE DÓNDE SALE LA CATEGORÍA QUE CUENTA UN INDICADOR (v965) ───────────
     La v964 marcó como no validado solo a I-13, razonando que ponerle la
     marca a los siete la dejaría sin significar nada. El razonamiento era
     malo por el otro lado y el usuario lo corrigió: los criterios de I-04,
     I-05 e I-07 también se escribieron LEYENDO ESTE REGISTRO, así que
     tampoco están validados, y marcar solo a I-13 sugiere que los otros sí.

     Lo que salva la marca de morir por repetida no es ponérsela a uno: es
     que las dos no digan lo mismo. La gravedad es distinta y va en su propio
     campo:

     · `juridica-preexistente` — la categoría existe sin este proyecto: un
       decreto de emergencia, el artículo 113, una tutela. Lo que se dibujó
       mirando el registro son sus BORDES, qué entra y qué no.
     · `construida-para-el-caso` — acá se inventó la categoría misma. Es la
       que más urge contrastar.

     Sin declarar se toma por la GRAVE, que es la lectura desconfiada: un
     criterio nuevo nace marcado como construido para su caso. */
  var ORIGEN_CATEGORIA = {
    'juridica-preexistente': {
      t: 'categoría jurídica preexistente',
      d: 'La categoría existe sin este proyecto —un decreto de emergencia, el artículo 113, una tutela—. ' +
         'Lo que se dibujó mirando este registro son sus BORDES: qué entra en la cuenta y qué no.' },
    'construida-para-el-caso': {
      t: 'categoría construida para el caso',
      d: 'Acá se inventó la categoría misma, después de ver el caso que necesitaba capturar. Es la que más ' +
         'urge contrastar: puede estar tallada a la medida de ese caso.' }
  };

  var INDICADORES = {
    /* `origenCategoria` dice de dónde sale la categoría que el indicador
       cuenta, y con ella la GRAVEDAD de que su criterio no esté contrastado.
       Los tres del pliego son categorías que existen en derecho; I-13 no.
       Sin declarar se toma por la grave (ver ORIGEN_CATEGORIA). */
    'I-04': { t: 'Mecanismos excepcionales usados', dec: true, origenCategoria: 'juridica-preexistente',
              d: 'Emergencias, decretos de conmoción, aplazamientos de plazos legales y directivas que alteran la difusión de información pública.' },
    /* El DANE estaba en esta lista y NO es un órgano de autonomía
       constitucional: es un departamento administrativo del propio
       Ejecutivo, así que un choque con él no es un choque entre poderes.
       Lo destapó escribir el criterio. */
    'I-05': { t: 'Choques con órganos autónomos', dec: true, origenCategoria: 'juridica-preexistente',
              d: 'Corte Constitucional, Consejo de Estado, Corte Suprema, JEP, CNSC, Banco de la República, ' +
                 'Procuraduría, Contraloría, Defensoría, Registraduría y CNE.' },
    'I-13': { t: 'Interferencia en la independencia técnica', dec: true, origenCategoria: 'construida-para-el-caso',
              d: 'Actos sobre entidades del Ejecutivo con independencia técnica de ley —el DANE, las ' +
                 'agencias reguladoras—, que no son órganos autónomos y por eso no caben en I-05.' },
    'I-07': { t: 'Información pública obtenida por tutela', dec: true, origenCategoria: 'juridica-preexistente',
              d: 'Solicitudes que solo se respondieron después de una acción judicial.' },
    'I-06': { t: 'Registros sin respuesta oficial', dec: false,               d: 'Hechos en los que se buscó la respuesta del Gobierno y no la hay. Sale de la Capa 1.' },
    'I-09': { t: 'Actividad reportada', dec: false,               d: 'Lo que el Gobierno hizo. No es lo mismo que lo que cambió, y no se suma con ello.' },
    'I-10': { t: 'Resultados medidos', dec: false,               d: 'Lo que cambió en el país. Que se mida no dice quién lo causó.' }
  };
  /* El orden de la tabla no es el alfabético: los tres declarados primero
     —son los del eje B— y después los que salen solos. */
  var ORDEN_IND = ['I-04', 'I-05', 'I-13', 'I-07', 'I-06', 'I-09', 'I-10'];

  /* «Con menos de 180 días de gobierno, los indicadores describen un arranque,
     no una tendencia.» El pliego obliga a publicarlo siempre, así que va
     pegado al resultado y no en una nota al pie. */
  function poderPredictivo(dias) {
    if (dias >= 540) return { id: 'alto', t: 'alto',
      d: 'Con año y medio de gobierno la serie ya describe una tendencia.' };
    if (dias >= 180) return { id: 'medio', t: 'medio',
      d: 'Con medio año hay serie, pero todavía cabe que un trimestre la mueva entera.' };
    return { id: 'bajo', t: 'bajo',
      d: 'Con menos de 180 días esto describe un arranque, no una tendencia. Un mes distinto cambia la cifra.' };
  }

  /* ── ¿ESTE INDICADOR ESTÁ VALIDADO? (v964) ───────────────────────────────
     I-13 lo inventó este proyecto después de ver el caso que necesitaba
     capturar, así que está sin contrastar: puede estar tallado a la medida
     de un solo caso. Eso sale impreso JUNTO A LA CIFRA y no en una nota,
     porque un indicador de un solo caso que no se puede contrastar se parece
     demasiado a una medición, y esa confusión es peor que no tenerlo.

     El conteo se CALCULA y no se teclea: un número escrito a mano dentro de
     un texto es una cifra que envejece sola (v903). Y por eso la marca se
     quita ella misma el día que el trabajo de archivo entre: no hay ninguna
     bandera que alguien tenga que acordarse de bajar.

     Un gobierno anterior cuenta como PROBADO cuando su registro pasó por la
     misma clasificación —tiene entradas con los tres insumos de la Capa 1,
     así que el criterio se pudo evaluar ahí— y el criterio no disparó. Las
     dos mitades hacen falta: sin la primera, «no dispara» no significa que
     distinga, significa que no hay material, que es lo que la v963 midió. */
  function corridaHaciaAtras(dd, id) {
    var ent = ((dd || {}).entradas) || [];
    var ids = idsDelRegistro(dd);
    var clasificadas = 0, disparos = 0;
    ent.forEach(function (e) {
      if (e && e.nivelGobierno && e.estadoProcesal && e.tipoEvidencia) clasificadas++;
      if ((((e && e.indicadores) || []).indexOf(id) >= 0) && pasaElCriterio(e, id, ids).cuenta) disparos++;
    });
    return { n: ent.length, clasificadas: clasificadas, disparos: disparos,
             probado: clasificadas > 0 && disparos === 0 };
  }

  function validacionDe(id, anterior) {
    var ind = INDICADORES[id] || {};
    /* La marca es de los indicadores que tienen CRITERIO escrito: son los que
       tienen bordes, y los bordes se dibujaron mirando este registro. Los
       otros tres salen directos de la clasificación de la Capa 1, sin
       criterio propio que contrastar. */
    if (!CRITERIOS[id]) return null;
    var cat = ind.origenCategoria || 'construida-para-el-caso';
    var oc = ORIGEN_CATEGORIA[cat] || ORIGEN_CATEGORIA['construida-para-el-caso'];
    var regs = anterior ? [anterior] : [];
    var probados = 0, clasificadas = 0, corridas = [];
    regs.forEach(function (dd) {
      var r = corridaHaciaAtras(dd, id);
      clasificadas += r.clasificadas;
      if (r.probado) probados++;
      corridas.push({ quien: dd.gobernante || dd.titulo || 'gobierno anterior', n: r.n,
                      clasificadas: r.clasificadas, disparos: r.disparos, probado: r.probado });
    });
    var razon;
    if (probados > 0) {
      razon = 'Se corrió contra ' + probados + ' gobierno' + (probados === 1 ? '' : 's') +
              ' anterior' + (probados === 1 ? '' : 'es') + ' con registros clasificados y no disparó: ' +
              'distingue.';
    } else if (!regs.length) {
      razon = 'No hay en mano ningún registro de un gobierno anterior con el que contrastarlo.';
    } else if (!clasificadas) {
      razon = 'Los registros de gobiernos anteriores que hay no pasaron por esta clasificación, así que el ' +
              'criterio no se pudo correr ahí. Que no dispare no demuestra que distinga: demuestra que no ' +
              'hay material.';
    } else {
      razon = 'Corrido contra los registros anteriores, disparó: hay que mirar si el criterio distingue.';
    }
    return { origenCategoria: cat, gravedad: oc.t, porQue: oc.d,
             urge: cat === 'construida-para-el-caso',
             validado: probados > 0, gobiernosAnterioresProbados: probados,
             registrosEnMano: regs.length, corridas: corridas, razon: razon };
  }

  /* ── DÓNDE PUDO CORRER LA GUARDA DE ROL, Y DÓNDE NO (v966) ───────────────
     NINGUNA COMPROBACIÓN DESACTIVADA PUEDE SER SILENCIOSA. Si no puede
     correr, lo dice y se cuenta. Es la regla que este módulo ya tomó cuatro
     veces —`NO CONCLUYENTE` en el arnés, `sin-base-registrada` en la puerta,
     `validado: no` en el indicador— y esta es la cuarta: la guarda de la
     v965 exige que al menos una fuente documente el ACTO, y no puede correr
     sobre las entradas que usan la forma antigua `fuente` + `url`, que no
     tiene dónde poner un rol. Sin decirlo, esa exención se lee como que la
     comprobación pasó.

     Son cuatro estados y no dos, porque piden cosas distintas —la distinción
     de la v899 entre «sin dato» y «panel fuera»—: declarar los roles cuesta
     un renglón; migrar el esquema es otra tanda. */
  var ROL_FUENTE = {
    'ok': { t: 'comprobada',
            d: 'Sus fuentes declaran su rol y al menos una documenta el acto.' },
    'sin-acto': { t: 'sin fuente del acto',
                  d: 'Declara los roles y ninguna de sus fuentes documenta el acto: una cobertura de ' +
                     'reacciones no prueba que el acto ocurriera.' },
    'sin-declarar': { t: 'roles sin declarar',
                      d: 'Sus fuentes podrían llevar el rol y nadie lo escribió todavía. Cuesta un renglón ' +
                         'por fuente.' },
    'no-comprobable-esquema-antiguo': {
      t: 'no comprobable · esquema antiguo',
      d: 'Guarda su fuente en los campos `fuente` y `url`, que no tienen dónde poner un rol. La ' +
         'comprobación no corre acá, y eso NO es que haya pasado: es que no se pudo hacer.' }
  };

  function rolDeFuentes(e) {
    var fs = (e && e.fuentes) || [];
    if (!fs.length) {
      /* Sin `fuentes` pero con los campos viejos: la forma antigua. Sin
         ninguna de las dos cosas no hay fuente que clasificar, y eso ya lo
         dice la guarda de casos. */
      var vieja = !!((e && e.fuente) || (e && e.url));
      return vieja ? 'no-comprobable-esquema-antiguo' : 'sin-declarar';
    }
    var roles = fs.map(function (f) { return String((f && f.rol) || '').trim(); })
                  .filter(function (x) { return x; });
    if (!roles.length) return 'sin-declarar';
    return roles.indexOf('acto') >= 0 ? 'ok' : 'sin-acto';
  }

  /* El recuento se hace sobre las entradas que DECLARAN indicador, que son
     las que sostienen una cifra publicada. Para las demás la procedencia
     importa igual, pero no hay ninguna cuenta colgando de ellas. */
  function coberturaDeRol(ent) {
    var por = { 'ok': 0, 'sin-acto': 0, 'sin-declarar': 0, 'no-comprobable-esquema-antiguo': 0 };
    var casos = [];
    (ent || []).forEach(function (e) {
      if (!(((e && e.indicadores) || []).length)) return;
      var id = rolDeFuentes(e);
      por[id]++;
      casos.push({ fecha: (e && e.fecha) || '', titulo: (e && e.titulo) || '', estado: id,
                   t: ROL_FUENTE[id].t, d: ROL_FUENTE[id].d });
    });
    var n = casos.length;
    return { n: n, corrio: por.ok + por['sin-acto'], por: por, casos: casos,
             sinCorrer: n - (por.ok + por['sin-acto']) };
  }

  function indicadoresDe(dd, corte) {
    /* Sin argumento, el registro del gobierno actual —igual que
       `comparabilidad`. Antes caía en `{}` y medía un registro vacío, que es
       lo peor de los dos: devuelve ceros con la forma de una medición. */
    dd = dd || D;
    var ent = hechosDelMandato(dd, corte);
    var hasta = corte || (dd.entrega) || (new Date()).toISOString().slice(0, 10);
    var dias = Math.max(1, Math.round(
      (new Date(hasta + 'T00:00:00') - new Date((dd.posesion || hasta) + 'T00:00:00')) / 86400000));
    var por100 = function (n) { return Math.round(1000 * n / dias) / 10; };

    var idsReg = idsDelRegistro(dd);
    var c1 = capaUnoDe_conjunto(ent);
    var crudo = { 'I-06': c1.contra.ausente, 'I-09': c1.medicion.actividad, 'I-10': c1.medicion.resultado,
                  'I-04': 0, 'I-05': 0, 'I-13': 0, 'I-07': 0 };
    var sinDeclarar = 0;
    /* Lo declarado que NO pasa el criterio no desaparece: se cuenta aparte y
       con su motivo. Un indicador que baja sin decir por qué se lee como que
       el hecho no ocurrió. */
    var fuera = { 'I-04': [], 'I-05': [], 'I-13': [], 'I-07': [] };
    /* Por cuál renglón del criterio entró cada uno. Un indicador cuyo conteo
       entero viene de UNA sola vía dice algo distinto de uno repartido, y sin
       esto las dos cifras se ven iguales. */
    var porVia = { 'I-04': {}, 'I-05': {}, 'I-13': {}, 'I-07': {} };
    ent.forEach(function (e) {
      var lista = (e && e.indicadores) || [];
      if (!lista.length) sinDeclarar++;
      lista.forEach(function (k) {
        if (crudo[k] === undefined || !INDICADORES[k].dec) return;
        var g = pasaElCriterio(e, k, idsReg);
        if (g.cuenta) { crudo[k]++; porVia[k][g.via] = (porVia[k][g.via] || 0) + 1; }
        else fuera[k].push({ titulo: (e && e.titulo) || '', fecha: (e && e.fecha) || '',
                             motivo: g.motivo, d: g.d });
      });
    });

    var filas = ORDEN_IND.map(function (k) {
      var ind = INDICADORES[k];
      var f = { id: k, t: ind.t, d: ind.d, declarado: ind.dec, n: crudo[k], por100: por100(crudo[k]) };
      if (CRITERIOS[k]) {
        f.criterio = CRITERIOS[k];
        f.fuera = fuera[k];
        f.porVia = porVia[k];
        f.vias = Object.keys(porVia[k]);
        f.declaradas = crudo[k] + fuera[k].length;
      }
      /* La validación se mide contra el registro del gobierno ANTERIOR, que
         es otro objeto: pedírselo al propio registro sería comprobar que es
         igual a sí mismo. */
      f.validacion = validacionDe(k, dd === D ? DA : null);
      /* I-06 es el único que no se puede publicar como cero: un cero ahí
         diría que el Gobierno respondió a todo, cuando lo que pasa es que
         nadie lo ha revisado. Es la distinción de los tres estados de la
         Capa 1, dicha en la cuenta. */
      if (k === 'I-06' && c1.contra.sinRevisar) {
        f.sinCalcular = true;
        f.razon = c1.contra.sinRevisar + ' de ' + c1.n + ' hechos están sin revisar, así que un cero acá ' +
                  'diría que el Gobierno respondió a todo y lo que pasa es que nadie lo ha mirado.';
      }
      return f;
    });

    return { coberturaRol: coberturaDeRol(ent),
             dias: dias, hasta: hasta, desde: dd.posesion || null, hechos: ent.length,
             por100Hechos: por100(ent.length), sinDeclarar: sinDeclarar,
             poder: poderPredictivo(dias), filas: filas,
             /* La cobertura del registro, tal como el propio archivo la
                declara. La lee `comparabilidad` para decidir si dos tasas se
                pueden poner una al lado de la otra. */
             cobertura: dd.cobertura || null, exhaustivo: !dd.cobertura };
  }

  /* ¿SE PUEDEN COMPARAR DOS GOBIERNOS? La respuesta de este módulo, hoy, es
     NO — y esta función existe para decirlo con los números en la mano en vez
     de publicar la tasa y dejar que el lector saque la conclusión.

     El pliego lo pide en su control de calidad: «¿Cada comparación entre
     gobiernos usa períodos de igual duración y el mismo corte del calendario?
     Si no, marca `no_comparable` y NO publiques la tasa — ni cuando favorezca
     tu lectura ni cuando la contradiga.»

     Acotar el período es la mitad fácil y se hace: se recorta el registro del
     otro gobierno a los MISMOS días desde su posesión. Lo que no se arregla
     recortando es que los dos registros NO SON LA MISMA CLASE DE OBJETO. Uno
     es una bitácora diaria llevada en tiempo real; el otro, treinta y dos
     hechos escogidos de cuatro años — lo dice su propio campo `cobertura`, y
     hasta hoy no lo leía nadie.

     Medido el día que se escribió esto: 400 hechos por 100 días contra 2,4.
     Esa diferencia no es de los dos gobiernos, es de los dos registros, y
     publicarla como tasa comparada sería la `comparacion_invalida` que este
     módulo existe para detectar, cometida por el módulo. */
  function comparabilidad(a, b) {
    /* Sin argumentos toma los dos registros cargados. Así la ficha y una
       prueba llaman a LA MISMA función sobre los mismos datos, en vez de que
       la prueba arme su propio par y acabe midiendo otra cosa. */
    a = a || D; b = b || DA;
    if (!a || !b) return { a: null, b: null, comparable: false, razones: ['sin-registro'],
                           texto: 'Falta uno de los dos registros, así que no hay nada que comparar.' };
    var ia = indicadoresDe(a), ib = indicadoresDe(b, b && b.posesion ? fechaMas(b.posesion, ia.dias) : null);
    var razones = [];
    if (!ia.exhaustivo || !ib.exhaustivo) razones.push('registro-no-exhaustivo');
    if (ib.hechos < 10) razones.push('muestra-insuficiente');
    return {
      a: ia, b: ib, comparable: razones.length === 0, razones: razones,
      /* El texto se arma acá y no en la pantalla: es una advertencia, y dos
         copias de una advertencia se separan (v867). */
      texto: razones.length === 0 ? '' :
        'Las dos tasas NO se pueden poner una al lado de la otra. Se recortó el registro del otro gobierno a ' +
        'sus primeros ' + ia.dias + ' días, que es la mitad fácil; lo que no se arregla recortando es que los ' +
        'dos registros no son la misma clase de objeto. ' +
        (ia.exhaustivo ? '' : 'El actual declara su propia cobertura. ') +
        (ib.exhaustivo ? '' : 'El del gobierno anterior es una selección de hechos de todo un cuatrienio, no una ' +
          'bitácora diaria, y así lo dice el propio registro. ') +
        'En esa ventana el actual trae ' + ia.hechos + ' hechos y el anterior ' + ib.hechos + ': la diferencia ' +
        'es de los registros, no de los gobiernos.'
    };
  }

  function fechaMas(iso, dias) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  /* ═══ CAPA 3 DEL PLIEGO PRESIDENCIAL · LOS EJES ═══════════════════════
     «Se muestran LADO A LADO, nunca combinados en un número único.»

     Y esa no es una preferencia de diseño: es lo que hace que el módulo sirva
     para dos preguntas distintas. Confiabilidad mide si lo que dice coincide
     con lo que hace; deterioro institucional mide qué le pasa a las reglas
     del juego. Un presidente puede ser muy sincero sobre su intención de
     concentrar poder —confiabilidad alta, deterioro alto— y puede mentir
     mucho sin tocar una sola institución. Meterlos en la misma escala deja el
     módulo sin servir para ninguna de las dos.

     Hay una función que devuelve los tres y NO hay ninguna que los promedie.
     `revisar.js` lo vigila, porque el día que alguien escriba «índice general
     de gobierno» habrá perdido las dos preguntas de una vez.

     ═══ LO QUE ESTA VERSIÓN PUBLICA, QUE ES NINGÚN NIVEL ═══
     Los tres ejes se calculan y los tres salen SIN NIVEL, cada uno diciendo
     qué le falta. No es un arreglo a medias: es lo que el pliego manda para
     el eje B con todas las letras —«sin ella el eje B no tiene contra qué
     comparar y no se puede publicar»— y lo que los otros dos piden por la
     misma razón. Publicar un nivel sobre una persona real con el cálculo a
     medias es exactamente lo que este módulo existe para no hacer. */

  /* ── EJE A · CONFIABILIDAD ─────────────────────────────────────────────
     «Se calcula sobre I-01, I-02 e I-03, y SOLO con registros donde
     `mismo_objeto_verificado: true`. Una contradicción retórica sin identidad
     de objeto NO baja el eje: se registra aparte como `tension_retorica`, que
     es real y publicable, pero no es lo mismo que incumplir.»

     El pliego trae su propio ejemplo y es el que explica por qué importa: el
     Fonpet NO alimenta el eje A, porque lo que se prometió y lo que se hizo
     no son el mismo objeto — y publicarlo como prueba de incumplimiento
     «hunde los cuatro registros que sí aguantan». Una acusación floja al lado
     de cuatro sólidas no suma: resta.

     `mismoObjetoVerificado` SE DECLARA por contradicción y no se deduce del
     estado. Y no se deriva de `estado: 'tension'`, que es otra cosa: aquél es
     un estado PROBATORIO —todavía no está documentada— y éste es de
     IDENTIDAD —está documentada y aun así las dos frases no hablan de lo
     mismo—. Una contradicción puede estar perfectamente documentada y no
     tener identidad de objeto, que es justo el caso del Fonpet. */
  var EJE_A = {
    5: { id: 'A5', t: 'Alta' }, 4: { id: 'A4', t: 'Media-alta' }, 3: { id: 'A3', t: 'Media' },
    2: { id: 'A2', t: 'Baja' }, 1: { id: 'A1', t: 'No confiable' }
  };

  function ejeA(dd) {
    var cx = casosDeCx(dd);
    var doc = cx.filter(function (c) { return c.estado === 'documentada' && c.cuenta !== false; });
    var conId = 0, sinId = 0, sinDeclarar = 0, retoricas = [];
    doc.forEach(function (c) {
      var v = c.mismoObjetoVerificado;
      if (v === true) conId++;
      else if (v === false) { sinId++; retoricas.push(c.tema || ''); }
      else sinDeclarar++;
    });
    var r = { eje: 'A', t: 'Confiabilidad',
              pregunta: '¿lo que dice coincide con lo que hace?',
              documentadas: doc.length, conIdentidad: conId, sinIdentidad: sinId,
              sinDeclarar: sinDeclarar, tensionRetorica: retoricas,
              nivel: null, publicable: false, falta: '' };
    if (sinDeclarar) {
      r.falta = sinDeclarar + ' de ' + doc.length + ' contradicciones documentadas no declaran si las dos ' +
        'frases hablan del MISMO objeto verificado. Sin eso no se puede separar un incumplimiento de una ' +
        'tensión retórica, y el pliego prohíbe contarlas juntas: una acusación floja al lado de varias ' +
        'sólidas no suma, resta.';
    } else if (!doc.length) {
      r.falta = 'No hay contradicciones documentadas que contar.';
    } else {
      r.publicable = true;
      r.nivel = EJE_A[conId === 0 ? 5 : conId === 1 ? 4 : conId === 2 ? 3 : conId === 3 ? 2 : 1];
    }
    return r;
  }

  /* ── EJE B · DETERIORO INSTITUCIONAL ───────────────────────────────────
     «Se calcula sobre I-04, I-05, I-06 e I-07, normalizados por 100 días y
     comparados contra la media de los tres gobiernos anteriores.»

     La primera mitad está hecha desde la v958. La segunda no existe y no se
     puede inventar: hace falta la serie de Petro, Duque y Santos, que es
     trabajo de archivo. El pliego lo dice como condición de validez y no como
     sugerencia: «el nivel se CALCULA, no se asigna», «se recalcula hacia atrás
     para todos los gobiernos con los mismos criterios», y «si el cálculo
     arroja B5 para un gobierno anterior, se publica igual».

     Sin la media, los cuatro indicadores no tienen contra qué compararse y el
     nivel no sale. Lo que sí se publica son los cuatro números en crudo y por
     100 días, con la frase que el eje obliga a decir: se puede leer en las dos
     direcciones —uso intensivo de figuras excepcionales puede ser respuesta
     eficaz a una emergencia real, o concentración de poder— y el módulo
     muestra el número sin elegir la lectura. */
  var EJE_B = {
    1: { id: 'B1', t: 'Estable' }, 2: { id: 'B2', t: 'Tensión' }, 3: { id: 'B3', t: 'Elevado' },
    4: { id: 'B4', t: 'Grave' }, 5: { id: 'B5', t: 'Crítico' }
  };
  /* I-13 NO está acá, y es deliberado. El eje B mide DESVIACIÓN respecto de
     una media histórica, y de I-13 no hay media: nació en la v962 y nadie ha
     recalculado los gobiernos anteriores con este criterio. Meterlo sin su
     media haría que el eje comparara cuatro indicadores contra una referencia
     y el quinto contra nada.

     Así que el indicador se publica y el eje no lo usa. El día que exista la
     media de los tres gobiernos, entra acá con los otros cuatro — y hay una
     guarda para que no entre antes. */
  var IND_EJE_B = ['I-04', 'I-05', 'I-06', 'I-07'];

  function ejeB(dd, corte) {
    var ind = indicadoresDe(dd, corte);
    var filas = ind.filas.filter(function (f) { return IND_EJE_B.indexOf(f.id) >= 0; });
    return {
      eje: 'B', t: 'Deterioro institucional',
      pregunta: '¿qué le está pasando a las reglas del juego?',
      dias: ind.dias, poder: ind.poder, filas: filas,
      nivel: null, publicable: false,
      falta: 'La media histórica de I-04 a I-07 para Petro, Duque y Santos, calculada con los mismos ' +
             'criterios y por 100 días. Sin ella los cuatro indicadores no tienen contra qué compararse ' +
             'y el nivel no se puede calcular. Es trabajo de archivo, no de opinión.',
      lectura: 'Este eje describe la FRECUENCIA con la que se usan mecanismos institucionales, y se lee en ' +
               'las dos direcciones: un uso intensivo de figuras excepcionales puede indicar una respuesta ' +
               'eficaz a una emergencia real, o una concentración de poder. El módulo muestra el número; no ' +
               'elige la lectura.'
    };
  }

  /* ── EJE C · ORIENTACIÓN DEL GASTO ─────────────────────────────────────
     «¿Hacia dónde se mueve el dinero público, en términos reales?» El pliego
     le pone siete reglas de cálculo y sin ellas el eje no sirve: deflactar
     siempre, declarar si «gasto militar» es Defensa sola o Defensa+Policía,
     separar aprobado de ejecutado, usar % del PIB y del presupuesto, separar
     lo inflexible de lo discrecional y el servicio de deuda, y calcular la
     misma serie para los gobiernos anteriores.

     Este módulo no tiene una sola de las cifras que eso pide. Y la diferencia
     con los otros dos ejes es que acá no falta una media: falta la fuente
     entera. Se declara con lo que haría falta, en vez de sacar un eje de las
     menciones presupuestales que hay en la línea de tiempo — que serían
     titulares, no ejecución. */
  function ejeC() {
    return {
      eje: 'C', t: 'Orientación del gasto',
      pregunta: '¿hacia dónde se mueve el dinero público, en términos reales?',
      nivel: null, publicable: false,
      falta: 'La ejecución presupuestal por sector, deflactada por el IPC del DANE, con el aprobado, el ' +
             'radicado y el ejecutado separados y con su fecha de corte; la agregación de «gasto militar» ' +
             'declarada en sus dos formas —Defensa sola y Defensa más Policía—; el porcentaje del PIB y del ' +
             'presupuesto; y la misma serie para los gobiernos anteriores. El módulo no tiene ninguna de ' +
             'esas cifras: las menciones presupuestales de la línea de tiempo son titulares, no ejecución.',
      lectura: 'Este eje NO mide confiabilidad ni deterioro. Un gobierno puede reorientar el gasto ' +
               'exactamente como lo prometió: eso es confiabilidad ALTA con una política que se puede ' +
               'criticar, y son preguntas distintas.'
    };
  }

  /* Los tres juntos, y NINGUNA función que los promedie. Devolver una lista
     y no un objeto con un total es parte de la regla: si el día de mañana
     alguien quiere un número único, tiene que escribirlo a mano y esa línea
     se ve en el diff. */
  function ejesDe(dd, corte) {
    return [ejeA(dd), ejeB(dd, corte), ejeC()];
  }

  /* ═══ CAPA 4 DEL PLIEGO PRESIDENCIAL ══════════════════════════════════
     El marco declarado y el análisis editorial. Es la capa donde va la
     postura de quien opera URBIS, y la regla que la hace legítima es la misma
     regla de oro de arriba, dicha en la otra dirección: **no alimenta ningún
     cálculo y ningún cálculo la cita como evidencia**.

     El pliego lo argumenta mejor de lo que yo podría: «una opinión firmada y
     enlazada a evidencia se defiende. Un juicio metido dentro de un algoritmo
     solo se desacredita. Si la postura es fuerte, el formato firmado la hace
     más fuerte, no menos.»

     ── LO QUE ESTE CÓDIGO NO ESCRIBE, Y NO ES UN OLVIDO ──
     El texto del editorial, su autor, su fecha y los supuestos de valor del
     marco NO los pone el código y no los pone quien programa. Firmar una
     opinión sobre un presidente en ejercicio con el nombre de otra persona
     sería lo más grave que este módulo podría hacer, y lo sería aunque la
     opinión fuera buena. Se leen del registro; si no están, la sección lo
     dice y ahí para. */

  /* Las dos listas fijas son del pliego, palabra por palabra. Van en el
     código y no en el registro porque no son una opinión: son la definición
     del módulo, y si cambian cambia el módulo. Los SUPUESTOS DE VALOR, en
     cambio, son de la persona y viven en el registro. */
  var MARCO_MIDE = [
    'coincidencia entre lo dicho y lo hecho (eje A)',
    'frecuencia de uso de mecanismos institucionales excepcionales (eje B)',
    'orientación real del gasto público por sector (eje C)'
  ];
  var MARCO_NO_MIDE = [
    'si una política es buena o mala',
    'intenciones',
    'estados mentales o rasgos de personalidad'
  ];

  function marcoDeclarado(dd) {
    var m = ((dd || D) || {}).marcoDeclarado || {};
    var sup = (m.supuestos || []).filter(function (x) { return String(x || '').trim(); });
    return {
      mide: MARCO_MIDE, noMide: MARCO_NO_MIDE,
      autor: String(m.autor || '').trim(), fecha: String(m.fecha || '').trim(),
      supuestos: sup, completo: !!(sup.length && m.autor && m.fecha),
      /* Un marco sin supuestos declarados es la neutralidad falsa que el
         pliego nombra: «elegir qué indicadores rastrear ya es una decisión de
         valores. Eso es inevitable y no es un defecto. Lo que sí sería un
         defecto es esconderlo.» Así que la ausencia se pinta, no se calla. */
      falta: sup.length ? '' :
        'Quien opera el módulo no ha declarado sus supuestos de valor. Elegir qué se rastrea ya es una ' +
        'decisión de valores, y no declararla no la quita: la esconde. Un marco declarado es más ' +
        'defendible que una neutralidad falsa — el lector puede discrepar del marco y seguir usando los datos.'
    };
  }

  /* El editorial. Devuelve SIEMPRE un objeto con su estado, nunca null: «no
     hay editorial» y «hay editorial sin firmar» piden cosas distintas. */
  function editorialDe(dd) {
    dd = dd || D;
    var e = (dd || {}).analisisEditorial;
    if (!e || !String(e.texto || '').trim()) {
      return { hay: false, t: 'Sin análisis editorial firmado',
               d: 'Esta sección existe para la postura de quien opera URBIS, con su nombre y su fecha. ' +
                  'Hoy no hay ninguna escrita, y eso es un estado legítimo: lo que no sería legítimo es ' +
                  'una opinión sin firma, o una opinión metida dentro del cálculo.' };
    }
    var ent = (dd.entradas) || [];
    var apoyos = (e.registros || []).map(function (ref) {
      var reg = null;
      for (var i = 0; i < ent.length; i++) {
        if (ent[i].id === ref || ent[i].titulo === ref) { reg = ent[i]; break; }
      }
      var cp = reg ? categoriaProbatoriaDe(reg) : null;
      /* La marca que el pliego pide en la interfaz: si el editorial se apoya
         en una atribución causal o en una afirmación en circulación, se ve.
         No lo descalifica —una opinión puede apoyarse en lo que quiera— pero
         el lector tiene que poder ver sobre qué se está apoyando. */
      var flojo = !!(cp && (cp.id === 'atribucion-causal' || cp.id === 'en-circulacion'));
      return { ref: ref, hallado: !!reg, titulo: reg ? reg.titulo : '', clase: cp, flojo: flojo };
    });
    return {
      hay: true, texto: String(e.texto), autor: String(e.autor || '').trim(),
      fecha: String(e.fecha || '').trim(), apoyos: apoyos,
      flojos: apoyos.filter(function (a) { return a.flojo; }).length,
      huerfanos: apoyos.filter(function (a) { return !a.hallado; }).length,
      firmado: !!(String(e.autor || '').trim() && String(e.fecha || '').trim())
    };
  }

  /* ── EL CONTROL DE CALIDAD DEL PLIEGO ──────────────────────────────────
     «Si algún casillero falla, el módulo publica el resultado CON la marca de
     la falla visible. No publica sin la marca.»

     Eso es lo que convierte la lista en algo distinto de un buen propósito:
     no es una lista para que alguien la repase antes de publicar, es una
     cuenta que se hace sola y que sale impresa al lado del registro. Los que
     este módulo no puede computar se dicen como tales — dar por bueno un
     casillero que no se pudo correr es el error típico que la lámina
     educativa declara desde la v879, y acá vale igual. */
  function controlDeCalidad(dd, corte) {
    dd = dd || D;
    var ent = hechosDelMandato(dd, corte);
    var c1 = capaUnoDe_conjunto(ent);
    var ed = editorialDe(dd);
    var f = [];
    var casos = casosDeCorrupcion(dd);

    function caja(t, estado, det) { f.push({ t: t, estado: estado, det: det }); }

    caja('Todo indicador comparativo va normalizado por 100 días', 'pasa',
         'Los seis indicadores salen por 100 días de gobierno desde la v958.');

    var sinFecha = ent.filter(function (e) { return !e.fecha; }).length;
    caja('Toda afirmación sobre un hecho pasado tiene fecha', sinFecha ? 'falla' : 'pasa',
         sinFecha ? sinFecha + ' sin fecha' : 'las ' + ent.length + ' la tienen');

    var sinUrl = ent.filter(function (e) { return !fuentesDe(e).length; }).length;
    caja('Ninguna afirmación se publica sin URL', sinUrl ? 'falla' : 'pasa',
         sinUrl ? sinUrl + ' de ' + ent.length + ' sin una sola fuente enlazada'
                : 'las ' + ent.length + ' traen fuente');

    var pesanSinNivel = casos.filter(function (c) {
      var est = ESTADOS_CASO[c.estado];
      return est && est.pesa && !entraAlVeredicto(c).nivel.declarado;
    }).length;
    caja('Ningún registro de otro nivel de gobierno alimenta el score', pesanSinNivel ? 'falla' : 'pasa',
         pesanSinNivel ? pesanSinNivel + ' casos que pesan sin declarar su nivel'
                       : 'todo caso que pesa declara que es nacional');

    var acusaSinDoc = casos.filter(function (c) {
      return c.estado === 'confirmado' && !((c.fuentes || []).length);
    }).length;
    caja('Ninguna acusación sin documento cuenta como hecho probado', acusaSinDoc ? 'falla' : 'pasa',
         acusaSinDoc ? acusaSinDoc + ' confirmados sin fuente' : 'los confirmados traen su fuente');

    caja('Cada registro tiene contrargumento oficial, lleno o marcado ausente',
         c1.contra.sinRevisar ? 'falla' : 'pasa',
         c1.contra.sinRevisar ? c1.contra.sinRevisar + ' de ' + c1.n + ' sin revisar' : 'los ' + c1.n + ' declarados');

    caja('El editorial está separado y rotulado', ed.hay ? (ed.firmado ? 'pasa' : 'falla') : 'pasa',
         ed.hay ? (ed.firmado ? 'firmado por ' + ed.autor : 'hay editorial SIN autor o SIN fecha')
                : 'no hay editorial, y la sección lo dice');

    /* Los que este módulo no puede correr. Se nombran con lo que haría falta,
       en vez de darlos por buenos. */
    caja('El set trae piezas distorsionadas de ambos signos y casos de encuadre limpio', 'sin-correr',
         'El registro no clasifica la calidad del encuadre de cada pieza, así que no se puede medir el ' +
         'balance de la muestra. Haría falta el campo `calidad_del_encuadre` de la Capa 1 del pliego.');
    caja('Ningún registro trae menores identificados', 'sin-correr',
         'Se revisa a mano al escribir cada entrada; el módulo no tiene cómo comprobarlo por su cuenta. ' +
         'Los dos hechos del registro que involucran menores están como agregado y sin nombres.');
    caja('El eje B se recalculó para los gobiernos anteriores', 'falla',
         'No existe la media histórica de Petro, Duque y Santos, así que el eje B no publica nivel.');

    var falla = f.filter(function (x) { return x.estado === 'falla'; }).length;
    var sinCorrer = f.filter(function (x) { return x.estado === 'sin-correr'; }).length;
    return { filas: f, pasan: f.length - falla - sinCorrer, falla: falla, sinCorrer: sinCorrer,
             limpio: falla === 0 };
  }

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
    /* Sin registro toma el del gobierno actual, como todas las demás de esta
       API. Caía en `{}`, y ahí medía la nada en vez del registro real.

       MEDIDO, no supuesto: un registro vacío NO da el peldaño de arriba —da
       `sin-datos`, porque los mínimos de la v791 impiden dictaminar sin casos
       ni hechos—. Escribí primero que daría «Confiabilidad inquebrantable» y
       la aserción lo desmintió, así que el peligro era menor del que declaré:
       una ficha muda, no un veredicto falso. Se arregla igual, porque medir
       un objeto vacío cuando existe el registro es medir otra cosa de la que
       se dice medir; pero el motivo va escrito como es. */
    dd = dd || D;
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
    /* Dos pares de cuentas que NO son el mismo, y por eso llevan nombres
       distintos: `confirmados`/`enInvestigacion` es cuántos se MUESTRAN en
       cada grupo, y `pesanConf`/`pesanInv` es cuántos entran al techo. Con un
       solo par, un caso municipal desaparecería del panel o pesaría igual, y
       las dos cosas son falsas. Coinciden mientras todos sean nacionales. */
    var casos = { confirmados: 0, enInvestigacion: 0, senalamientos: 0, archivados: 0, porDocumentar: 0,
                  pesanConf: 0, pesanInv: 0, fueraPorNivel: 0, sinNivel: 0, lista: [] };
    casosDeCorrupcion(dd).forEach(function (c, i) {
      var est = ESTADOS_CASO[c.estado];
      if (!est) return;
      if (c.estado === 'por-documentar') { casos.porDocumentar++; return; }
      if (corte && (!c.fecha || c.fecha > corte)) return;
      var puerta = entraAlVeredicto(c);
      if (c.estado === 'confirmado') casos.confirmados++;
      else if (c.estado === 'en-investigacion') casos.enInvestigacion++;
      else if (c.estado === 'archivado') casos.archivados++;
      else casos.senalamientos++;
      if (est.pesa) {
        if (!puerta.entra) casos.fueraPorNivel++;
        else if (!puerta.nivel.declarado) casos.sinNivel++;
        if (puerta.entra) { if (c.estado === 'confirmado') casos.pesanConf++; else casos.pesanInv++; }
      }
      casos.lista.push({ c: c, i: i, pesa: est.pesa && puerta.entra, puerta: puerta });
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
      casos:    { i: TECHOS.casos.f(casos.pesanConf, casos.pesanInv),
                  n: casos.pesanConf + casos.pesanInv, t: TECHOS.casos.t,
                  detalle: casos.pesanConf + ' conf. · ' + casos.pesanInv + ' en inv.' +
                    (casos.fueraPorNivel
                      ? ' · ' + casos.fueraPorNivel + ' fuera por nivel de gobierno' : '') },
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

    /* El recuento de la Capa 1 viaja con la ficha y NO entra en `techos` ni
       en `peor`: es la regla de oro del pliego. Se calcula después del
       veredicto a propósito, para que se vea en el código que no lo toca. */
    var capa1 = capaUnoDe_conjunto(ent);

    return { corte: hasta, palabra: palabra, casos: casos, claridad: claridad, ritmo: ritmo,
             alcance: alcance, techos: techos, manda: manda, veredicto: v,
             capa1: capa1, rasgos: rasgosDe(dd, ent) };
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
    /* El tope va a SIETE días y no a seis, y la diferencia se ve un día de
       cada siete. Con seis, cuando hoy cae justo en un borde de semana
       —(hoy − posesión) múltiplo de 7— la última vuelta pedía `t_último + 7`
       contra un tope de `hoy + 6`, no entraba, y la serie se quedaba SIN la
       columna en curso: la ficha pública perdía la semana que está corriendo
       y nadie lo notaba hasta el día siguiente. Pasó el 11 de septiembre de
       2026, a las cinco semanas exactas de la posesión, y lo cazó `tficha`
       con «la serie marca la semana en curso». Con siete, el borde siguiente
       siempre cabe, y el `break` de abajo sigue impidiendo que entre más de
       una columna a medias. */
    for (var t = t0 + 7 * 86400000; t <= hoy + 7 * 86400000; t += 7 * 86400000) {
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
  window.URBIS_SEG_FICHA = { calcular: fichaHasta, calcularCon: fichaDe, cuentas: cuentasDe,
                             serie: serieFicha, escalera: ESCALERA, techos: TECHOS,
                             estadosCaso: ESTADOS_CASO, rasgos: RASGOS,
                             polemica: polemicaDe, ordenar: porDiaYPolemica,
                             minimos: { casos: FICHA_MIN_CASOS, hechos: FICHA_MIN_HECHOS },
                             // Capa 2 del pliego: lo que una prueba necesita leer se
                             // agrega acá en vez de alcanzarlo por un lado (v871).
                             indicadores: indicadoresDe, comparabilidad: comparabilidad,
                             catalogoIndicadores: INDICADORES, capaUno: capaUnoDe_conjunto,
                             ejes: ejesDe, ejeA: ejeA, ejeB: ejeB, ejeC: ejeC,
                             marco: marcoDeclarado, editorial: editorialDe,
                             control: controlDeCalidad };

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

  /* La línea de las tres cuentas que producen el veredicto. Va debajo del
     veredicto en la placa: se entiende de un vistazo por qué dice lo que dice.
     Por eso cuenta los que PESAN y no los que se muestran: «1 caso confirmado»
     al lado de «Confiabilidad inquebrantable» se lee como un error de la
     ficha, y sería el caso municipal que la v941 sacó de la cuenta sin que
     esta línea se enterara. Cuando las dos cifras difieren, se dice cuántos
     quedaron fuera y por qué —callarlo sería la mitad mansa del mismo
     defecto—. */
  function cuentasDe(f) {
    return plural(f.casos.pesanConf, 'caso confirmado', 'casos confirmados') + ' · ' +
           f.casos.pesanInv + ' en investigación · ' +
           plural(f.palabra.contadas, 'cambio de postura', 'cambios de postura') + ' · ' +
           (f.claridad.pct == null ? 'sin verificación declarada' : f.claridad.pct + ' % verificado') +
           (f.casos.fueraPorNivel
             ? ' · ' + (f.casos.fueraPorNivel === 1
                 ? 'uno más, fuera de la cuenta por su nivel de gobierno'
                 : f.casos.fueraPorNivel + ' más, fuera de la cuenta por su nivel de gobierno')
             : '');
  }

  /* La placa. La misma en la portada (dentro de un botón que lleva a la
     ficha) y arriba de la ficha. Sin retrato: no se usa la cara de una
     persona real como si fuera la miniatura de un personaje. Va un sello con
     sus iniciales. El veredicto es el texto más grande del módulo. */
  function placaDe(f, reg) {
    reg = reg || D;
    var cerrado = !!reg.cerrado;
    var placa = el('div', 'sp-fi-placa sp-fi-v-' + f.veredicto.id + (cerrado ? ' sp-fi-placa-cerrada' : ''));

    /* ── La firma ────────────────────────────────────────────────────────
       Esta placa se fotografía y la captura circula sola: en un comentario
       de Facebook, en un grupo de WhatsApp, recortada. Sin la firma, un
       veredicto sobre una persona real anda por ahí sin decir quién lo
       hizo, y eso es lo contrario de lo que el módulo defiende en todas sus
       otras frases.

       La fecha va en la misma línea por lo mismo. La barra de arriba de la
       aplicación la muestra, pero un recorte se la come; y un veredicto que
       se calcula solo, contando hechos que se acumulan cada día, envejece.
       Sin fecha, la captura de hoy se lee dentro de un año como si fuera de
       hoy. */
    var firma = el('div', 'sp-fi-firma');
    var logo = el('img', 'sp-fi-firma-logo');
    logo.src = 'assets/brand/urbis-logo.png';
    logo.alt = '';
    logo.setAttribute('aria-hidden', 'true');
    logo.width = 20; logo.height = 20;
    logo.loading = 'lazy';
    firma.appendChild(logo);
    firma.appendChild(el('span', 'sp-fi-firma-t', 'Analizado por URBIS_CO'));
    /* La fecha es la del REGISTRO, no la del día en que se mira: lo que
       fecha un veredicto es hasta cuándo llegaron los hechos que lo
       produjeron. Si el registro no la trae, no se pinta ninguna — poner la
       de hoy sería fechar con el reloj del lector un dato que puede llevar
       semanas quieto. */
    if (reg.actualizado) firma.appendChild(el('span', 'sp-fi-firma-f', fechaCorta(reg.actualizado)));
    /* La dirección, debajo del nombre. Estas fichas circulan como capturas
       de pantalla, y una captura sin dirección no se puede seguir: quien la
       ve no tiene cómo llegar al registro completo, ni a las fuentes de cada
       caso. Es el único renglón de la ficha que no habla del gobernante. */
    firma.appendChild(el('span', 'sp-fi-firma-w', 'urbispro.city'));
    placa.appendChild(firma);

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
    /* Las DOS fechas de un caso no son la misma, y el registro las tenía
       juntas. La de arriba es cuándo una autoridad se pronunció —es la que
       ordena y recorta la serie, o sea la que contesta «¿qué se sabía en esta
       fecha?»—; el hecho puede ser de años antes. En este registro ya divergen:
       el CNE ratificó en 2026 el exceso de topes de una campaña de 2022. Se
       imprime solo cuando el registro declara la segunda y es distinta: ponerla
       siempre repetiría la misma fecha dos veces por caso. */
    if (c.fechaHecho && c.fechaHecho !== c.fecha) {
      art.appendChild(el('p', 'sp-fi-cc-cuando',
        'El hecho es del ' + fechaCorta(c.fechaHecho) +
        '; la fecha de arriba es cuándo una autoridad se pronunció.'));
    }
    var niv = o.puerta && o.puerta.nivel;
    if (niv && niv.declarado && niv.id !== 'nacional') {
      art.appendChild(el('p', 'sp-fi-cc-nivel', 'Nivel de gobierno: ' + niv.t + '.'));
    }
    // El motivo, en minúscula y sin el «se muestra; no pesa» que ya dice la frase.
    var motivo = est.d.replace(/\.?\s*Se muestra; no pesa.*$/, '.');
    var fuera = est.pesa && o.puerta && !o.puerta.entra ? o.puerta : null;
    art.appendChild(el('p', 'sp-fi-cc-pesa' + (fuera ? ' sp-fi-cc-pesa-niv' : ''), fuera
      ? (fuera.razon === 'otro-nivel'
          ? 'No pesa en el veredicto: es una decisión de nivel ' + fuera.nivel.t.toLowerCase() +
            ', y este veredicto es de un gobierno nacional. Se muestra entera, con su estado probatorio.'
          : 'No pesa en el veredicto: declara el nivel de gobierno «' + fuera.nivel.id +
            '», que no es uno de los cuatro conocidos. Se muestra entera; corregir el valor la devuelve a la cuenta.')
      : (!est.pesa
          ? 'No pesa en el veredicto: ' + motivo.charAt(0).toLowerCase() + motivo.slice(1)
          : (c.estado === 'confirmado' ? 'Pesa en el veredicto.'
             : 'Pesa en el veredicto, menos que un confirmado: no se espera a que la investigación se resuelva.'))));
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
      cont.appendChild(el('p', 'sp-fi-nada', 'No se pudo cargar el registro del gobierno anterior. Vuelva a entrar en un momento.'));
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
      /* El denominador de la claridad, escrito al lado del porcentaje.

         Este módulo le reprocha a otras cifras andar sin denominador —el
         62 % de firmas anuladas de un candidato dice lo contrario de lo que
         pasó hasta que uno se entera de que a TODOS les anularon entre el 40
         y el 68 %—. Y su propia cifra principal, la que decide el veredicto
         sobre una persona, salía sola: «72 %», sin decir de cuántos hechos
         ni cuántos quedaron fuera de la cuenta. Un 100 % sobre tres hechos
         de cien no es un registro verificado; es un registro sin revisar con
         una cifra bonita encima, y desde la placa no había forma de
         distinguirlos.

         La misma vara para uno mismo que para lo que se mide. */
      if (k === 'claridad' && f.claridad && f.claridad.conTipo) {
        var det = f.claridad.verificado + ' de ' + f.claridad.conTipo + ' hechos con naturaleza declarada';
        if (f.claridad.sinTipo) det += ' · ' + f.claridad.sinTipo + ' sin declarar, fuera de la cuenta';
        li.appendChild(el('span', 'sp-fi-techo-den', det));
      }
      tl.appendChild(li);
    });
    ver.appendChild(tl);
    ver.appendChild(el('p', 'sp-fi-vnota', f.manda.length
      ? 'El veredicto es el peor de los tres techos. Aquí manda: ' +
        f.manda.map(function (k) { return f.techos[k].t.toLowerCase(); }).join(' y ') + '.'
      : 'Ninguna de las tres cuentas baja el veredicto.'));
    izq.appendChild(ver);

    // ── 1b · Capa 1: qué clase de afirmaciones trae el registro ────────────
    /* Va DESPUÉS del veredicto y dice en su propio encabezado que no lo
       mueve. Es la regla de oro del pliego, escrita donde la lee quien
       consulta la ficha y no solo donde la lee quien programa. */
    var c1 = f.capa1 || capaUnoDe_conjunto([]);
    var s1 = seccionFicha('sp-fi-secc sp-fi-c1', 'Qué clase de afirmaciones trae este registro',
      'Tres preguntas sobre cada hecho que son distintas de quién lo cuenta: qué clase de afirmación es, ' +
      'si mide lo que el Gobierno hizo o lo que cambió en el país, y qué contestó el Gobierno. ' +
      'Nada de esto mueve el veredicto de arriba, y es a propósito: quién cuenta un hecho y qué clase de ' +
      'hecho es son dos ejes, y meterlos en uno deja al módulo sin servir para ninguna de las dos preguntas.');

    function filaC1(titulo, partes, falta, textoFalta) {
      var d = el('div', 'sp-c1-linea');
      d.appendChild(el('b', null, titulo));
      var ul = el('ul', 'sp-c1-lista');
      partes.forEach(function (p) {
        if (!p.n) return;
        var li = el('li', null);
        li.appendChild(el('span', 'sp-c1-n', String(p.n)));
        li.appendChild(el('span', null, p.t));
        ul.appendChild(li);
      });
      if (!ul.childNodes.length) ul.appendChild(el('li', 'sp-c1-falta', 'Ninguno declarado todavía.'));
      d.appendChild(ul);
      if (falta) d.appendChild(el('p', 'sp-c1-falta', falta + ' de ' + c1.n + ' ' + textoFalta));
      return d;
    }

    s1.appendChild(filaC1('Categoría probatoria',
      Object.keys(CATEGORIA_PROBATORIA).map(function (k) {
        return { t: CATEGORIA_PROBATORIA[k].t, n: c1.prueba.por[k] || 0 }; }),
      c1.prueba.sinDeclarar,
      'sin declarar. Un hecho con documento y una afirmación que solo circula no son lo mismo, y hasta ' +
      'que se declare no se pueden separar.'));

    s1.appendChild(filaC1('Qué mide',
      [{ t: TIPO_MEDICION.actividad.t, n: c1.medicion.actividad },
       { t: TIPO_MEDICION.resultado.t, n: c1.medicion.resultado },
       { t: TIPO_MEDICION['contexto-estructural'].t, n: c1.medicion['contexto-estructural'] }],
      c1.medicion.sinDeclarar,
      'sin declarar. Actividad y resultado no se suman nunca: firmar un decreto no es resolver el problema.'));

    s1.appendChild(filaC1('Respuesta del Gobierno',
      [{ t: 'Respondió', n: c1.contra.respondio },
       { t: 'No respondió', n: c1.contra.ausente }],
      c1.contra.sinRevisar,
      'sin revisar. Que el Gobierno no haya respondido es un dato sobre el Gobierno; que nosotros no lo ' +
      'hayamos mirado es una deuda nuestra, y contarlas juntas convertiría la segunda en la primera.'));

    if (c1.prueba.desconocidos || c1.medicion.desconocidos) {
      s1.appendChild(el('p', 'sp-c1-mal',
        (c1.prueba.desconocidos + c1.medicion.desconocidos) +
        ' con un valor que la tabla no conoce. Se ven en la tarjeta con el valor escrito, y no cuentan ' +
        'como declarados: un valor mal escrito que pasara por bueno es peor que uno vacío.'));
    }
    izq.appendChild(s1);

    // ── 1c · Capa 2: los indicadores, por 100 días de gobierno ─────────────
    var ind = indicadoresDe(D, f.corte);
    var s2 = seccionFicha('sp-fi-secc sp-fi-c2', 'Los indicadores, por 100 días de gobierno',
      'Cuentas, no lecturas. Van normalizadas porque comparar un mes contra cuatro años reproduce el ' +
      'error de períodos desiguales que este módulo existe para detectar — y el conteo crudo va al lado, ' +
      'porque una tasa sin su número es tan ciega como un número sin su tasa.');

    var enc = el('p', 'sp-c2-enc');
    enc.appendChild(el('b', null, ind.dias + (ind.dias === 1 ? ' día' : ' días') + ' de gobierno'));
    enc.appendChild(el('span', null, ' · poder predictivo ' + ind.poder.t + '. ' + ind.poder.d));
    s2.appendChild(enc);

    var tb = el('ul', 'sp-c2-tabla');
    ind.filas.forEach(function (fi) {
      var li = el('li', 'sp-c2-fila' + (fi.sinCalcular ? ' sin' : ''));
      li.appendChild(el('span', 'sp-c2-id', fi.id));
      var mid = el('div', 'sp-c2-mid');
      mid.appendChild(el('b', null, fi.t));
      mid.appendChild(el('span', null, fi.d));
      if (fi.sinCalcular) mid.appendChild(el('span', 'sp-c2-razon', 'No se puede calcular todavía: ' + fi.razon));
      li.appendChild(mid);
      var cif = el('div', 'sp-c2-cif');
      if (fi.sinCalcular) cif.appendChild(el('b', null, '—'));
      else {
        cif.appendChild(el('b', null, String(fi.por100).replace('.', ',')));
        cif.appendChild(el('span', null, 'por 100 días'));
        cif.appendChild(el('span', 'sp-c2-crudo', fi.n + ' en total'));
      }
      li.appendChild(cif);

      /* LA MARCA DE NO VALIDADO VA JUNTO A LA CIFRA, no en una nota al pie.
         Un indicador que este proyecto inventó y que no se ha podido correr
         contra ningún gobierno anterior se parece demasiado a una medición
         contrastada, y esa confusión es peor que no tener el indicador. */
      if (fi.validacion && !fi.validacion.validado) {
        var lv = el('li', 'sp-c2-noval');
        lv.appendChild(el('b', null, fi.id + ' · indicador no validado'));
        lv.appendChild(el('span', 'sp-c2-novalc',
          'validado: no · gobiernos anteriores probados: ' + fi.validacion.gobiernosAnterioresProbados));
        lv.appendChild(el('p', 'sp-c2-novalg' + (fi.validacion.urge ? ' urge' : ''),
          fi.validacion.gravedad + ' · ' + fi.validacion.porQue));
        lv.appendChild(el('p', null, fi.validacion.razon));
        lv.appendChild(el('p', null,
          'La marca se quita sola el día que este criterio se pueda correr contra el registro clasificado ' +
          'de un gobierno anterior y no dispare: ahí sí distingue.'));
        tb.appendChild(lv);
      }
      tb.appendChild(li);

      /* EL CRITERIO, DEBAJO DE SU CIFRA. Va acá y no en una nota de pie
         porque es lo que convierte el número en algo discutible: con la
         definición y las dos listas a la vista, quien no esté de acuerdo
         discute el criterio en vez de discutir el caso. */
      if (fi.criterio) {
        var lc = el('li', 'sp-c2-crit');
        lc.appendChild(el('b', null, 'Qué cuenta como ' + fi.t.toLowerCase()));
        lc.appendChild(el('p', null, fi.criterio.definicion));
        [['Incluye', fi.criterio.incluye, 'si'], ['No incluye', fi.criterio.excluye, 'no']].forEach(function (par) {
          var dv = el('div', 'sp-c2-lista sp-c2-' + par[2]);
          dv.appendChild(el('span', null, par[0]));
          var ul = el('ul', null);
          par[1].forEach(function (x) {
            var li2 = el('li', null, x);
            /* POR CUÁL renglón entró cada hecho contado. Con seis vías y una
               sola cifra, «tres mecanismos excepcionales» no dice si son tres
               clases distintas o la misma tres veces — y eso cambia lo que
               significa. */
            var n = par[2] === 'si' ? (fi.porVia[x] || 0) : 0;
            if (n) li2.appendChild(el('b', 'sp-c2-via', n === 1 ? '1 hecho' : n + ' hechos'));
            ul.appendChild(li2);
          });
          dv.appendChild(ul);
          lc.appendChild(dv);
        });
        if (fi.n && fi.vias.length === 1 && fi.n > 1) {
          lc.appendChild(el('p', 'sp-c2-unavia', 'Los ' + fi.n + ' entran por el mismo renglón del criterio. ' +
            'No es un defecto, pero conviene saberlo: la cifra mide una sola clase de acto, no la variedad ' +
            'que el criterio describe.'));
        }
        /* Y lo declarado que el criterio NO deja contar. El motor de
           referencia lo filtra en silencio; acá se dice, porque un conteo que
           baja sin decir por qué se lee como que el hecho no ocurrió. */
        if (fi.fuera.length) {
          var fb = el('div', 'sp-c2-fuera');
          fb.appendChild(el('b', null, 'Declaradas ' + fi.declaradas + ' · cuentan ' + fi.n + ' · ' +
            fi.fuera.length + (fi.fuera.length === 1 ? ' no cumple el criterio' : ' no cumplen el criterio')));
          var uf = el('ul', null);
          fi.fuera.forEach(function (x) {
            var lf = el('li', null);
            lf.appendChild(el('span', null, x.titulo));
            lf.appendChild(el('b', null, x.d));
            uf.appendChild(lf);
          });
          fb.appendChild(uf);
          fb.appendChild(el('p', null, 'El hecho está en el registro y se lee en la línea de tiempo. Lo que ' +
            'no hace es contar en este indicador, y por eso se dice cuál es y qué le falta: un conteo que ' +
            'baja sin decir por qué se lee como que el hecho no ocurrió.'));
          lc.appendChild(fb);
        }
        tb.appendChild(lc);
      }
    });
    s2.appendChild(tb);

    /* LA COBERTURA DE LA GUARDA DE ROL. Una comprobación que no puede correr
       lo dice y se cuenta; si no, su exención se lee como que pasó. Van los
       casos por su nombre porque son pocos y porque el lector tiene que
       poder ir a mirar cuál es. */
    var cr = ind.coberturaRol || { n: 0, casos: [] };
    if (cr.n) {
      var cx = el('div', 'sp-c2-cober' + (cr.sinCorrer ? ' falta' : ''));
      cx.appendChild(el('b', null, 'Procedencia de las fuentes: comprobada en ' + cr.corrio +
        ' de ' + cr.n + (cr.n === 1 ? ' entrada' : ' entradas') + ' que declaran indicador'));
      cx.appendChild(el('p', null, cr.sinCorrer
        ? 'En ' + cr.sinCorrer + (cr.sinCorrer === 1 ? ' la comprobación NO pudo correr' :
           ' la comprobación NO pudo correr') + ', y eso no es que haya pasado. Cada una dice por qué:'
        : 'La comprobación corrió sobre todas: cada una tiene al menos una fuente que documenta el acto.'));
      var ul = el('ul', 'sp-c2-coberl');
      cr.casos.forEach(function (c) {
        if (c.estado === 'ok') return;
        var li = el('li', null);
        li.appendChild(el('b', null, c.fecha + ' · ' + c.t));
        li.appendChild(el('span', null, ' ' + c.titulo));
        li.appendChild(el('p', null, c.d));
        ul.appendChild(li);
      });
      if (ul.childNodes.length) cx.appendChild(ul);
      s2.appendChild(cx);
    }

    /* Los tres declarados son los del eje B, y sin declarar no cuentan. Se
       dice cuántas entradas no declaran ninguno: sin ese renglón, un I-04 de
       seis se lee como «el Gobierno usó seis mecanismos excepcionales» cuando
       lo que consta es que seis están declarados y 161 sin revisar. */
    if (ind.sinDeclarar) {
      s2.appendChild(el('p', 'sp-c2-pend',
        ind.sinDeclarar + ' de ' + ind.hechos + ' hechos no declaran qué indicador alimentan. Los tres de arriba ' +
        'que se declaran —mecanismos excepcionales, choques con órganos autónomos e información obtenida por ' +
        'tutela— cuentan solo lo declarado: decidir que un hecho es un choque con un órgano autónomo es una ' +
        'lectura sobre un gobierno real, y este módulo no la deduce del texto.'));
    }

    /* Y la comparación con el gobierno anterior, que es justamente la que NO
       se publica. Va acá y no escondida, porque el pliego manda publicar la
       marca de la falla: callarla dejaría la tasa de arriba pareciendo
       comparable con cualquier cosa. */
    if (DA) {
      var cmp = comparabilidad(D, DA);
      if (!cmp.comparable) {
        var cb = el('div', 'sp-c2-nocomp');
        cb.appendChild(el('b', null, 'Esta tasa NO se compara con la del gobierno anterior'));
        cb.appendChild(el('p', null, cmp.texto));
        s2.appendChild(cb);
      }
    }
    izq.appendChild(s2);

    // ── 1d · Capa 3: los tres ejes, lado a lado ────────────────────────────
    var s3 = seccionFicha('sp-fi-secc sp-fi-c3', 'Los tres ejes, lado a lado',
      'Confiabilidad, deterioro institucional y orientación del gasto. Van separados y NUNCA combinados ' +
      'en un número único, y eso no es una preferencia de diseño: un gobernante puede ser muy sincero ' +
      'sobre su intención de concentrar poder —confiabilidad alta, deterioro alto— y puede mentir mucho ' +
      'sin tocar una sola institución. Metidos en la misma escala, el módulo deja de servir para ' +
      'cualquiera de las dos preguntas.');

    var ejes = ejesDe(D, f.corte);
    var ul3 = el('ul', 'sp-c3-lista');
    ejes.forEach(function (ej) {
      var li = el('li', 'sp-c3-eje' + (ej.publicable ? '' : ' sin'));
      var cab = el('div', 'sp-c3-cab');
      cab.appendChild(el('span', 'sp-c3-letra', 'Eje ' + ej.eje));
      var tit = el('div', null);
      tit.appendChild(el('b', null, ej.t));
      tit.appendChild(el('span', 'sp-c3-preg', ej.pregunta));
      cab.appendChild(tit);
      /* El nivel, o el hueco donde iría. Un eje sin nivel se pinta con el
         hueco marcado y no se calla: callarlo dejaría la sección con dos
         ejes donde el pliego anuncia tres. */
      cab.appendChild(el('b', 'sp-c3-nivel', ej.publicable ? (ej.nivel.id + ' · ' + ej.nivel.t) : 'sin nivel'));
      li.appendChild(cab);

      if (ej.eje === 'A' && ej.documentadas !== undefined) {
        li.appendChild(el('p', 'sp-c3-dato',
          ej.documentadas + ' contradicciones documentadas · ' + ej.conIdentidad + ' con identidad de objeto · ' +
          ej.sinIdentidad + ' como tensión retórica · ' + ej.sinDeclarar + ' sin declarar'));
      }
      if (ej.eje === 'B' && ej.filas) {
        var ub = el('ul', 'sp-c3-ind');
        ej.filas.forEach(function (fi) {
          var lb = el('li', null);
          lb.appendChild(el('span', null, fi.id + ' · ' + fi.t));
          lb.appendChild(el('b', null, fi.sinCalcular ? '—' : (String(fi.por100).replace('.', ',') + ' / 100 d')));
          ub.appendChild(lb);
        });
        li.appendChild(ub);
      }
      if (!ej.publicable) {
        var fa = el('p', 'sp-c3-falta');
        fa.appendChild(el('b', null, 'Falta para poder publicarlo: '));
        fa.appendChild(document.createTextNode(ej.falta));
        li.appendChild(fa);
      }
      if (ej.lectura) li.appendChild(el('p', 'sp-c3-lect', ej.lectura));
      ul3.appendChild(li);
    });
    s3.appendChild(ul3);

    /* Y la frase que separa esta sección del veredicto de arriba. Sin ella,
       tres ejes sin nivel debajo de una escalera con nivel se leen como si la
       escalera fuera el resumen de los tres, que es justo lo que la regla de
       oro prohíbe. */
    s3.appendChild(el('p', 'sp-c3-pie',
      'Ninguno de los tres ejes alimenta el veredicto de arriba, y el veredicto no es su promedio. La ' +
      'escalera de fiabilidad sale de los casos, las contradicciones y el registro verificado; estos ejes ' +
      'son la lectura que el pliego del módulo define, y hoy ninguno tiene con qué publicar un nivel.'));
    izq.appendChild(s3);

    // ── 1e · Capa 4: el marco declarado, el editorial y el control ─────────
    var mar = marcoDeclarado(D);
    var s4 = seccionFicha('sp-fi-secc sp-fi-c4', 'El marco de este módulo, declarado',
      'Elegir qué se rastrea ya es una decisión de valores. Eso es inevitable y no es un defecto; lo que ' +
      'sí sería un defecto es esconderlo. Un marco declarado es más defendible que una neutralidad falsa: ' +
      'el lector puede discrepar del marco y seguir usando los datos.');

    var dosCol = el('div', 'sp-c4-marco');
    [['Qué mide este módulo', mar.mide, 'si'], ['Qué NO mide', mar.noMide, 'no']].forEach(function (par) {
      var col = el('div', 'sp-c4-col sp-c4-' + par[2]);
      col.appendChild(el('b', null, par[0]));
      var u = el('ul', null);
      par[1].forEach(function (x) { u.appendChild(el('li', null, x)); });
      col.appendChild(u);
      dosCol.appendChild(col);
    });
    s4.appendChild(dosCol);

    if (mar.supuestos.length) {
      var sb = el('div', 'sp-c4-sup');
      sb.appendChild(el('b', null, 'Supuestos de valor declarados' +
        (mar.autor ? ' · ' + mar.autor : '') + (mar.fecha ? ' · ' + fechaLarga(mar.fecha) : '')));
      var us = el('ul', null);
      mar.supuestos.forEach(function (x) { us.appendChild(el('li', null, x)); });
      sb.appendChild(us);
      s4.appendChild(sb);
    } else {
      s4.appendChild(el('p', 'sp-c4-falta', mar.falta));
    }

    /* El editorial, en su propia caja y rotulado como opinión ANTES del
       texto. El pliego lo pide así y la razón es de lectura: un párrafo de
       opinión debajo de treinta cifras se lee como una cifra más si el
       rótulo llega después. */
    var ed = editorialDe(D);
    var eb = el('div', 'sp-c4-edi' + (ed.hay ? '' : ' sin'));
    eb.appendChild(el('span', 'sp-c4-rot', 'Opinión, no cálculo'));
    if (!ed.hay) {
      eb.appendChild(el('b', null, ed.t));
      eb.appendChild(el('p', null, ed.d));
    } else {
      eb.appendChild(el('b', null, (ed.autor || 'Sin autor declarado') +
        (ed.fecha ? ' · ' + fechaLarga(ed.fecha) : ' · sin fecha')));
      eb.appendChild(el('p', null, ed.texto));
      if (!ed.firmado) eb.appendChild(el('p', 'sp-c4-falta', 'Esta opinión está sin firmar. El pliego exige ' +
        'autor y fecha visibles: una opinión sin firma no se puede defender ni discutir.'));
      if (ed.apoyos.length) {
        var ua = el('ul', 'sp-c4-apoyos');
        ed.apoyos.forEach(function (a) {
          var la = el('li', a.flojo ? 'flojo' : null);
          la.appendChild(el('span', null, a.hallado ? a.titulo : ('(no se encontró: ' + a.ref + ')')));
          if (a.flojo) la.appendChild(el('b', null, 'se apoya en ' + a.clase.t.toLowerCase()));
          ua.appendChild(la);
        });
        eb.appendChild(ua);
      }
    }
    eb.appendChild(el('p', 'sp-c4-pie',
      'Esta sección no alimenta ningún cálculo de las anteriores, y ningún registro la cita como fuente.'));
    s4.appendChild(eb);

    /* El control de calidad del pliego: «si algún casillero falla, el módulo
       publica el resultado CON la marca de la falla visible». */
    var cc = controlDeCalidad(D, f.corte);
    var cb2 = el('div', 'sp-c4-cc');
    cb2.appendChild(el('b', null, 'Control de calidad del pliego · ' + cc.pasan + ' pasan · ' +
      cc.falla + ' fallan · ' + cc.sinCorrer + ' no se pueden correr'));
    var uc = el('ul', 'sp-c4-cclista');
    cc.filas.forEach(function (fi) {
      var li = el('li', 'cc-' + fi.estado);
      li.appendChild(el('span', 'sp-c4-ccm', fi.estado === 'pasa' ? '✓' : fi.estado === 'falla' ? '✕' : '?'));
      var d2 = el('div', null);
      d2.appendChild(el('span', null, fi.t));
      d2.appendChild(el('span', 'sp-c4-ccd', fi.det));
      li.appendChild(d2);
      uc.appendChild(li);
    });
    cb2.appendChild(uc);
    cb2.appendChild(el('p', 'sp-c4-pie',
      'El módulo no espera a estar limpio para publicar: publica con la marca de lo que falla. Un casillero ' +
      'que no se pudo correr se dice como tal — darlo por bueno sería el error que este módulo persigue.'));
    s4.appendChild(cb2);
    izq.appendChild(s4);

    // ── 2 · Casos de corrupción ────────────────────────────────────────────
    var sc = seccionFicha('sp-fi-secc', 'Casos de corrupción',
      'Atribuidos al gobernante o a su gobierno, con su estado probatorio. Pesan los confirmados y, ' +
      'menos, los que una autoridad tiene en investigación; un señalamiento y un caso que una autoridad ' +
      'ya archivó se muestran con su etiqueta y no mueven el veredicto. Las denuncias del Gobierno ' +
      'contra la administración anterior no son casos suyos: están en la línea de tiempo. Y una decisión ' +
      'de nivel municipal, distrital o departamental se muestra entera y tampoco pesa: este veredicto es ' +
      'de un gobierno nacional.');
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
    /* Lo que la cuenta del veredicto dejó fuera, y lo que todavía no declara
       de dónde es. Las dos cifras van acá y no en una nota escrita a mano: un
       conteo tecleado dentro de una frase fija es una cifra que envejece sola
       —es lo que la v903 corrigió en el pliego— y acá diría cuántos casos
       pesan sobre una persona real. */
    if (f.casos.fueraPorNivel || f.casos.sinNivel) {
      var av = el('p', 'sp-fi-nivelaviso');
      if (f.casos.fueraPorNivel) {
        av.appendChild(el('b', null, f.casos.fueraPorNivel === 1
          ? 'Un caso con consecuencia queda fuera de la cuenta por su nivel de gobierno. '
          : f.casos.fueraPorNivel + ' casos con consecuencia quedan fuera de la cuenta por su nivel de gobierno. '));
        av.appendChild(document.createTextNode(
          'Se muestran enteros, arriba, con su estado probatorio y con la razón escrita en cada tarjeta. '));
      }
      if (f.casos.sinNivel) {
        av.appendChild(document.createTextNode((f.casos.sinNivel === 1
          ? 'Un caso que pesa todavía no declara su nivel de gobierno'
          : f.casos.sinNivel + ' casos que pesan todavía no declaran su nivel de gobierno') +
          ': se cuenta como hasta ahora, y se dice acá en vez de suponerle uno.'));
      }
      sc.appendChild(av);
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
          var fila = el('div', 'sp-consulta-fila' + (ya === o.k ? ' suyo' : ''));
          var cab = el('div', 'sp-consulta-cab');
          cab.appendChild(el('b', null, o.t + (ya === o.k ? ' · su voto' : '')));
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
            ? 'Su voto quedó guardado en este dispositivo, pero aún no se pudo sincronizar el total.'
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
      'Toque cualquiera para ver la gráfica completa, su fuente y qué la explica.'));
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
      d.appendChild(el('p', null, 'Revise su conexión y vuelva a intentar. (' + e.message + ')'));
      var b = el('button', 'sp-btn sp-btn-solid', 'Reintentar'); b.type = 'button';
      b.addEventListener('click', function () { location.reload(); });
      d.appendChild(b);
      m.appendChild(d);
    });
})();
