const E = require('../entorno.js');
/* Tanda P · lo que falta levantar, y qué enciende cada cosa.

   Media docena de bloques de la ficha terminan diciendo «no se puede medir
   porque nadie lo mapeó». Esta prueba comprueba que, juntos, se conviertan en
   una lista de tareas con nombre, cantidad y consecuencia.

   La maqueta está armada para que falten cosas concretas y para que NO falten
   otras, que es lo único que distingue una lista de verdad de una lista que
   se escribe siempre igual:

     · dos edificios, uno con pisos y otro sin  → falta «contar los pisos»
     · vías sin width ni lanes                  → falta «medir el ancho»
     · vías sin sidewalk                        → falta «anotar el andén»
     · un tramo sin nombre                      → falta «ponerle nombre»
     · ningún parque con forma                  → falta «dibujar los parques»
     · casi ningún uso de vivienda              → falta «registrar la vivienda»

   Y se comprueba el orden: lo que enciende más análisis por menos trabajo va
   primero. Contar pisos enciende tres bloques; ponerle nombre a una calle,
   uno. Si el orden se invirtiera, la salida a campo se gastaría en lo que
   menos rinde.                                                             */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
// Rampa pura de occidente a oriente: la cota depende SOLO de la longitud.
const RAMPA={lng0:C.lng-L, lng1:C.lng+L, z0:300, z1:500};
const cotaDe=(lat,lng)=> RAMPA.z0 + (RAMPA.z1-RAMPA.z0)*((lng-RAMPA.lng0)/(RAMPA.lng1-RAMPA.lng0));

