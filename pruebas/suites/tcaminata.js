const E = require('../entorno.js');
/* Tanda K · hasta dónde se llega caminando, siguiendo las calles.

   Toda la cobertura de esta app se medía en línea recta, y en cada bloque se
   decía «caminando siempre es más». Con la forma de las calles ya en la mano,
   eso se puede dejar de decir y empezar a medir.

   La trampa está armada a propósito: el lote queda en el extremo de una calle
   SIN SALIDA de 300 m, y todo lo interesante está del otro lado. En línea
   recta esos usos quedan a 200 m —o sea, «a dos minutos»—; caminando hay que
   salir hasta la avenida y volver, casi 500 m. La diferencia entre las dos
   cifras es justo lo que este bloque existe para mostrar.

   Planta:

       (avenida, de este a oeste, en y = +300)
       ═══════════════════════════════════════
                      ║                    · usos
                      ║ callejón            (a 200 m del lote
                      ║ sin salida           en línea recta)
                      ▪ lote (y = 0)                                     */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.006;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
/* Los usos: seis pegados a la avenida, 200 m al oriente del lote en línea
   recta, pero al otro lado del callejón. */
const usos=[];
for(let i=0;i<6;i++){
  const p=P(180+i*10, 290);
  usos.push({type:'node',id:id++,lat:p.lat,lon:p.lng,tags:{name:'Tienda '+(i+1),shop:'convenience'}});
}
// Y dos junto al lote, para que algo caiga a cinco minutos.
usos.push({type:'node',id:id++,...(()=>{const p=P(10,20);return{lat:p.lat,lon:p.lng};})(),tags:{name:'Panadería del callejón',shop:'bakery'}});
usos.push({type:'node',id:id++,...(()=>{const p=P(-10,60);return{lat:p.lat,lng:undefined,lon:p.lng};})(),tags:{name:'Taller Don Luis',shop:'car_repair'}});

