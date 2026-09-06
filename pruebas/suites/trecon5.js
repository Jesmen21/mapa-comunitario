const E = require('../entorno.js');
/* Población del DANE, pronóstico y gráfica, dentro del reconocimiento.
   El servicio del DANE está bloqueado desde acá, así que se sirve una
   respuesta con la forma real de ArcGIS: así el camino que se prueba es el
   mismo que corre en producción (sumaCapa → consultarDANE → motor). */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const LEAFLET=E.MODULOS + '/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078};

const TIPOS=[{amenity:'pharmacy'},{shop:'supermarket'},{amenity:'restaurant'},
             {amenity:'school'},{leisure:'park'},{amenity:'clinic'}];
const elements=[];
for(let i=0;i<90;i++){
  const ang=(-60+(i%121))*Math.PI/180, d=(150+(i%8)*45)/111320;
  elements.push({type:'node',id:8000+i,lat:C.lat+Math.cos(ang)*d,
    lon:C.lng+Math.sin(ang)*d/Math.cos(C.lat*Math.PI/180),
    tags:Object.assign({name:'S'+i},TIPOS[i%TIPOS.length])});
}

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block'});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{
    /* Solo en el marco principal. `addInitScript` corre en TODOS los marcos, y
     la aplicación crea uno escondido para medir la lámina antes de imprimirla:
     sin esta guarda, ese marco volvía a ejecutar esto y borraba las fichas ya
     guardadas a mitad de la prueba. Costó encontrarlo porque el síntoma era
     «no se guardó» en suites que no tocan el guardado. */
    if (window.top !== window) return;
    try{
    /* Desde que la licencia se pide AL TOCAR el botón (js/69 permitido),
       una suite sin licencia guardada se queda en la pantalla de licencia
       en vez de analizar. Es el comportamiento correcto: acá se pone la
       licencia igual que la pondría el curso en cada dispositivo. */
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t'}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/cdn\.jsdelivr\.net/, r=>{
    try{ r.fulfill({status:200,contentType:'text/javascript',
      body:fs.readFileSync(E.MODULOS + '/chart.js/dist/chart.umd.js','utf8')}); }
    catch(e){ r.abort(); }
  });
  // El geocodificador, para que salga el nombre del municipio: sin él no hay
  // tasa de crecimiento y el pronóstico no se calcula.
  // Con expresión regular y no con comodín: '**/locationiq.com/**' NO casa con
  // 'us1.locationiq.com' porque no hay barra antes del dominio, y la ruta se
  // quedaba sin aplicar en silencio. El sitio sin municipio no calcula la
  // proyección, así que la prueba fallaba culpando al código.
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Perímetro Urbano Cúcuta',state:'Norte de Santander',country:'Colombia',suburb:'La Playa'}})}));

  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}));

  // El DANE, con la forma real de ArcGIS.
  let daneLlamado=0;
  await ctx.route(/ags\.esri\.co/, r=>{
    daneLlamado++;
    const u=r.request().url()+(r.request().postData()||'');
    let total=3045, n=42;
    if(/viviendas/i.test(u)) { total=980; n=42; }
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({features:[{attributes:{TOTAL:total,N:n}}]})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);

  const r = await pg.evaluate(async (C) => {
    const o={};
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    o.hayChart = typeof Chart !== 'undefined';
    window.map.setView([C.lat,C.lng],16);
    await new Promise(r=>setTimeout(r,700));
    window.URBIS_PC_RECON.abrir();
    document.querySelector('[data-pcr="recentrar"]').click();
    await window.URBIS_PC_RECON.analizar();
    await new Promise(r=>setTimeout(r,500));

    const h=document.getElementById('pcr-hoja');
    /* La ficha se lee entera, pestaña por pestaña. Desde que se repartió,
       `innerText` solo devuelve la pestaña abierta —lo que se VE— y estas
       comprobaciones son sobre lo que la ficha DICE, esté en la pestaña que
       esté. Que se pueda llegar a cada una es cosa de tpestanas. */
    const textoFicha=()=>{ const h2=document.getElementById('pcr-hoja');
      if(!h2) return '';
      /* `textContent` y no `innerText`: incluye las pestañas cerradas, que
         es donde vive casi todo. La cabecera y las cifras del sector están
         fuera de las pestañas, así que se lee la hoja entera. */
      return h2.querySelector('.pcr-tab') ? h2.textContent : h2.innerText; };
    o.texto=textoFicha();
    const st=(window.URBIS_PC_RECON.estado()); o.forma=st.forma;

    o.hayPoblacion=/Cuánta gente vive acá/.test(o.texto);
    o.diceCenso=/Censo\s*20\d\d/.test(o.texto);
    o.dicePronostico=/pronóstico/i.test(o.texto);
    o.diceTasa=/% al año/.test(o.texto);
    o.avisaPunteado=/tramo punteado es pronóstico/i.test(o.texto);
    o.hayCurva=!!h.querySelector('.pcr-curva');
    // sólido + punteado: dos trazos, no uno
    o.trazos=h.querySelectorAll('.pcr-curva path').length;
    o.hayEje=!!h.querySelector('.pcr-curva-eje');
    o.aniosEje=Array.from(h.querySelectorAll('.pcr-curva-eje span')).map(s=>s.textContent);

    // la gráfica de anillo
    o.hayCanvas=!!h.querySelector('#pcr-donut');
    const cv=h.querySelector('#pcr-donut');
    o.canvasPintado = cv ? (cv.width>0 && cv.height>0) : false;

    // botones nuevos
    o.hayPDF=!!h.querySelector('[data-pcr="imprimir"]');
    o.hayNombre=!!h.querySelector('#pcr-nombre');

    // guardar con nombre, y verlo en el mapa
    h.querySelector('#pcr-nombre').value='La Playa, calles 8 a 12';
    h.querySelector('[data-pcr="guardar"]').click();
    await new Promise(r=>setTimeout(r,200));
    o.nombreGuardado=(window.URBIS_PC_RECON.leerFichas()[0]||{}).nombre;

    window.URBIS_PC_RECON.cerrar(); window.URBIS_PC_RECON.abrir();
    await new Promise(r=>setTimeout(r,250));
    /* La ficha ya no se pierde al cerrar la hoja, así que al reabrir sale ella
       y no la pantalla de elegir área. Para volver a esa pantalla se usa
       «Analizar otro sector», igual que lo haría una persona. */
    const bOtro=document.querySelector('#pcr-hoja [data-pcr="otro"]');
    if(bOtro){ bOtro.click(); await new Promise(r=>setTimeout(r,300)); }
    const h2=document.getElementById('pcr-hoja');
    o.listaConNombre=/La Playa/.test(h2.innerText);
    const bm=h2.querySelector('[data-pcr="ver-mapa"]');
    o.hayVerMapa=!!bm;
    if(bm){ bm.click(); await new Promise(r=>setTimeout(r,300));
      o.formasEnMapa=document.querySelectorAll('.leaflet-overlay-pane path').length; }
    return o;
  }, C);

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- el censo del DANE llega a la ficha --');
  P('se consultó el servicio del DANE', daneLlamado>0, daneLlamado+' llamadas');
  P('la ficha muestra la población', r.hayPoblacion);
  P('con el año del censo', r.diceCenso);

  console.log('\n  -- y el pronóstico a futuro --');
  P('dice hacia dónde va', r.dicePronostico);
  P('con la tasa de crecimiento anual', r.diceTasa);
  P('la curva está dibujada', r.hayCurva);
  P('sólido hasta hoy y punteado al futuro', r.trazos>=3, r.trazos+' trazos (área + punteado + sólido)');
  P('con los años en el eje', r.hayEje && r.aniosEje.length===3, (r.aniosEje||[]).join(' → '));
  P('y avisa que lo punteado es estimación', r.avisaPunteado);

  console.log('\n  -- la gráfica con los colores del catálogo --');
  P('Chart.js cargó', r.hayChart);
  P('el anillo está en la ficha', r.hayCanvas && r.canvasPintado);

  console.log('\n  -- lo demás que faltaba --');
  P('se puede poner nombre al sector', r.hayNombre);
  P('y se guarda con ese nombre', r.nombreGuardado==='La Playa, calles 8 a 12', r.nombreGuardado);
  P('la lista lo muestra por su nombre', r.listaConNombre);
  P('botón de PDF', r.hayPDF);
  P('ver los reconocimientos en el mapa', r.hayVerMapa && r.formasEnMapa>0, r.formasEnMapa+' formas dibujadas');

  console.log('');
  P('sin errores de JavaScript', err.filter(e=>!/L is not defined|Unexpected end/.test(e)).length===0, err.slice(0,2).join(' / ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó')+'\n');
  if(r.texto) console.log(r.texto.split('\n').slice(0,22).map(l=>'  │ '+l).join('\n'));
  await b.close(); process.exit(mal?1:0);
})();
