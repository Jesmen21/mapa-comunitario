const E = require('../entorno.js');
/* Tanda U · armar el pliego.

   Las capas resolvieron el orden en pantalla; esto es lo mismo para el papel.
   Una lámina no se hace poniendo todo: se hace eligiendo. Y como en columnas
   la caja que no cabe NO se recorta —se va a una columna que no existe y
   desaparece sin dejar rastro—, elegir sin poder medir es elegir a ciegas.

   Lo que esta prueba vigila, y que es lo único que puede romperse en
   silencio: que el INVENTARIO y el PAPEL no se separen. El bloque promete
   veintitantas cajas con su «esto ya tiene datos» o su «falta medir esto».
   Si alguien cambia la condición de una caja y no la del inventario, el
   estudiante apaga una caja que no estaba, o busca una que nunca va a salir,
   y nada en la pantalla lo delata. Acá se comprueba una por una:

     · lo que el inventario da por listo TIENE que salir en la lámina;
     · lo que da por gris NO puede salir;
     · apagar una la saca del papel y volver a encenderla la devuelve.

   Y lo mismo para los recuadros de la banda, que se enumeran sin dibujarlos.
   Al final, la prueba de encaje: se le pide al propio navegador que arme la
   lámina y la mida, que es lo que hace el botón «Probar si cabe».         */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const nodo=(tags,dx,dy)=>({type:'node',id:id++,lat:P(dx,dy).lat,lon:P(dx,dy).lng,tags:tags});
const usos=[];
for(let i=0;i<8;i++) usos.push(nodo({shop:'clothes',name:'Ropa '+i}, -220+i*30, 120));
for(let i=0;i<5;i++) usos.push(nodo({amenity:'restaurant',name:'Comida '+i}, 60+i*40, -140));
for(let i=0;i<4;i++) usos.push(nodo({amenity:'school',name:'Colegio '+i}, -120+i*60, 280));
usos.push(nodo({leisure:'park',name:'Parque Santander'}, 200, 200));

