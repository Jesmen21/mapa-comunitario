const E = require('../entorno.js');
/* Sonda de datos · la parte que habla GeoServer.

   La sonda de ArcGIS se probó sola: se corrió contra los servidores de verdad
   y la salida real fue la prueba. Con GeoServer eso no alcanza, por dos
   razones. Una, que los candidatos del IDEAM pueden estar caídos el día que
   alguien corra esto, y una herramienta que solo funciona cuando el servidor
   ajeno está vivo no se puede arreglar con confianza. Y dos, que acá SÍ hay
   lógica: se lee XML, se distinguen capas de carpetas y se arma una caja de
   coordenadas cuyo orden es un campo minado.

   Así que se monta un GeoServer de mentira que contesta como los de verdad, y
   se comprueba lo que de otro modo se descubriría tarde:

   · Que las carpetas —las capas sin <Name>— no se ofrezcan como consultables.
   · Que el orden de la caja en WFS 2.0 se pruebe en los DOS sentidos. La
     norma dice latitud, longitud; media implementación lo hace al revés.
     Acá el servidor de mentira solo acepta el de la norma, y la sonda tiene
     que llegar a él.
   · Que cuando el WFS no está, se caiga al GetFeatureInfo del WMS en vez de
     rendirse.
   · Y que una excepción XML se lea y se muestre, en vez de decir «no es
     JSON», que no le sirve a nadie.                                       */
const {chromium}=require(E.MODULOS + '/playwright-core');

const CAPACIDADES = `<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms">
 <Capability>
  <Layer>
   <Title>Carpeta raíz sin nombre, que no se puede pedir</Title>
   <Layer queryable="1">
    <Name>ideam:amenaza_inundacion</Name>
    <Title>Amenaza por inundación</Title>
    <EX_GeographicBoundingBox>
     <westBoundLongitude>-79</westBoundLongitude>
     <eastBoundLongitude>-66</eastBoundLongitude>
     <southBoundLatitude>-4</southBoundLatitude>
     <northBoundLatitude>13</northBoundLatitude>
    </EX_GeographicBoundingBox>
   </Layer>
   <Layer queryable="1">
    <Name>ideam:zonas_inundables_historico</Name>
    <Title>Zonas inundables, histórico</Title>
   </Layer>
   <Layer queryable="1">
    <Name>ideam:ronda_hidrica</Name>
    <Title>Ronda hídrica de protección</Title>
   </Layer>
   <Layer>
    <Title>Coberturas de la tierra (agrupador de amenaza, sin Name)</Title>
   </Layer>
   <Layer queryable="1">
    <Name>ideam:estaciones</Name>
    <Title>Estaciones hidrológicas</Title>
   </Layer>
  </Layer>
 </Capability>
</WMS_Capabilities>`;

const EXCEPCION = `<?xml version="1.0"?>
<ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows/1.1">
 <ows:Exception exceptionCode="InvalidParameterValue">
  <ows:ExceptionText>Illegal property name: no existe esa capa en WFS</ows:ExceptionText>
 </ows:Exception>
</ows:ExceptionReport>`;

