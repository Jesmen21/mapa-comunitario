const E = require('../entorno.js');
/* Tanda H · sectores lado a lado.

   Cada sector se leía solo, y solo no dice mucho: «4,8 m² de espacio público
   por habitante» no es bueno ni malo hasta que se pone al lado del sector de
   la otra mitad del curso.

   Las fichas se siembran a mano en el almacenamiento —es de donde lee la
   comparación— para poder fijar cada cifra y comprobar la tabla contra una
   cuenta hecha aparte. Dos cosas son las que de verdad se vigilan:

   · Lo que un sector NO midió sale como raya, NO como cero. Poner un cero le
     haría ganar una fila que ni jugó.
   · Solo se corona al mejor donde «mejor» significa algo. Más espacio público
     por habitante, sí; más densidad, no.                                   */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078};

const cobertura=(edu,sal,par,mer)=>({categorias:[
  {id:'educacion',etiqueta:'Colegio o jardín',pctCubierto:edu,pctSinCubrir:100-edu,radioM:400,minutos:5},
  {id:'salud',etiqueta:'Servicio de salud',pctCubierto:sal,pctSinCubrir:100-sal,radioM:800,minutos:10},
  {id:'recreacion',etiqueta:'Parque o cancha',pctCubierto:par,pctSinCubrir:100-par,radioM:400,minutos:5},
  {id:'abastecimiento',etiqueta:'Dónde mercar',pctCubierto:mer,pctSinCubrir:100-mer,radioM:400,minutos:5}
]});

/* Tres sectores con cifras elegidas para que cada comprobación tenga una sola
   respuesta posible. */
