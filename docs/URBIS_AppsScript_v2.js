/**
 * ⛔ OBSOLETO — NO USAR EN GOOGLE APPS SCRIPT ⛔
 * ============================================================================
 * Este v2 usa nombres de acción (registerUser, loginUser, verifyEmailCode...)
 * y lee los campos en la raíz del body. EL CLIENTE (js/41) NO habla así:
 * envía action:'register' con los datos en { data:{...} }, action:'verify',
 * 'login', 'check_username', 'check_email', 'check_identity', 'recover_*',
 * 'social_*'. Desplegar este v2 ROMPE el registro de usuarios nuevos.
 *
 * ✅ USAR SIEMPRE: docs/apps-script-urbis-auth.gs (el original).
 *    Ese coincide con el cliente y escribe por NOMBRE de columna, así que la
 *    reorganización del Excel no lo afecta.
 *
 * Se conserva solo como referencia histórica.
 * ============================================================================
 *
 * URBIS · Google Apps Script Backend v2
 * Hoja de cálculo: PROYECTO URBIS.xlsx (Google Sheets)
 *
 * Acciones que maneja doPost:
 *   registerUser, verifyEmailCode, loginUser,
 *   recoverAccount, verifyRecoveryCode, resetPassword,
 *   updateProfile, updateBirthdate,
 *   sendFriendRequest, respondFriendRequest, getFriends,
 *   sendNotification, getNotifications, markNotificationRead
 *
 * Estructura de hojas (limpia v2):
 *   usuarios_registro  — fila 1 = encabezados, fila 2+ = datos
 *   verificacion_email — fila 1 = encabezados
 *   registro_logs      — fila 1 = encabezados
 *   notificaciones_urbis — fila 1 = encabezados
 *   amigos_urbis       — fila 1 = encabezados
 */

// ─── Nombres de hojas ────────────────────────────────────────────────────────
const SH = {
  USUARIOS:      'usuarios_registro',
  VERIFICACION:  'verificacion_email',
  LOGS:          'registro_logs',
  NOTIF:         'notificaciones_urbis',
  AMIGOS:        'amigos_urbis',
};

// ─── Columnas de usuarios_registro (índice base 1) ──────────────────────────
const UC = {
  registro_id:          1,
  user_id:              2,
  nombre_completo:      3,
  nombres:              4,
  apellidos:            5,
  usuario:              6,
  correo:               7,
  correo_normalizado:   8,
  telefono:             9,
  telefono_e164:        10,
  telefono_normalizado: 11,
  cedula:               12,
  tipo_documento:       13,
  cedula_numero:        14,
  cedula_normalizada:   15,
  barrio:               16,
  comuna:               17,
  ciudad:               18,
  ciudad_corregimiento: 19,
  departamento:         20,
  pais:                 21,
  otro_pais:            22,
  ubicacion_completa:   23,
  ubicacion_validada:   24,
  genero:               25,
  genero_normalizado:   26,
  rol_solicitado:       27,
  estado_cuenta:        28,
  email_verificado:     29,
  telefono_verificado:  30,
  password_hash:        31,
  password_salt:        32,
  codigo_verificacion:  33,
  codigo_expira_en:     34,
  fecha_registro:       35,
  fecha_verificacion:   36,
  ultimo_login:         37,
  acepta_terminos:      38,
  acepta_movilidad_anonima: 39,
  origen_registro:      40,
  canal_recuperacion_preferido: 41,
  recovery_codigo:      42,
  recovery_expira_en:   43,
  recovery_intentos:    44,
  recovery_estado:      45,
  recovery_ultimo_envio:46,
  requiere_reverificacion: 47,
  observaciones_admin:  48,
  friend_code:          49,
  lat:                  50,
  lng:                  51,
  foto_perfil:          52,
  fecha_nacimiento:     53,
  nacimiento_dia:       54,
  nacimiento_mes:       55,
  nacimiento_anio:      56,
  edad:                 57,
  es_mayor_edad:        58,
  fecha_nacimiento_pendiente: 59,
  fecha_actualizacion:  60,
};

