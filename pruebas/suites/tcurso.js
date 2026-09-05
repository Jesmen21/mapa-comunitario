const E = require('../entorno.js');
/* Tanda AA · juntar los recorridos del curso.

   Lo dice el propio módulo desde que se escribió: un mapa de percepción de
   una persona es la opinión de una persona; de veinte que caminaron la misma
   manzana, ya es otra cosa. Hasta acá cada recorrido moría en el teléfono que
   lo levantó.

   Lo que se junta no es la suma —eso sería un montón de manchas encimadas—
   sino el ACUERDO: dónde varias personas, cada una por su lado, dijeron lo
   mismo. La maqueta está armada para que ese número tenga una sola respuesta
   posible:

     · Ana y Luis marcan la MISMA esquina como insegura, con trazos distintos
       hechos a pulso. Tienen que coincidir.
     · Sofía marca una esquina a cuatrocientos metros. No puede coincidir con
       nadie.
     · Y el mismo recorrido de Ana, traído dos veces, no puede contarse como
       un acuerdo consigo mismo: sería la peor lectura de todas.            */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const path=require('path');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

// Una zona cuadrada de lado `lado` metros centrada en (dx,dy).
const zona=(tipo,dx,dy,lado,nota)=>({
  id:'m'+Math.random().toString(36).slice(2,8), tipo, geom:'zona', nota:nota||'',
  ts:new Date().toISOString(),
  pts:[Q(dx-lado/2,dy-lado/2),Q(dx+lado/2,dy-lado/2),Q(dx+lado/2,dy+lado/2),Q(dx-lado/2,dy+lado/2)]
});
const paquete=(autor,marcas,cuando)=>({
  formato:'urbis-intangible-1', autor, sector:'El barrio de la prueba',
  centro:{lat:C.lat,lng:C.lng}, cuando: cuando||new Date().toISOString(), marcas
});

// Ana y Luis, la misma esquina con el pulso de cada uno. Sofía, lejos.
const ANA  = paquete('Ana',   [zona('inseguro', 100, 100, 60, 'De noche no pasa nadie')], '2026-09-01T20:00:00.000Z');
const LUIS = paquete('Luis',  [zona('inseguro', 108,  95, 55, 'Está muy oscuro')],        '2026-09-01T21:00:00.000Z');
const SOFIA= paquete('Sofía', [zona('inseguro', -400, 300, 50, '')],                      '2026-09-01T22:00:00.000Z');
const ROTO = { formato:'otra-cosa', marcas:[] };

const DIR = path.join(S, 'recorridos');
fs.mkdirSync(DIR, { recursive: true });
const escribir=(n,d)=>{ const f=path.join(DIR,n); fs.writeFileSync(f, JSON.stringify(d),'utf8'); return f; };
const fAna=escribir('ana.json',ANA), fLuis=escribir('luis.json',LUIS);
const fSofia=escribir('sofia.json',SOFIA), fRoto=escribir('roto.json',ROTO);

