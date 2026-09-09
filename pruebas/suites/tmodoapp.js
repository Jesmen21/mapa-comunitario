const E = require('../entorno.js');
/* EL MODO INSTALADO NO SE PIERDE (v833)
   ────────────────────────────────────────────────────────────────────────
   URBIS_CO es el mismo sitio con `?app=ciudadano`: ese parámetro poda el
   inicio a reportar, eventos, social, minijuegos y seguimiento, y le pone a
   la página el icono y el nombre de la gota amarilla para que quien la
   instale desde Safari se lleve URBIS_CO y no URBIS.

   En Android da igual que el parámetro sea la única memoria: cada APK
   arranca siempre en su dirección. En iPhone no hay APK —se instala desde
   Safari— y si una navegación pierde el parámetro, la persona que instaló
   la gota amarilla se encuentra la aplicación completa, con Pro City.

   Guardar el modo a secas era justo lo que NO se podía hacer: los tres APK
   comparten el almacenamiento de Chrome, así que un modo guardado haría que
   abrir el educativo dejara al ciudadano abriendo Pro City. De ahí las dos
   reglas que esta suite defiende, y que son inseparables:

     1. EL PARÁMETRO MANDA SIEMPRE y reescribe lo guardado. Es lo que impide
        que un APK herede el modo del otro.
     2. Lo guardado solo se lee si la aplicación corre INSTALADA. En una
        pestaña normal, urbispro.city sigue abriendo la aplicación entera.

   Si alguien afloja cualquiera de las dos, se rompe algo que no se ve
   mirando la pantalla: la primera rompe los APK de Android, la segunda
   convierte la web en la app recortada para quien alguna vez abrió el
   enlace de URBIS_CO. Por eso las dos se miden acá, y en los dos sentidos.

   No es una barrera de seguridad y no lo pretende: quien escriba la
   dirección sin parámetro en una pestaña ve todo. Esto arregla un
   accidente, no cierra una puerta.                                       */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);

  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const errores = [];
  const LEAFLET = (E.TRABAJO || '') + 'node_modules/leaflet/dist/';
  /* Leaflet se sirve del disco —la red de esta caja no llega al CDN— y el
     desvío se pone en el CONTEXTO, no en cada página: el service worker de
     URBIS también pide esos archivos para su precaché, y sus peticiones no
     pasan por el desvío de una página suelta. */
  await ctx.route('**/leaflet*.js', r => r.fulfill({ contentType: 'application/javascript',
    body: fs.readFileSync(LEAFLET + 'leaflet.js', 'utf8') }));
  await ctx.route('**/leaflet*.css', r => r.fulfill({ contentType: 'text/css',
    body: fs.readFileSync(LEAFLET + 'leaflet.css', 'utf8') }));

  /* Abre la página en una pestaña nueva, opcionalmente fingiendo que la
     aplicación está instalada. Se finge por el camino de iOS
     —`navigator.standalone`—, que es exactamente el caso que se arregla:
     un iPhone con la gota amarilla en la pantalla de inicio. */
  async function abrir(url, instalada) {
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errores.push(url + ' :: ' + String(e.message).slice(0, 120)));
    if (instalada) {
      await pg.addInitScript(() => {
        try { Object.defineProperty(window.navigator, 'standalone', { get: () => true, configurable: true }); } catch (e) {}
      });
    }
    await pg.goto(E.ESTATICO + url, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2600);
    const r = await pg.evaluate(() => {
      const q = s => document.querySelector(s);
      return {
        modo: document.documentElement.getAttribute('data-urbis-modo'),
        guardado: (() => { try { return localStorage.getItem('urbis_modo_app_v1'); } catch (e) { return null; } })(),
        busqueda: location.search,
        appleTitle: (q('meta[name="apple-mobile-web-app-title"]') || {}).content || '',
        appleIcon: q('link[rel="apple-touch-icon"]') ? q('link[rel="apple-touch-icon"]').getAttribute('href') : '',
        modulos: [...document.querySelectorAll('#urbis-mobile-app .u52-module')]
          .filter(m => getComputedStyle(m).display !== 'none')
          .map(m => (m.querySelector('b') || {}).textContent)
      };
    });
    await pg.close();
    return r;
  }
  const guardar = async (valor) => {
    const pg = await ctx.newPage();
    await pg.goto(E.ESTATICO + '/index.html', { waitUntil: 'domcontentloaded' });
    await pg.evaluate(v => { try { v === null ? localStorage.removeItem('urbis_modo_app_v1')
                                              : localStorage.setItem('urbis_modo_app_v1', v); } catch (e) {} }, valor);
    await pg.close();
  };

  // ── 1. Con el parámetro, lo de siempre — y ahora además se recuerda ────
  await guardar(null);
  let r = await abrir('/index.html?app=ciudadano', false);
  chk(r.modo === 'ciudadano', 'con ?app=ciudadano la aplicación entra en modo ciudadano');
  chk(r.modulos.length === 5 && r.modulos.indexOf('Pro City') === -1,
      'con los cinco módulos de URBIS_CO y sin los profesionales (' + r.modulos.join(', ') + ')');
  chk(r.appleTitle === 'URBIS_CO' && /reportes\//.test(r.appleIcon),
      'y con el nombre y la gota amarilla en la cabecera, que es lo que copia iPhone al instalar');
  chk(r.guardado === 'ciudadano', 'el modo queda recordado');

  // ── 2. En una pestaña normal, sin parámetro, la web sigue completa ─────
  /* Esta es la mitad que más fácil se rompe al «arreglar» la otra: si lo
     guardado se leyera siempre, urbispro.city quedaría recortado para
     siempre a quien alguna vez abrió el enlace de URBIS_CO. */
  r = await abrir('/index.html', false);
  chk(!r.modo, 'sin parámetro y en una pestaña normal NO hay modo, aunque haya uno recordado');
  chk(r.modulos.length > 5 && r.modulos.indexOf('Pro City') !== -1,
      'urbispro.city sigue abriendo la aplicación entera (' + r.modulos.length + ' módulos)');
  chk(r.appleTitle === 'URBIS', 'y con la identidad de URBIS, no la de URBIS_CO');

  // ── 3. Instalada y sin parámetro: se recupera. Esto es lo nuevo ────────
  r = await abrir('/index.html', true);
  chk(r.modo === 'ciudadano',
      'instalada en el teléfono y sin parámetro, se recupera el modo: la gota amarilla no se abre como la app completa');
  chk(r.modulos.length === 5 && r.modulos.indexOf('Pro City') === -1,
      'y vuelve a enseñar solo lo de URBIS_CO (' + r.modulos.join(', ') + ')');
  chk(/app=ciudadano/.test(r.busqueda),
      'el parámetro vuelve a la dirección, para que sobreviva a un recargue (' + r.busqueda + ')');
  chk(r.appleTitle === 'URBIS_CO', 'con su nombre puesto');

  // ── 4. El parámetro manda sobre lo recordado: los tres APK ────────────
  /* El caso que hacía imposible guardar el modo. En Android los tres APK
     comparten el almacenamiento de Chrome; si lo guardado ganara, abrir el
     educativo dejaría al ciudadano abriendo Pro City. */
  r = await abrir('/index.html?app=educativo', true);
  chk(r.modo === 'educativo',
      'el parámetro manda sobre lo recordado: abrir el APK educativo no hereda el modo ciudadano');
  chk(r.guardado === 'educativo', 'y corrige la memoria al entrar, para el siguiente arranque');
  r = await abrir('/index.html?app=ciudadano', true);
  chk(r.modo === 'ciudadano' && r.guardado === 'ciudadano',
      'y al revés también: cada APK se corrige a sí mismo al abrir');

  // ── 5. Nada recordado, instalada: no se inventa un modo ───────────────
  await guardar(null);
  r = await abrir('/index.html', true);
  chk(!r.modo && r.modulos.length > 5,
      'instalada pero sin nada recordado, no se inventa un modo: abre completa');

  // ── 6. Un valor inventado a mano no vale ──────────────────────────────
  // `localStorage` lo edita cualquiera desde la consola. Un modo que no
  // existe tiene que caer en «sin modo», no dejar la aplicación a medias.
  await guardar('pirata');
  r = await abrir('/index.html', true);
  chk(!r.modo && r.modulos.length > 5,
      'un modo inventado en el almacenamiento se ignora, no deja la aplicación a medias');

  // ── 7. La puerta del APK sigue funcionando ────────────────────────────
  await guardar(null);
  r = await abrir('/reportes.html', false);
  chk(r.modo === 'ciudadano' && /app=ciudadano/.test(r.busqueda),
      'reportes.html —la dirección grabada en el APK, que no se puede cambiar— sigue entrando en modo ciudadano');

  // ── 8. Las dos reglas, escritas ───────────────────────────────────────
  const j70 = fs.readFileSync(REPO + '/js/70-modo-app.js', 'utf8');
  chk(/if \(MODO\) \{\s*\n\s*recordarModo\(MODO\);/.test(j70),
      'en el código, el parámetro se atiende ANTES que la memoria');
  chk(/estaInstalada\(\)/.test(j70) && /navigator\.standalone/.test(j70),
      'y la memoria solo se lee si la aplicación corre instalada');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
