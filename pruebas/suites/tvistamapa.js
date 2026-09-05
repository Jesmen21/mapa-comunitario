const E = require('../entorno.js');
/* Tanda AI · la vista del mapa, el sol por fachadas, las curvas y el PDF.

   Llegaron seis capturas de campo. La cuarta lo decía todo: la hoja
   «encogida» —la que existe para dejar ver el mapa— crecía con cada capa
   encendida hasta taparlo entero. Cuatro botones de ancho completo, una
   leyenda, siete chips y un «Volver»: más alto que la pantalla. No se podía
   ni mandar una captura de lo que se quería mostrar.

   Y con ella, tres cosas más que se veían en las capturas:
     · el lote pintaba de rojo UNA fachada, y las de al lado —que también
       miran al poniente— como si no les diera el sol;
     · las curvas salían cada 25 m y se leían «como a cada treinta»;
     · el PDF de la lámina no aparecía: lo abría `window.open`, que el
       teléfono bloquea.                                                    */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs'); const S=E.TRABAJO; const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
// Un lote rectangular alargado de norte a sur: dos lados largos que miran
// exactamente al este y al oeste, y dos cortos al norte y al sur.
const LOTE=[Q(-15,-40),Q(15,-40),Q(15,40),Q(-15,40)];
let id=1; const usos=[];
for(let i=0;i<180;i++){ const a=i*6*Math.PI/180, d=(110+(i%8)*45)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'E'+i, amenity:['pharmacy','restaurant','school','bank','cafe'][i%5]}}); }
const vias=[]; for(let i=0;i<10;i++){ const off=(i-5)*0.0008;
  vias.push({type:'way',id:9000+i,nodes:[],geometry:[{lat:C.lat+off,lon:C.lng-0.004},{lat:C.lat+off,lon:C.lng+0.004}],tags:{highway:'residential',name:'Calle '+i}}); }
