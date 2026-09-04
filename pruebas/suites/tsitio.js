const E = require('../entorno.js');
/* Tanda Q · qué le pide el sitio al proyecto.

   El análisis describe el lugar; esto es el paso que un curso de proyectos
   necesita: pasar de «el terreno baja al suroccidente» a «el agua entra por
   ahí y el proyecto tiene que decir qué hace con ella».

   La maqueta es la misma de las curvas y las sombras, y por eso se sabe qué
   tiene que salir:

     · rampa que sube al oriente        → el agua baja al occidente
     · torre de 10 pisos al occidente   → sombra sobre el lote por la tarde
     · lote con su lado corto al poniente → fachada crítica de la tarde
     · una sola calle con nombre        → un frente, no esquinero
     · ningún colegio ni parque cerca   → lo que el barrio no tiene

   Y lo que NO puede pasar: que ninguna determinante diga qué construir. Eso
   se comprueba palabra por palabra, porque es la línea que separa una
   herramienta de análisis de una que le hace la tarea al estudiante.       */
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
  // Una calle pegada al lote: sin frente no hay determinante de acceso, y sin
  // acceso la lectura de proyecto se queda coja justo donde más importa.
  via('Calle 7','residential',[P(-30,-300),P(-30,0),P(-30,300)]),
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
    const trozo=(desde,largo)=>{ const t=txt(); const i=t.indexOf(desde); return i<0?'':t.slice(i,i+largo); };

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

    // ── Las determinantes.
    o.deter=trozo('Qué le pide el sitio al proyecto',3200);
    o.items=[...H().querySelectorAll('.pcr-deter-item')].map(el=>({
      titulo:((el.querySelector('.pcr-deter-cab b')||{}).textContent||'').trim(),
      dice:((el.querySelector('.pcr-deter-dice')||{}).textContent||'').trim(),
      porque:((el.querySelector('.pcr-deter-porque')||{}).textContent||'').trim(),
      icono:!!el.querySelector('.pcr-deter-cab svg')
    }));

    // ── Y en el papel.
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La rampa del oriente';
    H().querySelector('[data-pcr="lamina"]').click(); await esperar(700);
    o.lamina=capturado; capturado='';
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(700);
    o.pdf=capturado; capturado='';
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
  const item=q=>items.filter(x=>new RegExp(q,'i').test(x.titulo))[0];

  console.log('\n  -- la lectura de proyecto --');
  T('sale el bloque', items.length>=3, items.length+' determinantes');
  T('y aclara que son condiciones, no propuestas',
    /condiciones que el sitio impone/.test(r.deter));
  T('cada una dice de dónde sale', items.every(x=>/^Sale /.test(x.porque)),
    (items[0]||{}).porque||'');
  T('y lleva su icono', items.every(x=>x.icono));

  console.log('\n  -- lo que esta maqueta tiene que decir --');
  T('la fachada de la tarde, que en el trópico es la que se calienta',
    !!item('fachada de la tarde') && /occidente/.test(item('fachada de la tarde').dice),
    (item('fachada de la tarde')||{}).dice||'no está');
  T('la sombra de la torre del occidente',
    !!item('sombra') && /%/.test(item('sombra').dice),
    (item('sombra')||{}).titulo||'no está');
  /* La rampa sube al oriente: el agua baja al occidente. Si la determinante
     dijera «oriente» estaría mandando el drenaje cuesta arriba. */
  T('el agua, hacia donde de verdad baja',
    !!item('agua') && /occidente/.test(item('agua').titulo+item('agua').dice) &&
    !/hacia el oriente/.test((item('agua')||{}).dice||''),
    (item('agua')||{}).titulo||'no está');
  T('el acceso, con la calle que existe',
    !!item('frente|acceso') && /Calle 7|Avenida 3/.test(item('frente|acceso').dice),
    (item('frente|acceso')||{}).titulo||'no está');
  T('y lo que el barrio no tiene cerca',
    !!item('no tiene cerca') && /colegio|parque/i.test(item('no tiene cerca').dice),
    (item('no tiene cerca')||{}).dice.slice(0,80)||'no está');

  console.log('\n  -- la línea que no se cruza --');
  /* Ninguna determinante puede decir QUÉ construir. Es la diferencia entre
     una herramienta que ayuda a proyectar y una que proyecta por vos. */
  const todo=items.map(x=>x.titulo+' '+x.dice).join(' ');
  T('ninguna manda construir nada',
    !/deb[eé]s? (poner|construir|hacer|levantar)|se debe construir|proponemos|recomendamos/i.test(todo),
    (todo.match(/deb[eé]s? \w+|proponemos|recomendamos/i)||['limpio'])[0]);
  T('y el bloque lo dice con todas las letras',
    /Ninguna de estas dice.*qué.*construir/i.test(r.deter) ||
    /la respuesta es el proyecto/i.test(r.deter));

  console.log('\n  -- y viaja al papel --');
  T('la lámina trae su caja', /Qué le pide el sitio al proyecto/.test(r.lamina||''));
  T('el PDF también', /Qué le pide el sitio al proyecto/.test(r.pdf||''));
  T('con la misma advertencia',
    /no dice qué construir|Determinantes, no propuestas/i.test((r.lamina||'')+(r.pdf||'')));
  T('ninguna caja se recorta', (r.medida.cajas||[]).length===0,
    (r.medida.cajas||[]).join(' · ')||'ninguna');
  T('ni se pierde fuera de la hoja', (r.medida.perdidas||[]).length===0,
    (r.medida.perdidas||[]).join(' · ')||'ninguna');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
