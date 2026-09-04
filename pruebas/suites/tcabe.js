const E = require('../entorno.js');
/* Tanda AB · qué cabe en el lote.

   El módulo terminaba midiendo el sitio. Esto es el primer paso del otro
   lado, y trae un riesgo que no tenía ninguna tanda anterior: hasta acá todo
   lo que decía la aplicación salía de una medición o de una norma nacional.
   Esta cuenta sale de SIETE NÚMEROS QUE ESCRIBE UNA PERSONA, sacados del POT
   del municipio, que URBIS no conoce ni puede verificar.

   Una herramienta que hace esa cuenta sin decirlo es peligrosa: devuelve
   «caben 10 viviendas» con la misma cara de seguridad con la que devuelve el
   área del lote, y no son la misma clase de afirmación. Así que la mitad de
   esta prueba comprueba la aritmética, y la otra mitad comprueba que la
   advertencia esté, y esté arriba, y esté en los tres sitios.

   La maqueta tiene respuesta conocida a mano:

     Lote de 40 × 25 = 1.000 m², perímetro 130 m, con un frente de 40 m a la
     avenida. Antejardín 3 m, lateral 0, posterior 3.
       quitado = 40×3 + 90×(0+3)/2 = 120 + 135 = 255
       área neta = 745 m²      · índice de ocupación 0,6 → 600 m²
       manda el ÍNDICE (600 < 745), no los aislamientos
       construible por IC 2 = 2.000 m²  ·  por altura 4×600 = 2.400
       manda el IC → 2.000 m² en 3,3 pisos
       viviendas de 60 m² → 33                                             */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const P=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

let id=1;
const usos=[];
for(let i=0;i<12;i++){ const a=i*30*Math.PI/180, d=(160+(i%3)*70)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'U'+i, amenity:['pharmacy','restaurant','school'][i%3]}}); }
// La avenida corre justo por el frente sur del lote.
const geo=[
  {type:'way',id:id++,tags:{highway:'secondary',name:'Avenida 3',lanes:'2'},
   geometry:[P(-400,-20),P(0,-20),P(400,-20)].map(p=>({lat:p.lat,lon:p.lng}))},
  {type:'way',id:id++,tags:{highway:'residential',name:'Calle 7',lanes:'2'},
   geometry:[P(-300,-300),P(-300,0),P(-300,300)].map(p=>({lat:p.lat,lon:p.lng}))},
  // Una torre al occidente del lote, para que a las 15:00 le entre sombra.
  {type:'way',id:id++,tags:{building:'yes','building:levels':'12'},
   geometry:[P(-70,-10),P(-45,-10),P(-45,15),P(-70,15),P(-70,-10)].map(p=>({lat:p.lat,lon:p.lng}))},
  /* Un parque de 60 × 50 = 3.000 m². Con los 3.045 habitantes que devuelve el
     censo de mentira, eso es ~1 m² por habitante contra los 15 del Decreto
     1504: el sector está lejísimos de la meta, y meterle gente nueva sin
     agregar espacio público tiene que salir señalado. */
  {type:'way',id:id++,tags:{leisure:'park',name:'Parque de la prueba'},
   geometry:[P(150,150),P(210,150),P(210,200),P(150,200),P(150,150)].map(p=>({lat:p.lat,lon:p.lng}))}
];
const NSR={"NOMBRE_DEPARTAMENTO":"NORTE DE SANTANDER","NOMBRE_MUNICIPIO":"CÚCUTA",
  "AA":0.35,"AV":0.3,"ZONA_AMENAZA_SÍSMICA":"Alta","AE":0.25,"AD":0.1,
  "LONGITUD":-72.50559097,"LATITUD":7.90526712};
const PGA={"NOMDEPTO":"NORTE DE SANTANDER","NOMMUN":"Cúcuta","POINT_X":-72.507868,
  "POINT_Y":7.897548,"PGA75":170,"PGA225":270,"PGA475":360,"PGA975":460,"PGA2475":610,
  "NIVEL":"Alta","AA":0.35,"AV":0.25,"AE":0.25,"AD":0.1};