for(let i=0;i<40;i++){ const ox=(i%8-4)*0.0009, oy=(Math.floor(i/8)-2)*0.0012;
  vias.push({type:'way',id:7000+i,nodes:[],geometry:[
    {lat:C.lat+oy,lon:C.lng+ox},{lat:C.lat+oy,lon:C.lng+ox+0.0003},{lat:C.lat+oy+0.0003,lon:C.lng+ox+0.0003},{lat:C.lat+oy+0.0003,lon:C.lng+ox},{lat:C.lat+oy,lon:C.lng+ox}],
    tags:{building:'yes'}}); }

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{
    /* Solo en el marco principal. `addInitScript` corre en TODOS los marcos, y
     la aplicación crea uno escondido para medir la lámina antes de imprimirla:
     sin esta guarda, ese marco volvía a ejecutar esto y borraba las fichas ya
     guardadas a mitad de la prueba. Costó encontrarlo porque el síntoma era
     «no se guardó» en suites que no tocan el guardado. */
    if (window.top !== window) return;
    try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'martarojas',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    localStorage.removeItem('pcr_fichas_v1'); localStorage.removeItem('aia_overpass_cache_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',suburb:'La Playa'}})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:usos.concat(vias)})}));
  await ctx.route(/ags\.esri\.co/, r=>{
    const feats=[]; for(let i=0;i<12;i++){ const ox=(i%4-2)*0.0015, oy=(Math.floor(i/4)-1)*0.0015;
      feats.push({attributes:{ESTRATO:1+(i%6),TOTAL:120,N:42},geometry:{rings:[[[C.lng+ox,C.lat+oy],[C.lng+ox+0.001,C.lat+oy],[C.lng+ox+0.001,C.lat+oy+0.001],[C.lng+ox,C.lat+oy+0.001],[C.lng+ox,C.lat+oy]]]}}); }
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:feats})});});
  /* Un relieve de unos 150 m de desnivel a lo largo del sector, como el de la
     captura de campo (303 a 459 msnm): con quince curvas de tope salía cada
     25 m —«como a cada treinta»—; con veinticuatro sale cada 10. Y con el
     selector se puede pedir 2 m, que son 75 curvas. */
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url()); const lats=(u.searchParams.get('latitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elevation:lats.map(la=>320+(la-(C.lat-0.0045))*16600)})});});

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL,LOTE}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],16); await esperar(400);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]'); if(bPC){ bPC.click(); await esperar(500); }
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    const clic=async(sel)=>{ await abrir(); const x=H().querySelector(sel); if(x){ x.click(); await esperar(700); return true; } return false; };
    const alto=()=>Math.round(H().getBoundingClientRect().height/window.innerHeight*100);

    // ── Sector, trazado y terreno.
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);
    await abrir();
    await esperar(5200);   // el limitador de Overpass
    await clic('[data-pcr="trazado"]');
    for(let i=0;i<30;i++){ await esperar(500); if(!/Midiendo|midiendo/.test(H().textContent||'')) break; }
    await esperar(600);
    await clic('[data-pcr="terreno"]');
    for(let i=0;i<30;i++){ await esperar(500); if(R.terrenoDePrueba()) break; }
    await esperar(600);

    // ── 1 · La vista del mapa con cuatro capas encendidas.
    await clic('[data-pcr="llenos-mapa"]');
    await clic('[data-pcr="curvas-mapa"]');
    await clic('[data-pcr="estratos"]');
    await abrir(); const chipCal=H().querySelector('[data-pcr="calor"][data-cal="todos"]'); if(chipCal){ chipCal.click(); await esperar(600); }
    o.encogida=H().classList.contains('pcr-encogida');
    o.altoConCuatro=alto();
    o.capas=[...H().querySelectorAll('.pcr-capa-chip')].map(x=>(x.textContent||'').trim());
    o.mapaVisible=(function(){ const rc=H().getBoundingClientRect();
      const el=document.elementFromPoint(206, Math.round(rc.top/2)); return !!(el && el.closest && el.closest('.leaflet-container')); })();
    // Al mínimo, y de vuelta.
    const bm=H().querySelector('[data-pcr="minimizar"]'); if(bm){ bm.click(); await esperar(500); }
    o.altoMinimo=alto(); o.minima=H().classList.contains('pcr-minima');
    const bd=H().querySelector('[data-pcr="desminimizar"]'); if(bd){ bd.click(); await esperar(500); }
    o.vuelve=alto();
    // Apagar una capa no cierra la vista.
    const ch=H().querySelector('.pcr-capa-chip[data-pcr="curvas-mapa"]'); if(ch){ ch.click(); await esperar(600); }
    o.sigueEncogida=H().classList.contains('pcr-encogida');
    o.capasTrasApagar=[...H().querySelectorAll('.pcr-capa-chip')].map(x=>(x.textContent||'').trim());

    // ── 2 · El sol por cada lado del lote.
    await abrir();
    const bf=H().querySelector('[data-pcr="forma"][data-f="lote"]'); if(bf){ bf.click(); await esperar(400); }
    const bl=H().querySelector('[data-pcr="lote-dibujar"]');
    if(bl){ bl.click(); await esperar(400);
      LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
      await esperar(200);
      const c=document.querySelector('#pcr-lote-barra [data-lote="cerrar"]'); if(c){ c.click(); await esperar(800); }
    }
    await esperar(5200);
    await R.analizar(); await esperar(1500);
    await abrir();
    const t=(H().textContent||'').replace(/\s+/g,' ');
    o.lotePuesto=!!R.centroDelLoteDePrueba();
    o.diceSolPorLado=/cuánto sol de la tarde recibe cada uno/.test(t);
    o.leyenda=[...H().querySelectorAll('.pcr-sol-leyenda span')].map(x=>(x.textContent||'').trim());
    o.niveles=[...H().querySelectorAll('.pcr-lado-sol')].map(x=>(x.textContent||'').replace(/\s+/g,' ').trim());
    // En el mapa: un trazo por lado, con colores distintos.
    o.trazos=(function(){ const cols={}; let n=0;
      window.map.eachLayer(function(l){ if(l instanceof L.Polyline && !(l instanceof L.Polygon) && l.options && l.options.weight===6){ n++; cols[l.options.color]=1; } });
      return { n:n, colores:Object.keys(cols).length }; })();
    // Y en el plano de la lámina.
    let capturado=''; window.AIA_INFORME=window.AIA_INFORME||{};
    const orig=window.AIA_INFORME.abrirVentanaImpresion;
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ capturado=h; return true; };
    const bla=H().querySelector('[data-pcr="lamina-ver"]'); if(bla){ bla.click(); await esperar(900); }
    window.AIA_INFORME.abrirVentanaImpresion=orig;
    o.laminaConEscala=/Sol de la tarde sobre cada lado, del rojo al azul/.test(capturado);
    o.laminaNiveles=(capturado.match(/sol-punto/g)||[]).length;

    // ── 3 · Las curvas: intervalo más fino, y a elegir.
    await abrir();
    const t2=(H().textContent||'').replace(/\s+/g,' ');
    o.intervaloAuto=(t2.match(/curvas? cada (\d+) m/)||[])[1]||'';
    o.pasosOfrecidos=[...H().querySelectorAll('[data-pcr="curvas-paso"]')].map(x=>Number(x.getAttribute('data-paso')));
    o.diceInterpolacion=/entre dos cotas medidas, la curva es interpolación/.test(t2);
    const p2=H().querySelector('[data-pcr="curvas-paso"][data-paso="2"]');
    if(p2){ p2.click(); await esperar(700); }
    await abrir();
    const t3=(H().textContent||'').replace(/\s+/g,' ');
    o.intervaloA2=(t3.match(/curvas? cada (\d+) m/)||[])[1]||'';
    o.curvasA2=Number((t3.match(/(\d+) curvas? cada 2 m/)||[])[1]||0);
    o.avisaFino=/y a 2 m, menos todavía/.test(t3);

    // ── 4 · El PDF, dentro de la aplicación.
    window.__abrio=0; const wo=window.open; window.open=function(){ window.__abrio++; return null; };
    await abrir();
    const bl2=H().querySelector('[data-pcr="lamina-ver"]'); if(bl2){ bl2.click(); await esperar(1200); }
    window.open=wo;
    const caja=document.getElementById('aia-impresion');
    o.pdfEnLaApp=!!caja;
    o.pdfSinVentana=window.__abrio===0;
    o.pdfBotones=caja?[...caja.querySelectorAll('[data-aia-imp]')].map(x=>x.getAttribute('data-aia-imp')):[];
    o.pdfMarco=!!(caja && caja.querySelector('iframe') && (caja.querySelector('iframe').srcdoc||'').length>2000);
    if(caja){ caja.querySelector('[data-aia-imp="cerrar"]').click(); await esperar(300); }
    o.pdfCierra=!document.getElementById('aia-impresion');

    // ── 5 · Los llenos dicen lo que son.
    await abrir();
    const t4=(H().textContent||'').replace(/\s+/g,' ');
    o.llenosHonestos=/Es lo que OpenStreetMap tiene dibujado, no lo construido de verdad/.test(t4);
    return o;
  },{C,POL,LOTE});

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- la vista del mapa no tapa el mapa --');
  T('con cuatro capas encendidas la hoja no pasa del 42 % de la pantalla',
    r.encogida===true && r.altoConCuatro<=42, r.altoConCuatro+' % · capas: '+(r.capas||[]).join(', '));
  T('y el mapa se puede tocar por encima de ella', r.mapaVisible===true);
  T('un interruptor por capa, en una fila', (r.capas||[]).length>=3, (r.capas||[]).join(', '));
  T('al mínimo queda solo el asa y una línea', r.minima===true && r.altoMinimo<=12, r.altoMinimo+' %');
  T('y vuelve', r.vuelve>r.altoMinimo && r.vuelve<=42, r.vuelve+' %');
  /* Apagar una capa cerraba la vista aunque quedaran otras: `S.encogida =
     S.curvasEnMapa` sin mirar el resto. */
  T('apagar una capa no cierra la vista si quedan otras',
    r.sigueEncogida===true && (r.capasTrasApagar||[]).length===(r.capas||[]).length-1,
    'quedan: '+(r.capasTrasApagar||[]).join(', '));

  console.log('\n  -- el sol, por cada lado y no por una fachada --');
  T('la ficha dice cuánto sol recibe cada lado', r.lotePuesto && r.diceSolPorLado===true);
  T('con cinco niveles, del rojo al azul', (r.leyenda||[]).length===5, (r.leyenda||[]).join(' · '));
  /* Un rectángulo norte-sur: el lado del oeste con sol pleno, el del este sin
     sol de la tarde, los cortos en medio. Si todos salieran iguales, el
     cálculo no estaría mirando hacia dónde mira cada lado. */
  T('y niveles distintos para lados que miran a lados distintos',
    (r.niveles||[]).some(x=>/sol pleno/.test(x)) && (r.niveles||[]).some(x=>/sin sol/.test(x)),
    (r.niveles||[]).join(' | '));
  T('en el mapa, un trazo por lado con su color', r.trazos && r.trazos.n>=4 && r.trazos.colores>=3,
    JSON.stringify(r.trazos));
  T('y en el plano de la lámina, con su escala', r.laminaConEscala===true && r.laminaNiveles>=4,
    r.laminaNiveles+' lados con nivel');

  console.log('\n  -- las curvas --');
  /* Con 150 m de desnivel: el tope original daba 25 m, el de veinticuatro
     curvas daba 10, y el de ahora —cuarenta curvas, y de 4 m para arriba—
     da 4. Se pidió así, con estas palabras: «no sea cada diez metros; a cada
     cinco o cuatro metros está bien». */
  T('el intervalo automático sale a cuatro metros', r.intervaloAuto==='4', 'cada '+r.intervaloAuto+' m');
  T('y se ofrece elegirlo', (r.pasosOfrecidos||[]).length>=2 && (r.pasosOfrecidos||[]).indexOf(2)>=0,
    (r.pasosOfrecidos||[]).join(', ')+' m');
  T('diciendo que entre cotas medidas es interpolación', r.diceInterpolacion===true);
  T('a 2 m salen las curvas pedidas', r.intervaloA2==='2' && r.curvasA2>=60, r.curvasA2+' curvas cada '+r.intervaloA2+' m');
  T('y se avisa de que ese detalle el modelo no lo sabe', r.avisaFino===true);

  console.log('\n  -- el PDF, dentro de la aplicación --');
  T('la lámina se abre encima de la app, sin ventana emergente', r.pdfEnLaApp===true && r.pdfSinVentana===true);
  T('con la lámina cargada en su marco', r.pdfMarco===true);
  T('con «Guardar como PDF», «Bajar el archivo» y cerrar',
    ['imprimir','bajar','cerrar'].every(x=>(r.pdfBotones||[]).indexOf(x)>=0), (r.pdfBotones||[]).join(', '));
  T('y se cierra', r.pdfEnLaApp===true && r.pdfCierra===true);

  console.log('\n  -- los llenos dicen lo que son --');
  T('«lo que OpenStreetMap tiene dibujado, no lo construido de verdad»', r.llenosHonestos===true);

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
