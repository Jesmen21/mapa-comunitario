const ENT = require('../entorno.js');
// QUE LO LEVANTADO EN CAMPO SALGA DE LA APP
//
// Todo lo que añadimos (material, pisos, frente a la calle, época, usos
// múltiples, andén) vivía solo dentro de la aplicación: el PDF no lo mostraba
// y el GeoJSON exportaba un punto con nombre y categoría. Es justo el trabajo
// que costó ir a hacer, perdido en la puerta de salida.
const { chromium } = require(ENT.MODULOS + '/playwright-core');
const REPO = ENT.RAIZ;

const CENTRO = { lat: 7.9168, lng: -72.4727 };
let _id = 1;
const nodoA = (t, d, a) => { const rad = a * Math.PI / 180;
  return { type:'node', id:_id++, lat: CENTRO.lat + (d * Math.cos(rad)) / 110540,
           lon: CENTRO.lng + (d * Math.sin(rad)) / (111320 * Math.cos(CENTRO.lat * Math.PI / 180)),
           tags: t }; };
const BASE = Array.from({length:12},(_,i)=>nodoA({'urbis:sub':'comercio_otro'},200,i*30))
  .concat(Array.from({length:20},(_,i)=>nodoA({'urbis:sub':'residencial'},300,i*18)))
  .concat([nodoA({highway:'trunk',name:'Anillo'},80,0)]);
const CAMINA = { muestras:8, indice:0.5, factor:0.93, continuo:3, interrumpido:2,
                 sinAnden:3, rampas:1, nivel:'Irregular' };

async function pedirAlMotor(cuerpo) {
  const p = await fetch('http://localhost:8787/analizar', { method:'POST',
    headers:{'content-type':'application/json'}, body: JSON.stringify(cuerpo) });
  const j = await p.json();
  if (!p.ok) throw new Error('el motor contestó ' + p.status + ': ' + JSON.stringify(j).slice(0,200));
  return j.datos || j.resultado || j;
}

