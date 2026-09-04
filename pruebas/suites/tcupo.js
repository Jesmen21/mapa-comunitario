const E = require('../entorno.js');
/* Tanda AB · cuando el teléfono se queda sin sitio.

   El almacenamiento de un navegador son unos cinco megabytes y no avisa de
   nada: `setItem` lanza, y quien no mire lo que devuelve pierde el trabajo
   sin enterarse. El módulo estaba lleno de `try {} catch (e) {}` alrededor
   del guardado automático, así que la pérdida era silenciosa por diseño:
   medido con el almacenamiento lleno, una estudiante dibujaba una marca
   intangible, la veía en el mapa, cerraba la aplicación y la marca no
   estaba.

   Lo que se comprueba acá no es que quepa todo —no cabe—, sino el orden en
   que se suelta lastre y que se diga:

     · primero la caché de consultas, que se vuelve a llenar sola;
     · después los puntos del sector, que los devuelve una consulta;
     · las fichas viejas, de una en una, al final;
     · y lo que una persona caminó, nunca.

   Una ficha llena pesa 44 KB, de los cuales 31 son los puntos.            */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const path=require('path');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});

// Un sector poblado: son los 31 KB de puntos que hacen pesada a una ficha.
let id=1; const usos=[];
for(let i=0;i<300;i++){ const a=i*7*Math.PI/180, d=(120+(i%9)*40)/111320;
  usos.push({type:'node',id:id++,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,
    tags:{name:'Establecimiento número '+i, amenity:['pharmacy','restaurant','school','bank','cafe'][i%5]}}); }

/* Los recorridos de un curso entero: 133 KB que NO se pueden volver a pedir a
   ningún servidor. Es el caso en que no queda lastre que soltar. */