const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre,lanes:'2'},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const edificio=(pts,pisos)=>({type:'way',id:id++,
  tags:{building:'yes','building:levels':String(pisos)},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Calle 7','residential',[P(-300,-300),P(-300,0),P(-300,300)]),
  via('Avenida 3','secondary',[P(-400,0),P(0,0),P(400,0)]),
  via('Calle 9','residential',[P(0,-300),P(0,0),P(0,300)]),
  edificio([P(-60,-10),P(-40,-10),P(-40,10),P(-60,10),P(-60,-10)], 8),
  edificio([P(60,-60),P(90,-60),P(90,-30),P(60,-30),P(60,-60)], 3),
  edificio([P(120,120),P(160,120),P(160,160),P(120,160),P(120,120)], 5)
];

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
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
      body:JSON.stringify({elevation:lngs.map((lng,i)=>300+i*4)})});
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
    const btn=id=>H().querySelector('[data-pcr="'+id+'"]');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(450); } };
    const lamina=async()=>{ await abrir();
      H().querySelector('[data-pcr="lamina-ver"]').click(); await esperar(900);
      const h=capturado; capturado=''; return h; };
    const titulos=h=>(h.match(/<section class="caja[^"]*"><h2>([^<]+)<\/h2>/g)||[])
      .map(t=>t.replace(/.*<h2>/,'').replace('</h2>',''));
    const inventario=()=>[...H().querySelectorAll('[data-pcr="pliego-caja"]')].map(x=>({
      id:x.getAttribute('data-c'),
      titulo:((x.querySelector('b')||{}).textContent||'').trim(),
      listo:!x.classList.contains('pcr-capa-gris'),
      on:x.classList.contains('on')
    }));
    const inventarioMapas=()=>[...H().querySelectorAll('[data-pcr="pliego-mapa"]')].map(x=>({
      id:x.getAttribute('data-c'),
      titulo:((x.querySelector('b')||{}).textContent||'').trim(),
      listo:!x.classList.contains('pcr-capa-gris'),
      on:x.classList.contains('on')
    }));

    // ── Recién analizado: casi todo gris, porque casi nada se midió.
    o.reciente=inventario();

    // ── Medir todo lo que se pueda, para que el inventario se llene.
    await esperar(5200);
    btn('trazado').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(600);
    await esperar(5200);
    btn('terreno').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-corte');i++) await esperar(400);
    await esperar(800);
    btn('lote-dibujar').click(); await esperar(500);
    [Q(-25,-20),Q(25,-20),Q(25,20),Q(-25,20)].forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(900);
    await abrir();
    // Una marca intangible, para que esa caja también tenga con qué.
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="oscuro"]');
    if(lap){ lap.click(); await esperar(350);
      [[-100,-300],[60,-300],[60,-180],[-100,-180]].forEach(([x,y])=>{
        const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
      await esperar(250);
      const listo=document.querySelector('#pcr-int-barra [data-int="cerrar"]');
      if(listo) listo.click(); await esperar(500);
    }
    await abrir();

    // ── El inventario contra el papel: la comprobación que importa.
    o.inv=inventario();
    o.invMapas=inventarioMapas();
    const L1=await lamina();
    o.enPapel=titulos(L1);
    o.bandaEnPapel=(L1.match(/<figcaption>([^<]+)<\/figcaption>/g)||[])
      .map(t=>t.replace(/<[^>]+>/g,''));
    o.hayBanda=/mapas-banda/.test(L1);

    // ── Apagar tres cajas y un recuadro, y volver a mirar el papel.
    await abrir();
    /* Tres cualesquiera de las que de verdad están puestas, sin tocar las
       estructurales: apagar el plano o la banda es otra prueba. */
    const ESTRUCTURA=['plano-del-sector','los-mapas-del-sector','sintesis-del-sector','el-sitio'];
    o.apagadas=o.inv.filter(c=>c.listo && c.on && ESTRUCTURA.indexOf(c.id)===-1)
      .slice(0,3).map(c=>c.id);
    for(const idc of o.apagadas){
      const bb=H().querySelector('[data-pcr="pliego-caja"][data-c="'+idc+'"]');
      if(bb){ bb.click(); await esperar(350); await abrir(); }
    }
    const mapaApagado=(o.invMapas.filter(m=>m.listo && m.id!=='calor:todos')[0]||{}).id;
    o.mapaApagado=mapaApagado||'';
    if(mapaApagado){
      const bm=H().querySelector('[data-pcr="pliego-mapa"][data-c="'+mapaApagado+'"]');
      if(bm){ bm.click(); await esperar(350); await abrir(); }
    }
    o.invTrasApagar=inventario();
    const L2=await lamina();
    o.enPapel2=titulos(L2);
    o.bandaEnPapel2=(L2.match(/<figcaption>([^<]+)<\/figcaption>/g)||[])
      .map(t=>t.replace(/<[^>]+>/g,''));

    // ── «Dejar solo el plano» y volver a «Poner todo».
    await abrir();
    H().querySelector('[data-pcr="pliego-nada"]').click(); await esperar(400); await abrir();
    const L3=await lamina();
    o.enPapel3=titulos(L3);
    await abrir();
    H().querySelector('[data-pcr="pliego-todo"]').click(); await esperar(400); await abrir();
    const L4=await lamina();
    o.enPapel4=titulos(L4);
    o.bandaEnPapel4=(L4.match(/<figcaption>([^<]+)<\/figcaption>/g)||[])
      .map(t=>t.replace(/<[^>]+>/g,''));

    // ── El PDF, que no se toca: es el archivo.
    await abrir();
    H().querySelector('[data-pcr="pliego-caja"][data-c="el-terreno"]').click(); await esperar(350);
    await abrir();
    o.terrenoFueraDelPliego=!(inventario().filter(c=>c.id==='el-terreno')[0]||{}).on;
    H().querySelector('[data-pcr="lamina-ver"]').click(); await esperar(900);
    o.laminaSinTerreno=titulos(capturado); capturado='';
    await abrir();
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(900);
    o.pdf=capturado; capturado='';
    await abrir();
    H().querySelector('[data-pcr="pliego-todo"]').click(); await esperar(400); await abrir();

    // ── Probar si cabe.
    H().querySelector('[data-pcr="pliego-probar"]').click();
    for(let i=0;i<40 && !H().querySelector('.pcr-cabe-si,.pcr-cabe-no,.pcr-error');i++) await esperar(300);
    await esperar(300);
    o.cabe=(function(){
      const e=H().querySelector('.pcr-cabe-si,.pcr-cabe-no');
      return e?{ texto:(e.textContent||'').replace(/\s+/g,' ').trim(),
                 si:e.classList.contains('pcr-cabe-si') }:null;
    })();
    o.sinMarcos=document.querySelectorAll('iframe[aria-hidden="true"]').length;

    // ── Que la composición viaje con la ficha.
    await abrir();
    H().querySelector('[data-pcr="pliego-caja"][data-c="el-terreno"]').click(); await esperar(500);
    o.guardado=(function(){
      try{ const f=(R.leerFichas()||[])[0];
        return f?{ off:f.pliegoOff||[], mapasOff:f.pliegoMapasOff||[] }:null;
      }catch(e){ return null; }
    })();
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const inv=r.inv||[], papel=r.enPapel||[];

  console.log('\n  -- el inventario --');
  T('el bloque enumera las cajas del pliego', inv.length>=18, inv.length+' cajas');
  T('recién analizado, lo que no se midió sale gris',
    (r.reciente||[]).some(c=>c.id==='el-terreno' && !c.listo) &&
    (r.reciente||[]).some(c=>c.id==='llenos-y-vacios' && !c.listo),
    (r.reciente||[]).filter(c=>!c.listo).length+' de '+(r.reciente||[]).length+' grises al empezar');
  T('y después de medir, esas mismas quedan listas',
    inv.some(c=>c.id==='el-terreno' && c.listo) &&
    inv.some(c=>c.id==='llenos-y-vacios' && c.listo) &&
    inv.some(c=>c.id==='el-lote-a-intervenir' && c.listo),
    inv.filter(c=>c.listo).length+' listas de '+inv.length);

  console.log('\n  -- el inventario contra el papel --');
  /* Acá está el sentido de la prueba: una promesa que el papel no cumple es
     peor que no hacerla, porque el estudiante no tiene cómo enterarse. */
  const prometidasQueFaltan=inv.filter(c=>c.listo && c.on && c.id!=='los-mapas-del-sector')
    .filter(c=>papel.indexOf(c.titulo)===-1).map(c=>c.titulo);
  T('todo lo que el inventario da por listo sale en la lámina',
    prometidasQueFaltan.length===0, prometidasQueFaltan.join(' · ')||'ninguna falta');
  const grisesQueSalen=inv.filter(c=>!c.listo)
    .filter(c=>papel.indexOf(c.titulo)>=0).map(c=>c.titulo);
  T('y nada de lo gris se cuela',
    grisesQueSalen.length===0, grisesQueSalen.join(' · ')||'ninguna se cuela');
  T('la banda enumera sus recuadros sin dibujarlos',
    (r.invMapas||[]).length>=8, (r.invMapas||[]).length+' recuadros');
  const mapasProm=(r.invMapas||[]).filter(m=>m.listo && m.on)
    .filter(m=>(r.bandaEnPapel||[]).indexOf(m.titulo)===-1).map(m=>m.titulo);
  T('y lo que da por listo aparece de verdad en la banda',
    r.hayBanda===true && mapasProm.length===0, mapasProm.join(' · ')||'ninguno falta');
  const mapasGrises=(r.invMapas||[]).filter(m=>!m.listo)
    .filter(m=>(r.bandaEnPapel||[]).indexOf(m.titulo)>=0).map(m=>m.titulo);
  T('sin colar los grises', mapasGrises.length===0, mapasGrises.join(' · ')||'ninguno');

  console.log('\n  -- apagar y encender --');
  T('se apagaron tres cajas', (r.apagadas||[]).length===3, (r.apagadas||[]).join(' · '));
  const nombresApagados=(r.apagadas||[]).map(idc=>(inv.filter(c=>c.id===idc)[0]||{}).titulo);
  T('y ninguna sale en el papel',
    nombresApagados.every(t=>(r.enPapel2||[]).indexOf(t)===-1),
    nombresApagados.filter(t=>(r.enPapel2||[]).indexOf(t)>=0).join(' · ')||'ninguna');
  T('el resto sigue estando',
    (r.enPapel2||[]).length===(r.enPapel||[]).length-3,
    (r.enPapel||[]).length+' → '+(r.enPapel2||[]).length+' cajas');
  T('el interruptor queda apagado en la ficha',
    (r.invTrasApagar||[]).filter(c=>(r.apagadas||[]).indexOf(c.id)>=0).every(c=>!c.on));
  const tituloMapaOff=((r.invMapas||[]).filter(m=>m.id===r.mapaApagado)[0]||{}).titulo;
  T('el recuadro apagado sale de la banda',
    !!tituloMapaOff && (r.bandaEnPapel2||[]).indexOf(tituloMapaOff)===-1,
    tituloMapaOff||'no se apagó ninguno');
  T('«dejar solo el plano» deja el plano y poco más',
    (r.enPapel3||[]).length<=3 && (r.enPapel3||[]).indexOf('Plano del sector')>=0,
    (r.enPapel3||[]).join(' · '));
  T('y «poner todo» devuelve la lámina entera',
    (r.enPapel4||[]).length===(r.enPapel||[]).length &&
    (r.bandaEnPapel4||[]).length===(r.bandaEnPapel||[]).length,
    (r.enPapel4||[]).length+' cajas · '+(r.bandaEnPapel4||[]).length+' recuadros');

  console.log('\n  -- el PDF es el archivo, no la composición --');
  T('se apagó el terreno en el pliego', r.terrenoFueraDelPliego===true);
  T('y sale de la lámina', (r.laminaSinTerreno||[]).indexOf('El terreno')===-1,
    (r.laminaSinTerreno||[]).length+' cajas');
  T('pero el PDF lo sigue trayendo, porque es el archivo',
    /<h2>El terreno<\/h2>/.test(r.pdf||''),
    (String(r.pdf||'').match(/<h2>El terreno<\/h2>/)||['no está'])[0]);

  console.log('\n  -- probar si cabe --');
  T('la prueba responde', !!r.cabe, r.cabe?r.cabe.texto:'no respondió');
  T('con esta lámina, cabe', !!r.cabe && r.cabe.si===true, r.cabe?r.cabe.texto:'');
  T('y dice cuántas cajas y en cuántas bandas',
    !!r.cabe && /\d+ cajas en [4-9] bandas/.test(r.cabe.texto||''), r.cabe?r.cabe.texto:'');
  T('el marco escondido se retira solo', r.sinMarcos===0, r.sinMarcos+' marcos quedaron');

  console.log('\n  -- se guarda con la ficha --');
  T('la composición viaja con el sector',
    !!r.guardado && (r.guardado.off||[]).indexOf('el-terreno')>=0,
    r.guardado?JSON.stringify(r.guardado):'no se guardó');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
