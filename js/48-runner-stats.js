/* ============================================================================
   URBIS · RUSH STATS — motor de analítica estilo Strava para el módulo Runner.
   Aporta lo que faltaba frente a Strava, SIN backend y con los datos que ya se
   guardan (points con lat/lng/t/acc/alt):
     · Splits / ritmo por kilómetro
     · Gráfica de ritmo
     · Récords personales (mejor ritmo, carrera más larga)
     · Mejores esfuerzos (mejor 1K / 5K continuos, ventana deslizante)
     · Racha de días activos (streak)
     · Reto mensual configurable (km del mes vs meta)
     · Logros / insignias reales derivados del historial
     · Desnivel acumulado (si el GPS entregó altitud)
     · Mapa de calor personal (heatmap aditivo sobre el satelital Leaflet)

   PARTE 1 — Motor puro (testeable en Node vía module.exports).
   PARTE 2 — Renderizadores DOM (solo navegador).
   ============================================================================ */
(function () {
  'use strict';

  // ======================= PARTE 1 · MOTOR PURO =============================
  function haversineM(a, b) {
    if (!a || !b) return 0;
    var R = 6371000, toRad = function (x) { return x * Math.PI / 180; };
    var dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // Distancia acumulada (m) y tiempo (s) desde el inicio, espejo del filtro del runner (<120 m).
  function cumulative(points) {
    var dist = [0], time = [0];
    var t0 = (points[0] && points[0].t) || 0;
    for (var i = 1; i < points.length; i++) {
      var dm = haversineM(points[i - 1], points[i]);
      dist[i] = dist[i - 1] + (dm < 120 ? dm : 0);
      time[i] = (points[i].t && t0) ? (points[i].t - t0) / 1000 : time[i - 1];
    }
    return { dist: dist, time: time };
  }

  // Ritmo por kilómetro: [{km, dist(km), sec, paceSecKm, partial?}]
  function splits(points) {
    if (!points || points.length < 2) return [];
    var c = cumulative(points);
    var totalM = c.dist[c.dist.length - 1];
    function timeAt(targetM) {
      for (var i = 1; i < c.dist.length; i++) {
        if (c.dist[i] >= targetM) {
          var d0 = c.dist[i - 1], d1 = c.dist[i];
          var frac = (d1 - d0) > 0 ? (targetM - d0) / (d1 - d0) : 0;
          return c.time[i - 1] + (c.time[i] - c.time[i - 1]) * frac;
        }
      }
      return c.time[c.time.length - 1];
    }
    var out = [], k = 1, prevTime = 0;
    while (k * 1000 <= totalM) {
      var tt = timeAt(k * 1000);
      out.push({ km: k, dist: 1, sec: tt - prevTime, paceSecKm: tt - prevTime });
      prevTime = tt; k++;
    }
    var leftover = totalM - (k - 1) * 1000;
    if (leftover > 60) { // mostrar el último km parcial si tiene > 60 m
      var tEnd = c.time[c.time.length - 1];
      var seg = tEnd - prevTime, partKm = leftover / 1000;
      out.push({ km: k, dist: partKm, sec: seg, paceSecKm: partKm > 0 ? seg / partKm : 0, partial: true });
    }
    return out;
  }

  function dayKeyDate(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayKey(iso) { return dayKeyDate(new Date(iso || Date.now())); }

  function records(history) {
    var r = { totalKm: 0, totalActividades: history.length, totalSec: 0, carreraMasLargaKm: 0, mejorPaceSecKm: null, masKmUnDiaKm: 0 };
    var perDay = {};
    for (var i = 0; i < history.length; i++) {
      var a = history[i], km = Number(a.distanceKm) || 0, sec = Number(a.elapsed) || 0;
      r.totalKm += km; r.totalSec += sec;
      if (km > r.carreraMasLargaKm) r.carreraMasLargaKm = km;
      if (a.paceSecKm && km >= 1 && (r.mejorPaceSecKm === null || a.paceSecKm < r.mejorPaceSecKm)) r.mejorPaceSecKm = a.paceSecKm;
      var d = dayKey(a.createdAt); perDay[d] = (perDay[d] || 0) + km;
    }
    for (var k in perDay) { if (perDay[k] > r.masKmUnDiaKm) r.masKmUnDiaKm = perDay[k]; }
    return r;
  }

  // Mejor esfuerzo: menor tiempo para cubrir distMeters CONTINUOS en todo el historial.
  function bestEffort(history, distMeters) {
    var best = null;
    for (var i = 0; i < history.length; i++) {
      var pts = history[i].points || [];
      if (pts.length < 2) continue;
      var c = cumulative(pts), totalM = c.dist[c.dist.length - 1];
      if (totalM < distMeters) continue;
      var e = 0;
      for (var j = 0; j < c.dist.length; j++) {
        var target = c.dist[j] + distMeters;
        if (target > totalM) break;
        while (e < c.dist.length && c.dist[e] < target) e++;
        if (e >= c.dist.length) break;
        var d0 = c.dist[e - 1], d1 = c.dist[e];
        var frac = (d1 - d0) > 0 ? (target - d0) / (d1 - d0) : 0;
        var tEnd = c.time[e - 1] + (c.time[e] - c.time[e - 1]) * frac;
        var seg = tEnd - c.time[j];
        if (seg > 0 && (best === null || seg < best.sec)) best = { sec: seg, activityId: history[i].id };
      }
    }
    return best;
  }

  function streak(history) {
    var days = {};
    for (var i = 0; i < history.length; i++) days[dayKey(history[i].createdAt)] = true;
    if (!Object.keys(days).length) return 0;
    var cursor = new Date(); cursor.setHours(0, 0, 0, 0);
    if (!days[dayKeyDate(cursor)]) { cursor.setDate(cursor.getDate() - 1); if (!days[dayKeyDate(cursor)]) return 0; }
    var n = 0;
    while (days[dayKeyDate(cursor)]) { n++; cursor.setDate(cursor.getDate() - 1); }
    return n;
  }

  function monthly(history, year, month) {
    var km = 0, count = 0, sec = 0;
    for (var i = 0; i < history.length; i++) {
      var d = new Date(history[i].createdAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        km += Number(history[i].distanceKm) || 0; count++; sec += Number(history[i].elapsed) || 0;
      }
    }
    return { km: km, count: count, sec: sec };
  }

  // Desnivel acumulado con filtro de histéresis (la altitud GPS es muy ruidosa).
  // Solo cuenta ascensos sostenidos sobre un umbral; ignora el jitter. Devuelve null
  // si no hay suficientes muestras de altitud para un cálculo fiable.
  function elevationGain(points) {
    var alts = [];
    for (var i = 0; i < (points || []).length; i++) {
      var a = points[i].alt;
      if (a != null && !isNaN(a)) alts.push(a);
    }
    if (alts.length < 10) return null;
    var gain = 0, ref = alts[0], thr = 3.0;
    for (var j = 1; j < alts.length; j++) {
      var d = alts[j] - ref;
      if (d > thr) { gain += d; ref = alts[j]; }       // subió de forma sostenida
      else if (d < -thr) { ref = alts[j]; }            // bajó: nueva referencia
      // dentro de la banda de ruido: se ignora
    }
    return Math.round(gain);
  }

  function achievements(history) {
    var r = records(history), st = streak(history);
    var types = {}, early = false, late = false, maxDist = 0;
    for (var i = 0; i < history.length; i++) {
      var a = history[i]; types[a.type] = true;
      var h = new Date(a.createdAt).getHours();
      if (h < 7) early = true; if (h >= 21) late = true;
      if ((Number(a.distanceKm) || 0) > maxDist) maxDist = Number(a.distanceKm) || 0;
    }
    var typeCount = Object.keys(types).length;
    var defs = [
      { id: 'primera', icon: '🎬', titulo: 'Primer paso', desc: 'Completa tu primera actividad', meta: 1, val: history.length },
      { id: 'constante', icon: '🔁', titulo: 'Constante', desc: '10 actividades completadas', meta: 10, val: history.length },
      { id: '5k', icon: '📏', titulo: '5K', desc: '5 km en una sola actividad', meta: 5, val: maxDist },
      { id: '10k', icon: '🏅', titulo: '10K', desc: '10 km en una sola actividad', meta: 10, val: maxDist },
      { id: 'cien', icon: '💯', titulo: 'Centenario', desc: '100 km acumulados', meta: 100, val: r.totalKm },
      { id: 'racha3', icon: '🔥', titulo: 'En racha', desc: '3 días seguidos activo', meta: 3, val: st },
      { id: 'madrugador', icon: '🌄', titulo: 'Madrugador', desc: 'Actividad antes de las 7am', meta: 1, val: early ? 1 : 0 },
      { id: 'buho', icon: '🌙', titulo: 'Búho nocturno', desc: 'Actividad después de las 9pm', meta: 1, val: late ? 1 : 0 },
      { id: 'velocista', icon: '⚡', titulo: 'Velocista', desc: 'Ritmo bajo 6:00 /km', meta: 1, val: (r.mejorPaceSecKm !== null && r.mejorPaceSecKm < 360) ? 1 : 0 },
      { id: 'multi', icon: '🤸', titulo: 'Multideporte', desc: 'Prueba 3 tipos de actividad', meta: 3, val: typeCount }
    ];
    return defs.map(function (d) {
      return { id: d.id, icon: d.icon, titulo: d.titulo, desc: d.desc, conseguido: d.val >= d.meta, progreso: Math.min(1, d.meta > 0 ? d.val / d.meta : 0) };
    });
  }

  var Engine = {
    haversineM: haversineM, cumulative: cumulative, splits: splits, records: records,
    bestEffort: bestEffort, streak: streak, monthly: monthly, elevationGain: elevationGain,
    achievements: achievements
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  if (typeof window !== 'undefined') window.URBISRunnerStats = Engine;

  // Node: el motor ya quedó exportado; no hay DOM que renderizar.
  if (typeof document === 'undefined') return;

  // ===================== PARTE 2 · RENDERIZADORES DOM ======================
  var RUSH = { a: '#ff5e3a', b: '#ff2d78', c: '#a45cff', start: '#37f0b0' };
  var GOAL_KEY = 'urbis_runner_reto_km';

  function p2(n) { return String(n).padStart(2, '0'); }
  function fmtTime(sec) { sec = Math.max(0, Math.floor(sec || 0)); var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? (p2(h) + ':' + p2(m) + ':' + p2(s)) : (p2(m) + ':' + p2(s)); }
  function fmtPace(secKm) { if (!secKm || !isFinite(secKm)) return '--'; var m = Math.floor(secKm / 60), s = Math.round(secKm % 60); return m + ':' + p2(s); }
  function getHistory() { return (typeof window.urbisRunnerLoadHistory === 'function') ? window.urbisRunnerLoadHistory() : []; }

  // ---- Splits (lista con barras) ----
  function renderSplits(container, session) {
    if (!container) return;
    var sp = splits((session && session.points) || []);
    if (sp.length < 1) { container.innerHTML = ''; return; }
    var valid = sp.filter(function (s) { return !s.partial; });
    var paces = (valid.length ? valid : sp).map(function (s) { return s.paceSecKm; });
    var fastest = Math.min.apply(null, paces), slowest = Math.max.apply(null, paces);
    var rows = sp.map(function (s) {
      var isFast = !s.partial && s.paceSecKm === fastest && valid.length > 1;
      var rel = (slowest > fastest) ? (s.paceSecKm - fastest) / (slowest - fastest) : 0;
      var barW = 28 + (1 - rel) * 72; // más rápido => barra más larga
      return '<div class="rush-split-row' + (isFast ? ' fast' : '') + '">' +
        '<span class="rush-split-km">' + (s.partial ? s.dist.toFixed(2) + ' km' : 'KM ' + s.km) + '</span>' +
        '<span class="rush-split-bar"><i style="width:' + barW.toFixed(0) + '%"></i></span>' +
        '<span class="rush-split-pace">' + fmtPace(s.paceSecKm) + (isFast ? ' ⚡' : '') + '</span>' +
        '</div>';
    }).join('');
    var elev = elevationGain((session && session.points) || []);
    var elevHtml = (elev !== null && elev >= 5) ? '<div class="rush-split-elev">⛰️ Desnivel acumulado: <b>' + elev + ' m</b></div>' : '';
    container.innerHTML = '<div class="rush-splits-title">Ritmo por kilómetro</div>' + rows + elevHtml;
  }

  // ---- Gráfica de ritmo (faster = arriba) ----
  function renderPaceChart(canvas, session) {
    if (!canvas || !canvas.getContext) return;
    var sp = splits((session && session.points) || []).filter(function (s) { return !s.partial; });
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, W, H);
    if (sp.length < 1) {
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '600 17px Segoe UI,system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('Recorre al menos 1 km para ver tu ritmo', W / 2, H / 2);
      return;
    }
    var paces = sp.map(function (s) { return s.paceSecKm; });
    var minP = Math.min.apply(null, paces), maxP = Math.max.apply(null, paces);
    if (maxP - minP < 12) { maxP += 30; minP = Math.max(1, minP - 30); }
    var padL = 50, padR = 16, padT = 18, padB = 28;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var x = function (i) { return sp.length > 1 ? padL + (i / (sp.length - 1)) * plotW : padL + plotW / 2; };
    var y = function (pace) { return padT + ((pace - minP) / (maxP - minP)) * plotH; }; // min(rápido) arriba
    // gridlines + etiquetas (rápido / medio / lento)
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '600 11px Segoe UI,system-ui,sans-serif'; ctx.textAlign = 'right';
    [minP, (minP + maxP) / 2, maxP].forEach(function (pace) {
      var yy = y(pace);
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
      ctx.fillText(fmtPace(pace), padL - 6, yy + 4);
    });
    // área bajo la curva
    var grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(255,45,120,.35)'); grad.addColorStop(1, 'rgba(255,45,120,0)');
    ctx.beginPath(); ctx.moveTo(x(0), padT + plotH);
    sp.forEach(function (s, i) { ctx.lineTo(x(i), y(s.paceSecKm)); });
    ctx.lineTo(x(sp.length - 1), padT + plotH); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // línea
    ctx.beginPath();
    sp.forEach(function (s, i) { i ? ctx.lineTo(x(i), y(s.paceSecKm)) : ctx.moveTo(x(i), y(s.paceSecKm)); });
    var lg = ctx.createLinearGradient(padL, 0, W - padR, 0);
    lg.addColorStop(0, RUSH.a); lg.addColorStop(.5, RUSH.b); lg.addColorStop(1, RUSH.c);
    ctx.strokeStyle = lg; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    // puntos + etiqueta KM
    ctx.textAlign = 'center';
    sp.forEach(function (s, i) {
      ctx.beginPath(); ctx.arc(x(i), y(s.paceSecKm), 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      if (sp.length <= 12) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '600 10px Segoe UI,system-ui,sans-serif'; ctx.fillText(String(s.km), x(i), padT + plotH + 16); }
    });
  }

  // ---- Panel "pro" en la pantalla Progreso ----
  function recCard(icon, label, val) {
    return '<div class="rush-rec"><span class="rush-rec-ic">' + icon + '</span><b>' + val + '</b><small>' + label + '</small></div>';
  }
  function achBadge(a) {
    var cls = a.conseguido ? 'got' : 'locked';
    var ring = a.conseguido ? '' : '<i class="rush-ach-prog" style="width:' + Math.round(a.progreso * 100) + '%"></i>';
    return '<div class="rush-ach ' + cls + '" title="' + a.desc + '"><span class="rush-ach-ic">' + a.icon + '</span><b>' + a.titulo + '</b><small>' + a.desc + '</small><div class="rush-ach-bar">' + ring + '</div></div>';
  }
  function renderProgresoPanel() {
    var panel = document.getElementById('rush-pro-panel');
    if (!panel) return;
    var history = getHistory();
    if (!history.length) { panel.innerHTML = ''; return; }
    var r = records(history), b5 = bestEffort(history, 5000), b1 = bestEffort(history, 1000);
    var st = streak(history), now = new Date(), mes = monthly(history, now.getFullYear(), now.getMonth());
    var goal = parseFloat(localStorage.getItem(GOAL_KEY) || '30') || 30;
    var pct = Math.min(100, goal > 0 ? (mes.km / goal) * 100 : 0);
    var ach = achievements(history), got = ach.filter(function (a) { return a.conseguido; }).length;
    var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    panel.innerHTML =
      '<div class="rush-pro-section"><div class="rush-pro-h">🏆 Récords personales</div>' +
        '<div class="rush-pro-grid">' +
          recCard('⚡', 'Mejor ritmo', r.mejorPaceSecKm !== null ? fmtPace(r.mejorPaceSecKm) + ' /km' : '--') +
          recCard('📏', 'Más larga', r.carreraMasLargaKm.toFixed(2) + ' km') +
          recCard('🏅', 'Mejor 5K', b5 ? fmtTime(b5.sec) : '--') +
          recCard('🚀', 'Mejor 1K', b1 ? fmtTime(b1.sec) : '--') +
        '</div></div>' +
      '<div class="rush-pro-section"><div class="rush-pro-h">🎯 Reto de ' + meses[now.getMonth()] +
        ' <button class="rush-goal-edit" onclick="window.urbisRunnerEditarReto&&window.urbisRunnerEditarReto()">editar meta</button></div>' +
        '<div class="rush-reto-card">' +
          '<div class="rush-reto-top"><b>' + mes.km.toFixed(1) + ' km</b><span>de ' + goal + ' km</span></div>' +
          '<div class="rush-reto-bar"><i style="width:' + pct.toFixed(0) + '%"></i></div>' +
          '<div class="rush-reto-foot">' + (mes.km >= goal ? '¡Meta cumplida! 🎉' : (mes.count + ' actividad(es) este mes · faltan ' + Math.max(0, goal - mes.km).toFixed(1) + ' km')) + '</div>' +
        '</div></div>' +
      '<div class="rush-pro-section"><div class="rush-streak-card"><span class="rush-streak-fire">🔥</span>' +
        '<div><b>' + st + ' día' + (st === 1 ? '' : 's') + ' de racha</b><small>' + (st > 0 ? '¡Sigue así, no rompas la cadena!' : 'Sal hoy y empieza tu racha') + '</small></div></div></div>' +
      '<div class="rush-pro-section"><div class="rush-pro-h">🎖️ Logros <span class="rush-ach-count">' + got + '/' + ach.length + '</span></div>' +
        '<div class="rush-ach-grid">' + ach.map(achBadge).join('') + '</div></div>' +
      '<button class="rush-heatmap-btn" onclick="window.urbisRunnerMapaCalor&&window.urbisRunnerMapaCalor()">🔥 Ver mi mapa de calor</button>';
  }

  window.urbisRunnerEditarReto = function () {
    var cur = parseFloat(localStorage.getItem(GOAL_KEY) || '30') || 30;
    var v = prompt('Meta de kilómetros para este mes:', cur);
    if (v === null) return;
    var n = parseFloat(v);
    if (isNaN(n) || n <= 0) { alert('Ingresa un número válido de km.'); return; }
    localStorage.setItem(GOAL_KEY, String(n));
    renderProgresoPanel();
  };

  // ---- Mapa de calor personal (heatmap aditivo sobre el satelital) ----
  window.urbisRunnerMapaCalor = function () {
    var history = getHistory();
    var routes = history.map(function (a) { return a.points || []; }).filter(function (p) { return p.length > 1; });
    if (!routes.length) { alert('Aún no tienes recorridos para tu mapa de calor.'); return; }
    var lmap = (typeof map !== 'undefined' && map && map.getContainer) ? map : null;
    if (!lmap) { alert('El mapa no está disponible en este momento.'); return; }
    if (typeof window.UrbisMobileAppV58 !== 'undefined') window.UrbisMobileAppV58.show('map');

    setTimeout(function () {
      var all = [];
      routes.forEach(function (r) { r.forEach(function (p) { all.push([p.lat, p.lng]); }); });
      try { lmap.fitBounds(L.latLngBounds(all), { padding: [50, 50], animate: true }); } catch (e) {}

      var mapEl = lmap.getContainer();
      var cv = document.createElement('canvas');
      cv.id = 'rush-heat-cv';
      cv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:900;';
      if (mapEl.style.position !== 'absolute' && mapEl.style.position !== 'fixed') mapEl.style.position = 'relative';
      mapEl.appendChild(cv);
      var ctx = cv.getContext('2d');

      function draw() {
        cv.width = mapEl.offsetWidth || 320; cv.height = mapEl.offsetHeight || 480;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        routes.forEach(function (r) {
          ctx.beginPath();
          var started = false;
          for (var i = 0; i < r.length; i++) {
            var px; try { px = lmap.latLngToContainerPoint([r[i].lat, r[i].lng]); } catch (e) { continue; }
            started ? ctx.lineTo(px.x, px.y) : (ctx.moveTo(px.x, px.y), started = true);
          }
          ctx.strokeStyle = 'rgba(255,80,20,0.30)'; ctx.lineWidth = 8; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,210,70,0.22)'; ctx.lineWidth = 3; ctx.stroke();
        });
        ctx.globalCompositeOperation = 'source-over';
      }
      draw();
      try { lmap.on('moveend zoomend', draw); } catch (e) {}

      var hud = document.createElement('div');
      hud.id = 'rush-heat-hud'; hud.className = 'rush-heat-hud';
      hud.innerHTML = '<div class="rush-heat-top"><span>🔥 Mi mapa de calor · ' + routes.length + ' recorrido' + (routes.length === 1 ? '' : 's') + '</span>' +
        '<button id="rush-heat-x" aria-label="Cerrar">✕</button></div>' +
        '<div class="rush-heat-legend"><span class="rush-heat-dot dim"></span>menos<span class="rush-heat-dot hot"></span>más frecuente</div>';
      document.body.appendChild(hud);
      document.getElementById('rush-heat-x').onclick = function () {
        try { lmap.off('moveend zoomend', draw); } catch (e) {}
        if (cv.parentNode) cv.parentNode.removeChild(cv);
        if (hud.parentNode) hud.parentNode.removeChild(hud);
      };
    }, 420);
  };

  // Exponer renderizadores para js/20 (resumen + progreso) y js/46 (detalle).
  window.urbisRunnerStatsRenderProgreso = renderProgresoPanel;
  window.urbisRunnerSplitsRender = renderSplits;
  window.urbisRunnerPaceChart = renderPaceChart;
})();