const DIR = path.join(S, 'recorridos-cupo');
fs.mkdirSync(DIR, { recursive: true });
const archivos=[];
for(let a=0;a<14;a++){
  const marcas=[];
  for(let m=0;m<10;m++){
    const pts=[]; for(let v=0;v<24;v++){ const ang=v*15*Math.PI/180;
      pts.push(Q(60+m*12+Math.cos(ang)*30, 60+m*9+Math.sin(ang)*30)); }
    marcas.push({id:'m'+a+'_'+m, tipo:['inseguro','agradable','ruidoso'][m%3], geom:'zona',
      nota:'Nota de campo número '+m+' del recorrido de la persona '+a,
      ts:new Date().toISOString(), pts});
  }
  const f=path.join(DIR,'p'+a+'.json');
  fs.writeFileSync(f, JSON.stringify({formato:'urbis-intangible-1', autor:'Estudiante '+a,
    sector:'El barrio', centro:{lat:C.lat,lng:C.lng}, cuando:new Date().toISOString(), marcas}),'utf8');
  archivos.push(f);
}

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',timezoneId:'America/Bogota',locale:'es-CO',
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'martarojas',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true}));
    /* Solo en el primer arranque: esta prueba recarga la página a propósito
       para ver qué sobrevivió, y limpiar en cada carga borraría justo lo que
       se quiere medir. */
    if(!localStorage.getItem('__cupo_limpio')){
      localStorage.removeItem('aia_overpass_cache_v1');
      localStorage.removeItem('pcr_fichas_v1');
      localStorage.setItem('__cupo_limpio','1');
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

  // ── El sector, guardado con sitio de sobra.
  const holgado=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;
    const bPC=document.querySelector('[data-u52-call="procity-open-map"]');
    if(bPC){ bPC.click(); await esperar(600); }
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(1500);
    const H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); }
    const bg=[...H().querySelectorAll('button')].filter(b=>/Guardar ficha/i.test(b.textContent||''))[0];
    if(bg){ bg.click(); await esperar(600); }
    const t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.guardada=(R.leerFichas()||[]).length;
    o.pesoKB=Math.round(JSON.stringify((R.leerFichas()||[])[0]||{}).length/1024);
    o.puntos=(((R.leerFichas()||[])[0]||{}).pois||[]).length;
    // Con sitio de sobra no se habla de espacio: una alarma falsa gasta la
    // credibilidad de la verdadera.
    o.callaDelEspacio=!/(no hay espacio|se guardó sin sus|se vació la caché|se borr)/i.test(t);
    o.diceQueGuardó=/Ficha guardada/i.test(t);
    return o;
  },{C,POL});

  // ── Se llena el almacenamiento hasta el borde y se sigue trabajando.
  const lleno=await pg.evaluate(async (D)=>{
    const {C}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    // Bloques cada vez más chicos: al final no queda ni un hueco aprovechable.
    /* Bloques cada vez más chicos hasta que no entra ni uno: con un solo
       tamaño quedan huecos y el almacenamiento no llega a estar lleno de
       verdad. Se lleva la cuenta de las claves para poder soltarlas después
       sin recorrer el almacenamiento entero. */
    window.__lastre=0;
    [64*1024, 4*1024, 512, 16].forEach(function(t){
      const bloque='x'.repeat(t);
      try { for(let i=0;i<400;i++) localStorage.setItem('__l'+(window.__lastre++), bloque); } catch(e){}
    });
    /* Se sondea con 512 bytes y no con cuatro kilobytes: reescribir la ficha
       reemplaza la que ya está, así que lo único que hace falta de más son
       unos cientos de bytes. Un hueco de un kilobyte basta para que no haya
       que soltar nada y la prueba mediría otra cosa. */
    o.sinSitio=(function(){ try{ localStorage.setItem('__p','x'.repeat(512)); localStorage.removeItem('__p'); return false; }catch(e){ return true; } })();

    // Trabajo de campo de verdad: una marca intangible dibujada a mano.
    await abrir();
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="inseguro"]');
    o.hayLapiz=!!lap;
    if(lap){ lap.click(); await esperar(350);
      [[70,70],[130,70],[130,130],[70,130]].forEach(([x,y])=>{
        const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
      await esperar(250);
      const c=document.querySelector('#pcr-int-barra [data-int="cerrar"]');
      if(c){ c.click(); await esperar(800); }
    }
    o.enMemoria=(R.intangibleDePrueba()||[]).length;
    o.enElDisco=(function(){ try{ return ((R.leerFichas()||[])[0].intangible||[]).length; }catch(e){ return -1; } })();
    o.puntosTrasSoltar=(function(){ try{ return ((R.leerFichas()||[])[0].pois||[]).length; }catch(e){ return -1; } })();
    o.sinPuntos=(function(){ try{ return (R.leerFichas()||[])[0].sinPuntos||0; }catch(e){ return -1; } })();
    await abrir();
    const t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.diceCache=/se vació la caché de consultas/i.test(t);
    o.texto=(t.match(/[^.]{0,40}(sin espacio|se guardó sin sus|se vació la caché|se borr)[^.]{0,140}\./i)||[])[0]||'';
    o.noMiente=!/(No se pudo guardar|no hay espacio en este teléfono)/i.test(t);
    return o;
  },{C});

  /* ── Segunda vuelta: la caché ya no está, así que el siguiente lastre son
     los puntos del sector. */
  const puntos=await pg.evaluate(async (D)=>{
    const {C}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const GLAT=m=>m/110540, GLNG=m=>m/(111320*Math.cos(C.lat*Math.PI/180));
    const Q=(dx,dy)=>({lat:C.lat+GLAT(dy), lng:C.lng+GLNG(dx)});
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    [64*1024, 4*1024, 512, 16].forEach(function(t){
      const bloque='x'.repeat(t);
      try { for(let i=0;i<400;i++) localStorage.setItem('__l'+(window.__lastre++), bloque); } catch(e){}
    });
    await abrir();
    const lap=H().querySelector('[data-pcr="int-dibujar"][data-t="agradable"]');
    if(lap){ lap.click(); await esperar(350);
      [[-70,70],[-130,70],[-130,130],[-70,130]].forEach(([x,y])=>{
        const p=Q(x,y); window.map.fire('click',{latlng:{lat:p.lat,lng:p.lng}}); });
      await esperar(250);
      const c=document.querySelector('#pcr-int-barra [data-int="cerrar"]');
      if(c){ c.click(); await esperar(800); }
    }
    o.enMemoria=(R.intangibleDePrueba()||[]).length;
    o.enElDisco=(function(){ try{ return ((R.leerFichas()||[])[0].intangible||[]).length; }catch(e){ return -1; } })();
    o.quedan=(function(){ try{ return ((R.leerFichas()||[])[0].pois||[]).length; }catch(e){ return -1; } })();
    o.sinPuntos=(function(){ try{ return (R.leerFichas()||[])[0].sinPuntos||0; }catch(e){ return -1; } })();
    await abrir();
    const t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.loDice=/se guardó sin sus 300 usos/i.test(t);
    o.diceQuéQueda=/marcas, el lote y los recorridos del curso quedaron completos/i.test(t);
    return o;
  },{C});

  // ── Y ahora el curso entero, que no se puede soltar.
  await pg.setInputFiles('#pcr-int-archivo', archivos);
  await pg.waitForTimeout(2600);
  const curso=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON, H=()=>document.getElementById('pcr-hoja');
    const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(500); }
    o.enMemoria=(R.cursoDePrueba()||[]).length;
    o.enElDisco=(function(){ try{ return ((R.leerFichas()||[])[0].intCurso||[]).length; }catch(e){ return -1; } })();
    const t=(H().textContent||'').replace(/\s+/g,' ').trim();
    o.avisa=/no hay espacio en este teléfono para guardar el sector/i.test(t);
    o.diceQuéHacer=/se pierde si cerrás la aplicación/i.test(t) && /borrá sectores guardados/i.test(t);
    /* El aviso de pérdida va arriba del todo: enterarse al pie de una hoja de
       tres pantallas, después de media hora de trabajo, no sirve de nada. */
    const cuerpo=H().querySelector('.pcr-cuerpo');
    const malo=H().querySelector('.pcr-guardado-mal');
    o.arriba=!!(cuerpo && malo && cuerpo.firstElementChild===malo);
    // Y la importación no puede tapar el aviso con su propia buena noticia.
    o.noLoTapa=/Se juntaron 14 recorridos/i.test(t) ? /no hay espacio en este teléfono/i.test(t) : true;
    return o;
  });

  // ── Lo guardado se lee sin mentir: un sector sin sus puntos lo dice.
  const reabierta=await pg.evaluate(async ()=>{
    const o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const R=window.URBIS_PC_RECON;
    // Sitio otra vez, para que leer la ficha no compita con el lastre.
    for(let i=0;i<window.__lastre;i++) localStorage.removeItem('__l'+i);
    const f=(R.leerFichas()||[])[0];
    o.hayFicha=!!f;
    // Se abre la tarjeta del sector en la pestaña «Sector», que es como se
    // relee un sector guardado semanas después.
    R.accion('ver', { getAttribute: function(){ return f ? f.id : ''; } });
    await esperar(200);
    const html=R.htmlPestana();
    o.loDice=/se guardó sin sus 300 usos/i.test(html);
    o.totalEnLaTarjeta=(html.match(/<b>(\d+)<\/b><small>usos registrados/)||[])[1]||'';
    o.marcasIntactas=((f&&f.intangible)||[]).length;

    /* Con sitio otra vez, el siguiente guardado cabe y la advertencia tiene
       que apagarse: una alarma que sigue encendida cuando ya no pasa nada
       deja de leerse a los dos minutos. */
    const H=()=>document.getElementById('pcr-hoja');
    const abrir=async()=>{ const a=H().querySelector('[data-pcr="agrandar"]'); if(a){ a.click(); await esperar(400); } };
    await abrir();
    o.seguíaEncendida=!!H().querySelector('.pcr-guardado-mal');
    const bt=H().querySelector('[data-pcr="int-curso-borrar"]');
    if(bt){ bt.click(); await esperar(800); }
    await abrir();
    o.seApagó=!H().querySelector('.pcr-guardado-mal');
    o.yGuardó=(function(){ try{ return ((R.leerFichas()||[])[0].intangible||[]).length; }catch(e){ return -1; } })();
    return o;
  });

  const errFin=err.filter(e=>!/L is not defined|Unexpected end|QuotaExceeded/.test(e));
  await pg.close(); await b.close();

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const T=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- con sitio de sobra --');
  T('la ficha se guarda entera', holgado.guardada===1 && holgado.puntos===300,
    holgado.pesoKB+' KB · '+holgado.puntos+' puntos');
  T('y se dice, sin hablar de espacio', holgado.diceQueGuardó && holgado.callaDelEspacio);

  console.log('\n  -- con el almacenamiento lleno --');
  T('no queda sitio ni para medio kilobyte', lleno.sinSitio===true);
  T('la marca dibujada llega al disco igual', lleno.hayLapiz && lleno.enMemoria===1 && lleno.enElDisco===1,
    lleno.enMemoria+' en pantalla · '+lleno.enElDisco+' guardadas');
  /* Lo primero que se suelta es la caché de consultas: se vuelve a llenar
     sola y no le cuesta a nadie más que unos segundos. Los puntos del sector
     todavía no se tocan. */
  T('soltando primero la caché de consultas, que se vuelve a llenar sola',
    lleno.diceCache===true && lleno.puntosTrasSoltar===300,
    lleno.texto||'no dice nada');
  T('sin dar por perdido lo que sí se guardó', lleno.noMiente===true);

  console.log('\n  -- y cuando ya no queda caché --');
  T('la segunda marca también llega al disco', puntos.enMemoria===2 && puntos.enElDisco===2,
    puntos.enMemoria+' en pantalla · '+puntos.enElDisco+' guardadas');
  T('soltando ahora los puntos del sector, que los devuelve una consulta',
    puntos.quedan===0 && puntos.sinPuntos===300,
    'quedan '+puntos.quedan+' puntos · sinPuntos='+puntos.sinPuntos);
  T('y diciendo qué se soltó y qué no', puntos.loDice===true && puntos.diceQuéQueda===true);

  console.log('\n  -- cuando ya no queda lastre que soltar --');
  /* 133 KB de recorridos de catorce personas. No hay servidor al que
     pedírselos otra vez, así que no se sueltan: se avisa. */
  T('un guardado que no cabe no rompe lo que ya estaba guardado',
    reabierta.marcasIntactas===2,
    curso.enMemoria+' recorridos traídos · '+curso.enElDisco+' guardados · '+
    reabierta.marcasIntactas+' marcas intactas en el disco');
  T('se avisa de que el sector NO se está guardando', curso.avisa===true);
  T('con qué hacer al respecto', curso.diceQuéHacer===true);
  T('arriba del todo, no al pie de la hoja', curso.arriba===true);
  T('y la buena noticia de la importación no lo tapa', curso.noLoTapa===true);

  console.log('\n  -- y lo guardado se lee sin mentir --');
  T('el sector sin puntos lo dice al reabrirlo', reabierta.hayFicha && reabierta.loDice===true);
  /* Los usos se contaron: lo que no cupo fue la lista. Si la tarjeta dijera
     cero, la lectura obvia —«en este barrio no hay nada»— sería falsa. */
  T('y sigue diciendo cuántos usos había, que eso sí se midió',
    reabierta.totalEnLaTarjeta==='300', reabierta.totalEnLaTarjeta+' usos registrados');

  console.log('\n  -- y la alarma se apaga cuando vuelve a haber sitio --');
  /* Las dos mitades juntas y no por separado: sin la de arriba, «se apagó»
     lo cumple también una hoja que nunca encendió nada, que es justo lo que
     hacía el código de antes. */
  T('estaba encendida mientras no cabía, y se apaga con el primero que sí cabe',
    reabierta.seguíaEncendida===true && reabierta.seApagó===true);
  T('y ese guardado llega al disco', reabierta.yGuardó===2,
    reabierta.yGuardó+' marcas guardadas');

  console.log('');
  T('sin errores de JavaScript', errFin.length===0, errFin.slice(0,2).join(' | ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó'));
  process.exit(mal?1:0);
})();