// ─── Columnas verificacion_email ─────────────────────────────────────────────
const VC = {
  verification_id:  1,
  user_id:          2,
  correo:           3,
  tipo_codigo:      4,   // registro | recuperacion
  codigo:           5,
  expira_en:        6,
  estado:           7,   // pendiente | verificado | expirado
  intentos:         8,
  fecha_creacion:   9,
  fecha_verificacion: 10,
  canal:            11,
  resultado_envio:  12,
};

// ─── Columnas registro_logs ───────────────────────────────────────────────────
const LC = {
  log_id:     1,
  fecha:      2,
  accion:     3,
  correo:     4,
  cedula:     5,
  usuario:    6,
  resultado:  7,
  motivo:     8,
  origen:     9,
  ip:         10,
  detalle:    11,
};

// ─── Columnas notificaciones_urbis ───────────────────────────────────────────
const NC = {
  notification_id: 1,
  user_id:         2,
  tipo:            3,
  titulo:          4,
  mensaje:         5,
  estado:          6,   // no_leido | leido
  fecha_creacion:  7,
  fecha_lectura:   8,
  accion:          9,
  related_id:      10,
  actor_user_id:   11,
  actor_usuario:   12,
  metadata:        13,
};

// ─── Columnas amigos_urbis ───────────────────────────────────────────────────
const AC = {
  friend_id:            1,
  requester_user_id:    2,
  requester_usuario:    3,
  requester_friend_code:4,
  target_user_id:       5,
  target_usuario:       6,
  target_friend_code:   7,
  estado:               8,   // pendiente | aceptado | rechazado | bloqueado
  fecha_solicitud:      9,
  fecha_respuesta:      10,
  origen:               11,
  nota:                 12,
};

// ─── Utilidades generales ─────────────────────────────────────────────────────
function ok(data)  { return ContentService.createTextOutput(JSON.stringify({ ok: true,  ...data })).setMimeType(ContentService.MimeType.JSON); }
function err(msg)  { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg })).setMimeType(ContentService.MimeType.JSON); }

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
}

function friendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function hashSimple(str) {
  // SHA-256 via Utilities — no contraseñas en texto plano
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function normalizeEmail(e)  { return String(e || '').toLowerCase().trim(); }
function normalizeCedula(c) { return String(c || '').replace(/\D/g, ''); }
function normalizePhone(p)  {
  let n = String(p || '').replace(/\D/g, '');
  if (n.startsWith('57') && n.length === 12) return '+' + n;
  if (n.length === 10) return '+57' + n;
  return n;
}

function calcEdad(fechaNac) {
  if (!fechaNac) return { edad: '', esMayor: '' };
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return { edad, esMayor: edad >= 18 ? 'SI' : 'NO' };
}

/** Lee todas las filas de una hoja como array de objetos */
function sheetToObjects(sh, colMap) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1).map(row => {
    const obj = {};
    Object.entries(colMap).forEach(([key, idx]) => { obj[key] = row[idx - 1]; });
    return obj;
  });
}

/** Busca la primera fila donde columna === valor. Devuelve índice 1-based o -1 */
function findRow(sh, colIdx, value) {
  const vals = sh.getRange(2, colIdx, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(value).trim()) return i + 2;
  }
  return -1;
}

function appendRow(sh, colMap, data, totalCols) {
  const row = new Array(totalCols).fill('');
  Object.entries(data).forEach(([key, val]) => {
    if (colMap[key]) row[colMap[key] - 1] = val ?? '';
  });
  sh.appendRow(row);
}

function updateRow(sh, rowNum, colMap, data) {
  Object.entries(data).forEach(([key, val]) => {
    if (colMap[key] && val !== undefined) sh.getRange(rowNum, colMap[key]).setValue(val);
  });
}

