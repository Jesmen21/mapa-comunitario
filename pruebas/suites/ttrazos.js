const E = require('../entorno.js');
/* v871 · guardar el TRAZO solo, sin análisis.

   Pedido tal cual: «una opción de guardar el polígono que dibuje, pero solo
   el polígono, sin análisis, para no tener que dibujarlo varias veces… y
   después analizarlo las veces que yo quiera y se guarda nuevamente pero con
   el análisis, y así para hacer diferentes análisis».

   Es el lugar guardado de Google Earth: la FORMA es una cosa y lo que se
   midió sobre ella es otra. Lo que se comprueba acá es justamente esa
   separación — que el trazo se guarde sin esperar a ningún análisis, que
   sobreviva a borrar el dibujo, que vuelva al mapa entero, y que los
   análisis que salgan de él queden contados sin mezclarse con él.         */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078};
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
for(let i=0;i<18;i++){ const a=i*20*Math.PI/180, d=(120+(i%4)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, shop:'convenience'}}); }
const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[ via('Calle 7','residential',[P(-40,-300),P(-40,0),P(-40,300)]),
            via('Avenida 3','secondary',[P(-400,40),P(0,40),P(400,40)]) ];

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
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
  let radiosPedidos=[];
  await ctx.route(/overpass/, r=>{
    /* La consulta viaja como POST con el cuerpo urlencodeado: sin decodificar,
       «around:800» llega como «around%3A800» y no se encuentra nunca. */
    let q=(r.request().postData()||'')+r.request().url();
    try{ q=decodeURIComponent(q); }catch(e){}
    const m=q.match(/around:(\d+)/); if(m) radiosPedidos.push(Number(m[1]));
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],16); await esperar(500);
    const R=window.URBIS_PC_RECON;

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    R.cerrar(); await esperar(150); R.abrir(); await esperar(400);

    const H=()=>document.getElementById('pcr-hoja');
    const LOTE=[Q(-60,-60),Q(60,-60),Q(60,60),Q(-60,60)];

    // ── 1. Dibujar un lote, como cualquier día.
    const bLote=H().querySelector('[data-pcr="forma"][data-f="lote"]');
    if(bLote){ bLote.click(); await esperar(500); }
    const bDib=H().querySelector('[data-pcr="lote-dibujar"]');
    if(bDib){ bDib.click(); await esperar(500); }
    LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    const bCer=document.querySelector('[data-lote="cerrar"]');
    if(bCer){ bCer.click(); await esperar(700); }
    R.abrir(); await esperar(400);

    // ── 2. Guardarlo SIN analizar. Es el punto entero de la petición.
    const bGuardar=H().querySelector('[data-pcr="guardar-trazo"]');
    o.hayBoton=!!bGuardar;
    o.textoBoton=bGuardar?(bGuardar.textContent||'').trim():'';
    // El nombre se pide con un prompt; se contesta sin tocar el navegador.
    const promptReal=window.prompt; window.prompt=()=>'El lote de la loma';
    if(bGuardar){ bGuardar.click(); await esperar(500); }
    window.prompt=promptReal;

    const leer=()=>{ try{ return JSON.parse(localStorage.getItem('pcr_trazos_v1')||'[]'); }catch(e){ return []; } };
    o.trasGuardar=leer();
    // Ni un análisis pedido: guardar la forma no consulta nada.
    o.consultasTrasGuardar=(window.__pedidasOverpass||0);
    o.fichasTrasGuardar=(function(){ try{ return JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]').length; }catch(e){ return -1; } })();

    /* ── 3. Soltar el dibujo y comprobar que el trazo sobrevive.
       Marcar un lote deja la hoja ENCOGIDA —esa barra existe para ver el
       mapa mientras se marca—, y las listas viven en la hoja entera. Se
       agranda, que es lo que hace cualquiera para ver lo guardado. */
    const bAg=H().querySelector('[data-pcr="agrandar"]');
    if(bAg){ bAg.click(); await esperar(600); }
    // Quitar el lote por el botón de verdad: `R.estado()` es un objeto
    // fabricado y escribirle encima no toca el estado real.
    const bQuitar=H().querySelector('[data-pcr="lote-borrar"]');
    if(bQuitar){ bQuitar.click(); await esperar(500); }
    o.dibujoSoltado=(R.estado().lote||[]).length;
    o.sobrevive=leer().length;

    // ── 4. Volver a ponerlo en el mapa desde la lista.
    const bUsar=H().querySelector('[data-pcr="usar-trazo"]');
    o.hayLista=!!bUsar;
    o.textoLista=(function(){ const c=H().querySelector('.pcr-trazos'); return c?(c.textContent||'').replace(/\s+/g,' ').trim():''; })();
    if(bUsar){ bUsar.click(); await esperar(900); }
    const st=R.estado();
    o.vueltoAlMapa=(st.lote||[]).length;
    o.trazoIdPuesto=!!st.trazoId;
    // Y en el mapa de verdad, no solo en el estado.
    o.poligonosEnMapa=(function(){ let n=0;
      window.map.eachLayer(l=>{ if(l instanceof L.Polygon && l.options && /FFD54F/i.test(l.options.fillColor||'')) n++; });
      return n; })();

    // ── 5. Analizarlo. La ficha que salga queda enlazada al trazo.
    const bAn=H().querySelector('[data-pcr="analizar"]');
    if(bAn && !bAn.disabled){ bAn.click(); }
    await esperar(6000);
    o.fichas=(function(){ try{ return JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]'); }catch(e){ return []; } })();
    o.trazosTrasAnalizar=leer().length;
    /* Con el análisis hecho, la hoja enseña la FICHA: las listas viven en el
       panel de antes, que es a donde se llega con «volver». Es el camino que
       hace cualquiera para buscar otro trazo. */
    R.abrir(); await esperar(500);
    const bAg2=H().querySelector('[data-pcr="agrandar"]');
    if(bAg2){ bAg2.click(); await esperar(500); }
    const bOtro=H().querySelector('[data-pcr="otro"]');
    if(bOtro){ bOtro.click(); await esperar(800); }
    const bAg3=H().querySelector('[data-pcr="agrandar"]');
    if(bAg3){ bAg3.click(); await esperar(500); }
    o.diceCuantos=(function(){ const c=H().querySelector('.pcr-trazos'); return c?(c.textContent||'').replace(/\s+/g,' ').trim():''; })();

    // ── 6. Borrar el trazo no toca los análisis: son cosas distintas.
    const bBorrar=H().querySelector('[data-pcr="borrar-trazo"]');
    if(bBorrar){ bBorrar.click(); await esperar(400); }
    o.trasBorrar=leer().length;
    o.fichasTrasBorrar=(function(){ try{ return JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]').length; }catch(e){ return -1; } })();

    o.err=[];
    return o;
  }, { C });

  let mal=0;
  const T=(n,ok,d)=>{ console.log('  '+(ok?'\u2713':'\u2717')+' '+n+(d?'  \u2014 '+d:'')); if(!ok) mal++; };

  console.log('\nGuardar el trazo solo\n');
  console.log('  -- se guarda la forma, sin analizar --');
  T('con un trazo cerrado aparece el botón de guardarlo solo', r.hayBoton===true, r.textoBoton);
  T('y el botón dice que es SOLO el trazo, no el análisis',
    /solo el trazo/i.test(r.textoBoton||''), r.textoBoton||'sin texto');
  T('guardarlo deja un trazo con su nombre, su área y sus puntos',
    (r.trasGuardar||[]).length===1 && r.trasGuardar[0].nombre==='El lote de la loma' &&
    r.trasGuardar[0].areaM2>0 && (r.trasGuardar[0].pts||[]).length===4,
    (r.trasGuardar||[]).length ? r.trasGuardar[0].nombre+' · '+r.trasGuardar[0].areaM2+' m² · '+
      (r.trasGuardar[0].pts||[]).length+' esquinas' : 'no se guardó');
  /* Lo que separa esta función de «guardar el análisis»: no hay análisis.
     Si guardar el trazo dejara una ficha, serían otra vez la misma cosa. */
  T('y NO deja ninguna ficha: guardar la forma no es analizarla',
    r.fichasTrasGuardar===0, r.fichasTrasGuardar+' fichas');

  console.log('\n  -- sobrevive al dibujo y vuelve entero --');
  T('quitar el dibujo del mapa lo deja sin lote', r.dibujoSoltado===0, r.dibujoSoltado+' esquinas');
  T('pero el trazo guardado sigue ahí', r.sobrevive===1, r.sobrevive+' trazos');
  T('y sale en su propia lista, aparte de los reconocimientos', r.hayLista===true);
  T('la lista dice que son formas sin análisis',
    /sin análisis/i.test(r.textoLista||'') && /sin analizar todavía/i.test(r.textoLista||''),
    (r.textoLista||'sin lista').slice(0,110));
  T('tocarlo lo devuelve al mapa con sus cuatro esquinas',
    r.vueltoAlMapa===4 && r.poligonosEnMapa>=1,
    r.vueltoAlMapa+' esquinas · '+r.poligonosEnMapa+' polígonos en el mapa');
  T('y queda anotado de qué trazo viene, para enlazar lo que salga',
    r.trazoIdPuesto===true);

  console.log('\n  -- un trazo, muchos análisis --');
  T('analizarlo deja una ficha enlazada al trazo',
    (r.fichas||[]).length===1 && !!(r.fichas[0]||{}).trazoId,
    (r.fichas||[]).length+' fichas · trazoId '+(((r.fichas||[])[0]||{}).trazoId||'ninguno'));
  T('y el trazo sigue siendo UNO: el análisis no lo duplica',
    r.trazosTrasAnalizar===1, r.trazosTrasAnalizar+' trazos');
  T('la lista ya no dice «sin analizar», dice cuántos lleva',
    /1 análisis/.test(r.diceCuantos||'') && !/sin analizar todavía/.test(r.diceCuantos||''),
    (r.diceCuantos||'sin lista').slice(0,110));
  /* Y al revés: borrar la forma no puede llevarse por delante el trabajo
     hecho sobre ella. Son dos almacenes justamente para esto. */
  T('borrar el trazo no borra los análisis que salieron de él',
    r.trasBorrar===0 && r.fichasTrasBorrar===1,
    r.trasBorrar+' trazos · '+r.fichasTrasBorrar+' fichas');

  console.log('');
  T('sin errores de JavaScript', err.length===0, err.join(' | ')||'ninguno');
  await b.close();
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
