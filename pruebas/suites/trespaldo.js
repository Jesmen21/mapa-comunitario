const E = require('../entorno.js');
/* Tanda AD · llevarse la salida entera, y el trazo a medio dibujar.

   Dos pérdidas medidas antes de tocar nada:

     · Se podía exportar UNA ficha, o UN recorrido. Al final de una jornada,
       con el curso entero en un teléfono, no había forma de archivar el día.
       Un teléfono que se pierde se lleva la salida completa: cuarenta
       personas caminando una tarde. Las doce fichas que caben pesan 522 KB y
       el paquete se arma en dos milisegundos, así que no había ninguna razón
       para no ofrecerlo.

     · La marca CERRADA está a salvo desde v705; la que se está dibujando
       vivía solo en memoria. Archivar la ficha entera en cada toque cuesta
       unos 2 ms y guardar el trazo suelto 0,02: cien veces menos. Por eso va
       en su propia llave, con la huella del sector pegada —un trazo
       recuperado sobre otro barrio serían esquinas de una manzana donde nadie
       estuvo—.                                                            */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs'); const S=E.TRABAJO; const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
let id=1; const usos=[];
for(let i=0;i<40;i++){ const a=i*9*Math.PI/180, d=(140+(i%4)*50)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true,
    acceptDownloads:true});
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'martarojas',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    /* Solo en el primer arranque: esta prueba recarga la página a propósito
       para ver qué sobrevivió. */
    if(!localStorage.getItem('__resp_limpio')){
      localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1');
      localStorage.removeItem('pcr_trazo_vivo_v1');
      localStorage.setItem('__resp_limpio','1');
    }
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia',suburb:'La Playa'}})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,160)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  // ── Un sector con una marca propia.
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
    await R.analizar(); await esperar(1400);
    const H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="inseguro"]');
    if(lap){ lap.click(); await esperar(300);
      [[70,70],[130,70],[130,130],[70,130]].forEach(([x,y])=>{
        const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
      await esperar(200);
      const c=document.querySelector('#pcr-int-barra [data-int="cerrar"]'); if(c){ c.click(); await esperar(600); }
    }
    const bg=[...H().querySelectorAll('button')].filter(x=>/Guardar ficha/i.test(x.textContent||''))[0];
    if(bg){ bg.click(); await esperar(500); }
  },{C,POL});

  // ── El respaldo: se baja, se lee, y vuelve a entrar.
  const resp=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON;
    /* Si el módulo no expone el respaldo, esta prueba tiene que FALLAR
       diciéndolo, no reventar: una suite que explota no informa de qué se
       rompió, y la siguiente persona la borra por ruidosa. */
    if(typeof R.respaldoDeTodo!=='function' || typeof R.traerRespaldo!=='function'){
      o.faltaElRespaldo=true; return o;
    }
    // Se captura lo que la aplicación pondría en el archivo, sin depender de
    // que el navegador de pruebas deje descargar.
    let bajado=null, nombre='';
    const orig=URL.createObjectURL;
    URL.createObjectURL=function(bl){ o.blobKB=Math.round(bl.size/1024); return orig.call(URL,bl); };
    const crear=document.createElement.bind(document);
    document.createElement=function(t){ const e=crear(t);
      if(t==='a'){ const cl=e.click.bind(e); e.click=function(){ nombre=e.download; }; }
      return e; };
    R.accion('respaldo',{getAttribute:()=>''});
    await esperar(400);
    document.createElement=crear; URL.createObjectURL=orig;
    o.nombreArchivo=nombre;
    o.fichasAntes=(R.leerFichas()||[]).length;
    // El paquete, armado por la misma función que usa el botón.
    const paq=R.respaldoDeTodo(R.leerFichas());
    o.formato=paq.formato;
    o.traeFichas=(paq.fichas||[]).length;
    o.traeLasMarcas=((paq.fichas||[])[0].intangible||[]).length;
    bajado=JSON.stringify(paq);
    o.pesoKB=Math.round(bajado.length/1024);

    // Se borra todo y se restaura desde el archivo.
    const idAntes=(R.leerFichas()||[])[0].id;
    localStorage.removeItem('pcr_fichas_v1');
    o.vacio=(R.leerFichas()||[]).length;
    const r1=R.traerRespaldo(bajado);
    o.vuelta=r1.ok?{nuevas:r1.nuevas,repetidas:r1.repetidas}:{error:r1.error};
    o.fichasTrasVolver=(R.leerFichas()||[]).length;
    o.mismoId=((R.leerFichas()||[])[0]||{}).id===idAntes;
    o.marcasTrasVolver=(((R.leerFichas()||[])[0]||{}).intangible||[]).length;

    // Traerlo dos veces no puede duplicar nada.
    const r2=R.traerRespaldo(bajado);
    o.otraVez=r2.ok?{nuevas:r2.nuevas,repetidas:r2.repetidas}:{error:r2.error};
    o.fichasTrasRepetir=(R.leerFichas()||[]).length;

    // Y un archivo que no es un respaldo se rechaza diciendo por qué.
    const r3=R.traerRespaldo('{"formato":"otra-cosa","fichas":[]}');
    o.rechaza=!!r3.error && /no es un respaldo/i.test(r3.error);
    const r4=R.traerRespaldo('esto no es json');
    o.rechazaBasura=!!r4.error;
    return o;
  });

  /* ── El trazo a medio dibujar ─────────────────────────────────────────── */
  const trazo=await pg.evaluate(async (D)=>{
    const {C}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="ruido"]');
    o.hayLapiz=!!lap;
    if(lap){ lap.click(); await esperar(350);
      // Cinco esquinas y NO se cierra: se simula que el navegador se lleva la
      // pestaña en mitad del trazo.
      [[-60,60],[-120,60],[-150,110],[-120,160],[-60,160]].forEach(([x,y])=>{
        const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
      await esperar(300);
    }
    const g=JSON.parse(localStorage.getItem('pcr_trazo_vivo_v1')||'null');
    o.guardado=g?g.pts.length:0;
    o.conSuSector=!!(g&&g.sector);
    o.conSuTipo=g?g.tipo:'';
    return o;
  },{C});

  // Se recarga la aplicación: es lo que hace un teléfono cuando reclama memoria.
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
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    await abrir();
    const br=H().querySelector('[data-pcr="reanudar"]');
    o.ofreceRetomar=!!br;
    if(br){ br.click(); await esperar(1000); }
    // La barra del lápiz vuelve, con las esquinas puestas.
    const barra=document.getElementById('pcr-int-barra');
    o.barraVuelve=!!barra;
    const tb=barra?(barra.textContent||'').replace(/\s+/g,' '):'';
    o.diceCuantas=/llevás 5/.test(tb);
    o.loDice=/Se recuperó el trazo que estabas dibujando: 5 esquinas/.test(tb);
    await abrir();
    // Y al cerrarlo se convierte en marca, y el borrador desaparece.
    const c=document.querySelector('#pcr-int-barra [data-int="cerrar"]');
    if(c){ c.click(); await esperar(700); }
    o.marcas=(R.intangibleDePrueba()||[]).length;
    o.borradorLimpio=!localStorage.getItem('pcr_trazo_vivo_v1');
    o.enLaFicha=(function(){ try{ return ((R.leerFichas()||[])[0].intangible||[]).length; }catch(e){ return -1; } })();
    return o;
  });

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- llevarse la salida entera --');
  T('el botón arma un archivo con nombre de respaldo',
    /^urbis-respaldo-\d{4}-\d{2}-\d{2}\.json$/.test(resp.nombreArchivo||''), resp.nombreArchivo||'ninguno');
  T('con el formato declarado y los sectores dentro',
    resp.formato==='urbis-respaldo-1' && resp.traeFichas===resp.fichasAntes && resp.traeFichas>0,
    resp.traeFichas+' sectores · '+resp.pesoKB+' KB');
  T('y con lo que no se puede volver a pedir: las marcas', resp.traeLasMarcas===1);

  console.log('\n  -- y volver a traerla --');
  T('con el almacenamiento vacío, el respaldo lo repone',
    resp.vacio===0 && resp.fichasTrasVolver===resp.fichasAntes && resp.mismoId===true,
    JSON.stringify(resp.vuelta||'no se pudo probar'));
  T('con las marcas intactas', resp.marcasTrasVolver===1);
  /* Sin esto el respaldo no sirve para juntar los teléfonos de un curso:
     traer dos veces el mismo archivo llenaría la lista de copias. */
  T('traerlo dos veces no duplica nada',
    resp.fichasTrasRepetir===resp.fichasAntes && (resp.otraVez||{}).nuevas===0 &&
    (resp.otraVez||{}).repetidas>0,
    JSON.stringify(resp.otraVez||'no se pudo probar'));
  T('y un archivo que no es un respaldo se rechaza con su motivo',
    resp.rechaza===true && resp.rechazaBasura===true);

  console.log('\n  -- el trazo a medio dibujar --');
  T('cinco esquinas sin cerrar quedan escritas', trazo.hayLapiz && trazo.guardado===5,
    trazo.guardado+' esquinas guardadas');
  T('con el sector y el tipo pegados, para no revivirlas en otro barrio',
    trazo.conSuSector===true && trazo.conSuTipo==='ruido');
  T('tras recargar, el sector se puede retomar', tras.ofreceRetomar===true);
  T('y el lápiz vuelve con las cinco esquinas puestas',
    tras.barraVuelve===true && tras.diceCuantas===true);
  /* En la barra del lápiz y no en la hoja: quien retoma el sector escribe su
     propio aviso justo después, y el último gana. */
  T('diciéndolo ahí mismo, en vez de dejar aparecer un trazo de la nada', tras.loDice===true);
  T('al cerrarlo se vuelve una marca guardada y el borrador se limpia',
    tras.marcas===2 && tras.enLaFicha===2 && tras.borradorLimpio===true,
    tras.marcas+' marcas · '+tras.enLaFicha+' en la ficha');

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
