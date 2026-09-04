const E = require('../entorno.js');
/* Tanda C · el espacio público efectivo: cuántos metros cuadrados de parque,
   plaza y cancha tiene el sector y cuántos le tocan a cada habitante, contra
   la meta del Decreto 1504 de 1998. Se doblan parques de tamaño CONOCIDO —un
   cuadrado de 100 m, una plaza de 60, una cancha de 40 × 20— para poder
   comprobar la cifra contra algo, y se meten dos trampas que NO deben contar:
   una cancha de club privado y una calle peatonal que no es plaza. */
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

// Metros → grados, en esta latitud.
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
/* Un rectángulo de anchoM × altoM con su esquina inferior izquierda desplazada
   (dx, dy) metros del centro. Cerrado, como los manda Overpass. */
function rect(dx,dy,anchoM,altoM){
  const x0=C.lng+GLNG(dx), y0=C.lat+GLAT(dy);
  const x1=C.lng+GLNG(dx+anchoM), y1=C.lat+GLAT(dy+altoM);
  return [{lat:y0,lon:x0},{lat:y0,lon:x1},{lat:y1,lon:x1},{lat:y1,lon:x0},{lat:y0,lon:x0}];
}

const geo=[];
// Calles, para que el bloque del trazado tenga algo que decir.
for(let i=0;i<5;i++) geo.push({type:'way',id:id++,tags:{highway:'residential',name:'Calle '+i},
  geometry:[{lat:C.lat-L*0.7,lon:C.lng-L*0.7+i*L*0.35},{lat:C.lat+L*0.7,lon:C.lng-L*0.7+i*L*0.35}]});
// Unos edificios, para los llenos.
for(let i=0;i<12;i++) geo.push({type:'way',id:id++,tags:{building:'house'},
  geometry:rect(-200+i*30,-250,10,10)});

// ── Lo que SÍ es espacio público efectivo ─────────────────────────────
const ESPERADO=[
  {t:{leisure:'park',name:'Parque Colón'},              w:100,h:100},
  {t:{place:'square',name:'Plaza La Concordia'},        w:60, h:60 },
  {t:{leisure:'pitch',name:'Cancha del barrio'},        w:40, h:20 },
  {t:{leisure:'playground'},                            w:25, h:20 }
];
ESPERADO.forEach((e,i)=>geo.push({type:'way',id:id++,tags:e.t,geometry:rect(-300+i*160,100,e.w,e.h)}));

// ── Las dos trampas ───────────────────────────────────────────────────
geo.push({type:'way',id:id++,tags:{leisure:'pitch',access:'private',name:'Club campestre'},
  geometry:rect(200,-300,80,80)});
geo.push({type:'way',id:id++,tags:{highway:'pedestrian',name:'Peatonal del centro'},
  geometry:rect(-100,-350,60,8)});

