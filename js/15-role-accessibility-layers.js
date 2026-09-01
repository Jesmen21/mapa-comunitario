// ==========================================
// URBIS V8 · Capas por rol + modo funcionario simple + bienestar opcional
// ==========================================
/* Capas que un ciudadano ve al ENTRAR, sin tocar nada.
   ─────────────────────────────────────────────────────────────────────────
   Esta lista se quedó corta y el efecto era grave: quien publicaba un evento
   comunitario NO lo veía aparecer en el mapa. Salía en la pestaña de Eventos
   —que lee los datos directamente— pero su capa nunca se montaba, así que en
   el mapa no había ningún pin. Lo mismo con los hechos del conflicto armado,
   los desastres y los riesgos del terreno: cuatro categorías que se fueron
   agregando después de que esta lista se escribiera, y que nadie añadió aquí.

   Se nota de dónde venía el problema: los renderizadores FORZADOS de los
   Juegos URBIS (js/47) y de las alertas nacionales (js/50) existen justamente
   porque sus marcadores desaparecían — se rodeó el síntoma con una capa
   propia siempre montada, sin ver que la causa era esta lista.

   Regla para mantenerla: aquí va todo lo que un VECINO reporta y otro vecino
   necesita ver. Fuera quedan las capas de análisis territorial (Vivienda,
   Comercio, Matriz de Usos…), que son de Pro City y sí deben empezar
   apagadas para no tapar el mapa ciudadano. */
const URBIS_ALERT_LAYER_KEYS = [
  '🚨 Alertas y Riesgos Urbanos',
  '🚗 Reportes de Tráfico',
  'Salud y Emergencias',
  '🎪 Eventos Comunitarios',
  '🛡️ Seguridad Nacional y Conflicto',
  '🌪️ Desastres Naturales y Clima',
  '⛰️ Riesgos del Terreno'
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
