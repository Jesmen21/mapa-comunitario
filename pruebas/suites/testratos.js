const E = require('../entorno.js');
/* Lo que el usuario echó en falta: el botón donde se lo espera, y el
   resultado VISIBLE en el mapa —puntos por categoría y manzanas por estrato—. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, LADO=0.006;
/* Un cuadrado CENTRADO en C, no apoyado en él: con el cuadrante noreste, los
   70 puntos —repartidos por toda la mitad norte— caían fuera y el informe
   salía con 0 usos. La prueba decía «no pinta los puntos» cuando lo que
   pasaba es que no había ninguno que pintar. */
const POL=[{lat:C.lat-LADO,lng:C.lng-LADO},{lat:C.lat+LADO,lng:C.lng-LADO},
           {lat:C.lat+LADO,lng:C.lng+LADO},{lat:C.lat-LADO,lng:C.lng+LADO}];

const TIPOS=[{amenity:'pharmacy'},{shop:'supermarket'},{amenity:'restaurant'},
             {amenity:'school'},{amenity:'grit_bin'}];  // grit_bin no clasifica: cae en «otro»
const elements=[];
for(let i=0;i<70;i++){
  const ang=(-70+(i%141))*Math.PI/180, d=(150+(i%8)*45)/111320;
  elements.push({type:'node',id:9000+i,lat:C.lat+Math.cos(ang)*d,
    lon:C.lng+Math.sin(ang)*d/Math.cos(C.lat*Math.PI/180),
    tags:Object.assign({name:'M'+i},TIPOS[i%TIPOS.length])});
}
// Manzanas con estrato, con la forma real que devuelve ArcGIS.
// El DANE devuelve el estrato EN PALABRAS ('Uno', 'Dos'…), no en números.
// Con números, ESTRATO_NUM no reconocía ninguno, todo caía en «sin estrato»
// y la leyenda salía con un solo color: otra vez, fallo del doble y no del código.
const manzanas={features:['Uno','Dos','Tres','Sin Estrato'].map((e,i)=>({
  attributes:{ESTRATO_PREDOMINANTE:e},
  geometry:{rings:[[[C.lng+i*0.0006,C.lat],[C.lng+i*0.0006+0.0005,C.lat],
                    [C.lng+i*0.0006+0.0005,C.lat+0.0005],[C.lng+i*0.0006,C.lat+0.0005],
                    [C.lng+i*0.0006,C.lat]]]}
}))};

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
    localStorage.removeItem('aia_overpass_cache_v1');
    /* Las fichas se borran al empezar, no al recargar: la segunda mitad de
       la prueba recarga la página para reanudar la ficha que la primera
       archivó, y `sessionStorage` es lo único que sobrevive a esa recarga
       sin sobrevivir a la prueba siguiente. */
    if(!sessionStorage.getItem('pcr_prueba_conservar')) localStorage.removeItem('pcr_fichas_v1');
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
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}));
  let pedidosDane=0;
  await ctx.route(/ags\.esri\.co/, r=>{
    const u=r.request().url()+(r.request().postData()||'');
    if(/Estrato/i.test(u)){ pedidosDane++; return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manzanas)}); }
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);

  const r = await pg.evaluate(async (D) => {
    const {C,POL}=D, o={};
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat+0.002,C.lng+0.002],15);
    await new Promise(r=>setTimeout(r,700));
    const A=window.URBIS_PC_ANALISIS;

    // El contexto REAL de Pro City: con un área dibujada, htmlPanel() calcula
    // sobre él y con null revienta. Pasarle null probaría una ruta que la
    // aplicación nunca toma.
    const ctx = (typeof window.urbisProCityCtxAnalisis === 'function')
      ? window.urbisProCityCtxAnalisis() : null;
    o.hayCtx = !!ctx;

    // el botón SIN área dibujada
    o.botonSinArea=/pca-reconocer/.test(A.htmlPanel(ctx));

    // y CON área dibujada — que es donde faltaba
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    o.hayArea=A.hayArea();
    const htmlConArea=A.htmlPanel(ctx);
    o.botonConArea=/pca-reconocer/.test(htmlConArea);
    o.textoBoton=((htmlConArea.match(/pca-reconocer">([\s\S]*?)<\/button>/)||[])[1]||'').replace(/<[^>]+>/g,'');

    // analizar y ver qué queda pintado
    window.URBIS_PC_RECON.abrir();
    await window.URBIS_PC_RECON.analizar();
    await new Promise(r=>setTimeout(r,400));
    const h=document.getElementById('pcr-hoja');
    o.texto=h.innerText;
    o.diceEnMapa=/En el mapa/.test(o.texto);
    o.puntosPintados=document.querySelectorAll('.leaflet-overlay-pane path').length;
    o.poisDelInforme=(window.URBIS_PC_RECON.estado().hay ? 1 : 0);
    o.nPois=(document.getElementById('pcr-hoja').innerText.match(/(\d+)\s*\n?\s*usos registrados/)||[])[1];
    o.forma=window.URBIS_PC_RECON.estado().forma;
    o.marcadores=document.querySelectorAll('.leaflet-overlay-pane path, .leaflet-marker-pane *').length;

    // los estratos
    o.hayBotonEstratos=!!h.querySelector('[data-pcr="estratos"]');
    /* Cinco de estas comprobaciones nunca llegaron a medirse: el bloque de
       abajo las nombraba y acá nadie ponía los datos, así que fallaban desde
       el día que se escribieron. Se miden ahora.

       El botón va DENTRO del bloque de población y no al final de la ficha:
       la pregunta «¿de qué estrato es esto?» se hace mirando los habitantes,
       no después de leerlo todo. */
    o.btnEnPoblacion=(function(){
      const b2=h.querySelector('.pcr-estratos-btn');
      if(!b2) return false;
      /* Dentro de su pestaña: población, el botón y las categorías viven
         los tres en «Gente y usos», y el orden entre ellos es lo que se
         comprueba. `innerText` de la hoja entera dejó de servir cuando la
         ficha se repartió: solo devuelve la pestaña abierta. */
      const sec=h.querySelector('[data-tab="gente"]');
      const t=((sec||h).textContent||'');
      const iPob=t.indexOf('Cuánta gente vive');
      const iOtro=t.indexOf('Qué hay, por categoría');
      const iBtn=t.indexOf((b2.textContent||'').trim());
      o.btnTexto=(b2.textContent||'').trim();
      return iPob>=0 && iBtn>iPob && (iOtro<0 || iBtn<iOtro);
    })();
    h.querySelector('[data-pcr="estratos"]').click();
    await new Promise(r=>setTimeout(r,1400));
    // Con las manzanas puestas, la hoja tiene que bajar: pintarlas y dejar el
    // mapa tapado por el panel sería pintar para nadie.
    o.hojaBaja=h.classList.contains('pcr-encogida');
    o.barraDice=(h.innerText||'').replace(/\s+/g,' ').trim().slice(0,120);
    // En la barra encogida la leyenda va compacta, en una línea: la de antes
    // ocupaba cinco renglones y era parte de lo que tapaba el mapa.
    o.leyendaEnBarra=!!h.querySelector('.pcr-leyenda, .pcr-leyenda-corta');
    o.manzanasPintadas=document.querySelectorAll('.leaflet-overlay-pane path').length;
    o.textoTrasEstratos=document.getElementById('pcr-hoja').innerText;
    o.hayLeyenda=!!document.querySelector('.pcr-leyenda, .pcr-leyenda-corta');
    o.coloresLeyenda=Array.from(document.querySelectorAll('.pcr-leyenda i, .pcr-leyenda-corta i'))
      .map(i=>i.style.background).filter(Boolean).length;
    o.trasEstratos=document.querySelectorAll('.leaflet-overlay-pane path').length;

    // Y se tienen que poder quitar desde la misma barra.
    const bQuitar=h.querySelector('[data-pcr="estratos"]');
    if(bQuitar){ bQuitar.click(); await new Promise(r=>setTimeout(r,600)); }
    o.manzanasTrasQuitar=document.querySelectorAll('.leaflet-overlay-pane path').length;
    // Se vuelven a poner para lo que sigue.
    const bPoner=document.getElementById('pcr-hoja').querySelector('[data-pcr="estratos"]');
    if(bPoner){ bPoner.click(); await new Promise(r=>setTimeout(r,1200)); }
    o.trasEstratos=document.querySelectorAll('.leaflet-overlay-pane path').length;

    /* ── Y en el papel ──────────────────────────────────────────────
       «Faltó manzanas por estratos en el PDF». Con las manzanas pintadas se
       arman la lámina y el informe, y los dos tienen que traer el mapa con
       un color por estrato en sus convenciones. */
    let capturado = '';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function (html) { capturado = html; };
    const asa = h.querySelector('[data-pcr="agrandar"]');
    if (asa) { asa.click(); await new Promise(r=>setTimeout(r,500)); }
    const bLam = h.querySelector('[data-pcr="lamina-ver"]');
    if (bLam) { bLam.click(); await new Promise(r=>setTimeout(r,900)); }
    o.lamina = capturado; capturado = '';
    const asa2 = h.querySelector('[data-pcr="agrandar"]');
    if (asa2 && h.classList.contains('pcr-encogida')) { asa2.click(); await new Promise(r=>setTimeout(r,500)); }
    const bImp = h.querySelector('[data-pcr="imprimir"]');
    if (bImp) { bImp.click(); await new Promise(r=>setTimeout(r,900)); }
    o.informe = capturado; capturado = '';

    // cerrar la hoja NO debe borrar lo pintado: cerrarla es lo que se hace para mirar
    window.URBIS_PC_RECON.cerrar();
    await new Promise(r=>setTimeout(r,300));
    o.trasCerrar=document.querySelectorAll('.leaflet-overlay-pane path').length;
    /* Y las manzanas tienen que haber viajado con la ficha archivada: es lo
       que las trae de vuelta al reanudar, y al pliego que se imprima después. */
    o.fichaEstratos=(function(){ try{ const f=(window.URBIS_PC_RECON.leerFichas()||[])[0];
      return f&&f.estratos&&f.estratos.manzanas ? f.estratos.manzanas.length : 0; }catch(e){ return -1; } })();
    try{ sessionStorage.setItem('pcr_prueba_conservar','1'); }catch(e){}
    return o;
  }, {C,POL});

  /* ── Reanudar la ficha: las manzanas vuelven solas ────────────────────
     Se pintaban, se archivaba la ficha y al reabrirla ya no estaban: no
     viajaban con ella. Ahora vuelven pintadas y sin volver a pedirle nada al
     DANE, que es la promesa de reanudar. */
  pedidosDane=0;
  await pg.reload({waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);
  const r2=await pg.evaluate(async (D)=>{
    const {C}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat+0.002,C.lng+0.002],15); await esperar(500);
    const R=window.URBIS_PC_RECON;
    R.abrir(); await esperar(700);
    const H=()=>document.getElementById('pcr-hoja');
    const bR=H().querySelector('[data-pcr="reanudar"]');
    o.hayBoton=!!bR;
    if(bR){ bR.click(); await esperar(1500); }
    const est=(R.estado&&R.estado())||{};
    o.n=est.estratos||0; o.tieneEstratos=o.n>0;
    o.leyenda=!!est.estratosLeyenda;
    /* Las manzanas pintadas se cuentan por su estilo —el relleno al 45 %—
       y no por «formas en el mapa», que sumaría los puntos de usos. */
    o.formas=(function(){ let n=0; try{ window.map.eachLayer(l=>{ if(l instanceof L.Polygon && l.options && l.options.fillOpacity===0.45) n++; }); }catch(e){} return n; })();
    return o;
  },{C,POL});
  r2.pedidosDane=pedidosDane;

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- las manzanas por estrato --');
  P('el botón está en el bloque de población', r.btnEnPoblacion, r.btnTexto||'no está');
  P('al pintarlas la hoja baja para dejarlas ver', r.hojaBaja);
  P('y la barra de abajo dice qué se está mirando', /Manzanas por estrato/.test(r.barraDice||''), r.barraDice);
  P('con su leyenda a la vista', r.leyendaEnBarra, r.leyendaEnBarra?'sí':'no');
  P('y se pueden quitar', r.manzanasTrasQuitar < r.manzanasPintadas,
    r.manzanasPintadas+' → '+r.manzanasTrasQuitar+' manzanas');

  console.log('\n  -- el botón, donde se lo espera --');
  P('el contexto de Pro City existe', r.hayCtx);
  P('está sin área dibujada', r.botonSinArea);
  P('y TAMBIÉN con área dibujada', r.hayArea && r.botonConArea);
  P('y ahí habla del área, no del sector', /dentro de esta área/.test(r.textoBoton||''), r.textoBoton);

  console.log('\n  -- el resultado se ve en el mapa --');
  P('la ficha lo anuncia', r.diceEnMapa);
  P('pinta los puntos', r.puntosPintados>10,
    r.puntosPintados+' formas · el informe trae '+r.nPois+' usos · modo '+r.forma+
    ' · marcadores '+r.marcadores);

  console.log('\n  -- manzanas por estrato --');
  P('hay botón de estratos', r.hayBotonEstratos);
  P('los pinta', r.trasEstratos>r.puntosPintados, r.trasEstratos+' formas (antes '+r.puntosPintados+')');
  P('con su leyenda', r.hayLeyenda && r.coloresLeyenda>=3, r.coloresLeyenda+' colores');
  P('y dice cuántas manzanas', /manzanas/.test(r.textoTrasEstratos||''),
    (r.textoTrasEstratos||'').split('\n').filter(l=>/manzanas/.test(l))[0]);

  console.log('\n  -- y en el papel --');
  const mapaEstr = ((r.lamina||'').split('<section class="caja')
    .filter(x=>/^ mapa-caja/.test(x) && /<h2>Manzanas por estrato<\/h2>/.test(x))[0])||'';
  const conv = (mapaEstr.match(/mu-area" style="[^"]*"><\/i>[^<]*/g)||[]).map(x=>x.split('</i>')[1]);
  P('el pliego trae el mapa de manzanas por estrato', !!mapaEstr);
  P('con las manzanas pintadas', (mapaEstr.match(/<path d="M[^"]*Z" fill="#/g)||[]).length >= 3,
    (mapaEstr.match(/<path d="M[^"]*Z" fill="#/g)||[]).length+' manzanas');
  P('y un color por estrato en las convenciones, no uno por manzana',
    conv.length>=3 && conv.length<=6 && conv.every(c=>/Estrato \d/.test(c)), conv.join(' · ')||'sin tabla');
  P('el informe en hojas lo trae también',
    /<figcaption>Manzanas por estrato<\/figcaption>/.test(r.informe||''));

  console.log('\n  -- y viajan con la ficha --');
  P('la ficha archivada lleva las manzanas', r.fichaEstratos>=3, r.fichaEstratos+' manzanas en la ficha');
  P('al reanudarla vuelven', r2.hayBoton && r2.tieneEstratos && r2.n===r.fichaEstratos,
    r2.n+' manzanas tras reanudar (botón '+(r2.hayBoton?'sí':'NO')+')');
  P('pintadas en el mapa, con su leyenda', r2.formas===r.fichaEstratos && r2.leyenda,
    r2.formas+' manzanas pintadas en el mapa');
  P('y sin volver a pedirle nada al DANE', r2.pedidosDane===0, r2.pedidosDane+' consultas');

  console.log('\n  -- cerrar la hoja no borra lo pintado --');
  // El contorno del área SÍ se quita al cerrar —ya no hay nada que encuadrar—,
  // pero los puntos y los estratos se quedan: cerrar la hoja es justamente lo
  // que uno hace para poder mirarlos.
  P('los puntos y los estratos se quedan', r.trasCerrar >= r.trasEstratos - 1,
    r.trasCerrar+' formas tras cerrar (había '+r.trasEstratos+')');

  console.log('');
  P('sin errores de JavaScript', err.filter(e=>!/L is not defined|Unexpected end/.test(e)).length===0, err.slice(0,2).join(' / ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó')+'\n');
  await b.close(); process.exit(mal?1:0);
})();
