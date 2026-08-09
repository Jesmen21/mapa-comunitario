/* ============================================================================
   URBIS · Módulo MASCOTAS / Fundación animalista (perritos 🐶 y gaticos 🐱)
   Ecosistema propio: animalitos que necesitan ayuda, donaciones, reportar un
   peludito, muro de apoyo y fundaciones aliadas. Estética cálida propia.
   Persistencia local (localStorage) para funcionar ya; preparado para migrar
   a Apps Script (mismas funciones de datos) cuando quieras nube compartida.
   ============================================================================ */
(function(){
  'use strict';

  var LS = {
    animales: 'urbis_mascotas_animales_v2',
    mensajes: 'urbis_mascotas_mensajes_v2',
    aportes:  'urbis_mascotas_aportes_v2'
  };
  var _seccionActiva = 'ayuda';
  // El módulo puede vivir en el sidebar (#mascotas-root) o en la pantalla móvil
  // (#mascotas-root-mobile). Renderiza en el contenedor activo y limpia el otro
  // para no duplicar IDs de campos.
  var _rootId = 'mascotas-root';
  var _todosLosRoots = ['mascotas-root', 'mascotas-root-mobile'];
  function rootEl(){ return document.getElementById(_rootId); }

  // ---- utilidades ----
  function pesos(n){ return '$' + (Number(n)||0).toLocaleString('es-CO'); }
  function leer(key, fallback){
    try{ var raw = localStorage.getItem(key); if(!raw) return fallback; var v = JSON.parse(raw); return v == null ? fallback : v; }
    catch(e){ return fallback; }
  }
  function guardar(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }
  function escapar(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function yoNombre(){
    try{
      var id = (typeof urbisIdentidadActual === 'function') ? urbisIdentidadActual() : {};
      return (id.nombre || id.usuario || 'Amigo peludo').toString().split(' ')[0];
    }catch(e){ return 'Amigo peludo'; }
  }
  function inicial(n){ return (String(n||'?').trim()[0] || '?').toUpperCase(); }

  // ---- datos semilla ----
  // Arrancamos en CERO (realista): sin animalitos ni mensajes de ejemplo. Los datos
  // crecen con reportes y mensajes REALES de la comunidad.
  function animalesSemilla(){ return []; }
  function mensajesSemilla(){ return []; }

  function getAnimales(){ var a = leer(LS.animales, null); if(!a){ a = animalesSemilla(); guardar(LS.animales, a); } return a; }
  function setAnimales(a){ guardar(LS.animales, a); }
  function getMensajes(){ var m = leer(LS.mensajes, null); if(!m){ m = mensajesSemilla(); guardar(LS.mensajes, m); } return m; }
  function setMensajes(m){ guardar(LS.mensajes, m); }
  function getAportes(){ return leer(LS.aportes, []); }
  function setAportes(a){ guardar(LS.aportes, a); }

  // ---- métricas ----
  function metricas(){
    var animales = getAnimales();
    var aportes = getAportes();
    var totalDonado = aportes.reduce(function(s,a){ return s + (Number(a.monto)||0); }, 0);
    var enHogar = animales.filter(function(a){ return a.estado === 'hogar'; }).length;
    var ayudados = aportes.length;
    return { peluditos:animales.length, donado:totalDonado, ayudados:ayudados, hogares:enHogar };
  }

  // ============================ RENDER ============================
  function render(targetId){
    if(targetId) _rootId = targetId;
    // Limpia las otras instancias para no duplicar IDs de campos.
    _todosLosRoots.forEach(function(id){ if(id !== _rootId){ var e = document.getElementById(id); if(e) e.innerHTML = ''; } });
    var root = rootEl();
    if(!root) return;
    var m = metricas();
    root.innerHTML =
      '<div class="mascotas-shell">' +
        '<div class="paw-hero">' +
          '<div class="paw-tag">🐾 Fundación animalista URBIS</div>' +
          '<div class="paw-emoji">🐶🐱</div>' +
          '<h3>Patitas URBIS</h3>' +
          '<p>Una red para rescatar, cuidar y dar hogar a perritos y gaticos de Cúcuta. Tu ayuda cambia una vida. 💛</p>' +
        '</div>' +
        '<div class="paw-stats">' +
          '<div class="paw-stat" style="animation-delay:.05s"><b>' + m.peluditos + '</b><span>Peluditos activos</span></div>' +
          '<div class="paw-stat" style="animation-delay:.12s"><b>' + (m.donado>0?pesos(m.donado):'$0') + '</b><span>Recaudado contigo</span></div>' +
          '<div class="paw-stat" style="animation-delay:.19s"><b>' + m.hogares + '</b><span>Buscan hogar</span></div>' +
        '</div>' +
        '<div class="paw-nav">' +
          navBtn('ayuda','💗 Ayudar') +
          navBtn('donar','🎁 Donar') +
          navBtn('reportar','📣 Reportar') +
          navBtn('muro','💬 Muro') +
          navBtn('fundaciones','🏠 Fundaciones') +
        '</div>' +
        seccionAyuda() +
        seccionDonar() +
        seccionReportar() +
        seccionMuro() +
        seccionFundaciones() +
      '</div>';
    activarSeccion(_seccionActiva);
    asegurarToast();
  }

  function navBtn(id, label){
    return '<button data-paw-tab="' + id + '" onclick="mascotaTab(\'' + id + '\',this)">' + label + '</button>';
  }

  // -------- Sección: Ayudar (feed de animalitos) --------
  function seccionAyuda(){
    var animales = getAnimales();
    var cuerpo = animales.length
      ? animales.map(cardAnimal).join('')
      : '<div class="paw-empty"><div class="paw-empty-ic">🐾</div><b>Aún no hay peluditos reportados</b><small>Cuando alguien reporte un perrito o gatico que necesita ayuda, aparecerá aquí. ¿Conoces a uno? Toca “📣 Reportar”.</small></div>';
    return '<div class="paw-section" data-paw-section="ayuda">' +
      '<div class="paw-section-title">💗 Animalitos que necesitan ayuda</div>' +
      '<p class="paw-section-help">Cada peludito tiene una historia. Apadrina con una donación, ofrécete a ayudar o dale un hogar. Lo que para ti es poco, para ellos lo es todo.</p>' +
      cuerpo +
    '</div>';
  }
  function cardAnimal(a){
    var esCat = a.tipo === 'gato';
    var badge = a.estado === 'urgente' ? '<span class="paw-badge urgente">Urgente</span>'
              : a.estado === 'hogar' ? '<span class="paw-badge hogar">Busca hogar</span>'
              : '<span class="paw-badge proceso">En proceso</span>';
    var needs = (a.necesita||[]).map(function(n){ return '<span class="paw-need">' + escapar(n) + '</span>'; }).join('');
    var goal = '';
    if(a.meta && a.meta > 0){
      var pct = Math.min(100, Math.round((a.recaudado / a.meta) * 100));
      goal = '<div class="paw-goal"><div class="paw-goal-bar"><div class="paw-goal-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="paw-goal-text"><span>' + pesos(a.recaudado) + ' recaudado</span><span>Meta ' + pesos(a.meta) + '</span></div></div>';
    }
    var btnPrincipal = a.estado === 'hogar'
      ? '<button class="paw-btn primary" onclick="mascotaAdoptar(\'' + a.id + '\')">🏠 Quiero adoptar</button>'
      : '<button class="paw-btn primary" onclick="mascotaDonarA(\'' + a.id + '\')">🎁 Apadrinar</button>';
    return '<div class="paw-card">' +
        '<div class="paw-card-top">' +
          '<div class="paw-avatar' + (esCat?' cat':'') + '">' + (a.emoji || (esCat?'🐱':'🐶')) + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<h4>' + escapar(a.nombre) + ' ' + badge + '</h4>' +
            '<p class="paw-meta">' + escapar(a.sexo||'') + (a.edad?' · ' + escapar(a.edad):'') + (a.zona?' · 📍 ' + escapar(a.zona):'') + '</p>' +
          '</div>' +
        '</div>' +
        '<p class="paw-story">' + escapar(a.historia) + '</p>' +
        '<div class="paw-needs">' + needs + '</div>' +
        goal +
        '<div class="paw-card-actions">' +
          btnPrincipal +
          '<button class="paw-btn soft" onclick="mascotaAyudar(\'' + a.id + '\')">🙌 Ayudar</button>' +
        '</div>' +
    '</div>';
  }

  // -------- Sección: Donar --------
  function seccionDonar(){
    var opciones = [
      { v:5000,  k:'1 día de comida 🍚' },
      { v:10000, k:'Desparasitar 💊' },
      { v:20000, k:'Vacuna 💉' },
      { v:50000, k:'Media cirugía 🏥' }
    ];
    var chips = opciones.map(function(o){
      return '<div class="paw-amount" data-monto="' + o.v + '" onclick="mascotaSetMonto(this,' + o.v + ')"><div>' + pesos(o.v) + '</div><small>' + o.k + '</small></div>';
    }).join('');
    return '<div class="paw-section" data-paw-section="donar">' +
      '<div class="paw-section-title">🎁 Hacer una donación</div>' +
      '<p class="paw-section-help">Elige cuánto quieres aportar. El 100% va para comida, atención veterinaria y rescate de los peluditos.</p>' +
      '<div class="paw-donate-card">' +
        '<div class="paw-amounts">' + chips + '</div>' +
        '<div class="paw-field"><label>Otro valor (COP)</label><input id="paw-monto-otro" type="number" inputmode="numeric" placeholder="Ej: 30000" oninput="mascotaMontoLibre(this.value)"></div>' +
        '<div class="paw-field" style="margin-top:6px"><label>¿A nombre de quién? (opcional)</label><input id="paw-donante" type="text" placeholder="Tu nombre o anónimo"></div>' +
        '<div style="font-weight:800;font-size:.82rem;margin:14px 0 6px;color:var(--paw-ink)">Métodos de pago</div>' +
        '<div class="paw-pay">' +
          payRow('💜','Nequi','3001234567 · configura tu número','3001234567') +
          payRow('❤️','Daviplata','3007654321 · configura tu número','3007654321') +
          payRow('💛','Bancolombia Ahorros','000-000000-00 · configura tu cuenta','000-000000-00') +
        '</div>' +
        '<button class="paw-btn primary block" style="margin-top:14px" onclick="mascotaConfirmarDonacion()">💛 Confirmar mi donación</button>' +
        '<div class="paw-transparency">' +
          '<b>🔎 Así se usa tu donación</b>' +
          '<ul><li>Comida y concentrado para los rescatados</li><li>Vacunas, desparasitación y esterilización</li><li>Urgencias y cirugías veterinarias</li><li>Transporte y kits de rescate</li></ul>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  function payRow(ic, nombre, detalle, copia){
    return '<div class="paw-pay-row" onclick="mascotaCopiar(\'' + copia + '\',this)">' +
      '<div class="paw-pay-ic">' + ic + '</div>' +
      '<div><b>' + nombre + '</b><span>' + escapar(detalle) + '</span></div>' +
      '<div class="paw-copy">Copiar</div>' +
    '</div>';
  }

  // -------- Sección: Reportar un peludito --------
  function seccionReportar(){
    return '<div class="paw-section" data-paw-section="reportar">' +
      '<div class="paw-section-title">📣 Reportar un animalito</div>' +
      '<p class="paw-section-help">¿Viste un perrito o gatico perdido, herido o en peligro? Cuéntanos para que la comunidad y las fundaciones puedan ayudar.</p>' +
      '<div class="paw-form">' +
        '<div class="paw-field"><label>¿Es perrito o gatico?</label>' +
          '<div class="paw-typepick">' +
            '<div class="paw-type active" data-tipo="perro" onclick="mascotaSetTipo(this,\'perro\')">🐶 Perrito</div>' +
            '<div class="paw-type" data-tipo="gato" onclick="mascotaSetTipo(this,\'gato\')">🐱 Gatico</div>' +
          '</div>' +
        '</div>' +
        '<div class="paw-field"><label>Nombre o apodo (si no sabes, pon "Sin nombre")</label><input id="paw-r-nombre" type="text" placeholder="Ej: Manchas"></div>' +
        '<div class="paw-field"><label>¿Qué le pasa? Cuéntanos su situación</label><textarea id="paw-r-historia" placeholder="Ej: Está cojeando cerca del parque, parece asustado y con hambre..."></textarea></div>' +
        '<div class="paw-field"><label>¿Dónde está? (barrio o referencia)</label><input id="paw-r-zona" type="text" placeholder="Ej: Barrio La Ceiba, frente a la cancha"></div>' +
        '<div class="paw-field"><label>¿Qué necesita?</label><input id="paw-r-necesita" type="text" placeholder="Ej: Veterinario, comida, hogar temporal"></div>' +
        '<div class="paw-field"><label>Tu contacto (opcional)</label><input id="paw-r-contacto" type="text" placeholder="WhatsApp o nombre"></div>' +
        '<button class="paw-btn primary block" onclick="mascotaPublicarAnimal()">📣 Publicar reporte</button>' +
      '</div>' +
    '</div>';
  }

  // -------- Sección: Muro de apoyo --------
  function seccionMuro(){
    var mensajes = getMensajes();
    var lista = mensajes.map(function(msg, i){
      return '<div class="paw-msg">' +
        '<div class="paw-msg-head">' +
          '<div class="paw-msg-ava">' + inicial(msg.autor) + '</div>' +
          '<b>' + escapar(msg.autor) + '</b>' +
          '<small>' + tiempoRel(msg.fecha) + '</small>' +
        '</div>' +
        '<p>' + escapar(msg.texto) + '</p>' +
        '<span class="paw-msg-react" onclick="mascotaReaccion(' + i + ',this)">💛 <span>' + (msg.reacciones||0) + '</span></span>' +
      '</div>';
    }).join('');
    var cuerpo = mensajes.length
      ? lista
      : '<div class="paw-empty"><div class="paw-empty-ic">💬</div><b>El muro está esperando tu voz</b><small>Sé el primero en dejar un mensaje de apoyo o un ofrecimiento de ayuda para los animalitos.</small></div>';
    return '<div class="paw-section" data-paw-section="muro">' +
      '<div class="paw-section-title">💬 Muro de apoyo</div>' +
      '<p class="paw-section-help">Ofrece ayuda, comparte un caso o deja un mensaje de aliento para la comunidad animalista. Juntos hacemos más.</p>' +
      '<div class="paw-form" style="margin-bottom:16px">' +
        '<div class="paw-field"><textarea id="paw-muro-texto" placeholder="Escribe tu mensaje de apoyo o tu ofrecimiento de ayuda..."></textarea></div>' +
        '<button class="paw-btn primary block" onclick="mascotaPublicarMensaje()">💬 Publicar en el muro</button>' +
      '</div>' +
      cuerpo +
    '</div>';
  }
  function tiempoRel(ts){
    var diff = Date.now() - (Number(ts)||Date.now());
    var h = Math.floor(diff/3600000);
    if(h < 1) return 'hace un momento';
    if(h < 24) return 'hace ' + h + ' h';
    var d = Math.floor(h/24);
    return 'hace ' + d + (d===1?' día':' días');
  }

  // -------- Sección: Fundaciones aliadas --------
  function seccionFundaciones(){
    var lista = [
      { ic:'🐾', nombre:'Huellitas de Amor Cúcuta', det:'Rescate y adopción · perros y gatos' },
      { ic:'🦴', nombre:'Patitas del Norte', det:'Esterilización y jornadas comunitarias' },
      { ic:'⛪', nombre:'Refugio San Roque', det:'Albergue y hogar de paso' },
      { ic:'😺', nombre:'Gaticos Felices N. de Santander', det:'Especializada en felinos' }
    ];
    var cards = lista.map(function(f){
      return '<div class="paw-found"><div class="paw-found-ic">' + f.ic + '</div><div><b>' + escapar(f.nombre) + '</b><span>' + escapar(f.det) + '</span></div></div>';
    }).join('');
    return '<div class="paw-section" data-paw-section="fundaciones">' +
      '<div class="paw-section-title">🏠 Fundaciones aliadas</div>' +
      '<p class="paw-section-help">Organizaciones de la región que rescatan y cuidan animalitos. ¿Tu fundación quiere aparecer aquí? Escríbenos desde el muro.</p>' +
      cards +
    '</div>';
  }

  // ============================ INTERACCIÓN ============================
  function activarSeccion(id){
    _seccionActiva = id;
    var root = rootEl();
    if(!root) return;
    root.querySelectorAll('.paw-section').forEach(function(s){ s.classList.toggle('active', s.getAttribute('data-paw-section') === id); });
    root.querySelectorAll('.paw-nav [data-paw-tab]').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-paw-tab') === id); });
  }

  function asegurarToast(){
    if(document.getElementById('paw-toast')) return;
    var t = document.createElement('div');
    t.id = 'paw-toast';
    t.innerHTML = '<div class="paw-toast-ic">💛</div><div><b id="paw-toast-title"></b><span id="paw-toast-sub"></span></div>';
    document.body.appendChild(t);
  }
  function toast(titulo, sub, icono){
    asegurarToast();
    var t = document.getElementById('paw-toast');
    document.getElementById('paw-toast-title').textContent = titulo;
    document.getElementById('paw-toast-sub').textContent = sub || '';
    t.querySelector('.paw-toast-ic').textContent = icono || '💛';
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.classList.remove('show'); }, 3200);
  }
  function corazones(){
    var emojis = ['💛','🐾','💗','🐶','🐱'];
    for(var i=0;i<7;i++){
      (function(i){
        setTimeout(function(){
          var h = document.createElement('div');
          h.className = 'paw-heart';
          h.textContent = emojis[Math.floor(Math.random()*emojis.length)];
          h.style.left = (40 + Math.random()*20) + '%';
          h.style.bottom = '90px';
          document.body.appendChild(h);
          setTimeout(function(){ if(h.parentNode) h.parentNode.removeChild(h); }, 1200);
        }, i*90);
      })(i);
    }
  }

  // ---- handlers expuestos ----
  window.mascotaTab = function(id, btn){ activarSeccion(id); };

  window.mascotaSetMonto = function(el, valor){
    var root = rootEl();
    root.querySelectorAll('.paw-amount').forEach(function(a){ a.classList.remove('active'); });
    el.classList.add('active');
    var otro = document.getElementById('paw-monto-otro'); if(otro) otro.value = '';
    root._pawMonto = valor;
  };
  window.mascotaMontoLibre = function(v){
    var root = rootEl();
    root.querySelectorAll('.paw-amount').forEach(function(a){ a.classList.remove('active'); });
    root._pawMonto = Number(v)||0;
  };
  window.mascotaConfirmarDonacion = function(){
    var root = rootEl();
    var monto = Number(root._pawMonto)||0;
    if(monto < 1000){ toast('Elige un monto 🐾','Toca un valor o escribe cuánto quieres donar.','🤔'); return; }
    var donante = (document.getElementById('paw-donante')||{}).value || 'Anónimo';
    var aportes = getAportes();
    aportes.push({ monto:monto, donante:donante, fecha:Date.now(), destino:'general' });
    setAportes(aportes);
    corazones();
    toast('¡Gracias, ' + yoNombre() + '! 💛', 'Tu aporte de ' + pesos(monto) + ' ayuda a un peludito.', '🎉');
    render();
  };

  window.mascotaDonarA = function(id){
    activarSeccion('donar');
    var a = getAnimales().filter(function(x){ return x.id === id; })[0];
    setTimeout(function(){
      var root = rootEl();
      if(root){ var sh = root.querySelector('[data-paw-section="donar"]'); if(sh) sh.scrollIntoView({behavior:'smooth', block:'start'}); }
      if(a) toast('Apadrinas a ' + a.nombre + ' ' + (a.emoji||'🐾'), 'Elige tu monto abajo. ¡Gracias por su rescate!', '💗');
    }, 60);
  };
  window.mascotaAyudar = function(id){
    var a = getAnimales().filter(function(x){ return x.id === id; })[0];
    corazones();
    toast('¡Te uniste a ayudar! 🙌', (a?a.nombre+' y la comunidad te lo agradecen.':'Gracias por tu corazón.'), '💛');
  };
  window.mascotaAdoptar = function(id){
    var a = getAnimales().filter(function(x){ return x.id === id; })[0];
    activarSeccion('muro');
    setTimeout(function(){
      var t = document.getElementById('paw-muro-texto');
      if(t){ t.value = 'Hola, me interesa adoptar a ' + (a?a.nombre:'este peludito') + '. ¿Cómo continúo el proceso? 🏠💛'; t.focus(); }
      var root = rootEl(); var sh = root && root.querySelector('[data-paw-section="muro"]'); if(sh) sh.scrollIntoView({behavior:'smooth'});
    }, 60);
    toast('¡Qué alegría! 🏠','Deja tu mensaje en el muro para iniciar la adopción.', '😺');
  };
  window.mascotaCopiar = function(texto, el){
    var done = function(){
      if(el){ var c = el.querySelector('.paw-copy'); if(c){ var prev=c.textContent; c.textContent='¡Copiado!'; setTimeout(function(){ c.textContent=prev; }, 1500); } }
      toast('Cuenta copiada 📋', texto + ' · ¡gracias por donar!', '💛');
    };
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(texto).then(done, done); }
      else { var ta=document.createElement('textarea'); ta.value=texto; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){} document.body.removeChild(ta); done(); }
    }catch(e){ done(); }
  };

  window.mascotaSetTipo = function(el, tipo){
    var root = rootEl();
    root.querySelectorAll('.paw-type').forEach(function(t){ t.classList.remove('active'); });
    el.classList.add('active');
    root._pawTipoReporte = tipo;
  };
  window.mascotaPublicarAnimal = function(){
    var root = rootEl();
    var tipo = root._pawTipoReporte || 'perro';
    var nombre = (document.getElementById('paw-r-nombre')||{}).value || '';
    var historia = (document.getElementById('paw-r-historia')||{}).value || '';
    var zona = (document.getElementById('paw-r-zona')||{}).value || '';
    var necesita = (document.getElementById('paw-r-necesita')||{}).value || '';
    var contacto = (document.getElementById('paw-r-contacto')||{}).value || '';
    if(historia.trim().length < 8){ toast('Cuéntanos un poco más 🐾','Describe la situación del animalito.', '✍️'); return; }
    var animales = getAnimales();
    animales.unshift({
      id:'u' + Date.now(),
      tipo:tipo, nombre:(nombre.trim()||'Sin nombre'), emoji: tipo==='gato'?'🐱':'🐶',
      sexo:'', edad:'', zona:zona.trim(),
      estado:'urgente',
      historia:historia.trim() + (contacto?(' · Contacto: '+contacto.trim()):''),
      necesita: necesita.trim() ? necesita.split(/[,·]/).map(function(s){return s.trim();}).filter(Boolean).slice(0,4) : ['Ayuda 💛'],
      meta:0, recaudado:0
    });
    setAnimales(animales);
    corazones();
    toast('¡Reporte publicado! 📣','Gracias por darle voz a un peludito. Ya aparece en "Ayudar".', '🐾');
    activarSeccion('ayuda');
    render();
  };

  window.mascotaPublicarMensaje = function(){
    var t = document.getElementById('paw-muro-texto');
    var texto = t ? t.value.trim() : '';
    if(texto.length < 3){ toast('Escribe tu mensaje 💬','Comparte tu apoyo u ofrecimiento.', '✍️'); return; }
    var mensajes = getMensajes();
    mensajes.unshift({ autor:yoNombre(), texto:texto, fecha:Date.now(), reacciones:0 });
    setMensajes(mensajes);
    corazones();
    toast('¡Mensaje publicado! 💬','Gracias por sumar a la comunidad animalista.', '💛');
    activarSeccion('muro');
    render();
  };

  window.mascotaReaccion = function(idx, el){
    var mensajes = getMensajes();
    if(mensajes[idx]){
      mensajes[idx].reacciones = (mensajes[idx].reacciones||0) + 1;
      setMensajes(mensajes);
      var span = el.querySelector('span'); if(span) span.textContent = mensajes[idx].reacciones;
      el.style.transform = 'scale(1.2)'; setTimeout(function(){ el.style.transform=''; }, 180);
    }
  };

  // entrada principal. Sin argumento => sidebar (#mascotas-root). Con id => ese contenedor
  // (la pantalla móvil pasa 'mascotas-root-mobile').
  window.renderMascotasModulo = function(targetId){ _seccionActiva = 'ayuda'; render(targetId || 'mascotas-root'); };

})();
