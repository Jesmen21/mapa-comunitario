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
  /* La primera consulta se contesta con un 429, que es lo que devuelve de
     verdad el servicio de altura cuando se le agota el cupo de la hora —pasó
     en clase y dejó el análisis sin terreno y sin cortes—. El módulo tiene
     que esperar y volver a pedirla, no rendirse. */
  let consultasElev=0, puntosPedidos=0, saturadas=0;
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    if (!saturadas) { saturadas++; return r.fulfill({ status:429, contentType:'text/plain', body:'too many' }); }
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

    /* ── Por dónde se cortó ──────────────────────────────────────────────
       Un perfil sin su A–A′ marcada en planta no se puede situar: se ve una
       silueta y no se sabe de dónde salió. Es la mitad de la convención de
       cualquier lámina de topografía y faltaba; llegó reportado así.

       Se comprueba lo que de verdad importa: que las líneas estén SOBRE EL
       MAPA —no en la ficha—, que lleven las cuatro letras, y que la de A–A′
       vaya de oeste a este y la de B–B′ de norte a sur, que es lo que las
       hace un corte y no dos rayas cualesquiera. */
    /* ── Volver donde se quedó ────────────────────────────────────────
       Contado así: «bajo hasta la topografía, le doy a ver las líneas del
       corte en el mapa, y cuando vuelvo a la ficha me sube hasta arriba y me
       toca bajar bastante para volver a la zona».

       Pasaba en todas las capas —las curvas, la caminata, las sombras, cada
       interruptor— porque ir al mapa CAMBIA de vista: la hoja se encoge para
       dejar ver el mapa, y la posición solo se devolvía cuando la vista
       seguía siendo la misma. Se mide el recorrido entero: bajar, ir al mapa,
       volver, y comprobar que la ficha esté donde estaba y no en cero. */
    const cuerpo = () => H.querySelector('.pcr-cuerpo');
    (function () { const c = cuerpo();
      if (c) c.scrollTop = Math.round((c.scrollHeight - c.clientHeight) * 0.6); })();
    o.dondeIba = cuerpo() ? cuerpo().scrollTop : 0;
    o.hayBotonCortes = !!H.querySelector('[data-pcr="cortes-mapa"]');
    const antesDeCortes = document.querySelectorAll('.leaflet-pane path').length;
    const bc = H.querySelector('[data-pcr="cortes-mapa"]');
    if (bc) { bc.click(); await esperar(700); }
    // La hoja se encogió para dejar ver el mapa; se vuelve a subir, que es lo
    // que hace quien acaba de mirar por dónde pasan los cortes.
    o.encogioAlIr = !!document.querySelector('#pcr-hoja.pcr-encogida');
    (function () { const a = H.querySelector('[data-pcr="agrandar"]'); if (a) a.click(); })();
    await esperar(400);
    o.dondeVuelve = cuerpo() ? cuerpo().scrollTop : 0;
    o.letras = [...document.querySelectorAll('.pcr-corte-letra')].map(e=>e.textContent).sort();
    o.lineasNuevas = document.querySelectorAll('.leaflet-pane path').length - antesDeCortes;
    /* Las trazas, leídas del propio mapa: se busca cada polilínea de trazos y
       se mira hacia dónde va. Medir el rumbo y no solo contar líneas es lo
       que distingue un corte bien puesto de dos rayas en el sitio. */
    o.rumbos = (function(){
      const r=[];
      window.map.eachLayer(function(l){
        if(!l || typeof l.getLatLngs!=='function') return;
        const op=l.options||{};
        if(!op.dashArray || op.color!=='#12202e') return;
        const pts=l.getLatLngs(); if(!pts || pts.length<2) return;
        const a=pts[0], b=pts[pts.length-1];
        r.push({ dLat:+( (b.lat-a.lat).toFixed(5) ), dLng:+( (b.lng-a.lng).toFixed(5) ) });
      });
      return r;
    })();
    /* Los rótulos que el motor le puso a cada corte. Comprobar la dirección
       contra el RÓTULO, y no contra una brújula escrita a mano en la prueba,
       es lo que pilla el error de verdad: una línea que va al revés de lo que
       dice su propia etiqueta. */
    /* Con guarda: si el terreno no se midió —el servicio caído, o el «429»
       que dejó esto sin cortes en clase—, esto era un `null.perfiles` y la
       suite se caía sin decir una palabra. Una prueba que revienta no dice
       qué se rompió; una que falla, sí. */
    o.etiquetas = ((window.URBIS_PC_RECON.terrenoDePrueba
      ? (window.URBIS_PC_RECON.terrenoDePrueba() || {}).perfiles : null) || []).map(p=>p.etiqueta||'');
    /* ── Cortar por donde uno diga ───────────────────────────────────────
       Los dos cortes del motor van por el medio del rectángulo. Un proyecto
       se corta por donde el terreno decide algo: la ladera que se va a
       aterrazar, el eje de la calle. Dos toques en el mapa y sale el corte
       con la letra que le toque, y lo calcula el teléfono con las cotas ya
       guardadas: sin señal y sin pedir nada. */
    function abrirHoja(){ const a=H.querySelector('[data-pcr="agrandar"]'); if(a) a.click(); }
    o.hayBotonCortar = !!H.querySelector('[data-pcr="corte-nuevo"]');
    const bn = H.querySelector('[data-pcr="corte-nuevo"]');
    if (bn) { bn.click(); await esperar(500); }
    o.barraCorte = !!document.getElementById('pcr-corte-barra');
    o.pideEmpezar = /dónde EMPIEZA/.test(
      (document.getElementById('pcr-corte-barra')||{textContent:''}).textContent);
    // dos toques: una diagonal por dentro del sector
    window.map.fire('click',{latlng:{lat:C.lat-0.0025, lng:C.lng-0.0025}});
    await esperar(300);
    o.pideTerminar = /dónde TERMINA/.test(
      (document.getElementById('pcr-corte-barra')||{textContent:''}).textContent);
    window.map.fire('click',{latlng:{lat:C.lat+0.0025, lng:C.lng+0.0025}});
    await esperar(800);
    const t2 = window.URBIS_PC_RECON.terrenoDePrueba();
    const mios = ((t2||{}).perfiles||[]).filter(p=>p.aMano);
    o.cortesAMano = mios.length;
    o.letraNueva = mios[0] ? mios[0].marca + '–' + mios[0].marcaFin : '';
    o.etiquetaNueva = mios[0] ? mios[0].etiqueta : '';
    o.largoNuevo = mios[0] ? mios[0].largoM : 0;
    o.cotasNuevas = mios[0] ? (mios[0].puntos||[]).length : 0;
    o.suenaIgual = mios[0] ? /de \w+ a \w+|al opuesto/.test(mios[0].etiqueta) : false;
    o.barraTrasCortar = !!document.getElementById('pcr-corte-barra');
    // aparece en la ficha como un corte más
    abrirHoja();
    o.enLaFicha = /C–C′/.test((H.textContent||''));
    // y una segunda vez da la D
    const bn2 = H.querySelector('[data-pcr="corte-nuevo"]');
    if (bn2) { bn2.click(); await esperar(400); }
    window.map.fire('click',{latlng:{lat:C.lat-0.002, lng:C.lng+0.002}});
    await esperar(250);
    window.map.fire('click',{latlng:{lat:C.lat+0.002, lng:C.lng-0.002}});
    await esperar(700);
    const t3 = window.URBIS_PC_RECON.terrenoDePrueba();
    o.letras2 = ((t3||{}).perfiles||[]).filter(p=>p.aMano).map(p=>p.marca).join('');
    // se pueden quitar de a uno
    abrirHoja();
    const bb = H.querySelector('[data-pcr="corte-borrar"]');
    if (bb) { bb.click(); await esperar(500); }
    const t4 = window.URBIS_PC_RECON.terrenoDePrueba();
    o.letrasTrasBorrar = ((t4||{}).perfiles||[]).filter(p=>p.aMano).map(p=>p.marca).join('');

    // Y que se puedan quitar del mapa.
    abrirHoja();
    if (bc) { const b2=H.querySelector('[data-pcr="cortes-mapa"]');
      if (b2 && S_cortesPuestos()) b2.click(); await esperar(600); }
    o.letrasTrasQuitar = document.querySelectorAll('.pcr-corte-letra').length;
    function S_cortesPuestos(){ return document.querySelectorAll('.pcr-corte-letra').length>0; }

    // Guardar y reabrir
    const bg=[...H.querySelectorAll('button')].filter(b=>/Guardar/i.test(b.textContent||''))[0];
    if(bg){ window.prompt=()=>'Sector con ladera'; bg.click(); await esperar(500); }
    R.cerrar(); await esperar(200);
    if(typeof window.urbisProCityAbrirSector==='function') window.urbisProCityAbrirSector();
    await esperar(700);
    const cab=document.querySelector('.pcr-pest-cab'); if(cab){ cab.click(); await esperar(600); }
    const pest=document.querySelector('.pcr-pestana');
    o.pestPerfiles=pest?pest.querySelectorAll('.pcr-corte').length:0;
    /* El corte de a mano tiene que sobrevivir a guardar y reabrir: si no, el
       estudiante lo pierde entre una clase y la siguiente, que es cuando lo
       iba a usar. Se busca su letra dentro de la pestaña. */
    o.pestConMio = pest ? /D–D′/.test((pest.textContent||'')) : false;
    o.pestDesnivel=!!(pest&&/desnivel/.test(txt(pest)));
    return o;
  },{C,POL,RAMPA});

  r.consultasElev=consultasElev; r.puntosPedidos=puntosPedidos; r.saturadas=saturadas;
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
  P('un «429» del servicio no tumba la medición: se espera y se reintenta',
    r.saturadas===1 && r.consultasElev>0, r.saturadas+' rechazos · '+r.consultasElev+' consultas buenas');

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

  console.log('\n  -- el sector guardado no lo pierde --');
  /* Tres y no dos: los dos del motor más el que se dibujó a mano. La versión
     anterior de esta comprobación exigía exactamente dos y empezó a fallar al
     añadir los cortes propios — pero lo que había cambiado era lo correcto, no
     la aplicación. Se aprieta en vez de aflojarse: ahora además se exige que
     el de a mano esté ahí con su letra. */
  P('la pestaña trae los cortes del motor y el que se dibujó',
    r.pestPerfiles===3 && r.pestConMio,
    r.pestPerfiles+' perfiles' + (r.pestConMio?', con el D–D′ propio':', sin el propio'));
  P('y el desnivel', r.pestDesnivel);

  /* ── Volver donde se quedó ─────────────────────────────────────────────
     «Bajo hasta la topografía, le doy a ver las líneas del corte en el mapa,
     y cuando vuelvo a la ficha me sube hasta arriba». La ficha ya devolvía la
     posición, pero solo si NO cambiaba de vista, y mirar el mapa cambia de
     vista por definición: la hoja se encoge para dejarlo ver. */
  console.log('\n  -- volver donde se quedó --');
  P('la hoja se encoge para dejar ver el mapa', r.encogioAlIr === true);
  P('se había bajado de verdad, no un par de píxeles', r.dondeIba > 200,
    r.dondeIba + ' px');
  P('y al volver a la ficha sigue ahí, no arriba del todo',
    Math.abs((r.dondeVuelve || 0) - (r.dondeIba || 0)) <= 4,
    'iba en ' + r.dondeIba + ' px · volvió a ' + r.dondeVuelve + ' px');

  console.log('\n  -- por dónde van los cortes, sobre el plano --');
  P('el bloque ofrece verlas en el mapa', r.hayBotonCortes);
  P('se dibujan las dos líneas', r.rumbos.length===2, r.rumbos.length+' trazas');
  P('con las cuatro letras en las puntas',
    r.letras.join('') === 'AA′BB′', r.letras.join(' '));
  {
    /* Cada línea tiene que ir hacia donde su propio rótulo dice. Que un corte
       rotulado «de occidente a oriente» se dibuje de norte a sur es el error
       que dejaría al estudiante situando el perfil al revés. */
    const rumboDe = (e) => /occidente a oriente/i.test(e) ? 'OE'
                         : /oriente a occidente/i.test(e) ? 'EO'
                         : /norte a sur/i.test(e) ? 'NS'
                         : /sur a norte/i.test(e) ? 'SN' : '?';
    const dibujado = (d) => Math.abs(d.dLng) > Math.abs(d.dLat)
      ? (d.dLng > 0 ? 'OE' : 'EO') : (d.dLat < 0 ? 'NS' : 'SN');
    const pares = r.etiquetas.map((e,i)=>({ e, esperado: rumboDe(e),
      real: r.rumbos[i] ? dibujado(r.rumbos[i]) : '—' }));
    P('cada línea va hacia donde dice su rótulo',
      pares.length === 2 && pares.every(x => x.esperado !== '?' && x.esperado === x.real),
      pares.map(x=>x.e.replace(/\s*\(.*/,'')+': dice '+x.esperado+', va '+x.real).join(' · '));
  }
  P('y se pueden quitar', r.letrasTrasQuitar===0, r.letrasTrasQuitar+' letras después');

  console.log('\n  -- cortar por donde uno diga --');
  P('el bloque lo ofrece', r.hayBotonCortar);
  P('y guía los dos toques, uno por uno',
    r.barraCorte && r.pideEmpezar && r.pideTerminar,
    r.pideEmpezar ? 'primero dónde empieza, después dónde termina' : 'no guía');
  P('sale un corte con cotas de verdad, no una raya',
    r.cortesAMano===1 && r.cotasNuevas>=12 && r.largoNuevo>100,
    r.cotasNuevas+' cotas en '+r.largoNuevo+' m');
  P('con la letra que sigue a las del motor', r.letraNueva==='C–C′', r.letraNueva);
  P('y su rumbo escrito como los otros dos', r.suenaIgual, r.etiquetaNueva);
  P('la barra se cierra sola al segundo toque', r.barraTrasCortar===false);
  P('aparece en la ficha como un corte más', r.enLaFicha);
  P('el segundo corte es la D', r.letras2==='CD', r.letras2);
  P('se pueden quitar de a uno, y la letra libre se reutiliza',
    r.letrasTrasBorrar==='D', 'quedó: '+r.letrasTrasBorrar);

  console.log('');
  P('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