function log(accion, correo, cedula, usuario, resultado, motivo, origen, detalle) {
  const sh = getSheet(SH.LOGS);
  appendRow(sh, LC, {
    log_id:    uid('log'),
    fecha:     new Date().toISOString(),
    accion, correo, cedula, usuario, resultado, motivo, origen,
    detalle:   JSON.stringify(detalle || {}),
  }, Object.keys(LC).length);
}

// ─── Envío de correo ──────────────────────────────────────────────────────────
function enviarCodigo(correo, codigo, tipo) {
  const asunto = tipo === 'recuperacion'
    ? '🔑 Recupera tu cuenta URBIS — código ' + codigo
    : '✅ Verifica tu cuenta URBIS — código ' + codigo;
  const cuerpo = tipo === 'recuperacion'
    ? `Tu código de recuperación URBIS es: ${codigo}\n\nVigente por 15 minutos.\n\nSi no solicitaste esto, ignora este mensaje.`
    : `¡Bienvenido/a a URBIS! Tu código de verificación es: ${codigo}\n\nVigente por 15 minutos.`;
  try {
    MailApp.sendEmail({ to: correo, subject: asunto, body: cuerpo });
    return true;
  } catch (e) {
    console.error('Error enviando correo:', e.message);
    return false;
  }
}

// ─── doGet (health check) ────────────────────────────────────────────────────
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'URBIS Apps Script v2', ts: new Date().toISOString() })).setMimeType(ContentService.MimeType.JSON);
}

// ─── doPost (punto de entrada principal) ────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const accion = body.accion || body.action || '';
    switch (accion) {
      case 'registerUser':         return registerUser(body);
      case 'verifyEmailCode':      return verifyEmailCode(body);
      case 'loginUser':            return loginUser(body);
      case 'recoverAccount':       return recoverAccount(body);
      case 'verifyRecoveryCode':   return verifyRecoveryCode(body);
      case 'resetPassword':        return resetPassword(body);
      case 'updateProfile':        return updateProfile(body);
      case 'updateBirthdate':      return updateBirthdate(body);
      case 'sendFriendRequest':    return sendFriendRequest(body);
      case 'respondFriendRequest': return respondFriendRequest(body);
      case 'getFriends':           return getFriends(body);
      case 'sendNotification':     return sendNotification(body);
      case 'getNotifications':     return getNotifications(body);
      case 'markNotificationRead': return markNotificationRead(body);
      default:                     return err('Acción desconocida: ' + accion);
    }
  } catch (ex) {
    console.error('doPost error:', ex.message, ex.stack);
    return err('Error interno: ' + ex.message);
  }
}

