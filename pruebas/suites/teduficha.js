const E = require('../entorno.js');
/* Tanda A · el trazado del sector: llenos y vacíos, jerarquía de las vías y
   morfología de la traza. Se pide a botón porque trae la FORMA de cada
   edificio y cada calle. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

/* Dos respuestas distintas de Overpass: la del análisis (centros) y la del
   trazado (geometría). Se distinguen por la propia consulta, como en la app. */
const usos=[]; let id=1;
for(let i=0;i<30;i++){ const a=i*12*Math.PI/180, d=(150+(i%5)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

/* Cuadrícula real: las calles COMPARTEN el nodo del cruce, como en
   OpenStreetMap. Sin eso no hay intersecciones que contar. */
const geo=[]; const N=6, paso=L*1.4/(N-1), ini=-L*0.7;
const xs=[], ys=[];
for(let i=0;i<N;i++){ xs.push(ini+i*paso); ys.push(ini+i*paso); }
xs.forEach((x,i)=>geo.push({type:'way',id:id++,tags:{highway:i===0?'primary':'residential',name:i===3?undefined:'Calle '+i},
  geometry:ys.map(y=>({lat:C.lat+y,lon:C.lng+x}))}));
ys.forEach((y,i)=>geo.push({type:'way',id:id++,tags:Object.assign({highway:i===1?'secondary':'residential',name:'Avenida '+i}, i%3===0?{oneway:'yes'}:{}),
  geometry:xs.map(x=>({lat:C.lat+y,lon:C.lng+x}))}));
/* 40 edificios de 10 × 10 m */
for(let i=0;i<40;i++){
  const dx=(-L*0.6+(i%8)*(L*0.17)), dy=(-L*0.6+Math.floor(i/8)*(L*0.24)), d=0.00009;
  geo.push({type:'way',id:id++,tags:{building:'house'},geometry:[
    {lat:C.lat+dy,lon:C.lng+dx},{lat:C.lat+dy+d,lon:C.lng+dx},
    {lat:C.lat+dy+d,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx+d},{lat:C.lat+dy,lon:C.lng+dx}]});
}
/* Y tres mapeados solo como punto: el bloque tiene que declararlos aparte. */
for(let i=0;i<3;i++) geo.push({type:'way',id:id++,center:{lat:C.lat+0.0005,lon:C.lng+0.0005},tags:{building:'yes'}});

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
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
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia'}})}));
  let consultas=0;
  await ctx.route(/overpass/, r=>{
    const q=(r.request().postData()||'')+r.request().url();
    consultas++;
    const esTrazado=/out(\+|%20|\s)geom/.test(q);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: esTrazado ? geo : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3200);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(900);

    const h=()=>document.getElementById('pcr-hoja');
    // Antes de pedirlo: el bloque tiene que ofrecer el botón y NO datos.
    o.hayBoton=!!h().querySelector('[data-pcr="trazado"]');
    o.tieneDatos=!!(window.AIA_DATOS&&window.AIA_DATOS.consultarTrazadoPoligono);
    o.tieneRemoto=!!(window.AIA_REMOTO&&window.AIA_REMOTO.trazado);
    o.antesSinDatos=!h().querySelector('.pcr-llenos-barra');

    /* El cliente limita las consultas a OpenStreetMap: pulsar el botón justo
       después de analizar devuelve «Espera 4 segundos». Una persona tarda más
       que eso en leer media ficha y llegar al botón, así que la prueba espera
       lo mismo en vez de fingir un clic imposible. */
    await esperar(5000);
    h().querySelector('[data-pcr="trazado"]').click();
    // La consulta con geometría más el motor: se espera de verdad.
    for(let i=0;i<60 && !document.querySelector('.pcr-llenos-barra');i++) await esperar(400);
    await esperar(300);

    const H=h();
    o.hayLlenos=!!H.querySelector('.pcr-llenos-barra');
    o.error=txt(H.querySelector('.pcr-error'))||txt(H.querySelector('#pcr-trz-estado'))||'';
    o.pctLleno=txt(H.querySelector('.pcr-llenos-cifras span b'));
    /* La barra de llenos y vacíos y la de andenes comparten maqueta —son la
       misma figura con otros datos—, así que hay que quedarse con la PRIMERA
       o se cuentan las cinco cifras de las dos juntas. */
    o.cifras=[...(H.querySelector('.pcr-llenos-cifras')||{querySelectorAll:()=>[]})
      .querySelectorAll('span')].map(x=>txt(x));
    o.avisoPuntos=[...H.querySelectorAll('.pcr-pista')].some(p=>/solo como punto/.test(txt(p)));
    // Jerarquía
    const nivs=[...H.querySelectorAll('.pcr-nivel')].map(n=>txt(n.querySelector('.pcr-nivel-nom')));
    o.mallas=nivs.filter(x=>/Malla|locales|Peatonal/i.test(x));
    // Morfología
    o.rosa=H.querySelectorAll('.pcr-rosa .pcr-rosa-petalos path').length;
    o.morfoDatos=[...H.querySelectorAll('.pcr-morfo-datos .pcr-lote-fila')].map(f=>txt(f.querySelector('span'))+'='+txt(f.querySelector('b')));
    o.lectura=(function(){ const c=[...H.querySelectorAll('.pcr-conc')].filter(p=>/Traza/.test(txt(p)))[0]; return c?txt(c):''; })();
    o.sinNombre=[...H.querySelectorAll('.pcr-kpi')].map(k=>txt(k)).filter(x=>/sin nombre/.test(x))[0]||'';
    o.modo=document.documentElement.getAttribute('data-urbis-modo');
    o.titulo=txt(H.querySelector('.pcr-barra b'));
    o.secciones=[...H.querySelectorAll('.pcr-h')].map(x=>txt(x));
    // Guardar y reabrir: el trazado tiene que seguir ahí.
    const bg=[...H.querySelectorAll('button')].filter(b=>/Guardar/i.test(b.textContent||''))[0];
    if(bg){ window.prompt=()=>'Sector medido'; bg.click(); await esperar(500); }
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(700);
    const cab=document.querySelector('.pcr-pest-cab'); if(cab){ cab.click(); await esperar(600); }
    const pest=document.querySelector('.pcr-pestana');
    o.pestLlenos=!!(pest&&pest.querySelector('.pcr-llenos-barra'));
    o.pestRosa=pest?pest.querySelectorAll('.pcr-rosa-petalos path').length:0;
    o.pestCruces=(function(){
      if(!pest) return '';
      const f=[...pest.querySelectorAll('.pcr-morfo-datos .pcr-lote-fila')]
        .filter(x=>/Intersecciones/.test(txt(x)))[0];
      return f?txt(f.querySelector('b')):'';
    })();
    return o;
  },{C,POL});

  r.consultas=consultas;
  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  MODO: '+r.modo+'  ·  hoja: «'+r.titulo+'»');
  console.log('  SECCIONES DE LA FICHA:');
  (r.secciones||[]).forEach((s,i)=>console.log('   '+String(i+1).padStart(2)+'. '+s));
  console.log('\n  -- se pide, no se hace de oficio --');
  P('el bloque ofrece el botón', r.hayBoton);
  P('y no trae datos hasta que se pulsa', r.antesSinDatos);

  console.log('\n  -- llenos y vacíos --');
  P('la barra aparece tras medir', r.hayLlenos);
  P('con su porcentaje de lleno y de vacío', r.cifras.length===2 && /%/.test(r.cifras[0]), r.cifras.join(' · '));
  P('y declara los edificios mapeados solo como punto', r.avisoPuntos, r.avisoPuntos?'lo dice':'NO lo dice');

  console.log('\n  -- jerarquía de las vías --');
  P('separa arterial, zonal y local', r.mallas.length===3, r.mallas.join(' | '));
  P('y cuenta los tramos sin nombre', /1\s*tramos? sin nombre/.test(r.sinNombre), r.sinNombre);

  console.log('\n  -- morfología --');
  P('dibuja la rosa de orientación', r.rosa>=4, r.rosa+' pétalos');
  P('cuenta las 36 intersecciones de la cuadrícula',
    r.morfoDatos.some(x=>/^Intersecciones=36$/.test(x)), r.morfoDatos.join(' · '));
  P('y la reconoce como cuadrícula', /cuadrícula/.test(r.lectura), r.lectura);

  console.log('\n  -- el sector guardado no lo pierde --');
  P('la pestaña trae los llenos y vacíos', r.pestLlenos);
  P('y la rosa de orientación', r.pestRosa>=4, r.pestRosa+' pétalos');
  P('con las mismas intersecciones', r.pestCruces==='36', r.pestCruces+' en la pestaña');

  console.log('');
  P('una sola consulta más a OpenStreetMap', r.consultas===2, r.consultas+' consultas en total');
  P('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
