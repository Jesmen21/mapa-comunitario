const E = require('../entorno.js');
/* Tanda V · la amenaza sísmica.

   La maqueta NO es inventada: es la respuesta literal que el Servicio
   Geológico Colombiano dio sobre el centro de Cúcuta el 4 de septiembre de
   2026, capturada con la sonda de herramientas/sonda-datos.html. Se conserva
   tal cual —con sus espacios en blanco, su `DESAGREGAC` vacío y su acentuación
   rota en las URL de las imágenes— porque de eso se trata: si el servicio
   cambia la forma de contestar, esta prueba tiene que fallar.

   Lo que vigila, en orden de gravedad:

   · Que Aa = 0,35 y Av = 0,25 lleguen a la ficha sin tocarse. Son los dos
     números con los que la NSR-10 arma el espectro; equivocarlos es el peor
     error que podría cometer esta aplicación.
   · Que «Alta» se traduzca a lo que la norma pide —disipación de energía
     especial— y no a otra cosa.
   · Que la conversión de gal a g sea la de la norma y no una regla de tres
     redondeada: 360 gal ÷ 981 = 0,37 g.
   · Que se elija el municipio MÁS CERCANO. La consulta barre cuarenta
     kilómetros y en esa redonda hay varias cabeceras; contestar la de Villa
     del Rosario cuando el sector es Cúcuta sería un error silencioso.
   · Y que en los tres sitios donde sale —ficha, lámina y PDF— se diga que es
     un valor del MUNICIPIO y no del lote. Sin esa frase, el dato es peor que
     no tenerlo.                                                            */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];

// ── La respuesta de verdad del SGC, palabra por palabra ───────────────
const CUCUTA={"OBJECTID":875,"NOMDEPTO":"NORTE DE SANTANDER","NOMMUN":"Cúcuta","NOMCAB":" ",
  "POINT_X":-72.507868,"POINT_Y":7.897548,
  "PGA75":170,"PGA225":270,"PGA475":360,"PGA975":460,"PGA2475":610,
  "ESPECTRO_U":"http://criolita.sgc.gov.co/amenaza-sis/IMG_ESPECTRO/NORTE_DE_SANTANDER%20C%a3cuta.png",
  "CURVAS_DE":"http://criolita.sgc.gov.co/amenaza-sis/IMG_EXCEDENCIA/NORTE_DE_SANTANDER%20C%a3cuta.png",
  "DESAGREGAC":" ","NIVEL":"Alta","AA":0.35,"AV":0.25,"AE":0.25,"AD":0.1,
  "PROYECCION":643666,"TIPO_1":null,"RULEID":1};
/* Un vecino, para comprobar que se elige el más cercano y no el primero de la
   lista. Villa del Rosario está a unos 9 km del centro de Cúcuta, y la
   consulta barre cuarenta: si el código tomara el primero que llega, este
   contestaría por el sector equivocado. Va DE PRIMERO a propósito. */
const VECINO={"OBJECTID":880,"NOMDEPTO":"NORTE DE SANTANDER","NOMMUN":"Villa del Rosario",
  "NOMCAB":" ","POINT_X":-72.4736,"POINT_Y":7.8341,
  "PGA75":160,"PGA225":260,"PGA475":350,"PGA975":450,"PGA2475":600,
  "NIVEL":"Alta","AA":0.30,"AV":0.25,"AE":0.20,"AD":0.1};
/* La capa que existe para servir la NSR-10, también literal. Fijate en Av:
   dice 0,3 donde el mapa de aceleraciones dice 0,25. Esa discrepancia es real
   y está acá para que la aplicación no pueda volver a taparla. Y el nombre
   viene a los gritos, «CÚCUTA», como lo manda el servicio. */
const NSR={"OBJECTID":822,"RULEID":1,"NOMBRE_DEPARTAMENTO":"NORTE DE SANTANDER",
  "CÓDIGO_MUNICIPIO":"54001","NOMBRE_MUNICIPIO":"CÚCUTA","NOMBRE_CENTRO_POBLADO":"CÚCUTA",
  "AA":0.35,"AV":0.3,"ZONA_AMENAZA_SÍSMICA":"Alta","AE":0.25,"AD":0.1,
  "LONGITUD":-72.50559097,"LATITUD":7.90526712};
