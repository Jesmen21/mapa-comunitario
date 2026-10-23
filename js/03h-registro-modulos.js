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
      archivos: ['js/09-events.js', 'js/12-spa-ui.js', 'js/20-mobile-functional-app.js'],
      tipos: ['🎪 Eventos Comunitarios'],
      prefijos: [],
      comparte: ['categoria', 'cuando', 'termina'],
      privado: [],
      nota: ''
    },

    vitrina: {
      titulo: 'Vitrina de emprendimientos',
      archivos: ['js/13i-vitrina.js'],
      tipos: ['🛍️ Emprendimiento URBIS', '🛍️ Portafolio URBIS', '🛍️ Logo URBIS'],
      prefijos: [],
      comparte: ['nombreNegocio', 'rubro'],
      privado: ['contactoPrivado'],
      nota: 'la vitrina exige firma para escribirse: sin token, cualquiera podría ' +
            'inventarse un emprendimiento «verificado por URBIS».'
    },

    premio: {
      titulo: 'Premio URBIS',
      archivos: ['js/13j-premio.js'],
      tipos: ['🏆 Premio URBIS'],
      prefijos: [],
      comparte: ['categoria'],
      privado: [],
      nota: ''
    },

    peticiones: {
      titulo: 'Buzón de peticiones',
      archivos: ['js/13g-config-admin.js'],
      tipos: ['📩 Petición URBIS'],
      prefijos: [],
      comparte: [],
      privado: ['texto', 'quienPide'],
      nota: 'el buzón va tapado en la respuesta del servidor salvo para quien lo abre: ' +
            'por eso no comparte nada.'
    },

    social: {
      titulo: 'Comentarios, relaciones y permisos',
      archivos: ['js/12-spa-ui.js'],
      tipos: ['💬 Comentario', '🤝 Relacion', '🔑 Permiso'],
      prefijos: [],
      comparte: ['autor', 'texto'],
      privado: ['permiso'],
      nota: 'estas filas NO son puntos del mapa: usan lat/lng como casillas de otra ' +
            'cosa (0, o la fila a la que responden). Quien cuente puntos tiene que ' +
            'descartarlas, y decir que las descartó.'
    },

    rush: {
      titulo: 'Social Rush',
      archivos: ['js/20-mobile-functional-app.js'],
      tipos: ['🏃 Social Rush'],
      prefijos: [],
      comparte: [],
      privado: [],
      nota: ''
    },

    presencia: {
      titulo: 'Presencia en el mapa',
      archivos: ['js/78-presencia.js'],
      tipos: [],
      prefijos: ['ubicacion_'],
      comparte: [],
      privado: ['ubicacionExacta'],
      nota: 'una fila por persona, actualizada por tipo. Tampoco es un punto reportado.'
    },

    curso: {
      titulo: 'Curso: entregas y comentarios',
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
