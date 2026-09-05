const E = require('../entorno.js');
/* El «+» del centro de la barra de Pro City: ¿está de verdad en el centro?
   Se mide a varios anchos de teléfono, porque el desajuste que se ve en el
   móvil aparece cuando una etiqueta larga («En el mapa» en una línea) se
   desborda de su casilla y corre el reparto. */
const {chromium}=require(E.MODULOS + '/playwright-core');
const fs=require('fs');
const S=E.TRABAJO;
const LEAFLET=S+'node_modules/leaflet/dist/';
const ANCHOS=[412,448,480,512];

async function medir(b, ancho){
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:ancho,height:900},deviceScaleFactor:2,isMobile:true,hasTouch:true});
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
  }catch(e){} });
  await ctx.route('**', r=>/localhost:(8199|8787)/.test(r.request().url())?r.continue():r.abort());
  await ctx.route(/unpkg\.com/, r=>{const u=r.request().url();
    r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(LEAFLET+(u.endsWith('.css')?'leaflet.css':'leaflet.js'),'utf8')});});
  await ctx.route(/script\.google\.com/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"data":[]}'}));
  const pg=await ctx.newPage();
  await pg.goto(E.ESTATICO + '/index.html?app=educativo',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4200);
  /* La regla de la rejilla gana en especificidad a la de ocultar, así que se
     comprueba que la barra SIGA desapareciendo al cerrar el módulo: es la
     trampa que este archivo ya había pisado con la barra del Rush. */
  const oculta=await pg.evaluate(async()=>{
    const nav=document.querySelector('.u52-procity-nav');
    document.querySelector('.u52-procity-perfil-btn').click();
    await new Promise(r=>setTimeout(r,600));
    const cs=getComputedStyle(nav);
    const fuera={ atributo:nav.hasAttribute('hidden'), display:cs.display, alto:Math.round(nav.getBoundingClientRect().height) };
    history.length; document.querySelector('[data-u52-screen="profile"] [data-u52-back]').click();
    await new Promise(r=>setTimeout(r,1400));
    return fuera;
  });
  const r=await pg.evaluate(()=>{
    const nav=document.querySelector('.u52-procity-nav');
    if(!nav) return {sinNav:true};
    const cs=getComputedStyle(nav), nr=nav.getBoundingClientRect();
    const btns=[...nav.querySelectorAll('button')].map(b=>{
      const br=b.getBoundingClientRect();
      const et=b.querySelector('span:not(.procity-nav-ico)');
      const er=et?et.getBoundingClientRect():null;
      return { que:(b.getAttribute('data-u52-call')||'').replace('procity-',''), plus:b.classList.contains('plus'),
        x:Math.round(br.left), ancho:Math.round(br.width), centro:Math.round(br.left+br.width/2),
        texto:et?(et.textContent||'').trim():'', textoAncho:er?Math.round(er.width):0,
        desborda:er?Math.round(er.width-br.width):0 };
    });
    const plus=btns.filter(b=>b.plus)[0];
    /* El «+» puede estar centrado y aun así PARECER corrido: lo que el ojo
       compara no son los centros sino los huecos a cada lado, y esos dependen
       del ancho del texto de las etiquetas vecinas. */
    const rectoTexto = b => {
      const et=b.querySelector('span:not(.procity-nav-ico)');
      if(!et) return null;
      const r=et.getBoundingClientRect();
      // El ancho real del texto, no el de su caja
      const rango=document.createRange(); rango.selectNodeContents(et);
      const rr=rango.getBoundingClientRect();
      return { izq: rr.left||r.left, der: rr.right||r.right };
    };
    const idx=btns.findIndex(b=>b.plus);
    const nodos=[...nav.querySelectorAll('button')];
    const tIzq=rectoTexto(nodos[idx-1]), tDer=rectoTexto(nodos[idx+1]);
    const pr=nodos[idx].getBoundingClientRect();
    return { display:cs.display, justify:cs.justifyContent, columnas:cs.gridTemplateColumns,
      huecoIzq: tIzq ? Math.round(pr.left - tIzq.der) : null,
      huecoDer: tDer ? Math.round(tDer.izq - pr.right) : null,
      navCentro:Math.round(nr.left+nr.width/2), navAncho:Math.round(nr.width),
      plusCentro:plus&&plus.centro, desfase:plus?Math.round(plus.centro-(nr.left+nr.width/2)):null, btns };
  });
  await pg.close(); await ctx.close();
  r.oculta=oculta;
  return r;
}

(async()=>{
  const b=await chromium.launch({executablePath:E.CHROMIUM,args:['--no-sandbox']});
  let mal=0;
  for(const a of ANCHOS){
    const r=await medir(b,a);
    if(r.sinNav){ console.log(a+'px: no hay barra'); mal++; continue; }
    const ok=Math.abs(r.desfase)<=1;
    if(!ok) mal++;
    /* Huecos exactamente iguales es imposible mientras las etiquetas vecinas
       midan distinto: «En el mapa» es el doble de larga que «Mapa», y las dos
       van centradas en su casilla. Lo que sí se puede exigir —y es lo que el
       ojo juzga— es que el botón no quede apretado contra ninguna de las dos,
       y que la diferencia no pase del radio del botón. Antes el hueco de la
       izquierda bajaba a 2 px: ahí sí se veía corrido. */
    const dif = (r.huecoIzq!=null&&r.huecoDer!=null) ? Math.abs(r.huecoIzq-r.huecoDer) : 999;
    const menor = Math.min(r.huecoIzq==null?999:r.huecoIzq, r.huecoDer==null?999:r.huecoDer);
    const parejo = menor >= 16 && dif <= 20;
    if(!parejo) mal++;
    console.log('\n'+(ok?'✓':'✗')+' '+a+'px · centro barra '+r.navCentro+' · centro + '+r.plusCentro+' → desfase '+r.desfase+'px');
    console.log('  '+(parejo?'✓':'✗')+' el + respira por los dos lados : izq '+r.huecoIzq+
      'px · der '+r.huecoDer+'px · el menor '+menor+' (mínimo 16) · diferencia '+dif+' (máximo 20)');
    const bien=r.oculta.atributo && r.oculta.display==='none' && r.oculta.alto===0;
    if(!bien) mal++;
    console.log('  '+(bien?'✓':'✗')+' y desaparece al salir del módulo  — hidden '+r.oculta.atributo+' · display '+r.oculta.display+' · alto '+r.oculta.alto);
    r.btns.forEach(x=>console.log('    '+(x.plus?'  +      ':x.que.padEnd(9))+' x'+String(x.x).padStart(4)+
      ' ancho '+String(x.ancho).padStart(3)+' centro '+String(x.centro).padStart(4)+
      (x.texto?'  «'+x.texto+'» '+x.textoAncho+'px'+(x.desborda>0?' DESBORDA +'+x.desborda:''):'')));
  }
  console.log('\n'+(mal?mal+' anchos con el + descentrado':'el + queda centrado en todos los anchos'));
  await b.close();
  process.exit(mal?1:0);
})();
