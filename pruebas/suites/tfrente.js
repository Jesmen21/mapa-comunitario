const E = require('../entorno.js');
// QUÉ HAY A NIVEL DE CALLE
//
// El motor daba por hecho que todo uso toca la acera. Un centro comercial con
// las tiendas en el tercer piso y un portón abajo contaba igual que una hilera
// de vitrinas — y urbanísticamente son lo contrario: uno atrae gente, el otro
// además hace calle. Aquí se vigila que la diferencia exista Y que no se
// invente cuando nadie miró la fachada.
const { chromium } = require(E.MODULOS + '/playwright-core');
const guionDelMotor = require('../motor-navegador.js');
const REPO = E.RAIZ;

(async () => {
  const b = await chromium.launch({ executablePath: E.CHROMIUM });
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.setContent('<div id="x"></div>');
  await pg.evaluate(() => {
    window.URBIS_CONFIG = { TEMP_REPORT_TTL_HOURS: 8 };
    const chain = new Proxy(function(){}, {
      get:(t,k)=>(k===Symbol.toPrimitive||k==='then')?undefined:chain,
      apply:()=>chain, construct:()=>chain });
    window.L = chain; window.map = chain;
  });
  /* El motor ya no se sirve al navegador: se inyecta el paquete del repo
     privado, que es el mismo que corre en la API. */
  await pg.addScriptTag({ content: guionDelMotor() });
  for (const f of ['00-config','00-app-shell','01-audio-feedback','02-auth-roles',
                   '03-map-data-config','03b-edificio-vocabulario','04-marker-proximity',
                   '64-analisis-edu','65-analisis-edu-ui']) {
    try { await pg.addScriptTag({ path: REPO + '/js/' + f + '.js' }); } catch(e){}
  }

  const r = await pg.evaluate(() => {
    const M = window.AIA_MOTOR, E = window.URBIS_EDIFICIO;
    const centro = { lat: 7.9168, lng: -72.4727 };
    let id = 1;
    const el = (t,d,a) => { const rad=a*Math.PI/180;
      return { type:'node', id:id++, lat:centro.lat+(d*Math.cos(rad))/110540,
               lon:centro.lng+(d*Math.sin(rad))/(111320*Math.cos(centro.lat*Math.PI/180)), tags:t }; };
    const via = [ el({highway:'trunk',name:'Anillo'},80,0) ];
    // 12 comercios a 200 m. Tres escenarios idénticos salvo la planta baja.
    const tiendas = frente => Array.from({length:12},(_,i)=>{
      const t = { 'urbis:sub':'comercio_otro', 'building:levels':'4', 'urbis:intensidad':'4' };
      if (frente) { t['urbis:frente'] = frente;
        t['urbis:planta_baja'] = frente==='muerto' ? 'Muro ciego o reja' : 'Comercio o local con vitrina'; }
      return el(t,200,i*30);
    });
    const corre = f => M.analizarHeuristico({ elementos: tiendas(f).concat(via),
      radioM:1000, centro, tipoEstudio:'completo', proyectoId:'cafe_paso' });
    const sinDato = corre(null), vivo = corre('activo'), muerto = corre('muerto');
    const fl = x => x.stats.movilidad.flujo;

    // La ficha viaja completa por el registro real.
    const usos = E.todosLosUsos();
    const flags = usos.map(u => u==='Comercial' ? 'SI' : 'NO');
    const rec = ['Centro comercial','Ventura','n','Bueno','Activo','N/A'].concat(flags)
      .concat(['N/A','Aprobado','A','edu','0','a@b.c','1','C'])
      .concat(['2026-01-01T00:00:00Z','N/A','Permanente','Activo','General'])
      .concat(['Concreto reforzado (pórticos o muros)','4','Muro ciego o reja']).join(' | ');
    const ficha = E.leer(rec);
    const els = window.URBIS_EDU.puntoAElemento({ lat:'7.9168', lng:'-72.4727', descripcion: rec }, 1);

    // Bodegas: la categoría YA supone fachada ciega. Aquí se comprueba que la
    // observación mande sobre esa suposición, y que no se cobre dos veces.
    const bodegas = frente => Array.from({length:5},(_,i)=>{
      const t = { 'urbis:sub':'bodega' };
      if (frente) t['urbis:frente'] = frente;
      return el(t,200,i*40);
    });
    const corrB = f => M.analizarHeuristico({ elementos: bodegas(f).concat(via),
      radioM:1000, centro, tipoEstudio:'completo', proyectoId:'cafe_paso' });
    const bSin = corrB(null), bMuerto = corrB('muerto'), bVivo = corrB('activo');
    const penDe = (x,sub) => (fl(x).penalizadores||[]).find(p=>p.sub===sub) || null;

    return {
      bodegaSin: (penDe(bSin,'bodega')||{}).resta,
      bodegaMuerto: (penDe(bMuerto,'bodega')||{}).resta,
      bodegaVivo: (penDe(bVivo,'bodega')||{}).resta,
      dobleMuerto: !!penDe(bMuerto,'frente_muerto'),
      dobleSin: !!penDe(bSin,'frente_muerto'),
      corregidosVivo: fl(bVivo).frentesCorregidos,
      corregidosMuerto: fl(bMuerto).frentesCorregidos,
      nBodegaVivo: (penDe(bVivo,'bodega')||{}).corregidos,
      andenSinDato: fl(sinDato).comerciosAnden, andenVivo: fl(vivo).comerciosAnden,
      andenMuerto: fl(muerto).comerciosAnden,
      sinFrenteMuerto: fl(muerto).comercioSinFrente, sinFrenteVivo: fl(vivo).comercioSinFrente,
      pkSinDato: fl(sinDato).peatonal, pkVivo: fl(vivo).peatonal, pkMuerto: fl(muerto).peatonal,
      penMuerto: (fl(muerto).penalizadores||[]).find(p=>p.sub==='frente_muerto') || null,
      penVivo: (fl(vivo).penalizadores||[]).find(p=>p.sub==='frente_muerto') || null,
      // El comercio muerto sigue existiendo como rubro/destino.
      rubrosMuerto: (muerto.stats.rubros||[]).length,
      rubrosVivo: (vivo.stats.rubros||[]).length,
      ficha: { pb: ficha.plantaBaja, frente: ficha.frenteActivo, pisos: ficha.pisos },
      tagFrente: els && els[0] ? els[0].tags['urbis:frente'] : null,
      fichaVieja: E.leer('Casa | x | y | Bueno | Activo | N/A').frenteActivo
    };
  });

  const ok=[],fallo=[]; const chk=(c,t)=>(c?ok:fallo).push(t);

  console.log('══ VITRINA vs PORTÓN ══════════════════════════════════════════');
  console.log('  12 comercios, planta baja no registrada → andén ' + r.andenSinDato +
              ', peatonal ' + r.pkSinDato);
  console.log('  12 comercios con vitrina                → andén ' + r.andenVivo +
              ', peatonal ' + r.pkVivo);
  console.log('  12 comercios con muro ciego             → andén ' + r.andenMuerto +
              ', peatonal ' + r.pkMuerto);
  chk(r.andenMuerto === 0 && r.andenVivo === 12,
      'un frente muerto deja de contar como vitrina (' + r.andenMuerto + ' vs ' + r.andenVivo + ')');
  chk(r.pkMuerto < r.pkVivo, 'y eso baja el flujo peatonal (' + r.pkMuerto + ' < ' + r.pkVivo + ')');
  chk(r.pkMuerto > 0,
      'pero NO lo deja en cero: la puerta sigue ahí y la gente entra y sale por ella (' +
      r.pkMuerto + ')');
  chk(r.penMuerto && r.penMuerto.n === 12,
      'aparece como penalizador con nombre propio: "' + (r.penMuerto||{}).nombre + '"');
  chk(!r.penVivo, 'y no aparece cuando el frente está vivo');
  chk(r.sinFrenteMuerto === 12 && r.sinFrenteVivo === 0,
      'el informe puede decir cuántos comercios no hacen calle (' + r.sinFrenteMuerto + ')');

  console.log('\n── Atrae gente aunque no haga calle ──────────────────────────');
  chk(r.rubrosMuerto === r.rubrosVivo && r.rubrosMuerto > 0,
      'el comercio con portón sigue contando como rubro y como destino: no desaparece');

  console.log('\n── Lo que nadie miró NO se da por muerto ─────────────────────');
  chk(r.andenSinDato === 12 && r.pkSinDato === r.pkVivo,
      'sin registrar se comporta igual que antes: "no lo miramos" no es "no hay frente"');
  chk(r.fichaVieja === null,
      'un registro viejo devuelve null, no false');

  console.log('\n── La ficha viaja completa ───────────────────────────────────');
  console.log('  planta baja: "' + r.ficha.pb + '" · frente activo: ' + r.ficha.frente +
              ' · pisos: ' + r.ficha.pisos);
  chk(r.ficha.pb === 'Muro ciego o reja' && r.ficha.frente === false,
      'se lee del registro y se traduce a frente muerto');
  chk(r.tagFrente === 'muerto', 'y llega al motor etiquetado');

  console.log('\n══ LO OBSERVADO MANDA SOBRE LO SUPUESTO ═══════════════════════');
  console.log('  5 bodegas, fachada no observada  → descuento ' + r.bodegaSin);
  console.log('  5 bodegas con muro ciego visto   → descuento ' + r.bodegaMuerto +
              (r.dobleMuerto ? ' + frente_muerto' : ' (sin castigo doble)'));
  console.log('  5 bodegas con vitrina vista      → descuento ' + r.bodegaVivo);
  chk(!r.dobleMuerto && !r.dobleSin,
      'una bodega con muro ciego NO se castiga dos veces: la observación confirma la ' +
      'suposición, no añade un hecho nuevo');
  chk(r.bodegaMuerto === r.bodegaSin,
      'confirmar lo que la categoría ya suponía no cambia el descuento (' +
      r.bodegaMuerto + ' = ' + r.bodegaSin + ')');
  chk(r.bodegaVivo < r.bodegaSin,
      'pero ver una vitrina donde se suponía muro SÍ lo baja (' +
      r.bodegaSin + ' → ' + r.bodegaVivo + ')');
  chk(r.bodegaVivo > 0,
      'y no lo borra: una bodega con tiendita sigue teniendo mucho paramento ciego (' +
      r.bodegaVivo + ')');
  chk(r.corregidosVivo === 5 && r.nBodegaVivo === 5,
      'se cuenta cuántos casos corrigió la visita, para poder decirlo en el informe');
  chk(r.corregidosMuerto === 0,
      'y confirmar la suposición no cuenta como corrección');

  const txt = await pg.evaluate(() => {
    const U = window.URBIS_EDU_UI || window.AIA_EDU_UI;
    if (!U || !U.bloqueFlujo) return null;
    const f = { franjas:{manana:1,mediodia:1,tarde:1,noche:1}, generadores:[], penalizadores:[],
                frentesCorregidos: 3, comercioSinFrente: 2, caminabilidad:{muestras:0,factor:1} };
    return U.bloqueFlujo({ stats: { movilidad: { flujo: f } } });
  });
  console.log('\n── Lo que lee el estudiante ──────────────────────────────────');
  if (txt === null) { console.log('  (bloqueFlujo no se exporta; se comprueba en tedu)'); }
  else {
    chk(/la categoría suponía fachada ciega/.test(txt) && /3 casos/.test(txt),
        'el informe dice que ir a mirar corrigió la suposición');
    chk(/no hacen calle/.test(txt),
        'y que hay comercios que atraen gente sin hacer calle');
  }

  chk(errs.length===0, 'sin errores de página' + (errs.length?': '+errs[0]:''));
  console.log('\n' + ok.map(t=>'✅ '+t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t=>'❌ '+t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length+fallo.length));
  await b.close(); process.exit(fallo.length?1:0);
})();
