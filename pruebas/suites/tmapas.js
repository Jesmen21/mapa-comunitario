const E = require('../entorno.js');
/* Tanda S · la banda de mapas del pliego.

   El curso lo dijo con todas las letras: «en el PDF la diagramación de ese
   pliego es más importante mostrar los mapas con los raster que cualquier
   otra cosa, recuerda que somos visuales». Esta prueba es esa frase escrita
   en código.

   Se monta un sector con tres categorías bien pobladas —comercio, comida y
   educación—, calles y huellas de edificio, y se le da de comer una lectura
   de la foto satelital ya hecha (el clasificador de veras necesita bajar
   teselas, que acá no salen). Con eso, la banda tiene que traer:

     · un recuadro por capa con datos, encendida o apagada;
     · los rasters y los llenos —los dibujos de grano fino— PRIMEROS y al
       doble de ancho, con la imagen de verdad dentro del SVG;
     · la banda arriba del todo, antes del texto, en la lámina y en el PDF.

   Y nada de eso puede empujar una caja fuera de la hoja.

   Una diferencia que hay que tener presente al leer lo de abajo: EL PLIEGO Y
   EL PDF NO TRAEN LO MISMO, y es a propósito. El PDF son hojas, crecen, y
   traen todo lo medido. El pliego mide 90 × 60 y no crece: su banda tiene
   siete columnas y los recuadros no se encogen para que quepan todos —así se
   llegó a los recuadros de 53 mm que se reportaron como «no se ve con
   claridad los rasters o los llenos y vacíos»—, así que los que sobran se
   quedan fuera y el selector de la ficha lo avisa antes de imprimir. De ahí
   que «un recuadro por capa con datos» se le exija al PDF, y al pliego se le
   exija otra cosa: que traiga los que importan, a un tamaño que se lea.   */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
// Un PNG de un píxel: lo único que importa es que sea una imagen válida y
// que su URL viaje entera hasta el atributo href del <image>.
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const nodo=(tags,dx,dy)=>({type:'node',id:id++,lat:P(dx,dy).lat,lon:P(dx,dy).lng,tags:tags});
const usos=[];
// Comercio (6), comida (4) y educación (3): las tres pasan el umbral de tres
// y por lo tanto las tres merecen su propio mapa de calor.
for(let i=0;i<6;i++) usos.push(nodo({shop:'clothes',name:'Ropa '+i}, -180+i*40, 120));
for(let i=0;i<4;i++) usos.push(nodo({amenity:'restaurant',name:'Comida '+i}, 60+i*40, -140));
for(let i=0;i<3;i++) usos.push(nodo({amenity:'school',name:'Colegio '+i}, -120+i*60, -220));
// Y dos sueltos de un rubro flaco, que NO debe ganarse un recuadro.
usos.push(nodo({shop:'optician',name:'Óptica'}, 200, 200));

