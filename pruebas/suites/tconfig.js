const E = require('../entorno.js');
// URBIS · suite de configuración, peticiones y panel del administrador (js/13g)
const { chromium } = require(E.MODULOS + '/playwright-core');
const http = require('http'), fs = require('fs'), path = require('path'), R = E.RAIZ;
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png' };
let fallos = 0;
const ok = (c,m) => { console.log((c?'OK   ':'FALLA')+' · '+m); if(!c) fallos++; };

// El backend simulado recuerda lo que se escribe: hace falta para comprobar que
// una petición se envía con el formato correcto y que borrar pide lo que debe.
const enviados = [];

const srv = http.createServer((rq,rs)=>{
  const f = path.join(R, decodeURIComponent(rq.url.split('?')[0]));
  fs.readFile(f,(e,b)=>{ if(e){ rs.writeHead(404); rs.end(); } else { rs.writeHead(200,{'content-type':mime[path.extname(f)]||'text/plain'}); rs.end(b); } });
}).listen(8098, async () => {
  const b = await chromium.launch({ executablePath:E.CHROMIUM, args:['--no-sandbox'] });
  const pg = await b.newPage({ viewport:{ width:390, height:844 } });
  await pg.route('**/unpkg.com/**', r => {
    const u = r.request().url(), css = u.endsWith('.css');
    r.fulfill({ status:200, contentType: css?'text/css':'text/javascript',
                body: fs.readFileSync(E.MODULOS + '/leaflet/dist/leaflet.'+(css?'css':'js'),'utf8') });
  });
  await pg.route('**/script.google.com/**', r => {
    let cuerpo = '';
    try { cuerpo = r.request().postData() || ''; } catch(e){}
    if (cuerpo) enviados.push(cuerpo);
    r.fulfill({ status:200, contentType:'application/json', body:'{"ok":true,"data":[],"deleted":1,"updated":1}' });
  });
  const errs = [];
  pg.on('pageerror', e => { if(!/Unexpected end of input/.test(e.message)) errs.push(e.message); });
  await pg.addInitScript(() => {
    /* Desde que la licencia se pide AL TOCAR el botón (js/69 permitido),
       una suite sin licencia guardada se queda en la pantalla de licencia
       en vez de analizar. Es el comportamiento correcto: acá se pone la
       licencia igual que la pondría el curso en cada dispositivo. */
    localStorage.setItem('urbis_licencia_analisis','URBIS1.deprueba.deprueba');
    localStorage.setItem('urbis_auth_session_v1', JSON.stringify({
      active:true, verified:true, usuario:'urbisprocity', correo:'urbisprocity@gmail.com',
      rol:'admin', session_token:'tok-admin'
    }));
    localStorage.setItem('urbis_beta_splash_visto','1');
  });
  await pg.goto('http://localhost:8098/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await pg.waitForTimeout(2600);

  // ── 1) El módulo existe y se reconoce al administrador ────────────────────
  const base = await pg.evaluate(() => ({
    cfg:  typeof window.urbisAbrirConfiguracion,
    term: typeof window.urbisAbrirTerminos,
    pet:  typeof window.urbisAbrirPeticion,
    adm:  typeof window.urbisAbrirPanelAdmin,
    del:  typeof window.urbisBorrarPublicacion,
    esAdmin: window.urbisEsAdmin()
  }));
  ok(base.cfg==='function' && base.term==='function' && base.pet==='function' &&
     base.adm==='function' && base.del==='function', 'el módulo expone sus cinco puertas');
  ok(base.esAdmin === true, 'la cuenta urbisprocity entra como administradora');

  // ── 2) El botón vive dentro del perfil ────────────────────────────────────
  const enPerfil = await pg.evaluate(() => {
    window.urbisMontarConfigPerfil();
    const b = document.querySelector('#urbis-abrir-config');
    if(!b) return { hay:false };
    const cont = b.closest('[data-u52-screen]');
    const salir = document.querySelector('.u52-profile-logout[data-u52-call="logout-session"]');
    return {
      hay:true,
      pantalla: cont && cont.getAttribute('data-u52-screen'),
      // Ir antes de "Cerrar sesión" no es capricho: cerrar sesión es la última
      // acción de la pantalla y nada debería quedar por debajo.
      antesDeSalir: !!(salir && (b.compareDocumentPosition(salir) & Node.DOCUMENT_POSITION_FOLLOWING))
    };
  });
  ok(enPerfil.hay, 'el botón de configuración se monta solo');
  ok(enPerfil.pantalla === 'profile', 'y está dentro de la pantalla de Perfil, que es donde se pidió');
  ok(enPerfil.antesDeSalir, 'queda por encima de "Cerrar sesión"');

  // ── 3) Se monta una sola vez aunque el perfil se repinte ──────────────────
  const unaSola = await pg.evaluate(() => {
    window.urbisMontarConfigPerfil(); window.urbisMontarConfigPerfil();
    return document.querySelectorAll('#urbis-abrir-config').length;
  });
  ok(unaSola === 1, 'no se duplica al repintarse la pantalla');

  // ── 4) Términos: legibles de verdad ──────────────────────────────────────
  await pg.evaluate(() => window.urbisAbrirTerminos());
  await pg.waitForTimeout(320);
  const term = await pg.evaluate(() => {
    const ov = document.getElementById('urbis-terminos-overlay');
    if(!ov) return { hay:false };
    const card = ov.querySelector('.urbis-cfg');
    const parrafo = ov.querySelector('.ucfg-term span');
    // Contraste real: el tema viejo pintaba los párrafos de blanco verdoso
    // sobre papel claro y las letras desaparecían. Se mide, no se supone.
    // Se busca el primer antepasado con fondo OPACO: una tarjeta con degradado
    // devuelve `rgba(0,0,0,0)` como color de fondo y compararse contra eso
    // daría un negro que no existe en pantalla.
    const lum = c => {
      const m = c.match(/[\d.]+/g).slice(0,3).map(Number).map(v => { v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); });
      return .2126*m[0] + .7152*m[1] + .0722*m[2];
    };
    let fondo = 'rgb(255,255,255)';
    for (let n = parrafo; n && n !== document.documentElement; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      const p = (bg.match(/[\d.]+/g) || []).map(Number);
      if (p.length && (p.length < 4 || p[3] > 0.5)) { fondo = bg; break; }
    }
    const l1 = lum(getComputedStyle(parrafo).color), l2 = lum(fondo);
    const ratio = (Math.max(l1,l2)+.05) / (Math.min(l1,l2)+.05);
    return {
      hay:true,
      secciones: ov.querySelectorAll('.ucfg-term').length,
      texto: ov.textContent,
      ratio,
      zIndex: parseInt(getComputedStyle(ov).zIndex, 10),
      ancho: card.getBoundingClientRect().width
    };
  });
  ok(term.hay, 'los términos y condiciones se abren');
  ok(term.secciones >= 8, 'traen las secciones completas ('+term.secciones+')');
  ok(/urbisprocity@gmail\.com/.test(term.texto), 'dicen a dónde escribir para ejercer los derechos');
  ok(/123/.test(term.texto), 'y advierten que URBIS no reemplaza una llamada de emergencia');
  ok(term.ratio >= 4.5, 'el texto se lee sobre el papel claro (contraste '+term.ratio.toFixed(1)+':1)');
  ok(term.zIndex > 2147483000, 'la hoja se abre POR ENCIMA del caparazón móvil, no debajo');
  ok(term.ancho <= 390, 'la tarjeta cabe en la pantalla ('+Math.round(term.ancho)+'px de 390)');
  await pg.evaluate(() => { const o=document.getElementById('urbis-terminos-overlay'); if(o) o.remove(); });

  // ── 5) Configuración: qué ve un administrador ────────────────────────────
  await pg.evaluate(() => {
    globalData = [
      { tipo:'🚧 Reporte', lat:'7.10', lng:'-72.5',
        descripcion: (function(){ const d=new Array(70).fill(''); d[0]='Hueco'; d[1]='Hueco grande';
          d[44]='Pendiente'; d[45]='pedro'; return d.join(' | '); })(), fecha:new Date().toISOString() }
    ];
    window.urbisPeticiones = [
      { tipo:'📩 Petición URBIS', lat:'0', lng:'0',
        descripcion:'ana~~~Sería bueno poder filtrar por barrio~~~~~~nueva', fecha:new Date().toISOString() },
      { tipo:'📩 Petición URBIS', lat:'0', lng:'0',
        descripcion:'luis~~~El mapa se ve lento en mi celular~~~~~~leida', fecha:new Date().toISOString() }
    ];
    window.urbisAbrirConfiguracion();
  });
  await pg.waitForTimeout(300);
  const cfg = await pg.evaluate(() => {
    const ov = document.getElementById('urbis-config-overlay');
    return {
      hay: !!ov,
      admin: !!ov.querySelector('[data-ucfg="admin"]'),
      badge: (ov.querySelector('.ucfg-badge')||{}).textContent || '',
      mailto: (ov.querySelector('a[href^="mailto:"]')||{}).getAttribute('href') || '',
      texto: ov.textContent
    };
  });
  ok(cfg.hay, 'la configuración se abre desde el perfil');
  ok(cfg.admin, 'el administrador ve la entrada al panel');
  ok(cfg.badge === '2', 'y el contador avisa de lo que le espera (1 por aprobar + 1 petición sin leer): '+cfg.badge);
  ok(/urbisprocity@gmail\.com/.test(cfg.mailto), 'Contactarnos abre el correo de URBIS');
  ok(/Términos y condiciones/.test(cfg.texto), 'los términos están a la vista para cualquiera');
  await pg.evaluate(() => { const o=document.getElementById('urbis-config-overlay'); if(o) o.remove(); });

  // ── 5b) NADA se sale de la pantalla ──────────────────────────────────────
  /* Esto se rompió de verdad: con cinco bandejas en fila, el panel se hizo
     más ancho que el teléfono y se cortaron el título por la izquierda y la
     última bandeja por la derecha. Se mide el ancho REAL de cada pieza, no
     se confía en que el diseño "debería" caber. */
  const medidas = await pg.evaluate(() => {
    window.urbisAbrirPanelAdmin();
    const ov = document.getElementById('urbis-admin-overlay');
    const card = ov.querySelector('.urbis-cfg');
    const caja = card.getBoundingClientRect();
    let peor = null;
    ov.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const desborde = Math.max(caja.left - r.left, r.right - caja.right);
      if (!peor || desborde > peor.desborde) {
        peor = { desborde: Math.round(desborde),
                 quien: el.className || el.tagName,
                 texto: (el.textContent || '').trim().slice(0, 28) };
      }
    });
    const r = { ancho: Math.round(caja.width), izq: Math.round(caja.left),
                der: Math.round(caja.right), peor,
                scroll: card.scrollWidth - card.clientWidth };
    ov.remove();
    return r;
  });
  ok(medidas.ancho <= 390 && medidas.izq >= 0 && medidas.der <= 390,
     'el panel cabe en la pantalla ('+medidas.ancho+'px, de '+medidas.izq+' a '+medidas.der+')');
  ok(medidas.peor.desborde <= 1,
     'y ninguna pieza de adentro se sale: la peor sobra '+medidas.peor.desborde+'px ('+medidas.peor.texto+')');
  ok(medidas.scroll <= 1, 'sin barra horizontal escondida ('+medidas.scroll+'px)');

  // ── 5c) Los campos de TODAS las ventanas claras ──────────────────────────
  /* La misma fuga del tema oscuro (css/99 pinta input/textarea de casi negro
     con !important) afectaba también a la petición y al buscador de
     permisos. Se comprueban las tres puertas, no solo la que se vio fallar. */
  const camposClaros = await pg.evaluate(async () => {
    const lum = c => {
      const m = (c.match(/[\d.]+/g) || ['0','0','0']).slice(0,3).map(Number)
        .map(v => { v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); });
      return .2126*m[0] + .7152*m[1] + .0722*m[2];
    };
    const mirar = ov => Array.prototype.map.call(
      ov.querySelectorAll('input:not([type=file]):not([type=checkbox]), textarea'), el => {
        const cs = getComputedStyle(el);
        const l1 = lum(cs.color), l2 = lum(cs.backgroundColor);
        return { id: el.id || el.tagName, claro: l2 > 0.5,
                 ratio: +(((Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05))).toFixed(1) };
      });
    const out = {};
    window.urbisAbrirPeticion();
    await new Promise(r => setTimeout(r, 150));
    out.peticion = mirar(document.getElementById('urbis-peticion-overlay'));
    document.getElementById('urbis-peticion-overlay').remove();

    window.urbisAbrirPanelAdmin();
    await new Promise(r => setTimeout(r, 120));
    const ov = document.getElementById('urbis-admin-overlay');
    ov.querySelector('.uadm-bandeja[data-uadm="equipo"]').click();
    await new Promise(r => setTimeout(r, 260));
    out.permisos = mirar(ov);
    ov.remove();
    return out;
  });
  const malos = [].concat(camposClaros.peticion, camposClaros.permisos)
                  .filter(c => !c.claro || c.ratio < 4.5);
  ok(camposClaros.peticion.length >= 1 && camposClaros.permisos.length >= 1,
     'se revisan los campos de la petición y del reparto de permisos');
  ok(malos.length === 0,
     'y todos van en papel claro y legible'+(malos.length ? ': '+malos.map(c=>c.id).join(', ') : ''));

  // ── 6) Un ciudadano NO ve el panel ───────────────────────────────────────
  const ciudadano = await pg.evaluate(() => {
    const real = window.urbisEsAdmin;
    window.urbisEsAdmin = () => false;
    window.urbisAbrirConfiguracion();
    const ov = document.getElementById('urbis-config-overlay');
    const r = {
      panel: !!ov.querySelector('[data-ucfg="admin"]'),
      peticion: !!ov.querySelector('[data-ucfg="peticion"]'),
      terminos: !!ov.querySelector('[data-ucfg="terminos"]')
    };
    ov.remove();
    // Y si lo llama a mano tampoco entra.
    let entro = true;
    const alertaReal = window.alert; window.alert = () => {};
    window.urbisAbrirPanelAdmin();
    entro = !!document.getElementById('urbis-admin-overlay');
    window.alert = alertaReal;
    window.urbisEsAdmin = real;
    return Object.assign(r, { entro });
  });
  ok(!ciudadano.panel, 'un ciudadano no ve la entrada al panel de administración');
  ok(ciudadano.peticion && ciudadano.terminos, 'pero sí puede escribir al administrador y leer los términos');
  ok(!ciudadano.entro, 'y llamando a la función a mano tampoco entra');

  // ── 7) El panel: tres bandejas ───────────────────────────────────────────
  await pg.evaluate(() => window.urbisAbrirPanelAdmin());
  await pg.waitForTimeout(300);
  const panel = await pg.evaluate(() => {
    const ov = document.getElementById('urbis-admin-overlay');
    return { hay: !!ov, tabs: ov.querySelectorAll('.uadm-bandeja').length,
             items: ov.querySelectorAll('.uadm-item').length,
             enMenu: !ov.querySelector('.uadm-menu').hidden && ov.querySelector('.uadm-detalle').hidden,
             texto: ov.querySelector('.uadm-menu').textContent };
  });
  // Cinco, ahora en MENÚ VERTICAL: en fila ya no cabían en un teléfono.
  ok(panel.hay && panel.tabs === 5, 'el panel abre con sus cinco bandejas');
  ok(panel.enMenu && /Por aprobar/.test(panel.texto),
     'y arranca en el menú, sin meter a nadie en una bandeja que no pidió');

  const petTab = await pg.evaluate(async () => {
    const ov = document.getElementById('urbis-admin-overlay');
    ov.querySelector('.uadm-bandeja[data-uadm="peticiones"]').click();
    await new Promise(r => setTimeout(r, 120));
    const lista = ov.querySelector('.uadm-lista');
    return {
      items: lista.querySelectorAll('.uadm-item').length,
      nuevas: lista.querySelectorAll('.uadm-nueva').length,
      leidas: lista.querySelectorAll('.uadm-leida').length,
      texto: lista.textContent
    };
  });
  ok(petTab.items === 2, 'la bandeja de peticiones trae las dos');
  ok(petTab.nuevas === 1 && petTab.leidas === 1, 'y distingue la nueva de la ya leída');
  ok(/filtrar por barrio/.test(petTab.texto), 'se lee lo que la persona escribió');
  ok(!/~~~/.test(petTab.texto), 'y NO se escapan los separadores internos a la pantalla');
  await pg.evaluate(() => { const o=document.getElementById('urbis-admin-overlay'); if(o) o.remove(); });

  // ── 8) Enviar una petición ───────────────────────────────────────────────
  const envio = await pg.evaluate(async () => {
    const guardadas = [];
    const real = window.urbisGuardarFila;
    window.urbisGuardarFila = f => { guardadas.push(f); return Promise.resolve({ok:true}); };
    const alertaReal = window.alert; let aviso=''; window.alert = m => { aviso = m; };
    window.urbisAbrirPeticion();
    const ov = document.getElementById('urbis-peticion-overlay');
    ov.querySelector('#upet-texto').value = 'El botón de reportar queda tapado por el teclado';
    ov.querySelector('#upet-enviar').click();
    await new Promise(r => setTimeout(r, 400));
    window.urbisGuardarFila = real; window.alert = alertaReal;
    const o = document.getElementById('urbis-peticion-overlay'); if(o) o.remove();
    return { guardadas, aviso };
  });
  ok(envio.guardadas.length === 1, 'la petición se envía');
  const fila = envio.guardadas[0] || {};
  ok(/Petici/.test(String(fila.tipo)), 'con su tipo propio: '+fila.tipo);
  ok(String(fila.descripcion).split('~~~').length === 4,
     'y en el formato usuario~~~texto~~~foto~~~estado');
  ok(String(fila.descripcion).split('~~~')[0] === 'urbisprocity', 'firmada con quien la escribe');
  ok(String(fila.descripcion).split('~~~')[3] === 'nueva', 'y marcada como sin leer');
  ok(fila.lat === '0' && fila.lng === '0', 'sin coordenada: una petición no es un sitio del mapa');

  // ── 9) Una petición vacía no se manda ────────────────────────────────────
  const vacia = await pg.evaluate(async () => {
    let intentos = 0;
    const real = window.urbisGuardarFila;
    window.urbisGuardarFila = f => { intentos++; return Promise.resolve({ok:true}); };
    window.urbisAbrirPeticion();
    const ov = document.getElementById('urbis-peticion-overlay');
    ov.querySelector('#upet-enviar').click();
    await new Promise(r => setTimeout(r, 200));
    const err = ov.querySelector('.ucfg-error');
    const r = { intentos, aviso: err && !err.hidden ? err.textContent : '' };
    window.urbisGuardarFila = real; ov.remove();
    return r;
  });
  ok(vacia.intentos === 0 && vacia.aviso, 'una petición vacía no viaja y se dice por qué');

  // ── 10) La petición NO se pinta en el mapa ───────────────────────────────
  const noPinta = await pg.evaluate(() => {
    const p = { tipo:'📩 Petición URBIS', lat:'7.10', lng:'-72.5', descripcion:'ana~~~hola~~~~~~nueva' };
    return {
      meta: window.esFilaMetaUrbis ? window.esFilaMetaUrbis(p) : null,
      aurea: typeof window.urbisEsEventoAurea === 'function' ? window.urbisEsEventoAurea(p) : false,
      alerta: typeof window.urbisEsAlertaNacional === 'function' ? window.urbisEsAlertaNacional(p) : false
    };
  });
  ok(noPinta.meta === true, 'una petición cuenta como fila interna: nunca es un pin del mapa');
  ok(!noPinta.aurea && !noPinta.alerta, 'ni se cuela por las capas forzadas de Juegos ni de alertas');

  // ── 11) Borrar: cada cosa se busca por donde toca ─────────────────────────
  const borrado = await pg.evaluate(async () => {
    const pedidos = [];
    const real = window.urbisDBDelete;
    window.urbisDBDelete = (col, val) => { pedidos.push({col, val}); return Promise.resolve({ok:true}); };
    await window.urbisBorrarPublicacion({ tipo:'🚧 Reporte', lat:'7.10', descripcion:'a | b' });
    await window.urbisBorrarPublicacion({ tipo:'💬 Comentario', lat:'7.10', descripcion:'ana~~~qué mal' });
    await window.urbisBorrarPublicacion({ tipo:'📩 Petición URBIS', lat:'0', descripcion:'ana~~~hola~~~~~~nueva' });
    window.urbisDBDelete = real;
    return pedidos;
  });
  ok(borrado[0] && borrado[0].col === 'lat', 'un reporte se borra por su latitud');
  ok(borrado[1] && borrado[1].col === 'descripcion',
     'un comentario se borra por su TEXTO exacto: por latitud se llevaría el reporte entero y los demás comentarios');
  ok(borrado[2] && borrado[2].col === 'descripcion', 'y una petición, igual');

  // ── 12) Borrar limpia también las listas en memoria ──────────────────────
  const limpieza = await pg.evaluate(async () => {
    const real = window.urbisDBDelete;
    window.urbisDBDelete = () => Promise.resolve({ok:true});
    const c = { tipo:'💬 Comentario', lat:'7.10', descripcion:'ana~~~fuera' };
    const p = { tipo:'📩 Petición URBIS', lat:'0', descripcion:'ana~~~fuera~~~~~~nueva' };
    window.urbisComentarios = [c];
    window.urbisPeticiones = [p];
    await window.urbisBorrarPublicacion(c);
    await window.urbisBorrarPublicacion(p);
    window.urbisDBDelete = real;
    return { com: window.urbisComentarios.length, pet: window.urbisPeticiones.length };
  });
  ok(limpieza.com === 0 && limpieza.pet === 0,
     'lo borrado desaparece de la pantalla en el acto, no en la siguiente recarga');

  // ── 13) El comentario ajeno trae papelera para el administrador ──────────
  const papelera = await pg.evaluate(async () => {
    window.urbisComentarios = [{ tipo:'💬 Comentario', lat:'9.99', lng:'0',
      descripcion:'pedro~~~esto es un insulto', fecha:new Date().toISOString() }];
    window.urbisAbrirComentarios('9.99', 'Reporte de prueba');
    await new Promise(r => setTimeout(r, 200));
    const sheet = document.getElementById('urbis-coment-sheet');
    const conAdmin = sheet.querySelectorAll('.uc-borrar').length;
    sheet.remove();
    const real = window.urbisEsAdmin; window.urbisEsAdmin = () => false;
    window.urbisAbrirComentarios('9.99', 'Reporte de prueba');
    await new Promise(r => setTimeout(r, 200));
    const s2 = document.getElementById('urbis-coment-sheet');
    const sinAdmin = s2.querySelectorAll('.uc-borrar').length;
    const denunciar = s2.querySelectorAll('.uc-denunciar').length;
    s2.remove(); window.urbisEsAdmin = real;
    return { conAdmin, sinAdmin, denunciar };
  });
  ok(papelera.conAdmin === 1, 'el administrador puede eliminar el comentario de otro');
  ok(papelera.sinAdmin === 0, 'un ciudadano cualquiera NO ve la papelera en un comentario ajeno');
  ok(papelera.denunciar === 1, 'pero sigue pudiendo denunciarlo, que es su vía');

  // ── 14) El servidor no se fía del botón ──────────────────────────────────
  const gs = fs.readFileSync(E.TRABAJO + 'docs-privado/apps-script-urbis-auth.gs','utf8');
  ok(/_esFilaTextoDeAlguien_/.test(gs) && /_esAutorDelTexto_/.test(gs),
     'el Apps Script distingue el texto con autor de la fontanería');
  const dbDel = gs.slice(gs.indexOf('function dbDelete_'), gs.indexOf('function dbDelete_')+2200);
  ok(dbDel.indexOf('_esFilaTextoDeAlguien_') !== -1 &&
     dbDel.indexOf('_esFilaTextoDeAlguien_') < dbDel.indexOf('_esFilaMeta_'),
     'y comprueba la autoría ANTES de la rama que borraba comentarios sin preguntar');
  ok(/_soloDenunciasEnTexto_/.test(gs), 'denunciar un comentario ajeno sigue permitido (solo esa casilla)');

  // ── 15) Nada roto por el camino ──────────────────────────────────────────
  ok(errs.length === 0, 'sin errores de JavaScript en la página'+(errs.length?': '+errs[0]:''));

  await b.close(); srv.close();
  console.log('\n'+(fallos ? '✗ '+fallos+' fallo(s)' : '✓ todo en orden'));
  process.exit(fallos ? 1 : 0);
});
