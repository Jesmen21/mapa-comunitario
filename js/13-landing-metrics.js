// =====================================================
  // PORTADA: métricas dinámicas + scroll a paneles de acceso
  // =====================================================
  function formatearNumeroPortada(n) {
      const valor = Number(n) || 0;
      return valor.toLocaleString('es-CO');
  }

  function obtenerPartesDescripcionPortada(p) {
      return String((p && p.descripcion) || '').split(' | ');
  }

  function obtenerEstadoTextoPortada(p) {
      const d = obtenerPartesDescripcionPortada(p);
      return `${d[4] || ''} ${d[BASE_OFFSET + 1] || ''} ${d[BASE_OFFSET + TIMELINE_EXTRA_OFFSET + 3] || ''}`.toLowerCase();
  }

  function calcularMetricasPortada(data) {
      const arr = Array.isArray(data) ? data : [];
      let total = arr.length;
      let revision = 0;
      let proceso = 0;
      let resueltos = 0;

      arr.forEach(p => {
          const d = obtenerPartesDescripcionPortada(p);
          const validacion = String(d[BASE_OFFSET + 1] || 'Aprobado').toLowerCase();
          const estado = obtenerEstadoTextoPortada(p);

          if(validacion.includes('pendiente') || validacion.includes('revisión') || validacion.includes('revision') || estado.includes('pendiente')) {
              revision++;
              return;
          }
          if(estado.includes('resuelto') || estado.includes('solucionado') || estado.includes('cerrado') || estado.includes('archivado')) {
              resueltos++;
              return;
          }
          proceso++;
      });

      return { total, revision, proceso, resueltos };
  }

  function actualizarMetricasPortada(data) {
      const metricas = calcularMetricasPortada(data || globalData || []);
      const mapa = {
          total: { valor: metricas.total, texto: 'En plataforma' },
          revision: { valor: metricas.revision, texto: 'Pendientes de validar' },
          proceso: { valor: metricas.proceso, texto: 'Activos / en seguimiento' },
          resueltos: { valor: metricas.resueltos, texto: 'Cerrados / archivados' }
      };
      Object.keys(mapa).forEach(k => {
          const card = document.querySelector(`[data-landing-metric="${k}"]`);
          if(!card) return;
          const strong = card.querySelector('strong');
          const span = card.querySelector('span');
          if(strong) strong.textContent = formatearNumeroPortada(mapa[k].valor);
          if(span) span.textContent = mapa[k].texto;
      });

      const totalMini = document.querySelector('[data-landing-metric-total]');
      const processMini = document.querySelector('[data-landing-metric-process]');
      const reviewMini = document.querySelector('[data-landing-metric-review]');
      const resolvedMini = document.querySelector('[data-landing-metric-resolved]');
      if(totalMini) totalMini.textContent = formatearNumeroPortada(metricas.total);
      if(processMini) processMini.textContent = formatearNumeroPortada(metricas.proceso);
      if(reviewMini) reviewMini.textContent = formatearNumeroPortada(metricas.revision);
      if(resolvedMini) resolvedMini.textContent = formatearNumeroPortada(metricas.resueltos);
  }

  function cargarMetricasPortadaInicial() {
      try {
          (window.urbisDBRead ? window.urbisDBRead() : Promise.resolve([]))
          .then(data => {
              const arr = Array.isArray(data) ? data : [];
              actualizarMetricasPortada(arr);
          })
          .catch(() => actualizarMetricasPortada([]));
      } catch(e) {
          actualizarMetricasPortada([]);
      }
  }

  function desplazarPanelAcceso(idPanel) {
      setTimeout(() => {
          const panel = document.getElementById(idPanel);
          if(panel && panel.style.display !== 'none') {
              panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }, 80);
  }

  const __urbisMostrarAccesoNormalOriginal = window.mostrarAccesoNormal || mostrarAccesoNormal;
  mostrarAccesoNormal = function() {
      __urbisMostrarAccesoNormalOriginal();
      desplazarPanelAcceso('normal-access-panel');
  };
  window.mostrarAccesoNormal = mostrarAccesoNormal;

  const __urbisMostrarCajaAdminOriginal = window.mostrarCajaAdmin || mostrarCajaAdmin;
  mostrarCajaAdmin = function() {
      __urbisMostrarCajaAdminOriginal();
      desplazarPanelAcceso('admin-access-panel');
  };
  window.mostrarCajaAdmin = mostrarCajaAdmin;

  const __urbisCargarPuntosOriginal = cargarPuntos;
  cargarPuntos = function() {
      if (userRole === '') {
          cargarMetricasPortadaInicial();
          return;
      }
      Object.values(capas).forEach(l => l.clearLayers());
      (window.urbisDBRead ? window.urbisDBRead() : Promise.resolve([]))
      .then(data => {
        globalData = Array.isArray(data) ? data.map(p => {
            if(p.descripcion) p.descripcion = asegurarCamposTemporales(p.descripcion, p.tipo, String(p.descripcion).split(' | ')[0], parseFechaReporte(p));
            return p;
        }) : [];
        actualizarMetricasPortada(globalData);
        return archivarReportesExpirados(globalData).then(() => globalData);
      })
      .then(() => {
        const visibles = datosVisiblesActuales();
        actualizarMetricasPortada(globalData);
        pintarPuntos(visibles);
        actualizarGraficos(visibles);
        actualizarPanelAdmin();
        if(typeof renderEventosUrbis === 'function') renderEventosUrbis();
        analizarZonasCiudadanas(visibles, false);
        renderTimeline();
      })
      .catch(error => manejarError("cargar puntos", error));
  };

  document.addEventListener('DOMContentLoaded', () => {
      actualizarMetricasPortada([]);
      cargarMetricasPortadaInicial();
  });
