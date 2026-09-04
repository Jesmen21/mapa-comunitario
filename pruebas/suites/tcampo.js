const E = require('../entorno.js');
/* Tanda F · lo levantado en campo, dentro del análisis.

   La comparación con lo que mapeó el curso existía como pantalla aparte,
   colgada de una ficha guardada. El problema de tenerla aparte era que no
   entraba en el análisis: la síntesis y la lámina hablaban del sector como si
   nadie lo hubiera caminado. Acá se comprueba que ahora corra sobre el área en
   pantalla y alimente las dos.

   El padrón está armado para que las cuatro cajas salgan exactas:
   · 2 puntos del curso encima de dos droguerías del mapa, declarados como
     salud → CONFIRMADOS (misma categoría).
   · 1 encima de un restaurante, declarado como educativo → DISCREPANCIA.
   · 3 lejos de todo → NUEVOS, y uno de ellos (una vivienda) sin etiqueta OSM.
   · quedan 3 puntos del mapa que nadie tocó → SIN VERIFICAR.       */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

// Metros → grados, para poder separar puntos a distancias conocidas.
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));

/* Seis usos del mapa, bien separados entre sí (300 m) para que ningún punto
   del curso caiga por accidente dentro de los 35 m de otro. */
let id=1;
const P=(dx,dy,tags)=>({type:'node',id:id++,lat:C.lat+GLAT(dy),lon:C.lng+GLNG(dx),tags:tags});
const usos=[
  P(-300, 300,{amenity:'pharmacy',   name:'Droguería Norte'}),
  P(   0, 300,{amenity:'pharmacy',   name:'Droguería Centro'}),
  P( 300, 300,{amenity:'pharmacy',   name:'Droguería Sur'}),
  P(-300,   0,{amenity:'restaurant', name:'Restaurante Uno'}),
  P(   0,   0,{amenity:'restaurant', name:'Restaurante Dos'}),
  P( 300,   0,{amenity:'restaurant', name:'Restaurante Tres'})
];

/* Lo que levantó el curso. La descripción es la etiqueta que arma la app
   educativa: «Uso · Tipo | nota». Acá basta el uso. */
