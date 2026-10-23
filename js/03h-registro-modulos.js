/* EL REGISTRO DE MÓDULOS DE LA CAPA DE MAPEOS (v1162)
   ===================================================

   La capa es UNA SOLA y ya lo era: todos los módulos escriben por
   `urbisGuardarFila` (js/12) y leen por `urbisDBRead`. Lo que faltaba no era
   la capa: era saber QUIÉN es dueño de qué dentro de ella.

   Hoy cada módulo se reparte el campo `descripcion` por POSICIÓN, con la
   tabla `URBIS_SLOTS` de js/04. Esa tabla ya se cobró datos una vez —tres
   funciones contaron «la primera casilla libre» y llegaron al mismo número,
   y un punto de Pro City publicado dentro de una carpeta borraba la
   materialidad del edificio—. Es la clase B del CLAUDE.md: dos módulos
   codificando cosas distintas en el mismo sitio, que coinciden el día que se
   escriben y se separan el siguiente.

   Este archivo NO migra nada. Lo viejo se queda en sus casillas, que es lo
   que hay que hacer: hay datos guardados en ellas y las posiciones no se
   pueden reordenar. Lo que hace es:

     1. declarar qué TIPOS son de cada módulo, para que dos no se los
        disputen;
     2. abrir UN espacio con NOMBRE por módulo —la última casilla posicional
        que se abre en este proyecto—, para que un campo nuevo no vuelva a
        nacer como una posición que alguien tiene que contar;
     3. declarar qué campos de un módulo pueden LEER los demás y cuáles no.

   Las tres cosas las vigila `pruebas/revisar.js`, en el bloque «La capa de
   mapeos: un dueño por tipo, y el espacio con nombre».

   LO QUE ESTE ARCHIVO NO HACE, dicho acá y no en una nota aparte (v945):
   no sabe si un punto está repetido —eso se mide con
   `herramientas/medir-duplicados.html`, que lee la hoja de verdad—, no
   impide que un módulo ESCRIBA en el espacio de otro (eso lo decide el
   servidor, no el navegador) y no conoce al módulo nuevo, que todavía no
   tiene nombre ni tipos: hasta que los tenga, no está acá, porque un módulo
   registrado sin tipos sería una fila vacía que se lee como un módulo sin
   nada que mapear. */