// ─── registerUser ─────────────────────────────────────────────────────────────
function registerUser(body) {
  const correo   = normalizeEmail(body.correo);
  const cedula   = normalizeCedula(body.cedula);
  const usuario  = String(body.usuario || '').trim();
  const nombres  = String(body.nombres || '').trim();
  const apellidos = String(body.apellidos || '').trim();
  const telefono = String(body.telefono || '').trim();
  const pais     = body.pais || 'Colombia';
  const genero   = body.genero || 'prefiero_no_decir';

  if (!correo)  return err('Correo requerido');
  if (!usuario) return err('Usuario requerido');

  const sh = getSheet(SH.USUARIOS);
  // Verificar duplicados
  if (findRow(sh, UC.correo_normalizado, correo) > 0) {
    log('register', correo, cedula, usuario, 'duplicate', 'correo ya registrado', 'app', {});
    return err('El correo ya está registrado');
  }
  if (usuario && findRow(sh, UC.usuario, usuario) > 0) {
    return err('El nombre de usuario ya está en uso');
  }
  if (cedula && findRow(sh, UC.cedula_normalizada, cedula) > 0) {
    log('register', correo, cedula, usuario, 'duplicate', 'cedula ya registrada', 'app', {});
    return err('La cédula ya está registrada');
  }

  const user_id    = uid('usr');
  const registro_id = uid('reg');
  const fCode      = friendCode();
  const codigo     = String(Math.floor(100000 + Math.random() * 900000));
  const expira     = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const ahora      = new Date().toISOString();

  const pwHash = body.password ? hashSimple(body.password + usuario) : '';
  const pwSalt = body.password ? hashSimple(usuario + ahora).slice(0, 16) : '';

  appendRow(sh, UC, {
    registro_id, user_id,
    nombre_completo: (nombres + ' ' + apellidos).trim() || usuario,
    nombres, apellidos, usuario,
    correo, correo_normalizado: correo,
    telefono, telefono_e164: normalizePhone(telefono), telefono_normalizado: normalizePhone(telefono),
    cedula, cedula_numero: cedula, cedula_normalizada: cedula,
    tipo_documento: body.tipo_documento || 'CC',
    pais, otro_pais: pais !== 'Colombia' ? pais : '',
    departamento: body.departamento || '',
    ciudad: body.ciudad || 'Cúcuta',
    ciudad_corregimiento: body.ciudad_corregimiento || body.ciudad || 'Cúcuta',
    comuna: body.comuna || '',
    barrio: body.barrio || '',
    ubicacion_completa: [pais, body.departamento, body.ciudad, body.comune, body.barrio].filter(Boolean).join(' | '),
    ubicacion_validada: 'SI',
    genero, genero_normalizado: genero,
    rol_solicitado: 'ciudadano',
    estado_cuenta: 'pendiente',
    email_verificado: 'NO',
    telefono_verificado: 'NO',
    password_hash: pwHash,
    password_salt: pwSalt,
    codigo_verificacion: codigo,
    codigo_expira_en: expira,
    fecha_registro: ahora,
    acepta_terminos: body.acepta_terminos ? 'SI' : 'NO',
    acepta_movilidad_anonima: body.acepta_movilidad ? 'SI' : 'NO',
    origen_registro: body.origen || 'app_movil',
    canal_recuperacion_preferido: 'email',
    friend_code: fCode,
    fecha_nacimiento_pendiente: 'SI',
    fecha_actualizacion: ahora,
  }, Object.keys(UC).length);

  // Registro en verificacion_email
  const vsh = getSheet(SH.VERIFICACION);
  appendRow(vsh, VC, {
    verification_id: uid('ver'),
    user_id, correo,
    tipo_codigo: 'registro',
    codigo, expira_en: expira,
    estado: 'pendiente',
    intentos: 0,
    fecha_creacion: ahora,
    canal: 'email',
    resultado_envio: 'pendiente',
  }, Object.keys(VC).length);

  const enviado = enviarCodigo(correo, codigo, 'registro');

  // Actualizar resultado_envio
  const vRow = findRow(vsh, VC.verification_id, uid('ver')); // búsqueda por correo+estado
  // (se loguea el envío)
  log('register', correo, cedula, usuario, enviado ? 'pending' : 'error_email', 'codigo enviado', 'app', { user_id });

  return ok({ user_id, message: enviado ? 'Código enviado al correo' : 'Registro creado, error enviando correo', emailSent: enviado });
}