const MASA={"AREA_KM":1135.66,"DEPARTAMEN":"Norte de Santander","MUNICIPIO":"Cúcuta",
  "SUM_BAJA":0,"SUM_MEDIA":32.78,"SUM_ALTA":59.15,"SUM_MUY_AL":8.71};
const INT={"MUNICIPIO":"Cúcuta","ZONAS_AMENAZA_SISMICA_NSR_10":"Alta",
  "PERCEPCION":"Fuerte","POTENCIAL":"Ligero","PGA":"9.20-18.0"};

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
  // Pendiente fuerte: 30 m de desnivel en el ancho del sector.
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    const o=Math.min(...lngs), e=Math.max(...lngs);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map(x=>300+300*((x-o)/((e-o)||1)))})});
  });
  await ctx.route(/srvags\.sgc\.gov\.co/, r=>{
    const u=decodeURIComponent(r.request().url());
    let cuerpo;
    if(/Zonas_amenaza_Sismica_NR10/.test(u)) cuerpo=[{attributes:NSR}];
    else if(/Mov_Masa/.test(u)) cuerpo=[{attributes:MASA}];
    else if(/Intensidad_Sismica_Esperada/.test(u)) cuerpo=[{attributes:INT}];
    else cuerpo=[{attributes:PGA}];
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:cuerpo})});
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
    window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ capturado=h; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    o.hayModulo=!!window.URBIS_QUE_CABE;

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1200);

    const H=()=>document.getElementById('pcr-hoja');
    const txt=()=>(H().textContent||'').replace(/\s+/g,' ').trim();
    const trozo=(d,n)=>{ const t=txt(); const i=t.indexOf(d); return i<0?'':t.slice(i,i+n); };
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]');
      if(a){ a.click(); await esperar(400); } };
    await abrir();

    // ── Sin lote: invita, no calcula.
    o.sinLote=trozo('Qué cabe en el lote',260);

    // ── Medir todo, para que haya con qué cruzar.
    H().querySelector('[data-pcr="medir-todo"]').click();
    for(let i=0;i<200 && H().querySelector('.pcr-medir-va');i++) await esperar(500);
    await esperar(800); await abrir();

    // ── El lote: 40 m de frente por 25 de fondo, con la avenida al sur.
    H().querySelector('[data-pcr="lote-dibujar"]').click(); await esperar(500);
    [Q(-20,0),Q(20,0),Q(20,25),Q(-20,25)].forEach(p=>window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}));
    await esperar(400);
    document.querySelector('[data-lote="cerrar"]').click(); await esperar(900);
    await abrir();

    // Largo de sobra: con los cuatro cruces adentro, el bloque pasa los tres
    // mil caracteres y las advertencias del final quedaban fuera del recorte.
    o.conLote=trozo('Qué cabe en el lote',5000);
    o.campos=[...H().querySelectorAll('[data-pcr-idx]')].map(x=>({
      id:x.getAttribute('data-pcr-idx'), valor:x.value }));
    o.kpis=[...H().querySelectorAll('.pcr-kpi')]
      .map(k=>(k.textContent||'').replace(/\s+/g,' ').trim())
      .filter(t=>/huella|construibles|pisos que salen/.test(t));
    o.cruces=[...H().querySelectorAll('.pcr-cabe-cruce')]
      .map(c=>(c.textContent||'').replace(/\s+/g,' ').trim());
    o.advertenciaArriba=(function(){
      /* Que la advertencia esté ANTES de los campos y de las cifras, no al
         pie: al pie no la lee nadie, y es la diferencia entre una
         herramienta útil y una peligrosa. */
      const t=o.conLote;
      return t.indexOf('Estos índices los ponés vos') >= 0 &&
             t.indexOf('Estos índices los ponés vos') < t.indexOf('m² de huella');
    })();

    /* ── Lo de ejemplo y lo confirmado ──────────────────────────────────
       Antes de tocar nada, los seis índices del POT son los que trae URBIS.
       Se mide en tres sitios: la banda sobre las cifras, la marca en cada
       casilla, y el color de esa marca —que la aplicación pinta de menta
       todo `small` dentro de una etiqueta y esto ya quedó blanco sobre
       blanco una vez, en el bloque de lo intangible—. */
    o.antesDeTocar = {
      banda: /Cuenta de ejemplo/.test(o.conLote),
      dice: /no es de este lote/.test(o.conLote),
      marcadas: H().querySelectorAll('.pcr-cabe-ej').length,
      hayLista: /Lo que hay que ir a buscar/.test(o.conLote),
      pideFicha: /ficha normativa del predio/.test(o.conLote),
      pidePlaneacion: /Planeación Municipal/.test(o.conLote)
    };
    o.contraste = (function () {
      const m = H().querySelector('.pcr-cabe-ej small');
      if (!m) return null;
      const cs = getComputedStyle(m);
      const lum = c => {
        const v = (c.match(/[\d.]+/g) || []).slice(0, 3).map(x => {
          x = Number(x) / 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
        });
        return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
      };
      let fondo = cs.backgroundColor, el = m;
      while (el && (!fondo || /rgba\(0, 0, 0, 0\)|transparent/.test(fondo))) {
        el = el.parentElement; if (!el) break; fondo = getComputedStyle(el).backgroundColor;
      }
      const a = lum(cs.webkitTextFillColor || cs.color), b = lum(fondo || 'rgb(255,255,255)');
      return Math.round(((Math.max(a, b) + .05) / (Math.min(a, b) + .05)) * 10) / 10;
    })();

    // El texto que se pega en una memoria tiene que llevar la marca: ahí la
    // pantalla ya no está.
    o.textoDeEjemplo = (function () {
      const Q = window.URBIS_QUE_CABE, R = window.URBIS_PC_RECON;
      const t = Q.comoTexto(Q.calcular({ areaM2: 1000, perimetroM: 130 },
        Q.porDefecto(), {}, {}));
      return { titulo: /CUENTA DE EJEMPLO/.test(t), cuerpo: /valores de/.test(t) };
    })();
    o.listaParaLlevar = window.URBIS_QUE_CABE.textoDelPedido('Cúcuta');

    // ── Cambiar un índice y ver que la cuenta cambia.
    const ic=H().querySelector('[data-pcr-idx="ic"]');
    ic.value='4';
    ic.dispatchEvent(new Event('change',{bubbles:true}));
    await esperar(700); await abrir();
    /* 6.000 y no 3.000: con la banda de «cuenta de ejemplo» y la lista de la
       ventanilla adentro, el bloque creció y el corte viejo dejaba fuera la
       frase del final. La prueba se ensancha para leer más, nunca se afloja
       para exigir menos. */
    o.conIC4=trozo('Qué cabe en el lote',6000);
    // Con IC 4 el tope pasa a ser la ALTURA, no el índice.
    o.mandaAltura=/no manda el índice de construcción sino la altura/.test(o.conIC4);

    /* Con los SEIS puestos, la banda tiene que irse y la lista de la
       ventanilla también. Una advertencia que no se apaga cuando el problema
       se resuelve deja de leerse a los dos días. */
    ['io','ic','pisos','aisFrente','aisLado','aisFondo'].forEach(id=>{
      const el=H().querySelector('[data-pcr-idx="'+id+'"]');
      if(el){ el.value=String(Number(el.value)||1); el.dispatchEvent(new Event('change',{bubbles:true})); }
    });
    await esperar(700); await abrir();
    const conTodos=trozo('Qué cabe en el lote',5000);
    o.conLosSeis={
      sinBanda: !/Cuenta de ejemplo/.test(conTodos),
      loDice: /vienen de la ficha normativa/.test(conTodos),
      sinLista: !/Lo que hay que ir a buscar/.test(conTodos),
      marcadas: H().querySelectorAll('.pcr-cabe-ej').length
    };

    // Un valor absurdo no puede colarse.
    const io=H().querySelector('[data-pcr-idx="io"]');
    io.value='-3';
    io.dispatchEvent(new Event('change',{bubbles:true}));
    await esperar(600); await abrir();
    o.ioNegativo=(H().querySelector('[data-pcr-idx="io"]')||{}).value;

    // Volver a los de ejemplo.
    H().querySelector('[data-pcr="cabe-reiniciar"]').click(); await esperar(600);
    await abrir();
    o.trasReiniciar=[...H().querySelectorAll('[data-pcr-idx]')].map(x=>x.value).join(',');

    // ── El papel.
    H().querySelector('[data-pcr="lamina"]').click(); await esperar(900);
    o.lamina=capturado; capturado='';
    await abrir();
    H().querySelector('[data-pcr="imprimir"]').click(); await esperar(900);
    o.pdf=capturado; capturado='';
    await abrir();
    o.enElPliego=(function(){
      const b=H().querySelector('[data-pcr="pliego-caja"][data-c="que-cabe-en-el-lote"]');
      return b?{gris:b.classList.contains('pcr-capa-gris')}:null;
    })();
    o.guardado=(function(){
      try{ const f=(R.leerFichas()||[])[0];
        return f&&f.indices?{io:f.indices.io, ic:f.indices.ic}:null; }
      catch(e){ return null; }
    })();
    return o;
  },{C,POL});

  const errFin=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  /* ── El contraste DESPUÉS de analizar ────────────────────────────────
     La medición de arriba mira la hoja recién abierta. Los textos que llegaron
     reportados desde el celular —los chips de «falta medir», los pies de los
     dibujos, las casillas de «qué cabe»— no existen hasta que hay un análisis,
     así que ninguna de las dos cosas se estaba comprobando.

     Medidos antes del arreglo: 1,0:1 los chips (menta sobre blanco) y 1,1:1
     las casillas (tinta oscura sobre el fondo oscuro que css/42 le pone a
     todo `input`). Uno y uno es texto invisible.

     El fondo del asunto es que css/42 pinta con !important TODO `p, small,
     span, label` e `input`, y esta hoja lo desandaba clase por clase: una
     clase nueva nacía ilegible y solo se descubría en un teléfono. Ahora hay
     un suelo legible para toda la hoja, y esta comprobación lo vigila sobre
     la ficha ENTERA, con las casillas incluidas. */
  r.barrido = await pg.evaluate(async () => {
    const esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const H=document.getElementById('pcr-hoja');
    const a=H.querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const rgb=c=>(String(c).match(/[\d.]+/g)||[]).slice(0,3).map(Number);
    const lum=c=>{const v=rgb(c);if(v.length<3)return null;
      const f=v.map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4);});
      return .2126*f[0]+.7152*f[1]+.0722*f[2];};
    const fondoDe=el=>{let e=el;
      while(e){const c=getComputedStyle(e).backgroundColor;
        if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c))return c; e=e.parentElement;}
      return 'rgb(255,255,255)';};
    const ratio=(col,fon)=>{const x=lum(col),y=lum(fon);
      if(x==null||y==null)return null;
      return Math.round(((Math.max(x,y)+.05)/(Math.min(x,y)+.05))*10)/10;};
    const malos=[];
    // texto propio del elemento, para no contar dos veces al padre
    H.querySelectorAll('*').forEach(el=>{
      if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1)) return;
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)<.1) return;
      const col=(cs.webkitTextFillColor&&cs.webkitTextFillColor!=='rgba(0, 0, 0, 0)')
        ? cs.webkitTextFillColor : cs.color;
      const r=ratio(col,fondoDe(el)); if(r==null) return;
      const px=parseFloat(cs.fontSize)||14;
      const min=(px>=24||(px>=18.66&&Number(cs.fontWeight)>=700))?3:4.5;
      if(r<min) malos.push({cls:String(el.className||el.tagName).slice(0,26), r,
        t:(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,24)});
    });
    // y las casillas, cuyo valor no es un nodo de texto
    H.querySelectorAll('input, textarea, select').forEach(el=>{
      const cs=getComputedStyle(el);
      if(cs.display==='none'||!el.offsetParent||cs.type==='range') return;
      const col=(cs.webkitTextFillColor&&cs.webkitTextFillColor!=='rgba(0, 0, 0, 0)')
        ? cs.webkitTextFillColor : cs.color;
      const r=ratio(col,fondoDe(el)); if(r==null) return;
      if(r<4.5) malos.push({cls:'[input] '+String(el.className||'').slice(0,18), r,
        t:String(el.value||'').slice(0,16)});
    });
    return { n:H.querySelectorAll('*').length, malos:malos.slice(0,6), total:malos.length };
  });

  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const LAM=r.lamina||'', PDF=r.pdf||'', F=r.conLote||'';
  const kpi=q=>((r.kpis||[]).filter(k=>k.indexOf(q)>=0)[0]||'');
  /* En es-CO el separador de miles es el punto, así que «2.014» pasado por
     Number() da 2,014 y no dos mil catorce. Se quita antes de convertir: sin
     esto la comprobación de la cuenta pasaba o fallaba por el formato y no
     por la aritmética. */
  const cifra=q=>Number(((kpi(q).match(/^([\d.,]+)/)||[])[1]||'')
    .replace(/\./g,'').replace(',','.'));

  console.log('\n  -- antes del lote --');
  T('el módulo está cargado', r.hayModulo===true);
  T('sin lote, invita en vez de calcular',
    /Marcá el lote/.test(r.sinLote) && !/m² de huella/.test(r.sinLote));

  console.log('\n  -- la advertencia, que es la mitad de la tanda --');
  /* Hasta acá todo lo que decía la aplicación salía de una medición o de una
     norma nacional. Esta cuenta sale de siete números que escribe una
     persona: decirlo no es un descargo, es lo que la hace usable. */
  T('dice que los índices los pone el estudiante',
    /Estos índices los ponés vos/.test(F) && /URBIS no los conoce/.test(F));
  T('y que salen del POT del municipio', /POT del municipio/.test(F));
  T('va ARRIBA de las cifras, no al pie', r.advertenciaArriba===true);
  T('avisa de que el área tras aislamientos es aproximada',
    /es aproximada/.test(F) && /perímetro/.test(F));
  T('la lámina la lleva', /los puso quien hizo la lámina/.test(LAM) && /POT/.test(LAM));
  T('y el PDF también, antes de la tabla',
    /los puso a mano quien hizo el informe/.test(PDF) &&
    PDF.indexOf('los puso a mano') < PDF.indexOf('Índice de ocupación'));

  console.log('\n  -- de ejemplo no es lo mismo que medido --');
  /* La cuenta sale igual de segura con los índices del POT que con los que
     trae la aplicación de fábrica. Es el mismo error que decirle a alguien
     que su lote no se inunda cuando nadie lo midió, en otro sitio. */
  T('sin tocar nada, las cifras se marcan como ejemplo',
    r.antesDeTocar.banda && r.antesDeTocar.dice);
  T('y cada casilla sin confirmar lo dice',
    r.antesDeTocar.marcadas===6, r.antesDeTocar.marcadas+' de 6 marcadas');
  T('la marca se lee: contraste suficiente sobre su fondo',
    r.contraste!==null && r.contraste>=4.5, r.contraste+':1');
  T('el texto que se pega en la memoria lleva la marca en el TÍTULO',
    r.textoDeEjemplo.titulo && r.textoDeEjemplo.cuerpo);

  T('y cuando los seis están puestos, la banda se apaga',
    r.conLosSeis.sinBanda && r.conLosSeis.loDice);
  T('y no queda ninguna casilla marcada como ejemplo',
    r.conLosSeis.marcadas===0, r.conLosSeis.marcadas+' marcadas');

  console.log('\n  -- lo que hay que ir a buscar --');
  /* El POT de Cúcuta no está publicado como servicio en ningún servidor del
     Estado. El estudiante va a Planeación, y presentarse sin saber qué pedir
     es volver con las manos vacías. */
  T('aparece la lista mientras falten índices', r.antesDeTocar.hayLista);
  T('nombra el documento que de verdad hay que pedir', r.antesDeTocar.pideFicha);
  T('y a quién pedírselo', r.antesDeTocar.pidePlaneacion);
  T('la lista se puede copiar entera, con los cinco puntos',
    /1\. La ficha normativa/.test(r.listaParaLlevar) &&
    /5\. ¿Hay microzonificación/.test(r.listaParaLlevar));
  T('incluye lo que URBIS no pudo dar: el agua y la ronda del Pamplonita',
    /Pamplonita/.test(r.listaParaLlevar) && /IDEAM no modeló Cúcuta/.test(r.listaParaLlevar));
  T('y desaparece cuando ya no hace falta', r.conLosSeis.sinLista);

  console.log('\n  -- la cuenta, contra una respuesta conocida --');
  /* Lote 40 × 25 = 1.000 m², perímetro 130, frente 40 a la avenida.
     quitado = 40×3 + 90×1,5 = 255 → neta 745. IO 0,6 → 600, y 600 < 745, así
     que manda el índice. IC 2 → 2.000 m², contra 4×600 = 2.400 por altura:
     manda el IC. 2.000 / 600 = 3,3 pisos. 2.000 / 60 = 33 viviendas. */
  T('los siete campos están', (r.campos||[]).length===7,
    (r.campos||[]).map(c=>c.id).join(' '));
  T('la huella sale del índice de ocupación', Math.abs(cifra('huella')-600)<=25,
    kpi('huella'));
  T('los metros construibles, del índice de construcción',
    Math.abs(cifra('construibles')-2000)<=60, kpi('construibles'));
  T('y los pisos son la consecuencia, no un dato',
    /3,[0-9] pisos que salen|3,[0-9]pisos/.test(kpi('pisos').replace(/\s+/g,'')) ||
    Math.abs(cifra('pisos')-3.3)<=0.4, kpi('pisos'));
  T('lo traduce a viviendas y a gente',
    /caben 33 viviendas|caben 3[0-9] viviendas/.test(F) && /personas/.test(F),
    (F.match(/caben \d+ viviendas[^.]{0,60}/)||['no lo dice'])[0]);
  T('cambiar el índice cambia la cuenta, y dice qué manda ahora',
    r.mandaAltura===true, r.mandaAltura?'con IC 4 manda la altura':'no lo detecta');
  T('un índice negativo no se cuela', r.ioNegativo==='0', 'quedó en '+r.ioNegativo);
  T('y se puede volver a los valores de ejemplo',
    (r.trasReiniciar||'').indexOf('0.6')===0, r.trasReiniciar);

  console.log('\n  -- cruzado con lo que se midió --');
  const cr=(r.cruces||[]).join(' ~ ');
  T('la pendiente medida entra en la cuenta',
    /pendiente medida/.test(cr) && /plataformas/.test(cr),
    (cr.match(/La pendiente medida[^.]*\./)||['no la cruza'])[0]);
  T('la sombra de los vecinos también',
    /tapan el \d+% del lote a las 15:00/.test(cr));
  T('la amenaza sísmica alta también', /amenaza sísmica alta/.test(cr));
  T('y el espacio público que le tocaría a la gente nueva',
    /espacio público por habitante/.test(cr) && /Decreto 1504/.test(cr));

  console.log('\n  -- en el resto de la aplicación --');
  T('la lámina trae la caja con sus cifras',
    /<h2>Qué cabe en el lote<\/h2>/.test(LAM) && /m² construibles/.test(LAM));
  T('el PDF trae la tabla entera',
    /<h2>Qué cabe en el lote<\/h2>/.test(PDF) && /Área libre de aislamientos/.test(PDF));
  T('el pliego la ofrece', !!r.enElPliego && r.enElPliego.gris===false);
  T('y los índices viajan con la ficha, para no repetir la búsqueda del POT',
    !!r.guardado && r.guardado.io===0.6, r.guardado?JSON.stringify(r.guardado):'no se guardó');

  console.log('\n  -- todo lo de la ficha se lee --');
  T('ni un texto ni una casilla por debajo del mínimo',
    r.barrido.total===0,
    r.barrido.total ? r.barrido.malos.map(m=>m.cls+' '+m.r+':1 «'+m.t+'»').join(' | ')
                    : r.barrido.n+' elementos revisados');

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