(function () {
  'use strict';

  /* UN TIPO, UN DUEÑO.
     `tipos` son valores exactos del campo `tipo` de la fila. `prefijos` son
     para los módulos que lo fabrican por fila —la presencia escribe
     «ubicacion_<usuario>» y el curso «comentario de curso …»—: sin esta
     forma, su dueño no se podría declarar y quedarían fuera del registro,
     que es como una guarda se queda sin ver justo lo que cambia (v1149). */
  var MODULOS = {

    reportes: {
      titulo: 'Reportes y Matriz de Usos',
      backend: 'hoja',
      archivos: ['js/11-report-form.js', 'js/12-spa-ui.js', 'js/20-mobile-functional-app.js',
                 'js/06-mobility-traffic.js', 'js/50-alerta-forzado.js'],
      tipos: [
        '🚨 Alertas y Riesgos Urbanos', '🚗 Reportes de Tráfico',
        '🛡️ Seguridad Nacional y Conflicto', '🌪️ Desastres Naturales y Clima',
        '⛰️ Riesgos del Terreno', '🗺️ Matriz de Usos',
        'Vivienda y Residencial', 'Comercio y Servicios', 'Grandes Equipamientos',
        'Áreas Deportivas', 'Áreas Verdes y Ambiental', 'Infraestructura y Peatonal',
        'Servicios Ocultos', 'Salud y Emergencias', 'Patrimonio y Turismo',
        'Industria y Logística', 'Animal y Bienestar', 'Infraestructura Smart',
        'Oficinas y Co-working'
      ],
      prefijos: [],
      /* Lo que cualquier módulo puede leer de un reporte. Es casi todo: un
         reporte ciudadano existe para que lo lean. */
      comparte: ['categoria', 'subtipo', 'edificio', 'estadoUrbano', 'autor', 'fecha'],
      privado: ['moderacion', 'cedulaAutor', 'correoAutor'],
      nota: 'js/06 anexa el AutoMapeo a estas mismas categorías y js/50 fuerza una ' +
            'alerta de clima: escriben DENTRO de este módulo, no en uno propio.'
    },

    eventos: {
      titulo: 'Eventos comunitarios',
      backend: 'hoja',
      archivos: ['js/09-events.js', 'js/12-spa-ui.js', 'js/20-mobile-functional-app.js'],
      tipos: ['🎪 Eventos Comunitarios'],
      prefijos: [],
      comparte: ['categoria', 'cuando', 'termina'],
      privado: [],
      nota: ''
    },

    vitrina: {
      titulo: 'Vitrina de emprendimientos',
      backend: 'hoja',
      archivos: ['js/13i-vitrina.js'],
      tipos: ['🛍️ Emprendimiento URBIS', '🛍️ Portafolio URBIS', '🛍️ Logo URBIS'],
      prefijos: [],
      comparte: ['nombreNegocio', 'rubro'],
      privado: ['contactoPrivado'],
      nota: 'la vitrina exige firma para escribirse: sin token, cualquiera podría ' +
            'inventarse un emprendimiento «verificado por URBIS».'
    },

    peticiones: {
      titulo: 'Buzón de peticiones',
      backend: 'hoja',
      archivos: ['js/13g-config-admin.js'],
      tipos: ['📩 Petición URBIS'],
      prefijos: [],
      comparte: [],
      privado: ['texto', 'quienPide'],
      nota: 'el buzón va tapado en la respuesta del servidor salvo para quien lo abre: ' +
            'por eso no comparte nada.'
    },

    /* SE LLAMABA `social` Y SE RENOMBRÓ EL 23 DE OCTUBRE DE 2026, y la razón
       vale más que el caso: Daniel decidió que «Social» es el PARAGUAS de
       producto —runner, minijuegos, Patitas URBIS y orientación comunal—, y
       este módulo es otra cosa: la infraestructura de comentarios, relaciones
       y permisos de js/12. Dos cosas distintas con un solo nombre es la clase
       B entrando por la puerta del vocabulario, y el día que alguien leyera
       «social» en el registro no sabría cuál de las dos es.
       Se renombra AHORA porque hoy no cuesta nada: el espacio con nombre se
       abrió en la v1162 y todavía no tiene un solo lector, así que ningún dato
       guardado depende de este id. Mañana sí costaría. */
    interaccion: {
      titulo: 'Comentarios, relaciones y permisos',
      backend: 'hoja',
      archivos: ['js/12-spa-ui.js'],
      tipos: ['💬 Comentario', '🤝 Relacion', '🔑 Permiso'],
      prefijos: [],
      comparte: ['autor', 'texto'],
      privado: ['permiso'],
      nota: 'estas filas NO son puntos del mapa: usan lat/lng como casillas de otra ' +
            'cosa (0, o la fila a la que responden). Quien cuente puntos tiene que ' +
            'descartarlas, y decir que las descartó.'
    },

    /* EL PARAGUAS, por decisión de Daniel del 23 de octubre de 2026: el
       runner, los minijuegos, Patitas URBIS y la orientación comunal NO son
       módulos separados. Por eso `rush` y `premio`, que estaban aparte, son
       una sola entrada: tres entradas para un módulo son tres dueños donde
       hay uno. */
    social: {
      titulo: 'Social · runner, minijuegos, Patitas URBIS y orientación comunal',
      backend: 'hoja',
      archivos: ['js/20-mobile-functional-app.js', 'js/13j-premio.js',
                 'js/16-achievements.js', 'js/17-sport.js'],
      tipos: ['🏃 Social Rush', '🏆 Premio URBIS'],
      prefijos: [],
      comparte: ['categoria'],
      privado: [],
      nota: 'paraguas, no cuatro módulos. Patitas URBIS y la orientación comunal ' +
            'todavía no escriben tipos propios; cuando los tengan entran acá y no ' +
            'en una entrada nueva.'
    },

    presencia: {
      titulo: 'Presencia en el mapa',
      backend: 'hoja',
      archivos: ['js/78-presencia.js'],
      tipos: [],
      prefijos: ['ubicacion_'],
      comparte: [],
      privado: ['ubicacionExacta'],
      nota: 'una fila por persona, actualizada por tipo. Tampoco es un punto reportado.'
    },

    curso: {
      titulo: 'Curso: entregas y comentarios',
      backend: 'hoja',
      archivos: ['js/81-curso-servidor.js'],
      tipos: [],
      prefijos: ['comentario de curso '],
      comparte: [],
      privado: ['entrega', 'nota'],
      nota: ''
    },

    /* EL EDUCATIVO TODAVÍA NO ESCRIBE EN ESTA CAPA, y eso va dicho acá y no
       callado: sus fichas viven en `pcr_fichas_v1`, en el teléfono. Lo que
       declara este renglón es a qué se compromete el día que escriba, que es
       la decisión que el usuario tomó el 23 de octubre de 2026. Declararlo
       antes de tener material es lo correcto —la regla se escribe antes de
       correrla (v1077)—, y la guarda de lectura que lo vigila sale con `?`
       mientras no haya una sola fila suya, no en verde: verde sobre cero
       filas diría que comprobó algo que no existe. */
    educativo: {
      titulo: 'Pliego educativo (todavía no escribe en la capa)',
      backend: 'local',
      archivos: ['js/68-procity-reconocimiento.js', 'js/64-analisis-edu.js', 'js/65-analisis-edu-ui.js'],
      tipos: [],
      prefijos: [],
      escribeEnLaCapa: false,
      /* MEDIDO EN CAMPO: lo comparte con todos los módulos. Es el dato que
         alguien levantó con cinta y con reloj, y volver a levantarlo en otro
         módulo sería pedirle a la gente que mida dos veces lo mismo. */
      comparte: ['alturaPorManzana', 'perfilVial', 'anden',
                 'rutasYFrecuencia', 'equipamientos', 'actividadPrimerPiso'],
      /* NINGÚN OTRO MÓDULO LO LEE. No por celo: una geometría de intención de
         diseño es una PROPUESTA y no un hecho del territorio, y un panel de
         percepción es lo que alguien sintió. Leídos desde otro módulo se
         verían como lo mapeado, que es exactamente la confusión que esta
         separación existe para evitar. */
      privado: ['geometriaIntencionDiseno', 'panelPercepcion',
                'datoNoConfirmado', 'borrador'],
      nota: 'sus fichas viven hoy en pcr_fichas_v1 (localStorage). Este renglón ' +
            'declara el reparto para cuando escriba, no un reparto vigente.'
    },

    /* ------------------------------------------------------------------
       LOS QUE NO ESCRIBEN EN LA HOJA (decisión de Daniel, 23 oct 2026)
       ------------------------------------------------------------------
       «Sheets no se extiende a nada nuevo.» Eso parte el reparto en dos y
       conviene decirlo entero, porque si no la frase «una sola capa» deja de
       ser cierta sin que nadie lo note: la HOJA se queda con lo que ya está
       —congelada para datos nuevos— y lo nuevo va a Postgres. **Lo
       compartido no es el almacén: es ESTE REGISTRO**, que declara quién es
       dueño de qué y quién puede leerlo, viva el dato donde viva. Un módulo
       nuevo con `backend: 'hoja'` sale en rojo. */

    empresas: {
      titulo: 'Empresas · análisis comercial',
      backend: 'motor',
      archivos: ['analisis-ia.html', 'js/59-analisis-ia-catalogo.js',
                 'js/61-analisis-ia-datos.js', 'js/62-analisis-ia-app.js',
                 'js/63-analisis-ia-informe.js', 'js/66-analisis-remoto.js',
                 'js/67-analisis-cliente.js', 'js/69-licencia.js'],
      tipos: [],
      prefijos: [],
      /* Lo que Viviendas lee de acá por decisión de Daniel: el análisis de
         ubicación, SIN copiarlo. Se declara compartido para que exista una
         puerta; copiar el cálculo sería la clase B con dos dueños. */
      comparte: ['analisisUbicacion', 'densidadDeUsos', 'coberturaEquipamientos'],
      privado: ['reglasDeClasificacion', 'pesosDelMotor'],
      nota: 'las reglas de clasificación NO se sirven al navegador: eso es lo que se ' +
            'vende, y por eso van en privado y además viven en el repositorio del motor. ' +
            'js/61 es suyo y el educativo lo llama 28 veces (medido el 23 oct 2026).'
    },

    viviendas: {
      titulo: 'Viviendas · venta y arriendo',
      backend: 'postgres',
      archivos: [],
      tipos: [],
      prefijos: [],
      leeDe: [{ modulo: 'empresas', campo: 'analisisUbicacion' }],
      /* La dirección EXACTA es privada por decisión de Daniel: en público va
         la cuadra o el barrio, y la exacta solo para él o tras contacto con el
         interesado. Son DOS campos y no uno con una bandera: un campo con
         bandera se publica entero el día que alguien lee mal la bandera. */
      comparte: ['ubicacionAproximada', 'tipoInmueble', 'precio'],
      privado: ['direccionExacta', 'contactoPropietario'],
      nota: 'módulo propio, en Postgres. Todavía no tiene archivos: la entrada existe ' +
            'para que su reparto esté declarado ANTES de escribir la primera línea.'
    },

    politico: {
      titulo: 'Político · control de votos',
      backend: 'postgres',
      archivos: [],
      tipos: [],
      prefijos: [],
      comparte: [],
      /* La v1 va SIN datos reales de votantes, por decisión de Daniel: solo
         simulados y rotulados SIMULADO. Guardar datos personales reales es
         una decisión aparte que todavía no se tomó, así que el campo ni
         siquiera se declara compartible. */
      privado: ['votante', 'datoSimulado'],
      soloSimulado: true,
      nota: 'v1 sin datos reales de votantes. Todo dato va rotulado SIMULADO; guardar ' +
            'datos personales reales no se construye hasta que Daniel lo decida.'
    },

    seguridad: {
      titulo: 'Seguridad familiar',
      backend: 'postgres',
      archivos: [],
      /* CERO TIPOS PROPIOS, por decisión de Daniel: la matriz de tipos y el
         flujo de reporte son de Reportes/Eventos. Seguridad los MUESTRA y los
         analiza. Un tipo duplicado acá sería dos dueños para un hecho, que es
         justo lo que la guarda rechaza — y el registro lo deja escrito en vez
         de confiar en que alguien se acuerde. */
      tipos: [],
      prefijos: [],
      leeDe: [{ modulo: 'reportes', campo: 'categoria' },
              { modulo: 'reportes', campo: 'subtipo' }],
      comparte: [],
      privado: [],
      nota: 'no crea tipos: lee los de reportes. Y la v1 es solo mapa y reportes — no ' +
            'hay botón de pánico hasta que exista convenio real con la Policía o el 123, ' +
            'porque un botón que promete respuesta y no la tiene es peor que no tenerlo.'
    }
  };

  /* EL ESPACIO CON NOMBRE.
     Una sola casilla posicional más —la última que se abre— donde cada módulo
     guarda sus campos por NOMBRE: `modulo:campo=valor;modulo:campo=valor`.
     Clave y valor van codificados, así que ningún contenido puede inventar un
     separador ni colarse en ` | ` o en `~~~`.

     Por qué una casilla y no muchas: una casilla nueva por campo es
     exactamente el mecanismo que ya se pisó los datos. Por qué con nombre y
     no por posición: un campo nuevo no obliga a nadie a contar. */
  var SEP_CAMPO = ';';
  var SEP_VALOR = '=';

  function clave(modulo, campo) {
    return encodeURIComponent(String(modulo)) + ':' + encodeURIComponent(String(campo));
  }

  function leerEspacio(texto) {
    var out = {};
    String(texto || '').split(SEP_CAMPO).forEach(function (par) {
      if (!par) return;
      var i = par.indexOf(SEP_VALOR);
      if (i < 0) return;
      out[par.slice(0, i)] = decodeURIComponent(par.slice(i + 1));
    });
    return out;
  }

  function escribirEspacio(obj) {
    return Object.keys(obj).map(function (k) {
      return k + SEP_VALOR + encodeURIComponent(String(obj[k]));
    }).join(SEP_CAMPO);
  }

  window.URBIS_MODULOS = MODULOS;

  window.URBIS_CAMPOS = {
    /* Lee un campo con nombre del texto de la casilla. Devuelve '' y nunca
       undefined: un campo que no está y un campo vacío piden lo mismo del
       lector, y distinguirlos acá obligaría a cada llamador a tratar dos
       casos que no sabe separar. */
    leer: function (textoCasilla, modulo, campo) {
      var v = leerEspacio(textoCasilla)[clave(modulo, campo)];
      return v === undefined ? '' : v;
    },
    escribir: function (textoCasilla, modulo, campo, valor) {
      var o = leerEspacio(textoCasilla);
      if (valor === '' || valor === null || valor === undefined) delete o[clave(modulo, campo)];
      else o[clave(modulo, campo)] = String(valor);
      return escribirEspacio(o);
    },
    /* Quién es el dueño de un tipo. Devuelve el id del módulo o ''. Mira
       primero los exactos y después los prefijos: un exacto es más
       específico, y al revés «ubicacion_» se tragaría cualquier tipo que
       alguien declarara empezando igual. */
    duenoDe: function (tipo) {
      var t = String(tipo || ''), ids = Object.keys(MODULOS), i, j;
      for (i = 0; i < ids.length; i++) {
        if (MODULOS[ids[i]].tipos.indexOf(t) !== -1) return ids[i];
      }
      for (i = 0; i < ids.length; i++) {
        var p = MODULOS[ids[i]].prefijos || [];
        for (j = 0; j < p.length; j++) if (t.indexOf(p[j]) === 0) return ids[i];
      }
      return '';
    },
    /* ¿Puede `quienLee` leer `campo` de `modulo`? Un módulo siempre puede
       leerse a sí mismo. */
    puedeLeer: function (quienLee, modulo, campo) {
      if (quienLee === modulo) return true;
      var m = MODULOS[modulo];
      if (!m) return false;
      return (m.privado || []).indexOf(String(campo)) === -1;
    }
  };
})();
