/* URBIS · UNA VÍA ES UN TRAMO, NO UN PUNTO (js/03g)
   ─────────────────────────────────────────────────────────────────────────
   Pedido con estas palabras: «una línea o polilínea para las vías». Es lo que
   le faltaba al estado (v992) y a la superficie (v1000) para describir algo:
   «asfalto, regular» sobre un punto no dice de qué cuadra se habla, y quien
   tiene que arreglarla necesita saber dónde empieza y dónde termina.

   ── Lo que NO cambia, a propósito ─────────────────────────────────────
   El punto se queda. El reporte sigue teniendo su `lat`/`lng` —es lo que lo
   dibuja en el mapa, lo que lo encuentra una búsqueda por cercanía y lo que
   `proCity.editLat` usa para volver a abrirlo al editar—, y el tramo es un
   ATRIBUTO suyo. Mover el punto al centro de la línea habría sido cambiar la
   identidad de la fila para ganar un detalle de dibujo.

   Y por eso el tramo es OPCIONAL: sin dibujarlo, mapear una vía funciona
   exactamente como hasta la v1001. Un campo obligatorio que cuesta seis
   toques se contesta con relleno, que es la regla de la v973.

   ── La codificación cabe en una casilla del reparto ───────────────────
   `lat,lng;lat,lng;…` con seis decimales, que es lo que `guardarTrazo` ya usa
   en js/68: once centímetros, más de lo que da un dedo en una pantalla.
   Guardar quince decimales solo abulta.

   Los separadores están libres: la v989 midió que `;` `:` `+` y `>` no
   aparecen en ninguna de las 631 cadenas del catálogo, y las casillas de la
   descripción se parten por ` | `, así que un separador de adentro no
   colisiona con nada.

   ── El modo de dibujo es de ESTE módulo ───────────────────────────────
   La capa, los toques y el estado viven acá, y js/20 solo llama. Es la forma
   que `URBIS_PC_ANALISIS` ya tiene para el polígono de análisis, y el motivo
   es el mismo: un modo que intercepta los toques del mapa tiene que poder
   apagarse desde un solo sitio. Si se filtrara, mapear un punto dejaría de
   funcionar — y eso es lo que se hace todos los días. */