// ─── verifyEmailCode ──────────────────────────────────────────────────────────
function verifyEmailCode(body) {
  const correo = normalizeEmail(body.correo);
  const codigo = String(body.codigo || '').trim();
  if (!correo || !codigo) return err('Correo y código requeridos');

  const sh  = getSheet(SH.USUARIOS);
  const vsh = getSheet(SH.VERIFICACION);
  const rowU = findRow(sh, UC.correo_normalizado, correo);
  if (rowU < 0) return err('Correo no encontrado');

  const storedCodigo = String(sh.getRange(rowU, UC.codigo_verificacion).getValue()).trim();
  const expiresAt    = sh.getRange(rowU, UC.codigo_expira_en).getValue();
  const ahora        = new Date();

  if (storedCodigo !== codigo) {
    log('verify', correo, '', '', 'fail', 'codigo incorrecto', 'app', {});
    return err('Código incorrecto');
  }
  if (expiresAt && new Date(expiresAt) < ahora) {
    log('verify', correo, '', '', 'fail', 'codigo expirado', 'app', {});
    return err('El código ha expirado. Solicita uno nuevo.');
  }

  const user_id = sh.getRange(rowU, UC.user_id).getValue();
  const usuario = sh.getRange(rowU, UC.usuario).getValue();
  const ahora_iso = ahora.toISOString();

  updateRow(sh, rowU, UC, {
    estado_cuenta:    'activo',
    email_verificado: 'SI',
    fecha_verificacion: ahora_iso,
    codigo_verificacion: '',
    codigo_expira_en:    '',
  });

  // Actualizar verificacion_email
  const vRow = findRow(vsh, VC.user_id, user_id);
  if (vRow > 0) {
    updateRow(vsh, vRow, VC, { estado: 'verificado', fecha_verificacion: ahora_iso });
  }

  log('verify', correo, '', usuario, 'success', 'cuenta activada', 'app', { user_id });

  return ok({ user_id, usuario, message: 'Cuenta verificada exitosamente' });
}

// ─── loginUser ────────────────────────────────────────────────────────────────
function loginUser(body) {
  const identificador = normalizeEmail(body.identificador || body.correo || '');
  const password      = body.password || '';
  if (!identificador) return err('Identificador requerido');

  const sh   = getSheet(SH.USUARIOS);
  let rowU   = findRow(sh, UC.correo_normalizado, identificador);
  if (rowU < 0) rowU = findRow(sh, UC.usuario, identificador);
  if (rowU < 0) {
    log('login', identificador, '', '', 'fail', 'usuario no encontrado', 'app', {});
    return err('Usuario o contraseña incorrectos');
  }

  const estado   = String(sh.getRange(rowU, UC.estado_cuenta).getValue()).trim();
  const usuario  = String(sh.getRange(rowU, UC.usuario).getValue()).trim();
  const user_id  = String(sh.getRange(rowU, UC.user_id).getValue()).trim();

  if (estado === 'pendiente') return err('Cuenta pendiente de verificación. Revisa tu correo.');
  if (estado === 'bloqueado') return err('Cuenta bloqueada. Contacta a soporte.');

  // Verificar contraseña si se proveyó
  if (password) {
    const storedHash = String(sh.getRange(rowU, UC.password_hash).getValue()).trim();
    const inputHash  = hashSimple(password + usuario);
    if (storedHash && storedHash !== inputHash) {
      log('login', identificador, '', usuario, 'fail', 'password incorrecto', 'app', {});
      return err('Usuario o contraseña incorrectos');
    }
  }

  const ahora = new Date().toISOString();
  updateRow(sh, rowU, UC, { ultimo_login: ahora });
  log('login', identificador, '', usuario, 'success', 'sesion iniciada', 'app', { user_id });

  // Leer perfil completo
  const perfilCols = [
    'user_id','nombre_completo','nombres','apellidos','usuario','correo',
    'barrio','comuna','ciudad','departamento','pais','genero','genero_normalizado',
    'rol_solicitado','estado_cuenta','email_verificado','friend_code',
    'foto_perfil','lat','lng','fecha_registro','acepta_movilidad_anonima',
    'fecha_nacimiento','edad','es_mayor_edad',
  ];
  const perfil = {};
  perfilCols.forEach(k => { if (UC[k]) perfil[k] = sh.getRange(rowU, UC[k]).getValue(); });

  return ok({ ...perfil, message: 'Sesión iniciada' });
}

