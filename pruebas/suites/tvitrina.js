const E = require('../entorno.js');
/* La vitrina, por invitación.

   El dueño de URBIS lo pidió así para esta etapa: el módulo de
   emprendimientos lo ven y lo usan solo los administradores; el
   administrador crea cada emprendimiento y le entrega el control a la
   persona del negocio, que desde entonces edita SOLO el suyo. La gota en el
   mapa y su ficha siguen siendo públicas: son el escaparate, no el módulo.

   Tres personas, mismas filas:

   · Una vecina sin permiso: no ve la tarjeta, no puede abrir la pantalla,
     y sí ve la gota y su ficha —que es para lo que existe la vitrina—.
   · La misma vecina con el emprendimiento entregado (tiene el permiso y su
     usuario está en la ficha): ve la tarjeta como «Mi emprendimiento», en
     el mostrador aparece SOLO el suyo, sin crear, sin publicar, sin borrar,
     y al editar no puede cambiar quién lo administra. Lo que guarda conserva
     al dueño.
   · El administrador: la tarjeta, el mostrador completo, el campo de quién
     lo administra, y al asignarlo desde la cuenta dueña de URBIS se le da
     el permiso por la API — porque sin él el servidor le rechazaría cada
     escritura, y un dueño sin permiso es un botón que falla.               */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const S = E.TRABAJO;
const LEAFLET = S + 'node_modules/leaflet/dist/';
const C = { lat: 7.8939, lng: -72.5078 };
const ahora = new Date().toISOString();