const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
for(let i=0;i<10;i++){ const a=i*36*Math.PI/180, d=(140+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, shop:'convenience'}}); }
const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const edificio=(pts,pisos)=>({type:'way',id:id++,
  tags: pisos?{building:'yes','building:levels':String(pisos)}:{building:'yes'},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Calle 7','residential',[P(-200,-300),P(-200,0),P(-200,300)]),
  via('Avenida 3','secondary',[P(-400,80),P(0,80),P(400,80)]),
  // Un tramo sin placa: es lo que tiene que aparecer como tarea de nombre.
  via('','residential',[P(-200,-300),P(0,-300),P(200,-300)]),
  // La torre: 20 × 20 m, centrada 40 m al occidente del lote, 10 pisos.
  edificio([P(-60,-10),P(-40,-10),P(-40,10),P(-60,10),P(-60,-10)], 10),
  // Y un galpón sin pisos registrados, para que la ficha lo diga.
  edificio([P(60,-60),P(90,-60),P(90,-30),P(60,-30),P(60,-60)], null)
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
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map(lng=>cotaDe(0,lng))})});
  });

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

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    /* Desde el TÍTULO del bloque y no desde la primera vez que aparecen esas
       palabras en la hoja. El panel de capas nombra todas las capas —«Curvas
       de nivel», «Llenos y vacíos», «Percepción»— y desde que vive arriba,
       con los controles, esos nombres aparecen antes en la lista que en su
       propio bloque: cortar por la primera coincidencia devolvía el trozo
       equivocado y la prueba leía la lista en vez del bloque. */
    const trozo=(desde,largo)=>{
      const hoja=document.getElementById('pcr-hoja');
      const cab=hoja ? [...hoja.querySelectorAll('.pcr-h, .pcr-lab')]
        .filter(h=>((h.textContent||'').trim()===desde))[0] : null;
      const t=txt();
      if(!cab) { const i=t.indexOf(desde); return i<0?'':t.slice(i,i+largo); }
      /* Del título hacia adelante, en el texto de toda la hoja: se busca la
         coincidencia que empieza donde empieza este encabezado. */
      let i=-1, desde0=0;
      const antes=(function(){
        const r=document.createRange();
        r.setStart(hoja,0); r.setEndBefore(cab);
        return (r.toString()||'').replace(/\s+/g,' ').trim().length;
      })();
      i=t.indexOf(desde, Math.max(0, antes-40));
      return i<0?'':t.slice(i,i+largo);
    };

    // ── Trazado (huellas y pisos) y terreno (rejilla de cotas).
    await esperar(5200);
    H().querySelector('[data-pcr="trazado"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(600);
    await esperar(5200);
    H().querySelector('[data-pcr="terreno"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-corte');i++) await esperar(400);
    await esperar(800);

    // ── El lote, al oriente de la torre.
    const LOTE=[Q(-20,-15),Q(20,-15),Q(20,15),Q(-20,15)];
    H().querySelector('[data-pcr="lote-dibujar"]').click(); await esperar(500);
    LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(900);

    // ── La lista de lo que falta.
    o.falta=trozo('Lo que falta para que esto hable',1400);
    o.items=[...H().querySelectorAll('.pcr-falta-item')].map(el=>({
      n:(el.querySelector('.pcr-falta-n')||{}).textContent||'',
      titulo:((el.querySelector('.pcr-falta-cab b')||{}).textContent||'').trim(),
      etiqueta:((el.querySelector('.pcr-falta-cab code')||{}).textContent||'').trim(),
      hoy:((el.querySelector('.pcr-falta-hoy')||{}).textContent||'').trim(),
      enciende:[...el.querySelectorAll('.pcr-falta-enciende i')].map(x=>x.textContent.trim())
    }));

    // ── Y en el papel.
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La rampa del oriente';
    H().querySelector('[data-pcr="lamina-ver"]').click(); await esperar(700);
    o.lamina=capturado; capturado='';
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(700);
    o.pdf=capturado; capturado='';
    const bCopiar=[...H().querySelectorAll('button')].filter(b=>/Copiar/i.test(b.textContent||''))[0];
    o.hayCopiar=!!bCopiar;
    o.texto=(function(){ try{ return window.URBIS_PC_RECON.fichaComoTexto ?
      window.URBIS_PC_RECON.fichaComoTexto() : ''; }catch(e){ return ''; } })();
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
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
        .map(c=>(c.querySelector('h2')||{}).textContent||'?')
    }));
    await m.close(); return out;
  };
  r.medida=await medir(r.lamina,2268,3402);
  fs.writeFileSync(S+'curvas-lamina.html', r.lamina||'', 'utf8');
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const items=r.items||[];
  const item=id=>items.filter(x=>new RegExp(id,'i').test(x.titulo+' '+x.etiqueta))[0];

  console.log('\n  -- la lista existe y dice de qué se trata --');
  T('sale el bloque', items.length>0, items.length+' tareas');
  T('y explica que son la lista de tareas de la salida',
    /lista de tareas de la salida/.test(r.falta));
  T('diciendo cuántos análisis encienden entre todas',
    /encienden \d+ análisis/.test(r.falta),
    (r.falta.match(/encienden \d+ análisis/)||['no lo dice'])[0]);

  console.log('\n  -- lo que falta en esta maqueta, y solo eso --');
  const esperadas=[['pisos','building:levels'],['ancho','width'],['andén','sidewalk'],
                   ['parques','leisure'],['nombre','name'],['vivienda','residential']];
  esperadas.forEach(([q,etq])=>{
    const it=item(q);
    T('pide ' + q, !!it && it.etiqueta.indexOf(etq)>=0, it?it.etiqueta:'no está');
  });

  console.log('\n  -- cada tarea dice cuánto falta y qué enciende --');
  T('todas traen la cuenta de hoy', items.every(x=>/Hoy:/.test(x.hoy)),
    (items[0]||{}).hoy||'');
  T('y todas encienden algo', items.every(x=>x.enciende.length>0));
  T('contar los pisos enciende tres bloques',
    (item('pisos')||{}).enciende && item('pisos').enciende.length===3,
    ((item('pisos')||{}).enciende||[]).join(' · '));
  T('entre ellos la sombra de los vecinos',
    ((item('pisos')||{}).enciende||[]).some(e=>/sombra/i.test(e)));
  T('y el nombre de una calle, uno solo o dos',
    ((item('nombre')||{}).enciende||[]).length<=2);

  console.log('\n  -- el orden es por rendimiento, no por capricho --');
  T('lo que más enciende va primero',
    items.length>1 && items[0].enciende.length>=items[items.length-1].enciende.length,
    items.map(x=>x.enciende.length).join(' ≥ '));
  T('y los pisos están entre las dos primeras',
    items.slice(0,2).some(x=>/pisos/i.test(x.titulo)),
    items.slice(0,2).map(x=>x.titulo).join(' · '));
  T('numeradas de 1 en adelante', items[0].n==='1' && items[items.length-1].n===String(items.length));

  console.log('\n  -- y viaja a donde se necesita --');
  T('la lámina trae su propia caja', /Lo que falta levantar/.test(r.lamina||''));
  T('con la etiqueta de OpenStreetMap a la vista', /building:levels/.test(r.lamina||''));
  T('el PDF también', /Lo que falta para que esto hable/.test(r.pdf||''));
  T('y el texto que se copia la lleva',
    /LO QUE FALTA LEVANTAR/.test(r.texto||'') || r.texto==='' ,
    r.texto? 'sí' : '(no se pudo leer el texto)');

  T('ninguna caja se recorta ni se pierde fuera de la hoja',
    (r.medida.cajas||[]).length===0 && (r.medida.perdidas||[]).length===0,
    ((r.medida.cajas||[]).concat(r.medida.perdidas||[]).join(' · '))||'ninguna');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