// ─── recoverAccount ───────────────────────────────────────────────────────────
function recoverAccount(body) {
  const correo = normalizeEmail(body.correo || '');
  if (!correo) return err('Correo requerido');

  const sh   = getSheet(SH.USUARIOS);
  const rowU = findRow(sh, UC.correo_normalizado, correo);
  if (rowU < 0) {
    log('recover_request', correo, '', '', 'not_found', 'correo no encontrado', 'app', {});
    // Responder ok para no revelar existencia del correo
    return ok({ message: 'Si el correo existe, recibirás un código.' });
  }

  const codigo  = String(Math.floor(100000 + Math.random() * 900000));
  const expira  = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const usuario = String(sh.getRange(rowU, UC.usuario).getValue());
  const user_id = String(sh.getRange(rowU, UC.user_id).getValue());

  updateRow(sh, rowU, UC, {
    recovery_codigo:      codigo,
    recovery_expira_en:   expira,
    recovery_intentos:    0,
    recovery_estado:      'pendiente',
    recovery_ultimo_envio: new Date().toISOString(),
  });

  const vsh = getSheet(SH.VERIFICACION);
  appendRow(vsh, VC, {
    verification_id: uid('ver'),
    user_id, correo,
    tipo_codigo:   'recuperacion',
    codigo, expira_en: expira,
    estado: 'pendiente',
    intentos: 0,
    fecha_creacion: new Date().toISOString(),
    canal: 'email',
  }, Object.keys(VC).length);

  const enviado = enviarCodigo(correo, codigo, 'recuperacion');
  log('recover_request', correo, '', usuario, enviado ? 'pending' : 'error_email', 'codigo enviado', 'app', { user_id });

  return ok({ message: 'Si el correo existe, recibirás un código.', emailSent: enviado });
}

// ─── verifyRecoveryCode ───────────────────────────────────────────────────────
function verifyRecoveryCode(body) {
  const correo = normalizeEmail(body.correo || '');
  const codigo = String(body.codigo || '').trim();
  if (!correo || !codigo) return err('Correo y código requeridos');

  const sh   = getSheet(SH.USUARIOS);
  const rowU = findRow(sh, UC.correo_normalizado, correo);
  if (rowU < 0) return err('Correo no encontrado');

  const stored  = String(sh.getRange(rowU, UC.recovery_codigo).getValue()).trim();
  const expira  = sh.getRange(rowU, UC.recovery_expira_en).getValue();
  const usuario = String(sh.getRange(rowU, UC.usuario).getValue());

  if (stored !== codigo) {
    log('recover_verify', correo, '', usuario, 'fail', 'codigo incorrecto', 'app', {});
    return err('Código incorrecto');
  }
  if (expira && new Date(expira) < new Date()) return err('Código expirado. Solicita uno nuevo.');

  updateRow(sh, rowU, UC, { recovery_estado: 'verificado' });
  log('recover_verify', correo, '', usuario, 'success', 'codigo correcto', 'app', {});

  return ok({ message: 'Código verificado. Ahora puedes cambiar tu contraseña.' });
}

// ─── resetPassword ────────────────────────────────────────────────────────────
function resetPassword(body) {
  const correo   = normalizeEmail(body.correo || '');
  const password = body.password || '';
  if (!correo || !password) return err('Correo y contraseña requeridos');

  const sh   = getSheet(SH.USUARIOS);
  const rowU = findRow(sh, UC.correo_normalizado, correo);
  if (rowU < 0) return err('Correo no encontrado');

  const estado_rec = String(sh.getRange(rowU, UC.recovery_estado).getValue()).trim();
  if (estado_rec !== 'verificado') return err('Debes verificar el código de recuperación primero.');

  const usuario = String(sh.getRange(rowU, UC.usuario).getValue());
  const hash    = hashSimple(password + usuario);

  updateRow(sh, rowU, UC, {
    password_hash:   hash,
    recovery_codigo: '',
    recovery_expira_en: '',
    recovery_estado: 'usado',
  });
  log('reset_password', correo, '', usuario, 'success', 'contraseña actualizada', 'app', {});

  return ok({ message: 'Contraseña actualizada exitosamente.' });
}