(async () => {
  const comun = { elementos: BASE, radioM: 1000, centro: CENTRO,
                  tipoEstudio: 'completo', proyectoId: 'cafe_paso' };
  const ANALISIS = {
    edu: await pedirAlMotor(Object.assign({}, comun, { caminabilidad: CAMINA })),
    emp: await pedirAlMotor(comun),
    empFicha: await pedirAlMotor(comun)
  };
  const b = await chromium.launch({ executablePath: ENT.CHROMIUM });
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.setContent('<div id="x"></div>');
  await pg.addScriptTag({ path: REPO + '/js/59-analisis-ia-catalogo.js' });
  await pg.addScriptTag({ path: REPO + '/js/67-analisis-cliente.js' });
  await pg.addScriptTag({ path: REPO + '/js/63-analisis-ia-informe.js' });

  const r = await pg.evaluate(async (ANALISIS) => {
    const I = window.AIA_INFORME;
    // El análisis lo pide Node al motor y llega ya hecho: desde una página en
    // blanco el navegador no puede llamarlo (origen «null»), y lo que esta
    // prueba mira no es la llamada sino lo que el informe hace con la
    // respuesta.
    const analizar = (cuerpo) => ANALISIS[cuerpo.marca];
    const centro = { lat: 7.9168, lng: -72.4727 };
    let id = 1;
    const el = (t,d,a) => { const rad=a*Math.PI/180;
      return { type:'node', id:id++, lat:centro.lat+(d*Math.cos(rad))/110540,
               lon:centro.lng+(d*Math.sin(rad))/(111320*Math.cos(centro.lat*Math.PI/180)), tags:t }; };
    const base = Array.from({length:12},(_,i)=>el({'urbis:sub':'comercio_otro'},200,i*30))
      .concat(Array.from({length:20},(_,i)=>el({'urbis:sub':'residencial'},300,i*18)))
      .concat([el({highway:'trunk',name:'Anillo'},80,0)]);

    const cam = { muestras:8, indice:0.5, factor:0.93, continuo:3, interrumpido:2,
                  sinAnden:3, rampas:1, nivel:'Irregular' };
    const rEdu = analizar({ marca:'edu', elementos: base, radioM:1000, centro,
      tipoEstudio:'completo', proyectoId:'cafe_paso', caminabilidad: cam });
    rEdu.edu = { puntosDelCurso: 32, leidos: 32, sinTraducir:{}, ciudad:'Cúcuta',
      edificacion: { total:14, conEpoca:12, conMaterial:11, evaluables:9,
        porEpoca:{ 'Anterior a 1950':2, '1950 – 1983 (sin norma sismo resistente)':6,
                   '2010 o posterior (NSR-10)':4 },
        porMaterial:{ 'Mampostería confinada (ladrillo con vigas y columnas)':7,
                      'Bahareque o tapia pisada':4 },
        alta:4, media:3, baja:2, anteriores1984:8, patrimonio:2, enObra:1,
        noSeSabe:3, otros:1, textosOtro:['Contenedor marítimo adaptado'] } };

    // El MISMO análisis sin `edu`: es un informe de empresas y no debe cambiar.
    const rEmp = analizar({ marca:'emp', elementos: base, radioM:1000, centro,
      tipoEstudio:'completo', proyectoId:'cafe_paso' });

    // Modo EMPRESAS con ficha: el analista levantó usos desde la calle. La
    // ficha llega por `r.campo`, no por `r.edu`.
    const rEmpFicha = analizar({ marca:'empFicha', elementos: base, radioM:1000, centro,
      tipoEstudio:'completo', proyectoId:'cafe_paso' });
    rEmpFicha.campo = { edificacion: {
      total:5, conEpoca:5, conMaterial:5, evaluables:5,
      porEpoca:{ '1950 – 1983 (sin norma sismo resistente)':3, '2010 o posterior (NSR-10)':2 },
      porMaterial:{ 'Mampostería sin confinar (ladrillo o bloque solo)':3,
                    'Concreto reforzado (pórticos o muros)':2 },
      alta:3, media:0, baja:2, anteriores1984:3, patrimonio:0, enObra:0,
      noSeSabe:0, otros:0, textosOtro:[] } };

    const opt = { estilo:'institucional', horizontal:true, autor:'Ejercicio educativo · URBIS' };
    return { edu: I.construirHTMLEjecutivo(rEdu, {}, opt),
             emp: I.construirHTMLEjecutivo(rEmp, {}, opt),
             empFicha: I.construirHTMLEjecutivo(rEmpFicha, {}, opt) };
  }, ANALISIS);

  const ok=[],fallo=[]; const chk=(c,t)=>(c?ok:fallo).push(t);
  const E = r.edu, P = r.emp;

  console.log('══ EL PDF EDUCATIVO TRAE LO LEVANTADO ═════════════════════════');
  chk(/Lo levantado en campo/.test(E), 'el informe abre una sección para el trabajo de campo');
  chk(/El tejido construido/.test(E), 'con el tejido construido');
  chk(/Época de construcción/.test(E) && /1950 – 1983/.test(E),
      'el desglose por época, con los cortes de la norma sismo resistente');
  chk(/Bahareque o tapia pisada/.test(E), 'el material predominante');
  chk(/Vulnerabilidad potencial/.test(E), 'y la vulnerabilidad potencial');
  chk(/Decreto 1400 de 1984/.test(E),
      'citando la norma que hace significativo el corte, no una década a ojo');
  chk(/no es un diagnóstico estructural/i.test(E),
      'y advirtiendo que NO es un diagnóstico estructural');
  chk(/podrían ser patrimonio/.test(E), 'lo anterior a 1950 se señala como posible patrimonio');
  chk(/no se sabe/i.test(E) && /otro/i.test(E),
      'los límites declarados por el curso también salen en el PDF');

  console.log('══ Y LA CAMINABILIDAD ═════════════════════════════════════════');
  chk(/Caminabilidad/.test(E), 'el andén tiene su propio bloque');
  chk(/Irregular/.test(E), 'con el nivel observado');
  chk(/Andén continuo/.test(E) && /Sin andén/.test(E), 'y el desglose de lo observado');
  chk(/deja caminar a los que ya hay/.test(E),
      'explicando por qué ajusta y no suma: un andén no genera peatones');

  console.log('══ EL INFORME DE EMPRESAS NO CAMBIA ═══════════════════════════');
  chk(!/Lo levantado en campo/.test(P),
      'sin datos de campo NO se inventa la sección: nadie fue a mirar, y decirlo con ceros mentiría');
  chk(!/El tejido construido/.test(P), 'ni el tejido construido');
  chk(/El entorno según la distancia/.test(P) && /El entorno según la distancia/.test(E),
      'las secciones de siempre siguen en los dos');
  const nums = h => (h.match(/<div class="sec"><b>(\d+)\./g)||[])
    .map(x => parseInt(x.match(/>(\d+)\./)[1], 10));
  const numEdu = nums(E), numEmp = nums(P);
  console.log('  numeración — educativo: ' + numEdu.join(',') );
  console.log('              empresas : ' + numEmp.join(','));
  chk(numEdu.length === numEmp.length + 1,
      'el educativo tiene exactamente una sección más (' + numEdu.length +
      ' vs ' + numEmp.length + ')');
  chk(new Set(numEdu).size === numEdu.length,
      'y ningún número de sección se repite al insertarla en medio');
  chk(numEdu.every((n,i) => i === 0 || n >= numEdu[i-1]),
      'la numeración sigue en orden ascendente');

  console.log('\n══ EMPRESAS CON FICHA LEVANTADA EN CAMPO ══════════════════════');
  const F = r.empFicha;
  chk(/Lo levantado en campo/.test(F),
      'un análisis de empresas CON ficha sí trae la sección: el informe pregunta si hay ' +
      'ficha, no de qué modo viene');
  chk(/El tejido construido/.test(F) && /Mampostería sin confinar/.test(F),
      'con el material y la época que el analista anotó frente al inmueble');
  chk(/Decreto 1400 de 1984/.test(F), 'y la misma advertencia normativa que en el educativo');
  chk(!/Caminabilidad/.test(F),
      'pero SIN el bloque de andén: eso solo se observa mapeándolo, y aquí nadie lo hizo');
  chk(/Caminabilidad/.test(E),
      'mientras que en el educativo, que sí lo observó, el bloque está');
  const numF = nums(F);
  chk(numF.length === numEmp.length + 1 && new Set(numF).size === numF.length,
      'la numeración también cuadra en empresas con ficha (' + numF.length + ')');

  // ── La exportación geográfica ─────────────────────────────────────────
  const pg2 = await b.newPage();
  pg2.on('pageerror', e => errs.push('exp: ' + e.message));
  await pg2.setContent('<div id="x"></div>');
  await pg2.evaluate(() => {
    window.URBIS_CONFIG = { TEMP_REPORT_TTL_HOURS: 8 };
    const chain = new Proxy(function(){}, {
      get:(t,k)=>(k===Symbol.toPrimitive||k==='then')?undefined:chain,
      apply:()=>chain, construct:()=>chain });
    window.L = chain; window.map = chain;
  });
  for (const f of ['00-config','00-app-shell','01-audio-feedback','02-auth-roles',
                   '03-map-data-config','03b-edificio-vocabulario','04-marker-proximity']) {
    try { await pg2.addScriptTag({ path: REPO + '/js/' + f + '.js' }); } catch(e){}
  }
  const exp = await pg2.evaluate(() => {
    const E = window.URBIS_EDIFICIO;
    const usos = E.todosLosUsos();
    const flags = usos.map(u => (u === 'Comercial' || u === 'Deportivo') ? 'SI' : 'NO');
    const desc = ['Comercial · Local pequeño (tienda de barrio)','Tienda Doña Ana','n','Bueno','Activo','N/A']
      .concat(flags)
      .concat(['N/A','Aprobado','A','edu','0','a@b.c','1','C'])
      .concat(['2026-08-20T10:00:00Z','N/A','Permanente','Activo','General'])
      .concat(['Bahareque o tapia pisada','2','Comercio o local con vitrina',
               'Anterior a 1950','']).join(' | ');
    // Se replica el volcado que hace js/26 al recolectar un punto.
    const fi = E.leer(desc);
    const reg = { nombre:'Tienda Doña Ana', grupo:'Comercio', gid:'com' };
    if (fi.materialidadUtil) reg.materialidad = fi.materialidadUtil;
    if (fi.pisosRegistrados) reg.pisos = fi.pisos;
    if (fi.plantaBaja) { reg.planta_baja = fi.plantaBaja;
                         reg.frente_activo = fi.frenteActivo ? 'si' : 'no'; }
    if (fi.epoca) reg.epoca = fi.epoca;
    if (fi.vulnerabilidad) reg.vulnerabilidad = fi.vulnerabilidad.nivel;
    const marcados = E.usosMarcados(desc);
    if (marcados.length) { reg.usos = marcados.join('; '); reg.n_usos = marcados.length; }
    // Y un punto sin ficha: no debe arrastrar propiedades vacías.
    const fi2 = E.leer('Comercial · Otro | x | y');
    return { reg: reg, claves: Object.keys(reg),
             sinFicha: { mat: fi2.materialidadUtil, pisos: fi2.pisosRegistrados,
                         frente: fi2.frenteActivo, ep: fi2.epoca } };
  });

  console.log('\n══ LA FICHA SOBREVIVE A LA EXPORTACIÓN ════════════════════════');
  console.log('  propiedades del punto: ' + exp.claves.join(', '));
  const g = exp.reg;
  chk(g.materialidad === 'Bahareque o tapia pisada', 'el material viaja al archivo');
  chk(g.pisos === 2, 'los pisos también');
  chk(g.planta_baja === 'Comercio o local con vitrina' && g.frente_activo === 'si',
      'y qué hay a nivel de calle, ya resuelto a frente activo');
  chk(g.epoca === 'Anterior a 1950', 'la época');
  chk(g.vulnerabilidad === 'Alta',
      'y la vulnerabilidad ya calculada, para no obligar a rehacer el cruce fuera');
  chk(g.usos === 'Comercial; Deportivo' && g.n_usos === 2,
      'los usos múltiples van como texto separado por ";": ni el DBF de un shapefile ' +
      'ni Google Earth admiten listas');
  chk(!exp.sinFicha.mat && !exp.sinFicha.pisos && exp.sinFicha.frente === null,
      'un punto sin ficha no arrastra propiedades vacías a la tabla de atributos');

  chk(errs.length===0, 'sin errores de página' + (errs.length?': '+errs[0]:''));
  console.log('\n' + ok.map(t=>'✅ '+t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t=>'❌ '+t).join('\n'));
  console.log('\n' + ok.length + '/' + (ok.length+fallo.length));
  await b.close(); process.exit(fallo.length?1:0);
})();
