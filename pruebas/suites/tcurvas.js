const E = require('../entorno.js');
/* Tanda O · curvas de nivel y sombras de los vecinos.

   Dos maquetas con respuesta conocida:

   · El terreno es una rampa de fórmula que sube 200 m de occidente a oriente
     a lo largo del sector. Con una rampa, las curvas de nivel TIENEN que
     salir verticales (norte-sur), equiespaciadas, y en número igual al
     desnivel dividido por el intervalo. Si el algoritmo se equivoca de eje o
     de interpolación, eso se nota de inmediato.

   · Al OCCIDENTE del lote hay una torre de 10 pisos —30 m— y nada más. En
     Cúcuta, a las 15:00, el sol viene del occidente: la sombra de esa torre
     cae hacia el oriente, o sea SOBRE el lote. A las 9:00 el sol viene del
     oriente y la sombra se va para el otro lado, lejos del lote. Esa
     diferencia entre la mañana y la tarde es lo que la prueba mira.

       torre (10 pisos)        lote
            ▓▓▓                ▭
             │←── 40 m ──→│
       occidente                oriente                                    */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
// Rampa pura de occidente a oriente: la cota depende SOLO de la longitud.
const RAMPA={lng0:C.lng-L, lng1:C.lng+L, z0:300, z1:500};
const cotaDe=(lat,lng)=> RAMPA.z0 + (RAMPA.z1-RAMPA.z0)*((lng-RAMPA.lng0)/(RAMPA.lng1-RAMPA.lng0));

