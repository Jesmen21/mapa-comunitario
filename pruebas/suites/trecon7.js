const E = require('../entorno.js');
/* Lo que se pidió en este turno:
   1. mapas de calor de los usos encontrados, elegibles y combinables;
   2. guardar el polígono con nombre para no volver a dibujarlo, y que sirva
      para el análisis de los mapeos del curso;
   3. una pestaña «Sector» donde el análisis recién hecho quede guardado. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, LADO=0.006;
const POL=[{lat:C.lat-LADO,lng:C.lng-LADO},{lat:C.lat+LADO,lng:C.lng-LADO},
           {lat:C.lat+LADO,lng:C.lng+LADO},{lat:C.lat-LADO,lng:C.lng+LADO}];

const TIPOS=[{amenity:'pharmacy'},{shop:'supermarket'},{amenity:'restaurant'},
             {amenity:'school'},{leisure:'park'},{amenity:'bus_station'}];
const elements=[];
for(let i=0;i<90;i++){
  const ang=(-70+(i%141))*Math.PI/180, d=(150+(i%8)*45)/111320;
  elements.push({type:'node',id:9000+i,lat:C.lat+Math.cos(ang)*d,
    lon:C.lng+Math.sin(ang)*d/Math.cos(C.lat*Math.PI/180),
    tags:Object.assign({name:'M'+i},TIPOS[i%TIPOS.length])});
}
// Una vía con nombre, para que el bloque de movilidad tenga qué decir.
elements.push({type:'way',id:5001,tags:{highway:'primary',name:'Avenida Libertadores'},
  center:{lat:C.lat+0.001,lon:C.lng+0.001}});

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']});
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
    localStorage.removeItem('aia_overpass_cache_v1');
    localStorage.removeItem('pcr_fichas_v1'); localStorage.removeItem('pc_areas_analisis_v1');
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
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42,HOM:1490,MUJ:1555,
      // Los nombres reales del servicio: E<tramo> con el tramo tal cual lo
      // pide js/61 (E0_4, E5_9…). Con E0A9 inventado, todas las edades
      // salían en 0 y parecía un fallo del bloque de demografía.
      E0_4:210,E5_9:180,E10_14:170,E15_19:160,E20_24:230,E25_29:250,
      E30_34:240,E35_39:220,E40_44:200,E45_49:180,E50_54:160,E55_59:150,
      E60_64:130,E65_69:110,E70_74:90,E75_79:70,E80YMAS:50}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);

  const r = await pg.evaluate(async (D) => {
    const {C,POL}=D, o={};
    const esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const q=sel=>{const e=document.querySelector(sel);
      if(!e) throw new Error('no está en el DOM: '+sel); return e;};
    try{
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15);
    await esperar(700);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    // Área dibujada, que es la forma que se quiere guardar.
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    // Con un área ya trazada, la herramienta elige el polígono sola (lo
    // comprueba trecon2): forzar el clic probaría un camino que la app no usa.
    R.abrir(); await esperar(250);
    o.formaElegida=R.estado().forma;
    await R.analizar();
    await esperar(500);
    const h=document.getElementById('pcr-hoja');
    o.texto=h.innerText;

    // ── 1) El análisis extendido ──────────────────────────────────────
    o.diceUso=/Qué manda en el sector/.test(o.texto);
    o.diceMovilidad=/Cómo se llega/.test(o.texto);
    o.diceAmbiente=/Verde y agua/.test(o.texto);
    o.medidores=h.querySelectorAll('.pcr-med').length;
    o.carrilesConAncho=Array.from(h.querySelectorAll('.pcr-med-barra'))
      .map(i=>i.getBoundingClientRect().width).filter(w=>w>20).length;
    o.barrasConValor=Array.from(h.querySelectorAll('.pcr-med-barra i'))
      .map(i=>i.getBoundingClientRect().width).filter(w=>w>0).length;
    /* Alto, no solo ancho. `.pcr-cuerpo` es un flex en columna con scroll:
       sus hijos se aplastan a cero cuando el contenido desborda, y ya pasó
       una vez con las barras de edad. Un medidor de 3 px de alto se lee como
       «no se pintó». */
    o.altosMedidor=Array.from(h.querySelectorAll('.pcr-med'))
      .map(e=>Math.round(e.getBoundingClientRect().height));
    o.altosBarra=Array.from(h.querySelectorAll('.pcr-med-barra'))
      .map(e=>Math.round(e.getBoundingClientRect().height));
    o.altosNucleo=Array.from(h.querySelectorAll('.pcr-nucleo'))
      .map(e=>Math.round(e.getBoundingClientRect().height));
    // Y el rótulo del medidor, que la regla global de URBIS dejaba invisible.
    o.rotulos=Array.from(h.querySelectorAll('.pcr-med-cab span')).map(e=>{
      const cs=getComputedStyle(e); return (e.textContent||'').slice(0,20)+'|'+cs.webkitTextFillColor;});
    o.viaNombrada=/Avenida Libertadores/.test(o.texto);
    o.filasUso=h.querySelectorAll('.pcr-fila').length;

    // La lista de campo: es lo único del informe que se puede verificar
    // caminando, así que tiene que traer nombres propios de verdad.
    o.hayLista=/La lista para ir a verificar/.test(o.texto);
    o.rubros=h.querySelectorAll('.pcr-rubro').length;
    o.nombresPropios=Array.from(h.querySelectorAll('.pcr-rubro-ej li'))
      .map(li=>li.textContent.trim()).filter(t=>/^M\d+$/.test(t)).length;
    o.altosRubro=Array.from(h.querySelectorAll('.pcr-rubro'))
      .map(e=>Math.round(e.getBoundingClientRect().height));
    // Anillos
    // El plan de la salida: el reparto que se imprime y se entrega.
    o.hayPlan=/El plan de la salida/.test(o.texto);
    o.tareas=h.querySelectorAll('.pcr-tarea').length;
    o.tareasNuevas=h.querySelectorAll('.pcr-tarea-nueva').length;
    o.rumbosDelPlan=Array.from(h.querySelectorAll('.pcr-tarea-rumbo'))
      .map(e=>e.textContent.trim());
    o.rumbosRepetidos=o.rumbosDelPlan.length-new Set(o.rumbosDelPlan).size;
    o.altosTarea=Array.from(h.querySelectorAll('.pcr-tarea'))
      .map(e=>Math.round(e.getBoundingClientRect().height));
    // cambiar el número de grupos debe rehacer el reparto
    const bG=Array.from(h.querySelectorAll('[data-pcr="grupos"]')).filter(x=>x.getAttribute('data-g')==='8')[0];
    o.hayBotonGrupos=!!bG;
    if(bG){ bG.click(); await esperar(300); }
    o.tareas8=document.querySelectorAll('#pcr-hoja .pcr-tarea').length;
    // y el primer grupo debe seguir yendo a un rumbo vacío
    o.primeraTareaEsNueva=!!document.querySelector('#pcr-hoja .pcr-tarea')
      && document.querySelector('#pcr-hoja .pcr-tarea').classList.contains('pcr-tarea-nueva');

    /* El plan no sirve en la pantalla: sirve impreso y repartido. Se
       comprueba que viaje en el texto que se copia, que es el mismo que
       alimenta el PDF. */
    document.querySelector('#pcr-hoja [data-pcr="copiar"]').click();
    await esperar(500);
    try { o.copiado=await navigator.clipboard.readText(); } catch(e){ o.copiado='(no se pudo leer)'; }
    o.copiaTraePlan=/PLAN DE LA SALIDA \(8 grupos\)/.test(o.copiado||'');
    o.copiaTraeGrupos=(o.copiado||'').split('Grupo ').length-1;

    o.hayAnillos=/Cómo cambia al alejarse/.test(o.texto);
    o.anillos=h.querySelectorAll('.pcr-anillo').length;
    o.anilloConEjemplo=h.querySelectorAll('.pcr-anillo-ej').length;

    // ── 2) Mapas de calor a la carta ──────────────────────────────────
    o.hayChipsCalor=h.querySelectorAll('.pcr-cal-chip').length;
    const chips=Array.from(h.querySelectorAll('.pcr-cal-chip'));
    const unaCat=chips.filter(c=>c.getAttribute('data-cal').indexOf('g:')===0)[0];
    o.nombreChip=unaCat?unaCat.textContent.trim():'';
    if(!unaCat){ o.sinChips=true; return o; }
    unaCat.click(); await esperar(500);
    o.lienzoCalor=!!document.querySelector('canvas.pca-heat');
    o.chipMapa=(document.querySelector('.pca-heat-chip')||{}).textContent||'';
    o.encogidaAlEncender=!!document.querySelector('.pcr-hoja.pcr-encogida');
    o.pintadoUna=(function(){const c=document.querySelector('canvas.pca-heat');
      if(!c)return 0;const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height).data;
      let n=0;for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return n;})();

    o.claseHoja=document.getElementById('pcr-hoja').className;
    o.estadoCalor=(window.URBIS_PC_RECON.estado()||{}).hay;
    o.htmlMini=document.getElementById('pcr-hoja').innerHTML.slice(0,300);
    // combinar una segunda categoría: debe teñir MÁS
    q('#pcr-hoja [data-pcr="agrandar"]').click(); await esperar(250);
    const h2=document.getElementById('pcr-hoja');
    const otra=Array.from(h2.querySelectorAll('.pcr-cal-chip'))
      .filter(c=>c.getAttribute('data-cal').indexOf('g:')===0 && !c.classList.contains('on'))[0];
    o.hayOtra=!!otra;
    if(otra){ otra.click(); await esperar(500); }
    o.pintadoDos=(function(){const c=document.querySelector('canvas.pca-heat');
      if(!c)return 0;const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height).data;
      let n=0;for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return n;})();
    o.chipCombinado=(document.querySelector('.pca-heat-chip')||{}).textContent||'';

    // apagar desde el chip del mapa: los botones de la hoja deben apagarse solos
    document.querySelector('#pcr-hoja [data-pcr="agrandar"]') &&
      q('#pcr-hoja [data-pcr="agrandar"]').click();
    await esperar(200);
    A.apagarHeat(); await esperar(300);
    o.sinLienzo=!document.querySelector('canvas.pca-heat');
    o.chipsApagados=Array.from(document.querySelectorAll('#pcr-hoja .pcr-cal-chip'))
      .filter(c=>c.classList.contains('on')).length;

    // ── 3) Guardar el área ────────────────────────────────────────────
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La Playa, entre calles 8 y 12';
    const bGuardarArea=document.querySelector('#pcr-hoja [data-pcr="guardar-area"]');
    o.hayBotonArea=!!bGuardarArea;
    if(bGuardarArea){ bGuardarArea.click(); await esperar(300); }
    const areas=JSON.parse(localStorage.getItem('pc_areas_analisis_v1')||'[]');
    o.nAreas=areas.length;
    o.nombreArea=areas[0]?areas[0].nombre:'';
    o.verticesArea=areas[0]?areas[0].pts.length:0;
    o.avisoArea=(document.querySelector('#pcr-hoja .pcr-aviso')||{}).textContent||'';
    // guardar dos veces con el mismo nombre no debe duplicar
    if(bGuardarArea){ document.querySelector('#pcr-hoja [data-pcr="guardar-area"]').click(); await esperar(250); }
    o.nAreas2=JSON.parse(localStorage.getItem('pc_areas_analisis_v1')||'[]').length;

    // ── 4) La pestaña «Sector» ────────────────────────────────────────
    // La ficha se guardó SOLA al terminar el análisis: eso es lo que evita
    // perder el trabajo al salir de la pantalla.
    o.fichasAuto=JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]').length;
    R.cerrar(); await esperar(300);
    window.urbisProCityAbrirSector(); await esperar(400);
    const hoja=document.querySelector('.u52-procity-stats-sheet, #u52-procity-stats')
      || document.querySelector('.pcr-pestana') && document.querySelector('.pcr-pestana').closest('div');
    o.hayPestana=!!document.querySelector('.pcr-pestana');
    o.pestanaEnBarra=!!Array.from(document.querySelectorAll('.u52-procity-stats-tabs button'))
      .filter(x=>/Sector/.test(x.textContent))[0];
    o.textoPestana=(document.querySelector('.pcr-pestana')||{innerText:''}).innerText;
    o.fichasEnPestana=document.querySelectorAll('.pcr-pest-ficha').length;

    // desplegar la ficha: el informe completo debe estar ahí, sin red
    const cab=document.querySelector('.pcr-pest-cab');
    if(cab) cab.click();
    await esperar(400);
    o.informeAbierto=!!document.querySelector('.pcr-informe');
    o.textoInforme=(document.querySelector('.pcr-informe')||{innerText:''}).innerText;
    o.informeTieneUsos=/usos registrados/.test(o.textoInforme);
    o.informeTienePoblacion=/Cuánta gente vive acá/.test(o.textoInforme);
    o.informeTieneMovilidad=/Cómo se llega/.test(o.textoInforme);
    o.informeTieneCategorias=document.querySelectorAll('.pcr-informe .pcr-fila').length;
    o.hayBotonCargarArea=!!document.querySelector('[data-u52-call="pcr-area"]');
    o.informeTieneLista=/La lista para ir a verificar/.test(o.textoInforme);
    /* Un sector guardado tiene que servir SOLO: el reparto de la salida
       reconstruido de lo guardado, y su propio PDF. Un profesor prepara cinco
       sectores en su casa e imprime cinco repartos. */
    o.informeTienePlan=/El plan de la salida/.test(o.textoInforme);
    o.informeTareas=document.querySelectorAll('.pcr-informe .pcr-tarea').length;
    o.informeTareasNuevas=document.querySelectorAll('.pcr-informe .pcr-tarea-nueva').length;
    o.hayPdfGuardado=!!document.querySelector('[data-u52-call="pcr-pdf"]');
    /* Exportar DESDE un sector guardado. Se comprueba de verdad —descargando
       el archivo— porque este camino pasa por el despachador de js/20 con
       prefijo propio, y un prefijo mal puesto exportaría el área de Pro City
       en vez de este sector, en silencio. */
    o.botonesExpGuardado=Array.from(document.querySelectorAll('.pcr-pestana [data-u52-call^="pcr-exp-"]'))
      .map(x=>x.getAttribute('data-u52-call'));
    let bajado=null;
    const _crear=URL.createObjectURL;
    URL.createObjectURL=function(bl){ bajado=bl; return _crear.call(URL,bl); };
    const bGeo=document.querySelector('.pcr-pestana [data-u52-call="pcr-exp-geojson"]');
    if(bGeo){ bGeo.click(); await esperar(500); }
    URL.createObjectURL=_crear;
    o.bajoAlgo=!!bajado;
    if(bajado){
      const txtGJ=await bajado.text();
      try{
        const gj=JSON.parse(txtGJ);
        o.expGuardadoPuntos=gj.features.filter(f=>f.properties.capa==='puntos').length;
        o.expGuardadoArea=gj.features.some(f=>f.properties.capa==='area');
      }catch(e){ o.expGuardadoError=e.message; }
    }
    let impresoG='';
    window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ impresoG=h; };
    if(o.hayPdfGuardado){ document.querySelector('[data-u52-call="pcr-pdf"]').click(); await esperar(400); }
    o.pdfGuardadoKB=Math.round(impresoG.length/1024);
    o.pdfGuardadoNombre=/La Playa, entre calles 8 y 12/.test(impresoG);
    o.pdfGuardadoPlan=/El plan de la salida/.test(impresoG);
    o.pdfGuardadoLista=/La lista para verificar/.test(impresoG);
    o.chipsGuardados=document.querySelectorAll('[data-u52-call="pcr-calorcat"]').length;

    // contraste: el problema reportado dos veces fue texto casi blanco
    o.contrastes=Array.from(document.querySelectorAll('.pcr-pestana small, .pcr-pestana p, .pcr-pestana b'))
      .slice(0,60).map(el=>{
        const cs=getComputedStyle(el);
        const c=(cs.webkitTextFillColor&&cs.webkitTextFillColor!=='currentcolor')?cs.webkitTextFillColor:cs.color;
        /* WCAG de verdad: hay que linearizar cada canal antes de pesarlo.
           La media simple de los canales daba 2,6 para un gris azulado que
           sobre blanco contrasta 5,5 — y la prueba acusaba al código de un
           defecto que estaba en su propia aritmética. */
        const m=(c.match(/\d+/g)||[255,255,255]).slice(0,3).map(Number);
        const lin=v=>{v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);};
        const lum=0.2126*lin(m[0])+0.7152*lin(m[1])+0.0722*lin(m[2]);
        return Math.round(((1.05)/(lum+0.05))*100)/100;
      });
    o.flojos=o.contrastes.filter(x=>x<3).length;
    o.muestraColores=Array.from(document.querySelectorAll('.pcr-pestana small, .pcr-pestana p, .pcr-pestana b'))
      .slice(0,60).map((el,i)=>({i, r:o.contrastes[i], cl:(el.className||el.tagName),
        c:getComputedStyle(el).webkitTextFillColor, t:(el.textContent||'').trim().slice(0,28)}))
      .filter(x=>x.r<3);

    // ── 5) Cargar el área guardada desde la pestaña ───────────────────
    const bArea=document.querySelector('[data-u52-call="pcr-area"]');
    if(bArea) bArea.click();
    await esperar(600);
    o.areaCargada=A.hayArea();
    o.nombreCargado=A.areaNombre();
    o.verticesCargados=A.puntosDelArea().length;
    }catch(e){ o.reventoDentro=e.message; }
    return o;
  }, {C,POL});
  if(r.reventoDentro){ console.log('  ✗ reventó dentro: '+r.reventoDentro);
    console.log('  clase de la hoja: '+r.claseHoja);
    console.log('  html mini: '+String(r.htmlMini||'').slice(0,200)); }

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- el análisis extendido --');
  P('dice qué uso manda', r.diceUso);
  P('dice cómo se llega', r.diceMovilidad);
  P('dice qué verde hay', r.diceAmbiente);
  P('los tres medidores están y tienen carril visible',
    r.medidores>=3 && r.carrilesConAncho===r.medidores,
    r.carrilesConAncho+' carriles de '+r.medidores+' · '+r.barrasConValor+' con valor');
  P('nombra la vía principal', r.viaNombrada);
  P('los medidores no se aplastan', (r.altosMedidor||[]).every(h=>h>=34) && (r.altosBarra||[]).every(h=>h>=7),
    'altos '+(r.altosMedidor||[]).join('/')+' · carriles '+(r.altosBarra||[]).join('/'));
  P('y sus rótulos se leen', (r.rotulos||[]).length>=3 &&
    (r.rotulos||[]).every(x=>!/255, 255, 255|231, 255, 251/.test(x)),
    (r.rotulos||[])[0]);
  P('las fichas de núcleo no se aplastan', (r.altosNucleo||[]).every(h=>h>=34),
    (r.altosNucleo||[]).join('/')||'sin núcleos');
  P('las barras por categoría siguen ahí', r.filasUso>=5, r.filasUso+' filas');
  P('trae la lista de campo con nombres', r.hayLista && r.rubros>=4 && r.nombresPropios>=6,
    r.rubros+' rubros · '+r.nombresPropios+' nombres propios listados');
  P('y sus tarjetas no se aplastan', (r.altosRubro||[]).every(h=>h>=40),
    (r.altosRubro||[]).slice(0,5).join('/'));
  console.log('\n  -- el plan de la salida --');
  P('está en la ficha', r.hayPlan && r.tareas>=4, r.tareas+' grupos repartidos');
  P('los rumbos sin datos van primero y marcados', r.tareasNuevas>=1 && r.primeraTareaEsNueva,
    r.tareasNuevas+' encargos de levantar de cero · primero: '+(r.rumbosDelPlan||[])[0]);
  P('no manda dos grupos al mismo sitio', r.rumbosRepetidos===0,
    (r.rumbosDelPlan||[]).slice(0,4).join(' / '));
  P('las tarjetas no se aplastan', (r.altosTarea||[]).every(h=>h>=48),
    (r.altosTarea||[]).slice(0,4).join('/'));
  P('cambiar a 8 grupos rehace el reparto', r.hayBotonGrupos && r.tareas8===8, r.tareas8+' grupos');
  P('y el reparto viaja en el texto que se copia', r.copiaTraePlan && r.copiaTraeGrupos===8,
    r.copiaTraeGrupos+' grupos en el texto');

  console.log('');
  P('dice cómo cambia al alejarse', r.hayAnillos && r.anillos>=2,
    r.anillos+' anillos · '+r.anilloConEjemplo+' con ejemplos con distancia');

  console.log('\n  -- mapas de calor a la carta --');
  P('hay chips para elegir qué teñir', r.hayChipsCalor>=3, r.hayChipsCalor+' chips · uno es «'+r.nombreChip+'»');
  P('encender uno pinta el lienzo', r.lienzoCalor && r.pintadoUna>0, r.pintadoUna+' píxeles teñidos');
  P('y el chip del mapa dice de qué es', /\S/.test(r.chipMapa)&&!/🔥/.test(r.chipMapa)&&!/Todos los usos/.test(r.chipMapa), r.chipMapa.replace(/\s+/g,' ').slice(0,60));
  P('la hoja baja sola para dejar ver el mapa', r.encogidaAlEncender);
  P('combinar dos categorías tiñe más', r.hayOtra && r.pintadoDos>r.pintadoUna,
    r.pintadoUna+' → '+r.pintadoDos+' píxeles');
  P('y el chip lo dice', /combinadas/.test(r.chipCombinado), r.chipCombinado.replace(/\s+/g,' ').slice(0,50));
  P('apagar desde el mapa apaga los botones de la hoja', r.sinLienzo && r.chipsApagados===0,
    r.chipsApagados+' chips encendidos tras apagar');

  console.log('\n  -- guardar el polígono para no redibujarlo --');
  P('hay botón de guardar el área', r.hayBotonArea);
  P('queda guardada con su nombre', r.nAreas===1 && r.nombreArea==='La Playa, entre calles 8 y 12',
    r.nAreas+' área · «'+r.nombreArea+'» · '+r.verticesArea+' vértices');
  P('y lo avisa', /guardada/i.test(r.avisoArea), r.avisoArea.slice(0,70));
  P('guardarla dos veces no la duplica', r.nAreas2===1, r.nAreas2+' área');

  console.log('\n  -- la pestaña «Sector» --');
  P('la ficha se guarda sola al analizar', r.fichasAuto===1, r.fichasAuto+' ficha sin tocar nada');
  P('la pestaña está en la barra', r.pestanaEnBarra);
  P('y muestra el sector analizado', r.hayPestana && r.fichasEnPestana===1, r.fichasEnPestana+' ficha listada');
  P('al desplegarla trae el informe completo', r.informeAbierto && r.informeTieneUsos);
  P('con la población del DANE', r.informeTienePoblacion);
  P('con la movilidad', r.informeTieneMovilidad);
  P('y el desglose por categoría', r.informeTieneCategorias>=4, r.informeTieneCategorias+' filas');
  P('el informe guardado trae la lista de campo', r.informeTieneLista);
  P('y sus propios interruptores de calor', r.chipsGuardados>=3, r.chipsGuardados+' chips');
  P('trae el reparto de la salida', r.informeTienePlan && r.informeTareas>=4,
    r.informeTareas+' grupos · '+r.informeTareasNuevas+' a levantar de cero');
  P('y su propio PDF, con SU nombre', r.hayPdfGuardado && r.pdfGuardadoNombre,
    (r.pdfGuardadoKB||0)+' KB');
  P('con el plan y la lista dentro', r.pdfGuardadoPlan && r.pdfGuardadoLista);
  P('y sus botones de exportar', (r.botonesExpGuardado||[]).length>=5,
    (r.botonesExpGuardado||[]).map(x=>x.replace('pcr-exp-','')).join(', '));
  P('que exportan ESTE sector, no otro', r.bajoAlgo && r.expGuardadoPuntos>0 && r.expGuardadoArea,
    (r.expGuardadoPuntos||0)+' puntos en el GeoJSON'+(r.expGuardadoError?' · '+r.expGuardadoError:''));
  P('los textos se leen', r.flojos===0, r.flojos+' textos por debajo de 3:1 (de '+r.contrastes.length+')');
  (r.muestraColores||[]).forEach(x=>console.log('      · '+x.cl+' '+x.c+' ('+x.r+':1) «'+x.t+'»'));

  console.log('\n  -- del sector guardado al análisis de los mapeos --');
  P('hay botón para cargar el área', r.hayBotonCargarArea);
  P('y al tocarlo el área queda cargada', r.areaCargada && r.verticesCargados>=4,
    '«'+r.nombreCargado+'» · '+r.verticesCargados+' vértices');

  console.log('');
  P('sin errores de JavaScript', err.filter(e=>!/L is not defined|Unexpected end/.test(e)).length===0, err.slice(0,2).join(' / ')||'ninguno');
  console.log(mal? '\n  '+mal+' fallaron\n' : '\n  todo pasó\n');
  await b.close(); process.exit(mal?1:0);
})();
