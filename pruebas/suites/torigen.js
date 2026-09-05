const E = require('../entorno.js');
/* Tanda AE · de dónde salió cada número.

   Dos datos que la hoja mostraba con la misma cara con la que muestra una
   medición, sin decir de dónde venían:

     · El CENTRO del análisis. Llegó un informe de campo que no pude
       reproducir en tres intentos —«marqué el lote, ajusté el radio, y el
       análisis se hizo en mi ubicación GPS»—. Sin una línea que diga alrededor
       de qué se consultó, una captura de la hoja no permite distinguir un
       error de la aplicación de un lápiz soltado sin querer, y la
       conversación se queda en dos personas adivinando.

     · Los ÍNDICES DEL POT, que los escribe a mano quien fue a la ventanilla.
       No quedaba anotado de qué documento salieron ni de qué año. Y peor: no
       se guardaba CUÁLES se habían escrito, así que un sector reabierto con
       los siete puestos volvía diciendo «cuenta de ejemplo»; y «qué cabe» de
       una ficha archivada se calculaba con los índices que hubiera en
       memoria, de otro lote.                                              */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs'); const S=E.TRABAJO; const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
// Un lote chico dentro del área.
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
const LOTE=[Q(-40,-30),Q(40,-30),Q(40,30),Q(-40,30)];
let id=1; const usos=[];
for(let i=0;i<40;i++){ const a=i*9*Math.PI/180, d=(140+(i%4)*50)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

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
    if(!localStorage.getItem('__org_limpio')){
      localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
      localStorage.removeItem('pcr_trazo_vivo_v1');
      localStorage.setItem('__org_limpio','1');
    }
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',suburb:'La Playa'}})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  // ── Por área dibujada: el centro sale del área.
  const porArea=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1400);
    const H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.loDice=/Se midió alrededor de el área que dibujaste/.test(t);
    o.conCoordenadas=/Se midió alrededor de[^.]*\(-?\d+\.\d{5}, -?\d+\.\d{5}\)/.test(t);
    o.enLaFicha=((R.leerFichas()||[])[0]||{}).centroDe;
    return o;
  },{C,POL});

  /* ── Por lote: el centro sale del lote, y se dice ─────────────────────── */
  const porLote=await pg.evaluate(async (D)=>{
    const {LOTE}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    // Se suelta el sector y se empieza por el lote.
    const bo=H().querySelector('[data-pcr="otro"]'); if(bo){ bo.click(); await esperar(400); }
    await abrir();
    const bf=H().querySelector('[data-pcr="forma"][data-f="lote"]');
    o.hayFormaLote=!!bf;
    if(bf){ bf.click(); await esperar(400); }
    const bd=H().querySelector('[data-pcr="lote-dibujar"]');
    if(bd){ bd.click(); await esperar(400);
      LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
      await esperar(200);
      const c=document.querySelector('#pcr-lote-barra [data-lote="cerrar"]'); if(c){ c.click(); await esperar(600); }
    }
    o.hayLote=!!R.centroDelLoteDePrueba();
    /* Cinco segundos entre consultas: el limitador de Overpass rechaza la
       segunda y el análisis se cae con «Espera 3 segundos». */
    await esperar(5200);
    await R.analizar(); await esperar(1500);
    await abrir();
    const t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.loDice=/Se midió alrededor de el lote que marcaste/.test(t);
    o.enLaFicha=((R.leerFichas()||[])[0]||{}).centroDe;
    /* Y lo dicho tiene que ser verdad: el punto que se nombra es el mismo que
       la función que elige el centro devuelve. */
    const c1=R.centroDeAnalisisDePrueba(), c2=R.centroDelLoteDePrueba();
    o.esElMismoPunto=!!(c1&&c2&&Math.abs(c1.lat-c2.lat)<1e-9&&Math.abs(c1.lng-c2.lng)<1e-9);
    return o;
  },{LOTE});

  /* ── Los índices del POT y su procedencia ─────────────────────────────── */
  const indices=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    await abrir();
    const ids=[...H().querySelectorAll('[data-pcr-idx]')].map(c=>c.getAttribute('data-pcr-idx'));
    o.hayCajas=ids.length;
    /* Por id y volviendo a buscar la caja en cada vuelta: escribir en un
       índice repinta la hoja, así que las referencias de la primera consulta
       quedan huérfanas y solo el primer valor entraba. */
    for(const id of ids){
      await abrir();
      const c=H().querySelector('[data-pcr-idx="'+id+'"]');
      if(!c) continue;
      c.value=String(Number(c.value)||1);
      c.dispatchEvent(new Event('change',{bubbles:true}));
      await esperar(120);
    }
    await abrir();
    let t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.pideLaFuente=/De dónde los sacaste/.test(t);
    o.avisaSinFuente=/Dos líneas ahora te ahorran/.test(t);
    // Y se anota de dónde salieron.
    const doc=H().querySelector('[data-pcr-fuente="documento"]');
    const fec=H().querySelector('[data-pcr-fuente="fecha"]');
    o.hayCampos=!!doc && !!fec;
    if(doc){ doc.value='Acuerdo 0089 · Planeación Municipal'; doc.dispatchEvent(new Event('change',{bubbles:true})); await esperar(300); }
    await abrir();
    const fec2=H().querySelector('[data-pcr-fuente="fecha"]');
    if(fec2){ fec2.value='2011, revisado en 2019'; fec2.dispatchEvent(new Event('change',{bubbles:true})); await esperar(300); }
    await abrir();
    const f=(R.leerFichas()||[])[0]||{};
    o.enLaFicha=f.indicesFuente||null;
    o.puestosEnLaFicha=f.indicesPuestos?Object.keys(f.indicesPuestos).length:0;
    o.idFicha=f.id;
    return o;
  });

  // Se recarga: es lo que hace un teléfono. Y se relee la ficha archivada.
  await pg.reload({waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);
  const releida=await pg.evaluate(async (D)=>{
    const {idFicha}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    R.accion('ver',{getAttribute:function(){ return idFicha; }}); await esperar(400);
    const html=R.htmlPestana();
    o.diceElCentro=/Se midió alrededor de <b>el lote que marcaste<\/b>/.test(html);
    o.diceLaFuente=/Acuerdo 0089/.test(html) && /2011, revisado en 2019/.test(html);
    /* Con los índices de SU ficha, no con los que haya en memoria —que tras
       recargar son los de ejemplo—. */
    o.noDiceEjemplo=!/Cuenta de ejemplo/.test(html);
    o.diceDeLaFicha=/vienen de la ficha normativa/.test(html);
    return o;
  },{idFicha:indices.idFicha});

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- alrededor de qué se midió --');
  T('por área dibujada lo dice, con las coordenadas',
    porArea.loDice===true && porArea.conCoordenadas===true);
  T('y queda escrito en la ficha', porArea.enLaFicha==='area', porArea.enLaFicha||'nada');
  T('por lote marcado lo dice también',
    porLote.hayFormaLote && porLote.hayLote && porLote.loDice===true);
  T('y en la ficha', porLote.enLaFicha==='lote', porLote.enLaFicha||'nada');
  /* Que lo que dice sea verdad: la función que nombra el origen y la que
     elige el punto tienen que estar de acuerdo, o la línea sería peor que no
     ponerla. */
  T('el punto que nombra es el que de verdad se consultó', porLote.esElMismoPunto===true);

  console.log('\n  -- de dónde salieron los índices del POT --');
  T('la hoja pregunta por el documento y el año',
    indices.hayCajas>0 && indices.pideLaFuente===true && indices.hayCampos===true,
    indices.hayCajas+' índices');
  T('y mientras nadie conteste, lo dice', indices.avisaSinFuente===true);
  T('lo anotado queda con la ficha',
    !!indices.enLaFicha && /Acuerdo 0089/.test(indices.enLaFicha.documento||'') &&
    /2011/.test(indices.enLaFicha.fecha||''), JSON.stringify(indices.enLaFicha));
  /* Se guardaba el VALOR y no cuáles se habían escrito: sin esto, un sector
     reabierto con los siete índices puestos vuelve diciendo «ejemplo». */
  T('y cuáles se escribieron a mano, también',
    indices.puestosEnLaFicha===indices.hayCajas && indices.hayCajas>0,
    indices.puestosEnLaFicha+' de '+indices.hayCajas+' confirmados');

  console.log('\n  -- y al releer la ficha después de recargar --');
  T('sigue diciendo alrededor de qué se midió', releida.diceElCentro===true);
  T('y de dónde salieron los índices', releida.diceLaFuente===true);
  T('con la cuenta de ESTE lote y no una de ejemplo',
    releida.noDiceEjemplo===true && releida.diceDeLaFicha===true);

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
