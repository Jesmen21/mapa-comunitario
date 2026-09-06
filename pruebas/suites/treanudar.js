const E = require('../entorno.js');
/* Tanda Y · seguir donde se quedó.

   El análisis vive en memoria. Sobrevive a cerrar la hoja, pero no a que se
   recargue la pestaña — y con la aplicación abierta una hora caminando por un
   barrio, eso pasa. Hasta ahora el estudiante volvía y encontraba la pantalla
   del principio: su sector estaba archivado, pero como ficha de lectura, y
   para seguir trabajando había que volver a consultar la red y esperar al
   limitador de Overpass.

   La prueba hace exactamente eso: analiza, mide, marca un lote y una zona
   intangible, y entonces RECARGA LA PÁGINA de verdad. Después comprueba que
   todo volvió sin tocar la red.

   Las peticiones se cuentan a los dos lados de la recarga. Es lo que separa
   «volvió» de «lo volvió a bajar»: si al reanudar saliera una sola consulta a
   Overpass, la función no serviría para lo que se hizo.                    */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
for(let i=0;i<14;i++){ const a=i*26*Math.PI/180, d=(160+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'Uso '+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }
const geo=[
  {type:'way',id:id++,tags:{highway:'secondary',name:'Avenida 3',lanes:'2'},
   geometry:[P(-400,0),P(0,0),P(400,0)].map(p=>({lat:p.lat,lon:p.lng}))},
  {type:'way',id:id++,tags:{highway:'residential',name:'Calle 7',lanes:'2'},
   geometry:[P(-300,-300),P(-300,0),P(-300,300)].map(p=>({lat:p.lat,lon:p.lng}))},
  {type:'way',id:id++,tags:{building:'yes','building:levels':'6'},
   geometry:[P(-60,-10),P(-40,-10),P(-40,10),P(-60,10),P(-60,-10)].map(p=>({lat:p.lat,lon:p.lng}))}
];
const NSR={"NOMBRE_DEPARTAMENTO":"NORTE DE SANTANDER","NOMBRE_MUNICIPIO":"CÚCUTA",
  "AA":0.35,"AV":0.3,"ZONA_AMENAZA_SÍSMICA":"Alta","AE":0.25,"AD":0.1,
  "LONGITUD":-72.50559097,"LATITUD":7.90526712};
const PGA={"NOMDEPTO":"NORTE DE SANTANDER","NOMMUN":"Cúcuta","POINT_X":-72.507868,
  "POINT_Y":7.897548,"PGA75":170,"PGA225":270,"PGA475":360,"PGA975":460,"PGA2475":610,
  "NIVEL":"Alta","AA":0.35,"AV":0.25,"AE":0.25,"AD":0.1};
const MASA={"AREA_KM":1135.66,"DEPARTAMEN":"Norte de Santander","MUNICIPIO":"Cúcuta",
  "SUM_BAJA":0,"SUM_MEDIA":32.78,"SUM_ALTA":59.15,"SUM_MUY_AL":8.71};

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  /* SIN bloquear el service worker y con el mismo contexto de principio a
     fin: la recarga tiene que ser la de verdad, con su almacenamiento
     intacto, que es justo lo que se está probando. */
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
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
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
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  // Las consultas, contadas. Es lo que separa «volvió» de «lo volvió a bajar».
  const red={overpass:0, terreno:0, clima:0, sgc:0};
  await ctx.route(/overpass/, r=>{
    red.overpass++;
    const q=(r.request().postData()||'')+r.request().url();
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos})});
  });
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    red.terreno++;
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map((x,i)=>300+i*3)})});
  });
  await ctx.route(/archive-api\.open-meteo\.com/, r=>{
    red.clima++;
    const dias=[]; const ini=new Date(Date.UTC(2021,0,1));
    for(let i=0;i<365*3;i++){ const d=new Date(ini.getTime()+i*86400000);
      dias.push({f:d.toISOString().slice(0,10)}); }
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      timezone:'America/Bogota',
      daily:{ time:dias.map(x=>x.f), temperature_2m_max:dias.map(()=>33),
        temperature_2m_min:dias.map(()=>22), precipitation_sum:dias.map((_,i)=>i%4?0:8),
        wind_speed_10m_max:dias.map(()=>15), wind_direction_10m_dominant:dias.map(()=>45) }})});
  });
  await ctx.route(/srvags\.sgc\.gov\.co/, r=>{
    red.sgc++;
    const u=decodeURIComponent(r.request().url());
    let cuerpo;
    if(/Zonas_amenaza_Sismica_NR10/.test(u)) cuerpo=[{attributes:NSR}];
    else if(/Mov_Masa/.test(u)) cuerpo=[{attributes:MASA}];
    else cuerpo=[{attributes:PGA}];
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:cuerpo})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  // ══ ANTES DE LA RECARGA ═══════════════════════════════════════════════
  const antes=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(400); } };

    // Ponerle nombre, para reconocerlo del otro lado.
    const caja=document.getElementById('pcr-nombre');
    if(caja){ caja.value='El barrio de la prueba';
      caja.dispatchEvent(new Event('input',{bubbles:true})); }
    const g=H().querySelector('[data-pcr="guardar"]');
    if(g){ g.click(); await esperar(600); }
    await abrir();

    // Medir todo, que además ejercita la cadena de la tanda anterior.
    H().querySelector('[data-pcr="medir-todo"]').click();
    for(let i=0;i<200 && H().querySelector('.pcr-medir-va');i++) await esperar(500);
    await esperar(800); await abrir();

    // El lote y una marca intangible.
    H().querySelector('[data-pcr="lote-dibujar"]').click(); await esperar(500);
    [Q(-25,-20),Q(25,-20),Q(25,20),Q(-25,20)].forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(900);
    await abrir();
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="oscuro"]');
    if(lap){ lap.click(); await esperar(350);
      [[-100,-300],[60,-300],[60,-180],[-100,-180]].forEach(([x,y])=>{
        const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
      await esperar(250);
      const listo=document.querySelector('#pcr-int-barra [data-int="cerrar"]');
      if(listo) listo.click(); await esperar(500);
    }
    await abrir();
    // Apagar una caja del pliego, para ver si la composición también vuelve.
    const bc=H().querySelector('[data-pcr="pliego-caja"][data-c="el-clima"]');
    if(bc){ bc.click(); await esperar(400); }
    await abrir();

    o.texto=txt();
    o.estado=R.estado();
    o.tieneClima=/de temperatura media/.test(o.texto);
    o.tieneAmenaza=/0,35/.test(o.texto);
    o.marcas=[...H().querySelectorAll('.pcr-int-item')].length;
    o.fichas=(R.leerFichas()||[]).length;
    return o;
  },{C,POL});

  const redAntes=JSON.parse(JSON.stringify(red));

  // ══ LA RECARGA, de verdad ═════════════════════════════════════════════
  await pg.reload({waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);
  const redTrasRecarga=JSON.parse(JSON.stringify(red));

  const despues=await pg.evaluate(async (D)=>{
    const {C}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    R.abrir(); await esperar(700);
    const H=()=>document.getElementById('pcr-hoja');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();

    // Lo primero: que la pantalla del principio ofrezca seguir.
    o.hayTarjeta=!!H().querySelector('.pcr-reanudar');
    o.tarjeta=(function(){ const c=H().querySelector('.pcr-reanudar');
      return c?(c.textContent||'').replace(/\s+/g,' ').trim():''; })();
    o.sinAnalisisTodavia=!R.estado().hay;

    const bR=H().querySelector('[data-pcr="reanudar"]');
    o.hayBoton=!!bR;
    if(bR){ bR.click(); await esperar(1500); }
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(400); } };
    await abrir();

    o.texto=txt();
    o.estado=R.estado();
    o.tieneClima=/de temperatura media/.test(o.texto);
    o.tieneAmenaza=/0,35/.test(o.texto);
    o.tieneTerreno=/pendiente media/i.test(o.texto);
    o.tieneTrazado=/El trazado del sector/.test(o.texto);
    o.marcas=[...H().querySelectorAll('.pcr-int-item')].length;
    o.loteEnMapa=(function(){ let n=0;
      window.map.eachLayer(l=>{ if(l instanceof L.Polygon && l.options &&
        /^#FFD54F$/i.test(l.options.fillColor||'')) n++; });
      return n; })();
    /* Y los usos, otra vez sobre el mapa. Se guardan con la ficha desde
       siempre —posición, categoría y nombre— pero al retomar el sector se
       repintaban el círculo, el lote y las marcas, y los puntos no: volvía el
       contorno de un sector vacío. «Cuando entro a un análisis viejo no salen
       los puntos de los usos.» Estaban guardados; faltaba dibujarlos. */
    o.puntosEnMapa=(function(){ let n=0;
      window.map.eachLayer(l=>{ if(l instanceof L.CircleMarker && !(l instanceof L.Circle)) n++; });
      return n; })();
    /* Y con SU color. La ficha no guarda el color de cada punto —cinco
       megabytes de almacenamiento y ochocientos puntos por sector—: se deduce
       del catálogo al traerlo de vuelta. Sin deducirlo, el sector reanudado
       volvía entero en gris. */
    o.coloresPuntos=(function(){ const c={};
      window.map.eachLayer(l=>{ if(l instanceof L.CircleMarker && !(l instanceof L.Circle) && l.options){
        const k=String(l.options.fillColor||'').toLowerCase(); c[k]=(c[k]||0)+1; } });
      return c; })();
    const fichaG=(window.URBIS_PC_RECON.leerFichas()||[])[0]||{};
    o.gruposGuardados=(function(){ const g={};
      (fichaG.pois||[]).forEach(p=>{ const k=p.grupo||'otro'; g[k]=(g[k]||0)+1; }); return g; })();
    o.colorCatalogo=(window.AIA_CATALOGO||{}).GRUPO_COLOR||{};
    o.puntosGuardados=(fichaG.pois||[]).length;
    o.climaApagadoEnPliego=(function(){
      const b=H().querySelector('[data-pcr="pliego-caja"][data-c="el-clima"]');
      return b?!b.classList.contains('on'):null;
    })();
    /* Un sector reanudado tiene las CIFRAS del trazado pero no las huellas.
       Lo que se comprueba no es que lo diga en una frase, sino que el paso
       vuelva a figurar como pendiente: es lo que hace que «medir todo» las
       recupere en vez de darlas por buenas. */
    o.avisoHuellas=/no caben en el almacenamiento del teléfono/.test(o.texto);
    o.trazadoPendiente=(function(){
      const ps=[...H().querySelectorAll('.pcr-medir-p')]
        .map(p=>({n:(p.textContent||'').trim(), on:p.classList.contains('on')}));
      const t=ps.filter(p=>/trazado/i.test(p.n))[0];
      return { lista:ps.map(p=>(p.on?'✓':'·')+p.n).join(' '), pendiente:t?!t.on:null };
    })();
    return o;
  },{C});

  const redFinal=JSON.parse(JSON.stringify(red));
  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- antes de la recarga --');
  T('el sector quedó analizado y medido',
    antes.estado.hay===true && antes.tieneClima===true && antes.tieneAmenaza===true,
    JSON.stringify(antes.estado));
  T('con su lote y su marca intangible',
    antes.estado.vertices===4 && antes.marcas===1, antes.marcas+' marca(s)');
  T('y archivado', antes.fichas>=1, antes.fichas+' ficha(s)');

  console.log('\n  -- después de recargar la pestaña --');
  T('la hoja arranca sin análisis, como corresponde', despues.sinAnalisisTodavia===true);
  T('pero ofrece seguir con el sector, por su nombre',
    despues.hayTarjeta===true && /El barrio de la prueba/.test(despues.tarjeta||''),
    (despues.tarjeta||'').slice(0,100));
  T('diciendo qué trae', /el trazado/.test(despues.tarjeta) && /el terreno/.test(despues.tarjeta) &&
    /lo intangible/.test(despues.tarjeta));
  T('y avisando de lo que no vuelve',
    /huellas de los edificios/.test(despues.tarjeta) && /no caben en el teléfono/.test(despues.tarjeta));
  T('hay botón para seguir', despues.hayBoton===true);

  console.log('\n  -- lo que volvió --');
  T('el análisis', despues.estado.hay===true, JSON.stringify(despues.estado));
  T('el área, con sus cuatro vértices', despues.estado.vertices===4);
  T('el trazado', despues.tieneTrazado===true);
  T('el terreno', despues.tieneTerreno===true);
  T('el clima', despues.tieneClima===true);
  T('la amenaza sísmica', despues.tieneAmenaza===true);
  T('el lote, dibujado en el mapa', despues.loteEnMapa>=1, despues.loteEnMapa+' polígono(s)');
  T('y los usos, otra vez pintados sobre el mapa',
    despues.puntosEnMapa>0 && despues.puntosEnMapa>=despues.puntosGuardados,
    despues.puntosEnMapa+' puntos en el mapa de '+despues.puntosGuardados+' guardados');
  const cols=despues.coloresPuntos||{};
  T('y cada uno con el color de su uso, no en gris',
    !cols['#94a3b8'], JSON.stringify(cols));
  T('con los colores que el catálogo le da a cada categoría',
    Object.keys(despues.gruposGuardados||{}).length>0 &&
    Object.keys(despues.gruposGuardados).every(g=>
      cols[String((despues.colorCatalogo||{})[g]||'').toLowerCase()]>0),
    Object.keys(despues.gruposGuardados||{}).join(', '));
  T('la marca intangible', despues.marcas===1, despues.marcas+' marca(s)');
  T('y hasta la caja que había apagado del pliego',
    despues.climaApagadoEnPliego===true);
  T('el trazado vuelve a figurar como pendiente, porque le faltan las huellas',
    despues.trazadoPendiente.pendiente===true, despues.trazadoPendiente.lista);
  T('y se explica por qué, donde se va a leer',
    despues.avisoHuellas===true);
  T('lo demás sigue marcado como medido',
    /✓El terreno/.test(despues.trazadoPendiente.lista) &&
    /✓El clima/.test(despues.trazadoPendiente.lista) &&
    /✓La amenaza/.test(despues.trazadoPendiente.lista),
    despues.trazadoPendiente.lista);

  console.log('\n  -- sin volver a la red --');
  /* Lo que de verdad importa: reanudar tiene que costar CERO consultas. Si
     saliera una sola a Overpass, la función no serviría para lo que se hizo
     —volver del limitador de cinco segundos y de una descarga de un minuto. */
  T('la recarga en sí no consulta nada',
    redTrasRecarga.overpass===redAntes.overpass && redTrasRecarga.sgc===redAntes.sgc,
    JSON.stringify(redTrasRecarga));
  T('y reanudar tampoco: cero consultas',
    redFinal.overpass===redAntes.overpass && redFinal.terreno===redAntes.terreno &&
    redFinal.clima===redAntes.clima && redFinal.sgc===redAntes.sgc,
    'antes ' + JSON.stringify(redAntes) + ' · después ' + JSON.stringify(redFinal));

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