const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
for(let i=0;i<10;i++){ const a=i*36*Math.PI/180, d=(140+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, shop:'convenience'}}); }
const via=(nombre,clase,pts)=>({type:'way',id:id++,tags:{highway:clase,name:nombre},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const edificio=(pts,pisos)=>({type:'way',id:id++,
  tags: pisos?{building:'yes','building:levels':String(pisos)}:{building:'yes'},
  geometry:pts.map(p=>({lat:p.lat,lon:p.lng}))});
const geo=[
  via('Calle 7','residential',[P(-200,-300),P(-200,0),P(-200,300)]),
  via('Avenida 3','secondary',[P(-400,80),P(0,80),P(400,80)]),
  // La torre: 20 × 20 m, centrada 40 m al occidente del lote, 10 pisos.
  edificio([P(-60,-10),P(-40,-10),P(-40,10),P(-60,10),P(-60,-10)], 10),
  // Y un galpón sin pisos registrados, para que la ficha lo diga.
  edificio([P(60,-60),P(90,-60),P(90,-30),P(60,-30),P(60,-60)], null)
];

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
      body:JSON.stringify({elevation:lngs.map(lng=>cotaDe(0,lng))})});
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
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    /* Desde el TÍTULO del bloque y no desde la primera vez que aparecen esas
       palabras en la hoja. El panel de capas nombra todas las capas —«Curvas
       de nivel», «Llenos y vacíos», «Percepción»— y desde que vive arriba,
       con los controles, esos nombres aparecen antes en la lista que en su
       propio bloque: cortar por la primera coincidencia devolvía el trozo
       equivocado y la prueba leía la lista en vez del bloque. */
    const trozo=(desde,largo)=>{
      const hoja=document.getElementById('pcr-hoja');
      const cab=hoja ? [...hoja.querySelectorAll('.pcr-h, .pcr-lab')]
        .filter(h=>((h.textContent||'').trim()===desde))[0] : null;
      const t=txt();
      if(!cab) { const i=t.indexOf(desde); return i<0?'':t.slice(i,i+largo); }
      /* Del título hacia adelante, en el texto de toda la hoja: se busca la
         coincidencia que empieza donde empieza este encabezado. */
      let i=-1, desde0=0;
      const antes=(function(){
        const r=document.createRange();
        r.setStart(hoja,0); r.setEndBefore(cab);
        return (r.toString()||'').replace(/\s+/g,' ').trim().length;
      })();
      i=t.indexOf(desde, Math.max(0, antes-40));
      return i<0?'':t.slice(i,i+largo);
    };

    // ── Trazado (huellas y pisos) y terreno (rejilla de cotas).
    await esperar(5200);
    H().querySelector('[data-pcr="trazado"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(600);
    await esperar(5200);
    H().querySelector('[data-pcr="terreno"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-corte');i++) await esperar(400);
    await esperar(800);

    // ── El lote, al oriente de la torre.
    const LOTE=[Q(-20,-15),Q(20,-15),Q(20,15),Q(-20,15)];
    H().querySelector('[data-pcr="lote-dibujar"]').click(); await esperar(500);
    LOTE.forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(900);

    // ── Las curvas.
    o.curvasTexto=trozo('Curvas de nivel',1100);   // creció: selector de intervalo y nota de interpolación
    H().querySelector('[data-pcr="curvas-mapa"]').click(); await esperar(600);
    o.curvasMapa=(function(){
      const out=[];
      window.map.eachLayer(l=>{ if(l instanceof L.Polyline && !(l instanceof L.Polygon) &&
        l.options && /^#(8A5A20|B08050)$/i.test(l.options.color||'')){
        const pts=l.getLatLngs();
        out.push({ maestra:l.options.color.toUpperCase()==='#8A5A20',
                   n:pts.length,
                   dLng:Math.abs(pts[0].lng-pts[pts.length-1].lng),
                   dLat:Math.abs(pts[0].lat-pts[pts.length-1].lat) });
      }});
      return out;
    })();
    o.barraCurvas=/Curvas de nivel/.test(txt());
    H().querySelector('[data-pcr="curvas-mapa"]').click(); await esperar(500);
    o.curvasApagadas=(function(){ let n=0;
      window.map.eachLayer(l=>{ if(l instanceof L.Polyline && l.options &&
        /^#(8A5A20|B08050)$/i.test(l.options.color||'')) n++; });
      return n; })();

    // ── Las sombras.
    const asa=H().querySelector('[data-pcr="agrandar"]');
    if(asa){ asa.click(); await esperar(500); }
    o.sombrasTexto=trozo('La sombra de los vecinos',700);
    o.kpis=[...H().querySelectorAll('.pcr-kpi')]
      .map(k=>(k.textContent||'').replace(/\s+/g,' ').trim())
      .filter(t=>/en sombra a las/.test(t));
    const svgS=H().querySelector('.pcr-sombras');
    o.dibujoSombras={ hay:!!svgS,
      manchas:svgS?svgS.querySelectorAll('g[fill-opacity=".22"] path').length:0,
      etq:svgS?svgS.getAttribute('aria-label'):'' };
    const bs=H().querySelector('[data-pcr="sombras-mapa"]');
    if(bs){ bs.click(); await esperar(600); }
    o.sombrasMapa=(function(){ let n=0;
      window.map.eachLayer(l=>{ if(l instanceof L.Polygon && l.options &&
        /^#(F2B441|7C4DFF|0A6F9E)$/i.test(l.options.fillColor||'')) n++; });
      return n; })();

    // ── El papel.
    const asa2=H().querySelector('[data-pcr="agrandar"]');
    if(asa2){ asa2.click(); await esperar(500); }
    const caja=document.getElementById('pcr-nombre');
    if(caja) caja.value='La rampa del oriente';
    H().querySelector('[data-pcr="lamina-ver"]').click(); await esperar(700);
    o.lamina=capturado; capturado='';
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(700);
    o.pdf=capturado; capturado='';
    return o;
  },{C,POL});

  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  const medir=async(html,w,h)=>{
    const m=await ctx.newPage();
    await m.setViewportSize({width:w,height:h});
    await m.setContent(html||'<i></i>',{waitUntil:'load'});
    await m.waitForTimeout(400);
    const out=await m.evaluate(()=>({
      /* En columnas, la caja que no cabe no se recorta: se va a una columna
         que no existe y desaparece del papel sin dejar rastro. Se detecta
         mirando si alguna queda fuera del rectángulo de la rejilla. */
      perdidas: (function () {
        const rej = document.querySelector('.rej');
        if (!rej) return [];
        const R = rej.getBoundingClientRect();
        const fuera = [...rej.children].filter(c => {
          const b = c.getBoundingClientRect();
          return b.height === 0 || b.right > R.right + 2;
        }).map(c => (c.querySelector('h2') || {}).textContent || '?');
        // Y la hoja entera: si el contenido la pasó, lo de abajo se imprime
        // fuera del papel, que es la misma pérdida por otra puerta.
        const h = document.querySelector('.hoja');
        if (h && h.scrollHeight > h.clientHeight + 2) {
          fuera.push('(la hoja se pasa ' + (h.scrollHeight - h.clientHeight) + ' px de alto)');
        }
        return fuera;
      })(),
      cajas:[...document.querySelectorAll('.caja')]
        .filter(c=>c.scrollHeight>c.clientHeight+2)
        .map(c=>(c.querySelector('h2')||{}).textContent||'?')
    }));
    await m.close(); return out;
  };
  r.medida=await medir(r.lamina,2268,3402);
  fs.writeFileSync(S+'curvas-lamina.html', r.lamina||'', 'utf8');
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- las curvas de nivel --');
  T('la ficha dice cuántas hay y cada cuánto',
    /curvas cada \d+ m/.test(r.curvasTexto), (r.curvasTexto.match(/\d+ curvas? cada \d+ m/)||['no lo dice'])[0]);
  /* La rejilla se pide con un margen alrededor del contorno —los bordes
     necesitan vecinos para tener pendiente—, así que la rampa se extrapola un
     poco por fuera de los 300–500 del área. Lo que tiene que cumplirse es que
     el rango cubra la rampa y no se dispare. */
  const rango=(r.curvasTexto.match(/entre los (\d+) y los (\d+) msnm/)||[]).slice(1).map(Number);
  T('cubre la rampa entera, con el margen de la rejilla',
    rango.length===2 && rango[0]<=300 && rango[1]>=500 && rango[0]>=270 && rango[1]<=530,
    rango.join(' a ')+' msnm');
  T('y advierte que el modelo no da detalle de manzana',
    /forma del sector/.test(r.curvasTexto) && /topografía de campo/.test(r.curvasTexto));
  const cur=r.curvasMapa||[];
  T('se dibujan sobre el mapa', cur.length>=6, cur.length+' curvas');
  /* La rampa sube de occidente a oriente, así que cada curva de nivel es una
     línea NORTE-SUR: su longitud está en latitud y no en longitud. Si el
     algoritmo confundiera los ejes, saldrían acostadas. */
  T('y una rampa de occidente a oriente las deja verticales',
    cur.length>0 && cur.every(c=>c.dLat>c.dLng*3),
    cur.slice(0,3).map(c=>'Δlat '+c.dLat.toFixed(4)+' vs Δlng '+c.dLng.toFixed(4)).join(' · '));
  T('las de cota redonda van más gruesas', cur.some(c=>c.maestra) && cur.some(c=>!c.maestra),
    cur.filter(c=>c.maestra).length+' maestras de '+cur.length);
  T('la barra de abajo dice qué capa está puesta', r.barraCurvas===true);
  T('y al apagarlas no queda ninguna', r.curvasApagadas===0, r.curvasApagadas+' curvas');

  /* ── Por dónde se cortó, dibujado en el plano ──────────────────────
     El informe decía «las líneas de estos cortes van marcadas en el plano
     del sector con su letra en cada punta» y NO iban: el plano se armaba con
     las curvas de nivel y sin las trazas. Se vio en una captura de un sector
     real de Cúcuta —la caja de curvas mostraba el relieve y ninguna línea—,
     y es la misma clase de falla que la caja de cobertura que prometía
     «Verde y agua»: el documento afirmaba algo de sí mismo que era mentira.

     Lo que se comprueba es el DIBUJO, no la frase: las trazas punteadas y la
     letra en cada punta, en el plano del sector y en el recuadro de curvas,
     que son los dos sitios donde alguien va a buscarlas. */
  const cajaLam = t => ((r.lamina || '').split('<section class="caja')
    .filter(x => new RegExp('<h2>' + t + '</h2>').test(x))[0] || '');
  console.log('\n  -- por dónde se cortó, en el plano --');
  const PLANO = cajaLam('Plano del sector'), CURVAS = cajaLam('Curvas de nivel');
  T('el plano del sector trae las trazas punteadas',
    /stroke-dasharray="5 3\.5"/.test(PLANO),
    (PLANO.match(/stroke-dasharray="5 3\.5"/g) || []).length + ' trazos');
  T('con la letra de cada punta, que es para lo que sirve',
    (PLANO.match(/font-size="4\.4"[^>]*>[A-Z]′?</g) || []).length >= 4,
    (PLANO.match(/font-size="4\.4"[^>]*>([A-Z]′?)</g) || []).join(' ') || 'ninguna letra');
  T('el recuadro de curvas también, que es donde se leen contra el relieve',
    /stroke-dasharray="5 3\.5"/.test(CURVAS) && /font-size="4\.4"/.test(CURVAS),
    (CURVAS.match(/stroke-dasharray="5 3\.5"/g) || []).length + ' trazos');
  /* Antes esto lo decía el pie en texto corrido —«las líneas punteadas son
     los cortes»— y ahora lo dice la tabla de convenciones, con la muestra
     punteada al lado. Se aprieta, no se afloja: además del rótulo se exige
     la MUESTRA, que es lo que permite reconocer la línea en el dibujo sin
     leer nada. */
  T('y la tabla de convenciones lo nombra, con su muestra punteada',
    /mu-punteado/.test(CURVAS) && /Corte topográfico/.test(CURVAS),
    (CURVAS.match(/mu-[a-z]+"[^>]*>[^<]*/g) || []).map(x => x.split('>')[1]).join(' · ') || 'sin tabla');
  /* ── Movimientos en masa: por pendiente, del terreno medido ────────
     «Falta gráfico y mapa de los movimientos de masa». El mapa oficial del
     Servicio Geológico es del municipio a 1:100.000 y a esa escala un predio
     no se lee; lo que sí se midió acá es el terreno, y la pendiente es el
     primer factor de cualquier método. Esta rampa sube 200 m en unos 1.300 m
     —un 15 % largo—, así que las celdas tienen que caer en los rangos medio
     y alto, y ninguna en «baja»: si saliera verde, el mapa estaría pintando
     otra cosa. Y tiene que decir lo que es: susceptibilidad por pendiente,
     no el mapa oficial de amenaza. */
  console.log('\n  -- movimientos en masa, por la pendiente del terreno --');
  const MASA = cajaLam('Susceptibilidad por pendiente');
  T('el pliego trae el mapa de susceptibilidad por pendiente', !!MASA);
  /* Píxel a píxel, no una celda por cota: el mapa es un raster dentro del
     recuadro —como el de cobertura— y lo que dice cada rango se lee de su
     tabla de convenciones, que sale del mismo reparto que pintó la imagen. */
  T('pintado píxel a píxel, como raster, y no una celda por cota',
    /<image href="data:image\/png/.test(MASA) && !/fill="#(D9F2E3|F6E27F|F59E0B|B91C1C)"/.test(MASA));
  const conv = (MASA.match(/(Baja|Media|Alta|Muy alta) · [^·]* · \d+(\.\d)?%<\/span>/g) || [])
    .map(x => ({ r: x.split(' · ')[0], pct: parseFloat(x.split(' · ')[2]) }));
  const pctDe = q => (conv.filter(c => c.r === q)[0] || { pct: 0 }).pct;
  T('en los rangos medio y alto, no en «baja»',
    pctDe('Media') + pctDe('Alta') >= 99 && pctDe('Baja') === 0 && pctDe('Muy alta') === 0,
    conv.map(c => c.r + ' ' + c.pct + '%').join(' · ') || 'sin tabla');
  /* Las convenciones nombran solo los rangos que el dibujo pinta —en esta
     rampa, medio y alto— y cada uno con su porcentaje. Una entrada «Baja»
     con 0 % mandaría a buscar un verde que no está; y entre todas tienen que
     sumar el sector entero. */
  T('con los rangos que pinta, cada uno con su porcentaje, y sin nombrar los que no pinta',
    conv.length >= 1 && conv.every(c => c.pct > 0) && conv.some(c => c.r === 'Alta') &&
    conv.reduce((a, c) => a + c.pct, 0) >= 99.5 && conv.reduce((a, c) => a + c.pct, 0) <= 100.5,
    conv.map(c => c.r + ' ' + c.pct + '%').join(' | ') || 'sin tabla');
  T('y dice que no es el mapa oficial de amenaza', /no es el mapa oficial de amenaza/.test(MASA));
  T('el informe en hojas lo trae también', /<figcaption>Susceptibilidad por pendiente<\/figcaption>/.test(r.pdf || ''));

  const prometeCortes = /van marcadas en el plano del sector/.test(r.pdf || '');
  const dibujaCortes = /stroke-dasharray="5 3\.5"/.test(r.pdf || '');
  T('el informe ya no promete algo que no dibuja', !prometeCortes || dibujaCortes,
    prometeCortes ? (dibujaCortes ? 'lo promete y lo dibuja' : 'LO PROMETE Y NO LO DIBUJA')
                  : 'no lo promete');

  console.log('\n  -- la sombra de los vecinos --');
  T('sale con las tres horas', (r.kpis||[]).length===3, (r.kpis||[]).join(' · '));
  const pct=h=>{ const k=(r.kpis||[]).filter(t=>t.indexOf(h+':00')>=0)[0]||'';
    const m=k.match(/^(\d+)%/); return m?Number(m[1]):null; };
  /* La torre está al OCCIDENTE del lote. El sol de la tarde viene de allá, así
     que a las 15:00 su sombra cae sobre el lote; el de la mañana viene del
     oriente y la manda para el otro lado. */
  /* La torre mide 30 m y su cara oriental está a 20 m del lote; con el sol de
     la tarde a media altura la sombra entra unos diez metros dentro de los
     cuarenta que mide el lote, y solo en la franja de veinte metros de ancho
     de la torre. Eso da del orden de un quinto del lote, no la mitad: la
     prueba pide que ENTRE, no que lo cubra. */
  T('a las 15:00 la torre del occidente le entra al lote',
    pct(15)>=10 && pct(15)>pct(9), pct(15)+'% del lote');
  T('a las 9:00 no, porque el sol viene del otro lado', pct(9)===0, pct(9)+'% del lote');
  T('el dibujo trae las manchas de las tres horas',
    r.dibujoSombras.hay===true && r.dibujoSombras.manchas>=2, r.dibujoSombras.manchas+' manchas');
  T('y una descripción para quien no lo ve',
    /Sombras de los edificios vecinos/.test(r.dibujoSombras.etq||''));
  T('dice a cuántos metros por piso está contando', /3 m por piso/.test(r.sombrasTexto));
  T('y avisa de los edificios sin pisos registrados',
    /no tienen pisos registrados/.test(r.sombrasTexto),
    (r.sombrasTexto.match(/Otros \d+ no tienen pisos/)||['no avisa'])[0]);
  T('sin árboles, sin muros y con el terreno supuesto plano',
    /árboles/.test(r.sombrasTexto) && /terreno se supone plano/.test(r.sombrasTexto));
  T('se pueden ver en el mapa', r.sombrasMapa>=2, r.sombrasMapa+' polígonos');

  console.log('\n  -- en el papel --');
  const LAM=r.lamina||'', PDF=r.pdf||'';
  T('la lámina dibuja las curvas dentro del plano del sector',
    /stroke="#B08050"/.test(LAM) || /stroke="#8A5A20"/.test(LAM));
  T('y trae la caja de sombras', /La sombra de los vecinos/.test(LAM) && /pcr-sombras/.test(LAM));
  T('el PDF también', /La sombra de los vecinos sobre el lote/.test(PDF) && /pcr-sombras/.test(PDF));
  T('y anota el intervalo de las curvas', /Curvas de nivel cada \d+ m/.test(PDF));
  T('ninguna caja se recorta', (r.medida.cajas||[]).length===0,
    (r.medida.cajas||[]).join(' · ')||'ninguna');
  T('ni se pierde fuera de la hoja', (r.medida.perdidas||[]).length===0,
    (r.medida.perdidas||[]).join(' · ')||'ninguna');

  console.log('');
  T('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
