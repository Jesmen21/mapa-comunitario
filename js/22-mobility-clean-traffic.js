/* URBIS V69 · Movilidad limpia + tráfico inteligente sobre ruta activa
   - No muestra botones/capas falsas de Tráfico/Cámara/Alertas dentro del mapa.
   - Renderiza tráfico únicamente sobre la ruta activa.
   - Deja preparado el punto de integración para Google/Mapbox/HERE/OpenRouteService.
*/
(function(){
  'use strict';
  const TRAFFIC_COLORS = {
    fluid: '#13b84a',
    moderate: '#ff8a00',
    congested: '#ff2d2d',
    halo: '#40eaff',
    alt: '#0078ff'
  };
  let activeTrafficLayers = [];

  function safe(fn){ try { return fn(); } catch(e) { return null; } }
  function hasRouteLayer(){ return typeof rutaLayer !== 'undefined' && rutaLayer && typeof rutaLayer.addLayer === 'function'; }
  function addLayer(layer){
    if(!layer || !hasRouteLayer()) return;
    layer.addTo(rutaLayer);
    activeTrafficLayers.push(layer);
  }
  function clear(){
    if(!hasRouteLayer()) { activeTrafficLayers = []; return; }
    activeTrafficLayers.forEach(layer => { try { if(rutaLayer.hasLayer(layer)) rutaLayer.removeLayer(layer); } catch(e){} });
    activeTrafficLayers = [];
  }

  function trafficFactor(){
    const local = safe(() => typeof factorTraficoEstimado === 'function' ? factorTraficoEstimado() : null);
    if(local) return Number(local) || 1;
    const h = new Date().getHours() + new Date().getMinutes()/60;
    if((h >= 6.4 && h <= 8.7) || (h >= 17 && h <= 19.6)) return 1.38;
    if(h >= 11.8 && h <= 14.1) return 1.18;
    return 1.05;
  }

  function levelForSegment(index, total){
    const f = trafficFactor();
    const pos = total <= 1 ? 0 : index / (total - 1);
    if(f >= 1.35){
      if(pos > .28 && pos < .48) return 'congested';
      if(pos > .48 && pos < .67) return 'moderate';
      return 'fluid';
    }
    if(f >= 1.15){
      if(pos > .36 && pos < .62) return 'moderate';
      return 'fluid';
    }
    return 'fluid';
  }

  function levelLabel(level){
    if(level === 'congested') return 'Congestión adelante';
    if(level === 'moderate') return 'Tráfico moderado adelante';
    return 'Tráfico fluido';
  }

  function makeSegments(latLngs, desired=14){
    const pts = Array.isArray(latLngs) ? latLngs : [];
    if(pts.length < 2) return [];
    const step = Math.max(1, Math.floor((pts.length - 1) / desired));
    const out = [];
    for(let i=0; i<pts.length-1; i += step){
      const seg = pts.slice(i, Math.min(pts.length, i + step + 1));
      if(seg.length >= 2) out.push(seg);
    }
    return out;
  }

  function midpointOf(seg){
    if(!seg || !seg.length) return null;
    return seg[Math.floor(seg.length / 2)] || seg[0];
  }

  function renderAlternative(route){
    const alt = route && Array.isArray(route._alternatives) ? route._alternatives[0] : null;
    if(!alt || !alt.geometry || !Array.isArray(alt.geometry.coordinates)) return;
    const coords = alt.geometry.coordinates.map(c => [c[1], c[0]]);
    if(coords.length < 2) return;
    addLayer(L.polyline(coords, {
      color: TRAFFIC_COLORS.alt,
      weight: 5,
      opacity: .36,
      dashArray: '10 12',
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
      className: 'urbis-route-alternative-smart'
    }));
  }

  function providerName(){
    const cfg = window.URBIS_CONFIG || {};
    const traffic = cfg.TRAFFIC || {};
    return String(traffic.provider || cfg.TRAFFIC_PROVIDER || 'estimated').toLowerCase();
  }

  function summary(route){
    const provider = providerName();
    const f = trafficFactor();
    const hasAlt = !!(route && Array.isArray(route._alternatives) && route._alternatives.length);
    const trafficText = f >= 1.35 ? 'Tráfico alto detectado' : (f >= 1.15 ? 'Tráfico moderado adelante' : 'Ruta fluida');
    const altText = hasAlt ? 'Ruta alternativa encontrada' : 'Ruta más rápida disponible';
    const sourceText = provider === 'estimated' ? 'estimación local hasta conectar API real' : `fuente: ${provider}`;
    return { trafficText, altText, sourceText };
  }

  function renderActiveRouteTraffic(route){
    clear();
    if(!route || !route.geometry || !Array.isArray(route.geometry.coordinates) || !hasRouteLayer() || !window.L) return;
    const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
    if(coords.length < 2) return;
    renderAlternative(route);
    const segments = makeSegments(coords, 15);
    const counts = {fluid:0, moderate:0, congested:0};
    let calloutSeg = null;
    segments.forEach((seg, index) => {
      const level = levelForSegment(index, segments.length);
      counts[level] = (counts[level] || 0) + 1;
      if((level === 'congested' || level === 'moderate') && !calloutSeg) calloutSeg = {seg, level};
      addLayer(L.polyline(seg, {
        color: TRAFFIC_COLORS[level] || TRAFFIC_COLORS.fluid,
        weight: 7,
        opacity: .96,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
        className: `urbis-route-traffic-segment urbis-traffic-${level}`
      }));
    });
    if(calloutSeg){
      const mid = midpointOf(calloutSeg.seg);
      if(mid){
        const icon = L.divIcon({
          className: '',
          html: `<div class="urbis-traffic-callout ${calloutSeg.level}"><span></span>${levelLabel(calloutSeg.level)}</div>`,
          iconSize: [172, 42],
          iconAnchor: [86, 42]
        });
        addLayer(L.marker(mid, { icon, interactive:false, zIndexOffset:2100 }));
      }
    }
    const s = summary(route);
    document.body.classList.add('urbis-traffic-route-active');
    window.dispatchEvent(new CustomEvent('urbis:traffic-route-rendered', { detail: {...s, counts} }));
  }

  window.urbisMobilityTrafficClear = function(){
    clear();
    document.body.classList.remove('urbis-traffic-route-active');
  };
  window.urbisMobilityTrafficRenderActiveRoute = renderActiveRouteTraffic;
  window.urbisMobilityTrafficSummary = summary;

  // Estado visual: las opciones falsas quedan apagadas aunque algún HTML viejo quede en caché.
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('urbis-mobility-clean-v69');
    document.querySelectorAll('[data-u52-call="traffic"],[data-u52-call="cameras"]').forEach(el => el.setAttribute('hidden',''));
  });
})();
