/* URBIS · VITRINA DE EMPRENDIMIENTOS (js/13i)
   ═══════════════════════════════════════════════════════════════════════════
   La vitrina es el escaparate de los negocios pequeños del barrio: la
   barbería, el taller de celulares, la odontología. En Colombia "vitrinear"
   es pasar mirando qué hay, sin compromiso — y eso es exactamente lo que
   pasa aquí: la gente entra a URBIS a mirar reportes y eventos, y de
   casualidad se topa con una gotita distinta en su cuadra. La toca y
   encuentra un emprendimiento de confianza, con su WhatsApp a un toque.

   Por qué es un módulo aparte y no un tipo de reporte
   ───────────────────────────────────────────────────
   Un reporte envejece: caduca, se confirma, se archiva. Un negocio no. Si la
   vitrina viajara como reporte, el motor de vigencia le pediría confirmar
   "si el emprendimiento sigue vigente" y lo archivaría a los días. Por eso
   sus filas se apartan al cargar (como los comentarios) y las pinta este
   módulo en su propia capa, con su propia ficha.

   Cómo se guarda
   ──────────────
   · El negocio: una fila "🛍️ Emprendimiento URBIS" con lat/lng reales y la
     ficha entera en un sobre VITRINA_URBIS:{...} — el mismo patrón de
     validaciones y denuncias.
   · Cada producto del portafolio: SU PROPIA fila "🛍️ Portafolio URBIS".
     Una foto comprimida ya casi llena una celda del Sheet; meter cuatro en
     el sobre del negocio lo reventaría. La fila del producto lleva en `lat`
     el id del negocio, que es como se encuentran.

   Quién escribe
   ─────────────
   El servidor exige el permiso `vitrina` (el dueño y quien lo tenga
   delegado) para crear, editar o borrar estas filas. No es capricho:
   db_write era abierto, y sin el candado cualquiera podía inventarse un
   "emprendimiento verificado por URBIS" — con la palabra URBIS avalando.
   El aval solo vale si nadie más puede ponérselo.

   Y quién decide qué se VE: el estado. `borrador` no pinta, `visible` sí.
   Crear deja el negocio en borrador a propósito — publicarlo en el mapa es
   una decisión aparte, que es lo que se pidió: "yo autorizo si se ve".
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TIPO_NEGOCIO = '🛍️ Emprendimiento URBIS';
  const TIPO_ITEM = '🛍️ Portafolio URBIS';
  const PREFIJO = 'VITRINA_URBIS:';
  const MAX_CELDA = 45000;
  /* El emoji es la CARA del negocio en el mapa: es lo primero que se ve y lo
     único que distingue una gota de otra desde lejos. Con diez opciones media
     ciudad se quedaba sin la suya —no había ni ferretería, ni papelería, ni
     panadería—, así que aquí va un catálogo de verdad, por oficios y con
     buscador. Cada emoji lleva las palabras con que la gente lo buscaría,
     no solo su nombre técnico: quien tiene una peluquería escribe
     "peluquería", no "poste de barbero". */
  const CATALOGO = [
    ['Comida y bebida', [
      ['🍕','pizza pizzeria italiana'], ['🍔','hamburguesa comidas rapidas burger'],
      ['🌭','perro caliente hotdog salchipapa'], ['🍟','papas fritas comidas rapidas'],
      ['🌮','tacos mexicana'], ['🍗','pollo asadero broaster'],
      ['🥩','carne asados parrilla res'], ['🍖','costilla asado parrilla'],
      ['🍚','arroz chino comida corriente'], ['🍜','sopa caldo ramen'],
      ['🥘','almuerzo corrientazo restaurante'], ['🍳','desayunos huevos'],
      ['🥐','panaderia pan croissant'], ['🍞','panaderia pan'],
      ['🎂','tortas pasteleria reposteria cumpleanos'], ['🧁','cupcakes postres reposteria'],
      ['🍰','postres tortas pasteleria'], ['🍩','donas postres'],
      ['🍪','galletas reposteria'], ['🍫','chocolates dulces'],
      ['🍬','dulces confiteria golosinas'], ['🍦','helados heladeria'],
      ['🧃','jugos naturales bebidas'], ['🥤','gaseosas bebidas refrescos'],
      ['☕','cafe cafeteria tinto'], ['🍵','te aromatica infusiones'],
      ['🍺','cerveza bar cerveceria'], ['🍹','coctel bar licores'],
      ['🍇','frutas fruteria verduras'], ['🥬','verduras legumbres hortalizas'],
      ['🐟','pescaderia pescado mariscos'], ['🥚','huevos granja'],
      ['🧀','quesos lacteos'], ['🍯','miel natural apicultura']
    ]],
    ['Belleza y cuidado', [
      ['💈','barberia barbero cortes caballeros'], ['💇','peluqueria salon cortes'],
      ['💅','manicure unas pedicure spa'], ['💄','maquillaje cosmeticos belleza'],
      ['🧴','productos cuidado piel cremas'], ['🧼','jabones aseo artesanal'],
      ['🪒','afeitado barberia navaja'], ['🧖','spa masajes relajacion'],
      ['💆','masajes terapia relajacion'], ['🌸','estetica belleza flores'],
      ['✂️','corte tijeras peluqueria sastreria'], ['🪮','peinados trenzas cabello']
    ]],
    ['Salud', [
      ['🦷','odontologia dentista dientes ortodoncia'], ['🩺','medicina consultorio doctor'],
      ['💊','farmacia droguería medicamentos'], ['🏥','clinica centro medico'],
      ['👁️','optica lentes gafas optometria'], ['🦴','fisioterapia ortopedia huesos'],
      ['🧠','psicologia terapia mental'], ['🩹','enfermeria curaciones primeros auxilios'],
      ['💉','laboratorio examenes vacunas'], ['🫀','cardiologia salud corazon'],
      ['🧘','yoga bienestar meditacion'], ['🏋️','gimnasio gym entrenamiento pesas']
    ]],
    ['Tecnología', [
      ['📱','celulares telefonos moviles smartphone'], ['💻','computadores portatiles laptop'],
      ['🖥️','computadores escritorio pc monitores'], ['⌨️','teclados accesorios computo'],
      ['🖨️','impresoras tintas fotocopias'], ['🎮','videojuegos consolas gamer'],
      ['🎧','audifonos audio sonido'], ['🔌','electronica cargadores accesorios'],
      ['🔋','baterias pilas energia'], ['📷','camaras fotografia foto'],
      ['📹','video filmacion produccion'], ['🛰️','internet redes wifi antenas'],
      ['💾','datos respaldo software'], ['⚙️','reparacion tecnica servicio']
    ]],
    ['Ropa y accesorios', [
      ['👗','ropa mujer vestidos boutique'], ['👕','ropa camisetas camisas hombre'],
      ['👖','jeans pantalones ropa'], ['👟','calzado tenis zapatos deportivos'],
      ['👠','calzado mujer tacones zapatos'], ['👞','calzado hombre zapatos'],
      ['👜','bolsos carteras marroquineria'], ['🎒','morrales maletas mochilas'],
      ['🧢','gorras sombreros accesorios'], ['👶','ropa bebe infantil ninos'],
      ['💍','joyeria anillos accesorios oro'], ['⌚','relojes relojeria accesorios'],
      ['🕶️','gafas sol accesorios'], ['🧵','sastreria costura arreglos modisteria'],
      ['🧶','tejidos lanas crochet artesanal']
    ]],
    ['Hogar y oficios', [
      ['🔧','ferreteria herramientas reparaciones'], ['🔨','carpinteria construccion obra'],
      ['🪛','reparaciones tecnico mantenimiento'], ['🧰','servicios tecnicos domicilio'],
      ['🪑','muebles carpinteria hogar'], ['🛋️','muebles sala tapiceria hogar'],
      ['🛏️','colchones camas hogar'], ['🧹','aseo limpieza servicios'],
      ['🧺','lavanderia ropa planchado'], ['🪟','vidrios ventanas aluminio'],
      ['🚪','puertas cerrajeria carpinteria'], ['🔑','cerrajeria llaves seguridad'],
      ['💡','electricidad iluminacion electricista'], ['🚿','plomeria gasfiteria agua'],
      ['🧯','seguridad extintores prevencion'], ['🪴','plantas vivero jardineria'],
      ['🏠','inmobiliaria arriendos fincaraiz'], ['🎨','pintura decoracion acabados']
    ]],
    ['Mascotas y animales', [
      ['🐕','perros veterinaria mascotas'], ['🐈','gatos veterinaria mascotas'],
      ['🐾','veterinaria mascotas peluqueria canina'], ['🦜','aves mascotas pajaros'],
      ['🐠','peces acuarios mascotas'], ['🌾','agro campo insumos veterinaria']
    ]],
    ['Educación y arte', [
      ['📚','libreria libros papeleria'], ['✏️','papeleria utiles escolares'],
      ['🖌️','arte pintura manualidades'], ['🎨','arte diseno pintura'],
      ['🎵','musica instrumentos clases'], ['🎸','instrumentos musica guitarras'],
      ['🎤','eventos animacion sonido karaoke'], ['🎬','audiovisual video produccion'],
      ['🎓','educacion cursos academia clases'], ['🧮','contabilidad asesoria impuestos'],
      ['⚖️','abogados juridico asesoria legal'], ['🖋️','diseno grafico publicidad'],
      ['🎁','regalos detalles sorpresas'], ['🎈','fiestas decoracion eventos'],
      ['💐','floristeria flores arreglos'], ['📸','fotografia estudio fotos']
    ]],
    ['Transporte y otros', [
      ['🏍️','motos taller motorepuestos'], ['🚗','carros taller automotriz mecanica'],
      ['🛺','transporte mototaxi domicilios'], ['🚚','transporte mudanzas acarreos carga'],
      ['🚲','bicicletas bicicleteria taller'], ['⛽','combustible gasolina servitecas'],
      ['🛞','llantas montallantas serviteca'], ['🧽','lavadero carwash autolavado'],
      ['📦','domicilios mensajeria envios paqueteria'], ['🏪','tienda miscelanea granero'],
      ['🛒','supermercado minimercado mercado'], ['💰','prestamos financiera cambio'],
      ['🖥','internet cafe navegacion papeleria'], ['🛍️','tienda comercio general']
    ]]
  ];

  // Colores con que un negocio puede firmar su gota y su ficha. Nombres en
  // castellano porque quien elige no está leyendo código.
  const COLORES = [
    ['#FBBF24','Dorado'], ['#38BDF8','Celeste'], ['#F472B6','Rosa'],
    ['#34D399','Verde'],  ['#A78BFA','Morado'],  ['#FB923C','Naranja'],
    ['#F87171','Rojo'],   ['#22D3EE','Turquesa']
  ];
  const COLOR_POR_DEFECTO = '#FBBF24';

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function sinAcentos(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function puedo() {
    try { return typeof window.urbisPuede === 'function' && window.urbisPuede('vitrina'); }
    catch (e) { return false; }
  }
  function nuevoId() { return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ── Leer y escribir el sobre ─────────────────────────────────────────────
  function leerNegocio(p) {
    // El sobre puede venir con campos temporales pegados detrás por otra
    // maquinaria: se corta en el primer separador y listo.
    const crudo = String((p && p.descripcion) || '').split(' | ')[0];
    let o = {};
    if (crudo.indexOf(PREFIJO) === 0) {
      try { o = JSON.parse(decodeURIComponent(crudo.slice(PREFIJO.length))) || {}; } catch (e) { o = {}; }
    }
    return {
      id: String(o.id || ''), nombre: String(o.nombre || ''), emoji: String(o.emoji || '🛍️'),
      lema: String(o.lema || ''), descripcion: String(o.descripcion || ''),
      telefono: String(o.telefono || ''), whatsapp: String(o.whatsapp || ''),
      direccion: String(o.direccion || ''), horario: String(o.horario || ''),
      // Los negocios creados antes de que existieran los colores no tienen
      // ninguno guardado: heredan el dorado de siempre en vez de salir grises.
      color: String(o.color || COLOR_POR_DEFECTO),
      estado: String(o.estado || 'borrador'), fila: p
    };
  }
  function sobreDe(n) {
    return PREFIJO + encodeURIComponent(JSON.stringify({
      id: n.id, nombre: n.nombre, emoji: n.emoji, lema: n.lema, descripcion: n.descripcion,
      telefono: n.telefono, whatsapp: n.whatsapp, direccion: n.direccion,
      horario: n.horario, color: n.color || COLOR_POR_DEFECTO, estado: n.estado
    }));
  }
  function leerItem(p) {
    const partes = String((p && p.descripcion) || '').split('~~~');
    return { uid: partes[0] || '', nombre: partes[1] || '', precio: partes[2] || '',
             foto: partes[3] || '', negocio: String((p && p.lat) || ''), fila: p };
  }

  function negocios() {
    const bolsa = Array.isArray(window.urbisVitrina) ? window.urbisVitrina : [];
    return bolsa.map(leerNegocio).filter(function (n) { return n.id && n.nombre; });
  }
  function itemsDe(id) {
    const bolsa = Array.isArray(window.urbisVitrinaItems) ? window.urbisVitrinaItems : [];
    return bolsa.map(leerItem).filter(function (x) { return x.negocio === id; });
  }
  window.urbisVitrinaNegocios = negocios;

  // ── WhatsApp ─────────────────────────────────────────────────────────────
  /* El número se guarda como lo escriban; el enlace se arma aquí. Un celular
     colombiano de 10 cifras que empieza por 3 recibe el 57 solo: nadie
     debería perder un cliente por no saberse el indicativo. */
  function linkWhatsApp(numero, nombre) {
    let d = String(numero || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 10 && d.charAt(0) === '3') d = '57' + d;
    const texto = 'Hola 👋 Vi ' + (nombre ? '“' + nombre + '”' : 'tu emprendimiento') +
                  ' en URBIS y quiero más información.';
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(texto);
  }
  window.urbisLinkWhatsAppVitrina = linkWhatsApp;

  // ── La gota en el mapa ───────────────────────────────────────────────────
  let _capa = null, _pintados = {}, _timer = null;

  function getMap() {
    try { if (typeof map !== 'undefined' && map && map.addLayer) return map; } catch (e) {}
    if (window.map && window.map.addLayer) return window.map;
    return null;
  }
  function capaLista(m) {
    if (!_capa) { try { _capa = L.layerGroup(); } catch (e) { return null; } }
    if (m && !m.hasLayer(_capa)) { try { m.addLayer(_capa); } catch (e) {} }
    return _capa;
  }

  /* El color va como variable CSS en el propio marcador, no como clase: son
     ocho colores y cada negocio elige el suyo, así que la hoja de estilos no
     tiene por qué conocerlos. */
  function iconoDe(n) {
    const c = /^#[0-9A-Fa-f]{6}$/.test(n.color) ? n.color : COLOR_POR_DEFECTO;
    return L.divIcon({
      className: 'urbis-vitrina-root',
      html: '<div class="uvit-pin" style="--uvit-color:' + c + '">' +
            '<span class="uvit-cara">' + esc(n.emoji || '🛍️') + '</span>' +
            '<i class="uvit-brillo">✨</i></div>',
      iconSize: [44, 52], iconAnchor: [22, 50]
    });
  }

  function render() {
    const m = getMap(); if (!m) return;
    const capa = capaLista(m); if (!capa) return;
    const vivos = {};
    negocios().forEach(function (n) {
      if (n.estado !== 'visible') return;   // borrador y pausado no pintan
      const lat = parseFloat(String(n.fila.lat).replace(',', '.'));
      const lng = parseFloat(String(n.fila.lng).replace(',', '.'));
      if (isNaN(lat) || isNaN(lng)) return;
      const clave = n.id + '@' + lat + ',' + lng + '#' + n.emoji + n.color + n.nombre;
      vivos[clave] = true;
      if (_pintados[clave]) return;
      try {
        const mk = L.marker([lat, lng], { icon: iconoDe(n), zIndexOffset: 400 });
        mk.on('click', function () { window.urbisAbrirVitrina(n.id); });
        mk.addTo(capa);
        _pintados[clave] = mk;
      } catch (e) {}
    });
    // Lo que ya no está (pausado, borrado, editado) se retira.
    Object.keys(_pintados).forEach(function (clave) {
      if (vivos[clave]) return;
      try { capa.removeLayer(_pintados[clave]); } catch (e) {}
      delete _pintados[clave];
    });
  }
  window.urbisRenderVitrina = render;

  // ── La ficha pública ─────────────────────────────────────────────────────
  window.urbisAbrirVitrina = function (id) {
    const n = negocios().find(function (x) { return x.id === id; });
    if (!n) return;
    const viejo = document.getElementById('urbis-vitrina-ficha');
    if (viejo) viejo.remove();

    const prods = itemsDe(id);
    const wa = linkWhatsApp(n.whatsapp || n.telefono, n.nombre);
    const tel = String(n.telefono || '').replace(/[^\d+]/g, '');

    const ov = document.createElement('div');
    ov.id = 'urbis-vitrina-ficha';
    ov.className = 'urbis-cfg-overlay';
    ov.innerHTML =
      '<div class="urbis-cfg urbis-cfg-largo uvit-ficha" role="dialog" aria-modal="true"' +
        ' style="--uvit-color:' + (/^#[0-9A-Fa-f]{6}$/.test(n.color) ? n.color : COLOR_POR_DEFECTO) + '">' +
        '<button type="button" class="ucfg-x" aria-label="Cerrar">×</button>' +
        '<div class="uvit-sello">✨ Emprendimiento URBIS · verificado</div>' +
        '<div class="uvit-cabecera"><span class="uvit-emoji">' + esc(n.emoji) + '</span>' +
          '<div><h3>' + esc(n.nombre) + '</h3>' +
          (n.lema ? '<p class="uvit-lema">' + esc(n.lema) + '</p>' : '') + '</div></div>' +
        (n.descripcion ? '<p class="uvit-desc">' + esc(n.descripcion) + '</p>' : '') +
        ((n.direccion || n.horario)
          ? '<div class="uvit-datos">' +
            (n.direccion ? '<span>📍 ' + esc(n.direccion) + '</span>' : '') +
            (n.horario ? '<span>🕐 ' + esc(n.horario) + '</span>' : '') + '</div>'
          : '') +
        '<div class="uvit-acciones">' +
          (wa ? '<a class="uvit-wa" target="_blank" rel="noopener" href="' + esc(wa) + '">💬 Escribir por WhatsApp</a>' : '') +
          (tel ? '<a class="uvit-tel" href="tel:' + esc(tel) + '">📞 Llamar</a>' : '') +
        '</div>' +
        (prods.length
          ? '<div class="uvit-porta"><b>Lo que encuentras aquí</b><div class="uvit-grid">' +
            prods.map(function (x) {
              return '<figure class="uvit-prod">' +
                (x.foto ? '<img src="' + esc(x.foto) + '" alt="' + esc(x.nombre) + '" loading="lazy">' : '<div class="uvit-sinfoto">' + esc(n.emoji) + '</div>') +
                '<figcaption><span>' + esc(x.nombre) + '</span>' +
                (x.precio ? '<b>' + esc(x.precio) + '</b>' : '') + '</figcaption></figure>';
            }).join('') + '</div></div>'
          : '') +
        '<small class="ucfg-nota">URBIS conoce este emprendimiento y responde por publicarlo. ' +
        'Lo que compres lo acuerdas directamente con el negocio.</small>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.ucfg-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  };

  // ── Guardado (solo con el permiso `vitrina`; el servidor lo re-exige) ────
  function guardarNegocio(n, lat, lng) {
    const desc = sobreDe(n);
    if (desc.length > MAX_CELDA) return Promise.reject(new Error('La ficha quedó demasiado larga.'));
    if (typeof window.urbisGuardarFila !== 'function') return Promise.reject(new Error('Sin conexión con URBIS.'));
    return window.urbisGuardarFila({
      tipo: TIPO_NEGOCIO, lat: String(lat), lng: String(lng), descripcion: desc, fecha: new Date().toISOString()
    });
  }
  function actualizarNegocio(n) {
    return window.urbisDBUpdate('descripcion', n.fila.descripcion, { descripcion: sobreDe(n) })
      .then(function (r) { n.fila.descripcion = sobreDe(n); return r; });
  }

  // ── El mostrador del administrador (bandeja Vitrina del panel) ───────────
  window.urbisPintarVitrinaAdmin = function (cont) {
    if (!puedo()) {
      cont.innerHTML = '<div class="uadm-vacio">La vitrina la administra el equipo URBIS.</div>';
      return;
    }
    function listado() {
      const arr = negocios();
      cont.innerHTML =
        '<button type="button" class="ucfg-primario uvit-nuevo">＋ Nuevo emprendimiento</button>' +
        (arr.length ? arr.map(function (n, i) {
          return '<div class="uadm-item uvit-fila" data-i="' + i + '">' +
            '<div class="uadm-txt"><b>' + esc(n.emoji) + ' ' + esc(n.nombre) +
              (n.estado === 'visible' ? ' <span class="uvit-al-aire">en el mapa</span>' : ' <span class="uvit-borrador">' + (n.estado === 'pausado' ? 'pausado' : 'borrador') + '</span>') + '</b>' +
            '<small>' + esc(n.lema || n.direccion || '') + ' · ' + itemsDe(n.id).length + ' producto(s)</small></div>' +
            '<div class="uadm-btns">' +
              '<button type="button" class="uadm-ok" data-acc="' + (n.estado === 'visible' ? 'pausar' : 'publicar') + '">' +
                (n.estado === 'visible' ? 'Pausar' : 'Mostrar en el mapa') + '</button>' +
              '<button type="button" class="uadm-ver" data-acc="editar">Editar</button>' +
              '<button type="button" class="uadm-del" data-acc="borrar-negocio">Eliminar</button>' +
            '</div></div>';
        }).join('') : '<div class="uadm-vacio">Todavía no hay emprendimientos. Crea el primero.</div>');

      cont.querySelector('.uvit-nuevo').addEventListener('click', function () { formulario(null); });
      cont.querySelectorAll('[data-acc]').forEach(function (b) {
        b.addEventListener('click', async function () {
          const n = negocios()[parseInt(b.closest('.uvit-fila').getAttribute('data-i'), 10)];
          if (!n) return;
          const acc = b.getAttribute('data-acc');
          if (acc === 'editar') { formulario(n); return; }
          if (acc === 'borrar-negocio') {
            if (!confirm('¿Eliminar “' + n.nombre + '” y todo su portafolio?\n\nNo se puede deshacer.')) return;
            b.disabled = true; b.textContent = '…';
            try {
              await window.urbisDBDelete('descripcion', n.fila.descripcion);
              // El portafolio cuelga del id del negocio: se va con él, para no
              // dejar fotos huérfanas ocupando hoja.
              try { await window.urbisDBDelete('lat', n.id); } catch (e) {}
              window.urbisVitrina = (window.urbisVitrina || []).filter(function (x) { return x !== n.fila; });
              window.urbisVitrinaItems = (window.urbisVitrinaItems || []).filter(function (x) { return String(x.lat) !== n.id; });
              render(); listado();
            } catch (e) { b.disabled = false; b.textContent = 'Eliminar'; alert('No se pudo: ' + (e.message || e)); }
            return;
          }
          // publicar / pausar: el interruptor con el que el administrador
          // AUTORIZA que el negocio salga junto a los reportes y eventos.
          b.disabled = true; b.textContent = '…';
          n.estado = (acc === 'publicar') ? 'visible' : 'pausado';
          try { await actualizarNegocio(n); render(); listado(); }
          catch (e) { b.disabled = false; alert('No se pudo: ' + (e.message || e)); listado(); }
        });
      });
    }

    // ── Alta y edición ──────────────────────────────────────────────────
    function formulario(n) {
      const editando = !!n;
      const v = n || { id: nuevoId(), nombre:'', emoji:'🛍️', lema:'', descripcion:'',
                       telefono:'', whatsapp:'', direccion:'', horario:'', estado:'borrador' };
      cont.innerHTML =
        '<button type="button" class="uvit-volver">← Volver a la lista</button>' +
        '<div class="uvit-form">' +
          '<label>¿Qué emoji lo representa?</label>' +
          '<div class="uvit-elegido"><span id="uvit-muestra">' + esc(v.emoji) + '</span>' +
            '<small>El que se verá en el mapa. Busca tu oficio o elige de la lista.</small></div>' +
          '<input type="text" id="uvit-buscar-e" placeholder="Buscar: barbería, pizza, celulares…" autocomplete="off">' +
          '<div class="uvit-emojis"></div>' +
          '<label>Color del negocio</label>' +
          '<div class="uvit-colores">' + COLORES.map(function (c) {
            return '<button type="button" class="uvit-c' + (c[0] === (v.color || COLOR_POR_DEFECTO) ? ' on' : '') +
                   '" data-c="' + c[0] + '" title="' + c[1] + '" aria-label="' + c[1] + '"' +
                   ' style="background:' + c[0] + '"></button>';
          }).join('') + '</div>' +
          '<label>Nombre del emprendimiento</label>' +
          '<input id="uvit-nombre" maxlength="60" value="' + esc(v.nombre) + '" placeholder="Barbería Don Luis">' +
          '<label>En una frase, ¿qué es?</label>' +
          '<input id="uvit-lema" maxlength="90" value="' + esc(v.lema) + '" placeholder="Cortes clásicos y modernos en Atalaya">' +
          '<label>Cuéntale a la gente qué encuentra aquí</label>' +
          '<textarea id="uvit-desc" rows="3" maxlength="600" placeholder="Qué venden, qué los hace especiales, desde cuándo…">' + esc(v.descripcion) + '</textarea>' +
          '<div class="uvit-dos"><div><label>Teléfono</label>' +
          '<input id="uvit-tel" maxlength="20" inputmode="tel" value="' + esc(v.telefono) + '" placeholder="3001234567"></div>' +
          '<div><label>WhatsApp</label>' +
          '<input id="uvit-wa" maxlength="20" inputmode="tel" value="' + esc(v.whatsapp) + '" placeholder="igual o distinto"></div></div>' +
          '<label>Dirección</label>' +
          '<input id="uvit-dir" maxlength="90" value="' + esc(v.direccion) + '" placeholder="Cra 5 #12-34, barrio Atalaya">' +
          '<label>Horario</label>' +
          '<input id="uvit-hora" maxlength="60" value="' + esc(v.horario) + '" placeholder="Lun–Sáb 9am–7pm">' +
          (editando ? '' :
            '<label>¿Dónde queda?</label>' +
            '<div class="uvit-ubic">' +
              '<button type="button" id="uvit-gps">📡 Usar mi ubicación</button>' +
              '<button type="button" id="uvit-toque">🗺️ Tocar el mapa</button>' +
              '<span id="uvit-coord">sin ubicación</span>' +
            '</div>') +
          '<div class="ucfg-error" hidden></div>' +
          '<button type="button" class="ucfg-primario" id="uvit-guardar">' + (editando ? 'Guardar cambios' : 'Crear (queda en borrador)') + '</button>' +
          (editando ? '<div class="uvit-porta-admin"><b>Portafolio</b><div id="uvit-items"></div>' +
            '<div class="uvit-item-nuevo">' +
              '<label class="ucfg-foto"><span id="uvit-if-txt">📷 Foto del producto</span><input type="file" id="uvit-ifoto" accept="image/*"></label>' +
              '<input id="uvit-inombre" maxlength="60" placeholder="Nombre (ej: Corte + barba)">' +
              '<input id="uvit-iprecio" maxlength="20" placeholder="Precio (ej: $25.000)">' +
              '<button type="button" class="ucfg-primario" id="uvit-iadd">Agregar al portafolio</button>' +
            '</div></div>' : '') +
        '</div>';

      cont.querySelector('.uvit-volver').addEventListener('click', listado);

      // ── Selector de emoji ─────────────────────────────────────────────
      let emoji = v.emoji;
      let color = v.color || COLOR_POR_DEFECTO;
      const zonaE = cont.querySelector('.uvit-emojis');
      const muestra = cont.querySelector('#uvit-muestra');

      function pintarEmojis(filtro) {
        const q = sinAcentos(filtro || '').trim();
        let html = '';
        CATALOGO.forEach(function (grupo) {
          const hallados = grupo[1].filter(function (e) {
            return !q || sinAcentos(e[1]).indexOf(q) !== -1;
          });
          if (!hallados.length) return;
          // Buscando no se agrupa: quien escribe "pizza" quiere el resultado,
          // no un índice de categorías con una sola cosa dentro.
          if (!q) html += '<div class="uvit-e-grupo">' + esc(grupo[0]) + '</div>';
          html += hallados.map(function (e) {
            return '<button type="button" class="uvit-e' + (e[0] === emoji ? ' on' : '') +
                   '" data-e="' + e[0] + '" title="' + esc(e[1].split(' ')[0]) + '">' + e[0] + '</button>';
          }).join('');
        });
        zonaE.innerHTML = html ||
          '<div class="uvit-e-nada">Sin resultados. Prueba con el oficio: “panadería”, “taller”, “ropa”…</div>';
        zonaE.querySelectorAll('.uvit-e').forEach(function (b) {
          b.addEventListener('click', function () {
            zonaE.querySelectorAll('.uvit-e').forEach(function (x) { x.classList.remove('on'); });
            b.classList.add('on');
            emoji = b.getAttribute('data-e');
            muestra.textContent = emoji;
          });
        });
      }
      pintarEmojis('');
      cont.querySelector('#uvit-buscar-e').addEventListener('input', function () {
        pintarEmojis(this.value);
      });

      cont.querySelectorAll('.uvit-c').forEach(function (b) {
        b.addEventListener('click', function () {
          cont.querySelectorAll('.uvit-c').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          color = b.getAttribute('data-c');
          cont.querySelector('.uvit-elegido').style.setProperty('--uvit-color', color);
        });
      });
      cont.querySelector('.uvit-elegido').style.setProperty('--uvit-color', color);

      let lat = editando ? v.fila.lat : '', lng = editando ? v.fila.lng : '';
      const coordTxt = cont.querySelector('#uvit-coord');
      function marcarCoord() { if (coordTxt) coordTxt.textContent = '✓ ubicado'; }
      if (!editando) {
        cont.querySelector('#uvit-gps').addEventListener('click', function () {
          coordTxt.textContent = 'buscando…';
          navigator.geolocation.getCurrentPosition(function (pos) {
            lat = pos.coords.latitude.toFixed(7); lng = pos.coords.longitude.toFixed(7); marcarCoord();
          }, function () { coordTxt.textContent = 'no se pudo — toca el mapa'; }, { enableHighAccuracy: true, timeout: 10000 });
        });
        cont.querySelector('#uvit-toque').addEventListener('click', function () {
          // Se cierra el panel, se toca el sitio y el formulario vuelve con la
          // ubicación puesta. El mapa es global; un toque de una sola vez.
          // La que esté alojando el formulario: su ventana propia o, si un
          // día vuelve a colgar del panel general, la de aquel. Buscarla por
          // el árbol en vez de por un id fijo evita que "tocar el mapa" se
          // rompa la próxima vez que el mostrador cambie de casa.
          const panel = cont.closest('.urbis-cfg-overlay');
          if (panel) panel.style.display = 'none';
          alert('Toca en el mapa el punto exacto donde queda el negocio.');
          const m = getMap();
          if (!m) { if (panel) panel.style.display = ''; return; }
          m.once('click', function (ev) {
            lat = ev.latlng.lat.toFixed(7); lng = ev.latlng.lng.toFixed(7);
            if (panel) panel.style.display = '';
            marcarCoord();
          });
        });
      }

      function leerCampos() {
        return {
          id: v.id, emoji: emoji, color: color,
          nombre: cont.querySelector('#uvit-nombre').value.trim(),
          lema: cont.querySelector('#uvit-lema').value.trim(),
          descripcion: cont.querySelector('#uvit-desc').value.trim(),
          telefono: cont.querySelector('#uvit-tel').value.trim(),
          whatsapp: cont.querySelector('#uvit-wa').value.trim() || cont.querySelector('#uvit-tel').value.trim(),
          direccion: cont.querySelector('#uvit-dir').value.trim(),
          horario: cont.querySelector('#uvit-hora').value.trim(),
          estado: v.estado, fila: v.fila
        };
      }

      cont.querySelector('#uvit-guardar').addEventListener('click', async function () {
        const btn = this, err = cont.querySelector('.ucfg-error');
        const d = leerCampos();
        if (!d.nombre) { err.textContent = 'El emprendimiento necesita un nombre.'; err.hidden = false; return; }
        if (!d.telefono && !d.whatsapp) { err.textContent = 'Deja al menos un número: es como la gente los va a contactar.'; err.hidden = false; return; }
        if (!editando && (!lat || !lng)) { err.textContent = 'Falta la ubicación: usa el GPS o toca el mapa.'; err.hidden = false; return; }
        btn.disabled = true; btn.textContent = 'Guardando…';
        try {
          if (editando) { Object.assign(v, d); await actualizarNegocio(v); }
          else {
            await guardarNegocio(d, lat, lng);
            const fila = { tipo: TIPO_NEGOCIO, lat: String(lat), lng: String(lng), descripcion: sobreDe(d), fecha: new Date().toISOString() };
            (window.urbisVitrina = window.urbisVitrina || []).push(fila);
          }
          render(); listado();
        } catch (e) {
          btn.disabled = false; btn.textContent = editando ? 'Guardar cambios' : 'Crear (queda en borrador)';
          err.textContent = 'No se pudo guardar: ' + (e.message || e); err.hidden = false;
        }
      });

      // ── Portafolio (solo al editar: primero existe el negocio) ─────────
      if (editando) {
        const zona = cont.querySelector('#uvit-items');
        function pintarItems() {
          const arr = itemsDe(v.id);
          zona.innerHTML = arr.length ? arr.map(function (x, i) {
            return '<div class="uvit-item" data-i="' + i + '">' +
              (x.foto ? '<img src="' + esc(x.foto) + '" alt="">' : '<span class="uvit-sinfoto">' + esc(v.emoji) + '</span>') +
              '<div><b>' + esc(x.nombre) + '</b>' + (x.precio ? '<small>' + esc(x.precio) + '</small>' : '') + '</div>' +
              '<button type="button" class="uadm-del uvit-iborrar">×</button></div>';
          }).join('') : '<small class="uvit-vacio-p">Sin productos todavía. La ficha se ve mejor con dos o tres.</small>';
          zona.querySelectorAll('.uvit-iborrar').forEach(function (b) {
            b.addEventListener('click', async function () {
              const x = itemsDe(v.id)[parseInt(b.closest('.uvit-item').getAttribute('data-i'), 10)];
              if (!x || !confirm('¿Quitar “' + x.nombre + '” del portafolio?')) return;
              b.disabled = true;
              try {
                await window.urbisDBDelete('descripcion', x.fila.descripcion);
                window.urbisVitrinaItems = (window.urbisVitrinaItems || []).filter(function (f) { return f !== x.fila; });
                pintarItems();
              } catch (e) { b.disabled = false; alert('No se pudo: ' + (e.message || e)); }
            });
          });
        }
        pintarItems();
        const inputFoto = cont.querySelector('#uvit-ifoto');
        inputFoto.addEventListener('change', function () {
          const f = this.files && this.files[0];
          cont.querySelector('#uvit-if-txt').textContent = f ? ('✓ ' + f.name.slice(0, 24)) : '📷 Foto del producto';
        });
        cont.querySelector('#uvit-iadd').addEventListener('click', async function () {
          const btn = this, err = cont.querySelector('.ucfg-error');
          const nombre = cont.querySelector('#uvit-inombre').value.trim().replace(/~~~/g, ' ');
          const precio = cont.querySelector('#uvit-iprecio').value.trim().replace(/~~~/g, ' ');
          if (!nombre) { err.textContent = 'Ponle nombre al producto.'; err.hidden = false; return; }
          btn.disabled = true; btn.textContent = 'Agregando…';
          let foto = '';
          const f = inputFoto.files && inputFoto.files[0];
          const comprimir = window.procesarImagenSeleccionada || window.urbanProcesarImagen;
          if (f && typeof comprimir === 'function') {
            try { foto = await comprimir(f); } catch (e) { foto = ''; }
          }
          let desc = [nuevoId(), nombre, precio, foto].join('~~~');
          if (desc.length > MAX_CELDA) desc = [nuevoId(), nombre, precio, ''].join('~~~');
          try {
            await window.urbisGuardarFila({ tipo: TIPO_ITEM, lat: v.id, lng: '0', descripcion: desc, fecha: new Date().toISOString() });
            (window.urbisVitrinaItems = window.urbisVitrinaItems || []).push({ tipo: TIPO_ITEM, lat: v.id, lng: '0', descripcion: desc });
            cont.querySelector('#uvit-inombre').value = ''; cont.querySelector('#uvit-iprecio').value = '';
            inputFoto.value = ''; cont.querySelector('#uvit-if-txt').textContent = '📷 Foto del producto';
            err.hidden = true; pintarItems();
          } catch (e) { err.textContent = 'No se pudo agregar: ' + (e.message || e); err.hidden = false; }
          btn.disabled = false; btn.textContent = 'Agregar al portafolio';
        });
      }
    }

    listado();
  };

  /* Ventana PROPIA del mostrador. Antes se pedía prestado el panel general,
     y eso traía detrás las bandejas de aprobar, denuncias, peticiones y
     equipo: entrar a administrar emprendimientos no tiene por qué poner a
     la vista todo lo demás. La Vitrina es su propio módulo y se administra
     en su propia casa. */
  window.urbisAbrirVitrinaAdmin = function () {
    if (!puedo()) { alert('La vitrina la administra el equipo URBIS.'); return; }
    const previo = document.getElementById('urbis-vitrina-admin');
    if (previo) previo.remove();
    const ov = document.createElement('div');
    ov.id = 'urbis-vitrina-admin';
    ov.className = 'urbis-cfg-overlay';
    ov.innerHTML =
      '<div class="urbis-cfg urbis-cfg-largo uvit-mostrador" role="dialog" aria-modal="true">' +
        '<button type="button" class="ucfg-x" aria-label="Cerrar">×</button>' +
        '<h3>🛍️ Emprendimientos URBIS</h3>' +
        '<p class="ucfg-sub">Tu mostrador: crea la ficha de cada negocio, arma su ' +
        'portafolio y decide cuáles se ven en el mapa.</p>' +
        '<div class="uvit-mostrador-cuerpo"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.ucfg-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    window.urbisPintarVitrinaAdmin(ov.querySelector('.uvit-mostrador-cuerpo'));
  };

  // ── El módulo del inicio: la puerta grande de la vitrina ─────────────────
  /* La gota del mapa es el descubrimiento casual; esta tarjeta es la entrada
     a propósito. Sale en "Módulos principales" PARA TODO EL MUNDO — esconderla
     dejaría la promoción de los negocios sin público, que es su razón de ser.
     Lo que sí es solo del equipo es el botón de administrar, adentro.

     Se inyecta en vez de escribirse en el HTML de js/20 por la misma razón
     que el botón de Configuración: esa pantalla se repinta sola y lo escrito
     a mano desaparecería. */
  function montarModuloInicio() {
    const grid = document.querySelector('.u52-grid-primary');
    if (!grid || grid.querySelector('[data-u52-go="vitrina"]')) return;
    const b = document.createElement('button');
    b.className = 'u52-module vitrina u52-jac-module';
    b.setAttribute('data-u52-go', 'vitrina');
    /* "Emprendimientos URBIS" es el nombre bueno: "del barrio" sonaba a
       clasificado de esquina, y lo que aquí se publica lleva el respaldo de
       URBIS encima. Como "Emprendimientos" es una palabra más ancha que la
       casilla, css/55 le deja partirse con guion en vez de desbordar. */
    b.innerHTML = '<span class="uvit-mod-ico">🛍️</span><b>Vitrina</b><small>Emprendimientos URBIS</small>';
    const eventos = grid.querySelector('[data-u52-go="events"]');
    if (eventos && eventos.nextSibling) grid.insertBefore(b, eventos.nextSibling);
    else grid.appendChild(b);
  }

  function montarPantalla() {
    if (document.querySelector('[data-u52-screen="vitrina"]')) return;
    const hermana = document.querySelector('.u52-screen[data-u52-screen="events"]');
    if (!hermana || !hermana.parentElement) return;
    const sec = document.createElement('section');
    sec.className = 'u52-screen';
    sec.setAttribute('data-u52-screen', 'vitrina');
    sec.innerHTML =
      '<header class="u52-topbar"><button class="u52-icon-btn" data-u52-back>←</button>' +
      '<h2 class="u52-title">🛍️ Vitrina URBIS</h2>' +
      '<span class="u52-icon-btn" style="visibility:hidden">·</span></header>' +
      '<main class="u52-content uvit-dir"></main>';
    hermana.parentElement.appendChild(sec);
    pintarDirectorio();
  }

  function pintarDirectorio() {
    const cont = document.querySelector('[data-u52-screen="vitrina"] .uvit-dir');
    if (!cont) return;
    const arr = negocios().filter(function (n) { return n.estado === 'visible'; });
    cont.innerHTML =
      '<p class="uvit-dir-intro">Emprendimientos que URBIS conoce y respalda. ' +
      'Toca uno para ver qué ofrece y escribirle directo.</p>' +
      (puedo()
        ? '<button type="button" class="uvit-dir-admin">🛠️ Administrar la vitrina</button>'
        : '') +
      (arr.length ? arr.map(function (n, i) {
        const wa = linkWhatsApp(n.whatsapp || n.telefono, n.nombre);
        const c = /^#[0-9A-Fa-f]{6}$/.test(n.color) ? n.color : COLOR_POR_DEFECTO;
        return '<div class="uvit-dir-card" data-id="' + esc(n.id) + '" style="--uvit-color:' + c + '">' +
          '<span class="uvit-dir-emoji">' + esc(n.emoji) + '</span>' +
          '<div class="uvit-dir-txt"><b>' + esc(n.nombre) + '</b>' +
          (n.lema ? '<small>' + esc(n.lema) + '</small>' : '') +
          (n.direccion ? '<small class="uvit-dir-lugar">📍 ' + esc(n.direccion) + '</small>' : '') + '</div>' +
          '<div class="uvit-dir-acc">' +
            (wa ? '<a class="uvit-dir-wa" target="_blank" rel="noopener" href="' + esc(wa) + '" aria-label="WhatsApp">💬</a>' : '') +
          '</div></div>';
      }).join('')
      : '<div class="uvit-dir-pronto"><span>✨</span><b>Muy pronto</b>' +
        '<small>Estamos preparando los primeros Emprendimientos URBIS: ' +
        'una barbería, un taller tecnológico y una odontología. Vuelve a asomarte.</small></div>') +
      '<small class="ucfg-nota">¿Tienes un emprendimiento y quieres ser parte? ' +
      'Escríbenos desde Perfil → Configuración.</small>';

    const admin = cont.querySelector('.uvit-dir-admin');
    if (admin) admin.addEventListener('click', function () { window.urbisAbrirVitrinaAdmin(); });
    cont.querySelectorAll('.uvit-dir-card').forEach(function (c) {
      c.addEventListener('click', function (e) {
        if (e.target.closest('.uvit-dir-wa')) return;   // el WhatsApp navega solo
        window.urbisAbrirVitrina(c.getAttribute('data-id'));
      });
    });
  }
  window.urbisPintarDirectorioVitrina = pintarDirectorio;

  // Al entrar al módulo se repinta: los datos pueden haber llegado después
  // de que la pantalla se montara.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-u52-go="vitrina"]')) {
      setTimeout(pintarDirectorio, 260);
    }
  });

  // ── Arranque: pintar y repintar sin acoplarse a nadie ────────────────────
  let pendienteMontar = false;
  function montarTodo() { montarModuloInicio(); montarPantalla(); }
  function arrancar() {
    render();
    montarTodo();
    if (!_timer) _timer = setInterval(render, 4000);
    // El inicio se repinta solo (cambio de sesión, avatar): el mismo vigía
    // con freno que usa el botón de Configuración, para que la tarjeta
    // reaparezca sin costar nada mientras el mapa se mueve.
    try {
      const obs = new MutationObserver(function () {
        if (pendienteMontar) return;
        pendienteMontar = true;
        setTimeout(function () { pendienteMontar = false; montarTodo(); }, 700);
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) { setInterval(montarTodo, 3000); }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(arrancar, 2000);
  else window.addEventListener('load', function () { setTimeout(arrancar, 2000); });
})();
