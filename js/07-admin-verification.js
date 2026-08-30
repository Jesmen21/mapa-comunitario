// ==========================================
  // PANEL ADMIN DE VERIFICACIÓN BLINDADO
  // ==========================================
  // Contenido denunciado que todavía nadie ha revisado. Va ARRIBA de los
  // reportes por aprobar a propósito: una foto obscena o los datos personales
  // de un vecino son urgentes; un reporte esperando el visto bueno, no.
  function bloqueDenunciados() {
      if(typeof window.urbisEstadoDenuncia !== 'function') return '';
      const casos = [];
      (globalData || []).forEach(p => {
          try {
              const e = window.urbisEstadoDenuncia(p);
              if(e.hayQueRevisar) casos.push({ p, e });
          } catch(err){}
      });
      if(!casos.length) return '';
      // Lo escondido primero: es lo que está afectando a alguien ahora mismo.
      casos.sort((a,b) => (b.e.oculto ? 1 : 0) - (a.e.oculto ? 1 : 0));
      const filas = casos.slice(0, 25).map(({p, e}) => {
          const d = String(p.descripcion || '').split(' | ');
          const esComent = String(p.tipo || '').toLowerCase().indexOf('omentario') !== -1;
          const titulo = esComent
              ? ('Comentario de @' + (String(p.descripcion||'').split('~~~')[0] || 'ciudadano'))
              : (d[1] || d[0] || 'Reporte');
          const motivos = e.denuncias.map(m => window.urbisMotivoDenuncia(m.motivo)).join(', ');
          const marca = e.oculto
              ? '<span class="mod-oculto">ESCONDIDO</span>'
              : '<span class="mod-visible">AÚN VISIBLE</span>';
          const boton = esComent
              ? ''
              : `<button onclick="revisarPunto('${p.lat}', '${p.lng}')">REVISAR 👀</button>`;
          return `
              <div class="pending-item">
                  <div>
                      <span style="font-size:0.7rem; color:#ccc;">${marca} · ${e.total} denuncia(s)</span><br>
                      <b style="color:#fff;">${titulo}</b><br>
                      <span style="font-size:0.68rem; color:#ffb3b3;">${motivos}</span>
                  </div>
                  ${boton}
              </div>`;
      }).join('');
      return `
          <div class="admin-alert-box admin-alert-denuncias">
              <b style="color:#ff6b6b; font-size:1.1rem;">🚩 ${casos.length} contenido(s) denunciado(s) sin revisar:</b>
              <div style="margin-top:10px; max-height: 200px; overflow-y:auto; padding-right:5px;" class="cats-container">${filas}</div>
          </div>`;
  }

  function actualizarPanelAdmin() {
      if(userRole !== 'admin' && userRole !== 'gov') return;
      
      let pendientes = globalData.filter(p => {
          let d = p.descripcion.split(' | ');
          return (d[BASE_OFFSET + 1] && d[BASE_OFFSET + 1] === "Pendiente");
      });

      let panel = document.getElementById('admin-panel');
      panel.style.display = 'block';
      const denunciados = bloqueDenunciados();

      if(pendientes.length === 0) {
          panel.innerHTML = `
              <h3 style="color:var(--fuchsia);">🛡️ Panel de Verificación</h3>
              ${denunciados}
              ${denunciados ? '' : `<div class="admin-alert-box" style="border-color:var(--cyan); color:var(--cyan);">
                  ✅ Todo está al día. No hay reportes comunitarios por confirmar.
              </div>`}`;
          return;
      }

      let html = `
          <h3 style="color:var(--fuchsia);">🛡️ Panel de Verificación</h3>
          ${denunciados}
          <div class="admin-alert-box">
              <b style="color:#ff9f43; font-size:1.1rem;">⚠️ Tienes ${pendientes.length} reporte(s) por confirmar:</b>
              <div style="margin-top:10px; max-height: 150px; overflow-y:auto; padding-right:5px;" class="cats-container">`;
      
      pendientes.forEach(p => {
          let d = p.descripcion.split(' | ');
          let creadorList = d[BASE_OFFSET + 2] || "Anónimo";
          let likesList = parseInt(d[BASE_OFFSET + 4]) || 0;
          let popularTag = likesList > 0 ? `<span class="badge-like">👍 ${likesList}</span>` : '';
          
          html += `
              <div class="pending-item">
                  <div>
                      <span style="font-size:0.7rem; color:#ccc;">${p.tipo} - Autor: <b>${creadorList}</b></span><br>
                      ${construirBadgeIcono(p.tipo, d[0], 'popup-icon-badge')}<b style="color:#fff;">${d[1] || d[0]}</b> ${popularTag}
                  </div>
                  <button onclick="revisarPunto('${p.lat}', '${p.lng}')">REVISAR 👀</button>
              </div>`;
      });
      html += `</div></div>`;
      panel.innerHTML = html;
  }

  window.revisarPunto = function(lat, lng) {
      let punto = globalData.find(p => p.lat == lat && p.lng == lng);
      if(punto) {
          map.setView([lat, lng], 18);
          if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
          mostrarDetalles(punto);
      }
  };
