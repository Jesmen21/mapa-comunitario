const E = require('../entorno.js');
/* Tanda X · el día de campo, sin señal.

   Cuarenta estudiantes salen a un barrio con el sector ya preparado en casa
   y allá no hay datos. Ese es el escenario con el coste de fallo más alto de
   toda la aplicación: si algo se rompe, se rompe con el curso entero parado
   en una esquina, y no hay manera de arreglarlo hasta el lunes.

   Hasta ahora se comprobaba por partes —las teselas en `tsinsenal`, lo
   intangible en `tintangible`, el corte en `tterreno`— pero cada una con la
   red puesta. Nadie recorría la secuencia completa con la red cortada, que
   es la única forma en que se va a usar de verdad.

   La secuencia es la real, en el orden en que ocurre:

     EN CASA, con wifi: dibujar el sector, analizarlo, medir el terreno,
     guardar el mapa para llevárselo y guardar la ficha.

     SE CORTA LA RED. Se cierra la aplicación —eso es lo que hace un teléfono
     en el bolsillo— y se vuelve a abrir en la calle.

     EN CAMPO: retomar el sector, marcar lo que solo se ve caminando, cortar
     el terreno por donde importa, y sacar el PDF.

   Lo que se vigila no es que «funcione»: es que cada paso haga lo suyo SIN
   red, y que lo que no se pueda hacer lo diga en vez de fingir un cero.   */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},
           {lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
// Una ladera: sube hacia el norte, para que el corte tenga algo que contar.
const cotaDe=(lat,lng)=>Math.round(280 + (lat-(C.lat-L))*110540*0.06 + (lng-(C.lng-L))*100);
const usos=[]; let id=1;
for(let i=0;i<50;i++){ const a=i*7*Math.PI/180, d=(120+(i%6)*60)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school','bank'][i%4]}}); }

let hayRed = true;
const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:412,height:915},
    isMobile:true,hasTouch:true,locale:'es-CO',timezoneId:'America/Bogota'});
  await ctx.addInitScript(m=>{window.__URBIS_MOTOR=m;},E.MOTOR);
  await ctx.addInitScript(()=>{try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'u',rol:'admin',
      es_admin:true,session_token:'t',active:true,verified:true}));
    /* Se limpia UNA sola vez, en el primer arranque. Hacerlo en cada carga
       borraba la ficha justo en la recarga que simula cerrar la aplicación,
       y la prueba medía un teléfono con la memoria en blanco en vez de uno
       que llega al barrio con el sector preparado. */
    if(!localStorage.getItem('__campo_limpio')){
      localStorage.removeItem('aia_overpass_cache_v1');
      localStorage.removeItem('pcr_fichas_v1');
      localStorage.setItem('__campo_limpio','1');
    }
  }catch(e){}});

  /* El servidor estático SIEMPRE contesta: la aplicación está instalada en el
     teléfono y sus archivos no dependen de la red. Todo lo demás —el motor,
     OpenStreetMap, el servicio de alturas— se corta con `hayRed`. */
  await ctx.route('**', r=>{
    const u=r.request().url();
    if(/localhost:8199/.test(u)) return r.continue();
    if(/unpkg\.com/.test(u)) return r.fulfill({status:200,
      contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});
    if(!hayRed) return r.abort('internetdisconnected');
    if(/localhost:8787/.test(u)) return r.continue();
    if(/api\.open-meteo\.com\/v1\/elevation/.test(u)){
      const q=new URL(u).searchParams;
      const lats=(q.get('latitude')||'').split(',').map(Number);
      const lngs=(q.get('longitude')||'').split(',').map(Number);
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({elevation:lats.map((la,i)=>cotaDe(la,lngs[i]))})});
    }
    if(/overpass/.test(u)) return r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elements:usos})});
    if(/locationiq/.test(u)) return r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({address:{city:'Cúcuta',state:'Norte de Santander'}})});
    if(/ags\.esri\.co/.test(u)) return r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})});
    if(/script\.google\.com/.test(u)) return r.fulfill({status:200,
      contentType:'application/json',body:'{"ok":true,"data":[]}'});
    r.abort();
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,110)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);

  // ══ EN CASA, CON WIFI ═══════════════════════════════════════════════════
  const casa = await pg.evaluate(async (D)=>{
    const {C,POL}=D, esperar=ms=>new Promise(r=>setTimeout(r,ms)), o={};
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],16); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng));
    A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1600);
    const H=()=>document.getElementById('pcr-hoja');
    const ag=()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a) a.click(); };
    ag(); await esperar(400);
    o.analizado = /usos registrados|usos en el sector/.test(H().textContent||'') ||
                  (R.htmlDeLaFicha ? R.htmlDeLaFicha().length > 2000 : false);
    // medir el terreno: es lo que hace posible cortar en campo
    const bt=H().querySelector('[data-pcr="terreno"]');
    if(bt){ bt.click(); for(let i=0;i<60;i++){ await esperar(300);
      if(!/Midiendo/.test(H().textContent||'')) break; } }
    await esperar(500); ag(); await esperar(300);
    o.terrenoMedido = !!R.terrenoDePrueba();
    // y guardar la ficha, que es lo que se lleva
    const bg=[...H().querySelectorAll('button')].filter(x=>/Guardar/i.test(x.textContent||''))[0];
    if(bg){ window.prompt=()=>'Sector de campo'; bg.click(); await esperar(700); }
    o.fichas=(R.leerFichas?R.leerFichas():[]).length;
    return o;
  },{C,POL});

  // ══ SE CORTA LA RED Y SE CIERRA LA APP ═════════════════════════════════
  hayRed = false;
  await pg.reload({waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);

  const campo = await pg.evaluate(async (D)=>{
    const {C}=D, esperar=ms=>new Promise(r=>setTimeout(r,ms)), o={};
    const R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    R.abrir(); await esperar(500);
    const H=()=>document.getElementById('pcr-hoja');
    const ag=()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a) a.click(); };
    ag(); await esperar(400);
    const t=()=>(H().textContent||'');

    o.sobrevive=(R.leerFichas?R.leerFichas():[]).length;
    // 1 · retomar el sector preparado
    o.ofreceReanudar=!!H().querySelector('[data-pcr="reanudar"]');
    const br=H().querySelector('[data-pcr="reanudar"]');
    if(br){ br.click(); await esperar(1000); ag(); await esperar(400); }
    o.terrenoVolvio=!!R.terrenoDePrueba();

    // 2 · marcar lo que solo se ve caminando
    const lap=[...H().querySelectorAll('[data-pcr="int-dibujar"]')][0];
    o.hayLapiz=!!lap;
    if(lap){ lap.click(); await esperar(500);
      const d=0.0004;
      [[d,d],[d,-d],[-d,-d]].forEach(q=>window.map.fire('click',
        {latlng:{lat:C.lat+q[0], lng:C.lng+q[1]}}));
      await esperar(400);
      const listo=document.querySelector('[data-int="cerrar"]');
      if(listo){ listo.click(); await esperar(700); }
      ag(); await esperar(300);
    }
    o.marcas=(R.intangibleDePrueba?R.intangibleDePrueba().length:
      (/1 marca|marcas/.test(t())?1:0));

    // 3 · cortar el terreno por donde importa
    const bn=H().querySelector('[data-pcr="corte-nuevo"]');
    o.hayCorte=!!bn;
    if(bn){ bn.click(); await esperar(400);
      window.map.fire('click',{latlng:{lat:C.lat-0.002,lng:C.lng-0.002}});
      await esperar(250);
      window.map.fire('click',{latlng:{lat:C.lat+0.002,lng:C.lng+0.002}});
      await esperar(800); ag(); await esperar(300); }
    const ter=R.terrenoDePrueba();
    o.corteAMano=!!(ter && (ter.perfiles||[]).some(x=>x.aMano));
    o.corteConCotas=(function(){
      const p=ter && (ter.perfiles||[]).filter(x=>x.aMano)[0];
      return p ? (p.puntos||[]).length : 0;
    })();

    // 4 · el PDF, que es lo que se entrega
    let capturado='';
    window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ capturado=h; };
    const bp=[...H().querySelectorAll('button')].filter(x=>/PDF|informe/i.test(x.textContent||''))[0];
    if(bp){ bp.click(); await esperar(1100); }
    o.pdf=capturado.length;
    o.pdfTraeElCorte=/C–C′/.test(capturado);
    o.pdfTraeAA=/A–A′/.test(capturado);
    o.pdfSeccionTerreno=/El terreno<\/h2>|>El terreno</.test(capturado);

    // 5 · y lo que NO se puede hacer sin red, lo dice
    ag(); await esperar(200);
    const bc=H().querySelector('[data-pcr="clima"]');
    if(bc){ bc.click(); for(let i=0;i<25;i++){ await esperar(300);
      if(!/Consultando/.test(t())) break; } }
    await esperar(400); ag(); await esperar(300);
    o.avisaSinRed=/no se pudo|sin conexión|sin señal|revisá tu conexión|Failed|error/i.test(t());
    o.noInventaCeros=!/0 °C|0 mm al año/.test(t());
    return o;
  },{C});

  const errReales=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  console.log('\n  -- en casa, con wifi --');
  T('el sector se analiza', casa.analizado);
  T('el terreno se mide', casa.terrenoMedido);
  T('y la ficha queda guardada', casa.fichas===1, casa.fichas+' ficha(s)');

  console.log('\n  -- se corta la red y se cierra la app --');
  T('la ficha sobrevive al cierre', campo.sobrevive===1, campo.sobrevive+' ficha(s)');
  T('y la hoja ofrece retomarla', campo.ofreceReanudar);
  T('con el terreno que se midió en casa', campo.terrenoVolvio);

  console.log('\n  -- en campo, sin una barra de señal --');
  T('se puede marcar lo que solo se ve caminando', campo.hayLapiz && campo.marcas>0,
    campo.marcas+' marca(s)');
  /* El corte es la prueba de fuego del diseño: se calcula en el teléfono con
     las cotas guardadas justamente para que exista este momento. */
  T('se puede cortar el terreno por donde importa', campo.hayCorte && campo.corteAMano,
    campo.corteConCotas+' cotas en el corte nuevo');
  T('y sale el PDF que se entrega', campo.pdf>2000, Math.round(campo.pdf/1024)+' KB');
  T('con los cortes del sector, incluido el nuevo',
    campo.pdfTraeAA && campo.pdfTraeElCorte,
    'A–A′: '+(campo.pdfTraeAA?'sí':'NO')+' · C–C′: '+(campo.pdfTraeElCorte?'sí':'NO')+
    ' · sección del terreno: '+(campo.pdfSeccionTerreno?'sí':'no'));

  console.log('\n  -- y lo que no se puede, lo dice --');
  T('pedir el clima sin red avisa en vez de callarse', campo.avisaSinRed);
  T('y no inventa un cero con cara de medición', campo.noInventaCeros);

  console.log('');
  T('sin errores de JavaScript', errReales.length===0, errReales.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