// ─── updateProfile ────────────────────────────────────────────────────────────
function updateProfile(body) {
  const user_id = String(body.user_id || '').trim();
  if (!user_id) return err('user_id requerido');

  const sh   = getSheet(SH.USUARIOS);
  const rowU = findRow(sh, UC.user_id, user_id);
  if (rowU < 0) return err('Usuario no encontrado');

  const campos = {};
  const permitidos = ['barrio','comuna','ciudad','departamento','pais','genero','foto_perfil','lat','lng','acepta_movilidad_anonima','nombres','apellidos'];
  permitidos.forEach(k => { if (body[k] !== undefined) campos[k] = body[k]; });
  if (body.nombres || body.apellidos) {
    const n = body.nombres  || sh.getRange(rowU, UC.nombres).getValue();
    const a = body.apellidos|| sh.getRange(rowU, UC.apellidos).getValue();
    campos.nombre_completo = (n + ' ' + a).trim();
  }
  campos.fecha_actualizacion = new Date().toISOString();
  updateRow(sh, rowU, UC, campos);

  return ok({ message: 'Perfil actualizado.' });
}

// ─── updateBirthdate ──────────────────────────────────────────────────────────
function updateBirthdate(body) {
  const user_id = String(body.user_id || '').trim();
  const fechaNac = String(body.fecha_nacimiento || '').trim();
  if (!user_id || !fechaNac) return err('user_id y fecha_nacimiento requeridos');

  const sh   = getSheet(SH.USUARIOS);
  const rowU = findRow(sh, UC.user_id, user_id);
  if (rowU < 0) return err('Usuario no encontrado');

  const partes = fechaNac.split('-');
  const { edad, esMayor } = calcEdad(fechaNac);

  updateRow(sh, rowU, UC, {
    fecha_nacimiento: fechaNac,
    nacimiento_dia:   partes[2] || '',
    nacimiento_mes:   partes[1] || '',
    nacimiento_anio:  partes[0] || '',
    edad, es_mayor_edad: esMayor,
    fecha_nacimiento_pendiente: 'NO',
    fecha_actualizacion: new Date().toISOString(),
  });

  return ok({ edad, esMayor, message: 'Fecha de nacimiento actualizada.' });
}

// ─── sendFriendRequest ────────────────────────────────────────────────────────
function sendFriendRequest(body) {
  const req_user_id     = String(body.requester_user_id || '').trim();
  const target_friend_code = String(body.target_friend_code || '').trim().toUpperCase();
  if (!req_user_id || !target_friend_code) return err('Datos incompletos');

  const sh   = getSheet(SH.USUARIOS);
  const ash  = getSheet(SH.AMIGOS);

  const reqRow = findRow(sh, UC.user_id, req_user_id);
  if (reqRow < 0) return err('Solicitante no encontrado');
  const reqUsuario = sh.getRange(reqRow, UC.usuario).getValue();
  const reqCode    = sh.getRange(reqRow, UC.friend_code).getValue();

  const tgtRow = findRow(sh, UC.friend_code, target_friend_code);
  if (tgtRow < 0) return err('Código de amigo no encontrado');
  const tgt_user_id = sh.getRange(tgtRow, UC.user_id).getValue();
  const tgtUsuario  = sh.getRange(tgtRow, UC.usuario).getValue();

  if (req_user_id === tgt_user_id) return err('No puedes enviarte solicitud a ti mismo');

  // Revisar solicitud existente
  const existing = findRow(ash, AC.requester_user_id, req_user_id);
  // (simplificado; en prod revisar también target)

  appendRow(ash, AC, {
    friend_id: uid('fr'),
    requester_user_id: req_user_id,
    requester_usuario: reqUsuario,
    requester_friend_code: reqCode,
    target_user_id: tgt_user_id,
    target_usuario: tgtUsuario,
    target_friend_code,
    estado: 'pendiente',
    fecha_solicitud: new Date().toISOString(),
    origen: 'friend_code',
  }, Object.keys(AC).length);

  // Notificar al target
  sendNotification({
    user_id: tgt_user_id,
    tipo: 'friend_request',
    titulo: 'Nueva solicitud de amistad',
    mensaje: `${reqUsuario} quiere ser tu amigo en URBIS.`,
    actor_user_id: req_user_id,
    actor_usuario: reqUsuario,
    related_id: reqCode,
    accion: 'abrir_social',
  });

  return ok({ message: 'Solicitud enviada.' });
}

