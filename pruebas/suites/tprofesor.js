const E = require('../entorno.js');
/* Tanda I · la vista del curso.

   El profesor tiene treinta teléfonos levantando datos y ninguna forma de ver
   el conjunto: sabe lo que le cuentan, no lo que hay.

   Los puntos se arman DENTRO de la página, calculando las posiciones del
   registro con las mismas constantes que usa la app —el número de usos y
   URBIS_SLOTS—, no copiando un número aquí. La descripción es una cadena con
   posiciones fijas y el día que se agregue un uso más, todas las posiciones se
   corren: una prueba con el índice escrito a mano diría que todo está bien
   mientras la app lee el campo equivocado.

   El padrón está armado para que cada cuenta tenga una sola respuesta:
   · Ana 3 puntos, Luis 2, Sofía 1.
   · De los cuatro edificios, uno tiene la ficha completa, uno tiene «No se
     sabe» en la época —que NO es una observación— y dos están en blanco.
   · Un sector guardado con puntos dentro y otro sin tocar.                */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;

// Dos sectores guardados: uno encima de los puntos y otro a un kilómetro.
const FICHAS=[
  { id:'fCerca', ts:'2026-09-01T10:00:00.000Z', nombre:'La Playa', forma:'poligono',
    areaM2:500000, total:40, centro:C,
    poligono:[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},
              {lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}],
    porGrupo:{}, porSub:{}, stats:{total:40,densidadPorHa:1} },
  { id:'fLejos', ts:'2026-09-02T10:00:00.000Z', nombre:'El Contento', forma:'radio',
    radioM:300, areaM2:282743, total:12, centro:{lat:C.lat+0.02,lng:C.lng+0.02},
    porGrupo:{}, porSub:{}, stats:{total:12,densidadPorHa:0.4} }
];

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});

  async function ver(comoProfesor){
    const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
      viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await ctx.addInitScript(([fichas,prof])=>{
      /* Solo en el marco principal: ver la nota en las demás suites. La
       aplicación crea un marco escondido para medir la lámina, y sin esta
       guarda ese marco vuelve a ejecutar esto a mitad de la prueba. */
    if (window.top !== window) return;
    try{
      localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
      localStorage.setItem('urbis_auth_session_v1',JSON.stringify(prof
        ? {usuario:'profe',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}
        : {usuario:'estudiante',rol:'ciudadano',es_admin:false,session_token:'t',active:true,verified:true}));
      localStorage.setItem('pcr_fichas_v1', JSON.stringify(fichas));
    }catch(e){} }, [FICHAS, !!comoProfesor]);
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
    // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

    const o=await pg.evaluate(async (C)=>{
      const out={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
      const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();

      /* Las posiciones se calculan con las constantes de la app: si mañana se
         agrega un uso, la prueba se corre sola con ella. */
      const NUSOS=window.URBIS_EDIFICIO.todosLosUsos().length;
      const BASE=6+NUSOS, TL=8, SL=window.URBIS_SLOTS;
      const largo=Math.max(SL.victimas, BASE+TL)+2;
      function punto(uso, autor, dias, ficha){
        const d=new Array(largo).fill('');
        d[0]=uso;                                    // la cabeza de la etiqueta
        d[BASE+2]=autor;
        d[BASE+3]='ciudadano';
        d[BASE+TL]=new Date(Date.now()-dias*86400000).toISOString();
        if(ficha){
          if(ficha.mat!=null)   d[SL.edificioMaterialidad]=ficha.mat;
          if(ficha.pisos!=null) d[SL.edificioPisos]=String(ficha.pisos);
          if(ficha.epoca!=null) d[SL.edificioEpoca]=ficha.epoca;
        }
        return d.join(' | ');
      }
      const P=(uso,autor,dias,ficha,dx,dy,tipo)=>({
        tipo: tipo||'Vivienda y Residencial',
        lat: C.lat+(dy||0), lng: C.lng+(dx||0),
        descripcion: punto(uso,autor,dias,ficha)
      });

      const COMPLETA={mat:'Bahareque o tapia pisada', pisos:2, epoca:'Anterior a 1950'};
      // «No se sabe» está en el vocabulario pero NO es una observación.
      const A_MEDIAS={mat:'Concreto reforzado (pórticos o muros)', pisos:3, epoca:'No se sabe'};

      const puntos=[
        P('Residencial','Ana Torres',0,COMPLETA, 0.0005, 0.0005),
        P('Residencial','Ana Torres',1,A_MEDIAS, 0.0007, 0.0005),
        P('Comercial','Ana Torres',2,null,       0.0009, 0.0005),
        P('Comercial','Luis Pérez',3,null,       0.0011, 0.0005),
        // Un punto que NO es edificio: no se le puede exigir ficha.
        P('Mobiliario Urbano','Luis Pérez',40,null, 0.0013, 0.0005, 'Mobiliario Urbano'),
        P('Educativo (Básico/Superior)','Sofía Rojas',45,null, 0.0015, 0.0005)
      ];
      window.urbisDatosVisibles=function(){ return puntos; };

      if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
      await esperar(900);

      const caja=document.querySelector('.pcr-curso');
      out.hayVista=!!caja;
      out.texto=txt(caja);
      out.kpis=[...(caja?caja.querySelectorAll('.pcr-kpi'):[])].map(txt);
      out.autores=[...(caja?caja.querySelectorAll('.pcr-nivel'):[])].map(n=>({
        nom:txt(n.querySelector('.pcr-nivel-nom')), n:txt(n.querySelector('.pcr-nivel-n'))
      }));
      out.filas=[...(caja?caja.querySelectorAll('.pcr-lote-fila'):[])].map(f=>({
        t:txt(f.querySelector('span')), v:txt(f.querySelector('b')),
        vacio:f.classList.contains('pcr-curso-vacio')
      }));

      // La planilla.
      let bajado=null;
      const R=window.URBIS_PC_EXPORTAR;
      if(R) R.descargar=function(blob,nombre){ bajado={nombre:nombre}; return blob.text().then(t=>{bajado.texto=t;}); };
      const bCsv=caja?caja.querySelector('[data-u52-call="pcr-curso-csv"]'):null;
      out.hayBotonCsv=!!bCsv;
      if(bCsv){ bCsv.click(); await esperar(500); }
      out.csv=bajado?bajado.texto:'';
      out.nombreCsv=bajado?bajado.nombre:'';
      return out;
    }, C);
    o.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
    await ctx.close();
    return o;
  }

  const prof=await ver(true);
  const est=await ver(false);
  await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const kpi=re=>{
    const k=(prof.kpis||[]).filter(x=>re.test(x))[0];
    if(!k) return null;
    const m=k.match(/^([\d.,]+)/);
    return m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
  };
  const aut=n=>(prof.autores||[]).filter(a=>a.nom.indexOf(n)===0)[0];
  const fila=t=>(prof.filas||[]).filter(f=>f.t===t)[0];

  console.log('\n  -- solo la ve quien reparte el trabajo --');
  P('el profesor la ve', prof.hayVista===true);
  P('una estudiante no', est.hayVista===false);

  console.log('\n  -- cuánto se levantó --');
  P('cuenta los seis puntos', kpi(/puntos levantados/)===6, 'da '+kpi(/puntos levantados/));
  P('y cuáles son de la última semana', kpi(/últimos 7 días/)===4,
    'esperado 4 de 6 (dos son de hace más de un mes) · da '+kpi(/últimos 7 días/));
  P('y cuántas personas están mapeando', kpi(/personas mapeando/)===3, 'da '+kpi(/personas mapeando/));

  console.log('\n  -- quién levantó cuánto --');
  P('Ana lleva 3', (aut('Ana')||{}).n==='3', (aut('Ana')||{}).n);
  P('Luis 2', (aut('Luis')||{}).n==='2', (aut('Luis')||{}).n);
  P('Sofía 1', (aut('Sofía')||{}).n==='1', (aut('Sofía')||{}).n);
  P('y van de mayor a menor', (prof.autores||[]).map(a=>a.n).join('')==='321',
    (prof.autores||[]).map(a=>a.nom.split(' ')[0]+' '+a.n).join(' · '));
  /* Pasados los treinta días «hace cuánto» deja de servir y se muestra la
     fecha, que es lo que hace el resto de la app: «hace 45 días» no le dice a
     nadie qué semana fue. Se acepta cualquiera de las dos formas. */
  P('cada uno con cuándo fue la última vez',
    /hace|ayer|ahora/i.test((aut('Ana')||{}).nom||'') &&
    /\d{4}|hace|ayer|ahora/i.test((aut('Sofía')||{}).nom||''),
    (aut('Ana')||{}).nom + '   /   ' + (aut('Sofía')||{}).nom);

  console.log('\n  -- la ficha del edificio --');
  P('solo se le exige a lo que es un edificio',
    /completas de 5/.test(prof.texto||''),
    'cinco edificios de seis puntos: el mobiliario urbano no cuenta · ' +
    ((prof.texto||'').match(/completas de \d+/)||['no lo dice'])[0]);
  P('«No se sabe» en la época NO cuenta como registrado',
    kpi(/completas de/)===20,
    'una sola de cinco está completa = 20% · da ' + kpi(/completas de/) + '%');
  P('cuenta las que no tienen pisos', kpi(/sin pisos/)===3, 'da '+kpi(/sin pisos/));
  P('y las que no tienen época', kpi(/sin época/)===4, 'da '+kpi(/sin época/));
  P('y dice por qué esos dos campos importan',
    /Sin pisos no hay alturas/.test(prof.texto||'') && /sin época no hay lectura/.test(prof.texto||''));

  console.log('\n  -- qué parte de la ciudad falta --');
  P('el sector con puntos adentro los cuenta',
    (fila('La Playa')||{}).v==='6 puntos', (fila('La Playa')||{}).v);
  P('el sector lejano sale sin tocar',
    (fila('El Contento')||{}).v==='sin tocar', (fila('El Contento')||{}).v);
  P('y se marca distinto para que se vea de un vistazo',
    (fila('El Contento')||{}).vacio===true);
  P('lo dice con todas las letras', /1 de 2<\/b> sectores|1 de 2 sectores/.test(prof.texto||''),
    ((prof.texto||'').match(/\d+ de \d+ sectores[^.]*\./)||['no lo dice'])[0].slice(0,90));

  console.log('\n  -- la planilla --');
  P('ofrece el CSV', prof.hayBotonCsv===true);
  P('con una fila por persona y la cabecera',
    (prof.csv||'').split('\n').length===4, (prof.csv||'').split('\n').length+' líneas');
  P('separado por punto y coma, que es lo que abre un Excel en español',
    /Nombre;Puntos levantados/.test(prof.csv||''), (prof.csv||'').split('\n')[0]);
  P('con lo que levantó cada quien', /Ana Torres;3;1/.test(prof.csv||''),
    (prof.csv||'').split('\n')[1]);
  P('y el archivo lleva la fecha en el nombre', /^urbis-curso-\d{4}-\d{2}-\d{2}\.csv$/.test(prof.nombreCsv||''),
    prof.nombreCsv);

  console.log('');
  P('sin errores de JavaScript', [...prof.err,...est.err].length===0,
    [...prof.err,...est.err].join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
