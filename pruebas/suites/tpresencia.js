const E = require('../entorno.js');
/* PRESENCIA: dónde están mis amigos, y con qué permiso.

   Hasta la v811 la ubicación de los amigos la escribía en silencio un
   «radar» que arrancaba con cualquier pantalla de mapa, y pintaba a TODOS
   los que alguna vez compartieron, con la fila que hubiera, aunque tuviera
   73 días. Esta suite fija las tres reglas del módulo que lo reemplaza:

   · nadie comparte sin encender el interruptor, y apagarlo queda escrito;
   · solo se pinta a los amigos MUTUOS que comparten AHORA (fila «on», de
     hace menos de 24 h); los demás se listan con su motivo, no se esconden;
   · la posición viaja con su precisión y su antigüedad.

   Corre sobre una página desnuda con Leaflet de verdad y el módulo solo:
   las dependencias (usuario, filas, GPS, escritura) se inyectan, que es la
   única manera de saber qué escribió y cuándo.                          */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO, LEAFLET = S + 'node_modules/leaflet/dist/';
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 500, height: 700 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));
  await pg.setContent('<style>' + fs.readFileSync(LEAFLET + 'leaflet.css', 'utf8') +
    fs.readFileSync(REPO + '/css/78-presencia.css', 'utf8') +
    '#m{width:480px;height:480px}</style><div id="m"></div><div class="u52-amigos-card"></div>');
  await pg.addScriptTag({ path: LEAFLET + 'leaflet.js' });
  await pg.addScriptTag({ path: REPO + '/js/78-presencia.js' });

  // ── El escenario ───────────────────────────────────────────────────────
  // yo=«yo». ana: amiga mutua, compartiendo hace 2 min con ±12 m.
  // beto: NO es amigo (relación de un solo lado), compartiendo hace 1 min.
  // carla: amiga mutua, última fila hace 73 días (formato viejo: solo usuario).
  // dani: amigo mutuo, apagó hace 3 min.
  // eli: amiga mutua, hace 40 min (reciente, no viva).
  const esc = await pg.evaluate(() => {
    const AHORA = Date.UTC(2026, 8, 8, 12, 0, 0);
    window.__ahora = AHORA;
    window.__escritas = [];
    window.map = L.map('m', { zoomControl: false }).setView([7.89, -72.50], 15);
    const rel = (a, b) => ({ tipo: '🤝 Relacion', lat: '0', lng: '0', descripcion: a + '~~~' + b + '~~~amigo' });
    window.urbisRelaciones = [rel('yo', 'ana'), rel('ana', 'yo'), rel('yo', 'beto'), rel('yo', 'carla'), rel('carla', 'yo'),
                              rel('yo', 'dani'), rel('dani', 'yo'), rel('yo', 'eli'), rel('eli', 'yo')];
    const fila = (u, lat, lng, minAtras, desc) => ({ tipo: 'ubicacion_' + u, lat: String(lat), lng: String(lng),
      descripcion: desc, fecha: new Date(AHORA - minAtras * 60000).toISOString() });
    window.urbisUbicaciones = [
      fila('ana', 7.8912, -72.5011, 2, 'ana~~~12~~~on'),
      fila('ana', 7.8900, -72.5000, 30, 'ana~~~40~~~on'),          // una fila más vieja de ana: no debe ganar
      fila('beto', 7.8920, -72.5020, 1, 'beto~~~8~~~on'),
      fila('carla', 7.8930, -72.5030, 73 * 24 * 60, 'carla'),        // formato viejo
      fila('dani', 7.8940, -72.5040, 3, 'dani~~~15~~~off'),
      fila('eli', 7.8950, -72.5050, 40, 'eli~~~25~~~on')
    ];
    URBIS_PRESENCIA.configurar({
      ahora: () => window.__ahora,
      usuario: () => 'yo',
      amigosServidor: () => null,
      avatarDe: u => u === 'ana' ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : '',
      actualizar: (tipo, campos) => { window.__escritas.push({ via: 'update', tipo, campos }); return Promise.resolve({ ok: true, updated: 1 }); },
      crear: fila => { window.__escritas.push({ via: 'create', fila }); return Promise.resolve({ ok: true }); },
      leerTodo: () => Promise.resolve([]),
      guardar: v => { window.__guardado = v; },
      cargar: () => window.__guardado || null
    });
    const lista = URBIS_PRESENCIA.ver();
    const vis = lista.filter(a => a.visible).map(a => a.usuario);
    const marcas = document.querySelectorAll('#m .urb-pres-marca');
    const circulos = document.querySelectorAll('#m path.urb-pres-precision');
    const ana = lista.find(a => a.usuario === 'ana');
    const chip = document.getElementById('urbis-presencia-chip');
    return {
      amigos: URBIS_PRESENCIA.amigos().sort(),
      orden: lista.map(a => a.usuario + (a.visible ? '' : '(' + a.motivo + ')')),
      vis, nMarcas: marcas.length, nCirculos: circulos.length,
      clases: Array.from(marcas).map(m => m.className),
      anaFila: ana && ana.fila ? { lat: ana.fila.lat, acc: ana.fila.acc, ms: ana.fila.ms, estado: ana.fila.estado } : null,
      anaFresca: ana && ana.frescura,
      motivos: lista.filter(a => !a.visible).map(a => a.usuario + ': ' + a.motivo),
      chipTxt: chip ? chip.textContent.replace(/\s+/g, ' ') : '',
      chipItems: chip ? chip.querySelectorAll('li').length : -1,
      radioCirculo: (function () { const c = URBIS_PRESENCIA.capa; let r = null; c.eachLayer(l => { if (l instanceof L.Circle) r = l.getRadius(); }); return r; })(),
      zoom: map.getZoom(), centro: map.getCenter()
    };
  });
  console.log('\n── Quién se ve y quién no ───────────────────────────────────');
  console.log('  amigos mutuos: ' + esc.amigos.join(', '));
  console.log('  ' + esc.orden.join(' · '));
  chk(esc.amigos.join(',') === 'ana,carla,dani,eli', 'beto, con relación de un solo lado, no es amigo mutuo');
  chk(esc.vis.join(',') === 'ana,eli', 'solo se ven los amigos que comparten ahora: ana y eli (' + esc.vis.join(', ') + ')');
  chk(esc.nMarcas === 2 && esc.nCirculos === 2, 'dos marcadores y dos círculos de precisión en el mapa, ni uno más');
  chk(!!esc.anaFila && Math.abs(esc.anaFila.lat - 7.8912) < 1e-6 && esc.anaFila.acc === 12,
      'de ana gana la fila más reciente, con su precisión (±' + (esc.anaFila || {}).acc + ' m)');
  chk(esc.radioCirculo === 12 || esc.radioCirculo === 25, 'el círculo de precisión mide lo que dijo el GPS');
  chk(esc.anaFresca === 'vivo' && esc.clases.some(c => /f-vivo/.test(c)) && esc.clases.some(c => /f-reciente/.test(c)),
      'la frescura va en el marcador: ana en línea, eli de la última hora');
  chk(esc.motivos.some(m => /carla: sin ubicación reciente \(hace 73 días\)/.test(m)),
      'carla no se pinta, y se dice por qué: su última posición tiene 73 días');
  chk(esc.motivos.some(m => /dani: dejó de compartir/.test(m)), 'dani apagó: «dejó de compartir», no un punto viejo');
  chk(!esc.orden.some(o => /beto/.test(o)), 'y beto no aparece ni en la lista: no es amigo mutuo');
  chk(esc.chipItems === 2 && /2 amigos en el mapa/.test(esc.chipTxt) && /carla/.test(esc.chipTxt) && /Tú no estás compartiendo/.test(esc.chipTxt),
      'la ficha sobre el mapa cuenta los visibles, lista los motivos de los demás y avisa que yo no comparto');
  chk(esc.zoom <= 16, 'el mapa se encuadra en los amigos visibles');

  // ── Compartir: solo con el interruptor, y con criterio ────────────────
  const comp = await pg.evaluate(async () => {
    const out = {};
    // GPS fingido: la prueba decide qué posición «llega».
    window.__geoCbs = [];
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition: (cb) => { window.__geoCbs.push(cb); return window.__geoCbs.length; },
      clearWatch: (id) => { window.__geoClear = (window.__geoClear || 0) + 1; }
    }, configurable: true });
    const llega = (lat, lng, acc) => window.__geoCbs.forEach(cb => cb({ coords: { latitude: lat, longitude: lng, accuracy: acc } }));
    const esperar = () => new Promise(r => setTimeout(r, 30));

    // Sin encender: reanudar no hace nada.
    out.reanudoSinPermiso = URBIS_PRESENCIA.reanudar();
    out.escritasAntes = window.__escritas.length;
    out.watchesAntes = window.__geoCbs.length;

    const r = URBIS_PRESENCIA.compartir(60);
    out.encendio = r.ok;
    out.guardado = window.__guardado;
    llega(7.8891, -72.4967, 9); await esperar();
    out.trasPrimera = window.__escritas.length;
    out.primera = window.__escritas[window.__escritas.length - 1];
    window.__ahora += 5000;  llega(7.88912, -72.4967, 9); await esperar();     // 2 m y 5 s después: no
    out.trasCerca = window.__escritas.length;
    window.__ahora += 20000; llega(7.8895, -72.4967, 11); await esperar();     // 45 m: sí
    out.trasLejos = window.__escritas.length;
    window.__ahora += 25000; llega(7.8895, -72.4967, 11); await esperar();     // quieto, 25 s: no
    out.trasQuieto = window.__escritas.length;
    window.__ahora += 95000; llega(7.8895, -72.4967, 11); await esperar();     // quieto pero pasó minuto y medio: sí
    out.trasTiempo = window.__escritas.length;
    out.tarjetaOn = (document.getElementById('urbis-presencia-tarjeta') || {}).className || '';
    out.tarjetaTxt = (document.getElementById('urbis-presencia-tarjeta') || {}).textContent || '';
    const fin = URBIS_PRESENCIA.dejarDeCompartir('apagado'); await fin; await esperar();
    out.trasApagar = window.__escritas.length;
    out.ultima = window.__escritas[window.__escritas.length - 1];
    out.guardadoFinal = window.__guardado;
    out.clears = window.__geoClear || 0;
    out.tarjetaOff = (document.getElementById('urbis-presencia-tarjeta') || {}).className || '';
    // Con el interruptor apagado, reanudar sigue sin hacer nada; encendido y vencido, tampoco.
    out.reanudoApagado = URBIS_PRESENCIA.reanudar();
    window.__guardado = { activo: true, hasta: window.__ahora - 1000 };
    out.reanudoVencido = URBIS_PRESENCIA.reanudar();
    out.escritasFinal = window.__escritas.length;
    // Y la propia fila «yo» quedó en la caché local como «off».
    const mia = URBIS_PRESENCIA.ultimaPorUsuario().yo;
    out.miaEstado = mia && mia.estado;
    return out;
  });
  console.log('\n── Compartir ───────────────────────────────────────────────');
  console.log('  escrituras: 1ª ' + comp.trasPrimera + ' · cerca ' + comp.trasCerca + ' · lejos ' + comp.trasLejos +
              ' · quieto ' + comp.trasQuieto + ' · tiempo ' + comp.trasTiempo + ' · apagar ' + comp.trasApagar);
  chk(comp.reanudoSinPermiso === false && comp.escritasAntes === 0 && comp.watchesAntes === 0,
      'sin encender el interruptor no se toca el GPS ni se escribe nada: el radar silencioso se acabó');
  chk(comp.encendio && comp.guardado && comp.guardado.activo && comp.guardado.hasta > 0, 'encender guarda el permiso con su vencimiento');
  chk(comp.trasPrimera === 1 && comp.primera.via === 'update' && /^ubicacion_yo$/.test(comp.primera.tipo),
      'la primera posición se escribe, actualizando la fila única del usuario');
  chk(/^yo~~~9~~~on$/.test((comp.primera.campos || {}).descripcion || ''), 'con la precisión del GPS y el estado en la descripción (' + (comp.primera.campos || {}).descripcion + ')');
  chk(comp.trasCerca === 1, 'moverse 2 m no escribe otra vez');
  chk(comp.trasLejos === 2, 'moverse 45 m sí');
  chk(comp.trasQuieto === 2, 'quedarse quieto 25 s no');
  chk(comp.trasTiempo === 3, 'pero minuto y medio quieto sí, para que «hace cuánto» sea verdad');
  chk(/\bon\b/.test(comp.tarjetaOn) && /Compartiendo tu ubicación/.test(comp.tarjetaTxt) && /última posición enviada/.test(comp.tarjetaTxt),
      'la tarjeta de Amigos dice que se está compartiendo y cuándo fue la última posición');
  chk(comp.trasApagar === 4 && /~~~off$/.test((comp.ultima.campos || {}).descripcion || '') && comp.clears >= 1,
      'apagar deja escrito «off» y suelta el GPS');
  chk(comp.guardadoFinal && comp.guardadoFinal.activo === false && !/\bon\b/.test(comp.tarjetaOff), 'y el permiso queda apagado en la tarjeta y en el guardado');
  chk(comp.reanudoApagado === false && comp.reanudoVencido === false && comp.escritasFinal === 4,
      'reanudar con el permiso apagado o vencido no enciende nada');
  chk(comp.miaEstado === 'off', 'mi propia fila queda «off» en la caché local, para que el mapa no me pinte como si siguiera');

  // ── Leer filas viejas y nuevas ───────────────────────────────────────
  const lf = await pg.evaluate(() => {
    const a = URBIS_PRESENCIA.leerFila({ descripcion: 'Carla', lat: '7,8', lng: '-72,5', fecha: '2026-06-27T12:00:00Z' });
    // La antigüedad se mide contra el reloj inyectado, que la prueba de
    // compartir ya adelantó: se compara con él y no con un número fijo.
    const b = URBIS_PRESENCIA.leerFila({ descripcion: 'ana~~~12~~~on', lat: '7.8', lng: '-72.5', fecha: '2026-09-08T11:58:00Z' });
    const c = URBIS_PRESENCIA.leerFila({ descripcion: 'x§7§off', lat: '0', lng: '0', fecha: '' });
    return { a, b, c, esperadoMs: window.__ahora - Date.parse('2026-09-08T11:58:00Z') };
  });
  chk(lf.a.usuario === 'carla' && lf.a.acc === 0 && lf.a.estado === 'on' && lf.a.valida && Math.abs(lf.a.lat - 7.8) < 1e-9,
      'una fila del formato viejo (solo usuario, coma decimal) se lee igual');
  chk(lf.b.acc === 12 && lf.b.estado === 'on' && lf.b.ms === lf.esperadoMs, 'y una nueva trae precisión, estado y antigüedad');
  chk(lf.c.estado === 'off' && !lf.c.valida, 'el separador § viejo también se entiende, y 0,0 no es una posición');

  // Quitar limpia todo.
  const q = await pg.evaluate(() => { URBIS_PRESENCIA.quitar(); return { marcas: document.querySelectorAll('#m .urb-pres-marca').length, chip: document.getElementById('urbis-presencia-chip').hidden, activa: URBIS_PRESENCIA.activa }; });
  chk(q.marcas === 0 && q.chip && !q.activa, 'quitar la capa deja el mapa limpio y esconde la ficha');
  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