/* Movimientos en masa. Los cuatro porcentajes crudos suman 100,647 —no cien—
   porque así los publica el servicio, y la ficha tiene que decirlo en vez de
   redondear a cien y fingir una precisión que nadie dio.

   La cifra que se muestra es 100,7 y no 100,6: se suman los porcentajes YA
   REDONDEADOS, que son los que el estudiante tiene delante (0 + 32,8 + 59,2 +
   8,7). Decir «suman 100,6» debajo de cuatro números que suman 100,7 sería
   una discrepancia nueva puesta por nosotros. */
/* La zonificación de intensidad esperada, literal. Se le toman las dos
   PALABRAS y no su campo PGA: publica «9.20-18.0», que no es la aceleración
   de diseño de la NSR-10 y que, puesta al lado de Aa = 0,35, solo puede
   confundir. Está adentro a propósito, para que se compruebe que NO sale. */
const INTENSIDAD={"OBJECTID":822,"CATEGORIA":"M","AREA_KM":1135.85351703,
  "CODIGO_DANE":"54001","DEPARTAMENTO":"Norte de Santander","MUNICIPIO":"Cúcuta",
  "ZONAS_AMENAZA_SISMICA_NSR_10":"Alta","PERCEPCION":"Fuerte","POTENCIAL":"Ligero",
  "PGA":"9.20-18.0"};
const MASA={"OBJECTID":821,"CATEGORIA":"M","AREA_KM":1135.66529446,"CODIGO_DAN":"54001",
  "DEPARTAMEN":"Norte de Santander","MUNICIPIO":"Cúcuta",
  "SUM_BAJA":0,"SUM_MEDIA":32.77987281,"SUM_ALTA":59.15464252,"SUM_MUY_AL":8.71232415};

