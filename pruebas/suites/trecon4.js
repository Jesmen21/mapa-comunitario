const E = require('../entorno.js');
/* Fase 4: el antes y el después.
   Los datos están armados para que las CUATRO cajas tengan contenido:
     · 3 puntos del curso lejos de todo         → aportes nuevos
     · 2 encima de puntos de OSM, misma cat.    → confirmados
     · 1 encima de un punto de OSM, otra cat.   → discrepancia
     · el resto de OSM sin visitar              → sin verificar
   Con todo coincidiendo, una comparación rota daría cero en todo y pasaría. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const LEAFLET=E.MODULOS + '/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078};
const m2g = m => m/111320;   // metros a grados de latitud

// Lo que OpenStreetMap "tiene": 10 puntos en fila hacia el norte, cada 60 m.
const elements=[];
for(let i=0;i<10;i++){
  elements.push({type:'node',id:400+i,lat:C.lat+m2g(60*(i+1)),lon:C.lng,
    tags:{name:'OSM '+i, amenity:'restaurant'}});
}

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block'});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    /* Desde que la licencia se pide AL TOCAR el botón (js/69 permitido),
       una suite sin licencia guardada se queda en la pantalla de licencia
       en vez de analizar. Es el comportamiento correcto: acá se pone la
       licencia igual que la pondría el curso en cada dispositivo. */
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t'}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route('**/script.google.com/**', r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route('**/unpkg.com/**', r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route('**/overpass**', r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,120)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);

  const r = await pg.evaluate(async (C) => {
    const o={}, m2g=m=>m/111320;
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],16);
    await new Promise(r=>setTimeout(r,700));

    // 1. Reconocimiento y ficha guardada
    window.URBIS_PC_RECON.abrir();
    document.querySelector('[data-pcr="recentrar"]').click();
    // 1 km: con los 500 m por defecto, los dos puntos más lejanos de OSM
    // quedaban fuera y las cuentas de abajo no cuadraban por el radio, no
    // por la comparación.
    document.querySelector('[data-pcr="radio"][data-r="1000"]').click();
    await window.URBIS_PC_RECON.analizar();
    document.getElementById('pcr-hoja').querySelector('[data-pcr="guardar"]').click();
    await new Promise(r=>setTimeout(r,150));
    const ficha=window.URBIS_PC_RECON.leerFichas()[0];
    o.osmGuardado=ficha.pois.length;

    // 2. Lo que "mapeó el curso". La app los sirve por urbisDatosVisibles().
    // Las etiquetas son las REALES de la Matriz de Usos (js/64). La primera
    // versión usaba nombres inventados («Salud · Droguería»), no traducían, y
    // los puntos se caían antes de llegar a la comparación: la prueba fallaba
    // por mis datos, no por el código.
    window.urbisDatosVisibles = function(){ return [
      // encima de OSM 0 y 1 (restaurante = comercio): confirmados
      {lat:String(C.lat+m2g(60)),  lng:String(C.lng), descripcion:'Comercial · Local pequeño (tienda de barrio)'},
      {lat:String(C.lat+m2g(120)), lng:String(C.lng), descripcion:'Comercial · Local pequeño (tienda de barrio)'},
      // encima de OSM 2 pero de otra categoría: discrepancia
      {lat:String(C.lat+m2g(180)), lng:String(C.lng), descripcion:'Salud (Clínicas/Hospitales)'},
      // lejos de todo, al sur: aportes nuevos
      {lat:String(C.lat-m2g(200)), lng:String(C.lng), descripcion:'Comercial · Panadería / repostería'},
      {lat:String(C.lat-m2g(260)), lng:String(C.lng), descripcion:'Salud (Clínicas/Hospitales)'},
      {lat:String(C.lat-m2g(320)), lng:String(C.lng), descripcion:'Cultural / Patrimonio'}
    ]; };

    // 3. La lista de guardadas ahora ofrece comparar
    /* Desde que la ficha sobrevive a cerrar la hoja, reabrirla devuelve el
       informe y no la pantalla de elegir área, que es donde vive la lista de
       reconocimientos guardados con su botón de comparar. Se sale por
       «Analizar otro sector», que es lo que haría una persona. */
    window.URBIS_PC_RECON.cerrar(); window.URBIS_PC_RECON.abrir();
    await new Promise(r=>setTimeout(r,300));
    const h=document.getElementById('pcr-hoja');
    const volver=h.querySelector('[data-pcr="otro"]');
    if(volver){ volver.click(); await new Promise(r=>setTimeout(r,400)); }
    o.ofreceComparar=!!h.querySelector('[data-pcr="comparar"]:not([disabled])');

    h.querySelector('[data-pcr="comparar"]').click();
    await new Promise(r=>setTimeout(r,1400));
    o.texto=document.getElementById('pcr-hoja').innerText;

    // 4. Y la comparación medida directo, sin pasar por la pantalla
    const c=await window.URBIS_PC_RECON.compararConCampo(ficha);
    o.nuevos=c.nuevos.length; o.confirmados=c.confirmados.length;
    o.discrepancias=c.discrepancias.length; o.sinVerificar=c.sinVerificar.length;
    o.totalCampo=c.totalCampo; o.totalOsm=c.totalOsm;

    /* 4b. La conclusión se puede llevar. Es lo que va al informe del curso:
       antes solo se podía mirar en la pantalla. */
    const R=window.URBIS_PC_RECON;
    o.hayBotonesLlevar=!!document.querySelector('#pcr-hoja [data-pcr="comp-copiar"]')
      && !!document.querySelector('#pcr-hoja [data-pcr="comp-pdf"]');
    o.formatosComp=Array.from(document.querySelectorAll('#pcr-hoja [data-pcr="comp-exp"]'))
      .map(x=>x.getAttribute('data-f'));

    const txt=R.comparacionComoTexto(c);
    o.txtKB=Math.round(txt.length/1024*10)/10;
    o.txtTraeCifras=/Usos NUEVOS: 3/.test(txt) && /Confirmados: 2/.test(txt);
    o.txtTraeLista=/LO QUE EL CURSO AGREGÓ AL MAPA/.test(txt) && /SIN VERIFICAR/.test(txt);
    o.txtNoAfirmaCierre=!/cerr(ó|aron|ado)/i.test(txt);

    const dC=R.datosDeComparacion(c);
    o.compPuntos=dC?dC.puntos.length:0;
    o.compEstados=dC?Array.from(new Set(dC.puntos.map(x=>x.gid))):[];
    o.compColores=dC?Object.keys(dC.colores||{}).length:0;
    if(dC){
      const EXP=window.URBIS_PC_EXPORTAR;
      const gj=JSON.parse(EXP.construirGeoJSON(dC));
      const pts=gj.features.filter(f=>f.properties.capa==='puntos');
      o.gjNuevos=pts.filter(f=>f.properties.gid==='nuevo').length;
      o.gjSinVerificar=pts.filter(f=>f.properties.gid==='sin_verificar').length;
      o.gjTraeFuente=pts.every(f=>!!f.properties.fuente);
      const kml=EXP.construirKML(dC,{});
      o.kmlEstilos=(kml.match(/<Style id="g_/g)||[]).length;
      o.kmlNuevo=/Nuevo del curso/.test(kml);
      // El PDF de la conclusión, capturado sin abrir ventanas.
      let impreso='';
      window.AIA_INFORME=window.AIA_INFORME||{};
      window.AIA_INFORME.abrirVentanaImpresion=function(h){ impreso=h; };
      document.querySelector('#pcr-hoja [data-pcr="comp-pdf"]').click();
      await new Promise(r=>setTimeout(r,300));
      o.pdfComp=/Antes y después/.test(impreso) && /agregó al mapa/.test(impreso);
      o.pdfCompKB=Math.round(impreso.length/1024);
    }

    // 5. Un punto no se empareja dos veces
    const dobles=window.URBIS_PC_RECON.compararListas(
      [{lat:C.lat,lng:C.lng,grupo:'comercio',nombre:'uno'}],
      [{lat:C.lat,lng:C.lng,grupo:'comercio'},{lat:C.lat+m2g(5),lng:C.lng,grupo:'comercio'}]);
    o.dobles={conf:dobles.confirmados.length,nuev:dobles.nuevos.length,sin:dobles.sinVerificar.length};
    return o;
  }, C);

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- la ficha guardada se puede comparar --');
  P('guardó los puntos de OSM', r.osmGuardado===10, r.osmGuardado+' puntos');
  P('ofrece comparar cuando hay puntos del curso', r.ofreceComparar);

  console.log('\n  -- reparte en las cuatro cajas --');
  P('encuentra los 3 aportes nuevos', r.nuevos===3, r.nuevos+' nuevos');
  P('encuentra los 2 confirmados', r.confirmados===2, r.confirmados+' confirmados');
  P('encuentra la 1 discrepancia', r.discrepancias===1, r.discrepancias+' discrepancia');
  P('y deja 7 sin verificar', r.sinVerificar===7, r.sinVerificar+' sin verificar');
  P('las cuentas cuadran', r.nuevos+r.confirmados+r.discrepancias===r.totalCampo,
    r.totalCampo+' del curso = '+r.nuevos+'+'+r.confirmados+'+'+r.discrepancias);
  P('un punto de OSM no se empareja dos veces',
    r.dobles.conf===1 && r.dobles.nuev===1 && r.dobles.sin===0,
    JSON.stringify(r.dobles));

  console.log('\n  -- la conclusión se puede llevar --');
  P('hay copiar y PDF', r.hayBotonesLlevar);
  P('y los formatos de siempre',
    ['paquete','kmz','dxf','svg','geojson','kml'].every(f=>(r.formatosComp||[]).indexOf(f)!==-1),
    (r.formatosComp||[]).join(', '));
  P('el texto trae las cifras y las listas', r.txtTraeCifras && r.txtTraeLista, r.txtKB+' KB');
  P('y no afirma que nada haya cerrado', r.txtNoAfirmaCierre);
  P('el paquete lleva los 13 puntos con su conclusión', r.compPuntos===13 && r.compEstados.length===4,
    r.compPuntos+' puntos · '+(r.compEstados||[]).join('/'));
  P('cada conclusión con su color', r.compColores===4);
  P('el GeoJSON separa nuevos y sin verificar', r.gjNuevos===3 && r.gjSinVerificar===7 && r.gjTraeFuente,
    r.gjNuevos+' nuevos · '+r.gjSinVerificar+' sin verificar');
  P('el KML da un estilo por conclusión', r.kmlEstilos===4 && r.kmlNuevo, r.kmlEstilos+' estilos');
  P('y el PDF de la conclusión se arma', r.pdfComp, (r.pdfCompKB||0)+' KB');

  console.log('\n  -- y lo cuenta con honestidad --');
  P('el cuadro se pintó', /Antes y después/.test(r.texto));
  P('destaca lo que el curso agregó', /agregó al mapa/.test(r.texto));
  P('no dice que lo no visitado haya cerrado', /no significa que hayan cerrado/i.test(r.texto));
  P('y avisa que ninguna lista es la verdad', /Ninguna de las dos listas/.test(r.texto));

  console.log('');
  P('sin errores de JavaScript', err.filter(e=>!/L is not defined|Unexpected end/.test(e)).length===0, err.slice(0,2).join(' / ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó')+'\n');
  if(!mal){ console.log('  ── EL CUADRO ──\n'); console.log(r.texto.split('\n').slice(0,20).map(l=>'  │ '+l).join('\n')); }
  await b.close(); process.exit(mal?1:0);
})();
