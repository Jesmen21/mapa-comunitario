/* URBIS · MÓDULO DE VIVIENDAS — EL ESQUEMA (js/83)
   ═══════════════════════════════════════════════════════════════════════════
   Las viviendas que URBIS publica para la venta —y después para el arriendo—,
   cada una con sus fortalezas y con el análisis de ubicación del sector al
   lado. Ese es el diferenciador entero: un anuncio dice «excelente
   ubicación», y acá cada fortaleza tiene que decir DE DÓNDE sale.

   Este archivo es el PRIMER PELDAÑO y es solo el esquema: la declaración del
   módulo, la forma de una vivienda, lo que se le exige y lo que sale a la
   calle. NO hay interfaz y NO escribe en ninguna parte.

   ── POR QUÉ NO ESTÁ EN js/ TODAVÍA, QUE ES DONDE VA A VIVIR ───────────────
   Su sitio es `js/83-viviendas.js` y acá está en espera, con el nombre que va
   a llevar. La razón se midió y no es de gusto: `revisar.js` tiene una guarda
   con techo CERO contra «archivo de js/ o css/ que nadie carga» —la clase C,
   un archivo que ningún navegador recibe se ve igual que uno que no existe— y
   puesto en `js/` la dispara en su primera corrida. Cargarlo pide dos cambios
   en archivos COMPARTIDOS: la lista de `<script>` de `index.html` y el
   precaché de `service-worker.js`, que son de la cabeza y se piden, no se
   tocan (herramientas/COORDINACION-MODULOS.md §3).

   Las dos salidas baratas estaban a la vista y las dos son peores: tocar los
   compartidos por mi cuenta, y aflojar la guarda para que un archivo huérfano
   pase. La segunda es la que este proyecto tiene prohibida por escrito —una
   prueba que falla por un cambio legítimo se hace más precisa, no más laxa—,
   y además la guarda NO está equivocada: tiene razón, el archivo hoy no llega
   a ningún navegador. Así que se queda acá, dicho, hasta que la cabeza lo
   enganche; el pedido está en herramientas/modulos/viviendas.md y es de dos
   líneas. El día que se mueva, `revisar.js` lo encuentra solo: su guarda
   busca el módulo en las DOS rutas y publica en cuál lo halló.

   ── POR QUÉ NO SABE DÓNDE SE GUARDA ───────────────────────────────────────
   Daniel decidió el 23 de octubre de 2026 que el almacén de arranque es el de
   la Vitrina —la capa de mapeos vía Apps Script— y que es TRANSITORIO: el
   modelo tiene que poder pasar a Postgres sin rehacerse. Así que el objeto
   canónico de acá es JSON plano y no nombra el almacén en ninguna parte; lo
   único que lo nombra es el ADAPTADOR del §8, que es una capa aparte y
   reemplazable. La guarda de `revisar.js` mide justamente eso: que ninguna
   clave del esquema hable de filas, sobres, columnas ni hojas. Sin esa
   medición, «el modelo no depende del almacén» es una buena intención.

   ── LAS TRES REGLAS DEL PROYECTO QUE ESTE ARCHIVO APLICA ──────────────────
   · **Una cifra sin medir se imprime «SIN MEDIR», y cero no es ausente**
     (regla 6 de Daniel; v875 en el repositorio). Toda cifra es `{v, origen}`:
     `{v:0,  origen:'declarado'}` es «no tiene parqueadero», un hecho;
     `{v:null, origen:null}` es «nadie lo midió». Las dos redacciones están
     escritas, la de N y la de cero (v970), y las dos se miden.
   · **Una afirmación ancla su propia frase** (v1127). Una fortaleza lleva
     `base` —la clave del dato del análisis que la sostiene— o `sinBase` con
     su razón escrita. Nunca ninguna de las dos, nunca las dos.
   · **El aviso de procedencia viaja con la cifra, no con la pantalla**
     (v867). `paraPublicar` arma SIEMPRE el bloque `procedencia`, con sus dos
     redacciones —hay análisis y no hay análisis—, de modo que una pantalla
     nueva lo hereda sin que su autor se acuerde. Ese fue el fallo de la v866:
     no que alguien decidiera callarlo, sino que había que acordarse.

   LO QUE ESTE ARCHIVO NO HACE, dicho acá y no en una nota aparte (v945):
   no guarda nada, no pinta nada, no sabe si el `analisis` al que apunta una
   vivienda existe de verdad —eso pide leer `pcr_fichas_v1`, que es el peldaño
   siguiente— y no comprueba que el valor que una fortaleza cita esté presente
   en esa ficha: comprueba que la CLAVE citada sea una de las que el análisis
   produce, y el catálogo de claves está atado a `js/68` por `revisar.js`. */
