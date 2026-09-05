const E = require('../entorno.js');
/* Tanda B · el terreno: alturas, pendiente, orientación de la ladera y los
   dos cortes. El servicio de elevación se dobla con una ladera conocida —de
   340 a 454 msnm bajando al occidente, como el lote de la lámina— para poder
   comprobar las cifras contra algo. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const usos=[]; let id=1;
for(let i=0;i<24;i++){ const a=i*15*Math.PI/180, d=(150+(i%4)*80)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

/* Un archivo climático simulado de Cúcuta: cálido, con dos temporadas de
   lluvia (abril-mayo y octubre-noviembre) y viento del nororiente. Así se
   sabe de antemano qué tiene que contestar el motor. */
function climaSimulado(){
  const dias=[]; const ini=new Date(Date.UTC(2021,0,1));
  for(let i=0;i<365*5;i++){
    const d=new Date(ini.getTime()+i*86400000), mes=d.getUTCMonth();
    const lluvioso=(mes===3||mes===4||mes===9||mes===10);
    dias.push({ f:d.toISOString().slice(0,10),
      tMax: mes===2 ? 34 : 31, tMin: 22,
      lluvia: lluvioso ? (i%3===0?12:2) : (i%9===0?3:0),
      viento: 15, vientoDir: 45 });
  }
  return { desde:'2021-01-01', hasta:'2025-12-25', anios:5, zona:'America/Bogota', dias };
}

/* La ladera del doble: la cota depende SOLO de la longitud, subiendo hacia el
   oriente. Se define sobre el ÁREA —340 msnm en su borde occidental y 454 en
   el oriental, extrapolando hacia fuera— y no sobre la rejilla, porque la
   rejilla es cosa del cliente: se pide con un margen alrededor del contorno y
   ese margen puede cambiar. La prueba no lo copia; se lo pregunta. */
