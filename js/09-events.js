// ==========================================
  // EVENTOS CIUDADANOS
  // ==========================================
  let modoUbicacionEvento = false;
  let eventoUbicacion = null;

  function categoriaEventoActual() {
      return document.getElementById('event-category')?.value || 'Festival / feria barrial';
  }

  function iconoEvento(tipo) {
      return obtenerIconoReporte('🎪 Eventos Comunitarios', tipo || categoriaEventoActual());
  }

  function usosEventoPorTipo(tipo) {
      const t = (tipo || '').toLowerCase();
      const usos = new Set(['Esp. Público', 'Ocio / Negocio']);
      if(t.includes('fútbol') || t.includes('futbol') || t.includes('tenis') || t.includes('atletismo') || t.includes('carrera')) usos.add('Deportivo');
      if(t.includes('show') || t.includes('concierto') || t.includes('festival') || t.includes('feria') || t.includes('taller') || t.includes('ajedrez')) usos.add('Cultural / Patrimonio');
      if(t.includes('reunión') || t.includes('reunion')) usos.add('Institucional');
      return todosLosUsos.map(u => usos.has(u) ? 'SI' : 'NO');
  }

  function actualizarEtiquetaUbicacionEvento() {
      const label = document.getElementById('event-location-label');
      if(!label) return;
      if(eventoUbicacion) label.innerHTML = `📍 Ubicación seleccionada: <b>${eventoUbicacion.lat.toFixed(5)}, ${eventoUbicacion.lng.toFixed(5)}</b>`;
      else label.innerHTML = '📍 Ubicación pendiente. Toca el mapa o pulsa “usar último punto”.';
  }

  window.activarModoUbicacionEvento = function() {
      setSidebarTab('events');
      modoUbicacionEvento = true;
      renderResultadoRutaReal?.('🎪 Modo evento activo: toca el mapa donde se realizará la actividad.');
      mostrarPanelNavegacion('🎪 Toca el mapa para ubicar el evento ciudadano.');
  };

  function manejarClickUbicacionEvento(latlng) {
      modoUbicacionEvento = false;
      eventoUbicacion = { lat: Number(latlng.lat), lng: Number(latlng.lng) };
      actualizarEtiquetaUbicacionEvento();
      playDropSound();
      if(tempMarker) map.removeLayer(tempMarker);
      tempMarker = L.marker([eventoUbicacion.lat, eventoUbicacion.lng], { icon: L.divIcon({ className: 'temp-marker', html: '<div class="pulse-ring"></div><div class="pulse-dot"></div>', iconSize: [30,30], iconAnchor: [15,15] }) }).addTo(map).bindPopup('🎪 Ubicación del evento').openPopup();
      setSidebarTab('events');
  }

  window.usarUltimoPuntoParaEvento = function() {
      if(!ultimoDestinoRapido) { alert('Primero toca un punto del mapa o elige ubicación del evento.'); return; }
      eventoUbicacion = { lat: Number(ultimoDestinoRapido.lat), lng: Number(ultimoDestinoRapido.lng) };
      actualizarEtiquetaUbicacionEvento();
      setSidebarTab('events');
  };

  window.actualizarSubtipoEvento = function() {
      const title = document.getElementById('event-title');
      if(title && !title.value.trim()) title.placeholder = `${iconoEvento(categoriaEventoActual())} Nombre del evento`;
  };

  function crearDescripcionEvento() {
      const tipoEvento = categoriaEventoActual();
      const titulo = normalizarTextoSheet(document.getElementById('event-title')?.value || tipoEvento);
      const fecha = normalizarTextoSheet(document.getElementById('event-date')?.value || 'Fecha por confirmar');
      const hora = normalizarTextoSheet(document.getElementById('event-time')?.value || 'Hora por confirmar');
      const lugar = normalizarTextoSheet(document.getElementById('event-place')?.value || 'Espacio público seleccionado');
      const contacto = normalizarTextoSheet(document.getElementById('event-contact')?.value || 'No registrado');
      const detalle = normalizarTextoSheet(document.getElementById('event-description')?.value || 'Evento ciudadano registrado en URBIS.');
      const duracionHoras = Math.max(1, Number(document.getElementById('event-duration-hours')?.value || 8));
      const usosFlags = usosEventoPorTipo(tipoEvento);
      const notas = `EVENTO_URBIS · Fecha: ${fecha} · Hora: ${hora} · Lugar: ${lugar} · Contacto: ${contacto} · Publicado: ${duracionHoras} horas · Detalle: ${detalle}`;
      // Identidad robusta: scope compartido → sesión → window.*  (nunca anónimo si hay login)
      const _es = (window.URBIS_AUTH && typeof window.URBIS_AUTH.readSession === 'function') ? window.URBIS_AUTH.readSession() : null;
      // PRIVACIDAD: se guarda el nombre de usuario, nunca el nombre real.
      const _evNombre = (_es && _es.usuario) || window.userUsernameGlobal || ((_es && _es.correo) ? String(_es.correo).split('@')[0] : '') || 'Ciudadano';
      const _evRol    = userRole || (_es && _es.rol) || window.userRole || 'citizen';
      const _evCorreo = userEmailGlobal || (_es && _es.correo) || window.userEmailGlobal || 'No registrado';
      const _evCedula = userCedulaGlobal || (_es && (_es.cedula_numero || _es.cedula)) || window.userCedulaGlobal || 'No registrado';
      const _evBarrio = userBarrioGlobal || (_es && _es.barrio) || window.userBarrioGlobal || 'Evento ciudadano';
      const arrData = [
          tipoEvento,
          titulo,
          notas,
          'Bueno',
          'Activo',
          'N/A',
          ...usosFlags,
          'N/A',
          (_evRol === 'admin' || _evRol === 'gov') ? 'Aprobado' : 'Pendiente',
          _evNombre,
          _evRol,
          0,
          _evCorreo,
          _evCedula,
          _evBarrio
      ];
      return asegurarCamposTemporalesPersonalizados(arrData.join(' | '), '🎪 Eventos Comunitarios', tipoEvento, new Date(), duracionHoras, iconoEvento(tipoEvento));
  }

  function escaparHTML(valor) {
      return String(valor ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
  }

  window.abrirEventoDesdeCard = function(data) {
      try {
          const p = JSON.parse(decodeURIComponent(data));
          map.setView([Number(p.lat), Number(p.lng)], 17);
          setSidebarTab('alerts');
          mostrarDetalles(p);
      } catch(error) {
          manejarError('abrir evento desde agenda', error);
      }
  };

  window.guardarEventoUrbis = async function(btn) {
      if(!eventoUbicacion) { alert('Primero selecciona la ubicación del evento en el mapa.'); return; }
      const titulo = document.getElementById('event-title')?.value.trim();
      if(!titulo) { alert('Escribe un nombre para el evento.'); return; }

      const textoOriginal = btn ? btn.innerText : '';
      if(btn) { btn.disabled = true; btn.innerText = '⏳ Publicando...'; }

      try {
          const registro = {
              tipo: '🎪 Eventos Comunitarios',
              lat: Number(eventoUbicacion.lat.toFixed(7)),
              lng: Number(eventoUbicacion.lng.toFixed(7)),
              descripcion: crearDescripcionEvento(),
              fecha: new Date().toISOString()
          };

          await window.urbisGuardarFila(registro);

          playSuccessSound();
          if(btn) btn.innerText = '✅ Evento publicado';

          ['event-title', 'event-date', 'event-time', 'event-place', 'event-contact', 'event-description'].forEach(id => {
              const el = document.getElementById(id);
              if(el) el.value = '';
          });
          const duration = document.getElementById('event-duration-hours');
          if(duration) duration.value = '8';

          eventoUbicacion = null;
          actualizarEtiquetaUbicacionEvento();
          if(tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }

          cargarPuntos();
          setTimeout(renderEventosUrbis, 500);
          setTimeout(() => {
              if(btn) {
                  btn.disabled = false;
                  btn.innerText = textoOriginal || '🎪 PUBLICAR EVENTO';
              }
          }, 900);
      } catch(error) {
          if(btn) { btn.disabled = false; btn.innerText = '🎪 Reintentar publicar'; }
          manejarError('guardar evento ciudadano', error);
      }
  };

  function datosEventosUrbis() {
      return (globalData || []).filter(p => p.tipo === '🎪 Eventos Comunitarios');
  }

  // Los eventos se guardan en DOS formatos distintos y este lector solo
  // entendía uno:
  //   A · legado / Áurea → [tipo, titulo, notas("Detalle: … · Hora: …"), …]
  //   B · alta rápida desde el mapa → [titulo, direccion, desc, fecha, hora,
  //                                    creador, foto, seccion, icono]
  // Un evento creado en el mapa caía en el lector A: tomaba la dirección como
  // título, no encontraba ninguna etiqueta y mostraba todo "por confirmar",
  // y la foto no se leía en ningún caso. De ahí que el evento saliera vacío.
  const _RX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
  const _RX_HORA = /^\d{1,2}:\d{2}$/;

  function _esFormatoMapa(d) {
      return _RX_FECHA_ISO.test(String(d[3] || '').trim()) &&
             _RX_HORA.test(String(d[4] || '').trim());
  }

  function _fechaLegible(iso) {
      const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return iso || '';
      const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      return parseInt(m[3], 10) + ' ' + (meses[+m[2] - 1] || '') + ' ' + m[1];
  }

  function _esFotoValida(v) {
      const s = String(v || '').trim();
      if (!s || s === 'N/A') return '';
      return (/^data:image\//i.test(s) || /^https?:\/\//i.test(s)) ? s : '';
  }

  // "Termina en 3 h" dice más que "Disponible": el ciudadano necesita saber
  // si le da tiempo de llegar.
  function _restanteTexto(expira) {
      if (!expira) return '';
      const ms = new Date(expira).getTime() - Date.now();
      if (isNaN(ms)) return '';
      if (ms <= 0) return 'Terminado';
      const h = Math.floor(ms / 3600000);
      if (h >= 48) return 'Faltan ' + Math.floor(h / 24) + ' días';
      if (h >= 1) return 'Termina en ' + h + ' h';
      return 'Termina en ' + Math.max(1, Math.round(ms / 60000)) + ' min';
  }

  function parseEvento(p) {
      const d = String(p.descripcion || '').split(' | ');
      const meta = obtenerMetaTemporal(p);

      if (_esFormatoMapa(d)) {
          const detalle = (d[2] || '').trim();
          return {
              tipo: (d[7] || 'Evento comunitario').trim(),
              titulo: (d[0] || 'Evento ciudadano').trim(),
              fecha: _fechaLegible(d[3]),
              hora: (d[4] || '').trim(),
              lugar: (d[1] || 'Espacio público').trim(),
              contacto: '',
              creador: (d[5] || '').trim(),
              publicado: '',
              detalle: (detalle && detalle !== 'Sin descripción') ? detalle : '',
              foto: _esFotoValida(d[6]),
              icono: (d[8] || '').trim(),
              estado: 'Publicado',
              expira: meta.expira,
              archivado: meta.archivado
          };
      }

      // Formato A. El regex iba en una cadena literal, así que '\s' perdía la
      // barra y buscaba la letra "s": ninguna etiqueta hacía match nunca.
      const notas = d[2] || '';
      const buscar = (label) => {
          const match = notas.match(new RegExp(label + ':\\s*([^·|]+)', 'i'));
          return match ? match[1].trim() : '';
      };
      return {
          tipo: d[0] || 'Evento',
          titulo: d[1] || d[0] || 'Evento ciudadano',
          fecha: buscar('Fecha') || 'Fecha por confirmar',
          hora: buscar('Hora') || 'Hora por confirmar',
          lugar: buscar('Lugar') || 'Espacio público',
          contacto: buscar('Contacto') || '',
          creador: '',
          publicado: buscar('Publicado') || '',
          detalle: buscar('Detalle') || notas,
          foto: _esFotoValida(d[5]),
          icono: '',
          estado: d[BASE_OFFSET + 1] || buscar('Estado') || 'Pendiente',
          expira: meta.expira,
          archivado: meta.archivado
      };
  }

  // Sección de administrador / evento especial en la pestaña de Eventos.
  function _seccionAdminEventos(){
      const esAdmin = (typeof window.urbisEsAdmin === 'function') && window.urbisEsAdmin();
      const puedeEspecial = (typeof window.urbisPuedeCrearEspecial === 'function') && window.urbisPuedeCrearEspecial();
      let html = '';
      if(puedeEspecial){
          html += `<div class="ev-premium-card">
            <div class="ev-premium-head"><span class="ev-premium-ico"><img src="assets/brand/urbis-logo.png" alt="Juegos URBIS" width="26" height="32" style="object-fit:contain;display:block"></span><div><b>Juegos URBIS</b><small>Evento PREMIUM · competencia con premio en dinero real</small></div></div>
            <button type="button" class="ev-sol-btn" onclick="window.urbisCrearEventoPremium && window.urbisCrearEventoPremium()">✨ Crear Juegos URBIS</button>
          </div>`;
      }
      if(esAdmin){
          const permitidos = (typeof window.urbisListaPermisos === 'function') ? window.urbisListaPermisos() : [];
          const lista = permitidos.length ? permitidos.map(u => '@' + escaparHTML(u)).join(', ') : 'nadie aún';
          html += `<div class="ev-admin-box">
            <b>🛡️ Administrador URBIS</b>
            <small>Da permiso a un usuario para crear el evento de Juegos URBIS:</small>
            <div class="ev-admin-row"><input id="ev-permiso-input" type="text" placeholder="usuario (ej: carolandreaa)" autocomplete="off"><button type="button" onclick="(function(){var i=document.getElementById('ev-permiso-input');var v=(i&&i.value||'').trim();if(window.urbisOtorgarPermiso)window.urbisOtorgarPermiso(v,function(){if(i)i.value='';if(window.urbisRenderEventosMovil)window.urbisRenderEventosMovil();});})()">Dar permiso</button></div>
            <small class="ev-admin-perms">Con permiso: ${lista}</small>
            <button type="button" class="ev-admin-exit" onclick="window.urbisAdminLogout && window.urbisAdminLogout()">Salir de admin</button>
          </div>`;
      } else {
          html += `<button type="button" class="ev-admin-link" onclick="window.urbisAdminUnlock && window.urbisAdminUnlock()">🛡️ Modo administrador</button>`;
      }
      return html ? `<div class="ev-admin-section">${html}</div>` : '';
  }

  // Render para la pestaña de Eventos en móvil (#u52-eventos-content).
  // Muestra SOLO eventos EN VIVO/actuales (míos y de otros). Los ya
  // finalizados/archivados (ej. un evento de Juegos URBIS vencido) ya no aparecen
  // aquí — quedan disponibles, para quien los creó, en "Mis eventos".
  const _misEventosLinkHTML = '<button type="button" class="ev-miseventos-link" data-u52-go="mis-eventos">🎪 Mis eventos<span>›</span></button>';
  window.urbisRenderEventosMovil = function(){
      const cont = document.getElementById('u52-eventos-content');
      if(!cont) return;
      if(!Array.isArray(globalData) || !globalData.length){ try{ if(typeof window.urbisCargarPuntos === 'function') window.urbisCargarPuntos(); }catch(e){} }
      const adminHTML = _seccionAdminEventos();
      const eventos = datosEventosUrbis().filter(p => !obtenerMetaTemporal(p).archivado).sort((a,b) => {
          const ma = obtenerMetaTemporal(a).creado.getTime(), mb = obtenerMetaTemporal(b).creado.getTime();
          return mb - ma;
      });
      if(!eventos.length){
          cont.innerHTML = _misEventosLinkHTML + adminHTML + '<div class="u52-empty-card"><span>📅</span><div><b>Aún no hay eventos en vivo</b><small>Crea uno desde el mapa: toca una cancha, parque o plaza y elige “Evento”.</small></div></div>';
          return;
      }
      cont.innerHTML = _misEventosLinkHTML + adminHTML + '<div class="ev-movil-list">' + eventos.map(p => {
          const ev = parseEvento(p);
          const icon = iconoEvento(ev.tipo);
          const lat = String(p.lat);
          // La foto va completa (object-fit:contain en el CSS): una foto de
          // evento suele ser vertical y recortarla escondía justo el cartel.
          const fotoHTML = ev.foto
            ? `<img class="ev-movil-foto" src="${escaparHTML(ev.foto)}" alt="Foto de ${escaparHTML(ev.titulo)}" loading="lazy" onclick="window.urbisAbrirFotoFull && window.urbisAbrirFotoFull(this.src)">`
            : '';
          const descHTML = ev.detalle
            ? `<p class="ev-movil-desc">${escaparHTML(ev.detalle)}</p>` : '';
          const restante = _restanteTexto(ev.expira);
          return `<div class="ev-movil-card ev-act">
              <div class="ev-movil-top">
                <span class="ev-movil-icon">${escaparHTML(icon)}</span>
                <div class="ev-movil-info">
                  <b>${escaparHTML(ev.titulo)}</b>
                  <small>${escaparHTML(ev.tipo)}</small>
                  <small>📅 ${escaparHTML(ev.fecha)} · 🕒 ${escaparHTML(ev.hora)}</small>
                  <small>📍 ${escaparHTML(ev.lugar)}</small>
                  ${ev.creador ? `<small>👤 ${escaparHTML(ev.creador)}</small>` : ''}
                  <span class="ev-movil-badge ev-act">🟢 ${escaparHTML(restante || 'Disponible')}</span>
                </div>
              </div>
              ${fotoHTML}
              ${descHTML}
              <button class="ev-movil-vermapa" onclick="window.urbisVerEnMapa && window.urbisVerEnMapa('${lat}')">🗺️ Ver en el mapa</button>
          </div>`;
      }).join('') + '</div>';
  };

  function renderEventosUrbis() {
      try{ if(document.querySelector('[data-u52-screen="events"]')?.classList.contains('active') && typeof window.urbisRenderEventosMovil === 'function') window.urbisRenderEventosMovil(); }catch(e){}
      const cont = document.getElementById('events-list');
      if(!cont) return;
      const eventos = datosEventosUrbis().slice().sort((a,b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      if(!eventos.length) {
          cont.innerHTML = '<div class="event-empty">Aún no hay eventos registrados. Crea el primero tocando una cancha, parque, plaza o espacio público del mapa.</div>';
          return;
      }
      cont.innerHTML = eventos.slice(0, 30).map(p => {
          const ev = parseEvento(p);
          const icon = iconoEvento(ev.tipo);
          const payload = encodeURIComponent(JSON.stringify(p));
          const lat = Number(p.lat);
          const lng = Number(p.lng);
          return `<div class="event-card" role="button" tabindex="0" onclick="abrirEventoDesdeCard('${payload}')">
              <b>${escaparHTML(icon)} ${escaparHTML(ev.titulo)}</b>
              <small>${escaparHTML(ev.tipo)} · ${escaparHTML(ev.fecha)} ${escaparHTML(ev.hora)} · ${escaparHTML(ev.lugar)}</small>
              <span class="event-chip">${escaparHTML(ev.estado)}</span><span class="event-chip">⏱️ ${escaparHTML(ev.publicado)}</span><span class="event-chip">${ev.archivado ? '📦 Archivado' : '🟢 Visible hasta ' + escaparHTML(formatearFechaHora(ev.expira))}</span><span class="event-chip">📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
          </div>`;
      }).join('');
  }