(function () {
  'use strict';

  var MODULO_ID = 'viviendas';

  /* ── §1 · LOS TIPOS QUE SE PUBLICAN ───────────────────────────────────────
     Lista propia, NO derivada de `PROCITY_MATRIZ_USOS`, y la razón es la
     prueba de la v879: *¿existe un cambio razonable que deba mover una y no
     la otra?* Sí, y en los dos sentidos. La matriz es la taxonomía de lo que
     se MAPEA en el territorio; esta es la de lo que URBIS VENDE. «Inquilinato
     / pieza en arriendo» es una categoría de mapeo legítima y no un producto
     de venta, y mañana puede haber un producto que la matriz no contemple.
     Son dos cosas que coinciden hoy, así que se ATAN con una guarda en vez de
     derivarse: `revisar.js` exige que CADA tipo de acá exista en la matriz
     —para que una vivienda publicada siempre se pueda mapear— y deja que la
     matriz tenga los que quiera de más. La atadura es a propósito asimétrica. */
  var TIPOS = [
    'Casa de un piso',
    'Casa de dos pisos',
    'Casa de tres o más pisos',
    'Casa con antejardín',
    'Casa con garaje',
    'Casa patio / casalote',
    'Casa esquinera',
    'Edificio de apartamentos (1–3 pisos)',
    'Torre residencial (4–10 pisos)',
    'Torre alta (10+ pisos)',
    'Conjunto cerrado / urbanización',
    'Casa campestre / quinta',
    'Vivienda multifamiliar',
    'VIS unifamiliar',
    'VIS multifamiliar'
  ];

  /* ── §2 · LAS DOS OPERACIONES, Y POR QUÉ LA SEGUNDA ESTÁ DECLARADA Y NO
          ABIERTA ──────────────────────────────────────────────────────────
     Daniel decidió venta primero y arriendo después, con el MISMO modelo. Así
     que el arriendo no se omite: se declara, con sus dos campos propios y con
     la razón de que no esté abierto. Omitirlo dejaría su rama sin escribir, y
     escribirla el día que haga falta es cuando se inventa un modelo distinto;
     declararla ahora y medirla con un caso fabricado (v970) es lo que hace
     que «el mismo modelo» sea comprobable y no una promesa. */
  var OPERACIONES = {
    venta: {
      titulo: 'Venta',
      abierta: true,
      razon: ''
    },
    arriendo: {
      titulo: 'Arriendo',
      abierta: false,
      razon: 'Daniel decidió el 23 de octubre de 2026 publicar primero la venta. ' +
             'El modelo del arriendo es este mismo más administración y depósito, ' +
             'y está escrito y medido; lo que falta es su decisión de abrirlo.'
    }
  };

  /* ── §3 · LOS ESTADOS · NADA SE BORRA ────────────────────────────────────
     Es la regla que el módulo presidencial ya aplica y que vale igual acá:
     borrar es esconder. Una vivienda que se vendió BAJA de estado y conserva
     su análisis, que es lo que permite decir después «se vendió en N días»;
     borrarla deja el registro contando solo lo que todavía no se vende. */
  var ESTADOS = {
    borrador: { titulo: 'Borrador',  publica: false, texto: 'Escrita y todavía no publicada.' },
    visible:  { titulo: 'Publicada', publica: true,  texto: 'Se ve en el mapa y en el listado.' },
    pausada:  { titulo: 'Pausada',   publica: false, texto: 'Se retiró de la vista sin perder su historia.' },
    cerrada:  { titulo: 'Cerrada',   publica: false, texto: 'Se vendió o se arrendó. No se borra: baja de estado.' }
  };

  /* ── §4 · LA PRECISIÓN DEL PUNTO, QUE ES LA DIRECCIÓN ────────────────────
     Daniel decidió: dirección pública APROXIMADA (cuadra o barrio), exacta
     solo después del contacto. Medido al escribir el esquema: **el punto del
     mapa ES la dirección**. Publicar `lat`/`lng` con seis decimales —once
     centímetros, que es lo que guarda `guardarTrazo` en js/68— entrega la
     puerta de la casa aunque el texto diga «barrio Caobos». Declarar la mitad
     de la reserva y callar la otra es peor que no declarar ninguna, que es
     exactamente el fallo de la v867 en otro sitio.

     Así que el campo es EXIGIDO y no tiene valor por omisión: una vivienda sin
     `precisionPunto` declarada no pasa `validar`, y por lo tanto no publica.
     Elegir yo un redondeo por defecto sería resolver solo una decisión de
     producto —y de datos personales—, que es la regla 8. Los dos valores
     están escritos y medidos; cuál se usa lo dice Daniel. */
  var PRECISION = {
    manzana: {
      titulo: 'Aproximado a la manzana',
      decimales: 3,
      metrosAprox: 110,
      texto: 'El punto está redondeado: ubica la cuadra, no la puerta.'
    },
    exacto: {
      titulo: 'Exacto',
      decimales: 6,
      metrosAprox: 0,
      texto: 'El punto es la puerta del inmueble.'
    }
  };

  /* ── §5 · EL ESQUEMA ─────────────────────────────────────────────────────
     Declarativo a propósito: `validar`, `nueva` y `paraPublicar` lo RECORREN
     en vez de nombrar campos uno por uno. Es la forma de la v1149 —se recoge
     por FORMA y nunca por nombre de clave—, que en este repositorio ya se
     pagó cinco veces: una función que nombra los campos que existían el día
     que se escribió deja fuera el que se agregue mañana, y entonces un campo
     nuevo nace sin exigencia y sin reserva, publicándose por omisión.

       c        la clave
       q        qué clase de cosa es: 'texto', 'opcion', 'coord' o 'cifra'
       unidad   solo las cifras, y es lo que se imprime al lado del número
       exigido  sin él, `validar` no pasa
       publico  si sale en `paraPublicar`. Falla CERRADO: lo que no lo declare
                NO se publica (v880), que es el lado correcto del error cuando
                lo que está en juego es la dirección de una casa
       soloSi   la operación en la que el campo aplica; vacío = las dos */
  var CAMPOS = [
    { c: 'id',               q: 'texto',  exigido: true,  publico: true },
    { c: 'operacion',        q: 'opcion', exigido: true,  publico: true,  opciones: Object.keys(OPERACIONES) },
    { c: 'estado',           q: 'opcion', exigido: true,  publico: false, opciones: Object.keys(ESTADOS) },
    { c: 'tipo',             q: 'opcion', exigido: true,  publico: true,  opciones: TIPOS },
    { c: 'duenio',           q: 'texto',  exigido: false, publico: false },
    { c: 'precisionPunto',   q: 'opcion', exigido: true,  publico: true,  opciones: Object.keys(PRECISION) },
    /* Las coordenadas NO son públicas por sí mismas: lo que se publica es el
       punto que sale de `puntoPublico`, ya redondeado según la precisión
       declarada. Marcarlas `publico: true` acá sería publicar la puerta. */
    { c: 'lat',              q: 'coord',  exigido: true,  publico: false },
    { c: 'lng',              q: 'coord',  exigido: true,  publico: false },
    { c: 'direccionPublica', q: 'texto',  exigido: true,  publico: true },
    { c: 'direccionExacta',  q: 'texto',  exigido: false, publico: false },
    { c: 'areaConstruida',   q: 'cifra',  exigido: true,  publico: true,  unidad: 'm² construidos' },
    { c: 'areaLote',         q: 'cifra',  exigido: false, publico: true,  unidad: 'm² de lote' },
    { c: 'habitaciones',     q: 'cifra',  exigido: true,  publico: true,  unidad: 'habitaciones' },
    { c: 'banos',            q: 'cifra',  exigido: true,  publico: true,  unidad: 'baños' },
    { c: 'parqueaderos',     q: 'cifra',  exigido: true,  publico: true,  unidad: 'parqueaderos' },
    { c: 'piso',             q: 'cifra',  exigido: false, publico: true,  unidad: 'piso' },
    { c: 'estrato',          q: 'cifra',  exigido: false, publico: true,  unidad: 'estrato' },
    { c: 'precio',           q: 'cifra',  exigido: true,  publico: true,  unidad: 'COP' },
    { c: 'administracion',   q: 'cifra',  exigido: false, publico: true,  unidad: 'COP al mes', soloSi: 'arriendo' },
    { c: 'deposito',         q: 'cifra',  exigido: false, publico: true,  unidad: 'COP',        soloSi: 'arriendo' }
  ];

  /* ── §6 · LO QUE UNA FORTALEZA PUEDE CITAR ───────────────────────────────
     El catálogo de claves del análisis de ubicación. Cada una declara el
     archivo y el ANCLA literal que tiene que existir en él, y `revisar.js`
     comprueba las dos cosas. Eso es lo que impide inventar una fuente (regla
     7 de Daniel): una clave cuyo ancla no esté en `js/68` pone la guarda en
     rojo, así que no se puede escribir una fortaleza apoyada en un análisis
     que el sistema no produce.

     Lo que el catálogo NO promete, y va dicho al lado (v945): que ESTA
     vivienda traiga ese dato. Eso se mide contra su ficha, y la ficha llega
     en el peldaño siguiente. */
  var CLAVES_ANALISIS = {
    equipamientos:  { que: 'Cobertura de equipamientos del sector',
                      archivo: 'js/68-procity-reconocimiento.js', ancla: 'Cobertura de equipamientos' },
    usos:           { que: 'Densidad de usos del sector contra la ciudad',
                      archivo: 'js/68-procity-reconocimiento.js', ancla: 'Densidad de usos' },
    espacioPublico: { que: 'Espacio público efectivo',
                      archivo: 'js/68-procity-reconocimiento.js', ancla: 'Espacio público efectivo' },
    estrato:        { que: 'Estrato predominante por manzana',
                      archivo: 'js/68-procity-reconocimiento.js', ancla: 'Estrato predominante' },
    demografia:     { que: 'Quién vive en el sector, del censo por manzana',
                      archivo: 'js/68-procity-reconocimiento.js', ancla: 'Quién vive acá' },
    sol:            { que: 'Horas de sol al año y orientación',
                      archivo: 'js/68-procity-reconocimiento.js', ancla: 'Horas de sol al año' },
    anden:          { que: 'Andén y perfil de la vía',
                      archivo: 'js/68-procity-reconocimiento.js', ancla: 'Andenes' },
    amenazaSismica: { que: 'Amenaza sísmica del sitio',
                      archivo: 'js/68-procity-reconocimiento.js', ancla: 'Amenaza sísmica' }
  };

  /* ── §7 · LAS FUNCIONES ─────────────────────────────────────────────────── */

  function esCifra(x) { return typeof x === 'number' && isFinite(x); }

  /* Normaliza una cifra a `{v, origen}`. Un número pelado se toma como
     DECLARADO —lo escribió quien carga la vivienda—; ausente es SIN MEDIR, y
     las dos cosas tienen que poder distinguirse después. */
  function cifraDe(x) {
    if (x === null || x === undefined || x === '') return { v: null, origen: null };
    if (esCifra(x)) return { v: x, origen: 'declarado' };
    if (typeof x === 'object' && 'v' in x) {
      return { v: esCifra(x.v) ? x.v : null, origen: esCifra(x.v) ? (x.origen || 'declarado') : null };
    }
    var n = Number(x);
    return esCifra(n) ? { v: n, origen: 'declarado' } : { v: null, origen: null };
  }

  /* LAS DOS REDACCIONES, escritas las dos (v970). La de «SIN MEDIR» es la que
     hace falta hoy; la de N es la que hace falta el día que el dato llegue, y
     escribirlas juntas es lo que impide que la segunda se improvise. */
  function texto(clave, valor) {
    var campo = null, i;
    for (i = 0; i < CAMPOS.length; i++) if (CAMPOS[i].c === clave) campo = CAMPOS[i];
    if (!campo) return 'SIN MEDIR';
    if (campo.q !== 'cifra') return valor === null || valor === undefined || valor === '' ? 'SIN MEDIR' : String(valor);
    var c = cifraDe(valor);
    if (c.v === null) return 'SIN MEDIR';
    return c.v + ' ' + (campo.unidad || '');
  }

  function nueva(crudo) {
    var o = crudo || {}, viv = {}, i, campo;
    for (i = 0; i < CAMPOS.length; i++) {
      campo = CAMPOS[i];
      if (campo.q === 'cifra')      viv[campo.c] = cifraDe(o[campo.c]);
      else if (campo.q === 'coord') viv[campo.c] = esCifra(o[campo.c]) ? o[campo.c] : null;
      else                          viv[campo.c] = o[campo.c] === undefined || o[campo.c] === null ? '' : String(o[campo.c]);
    }
    viv.fortalezas = Array.isArray(o.fortalezas) ? o.fortalezas.slice() : [];
    /* El PUNTERO al análisis, no una copia de él. Es la separación que la
       v871 ya hizo entre el trazo y la ficha, y por la misma razón: una
       vivienda tiene MUCHOS análisis a lo largo del tiempo, y el sector
       cambia. Copiarlo adentro sería la clase B comprada de antemano. */
    viv.analisis = o.analisis ? {
      fichaId: String(o.analisis.fichaId || ''),
      ts:      String(o.analisis.ts || ''),
      radioM:  esCifra(o.analisis.radioM) ? o.analisis.radioM : null,
      metodo:  String(o.analisis.metodo || ''),
      avisos:  Array.isArray(o.analisis.avisos) ? o.analisis.avisos.slice() : []
    } : null;
    return viv;
  }

  /* `faltan` y `errores` van APARTE porque piden acciones distintas (v899):
     lo que falta se consigue, lo que está mal se corrige. Juntarlos manda a
     buscar un dato cuando lo que hay es un valor fuera de lista. */
  function validar(viv) {
    var faltan = [], errores = [], i, campo, val, op;
    if (!viv) return { ok: false, faltan: ['la vivienda entera'], errores: [] };

    op = viv.operacion || '';
    for (i = 0; i < CAMPOS.length; i++) {
      campo = CAMPOS[i];
      val = viv[campo.c];
      if (campo.soloSi && campo.soloSi !== op) {
        var puesto = campo.q === 'cifra' ? (val && val.v !== null && val.v !== undefined) : !!val;
        if (puesto) errores.push(campo.c + ' solo aplica en ' + campo.soloSi + ', y esta es de ' + (op || 'operación sin declarar'));
        continue;
      }
      if (campo.q === 'cifra') {
        if (campo.exigido && (!val || val.v === null)) faltan.push(campo.c);
        else if (val && val.v !== null && !esCifra(val.v)) errores.push(campo.c + ' no es un número');
      } else if (campo.q === 'coord') {
        if (campo.exigido && !esCifra(val)) faltan.push(campo.c);
      } else {
        if (campo.exigido && !val) faltan.push(campo.c);
        else if (val && campo.opciones && campo.opciones.indexOf(val) === -1) {
          errores.push(campo.c + ' no está en la lista: «' + val + '»');
        }
      }
    }

    if (op && OPERACIONES[op] && !OPERACIONES[op].abierta) {
      errores.push('la operación «' + op + '» no está abierta todavía. ' + OPERACIONES[op].razon);
    }

    (viv.fortalezas || []).forEach(function (f, n) {
      var r = 'fortaleza ' + (n + 1);
      if (!f || !String(f.texto || '').trim()) { errores.push(r + ' sin texto'); return; }
      var conBase = !!String(f.base || '').trim();
      var conSin  = !!String(f.sinBase || '').trim();
      if (conBase && conSin) errores.push(r + ' declara base y sinBase a la vez: solo una de las dos');
      else if (!conBase && !conSin) errores.push(r + ' no dice de dónde sale: le falta base o sinBase con su razón');
      else if (conBase && !CLAVES_ANALISIS[f.base]) errores.push(r + ' cita «' + f.base + '», que no es una clave del análisis');
      else if (conBase && !viv.analisis) errores.push(r + ' cita el análisis y esta vivienda no tiene ninguno');
    });

    return { ok: faltan.length === 0 && errores.length === 0, faltan: faltan, errores: errores };
  }

  /* El punto que sale a la calle, redondeado según la precisión declarada.
     Se redondea hacia el valor más cercano y se devuelve `null` si falta la
     declaración: sin ella no hay forma de saber cuánto se puede decir. */
  function puntoPublico(viv) {
    var p = PRECISION[viv && viv.precisionPunto];
    if (!p || !esCifra(viv.lat) || !esCifra(viv.lng)) return null;
    var f = Math.pow(10, p.decimales);
    return {
      lat: Math.round(viv.lat * f) / f,
      lng: Math.round(viv.lng * f) / f,
      precision: viv.precisionPunto,
      texto: p.texto
    };
  }

  /* LA PROCEDENCIA, SIEMPRE (v867). Las dos redacciones escritas: la de la
     vivienda con análisis y la de la que no lo tiene. La segunda es la que
     hace falta hoy —ninguna vivienda tiene análisis todavía— y la primera es
     la que hace falta el día que lo tenga. Que la arme esta función y no cada
     pantalla es lo único que impide que una superficie nueva se publique
     muda: su autor no tiene que acordarse. */
  function procedencia(viv) {
    var a = viv && viv.analisis;
    if (!a || !a.fichaId) {
      return {
        hay: false,
        texto: 'Esta vivienda todavía no trae análisis de ubicación. Lo que se dice de su ' +
               'entorno sale de lo que escribió quien la cargó, no de una medición de URBIS.',
        avisos: []
      };
    }
    return {
      hay: true,
      texto: 'El análisis de ubicación se corrió el ' + (a.ts || 'SIN MEDIR') +
             ' sobre un radio de ' + (a.radioM === null ? 'SIN MEDIR' : a.radioM + ' m') +
             ', con el método ' + (a.metodo || 'SIN MEDIR') + '. El sector cambia: ' +
             'esta lectura es de esa fecha y no de hoy.',
      avisos: a.avisos.slice()
    };
  }

  /* Lo que sale a la calle. Falla CERRADO en las dos direcciones: no publica
     una vivienda que no valida, y de la que sí valida solo emite los campos
     declarados `publico`. Así un campo nuevo —una escritura, un teléfono, el
     nombre del vendedor— nace reservado y hay que decidir publicarlo, en vez
     de aparecer en la calle porque nadie se acordó de taparlo. */
  function paraPublicar(viv) {
    var v = validar(viv);
    if (!v.ok) return { ok: false, faltan: v.faltan, errores: v.errores };
    var fuera = {}, i, campo;
    for (i = 0; i < CAMPOS.length; i++) {
      campo = CAMPOS[i];
      if (!campo.publico) continue;
      if (campo.soloSi && campo.soloSi !== viv.operacion) continue;
      fuera[campo.c] = campo.q === 'cifra'
        ? { v: viv[campo.c].v, origen: viv[campo.c].origen, texto: texto(campo.c, viv[campo.c]) }
        : viv[campo.c];
    }
    fuera.punto = puntoPublico(viv);
    fuera.fortalezas = (viv.fortalezas || []).map(function (f) {
      return {
        texto: f.texto,
        base: f.base || '',
        queEs: f.base && CLAVES_ANALISIS[f.base] ? CLAVES_ANALISIS[f.base].que : '',
        sinBase: f.sinBase || ''
      };
    });
    fuera.procedencia = procedencia(viv);
    return { ok: true, vivienda: fuera };
  }

  /* El estado del módulo dentro del registro compartido (js/03h). Se CALCULA
     mirando el registro —nunca se escribe a mano (v903)— y recibe el registro
     por PARÁMETRO para que se pueda medir contra un caso fabricado (v970):
     contra el registro de verdad solo se mediría la rama de hoy. */
  function estadoDelRegistro(registro) {
    var reg = registro || (typeof window !== 'undefined' && window.URBIS_MODULOS) || null;
    if (!reg) {
      return { registrado: false, causa: 'sin-registro',
               texto: 'El registro de módulos no está cargado, así que no se puede saber si ' +
                      '«' + MODULO_ID + '» tiene entrada. No es lo mismo que no tenerla.' };
    }
    if (reg[MODULO_ID]) {
      return { registrado: true, causa: '',
               texto: 'El módulo «' + MODULO_ID + '» tiene su entrada en el registro de la capa ' +
                      'de mapeos, así que sus tipos tienen dueño declarado.' };
    }
    return { registrado: false, causa: 'pedida-y-no-concedida',
             texto: 'El módulo «' + MODULO_ID + '» todavía NO tiene entrada en el registro de la ' +
                    'capa de mapeos. Está pedida a la cabeza en herramientas/modulos/viviendas.md, ' +
                    'y hasta que esté, este módulo no escribe un solo punto.' };
  }

  /* ── §8 · EL ADAPTADOR DEL ALMACÉN ───────────────────────────────────────
     La ÚNICA parte de este archivo que sabe dónde se guarda una vivienda.
     Está acá abajo, separada y con nombre, para que el día que el almacén
     pase a Postgres se reemplace esta sección y nada más — que es lo que
     Daniel pidió al decir que el modelo no puede depender del almacén.

     `aFila`/`desdeFila` son el par, y la prueba los corre en redondo: una
     vivienda que va y vuelve tiene que ser la misma. Un adaptador que solo se
     mide en una dirección pasa en verde con la mitad rota. */
  var TIPO_FILA = '🏘️ Vivienda URBIS';
  var TIPO_FILA_FOTO = '🏘️ Foto de vivienda URBIS';
  var PREFIJO = 'VIVIENDA_URBIS:';

  var ALMACEN_VITRINA = {
    tipo: TIPO_FILA,
    tipoFoto: TIPO_FILA_FOTO,
    prefijo: PREFIJO,
    aFila: function (viv) {
      return {
        tipo: TIPO_FILA,
        lat: String(esCifra(viv.lat) ? viv.lat : ''),
        lng: String(esCifra(viv.lng) ? viv.lng : ''),
        descripcion: PREFIJO + JSON.stringify(viv)
      };
    },
    desdeFila: function (fila) {
      var d = String((fila && fila.descripcion) || '');
      if (d.indexOf(PREFIJO) !== 0) return null;
      try { return nueva(JSON.parse(d.slice(PREFIJO.length))); } catch (e) { return null; }
    }
  };

  window.URBIS_VIVIENDAS = {
    MODULO_ID: MODULO_ID,
    TIPOS: TIPOS,
    OPERACIONES: OPERACIONES,
    ESTADOS: ESTADOS,
    PRECISION: PRECISION,
    CAMPOS: CAMPOS,
    CLAVES_ANALISIS: CLAVES_ANALISIS,
    nueva: nueva,
    validar: validar,
    texto: texto,
    puntoPublico: puntoPublico,
    procedencia: procedencia,
    paraPublicar: paraPublicar,
    estadoDelRegistro: estadoDelRegistro,
    ALMACEN_VITRINA: ALMACEN_VITRINA
  };
})();