// ─── respondFriendRequest ─────────────────────────────────────────────────────
function respondFriendRequest(body) {
  const friend_id = String(body.friend_id || '').trim();
  const respuesta = String(body.respuesta || '').trim(); // aceptado | rechazado
  if (!friend_id || !['aceptado','rechazado'].includes(respuesta)) return err('Datos inválidos');

  const ash  = getSheet(SH.AMIGOS);
  const rowF = findRow(ash, AC.friend_id, friend_id);
  if (rowF < 0) return err('Solicitud no encontrada');

  updateRow(ash, rowF, AC, { estado: respuesta, fecha_respuesta: new Date().toISOString() });

  return ok({ message: `Solicitud ${respuesta}.` });
}

// ─── getFriends ───────────────────────────────────────────────────────────────
function getFriends(body) {
  const user_id = String(body.user_id || '').trim();
  if (!user_id) return err('user_id requerido');

  const ash = getSheet(SH.AMIGOS);
  const all = sheetToObjects(ash, AC);
  const amigos = all.filter(r =>
    (r.requester_user_id === user_id || r.target_user_id === user_id) &&
    r.estado === 'aceptado'
  ).map(r => ({
    friend_id: r.friend_id,
    usuario:   r.requester_user_id === user_id ? r.target_usuario : r.requester_usuario,
    friend_code: r.requester_user_id === user_id ? r.target_friend_code : r.requester_friend_code,
    desde: r.fecha_respuesta,
  }));

  return ok({ amigos });
}

// ─── sendNotification (interna + acción directa) ─────────────────────────────
function sendNotification(body) {
  const nsh = getSheet(SH.NOTIF);
  appendRow(nsh, NC, {
    notification_id: uid('noti'),
    user_id:         body.user_id,
    tipo:            body.tipo || 'info',
    titulo:          body.titulo || '',
    mensaje:         body.mensaje || '',
    estado:          'no_leido',
    fecha_creacion:  new Date().toISOString(),
    accion:          body.accion || '',
    related_id:      body.related_id || '',
    actor_user_id:   body.actor_user_id || '',
    actor_usuario:   body.actor_usuario || '',
    metadata:        body.metadata ? JSON.stringify(body.metadata) : '',
  }, Object.keys(NC).length);

  return ok({ message: 'Notificación enviada.' });
}

// ─── getNotifications ────────────────────────────────────────────────────────
function getNotifications(body) {
  const user_id = String(body.user_id || '').trim();
  if (!user_id) return err('user_id requerido');

  const nsh  = getSheet(SH.NOTIF);
  const all  = sheetToObjects(nsh, NC);
  const notifs = all
    .filter(r => r.user_id === user_id)
    .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
    .slice(0, 50);

  return ok({ notificaciones: notifs, total: notifs.length, no_leidas: notifs.filter(n => n.estado === 'no_leido').length });
}

// ─── markNotificationRead ────────────────────────────────────────────────────
function markNotificationRead(body) {
  const nid = String(body.notification_id || '').trim();
  if (!nid) return err('notification_id requerido');

  const nsh  = getSheet(SH.NOTIF);
  const rowN = findRow(nsh, NC.notification_id, nid);
  if (rowN < 0) return err('Notificación no encontrada');

  updateRow(nsh, rowN, NC, { estado: 'leido', fecha_lectura: new Date().toISOString() });
  return ok({ message: 'Notificación marcada como leída.' });
}