const M2_ESPERADOS=ESPERADO.reduce((a,e)=>a+e.w*e.h,0);   // 10.000 + 3.600 + 800 + 500

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
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
  let pidioEspacio=false;
  await ctx.route(/overpass/, r=>{
    const q=decodeURIComponent((r.request().postData()||'')+r.request().url());
    const esTrazado=/out(\+|%20|\s)geom/.test(q);
    if(esTrazado) pidioEspacio=/leisure/.test(q) && /place.*square/.test(q);
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements: esTrazado?geo:usos})});
  });
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42}}]})}));
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r=>{
    const u=new URL(r.request().url());
    const lngs=(u.searchParams.get('longitude')||'').split(',').map(Number);
    r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({elevation:lngs.map(x=>340+114*((x-(C.lng-L))/(2*L)))})});
  });
  await ctx.route(/archive-api\.open-meteo\.com/, r=>{
    const dias=[]; const ini=new Date(Date.UTC(2021,0,1));
    for(let i=0;i<365*5;i++){
      const d=new Date(ini.getTime()+i*86400000), mes=d.getUTCMonth();
      const llueve=(mes===3||mes===4||mes===9||mes===10);
      dias.push({f:d.toISOString().slice(0,10),tMax:33,tMin:22,
        lluvia:llueve?(i%3===0?12:2):(i%9===0?3:0),viento:15,dir:45});
    }
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      timezone:'America/Bogota',
      daily:{ time:dias.map(x=>x.f), temperature_2m_max:dias.map(x=>x.tMax),
        temperature_2m_min:dias.map(x=>x.tMin), precipitation_sum:dias.map(x=>x.lluvia),
        wind_speed_10m_max:dias.map(x=>x.viento), wind_direction_10m_dominant:dias.map(x=>x.dir) }})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,140)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3400);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=el=>(el?(el.textContent||''):'').replace(/\s+/g,' ').trim();
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    // Unos puntos del curso, para que la lámina lleve también su caja.
    window.urbisDatosVisibles=function(){ return [
      { lat:C.lat+0.0009, lng:C.lng+0.0009, descripcion:'Comercial' },
      { lat:C.lat-0.0009, lng:C.lng-0.0009, descripcion:'Salud (Clínicas/Hospitales)' }
    ]; };
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    let lamina=''; window.AIA_INFORME=window.AIA_INFORME||{};
    window.AIA_INFORME.abrirVentanaImpresion=function(h){ lamina=h; };

    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(900);

    const H=()=>document.getElementById('pcr-hoja');
    /* Sin trazado no hay bloque. Se mira por la CABECERA y no por el texto
       de toda la hoja: «Armar el pliego» nombra las cajas que todavía no se
       pueden llenar —para eso está—, así que el título aparece ahí en gris
       aunque la sección no exista. Lo que no puede haber es la sección. */
    const cabeceras=()=>[...H().querySelectorAll('.pcr-h span')]
      .map(x=>(x.textContent||'').trim());
    o.antesNoEsta=cabeceras().indexOf('Espacio público efectivo')===-1;
    // Y en el inventario del pliego tiene que estar, gris y diciendo qué falta.
    o.antesEnElPliego=(function(){
      const b=H().querySelector('[data-pcr="pliego-caja"][data-c="espacio-publico-efectivo"]');
      return b?{ gris:b.classList.contains('pcr-capa-gris'),
                 pie:((b.querySelector('small')||{}).textContent||'').trim() }:null;
    })();

    await esperar(5200);   // el limitador de Overpass
    H().querySelector('[data-pcr="trazado"]').click();
    for(let i=0;i<70 && !document.querySelector('.pcr-llenos');i++) await esperar(400);
    await esperar(400);

    // El bloque: desde su título hasta el final de la hoja.
    const todo=txt(H());
    const i=todo.indexOf('Espacio público efectivo');
    o.bloque=i>=0?todo.slice(i,i+1400):'';
    o.kpis=[...H().querySelectorAll('.pcr-kpi')].map(txt);
    o.filas=[...H().querySelectorAll('.pcr-nivel')].map(n=>txt(n));
    o.piezas=[...H().querySelectorAll('.pcr-lote-fila')].map(txt);

    // La población que usó, para poder comprobar el m² por habitante.
    const m=o.bloque.match(/\(([\d.,]+) habitantes/);
    o.habitantes=m?Number(m[1].replace(/\./g,'').replace(',','.')):null;

    // Terreno y clima también: la lámina con TODO medido es el caso que más
    // papel pide, y es el que hay que vigilar.
    const medir=async(acc,sel)=>{
      const b=H().querySelector('[data-pcr="'+acc+'"]');
      if(!b) return false;
      b.click();
      for(let i=0;i<70 && !document.querySelector(sel);i++) await esperar(400);
      await esperar(300); return !!document.querySelector(sel);
    };
    o.midioTerreno=await medir('terreno','.pcr-corte');
    o.midioClima=await medir('clima','.pcr-clima-lluvia');

    /* Y la comparación con el campo: con esto la lámina lleva TODAS sus cajas,
       que es el caso que más papel pide y el que hay que vigilar. */
    const bc=H().querySelector('[data-pcr="campo"]');
    if(bc){
      bc.click();
      for(let i=0;i<60 && !/coinciden con el mapa/.test(txt(H()));i++) await esperar(400);
      await esperar(400);
    }
    o.midioCampo=/coinciden con el mapa/.test(txt(H()));

    // Y que llegue a la lámina.
    const bl=H().querySelector('[data-pcr="lamina"]');
    if(bl){ bl.click(); await esperar(400); }
    o.lamina=lamina;
    return o;
  },{C,POL});

  r.pidioEspacio=pidioEspacio;
  r.err=err.filter(e=>!/L is not defined|Unexpected end/.test(e));

  /* La lámina con todo medido, montada a 600 × 900 mm reales: si alguna caja
     se sale de su recuadro, en pantalla no se nota y en el papel sí. */
  const medidor=await ctx.newPage();
  await medidor.setViewportSize({width:2268,height:3402});
  await medidor.setContent(r.lamina||'<i></i>',{waitUntil:'load'});
  await medidor.waitForTimeout(400);
  /* Dos formas de perder una caja: que se recorte por dentro, o que en el
     flujo de columnas se vaya a una columna que no existe y desaparezca. Se
     miran las dos. */
  r.perdidas=await medidor.evaluate(()=>{
    const rej=document.querySelector('.rej'); if(!rej) return [];
    const R=rej.getBoundingClientRect();
    const fuera=[...rej.children].filter(c=>{ const b=c.getBoundingClientRect();
      return b.height===0 || b.right>R.right+2; })
      .map(c=>(c.querySelector('h2')||{}).textContent||'?');
    const h=document.querySelector('.hoja');
    if(h && h.scrollHeight>h.clientHeight+2)
      fuera.push('(la hoja se pasa '+(h.scrollHeight-h.clientHeight)+' px de alto)');
    return fuera;
  });
  r.desbordes=await medidor.evaluate(()=>[...document.querySelectorAll('.caja')]
    .filter(c=>c.scrollHeight>c.clientHeight+2)
    .map(c=>(c.querySelector('h2')||{}).textContent||'?'));
  await medidor.close();
  await pg.close(); await b.close();

  fs.writeFileSync(S+'lamina-generada.html', r.lamina||'', 'utf8');

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  const B=r.bloque||'', LAM=r.lamina||'';
  /* Las cifras se leen de los KPI del bloque, no del texto corrido: en el
     DOM el número y su rótulo van pegados («1,5hectáreas») y una expresión
     que espere un espacio no encuentra nada. */
  const kpi=re=>{
    const k=(r.kpis||[]).filter(x=>re.test(x))[0];
    if(!k) return null;
    const m=k.match(/^([\d.,]+)/);
    return m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
  };

  console.log('\n  -- se pide con el trazado, no aparte --');
  P('la consulta del trazado trae también el espacio público', r.pidioEspacio);
  P('y antes de medirlo el bloque no está', r.antesNoEsta);
  P('aunque el pliego ya lo nombre, en gris y diciendo qué falta',
    !!r.antesEnElPliego && r.antesEnElPliego.gris===true && /medí el trazado/.test(r.antesEnElPliego.pie),
    r.antesEnElPliego?r.antesEnElPliego.pie:'no está en el inventario');

  console.log('\n  -- los metros cuadrados --');
  const m2 = (kpi(/hect(á|a)reas de espacio/) || 0) * 10000;
  P('suma el área de los parques, plazas y canchas',
    Math.abs(m2 - M2_ESPERADOS) / M2_ESPERADOS < 0.03,
    'esperado ' + M2_ESPERADOS.toLocaleString('es-CO') + ' m² · da ' + Math.round(m2).toLocaleString('es-CO'));
  P('la cancha del club privado NO cuenta', !/Club campestre/.test(B) && m2 < M2_ESPERADOS + 6000,
    /Club campestre/.test(B) ? 'la cuenta' : 'queda fuera');
  P('ni la calle peatonal, que no es plaza', !/Peatonal del centro/.test(B));
  P('lo dice en porcentaje del sector', /% del área del sector/.test(B) || r.kpis.some(k=>/del área del sector/.test(k)),
    (r.kpis.filter(k=>/del área del sector/.test(k))[0]||'no sale'));

  console.log('\n  -- el metro cuadrado por habitante --');
  const porHab = kpi(/m² por habitante/);
  P('usa la población estimada del sector', r.habitantes > 0, r.habitantes + ' habitantes');
  P('y divide el área entre ella',
    porHab != null && r.habitantes && Math.abs(porHab - m2 / r.habitantes) < 0.3,
    porHab + ' m²/hab · esperado ' + (r.habitantes ? (m2 / r.habitantes).toFixed(1) : '?'));
  P('compara con la meta del Decreto 1504 de 1998',
    /Decreto 1504 de 1998/.test(B) && /15 m²\/hab/.test(B), (B.match(/meta nacional \([^)]*\)/)||['no la nombra'])[0]);
  P('y dice de qué lado está', /por debajo de la meta/i.test(B) || /cumple la meta/i.test(B),
    (B.match(/(Muy p|P)or debajo[^.]*\.|cumple la meta[^.]*\./)||['no lo dice'])[0].slice(0,80));

  console.log('\n  -- de qué está hecho --');
  const clases=r.filas.filter(f=>/Parques|Plazas|deportivos|infantiles/.test(f));
  P('reparte el área por tipo de espacio', clases.length>=3, clases.join(' | '));
  P('y nombra las piezas más grandes',
    /Parque Colón/.test(B) && /Plaza La Concordia/.test(B),
    r.piezas.filter(x=>/Parque|Plaza|Cancha/.test(x)).join(' | '));

  console.log('\n  -- honestidad --');
  P('dice que no cuenta andenes ni vías', /No.{0,3} cuenta andenes ni vías/i.test(B));
  P('y que lo que nadie mapeó no aparece', /nadie ha mapeado|no está en OpenStreetMap|Tampoco cuenta lo privado/i.test(B));

  console.log('\n  -- llega a la lámina --');
  P('con todo medido, ninguna caja se sale de su recuadro',
    (r.desbordes||[]).length===0, (r.desbordes||[]).join(' · ')||'ninguna');
  P('ni se pierde fuera de la hoja', (r.perdidas||[]).length===0,
    (r.perdidas||[]).join(' · ')||'ninguna');
  P('y con todo medido: terreno, clima y campo',
    r.midioTerreno && r.midioClima && r.midioCampo,
    'terreno '+r.midioTerreno+' · clima '+r.midioClima+' · campo '+r.midioCampo);
  P('la lámina trae el bloque', /Espacio público efectivo<\/h2>/.test(LAM));
  P('con los metros por habitante', new RegExp('m² por habitante').test(LAM));
  P('y con la meta del decreto', /Decreto 1504/.test(LAM));

  console.log('');
  P('sin errores de JavaScript', r.err.length===0, r.err.join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