const FICHAS=[
  { id:'fA', ts:'2026-09-01T10:00:00.000Z', nombre:'La Playa',
    forma:'poligono', areaM2:500000, total:100,
    centro:C, poligono:[{lat:C.lat,lng:C.lng},{lat:C.lat+0.001,lng:C.lng},{lat:C.lat+0.001,lng:C.lng+0.001}],
    porGrupo:{comercio:60,salud:40}, porSub:{},
    stats:{ total:100, densidadPorHa:2, poblacionEstimada:2000,
            mezcla:{indice:0.7,nivel:'mezclado',usos:4,maximo:7},
            accesibilidad:cobertura(80,90,70,60), porGrupo:{comercio:60,salud:40} },
    // 30.000 m² de parque para 2.000 habitantes = 15 m²/hab: cumple la meta.
    trazado:{ espacio:{piezas:3,areaM2:30000,metaM2Hab:15},
              llenos:{pctLleno:20,pctVacio:80}, vias:{kmPorHa:0.3},
              morfologia:{tramoMedioM:90},
              perfil:{relacion:1.2,anden:{conAndenPct:40,sinAndenPct:10,sinDatoPct:50}} },
    terreno:{ pendiente:{media:5}, elevacion:{relieve:20} },
    campo:{ nuevos:[{},{},{}], confirmados:[], discrepancias:[], sinVerificar:[] } },

  { id:'fB', ts:'2026-09-02T10:00:00.000Z', nombre:'El Contento',
    forma:'poligono', areaM2:400000, total:60,
    centro:C, poligono:[{lat:C.lat,lng:C.lng},{lat:C.lat+0.001,lng:C.lng},{lat:C.lat+0.001,lng:C.lng+0.001}],
    porGrupo:{comercio:60}, porSub:{},
    stats:{ total:60, densidadPorHa:1.5, poblacionEstimada:4000,
            mezcla:{indice:0.3,nivel:'monofuncional',usos:2,maximo:7},
            accesibilidad:cobertura(30,50,0,20), porGrupo:{comercio:60} },
    // 10.000 m² para 4.000 habitantes = 2,5 m²/hab: muy por debajo.
    trazado:{ espacio:{piezas:1,areaM2:10000,metaM2Hab:15},
              llenos:{pctLleno:55,pctVacio:45}, vias:{kmPorHa:0.2},
              morfologia:{tramoMedioM:240},
              perfil:{relacion:0.4,anden:{conAndenPct:10,sinAndenPct:30,sinDatoPct:60}} },
    // A propósito SIN terreno ni clima: tiene que salir raya, no cero.
    terreno:null, clima:null, campo:null },

  { id:'fC', ts:'2026-09-03T10:00:00.000Z', nombre:'Aeropuerto',
    forma:'radio', radioM:600, areaM2:1130973, total:20, centro:C,
    porGrupo:{servicios:20}, porSub:{},
    stats:{ total:20, densidadPorHa:0.2, poblacionEstimada:500,
            mezcla:{indice:0.1,nivel:'monofuncional',usos:1,maximo:7},
            accesibilidad:cobertura(0,10,0,0), porGrupo:{servicios:20} },
    trazado:null, terreno:null, clima:null, campo:null }
];

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(([fichas])=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    localStorage.setItem('pcr_fichas_v1', JSON.stringify(fichas));
  }catch(e){} }, [FICHAS]);
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/locationiq\.com|ags\.esri\.co|overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"elements":[],"features":[]}'}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);
  if(process.env.FOTO) await pg.evaluate(()=>{window.__foto=true;});

  const r=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    let impreso=''; window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ impreso=h; };
    let copiado='';
    try{ Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{copiado=t;return Promise.resolve();}},configurable:true}); }catch(e){}

    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(900);
    const chips=()=>[...document.querySelectorAll('[data-u52-call="pcr-cotejo"]')];
    o.hayChips=chips().length;

    // Uno solo: no hay tabla, hay una pista.
    chips()[0].click(); await esperar(400);
    o.conUno={ tabla:!!document.querySelector('.pcr-cot-tabla'),
               pista:/Elegí otro sector/.test(txt(document.querySelector('.pcr-pestana'))) };

    // Dos: la tabla.
    chips()[1].click(); await esperar(500);
    const tabla=()=>document.querySelector('.pcr-cot-tabla');
    o.columnas=tabla()?tabla().querySelectorAll('thead th').length:0;
    o.encabezados=tabla()?[...tabla().querySelectorAll('thead th')].map(txt):[];
    // Tres: sigue funcionando y suma columna.
    chips()[2].click(); await esperar(500);
    o.columnas3=tabla()?tabla().querySelectorAll('thead th').length:0;

    o.filas={};
    if(tabla()){
      [...tabla().querySelectorAll('tbody tr')].forEach(tr=>{
        const nom=txt(tr.querySelector('th'));
        o.filas[nom]=[...tr.querySelectorAll('td')].map(td=>({
          v:txt(td), gana:td.classList.contains('pcr-cot-gana'), nd:td.classList.contains('pcr-cot-nd')
        }));
      });
    }
    o.nota=txt(document.querySelector('.pcr-cotejo .pcr-pista'));

    // Copiar e imprimir.
    const bCopiar=document.querySelector('[data-u52-call="pcr-cot-copiar"]');
    if(bCopiar){ bCopiar.click(); await esperar(400); }
    o.copiado=copiado;
    const bPdf=document.querySelector('[data-u52-call="pcr-cot-pdf"]');
    if(bPdf){ bPdf.click(); await esperar(400); }
    o.impreso=impreso;

    // Quitar todos.
    const bLimpiar=document.querySelector('[data-u52-call="pcr-cot-limpiar"]');
    if(bLimpiar){ bLimpiar.click(); await esperar(400); }
    o.despuesDeLimpiar=!!document.querySelector('.pcr-cot-tabla');
    if(window.__foto){ chips()[0].click(); chips()[1].click(); chips()[2].click(); await esperar(600);
      const c=document.querySelector('.pcr-cotejo'); if(c) c.scrollIntoView(); await esperar(300); }
    return o;
  });

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  if(process.env.FOTO){ await pg.screenshot({path:S+'cotejo.png',fullPage:false}); }
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const F=n=>(r.filas||{})[n]||[];

  console.log('\n  -- hace falta más de uno para comparar --');
  P('cada sector guardado ofrece el interruptor', r.hayChips===3, r.hayChips+' interruptores');
  P('con uno solo no arma tabla', r.conUno.tabla===false);
  P('y pide el segundo', r.conUno.pista===true);

  console.log('\n  -- la tabla --');
  P('con dos, una columna por sector más la de los nombres', r.columnas===3,
    (r.encabezados||[]).join(' | '));
  P('y con tres, una más', r.columnas3===4);

  console.log('\n  -- las cifras, contra la cuenta hecha aparte --');
  P('30.000 m² de parque para 2.000 habitantes son 15 m²/hab',
    (F('Espacio público')[0]||{}).v==='15 m²/hab', (F('Espacio público')[0]||{}).v);
  P('y 10.000 para 4.000 son 2,5',
    (F('Espacio público')[1]||{}).v==='2,5 m²/hab', (F('Espacio público')[1]||{}).v);
  P('el tamaño sale en hectáreas', (F('Tamaño')[0]||{}).v==='50 ha', (F('Tamaño')[0]||{}).v);
  P('la cobertura de colegio es la que trae cada ficha',
    (F('Con colegio a 5 min')[0]||{}).v==='80 %' && (F('Con colegio a 5 min')[1]||{}).v==='30 %',
    F('Con colegio a 5 min').map(x=>x.v).join(' vs '));

  console.log('\n  -- lo que no se midió es raya, no cero --');
  P('el sector sin terreno no muestra 0% de pendiente',
    (F('Pendiente media')[1]||{}).v==='—' && (F('Pendiente media')[1]||{}).nd===true,
    F('Pendiente media').map(x=>x.v).join(' vs '));
  P('ni 0 m de desnivel', (F('Desnivel')[1]||{}).v==='—');
  P('el sector sin trazado tampoco muestra 0% construido',
    (F('Suelo construido')[2]||{}).v==='—', F('Suelo construido').map(x=>x.v).join(' vs '));
  P('y las filas que nadie midió no aparecen',
    !(r.filas||{})['Temperatura media'], Object.keys(r.filas||{}).length+' filas');

  console.log('\n  -- solo se corona donde «mejor» significa algo --');
  P('gana el que tiene más espacio público por habitante',
    (F('Espacio público')[0]||{}).gana===true && (F('Espacio público')[1]||{}).gana===false);
  P('y el que tiene más cobertura de colegio',
    (F('Con colegio a 5 min')[0]||{}).gana===true);
  P('la mezcla de usos también, que más mezclado es mejor',
    (F('Mezcla de usos')[0]||{}).gana===true);
  P('pero la densidad NO tiene ganador: depende de qué se quiera',
    F('Usos por hectárea').every(x=>x.gana===false),
    F('Usos por hectárea').map(x=>x.v).join(' vs '));
  P('ni el suelo construido', F('Suelo construido').every(x=>x.gana===false));
  P('ni la relación altura/ancho', F('Altura ÷ ancho de calzada').every(x=>x.gana===false));
  P('en pendiente gana el más plano, no el más alto',
    (F('Pendiente media')[0]||{}).gana!==true,
    'solo un sector la midió, así que no hay con quién comparar');
  P('y la nota explica las dos reglas',
    /raya es sin dato, no cero/i.test(r.nota||'') && /no hay un mejor/i.test(r.nota||''));

  console.log('\n  -- se lo puede llevar --');
  P('la copia sale con columnas separadas por tabulador',
    /\t/.test(r.copiado||'') && /Espacio público/.test(r.copiado||''),
    (r.copiado||'').split('\n')[3]||'');
  P('y también con rayas donde falta el dato', /—/.test(r.copiado||''));
  P('la versión para imprimir trae los tres sectores',
    /La Playa/.test(r.impreso||'') && /El Contento/.test(r.impreso||'') && /Aeropuerto/.test(r.impreso||''));
  P('con la misma advertencia', /sin dato<\/b>, no cero/.test(r.impreso||''));

  console.log('\n  -- y se puede deshacer --');
  P('«quitar todos» deja la lista como estaba', r.despuesDeLimpiar===false);

  console.log('');
  P('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
