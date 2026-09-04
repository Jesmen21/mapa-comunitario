const E = require('../entorno.js');
/* Fase 2: el área dibujada. Se dibuja un polígono REAL con las mismas
   funciones de Pro City que usa el estudiante, y se comprueba que:
     · la consulta a Overpass sale con (poly:...) y no con (around:...)
     · el informe cuenta solo lo de adentro
     · la ficha habla de área y no de radio

   Los puntos se reparten mitad dentro y mitad fuera a propósito. Con todos
   adentro, un filtro roto pasaría la prueba sin que nadie lo note. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const LEAFLET=E.MODULOS + '/leaflet/dist/';
const C={lat:7.8939,lng:-72.5078}, LADO=0.0045;

// El polígono cubre el cuadrante noreste. 60 puntos dentro, 60 fuera.
const POL=[{lat:C.lat,lng:C.lng},{lat:C.lat+LADO,lng:C.lng},
           {lat:C.lat+LADO,lng:C.lng+LADO},{lat:C.lat,lng:C.lng+LADO}];
const TIPOS=[{amenity:'pharmacy'},{shop:'supermarket'},{amenity:'restaurant'},{shop:'bakery'}];
const elements=[]; let dentro=0;
for(let i=0;i<120;i++){
  const adentro = i%2===0; if(adentro) dentro++;
  elements.push({type:'node',id:7000+i,
    lat: C.lat + (adentro ?  0.0008+(i%9)*0.0004 : -(0.0008+(i%9)*0.0004)),
    lon: C.lng + (adentro ?  0.0008+(i%7)*0.0004 : -(0.0008+(i%7)*0.0004)),
    tags:Object.assign({name:'Q'+i},TIPOS[i%TIPOS.length])});
}

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  const ctx=await b.newContext({serviceWorkers:'block'});
  /* La dirección del motor entra a la página desde acá: dentro de un
     `evaluate` no existe el `require` de node, así que se la deja en
     `window` antes de cargar nada. */
  await ctx.addInitScript(m => { window.__URBIS_MOTOR = m; }, E.MOTOR);
  await ctx.addInitScript(()=>{ try{
    /* Desde que la licencia se pide AL TOCAR el botón (js/69 permitido),
       una suite sin licencia guardada se queda en la pantalla de licencia
       en vez de analizar. Es el comportamiento correcto: acá se pone la
       licencia igual que la pondría el curso en cada dispositivo. */
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1',JSON.stringify({usuario:'urbisprocity',rol:'admin',es_admin:true,session_token:'t'}));
    localStorage.removeItem('aia_overpass_cache_v1');
  }catch(e){} });
  await ctx.route('**', r => /localhost:(8199|8787)/.test(r.request().url()) ? r.continue() : r.abort());
  await ctx.route('**/script.google.com/**', r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  await ctx.route('**/unpkg.com/**', r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',
      body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});

  let consultas=[];
  await ctx.route('**/overpass**', r=>{
    consultas.push(decodeURIComponent(r.request().postData()||''));
    // Overpass filtraría por el polígono; acá se devuelve TODO a propósito,
    // para que quien tenga que recortar sea el servidor y se note si no lo hace.
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements})});
  });

  const pg=await ctx.newPage();
  const err=[]; pg.on('pageerror',e=>err.push(String(e.message).slice(0,120)));
  await pg.goto(E.ESTATICO + '/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);

  const r = await pg.evaluate(async (D) => {
    const {C,POL}=D, o={};
    window.URBIS_CONFIG.ANALISIS.API=window.__URBIS_MOTOR;
    const m=window.map; m.setView([C.lat+0.002,C.lng+0.002],15);
    await new Promise(r=>setTimeout(r,700));

    // Se dibuja el área con las MISMAS funciones que usa el estudiante.
    const A=window.URBIS_PC_ANALISIS;
    A.iniciarDibujo();
    POL.forEach(p=>A.agregarPunto(p.lat,p.lng));
    A.agregarPunto(POL[0].lat,POL[0].lng);          // toca el primer punto: cierra
    o.areaCerrada = A.hayArea();
    o.vertices = A.puntosDelArea().length;
    if(!o.areaCerrada) return o;

    // El mapa se va LEJOS del área ANTES de abrir la hoja: es lo que pasa
    // cuando alguien dibuja un área, sigue explorando el mapa, y después
    // decide analizarla. Al abrir, el centro del mapa queda a 10 km del
    // polígono. Los rumbos deben medirse desde el CENTROIDE del área; si se
    // midieran desde el centro del mapa, los 60 puntos caerían todos en una
    // sola dirección y la ficha diría «7 rumbos sin datos», mandando al
    // estudiante a la otra punta de la ciudad.
    m.setView([C.lat - 0.09, C.lng - 0.09], 13);
    await new Promise(r=>setTimeout(r,700));

    window.URBIS_PC_RECON.abrir();
    o.eligioPoligonoSolo = window.URBIS_PC_RECON.estado().forma;
    o.centroLejano = window.URBIS_PC_RECON.estado().centro;

    await window.URBIS_PC_RECON.analizar();
    const h=document.getElementById('pcr-hoja');
    o.texto=h.innerText;
    o.total=(o.texto.match(/(\d+)\s*\n?\s*usos registrados/)||[])[1];
    o.diceArea=/de área dibujada/.test(o.texto);
    o.diceRadio=/de radio/.test(o.texto);
    o.tituloArea=/Lo que hay en el área/.test(o.texto);
    o.pintaPoligono = !!document.querySelector('.leaflet-overlay-pane path');
    return o;
  }, {C,POL});

  const ok=(n,c,d)=>{console.log('  '+(c?'✓':'✗')+' '+n+(d!==undefined?'  — '+d:'')); return !!c;};
  let mal=0; const P=(n,c,d)=>{ if(!ok(n,c,d)) mal++; };

  console.log('\n  -- usa el dibujo que Pro City ya tiene --');
  P('el área se cierra con las funciones de Pro City', r.areaCerrada, r.vertices+' vértices');
  P('al abrir, elige el polígono solo', r.eligioPoligonoSolo==='poligono', r.eligioPoligonoSolo);
  P('lo pinta en el mapa', r.pintaPoligono);

  console.log('\n  -- le pide a Overpass el área, no un círculo --');
  const q=consultas.join(' ');
  P('la consulta lleva (poly:...)', /\(poly:"/.test(q));
  P('y NO lleva (around:...)', !/\(around:/.test(q));
  P('con los vértices dentro', /7\.89\d+ -72\.50\d+/.test(q), (q.match(/poly:"([^"]{0,60})/)||[])[1]);

  console.log('\n  -- recorta de verdad --');
  P('el informe no viene vacío', Number(r.total)>0, r.total+' usos');
  P('cuenta SOLO lo de adentro', Number(r.total)===dentro, r.total+' de '+dentro+' que hay dentro (de 120 enviados)');

  console.log('\n  -- los rumbos se miden desde el centroide del área --');
  const nRumbos = Number((r.texto.match(/(\d+)\s*\n?\s*rumbos sin datos/)||[])[1]);
  P('no los mide desde el centro del mapa', nRumbos < 7,
    nRumbos + ' rumbos sin datos (7 significaría que usó el mapa, que está a 10 km)');

  console.log('\n  -- y lo dice como área, no como radio --');
  P('el título habla del área', r.tituloArea);
  P('muestra hectáreas, no metros de radio', r.diceArea && !r.diceRadio);

  console.log('');
  P('sin errores de JavaScript', err.filter(e=>!/L is not defined|Unexpected end/.test(e)).length===0, err.slice(0,2).join(' / ')||'ninguno');
  console.log('\n  '+(mal?mal+' fallaron':'todo pasó')+'\n');
  if(!mal){ console.log('  ── LA FICHA ──\n'); console.log(r.texto.split('\n').slice(0,14).map(l=>'  │ '+l).join('\n')); }
  await b.close(); process.exit(mal?1:0);
})();
