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

    // ── 4. Abrirlo desde la lista: desde la v892 eso lleva a SU ventana.
    const bUsar=H().querySelector('[data-pcr="usar-trazo"]');
    o.hayLista=!!bUsar;
    o.textoLista=(function(){ const c=H().querySelector('.pcr-trazos'); return c?(c.textContent||'').replace(/\s+/g,' ').trim():''; })();
    if(bUsar){ bUsar.click(); await esperar(900); }
    const st=R.estado();
    o.vueltoAlMapa=(st.lote||[]).length;
    o.trazoIdPuesto=!!st.trazoId;
    o.abrioVentana=!!st.trazoAbierto;
    // Y en el mapa de verdad, no solo en el estado.
    o.poligonosEnMapa=(function(){ let n=0;
      window.map.eachLayer(l=>{ if(l instanceof L.Polygon && l.options && /FFD54F/i.test(l.options.fillColor||'')) n++; });
      return n; })();

    /* La ventana del trazo: qué trae y qué NO trae. Lo segundo es la mitad
       del pedido —«sale mucha información y confunde»—, así que se mide que
       el ruido del panel general no esté: ni la lista de reconocimientos, ni
       los botones de radio sueltos, ni el dibujo del lote. */
    o.vent=(function(){
      const v=H().querySelector('.pcr-trazo-vent');
      if(!v) return null;
      return { texto:(v.textContent||'').replace(/\s+/g,' ').trim(),
               escalas:[...v.querySelectorAll('[data-pcr="trazo-escala"]')].map(x=>x.getAttribute('data-e')),
               haySlider:!!v.querySelector('[data-pcr="radio-rango"]'),
               hayAnalizar:!!v.querySelector('[data-pcr="trazo-analizar"]') };
    })();
    o.ruido=(function(){
      const h=H();
      return { otrosTrazos:!!h.querySelector('.pcr-trazos'),
               reconocimientos:!!h.querySelector('.pcr-guardadas:not(.pcr-trazo-hechos):not(.pcr-trazos)'),
               botonesRadio:h.querySelectorAll('[data-pcr="radio"]').length,
               dibujarLote:!!h.querySelector('[data-pcr="lote-dibujar"]') };
    })();

    /* ── 4b. La barrita: elegir un radio de 2,5 km sobre el trazo guardado.
       Es el pedido literal, y 2.500 NO está entre los botones de `RADIOS`
       —250, 500, 1.000, 2.000, 4.000, 8.000—, así que solo se alcanza con
       el control deslizante. */
    const bRad=H().querySelector('[data-pcr="trazo-escala"][data-e="radio"]');
    if(bRad){ bRad.click(); await esperar(600); }
    o.trasElegirRadio=(function(){ const e=R.estado();
      return { forma:e.forma, haySlider:!!H().querySelector('[data-pcr="radio-rango"]'),
               centro:e.centro?{lat:e.centro.lat,lng:e.centro.lng}:null }; })();
    const sl=H().querySelector('[data-pcr="radio-rango"]');
    o.rango=sl?{min:sl.min,max:sl.max,step:sl.step}:null;
    if(sl){
      sl.value='2500';
      sl.dispatchEvent(new Event('input',{bubbles:true}));
      sl.dispatchEvent(new Event('change',{bubbles:true}));
      await esperar(700);
    }
    o.radioPuesto=R.estado().radioM;
    o.ventTrasRadio=(function(){ const v=H().querySelector('.pcr-trazo-vent');
      return v?(v.textContent||'').replace(/\s+/g,' ').trim():''; })();
    /* El trazo guardado queda dibujado de referencia dentro del círculo: la
       ventana lo dice con esas palabras, así que tiene que estar en el mapa.
       Se busca el polígono GRIS y sin relleno, que es el de referencia, no
       el amarillo del lote. */
    o.referenciaEnMapa=(function(){ let n=0;
      window.map.eachLayer(l=>{ if(l instanceof L.Polygon && l.options &&
        /6B7A8A/i.test(l.options.color||'') && l.options.fill===false) n++; });
      return n; })();

    /* ── 4c. El centro se queda EN EL TRAZO (v893).
       Llegó en captura: «yo le dije que analizara dos punto cinco de radio,
       pero no le hizo el medio del lote, lo hizo por fuera… El radio en el
       centro del lote del polígono amarillo». La causa es de dos piezas y
       las dos se ejercitan acá: bajar la hoja con el dedo armaba el
       seguimiento del mapa, y desde ahí cualquier arrastre reescribía el
       centro con el de la vista. Se mide el gesto entero —bajar y
       arrastrar—, no la bandera. */
    o.centroAntes=(function(){ const c=R.estado().centro; return c?{lat:c.lat,lng:c.lng}:null; })();
    /* La ventana del trazo NO tiene asa —el arrastre de la hoja arranca solo
       desde ahí—, así que el gesto de bajarla no se puede hacer estando en
       ella. Lo que sí se puede, y es por donde se rompía, es el camino de
       vuelta: se sale por «Solo ponerlo en el mapa», que es la puerta
       explícita a trabajar sobre el mapa y arma el seguimiento; se baja la
       hoja y se arrastra el mapa lejos, que en el panel general es lo que
       debe hacer —el círculo sigue al centro, y así está escrito—; y se
       vuelve a abrir el trazo.

       Honestidad sobre lo que esta rama demuestra y lo que no: el VALOR del
       centro vuelve bien también en la v892 —«agrandar» desarma el
       seguimiento antes de reabrir—, así que esa aserción es una GUARDA,
       como las que dejaron la v879, la v882 y la v890: cierta antes y que
       tiene que seguir siéndolo. Lo que sí sale en rojo contra la v892 es la
       de más abajo, la del origen declarado: el centro volvía al trazo y la
       ficha seguía imprimiendo «el centro del mapa, donde estaba la vista»,
       porque `centroDe` se quedaba viejo. El centro corrió con suerte; el
       rótulo no, y un rótulo falso es el defecto que este módulo persigue
       desde la v867.

       Lo que de verdad sacaba el círculo del lote en la corrida del usuario
       era el rebote: analizar lo devolvía al panel general —el defecto de
       más abajo—, y ahí el círculo sigue al mapa por diseño y así está
       escrito. Arreglado el rebote, ese camino deja de existir; el ancla
       cubre el rótulo y cualquier otro camino que lo alcance. */
    const bMapa=H().querySelector('[data-pcr="trazo-al-mapa"]');
    if(bMapa){ bMapa.click(); await esperar(700); }
    const asa=H().querySelector('[data-pcr="asa"]');
    if(asa){ asa.click(); await esperar(600); }
    /* Y en el panel general el círculo SÍ sigue al mapa: es lo que esa
       pantalla promete por escrito, y clavarlo acá la volvería mentira. Se
       comprueban las dos ramas en la misma corrida. */
    window.map.panBy([260,220],{animate:false}); await esperar(800);
    o.centroSueltoSigue=(function(){ const c=R.estado().centro; return c?{lat:c.lat,lng:c.lng}:null; })();
    /* Se sube con «agrandar», que es el botón de la barra encogida: el asa
       la baja, y la lista de trazos vive en la hoja entera. */
    const bAgB=H().querySelector('[data-pcr="agrandar"]');
    if(bAgB){ bAgB.click(); await esperar(700); }
    const bUsarB=H().querySelector('[data-pcr="usar-trazo"]');
    if(bUsarB){ bUsarB.click(); await esperar(900); }
    /* Y la ventana del trazo no se deja cambiar por la barra encogida aunque
       se venga de ella: «que todo sea transitorio, que no salga en ventanas
       de la nada». */
    o.trasBajar={ sigueLaVentana:!!H().querySelector('.pcr-trazo-vent'),
                  barraEncogida:H().classList.contains('pcr-encogida') };
    const bRadB=H().querySelector('[data-pcr="trazo-escala"][data-e="radio"]');
    if(bRadB){ bRadB.click(); await esperar(700); }
    const slB=H().querySelector('[data-pcr="radio-rango"]');
    if(slB){ slB.value='2500'; slB.dispatchEvent(new Event('input',{bubbles:true}));
             slB.dispatchEvent(new Event('change',{bubbles:true})); await esperar(700); }
    o.centroTrasArrastrar=(function(){ const c=R.estado().centro; return c?{lat:c.lat,lng:c.lng}:null; })();

    /* ── 4d. El botón de analizar, medido en píxeles de pantalla.
       En la v892 llevaba `pcr-btn pcr-btn-ir`, dos clases que no existen en
       ninguna hoja de estilo: salía como texto suelto de 25 px de alto y sin
       fondo. «Tampoco salía el botón de analizar grande, botón azul grande
       para analizar o amarillo grande, que alumbre». Se mide el ALTO y que
       tenga fondo pintado, no que lleve tal o cual clase. */
    o.botonAnalizar=(function(){
      const b=H().querySelector('[data-pcr="trazo-analizar"]');
      if(!b) return null;
      const r=b.getBoundingClientRect(), cs=getComputedStyle(b);
      const fondo=(cs.backgroundImage&&cs.backgroundImage!=='none')?cs.backgroundImage:cs.backgroundColor;
      return { alto:Math.round(r.height), ancho:Math.round(r.width), fondo:fondo };
    })();
    /* ── 4e. «Volver» dentro de su cabecera, no flotando encima de la lista.
       En la v892 se llamaba `pcr-volver`, que YA era la píldora flotante de
       «Volver al análisis» —`position:fixed`, abajo a la izquierda—, así que
       salía del encabezado y se montaba sobre «Análisis de este trazo». Se
       mide la geometría: el botón cae dentro de la caja de su cabecera. */
    o.volver=(function(){
      const cab=H().querySelector('.pcr-trazo-cab');
      const b=cab&&cab.querySelector('[data-pcr="trazo-cerrar"]');
      if(!cab||!b) return null;
      const rc=cab.getBoundingClientRect(), rb=b.getBoundingClientRect();
      return { dentro: rb.top>=rc.top-2 && rb.bottom<=rc.bottom+2 &&
                       rb.left>=rc.left-2 && rb.right<=rc.right+2,
               posicion:getComputedStyle(b).position,
               bTop:Math.round(rb.top), cabTop:Math.round(rc.top) };
    })();

    // ── 5. Analizarlo DESDE la ventana, a 2,5 km. La ficha queda enlazada.
    const bAn=H().querySelector('[data-pcr="trazo-analizar"]');
    o.analizaDesdeVentana=!!bAn;
    if(bAn && !bAn.disabled){ bAn.click(); }
    /* Mientras consulta, la espera se ve EN ESTA MISMA VENTANA (v893). En la
       v892 el manejador borraba `trazoAbierto` antes de llamar a `analizar`,
       así que la hoja retrocedía al panel general y la barra aparecía allá:
       «primero me retrocedió y después apareció esa ventana, y eso me
       enredó».

       Se mide SIN ESPERAR NADA: `analizar` pone la bandera y repinta antes
       de su primer `await`, y el Overpass de mentira contesta al instante.
       Con los 900 ms que puse primero, la consulta ya había terminado y la
       aserción medía el final, no la espera. */
    o.mientras=(function(){
      const v=H().querySelector('.pcr-trazo-vent'), e=R.estado();
      return { sigueLaVentana:!!v, consultando:!!e.consultando,
               barraDentro:!!(v&&v.querySelector('.pcr-espera-caja')),
               panelGeneral:!!H().querySelector('[data-pcr="radio"]') };
    })();
    await esperar(6000);
    /* Y con el resultado puesto, la ventana ya cumplió: lo que hay que ver
       es la ficha. `hay` y `consultando` son los nombres que `estado()`
       EXPONE —no `resultado` ni `cargando`, que son los de `S`—: leer un
       campo que el accesor no expone da `undefined`, y en una aserción eso
       se ve igual que «la función no hizo su trabajo». Es la trampa que la
       v871 dejó escrita, y volví a caer en ella. */
    o.trasAnalizar={ ventana:!!H().querySelector('.pcr-trazo-vent'),
                     hayFicha:!!R.estado().hay };
    /* De dónde salió el centro, declarado. `origenDelCentro` devuelve ahora
       'trazo', y sin su renglón en ORIGEN_TEXTO la ficha imprimía «el centro
       del mapa, donde estaba la vista» sobre un centro que no salió del
       mapa: declarar mal la procedencia es peor que no declararla. */
    o.origen=(function(){ const t=(H().textContent||'').replace(/\s+/g,' ');
      const m=t.match(/Se midió alrededor de ([^.(]+)/); return m?m[1].trim():''; })();
    o.metaDelRadio=(function(){ try{
      const f=JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]')[0]||{};
      /* En el primer nivel, que es donde `guardarFicha` los pone: dentro de
         un `meta` está la forma del resultado VIVO, no la de la guardada. */
      return { forma:f.forma, radioM:f.radioM }; }catch(e){ return {}; } })();
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

    /* ── 5b. Volver a abrir el trazo: su ventana lista los análisis que
       salieron de él, y CADA UNO con la escala a la que se hizo. Sin eso,
       tres análisis del mismo trazo se ven idénticos en la lista y la
       promesa de la v871 —«diferentes análisis» del mismo sitio— no se
       puede usar. Es la regla de la v889 dicha acá. */
    const bUsar2=H().querySelector('[data-pcr="usar-trazo"]');
    if(bUsar2){ bUsar2.click(); await esperar(800); }
    o.hechos=(function(){
      const c=H().querySelector('.pcr-trazo-hechos');
      if(!c) return null;
      return [...c.querySelectorAll('.pcr-guardada')].map(x=>(x.textContent||'').replace(/\s+/g,' ').trim());
    })();
    /* Y se vuelve al panel de antes con el botón de volver, que es la puerta
       que la ventana promete. */
    const bVolver=H().querySelector('[data-pcr="trazo-cerrar"]');
    if(bVolver){ bVolver.click(); await esperar(500); }
    o.volvioAlPanel=!R.estado().trazoAbierto && !!H().querySelector('.pcr-trazos');

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
  /* ══ v892 · la ventana del trazo, y la barrita del radio ═══════════════
     Pedido con estas palabras: «cuando acceda a ese polígono guardado me
     deje ajustar el radio con su barrita para poder dejar un radio de 2.5
     kilómetros y personalizarlo más, y una ventana exclusiva de eso porque
     sale mucha información y confunde». */
  console.log('\n  -- la ventana del trazo, y su radio --');
  T('abrir un trazo guardado lleva a su propia ventana', r.abrioVentana===true);
  T('la ventana trae la identidad del trazo y su botón de analizar',
    !!r.vent && r.vent.hayAnalizar===true,
    r.vent?r.vent.texto.slice(0,80):'no hay ventana');
  /* La otra mitad del pedido, y se mide por lo que NO está: el panel general
     trae los reconocimientos guardados, los seis botones de radio y el
     dibujo del lote, y nada de eso es de este trazo. */
  T('y NO trae el ruido del panel general: otras listas, botones de radio, el lote',
    !!r.ruido && r.ruido.reconocimientos===false && r.ruido.otrosTrazos===false &&
    r.ruido.botonesRadio===0 && r.ruido.dibujarLote===false,
    r.ruido?('recon '+r.ruido.reconocimientos+' · trazos '+r.ruido.otrosTrazos+
             ' · radios '+r.ruido.botonesRadio+' · lote '+r.ruido.dibujarLote):'sin medir');
  T('ofrece las dos escalas: el trazo tal cual y un radio alrededor',
    !!r.vent && r.vent.escalas.join(',')==='poligono,radio',
    r.vent?r.vent.escalas.join(' · '):'ninguna');
  /* Hasta la v891 el control de radio solo existía en la rama del LOTE: con
     un polígono puesto —que es lo que deja un trazo guardado— no había
     barrita, así que el trazo solo se podía analizar a una escala. */
  T('elegir «radio» pone la barrita y deja la forma en radio',
    !!r.trasElegirRadio && r.trasElegirRadio.forma==='radio' && r.trasElegirRadio.haySlider===true,
    r.trasElegirRadio?(r.trasElegirRadio.forma+' · barrita '+r.trasElegirRadio.haySlider):'sin medir');
  T('y la barrita llega a los 8 km, de 50 en 50',
    !!r.rango && Number(r.rango.min)<=100 && Number(r.rango.max)>=8000 && Number(r.rango.step)<=50,
    r.rango?(r.rango.min+'–'+r.rango.max+' paso '+r.rango.step):'no hay barrita');
  /* El pedido literal: 2,5 km. No está entre los botones de RADIOS, así que
     esta aserción es la que prueba que la barrita sirve para lo que se pidió. */
  T('se puede dejar en 2,5 km, que no está entre los botones', r.radioPuesto===2500,
    r.radioPuesto+' m');
  T('y la ventana lo dice en el botón de analizar',
    /2,5 km a la redonda/.test(r.ventTrasRadio||''),
    (String(r.ventTrasRadio||'').match(/Analizar[^·]{0,40}/)||['no lo dice'])[0]);
  /* El centro del radio es el del trazo: es el mismo SITIO mirado más
     amplio, y si el centro se moviera sería otro sector con el mismo nombre. */
  T('el radio queda centrado en el trazo, no en otro sitio',
    !!(r.trasElegirRadio && r.trasElegirRadio.centro) &&
    Math.abs(r.trasElegirRadio.centro.lat - C.lat) < 0.002 &&
    Math.abs(r.trasElegirRadio.centro.lng - C.lng) < 0.002,
    r.trasElegirRadio&&r.trasElegirRadio.centro
      ? r.trasElegirRadio.centro.lat.toFixed(4)+', '+r.trasElegirRadio.centro.lng.toFixed(4) : 'sin centro');
  /* La ventana promete que el trazo queda de referencia dentro del círculo.
     Si no estuviera, elegir el radio sería elegirlo a ciegas — y la promesa
     sería falsa, que en este proyecto es peor que no hacerla. */
  T('el trazo guardado queda dibujado de referencia dentro del círculo',
    r.referenciaEnMapa>=1, r.referenciaEnMapa+' contornos de referencia');
  T('se analiza desde la ventana misma', r.analizaDesdeVentana===true);
  T('y la ficha guarda que se hizo por radio, a 2,5 km',
    !!r.metaDelRadio && r.metaDelRadio.forma==='radio' && r.metaDelRadio.radioM===2500,
    r.metaDelRadio?(r.metaDelRadio.forma+' · '+r.metaDelRadio.radioM+' m'):'sin meta');
  /* Y la lista de la ventana cita la escala de cada análisis: sin eso, dos
     análisis del mismo trazo se ven idénticos y la promesa de la v871 —el
     mismo sitio a distintas escalas— no se puede usar. */
  T('al volver, la ventana lista sus análisis con la escala de cada uno',
    !!r.hechos && r.hechos.length>=1 && /radio de 2,5 km/.test(r.hechos.join(' | ')),
    r.hechos?r.hechos.join(' | ').slice(0,110):'sin lista');
  T('y el botón de volver devuelve al panel de antes', r.volvioAlPanel===true);

  /* ══ v893 · los cuatro defectos que llegaron en captura ════════════════
     «El radio en el centro del lote del polígono amarillo. No por fuera, y
     que quede ahí ese radio y por dentro del lote… que cuando carguen esa
     misma ventana donde yo le dije analizar, pues, salga cargando, no que
     además de otra ventana, porque eso se vuelve enredo… tampoco salía el
     botón de analizar grande… que todo sea transitorio, que no salga en
     ventanas de la nada.» */
  console.log('\n  -- el centro se queda en el trazo --');
  /* El centro de un trazo es un SITIO guardado, no una propuesta que se
     empuja arrastrando el mapa. Se mide el gesto entero —bajar la hoja y
     arrastrar—, que es como se rompía. */
  /* La otra rama, y va primero porque es la que hace honesta a la primera:
     soltado en el panel general, el círculo SÍ sigue al mapa. Sin esta
     aserción, clavar el centro en todas partes pasaría en verde y dejaría
     mintiendo al «mueva el mapa: el círculo sigue el centro» de esa
     pantalla. */
  T('soltado en el panel general, el círculo sí sigue al mapa',
    !!r.centroSueltoSigue && !!r.centroAntes &&
    (Math.abs(r.centroSueltoSigue.lat - r.centroAntes.lat) > 1e-5 ||
     Math.abs(r.centroSueltoSigue.lng - r.centroAntes.lng) > 1e-5),
    r.centroSueltoSigue
      ? r.centroSueltoSigue.lat.toFixed(5)+', '+r.centroSueltoSigue.lng.toFixed(5) : 'sin centro');
  T('pero volver a abrir el trazo devuelve el centro al trazo, no a la vista',
    !!r.centroAntes && !!r.centroTrasArrastrar &&
    Math.abs(r.centroAntes.lat - r.centroTrasArrastrar.lat) < 1e-9 &&
    Math.abs(r.centroAntes.lng - r.centroTrasArrastrar.lng) < 1e-9,
    r.centroAntes && r.centroTrasArrastrar
      ? r.centroAntes.lat.toFixed(5)+','+r.centroAntes.lng.toFixed(5)+'  →  '+
        r.centroTrasArrastrar.lat.toFixed(5)+','+r.centroTrasArrastrar.lng.toFixed(5)
      : 'sin centro');
  T('y el centro sigue siendo el del trazo, dentro del lote',
    !!r.centroTrasArrastrar &&
    Math.abs(r.centroTrasArrastrar.lat - C.lat) < 0.002 &&
    Math.abs(r.centroTrasArrastrar.lng - C.lng) < 0.002,
    r.centroTrasArrastrar
      ? r.centroTrasArrastrar.lat.toFixed(4)+', '+r.centroTrasArrastrar.lng.toFixed(4) : 'sin centro');

  console.log('\n  -- una ventana, y transitoria --');
  T('volver a la ventana no la cambia por la barra encogida',
    !!r.trasBajar && r.trasBajar.sigueLaVentana===true && r.trasBajar.barraEncogida===false,
    r.trasBajar ? 'ventana '+r.trasBajar.sigueLaVentana+' · encogida '+r.trasBajar.barraEncogida : 'sin medir');
  /* La mitad que más se notó: al analizar, la hoja retrocedía al panel
     general y la espera salía allá. Se mira AL VUELO, mientras consulta. */
  T('al analizar, la espera se ve en esta misma ventana',
    !!r.mientras && r.mientras.consultando===true && r.mientras.sigueLaVentana===true &&
    r.mientras.barraDentro===true,
    r.mientras ? 'consultando '+r.mientras.consultando+' · ventana '+r.mientras.sigueLaVentana+
                 ' · barra dentro '+r.mientras.barraDentro : 'sin medir');
  T('y no retrocede al panel general mientras tanto',
    !!r.mientras && r.mientras.panelGeneral===false,
    r.mientras ? 'botones de radio sueltos: '+r.mientras.panelGeneral : 'sin medir');
  /* Y al terminar sí cede: lo que hay que ver con el análisis hecho es la
     ficha, no la pantalla desde la que se lanzó. */
  T('con el análisis hecho, la ventana cede a la ficha',
    !!r.trasAnalizar && r.trasAnalizar.ventana===false && r.trasAnalizar.hayFicha===true,
    r.trasAnalizar ? 'ventana '+r.trasAnalizar.ventana+' · ficha '+r.trasAnalizar.hayFicha : 'sin medir');
  /* Un origen nuevo sin su texto imprimía «el centro del mapa, donde estaba
     la vista» sobre un centro que no salió del mapa. */
  T('la ficha declara que el centro salió del trazo, no del mapa',
    /trazo guardado/i.test(r.origen||'') && !/centro del mapa/i.test(r.origen||''),
    r.origen||'no lo declara');

  console.log('\n  -- el botón que hay que tocar se ve --');
  /* Medido en píxeles de pantalla y no por su clase: en la v892 llevaba dos
     clases que no existían en ninguna hoja de estilo y salía como texto
     suelto de 25 px, sin fondo. */
  T('el botón de analizar es grande: al menos 48 px de alto y a todo el ancho',
    !!r.botonAnalizar && r.botonAnalizar.alto>=48 && r.botonAnalizar.ancho>=280,
    r.botonAnalizar ? r.botonAnalizar.alto+' × '+r.botonAnalizar.ancho+' px' : 'no hay botón');
  T('y tiene fondo pintado, no es texto suelto sobre el panel',
    !!r.botonAnalizar && !/^(none|rgba\(0, 0, 0, 0\)|transparent)$/.test(r.botonAnalizar.fondo||''),
    r.botonAnalizar ? String(r.botonAnalizar.fondo).slice(0,60) : 'no hay botón');
  /* `pcr-volver` ya existía y era la píldora flotante de «Volver al
     análisis»: reusarle el nombre sacó este botón del encabezado y lo dejó
     montado sobre «Análisis de este trazo». Se mide la geometría. */
  T('«Volver» va dentro de su cabecera, no flotando sobre la hoja',
    !!r.volver && r.volver.dentro===true && r.volver.posicion!=='fixed',
    r.volver ? r.volver.posicion+' · botón en y='+r.volver.bTop+', cabecera en y='+r.volver.cabTop
             : 'sin cabecera');

  T('sin errores de JavaScript', err.length===0, err.join(' | ')||'ninguno');
  await b.close();
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
