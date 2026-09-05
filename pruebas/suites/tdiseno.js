const E = require('../entorno.js');
/* La capa de diseño del modo educativo: iconos lineales en vez de emojis en
   cabeceras, botones y pestañas; jerarquía de títulos; y contraste real en
   todo el texto de la hoja, la pestaña y el panel. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, L=0.004;
const POL=[{lat:C.lat-L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng-L},{lat:C.lat+L,lng:C.lng+L},{lat:C.lat-L,lng:C.lng+L}];
const TIPOS=[{amenity:'pharmacy'},{shop:'supermarket'},{amenity:'restaurant'},{amenity:'school'},{leisure:'park'},{amenity:'bus_station'}];
const elements=[]; for(let i=0;i<60;i++){ const a=i*6*Math.PI/180, d=(80+(i%6)*40)/111320;
  elements.push({type:'node',id:5000+i,lat:C.lat+Math.cos(a)*d,lon:C.lng+Math.sin(a)*d,tags:Object.assign({name:'M'+i},TIPOS[i%TIPOS.length])}); }
elements.push({type:'way',id:5001,tags:{highway:'primary',name:'Avenida Libertadores'},center:{lat:C.lat+0.001,lon:C.lng+0.001}});
const EMOJI=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2934}\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}\u{FE0F}]/u;
function lum(c){const m=(String(c).match(/\d+/g)||[255,255,255]).slice(0,3).map(Number);const lin=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*lin(m[0])+0.7152*lin(m[1])+0.0722*lin(m[2]);}

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
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
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t',active:true,verified:true,nombre_completo:'D'}));
    localStorage.removeItem('aia_overpass_cache_v1'); localStorage.removeItem('pcr_fichas_v1'); localStorage.removeItem('pc_areas_analisis_v1');
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url(); r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route(/cdn\.jsdelivr\.net/, r=>r.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(S+'node_modules/chart.js/dist/chart.umd.js','utf8')}));
  await ctx.route(/locationiq\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({address:{city:'Cúcuta'}})}));
  await ctx.route(/ags\.esri\.co/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:[{attributes:{TOTAL:3045,N:42,HOM:1490,MUJ:1555,E0_4:210,E5_9:180,E10_14:170,E15_19:160,E20_24:230,E25_29:250,E30_34:240,E35_39:220,E40_44:200,E45_49:180,E50_54:160,E55_59:150,E60_64:130,E65_69:110,E70_74:90,E75_79:70,E80YMAS:50}}]})}));
  await ctx.route(/overpass/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})}));
  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,120)));
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4500);

  const r=await pg.evaluate(async (D)=>{
    const {C,POL}=D, o={}, esperar=ms=>new Promise(r=>setTimeout(r,ms));
    const EMOJI=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const texto=el=>(el.textContent||'').trim();
    const tinta=el=>{const cs=getComputedStyle(el); return (cs.webkitTextFillColor&&cs.webkitTextFillColor!=='currentcolor')?cs.webkitTextFillColor:cs.color;};
    const fondo=el=>{ let e=el; while(e){ const bg=getComputedStyle(e).backgroundColor; if(bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; e=e.parentElement; } return 'rgb(255, 255, 255)'; };
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    window.map.setView([C.lat,C.lng],15); await esperar(500);
    const A=window.URBIS_PC_ANALISIS, R=window.URBIS_PC_RECON;

    // botones flotantes del modo educativo
    o.flotantes=['.u52-procity-recon-btn','.u52-procity-dibujar-btn','.u52-procity-perfil-btn'].map(s=>{
      const e=document.querySelector(s); return e ? (e.querySelector('svg.u-ico')?'svg':texto(e)) : 'no está'; });

    // la barra inferior de Pro City: cinco botones, todos con trazo
    o.nav=[...document.querySelectorAll('.u52-procity-nav button')].map(b=>b.querySelector('svg.u-ico')?'svg':texto(b));

    // la hoja: pantalla inicial
    R.abrir(); await esperar(300);
    let h=document.getElementById('pcr-hoja');
    o.barraEyebrow=!!h.querySelector('.pcr-barra .pcr-eyebrow');
    o.barraSinEmoji=!EMOJI.test(texto(h.querySelector('.pcr-barra')));
    o.formasConIcono=h.querySelectorAll('.pcr-forma svg.u-ico').length;

    // analizar por área
    A.iniciarDibujo(); POL.forEach(p=>A.agregarPunto(p.lat,p.lng)); A.agregarPunto(POL[0].lat,POL[0].lng);
    R.cerrar(); await esperar(150); R.abrir(); await esperar(300);
    await R.analizar(); await esperar(700);
    h=document.getElementById('pcr-hoja');
    const hs=Array.from(h.querySelectorAll('.pcr-h'));
    o.cabeceras=hs.length;
    o.cabecerasConIcono=hs.filter(x=>x.querySelector('.pcr-h-ico svg')).length;
    o.cabecerasConEmoji=hs.filter(x=>EMOJI.test(texto(x))).map(x=>texto(x).slice(0,30));
    const bts=Array.from(h.querySelectorAll('button.pcr-mini, button.pcr-principal, .pcr-cal-chip'));
    o.botones=bts.length;
    o.botonesConEmoji=bts.filter(x=>EMOJI.test(texto(x))).map(x=>texto(x).slice(0,30));
    // contraste de TODO texto visible de la hoja
    const cand=Array.from(h.querySelectorAll('p,small,span,b,li,label,h4,button,code,em,td,th'))
      .filter(e=>e.children.length===0 && texto(e).length>1 && e.getBoundingClientRect().width>0);
    const flojos=[];
    cand.forEach(e=>{ const c=(()=>{const L1=lum(tinta(e)),L2=lum(fondo(e));const hi=Math.max(L1,L2),lo=Math.min(L1,L2);return (hi+.05)/(lo+.05);})();
      if(c<4.5) flojos.push(e.className+':'+texto(e).slice(0,18)+'='+c.toFixed(1)); });
    function lum(c){const m=(String(c).match(/\d+/g)||[255,255,255]).slice(0,3).map(Number);const lin=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*lin(m[0])+0.7152*lin(m[1])+0.0722*lin(m[2]);}
    o.textosHoja=cand.length; o.flojosHoja=flojos.slice(0,6); o.nFlojosHoja=flojos.length;
    // tipografía: Inter en la hoja
    o.fuenteHoja=getComputedStyle(h.querySelector('.pcr-barra b')).fontFamily.split(',')[0].replace(/"/g,'');
    o.tituloTam=getComputedStyle(h.querySelector('.pcr-barra b')).fontSize;

    // la pestaña «Sector» y las pestañas
    R.cerrar(); await esperar(200);
    window.urbisProCityAbrirSector(); await esperar(500);
    const tabs=Array.from(document.querySelectorAll('.u52-procity-stats-tabs button'));
    o.tabs=tabs.length; o.tabsConSvg=tabs.filter(t=>t.querySelector('svg.u-ico')).length;
    o.tabsConEmoji=tabs.filter(t=>EMOJI.test(texto(t))).length;
    o.eyebrowHoja=!!document.querySelector('.u52-procity-sheet-head .u52-procity-eyebrow');
    const cab=document.querySelector('.pcr-pest-cab'); if(cab){ cab.click(); await esperar(400); }
    const pest=document.querySelector('.pcr-pestana');
    const cand2=Array.from(pest.querySelectorAll('p,small,span,b,li,label,h4,button,code,em'))
      .filter(e=>e.children.length===0 && texto(e).length>1 && e.getBoundingClientRect().width>0);
    const flojos2=[];
    cand2.forEach(e=>{ const L1=lum(tinta(e)),L2=lum(fondo(e));const hi=Math.max(L1,L2),lo=Math.min(L1,L2);const c=(hi+.05)/(lo+.05);
      if(c<4.5) flojos2.push(e.className+':'+texto(e).slice(0,18)+'='+c.toFixed(1)); });
    o.textosPest=cand2.length; o.flojosPest=flojos2.slice(0,6); o.nFlojosPest=flojos2.length;
    o.pestCabecerasConIcono=pest.querySelectorAll('.pcr-h .pcr-h-ico svg').length;
    return o;
  },{C,POL});
  await pg.screenshot({path:S+'diseno-sector.png'});
  await pg.evaluate(async()=>{ window.urbisProCityCerrarStats(); await new Promise(r=>setTimeout(r,200)); window.URBIS_PC_RECON.abrir(); });
  await pg.waitForTimeout(600);
  await pg.evaluate(()=>{ const h=document.getElementById('pcr-hoja'); h.style.maxHeight='none'; h.style.height='auto'; h.style.top='0'; });
  await (await pg.$('#pcr-hoja')).screenshot({path:S+'diseno-ficha.png'});

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };
  console.log('\n  -- iconos en vez de emojis --');
  P('los botones del mapa llevan icono lineal', r.flotantes.every(x=>x==='svg'), r.flotantes.join(' · '));
  P('la barra inferior de Pro City lleva icono lineal', r.nav.length===5 && r.nav.every(x=>x==='svg'), r.nav.join(' · '));
  P('la barra de la hoja lleva eyebrow y sin emoji', r.barraEyebrow && r.barraSinEmoji);
  // Tres desde que se puede empezar por el lote: radio, área dibujada y lote.
  P('los tres selectores de forma llevan icono', r.formasConIcono===3, r.formasConIcono);
  P('todas las cabeceras de la ficha llevan icono', r.cabeceras>=12 && r.cabecerasConIcono===r.cabeceras, r.cabecerasConIcono+' de '+r.cabeceras);
  P('y ninguna lleva emoji', r.cabecerasConEmoji.length===0, r.cabecerasConEmoji.join(' | ')||'ninguna');
  P('ningún botón de la ficha lleva emoji', r.botonesConEmoji.length===0, (r.botonesConEmoji.join(' | ')||r.botones+' botones limpios'));
  P('las pestañas llevan icono y no emoji', r.tabs===6 && r.tabsConSvg===6 && r.tabsConEmoji===0, r.tabsConSvg+'/'+r.tabs+' con svg · '+r.tabsConEmoji+' con emoji');
  P('la hoja de estadísticas lleva eyebrow', r.eyebrowHoja);
  console.log('\n  -- tipografía y legibilidad --');
  P('Inter en la hoja', /Inter/.test(r.fuenteHoja), r.fuenteHoja+' · título '+r.tituloTam);
  P('todo el texto de la ficha pasa 4.5:1', r.nFlojosHoja===0, r.nFlojosHoja+' de '+r.textosHoja+' flojos'+(r.flojosHoja.length?' → '+r.flojosHoja.join(' ; '):''));
  P('todo el texto de la pestaña pasa 4.5:1', r.nFlojosPest===0, r.nFlojosPest+' de '+r.textosPest+' flojos'+(r.flojosPest.length?' → '+r.flojosPest.join(' ; '):''));
  P('las cabeceras del informe guardado llevan icono', r.pestCabecerasConIcono>=6, r.pestCabecerasConIcono);
  console.log('');
  const errR=err.filter(e=>!/L is not defined|Unexpected end/.test(e));
  P('sin errores de JavaScript', errR.length===0, errR.slice(0,2).join(' / ')||'ninguno');
  console.log(mal? '\n  '+mal+' fallaron\n' : '\n  todo pasó\n');
  await b.close(); process.exit(mal?1:0);
})();
