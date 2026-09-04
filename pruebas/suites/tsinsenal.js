const E = require('../entorno.js');
/* Tanda Z · llevarse el sector a la calle.

   «Lo intangible» es la herramienta hecha para caminar, y caminando no hay
   señal. Sin las teselas guardadas el mapa queda gris, y sobre un mapa gris
   no se puede señalar dónde está oscuro.

   La prueba baja el mapa de un sector y después CORTA LA RED de verdad
   —todas las peticiones a las teselas se abortan— y comprueba que las
   imágenes siguen apareciendo. Es la única forma de probar esto: contar
   archivos guardados no dice nada si el service worker no los sirve.

   Se comprueba además la aritmética de las teselas contra una respuesta
   conocida, porque un error de un factor de dos ahí no se nota mirando —el
   mapa sale igual— y se paga en megas del plan de datos de un estudiante. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

let id=1;
const usos=[];
for(let i=0;i<12;i++){ const a=i*30*Math.PI/180, d=(160+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

// Un PNG de un píxel, que es lo que va a contestar cada tesela.
const PNG=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  /* El service worker tiene que estar VIVO: es quien sirve las teselas
     guardadas, y sin él esta prueba comprobaría el depósito y no la función.
     Por eso, y a diferencia del resto de las suites, no se bloquea. */
  const ctx=await b.newContext({timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
  }catch(e){} });

  let hayRed=true, pedidas=0, servidasPorLaRed=0;

  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  /* DESPUÉS del comodín, y no antes: en Playwright la ruta que manda es la
     registrada última. Puesta arriba, el comodín se comía las teselas y la
     prueba medía un depósito que nunca se llenó. */
  /* Cualquier servidor de teselas, no uno concreto: el modo educativo
     arranca con el satélite y la primera versión de esta prueba interceptaba
     solo cartocdn, así que medía un mapa que nadie estaba mirando. */
  await ctx.route(/basemaps\.cartocdn\.com|arcgisonline\.com|maptiles\.arcgis\.com|mt\d\.google\.com\/vt/, r=>{
    pedidas++;
    if(!hayRed){ r.abort('failed'); return; }
    servidasPorLaRed++;
    r.fulfill({status:200,contentType:'image/png',body:PNG});
  });
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',
    body:fs.readFileSync(S+'node_modules/chart.js/dist/chart.umd.js','utf8')}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',suburb:'La Playa'}})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4000);
  // Que el service worker haya tomado el control antes de seguir.
  const swListo=await pg.evaluate(()=>navigator.serviceWorker
    ? navigator.serviceWorker.ready.then(()=>!!navigator.serviceWorker.controller)
        .catch(()=>false)
    : false);
  if(!swListo) await pg.reload({waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2500);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON, SS=window.URBIS_SIN_SENAL;
    o.hayModulo=!!SS;
    o.controlado=!!(navigator.serviceWorker && navigator.serviceWorker.controller);

    /* ── La aritmética, contra una respuesta conocida ────────────────────
       Un cuadrado de 100 m de lado en el ecuador, al zoom 18. Una tesela de
       ese nivel mide unos 152 m de lado ahí, así que el cuadrado cae en una
       o dos, nunca en veinte. Se comprueba sin margen para que la cuenta sea
       la de la fórmula y no la del margen. */
    const cuadrado=[{lat:0,lng:0},{lat:0.0009,lng:0},{lat:0.0009,lng:0.0009},{lat:0,lng:0.0009}];
    const t18=SS.teselasDe(cuadrado,0).filter(t=>t.z===18);
    o.cuadrado={ n:t18.length, zooms:[...new Set(SS.teselasDe(cuadrado,0).map(t=>t.z))] };
    // La Y crece hacia el sur: el norte del área tiene que dar la Y menor.
    const alto=[{lat:0.02,lng:0},{lat:0.02,lng:0.001},{lat:0,lng:0.001},{lat:0,lng:0}];
    const ts=SS.teselasDe(alto,0).filter(t=>t.z===18);
    o.ejeY={ minY:Math.min(...ts.map(t=>t.y)), maxY:Math.max(...ts.map(t=>t.y)) };

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(400); } };
    await abrir();

    const bloque=()=>{ const c=[...H().querySelectorAll('.pcr-medir')]
      .filter(x=>/Llevárselo a la calle|Guardando el mapa/.test(x.textContent||''))[0];
      return c?(c.textContent||'').replace(/\s+/g,' ').trim():''; };
    o.antes=bloque();
    o.estimado=SS.estimar(R.contornoDelSector());
    /* La comprobación que hizo falta: que la dirección que se va a guardar sea
       la del mapa QUE ESTÁ PUESTO. La primera versión guardaba una plantilla
       escrita a mano y bajaba teselas de otro mapa. */
    o.capa=(function(){ const c=SS.capaBase(); return c?c._url:''; })();
    o.urlEjemplo=SS.urlDe({z:16,x:19567,y:31325});

    /* ── Guardarlo, contando lo que le cuesta a la hoja ────────────────
       Llegó reportado desde el celular: mientras guardaba, la hoja saltaba
       arriba y no dejaba bajar, y al final ni guardaba. La causa era que el
       avance repintaba la hoja ENTERA por cada imagen —eran más de
       cuatrocientas—, y cada `innerHTML` nuevo tira el punto de lectura.

       Se mide de dos maneras, porque una sola no basta: cuántas veces se
       reconstruye la hoja, y si el sitio donde estabas leyendo sigue donde
       estaba. La segunda es la que el usuario nota. */
    const hoja=H();
    let reconstrucciones=0;
    const obs=new MutationObserver(ms=>{
      ms.forEach(m=>{ if(m.type==='childList' && m.target===hoja) reconstrucciones++; });
    });
    obs.observe(hoja,{childList:true});
    /* El que se desplaza no es la hoja sino un hijo suyo. Buscarlo en vez de
       suponerlo: medir el scroll del elemento equivocado da cero siempre y la
       comprobación pasa sin comprobar nada. */
    const scroller = (function(){
      if (hoja.scrollHeight - hoja.clientHeight > 40) return hoja;
      return hoja.querySelector('.pcr-cuerpo') ||
        [...hoja.querySelectorAll('*')]
        .filter(e=>e.scrollHeight - e.clientHeight > 40)
        .sort((a,b)=>b.scrollHeight-a.scrollHeight)[0] || hoja;
    })();
    scroller.scrollTop = Math.round((scroller.scrollHeight - scroller.clientHeight) * 0.5);
    const dondeIba = scroller.scrollTop;

    H().querySelector('[data-pcr="teselas"]').click();
    /* Se muestrea seguido desde el primer instante: con el arreglo, 149
       imágenes se guardan tan rápido que a los 700 ms ya había terminado y la
       prueba miraba el bloque de después. */
    o.durante=''; o.scrollDurante=dondeIba;
    for(let i=0;i<200;i++){
      const t=bloque();
      if(/Guardando el mapa/.test(t)){ o.durante=t;
        const sc=H().querySelector('.pcr-cuerpo')||scroller;
        o.scrollDurante=sc.scrollTop; break; }
      if(i>6 && !/Guardando/.test(t) && o.durante) break;
      await esperar(20);
    }
    o.seQuedoDondeIba = dondeIba > 0 && Math.abs(o.scrollDurante - dondeIba) < 40;
    o.scrollAntes = dondeIba;
    for(let i=0;i<120 && /Guardando el mapa/.test(bloque());i++) await esperar(300);
    obs.disconnect();
    o.reconstrucciones = reconstrucciones;
    await esperar(600); await abrir();
    o.despues=bloque();
    o.medida=await SS.medida();
    return o;
  },{C,POL});

  const pedidasTrasGuardar=pedidas;

  // ══ SE CORTA LA RED ═══════════════════════════════════════════════════
  hayRed=false;
  const antesDeMirar=servidasPorLaRed;

  const sinRed=await pg.evaluate(async (D)=>{
    const {C}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON;
    R.cerrar(); await esperar(300);
    /* Se mueve el mapa a una esquina del sector y se acerca, para forzar la
       petición de teselas que todavía no se habían pintado. Con la red
       cortada, las que aparezcan salieron del depósito. */
    window.map.setView([C.lat+0.003,C.lng-0.003],18);
    await esperar(2500);
    const imgs=[...document.querySelectorAll('.leaflet-tile')];
    o.total=imgs.length;
    o.cargadas=imgs.filter(i=>i.complete && i.naturalWidth>0).length;
    o.rotas=imgs.filter(i=>i.complete && i.naturalWidth===0).length;
    o.pedida=imgs.length?imgs[0].src:'';
    o.guardadas=await (async()=>{
      try{ const c=await caches.open('urbis-teselas-v1'); const k=await c.keys();
        return { n:k.length, ejemplo:k.length?k[0].url:'' }; }
      catch(e){ return { n:-1, ejemplo:String(e) }; }
    })();
    o.aciertoDirecto=await (async()=>{
      try{ const c=await caches.open('urbis-teselas-v1');
        return !!(await c.match(o.pedida,{ignoreVary:true})); }
      catch(e){ return String(e); }
    })();
    return o;
  },{C});

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- la aritmética de las teselas --');
  T('el módulo está cargado', r.hayModulo===true);
  T('baja las tres escalas que sirven caminando',
    JSON.stringify(r.cuadrado.zooms)==='[16,17,18]', JSON.stringify(r.cuadrado.zooms));
  /* Cien metros de lado al zoom 18, donde la tesela mide unos 152 m: cae en
     una o en dos según dónde queden los cortes, nunca en veinte. Un error de
     un factor de dos acá no se ve mirando el mapa y se paga en megas. */
  T('cien metros de lado caben en una o dos teselas del 18',
    r.cuadrado.n>=1 && r.cuadrado.n<=4, r.cuadrado.n+' teselas');
  T('y el eje Y crece hacia el sur, como manda la proyección',
    r.ejeY.minY < r.ejeY.maxY, 'norte '+r.ejeY.minY+' → sur '+r.ejeY.maxY);

  console.log('\n  -- guarda el mapa que está puesto --');
  /* Lo que costó una tanda entera descubrir: el modo educativo arranca con el
     satélite, no con el mapa base por omisión. Guardar una plantilla escrita a
     mano bajaba dos mil teselas de un mapa que nadie miraba y dejaba la
     pantalla igual de gris. */
  T('le pregunta a Leaflet cuál es la capa', !!r.capa, r.capa);
  /* Y con el ZOOM que se le pide. `capa.getTileUrl()` toma la X y la Y de lo
     que se le pasa y el zoom del mapa que se está mirando: con el mapa en 15,
     guardaba las coordenadas del 16, 17 y 18 todas con z=15. Ciento cuarenta
     y nueve direcciones distintas, todas equivocadas. */
  T('y arma la dirección con el zoom que se le pide, no con el de la pantalla',
    /(^|[/=&])16([&/]|$)/.test(r.urlEjemplo||'') &&
    !/z=15|\/15\//.test(r.urlEjemplo||''), r.urlEjemplo);

  console.log('\n  -- antes de guardar --');
  T('el bloque dice para qué sirve',
    /mapa gris/.test(r.antes) && /antes de salir/.test(r.antes));
  T('y cuánto va a pesar, antes de bajarlo',
    /imágenes, cerca de/.test(r.antes) && r.estimado.teselas>0,
    r.estimado.teselas+' teselas · '+r.estimado.mb+' MB');
  T('avisando de que guarda el mapa y no el análisis',
    /guarda el mapa.*no el análisis/i.test(r.antes.replace(/\s+/g,' ')));

  console.log('\n  -- guardando --');
  T('muestra el avance', /Guardando el mapa · \d+ de \d+/.test(r.durante||''),
    (r.durante||'').slice(0,60));
  T('y se puede parar', /Parar/.test(r.durante||''));
  /* El mapa de la pantalla también pide teselas mientras esto corre, así que
     el contador de la red lleva unas cuantas de más. Lo que se comprueba es
     que no falte ninguna y que no se dispare. */
  T('bajó lo que dijo que iba a bajar',
    pedidasTrasGuardar >= r.estimado.teselas && pedidasTrasGuardar <= r.estimado.teselas + 40,
    pedidasTrasGuardar+' pedidas contra '+r.estimado.teselas+' estimadas');
  /* Casi todas, no todas: con un mapa de satélite las respuestas son opacas y
     Chromium cobra su cuota con un relleno de varios megas por tesela, así
     que las últimas pueden no caber. Lo que no puede pasar es que se guarde
     la mitad y la aplicación diga que está listo — por eso además se
     comprueba abajo que el mapa se vea DE VERDAD sin red. */
  T('y quedó guardada la gran mayoría',
    r.medida.hay===true && r.medida.teselas >= Math.round(r.estimado.teselas * 0.7),
    r.medida.teselas+' guardadas de '+r.estimado.teselas);
  T('avisando de que el satélite pesa y puede no caber entero',
    !r.estimado.foto || /satélite/.test(r.antes||''), r.estimado.foto?'con satélite':'con dibujo');
  T('el bloque lo dice', /teselas guardadas/.test(r.despues||'') &&
    /sin señal/.test(r.despues||''), (r.despues||'').slice(0,90));

  console.log('\n  -- y ahora, sin red --');
  T('el service worker está al mando', r.controlado===true);
  T('el mapa sigue pintando teselas', sinRed.cargadas>0,
    sinRed.cargadas+' de '+sinRed.total+' cargadas');
  T('y ninguna sale rota', sinRed.rotas===0, sinRed.rotas+' rotas');
  /* La comprobación que hace que las dos anteriores signifiquen algo: si la
     red hubiera seguido contestando, esto no probaría nada. */
  T('sin que la red haya servido una sola', servidasPorLaRed===antesDeMirar,
    servidasPorLaRed+' servidas por la red, ninguna nueva');

  // Solo cuando algo falló: en verde, esto es ruido; en rojo, es media hora
  // de trabajo ahorrada averiguando si el problema es la clave o el depósito.
  if (mal) {
  console.log('\n  [depuración]');
  console.log('    pedida por el mapa : ' + (sinRed.pedida||'—'));
  console.log('    guardada de ejemplo: ' + ((sinRed.guardadas||{}).ejemplo||'—'));
  console.log('    teselas en depósito: ' + ((sinRed.guardadas||{}).n));
  console.log('    acierto directo    : ' + sinRed.aciertoDirecto);
  console.log('    peticiones de red  : ' + pedidas + ' (antes de mirar: ' + pedidasTrasGuardar + ')');
  }

  console.log('\n  -- guardando, la hoja se puede seguir leyendo --');
  /* La reconstrucción de la hoja tira el punto de lectura. Con una por
     imagen, la hoja saltaba arriba cuatrocientas veces y era imposible
     bajar. Se admite alguna —al empezar y al terminar— pero no una por
     tesela. */
  T('no se reconstruye la hoja una vez por imagen',
    r.reconstrucciones <= 6,
    r.reconstrucciones + ' reconstrucciones para ' + (r.medida ? r.medida.teselas : '?') +
    ' teselas');
  T('y el punto donde estabas leyendo se queda quieto',
    r.seQuedoDondeIba === true,
    'iba por ' + r.scrollAntes + ' px y quedó en ' + r.scrollDurante);

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
