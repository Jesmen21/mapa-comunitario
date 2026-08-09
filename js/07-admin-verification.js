// ==========================================
  // PANEL ADMIN DE VERIFICACIÓN BLINDADO
  // ==========================================
  function actualizarPanelAdmin() {
      if(userRole !== 'admin' && userRole !== 'gov') return;
      
      let pendientes = globalData.filter(p => {
          let d = p.descripcion.split(' | ');
          return (d[BASE_OFFSET + 1] && d[BASE_OFFSET + 1] === "Pendiente");
      });

      let panel = document.getElementById('admin-panel');
      panel.style.display = 'block';

      if(pendientes.length === 0) {
          panel.innerHTML = `
              <h3 style="color:var(--fuchsia);">🛡️ Panel de Verificación</h3>
              <div class="admin-alert-box" style="border-color:var(--cyan); color:var(--cyan);">
                  ✅ Todo está al día. No hay reportes comunitarios por confirmar.
              </div>`;
          return;
      }

      let html = `
          <h3 style="color:var(--fuchsia);">🛡️ Panel de Verificación</h3>
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
