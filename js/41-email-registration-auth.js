/* URBIS V153 · Registro ciudadano con sesión persistente y recuperación robusta
   Usa Google Apps Script como mini-backend temporal.
*/
(function(){
  'use strict';

  const CONFIG = () => (window.URBIS_CONFIG && window.URBIS_CONFIG.AUTH) || {};
  const SESSION_KEY = () => CONFIG().SESSION_KEY || 'urbis_auth_session_v1';
  const PENDING_REGISTRATION_KEY = () => (CONFIG().SESSION_KEY || 'urbis_auth_session_v1') + '_pending_verification';
  const PLACEHOLDER_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
  let pendingRegistration = null;
  let pendingRecovery = null;
  let recoveryResendTimer = null;
  let recoveryResendAvailableAt = 0;
  let currentAuthMode = 'login';

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function clean(v){ return String(v ?? '').trim(); }
  function normalizeEmail(v){ return clean(v).toLowerCase(); }
  function normalizeUsername(v){ return clean(v).toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, ''); }
  function onlyDigits(v){ return clean(v).replace(/\D+/g,''); }
  function savePendingRegistration(data){ try{ localStorage.setItem(PENDING_REGISTRATION_KEY(), JSON.stringify(data || {})); }catch(e){} }
  function readPendingRegistration(){ try{ return JSON.parse(localStorage.getItem(PENDING_REGISTRATION_KEY()) || 'null'); }catch(e){ return null; } }
  function clearPendingRegistration(){ try{ localStorage.removeItem(PENDING_REGISTRATION_KEY()); }catch(e){} }
  function normalizeColombiaPhone(v){
    let d = onlyDigits(v);
    if(d.startsWith('0057')) d = d.slice(4);
    if(d.startsWith('57') && d.length > 10) d = d.slice(2);
    if(d.startsWith('0') && d.length === 11) d = d.slice(1);
    return d ? '+57' + d : '';
  }
  function phoneDigitsForValidation(v){
    return normalizeColombiaPhone(v).replace(/\D+/g,'');
  }


  function pad2(v){ return String(v || '').padStart(2, '0'); }
  function buildBirthDateFromParts(day, month, year){
    const d = Number(day), m = Number(month), y = Number(year);
    if(!d || !m || !y) return { valid:false, message:'Selecciona día, mes y año de nacimiento.' };
    const dt = new Date(y, m - 1, d);
    if(dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d){
      return { valid:false, message:'Selecciona una fecha de nacimiento válida.' };
    }
    const today = new Date();
    if(dt > today) return { valid:false, message:'La fecha de nacimiento no puede ser futura.' };
    let age = today.getFullYear() - y;
    const beforeBirthday = (today.getMonth() < m - 1) || (today.getMonth() === m - 1 && today.getDate() < d);
    if(beforeBirthday) age--;
    if(age < 0 || age > 120) return { valid:false, message:'Revisa el año de nacimiento.' };
    return {
      valid:true,
      fecha: `${y}-${pad2(m)}-${pad2(d)}`,
      dia: pad2(d),
      mes: pad2(m),
      anio: String(y),
      edad: age,
      esMayor: age >= 18
    };
  }

  function readBirthDate(){
    return buildBirthDateFromParts($('reg-birth-day')?.value || '', $('reg-birth-month')?.value || '', $('reg-birth-year')?.value || '');
  }

  function updateBirthStatus(){
    const status = $('reg-birth-status');
    if(!status) return;
    const birth = readBirthDate();
    status.classList.remove('is-ok','is-error','is-minor');
    if(!($('reg-birth-day')?.value || $('reg-birth-month')?.value || $('reg-birth-year')?.value)){
      status.textContent = 'Usaremos esta fecha para identificar si el registro corresponde a una persona mayor o menor de edad.';
      return;
    }
    if(!birth.valid){
      status.textContent = birth.message;
      status.classList.add('is-error');
      return;
    }
    status.textContent = birth.esMayor ? `Mayor de edad: ${birth.edad} años.` : `Menor de edad: ${birth.edad} años. Puedes usar Tarjeta de identidad si corresponde.`;
    status.classList.add(birth.esMayor ? 'is-ok' : 'is-minor');
  }

  function populateBirthDateSelectors(){
    const day = $('reg-birth-day');
    const month = $('reg-birth-month');
    const year = $('reg-birth-year');
    if(!day || !month || !year || day.dataset.urbisBirthReady === '1') return;
    day.dataset.urbisBirthReady = '1';
    const selectedDay = day.value, selectedMonth = month.value, selectedYear = year.value;
    day.innerHTML = '<option value="">Día</option>' + Array.from({length:31}, (_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    month.innerHTML = '<option value="">Mes</option>' + months.map((name,i)=>`<option value="${i+1}">${name}</option>`).join('');
    const currentYear = new Date().getFullYear();
    const years = [];
    for(let y = currentYear; y >= currentYear - 120; y--) years.push(y);
    year.innerHTML = '<option value="">Año</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');
    if(selectedDay) day.value = selectedDay;
    if(selectedMonth) month.value = selectedMonth;
    if(selectedYear) year.value = selectedYear;
    [day, month, year].forEach(el => el.addEventListener('change', updateBirthStatus));
    updateBirthStatus();
  }

  function endpoint(){ return clean(CONFIG().APPS_SCRIPT_ENDPOINT || ''); }
  function authReady(){ const url = endpoint(); return url && url !== PLACEHOLDER_URL && /^https:\/\/script\.google\.com\//.test(url); }


  function passwordStrong(v){ return clean(v).length >= 8; }


  const COLOMBIA_LOCATION = {
    departamentos: {
      'Amazonas':['Leticia','Puerto Nariño'],
      'Antioquia':['Medellín','Bello','Itagüí','Envigado','Sabaneta','Rionegro','Apartadó','Turbo','Caucasia'],
      'Arauca':['Arauca','Arauquita','Saravena','Tame'],
      'Atlántico':['Barranquilla','Soledad','Malambo','Puerto Colombia','Galapa','Baranoa','Sabanalarga','Santo Tomás','Palmar de Varela'],
      'Bogotá D.C.':['Bogotá'],
      'Bolívar':['Cartagena','Magangué','Turbaco','Arjona','El Carmen de Bolívar','Mompox'],
      'Boyacá':['Tunja','Duitama','Sogamoso','Chiquinquirá','Paipa'],
      'Caldas':['Manizales','La Dorada','Chinchiná','Villamaría'],
      'Caquetá':['Florencia','San Vicente del Caguán','Puerto Rico'],
      'Casanare':['Yopal','Aguazul','Villanueva','Tauramena'],
      'Cauca':['Popayán','Santander de Quilichao','Puerto Tejada','Patía'],
      'Cesar':['Valledupar','Aguachica','Codazzi','Bosconia'],
      'Chocó':['Quibdó','Istmina','Condoto','Acandí'],
      'Córdoba':['Montería','Lorica','Cereté','Sahagún','Planeta Rica'],
      'Cundinamarca':['Soacha','Chía','Zipaquirá','Facatativá','Girardot','Mosquera','Madrid','Fusagasugá'],
      'Guainía':['Inírida'],
      'Guaviare':['San José del Guaviare','Calamar','El Retorno'],
      'Huila':['Neiva','Pitalito','Garzón','La Plata'],
      'La Guajira':['Riohacha','Maicao','Uribia','Manaure','Fonseca'],
      'Magdalena':['Santa Marta','Ciénaga','Fundación','El Banco','Plato'],
      'Meta':['Villavicencio','Acacías','Granada','Puerto López'],
      'Nariño':['Pasto','Tumaco','Ipiales','Túquerres'],
      'Norte de Santander':['Cúcuta','Villa del Rosario','Los Patios','Ocaña','Pamplona','Tibú','Ábrego','Arboledas','Bochalema','Bucarasica','Cácota','Cachirá','Chinácota','Chitagá','Convención','Cucutilla','Durania','El Carmen','El Tarra','El Zulia','Gramalote','Hacarí','Herrán','La Esperanza','La Playa','Labateca','Lourdes','Mutiscua','Pamplonita','Puerto Santander','Ragonvalia','Salazar','San Calixto','San Cayetano','Santiago','Sardinata','Silos','Teorama','Toledo','Villa Caro','Pueblitos / veredas','Otro municipio / corregimiento'],
      'Putumayo':['Mocoa','Puerto Asís','Orito','Valle del Guamuez'],
      'Quindío':['Armenia','Calarcá','Montenegro','Quimbaya'],
      'Risaralda':['Pereira','Dosquebradas','Santa Rosa de Cabal','La Virginia'],
      'San Andrés y Providencia':['San Andrés','Providencia'],
      'Santander':['Bucaramanga','Floridablanca','Girón','Piedecuesta','Barrancabermeja','San Gil'],
      'Sucre':['Sincelejo','Corozal','Sampués','Tolú'],
      'Tolima':['Ibagué','Espinal','Melgar','Honda','Chaparral'],
      'Valle del Cauca':['Cali','Palmira','Buenaventura','Tuluá','Buga','Jamundí','Cartago'],
      'Vaupés':['Mitú'],
      'Vichada':['Puerto Carreño']
    },
    comunas: {
      'Barranquilla':['Localidad Riomar','Localidad Norte-Centro Histórico','Localidad Metropolitana','Localidad Sur Occidente','Localidad Sur Oriente'],
      'Soledad':['Comuna 1 - Antigua Soledad','Comuna 2 - Nueva Soledad','Comuna 3','Comuna 4','Comuna 5','Comuna 6','Otra comuna / sector'],
      'Malambo':['Zona urbana norte','Zona urbana centro','Zona urbana sur'],
      'Cúcuta':['Comuna 1','Comuna 2','Comuna 3','Comuna 4','Comuna 5','Comuna 6','Comuna 7','Comuna 8','Comuna 9','Comuna 10'],
      'Medellín':['Comuna 1 Popular','Comuna 2 Santa Cruz','Comuna 3 Manrique','Comuna 4 Aranjuez','Comuna 5 Castilla','Comuna 6 Doce de Octubre','Comuna 7 Robledo','Comuna 8 Villa Hermosa','Comuna 9 Buenos Aires','Comuna 10 La Candelaria','Comuna 11 Laureles-Estadio','Comuna 12 La América','Comuna 13 San Javier','Comuna 14 El Poblado','Comuna 15 Guayabal','Comuna 16 Belén'],
      'Cali':['Comuna 1','Comuna 2','Comuna 3','Comuna 4','Comuna 5','Comuna 6','Comuna 7','Comuna 8','Comuna 9','Comuna 10','Comuna 11','Comuna 12','Comuna 13','Comuna 14','Comuna 15','Comuna 16','Comuna 17','Comuna 18','Comuna 19','Comuna 20','Comuna 21','Comuna 22'],
      'Bogotá':['Usaquén','Chapinero','Santa Fe','San Cristóbal','Usme','Tunjuelito','Bosa','Kennedy','Fontibón','Engativá','Suba','Barrios Unidos','Teusaquillo','Los Mártires','Antonio Nariño','Puente Aranda','La Candelaria','Rafael Uribe Uribe','Ciudad Bolívar','Sumapaz'],
      'Cartagena':['Localidad Histórica y del Caribe Norte','Localidad de la Virgen y Turística','Localidad Industrial y de la Bahía'],
      'Santa Marta':['Comuna 1','Comuna 2','Comuna 3','Comuna 4','Comuna 5','Comuna 6','Comuna 7','Comuna 8','Comuna 9'],
      'Bucaramanga':['Comuna 1 Norte','Comuna 2 Nororiental','Comuna 3 San Francisco','Comuna 4 Occidental','Comuna 5 García Rovira','Comuna 6 La Concordia','Comuna 7 La Ciudadela','Comuna 8 Sur Occidente','Comuna 9 La Pedregosa','Comuna 10 Provenza','Comuna 11 Sur','Comuna 12 Cabecera del Llano','Comuna 13 Oriental','Comuna 14 Morrorico','Comuna 15 Centro','Comuna 16 Lagos del Cacique','Comuna 17 Mutis']
    },
    barriosPorComuna: {
      'Soledad': {
        'Comuna 1 - Antigua Soledad':['12 de Octubre','El Parque','Las Gaviotas','Nuevo Triunfo','Villa Angelita','Villa Valentina','13 de Mayo','El Pasito','Las Margaritas','Oriental','Villa del Carmen','Villa Éxito','16 de Julio','El Río','Las Moras','Porvenir','Villa del Rey','Villa María','20 de Julio','El Triunfo','Las Nubes','Prado Soledad','Villa Estadio','Villa Severa','7 de Agosto','El Tucán','Las Trinitarias','Primero de Mayo','Villa Estefanny','Villa Viola','Altos de Sevilla','El Hipódromo','Ferrocarril','Puerta de Oro','Villa Gladys','Los Cocos','Bella Murillo','Juan Domínguez Romero','Los Almendros','Pumarejo','Villa Karla','Bonanza','La Alianza','Los Arrayanes','Renacer','Villa Katanga','Portal de Las Moras','Otro barrio / no aparece'],
        'Comuna 2 - Nueva Soledad':['Cabrera','La Arboleda','Los Balcanes','Los Cedros','Sal Si Puedes','Nueva Esperanza','Centenario','La Central','Los Cusules','Salamanca','Villa Merly','Centro','La Esperanza','Los Laureles','Salcedo','Villa Mónaco','Ciudad del Puerto','Ciudad Paraíso','Ciudad Camelot','Ciudad Bolívar','La Farruca','Los Loteros','San Antonio','Ciudad Salitre','La Fe','Los Mangos','San Vicente','Villa Rosa','Antonio Nariño','Ciudadela Metropolitana','Los Campanos','Altos de Las Villas','Ríos de Agua Viva','Villa Muvdi','La Floresta','Los Robles','Santa Inés','Villa Selene','Portal de Las Moras','Costa Hermosa','La Loma','Manuela Beltrán','Soledad 2000','Villa Sol','Cruz de Mayo','La María','Moras Norte','Tajamar','Villa Soledad','Don Bosco IV','La Rivera','Moras Occidente','Terranova','Villa Zambrano','El Cachimbero','El Chuchal','Normandía','Villa Adela','Viña del Rey','Villa de Las Moras','El Esfuerzo','Las Candelarias','Nueva Jerusalén','Villa Anita','Vista Hermosa','El Ferrocarril','Las Colonias','Nuevo Horizonte','Villa Aragón','Zarabanda','El Manantial','Las Ferias','Nuevo Milenio','Parque Muvdi','Villa Cecilia','Otro barrio / no aparece'],
        'Comuna 3':['Cabecera municipal / centro urbano','Zona general de la comuna','Otro barrio / no aparece'],
        'Comuna 4':['Cabecera municipal / centro urbano','Zona general de la comuna','Otro barrio / no aparece'],
        'Comuna 5':['Cabecera municipal / centro urbano','Zona general de la comuna','Otro barrio / no aparece'],
        'Comuna 6':['Cabecera municipal / centro urbano','Zona general de la comuna','Otro barrio / no aparece'],
        'Otra comuna / sector':['Escribir otra comuna o sector','Otro barrio / no aparece']
      },
      'Cúcuta': {
        'Comuna 1':['Callejón','Centro','El Contento','El Llano','El Páramo','Latino','La Playa','La Sexta','Otro / No aparece'],
        'Comuna 2':['Acuarela','Barrio Blanco','Bellavista','Brisas del Pamplonita','Caobos','Ceiba I','Ceiba II','Colsag','Condado de Castilla','El Lago','El Rosal','Govica','Hacaritama','Hurapanes','La Capillana','La Castellana','La Ceiba','La Primavera','La Rinconada','La Riviera','Las Almeidas','Libertadores','Los Acacios','Los Pinos','Los Próceres','Manolo Lemus','Mirador Campestre','Palma Real','Parque Central','Parque de Las Brisas','Parque Real','Parques Residenciales','Popular','Portal de Prados','Prados','Prados II','Prados Club','Quinta Bosh','Quinta Oriental','Quinta Vélez','Rincón de Prados','Santa Clara','Santa Lucía','San Isidro','San Remo','Torre Real','Urb. Galicia','Urb. La Esperanza','Urb. Torre Molinos','Villas del Prado','Villa Real','Otro / No aparece'],
        'Comuna 3':['Aguas Calientes','Bellavista','Boconó','Bogotá','El Triunfo','Luis Pérez Hernández','La Libertad','La Unión','Morelly','Mujeres Con Futuro','Nuevo Milenio','Policarpa','San Mateo','Santa Ana','San Juanito','Urb. Betel','Urb. El Cují','Urb. La Carolina','Urb. Las Margaritas','Urb. Santa Ana','Valle Esther','Otro / No aparece'],
        'Comuna 4':['13 de Marzo','Alto Pamplonita','Aniversario I','Aniversario II','Condominio Prado del Este','Conjunto Cerrado Estación del Este','El Higuerón','Heliópolis','Isla de La Fantasía','La Quinta','Prados del Este','San Luis','San José','San Martín','Santa Clara','Santa Teresita','Siglo XXI','Torcoroma','Torcoroma II','Urb. Canafístolo','Urb. La Alameda','Urb. La Florida','Urb. Nueva Esperanza','Urb. Nuevo Escobal','Urb. Santa Clara','Urb. San Diego','Urb. San Martín','Urb. Santillana','Urb. Terranova','Valle Bonito','Villa Camila','Viejo','Villas de San Diego','Escobal','Otro / No aparece'],
        'Comuna 5':['Alcalá','Ciudad Jardín','El Bosque','Gratamira','Guaimaral','La Merced','Lleras Restrepo','Paraíso','Pescadero','Colpet','Portachuelo','Prados del Norte','San Eduardo','Santa Helena','Lleras','Sevilla','Tasajero','Urb. Gualanday','Urb. La Mar','Urb. Libertadores Royal','Urb. Niza','Zona Industrial','Zona Franca','Zulima','Otro / No aparece'],
        'Comuna 6':['Aeropuerto','Brisas del Aeropuerto','Brisas de Los Molinos','Brisas del Norte','Brisas del Paraíso','Brisas del Porvenir','Caño Limón','Carlos García Lozada','Carlos Pizarro','Cecilia Castro','Cerro La Cruz','Cerro Norte','Colinas del Salado','Colinas de La Victoria','Cumbres del Norte','Divino Niño','El Cerrito','El Dorado','El Porvenir','El Porvenir Bajo','El Salado','Florida Blanca','García Herreros','La Concordia','La Ínsula','La Isla','Limonar del Norte','Los Laureles','María Auxiliadora','María Paz','Molinos del Norte','Nueva Sexta','Panamericano','Portal de Las Américas','Rafael Núñez','San Gerónimo','Simón Bolívar','Toledo Plata','Trigal del Norte','Urb. Las Américas','Urb. Los Girasoles','Urb. Luis David Flores C.','Villas de Las Américas','Villas de Los Tejares','Villa Juliana','Virgilio Barco','Zona Industrial','Otro / No aparece'],
        'Comuna 7':['Buenos Aires','Camilo Daza','Clared','Comuneros','Crispín Durán','Chapinero','El Paraíso','Juan Bautista Scalabrini','La Florida','La Hermita','La Laguna','La Primavera','Las Américas','Motilones','Nueva Colombia','Ospina Pérez','Rosal del Norte','Tucunaré','Otro / No aparece'],
        'Comuna 8':['7 de Agosto','13 de Mayo','Atalaya I Etapa','Atalaya II Etapa','Antonia Santos','Belisario Betancourt','Carlos Ramírez París','Cerro Pico','Cúcuta 75','Doña Nidia','El Desierto','El Dorado','El Oasis','El Progreso','El Rodeo','Juan Pablo Segundo','Juana Rangel','La Coralina','La Victoria','Minuto de Dios','Los Almendros','Nuevo Horizonte','Niña Ceci','Palmeras','Sabana Verde','Otro / No aparece'],
        'Comuna 9':['28 de Febrero','Barrio Nuevo','Belén','Belén de Umbría','Cundinamarca','Carora','Divina Pastora','Los Alpes','Rudesindo Soto','San Miguel','Urb. Brisa de La Hermita','Valles del Rodeo','Villa de La Paz','Otro / No aparece'],
        'Comuna 10':['Alfonso López','Camilo Torres','Circunvalación','Cuberos Niños','Gaitán','Galán','La Cabrera','Magdalena','Puente Barco','Santander','Santo Domingo','San José','San Rafael','Otro / No aparece']
      }
    },
    barrios: {
      'Barranquilla':['Alto Prado','El Prado','Riomar','Villa Santos','Boston','El Recreo','Ciudad Jardín','Las Nieves','La Victoria','La Chinita','Rebolo','San José','Los Andes','El Bosque','La Sierrita','Las Delicias','El Valle','Olaya','Simón Bolívar','Otro / No aparece'],
      'Soledad':['12 de Octubre','El Parque','Las Gaviotas','Villa Angelita','El Pasito','Villa del Carmen','Villa Éxito','Las Moras','Villa del Rey','Prado Soledad','Villa Estadio','El Hipódromo','Los Cocos','Los Almendros','Pumarejo','Portal de Las Moras','Cabrera','La Arboleda','Los Balcanes','Los Cedros','Nueva Esperanza','Centro','La Esperanza','Los Laureles','Villa Mónaco','Ciudadela Metropolitana','Los Robles','Santa Inés','Costa Hermosa','Soledad 2000','Moras Norte','Terranova','Villa Adela','Nuevo Horizonte','Nuevo Milenio','Parque Muvdi','Villa Cecilia','Otro barrio / no aparece'],
      'Malambo':['Malambo Centro','El Concorde','Bellavista','La Milagrosa','Villa Esperanza','San José','El Tesoro','Otro / No aparece'],
      'Cúcuta':['Centro','Caobos','La Playa','Prados del Este','Niza','San Luis','Atalaya','Belén','Comuneros','El Contento','Motilones','Otro / No aparece'],
      'Chinácota':['Centro','Zona urbana','Zona rural / vereda','Mi barrio no aparece'],
      'Toledo':['Centro','Zona urbana','Zona rural / vereda','Mi barrio no aparece'],
      'Labateca':['Centro','Zona urbana','Zona rural / vereda','Mi barrio no aparece'],
      'Salazar':['Centro','Zona urbana','Zona rural / vereda','Mi barrio no aparece'],
      'Pueblitos / veredas':['Vereda / centro poblado','Corregimiento','Mi ubicación no aparece'],
      'Otro municipio / corregimiento':['Cabecera municipal / centro urbano','Zona rural / vereda','Centro poblado / corregimiento','Mi barrio no aparece'],
      'Bogotá':['Chapinero','Teusaquillo','La Candelaria','Suba','Usaquén','Kennedy','Bosa','Fontibón','Engativá','Ciudad Bolívar','Puente Aranda','Otro / No aparece'],
      'Medellín':['El Poblado','Laureles','Belén','Robledo','Aranjuez','Manrique','Castilla','Buenos Aires','La América','San Javier','Otro / No aparece'],
      'Cali':['San Antonio','Granada','El Peñón','Ciudad Jardín','Siloé','Aguablanca','El Ingenio','Caney','Meléndez','Otro / No aparece'],
      'Cartagena':['Bocagrande','Castillogrande','Manga','Getsemaní','Centro Histórico','La Boquilla','El Pozón','Olaya Herrera','Otro / No aparece'],
      'Santa Marta':['Centro','El Rodadero','Bavaria','Pescaíto','Mamatoco','Gaira','Taganga','Otro / No aparece'],
      'Bucaramanga':['Cabecera del Llano','Centro','Real de Minas','Provenza','Mutis','San Francisco','La Concordia','Otro / No aparece']
    }
  };

  function naOptionForSelect(id){
    return {
      'reg-department':'N/A',
      'reg-city':'N/A',
      'reg-comuna':'N/A',
      'reg-barrio':'N/A'
    }[id] || '';
  }

  function otherOptionForSelect(id){
    return {
      'reg-department':'Otro departamento',
      'reg-city':'Otra ciudad o corregimiento',
      'reg-comuna':'Otra comuna / sector',
      'reg-barrio':'Otro barrio / vereda'
    }[id] || '';
  }

  function withOtherOption(id, items){
    const list = Array.from(new Set((items || []).filter(Boolean)));
    const na = naOptionForSelect(id);
    const other = otherOptionForSelect(id);
    if(na && !list.includes(na)) list.push(na);
    if(other && !list.includes(other)) list.push(other);
    return list;
  }

  function fillSelect(id, items, placeholder, keepValue = ''){
    const el = $(id);
    if(!el) return;
    const finalItems = withOtherOption(id, items || []);
    const prev = keepValue || el.value || '';
    const opts = [`<option value="">${esc(placeholder)}</option>`].concat(finalItems.map(item => `<option value="${esc(item)}">${esc(item)}</option>`));
    el.innerHTML = opts.join('');
    if(prev && finalItems.includes(prev)) el.value = prev;
  }

  function setupLocationSelectors(force = false){
    const country = $('reg-country');
    const countryOther = $('reg-country-other');
    const countryOtherWrap = $('reg-country-other-wrap');
    const department = $('reg-department');
    const city = $('reg-city');
    const comuna = $('reg-comuna');
    const barrio = $('reg-barrio');
    if(!country || !department || !city || !comuna || !barrio) return false;
    ensureLocationOtherInputs();

    const departmentNames = Object.keys(COLOMBIA_LOCATION.departamentos);
    const genericComunas = ['N/A','No aplica / zona general','Otra comuna / sector'];
    const genericBarrios = ['N/A','Cabecera municipal / centro urbano','Zona rural / vereda','Centro poblado / corregimiento','Otro barrio / vereda'];

    function isOtherLocationValue(v){
      const x = clean(v).toLowerCase();
      return x.startsWith('otro') || x.startsWith('otra') || x.includes('no aparece') || x.includes('mi barrio') || x.includes('mi ubicación') || x.includes('mi ubicacion');
    }

    function ensureLocationOtherInput(selectId, inputId, placeholder, icon){
      const select = $(selectId);
      if(!select || $(inputId)) return;
      const field = select.closest('.urbis-field');
      if(!field) return;
      const wrap = document.createElement('div');
      wrap.id = inputId + '-wrap';
      wrap.className = 'urbis-register-other-country urbis-register-other-location';
      wrap.hidden = true;
      wrap.innerHTML = `<div class="urbis-register-input-shell aqua-shell"><span class="urbis-register-icon">${icon}</span><input type="text" id="${inputId}" class="reg-input" placeholder="${placeholder}" enterkeyhint="next"></div>`;
      const hint = field.querySelector('.urbis-field-hint');
      if(hint) field.insertBefore(wrap, hint);
      else field.appendChild(wrap);
    }

    function ensureLocationOtherInputs(){
      ensureLocationOtherInput('reg-department','reg-department-other','Escribe tu departamento','🗺️');
      ensureLocationOtherInput('reg-city','reg-city-other','Escribe tu ciudad o corregimiento','🏙️');
      ensureLocationOtherInput('reg-comuna','reg-comuna-other','Escribe tu comuna o sector','🧭');
      ensureLocationOtherInput('reg-barrio','reg-barrio-other','Escribe tu barrio, vereda o sector','📍');
    }

    function updateLocationOtherInputs(){
      [
        ['reg-department','reg-department-other'],
        ['reg-city','reg-city-other'],
        ['reg-comuna','reg-comuna-other'],
        ['reg-barrio','reg-barrio-other']
      ].forEach(([selectId,inputId]) => {
        const select = $(selectId);
        const input = $(inputId);
        const wrap = $(inputId + '-wrap');
        if(!select || !input || !wrap) return;
        const show = country.value === 'Colombia' && isOtherLocationValue(select.value);
        wrap.hidden = !show;
        wrap.style.display = show ? 'block' : 'none';
        input.required = show;
        if(!show) input.value = '';
      });
    }

    function showColombiaFields(show){
      document.querySelectorAll('[data-colombia-location-field]').forEach(el => {
        el.hidden = !show;
        el.style.display = show ? '' : 'none';
      });
      department.disabled = !show;
      city.disabled = !show;
      comuna.disabled = !show;
      barrio.disabled = !show;
    }

    function ensureCountryOptions(){
      const values = Array.from(country.options || []).map(o => o.value);
      if(!values.includes('Colombia') || !values.includes('Otro país')){
        country.innerHTML = '<option value="Colombia">Colombia</option><option value="Otro país">Otro país</option>';
      }
      if(!country.value) country.value = 'Colombia';
    }

    function ensureDepartments(keepValue = department.value){
      const options = Array.from(department.options || []).map(o => o.value).filter(Boolean);
      if(force || options.length < departmentNames.length){
        fillSelect('reg-department', departmentNames, 'Departamento', keepValue);
      }
    }

    function getComunasForCity(cityName){
      if(!cityName) return [];
      return COLOMBIA_LOCATION.comunas[cityName] || genericComunas;
    }

    function getBarriosForSelection(cityName, comunaName){
      if(!cityName) return [];
      const byComuna = COLOMBIA_LOCATION.barriosPorComuna?.[cityName];
      if(byComuna){
        return comunaName ? (byComuna[comunaName] || genericBarrios) : [];
      }
      return COLOMBIA_LOCATION.barrios[cityName] || genericBarrios;
    }

    function syncComunaAndBarrio(keepComuna = comuna.value, keepBarrio = barrio.value){
      if(country.value !== 'Colombia') return;
      const comunas = getComunasForCity(city.value);
      fillSelect('reg-comuna', city.value ? comunas : [], 'Comuna', keepComuna);
      const barrios = getBarriosForSelection(city.value, comuna.value);
      fillSelect('reg-barrio', city.value ? barrios : [], 'Barrio', keepBarrio);
      updateLocationOtherInputs();
    }

    function resetColombiaLists(keepDepartment = department.value){
      ensureCountryOptions();
      showColombiaFields(true);
      ensureDepartments(keepDepartment);
      const cities = COLOMBIA_LOCATION.departamentos[department.value] || [];
      fillSelect('reg-city', cities, 'Ciudad o corregimiento', city.value);
      syncComunaAndBarrio(comuna.value, barrio.value);
    }

    function setOtherCountryMode(){
      fillSelect('reg-department', [], 'No aplica');
      fillSelect('reg-city', [], 'No aplica');
      fillSelect('reg-comuna', [], 'No aplica');
      fillSelect('reg-barrio', [], 'No aplica');
      showColombiaFields(false);
      updateLocationOtherInputs();
    }

    function syncCountryMode(){
      ensureCountryOptions();
      const isOther = country.value === 'Otro país';
      if(countryOtherWrap){
        countryOtherWrap.hidden = !isOther;
        countryOtherWrap.style.display = isOther ? 'block' : 'none';
      }
      if(countryOther){
        countryOther.required = isOther;
        if(!isOther) countryOther.value = '';
      }
      if(isOther){
        setOtherCountryMode();
        setTimeout(() => countryOther?.focus?.(), 80);
      }else{
        country.value = 'Colombia';
        resetColombiaLists();
      }
    }

    function syncDepartment(){
      if(country.value !== 'Colombia') return;
      ensureDepartments(department.value);
      const cities = COLOMBIA_LOCATION.departamentos[department.value] || [];
      fillSelect('reg-city', cities, 'Ciudad o corregimiento');
      fillSelect('reg-comuna', [], 'Comuna');
      fillSelect('reg-barrio', [], 'Barrio');
      updateLocationOtherInputs();
    }

    function syncCity(){
      if(country.value !== 'Colombia') return;
      syncComunaAndBarrio('', '');
    }

    function syncComuna(){
      if(country.value !== 'Colombia') return;
      const barrios = getBarriosForSelection(city.value, comuna.value);
      fillSelect('reg-barrio', city.value ? barrios : [], 'Barrio');
      updateLocationOtherInputs();
    }

    ensureCountryOptions();

    if(!country.dataset.urbisLocationBound){
      country.dataset.urbisLocationBound = '1';
      country.addEventListener('change', syncCountryMode);
      country.addEventListener('input', syncCountryMode);
      ['focus','pointerdown','click'].forEach(evt => country.addEventListener(evt, ensureCountryOptions));

      department.addEventListener('change', syncDepartment);
      department.addEventListener('input', syncDepartment);
      ['focus','pointerdown','click'].forEach(evt => department.addEventListener(evt, () => ensureDepartments(department.value)));

      city.addEventListener('change', syncCity);
      city.addEventListener('input', syncCity);

      comuna.addEventListener('change', syncComuna);
      comuna.addEventListener('input', syncComuna);
      barrio.addEventListener('change', updateLocationOtherInputs);
      barrio.addEventListener('input', updateLocationOtherInputs);
    }

    if(document.body.dataset.urbisLocationDelegated !== '1'){
      document.body.dataset.urbisLocationDelegated = '1';
      document.addEventListener('change', ev => {
        if(ev.target?.id === 'reg-country') setupLocationSelectors(true);
        if(ev.target?.id === 'reg-department') setupLocationSelectors(true) && syncDepartment();
        if(ev.target?.id === 'reg-city') setupLocationSelectors(true) && syncCity();
        if(ev.target?.id === 'reg-comuna') setupLocationSelectors(true) && syncComuna();
        if(ev.target?.id === 'reg-barrio') setupLocationSelectors(true) && updateLocationOtherInputs();
      }, true);
    }

    syncCountryMode();
    updateLocationOtherInputs();
    return true;
  }


  function isIOSLikeDevice(){
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function locationPickerTargets(){
    return ['reg-department','reg-city','reg-comuna','reg-barrio'];
  }

  function ensureIOSLocationPicker(){
    let modal = $('urbis-ios-location-picker');
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = 'urbis-ios-location-picker';
    modal.className = 'urbis-ios-location-picker';
    modal.innerHTML = `
      <div class="urbis-ios-picker-backdrop" data-urbis-ios-picker-close="1"></div>
      <section class="urbis-ios-picker-sheet" role="dialog" aria-modal="true" aria-label="Seleccionar ubicación">
        <div class="urbis-ios-picker-handle" aria-hidden="true"></div>
        <div class="urbis-ios-picker-head">
          <div>
            <small>Selecciona de la lista</small>
            <h3 id="urbis-ios-picker-title">Ubicación</h3>
          </div>
          <button type="button" class="urbis-ios-picker-close" data-urbis-ios-picker-close="1" aria-label="Cerrar">×</button>
        </div>
        <div class="urbis-ios-picker-search-wrap">
          <span aria-hidden="true">🔎</span>
          <input id="urbis-ios-picker-search" type="search" placeholder="Buscar..." autocomplete="off">
        </div>
        <div id="urbis-ios-picker-list" class="urbis-ios-picker-list"></div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(ev){
      if(ev.target && ev.target.getAttribute && ev.target.getAttribute('data-urbis-ios-picker-close') === '1'){
        closeIOSLocationPicker();
      }
    });
    const search = $('urbis-ios-picker-search');
    if(search){
      search.addEventListener('input', renderIOSLocationPickerOptions);
      search.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') closeIOSLocationPicker(); });
    }
    return modal;
  }

  function closeIOSLocationPicker(){
    const modal = $('urbis-ios-location-picker');
    if(modal){
      modal.classList.remove('show');
      modal.dataset.selectId = '';
    }
    document.body.classList.remove('urbis-ios-picker-open');
  }

  function getIOSPickerOptions(select){
    return Array.from(select?.options || [])
      .filter(opt => opt && clean(opt.value))
      .map(opt => ({ value: opt.value, label: opt.textContent || opt.value }));
  }

  function getIOSPickerTitle(select){
    if(!select) return 'Ubicación';
    const label = document.querySelector('.urbis-field-label[for="' + select.id + '"]');
    if(label && clean(label.textContent)) return clean(label.textContent);
    const names = {
      'reg-department':'Departamento',
      'reg-city':'Ciudad o corregimiento',
      'reg-comuna':'Comuna / sector',
      'reg-barrio':'Barrio / vereda'
    };
    return names[select.id] || 'Ubicación';
  }

  function renderIOSLocationPickerOptions(){
    const modal = $('urbis-ios-location-picker');
    const list = $('urbis-ios-picker-list');
    const search = normalizeEmail($('urbis-ios-picker-search')?.value || '');
    if(!modal || !list) return;
    const select = $(modal.dataset.selectId || '');
    const options = getIOSPickerOptions(select);
    const filtered = options.filter(opt => normalizeEmail(opt.label).includes(search) || normalizeEmail(opt.value).includes(search));
    if(!filtered.length){
      list.innerHTML = `<div class="urbis-ios-picker-empty">No hay opciones disponibles. Prueba con N/A u Otro cuando aparezca en la lista.</div>`;
      return;
    }
    list.innerHTML = filtered.map(opt => {
      const active = select && select.value === opt.value;
      return `<button type="button" class="urbis-ios-picker-option ${active ? 'active' : ''}" data-value="${esc(opt.value)}"><span>${esc(opt.label)}</span>${active ? '<b>✓</b>' : ''}</button>`;
    }).join('');
    list.querySelectorAll('.urbis-ios-picker-option').forEach(btn => {
      btn.addEventListener('click', function(){
        const value = btn.getAttribute('data-value') || '';
        const currentSelect = $(modal.dataset.selectId || '');
        if(!currentSelect) return;
        currentSelect.value = value;
        currentSelect.dispatchEvent(new Event('input', { bubbles:true }));
        currentSelect.dispatchEvent(new Event('change', { bubbles:true }));
        closeIOSLocationPicker();
        try{ currentSelect.blur(); }catch(e){}
        setTimeout(() => {
          try{ currentSelect.closest('.urbis-field')?.scrollIntoView({ block:'center', behavior:'smooth' }); }catch(e){}
        }, 120);
      });
    });
  }

  function openIOSLocationPicker(select){
    if(!select || select.disabled) return;
    setupLocationSelectors(true);
    const refreshed = $(select.id) || select;
    const modal = ensureIOSLocationPicker();
    modal.dataset.selectId = refreshed.id;
    const title = $('urbis-ios-picker-title');
    const search = $('urbis-ios-picker-search');
    if(title) title.textContent = getIOSPickerTitle(refreshed);
    if(search){
      search.value = '';
      search.placeholder = 'Buscar ' + getIOSPickerTitle(refreshed).toLowerCase() + '...';
    }
    renderIOSLocationPickerOptions();
    document.body.classList.add('urbis-ios-picker-open');
    modal.classList.add('show');
    // No enfocamos automáticamente el buscador en iPhone: evita que el teclado bloquee el scroll del formulario.

  }

  function bindIOSLocationPicker(){
    if(document.body.dataset.urbisIOSLocationPicker === '1') return;
    document.body.dataset.urbisIOSLocationPicker = '1';
    const selector = locationPickerTargets().map(id => 'select#' + id).join(',');
    function handler(ev){
      if(!isIOSLikeDevice()) return;
      const target = ev.target && ev.target.closest ? ev.target.closest(selector) : null;
      if(!target || target.disabled) return;
      ev.preventDefault();
      ev.stopPropagation();
      if(typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
      try{ target.blur(); }catch(e){}
      openIOSLocationPicker(target);
    }
    document.addEventListener('touchstart', handler, { capture:true, passive:false });
    document.addEventListener('click', handler, true);
    document.addEventListener('keydown', function(ev){
      if(ev.key === 'Escape') closeIOSLocationPicker();
    }, true);
  }

  function setAuthMode(mode, options = {}){
    const shouldOpenPanel = options.openPanel !== false;
    currentAuthMode = mode === 'register' ? 'register' : 'login';

    document.body.classList.toggle('urbis-auth-panel-open', shouldOpenPanel);
    document.body.classList.toggle('urbis-auth-login-view', shouldOpenPanel && currentAuthMode === 'login');
    document.body.classList.toggle('urbis-auth-registering', shouldOpenPanel && currentAuthMode === 'register');

    const loginPanel = $('urbis-login-panel');
    const registerFields = $('urbis-register-fields');
    if(loginPanel) loginPanel.hidden = currentAuthMode !== 'login';
    if(registerFields) registerFields.hidden = currentAuthMode !== 'register';
    document.querySelectorAll('[data-urbis-auth-mode]').forEach(btn => {
      btn.classList.toggle('active', shouldOpenPanel && btn.dataset.urbisAuthMode === currentAuthMode);
    });
    const submit = $('normal-submit-btn');
    if(submit) submit.hidden = currentAuthMode !== 'register';

    if(!shouldOpenPanel) return;

    const panel = $('normal-access-panel');
    if(panel){
      setTimeout(() => {
        try { panel.scrollIntoView({ block:'start', behavior:'smooth' }); } catch(e) {}
      }, 60);
    }

    if(currentAuthMode === 'login') setTimeout(() => $('login-username')?.focus(), 120);
    else {
      setupLocationSelectors(true);
      bindIOSLocationPicker();
      setTimeout(() => $('reg-name')?.focus(), 120);
    }
  }

  function closeAuthPanel(){
    document.body.classList.remove('urbis-auth-panel-open', 'urbis-auth-login-view', 'urbis-auth-registering');
    document.querySelectorAll('[data-urbis-auth-mode]').forEach(btn => btn.classList.remove('active'));
    const login = $('login-screen');
    if(login){
      login.style.display = '';
      login.style.opacity = '';
      login.style.visibility = '';
      login.style.pointerEvents = '';
      login.style.touchAction = '';
    }
    const mobileApp = $('urbis-mobile-app');
    if(mobileApp){
      mobileApp.style.display = '';
      mobileApp.style.visibility = '';
      mobileApp.style.pointerEvents = '';
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  function bindAuthModeControls(){
    document.querySelectorAll('[data-urbis-auth-mode]').forEach(btn => {
      if(btn.dataset.urbisModeBound === '1') return;
      btn.dataset.urbisModeBound = '1';
      btn.addEventListener('click', () => setAuthMode(btn.dataset.urbisAuthMode, { openPanel:true }));
    });
    const regInline = $('urbis-open-register-inline');
    if(regInline && regInline.dataset.bound !== '1'){ regInline.dataset.bound = '1'; regInline.addEventListener('click', () => setAuthMode('register', { openPanel:true })); }
    const recLogin = $('urbis-open-recovery-login');
    if(recLogin && recLogin.dataset.bound !== '1'){ recLogin.dataset.bound = '1'; recLogin.addEventListener('click', openRecoveryModal); }
    const loginBtn = $('urbis-login-btn');
    if(loginBtn && loginBtn.dataset.bound !== '1'){ loginBtn.dataset.bound = '1'; loginBtn.addEventListener('click', loginRegisteredUser); }
    const backBtn = $('urbis-login-back');
    if(backBtn && backBtn.dataset.bound !== '1'){
      backBtn.dataset.bound = '1';
      backBtn.addEventListener('click', () => closeAuthPanel());
    }
    const registerBackBtn = $('urbis-register-back');
    if(registerBackBtn && registerBackBtn.dataset.bound !== '1'){
      registerBackBtn.dataset.bound = '1';
      registerBackBtn.addEventListener('click', () => closeAuthPanel());
    }
    const registerToLogin = $('urbis-switch-login-link');
    if(registerToLogin && registerToLogin.dataset.bound !== '1'){
      registerToLogin.dataset.bound = '1';
      registerToLogin.addEventListener('click', () => setAuthMode('login', { openPanel:true }));
    }
  }

  function bindRegisterSubmitFallback(){
    if(document.body.dataset.urbisRegisterSubmitFallback === '1') return;
    document.body.dataset.urbisRegisterSubmitFallback = '1';
    document.addEventListener('click', function(ev){
      const btn = ev.target && ev.target.closest ? ev.target.closest('#normal-submit-btn') : null;
      if(!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      registerCitizen(ev);
    }, true);
  }

  function toast(msg){
    let el = $('urbis-auth-toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'urbis-auth-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(()=>el.classList.remove('show'), 4200);
  }

  function wait(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function ensureRegisterLoading(){
    if($('urbis-register-loading')) return;
    const loading = document.createElement('div');
    loading.id = 'urbis-register-loading';
    loading.className = 'urbis-register-loading';
    loading.setAttribute('aria-live', 'polite');
    loading.setAttribute('aria-modal', 'true');
    loading.innerHTML = `
      <div class="urbis-register-loading-card">
        <div class="urbis-loading-brand">URBIS</div>
        <div class="urbis-loading-spinner" aria-hidden="true"></div>
        <h2 id="urbis-loading-title">Creando tu cuenta</h2>
        <p id="urbis-loading-text">Espera un momento mientras enviamos el código de confirmación a tu correo. Si no lo ves, revisa Spam o Promociones.</p>
        <div class="urbis-loading-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      </div>
    `;
    document.body.appendChild(loading);
  }

  function showRegisterLoading(title, text){
    ensureRegisterLoading();
    const loading = $('urbis-register-loading');
    const titleEl = $('urbis-loading-title');
    const textEl = $('urbis-loading-text');
    if(titleEl) titleEl.textContent = title || 'Creando tu cuenta';
    if(textEl) textEl.textContent = text || 'Espera un momento mientras preparamos la confirmación.';
    if(loading){
      loading.classList.add('show');
      document.body.classList.add('urbis-register-is-loading');
    }
  }

  function hideRegisterLoading(){
    const loading = $('urbis-register-loading');
    if(loading) loading.classList.remove('show');
    document.body.classList.remove('urbis-register-is-loading');
  }

  function ensureTermsBox(){
    const panel = $('urbis-register-fields') || $('normal-data-panel');
    const submit = $('normal-submit-btn');
    if(!panel || !submit) return;

    let box = $('urbis-auth-consents');
    if(!box){
      box = document.createElement('div');
      box.id = 'urbis-auth-consents';
      box.className = 'urbis-auth-consents';
      box.innerHTML = `
        <div class="urbis-legal-title"><span class="urbis-legal-title-icon">🛡️</span> Protección de tus datos</div>
        <label class="urbis-auth-check urbis-auth-check-required">
          <input type="checkbox" id="urbis-terms-accepted" aria-required="true">
          <span>
            <strong>Acepto los Términos y Condiciones</strong>
            <small>de URBIS y autorizo el tratamiento de mis datos para crear, validar y gestionar mi cuenta.</small>
          </span>
        </label>
        <label class="urbis-auth-check">
          <input type="checkbox" id="urbis-mobility-consent">
          <span>
            <strong>Acepto el uso anónimo y agregado</strong>
            <small>de mi ubicación para análisis territorial, mapas de calor y mejora de la movilidad.</small>
            <em>(Opcional)</em>
          </span>
        </label>
        <div class="urbis-legal-separator" aria-hidden="true"></div>
        <div class="urbis-legal-note">
          <span class="urbis-legal-note-icon">🔒</span>
          <span>Tus datos serán tratados de forma segura. Puedes solicitar actualización o eliminación escribiendo a <b>urbisprocity@gmail.com</b>.</span>
        </div>
        <small class="urbis-auth-phone-note">El celular se guardará con indicativo Colombia <b>+57</b>.</small>
        <button type="button" id="urbis-open-recovery" class="urbis-auth-mini-link">¿Olvidaste tu cuenta?<br><span>Recuperar acceso</span></button>
        <small class="urbis-auth-note">Tu correo se validará con un código antes de activar la cuenta. Si no llega a la bandeja principal, revisa Spam, Promociones o Correo no deseado.</small>
      `;
      const holder = submit.parentElement || panel;
      holder.insertBefore(box, submit);
    }

    submit.textContent = 'Crear cuenta';
    submit.type = 'button';
    submit.removeAttribute('onclick');
    if(submit.dataset.registerBound !== '1'){
      submit.dataset.registerBound = '1';
      submit.addEventListener('click', registerCitizen);
      submit.addEventListener('touchend', function(ev){
        ev.preventDefault();
        registerCitizen(ev);
      }, {passive:false});
    }

    const recBtn = $('urbis-open-recovery');
    if(recBtn && recBtn.dataset.bound !== '1'){
      recBtn.dataset.bound = '1';
      recBtn.addEventListener('click', openRecoveryModal);
    }

    document.querySelectorAll('.direct-test-btn').forEach(btn => {
      btn.style.display = 'none';
      btn.setAttribute('hidden', 'hidden');
      btn.removeAttribute('onclick');
    });
    document.querySelectorAll('.btn-google').forEach(btn => {
      btn.style.display = 'none';
      btn.setAttribute('hidden', 'hidden');
      btn.removeAttribute('onclick');
    });
  }

  function ensureVerificationModal(){
    if($('urbis-verification-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'urbis-verification-modal';
    modal.className = 'urbis-auth-modal urbis-verification-flow';
    modal.innerHTML = `
      <div class="urbis-auth-card urbis-verification-card">
        <button type="button" class="urbis-auth-x" id="urbis-auth-close" aria-label="Cerrar verificación">×</button>
        <div class="urbis-auth-badge">URBIS</div>
        <h2>Confirma tu correo</h2>
        <p id="urbis-auth-modal-text">Te enviamos un código de 6 dígitos. Escríbelo para activar tu cuenta. Si no aparece, revisa Spam, Promociones o Correo no deseado.</p>
        <input id="urbis-verification-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" aria-label="Código de verificación">
        <button type="button" id="urbis-verify-btn" class="urbis-auth-primary">Verificar y entrar a URBIS</button>
        <button type="button" id="urbis-resend-btn" class="urbis-auth-secondary">Reenviar código</button>
        <p class="urbis-auth-hint">Tu cuenta no se activa hasta confirmar el código. Revisa también Spam, Promociones o Correo no deseado.</p>
      </div>
    `;
    document.body.appendChild(modal);
    $('urbis-auth-close').addEventListener('click', ()=>modal.classList.remove('show'));
    const verifyBtn = $('urbis-verify-btn');
    if(verifyBtn){
      verifyBtn.addEventListener('click', verifyCode);
      verifyBtn.addEventListener('touchend', function(ev){ ev.preventDefault(); verifyCode(ev); }, {passive:false});
    }
    const codeInput = $('urbis-verification-code');
    if(codeInput){
      codeInput.addEventListener('input', () => { codeInput.value = onlyDigits(codeInput.value).slice(0,6); });
      codeInput.addEventListener('keydown', ev => { if(ev.key === 'Enter') verifyCode(ev); });
    }
    $('urbis-resend-btn').addEventListener('click', ()=>{
      pendingRegistration = pendingRegistration || readPendingRegistration();
      if(pendingRegistration) sendRegisterRequest(pendingRegistration, true);
      else toast('Primero completa el registro para reenviar el código.');
    });
  }

  function openVerificationModal(email){
    ensureVerificationModal();
    $('urbis-auth-modal-text').innerHTML = `Enviamos un código a <b>${esc(email)}</b>. Escríbelo para activar tu cuenta y entrar a URBIS. Si no lo ves en unos segundos, revisa <b>Spam</b>, <b>Promociones</b> o <b>Correo no deseado</b>.`;
    $('urbis-verification-code').value = '';
    $('urbis-verification-modal').classList.add('show');
    setTimeout(()=>$('urbis-verification-code')?.focus(), 150);
  }


  function ensureRecoveryModal(){
    if($('urbis-recovery-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'urbis-recovery-modal';
    modal.className = 'urbis-auth-modal';
    modal.innerHTML = `
      <div class="urbis-auth-card">
        <button type="button" class="urbis-auth-x" id="urbis-recovery-close">×</button>
        <div class="urbis-auth-badge">URBIS</div>
        <h2>Recuperar cuenta</h2>
        <p id="urbis-recovery-text">Escribe tu usuario, correo, celular o cédula. Enviaremos un código al correo asociado.</p>
        <input id="urbis-recovery-identifier" class="urbis-auth-input" placeholder="Usuario, correo, celular o cédula" autocomplete="username">
        <button type="button" id="urbis-recovery-send" class="urbis-auth-primary">Enviar código</button>
        <input id="urbis-recovery-code" class="urbis-auth-input" inputmode="numeric" maxlength="6" placeholder="Código de 6 dígitos" hidden>
        <div class="urbis-auth-password-wrap" id="urbis-recovery-pass-wrap" hidden>
          <input id="urbis-recovery-new-password" class="urbis-auth-input has-eye" type="password" autocomplete="new-password" placeholder="Nueva contraseña">
          <button type="button" class="urbis-auth-eye" data-urbis-password-toggle="urbis-recovery-new-password" aria-label="Mostrar contraseña" aria-pressed="false">👁️</button>
        </div>
        <div class="urbis-auth-password-wrap" id="urbis-recovery-pass-confirm-wrap" hidden>
          <input id="urbis-recovery-new-password-confirm" class="urbis-auth-input has-eye" type="password" autocomplete="new-password" placeholder="Confirmar nueva contraseña">
          <button type="button" class="urbis-auth-eye" data-urbis-password-toggle="urbis-recovery-new-password-confirm" aria-label="Mostrar contraseña" aria-pressed="false">👁️</button>
        </div>
        <div id="urbis-recovery-resend-box" class="urbis-recovery-resend-box" hidden>
          <p id="urbis-recovery-timer" class="urbis-auth-hint urbis-recovery-timer">Podrás reenviar el código en 01:00</p>
          <button type="button" id="urbis-recovery-resend" class="urbis-auth-secondary" disabled>Reenviar código</button>
        </div>
        <button type="button" id="urbis-recovery-verify" class="urbis-auth-primary" hidden>Verificar y entrar</button>
        <p class="urbis-auth-hint">Por seguridad, si usas celular, el código se enviará al correo que esté vinculado a ese número.</p>
      </div>
    `;
    document.body.appendChild(modal);
    $('urbis-recovery-close').addEventListener('click', ()=>{ clearRecoveryCountdown(); modal.classList.remove('show'); });
    $('urbis-recovery-send').addEventListener('click', ()=>requestRecoveryCode(false));
    $('urbis-recovery-resend')?.addEventListener('click', ()=>requestRecoveryCode(true));
    $('urbis-recovery-verify').addEventListener('click', verifyRecoveryCode);
    bindPasswordVisibilityToggles();
  }

  function ensureFieldGuidance(){
    const defs = {
      'reg-name': { placeholder:'Ej: Valeria Sofía', label:'Nombres completos' },
      'reg-surname': { placeholder:'Ej: Mendoza Pérez', label:'Apellidos completos' },
      'reg-username': { placeholder:'Ej: valeria.sofia', label:'Nombre de usuario' },
      'reg-doc-type': { label:'Tipo de documento' },
      'reg-doc-num': { placeholder:'Ej: 123456789', label:'Número de documento' },
      'reg-birth-day': { label:'Día de nacimiento' },
      'reg-birth-month': { label:'Mes de nacimiento' },
      'reg-birth-year': { label:'Año de nacimiento' },
      'reg-phone': { placeholder:'Ej: 3001234567', label:'Celular' },
      'reg-country': { label:'País' },
      'reg-department': { label:'Departamento' },
      'reg-city': { label:'Ciudad o corregimiento' },
      'reg-comuna': { label:'Comuna' },
      'reg-gender': { label:'Género' },
      'reg-email': { placeholder:'Ej: correo@ejemplo.com', label:'Correo electrónico' },
      'reg-password': { placeholder:'Mínimo 8 caracteres', label:'Crear contraseña' },
      'reg-password-confirm': { placeholder:'Repite tu contraseña', label:'Confirmar contraseña' },
      'login-username': { placeholder:'Usuario o cédula', label:'Usuario o cédula' },
      'login-password': { placeholder:'Escribe tu contraseña', label:'Contraseña' },
      'reg-barrio': { label:'Barrio donde vives' }
    };
    Object.entries(defs).forEach(([id, meta]) => {
      const el = $(id);
      if(!el) return;
      if(meta.placeholder && !clean(el.getAttribute('placeholder'))) el.setAttribute('placeholder', meta.placeholder);
      if(!el.getAttribute('autocomplete')){
        const auto = {
          'reg-name':'given-name',
          'reg-surname':'family-name',
          'reg-phone':'tel-national',
          'reg-username':'username',
          'reg-email':'email',
          'login-username':'username',
          'reg-password':'new-password',
          'reg-password-confirm':'new-password',
          'login-password':'current-password',
          'reg-country':'country',
          'reg-department':'address-level1',
          'reg-city':'address-level2',
          'reg-comuna':'address-level3',
          'reg-barrio':'address-line1'
        }[id];
        if(auto) el.setAttribute('autocomplete', auto);
      }
      if(!el.id) return;
      const parentField = el.closest('.urbis-field');
      const existing = document.querySelector('.urbis-field-label[for="' + el.id + '"]');
      if(!existing && parentField){
        const label = document.createElement('label');
        label.className = 'urbis-field-label';
        label.setAttribute('for', el.id);
        label.textContent = meta.label || '';
        parentField.insertBefore(label, parentField.firstChild);
      }
    });
  }



  function togglePasswordVisibilityFromButton(btn, ev){
    const now = Date.now();
    if(ev && ev.type === 'click'){
      const lastTouch = Number(btn?.dataset?.urbisLastTouch || 0);
      if(lastTouch && now - lastTouch < 700){
        ev.preventDefault();
        ev.stopPropagation();
        if(typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        return;
      }
    }
    if(ev && ev.type && ev.type.indexOf('touch') === 0 && btn?.dataset){
      btn.dataset.urbisLastTouch = String(now);
    }
    if(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if(typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    }
    const inputId = btn?.getAttribute?.('data-urbis-password-toggle');
    const input = inputId ? $(inputId) : null;
    if(!input) return;
    const showing = input.type === 'text';
    try { input.type = showing ? 'password' : 'text'; } catch(e) { input.setAttribute('type', showing ? 'password' : 'text'); }
    btn.textContent = showing ? '👁️' : '🙈';
    btn.setAttribute('aria-pressed', showing ? 'false' : 'true');
    btn.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
    btn.classList.toggle('is-visible', !showing);
    try{ input.focus({ preventScroll:true }); }catch(e){ try{ input.focus(); }catch(_){} }
  }

  function bindPasswordVisibilityToggles(){
    document.querySelectorAll('[data-urbis-password-toggle]').forEach(btn => {
      btn.type = 'button';
      btn.removeAttribute('disabled');
      btn.style.pointerEvents = 'auto';
      if(btn.dataset.bound !== '1'){
        btn.dataset.bound = '1';
        btn.addEventListener('click', ev => togglePasswordVisibilityFromButton(btn, ev), true);
        btn.addEventListener('touchend', ev => togglePasswordVisibilityFromButton(btn, ev), true);
      }
    });
    if(document.body.dataset.urbisPasswordDelegated !== '1'){
      document.body.dataset.urbisPasswordDelegated = '1';
      document.addEventListener('click', function(ev){
        const btn = ev.target.closest?.('[data-urbis-password-toggle]');
        if(btn) togglePasswordVisibilityFromButton(btn, ev);
      }, true);
      document.addEventListener('touchend', function(ev){
        const btn = ev.target.closest?.('[data-urbis-password-toggle]');
        if(btn) togglePasswordVisibilityFromButton(btn, ev);
      }, true);
    }
  }

  function bindInputFocusRescue(){
    const ids = ['reg-name','reg-surname','reg-username','reg-doc-type','reg-doc-num','reg-birth-day','reg-birth-month','reg-birth-year','reg-phone','reg-country','reg-country-other','reg-department','reg-department-other','reg-city','reg-city-other','reg-comuna','reg-comuna-other','reg-barrio','reg-barrio-other','reg-gender','reg-email','reg-password','reg-password-confirm','login-username','login-password','normal-secret-pass','urbis-verification-code','urbis-recovery-identifier','urbis-recovery-code','urbis-recovery-new-password','urbis-recovery-new-password-confirm','mobile-login-username','mobile-login-password'];
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    ids.forEach(id => {
      const el = $(id);
      if(!el || el.dataset.urbisFocusBound === '1') return;
      el.dataset.urbisFocusBound = '1';
      el.removeAttribute('readonly');
      el.removeAttribute('disabled');

      // En iPhone/Safari NO forzamos focus ni scrollIntoView en touchstart.
      // Eso era lo que hacía que el formulario se sintiera trabado al intentar subir o bajar.
      if(isIOS){
        el.style.webkitUserSelect = 'text';
        el.style.touchAction = 'manipulation';
        el.addEventListener('focus', function(){
          // Pequeño ajuste solo si el teclado tapa el campo; no secuestra el scroll.
          setTimeout(() => {
            try{
              const rect = el.getBoundingClientRect();
              const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
              if(rect.bottom > vh - 90 || rect.top < 40){
                el.scrollIntoView({ block:'nearest', behavior:'auto' });
              }
            }catch(e){}
          }, 260);
        }, {passive:true});
        return;
      }

      const focusIt = () => {
        try { el.focus({ preventScroll:true }); } catch(e){ try { el.focus(); } catch(_){} }
      };
      ['click','mousedown'].forEach(evt => {
        el.addEventListener(evt, function(ev){
          ev.stopPropagation();
          focusIt();
        }, true);
      });
    });
  }

  function clearRecoveryCountdown(){
    if(recoveryResendTimer){
      clearInterval(recoveryResendTimer);
      recoveryResendTimer = null;
    }
    recoveryResendAvailableAt = 0;
  }

  function formatRecoveryTime(ms){
    const total = Math.max(0, Math.ceil(ms / 1000));
    const min = String(Math.floor(total / 60)).padStart(2, '0');
    const sec = String(total % 60).padStart(2, '0');
    return `${min}:${sec}`;
  }

  function updateRecoveryCountdownUI(){
    const resendBtn = $('urbis-recovery-resend');
    const timerText = $('urbis-recovery-timer');
    const resendBox = $('urbis-recovery-resend-box');
    if(!resendBtn || !timerText || !resendBox) return;
    if(!recoveryResendAvailableAt){
      resendBox.hidden = true;
      resendBtn.disabled = true;
      resendBtn.textContent = 'Reenviar código';
      timerText.textContent = '';
      return;
    }
    resendBox.hidden = false;
    const remaining = recoveryResendAvailableAt - Date.now();
    if(remaining > 0){
      resendBtn.disabled = true;
      resendBtn.textContent = 'Reenviar código';
      timerText.textContent = `Podrás reenviar el código en ${formatRecoveryTime(remaining)}`;
    } else {
      resendBtn.disabled = false;
      resendBtn.textContent = 'Reenviar código';
      timerText.textContent = 'Si no te llegó el código, puedes reenviarlo ahora.';
      if(recoveryResendTimer){
        clearInterval(recoveryResendTimer);
        recoveryResendTimer = null;
      }
    }
  }

  function startRecoveryCountdown(seconds = 60){
    clearRecoveryCountdown();
    recoveryResendAvailableAt = Date.now() + (seconds * 1000);
    updateRecoveryCountdownUI();
    recoveryResendTimer = setInterval(updateRecoveryCountdownUI, 500);
  }

  function openRecoveryModal(){
    ensureRecoveryModal();
    pendingRecovery = null;
    $('urbis-recovery-identifier').value = '';
    $('urbis-recovery-code').value = '';
    if($('urbis-recovery-new-password')) $('urbis-recovery-new-password').value = '';
    if($('urbis-recovery-new-password-confirm')) $('urbis-recovery-new-password-confirm').value = '';
    $('urbis-recovery-code').hidden = true;
    if($('urbis-recovery-pass-wrap')) $('urbis-recovery-pass-wrap').hidden = true;
    if($('urbis-recovery-pass-confirm-wrap')) $('urbis-recovery-pass-confirm-wrap').hidden = true;
    $('urbis-recovery-verify').hidden = true;
    $('urbis-recovery-send').hidden = false;
    if($('urbis-recovery-resend-box')) $('urbis-recovery-resend-box').hidden = true;
    clearRecoveryCountdown();
    updateRecoveryCountdownUI();
    $('urbis-recovery-text').textContent = 'Escribe tu usuario, correo, celular o cédula. Enviaremos un código al correo asociado.';
    $('urbis-recovery-modal').classList.add('show');
    setTimeout(()=>$('urbis-recovery-identifier')?.focus(), 150);
  }

  function stabilizeRegisterScrollForIOS(){
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if(!isIOS || document.body.dataset.urbisIosScrollFixed === '1') return;
    document.body.dataset.urbisIosScrollFixed = '1';

    const releaseScrollLocks = () => {
      if(!document.body.classList.contains('urbis-auth-registering')) return;
      const login = $('login-screen');
      document.documentElement.style.overflowY = 'auto';
      document.body.style.overflowY = 'auto';
      document.documentElement.style.height = 'auto';
      document.body.style.height = 'auto';
      if(login){
        login.style.position = 'relative';
        login.style.inset = 'auto';
        login.style.overflow = 'visible';
        login.style.overflowY = 'visible';
        login.style.webkitOverflowScrolling = 'touch';
        login.style.touchAction = 'pan-y';
        login.style.height = 'auto';
        login.style.maxHeight = 'none';
        login.style.minHeight = '100dvh';
      }
      ['normal-data-panel','normal-access-panel','urbis-register-fields'].forEach(id => {
        const el = $(id);
        if(el){
          el.style.overflow = 'visible';
          el.style.overflowY = 'visible';
          el.style.maxHeight = 'none';
          el.style.height = 'auto';
          el.style.touchAction = 'pan-y';
        }
      });
    };

    releaseScrollLocks();
    window.addEventListener('resize', releaseScrollLocks, {passive:true});
    window.visualViewport?.addEventListener('resize', releaseScrollLocks, {passive:true});
    window.visualViewport?.addEventListener('scroll', releaseScrollLocks, {passive:true});
  }

  function normalizeIdentifier(v){
    const raw = clean(v);
    if(raw.includes('@')) return normalizeEmail(raw);
    return raw;
  }

  async function requestRecoveryCode(isResend = false){
    const identifier = normalizeIdentifier($('urbis-recovery-identifier')?.value || '');
    if(!identifier) { toast('Escribe tu usuario, correo, celular o cédula.'); return; }
    if(!authReady()) { alert('Falta configurar el endpoint de Google Apps Script.'); return; }
    const btn = isResend ? $('urbis-recovery-resend') : $('urbis-recovery-send');
    try{
      if(btn){ btn.disabled = true; btn.textContent = isResend ? 'Reenviando...' : 'Enviando...'; }
      const out = await callAuthAPI({ action:'recover_request', identifier, identificador: identifier, indentificador: identifier });
      if(!out.ok) throw new Error(out.message || 'No se pudo enviar el código.');
      pendingRecovery = { identifier, email: out.email || '' };
      $('urbis-recovery-text').innerHTML = `Enviamos un código al correo asociado${out.masked_email ? ': <b>' + esc(out.masked_email) + '</b>' : ''}. Escribe el código y crea una nueva contraseña.`;
      $('urbis-recovery-code').hidden = false;
      if($('urbis-recovery-pass-wrap')) $('urbis-recovery-pass-wrap').hidden = false;
      if($('urbis-recovery-pass-confirm-wrap')) $('urbis-recovery-pass-confirm-wrap').hidden = false;
      $('urbis-recovery-verify').hidden = false;
      $('urbis-recovery-send').hidden = true;
      if($('urbis-recovery-resend-box')) $('urbis-recovery-resend-box').hidden = false;
      startRecoveryCountdown(60);
      toast(isResend ? 'Código reenviado.' : 'Código de recuperación enviado.');
      setTimeout(()=>$('urbis-recovery-code')?.focus(), 150);
    }catch(err){
      toast(err.message || 'No se pudo recuperar.');
      alert(err.message || 'No se pudo recuperar.');
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = isResend ? 'Reenviar código' : 'Enviar código'; }
      updateRecoveryCountdownUI();
    }
  }

  async function verifyRecoveryCode(){
    const code = clean($('urbis-recovery-code')?.value || '');
    const identifier = pendingRecovery?.identifier || normalizeIdentifier($('urbis-recovery-identifier')?.value || '');
    const newPassword = clean($('urbis-recovery-new-password')?.value || '');
    const newPasswordConfirm = clean($('urbis-recovery-new-password-confirm')?.value || '');
    if(!/^\d{6}$/.test(code)){ toast('Escribe el código de 6 dígitos.'); return; }
    if(!newPassword){ toast('Escribe una nueva contraseña para recuperar tu cuenta.'); return; }
    if(!passwordStrong(newPassword)){ toast('La nueva contraseña debe tener mínimo 8 caracteres.'); return; }
    if(!newPasswordConfirm){ toast('Confirma tu nueva contraseña.'); return; }
    if(newPassword !== newPasswordConfirm){ toast('Las contraseñas no coinciden.'); return; }
    const btn = $('urbis-recovery-verify');
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'Verificando...'; }
      const out = await callAuthAPI({ action:'recover_verify', identifier, identificador: identifier, indentificador: identifier, code, newPassword });
      if(!out.ok) throw new Error(out.message || 'Código inválido.');
      const user = out.user || {};
      saveSession(user);
      clearRecoveryCountdown();
      $('urbis-recovery-modal')?.classList.remove('show');
      startSession(user);
      toast('Acceso recuperado. Bienvenido de nuevo.');
    }catch(err){
      toast(err.message || 'No se pudo verificar.');
      alert(err.message || 'No se pudo verificar.');
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = 'Verificar y entrar'; }
    }
  }

  function isOtherLocationSelectedValue(v){
    const x = clean(v).toLowerCase();
    return x.startsWith('otro') || x.startsWith('otra') || x.includes('no aparece') || x.includes('mi barrio') || x.includes('mi ubicación') || x.includes('mi ubicacion');
  }

  function readLocationSelectOrOther(selectId, otherId){
    const selected = clean($(selectId)?.value || '');
    if(isOtherLocationSelectedValue(selected)) return clean($(otherId)?.value || '');
    return selected;
  }

  function collectCitizenForm(){
    const docType = $('reg-doc-type')?.value || 'CC';
    const cedulaRaw = clean($('reg-doc-num')?.value || '');
    const nombres = clean($('reg-name')?.value || '');
    const apellidos = clean($('reg-surname')?.value || '');
    const nombreCompleto = [nombres, apellidos].filter(Boolean).join(' ').trim();
    const birth = readBirthDate();
    const usuario = normalizeUsername($('reg-username')?.value || '');
    const password = clean($('reg-password')?.value || '');
    const passwordConfirm = clean($('reg-password-confirm')?.value || '');
    const selectedCountry = clean($('reg-country')?.value || 'Colombia');
    const otherCountry = clean($('reg-country-other')?.value || '');
    const finalCountry = selectedCountry === 'Otro país' ? otherCountry : selectedCountry;
    const isColombia = finalCountry === 'Colombia';
    const data = {
      nombres,
      apellidos,
      nombre_completo: nombreCompleto,
      usuario,
      password,
      passwordConfirm,
      correo: normalizeEmail($('reg-email')?.value || ''),
      telefono: selectedCountry === 'Otro país' ? clean($('reg-phone')?.value || '') : normalizeColombiaPhone($('reg-phone')?.value || ''),
      cedula: `${docType} ${cedulaRaw}`.trim(),
      cedula_numero: cedulaRaw,
      tipo_documento: docType,
      nacimiento_dia: birth.valid ? birth.dia : clean($('reg-birth-day')?.value || ''),
      nacimiento_mes: birth.valid ? birth.mes : clean($('reg-birth-month')?.value || ''),
      nacimiento_anio: birth.valid ? birth.anio : clean($('reg-birth-year')?.value || ''),
      fecha_nacimiento: birth.valid ? birth.fecha : '',
      edad: birth.valid ? birth.edad : '',
      es_mayor_edad: birth.valid ? (birth.esMayor ? 'si' : 'no') : '',
      pais: finalCountry,
      pais_opcion: selectedCountry,
      departamento: isColombia ? readLocationSelectOrOther('reg-department','reg-department-other') : '',
      ciudad: isColombia ? readLocationSelectOrOther('reg-city','reg-city-other') : '',
      ciudad_corregimiento: isColombia ? readLocationSelectOrOther('reg-city','reg-city-other') : '',
      comuna: isColombia ? readLocationSelectOrOther('reg-comuna','reg-comuna-other') : '',
      barrio: isColombia ? readLocationSelectOrOther('reg-barrio','reg-barrio-other') : '',
      genero: $('reg-gender')?.value || 'no_registrado',
      rol_solicitado: 'citizen',
      // Nivel de la cuenta. 'basico' entra con correo, usuario, nacimiento y
      // ciudad; 'verificado' es quien además entregó su identidad legal para
      // poder subir fotos y publicar en categorías sensibles.
      nivel_cuenta: 'basico',
      termsAccepted: !!$('urbis-terms-accepted')?.checked,
      mobilityAnalyticsAccepted: !!$('urbis-mobility-consent')?.checked,
      admin_email_reference: CONFIG().ADMIN_EMAIL || ''
    };
    return data;
  }

  // ── Registro NIVEL 1 (cuenta básica) ────────────────────────────────────
  // Lo mínimo para que la cuenta sea real y se pueda responder por ella:
  // correo verificable, un usuario, cuándo nació y dónde vive. Nada más.
  //
  // La identidad legal —nombres, cédula, celular— NO se pide aquí. Se pide en
  // la verificación, cuando el usuario va a subir una foto o a publicar algo
  // delicado. Ese es el momento en que la fricción se justifica: sin cuenta
  // verificada detrás, una foto anónima en un mapa público es una puerta
  // abierta a que alguien suba cualquier cosa en cualquier lugar.
  //
  // La ubicación se mantiene obligatoria pero solo hasta ciudad: comuna y
  // barrio quedan opcionales. Son dos desplegables en cascada que en un
  // teléfono se hacen eternos, y para saber de qué ciudad reporta alguien no
  // hacen falta.
  function validateCitizenForm(data){
    if(!/^[a-z0-9._-]{5,30}$/.test(data.usuario || '')) return 'Escribe un usuario válido de 5 a 30 caracteres. Usa letras, números, punto, guion o guion bajo.';
    if(!/^\S+@\S+\.\S+$/.test(data.correo)) return 'Escribe un correo válido.';
    if(!passwordStrong(data.password)) return 'La contraseña debe tener mínimo 8 caracteres.';
    if(data.password !== data.passwordConfirm) return 'Las contraseñas no coinciden.';
    const birth = readBirthDate();
    if(!birth.valid) return birth.message;
    if(!data.pais) return 'Selecciona Colombia o escribe tu país.';
    if(data.pais === 'Colombia'){
      if(!data.departamento) return 'Selecciona tu departamento.';
      if(!data.ciudad) return 'Selecciona tu ciudad o corregimiento.';
    }
    if(!data.termsAccepted) return 'Debes aceptar el tratamiento de datos personales y los términos para crear la cuenta.';
    // Si los campos de identidad se revelaron porque el servidor los pidió,
    // aquí sí se exigen. Sin esto el formulario los mandaría vacíos otra vez y
    // el usuario quedaría dando vueltas en el mismo rechazo.
    if(document.body.classList.contains('urbis-verificando')){
      const falta = validateVerificacionNivel2(data);
      if(falta) return falta;
    }
    return '';
  }

  // ── Verificación NIVEL 2 ────────────────────────────────────────────────
  // Se llama cuando el usuario intenta subir una foto o publicar en una
  // categoría sensible. Aquí sí se exige la identidad legal completa.
  function validateVerificacionNivel2(data){
    if(clean(data.nombres || '').length < 2) return 'Escribe tus nombres.';
    if(clean(data.apellidos || '').length < 2) return 'Escribe tus apellidos.';
    if(clean(data.cedula_numero || '').length < 5) return 'Escribe tu número de documento.';
    if(data.pais === 'Colombia'){
      if(phoneDigitsForValidation(data.telefono).length !== 12) return 'Escribe un celular colombiano válido con 10 dígitos. Se guardará como +57.';
      // Comuna y barrio también viven en el nivel 2. Son dos desplegables en
      // cascada —hay que elegir departamento, luego ciudad, luego comuna, luego
      // barrio— y en un teléfono eso es una eternidad para alguien que solo
      // quiere avisar de un hueco. Aquí sí se exigen porque es justo lo que
      // pide el servidor cuando rechaza un registro incompleto: revelar los
      // campos sin exigirlos dejaría al usuario reenviando vacío en bucle.
      if(!data.comuna) return 'Selecciona tu comuna.';
      if(!data.barrio) return 'Selecciona tu barrio.';
    }else if(onlyDigits(data.telefono || '').length < 7){
      return 'Escribe un número de celular válido.';
    }
    return '';
  }

  let usernameCheckTimer = null;
  let lastUsernameCheck = '';
  let usernameAvailable = null;
  let identityCheckTimer = null;
  let lastIdentityCheck = '';
  let identityAvailable = { cedula: null, phone: null };
  let registerSubmitBusy = false;

  function setUsernameStatus(message, state = ''){
    const status = $('reg-username-status');
    if(!status) return;
    status.textContent = message;
    status.classList.remove('is-ok', 'is-error', 'is-checking');
    if(state) status.classList.add(state);
  }

  async function checkUsernameAvailability(){
    const input = $('reg-username');
    if(!input) return;
    const usuario = normalizeUsername(input.value || '');
    if(input.value !== usuario) input.value = usuario;
    usernameAvailable = null;
    if(!usuario){
      setUsernameStatus('Usa mínimo 5 caracteres. Puedes usar letras, números, punto, guion o guion bajo.');
      return;
    }
    if(!/^[a-z0-9._-]{5,30}$/.test(usuario)){
      setUsernameStatus('El usuario debe tener mínimo 5 caracteres y máximo 30.', 'is-error');
      return;
    }
    if(!authReady()){
      setUsernameStatus('Se validará disponibilidad al crear la cuenta.', 'is-checking');
      return;
    }
    if(lastUsernameCheck === usuario && usernameAvailable === true){
      setUsernameStatus('Usuario disponible.', 'is-ok');
      return;
    }
    lastUsernameCheck = usuario;
    setUsernameStatus('Revisando disponibilidad...', 'is-checking');
    try{
      const out = await callAuthAPI({ action:'check_username', usuario });
      if(lastUsernameCheck !== usuario) return;
      usernameAvailable = !!out.available;
      if(out.ok && out.available) setUsernameStatus('Usuario disponible.', 'is-ok');
      else setUsernameStatus(out.message || 'Ese nombre de usuario ya existe. Elige otro.', 'is-error');
    }catch(e){
      if(lastUsernameCheck !== usuario) return;
      usernameAvailable = null;
      setUsernameStatus('Se validará disponibilidad al crear la cuenta.', 'is-checking');
    }
  }

  function bindUsernameAvailability(){
    const input = $('reg-username');
    if(!input || input.dataset.usernameAvailabilityBound === '1') return;
    input.dataset.usernameAvailabilityBound = '1';
    input.setAttribute('minlength', '5');
    input.setAttribute('maxlength', '30');
    input.addEventListener('input', () => {
      input.value = normalizeUsername(input.value || '');
      clearTimeout(usernameCheckTimer);
      usernameCheckTimer = setTimeout(checkUsernameAvailability, 420);
    });
    input.addEventListener('blur', checkUsernameAvailability);
  }

  let emailCheckTimer = null;
  let lastEmailCheck = '';
  let emailAvailable = null;

  function setEmailStatus(message, state = ''){
    const status = $('reg-email-status');
    if(!status) return;
    status.textContent = message;
    status.classList.remove('is-ok', 'is-error', 'is-checking');
    if(state) status.classList.add(state);
  }

  async function checkEmailAvailability(){
    const input = $('reg-email');
    if(!input) return { ok:true, available:null };
    const correo = normalizeEmail(input.value || '');
    if(input.value !== correo) input.value = correo;
    emailAvailable = null;
    if(!correo){
      setEmailStatus('El correo no puede estar registrado en otra cuenta.');
      return { ok:true, available:null };
    }
    if(!/^\S+@\S+\.\S+$/.test(correo)){
      setEmailStatus('Escribe un correo válido.', 'is-error');
      return { ok:false, available:false, message:'Escribe un correo válido.' };
    }
    if(!authReady()){
      setEmailStatus('Se validará el correo al crear la cuenta.', 'is-checking');
      return { ok:true, available:null };
    }
    if(lastEmailCheck === correo && emailAvailable === true){
      setEmailStatus('Correo disponible.', 'is-ok');
      return { ok:true, available:true };
    }
    lastEmailCheck = correo;
    setEmailStatus('Revisando correo...', 'is-checking');
    try{
      const out = await callAuthAPI({ action:'check_email', email: correo, correo });
      if(lastEmailCheck !== correo) return out;
      emailAvailable = out && out.available !== false;
      if(out && out.ok && out.available) setEmailStatus('Correo disponible.', 'is-ok');
      else setEmailStatus((out && out.message) || 'Este correo ya está registrado. Usa otro correo o inicia sesión.', 'is-error');
      return out;
    }catch(e){
      if(lastEmailCheck !== correo) return { ok:true, available:null };
      emailAvailable = null;
      setEmailStatus('Se validará el correo al crear la cuenta.', 'is-checking');
      return { ok:true, available:null };
    }
  }

  function bindEmailAvailability(){
    const input = $('reg-email');
    if(!input || input.dataset.emailAvailabilityBound === '1') return;
    input.dataset.emailAvailabilityBound = '1';
    input.addEventListener('input', () => {
      input.value = normalizeEmail(input.value || '');
      clearTimeout(emailCheckTimer);
      emailCheckTimer = setTimeout(checkEmailAvailability, 520);
    });
    input.addEventListener('change', checkEmailAvailability);
    input.addEventListener('blur', checkEmailAvailability);
  }

  function setIdentityStatus(kind, message, state = ''){
    const status = kind === 'phone' ? $('reg-phone-status') : $('reg-doc-status');
    if(!status) return;
    status.textContent = message;
    status.classList.remove('is-ok', 'is-error', 'is-checking');
    if(state) status.classList.add(state);
  }

  async function checkIdentityAvailability(){
    const docInput = $('reg-doc-num');
    const phoneInput = $('reg-phone');
    if(!docInput && !phoneInput) return { ok:true, cedulaAvailable:null, phoneAvailable:null };

    const selectedCountry = $('reg-country')?.value || 'Colombia';
    const pais = selectedCountry === 'Otro país' ? clean($('reg-country-other')?.value || '') : 'Colombia';
    const cedula_numero = clean(docInput?.value || '');
    const telefono = selectedCountry === 'Otro país' ? clean(phoneInput?.value || '') : normalizeColombiaPhone(phoneInput?.value || '');
    const signature = [pais, cedula_numero, telefono].join('|');

    identityAvailable = { cedula: null, phone: null };

    if(!cedula_numero || cedula_numero.length < 5){
      setIdentityStatus('cedula', 'La cédula no puede estar registrada en otra cuenta.');
    }
    if(!telefono){
      setIdentityStatus('phone', selectedCountry === 'Otro país' ? 'El celular no puede estar registrado en otra cuenta.' : 'Si seleccionas Colombia, se guardará automáticamente con el prefijo +57.');
    }
    if(!authReady() || (!cedula_numero && !telefono)){
      return { ok:true, cedulaAvailable:null, phoneAvailable:null };
    }
    if(lastIdentityCheck === signature && identityAvailable.cedula === true && identityAvailable.phone === true){
      return { ok:true, cedulaAvailable:true, phoneAvailable:true };
    }

    lastIdentityCheck = signature;
    if(cedula_numero.length >= 5) setIdentityStatus('cedula', 'Revisando cédula...', 'is-checking');
    if(telefono) setIdentityStatus('phone', 'Revisando celular...', 'is-checking');

    try{
      const out = await callAuthAPI({ action:'check_identity', cedula_numero, telefono, pais });
      if(lastIdentityCheck !== signature) return out;
      identityAvailable = { cedula: out.cedulaAvailable !== false, phone: out.phoneAvailable !== false };

      if(cedula_numero.length >= 5){
        if(out.cedulaAvailable === false) setIdentityStatus('cedula', out.cedulaMessage || 'Esta cédula ya está registrada.', 'is-error');
        else setIdentityStatus('cedula', 'Cédula disponible.', 'is-ok');
      }
      if(telefono){
        if(out.phoneAvailable === false) setIdentityStatus('phone', out.phoneMessage || 'Este celular ya está registrado.', 'is-error');
        else setIdentityStatus('phone', 'Celular disponible.', 'is-ok');
      }
      return out;
    }catch(e){
      if(cedula_numero.length >= 5) setIdentityStatus('cedula', 'Se validará la cédula al crear la cuenta.', 'is-checking');
      if(telefono) setIdentityStatus('phone', 'Se validará el celular al crear la cuenta.', 'is-checking');
      return { ok:true, cedulaAvailable:null, phoneAvailable:null };
    }
  }

  function bindIdentityAvailability(){
    const docInput = $('reg-doc-num');
    const phoneInput = $('reg-phone');
    const countrySelect = $('reg-country');
    const otherCountryInput = $('reg-country-other');
    [docInput, phoneInput, countrySelect, otherCountryInput].forEach(input => {
      if(!input || input.dataset.identityAvailabilityBound === '1') return;
      input.dataset.identityAvailabilityBound = '1';
      input.addEventListener('input', () => {
        clearTimeout(identityCheckTimer);
        identityCheckTimer = setTimeout(checkIdentityAvailability, 520);
      });
      input.addEventListener('change', () => {
        clearTimeout(identityCheckTimer);
        identityCheckTimer = setTimeout(checkIdentityAvailability, 250);
      });
      input.addEventListener('blur', checkIdentityAvailability);
    });
  }

  async function callAuthAPI(payload){
    const url = endpoint();
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch(e){ throw new Error('Respuesta no válida del Apps Script: ' + text.slice(0,160)); }
  }


  async function loginRegisteredUser(ev){
    ev?.preventDefault?.();
    const rawLogin = clean($('mobile-login-username')?.value || $('login-username')?.value || '');
    const identifier = rawLogin.includes('@') ? normalizeEmail(rawLogin) : rawLogin;
    const password = clean($('mobile-login-password')?.value || $('login-password')?.value || '');
    if(!identifier){ toast('Escribe tu usuario, correo, celular o cédula.'); alert('Escribe tu usuario, correo, celular o cédula.'); return; }
    if(!password){ toast('Escribe tu contraseña.'); alert('Escribe tu contraseña.'); return; }
    // Atajo: cuenta de administrador URBIS (no pasa por el Apps Script).
    if(typeof window.urbisEsCredsAdmin === 'function' && window.urbisEsCredsAdmin(rawLogin, password)){
      const adminUser = { usuario:'urbisdueno', nombre_completo:'Administrador URBIS', nombres:'Administrador', apellidos:'URBIS', correo:'admin@urbis.com', rol:'admin', rol_solicitado:'admin' };
      try{ saveSession(adminUser); }catch(e){}
      try{ if(typeof window.urbisActivarModoAdmin === 'function') window.urbisActivarModoAdmin(); }catch(e){}
      try{ startSession(adminUser); }catch(e){}
      toast('🛡️ Modo administrador URBIS activado.');
      return;
    }
    if(!authReady()){ alert('Falta configurar el endpoint de Google Apps Script.'); return; }
    const btn = $('mobile-urbis-login-btn') || $('urbis-login-btn');
    const payload = {
      action:'login',
      identifier,
      identificador: identifier,
      indentificador: identifier,
      password
    };
    if(identifier.includes('@')) payload.email = identifier;
    else {
      payload.usuario = normalizeUsername(identifier);
      payload.username = identifier;
      payload.usuario_raw = identifier;
    }
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'Ingresando...'; }
      const out = await callAuthAPI(payload);
      if(!out.ok) throw new Error(out.message || 'No se pudo iniciar sesión.');
      const u = out.user || {};
      // Si el backend no devolvió el usuario y la persona entró con su usuario
      // (no correo/cédula), usar ese identificador como su usuario para que el
      // perfil no quede genérico ni le pida "definir usuario" otra vez.
      const esCorreo = rawLogin.includes('@');
      const esCedula = /^(cc\s*)?\d{5,}$/i.test(rawLogin.replace(/\s/g,''));
      if(!u.usuario && rawLogin && !esCorreo && !esCedula){
        u.usuario = (typeof normalizeUsername === 'function') ? normalizeUsername(rawLogin) : rawLogin.trim().toLowerCase();
      }
      if(!u.nombre_completo && u.usuario) u.nombre_completo = u.usuario;
      // El rol de administrador ahora puede venir del BACKEND (cuenta de
      // sistema creada con docs/apps-script-cuentas-sistema.txt), no solo del
      // atajo con credenciales incrustadas en js/00-config.js — que son
      // públicas por estar en un archivo del navegador. Con esto una cuenta
      // como "urbisnoticia" entra por el login normal y queda como admin.
      const rolServidor = String(u.rol || u.rol_solicitado || '').toLowerCase();
      if(rolServidor === 'admin'){
        u.rol = 'admin';
        try{ if(typeof window.urbisActivarModoAdmin === 'function') window.urbisActivarModoAdmin(); }catch(e){}
      }
      saveSession(u);
      startSession(u);
      if(rolServidor === 'admin') toast('🛡️ Modo administrador URBIS activado.');
      try{ localStorage.removeItem('urbis_usuario_local'); }catch(e){}
      toast('Bienvenida/o de nuevo a URBIS.');
    }catch(err){
      toast(err.message || 'No se pudo iniciar sesión.');
      alert(err.message || 'No se pudo iniciar sesión.');
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = 'Ingresar'; }
    }
  }

  async function sendRegisterRequest(data, resend=false){
    const btn = $('normal-submit-btn');
    try{
      if(btn){ btn.disabled = true; btn.textContent = resend ? 'Reenviando código...' : 'Creando cuenta...'; }
      showRegisterLoading(
        resend ? 'Reenviando código' : 'Creando tu cuenta',
        resend ? 'Espera un momento mientras enviamos un nuevo código a tu correo. Revisa también Spam o Promociones.' : 'Espera un momento mientras validamos tus datos y enviamos el código a tu correo. Si no lo ves, revisa Spam o Promociones.'
      );
      const out = await callAuthAPI({ action:'register', data });
      if(!out.ok) throw new Error(out.message || 'No se pudo registrar.');
      pendingRegistration = data;
      savePendingRegistration(data);
      showRegisterLoading('Código enviado', 'Ahora abriremos la pantalla para confirmar tu correo. Si no llega, revisa Spam, Promociones o Correo no deseado.');
      await wait(650);
      hideRegisterLoading();
      openVerificationModal(data.correo);
      toast(resend ? 'Código reenviado.' : 'Cuenta pendiente. Revisa tu correo.');
    }catch(err){
      hideRegisterLoading();
      // El servidor puede ir por detrás del navegador. Mientras el Apps Script
      // no se actualice al registro por niveles, seguirá exigiendo identidad
      // legal que este formulario ya no pide — y el usuario vería un mensaje
      // imposible de resolver, porque el campo ni siquiera está en pantalla.
      // En vez de dejarlo atascado, se revelan esos campos y se le explica.
      // Así la app funciona con el servidor viejo Y con el nuevo, sin que
      // nadie tenga que coordinar el momento exacto del despliegue.
      if(servidorPideIdentidad(err && err.message)){
        mostrarCamposNivel2(err.message);
        return;
      }
      toast(err.message || 'Error registrando cuenta.');
      alert(err.message || 'Error registrando cuenta.');
    }finally{
      hideRegisterLoading();
      if(btn){ btn.disabled = false; btn.textContent = 'Crear cuenta'; }
    }
  }

  // ── Adaptación al servidor ──────────────────────────────────────────────
  // Se reconoce por el mensaje porque el Apps Script no devuelve un código de
  // error: es lo único con lo que se cuenta. La lista cubre exactamente los
  // campos que el registro por niveles dejó de pedir.
  function servidorPideIdentidad(mensaje){
    const m = String(mensaje || '').toLowerCase();
    if(!m) return false;
    return /nombres y apellidos|n[úu]mero de documento|c[ée]dula|celular|comuna|barrio|g[ée]nero/.test(m);
  }

  let nivel2Revelado = false;
  function mostrarCamposNivel2(mensaje){
    document.body.classList.add('urbis-verificando');
    document.querySelectorAll('.urbis-nivel2').forEach(function(el){
      el.classList.add('urbis-nivel2-visible');
    });
    // Comuna, barrio y género no llevan la marca de nivel 2 —son de nivel 1
    // pero opcionales—, así que se señalan aparte si el servidor los pide.
    const aviso = $('urbis-nivel2-aviso') || (function(){
      const d = document.createElement('div');
      d.id = 'urbis-nivel2-aviso';
      d.className = 'urbis-nivel2-aviso';
      const card = document.querySelector('.urbis-register-card');
      if(card) card.insertBefore(d, card.firstChild);
      return d;
    })();
    aviso.innerHTML = '<b>Faltan unos datos más</b><span>El servidor todavía pide ' +
      'la información completa. Complétala aquí abajo y crea tu cuenta; ' +
      'cuando el servidor se actualice ya no se pedirá.</span>' +
      '<em>' + esc(String(mensaje || '')) + '</em>';
    if(!nivel2Revelado){
      nivel2Revelado = true;
      const primero = document.querySelector('.urbis-nivel2 input, .urbis-nivel2 select');
      if(primero && primero.scrollIntoView) primero.scrollIntoView({ behavior:'smooth', block:'center' });
      try{ primero && primero.focus({ preventScroll:true }); }catch(e){}
    }
    toast('Completa los datos que faltan para crear la cuenta.');
  }
  // Se expone para poder comprobar la adaptación sin tener que montar un
  // servidor viejo de mentira.
  window.__urbisMostrarNivel2 = mostrarCamposNivel2;

  async function registerCitizen(ev){
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    if(registerSubmitBusy) return;
    registerSubmitBusy = true;
    const btn = $('normal-submit-btn');
    try{
      const data = collectCitizenForm();
      const error = validateCitizenForm(data);
      if(error){ toast(error); alert(error); return; }
      if(!authReady()){
        alert('Falta configurar el endpoint de Google Apps Script en js/00-config.js. Primero despliega el Apps Script y pega la URL en AUTH.APPS_SCRIPT_ENDPOINT.');
        return;
      }

      try{
        const check = await callAuthAPI({ action:'check_username', usuario:data.usuario });
        if(check && check.ok && check.available === false){
          const msg = check.message || 'Ese nombre de usuario ya existe. Elige otro.';
          setUsernameStatus(msg, 'is-error');
          toast(msg); alert(msg); return;
        }
      }catch(e){
        // El backend vuelve a validar el usuario durante el registro.
      }

      try{
        const emailCheck = await checkEmailAvailability();
        if(emailCheck && emailCheck.available === false){
          const msg = emailCheck.message || 'Este correo ya está registrado. Usa otro correo o inicia sesión.';
          setEmailStatus(msg, 'is-error');
          toast(msg); alert(msg); return;
        }
      }catch(e){
        // El backend vuelve a validar el correo durante el registro.
      }

      try{
        const identity = await checkIdentityAvailability();
        if(identity && identity.cedulaAvailable === false){
          const msg = identity.cedulaMessage || 'Esta cédula ya está registrada en otra cuenta.';
          setIdentityStatus('cedula', msg, 'is-error');
          toast(msg); alert(msg); return;
        }
        if(identity && identity.phoneAvailable === false){
          const msg = identity.phoneMessage || 'Este celular ya está registrado en otra cuenta.';
          setIdentityStatus('phone', msg, 'is-error');
          toast(msg); alert(msg); return;
        }
      }catch(e){
        // El backend vuelve a validar cédula y celular durante el registro.
      }

      pendingRegistration = data;
      await sendRegisterRequest(data, false);
    }finally{
      registerSubmitBusy = false;
      if(btn && !btn.disabled) btn.textContent = 'Crear cuenta';
    }
  }

  async function verifyCode(ev){
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    pendingRegistration = pendingRegistration || readPendingRegistration();
    const code = clean($('urbis-verification-code')?.value || '');
    const email = pendingRegistration?.correo || normalizeEmail($('reg-email')?.value || '');
    if(!/^\d{6}$/.test(code)){ toast('Escribe el código de 6 dígitos.'); return; }
    if(!email){ toast('No encontramos el correo pendiente. Vuelve a crear la cuenta.'); return; }
    const btn = $('urbis-verify-btn');
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'Verificando...'; }
      const out = await callAuthAPI({ action:'verify', email, code });
      if(!out.ok) throw new Error(out.message || 'Código inválido.');
      const user = out.user || pendingRegistration || {};
      saveSession(user);
      clearPendingRegistration();
      pendingRegistration = null;
      $('urbis-verification-modal')?.classList.remove('show');
      startSession(user);
      toast('Cuenta verificada. Bienvenido a URBIS.');
    }catch(err){
      toast(err.message || 'No se pudo verificar.');
      alert(err.message || 'No se pudo verificar.');
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = 'Verificar y entrar a URBIS'; }
    }
  }

  function saveSession(user){
    const now = new Date().toISOString();
    const session = {
      active:true,
      verified:true,
      persistent:true,
      rememberDevice:true,
      savedAt: now,
      lastSeenAt: now,
      user_id: user.user_id || user.id || '',
      friend_code: user.friend_code || user.codigo_urbis || '',
      usuario: user.usuario || pendingRegistration?.usuario || '',
      nombres: user.nombres || pendingRegistration?.nombres || '',
      apellidos: user.apellidos || pendingRegistration?.apellidos || '',
      nombre_completo: user.nombre_completo || user.name || pendingRegistration?.nombre_completo || [user.nombres || pendingRegistration?.nombres || '', user.apellidos || pendingRegistration?.apellidos || ''].filter(Boolean).join(' ').trim(),
      correo: user.correo || user.email || pendingRegistration?.correo || '',
      telefono: user.telefono || pendingRegistration?.telefono || '',
      cedula: user.cedula || pendingRegistration?.cedula || '',
      cedula_numero: user.cedula_numero || pendingRegistration?.cedula_numero || pendingRegistration?.cedula || '',
      pais: user.pais || pendingRegistration?.pais || '',
      departamento: user.departamento || pendingRegistration?.departamento || '',
      ciudad: user.ciudad || user.ciudad_corregimiento || pendingRegistration?.ciudad || pendingRegistration?.ciudad_corregimiento || '',
      ciudad_corregimiento: user.ciudad_corregimiento || user.ciudad || pendingRegistration?.ciudad_corregimiento || pendingRegistration?.ciudad || '',
      comuna: user.comuna || pendingRegistration?.comuna || '',
      barrio: user.barrio || pendingRegistration?.barrio || '',
      ubicacion_completa: user.ubicacion_completa || pendingRegistration?.ubicacion_completa || '',
      fecha_nacimiento: user.fecha_nacimiento || pendingRegistration?.fecha_nacimiento || '',
      nacimiento_dia: user.nacimiento_dia || pendingRegistration?.nacimiento_dia || '',
      nacimiento_mes: user.nacimiento_mes || pendingRegistration?.nacimiento_mes || '',
      nacimiento_anio: user.nacimiento_anio || pendingRegistration?.nacimiento_anio || '',
      edad: user.edad || pendingRegistration?.edad || '',
      es_mayor_edad: user.es_mayor_edad || pendingRegistration?.es_mayor_edad || '',
      genero: user.genero || pendingRegistration?.genero || 'no_registrado',
      rol: user.rol_solicitado || user.rol || pendingRegistration?.rol_solicitado || 'citizen',
      termsAccepted: true,
      mobilityAnalyticsAccepted: !!(user.mobilityAnalyticsAccepted ?? pendingRegistration?.mobilityAnalyticsAccepted)
    };
    localStorage.setItem(SESSION_KEY(), JSON.stringify(session));
    try { localStorage.setItem('urbis_last_active_session', JSON.stringify(session)); } catch(e) {}
  }

  function readSession(){
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY()) || 'null');
      if(s && s.active && s.verified){
        s.lastSeenAt = new Date().toISOString();
        try { localStorage.setItem(SESSION_KEY(), JSON.stringify(s)); } catch(e) {}
      }
      return s;
    } catch(e){ return null; }
  }

  function applyGlobalsFromSession(s){
    window.userNameGlobal = s.nombre_completo || 'Ciudadano URBIS';
    window.userCedulaGlobal = s.cedula || '';
    window.userEmailGlobal = s.correo || '';
    window.userUsernameGlobal = s.usuario || '';
    window.userBarrioGlobal = s.barrio || '';
    window.userPhoneGlobal = s.telefono || '';
    window.userGenderGlobal = s.genero || 'no_registrado';
    window.userBaseRoleGlobal = 'citizen';
    window.userRole = s.rol === 'admin' ? 'admin' : 'citizen';
    // js/41 es un IIFE aparte: estas asignaciones directas lanzan ReferenceError
    // (las variables viven en el scope compartido de js/02-19). El sync real lo
    // hace el hook urbisSyncSharedIdentity definido en js/02.
    try{
      userNameGlobal = window.userNameGlobal;
      userCedulaGlobal = window.userCedulaGlobal;
      userEmailGlobal = window.userEmailGlobal;
      userUsernameGlobal = window.userUsernameGlobal;
      userBarrioGlobal = window.userBarrioGlobal;
      userPhoneGlobal = window.userPhoneGlobal;
      userGenderGlobal = window.userGenderGlobal;
      userBaseRoleGlobal = window.userBaseRoleGlobal;
      userRole = window.userRole;
    }catch(e){}
    try{ if(typeof window.urbisSyncSharedIdentity === 'function') window.urbisSyncSharedIdentity(); }catch(e){}
  }


  function clearUrbisMobileLocks(){
    try{
      const classes = [
        'urbis-ios-picker-open',
        'urbis-auth-registering',
        'urbis-auth-login-view',
        'urbis-auth-panel-open',
        'u52-real-map',
        'u70-mobility-context',
        'u88-mobility-mode',
        'u103-map-picker-open',
        'u120-map-picker-open',
        'u83-destination-search-mode',
        'u83-transport-select-mode',
        'u83-ready-start-mode',
        'u84-selecting-destination',
        'u84-transport-choice',
        'u84-start-ready'
      ];
      document.body.classList.remove(...classes);
      document.documentElement.classList.remove('urbis-ios-picker-open');
      document.body.style.overflow = 'hidden';
      document.body.style.position = '';
      document.body.style.height = '';
      document.body.style.touchAction = 'pan-y';
      const login = $('login-screen');
      if(login){
        login.style.overflow = '';
        login.style.position = '';
        login.style.pointerEvents = 'none';
        login.style.touchAction = 'none';
      }
      const mobileApp = $('urbis-mobile-app');
      if(mobileApp){
        mobileApp.style.pointerEvents = 'auto';
        mobileApp.style.touchAction = 'pan-y';
        mobileApp.style.touchAction = 'pan-y';
        mobileApp.style.overflow = '';
      }
      document.querySelectorAll('.urbis-ios-location-picker.show').forEach(el => el.classList.remove('show'));
      document.querySelectorAll('#u103-map-picker, #u120-mobility-map-picker').forEach(el => {
        try { el.style.pointerEvents = 'none'; } catch(e){}
      });
    }catch(e){ console.warn('URBIS lock cleanup error', e); }
  }

  function forceMobileHome(){
    try{
      clearUrbisMobileLocks();
      const mobileApp = $('urbis-mobile-app');
      if(!mobileApp) return;
      mobileApp.style.display = 'block';
      mobileApp.style.visibility = 'visible';
      mobileApp.style.opacity = '1';
      mobileApp.style.pointerEvents = 'auto';
      document.body.dataset.role = 'citizen';
      document.body.dataset.urbisAuthenticated = '1';
      const legacyNav = $('urbis-mobile-bottom-nav');
      if(legacyNav) legacyNav.style.display = 'none';
      const showHome = () => {
        if(window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.show === 'function') {
          window.UrbisMobileAppV58.show('home');
          try{ window.UrbisMobileAppV58.ensureIOSAppInteraction && window.UrbisMobileAppV58.ensureIOSAppInteraction('home'); }catch(e){}
          return true;
        }
        return false;
      };
      if(!showHome()){
        setTimeout(showHome, 120);
        setTimeout(showHome, 360);
        setTimeout(showHome, 800);
      }
    }catch(e){}
  }

  function startSession(user){
    clearUrbisMobileLocks();
    document.body.classList.remove('urbis-auth-registering', 'urbis-auth-login-view', 'urbis-auth-panel-open');
    const session = readSession() || user || {};
    applyGlobalsFromSession(session);
    try{
      const login = $('login-screen');
      if(login){
        login.style.display = 'none';
        login.style.visibility = 'hidden';
        login.style.pointerEvents = 'none';
        login.style.touchAction = 'none';
      }
      const mobileApp = $('urbis-mobile-app');
      if(mobileApp){
        mobileApp.style.display = 'block';
        mobileApp.style.visibility = 'visible';
        mobileApp.style.opacity = '1';
        mobileApp.style.pointerEvents = 'auto';
        mobileApp.style.touchAction = 'pan-y';
      }
    }catch(e){}
    document.body.dataset.urbisAuthenticated = '1';
    if(typeof window.iniciarPlataforma === 'function') window.iniciarPlataforma();
    else if(typeof iniciarPlataforma === 'function') iniciarPlataforma();
    forceMobileHome();
    // Auto-ubicación al entrar (login manual O sesión restaurada): pedido
    // explícito — que la app centre el mapa en la ubicación real del
    // usuario sin que tenga que tocar el botón de GPS. Delay para dar
    // tiempo a que el mapa Leaflet (js/03) ya esté inicializado.
    try{
      setTimeout(()=>{
        if(window.UrbisMobileAppV58 && typeof window.UrbisMobileAppV58.ensureMobileGps === 'function'){
          window.UrbisMobileAppV58.ensureMobileGps(true);
        }
      }, 700);
    }catch(e){}
  }

  function autoRestore(){
    // URBIS V139: si este dispositivo ya tiene una sesión verificada, entra directo.
    const s = readSession();
    if(s && s.active && s.verified){
      try{
        const user = $('login-username');
        if(user && s.usuario) user.value = s.usuario;
        const mobileUser = $('mobile-login-username');
        if(mobileUser && s.usuario) mobileUser.value = s.usuario;
      }catch(e){}
      setTimeout(() => {
        try{
          startSession(s);
          toast('Sesión iniciada en este dispositivo.');
        }catch(err){
          console.warn('No se pudo restaurar sesión URBIS', err);
        }
      }, 120);
    }
  }

  function addLogoutButton(){
    if($('urbis-logout-session-btn')) return;
    const profilePanel = $('profile-basic-data')?.parentElement || $('profile-access-title')?.parentElement;
    if(!profilePanel) return;
    const btn = document.createElement('button');
    btn.id = 'urbis-logout-session-btn';
    btn.className = 'btn-edit urbis-logout-btn';
    btn.type = 'button';
    btn.textContent = 'Cerrar sesión en este dispositivo';
    btn.addEventListener('click', ()=>{
      if(confirm('¿Cerrar sesión de URBIS en este dispositivo?')){
        localStorage.removeItem(SESSION_KEY());
        location.reload();
      }
    });
    profilePanel.appendChild(btn);
  }


  function showCitizenRegistrationForm(mode = 'login'){
    try{
      document.body.classList.add('urbis-auth-registering');
      const login = $('login-screen');
      if(login){
        login.style.display = 'block';
        login.style.opacity = '1';
        login.style.visibility = 'visible';
        login.style.pointerEvents = 'auto';
        login.style.touchAction = 'auto';
      }
      const mobileApp = $('urbis-mobile-app');
      if(mobileApp){
        mobileApp.style.display = 'none';
        mobileApp.style.visibility = 'hidden';
        mobileApp.style.pointerEvents = 'none';
      }
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      const normal = $('normal-access-panel');
      const admin = $('admin-access-panel');
      if(normal) normal.style.display = 'block';
      if(admin) admin.style.display = 'none';
      const dataPanel = $('normal-data-panel');
      if(dataPanel) dataPanel.style.display = 'block';
      const desiredMode = mode === 'register' ? 'register' : 'login';
      bindAuthModeControls();
      ensureFieldGuidance();
      bindInputFocusRescue();
      bindUsernameAvailability();
      bindEmailAvailability();
      bindIdentityAvailability();
      setupLocationSelectors(true);
      bindIOSLocationPicker();
      if(typeof window.mostrarAccesoNormal === 'function') window.mostrarAccesoNormal();
      setAuthMode(desiredMode, { openPanel:true });
      populateBirthDateSelectors();
      bindPasswordVisibilityToggles();
      document.body.classList.remove('u52-real-map');
      setTimeout(() => (desiredMode === 'register' ? $('reg-name') : $('login-username'))?.focus(), 140);
      toast(desiredMode === 'register' ? 'Crea tu cuenta ciudadana para entrar a URBIS.' : 'Inicia sesión para entrar a URBIS.');
    }catch(e){}
  }

  function hasVerifiedSession(){
    const s = readSession();
    return !!(s && s.active && s.verified);
  }

  function bindCitizenLoginGuard(){
    if(document.body.dataset.urbisCitizenGuard === '1') return;
    document.body.dataset.urbisCitizenGuard = '1';
    document.addEventListener('click', function(ev){
      const citizenMobile = ev.target.closest('[data-u52-login="citizen"]');
      const directTest = ev.target.closest('.direct-test-btn');
      if(!citizenMobile && !directTest) return;
      if(hasVerifiedSession()) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      showCitizenRegistrationForm();
    }, true);
  }

  function patchOldFunctions(){
    // Bloquea el ingreso ciudadano sin validar cuando se usa el botón normal.
    window.continuarPerfilNormal = registerCitizen;
    try { continuarPerfilNormal = registerCitizen; } catch(e) {}
    window.entrarDirectoPruebas = function(){
      showCitizenRegistrationForm();
    };
    try { entrarDirectoPruebas = window.entrarDirectoPruebas; } catch(e) {}
  }

  function init(){
    ensureTermsBox();
    stabilizeRegisterScrollForIOS();
    ensureVerificationModal();
    ensureRecoveryModal();
    bindAuthModeControls();
    setAuthMode('login', { openPanel:false });
    ensureFieldGuidance();
    populateBirthDateSelectors();
    setupLocationSelectors();
    bindIOSLocationPicker();
    bindInputFocusRescue();
    bindPasswordVisibilityToggles();
    bindUsernameAvailability();
    bindEmailAvailability();
    bindIdentityAvailability();
    bindRegisterSubmitFallback();
    patchOldFunctions();
    bindCitizenLoginGuard();
    addLogoutButton();
    autoRestore();
  }

  window.URBIS_AUTH = {
    registerCitizen,
    verifyCode,
    loginRegisteredUser,
    syncLocationSelectors: setupLocationSelectors,
    updateBirthStatus,
    populateBirthDateSelectors,
    readSession,
    hasVerifiedSession,
    openRecoveryModal,
    requestRecoveryCode,
    verifyRecoveryCode,
    showCitizenRegistrationForm,
    socialAPI: callAuthAPI,
    logout(){ localStorage.removeItem(SESSION_KEY()); location.reload(); }
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