const delCurso=[
  { lat:C.lat+GLAT(300), lng:C.lng+GLNG(-300), descripcion:'Salud (Clínicas/Hospitales)' },
  { lat:C.lat+GLAT(300), lng:C.lng+GLNG(   0), descripcion:'Salud (Clínicas/Hospitales)' },
  { lat:C.lat,           lng:C.lng+GLNG(-300), descripcion:'Educativo (Básico/Superior)' },
  { lat:C.lat+GLAT(-300),lng:C.lng+GLNG(-300), descripcion:'Comercial' },
  { lat:C.lat+GLAT(-300),lng:C.lng+GLNG( 300), descripcion:'Comercial' },
  /* Una vivienda: es un hallazgo válido y entra en la comparación, pero NO
     tiene etiqueta estándar de OpenStreetMap para un punto, así que se queda
     fuera del archivo y sale en la lista para ponerla a mano. */
  { lat:C.lat+GLAT(-300),lng:C.lng+GLNG(   0), descripcion:'Residencial' }
];

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
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
  await pg.waitForTimeout(3400);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL,delCurso}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    // Los puntos del curso: la ficha los pide por acá.
    window.urbisDatosVisibles=function(){ return delCurso; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    let lamina=''; window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ lamina=h; };

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const grupo=cl=>[...H().querySelectorAll('.pcr-sintesis-'+cl+' li')]
      .map(li=>txt(li.querySelector('span'))+' ‹'+txt(li.querySelector('b'))+'›');

    // Antes de comparar: el bloque ofrece el botón y la síntesis lo pide.
    o.hayBoton=!!H().querySelector('[data-pcr="campo"]');
    o.diceCuantos=/Hay 6 puntos del curso/.test(txt(H()));
    o.antesFalta=grupo('falta');
    o.antesSinCifras=!/coinciden con el mapa/.test(txt(H()));

    H().querySelector('[data-pcr="campo"]').click();
    for(let i=0;i<60 && !/coinciden con el mapa/.test(txt(H()));i++) await esperar(400);
    await esperar(400);

    const todo=txt(H());
    const i=todo.indexOf('Lo levantado en campo');
    o.bloque=i>=0?todo.slice(i,i+1600):'';
    o.kpis=[...H().querySelectorAll('.pcr-kpi')].map(txt).filter(x=>/coinciden|encontrados|no coinciden/i.test(x));
    o.favor=grupo('bien'); o.contra=grupo('mal'); o.falta=grupo('falta');
    o.filas=[...H().querySelectorAll('.pcr-lote-fila')].map(txt);

    // ── Devolverle el dato al mapa
    o.hayBotonOSM=!!H().querySelector('[data-pcr="osm"]');
    o.hayBotonLista=!!H().querySelector('[data-pcr="osm-texto"]');
    o.avisos=txt(H()).indexOf('Devolverlo al mapa')>=0
      ? txt(H()).slice(txt(H()).indexOf('Devolverlo al mapa'), txt(H()).indexOf('Devolverlo al mapa')+1600)
      : '';
    const R2=window.URBIS_PC_RECON;
    /* Lo que se exporta tiene que ser exactamente lo que la ficha está
       mostrando, así que se pide la comparación que ella misma tiene. */
    const cmp=R2.campoActual();
    o.osm=R2.construirOSM(cmp) || '';
    o.lista=R2.textoCorrecciones(cmp) || '';
    o.vacioNoRompe=(R2.construirOSM(null)==='' && R2.textoCorrecciones(null)==='');
    o.tagsDeNuevos=(cmp&&cmp.nuevos||[]).map(n=>JSON.stringify(n.tags||null));

    // A la lámina.
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='Sector con trabajo de campo';
    const bl=H().querySelector('[data-pcr="lamina"]');
    if(bl){ bl.click(); await esperar(500); }
    o.lamina=lamina;

    // Y que la ficha guardada no lo pierda.
    const bg=[...H().querySelectorAll('button')].filter(x=>/Guardar ficha/i.test(x.textContent||''))[0];
    if(bg){ bg.click(); await esperar(700); }
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(800);
    const cabs=[...document.querySelectorAll('.pcr-pest-cab')];
    const cab=cabs.filter(x=>/trabajo de campo/.test(x.textContent||''))[0]||cabs[0];
    if(cab){ cab.click(); await esperar(800); }
    const pest=document.querySelector('.pcr-pestana');
    o.enGuardada=pest?txt(pest):'';
    return o;
  },{C,POL,delCurso});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const B=r.bloque||'', LAM=r.lamina||'';
  const kpi=re=>{
    const k=(r.kpis||[]).filter(x=>re.test(x))[0];
    if(!k) return null;
    const m=k.match(/^(\d+)/);
    return m?Number(m[1]):null;
  };

  console.log('\n  -- se pide, y solo si hay con qué --');
  T('ofrece el botón cuando el curso tiene puntos', r.hayBoton);
  T('y dice cuántos hay', r.diceCuantos);
  T('antes de pulsarlo no muestra cifras', r.antesSinCifras);
  T('y la síntesis lo pide',
    (r.antesFalta||[]).some(x=>/Comparar el análisis con lo que ya mapeó el curso/.test(x)),
    (r.antesFalta||[]).filter(x=>/curso/.test(x))[0]||'no lo pide');

  console.log('\n  -- las cuatro cajas, contra el padrón armado a mano --');
  T('2 del curso encima de dos droguerías, y coinciden', kpi(/coinciden con el mapa/)===2,
    'esperado 2 · da '+kpi(/coinciden con el mapa/));
  T('3 lejos de todo son hallazgos nuevos', kpi(/encontrados por el curso/)===3,
    'esperado 3 · da '+kpi(/encontrados por el curso/));
  T('1 encima de un restaurante, declarado educativo, no coincide',
    kpi(/no coinciden/)===1, 'esperado 1 · da '+kpi(/no coinciden/));
  T('y quedan 3 del mapa sin verificar', /3 registros del mapa quedaron/.test(B),
    (B.match(/(\d+) registros del mapa quedaron/)||['no lo dice'])[0]);

  console.log('\n  -- lo que se lee --');
  T('resume cuántos están bien de los revisados', /2 de 3<\/b>|2 de 3/.test(B),
    (B.match(/De lo que el curso revisó[^.]*\./)||['no lo dice'])[0].slice(0,90));
  T('lista lo que el curso agrega al mapa', /Lo que el curso agrega al mapa/.test(B));
  T('y dónde el mapa y la calle no coinciden, con las dos categorías',
    /Donde el mapa y la calle no coinciden/.test(B) && /→/.test(B),
    (r.filas||[]).filter(x=>/→/.test(x))[0]||'no sale');
  T('«sin verificar» no se confunde con «cerrado»',
    /No quiere decir que hayan cerrado/.test(B));
  T('dice a qué distancia considera que es el mismo sitio', /menos de 35 m/.test(B));

  console.log('\n  -- entra en la síntesis --');
  T('los hallazgos nuevos, a favor',
    (r.favor||[]).some(x=>/encontró usos que no estaban/.test(x)),
    (r.favor||[]).filter(x=>/curso/.test(x))[0]||'no sale');
  T('las discrepancias, en contra',
    (r.contra||[]).some(x=>/no coinciden/.test(x)),
    (r.contra||[]).filter(x=>/coinciden/.test(x))[0]||'no sale');
  T('y lo que falta recorrer, como tarea',
    (r.falta||[]).some(x=>/registros sin verificar/.test(x)),
    (r.falta||[]).filter(x=>/verificar/.test(x))[0]||'no sale');
  T('ya no pide comparar lo que ya se comparó',
    !(r.falta||[]).some(x=>/Comparar el análisis/.test(x)));

  console.log('\n  -- la lámina --');
  T('trae la caja de campo', /Lo levantado en campo<\/h2>/.test(LAM));
  T('y marca en el plano lo que encontró el curso',
    (LAM.match(/<path d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+Z" fill="[^"]*" stroke="#0F1F2E"/g)||[]).length===3,
    (LAM.match(/stroke="#0F1F2E" stroke-width=".6"/g)||[]).length+' rombos');
  T('con su convención', /Encontrado por el curso/.test(LAM));

  console.log('\n  -- devolverle el dato a OpenStreetMap --');
  T('ofrece el archivo para JOSM', r.hayBotonOSM);
  T('y la lista para revisar', r.hayBotonLista);
  const OSM=r.osm||'';
  T('el archivo es un .osm válido',
    /^<\?xml version="1.0" encoding="UTF-8"\?>/.test(OSM) && /<osm version="0.6"/.test(OSM) && /<\/osm>/.test(OSM));
  T('solo entran los hallazgos con etiqueta estándar: la vivienda queda fuera',
    (OSM.match(/<node /g)||[]).length===2, (OSM.match(/<node /g)||[]).length+' nodos de 3 hallazgos');
  T('con identificadores negativos, que es «todavía no existe»',
    (OSM.match(/id="-\d+"/g)||[]).length===2, (OSM.match(/id="-\d+"/g)||[]).join(' '));
  T('traduce a etiqueta de OpenStreetMap, no a la nuestra',
    /<tag k="shop" v="yes"\/>/.test(OSM),
    (OSM.match(/<tag k="(shop|amenity|office|leisure)" v="[^"]+"\/>/)||['no traduce'])[0]);
  T('y NO deja escapar vocabulario privado', !/urbis:/.test(OSM),
    (OSM.match(/k="urbis:[^"]*"/g)||['ninguno']).join(' '));
  T('marca que fue levantado en la calle',
    (OSM.match(/k="source" v="survey"/g)||[]).length===2 && /k="survey:date"/.test(OSM));
  T('el bloque dice cuántos quedaron fuera y por qué',
    /1 de los 3<\/b> no entran|1 de los 3 no entran/.test(r.avisos||''),
    ((r.avisos||'').match(/\d+ de los \d+ no entran[^.]*\./)||['no lo dice'])[0].slice(0,80));
  const LI=r.lista||'';
  T('la lista separa lo que se agrega de lo que se corrige',
    /AGREGAR \(3\)/.test(LI) && /CORREGIR \(1\)/.test(LI),
    (LI.match(/(AGREGAR|CORREGIR) \(\d+\)/g)||[]).join(' · '));
  T('cada punto trae su enlace al editor',
    (LI.match(/openstreetmap\.org\/edit#map=19\//g)||[]).length===4,
    (LI.match(/openstreetmap\.org\/edit#map=19\//g)||[]).length+' enlaces');
  T('y en las correcciones dice qué decía el mapa y qué se vio',
    /el mapa dice:/.test(LI) && /se vio:/.test(LI));
  T('y la lista los marca para etiquetar a mano',
    /\[ETIQUETA A MANO\]/.test(LI));
  T('a los que sí, les propone la etiqueta',
    /etiqueta: shop=yes/.test(LI), (LI.match(/etiqueta: [^\n]+/)||['no la propone'])[0]);

  T('sin comparación, no revienta ni inventa un archivo', r.vacioNoRompe);

  console.log('\n  -- las dos advertencias que cuestan caro --');
  T('sube cada quien con su cuenta, no la app',
    /no se sube solo/i.test(r.avisos||'') && /su cuenta/.test(r.avisos||''));
  T('y no se copia de otro mapa con derechos',
    /Google Maps/.test(r.avisos||'') && /reviertan/.test(r.avisos||''));
  T('la advertencia también viaja dentro de la lista',
    /Copiar de Google Maps/.test(LI) && /vieron en la calle/.test(LI));

  console.log('\n  -- el sector guardado --');
  T('conserva la comparación', /Lo levantado en campo/.test(r.enGuardada||''));
  T('con sus cifras', /coinciden con el mapa/.test(r.enGuardada||''));

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