// Dos negocios visibles: uno con dueña asignada, otro sin nadie.
function negocio(id, nombre, lat, extra) {
  const o = Object.assign({ id, nombre, emoji: '💈', lema: 'Cortes en Atalaya', descripcion: 'Barbería',
    telefono: '3001112233', whatsapp: '3001112233', direccion: 'Cra 5 #12-34', horario: '9-7',
    color: '#E5B300', estado: 'visible' }, extra || {});
  return { tipo: '🛍️ Emprendimiento URBIS', lat: String(lat), lng: String(C.lng),
           descripcion: 'VITRINA_URBIS:' + encodeURIComponent(JSON.stringify(o)), fecha: ahora };
}
const FILAS = [
  negocio('a1', 'Barbería Don Luis', C.lat, { duenio: 'vecina' }),
  negocio('b2', 'Taller Pepe', C.lat + 0.001, { emoji: '🔧' })
];

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });

  async function abrirCon(sesion) {
    const ctx = await b.newContext({ serviceWorkers: 'block', timezoneId: 'America/Bogota', locale: 'es-CO',
      viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript((s) => {
      if (window.top !== window) return;
      try { localStorage.setItem('urbis_auth_session_v1', JSON.stringify(s)); localStorage.removeItem('urbis_db_cache_v1'); } catch (e) {}
    }, sesion);
    await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
    await ctx.route(/unpkg\.com/, r => { const u = r.request().url();
      r.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript',
        body: fs.readFileSync(LEAFLET + (u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js'), 'utf8') }); });
    await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
      body: fs.readFileSync(S + 'node_modules/chart.js/dist/chart.umd.js', 'utf8') }));
    await ctx.route(/basemaps\.cartocdn\.com|arcgisonline\.com|maptiles\.arcgis\.com|mt\d\.google\.com\/vt/,
      r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
    await ctx.route(/script\.google\.com/, r => {
      const cuerpo = r.request().postData() || '';
      if (/db_read/.test(cuerpo) || !cuerpo) {
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: FILAS }) });
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":[]}' });
    });
    const pg = await ctx.newPage();
    const err = []; pg.on('pageerror', e => err.push(String(e.message).slice(0, 140)));
    await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
    await E.esperarLaApp(pg, 30000).catch(() => {});
    await pg.evaluate(async () => {
      const esperar = ms => new Promise(x => setTimeout(x, ms));
      if (typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos();
      await esperar(2500);
      // La tarjeta y la pantalla se montan dos segundos después del arranque
      // y se repintan con el DOM: se les da tiempo y se llama al vigía.
      if (window.urbisRenderVitrina) window.urbisRenderVitrina();
      await esperar(1200);
    });
    return { ctx, pg, err };
  }
  const errores = [];

  // ── 1 · La vecina, sin permiso ───────────────────────────────────────
  console.log('\n── La vecina sin permiso ───────────────────────────');
  {
    const { ctx, pg, err } = await abrirCon({ usuario: 'vecina', rol: 'citizen', session_token: 't', active: true, verified: true });
    const r = await pg.evaluate(async () => {
      const esperar = ms => new Promise(x => setTimeout(x, ms));
      const o = {};
      o.puedeVer = typeof window.urbisPuedeVerVitrina === 'function' ? window.urbisPuedeVerVitrina() : '(sin función)';
      o.tarjeta = !!document.querySelector('.u52-module.vitrina');
      o.abre = typeof window.urbisIrAPantalla === 'function' ? window.urbisIrAPantalla('vitrina') : '(sin función)';
      o.pantalla = (document.querySelector('.u52-screen.active') || {}).getAttribute ? document.querySelector('.u52-screen.active').getAttribute('data-u52-screen') : '';
      // Las gotas y la ficha pública, que no son el módulo.
      /* Contadas por su id de Leaflet: una gota puede estar a la vez en el
         mapa y dentro de la capa de la vitrina, y sumarla dos veces diría
         que hay cuatro negocios donde hay dos. */
      const vistas = new Set();
      const rec = (capa, prof) => {
        try {
          capa.eachLayer && capa.eachLayer(h => {
            const ic = h.options && h.options.icon && h.options.icon.options;
            if (ic && /urbis-vitrina-root/.test(String(ic.className || ''))) vistas.add(h._leaflet_id);
            if (prof < 3) rec(h, prof + 1);
          });
        } catch (e) {}
      };
      rec(window.map, 0);
      o.gotas = vistas.size;
      try { window.urbisAbrirVitrina('b2'); } catch (e) { o.errFicha = e.message; }
      await esperar(400);
      const ficha = document.getElementById('urbis-vitrina-ficha');
      o.ficha = ficha ? ficha.textContent : '';
      return o;
    });
    chk(r.puedeVer === false, 'no puede ver el módulo (' + r.puedeVer + ')');
    chk(r.tarjeta === false, 'no hay tarjeta de Vitrina en su inicio');
    chk(r.abre === false && r.pantalla !== 'vitrina', 'pedir la pantalla no la abre (se queda en ' + r.pantalla + ')');
    chk(r.gotas === 2, 'pero las dos gotas están en el mapa (' + r.gotas + ')');
    chk(/Taller Pepe/.test(r.ficha), 'y la ficha pública de un negocio se abre al tocarlo');
    errores.push(...err); await ctx.close();
  }

  // ── 2 · La vecina con el emprendimiento entregado ────────────────────
  console.log('\n── La vecina con su emprendimiento ─────────────────');
  {
    const { ctx, pg, err } = await abrirCon({ usuario: 'vecina', rol: 'citizen', permisos: 'vitrina', session_token: 't', active: true, verified: true });
    const r = await pg.evaluate(async () => {
      const esperar = ms => new Promise(x => setTimeout(x, ms));
      const o = {};
      o.puedeVer = typeof window.urbisPuedeVerVitrina === 'function' ? window.urbisPuedeVerVitrina() : '(sin función)';
      const tarjeta = document.querySelector('.u52-module.vitrina');
      o.tarjeta = tarjeta ? tarjeta.textContent.trim() : '';
      o.abre = typeof window.urbisIrAPantalla === 'function' ? window.urbisIrAPantalla('vitrina') : '(sin función)';
      await esperar(500);
      o.botonDir = (document.querySelector('[data-u52-screen="vitrina"] .uvit-dir-admin') || {}).textContent || '';
      window.urbisAbrirVitrinaAdmin();
      await esperar(500);
      const m = document.getElementById('urbis-vitrina-admin');
      o.titulo = m ? (m.querySelector('h3') || {}).textContent : '(sin mostrador)';
      o.filas = m ? [...m.querySelectorAll('.uvit-fila .uadm-txt b')].map(x => x.textContent.trim()) : [];
      o.hayNuevo = !!(m && m.querySelector('.uvit-nuevo'));
      o.hayPublicar = !!(m && m.querySelector('[data-acc="publicar"],[data-acc="pausar"]'));
      o.hayBorrar = !!(m && m.querySelector('[data-acc="borrar-negocio"]'));
      // Editar lo suyo: sin campo de dueño, y lo guardado conserva a la dueña.
      let sobre = null;
      window.urbisDBUpdate = function (campo, viejo, cambios) { sobre = cambios.descripcion; return Promise.resolve({ ok: true }); };
      const editar = m && m.querySelector('[data-acc="editar"]');
      if (!editar) { o.sinEditar = true; return o; }
      editar.click();
      await esperar(400);
      o.campoDuenio = !!(m && m.querySelector('#uvit-duenio'));
      const lema = m && m.querySelector('#uvit-lema'); if (lema) lema.value = 'Cortes y barba en Atalaya';
      const guardar = m && m.querySelector('#uvit-guardar'); if (guardar) guardar.click();
      await esperar(600);
      try { o.guardado = JSON.parse(decodeURIComponent(String(sobre || '').replace(/^VITRINA_URBIS:/, ''))); } catch (e) { o.guardado = null; }
      return o;
    });
    chk(r.puedeVer === true, 'con el permiso ya ve el módulo');
    chk(/Mi emprendimiento/.test(r.tarjeta), 'la tarjeta le habla de lo suyo: "' + r.tarjeta.replace(/\s+/g, ' ') + '"');
    chk(r.abre === true, 'y la pantalla abre');
    chk(/Mi emprendimiento/.test(r.botonDir), 'el botón del directorio dice «Mi emprendimiento»');
    chk(/Mi emprendimiento/.test(r.titulo || ''), 'el mostrador es el suyo (' + r.titulo + ')');
    chk(r.filas.length === 1 && /Don Luis/.test(r.filas[0]), 'y lista SOLO su emprendimiento: ' + r.filas.join(' · '));
    chk(!r.hayNuevo && !r.hayPublicar && !r.hayBorrar, 'sin crear, sin publicar ni pausar, sin borrar');
    chk(r.campoDuenio === false, 'al editar no puede cambiar quién lo administra');
    chk(!!r.guardado && r.guardado.duenio === 'vecina' && /barba/.test(r.guardado.lema || ''),
        'lo que guarda lleva su cambio y conserva a la dueña (' + (r.guardado && r.guardado.duenio) + ')');
    errores.push(...err); await ctx.close();
  }

  // ── 3 · El administrador, desde la cuenta dueña ──────────────────────
  console.log('\n── El administrador ───────────────────────────────');
  {
    const { ctx, pg, err } = await abrirCon({ usuario: 'urbisadmin', rol: 'admin', es_admin: true, es_dueno: true,
      correo: 'urbisprocity@gmail.com', permisos: 'vitrina', session_token: 't', active: true, verified: true });
    const r = await pg.evaluate(async () => {
      const esperar = ms => new Promise(x => setTimeout(x, ms));
      const o = {};
      const tarjeta = document.querySelector('.u52-module.vitrina');
      o.tarjeta = tarjeta ? tarjeta.textContent.trim() : '';
      window.urbisAbrirVitrinaAdmin();
      await esperar(500);
      const m = document.getElementById('urbis-vitrina-admin');
      o.filas = m ? [...m.querySelectorAll('.uvit-fila .uadm-txt b')].map(x => x.textContent.trim()) : [];
      o.dice = m ? [...m.querySelectorAll('.uvit-fila small')].map(x => x.textContent).join(' | ') : '';
      o.hayNuevo = !!(m && m.querySelector('.uvit-nuevo'));
      o.hayPublicar = !!(m && m.querySelector('[data-acc="publicar"],[data-acc="pausar"]'));
      // Entregar el Taller a juanita: el sobre lleva el dueño y se le da el permiso.
      let sobre = null, permisoDado = null;
      window.urbisDBUpdate = function (campo, viejo, cambios) { sobre = cambios.descripcion; return Promise.resolve({ ok: true }); };
      window.urbisDarPermiso = function (u, p) { permisoDado = u + ':' + p; return Promise.resolve({ ya: false, usuario: u }); };
      const filas = m ? [...m.querySelectorAll('.uvit-fila')] : [];
      const taller = filas.find(f => /Taller Pepe/.test(f.textContent));
      const editarTaller = taller && taller.querySelector('[data-acc="editar"]');
      if (!editarTaller) { o.sinEditar = true; return o; }
      editarTaller.click();
      await esperar(400);
      const campo = m && m.querySelector('#uvit-duenio');
      o.campoDuenio = !!campo;
      if (campo) campo.value = '@Juanita';
      const guardar = m && m.querySelector('#uvit-guardar'); if (guardar) guardar.click();
      await esperar(800);
      try { o.guardado = JSON.parse(decodeURIComponent(String(sobre || '').replace(/^VITRINA_URBIS:/, ''))); } catch (e) { o.guardado = null; }
      o.permisoDado = permisoDado;
      o.aviso = (m && m.querySelector('.uvit-aviso') || {}).textContent || '';
      return o;
    });
    chk(/Emprendimientos URBIS/.test(r.tarjeta), 'la tarjeta del administrador es la vitrina entera');
    chk(r.filas.length === 2, 'el mostrador lista los dos emprendimientos: ' + r.filas.join(' · '));
    chk(/lo administra @vecina/.test(r.dice), 'y dice quién administra cada uno');
    chk(r.hayNuevo && r.hayPublicar, 'con crear y con publicar/pausar');
    chk(r.campoDuenio === true, 'el formulario tiene el campo de quién lo administra');
    chk(!!r.guardado && r.guardado.duenio === 'juanita',
        'al guardar, el sobre lleva al dueño normalizado, sin @ ni mayúsculas (' + (r.guardado && r.guardado.duenio) + ')');
    chk(r.permisoDado === 'juanita:vitrina', 'y desde la cuenta dueña se le da el permiso de vitrina (' + r.permisoDado + ')');
    chk(/recibió el permiso/.test(r.aviso), 'y se lo dice al administrador: "' + r.aviso.slice(0, 80) + '…"');
    errores.push(...err); await ctx.close();
  }

  await b.close();
  const errFin = errores.filter(e => !/L is not defined|Unexpected end/.test(e));
  chk(errFin.length === 0, 'sin errores de JavaScript' + (errFin.length ? ': ' + errFin[0] : ''));

  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