const usos=[]; let id=1;
for(let i=0;i<14;i++){ const a=i*26*Math.PI/180, d=(160+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }

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
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({elements:usos})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));

  /* El SGC, con sus tres capas. Se guarda cada consulta por separado: parte
     de lo que hay que comprobar es que a cada capa se le pregunte como
     corresponde —por contención al polígono municipal, por cercanía a la
     nube de cabeceras—. */
  const consultas={}; let veces=0;
  await ctx.route(/srvags\.sgc\.gov\.co/, r=>{
    veces++;
    const u=decodeURIComponent(r.request().url());
    let cuerpo;
    if(/Zonas_amenaza_Sismica_NR10/.test(u)){ consultas.nsr=u; cuerpo=[{attributes:NSR}]; }
    else if(/Mov_Masa/.test(u)){ consultas.masa=u; cuerpo=[{attributes:MASA}]; }
    else if(/Intensidad_Sismica_Esperada/.test(u)){ consultas.inten=u;
      cuerpo=[{attributes:INTENSIDAD}]; }
    else { consultas.pga=u; cuerpo=[{attributes:VECINO},{attributes:CUCUTA}]; }
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({features:cuerpo})});
  });

  /* El IDEAM, contestando que no modeló este sitio. Esta suite es del SISMO y
     no le importa el agua, pero desde que las dos se piden con el mismo botón,
     sin esta ruta la inundación se iba por el relevo del motor —que en pruebas
     no tiene salida a internet— y se quedaba esperando hasta agotarse. Sola
     pasaba; con cuatro suites en paralelo, no siempre. Una prueba que depende
     de la carga de la máquina no prueba nada. */
  await ctx.route(/visualizador\.ideam\.gov\.co/, r=>{
    const u=decodeURIComponent(r.request().url());
    r.fulfill({status:200,contentType:'application/json',
      body: /MapServer\?f=json/.test(u)
        ? JSON.stringify({layers:[{id:1,name:'Amenaza Inundacion TR 2 Años Centros Poblados 2K'},
                                  {id:5,name:'Amenaza Inundacion TR 100 Años Centros Poblados 2K'}]})
        : JSON.stringify({count:0})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  // A la condición y no al reloj: ver `esperarLaApp` en pruebas/entorno.js.
  await E.esperarLaApp(pg);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    let capturado='';
    window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    o.hayModulo=!!window.URBIS_AMENAZA;

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    const trozo=(desde,largo)=>{ const t=txt(); const i=t.indexOf(desde); return i<0?'':t.slice(i,i+largo); };
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(400); } };

    // ── Antes de pedirla: la invitación, no un «sin datos».
    o.antes=trozo('La amenaza sísmica',300);

    // ── Pedirla.
    H().querySelector('[data-pcr="amenaza"]').click();
    for(let i=0;i<50 && !/Aa/.test(txt());i++) await esperar(300);
    await esperar(400);
    await abrir();
    // Largo de sobra: con los movimientos en masa adentro, el bloque pasa los
    // dos mil caracteres y las advertencias del final quedaban fuera del
    // trozo — la prueba decía que faltaban y estaban.
    o.ficha=trozo('La amenaza sísmica',4000);
    o.kpis=[...H().querySelectorAll('.pcr-kpi')]
      .map(k=>(k.textContent||'').replace(/\s+/g,' ').trim())
      .filter(t=>/amenaza sísmica|^0,3|^0,2/.test(t));
    o.dibujo=(function(){
      const d=H().querySelector('.pcr-dibujo svg');
      return d?{ hay:true, etq:d.getAttribute('aria-label')||'',
                 puntos:d.querySelectorAll('circle').length }:{hay:false};
    })();
    // Lo que devolvió el módulo, crudo.
    o.crudo=(function(){
      try{ const e=R.estado(); return null; }catch(e){ return null; }
    })();
    o.copiado='';
    H().querySelector('[data-pcr="amenaza-texto"]').click(); await esperar(400);
    await abrir();
    o.copiado=(function(){
      const c=H().querySelector('.pcr-texto,textarea,pre');
      return c?(c.textContent||c.value||''):'';
    })();

    // ── El pliego la conoce.
    await abrir();
    o.enElPliego=(function(){
      const b=H().querySelector('[data-pcr="pliego-caja"][data-c="la-amenaza-sismica"]');
      return b?{ gris:b.classList.contains('pcr-capa-gris'),
                 pie:((b.querySelector('small')||{}).textContent||'').trim() }:null;
    })();

    // ── El papel.
    await abrir();
    H().querySelector('[data-pcr="lamina"]').click(); await esperar(900);
    o.lamina=capturado; capturado='';
    await abrir();
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(900);
    o.pdf=capturado; capturado='';

    // ── Y viaja con la ficha.
    o.guardado=(function(){
      try{ const f=(R.leerFichas()||[])[0];
        return f&&f.amenaza?{ municipio:f.amenaza.municipio, aa:f.amenaza.aa,
                              av:f.amenaza.av, nivel:f.amenaza.nivel,
                              masa:!!(f.amenaza.masa) }:null;
      }catch(e){ return null; }
    })();
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const LAM=r.lamina||'', PDF=r.pdf||'', F=r.ficha||'';

  console.log('\n  -- las tres consultas --');
  T('el módulo está cargado', r.hayModulo===true);
  T('sin pedirla, el bloque invita en vez de decir «sin datos»',
    /coeficientes/.test(r.antes) && /NSR-10/.test(r.antes));
  T('se piden las cuatro capas de una vez, y una sola vez cada una',
    veces===4 && consultas.nsr && consultas.pga && consultas.masa && consultas.inten,
    veces+' consultas');
  T('los coeficientes, a la capa que existe para servir la norma',
    /Zonas_amenaza_Sismica_NR10/.test(consultas.nsr||''));
  /* Contención y no distancia: la capa es de polígonos municipales, así que
     la pregunta exacta es «¿dentro de cuál cae este punto?». Con `distance`
     se estaría preguntando otra cosa. */
  T('preguntándole por contención, no por cercanía',
    !/distance=/.test(consultas.nsr||''));
  T('la curva, a la capa de 475 años, que es la de diseño',
    /Mapa_Amenaza_Sismica_Nacional_PGA475/.test(consultas.pga||''));
  T('esa sí por cercanía, porque es una nube de cabeceras',
    /distance=40000/.test(consultas.pga||''));
  T('y los deslizamientos, al mapa nacional de movimientos en masa',
    /Mov_Masa/.test(consultas.masa||'') && !/distance=/.test(consultas.masa||''));
  /* Sin `resultRecordCount`: varias capas de este servidor contestan
     «Pagination is not supported» y se caen enteras. Lo descubrió la sonda. */
  T('ninguna con paginación, que es lo que tumba a este servidor',
    !/resultRecordCount/.test(JSON.stringify(consultas)));

  console.log('\n  -- las cifras de la norma --');
  T('elige el municipio más cercano y no el primero de la lista',
    /Cúcuta/.test(F) && !/Villa del Rosario/.test(F),
    (F.match(/Referido a [^(]*/)||['no lo dice'])[0]);
  /* Contra los KPI y no contra el texto corrido de la hoja: ahí los valores
     salen pegados a su etiqueta —«0,35Aa»— y un límite de palabra entre la
     coma y la A no existe. Mirando la tarjeta se comprueba además que el
     número está donde el ojo lo va a buscar. */
  /* Coincidencia exacta y no por prefijo: «0,3» también es el principio de
     «0,35», así que buscar por prefijo devolvía la tarjeta de Aa cuando se
     preguntaba por la de Av. */
  const kpi = etq => (r.kpis||[]).filter(k=>k===etq)[0]||'';
  T('Aa llega intacto y va en su tarjeta', kpi('0,35Aa')==='0,35Aa', (r.kpis||[]).join(' · '));
  /* 0,3 y no 0,25: manda la capa normativa. Si alguien volviera a leer Av del
     mapa de aceleraciones, esta línea lo caza — y es justo el número que
     define la rama de periodo largo del espectro. */
  T('Av se toma de la capa normativa, no del mapa de aceleraciones',
    kpi('0,3Av')==='0,3Av' && !kpi('0,25Av'), (r.kpis||[]).join(' · '));
  T('y la discrepancia entre las dos capas se dice, no se tapa',
    /no coinciden en/.test(F) && /Av/.test(F) && /A.2.3-2/.test(F),
    (F.match(/Las dos capas del SGC no coinciden[^.]*\./)||['no lo dice'])[0]);
  T('el nombre del municipio deja de venir a los gritos',
    /Cúcuta/.test(F) && !/CÚCUTA/.test(F));
  T('el nivel es el que dijo el servicio', /Alta/.test(F));
  T('y se traduce a lo que la norma pide',
    /disipación de energía especial/.test(F),
    (F.match(/La norma pide[^.]*\./)||['no lo traduce'])[0]);
  /* 360 ÷ 981 = 0,367 → 0,37 g. Si alguien «simplificara» dividiendo por
     1000, saldría 0,36 y la prueba lo caza. */
  T('la conversión de gal a g es la de la norma',
    /Cada 475 años360 gal · 0,37 g/.test(F.replace(/\s+/g,' ').replace(/ (gal|·)/g,' $1')) ||
    /360 gal · 0,37 g/.test(F),
    (F.match(/Cada 475 años[\d]* gal · [\d,]+ g/)||['(no está tal cual)'])[0]);
  T('están los cinco periodos de retorno',
    ['75','225','475','975','2475'].every(t=>new RegExp('Cada '+t+' años').test(F)));
  T('y los coeficientes de los otros dos estados límite',
    /umbral de daño/.test(F) && /seguridad limitada/.test(F));

  console.log('\n  -- lo que hay que decir siempre --');
  T('la ficha avisa que es del municipio y no del lote',
    /valor del municipio, no del lote/i.test(F));
  T('y que una microzonificación mandaría sobre esto', /microzonificación/.test(F));
  T('y que no dimensiona nada: eso lo decide un ingeniero',
    /ingeniero/.test(F));
  T('la lámina lo repite', /no del lote/.test(LAM) && /microzonificación/.test(LAM));
  T('y el PDF también', /no al lote/.test(PDF) && /microzonificación/.test(PDF));
  T('los tres nombran la fuente',
    /Servicio Geológico Colombiano/.test(F) &&
    /Servicio Geológico Colombiano/.test(LAM) &&
    /Servicio Geológico Colombiano/.test(PDF));

  console.log('\n  -- dibujada --');
  T('la curva se dibuja en la ficha', r.dibujo.hay===true);
  T('con un punto por periodo de retorno', (r.dibujo.puntos||0)===5, r.dibujo.puntos+' puntos');
  T('y una descripción para quien no la ve',
    /periodo de retorno/.test(r.dibujo.etq||'') && /475 años, 360 gal/.test(r.dibujo.etq||''),
    r.dibujo.etq);
  T('la lámina la lleva también',
    /<h2>La amenaza sísmica<\/h2>/.test(LAM) && /años de periodo de retorno/.test(LAM));

  console.log('\n  -- cómo se siente, en palabras --');
  /* «Aa = 0,35» no le dice nada a alguien de primer año; «se siente fuerte,
     con daño ligero» sí, y es la misma amenaza contada de la única manera que
     se puede llevar a una discusión de taller. */
  T('la ficha lo dice en palabras',
    /se siente fuerte/.test(F) && /potencial de daño ligero/.test(F),
    (F.match(/Un sismo acá[^.]{0,70}/)||['no lo dice'])[0]);
  /* Y NO se muestra el PGA de esa capa: publica «9.20-18.0», que no es la
     aceleración de diseño y que al lado de Aa = 0,35 solo puede confundir.
     Dos cifras distintas para lo que parece lo mismo es peor que una sola. */
  T('sin colar su PGA, que es otra medida y confundiría',
    !/9,20|9\.20|18,0-|9\.20-18/.test(F));
  T('la lámina lo lleva', /Cómo se siente un sismo acá/.test(LAM) && /Fuerte/.test(LAM));
  T('el PDF también, con las dos filas',
    /Cómo se percibe un sismo/.test(PDF) && /Potencial de daño esperado/.test(PDF));
  T('y nombra de dónde salió', /intensidad esperada/.test(PDF));

  console.log('\n  -- movimientos en masa --');
  T('sale el reparto del municipio', /amenaza alta o muy alta/.test(F),
    (F.match(/[\d,]+% del municipio de [^ ]+ está/)||['no está'])[0]);
  T('con los cuatro escalones', /32,8% media/.test(F) && /59,2% alta/.test(F) &&
    /8,7% muy alta/.test(F));
  T('sumando 67,9 en alta o muy alta', /67,9/.test(F));
  T('se dice a las claras que NO habla del lote',
    /no dice nada de este lote/.test(F) && /1:100.000/.test(F));
  T('y que los porcentajes del servicio no cuadran a cien',
    /suman 100,7%/.test(F),
    (F.match(/suman [\d,]+%/)||['no lo dice'])[0]);
  T('se cruza con la pendiente, que es lo único medido del sitio',
    /medí el terreno y volvé acá/.test(F) || /lo que sí está medido es la pendiente/.test(F),
    (F.match(/pendiente[^.]{0,60}\./)||['no lo cruza'])[0]);
  T('la lámina lo resume en una línea',
    /amenaza alta o muy alta por deslizamiento/.test(LAM));
  T('y el PDF le da su propia tabla',
    /<h3>Movimientos en masa<\/h3>/.test(PDF) && /% del municipio/.test(PDF));

  console.log('\n  -- en el resto de la aplicación --');
  T('el PDF trae la sección con Aa y Av',
    /<h2>La amenaza sísmica<\/h2>/.test(PDF) && /aceleración horizontal pico efectiva/.test(PDF));
  T('el pliego la ofrece, ya lista', !!r.enElPliego && r.enElPliego.gris===false,
    r.enElPliego?r.enElPliego.pie:'no está en el inventario');
  T('viaja con la ficha, para no volver a esperar al SGC',
    !!r.guardado && r.guardado.aa===0.35 && /Cúcuta/.test(r.guardado.municipio||''),
    r.guardado?JSON.stringify(r.guardado):'no se guardó');
  T('y el deslizamiento va con ella', !!r.guardado && r.guardado.masa===true);

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
