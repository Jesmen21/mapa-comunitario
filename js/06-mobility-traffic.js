// ==========================================
  // CAPA DE MOVILIDAD: FOTOMULTAS Y REDUCTORES
  // ==========================================
  function iconoControlVial(tipo) {
      const emoji = tipo === 'camera' ? '📷' : '⌁';
      const clase = tipo === 'camera' ? 'camera' : 'reducer';
      return L.divIcon({ className:'', html:`<div class="traffic-marker ${clase}">${emoji}</div>`, iconSize:[18,18], iconAnchor:[9,9] });
  }

  function tipoControlVial(tags = {}) {
      const txt = `${tags.highway || ''} ${tags.traffic_calming || ''} ${tags.camera || ''} ${tags['camera:type'] || ''} ${tags.man_made || ''}`.toLowerCase();
      if(txt.includes('speed_camera') || txt.includes('speed') || txt.includes('surveillance')) return 'camera';
      if(txt.includes('bump') || txt.includes('hump') || txt.includes('table') || txt.includes('cushion') || txt.includes('rumble') || txt.includes('traffic_calming')) return 'reducer';
      return 'reducer';
  }

  function construirQueryControlVialCucuta() {
      const b = CUCUTA_BBOX;
      const box = `${b.south},${b.west},${b.north},${b.east}`;
      return `[out:json][timeout:25];(
        node["highway"="speed_camera"](${box});
        way["highway"="speed_camera"](${box});
        node["camera:type"~"speed|red_light"](${box});
        node["man_made"="surveillance"]["surveillance"~"traffic|public"](${box});
        node["traffic_calming"](${box});
        way["traffic_calming"](${box});
      );out center tags 700;`;
  }

  window.cargarControlVialCucuta = async function() {
      const status = document.getElementById('traffic-control-status');
      if(status) status.innerHTML = '⏳ Consultando cámaras y reductores en OpenStreetMap...';
      try {
          const res = await fetch('https://overpass-api.de/api/interpreter', {
              method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' },
              body: 'data=' + encodeURIComponent(construirQueryControlVialCucuta())
          });
          if(!res.ok) throw new Error(`Overpass ${res.status}`);
          const json = await res.json();
          controlVialLayer.clearLayers();
          controlVialData = [];
          const vistos = new Set();
          (json.elements || []).forEach(el => {
              const lat = el.lat || (el.center && el.center.lat);
              const lng = el.lon || (el.center && el.center.lon);
              if(!isFinite(lat) || !isFinite(lng)) return;
              const key = `${Math.round(lat*100000)}:${Math.round(lng*100000)}:${el.id}`;
              if(vistos.has(key)) return;
              vistos.add(key);
              const tags = el.tags || {};
              const tipo = tipoControlVial(tags);
              const nombre = tags.name || (tipo === 'camera' ? 'Cámara / fotomulta registrada' : 'Reductor de velocidad registrado');
              const marker = L.marker([lat, lng], { icon: iconoControlVial(tipo) })
                .bindPopup(`<b>${tipo === 'camera' ? '📷 Fotomulta / cámara' : '⌁ Reductor de velocidad'}</b><br>${nombre}<br><span style="font-size:.72rem;color:#aeb6c2;">Fuente: OpenStreetMap · ${lat.toFixed(5)}, ${lng.toFixed(5)}</span>`);
              marker.addTo(controlVialLayer);
              controlVialData.push({ lat, lng, tipo, tags });
          });
          if(!map.hasLayer(controlVialLayer)) controlVialLayer.addTo(map);
          if(status) status.innerHTML = controlVialData.length ? `✅ Cargados ${controlVialData.length} punto(s) de control vial. Si no aparecen suficientes, falta información abierta en OSM para Cúcuta.` : '⚠️ No se encontraron cámaras o reductores registrados en OSM para esta zona.';
      } catch(error) {
          console.error(error);
          if(status) status.innerHTML = '⚠️ No se pudo consultar Overpass en este momento. Intenta de nuevo en unos minutos.';
      }
  };

  window.limpiarControlVialCucuta = function() {
      controlVialLayer.clearLayers();
      controlVialData = [];
      const status = document.getElementById('traffic-control-status');
      if(status) status.innerHTML = 'Capa de control vial limpia.';
  };

  // ==========================================
  // AUTOMAPEO CÚCUTA: OpenStreetMap + Overpass API
  // Grupo independiente de las capas manuales/Excel.
  // ==========================================
  const CUCUTA_BBOX = { south: 7.82, west: -72.58, north: 7.98, east: -72.43 };
  const AUTOMAPEO_CUCUTA = {
      gastronomia: { nombre: 'Gastronomía local', icon: '🍽️', color: '#ffd9c8', desc: 'Restaurantes, cafeterías y comidas rápidas.' },
      droguerias: { nombre: 'Droguerías y salud cercana', icon: '💊', color: '#f5bfd6', desc: 'Farmacias y puntos de apoyo sanitario.' },
      salud: { nombre: 'Salud y atención médica', icon: '🏥', color: '#ffc4c4', desc: 'Hospitales, clínicas, médicos y centros de atención.' },
      educacion: { nombre: 'Educación', icon: '🎓', color: '#d8cffc', desc: 'Colegios, universidades e instituciones educativas.' },
      comercio: { nombre: 'Comercio cotidiano', icon: '🛍️', color: '#fff0b8', desc: 'Supermercados, tiendas, panaderías y centros comerciales.' },
      bancos: { nombre: 'Bancos y cajeros', icon: '🏦', color: '#b8ebe6', desc: 'Bancos, cajeros automáticos y servicios financieros.' },
      parques: { nombre: 'Parques y zonas verdes', icon: '🌳', color: '#c8f5d2', desc: 'Parques, plazas recreativas y zonas verdes.' },
      deporte: { nombre: 'Deporte y recreación', icon: '⚽', color: '#cfe8ff', desc: 'Canchas, escenarios deportivos y centros de actividad física.' },
      culto: { nombre: 'Culto y comunidad', icon: '⛪', color: '#f8d7ff', desc: 'Iglesias, templos y lugares de encuentro religioso.' },
      turismo: { nombre: 'Turismo y hospedaje', icon: '🏨', color: '#ffe2b8', desc: 'Hoteles, atractivos y puntos de interés turístico.' },
      transporte: { nombre: 'Transporte y movilidad', icon: '🚏', color: '#d4f1ff', desc: 'Paradas, terminales y puntos de movilidad.' },
      edificios_mixtos: { nombre: 'Edificios y usos mixtos', icon: '🏢', color: '#e4dcff', desc: 'Edificaciones comerciales, públicas o mixtas con nombre registrado.' },
      otros: { nombre: 'Otros puntos urbanos', icon: '📍', color: '#e7e7ef', desc: 'Lugares detectados que no entran en una categoría principal.' }
  };

  function categoriaAutoMapeo(tags = {}) {
      const amenity = tags.amenity || '';
      const shop = tags.shop || '';
      const leisure = tags.leisure || '';
      const tourism = tags.tourism || '';
      const publicTransport = tags.public_transport || '';
      const highway = tags.highway || '';
      if(['restaurant','cafe','fast_food','food_court','ice_cream','bar','pub'].includes(amenity)) return 'gastronomia';
      if(amenity === 'pharmacy' || shop === 'chemist') return 'droguerias';
      if(['hospital','clinic','doctors','dentist','veterinary'].includes(amenity)) return 'salud';
      if(['school','college','university','kindergarten','library'].includes(amenity)) return 'educacion';
      if(['supermarket','mall','convenience','bakery','butcher','greengrocer','department_store'].includes(shop) || amenity === 'marketplace') return 'comercio';
      if(['bank','atm'].includes(amenity)) return 'bancos';
      if(['park','garden','playground'].includes(leisure)) return 'parques';
      if(['pitch','sports_centre','stadium','fitness_centre'].includes(leisure)) return 'deporte';
      if(amenity === 'place_of_worship') return 'culto';
      if(['hotel','hostel','guest_house','attraction','museum'].includes(tourism)) return 'turismo';
      if(['bus_station','taxi'].includes(amenity) || publicTransport || ['bus_stop'].includes(highway)) return 'transporte';
      if(tags.office === 'government' || ['townhall','police','fire_station','courthouse','post_office','community_centre'].includes(amenity)) return 'edificios_mixtos';
      if(tags.building && tags.name) return 'edificios_mixtos';
      return 'otros';
  }

  const AUTOMAPEO_MATRIZ_USOS = {
      comercio: { nombre: 'Comercio', icon: '🛍️', desc: 'Tiendas, centros comerciales, gastronomía y servicios comerciales.' },
      salud: { nombre: 'Salud', icon: '💗', desc: 'Droguerías, clínicas, hospitales, odontología, veterinaria y apoyo sanitario.' },
      deporte: { nombre: 'Deporte', icon: '⚽', desc: 'Canchas, gimnasios, centros deportivos y escenarios de actividad física.' },
      ocio: { nombre: 'Ocio / recreación', icon: '🎠', desc: 'Parques, cafés, bares, turismo, museos y lugares de encuentro.' },
      institucional: { nombre: 'Institucional', icon: '🏛️', desc: 'Gobierno, culto, seguridad, bibliotecas, comunidad y servicios públicos.' },
      educativo: { nombre: 'Educativo', icon: '🎓', desc: 'Colegios, universidades, jardines infantiles e instituciones educativas.' },
      movilidad: { nombre: 'Movilidad', icon: '🚌', desc: 'Paradas, estaciones, taxi y soporte al transporte urbano.' },
      ambiental: { nombre: 'Ambiental / verde', icon: '🌳', desc: 'Parques, jardines, zonas verdes y espacios abiertos.' }
  };

  function usosMatrizAutoMapeo(tags = {}, tipo = 'otros', nombre = '') {
      const usos = new Set();
      const amenity = tags.amenity || '';
      const shop = tags.shop || '';
      const leisure = tags.leisure || '';
      const tourism = tags.tourism || '';
      const highway = tags.highway || '';
      const building = tags.building || '';
      const office = tags.office || '';
      const sport = tags.sport || '';
      const texto = `${nombre || ''} ${tags.name || ''} ${tags.brand || ''} ${tags.operator || ''}`.toLowerCase();

      if(shop || ['restaurant','cafe','fast_food','food_court','ice_cream','bar','pub','marketplace'].includes(amenity) || ['hotel','hostel','guest_house'].includes(tourism) || ['commercial','retail'].includes(building)) usos.add('comercio');
      if(['pharmacy','hospital','clinic','doctors','dentist','veterinary'].includes(amenity) || shop === 'chemist') usos.add('salud');
      if(['pitch','sports_centre','stadium','fitness_centre'].includes(leisure) || sport || texto.includes('smart fit') || texto.includes('gym') || texto.includes('gimnasio') || texto.includes('cancha')) usos.add('deporte');
      if(['park','garden','playground'].includes(leisure) || ['attraction','museum'].includes(tourism) || ['bar','pub','cafe','restaurant','cinema','theatre'].includes(amenity)) usos.add('ocio');
      if(['school','college','university','kindergarten'].includes(amenity)) usos.add('educativo');
      if(['library','place_of_worship','townhall','police','fire_station','courthouse','post_office','community_centre'].includes(amenity) || office === 'government' || ['public','government','civic'].includes(building)) usos.add('institucional');
      if(['bus_station','taxi'].includes(amenity) || tags.public_transport || highway === 'bus_stop') usos.add('movilidad');
      if(['park','garden','playground'].includes(leisure) || tags.natural || tags.landuse === 'recreation_ground') usos.add('ambiental');

      // Regla multiuso: centros comerciales o edificios comerciales pueden sumar comercio; si además traen gimnasio/cancha/café/restaurante, suman deporte u ocio.
      if(tipo === 'comercio' || tipo === 'gastronomia' || tipo === 'turismo') usos.add('comercio');
      if(tipo === 'deporte') usos.add('deporte');
      if(tipo === 'parques') { usos.add('ocio'); usos.add('ambiental'); }
      if(tipo === 'educacion') usos.add('educativo');
      if(tipo === 'droguerias' || tipo === 'salud') usos.add('salud');
      if(tipo === 'culto') usos.add('institucional');

      return Array.from(usos);
  }

  function clasificacionUrbisDesdeAutoMapeo(tags = {}, tipo = 'otros', nombre = '') {
      const amenity = tags.amenity || '';
      const shop = tags.shop || '';
      const leisure = tags.leisure || '';
      const tourism = tags.tourism || '';
      const office = tags.office || '';
      const building = tags.building || '';
      const sport = tags.sport || '';
      const texto = `${nombre || ''} ${tags.name || ''} ${tags.brand || ''} ${tags.operator || ''}`.toLowerCase();
      if(['restaurant'].includes(amenity)) return { categoria: 'Comercio y Servicios', item: 'Restaurante formal', material: 'N/A' };
      if(['cafe'].includes(amenity) || shop === 'coffee') return { categoria: 'Comercio y Servicios', item: 'Cafetería / Hoyo 19 / Juan Valdez', material: 'N/A' };
      if(['fast_food','food_court','ice_cream','bar','pub'].includes(amenity)) return { categoria: 'Comercio y Servicios', item: amenity === 'bar' || amenity === 'pub' ? 'Bar / Discoteca / Licorera' : 'Comidas rápidas (fijo)', material: 'N/A' };
      if(amenity === 'pharmacy' || shop === 'chemist') return { categoria: 'Comercio y Servicios', item: 'Droguería', material: 'N/A' };
      if(['hospital','clinic','doctors','dentist','veterinary'].includes(amenity)) return { categoria: 'Comercio y Servicios', item: 'Consultorio / Clínica / Veterinaria', material: 'N/A' };
      if(['school','college','university','kindergarten'].includes(amenity)) return { categoria: 'Grandes Equipamientos', item: 'Universidad / Colegio / Escuela', material: 'Concreto' };
      if(shop === 'mall' || texto.includes('centro comercial') || texto.includes('ventura plaza')) return { categoria: 'Grandes Equipamientos', item: 'Centro comercial (Mall)', material: 'Concreto' };
      if(['supermarket','convenience','department_store'].includes(shop)) return { categoria: 'Comercio y Servicios', item: 'Supermercado / Minimarket', material: 'N/A' };
      if(['bakery','butcher','greengrocer'].includes(shop)) return { categoria: 'Comercio y Servicios', item: 'Frutería / Carnicería / Panadería', material: 'N/A' };
      if(shop || amenity === 'marketplace') return { categoria: 'Comercio y Servicios', item: 'Tienda de barrio', material: 'N/A' };
      if(['bank','atm'].includes(amenity)) return { categoria: 'Comercio y Servicios', item: 'Cajero / Banco / Parqueadero', material: 'N/A' };
      if(['pitch'].includes(leisure) || texto.includes('cancha')) return { categoria: 'Áreas Deportivas', item: 'Cancha múltiple techada', material: 'Concreto' };
      if(['sports_centre','stadium','fitness_centre'].includes(leisure) || sport || texto.includes('smart fit') || texto.includes('gimnasio')) return { categoria: 'Áreas Deportivas', item: texto.includes('smart fit') || texto.includes('gimnasio') ? 'Calistenia' : 'Polideportivo cemento', material: 'Concreto' };
      if(['park','garden','playground'].includes(leisure)) return { categoria: 'Áreas Verdes y Ambiental', item: leisure === 'playground' ? 'Parque infantil' : 'Parque metropolitano', material: 'N/A' };
      if(amenity === 'place_of_worship') return { categoria: 'Grandes Equipamientos', item: 'Catedral / Iglesia / Templo', material: 'Concreto' };
      if(['hotel','hostel','guest_house','attraction','museum'].includes(tourism)) return { categoria: 'Patrimonio y Turismo', item: tourism === 'museum' ? 'Edificio de conservación' : 'Tótem / Centro turista', material: 'N/A' };
      if(['bus_station','taxi'].includes(amenity) || tags.public_transport || tags.highway === 'bus_stop') return { categoria: 'Infraestructura y Peatonal', item: 'Paradero de bus', material: 'N/A' };
      if(office === 'government' || ['townhall','police','fire_station','courthouse','post_office','community_centre'].includes(amenity) || ['public','government','civic'].includes(building)) return { categoria: 'Grandes Equipamientos', item: amenity === 'police' || amenity === 'fire_station' ? 'CAI / Estación Policía / Bomberos' : 'Alcaldía / Gobernación', material: 'Concreto' };
      if(building && tags.name) return { categoria: 'Oficinas y Co-working', item: office === 'government' ? 'Oficina gubernamental' : 'Centro de negocios', material: 'Concreto' };
      return { categoria: 'Comercio y Servicios', item: 'Tienda de barrio', material: 'N/A' };
  }

  function usosMultidimensionalAutoMapeo(tags = {}, tipo = 'otros', nombre = '') {
      const usos = new Set();
      const amenity = tags.amenity || '';
      const shop = tags.shop || '';
      const leisure = tags.leisure || '';
      const tourism = tags.tourism || '';
      const building = tags.building || '';
      const office = tags.office || '';
      const sport = tags.sport || '';
      const texto = `${nombre || ''} ${tags.name || ''} ${tags.brand || ''} ${tags.operator || ''}`.toLowerCase();

      if(shop || ['restaurant','cafe','fast_food','food_court','ice_cream','bar','pub','marketplace'].includes(amenity) || ['hotel','hostel','guest_house'].includes(tourism) || ['commercial','retail'].includes(building)) usos.add('Comercial');
      if(['restaurant','cafe','fast_food','food_court','ice_cream','bar','pub','cinema','theatre'].includes(amenity) || ['park','garden','playground','attraction','museum'].includes(leisure) || ['attraction','museum'].includes(tourism)) usos.add('Ocio / Negocio');
      if(['pitch','sports_centre','stadium','fitness_centre'].includes(leisure) || sport || texto.includes('smart fit') || texto.includes('gimnasio') || texto.includes('cancha')) usos.add('Deportivo');
      if(['park','garden','playground'].includes(leisure)) { usos.add('Esp. Público'); usos.add('Protección Ambiental'); }
      if(['pharmacy','hospital','clinic','doctors','dentist'].includes(amenity) || shop === 'chemist') usos.add('Salud (Clínicas/Hospitales)');
      if(amenity === 'veterinary') usos.add('Cuidado Animal (Veterinaria)');
      if(['school','college','university','kindergarten','library'].includes(amenity)) { usos.add('Educativo (Básico/Superior)'); usos.add('Institucional'); }
      if(['library','townhall','police','fire_station','courthouse','post_office','community_centre'].includes(amenity) || office === 'government' || ['public','government','civic'].includes(building)) { usos.add('Institucional'); usos.add('Gubernamental / Administrativo'); }
      if(amenity === 'place_of_worship') { usos.add('Religioso / Culto'); usos.add('Institucional'); }
      if(['hotel','hostel','guest_house','attraction','museum'].includes(tourism)) usos.add('Turístico / Hotelero');
      if(tourism === 'museum' || amenity === 'library') usos.add('Cultural / Patrimonio');
      if(['bus_station','taxi'].includes(amenity) || tags.public_transport || tags.highway === 'bus_stop') usos.add('Transporte (Terminales/Estaciones)');
      if(['bank','atm'].includes(amenity)) usos.add('Comercial');
      if(tags.parking || amenity === 'parking') usos.add('Parqueadero / Estacionamiento');
      if(tags.communication || tags.man_made === 'communications_tower') usos.add('Comunicaciones / Antenas');
      if(building && tags.name && usos.has('Comercial') && (texto.includes('residencial') || texto.includes('apartamento'))) usos.add('Mixto (Residencial-Comercial)');
      if(tipo === 'parques') { usos.add('Esp. Público'); usos.add('Ocio / Negocio'); usos.add('Protección Ambiental'); }
      if(tipo === 'deporte') usos.add('Deportivo');
      if(tipo === 'droguerias' || tipo === 'salud') usos.add('Salud (Clínicas/Hospitales)');
      if(tipo === 'educacion') usos.add('Educativo (Básico/Superior)');
      if(tipo === 'culto') usos.add('Religioso / Culto');
      if(tipo === 'transporte') usos.add('Transporte (Terminales/Estaciones)');
      if(tipo === 'edificios_mixtos') { usos.add('Comercial'); usos.add('Mixto (Residencial-Comercial)'); }
      if(texto.includes('gran vía') || texto.includes('gran via') || texto.includes('ventura') || texto.includes('plaza') || texto.includes('centro comercial')) { usos.add('Comercial'); usos.add('Ocio / Negocio'); }
      if(!usos.size) usos.add('Comercial');
      return Array.from(usos).filter(u => todosLosUsos.includes(u));
  }

  function flagsMatrizMultidimensionalAutoMapeo(tags = {}, tipo = 'otros', nombre = '') {
      const usos = usosMultidimensionalAutoMapeo(tags, tipo, nombre);
      return todosLosUsos.map(u => usos.includes(u) ? 'SI' : 'NO');
  }

  function renderChipsMatrizUrbisAutoMapeo(usosUrbis = []) {
      if(!usosUrbis.length) return '<div class="auto-use-chips"><span class="auto-use-chip">📍 Sin uso URBIS asignado</span></div>';
      return `<div class="auto-matrix-exact"><div class="auto-matrix-exact-title">Matriz de Usos Multidimensional URBIS</div><div class="auto-use-chips">${usosUrbis.map(u => `<span class="auto-use-chip">✅ ${u}</span>`).join('')}</div></div>`;
  }

  function renderBotonAnexarAutoMapeo(id) {
      const esArquitecto = userRole === 'admin' || userRole === 'gov';
      if(!esArquitecto) return '<div class="auto-annex-status">🔒 Solo Arquitecto/Admin o Funcionario/JAC puede anexar este punto a la base URBIS.</div>';
      return `<button class="auto-annex-btn" onclick="anexarAutoMapeoAMatriz('${id}', this)">➕ Anexar a Matriz URBIS / SheetDB</button><div class="auto-annex-status">Se guardará como registro URBIS aprobado, con la matriz SI/NO ya calculada.</div>`;
  }

  function renderChipsUsosAutoMapeo(usos = []) {
      if(!usos.length) return '<div class="auto-use-chips"><span class="auto-use-chip">📍 Sin uso matriz asignado</span></div>';
      return `<div class="auto-use-chips">${usos.map(u => {
          const cfg = AUTOMAPEO_MATRIZ_USOS[u] || { icon: '📍', nombre: u };
          return `<span class="auto-use-chip">${cfg.icon} ${cfg.nombre}</span>`;
      }).join('')}</div>`;
  }

  function renderAutoMapeoMatriz() {
      const cont = document.getElementById('automap-matrix');
      if(!cont) return;
      if(!autoMapeoCucutaRegistros.length) {
          cont.innerHTML = `<div class="automap-matrix-head"><div class="automap-matrix-title">Matriz de Usos Multidimensional · AutoMapeo</div></div><div class="automap-matrix-summary">Carga lugares de Cúcuta para convertirlos al mismo lenguaje de tu matriz URBIS: Comercial, Institucional, Ocio, Deportivo, Salud, Educativo, Transporte y demás variables.</div>`;
          return;
      }
      const counts = {};
      todosLosUsos.forEach(k => counts[k] = 0);
      let multiuso = 0;
      autoMapeoCucutaRegistros.forEach(r => {
          const usosUrbis = r.usosUrbis || [];
          if(usosUrbis.length > 1) multiuso++;
          usosUrbis.forEach(u => { counts[u] = (counts[u] || 0) + 1; });
      });
      const principales = todosLosUsos.filter(u => counts[u] > 0).sort((a,b) => counts[b] - counts[a]);
      const cards = principales.map(u => `<div class="matrix-card"><b>✅ ${u}</b><strong>${counts[u]}</strong><small>Variable activa dentro de la Matriz de Usos Multidimensional.</small></div>`).join('');
      const total = autoMapeoCucutaRegistros.length;
      cont.innerHTML = `
        <div class="automap-matrix-head"><div class="automap-matrix-title">Matriz de Usos Multidimensional · AutoMapeo</div><span class="automap-badge">${total} puntos</span></div>
        <div class="automap-matrix-summary">Cada lugar de OpenStreetMap se remapea al formato URBIS. Un mismo punto puede activar varios usos; por ejemplo, un centro comercial puede activar Comercial, Ocio / Negocio, Parqueadero o incluso Deportivo si el dato incluye gimnasio/cancha.</div>
        <div class="matrix-grid">${cards || '<div class="matrix-card"><b>Sin variables activas</b><strong>0</strong><small>No se pudo asignar uso.</small></div>'}</div>
        <div class="matrix-chip-row"><span class="matrix-chip">🔀 Multiuso: ${multiuso}</span><span class="matrix-chip">🧩 Variables URBIS: ${principales.length}</span><span class="matrix-chip">📌 Fuente: OpenStreetMap</span></div>
        <div class="matrix-note">Estos conteos ya usan los mismos nombres de la matriz manual. Desde cada popup puedes anexar el punto a SheetDB con sus campos SI/NO.</div>`;
  }

  function tipoUrbisAutoMapeo(tags = {}, tipo = 'otros') {
      const amenity = tags.amenity || '';
      const shop = tags.shop || '';
      const leisure = tags.leisure || '';
      const tourism = tags.tourism || '';
      const highway = tags.highway || '';
      const mapaAmenity = {
          restaurant: 'Restaurante', cafe: 'Cafetería', fast_food: 'Comidas rápidas', food_court: 'Plazoleta de comidas', ice_cream: 'Heladería', bar: 'Bar', pub: 'Pub',
          pharmacy: 'Droguería / farmacia', hospital: 'Hospital', clinic: 'Clínica', doctors: 'Consultorio médico', dentist: 'Odontología', veterinary: 'Veterinaria',
          school: 'Colegio', college: 'Institución educativa', university: 'Universidad', kindergarten: 'Jardín infantil', library: 'Biblioteca',
          bank: 'Banco', atm: 'Cajero automático', marketplace: 'Plaza / mercado', place_of_worship: 'Lugar de culto', bus_station: 'Terminal / estación de bus', taxi: 'Punto de taxi', cinema: 'Cine', theatre: 'Teatro', townhall: 'Entidad pública', police: 'Policía / seguridad', fire_station: 'Bomberos', courthouse: 'Justicia', post_office: 'Correo / mensajería', community_centre: 'Centro comunitario'
      };
      const mapaShop = {
          supermarket: 'Supermercado', mall: 'Centro comercial', convenience: 'Tienda de conveniencia', bakery: 'Panadería', butcher: 'Carnicería',
          greengrocer: 'Frutería / verduras', department_store: 'Almacén por departamentos', chemist: 'Droguería / productos de salud'
      };
      const mapaLeisure = {
          park: 'Parque', garden: 'Jardín / zona verde', playground: 'Parque infantil', pitch: 'Cancha', sports_centre: 'Centro deportivo', stadium: 'Estadio', fitness_centre: 'Gimnasio', recreation_ground: 'Zona recreativa'
      };
      const mapaTourism = { hotel: 'Hotel', hostel: 'Hostal', guest_house: 'Hospedaje', attraction: 'Atractivo turístico', museum: 'Museo' };
      if(mapaAmenity[amenity]) return mapaAmenity[amenity];
      if(mapaShop[shop]) return mapaShop[shop];
      if(mapaLeisure[leisure]) return mapaLeisure[leisure];
      if(mapaTourism[tourism]) return mapaTourism[tourism];
      if(highway === 'bus_stop') return 'Parada de bus';
      const cfg = AUTOMAPEO_CUCUTA[tipo] || AUTOMAPEO_CUCUTA.otros;
      return cfg.nombre;
  }

  function direccionAutoMapeo(tags = {}) {
      const partes = [];
      const calle = tags['addr:street'];
      const numero = tags['addr:housenumber'];
      const barrio = tags['addr:neighbourhood'] || tags['addr:suburb'];
      if(calle) partes.push(limpiarHTML(calle) + (numero ? ` #${limpiarHTML(numero)}` : ''));
      if(barrio) partes.push(limpiarHTML(barrio));
      return partes.join(' · ');
  }

  function nombreAutoMapeo(tags = {}, tipo = 'otros') {
      if(tags.name) return limpiarHTML(tags.name);
      if(tags.brand) return limpiarHTML(tags.brand);
      if(tags.operator) return limpiarHTML(tags.operator);
      const tipoUrbis = tipoUrbisAutoMapeo(tags, tipo);
      return `${tipoUrbis} registrado en Cúcuta`;
  }

  function descripcionAutoMapeo(tags = {}, tipo = 'otros') {
      const cfg = AUTOMAPEO_CUCUTA[tipo] || AUTOMAPEO_CUCUTA.otros;
      const tipoUrbis = tipoUrbisAutoMapeo(tags, tipo);
      const direccion = direccionAutoMapeo(tags);
      const partes = [];
      if(tags.amenity) partes.push(`amenity=${limpiarHTML(tags.amenity)}`);
      if(tags.shop) partes.push(`shop=${limpiarHTML(tags.shop)}`);
      if(tags.leisure) partes.push(`leisure=${limpiarHTML(tags.leisure)}`);
      if(tags.tourism) partes.push(`tourism=${limpiarHTML(tags.tourism)}`);
      if(tags.brand && tags.brand !== tags.name) partes.push(`marca=${limpiarHTML(tags.brand)}`);
      if(tags.operator && tags.operator !== tags.name) partes.push(`operador=${limpiarHTML(tags.operator)}`);
      return `
        <span class="auto-poi-kind">${tipoUrbis}</span>
        <div>${cfg.desc}</div>
        <div class="auto-poi-meta">
          ${direccion ? `<span>📍 ${direccion}</span>` : `<span>📍 Cúcuta · ubicación aproximada por coordenadas OSM</span>`}
          ${tags.phone ? `<span>☎️ ${limpiarHTML(tags.phone)}</span>` : ''}
          ${tags.website ? `<span>🌐 ${limpiarHTML(tags.website)}</span>` : ''}
          ${partes.length ? `<span>🏷️ Etiquetas OSM: ${partes.join(' · ')}</span>` : ''}
        </div>`;
  }

  function construirQueryOverpassCucuta() {
      const b = CUCUTA_BBOX;
      const box = `${b.south},${b.west},${b.north},${b.east}`;
      return `[out:json][timeout:30];(
        node["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream|bar|pub|cinema|theatre|pharmacy|hospital|clinic|doctors|dentist|veterinary|school|college|university|kindergarten|library|bank|atm|marketplace|place_of_worship|bus_station|taxi|townhall|police|fire_station|courthouse|post_office|community_centre"](${box});
        way["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream|bar|pub|cinema|theatre|pharmacy|hospital|clinic|doctors|dentist|veterinary|school|college|university|kindergarten|library|bank|atm|marketplace|place_of_worship|bus_station|taxi|townhall|police|fire_station|courthouse|post_office|community_centre"](${box});
        relation["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream|bar|pub|cinema|theatre|pharmacy|hospital|clinic|doctors|dentist|veterinary|school|college|university|kindergarten|library|bank|atm|marketplace|place_of_worship|bus_station|taxi|townhall|police|fire_station|courthouse|post_office|community_centre"](${box});
        node["shop"~"supermarket|mall|convenience|bakery|butcher|greengrocer|department_store|chemist|sports|coffee"](${box});
        way["shop"~"supermarket|mall|convenience|bakery|butcher|greengrocer|department_store|chemist|sports|coffee"](${box});
        relation["shop"~"supermarket|mall|convenience|bakery|butcher|greengrocer|department_store|chemist|sports|coffee"](${box});
        node["leisure"~"park|garden|playground|pitch|sports_centre|stadium|fitness_centre"](${box});
        way["leisure"~"park|garden|playground|pitch|sports_centre|stadium|fitness_centre"](${box});
        relation["leisure"~"park|garden|playground|pitch|sports_centre|stadium|fitness_centre"](${box});
        node["tourism"~"hotel|hostel|guest_house|attraction|museum"](${box});
        way["tourism"~"hotel|hostel|guest_house|attraction|museum"](${box});
        relation["tourism"~"hotel|hostel|guest_house|attraction|museum"](${box});
        node["highway"="bus_stop"](${box});
        node["sport"](${box});
        way["sport"](${box});
        relation["sport"](${box});
        way["landuse"="recreation_ground"](${box});
        relation["landuse"="recreation_ground"](${box});
        way["building"~"commercial|retail|public|office"]["name"](${box});
        relation["building"~"commercial|retail|public|office"]["name"](${box});
        node["office"="government"](${box});
        way["office"="government"](${box});
        relation["office"="government"](${box});
      );out center tags 1200;`;
  }

  function iconoAutoMapeo(cfg, cat = 'otros') {
      return L.divIcon({
          className: 'auto-map-root',
          html: `<div class="auto-poi-marker auto-cat-${cat}" title="${cfg.nombre}"><span>${cfg.icon}</span></div>`,
          iconSize: [42,42], iconAnchor: [21,34]
      });
  }

  function normalizarTextoSheet(valor) {
      return String(valor ?? '').replace(/\|/g, '-').replace(/\n/g, ' ').trim();
  }

  function construirRegistroSheetDBDesdeAutoMapeo(registro) {
      const clasif = clasificacionUrbisDesdeAutoMapeo(registro.tags, registro.cat, registro.nombre);
      const usosFlags = flagsMatrizMultidimensionalAutoMapeo(registro.tags, registro.cat, registro.nombre);
      const usosActivos = registro.usosUrbis || usosMultidimensionalAutoMapeo(registro.tags, registro.cat, registro.nombre);
      const notas = normalizarTextoSheet(`AutoMapeo Cúcuta OSM. Tipo URBIS: ${tipoUrbisAutoMapeo(registro.tags, registro.cat)}. Usos activos: ${usosActivos.join(', ')}. Fuente: OpenStreetMap. Clasificación automática a Matriz de Usos Multidimensional.`);
      const nombreSeguro = normalizarTextoSheet(registro.nombre || nombreAutoMapeo(registro.tags, registro.cat));
      const creador = normalizarTextoSheet(userNameGlobal || 'Arquitecto URBIS');
      const arrData = [
          clasif.item,
          nombreSeguro,
          notas,
          'Bueno',
          'Activo',
          clasif.material || 'N/A',
          ...usosFlags,
          'N/A',
          'Aprobado',
          creador,
          userRole || 'admin',
          0,
          normalizarTextoSheet(userEmailGlobal || 'automapeo@urbis.local'),
          normalizarTextoSheet(userCedulaGlobal || 'OSM-AUTO'),
          'Cúcuta · AutoMapeo'
      ];
      const descripcionFinal = asegurarCamposTemporales(arrData.join(' | '), clasif.categoria, clasif.item, new Date());
      return {
          tipo: clasif.categoria,
          lat: Number(registro.lat).toFixed(7),
          lng: Number(registro.lng).toFixed(7),
          descripcion: descripcionFinal,
          fecha: new Date().toISOString()
      };
  }

  window.anexarAutoMapeoAMatriz = async function(id, btn) {
      const registro = autoMapeoCucutaRegistros.find(r => r.id === id);
      if(!registro) { alert('No encontré este punto del AutoMapeo. Vuelve a cargar los lugares.'); return; }
      if(userRole !== 'admin' && userRole !== 'gov') { alert('Solo Arquitecto/Admin o Funcionario/JAC puede anexar puntos a la base URBIS.'); return; }
      const registroSheetDB = construirRegistroSheetDBDesdeAutoMapeo(registro);
      if(btn) { btn.disabled = true; btn.innerText = '⏳ Anexando...'; }
      try {
          await window.urbisGuardarFila(registroSheetDB);
          if(btn) { btn.innerText = '✅ Anexado a URBIS'; }
          playSuccessSound();
          cargarPuntos();
      } catch(error) {
          if(btn) { btn.disabled = false; btn.innerText = '➕ Reintentar anexar'; }
          manejarError('anexar AutoMapeo a Matriz URBIS', error);
      }
  };

  window.anexarTodoAutoMapeoAMatriz = async function(btn) {
      if(userRole !== 'admin' && userRole !== 'gov') { alert('Solo Arquitecto/Admin o Funcionario/JAC puede anexar puntos a la base URBIS.'); return; }
      if(!autoMapeoCucutaRegistros.length) { alert('Primero espera a que cargue el AutoMapeo de Cúcuta.'); return; }
      if(anexandoAutoMapeoMasivo) return;
      const total = autoMapeoCucutaRegistros.length;
      const ok = confirm(`Se anexarán ${total} puntos automapeados a la Matriz URBIS/SheetDB con clasificación automática SI/NO. ¿Continuar?`);
      if(!ok) return;
      anexandoAutoMapeoMasivo = false;
      const status = document.getElementById('automap-status');
      if(btn) { btn.disabled = true; btn.innerText = '⏳ Anexando...'; }
      try {
          const registros = autoMapeoCucutaRegistros.map(r => construirRegistroSheetDBDesdeAutoMapeo(r));
          for(let i = 0; i < registros.length; i++) {
              if(status) status.innerHTML = `📥 Anexando ${i + 1} de ${total} puntos a la Matriz URBIS...`;
              await window.urbisGuardarFila(registros[i]);
          }
          if(status) status.innerHTML = `✅ Se anexaron ${total} puntos automapeados a la base URBIS con Matriz de Usos Multidimensional.`;
          if(btn) btn.innerText = '✅ Todo anexado';
          playSuccessSound();
          cargarPuntos();
      } catch(error) {
          if(btn) { btn.disabled = false; btn.innerText = '📥 Reintentar anexar todo'; }
          manejarError('anexar AutoMapeo masivo a Matriz URBIS', error);
      } finally {
          anexandoAutoMapeoMasivo = false;
      }
  };

  function pintarAutoMapeoCucuta(elementos) {
      autoMapeoCucutaLayer.clearLayers();
      autoMapeoCucutaCategorias = {};
      autoMapeoCucutaRegistros = [];
      Object.keys(AUTOMAPEO_CUCUTA).forEach(k => {
          autoMapeoCucutaCategorias[k] = { layer: L.layerGroup(), count: 0 };
      });
      const vistos = new Set();
      elementos.forEach(el => {
          const lat = el.lat || (el.center && el.center.lat);
          const lng = el.lon || (el.center && el.center.lon);
          if(!isFinite(lat) || !isFinite(lng)) return;
          const tags = el.tags || {};
          const key = `${Math.round(lat*100000)}:${Math.round(lng*100000)}:${tags.name || el.id}`;
          if(vistos.has(key)) return;
          vistos.add(key);
          const cat = categoriaAutoMapeo(tags);
          const cfg = AUTOMAPEO_CUCUTA[cat] || AUTOMAPEO_CUCUTA.otros;
          const nombre = nombreAutoMapeo(tags, cat);
          const usos = usosMatrizAutoMapeo(tags, cat, nombre);
          const usosUrbis = usosMultidimensionalAutoMapeo(tags, cat, nombre);
          const idAuto = `osm_${el.type || 'node'}_${el.id || vistos.size}_${Math.round(lat*100000)}_${Math.round(lng*100000)}`;
          const marker = L.marker([lat, lng], { icon: iconoAutoMapeo(cfg, cat) });
          const registro = { id: idAuto, lat, lng, nombre, cat, usos, usosUrbis, tags, marker };
          autoMapeoCucutaRegistros.push(registro);
          marker
              .bindPopup(`<div class="auto-poi-popup"><div class="auto-poi-title"><span class="mini-icon-badge">${cfg.icon}</span><span>${nombre}</span></div><div class="auto-desc">${descripcionAutoMapeo(tags, cat)}${renderChipsUsosAutoMapeo(usos)}${renderChipsMatrizUrbisAutoMapeo(usosUrbis)}${renderBotonAnexarAutoMapeo(idAuto)}</div><div class="auto-poi-source">Grupo: AutoMapeo Cúcuta · Fuente: OpenStreetMap · ${lat.toFixed(5)}, ${lng.toFixed(5)}</div></div>`);
          marker.addTo(autoMapeoCucutaCategorias[cat].layer);
          urbisRegisterProximityMarker(marker, [lat, lng], { emoji: cfg.icon, tipo: cat }, 'auto');
          autoMapeoCucutaCategorias[cat].count += 1;
      });
      Object.keys(autoMapeoCucutaCategorias).forEach(k => {
          const item = autoMapeoCucutaCategorias[k];
          if(item.count > 0) item.layer.addTo(autoMapeoCucutaLayer);
      });
      renderAutoMapeoToggles();
      urbisApplyProximityModeDebounced();
  }

  function renderAutoMapeoToggles() {
      const cont = document.getElementById('automap-toggles');
      const status = document.getElementById('automap-status');
      if(!cont) return;
      const total = Object.values(autoMapeoCucutaCategorias).reduce((a,c) => a + (c.count || 0), 0);
      if(status) status.innerHTML = total ? `Se cargaron <b>${total}</b> lugares de Cúcuta desde OpenStreetMap. Cuando OSM tenga nombre, se mostrará como referencia urbana. Este grupo está separado visualmente y cada punto ya fue clasificado automáticamente con SI/NO para la Matriz de Usos Multidimensional. Puedes anexar puntos individuales o todos los puntos cargados a SheetDB.` : 'No se encontraron lugares en la consulta actual.';
      cont.innerHTML = Object.keys(AUTOMAPEO_CUCUTA).map(k => {
          const cfg = AUTOMAPEO_CUCUTA[k];
          const count = autoMapeoCucutaCategorias[k] ? autoMapeoCucutaCategorias[k].count : 0;
          if(count === 0) return '';
          return `<div class="automap-item">
              <span class="mini-icon-badge">${cfg.icon}</span>
              <span><b>${cfg.nombre}</b><small>${cfg.desc}</small></span>
              <span style="display:flex;align-items:center;gap:8px;"><span class="automap-count">${count}</span><label class="switch"><input type="checkbox" checked onchange="toggleAutoMapeoCucuta('${k}', this)"><span class="slider"></span></label></span>
          </div>`;
      }).join('');
      renderAutoMapeoMatriz();
      aplicarCapasSegunZoom();
  }

  window.toggleAutoMapeoCucuta = function(cat, checkbox) {
      const item = autoMapeoCucutaCategorias[cat];
      if(!item) return;
      if(checkbox.checked) item.layer.addTo(autoMapeoCucutaLayer);
      else autoMapeoCucutaLayer.removeLayer(item.layer);
  };

  window.cargarAutoMapeoCucuta = async function(auto = false) {
      const status = document.getElementById('automap-status');
      if(status) status.innerHTML = auto ? '⏳ AutoMapeo automático: consultando OpenStreetMap/Overpass para Cúcuta...' : '⏳ Consultando OpenStreetMap/Overpass para Cúcuta...';
      try {
          const query = construirQueryOverpassCucuta();
          const res = await fetch('https://overpass-api.de/api/interpreter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
              body: 'data=' + encodeURIComponent(query)
          });
          if(!res.ok) throw new Error(`Overpass ${res.status}`);
          const json = await res.json();
          autoMapeoCucutaData = json.elements || [];
          autoMapeoAutoCargado = false;
          pintarAutoMapeoCucuta(autoMapeoCucutaData);
          ajustarEscalaAutoMapeoPorZoom();
          if(!auto) map.setView([7.8891, -72.4967], 13);
      } catch(error) {
          console.error(error);
          if(status) status.innerHTML = '⚠️ No se pudo cargar el AutoMapeo de Cúcuta. Revisa internet o intenta de nuevo en unos minutos.';
      }
  };

  window.limpiarAutoMapeoCucuta = function() {
      autoMapeoCucutaLayer.clearLayers();
      autoMapeoCucutaCategorias = {};
      autoMapeoCucutaRegistros = [];
      autoMapeoCucutaData = [];
      urbisResetProximityRegistry('auto');
      const cont = document.getElementById('automap-toggles');
      const status = document.getElementById('automap-status');
      if(cont) cont.innerHTML = '';
      if(status) status.innerHTML = 'AutoMapeo limpiado. Tus capas manuales y reportes no se modificaron.';
      renderAutoMapeoMatriz();
  };



  const ZOOM_MOSTRAR_REPORTES_URBIS = 14;
  const ZOOM_MOSTRAR_AUTOMAPEO_DETALLADO = 16;
  let zoomRefreshTimer = null;

  function esRegistroAutoMapeoSheet(p) {
      const desc = String(p && p.descripcion || '').toLowerCase();
      const tipo = String(p && p.tipo || '').toLowerCase();
      return desc.includes('automapeo cúcuta') || desc.includes('automapeo cucuta') ||
             desc.includes('fuente: openstreetmap') || desc.includes('matriz de usos multidimensional') ||
             tipo.includes('automapeo');
  }

  function capaManualEstaActiva(capaName) {
      const checks = Array.from(document.querySelectorAll('#layers-toggles input[type="checkbox"]'));
      const item = checks.find(ch => ch.getAttribute('data-layer') === capaName);
      return !item || item.checked;
  }

  function puedeMostrarMarcadorPorZoom(p) {
      // V33: no se ocultan marcadores por zoom. Se prioriza estabilidad visual en móvil.
      return true;
  }

  function aplicarCapasSegunZoom() {
      // V33: las capas ya no se montan/desmontan por zoom porque eso hacía que los iconos “volaran” en móvil.
      Object.keys(capas || {}).forEach(nombre => {
          const layer = capas[nombre];
          if(!layer) return;
          if(capaManualEstaActiva(nombre)) {
              if(!map.hasLayer(layer)) map.addLayer(layer);
          } else if(map.hasLayer(layer)) {
              map.removeLayer(layer);
          }
      });
      const mostrarAutoVisual = (userRole === 'admin' || window.urbisAutoMapeoVisible === true);
      if(autoMapeoCucutaLayer) {
          if(mostrarAutoVisual) {
              if(!map.hasLayer(autoMapeoCucutaLayer)) map.addLayer(autoMapeoCucutaLayer);
          } else if(map.hasLayer(autoMapeoCucutaLayer)) {
              map.removeLayer(autoMapeoCucutaLayer);
          }
      }
      if(controlVialLayer && controlVialData.length && !map.hasLayer(controlVialLayer)) {
          controlVialLayer.addTo(map);
      }
      actualizarMensajeRendimientoZoom(map.getZoom());
  }

  function actualizarMensajeRendimientoZoom(z) {
      const status = document.getElementById('automap-status');
      if(!status) return;
      status.innerHTML = '📍 Marcadores estables: los iconos permanecen visibles durante el zoom para evitar saltos o reacomodos bruscos.';
  }

  function refrescarMarcadoresPorZoomDebounced() {
      // V33: se evita repintar marcadores por zoom/move. Repintarlos causaba saltos visuales en móvil.
      clearTimeout(zoomRefreshTimer);
  }

  function actualizarModoRendimientoPorZoom() {
      // V33: escala fija. Se eliminan los modos que ocultaban o agrandaban iconos por zoom.
      document.body.classList.remove('zoom-overview', 'zoom-medium', 'zoom-detail', 'zoom-moving');
      document.documentElement.style.setProperty('--auto-poi-scale', 1);
      document.documentElement.style.setProperty('--report-marker-scale', 1);
      document.querySelectorAll('.auto-poi-marker').forEach(el => el.classList.remove('auto-poi-small'));
      aplicarCapasSegunZoom();
  }
  function ajustarEscalaAutoMapeoPorZoom() { actualizarModoRendimientoPorZoom(); }
  map.on('zoomstart', () => document.body.classList.remove('zoom-moving'));
  map.on('zoomend moveend', () => { actualizarModoRendimientoPorZoom(); });
  map.whenReady(() => { actualizarModoRendimientoPorZoom(); aplicarCapasSegunZoom(); });
