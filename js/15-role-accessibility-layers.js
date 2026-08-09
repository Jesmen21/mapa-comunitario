// ==========================================
// URBIS V8 · Capas por rol + modo funcionario simple + bienestar opcional
// ==========================================
const URBIS_ALERT_LAYER_KEYS = [
  '🚨 Alertas y Riesgos Urbanos',
  '🚗 Reportes de Tráfico',
  'Salud y Emergencias'
];

function esCapaAlertaUrbis(nombre) {
  return URBIS_ALERT_LAYER_KEYS.includes(nombre);
}

window.aplicarPerfilCapasIniciales = function() {
  const esAdmin = userRole === 'admin';
  const checks = Array.from(document.querySelectorAll('#layers-toggles input[type="checkbox"][data-layer]'));

  checks.forEach(ch => {
    const nombre = ch.getAttribute('data-layer');
    const activa = esAdmin ? true : esCapaAlertaUrbis(nombre);
    ch.checked = activa;
    if(typeof capas !== 'undefined' && capas[nombre]) {
      if(activa && map.getZoom() >= ZOOM_MOSTRAR_REPORTES_URBIS) {
        if(!map.hasLayer(capas[nombre])) map.addLayer(capas[nombre]);
      } else {
        if(map.hasLayer(capas[nombre])) map.removeLayer(capas[nombre]);
      }
    }
  });

  // El AutoMapeo/OSM queda apagado por defecto para ciudadanía, funcionario y educativo.
  // Admin sí puede entrar viendo todo el ecosistema cargado.
  window.urbisAutoMapeoVisible = esAdmin;
  if(!esAdmin && typeof autoMapeoCucutaLayer !== 'undefined' && map.hasLayer(autoMapeoCucutaLayer)) {
    map.removeLayer(autoMapeoCucutaLayer);
  }
  if(typeof aplicarCapasSegunZoom === 'function') aplicarCapasSegunZoom();
};

window.aplicarPerfilVisualPorRol = function() {
  document.body.classList.toggle('role-gov-simple', userRole === 'gov');
  const title = document.getElementById('sidebar-title');
  if(title && userRole === 'gov' && !document.getElementById('gov-simple-note')) {
    const note = document.createElement('div');
    note.id = 'gov-simple-note';
    note.className = 'gov-simple-note';
    note.innerHTML = '<b>Modo funcionario simplificado</b><span>Menos ruido visual, mismas funciones de revisión, gestión y análisis.</span>';
    title.insertAdjacentElement('afterend', note);
  }
};

window.activarTodasLasCapasUrbis = function() {
  document.querySelectorAll('#layers-toggles input[type="checkbox"][data-layer]').forEach(ch => {
    ch.checked = true;
    if(typeof toggleCapa === 'function') toggleCapa(ch.getAttribute('data-layer'), ch);
  });
  window.urbisAutoMapeoVisible = false;
  if(typeof aplicarCapasSegunZoom === 'function') aplicarCapasSegunZoom();
};

window.activarSoloAlertasUrbis = function() {
  document.querySelectorAll('#layers-toggles input[type="checkbox"][data-layer]').forEach(ch => {
    const activa = esCapaAlertaUrbis(ch.getAttribute('data-layer'));
    ch.checked = activa;
    if(typeof toggleCapa === 'function') toggleCapa(ch.getAttribute('data-layer'), ch);
  });
  window.urbisAutoMapeoVisible = false;
  if(typeof autoMapeoCucutaLayer !== 'undefined' && map.hasLayer(autoMapeoCucutaLayer)) map.removeLayer(autoMapeoCucutaLayer);
};