const RAMPA={ lng0:C.lng-L, lng1:C.lng+L, z0:340, z1:454 };
function cotaDe(lng){ return RAMPA.z0 + (RAMPA.z1-RAMPA.z0)*((lng-RAMPA.lng0)/(RAMPA.lng1-RAMPA.lng0)); }

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
    body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander',country:'Colombia'}})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));
  let consultasElev=0, puntosPedidos=0;
  await ctx.route(/archive-api\.open-meteo\.com/, r=>{
    const c=climaSimulado();
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      timezone:c.zona,
      daily:{ time:c.dias.map(d=>d.f), temperature_2m_max:c.dias.map(d=>d.tMax),
        temperature_2m_min:c.dias.map(d=>d.tMin), precipitation_sum:c.dias.map(d=>d.lluvia),
        wind_speed_10m_max:c.dias.map(d=>d.viento), wind_direction_10m_dominant:c.dias.map(d=>d.vientoDir) }})});
  });
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    consultasElev++;
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    puntosPedidos+=lngs.length;
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map(cotaDe)})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(900);

    const h=()=>document.getElementById('pcr-hoja');
    /* Lo que TIENE que salir, calculado con la rejilla que arma el propio
       cliente y la misma rampa que responde el doble: así la prueba no repite
       la fórmula del margen y sigue valiendo si esa fórmula cambia. */
    o.esperado=(function(){
      const rej=window.AIA_DATOS.rejillaDe(POL, null, 0);
      const z=lng=>D.RAMPA.z0+(D.RAMPA.z1-D.RAMPA.z0)*((lng-D.RAMPA.lng0)/(D.RAMPA.lng1-D.RAMPA.lng0));
      const minLat=Math.min(...POL.map(p=>p.lat)), maxLat=Math.max(...POL.map(p=>p.lat));
      const minLng=Math.min(...POL.map(p=>p.lng)), maxLng=Math.max(...POL.map(p=>p.lng));
      const dentro=rej.puntos.filter(p=>p.lat>=minLat&&p.lat<=maxLat&&p.lng>=minLng&&p.lng<=maxLng);
      const cotas=dentro.map(p=>z(p.lng));
      return { min:Math.round(Math.min(...cotas)), max:Math.round(Math.max(...cotas)),
               nodos:dentro.length, lado:rej.filas };
    })();
    o.hayBoton=!!h().querySelector('[data-pcr="terreno"]');
    o.antesSinDatos=!h().querySelector('.pcr-corte');
    h().querySelector('[data-pcr="terreno"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-corte');i++) await esperar(400);
    await esperar(300);

    const H=h();
    o.aviso=txt(H.querySelector('.pcr-error'))||txt(H.querySelector('#pcr-ter-estado'))||'';
    o.kpis=[...H.querySelectorAll('.pcr-kpi')].map(k=>txt(k)).filter(x=>/msnm|desnivel/.test(x));
    o.conc=(function(){const c=[...H.querySelectorAll('.pcr-conc')].filter(p=>/pendiente media/i.test(txt(p)))[0];return c?txt(c):'';})();
    o.clases=[...H.querySelectorAll('.pcr-nivel')].map(n=>txt(n.querySelector('.pcr-nivel-nom')))
      .filter(x=>/Plano|Pendiente/.test(x));
    o.perfiles=[...H.querySelectorAll('.pcr-corte')].map(p=>[...p.querySelectorAll('text')].map(t=>t.textContent).filter(t=>/–/.test(t))[0]||'');
    o.lineas=H.querySelectorAll('.pcr-corte').length;
    o.avisoResolucion=[...H.querySelectorAll('.pcr-pista')].some(p=>/metros de paso/.test(txt(p)));

    // ── El clima
    const bCli=document.querySelector('#pcr-hoja [data-pcr="clima"]');
    o.hayBotonClima=!!bCli;
    if(bCli){
      bCli.click();
      for(let i=0;i<60 && !document.querySelector('.pcr-clima-graf');i++) await esperar(400);
      await esperar(300);
    }
    const H4=document.getElementById('pcr-hoja');
    o.climaKpis=[...H4.querySelectorAll('.pcr-kpi')].map(k=>txt(k)).filter(x=>/temperatura media|lluvia al año|viento/.test(x));
    o.hayClimograma=!!H4.querySelector('.pcr-clima-graf svg');
    o.barrasLluvia=H4.querySelectorAll('.pcr-clima-lluvia').length;
    o.lineaTemp=H4.querySelectorAll('.pcr-clima-temp').length;
    o.climaFilas=[...H4.querySelectorAll('.pcr-lote-fila')].map(f=>txt(f.querySelector('span'))+'='+txt(f.querySelector('b')))
      .filter(x=>/lluvioso|seco|caliente|viento/.test(x));
    o.climaConc=[...H4.querySelectorAll('.pcr-conc')].map(x=>txt(x)).filter(x=>/viento entra|Clima/.test(x));
    o.climaAdvertencia=[...H4.querySelectorAll('.pcr-pista')].some(x=>/modelo global reanalizado/.test(txt(x)));

    /* El último botón de la hoja tiene que decir QUÉ HACE. Decía «Listo» al
       final de catorce metros de informe, y cerraba: quien acaba de leerlo
       todo lo lee como «ya terminé de leer», lo toca, y desde afuera parece
       que el análisis se perdió. */
    o.botonFinal=(function(){
      const b=[...H4.querySelectorAll('[data-pcr="cerrar"]')].pop();
      return b?txt(b):'(no hay)';
    })();
    o.diceQueNoSePierde=[...H4.querySelectorAll('.pcr-pista')]
      .some(x=>/no se pierde/i.test(txt(x)) && /Volver al análisis/i.test(txt(x)));

    // ── Cerrar la hoja: el análisis TIENE que seguir ahí
    R.cerrar(); await esperar(400);
    const v=document.getElementById('pcr-volver');
    o.hayVolver=!!(v && !v.hidden);
    o.textoVolver=v?txt(v):'';
    /* Y tiene que VERSE. Estaba arriba a la derecha, justo encima de la
       tarjeta blanca de «UrbisProCity»: blanco sobre blanco. Respondía al
       toque, pero nadie lo veía, y el camino de vuelta al análisis pasaba por
       volver a abrir la lupa. Se comprueba que lo que hay en su centro sea él
       mismo y que no se monte sobre la cabecera del mapa. */
    o.volverALaVista=(function(){
      if(!v || v.hidden) return 'no está';
      const c=v.getBoundingClientRect();
      if(c.width<40 || c.height<20) return 'sin tamaño';
      const e=document.elementFromPoint(c.left+c.width/2, c.top+c.height/2);
      if(!(e===v || v.contains(e))) return 'tapado por '+((e&&(e.id||e.className))||'algo');
      /* Y con AIRE: no basta con no tocarla en este teléfono. La cabecera
         crece con la barra de estado y con el margen seguro de cada aparato;
         el sitio de antes quedaba dos píxeles por debajo de ella acá y encima
         de ella en el teléfono desde el que se reportó. Se exige un margen
         que aguante esa diferencia. */
      const cab=document.querySelector('.u52-mapcentric-topbar');
      if(cab){ const k=cab.getBoundingClientRect(), aire=24;
        const pisa=!(c.right<k.left-aire || c.left>k.right+aire ||
                     c.bottom<k.top-aire || c.top>k.bottom+aire);
        if(pisa) return 'pegado a la cabecera del mapa (' +
          Math.round(c.top-k.bottom)+' px por debajo)';
      }
      return 'a la vista';
    })();
    if(v) v.click();
    await esperar(600);
    const H2=document.getElementById('pcr-hoja');
    o.volvioConFicha=!!(H2 && H2.querySelector('.pcr-corte'));

    // Y si se cambia el área, el resultado sí se descarta
    A.limpiarArea(); A.iniciarDibujo();
    const L2=0.002;
    [[-L2,-L2],[L2,-L2],[L2,L2],[-L2,L2],[-L2,-L2]].forEach(([a,b])=>A.agregarPunto(C.lat+a,C.lng+b));
    R.cerrar(); await esperar(200); R.abrir(); await esperar(500);
    const H3=document.getElementById('pcr-hoja');
    o.otraAreaEmpiezaLimpia=!H3.querySelector('.pcr-corte');

    // Guardar y reabrir
    const bg=[...document.querySelectorAll('#pcr-hoja button')].filter(b=>/Guardar/i.test(b.textContent||''))[0];
    if(bg){ window.prompt=()=>'Sector con ladera'; bg.click(); await esperar(500); }
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(700);
    const cab=document.querySelector('.pcr-pest-cab'); if(cab){ cab.click(); await esperar(600); }
    const pest=document.querySelector('.pcr-pestana');
    o.pestPerfiles=pest?pest.querySelectorAll('.pcr-corte').length:0;
    o.pestClima=!!(pest&&pest.querySelector('.pcr-clima-graf'));
    o.pestDesnivel=!!(pest&&/desnivel/.test(txt(pest)));
    return o;
  },{C,POL,RAMPA});

  r.consultasElev=consultasElev; r.puntosPedidos=puntosPedidos;
  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- se pide, no se hace de oficio --');
  P('el bloque ofrece el botón', r.hayBoton);
  P('y no trae datos hasta que se pulsa', r.antesSinDatos);
  /* Siete y no cuatro: la rejilla pasó de 18 a 26 puntos por lado para que
     las curvas salgan suaves y no a tramos rectos de sesenta metros. El
     modelo sigue siendo de 90 m; lo que cambió es el dibujo, y la nota de la
     ficha lo sigue diciendo. */
  /* El servicio de altura cobra por PUNTO: una consulta de cien puntos le
     cuenta como cien, y medir un par de sectores seguidos agotaba el cupo de
     la hora —«429»— y dejaba el análisis sin terreno. Se pide una rejilla de
     16 por lado como mucho; lo fino se pone al dibujar, interpolando entre
     cotas medidas. Se mide el techo real: tres consultas y 256 puntos. */
  P('pide la rejilla en pocas consultas', r.consultasElev>0 && r.consultasElev<=3,
    r.consultasElev+' consultas · '+r.puntosPedidos+' puntos');
  P('y sin pasarse de puntos, que es lo que cobra el servicio',
    r.puntosPedidos>0 && r.puntosPedidos<=256, r.puntosPedidos+' puntos');

  console.log('   [diag] aviso en pantalla: '+JSON.stringify(r.aviso||''));
  console.log('\n  -- las alturas --');
  P('salen las tres cifras de altura', r.kpis.length===3, r.kpis.join(' | '));
  /* Los valores esperados no se ponen a ojo ni se copia la fórmula del
     margen: se calculan con la rejilla real del cliente y la misma rampa que
     contesta el doble. Si mañana cambia el margen de la rejilla, la prueba
     sigue diciendo la verdad. */
  const esp=r.esperado||{};
  P('la cota más baja es la del nodo más occidental de dentro',
    (r.kpis[0]||'').indexOf(esp.min+'msnm')===0, 'esperado '+esp.min+' · '+r.kpis[0]);
  P('y la más alta la del más oriental',
    (r.kpis[1]||'').indexOf(esp.max+'msnm')===0, 'esperado '+esp.max+' · '+r.kpis[1]);
  P('el desnivel es la diferencia entre las dos',
    (r.kpis[2]||'').indexOf((esp.max-esp.min)+' m')===0,
    'esperado '+(esp.max-esp.min)+' m · '+r.kpis[2]+'   (rejilla '+esp.lado+'×'+esp.lado+', '+esp.nodos+' nodos dentro)');

  console.log('\n  -- la pendiente y la ladera --');
  P('dice la pendiente media', /pendiente media es del/i.test(r.conc), r.conc.slice(0,90));
  P('y que la ladera baja al occidente', /hacia el occidente/.test(r.conc),
    (r.conc.match(/baja sobre todo hacia el \w+/)||['no lo dice'])[0]);
  P('reparte el área por clases de pendiente', r.clases.length>=1, r.clases.join(' · '));

  console.log('\n  -- los cortes --');
  P('dibuja los dos perfiles', r.perfiles.length===2 && r.lineas===2, r.perfiles.join(' | '));
  P('y avisa de la resolución del modelo', r.avisoResolucion);

  console.log('\n  -- el clima del sitio --');
  P('el bloque ofrece consultarlo', r.hayBotonClima);
  P('salen las tres cifras del clima', r.climaKpis.length===3, r.climaKpis.join(' | '));
  P('dibuja el climograma', r.hayClimograma && r.barrasLluvia===12 && r.lineaTemp===1,
    r.barrasLluvia+' barras de lluvia · '+r.lineaTemp+' línea de temperatura');
  P('marzo es el mes más caliente', r.climaFilas.some(x=>/caliente=marzo/.test(x)),
    (r.climaFilas.filter(x=>/caliente/.test(x))[0]||'no lo dice'));
  P('el más lluvioso es de temporada, y el más seco de fuera de ella',
    r.climaFilas.some(x=>/lluvioso=(abril|mayo|octubre|noviembre)/.test(x)) &&
    r.climaFilas.some(x=>/seco=(enero|febrero|julio|agosto|diciembre|marzo|junio|septiembre)/.test(x)),
    r.climaFilas.filter(x=>/lluvioso|seco/.test(x)).join(' · '));
  P('y que el viento viene del nororiente', r.climaFilas.some(x=>/viento viene del=nororiente/.test(x)),
    (r.climaFilas.filter(x=>/viento/.test(x))[0]||'no lo dice'));
  P('lo lee como clima cálido', r.climaConc.some(x=>/Clima cálido/.test(x)), (r.climaConc[0]||'').slice(0,70));
  P('y avisa de que es un modelo, no una estación', r.climaAdvertencia);

  console.log('\n  -- el análisis no se pierde al cerrar --');
  P('con la hoja cerrada queda el acceso directo', r.hayVolver, r.textoVolver||'no aparece');
  P('el botón del final dice qué hace, no solo «Listo»',
    /cerrar y ver el mapa/i.test(r.botonFinal||''), r.botonFinal);
  P('y avisa de que el análisis no se pierde', r.diceQueNoSePierde===true);
  P('el acceso directo se ve de verdad, no debajo de la cabecera del mapa',
    r.volverALaVista==='a la vista', r.volverALaVista);
  P('y al tocarlo vuelve la ficha entera, sin repetir nada', r.volvioConFicha);
  P('pero si se cambia el área, empieza limpia', r.otraAreaEmpiezaLimpia);

  console.log('\n  -- el sector guardado no lo pierde --');
  P('la pestaña trae los dos cortes', r.pestPerfiles===2, r.pestPerfiles+' perfiles');
  P('y el desnivel', r.pestDesnivel);
  P('y el climograma', r.pestClima);

  console.log('');
  P('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
