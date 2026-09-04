const ENT = require('../entorno.js');
// LA INFRAESTRUCTURA PEATONAL YA NO SE TIRA A LA BASURA
//
// El módulo calculaba flujo peatonal descartando 13 de los 14 elementos de
// "Infraestructura y Peatonal" — justamente los que dicen si se puede caminar
// por ahí. Aquí se vigila que nada se pierda, y que el estado del andén entre
// como lo que es: un factor que modula la caminata, no un generador que la
// inventa.
const { chromium } = require(ENT.MODULOS + '/playwright-core');
const guionDelMotor = require('../motor-navegador.js');
const REPO = ENT.RAIZ;

(async () => {
  const b = await chromium.launch({ executablePath: ENT.CHROMIUM });
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.setContent('<div id="x"></div>');
  await pg.evaluate(() => {
    window.URBIS_CONFIG = { TEMP_REPORT_TTL_HOURS: 8 };
    const chain = new Proxy(function(){}, {
      get: (t,k) => (k===Symbol.toPrimitive||k==='then') ? undefined : chain,
      apply: () => chain, construct: () => chain });
    window.L = chain; window.map = chain;
  });
  /* El motor ya no se sirve al navegador: se inyecta el paquete del repo
     privado, que es el mismo que corre en la API. */
  await pg.addScriptTag({ content: guionDelMotor() });
  for (const f of ['00-config','00-app-shell','01-audio-feedback','02-auth-roles',
                   '03-map-data-config','03b-edificio-vocabulario','04-marker-proximity',
                   '64-analisis-edu']) {
    try { await pg.addScriptTag({ path: REPO + '/js/' + f + '.js' }); } catch(e){}
  }

  // `dimensiones` no se expone en window: la lista se lee del propio archivo,
  // que además es la fuente que ve el estudiante en el formulario.
  const src = require('fs').readFileSync(REPO + '/js/04-marker-proximity.js', 'utf8');
  const ITEMS = eval(src.match(/"Infraestructura y Peatonal":[^}]*items:\s*(\[[^\]]*\])/s)[1]);

  const r = await pg.evaluate((items) => {
    const E = window.URBIS_EDU, M = window.AIA_MOTOR;
    const centro = { lat: 7.9168, lng: -72.4727 };

    // ¿Cuáles siguen sin llegar al análisis?
    const perdidos = [];
    items.forEach(function (it, k) {
      const desc = 'Infraestructural · ' + it + ' | x | y';
      const els = E.puntoAElemento({ lat:'7.9168', lng:'-72.4727', descripcion: desc }, k);
      if (!els || !els.length) perdidos.push(it);
    });

    // Los tres de estado de andén NO deben ser elementos: no son destinos.
    const anden3 = ['Andén continuo','Andén interrumpido','Sin andén / Bordillo'];

    // Escenario: mismo entorno, distinto andén.
    let id = 1;
    const el = (t, d, a) => { const rad = a*Math.PI/180;
      return { type:'node', id:id++, lat: centro.lat + (d*Math.cos(rad))/110540,
               lon: centro.lng + (d*Math.sin(rad))/(111320*Math.cos(centro.lat*Math.PI/180)), tags:t }; };
    const entorno = Array.from({length:14},(_,i)=>el({'urbis:sub':'comercio_otro'},200,i*25))
      .concat([el({highway:'trunk',name:'Anillo'},80,0)]);
    const corre = cam => M.analizarHeuristico({ elementos: entorno, radioM:1000, centro,
      tipoEstudio:'completo', proyectoId:'cafe_paso', caminabilidad: cam });

    const sinDato = corre(null);
    const bueno = corre({ muestras:10, indice:1, factor:1.10, continuo:10, interrumpido:0,
                          sinAnden:0, rampas:2, nivel:'Buena' });
    const malo  = corre({ muestras:10, indice:0, factor:0.75, continuo:0, interrumpido:0,
                          sinAnden:10, rampas:0, nivel:'Mala' });
    const pk = x => x.stats.movilidad.flujo.peatonal;
    const fr = x => x.stats.movilidad.flujo.franjas;

    return {
      perdidos: perdidos,
      andenNoEsElemento: anden3.every(function (it) {
        const els = E.puntoAElemento({ lat:'7.9168', lng:'-72.4727',
          descripcion: 'Infraestructural · ' + it + ' | x | y' }, 99);
        return !els || !els.length; }),
      paradero: (E.puntoAElemento({ lat:'7.9168', lng:'-72.4727',
        descripcion: 'Infraestructural · Paradero de bus | x | y' }, 1) || [{}])[0].tags,
      sinDato: pk(sinDato), bueno: pk(bueno), malo: pk(malo),
      camSinDato: sinDato.stats.movilidad.flujo.caminabilidad,
      camMalo: malo.stats.movilidad.flujo.caminabilidad,
      frSinDato: fr(sinDato), frMalo: fr(malo),
      nItems: items.length,
      // El camino real: lo que el curso mapeó pasa por reunirElementos, que es
      // donde el andén y las rampas se separan de los elementos.
      recogido: (function(){
        const pt = (tipo, dl) => ({ lat: String(centro.lat + (dl||0)), lng: String(centro.lng),
                                    descripcion: 'Infraestructural · ' + tipo + ' | x | y' });
        window.urbisDatosVisibles = () => ([
          pt('Andén continuo'), pt('Andén continuo', 0.0001),
          pt('Andén interrumpido', 0.0002), pt('Sin andén / Bordillo', 0.0003),
          pt('Rampa de acceso', 0.0004), pt('Paradero de bus', 0.0005),
          pt('Banca de parque', 0.0006), pt('Cableado expuesto', 0.0007)
        ]);
        const g = E.reunirElementos(centro, 1000);
        return { cam: g.caminabilidad, nElementos: g.elementos.length,
                 sinTraducir: Object.keys(g.sinTraducir),
                 subs: g.elementos.map(e => e.tags['urbis:sub']) };
      })()
    };
  }, ITEMS);

  const ok = [], fallo = [];
  const chk = (c,t) => (c ? ok : fallo).push(t);

  console.log('══ NADA SE DESCARTA ═══════════════════════════════════════════');
  console.log('  elementos de "Infraestructura y Peatonal" sin llegar al análisis: ' +
              (r.perdidos.length ? r.perdidos.join(', ') : 'ninguno'));
  chk(r.perdidos.length === 4, 'de 14 elementos, solo 4 no son "un punto en el mapa" (' +
      r.perdidos.length + ' de ' + r.nItems + ')');
  chk(r.andenNoEsElemento,
      'y quedan fuera A PROPÓSITO: un andén no es un destino, no puede contar como POI');
  chk(r.paradero && r.paradero['urbis:sub'] === 'parada_bus',
      'el paradero de bus ya llega — era el generador de caminata más pesado del motor');

  console.log('\n══ EL ANDÉN MODULA, NO GENERA ═════════════════════════════════');
  console.log('  sin datos de andén → peatonal ' + r.sinDato);
  console.log('  andén continuo     → peatonal ' + r.bueno);
  console.log('  sin andén          → peatonal ' + r.malo);
  chk(r.malo < r.sinDato && r.sinDato < r.bueno,
      'un andén roto suprime caminata y uno bueno la facilita (' +
      r.malo + ' < ' + r.sinDato + ' < ' + r.bueno + ')');
  chk(r.malo > 0, 'pero un andén malo NO vacía una calle con vida (' + r.malo + ')');
  chk(r.camSinDato && r.camSinDato.muestras === 0 && r.camSinDato.factor === 1,
      'sin observaciones el factor es neutro: un vacío de datos no es un andén bueno');
  chk(r.camSinDato.fiable === false,
      'y se declara no fiable, en vez de disimularlo');
  chk(r.camMalo && r.camMalo.fiable === true && r.camMalo.nivel === 'Mala',
      'con 10 observaciones sí es fiable y se nombra el nivel');
  const bajo = ['manana','mediodia','tarde','noche'].every(k => r.frMalo[k] <= r.frSinDato[k]);
  chk(bajo, 'el ajuste llega también al reparto por horas: total y gráfica hablan del mismo sitio');

  console.log('\n══ EL CAMINO REAL (lo que mapea el curso) ═════════════════════');
  const g = r.recogido;
  if (!g || !g.cam) { fallo.push('reunirElementos no devolvió caminabilidad'); }
  else {
    console.log('  andén: ' + g.cam.continuo + ' continuo, ' + g.cam.interrumpido +
                ' interrumpido, ' + g.cam.sinAnden + ' sin andén · rampas ' + g.cam.rampas);
    console.log('  elementos que llegan al motor: ' + g.subs.join(', '));
    console.log('  sin traducir: ' + (g.sinTraducir.length ? g.sinTraducir.join(', ') : 'nada'));
    chk(g.cam.continuo === 2 && g.cam.interrumpido === 1 && g.cam.sinAnden === 1,
        'el estado del andén se cuenta por categoría');
    chk(g.cam.rampas === 1, 'la rampa de acceso se cuenta como accesibilidad, no se pierde');
    chk(g.cam.muestras === 4 && g.cam.nivel === 'Irregular',
        'y sale un nivel de caminabilidad del conjunto (' + g.cam.nivel + ')');
    chk(g.subs.indexOf('parada_bus') !== -1 && g.subs.indexOf('mobiliario') !== -1 &&
        g.subs.indexOf('infra_servicios') !== -1,
        'paradero, banca y cableado llegan al motor con su categoría');
    chk(g.sinTraducir.length === 0,
        'y ya NADA de infraestructura peatonal queda sin traducir' +
        (g.sinTraducir.length ? ': ' + g.sinTraducir.join(', ') : ''));
  }

  chk(errs.length === 0, 'sin errores de página' + (errs.length ? ': ' + errs[0] : ''));
  console.log('\n' + ok.map(t=>'✅ '+t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t=>'❌ '+t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length+fallo.length));
  await b.close();
  process.exit(fallo.length ? 1 : 0);
})();
