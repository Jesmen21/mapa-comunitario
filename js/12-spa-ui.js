// ==========================================
  // MOTOR ASÍNCRONO SPA + FEEDBACK AUDITIVO MODERNO
  // ==========================================
  
  window.darLike = function(lat, btn) {
      const punto = buscarPuntoPorLat(lat);
      if(!punto) { alert("No se encontró el reporte para apoyar."); return; }
      let d = punto.descripcion.split(' | ');
      let likes = parseInt(d[BASE_OFFSET + 4]) || 0;
      likes++;
      d[BASE_OFFSET + 4] = likes; 
      let descripcionFinal = d.join(' | ');
      
      btn.innerText = "⏳ APOYANDO...";
      btn.style.opacity = '0.6';
      btn.disabled = true;
      
      window.urbisDBUpdate('lat', lat, { descripcion: descripcionFinal })
      .then(() => {
          playSuccessSound(); 
          btn.innerText = `👍 APOYADO (${likes})`;
          btn.style.opacity = '1';
          cargarPuntos(); 
      })
      .catch(error => {
          btn.disabled = false;
          btn.innerText = `👍 APOYAR ESTE REPORTE (${likes - 1})`;
          btn.style.opacity = '1';
          manejarError("apoyar reporte", error);
      });
  };

  // ══════════════════════════════════════════════════════════════════════
  // ¿ESTE REPORTE SIGUE VIGENTE?
  // ----------------------------------------------------------------------
  // Un mapa de reportes ciudadanos se muere por lo mismo siempre: el hueco que
  // alguien tapó en marzo sigue pintado en agosto. Nadie borra su propio
  // reporte cuando el problema se resuelve —ni se entera—, así que la única
  // fuente posible es quien pasa hoy por ahí. De eso va esto.
  //
  // Dos cosas que antes no estaban y sin las cuales el mecanismo miente:
  //  1) UN voto por persona. Antes cada toque sumaba, y como el reporte se
  //     archiva solo con 3 "ya no está", UNA persona podía tocar tres veces y
  //     borrar del mapa de TODOS un reporte real.
  //  2) Solo cuentan para archivar los votos de usuarios identificados. Quien
  //     no ha iniciado sesión puede opinar y su voto se ve, pero retirar algo
  //     del mapa no puede depender de alguien a quien no se puede pedir
  //     cuentas: si no, basta abrir varias ventanas anónimas.
  // ══════════════════════════════════════════════════════════════════════

  const VALIDACION_PREFIJO = 'VALIDACIONES_URBIS:';
  const VALIDACION_ACCIONES = ['confirm','gone','ongoing','wrong'];
  // Cuántas personas distintas hacen falta para retirar del mapa un reporte.
  const VOTOS_PARA_ARCHIVAR = 3;
  // A partir de cuándo un reporte se considera viejo y se pregunta activamente
  // si sigue ahí. 30 días: menos es hostigar, más es tener el mapa desactualizado.
  const DIAS_PARA_PREGUNTAR = 30;

  function urbisValidationIndex(){
      // Casilla propia repartida en js/04. Antes se calculaba aquí como
      // BASE_OFFSET+TIMELINE_EXTRA_OFFSET+5, la misma que se calcularon por su
      // cuenta la ficha del edificio y la carpeta de Pro City: confirmar un
      // reporte borraba la materialidad de ese edificio.
      if(window.URBIS_SLOTS && window.URBIS_SLOTS.validaciones != null) return window.URBIS_SLOTS.validaciones;
      return BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 10;
  }
  function urbisValidationLegacyIndex(){
      return (window.URBIS_SLOT_DISPUTADO != null) ? window.URBIS_SLOT_DISPUTADO
                                                   : (BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 5);
  }

  // Quién está votando. El usuario registrado es la llave buena; sin sesión se
  // usa una marca local del navegador, que sirve para no votar dos veces desde
  // el mismo aparato pero NO cuenta para archivar.
  function urbisVotanteActual(){
      let usuario = '';
      try {
          const yo = (typeof urbisIdentidadActual === 'function') ? urbisIdentidadActual() : {};
          usuario = String(yo.usuario || yo.correo || '').trim().toLowerCase();
      } catch(e){}
      if(usuario) return { clave: usuario, identificado: true };
      let dev = '';
      try {
          dev = localStorage.getItem('urbis_device_id') || '';
          if(!dev){ dev = 'd' + Math.random().toString(36).slice(2,10); localStorage.setItem('urbis_device_id', dev); }
      } catch(e){ dev = 'anon'; }
      return { clave: 'anon:' + dev, identificado: false };
  }

  function leerValidacionesReporte(d) {
      const vacio = { confirm:0, gone:0, ongoing:0, wrong:0, votos:{}, ultima:'' };
      // Casilla nueva primero; si está vacía se mira la vieja, y solo se acepta
      // si de verdad trae un blob de validaciones (el prefijo lo delata). Así
      // los reportes validados antes del reparto de casillas no pierden nada.
      let raw = String(d[urbisValidationIndex()] || '');
      if(!raw.startsWith(VALIDACION_PREFIJO)) {
          const viejo = String(d[urbisValidationLegacyIndex()] || '');
          raw = viejo.startsWith(VALIDACION_PREFIJO) ? viejo : '';
      }
      if(!raw.startsWith(VALIDACION_PREFIJO)) return vacio;
      try {
          const obj = JSON.parse(decodeURIComponent(raw.replace(VALIDACION_PREFIJO, '')));
          return {
              confirm: Number(obj.confirm) || 0,
              gone:    Number(obj.gone)    || 0,
              ongoing: Number(obj.ongoing) || 0,
              wrong:   Number(obj.wrong)   || 0,
              // Los blobs viejos no traen quién votó: se conservan los totales
              // y desde el próximo voto ya se sabe quién es quién.
              votos:   (obj.votos && typeof obj.votos === 'object') ? obj.votos : {},
              ultima:  String(obj.ultima || '')
          };
      } catch(e) { return vacio; }
  }

  function guardarValidacionesReporte(d, data) {
      d[urbisValidationIndex()] = VALIDACION_PREFIJO + encodeURIComponent(JSON.stringify({
          confirm:Number(data.confirm)||0,
          gone:Number(data.gone)||0,
          ongoing:Number(data.ongoing)||0,
          wrong:Number(data.wrong)||0,
          votos:(data.votos && typeof data.votos === 'object') ? data.votos : {},
          ultima:String(data.ultima || '')
      }));
      // La casilla vieja se deja como está, aunque tenga un blob de validaciones
      // de antes del reparto. Limpiarla parecía prolijo, pero ahora el servidor
      // solo deja que un vecino sin cuenta toque las casillas comunitarias
      // (v575): borrar esa otra casilla convertía cada confirmación ajena en un
      // cambio prohibido, y la confirmación entera se rechazaba. No cuesta
      // nada dejarla: leerEdificio ya ignora lo que no es de su vocabulario.
  }

  // Cuántas PERSONAS DISTINTAS e identificadas votaron cada cosa. Es lo único
  // que puede retirar un reporte del mapa.
  function urbisVotosIdentificados(v, accion){
      const votos = (v && v.votos) || {};
      return Object.keys(votos).filter(function(k){
          return votos[k] === accion && k.indexOf('anon:') !== 0;
      }).length;
  }

  // Hace cuánto que nadie dice nada de este reporte: desde la última
  // validación, y si nunca hubo ninguna, desde que se creó.
  function urbisDiasSinNoticias(p){
      try {
          const d = String(p.descripcion || '').split(' | ');
          const v = leerValidacionesReporte(d);
          let ref = v.ultima ? new Date(v.ultima) : null;
          if(!ref || isNaN(ref.getTime())) {
              const meta = (typeof obtenerMetaTemporal === 'function') ? obtenerMetaTemporal(p) : null;
              ref = (meta && meta.creado) ? new Date(meta.creado) : null;
          }
          if(!ref || isNaN(ref.getTime())) return null;
          return Math.floor((Date.now() - ref.getTime()) / 86400000);
      } catch(e){ return null; }
  }

  // Estado de vigencia listo para pintar, sin que la vista tenga que saber nada
  // del formato del registro.
  window.urbisVigenciaReporte = function(p){
      const d = String((p && p.descripcion) || '').split(' | ');
      const v = leerValidacionesReporte(d);
      const yo = urbisVotanteActual();
      const dias = urbisDiasSinNoticias(p);
      return {
          confirm: v.confirm, gone: v.gone, ongoing: v.ongoing, wrong: v.wrong,
          miVoto: (v.votos && v.votos[yo.clave]) || '',
          identificado: yo.identificado,
          personasQueDicenQueNoEsta: urbisVotosIdentificados(v, 'gone'),
          faltanParaRetirar: Math.max(0, VOTOS_PARA_ARCHIVAR - urbisVotosIdentificados(v, 'gone')),
          dias: dias,
          // "Viejo" no es un defecto del reporte: es que nadie ha vuelto a
          // decir nada de él. Por eso se mide desde la última noticia.
          hayQuePreguntar: dias != null && dias >= DIAS_PARA_PREGUNTAR
      };
  };

  // Texto humano del tiempo transcurrido. Nadie piensa en "hace 137 días".
  window.urbisHaceCuanto = function(dias){
      if(dias == null) return '';
      if(dias <= 0) return 'hoy';
      if(dias === 1) return 'ayer';
      if(dias < 30) return 'hace ' + dias + ' días';
      const meses = Math.round(dias / 30);
      if(meses < 12) return 'hace ' + meses + (meses === 1 ? ' mes' : ' meses');
      const anios = Math.floor(dias / 365);
      return 'hace ' + anios + (anios === 1 ? ' año' : ' años');
  };

  // Bloque de vigencia listo para insertar en cualquier vista. Vive aquí, junto
  // a los datos, para que la ficha del mapa y el panel de detalle muestren
  // exactamente lo mismo y no se desincronicen con el tiempo.
  window.urbisBloqueVigencia = function(p){
      if(!p || !p.lat) return '';
      const v = window.urbisVigenciaReporte(p);
      const lat = String(p.lat);
      const cuando = window.urbisHaceCuanto(v.dias);
      const esc = t => String(t).replace(/"/g, '&quot;');

      const partes = [];
      if(v.confirm) partes.push(v.confirm + (v.confirm === 1 ? ' confirma' : ' confirman') + ' que sigue');
      if(v.ongoing) partes.push(v.ongoing + (v.ongoing === 1 ? ' dice' : ' dicen') + ' que sigue ocurriendo');
      if(v.gone)    partes.push(v.gone + (v.gone === 1 ? ' dice' : ' dicen') + ' que ya no está');
      if(v.wrong)   partes.push(v.wrong + (v.wrong === 1 ? ' marca' : ' marcan') + ' el dato como incorrecto');
      const conteo = partes.length ? '<div class="uv-conteo">' + partes.join(' · ') + '</div>' : '';

      const etiquetaVoto = { confirm:'✅ sigue ahí', ongoing:'🔄 sigue ocurriendo',
                             gone:'👌 ya no está', wrong:'🚩 dato incorrecto' };
      const mio = v.miVoto
        ? '<div class="uv-mio">Tu respuesta: <b>' + etiquetaVoto[v.miVoto] + '</b> · puedes cambiarla tocando otra</div>'
        : '';

      // Solo se avisa cuando alguien ya empezó a decir que no está: antes de eso
      // es ruido, y anunciar "faltan 3" en cada reporte parece una invitación.
      const falta = (v.personasQueDicenQueNoEsta > 0 && v.faltanParaRetirar > 0)
        ? '<div class="uv-falta">Falta' + (v.faltanParaRetirar === 1 ? '' : 'n') + ' ' + v.faltanParaRetirar +
          (v.faltanParaRetirar === 1 ? ' persona' : ' personas') + ' más para retirarlo del mapa</div>'
        : '';

      const sub = v.dias == null ? ''
        : (v.hayQuePreguntar
            ? '<div class="uv-sub uv-viejo">Nadie da noticias de este reporte desde ' + cuando + '. Si pasas por ahí, cuéntanos.</div>'
            : '<div class="uv-sub">Última noticia ' + cuando + '</div>');

      const b = (accion, clase, texto) =>
        '<button type="button" class="' + clase + (v.miVoto === accion ? ' uv-elegido' : '') +
        '" onclick="validarReporteCiudadano(\'' + esc(lat) + '\', \'' + accion + '\', this)">' + texto + '</button>';

      return '<div class="urbis-vigencia' + (v.hayQuePreguntar ? ' uv-preguntando' : '') + '">' +
        '<div class="uv-head">¿Este reporte sigue vigente?</div>' + sub +
        '<div class="uv-main">' + b('confirm','uv-si','✅ Sí, sigue ahí') + b('gone','uv-no','👌 Ya no está') + '</div>' +
        '<div class="uv-mas">' + b('ongoing','','🔄 Sigue ocurriendo') + b('wrong','','🚩 Información incorrecta') + '</div>' +
        conteo + mio + falta +
      '</div>';
  };

  window.validarReporteCiudadano = function(lat, accion, btn) {
      const punto = buscarPuntoPorLat(lat);
      if(!punto) { alert('No se encontró el reporte para validar.'); return; }
      let d = String(punto.descripcion || '').split(' | ');
      const v = leerValidacionesReporte(d);
      const accionSegura = VALIDACION_ACCIONES.includes(accion) ? accion : 'confirm';
      const yo = urbisVotanteActual();
      const votoPrevio = v.votos[yo.clave] || '';

      if(votoPrevio === accionSegura) {
          alert('Ya diste esta respuesta sobre este reporte. Puedes cambiarla eligiendo otra.');
          return;
      }
      // Cambiar de opinión no suma: mueve el voto de una casilla a la otra.
      if(votoPrevio) v[votoPrevio] = Math.max(0, (Number(v[votoPrevio]) || 0) - 1);
      v[accionSegura] = (Number(v[accionSegura]) || 0) + 1;
      v.votos[yo.clave] = accionSegura;
      v.ultima = new Date().toISOString();

      let likes = parseInt(d[BASE_OFFSET + 4]) || 0;
      // El apoyo solo se mueve cuando el voto ENTRA en confirmar/sigue; si el
      // usuario venía de la otra casilla, se le devuelve el que había sumado.
      const sumaApoyo = a => a === 'confirm' || a === 'ongoing';
      if(sumaApoyo(accionSegura) && !sumaApoyo(votoPrevio)) likes += 1;
      else if(!sumaApoyo(accionSegura) && sumaApoyo(votoPrevio)) likes = Math.max(0, likes - 1);
      d[BASE_OFFSET + 4] = likes;

      // Retirar algo del mapa es destructivo y afecta a todos: exige TRES
      // personas distintas e identificadas, no tres toques.
      if(urbisVotosIdentificados(v, 'gone') >= VOTOS_PARA_ARCHIVAR ||
         urbisVotosIdentificados(v, 'wrong') >= VOTOS_PARA_ARCHIVAR) {
          d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3] = 'Archivado';
      }

      guardarValidacionesReporte(d, v);
      const descripcionFinal = d.join(' | ');
      const labels = { confirm:'Confirmando...', gone:'Marcando...', ongoing:'Actualizando...', wrong:'Reportando...' };
      const done = { confirm:'✅ Confirmado', gone:'👌 Aviso guardado', ongoing:'🔄 Sigue activo', wrong:'🚩 Revisión enviada' };
      if(btn) { btn.disabled = true; btn.dataset.originalText = btn.innerText; btn.innerText = labels[accionSegura]; }

      window.urbisDBUpdate('lat', lat, { descripcion: descripcionFinal })
      .then(() => {
          playSuccessSound();
          punto.descripcion = descripcionFinal; // la vista abierta ya refleja el voto
          if(btn) btn.innerText = done[accionSegura];
          if(accionSegura === 'gone' && !yo.identificado) {
              alert('Gracias. Tu respuesta quedó registrada y se ve en el reporte.\n\nPara que cuente a la hora de retirarlo del mapa hay que iniciar sesión: así nadie puede borrar reportes reales abriendo ventanas nuevas.');
          }
          cargarPuntos();
      })
      .catch(error => {
          if(btn) { btn.disabled = false; btn.innerText = btn.dataset.originalText || 'Validar'; }
          manejarError('validar reporte ciudadano', error);
      });
  };

  window.aprobarPunto = function(lat, btn) {
      const punto = buscarPuntoPorLat(lat);
      if(!punto) { alert("No se encontró el reporte para aprobar."); return; }
      let d = punto.descripcion.split(' | ');
      d[BASE_OFFSET + 1] = "Aprobado"; 
      let descripcionFinal = d.join(' | ');
      
      btn.innerText = "⏳ APROBANDO...";
      btn.style.opacity = '0.6';
      btn.disabled = true;
      
      window.urbisDBUpdate('lat', lat, { descripcion: descripcionFinal })
      .then(() => {
          playSuccessSound();
          if(typeof urbisOnReportApproved === 'function') urbisOnReportApproved(punto);
          cancelarRegistro();
          cargarPuntos();
      })
      .catch(error => {
          btn.disabled = false;
          btn.innerText = "✅ APROBAR REPORTE";
          btn.style.opacity = '1';
          manejarError("aprobar reporte", error);
      });
  };

  // Borrado por lat vía Apps Script (coincide con cómo se crea/lee el reporte; el db_delete
  // compara por texto Y por número, así no falla por coma/punto). Respaldo automático a SheetDB.
  window.urbisBorrarPorLat = function(lat){
    return window.urbisDBDelete('lat', String(lat)).then(function(out){
      if(out && typeof out.json === 'function') return out.json().catch(()=>({}));
      return out || {};
    });
  };
  function urbisBorrarPorLat(lat){ return window.urbisBorrarPorLat(lat); }

  window.eliminarPunto = function(lat) {
      const punto = buscarPuntoPorLat(lat);
      if(!punto) { alert("No se encontró el reporte para eliminar."); return; }
      if(!puedeGestionarReporte(punto)) { alert("Solo puedes eliminar tus propios reportes mientras sigan activos."); return; }
      const mensaje = (userRole === 'citizen')
          ? "¿Eliminar tu reporte? Esta acción lo quitará del mapa actual."
          : "¿Eliminar punto de forma permanente?";
      if(confirm(mensaje)) {
          // OPTIMISTA: quitar el reporte del mapa y de las listas YA, para que el ícono
          // desaparezca al instante (no esperar al servidor). El borrado real corre detrás.
          try{
              if(Array.isArray(globalData)) globalData = globalData.filter(p => String(p.lat) !== String(lat));
              if(typeof datosVisiblesActuales === 'function' && typeof pintarPuntos === 'function') pintarPuntos(datosVisiblesActuales());
              if(typeof window.urbisRenderMisReportes === 'function') window.urbisRenderMisReportes();
              if(typeof cancelarRegistro === 'function') cancelarRegistro();
          }catch(e){}
          urbisBorrarPorLat(lat)
          .catch(error => { manejarError("eliminar hito", error); try{ cargarPuntos(); }catch(e){} });
      }
  };

  // BACKEND ÚNICO: Google Apps Script (URBIS ya NO usa SheetDB). Escribe/lee/actualiza/
  // borra sobre el mismo Google Sheet: gratis, sin límite mensual y sin el corrimiento
  // de columnas que dañaba los reportes. Sin respaldo a SheetDB.
  function _dbAPIok(){ return window.URBIS_AUTH && typeof window.URBIS_AUTH.socialAPI === 'function'; }
  // Token de la sesión, para que el servidor sepa quién escribe. Va en cada
  // edición y en cada borrado; leerlo (db_read) sigue siendo abierto, porque el
  // mapa tiene que poder cargarse sin cuenta.
  function _dbToken(){
    try{
      const s = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null;
      return (s && s.session_token) || '';
    }catch(e){ return ''; }
  }
  function _dbSinBackend(){ return Promise.reject(new Error('Backend URBIS (Apps Script) no disponible')); }
  window.urbisGuardarFila = function(fila){
    if(!_dbAPIok()) return _dbSinBackend();
    // El token viaja también al CREAR. A casi todo le da igual, pero la
    // vitrina exige permiso para escribirse: sin firma, cualquiera podría
    // inventarse un "emprendimiento verificado por URBIS".
    return window.URBIS_AUTH.socialAPI({ action:'db_write', fila: fila, session_token:_dbToken() })
      .then(function(out){
        if(out && out.ok === false && out.message) throw new Error(out.message);
        return out;
      });
  };
  // LECTURA de todos los reportes vía Apps Script. Si falla, devuelve [] (no rompe la app).
  window.urbisDBRead = function(){
    if(!_dbAPIok()) return Promise.resolve([]);
    // El token viaja también al LEER: no para poder leer —el mapa es abierto—
    // sino para que el servidor sepa a quién destapar el buzón de peticiones,
    // que es lo único que va tapado en la respuesta.
    return window.URBIS_AUTH.socialAPI({ action:'db_read', session_token:_dbToken() })
      .then(function(out){ return (out && out.ok && Array.isArray(out.data)) ? out.data : []; })
      .catch(function(){ return []; });
  };
  // ACTUALIZA filas (col=value) con los campos dados.
  window.urbisDBUpdate = function(col, value, fields){
    if(!_dbAPIok()) return _dbSinBackend();
    return window.URBIS_AUTH.socialAPI({ action:'db_update', col:col, value:String(value), set:fields, session_token:_dbToken() })
      .then(function(out){
        // El servidor puede negarse: editar un reporte ajeno, o una sesión
        // vieja sin token. Se convierte en error para que el llamador lo
        // muestre en vez de creer que se guardó.
        if(out && out.ok === false && out.message) throw new Error(out.message);
        return out;
      });
  };
  // BORRA filas (col=value).
  window.urbisDBDelete = function(col, value){
    if(!_dbAPIok()) return _dbSinBackend();
    return window.URBIS_AUTH.socialAPI({ action:'db_delete', col:col, value:String(value), session_token:_dbToken() })
      .then(function(out){
        if(out && out.ok === false && out.message) throw new Error(out.message);
        return out;
      });
  };

  window.enviarDatosDesdeFormulario = function(btn) {
      const ctx = window.__urbisCurrentFormContext;
      if(!ctx) { alert('No se encontró el contexto del formulario. Vuelve a tocar el mapa y crea el reporte otra vez.'); return; }
      return enviarDatos(ctx.cat, ctx.lat, ctx.lng, ctx.isEdit, ctx.estadoVal, ctx.creadorNom, ctx.creadorRolStr, ctx.likesActuales, ctx.correoReq, ctx.cedulaReq, ctx.barrioReq, btn);
  };

  window.enviarDatos = async function(cat, lat, lng, isEdit, estadoVal, creadorNom, creadorRolStr, likesActuales, correoReq, cedulaReq, barrioReq, btn) {
    if(isEdit) {
        const puntoEdicion = buscarPuntoPorLat(lat);
        if(!puntoEdicion || !puedeGestionarReporte(puntoEdicion)) {
            alert("No tienes permiso para editar este reporte o ya venció su tiempo activo.");
            return;
        }
    }
    if(btn) {
        btn.disabled = true;
        btn.dataset.originalText = btn.dataset.originalText || btn.innerText || 'GUARDAR REPORTE';
    }

    let i = document.getElementById('sel-item').value;
    let n = document.getElementById('sel-nombre').value.replace(/\|/g, '-');
    let nt = document.getElementById('ins-nota').value.replace(/\|/g, '-');

    // PRIVACIDAD: "Consumo de drogas" es SIEMPRE anónimo — se omite/enmascara
    // cualquier dato de identidad del autor, tanto en la interfaz como en la
    // base de datos pública (SheetDB). El dispositivo que crea el reporte
    // conserva un permiso LOCAL (localStorage, nunca sale de este equipo) para
    // poder editarlo/archivarlo después, aunque nadie más pueda identificarlo.
    const CATEGORIAS_ANONIMAS = new Set(['consumo de drogas']);
    const _iNorm = String(i || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const esReporteAnonimo = CATEGORIAS_ANONIMAS.has(_iNorm);
    if(esReporteAnonimo) {
        creadorNom = ''; creadorRolStr = ''; correoReq = ''; cedulaReq = ''; barrioReq = '';
    }

    // ── Identidad verificada, si el reporte lo pide ────────────────────────
    // Antes que nada: si hay que verificar la cuenta, mejor descubrirlo ahora
    // que después de llenar el formulario entero. Solo aplica a reportes
    // nuevos; al editar no se vuelve a pedir.
    if(!isEdit && typeof window.urbisPermitirPublicar === 'function') {
        const _fi = document.getElementById('ins-foto-file');
        const _llevaFoto = !!(_fi && _fi.files && _fi.files[0]);
        let _permitido = true;
        try { _permitido = await window.urbisPermitirPublicar(cat, i, _llevaFoto); }
        catch(e) { _permitido = true; } // un fallo de la puerta no puede dejar a nadie sin publicar
        if(!_permitido) {
            if(btn) { btn.innerText = btn.dataset.originalText || 'GUARDAR REPORTE'; btn.disabled = false; }
            return;
        }
    }

    // ── ¿Esto ya está reportado aquí? ──────────────────────────────────────
    // Se pregunta ANTES de procesar la foto: comprimir una imagen para después
    // descubrir que el reporte era repetido es tiempo y batería de alguien que
    // está parado en la calle. Solo aplica a reportes nuevos; al editar no hay
    // nada que duplicar.
    if(!isEdit && typeof window.urbisRevisarDuplicadoAntesDePublicar === 'function') {
        let decision = 'publicar';
        try { decision = await window.urbisRevisarDuplicadoAntesDePublicar(cat, i, lat, lng); }
        catch(e) { decision = 'publicar'; } // ante la duda, se publica
        if(decision !== 'publicar') {
            if(btn) { btn.innerText = btn.dataset.originalText || 'GUARDAR REPORTE'; btn.disabled = false; }
            // Sumarse ya dejó registrado que el problema sigue ocurriendo; el
            // formulario se cierra porque no hay nada más que llenar.
            if(decision === 'sumarse' && typeof cancelarRegistro === 'function') {
                try { cancelarRegistro(); } catch(e2) {}
            }
            return;
        }
    }

    // Recoger valores aunque estén ocultos
    let est = document.getElementById('sel-estado') ? document.getElementById('sel-estado').value : "Bueno";
    let mat = document.getElementById('sel-mat') ? document.getElementById('sel-mat').value : "N/A";
    let fotoInput = document.getElementById('ins-foto').value;
    let foto = fotoInput ? fotoInput.replace(/\|/g, '-') : "N/A";
    const fileInput = document.getElementById('ins-foto-file');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    if(file) {
        btn.innerText = "📷 PROCESANDO FOTO...";
        try { foto = await procesarImagenSeleccionada(file); }
        catch(error) {
            manejarError("procesar fotografía", error);
            if(btn) { btn.innerText = btn.dataset.originalText || "GUARDAR REPORTE"; btn.disabled = false; }
            return;
        }
    }

    // NO HAY BLOQUEO DE FOTO OBLIGATORIA AQUÍ (Se mantiene opcional)

    let usosGuardar = [];
    for(let j=0; j<todosLosUsos.length; j++) { 
        let chk = document.getElementById(`chk-u-${j}`);
        usosGuardar.push((chk && chk.checked) ? "SI" : "NO"); 
    }

    let estadoValidacionFinal = isEdit ? estadoVal : (userRole === 'admin' || userRole === 'gov' ? "Aprobado" : "Pendiente");
    // Reportes de conflicto armado: la casilla "publicar sin mi nombre" viene
    // marcada. Un reporte público de extorsión firmado identifica a quien
    // denuncia, y eso en zona de frontera tiene consecuencias reales.
    const _anonChk = document.getElementById('ins-anonimo');
    // En el conflicto armado el anonimato NO es una preferencia: quien publica
    // tiene que ser una cuenta verificada (arriba), y su nombre no puede salir
    // en el mapa aunque la casilla se desmarque por descuido. Es la única
    // combinación que hace el reporte responsable y a la vez seguro para quien
    // lo hace.
    const _esConflicto = (typeof window.urbisEsReporteDeConflicto === 'function')
        && window.urbisEsReporteDeConflicto(cat, i);
    const _pidioAnonimo = _esConflicto || !!(_anonChk && _anonChk.checked);
    let nombreSeguro = _pidioAnonimo ? "Anónimo"
        : (creadorNom ? creadorNom.replace(/\|/g, '-') : "Anónimo");
    let likes = likesActuales || 0;

    const puntoOriginal = isEdit ? buscarPuntoPorLat(lat) : null;
    const dOriginal = puntoOriginal && puntoOriginal.descripcion ? String(puntoOriginal.descripcion).split(' | ') : [];
    const fechaCreacion = isEdit ? parseFechaReporte({ descripcion: puntoOriginal?.descripcion || '' }) : new Date();
    // ── Datos personales FUERA de la tabla de reportes ────────────────────
    // La hoja de reportes se lee en abierto: la acción db_read del Apps Script
    // devuelve todas las filas a quien la llame, sin sesión, porque el mapa
    // tiene que poder cargarse. Guardar ahí el correo y la cédula de quien
    // reporta significaba publicarlos. Ya están en la cuenta del usuario, que
    // sí es privada; en el reporte basta con su nombre de usuario.
    //
    // Al editar un reporte viejo tampoco se vuelven a escribir: la casilla
    // queda vacía y el dato desaparece de la tabla pública.
    const correoPublico = '', cedulaPublica = '';
    let arrData = [
        i, n, nt, est, isEdit ? (dOriginal[4] || "Activo") : "Activo", mat, ...usosGuardar, foto, estadoValidacionFinal, nombreSeguro, creadorRolStr, likes, correoPublico, cedulaPublica, barrioReq
    ];
    const ctxForm = window.__urbisCurrentFormContext || {};
    // Pedido explícito: un atentado/artefacto explosivo debe seguir visible
    // más tiempo que un reporte normal (24h en vez de las 8h por defecto) —
    // es información de seguridad que la comunidad necesita ver más tiempo.
    // Los hechos del conflicto siguen siendo información útil mucho después de
    // ocurridos (una mina o un retén no desaparecen en 8 horas).
    // Las alertas de escala nacional (sismo, incendio forestal, inundación,
    // derrumbe, creciente…) traen sus propias horas desde el catálogo. Antes
    // solo el sismo y el incendio duraban más de 8 horas: una inundación se
    // borraba del mapa la misma tarde en que se reportó, cuando la emergencia
    // apenas estaba empezando.
    const _horasAlerta = (typeof window.urbisHorasAlertaNacional === 'function')
      ? window.urbisHorasAlertaNacional(i) : 0;
    const horasTTLQuick = /atentado|artefacto explosivo/i.test(String(i||'')) ? 24
      : _horasAlerta ? _horasAlerta
      : /mina antipersona|reten ilegal|retén ilegal|grupo armado|confinamiento|desplazamiento forzado/i.test(String(i||'')) ? 168
      : /secuestro|extorsion|extorsión|masacre|homicidio|desaparicion|desaparición|amenaza|reclutamiento|ejecucion extrajudicial|ejecución extrajudicial|combate armado|panfleto/i.test(String(i||'')) ? 72
      : 8;
    let descripcionFinal = (ctxForm.quickReport && typeof asegurarCamposTemporalesPersonalizados === 'function')
        ? asegurarCamposTemporalesPersonalizados(arrData.join(' | '), cat, i, fechaCreacion, horasTTLQuick, ctxForm.quickIcon || obtenerIconoReporte(cat, i) || 'Reporte')
        : asegurarCamposTemporales(arrData.join(' | '), cat, i, fechaCreacion);

    // ── Ficha del edificio ────────────────────────────────────────────────
    // Materialidad y pisos van DESPUÉS del bloque temporal, en las dos últimas
    // posiciones. Es el único sitio donde caben: la descripción es una cadena
    // con posiciones fijas y meterlas en medio correría los índices de todo lo
    // ya mapeado. En un registro viejo estas casillas no existen y se leen como
    // "sin registrar", que es la verdad.
    let fichaEscritaEnEsteGuardado = false;
    (function guardarFichaEdificio(){
        const EDIF = window.URBIS_EDIFICIO;
        if (!EDIF || !EDIF.esCategoriaEdificio(cat)) return;
        const selMat = document.getElementById('sel-materialidad');
        const insPisos = document.getElementById('ins-pisos');
        const selPB = document.getElementById('sel-planta-baja');
        const selEp = document.getElementById('sel-epoca');
        const insOtro = document.getElementById('ins-otro-edificio');
        if (!selMat && !insPisos && !selPB && !selEp && !insOtro) return;
        const d = String(descripcionFinal).split(' | ');
        const ref = EDIF.leer(descripcionFinal);
        const matSel = selMat ? String(selMat.value || '').replace(/\|/g, '-') : '';
        const pisosSel = insPisos ? parseInt(insPisos.value, 10) : NaN;
        // Se rellena todo hueco intermedio: si el registro venía corto, un
        // índice suelto dejaría "undefined" en medio de la cadena.
        for (let k = 0; k < ref.idxOtroTexto; k++) if (d[k] === undefined) d[k] = '';
        d[ref.idxMaterialidad] = matSel || EDIF.SIN_REGISTRAR;
        d[ref.idxPisos] = (isFinite(pisosSel) && pisosSel > 0) ? String(Math.min(pisosSel, 60)) : '';
        d[ref.idxPlantaBaja] = selPB ? String(selPB.value || '').replace(/\|/g, '-') : '';
        d[ref.idxEpoca] = selEp ? String(selEp.value || '').replace(/\|/g, '-') : '';
        d[ref.idxOtroTexto] = insOtro ? String(insOtro.value || '').replace(/\|/g, '-').slice(0, 120) : '';
        descripcionFinal = d.join(' | ');
        fichaEscritaEnEsteGuardado = true;
    })();
    // ── ¿Hubo gente herida? ───────────────────────────────────────────────
    // Se guarda DESPUÉS del bloque temporal y de la ficha del edificio, en su
    // propia casilla (URBIS_SLOTS.victimas). Solo se escribe si el formulario
    // traía la pregunta: en un reporte que no la hace, el campo tiene que
    // quedar vacío y no "cero víctimas".
    try {
        if(typeof window.urbisLeerFormularioVictimas === 'function' &&
           typeof window.urbisFormularioVictimasActivo === 'function' &&
           window.urbisFormularioVictimasActivo(document)) {
            const _v = window.urbisLeerFormularioVictimas(document);
            descripcionFinal = window.urbisGuardarVictimas(descripcionFinal, _v.heridos, _v.fallecidos);
        }
    } catch(e){}

    if(descripcionFinal.length > 49000) {
        alert('El reporte quedó demasiado pesado para SheetDB/Google Sheets. Usa un link de foto o una imagen más pequeña.');
        if(btn) { btn.innerText = btn.dataset.originalText || 'GUARDAR REPORTE'; btn.disabled = false; }
        return;
    }

    // Al editar, se conservan los metadatos originales que el formulario NO
    // toca: creado, expira, temporal/permanente, historial, icono, y todo lo
    // que se guarda después del bloque temporal. Es un bug clásico de esta
    // pantalla: cada campo nuevo que alguien añade al final del registro se
    // pierde silenciosamente en la primera edición si no se lo nombra aquí.
    // Ya pasó con la carpeta cooperativa de Pro City, que se desvinculaba sola
    // al corregir una foto.
    if(isEdit && dOriginal.length) {
        let dFinal = descripcionFinal.split(' | ');
        const base = BASE_OFFSET + TIMELINE_EXTRA_OFFSET;
        const S = window.URBIS_SLOTS || {};
        // Bloque temporal (0-4) + validaciones y carpeta: nunca vienen del
        // formulario, así que siempre se conservan.
        const conservar = [base, base+1, base+2, base+3, base+4];
        conservar.push(S.validaciones != null ? S.validaciones : base + 10);
        conservar.push(S.carpetaProCity != null ? S.carpetaProCity : base + 11);
        conservar.push(S.denuncias != null ? S.denuncias : base + 12);
        // Las víctimas solo se conservan si esta edición NO trae la pregunta
        // activa; si la trae, manda lo que acaba de responder el usuario.
        const _vicActivo = (typeof window.urbisFormularioVictimasActivo === 'function')
            && window.urbisFormularioVictimasActivo(document);
        if(!_vicActivo) {
            conservar.push(S.victimas != null ? S.victimas : base + 13);
        }
        // La ficha del edificio solo se conserva si esta edición NO la escribió;
        // si el formulario la traía, lo que puso el usuario manda.
        if(!fichaEscritaEnEsteGuardado) {
            [S.edificioMaterialidad, S.edificioPisos, S.edificioPlantaBaja,
             S.edificioEpoca, S.edificioOtroTexto].forEach(function(idx, k){
                conservar.push(idx != null ? idx : base + 5 + k);
            });
        }
        conservar.forEach(function(idx){ if(dOriginal[idx]) dFinal[idx] = dOriginal[idx]; });
        descripcionFinal = dFinal.join(' | ');
    }
    
    btn.innerText = "⏳ Publicando...";
    const _sb = document.getElementById('sidebar');
    if(_sb) _sb.style.opacity = '0.6';

    // OPTIMISTA: el reporte NUEVO aparece en el mapa AL INSTANTE (sin esperar al servidor),
    // para que el usuario vea de una que sí se agregó. El guardado real corre en segundo plano.
    const filaNueva = isEdit ? null : { tipo: cat, lat: lat, lng: lng, descripcion: descripcionFinal, fecha: new Date().toISOString() };
    if(filaNueva){
        try{
            globalData = (globalData || []); globalData.push(filaNueva);
            if(typeof datosVisiblesActuales === 'function' && typeof pintarPuntos === 'function') pintarPuntos(datosVisiblesActuales());
            if(typeof window.urbisRenderMisReportes === 'function') window.urbisRenderMisReportes();
            if(typeof playSuccessSound === 'function') playSuccessSound();
        }catch(e){}
    }

    let fetchPromise = isEdit ?
        window.urbisDBUpdate('lat', lat, { descripcion: descripcionFinal }) :
        window.urbisGuardarFila(filaNueva);

    fetchPromise.then(res => {
        if (res && res.ok === false && res.status) throw new Error(`HTTP ${res.status}`);
        // El reporte quedó anónimo en la base pública: guardar SOLO en este
        // dispositivo la marca de propiedad, para que su creador pueda seguir
        // editándolo/archivándolo sin que su identidad quede expuesta a nadie más.
        if(!isEdit && esReporteAnonimo) {
            try {
                const KEY = 'urbis_anon_reports_mine';
                const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
                arr.push(String(lat));
                localStorage.setItem(KEY, JSON.stringify(arr.slice(-200)));
            } catch(e){}
        }
        if(_sb) _sb.style.opacity = '1';
        if(btn) { btn.disabled = false; btn.innerText = '✅ ¡Publicado!'; const _bt = btn; setTimeout(()=>{ try{ _bt.innerText = _bt.dataset.originalText || 'GUARDAR REPORTE'; }catch(e){} }, 1600); }
        try{ cancelarRegistro(); }catch(e){}
        // Re-sincroniza en segundo plano (sin urgencia: ya se ve). Trae id/campos finales.
        setTimeout(()=>{ try{ cargarPuntos(); }catch(e){} }, 1500);
    }).catch(error => {
        // Falló de verdad: quitar el marcador optimista para no engañar al usuario.
        if(filaNueva){ try{ globalData = (globalData||[]).filter(p => p !== filaNueva); if(typeof pintarPuntos === 'function') pintarPuntos(datosVisiblesActuales()); if(typeof window.urbisRenderMisReportes === 'function') window.urbisRenderMisReportes(); }catch(e){} }
        if(btn) { btn.innerText = btn.dataset.originalText || "GUARDAR REPORTE"; btn.disabled = false; }
        if(_sb) _sb.style.opacity = '1';
        if(typeof manejarError === 'function') manejarError(isEdit ? "actualizar reporte" : "guardar reporte", error);
        else alert('Error al guardar: ' + (error.message || error));
    });
  };

  // Categorías de "usos"/auto-mapeo (análisis territorial): NO se muestran en el
  // mapa móvil. El dispositivo solo muestra reportes ciudadanos y eventos.
  const URBIS_TIPOS_AUTOMAPEO = new Set([
    'Vivienda y Residencial', 'Comercio y Servicios', 'Grandes Equipamientos',
    'Áreas Deportivas', 'Infraestructura y Peatonal', 'Servicios Ocultos',
    'Patrimonio y Turismo', 'Industria y Logística', 'Infraestructura Smart',
    'Oficinas y Co-working', 'Conflictos de Uso (Riesgo)'
  ]);
  window.urbisEsCategoriaAutomapeo = function(tipo){ return URBIS_TIPOS_AUTOMAPEO.has(String(tipo || '')); };

  function pintarPuntos(data) {
    urbisResetProximityRegistry('report');
    Object.values(capas).forEach(l => l.clearLayers());
    if(typeof zonaImpactoLayer !== 'undefined') zonaImpactoLayer.clearLayers();
    if(typeof window.urbisBumpImpactoGen === 'function') window.urbisBumpImpactoGen();
    const z = map.getZoom();
    let omitidosPorZoom = 0;
    (Array.isArray(data) ? data : []).forEach(p => {
      if(typeof window.esFilaMetaUrbis === 'function' && window.esFilaMetaUrbis(p)) { return; } // nunca pintar ubicacion_/comentario/relacion/etc.
      if(typeof window.urbisEsEventoAurea === 'function' && window.urbisEsEventoAurea(p)) { return; } // la gota Áurea la dibuja el renderizador FORZADO (capa propia siempre visible)
      if(typeof window.urbisEsAlertaNacional === 'function' && window.urbisEsAlertaNacional(p)) { return; } // ídem: las alertas nacionales van en su capa propia, siempre montada
      if(p && URBIS_TIPOS_AUTOMAPEO.has(String(p.tipo || ''))) { return; } // ocultar usos/auto-mapeo
      // URBIS_TIPOS_AUTOMAPEO (arriba) es una lista más vieja/incompleta —
      // le faltan 4 categorías de Pro City (Áreas Verdes, Salud y Emergencias,
      // Animal y Bienestar, Matriz de Usos). urbisEsCategoriaProCity (js/20)
      // es la lista COMPLETA: sin esto esas 4 categorías se colaban como
      // pines del mapa ciudadano, mezclando los dos módulos.
      if(p && typeof window.urbisEsCategoriaProCity === 'function' && window.urbisEsCategoriaProCity(p.tipo)) { return; }
      if(typeof urbisRouteFocusActive !== 'undefined' && urbisRouteFocusActive && typeof esPuntoMovilidadParaRuta === 'function' && !esPuntoMovilidadParaRuta(p)) { return; }
      if(!puedeMostrarMarcadorPorZoom(p)) { omitidosPorZoom++; return; }
      let lat = parseFloat(String(p.lat).replace(',', '.')), lng = parseFloat(String(p.lng).replace(',', '.'));
      if(!isNaN(lat) && !isNaN(lng)) {
        let dimKey = Object.keys(dimensiones).find(k => p.tipo === k);
        if (!dimKey || !capas[dimKey]) dimKey = Object.keys(dimensiones)[0];
        let marker = crearMarcadorUrbano(lat, lng, dimKey, p);
        if (marker && capas[dimKey]) {
            marker.addTo(capas[dimKey]);
            urbisRegisterProximityMarker(marker, [lat, lng], { emoji: obtenerIconoReporte(p.tipo, p), tipo: p.tipo }, 'report');
        }
      }
    });
    aplicarCapasSegunZoom();
    // Pro City dibuja sus elementos (formas) en su propia capa a partir de los
    // mismos datos ya cargados — se refresca en cada recarga (incluido el
    // guardado optimista) sin llamadas extra al backend.
    try{ if(typeof window.urbisRenderProCityPoints === 'function') window.urbisRenderProCityPoints(); }catch(e){}
    const status = document.getElementById('automap-status');
    if(status && omitidosPorZoom > 0 && z < ZOOM_MOSTRAR_AUTOMAPEO_DETALLADO) {
        status.innerHTML = `🗺️ Optimización activa: ${omitidosPorZoom} punto(s) existen en datos, pero se ocultan en este zoom para mantener fluida la plataforma.`;
    }
  }

  function cargarPuntos() {
    // Al iniciar sesión solo se llena window.userRole; sincronizamos el scope
    // compartido para que el mapa no quede vacío.
    if (userRole === '' && window.userRole && typeof window.urbisSyncSharedIdentity === 'function') {
      window.urbisSyncSharedIdentity();
    }
    if (userRole === '' && !window.userRole) return;
    Object.values(capas).forEach(l => l.clearLayers());
    window.urbisDBRead()
    .then(data => {
      const raw = Array.isArray(data) ? data : [];
      // Defensa: algunas conexiones de SheetDB devuelven lat/lng con COMA decimal
      // ("7,8828" en vez de "7.8828"), lo que rompería parseFloat y descolocaría el
      // mapa. Normalizamos coma→punto en sitio (inofensivo si ya viene con punto).
      raw.forEach(p => { if(p){ if(p.lat!=null) p.lat = String(p.lat).replace(',', '.'); if(p.lng!=null) p.lng = String(p.lng).replace(',', '.'); } });
      // Filas especiales (no son reportes): se identifican por el TEXTO del tipo
      // (no por el emoji, que se corrompe a mojibake al guardarse en el Sheet).
      const tipoTxt = p => String((p && p.tipo) || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      const esMeta = p => { const t = tipoTxt(p); return t.indexOf('comentario')!==-1 || t.indexOf('ubicacion')!==-1 || t.indexOf('relacion')!==-1 || t.indexOf('puntaje')!==-1 || t.indexOf('permiso')!==-1 || t.indexOf('avatar')!==-1 || t.indexOf('chat')!==-1 || t.indexOf('peticion')!==-1 || t.indexOf('emprendimiento')!==-1 || t.indexOf('portafolio')!==-1 || t.indexOf('social rush')!==-1; };
      window.urbisRushSocial  = raw.filter(p => tipoTxt(p).indexOf('social rush') !== -1);
      window.urbisComentarios = raw.filter(p => tipoTxt(p).indexOf('comentario') !== -1);
      // Las peticiones al administrador salen de globalData (no son reportes y
      // no se pintan), así que necesitan su propio cajón: si no, el buzón del
      // panel de administración se vería siempre vacío.
      window.urbisPeticiones  = raw.filter(p => tipoTxt(p).indexOf('peticion') !== -1);
      // La vitrina se aparta por la razón CONTRARIA a las demás filas meta: sí
      // se pinta, pero la pinta su propio módulo (js/13i). Si pasara por
      // pintarPuntos, el motor de vigencia trataría el negocio como un reporte
      // y lo archivaría a los días.
      window.urbisVitrina      = raw.filter(p => tipoTxt(p).indexOf('emprendimiento') !== -1);
      window.urbisVitrinaItems = raw.filter(p => tipoTxt(p).indexOf('portafolio') !== -1);
      window.urbisUbicaciones  = raw.filter(p => tipoTxt(p).indexOf('ubicacion') !== -1);
      window.urbisRelaciones   = raw.filter(p => tipoTxt(p).indexOf('relacion') !== -1);
      window.urbisPuntajes     = raw.filter(p => tipoTxt(p).indexOf('puntaje') !== -1);
      window.urbisPermisos     = raw.filter(p => tipoTxt(p).indexOf('permiso') !== -1);
      // Avatares: normalizamos a { lng:usuario, descripcion:avatarId } y toleramos
      // las filas CORRIDAS por el bug de SheetDB (tipo vacío, lat="avatar_x",
      // descripcion=usuario, fecha=avatarId). Así el avatar SIEMPRE se lee.
      window.urbisAvatares = raw.map(p => {
        if(!p) return null;
        if(tipoTxt(p).indexOf('avatar') !== -1) return { lng:String(p.lng||''), descripcion:String(p.descripcion||'') };
        if(String(p.lat||'').toLowerCase().indexOf('avatar') === 0) return { lng:String(p.descripcion||''), descripcion:String(p.fecha||'') };
        return null;
      }).filter(Boolean);
      globalData = raw.filter(p => !esMeta(p)).map(p => {
          if(p.descripcion) p.descripcion = asegurarCamposTemporales(p.descripcion, p.tipo, String(p.descripcion).split(' | ')[0], parseFechaReporte(p));
          return p;
      });
      return archivarReportesExpirados(globalData).then(() => globalData);
    })
    .then(() => {
      const visibles = datosVisiblesActuales();
      pintarPuntos(visibles);
      actualizarGraficos(visibles);
      actualizarPanelAdmin();
          if(typeof renderEventosUrbis === 'function') renderEventosUrbis();
      analizarZonasCiudadanas(visibles, false);
      renderTimeline();
      try{ if(document.querySelector('[data-u52-screen="timeline"]')?.classList.contains('active') && typeof window.urbisRenderMisReportes === 'function') window.urbisRenderMisReportes(); }catch(e){}
      try{ if(document.querySelector('[data-u52-screen="social"]')?.classList.contains('active') && typeof window.urbisRenderContactos === 'function') window.urbisRenderContactos(window.__urbisSocialRel || 'amigo'); }catch(e){}
      try{ if(typeof window.urbisActualizarBadgeChat === 'function') window.urbisActualizarBadgeChat(); }catch(e){}
      if(typeof urbisEvaluateAchievements === 'function') urbisEvaluateAchievements('cargar-puntos');
    })
    .catch(error => {
      console.warn('[URBIS] No se pudo cargar SheetDB. Continuando con caché/vacío en móvil.', error);
      try {
        const cache = JSON.parse(localStorage.getItem('urbis_sheetdb_cache_v70_mobile') || '[]');
        const cacheArr = Array.isArray(cache) ? cache : [];
        cacheArr.forEach(p => { if(p){ if(p.lat!=null) p.lat = String(p.lat).replace(',', '.'); if(p.lng!=null) p.lng = String(p.lng).replace(',', '.'); } });
        const tipoTxtC = p => String((p && p.tipo) || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
        const esMetaC = p => { const t = tipoTxtC(p); return t.indexOf('comentario')!==-1 || t.indexOf('ubicacion')!==-1 || t.indexOf('relacion')!==-1 || t.indexOf('puntaje')!==-1 || t.indexOf('avatar')!==-1 || t.indexOf('chat')!==-1 || t.indexOf('peticion')!==-1 || t.indexOf('emprendimiento')!==-1 || t.indexOf('portafolio')!==-1 || t.indexOf('social rush')!==-1; };
        window.urbisRushSocial  = cacheArr.filter(p => tipoTxtC(p).indexOf('social rush') !== -1);
        window.urbisComentarios = cacheArr.filter(p => tipoTxtC(p).indexOf('comentario') !== -1);
        window.urbisPeticiones  = cacheArr.filter(p => tipoTxtC(p).indexOf('peticion') !== -1);
        window.urbisVitrina      = cacheArr.filter(p => tipoTxtC(p).indexOf('emprendimiento') !== -1);
        window.urbisVitrinaItems = cacheArr.filter(p => tipoTxtC(p).indexOf('portafolio') !== -1);
        window.urbisUbicaciones  = cacheArr.filter(p => tipoTxtC(p).indexOf('ubicacion') !== -1);
        window.urbisRelaciones   = cacheArr.filter(p => tipoTxtC(p).indexOf('relacion') !== -1);
        window.urbisPuntajes     = cacheArr.filter(p => tipoTxtC(p).indexOf('puntaje') !== -1);
        window.urbisAvatares = cacheArr.map(p => {
          if(!p) return null;
          if(tipoTxtC(p).indexOf('avatar') !== -1) return { lng:String(p.lng||''), descripcion:String(p.descripcion||'') };
          if(String(p.lat||'').toLowerCase().indexOf('avatar') === 0) return { lng:String(p.descripcion||''), descripcion:String(p.fecha||'') };
          return null;
        }).filter(Boolean);
        globalData = cacheArr.filter(p => !esMetaC(p));
        const visibles = datosVisiblesActuales();
        pintarPuntos(visibles);
        actualizarGraficos(visibles);
        actualizarPanelAdmin();
        if(typeof renderEventosUrbis === 'function') renderEventosUrbis();
        analizarZonasCiudadanas(visibles, false);
        renderTimeline();
      } catch(_e) {
        manejarError("cargar puntos", error);
      }
    });
  }
  window.urbisCargarPuntos = function(){ try{ cargarPuntos(); }catch(e){} };

  // ══════════════════════════════════════════════════════════════════════════
  // MIS REPORTES / LÍNEA DE TIEMPO (móvil) — vive en scope compartido para usar
  // BASE_OFFSET, esAutorDelReporte, obtenerMetaTemporal, eliminarPunto, etc.
  // ══════════════════════════════════════════════════════════════════════════
  let _misReportesFiltro = 'todos';
  let _misReportesBusqueda = '';

  function _miReporteEstado(p){
    const d = String(p.descripcion || '').split(' | ');
    const meta = obtenerMetaTemporal(p);
    const validacion = d[BASE_OFFSET + 1] || 'Aprobado';
    if(meta.archivado) return { key:'archivado', label:'Archivado', cls:'st-arch' };
    if(validacion === 'Pendiente') return { key:'pendiente', label:'Por validar', cls:'st-pend' };
    if(meta.temporal){
      const hrs = Math.floor((meta.expira.getTime() - Date.now())/3600000);
      return { key:'activo', label: hrs >= 1 ? `Activo · vence en ${hrs}h` : 'Activo · vence pronto', cls:'st-act' };
    }
    return { key:'activo', label:'Activo', cls:'st-act' };
  }

  // Pestañas "Mis reportes" ⇄ "Mis eventos": mismo patrón visual en ambas
  // pantallas (screens `timeline` y `mis-eventos`), navegación vía data-u52-go.
  function _misTabsHTML(activa){
    return `<div class="mis-tabs">
      <button class="mis-tab ${activa === 'reportes' ? 'active' : ''}" data-u52-go="timeline">📋 Mis reportes</button>
      <button class="mis-tab ${activa === 'eventos' ? 'active' : ''}" data-u52-go="mis-eventos">🎪 Mis eventos</button>
    </div>`;
  }

  function _normalizarBusqueda(s){
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  window.urbisRenderMisReportes = function(filtro){
    if(filtro) _misReportesFiltro = filtro;
    const cont = document.getElementById('u52-timeline-content');
    if(!cont) return;
    if(!Array.isArray(globalData) || !globalData.length){ try{ cargarPuntos(); }catch(e){} }

    // Reportes = todo lo mío EXCEPTO eventos (esos viven en "Mis eventos") Y
    // EXCEPTO lo georreferenciado en URBIS Pro City (esos viven en su propio
    // módulo — "Mostrar mis mapeos" en Pro City). Pedido explícito: no
    // mezclar reportes ciudadanos con mapeo urbano profesional.
    const mios = (Array.isArray(globalData) ? globalData : []).filter(p => {
      try{
        if(!esAutorDelReporte(p)) return false;
        if(p.tipo === '🎪 Eventos Comunitarios') return false;
        // urbisEsCategoriaProCity (js/20) es la lista COMPLETA y autoritativa
        // de las 14 dimensiones de Pro City; urbisEsCategoriaAutomapeo (línea
        // arriba, más vieja) le faltan 4 categorías — se consultan ambas por
        // si Pro City aún no cargó en esta pantalla.
        if(typeof window.urbisEsCategoriaProCity === 'function' && window.urbisEsCategoriaProCity(p.tipo)) return false;
        if(typeof window.urbisEsCategoriaAutomapeo === 'function' && window.urbisEsCategoriaAutomapeo(p.tipo)) return false;
        return true;
      }catch(e){ return false; }
    });
    mios.sort((a,b) => obtenerMetaTemporal(b).creado.getTime() - obtenerMetaTemporal(a).creado.getTime());

    const ahora = Date.now();
    const busq = _normalizarBusqueda(_misReportesBusqueda);
    const filtrados = mios.filter(p => {
      const est = _miReporteEstado(p);
      if(_misReportesFiltro === 'activos')    { if(!(est.key === 'activo' || est.key === 'pendiente')) return false; }
      if(_misReportesFiltro === 'archivados') { if(est.key !== 'archivado') return false; }
      if(_misReportesFiltro === 'hoy')        { if(!((ahora - obtenerMetaTemporal(p).creado.getTime()) < 86400000)) return false; }
      if(busq){
        const d = String(p.descripcion || '').split(' | ');
        const titulo = (d[1] && d[1].trim()) ? d[1] : (d[0] || '');
        const texto = _normalizarBusqueda(`${titulo} ${d[0] || ''} ${p.tipo || ''}`);
        if(texto.indexOf(busq) === -1) return false;
      }
      return true;
    });

    const chips = [['todos','Todos'],['activos','Activos'],['archivados','Archivados'],['hoy','Hoy']]
      .map(([k,l]) => `<button class="mis-chip ${_misReportesFiltro === k ? 'active' : ''}" onclick="window.urbisRenderMisReportes('${k}')">${l}</button>`).join('');

    let html = _misTabsHTML('reportes');
    html += `<div class="mis-rep-search"><input type="text" placeholder="🔎 Buscar por nombre, alerta o tipo…" value="${escaparHTML(_misReportesBusqueda)}" oninput="window.urbisBuscarMisReportes(this.value)"></div>`;
    html += `<div class="mis-rep-head"><div class="mis-rep-filtros">${chips}</div><div class="mis-rep-count">${filtrados.length} reporte(s)</div></div>`;

    if(!mios.length){
      html += `<div class="u52-empty-card"><span>🕒</span><div><b>Aún no has hecho reportes</b><small>Crea uno con el botón ＋ y aparecerá aquí, incluso después de vencer sus 8 horas.</small></div></div>`;
    } else if(!filtrados.length){
      html += `<div class="u52-empty-card"><span>🔎</span><div><b>Nada en este filtro</b><small>Prueba con “Todos” o cambia la búsqueda.</small></div></div>`;
    } else {
      html += '<div class="mis-rep-list">' + filtrados.map(p => {
        const d = String(p.descripcion || '').split(' | ');
        const meta = obtenerMetaTemporal(p);
        const est = _miReporteEstado(p);
        const titulo = (d[1] && d[1].trim()) ? d[1] : (d[0] || 'Reporte');
        const icono = construirBadgeIcono(p.tipo, d[0], 'mis-rep-icon');
        const fotoURL = d[BASE_OFFSET];
        const tieneFoto = fotoURL && fotoURL !== 'N/A' && String(fotoURL).trim();
        const lat = p.lat;
        const archivado = est.key === 'archivado';
        return `<div class="mis-rep-card ${est.cls}">
          <div class="mis-rep-top">
            ${icono}
            <div class="mis-rep-info">
              <b>${titulo}</b>
              <small>${p.tipo} · ${formatearFechaHora(meta.creado)}</small>
              <span class="mis-rep-badge ${est.cls}">${est.label}</span>
            </div>
            ${tieneFoto ? `<img class="mis-rep-thumb" src="${fotoURL}" alt="">` : ''}
          </div>
          <div class="mis-rep-actions">
            <button onclick="window.urbisVerEnMapa('${lat}')">🗺️ Ver</button>
            ${archivado
              ? `<button class="act" onclick="window.urbisToggleReporte('${lat}', true, this)">⤴ Reactivar</button>`
              : `<button class="deact" onclick="window.urbisToggleReporte('${lat}', false, this)">⏸ Desactivar</button>`}
            <button onclick="window.urbisEditarReporteMovil ? window.urbisEditarReporteMovil('${lat}') : (window.prepararEdicion && window.prepararEdicion('${lat}'))">✏️</button>
            <button class="del" onclick="window.eliminarPunto && window.eliminarPunto('${lat}')">🗑️</button>
          </div>
        </div>`;
      }).join('') + '</div>';
    }
    cont.innerHTML = html;
  };

  // Buscar mientras se escribe SIN reconstruir el <input> (perdería el foco y
  // la posición del cursor en cada tecla): se guarda el texto, se repinta todo
  // el contenido, y luego se restaura foco+cursor sobre el input recién creado.
  window.urbisBuscarMisReportes = function(texto){
    _misReportesBusqueda = texto;
    const cont = document.getElementById('u52-timeline-content');
    const activo = cont ? document.activeElement : null;
    const cursor = (activo && activo.tagName === 'INPUT') ? activo.selectionStart : null;
    window.urbisRenderMisReportes();
    const inputNuevo = cont ? cont.querySelector('.mis-rep-search input') : null;
    if(inputNuevo){ inputNuevo.focus(); if(cursor != null){ try{ inputNuevo.setSelectionRange(cursor, cursor); }catch(e){} } }
  };

  // ── Mis eventos: mismo patrón que Mis reportes, pero solo eventos propios,
  // incluidos los ya finalizados/archivados (ej. Juegos URBIS vencido) — la
  // pestaña "Eventos" en vivo ya NO los muestra (ver js/09-events.js). ──
  let _misEventosFiltro = 'todos';
  let _misEventosBusqueda = '';

  window.urbisRenderMisEventos = function(filtro){
    if(filtro) _misEventosFiltro = filtro;
    const cont = document.getElementById('u52-miseventos-content');
    if(!cont) return;
    if(!Array.isArray(globalData) || !globalData.length){ try{ cargarPuntos(); }catch(e){} }

    const mios = (Array.isArray(globalData) ? globalData : []).filter(p => {
      try{ return p.tipo === '🎪 Eventos Comunitarios' && esAutorDelReporte(p); }catch(e){ return false; }
    });
    mios.sort((a,b) => obtenerMetaTemporal(b).creado.getTime() - obtenerMetaTemporal(a).creado.getTime());

    const busq = _normalizarBusqueda(_misEventosBusqueda);
    const filtrados = mios.filter(p => {
      const meta = obtenerMetaTemporal(p);
      if(_misEventosFiltro === 'vivo' && meta.archivado) return false;
      if(_misEventosFiltro === 'archivados' && !meta.archivado) return false;
      if(busq){
        const d = String(p.descripcion || '').split(' | ');
        const titulo = (d[1] && d[1].trim()) ? d[1] : (d[0] || '');
        const texto = _normalizarBusqueda(`${titulo} ${d[0] || ''} ${p.tipo || ''}`);
        if(texto.indexOf(busq) === -1) return false;
      }
      return true;
    });

    const chips = [['todos','Todos'],['vivo','En vivo'],['archivados','Finalizados']]
      .map(([k,l]) => `<button class="mis-chip ${_misEventosFiltro === k ? 'active' : ''}" onclick="window.urbisRenderMisEventos('${k}')">${l}</button>`).join('');

    let html = _misTabsHTML('eventos');
    html += `<div class="mis-rep-search"><input type="text" placeholder="🔎 Buscar por nombre o tipo de evento…" value="${escaparHTML(_misEventosBusqueda)}" oninput="window.urbisBuscarMisEventos(this.value)"></div>`;
    html += `<div class="mis-rep-head"><div class="mis-rep-filtros">${chips}</div><div class="mis-rep-count">${filtrados.length} evento(s)</div></div>`;

    if(!mios.length){
      html += `<div class="u52-empty-card"><span>🎪</span><div><b>Aún no has creado eventos</b><small>Crea uno desde el mapa: toca una cancha, parque o plaza y elige “Evento”.</small></div></div>`;
    } else if(!filtrados.length){
      html += `<div class="u52-empty-card"><span>🔎</span><div><b>Nada en este filtro</b><small>Prueba con “Todos” o cambia la búsqueda.</small></div></div>`;
    } else {
      html += '<div class="mis-rep-list">' + filtrados.map(p => {
        const d = String(p.descripcion || '').split(' | ');
        const meta = obtenerMetaTemporal(p);
        const titulo = (d[1] && d[1].trim()) ? d[1] : (d[0] || 'Evento');
        const icono = construirBadgeIcono(p.tipo, d[0], 'mis-rep-icon');
        const lat = p.lat;
        const archivado = meta.archivado;
        const estCls = archivado ? 'st-arch' : 'st-act';
        const estLabel = archivado ? '📦 Finalizado' : '🟢 En vivo';
        return `<div class="mis-rep-card ${estCls}">
          <div class="mis-rep-top">
            ${icono}
            <div class="mis-rep-info">
              <b>${titulo}</b>
              <small>${d[0] || p.tipo} · ${formatearFechaHora(meta.creado)}</small>
              <span class="mis-rep-badge ${estCls}">${estLabel}</span>
            </div>
          </div>
          <div class="mis-rep-actions">
            <button onclick="window.urbisVerEnMapa('${lat}')">🗺️ Ver</button>
            ${archivado
              ? ''
              : `<button class="deact" onclick="window.urbisToggleReporte('${lat}', false, this)">⏸ Finalizar</button>`}
          </div>
        </div>`;
      }).join('') + '</div>';
    }
    cont.innerHTML = html;
  };

  window.urbisBuscarMisEventos = function(texto){
    _misEventosBusqueda = texto;
    const cont = document.getElementById('u52-miseventos-content');
    const activo = cont ? document.activeElement : null;
    const cursor = (activo && activo.tagName === 'INPUT') ? activo.selectionStart : null;
    window.urbisRenderMisEventos();
    const inputNuevo = cont ? cont.querySelector('.mis-rep-search input') : null;
    if(inputNuevo){ inputNuevo.focus(); if(cursor != null){ try{ inputNuevo.setSelectionRange(cursor, cursor); }catch(e){} } }
  };

  let _urbisVerTempMarker = null;
  window.urbisVerEnMapa = function(lat){
    const p = buscarPuntoPorLat(lat); if(!p) return;
    const la = parseFloat(String(p.lat).replace(',', '.')), ln = parseFloat(String(p.lng).replace(',', '.'));
    try{ if(window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') window.UrbisMobileAppV58.show('map'); }catch(e){}
    setTimeout(()=>{
      try{
        map.setView([la, ln], 17);
        // Marcador temporal resaltado: así se ve la ubicación aunque el reporte
        // esté archivado (sin marcador propio en el mapa).
        try{ if(_urbisVerTempMarker) { map.removeLayer(_urbisVerTempMarker); _urbisVerTempMarker = null; } }catch(e){}
        const meta = (typeof obtenerMetaTemporal === 'function') ? obtenerMetaTemporal(p) : {archivado:false};
        const color = meta.archivado ? '#9aa6b8' : '#FF6500';
        _urbisVerTempMarker = L.circleMarker([la, ln], { radius:14, color:color, weight:3, fillColor:color, fillOpacity:.35 }).addTo(map);
        _urbisVerTempMarker.bindTooltip(meta.archivado ? 'Reporte archivado — toca “Reactivar” para mostrarlo en el mapa' : 'Tu reporte', { permanent:false }).openTooltip();
        const _m = _urbisVerTempMarker;
        setTimeout(()=>{ try{ if(_m) map.removeLayer(_m); if(_urbisVerTempMarker === _m) _urbisVerTempMarker = null; }catch(e){} }, 8000);
        if(typeof mostrarDetalles === 'function') mostrarDetalles(p);
      }catch(e){}
    }, 240);
  };

  window.urbisToggleReporte = function(lat, activar, btn){
    const p = buscarPuntoPorLat(lat); if(!p) return;
    const d = String(p.descripcion || '').split(' | ');
    const idxEstado   = BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3;
    const idxExpira   = BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 1;
    const idxTemporal = BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 2;
    if(activar){
      d[idxEstado] = 'Activo';
      if((d[idxTemporal] || '').toLowerCase() === 'temporal'){
        d[idxExpira] = new Date(Date.now() + TTL_HORAS_REPORTES_TEMPORALES * 3600000).toISOString();
      }
    } else {
      d[idxEstado] = 'Archivado';
    }
    const descripcionFinal = d.join(' | ');
    if(btn){ btn.disabled = true; btn.textContent = '…'; }
    window.urbisDBUpdate('lat', lat, { descripcion: descripcionFinal })
      .then(()=>{
        if(typeof playSuccessSound === 'function') playSuccessSound();
        setTimeout(()=>{
          try{ cargarPuntos(); }catch(e){}
          setTimeout(()=>{
            try{ if(document.querySelector('[data-u52-screen="timeline"]')?.classList.contains('active')) window.urbisRenderMisReportes(); }catch(e){}
            try{ if(document.querySelector('[data-u52-screen="mis-eventos"]')?.classList.contains('active')) window.urbisRenderMisEventos(); }catch(e){}
          }, 800);
        }, 300);
      })
      .catch(err => { alert('No se pudo actualizar el reporte: ' + (err && err.message || err)); if(btn){ btn.disabled = false; btn.textContent = activar ? '⤴ Reactivar' : '⏸ Desactivar'; } });
  };

  // Archivar un evento de Juegos URBIS premium: desaparece del mapa para TODOS (la gota
  // dorada usa un renderizador forzado propio, js/47-aurea-forzado.js, que la
  // dibuja saltándose los filtros normales — por eso NO basta con eliminarlo,
  // hay que marcarlo Archivado; el render forzado ya respeta ese estado y lo
  // quita solo). El registro NO se borra: queda guardado con estado Archivado,
  // visible en la línea temporal/histórico de admin y en "Mis reportes".
  window.urbisArchivarEventoAurea = function(lat){
    const p = buscarPuntoPorLat(lat);
    if(!p) { alert('No se encontró el evento para archivar.'); return; }
    if(!confirm('¿Archivar este evento de Juegos URBIS? Desaparecerá del mapa para todos los usuarios y quedará guardado en el histórico/línea de tiempo.')) return;
    const d = String(p.descripcion || '').split(' | ');
    const idxEstado = BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3;
    d[idxEstado] = 'Archivado';
    const descripcionFinal = d.join(' | ');
    try{ map.closePopup(); }catch(e){}
    window.urbisDBUpdate('lat', lat, { descripcion: descripcionFinal })
      .then(()=>{
        if(typeof playSuccessSound === 'function') playSuccessSound();
        try{ if(typeof window.urbisToast === 'function') window.urbisToast('📦 Evento archivado. Queda guardado en el histórico.'); }catch(e){}
        setTimeout(()=>{
          try{ cargarPuntos(); }catch(e){}
          // No esperar el ciclo de 3.5s del render forzado: refrescarlo ya para
          // que la gota desaparezca del mapa al instante para quien archiva.
          setTimeout(()=>{ try{ if(typeof window.urbisRenderAureaForzado === 'function') window.urbisRenderAureaForzado(); }catch(e){} }, 400);
        }, 300);
      })
      .catch(err => alert('No se pudo archivar el evento: ' + (err && err.message || err)));
  };

  // ── Editor móvil propio (confiable) ──────────────────────────────────────────
  // Formulario simple: título, descripción y foto opcional. No depende del
  // formulario desktop ni del #sidebar oculto.
  // ── Comentarios en reportes/eventos ─────────────────────────────────────────
  window.urbisComentarios = window.urbisComentarios || [];
  window.urbisContarComentarios = function(lat){
    const ref = String(lat);
    return (window.urbisComentarios || []).filter(c => String(c.lat) === ref).length;
  };
  window.urbisAbrirComentarios = function(lat, titulo){
    const ref = String(lat);
    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const comentariosDe = () => (window.urbisComentarios || [])
        .filter(c => String(c.lat) === ref)
        .sort((a,b) => new Date(a.fecha||0) - new Date(b.fecha||0));
    let sheet = document.getElementById('urbis-coment-sheet');
    if(sheet) sheet.remove();
    sheet = document.createElement('div');
    sheet.id = 'urbis-coment-sheet';
    sheet.innerHTML = `<div class="uc-card">
        <button type="button" class="uc-close" aria-label="Cerrar">×</button>
        <h2>💬 Comentarios</h2>
        <div class="uc-ref">${esc(titulo || 'Reporte')}</div>
        <div class="uc-list"></div>
        <div class="uc-form">
          <textarea class="uc-input" rows="2" maxlength="600" placeholder="Escribe un comentario respetuoso…"></textarea>
          <button type="button" class="uc-send">Enviar</button>
        </div>
      </div>`;
    document.body.appendChild(sheet);
    const cerrar = () => { try{ sheet.remove(); }catch(e){} };
    sheet.querySelector('.uc-close').onclick = cerrar;
    const render = () => {
      const lista = comentariosDe();
      // Ver lo denunciado es cosa de quien decide sobre ello; retirarlo, de
      // quien tiene ese permiso. Son dos cosas distintas y se preguntan
      // aparte: una moderadora puede tener una y no la otra.
      const puedeMod = p => { try { return typeof window.urbisPuede === 'function' && window.urbisPuede(p); } catch(e){ return false; } };
      // Quien puede retirar también tiene que poder LEER lo que retira: si no,
      // el comentario denunciado —justo el que hay que quitar— le queda
      // invisible y el permiso no sirve de nada.
      const soyModerador = (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin())
                        || puedeMod('moderar') || puedeMod('eliminar')
                        || (typeof urbisIdentidadActual === 'function' && urbisIdentidadActual().rol === 'gov');
      const visibles = lista.filter(c => {
        // Un comentario denunciado sale de la conversación mientras se revisa.
        // El moderador lo sigue viendo: tiene que poder leerlo para decidir.
        if(typeof window.urbisContenidoOculto !== 'function') return true;
        return soyModerador || !window.urbisContenidoOculto(c);
      });
      const html = visibles.length ? visibles.map((c, i) => {
        const parts = String(c.descripcion || '').split(/Â?§|~~~/);
        const usuario = parts[0] || 'Ciudadano';
        // Solo el SEGUNDO campo es lo que la persona escribió. El tercero, si
        // existe, son las denuncias (js/13c) y nunca debe salir en pantalla.
        const texto = parts[1] || '';
        const fecha = c.fecha ? new Date(c.fecha).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
        let escondido = '', accion = '';
        try {
          if(typeof window.urbisContenidoOculto === 'function' && window.urbisContenidoOculto(c)) {
            escondido = '<span class="uc-oculto">🚩 Denunciado · escondido mientras se revisa</span>';
          }
          if(typeof window.urbisAbrirDenuncia === 'function') {
            accion = `<button type="button" class="uc-denunciar" data-uc-i="${i}" aria-label="Denunciar comentario">🚩</button>`;
          }
          // Borrar el comentario: su autor, y el administrador cualquiera.
          // Quien manda de verdad es el servidor (v575); esto solo decide a
          // quién se le enseña el botón, para no ofrecer lo que va a fallar.
          const miUsuario = (typeof window.urbisUsuarioActual === 'function' && window.urbisUsuarioActual()) || '';
          const esMio = miUsuario && String(usuario).trim().toLowerCase() === String(miUsuario).trim().toLowerCase();
          if((soyModerador || esMio || puedeMod('eliminar')) && typeof window.urbisBorrarPublicacion === 'function') {
            accion += `<button type="button" class="uc-borrar" data-uc-i="${i}" aria-label="Eliminar comentario">🗑️</button>`;
          }
        } catch(e){}
        return `<div class="uc-item"><div class="uc-item-top"><b>@${esc(usuario)}</b><span class="uc-fecha">${esc(fecha)}</span>${accion}</div><p>${esc(texto)}</p>${escondido}</div>`;
      }).join('') : '<div class="uc-empty">Aún no hay comentarios. Sé el primero.</div>';
      sheet.querySelector('.uc-list').innerHTML = html;
      sheet.querySelectorAll('.uc-borrar').forEach(function(b){
        b.addEventListener('click', async function(){
          const c = visibles[parseInt(b.dataset.ucI, 10)];
          if(!c) return;
          if(!confirm('¿Eliminar este comentario?\n\nNo se puede deshacer.')) return;
          b.disabled = true; b.textContent = '…';
          try{
            await window.urbisBorrarPublicacion(c);
            // El comentario vive en dos sitios: la tabla general y la lista en
            // memoria que pinta esta hoja. Si solo se borra de una, reaparece.
            window.urbisComentarios = (window.urbisComentarios || []).filter(x => x !== c);
            render();
          }catch(err){
            b.disabled = false; b.textContent = '🗑️';
            alert('No se pudo eliminar: ' + (err && err.message || err));
          }
        });
      });
      sheet.querySelectorAll('.uc-denunciar').forEach(function(b){
        b.addEventListener('click', function(){
          const c = visibles[parseInt(b.dataset.ucI, 10)];
          if(c) window.urbisAbrirDenuncia(c, 'Comentario de @' + (String(c.descripcion||'').split(/Â?§|~~~/)[0] || 'ciudadano'));
        });
      });
    };
    // La hoja se repinta sola cuando alguien denuncia un comentario desde aquí
    // (js/13c la llama al terminar): si no, el comentario denunciado seguiría
    // en pantalla y parecería que no pasó nada.
    sheet.__urbisRender = render;
    render();
    sheet.querySelector('.uc-send').onclick = async function(){
      const ta = sheet.querySelector('.uc-input');
      const texto = (ta.value || '').trim().replace(/~~~/g, ' ').replace(/[§|]/g, ' ');
      if(!texto) return;
      const usuario = (typeof window.urbisUsuarioActual === 'function' && window.urbisUsuarioActual()) || window.userUsernameGlobal || '';
      if(!usuario && !(window.urbisHaySesion && window.urbisHaySesion())){ const n = prompt('¿Cuál es tu nombre de usuario URBIS? (sin @)'); if(n && window.urbisSetMiUsuario) window.urbisSetMiUsuario(n); if(!(typeof window.urbisUsuarioActual==='function' && window.urbisUsuarioActual())){ alert('Necesitas definir tu usuario para comentar.'); return; } }
      const usuarioFinal = (typeof window.urbisUsuarioActual === 'function' && window.urbisUsuarioActual()) || usuario;
      const btn = this; btn.disabled = true; btn.textContent = 'Enviando…';
      const fila = { tipo:'💬 Comentario', lat:ref, lng:'0', descripcion: String(usuarioFinal).replace(/~~~/g,' ') + '~~~' + texto, fecha: new Date().toISOString() };
      try{
        await window.urbisGuardarFila(fila);
        (window.urbisComentarios = window.urbisComentarios || []).push(fila);
        ta.value = ''; render();
        if(typeof playSuccessSound === 'function') playSuccessSound();
      }catch(err){ alert('No se pudo enviar el comentario: ' + (err && err.message || err)); }
      finally{ btn.disabled = false; btn.textContent = 'Enviar'; }
    };
  };

  // ════════════════════════════════════════════════════════════════════════
  // SEGURIDAD: ubicación de contactos (amigos / familia) — versión básica.
  // Filas SheetDB: "📍 Ubicacion" (descripcion=usuario, lat/lng/fecha) y
  // "🤝 Relacion" (descripcion=`miUsuario§contacto§amigo|familia`).
  // ════════════════════════════════════════════════════════════════════════
  window.urbisUbicaciones = window.urbisUbicaciones || [];
  window.urbisRelaciones  = window.urbisRelaciones  || [];
  let _urbisContactosLayer = null;

  // Resuelve el usuario actual desde la sesión; si está vacío, usa el override
  // local que el usuario puede definir manualmente (sesiones viejas sin usuario).
  // ¿Hay una sesión iniciada? (registrado y logueado)
  window.urbisHaySesion = function(){
    try{ const s = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null; return !!(s && (s.usuario || s.correo || s.nombre_completo || s.user_id)); }catch(e){ return false; }
  };
  window.urbisUsuarioActual = function(){
    try{
      const s = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null;
      if(s){
        if(s.usuario) return String(s.usuario).trim().toLowerCase();
        // Sesión sin usuario (fila vieja o despliegue antiguo): derivar para que el
        // perfil NO quede genérico ni se le pida definir usuario otra vez.
        if(s.correo && String(s.correo).indexOf('@') !== -1) return String(s.correo).split('@')[0].trim().toLowerCase();
        if(s.nombre_completo) return String(s.nombre_completo).trim().toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9._-]/g,'').slice(0,20);
      }
    }catch(e){}
    if(window.userUsernameGlobal) return window.userUsernameGlobal;
    try{ const o = localStorage.getItem('urbis_usuario_local'); if(o) return o; }catch(e){}
    return '';
  };
  window.urbisSetMiUsuario = function(u){
    const v = String(u||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if(!v) return '';
    try{ localStorage.setItem('urbis_usuario_local', v); }catch(e){}
    window.userUsernameGlobal = v;
    try{
      const key = (window.URBIS_CONFIG && window.URBIS_CONFIG.AUTH && window.URBIS_CONFIG.AUTH.SESSION_KEY) || 'urbis_auth_session_v1';
      const s = JSON.parse(localStorage.getItem(key) || 'null');
      if(s){ s.usuario = v; localStorage.setItem(key, JSON.stringify(s)); }
    }catch(e){}
    try{ if(typeof window.urbisSyncSharedIdentity === 'function') window.urbisSyncSharedIdentity(); }catch(e){}
    return v;
  };
  function urbisMiUsuario(){ return window.urbisUsuarioActual(); }
  // Devuelve el usuario. Si ya hay sesión iniciada, NUNCA pregunta (la persona ya
  // tiene su usuario desde el registro; volver a pedirlo genera conflictos). Solo
  // pregunta como último recurso si no hay ninguna sesión.
  function urbisAsegurarUsuario(){
    let u = window.urbisUsuarioActual();
    if(!u && !window.urbisHaySesion()){
      const nuevo = prompt('¿Cuál es tu nombre de usuario URBIS? (sin @)\nEjemplo: jesmen21');
      if(nuevo){ u = window.urbisSetMiUsuario(nuevo); try{ if(typeof window.urbisApplyProfileIdentityUI === 'function') window.urbisApplyProfileIdentityUI(); }catch(e){} }
    }
    return u;
  }
  function _haceCuanto(fecha){
    const ms = Date.now() - new Date(fecha||0).getTime();
    if(isNaN(ms) || ms < 0) return 'sin datos';
    const m = Math.floor(ms/60000);
    if(m < 1) return 'hace un momento';
    if(m < 60) return `hace ${m} min`;
    const h = Math.floor(m/60); if(h < 24) return `hace ${h} h`;
    const d = Math.floor(h/24); return `hace ${d} día${d>1?'s':''}`;
  }

  window.urbisCompartirUbicacion = function(silencioso){
    const usuario = silencioso ? urbisMiUsuario() : urbisAsegurarUsuario();
    if(!usuario){ if(!silencioso) alert('Necesitas definir tu usuario para compartir tu ubicación.'); return; }
    if(!navigator.geolocation){ if(!silencioso) alert('Tu dispositivo no permite GPS.'); return; }
    navigator.geolocation.getCurrentPosition(function(pos){
      const lat = pos.coords.latitude.toFixed(7), lng = pos.coords.longitude.toFixed(7);
      const fecha = new Date().toISOString();
      // Life360: cada usuario tiene UNA sola fila viva con un 'tipo' único y corto.
      // Actualizamos por 'tipo' (valores cortos) y NO por 'descripcion' (que guarda
      // reportes larguísimos y rompe el motor fnmatch de SheetDB con error 400).
      const tipoGps = 'ubicacion_' + String(usuario).toLowerCase().replace(/[^a-z0-9._-]/g,'');
      const fila = { tipo: tipoGps, lat, lng, descripcion:String(usuario), fecha };
      window.urbisDBUpdate('tipo', tipoGps, { lat, lng, fecha, descripcion:String(usuario) }).then(res => {
        // Update por 'tipo' único SIEMPRE acierta tras el primer write: sin duplicados.
        if(!res || (!res.updated && res.ok !== true) || res.updated === 0){
          window.urbisGuardarFila(fila).catch(()=>{});
        }
        // Cache local: un único registro por usuario.
        window.urbisUbicaciones = window.urbisUbicaciones || [];
        const idx = window.urbisUbicaciones.findIndex(u => String(u.descripcion||'').toLowerCase() === usuario.toLowerCase());
        if(idx >= 0) window.urbisUbicaciones[idx] = fila; else window.urbisUbicaciones.push(fila);
        if(!silencioso) alert('✅ Tu ubicación se compartió con tus contactos.');
      }).catch(()=>{ if(!silencioso) alert('No se pudo compartir la ubicación.'); });
    }, function(){ if(!silencioso) alert('No se pudo obtener tu GPS. Activa la ubicación.'); }, { enableHighAccuracy:true, timeout:9000 });
  };

  window.urbisAgregarContacto = function(usuario, relacion, cb){
    const yo = urbisAsegurarUsuario();
    if(!yo){ alert('Necesitas definir tu usuario para agregar contactos.'); return; }
    const cont = String(usuario||'').trim().replace(/[§|]/g,'');
    if(!cont){ alert('Escribe el usuario del contacto.'); return; }
    const rel = relacion === 'familia' ? 'familia' : 'amigo';
    const fila = { tipo:'🤝 Relacion', lat:'0', lng:'0', descripcion: yo+'~~~'+cont+'~~~'+rel, fecha:new Date().toISOString() };
    window.urbisGuardarFila(fila)
      .then(()=>{ (window.urbisRelaciones = window.urbisRelaciones||[]).push(fila); if(typeof cb==='function') cb(); })
      .catch(()=> alert('No se pudo agregar el contacto.'));
  };
  // Escritura directa de relación sin UI (vía Apps Script) para uso interno tras aceptar
  // solicitudes. (Nombre histórico; ya NO usa SheetDB.)
  window.urbisAgregarContactoSheetDB = function(dueño, contacto, relacion){
    const rel = relacion === 'familia' ? 'familia' : 'amigo';
    const cont = String(contacto||'').trim().replace(/[§|]/g,'');
    const due = String(dueño||'').trim().replace(/[§|]/g,'');
    if(!due || !cont) return;
    // Evitar duplicados en memoria local
    const ya = (window.urbisRelaciones||[]).some(r => {
      const p = _metaSplit(r.descripcion);
      return (p[0]||'').toLowerCase() === due.toLowerCase() && (p[1]||'').toLowerCase() === cont.toLowerCase();
    });
    const fila = { tipo:'🤝 Relacion', lat:'0', lng:'0', descripcion: due+'~~~'+cont+'~~~'+rel, fecha:new Date().toISOString() };
    if(!ya)(window.urbisRelaciones = window.urbisRelaciones||[]).push(fila);
    window.urbisGuardarFila(fila).catch(()=>{});
  };
  // Eliminar amigo: borra la relación (Apps Script) + notifica al backend social.
  window.urbisEliminarContacto = function(usuario, cb){
    const yo = (urbisMiUsuario()||'').trim();
    if(!yo || !usuario) return;
    if(!confirm('¿Eliminar a @' + usuario + ' de tus contactos?')) return;
    const yo_l = yo.toLowerCase(), ellos_l = String(usuario).toLowerCase();
    // Borrar ambos lados en memoria local
    window.urbisRelaciones = (window.urbisRelaciones||[]).filter(r => {
      const p = _metaSplit(r.descripcion);
      const d = (p[0]||'').toLowerCase(), c = (p[1]||'').toLowerCase();
      return !((d === yo_l && c === ellos_l) || (d === ellos_l && c === yo_l));
    });
    // Borrar la relación (Apps Script db_delete) por el campo descripcion
    const descKey = yo + '~~~' + usuario + '~~~amigo';
    window.urbisDBDelete('descripcion', descKey).catch(()=>{});
    const descKey2 = usuario + '~~~' + yo + '~~~amigo';
    window.urbisDBDelete('descripcion', descKey2).catch(()=>{});
    // Notificar Apps Script (best-effort)
    try{
      const ep = (typeof URBIS_CONFIG !== 'undefined' && URBIS_CONFIG.AUTH && URBIS_CONFIG.AUTH.APPS_SCRIPT_ENDPOINT) || '';
      const s = window.URBIS_AUTH && window.URBIS_AUTH.readSession ? window.URBIS_AUTH.readSession() : {};
      const id = (s && (s.user_id || s.friend_code || s.usuario || s.correo)) || '';
      if(ep && id) fetch(ep, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'social_remove_friend', identifier:id, current_user_id:(s&&s.user_id)||'', target_usuario:usuario }) }).catch(()=>{});
    }catch(e){}
    if(typeof cb === 'function') cb();
  };

  // Separador robusto: acepta § (y su mojibake Â§) y el nuevo ~~~ (ASCII seguro).
  function _metaSplit(s){ return String(s||'').split(/Â?§|~~~/); }
  function urbisMisContactos(relacion){
    const yo = (urbisMiUsuario()||'').trim().toLowerCase();
    const out = {}, outRel = {}, back = {};
    (window.urbisRelaciones||[]).forEach(r => {
      const p = _metaSplit(r.descripcion);
      const dueno = (p[0]||'').trim().toLowerCase();
      const contacto = (p[1]||'').trim().toLowerCase();
      const tipoRel = (p[2]||'amigo').trim().toLowerCase();
      if(dueno === yo && contacto && contacto !== 'sin_usuario') { out[contacto] = (p[1]||'').trim(); outRel[contacto] = tipoRel; }
      if(contacto === yo && dueno) back[dueno] = true; // la otra persona también me tiene
    });
    // Solo mostrar si ambas partes tienen la relación (mutual).
    return Object.keys(out).filter(k => back[k]).filter(k => relacion === 'todos' || outRel[k] === relacion).map(k => out[k]);
  }
  function urbisUbicacionDe(usuario){
    const u = String(usuario||'').toLowerCase();
    let mejor = null;
    (window.urbisUbicaciones||[]).forEach(p => {
      if(String(p.descripcion||'').toLowerCase() === u && (!mejor || new Date(p.fecha||0) > new Date(mejor.fecha||0))) mejor = p;
    });
    return mejor;
  }

  window.urbisVerContactosEnMapa = function(relacion){
    const contactos = urbisMisContactos(relacion);
    try{ if(window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') window.UrbisMobileAppV58.show('map'); }catch(e){}
    setTimeout(()=>{
      try{
        if(!_urbisContactosLayer) _urbisContactosLayer = L.layerGroup().addTo(map); else _urbisContactosLayer.clearLayers();
        const pts = [];
        contactos.forEach(c => {
          const u = urbisUbicacionDe(c); if(!u) return;
          const la = parseFloat(u.lat), ln = parseFloat(u.lng); if(isNaN(la)||isNaN(ln)) return;
          const activo = (Date.now() - new Date(u.fecha||0).getTime()) < 5*60000;
          const color = activo ? '#16a34a' : '#9aa6b8';
          const m = L.circleMarker([la, ln], { radius:12, color:'#fff', weight:3, fillColor:color, fillOpacity:.95 }).addTo(_urbisContactosLayer);
          m.bindPopup(`<b>@${c}</b><br>${activo ? '🟢 En línea ahora' : '⚪ ' + _haceCuanto(u.fecha)}`);
          pts.push([la, ln]);
        });
        if(pts.length) map.fitBounds(pts, { padding:[60,60], maxZoom:16 });
        else alert('Ninguno de tus ' + (relacion==='familia'?'familiares':'amigos') + ' ha compartido su ubicación todavía.');
      }catch(e){}
    }, 250);
  };

  function _colorAvatar(s){
    let h = 0; const t = String(s||'?');
    for(let i=0;i<t.length;i++) h = (h*31 + t.charCodeAt(i)) % 360;
    return `hsl(${h},58%,52%)`;
  }
  window.urbisRenderContactos = function(relacion, _yaCargo){
    const cont = document.getElementById('u52-contactos-lista');
    if(!cont) return;
    relacion = (relacion === 'familia') ? 'familia' : (relacion === 'amigo' ? 'amigo' : 'todos');
    const etiqueta = relacion === 'familia' ? 'familiares' : (relacion === 'amigo' ? 'amigos' : 'contactos');
    const ico = relacion === 'familia' ? '👨‍👩‍👧' : (relacion === 'amigo' ? '👥' : '👤');
    // Si aún no hay relaciones en memoria, las traemos DIRECTO de la base (una vez)
    // y reintentamos, para que los contactos salgan aunque cargarPuntos no haya corrido.
    if((!Array.isArray(window.urbisRelaciones) || !window.urbisRelaciones.length) && !_yaCargo){
      cont.innerHTML = `<div class="ct-empty">⏳<span>Cargando contactos…</span></div>`;
      window.urbisDBRead().then(data => {
        const arr = Array.isArray(data) ? data : [];
        arr.forEach(p => { if(p){ if(p.lat!=null) p.lat = String(p.lat).replace(',', '.'); if(p.lng!=null) p.lng = String(p.lng).replace(',', '.'); } });
        const tt = p => String((p && p.tipo) || '').toLowerCase();
        window.urbisRelaciones  = arr.filter(p => tt(p).indexOf('relacion') !== -1);
        window.urbisUbicaciones = arr.filter(p => tt(p).indexOf('ubicacion') !== -1);
        window.urbisAvatares = arr.map(p => {
          if(!p) return null;
          if(tt(p).indexOf('avatar') !== -1) return { lng:String(p.lng||''), descripcion:String(p.descripcion||'') };
          if(String(p.lat||'').toLowerCase().indexOf('avatar') === 0) return { lng:String(p.descripcion||''), descripcion:String(p.fecha||'') };
          return null;
        }).filter(Boolean);
        window.urbisRenderContactos(relacion, true);
      }).catch(()=>{ window.urbisRenderContactos(relacion, true); });
      return;
    }
    const yo = window.urbisUsuarioActual ? window.urbisUsuarioActual() : '';
    if(!yo){
      // Solo se pide definir usuario si NO hay sesión. Con sesión iniciada el usuario
      // ya existe (no volver a pedirlo: genera conflictos).
      if(window.urbisHaySesion && window.urbisHaySesion()){
        cont.innerHTML = `<div class="ct-empty">😕<span>No pudimos leer tu usuario. Cierra y vuelve a iniciar sesión.</span></div>`;
      } else {
        cont.innerHTML = `<div class="ct-empty">🙋<span>Inicia sesión para ver a tus ${etiqueta}.</span></div>`;
      }
      return;
    }
    // Construir mapa de datos de amigos para el panel de perfil
    window._urbisAmigosMap = {};
    if(Array.isArray(window.urbisAmigosFromServer)){
      window.urbisAmigosFromServer.forEach(f => { if(f.usuario) window._urbisAmigosMap[f.usuario.toLowerCase()] = f; });
    }
    const _PERSON_SVG_AMIGO = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="#dde3ed"/><circle cx="48" cy="35" r="19" fill="#a8b2c2"/><ellipse cx="48" cy="84" rx="30" ry="22" fill="#a8b2c2"/></svg>';
    function _avatarHtmlAmigo(c){
      const key = String(c).toLowerCase();
      // 1) Avatar desde la IDENTIDAD del amigo (backend, viaja en social_get_friends). Robusto.
      let avatarId = '';
      try{ const fa = (window._urbisAmigosMap||{})[key]; if(fa && fa.avatar) avatarId = String(fa.avatar).trim(); }catch(e){}
      // 2) Respaldo: cache de SheetDB (filas viejas, ya normalizadas).
      if(!avatarId){ const avatarRow = (window.urbisAvatares||[]).find(p => String(p.lng||'').toLowerCase() === key); avatarId = avatarRow ? String(avatarRow.descripcion||'').trim() : ''; }
      const valido = /^avatar[-_][a-z0-9-]+$/i.test(avatarId);
      if(valido){
        // Avatar PNG sobre fondo BLANCO (NO silueta gris detrás, aunque el PNG sea transparente).
        return '<span style="width:100%;height:100%;border-radius:50%;overflow:hidden;display:block;background:#fff;">'
          + '<img src="assets/avatars/' + avatarId + '.png" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" onerror="this.style.display=\'none\'">'
          + '</span>';
      }
      // Sin avatar válido: silueta neutra que llena el círculo.
      return '<span style="width:100%;height:100%;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:#dde3ed;">' + _PERSON_SVG_AMIGO + '</span>';
    }
    const filaContacto = (c) => {
      const u = urbisUbicacionDe(c);
      const ms = u ? (Date.now() - new Date(u.fecha||0).getTime()) : Infinity;
      const activo = ms < 5*60000;
      const reciente = ms < 60*60000;
      const estado = !u ? 'Sin ubicación' : (activo ? 'En línea' : _haceCuanto(u.fecha));
      const dot = activo ? 'on' : (reciente ? 'recent' : 'off');
      return '<div class="amigo-row" data-amigo-usuario="' + c + '">' +
        '<button type="button" class="amigo-tap" onclick="window.urbisVerPerfilAmigo&&window.urbisVerPerfilAmigo(\'' + c + '\')">' +
          '<span class="amigo-av" style="background:none;overflow:hidden;">' + _avatarHtmlAmigo(c) + '<i class="amigo-dot ' + dot + '"></i></span>' +
          '<span class="amigo-info"><b>@' + c + '</b><small>' + estado + '</small></span>' +
        '</button>' +
        '<button type="button" class="amigo-chat" title="Enviar mensaje" onclick="event.stopPropagation();window.urbisAbrirChat&&window.urbisAbrirChat(\'' + c + '\',\'@' + c + '\');" style="background:#e6f7f2;border:none;color:#00B68D;width:38px;height:38px;border-radius:50%;font-size:1.05rem;cursor:pointer;flex-shrink:0;margin-right:6px;">💬</button>' +
        '<button type="button" class="amigo-del" data-amigo-del="' + c + '" onclick="event.stopPropagation();window.urbisEliminarContacto&&window.urbisEliminarContacto(\'' + c + '\',function(){try{window.urbisRenderContactos(\'todos\');}catch(ex){}});">✕</button>' +
      '</div>';
    };

    // Preferir lista del servidor (social_get_friends) sobre SheetDB cuando esté disponible
    let contactos;
    if(Array.isArray(window.urbisAmigosFromServer) && window.urbisAmigosFromServer.length){
      contactos = window.urbisAmigosFromServer.map(f => f.usuario).filter(u => u && u !== 'sin_usuario');
    } else {
      contactos = urbisMisContactos('todos');
    }
    let html = '';
    if(contactos.length){ html += `<div class="amigos-table">${contactos.map(filaContacto).join('')}</div>`; }
    else { html += `<div class="amigo-empty"><span>👥</span><span>Aún no tienes amigos en URBIS. Búscalos por usuario o ID URBIS.</span></div>`; }
    cont.innerHTML = html;
  };

  // Listener global para filas de amigos — se registra UNA SOLA VEZ al cargar el script
  // Sin closest() para compatibilidad con Android antiguo
  if(!window._urbisAmigoListenerSet){
    window._urbisAmigoListenerSet = true;
    document.addEventListener('click', function(e){
      var el = e.target;
      // Subir en el DOM buscando data-amigo-del (botón eliminar)
      var delEl = null, rowEl = null;
      var cur = el;
      for(var i=0; i<6 && cur && cur.tagName; i++){
        if(cur.getAttribute && cur.getAttribute('data-amigo-del')){ delEl = cur; break; }
        if(cur.getAttribute && cur.getAttribute('data-amigo-usuario')){ rowEl = cur; break; }
        cur = cur.parentNode;
      }
      if(delEl){
        var u = delEl.getAttribute('data-amigo-del');
        if(window.urbisEliminarContacto) window.urbisEliminarContacto(u, function(){ try{ window.urbisRenderContactos('todos'); }catch(ex){} });
        return;
      }
      if(rowEl){
        var usr = rowEl.getAttribute('data-amigo-usuario');
        if(usr && typeof window.urbisVerPerfilAmigo === 'function') window.urbisVerPerfilAmigo(usr);
      }
    }, true); // useCapture=true para capturar antes que otros handlers
  }

  window.urbisVerPerfilAmigo = function(usuario) {
    try {
      var key = String(usuario || '').toLowerCase();
      var datos = (window._urbisAmigosMap || {})[key] || {};
      var nombre = datos.nombre_completo || '';
      var ciudad = datos.ciudad || '';
      var friendCode = datos.friend_code || '';

      // Avatar: 1) identidad del amigo (backend), 2) respaldo cache SheetDB.
      var _avOk = function(s){ return /^avatar[-_][a-z0-9-]+$/i.test(String(s||'').trim()); };
      var avatarId = (datos && _avOk(datos.avatar)) ? String(datos.avatar).trim() : '';
      if(!avatarId){
        var urbisAv = window.urbisAvatares || [];
        for (var ai = 0; ai < urbisAv.length; ai++) {
          if (String(urbisAv[ai].lng || '').toLowerCase() === key) { var _d = String(urbisAv[ai].descripcion || '').trim(); if(_avOk(_d)) avatarId = _d; break; }
        }
      }

      // Puntos del amigo (tabla de líderes global del backend)
      var puntos = 0;
      var urbisPunt = window.urbisLeaderboardData || [];
      for (var pi = 0; pi < urbisPunt.length; pi++) {
        if (String(urbisPunt[pi].usuario || '').toLowerCase() === key) { puntos = Number(urbisPunt[pi].puntos) || 0; break; }
      }

      // Reportes
      var gd = typeof globalData !== 'undefined' ? globalData : [];
      var totalReportes = 0;
      var repItems = '';
      var repList = [];
      for (var ri = 0; ri < gd.length; ri++) {
        var p = gd[ri];
        if (!p || !p.descripcion) continue;
        var tipo = String(p.tipo || '').toLowerCase();
        if (tipo.indexOf('relacion') >= 0 || tipo.indexOf('ubicacion') >= 0 || tipo.indexOf('puntaje') >= 0 || tipo.indexOf('comentario') >= 0) continue;
        var parts = String(p.descripcion || '').split(' | ');
        var matched = false;
        for (var pi2 = 0; pi2 < parts.length; pi2++) { if (parts[pi2].trim().toLowerCase() === key) { matched = true; break; } }
        if (matched) { totalReportes++; repList.push(p); }
      }
      var last3 = repList.slice(-3).reverse();
      for (var li = 0; li < last3.length; li++) {
        var rp = last3[li];
        var dp = String(rp.descripcion || '').split(' | ');
        var titulo = (dp[1] || dp[0] || 'Reporte').trim();
        var ico = String(rp.tipo || '').split(' ')[0] || '📍';
        repItems += '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;font-size:.8rem;color:#334;border-bottom:1px solid #f3f4f6;">' + ico + ' ' + titulo + '</div>';
      }

      // En línea
      var uLoc = null;
      try { uLoc = urbisUbicacionDe(usuario); } catch(e2) {}
      var enLinea = uLoc ? ((Date.now() - new Date(uLoc.fecha || 0).getTime()) < 5*60000) : false;

      // Quitar overlay anterior
      var oldOv = document.getElementById('urbis-perfil-amigo');
      if (oldOv && oldOv.parentNode) oldOv.parentNode.removeChild(oldOv);

      // === OVERLAY ===
      var ov = document.createElement('div');
      ov.id = 'urbis-perfil-amigo';
      ov.style.position = 'fixed';
      ov.style.top = '0'; ov.style.left = '0';
      ov.style.width = '100%'; ov.style.height = '100%';
      ov.style.background = 'rgba(15,23,42,0.55)';
      ov.style.zIndex = '2147483647';
      ov.style.display = 'flex';
      ov.style.alignItems = 'flex-end';
      ov.style.justifyContent = 'center';

      // === PANEL ===
      var panel = document.createElement('div');
      panel.style.background = '#fff';
      panel.style.width = '100%'; panel.style.maxWidth = '480px';
      panel.style.borderRadius = '24px 24px 0 0';
      panel.style.boxSizing = 'border-box';
      panel.style.maxHeight = '88vh'; panel.style.overflowY = 'auto';

      // Drag handle
      var handle = document.createElement('div');
      handle.style.width = '40px'; handle.style.height = '4px';
      handle.style.background = '#e2e8f0'; handle.style.borderRadius = '4px';
      handle.style.margin = '12px auto 0';
      panel.appendChild(handle);

      // === HEADER (gradiente + avatar centrado) ===
      var header = document.createElement('div');
      header.style.background = 'linear-gradient(160deg,#f0f4ff 0%,#fdf4ff 100%)';
      header.style.padding = '20px 20px 16px';
      header.style.display = 'flex';
      header.style.flexDirection = 'column';
      header.style.alignItems = 'center';
      header.style.textAlign = 'center';
      header.style.borderBottom = '1px solid #f0f4f8';

      // SVG silueta persona (placeholder neutro sin color azul)
      var PERSON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="#dde3ed"/><circle cx="48" cy="35" r="19" fill="#a0aec0"/><ellipse cx="48" cy="84" rx="30" ry="22" fill="#a0aec0"/></svg>';
      function setAv(wrap, avId) {
        wrap.innerHTML = '';
        if (avId) {
          var im = document.createElement('img');
          im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'cover';
          im.onerror = function() { wrap.innerHTML = PERSON_SVG; };
          im.src = 'assets/avatars/' + avId + '.png';
          wrap.appendChild(im);
        } else {
          wrap.innerHTML = PERSON_SVG;
        }
      }

      // Contenedor externo (el dot va aquí, no dentro de avWrap)
      var avContainer = document.createElement('div');
      avContainer.style.cssText = 'position:relative;margin-bottom:14px;';

      var avWrap = document.createElement('div');
      avWrap.id = 'urbis-av-' + key;
      avWrap.style.cssText = 'width:96px;height:96px;border-radius:50%;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.15);background:#fff;display:flex;align-items:center;justify-content:center;';
      setAv(avWrap, avatarId);
      avContainer.appendChild(avWrap);

      // Dot online (fuera de avWrap para no borrarse en async update)
      var dot = document.createElement('i');
      dot.style.cssText = 'position:absolute;right:2px;bottom:2px;width:18px;height:18px;border-radius:50%;border:3px solid #fff;background:' + (enLinea ? '#16a34a' : '#b6c0cf') + ';display:block;font-style:normal;';
      avContainer.appendChild(dot);

      header.appendChild(avContainer);

      // Nombre completo
      if (nombre) {
        var nomEl = document.createElement('div');
        nomEl.style.fontSize = '1.15rem'; nomEl.style.fontWeight = '800'; nomEl.style.color = '#1b2742'; nomEl.style.lineHeight = '1.25';
        nomEl.textContent = nombre;
        header.appendChild(nomEl);
      }

      // @usuario
      var userEl = document.createElement('div');
      userEl.style.fontSize = '.92rem'; userEl.style.fontWeight = '700'; userEl.style.color = '#00B68D'; userEl.style.marginTop = nombre ? '2px' : '0';
      userEl.textContent = '@' + usuario;
      header.appendChild(userEl);

      // Ciudad + estado
      var metaEl = document.createElement('div');
      metaEl.style.cssText = 'display:flex;gap:10px;margin-top:8px;justify-content:center;flex-wrap:wrap;color:#000;font-weight:700;font-size:.85rem;';
      metaEl.innerHTML =
        (ciudad ? '<b style="color:#000!important;font-weight:700;font-size:.85rem;">📍 ' + ciudad + '</b>' : '') +
        '<b style="color:' + (enLinea ? '#15803d' : '#111') + '!important;font-weight:700;font-size:.85rem;">' +
        (enLinea ? '🟢 En línea' : '⚪ Desconectado') + '</b>';
      header.appendChild(metaEl);

      // Botón "Enviar mensaje" (chat 1-a-1 estilo Facebook), debajo del nombre/usuario.
      var msgBtn = document.createElement('button');
      msgBtn.type = 'button';
      msgBtn.style.cssText = 'margin-top:14px;display:inline-flex;align-items:center;gap:8px;padding:11px 24px;border-radius:999px;border:none;background:#00B68D;color:#fff;font-size:.92rem;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(0,182,141,.35);';
      msgBtn.innerHTML = '💬 Enviar mensaje';
      msgBtn.onclick = function(){ var ov0 = document.getElementById('urbis-perfil-amigo'); if(ov0 && ov0.parentNode) ov0.parentNode.removeChild(ov0); if(typeof window.urbisAbrirChat === 'function') window.urbisAbrirChat(usuario, nombre || ('@'+usuario)); };
      header.appendChild(msgBtn);

      panel.appendChild(header);

      // === BODY ===
      var body = document.createElement('div');
      body.style.padding = '16px 20px 0';

      // ID URBIS
      if (friendCode) {
        var idCard = document.createElement('div');
        idCard.style.background = '#f0f9ff'; idCard.style.borderRadius = '14px';
        idCard.style.padding = '12px 16px'; idCard.style.marginBottom = '12px';
        idCard.style.display = 'flex'; idCard.style.alignItems = 'center'; idCard.style.gap = '10px';
        idCard.innerHTML =
          '<div style="font-size:1.4rem;">🆔</div>' +
          '<div>' +
            '<div style="font-size:.7rem;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.05em;">ID URBIS</div>' +
            '<div style="font-size:1.1rem;font-weight:900;color:#1b2742;letter-spacing:.08em;">' + friendCode + '</div>' +
          '</div>';
        body.appendChild(idCard);
      }

      // Stats
      var stats = document.createElement('div');
      stats.style.display = 'flex'; stats.style.gap = '8px'; stats.style.marginBottom = '12px';
      stats.innerHTML =
        '<div style="flex:1;background:#f0fdf8;border-radius:14px;padding:12px 8px;text-align:center;">' +
          '<div style="font-size:1.5rem;font-weight:900;color:#00875a;">' + puntos + '</div>' +
          '<div style="font-size:.74rem;color:#374151;margin-top:3px;font-weight:500;">Puntos<br>minijuegos</div>' +
        '</div>' +
        '<div style="flex:1;background:#f8fafc;border-radius:14px;padding:14px 8px;text-align:center;">' +
          '<div style="font-size:1.6rem;font-weight:900;color:#1e293b;">' + totalReportes + '</div>' +
          '<div style="font-size:.74rem;color:#374151;margin-top:3px;font-weight:500;">Reportes<br>realizados</div>' +
        '</div>';
      body.appendChild(stats);

      // Últimos reportes
      if (repItems) {
        var repSection = document.createElement('div');
        repSection.style.marginBottom = '12px';
        repSection.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Últimos reportes</div>' + repItems;
        body.appendChild(repSection);
      }

      // Botón cerrar
      var btnClose = document.createElement('button');
      btnClose.type = 'button'; btnClose.textContent = 'Cerrar';
      btnClose.style.display = 'block'; btnClose.style.width = '100%';
      btnClose.style.padding = '13px'; btnClose.style.border = 'none';
      btnClose.style.borderRadius = '14px'; btnClose.style.background = '#f1f5f9';
      btnClose.style.color = '#334155'; btnClose.style.fontSize = '.92rem';
      btnClose.style.fontWeight = '700'; btnClose.style.cursor = 'pointer';
      btnClose.style.boxSizing = 'border-box'; btnClose.style.marginTop = '4px';
      btnClose.style.marginBottom = '8px';
      body.appendChild(btnClose);

      panel.appendChild(body);
      ov.appendChild(panel);
      document.body.appendChild(ov);

      var cerrar = function() {
        var el = document.getElementById('urbis-perfil-amigo');
        if (el && el.parentNode) el.parentNode.removeChild(el);
      };
      btnClose.onclick = cerrar;
      ov.onclick = function(ev) { if (ev.target === ov) cerrar(); };

      // El avatar del amigo viene de la identidad del backend (social_get_friends/profile);
      // ya NO se consulta SheetDB. Si no estaba en caché, queda la silueta por defecto.

    } catch(err) {
      console.error('urbisVerPerfilAmigo:', err);
    }
  };
  window.urbisPromoverFamilia = function(usuario){
    if(typeof window.urbisAgregarContacto === 'function'){
      window.urbisAgregarContacto(usuario, 'familia', function(){ try{ window.urbisRenderContactos('familia'); }catch(e){} });
    }
  };
  window.urbisVerContactoEnMapa = function(usuario){
    const u = urbisUbicacionDe(usuario); if(!u){ alert('Ese contacto no ha compartido ubicación.'); return; }
    try{ if(window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') window.UrbisMobileAppV58.show('map'); }catch(e){}
    setTimeout(()=>{ try{
      if(!_urbisContactosLayer) _urbisContactosLayer = L.layerGroup().addTo(map); else _urbisContactosLayer.clearLayers();
      const la = parseFloat(u.lat), ln = parseFloat(u.lng);
      const activo = (Date.now() - new Date(u.fecha||0).getTime()) < 5*60000;
      L.circleMarker([la, ln], { radius:13, color:'#fff', weight:3, fillColor: activo?'#16a34a':'#9aa6b8', fillOpacity:.95 }).addTo(_urbisContactosLayer)
        .bindPopup(`<b>@${usuario}</b><br>${activo ? '🟢 En línea' : '⚪ ' + _haceCuanto(u.fecha)}`).openPopup();
      map.setView([la, ln], 16);
    }catch(e){} }, 250);
  };

  // ── Pestaña "En línea": todos los contactos aceptados ordenados por estado ──
  window.urbisRenderContactosOnline = function(){
    const cont = document.getElementById('u52-contactos-lista');
    if(!cont) return;
    const yo = window.urbisUsuarioActual ? window.urbisUsuarioActual() : '';
    if(!yo){
      cont.innerHTML = `<div class="ct-empty">🟢<span>Inicia sesión para ver el estado de tus contactos.</span></div>`;
      return;
    }
    // Reunir TODOS los contactos únicos (todos los tipos).
    const todos = urbisMisContactos('todos');
    if(!todos.length){
      cont.innerHTML = `<div class="ct-empty">🟢<span>Aún no tienes contactos. Agrégalos con su usuario o ID URBIS.</span></div>`;
      return;
    }
    const ahora = Date.now();
    const filaOnline = (c) => {
      const u = urbisUbicacionDe(c);
      const ms = u ? (ahora - new Date(u.fecha||0).getTime()) : Infinity;
      const activo = ms < 5*60000;
      const reciente = ms < 60*60000;
      const inicial = (String(c)[0]||'?').toUpperCase();
      const estado = !u ? 'Sin ubicación compartida' : (activo ? 'En línea ahora' : _haceCuanto(u.fecha));
      const dot = activo ? 'on' : (reciente ? 'recent' : 'off');
      return { activo, reciente, html: `<div class="ct-row" onclick="window.urbisVerContactoEnMapa && window.urbisVerContactoEnMapa('${c}')">
        <span class="ct-av" style="background:${_colorAvatar(c)}">${inicial}<i class="ct-dot ${dot}"></i></span>
        <span class="ct-meta"><b>@${c}</b><small>${estado}</small></span>
        <span class="ct-go">🗺️</span>
      </div>` };
    };
    const filas = todos.map(c => filaOnline(c)).sort((a,b) => (b.activo - a.activo) || (b.reciente - a.reciente));
    cont.innerHTML = filas.map(f => f.html).join('');
  };

  // ── Radar: pinta contactos en el mapa y comparte mi ubicación silenciosamente ──
  let _urbisRadarTimer = null;
  window.urbisIniciarRadarContactos = function(){
    _urbisActualizarRadar();
    if(_urbisRadarTimer) return; // ya corriendo
    _urbisRadarTimer = setInterval(_urbisActualizarRadar, 45000);
  };
  // Detiene el radar y limpia los marcadores de contactos (p. ej. en modo Runner,
  // para no compartir/mostrar ubicaciones mientras corres).
  window.urbisDetenerRadarContactos = function(){
    try{ if(_urbisRadarTimer){ clearInterval(_urbisRadarTimer); _urbisRadarTimer = null; } }catch(e){}
    try{ if(_urbisContactosLayer) _urbisContactosLayer.clearLayers(); }catch(e){}
  };
  function _urbisActualizarRadar(){
    // Compartir mi posición en silencio (PATCH, sin crear duplicados).
    try{ if(typeof window.urbisCompartirUbicacion === 'function') window.urbisCompartirUbicacion(true); }catch(e){}
    // Pintar UN marcador por contacto (el más reciente).
    try{
      if(typeof map === 'undefined') return;
      if(!_urbisContactosLayer) _urbisContactosLayer = L.layerGroup().addTo(map);
      else _urbisContactosLayer.clearLayers();
      const ahora = Date.now();
      const mejores = {};
      (window.urbisUbicaciones || []).forEach(u => {
        const key = String(u.descripcion || '').trim().toLowerCase();
        if(!key) return;
        if(!mejores[key] || new Date(u.fecha||0) > new Date(mejores[key].fecha||0)) mejores[key] = u;
      });
      Object.values(mejores).forEach(u => {
        const usuario = String(u.descripcion || '').trim();
        const yo = window.urbisUsuarioActual ? window.urbisUsuarioActual() : '';
        if(!usuario || usuario.toLowerCase() === yo.toLowerCase()) return;
        const la = parseFloat(u.lat), ln = parseFloat(u.lng);
        if(!la || !ln) return;
        const activo = (ahora - new Date(u.fecha||0).getTime()) < 5*60000;
        const color = activo ? '#16a34a' : '#9aa6b8';
        const inicial = (usuario[0]||'?').toUpperCase();
        const icon = L.divIcon({
          className: '',
          html: `<div class="urbis-contact-dot" style="background:${color}">${inicial}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14]
        });
        L.marker([la, ln], { icon, zIndexOffset: 500 }).addTo(_urbisContactosLayer)
          .bindPopup(`<b>@${usuario}</b><br>${activo ? '🟢 En línea' : '⚪ ' + _haceCuanto(u.fecha)}`);
      });
    }catch(e){}
  }

  // ════════════════════════════════════════════════════════════════════════
  // URBIS ARCADE — Tabla de líderes GLOBAL en el backend Apps Script (hoja
  // puntajes_urbis), NO SheetDB. Muestra a TODOS los jugadores (amigos o no).
  // Preparada para varios minijuegos a futuro vía el campo 'juego'.
  // ════════════════════════════════════════════════════════════════════════
  window.urbisLeaderboardData = window.urbisLeaderboardData || []; // [{usuario,puntos}] del backend
  // id de la tabla del minijuego actual. Se cambió 'arcade'→'reflejos1' para ARRANCAR LIMPIO:
  // la tabla vieja guardaba puntajes SUMADOS (bug). La nueva guarda el MEJOR puntaje por partida.
  const URBIS_JUEGO_ACTUAL = 'reflejos1';
  function _juegoAPI(payload){
    if(window.URBIS_AUTH && typeof window.URBIS_AUTH.socialAPI === 'function') return window.URBIS_AUTH.socialAPI(payload);
    return Promise.reject(new Error('Auth no disponible'));
  }
  function _escJuego(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  // El puntaje que cuenta es el MEJOR de una sola partida (no la suma de partidas).
  function urbisPuntosLocales(){ return parseInt(localStorage.getItem('urbis_game_tap_best')||'0',10) || 0; }
  function urbisLeaderboard(){
    const m = {};
    (window.urbisLeaderboardData||[]).forEach(p => {
      const usuario = String((p && p.usuario) || '').trim();
      const pts = parseInt((p && p.puntos), 10) || 0;
      if(usuario && (!(usuario in m) || pts > m[usuario])) m[usuario] = pts;
    });
    // Incluir mi puntaje local aunque aún no esté en la nube, para verme siempre.
    const yo = window.urbisUsuarioActual ? window.urbisUsuarioActual() : '';
    const local = urbisPuntosLocales();
    if(yo && local > (m[yo] || 0)) m[yo] = local;
    return Object.keys(m).map(u => ({ usuario:u, puntos:m[u] })).sort((a,b) => b.puntos - a.puntos);
  }
  window.urbisGuardarPuntaje = function(score, juegoId){
    score = parseInt(score,10) || 0;
    juegoId = juegoId || URBIS_JUEGO_ACTUAL;
    const esLibre = (juegoId === URBIS_JUEGO_ACTUAL);
    // NO se suman las partidas: la tabla guarda el MEJOR puntaje de una sola partida.
    // El juego PREMIUM (Áurea) usa su propia tabla/llave; NO toca la del juego libre.
    const lkey = esLibre ? 'urbis_game_tap_best' : ('urbis_best_' + juegoId);
    const prevBest = parseInt(localStorage.getItem(lkey)||'0',10) || 0;
    const best = Math.max(prevBest, score);
    try{ localStorage.setItem(lkey, String(best)); }catch(e){}
    const usuario = window.urbisUsuarioActual ? window.urbisUsuarioActual() : '';
    if(usuario){
      // Backend (Apps Script, puntajes_urbis): envía el MEJOR; el backend ya hace Math.max.
      _juegoAPI({ action:'set_puntaje', usuario:usuario, juego:juegoId, puntos:best })
        .then(()=>{ try{ if(esLibre && typeof window.urbisRenderGamesHub === 'function' && document.getElementById('u52-games-content')) window.urbisRenderGamesHub(); }catch(e){} })
        .catch(()=>{});
      // Solo el juego LIBRE refleja en la tabla local del arcade (la premium se trae aparte).
      if(esLibre){
        window.urbisLeaderboardData = window.urbisLeaderboardData || [];
        const idx = window.urbisLeaderboardData.findIndex(p => String(p.usuario||'').toLowerCase() === usuario.toLowerCase());
        if(idx >= 0){ if(best > (parseInt(window.urbisLeaderboardData[idx].puntos,10)||0)) window.urbisLeaderboardData[idx].puntos = best; }
        else window.urbisLeaderboardData.push({ usuario:usuario, puntos:best });
      }
    }
    if(esLibre){ try{ if(typeof window.urbisRenderGamesHub === 'function' && document.getElementById('u52-games-content')) window.urbisRenderGamesHub(); }catch(e){} }
    return best;
  };
  let _urbisArcadePoll = null;
  let _urbisArcadeSig = '';
  function _arcadeVisible(){ try{ const s = document.querySelector('[data-u52-screen="games"]'); return !!(s && s.classList.contains('active')); }catch(e){ return false; } }
  // Trae la tabla de líderes GLOBAL del backend (todos los jugadores) y ejecuta cb.
  window.urbisRefrescarPuntajes = function(cb){
    _juegoAPI({ action:'leaderboard', juego:URBIS_JUEGO_ACTUAL, limit:100 })
      .then(out => { if(out && out.ok && Array.isArray(out.tabla)) window.urbisLeaderboardData = out.tabla; })
      .catch(()=>{})
      .then(()=>{ if(typeof cb === 'function') cb(); });
  };
  // Sube mi puntaje local al backend al abrir el arcade (si falta o creció). Auto-migración.
  function urbisSyncMiPuntaje(){
    try{
      const yo = window.urbisUsuarioActual ? window.urbisUsuarioActual() : '';
      if(!yo) return;
      const local = urbisPuntosLocales();
      if(local <= 0) return;
      let cloud = 0;
      (window.urbisLeaderboardData||[]).forEach(p => { if(String(p.usuario||'').toLowerCase() === yo.toLowerCase()){ const v = parseInt(p.puntos,10)||0; if(v>cloud) cloud=v; } });
      if(local <= cloud) return;
      _juegoAPI({ action:'set_puntaje', usuario:yo, juego:URBIS_JUEGO_ACTUAL, puntos:local }).catch(()=>{});
    }catch(e){}
  }
  function _pintarArcade(cont){
    const total = urbisPuntosLocales();
    const best = parseInt(localStorage.getItem('urbis_game_tap_best')||'0',10) || 0;
    const yo = (window.urbisUsuarioActual ? window.urbisUsuarioActual() : '').toLowerCase();
    const lb = urbisLeaderboard().slice(0,50);
    const miPos = lb.findIndex(r => r.usuario.toLowerCase() === yo) + 1;
    _urbisArcadeSig = JSON.stringify(lb);
    cont.innerHTML = `
      <div class="ug-hero">
        <div class="ug-points"><span>${total}</span><small>TU RÉCORD</small></div>
        <p class="ug-tag">🏆 Solo cuenta tu <b>mejor partida</b>. Los mejores récords ganarán <b>premios reales</b>.</p>
      </div>
      <div class="ug-games">
        <button class="ug-card ug-card-live" onclick="window.urbisJuegoTap && window.urbisJuegoTap()">
          <span class="ug-ico">⚡</span>
          <div class="ug-card-txt"><b>Reflejos Urbanos</b><small>Toca los rayos lo más rápido posible · 30s</small></div>
          <span class="ug-best">Récord ${best}</span>
          <span class="ug-play-hint">▶ JUGAR</span>
        </button>
        <div class="ug-card ug-soon"><span class="ug-ico">🧩</span><div class="ug-card-txt"><b>Más juegos pronto</b><small>Memoria, trivia urbana y más</small></div></div>
      </div>
      <div class="ug-board">
        <b class="ug-board-title">🏆 Tabla de líderes</b>
        ${miPos ? `<div class="ug-mypos">Tu posición: <b>#${miPos}</b> de ${lb.length}</div>` : ''}
        <div class="ug-table">
          <div class="ug-thead"><span class="ug-th ug-th-pos">#</span><span class="ug-th ug-th-user">Usuario</span><span class="ug-th ug-th-pts">Puntos</span></div>
          ${lb.length ? lb.map((r,i) => `<div class="ug-row ${r.usuario.toLowerCase()===yo?'me':''}"><span class="ug-pos ug-pos-${i+1}">${i+1}</span><span class="ug-user">@${_escJuego(r.usuario)}</span><span class="ug-pts">${r.puntos}</span></div>`).join('') : '<div class="ug-empty">Aún no hay puntajes. ¡Sé el primero en jugar!</div>'}
        </div>
      </div>`;
  }
  window.urbisRenderGamesHub = function(){
    const cont = document.getElementById('u52-games-content');
    if(!cont) return;
    _pintarArcade(cont); // pinta YA con lo que haya en memoria
    // Trae puntajes frescos de la nube, sube mi puntaje local si falta, y re-pinta.
    window.urbisRefrescarPuntajes(()=>{ urbisSyncMiPuntaje(); const c = document.getElementById('u52-games-content'); if(c) _pintarArcade(c); });
    // Auto-actualiza la tabla mientras el arcade esté abierto (cada 15s, sin recargar).
    if(_urbisArcadePoll){ clearInterval(_urbisArcadePoll); _urbisArcadePoll = null; }
    _urbisArcadePoll = setInterval(()=>{
      if(!_arcadeVisible()){ clearInterval(_urbisArcadePoll); _urbisArcadePoll = null; return; }
      window.urbisRefrescarPuntajes(()=>{
        if(!_arcadeVisible()) return;
        const ahora = JSON.stringify(urbisLeaderboard().slice(0,50));
        if(ahora !== _urbisArcadeSig){ const c = document.getElementById('u52-games-content'); if(c) _pintarArcade(c); }
      });
    }, 15000);
  };
  // Sonido "moneda" generado con Web Audio (sin assets): blip brillante ascendente.
  function _urbisSonidoMoneda(){
    try{
      const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
      if(!window._urbisGameAC) window._urbisGameAC = new AC();
      const ac = window._urbisGameAC; if(ac.state === 'suspended') ac.resume();
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(720, t);
      o.frequency.exponentialRampToValueAtTime(1480, t + 0.07);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.2);
    }catch(e){}
  }
  window.urbisJuegoTap = function(juegoId, opts){
    opts = opts || {};
    const premium = !!opts.premium;
    const titulo = opts.titulo || 'Juegos URBIS';
    let score = 0, tiempo = 30, intervalo = null, jugando = true;
    const ov = document.createElement('div');
    ov.id = 'urbis-game-tap'; ov.className = 'gt-enter' + (premium ? ' gt-premium' : '');
    ov.innerHTML = `
      <div class="gt-top">${premium ? '<span class="gt-premium-tag">✨ JUEGOS URBIS · POR DINERO</span>' : ''}<span class="gt-score">⚡ 0</span><span class="gt-time">⏱️ 30</span><button class="gt-close" aria-label="Salir">×</button></div>
      <div class="gt-arena"></div>
      <div class="gt-msg">${premium ? '🏆 <b>'+_escJuego(titulo)+'</b> · ¡toca los rayos, el #1 gana el premio!' : '¡Toca los rayos lo más rápido que puedas! ⚡'}</div>`;
    document.body.appendChild(ov);
    setTimeout(()=>{ try{ ov.classList.remove('gt-enter'); }catch(e){} }, 360); // animación de ingreso
    const scoreEl = ov.querySelector('.gt-score'), timeEl = ov.querySelector('.gt-time');
    const arena = ov.querySelector('.gt-arena');
    const cerrar = () => { jugando = false; if(intervalo) clearInterval(intervalo); try{ ov.remove(); }catch(e){} };
    ov.querySelector('.gt-close').onclick = cerrar;
    // "despierta" el audio con el primer toque (requisito de móviles)
    try{ if(window._urbisGameAC && window._urbisGameAC.state === 'suspended') window._urbisGameAC.resume(); }catch(e){}

    const COIN = 78; // tamaño de la moneda (toda el área es tocable → tolera toques a un lado)
    function nuevaPos(){
      const w = Math.max(8, arena.clientWidth - COIN - 8), h = Math.max(8, arena.clientHeight - COIN - 8);
      return { x: 4 + Math.floor(Math.random()*w), y: 4 + Math.floor(Math.random()*h) };
    }
    function vivas(){ return arena.querySelectorAll('.gt-coin:not(.gt-pop)').length; }
    // FLUJO CONTINUO: siempre debe haber 'objetivo' monedas vivas (varía 1-3). En cuanto recoges
    // una, otra aparece YA en posición aleatoria — sin pausas ni esperar a que se vacíen todas.
    let objetivo = 3;
    function reponer(){ let g = 0; while(jugando && vivas() < objetivo && g++ < 6) crearCoin(); }
    function golpe(coin){
      if(!jugando || coin._done) return;
      coin._done = true;
      score++; scoreEl.textContent = '⚡ ' + score;
      _urbisSonidoMoneda();
      coin.classList.add('gt-pop');                       // estalla (visual)
      setTimeout(()=>{ try{ coin.remove(); }catch(e){} }, 200);
      // Repone de INMEDIATO (no espera la animación de salida): la moneda recogida ya no cuenta
      // en vivas() porque es .gt-pop, así que crearCoin() la reemplaza al instante.
      if(Math.random() < 0.22) objetivo = 1 + Math.floor(Math.random()*3); // a ratos cambia (1-3)
      reponer();
    }
    function crearCoin(){
      const c = document.createElement('button');
      c.className = 'gt-coin'; c.type = 'button';
      c.innerHTML = '<span class="gt-ring"></span><span class="gt-ring r2"></span><b class="gt-bolt">⚡</b>';
      const p = nuevaPos(); c.style.left = p.x + 'px'; c.style.top = p.y + 'px';
      // Toque INSTANTÁNEO: pointerdown/touchstart (sin esperar el click ~300ms) y todo el
      // círculo es área tocable; _done evita doble conteo si disparan ambos eventos.
      const fn = (e) => { if(e){ e.preventDefault(); e.stopPropagation(); } golpe(c); };
      c.addEventListener('pointerdown', fn, { passive:false });
      c.addEventListener('touchstart', fn, { passive:false });
      c.addEventListener('mousedown', fn);
      arena.appendChild(c);
    }
    // Arranque: aparecen 1-3 monedas y a partir de ahí el flujo se mantiene solo.
    objetivo = 1 + Math.floor(Math.random()*3);
    setTimeout(reponer, 80);
    intervalo = setInterval(() => {
      tiempo--; timeEl.textContent = '⏱️ ' + tiempo;
      if(tiempo <= 8) timeEl.classList.add('gt-time-low');
      if(tiempo <= 0){
        clearInterval(intervalo); jugando = false;
        const best = window.urbisGuardarPuntaje ? window.urbisGuardarPuntaje(score, juegoId) : score;
        if(premium){
          arena.innerHTML = `<div class="gt-result">
            <div class="gt-premium-badge">✨ ${_escJuego(titulo)}</div>
            <span class="gt-result-score">${score}</span><small>puntos en esta partida</small>
            <div class="gt-total">Tu mejor en el evento: <b>${best}</b></div>
            <div class="gt-aurea-board" id="gt-aurea-board">⏳ Cargando tabla del evento…</div>
            <div class="gt-result-btns"><button class="gt-again">🔄 Otra vez</button><button class="gt-exit">✕ Salir</button></div></div>`;
          _juegoAPI({ action:'leaderboard', juego:juegoId, limit:20 })
            .then(out => { const tabla = (out && out.ok && Array.isArray(out.tabla)) ? out.tabla : []; const el = arena.querySelector('#gt-aurea-board'); if(el) el.innerHTML = _aureaBoardHTML(tabla); })
            .catch(()=>{ const el = arena.querySelector('#gt-aurea-board'); if(el) el.textContent = 'No se pudo cargar la tabla del evento.'; });
        } else {
          arena.innerHTML = `<div class="gt-result"><span class="gt-result-score">${score}</span><small>puntos en esta partida</small><div class="gt-total">Tu récord: <b>${best}</b></div><div class="gt-result-btns"><button class="gt-again">🔄 Otra vez</button><button class="gt-exit">🏆 Ver arcade</button></div></div>`;
        }
        arena.querySelector('.gt-again').onclick = () => { cerrar(); window.urbisJuegoTap(juegoId, opts); };
        arena.querySelector('.gt-exit').onclick  = () => { cerrar(); if(!premium && window.urbisRenderGamesHub) window.urbisRenderGamesHub(); if(premium && typeof window.urbisAureaMenuRefrescar === 'function') window.urbisAureaMenuRefrescar(); };
      }
    }, 1000);
  };

  // ════════════════════════════════════════════════════════════════════════
  // JUEGO PREMIUM "Juegos URBIS": MISMO juego, pero TABLA SEPARADA por evento (no toca
  // la del juego libre). Solo se entra desde la gota de agua del mapa. El #1 gana dinero.
  // ════════════════════════════════════════════════════════════════════════
  function _aureaBoardHTML(tabla){
    const yo = (window.urbisUsuarioActual ? window.urbisUsuarioActual() : '').toLowerCase();
    if(!tabla || !tabla.length) return '<div class="gt-aurea-empty">Aún no hay puntajes. ¡Sé el primero del evento! 🏆</div>';
    return '<div class="gt-aurea-title">🏆 Ranking del evento</div>' + tabla.slice(0,20).map((r,i)=>{
      const mio = String(r.usuario||'').toLowerCase() === yo;
      return '<div class="gt-aurea-row'+(i===0?' top1':'')+(mio?' me':'')+'"><span class="gt-aurea-pos">'+(i+1)+'</span><span class="gt-aurea-user">@'+_escJuego(r.usuario)+'</span><span class="gt-aurea-pts">'+(parseInt(r.puntos,10)||0)+'</span></div>';
    }).join('');
  }
  // Entrar a JUGAR el evento de Juegos URBIS (premium). Solo se llama desde la gota de agua del mapa.
  window.urbisJugarAurea = function(juegoId, titulo){
    if(!juegoId){ alert('Evento no válido.'); return; }
    if(!(window.urbisUsuarioActual && window.urbisUsuarioActual())){ alert('Inicia sesión para competir por el premio del evento de Juegos URBIS.'); return; }
    window.urbisJuegoTap(juegoId, { premium:true, titulo: titulo || 'Juegos URBIS' });
  };
  // Ver el GANADOR / tabla del evento de Juegos URBIS (cuando ya terminó, o en cualquier momento).
  window.urbisVerGanadorAurea = function(juegoId, titulo){
    if(!juegoId) return;
    const ov = document.createElement('div'); ov.id = 'urbis-game-tap'; ov.className = 'gt-premium';
    ov.innerHTML = `<div class="gt-top"><span class="gt-premium-tag">✨ ${_escJuego(titulo||'Juegos URBIS')}</span><button class="gt-close" aria-label="Salir">×</button></div><div class="gt-arena"><div class="gt-result"><div class="gt-premium-badge">🏆 Resultado del evento</div><div class="gt-aurea-board" id="gt-aurea-board2">⏳ Cargando…</div></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('.gt-close').onclick = () => { try{ ov.remove(); }catch(e){} };
    _juegoAPI({ action:'leaderboard', juego:juegoId, limit:20 })
      .then(out => { const tabla = (out && out.ok && Array.isArray(out.tabla)) ? out.tabla : []; const el = ov.querySelector('#gt-aurea-board2'); if(!el) return; el.innerHTML = (tabla.length ? '<div class="gt-winner">🥇 Ganador: <b>@'+_escJuego(tabla[0].usuario)+'</b> · '+(parseInt(tabla[0].puntos,10)||0)+' pts</div>' : '') + _aureaBoardHTML(tabla); })
      .catch(()=>{ const el = ov.querySelector('#gt-aurea-board2'); if(el) el.textContent = 'No se pudo cargar la tabla.'; });
  };

  // ── MENÚ PREMIUM (tabla clasificatoria del evento de Juegos URBIS) ──────────────────
  // Pantalla intermedia entre la gota del mapa y el juego: podio top-3 (oro/plata/
  // bronce), lista de posiciones, fila fija con TU posición y botón "¡Jugar ahora!".
  // Incluye mi mejor local aunque la nube aún no lo tenga (para verme siempre).
  function _aureaTablaConYo(tabla, juegoId){
    const m = {};
    (Array.isArray(tabla) ? tabla : []).forEach(p => {
      const u = String((p && p.usuario) || '').trim();
      const pts = parseInt(p && p.puntos, 10) || 0;
      if(u && (!(u in m) || pts > m[u])) m[u] = pts;
    });
    const yo = window.urbisUsuarioActual ? window.urbisUsuarioActual() : '';
    let local = 0;
    try{ local = parseInt(localStorage.getItem('urbis_best_' + juegoId) || '0', 10) || 0; }catch(e){}
    if(yo && local > (m[yo] || 0)) m[yo] = local;
    return Object.keys(m).map(u => ({ usuario:u, puntos:m[u] })).sort((a,b) => b.puntos - a.puntos);
  }
  // Entrada al MÓDULO premium (pantalla propia, NO ventana flotante): un clon premium
  // del módulo de minijuegos, pero al que se entra desde la gota Áurea del mapa.
  // Guarda el contexto del evento y navega a la pantalla data-u52-screen="aurea".
  // ── Apertura inmersiva ───────────────────────────────────────────────────
  // La pantalla se abre expandiéndose DESDE el punto que se tocó (la gota del
  // mapa o el botón), no con un fundido genérico: así se entiende que esa gota
  // se convirtió en la pantalla, y no que apareció una ventana encima.
  window.__urbisAureaOrigen = null;
  document.addEventListener('pointerdown', function(ev){
    var t = ev.target && ev.target.closest && ev.target.closest('.cp-aurea, [data-u52-aurea-go], .urbis-aurea-marker');
    if(t) window.__urbisAureaOrigen = { x: ev.clientX, y: ev.clientY };
  }, true);

  window.urbisAnimarEntradaAurea = function(){
    var pant = document.querySelector('.u52-aurea-screen');
    if(!pant) return;
    var reduce = false;
    try{ reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
    if(reduce){ pant.style.clipPath = ''; return; }

    var o = window.__urbisAureaOrigen;
    window.__urbisAureaOrigen = null;
    var x = o ? o.x : window.innerWidth / 2;
    var y = o ? o.y : window.innerHeight / 2;
    // Radio necesario para cubrir la esquina más lejana desde el origen.
    var r = Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x),
                                 Math.max(y, window.innerHeight - y)) + 40);

    // Web Animations API y NO transición sobre estilos inline: la animación no
    // deja nada pegado en el elemento, así que si el navegador la interrumpe
    // (pestaña en segundo plano, rAF pausado) la pantalla queda en su estado
    // normal. Con transición + clipPath inline, una interrupción dejaba
    // `circle(0px)` fijo y la pantalla entera invisible.
    // El JS solo aporta el origen; la animación la declara el CSS
    // (@keyframes aureaAbrir, SIN fill-mode). Es deliberado: una animación CSS
    // que no llega a correr deja el elemento en su estado normal, mientras que
    // un clip-path escrito en el estilo inline se quedaba pegado en
    // `circle(0px)` —la pantalla entera invisible— si algo interrumpía la
    // transición. Aquí el peor caso es entrar sin animación.
    pant.style.setProperty('--ax', x + 'px');
    pant.style.setProperty('--ay', y + 'px');
    pant.style.setProperty('--ar', r + 'px');

    // Reinicia la animación en cada entrada (si no, solo se ve la primera vez)
    pant.classList.remove('aurea-entrando');
    void pant.offsetWidth;
    pant.classList.add('aurea-entrando');
  };

  window.urbisAbrirAureaModulo = function(juegoId, titulo, premio, fin, terminado){
    if(!juegoId){ alert('Evento no válido.'); return; }
    // Se cierra el popup del mapa antes de entrar: si queda abierto, al volver
    // aparece flotando sobre la interfaz.
    try{
      var m = window.urbisMap || window.map;
      if(m && typeof m.closePopup === 'function') m.closePopup();
    }catch(e){}
    window.__urbisAureaCtx = {
      juegoId: juegoId,
      titulo: titulo || 'Juegos URBIS',
      premio: premio || 'Premio sorpresa',
      fin: fin || '',
      terminado: !!terminado
    };
    window.__urbisAureaTabla = []; // se llena al traer la tabla de la nube
    try{
      if(window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function'){
        window.UrbisMobileAppV58.show('aurea');
        return;
      }
    }catch(e){}
    // Respaldo (si la app móvil no estuviera): render directo en el contenedor si existe.
    if(typeof window.urbisRenderAureaHub === 'function') window.urbisRenderAureaHub();
  };
  // Compatibilidad: el antiguo nombre ahora abre el módulo (ya no es overlay flotante).
  window.urbisMenuAurea = window.urbisAbrirAureaModulo;

  // Pinta el contenido del MÓDULO premium dentro de #u52-aurea-content:
  // héroe (premio + tu mejor), tarjeta de juego, podio top-3, lista y tu posición fija.
  function _pintarAureaHub(cont, ctx, tabla){
    const juegoId = ctx.juegoId, titulo = ctx.titulo, premio = ctx.premio, fin = ctx.fin, terminado = ctx.terminado;
    const yoLogin = (window.urbisUsuarioActual && window.urbisUsuarioActual()) || '';
    const yo = yoLogin.toLowerCase();
    const lista = _aureaTablaConYo(tabla, juegoId);
    const miPos = lista.findIndex(r => r.usuario.toLowerCase() === yo) + 1;
    const miPts = miPos ? lista[miPos-1].puntos : 0;
    let best = 0; try{ best = parseInt(localStorage.getItem('urbis_best_' + juegoId) || '0', 10) || 0; }catch(e){}
    const medallas = ['oro','plata','bronce'], emos = ['🥇','🥈','🥉'];
    let boardInner;
    if(!lista.length){
      boardInner = '<div class="ah-empty-board">Aún no hay jugadores.<br>¡Sé el primero del evento! 🏆</div>';
    } else {
      const podio = '<div class="am-podium">' + [1,0,2].map(slot => {
        const r = lista[slot];
        if(!r) return '<div class="am-pod am-pod-empty"><div class="am-pod-medal">'+emos[slot]+'</div><div class="am-pod-user">Libre</div></div>';
        const mio = r.usuario.toLowerCase() === yo;
        return '<div class="am-pod am-'+medallas[slot]+(mio?' me':'')+'"><div class="am-pod-medal">'+emos[slot]+'</div><div class="am-pod-user">@'+_escJuego(r.usuario)+'</div><div class="am-pod-pts">'+r.puntos+'<small>pts</small></div></div>';
      }).join('') + '</div>';
      const resto = lista.slice(3);
      const filas = resto.length ? '<div class="am-list">' + resto.map((r,i) => {
        const mio = r.usuario.toLowerCase() === yo;
        return '<div class="am-row'+(mio?' me':'')+'"><span class="am-pos">'+(i+4)+'</span><span class="am-user">@'+_escJuego(r.usuario)+'</span><span class="am-pts">'+r.puntos+'</span></div>';
      }).join('') + '</div>' : '';
      boardInner = podio + filas;
    }
    let miRow;
    if(!yoLogin) miRow = '<div class="am-me am-me-guest">Inicia sesión para competir por el premio.</div>';
    else if(miPos) miRow = '<div class="am-me"><span class="am-me-lbl">TU POSICIÓN</span><span class="am-me-pos">#'+miPos+'</span><span class="am-me-user">@'+_escJuego(yoLogin)+'</span><span class="am-me-pts">'+miPts+' pts</span></div>';
    else miRow = '<div class="am-me am-me-out"><span class="am-me-lbl">TU POSICIÓN</span><span>Aún no compites · ¡juega para entrar!</span></div>';
    let accion;
    if(terminado) accion = lista.length
      ? '<div class="am-winner">🥇 Ganador: <b>@'+_escJuego(lista[0].usuario)+'</b> · '+lista[0].puntos+' pts</div>'
      : '<div class="am-winner">Evento finalizado sin participantes.</div>';
    // Un solo punto de entrada al juego. Antes había dos botones que hacían lo
    // mismo —la tarjeta del medio y este— y competían entre sí; queda el de
    // abajo, que es el que cierra la pantalla, con la descripción del reto
    // encima para no perder esa información al quitar la tarjeta.
    else accion =
      '<div class="am-reto"><b>Reto de Reflejos · Juegos URBIS</b>' +
      '<small>Toca los rayos lo más rápido · 30 s · por dinero real</small></div>' +
      '<button class="am-play" id="ah-play"'+(yoLogin?'':' disabled')+'>⚡ ¡Jugar ahora!</button>';
    const gameCard = '';

    cont.innerHTML =
      '<div class="ah-hero">'+
        '<div class="ah-badge">✨ JUEGOS URBIS · PREMIUM</div>'+
        '<div class="ah-evtitle">'+_escJuego(titulo)+'</div>'+
        '<div class="ah-prize">🥇 El <b>#1</b> se lleva <b>'+_escJuego(premio)+'</b><span>dinero real</span></div>'+
        (fin ? '<div class="ah-end">'+(terminado?'🏁 Evento finalizado':'⏳ Termina')+': <b>'+_escJuego(fin)+'</b></div>' : '')+
        '<div class="ah-record"><span>'+best+'</span><small>TU MEJOR EN EL EVENTO</small></div>'+
      '</div>'+
      gameCard+
      '<div class="ah-board"><b class="ah-board-title">🏆 Top jugadores</b>'+boardInner+'</div>'+
      '<div class="ah-foot">'+miRow+accion+'</div>';

    const jugar = () => { if(window.urbisJugarAurea) window.urbisJugarAurea(juegoId, titulo); };
    const pc = cont.querySelector('#ah-play'); if(pc) pc.onclick = jugar;
  }
  // Render del MÓDULO premium (lo llama show('aurea') y el juego al salir).
  window.urbisRenderAureaHub = function(){
    const cont = document.getElementById('u52-aurea-content');
    if(!cont) return;
    const ctx = window.__urbisAureaCtx || {};
    if(!ctx.juegoId){
      cont.innerHTML = '<div class="ah-empty">✨ Abre un <b>Juegos URBIS</b> tocando el logo de URBIS en el mapa para competir aquí.</div>';
      return;
    }
    _pintarAureaHub(cont, ctx, window.__urbisAureaTabla || []); // pinta YA con lo que haya
    _juegoAPI({ action:'leaderboard', juego:ctx.juegoId, limit:50 })
      .then(out => {
        const tabla = (out && out.ok && Array.isArray(out.tabla)) ? out.tabla : [];
        window.__urbisAureaTabla = tabla;
        const c = document.getElementById('u52-aurea-content');
        if(c) _pintarAureaHub(c, window.__urbisAureaCtx || ctx, tabla);
      })
      .catch(()=>{});
  };
  // El juego premium, al salir, re-pinta el módulo con el ranking actualizado.
  window.urbisAureaMenuRefrescar = window.urbisRenderAureaHub;

  // ════════════════════════════════════════════════════════════════════════
  // CHAT 1-a-1 entre usuarios (estilo Facebook Messenger).
  // Backend: Google Apps Script (hoja "chat_urbis"), NO SheetDB — SheetDB tiene
  // tope de peticiones y un chat con sondeo lo agotaría. Apps Script escribe con
  // appendRow (sin el bug de columnas) y filtra la conversación en el servidor.
  // Mensaje: { de, para, texto, fecha }. Sondeo cada 5s mientras el chat está abierto.
  // ════════════════════════════════════════════════════════════════════════
  window.urbisChatCache = window.urbisChatCache || {};  // { otroLower: [msgs del servidor] }
  window.urbisChatPend  = window.urbisChatPend  || [];  // enviados aún no confirmados
  window.urbisChatInbox = window.urbisChatInbox || [];  // conversaciones (para badge/bandeja)
  let _chatPoll = null, _chatActivo = null;
  function _chatSan(u){ return String(u||'').toLowerCase().replace(/[^a-z0-9._-]/g,''); }
  function _chatEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _chatSig(m){ return String(m.de||'')+'|'+String(m.fecha||'')+'|'+String(m.texto||''); }
  function _chatAPI(payload){
    if(window.URBIS_AUTH && typeof window.URBIS_AUTH.socialAPI === 'function') return window.URBIS_AUTH.socialAPI(payload);
    return Promise.reject(new Error('Auth no disponible'));
  }

  // Mensajes de la conversación con "otro" (cache del servidor + pendientes locales).
  function urbisMensajesConv(otro){
    const k = String(otro||'').toLowerCase();
    const out = (window.urbisChatCache[k] || []).slice();
    const vistos = {}; out.forEach(m => vistos[_chatSig(m)] = 1);
    (window.urbisChatPend||[]).forEach(m => { if(String(m.para||'').toLowerCase() === k && !vistos[_chatSig(m)]) out.push(m); });
    out.sort((a,b)=> new Date(a.fecha||0) - new Date(b.fecha||0));
    return out;
  }

  // Trae la conversación con "otro" del servidor (Apps Script) y limpia pendientes confirmados.
  window.urbisFetchConv = function(otro, cb){
    const yo = window.urbisUsuarioActual ? window.urbisUsuarioActual() : '';
    if(!yo || !otro){ if(typeof cb==='function') cb(); return; }
    _chatAPI({ action:'chat_fetch', usuario:yo, otro:otro })
      .then(out => {
        if(out && out.ok && Array.isArray(out.mensajes)){
          const k = String(otro).toLowerCase();
          window.urbisChatCache[k] = out.mensajes;
          // Quitar de pendientes los que ya llegaron al servidor. Se emparejan por
          // remitente+texto (la fecha del cliente y la del servidor difieren), y cada
          // mensaje del servidor "consume" UN solo pendiente (respeta textos repetidos).
          const usados = {};
          window.urbisChatPend = (window.urbisChatPend||[]).filter(p => {
            if(String(p.para||'').toLowerCase() !== k) return true;
            const idx = out.mensajes.findIndex((s, i) => !usados[i]
              && String(s.de||'').toLowerCase() === String(p.de||'').toLowerCase()
              && String(s.texto||'') === String(p.texto||''));
            if(idx >= 0){ usados[idx] = 1; return false; }
            return true;
          });
        }
      })
      .catch(()=>{})
      .then(()=>{ if(typeof cb === 'function') cb(); });
  };

  // Enviar un mensaje a "destino".
  window.urbisEnviarMensaje = function(destino, texto, cb){
    const yo = urbisMiUsuario ? urbisMiUsuario() : (window.urbisUsuarioActual ? window.urbisUsuarioActual() : '');
    texto = String(texto||'').trim();
    if(!yo || !destino || !texto){ if(typeof cb==='function') cb(false); return; }
    if(texto.length > 900) texto = texto.slice(0,900);
    const msg = { de:String(yo), para:String(destino), texto:texto, fecha:new Date().toISOString() };
    (window.urbisChatPend = window.urbisChatPend||[]).push(msg); // optimista: se ve al instante
    if(typeof cb === 'function') cb(true);
    _chatAPI({ action:'chat_send', de:msg.de, para:msg.para, texto:msg.texto })
      .then(out => { if(out && out.ok && document.getElementById('urbis-chat-ov')) window.urbisFetchConv(destino, function(){ if(_chatActivo===destino){ var h=document.getElementById('urbis-chat-hilo'); if(h) _chatPintarHilo(h, destino); } }); })
      .catch(()=>{});
  };

  function _chatLastReadKey(otro){ const yo = window.urbisUsuarioActual ? window.urbisUsuarioActual() : ''; return 'urbis_chat_read_' + _chatSan(yo) + '_' + _chatSan(otro); }
  function _chatMarcarLeido(otro){ try{ localStorage.setItem(_chatLastReadKey(otro), new Date().toISOString()); }catch(e){} }
  function _chatNoLeidos(otro, ultimoDe, ultimoFecha){
    const yo = (window.urbisUsuarioActual ? window.urbisUsuarioActual() : '').toLowerCase();
    if(String(ultimoDe||'').toLowerCase() === yo) return 0; // el último mensaje lo envié yo
    let last = 0; try{ last = new Date(localStorage.getItem(_chatLastReadKey(otro))||0).getTime(); }catch(e){}
    return (new Date(ultimoFecha||0).getTime() > last) ? 1 : 0;
  }

  function _chatPintarHilo(cont, otro){
    const yo = (window.urbisUsuarioActual ? window.urbisUsuarioActual() : '').toLowerCase();
    const msgs = urbisMensajesConv(otro);
    if(!msgs.length){ cont.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:.86rem;padding:34px 16px;">💬 Aún no hay mensajes.<br>¡Escribe el primero!</div>'; return; }
    let prevDia = '', html = '';
    msgs.forEach(m => {
      const mio = String(m.de||'').toLowerCase() === yo;
      const dia = new Date(m.fecha||0).toLocaleDateString();
      if(dia !== prevDia){ prevDia = dia; html += '<div style="text-align:center;margin:10px 0;"><span style="background:#e2e8f0;color:#475569;font-size:.7rem;padding:3px 10px;border-radius:999px;">'+dia+'</span></div>'; }
      const hora = new Date(m.fecha||0).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      html += '<div style="display:flex;justify-content:'+(mio?'flex-end':'flex-start')+';margin:3px 0;">'+
        '<div style="max-width:78%;padding:8px 12px;border-radius:'+(mio?'16px 16px 4px 16px':'16px 16px 16px 4px')+';background:'+(mio?'#00B68D':'#fff')+';color:'+(mio?'#fff':'#1b2742')+';box-shadow:0 1px 4px rgba(0,0,0,.08);font-size:.9rem;line-height:1.35;word-break:break-word;">'+
          _chatEsc(m.texto)+'<div style="font-size:.62rem;opacity:.7;text-align:right;margin-top:2px;">'+hora+'</div></div></div>';
    });
    cont.innerHTML = html;
    cont.scrollTop = cont.scrollHeight;
  }

  // Abrir la ventana de chat con un usuario.
  window.urbisAbrirChat = function(usuario, nombre){
    const yo = urbisMiUsuario ? urbisMiUsuario() : (window.urbisUsuarioActual ? window.urbisUsuarioActual() : '');
    if(!yo){ alert('Inicia sesión para enviar mensajes.'); return; }
    usuario = String(usuario||'').trim();
    if(!usuario) return;
    if(usuario.toLowerCase() === String(yo).toLowerCase()){ alert('No puedes chatear contigo mismo 🙂'); return; }
    _chatActivo = usuario;
    var old = document.getElementById('urbis-chat-ov'); if(old && old.parentNode) old.parentNode.removeChild(old);
    var ov = document.createElement('div');
    ov.id = 'urbis-chat-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#eef2f7;display:flex;flex-direction:column;';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;padding:calc(14px + env(safe-area-inset-top,0px)) 14px 14px;background:linear-gradient(135deg,#00B68D,#0891b2);color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.12);flex-shrink:0;">'+
        '<button id="urbis-chat-back" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:1.2rem;cursor:pointer;flex-shrink:0;">←</button>'+
        '<div style="flex:1;min-width:0;"><div style="font-weight:800;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_chatEsc(nombre||('@'+usuario))+'</div><div style="font-size:.74rem;opacity:.85;">@'+_chatEsc(usuario)+'</div></div>'+
      '</div>'+
      '<div id="urbis-chat-hilo" style="flex:1;overflow-y:auto;padding:12px 12px 6px;-webkit-overflow-scrolling:touch;"></div>'+
      '<div style="display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#fff;box-shadow:0 -2px 10px rgba(0,0,0,.06);flex-shrink:0;align-items:flex-end;">'+
        '<textarea id="urbis-chat-input" rows="1" placeholder="Escribe un mensaje..." style="flex:1;resize:none;max-height:96px;border:1.5px solid #e2e8f0;border-radius:18px;padding:9px 14px;font-size:.92rem;font-family:inherit;outline:none;box-sizing:border-box;"></textarea>'+
        '<button id="urbis-chat-send" style="background:#00B68D;border:none;color:#fff;width:44px;height:44px;border-radius:50%;font-size:1.2rem;cursor:pointer;flex-shrink:0;box-shadow:0 2px 8px rgba(0,182,141,.4);">➤</button>'+
      '</div>';
    document.body.appendChild(ov);
    var hilo = ov.querySelector('#urbis-chat-hilo');
    var input = ov.querySelector('#urbis-chat-input');
    var sendBtn = ov.querySelector('#urbis-chat-send');
    function cerrar(){ if(_chatPoll){ clearInterval(_chatPoll); _chatPoll=null; } _chatActivo=null; _chatMarcarLeido(usuario); try{ ov.remove(); }catch(e){} try{ if(typeof window.urbisActualizarBadgeChat==='function') window.urbisActualizarBadgeChat(); }catch(e){} }
    ov.querySelector('#urbis-chat-back').onclick = cerrar;
    function repintar(){ _chatPintarHilo(hilo, usuario); _chatMarcarLeido(usuario); }
    repintar();
    window.urbisFetchConv(usuario, repintar);
    function enviar(){ var t = input.value.trim(); if(!t) return; input.value=''; input.style.height='auto'; window.urbisEnviarMensaje(usuario, t, repintar); }
    sendBtn.onclick = enviar;
    input.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); enviar(); } });
    input.addEventListener('input', function(){ input.style.height='auto'; input.style.height=Math.min(96, input.scrollHeight)+'px'; });
    if(_chatPoll){ clearInterval(_chatPoll); }
    _chatPoll = setInterval(function(){
      if(!document.getElementById('urbis-chat-ov')){ clearInterval(_chatPoll); _chatPoll=null; return; }
      window.urbisFetchConv(usuario, function(){ if(_chatActivo === usuario) repintar(); });
    }, 5000);
  };

  // Bandeja de conversaciones (inbox).
  window.urbisAbrirBandejaChats = function(){
    const yo = (window.urbisUsuarioActual ? window.urbisUsuarioActual() : '');
    if(!yo){ alert('Inicia sesión para ver tus mensajes.'); return; }
    var old = document.getElementById('urbis-inbox-ov'); if(old && old.parentNode) old.parentNode.removeChild(old);
    var ov = document.createElement('div');
    ov.id = 'urbis-inbox-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#eef2f7;display:flex;flex-direction:column;';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;padding:calc(14px + env(safe-area-inset-top,0px)) 14px 14px;background:linear-gradient(135deg,#00B68D,#0891b2);color:#fff;flex-shrink:0;box-shadow:0 2px 10px rgba(0,0,0,.12);">'+
        '<button id="urbis-inbox-back" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:1.2rem;cursor:pointer;">←</button>'+
        '<div style="font-weight:800;font-size:1.1rem;">💬 Mensajes</div>'+
      '</div>'+
      '<div id="urbis-inbox-list" style="flex:1;overflow-y:auto;padding:8px;"><div style="text-align:center;color:#94a3b8;padding:30px;font-size:.9rem;">Cargando…</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#urbis-inbox-back').onclick = function(){ try{ ov.remove(); }catch(e){} try{ if(typeof window.urbisActualizarBadgeChat==='function') window.urbisActualizarBadgeChat(); }catch(e){} };
    var list = ov.querySelector('#urbis-inbox-list');
    function pintar(){
      const convs = (window.urbisChatInbox||[]).slice().sort(function(a,b){ return new Date(b.fecha||0)-new Date(a.fecha||0); });
      if(!convs.length){ list.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:44px 16px;font-size:.9rem;">📭 No tienes conversaciones aún.<br>Abre el perfil de un amigo y toca "Enviar mensaje".</div>'; return; }
      const yo = (window.urbisUsuarioActual ? window.urbisUsuarioActual() : '').toLowerCase();
      list.innerHTML = convs.map(function(c){
        const nl = _chatNoLeidos(c.otro, c.de, c.fecha) > 0;
        const mio = String(c.de||'').toLowerCase() === yo;
        return '<div onclick="window.urbisAbrirChat(\''+_chatSan(c.otro)+'\',\''+_chatEsc(c.otro)+'\')" style="display:flex;align-items:center;gap:12px;padding:13px 14px;background:#fff;border-radius:14px;margin-bottom:8px;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.05);">'+
          '<div style="width:46px;height:46px;border-radius:50%;background:#00B68D;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;flex-shrink:0;">'+(String(c.otro)[0]||'?').toUpperCase()+'</div>'+
          '<div style="flex:1;min-width:0;"><div style="font-weight:'+(nl?'800':'700')+';color:#1b2742;">@'+_chatEsc(c.otro)+'</div><div style="font-size:.82rem;color:'+(nl?'#0f172a':'#94a3b8')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:'+(nl?'700':'400')+';">'+(mio?'Tú: ':'')+_chatEsc(c.ultimo)+'</div></div>'+
          (nl?'<span style="background:#ef4444;color:#fff;font-size:.7rem;font-weight:800;min-width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;padding:0 6px;">●</span>':'')+
        '</div>';
      }).join('');
    }
    pintar();
    window.urbisRefrescarInbox(function(){ pintar(); window.urbisActualizarBadgeChat(); });
  };

  // Trae la lista de conversaciones del servidor.
  window.urbisRefrescarInbox = function(cb){
    const yo = window.urbisUsuarioActual ? window.urbisUsuarioActual() : '';
    if(!yo){ if(typeof cb==='function') cb(); return; }
    _chatAPI({ action:'chat_inbox', usuario:yo })
      .then(out => { if(out && out.ok && Array.isArray(out.conversaciones)) window.urbisChatInbox = out.conversaciones; })
      .catch(()=>{})
      .then(()=>{ if(typeof cb === 'function') cb(); });
  };

  window.urbisChatTotalNoLeidos = function(){
    try{ return (window.urbisChatInbox||[]).reduce(function(s,c){ return s + _chatNoLeidos(c.otro, c.de, c.fecha); }, 0); }catch(e){ return 0; }
  };
  window.urbisActualizarBadgeChat = function(){
    try{
      const n = window.urbisChatTotalNoLeidos();
      document.querySelectorAll('[data-urbis-chat-badge]').forEach(function(el){
        if(n>0){ el.textContent = n>9?'9+':String(n); el.hidden=false; el.style.display='flex'; } else { el.hidden=true; el.style.display='none'; }
      });
    }catch(e){}
  };

  // Sondeo del inbox/badge solo en contexto (social abierto o bandeja abierta),
  // para no gastar cuota del Apps Script fuera de lugar.
  setInterval(function(){
    try{
      if(document.hidden) return;
      if(document.getElementById('urbis-chat-ov')) return; // el chat ya tiene su propio poll
      const social = document.querySelector('[data-u52-screen="social"]');
      const enSocial = social && social.classList.contains('active');
      const inboxAbierto = document.getElementById('urbis-inbox-ov');
      if(!enSocial && !inboxAbierto) return;
      window.urbisRefrescarInbox(function(){ window.urbisActualizarBadgeChat(); });
    }catch(e){}
  }, 15000);

  // ════════════════════════════════════════════════════════════════════════
  // ADMIN URBIS (cuenta exclusiva del dueño) + EVENTO ESPECIAL "SOL SOLIDARIO"
  // ════════════════════════════════════════════════════════════════════════
  window.urbisPermisos = window.urbisPermisos || [];
  function _adminUser(){ return String((window.URBIS_CONFIG && window.URBIS_CONFIG.ADMIN_USER) || 'urbisadmin').toLowerCase(); }
  // Ser admin depende de la SESIÓN que devolvió el servidor, no de una marca
  // local. Antes, sin sesión, se respetaba el flag de localStorage: bastaba
  // abrir la consola del navegador, escribir la marca y quedar de
  // administrador sin saber ninguna contraseña. Ahora sin sesión no hay admin.
  function _sesionEsCuentaAdmin(){
    try{
      var s = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? (window.URBIS_AUTH.readSession() || {}) : {};
      if(!String(s.usuario || '')) return false;
      // SOLO el rol que devolvió el servidor. Antes valía además llamarse como
      // la cuenta de administrador, y eso es un nombre, no una credencial: el
      // servidor es quien sabe quién manda. Los administradores se marcan en la
      // hoja de usuarios (rol_solicitado = admin).
      return String(s.rol || '').toLowerCase() === 'admin';
    }catch(e){ return false; }
  }
  // La marca local ya no concede nada; se limpia para que no quede rondando en
  // teléfonos donde se puso en su día.
  try{ localStorage.removeItem('urbis_admin'); }catch(e){}
  try{ if(_sesionEsCuentaAdmin()){ window.userRole = 'admin'; window.userBaseRoleGlobal = 'admin'; } }catch(e){}
  // Una sola respuesta y una sola fuente: el rol que el servidor puso en la
  // sesión. Antes hacían falta ADEMÁS una marca de localStorage o la variable
  // global userRole, y eso daba dos problemas a la vez: quien entraba como
  // administrador podía no serlo hasta que la variable se sincronizara, y quien
  // no lo era podía escribir la marca a mano en la consola.
  window.urbisEsAdmin = function(){ return _sesionEsCuentaAdmin(); };

  // ── Limpieza puntual de datos: unificar "policía militar" bajo "Área preventiva" ──
  // Pedido explícito: hay reportes antiguos con "policía militar" en la NOTA
  // (texto libre del ciudadano) pero sin una categoría oficial unificada. Esto
  // renombra SOLO el campo de categoría/ítem (d[0]) a "Área preventiva" —
  // conserva la nota original tal cual, para no perder el contexto histórico.
  // Uso: llamar window.urbisMigrarAreaPreventiva() una vez desde la consola,
  // logueado como admin. Pide confirmación y muestra cuántos se actualizaron.
  window.urbisMigrarAreaPreventiva = async function(){
    if(!window.urbisEsAdmin()){ alert('Solo el administrador puede ejecutar esta limpieza de datos.'); return; }
    const normaliza = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const data = Array.isArray(globalData) ? globalData : [];
    const candidatos = data.filter(p => {
        const d = String(p.descripcion || '').split(' | ');
        const notas = normaliza(d[2] || '');
        return notas.includes('policia') && notas.includes('militar');
    });
    if(!candidatos.length){ alert('No se encontraron reportes con "policía militar" en la descripción.'); return; }
    if(!confirm(`Se encontraron ${candidatos.length} reporte(s) con "policía militar" en la nota.\n\nSe renombrará su categoría oficial a "Área preventiva" (la nota original NO se toca). ¿Continuar?`)) return;

    let ok = 0, fail = 0;
    for(const p of candidatos){
        try{
            const d = String(p.descripcion || '').split(' | ');
            d[0] = 'Área preventiva';
            await window.urbisDBUpdate('lat', p.lat, { descripcion: d.join(' | ') });
            ok++;
        }catch(e){ fail++; console.warn('No se pudo migrar el reporte', p.lat, e); }
    }
    alert(`Migración completa: ${ok} reporte(s) actualizado(s) a "Área preventiva"${fail ? `, ${fail} con error` : ''}.`);
    try{ cargarPuntos(); }catch(e){}
  };
  // ── Limpieza puntual de datos: 2 retenes de tránsito de jesmen21 con nota
  // "retén preventivo" → recategorizar a "Área preventiva". Cambia tanto el
  // ítem (d[0]) como el campo "tipo" (dimensión), porque "Área preventiva"
  // vive en "🚨 Alertas y Riesgos Urbanos", no en "🚗 Reportes de Tráfico"
  // (a diferencia de la migración de "policía militar", que ya estaba en la
  // dimensión correcta). Conserva la nota original tal cual.
  // Uso: llamar window.urbisMigrarRetenPreventivoJesmen21() desde la consola,
  // logueado como admin. Pide confirmación y muestra cuántos se actualizaron.
  window.urbisMigrarRetenPreventivoJesmen21 = async function(){
    if(!window.urbisEsAdmin()){ alert('Solo el administrador puede ejecutar esta limpieza de datos.'); return; }
    const normaliza = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const data = Array.isArray(globalData) ? globalData : [];
    const idxAutor = BASE_OFFSET + 2;
    const candidatos = data.filter(p => {
        const d = String(p.descripcion || '').split(' | ');
        const notas = normaliza(d[2] || '');
        const autor = normaliza(d[idxAutor] || '');
        return autor === 'jesmen21' && notas.includes('reten preventivo');
    });
    if(!candidatos.length){ alert('No se encontraron reportes de jesmen21 con "retén preventivo" en la nota.'); return; }
    if(!confirm(`Se encontraron ${candidatos.length} reporte(s) de jesmen21 con "retén preventivo" en la nota.\n\nSe cambiará su categoría a "Área preventiva" (dimensión 🚨 Alertas y Riesgos Urbanos). La nota original NO se toca. ¿Continuar?`)) return;

    let ok = 0, fail = 0;
    for(const p of candidatos){
        try{
            const d = String(p.descripcion || '').split(' | ');
            d[0] = 'Área preventiva';
            await window.urbisDBUpdate('lat', p.lat, { descripcion: d.join(' | '), tipo: '🚨 Alertas y Riesgos Urbanos' });
            ok++;
        }catch(e){ fail++; console.warn('No se pudo migrar el reporte', p.lat, e); }
    }
    alert(`Migración completa: ${ok} reporte(s) actualizado(s) a "Área preventiva"${fail ? `, ${fail} con error` : ''}.`);
    try{ cargarPuntos(); }catch(e){}
  };
  // El atajo de admin en el navegador se retiró en la v574. Comparaba la
  // contraseña contra un valor escrito en js/00-config.js, es decir, publicado
  // en urbispro.city para quien quisiera leerlo. Se conserva la función porque
  // otros archivos la llaman, pero ya no autoriza a nadie: el administrador
  // entra por el login normal y es el servidor quien verifica su contraseña.
  window.urbisEsCredsAdmin = function(){ return false; };
  // Refresca la interfaz para el administrador. La llama el login DESPUÉS de que
  // el servidor haya dicho que el rol es admin; no concede el permiso, solo pone
  // la pantalla acorde. Ya no escribe ninguna marca en el navegador: era
  // precisamente lo que se podía falsificar desde la consola.
  window.urbisActivarModoAdmin = function(){
    window.userRole = 'admin'; window.userBaseRoleGlobal = 'admin';
    if(!window.userUsernameGlobal) window.userUsernameGlobal = _adminUser();
    if(!window.userNameGlobal) window.userNameGlobal = 'Administrador URBIS';
    try{ localStorage.setItem('urbis_usuario_local', window.userUsernameGlobal); }catch(e){}
    try{ if(typeof window.urbisSyncSharedIdentity === 'function') window.urbisSyncSharedIdentity(); }catch(e){}
    try{ document.body.dataset.role = 'admin'; }catch(e){}
    try{ if(typeof window.urbisApplyProfileIdentityUI === 'function') window.urbisApplyProfileIdentityUI(); }catch(e){}
    try{ if(typeof window.urbisRenderEventosMovil === 'function') window.urbisRenderEventosMovil(); }catch(e){}
    try{ cargarPuntos(); }catch(e){}
  };
  window.urbisAdminUnlock = function(){
    alert('El modo administrador ya no se activa desde aquí.\n\n' +
          'Cierra sesión y entra con la cuenta de administrador (usuario ' + _adminUser() + ') ' +
          'como entra cualquier usuario. Su contraseña la verifica el servidor de URBIS, ' +
          'no la aplicación: así no puede quedar escrita en un archivo público.');
  };
  window.urbisAdminLogout = function(){
    window.userRole = 'citizen'; window.userBaseRoleGlobal = 'citizen';
    try{ document.body.dataset.role = 'citizen'; }catch(e){}
    alert('Saliste del modo administrador.');
    try{ if(typeof window.urbisRenderEventosMovil === 'function') window.urbisRenderEventosMovil(); }catch(e){}
  };

  function urbisTienePermisoEspecial(usuario){
    const u = String(usuario||'').trim().toLowerCase(); if(!u) return false;
    return (window.urbisPermisos||[]).some(p => {
      const parts = _metaSplit(p.descripcion);
      return (parts[0]||'').trim().toLowerCase() === u && (parts[1]||'').toLowerCase().indexOf('especial') !== -1;
    });
  }
  // Usuarios con permiso DIRECTO para crear el evento de Juegos URBIS (no admin completo, solo ese evento).
  var _permisoAureaDirecto = ['jesmen21','jesmen21s'];
  window.urbisPuedeCrearEspecial = function(){
    if(window.urbisEsAdmin()) return true;
    var u = (window.urbisUsuarioActual ? window.urbisUsuarioActual() : '').trim().toLowerCase();
    if(_permisoAureaDirecto.indexOf(u) !== -1) return true;
    return urbisTienePermisoEspecial(u);
  };
  window.urbisListaPermisos = function(){
    const set = {};
    (window.urbisPermisos||[]).forEach(p => { const u = (_metaSplit(p.descripcion)[0]||'').trim(); if(u) set[u.toLowerCase()] = u; });
    return Object.values(set);
  };
  window.urbisOtorgarPermiso = function(usuario, cb){
    if(!window.urbisEsAdmin()){ alert('Solo el administrador puede dar permisos.'); return; }
    const u = String(usuario||'').trim().replace(/^@/,'').replace(/[~|§]/g,'');
    if(!u){ alert('Escribe el usuario al que quieres dar permiso.'); return; }
    if(urbisTienePermisoEspecial(u)){ alert('@' + u + ' ya tiene permiso de evento especial.'); if(cb) cb(); return; }
    const fila = { tipo:'🔑 Permiso', lat:'0', lng:'0', descripcion: u + '~~~evento_especial', fecha:new Date().toISOString() };
    window.urbisGuardarFila(fila)
      .then(()=>{ (window.urbisPermisos = window.urbisPermisos||[]).push(fila); alert('✅ Permiso de evento especial otorgado a @' + u); if(cb) cb(); })
      .catch(err=> alert('No se pudo dar permiso: ' + (err && err.message || err)));
  };

  // Crear el evento PREMIUM "Juegos URBIS": competencia real con premio en dinero.
  window.urbisCrearEventoPremium = function(){
    if(!window.urbisPuedeCrearEspecial()){ alert('Solo el administrador o usuarios autorizados pueden crear un evento de Juegos URBIS.'); return; }
    const titulo = prompt('✨ Nombre del evento de Juegos URBIS (evento premium):', 'Juegos URBIS'); if(titulo === null) return;
    const premio = prompt('💰 Premio REAL para el ganador (ej: 100.000 COP):', ''); if(premio === null) return;
    const detalle = prompt('📜 ¿En qué consiste el juego? (descripción para los jugadores)', 'Reto de reflejos: el que más puntos haga gana el premio.'); if(detalle === null) return;
    const horas = prompt('⏳ ¿En cuántas HORAS termina la competencia? (ej: 24)', '24'); if(horas === null) return;
    const h = Math.max(1, parseInt(horas, 10) || 24);
    if(!navigator.geolocation){ alert('Necesitas activar el GPS para ubicar el evento de Juegos URBIS.'); return; }
    navigator.geolocation.getCurrentPosition(function(pos){
      window.urbisCrearEventoPremiumEn(pos.coords.latitude.toFixed(7), pos.coords.longitude.toFixed(7), titulo, premio, detalle, h)
        .then(()=>{ alert('✨ ¡Evento de Juegos URBIS creado! Brillará en el mapa. El ganador recibirá el premio real.'); })
        .catch(err=> alert('No se pudo crear el evento de Juegos URBIS: ' + (err && err.message || err)));
    }, function(){ alert('No se pudo obtener tu ubicación GPS.'); }, { enableHighAccuracy:true, timeout:9000 });
  };
  // Crea el evento de Juegos URBIS en un punto específico (usado por el compositor de eventos del mapa).
  window.urbisCrearEventoPremiumEn = function(lat, lng, titulo, premio, detalle, horas){
    const h = Math.max(1, parseInt(horas, 10) || 24);
    const usuario = (window.urbisUsuarioActual && window.urbisUsuarioActual()) || 'urbis';
    const fin = new Date(Date.now() + h * 3600000);
    const finTxt = fin.toLocaleString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    const clean = s => String(s||'').replace(/[|·]/g, '-');
    const notas = `EVENTO_URBIS · PREMIUM · Premio: ${clean(premio) || 'a definir'} · Detalle: ${clean(detalle)} · Hora: termina ${finTxt} · Lugar: Juegos URBIS URBIS`;
    const usos = []; for(var i=0;i<todosLosUsos.length;i++) usos.push('NO');
    const arr = ['✨ Juegos URBIS', clean(titulo) || 'Juegos URBIS', notas, 'Bueno', 'Activo', 'N/A']
      .concat(usos)
      .concat(['N/A', 'Aprobado', usuario, 'admin', 0, (window.userEmailGlobal || 'admin@urbis.com'), 'ADMIN', 'Comunidad']);
    const descripcion = asegurarCamposTemporalesPersonalizados(arr.join(' | '), '🎪 Eventos Comunitarios', '✨ Juegos URBIS', new Date(), h, '✨');
    return window.urbisGuardarFila({ tipo:'🎪 Eventos Comunitarios', lat:String(lat), lng:String(lng), descripcion:descripcion, fecha:new Date().toISOString() })
      .then(res => { if(res && res.ok === false && res.status) throw new Error('HTTP ' + res.status); if(typeof playSuccessSound === 'function') playSuccessSound(); setTimeout(()=>{ try{ cargarPuntos(); }catch(e){} }, 700); return res; });
  };
  window.urbisCrearSolSolidario = window.urbisCrearEventoPremium; // alias compatibilidad

  window.urbisEditarReporteMovil = function(lat){
    const p = buscarPuntoPorLat(lat);
    if(!p){ alert('No se encontró el reporte para editar.'); return; }
    if(typeof puedeGestionarReporte === 'function' && !puedeGestionarReporte(p)){ alert('Solo puedes editar tus propios reportes.'); return; }
    try{ map.closePopup(); }catch(e){}
    const d = String(p.descripcion || '').split(' | ');
    const tituloAct = d[1] || d[0] || '';
    const notaAct = (d[2] && d[2] !== 'N/A') ? d[2] : '';
    const fotoAct = d[BASE_OFFSET] || '';
    const tieneFoto = fotoAct && fotoAct !== 'N/A' && String(fotoAct).trim();
    const escAttr = s => String(s || '').replace(/"/g, '&quot;');
    const escHtml = s => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Tipo de reporte actual: se busca en el catálogo unificado (mismo de
    // Android/PC) por etiqueta exacta, para poder ofrecer "Cambiar tipo" con
    // icono. Si el reporte no está en el catálogo (p.ej. Mapeo Técnico), no
    // se ofrece el cambio — solo se muestra el tipo actual, sin tocarlo.
    const catalogoTipos = window.URBIS_QUICK_REPORTS || {};
    let tipoActualId = Object.keys(catalogoTipos).find(id => catalogoTipos[id].label === d[0]) || null;
    let tipoSeleccionado = tipoActualId ? Object.assign({ id: tipoActualId }, catalogoTipos[tipoActualId]) : null;
    const iconoActual = tipoSeleccionado ? tipoSeleccionado.icon : (typeof obtenerIconoReporte === 'function' ? obtenerIconoReporte(p.tipo, p) : '📍');

    // ¿Hubo gente herida? Un accidente se publica en caliente, sin saber
    // todavía si alguien murió; la noticia llega horas después y es aquí,
    // editando, donde se corrige. El bloque vuelve con lo que ya estaba
    // guardado: si apareciera en blanco, cambiar el título borraría el conteo.
    let bloqueVictimasEdicion = '';
    try {
      if(typeof window.urbisBloqueVictimas === 'function' && typeof window.urbisPreguntaPorVictimas === 'function') {
        const _vicAct = (typeof window.urbisLeerVictimas === 'function') ? window.urbisLeerVictimas(p.descripcion) : null;
        const _pregunta = window.urbisPreguntaPorVictimas(tipoActualId || d[0]);
        bloqueVictimasEdicion = '<div id="urbis-victimas-wrap"' + (_pregunta ? '' : ' hidden') + '>' +
                                window.urbisBloqueVictimas(_vicAct) + '</div>';
      }
    } catch(e){}

    let sheet = document.getElementById('urbis-edit-sheet2');
    if(sheet) sheet.remove();
    sheet = document.createElement('div');
    sheet.id = 'urbis-edit-sheet2';
    sheet.innerHTML = `
      <div class="ued-card">
        <button type="button" class="ued-close" aria-label="Cerrar">×</button>
        <h2>✏️ Editar reporte</h2>
        <label>Tipo de reporte</label>
        <button type="button" id="ued-tipo-btn" class="ued-tipo-btn">
          <span id="ued-tipo-icon">${iconoActual}</span>
          <span id="ued-tipo-label">${escHtml(d[0] || '')}</span>
          <span class="ued-tipo-chev">›</span>
        </button>
        <label>Título / dirección</label>
        <input id="ued-titulo" type="text" value="${escAttr(tituloAct)}" placeholder="Ej: Calle 5 con Av. 2 — Hueco grande">
        <label>Descripción</label>
        <textarea id="ued-nota" rows="4" placeholder="Describe la situación...">${escHtml(notaAct)}</textarea>
        ${bloqueVictimasEdicion}
        <label>Foto (opcional · si no eliges nada, se conserva la actual)</label>
        ${tieneFoto ? `<img class="ued-foto-actual" src="${fotoAct}" alt="Foto actual">` : '<div class="ued-sinfoto">Sin foto actual</div>'}
        <input id="ued-foto" type="file" accept="image/*">
        <div class="ued-actions">
          <button type="button" class="ued-cancel">Cancelar</button>
          <button type="button" class="ued-save">Guardar cambios</button>
        </div>
      </div>`;
    document.body.appendChild(sheet);
    const cerrar = () => { try{ sheet.remove(); }catch(e){} };
    sheet.querySelector('.ued-close').onclick = cerrar;
    sheet.querySelector('.ued-cancel').onclick = cerrar;
    try{ if(typeof window.urbisActivarBloqueVictimas === 'function') window.urbisActivarBloqueVictimas(sheet); }catch(e){}

    sheet.querySelector('#ued-tipo-btn').onclick = function(){
      const secciones = window.URBIS_QUICK_REPORT_SECTIONS || [];
      let picker = document.getElementById('urbis-tipo-picker');
      if(picker) picker.remove();
      picker = document.createElement('div');
      picker.id = 'urbis-tipo-picker';
      let listaHtml = secciones.map(sec => `
        <div class="utp-section">
          <div class="utp-section-head"><span>${sec.icon}</span><b>${escHtml(sec.label)}</b></div>
          <div class="utp-grid">
            ${sec.items.map(([id, icon, label]) => `<button type="button" class="utp-item" data-id="${id}">${icon}<span>${escHtml(label)}</span></button>`).join('')}
          </div>
        </div>`).join('');
      picker.innerHTML = `
        <div class="utp-card">
          <button type="button" class="utp-close" aria-label="Cerrar">×</button>
          <h2>Elige el tipo de reporte</h2>
          ${listaHtml}
        </div>`;
      document.body.appendChild(picker);
      const cerrarPicker = () => { try{ picker.remove(); }catch(e){} };
      picker.querySelector('.utp-close').onclick = cerrarPicker;
      picker.querySelectorAll('.utp-item').forEach(btn => {
        btn.onclick = function(){
          const id = this.dataset.id;
          const info = catalogoTipos[id];
          if(!info) return;
          tipoSeleccionado = Object.assign({ id }, info);
          document.getElementById('ued-tipo-icon').textContent = info.icon;
          document.getElementById('ued-tipo-label').textContent = info.label;
          // Si el reporte deja de ser un accidente, la pregunta sobra; si pasa
          // a serlo, aparece.
          try{
            const w = sheet.querySelector('#urbis-victimas-wrap');
            if(w && typeof window.urbisPreguntaPorVictimas === 'function') w.hidden = !window.urbisPreguntaPorVictimas(id);
          }catch(e){}
          cerrarPicker();
        };
      });
    };

    sheet.querySelector('.ued-save').onclick = async function(){
      const btn = this; btn.disabled = true; btn.textContent = 'Guardando...';
      try{
        if(tipoSeleccionado){ d[0] = tipoSeleccionado.label; }
        d[1] = (document.getElementById('ued-titulo').value || tituloAct).replace(/\|/g, '-');
        const notaVal = (document.getElementById('ued-nota').value || '').replace(/\|/g, '-');
        d[2] = notaVal.trim() ? notaVal : 'N/A';
        const fileInput = document.getElementById('ued-foto');
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        if(file && typeof window.urbanProcesarImagen === 'function'){
          btn.textContent = '📷 Procesando foto...';
          try{ const nueva = await window.urbanProcesarImagen(file); if(nueva) d[BASE_OFFSET] = String(nueva).replace(/\|/g, '-'); }catch(e){}
        }
        // Deja el autor mostrado como el usuario de la sesión (p.ej. jesmen21).
        try{
          const s = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null;
          if(s && s.usuario) d[BASE_OFFSET + 2] = String(s.usuario).replace(/\|/g, '-');
        }catch(e){}
        let descripcionFinal = d.join(' | ');
        // El conteo se escribe solo si la pregunta está a la vista: si el
        // reporte dejó de ser un accidente, no se arrastra un dato que ya no
        // corresponde a nada.
        try{
          if(typeof window.urbisFormularioVictimasActivo === 'function' &&
             window.urbisFormularioVictimasActivo(sheet)) {
            const _v = window.urbisLeerFormularioVictimas(sheet);
            descripcionFinal = window.urbisGuardarVictimas(descripcionFinal, _v.heridos, _v.fallecidos);
          }
        }catch(e){}
        const camposActualizar = { descripcion: descripcionFinal };
        if(tipoSeleccionado && tipoSeleccionado.dim) camposActualizar.tipo = tipoSeleccionado.dim;
        await window.urbisDBUpdate('lat', lat, camposActualizar);
        if(typeof playSuccessSound === 'function') playSuccessSound();
        // Actualización OPTIMISTA: se pinta el icono/nombre nuevo de inmediato con
        // los datos que ya tenemos en memoria (p es el mismo objeto de
        // globalData), sin esperar el viaje de ida y vuelta al servidor. Antes
        // se dependía solo de cargarPuntos() (recarga por red) con un delay fijo
        // de 400ms+700ms, así que en redes lentas el icono viejo se veía varios
        // segundos. cargarPuntos() se sigue llamando después, en segundo plano,
        // solo para sincronizar con el servidor.
        p.descripcion = descripcionFinal;
        if(tipoSeleccionado && tipoSeleccionado.dim) p.tipo = tipoSeleccionado.dim;
        cerrar();
        try{ pintarPuntos(datosVisiblesActuales()); }catch(e){}
        try{ if(document.querySelector('[data-u52-screen="timeline"]')?.classList.contains('active')) window.urbisRenderMisReportes(); }catch(e){}
        setTimeout(()=>{ try{ cargarPuntos(); }catch(e){} }, 1200);
      }catch(err){ alert('No se pudo guardar: ' + (err && err.message || err)); btn.disabled = false; btn.textContent = 'Guardar cambios'; }
    };
  };
