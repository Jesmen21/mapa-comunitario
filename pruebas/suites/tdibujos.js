const E = require('../entorno.js');
/* Tanda L · los dibujos del análisis.

   Un arquitecto mira antes de leer. Esta prueba comprueba que los cuatro
   dibujos —carta solar, rosa de los ocho rumbos, plano acotado del lote y
   trama de llenos y vacíos— salen en los tres sitios donde el análisis
   termina: la ficha de pantalla, la lámina de 60 × 90 y el PDF.

   La maqueta está armada para que la rosa tenga algo que decir: TODOS los
   usos están al oriente del centro, así que siete de los ocho rumbos quedan
   vacíos y se tienen que dibujar punteados.                                */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.006;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
// Todo al oriente: es lo que deja siete rumbos en cero.
for(let i=0;i<9;i++){
  const p=P(200+i*20, (i-4)*8);
  usos.push({type:'node',id:id++,lat:p.lat,lon:p.lng,
    tags:{name:'Tienda '+(i+1),shop:'convenience'}});
}
const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const edificio=(pts)=>({type:'way',id:id++,tags:{building:'yes','building:levels':'3'},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Avenida 3','secondary',[P(-400,60),P(0,60),P(400,60)]),
  via('Calle 7','residential',[P(-30,-200),P(-30,0),P(-30,60),P(-30,300)]),
  via('Calle 8','residential',[P(30,-200),P(30,0),P(30,60),P(30,300)]),
  edificio([P(60,-40),P(100,-40),P(100,0),P(60,0),P(60,-40)])
];

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
  await ctx.route(/overpass/, r=>{
    const q=(r.request().postData()||'')+r.request().url();
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
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    let capturado='';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    // El módulo de dibujos tiene que estar cargado y ser usable sin la app.
    o.hayModulo=!!(window.URBIS_DIBUJO && window.URBIS_DIBUJO.cartaSolar);
    o.tramaSuelta=window.URBIS_DIBUJO ? window.URBIS_DIBUJO.trama(37) : '';

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const trozo=(desde,largo)=>{
      const t=(H().textContent||'').replace(/\s+/g,' ');
      const i=t.indexOf(desde); return i<0?'':t.slice(i,i+largo);
    };

    // El trazado, para que haya llenos y vacíos y calles con nombre.
    await esperar(5200);
    H().querySelector('[data-pcr="trazado"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(600);

    // El lote, entre las dos calles.
    const LOTE=[Q(-20,-15),Q(20,-15),Q(20,15),Q(-20,15)];
    H().querySelector('[data-pcr="lote-dibujar"]').click(); await esperar(500);
    LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(800);

    const svg=sel=>H().querySelector(sel);
    const cuenta=(el,q)=>el?el.querySelectorAll(q).length:0;

    const carta=svg('.pcr-carta');
    o.carta={ hay:!!carta,
      arcos:cuenta(carta,'path[stroke-dasharray="4 3"]'),
      hoy:carta?(carta.querySelector('path[stroke-width="3"]')||{}).getAttribute?
            carta.querySelector('path[stroke-width="3"]').getAttribute('d').length:0 : 0,
      textos:carta?[...carta.querySelectorAll('text')].map(t=>t.textContent):[],
      etq:carta?carta.getAttribute('aria-label'):'' };
    o.cartaPie=trozo('Vista desde arriba',180);

    const rosa=svg('.pcr-rosa-rumbos');
    o.rosa={ hay:!!rosa,
      gajos:cuenta(rosa,'path'),
      vacios:cuenta(rosa,'path[stroke-dasharray="3 3"]'),
      letras:rosa?[...rosa.querySelectorAll('text')].map(t=>t.textContent).join(''):'' };

    const plano=svg('.pcr-plano-lote');
    o.plano={ hay:!!plano,
      textos:plano?[...plano.querySelectorAll('text')].map(t=>t.textContent):[],
      // La fachada crítica va más gruesa que las demás: 5 contra 3,5. Y todas
      // llevan color, del rojo al azul, según cuánto sol de la tarde reciben.
      critica:cuenta(plano,'path[stroke-width="5"]'),
      conColor:cuenta(plano,'path[stroke-width="3.5"], path[stroke-width="5"]'),
      esquinas:cuenta(plano,'circle') };

    const tr=svg('.pcr-trama');
    o.trama={ hay:!!tr, celdas:cuenta(tr,'rect'), etq:tr?tr.getAttribute('aria-label'):'' };

    // ── El papel.
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La Playa, borde oriental';
    H().querySelector('[data-pcr="lamina-ver"]').click(); await esperar(500);
    o.lamina=capturado; capturado='';
    H().querySelector('[data-pcr="lamina-ver-h"]').click(); await esperar(500);
    o.laminaH=capturado; capturado='';
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(500);
    o.pdf=capturado; capturado='';

    // ── Y la ficha guardada, que imprime desde su propia copia.
    const bg=[...H().querySelectorAll('button')].filter(b=>/Guardar ficha/i.test(b.textContent||''))[0];
    if(bg){ bg.click(); await esperar(700); }
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(800);
    const cab=[...document.querySelectorAll('.pcr-pest-cab')][0];
    if(cab){ cab.click(); await esperar(700); }
    const cuerpo=document.querySelector('.pcr-pest-cuerpo');
    o.guardada={ carta:!!(cuerpo&&cuerpo.querySelector('.pcr-carta')),
                 plano:!!(cuerpo&&cuerpo.querySelector('.pcr-plano-lote')) };
    /* Desde el sector guardado la lámina BAJA un PDF y no pasa por la vista
       de impresión: se toma del armador del PDF, que recibe el mismo HTML, y
       se le corta la bajada para no llenar la carpeta de descargas. */
    if (window.URBIS_PLIEGO_PDF) {
      window.URBIS_PLIEGO_PDF.bajar = function () {};
      window.URBIS_PLIEGO_PDF.generar = function (h) { capturado = h;
        return Promise.resolve({ blob: new Blob(['x']), dpi: 120, bytes: 1, ancho: 1, alto: 1 }); };
    }
    const bl=[...document.querySelectorAll('[data-u52-call="pcr-lamina"]')][0];
    if(bl){ bl.click(); await esperar(600); }
    o.laminaGuardada=capturado; capturado='';
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));

  // Las dos láminas, medidas a tamaño real: un dibujo de más y la última caja
  // se recorta sin decirlo.
  const medir=async(html,w,h)=>{
    const m=await ctx.newPage();
    await m.setViewportSize({width:w,height:h});
    await m.setContent(html||'<i></i>',{waitUntil:'load'});
    await m.waitForTimeout(400);
    const out=await m.evaluate(()=>({
      /* En columnas, la caja que no cabe no se recorta: se va a una columna
         que no existe y desaparece del papel sin dejar rastro. Se detecta
         mirando si alguna queda fuera del rectángulo de la rejilla. */
      perdidas: (function () {
        const rej = document.querySelector('.rej');
        if (!rej) return [];
        const R = rej.getBoundingClientRect();
        const fuera = [...rej.children].filter(c => {
          const b = c.getBoundingClientRect();
          return b.height === 0 || b.right > R.right + 2;
        }).map(c => (c.querySelector('h2') || {}).textContent || '?');
        // Y la hoja entera: si el contenido la pasó, lo de abajo se imprime
        // fuera del papel, que es la misma pérdida por otra puerta.
        const h = document.querySelector('.hoja');
        if (h && h.scrollHeight > h.clientHeight + 2) {
          fuera.push('(la hoja se pasa ' + (h.scrollHeight - h.clientHeight) + ' px de alto)');
        }
        return fuera;
      })(),
      cajas:[...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?'),
      dibujos:[...document.querySelectorAll('.dib svg')].length
    }));
    await m.close(); return out;
  };
  r.medidaV=await medir(r.lamina,2268,3402);
  r.medidaH=await medir(r.laminaH,3402,2268);
  fs.writeFileSync(S+'dibujos-lamina.html', r.lamina||'', 'utf8');
  fs.writeFileSync(S+'dibujos-lamina-h.html', r.laminaH||'', 'utf8');
  fs.writeFileSync(S+'lamina-h.html', r.laminaH||'', 'utf8');
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- el módulo de dibujos --');
  T('carga aparte de la ficha', r.hayModulo===true);
  T('y dibuja sin depender de una hoja de estilos',
    /fill="#0A6F9E"/.test(r.tramaSuelta||''), 'los colores van en los atributos');

  console.log('\n  -- la carta solar --');
  T('sale en la ficha', r.carta.hay===true);
  T('con el recorrido de hoy dibujado', r.carta.hoy>40, r.carta.hoy+' caracteres de trazo');
  T('y los dos extremos del año, punteados', r.carta.arcos>=2, r.carta.arcos+' arcos');
  T('rotulada con los cuatro puntos cardinales',
    ['N','E','S','O'].every(x=>r.carta.textos.indexOf(x)>=0), r.carta.textos.join(' '));
  T('y con la altura del sol al mediodía',
    r.carta.textos.some(t=>/Hoy · [\d,.]+°/.test(t)), r.carta.textos.filter(t=>/Hoy/.test(t))[0]||'—');
  T('lleva su explicación al pie', /el centro es el cenit/.test(r.cartaPie));
  T('y una descripción para quien no ve el dibujo', /recorrido del sol/.test(r.carta.etq||''));

  console.log('\n  -- la rosa de los ocho rumbos --');
  T('sale en la ficha', r.rosa.hay===true);
  T('con un gajo por rumbo', r.rosa.gajos===8, r.rosa.gajos+' gajos');
  T('y los rumbos sin nada, punteados',
    r.rosa.vacios>=5 && r.rosa.vacios<8, r.rosa.vacios+' vacíos de 8');
  T('rotulada N E S O', r.rosa.letras==='NESO', r.rosa.letras);

  console.log('\n  -- el plano acotado del lote --');
  T('sale en la ficha', r.plano.hay===true);
  /* Cada lado lleva su medida, y si da a una calle registrada la medida y el
     nombre van en el MISMO rótulo: separados se pisaban al imprimir. */
  const cotas=(r.plano.textos||[]).filter(t=>/^\d+([.,]\d+)? m( ·|$)/.test(t));
  T('con la cota de cada lado', cotas.length>=4, cotas.join(' / '));
  T('con la calle a la que da cada frente',
    (r.plano.textos||[]).some(t=>/Calle [78]/.test(t)),
    (r.plano.textos||[]).filter(t=>/Calle/.test(t)).join(' · ')||'ninguna');
  T('con el norte y la barra de escala',
    (r.plano.textos||[]).indexOf('N')>=0 && (r.plano.textos||[]).some(t=>/^\d+ m$/.test(t)));
  /* Ya no es «en rojo, la fachada»: cada lado lleva el color de cuánto sol
     de la tarde recibe, del rojo al azul, y la leyenda es esa escala. Llegó
     de campo que al lado de la línea roja también pegaba el sol. */
  T('y la escala del sol en su propio renglón',
    (r.plano.textos||[]).some(t=>/^Sol de la tarde sobre cada lado/.test(t)));
  T('con cada lado coloreado y la fachada de la tarde más gruesa',
    r.plano.critica===1 && r.plano.conColor>=4, r.plano.conColor+' lados con color · '+r.plano.critica+' gruesa');
  T('una esquina dibujada por vértice', r.plano.esquinas===4, r.plano.esquinas);

  console.log('\n  -- la trama de llenos y vacíos --');
  T('sale en la ficha', r.trama.hay===true);
  T('con cien cuadraditos', r.trama.celdas===100, r.trama.celdas);
  T('y dice qué son, para quien no la ve', /de cada cien/.test(r.trama.etq||''), r.trama.etq);

  console.log('\n  -- y en el papel --');
  const LAM=r.lamina||'', LH=r.laminaH||'', PDF=r.pdf||'', LG=r.laminaGuardada||'';
  T('la lámina lleva los cuatro dibujos',
    /pcr-carta/.test(LAM) && /pcr-rosa-rumbos/.test(LAM) && /pcr-plano-lote/.test(LAM) && /pcr-trama/.test(LAM),
    ['carta','rosa','plano','trama'].filter((x,i)=>
      [/pcr-carta/,/pcr-rosa-rumbos/,/pcr-plano-lote/,/pcr-trama/][i].test(LAM)).join(' '));
  T('con su propia caja de «dónde falta mapear»', /Dónde falta mapear/.test(LAM));
  T('el pliego acostado también', r.medidaH.dibujos===r.medidaV.dibujos,
    r.medidaH.dibujos+' vs '+r.medidaV.dibujos);
  T('el PDF también',
    /pcr-carta/.test(PDF) && /pcr-rosa-rumbos/.test(PDF) && /pcr-plano-lote/.test(PDF) && /pcr-trama/.test(PDF));
  T('y la lámina de un sector guardado', /pcr-plano-lote/.test(LG) && /pcr-carta/.test(LG));
  T('ninguna caja se recorta en la vertical', (r.medidaV.cajas||[]).length===0,
    (r.medidaV.cajas||[]).join(' · ')||'ninguna');
  T('ni se pierde ninguna fuera de la hoja, en ninguna de las dos',
    (r.medidaV.perdidas||[]).length===0 && (r.medidaH.perdidas||[]).length===0,
    ((r.medidaV.perdidas||[]).concat(r.medidaH.perdidas||[]).join(' · '))||'ninguna');
  T('ni en la acostada', (r.medidaH.cajas||[]).length===0,
    (r.medidaH.cajas||[]).join(' · ')||'ninguna');

  console.log('\n  -- la ficha guardada --');
  T('reabierta, conserva la carta solar', r.guardada.carta===true);
  T('y el plano del lote', r.guardada.plano===true);

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