const REGISTRO = { type:'FeatureCollection', features:[
  { type:'Feature', properties:{ CATEGORIA:'Alta', FUENTE:'IDEAM 2021',
                                 AREA_HA:1240.5, MUNICIPIO:'Cúcuta' } },
  { type:'Feature', properties:{ CATEGORIA:'Media', FUENTE:'IDEAM 2021',
                                 AREA_HA:880.1, MUNICIPIO:'Cúcuta' } }
]};

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:412,height:915},serviceWorkers:'block'});

  // Qué se le preguntó al servidor de mentira, para poder mirarlo después.
  const pedidos=[];
  await ctx.route('**', r=>/localhost:8199/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/geoserver-de-mentira/, r=>{
    const u=decodeURIComponent(r.request().url());
    pedidos.push(u);
    const json=(d)=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
    const xml=(t)=>r.fulfill({status:200,contentType:'text/xml',body:t});

    if(/request=GetCapabilities/i.test(u)) return xml(CAPACIDADES);

    if(/request=GetFeature\b/i.test(u)){
      /* Este servidor solo acepta el orden de la NORMA: latitud primero. La
         caja llega como «bbox=minA,minB,maxA,maxB,urn:...»; si el primer par
         está cerca de 7,89 es latitud —bien—, y si está cerca de -72,5 es
         longitud —mal—, y contesta la excepción que contestaría uno de
         verdad. */
      const m=u.match(/bbox=([-\d.]+),([-\d.]+),/);
      const esLatPrimero = m ? Math.abs(Number(m[1])) < 60 : false;
      /* Tres capas, tres comportamientos, para recorrer los tres caminos:
         · la de amenaza acepta el orden de la NORMA (latitud primero);
         · la de zonas inundables solo acepta el orden AL REVÉS, que es lo que
           hace media implementación — obliga al segundo intento;
         · la de ronda hídrica no está publicada en WFS — obliga a caer al
           GetFeatureInfo del WMS. */
      if(/amenaza_inundacion/.test(u)) return esLatPrimero ? json(REGISTRO) : xml(EXCEPCION);
      if(/zonas_inundables/.test(u))   return esLatPrimero ? xml(EXCEPCION) : json(REGISTRO);
      return xml(EXCEPCION);
    }

    if(/request=GetFeatureInfo/i.test(u)){
      return json({ type:'FeatureCollection', features:[
        { type:'Feature', properties:{ CODIGO:'ES-4501', NOMBRE:'Puente Cúcuta' } }]});
    }
    return xml(EXCEPCION);
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/herramientas/sonda-datos.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(700);

  /* Tres direcciones: la que anda, una cuyo dominio contesta pero no deja
     leer —CORS cerrado—, y una que no existe. Los tres rojos se ven idénticos
     desde JavaScript, y son tres arreglos distintos: pasar la consulta por el
     motor, esperar, o buscar la dirección buena. Que la sonda los separe es
     lo que convierte un «no se pudo» en algo accionable. */
  await ctx.route(/geoserver-con-cors-cerrado/, r=>{
    // Llega, contesta, pero sin cabeceras que dejen leerlo. Para `no-cors`
    // eso es una respuesta válida y opaca; para `fetch` normal, un fallo.
    if(r.request().headers()['sec-fetch-mode']==='no-cors' ||
       r.request().headers()['origin']===undefined){
      return r.fulfill({status:200,contentType:'text/xml',body:'<x/>'});
    }
    return r.abort('failed');
  });
  await ctx.route(/geoserver-que-no-existe/, r=>r.abort('addressunreachable'));

  /* ── El relevo del motor ────────────────────────────────────────────────
     Tres servicios de ArcGIS de mentira, cada uno para una respuesta distinta
     del relevo:

       arcgis-cors-cerrado   el navegador no puede leerlo, el relevo sí
       arcgis-con-token      contesta «Token Required» — el relevo NO ayuda
       arcgis-abierto        se lee directo — el relevo NO debe tocarse

     El segundo y el tercero son la mitad que importa: un relevo que se dispara
     siempre convierte cada consulta en dos y le manda a nuestro servidor
     trabajo que no arregla nada. */
  const SERVICIO_POT={serviceDescription:'Clasificacion del suelo POT',
    layers:[{id:0,name:'Clasificacion del Suelo'}]};
  const CAPA_POT={geometryType:'esriGeometryPolygon',minScale:0,maxScale:0,
    fields:[{name:'OBJECTID',type:'esriFieldTypeOID'},
            {name:'MUNICIPIO',type:'esriFieldTypeString'},
            {name:'CLASE',type:'esriFieldTypeString'}]};
  const respuestaArcgis=(u)=>/\/0(\?|$)/.test(u.split('/query')[0])||/\/0\?f=json/.test(u)
    ? CAPA_POT : SERVICIO_POT;

  let relevosPedidos=[];
  await ctx.route(/arcgis-cors-cerrado/, r=>r.abort());
  await ctx.route(/arcgis-con-token/, r=>r.fulfill({status:200,
    contentType:'application/json',
    body:JSON.stringify({error:{message:'Token Required',code:499}})}));
  await ctx.route(/arcgis-vacio/, r=>r.fulfill({status:200,
    contentType:'application/json',
    body:JSON.stringify({serviceDescription:'Clasificacion del suelo POT',layers:[]})}));
  await ctx.route(/arcgis-abierto/, r=>r.fulfill({status:200,
    contentType:'application/json',
    body:JSON.stringify(respuestaArcgis(decodeURIComponent(r.request().url())))}));
  await ctx.route(/api\.urbispro\.city\/geo/, r=>{
    const u=decodeURIComponent(new URL(r.request().url()).searchParams.get('u')||'');
    relevosPedidos.push(u);
    if(/arcgis-cors-cerrado/.test(u)){
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({ok:true,de:'https://arcgis-cors-cerrado.gov.co',
          datos:respuestaArcgis(u)})});
    }
    r.fulfill({status:400,contentType:'application/json',
      body:JSON.stringify({ok:false,error:'Ese dominio no está en la lista del relevo.'})});
  });

  await pg.fill('#ogc','https://geoserver-de-mentira.gov.co/geoserver/ows\n' +
    'https://geoserver-con-cors-cerrado.gov.co/geoserver/ows\n' +
    'https://geoserver-que-no-existe.gov.co/geoserver/ows');
  await pg.click('#explorar-ogc');
  await pg.waitForFunction(()=>/Listo/.test(document.getElementById('estado').textContent),
    {timeout:120000});

  /* Cada corrida EMPIEZA el informe de nuevo, así que el del GeoServer hay
     que guardarlo antes de correr la caja 2. Escribir las dos aserciones
     contra el segundo informe dejaba trece comprobaciones mirando una hoja
     vacía y pasando por otra razón. */
  const ogc = await pg.evaluate(()=>({
    informe:document.getElementById('informe').textContent,
    hallazgos:[...document.querySelectorAll('.hallazgo')].map(h=>({
      texto:(h.textContent||'').replace(/\s+/g,' ').trim(),
      marca:(h.querySelector('.marca')||{}).textContent||''
    }))
  }));

  /* La caja 2, que es la que examina direcciones sueltas. */
  await pg.fill('#suelto','https://arcgis-cors-cerrado.gov.co/server/rest/services/pot/MapServer\n' +
    'https://arcgis-con-token.gov.co/server/rest/services/pot/MapServer\n' +
    'https://arcgis-abierto.gov.co/server/rest/services/pot/MapServer\n' +
    'https://arcgis-vacio.gov.co/server/rest/services/pot/MapServer');
  await pg.click('#examinar');
  await pg.waitForFunction(()=>/Listo/.test(document.getElementById('estado').textContent),
    {timeout:120000});

  const r=await pg.evaluate(()=>({
    informe:document.getElementById('informe').textContent,
    hallazgos:[...document.querySelectorAll('.hallazgo')].map(h=>({
      texto:(h.textContent||'').replace(/\s+/g,' ').trim(),
      marca:(h.querySelector('.marca')||{}).textContent||''
    }))
  }));
  const errFin=err.filter(e=>!/Unexpected end/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const I=ogc.informe||'';            // el del GeoServer
  const J=r.informe||'';              // el de la caja 2, donde vive el relevo
  const conCapa=q=>ogc.hallazgos.filter(h=>h.texto.indexOf(q)>=0)[0];

  console.log('\n  -- lee las capacidades --');
  T('pide el documento de capacidades en WMS 1.3.0',
    pedidos.some(u=>/service=WMS&version=1.3.0&request=GetCapabilities/.test(u)));
  T('y cuenta las capas que encontró', /CAPAS: 4/.test(I),
    (I.match(/CAPAS: \d+/)||['no lo dice'])[0]);
  /* Cuatro y no seis: el XML trae seis <Layer>, pero dos son carpetas —la
     raíz y un agrupador— y una carpeta no se puede pedir. Ofrecerla mandaría
     al estudiante contra una excepción del servidor. */
  T('sin contar las carpetas, que no se pueden pedir',
    !/agrupador de amenaza/.test(I) && !/Carpeta raíz/.test(I) && /CAPAS: 4/.test(I));
  /* Tres, no dos: «zonas inundables» solo entra si la palabra buscada es
     `inunda` y no `inundación`, y la ronda hídrica solo si se busca `ronda`.
     Así se nombran de verdad estas capas en Colombia, y buscarlas por la
     palabra entera las dejaba fuera sin que nada lo dijera. */
  T('caza las tres que hablan de agua, incluidas las que no dicen «inundación»',
    /DE INTERÉS: 3/.test(I) && /zonas_inundables/.test(I) && /ronda_hidrica/.test(I),
    (I.match(/DE INTERÉS: \d+/)||['no lo dice'])[0]);
  T('y deja fuera lo que no viene al caso', !/DE INTERÉS[\s\S]*✔ ideam:estaciones/.test(I));
  T('y muestra hasta dónde llega cada una',
    /cubre de -79, -4 a -66, 13/.test(I),
    (I.match(/cubre de [^\n]+/)||['no lo dice'])[0]);

  console.log('\n  -- el orden de la caja, que es el campo minado --');
  /* En WFS 2.0 con EPSG:4326 la norma manda latitud primero, y media
     implementación lo hace al revés. La sonda prueba los dos; el servidor de
     mentira solo acepta el de la norma. */
  T('con una capa que quiere el orden de la norma, acierta a la primera',
    /caja en latitud\/longitud[^\n]*2 registro/.test(I),
    (I.match(/✔ WFS 2\.0, caja en latitud[^\n]+/)||['no lo logró'])[0]);
  /* Y con una que lo quiere al revés, no se rinde en el primer intento: es el
     caso más común y el más fácil de dar por perdido. */
  T('y con una que lo quiere al revés, insiste y acierta',
    /caja en longitud\/latitud[^\n]*2 registro/.test(I),
    (I.match(/✔ WFS 2\.0, caja en longitud[^\n]+/)||['no insiste'])[0]);
  T('probando de verdad los dos órdenes',
    pedidos.filter(u=>/request=GetFeature\b/.test(u)).length>=4,
    pedidos.filter(u=>/request=GetFeature\b/.test(u)).length+' consultas WFS');
  T('diciendo cuál anduvo, para no volver a adivinarlo',
    !!conCapa('Amenaza por inundación') &&
    /latitud\/longitud/.test(conCapa('Amenaza por inundación').texto),
    conCapa('Amenaza por inundación') ? conCapa('Amenaza por inundación').texto.slice(0,120) : '');
  T('y trae los nombres de los campos, que es a lo que se vino',
    /CATEGORIA/.test(I) && /AREA_HA/.test(I) && /IDEAM 2021/.test(I));

  console.log('\n  -- cuando el WFS no está --');
  T('se cae al GetFeatureInfo del WMS en vez de rendirse',
    pedidos.some(u=>/request=GetFeatureInfo/.test(u)));
  T('y lo dice como es', /✗ WFS[^\n]*excepción[^\n]*Illegal property name/.test(I),
    (I.match(/✗ WFS[^\n]*Illegal[^\n]*/)||['no lo lee'])[0]);

  console.log('\n  -- y en el resumen --');
  T('la capa que sirve queda marcada como tal',
    !!conCapa('Amenaza por inundación') &&
    /sirve/.test(conCapa('Amenaza por inundación').marca),
    conCapa('Amenaza por inundación') ? conCapa('Amenaza por inundación').marca : 'no está');
  T('hay un hallazgo por capa mirada', ogc.hallazgos.length>=3,
    ogc.hallazgos.length+' hallazgos');

  console.log('\n  -- los tres rojos no son el mismo rojo --');
  T('el que contesta pero no deja leerlo se distingue',
    /el dominio SÍ contesta/.test(I) && /desde el motor de URBIS/.test(I),
    (I.match(/pero el dominio SÍ contesta[^.]*\./)||['no lo distingue'])[0]);
  T('y el que ni existe, también',
    /el dominio tampoco contesta/.test(I) && /No es cosa de permisos/.test(I),
    (I.match(/y el dominio tampoco contesta[^.]*\./)||['no lo distingue'])[0]);
  T('cada uno con su etiqueta en el resumen',
    ogc.hallazgos.some(h=>/no deja leerlo/.test(h.marca||h.texto)) &&
    ogc.hallazgos.some(h=>/no hay servidor/.test(h.marca||h.texto)),
    ogc.hallazgos.map(h=>h.marca).join(' · '));

  console.log('');
  console.log('\n  -- qué se examina y qué se salta --');
  /* La regla vieja agrupaba por carpeta y era la agrupación equivocada: en el
     IGAC, cuatro mapas distintos del POT viven en la misma carpeta y solo se
     miraba el primero por orden alfabético —que además estaba vacío—. La
     pregunta que la sonda salió a contestar se quedó sin contestar por eso.
     Ahora se agrupa por cómo se LLAMAN, que es lo que de verdad los repite. */
  const raizDe = n => String(n).split('/').pop()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z]/g,'').slice(0,10);
  const familias = l => new Set(l.map(raizDe)).size;
  T('cuatro mapas distintos de una misma carpeta NO se agrupan',
    familias(['ordenamientoterritorial/clasificaciondelsuelopot',
              'ordenamientoterritorial/zonificacionusossegunpot',
              'ordenamientoterritorial/datosnacionalespot',
              'ordenamientoterritorial/villavicenciozonificacionpot'])===4);
  T('pero las variantes del mismo mapa sísmico sí',
    familias(['Amenaza_Sismica/Mapa_Amenaza_Sismica_Nacional_PGA225',
              'Amenaza_Sismica/Mapa_Amenaza_Sismica_Nacional_PGA475',
              'Amenaza_Sismica/Mapa_Amenaza_Sismica_Nacional_PGA2475'])===1);
  T('y los 168 municipios de agrología, que fue el problema original',
    familias(['agrologia/potencialusoaipe41016','agrologia/potencialusozaragoza05895',
              'agrologia/potencialusotumaco52835'])===1);
  T('los acentos no separan familias',
    familias(['Inundación_01___12_Marzo_2026_MIL1',
              'Inundacion_13___18_Marzo_2026_MIL1'])===1);
  T('un servicio sin capas se dice vacío, no se consulta como si fuera una',
    /no publica NINGUNA capa/.test(J) && !/vacio del todo/.test(J),
    (J.match(/[^\n]*NINGUNA capa[^\n]*/)||['(no salió en esta corrida)'])[0].trim());

  console.log('\n  -- el relevo del motor --');
  T('lo que el navegador no pudo leer, se pide por el relevo',
    relevosPedidos.some(u=>/arcgis-cors-cerrado/.test(u)),
    relevosPedidos.length+' consultas relevadas');
  T('y llega el dato: las capas del servicio',
    /Clasificacion del Suelo/.test(J));
  T('marcado, para no confundir «sirve» con «sirve por nuestro servidor»',
    /⇄[^\n]*RELEVO/.test(J),
    (J.match(/⇄[^\n]*/)||[''])[0].trim());
  /* La otra mitad, y la que se olvida: un relevo que se dispara siempre
     duplica cada consulta y le manda al servidor trabajo inútil. */
  T('lo que contestó «Token Required» NO se releva: el relevo no lo arregla',
    !relevosPedidos.some(u=>/arcgis-con-token/.test(u)));
  T('y lo que se leyó directo, tampoco',
    !relevosPedidos.some(u=>/arcgis-abierto/.test(u)));
  T('el que ni con relevo se pudo, lo dice entero',
    !/⇄[^\n]*arcgis-con-token/.test(J) && /Token Required/.test(J));

  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
