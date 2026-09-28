/* URBIS · Análisis de Implantación IA — INFORMES (js/63)
   Genera DOS documentos distintos a partir del mismo análisis:

   A) Informe ejecutivo — UNA sola hoja carta (horizontal por defecto), con
      mapa, indicadores, gráficas, viabilidad, FODA y recomendaciones. Es el
      que se le entrega al cliente. Se auto-escala para caber siempre en una
      página, sin importar cuánta información traiga el análisis.

   B) Listado completo de puntos — documento de trabajo (varias páginas),
      con TODOS los usos del radio agrupados por categoría de la Matriz
      URBIS, y una sección aparte con los que quedaron sin clasificar
      (incluyendo sus etiquetas OSM) para poder asignarles categoría.

   El PDF final lo produce el navegador con "Guardar como PDF". */
(function(){
  'use strict';

  function esc(s){ return String(s == null ? '' : s).replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const NOMBRE_ESTUDIO = {
    caracterizacion:'Caracterización Urbana', comercial:'Viabilidad Comercial',
    inmobiliaria:'Viabilidad Inmobiliaria', equipamientos:'Equipamientos', completo:'Estudio Completo'
  };

  // Paleta tomada directamente del logo de URBIS: el celeste de marca
  // (#34CCFE) y el dorado del punto (#FABD0A). Los azules profundos son
  // variantes del mismo celeste, oscurecidas para que el texto blanco y los
  // títulos tengan contraste suficiente al imprimir.
  const CELESTE = '#34CCFE', VERDE = '#075E88', AZUL_MED = '#0E86BE',
        VERDE_CLARO = '#0A6F9E', ORO = '#FABD0A', TINTA = '#12202e', BORDE = '#c7e7f7';

  // ── Estilos del informe (Fase 4) ────────────────────────────────────────
  // Cuatro estilos completos en vez de muchos a medias. Cada uno define TODOS
  // los tokens, así que ninguno hereda un color del otro y no puede quedar
  // texto invisible (el riesgo real al cambiar de fondo claro a oscuro).
  //   cab1/cab2  degradado del encabezado      panel   fondo de cada bloque
  //   acento     títulos de bloque             hoja    fondo de la página
  //   oro        detalles y estrellas          tinta   texto principal
  //   txt2/txt3  texto secundario / apagado    borde   marco de los bloques
  //   linea      filetes de tabla              suave   fondos tenues
  //   ok/warn/bad  niveles (alta/media/baja)
  const ESTILOS = {
    institucional: {
      nombre: 'Institucional', desc: 'Celeste de marca URBIS. El de siempre.',
      cab1: VERDE, cab2: AZUL_MED, acento: VERDE_CLARO, oro: ORO, cabTxt: '#ffffff',
      hoja: '#ffffff', panel: '#ffffff', tinta: TINTA, txt2: '#4a5a6a', txt3: '#627285',
      borde: '#cfe6f5', linea: '#e9f4fb', suave: '#f3fbff', suave2: '#e8f5fd',
      heroA: '#f2fbff', heroB: '#e6f6fe', ok: '#15803d', warn: '#b45309', bad: '#b91c1c', info: '#1d4ed8',
      fodaF: ['#a7e3bd', '#f2fbf5'], fodaD: ['#f6bcbc', '#fef4f4'],
      fodaO: ['#b3d4f7', '#f3f8fe'], fodaR: ['#f7dca6', '#fffaf0'],
      chartTxt: '#2f3f4e', chartTxt2: '#5a6a7a', chartGrid: '#eef2f6', chartFondo: '#ffffff'
    },
    premium: {
      nombre: 'Premium oscuro', desc: 'Fondo profundo y dorado. Para presentar a inversionistas.',
      cab1: '#061722', cab2: '#0d3040', acento: CELESTE, oro: ORO, cabTxt: '#ffffff',
      hoja: '#0b1a24', panel: '#11242f', tinta: '#eaf4fa', txt2: '#b7cbd8', txt3: '#8ba5b5',
      borde: '#1f3d4d', linea: '#1a3340', suave: '#16303d', suave2: '#1a3846',
      heroA: '#123243', heroB: '#0e2735', ok: '#4ade80', warn: '#fbbf24', bad: '#f87171', info: '#60a5fa',
      fodaF: ['#1d5136', '#102a1e'], fodaD: ['#5c2323', '#2a1414'],
      fodaO: ['#1e3f6b', '#122239'], fodaR: ['#5f4415', '#2b2010'],
      chartTxt: '#eaf4fa', chartTxt2: '#b7cbd8', chartGrid: '#1f3d4d', chartFondo: '#11242f'
    },
    minimalista: {
      nombre: 'Minimalista', desc: 'Blanco y negro, sin adornos. Máxima sobriedad.',
      cab1: '#1a1a1a', cab2: '#3a3a3a', acento: '#1a1a1a', oro: '#8a8a8a', cabTxt: '#ffffff',
      hoja: '#ffffff', panel: '#ffffff', tinta: '#161616', txt2: '#4a4a4a', txt3: '#6e6e6e',
      borde: '#dcdcdc', linea: '#ededed', suave: '#f7f7f7', suave2: '#efefef',
      heroA: '#f7f7f7', heroB: '#efefef', ok: '#15803d', warn: '#a16207', bad: '#b91c1c', info: '#374151',
      fodaF: ['#cfcfcf', '#fafafa'], fodaD: ['#cfcfcf', '#fafafa'],
      fodaO: ['#cfcfcf', '#fafafa'], fodaR: ['#cfcfcf', '#fafafa'],
      chartTxt: '#161616', chartTxt2: '#4a4a4a', chartGrid: '#ededed', chartFondo: '#ffffff'
    },
    arquitectonico: {
      nombre: 'Arquitectónico', desc: 'Papel cálido y terracota, como una lámina de taller.',
      cab1: '#8c3f22', cab2: '#b5502f', acento: '#8c3f22', oro: '#c98a3c', cabTxt: '#fdf6ee',
      hoja: '#fbf8f3', panel: '#fffdfa', tinta: '#221f1b', txt2: '#57504a', txt3: '#726a60',
      borde: '#ddd2c4', linea: '#eae2d6', suave: '#f6efe4', suave2: '#efe5d6',
      heroA: '#f8f1e6', heroB: '#f1e7d8', ok: '#4d7c3f', warn: '#b5502f', bad: '#9b2c2c', info: '#3f6478',
      fodaF: ['#c3d4b4', '#f2f6ec'], fodaD: ['#e2b8b0', '#faefec'],
      fodaO: ['#bccbd6', '#eef3f7'], fodaR: ['#e0c79a', '#faf2e2'],
      chartTxt: '#221f1b', chartTxt2: '#57504a', chartGrid: '#eae2d6', chartFondo: '#fffdfa'
    }
  };

  // Tema activo. Se fija al construir cada informe, antes de armar el CSS.
  let T = ESTILOS.institucional;
  function fijarEstilo(id){ T = ESTILOS[id] || ESTILOS.institucional; return T; }

  /* ── A qué escala está medido cada panel (v1043) ────────────────────────
     Es el error más caro de un análisis urbano y no se ve: una densidad
     medida sobre un radio de 2.500 m impresa al lado del conteo de la
     cuadra se lee como si fuera de la cuadra. El pliego educativo lo
     resolvió en la v854 con su propia tabla; este informe salía con CERO
     paneles rotulados —medido sobre el papel, 16 de 16—.

     La tabla NO se comparte con la del pliego educativo, y la razón va
     escrita para que nadie la unifique creyendo que es la clase B: lo que
     coincide es la JERARQUÍA territorial y no el texto, y acá el texto
     tiene que decir otra cosa. El pliego analiza «el sector»; este módulo
     analiza SIEMPRE un radio alrededor de un punto —`meta.radioM`, sin una
     sola rama de polígono— y su propia prosa lo llama «el radio». Dos
     documentos, dos redacciones de la misma jerarquía.

     La clave es un IDENTIFICADOR y no el título: los títulos de este
     informe llevan la cifra dentro —«Viabilidad · 78 / 100», «Competencia
     directa (3)»— así que una tabla por título sería un ancla por forma, y
     esas envejecen (v935). */
  const ESCALA_TEXTO_AIA = {
    /* Solo los dos valores que algun panel usa. El pliego educativo declara
       seis peldanos de la jerarquia y usa tres; aca no hay `predio` —este
       modulo no dibuja lote: analiza SIEMPRE un radio, medido— ni ningun
       panel medido a escala de municipio, asi que declararlos seria
       vocabulario que no llama nadie (v885). Agregar uno cuesta un renglon el
       dia que un panel lo necesite, y la guarda exige que ninguno sobre. */
    radio: 'Radio analizado',
    /* No está en el vocabulario del pliego educativo, y es una desviación
       declarada y no disimulada: el panel de comparación multi-radio mide a
       300, 500 y 1.000 m A LA VEZ, y su sentido entero es que NO hay una
       sola escala. Con los seis valores del pliego habría que elegir uno y
       mentir, o dejarlo sin rótulo, que es lo que esta versión vino a
       quitar. */
    varios: 'Varios radios'
  };
  const ESCALA_AIA = {
    /* Lo medido sobre los usos que caen dentro del radio. Es casi todo el
       informe, y eso es justo lo que hay que decir: un score de viabilidad
       que el lector lee como «de mi lote» se calcula sobre el entorno. */
    'atrae-vehiculos': 'radio', 'vocacion': 'radio', 'composicion-tabla': 'radio',
    'viabilidad': 'radio', 'ranking': 'radio', 'unidades': 'radio',
    'foda': 'radio', 'flujo': 'radio', 'movilidad': 'radio',
    'indicadores': 'radio', 'recomendaciones': 'radio',
    'anillos': 'radio', 'competencia': 'radio', 'oportunidad': 'radio',
    'viabilidad-detalle': 'radio', 'generadores': 'radio', 'hora-fuerte': 'radio',
    'composicion': 'radio', 'indicadores-filas': 'radio',
    'horarios': 'radio', 'horarios-vacio': 'radio', 'forma': 'radio', 'forma-vacia': 'radio',
    /* El censo se cuenta sobre las manzanas que caen en el radio, así que la
       CIFRA es del radio; la TASA con la que se proyecta es municipal y el
       propio panel lo dice en su renglón —«según la serie de proyecciones
       municipales del DANE»—. Se rotula por lo que mide, que es la regla
       que el pliego ya aplicó a «Presión de crecimiento». */
    'poblacion': 'radio',
    /* Lo levantado caminando: cada fila es de un edificio o de un tramo, y
       lo que se declara es sobre qué se midió —el radio—, no el tamaño de
       la casilla. Es la misma lectura que el pliego le dio a sus seis
       plantillas de campo. */
    'edificacion': 'radio', 'caminabilidad': 'radio', 'caminabilidad-vacia': 'radio',
    /* Compara ESTE radio contra el de otro sector: las dos columnas son de
       la misma escala, y por eso la comparación se sostiene. */
    'comparacion': 'radio',
    /* Las migas administrativas y la población de paso son municipales; el
       resto del panel —las busetas que paran en el radio, las casas de
       cambio, el paso más cercano— es del radio. Manda lo que el panel
       MIDE, y lo municipal lo nombra como tal en su propia prosa. */
    'contexto': 'radio',
    'multi-radio': 'varios', 'radios': 'varios'
  };
  /* ── De dónde sale la cifra de cada panel (v1045) ───────────────────────
     Medido contra el código, uno por uno, y con una restricción que decide
     la mitad de la tabla: `js/67` declara en su propio export que **el
     análisis lo hace SIEMPRE el servidor**, así que la fórmula de
     `viabilidad`, de `indicadores` y del flujo vive en el repositorio del
     motor —que no está en este contenedor y cuyas reglas no se sirven al
     navegador a propósito—. Para esos paneles la fórmula NO se escribe: se
     declara quién la calcula, que es lo que consta. Inventarla sería
     exactamente lo que la v863 prohíbe, y copiar las entradas del pliego
     educativo sería peor: describirían otro cálculo.

     Donde la cuenta SÍ está en lo servido, va la cuenta:
       · el reparto por grupo se calcula en este mismo archivo;
       · la proyección de población, en `js/67`;
       · la caminabilidad y la ficha de edificio, en `js/64`.

     Tres campos y no cinco. El pliego educativo declara fórmula, fuente,
     confiabilidad, referencia y error típico; acá `confiabilidad` y
     `referencia` no se pueden medir para los paneles del motor, y
     escribirlas «media» o dejarlas en blanco sería relleno. Lo que sí se
     puede defender de los dieciséis es de dónde sale, quién lo calcula y
     qué NO es. */
  const METODO_AIA = {
    'oportunidad': {
      f: 'los usos registrados en OpenStreetMap dentro del radio',
      c: 'lo calcula el motor de URBIS; la lista de «+N potencial» compara los usos que hay contra los que el motor espera para un entorno así',
      l: 'califica el SITIO y no la idea: no dice que el proyecto vaya a funcionar' },
    'viabilidad': {
      f: 'los usos del radio y la población del censo DANE',
      c: 'lo calcula el motor de URBIS: cinco dimensiones —demanda, competencia, complementarios, movilidad y entorno— resumidas en un puntaje de 0 a 100',
      l: 'es el encaje del uso declarado en ESTE entorno; no es una proyección financiera ni una medición del lote' },
    'viabilidad-detalle': {
      f: 'los usos del radio y la población del censo DANE',
      c: 'lo calcula el motor de URBIS: cinco dimensiones resumidas en un puntaje de 0 a 100, y cada una se imprime aparte',
      l: 'es el encaje del uso declarado en ESTE entorno; no es una proyección financiera ni una medición del lote' },
    'ranking': {
      f: 'los usos del radio y el programa que el cliente declaró',
      c: 'lo calcula el motor de URBIS: puntúa cada uso candidato contra lo que el entorno ya tiene',
      l: 'puntúa el encaje urbano, no la rentabilidad' },
    'unidades': {
      f: 'el ranking de usos y las unidades que el cliente declaró',
      c: 'lo calcula el motor de URBIS: reparte las unidades entre los usos mejor calificados',
      l: 'es una sugerencia de programa, no un estudio de mercado' },
    'recomendaciones': {
      f: 'las cifras de este mismo análisis',
      c: 'lo calcula el motor de URBIS a partir de los indicadores del entorno',
      l: 'URBIS recomienda y el humano decide: ninguna de estas líneas es una decisión' },
    'foda': {
      f: 'las cifras de este mismo análisis',
      c: 'lo calcula el motor de URBIS: selecciona los hallazgos que más se apartan de lo esperable',
      l: 'es una lectura de las cifras, no una medición nueva' },
    'movilidad': {
      f: 'las vías y las paradas de OpenStreetMap dentro del radio',
      c: 'lo calcula el motor de URBIS: la exposición pesa cada corredor por su jerarquía y su distancia al punto',
      l: 'mide la malla MAPEADA, no el tránsito: una vía sin mapear no existe para esta cifra' },
    'flujo': {
      f: 'los usos de OpenStreetMap dentro del radio',
      c: 'lo calcula el motor de URBIS: cada uso aporta según su tipo, y el andén observado ajusta el resultado',
      l: 'es un potencial estimado por tipo de uso; no es un aforo ni un conteo' },
    'generadores': {
      f: 'los usos de OpenStreetMap dentro del radio',
      c: 'lo calcula el motor de URBIS: cada uso aporta al peatón según su tipo, y los frentes muertos restan',
      l: 'es un potencial estimado por tipo de uso; no es un aforo' },
    'hora-fuerte': {
      f: 'el horario típico de cada tipo de uso presente en el radio',
      c: 'lo calcula el motor de URBIS repartiendo el aporte de cada uso entre las cuatro franjas',
      l: 'las franjas son estimadas por tipo de uso, no observadas en la calle' },
    'atrae-vehiculos': {
      f: 'los usos de OpenStreetMap dentro del radio',
      c: 'lo calcula el motor de URBIS: cada uso aporta viajes en vehículo según su tipo',
      l: 'son viajes estimados por tipo de uso, no conteos de entrada' },
    'anillos': {
      f: 'los usos de OpenStreetMap con su distancia al punto',
      c: 'lo calcula el motor de URBIS: lo cercano pesa más, y el reparto suma 100',
      l: 'es influencia estimada por distancia, no clientes' },
    'competencia': {
      f: 'los usos del mismo rubro que el proyecto, dentro del radio',
      c: 'lo calcula el motor de URBIS cruzando el programa declarado con la Matriz de Usos',
      l: 'solo cuenta lo mapeado y solo cita lo nombrado: cero no es «no hay»' },
    'vocacion': {
      f: 'los rubros comerciales registrados en el radio',
      c: 'lo calcula el motor de URBIS: la vocación es el rubro con mayor participación en la oferta',
      l: 'describe la oferta MAPEADA, no el mercado' },
    'contexto': {
      f: 'los límites administrativos, las rutas y los pasos de OpenStreetMap',
      c: 'se toman tal cual de la consulta, sin recalcular nada',
      l: 'es lo que hay subido a OpenStreetMap, no la oferta completa' },
    'composicion': {
      f: 'los usos del radio clasificados en la Matriz de Usos de URBIS',
      c: 'se cuenta en este mismo archivo: el porcentaje de cada grupo es 100 × usos del grupo ÷ total de usos',
      l: 'cuenta USOS, no superficie, ni empleo, ni facturación' },
    'composicion-tabla': {
      f: 'los usos del radio clasificados en la Matriz de Usos de URBIS',
      c: 'se cuenta en este mismo archivo: el porcentaje de cada grupo es 100 × usos del grupo ÷ total de usos',
      l: 'cuenta USOS, no superficie, ni empleo, ni facturación' },
    'indicadores': {
      f: 'el censo DANE por manzana (estrato, sexo y edad) y los usos de OpenStreetMap',
      c: 'el estrato y el reparto por sexo y edad se cuentan de las manzanas censales que caen en el radio; los cinco niveles los calcula el motor de URBIS',
      l: 'el estrato es del censo de 2018, y un «nivel» es una lectura del motor y no una medida' },
    'indicadores-filas': {
      f: 'el censo DANE por manzana (estrato, sexo y edad) y los usos de OpenStreetMap',
      c: 'el estrato y el reparto por sexo y edad se cuentan de las manzanas censales que caen en el radio; los cinco niveles los calcula el motor de URBIS',
      l: 'el estrato es del censo de 2018, y un «nivel» es una lectura del motor y no una medida' },
    'poblacion': {
      f: 'el censo DANE por manzana y la serie de proyecciones municipales del DANE',
      c: 'se proyecta en js/67: la tasa anual es (P₁/P₀) elevado a 1÷años, menos 1, y la población es la base por (1+tasa) elevado a los años transcurridos',
      l: 'la tasa es del MUNICIPIO aplicada al radio: supone que todos los barrios crecen igual' },
    'edificacion': {
      f: 'la ficha de edificio levantada en campo, edificio por edificio',
      c: 'se cuenta en js/64: el reparto por época y por material sale de las fichas que traen ese dato, y la vulnerabilidad cruza los dos',
      l: 'NO es un diagnóstico estructural: señala cuáles ameritan que las revise un ingeniero' },
    'caminabilidad': {
      f: 'el estado del andén observado al mapear, tramo por tramo',
      c: 'se calcula en js/64: el índice es la suma de las observaciones dividida por su número, y el factor es 0,75 + 0,35 × índice',
      l: 'AJUSTA el flujo peatonal, no lo genera: un andén bueno deja caminar a quien ya pasa' },
    'caminabilidad-vacia': {
      f: 'el estado del andén observado al mapear, tramo por tramo',
      c: 'se calcula en js/64 sobre las observaciones de andén; sin ninguna, el flujo se deja sin ajustar',
      l: 'un vacío de datos no es un andén bueno' },
    'horarios': {
      f: 'la etiqueta de horario que el establecimiento tiene puesta en OpenStreetMap',
      c: 'se cuenta tal cual, sin estimar nada',
      l: 'es lo DECLARADO en el letrero, no lo observado: puede estar desactualizado' },
    'horarios-vacio': {
      f: 'la etiqueta de horario de OpenStreetMap',
      c: 'se cuenta tal cual, sin estimar nada',
      l: 'que no haya horarios declarados no significa que los locales estén cerrados' },
    'multi-radio': {
      f: 'el mismo análisis repetido a varios radios',
      c: 'se repite la consulta a cada radio de la comparativa y se cuenta lo que cae dentro de cada uno',
      l: 'no son anillos: cada radio INCLUYE a los menores, así que las cifras no se restan entre sí' },
    'radios': {
      f: 'el mismo análisis repetido a varios radios',
      c: 'se repite la consulta a cada radio de la comparativa y se cuenta lo que cae dentro de cada uno',
      l: 'no son anillos: cada radio INCLUYE a los menores' },
    'comparacion': {
      f: 'otro sector analizado con este mismo método',
      c: 'se ponen las mismas cifras una al lado de la otra, sin recalcular ninguna',
      l: 'la comparación solo se sostiene si los dos radios son comparables' },
    'forma': {
      f: 'la traza de vías de OpenStreetMap dentro del radio',
      c: 'lo calcula el motor de URBIS a partir de la malla mapeada',
      l: 'describe la traza MAPEADA: donde falte una calle por mapear, la forma sale distinta' },
    'forma-vacia': {
      f: 'la traza de vías de OpenStreetMap dentro del radio',
      c: 'lo calcula el motor de URBIS a partir de la malla mapeada',
      l: 'sin malla mapeada no hay forma que describir' }
  };
  /* Un panel que no publica una cifra no tiene método que declarar, por la
     misma razón por la que no lleva escala. La razón se escribe y se
     comprueba: sin esta mitad, el atajo sería meterlos todos acá. */
  const SIN_METODO_AIA = {
    'guia': 'define las cifras del informe; no calcula ninguna',
    'como-leer': 'define las cifras del informe; no calcula ninguna',
    'como-leer-edu': 'define las cifras del informe; no calcula ninguna',
    'falta': 'lista lo que queda por levantar; no hay cifra que calcular',
    'compatibilidad': 'cruza los usos que el cliente declaró; no mide el entorno',
    'vacios': 'lista lo que falta conseguir y en qué ventanilla; no hay cifra que calcular'
  };

  /* ── Los vacíos obligatorios del informe, con su trámite ──────────────
     §6 del orden fijado. Hasta la v1045 el informe cerraba con UNA línea
     —«verificar norma urbanística (POT) y prefactibilidad financiera»— y
     eso es exactamente lo que la v880 llamó un muro: nombrar el documento
     y callar el trámite deja al lector sin saber a qué ventanilla ir.

     Cada vacío cierra un límite que el informe YA declara en su propia
     tabla de método, y lo dice con el id de ese panel: así no se puede
     inventar un vacío sin un límite medido detrás, y la guarda lo
     comprueba contra `METODO_AIA`. Ninguno se copió del módulo educativo
     —que no se carga en esta página— y el de la norma pide otro documento
     a propósito: aquel analiza un PREDIO y pide la ficha normativa con su
     matrícula inmobiliaria; este analiza un RADIO y pide el certificado de
     uso del suelo de una dirección, que es más liviano y es el que un
     negocio necesita antes de firmar un arriendo.

     `mientras` y `ojo` son DOS campos y no uno: el sustituto y su límite.
     La v880 lo dejó escrito —«el mientras llega NO es un permiso para
     suponer»— y con un solo campo el límite se cae al redactar sin que
     nada lo diga. */
  const VACIOS_AIA = [
    { id: 'uso-del-suelo', t: 'Uso del suelo permitido', panel: 'recomendaciones',
      falta: 'el certificado de uso del suelo de esta dirección, o un concepto de norma urbanística: es lo que dice si la norma permite el uso que el informe recomienda.',
      hay: 'los usos que OpenStreetMap trae alrededor son lo que de hecho OPERA hoy, y eso no es lo que la norma permite: un local puede estar funcionando sin licencia, y un uso ausente puede estar perfectamente permitido.',
      que: 'certificado de uso del suelo, o concepto de norma urbanística, para la dirección exacta',
      quien: 'curaduría urbana del municipio; donde no hay curaduría, la Secretaría de Planeación',
      como: 'solicitud en la ventanilla de la curaduría o de planeación; varios municipios la reciben en línea',
      llevar: 'la dirección exacta, la cédula catastral si se tiene, y el uso que se piensa abrir',
      tarda: 'entre 5 y 15 días hábiles según el municipio, y tiene costo en la mayoría de curadurías',
      mientras: 'el POT publicado en la página del municipio dice qué tratamiento tiene el sector',
      ojo: 'un tratamiento de sector NO es el uso de una dirección: dentro del mismo tratamiento hay ejes donde el comercio se permite y manzanas donde no.' },
    { id: 'registro-mercantil', t: 'Competencia formalmente registrada', panel: 'competencia',
      falta: 'el registro mercantil por actividad económica: es lo que dice cuántos negocios del mismo rubro están MATRICULADOS en el sector.',
      hay: 'el informe cuenta lo que alguien subió a OpenStreetMap, así que un cero no dice «no hay competencia»: dice «nadie lo mapeó». Y lo mapeado no distingue un negocio formal de uno que no lo es.',
      que: 'listado del registro mercantil por código de actividad (CIIU) y por barrio o dirección',
      quien: 'la Cámara de Comercio de la jurisdicción',
      como: 'se pide en la sede o por su portal de servicios empresariales; hay versión gratuita agregada y versión detallada de pago',
      llevar: 'el código CIIU del rubro, el barrio o el rango de direcciones, y los datos de quien lo solicita',
      tarda: 'de un día a una semana según la cámara y el detalle que se pida',
      mientras: 'los competidores mapeados sirven como PISO de cuántos hay',
      ojo: 'es un piso y nunca un total: la cifra solo puede subir cuando llegue el registro, nunca bajar.' },
    { id: 'aforo-transito', t: 'Aforo de tránsito y de peatones', panel: 'movilidad',
      falta: 'un conteo con su fecha, su hora y su punto: es lo único que dice cuánta gente y cuántos vehículos pasan de verdad.',
      hay: 'el flujo del informe es un potencial MODELADO a partir de los usos y la jerarquía de las vías mapeadas. Nadie contó nada en esa esquina.',
      que: 'conteos de tránsito y de peatones del corredor, con fecha, franja y punto de medición',
      quien: 'Secretaría de Movilidad o de Tránsito del municipio; en corredores nacionales, el INVÍAS',
      como: 'petición escrita de información pública, que por ley tiene respuesta en 10 días hábiles',
      llevar: 'el corredor o la intersección por su nombre, y el periodo que se quiere',
      tarda: '10 días hábiles el derecho de petición; un conteo propio son dos días de campo',
      mientras: 'se cuenta a mano en la acera, en las dos franjas que decidan el negocio',
      ojo: 'media hora en una franja no es el día: dice lo que pasó en esa media hora, y así hay que escribirlo.' },
    { id: 'estratificacion', t: 'Estratificación vigente', panel: 'indicadores',
      falta: 'el certificado de estratificación, o el acto del municipio que la adopta: es lo que dice qué estrato rige HOY en las manzanas del radio.',
      hay: 'el estrato que el informe imprime viene del censo, así que puede llevar años sin actualizarse — y un sector que se renovó cambia de estrato antes de que el censo lo recoja.',
      que: 'certificado de estratificación de las manzanas del sector, o el decreto vigente que la adopta',
      quien: 'oficina de estratificación del municipio, o la Secretaría de Planeación',
      como: 'solicitud en la ventanilla; el decreto suele estar publicado en la página del municipio',
      llevar: 'la dirección o el barrio, y los datos de quien lo solicita',
      tarda: 'de inmediato a 10 días hábiles según el municipio',
      mientras: 'una factura de servicios públicos de un predio del sector trae el estrato vigente de ESE predio',
      ojo: 'es de un predio y no del sector: en la misma manzana puede haber dos estratos.' }
  ];

  function bloqueVaciosAIA(){
    const fila = (etq, val) => val
      ? '<div class="vq"><i>' + esc(etq) + '</i><span>' + esc(val) + '</span></div>' : '';
    return '<div class="tarjeta"><h2>Lo que este informe NO tiene, y cómo se consigue</h2>' +
      escalaAIA('vacios') +
      '<p class="nota-pie">Cada uno cierra un límite que este informe declara en su propia tabla ' +
        'de método, y por eso está acá: no porque una lista lo pida. El trámite va en verde y el ' +
        'vacío en ámbar, que son dos cosas distintas — «esto no lo tenemos» y «así se consigue».</p>' +
      VACIOS_AIA.map((v) => '<div class="vacio-aia">' +
        '<p class="vacio-t">' + esc(v.t) + '</p>' +
        '<p class="vacio-tag">Sin dato oficial en este informe</p>' +
        '<p class="vacio-falta"><b>Haría falta</b> ' + esc(v.falta) + '</p>' +
        '<p class="vacio-hay"><b>Lo que hay no es eso</b> ' + esc(v.hay) + '</p>' +
        '<p class="vacio-tag vacio-tag-ok">Cómo se consigue</p>' +
        '<div class="comoq">' +
          fila('Qué se pide', v.que) + fila('Ante quién', v.quien) + fila('Cómo', v.como) +
          fila('Qué hay que llevar', v.llevar) + fila('Cuánto tarda', v.tarda) +
        '</div>' +
        '<p class="vacio-mientras"><b>Mientras llega</b> ' + esc(v.mientras) +
          ' <em>' + esc(v.ojo) + '</em></p>' +
        '</div>').join('') +
      '</div>';
  }

  /* Los dos paneles que no llevan título propio en el papel: su nombre no
     se puede leer del `<h2>` porque no hay ninguno, así que se declara. Es
     la única razón admitida para escribir un nombre a mano, y la guarda
     exige que ningún id con título propio esté acá. */
  const SIN_TITULO_AIA = {
    'generadores': 'Qué trae gente a pie',
    'radios': 'El entorno según la distancia'
  };

  /* La hoja de método (v1045). Sale de lo que el informe COMPUSO: recorre el
     cuerpo buscando los identificadores que el rótulo de escala dejó, en el
     orden en el que aparecen, y arma una fila por panel. Así no puede listar
     un panel que no salió ni olvidar uno que sí.

     Va en su propia hoja y no como pie de cada panel, y la razón está
     medida: con el pie debajo de los dieciséis, la hoja 4 pasa de 761 a 811
     px sobre un papel de 756 —y la 3 queda a trece px del borde—. El informe
     tiene hojas de tamaño FIJO: no bisecta como el pliego educativo, así que
     lo que no cabe se sale sin que nada lo diga. Un método que revienta la
     maquetación no es un método declarado, es una hoja rota. */
  /* Las dos hojas de anexo —el método y los vacíos— son SIEMPRE las dos
     últimas del informe de empresas, así que su número se deriva de
     `N_HOJAS` en vez de escribirse: una hoja de análisis nueva sube el total
     y los dos anexos siguen cerrando el documento, sin que nadie tenga que
     acordarse de correrlos. */
  function hojaMetodoAIA(cuerpoHTML, titulo, fecha, autor, r){
    const nHoja = N_HOJAS - 1;
    /* El nombre del panel NO se escribe en una tercera lista: se lee del
       propio título, que el rótulo sigue por construcción —`escalaAIA` se
       emite pegado detrás del `</h2>`—. Una tabla de nombres al lado sería
       una lista más que mantener y la primera que se quedaría vieja al
       renombrar un panel (v878). */
    const vistos = [], nombre = {};
    /* El título se lee por ADYACENCIA exacta y no con un `[\s\S]*?`: la
       primera versión usaba uno y se tragaba el título del panel ANTERIOR
       cuando el de este no existía —una fila de la tabla salió de 210 px con
       medio panel dentro—. Lo destapó medir el alto de cada fila, no leer.
       Es el ancla por forma que envejece (v935), cometida en su propio
       lector: ahora se exige que lo de delante TERMINE en `</h2>` o `</h3>`
       y el título se corta desde su propia apertura. */
    const re = /<p class="aia-escala"[^>]*data-m="([^"]+)"/g;
    let m;
    while ((m = re.exec(cuerpoHTML)) !== null) {
      const id = m[1];
      if (vistos.indexOf(id) >= 0) continue;
      vistos.push(id);
      const antes = cuerpoHTML.slice(0, m.index).replace(/\s+$/, '');
      const cierra = /<\/h([23])>$/.exec(antes);
      let t = '';
      if (cierra) {
        const abre = antes.lastIndexOf('<h' + cierra[1]);
        if (abre >= 0) {
          /* El `<em>` de un título es su SUBTÍTULO y no su nombre, así que
             se quita entero; y la cifra que varios títulos llevan dentro
             —«Viabilidad · 78 / 100», «Competencia directa (3)»— sobra en
             una tabla de método, que habla del panel y no de su valor. */
          t = antes.slice(abre).replace(/^<h[23][^>]*>/, '').replace(/<\/h[23]>$/, '')
                   .replace(/<em[^>]*>[\s\S]*?<\/em>/g, ' ')
                   .replace(/<[^>]*>/g, ' ').replace(/&middot;|&nbsp;/g, ' ')
                   .replace(/\s+/g, ' ').trim()
                   .replace(/\s*\([\d.,]+\)$/, '').replace(/\s*·?\s*[\d.,]+\s*\/\s*100$/, '')
                   .replace(/\s*·\s*$/, '').trim();
        }
      }
      nombre[id] = t || SIN_TITULO_AIA[id] || id;
    }
    if (!vistos.length) return '';
    const fila = (id) => {
      const d = METODO_AIA[id];
      const e = ESCALA_AIA[id];
      /* Un panel compuesto sin entrada lo DICE en rojo, en vez de faltar de
         la tabla: faltar se lee igual que no existir. */
      if (!d) return '<tr class="met-sin"><td colspan="4">' + esc(id) +
        ' — método sin declarar</td></tr>';
      return '<tr><td class="met-p">' + esc(nombre[id] || id) + '</td>' +
        '<td>' + esc(d.f) + '</td><td>' + esc(d.c) + '</td>' +
        '<td class="met-l">' + esc(d.l) + '</td></tr>';
    };
    return '<div class="hoja"><div class="contenido">' +
      cabecera(titulo, 'Cómo se midió cada panel', 'de dónde sale cada cifra y qué no es', fecha, nHoja) +
      seccion(0, 'Cómo se midió cada panel', 'una fila por panel de este informe, en el orden en que salen') +
      '<table class="tbl-met"><thead><tr><th>Panel</th><th>De dónde sale</th>' +
      '<th>Cómo se calcula</th><th>Lo que NO es</th></tr></thead><tbody>' +
      vistos.map(fila).join('') + '</tbody></table>' +
      '<p class="nota-pie">Las cifras que calcula el motor de URBIS se marcan como tales: ' +
      'su regla no se publica, que es lo que distingue este análisis de un conteo. Lo que sí ' +
      'está en el navegador —el reparto por grupo, la proyección de población, la ficha de ' +
      'campo— va con su cuenta escrita, para que cualquiera la rehaga.</p>' +
      pie(nHoja, r, autor) +
      '</div></div>';
  }

  /* La hoja de los vacíos, la última: cierra el informe con lo que le falta
     y en qué ventanilla se pide.

     Va en hoja PROPIA y en una columna, y las dos cosas se midieron. Con la
     tabla de método en la misma hoja, el contenido daba 927 px de los 756
     que da el papel; a dos columnas bajaba a 758, que sigue siendo dos por
     encima —y recortar un renglón para que cierre es el arreglo que este
     proyecto deshizo en la v882, la v886 y la v901—. A dos columnas en su
     propia hoja cabría de sobra y dejaría media hoja en blanco, que es lo
     que la v853 llama una hoja a medio terminar. En una columna y sola
     mide 510 px, que es el 67 % del papel: como la hoja 2, que ya se
     publica así. */
  function hojaVaciosAIA(titulo, fecha, autor, r){
    return '<div class="hoja"><div class="contenido">' +
      cabecera(titulo, 'Lo que este informe no tiene', 'y en qué ventanilla se pide', fecha, N_HOJAS) +
      /* El conteo se CALCULA: escrito a mano dentro de un texto fijo es una
         cifra que envejece sola el día que entre o salga un vacío (v903). */
      seccion(0, 'Lo que este informe NO tiene, y cómo se consigue',
        numEs(VACIOS_AIA.length) +
          (VACIOS_AIA.length === 1 ? ' dato que no sale' : ' datos que no salen') +
          ' de OpenStreetMap ni del censo') +
      bloqueVaciosAIA() +
      pie(N_HOJAS, r, autor) +
      '</div></div>';
  }

  /* Un panel que NO publica una cifra medida sobre un territorio no lleva
     escala, y dice por qué. Sin esta mitad, el arreglo barato sería
     rotularlos todos «radio» y el rótulo dejaría de significar algo. */
  const SIN_ESCALA_AIA = {
    'guia': 'define las cifras del informe; no publica ninguna',
    'como-leer': 'define las cifras del informe; no publica ninguna',
    'como-leer-edu': 'define las cifras del informe; no publica ninguna',
    'falta': 'lista lo que queda por levantar; es una tarea, no una medición',
    'compatibilidad': 'cruza los usos que el cliente declaró; no mide el entorno',
    'vacios': 'lista lo que el informe no tiene y cómo se pide; es una tarea, no una medición'
  };
  /* El rótulo va FUERA del `<h2>` y pegado debajo, por lo que el pliego
     aprendió en la v854: el título de un panel se extrae con un patrón que
     una etiqueta dentro rompe. Un identificador que no está en ninguna de
     las dos tablas imprime «escala sin declarar» en rojo en vez de callar:
     callar deja que el lector suponga que es del radio. */
  function escalaAIA(id){
    const e = ESCALA_AIA[id];
    /* El identificador viaja en el rótulo. Es lo que permite que la hoja de
       método salga de lo que el informe COMPUSO de verdad y no de una lista
       escrita al lado: con dos listas, la que se quedaría vieja sería la del
       método, porque nadie la vuelve a mirar (v879). */
    if (e) return '<p class="aia-escala" data-m="' + esc(id) + '">' + esc(ESCALA_TEXTO_AIA[e] || e) + '</p>';
    if (SIN_ESCALA_AIA[id]) return '';
    return '<p class="aia-escala aia-escala-sin">escala sin declarar</p>';
  }

  /* Con menos de este número de usos el motor deja de dar por fiable su
     propio mapa de calor (`mapaCalor.fiable`), y es el mismo número con el
     que el informe del curso avisa desde que existe. Una sola constante
     para que las dos advertencias no puedan separarse. */
  const MIN_USOS_FIABLE = 25;

  function estrellasHTML(n){ return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)); }
  function estrellasDeScore(score){ return Math.max(1, Math.min(5, Math.round((score || 0) / 20))); }

  // ── Mapa estático + círculo de radio + puntos superpuestos ──────────────
  // El círculo y los puntos se dibujan con CSS sobre la imagen del mapa
  // (LocationIQ no los soporta y la URL no aguantaría miles de marcadores).
  function calcZoom(lat, radioM, ladoMenorPx){
    const objetivoRadioPx = ladoMenorPx * 0.46;     // el círculo llena buena parte del mapa
    const mppNecesario = radioM / objetivoRadioPx;
    let z = Math.log(156543.03392 * Math.cos(lat * Math.PI / 180) / mppNecesario) / Math.LN2;
    z = Math.max(11, Math.min(18, Math.floor(z)));
    const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
    return { z, mpp, radioPx: radioM / mpp };
  }

  function urlMapaEstatico(meta, w, h, zoom){
    const cfg = (window.URBIS_CONFIG && window.URBIS_CONFIG.LOCATIONIQ) || {};
    if (!cfg.apiKey) return '';
    return 'https://maps.locationiq.com/v3/staticmap?key=' + encodeURIComponent(cfg.apiKey) +
      '&center=' + meta.lat + ',' + meta.lng + '&zoom=' + zoom +
      '&size=' + w + 'x' + h + '&format=png';
  }

  function puntosSobreMapa(r, mpp, w, h, maxPuntos){
    const lat0 = r.meta.lat, lng0 = r.meta.lng, mx = w / 2, my = h / 2;
    const dentro = [];
    (r.pois || []).forEach(p => {
      const dx = (p.lng - lng0) * 111320 * Math.cos(lat0 * Math.PI / 180) / mpp;
      const dy = -(p.lat - lat0) * 110540 / mpp;
      if (Math.abs(dx) < mx - 6 && Math.abs(dy) < my - 6) dentro.push({ dx, dy, color: p.color });
    });
    // Muestreo uniforme: si se tomaran solo los más cercanos, todos los
    // puntos quedarían amontonados en el centro del mapa.
    const paso = Math.max(1, Math.ceil(dentro.length / (maxPuntos || 150)));
    let html = '';
    for (let i = 0; i < dentro.length; i += paso) {
      const d = dentro[i];
      const x = (mx + d.dx) / w * 100, y = (my + d.dy) / h * 100;
      html += '<i class="pt" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;background:' + d.color + '"></i>';
    }
    return html;
  }

  // Hitos peatonales sobre el mapa: los establecimientos que de verdad mueven
  // gente a pie, señalados con su nombre. Se reparten las etiquetas a los lados
  // según de qué lado del lote caiga cada uno, para que no se pisen con el
  // marcador del centro.
  function hitosSobreMapa(r, mpp, w, h){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    if (!f || !f.hitos || !f.hitos.length) return '';
    const lat0 = r.meta.lat, lng0 = r.meta.lng, mx = w / 2, my = h / 2;
    const puestas = [];   // etiquetas ya colocadas, para no encimarlas
    let html = '';
    // El gimnasio se coloca primero: como el sitio del mapa es limitado, el que
    // se ubica antes es el que sobrevive, y este es el hito que más cambia el
    // tránsito de la acera. Los demás se reparten el espacio que quede.
    const orden = f.hitos.filter(h2 => h2.sub === 'gimnasio')
                    .concat(f.hitos.filter(h2 => h2.sub !== 'gimnasio'));
    orden.forEach(function (hi) {
      if (puestas.length >= 4) return;
      const dx = (hi.lng - lng0) * 111320 * Math.cos(lat0 * Math.PI / 180) / mpp;
      const dy = -(hi.lat - lat0) * 110540 / mpp;
      if (Math.abs(dx) > mx - 10 || Math.abs(dy) > my - 10) return;
      const x = (mx + dx) / w * 100, y = (my + dy) / h * 100;
      // Nombre recortado: en el mapa manda que se lea, y el nombre completo
      // queda igual en la lista de hitos del bloque de flujo.
      const etq = hi.nombre.length > 18 ? hi.nombre.slice(0, 17).trim() + '…' : hi.nombre;
      // Ancho aproximado del rótulo como % del recuadro. Medido sobre el
      // informe ya maquetado: con letra de 6,4 px son ~3,5 px por carácter más
      // ~27 px fijos de relleno y borde; se redondea hacia arriba y se cuentan
      // TAMBIÉN los caracteres de la distancia, que van dentro del mismo
      // rótulo. El recuadro del mapa mide ~266 px de ancho en esta maqueta.
      const nChars = etq.length + String(hi.distM).length + 2;
      const anchoPct = (nChars * 3.6 + 34) / 266 * 100;
      // Sale HACIA AFUERA, alejándose del centro: hacia adentro se amontonaban
      // unas sobre otras y encima del rótulo del lote. Si por fuera no cabe,
      // se voltea; si no cabe por ninguno de los dos lados, se descarta.
      // Se prueba primero hacia afuera —alejándose del centro, que es donde hay
      // sitio— y si ahí no cabe o choca, hacia adentro. Comparar rectángulos
      // completos, y no solo alturas, deja pasar bastantes más rótulos sin que
      // ninguno quede encima de otro.
      // Medidas reales sobre la maqueta: el rótulo mide ~12 px de alto (7% del
      // recuadro) y el letrero PROYECTO sale a la derecha de la cruz, no
      // centrado en ella. Reservar de más dejaba fuera hitos que sí cabían.
      const ALTO = 7;
      const BADGE = { x0: 48, x1: 74, y0: 46.5, y1: 54.5 };
      const rectDe = l => l === 'der'
        ? { x0: x + 2, x1: x + 2 + anchoPct, y0: y - ALTO / 2, y1: y + ALTO / 2 }
        : { x0: x - 2 - anchoPct, x1: x - 2, y0: y - ALTO / 2, y1: y + ALTO / 2 };
      const solapa = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      const sirve = rc => rc.x0 >= 1 && rc.x1 <= 99 &&
                          !solapa(rc, BADGE) && !puestas.some(p => solapa(rc, p));

      const fuera = dx >= 0 ? 'der' : 'izq';
      const dentro = fuera === 'der' ? 'izq' : 'der';
      let lado = null, rc = rectDe(fuera);
      if (sirve(rc)) lado = fuera;
      else { rc = rectDe(dentro); if (sirve(rc)) lado = dentro; }
      if (!lado) return;   // no cabe en ningún lado: mejor no dibujarlo

      puestas.push(rc);
      html += '<div class="hito ' + lado + '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%">' +
        '<i></i><b>' + esc(etq) + '<em>' + numEs(hi.distM) + ' m</em></b></div>';
    });
    return html;
  }

  // ── Mapas de calor ──────────────────────────────────────────────────────
  //
  // El flujo es un número para todo el radio, y eso promedia lo que más
  // importa: pegado al gimnasio pasa gente que 300 m más allá no pasa. Estas
  // tres capas reparten el MISMO cálculo sobre la malla del motor y lo pintan
  // encima del mapa, para poder señalar la esquina en vez de describirla.
  //
  // El dibujo sale de js/56, el mismo que usan la pantalla de empresas y el
  // panel del curso: una sola rampa de colores para el papel y la pantalla.
  function pngCalor(capa, n, tipo){
    return window.URBIS_CALOR ? window.URBIS_CALOR.png(capa, n, tipo, 260) : '';
  }

  function panelCalor(r, capa, foco, titulo, sub, tipo){
    const W = 400, H = 300;
    const z = calcZoom(r.meta.lat, r.meta.radioM, Math.min(W, H));
    const url = urlMapaEstatico(r.meta, W, H, z.z);
    const pctW = (z.radioPx / W * 200).toFixed(2), pctH = (z.radioPx / H * 200).toFixed(2);
    const png = pngCalor(capa, (r.stats.movilidad.flujo.mapaCalor || {}).n || 26, tipo);
    // El foco se marca sobre el mapa con la misma cuenta que usa el motor,
    // para que el punto del plano y la frase de abajo hablen del mismo sitio.
    let marcaFoco = '';
    if (foco) {
      const dx = (foco.lng - r.meta.lng) * 111320 * Math.cos(r.meta.lat * Math.PI / 180) / z.mpp;
      const dy = -(foco.lat - r.meta.lat) * 110540 / z.mpp;
      marcaFoco = '<i class="calor-foco" style="left:' + ((W/2 + dx) / W * 100).toFixed(2) +
                  '%;top:' + ((H/2 + dy) / H * 100).toFixed(2) + '%"></i>';
    }
    return '<div class="calor-panel">' +
      '<h3>' + esc(titulo) + '<em>' + esc(sub) + '</em></h3>' +
      '<div class="mapa-marco"><div class="mapa-wrap">' +
        (url ? '<img class="mapa-img" src="' + url + '" alt="' + esc(titulo) + '">'
             : '<div class="mapa-img mapa-vacio"></div>') +
        (png ? '<img class="calor-capa" src="' + png + '" style="width:' + pctW +
               '%;height:' + pctH + '%" alt="">' : '') +
        marcaFoco +
        '<div class="mapa-pin"><i class="cruz-h"></i><i class="cruz-v"></i><i class="punto"></i></div>' +
      '</div></div>' +
      '<p class="calor-foco-txt">' +
        (foco ? 'Punto más activo: <b>' + esc(foco.texto) + '</b> del lote.'
              : 'Sin actividad suficiente para señalar un punto.') + '</p>' +
      '</div>';
  }

  function bloqueMapaCalor(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    const mc = f && f.mapaCalor;
    if (!mc) return '';
    const leyenda = tipo =>
      '<div class="calor-leyenda ' + tipo + '"><span>menos</span><i></i><span>más</span></div>';
    return '<div class="calor-fila">' +
        panelCalor(r, mc.peatonalDia, mc.focoDia, 'A pie · de día',
                   'mañana a tarde', 'peaton') +
        panelCalor(r, mc.peatonalNoche, mc.focoNoche, 'A pie · de noche',
                   'después de las 7 p.m.', 'peaton') +
        panelCalor(r, mc.vehicular, mc.focoVehicular, 'En vehículo',
                   'corredores y atractores', 'vehiculo') +
      '</div>' +
      '<div class="calor-pie">' + leyenda('peaton') + leyenda('vehiculo') +
        '<p class="pie-nota">' +
          'Cada capa se colorea contra su propio máximo: responde <b>dónde</b> se concentra el ' +
          'movimiento dentro del radio, no cuánto — para el cuánto están las cifras de flujo. ' +
          'El cálculo suma los usos que atraen gente y <b>resta</b> los que rompen el recorrido ' +
          '(bodegas, lotes, locales cerrados).' +
          (mc.fiable ? '' : ' Atención: con pocos puntos mapeados en el radio, este mapa es indicativo ' +
                            'y conviene contrastarlo en campo.') +
        '</p>' +
      '</div>';
  }

  // Qué atrae VEHÍCULOS, que no es lo mismo que qué atrae peatones: a una
  // ferretería o a una bodega no se llega a pie con la compra al hombro. Sin
  // esta lista, dos esquinas de la misma avenida se leían idénticas aunque
  // una tuviera un centro comercial al lado y la otra casas.
  function bloqueAtraeVehiculo(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    const gen = (f && f.generadoresVehiculo || []).slice(0, 6);
    const filas = gen.length
      ? '<table class="tbl-gente"><tr><th>Uso</th><th class="n">Cant.</th><th class="n">Aporte</th></tr>' +
        gen.map(g => '<tr><td>' + esc(g.nombre) + '</td><td class="n">' + g.n +
          '</td><td class="n">' + g.aporte + '</td></tr>').join('') + '</table>'
      : '<p class="nota-pie">No se identificaron usos que atraigan viajes en vehículo en el radio.</p>';
    return '<div class="tarjeta"><h2>Qué atrae vehículos</h2>' + escalaAIA('atrae-vehiculos') + filas +
      '<p class="pie-nota">' + textoParqueo(f) + '</p></div>';
  }

  // De qué vive la cuadra. Contar comercios no dice nada por sí solo: 20
  // almacenes de ropa y 20 ferreterías dan el mismo número y son sectores
  // opuestos para quien va a poner un local.
  function bloqueVocacion(r){
    const c = (r.indicadores && r.indicadores.comercio) || {};
    const v = c.vocacion || {};
    const rep = (v.reparto || []).filter(x => x.n > 0).slice(0, 5);
    const maxN = rep.length ? rep[0].n : 1;
    // Clase propia y no `.hf`: comparten aspecto, pero son cosas distintas —
    // una son horas del día y la otra rubros— y mezclarlas hacía imposible
    // comprobar cualquiera de las dos por separado.
    const barras = rep.map(x =>
      '<div class="hf voc-fila"><span>' + esc(x.nombre) + '</span><div class="cl-barra"><i style="width:' +
      Math.round(100 * x.n / maxN) + '%;background:' + T.acento + '"></i></div><b>' + x.n + '</b></div>').join('');
    return '<div class="tarjeta"><h2>De qué vive la cuadra</h2>' + escalaAIA('vocacion') +
      (v.nombre
        ? '<p class="voc-titulo">' + esc(v.nombre) + ' <em>· ' + numEs(v.share) + '% de la oferta</em></p>' +
          '<p class="voc-lectura">' + esc(v.lectura || '') + '</p>'
        : '<p class="voc-lectura">Sin masa comercial suficiente para asignarle una vocación al sector: ' +
          'la oferta instalada es demasiado escasa o demasiado repartida.</p>') +
      barras +
      ((c.top && c.top.length)
        ? '<p class="pie-nota">Los rubros que más pesan: ' +
          c.top.map(t => t.n + ' &times; ' + esc(t.nombre.toLowerCase())).join(', ') + '.</p>'
        : '') +
      '</div>';
  }

  function bloqueMapa(r, horizontal){
    // Apaisado 4:3 en vez de cuadrado: el mapa va en su propia columna y así
    // se come bastante menos alto de la hoja, que es lo que obliga al
    // auto-ajuste a encoger la letra. El círculo de radio se dimensiona con
    // el lado menor, así que se sigue viendo completo.
    //
    // El marco exterior existe para que la rejilla pueda estirarlo sin tocar
    // la caja de adentro. Todo lo que se dibuja encima del mapa se posiciona
    // en porcentaje del recuadro, así que si el recuadro cambiara de
    // proporción, el punto analizado y los POIs caerían corridos: era
    // exactamente lo que pasaba.
    const W = 800, H = 600;
    const z = calcZoom(r.meta.lat, r.meta.radioM, Math.min(W, H));
    const url = urlMapaEstatico(r.meta, W, H, z.z);
    const pctW = (z.radioPx / W * 200).toFixed(2), pctH = (z.radioPx / H * 200).toFixed(2);
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';
    return '<div class="mapa-marco"><div class="mapa-wrap">' +
      (url ? '<img class="mapa-img" src="' + url + '" alt="Mapa del entorno">' : '<div class="mapa-img mapa-vacio"></div>') +
      '<div class="mapa-radio" style="width:' + pctW + '%;height:' + pctH + '%"></div>' +
      puntosSobreMapa(r, z.mpp, W, H, 150) +
      hitosSobreMapa(r, z.mpp, W, H) +
      // Cruz + punto en el centro exacto: señala el lote sin que el rótulo
      // desplace la marca, que era el desfase que se veía en el PDF.
      '<div class="mapa-pin"><i class="cruz-h"></i><i class="cruz-v"></i>' +
        '<i class="punto"></i><b>PROYECTO</b></div>' +
      '<div class="mapa-tag">MAPA DEL ENTORNO</div>' +
      '<div class="mapa-escala">Radio · <b>' + radioTxt + '</b></div>' +
      '</div></div>';
  }

  // ── Bloques de contenido ────────────────────────────────────────────────
  function kpis(r){
    const s = r.stats;
    const item = (ico, val, lbl) => '<div class="kpi"><span>' + ico + '</span><b>' + numEs(val) + '</b><small>' + lbl + '</small></div>';
    // Con censo se muestran 6 KPI (entra estrato); sin censo, los 5 de siempre.
    const e = s.estrato;
    return '<div class="kpis' + (e ? ' kpis-6' : '') + '">' +
      item('👥', s.poblacionEstimada,
           s.poblacionEsCensal ? 'Habitantes · DANE 2018' : 'Población estimada') +
      (e ? item('🏷️', 'E' + e.predominante,
           e.minimo === e.maximo ? 'Estrato' : 'Estrato ' + e.minimo + '–' + e.maximo) : '') +
      item('📍', s.total, 'Usos identificados') +
      item('📐', s.densidadPorHa, 'Usos por hectárea') +
      item('🛣️', s.movilidad.nViasArterias, 'Vías arterias') +
      item('🚌', s.movilidad.paradasBus, 'Paradas transporte') +
      '</div>';
  }

  function datosGenerales(r){
    const fecha = new Date(r.meta.fechaISO).toLocaleString('es-CO', { dateStyle:'long', timeStyle:'short' });
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';
    const it = (ico, lbl, val) => '<div class="dg"><span>' + ico + '</span><div><b>' + lbl + '</b><p>' + numEs(val) + '</p></div></div>';
    return '<div class="datos-generales">' +
      it('🏢', 'Proyecto', esc(r.meta.proyectoNombre)) +
      it('📅', 'Fecha de análisis', esc(fecha)) +
      it('📍', 'Coordenadas', r.meta.lat.toFixed(6) + ', ' + r.meta.lng.toFixed(6)) +
      it('📋', 'Tipo de estudio', esc(NOMBRE_ESTUDIO[r.meta.tipoEstudio] || r.meta.tipoEstudio)) +
      it('⭕', 'Radio de análisis', radioTxt + ' (~' + numEs(r.stats.areaHa) + ' ha)') +
      (r.meta.direccionAprox ? it('🧭', 'Referencia', esc(r.meta.direccionAprox)) : '') +
      '</div>';
  }

  function tablaComposicion(r){
    const G = window.AIA_MOTOR.GRUPOS, C = window.AIA_MOTOR.GRUPO_COLOR, s = r.stats;
    const grupos = Object.keys(G).filter(g => (s.porGrupo[g] || 0) > 0)
      .sort((a, b) => s.porGrupo[b] - s.porGrupo[a]);
    const max = grupos.length ? s.porGrupo[grupos[0]] : 1;
    const filas = grupos.map(g => {
      const n = s.porGrupo[g], pct = (100 * n / Math.max(s.total, 1));
      return '<tr><td><i class="dot" style="background:' + C[g] + '"></i>' + esc(G[g].t) + '</td>' +
        '<td class="num">' + numEs(n) + '</td>' +
        '<td class="num">' + numEs(Math.round(pct * 10) / 10) + '%</td>' +
        '<td class="barra"><i style="width:' + (100 * n / max).toFixed(1) + '%;background:' + C[g] + '"></i></td></tr>';
    }).join('');
    return '<div class="bloque"><h2>Composición del entorno <em>(por número de usos)</em></h2>' + escalaAIA('composicion-tabla') +
      '<table class="tbl-comp"><thead><tr><th>Grupo de uso (Matriz URBIS)</th><th class="num">Usos</th><th class="num">%</th><th>Participación</th></tr></thead>' +
      '<tbody>' + filas + '</tbody>' +
      '<tfoot><tr><td>TOTAL</td><td class="num">' + numEs(s.total) + '</td><td class="num">100%</td><td></td></tr></tfoot></table></div>';
  }

  // Aro de progreso en SVG: se imprime nítido a cualquier tamaño y no depende
  // de Chart.js. Con r=15.9155 la circunferencia mide 100, así que el
  // stroke-dasharray se puede escribir directamente en puntos del score.
  function gaugeSVG(score, color){
    const R = 15.9155;
    return '<svg class="gauge" viewBox="0 0 40 40">' +
      '<circle cx="20" cy="20" r="' + R + '" fill="none" stroke="#e6eef5" stroke-width="4.2"/>' +
      '<circle cx="20" cy="20" r="' + R + '" fill="none" stroke="' + color + '" stroke-width="4.2" ' +
        'stroke-linecap="round" stroke-dasharray="' + score + ' ' + (100 - score) + '" ' +
        'transform="rotate(-90 20 20)"/>' +
      '<text x="20" y="19" text-anchor="middle" dominant-baseline="central" class="gauge-n" ' +
        'fill="' + color + '">' + numEs(score) + '</text>' +
      '<text x="20" y="26.5" text-anchor="middle" class="gauge-s">/100</text></svg>';
  }

  function bloqueViabilidad(r){
    if (!r.viabilidad) return '';
    const v = r.viabilidad;
    const vacia = capaVaciaAIA(r);
    if (vacia.length) return '<div class="bloque"><h2>Viabilidad del proyecto</h2>' +
      escalaAIA('viabilidad') +
      sinMedirAIA(vacia, 'el puntaje de viabilidad ni su nivel') + '</div>';
    const col = v.nivel === 'Alta' ? T.ok : (v.nivel === 'Media' ? T.warn : T.bad);
    let desglose = '';
    if (!v.subscores && r.desglosePorUso && r.desglosePorUso.length) {
      desglose = '<table class="tbl-mini">' + r.desglosePorUso.map(d => {
        const c2 = d.nivel === 'Alta' ? T.ok : (d.nivel === 'Media' ? T.warn : T.bad);
        return '<tr><td>' + d.icono + ' ' + esc(d.nombre) + '</td><td class="num" style="color:' + c2 + '"><b>' + numEs(d.score) + '</b></td><td>' + esc(d.nivel) + '</td></tr>';
      }).join('') + '</table>';
    } else if (v.subscores) {
      const N = { demanda:'Demanda', competencia:'Competencia', complementarios:'Complementarios', movilidad:'Movilidad', entorno:'Entorno' };
      desglose = '<table class="tbl-mini">' + Object.keys(v.subscores).map(k =>
        '<tr><td>' + N[k] + '</td><td class="barra"><i style="width:' + v.subscores[k] + '%;background:' + col + '"></i></td><td class="num">' + v.subscores[k] + '</td></tr>').join('') + '</table>';
    }
    // Las estrellas son el elemento protagonista: comunican mucho mejor la
    // oportunidad al cliente que un porcentaje. El puntaje sigue visible,
    // pero como respaldo del dato principal.
    const est = estrellasDeScore(v.score);
    const cg = r.compatibilidadGlobal;
    return '<div class="bloque"><h2>Viabilidad del proyecto <em>· qué tan bien encaja SU proyecto en este lote</em></h2>' + escalaAIA('viabilidad') +
      '<div class="hero">' +
        gaugeSVG(v.score, col) +
        '<div class="hero-est">' + estrellasHTML(est) + '</div>' +
        '<div class="hero-info"><b>' + est + ' de 5</b>' +
          '<span class="nivel" style="background:' + col + '">Viabilidad ' + esc(v.nivel) + '</span>' +
          '<em>' + numEs(v.score) + '/100 según el análisis del entorno</em></div>' +
      '</div>' +
      (cg ? '<div class="hero-compat"><span>Compatibilidad entre los usos del proyecto</span>' +
            '<b>' + estrellasHTML(cg.estrellas) + '</b><em>' + cg.estrellas + ' de 5</em></div>' : '') +
      '<ul class="args">' + v.argumentos.slice(0, 4).map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' +
      desglose + '</div>';
  }

  function bloqueRanking(r){
    if (!r.ranking || !r.ranking.length) return '';
    return '<div class="bloque"><h2>Usos recomendados para el lote</h2>' + escalaAIA('ranking') + '<table class="tbl-mini">' +
      r.ranking.map((it, i) => '<tr><td class="pos">' + (i + 1) + '</td><td>' + it.icono + ' ' + esc(it.nombre) + '</td>' +
        '<td class="num"><b>' + numEs(it.score) + '</b></td><td class="razon">' + esc(it.razon) + '</td></tr>').join('') +
      '</table></div>';
  }

  function bloqueUnidades(r){
    if (!r.recomendacionesUnidades || !r.recomendacionesUnidades.length) return '';
    return r.recomendacionesUnidades.map(g =>
      '<div class="bloque"><h2>Qué poner en sus ' + g.cantidad + ' unidad(es) de "' + esc(g.usoNombre) + '"</h2>' + escalaAIA('unidades') +
      '<table class="tbl-mini">' + g.opciones.map(o =>
        '<tr><td class="pos">' + o.unidadesSugeridas + '×</td><td>' + o.icono + ' ' + esc(o.nombre) + '</td><td class="num"><b>' + numEs(o.score) + '</b>/100</td></tr>').join('') +
      '</table></div>').join('');
  }

  function bloqueCompatibilidad(r){
    if (!r.compatibilidad || !r.compatibilidad.length) return '';
    return '<div class="bloque"><h2>Compatibilidad entre usos</h2>' + escalaAIA('compatibilidad') + '<table class="tbl-mini">' +
      r.compatibilidad.slice(0, 3).map(c => '<tr><td>' + c.iconoA + ' ' + esc(c.usoA) + ' + ' + c.iconoB + ' ' + esc(c.usoB) + '</td>' +
        '<td class="estrellas">' + '★'.repeat(c.estrellas) + '☆'.repeat(5 - c.estrellas) + '</td>' +
        '<td class="razon">' + esc(c.motivo) + '</td></tr>').join('') + '</table></div>';
  }

  function bloqueFoda(r){
    const f = r.foda || {};
    const caja = (t, ico, items, cls) => '<div class="foda ' + cls + '"><h3>' + ico + ' ' + t + '</h3><ul>' +
      ((items || []).length ? items.slice(0, 3).map(x => '<li>' + esc(x) + '</li>').join('') : '<li class="vacio">Sin hallazgos relevantes.</li>') + '</ul></div>';
    // Va a todo el ancho de la hoja en 4 columnas: los hallazgos ahora citan
    // lugares por su nombre y en columnas angostas se disparaban a 8 líneas,
    // que era lo que obligaba a encoger toda la hoja.
    return '<div class="bloque"><h2>Análisis FODA del entorno</h2>' + escalaAIA('foda') + '<div class="foda-grid4">' +
      caja('Fortalezas', '💪', f.fortalezas, 'f') + caja('Debilidades', '⚠️', f.debilidades, 'd') +
      caja('Oportunidades', '🚀', f.oportunidades, 'o') + caja('Riesgos', '🛑', f.riesgos, 'r') +
      '</div></div>';
  }

  // Movilidad y exposición vial. Se apoya solo en la jerarquía de la malla
  // vial de OpenStreetMap: mide visibilidad y acceso, NO conteos de tráfico
  // (esos requieren una fuente externa que hoy no tenemos).
  // ── Flujo peatonal y vehicular ──────────────────────────────────────────
  // El bloque que pide un café: cuánta gente pasa por la puerta, cómo llega y
  // a qué hora. Se declara sin rodeos que es potencial estimado de la
  // estructura urbana, no un aforo — quien lo lea tiene que saber qué compra.
  // Tránsito vehicular y combustible: dos magnitudes que se piden mucho para
  // leer el movimiento de una esquina. Se muestran como RANGOS porque no hay
  // aforo ni datos de ventas detrás, y el pie del bloque lo declara.
  /* El UNICO formateador de cifras del informe (v1042). En castellano el
     punto es el separador de MILES, asi que «5.00 km» se lee como cinco mil
     y «0.1 por hectarea» como un uno. `toLocaleString('es-CO')` resuelve las
     dos cosas de una vez —la coma decimal y el punto de miles—, y por eso el
     formateador es UNO y no dos: como se escribe un numero en castellano es
     un solo hecho, y dos copias se separan a la tanda siguiente (v879).

     Se llama `numEs` y no `miles` porque el nombre viejo decia la mitad: lo
     que hace es escribir un numero en castellano, no solo separarle los
     miles — y este informe se le entrega a un cliente. `cifra` no se podia
     usar: ya es la baldosa de KPI de este mismo archivo.

     Toma cadenas ademas de numeros porque varios sitios llegan con un
     `toFixed` ya hecho, y lo que no es un numero se devuelve tal cual: un
     guion o un «—» no puede convertirse en NaN.

     Y toma los DECIMALES como segundo argumento, para que nadie tenga que
     escribir `toFixed(2).replace('.', ',')` a un lado: esa forma era una de
     las tres copias que esta version retiro, y es la que se separa primero
     porque parece inofensiva. Con esto, «cuantos decimales» y «como se
     escribe un numero en castellano» siguen viviendo en el mismo sitio. */
  function numEs(n, dec){
    const x = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(x)) return String(n);
    return typeof dec === 'number'
      ? x.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec })
      : x.toLocaleString('es-CO');
  }
  function bloqueTrafico(f){
    const t = f.trafico;
    if (!t) return '';
    const filas = [];
    if (t.estimable) {
      filas.push('<div class="traf-fila"><span>🚗 Carros por día</span>' +
        '<b>' + numEs(t.carrosDiaMin) + '–' + numEs(t.carrosDiaMax) + '</b></div>' +
        '<p class="traf-pie">Por ' + esc(t.corredor.nombre) + ', vía ' + esc(t.corredor.jerarquia) +
        ' a ' + numEs(t.corredor.distM) + ' m.</p>');
    } else {
      filas.push('<div class="traf-fila"><span>🚗 Carros por día</span><b>—</b></div>' +
        '<p class="traf-pie">Sin vía arteria en el radio: no hay corredor del que estimarlo.</p>');
    }
    if (t.estaciones > 0) {
      filas.push('<div class="traf-fila"><span>⛽ Litros al mes</span>' +
        '<b>' + numEs(t.litrosMesMin) + '–' + numEs(t.litrosMesMax) + '</b></div>' +
        '<p class="traf-pie">' + numEs(t.estaciones) +
        (t.estaciones === 1 ? ' estación' : ' estaciones') + ' de servicio en el radio.</p>');
    } else {
      filas.push('<div class="traf-fila"><span>⛽ Litros al mes</span><b>—</b></div>' +
        '<p class="traf-pie">Sin estaciones de servicio en el radio.</p>');
    }
    return '<h3 class="flujo-h3">Tránsito y combustible</h3>' +
           '<div class="traf">' + filas.join('') + '</div>';
  }

  function bloqueFlujo(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    if (!f) return '';
    const col = v => v >= 70 ? T.ok : v >= 50 ? T.acento : v >= 30 ? T.warn : T.bad;
    const medidor = (etq, ico, v, nivel) =>
      '<div class="flujo-med"><div class="flujo-cab"><b>' + ico + ' ' + etq + '</b>' +
      '<span style="color:' + col(v) + '">' + numEs(v) + '/100 · ' + esc(nivel) + '</span></div>' +
      '<div class="flujo-barra"><i style="width:' + v + '%;background:' + col(v) + '"></i></div></div>';

    const franja = (etq, v) =>
      '<div class="flujo-hora"><small>' + etq + '</small>' +
      '<div class="flujo-barra alta"><i style="width:' + v + '%;background:' + T.acento + '"></i></div>' +
      '<b>' + numEs(v) + '</b></div>';

    const gen = (f.generadores || []).slice(0, 6);
    const tablaGen = gen.length
      ? '<table class="flujo-tabla"><tr><th>Qué trae gente a pie</th><th>Cant.</th><th>Aporte</th></tr>' +
        gen.map(g => '<tr><td>' + esc(g.nombre) +
                     // El nombre propio es lo que hace verificable el análisis:
                     // el lector puede ir a la esquina y comprobarlo.
                     ((g.ejemplos && g.ejemplos.length)
                        ? '<em class="gen-ej">' + esc(g.ejemplos.join(' · ')) + '</em>' : '') +
                     '</td><td class="n">' + numEs(g.n) + '</td>' +
                     '<td class="n">' + g.aporte + '</td></tr>').join('') + '</table>'
      : '<p class="flujo-vacio">No se identificaron generadores de peatones en el radio.</p>';

    // Hitos con nombre y distancia. El gimnasio va primero cuando existe: es
    // el que más cambia una acera —entra y sale gente a horas fijas, todos los
    // días— y por eso pesa tanto en la lectura del flujo.
    const hitos = (f.hitos || []).slice();
    const gimnasios = hitos.filter(h => h.sub === 'gimnasio');
    const ordenados = gimnasios.concat(hitos.filter(h => h.sub !== 'gimnasio')).slice(0, 5);
    const bloqueHitos = ordenados.length
      ? '<div class="hitos-lista">' + ordenados.map(h =>
          '<span class="hito-chip' + (h.sub === 'gimnasio' ? ' fuerte' : '') + '">' +
          (h.icono || '📍') + ' <b>' + esc(h.nombre) + '</b><em>' + numEs(h.distM) + ' m</em></span>').join('') +
        (gimnasios.length
          ? '<p class="hitos-nota"><b>' + esc(gimnasios[0].nombre) + '</b> a ' + gimnasios[0].distM +
            ' m concentra entradas y salidas a pie en horario fijo, mañana y final de la tarde: ' +
            'sube el tránsito de la acera justo en las franjas que un café de paso aprovecha.</p>'
          : '') +
        '</div>'
      : '';

    const lectura = f.dominante === 'ninguno'
      ? 'No pasa casi nadie, ni a pie ni en carro: aquí el negocio tendría que traer su propia clientela, no capturarla del flujo.'
      : f.dominante === 'peatonal'
      ? 'El entorno mueve más gente a pie que en carro: favorece formatos de paso, vitrina a la calle y estancia corta.'
      : f.dominante === 'vehicular'
        ? 'El entorno mueve más carro que peatón: sin parqueo resuelto, el flujo pasa de largo sin convertirse en cliente.'
        : 'El entorno reparte parejo entre peatón y carro: conviene resolver los dos accesos y no apostar a uno solo.';

    return '<div class="bloque ancho"><h2>Flujo peatonal y vehicular <em>· potencial estimado</em></h2>' + escalaAIA('flujo') +
      '<div class="flujo-grid">' +
        '<div>' +
          medidor('Flujo peatonal', '🚶', f.peatonal, f.nivelPeatonal) +
          medidor('Flujo vehicular', '🚗', f.vehicular, f.nivelVehicular) +
          '<p class="flujo-lectura">' + esc(lectura) + '</p>' +
          '<p class="flujo-lectura"><b>Hora fuerte: ' + esc(f.franjaFuerte) + '.</b> ' +
            (f.parqueaderos ? numEs(f.parqueaderos) + ' parqueadero' + (f.parqueaderos === 1 ? '' : 's') + ' en el radio.'
                            : 'Sin parqueaderos identificados en el radio.') + '</p>' +
        '</div>' +
        '<div>' + tablaGen +
          '<div class="flujo-horas">' +
            franja('Mañana', f.franjas.manana) +
            franja('Mediodía', f.franjas.mediodia) +
            franja('Tarde', f.franjas.tarde) +
          '</div>' +
        '</div>' +
        (bloqueHitos ? '<div><h3 class="flujo-h3">Hitos que mueven la acera</h3>' + bloqueHitos +
                       bloqueTrafico(f) + '</div>' : '<div>' + bloqueTrafico(f) + '</div>') +
      '</div>' +
      (f.avisoDatos ? '<p class="flujo-aviso">⚠️ ' + esc(f.avisoDatos) + '</p>' : '') +
      '<p class="pie-nota">Potencial de flujo estimado a partir de los usos del entorno y la malla vial. No es un aforo: no hay conteo de personas ni de vehículos. Los carros por día y los litros al mes son rangos de orden de magnitud según la jerarquía de la vía y el número de estaciones — no son mediciones ni cifras de ventas. Sirve para comparar ubicaciones entre sí y para dimensionar el formato, no para proyectar ventas.</p></div>';
  }

  function bloqueMovilidad(r){
    const m = r.stats.movilidad;
    const col = m.exposicion >= 70 ? T.ok : m.exposicion >= 50 ? T.acento : m.exposicion >= 30 ? T.warn : T.bad;
    const vias = (m.viasArterias || []).slice(0, 4);
    const maxD = Math.max(1, ...vias.map(v => v.distM));
    const barras = vias.map(v => {
      const pesoJer = { troncal: 100, principal: 85, secundaria: 65, colectora: 45 }[v.jerarquia] || 40;
      const colJ = pesoJer >= 85 ? '#075E88' : pesoJer >= 65 ? '#0E86BE' : CELESTE;
      return '<tr><td class="via-n">' + esc(v.nombre) + '<em>' + esc(v.jerarquia) + '</em></td>' +
        '<td class="barra"><i style="width:' + Math.max(8, 100 - (v.distM / maxD * 78)).toFixed(0) + '%;background:' + colJ + '"></i></td>' +
        '<td class="num">' + numEs(v.distM) + ' m</td></tr>';
    }).join('');
    return '<div class="bloque"><h2>Movilidad y exposición vial</h2>' + escalaAIA('movilidad') +
      '<div class="expo"><div class="expo-num" style="color:' + col + '">' + numEs(m.exposicion) + '<small>/100</small></div>' +
      '<div class="expo-info"><b style="background:' + col + '">Exposición ' + esc(m.nivelExposicion) + '</b>' +
      '<span>' + numEs(m.nViasArterias) + (m.nViasArterias === 1 ? ' corredor' : ' corredores') +
          ' · ' + numEs(m.paradasBus) + (m.paradasBus === 1 ? ' parada' : ' paradas') +
          ' · ' + numEs(m.ciclorrutas) + (m.ciclorrutas === 1 ? ' ciclorruta' : ' ciclorrutas') +
          '</span></div></div>' +
      (barras ? '<table class="tbl-vias">' + barras + '</table>' : '') +
      '<p class="expo-arg">' + esc(m.argumento) + '</p></div>';
  }

  // Indicadores urbanos (Fase 2): van en la columna que quedaba más corta,
  // que es justamente donde aparecían los espacios en blanco.
  function bloqueIndicadores(r){
    const i = r.indicadores;
    if (!i) return '';
    const colNivel = t => /muy alta|alto potencial|fuerte transformaci|riesgo bajo|alta actividad/i.test(t) ? T.ok
      : /(^|\s)alta|en transformaci|potencial medio|moderada|riesgo medio/i.test(t) ? T.acento
      : /media|en transici|riesgo alto|especializado/i.test(t) ? T.warn : T.bad;
    const fila = (etq, val, nivel) => '<tr><td class="ind-n">' + etq + '</td>' +
      '<td class="barra"><i style="width:' + val + '%;background:' + colNivel(nivel) + '"></i></td>' +
      '<td class="ind-v" style="color:' + colNivel(nivel) + '">' + esc(nivel) + '</td></tr>';
    const e = i.estrato;
    // El estrato va DENTRO del bloque de indicadores, arriba y con su franja
    // dorada: es dato censal, no estimación, y conviene que se distinga.
    const franjaEstrato = (e && e.disponible)
      ? '<div class="estrato-franja"><b>🏷️ Estrato ' + e.predominante +
        (e.homogeneo ? '' : ' <em>(' + e.minimo + '–' + e.maximo + ')</em>') + '</b>' +
        '<span>Censo DANE 2018</span></div>'
      : '';
    // Sexo y edad: barra de sexo + los dos tramos que más deciden el producto.
    const d = i.demografia;
    const bloqueDemo = (d && d.disponible)
      ? '<div class="demo-mini">' +
          '<div class="demo-bar"><i style="width:' + d.pctMujeres + '%;background:#e0559b"></i>' +
            '<i style="width:' + d.pctHombres + '%;background:#2b8fd6"></i></div>' +
          '<div class="demo-leg"><span><b style="background:#e0559b"></b>' + numEs(d.pctMujeres) + '% mujeres</span>' +
            '<span><b style="background:#2b8fd6"></b>' + numEs(d.pctHombres) + '% hombres</span>' +
            '<span class="demo-edad">' + numEs(d.pctNinos) + '% menores de 15 · ' + numEs(d.pctMayores) + '% de 65 o más</span></div>' +
        '</div>'
      : '';
    return '<div class="bloque"><h2>Indicadores urbanos</h2>' + escalaAIA('indicadores') + franjaEstrato + bloqueDemo +
      '<table class="tbl-ind">' +
      fila('Diversidad de usos', i.diversidad.valor, i.diversidad.nivel) +
      fila('Actividad comercial', Math.min(100, i.comercio.total * 2), i.comercio.nivel) +
      fila('Expansión (suelo libre)', i.expansion.valor, i.expansion.nivel) +
      fila('Transformación (obras)', i.transformacion.valor, i.transformacion.nivel) +
      fila('Riesgo urbano', i.riesgos.valor, i.riesgos.nivel) +
      '</table></div>';
  }

  // Comparativa multi-radio (Fase 3): cómo cambia el entorno según qué tan
  // lejos se mire. Responde la pregunta de si el lote está en el núcleo de
  // actividad o en su borde.
  function bloqueMultiRadio(r){
    const m = r.multiRadio;
    if (!m || !m.anillos || m.anillos.length < 2) return '';
    const etq = v => v >= 1000 ? (v / 1000) + ' km' : v + ' m';
    const filas = m.anillos.map(a =>
      '<tr' + (a.esAnalizado ? ' class="fila-act"' : '') + '><td class="ind-n">' + etq(a.radioM) +
      (a.esAnalizado ? ' •' : '') + '</td>' +
      '<td>' + numEs(a.total) + '</td><td>' + numEs(a.densidadPorHa) + '</td>' +
      '<td>' + numEs(a.comercio) + '</td><td>' + numEs(a.equipamientos) + '</td>' +
      '<td>' + numEs(a.poblacionEstimada) + '</td></tr>').join('');
    return '<div class="bloque"><h2>El entorno según la distancia <em>· mismo dato, varios radios</em></h2>' + escalaAIA('multi-radio') +
      '<table class="tbl-radios"><tr class="cab"><th>Radio</th><th>Usos</th><th>Usos/ha</th>' +
      '<th>Comercio</th><th>Equipam.</th><th>Hab. est.</th></tr>' + filas + '</table>' +
      '<p class="radio-lectura">' + esc(m.lectura) + '</p></div>';
  }

  function bloqueRecomendaciones(r){
    if (!r.recomendaciones || !r.recomendaciones.length) return '';
    return '<div class="bloque"><h2>Recomendaciones</h2>' + escalaAIA('recomendaciones') + '<ul class="recos">' +
      r.recomendaciones.slice(0, 4).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  }

  // Arma la fila descartando las columnas cuyos bloques salieron todos vacíos
  // y fijando la rejilla al número de columnas que de verdad se pintan, para
  // que las que quedan se repartan el ancho completo.
  function columnas(horizontal, grupos){
    const vivas = grupos
      .map(bloques => bloques.filter(Boolean).join(''))
      .filter(html => html.trim().length > 0);
    if (!vivas.length) return '';
    const n = Math.min(vivas.length, horizontal ? 3 : 2);
    return '<div class="fila fila-2" style="grid-template-columns:repeat(' + n + ',1fr)">' +
      vivas.map(h => '<div>' + h + '</div>').join('') + '</div>';
  }

  // ── A) INFORME EJECUTIVO — una sola hoja ────────────────────────────────
  // Veredicto de la página 1: el mismo dato de viabilidad que ya calcula el
  // motor, pero presentado en grande y explicado, para que el cliente entienda
  // qué está viendo sin que nadie se lo tenga que interpretar al lado.
  function bloqueVeredicto(r){
    const v = r.viabilidad;
    if (!v) return '';
    const col = v.nivel === 'Alta' ? T.ok : (v.nivel === 'Media' ? T.warn : T.bad);
    const est = estrellasDeScore(v.score);
    const lectura = v.nivel === 'Alta'
      ? 'El entorno reúne las condiciones para el proyecto propuesto: hay demanda que lo sostiene, ' +
        'usos complementarios alrededor y accesibilidad que respalda la operación.'
      : v.nivel === 'Media'
      ? 'El proyecto es defendible, pero su resultado dependerá de diferenciarse de la oferta ya ' +
        'instalada y de validar la demanda en campo antes de comprometer inversión.'
      : 'Las condiciones actuales del entorno no favorecen este uso en particular. Conviene revisar ' +
        'alternativas mejor calificadas o evaluar otro radio de influencia antes de descartar el lote.';
    // Aro grande: r=15.9155 hace que la circunferencia mida 100, así el
    // dasharray se escribe directamente en puntos del score.
    const gauge =
      '<svg class="gauge-xl" viewBox="0 0 42 42">' +
      '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + T.linea + '" stroke-width="4.6"/>' +
      '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + col + '" stroke-width="4.6" ' +
        'stroke-linecap="round" stroke-dasharray="' + v.score + ' ' + (100 - v.score) + '" ' +
        'transform="rotate(-90 21 21)"/>' +
      '<text x="21" y="20.6" text-anchor="middle" font-size="13" font-weight="900" fill="' + col + '">' + numEs(v.score) + '</text>' +
      '<text x="21" y="27" text-anchor="middle" font-size="3.3" font-weight="700" fill="' + T.txt3 + '">DE 100</text>' +
      '</svg>';
    return '<div class="veredicto">' +
      '<div class="ver-h"><b>VIABILIDAD DEL PROYECTO</b>' +
        '<span>' + esc(r.meta.proyectoNombre) + '</span></div>' +
      '<div class="ver-b">' + gauge +
        '<div class="ver-txt">' +
          '<div class="estrellas-xl">' + estrellasHTML(est) + '</div>' +
          '<span class="nivel-xl" style="color:' + col + '">Viabilidad ' + esc(v.nivel) + '</span>' +
          '<span class="frase-xl">' + est + ' de 5 estrellas. ' + lectura + '</span>' +
        '</div>' +
      '</div></div>';
  }

  // Qué significa cada indicador, en una línea. Es lo que convierte la página 1
  // en algo que el cliente puede leer solo, sin que nadie se lo explique.
  function bloqueGuia(r){
    const i = r.indicadores || {};
    const filas = [
      ['⭐ Viabilidad', 'Qué tan bien encaja SU proyecto en este lote concreto.'],
      ['🏆 Oportunidad urbana', 'Qué tan buen sitio es el lote, sin importar qué se construya.'],
      ['👥 Población', r.stats.poblacionEsCensal
        ? 'Habitantes reales del área según el Censo DANE, no una estimación.'
        : 'Habitantes estimados en el área de influencia.'],
      ['🛣️ Exposición vial', 'Cuánta visibilidad y acceso da la malla vial cercana.']
    ];
    if (i.estrato && i.estrato.disponible) {
      filas.push(['🏷️ Estrato', 'Capacidad de compra del sector: define el producto y el precio.']);
    }
    if (i.demografia && i.demografia.disponible) {
      filas.push(['📊 Edad y sexo', 'Quién vive alrededor: orienta qué tipo de oferta tiene demanda.']);
    }
    return '<div class="bloque"><h2>Cómo leer este informe</h2>' + escalaAIA('guia') + '<div class="guia">' +
      filas.map(f => '<div><b>' + f[0] + '</b><small>' + f[1] + '</small></div>').join('') +
      '</div></div>';
  }


  // ══ DIAGRAMACIÓN EN TRES HOJAS ══════════════════════════════════════════
  //
  // El informe pasó de dos hojas apretadas a tres con hilo narrativo. Cada
  // sección va numerada y con un subtítulo que dice PARA QUÉ sirve, de modo
  // que el documento se lea solo, sin que nadie tenga que interpretarlo al
  // lado del cliente. El orden es el de una conversación: primero la
  // conclusión, después los datos que la sostienen, y al final el FODA con el
  // siguiente paso.

  /* `n` en cero o vacío imprime el título sin numerar: la hoja de método no
     es una sección más del análisis y numerarla «0.» se lee como un error. */
  function seccion(n, titulo, sub){
    return '<div class="sec"><b>' + (n ? n + '. ' : '') + esc(titulo) + '</b>' +
           (sub ? '<em>' + esc(sub) + '</em>' : '') + '</div>';
  }

  // Aro de progreso grande. Va en su propia caja de tamaño fijo: si se dejara
  // fluir, cualquier elemento vecino de ancho completo —una barra, por
  // ejemplo— le pasaba por encima.
  function aroXL(score, color, etq){
    return '<div class="aro-caja"><svg class="aro" viewBox="0 0 42 42">' +
      '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + T.linea + '" stroke-width="4.6"/>' +
      '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + color + '" stroke-width="4.6" ' +
        'stroke-linecap="round" stroke-dasharray="' + score + ' ' + (100 - score) + '" ' +
        'transform="rotate(-90 21 21)"/>' +
      '<text x="21" y="20.4" text-anchor="middle" font-size="12.5" font-weight="900" fill="' + color + '">' + numEs(score) + '</text>' +
      '<text x="21" y="27" text-anchor="middle" font-size="3.2" font-weight="700" fill="' + T.txt3 + '">' +
        (etq || 'DE 100') + '</text></svg></div>';
  }

  // Distingue lo que se VIO en el mapa de lo que el formato IMPLICA. En el
  // mapa abierto casi nadie dibuja el patio de un D1 o de una estación de
  // servicio, así que decir "no hay parqueadero" era falso en la calle.
  function textoParqueo(f){
    if (!f) return '';
    if (f.parqueaderos > 0) {
      return numEs(f.parqueaderos) + (f.parqueaderos === 1 ? ' parqueadero mapeado' : ' parqueaderos mapeados') +
        ' en el radio' + (f.parqueoProbable && f.parqueoProbable.length
          ? ', más formatos que suelen traer el suyo.' : '.');
    }
    if (f.parqueoProbable && f.parqueoProbable.length) {
      return 'Sin parqueadero mapeado, pero hay ' +
        f.parqueoProbable.slice(0, 3).map(q => q.nombre.toLowerCase()).join(', ') +
        ': formatos que normalmente traen el suyo.';
    }
    return 'Sin parqueadero mapeado ni formatos que suelan traer el suyo.';
  }

  function colFlujo(v){ return v >= 70 ? T.ok : v >= 50 ? T.acento : v >= 30 ? T.warn : T.bad; }

  /* ── El discriminante de la v875 en el informe de empresas (v1044) ───────
     «Cero mapeado» y «cero existente» son cosas distintas, y el score de
     viabilidad las juntaba: con el radio sin un solo uso registrado, las
     cinco dimensiones del puntaje se calculan sobre una capa vacía y el
     informe publicaba igual un número, un nivel y una recomendación de
     inversión —«El entorno reúne condiciones favorables», «Conviene revisar
     alternativas antes de descartar el lote»—. Es la misma forma que el
     pliego educativo encontró en la v875 y llamó «el error más grave de la
     lámina»: la cifra es defendible una por una y la conclusión no.

     El módulo YA sabía hacerlo en un sitio: «Competencia directa (0)» dice
     desde antes que «el mapa abierto no lo ve todo: conviene confirmarlo en
     campo antes de darlo por bueno». Lo que faltaba es que esa lectura
     llegara a los paneles que publican el juicio.

     Las tres capas son las que el resultado deja contar, y el discriminante
     de cada una es cuántos puntos de esa clase hay MAPEADOS —igual que
     `categorias[].puntos` en la v875—:

       usos         `stats.total` en cero: no hay nada sobre qué medir.
       locales      `stats.porGrupo.comercio` en cero: sin un solo local
                    mapeado, «complementarios» y «entorno» miden el vacío.
       competidores `viabilidad.nCompetidores` en cero Y sin comercio
                    mapeado. El par es lo que lo hace honesto: cero
                    competidores con doscientos locales a la vista SÍ es un
                    hallazgo —y el panel de competencia ya lo dice así—;
                    cero competidores sin un solo local es una capa vacía.

     CERO es cero y AUSENTE no es cero: un campo que el resultado no trae no
     dispara nada. Afirmar que la capa está vacía porque no se pudo leer
     sería la misma confusión, en la otra dirección. */
  function capaVaciaAIA(r){
    const s = r.stats || {}, v = r.viabilidad || {};
    const total = Number(s.total);
    const comercio = Number((s.porGrupo || {}).comercio);
    const nComp = Number(v.nCompetidores);
    const faltan = [];
    if (total === 0) faltan.push('usos registrados');
    if (comercio === 0) faltan.push('locales de comercio');
    if (nComp === 0 && comercio === 0) faltan.push('competidores identificables');
    return faltan;
  }
  /* Una sola redacción para los cuatro paneles que dejan de publicar: con
     cuatro, la que se quedara vieja sería la que nadie vuelve a mirar
     (v879). Dice qué falta y CÓMO se llena —un vacío que no dice cómo se
     resuelve es la mitad del trabajo (v880)—. */
  function sinMedirAIA(faltan, queNoSePublica){
    return '<div class="aia-sinmedir">' +
      '<b>SIN MEDIR</b>' +
      '<p>No se publica ' + queNoSePublica + ': dentro del radio no hay ' +
        esc(faltan.join(', ni ')) + ' en OpenStreetMap, así que lo que se calcularía ' +
        'no mide el entorno, mide una capa vacía. Cero usos mapeados y cero usos ' +
        'existentes no son lo mismo.</p>' +
      '<p class="aia-sinmedir-como">Cómo se llena: mapear el radio en OpenStreetMap ' +
        '—cualquiera puede—, o recorrerlo en campo y registrar lo que hay. Con la capa ' +
        'puesta, el puntaje se calcula solo.</p>' +
      '</div>';
  }

  // ── 1. Lectura ejecutiva ────────────────────────────────────────────────
  function bloqueEjecutivo(r){
    const v = r.viabilidad;
    if (!v) return bloqueRanking(r);
    /* El discriminante de la v875: con la capa vacía no se publica ni el
       puntaje ni la lectura, que es una recomendación de inversión. */
    const vacia = capaVaciaAIA(r);
    if (vacia.length) return '<div class="ejec ejec-sinmedir">' +
      '<div class="ejec-txt"><b class="ejec-rot">VIABILIDAD DEL PROYECTO</b>' +
      sinMedirAIA(vacia, 'el puntaje de viabilidad ni la lectura del entorno') +
      '</div></div>';
    const col = v.nivel === 'Alta' ? T.ok : (v.nivel === 'Media' ? T.warn : T.bad);
    const est = estrellasDeScore(v.score);
    const lectura = v.nivel === 'Alta'
      ? 'El entorno reúne condiciones favorables para el proyecto: existe demanda poblacional, usos ' +
        'complementarios y accesibilidad que respalda la operación.'
      : v.nivel === 'Media'
      ? 'El proyecto es defendible, pero su resultado dependerá de diferenciarse de la oferta ya ' +
        'instalada y de validar la demanda en campo antes de comprometer inversión.'
      : 'Las condiciones actuales del entorno no favorecen este uso en particular. Conviene revisar ' +
        'alternativas mejor calificadas o evaluar otro radio antes de descartar el lote.';
    return '<div class="ejec">' + aroXL(v.score, col) +
      '<div class="ejec-txt">' +
        '<b class="ejec-rot">VIABILIDAD DEL PROYECTO</b>' +
        '<span class="ejec-nivel" style="color:' + col + '">' + esc(v.nivel) + '</span>' +
        '<div class="ejec-est">' + estrellasHTML(est) + '</div>' +
        '<p class="ejec-frase">' + esc(lectura) + '</p>' +
      '</div>' +
      '<div class="ejec-chips">' +
        '<span class="chip" style="background:' + col + '">' + numEs(v.score) + ' / 100</span>' +
        '<span class="chip chip-oro">' + est + ' de 5 &#9733;</span>' +
      '</div></div>';
  }

  // ── Crecimiento de la población ─────────────────────────────────────────
  // El censo es de 2018 y el informe lo presentaba como si fuera de hoy. Aquí
  // se muestran las dos cifras juntas —lo contado y lo proyectado— y la curva
  // entre ambas. Se dibuja en SVG y no como imagen: el PDF lo imprime nítido
  // a cualquier tamaño y no depende de que un lienzo se haya renderizado.
  function bloquePoblacion(r){
    const s = r.stats;
    if (!s.poblacionProyectada || !(s.serieProyeccion || []).length) return '';
    const serie = s.serieProyeccion;
    const min = Math.min.apply(null, serie.map(x => x.poblacion));
    const max = Math.max.apply(null, serie.map(x => x.poblacion));
    const rango = Math.max(1, max - min);
    const W = 100, H = 30;
    const px = i => (i / (serie.length - 1)) * W;
    const py = v => H - ((v - min) / rango) * (H - 4) - 2;
    const iFut = serie.findIndex(x => x.futuro);
    const corte = iFut > 0 ? iFut - 1 : serie.length - 1;
    const hasta = serie.slice(0, corte + 1)
      .map((x, i) => (i ? 'L' : 'M') + px(i).toFixed(2) + ' ' + py(x.poblacion).toFixed(2)).join(' ');
    const todo = serie
      .map((x, i) => (i ? 'L' : 'M') + px(i).toFixed(2) + ' ' + py(x.poblacion).toFixed(2)).join(' ');
    const area = hasta + ' L' + px(corte).toFixed(2) + ' ' + H + ' L0 ' + H + ' Z';
    const hoy = serie[corte];
    return '<div class="tarjeta pobl">' +
      '<h2>Cómo ha crecido la población</h2>' + escalaAIA('poblacion') +
      '<div class="pobl-cifras">' +
        '<div><small>Censo ' + s.censoAnio + '</small><b>' +
          numEs(s.poblacionCenso) + '</b><em>contado</em></div>' +
        '<div class="fl">&rarr;</div>' +
        '<div><small>' + s.anioProyeccion + '</small><b style="color:' + T.acento + '">' +
          numEs(s.poblacionProyectada) + '</b><em>proyectado</em></div>' +
        '<div class="delta">+' + numEs(s.crecimientoPct) + '%</div>' +
      '</div>' +
      '<svg class="pobl-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
        '<path d="' + area + '" fill="' + T.acento + '22"/>' +
        '<path d="' + todo + '" fill="none" stroke="' + T.acento + '" stroke-width="1" ' +
          'stroke-dasharray="3 2" opacity=".5" vector-effect="non-scaling-stroke"/>' +
        '<path d="' + hasta + '" fill="none" stroke="' + T.acento + '" stroke-width="1.2" ' +
          'vector-effect="non-scaling-stroke"/>' +
      '</svg>' +
      '<div class="pobl-eje"><span>' + serie[0].anio + '</span><span>' + hoy.anio +
        '</span><span>' + serie[serie.length - 1].anio + '</span></div>' +
      '<p class="pie-nota">Crece ' + numEs(s.tasaAnualDane * 100, 2) +
        '% al año según la serie de proyecciones municipales del DANE; el tramo punteado va ' +
        'hacia adelante. ' + esc(s.advertenciaProyeccion || '') + '</p>' +
      '</div>';
  }

  // ── El radio de importancia y quién compite ─────────────────────────────
  // Un radio de 1 km no es una bolsa donde todo pesa igual, y "3 competidores"
  // obliga a salir a buscarlos. Las dos cosas van juntas porque responden la
  // misma pregunta del cliente: ¿con qué me estoy midiendo, y a qué distancia?
  function bloqueAnillosComp(r){
    const s = r.stats, v = r.viabilidad;
    const an = s.anillos || [];
    if (!an.length && !(v && v.nCompetidores != null)) return '';
    const max = Math.max.apply(null, an.map(x => x.peso).concat([1]));
    const filas = an.map(x =>
      '<div class="anillo"><span>' + x.etiqueta + '</span>' +
      '<div class="comp-barra"><i style="width:' + Math.round(100 * x.peso / max) +
        '%;background:' + T.acento + '"></i></div>' +
      '<b>' + numEs(x.peso) + '%</b></div>' +
      '<p class="anillo-ej">' + x.n + (x.n === 1 ? ' uso' : ' usos') + ' · ' + x.comercios + ' de comercio' +
      (x.ejemplos.length ? ' — ' + esc(x.ejemplos.map(e => e.nombre + ' (' + numEs(e.distM) + ' m)').join(', ')) : '') +
      '</p>').join('');
    const nuc = (s.nucleos || [])[0];
    const lista = (v && v.competidores) || [];
    const anon = (v && v.competidoresSinNombre) || 0;
    return '<div class="fila dos">' +
      '<div class="tarjeta"><h2>Radio de importancia</h2>' + escalaAIA('anillos') +
        '<p class="pie-nota">Cuánto de la influencia sobre el lote viene de cada distancia. ' +
        'Lo de cerca pesa más: no es lo mismo un supermercado a 100 m que a 900 m.</p>' +
        filas +
        (nuc ? '<p class="nucleo">La concentración comercial que más interviene: <b>' + numEs(nuc.n) +
               (nuc.n === 1 ? ' local' : ' locales') + ' a ~' + numEs(nuc.distM) + ' m</b>, sobre todo de ' +
               esc(nuc.rubroDominante.toLowerCase()) + '.' +
               (nuc.nombres.length ? ' Por ejemplo: ' + esc(nuc.nombres.join(', ')) + '.' : '') + '</p>'
             : '') +
      '</div>' +
      '<div class="tarjeta"><h2>Competencia directa' +
        (v && v.nCompetidores != null ? ' (' + numEs(v.nCompetidores) + ')' : '') + '</h2>' + escalaAIA('competencia') +
        (v && v.nCompetidores === 0
          ? '<p class="pie-nota">No se identificó competencia directa en el radio. El mapa abierto ' +
            'no lo ve todo: conviene confirmarlo en campo antes de darlo por bueno.</p>'
          : (lista.length
              ? '<table class="tbl-gente"><tr><th>Establecimiento</th><th class="n">Dist.</th></tr>' +
                lista.map(c => '<tr><td>' + esc(c.nombre) + '<em>' + esc(c.rubro) + '</em></td>' +
                  '<td class="n">' + numEs(c.distM) + ' m</td></tr>').join('') + '</table>'
              : '') +
            (anon ? '<p class="pie-nota">' + numEs(anon) +
                    (anon === 1 ? ' competidor más figura en el mapa sin nombre'
                                : ' competidores más figuran en el mapa sin nombre') +
                    ': cuentan igual en el puntaje, pero no se pueden citar.</p>' : '')) +
      '</div>' +
      '</div>';
  }

  // ── 2. Los seis datos que explican el sitio ─────────────────────────────
  /* `edu` decide si van las referencias. No se mira `r.referencias` a secas:
     el mismo resultado puede exportarse en los dos informes, y entonces la
     comparación contra el archivo del analista se colaría en el que va al
     cliente. Quién puede verla es una decisión del informe, no del dato. */
  function seisDatos(r, edu){
    const s = r.stats, f = (s.movilidad && s.movilidad.flujo) || {};
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';
    const cajas = [
      { n: numEs(s.poblacionEstimada), t: 'Habitantes',
        // Con proyección, la cifra es la de HOY y hay que decirlo: presentar
        // un dato de 2018 como si fuera actual subestima la demanda.
        s: s.poblacionProyectada
             ? 'DANE ' + s.censoAnio + ' proyectado a ' + s.anioProyeccion
             : (s.poblacionEsCensal ? 'DANE ' + s.censoAnio : 'estimación URBIS'),
        c: T.acento },
      { n: (f.peatonal || 0) + ' / 100', t: 'Flujo peatonal',
        s: f.nivelPeatonal || '—', c: colFlujo(f.peatonal || 0) },
      { n: (f.vehicular || 0) + ' / 100', t: 'Flujo vehicular',
        s: f.nivelVehicular || '—', c: colFlujo(f.vehicular || 0) },
      { n: numEs(s.total), t: 'Usos identificados',
        s: 'en ' + radioTxt, c: T.acento },
      { n: s.movilidad.nViasArterias, t: 'Vías arterias',
        s: 'en el radio', c: s.movilidad.nViasArterias > 0 ? T.acento : T.bad },
      // Cero paradas es un hallazgo, no un hueco: se pinta en rojo a propósito.
      { n: s.movilidad.paradasBus, t: 'Paradas de transporte',
        s: 'identificadas', c: s.movilidad.paradasBus > 0 ? T.acento : T.bad }
    ];
    /* La referencia contra los sectores que el curso ya levantó, cuando el
       informe es el del curso y hay al menos tres con qué comparar. Un
       «18/100 de flujo» solo no le dice nada a un estudiante: no sabe si 18
       es poco o es lo normal en su ciudad. */
    const refs = edu ? (r.referencias || null) : null;
    return '<div class="seis">' + cajas.map(c => {
      const ref = refs ? refs[c.t] : '';
      return '<div class="dato"><b style="color:' + c.c + '">' + numEs(c.n) + '</b>' +
        '<span>' + esc(c.t) + '</span><small>' + esc(c.s) + '</small>' +
        (ref ? '<i class="dato-ref">' + esc(ref) + '</i>' : '') + '</div>';
    }).join('') + '</div>';
  }

  // ── 3. Oportunidad urbana ───────────────────────────────────────────────
  // El aro y la lista van en filas SEPARADAS. Antes compartían caja con un
  // elemento de ancho completo y la barra terminaba cruzando el aro por la
  // mitad: es exactamente el defecto que hay que no repetir.
  function bloqueOportunidad(r){
    const i = r.indicadores;
    if (!i) return '';
    /* El mismo molde, dos paneles más abajo: «+8 potencial · hoy hay 0» sobre
       una capa vacía convierte «nadie lo mapeó» en «falta de todo». Se incluye
       porque dejarlo sería publicar el defecto que el panel de al lado acaba
       de dejar de publicar, que es la razón por la que la v875 no arregló solo
       los tres sitios que su pliego nombraba. */
    const vacia = capaVaciaAIA(r);
    if (vacia.length) return '<div class="tarjeta"><h2>Oportunidad urbana</h2>' +
      escalaAIA('oportunidad') +
      sinMedirAIA(vacia, 'el puntaje de oportunidad ni los usos que faltarían') + '</div>';
    const so = i.scoreOportunidad;
    const col = so.valor >= 75 ? T.ok : so.valor >= 60 ? T.acento : so.valor >= 45 ? T.warn : T.bad;
    const est = estrellasDeScore(so.valor);
    const opos = (i.oportunidades.lista || []).slice(0, 3);
    return '<div class="tarjeta"><h2>Oportunidad urbana</h2>' + escalaAIA('oportunidad') +
      '<div class="oport-cab">' + aroXL(so.valor, col, '/100') +
        '<div><span class="oport-nivel" style="color:' + col + '">' + esc(so.nivel) + '</span>' +
        '<div class="oport-est">' + estrellasHTML(est) + '</div></div>' +
      '</div>' +
      (opos.length ? '<table class="tbl-oport">' + opos.map(o =>
        '<tr><td class="pos">+' + o.potencial + '</td><td>' + esc(o.nombre) + '</td>' +
        '<td class="razon">hoy hay ' + o.existentes + '</td></tr>').join('') + '</table>' : '') +
      '<p class="nota-pie">La oportunidad mide la calidad del sitio, independientemente del proyecto que se construya.</p>' +
      '</div>';
  }

  // ── 3. Cómo leer el informe ─────────────────────────────────────────────
  function bloqueComoLeer(r){
    const i = r.indicadores || {};
    const filas = [
      ['Viabilidad', 'qué tan bien encaja SU proyecto en este lote.'],
      ['Exposición vial', 'visibilidad y acceso que aporta la malla vial cercana.'],
      ['Oportunidad urbana', 'qué tan buen sitio es el lote, sin importar qué se construya.'],
      ['Estrato', 'capacidad de compra del sector; orienta producto y precio.'],
      ['Población', r.stats.poblacionProyectada
        ? 'lo que contó el DANE en ' + r.stats.censoAnio + ', traído a ' +
          r.stats.anioProyeccion + ' con la tasa de crecimiento del municipio.'
        : (r.stats.poblacionEsCensal
            ? 'habitantes reales del área según DANE, no una estimación.'
            : 'habitantes estimados en el área de influencia.')],
      ['Edad y sexo', 'quién vive alrededor; orienta la demanda.']
    ];
    if (!(i.estrato && i.estrato.disponible)) filas.splice(3, 1);
    if (!(i.demografia && i.demografia.disponible)) {
      const k = filas.findIndex(f => f[0] === 'Edad y sexo');
      if (k >= 0) filas.splice(k, 1);
    }
    return '<div class="tarjeta"><h2>Cómo leer el informe</h2>' + escalaAIA('como-leer') + '<div class="leer">' +
      filas.map(f => '<div><b>' + esc(f[0]) + '</b><small>' + esc(f[1]) + '</small></div>').join('') +
      '</div></div>';
  }

  // ── 4. Lo más importante para el cliente ────────────────────────────────
  function bloqueClave(r){
    const s = r.stats, m = s.movilidad, f = m.flujo || {};
    const barra = (etq, val, nivel) =>
      '<div class="cl-flujo"><div class="cl-cab"><b>' + etq + '</b>' +
      '<span style="color:' + colFlujo(val) + '">' + numEs(val) + ' / 100 · ' + esc(nivel || '—') + '</span></div>' +
      '<div class="cl-barra"><i style="width:' + val + '%;background:' + colFlujo(val) + '"></i></div></div>';
    const lectura = f.dominante === 'ninguno'
      ? 'No pasa casi nadie, ni a pie ni en carro. El negocio tendría que traer su propia clientela, no capturarla del flujo.'
      : f.dominante === 'peatonal'
      ? 'El entorno mueve más gente a pie que en carro. Favorece formatos de paso, vitrina a la calle y estancia corta.'
      : f.dominante === 'vehicular'
      ? 'El entorno mueve más carro que peatón. Sin parqueo resuelto, el flujo puede pasar de largo sin convertirse en cliente.'
      : 'El entorno reparte parejo entre peatón y carro. Conviene resolver los dos accesos y no apostar a uno solo.';
    const via = (m.viasArterias || [])[0];
    /* «Diferenciarse de la competencia ya instalada» es una recomendación
       sobre una competencia que, con la capa vacía, nadie midió. Va primero
       porque es la que puede ser falsa; las otras dos ramas se sostienen
       igual (v875). */
    const vaciaClave = capaVaciaAIA(r);
    const reto = vaciaClave.length
      ? 'No se puede nombrar el reto: dentro del radio no hay ' + vaciaClave.join(', ni ') +
        ' en el mapa abierto, así que no hay competencia medida con la que compararse.'
      : !f.hayDondeParar
      ? 'No hay parqueadero mapeado ni formatos que suelan traer el suyo: el flujo pasa de largo.'
      : f.avisoDatos
      ? 'La zona está poco mapeada: el flujo real puede ser mayor que el estimado.'
      : 'Diferenciarse de la competencia ya instalada en el radio.';
    // Dónde pararse dentro del radio: es una decisión distinta de si la zona
    // sirve, y para un formato de paso pesa más que el promedio del sector.
    const consejo = f.consejoUbicacion
      ? '<div class="cl-donde"><b>DÓNDE UBICARSE</b><p>' + esc(f.consejoUbicacion) + '</p></div>' : '';
    return '<div class="clave">' +
      '<div class="cl-col">' + barra('FLUJO PEATONAL', f.peatonal || 0, f.nivelPeatonal) +
        barra('FLUJO VEHICULAR', f.vehicular || 0, f.nivelVehicular) + '</div>' +
      '<div class="cl-lectura"><b>LECTURA CLAVE</b><p>' + esc(lectura) + '</p>' + consejo + '</div>' +
      '<div class="cl-minis">' +
        '<div><b>DEMANDA</b><small>' + numEs(s.poblacionEstimada) +
          (s.poblacionEstimada === 1 ? ' habitante' : ' habitantes') +
            ' en el área de influencia.</small></div>' +
        '<div><b>VISIBILIDAD</b><small>Exposición vial ' + esc((m.nivelExposicion || '').toLowerCase()) +
          (via ? '; ' + esc(via.nombre) + ' a ' + numEs(via.distM) + ' m.' : '.') + '</small></div>' +
        '<div><b>DÓNDE PARAR</b><small>' + esc(textoParqueo(f)) + '</small></div>' +
        '<div><b>RETO</b><small>' + esc(reto) + '</small></div>' +
      '</div></div>';
  }

  // ── 5. Viabilidad en detalle ────────────────────────────────────────────
  function bloqueViabilidadDetalle(r){
    const v = r.viabilidad;
    if (!v) return '';
    const vacia = capaVaciaAIA(r);
    if (vacia.length) return '<div class="tarjeta"><h2>Viabilidad</h2>' +
      escalaAIA('viabilidad-detalle') +
      sinMedirAIA(vacia, 'el puntaje ni sus cinco dimensiones') + '</div>';
    const col = v.nivel === 'Alta' ? T.ok : (v.nivel === 'Media' ? T.warn : T.bad);
    const est = estrellasDeScore(v.score);
    const N = { demanda:'Demanda', competencia:'Competencia', complementarios:'Complementarios',
                movilidad:'Movilidad', entorno:'Entorno' };
    let filas = '', mejor = null, peor = null;
    if (v.subscores) {
      const claves = Object.keys(v.subscores);
      claves.forEach(k => {
        const val = v.subscores[k];
        if (!mejor || val > v.subscores[mejor]) mejor = k;
        if (!peor || val < v.subscores[peor]) peor = k;
      });
      // El número va FUERA de la barra, en su propia columna: dentro se lo
      // comía el relleno cuando la barra llegaba al 100 %.
      filas = claves.map(k =>
        '<div class="sub-fila"><span>' + N[k] + '</span>' +
        '<div class="sub-barra"><i style="width:' + v.subscores[k] + '%;background:' +
          (v.subscores[k] >= 60 ? T.ok : v.subscores[k] >= 40 ? T.warn : T.bad) + '"></i></div>' +
        '<b>' + numEs(v.subscores[k]) + '</b></div>').join('');
    }
    const caja = (mejor && peor && mejor !== peor)
      ? '<div class="sub-resumen">' +
          '<div><b class="et-ok">FORTALEZA</b><span>' + N[mejor] + ' ' + numEs(v.subscores[mejor]) + '/100</span></div>' +
          '<div><b class="et-bad">RETO</b><span>' + N[peor] + ' ' + numEs(v.subscores[peor]) + '/100</span></div>' +
        '</div>'
      : '';
    return '<div class="tarjeta"><h2>Viabilidad &middot; ' + numEs(v.score) + ' / 100</h2>' + escalaAIA('viabilidad-detalle') +
      '<p class="sub-nivel" style="color:' + col + '">' + est + ' de 5 &#9733; &middot; Viabilidad ' + esc(v.nivel) + '</p>' +
      '<p class="nota-pie">La puntuación se construye con cinco dimensiones del entorno.</p>' +
      filas + caja + '</div>';
  }

  // ── 6. Qué trae gente a pie ─────────────────────────────────────────────
  function bloqueTraeGente(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    if (!f) return '';
    // Ocho filas y no seis: al abrir la matriz en rubros aparecieron más tipos
    // de generador, y con seis se quedaba fuera justamente el gimnasio —el
    // hito que se pidió resaltar—. La tabla cabe: el aro de más se compensa
    // recortando el aire, no la información.
    const gen = (f.generadores || []).slice(0, 8);
    const filas = gen.length
      ? '<table class="tbl-gente"><tr><th>Uso / ejemplos</th><th class="n">Cant.</th><th class="n">Aporte</th></tr>' +
        gen.map(g => '<tr><td>' + esc(g.nombre) +
          ((g.ejemplos && g.ejemplos.length) ? '<em>' + esc(g.ejemplos.join(' &middot; ')) + '</em>' : '') +
          '</td><td class="n">' + numEs(g.n) + '</td><td class="n">' + numEs(g.aporte) + '</td></tr>').join('') + '</table>'
      : '<p class="nota-pie">No se identificaron generadores de peatones en el radio.</p>';
    // Lo que RESTA. Un informe que solo suma miente por omisión: el tramo de
    // bodegas o los tres locales cerrados con reja son lo que corta el
    // recorrido a pie, y quien va a poner un local necesita verlo.
    const pen = (f.penalizadores || []).slice(0, 4);
    const resta = pen.length
      ? '<div class="resta"><h3>Lo que rompe el recorrido a pie</h3>' +
        pen.map(pp => '<div class="resta-fila"><span>' + esc(pp.nombre) +
          ' <em>&middot; ' + esc(pp.motivo) + '</em></span><b>&minus;' + pp.resta +
          ' (' + numEs(pp.n) + ')</b></div>').join('') +
        '<p class="pie-nota">Descuenta ' + (f.restaPeaton || 0) + ' de ' + (f.sumaBruta || 0) +
        ((f.sumaBruta || 0) === 1 ? ' punto bruto' : ' puntos brutos') +
        ' de atracción peatonal.</p></div>'
      : '<div class="resta"><h3>Lo que rompe el recorrido a pie</h3>' +
        '<p class="pie-nota">No se detectaron frentes muertos (bodegas, lotes encerrados, ' +
        'locales desocupados o ruinas) en el radio: la continuidad del andén no tiene cortes visibles.</p></div>';
    const hora = (etq, val) =>
      '<div class="hf"><span>' + etq + '</span><div class="cl-barra"><i style="width:' + val +
      '%;background:' + T.acento + '"></i></div><b>' + numEs(val) + '</b></div>';
    // El gimnasio va primero y resaltado: es el hito que más cambia el tránsito
    // de una acera —entra y sale gente a horas fijas, todos los días— y por eso
    // se pidió expresamente que no quedara escondido en la lista.
    const todos = (f.hitos || []);
    const orden = todos.filter(h => h.sub === 'gimnasio')
                       .concat(todos.filter(h => h.sub !== 'gimnasio'));
    const hitos = orden.slice(0, 3);
    const resto = orden.slice(3, 4)[0];
    return '<div class="gente">' +
      '<div class="tarjeta">' + escalaAIA('generadores') + filas + '</div>' +
      '<div class="tarjeta"><h2>Hora fuerte</h2>' + escalaAIA('hora-fuerte') +
        hora('Mañana', f.franjas.manana) + hora('Mediodía', f.franjas.mediodia) +
        hora('Tarde', f.franjas.tarde) + hora('Noche', f.franjas.noche || 0) +
        (hitos.length
          ? '<h2 class="h2-sep">Hitos que mueven la acera</h2>' +
            hitos.map(h => '<div class="hito-fila' + (h.sub === 'gimnasio' ? ' fuerte' : '') + '">' +
              '<span>' + esc(h.nombre) + '</span><b>' + numEs(h.distM) + ' m</b></div>').join('') +
            (resto ? '<p class="nota-pie">+ ' + esc(resto.nombre) + ' &middot; ' + numEs(resto.distM) + ' m</p>' : '')
          : '') +
      '</div>' +
      '<div>' + resta + '</div></div>';
  }

  // Franja de tránsito y combustible: dos magnitudes en una línea ancha.
  function franjaTransito(r){
    const f = r.stats.movilidad && r.stats.movilidad.flujo;
    const t = f && f.trafico;
    if (!t) return '';
    const cifra = (v, etq) => '<div class="tr-par"><b>' + numEs(v) + '</b><span>' + etq + '</span></div>';
    return '<div class="transito">' +
      '<div class="tr-rot">Tránsito y combustible</div>' +
      cifra(t.estimable ? numEs(t.carrosDiaMin) + '&ndash;' + numEs(t.carrosDiaMax) : '&mdash;', 'carros por día') +
      cifra(t.estaciones ? numEs(t.litrosMesMin) + '&ndash;' + numEs(t.litrosMesMax) : '&mdash;', 'litros / mes') +
      '<div class="tr-notas">' +
        '<small>' + (t.estaciones
            ? numEs(t.estaciones) + (t.estaciones === 1 ? ' estación' : ' estaciones') + ' de servicio en el radio'
            : 'Sin estaciones de servicio en el radio') +
          ' &middot; rangos de orden de magnitud, no mediciones ni cifras de ventas.</small>' +
        '<small>Nota: el flujo es potencial estimado a partir de usos y malla vial; no es un aforo.</small>' +
      '</div></div>';
  }

  // ── 7. Composición del entorno ──────────────────────────────────────────
  function bloqueComposicion(r){
    const G = window.AIA_MOTOR.GRUPOS, C = window.AIA_MOTOR.GRUPO_COLOR, s = r.stats;
    const grupos = Object.keys(G).filter(g => (s.porGrupo[g] || 0) > 0)
      .sort((a, b) => s.porGrupo[b] - s.porGrupo[a]);
    const max = grupos.length ? s.porGrupo[grupos[0]] : 1;
    const filas = grupos.map(g => {
      const n = s.porGrupo[g], pct = (100 * n / Math.max(s.total, 1));
      return '<div class="comp-fila"><span>' + esc(G[g].t) + '</span>' +
        '<div class="comp-barra"><i style="width:' + (100 * n / max).toFixed(1) + '%;background:' + C[g] + '"></i></div>' +
        '<b>' + numEs(n) + '</b><em>' + numEs(Math.round(pct * 10) / 10) + '%</em></div>';
    }).join('');
    // Se declara cuántos usos no vienen del mapa abierto sino de un
    // levantamiento del propio analista. Callarlo haría el informe
    // inauditable: quien lo lee tiene derecho a saber qué parte se observó y
    // qué parte se añadió, aunque las dos pesen igual en el cálculo.
    const nMan = s.manuales || 0;
    const nota = nMan
      ? '<p class="pie-nota">De ellos, ' + numEs(nMan) +
        (nMan === 1 ? ' fue agregado' : ' fueron agregados') +
        ' en campo por quien hizo el análisis y no proviene' + (nMan === 1 ? '' : 'n') +
        ' del mapa abierto. Cuenta' + (nMan === 1 ? '' : 'n') +
        ' igual en todos los cálculos de este informe.</p>'
      : '';
    return '<div class="tarjeta"><h2>Composición del entorno</h2>' + escalaAIA('composicion') +
      '<p class="sub-nivel" style="color:' + T.ok + '">' + numEs(s.total) +
        (s.total === 1 ? ' uso identificado' : ' usos identificados') + '</p>' +
      filas + nota + '</div>';
  }

  // ── Levantamiento en campo (solo modo educativo) ────────────────────────
  // Estos bloques SOLO salen si el análisis trae `r.edu`, que es lo que adjunta
  // el modo educativo. Un informe de empresas armado sobre el mapa abierto no
  // tiene ficha de edificio ni andenes observados, y fingir la sección con
  // ceros diría que se miró y no había nada, en vez de que nadie fue a mirar.
  function filaBarra(etq, n, tot, color){
    const pct = tot ? (100 * n / tot) : 0;
    return '<div class="comp-fila"><span>' + esc(etq) + '</span>' +
      '<div class="comp-barra"><i style="width:' + pct.toFixed(1) + '%;background:' +
      (color || T.acento) + '"></i></div>' +
      '<b>' + numEs(n) + '</b><em>' + numEs(Math.round(pct)) + '%</em></div>';
  }

  // La ficha puede venir de un curso (`r.edu`) o de un analista que la levantó
  // desde la calle en el modo empresas (`r.campo`). El informe no pregunta de
  // qué modo viene: pregunta si HAY ficha. Condicionar por modo dejaría fuera
  // exactamente el caso de alguien que fue a mirar y anotó lo que vio.
  function fichaCampo(r){
    return ((r.campo || {}).edificacion) || ((r.edu || {}).edificacion) || null;
  }

  function bloqueEdificacionEdu(r){
    const e = fichaCampo(r);
    if (!e || !e.total) return '';
    const epocas = Object.keys(e.porEpoca).sort((a, b) => e.porEpoca[b] - e.porEpoca[a]);
    const mats = Object.keys(e.porMaterial).sort((a, b) => e.porMaterial[b] - e.porMaterial[a]);
    return '<div class="tarjeta"><h2>El tejido construido</h2>' + escalaAIA('edificacion') +
      '<p class="sub-nivel" style="color:' + T.ok + '">' + numEs(e.total) +
      ' ' + (e.total === 1 ? 'edificación' : 'edificaciones') + ' con ficha levantada en campo</p>' +
      (epocas.length
        ? '<h3 class="mini">Época de construcción</h3>' +
          epocas.map(k => filaBarra(k, e.porEpoca[k], e.conEpoca)).join('')
        : '') +
      (mats.length
        ? '<h3 class="mini">Material predominante</h3>' +
          mats.slice(0, 5).map(k => filaBarra(k, e.porMaterial[k], e.conMaterial)).join('')
        : '') +
      (e.evaluables
        ? '<h3 class="mini">Vulnerabilidad potencial</h3>' +
          filaBarra('Alta', e.alta, e.evaluables, T.bad) +
          filaBarra('Media', e.media, e.evaluables, T.warn) +
          filaBarra('Baja', e.baja, e.evaluables, T.ok) +
          '<p class="pie-nota"><b>No es un diagnóstico estructural.</b> Es el cruce de ' +
          'material y época sobre las edificaciones que traen los dos datos (' + numEs(e.evaluables) + '), ' +
          'y solo señala cuáles ameritan que las revise un ingeniero. El primer ' +
          'código sismo resistente colombiano es el Decreto 1400 de 1984: aquí hay ' +
          numEs(e.anteriores1984) + ' ' + (e.anteriores1984 === 1 ? 'construcción' : 'construcciones') +
          ' anterior' + (e.anteriores1984 === 1 ? '' : 'es') + ' a esa fecha' +
          (e.patrimonio ? ', y ' + numEs(e.patrimonio) + ' previa' + (e.patrimonio === 1 ? '' : 's') +
            ' a 1950 que podrían ser patrimonio' : '') + '.</p>'
        : '<p class="pie-nota">Para estimar vulnerabilidad hace falta material Y época en el ' +
          'mismo edificio; con uno solo no se puede afirmar nada.</p>') +
      (e.noSeSabe || e.otros
        ? '<p class="pie-nota">' + (e.noSeSabe ? numEs(e.noSeSabe) + ' dato(s) marcados «no se sabe»' : '') +
          (e.noSeSabe && e.otros ? ' y ' : '') + (e.otros ? numEs(e.otros) + ' como «otro»' : '') +
          ': no cuentan como observación en ningún cálculo de este informe.</p>'
        : '') +
      '</div>';
  }

  function bloqueCaminabilidadEdu(r){
    // El andén solo se observa mapeándolo, cosa que hoy hace el modo
    // educativo: si no hay observaciones, el bloque no sale en vez de salir
    // vacío diciendo que se miró.
    const c = ((r.stats.movilidad || {}).flujo || {}).caminabilidad;
    if (!c || !c.muestras) return '';
    if (!c.muestras) {
      return '<div class="tarjeta"><h2>Caminabilidad</h2>' + escalaAIA('caminabilidad-vacia') +
        '<p class="pie-nota">No se registró el estado del andén en este radio, así que el ' +
        'flujo peatonal se calculó sin ajustarlo. Un vacío de datos no es un andén bueno.</p></div>';
    }
    const pct = Math.round((c.factor - 1) * 100);
    return '<div class="tarjeta"><h2>Caminabilidad</h2>' + escalaAIA('caminabilidad') +
      '<p class="sub-nivel" style="color:' +
      (c.nivel === 'Buena' ? T.ok : c.nivel === 'Irregular' ? T.warn : T.bad) + '">' +
      esc(c.nivel) + ' · ajusta el flujo peatonal en ' + (pct > 0 ? '+' + numEs(pct) : numEs(pct)) + '%</p>' +
      filaBarra('Andén continuo', c.continuo, c.muestras, T.ok) +
      filaBarra('Andén interrumpido', c.interrumpido, c.muestras, T.warn) +
      filaBarra('Sin andén / bordillo', c.sinAnden, c.muestras, T.bad) +
      '<p class="pie-nota">Sobre ' + numEs(c.muestras) + ' ' +
      (c.muestras === 1 ? 'observación' : 'observaciones') + ' de andén' +
      (c.rampas ? ' y ' + numEs(c.rampas) + ' rampa(s) de acceso' : '') + '. ' +
      (c.fiable ? 'El andén no genera peatones: deja caminar a los que ya hay, por eso ajusta y no suma.'
                : 'Son pocas observaciones para el radio; conviene mapear más antes de concluir.') +
      '</p></div>';
  }

  // ── 7. Indicadores urbanos, como filas etiqueta / valor ─────────────────
  function bloqueIndicadoresFilas(r){
    const i = r.indicadores;
    if (!i) return '';
    const colNivel = t => /muy alta|alto potencial|fuerte transformaci|riesgo bajo|alta actividad/i.test(t) ? T.ok
      : /(^|\s)alta|en transformaci|potencial medio|moderada|riesgo medio/i.test(t) ? T.acento
      : /media|en transici|riesgo alto|especializado/i.test(t) ? T.warn : T.bad;
    const fila = (etq, val, nota, color) =>
      '<div class="ind-fila"><span>' + esc(etq) + '</span>' +
      '<b style="color:' + (color || colNivel(val)) + '">' + numEs(val) + '</b>' +
      (nota ? '<em>' + nota + '</em>' : '') + '</div>';
    let out = '';
    const e = i.estrato;
    if (e && e.disponible) {
      out += fila('Estrato', e.predominante + (e.homogeneo ? '' : ' (rango ' + e.minimo + '&ndash;' + e.maximo + ')'),
                  'Censo DANE 2018', T.ok);
    }
    const d = i.demografia;
    if (d && d.disponible) {
      out += fila('Sexo', numEs(d.pctMujeres) + '% mujeres &middot; ' + numEs(d.pctHombres) + '% hombres',
                  numEs(d.pctNinos) + '% menores de 15 &middot; ' + numEs(d.pctMayores) + '% de 65 o más', T.acento);
    }
    out += fila('Diversidad de usos', esc(i.diversidad.nivel));
    out += fila('Actividad comercial', esc(i.comercio.nivel));
    out += fila('Expansión (suelo libre)', esc(i.expansion.nivel));
    out += fila('Transformación (obras)', esc(i.transformacion.nivel));
    out += fila('Riesgo urbano', esc(i.riesgos.nivel));
    return '<div class="tarjeta"><h2>Indicadores urbanos</h2>' + escalaAIA('indicadores-filas') + out + '</div>';
  }

  // ── 8. El entorno según la distancia ────────────────────────────────────
  function bloqueRadios(r){
    const m = r.multiRadio;
    if (!m || !m.anillos || m.anillos.length < 2) return '';
    const etq = v => v >= 1000 ? (v / 1000) + ' km' : v + ' m';
    const filas = m.anillos.map(a =>
      '<tr' + (a.esAnalizado ? ' class="fila-act"' : '') + '><td>' + etq(a.radioM) + '</td>' +
      '<td>' + numEs(a.total) + '</td><td>' + numEs(a.densidadPorHa) + '</td><td>' + numEs(a.comercio) + '</td>' +
      '<td>' + numEs(a.equipamientos) + '</td><td>' + numEs(a.poblacionEstimada) + '</td></tr>').join('');
    /* El mismo dibujo de la pantalla, hecho por js/58. Se pinta ANTES de la
       tabla: en una hoja impresa la forma se ve de lejos y la tabla se
       consulta de cerca, así que el orden de lectura es ese y no al revés.
       Va por hectárea, no en conteo crudo: un anillo de 1 km tiene once
       veces la superficie de uno de 300 m, y un gráfico de conteos estaría
       describiendo el tamaño del círculo en vez del barrio. */
    const dibujo = (window.URBIS_ANILLOS && window.URBIS_ANILLOS.grafico)
      ? window.URBIS_ANILLOS.grafico(m) : '';
    return '<div class="tarjeta">' + escalaAIA('radios') + dibujo +
      '<table class="tbl-radios2">' +
      '<tr class="cab"><th>Radio</th><th>Usos</th><th>Usos/ha</th><th>Comercio</th>' +
      '<th>Equipam.</th><th>Hab. est.</th></tr>' + filas + '</table>' +
      '<p class="nota-pie">' + esc(m.lectura) + '</p></div>';
  }

  /* ── El horario declarado ───────────────────────────────────────────────
     Las franjas del bloque de flujo son una ESTIMACIÓN por tipo de uso.
     Esto es lo que dice el letrero, leído de `opening_hours`.

     En un informe que se entrega a un cliente la cobertura no es un detalle
     de método: es lo que separa un dato de una cifra con cara de dato. Va
     primero y en la misma frase que el porcentaje, porque en papel nadie
     vuelve atrás a buscar la letra pequeña. */
  /* El sector en su contexto: comuna y barrio, busetas y frontera. Solo
     existe si se consultó (hoy, desde el panel del curso); el informe de
     empresas no lo pide todavía y la caja simplemente no sale. */
  function bloqueContextoInforme(r){
    const c = r.contexto;
    if (!c) return '';
    // Convierte metros a kilometros Y los escribe: la conversion es suya, el
    // formato sale del formateador unico (v1042).
    const km = m => numEs(Math.round(m / 100) / 10);
    const migas = (c.limites || []).map(l => esc(l.nombre)).join(' › ');
    const rutas = (c.rutas || []).slice(0, 12).map(x =>
      '<li>' + (x.ref ? '<b>' + esc(x.ref) + '</b> ' : '') + esc(x.nombre || 'Ruta') +
      (x.operador ? ' <em>' + esc(x.operador) + '</em>' : '') + '</li>').join('');
    return '<div class="tarjeta"><h3 class="tarj-t">El sector en su contexto <em>· OpenStreetMap</em></h3>' + escalaAIA('contexto') +
      (migas ? '<p class="ctx-migas">' + migas + '</p>' : '') +
      ((c.barrios || []).length ? '<p class="nota-pie">Barrios nombrados cerca: ' +
        c.barrios.slice(0, 5).map(b => esc(b.nombre)).join(', ') + '.</p>' : '') +
      '<p class="ctx-sub">Busetas que paran en el radio</p>' +
      (rutas ? '<ul class="ctx-rutas">' + rutas + '</ul>' +
               '<p class="nota-pie">' + c.rutas.length + (c.rutas.length === 1 ? ' ruta' : ' rutas') +
                   ' en ' + c.paradas + (c.paradas === 1 ? ' parada mapeada' : ' paradas mapeadas') +
                   '; es lo subido a OpenStreetMap, no la oferta completa.</p>'
             : '<p class="nota-pie">Sin rutas de buseta mapeadas en el radio.</p>') +
      '<p class="ctx-sub">La frontera</p>' +
      '<p class="nota-pie">' + esc((c.binacional || {}).lectura || '') +
        (c.paso ? '' : '') + '</p>' +
      ((c.cambio || []).length ? '<p class="nota-pie">Casas de cambio y giros en el radio: ' + c.cambio.length + '.</p>' : '') +
      (c.paso ? '<p class="nota-pie">Paso más cercano: ' + esc(c.paso.nombre) + ', a ' + km(c.paso.distM) + ' km.</p>' : '') +
      (c.flotante ? '<p class="ctx-sub">Población de paso</p><p class="nota-pie">' + esc(c.flotante.lectura) + '</p>' : '') +
      (c.caminata ? '<p class="ctx-sub">A distancia de caminata</p><p class="nota-pie">' + esc(c.caminata.lectura) + '.</p>' : '') +
      (c.espacioPublico ? '<p class="ctx-sub">Espacio público</p><p class="nota-pie">' + esc(c.espacioPublico.lectura) + '</p>' : '') +
      (c.terreno ? '<p class="ctx-sub">Terreno y agua</p><p class="nota-pie">' + esc(c.terreno.lectura) + '</p>' : '') +
      '</div>';
  }

  /* Comparado con otro sector del curso, si el grupo eligió uno. */
  function bloqueComparacionInforme(r){
    const c = r.comparacion;
    if (!c || !c.filas) return '';
    return '<div class="tarjeta"><h3 class="tarj-t">Comparado con ' + esc(c.otro.nombre) + '</h3>' + escalaAIA('comparacion') +
      '<table class="tbl-comp"><thead><tr><th></th><th class="n">Este sector</th><th class="n">' + esc(c.otro.nombre) + '</th></tr></thead><tbody>' +
      c.filas.map(f => '<tr><td>' + esc(f.t) + '</td><td class="n' + (f.gana === 'este' ? ' g' : '') + '">' + esc(f.este) + '</td>' +
                       '<td class="n' + (f.gana === 'otro' ? ' g' : '') + '">' + esc(f.otro) + '</td></tr>').join('') +
      '</tbody></table><p class="nota-pie">' + esc(c.lectura) + '</p></div>';
  }

  function bloqueHorariosInforme(r){
    const h = (r.stats || {}).horarios;
    if (!h || !h.total) return '';
    if (!h.conDato) {
      return '<div class="tarjeta"><h3 class="tarj-t">Lo que dice el letrero</h3>' + escalaAIA('horarios-vacio') +
        '<p class="nota-pie">' + esc(h.lectura) + '</p></div>';
    }
    const fila = (etq, n, pct) =>
      '<tr><td class="ind-n">' + etq + '</td>' +
      '<td class="hor-b"><i style="width:' + (pct || 0) + '%"></i></td>' +
      '<td class="hor-n">' + numEs(n) + '</td><td class="hor-p">' + numEs(pct || 0) + ' %</td></tr>';
    return '<div class="tarjeta"><h3 class="tarj-t">Lo que dice el letrero ' +
        '<em>· declarado en el mapa, no estimado</em></h3>' + escalaAIA('horarios') +
      '<p class="hor-cob"><b>' + numEs(h.conDato) + ' de ' + numEs(h.total) + '</b> ' + (h.total === 1 ? 'uso declara' : 'usos declaran') + ' horario ' +
        '(' + numEs(h.cobertura) + ' % de cobertura)' +
        (h.suficiente ? '. Los porcentajes son sobre esos ' + numEs(h.conDato) + '.'
                      : ' — muy poco para describir el sector.') + '</p>' +
      '<table class="tbl-horarios">' +
        fila('Abren después de las 8 p.m.', h.deNoche, h.pct.deNoche) +
        fila('Abren sábado', h.sabado, h.pct.sabado) +
        fila('Abren domingo', h.domingo, h.pct.domingo) +
        fila('Solo de lunes a viernes', h.soloEntreSemana, h.pct.soloEntreSemana) +
        (h.siempre ? fila('Abren 24 horas', h.siempre, h.pct.siempre) : '') +
      '</table>' +
      '<p class="nota-pie">' + esc(h.lectura) +
        (h.notaIlegible ? ' ' + esc(h.notaIlegible) : '') + '</p></div>';
  }

  // ── 9. FODA + siguiente paso ────────────────────────────────────────────
  /* En el informe del CURSO el FODA va traducido (js/64): el motor lo escribe
     para quien va a invertir, y en una entrega de taller «mercado saturado»
     y «competidores directos» se leen como un estudio de mercado ajeno. Los
     hallazgos y los números son los mismos; cambia el idioma. */
  function bloqueFodaAncho(r, edu){
    const f = (edu && window.URBIS_EDU && window.URBIS_EDU.fodaEdu) ? window.URBIS_EDU.fodaEdu(r.foda) : r.foda;
    const caja = (t, cls, items) => '<div class="foda ' + cls + '"><h3>' + t + '</h3><ul>' +
      (items && items.length ? items.slice(0, 3).map(x => '<li>' + esc(x) + '</li>').join('')
                             : '<li class="vacio">Sin hallazgos relevantes.</li>') + '</ul></div>';
    return '<div class="foda-grid4">' +
      caja('FORTALEZAS', 'f', f.fortalezas) + caja('DEBILIDADES', 'd', f.debilidades) +
      caja('OPORTUNIDADES', 'o', f.oportunidades) + caja('RIESGOS', 'r', f.riesgos) +
      '</div>';
  }

  /* Las ideas de proyecto, en el informe del curso. Van TRES y no las nueve
     que puede haber en pantalla: esta es la última hoja y ya lleva
     composición, población, campo, radios y FODA. Tres encargos que caben y
     se leen valen más que nueve apretados que nadie termina.

     Cada una conserva la medida que la sostiene. Sin ella, un encargo
     impreso se lee como una recomendación de URBIS, y URBIS no sabe qué hay
     que construir en un sector: sabe qué le falta medido contra algo. */
  function bloqueIdeasInforme(r){
    if (!(window.URBIS_EDU && window.URBIS_EDU.ideasDeDiseno)) return '';
    const d = window.URBIS_EDU.ideasDeDiseno(r);
    if (!d.lista.length) return '';
    return '<div class="ideas-proy"><h3>QUÉ PROYECTO PEDIRÍA ESTE SECTOR</h3>' +
      '<p class="ideas-nota">Encargos para discutir en clase, cada uno con la medida que lo motiva. ' +
      'No son una respuesta: el análisis sabe qué le falta al sector, no qué hay que construir ahí.</p>' +
      '<div class="ideas-grid">' +
      d.lista.slice(0, 3).map(i =>
        '<div class="idea"><h4>' + esc(i.ico + ' ' + i.t) + '</h4>' +
        '<p class="idea-medida">' + esc(i.porque) + '</p>' +
        '<p>' + esc(i.disena) + '</p></div>').join('') +
      '</div></div>';
  }

  // Cuántas hojas tiene el informe. Vive en una constante porque la
  // numeración del pie y la del encabezado tienen que decir lo mismo, y
  // antes había que acordarse de cambiar los dos sitios a mano.
  /* Cuántas hojas tiene el informe. Deja de ser constante porque el de
     empresas lleva una más —la del método— y el del curso no: ya declara su
     método en la lectura del grupo. Se fija al componer, igual que el estilo
     (`fijarEstilo`), que es el precedente de este mismo archivo. */
  let N_HOJAS = 4;

  // Cabecera y pie iguales en todas las hojas: la numeración "n/N" es lo único
  // que cambia, y es lo que permite reconocer una hoja suelta si se imprime.
  // ══ Los bloques propios del informe del curso ═══════════════════════════

  /* Sobre qué se analizó: cuántos puntos mapeó el curso y cuántos leyó el
     motor. Va de primero por la misma razón que en el panel: un estudiante
     que lee «flujo 18/100» antes de saber que salió de ocho puntos lo lee
     como un hecho del barrio. */
  function bloqueBaseInforme(r){
    const e = r.edu;
    if (!e) return '';
    const pocos = (e.leidos || 0) < MIN_USOS_FIABLE;
    const faltan = Object.keys(e.sinTraducir || {});
    return '<div class="base-edu' + (pocos ? ' flojo' : '') + '">' +
      '<b>' + (pocos ? '⚠ ' : '✓ ') + 'Este análisis se hizo con ' + numEs(e.leidos || 0) +
        ((e.leidos || 0) === 1 ? ' punto' : ' puntos') + ' que el curso mapeó' +
        (e.puntosDelCurso > e.leidos ? ' (de ' + numEs(e.puntosDelCurso) + ' en el radio; el resto son reportes de situaciones, no usos del suelo)' : '') + '.</b>' +
      '<p>' + (pocos
        ? 'Con tan pocos puntos el resultado es un ejercicio, no un diagnóstico: el sector tiene más de lo que se alcanzó a mapear. ' +
          'La población del DANE, en cambio, está completa siempre.'
        : 'Suficientes puntos para que las cifras empiecen a ser estables. La población del DANE no depende de lo mapeado.') +
        (faltan.length ? ' ' + faltan.length + (faltan.length === 1 ? ' etiqueta' : ' etiquetas') + ' del curso no se supieron traducir a la Matriz de Usos: ' +
          faltan.slice(0, 5).map(esc).join(', ') + (faltan.length > 5 ? '…' : '') + '.' : '') +
      '</p>' +
      // Qué cambió desde el análisis anterior, si lo hubo: es la prueba de
      // que mapear más mueve las cifras, y va junto a la advertencia.
      (r.cambios && r.cambios.lista && r.cambios.lista.length
        ? '<p class="base-cambios"><b>Desde el análisis anterior' +
            (r.cambios.desde ? ' (' + new Date(r.cambios.desde).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ')' : '') + ':</b> ' +
            r.cambios.lista.slice(0, 6).map(c => esc(c.t.toLowerCase()) + ' ' + esc(c.antes) + ' → ' + esc(c.ahora)).join(' · ') + '.</p>'
        : '') +
      '</div>';
  }

  /* Cómo leer las cifras: definiciones y no ventas. Es lo que se enseña. */
  /* ── Sobre qué se analizó, en el informe que va al cliente (v1043) ──────
     El informe del curso declara desde siempre con cuántos puntos se hizo
     el análisis y avisa cuando son pocos (`bloqueBaseInforme`). El de
     empresas NO: medido sobre el papel, ese bloque no se llama una sola vez
     en `cuerpoEmpresa` —y aunque se llamara, sale vacío sin `r.edu`—, así
     que el informe que se le entrega a un cliente publicaba dieciséis
     paneles de cifras sin decir sobre cuántos usos se hicieron.

     Va como FRANJA y no como panel de sección: es una declaración sobre el
     documento entero y no una medición de una sección, igual que el aviso
     de escala del pliego educativo.

     Y declara el RADIO con su área, que es la otra mitad de la misma cosa:
     toda cifra «por hectárea» o «por habitante» es un promedio sobre esa
     extensión, y 8 km de radio son 201 km². El corte no se inventa —sería
     el techo a ojo que este proyecto ya pagó una vez— sino que sale del
     propio módulo: `RADIOS_COMPARATIVA` es el rango de radios que este
     análisis compara, así que por encima de su máximo el informe está
     midiendo más de lo que sabe comparar, y lo dice. */
  function bloqueBaseAIA(r){
    const s = r.stats || {};
    const radioM = Number((r.meta || {}).radioM) || 0;
    const usos = Number(s.total) || 0;
    const pocos = usos < MIN_USOS_FIABLE;
    const areaHa = radioM ? Math.round(Math.PI * radioM * radioM / 10000) : 0;
    const radioTxt = radioM >= 1000 ? numEs(Math.round(radioM / 100) / 10) + ' km' : numEs(radioM) + ' m';
    const RC = (window.AIA_MOTOR && window.AIA_MOTOR.RADIOS_COMPARATIVA) || [];
    const tope = RC.length ? Math.max.apply(null, RC) : 0;
    const grande = tope && radioM > tope;
    return '<div class="aia-base' + (pocos ? ' flojo' : '') + '">' +
      '<b>' + (pocos ? '⚠ ' : '✓ ') + 'Este análisis se hizo con ' + numEs(usos) +
        (usos === 1 ? ' uso registrado' : ' usos registrados') +
        ' en OpenStreetMap dentro de un radio de ' + radioTxt +
        (areaHa ? ' (' + numEs(areaHa) + ' ha)' : '') + '.</b>' +
      '<p>' + (pocos
        /* La cifra NO va delante de un plural, y no es un capricho de estilo:
           la guarda de concordancia lo denuncia con razón —«1 usos»— y su
           exención de constantes pide la constante pegada al texto, así que
           `numEs(MIN_USOS_FIABLE) + ' usos'` no la alcanza. Aflojar dos
           guardas por una frase es lo contrario de lo que se hace acá: la
           frase se escribe de otra manera y dice el umbral igual. */
        ? 'Por debajo de ' + numEs(MIN_USOS_FIABLE) + ' el resultado describe un ejercicio y no el ' +
          'sector: el entorno tiene más de lo que el mapa abierto registra, y cada uso que aparezca ' +
          'mueve las cifras. Conviene verificarlo en campo antes de decidir con ellas.'
        : 'Suficientes usos para que las cifras del entorno empiecen a ser estables. Lo que el mapa ' +
          'abierto no registra sigue existiendo: un uso sin mapear no cuenta en ninguna de estas cifras.') +
      /* La población solo se declara independiente del mapa cuando de verdad
         sale del censo: `poblacionEsCensal` puede ser falso y entonces la
         cifra es una estimación de URBIS sobre lo mapeado, que es justo lo
         contrario de lo que esta frase afirma. */
      (s.poblacionEsCensal || s.poblacionProyectada
        ? ' La población sale del censo del DANE y no depende de lo que esté mapeado.'
        : ' La población tampoco es censal: el censo no respondió y la cifra es una estimación de URBIS.') +
      '</p>' +
      (grande
        ? '<p class="aia-base-esc">Este radio está por encima de los ' + numEs(tope) + ' m que este ' +
          'análisis compara entre sí, así que toda cifra por hectárea o por habitante es un promedio ' +
          'sobre ' + numEs(areaHa) + ' ha que pueden mezclar barrios distintos. Para leer una cuadra, ' +
          'conviene volver a analizar con un radio menor.</p>'
        : '') +
      '</div>';
  }

  function bloqueComoLeerEdu(r){
    const s = r.stats;
    const filas = [
      ['Habitantes', s.poblacionProyectada
        ? 'lo que contó el DANE en ' + s.censoAnio + ', traído a ' + s.anioProyeccion + ' con la tasa del municipio.'
        : (s.poblacionEsCensal ? 'lo que contó el DANE; no una estimación.' : 'una estimación; el censo no respondió.')],
      ['Flujo a pie / en carro', 'de 0 a 100: cuánta gente mueve el entorno, estimado por el tipo de cada uso. No es un aforo.'],
      ['Usos por hectárea', 'cuántas actividades hay por cada 100 × 100 m. Sirve para comparar sectores de distinto tamaño.'],
      ['Los anillos', 'el mismo dato a 300 m, 500 m y 1 km. Si la densidad baja al alejarse, el punto es un centro; si sube, un borde.'],
      ['El mapa de calor', 'dónde se concentra el movimiento dentro del radio, contra su propio máximo. Dice dónde, no cuánto.'],
      ['El horario del letrero', 'lo declarado en la puerta, distinto de lo estimado por tipo de uso. Cuando no coinciden, ahí hay una pregunta.']
    ];
    return '<div class="tarjeta"><h2>Cómo leer estas cifras</h2>' + escalaAIA('como-leer-edu') + '<div class="leer">' +
      filas.map(f => '<div><b>' + esc(f[0]) + '</b><small>' + esc(f[1]) + '</small></div>').join('') +
      '</div></div>';
  }

  /* Lo que el análisis dejó abierto: sale de js/64, que lo calcula del
     resultado. Si el curso ya lo levantó, no aparece. */
  function bloqueFaltaInforme(r){
    const F = (window.URBIS_EDU && window.URBIS_EDU.faltantes) ? window.URBIS_EDU.faltantes(r) : [];
    return '<div class="tarjeta"><h2>Qué falta por levantar</h2>' + escalaAIA('falta') +
      (F.length
        ? '<ul class="falta">' + F.slice(0, 7).map(f => '<li><b>' + esc(f.t) + (f.n ? ' <em>' + numEs(f.n) + '</em>' : '') + '</b>' +
            '<small>' + esc(f.d) + '</small></li>').join('') + '</ul>'
        : '<p class="nota-pie">Nada pendiente: el curso levantó todo lo que el análisis sabe pedir.</p>') +
      '</div>';
  }

  /* La lectura del curso: las cajas que el grupo escribió, con el título y
     la pregunta de js/64. Solo las que tienen texto; si el grupo no escribió
     ninguna de las pedidas acá, se deja la pregunta a la vista, que es la
     manera de que el informe impreso siga pidiendo la respuesta. */
  function bloqueLecturasInforme(r, ids){
    const L = (window.URBIS_EDU && window.URBIS_EDU.LECTURAS) || [];
    const textos = r.lecturas || {};
    const defs = ids.map(id => L.find(l => l.id === id) || { id, t: id, p: '' });
    const conTexto = defs.filter(d => (textos[d.id] || '').trim());
    const esGeneral = ids.length === 1 && ids[0] === 'general';
    if (!conTexto.length) {
      if (!esGeneral) return '';
      return '<div class="lectura lectura-vacia"><b>El grupo no escribió su conclusión todavía.</b>' +
        '<p>' + esc(defs[0].p) + '</p><div class="lectura-lineas"></div></div>';
    }
    return '<div class="lecturas' + (esGeneral ? ' lectura-general' : '') + '">' +
      conTexto.map(d => '<div class="lectura"><b>' + esc(d.t) + '</b>' +
        '<p>' + esc(textos[d.id]) + '</p></div>').join('') +
      '</div>';
  }

  /* La forma de la traza, si el curso la pidió. */
  function bloqueFormaInforme(r){
    const f = r.formaEdu && r.formaEdu.morfologia && r.formaEdu.morfologia.forma;
    if (!f) {
      return '<div class="tarjeta"><h2>La forma de la traza</h2>' + escalaAIA('forma-vacia') + '<p class="nota-pie">' +
        (r.formaEdu ? 'Sin calles suficientes en el radio para describir la traza.'
                    : 'No se pidió. Está a un botón en el panel del curso: ortogonal, radial, media naranja, lineal o plato roto, medido con las calles.') +
        '</p></div>';
    }
    const n = r.formaEdu.nVias || 0;
    return '<div class="tarjeta"><h2>La forma de la traza</h2>' + escalaAIA('forma') +
      '<p class="forma-nombre">' + esc(f.nombre) + ' <em>· ' + n + (n === 1 ? ' calle' : ' calles') + '</em></p>' +
      '<p class="nota-pie">' + esc(f.descripcion || '') + '</p>' +
      '<p class="nota-pie"><b>Por qué:</b> ' + esc(f.porque || '') + '</p>' +
      (f.advertencia ? '<p class="nota-pie forma-ojo">' + esc(f.advertencia) + '</p>' : '') +
      '</div>';
  }

  function cabecera(titulo, rotulo, sub, fecha, n){
    return '<header>' +
      '<img class="logo" src="assets/brand/urbis-logo.png" onerror="this.style.display=\'none\'">' +
      '<div class="head-txt"><h1>' + esc(titulo) + '</h1>' +
      '<p>' + esc(rotulo) + '</p>' +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' +
      '<div class="sub">' + esc(fecha) + '<b>' + n + '/' + N_HOJAS + '</b></div>' +
      '</header>';
  }

  function pie(n, r, autor, edu){
    return '<footer><span>Página ' + n + ' de ' + N_HOJAS + ' · ' + (autor ? esc(autor) + ' · ' : '') +
      '<b>URBIS</b> · ' + (edu ? 'Modo educativo' : 'Urbis para Empresas') + ' &nbsp;·&nbsp; @urbis_co &nbsp;·&nbsp; urbisprocity@gmail.com</span>' +
      '<span>Fuentes: ' +
      (r.stats.poblacionEsCensal ? 'Censo DANE ' + r.stats.censoAnio + ' · ' : '') +
      (r.stats.poblacionProyectada ? 'Proyecciones de población DANE · ' : '') +
      'OpenStreetMap · evaluación heurística URBIS</span></footer>';
  }

  /* Recibía un tercer parámetro `chartsPNG` con imágenes de los gráficos.
     Nadie lo leía desde que los gráficos se dibujan en la hoja: se quitó
     junto con la función que las fabricaba (js/62). Las llamadas viejas de
     tres argumentos siguen funcionando —el segundo se ignoraba igual— pero
     ninguna queda en el repositorio. */
  function construirHTMLEjecutivo(r, opciones){
    opciones = opciones || {};
    // El estilo se fija ANTES de armar nada: tanto el CSS como los bloques
    // leen `T`, y se evalúan en orden dentro del mismo arreglo de plantilla.
    fijarEstilo(opciones.estilo);
    const titulo = opciones.titulo || r.meta.proyectoNombre || 'Urbis para Empresas';
    const subtitulo = opciones.subtitulo || r.meta.direccionAprox || '';
    const horizontal = opciones.orientacion !== 'vertical';
    const autor = opciones.autor || '';
    const ubicacionTxt = (opciones.ubicacion && opciones.ubicacion.texto) || '';
    const fecha = new Date(r.meta.fechaISO).toLocaleString('es-CO', { dateStyle:'long', timeStyle:'short' });

    const anchoMM = horizontal ? 263 : 200, altoMM = horizontal ? 200 : 263;
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';
    const edu = !!opciones.educativo;

    function cuerpoEmpresa(){
      /* La hoja del método es la quinta y sale del cuerpo YA compuesto, así
         que no puede listar un panel que no salió ni olvidar uno que sí. */
      N_HOJAS = 6;
      const cuerpo = [
// ══ HOJA 1 · la conclusión y lo que el cliente necesita para decidir ══
'<div class="hoja"><div class="contenido">',

cabecera(titulo, 'Análisis del entorno · URBIS', ubicacionTxt, fecha, 1),

bloqueBaseAIA(r),

seccion(1, 'Lectura ejecutiva', 'la historia que conviene contar al cliente'),
bloqueEjecutivo(r),

seccion(2, 'Los 6 datos que explican el sitio', ''),
seisDatos(r),

seccion(3, 'Qué está pasando alrededor', 'entorno inmediato y oportunidad'),
'<div class="fila tres">',
  '<div>', bloqueMapa(r, horizontal), '</div>',
  '<div>', bloqueOportunidad(r), '</div>',
  '<div>', bloqueComoLeer(r), '</div>',
'</div>',

seccion(4, 'Lo más importante para el cliente', 'flujo + implicación comercial'),
bloqueClave(r),

pie(1, r, autor),
'</div></div>',

// ══ HOJA 2 · cómo se mueve el entorno y qué lo activa ══
'<div class="hoja"><div class="contenido">',

cabecera(titulo, 'Datos y estadísticas del sector', 'movilidad, actividad y alcance', fecha, 2),

seccion(5, 'Cómo se mueve el entorno', 'del tránsito a la oportunidad'),
'<div class="fila dos-13">',
  '<div>', bloqueViabilidadDetalle(r), '</div>',
  '<div>', bloqueMovilidad(r), '</div>',
'</div>',

seccion(6, 'Qué trae gente a pie y qué se lo lleva', 'lo que suma y lo que resta en el andén'),
bloqueTraeGente(r),
franjaTransito(r),
bloqueAnillosComp(r),

pie(2, r, autor),
'</div></div>',

// ══ HOJA 3 · dónde está el movimiento, no cuánto ══
// Hoja propia porque los tres mapas necesitan tamaño para leerse: metidos en
// una columna de otra hoja se convierten en tres estampillas de colores.
'<div class="hoja"><div class="contenido">',

cabecera(titulo, 'Mapas de calor de movilidad', 'dónde se concentra el tránsito dentro del radio', fecha, 3),

seccion(7, 'Dónde está el movimiento', 'el mismo cálculo, repartido sobre el terreno'),
bloqueMapaCalor(r),

'<div class="fila dos" style="margin-top:8px">',
  '<div>', bloqueAtraeVehiculo(r), '</div>',
  '<div>', bloqueVocacion(r), '</div>',
'</div>',
bloqueContextoInforme(r),

pie(3, r, autor),
'</div></div>',

// ══ HOJA 4 · composición, población y la lectura FODA ══
'<div class="hoja"><div class="contenido">',

cabecera(titulo, 'Datos y estadísticas del sector', 'composición, población y lectura FODA', fecha, 4),

seccion(8, 'De qué está hecho el entorno', 'estructura urbana en ' + radioTxt),
'<div class="fila dos">',
  '<div>', bloqueComposicion(r), bloquePoblacion(r), '</div>',
  '<div>', bloqueIndicadoresFilas(r), '</div>',
'</div>',

(fichaCampo(r) ? seccion(9, 'Lo levantado en campo', 'ficha del edificio y estado del andén') : ''),
(fichaCampo(r) ? '<div class="fila dos"><div>' + bloqueEdificacionEdu(r) + '</div>' +
         '<div>' + bloqueCaminabilidadEdu(r) + '</div></div>' : ''),

seccion(fichaCampo(r) ? 10 : 9, 'El entorno según la distancia', 'mismo dato, varios radios'),
bloqueRadios(r),
bloqueHorariosInforme(r),

seccion(fichaCampo(r) ? 11 : 10, 'FODA para presentar la decisión', 'qué favorece, qué exige y qué revisar'),
bloqueFodaAncho(r),
'<div class="paso">SIGUIENTE PASO RECOMENDADO · Verificar el uso del suelo permitido y la ' +
  'prefactibilidad financiera antes de avanzar a diseño. La última hoja dice en qué ventanilla ' +
  'se piden esos datos.</div>',

pie(4, r, autor),
'</div></div>',

'</div>',
      ].join('');
      return cuerpo + hojaMetodoAIA(cuerpo, titulo, fecha, autor, r) +
        hojaVaciosAIA(titulo, fecha, autor, r);
    }

    /* ── El informe del curso ─────────────────────────────────────────────
       Las mismas cuatro hojas, sin el negocio: ni viabilidad del proyecto,
       ni «lo más importante para el cliente», ni el POT como siguiente
       paso. En su lugar: sobre qué se analizó, qué falta por levantar, y
       la lectura del curso, que va de primera porque es lo que se evalúa. */
    function cuerpoEdu(){
      /* El informe del curso se queda en cuatro: su método lo declara la
         lectura del grupo y «cómo leer estas cifras», que ya van dentro. */
      N_HOJAS = 4;
      return [
'<div class="hoja"><div class="contenido">',
cabecera(titulo, 'Análisis del sector · ejercicio del curso', ubicacionTxt, fecha, 1),
seccion(1, 'Sobre qué se analizó', 'lo que el curso mapeó, antes de las cifras'),
bloqueBaseInforme(r),
seccion(2, 'Los 6 datos que describen el sitio', ''),
seisDatos(r, true),
seccion(3, 'Qué hay alrededor', 'el sector, cómo leer las cifras y qué falta'),
'<div class="fila tres">',
  '<div>', bloqueMapa(r, horizontal), '</div>',
  '<div>', bloqueComoLeerEdu(r), '</div>',
  '<div>', bloqueFaltaInforme(r), '</div>',
'</div>',
seccion(4, 'La lectura del curso', 'lo que el grupo concluyó después de caminar el sector'),
bloqueLecturasInforme(r, ['general']),
bloqueLecturasInforme(r, ['base', 'poblacion', 'flujo', 'calor', 'composicion', 'anillos', 'edificacion', 'forma', 'contexto', 'foda', 'ideas']),
bloqueComparacionInforme(r),
pie(1, r, autor, true),
'</div></div>',

'<div class="hoja"><div class="contenido">',
cabecera(titulo, 'Cómo se mueve el sector', 'flujo, horarios y lo que trae gente', fecha, 2),
seccion(5, 'Cómo se mueve el sector', 'del tránsito a la vida de la calle'),
'<div class="fila dos">',
  '<div>', bloqueMovilidad(r), '</div>',
  '<div>', bloqueHorariosInforme(r) || bloqueClave(r), '</div>',
'</div>',
seccion(6, 'Qué trae gente a pie y qué se lo lleva', 'lo que suma y lo que resta en el andén'),
bloqueTraeGente(r),
franjaTransito(r),
bloqueAnillosComp(r),
pie(2, r, autor, true),
'</div></div>',

'<div class="hoja"><div class="contenido">',
cabecera(titulo, 'Dónde está el movimiento y en qué ciudad', 'mapas de calor, forma de la traza y contexto', fecha, 3),
seccion(7, 'Dónde está el movimiento', 'mapas de calor: a pie de día, a pie de noche, en vehículo'),
bloqueMapaCalor(r),
'<div class="fila tres" style="margin-top:8px">',
  '<div>', bloqueAtraeVehiculo(r), '</div>',
  '<div>', bloqueVocacion(r), '</div>',
  '<div>', bloqueFormaInforme(r), '</div>',
'</div>',
bloqueContextoInforme(r),
pie(3, r, autor, true),
'</div></div>',

'<div class="hoja"><div class="contenido">',
cabecera(titulo, 'De qué está hecho el sector', 'composición, población, campo y contexto', fecha, 4),
seccion(8, 'De qué está hecho el sector', 'estructura urbana en ' + radioTxt),
'<div class="fila dos">',
  '<div>', bloqueComposicion(r), bloquePoblacion(r), '</div>',
  '<div>', bloqueIndicadoresFilas(r), '</div>',
'</div>',
(fichaCampo(r) ? seccion(9, 'Lo levantado en campo', 'ficha del edificio y estado del andén') : ''),
(fichaCampo(r) ? '<div class="fila dos"><div>' + bloqueEdificacionEdu(r) + '</div>' +
         '<div>' + bloqueCaminabilidadEdu(r) + '</div></div>' : ''),
seccion(fichaCampo(r) ? 10 : 9, 'El entorno según la distancia', 'mismo dato, varios radios'),
bloqueRadios(r),
seccion(fichaCampo(r) ? 11 : 10, 'FODA del sector', 'qué favorece, qué exige y qué revisar'),
bloqueFodaAncho(r, true),
bloqueIdeasInforme(r),
'<div class="paso">SIGUIENTE PASO · Mapear lo que falta, volver a analizar y comparar con esta versión: ' +
  'el cambio entre las dos es el aprendizaje.</div>',
pie(4, r, autor, true),
'</div></div>',
    ].join(''); }

    return [
// El <base> es imprescindible: el informe se abre en una ventana nueva con
// document.write, cuya URL es about:blank, así que sin esto las rutas
// relativas (el logo) no resuelven y el recuadro sale vacío.
'<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><base href="', location.href, '">',
'<title>', esc(titulo), ' · URBIS</title><style>',
'@page{size:letter ', (horizontal ? 'landscape' : 'portrait'), ';margin:8mm}',
'*{box-sizing:border-box;margin:0;padding:0}',
'body{font-family:"Segoe UI",Arial,sans-serif;color:', T.tinta, ';background:', T.hoja, ';',
'-webkit-print-color-adjust:exact;print-color-adjust:exact}',
'#marco{transform-origin:top left}',
// DOS hojas en vez de una. Al sumar los datos del DANE (población, estrato,
// sexo y edad) el informe dejó de caber en una sola página y el auto-ajuste
// tenía que encogerlo hasta recortar. Ahora la página 1 explica el veredicto
// al cliente y la 2 lleva el detalle: cada una se ajusta por separado.
'.hoja{width:', anchoMM, 'mm;height:', altoMM, 'mm;overflow:hidden;position:relative;background:', T.hoja, '}',
'.hoja + .hoja{margin-top:10mm}',
'.contenido{transform-origin:top left;width:100%}',
'@media print{.hoja{margin:0 !important}.hoja + .hoja{break-before:page;page-break-before:always}}',
/* Veredicto grande — el elemento pedagógico de la página 1 */
'.veredicto{border:2px solid ', T.borde, ';border-radius:10px;overflow:hidden;margin-bottom:6px}',
'.ver-h{background:linear-gradient(100deg,', T.cab1, ',', T.cab2, ');color:', T.cabTxt, ';',
'padding:5px 12px;display:flex;align-items:center;gap:8px}',
'.ver-h b{font-size:9px;font-weight:900;letter-spacing:1.6px}',
'.ver-h span{margin-left:auto;font-size:7.4px;background:rgba(255,255,255,.2);padding:2px 8px;',
'border-radius:99px;font-weight:700}',
'.ver-b{display:flex;align-items:center;gap:14px;padding:11px 14px;background:', T.suave, '}',
'.ver-b .gauge-xl{width:46mm;height:46mm;flex:0 0 auto}',
'.ver-txt{flex:1}',
'.ver-txt .estrellas-xl{font-size:26px;color:', T.oro, ';letter-spacing:3px;line-height:1}',
'.ver-txt .nivel-xl{display:block;font-size:20px;font-weight:900;line-height:1.1;margin-top:3px}',
'.ver-txt .frase-xl{display:block;font-size:9px;color:', T.txt2, ';margin-top:5px;line-height:1.45}',
/* Guía pedagógica: qué significa cada cosa */
'.guia{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-top:5px}',
'.guia div{border:1px solid ', T.borde, ';border-radius:6px;padding:5px 8px;background:', T.panel, '}',
'.guia b{display:block;font-size:8px;color:', T.acento, ';font-weight:800;margin-bottom:1px}',
'.guia small{display:block;font-size:7.4px;color:', T.txt2, ';line-height:1.35}',
// En pantalla (previsualización) la hoja se muestra completa sobre un
// fondo gris, como un visor de PDF; al imprimir vuelve a tamaño real.
'@media screen{body{background:#4b5563;padding:8px}.hoja{box-shadow:0 6px 26px rgba(0,0,0,.45)}}',
'@media print{body{background:', T.hoja, ';padding:0}#marco{transform:none !important;margin:0 !important}.hoja{box-shadow:none}}',
/* Encabezado */
'header{display:flex;align-items:center;gap:10px;background:linear-gradient(100deg,', T.cab1, ',', T.cab2, ');',
'color:', T.cabTxt, ';padding:7px 12px;border-radius:6px}',
// El logo va siempre sobre blanco: es un PNG con fondo claro y sobre el
// encabezado oscuro del estilo premium se perdería.
'header .logo{width:28px;height:28px;object-fit:contain;border-radius:6px;background:#fff;flex:0 0 auto;padding:1px}',
'header h1{font-size:15px;font-weight:800;letter-spacing:.4px;line-height:1.1}',
'header p{font-size:8.5px;color:', T.oro, ';font-weight:700;letter-spacing:1.2px;text-transform:uppercase}',
'header .head-ubi{display:inline-block;margin-top:2px;font-size:8px;color:', T.cabTxt, ';font-weight:600;',
'background:rgba(255,255,255,.16);border-radius:99px;padding:1.5px 8px}',
'header .head-txt small{display:block;font-size:7.4px;color:', T.cabTxt, ';opacity:.85;margin-top:1px}',
'header .sub{margin-left:auto;text-align:right;font-size:8px;color:', T.cabTxt, ';opacity:.9;line-height:1.35}',
'header .sub b{display:block;font-size:8px;font-weight:700;opacity:.8;margin-top:3px}',
/* Rejilla principal */
'.fila{display:grid;gap:5px;margin-top:5px}',
// Cada columna es un flex vertical y su ÚLTIMO bloque crece. Sin esto, la
// columna corta termina antes que la larga y queda un hueco blanco visible
// al pie de la hoja; así el marco celeste llega siempre hasta abajo.
'.fila>div{display:flex;flex-direction:column;gap:4px;min-width:0}',
// El sobrante se reparte entre TODOS los bloques de la columna. Cargárselo
// solo al último dejaba un marco enorme medio vacío (el hueco que se veía en
// el PDF): el problema nunca estuvo entre los bloques, sino dentro de uno.
'.fila>div>*{flex:1 1 auto}',
// El mapa es la excepción: su alto lo manda su proporción. Si la columna se
// lo estirara, quedaría un borde con aire vacío debajo de la foto.
'.fila>div>.mapa-marco{flex:0 0 auto}',
// Y para que ese alto de más se use de verdad y no vuelva a ser vacío: la
// tabla del bloque estira sus filas, y las imágenes se centran.
'.bloque{display:flex;flex-direction:column}',
'.bloque>table{flex:1 1 auto}',
'.bloque>table td,.bloque>table th{vertical-align:middle}',
'.bloque>img{margin-top:auto;margin-bottom:auto}',
// Las listas y la rejilla de KPIs no estiran solas: se les reparte el aire
// entre renglones en vez de acumularlo al final del marco.
'.bloque>ul{flex:1 1 auto;display:flex;flex-direction:column;justify-content:space-around}',
// Los KPI NO se estiran. Con `flex:1 1 auto` absorbían todo el sobrante de la
// hoja: medían 190 px con 145 de aire vacío cada uno, cinco veces. El sobrante
// queda ahora disponible para contenido de verdad.
'.bloque>.kpis{flex:0 0 auto;align-content:start}',
'.kpi{align-self:start}',
'.mapa-wrap{flex:0 0 auto}',
// En vertical la fila-2 tiene 3 columnas en una rejilla de 2: la tercera
// quedaría sola dejando media hoja en blanco, así que ocupa el ancho
// completo con sus dos bloques uno al lado del otro.
(horizontal ? '' : '.fila-2>div:nth-child(3){grid-column:1/-1;flex-direction:row}' +
               '.fila-2>div:nth-child(3)>*{flex:1 1 0}'),
'.fila-1{grid-template-columns:', (horizontal ? '27% 37% 1fr' : '30% 38% 1fr'), '}',
'.fila-2{grid-template-columns:repeat(', (horizontal ? '3' : '2'), ',1fr)}',
'.fila-foda{grid-template-columns:1fr}',
'.fila-3{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}',
/* Bloques */
'.bloque{border:1px solid ', T.borde, ';border-radius:6px;padding:6px 8px;background:', T.panel, ';break-inside:avoid}',
'.bloque h2{font-size:8.5px;text-transform:uppercase;letter-spacing:.7px;color:', T.acento, ';',
'font-weight:800;padding-bottom:3px;margin-bottom:5px;border-bottom:1.5px solid ', T.oro, '}',
'.bloque h2 em{font-style:normal;font-weight:600;color:', T.txt3, ';text-transform:none;letter-spacing:0}',
/* Mapa */
// La proporción se fija con `padding-top`, no con `aspect-ratio`: como el
// recuadro es un bloque dentro del marco (no un elemento flexible), ni la
// rejilla ni un `flex-grow` heredado pueden estirarlo. Antes sí lo estiraban,
// el recuadro dejaba de ser 4:3, `object-fit:cover` recortaba los lados y todo
// lo dibujado encima —el lote incluido— quedaba corrido.
// El borde va en el marco, no en el recuadro: sumado al ancho le robaba a la
// proporción un 1% y volvía a descuadrar —poco, pero descuadrar— lo dibujado.
'.mapa-marco{position:relative;width:100%;flex:0 0 auto;border:1px solid #cfd8e0;border-radius:6px;overflow:hidden}',
'.mapa-wrap{position:relative;width:100%;height:0;padding-top:75%;overflow:hidden;background:#dde3e8}',
// `fill` y no `cover`: con el recuadro y la imagen en la misma proporción son
// idénticos, pero `fill` garantiza que las esquinas del recuadro sean las
// esquinas del mapa, que es de lo que depende toda la georreferenciación.
'.mapa-img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;display:block}',
'.mapa-vacio{background:repeating-linear-gradient(45deg,#e8edf1,#e8edf1 8px,#dfe6ec 8px,#dfe6ec 16px)}',
'.mapa-radio{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:2px dashed rgba(255,255,255,.95);',
'border-radius:50%;box-shadow:0 0 0 9999px rgba(10,25,20,.16) inset}',
'.mapa-wrap .pt{position:absolute;width:5px;height:5px;border-radius:50%;transform:translate(-50%,-50%);',
'box-shadow:0 0 0 .8px rgba(255,255,255,.9)}',
// Punto de tamaño cero en el centro exacto: los hijos se cuelgan de él sin
// moverlo, así el rótulo puede crecer sin arrastrar la marca del lote.
'.mapa-pin{position:absolute;left:50%;top:50%;width:0;height:0}',
'.mapa-pin .cruz-h{position:absolute;left:-11px;top:-.75px;width:22px;height:1.5px;background:', T.cab1, ';',
'box-shadow:0 0 0 .6px rgba(255,255,255,.85)}',
'.mapa-pin .cruz-v{position:absolute;left:-.75px;top:-11px;width:1.5px;height:22px;background:', T.cab1, ';',
'box-shadow:0 0 0 .6px rgba(255,255,255,.85)}',
'.mapa-pin .punto{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:#fff;',
'border:2px solid ', T.cab1, ';box-shadow:0 1px 3px rgba(0,0,0,.45)}',
'.mapa-pin b{position:absolute;left:14px;top:-6px;white-space:nowrap;background:', T.cab1, ';color:', T.cabTxt, ';',
'font-size:7.6px;padding:2px 5px;border-radius:3px;letter-spacing:.5px}',
// Hitos peatonales: el gimnasio, la parada, el colegio… con nombre y distancia.
'.hito{position:absolute;width:0;height:0}',
'.hito i{position:absolute;left:-4.5px;top:-4.5px;width:9px;height:9px;border-radius:50%;background:', T.oro, ';',
'border:1.6px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)}',
'.hito b{position:absolute;top:-7px;white-space:nowrap;background:rgba(255,255,255,.95);color:#12202e;',
'font-size:6.4px;font-weight:800;padding:1.5px 4px;border-radius:3px;border:1px solid ', T.oro, ';',
'display:flex;gap:3px;align-items:baseline}',
'.hito b em{font-style:normal;font-weight:700;color:', T.txt3, '}',
'.hito.izq b{right:9px}',
'.hito.der b{left:9px}',
'.mapa-tag{position:absolute;top:6px;left:6px;background:', T.cab1, ';color:', T.cabTxt, ';font-size:7.6px;',
'font-weight:800;letter-spacing:.8px;padding:3px 7px;border-radius:4px}',
// La escala va sobre la foto del mapa, que siempre es clara: se deja en
// blanco con texto oscuro incluso en el estilo premium.
'.mapa-escala{position:absolute;bottom:6px;left:6px;background:rgba(255,255,255,.94);color:#12202e;',
'font-size:7px;padding:3px 7px;border-radius:4px;border:1px solid #cfd8e0}',
'.mapa-escala b{color:', T.cab1, '}',
/* Datos generales */
'.datos-generales{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px}',
'.dg{display:flex;gap:5px;align-items:flex-start}',
'.dg span{font-size:9px;line-height:1.2}',
'.dg b{display:block;font-size:7.8px;color:', T.txt2, ';font-weight:700;text-transform:uppercase;letter-spacing:.3px}',
'.dg p{font-size:8px;font-weight:600;line-height:1.25}',
/* KPIs */
'.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:6px}',
'.kpis-6{grid-template-columns:repeat(3,1fr)}',
'.kpi{border:1px solid ', T.borde, ';border-radius:5px;padding:4px 2px;text-align:center;background:', T.suave, '}',
'.kpi span{font-size:10px;display:block;line-height:1}',
'.kpi b{display:block;font-size:11px;color:', T.acento, ';font-weight:800;line-height:1.2}',
'.kpi small{font-size:7px;color:', T.txt2, ';line-height:1.15;display:block}',
/* Tablas */
'table{width:100%;border-collapse:collapse;font-size:8.2px}',
'th{background:', T.cab1, ';color:', T.cabTxt, ';font-size:7.6px;text-transform:uppercase;letter-spacing:.4px;',
'padding:3px 4px;text-align:left;font-weight:700}',
'td{padding:2.4px 4px;border-bottom:1px solid ', T.linea, ';line-height:1.25}',
'tfoot td{background:', T.suave2, ';font-weight:800;border-top:1.5px solid ', T.cab1, '}',
'.num{text-align:right;font-variant-numeric:tabular-nums}',
'.dot{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:4px;vertical-align:middle}',
'.barra{width:26%}.barra i{display:block;height:5px;border-radius:3px}',
'.tbl-mini td{font-size:7px;padding:2px 3px}',
'.tbl-mini .pos{font-weight:800;color:', T.oro, ';width:16px}',
'.tbl-mini .razon{color:', T.txt2, ';font-size:7.4px}',
'.estrellas{color:', T.oro, ';letter-spacing:.6px;white-space:nowrap;width:44px}',
/* Gráficas */
'.chart h3{font-size:7px;color:', T.txt2, ';text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;font-weight:700}',
'.chart img{width:100%;display:block;border-radius:4px}',
/* Viabilidad */
/* Movilidad / exposición vial */
'.expo{display:flex;gap:9px;align-items:center;margin-bottom:5px}',
'.expo-num{font-size:20px;font-weight:900;line-height:1;flex:0 0 auto}',
'.expo-num small{font-size:8px;color:', T.txt3, ';font-weight:700}',
'.expo-info{display:flex;flex-direction:column;gap:3px}',
'.expo-info b{align-self:flex-start;color:#fff;font-size:7.2px;font-weight:800;border-radius:99px;padding:2.5px 8px;letter-spacing:.4px}',
'.expo-info span{font-size:7.4px;color:', T.txt2, '}',
/* Indicadores urbanos */
'.estrato-franja{display:flex;align-items:center;gap:5px;margin-bottom:4px;padding:3px 6px;',
'border-radius:4px;background:', T.suave, ';border-left:2.5px solid ', T.oro, '}',
'.estrato-franja b{font-size:8.4px;color:', T.acento, ';font-weight:900}',
'.estrato-franja b em{font-style:normal;font-weight:700;color:', T.txt2, '}',
'.estrato-franja span{margin-left:auto;font-size:6.6px;font-weight:700;color:', T.txt3, ';',
'text-transform:uppercase;letter-spacing:.3px}',
'.demo-mini{margin-bottom:4px}',
'.demo-bar{display:flex;height:6px;border-radius:3px;overflow:hidden;background:', T.linea, '}',
'.demo-leg{display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:2.5px;font-size:6.8px;color:', T.txt2, '}',
'.demo-leg span{display:inline-flex;align-items:center;gap:3px;font-weight:700}',
'.demo-leg b{width:5px;height:5px;border-radius:2px;display:inline-block}',
'.demo-leg .demo-edad{color:', T.txt3, ';font-weight:600}',
'.tbl-ind td{padding:2.2px 3px;border:none;font-size:7.4px}',
'.tbl-ind .ind-n{white-space:nowrap;color:', T.txt2, '}',
'.tbl-ind .barra{width:32%}',
'.tbl-ind .ind-v{text-align:right;font-weight:800;font-size:7px;white-space:nowrap}',
'.hero-info b small{font-size:8px;color:', T.txt3, ';font-weight:700}',
/* Comparativa multi-radio */
'.tbl-radios{width:100%;border-collapse:collapse}',
'.tbl-radios td,.tbl-radios th{padding:2px 3px;border:none;font-size:7.2px;text-align:right}',
'.tbl-radios .ind-n{text-align:left;white-space:nowrap;color:', T.txt2, ';font-weight:700}',
'.tbl-radios .cab th{background:none;color:', T.txt3, ';font-weight:700;font-size:6.8px;text-transform:uppercase;',
'letter-spacing:.3px;border-bottom:1px solid ', T.borde, '}',
'.tbl-radios .fila-act td{background:', T.suave, ';font-weight:800;color:', T.acento, '}',
'.radio-lectura{font-size:7.2px;color:', T.txt2, ';line-height:1.4;margin-top:4px}',

/* Los anillos dibujados (js/58) y el horario declarado. Las clases son las
   mismas de la pantalla, pero la hoja es CLARA: los grises de allá salen de
   rgba blanco sobre fondo oscuro y acá se verían como manchas. Se repintan
   con los tokens del estilo elegido, que es lo que hace que el informe salga
   igual de bien en el institucional y en el premium oscuro. */
'.urb-anillos-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:0 0 3px}',
'.urb-anillo-mini{margin:0;padding:4px 5px 3px;background:', T.suave,
  ';border:1px solid ', T.borde, ';border-radius:4px}',
'.urb-anillo-mini figcaption{font-size:5.6px;letter-spacing:.2px;text-transform:uppercase;color:', T.txt3, '}',
'.urb-anillo-chispa{display:block;width:100%;height:18px;margin:2px 0 1px;overflow:visible}',
/* El halo del punto sale del color de la HOJA, no de un azul oscuro fijo:
   con el estilo premium el fondo es negro y un halo claro lo delataría. */
'.urb-anillo-punto{stroke:', T.panel, ';stroke-width:1}',
'.urb-anillo-mini b{font-size:8.4px;color:', T.tinta, ';font-variant-numeric:tabular-nums}',
'.urb-anillo-mini b small{font-size:5.4px;color:', T.txt3, ';margin-left:1px}',
'.urb-anillo-forma{display:block;font-size:5.6px;color:', T.txt2, ';margin-top:1px}',
'.urb-anillos-eje{display:flex;justify-content:space-between;align-items:baseline;',
  'margin:0 1px 4px;font-size:5.6px;color:', T.txt3, '}',

'.tbl-horarios{width:100%;border-collapse:collapse;margin-top:2px}',
/* El informe del curso */
'.dato-ref{display:block;font-style:normal;font-size:6.4px;line-height:1.3;margin-top:2px;color:', T.acento, '}',
'.base-edu{border:1px solid ', T.borde, ';border-left:4px solid ', T.acento, ';border-radius:6px;padding:6px 9px;margin-bottom:4px;background:', T.suave, '}',
'.base-edu.flojo{border-left-color:', T.warn, '}',
'.base-edu b{font-size:8.4px;display:block;margin-bottom:2px}.base-edu p{font-size:7.2px;line-height:1.45;color:', T.txt2, '}',
'.base-edu .base-cambios{margin-top:3px;color:', T.tinta, '}.base-edu .base-cambios b{display:inline;font-size:7.2px}',
'.falta{list-style:none;margin:0;padding:0}.falta li{padding:3px 0;border-bottom:1px solid ', T.linea, '}',
'.falta li b{display:block;font-size:7.4px}.falta li b em{font-style:normal;color:', T.warn, ';margin-left:3px}',
'.falta li small{display:block;font-size:6.6px;line-height:1.4;color:', T.txt2, '}',
'.lecturas{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px;margin-top:4px}',
'.lectura{border:1px dashed ', T.warn, ';border-radius:6px;padding:6px 9px;background:', T.hoja, '}',
'.lectura b{display:block;font-size:7.6px;color:', T.tinta, ';margin-bottom:2px}',
'.lectura p{font-size:7.6px;line-height:1.5;color:', T.tinta, ';white-space:pre-wrap}',
'.lectura-general .lectura p{font-size:8.6px;line-height:1.55}',
'.lectura-vacia p{color:', T.txt2, ';font-style:italic}',
'.lectura-lineas{height:34px;margin-top:6px;background:repeating-linear-gradient(to bottom,transparent 0 10px,', T.linea, ' 10px 11px)}',
'.forma-nombre{font-size:10px;font-weight:900;margin:0 0 2px}.forma-nombre em{font-style:normal;font-weight:400;font-size:7px;color:', T.txt3, '}',
'.forma-ojo{color:#B45309 !important}',
'.tbl-comp{width:100%;border-collapse:collapse;font-size:7.4px}.tbl-comp th{text-align:left;font-size:6.8px;text-transform:uppercase;letter-spacing:.3px;color:', T.cab1, ';padding:3px 5px;border-bottom:1px solid ', T.borde, '}',
'.tbl-comp td{padding:3px 5px;border-bottom:1px solid ', T.linea, '}.tbl-comp .n{text-align:right;font-variant-numeric:tabular-nums}.tbl-comp td.g{font-weight:900;color:', T.tinta, '}',
'.ctx-migas{font-size:7.6px;color:', T.tinta, ';font-weight:700;margin:0 0 3px}',
'.ctx-sub{font-size:7px;font-weight:800;color:', T.tinta, ';margin:4px 0 1px;text-transform:uppercase;letter-spacing:.3px}',
'.ctx-rutas{margin:0;padding:0 0 0 10px;font-size:6.8px;color:', T.txt2, ';columns:2;column-gap:8px}',
'.ctx-rutas li{margin:0 0 1px;break-inside:avoid}.ctx-rutas b{color:', T.tinta, '}.ctx-rutas em{opacity:.75}',
'.tbl-horarios td{padding:1.6px 3px;border:none;font-size:7.2px;vertical-align:middle}',
'.tbl-horarios .ind-n{text-align:left;color:', T.txt2, ';width:44%}',
'.tbl-horarios .hor-b{width:34%}',
'.tbl-horarios .hor-b i{display:block;height:5px;border-radius:3px;background:', T.acento, '}',
'.tbl-horarios .hor-n{text-align:right;font-weight:800;color:', T.tinta, ';width:10%;font-variant-numeric:tabular-nums}',
'.tbl-horarios .hor-p{text-align:right;color:', T.txt3, ';width:12%;font-variant-numeric:tabular-nums}',
/* La cobertura, destacada: sin ella «el 50 % abre de noche» pueden ser tres
   locales de doscientos, y en papel nadie vuelve a buscar la letra pequeña. */
'.hor-cob{font-size:7.2px;color:', T.txt2, ';line-height:1.4;margin:0 0 3px;',
  'padding:3px 5px;background:', T.suave2, ';border-left:2px solid ', T.acento, ';border-radius:0 3px 3px 0}',
'.hor-cob b{color:', T.tinta, '}',
'.tarj-t{font-size:8px;margin:0 0 3px;color:', T.tinta, ';font-weight:800}',
'.tarj-t em{font-style:normal;font-weight:400;font-size:6.6px;color:', T.txt3, '}',
'.tbl-vias td{padding:1.8px 3px;border:none;font-size:7.4px}',
// Antes esta celda era nowrap con 96px y puntos suspensivos: "Avenida de La
// Gran Colombia" salía cortada. Ahora parte en dos líneas en vez de recortar.
'.tbl-vias .via-n{max-width:110px;line-height:1.2;overflow-wrap:anywhere}',
'.tbl-vias .via-n em{font-style:normal;color:', T.txt3, ';font-size:7.4px;margin-left:4px;text-transform:capitalize}',
'.tbl-vias .barra{width:40%}',
'.expo-arg{font-size:7.2px;color:', T.txt2, ';line-height:1.4;margin-top:3px}',
'.hero{display:flex;gap:9px;align-items:center;background:linear-gradient(100deg,', T.heroA, ',', T.heroB, ');',
'border:1px solid ', T.borde, ';border-radius:6px;padding:6px 9px;margin-bottom:5px}',
'.hero-est{font-size:21px;line-height:1;color:', T.oro, ';letter-spacing:1.5px;white-space:nowrap;',
'text-shadow:0 1px 0 rgba(0,0,0,.06)}',
'.hero-info{display:flex;flex-direction:column;gap:2px}',
/* Aro de viabilidad: el círculo con el puntaje, junto a las estrellas */
'.gauge{width:42px;height:42px;flex:0 0 auto;display:block}',
'.gauge-n{font-size:13px;font-weight:800;letter-spacing:-.5px}',
'.gauge-s{font-size:4.6px;fill:', T.txt3, ';font-weight:700;letter-spacing:.2px}',
'.hero-info b{font-size:12px;font-weight:900;color:', T.acento, ';line-height:1}',
'.hero-info .nivel{align-self:flex-start;color:#fff;font-size:7.6px;font-weight:800;border-radius:99px;padding:2px 7px;letter-spacing:.5px}',
'.hero-info em{font-style:normal;font-size:7.6px;color:', T.txt2, '}',
'.hero-compat{display:flex;align-items:center;gap:6px;margin-bottom:5px;font-size:8px;color:', T.txt2, '}',
'.hero-compat span{flex:1}',
'.hero-compat b{color:', T.oro, ';font-size:11px;letter-spacing:1px;line-height:1}',
'.hero-compat em{font-style:normal;font-weight:800;color:', T.acento, '}',
'.nivel{display:inline-block}',
'.args{list-style:none;font-size:8px;color:', T.txt2, ';line-height:1.35}',
'.args li{padding-left:7px;position:relative;margin-bottom:1.5px}',
'.args li:before{content:"";position:absolute;left:0;top:4px;width:3px;height:3px;border-radius:50%;background:', T.oro, '}',
/* FODA */
// Tres columnas cuando hay hitos que mostrar; si no, la tercera se colapsa
// sola y las dos primeras se reparten el ancho.
'.flujo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}',
'.flujo-h3{font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:', T.txt2, ';',
'font-weight:800;margin-bottom:4px}',
'.hitos-lista{display:flex;flex-direction:column;gap:3px}',
'.hito-chip{display:flex;align-items:baseline;gap:4px;font-size:7.6px;padding:2.5px 5px;border-radius:4px;',
'background:', T.suave, ';border:1px solid ', T.borde, '}',
'.hito-chip b{font-weight:800;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.hito-chip em{font-style:normal;font-weight:700;color:', T.txt3, '}',
// El gimnasio se resalta: es el hito que más cambia el tránsito de la acera.
'.hito-chip.fuerte{background:rgba(245,185,66,.14);border-color:', T.oro, '}',
'.hitos-nota{font-size:7.4px;line-height:1.45;color:', T.txt2, ';margin-top:5px}',
'.traf{margin-top:2px}',
'.traf-fila{display:flex;align-items:baseline;justify-content:space-between;gap:6px;',
'padding:3px 5px;border-radius:4px;background:', T.suave, ';border:1px solid ', T.borde, '}',
'.traf-fila span{font-size:7.6px;font-weight:700}',
'.traf-fila b{font-size:8.6px;font-weight:800;color:', T.acento, '}',
'.traf-pie{font-size:6.8px;line-height:1.35;color:', T.txt3, ';margin:2px 0 5px}',
'.gen-ej{display:block;font-style:normal;font-size:7px;color:', T.txt3, ';font-weight:600;line-height:1.25}',
'.flujo-med{margin-bottom:7px}',
'.flujo-cab{display:flex;align-items:baseline;gap:6px;margin-bottom:3px}',
'.flujo-cab b{font-size:9.5px;font-weight:800}',
'.flujo-cab span{margin-left:auto;font-size:8.5px;font-weight:800}',
'.flujo-barra{height:9px;border-radius:5px;background:#e9edf2;overflow:hidden}',
'.flujo-barra.alta{height:7px;flex:1}',
'.flujo-barra i{display:block;height:100%;border-radius:5px}',
'.flujo-lectura{font-size:8.5px;line-height:1.5;margin-top:5px}',
'.flujo-tabla{width:100%;border-collapse:collapse;font-size:8px}',
'.flujo-tabla th{text-align:left;font-size:7.5px;text-transform:uppercase;letter-spacing:.3px;padding:3px 5px;border-bottom:1px solid #d9e2ea}',
'.flujo-tabla td{padding:3px 5px;border-bottom:1px solid #eef2f6}',
'.flujo-tabla td.n{text-align:right;font-weight:700}',
'.flujo-horas{margin-top:6px;display:flex;flex-direction:column;gap:4px}',
'.flujo-hora{display:flex;align-items:center;gap:6px}',
'.flujo-hora small{font-size:7.5px;width:44px;flex:0 0 auto}',
'.flujo-hora b{font-size:8px;width:22px;text-align:right;flex:0 0 auto}',
'.flujo-vacio{font-size:8.5px;line-height:1.5}',
// La advertencia de que esto es un potencial y no un aforo nunca tuvo estilo
// propio: salía con la letra por defecto del navegador, enorme, y se comía la
// hoja obligando al auto-ajuste a encoger todo lo demás.
'.pie-nota{font-size:7.2px;line-height:1.45;color:', T.txt3, ';margin-top:6px;font-style:italic}',

/* ── Mapas de calor ──────────────────────────────────────────────── */
// Los tres paneles comparten fila y ancho. `min-width:0` es obligatorio en
// una rejilla: sin él, el panel se niega a encoger por debajo de su
// contenido y el tercero se sale de la hoja.
'.calor-fila{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;align-items:start}',
'.calor-panel{min-width:0}',
'.calor-panel h3{margin:0 0 4px;font-size:8.6px;font-weight:700;color:', T.tinta, ';letter-spacing:.2px}',
'.calor-panel h3 em{display:block;font-style:normal;font-weight:400;font-size:7.2px;color:', T.txt3, '}',
// La capa se centra sobre el mismo círculo que dibuja `.mapa-radio`: si se
// estirara al recuadro entero, el calor quedaría corrido respecto al lote.
'.calor-capa{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);opacity:.72;pointer-events:none}',
'.calor-foco{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border:1.6px solid #fff;',
  'border-radius:50%;background:transparent;box-shadow:0 0 0 1.4px rgba(0,0,0,.55)}',
'.calor-foco-txt{margin:4px 0 0;font-size:7.4px;line-height:1.4;color:', T.txt2, '}',
'.calor-pie{margin-top:6px}',
'.anillo{display:flex;align-items:center;gap:6px;font-size:8px;margin-top:4px}',
'.anillo>span{flex:0 0 58px;color:', T.txt2, '}',
'.anillo>b{flex:0 0 26px;text-align:right;color:', T.acento, '}',
'.anillo-ej{margin:1px 0 0 64px;font-size:6.8px;line-height:1.35;color:', T.txt3, '}',
'.nucleo{margin:6px 0 0;padding:5px 7px;border-radius:5px;font-size:7.6px;line-height:1.45;',
  'background:', T.acento, '14;border:1px solid ', T.acento, '40}',
'.voc-titulo{margin:0 0 3px;font-size:9.4px;font-weight:700;color:', T.acento, '}',
/* ── Crecimiento de la población ─────────────────────────────────── */
'.pobl{margin-top:6px}',
'.pobl-cifras{display:flex;align-items:center;gap:8px;margin:5px 0 4px}',
'.pobl-cifras>div{display:flex;flex-direction:column;line-height:1.15}',
'.pobl-cifras small{font-size:6.8px;color:', T.txt3, '}',
'.pobl-cifras b{font-size:13px;color:', T.tinta, '}',
'.pobl-cifras em{font-size:6.4px;font-style:normal;color:', T.txt3, '}',
'.pobl-cifras .fl{color:', T.txt3, ';font-size:11px}',
'.pobl-cifras .delta{margin-left:auto;align-self:center;font-size:9px;font-weight:700;',
  'color:#fff;background:', T.acento, ';padding:2px 7px;border-radius:999px}',
// `preserveAspectRatio=none` estira el trazo a lo ancho de la tarjeta;
// `vector-effect` evita que al estirarse la línea engorde con él.
'.pobl-svg{display:block;width:100%;height:40px}',
'.pobl-eje{display:flex;justify-content:space-between;font-size:6.4px;color:', T.txt3, ';margin-top:2px}',
'.voc-titulo em{font-style:normal;font-weight:400;font-size:7.6px;color:', T.txt3, '}',
'.voc-lectura{margin:0 0 6px;font-size:8px;line-height:1.45;color:', T.txt2, '}',
'.calor-leyenda{display:inline-flex;align-items:center;gap:5px;font-size:7px;color:', T.txt3, ';margin-right:14px}',
'.calor-leyenda i{display:block;width:78px;height:7px;border-radius:3px}',
'.calor-leyenda.peaton i{background:linear-gradient(90deg,rgba(120,190,60,.45),rgba(245,205,60,.75),rgba(214,40,40,.9))}',
'.calor-leyenda.vehiculo i{background:linear-gradient(90deg,rgba(70,130,220,.45),rgba(110,110,225,.75),rgba(120,20,150,.9))}',
'.resta{border:1px solid ', T.bad, '33;border-radius:6px;padding:6px 8px;background:', T.bad, '0d}',
'.resta h3{margin:0 0 4px;font-size:8.4px;font-weight:700;color:', T.bad, '}',
'.resta-fila{display:flex;justify-content:space-between;gap:6px;font-size:7.6px;',
  'padding:2px 0;border-bottom:1px solid ', T.bad, '22}',
'.resta-fila:last-child{border-bottom:none}',
'.resta-fila em{font-style:normal;color:', T.txt3, '}',
'.resta-fila b{color:', T.bad, ';white-space:nowrap}',
'.flujo-aviso{font-size:8.5px;line-height:1.5;margin-top:6px;padding:5px 7px;border-radius:4px;',
  'background:rgba(245,185,66,.12);border:1px solid rgba(245,185,66,.45)}',
'.foda-grid4{display:grid;grid-template-columns:repeat(', (horizontal ? '4' : '2'), ',1fr);gap:5px}',
'.foda{border:1px solid;border-radius:5px;padding:4px 6px}',
'.foda h3{font-size:7px;margin-bottom:2px;font-weight:800}',
'.foda ul{list-style:none;font-size:7.4px;line-height:1.3;color:', T.txt2, '}',
'.foda li{padding-left:6px;position:relative;margin-bottom:1px}',
'.foda li:before{content:"·";position:absolute;left:1px;font-weight:900}',
'.foda .vacio{color:', T.txt3, ';font-style:italic}',
'.foda.f{border-color:', T.fodaF[0], ';background:', T.fodaF[1], '}.foda.f h3{color:', T.ok, '}',
'.foda.d{border-color:', T.fodaD[0], ';background:', T.fodaD[1], '}.foda.d h3{color:', T.bad, '}',
'.foda.o{border-color:', T.fodaO[0], ';background:', T.fodaO[1], '}.foda.o h3{color:', T.info, '}',
'.foda.r{border-color:', T.fodaR[0], ';background:', T.fodaR[1], '}.foda.r h3{color:', T.warn, '}',
'.recos{list-style:none;font-size:8px;line-height:1.35;color:', T.txt2, '}',
'.recos li{padding-left:8px;position:relative;margin-bottom:2px}',
'.recos li:before{content:"▸";position:absolute;left:0;color:', T.oro, ';font-weight:900}',
/* Conclusión + pie */
'.conclusion{margin-top:6px;background:', T.suave, ';border-left:2.5px solid ', T.acento, ';border-radius:4px;',
'padding:5px 8px;font-size:8px;line-height:1.4;color:', T.txt2, '}',
'footer{margin-top:7px;padding-top:5px;border-top:1px solid ', T.borde, ';font-size:6.8px;',
'color:', T.txt3, ';display:flex;justify-content:space-between;gap:10px}',
/* ══ Diagramación en tres hojas ══════════════════════════════════════ */
/* Cabecera de sección numerada: es lo que le da hilo narrativo al informe. */
'.sec{display:flex;align-items:baseline;gap:7px;margin:9px 0 5px;padding-bottom:3px;',
'border-bottom:1.6px solid ', T.oro, '}',
'.sec b{font-size:10px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;color:', T.cab1, '}',
'.sec em{font-style:normal;font-size:7.6px;color:', T.txt3, ';font-weight:600}',
'.sec:first-of-type{margin-top:7px}',
/* Tarjeta genérica: una sola definición para todo el informe. */
'.tarjeta{border:1px solid ', T.borde, ';border-radius:7px;padding:7px 9px;background:', T.panel, ';',
'display:flex;flex-direction:column;min-width:0}',
'.tarjeta h2{font-size:8.6px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;',
'color:', T.cab1, ';margin-bottom:5px}',
'.tarjeta .h2-sep{margin-top:8px}',
/* El rótulo de escala (v1043). Va pegado debajo del título, así que el
   título cede su margen: con los dos el rótulo se leía como el primer
   renglón del cuerpo y no como parte del encabezado. */
'.tarjeta h2:has(+ .aia-escala),.bloque h2:has(+ .aia-escala),.tarj-t:has(+ .aia-escala){margin-bottom:1px}',
'.aia-escala{font-size:6.2px;letter-spacing:.5px;text-transform:uppercase;font-weight:700;',
'color:', T.txt3, ';margin:0 0 5px}',
/* Sin declarar va en rojo: un panel sin rótulo deja que el lector suponga
   que la cifra es del radio, que es justo lo que la tabla evita. */
'.aia-escala-sin{color:', T.bad, '}',
/* La franja «sobre qué se analizó» (v1043). Va arriba del todo, así que se
   lee antes de la primera cifra; en ámbar cuando los usos no alcanzan. */
'.aia-base{border:1px solid ', T.borde, ';border-left:3px solid ', T.ok, ';border-radius:5px;',
'padding:5px 8px;margin:7px 0 0;background:', T.panel, '}',
'.aia-base.flojo{border-left-color:', T.warn, ';background:#fff8ec}',
'.aia-base b{display:block;font-size:7.6px;color:', T.tinta, ';line-height:1.35}',
'.aia-base p{font-size:6.9px;line-height:1.4;color:', T.txt3, ';margin:2px 0 0}',
'.aia-base-esc{border-top:1px dashed ', T.borde, ';padding-top:2px;color:', T.bad, ' !important}',
/* «Sin medir» (v1044): el mismo ámbar con el que la franja de arriba avisa
   de pocos usos, porque es la misma clase de aviso —una tarea para quien
   analiza, no una conclusión para quien decide—. */
'.aia-sinmedir{border:1px dashed ', T.warn, ';border-radius:5px;padding:5px 7px;background:#fff8ec}',
'.aia-sinmedir b{display:block;font-size:8.6px;font-weight:900;letter-spacing:.8px;color:', T.warn, '}',
'.aia-sinmedir p{font-size:6.9px;line-height:1.4;color:', T.txt3, ';margin:2px 0 0}',
'.aia-sinmedir-como{color:', T.ok, ' !important;font-weight:600}',
'.ejec-sinmedir{display:block}',
/* La tabla de método (v1045). Compacta a propósito: son dieciséis filas y
   la hoja mide lo que mide —el informe no bisecta—, así que el ancho de
   cada columna se reparte por lo que cada campo necesita y no a partes
   iguales. Medido: con esto las dieciséis caben en su hoja. */
'.tbl-met{width:100%;border-collapse:collapse;margin-top:4px;table-layout:fixed}',
'.tbl-met th{font-size:6.2px;text-transform:uppercase;letter-spacing:.5px;text-align:left;',
'color:', T.acento, ';border-bottom:1px solid ', T.borde, ';padding:0 4px 2px 0}',
'.tbl-met td{font-size:6.9px;line-height:1.35;color:', T.txt3, ';vertical-align:top;',
'padding:2.5px 4px 2.5px 0;border-bottom:1px solid ', T.borde, '}',
'.tbl-met th:nth-child(1),.tbl-met td:nth-child(1){width:17%}',
'.tbl-met th:nth-child(2),.tbl-met td:nth-child(2){width:24%}',
'.tbl-met th:nth-child(3),.tbl-met td:nth-child(3){width:33%}',
'.tbl-met .met-p{font-weight:800;color:', T.tinta, '}',
'.tbl-met .met-l{color:', T.tinta, '}',
/* Un panel compuesto sin método lo dice en rojo, no falta de la tabla. */
'.tbl-met .met-sin td{color:', T.bad, ';font-weight:700}',
'.vacio-aia{border:.6px dashed ', T.warn, ';border-radius:3px;padding:4px 5px;margin-top:4px;',
  'break-inside:avoid}',
'.vacio-aia .vacio-t{font-size:7.4px;font-weight:800;color:', T.tinta, ';margin:0 0 2px}',
'.vacio-aia .vacio-tag{font-size:6.2px;text-transform:uppercase;letter-spacing:.5px;font-weight:800;',
  'color:', T.warn, ';margin:0 0 2px}',
'.vacio-aia .vacio-tag-ok{color:', T.ok, ';margin-top:3px}',
'.vacio-aia .vacio-falta,.vacio-aia .vacio-hay,.vacio-aia .vacio-mientras{font-size:6.9px;',
  'line-height:1.35;color:', T.txt3, ';margin:0 0 2px}',
'.vacio-aia b{color:', T.tinta, '}',
'.vacio-aia .vacio-mientras{color:', T.ok, '}',
'.vacio-aia .vacio-mientras b{color:', T.ok, '}',
'.vacio-aia .vacio-mientras em{color:', T.txt3, ';font-style:normal;display:block}',
'.comoq{display:grid;grid-template-columns:1fr 1fr;gap:1px 6px}',
'.comoq .vq{display:flex;gap:3px;align-items:baseline}',
'.comoq .vq i{font-size:6.2px;text-transform:uppercase;letter-spacing:.4px;font-weight:800;',
  'color:', T.ok, ';font-style:normal;flex:0 0 auto}',
'.comoq .vq span{font-size:6.9px;line-height:1.3;color:', T.txt3, '}',
'.nota-pie{font-size:6.9px;line-height:1.4;color:', T.txt3, ';margin-top:5px}',
/* El aro vive en una caja de tamaño fijo que nada puede invadir: ese es el
   defecto que se venía repitiendo —una barra de ancho completo cruzándolo—. */
'.aro-caja{flex:0 0 auto;line-height:0}',
'.aro{display:block}',
/* 1 · Lectura ejecutiva */
'.ejec{display:flex;align-items:center;gap:14px;border:1px solid ', T.borde, ';border-radius:9px;',
'padding:10px 14px;background:', T.suave, '}',
'.ejec .aro-caja .aro{width:38mm;height:38mm}',
'.ejec-txt{flex:1;min-width:0}',
'.ejec-rot{display:block;font-size:9.5px;font-weight:900;letter-spacing:.8px;color:', T.cab1, '}',
'.ejec-nivel{display:block;font-size:19px;font-weight:900;line-height:1.15;margin-top:1px}',
'.ejec-est{font-size:15px;color:', T.oro, ';letter-spacing:2px;line-height:1.2}',
'.ejec-frase{font-size:8.4px;line-height:1.5;color:', T.txt2, ';margin-top:4px}',
'.ejec-chips{flex:0 0 auto;display:flex;flex-direction:column;gap:6px}',
'.chip{display:block;text-align:center;color:#fff;font-size:8.4px;font-weight:800;',
'padding:4px 14px;border-radius:5px;white-space:nowrap}',
'.chip-oro{background:', T.oro, ';color:#3a2c05}',
/* 2 · Los seis datos */
'.seis{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}',
'.dato{border:1px solid ', T.borde, ';border-radius:7px;background:', T.suave, ';',
'padding:7px 4px;text-align:center}',
'.dato b{display:block;font-size:15px;font-weight:900;line-height:1.1}',
'.dato span{display:block;font-size:7.6px;font-weight:700;color:', T.tinta, ';margin-top:3px}',
'.dato small{display:block;font-size:6.8px;color:', T.txt3, ';margin-top:1px}',
/* 3 · Oportunidad urbana — aro arriba, lista debajo, nunca superpuestos */
'.oport-cab{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
'.oport-cab .aro{width:19mm;height:19mm}',
'.oport-nivel{display:block;font-size:14px;font-weight:900;line-height:1.1}',
'.oport-est{font-size:11px;color:', T.oro, ';letter-spacing:1.5px}',
'.tbl-oport{width:100%;border-collapse:collapse;font-size:8px}',
'.tbl-oport td{padding:2.5px 0;border-bottom:1px solid ', T.linea, '}',
'.tbl-oport td.pos{width:22px;font-weight:900;color:', T.ok, '}',
'.tbl-oport td.razon{text-align:right;color:', T.txt3, ';font-size:7.4px}',
/* 3 · Cómo leer el informe */
'.leer{display:grid;grid-template-columns:1fr 1fr;gap:4px}',
'.leer div{border:1px solid ', T.borde, ';border-radius:5px;padding:4px 6px;background:', T.suave, '}',
'.leer b{display:block;font-size:7.4px;color:', T.acento, ';font-weight:800}',
'.leer small{display:block;font-size:6.8px;color:', T.txt2, ';line-height:1.3;margin-top:1px}',
/* 4 · Lo más importante */
'.clave{display:grid;grid-template-columns:1.1fr 1.3fr 1.6fr;gap:7px;align-items:stretch;',
'border:1px solid ', T.borde, ';border-radius:7px;padding:8px 10px;background:', T.panel, '}',
'.cl-flujo{margin-bottom:6px}',
'.cl-cab{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-bottom:2px}',
'.cl-cab b{font-size:8px;font-weight:900;letter-spacing:.4px;color:', T.cab1, '}',
'.cl-cab span{font-size:7.6px;font-weight:800}',
'.cl-barra{height:7px;border-radius:4px;background:', T.linea, ';overflow:hidden}',
'.cl-barra i{display:block;height:100%;border-radius:4px}',
'.cl-lectura{border-left:2.5px solid ', T.acento, ';background:', T.suave, ';border-radius:4px;padding:6px 8px}',
'.cl-lectura b{display:block;font-size:7.6px;font-weight:900;color:', T.acento, ';letter-spacing:.5px}',
'.cl-lectura p{font-size:8.2px;line-height:1.45;font-weight:700;margin-top:3px}',
'.cl-donde{margin-top:5px;padding-top:4px;border-top:1px solid ', T.borde, '}',
'.cl-donde b{display:block;font-size:7.2px;font-weight:900;color:', T.oro, ';letter-spacing:.4px}',
'.cl-donde p{font-size:7.4px;line-height:1.4;font-weight:600;color:', T.txt2, ';margin-top:2px}',
'.cl-minis{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}',
'.cl-minis div{border:1px solid ', T.borde, ';border-radius:5px;padding:5px 6px;background:', T.suave, '}',
'.cl-minis b{display:block;font-size:7.2px;font-weight:900;color:', T.cab1, ';letter-spacing:.4px}',
'.cl-minis small{display:block;font-size:6.9px;color:', T.txt2, ';line-height:1.35;margin-top:2px}',
/* 5 · Viabilidad en detalle */
'.sub-nivel{font-size:9px;font-weight:800;margin-bottom:2px}',
'.sub-fila{display:flex;align-items:center;gap:7px;margin-top:4px}',
'.sub-fila span{flex:0 0 68px;font-size:7.8px;font-weight:700}',
'.sub-barra{flex:1;height:7px;border-radius:4px;background:', T.linea, ';overflow:hidden}',
'.sub-barra i{display:block;height:100%;border-radius:4px}',
/* El número va en su propia columna: dentro de la barra desaparecía al 100 %. */
'.sub-fila b{flex:0 0 22px;text-align:right;font-size:7.8px;font-weight:800}',
'.sub-resumen{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}',
'.sub-resumen div{border:1px solid ', T.borde, ';border-radius:5px;padding:4px 6px;background:', T.suave, '}',
'.sub-resumen b{display:block;font-size:7px;font-weight:900;letter-spacing:.4px}',
'.sub-resumen span{display:block;font-size:7.4px;color:', T.txt2, ';margin-top:1px}',
'.et-ok{color:', T.ok, '}.et-bad{color:', T.bad, '}',
/* 6 · Qué trae gente a pie */
// Tres columnas: la tabla de lo que suma, las horas con sus hitos, y lo que
// resta. `min-width:0` para que ninguna se niegue a encoger y desborde.
'.gente{display:grid;grid-template-columns:1.5fr 1fr .9fr;gap:6px;align-items:start}',
'.gente>*{min-width:0}',
'.tbl-gente{width:100%;border-collapse:collapse;font-size:8px}',
'.tbl-gente th{background:none;text-align:left;font-size:7.2px;text-transform:uppercase;letter-spacing:.4px;',
'color:', T.cab1, ';padding:3px 4px;border-bottom:1px solid ', T.borde, '}',
'.tbl-gente td{padding:3.5px 4px;border-bottom:1px solid ', T.linea, ';font-weight:700}',
'.tbl-gente td em{display:block;font-style:normal;font-size:6.9px;color:', T.txt3, ';font-weight:600}',
'.tbl-gente th.n,.tbl-gente td.n{text-align:right;width:44px}',
'.hf{display:flex;align-items:center;gap:6px;margin-top:4px}',
'.hf span{flex:0 0 48px;font-size:7.8px;font-weight:700}',
'.hf b{flex:0 0 20px;text-align:right;font-size:7.8px;font-weight:800;color:', T.acento, '}',
'.hito-fila{display:flex;align-items:baseline;justify-content:space-between;gap:6px;',
'padding:2.5px 0;border-bottom:1px solid ', T.linea, ';font-size:7.6px}',
'.hito-fila span{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.hito-fila b{flex:0 0 auto;color:', T.acento, ';font-weight:800}',
'.hito-fila.fuerte{background:rgba(245,185,66,.16);border-radius:4px;padding-left:4px;padding-right:4px;',
'border-bottom-color:', T.oro, '}',
/* Franja de tránsito */
'.transito{display:flex;align-items:center;gap:16px;margin-top:6px;border:1px solid ', T.borde, ';',
'border-radius:7px;padding:7px 12px;background:', T.suave, '}',
'.tr-rot{font-size:8.4px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:', T.cab1, ';flex:0 0 auto}',
'.tr-par{flex:0 0 auto;display:flex;align-items:baseline;gap:6px}',
'.tr-par b{font-size:13px;font-weight:900;color:', T.acento, '}',
'.tr-par span{font-size:7.4px;color:', T.txt3, '}',
'.tr-notas{flex:1;min-width:0;text-align:right}',
'.tr-notas small{display:block;font-size:6.6px;color:', T.txt3, ';line-height:1.35}',
/* 7 · Composición */
'.comp-fila{display:flex;align-items:center;gap:7px;margin-top:3.5px}',
// Subtítulo dentro de una tarjeta: separa época, material y vulnerabilidad
// sin gastar una tarjeta entera en cada uno.
'.mini{font-size:7pt;letter-spacing:.06em;text-transform:uppercase;margin:7px 0 2px;color:', T.txt3, ';font-weight:700}',
'.comp-fila span{flex:0 0 108px;font-size:7.6px;font-weight:700}',
'.comp-barra{flex:1;height:7px;border-radius:4px;background:', T.linea, ';overflow:hidden}',
'.comp-barra i{display:block;height:100%;border-radius:4px}',
'.comp-fila b{flex:0 0 30px;text-align:right;font-size:7.8px;font-weight:800}',
'.comp-fila em{flex:0 0 34px;text-align:right;font-style:normal;font-size:7.2px;color:', T.txt3, '}',
/* 7 · Indicadores */
'.ind-fila{display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid ', T.linea, '}',
'.ind-fila span{flex:0 0 120px;font-size:7.8px;font-weight:700}',
'.ind-fila b{font-size:8px;font-weight:800}',
'.ind-fila em{margin-left:auto;font-style:normal;font-size:6.8px;color:', T.txt3, ';text-align:right}',
/* 8 · Radios */
'.tbl-radios2{width:100%;border-collapse:collapse;font-size:8.2px}',
'.tbl-radios2 th{background:none;text-align:left;font-size:7.2px;text-transform:uppercase;letter-spacing:.4px;',
'color:', T.cab1, ';padding:4px 6px;border-bottom:1px solid ', T.borde, '}',
'.tbl-radios2 td{padding:5px 6px;border-bottom:1px solid ', T.linea, '}',
'.tbl-radios2 tr.fila-act td{font-weight:900;background:', T.suave, '}',
'.tbl-radios2 td:first-child{font-weight:800}',
/* 9b · Qué proyecto pediría el sector (solo el informe del curso). La medida
   va con el color del acento y en cursiva: es lo que separa un encargo
   sostenido en un dato de una recomendación suelta. */
'.ideas-proy{margin-top:7px}',
'.ideas-proy h3{margin:0 0 2px;font-size:8.4px;letter-spacing:.5px;color:', T.cab1, '}',
'.ideas-nota{margin:0 0 5px;font-size:7.2px;line-height:1.35;color:', T.txt3, '}',
'.ideas-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}',
'.idea{border:1px solid ', T.borde, ';border-radius:5px;padding:6px 7px;background:', T.suave, '}',
'.idea h4{margin:0 0 3px;font-size:7.8px;line-height:1.25}',
'.idea p{margin:0;font-size:7.2px;line-height:1.35}',
'.idea-medida{margin:0 0 3px !important;font-style:italic;color:', T.cab1, '}',
/* 9 · Siguiente paso */
'.paso{margin-top:6px;background:', T.cab1, ';color:', T.cabTxt, ';border-radius:5px;',
'padding:6px 10px;text-align:center;font-size:8px;font-weight:800;letter-spacing:.3px}',
/* Rejillas de las tres hojas */
'.fila.tres{grid-template-columns:1fr 1fr 1fr}',
'.fila.dos{grid-template-columns:1fr 1fr}',
'.fila.dos-13{grid-template-columns:1fr 1.3fr}',
'</style></head><body><div id="marco">',

(edu ? cuerpoEdu() : cuerpoEmpresa()),
// Auto-diagramación: ajusta el contenido para LLENAR exactamente una hoja
// (lo encoge si sobra y lo agranda si falta, así no quedan espacios en
// blanco), y en pantalla encaja la hoja completa en el ancho disponible.
'<script>(function(){',
// Cada hoja se ajusta por separado: la 1 suele sobrar espacio (y se agranda
// para llenarla) y la 2 suele ir justa (y se encoge lo necesario).
'function ajustarUna(h){var c=h.querySelector(".contenido");',
'if(!c)return;var disp=h.clientHeight,k=1;',
'for(var i=0;i<18;i++){c.style.width=(100/k)+"%";c.style.transform="scale("+k+")";',
'var vis=c.scrollHeight*k;if(!vis)break;var nk=k*(disp/vis);',
// Piso 0.62: por debajo la letra queda ilegible y, como la hoja recorta lo que
// sobra, el texto se cortaba a media frase. Se prefiere avisar antes que
// entregar una hoja mutilada.
'if(nk>1.5)nk=1.5;if(nk<0.62)nk=0.62;if(Math.abs(nk-k)<0.003){k=nk;break;}k=nk;}',
'c.style.width=(100/k)+"%";c.style.transform="scale("+k+")";',
'for(var g=0;g<10&&c.scrollHeight*k>disp&&k>0.62;g++){k*=0.985;c.style.width=(100/k)+"%";c.style.transform="scale("+k+")";}',
'if(c.scrollHeight*k>disp+2){var av=h.querySelector(".aviso-corte");',
'if(!av){av=document.createElement("div");av.className="aviso-corte";',
'av.style.cssText="position:absolute;left:0;right:0;bottom:0;background:#b91c1c;color:#fff;'+
'font-size:7.5px;font-weight:800;text-align:center;padding:2px 4px;letter-spacing:.3px";',
'av.textContent="Contenido extenso: revise el informe completo en la app.";',
'h.appendChild(av);}}}',
'function ajustarHoja(){var hs=document.querySelectorAll(".hoja");',
'for(var i=0;i<hs.length;i++)ajustarUna(hs[i]);}',
'function ajustarPantalla(){var m=document.getElementById("marco"),h=document.querySelector(".hoja");',
'if(!m||!h)return;m.style.transform="none";m.style.marginLeft="0px";',
'var esc=Math.min(1,(window.innerWidth-16)/h.offsetWidth);',
'm.style.transform="scale("+esc+")";',
'm.style.marginLeft=Math.max(0,(window.innerWidth-16-h.offsetWidth*esc)/2)+"px";',
'document.body.style.height=(m.scrollHeight*esc+16)+"px";}',
'function todo(){ajustarHoja();ajustarPantalla();}',
'window.addEventListener("load",function(){todo();setTimeout(todo,350);});',
'window.addEventListener("resize",ajustarPantalla);',
'window.addEventListener("beforeprint",function(){var m=document.getElementById("marco");',
'if(m){m.style.transform="none";m.style.marginLeft="0px";}document.body.style.height="";ajustarHoja();});',
'window.addEventListener("afterprint",ajustarPantalla);setTimeout(todo,120);})();<\/script>',
'</body></html>'
    ].join('');
  }

  // ── B) LISTADO COMPLETO DE PUNTOS — documento de trabajo ────────────────
  function construirHTMLListado(r, opciones){
    opciones = opciones || {};
    const G = window.AIA_MOTOR.GRUPOS, C = window.AIA_MOTOR.GRUPO_COLOR;
    const titulo = opciones.titulo || r.meta.proyectoNombre || 'Urbis para Empresas';
    const fecha = new Date(r.meta.fechaISO).toLocaleString('es-CO', { dateStyle:'long', timeStyle:'short' });
    const radioTxt = r.meta.radioM >= 1000 ? (r.meta.radioM / 1000) + ' km' : r.meta.radioM + ' m';

    // Agrupar por categoría de la Matriz (dentro de cada grupo, por cercanía).
    const porGrupo = {};
    (r.pois || []).forEach(p => { (porGrupo[p.grupo] = porGrupo[p.grupo] || []).push(p); });
    Object.keys(porGrupo).forEach(g => porGrupo[g].sort((a, b) => a.distM - b.distM));

    const sinClasificar = porGrupo.otro || [];
    const gruposOrdenados = Object.keys(porGrupo).filter(g => g !== 'otro')
      .sort((a, b) => porGrupo[b].length - porGrupo[a].length);

    const seccion = (g) => {
      const lista = porGrupo[g];
      return '<section><h2 style="border-left-color:' + C[g] + '">' + G[g].i + ' ' + esc(G[g].t) +
        ' <em>(' + lista.length + ' punto' + (lista.length === 1 ? '' : 's') + ')</em></h2>' +
        '<table><thead><tr><th style="width:34px">#</th><th>Punto</th><th>Tipo de uso</th><th class="num" style="width:60px">Distancia</th></tr></thead><tbody>' +
        lista.map((p, i) => '<tr><td class="idx">' + (i + 1) + '</td><td>' + p.icono + ' ' + esc(p.nombre) + '</td>' +
          '<td class="sub">' + esc(p.sub.replace(/_/g, ' ')) + '</td><td class="num">' + numEs(p.distM) + ' m</td></tr>').join('') +
        '</tbody></table></section>';
    };

    const bloqueSinClasificar = sinClasificar.length ? (
      '<section class="pendiente"><h2>❓ Usos sin clasificar <em>(' + sinClasificar.length + ')</em></h2>' +
      '<p class="nota">Estos puntos no calzaron con ninguna categoría de la Matriz de Usos. Se incluyen sus etiquetas de OpenStreetMap para poder identificarlos y asignarles categoría.</p>' +
      '<table><thead><tr><th style="width:34px">#</th><th>Punto</th><th>Etiquetas OpenStreetMap</th><th class="num" style="width:60px">Distancia</th></tr></thead><tbody>' +
      sinClasificar.map((p, i) => {
        const t = p.tags || {};
        const pares = Object.keys(t).filter(k => !/^(name|addr:|name:|source|check_date|wikidata|wikipedia)/.test(k))
          .map(k => k + '=' + t[k]).join(' · ') || '(sin etiquetas útiles)';
        return '<tr><td class="idx">' + (i + 1) + '</td><td>' + esc(p.nombre) + '</td>' +
          '<td class="tags">' + esc(pares) + '</td><td class="num">' + numEs(p.distM) + ' m</td></tr>';
      }).join('') + '</tbody></table></section>'
    ) : '<section class="ok"><h2>✅ Sin usos pendientes</h2><p class="nota">Todos los puntos del radio quedaron clasificados dentro de la Matriz de Usos.</p></section>';

    return [
'<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><base href="', location.href, '">',
'<title>Listado de puntos · ', esc(titulo), '</title><style>',
'@page{size:letter portrait;margin:14mm}',
'*{box-sizing:border-box;margin:0;padding:0}',
'body{font-family:"Segoe UI",Arial,sans-serif;color:', TINTA, ';font-size:9px;',
'-webkit-print-color-adjust:exact;print-color-adjust:exact}',
'header{display:flex;align-items:center;gap:10px;background:', VERDE, ';color:#fff;padding:10px 14px;border-radius:6px;margin-bottom:10px}',
'header img{width:32px;height:32px;object-fit:contain;border-radius:7px;background:#fff;flex:0 0 auto}',
'header h1{font-size:15px;font-weight:800}',
'header p{font-size:8px;color:', ORO, ';text-transform:uppercase;letter-spacing:1px;font-weight:700}',
'header .meta{margin-left:auto;text-align:right;font-size:7.5px;color:rgba(255,255,255,.85);line-height:1.4}',
'.resumen{background:#f0f9fe;border:1px solid #c7e7f7;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:8.5px;line-height:1.5}',
'.resumen b{color:', VERDE_CLARO, '}',
'section{margin-bottom:14px;break-inside:auto}',
'h2{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:', VERDE, ';font-weight:800;',
'border-left:4px solid ', VERDE_CLARO, ';padding:3px 0 3px 8px;margin-bottom:5px;break-after:avoid}',
'h2 em{font-style:normal;color:#7d8b9a;font-weight:600;text-transform:none;letter-spacing:0}',
'table{width:100%;border-collapse:collapse;font-size:8px}',
'thead{display:table-header-group}',
'th{background:#e8f5fd;color:', VERDE, ';text-align:left;padding:4px 6px;font-size:7.5px;',
'text-transform:uppercase;letter-spacing:.4px;border-bottom:1.5px solid ', VERDE_CLARO, '}',
'td{padding:3px 6px;border-bottom:1px solid #e9f4fb;line-height:1.3}',
'tr{break-inside:avoid}',
'.num{text-align:right;font-variant-numeric:tabular-nums;color:#5a6a7a}',
'.idx{color:#9aa7b4;font-variant-numeric:tabular-nums}',
'.sub{color:#6b7a8a;text-transform:capitalize}',
'.tags{color:#6b7a8a;font-family:Consolas,monospace;font-size:7px;word-break:break-word}',
'.pendiente h2{border-left-color:#FF00AA;color:#a1006b}',
'.pendiente{background:#fff5fb;border:1px solid #f6c8e4;border-radius:6px;padding:8px 10px}',
'.ok h2{border-left-color:#15803d;color:#15803d}',
'.nota{font-size:7.5px;color:#6b7a8a;margin-bottom:6px;line-height:1.4}',
'footer{margin-top:14px;border-top:1px solid #cfe6f5;padding-top:6px;font-size:7px;color:#8a97a5}',
'</style></head><body>',
'<header><img src="assets/brand/urbis-logo.png" onerror="this.style.display=\'none\'">',
'<div><h1>Listado completo de puntos</h1><p>Documento de trabajo · URBIS</p></div>',
'<div class="meta">', esc(titulo), '<br>', esc(fecha), '</div></header>',
'<div class="resumen"><b>Ubicación:</b> ', r.meta.lat.toFixed(6), ', ', r.meta.lng.toFixed(6),
' &nbsp;·&nbsp; <b>Radio:</b> ', radioTxt, ' (~', r.stats.areaHa, ' ha)',
' &nbsp;·&nbsp; <b>Total de puntos:</b> ', numEs(r.stats.total),
' &nbsp;·&nbsp; <b>Sin clasificar:</b> ', sinClasificar.length, '</div>',
bloqueSinClasificar,
gruposOrdenados.map(seccion).join(''),
'<footer>Datos abiertos © OpenStreetMap contributors · Clasificación según la Matriz de Usos de URBIS · Generado el ', esc(fecha), '</footer>',
'</body></html>'
    ].join('');
  }

  // ── Salida ──────────────────────────────────────────────────────────────
  /* El PDF, DENTRO de la aplicación.

     Abría una ventana nueva con `window.open` y le pedía imprimir. En un
     teléfono, y más en la app instalada, esa ventana la bloquea el navegador
     y lo que se veía era un aviso de «permite ventanas emergentes» —o nada—.
     Llegó de campo así: «ese PDF no lo veo». El informe de usos sí salía
     porque va por otro camino; la lámina, que es lo que hace falta para
     presentar, no.

     Ahora se abre encima de la aplicación, en un marco propio, con un botón
     que imprime ESE marco —que en el teléfono es «Guardar como PDF»— y otro
     que baja el archivo tal cual, por si la impresión tampoco está. Y una
     vista previa que se puede mirar y desplazar antes de decidir. */
  function abrirVentanaImpresion(html){
    try {
      const viejo = document.getElementById('aia-impresion');
      if (viejo) viejo.remove();
      const caja = document.createElement('div');
      caja.id = 'aia-impresion';
      caja.setAttribute('role', 'dialog');
      caja.setAttribute('aria-label', 'Vista previa para imprimir o guardar como PDF');
      caja.style.cssText = 'position:fixed;inset:0;z-index:2147483500;background:#0f2434;display:flex;' +
        'flex-direction:column;font-family:Inter,system-ui,sans-serif;';
      caja.innerHTML =
        '<div style="display:flex;gap:8px;align-items:center;padding:10px 12px calc(10px + env(safe-area-inset-top,0px));' +
          'background:#0f2434;color:#eaf4fa;flex-wrap:wrap">' +
          '<b style="flex:1;min-width:120px;font-size:.92rem">Vista previa</b>' +
          '<button type="button" data-aia-imp="imprimir" style="min-height:44px;border:0;border-radius:10px;' +
            'padding:8px 14px;font-weight:800;background:#34CCFE;color:#052538;font-size:.9rem">Guardar como PDF / Imprimir</button>' +
          '<button type="button" data-aia-imp="bajar" style="min-height:44px;border:1px solid #2c5f7d;border-radius:10px;' +
            'padding:8px 12px;font-weight:700;background:#193a4e;color:#eaf4fa;font-size:.86rem">Bajar el archivo</button>' +
          '<button type="button" data-aia-imp="cerrar" aria-label="Cerrar" style="min-height:44px;min-width:44px;border:1px solid #2c5f7d;' +
            'border-radius:10px;background:#193a4e;color:#eaf4fa;font-size:1.1rem">✕</button>' +
        '</div>' +
        '<iframe title="Documento para imprimir" style="flex:1;border:0;background:#fff;width:100%"></iframe>' +
        '<p style="margin:0;padding:6px 12px calc(8px + env(safe-area-inset-bottom,0px));color:#b7cbd8;font-size:.72rem;line-height:1.35">' +
          'En el teléfono, «Imprimir» abre el diálogo del sistema: ahí elija <b>Guardar como PDF</b>. ' +
          'Si no aparece, «Bajar el archivo» guarda la lámina como página web para abrirla en un computador.</p>';
      document.body.appendChild(caja);
      const marco = caja.querySelector('iframe');
      marco.srcdoc = html;
      const anterior = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const cerrar = () => { try { caja.remove(); } catch(e) {} document.body.style.overflow = anterior; };
      caja.addEventListener('click', (ev) => {
        const b = ev.target.closest && ev.target.closest('[data-aia-imp]');
        if (!b) return;
        const que = b.getAttribute('data-aia-imp');
        if (que === 'cerrar') { cerrar(); return; }
        if (que === 'imprimir') {
          try { marco.contentWindow.focus(); marco.contentWindow.print(); }
          catch(e) { try { window.print(); } catch(e2) {} }
          return;
        }
        if (que === 'bajar') {
          try {
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'urbis-lamina-' + new Date().toISOString().slice(0, 10) + '.html';
            document.body.appendChild(a); a.click();
            setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch(e) {} }, 1500);
          } catch(e) {}
        }
      });
      return true;
    } catch (e) {
      // Si el marco no se pudo armar, se intenta lo de siempre.
      const w = window.open('', '_blank');
      if (!w) { alert('Permite ventanas emergentes para exportar el PDF.'); return false; }
      w.document.write(html);
      w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch(e2) {} }, 600);
      return true;
    }
  }

  function generar(r, opciones){
    abrirVentanaImpresion(construirHTMLEjecutivo(r, opciones));
  }

  window.AIA_INFORME = {
    generar, abrirVentanaImpresion,
    construirHTMLEjecutivo, construirHTMLListado,
    // Alias de compatibilidad (js/62 llamaba construirHTML).
    construirHTML: construirHTMLEjecutivo,
    // El mapa estático y su zoom, para la hoja de campo del curso (js/65):
    // el mismo encuadre que el informe, sin repetir la cuenta.
    calcZoom, urlMapaEstatico,
    // Estilos del informe (Fase 4): la app los lee para pintar el selector y
    // para generar las gráficas con los colores del estilo elegido.
    ESTILOS,
    // El formateador de cifras, para que js/62 no escriba una segunda copia:
    // como se escribe un numero en castellano es UN hecho (v1042).
    numEs
  };
})();