(function(){
  'use strict';

  var DEC = 1e6;                 /* seis decimales: once centímetros */
  var MAX_PUNTOS = 60;           /* una cuadra son dos o tres; sesenta es una
                                    avenida entera y ya abulta la casilla */
  var st = { activo:false, pts:[], capa:null, alCambiar:null };

  function redondear(x){ return Math.round(Number(x) * DEC) / DEC; }

  /* ── La codificación, y su vuelta ───────────────────────────────────── */
  function codificar(pts){
    if(!pts || !pts.length) return '';
    return pts.map(function(p){
      return redondear(p.lat) + ',' + redondear(p.lng);
    }).join(';');
  }
  function decodificar(txt){
    var t = String(txt || '').trim();
    if(!t || t === 'undefined') return [];
    var out = [];
    t.split(';').forEach(function(par){
      var ab = par.split(',');
      if(ab.length !== 2) return;
      var la = parseFloat(ab[0]), ln = parseFloat(ab[1]);
      /* Un par que no sea un par de coordenadas se DESCARTA y no revienta:
         la casilla la puede haber escrito una versión anterior o un editor a
         mano, y media línea dibujada es mejor que ninguna. */
      if(!isFinite(la) || !isFinite(ln)) return;
      if(la < -90 || la > 90 || ln < -180 || ln > 180) return;
      out.push({ lat: la, lng: ln });
    });
    return out;
  }

  /* ── Cuánto mide, en metros ──────────────────────────────────────────
     Haversine, que es lo que usa el resto del proyecto para distancias
     cortas. Se calcula acá y en ningún otro sitio: dos maneras de medir el
     mismo tramo darían dos largos bajo el mismo nombre (v879). */
  function largoM(pts){
    if(!pts || pts.length < 2) return 0;
    var R = 6371000, tot = 0;
    for(var i = 1; i < pts.length; i++){
      var a = pts[i-1], b = pts[i];
      var dLat = (b.lat - a.lat) * Math.PI / 180;
      var dLng = (b.lng - a.lng) * Math.PI / 180;
      var la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
      var h = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(la1) * Math.cos(la2) * Math.sin(dLng/2) * Math.sin(dLng/2);
      tot += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    return Math.round(tot);
  }
  function largoTexto(pts){
    var m = largoM(pts);
    if(!m) return '';
    return m >= 1000 ? (Math.round(m / 100) / 10).toString().replace('.', ',') + ' km'
                     : m + ' m';
  }

  /* ── El dibujo ───────────────────────────────────────────────────────── */
  function capa(){
    if(st.capa) return st.capa;
    if(!window.L || !window.map) return null;
    st.capa = L.layerGroup().addTo(window.map);
    return st.capa;
  }
  function repintar(){
    var c = capa(); if(!c) return;
    c.clearLayers();
    if(st.pts.length > 1){
      L.polyline(st.pts.map(function(p){ return [p.lat, p.lng]; }),
        { color:'#0f7ea8', weight:6, opacity:.9, lineCap:'round', lineJoin:'round' }).addTo(c);
    }
    st.pts.forEach(function(p, i){
      L.circleMarker([p.lat, p.lng], {
        radius: i === 0 ? 7 : 5, color:'#fff', weight:2,
        fillColor: i === 0 ? '#0b6e91' : '#12a0cc', fillOpacity:1
      }).addTo(c);
    });
    if(typeof st.alCambiar === 'function'){
      try{ st.alCambiar(st.pts.length, largoTexto(st.pts)); }catch(e){}
    }
  }

  function iniciar(opts){
    st.activo = true;
    st.pts = (opts && opts.pts) ? decodificar(codificar(opts.pts)) : [];
    st.alCambiar = (opts && opts.alCambiar) || null;
    repintar();
  }
  function agregarPunto(lat, lng){
    if(!st.activo) return false;
    if(st.pts.length >= MAX_PUNTOS) return false;
    st.pts.push({ lat: Number(lat), lng: Number(lng) });
    repintar();
    return true;
  }
  function deshacer(){
    if(!st.activo || !st.pts.length) return false;
    st.pts.pop(); repintar(); return true;
  }
  /* Terminar devuelve la cadena y APAGA el modo. Cancelar apaga sin devolver
     nada: son dos salidas y quien llama necesita distinguirlas, porque una
     escribe en el formulario y la otra no. */
  function terminar(){
    var txt = st.pts.length >= 2 ? codificar(st.pts) : '';
    apagar();
    return txt;
  }
  function cancelar(){ apagar(); }
  function apagar(){
    st.activo = false; st.pts = []; st.alCambiar = null;
    if(st.capa){ try{ st.capa.clearLayers(); }catch(e){} }
  }

  /* Lo que se dibuja de un tramo YA GUARDADO, sobre la capa que le pasen.
     No crea capa propia: quien pinta los puntos de Pro City la limpia en cada
     repintado, y una capa aparte se quedaría con líneas de puntos borrados. */
  function pintarGuardado(capaDestino, pts, color){
    if(!capaDestino || !pts || pts.length < 2 || !window.L) return null;
    var ll = pts.map(function(p){ return [p.lat, p.lng]; });
    /* Dos trazos: el halo ancho hace que la línea se siga viendo sobre una
       foto satelital, y va por debajo del color, que es el del estado. */
    L.polyline(ll, { color:'#fff', weight:8, opacity:.55, lineCap:'round', lineJoin:'round' }).addTo(capaDestino);
    return L.polyline(ll, { color: color || '#0f7ea8', weight:4, opacity:.95,
      lineCap:'round', lineJoin:'round' }).addTo(capaDestino);
  }

  window.URBIS_TRAMO = {
    MAX_PUNTOS: MAX_PUNTOS,
    codificar: codificar,
    decodificar: decodificar,
    largoM: largoM,
    largoTexto: largoTexto,
    estaDibujando: function(){ return !!st.activo; },
    puntos: function(){ return st.pts.slice(); },
    iniciar: iniciar,
    agregarPunto: agregarPunto,
    deshacer: deshacer,
    terminar: terminar,
    cancelar: cancelar,
    pintarGuardado: pintarGuardado
  };
})();
