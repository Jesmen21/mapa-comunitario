// ==========================================
  // HELPERS DE ESTABILIDAD Y SEGURIDAD BÁSICA
  // ==========================================
  function limpiarHTML(valor) {
      return String(valor ?? '').replace(/[&<>"']/g, function(char) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
      });
  }

  function normalizarTexto(valor, fallback = '') {
      const texto = String(valor ?? '').trim();
      return texto === '' ? fallback : texto;
  }

  function buscarPuntoPorLat(lat) {
      return globalData.find(p => String(p.lat) === String(lat));
  }

  function esMismoValor(a, b) {
      return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  // Igual que esMismoValor pero NUNCA matchea en vacío. Crítico para identidad:
  // sin esto, '' === '' hacía que reportes ajenos con autor vacío salieran como
  // "míos" si la sesión tenía algún campo vacío.
  function esMismoValorNoVacio(a, b) {
      const va = String(a || '').trim().toLowerCase();
      const vb = String(b || '').trim().toLowerCase();
      const PLACEHOLDERS = ['', 'no registrado', 'n/a', 'anónimo', 'anonimo', 'ciudadano'];
      if(PLACEHOLDERS.includes(va) || PLACEHOLDERS.includes(vb)) return false;
      return va === vb;
  }

  // El módulo de login (js/41) es un IIFE aparte: solo puede setear window.* — el
  // scope compartido (userRole/userEmailGlobal...) queda vacío al iniciar sesión.
  // Por eso la identidad efectiva se resuelve primero desde window.*.
  function urbisIdentidadActual() {
      const w = (typeof window !== 'undefined') ? window : {};
      return {
          rol:    w.userRole       || userRole       || '',
          correo: w.userEmailGlobal|| userEmailGlobal || '',
          cedula: w.userCedulaGlobal|| userCedulaGlobal || '',
          nombre: w.userNameGlobal || userNameGlobal  || '',
          usuario:w.userUsernameGlobal || (typeof userUsernameGlobal!=='undefined'?userUsernameGlobal:'') || ''
      };
  }

  function esReporteAnonimoDeEsteDispositivo(p) {
      // Reportes de categorías anónimas (ej. "Consumo de drogas") no llevan
      // ningún dato de identidad en la base pública — la única forma de que su
      // propio creador conserve permisos de gestión es esta marca LOCAL
      // (nunca sale de este dispositivo/navegador).
      try {
          if(!p) return false;
          const arr = JSON.parse(localStorage.getItem('urbis_anon_reports_mine') || '[]');
          return arr.includes(String(p.lat));
      } catch(e){ return false; }
  }
  function esAutorDelReporte(p) {
      if(!p || !p.descripcion) return false;
      if(esReporteAnonimoDeEsteDispositivo(p)) return true;
      const d = String(p.descripcion || '').split(' | ');
      const autorNombre = d[BASE_OFFSET + 2] || '';
      const autorRol = d[BASE_OFFSET + 3] || '';
      const autorCorreo = d[BASE_OFFSET + 5] || '';
      const autorCedula = d[BASE_OFFSET + 6] || '';
      const yo = urbisIdentidadActual();
      // Admin/gov gestionan todo; para ciudadano basta que coincida correo, cédula,
      // nombre o usuario (el rol guardado puede diferir entre registro y login).
      if(yo.rol === 'gov' || (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin())) return true;
      return (
          esMismoValorNoVacio(autorCorreo, yo.correo) ||
          esMismoValorNoVacio(autorCedula, yo.cedula) ||
          esMismoValorNoVacio(autorNombre, yo.nombre) ||
          esMismoValorNoVacio(autorNombre, yo.usuario)
      );
  }

  function puedeGestionarReporte(p) {
      const rol = urbisIdentidadActual().rol;
      if(rol === 'gov' || (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin())) return true;
      // El dueño puede gestionar su propio reporte SIEMPRE (incluso archivado/vencido),
      // para poder editarlo, reactivarlo o eliminarlo desde "Mis reportes".
      return esAutorDelReporte(p);
  }

  function etiquetaPropietarioReporte(p) {
      return esAutorDelReporte(p) ? '<span class="badge-like owner-badge">TU REPORTE</span>' : '';
  }

  function requestJSON(url, options = {}, esperaJSON = true) {
      return fetch(url, options).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          return esperaJSON ? res.json() : res;
      });
  }

  function manejarError(contexto, error) {
      console.error(`[URBIS] ${contexto}:`, error);
      const sidebar = document.getElementById('sidebar');
      if(sidebar) sidebar.style.opacity = '1';
      const msg = String(error && (error.message || error) || '').toLowerCase();
      const esSheetDB = msg.includes('sheetdb') || msg.includes('429') || msg.includes('403') || msg.includes('402') || msg.includes('failed to fetch') || msg.includes('network');
      const esMovil = (window.matchMedia && window.matchMedia('(max-width:1024px), (pointer:coarse)').matches) || window.innerWidth <= 1024;
      if(esMovil && (String(contexto).toLowerCase().includes('cargar puntos') || esSheetDB)) {
          console.warn('URBIS móvil continúa sin bloquear por error SheetDB.');
          return;
      }
      alert(`No se pudo completar la acción: ${contexto}. Revisa la conexión o inténtalo de nuevo.`);
  }


  function parseFechaReporte(p, d = null) {
      d = d || String(p.descripcion || '').split(' | ');
      const iso = d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET];
      let fecha = iso ? new Date(iso) : null;
      if(!fecha || isNaN(fecha.getTime())) {
          const raw = p.fecha || '';
          const partes = String(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if(partes) fecha = new Date(Number(partes[3]), Number(partes[2])-1, Number(partes[1]), 12, 0, 0);
          else fecha = new Date(raw);
      }
      return (fecha && !isNaN(fecha.getTime())) ? fecha : new Date();
  }

  function esReporteTemporal(tipo, elemento) {
      // Categorías completas que siempre son temporales (alertas ciudadanas de 8h)
      const TIPOS_TEMPORALES = new Set(['🚨 Alertas y Riesgos Urbanos','🚗 Reportes de Tráfico','Áreas Verdes y Ambiental','Animal y Bienestar','🌪️ Desastres Naturales y Clima','⛰️ Riesgos del Terreno']);
      if(TIPOS_TEMPORALES.has(tipo)) return true;
      const texto = `${tipo || ''} ${elemento || ''}`.toLowerCase();
      return texto.includes('inund') || texto.includes('drenaje') || texto.includes('fuga') ||
             texto.includes('tráfico') || texto.includes('trafico') || texto.includes('accidente') ||
             texto.includes('congest') || texto.includes('retén') || texto.includes('reten') ||
             texto.includes('cerrada') || texto.includes('bloqueada') || texto.includes('desvío') || texto.includes('desvio') ||
             texto.includes('ruta bloqueada') || texto.includes('obra en vía') ||
             texto.includes('hueco') || texto.includes('bache') || texto.includes('derrumbe') ||
             texto.includes('alcantarilla') || texto.includes('poste') || texto.includes('basura') ||
             texto.includes('incendio') || texto.includes('animal');
  }

  function obtenerMetaTemporal(p) {
      const d = String(p.descripcion || '').split(' | ');
      const creado = parseFechaReporte(p, d);
      const elemento = d[0] || '';
      const temporal = (d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 2] || '').toLowerCase() === 'temporal' || esReporteTemporal(p.tipo, elemento);
      const expira = d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 1] ? new Date(d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 1]) : new Date(creado.getTime() + TTL_HORAS_REPORTES_TEMPORALES * 60 * 60 * 1000);
      const estadoHistorial = d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3] || d[4] || 'Activo';
      const archivado = String(estadoHistorial).toLowerCase() === 'archivado' || (temporal && Date.now() > expira.getTime());
      return { creado, expira, temporal, archivado, estadoHistorial, icono: d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 4] || '' };
  }

  function asegurarCamposTemporales(desc, cat, item, fechaBase = new Date()) {
      const d = String(desc || '').split(' | ');
      const temporal = esReporteTemporal(cat, item);
      const icono = (obtenerIconoWaze(cat, item) || {}).label || 'General';
      const creadoISO = d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET] || fechaBase.toISOString();
      // Pedido explícito: atentado/artefacto explosivo dura 24h en vez de
      // las 8h normales — es información de seguridad, debe verse más tiempo.
      // Sismo/terremoto e incendio forestal: catástrofes de escala regional
      // que la comunidad sigue necesitando ver días después, no horas — dos
      // semanas (336h; ajustado de 168h a pedido explícito), en vez de las
      // 8h normales.
      const horasTTL = /atentado|artefacto explosivo/i.test(String(item||'')) ? 24
        : /sismo|terremoto|incendio forestal/i.test(String(item||'')) ? 336
        : TTL_HORAS_REPORTES_TEMPORALES;
      const expiraISO = d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 1] || (temporal ? new Date(new Date(creadoISO).getTime() + horasTTL * 60 * 60 * 1000).toISOString() : 'N/A');
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET] = creadoISO;
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 1] = expiraISO;
      const yaEsTemporal = (d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 2] || '').toLowerCase() === 'temporal';
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 2] = (yaEsTemporal || temporal) ? 'Temporal' : 'Permanente';
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3] = d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3] || 'Activo';
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 4] = icono;
      return d.join(' | ');
  }


  function asegurarCamposTemporalesPersonalizados(desc, cat, item, fechaBase = new Date(), horasTTL = TTL_HORAS_REPORTES_TEMPORALES, iconoPersonalizado = 'General') {
      const d = String(desc || '').split(' | ');
      const horas = Math.max(1, Number(horasTTL) || TTL_HORAS_REPORTES_TEMPORALES);
      const creadoISO = d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET] || fechaBase.toISOString();
      const expiraISO = new Date(new Date(creadoISO).getTime() + horas * 60 * 60 * 1000).toISOString();
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET] = creadoISO;
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 1] = expiraISO;
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 2] = 'Temporal';
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3] = d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3] || 'Activo';
      d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 4] = iconoPersonalizado || 'Evento';
      return d.join(' | ');
  }

  function visibleParaRol(p, corte = null) {
      const d = String(p.descripcion || '').split(' | ');
      const validacion = d[BASE_OFFSET + 1] || 'Aprobado';
      const meta = obtenerMetaTemporal(p);
      // Admin SOLO si la sesión es la cuenta admin (urbisEsAdmin valida la sesión). gov por rol real.
      const esAdmin = (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin()) || urbisIdentidadActual().rol === 'gov';
      const tiempoCorte = corte ? corte.getTime() : Date.now();

      // Contenido denunciado: sale del mapa mientras un moderador lo revisa
      // (js/13c). NO se borra. Siguen viéndolo el moderador, porque tiene que
      // poder mirarlo para decidir, y su propio autor, porque algo que
      // desaparece sin explicación parece un fallo de la aplicación y encima
      // impide corregirlo.
      if(typeof window.urbisContenidoOculto === 'function' && window.urbisContenidoOculto(p)) {
          if(esAdmin) return true;
          try { if(typeof esAutorDelReporte === 'function' && esAutorDelReporte(p)) return true; } catch(e){}
          return false;
      }

      // Admin/JAC: en modo HISTÓRICO (línea temporal) ve todo por fecha de creación.
      // En modo EN VIVO mantiene el mapa LIMPIO: oculta los reportes temporales VENCIDOS
      // (igual que el ciudadano), pero sí ve todos los permanentes incl. pendientes por aprobar.
      // El historial completo sigue accesible con la línea temporal.
      if(esAdmin) {
          if(corte) return meta.creado.getTime() <= tiempoCorte;
          if(meta.temporal) return meta.expira.getTime() >= Date.now();
          return true;
      }

      // Ciudadano: los reportes temporales tipo Waze deben verse apenas se crean,
      // aunque todavía estén Pendientes. Solo desaparecen al pasar sus 8 horas.
      if(meta.temporal) {
          return meta.creado.getTime() <= tiempoCorte && meta.expira.getTime() >= tiempoCorte;
      }

      // Para hitos permanentes/técnicos se mantiene el criterio anterior: visible si está aprobado.
      if(validacion !== 'Aprobado') return false;
      if(corte) return meta.creado.getTime() <= tiempoCorte;
      return true;
  }

  // Filas "meta" (NO son reportes): ubicación-GPS de usuarios, comentarios, relaciones,
  // puntajes, permisos, avatares, chat. NUNCA deben pintarse como alertas/marcadores en el
  // mapa (con 1000 usuarios serían miles de puntos basura). Se detectan por el TEXTO del tipo.
  function esFilaMetaUrbis(p){
      const t = String((p && p.tipo) || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      return t.indexOf('ubicacion')!==-1 || t.indexOf('comentario')!==-1 || t.indexOf('relacion')!==-1 ||
             t.indexOf('puntaje')!==-1 || t.indexOf('permiso')!==-1 || t.indexOf('avatar')!==-1 || t.indexOf('chat')!==-1 ||
             t.indexOf('peticion')!==-1 ||
             // La vitrina (js/13i) se pinta sola, en su capa: para el resto
             // de la maquinaria de reportes es una fila interna.
             t.indexOf('emprendimiento')!==-1 || t.indexOf('portafolio')!==-1;
  }
  window.esFilaMetaUrbis = esFilaMetaUrbis;

  function datosVisiblesActuales() {
      const corte = timelineLiveMode ? null : timelineSelectedTime;
      return globalData.filter(p => !esFilaMetaUrbis(p) && visibleParaRol(p, corte));
  }
  // El análisis del modo educativo (js/64) corre sobre EXACTAMENTE los mismos
  // puntos que el estudiante está viendo en el mapa —con su filtro de rol y su
  // línea de tiempo—, no sobre el crudo. Si analizara otra cosa, el número no
  // cuadraría con lo que tiene delante y no habría forma de comprobarlo.
  window.urbisDatosVisibles = datosVisiblesActuales;

  function formatearFechaHora(fecha) {
      if(!fecha || isNaN(fecha.getTime())) return 'Sin fecha';
      return fecha.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function renderTimeline() {
      const shell = document.getElementById('timeline-shell');
      if(!shell) return;
      const esAdmin = (typeof window.urbisEsAdmin === 'function' && window.urbisEsAdmin()) || urbisIdentidadActual().rol === 'gov';
      if(!esAdmin) { shell.classList.remove('visible'); return; }
      const fechas = globalData.map(p => parseFechaReporte(p)).filter(f => f && !isNaN(f.getTime())).sort((a,b) => a-b);
      if(!fechas.length) { shell.classList.remove('visible'); return; }
      const min = fechas[0].getTime();
      const max = Math.max(fechas[fechas.length - 1].getTime(), Date.now());
      if(!timelineSelectedTime) timelineSelectedTime = new Date(max);
      const val = timelineLiveMode ? max : Math.min(Math.max(timelineSelectedTime.getTime(), min), max);
      const fechaVal = new Date(val);
      const localDateTime = new Date(val - (fechaVal.getTimezoneOffset()*60000)).toISOString().slice(0,16);
      const yearActual = fechaVal.getFullYear();
      const monthActual = fechaVal.getMonth();
      const yearMin = new Date(min).getFullYear();
      const yearMax = new Date(max).getFullYear();
      let yearsHTML = '';
      for(let y = yearMin; y <= yearMax; y++) yearsHTML += `<option value="${y}" ${y === yearActual ? 'selected' : ''}>${y}</option>`;
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      let mesesHTML = meses.map((m, idx) => `<option value="${idx}" ${idx === monthActual ? 'selected' : ''}>${m}</option>`).join('');
      shell.innerHTML = `
        <div class="timeline-head">
          <span class="timeline-title">Línea temporal</span>
          <span class="timeline-mode">${timelineLiveMode ? 'En vivo' : 'Histórico'}</span>
        </div>
        <div class="timeline-controls">
          <input type="range" min="${min}" max="${max}" step="60000" value="${val}" oninput="cambiarTimelineSlider(this.value)">
          <div class="timeline-date-row">
            <select class="timeline-select" title="Año" onchange="cambiarTimelineAnio(this.value)">${yearsHTML}</select>
            <select class="timeline-select" title="Mes" onchange="cambiarTimelineMes(this.value)">${mesesHTML}</select>
            <input class="timeline-date" type="datetime-local" value="${localDateTime}" onchange="cambiarTimelineFecha(this.value)">
          </div>
        </div>
        <div class="timeline-meta"><span>Inicio ${formatearFechaHora(new Date(min))}</span><span>Corte <b>${formatearFechaHora(new Date(val))}</b></span></div>
        <div class="timeline-actions">
          <button class="tiny-btn ${timelineLiveMode ? 'active' : ''}" onclick="activarTimelineVivo()">● Vivo</button>
          <button class="tiny-btn ${!timelineLiveMode ? 'active' : ''}" onclick="aplicarTimelineHistorico()">◷ Histórico</button>
          <button class="tiny-btn" onclick="cargarPuntos()">↻ Actualizar</button>
        </div>`;
      shell.classList.add('visible');
  }

  window.cambiarTimelineSlider = function(valor) {
      timelineSelectedTime = new Date(Number(valor));
      timelineLiveMode = false;
      refrescarVistaDesdeMemoria();
  };

  window.cambiarTimelineFecha = function(valor) {
      timelineSelectedTime = new Date(valor);
      timelineLiveMode = false;
      refrescarVistaDesdeMemoria();
  };

  window.cambiarTimelineAnio = function(valor) {
      const base = timelineSelectedTime && !isNaN(timelineSelectedTime.getTime()) ? new Date(timelineSelectedTime) : new Date();
      base.setFullYear(Number(valor));
      timelineSelectedTime = base;
      timelineLiveMode = false;
      refrescarVistaDesdeMemoria();
  };

  window.cambiarTimelineMes = function(valor) {
      const base = timelineSelectedTime && !isNaN(timelineSelectedTime.getTime()) ? new Date(timelineSelectedTime) : new Date();
      base.setMonth(Number(valor));
      timelineSelectedTime = base;
      timelineLiveMode = false;
      refrescarVistaDesdeMemoria();
  };

  window.activarTimelineVivo = function() {
      timelineLiveMode = true;
      timelineSelectedTime = new Date();
      refrescarVistaDesdeMemoria();
  };

  window.aplicarTimelineHistorico = function() {
      timelineLiveMode = false;
      if(!timelineSelectedTime) timelineSelectedTime = new Date();
      refrescarVistaDesdeMemoria();
  };

  function refrescarVistaDesdeMemoria() {
      pintarPuntos(datosVisiblesActuales());
      actualizarGraficos(datosVisiblesActuales());
      analizarZonasCiudadanas(datosVisiblesActuales(), false);
      renderTimeline();
  }

  function archivarReportesExpirados(data) {
      // Mantiene historial: no borra registros. Solo marca los temporales vencidos como Archivado en la misma base.
      const promesas = [];
      (Array.isArray(data) ? data : []).forEach(p => {
          if(!p.descripcion) return;
          const d = p.descripcion.split(' | ');
          const meta = obtenerMetaTemporal(p);
          const yaArchivado = String(d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3] || '').toLowerCase() === 'archivado';
          if(meta.temporal && meta.archivado && !yaArchivado) {
              d[4] = 'Archivado';
              d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3] = 'Archivado';
              promesas.push(window.urbisDBUpdate('lat', p.lat, { descripcion: d.join(' | ') })
                .catch(err => console.warn('No se pudo archivar reporte vencido', err)));
          }
      });
      return Promise.all(promesas);
  }

  const URBIS_MAX_FOTO_DATAURL = 42000; // Google Sheets permite aprox. 50.000 caracteres por celda.

  function cargarImagenDesdeArchivo(file) {
      return new Promise((resolve, reject) => {
          if(!file) return resolve(null);
          if(!file.type || !file.type.startsWith('image/')) {
              return reject(new Error('El archivo seleccionado no es una imagen.'));
          }
          const reader = new FileReader();
          reader.onload = () => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
              img.src = reader.result;
          };
          reader.onerror = () => reject(new Error('No se pudo abrir el archivo de imagen.'));
          reader.readAsDataURL(file);
      });
  }

  // WebP pesa ~30% menos que JPEG a calidad percibida igual. Como el techo real
  // es el tamaño del data URL (una celda de Sheets), cada byte ahorrado se
  // convierte en resolución: con WebP cabe una foto de 900 px donde antes
  // apenas entraba una de 360. Se comprueba una vez si el navegador lo soporta.
  const _SOPORTA_WEBP = (function () {
      try {
          const c = document.createElement('canvas');
          c.width = c.height = 1;
          return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      } catch (e) { return false; }
  })();
  const URBIS_FOTO_FORMATO = _SOPORTA_WEBP ? 'image/webp' : 'image/jpeg';

  function imagenADataURLComprimida(img, maxLado, calidad, formato) {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * escala));
      canvas.height = Math.max(1, Math.round(img.height * escala));
      const ctx = canvas.getContext('2d', { alpha: false });
      // Suavizado alto: al reducir una foto de 4000 px a 900 sin él aparecen
      // dientes de sierra que se confunden con "mala cámara".
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL(formato || URBIS_FOTO_FORMATO, calidad);
  }

  // Busca la MEJOR foto que quepa en el presupuesto, en vez de bajar por una
  // escalera fija y quedarse en el primer escalón que entra. Para cada tamaño
  // hace una búsqueda binaria de la calidad máxima que cabe; si a ese tamaño
  // no entra ni con calidad mínima, baja de tamaño. Así una foto de retrato
  // termina en 900 px con q≈0.7 en vez de 360 px con q=0.42.
  // `pisoQ` evita el caso "enorme pero pastosa": si a ese tamaño no se alcanza
  // una calidad mínima digna, se prefiere bajar de tamaño y ganar nitidez.
  function _mejorCalidadQueQuepa(img, lado, techo, pisoQ) {
      const piso = pisoQ == null ? 0.45 : pisoQ;
      let bajo = piso, alto = 0.92, mejor = '';
      // Si ni con la calidad mínima cabe, este tamaño no sirve.
      const base = imagenADataURLComprimida(img, lado, piso);
      if (base.length > techo) return '';
      mejor = base;
      for (let i = 0; i < 6; i++) {
          const q = (bajo + alto) / 2;
          const d = imagenADataURLComprimida(img, lado, q);
          if (d.length <= techo) { mejor = d; bajo = q; } else { alto = q; }
      }
      return mejor;
  }

  async function procesarImagenSeleccionada(file) {
      if(!file) return '';
      const img = await cargarImagenDesdeArchivo(file);
      // De mayor a menor: el primero que quepa gana, y ya viene con la mejor
      // calidad posible para ese tamaño.
      const lados = [1280, 1080, 900, 760, 640, 520, 420, 320];
      for(const lado of lados) {
          const d = _mejorCalidadQueQuepa(img, lado, URBIS_MAX_FOTO_DATAURL);
          if(d) return d;
      }
      // Último recurso: se baja el piso de calidad y se usa todo el margen que
      // aún deja la celda. Peor una foto pobre que ninguna evidencia.
      const ultimo = _mejorCalidadQueQuepa(img, 320, 49000, 0.3);
      if(ultimo) return ultimo;
      throw new Error('La foto sigue siendo demasiado pesada para guardarse en SheetDB/Google Sheets. Usa una foto más pequeña o pega un link de imagen.');
  }

  window.urbanProcesarImagen = async function(file){ return procesarImagenSeleccionada(file); };
  window.previsualizarEvidencia = async function(input) {
      const file = input.files && input.files[0];
      const img = document.getElementById('evidence-preview');
      const label = document.getElementById('evidence-file-name');
      if(!file) return;
      if(label) label.textContent = `Preparando: ${file.name}`;
      try {
          const dataUrl = await procesarImagenSeleccionada(file);
          if(img) { img.src = dataUrl; img.style.display = 'block'; }
          if(label) label.textContent = `Foto lista para guardar (${Math.round(dataUrl.length / 1024)} KB aprox. en base64).`;
      } catch(error) {
          if(label) label.textContent = error.message;
          if(input) input.value = '';
          alert(error.message);
      }
  };


  function obtenerIconoWaze(tipo, elemento) {
      const texto = `${tipo || ''} ${elemento || ''}`.toLowerCase();
      if(texto.includes('inund') || texto.includes('drenaje') || texto.includes('fuga')) return { emoji: '🌊', clase: 'waze-flood', label: 'Inundación' };
      if(texto.includes('hueco') || texto.includes('bache')) return { emoji: '🕳️', clase: 'waze-hole', label: 'Hueco' };
      if(texto.includes('derrumbe') || texto.includes('deslizamiento')) return { emoji: '⛰️', clase: 'waze-landslide', label: 'Derrumbe' };
      if(texto.includes('incendio') || texto.includes('humo') || texto.includes('quema')) return { emoji: '🔥', clase: 'waze-fire', label: 'Incendio' };
      if(texto.includes('sismo') || texto.includes('terremoto')) return { emoji: '🌎', clase: 'waze-danger', label: 'Sismo', forzarEmoji: true };
      if(texto.includes('árbol') || texto.includes('arbol')) return { emoji: '🌳', clase: 'waze-tree', label: 'Árbol' };
      if(texto.includes('semáforo') || texto.includes('semaforo')) return { emoji: '🚦', clase: 'waze-semaforo', label: 'Semáforo' };
      if(texto.includes('poste') || texto.includes('alumbrado') || texto.includes('luminaria') || texto.includes('luz')) return { emoji: '💡', clase: 'waze-light', label: 'Alumbrado' };
      if(texto.includes('alcantarilla') || texto.includes('sumidero') || texto.includes('cuneta')) return { emoji: '🌀', clase: 'waze-drain', label: 'Alcantarilla' };
      if(texto.includes('basura') || texto.includes('residuos') || texto.includes('escombros')) return { emoji: '🗑️', clase: 'waze-trash', label: 'Basura' };
      if(texto.includes('animal')) return { emoji: '🐾', clase: 'waze-animal', label: 'Animal' };
      if(texto.includes('retén') || texto.includes('reten') || texto.includes('policial')) return { emoji: '🚧', clase: 'waze-checkpoint', label: 'Retén' };
      // "Área preventiva" (ej. reten/control preventivo, migrado desde "policía
      // militar" u otros retenes): sin este patrón, obtenerIconoWaze devolvía
      // null y el marcador caía en el PNG genérico de "alertas_y_riesgos_
      // urbanos.png" (el ícono naranja "por defecto" que no distingue nada).
      // forzarEmoji:true evita ese genérico y usa el escudo 🛡️ con punto propio.
      if(texto.includes('preventiva') || texto.includes('area preventiva') || texto.includes('control preventivo')) return { emoji: '🛡️', clase: 'waze-preventive', label: 'Área preventiva', forzarEmoji: true };
      if(texto.includes('cerrada') || texto.includes('bloqueada') || texto.includes('desvío') || texto.includes('desvio')) return { emoji: '⛔', clase: 'waze-closed', label: 'Vía cerrada' };
      if(texto.includes('accidente') || texto.includes('choque')) return { emoji: '🚗', clase: 'waze-accident', label: 'Accidente' };
      // Seguridad ciudadana: cada alerta con su ÍCONO CLARO (forzarEmoji => no usar el PNG kawaii genérico).
      if(texto.includes('sustancia') || texto.includes('consumo de drog') || texto.includes('microtráfico') || texto.includes('microtrafico') || texto.includes('expendio')) return { emoji: '💉', clase: 'waze-danger', label: 'Consumo de sustancias', forzarEmoji: true };
      if(texto.includes('disparo') || texto.includes('detonac') || texto.includes('arma de fuego') || texto.includes('balacera')) return { emoji: '🔫', clase: 'waze-danger', label: 'Disparos', forzarEmoji: true };
      if(texto.includes('sospechos')) return { emoji: '🕵️', clase: 'waze-danger', label: 'Persona sospechosa', forzarEmoji: true };
      if(texto.includes('riña') || texto.includes('rina') || texto.includes('pelea')) return { emoji: '🥊', clase: 'waze-danger', label: 'Riña o pelea', forzarEmoji: true };
      if(texto.includes('vandal')) return { emoji: '🔨', clase: 'waze-danger', label: 'Vandalismo', forzarEmoji: true };
      if(texto.includes('extorsi') || texto.includes('amenaza')) return { emoji: '🔪', clase: 'waze-danger', label: 'Extorsión o amenaza', forzarEmoji: true };
      if(texto.includes('acoso')) return { emoji: '🙅', clase: 'waze-danger', label: 'Acoso', forzarEmoji: true };
      if(texto.includes('agres') || texto.includes('violencia')) return { emoji: '👊', clase: 'waze-danger', label: 'Violencia o agresión', forzarEmoji: true };
      if(texto.includes('asalto') || texto.includes('atraco') || texto.includes('robo') || texto.includes('hurto')) return { emoji: '🦹', clase: 'waze-danger', label: 'Robo / asalto', forzarEmoji: true };
      if(texto.includes('daño a propiedad') || texto.includes('dano a propiedad')) return { emoji: '🏚️', clase: 'waze-danger', label: 'Daño a propiedad', forzarEmoji: true };
      if(texto.includes('zona peligros')) return { emoji: '☠️', clase: 'waze-danger', label: 'Zona peligrosa', forzarEmoji: true };
      if(texto.includes('inseguridad') || texto.includes('peligro') || texto.includes('pandilla') || texto.includes('emergencia grave')) return { emoji: '🚨', clase: 'waze-danger', label: 'Inseguridad', forzarEmoji: true };
      if(texto.includes('congest') || texto.includes('tráfico') || texto.includes('trafico')) return { emoji: '🚗', clase: 'waze-traffic', label: 'Tráfico' };
      return null;
  }

  const WAZE_DOT_COLORS = {
    'waze-flood':      '#3b82f6',
    'waze-hole':       '#6b7280',
    'waze-landslide':  '#a16207',
    'waze-fire':       '#dc2626',
    'waze-tree':       '#16a34a',
    'waze-semaforo':   '#f59e0b',
    'waze-light':      '#eab308',
    'waze-drain':      '#0891b2',
    'waze-trash':      '#6b7280',
    'waze-animal':     '#7c3aed',
    'waze-checkpoint': '#f59e0b',
    'waze-preventive': '#2563eb',
    'waze-closed':     '#ef4444',
    'waze-accident':   '#ef4444',
    'waze-danger':     '#ef4444',
    'waze-traffic':    '#f97316'
  };
  function crearIconoWaze(icono, tipo = '', elemento = '') {
      const kawaiiAsset = (typeof window.urbisGetUsoKawaiiIcon === 'function') ? window.urbisGetUsoKawaiiIcon(tipo, elemento) : '';
      const dotColor = WAZE_DOT_COLORS[icono.clase] || '#ef4444';
      // El PNG "alertas_y_riesgos_urbanos.png" es el genérico de alerta: si el tipo
      // cae ahí (o no tiene PNG), mostramos el EMOJI específico en la gota.
      const esGenerico = icono.forzarEmoji || !kawaiiAsset || /alertas_y_riesgos_urbanos\.png$/i.test(kawaiiAsset);
      if(!esGenerico && typeof window.urbisCrearHTMLAlertaKawaii === 'function'){
          const html = window.urbisCrearHTMLAlertaKawaii(kawaiiAsset, dotColor, 1, icono.label);
          return L.divIcon({ className: 'urbis-waze-root urbis-alerta-root animated-marker', html, iconSize:[42,52], iconAnchor:[21,52], popupAnchor:[0,-46] });
      }
      if(typeof window.urbisCrearHTMLAlertaEmoji === 'function'){
          const html = window.urbisCrearHTMLAlertaEmoji(icono.emoji, dotColor, 1, icono.label);
          return L.divIcon({ className: 'urbis-waze-root urbis-alerta-root animated-marker', html, iconSize:[42,52], iconAnchor:[21,52], popupAnchor:[0,-46] });
      }
      const html = `<div class="waze-icon ${icono.clase}" title="${icono.label}">${icono.emoji}</div>`;
      return L.divIcon({
          className: 'urbis-waze-root animated-marker',
          html,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
      });
  }


  const SIM_VEHICLES = {
      bike: { nombre: 'Bicicleta urbana', emoji: '🚲', velocidad: 16, factor: 1.22, nota: 'Ideal para distancias cortas y ciclorrutas; simula menor velocidad pero buena continuidad.' },
      bus: { nombre: 'Bus / transporte público', emoji: '🚌', velocidad: 18, factor: 1.55, nota: 'Incluye paradas, espera y desvíos aproximados.' },
      motorcycle: { nombre: 'Moto', emoji: '🏍️', velocidad: 34, factor: 1.26, nota: 'Más ágil en tráfico urbano; simula menor fricción por congestión.' },
      car: { nombre: 'Carro particular', emoji: '🚗', velocidad: 28, factor: 1.34, nota: 'Estimación urbana con semáforos, giros y tráfico medio.' }
  };

  function puedeUsarSimuladorGPS() {
      return userRole === 'admin' || userRole === 'gov';
  }

  function formatoCoordSim(p) {
      if(!p) return 'Sin seleccionar';
      return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  }

  function obtenerVehiculoSim() {
      const sel = document.getElementById('sim-vehicle');
      return SIM_VEHICLES[(sel && sel.value) || 'car'] || SIM_VEHICLES.car;
  }

  function generarRutaUrbanaSimulada(a, b) {
      if(!a || !b) return [];
      const dLat = b.lat - a.lat;
      const dLng = b.lng - a.lng;
      const preferirVertical = Math.abs(dLat) >= Math.abs(dLng);
      const curva = Math.min(0.0012, Math.max(0.00025, Math.abs(dLat + dLng) * 0.06));
      const signoLat = dLat >= 0 ? 1 : -1;
      const signoLng = dLng >= 0 ? 1 : -1;
      let puntos;
      if(preferirVertical) {
          puntos = [
              a,
              { lat: a.lat + dLat * .28, lng: a.lng },
              { lat: a.lat + dLat * .28, lng: a.lng + dLng * .42 + signoLng * curva },
              { lat: a.lat + dLat * .66, lng: a.lng + dLng * .42 + signoLng * curva },
              { lat: a.lat + dLat * .66, lng: b.lng },
              b
          ];
      } else {
          puntos = [
              a,
              { lat: a.lat, lng: a.lng + dLng * .30 },
              { lat: a.lat + dLat * .45 + signoLat * curva, lng: a.lng + dLng * .30 },
              { lat: a.lat + dLat * .45 + signoLat * curva, lng: a.lng + dLng * .72 },
              { lat: b.lat, lng: a.lng + dLng * .72 },
              b
          ];
      }
      return puntos.filter((p, idx, arr) => idx === 0 || distanciaMetros(arr[idx-1], p) > 4);
  }

  function distanciaRutaSimulada(path) {
      if(!Array.isArray(path) || path.length < 2) return 0;
      return path.slice(1).reduce((total, punto, idx) => total + distanciaMetros(path[idx], punto), 0);
  }

  function calcularRutaSimuladorGPS() {
      if(!simPointA || !simPointB) return null;
      const vehiculo = obtenerVehiculoSim();
      simRoutePath = generarRutaUrbanaSimulada(simPointA, simPointB);
      const recta = distanciaMetros(simPointA, simPointB);
      const baseRuta = distanciaRutaSimulada(simRoutePath);
      const estimada = Math.max(baseRuta, recta * vehiculo.factor);
      const minutos = Math.max(1, (estimada / 1000) / vehiculo.velocidad * 60);
      return { vehiculo, recta, estimada, minutos, path: simRoutePath };
  }

  function puntoEnRutaPorProgreso(path, progreso) {
      if(!Array.isArray(path) || path.length === 0) return null;
      if(path.length === 1 || progreso <= 0) return path[0];
      if(progreso >= 1) return path[path.length - 1];
      const total = distanciaRutaSimulada(path);
      let objetivo = total * progreso;
      for(let i = 1; i < path.length; i++) {
          const tramo = distanciaMetros(path[i-1], path[i]);
          if(objetivo <= tramo) {
              const t = tramo === 0 ? 0 : objetivo / tramo;
              return {
                  lat: path[i-1].lat + (path[i].lat - path[i-1].lat) * t,
                  lng: path[i-1].lng + (path[i].lng - path[i-1].lng) * t
              };
          }
          objetivo -= tramo;
      }
      return path[path.length - 1];
  }

  function segmentoRutaHastaProgreso(path, progreso) {
      if(!Array.isArray(path) || path.length < 2) return path || [];
      const total = distanciaRutaSimulada(path);
      let objetivo = total * progreso;
      const salida = [path[0]];
      for(let i = 1; i < path.length; i++) {
          const tramo = distanciaMetros(path[i-1], path[i]);
          if(objetivo >= tramo) {
              salida.push(path[i]);
              objetivo -= tramo;
          } else {
              const t = tramo === 0 ? 0 : objetivo / tramo;
              salida.push({
                  lat: path[i-1].lat + (path[i].lat - path[i-1].lat) * t,
                  lng: path[i-1].lng + (path[i].lng - path[i-1].lng) * t
              });
              break;
          }
      }
      return salida;
  }

  function actualizarLineasRecorridoSim(progreso = 0) {
      const path = simRoutePath && simRoutePath.length ? simRoutePath : generarRutaUrbanaSimulada(simPointA, simPointB);
      if(!path || path.length < 2) return;
      if(simCompletedRouteLine) simLayer.removeLayer(simCompletedRouteLine);
      const completada = segmentoRutaHastaProgreso(path, progreso);
      if(completada.length > 1) {
          simCompletedRouteLine = L.polyline(completada.map(p => [p.lat, p.lng]), {
              color:'#2ed573', weight:7, opacity:.95, lineCap:'round', lineJoin:'round'
          }).addTo(simLayer);
      }
  }

  function pintarPuntosSimuladorGPS(ajustar = false) {
      simLayer.clearLayers();
      simBaseRouteLine = null;
      simCompletedRouteLine = null;
      simRemainingRouteLine = null;
      if(simPointA) {
          L.marker([simPointA.lat, simPointA.lng], {
              icon: L.divIcon({ className: '', html: '<div class="sim-point-badge sim-point-a">A</div>', iconSize:[30,30], iconAnchor:[15,15] })
          }).addTo(simLayer).bindPopup('Salida - Origen');
      }
      if(simPointB) {
          L.marker([simPointB.lat, simPointB.lng], {
              icon: L.divIcon({ className: '', html: '<div class="sim-point-badge sim-point-b">B</div>', iconSize:[30,30], iconAnchor:[15,15] })
          }).addTo(simLayer).bindPopup('Destino - Destino');
      }
      if(simPointA && simPointB) {
          const info = calcularRutaSimuladorGPS();
          const path = info.path;
          simRemainingRouteLine = L.polyline(path.map(p => [p.lat, p.lng]), {
              color:'#1f2937', weight:8, opacity:.72, lineCap:'round', lineJoin:'round'
          }).addTo(simLayer);
          simBaseRouteLine = L.polyline(path.map(p => [p.lat, p.lng]), {
              color:'#b8ebe6', weight:4, opacity:.88, dashArray:'10, 8', lineCap:'round', lineJoin:'round'
          }).addTo(simLayer);
          L.polyline([[simPointA.lat, simPointA.lng], [simPointB.lat, simPointB.lng]], {
              color:'#f5bfd6', weight:2, opacity:.45, dashArray:'4, 8'
          }).addTo(simLayer).bindPopup('Línea recta de referencia');
          if(ajustar) map.fitBounds(path.map(p => [p.lat, p.lng]), { padding:[70,70], maxZoom:17 });
      }
  }

  function nombreEstadoViaje(progreso) {
      if(progreso <= 0) return 'Esperando salida';
      if(progreso < .18) return 'Conductor saliendo';
      if(progreso < .72) return 'En recorrido';
      if(progreso < 1) return 'Llegando al destino';
      return 'Viaje finalizado';
  }

  function renderResultadoSimulador(info, progreso = null) {
      const result = document.getElementById('sim-result');
      if(!result) return;
      if(!info) {
          result.innerHTML = modoSimuladorGPS
            ? 'Toca el mapa para seleccionar primero <b>Salida</b> y luego <b>Destino</b>.'
            : 'Activa la captura para comenzar.';
          return;
      }
      const p = progreso === null ? 0 : Math.max(0, Math.min(1, progreso));
      const distanciaRestante = info.estimada * (1 - p);
      const minutosRestantes = info.minutos * (1 - p);
      const estado = progreso === null ? 'Ruta lista para simular' : nombreEstadoViaje(p);
      result.innerHTML = `
          <strong>${info.vehiculo.emoji} ${info.vehiculo.nombre}</strong><br>
          <span class="sim-step-pill">${estado}</span>
          <div class="sim-progress-track"><div class="sim-progress-fill" style="width:${Math.round(p * 100)}%"></div></div>
          <div class="sim-trip-row"><span>Distancia ruta</span><b>${formatoDistancia(info.estimada)}</b></div>
          <div class="sim-trip-row"><span>Distancia restante</span><b>${formatoDistancia(distanciaRestante)}</b></div>
          <div class="sim-trip-row"><span>ETA restante</span><b>${Math.max(0, Math.ceil(minutosRestantes))} min</b></div>
          <div class="sim-trip-row"><span>Referencia recta</span><b>${formatoDistancia(info.recta)}</b></div>
          <span style="display:block;margin-top:7px;color:#aeb6c2;">${info.vehiculo.nota}</span>
      `;
  }

  function actualizarSimuladorGPS() {
      const a = document.getElementById('sim-point-a');
      const b = document.getElementById('sim-point-b');
      if(a) a.textContent = formatoCoordSim(simPointA);
      if(b) b.textContent = formatoCoordSim(simPointB);
      simRouteInfo = calcularRutaSimuladorGPS();
      renderResultadoSimulador(simRouteInfo, null);
  }

  window.activarCapturaSimuladorGPS = function() {
      if(!puedeUsarSimuladorGPS()) { alert('Este simulador está disponible en Modo Arquitecto o Funcionario/JAC.'); return; }
      modoSimuladorGPS = !modoSimuladorGPS;
      modoRutaManual = false;
      const btnSim = document.getElementById('btn-sim-capture');
      const btnRuta = document.getElementById('btn-route-mode');
      if(btnSim) btnSim.classList.toggle('active', modoSimuladorGPS);
      if(btnRuta) btnRuta.classList.remove('active');
      if(modoSimuladorGPS) {
          simPointA = null;
          simPointB = null;
          pausarAnimacionSimuladorGPS();
          simVehicleMarker = null;
          simAnimationProgress = 0;
          simRoutePath = [];
          pintarPuntosSimuladorGPS(false);
      }
      actualizarSimuladorGPS();
  };

  function manejarClickSimuladorGPS(latlng) {
      if(!puedeUsarSimuladorGPS()) return;
      pausarAnimacionSimuladorGPS();
      simVehicleMarker = null;
      simAnimationProgress = 0;

      if(!simPointA || (simPointA && simPointB)) {
          simPointA = { lat: latlng.lat, lng: latlng.lng };
          simPointB = null;
          simRoutePath = [];
          pintarPuntosSimuladorGPS(false);
          actualizarSimuladorGPS();
          mostrarPanelNavegacion('✅ Salida seleccionado. Ahora toca el mapa para elegir <b>Destino</b>.');
          return;
      }

      simPointB = { lat: latlng.lat, lng: latlng.lng };
      pintarPuntosSimuladorGPS(true);
      actualizarSimuladorGPS();
      mostrarPanelNavegacion('✅ Destino seleccionado. Se generó un recorrido urbano simulado; pulsa <b>Iniciar carrera</b>.');
  }

  window.iniciarAnimacionSimuladorGPS = function() {
      if(!puedeUsarSimuladorGPS()) { alert('Disponible solo en Modo Arquitecto o Funcionario/JAC.'); return; }
      if(!simPointA || !simPointB) { alert('Primero selecciona Salida y Destino.'); return; }
      pausarAnimacionSimuladorGPS();
      pintarPuntosSimuladorGPS(false);
      const info = calcularRutaSimuladorGPS();
      const vehiculo = info.vehiculo;
      const duracionMs = Math.min(26000, Math.max(7000, info.minutos * 900));
      const inicio = performance.now() - (simAnimationProgress * duracionMs);

      simVehicleMarker = L.marker([simPointA.lat, simPointA.lng], {
          icon: L.divIcon({ className:'', html:`<div class="sim-vehicle">${vehiculo.emoji}</div>`, iconSize:[34,34], iconAnchor:[17,17] })
      }).addTo(simLayer).bindPopup(`${vehiculo.nombre} en carrera simulada`);

      mostrarPanelNavegacion(`🚦 Carrera simulada iniciada: ${vehiculo.emoji} ${vehiculo.nombre}. ETA aproximado: <b>${Math.round(info.minutos)} min</b>.`);
      simAnimationTimer = setInterval(() => {
          simAnimationProgress = Math.min(1, (performance.now() - inicio) / duracionMs);
          const pos = puntoEnRutaPorProgreso(info.path, simAnimationProgress);
          if(simVehicleMarker && pos) simVehicleMarker.setLatLng([pos.lat, pos.lng]);
          actualizarLineasRecorridoSim(simAnimationProgress);
          renderResultadoSimulador(info, simAnimationProgress);
          if(simAnimationProgress >= 1) {
              pausarAnimacionSimuladorGPS();
              renderResultadoSimulador(info, 1);
              mostrarPanelNavegacion(`🏁 Carrera finalizada: ${vehiculo.emoji} ${vehiculo.nombre}, ${formatoDistancia(info.estimada)}, ${Math.round(info.minutos)} min aprox.`);
          }
      }, 55);
  };

  window.pausarAnimacionSimuladorGPS = function() {
      if(simAnimationTimer) {
          clearInterval(simAnimationTimer);
          simAnimationTimer = null;
      }
  };

  window.reiniciarSimuladorGPS = function() {
      pausarAnimacionSimuladorGPS();
      simPointA = null;
      simPointB = null;
      simVehicleMarker = null;
      simAnimationProgress = 0;
      simRouteInfo = null;
      simRoutePath = [];
      simLayer.clearLayers();
      actualizarSimuladorGPS();
      mostrarPanelNavegacion('🧹 Simulador GPS limpio. Activa captura y elige nuevos puntos.');
  };


  function distanciaMetros(a, b) {
      const R = 6371000;
      const rad = Math.PI / 180;
      const dLat = (b.lat - a.lat) * rad;
      const dLng = (b.lng - a.lng) * rad;
      const lat1 = a.lat * rad;
      const lat2 = b.lat * rad;
      const h = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2)**2;
      return 2 * R * Math.asin(Math.sqrt(h));
  }

  function formatoDistancia(metros) {
      if(!isFinite(metros)) return 'N/A';
      return metros >= 1000 ? `${(metros/1000).toFixed(2)} km` : `${Math.round(metros)} m`;
  }

  function mostrarPanelNavegacion(html) {
      const panel = document.getElementById('nav-panel');
      panel.innerHTML = html;
      panel.classList.add('visible');
  }

  function limpiarRuta() {
      rutaLayer.clearLayers();
      rutaManualOrigen = null;
  }

  function dibujarRuta(origen, destino, titulo = 'Ruta estimada') {
      limpiarRuta();
      const distancia = distanciaMetros(origen, destino);
      L.polyline([[origen.lat, origen.lng], [destino.lat, destino.lng]], {
          color: '#b8ebe6', weight: 6, opacity: .92, dashArray: '10, 10'
      }).addTo(rutaLayer);
      L.circleMarker([origen.lat, origen.lng], { radius: 8, color: '#fff', fillColor: '#2ed573', fillOpacity: 1, weight: 2 }).addTo(rutaLayer).bindPopup('Origen');
      const destinoIcon = (typeof window.urbisDestinoKawaiiIcon === 'function' && window.urbisDestinoKawaiiIcon()) || L.divIcon({className:'urbis-destination-kawaii-icon', html:'<img src="assets/icons/llegada.png" alt="Destino">', iconSize:[52,68], iconAnchor:[26,60]});
      L.marker([destino.lat, destino.lng], { icon: destinoIcon }).addTo(rutaLayer).bindPopup('Destino');
      map.fitBounds([[origen.lat, origen.lng], [destino.lat, destino.lng]], { padding: [60, 60] });
      mostrarPanelNavegacion(`<b>🧭 ${titulo}</b><br><span class="route-distance">${formatoDistancia(distancia)}</span><br><span style="color:#aaa;">Ruta estimada entre dos puntos. Para navegación real por calles se usa el rutador A → B.</span><br><button class="tool-btn" style="margin-top:8px;width:100%;" onclick="limpiarRuta(); document.getElementById('nav-panel').classList.remove('visible')">Limpiar ruta</button>`);
  }

  window.iniciarRutaHacia = function(lat, lng) {
      const destino = { lat: parseFloat(lat), lng: parseFloat(lng) };
      if(!isFinite(destino.lat) || !isFinite(destino.lng)) { alert('Destino inválido.'); return; }
      if(userLastLatLng) {
          dibujarRuta(userLastLatLng, destino, 'Ruta desde tu ubicación');
      } else {
          mostrarPanelNavegacion('📍 Activa primero el GPS o usa <b>Ruta manual</b> para elegir origen y destino en el mapa.');
      }
  };

  window.activarModoRutaManual = function() {
      modoRutaManual = !modoRutaManual;
      modoSimuladorGPS = false;
      rutaManualOrigen = null;
      const btnSim = document.getElementById('btn-sim-capture');
      if(btnSim) btnSim.classList.remove('active');
      document.getElementById('btn-route-mode').classList.toggle('active', modoRutaManual);
      mostrarPanelNavegacion(modoRutaManual ? '🧭 Modo ruta activo: toca primero el <b>origen</b> y luego el <b>destino</b> en el mapa.' : 'Modo ruta desactivado.');
      actualizarSimuladorGPS();
  };

  function manejarClickRuta(latlng) {
      if(!rutaManualOrigen) {
          rutaManualOrigen = { lat: latlng.lat, lng: latlng.lng };
          rutaLayer.clearLayers();
          L.circleMarker([latlng.lat, latlng.lng], { radius: 8, color: '#fff', fillColor: '#2ed573', fillOpacity: 1, weight: 2 }).addTo(rutaLayer).bindPopup('Origen').openPopup();
          mostrarPanelNavegacion('✅ Origen seleccionado. Ahora toca el <b>destino</b>.');
          return;
      }
      const destino = { lat: latlng.lat, lng: latlng.lng };
      dibujarRuta(rutaManualOrigen, destino, 'Ruta manual');
      modoRutaManual = false;
      document.getElementById('btn-route-mode').classList.remove('active');
  }

  window.iniciarRastreoGPS = function() {
      if(!navigator.geolocation) { alert('Tu navegador no soporta geolocalización.'); return; }
      const btnGps = document.getElementById('btn-gps');
      if(btnGps) btnGps.classList.add('active');
      if(userWatchId !== null) return;
      userWatchId = navigator.geolocation.watchPosition(pos => {
          if((pos.coords.accuracy || 0) > 45) return; // ignorar lecturas con error > 45 m
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          userLastLatLng = { lat, lng, accuracy: pos.coords.accuracy || 0 };

          if(urbisRouteFocusActive && urbisNavRouteState) {
              // En navegación real NO dibujamos la línea verde cruda del GPS.
              // El GPS se ajusta a la polilínea calculada y la ruta se consume visualmente.
              userTraceLayer.clearLayers();
              if(userPositionMarker) userPositionMarker.addTo(userTraceLayer);
              actualizarProgresoRutaPorGPS(userLastLatLng);
          } else {
              gpsTrail.push([lat, lng]);
              if(!userPositionMarker) {
                  userPositionMarker = L.marker([lat, lng], { icon: L.divIcon({ className: '', html: '<div class="gps-dot"></div>', iconSize: [24,24], iconAnchor: [12,12] }) }).addTo(userTraceLayer).bindPopup('Tu ubicación actual');
                  if(!window.__urbisMobileMapFreeMode) map.setView([lat, lng], 17);
              } else {
                  userPositionMarker.setLatLng([lat, lng]);
              }
              userTraceLayer.clearLayers();
              userPositionMarker.addTo(userTraceLayer);
              // V47: se elimina el rastro verde largo porque en móvil se veía como una ruta falsa.
              // El recorrido deportivo/runner usa su propia línea naranja; la navegación usa progreso gris/celeste.
              if(gpsTrail.length > 1 && !urbisRouteFocusActive) {
                  // Mantener GPS liviano: solo la posición actual.
              }
              mostrarPanelNavegacion(`📍 GPS activo<br>Precisión aproximada: <b>${Math.round(pos.coords.accuracy || 0)} m</b>`);
          }
          if(typeof actualizarVozGuiaPorGPS === 'function') actualizarVozGuiaPorGPS(userLastLatLng);
      }, error => {
          const btnGps = document.getElementById('btn-gps');
          if(btnGps) btnGps.classList.remove('active');
          alert('No se pudo activar el GPS. Revisa permisos de ubicación del navegador.');
          console.error(error);
      }, { enableHighAccuracy: true, maximumAge: 500, timeout: 10000 });
  };

  window.detenerRastreoGPS = function() {
      if(userWatchId !== null) { navigator.geolocation.clearWatch(userWatchId); userWatchId = null; }
      document.getElementById('btn-gps').classList.remove('active');
      mostrarPanelNavegacion('⏹️ GPS detenido. La ruta dibujada permanece hasta que limpies el mapa o recargues.');
  };



  const ROUTE_REAL_MODES = {
      walking: { nombre: 'A pie', emoji: '🚶', perfil: 'foot', color: '#19ebff', velocidadKmh: 4.6, ajuste: 1.00, nota: 'Prioriza pasos peatonales y calles caminables cuando el servicio lo permite.' },
      bike: { nombre: 'Bicicleta', emoji: '🚲', perfil: 'bike', color: '#b8ebe6', velocidadKmh: 13, ajuste: 1.05, nota: 'Ruta pensada para bicicleta; puede variar según disponibilidad de ciclorrutas.' },
      bus: { nombre: 'Bus', emoji: '🚌', perfil: 'driving', color: '#feca57', velocidadKmh: 15, ajuste: 1.35, nota: 'Aproximación por vías vehiculares; suma tiempo por paradas y espera.' },
      motorcycle: { nombre: 'Moto', emoji: '🏍️', perfil: 'driving', color: '#ff9f43', velocidadKmh: 27, ajuste: .95, nota: 'Aproximación por vías vehiculares con menor tiempo estimado por agilidad.' },
      car: { nombre: 'Carro', emoji: '🚗', perfil: 'driving', color: '#f5bfd6', velocidadKmh: 22, ajuste: 1.15, nota: 'Ruta vehicular aproximada por calles y avenidas disponibles.' }
  };



  // ==========================================
  // VOZ GPS URBIS: guía hablada tipo navegación
  // Usa Web Speech API del navegador. No requiere backend.
  // ==========================================
  let urbisVoiceGuideEnabled = true;
  let urbisVoiceLastText = '';
  let urbisVoiceLastAt = 0;
  let urbisVoiceLastStepKey = '';
  let urbisVoiceAlertKeys = new Set();
  let urbisVoiceAlertIndex = [];
  let urbisVoiceMobilitySessionId = null;
  let urbisVoiceIntroDone = false;
  let urbisVoiceRouteInstructions = [];
  let urbisVoiceUpcomingIndex = -1;

  function registrarDatoMovilidadUrbis(tipo, payload = {}) {
      // V63: registro local honesto para futura analítica/senso URBIS.
      // No reemplaza Excel/SheetDB; guarda eventos mínimos para sincronizar después.
      try {
          const key = 'urbis_mobility_voice_events_v63';
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          list.push({
              id: `mob-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
              sessionId: urbisVoiceMobilitySessionId || 'sin_sesion',
              tipo,
              at: new Date().toISOString(),
              payload
          });
          localStorage.setItem(key, JSON.stringify(list.slice(-350)));
      } catch(e) {}
  }

  function obtenerVozGuiaUrbis() {
      if(!('speechSynthesis' in window)) return null;
      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      if(!voices || !voices.length) return null;
      const esVoices = voices.filter(v => String(v.lang || '').toLowerCase().startsWith('es'));
      const nombresFemeninos = ['sabina','helena','elvira','dalia','paulina','monica','mónica','laura','maria','maría','sofia','sofía','female','mujer'];
      return esVoices.find(v => nombresFemeninos.some(n => String(v.name || '').toLowerCase().includes(n))) ||
             esVoices.find(v => String(v.lang || '').toLowerCase().includes('co')) ||
             esVoices[0] ||
             voices[0];
  }

  function hablarGuiaUrbis(texto, prioridad = false) {
      if(!urbisVoiceGuideEnabled) return;
      if(!('speechSynthesis' in window)) return;
      const limpio = String(texto || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if(!limpio) return;
      const ahora = Date.now();
      if(!prioridad && limpio === urbisVoiceLastText && ahora - urbisVoiceLastAt < 9000) return;
      if(!prioridad && ahora - urbisVoiceLastAt < 4500) return;
      try {
          if(prioridad) window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(limpio);
          const voice = obtenerVozGuiaUrbis();
          if(voice) u.voice = voice;
          u.lang = (voice && voice.lang) || 'es-CO';
          u.rate = 0.96;
          u.pitch = 1.06;
          u.volume = 0.96;
          window.speechSynthesis.speak(u);
          registrarDatoMovilidadUrbis('voz_emitida', { texto: limpio, prioridad: !!prioridad });
          urbisVoiceLastText = limpio;
          urbisVoiceLastAt = ahora;
      } catch(e) {
          console.warn('Voz guía no disponible', e);
      }
  }

  window.toggleUrbisVoiceGuide = function() {
      urbisVoiceGuideEnabled = !urbisVoiceGuideEnabled;
      try { window.speechSynthesis.cancel(); } catch(e) {}
      const btns = document.querySelectorAll('.nav-voice-btn');
      btns.forEach(btn => {
          btn.classList.toggle('muted', !urbisVoiceGuideEnabled);
          btn.innerHTML = urbisVoiceGuideEnabled ? '🔊 Voz guía activa' : '🔇 Voz guía pausada';
      });
      if(urbisVoiceGuideEnabled) hablarGuiaUrbis('Voz guía activada.', true);
  };

  function textoIndicacionVoz(step) {
      if(!step) return 'Sigue por la ruta indicada.';
      const distancia = Math.round(Number(step.distance || 0));
      const indicacion = textoIndicacionCiudadana(step).replace(/\.$/, '');
      if(distancia > 0 && distancia < 1000) return `En ${distancia} metros, ${indicacion.toLowerCase()}.`;
      if(distancia >= 1000) return `En ${(distancia/1000).toFixed(1)} kilómetros, ${indicacion.toLowerCase()}.`;
      return indicacion;
  }


  function formatearDistanciaVoz(metros) {
      const m = Math.max(0, Number(metros || 0));
      if(m >= 1000) return `${(m / 1000).toFixed(m >= 2000 ? 0 : 1)} kilómetros`;
      if(m >= 100) return `${Math.round(m / 10) * 10} metros`;
      return `${Math.round(m / 5) * 5} metros`;
  }

  function textoCortoManiobraUrbis(tipo, modificador, nombreVia = '') {
      const t = `${tipo || ''} ${modificador || ''}`.toLowerCase();
      const via = nombreVia ? ` por ${limpiarHTML(nombreVia)}` : '';
      if(t.includes('arrive')) return 'Llegaste a tu destino';
      if(t.includes('depart')) return via ? `Empieza el recorrido${via}` : 'Empieza el recorrido';
      if(t.includes('roundabout') || t.includes('rotary')) return via ? `Toma la glorieta y continúa${via}` : 'Toma la glorieta y continúa';
      if(t.includes('uturn')) return 'Haz un retorno con precaución';
      if(t.includes('sharp right')) return via ? `Gira fuerte a la derecha${via}` : 'Gira fuerte a la derecha';
      if(t.includes('sharp left')) return via ? `Gira fuerte a la izquierda${via}` : 'Gira fuerte a la izquierda';
      if(t.includes('slight right')) return via ? `Mantente a la derecha${via}` : 'Mantente a la derecha';
      if(t.includes('slight left')) return via ? `Mantente a la izquierda${via}` : 'Mantente a la izquierda';
      if(t.includes('right')) return via ? `Gira a la derecha${via}` : 'Gira a la derecha';
      if(t.includes('left')) return via ? `Gira a la izquierda${via}` : 'Gira a la izquierda';
      if(t.includes('straight') || t.includes('continue')) return via ? `Continúa derecho${via}` : 'Continúa derecho';
      return via ? `Continúa${via}` : 'Continúa';
  }

  function proyectarPuntoARutaCompleta(punto, state) {
      if(!punto || !state || !state.pts || state.pts.length < 2) return null;
      const refLat = Number(punto.lat);
      const g = latLngToLocalMeters(punto, refLat);
      let best = null;
      for(let i = 0; i < state.pts.length - 1; i++) {
          const a = latLngToLocalMeters(state.pts[i], refLat);
          const b = latLngToLocalMeters(state.pts[i + 1], refLat);
          const vx = b.x - a.x;
          const vy = b.y - a.y;
          const len2 = vx * vx + vy * vy;
          const t = Math.max(0, Math.min(1, len2 > 0 ? ((g.x - a.x) * vx + (g.y - a.y) * vy) / len2 : 0));
          const px = a.x + vx * t;
          const py = a.y + vy * t;
          const dist = Math.hypot(g.x - px, g.y - py);
          const segLen = Math.max(0, state.cumulative[i + 1] - state.cumulative[i]);
          const routeDistance = state.cumulative[i] + segLen * t;
          if(!best || dist < best.dist) best = { index:i, t, dist, routeDistance };
      }
      return best;
  }

  function bearingEntrePuntos(a, b) {
      const lat1 = Number(a.lat) * Math.PI / 180;
      const lat2 = Number(b.lat) * Math.PI / 180;
      const dLng = (Number(b.lng) - Number(a.lng)) * Math.PI / 180;
      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function normalizarDiferenciaAngulo(a, b) {
      return ((b - a + 540) % 360) - 180;
  }

  function generarInstruccionesBetaDesdePolilinea(state) {
      if(!state || !state.pts || state.pts.length < 5) return [];
      const instrucciones = [];
      let ultimoGiroM = -999;
      for(let i = 2; i < state.pts.length - 2; i++) {
          const distRuta = state.cumulative[i] || 0;
          if(distRuta < 45 || state.total - distRuta < 35) continue;
          if(distRuta - ultimoGiroM < 55) continue;
          const prev = state.pts[Math.max(0, i - 2)];
          const cur = state.pts[i];
          const next = state.pts[Math.min(state.pts.length - 1, i + 2)];
          const b1 = bearingEntrePuntos(prev, cur);
          const b2 = bearingEntrePuntos(cur, next);
          const diff = normalizarDiferenciaAngulo(b1, b2);
          const abs = Math.abs(diff);
          if(abs < 38) continue;
          const direccion = diff > 0 ? 'izquierda' : 'derecha';
          const fuerte = abs > 95 ? ' fuerte' : '';
          instrucciones.push({
              id: `beta-${i}`,
              source: 'beta',
              routeDistance: distRuta,
              pointIndex: i,
              text: `Gira${fuerte} a la ${direccion}`,
              shortText: `Giro a la ${direccion}`,
              icon: direccion === 'derecha' ? '↱' : '↰',
              announced: {}
          });
          ultimoGiroM = distRuta;
      }
      instrucciones.push({
          id: 'beta-arrive',
          source: 'beta',
          routeDistance: Math.max(0, state.total - 8),
          pointIndex: state.pts.length - 1,
          text: 'Llegaste a tu destino',
          shortText: 'Llegada',
          icon: '🏁',
          announced: {}
      });
      return instrucciones;
  }

  function prepararInstruccionesVozRuta(route) {
      const state = urbisNavRouteState;
      urbisVoiceRouteInstructions = [];
      urbisVoiceAlertIndex = [];
      urbisVoiceUpcomingIndex = -1;
      urbisVoiceLastStepKey = '';
      if(!state || !route) return [];
      const steps = route.legs && route.legs[0] ? (route.legs[0].steps || []) : [];
      const desdePasos = [];
      steps.forEach((step, idx) => {
          const maneuver = step.maneuver || {};
          const loc = maneuver.location;
          if(!loc || loc.length < 2) return;
          const type = String(maneuver.type || '').toLowerCase();
          const modifier = String(maneuver.modifier || '').toLowerCase();
          const isUseful = idx === 0 || type.includes('arrive') || type.includes('turn') || type.includes('merge') || type.includes('roundabout') || type.includes('rotary') || modifier.includes('left') || modifier.includes('right') || modifier.includes('straight');
          if(!isUseful) return;
          const match = proyectarPuntoARutaCompleta({ lat: loc[1], lng: loc[0] }, state);
          if(!match) return;
          const text = textoCortoManiobraUrbis(type, modifier, step.name || '');
          if(idx > 0 && !type.includes('arrive') && match.routeDistance < 35) return;
          desdePasos.push({
              id: `step-${idx}`,
              source: 'osrm',
              routeDistance: match.routeDistance,
              pointIndex: match.index,
              text,
              shortText: text.replace(/ por .+$/, ''),
              icon: interpretarManiobra(type, modifier)[0],
              announced: {}
          });
      });
      let lista = desdePasos.length >= 2 ? desdePasos : generarInstruccionesBetaDesdePolilinea(state);
      lista = lista
          .sort((a,b) => a.routeDistance - b.routeDistance)
          .filter((inst, idx, arr) => idx === 0 || Math.abs(inst.routeDistance - arr[idx - 1].routeDistance) > 25 || String(inst.text).includes('Llegaste'));
      urbisVoiceRouteInstructions = lista;
      return lista;
  }

  function obtenerProximaInstruccionRuta(distanceM) {
      const d = Number(distanceM || 0);
      return (urbisVoiceRouteInstructions || []).find(inst => inst.routeDistance >= d + 8) || null;
  }

  function actualizarTarjetaProximaInstruccion(inst, metrosRestantes) {
      const overlay = document.getElementById('urbis-navigation-overlay');
      if(!overlay || !inst) return;
      const iconBox = overlay.querySelector('.nav-live-arrow');
      const titleBox = overlay.querySelector('.nav-live-next b');
      const detailBox = overlay.querySelector('.nav-live-next span');
      if(iconBox) iconBox.textContent = inst.icon || '↱';
      if(titleBox) titleBox.textContent = inst.shortText || inst.text;
      if(detailBox) detailBox.textContent = metrosRestantes <= 25 ? 'Ahora' : `En ${formatearDistanciaVoz(metrosRestantes)}`;
  }

  function revisarIndicacionesVozRutaPorProgreso() {
      if(!urbisRouteFocusActive || !urbisNavRouteState || !urbisVoiceRouteInstructions.length) return;
      const d = urbisNavRouteState.currentDistance || 0;
      const inst = obtenerProximaInstruccionRuta(d);
      if(!inst) return;
      const faltan = Math.max(0, inst.routeDistance - d);
      actualizarTarjetaProximaInstruccion(inst, faltan);
      const hitos = inst.text && inst.text.includes('Llegaste') ? [80, 25] : [800, 400, 200, 100, 50, 20];
      for(const h of hitos) {
          if(faltan <= h && !inst.announced[h]) {
              inst.announced[h] = true;
              const texto = inst.text && inst.text.includes('Llegaste')
                  ? (h <= 25 ? 'Llegaste a tu destino.' : `En ${formatearDistanciaVoz(faltan)}, llegarás a tu destino.`)
                  : (h <= 20 ? `${inst.text}.` : `En ${formatearDistanciaVoz(faltan)}, ${String(inst.text).toLowerCase()}.`);
              hablarGuiaUrbis(texto, h <= 20 || (inst.text && inst.text.includes('Llegaste') && h <= 25));
              registrarDatoMovilidadUrbis('instruccion_anunciada', {
                  id: inst.id,
                  texto: inst.text,
                  faltanM: Math.round(faltan),
                  hitoM: h,
                  source: inst.source || 'beta'
              });
              break;
          }
      }
  }

  function anunciarInicioRutaUrbis(route) {
      const modo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
      const distancia = route && route.distance ? formatoDistancia(route.distance) : 'la ruta';
      const duracion = route ? formatoTiempoMin(calcularDuracionAjustada(route.duration || 0, route.distance || 0)) : 'unos minutos';
      const primera = (urbisVoiceRouteInstructions || []).find(i => i.routeDistance > 25);
      const primeraTxt = primera ? `Próxima indicación: ${primera.text}.` : 'Sigue la ruta marcada en el mapa.';
      urbisVoiceIntroDone = true;
      hablarGuiaUrbis(`Recorrido iniciado. Modo ${modo.nombre}. Distancia aproximada ${distancia}. Tiempo estimado ${duracion}. ${primeraTxt}`, true);
  }

  function obtenerPuntosControlVialCercanos(punto, radio = 180) {
      if(!punto || !Array.isArray(controlVialData)) return [];
      return controlVialData.filter(c => distanciaMetros(punto, { lat:Number(c.lat), lng:Number(c.lng) }) <= radio);
  }

  function obtenerReportesMovilidadCercanos(punto, radio = 220) {
      if(!punto || !Array.isArray(globalData)) return [];
      return globalData.filter(p => {
          const lat = parseFloat(String(p.lat).replace(',', '.'));
          const lng = parseFloat(String(p.lng).replace(',', '.'));
          if(!isFinite(lat) || !isFinite(lng)) return false;
          if(!esPuntoMovilidadParaRuta(p)) return false;
          return distanciaMetros(punto, {lat, lng}) <= radio;
      });
  }

  function normalizarTipoAlertaMovilidadUrbis(p) {
      const d = String(p && p.descripcion ? p.descripcion : '').split(' | ');
      const texto = `${p?.tipo || ''} ${d[0] || ''} ${d[1] || ''} ${d[2] || ''}`.toLowerCase();
      if(texto.includes('cámara') || texto.includes('camara') || texto.includes('fotomulta')) return { tipo:'camara', prioridad:3, etiqueta:'cámara de seguridad o fotomulta' };
      if(texto.includes('retén') || texto.includes('reten')) return { tipo:'reten', prioridad:5, etiqueta:'retén' };
      if(texto.includes('cerrada') || texto.includes('bloqueada') || texto.includes('desvío') || texto.includes('desvio')) return { tipo:'cierre', prioridad:5, etiqueta:'cierre de vía' };
      if(texto.includes('accidente') || texto.includes('choque')) return { tipo:'accidente', prioridad:5, etiqueta:'accidente' };
      if(texto.includes('hueco') || texto.includes('bache')) return { tipo:'hueco', prioridad:4, etiqueta:'hueco o bache' };
      if(texto.includes('inund') || texto.includes('drenaje')) return { tipo:'inundacion', prioridad:4, etiqueta:'zona de inundación' };
      if(texto.includes('tráfico') || texto.includes('trafico') || texto.includes('congest')) return { tipo:'trafico', prioridad:3, etiqueta:'tráfico' };
      if(texto.includes('semáforo') || texto.includes('semaforo')) return { tipo:'semaforo', prioridad:3, etiqueta:'semáforo con novedad' };
      return { tipo:'movilidad', prioridad:2, etiqueta:'alerta de movilidad' };
  }

  function puntoAlertaMovilidadUrbis(p) {
      const lat = parseFloat(String(p && p.lat).replace(',', '.'));
      const lng = parseFloat(String(p && p.lng).replace(',', '.'));
      if(!isFinite(lat) || !isFinite(lng)) return null;
      return { lat, lng };
  }

  function prepararIndiceAlertasMovilidadRuta() {
      urbisVoiceAlertIndex = [];
      if(!urbisNavRouteState) return [];
      const items = [];
      if(Array.isArray(globalData)) {
          globalData.forEach((p, idx) => {
              if(!esPuntoMovilidadParaRuta(p)) return;
              const punto = puntoAlertaMovilidadUrbis(p);
              if(!punto) return;
              const match = proyectarPuntoARutaCompleta(punto, urbisNavRouteState);
              if(!match || match.dist > 85) return; // solo alertas que caen cerca del corredor/ruta
              const meta = normalizarTipoAlertaMovilidadUrbis(p);
              items.push({
                  id: `rep-${idx}-${Math.round(punto.lat*100000)}-${Math.round(punto.lng*100000)}`,
                  origen: 'urbis',
                  routeDistance: match.routeDistance,
                  lateralM: match.dist,
                  point: punto,
                  meta,
                  raw: p,
                  announced: {}
              });
          });
      }
      if(Array.isArray(controlVialData)) {
          controlVialData.forEach((c, idx) => {
              const punto = { lat:Number(c.lat), lng:Number(c.lng) };
              if(!isFinite(punto.lat) || !isFinite(punto.lng)) return;
              const match = proyectarPuntoARutaCompleta(punto, urbisNavRouteState);
              if(!match || match.dist > 95) return;
              const isCamera = c.tipo === 'camera';
              items.push({
                  id: `control-${idx}-${String(c.tipo || 'control')}-${Math.round(punto.lat*100000)}-${Math.round(punto.lng*100000)}`,
                  origen: 'control_vial',
                  routeDistance: match.routeDistance,
                  lateralM: match.dist,
                  point: punto,
                  meta: isCamera
                      ? { tipo:'camara', prioridad:3, etiqueta:'cámara de seguridad o fotomulta' }
                      : { tipo:'reductor', prioridad:2, etiqueta:'reductor de velocidad' },
                  raw: c,
                  announced: {}
              });
          });
      }
      urbisVoiceAlertIndex = items
          .sort((a,b) => a.routeDistance - b.routeDistance || b.meta.prioridad - a.meta.prioridad)
          .filter((a, idx, arr) => idx === 0 || Math.abs(a.routeDistance - arr[idx-1].routeDistance) > 18 || a.meta.tipo !== arr[idx-1].meta.tipo);
      registrarDatoMovilidadUrbis('indice_alertas_preparado', { cantidad: urbisVoiceAlertIndex.length });
      return urbisVoiceAlertIndex;
  }

  function revisarAlertasMovilidadSobreRuta() {
      if(!urbisRouteFocusActive || !urbisNavRouteState) return;
      if(!urbisVoiceAlertIndex.length) prepararIndiceAlertasMovilidadRuta();
      const actual = Number(urbisNavRouteState.currentDistance || 0);
      urbisVoiceAlertIndex.forEach(alerta => {
          const faltan = alerta.routeDistance - actual;
          if(faltan < -20 || faltan > 420) return;
          const thresholds = alerta.meta.prioridad >= 5 ? [350, 180, 70] : alerta.meta.prioridad >= 4 ? [250, 90] : [180];
          for(const h of thresholds) {
              if(faltan <= h && !alerta.announced[h]) {
                  alerta.announced[h] = true;
                  const dist = formatearDistanciaVoz(Math.max(0, faltan));
                  const prefijo = alerta.meta.prioridad >= 5 ? 'Atención.' : 'Aviso.';
                  const texto = faltan <= 30
                      ? `${prefijo} ${alerta.meta.etiqueta} en este punto.`
                      : `${prefijo} ${alerta.meta.etiqueta} en ${dist}.`;
                  hablarGuiaUrbis(texto, alerta.meta.prioridad >= 5 && faltan <= 80);
                  registrarDatoMovilidadUrbis('alerta_movilidad_anunciada', {
                      tipo: alerta.meta.tipo,
                      etiqueta: alerta.meta.etiqueta,
                      faltanM: Math.round(faltan),
                      lateralM: Math.round(alerta.lateralM),
                      origen: alerta.origen
                  });
                  break;
              }
          }
      });
  }

  function nombreAlertaMovilidadUrbis(p) {
      const d = String(p && p.descripcion ? p.descripcion : '').split(' | ');
      const texto = `${p?.tipo || ''} ${d[0] || ''} ${d[1] || ''}`.toLowerCase();
      if(texto.includes('cámara') || texto.includes('camara') || texto.includes('fotomulta')) return 'cámara de seguridad o fotomulta cerca';
      if(texto.includes('retén') || texto.includes('reten')) return 'retén cercano';
      if(texto.includes('cerrada') || texto.includes('bloqueada')) return 'cierre de vía cercano';
      if(texto.includes('tráfico') || texto.includes('trafico') || texto.includes('congest')) return 'tráfico cercano';
      if(texto.includes('accidente') || texto.includes('choque')) return 'accidente cercano';
      if(texto.includes('hueco') || texto.includes('bache')) return 'hueco o bache cercano';
      if(texto.includes('inund') || texto.includes('drenaje')) return 'zona de inundación cercana';
      if(texto.includes('semáforo') || texto.includes('semaforo')) return 'semáforo con novedad cerca';
      return 'alerta de movilidad cercana';
  }

  function revisarAlertasVozRuta(punto) {
      // V63: prioridad a alertas URBIS SOBRE LA RUTA, no solo por radio circular.
      // Esto evita que la voz anuncie cosas de calles cercanas que no afectan el recorrido.
      revisarAlertasMovilidadSobreRuta();

      // Fallback: si no hay ruta indexada o el usuario está fuera de ruta, se usan cercanas reales.
      if(!urbisRouteFocusActive || !punto || (urbisVoiceAlertIndex && urbisVoiceAlertIndex.length)) return;
      const controles = obtenerPuntosControlVialCercanos(punto, 150);
      controles.slice(0, 1).forEach(c => {
          const key = `control-radial-${c.tipo}-${Math.round(c.lat*10000)}-${Math.round(c.lng*10000)}`;
          if(urbisVoiceAlertKeys.has(key)) return;
          urbisVoiceAlertKeys.add(key);
          const dist = Math.round(distanciaMetros(punto, {lat:Number(c.lat), lng:Number(c.lng)}));
          const texto = c.tipo === 'camera'
              ? `Aviso. Cámara de seguridad o fotomulta cerca, aproximadamente a ${dist} metros.`
              : `Aviso. Reductor de velocidad cerca, aproximadamente a ${dist} metros.`;
          hablarGuiaUrbis(texto);
      });

      const reportes = obtenerReportesMovilidadCercanos(punto, 170);
      reportes.slice(0, 1).forEach(r => {
          const key = `rep-radial-${r.lat}-${r.lng}-${String(r.tipo || '').slice(0,20)}`;
          if(urbisVoiceAlertKeys.has(key)) return;
          urbisVoiceAlertKeys.add(key);
          const dist = Math.round(distanciaMetros(punto, {lat:parseFloat(String(r.lat).replace(',', '.')), lng:parseFloat(String(r.lng).replace(',', '.'))}));
          hablarGuiaUrbis(`Aviso. ${nombreAlertaMovilidadUrbis(r)}, aproximadamente a ${dist} metros.`);
      });
  }


  function revisarIndicacionesVozRuta(punto) {
      // V62: las instrucciones ya no se basan en cercanía circular al giro.
      // Se leen según progreso real sobre la polilínea para avisar en 300/200/100/50/20 m.
      revisarIndicacionesVozRutaPorProgreso();
  }


  function actualizarVozGuiaPorGPS(punto) {
      revisarIndicacionesVozRutaPorProgreso();
      revisarAlertasVozRuta(punto);
  }


  // MODO RECORRIDO: cuando la persona inicia una ruta, la interfaz se limpia
  // y deja visibles solamente la guía de viaje + alertas de movilidad relevantes.
  let urbisRouteFocusActive = false;
  let urbisRouteChoiceActive = false;
  let urbisRouteFocusPreviousLayers = null;
  let urbisRouteGuideAnim = null;
  let urbisRouteGuideMarker = null;
  let urbisRouteGuideMeta = null;

  // V47 · Navegación real: map matching + progreso de ruta.
  // Reemplaza el puntito animado decorativo por una ruta que se consume:
  // opción A Google Maps: solo ruta restante celeste; sin tramo recorrido visible.
  let urbisNavRouteState = null;
  let urbisNavProgressLines = { completed: null, remainingHalo: null, remaining: null, remainingCore: null };
  let urbisNavSmoothedPoint = null;
  let urbisNavLastRecalcAt = 0;
  let urbisNavOffRouteSince = null;

  function esPuntoMovilidadParaRuta(p) {
      const d = String(p && p.descripcion ? p.descripcion : '').split(' | ');
      const elemento = d[0] || '';
      const texto = `${p?.tipo || ''} ${elemento} ${d[1] || ''} ${d[2] || ''}`.toLowerCase();
      return texto.includes('tráfico') || texto.includes('trafico') || texto.includes('congest') ||
             texto.includes('accidente') || texto.includes('choque') || texto.includes('retén') || texto.includes('reten') ||
             texto.includes('cerrada') || texto.includes('bloqueada') || texto.includes('desvío') || texto.includes('desvio') ||
             texto.includes('ruta bloqueada') || texto.includes('obra en vía') || texto.includes('obra en via') ||
             texto.includes('semáforo') || texto.includes('semaforo') || texto.includes('peligro vial') ||
             texto.includes('hueco') || texto.includes('bache') || texto.includes('inund') || texto.includes('drenaje') ||
             texto.includes('fuga') || texto.includes('cámara') || texto.includes('camara') || texto.includes('fotomulta') ||
             texto.includes('reductor') || texto.includes('policial');
  }

  function guardarCapasPreviasRuta() {
      urbisRouteFocusPreviousLayers = {};
      Object.keys(capas || {}).forEach(nombre => {
          try { urbisRouteFocusPreviousLayers[nombre] = map.hasLayer(capas[nombre]); } catch(e) {}
      });
      try { urbisRouteFocusPreviousLayers.__autoMapeo = map.hasLayer(autoMapeoCucutaLayer); } catch(e) {}
      try { urbisRouteFocusPreviousLayers.__zonas = map.hasLayer(zonasLayer); } catch(e) {}
      try { urbisRouteFocusPreviousLayers.__controlVial = map.hasLayer(controlVialLayer); } catch(e) {}
  }

  function aplicarCapasSoloMovilidadRuta() {
      // V69: modo Movilidad limpio. No se activan capas globales de tráfico/cámaras/alertas.
      // El tráfico se pinta únicamente sobre la ruta activa desde urbisMobilityTrafficRenderActiveRoute().
      Object.keys(capas || {}).forEach(nombre => {
          try { map.removeLayer(capas[nombre]); } catch(e) {}
          const check = document.querySelector(`input[data-layer="${CSS.escape(nombre)}"]`);
          if(check) check.checked = false;
      });
      try { if(autoMapeoCucutaLayer) map.removeLayer(autoMapeoCucutaLayer); } catch(e) {}
      try { if(zonasLayer) map.removeLayer(zonasLayer); } catch(e) {}
      try { if(controlVialLayer) map.removeLayer(controlVialLayer); } catch(e) {}
      if(typeof pintarPuntos === 'function') pintarPuntos([]);
      if(typeof urbisApplyProximityModeDebounced === 'function') urbisApplyProximityModeDebounced();
  }

  function restaurarCapasDespuesRuta() {
      if(urbisRouteFocusPreviousLayers) {
          Object.keys(capas || {}).forEach(nombre => {
              if(urbisRouteFocusPreviousLayers[nombre]) map.addLayer(capas[nombre]);
              else map.removeLayer(capas[nombre]);
              const check = document.querySelector(`input[data-layer="${CSS.escape(nombre)}"]`);
              if(check) check.checked = !!urbisRouteFocusPreviousLayers[nombre];
          });
          try { if(urbisRouteFocusPreviousLayers.__autoMapeo) map.addLayer(autoMapeoCucutaLayer); else map.removeLayer(autoMapeoCucutaLayer); } catch(e) {}
          try { if(urbisRouteFocusPreviousLayers.__zonas) map.addLayer(zonasLayer); else map.removeLayer(zonasLayer); } catch(e) {}
          try { if(urbisRouteFocusPreviousLayers.__controlVial) map.addLayer(controlVialLayer); else map.removeLayer(controlVialLayer); } catch(e) {}
      } else if(typeof aplicarPerfilCapasIniciales === 'function') {
          aplicarPerfilCapasIniciales();
      }
      if(typeof pintarPuntos === 'function') pintarPuntos(datosVisiblesActuales());
      if(typeof analizarZonasCiudadanas === 'function') setTimeout(() => analizarZonasCiudadanas(datosVisiblesActuales(), false), 80);
      urbisRouteFocusPreviousLayers = null;
  }


  function textoIndicacionCiudadana(step) {
      if(!step) return 'Sigue la ruta marcada en el mapa.';
      const nombreVia = step.name ? ` por ${limpiarHTML(step.name)}` : '';
      const maniobra = step.maneuver && step.maneuver.type ? String(step.maneuver.type) : '';
      const modificador = step.maneuver && step.maneuver.modifier ? String(step.maneuver.modifier) : '';
      if(maniobra.includes('arrive')) return 'Llegas a tu destino.';
      if(maniobra.includes('depart')) return `Empieza el recorrido${nombreVia}.`;
      if(modificador.includes('left')) return `Gira a la izquierda${nombreVia}.`;
      if(modificador.includes('right')) return `Gira a la derecha${nombreVia}.`;
      if(maniobra.includes('roundabout')) return `Toma la glorieta y continúa${nombreVia}.`;
      return `Continúa${nombreVia}.`;
  }

  function obtenerResumenRutaCiudadana(route) {
      const modo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
      const distancia = route && route.distance ? formatoDistancia(route.distance) : 'Ruta lista';
      const duracion = route ? formatoTiempoMin(calcularDuracionAjustada(route.duration || 0, route.distance || 0)) : 'Calculando';
      const steps = route && route.legs && route.legs[0] ? (route.legs[0].steps || []) : [];
      const siguiente = textoIndicacionCiudadana(steps[0]);
      const despues = steps[1] ? textoIndicacionCiudadana(steps[1]) : 'Mantente atento a las alertas del recorrido.';
      return { modo, distancia, duracion, siguiente, despues };
  }

  function crearOverlayNavegacionCiudadana(route) {
      let overlay = document.getElementById('urbis-navigation-overlay');
      if(!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'urbis-navigation-overlay';
          overlay.className = 'urbis-navigation-overlay';
          document.body.appendChild(overlay);
      }
      const resumen = obtenerResumenRutaCiudadana(route || routeRealLastResult);
      overlay.innerHTML = `
        <div class="nav-live-card">
          <div class="nav-live-top">
            <div>
              <span class="nav-live-kicker">Ruta en vivo</span>
              <strong>Guía para llegar</strong>
            </div>
            <button class="nav-live-close" onclick="limpiarRutaReal()" title="Cancelar recorrido">✕</button>
          </div>
          <div class="nav-live-next">
            <div class="nav-live-arrow">${resumen.modo.emoji}</div>
            <div>
              <b>${resumen.siguiente}</b>
              <span>${resumen.despues}</span>
            </div>
          </div>
          <div class="nav-live-metrics">
            <div><b>${resumen.duracion}</b><span>Tiempo aprox.</span></div>
            <div><b>${resumen.distancia}</b><span>Distancia</span></div>
            <div><b>${resumen.modo.nombre}</b><span>Modo</span></div>
          </div>
          <div class="nav-live-alert">
            <span>🚦</span>
            <p>Solo se muestra información relevante sobre la ruta activa: tráfico, cierres y condiciones viales disponibles.</p>
          </div>
          <div class="nav-live-actions">
            <button class="nav-voice-btn" onclick="toggleUrbisVoiceGuide()">${urbisVoiceGuideEnabled ? '🔊 Voz guía activa' : '🔇 Voz guía pausada'}</button>
            <button onclick="detenerRastreoGPS()">Pausar GPS</button>
            <button onclick="limpiarRutaReal()">Terminar ruta</button>
          </div>
        </div>`;
      requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  function quitarOverlayNavegacionCiudadana() {
      const overlay = document.getElementById('urbis-navigation-overlay');
      if(!overlay) return;
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 260);
  }

  function quitarOverlayInicioRecorridoCiudadano() {
      const overlay = document.getElementById('urbis-route-choice-overlay');
      if(!overlay) return;
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 260);
  }

  function crearOverlayInicioRecorridoCiudadano() {
      let overlay = document.getElementById('urbis-route-choice-overlay');
      if(!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'urbis-route-choice-overlay';
          overlay.className = 'urbis-route-choice-overlay';
          document.body.appendChild(overlay);
      }
      const modo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
      const destino = routeRealPointB ? formatoCoordRutaReal(routeRealPointB) : 'Destino seleccionado';
      const modosHTML = Object.keys(ROUTE_REAL_MODES).map(key => {
          const item = ROUTE_REAL_MODES[key];
          return `<button class="route-choice-mode ${key === routeRealMode ? 'active' : ''}" onclick="seleccionarModoRutaRealYComenzar('${key}')">
              <span>${item.emoji}</span><b>${item.nombre}</b>
          </button>`;
      }).join('');
      overlay.innerHTML = `
        <div class="route-choice-card">
          <div class="route-choice-kicker">Destino listo</div>
          <h2>¿Cómo quieres llegar?</h2>
          <p>URBIS usará tu ubicación actual como salida y te mostrará solo lo importante para moverte: ruta, tráfico disponible y alternativas reales cuando existan datos.</p>
          <div class="route-choice-destination"><span>🎯</span><div><b>Destino</b><small>${destino}</small></div></div>
          <button class="route-choice-start" onclick="calcularRutaRealActual()">🚀 Iniciar recorrido</button>
          <div class="route-choice-label">O elige una forma de moverte</div>
          <div class="route-choice-modes">${modosHTML}</div>
          <button class="route-choice-cancel" onclick="limpiarRutaReal()">Cancelar</button>
          <div class="route-choice-current">Modo seleccionado: <b>${modo.emoji} ${modo.nombre}</b></div>
        </div>`;
      requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  window.activarModoPrepararRecorridoUrbis = function() {
      if(!urbisRouteChoiceActive && !urbisRouteFocusActive) {
          urbisRouteChoiceActive = true;
          guardarCapasPreviasRuta();
      } else if(urbisRouteFocusActive) {
          return;
      }
      document.body.classList.add('route-choice-active');
      document.body.classList.remove('route-focus-active');
      aplicarCapasSoloMovilidadRuta();
      crearOverlayInicioRecorridoCiudadano();
      if(typeof setSidebarTab === 'function') setSidebarTab('mobility');
      setTimeout(() => { try { map.invalidateSize(); } catch(e) {} }, 320);
  };

  window.desactivarModoPrepararRecorridoUrbis = function(restaurar = true) {
      if(!urbisRouteChoiceActive) return;
      urbisRouteChoiceActive = false;
      document.body.classList.remove('route-choice-active');
      quitarOverlayInicioRecorridoCiudadano();
      if(restaurar) restaurarCapasDespuesRuta();
      setTimeout(() => { try { map.invalidateSize(); } catch(e) {} }, 320);
  };

  window.seleccionarModoRutaRealYComenzar = function(modo) {
      routeRealMode = modo;
      actualizarUIRutaReal();
      crearOverlayInicioRecorridoCiudadano();
      calcularRutaRealActual();
  };

  window.activarModoRecorridoUrbis = function() {
      if(urbisRouteChoiceActive) desactivarModoPrepararRecorridoUrbis(false);
      if(!urbisRouteFocusActive) {
          urbisRouteFocusActive = true;
          if(!urbisRouteFocusPreviousLayers) guardarCapasPreviasRuta();
          document.body.classList.add('route-focus-active');
          document.body.classList.remove('route-choice-active');
      }
      const panel = document.getElementById('route-real-panel');
      if(panel) panel.classList.add('route-focus-card');
      aplicarCapasSoloMovilidadRuta();
      crearOverlayNavegacionCiudadana(routeRealLastResult);
      urbisVoiceAlertKeys = new Set();
      urbisVoiceAlertIndex = [];
      urbisVoiceMobilitySessionId = `route-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      urbisVoiceLastStepKey = '';
      try { prepararIndiceAlertasMovilidadRuta(); } catch(e) {}
      registrarDatoMovilidadUrbis('ruta_iniciada', { modo: routeRealMode, destino: routeRealPointB || null });
      // V69: no cargar cámaras/fotomultas automáticamente. Se ocultan hasta tener flujo real de producto.
      if(routeRealLastResult && !urbisVoiceIntroDone) anunciarInicioRutaUrbis(routeRealLastResult);
      // En navegación se activa el GPS continuo para consumir la ruta con map matching.
      try { iniciarRastreoGPS(); } catch(e) { console.warn('No se pudo iniciar GPS continuo', e); }
      if(userLastLatLng) {
          actualizarProgresoRutaPorGPS(userLastLatLng);
          actualizarVozGuiaPorGPS(userLastLatLng);
      }
      if(typeof setSidebarTab === 'function') setSidebarTab('mobility');
      setTimeout(() => { try { map.invalidateSize(); } catch(e) {} }, 320);
  };

  window.desactivarModoRecorridoUrbis = function() {
      if(urbisRouteChoiceActive) {
          desactivarModoPrepararRecorridoUrbis(false);
      }
      if(!urbisRouteFocusActive) {
          restaurarCapasDespuesRuta();
          return;
      }
      urbisRouteFocusActive = false;
      document.body.classList.remove('route-focus-active');
      try { if('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch(e) {}
      urbisVoiceIntroDone = false;
      quitarOverlayNavegacionCiudadana();
      quitarOverlayInicioRecorridoCiudadano();
      const panel = document.getElementById('route-real-panel');
      if(panel) panel.classList.remove('route-focus-card');
      restaurarCapasDespuesRuta();
      setTimeout(() => { try { map.invalidateSize(); } catch(e) {} }, 320);
  };


  function actualizarCabeceraModoUrbis(tab) {
      const meta = {
          mobility: {
              kicker: 'Modo movilidad',
              title: 'Movilidad',
              subtitle: 'Rutas, GPS, tránsito y herramientas en tiempo real para desplazarte mejor.'
          },
          sport: {
              kicker: 'Modo deportivo',
              title: 'Deporte',
              subtitle: 'Actividad física, rutas, rutina, progreso e historial con una experiencia enfocada al entrenamiento.'
          },
          alerts: {
              kicker: 'Modo alertas',
              title: 'Alertas',
              subtitle: 'Reporta, consulta y sigue incidencias ciudadanas con la menor distracción posible.'
          },
          access: {
              kicker: 'Modo perfil',
              title: 'Mi perfil',
              subtitle: 'Tus datos, permisos, logros y configuración personal en un solo espacio.'
          },
          events: {
              kicker: 'Modo eventos',
              title: 'Eventos',
              subtitle: 'Descubre actividades, comunidad y experiencias especiales publicadas en URBIS.'
          },
          stats: {
              kicker: 'Modo datos',
              title: 'Datos',
              subtitle: 'Indicadores, gráficas y análisis visual para comprender mejor el territorio.'
          },
          mapping: {
              kicker: 'Modo capas',
              title: 'Capas',
              subtitle: 'Mapas, visualización y lectura espacial con enfoque técnico y territorial.'
          },
          advanced: {
              kicker: 'Modo avanzado',
              title: 'Avanzado',
              subtitle: 'Herramientas raster, análisis técnico y opciones especializadas para usuarios expertos.'
          },
          mascotas: {
              kicker: 'Modo mascotas',
              title: 'Patitas URBIS',
              subtitle: 'Fundación animalista: rescata, dona y da hogar a perritos y gaticos de Cúcuta.'
          }
      };
      const cfg = meta[tab] || meta.mobility;
      const setText = (id, value) => {
          const el = document.getElementById(id);
          if(el) el.textContent = value;
      };
      setText('module-focus-kicker', cfg.kicker);
      setText('module-focus-title', cfg.title);
      setText('module-focus-subtitle', cfg.subtitle);
  }

  window.volverMenuModulos = function() {
      document.body.classList.remove('module-focused');
      document.body.classList.remove('sport-runner-active');
      document.body.setAttribute('data-active-module', 'menu');
      document.querySelectorAll('.sidebar-page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
      const shell = document.getElementById('module-focus-shell');
      if(shell) shell.setAttribute('hidden', '');
      const runnerMode = document.getElementById('sport-runner-mode');
      if(runnerMode) runnerMode.setAttribute('hidden', '');
      const sidebar = document.getElementById('sidebar');
      if(sidebar) sidebar.scrollTop = 0;
      setTimeout(() => { try { map.invalidateSize(); } catch(e) {} }, 120);
  };

  window.setSidebarTab = function(tab) {
      if((urbisRouteFocusActive || urbisRouteChoiceActive) && tab !== 'mobility') {
          tab = 'mobility';
      }
      if(tab === 'stats' && userRole === 'citizen') {
          tab = 'access';
      }
      document.body.classList.add('module-focused');
      document.body.classList.remove('sport-runner-active');
      const runnerMode = document.getElementById('sport-runner-mode');
      if(runnerMode) runnerMode.setAttribute('hidden', '');
      const shell = document.getElementById('module-focus-shell');
      if(shell) shell.removeAttribute('hidden');
      document.querySelectorAll('.sidebar-page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
      const page = document.getElementById(`page-${tab}`);
      const btn = document.getElementById(`tab-btn-${tab}`);
      if(page) page.classList.add('active');
      if(btn) btn.classList.add('active');
      document.body.setAttribute('data-active-module', tab);
      actualizarCabeceraModoUrbis(tab);
      const sidebar = document.getElementById('sidebar');
      if(sidebar) sidebar.scrollTo({ top: 0, behavior: 'smooth' });
      if(tab === 'stats') {
          setTimeout(() => {
              actualizarGraficos(datosVisiblesActuales());
              Object.values(charts).forEach(chart => { if(chart && chart.resize) chart.resize(); });
          }, 80);
      }
      if(tab === 'mapping') {
          setTimeout(() => analizarZonasCiudadanas(datosVisiblesActuales(), false), 80);
      }
      if(tab === 'events') {
          setTimeout(renderEventosUrbis, 80);
      }
      if(tab === 'alerts' && typeof window.urbisRenderSelectorCategorias === 'function') {
          if(window.__urbisSkipAlertsAutoRender) {
              // El propio clic en el mapa ya va a construir la vista CON ubicación
              // justo después de este setSidebarTab; no pisarla con la versión sin
              // coordenadas (ver comentario en js/10-visible-markers.js).
              window.__urbisSkipAlertsAutoRender = false;
          } else {
              setTimeout(window.urbisRenderSelectorCategorias, 80);
          }
      }
      if(tab === 'mapeotecnico' && typeof window.urbisRenderSelectorTecnico === 'function') {
          // El mapa nunca cambia a esta pestaña por su cuenta (siempre vuelve a
          // 'alerts' para mostrar el formulario), así que no hay condición de
          // carrera aquí: siempre se puede refrescar sin bandera de exclusión.
          setTimeout(window.urbisRenderSelectorTecnico, 80);
      }
      if(tab === 'sport' && typeof renderSportModuleUrbis === 'function') {
          setTimeout(renderSportModuleUrbis, 80);
      }
      if(tab === 'access' && typeof renderAchievementsProfile === 'function') {
          setTimeout(renderAchievementsProfile, 80);
      }
      if(tab === 'mascotas' && typeof renderMascotasModulo === 'function') {
          setTimeout(renderMascotasModulo, 80);
      }
      setTimeout(() => { try { map.invalidateSize(); } catch(e) {} }, 120);

      // V101: activar click directo en mapa al entrar a movilidad
      if (tab === 'mobility') {
          setTimeout(function() {
              try {
                  if (window.URBIS_MOBILITY_V97 && typeof window.URBIS_MOBILITY_V97.show === 'function') {
                      window.URBIS_MOBILITY_V97.show();
                  }
                  // Conectar click directo al mapa de Leaflet
                  var m = window.map || window.urbisMap;
                  if (m && typeof m.on === 'function' && !m._u101direct) {
                      m.on('click', function(ev) {
                          if (document.body.getAttribute('data-active-module') !== 'mobility') return;
                          if (!ev || !ev.latlng) return;
                          var raw = ev.originalEvent;
                          if (raw && raw.target && raw.target.closest) {
                              if (raw.target.closest('#u88-mobility-shell')) return;
                              if (raw.target.closest('button,input,a,.leaflet-control')) return;
                          }
                          // Toggle: pin activo -> cancelar; sin pin -> colocar
                          var mobState = window.URBIS_MOBILITY_V97 && window.URBIS_MOBILITY_V97.state;
                          if (mobState && mobState.pendingDestination && mobState.destinationLatLng) {
                              if (typeof window.URBIS_MOBILITY_V97.cancelDestination === 'function') {
                                  window.URBIS_MOBILITY_V97.cancelDestination();
                              } else {
                                  // fallback directo
                                  if (mobState.destinationMarker) { try { m.removeLayer(mobState.destinationMarker); } catch(e){} }
                                  mobState.destinationMarker = null;
                                  mobState.destinationLatLng = null;
                                  mobState.pendingDestination = false;
                                  var fd = document.getElementById('u88-floating-destination');
                                  if (fd) fd.classList.remove('active');
                              }
                              return;
                          }
                          if (window.URBIS_MOBILITY_V97 && typeof window.URBIS_MOBILITY_V97.setDestination === 'function') {
                              window.URBIS_MOBILITY_V97.setDestination(ev.latlng.lat, ev.latlng.lng, 'Destino');
                          }
                      });
                      m._u101direct = true;
                  }
              } catch(e) { console.warn('V101 mobility click error:', e); }
          }, 400);
      }
  };


  document.addEventListener('DOMContentLoaded', () => {
      // Al entrar a la app, el usuario debe ver solo el menú de accesos.
      // Ningún modo se abre automáticamente.
      if(typeof window.volverMenuModulos === 'function') {
          window.volverMenuModulos();
      }
  });

  function actualizarDestinoRapido(lat, lng) {
      ultimoDestinoRapido = { lat: Number(lat), lng: Number(lng) };
      const card = document.getElementById('quick-route-card');
      const text = document.getElementById('quick-route-text');
      if(text) text.innerHTML = `Destino marcado: <b>${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}</b><br>Usaré tu GPS como origen y el modo de movilidad seleccionado.`;
      if(card) card.classList.add('visible');
  }

  function mostrarPopupLlegarAqui(lat, lng) {
      actualizarDestinoRapido(lat, lng);
      try { map.closePopup(); } catch(e) {}
      // Click/tap normal = registrar o consultar el punto.
      // NO inicia navegación automáticamente para no confundir reportes con destinos.
      // Para iniciar una ruta existen 2 caminos:
      // 1) mantener presionado el mapa durante 2 segundos; o
      // 2) usar el botón manual de la interfaz “Elegir destino”.
  }

  window.iniciarRutaRapidaUltimoPunto = function() {
      if(!ultimoDestinoRapido) { alert('Primero toca un punto del mapa para marcar el destino.'); return; }
      iniciarRutaRapidaAqui(ultimoDestinoRapido.lat, ultimoDestinoRapido.lng);
  };

  window.iniciarRutaRapidaAqui = async function(lat, lng) {
      routeRealPointB = { lat: Number(lat), lng: Number(lng) };
      routeRealAutoDestino = false;
      actualizarUIRutaReal();
      limpiarRutaRealVisual(true);
      renderResultadoRutaReal(`🎯 Destino listo. Elige cómo quieres moverte para iniciar la guía.`);
      if(typeof activarModoPrepararRecorridoUrbis === 'function') activarModoPrepararRecorridoUrbis();

      // Tomamos el GPS en segundo plano para que la transición sea inmediata.
      // Si el usuario pulsa iniciar antes de terminar, calcularRutaRealActual()
      // vuelve a pedir el GPS de forma segura.
      try {
          if(userLastLatLng) {
              routeRealPointA = { lat: userLastLatLng.lat, lng: userLastLatLng.lng };
          } else {
              const gps = await obtenerGPSUnaVezParaRuta();
              routeRealPointA = { lat: gps.lat, lng: gps.lng };
          }
          actualizarUIRutaReal();
      } catch(error) {
          console.warn('GPS pendiente para iniciar recorrido', error);
      }
  };

  function formatoCoordRutaReal(p) {
      if(!p) return 'Sin seleccionar';
      return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  }

  function actualizarUIRutaReal() {
      const a = document.getElementById('route-point-a');
      const b = document.getElementById('route-point-b');
      if(a) a.textContent = formatoCoordRutaReal(routeRealPointA);
      if(b) b.textContent = formatoCoordRutaReal(routeRealPointB);
      Object.keys(ROUTE_REAL_MODES).forEach(k => {
          const btn = document.getElementById(`mode-${k}`);
          if(btn) btn.classList.toggle('active', k === routeRealMode);
      });
  }

  function renderResultadoRutaReal(html) {
      const result = document.getElementById('route-real-result');
      if(result) result.innerHTML = html;
  }

  function contenidoMarcadorRutaReal(letra, clase) {
      if(letra === 'A' && routeRealLastResult) {
          const modo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
          return `<div class="route-point-badge route-point-start route-point-transport" title="Origen · ${modo.nombre}">${modo.emoji}</div>`;
      }
      if(letra === 'A') {
          return `<div class="route-point-badge route-point-start" title="Origen">📍</div>`;
      }
      return `<div class="route-point-badge route-point-end route-point-glow" title="Destino">🎯</div>`;
  }

  function crearMarcadorRutaReal(p, letra, clase, texto) {
      return L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className:'', html: contenidoMarcadorRutaReal(letra, clase), iconSize:[30,30], iconAnchor:[15,15] })
      }).addTo(rutaLayer).bindPopup(texto);
  }

  function limpiarRutaRealVisual(mantenerPuntos = true) {
      detenerFlujoOrganicoRuta();
      limpiarLineasProgresoRuta();
      rutaLayer.clearLayers();
      routeRealGeoJSON = null;
      routeRealSteps = [];
      routeRealLastResult = null;
      // V56 móvil: no se dibuja marcador verde de origen; el punto GPS real ya representa tu ubicación.
      if(mantenerPuntos && routeRealPointB) crearMarcadorRutaReal(routeRealPointB, 'B', 'route-point-b', 'Destino - Destino');
  }


  function detenerFlujoOrganicoRuta() {
      // V47: eliminamos el puntito decorativo. La guía visual ahora es progreso real de ruta.
      if(urbisRouteGuideAnim) {
          cancelAnimationFrame(urbisRouteGuideAnim);
          urbisRouteGuideAnim = null;
      }
      if(urbisRouteGuideMarker) {
          try { rutaLayer.removeLayer(urbisRouteGuideMarker); } catch(e) {}
          urbisRouteGuideMarker = null;
      }
      urbisRouteGuideMeta = null;
  }

  function iniciarFlujoOrganicoRuta(coords) {
      // No-op intencional. Antes animaba un punto; confundía al usuario porque no representaba avance real.
      detenerFlujoOrganicoRuta();
  }

  function crearEstadoNavegacionRuta(coords) {
      const pts = (coords || []).map(c => ({ lat: Number(c[0]), lng: Number(c[1]) })).filter(p => isFinite(p.lat) && isFinite(p.lng));
      const cumulative = [0];
      let total = 0;
      for(let i = 1; i < pts.length; i++) {
          total += map.distance([pts[i - 1].lat, pts[i - 1].lng], [pts[i].lat, pts[i].lng]);
          cumulative.push(total);
      }
      return {
          pts,
          cumulative,
          total: Math.max(total, 1),
          currentDistance: 0,
          currentIndex: 0,
          lastMatched: pts[0] || null,
          offRouteCount: 0,
          deviationM: 0
      };
  }

  function latLngToLocalMeters(p, refLat) {
      const lat = Number(p.lat ?? p[0]);
      const lng = Number(p.lng ?? p[1]);
      const kx = 111320 * Math.cos((refLat || lat) * Math.PI / 180);
      const ky = 110540;
      return { x: lng * kx, y: lat * ky, lat, lng };
  }

  function proyectarGPSARuta(puntoGPS, state) {
      if(!puntoGPS || !state || !state.pts || state.pts.length < 2) return null;
      const gps = { lat: Number(puntoGPS.lat), lng: Number(puntoGPS.lng) };
      if(!isFinite(gps.lat) || !isFinite(gps.lng)) return null;
      const refLat = gps.lat;
      const g = latLngToLocalMeters(gps, refLat);
      let best = null;
      const minIndex = Math.max(0, state.currentIndex - 4);
      const maxIndex = Math.min(state.pts.length - 2, state.currentIndex + 30);
      for(let i = minIndex; i <= maxIndex; i++) {
          const a = latLngToLocalMeters(state.pts[i], refLat);
          const b = latLngToLocalMeters(state.pts[i + 1], refLat);
          const vx = b.x - a.x;
          const vy = b.y - a.y;
          const len2 = vx * vx + vy * vy;
          const rawT = len2 > 0 ? ((g.x - a.x) * vx + (g.y - a.y) * vy) / len2 : 0;
          const t = Math.max(0, Math.min(1, rawT));
          const px = a.x + vx * t;
          const py = a.y + vy * t;
          const dx = g.x - px;
          const dy = g.y - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const segLen = Math.max(0, state.cumulative[i + 1] - state.cumulative[i]);
          const routeDistance = state.cumulative[i] + segLen * t;
          // Evita saltar demasiado hacia atrás por ruido GPS.
          const backwardPenalty = routeDistance + 10 < state.currentDistance ? (state.currentDistance - routeDistance) * 0.65 : 0;
          const score = dist + backwardPenalty;
          if(!best || score < best.score) {
              best = {
                  index: i,
                  t,
                  score,
                  deviationM: dist,
                  routeDistance,
                  point: {
                      lat: state.pts[i].lat + (state.pts[i + 1].lat - state.pts[i].lat) * t,
                      lng: state.pts[i].lng + (state.pts[i + 1].lng - state.pts[i].lng) * t
                  }
              };
          }
      }
      return best;
  }

  function obtenerPuntoEnDistanciaRuta(state, distanceM) {
      if(!state || !state.pts || !state.pts.length) return null;
      const d = Math.max(0, Math.min(distanceM, state.total));
      let idx = 1;
      while(idx < state.cumulative.length && state.cumulative[idx] < d) idx++;
      if(idx >= state.pts.length) return state.pts[state.pts.length - 1];
      const prev = state.cumulative[idx - 1];
      const seg = Math.max(1e-6, state.cumulative[idx] - prev);
      const t = (d - prev) / seg;
      const a = state.pts[idx - 1], b = state.pts[idx];
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  }

  function dividirRutaPorProgreso(state, distanceM) {
      const split = obtenerPuntoEnDistanciaRuta(state, distanceM);
      if(!split) return { completed: [], remaining: [] };
      let idx = 1;
      while(idx < state.cumulative.length && state.cumulative[idx] < distanceM) idx++;
      const completed = state.pts.slice(0, idx).map(p => [p.lat, p.lng]);
      completed.push([split.lat, split.lng]);
      const remaining = [[split.lat, split.lng], ...state.pts.slice(idx).map(p => [p.lat, p.lng])];
      return { completed, remaining };
  }

  function limpiarLineasProgresoRuta() {
      Object.values(urbisNavProgressLines || {}).forEach(layer => {
          try { if(layer && rutaLayer.hasLayer(layer)) rutaLayer.removeLayer(layer); } catch(e) {}
      });
      urbisNavProgressLines = { completed: null, remainingHalo: null, remaining: null, remainingCore: null };
      urbisNavRouteState = null;
      urbisNavSmoothedPoint = null;
      urbisNavOffRouteSince = null;
      if(typeof window.urbisMobilityTrafficClear === 'function') window.urbisMobilityTrafficClear();
      registrarDatoMovilidadUrbis('ruta_limpiada', { progresoM: urbisNavRouteState ? Math.round(urbisNavRouteState.currentDistance || 0) : 0 });
      urbisVoiceRouteInstructions = [];
      urbisVoiceAlertIndex = [];
      urbisVoiceUpcomingIndex = -1;
  }

  function crearLineasProgresoRuta(coords) {
      limpiarLineasProgresoRuta();
      urbisNavRouteState = crearEstadoNavegacionRuta(coords);
      const remaining = coords.map(c => [c[0], c[1]]);
      // Opción A estilo Google Maps: no se dibuja tramo recorrido; solo ruta restante.
      urbisNavProgressLines.completed = null;
      urbisNavProgressLines.remainingHalo = L.polyline(remaining, {
          color:'#2cecff', weight:22, opacity:.13, lineCap:'round', lineJoin:'round', interactive:false, className:'urbis-route-remaining-halo'
      }).addTo(rutaLayer);
      urbisNavProgressLines.remaining = L.polyline(remaining, {
          color:'#19ebff', weight:9, opacity:.96, lineCap:'round', lineJoin:'round', interactive:false, className:'urbis-route-remaining'
      }).addTo(rutaLayer);
      urbisNavProgressLines.remainingCore = L.polyline(remaining, {
          color:'#f7feff', weight:3.2, opacity:.92, lineCap:'round', lineJoin:'round', interactive:false, className:'urbis-route-remaining-core'
      }).addTo(rutaLayer);
  }

  function renderizarProgresoRuta(distanceM) {
      const state = urbisNavRouteState;
      if(!state) return;
      const parts = dividirRutaPorProgreso(state, distanceM);
      // Opción A: eliminar cualquier línea del tramo consumido o sombra antigua.
      try {
          if(urbisNavProgressLines.completed && rutaLayer.hasLayer(urbisNavProgressLines.completed)) {
              rutaLayer.removeLayer(urbisNavProgressLines.completed);
          }
          urbisNavProgressLines.completed = null;
          rutaLayer.eachLayer(layer => {
              const cn = layer?.options?.className || '';
              if(String(cn).includes('urbis-route-completed') || String(cn).includes('urbis-route-shadow')) {
                  rutaLayer.removeLayer(layer);
              }
          });
      } catch(_e) {}
      if(urbisNavProgressLines.remainingHalo) urbisNavProgressLines.remainingHalo.setLatLngs(parts.remaining);
      if(urbisNavProgressLines.remaining) urbisNavProgressLines.remaining.setLatLngs(parts.remaining);
      if(urbisNavProgressLines.remainingCore) urbisNavProgressLines.remainingCore.setLatLngs(parts.remaining);
      try {
          urbisNavProgressLines.remainingHalo && urbisNavProgressLines.remainingHalo.bringToFront && urbisNavProgressLines.remainingHalo.bringToFront();
          urbisNavProgressLines.remaining && urbisNavProgressLines.remaining.bringToFront && urbisNavProgressLines.remaining.bringToFront();
          urbisNavProgressLines.remainingCore && urbisNavProgressLines.remainingCore.bringToFront && urbisNavProgressLines.remainingCore.bringToFront();
      } catch(e) {}
  }

  function actualizarOverlayProgresoRuta() {
      if(!urbisNavRouteState) return;
      const remainingM = Math.max(0, urbisNavRouteState.total - urbisNavRouteState.currentDistance);
      const progress = Math.round((urbisNavRouteState.currentDistance / urbisNavRouteState.total) * 100);
      const overlay = document.getElementById('urbis-navigation-overlay');
      if(!overlay) return;
      const distBox = overlay.querySelector('.nav-live-metrics div:nth-child(2) b');
      if(distBox) distBox.textContent = formatoDistancia(remainingM);
      const alertBox = overlay.querySelector('.nav-live-alert p');
      if(alertBox) {
          if(urbisNavRouteState.deviationM > 60) alertBox.innerHTML = `Te estás alejando de la ruta (${Math.round(urbisNavRouteState.deviationM)} m). URBIS puede recalcular si continúa la desviación.`;
          else alertBox.innerHTML = `Avance aproximado: <b>${progress}%</b>. La línea celeste muestra únicamente lo que falta.`;
      }
  }

  function moverMarcadorUsuarioSuave(latlngObjetivo) {
      if(!latlngObjetivo) return;
      if(!userPositionMarker) {
          userPositionMarker = L.marker([latlngObjetivo.lat, latlngObjetivo.lng], {
              icon: L.divIcon({ className: '', html: '<div class="gps-dot gps-dot-navigation"></div>', iconSize: [24,24], iconAnchor: [12,12] }),
              interactive: false,
              zIndexOffset: 1600
          }).addTo(userTraceLayer).bindPopup('Tu ubicación actual');
      }
      const actual = userPositionMarker.getLatLng ? userPositionMarker.getLatLng() : latlngObjetivo;
      const alpha = 0.28;
      const smooth = urbisNavSmoothedPoint ? {
          lat: urbisNavSmoothedPoint.lat + (latlngObjetivo.lat - urbisNavSmoothedPoint.lat) * alpha,
          lng: urbisNavSmoothedPoint.lng + (latlngObjetivo.lng - urbisNavSmoothedPoint.lng) * alpha
      } : { lat: actual.lat + (latlngObjetivo.lat - actual.lat) * 0.55, lng: actual.lng + (latlngObjetivo.lng - actual.lng) * 0.55 };
      urbisNavSmoothedPoint = smooth;
      userPositionMarker.setLatLng([smooth.lat, smooth.lng]);
  }

  async function recalcularRutaPorDesviacion(puntoGPS) {
      if(!routeRealPointB || !puntoGPS) return;
      const now = Date.now();
      if(now - urbisNavLastRecalcAt < 16000) return;
      urbisNavLastRecalcAt = now;
      try {
          // Limpieza inmediata: la ruta vieja no debe convivir con la nueva.
          // Mientras URBIS calcula, se oculta la polilínea anterior para evitar doble ruta.
          try { limpiarRutaRealVisual(false); } catch(_e) {}
          try { limpiarLineasProgresoRuta(); } catch(_e) {}
          routeRealGeoJSON = null;
          routeRealPointA = { lat: puntoGPS.lat, lng: puntoGPS.lng };
          mostrarPanelNavegacion('🔄 Recalculando desde tu ubicación actual...');
          if(typeof hablarGuiaUrbis === 'function') hablarGuiaUrbis('Recalculando recorrido.', true);
          const route = await obtenerRutaReal(routeRealPointA, routeRealPointB);
          routeRealLastResult = route;
          pintarRutaReal(route);
          renderRutaReal(route);
          mostrarPanelNavegacion('🔄 Ruta recalculada. Continúa hacia el destino.');
      } catch(e) {
          console.warn('No se pudo recalcular ruta', e);
          mostrarPanelNavegacion('No se pudo recalcular. Mantén el GPS activo e inténtalo de nuevo.');
      }
  }

  function actualizarProgresoRutaPorGPS(puntoGPS) {
      if(!urbisRouteFocusActive || !urbisNavRouteState || !puntoGPS) return;
      const match = proyectarGPSARuta(puntoGPS, urbisNavRouteState);
      if(!match) return;
      urbisNavRouteState.deviationM = match.deviationM;
      if(match.deviationM <= 70) {
          urbisNavOffRouteSince = null;
          urbisNavRouteState.currentDistance = Math.max(urbisNavRouteState.currentDistance, match.routeDistance);
          urbisNavRouteState.currentIndex = Math.max(0, match.index);
          urbisNavRouteState.lastMatched = match.point;
          renderizarProgresoRuta(urbisNavRouteState.currentDistance);
          moverMarcadorUsuarioSuave(match.point);
          actualizarOverlayProgresoRuta();
          revisarIndicacionesVozRutaPorProgreso();
      } else {
          moverMarcadorUsuarioSuave(puntoGPS);
          if(!urbisNavOffRouteSince) urbisNavOffRouteSince = Date.now();
          actualizarOverlayProgresoRuta();
          if(Date.now() - urbisNavOffRouteSince > 8000) {
              urbisNavOffRouteSince = Date.now();
              recalcularRutaPorDesviacion(puntoGPS);
          }
      }
  }

  function interpretarManiobra(tipo, modificador) {
      const text = `${tipo || ''} ${modificador || ''}`.toLowerCase();
      if(text.includes('arrive')) return ['🏁', 'Llegada al destino'];
      if(text.includes('depart')) return ['🚩', 'Salida'];
      if(text.includes('left')) return ['↰', 'Gira a la izquierda'];
      if(text.includes('right')) return ['↱', 'Gira a la derecha'];
      if(text.includes('roundabout') || text.includes('rotary')) return ['🔄', 'Toma la glorieta'];
      if(text.includes('merge')) return ['🔀', 'Incorpórate a la vía'];
      if(text.includes('continue') || text.includes('straight')) return ['⬆️', 'Continúa derecho'];
      return ['➡️', 'Avanza por la ruta'];
  }

  function construirPasosPedagogicos(steps, modo, totalDistance) {
      const modoInfo = ROUTE_REAL_MODES[modo] || ROUTE_REAL_MODES.car;
      let html = `<div class="route-step-list">`;
      html += `<div class="route-step-item"><div class="route-step-icon">${modoInfo.emoji}</div><div><b>Modo seleccionado: ${modoInfo.nombre}</b><span>${modoInfo.nota}</span></div></div>`;
      const filtrados = (steps || []).slice(0, 5);
      if(!filtrados.length) {
          html += `<div class="route-step-item"><div class="route-step-icon">🧭</div><div><b>Recorrido por vías disponibles</b><span>El servicio devolvió geometría de ruta sin pasos detallados.</span></div></div>`;
      } else {
          filtrados.forEach((s, idx) => {
              const maneuver = s.maneuver || {};
              const [icon, label] = interpretarManiobra(maneuver.type, maneuver.modifier);
              const via = s.name ? ` por ${s.name}` : '';
              html += `<div class="route-step-item"><div class="route-step-icon">${icon}</div><div><b>${idx + 1}. ${label}${via}</b><span>${formatoDistancia(s.distance || 0)} aprox.</span></div></div>`;
          });
      }
      html += `</div>`;
      return html;
  }

  function primerPasoUtil(steps) {
      const lista = Array.isArray(steps) ? steps : [];
      return lista.find(s => (s.distance || 0) > 15 && s.maneuver && s.maneuver.type !== 'arrive') || lista[0] || null;
  }

  function construirNavegacionWaze(route, steps, modo, duracion) {
      const modoInfo = ROUTE_REAL_MODES[modo] || ROUTE_REAL_MODES.car;
      const paso = primerPasoUtil(steps);
      let icon = '🧭', label = 'Sigue la ruta marcada';
      let detalle = 'Mantente sobre la línea resaltada. La app puede recalcular si cambias el destino o el modo.';
      if(paso) {
          const maniobra = paso.maneuver || {};
          [icon, label] = interpretarManiobra(maniobra.type, maniobra.modifier);
          const via = paso.name ? ` por ${paso.name}` : '';
          detalle = `${formatoDistancia(paso.distance || 0)} aprox.${via}`;
      }
      return `
        <div class="waze-nav-card">
          <div class="waze-nav-head">
            <span class="waze-nav-title">Navegación tipo Waze</span>
            <span class="waze-nav-state">● Ruta activa</span>
          </div>
          <div class="waze-nav-metrics">
            <div class="waze-metric"><b>${formatoTiempoMin(duracion)}</b><span>ETA</span></div>
            <div class="waze-metric"><b>${formatoDistancia(route.distance || 0)}</b><span>Distancia</span></div>
            <div class="waze-metric"><b>${modoInfo.emoji}</b><span>${modoInfo.nombre}</span></div>
          </div>
          <div class="waze-route-sub urbis-route-traffic-status">Tráfico inteligente: <b>${textoTraficoEstimado()}</b>. ${route._alternatives && route._alternatives.length ? 'Ruta alternativa encontrada.' : 'Ruta más rápida disponible.'} Fuente configurable: Google Directions, Mapbox Traffic, HERE u OpenRouteService.</div>
          <div class="waze-next-step">
            <div class="waze-next-icon">${icon}</div>
            <div><b>${label}</b><span>${detalle}</span></div>
          </div>
          <div class="waze-actions">
            <button onclick="centrarRutaRealActual()">🎯 Centrar ruta</button>
            <button onclick="calcularRutaRealActual()">🔄 Recalcular</button>
          </div>
        </div>`;
  }

  window.centrarRutaRealActual = function() {
      if(!routeRealLastResult || !routeRealLastResult.geometry) return;
      const coords = routeRealLastResult.geometry.coordinates.map(c => [c[1], c[0]]);
      if(coords.length) map.fitBounds(coords, { padding:[70,70], maxZoom:17 });
  };

  function perfilOSRMActual() {
      return (ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car).perfil;
  }

  function factorTraficoEstimado() {
      const h = new Date().getHours() + new Date().getMinutes()/60;
      const pico = (h >= 6.4 && h <= 8.7) || (h >= 17 && h <= 19.6);
      const medio = (h >= 11.8 && h <= 14.1);
      const modo = routeRealMode;
      if(modo === 'walking') return pico ? 1.06 : 1.00;
      if(modo === 'bike') return pico ? 1.12 : (medio ? 1.06 : 1.00);
      if(modo === 'bus') return pico ? 1.55 : (medio ? 1.30 : 1.18);
      if(modo === 'motorcycle') return pico ? 1.22 : (medio ? 1.10 : 1.00);
      return pico ? 1.38 : (medio ? 1.18 : 1.05);
  }

  function textoTraficoEstimado() {
      const f = factorTraficoEstimado();
      if(f >= 1.35) return 'alto por hora pico';
      if(f >= 1.15) return 'moderado';
      return 'fluido';
  }

  function calcularDuracionAjustada(segundos, distanciaMetrosRuta = 0) {
      const modo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
      if(distanciaMetrosRuta && distanciaMetrosRuta > 0 && modo.velocidadKmh) {
          const base = (distanciaMetrosRuta / 1000) / modo.velocidadKmh * 3600;
          return Math.max(60, base * modo.ajuste * factorTraficoEstimado());
      }
      return Math.max(60, segundos * modo.ajuste * factorTraficoEstimado());
  }

  function formatoTiempoMin(segundos) {
      const min = Math.max(1, Math.round(segundos / 60));
      if(min < 60) return `${min} min`;
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h} h ${m} min`;
  }

  async function solicitarRutaOSRM(origen, destino, perfil) {
      // V69: pedir alternativas para que URBIS pueda sugerir rutas alternas.
      const url = `https://router.project-osrm.org/route/v1/${perfil}/${origen.lng},${origen.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
      const res = await fetch(url);
      if(!res.ok) throw new Error(`OSRM ${res.status}`);
      const json = await res.json();
      if(!json.routes || !json.routes.length) throw new Error('Sin rutas disponibles');
      const principal = json.routes[0];
      principal._alternatives = json.routes.slice(1, 3);
      principal._trafficProvider = (window.URBIS_CONFIG && window.URBIS_CONFIG.TRAFFIC && window.URBIS_CONFIG.TRAFFIC.provider) || 'estimated';
      return principal;
  }

  async function obtenerRutaReal(origen, destino) {
      const perfil = perfilOSRMActual();
      try {
          return await solicitarRutaOSRM(origen, destino, perfil);
      } catch (e) {
          // Algunos servidores públicos no habilitan foot/bike. Se intenta driving como respaldo solo para que la demo no se rompa.
          if(perfil !== 'driving') {
              const fallback = await solicitarRutaOSRM(origen, destino, 'driving');
              fallback._fallbackProfile = true;
              return fallback;
          }
          throw e;
      }
  }

  function pintarRutaReal(route) {
      limpiarRutaRealVisual(false);
      limpiarLineasProgresoRuta();
      const modo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
      // V56: solo destino + punto GPS real. Sin marcador A adicional.
      crearMarcadorRutaReal(routeRealPointB, 'B', 'route-point-b', 'Destino - Destino');
      const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
      window.routeRealLastResult = route;
      window.routeRealPointA = routeRealPointA;
      window.routeRealPointB = routeRealPointB;
      window.routeRealMode = routeRealMode;
      routeRealGeoJSON = route.geometry;

      // V47: progreso real de navegación.
      // Se renderiza únicamente la ruta restante en celeste. No hay tramo recorrido gris ni trail.
      // Opción A estilo Google Maps: sin sombra/trail del recorrido completo.
      // Solo queda visible la ruta restante desde el GPS hasta el destino.
      crearLineasProgresoRuta(coords);
      prepararInstruccionesVozRuta(route);
      prepararIndiceAlertasMovilidadRuta();
      renderizarProgresoRuta(0);
      if(typeof window.urbisMobilityTrafficRenderActiveRoute === 'function') window.urbisMobilityTrafficRenderActiveRoute(route);
      map.fitBounds(coords, { padding:[70,70], maxZoom:17 });
  }

  function renderRutaReal(route) {
      const modo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
      const duracion = calcularDuracionAjustada(route.duration || 0, route.distance || 0);
      const steps = route.legs && route.legs[0] ? route.legs[0].steps : [];
      const fallback = route._fallbackProfile ? `<div style="margin-top:6px;color:#feca57;">⚠️ El servidor no devolvió ruta ${modo.nombre}; se muestra una ruta vehicular como respaldo visual.</div>` : '';
      renderResultadoRutaReal(`
          <strong>${modo.emoji} Recorrido por calles</strong><br>
          <span class="route-mode-pill">${modo.emoji} ${modo.nombre}</span>
          <span class="route-mode-pill">📏 ${formatoDistancia(route.distance || 0)}</span>
          <span class="route-mode-pill">⏱️ ${formatoTiempoMin(duracion)}</span>
          ${fallback}
          ${construirNavegacionWaze(route, steps, routeRealMode, duracion)}
          <div style="margin-top:7px;color:#aeb6c2;">Ruta calculada con un servicio público de enrutamiento. Sirve para validar el flujo antes de llevarlo a producción para ciudadanos.</div>
          ${construirPasosPedagogicos(steps, routeRealMode, route.distance || 0)}
      `);
      if(urbisRouteFocusActive) crearOverlayNavegacionCiudadana(route);
  }

  window.seleccionarModoRutaReal = function(modo) {
      routeRealMode = modo;
      actualizarUIRutaReal();
      if(routeRealPointA && routeRealPointB && !routeRealLastResult) {
          const modoInfo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
          renderResultadoRutaReal(`🎯 Destino listo. Modo seleccionado: <b>${modoInfo.emoji} ${modoInfo.nombre}</b>.<br>Pulsa <b>🚀 Iniciar recorrido</b> para calcular el recorrido.`);
      } else if(routeRealPointA && routeRealPointB && routeRealLastResult) {
          calcularRutaRealActual();
      }
  };


  function puntoValidoUrbis(p) {
      if(!p) return null;
      const lat = Number(p.lat ?? p.latitude);
      const lng = Number(p.lng ?? p.lon ?? p.longitude);
      return (isFinite(lat) && isFinite(lng)) ? { lat, lng } : null;
  }

  function sincronizarRutaRealDesdeEstadoMovil() {
      try {
          const snap = window.URBIS_MOBILITY_STATE && typeof window.URBIS_MOBILITY_STATE.snapshot === 'function'
              ? window.URBIS_MOBILITY_STATE.snapshot()
              : null;
          const destino = puntoValidoUrbis(routeRealPointB)
              || puntoValidoUrbis(window.routeRealPointB)
              || puntoValidoUrbis(window.destinoSeleccionado)
              || puntoValidoUrbis(window.urbisDestinoSeleccionado)
              || puntoValidoUrbis(window.destinoActual)
              || puntoValidoUrbis(snap && snap.destination);
          if(destino) {
              routeRealPointB = destino;
              window.routeRealPointB = destino;
              window.destinoSeleccionado = destino;
              window.urbisDestinoSeleccionado = destino;
              window.destinoActual = destino;
          }
          const gpsLast = (window.UrbisMobileGPS && typeof window.UrbisMobileGPS.getLast === 'function') ? window.UrbisMobileGPS.getLast() : null;
          const origen = puntoValidoUrbis(routeRealPointA)
              || puntoValidoUrbis(window.routeRealPointA)
              || puntoValidoUrbis(window.userLastLatLng)
              || puntoValidoUrbis(gpsLast)
              || puntoValidoUrbis(snap && snap.origin);
          if(origen) {
              routeRealPointA = origen;
              window.routeRealPointA = origen;
          }
          if(window.routeRealMode && window.routeRealMode !== routeRealMode) routeRealMode = window.routeRealMode;
          window.routeRealMode = routeRealMode;
      } catch(e) {}
  }

  window.urbisSincronizarRutaRealDesdeEstadoMovil = sincronizarRutaRealDesdeEstadoMovil;

  window.urbisSetRutaRealDestinoMovil = async function(destino, modo) {
      const d = puntoValidoUrbis(destino);
      if(!d) return false;
      if(modo) {
          routeRealMode = modo === 'motorcycle' ? 'car' : modo;
          window.routeRealMode = routeRealMode;
      }
      routeRealPointB = d;
      window.routeRealPointB = d;
      window.destinoSeleccionado = d;
      window.urbisDestinoSeleccionado = d;
      window.destinoActual = d;
      if(!routeRealPointA) {
          try {
              const gps = await obtenerGPSUnaVezParaRuta();
              routeRealPointA = { lat: gps.lat, lng: gps.lng };
              window.routeRealPointA = routeRealPointA;
          } catch(e) {}
      }
      try {
          if(routeRealPointB && (!routeRealLastResult || !routeRealGeoJSON)) {
              rutaLayer.clearLayers();
              crearMarcadorRutaReal(routeRealPointB, 'B', 'route-point-b', 'Destino seleccionado');
          }
          actualizarUIRutaReal();
      } catch(e) {}
      return true;
  };

  window.calcularRutaRealActual = async function() {
      sincronizarRutaRealDesdeEstadoMovil();
      if(!routeRealPointA && routeRealPointB) {
          try {
              const gps = await obtenerGPSUnaVezParaRuta();
              routeRealPointA = { lat: gps.lat, lng: gps.lng };
              actualizarUIRutaReal();
          } catch(error) {
              renderResultadoRutaReal('⚠️ Falta el Salida. Activa permisos de GPS o usa Usar mi ubicación.');
              return;
          }
      }
      sincronizarRutaRealDesdeEstadoMovil();
      if(!routeRealPointA || !routeRealPointB) {
          renderResultadoRutaReal('Pulsa <b>🎯 Elegir destino</b>: usaré tu GPS como Salida y luego toca en el mapa a dónde quieres llegar.');
          return null;
      }
      const modo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
      if(urbisRouteChoiceActive) {
          document.body.classList.remove('route-choice-active');
          quitarOverlayInicioRecorridoCiudadano();
          return null;
      }
      renderResultadoRutaReal(`⏳ Calculando recorrido para <b>${modo.emoji} ${modo.nombre}</b>...`);
      try {
          const route = await obtenerRutaReal(routeRealPointA, routeRealPointB);
          routeRealLastResult = route;
          urbisVoiceIntroDone = false;
          pintarRutaReal(route);
          renderRutaReal(route);
          if(typeof activarModoRecorridoUrbis === 'function') activarModoRecorridoUrbis();
          const estadoRuta = `${modo.emoji} ${modo.nombre} · ${formatoDistancia(route.distance)} · ${formatoTiempoMin(calcularDuracionAjustada(route.duration, route.distance || 0))}`;
          if(typeof window.urbisMobileSetMobilityStatus === 'function') window.urbisMobileSetMobilityStatus(estadoRuta);
          mostrarPanelNavegacion(`✅ Recorrido generado: ${estadoRuta}.`);
          return route;
      } catch(error) {
          console.error(error);
          renderResultadoRutaReal('No se pudo calcular la recorrido. Revisa internet o intenta con otro modo de movilidad.');
          mostrarPanelNavegacion('⚠️ No se pudo consultar la recorrido en este momento.');
      }
  };

  function obtenerGPSUnaVezParaRuta() {
      return new Promise((resolve, reject) => {
          if(userLastLatLng) { resolve(userLastLatLng); return; }
          if(!navigator.geolocation) { reject(new Error('Geolocalización no disponible')); return; }
          navigator.geolocation.getCurrentPosition(pos => {
              const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              userLastLatLng = punto;
              if(!userPositionMarker) {
                  userPositionMarker = L.marker([punto.lat, punto.lng], { icon: L.divIcon({ className: '', html: '<div class="gps-dot"></div>', iconSize: [24,24], iconAnchor: [12,12] }) }).addTo(userTraceLayer).bindPopup('Tu ubicación actual');
              } else {
                  userPositionMarker.setLatLng([punto.lat, punto.lng]);
              }
              userTraceLayer.clearLayers();
              userPositionMarker.addTo(userTraceLayer);
              resolve(punto);
          }, reject, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
      });
  }

  window.usarGPSComoOrigenRutaReal = async function() {
      try {
          const gps = await obtenerGPSUnaVezParaRuta();
          routeRealPointA = { lat: gps.lat, lng: gps.lng };
          limpiarRutaRealVisual(true);
          actualizarUIRutaReal();
          renderResultadoRutaReal('✅ Tu GPS quedó como <b>Salida</b>. Ahora pulsa <b>Elegir destino</b> y toca el mapa para indicar a dónde quieres llegar.');
          mostrarPanelNavegacion('📍 GPS usado como origen de ruta. Ahora elige el destino en el mapa.');
      } catch(error) {
          console.error(error);
          renderResultadoRutaReal('⚠️ No pude obtener tu GPS. Revisa permisos de ubicación del navegador.');
          mostrarPanelNavegacion('⚠️ No se pudo usar el GPS como origen.');
      }
  };

  window.prepararDestinoDesdeGPS = async function() {
      try {
          const gps = await obtenerGPSUnaVezParaRuta();
          routeRealPointA = { lat: gps.lat, lng: gps.lng };
          routeRealPointB = null;
          routeRealAutoDestino = true;
          modoRutaManual = false;
          rutaLayer.clearLayers();
          // V56: no crear marcador de origen; el GPS real ya se muestra en azul.
          try { if(!window.__urbisMobileMapFreeMode) map.setView([routeRealPointA.lat, routeRealPointA.lng], Math.max(map.getZoom() || 16, 16)); } catch(e) {}
          actualizarUIRutaReal();
          const btnReal = document.getElementById('btn-real-route-capture');
          const btnRoute = document.getElementById('btn-route-mode');
          if(btnReal) btnReal.classList.add('active');
          if(btnRoute) btnRoute.classList.add('active');
          renderResultadoRutaReal('<span class="route-pulse"></span><b>Modo destino activo.</b><br>Toca cualquier sector del mapa para marcar a dónde quieres llegar. Luego elige el modo de movilidad y pulsa <b>Iniciar recorrido</b>.');
          mostrarPanelNavegacion('🎯 Toca el mapa para elegir el destino de tu ruta.');
      } catch(error) {
          console.error(error);
          renderResultadoRutaReal('⚠️ Activa permisos de GPS para usar tu ubicación como Salida.');
          mostrarPanelNavegacion('⚠️ No se pudo activar el GPS para crear la ruta.');
      }
  };

  window.limpiarRutaReal = function() {
      routeRealPointA = null;
      routeRealPointB = null;
      modoRutaManual = false;
      routeRealAutoDestino = false;
      rutaManualOrigen = null;
      limpiarLineasProgresoRuta();
      rutaLayer.clearLayers();
      if(typeof desactivarModoRecorridoUrbis === 'function') desactivarModoRecorridoUrbis();
      actualizarUIRutaReal();
      const btn = document.getElementById('btn-route-mode');
      const btnReal = document.getElementById('btn-real-route-capture');
      if(btn) btn.classList.remove('active');
      if(btnReal) btnReal.classList.remove('active');
      renderResultadoRutaReal('Pulsa “Elegir destino” para usar tu GPS como Salida y tocar en el mapa el lugar al que quieres llegar.');
      mostrarPanelNavegacion('🧹 Recorrido limpiada.');
  };

  window.activarModoRutaManual = function() {
      modoRutaManual = !modoRutaManual;
      rutaManualOrigen = null;
      const btn = document.getElementById('btn-route-mode');
      const btnReal = document.getElementById('btn-real-route-capture');
      if(btn) btn.classList.toggle('active', modoRutaManual);
      if(btnReal) btnReal.classList.toggle('active', modoRutaManual);
      if(modoRutaManual) {
          routeRealPointA = null;
          routeRealPointB = null;
          rutaLayer.clearLayers();
          actualizarUIRutaReal();
          renderResultadoRutaReal('📌 Captura activa: toca el mapa para seleccionar <b>Salida</b> y luego <b>Destino</b>.');
          mostrarPanelNavegacion('🧭 Captura de recorrido activa: toca <b>Salida</b> y luego <b>Destino</b>.');
      } else {
          renderResultadoRutaReal('Captura desactivada. Puedes volver a activarla cuando quieras.');
          mostrarPanelNavegacion('Modo recorrido desactivado.');
      }
  };

  async function manejarClickDestinoRutaReal(latlng) {
      if(!routeRealPointA) {
          await prepararDestinoDesdeGPS();
          if(!routeRealPointA) return;
      }
      routeRealPointB = { lat: latlng.lat, lng: latlng.lng };
      routeRealAutoDestino = false;
      modoRutaManual = false;
      rutaLayer.clearLayers();
      // V56: no crear marcador de origen; solo destino.
      crearMarcadorRutaReal(routeRealPointB, 'B', 'route-point-b', 'Destino seleccionado').openPopup();
      actualizarUIRutaReal();
      const btnReal = document.getElementById('btn-real-route-capture');
      const btnRoute = document.getElementById('btn-route-mode');
      if(btnReal) btnReal.classList.remove('active');
      if(btnRoute) btnRoute.classList.remove('active');
      const modo = ROUTE_REAL_MODES[routeRealMode] || ROUTE_REAL_MODES.car;
      renderResultadoRutaReal(`
          <div class="route-ready-card">
              <b>🎯 Destino seleccionado</b><br>
              Origen: tu GPS · Destino: ${formatoCoordRutaReal(routeRealPointB)}<br>
              Modo actual: <b>${modo.emoji} ${modo.nombre}</b>. Puedes cambiarlo arriba antes de iniciar.
          </div>
          <div style="margin-top:8px;color:#aeb6c2;">Pulsa <b>🚀 Iniciar recorrido</b> para calcular el recorrido real por calles.</div>
      `);
      if(typeof window.urbisMobileSetMobilityStatus === 'function') window.urbisMobileSetMobilityStatus(`Destino listo · ${modo.emoji} ${modo.nombre}`);
      mostrarPanelNavegacion(`🎯 Destino listo. Elige cómo quieres moverte para iniciar la guía.`);
      if(typeof activarModoPrepararRecorridoUrbis === 'function') activarModoPrepararRecorridoUrbis();
  }

  async function manejarClickRuta(latlng) {
      const punto = { lat: latlng.lat, lng: latlng.lng };
      if(!routeRealPointA || (routeRealPointA && routeRealPointB)) {
          routeRealPointA = punto;
          routeRealPointB = null;
          rutaLayer.clearLayers();
          // V56: ocultar marcador A en móvil; se conserva el punto GPS real.
          try { if(!window.__urbisMobileMapFreeMode) map.setView([routeRealPointA.lat, routeRealPointA.lng], Math.max(map.getZoom() || 16, 16)); } catch(e) {}
          actualizarUIRutaReal();
          renderResultadoRutaReal('✅ Salida seleccionado. Ahora toca el mapa para seleccionar <b>Destino</b>.');
          mostrarPanelNavegacion('✅ Salida seleccionado. Ahora toca el <b>Destino</b>.');
          return;
      }
      routeRealPointB = punto;
      crearMarcadorRutaReal(routeRealPointB, 'B', 'route-point-b', 'Destino - Destino').openPopup();
      actualizarUIRutaReal();
      modoRutaManual = false;
      const btn = document.getElementById('btn-route-mode');
      const btnReal = document.getElementById('btn-real-route-capture');
      if(btn) btn.classList.remove('active');
      if(btnReal) btnReal.classList.remove('active');
      renderResultadoRutaReal('🎯 Destino seleccionado. Elige cómo quieres moverte para iniciar la guía.');
      if(typeof activarModoPrepararRecorridoUrbis === 'function') activarModoPrepararRecorridoUrbis();
  }

  // Reemplaza el antiguo dibujo visual de línea recta por una recorrido por calles.
  window.iniciarRutaHacia = async function(lat, lng) {
      const destino = { lat: parseFloat(lat), lng: parseFloat(lng) };
      if(!isFinite(destino.lat) || !isFinite(destino.lng)) { alert('Destino inválido.'); return; }
      if(userLastLatLng) {
          routeRealPointA = { lat: userLastLatLng.lat, lng: userLastLatLng.lng };
          routeRealPointB = destino;
          actualizarUIRutaReal();
          await calcularRutaRealActual();
      } else {
          mostrarPanelNavegacion('📍 Activa primero el GPS o usa <b>Crear recorrido</b> para elegir origen y destino en el mapa.');
      }
  };

  function limpiarRuta() {
      limpiarRutaReal();
  }

  function tipoZona(elemento, tipo) {
      const texto = `${elemento || ''} ${tipo || ''}`.toLowerCase();
      if(texto.includes('inund') || texto.includes('drenaje')) return { key: 'inundaciones', nombre: 'Zona de inundaciones', color: '#b8ebe6', icono: '🌊' };
      if(texto.includes('hueco') || texto.includes('bache')) return { key: 'huecos', nombre: 'Zona de huecos', color: '#747d8c', icono: '🕳️' };
      if(texto.includes('retén') || texto.includes('reten')) return { key: 'retenes', nombre: 'Zona de retenes', color: '#feca57', icono: '🚧' };
      if(texto.includes('cerrada') || texto.includes('bloqueada')) return { key: 'vias_cerradas', nombre: 'Zona de vías cerradas', color: '#ff4757', icono: '⛔' };
      if(texto.includes('congest') || texto.includes('tráfico') || texto.includes('trafico') || texto.includes('accidente')) return { key: 'trafico', nombre: 'Zona de tráfico / accidentes', color: '#ff9f43', icono: '🚗' };
      return null;
  }

  window.analizarZonasCiudadanas = function(data = globalData, enfocar = false) {
      zonasLayer.clearLayers();
      const grupos = {};
      (Array.isArray(data) ? data : []).forEach(p => {
          const lat = parseFloat(String(p.lat).replace(',', '.'));
          const lng = parseFloat(String(p.lng).replace(',', '.'));
          if(!isFinite(lat) || !isFinite(lng) || !p.descripcion) return;
          const d = p.descripcion.split(' | ');
          const zona = tipoZona(d[0], p.tipo);
          if(!zona) return;
          const likes = parseInt(d[BASE_OFFSET + 4]) || 0;
          if(!grupos[zona.key]) grupos[zona.key] = { ...zona, puntos: [], likes: 0 };
          grupos[zona.key].puntos.push({ lat, lng, nombre: d[1] || d[0] || p.tipo });
          grupos[zona.key].likes += likes;
      });

      let html = '';
      const bounds = [];
      Object.values(grupos).forEach(g => {
          const centro = g.puntos.reduce((acc, p) => ({ lat: acc.lat + p.lat/g.puntos.length, lng: acc.lng + p.lng/g.puntos.length }), { lat: 0, lng: 0 });
          const radio = Math.min(360, 90 + (g.puntos.length * 38) + (g.likes * 8));
          // El círculo gris de "zona" (huecos, etc.) molesta y bloquea toques.
          // Se OCULTA por defecto; el análisis sigue en el panel (#zona-analysis).
          // Para reactivarlo: window.URBIS_MOSTRAR_ZONAS_CIUDADANAS = true.
          if(window.URBIS_MOSTRAR_ZONAS_CIUDADANAS) {
            L.circle([centro.lat, centro.lng], { radius: radio, color: g.color, fillColor: g.color, fillOpacity: .16, weight: 3, dashArray: '8, 8', interactive: false })
              .addTo(zonasLayer)
              .bindPopup(`<b>${g.icono} ${g.nombre}</b><br>${g.puntos.length} reporte(s) ciudadanos<br>${g.likes} apoyo(s)`);
          }
          bounds.push([centro.lat, centro.lng]);
          html += `<div class="zone-card"><b>${g.icono} ${g.nombre}</b><div class="zone-metric">${g.puntos.length} reporte(s) · ${g.likes} apoyo(s) · radio visual ${Math.round(radio)} m</div></div>`;
      });
      if(!html) html = '<div class="zone-card">No hay suficientes reportes de inundaciones, huecos, retenes, vías cerradas o tráfico para dibujar zonas.</div>';
      const cont = document.getElementById('zona-analysis');
      if(cont) cont.innerHTML = html;
      if(enfocar && bounds.length) map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
  };

  // CONTROL DE CAPAS PEDAGÓGICO
  let capas = {};
  let togglesHTML = '';
  Object.keys(dimensiones).forEach(d => { 
      capas[d] = L.layerGroup().addTo(map); 
      togglesHTML += `
        <div class="layer-item">
            <div class="layer-info layer-visual">
                ${construirBadgeIcono(d, dimensiones[d].items && dimensiones[d].items[0] ? dimensiones[d].items[0] : d, 'layer-symbol')}
                <div class="layer-label"><b>${d}</b><span>${dimensiones[d].desc}</span></div>
            </div>
            <label class="switch">
                <input type="checkbox" data-layer="${d}" onchange="toggleCapa('${d}', this)">
                <span class="slider"></span>
            </label>
        </div>`;
  });
  document.addEventListener("DOMContentLoaded", () => {
      const cont = document.getElementById('layers-toggles');
      if(!cont) return;
      cont.innerHTML = `
        <div class="layer-start-note">Al iniciar, ciudadanía/funcionario/educativo solo ven alertas. Admin inicia con todas las capas activas.</div>
        <div class="layer-quick-actions">
            <button onclick="activarSoloAlertasUrbis()">🚨 Solo alertas</button>
            <button onclick="activarTodasLasCapasUrbis()">🧩 Activar todo</button>
        </div>` + togglesHTML;
      if(userRole) setTimeout(() => { if(typeof aplicarPerfilCapasIniciales === 'function') aplicarPerfilCapasIniciales(); }, 50);
  });

  window.toggleCapa = function(capaName, checkbox) {
      const z = map.getZoom();
      if(checkbox.checked && z >= ZOOM_MOSTRAR_REPORTES_URBIS) {
          map.addLayer(capas[capaName]);
      } else {
          map.removeLayer(capas[capaName]);
      }
      aplicarCapasSegunZoom();
    urbisApplyProximityModeDebounced();
  };
