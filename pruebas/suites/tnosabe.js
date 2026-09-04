const ENT = require('../entorno.js');
// "NO SE SABE" Y "OTRO": LAS DOS SALIDAS DE TODA LISTA CERRADA
//
// Sin salida, quien mapea elige la opción más parecida para poder seguir, y
// eso mete un dato falso que después nadie distingue de uno bueno. Lo que se
// vigila aquí es que ninguna de las dos salidas se pueda confundir con haber
// observado algo — sobre todo en la planta baja, donde tomar un "no se sabe"
// por frente activo sería AFIRMAR lo que nadie miró.
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
      get:(t,k)=>(k===Symbol.toPrimitive||k==='then')?undefined:chain,
      apply:()=>chain, construct:()=>chain });
    window.L = chain; window.map = chain;
  });
  /* El motor ya no se sirve al navegador: se inyecta el paquete del repo
     privado, que es el mismo que corre en la API. */
  await pg.addScriptTag({ content: guionDelMotor() });
  for (const f of ['00-config','00-app-shell','01-audio-feedback','02-auth-roles',
                   '03-map-data-config','03b-edificio-vocabulario','04-marker-proximity',
                   '05-helpers-temporal-security','64-analisis-edu','11-report-form']) {
    try { await pg.addScriptTag({ path: REPO + '/js/' + f + '.js' }); } catch(e){}
  }

  const r = await pg.evaluate(() => {
    const E = window.URBIS_EDIFICIO, EDU = window.URBIS_EDU;
    const centro = { lat: 7.9168, lng: -72.4727 };
    const usos = E.todosLosUsos().map(() => 'NO');
    const reg = (mat, pb, ep, otro, d) => ({
      lat: String(centro.lat + (d||0)), lng: String(centro.lng),
      descripcion: ['Residencial · Casa de un piso','C','n','Bueno','Activo','N/A']
        .concat(usos)
        .concat(['N/A','Aprobado','A','edu','0','a@b.c','1','C'])
        .concat(['2026-08-20T10:00:00Z','N/A','Permanente','Activo','General'])
        .concat([mat, '1', pb, ep, otro || '']).join(' | ') });

    const NS = E.NO_SE_SABE, OT = E.OTRO;
    const CONCRETO = 'Concreto reforzado (pórticos o muros)';

    // Las tres listas tienen que ofrecer las dos salidas.
    const tienen = ['MATERIALIDAD','PLANTA_BAJA','EPOCA'].map(k => ({
      lista: k, ns: E[k].indexOf(NS) !== -1, ot: E[k].indexOf(OT) !== -1 }));

    window.urbisDatosVisibles = () => ([
      reg(NS, NS, NS, '', 0),
      reg(OT, 'Comercio o local con vitrina', OT, 'Contenedor marítimo adaptado', 0.0001),
      reg(CONCRETO, 'Muro ciego o reja', '2010 o posterior (NSR-10)', '', 0.0002)
    ]);
    const g = EDU.reunirElementos(centro, 1000);

    const fNS = E.leer(reg(NS, NS, NS, '').descripcion);
    const fOT = E.leer(reg(OT, OT, OT, 'Contenedor marítimo adaptado').descripcion);
    const fReal = E.leer(reg(CONCRETO,'Muro ciego o reja','2010 o posterior (NSR-10)','').descripcion);

    // El formulario debe ofrecerlas de verdad, no solo la tabla.
    let cont = document.getElementById('info-content');
    if (!cont) { cont = document.createElement('div'); cont.id='info-content';
                 document.body.appendChild(cont); }
    window.userRole = 'edu';
    window.formPaso2('Vivienda y Residencial', 7.9, -72.4, '');
    const html = cont.innerHTML;

    return {
      tienen: tienen,
      nsFrente: fNS.frenteActivo, otFrente: fOT.frenteActivo, realFrente: fReal.frenteActivo,
      nsVuln: fNS.vulnerabilidad, otVuln: fOT.vulnerabilidad, realVuln: fReal.vulnerabilidad,
      nsMatUtil: fNS.materialidadUtil, otMatUtil: fOT.materialidadUtil,
      otTexto: fOT.otroTexto,
      ed: g.edificacion,
      formTieneNS: html.indexOf(NS) !== -1,
      formTieneOT: html.indexOf(OT) !== -1,
      formTieneTexto: html.indexOf('ins-otro-edificio') !== -1
    };
  });

  const ok=[],fallo=[]; const chk=(c,t)=>(c?ok:fallo).push(t);
  const e = r.ed;

  console.log('══ LAS TRES LISTAS OFRECEN SALIDA ═════════════════════════════');
  r.tienen.forEach(t => console.log('  ' + t.lista.padEnd(13) +
    ' no se sabe ' + (t.ns?'✔':'✘') + '   otro ' + (t.ot?'✔':'✘')));
  chk(r.tienen.every(t => t.ns && t.ot),
      'materialidad, planta baja y época ofrecen «no se sabe» y «otro»');
  chk(r.formTieneNS && r.formTieneOT, 'y el formulario las pinta de verdad');
  chk(r.formTieneTexto, 'con un campo para describir lo que no cabía en la lista');

  console.log('\n══ NINGUNA SALIDA SE CONFUNDE CON UNA OBSERVACIÓN ═════════════');
  console.log('  frente activo → «no se sabe»: ' + r.nsFrente +
              ' · «otro»: ' + r.otFrente + ' · observado muro ciego: ' + r.realFrente);
  chk(r.nsFrente === null,
      'un «no se sabe» en planta baja NO se toma por frente activo: sería afirmar lo que nadie miró');
  chk(r.otFrente === null, 'y un «otro» tampoco');
  chk(r.realFrente === false, 'mientras lo observado sí decide');
  chk(r.nsVuln === null && r.otVuln === null && r.realVuln !== null,
      'la vulnerabilidad no se calcula sobre una salida, solo sobre lo observado');
  chk(r.nsMatUtil === '' && r.otMatUtil === '',
      'el material de una salida queda en blanco para todo cálculo');

  console.log('\n══ PERO SÍ SE CUENTAN Y SE DICEN ══════════════════════════════');
  console.log('  edificios ' + e.total + ' · «no se sabe» ' + e.noSeSabe +
              ' · «otro» ' + e.otros + ' · con material usable ' + e.conMaterial);
  console.log('  lo que no cabía: ' + (e.textosOtro||[]).join(' · '));
  chk(e.noSeSabe === 3, 'los «no se sabe» se cuentan uno por uno (' + e.noSeSabe + ')');
  chk(e.otros === 2, 'y los «otro» aparte (' + e.otros + ')');
  chk(e.conMaterial === 1,
      'solo un edificio aporta material usable: las salidas no inflan la cobertura');
  chk((e.textosOtro||[]).indexOf('Contenedor marítimo adaptado') !== -1,
      'se guarda qué no cabía en la lista, que es lo que permite mejorarla');
  chk(e.total === 3, 'y ningún edificio se pierde del conteo por haber declarado un límite');

  chk(errs.length===0, 'sin errores de página' + (errs.length?': '+errs[0]:''));
  console.log('\n' + ok.map(t=>'✅ '+t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t=>'❌ '+t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length+fallo.length));
  await b.close(); process.exit(fallo.length?1:0);
})();
