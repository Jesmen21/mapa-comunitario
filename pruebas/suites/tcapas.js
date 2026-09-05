const E = require('../entorno.js');
/* Tanda R · el panel de capas.

   Cada capa nació al lado del bloque que la explica —las curvas en «El
   terreno», las sombras en «El lote»— y eso está bien para entenderla. Pero
   con diez encendidas a la vez, apagar una obligaba a recorrer la ficha
   entera buscando dónde estaba su botón.

   Esta prueba comprueba el panel que las reúne: que estén todas, que las que
   todavía no se pueden encender salgan en gris diciendo qué falta, que
   encender y apagar desde ahí mueva de verdad el mapa, y que «encender todo»
   no pinte diez manchas de calor superpuestas, que es lo mismo que no pintar
   nada.

   La maqueta trae trazado, terreno, lote y una torre vecina, así que llegan a
   estar disponibles casi todas.                                            */
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

    /* ── El panel de capas.
       Por `[data-pcr="capa"]` y no por la clase: «Armar el pliego» usa los
       mismos interruptores para elegir qué va al papel, y buscarlos por
       `.pcr-capa` traía los dos panales revueltos. */
    const capas=()=>[...H().querySelectorAll('.pcr-capa[data-pcr="capa"]')].map(b=>({
      id:b.getAttribute('data-c'),
      nombre:((b.querySelector('b')||{}).textContent||'').trim(),
      pie:((b.querySelector('small')||{}).textContent||'').trim(),
      on:b.classList.contains('on'), gris:b.classList.contains('pcr-capa-gris'),
      color:((b.querySelector('i')||{}).style||{}).background||''
    }));
    o.capas=capas();
    o.intro=trozo('Las capas del mapa',260);

    // Cuántas formas hay puestas en el mapa antes de tocar nada.
    const formas=()=>document.querySelectorAll('.leaflet-overlay-pane path').length;
    o.antes=formas();

    // ── Encender una a mano: las curvas.
    const tocar=async id=>{
      const b=H().querySelector('[data-pcr="capa"][data-c="'+id+'"]');
      if(!b) return false;
      b.click(); await esperar(700);
      const asa=H().querySelector('[data-pcr="agrandar"]');
      if(asa){ asa.click(); await esperar(400); }
      return true;
    };
    o.tocoCurvas=await tocar('curvas');
    o.trasCurvas={ formas:formas(), on:(capas().filter(c=>c.id==='curvas')[0]||{}).on };
    await tocar('curvas');
    o.trasApagar={ formas:formas(), on:(capas().filter(c=>c.id==='curvas')[0]||{}).on };

    // ── Encender todo y apagar todo.
    H().querySelector('[data-pcr="capas-todo"]').click(); await esperar(1200);
    const asa2=H().querySelector('[data-pcr="agrandar"]');
    if(asa2){ asa2.click(); await esperar(500); }
    o.todo={ formas:formas(), capas:capas().filter(c=>c.on).map(c=>c.id) };
    H().querySelector('[data-pcr="capas-nada"]').click(); await esperar(1000);
    const asa3=H().querySelector('[data-pcr="agrandar"]');
    if(asa3){ asa3.click(); await esperar(500); }
    o.nada={ formas:formas(), capas:capas().filter(c=>c.on).map(c=>c.id) };

    /* ── El atajo de «todo», abajo, junto a lo que se exporta ───────────
       Se pidió después de usar la ficha entera de verdad: «uno baja y baja
       y hay tantas cosas por bajar; sería bueno dejar abajo un resumen de
       activar todo y desactivar todo, que todo lo que sea activar y
       desactivar esté abajo, lo último, junto lo del PDF y cosas así».

       Así que no basta con que el atajo exista en alguna parte: se comprueba
       DÓNDE está —después del panel de capas, junto a los botones de la
       lámina— y que diga cuánto llevás puesto, que es el «resumen». Y que
       toque de verdad: dos sitios que hacen lo mismo tienen que hacerlo
       igual, no parecerse. */
    const SIGUE = 4;   // Node.DOCUMENT_POSITION_FOLLOWING
    const sigue = (a, b) => !!(a && b) && !!(a.compareDocumentPosition(b) & SIGUE);
    const filas = () => [...H().querySelectorAll('.pcr-todo-fila')];
    const resumen = () => filas().map(f =>
      ((f.querySelector('.pcr-todo-t') || {}).textContent || '').replace(/\s+/g, ' ').trim());
    // El primero de cada uno es el del panel de arriba, que es el de siempre.
    const panelTodo = H().querySelector('[data-pcr="capas-todo"]');
    const laminaPDF = H().querySelector('[data-pcr="lamina-h"], [data-pcr="lamina-ver-h"]');
    o.abajo = {
      filas: resumen(),
      acciones: filas().map(f =>
        [...f.querySelectorAll('button')].map(b => b.getAttribute('data-pcr')).join('+')),
      trasElPanel: sigue(panelTodo, filas()[0] || null),
      juntoALaLamina: sigue(laminaPDF, filas()[0] || null),
      // Y antes de «Llevarlo a otro programa», que es lo último de exportar.
      antesDeExportar: sigue(filas()[filas().length - 1] || null,
        H().querySelector('[data-pcr="exp"]')),
      conNada: resumen()[0] || ''
    };
    /* Tocar el de ABAJO, no el de arriba: es el que se acaba de añadir y el
       que podría estar puesto sin cablear. */
    const botonAbajo = (filas()[0] || document.createElement('i'))
      .querySelector('[data-pcr="capas-todo"]');
    o.abajo.hayBoton = !!botonAbajo;
    if (botonAbajo) { botonAbajo.click(); await esperar(1200); }
    const asa4 = H().querySelector('[data-pcr="agrandar"]');
    if (asa4) { asa4.click(); await esperar(500); }
    o.abajo.encendidas = capas().filter(c => c.on).length;
    o.abajo.conTodo = resumen()[0] || '';
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
  const capas=r.capas||[];
  const capa=id=>capas.filter(c=>c.id===id)[0];

  console.log('\n  -- están todas, en un solo sitio --');
  T('el panel sale con las capas', capas.length>=8, capas.length+' capas');
  T('y dice cuántas hay y cuántas están puestas',
    /capas? disponibles?|capa disponible/.test(r.intro) && /puestas?\b/.test(r.intro),
    r.intro.slice(0,120));
  ['calor:todos','cobertura','estratos','llenos','curvas','sombras','caminata'].forEach(id=>{
    T('está «'+id+'»', !!capa(id), capa(id)?capa(id).nombre:'no está');
  });
  T('el calor se abre por categoría', capas.filter(c=>/^calor:g:/.test(c.id)).length>=1,
    capas.filter(c=>/^calor:g:/.test(c.id)).map(c=>c.nombre).join(' · ')||'ninguna');
  T('cada una lleva el color con el que se dibuja',
    capas.every(c=>/rgb|#/.test(c.color)), (capas[0]||{}).color);

  console.log('\n  -- las que no se pueden encender lo dicen --');
  const grises=capas.filter(c=>c.gris);
  T('la cobertura está gris, que no se midió', !!capa('cobertura') && capa('cobertura').gris,
    capa('cobertura')?capa('cobertura').pie:'');
  T('y dice qué falta para encenderla', grises.every(c=>/medí|marcá|analizá/.test(c.pie)),
    grises.map(c=>c.pie).join(' · ')||'ninguna gris');
  T('las que sí están medidas no están grises',
    !!capa('curvas') && !capa('curvas').gris && !!capa('llenos') && !capa('llenos').gris);

  console.log('\n  -- encender y apagar mueve el mapa de verdad --');
  T('se enciende desde el panel', r.tocoCurvas===true && r.trasCurvas.on===true);
  T('y el mapa se llena', r.trasCurvas.formas>r.antes,
    r.antes+' → '+r.trasCurvas.formas+' formas');
  T('se apaga desde el mismo sitio', r.trasApagar.on===false);
  T('y el mapa vuelve a como estaba', r.trasApagar.formas<=r.antes,
    r.trasApagar.formas+' formas');

  console.log('\n  -- encender todo, sin volverlo ilegible --');
  T('enciende varias de una vez', (r.todo.capas||[]).length>=4,
    (r.todo.capas||[]).join(' · '));
  /* Diez categorías de calor encendidas a la vez son diez manchas encimadas:
     el «todo» pone el calor general y ninguna categoría suelta. */
  T('pero del calor pone solo el general',
    (r.todo.capas||[]).indexOf('calor:todos')>=0 &&
    !(r.todo.capas||[]).some(id=>/^calor:g:/.test(id)),
    (r.todo.capas||[]).filter(id=>/^calor/.test(id)).join(' · ')||'ninguna');
  T('y apagar todo no deja nada puesto', (r.nada.capas||[]).length===0,
    (r.nada.capas||[]).join(' · ')||'ninguna');

  console.log('\n  -- y el mismo atajo abajo, junto a lo del pliego --');
  const A = r.abajo || {};
  T('hay un resumen de «todo» al final de la ficha', (A.filas || []).length >= 1,
    (A.filas || []).join(' · ') || 'no hay ninguno');
  T('trae las capas del mapa y las cajas del pliego',
    (A.acciones || []).join(' ').indexOf('capas-todo+capas-nada') >= 0 &&
    (A.acciones || []).join(' ').indexOf('pliego-todo+pliego-nada') >= 0,
    (A.acciones || []).join(' · ') || 'ninguna');
  T('está después del panel de capas, no repetido arriba', A.trasElPanel === true);
  T('y junto a los botones de la lámina, como se pidió', A.juntoALaLamina === true);
  T('antes de «Llevarlo a otro programa»', A.antesDeExportar === true);

  /* El «resumen» de la petición: no dos botones sueltos, sino cuánto llevás
     puesto de cada cosa. Si no cambia al encender todo, no es un resumen. */
  T('dice cuántas están puestas, no solo ofrece los botones',
    /(?:^|\s)0 de \d+/.test(A.conNada || ''), A.conNada || '(no dice nada)');
  T('y la cuenta cambia cuando se enciende todo desde abajo',
    !!A.conTodo && A.conTodo !== A.conNada && !/(?:^|\s)0 de \d+/.test(A.conTodo),
    (A.conNada || '?') + '  →  ' + (A.conTodo || '?'));
  T('el botón de abajo enciende de verdad, no es un adorno',
    A.hayBoton === true && A.encendidas >= 4, (A.encendidas || 0) + ' capas puestas');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