let id=1;
const usos=[];
for(let i=0;i<12;i++){ const a=i*30*Math.PI/180, d=(160+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

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
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'martarojas',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    /* Solo en el primer arranque. Limpiarlo en CADA carga borraría la ficha
       justo en la recarga que simula cerrar la aplicación, que es lo que esta
       prueba quiere medir. */
    if(!localStorage.getItem('__curso_limpio')){
      localStorage.removeItem('aia_overpass_cache_v1');
      localStorage.removeItem('pcr_fichas_v1');
      localStorage.setItem('__curso_limpio','1');
    }
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
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  // ── El sector y mi propio recorrido.
  await pg.evaluate(async (D)=>{
    const {C,POL}=D, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);
    const H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(400); } };
    await abrir();
    // Marta marca la misma esquina que Ana y Luis.
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="inseguro"]');
    lap.click(); await esperar(350);
    [[70,70],[130,70],[130,130],[70,130]].forEach(([x,y])=>{
      const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
    await esperar(250);
    document.querySelector('#pcr-int-barra [data-int="cerrar"]').click();
    await esperar(600);
  },{C,POL});

  const solo=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.hayBloque=/Juntarlo con el curso/.test(t);
    o.avisaDeUnoSolo=/con uno no hay acuerdo posible/i.test(t);
    o.hayExportar=!!H().querySelector('[data-pcr="int-exportar"]');
    o.hayImportar=!!H().querySelector('[data-pcr="int-importar"]');
    return o;
  });

  // ── Traer los tres archivos, y uno roto.
  await pg.setInputFiles('#pcr-int-archivo', [fAna, fLuis, fSofia, fRoto]);
  await pg.waitForTimeout(1800);

  const juntos=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(400); } };
    await abrir();
    const t=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    o.texto=t();
    o.kpis=[...H().querySelectorAll('.pcr-kpi')]
      .map(k=>(k.textContent||'').replace(/\s+/g,' ').trim())
      .filter(x=>/recorridos|marcas en total|coinciden/.test(x));
    o.error=(function(){ const e=[...H().querySelectorAll('.pcr-error')]
      .map(x=>(x.textContent||'').trim()).filter(Boolean); return e.join(' | '); })();
    // El mapa del acuerdo.
    const bm=H().querySelector('[data-pcr="int-acuerdos-mapa"]');
    o.hayBotonMapa=!!bm;
    if(bm){ bm.click(); await esperar(700); }
    /* Por su globo y no por su color: los vértices de las propias marcas son
       también círculos rojos, así que contar por color habría dado un número
       mayor que cero aunque la capa del acuerdo no dibujara nada. */
    o.enMapa=(function(){ let n=0;
      window.map.eachLayer(l=>{
        if(!(l instanceof L.CircleMarker)) return;
        const g=l.getTooltip && l.getTooltip();
        if(g && /\d+ personas/.test(String(g.getContent()||''))) n++;
      });
      return n; })();
    await abrir();
    // Traer a Ana otra vez: no puede contar dos veces.
    return o;
  });

  await pg.setInputFiles('#pcr-int-archivo', [fAna]);
  await pg.waitForTimeout(1500);

  const repetido=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    o.texto=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.kpis=[...H().querySelectorAll('.pcr-kpi')]
      .map(k=>(k.textContent||'').replace(/\s+/g,' ').trim())
      .filter(x=>/recorridos/.test(x));
    o.error=[...H().querySelectorAll('.pcr-error')].map(x=>(x.textContent||'').trim()).join(' | ');
    // Y el papel.
    let capturado='';
    window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ capturado=h; };
    H().querySelector('[data-pcr="lamina-ver"]').click(); await esperar(900);
    o.lamina=capturado;
    return o;
  });

  /* ── El curso sobrevive a que se cierre la aplicación ────────────────
     Los recorridos traídos vivían SOLO en memoria. Un profesor importaba los
     archivos de su curso, el teléfono se bloqueaba o el navegador reclamaba
     la pestaña, y había que volver a importarlos uno por uno. Sin ningún
     aviso: la pantalla volvía a decir que había un recorrido, el suyo.

     Es lo mismo que ya se decía del recorrido propio en el código que lo
     guarda —«es lo único de la ficha que no se puede volver a pedir»— y vale
     multiplicado por el número de estudiantes. */
  await pg.evaluate(async ()=>{
    const esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const H=document.getElementById('pcr-hoja');
    const bg=[...H.querySelectorAll('button')].filter(b=>/Guardar/i.test(b.textContent||''))[0];
    if(bg){ window.prompt=()=>'Sector del curso'; bg.click(); await esperar(700); }
  });
  await pg.reload({waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);
  const tras=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    R.abrir(); await esperar(500);
    const H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(400); } };
    await abrir();
    const br=H().querySelector('[data-pcr="reanudar"]');
    o.ofreceReanudar=!!br;
    if(br){ br.click(); await esperar(1000); await abrir(); }
    const t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.kpis=[...H().querySelectorAll('.pcr-kpi')]
      .map(k=>(k.textContent||'').replace(/\s+/g,' ').trim())
      .filter(x=>/recorridos|coinciden/.test(x));
    o.nombres=/Ana/.test(t) && /Luis/.test(t) && /Sof/.test(t);
    o.enLaFicha = (function(){
      try{ return ((R.leerFichas()||[])[0].intCurso||[]).length; }catch(e){ return -1; }
    })();
    return o;
  });

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const kpi=(lista,q)=>((lista||[]).filter(k=>k.indexOf(q)>=0)[0]||'');

  console.log('\n  -- con un solo recorrido --');
  T('el bloque aparece apenas hay una marca propia', solo.hayBloque===true);
  T('y avisa de que con uno no hay acuerdo posible', solo.avisaDeUnoSolo===true);
  T('con las dos puertas: compartir el mío y traer los de otros',
    solo.hayExportar===true && solo.hayImportar===true);

  console.log('\n  -- juntando el curso --');
  T('se juntaron los tres buenos y el mío', /4recorridos/.test(kpi(juntos.kpis,'recorridos')),
    (juntos.kpis||[]).join(' · '));
  T('nombrando a cada quien',
    /Ana/.test(juntos.texto) && /Luis/.test(juntos.texto) && /Sofía/.test(juntos.texto) &&
    /martarojas/.test(juntos.texto),
    (juntos.texto.match(/De: [^.]{0,60}/)||['no los nombra'])[0]);
  T('y el archivo que no era se rechaza con su motivo',
    /roto\.json/.test(juntos.error||'') && /no es un recorrido/i.test(juntos.error||''),
    juntos.error);

  console.log('\n  -- el acuerdo, que es lo que vale --');
  /* Marta, Ana y Luis marcaron la misma esquina; Sofía, una a cuatrocientos
     metros. Tiene que haber acuerdo, y Sofía no puede estar en él. */
  const nCoinciden=Number((kpi(juntos.kpis,'coinciden').match(/^(\d+)/)||[])[1]);
  T('hay sitios donde coinciden', nCoinciden>0, kpi(juntos.kpis,'coinciden'));
  T('y se dice cuántas personas, no cuántas marcas',
    /coincidieron dos o más personas que caminaron por separado/.test(juntos.texto));
  T('con el tamaño de la celda a la vista', /sitios de 25 m/.test(juntos.texto));
  T('se pueden ver en el mapa', juntos.hayBotonMapa===true && juntos.enMapa>0,
    juntos.enMapa+' sitios dibujados');
  /* El mapa ya no va en una tira debajo del plano: va en la banda de SU
     tema, que en este caso es el trabajo de campo. Se comprueban las dos
     cosas —que está y en qué banda—, porque un mapa en la banda equivocada
     es un mapa que nadie encuentra. */
  T('y entra en la banda de trabajo de campo, con las demás del curso',
    /<section class="caja mapa-caja[^>]*data-g="campo"[^>]*><h2>Dónde coincide el curso<\/h2>/
      .test(repetido.lamina||''),
    ((repetido.lamina||'').match(/<section class="caja mapa-caja[^>]*data-g="[^"]*"[^>]*><h2>[^<]*/g)||[])
      .map(x=>x.replace(/.*data-g="([^"]*)".*<h2>/,'$1: ')).join(' · ')||'ningún mapa');

  console.log('\n  -- el mismo recorrido dos veces no es un acuerdo --');
  T('sigue habiendo cuatro y no cinco', /4recorridos/.test(kpi(repetido.kpis,'recorridos')),
    (repetido.kpis||[]).join(' · '));
  T('y se dice por qué se rechazó', /ya estaba traído/.test(repetido.error||''), repetido.error);

  console.log('\n  -- y el curso sobrevive a cerrar la aplicación --');
  T('la hoja ofrece retomar el sector', tras.ofreceReanudar);
  T('con los cuatro recorridos, no solo el propio',
    /4recorridos/.test(kpi(tras.kpis,'recorridos')),
    (tras.kpis||[]).join(' · ')+' · '+tras.enLaFicha+' traídos guardados con la ficha');
  T('y con el nombre de cada quien', tras.nombres);
  T('los acuerdos se vuelven a calcular solos',
    /coinciden/.test((tras.kpis||[]).join(' ')), kpi(tras.kpis,'coinciden'));

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