const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const edificio=(pts,pisos)=>({type:'way',id:id++,
  tags:{building:'yes','building:levels':String(pisos)},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Calle 7','residential',[P(-300,-300),P(-300,0),P(-300,300)]),
  via('Avenida 3','secondary',[P(-400,80),P(0,80),P(400,80)]),
  edificio([P(-60,-10),P(-40,-10),P(-40,10),P(-60,10),P(-60,-10)], 10),
  edificio([P(60,-60),P(90,-60),P(90,-30),P(60,-30),P(60,-60)], 3),
  edificio([P(120,120),P(160,120),P(160,160),P(120,160),P(120,120)], 5)
];

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
  await ctx.route(/overpass/, r=>{
    const q=(r.request().postData()||'')+r.request().url();
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements: /out(\+|%20|\s)geom/.test(q) ? geo : usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map((lng,i)=>320+i*3)})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL,PNG}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    let capturado='';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    /* La lectura de la foto se sustituye entera: el clasificador de verdad
       baja teselas de satélite, que en este entorno no salen. Lo que la banda
       necesita de él son dos imágenes y sus límites, y eso se le da hecho. */
    const LIM=[[POL[0].lat,POL[0].lng],[POL[2].lat,POL[2].lng]];
    A.analizarRaster = function(avisar){
      if (typeof avisar==='function') avisar('Leyendo la foto…');
      return Promise.resolve({
        pixeles: 480000, imagen: PNG, overlayImagen: PNG, overlayLimites: LIM,
        areaM2: 790000, pctAmbiguo: 12.5,
        clases: [
          {id:'construido', etq:'Superficie dura gris', color:'#94a3b8', pct:52.0, m2:410000, fiable:true, nota:'.'},
          {id:'verde',      etq:'Vegetación viva',      color:'#22c55e', pct:24.5, m2:193000, fiable:true, nota:'.'},
          {id:'mixto',      etq:'Tonos cálidos (no separables)', color:'#c9a26a', pct:12.5, m2:99000, fiable:false, nota:'.'},
          {id:'agua',       etq:'Agua',                 color:'#3b82f6', pct:11.0, m2:87000, fiable:true, nota:'.'}
        ]
      });
    };
    A.mostrarRaster = function(){};

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const btn=id=>H().querySelector('[data-pcr="'+id+'"]');

    // ── Huellas de edificio, para el mapa de llenos y vacíos.
    await esperar(5200);
    btn('trazado').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(600);

    // ── La foto y su clasificación.
    const bc=btn('cobertura');
    o.hayBotonCobertura=!!bc;
    if(bc){ bc.click(); await esperar(1200); }
    o.cobertura=!!(R.cobertura() && R.cobertura().overlayImagen);

    // ── El lote, para que la lámina tenga también algo que decir del predio.
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    btn('lote-dibujar').click(); await esperar(500);
    [Q(-20,-15),Q(20,-15),Q(20,15),Q(-20,15)].forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(900);

    // ── El papel.
    const asa=H().querySelector('[data-pcr="agrandar"]');
    if(asa){ asa.click(); await esperar(500); }
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La banda de mapas';
    // La vista de impresión: el botón «Lámina … · PDF» baja el archivo y no
    // pasa por acá, y lo que esta prueba lee es la hoja.
    btn('lamina-ver').click(); await esperar(900);
    o.lamina=capturado; capturado='';
    btn('imprimir').click(); await esperar(900);
    o.pdf=capturado; capturado='';
    return o;
  },{C,POL,PNG});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  const medir=async(html,w,h)=>{
    const m=await ctx.newPage();
    await m.setViewportSize({width:w,height:h});
    await m.setContent(html||'<i></i>',{waitUntil:'load'});
    await m.waitForTimeout(500);
    const out=await m.evaluate(()=>({
      perdidas: (function () {
        const rej = document.querySelector('.rej');
        if (!rej) return [];
        const R = rej.getBoundingClientRect();
        const fuera = [...rej.children].filter(c => {
          const b = c.getBoundingClientRect();
          return b.height === 0 || b.right > R.right + 2;
        }).map(c => (c.querySelector('h2') || {}).textContent || '?');
        const h = document.querySelector('.hoja');
        if (h && h.scrollHeight > h.clientHeight + 2) {
          fuera.push('(la hoja se pasa ' + (h.scrollHeight - h.clientHeight) + ' px de alto)');
        }
        return fuera;
      })(),
      cajas:[...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?'),
      /* A qué escala se compuso la hoja para cerrar. La lámina no crece: con
         muchos mapas se compone más chica, y eso hay que poder verlo. */
      escala: (function(){ const r=document.querySelector('.rej');
        const t=r?getComputedStyle(r).transform:'none';
        const m=t&&t!=='none'?t.match(/matrix\(([\d.]+)/):null; return m?Number(m[1]):1; })(),
      anchos: [...document.querySelectorAll('.mapa-caja')].map(f=>({
        g: f.getAttribute('data-g')||'',
        w: Math.round(f.getBoundingClientRect().width),
        alto: Math.round(f.getBoundingClientRect().height)
      }))
    }));
    await m.close(); return out;
  };
  r.medida=await medir(r.lamina,2268,3402);
  fs.writeFileSync(S+'mapas-lamina.html', r.lamina||'', 'utf8');
  fs.writeFileSync(S+'mapas-pdf.html', r.pdf||'', 'utf8');
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const LAM=r.lamina||'', PDF=r.pdf||'';
  // En la lámina un mapa es una caja con `data-g`; en el PDF sigue siendo una
  // figura de la tira, porque el PDF son hojas y no tiene que elegir nada.
  const conBanda=h=>(h.match(/<section class="caja mapa-caja[^>]*data-g="([^"]+)"[^>]*><h2>([^<]+)<\/h2>/g)||[])
    .map(x=>({ g:(x.match(/data-g="([^"]+)"/)||[])[1], t:(x.match(/<h2>([^<]+)/)||[])[1] }));
  const figuras=h=>/mapa-caja/.test(h) ? conBanda(h).length : (h.match(/<figure class="mp/g)||[]).length;
  const grandes=h=>(h.match(/<figure class="mp grande"/g)||[]).length;
  const titulos=h=>/mapa-caja/.test(h)
    ? conBanda(h).map(x=>x.t.replace(/ · el mapa$/,''))
    : (h.match(/<figcaption>([^<]+)<\/figcaption>/g)||[]).map(t=>t.replace(/<[^>]+>/g,''));

  console.log('\n  -- lo que se midió antes de imprimir --');
  T('la foto satelital quedó leída', r.cobertura===true);

  console.log('\n  -- los mapas, cada uno con su tema --');
  /* Ya no hay una tira: cada mapa es una caja con `data-g` dentro de la banda
     de su tema. Se pidió así —«en vez de que los mapas salgan en una sola
     línea, que se integren dependiendo el tema»— y por dos razones que se
     sostienen solas: un mapa de curvas al lado de la caja del terreno dice
     algo, y el mismo mapa a treinta centímetros en una tira con otros ocho
     es un recuadro que hay que ir a buscar. */
  T('los mapas van en cajas propias, no en una tira', figuras(LAM) >= 4,
    figuras(LAM) + ' cajas de mapa');
  T('cada una dice a qué banda pertenece',
    figuras(LAM) > 0 && conBanda(LAM).length === figuras(LAM),
    conBanda(LAM).map(x => x.g + ': ' + x.t).join(' · ') || 'ninguna');
  /* Y en la banda correcta, no en cualquiera. Un mapa de usos en la banda
     ambiental está tan perdido como en una tira. */
  const enBanda = (t, g) => conBanda(LAM).some(x => x.t.indexOf(t) === 0 && x.g === g);
  T('la cobertura va con lo ambiental', enBanda('Cobertura del suelo', 'ambiental'));
  T('la foto va con la ubicación', enBanda('La foto satelital', 'ubicacion'));
  T('los usos van con lo demográfico', enBanda('Todos los usos', 'demografico'));
  T('los llenos van con la morfología', enBanda('Llenos y vacíos', 'forma'));
  T('cada caja tiene su título y su pie',
    (LAM.match(/<div class="mp-dib">/g)||[]).length===figuras(LAM) &&
    (LAM.match(/<small class="mp-pie">/g)||[]).length===figuras(LAM),
    titulos(LAM).slice(0,4).join(' · '));
  /* NINGUNO se queda fuera. Hubo una versión que dejaba uno por tema para que
     salieran grandes, y la tumbó el uso real: «veo 10 mapas en el último
     análisis que hice, no me dejes mapas a un lado». Lo que cede para que
     quepan es el tamaño al que se compone la hoja, no la lista. */
  T('los de calor por categoría no se quedan fuera',
    titulos(LAM).filter(t=>/ropa|comida|educa|comerc/i.test(t)).length>=2,
    titulos(LAM).join(' · '));
  T('y el mapa que ubica —todos los usos— está',
    titulos(LAM).indexOf('Todos los usos')>=0, titulos(LAM).join(' · '));
  T('y el rubro de un solo local no se gana un recuadro',
    !titulos(LAM).some(t=>/óptica/i.test(t)));
  /* La hoja no crece: con muchos mapas se compone más chica. Lo que no puede
     pasar es que se pase del papel, que es perder cajas en silencio. */
  T('y la hoja cierra, compuesta a la escala que haga falta',
    (r.medida.perdidas||[]).length===0 && (r.medida.cajas||[]).length===0,
    'compuesta al ' + Math.round((r.medida.escala||1)*100) + '%');

  console.log('\n  -- los rasters siguen mandando --');
  T('la clasificación y la foto están las dos',
    /Cobertura del suelo/.test(LAM) && /La foto satelital/.test(LAM));
  T('la imagen viaja de verdad dentro del dibujo',
    (LAM.match(/<image href="data:image\/png;base64,/g)||[]).length===2,
    (LAM.match(/<image href="data:image\/png/g)||[]).length+' imágenes');
  T('el pie dice con qué se quedó la clasificación',
    /Superficie dura gris 52%/.test(LAM));

  /* ── La tabla de convenciones ────────────────────────────────────────
     Llegó pedida y con razón: «a los mapas les hace falta tabla de
     convenciones». Hasta acá el único recuadro que decía qué era cada color
     era el plano del sector; los demás dejaban el color en el dibujo y el
     significado en el pie, en texto corrido, que es donde nadie lo cruza.

     Lo que se comprueba no es que la tabla EXISTA —eso lo cumpliría una
     tabla que mintiera—: es que sus colores sean los que el dibujo usa de
     verdad. Una convención que nombra un color que el mapa no pinta es peor
     que ninguna, porque manda a buscar algo que no está.

     Los rasters quedan fuera de esa comprobación y no por comodidad: sus
     colores viven dentro del PNG clasificado, no en el SVG, así que ahí no
     hay nada que cotejar. */
  const cajasMapa = h => (h.split('<section class="caja mapa-caja').slice(1))
    .map(x => '<section class="caja mapa-caja' + x.split('</section>')[0]);
  const tituloDe = x => ((x.match(/<h2>([^<]+)<\/h2>/) || [])[1] || '?');
  const muestrasDe = x => (x.match(/class="mu mu-[a-z]+" style="[^"]*(?:background|border-color):\s*([^;"]+)/g) || [])
    .map(m => (m.match(/(?:background|border-color):\s*([^;"]+)/) || [])[1].trim().toLowerCase());
  const coloresDelDibujo = x => {
    const d = (x.match(/<div class="mp-dib">([^]*?)<\/div>/) || [])[1] || '';
    return (d.match(/(?:fill|stroke)="(#[0-9a-fA-F]{3,6})"/g) || [])
      .map(m => (m.match(/"(#[0-9a-fA-F]{3,6})"/) || [])[1].toLowerCase());
  };
  const esRaster = x => /<image href=/.test(x);

  console.log('\n  -- la tabla de convenciones de cada mapa --');
  const conTabla = cajasMapa(LAM).filter(x => muestrasDe(x).length > 0);
  /* La foto satelital cruda queda fuera y no por descuido: no usa el color
     para significar nada —es una fotografía—, así que no tiene qué nombrar.
     El que sí lo usa es el raster CLASIFICADO, y ese lleva su tabla. */
  const sinTabla = cajasMapa(LAM)
    .filter(x => muestrasDe(x).length === 0 && !/La foto satelital/.test(tituloDe(x)))
    .map(tituloDe);
  T('todos los mapas del pliego la llevan, menos la foto cruda', sinTabla.length === 0,
    sinTabla.join(' · ') || conTabla.length + ' mapas, todos con tabla');
  const mienten = cajasMapa(LAM).filter(x => !esRaster(x) && muestrasDe(x).length)
    .map(x => ({ t: tituloDe(x),
                 sobran: muestrasDe(x).filter(c => coloresDelDibujo(x).indexOf(c) < 0) }))
    .filter(x => x.sobran.length);
  T('y ninguna nombra un color que el mapa no pinta', mienten.length === 0,
    mienten.map(x => x.t + ' (' + x.sobran.join(', ') + ')').join(' · ') || 'todas dicen la verdad');
  const vial = cajasMapa(LAM).filter(x => /Jerarquía vial/.test(tituloDe(x)))[0] || '';
  /* Cuántas jerarquías salgan depende del sector: acá lo que se pide es que
     haya una muestra por cada una NOMBRADA con sus kilómetros, sin inventar
     categorías que el sector no tiene. */
  T('la jerarquía vial dice qué color es cada categoría, con sus kilómetros',
    muestrasDe(vial).length >= 2 &&
    muestrasDe(vial).length === (vial.match(/ km<\/span>/g) || []).length &&
    new Set(muestrasDe(vial)).size === muestrasDe(vial).length,
    muestrasDe(vial).length + ' muestras · ' +
    (vial.match(/>([A-ZÁÉÍÓÚ][^<·]*) · [\d,]+ km</g) || []).map(x => x.slice(1).split(' ·')[0]).join(', '));
  const somb = cajasMapa(LAM).filter(x => /sombra de los vecinos · el mapa/i.test(tituloDe(x)))[0] || '';
  T('y las sombras, qué mancha es de qué hora',
    /9:00 ·/.test(somb) && /15:00 ·/.test(somb), muestrasDe(somb).length + ' muestras');
  T('la muestra lleva la forma del dato, no siempre un punto',
    /mu-linea/.test(LAM) && /mu-area/.test(LAM) && /mu-punto/.test(LAM),
    ['punto', 'linea', 'area', 'punteado'].filter(f => LAM.indexOf('mu-' + f) >= 0).join(' · '));
  /* Con el `> 0` delante: sin él, «cero tablas acá y cero allá» pasaba, que
     es exactamente el estado que esta suite viene a impedir. */
  T('el informe en hojas trae las mismas tablas',
    conTabla.length > 0 && (PDF.match(/class="cv-l"/g) || []).length === conTabla.length,
    (PDF.match(/class="cv-l"/g) || []).length + ' en el informe · ' + conTabla.length + ' en el pliego');

  console.log('\n  -- la banda en el PDF --');
  T('el PDF también empieza por los mapas',
    /Los mapas del sector/.test(PDF) &&
    PDF.indexOf('Los mapas del sector') < PDF.indexOf('Qué hay, por categoría'));
  /* Acá sí: un recuadro por capa con datos. El PDF son hojas y crecen, así
     que no tiene por qué elegir —y es donde queda lo que el pliego dejó
     fuera—. */
  T('trae un recuadro por capa con datos', figuras(PDF)>=6, figuras(PDF)+' recuadros');
  T('los usos salen todos juntos y por categoría',
    /Todos los usos/.test(PDF) && titulos(PDF).filter(t=>/ropa|comida|educa|comerc/i.test(t)).length>=2,
    titulos(PDF).join(' · '));
  /* Los mismos que el pliego, uno por uno: ninguno de los dos elige. Lo que
     los distingue es CÓMO los presentan —el PDF en una tira, hoja tras hoja;
     el pliego repartidos por tema y con la hoja compuesta más chica—, no
     cuáles traen. */
  T('con los mismos que el pliego, sin dejar ninguno a un lado',
    figuras(PDF) === figuras(LAM) &&
    titulos(LAM).every(t => titulos(PDF).indexOf(t) >= 0),
    figuras(PDF)+' en el PDF y '+figuras(LAM)+' en el pliego · ' +
    (titulos(LAM).filter(t => titulos(PDF).indexOf(t) < 0).join(' · ') || 'los mismos'));
  T('los de grano fino primeros y al doble', grandes(PDF)===3 &&
    titulos(PDF)[0]==='Cobertura del suelo', titulos(PDF).slice(0,3).join(' · '));
  T('y la hoja sabe darles ese doble',
    /\.mp\.grande\{grid-column:span 2\}/.test(PDF));
  T('un recuadro no se parte entre dos páginas',
    /break-inside:avoid/.test(PDF));
  T('la imagen de la foto va dentro del PDF',
    (PDF.match(/<image href="data:image\/png;base64,/g)||[]).length===2);

  console.log('\n  -- y nada se cae de la hoja --');
  T('ninguna caja se recorta', (r.medida.cajas||[]).length===0,
    (r.medida.cajas||[]).join(' · ')||'ninguna');
  T('ni se pierde fuera de la hoja', (r.medida.perdidas||[]).length===0,
    (r.medida.perdidas||[]).join(' · ')||'ninguna');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