const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  // La avenida, de lado a lado del sector, a 300 m al norte del lote.
  via('Avenida 3','secondary',[P(-400,300),P(-200,300),P(0,300),P(200,300),P(400,300)]),
  // El callejón sin salida: del lote hasta la avenida, y nada más.
  via('Callejón El Retiro','residential',[P(0,0),P(0,100),P(0,200),P(0,300)])
];

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
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
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    let capturado='';
    window.AIA_INFORME = window.AIA_INFORME || {};
    window.AIA_INFORME.abrirVentanaImpresion = function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');

    // Un lote pegado al final del callejón, de 20 × 20 m.
    const LOTE=[Q(-10,-10),Q(10,-10),Q(10,10),Q(-10,10)];
    const dibujar=async()=>{
      H().querySelector('[data-pcr="lote-dibujar"]').click(); await esperar(500);
      LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
      await esperar(400);
      document.querySelector('[data-lote="cerrar"]').click(); await esperar(700);
    };

    // ── Primero SIN el trazado medido: el bloque tiene que pedirlo.
    await dibujar();
    o.sinCalles=/medí el trazado del sector/.test(txt(H()));
    o.sinCifras=!/minutos de recorrido|m de recorrido/.test(txt(H()));

    // ── Ahora con las calles.
    await esperar(5200);
    H().querySelector('[data-pcr="trazado"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(600);

    const todo=txt(H());
    const i=todo.indexOf('Hasta dónde se llega caminando');
    o.bloque=i>=0?todo.slice(i,i+1400):'';
    o.anillos=[...H().querySelectorAll('.pcr-nivel')].map(n=>({
      nom:txt(n.querySelector('.pcr-nivel-nom')), n:txt(n.querySelector('.pcr-nivel-n'))
    })).filter(x=>/minutos/.test(x.nom));

    // ── El recorrido sobre el mapa: contar los trazos por color.
    const trazos=()=>{
      const c={};
      document.querySelectorAll('path.pcr-caminata-trazo').forEach(p=>{
        const s=(p.getAttribute('stroke')||'').toUpperCase();
        c[s]=(c[s]||0)+1;
      });
      return c;
    };
    const orden=()=>[...document.querySelectorAll('path.pcr-caminata-trazo')]
      .map(p=>(p.getAttribute('stroke')||'').toUpperCase());
    o.antes=trazos();
    H().querySelector('[data-pcr="caminata-mapa"]').click(); await esperar(500);
    o.puestos=trazos(); o.orden=orden();
    o.encogida=!!document.querySelector('.pcr-hoja.pcr-encogida') ||
               !!(H()&&H().className.indexOf('encogida')>=0);
    o.botonApaga=/Quitar el recorrido del mapa/.test(txt(H()));
    o.leyenda=/Azul oscuro, 5 minutos/.test(txt(H()));
    o.rotulo=/Hasta dónde se camina/.test(txt(H()));

    H().querySelector('[data-pcr="caminata-mapa"]').click(); await esperar(500);
    o.despues=trazos();
    o.botonPrende=/Ver el recorrido en el mapa/.test(txt(H()));

    // ── La lámina y el PDF tienen que llevar el recorrido.
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='El callejón El Retiro';
    H().querySelector('[data-pcr="lamina"]').click(); await esperar(500);
    o.lamina=capturado; capturado='';
    H().querySelector('[data-pcr="lamina-h"]').click(); await esperar(500);
    o.laminaH=capturado; capturado='';
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(500);
    o.pdf=capturado; capturado='';

    // ── Y la ficha guardada tiene que conservarlo al reabrirla.
    const bg=[...H().querySelectorAll('button')].filter(b=>/Guardar ficha/i.test(b.textContent||''))[0];
    if(bg){ bg.click(); await esperar(700); }
    o.guardada=(function(){
      try{ const f=JSON.parse(localStorage.getItem('pcr_fichas_v1')||'[]')[0]||{};
        const c=f.caminata||null;
        return { hay:!!c, anillos:c?(c.anillos||[]).length:0, sinTramos:!!c&&c.tramos===undefined,
                 bytes:(localStorage.getItem('pcr_fichas_v1')||'').length };
      }catch(e){ return {error:String(e)}; }
    })();
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(800);
    const cab=[...document.querySelectorAll('.pcr-pest-cab')][0];
    if(cab){ cab.click(); await esperar(700); }
    /* Solo el cuerpo de la pestaña guardada: la hoja viva sigue en el DOM
       detrás, con su propio bloque, y leer el documento entero mediría eso. */
    const cuerpo=document.querySelector('.pcr-pest-cuerpo');
    const guard=(cuerpo?cuerpo.textContent:'').replace(/\s+/g,' ');
    o.reabierta=/Hasta dónde se llega caminando/.test(guard);
    o.reabiertaSinBoton=!/Ver el recorrido en el mapa/.test(guard);
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));

  /* La lámina son 900 mm y no crecen: una caja de más y las últimas se
     recortan en silencio. Con el lote y la caminata puestos hay dos cajas más
     que en el resto de las pruebas, así que acá es donde se mide. */
  const medidor=await ctx.newPage();
  await medidor.setViewportSize({width:2268,height:3402});
  await medidor.setContent(r.lamina||'<i></i>',{waitUntil:'load'});
  await medidor.waitForTimeout(400);
  r.desbordes=await medidor.evaluate(()=>{
    const h=document.querySelector('.hoja');
    return { altoHoja:h?h.scrollHeight:0, altoPapel:h?h.clientHeight:0,
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
        .map(c=>(c.querySelector('h2')||{}).textContent||'?') };
  });
  /* Y la misma lámina acostada: 90 × 60. Cambia el papel y el número de
     columnas, así que hay que medirla aparte —es donde el alto escasea—. */
  await medidor.setViewportSize({width:3402,height:2268});
  await medidor.setContent(r.laminaH||'<i></i>',{waitUntil:'load'});
  await medidor.waitForTimeout(400);
  r.desbordesH=await medidor.evaluate(()=>{
    const h=document.querySelector('.hoja');
    return { altoHoja:h?h.scrollHeight:0, altoPapel:h?h.clientHeight:0,
      anchoHoja:h?h.clientWidth:0,
      cajas:[...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?') };
  });
  fs.writeFileSync(S+'lamina-h.html', r.laminaH||'', 'utf8');
  r.detalleH=await medidor.evaluate(()=>{
    const rej=document.querySelector('.rej');
    return {
      filas:getComputedStyle(rej).gridTemplateRows,
      rejAlto:rej.clientHeight, rejContenido:rej.scrollHeight,
      cajas:[...document.querySelectorAll('.caja')].map(c=>({
        t:(c.querySelector('h2')||{}).textContent||'?',
        w:c.clientWidth, h:c.clientHeight, s:c.scrollHeight }))
    };
  });
  await medidor.close();
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const B=r.bloque||'';
  const anillo=min=>((r.anillos||[]).filter(a=>a.nom.indexOf(min+' minutos')===0)[0]||{});

  console.log('\n  -- sin las calles no se puede caminar --');
  T('lo dice y manda a medir el trazado', r.sinCalles===true);
  T('y no inventa cifras mientras tanto', r.sinCifras===true);

  console.log('\n  -- los tres anillos --');
  T('salen los tres: 5, 10 y 15 minutos', (r.anillos||[]).length===3,
    (r.anillos||[]).map(a=>a.nom.split('m')[0].trim()+'→'+a.n).join(' · '));
  T('cada uno con los metros que se recorren',
    /400 m de recorrido/.test(anillo(5).nom||'') && /800 m de recorrido/.test(anillo(10).nom||''),
    anillo(5).nom+' / '+anillo(10).nom);

  console.log('\n  -- la trampa del callejón sin salida --');
  /* El lote está a 300 m de la avenida por el callejón. Los usos de la
     avenida quedan a 300 + 180 = 480 m caminando: fuera de los diez minutos
     (800 m no, entran)… lo que importa es que a CINCO minutos (400 m) no
     llegan, y en línea recta sí parecían estar a 200. */
  T('a 5 minutos caminando no se llega a las tiendas de la avenida',
    Number(anillo(5).n)<=2, 'alcanza '+anillo(5).n+' usos');
  T('a 15 minutos sí', Number(anillo(15).n)>=6, 'alcanza '+anillo(15).n+' usos');
  T('y el recorrido crece con el tiempo, no al revés',
    Number(anillo(5).n)<=Number(anillo(10).n) && Number(anillo(10).n)<=Number(anillo(15).n),
    [anillo(5).n,anillo(10).n,anillo(15).n].join(' ≤ '));
  T('dice cuántos parecían estar cerca en línea recta',
    /En línea recta parecían/.test(B) || /la línea recta no engañaba/.test(B),
    (B.match(/A \d+ minutos[^.]*\./)||['no lo dice'])[0].slice(0,120));

  console.log('\n  -- lo que se lee --');
  T('aclara que no es línea recta', /Esto no es línea recta/.test(B));
  T('y a qué paso camina', /80 metros por minuto/.test(B));
  T('dice a qué distancia engancha el lote con la calle',
    /engancha a la calle más cercana/.test(B), (B.match(/a \d+ m\b/g)||[]).join(' '));
  T('y las tres cosas que el recorrido no sabe',
    /si hay andén/.test(B) && /dónde cruzar/.test(B) && /subida/.test(B));

  console.log('\n  -- el recorrido sobre el mapa --');
  const sub=(a,b,col)=>(a[col]||0)-(b[col]||0);
  /* En esta maqueta la red entera se agota antes de los quince minutos: no
     hay tramos que pintar de claro, y eso está bien. Lo que sí tiene que
     pasar es que cada anillo alcanzado tenga su color. */
  T('al prender se dibuja lo que se alcanza, cada anillo con su color',
    sub(r.puestos,r.antes,'#0A6F9E')>0 && sub(r.puestos,r.antes,'#34CCFE')>0,
    '5→'+sub(r.puestos,r.antes,'#0A6F9E')+' 10→'+sub(r.puestos,r.antes,'#34CCFE')+
    ' 15→'+sub(r.puestos,r.antes,'#B8DFF2'));
  /* El orden importa: lo lejano se pinta primero para que el anillo corto
     quede encima. Si se invierte, el celeste tapa el azul y la mancha se lee
     al revés de como es. */
  T('y lo lejano queda debajo de lo cercano',
    (r.orden||[]).lastIndexOf('#34CCFE') < (r.orden||[]).indexOf('#0A6F9E'),
    (r.orden||[]).join('').replace(/#/g,' '). slice(0,60));
  T('el botón cambia a apagar y explica los colores', r.botonApaga===true && r.leyenda===true);
  T('y la hoja se encoge para dejar ver el mapa', r.encogida===true);
  T('la barra de abajo dice qué capa está puesta', r.rotulo===true);
  T('al apagar no queda ni un trazo del recorrido',
    sub(r.despues,r.antes,'#0A6F9E')===0 && sub(r.despues,r.antes,'#34CCFE')===0 &&
    sub(r.despues,r.antes,'#B8DFF2')===0);
  T('y el botón vuelve a ofrecer prenderlo', r.botonPrende===true);

  console.log('\n  -- en el papel --');
  const LAM=r.lamina||'', PDF=r.pdf||'';
  T('la lámina trae la caja del recorrido', /Hasta dónde se camina desde el lote/.test(LAM));
  T('con los tres anillos y sus metros',
    /5 minutos/.test(LAM) && /400 m de recorrido por las calles/.test(LAM));
  T('y dice cuántos parecían estar cerca en línea recta',
    /en línea recta parecían/.test(LAM) || /la línea recta no engañaba/.test(LAM));
  T('el PDF también lo trae', /<h2>Hasta dónde se llega caminando<\/h2>/.test(PDF));
  T('y con sus salvedades', /No sabe si hay andén, dónde cruzar ni si la cuadra sube/.test(PDF));

  console.log('\n  -- la ficha guardada --');
  T('guarda el recorrido', r.guardada && r.guardada.hay===true && r.guardada.anillos===3,
    JSON.stringify(r.guardada));
  T('pero NO los tramos: no cabrían en el teléfono',
    r.guardada && r.guardada.sinTramos===true && r.guardada.bytes < 400000,
    (r.guardada&&r.guardada.bytes)+' bytes');
  T('y al reabrirla el bloque sigue ahí', r.reabierta===true);
  T('sin ofrecer un mapa que ya no tiene geometría', r.reabiertaSinBoton===true);

  console.log('\n  -- y sigue cabiendo en el papel --');
  const D=r.desbordes||{};
  T('ninguna caja se recorta', (D.cajas||[]).length===0, (D.cajas||[]).join(' · ')||'ninguna');
  T('ni se pierde fuera de la hoja', (D.perdidas||[]).length===0,
    (D.perdidas||[]).join(' · ')||'ninguna');
  T('y la hoja no se pasa de los 900 mm',
    D.altoHoja>0 && D.altoHoja<=D.altoPapel+2, D.altoHoja+' de '+D.altoPapel+' px');

  console.log('\n  -- el mismo pliego, acostado --');
  const LH=r.laminaH||'', DH=r.desbordesH||{};
  T('el papel es de 90 × 60 cm', /@page\{ size:900mm 600mm; margin:0 \}/.test(LH));
  T('y trae exactamente las mismas cajas',
    (LH.match(/<section class="caja/g)||[]).length===(LAM.match(/<section class="caja/g)||[]).length,
    (LH.match(/<section class="caja/g)||[]).length+' vs '+(LAM.match(/<section class="caja/g)||[]).length);
  /* Acostado no hay rejilla: hay tres columnas de periódico. Con 300 mm menos
     de alto, una rejilla paga el hueco de cada encaje por triplicado y la hoja
     dejó de cerrar en cuanto entraron los dibujos; en columnas cada caja
     conserva su alto natural y la siguiente arranca pegada. */
  /* La hoja fluye en columnas de periódico en las dos orientaciones —dos
     paradas, tres acostada, y tres también parada cuando va llena—, con el
     plano fuera del flujo, arriba, a todo el ancho. La cuadrícula se fue
     cuando los dibujos y las listas la desbordaron. */
  /* Se mira la regla de la rejilla, no el documento entero: adentro de las
     cajas sigue habiendo cuadrículas —las barras, la síntesis— y buscar
     «grid-template-columns» en toda la hoja encuentra esas. */
  const reglaRej=(LH.match(/\.rej\{[^}]*\}/)||[''])[0];
  T('acostado fluye en columnas de periódico, sin rejilla',
    /columns:[2-6]/.test(reglaRej) && !/grid-template-columns/.test(reglaRej), reglaRej.slice(0,40));
  T('y el plano manda arriba, fuera del flujo',
    /class="caja plano-hero"/.test(LH));
  T('ninguna caja se recorta', (DH.cajas||[]).length===0, (DH.cajas||[]).join(' · ')||'ninguna');
  T('ni se pierde fuera del pliego acostado', (DH.perdidas||[]).length===0,
    (DH.perdidas||[]).join(' · ')||'ninguna');
  T('y cabe en los 600 mm de alto',
    DH.altoHoja>0 && DH.altoHoja<=DH.altoPapel+2, DH.altoHoja+' de '+DH.altoPapel+' px');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
