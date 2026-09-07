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

  /* La portada necesita sus métricas después de cada carga, y para eso este
     archivo SUSTITUÍA `cargarPuntos` por una copia entera de la carga. La
     copia envejeció: se quedó sin el reparto de las filas que no son
     reportes, así que con ella al mando la vitrina, los avatares y el buzón
     de peticiones del administrador se leían siempre vacíos —cada uno mira
     su cajón y nadie los llenaba—, y `globalData` cargaba además con filas
     que no se pintan.

     Ahora no hay copia: se llama a la de siempre y se encadenan las métricas
     cuando termina. Una carga, un sitio donde arreglarla. */
  const __urbisCargarPuntosOriginal = cargarPuntos;
  cargarPuntos = function() {
      if (userRole === '') {
          cargarMetricasPortadaInicial();
          return;
      }
      const hecho = __urbisCargarPuntosOriginal();
      const metricas = () => { try { actualizarMetricasPortada(globalData); } catch (e) {} };
      // `then` si devolvió promesa —lo hace— y por si acaso también sin ella:
      // una portada sin métricas es un cero grande en la primera pantalla.
      if (hecho && typeof hecho.then === 'function') return hecho.then(metricas, metricas);
      metricas();
      return hecho;
  };

  document.addEventListener('DOMContentLoaded', () => {
      actualizarMetricasPortada([]);
      cargarMetricasPortadaInicial();
  });
