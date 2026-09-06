/* URBIS · VOCABULARIO DEL EDIFICIO (js/03b)
   ─────────────────────────────────────────────────────────────────────────
   Las listas con las que se describe un inmueble en campo —de qué está hecho,
   qué hay a nivel de calle, de qué época es— y el cruce que estima su
   vulnerabilidad potencial.

   Vive en su propio archivo porque lo necesitan DOS páginas que no comparten
   nada más: el mapa (index.html, que lo usa al mapear) y el análisis
   (analisis-ia.html, donde un analista levanta la ficha desde la calle). Estaba
   dentro de js/04, que arrastra Leaflet y el mapa entero, así que la página de
   análisis no podía tocarlo sin cargar medio programa.

   Aquí NO va `leerEdificio`: esa función depende del orden del registro
   serializado, que es asunto de js/04. Este archivo solo tiene vocabulario y
   reglas de dominio, sin dependencias. */
(function(){
  'use strict';

  const MATERIALIDAD_NA = 'Sin registrar';

  // Toda lista cerrada miente un poco: siempre hay un edificio que no encaja y
  // siempre hay un dato que desde la acera no se puede determinar. Sin una
  // salida, quien está mapeando elige la opción "más parecida" para poder
  // seguir, y eso mete un dato falso que después nadie distingue de uno bueno.
  // Son DOS salidas y no una porque no significan lo mismo:
  //   · NO_SE_SABE  → se miró y no se pudo determinar. Es un límite del método.
  //   · OTRO        → sí hay un valor, pero nuestro vocabulario no lo tiene.
  //                   Es un límite de la LISTA, y por eso se pide describirlo:
  //                   son las candidatas a entrar en la próxima versión.
  // Las dos valen como "desconocido" para cualquier cálculo. Ninguna se puede
  // confundir con haber observado algo.
  const NO_SE_SABE = 'No se sabe';
  const OTRO_VALOR = 'Otro (no está en la lista)';
  const SALIDAS = [NO_SE_SABE, OTRO_VALOR];
  const SIN_DATO = new Set([MATERIALIDAD_NA, NO_SE_SABE, OTRO_VALOR, '', 'undefined']);
  // Normaliza a '' lo que no es una observación utilizable.
  function valorUtil(v){
    const t = String(v || '').trim();
    return SIN_DATO.has(t) ? '' : t;
  }

  // Materialidad del contexto colombiano, en el orden en que se reconoce a
  // simple vista desde la acera. No es una ficha catastral: es lo que un
  // estudiante puede determinar mirando la fachada sin entrar.
  const MATERIALIDAD_EDIFICIO = [
    MATERIALIDAD_NA,
    'Mampostería confinada (ladrillo con vigas y columnas)',
    'Mampostería sin confinar (ladrillo o bloque solo)',
    'Concreto reforzado (pórticos o muros)',
    'Bahareque o tapia pisada',
    'Madera',
    'Prefabricado',
    'Lámina, zinc o material reciclado',
    'Mixto (varios sistemas en el mismo edificio)'
  ].concat(SALIDAS);

  // Qué hay a nivel de calle. Es UNA pregunta y no "en qué piso está cada uso"
  // porque lo que decide el comportamiento urbano no es el inventario por
  // planta, es si la fachada que se pasa caminando está viva o muerta. Un
  // centro comercial con las tiendas en el tercer piso y un vestíbulo ciego
  // abajo atrae gente igual, pero no hace calle: son dos hechos distintos y
  // hasta ahora el análisis los contaba como uno.
  const PLANTA_BAJA = [
    'Sin registrar',
    'Comercio o local con vitrina',
    'Otro uso con puerta a la calle',
    'Acceso a vivienda (vestíbulo o portería)',
    'Parqueadero o garaje',
    'Muro ciego o reja',
    'Local vacío o cerrado'
  ].concat(SALIDAS);
  // Las que NO hacen calle: se puede pasar por delante media cuadra sin que
  // ocurra nada. El vestíbulo entra aquí sin ser un defecto — una portería es
  // necesaria y correcta, simplemente no genera vida de acera.
  const PLANTA_BAJA_MUERTA = new Set([
    'Acceso a vivienda (vestíbulo o portería)',
    'Parqueadero o garaje',
    'Muro ciego o reja',
    'Local vacío o cerrado'
  ]);

  // Época de construcción. Los cortes NO son décadas redondas: son los umbrales
  // de la norma sismo resistente colombiana, que es lo que de verdad separa un
  // edificio de otro en una zona de amenaza alta como Cúcuta. El primer código
  // nacional es el Decreto 1400 de 1984, expedido tras el terremoto de Popayán
  // de 1983; lo reemplaza la NSR-98 (Ley 400 de 1997, Decreto 33 de 1998) y
  // luego la NSR-10 (Decreto 926 de 2010). Antes de 1984 no había norma que
  // cumplir, y eso importa más que si la casa es de los sesenta o los setenta.
  const EPOCA_EDIFICIO = [
    'Sin registrar',
    'Anterior a 1950',
    '1950 – 1983 (sin norma sismo resistente)',
    '1984 – 1997 (Decreto 1400 de 1984)',
    '1998 – 2009 (NSR-98)',
    '2010 o posterior (NSR-10)',
    'En construcción'
  ].concat(SALIDAS);

  // Vulnerabilidad POTENCIAL, no un diagnóstico estructural. Un curso contando
  // fachadas desde la acera no puede evaluar una estructura, y presentarlo como
  // si pudiera sería el peor error que este módulo podría enseñar. Lo que sí
  // dice, y es útil, es qué combinaciones merecen que alguien vaya a mirar en
  // serio: un muro de ladrillo sin confinar levantado antes de que existiera
  // norma no es lo mismo que un pórtico de concreto de 2015.
  const RIESGO_EPOCA = {
    'Anterior a 1950': 3,
    '1950 – 1983 (sin norma sismo resistente)': 3,
    '1984 – 1997 (Decreto 1400 de 1984)': 2,
    '1998 – 2009 (NSR-98)': 1,
    '2010 o posterior (NSR-10)': 0
  };
  const RIESGO_MATERIAL = {
    'Mampostería sin confinar (ladrillo o bloque solo)': 2,
    'Bahareque o tapia pisada': 2,
    'Lámina, zinc o material reciclado': 2,
    'Madera': 1,
    'Prefabricado': 1,
    'Mixto (varios sistemas en el mismo edificio)': 1,
    'Mampostería confinada (ladrillo con vigas y columnas)': 0,
    'Concreto reforzado (pórticos o muros)': 0
  };

  // Devuelve null cuando falta cualquiera de los dos datos: media evaluación no
  // es media verdad, es una cifra que parece saber algo y no sabe.
  function vulnerabilidadDe(materialidad, epoca){
    const re = RIESGO_EPOCA[epoca], rm = RIESGO_MATERIAL[materialidad];
    if (re === undefined || rm === undefined) return null;
    const total = re + rm;
    return { puntos: total,
             nivel: total >= 4 ? 'Alta' : total >= 2 ? 'Media' : 'Baja' };
  }


  // ── El edificio piso por piso ──────────────────────────────────────────
  // Se pidió mapeando en la calle: «la mayoría de los usos son por edificios
  // y dentro de ese edificio existen diferentes usos: primer piso tienda y
  // segundo vivienda (mixto); cuatro pisos… así marcamos el piso y así
  // calculamos alturas». Hasta acá un punto tenía UN número de pisos y una
  // lista plana de usos; lo que no tenía era en qué piso está cada uno, que
  // es lo que distingue una casa con tienda de una torre de oficinas con
  // local abajo.
  //
  // El vocabulario es corto a propósito: es lo que se asigna a cada planta
  // en diez segundos desde la acera. El detalle fino —qué comercio, qué
  // institución— ya lo dice el uso del punto.
  const USOS_PISO = [
    'Vivienda',
    'Comercio',
    'Oficinas o servicios',
    'Educación, salud o institucional',
    'Hospedaje',
    'Industria, taller o bodega',
    'Parqueadero',
    'Desocupado o en obra',
    NO_SE_SABE
  ];
  const USOS_PISO_UTILES = new Set(USOS_PISO.filter(u => u !== NO_SE_SABE));
  // La subcategoría del motor para cada uso de piso, para que el análisis
  // reparta la altura entre lo que hay de verdad en cada planta.
  const SUB_DE_USO_PISO = {
    'Vivienda': 'residencial',
    'Comercio': 'comercio_otro',
    'Oficinas o servicios': 'oficina',
    'Educación, salud o institucional': 'gobierno',
    'Hospedaje': 'hotel',
    'Industria, taller o bodega': 'bodega',
    'Parqueadero': 'transporte',
    'Desocupado o en obra': 'local_vacio'
  };
  const PISOS_TOPE = 60;

  // "1:Comercio;2-4:Vivienda" ⇄ [{piso:1, uso:'Comercio'}, {piso:2, uso:'Vivienda'}, …]
  // Con tramos para que una torre de treinta pisos no ocupe media casilla.
  // Nunca lleva «|»: es el separador del registro.
  function codificarPisos(lista){
    const porPiso = {};
    (lista || []).forEach(x => {
      const p = parseInt(x && x.piso, 10);
      const u = String((x && x.uso) || '').trim();
      if (isFinite(p) && p >= 1 && p <= PISOS_TOPE && USOS_PISO.indexOf(u) !== -1) porPiso[p] = u;
    });
    const pisos = Object.keys(porPiso).map(Number).sort((a, b) => a - b);
    const tramos = [];
    pisos.forEach(p => {
      const ult = tramos[tramos.length - 1];
      if (ult && ult.uso === porPiso[p] && ult.hasta === p - 1) ult.hasta = p;
      else tramos.push({ desde: p, hasta: p, uso: porPiso[p] });
    });
    return tramos.map(t => (t.desde === t.hasta ? t.desde : t.desde + '-' + t.hasta) + ':' + t.uso).join(';');
  }
  function leerPisos(texto){
    const out = [];
    String(texto || '').split(';').forEach(tramo => {
      const m = tramo.trim().match(/^(\d{1,2})(?:-(\d{1,2}))?:(.+)$/);
      if (!m) return;
      const uso = m[3].trim();
      if (USOS_PISO.indexOf(uso) === -1) return;
      const desde = parseInt(m[1], 10), hasta = m[2] ? parseInt(m[2], 10) : desde;
      for (let p = desde; p <= Math.min(hasta, PISOS_TOPE); p++) out.push({ piso: p, uso: uso });
    });
    // Un piso, un uso: si el texto lo repite, manda el último.
    const porPiso = {};
    out.forEach(x => { porPiso[x.piso] = x.uso; });
    return Object.keys(porPiso).map(Number).sort((a, b) => a - b).map(p => ({ piso: p, uso: porPiso[p] }));
  }

  // Qué es el edificio, leído de sus pisos. `mixto` solo cuando hay dos usos
  // observados distintos: «no se sabe» no mezcla nada.
  function mezclaDe(lista){
    const l = (lista || []).slice().sort((a, b) => a.piso - b.piso);
    const utiles = l.filter(x => USOS_PISO_UTILES.has(x.uso));
    const distintos = [];
    utiles.forEach(x => { if (distintos.indexOf(x.uso) === -1) distintos.push(x.uso); });
    const minus = u => String(u).charAt(0).toLowerCase() + String(u).slice(1);
    let resumen = '';
    if (!l.length) resumen = '';
    else if (!distintos.length) resumen = 'Sin usos observados';
    else if (distintos.length === 1) resumen = 'Todo ' + minus(distintos[0]);
    else {
      const abajo = utiles[0], arriba = utiles.slice(1);
      const arribaIgual = arriba.length && arriba.every(x => x.uso === arriba[0].uso) && arriba[0].uso !== abajo.uso;
      if (abajo.piso === 1 && arribaIgual) resumen = abajo.uso + ' abajo, ' + minus(arriba[0].uso) + ' arriba';
      else resumen = 'Mixto: ' + distintos.map(u => {
        const ps = utiles.filter(x => x.uso === u).map(x => x.piso);
        return minus(u) + ' (piso' + (ps.length > 1 ? 's ' : ' ') + ps.join(', ') + ')';
      }).join(', ');
    }
    return { pisos: l.length, usos: distintos, mixto: distintos.length >= 2, resumen: resumen };
  }

  // Cuánto levanta, si el nombre del tipo lo dice: «Casa de dos pisos»,
  // «Torre residencial (4–10 pisos)». Cero cuando no lo dice.
  function pisosDelNombre(nombre){
    const t = String(nombre || '').toLowerCase();
    const palabra = { 'un piso': 1, 'una planta': 1, 'dos pisos': 2, 'tres pisos': 3, 'tres o más pisos': 3,
                      'cuatro pisos': 4, 'cinco pisos': 5 };
    for (const k in palabra) if (t.indexOf(k) !== -1) return palabra[k];
    const rango = t.match(/\((\d+)\s*[–-]\s*(\d+)\s*pisos\)/);
    if (rango) return parseInt(rango[1], 10);
    const mas = t.match(/(\d+)\+\s*pisos/);
    if (mas) return parseInt(mas[1], 10);
    return 0;
  }

  // Qué usos de la Matriz de Pro City NO son un edificio: un parque, una vía o
  // un lote baldío no tienen pisos, y preguntarlos estorba.
  const USOS_MATRIZ_SIN_PISOS = new Set([
    'Esp. Público', 'Deportivo', 'Mobiliario Urbano', 'Vías e Infraestructura Vial',
    'Protección Ambiental', 'Forestal', 'Agropecuario / Rural',
    'Ronda Hídrica / Protección de Cuerpos de Agua', 'Zona Baldía', 'Zona de Riesgo',
    'Espacio Residual', 'Zona de Expansión Urbana', 'Extractivo (Minería/Canteras)',
    'Comunicaciones / Antenas', 'Espacio Ferial / Eventos Masivos'
  ]);
  function esUsoDeEdificio(usoMatriz){
    const u = String(usoMatriz || '').trim();
    return !!u && !USOS_MATRIZ_SIN_PISOS.has(u);
  }
  // El uso de piso con que se prellena cada planta según el uso del punto. Los
  // mixtos declarados ya dicen cómo se reparten: local abajo, lo otro arriba.
  const USO_PISO_DE_MATRIZ = {
    'Residencial': 'Vivienda', 'Vivienda de Interés Social (VIS/VIP)': 'Vivienda',
    'Asentamiento Informal': 'Vivienda', 'Hogar de Cuidado': 'Educación, salud o institucional',
    'Ocio / Negocio': 'Comercio', 'Comercial': 'Comercio', 'Estación de Servicio (Gasolinera)': 'Comercio',
    'Abastecimiento Mayorista (Central de Abastos)': 'Comercio', 'Zona Franca / Comercio Exterior': 'Industria, taller o bodega',
    'Parqueadero / Estacionamiento': 'Parqueadero', 'Turístico / Hotelero': 'Hospedaje',
    'Institucional': 'Educación, salud o institucional', 'Gubernamental / Administrativo': 'Oficinas o servicios',
    'Militar / Policial': 'Educación, salud o institucional', 'Seguridad / Judicial': 'Oficinas o servicios',
    'Industrial (Pesada/Ligera)': 'Industria, taller o bodega', 'Logístico / Almacenamiento': 'Industria, taller o bodega',
    'Logística de carga (patios y talleres)': 'Industria, taller o bodega',
    'Salud (Clínicas/Hospitales)': 'Educación, salud o institucional', 'Emergencias (Bomberos/Rescate)': 'Educación, salud o institucional',
    'Cuidado Animal (Veterinaria)': 'Oficinas o servicios', 'Cultural / Patrimonio': 'Educación, salud o institucional',
    'Educativo (Básico/Superior)': 'Educación, salud o institucional', 'Religioso / Culto': 'Educación, salud o institucional',
    'Gestión de Residuos / Reciclaje': 'Industria, taller o bodega', 'Transporte (Terminales/Estaciones)': 'Oficinas o servicios',
    'Infra. Servicios (Plantas)': 'Industria, taller o bodega', 'Servicios Funerarios': 'Oficinas o servicios',
    'En Obra / Construcción': 'Desocupado o en obra', 'Abandono / Ruina': 'Desocupado o en obra'
  };
  const MIXTOS_DECLARADOS = {
    'Mixto (Residencial-Comercial)': { abajo: 'Comercio', arriba: 'Vivienda' },
    'Mixto (Residencial-Industrial)': { abajo: 'Industria, taller o bodega', arriba: 'Vivienda' },
    'Uso Múltiple / Mixto General': { abajo: 'Comercio', arriba: 'Oficinas o servicios' }
  };
  function usoPisoPorDefecto(usoMatriz, piso){
    const u = String(usoMatriz || '').trim();
    const mx = MIXTOS_DECLARADOS[u];
    if (mx) return piso <= 1 ? mx.abajo : mx.arriba;
    return USO_PISO_DE_MATRIZ[u] || NO_SE_SABE;
  }
  // Y para las categorías del reporte ciudadano, que son más gruesas.
  const USO_PISO_DE_CATEGORIA = {
    'Vivienda y Residencial': 'Vivienda', 'Comercio y Servicios': 'Comercio',
    'Grandes Equipamientos': 'Educación, salud o institucional', 'Salud y Emergencias': 'Educación, salud o institucional',
    'Patrimonio y Turismo': 'Educación, salud o institucional', 'Industria y Logística': 'Industria, taller o bodega',
    'Oficinas y Co-working': 'Oficinas o servicios', 'Servicios Ocultos': 'Oficinas o servicios',
    'Animal y Bienestar': 'Oficinas o servicios', 'Áreas Deportivas': NO_SE_SABE
  };
  function usoPisoDeCategoria(cat){ return USO_PISO_DE_CATEGORIA[String(cat || '').trim()] || NO_SE_SABE; }

  // ── El formulario, piso por piso ────────────────────────────────────────
  // Un desplegable por planta, del último piso al primero, como se mira un
  // edificio. Es HTML puro para que lo usen las dos páginas; `activar` lo
  // conecta al campo de pisos y vuelve a armarlo cuando cambia el número,
  // conservando lo que ya se había elegido.
  const FILAS_TOPE = 12;   // más de doce se arrastran desde el último elegido
  function escHtml(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function htmlUsosPorPiso(pisos, actuales, defectoDe){
    const n = Math.max(0, Math.min(parseInt(pisos, 10) || 0, PISOS_TOPE));
    if (!n) return '';
    const elegido = {};
    (actuales || []).forEach(x => { elegido[x.piso] = x.uso; });
    const filas = [];
    const tope = Math.min(n, FILAS_TOPE);
    for (let p = tope; p >= 1; p--) {
      const val = elegido[p] || (typeof defectoDe === 'function' ? defectoDe(p) : '') || NO_SE_SABE;
      const rotulo = (p === FILAS_TOPE && n > FILAS_TOPE) ? 'Piso ' + p + ' al ' + n : (p === 1 ? 'Piso 1 (calle)' : 'Piso ' + p);
      filas.push('<div class="edif-piso"><label for="ins-uso-piso-' + p + '">' + escHtml(rotulo) + '</label>' +
        '<select id="ins-uso-piso-' + p + '" class="ins-uso-piso" data-piso="' + p + '">' +
        USOS_PISO.map(u => '<option value="' + escHtml(u) + '"' + (u === val ? ' selected' : '') + '>' + escHtml(u) + '</option>').join('') +
        '</select></div>');
    }
    return filas.join('');
  }
  function leerUsosPorPisoDelFormulario(raiz){
    const R = raiz || document;
    const insPisos = R.querySelector('#ins-pisos');
    const n = Math.min(parseInt(insPisos && insPisos.value, 10) || 0, PISOS_TOPE);
    if (!n) return [];
    const sel = {};
    R.querySelectorAll('select.ins-uso-piso').forEach(s => { sel[parseInt(s.getAttribute('data-piso'), 10)] = s.value; });
    const out = [];
    let ultimo = '';
    for (let p = 1; p <= n; p++) {
      const u = sel[p] || ultimo;
      if (!u) continue;
      ultimo = u;
      out.push({ piso: p, uso: u });
    }
    return out;
  }
  function activarUsosPorPiso(raiz, defectoDe){
    const R = raiz || document;
    const insPisos = R.querySelector('#ins-pisos'), cont = R.querySelector('#ins-pisos-usos');
    if (!insPisos || !cont) return;
    const resumen = R.querySelector('#ins-pisos-resumen');
    const decir = () => {
      if (!resumen) return;
      const m = mezclaDe(leerUsosPorPisoDelFormulario(R));
      resumen.textContent = m.resumen ? (m.mixto ? 'Edificio mixto · ' : '') + m.resumen : '';
      resumen.classList.toggle('es-mixto', !!m.mixto);
    };
    const rearmar = () => {
      cont.innerHTML = htmlUsosPorPiso(insPisos.value, leerUsosPorPisoDelFormulario(R), defectoDe);
      decir();
    };
    insPisos.addEventListener('input', rearmar);
    insPisos.addEventListener('change', rearmar);
    cont.addEventListener('change', decir);
    decir();
  }

  // Se expone lo que no depende del registro. js/04 añade después `leer`,
  // `usosMarcados` y `esCategoriaEdificio` sobre este mismo objeto.
  window.URBIS_EDIFICIO = Object.assign(window.URBIS_EDIFICIO || {}, {
    MATERIALIDAD: MATERIALIDAD_EDIFICIO,
    PLANTA_BAJA: PLANTA_BAJA,
    EPOCA: EPOCA_EDIFICIO,
    SIN_REGISTRAR: MATERIALIDAD_NA,
    NO_SE_SABE: NO_SE_SABE,
    OTRO: OTRO_VALOR,
    valorUtil: valorUtil,
    vulnerabilidadDe: vulnerabilidadDe,
    // Única definición de qué frente NO hace calle.
    esFrenteMuerto: function (v){ return PLANTA_BAJA_MUERTA.has(String(v || '')); },
    // El edificio piso por piso.
    USOS_PISO: USOS_PISO,
    codificarPisos: codificarPisos,
    leerPisos: leerPisos,
    mezclaDe: mezclaDe,
    subDeUsoPiso: function (u){ return SUB_DE_USO_PISO[String(u || '').trim()] || ''; },
    pisosDelNombre: pisosDelNombre,
    esUsoDeEdificio: esUsoDeEdificio,
    usoPisoPorDefecto: usoPisoPorDefecto,
    usoPisoDeCategoria: usoPisoDeCategoria,
    htmlUsosPorPiso: htmlUsosPorPiso,
    leerUsosPorPisoDelFormulario: leerUsosPorPisoDelFormulario,
    activarUsosPorPiso: activarUsosPorPiso
  });
})();
