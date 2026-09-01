/**
 * URBIS Auth Backend · Google Apps Script
 * V163: Social URBIS + cuentas de sistema sin correo (admin / UrbisNoticia).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CÓMO USAR ESTE ARCHIVO
 * ═══════════════════════════════════════════════════════════════════════════
 * Es tu script COMPLETO y actualizado. Reemplaza TODO el contenido de tu
 * proyecto de Apps Script por este (Ctrl+A y pegar encima), guarda y vuelve a
 * desplegar la implementación web.
 *
 * QUÉ CAMBIÓ RESPECTO AL TUYO
 * ---------------------------
 * Solo se AGREGÓ un bloque al final ("CUENTAS DE SISTEMA"). No se modificó
 * ninguna de tus funciones: login, registro, social, chat, avatares, puntajes,
 * carpetas Pro City y la base de reportes quedan exactamente igual.
 *
 * PARA CREAR LA CUENTA UrbisNoticia (sin correo ni código de verificación):
 *   1. Pega este archivo completo y guarda.
 *   2. Arriba, en el selector de funciones, elige  crearCuentasSistemaUrbis
 *   3. Cambia las dos contraseñas marcadas con CAMBIA_ESTO (más abajo).
 *   4. Pulsa Ejecutar y mira Ver > Registro de ejecución.
 *   5. Vuelve a dejar CAMBIA_ESTO en su lugar y guarda, para que las
 *      contraseñas no queden escritas ni siquiera en el editor.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const URBIS_AUTH = {
  SHEET_ID: '12hZ7u82ENL47SsMXojBlU22f6U1U0uCkzeWevEJxBsU',
  ADMIN_EMAIL: 'urbisprocity@gmail.com',
  CODE_TTL_MINUTES: 15,

  SHEET_USERS: 'usuarios_registro',
  SHEET_VERIFY: 'verificacion_email',
  SHEET_LOGS: 'registro_logs',
  SHEET_FRIENDS: 'amigos_urbis'
};

var ADMIN_SECRET = 'urbis-admin-jesmen';

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  if (params.action === 'admin_delete_user' && params.secret === ADMIN_SECRET) {
    var target = String(params.target || '').trim();
    if (!target) return json_({ ok: false, message: 'Falta target' });
    var hojas = [URBIS_AUTH.SHEET_USERS, URBIS_AUTH.SHEET_VERIFY, URBIS_AUTH.SHEET_LOGS, URBIS_AUTH.SHEET_FRIENDS];
    var total = 0;
    hojas.forEach(function(h){ total += borrarFilasPorValor_(h, [target]); });
    return json_({ ok: true, message: 'Borradas ' + total + ' fila(s) para: ' + target, total: total });
  }
  if (params.action === 'admin_clean_gps' && params.secret === ADMIN_SECRET) {
    var ss = SpreadsheetApp.openById(URBIS_AUTH.SHEET_ID);
    var total = 0;
    ss.getSheets().forEach(function(sh) {
      var lastRow = sh.getLastRow();
      var lastCol = sh.getLastColumn();
      if (lastRow < 2 || lastCol < 1) return;
      var headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(h){ return String(h||'').trim().toLowerCase(); });
      var tipoIdx = headers.indexOf('tipo');
      if (tipoIdx < 0) return;
      var datos = sh.getDataRange().getValues();
      for (var i = datos.length - 1; i >= 1; i--) {
        var t = String(datos[i][tipoIdx] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
        if (t.indexOf('ubicaci') >= 0) { sh.deleteRow(i + 1); total++; }
      }
    });
    return json_({ ok: true, message: 'GPS borrados: ' + total + ' fila(s).', total: total });
  }
  // Buscar un usuario por nombre/usuario/correo/cédula (NO borra, datos enmascarados para verificar).
  if (params.action === 'admin_find_user' && params.secret === ADMIN_SECRET) {
    return json_(adminFindUser_(String(params.query || params.target || '')));
  }
  // Purgar por completo a un usuario: borra TODAS sus filas (usuario + correo + cédula) en todas las hojas.
  if (params.action === 'admin_purge_user' && params.secret === ADMIN_SECRET) {
    return json_(adminPurgeUser_(String(params.query || params.target || '')));
  }
  return json_({ ok: true, message: 'URBIS Auth activo.', version: 'urbis-auth-v227' });
}

// ════════════════════════════════════════════════════════════════════════
// ADMIN: buscar y purgar usuarios (verifica antes de borrar). Datos enmascarados.
// ════════════════════════════════════════════════════════════════════════
function _adminNorm_(s){ return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }

function _adminMask_(s){
  s = String(s == null ? '' : s).trim();
  if (!s) return '';
  if (s.indexOf('@') !== -1){ var p = s.split('@'); return p[0].slice(0,2) + '***@' + p[1]; }
  if (s.length <= 4) return '***';
  return '****' + s.slice(-4);
}

function _adminMatchUsers_(query){
  var q = _adminNorm_(query);
  if (!q || q.length < 3) return { error: 'Escribe al menos 3 caracteres para buscar.', rows: [] };
  var sh = ss_().getSheetByName(URBIS_AUTH.SHEET_USERS);
  if (!sh) return { error: 'No existe la hoja de usuarios.', rows: [] };
  var campos = ['nombres','apellidos','nombre_completo','usuario','correo','cedula','cedula_numero','telefono','user_id'];
  var rows = getRows_(sh).filter(function(r){
    return campos.some(function(c){ var v = _adminNorm_(r[c]); return v !== '' && v.indexOf(q) !== -1; });
  });
  return { error: '', rows: rows };
}

function _adminResumen_(r){
  return {
    nombre: String(r.nombre_completo || ((r.nombres || '') + ' ' + (r.apellidos || '')).trim()),
    usuario: String(r.usuario || ''),
    correo: _adminMask_(r.correo),
    cedula: _adminMask_(r.cedula_numero || r.cedula),
    estado: String(r.estado_cuenta || '')
  };
}

function adminFindUser_(query){
  var res = _adminMatchUsers_(query);
  if (res.error) return { ok: false, message: res.error };
  return { ok: true, count: res.rows.length, matches: res.rows.map(_adminResumen_) };
}

function adminPurgeUser_(query){
  var res = _adminMatchUsers_(query);
  if (res.error) return { ok: false, message: res.error };
  if (!res.rows.length) return { ok: true, purged: 0, usuarios: 0, message: 'No se encontró ningún usuario con: ' + query };
  var ids = [];
  var eliminados = res.rows.map(function(r){
    ['usuario','correo','cedula','cedula_numero','telefono','user_id'].forEach(function(c){
      var v = String(r[c] == null ? '' : r[c]).trim();
      if (v && v.length >= 4) ids.push(v);
    });
    return _adminResumen_(r);
  });
  ids = ids.filter(function(v,i){ return ids.indexOf(v) === i; });
  var hojas = [URBIS_AUTH.SHEET_USERS, URBIS_AUTH.SHEET_VERIFY, URBIS_AUTH.SHEET_LOGS, URBIS_AUTH.SHEET_FRIENDS];
  var total = 0;
  hojas.forEach(function(h){ total += borrarFilasPorValor_(h, ids); });
  return { ok: true, purged: total, usuarios: res.rows.length, eliminados: eliminados, message: 'Purgadas ' + total + ' fila(s) de ' + res.rows.length + ' usuario(s).' };
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '').trim();

    if (action === 'register') return json_(registerUser_(body.data || {}));
    if (action === 'verify') return json_(verifyUser_(body.email, body.code));
    if (action === 'login') return json_(loginUser_(body.email || body.correo || '', body.password, body.usuario || body.username || '', bodyIdentifier_(body)));

    if (action === 'check_username' || action === 'check_usarname' || action === 'checkUsername' || action === 'username_check') {
      return json_(checkUsername_(body.usuario || body.username || (body.data && body.data.usuario) || ''));
    }

    if (action === 'check_email' || action === 'email_check' || action === 'checkEmail') {
      return json_(checkEmail_(body.correo || body.email || (body.data && (body.data.correo || body.data.email)) || ''));
    }

    if (action === 'check_identity' || action === 'check_document_phone') {
      return json_(checkIdentity_(body));
    }

    if (action === 'recover_request') return json_(requestRecovery_(bodyIdentifier_(body)));
    if (action === 'recover_verify') return json_(verifyRecovery_(bodyIdentifier_(body), body.code || body.codigo || '', body.newPassword || body.new_password || body.nueva_contrasena || body.nuevaContraseña || ''));

    if (action === 'social_profile') return json_(socialProfile_(body));
    if (action === 'social_find_user' || action === 'find_friend' || action === 'search_friend') return json_(socialFindUser_(body));
    if (action === 'social_add_friend' || action === 'request_friend') return json_(socialAddFriend_(body));
    if (action === 'social_notifications') return json_(socialNotifications_(body));
    if (action === 'social_respond_friend' || action === 'respond_friend') return json_(socialRespondFriend_(body));
    if (action === 'social_remove_friend') return json_(socialRemoveFriend_(body));
    if (action === 'social_cancel_request') return json_(socialCancelRequest_(body));
    if (action === 'social_repair_username') return json_(socialRepairUsername_(body));
    if (action === 'social_get_friends') return json_(socialGetFriends_(body));

    if (action === 'chat_send') return json_(chatSend_(body));
    if (action === 'chat_fetch') return json_(chatFetch_(body));
    if (action === 'chat_inbox') return json_(chatInbox_(body));

    if (action === 'verify_identity') return json_(verifyIdentity_(body));
    if (action === 'set_avatar' || action === 'avatar_set') return json_(setAvatar_(body));
    if (action === 'get_avatars') return json_(getAvatars_(body));

    if (action === 'set_puntaje' || action === 'save_score') return json_(setPuntaje_(body));
    if (action === 'leaderboard' || action === 'get_leaderboard') return json_(leaderboard_(body));

    if (action === 'db_write' || action === 'crear_reporte') return json_(dbWrite_(body));
    if (action === 'db_read' || action === 'get_data') return json_(dbRead_(body));
    if (action === 'db_update') return json_(dbUpdate_(body));
    if (action === 'db_delete') return json_(dbDelete_(body));

    if (action === 'perm_list') return json_(permList_(body));
    if (action === 'perm_find') return json_(permFind_(body));
    if (action === 'perm_set') return json_(permSet_(body));
    if (action === 'perm_mine') return json_(permMine_(body));

    // URBIS Pro City · Carpetas compartidas de mapeo (georreferenciación grupal
    // entre amigos): crear carpeta, unirse/invitar (misma acción sirve para
    // ambos casos) y listar las carpetas donde el usuario es miembro.
    if (action === 'procity_folder_create') return json_(procityFolderCreate_(body));
    if (action === 'procity_folder_join' || action === 'procity_folder_add_member') return json_(procityFolderAddMember_(body));
    if (action === 'procity_folder_remove_member') return json_(procityFolderRemoveMember_(body));
    if (action === 'procity_folder_rename') return json_(procityFolderRename_(body));
    if (action === 'procity_folder_list_mine') return json_(procityFolderListMine_(body));

    return json_({ ok: false, message: 'Acción no soportada: ' + action });
  } catch (err) {
    return json_({ ok: false, message: String((err && err.message) || err) });
  }
}

function baseHeaders_() {
  return {
    users: [
      'user_id','friend_code','nombres','apellidos','nombre_completo','usuario','correo','telefono','tipo_documento','cedula','cedula_numero',
      'pais','otro_pais','departamento','ciudad','ciudad_corregimiento','comuna','barrio','ubicacion_completa','genero','genero_normalizado',
      'rol_solicitado','estado_cuenta','email_verificado','password_hash','password_salt','codigo_verificacion','codigo_expira_en',
      'fecha_registro','fecha_verificacion','ultimo_login','acepta_terminos','acepta_movilidad_anonima','observaciones_admin','ubicacion_validada','avatar',
      'nivel_cuenta','fecha_verificacion_identidad',
      'session_token','session_expira',
      // Permisos delegados (moderación). Vacío = ciudadana normal.
      'permisos'
    ],
    verify: ['verification_id','user_id','correo','codigo_verificacion','codigo_expira_en','estado','fecha_creacion','fecha_verificacion','intentos'],
    logs: ['log_id','identificador','correo','usuario','cedula','telefono','accion','resultado','fecha','motivo'],
    friends: ['friend_id','requester_user_id','requester_usuario','requester_friend_code','target_user_id','target_usuario','target_friend_code','estado','fecha_solicitud','fecha_respuesta','origen','nota']
  };
}

function ss_(){ return SpreadsheetApp.openById(URBIS_AUTH.SHEET_ID); }

function sheet_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headers && headers.length) sh.appendRow(headers);
  ensureHeaders_(sh, headers || []);
  return sh;
}

function ensureHeaders_(sh, wanted) {
  if (!wanted || !wanted.length) return;
  const lastCol = Math.max(1, sh.getLastColumn());
  const current = sh.getRange(1,1,1,lastCol).getValues()[0].map(h => String(h || '').trim());
  wanted.forEach(header => {
    if (current.indexOf(header) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(header);
      current.push(header);
    }
  });
}

function headerMap_(sh) {
  const values = sh.getRange(1,1,1,Math.max(1, sh.getLastColumn())).getValues()[0];
  const map = {};
  values.forEach((h,i) => map[String(h || '').trim()] = i + 1);
  return map;
}

function getRows_(sh) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  const headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(h => String(h || '').trim());
  return sh.getRange(2,1,lastRow-1,lastCol).getValues().map((row,idx) => {
    const obj = { _row: idx + 2 };
    headers.forEach((h,i) => obj[h] = row[i]);
    return obj;
  });
}

function setCellByHeader_(sh, row, header, value) {
  let map = headerMap_(sh);
  if (!map[header]) {
    sh.getRange(1, sh.getLastColumn() + 1).setValue(header);
    map = headerMap_(sh);
  }
  sh.getRange(row, map[header]).setValue(value);
}

function appendObject_(sh, obj, headers) {
  ensureHeaders_(sh, headers);
  const map = headerMap_(sh);
  const row = new Array(sh.getLastColumn()).fill('');
  Object.keys(obj).forEach(key => { if (map[key]) row[map[key] - 1] = obj[key]; });
  sh.appendRow(row);
}

function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function nowIso_(){ return new Date().toISOString(); }
function newId_(prefix){ return prefix + '_' + Utilities.getUuid().slice(0,8) + '_' + Date.now(); }
function normText_(v){ return String(v || '').trim(); }
function normLower_(v){ return normText_(v).toLowerCase(); }
function normEmail_(v){ return normLower_(v); }
function normUser_(v){ return String(v || '').trim().toLowerCase().replace(/\s+/g,'.').replace(/[^a-z0-9._-]/g,''); }
function digits_(v){ return String(v || '').replace(/\D+/g,''); }
function docComparable_(v){ const d = digits_(v); return d || normLower_(v); }

function normalizeFriendCode_(v){ return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
function makeFriendCode_(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}
function makeUniqueFriendCode_(usersSh){
  const used = {};
  getRows_(usersSh).forEach(r => { const c = normalizeFriendCode_(r.friend_code); if(c) used[c] = true; });
  for (let i = 0; i < 30; i++) { const c = makeFriendCode_(); if (!used[c]) return c; }
  return normalizeFriendCode_(Utilities.getUuid()).slice(0,8);
}
function ensureFriendCodeForRow_(usersSh, user){
  if(!user) return '';
  const current = normalizeFriendCode_(user.friend_code);
  if(current) return current;
  const code = makeUniqueFriendCode_(usersSh);
  setCellByHeader_(usersSh, user._row, 'friend_code', code);
  user.friend_code = code;
  return code;
}
function publicSocialUser_(user){
  return {
    user_id: user.user_id || '', friend_code: normalizeFriendCode_(user.friend_code) || '', usuario: user.usuario || user.username || '',
    nombre_completo: user.nombre_completo || [user.nombres || '', user.apellidos || ''].filter(Boolean).join(' ').trim() || 'Usuario URBIS',
    ciudad: user.ciudad || user.ciudad_corregimiento || '', comuna: user.comuna || '', barrio: user.barrio || '', estado_cuenta: user.estado_cuenta || '', email_verificado: user.email_verificado || '',
    avatar: String(user.avatar || '').trim()
  };
}
function findUserByUserIdOrFriendCode_(value){
  const raw = normText_(value);
  const code = normalizeFriendCode_(raw);
  if(!raw && !code) return null;
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  const rows = getRows_(usersSh).filter(r => !isDeletedUser_(r));
  const found = rows.find(r => normText_(r.user_id) === raw || normalizeFriendCode_(r.friend_code) === code);
  if(found) ensureFriendCodeForRow_(usersSh, found);
  return found || null;
}
function findSocialUser_(value){
  const direct = findUserByUserIdOrFriendCode_(value);
  if(direct) return direct;
  const user = pickBestUser_(findUsersByIdentifier_(value));
  if(user) ensureFriendCodeForRow_(sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users), user);
  return user || null;
}

function normalizePhone57_(v) {
  let d = digits_(v);
  if (d.indexOf('0057') === 0) d = d.slice(4);
  if (d.indexOf('57') === 0 && d.length > 10) d = d.slice(2);
  if (d.indexOf('0') === 0 && d.length === 11) d = d.slice(1);
  return d ? '+57' + d : '';
}
function phoneComparable_(v){ return digits_(normalizePhone57_(v)); }
function phoneComparableAny_(v, pais){ return isColombia_(pais) ? phoneComparable_(v) : digits_(v); }

function normalizeGender_(v) {
  const g = normLower_(v);
  if (g.indexOf('femenino') >= 0 || g.indexOf('mujer') >= 0) return 'femenino';
  if (g.indexOf('masculino') >= 0 || g.indexOf('hombre') >= 0) return 'masculino';
  return g || '';
}
function normalizeCountry_(pais, otroPais) {
  const p = normText_(pais);
  const otro = normText_(otroPais);
  if (!p) return '';
  if (p.toLowerCase() === 'otro' || p.toLowerCase() === 'otro país' || p.toLowerCase() === 'otro pais') return otro;
  return p;
}
function isColombia_(pais){ return normLower_(pais) === 'colombia'; }
function normalizeCity_(data){ return normText_(data.ciudad_corregimiento || data.ciudad || data.municipio || data.corregimiento || ''); }
function isCucuta_(city){ const c = normLower_(city).normalize('NFD').replace(/[̀-ͯ]/g,''); return c === 'cucuta' || c === 'san jose de cucuta'; }
function isDeletedUser_(user){ const estado = normLower_(user.estado_cuenta); return estado === 'eliminado' || estado === 'borrado' || estado === 'inactivo_eliminado'; }
function buildLocationText_(data){ return [data.pais,data.otro_pais,data.departamento,data.ciudad_corregimiento,data.comuna,data.barrio].map(normText_).filter(Boolean).join(' / '); }
function validPassword_(v){ return String(v || '').length >= 8; }
function hashPassword_(password, salt) {
  const raw = String(salt || '') + '|' + String(password || '');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function code_(){ return String(Math.floor(100000 + Math.random() * 900000)); }
function maskEmail_(email) {
  email = normEmail_(email);
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const a = parts[0];
  return (a.length <= 2 ? a[0] + '*' : a.slice(0,2) + '***') + '@' + parts[1];
}

function bodyIdentifier_(body) {
  body = body || {};
  const data = body.data || {};
  return normText_(
    body.identifier ||
    body.identificador ||
    body.indentificador ||
    body.id ||
    body.email ||
    body.correo ||
    body.usuario ||
    body.username ||
    data.identifier ||
    data.identificador ||
    data.indentificador ||
    data.email ||
    data.correo ||
    data.usuario ||
    data.username ||
    data.telefono ||
    data.phone ||
    data.cedula ||
    data.cedula_numero ||
    data.documento ||
    ''
  );
}

function userEmail_(r){ return normEmail_(r.correo || r.email || ''); }
function userUsername_(r){
  return normUser_(
    r.usuario ||
    r.username ||
    r.user ||
    r.nombre_usuario ||
    r.nombreUsuario ||
    r['nombre_usuario'] ||
    r['Nombre de usuario'] ||
    r['nombre de usuario'] ||
    r['Nombre usuario'] ||
    r['usuario_registro'] ||
    ''
  );
}
function userPhoneKey_(r){ return phoneComparableAny_(r.telefono || r.phone || '', r.pais || 'Colombia'); }
function userDocKey_(r){ return docComparable_(r.cedula_numero || r.cedula || r.documento || ''); }
function isVerified_(r){ return normLower_(r.email_verificado) === 'si' || normLower_(r.email_verificado) === 'sí' || normLower_(r.estado_cuenta) === 'activo'; }
function isActive_(r){ return normLower_(r.estado_cuenta) === 'activo'; }
function userScore_(r){ return (isActive_(r) ? 1000 : 0) + (isVerified_(r) ? 500 : 0) + (r.password_hash ? 100 : 0) + Number(r._row || 0); }
function pickBestUser_(rows){ return (rows || []).filter(r => !isDeletedUser_(r)).sort((a,b) => userScore_(b) - userScore_(a))[0] || null; }

function rowLinkKeys_(r) {
  const keys = { emails:{}, users:{}, docs:{}, phones:{} };
  const email = userEmail_(r);
  const user = userUsername_(r);
  const doc = userDocKey_(r);
  const phone = userPhoneKey_(r);
  if (email) keys.emails[email] = true;
  if (user) keys.users[user] = true;
  if (doc) keys.docs[doc] = true;
  if (phone) keys.phones[phone] = true;
  return keys;
}

function mergeLinkKeys_(target, source) {
  ['emails','users','docs','phones'].forEach(function(k){
    Object.keys(source[k] || {}).forEach(function(v){ if (v) target[k][v] = true; });
  });
}

function matchesLinkKeys_(r, keys) {
  const email = userEmail_(r);
  const user = userUsername_(r);
  const doc = userDocKey_(r);
  const phone = userPhoneKey_(r);
  return (
    (email && keys.emails[email]) ||
    (user && keys.users[user]) ||
    (doc && keys.docs[doc]) ||
    (phone && keys.phones[phone])
  );
}

function expandLinkedCandidates_(candidates) {
  candidates = (candidates || []).filter(r => !isDeletedUser_(r));
  if (!candidates.length) return [];
  const keys = { emails:{}, users:{}, docs:{}, phones:{} };
  candidates.forEach(function(r){ mergeLinkKeys_(keys, rowLinkKeys_(r)); });
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  const rows = getRows_(usersSh).filter(r => !isDeletedUser_(r));
  const seen = {};
  const out = [];
  rows.forEach(function(r){
    if (matchesLinkKeys_(r, keys)) {
      const key = String(r._row || r.user_id || r.correo || r.usuario || Math.random());
      if (!seen[key]) { seen[key] = true; out.push(r); }
    }
  });
  return out;
}

function updatePasswordForLinkedRows_(user, newPassword) {
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  const linked = expandLinkedCandidates_([user]);
  const updatedRows = [];
  linked.forEach(function(r){
    const salt = r.password_salt || r.user_id || user.user_id || newId_('salt');
    setCellByHeader_(usersSh, r._row, 'password_salt', salt);
    setCellByHeader_(usersSh, r._row, 'password_hash', hashPassword_(newPassword, salt));
    setCellByHeader_(usersSh, r._row, 'email_verificado', 'si');
    setCellByHeader_(usersSh, r._row, 'estado_cuenta', 'activo');
    setCellByHeader_(usersSh, r._row, 'ultimo_login', nowIso_());
    updatedRows.push(r._row);
  });
  return updatedRows;
}

function findUsersByLogin_(usuarioRaw, emailRaw) {
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  const rows = getRows_(usersSh).filter(r => !isDeletedUser_(r));
  const usuario = normUser_(usuarioRaw);
  const correo = normEmail_(emailRaw);
  return rows.filter(r => (usuario && userUsername_(r) === usuario) || (correo && userEmail_(r) === correo));
}

function findUsersByIdentifier_(identifierRaw) {
  const raw = normText_(identifierRaw);
  const idEmail = normEmail_(raw);
  const idUser = normUser_(raw);
  const idDigits = digits_(raw);
  const idDoc = docComparable_(raw);
  const idPhoneCol = phoneComparableAny_(raw, 'Colombia');
  const idFriendCode = normalizeFriendCode_(raw);
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  const rows = getRows_(usersSh).filter(r => !isDeletedUser_(r));
  return rows.filter(r => {
    const phoneKey = userPhoneKey_(r);
    const docKey = userDocKey_(r);
    const phoneRaw = digits_(r.telefono || r.phone || '');
    return (
      (raw.indexOf('@') >= 0 && userEmail_(r) === idEmail) ||
      (idUser && userUsername_(r) === idUser) ||
      (idFriendCode && normalizeFriendCode_(r.friend_code) === idFriendCode) ||
      (raw && normText_(r.user_id) === raw) ||
      (idDoc && docKey && docKey === idDoc) ||
      (idPhoneCol && phoneKey && phoneKey === idPhoneCol) ||
      (idDigits && idDigits.length >= 7 && phoneRaw && (phoneRaw === idDigits || phoneRaw.endsWith(idDigits) || idDigits.endsWith(phoneRaw)))
    );
  });
}

function checkUsername_(usuarioRaw) {
  const usuario = normUser_(usuarioRaw);
  if (!usuario) return { ok:false, available:false, message:'Escribe un nombre de usuario.' };
  if (!/^[a-z0-9._-]{5,30}$/.test(usuario)) return { ok:false, available:false, message:'El usuario debe tener mínimo 5 caracteres. Usa letras, números, punto, guion o guion bajo.' };
  const sh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  const exists = getRows_(sh).some(r => !isDeletedUser_(r) && userUsername_(r) === usuario);
  return { ok:true, available:!exists, usuario, message: exists ? 'Ese nombre de usuario ya existe. Elige otro.' : 'Usuario disponible.' };
}

function checkEmail_(emailRaw) {
  const correo = normEmail_(emailRaw);
  if (!correo) return { ok:false, available:false, message:'Escribe tu correo electrónico.' };
  if (!/^\S+@\S+\.\S+$/.test(correo)) return { ok:false, available:false, message:'Escribe un correo válido.' };
  const sh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  const exists = getRows_(sh).some(r => !isDeletedUser_(r) && userEmail_(r) === correo);
  return { ok:true, available:!exists, correo, message: exists ? 'Este correo ya está registrado. Usa recuperar acceso o inicia sesión.' : 'Correo disponible.' };
}

function checkIdentity_(body) {
  const data = body.data || body || {};
  const pais = normalizeCountry_(data.pais || 'Colombia', data.otro_pais || '');
  const cedulaNumero = normText_(data.cedula_numero || data.cedula || data.documento || '');
  const telefonoRaw = normText_(data.telefono || data.phone || '');
  const cedulaKey = docComparable_(cedulaNumero);
  const phoneKey = phoneComparableAny_(telefonoRaw, pais);
  const sh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  const rows = getRows_(sh).filter(r => !isDeletedUser_(r));
  const cedulaExists = cedulaKey ? rows.find(r => userDocKey_(r) === cedulaKey) : null;
  const phoneExists = phoneKey ? rows.find(r => userPhoneKey_(r) === phoneKey) : null;
  return {
    ok:true,
    cedulaAvailable:!cedulaExists,
    phoneAvailable:!phoneExists,
    cedulaMessage: cedulaExists ? 'Esta cédula ya está registrada. Usa recuperar acceso con tu cédula.' : 'Cédula disponible.',
    phoneMessage: phoneExists ? 'Este celular ya está registrado. Usa recuperar acceso con tu celular.' : 'Celular disponible.'
  };
}

// REGLA: si una cuenta NUNCA verificó su correo, NO cuenta como registrada.
// Antes de registrar, se purgan (marcan eliminadas) las cuentas pendientes no
// verificadas que coincidan en usuario, correo, cédula o celular, para que un
// registro a medias (p.ej. con correo mal escrito) no bloquee al usuario.
function purgeStalePending_(usersSh, usuario, correo, cedulaNumero, telefonoCmp) {
  let purgados = 0;
  getRows_(usersSh).forEach(function(r){
    if (isDeletedUser_(r)) return;
    if (isVerified_(r)) return; // jamás tocar cuentas verificadas
    const mUser  = usuario && userUsername_(r) === usuario;
    const mEmail = correo && userEmail_(r) === correo;
    const mDoc   = cedulaNumero && docComparable_(cedulaNumero).length >= 5 && userDocKey_(r) === docComparable_(cedulaNumero);
    const mPhone = telefonoCmp && userPhoneKey_(r) === telefonoCmp;
    if (mUser || mEmail || mDoc || mPhone) {
      try {
        setCellByHeader_(usersSh, r._row, 'estado_cuenta', 'eliminado');
        setCellByHeader_(usersSh, r._row, 'observaciones_admin', 'pendiente sin verificar purgado ' + nowIso_());
      } catch (e) {}
      purgados++;
    }
  });
  return purgados;
}

function registerUser_(data) {
  const headers = baseHeaders_();
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, headers.users);
  const verifySh = sheet_(URBIS_AUTH.SHEET_VERIFY, headers.verify);

  const nombres = normText_(data.nombres || data.nombre || data.name);
  const apellidos = normText_(data.apellidos || data.surname);
  const nombreCompleto = normText_(data.nombre_completo || (nombres + ' ' + apellidos));
  const usuario = normUser_(data.usuario || data.username);
  const correo = normEmail_(data.correo || data.email);
  const tipoDocumento = normText_(data.tipo_documento || data.doc_type || 'CC');
  const cedulaNumero = normText_(data.cedula_numero || data.cedula || data.documento);
  const cedula = tipoDocumento + ' ' + cedulaNumero;
  const paisSeleccionado = normText_(data.pais || 'Colombia');
  const otroPais = normText_(data.otro_pais || data.otroPais || '');
  const pais = normalizeCountry_(paisSeleccionado, otroPais);
  const isColombia = isColombia_(pais);
  const telefono = isColombia ? normalizePhone57_(data.telefono || data.phone) : normText_(data.telefono || data.phone);
  const telefonoCmp = phoneComparableAny_(telefono, pais);
  const departamento = isColombia ? normText_(data.departamento || '') : '';
  const ciudadCorregimiento = isColombia ? normalizeCity_(data) : '';
  const comuna = isColombia ? normText_(data.comuna || '') : '';
  const barrio = isColombia ? normText_(data.barrio || '') : '';
  const genero = normText_(data.genero || '');
  const generoNormalizado = normalizeGender_(genero);
  const password = String(data.password || '');
  const termsAccepted = !!data.termsAccepted || data.acepta_terminos === 'si' || data.terminos === true;
  const mobilityAccepted = !!data.mobilityAnalyticsAccepted || data.acepta_movilidad_anonima === 'si';

  // ── VALIDACIÓN NIVEL 1 (cuenta básica) ──────────────────────────────────
  // Solo lo mínimo para que la cuenta sea real y se pueda responder por ella:
  // usuario, correo verificable, contraseña y dónde vive. La identidad legal
  // —nombres, apellidos, cédula, celular— NO se pide aquí: se pide después,
  // cuando el usuario vaya a subir una foto o a publicar algo delicado.
  //
  // Esta validación TIENE que ir de la mano con la del navegador
  // (validateCitizenForm en js/41). Si el servidor exige algo que el
  // formulario ya no pide, el registro falla con un mensaje que el usuario no
  // puede resolver porque el campo ni siquiera está en pantalla.
  purgeStalePending_(usersSh, usuario, correo, cedulaNumero, telefonoCmp);
  const usernameCheck = checkUsername_(usuario); if (!usernameCheck.ok || !usernameCheck.available) return usernameCheck;
  const emailCheck = checkEmail_(correo); if (!emailCheck.ok || !emailCheck.available) return emailCheck;
  if (!validPassword_(password)) return { ok:false, message:'La contraseña debe tener mínimo 8 caracteres.' };
  if (!pais) return { ok:false, message:'Selecciona o escribe tu país.' };
  if (isColombia && !departamento) return { ok:false, message:'Selecciona tu departamento.' };
  if (isColombia && !ciudadCorregimiento) return { ok:false, message:'Selecciona tu ciudad o corregimiento.' };
  if (!termsAccepted) return { ok:false, message:'Debes aceptar términos y condiciones.' };

  const rows = getRows_(usersSh).filter(r => !isDeletedUser_(r));
  // La cédula solo se comprueba SI la entregó. En el nivel 1 llega vacía, y
  // comparar vacíos haría que la segunda cuenta chocara con la primera.
  if (cedulaNumero && docComparable_(cedulaNumero).length >= 5 &&
      rows.find(r => userDocKey_(r) === docComparable_(cedulaNumero))) {
    return { ok:false, message:'Esta cédula ya está registrada. Usa recuperar acceso con tu cédula.' };
  }
  // Verificación por celular DESACTIVADA (no bloquea registros con celular repetido).
  // Para reactivarla, descomenta la línea siguiente:
  // if (rows.find(r => userPhoneKey_(r) === telefonoCmp)) return { ok:false, message:'Este celular ya está registrado. Usa recuperar acceso con tu celular.' };

  const verificationCode = code_();
  const expires = new Date(Date.now() + URBIS_AUTH.CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const userId = newId_('usr');
  const friendCode = makeUniqueFriendCode_(usersSh);
  const role = correo === normEmail_(URBIS_AUTH.ADMIN_EMAIL) ? 'admin' : 'citizen';
  const salt = userId;
  const passwordHash = hashPassword_(password, salt);

  const userObj = {
    user_id:userId,friend_code:friendCode,nombres,apellidos,nombre_completo:nombreCompleto,usuario,correo,telefono,tipo_documento:tipoDocumento,cedula,cedula_numero:cedulaNumero,
    pais,otro_pais:isColombia ? '' : pais,departamento,ciudad:ciudadCorregimiento,ciudad_corregimiento:ciudadCorregimiento,comuna,barrio,
    ubicacion_completa:buildLocationText_({pais,otro_pais:isColombia ? '' : pais,departamento,ciudad_corregimiento:ciudadCorregimiento,comuna,barrio}),
    genero,genero_normalizado:generoNormalizado,rol_solicitado:role,estado_cuenta:'pendiente',email_verificado:'no',password_hash:passwordHash,password_salt:salt,
    codigo_verificacion:verificationCode,codigo_expira_en:expires,fecha_registro:nowIso_(),fecha_verificacion:'',ultimo_login:'',
    acepta_terminos:termsAccepted ? 'si' : 'no',acepta_movilidad_anonima:mobilityAccepted ? 'si' : 'no',observaciones_admin:'',ubicacion_validada:isColombia ? 'si' : 'pais_externo',
    // Nivel de la cuenta. Se calcula del dato, no de lo que diga el cliente:
    // un navegador puede mandar 'verificado' y aquí no hay forma de creerle.
    // Verificada = entregó identidad legal y celular; básica = todo lo demás.
    nivel_cuenta:(nombres && apellidos && cedulaNumero && telefonoCmp) ? 'verificado' : 'basico',
    fecha_verificacion_identidad:(nombres && apellidos && cedulaNumero && telefonoCmp) ? nowIso_() : ''
  };

  appendObject_(usersSh, userObj, headers.users);
  appendObject_(verifySh, { verification_id:newId_('ver'), user_id:userId, correo, codigo_verificacion:verificationCode, codigo_expira_en:expires, estado:'pendiente', fecha_creacion:nowIso_(), fecha_verificacion:'', intentos:0 }, headers.verify);
  log_({ identificador:usuario, correo, usuario, cedula:cedulaNumero, telefono, accion:'register', resultado:'pending', motivo:'codigo enviado' });
  sendCodeEmail_(correo, verificationCode, 'Verifica tu cuenta URBIS', 'Tu código de verificación es:');
  return { ok:true, message:'Código enviado al correo.', email:correo, usuario };
}

function verifyUser_(emailRaw, codeRaw) {
  const correo = normEmail_(emailRaw);
  const code = normText_(codeRaw);
  if (!correo || !code) return { ok:false, message:'Falta correo o código.' };
  const headers = baseHeaders_();
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, headers.users);
  const verifySh = sheet_(URBIS_AUTH.SHEET_VERIFY, headers.verify);
  const matches = getRows_(usersSh).filter(r => !isDeletedUser_(r) && userEmail_(r) === correo);
  const user = pickBestUser_(matches);
  if (!user) return { ok:false, message:'Cuenta no encontrada.' };
  const expected = normText_(user.codigo_verificacion);
  const expires = new Date(user.codigo_expira_en || 0).getTime();
  if (expected !== code) { incrementVerifyAttempts_(verifySh, correo, code); return { ok:false, message:'Código incorrecto.' }; }
  if (!expires || Date.now() > expires) return { ok:false, message:'El código expiró. Solicita uno nuevo.' };
  setCellByHeader_(usersSh, user._row, 'email_verificado', 'si');
  setCellByHeader_(usersSh, user._row, 'estado_cuenta', 'activo');
  setCellByHeader_(usersSh, user._row, 'fecha_verificacion', nowIso_());
  updateLatestVerification_(verifySh, correo, 'verificado');
  log_({ identificador:user.usuario || correo, correo, usuario:user.usuario || '', cedula:user.cedula_numero || user.cedula || '', telefono:user.telefono || '', accion:'verify', resultado:'success', motivo:'correo verificado' });
  user.email_verificado = 'si'; user.estado_cuenta = 'activo';
  ensureFriendCodeForRow_(usersSh, user);
  return { ok:true, message:'Cuenta verificada.', user:userPayload_(user) };
}

function incrementVerifyAttempts_(verifySh, correo, code) {
  const rows = getRows_(verifySh).filter(r => normEmail_(r.correo) === correo && normText_(r.codigo_verificacion) === code);
  if (!rows.length) return;
  const row = rows[rows.length - 1];
  setCellByHeader_(verifySh, row._row, 'intentos', Number(row.intentos || 0) + 1);
}
function updateLatestVerification_(verifySh, correo, estado) {
  const rows = getRows_(verifySh).filter(r => normEmail_(r.correo) === correo);
  if (!rows.length) return;
  const row = rows[rows.length - 1];
  setCellByHeader_(verifySh, row._row, 'estado', estado);
  setCellByHeader_(verifySh, row._row, 'fecha_verificacion', nowIso_());
}

function loginUser_(emailRaw, passwordRaw, usuarioRaw, identifierRaw) {
  const correo = normEmail_(emailRaw);
  const usuario = normUser_(usuarioRaw);
  const identifier = normText_(identifierRaw || usuarioRaw || emailRaw || '');
  const password = String(passwordRaw || '');

  if (!identifier && !usuario && !correo) {
    return { ok:false, message:'Escribe tu usuario, correo, celular o cédula.' };
  }
  if (!password) return { ok:false, message:'Escribe tu contraseña.' };

  const fromLogin = findUsersByLogin_(usuario, correo);
  const fromIdentifier = identifier ? findUsersByIdentifier_(identifier) : [];
  const baseCandidates = [];
  const seen = {};
  fromLogin.concat(fromIdentifier).forEach(function(r){
    const key = String(r._row || r.user_id || r.correo || r.usuario || Math.random());
    if (!seen[key]) { seen[key] = true; baseCandidates.push(r); }
  });
  const candidates = expandLinkedCandidates_(baseCandidates);
  candidates.sort(function(a,b){ return userScore_(b) - userScore_(a); });

  const ref = identifier || usuario || correo;
  if (!candidates.length) {
    log_({ identificador:ref, correo, usuario, accion:'login', resultado:'failed', motivo:'cuenta no encontrada' });
    return { ok:false, message:'Usuario o contraseña incorrectos.' };
  }

  const verifiedCandidates = candidates.filter(isVerified_);
  if (!verifiedCandidates.length) return { ok:false, message:'Primero verifica tu correo.' };

  for (let i=0; i<verifiedCandidates.length; i++) {
    const user = verifiedCandidates[i];
    if (normLower_(user.estado_cuenta) === 'bloqueado') return { ok:false, message:'La cuenta está bloqueada. Contacta al administrador.' };
    if (!user.password_hash) continue;
    const salt = user.password_salt || user.user_id || user.correo || ref;
    if (hashPassword_(password, salt) === String(user.password_hash)) {
      const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
      setCellByHeader_(usersSh, user._row, 'ultimo_login', nowIso_());
      ensureFriendCodeForRow_(usersSh, user);
      log_({ identificador:user.usuario || ref, correo:user.correo || correo, usuario:user.usuario || usuario, cedula:user.cedula_numero || user.cedula || '', telefono:user.telefono || '', accion:'login', resultado:'success', motivo:'login correcto' });
      // Prueba de que quien escriba después es de verdad esta cuenta. Sin esto,
      // el servidor solo puede creerse lo que le diga el navegador.
      var token = _crearTokenSesion_(usersSh, user);
      var payload = userPayload_(user);
      payload.session_token = token;
      return { ok:true, message:'Login correcto.', user:payload, session_token:token };
    }
  }

  log_({ identificador:ref, correo:candidates[0].correo || correo, usuario:candidates[0].usuario || usuario, cedula:candidates[0].cedula_numero || candidates[0].cedula || '', telefono:candidates[0].telefono || '', accion:'login', resultado:'failed', motivo:'password incorrecto' });
  return { ok:false, message:'Usuario o contraseña incorrectos. Usa recuperar acceso para crear una nueva contraseña.' };
}

function requestRecovery_(identifierRaw) {
  const identifier = normText_(identifierRaw);
  if (!identifier) return { ok:false, message:'Escribe tu usuario, correo, celular o cédula.' };
  const user = pickBestUser_(findUsersByIdentifier_(identifier));
  if (!user) return { ok:false, message:'No encontramos una cuenta con ese dato. Revisa si escribiste bien el usuario, correo, celular o cédula.' };
  const correo = userEmail_(user);
  if (!correo) return { ok:false, message:'Encontramos la cuenta, pero no tiene correo guardado. Contacta a urbisprocity@gmail.com para recuperarla.' };
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  const verificationCode = code_();
  const expires = new Date(Date.now() + URBIS_AUTH.CODE_TTL_MINUTES * 60 * 1000).toISOString();
  setCellByHeader_(usersSh, user._row, 'codigo_verificacion', verificationCode);
  setCellByHeader_(usersSh, user._row, 'codigo_expira_en', expires);
  sendCodeEmail_(correo, verificationCode, 'Recuperar acceso URBIS', 'Tu código para recuperar acceso es:');
  log_({ identificador:identifier, correo, usuario:user.usuario || '', cedula:user.cedula_numero || user.cedula || '', telefono:user.telefono || '', accion:'recover_request', resultado:'sent', motivo:'codigo recuperación' });
  return { ok:true, message:'Código enviado al correo asociado.', email:correo, masked_email:maskEmail_(correo) };
}

function verifyRecovery_(identifierRaw, codeRaw, newPasswordRaw) {
  const identifier = normText_(identifierRaw);
  const code = normText_(codeRaw);
  const newPassword = String(newPasswordRaw || '');
  if (!identifier || !code) return { ok:false, message:'Falta identificador o código.' };
  if (!validPassword_(newPassword)) return { ok:false, message:'La nueva contraseña debe tener mínimo 8 caracteres.' };
  const user = pickBestUser_(findUsersByIdentifier_(identifier));
  if (!user) return { ok:false, message:'Cuenta no encontrada.' };
  const expected = normText_(user.codigo_verificacion);
  const expires = new Date(user.codigo_expira_en || 0).getTime();
  if (expected !== code) return { ok:false, message:'Código incorrecto.' };
  if (!expires || Date.now() > expires) return { ok:false, message:'El código expiró.' };
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  updatePasswordForLinkedRows_(user, newPassword);
  ensureFriendCodeForRow_(usersSh, user);
  const salt = user.password_salt || user.user_id || newId_('salt');
  user.password_salt = salt; user.password_hash = hashPassword_(newPassword, salt); user.email_verificado = 'si'; user.estado_cuenta = 'activo'; user.ultimo_login = nowIso_();
  log_({ identificador:identifier, correo:user.correo || '', usuario:user.usuario || '', cedula:user.cedula_numero || user.cedula || '', telefono:user.telefono || '', accion:'recover_verify', resultado:'success', motivo:'password actualizado' });
  return { ok:true, message:'Contraseña actualizada.', user:userPayload_(user) };
}

/* ════════════════════════════════════════════════════════════════════════════
   QUIÉN PUEDE ESCRIBIR EN LA BASE
   ────────────────────────────────────────────────────────────────────────────
   Hasta la v575, borrar o editar un reporte se autorizaba SOLO en el navegador:
   el servidor aceptaba cualquier db_update y cualquier db_delete que le
   llegara. La comprobación "¿eres el dueño de este reporte?" vivía en un
   archivo JavaScript que el propio usuario puede editar. Alguien con
   conocimientos podía borrar el mapa entero sin saber ninguna contraseña.

   Ahora el servidor decide, y para decidir necesita saber quién pregunta. Al
   iniciar sesión se entrega un token: una cadena aleatoria guardada en la
   cuenta, con caducidad, que el cliente manda en cada escritura. No es la
   contraseña —no se puede reusar para entrar en ningún sitio— y se puede
   revocar cambiando la celda.

   Lo que NO cubre, dicho claramente: los contadores comunitarios (apoyos,
   validaciones, denuncias) siguen siendo escribibles por cualquiera, porque
   confirmar un reporte o denunciarlo tiene que funcionar sin cuenta. Alguien
   podría falsificar SUS propios contadores. Cerrarlo pide acciones propias que
   solo sepan sumar, no reescribir; es el siguiente paso natural.
   ════════════════════════════════════════════════════════════════════════════ */

var TOKEN_TTL_DIAS = 60;

function _crearTokenSesion_(usersSh, user) {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  var expira = new Date(Date.now() + TOKEN_TTL_DIAS * 86400000).toISOString();
  try {
    setCellByHeader_(usersSh, user._row, 'session_token', token);
    setCellByHeader_(usersSh, user._row, 'session_expira', expira);
  } catch (e) { return ''; }
  return token;
}

/* Devuelve quién hace la petición según el token, o null si no hay token
   válido. Nunca se fía del `usuario` que venga en el cuerpo: eso lo escribe el
   navegador y es justo lo que no se puede creer. */
/* ═══════════════════════════════════════════════════════════════════════
   PERMISOS DELEGADOS
   El dueño de URBIS puede repartir tareas de moderación SIN repartir la
   cuenta. Cada permiso es una tarea concreta, no un rango: así se le puede
   dar a alguien la capacidad de retirar contenido inapropiado sin darle la
   de aprobar reportes ni la de leer el buzón.

   Se guardan en la columna `permisos` de la hoja de usuarios, separados por
   comas. Quien los reparte es SOLO el dueño (el correo de URBIS_AUTH.ADMIN_EMAIL):
   si una moderadora pudiera repartirlos, podría ascenderse sola y el reparto
   no valdría nada.

   Lo que decide de verdad es esta lectura, hecha en cada escritura contra la
   hoja. El botón que se ve o se esconde en el teléfono es solo cortesía.
   ═══════════════════════════════════════════════════════════════════════ */
var URBIS_PERMISOS = ['eliminar', 'moderar', 'aprobar', 'peticiones'];

function _leerPermisos_(valor) {
  var s = String(valor == null ? '' : valor).toLowerCase();
  var out = [];
  for (var i = 0; i < URBIS_PERMISOS.length; i++) {
    if (s.indexOf(URBIS_PERMISOS[i]) !== -1) out.push(URBIS_PERMISOS[i]);
  }
  return out;
}
function _puede_(quien, permiso) {
  if (!quien) return false;
  if (quien.esAdmin) return true;              // dueño y cuentas de sistema
  return (quien.permisos || []).indexOf(permiso) !== -1;
}

function _quienEscribe_(body) {
  var token = String((body && (body.session_token || body.token)) || '').trim();
  if (!token) return null;
  var sh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  var filas = getRows_(sh);
  for (var i = 0; i < filas.length; i++) {
    var r = filas[i];
    if (isDeletedUser_(r)) continue;
    if (String(r.session_token || '').trim() !== token) continue;
    var exp = String(r.session_expira || '').trim();
    if (exp && new Date(exp).getTime() < Date.now()) return null;   // caducado
    return {
      usuario: normUser_(r.usuario || ''),
      correo: normEmail_(r.correo || ''),
      esAdmin: normLower_(r.rol_solicitado) === 'admin',
      // Dueño: la cuenta del correo de URBIS. Es la única que puede repartir
      // permisos, y ninguna otra puede quitárselos.
      esDueno: !!normEmail_(r.correo || '') &&
               normEmail_(r.correo || '') === normEmail_(URBIS_AUTH.ADMIN_EMAIL),
      permisos: _leerPermisos_(r.permisos)
    };
  }
  return null;
}

// Posiciones dentro de `descripcion` que necesita la autorización.
var DESC_IDX_AUTOR = 45;   // BASE_OFFSET+2 · nombre de usuario de quien publicó
// Casillas que la COMUNIDAD puede tocar en un reporte ajeno. Todo lo demás
// —texto, foto, ubicación, víctimas, ficha del edificio— es del autor.
var DESC_IDX_COMUNITARIAS = [
  47,   // apoyos (👍)
  54,   // estado del historial: así 3 vecinos pueden archivar lo que ya no está
  61,   // validaciones ciudadanas (¿sigue vigente?)
  63    // denuncias (moderación)
];

/* Filas que NO son reportes: ubicación GPS, comentarios, relaciones de
   amistad, puntajes, permisos, avatares, chat. Son la fontanería de la
   aplicación, no contenido del mapa, y su `descripcion` tiene otro formato —
   ni siquiera se puede leer un autor de ella. Se dejan como estaban: cerrarlas
   con la misma regla rompería los amigos, el chat y la ubicación compartida sin
   proteger nada que esté a la vista en el mapa. */
function _esFilaMeta_(tipo) {
  var t = String(tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t.indexOf('ubicacion') !== -1 || t.indexOf('comentario') !== -1 ||
         t.indexOf('relacion') !== -1 || t.indexOf('puntaje') !== -1 ||
         t.indexOf('permiso') !== -1 || t.indexOf('avatar') !== -1 ||
         t.indexOf('chat') !== -1 || t.indexOf('peticion') !== -1;
}

/* Comentarios y peticiones NO son fontanería aunque compartan el filtro de
   filas meta (ahí están para que no se pinten en el mapa). Son texto escrito
   por una persona, con su nombre encima y a la vista de los demás. Hasta ahora
   caían en la rama de "filas meta" de dbUpdate_/dbDelete_, que no comprueba
   nada: cualquiera con la descripción exacta podía borrar el comentario de
   otro. Se separan aquí y se les aplica su propia regla de autoría.

   El autor no está en la casilla 45 —eso es formato de reporte— sino en el
   primer campo del formato usuario~~~texto~~~extra. */
function _esFilaTextoDeAlguien_(tipo) {
  var t = String(tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t.indexOf('comentario') !== -1 || t.indexOf('peticion') !== -1;
}
function _esAutorDelTexto_(descripcion, quien) {
  if (!quien) return false;
  if (quien.esAdmin) return true;
  var autor = normUser_(String(descripcion || '').split('~~~')[0] || '');
  return !!autor && autor === quien.usuario;
}
/* Denunciar un comentario ajeno sí lo puede hacer cualquiera: escribe SOLO el
   tercer campo (las denuncias). Si cambió cualquier otra cosa, es una edición
   del comentario de otro y no pasa. Se limita a comentarios a propósito: en
   una petición el tercer campo es la captura adjunta, no una denuncia. */
function _soloDenunciasEnTexto_(tipo, vieja, nueva) {
  var t = String(tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.indexOf('comentario') === -1) return false;
  var a = String(vieja || '').split('~~~');
  var b = String(nueva || '').split('~~~');
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) {
    if (String(a[i] == null ? '' : a[i]) === String(b[i] == null ? '' : b[i])) continue;
    if (i !== 2) return false;
  }
  return true;
}

function _esAutorDelReporte_(descripcion, quien) {
  if (!quien) return false;
  if (quien.esAdmin) return true;
  var autor = normUser_(String(descripcion || '').split(' | ')[DESC_IDX_AUTOR] || '');
  return !!autor && autor === quien.usuario;
}

var DESC_IDX_APROBACION = 44;   // BASE_OFFSET+1 · "Pendiente" / "Aprobado"
var DESC_IDX_DENUNCIAS  = 63;   // el sobre DENUNCIAS_URBIS

/* El sobre de denuncias guarda dos cosas distintas en la misma casilla: QUIÉN
   denunció (lo pone cualquiera) y QUÉ decidió el moderador (esconder, devolver,
   la nota). Sin abrirlo no se pueden separar, así que se abre. */
function _leerSobreDenuncias_(campo) {
  var s = String(campo == null ? '' : campo);
  var P = 'DENUNCIAS_URBIS:';
  if (s.indexOf(P) !== 0) return { oculto:'', revisado:'', nota:'' };
  try {
    var o = JSON.parse(decodeURIComponent(s.slice(P.length)));
    return { oculto:String(o.oculto || ''), revisado:String(o.revisado || ''), nota:String(o.nota || '') };
  } catch (e) { return { oculto:'', revisado:'', nota:'' }; }
}
/* Denunciar de nuevo algo ya revisado deja `oculto` en blanco para reabrir el
   caso: eso lo hace cualquier vecina y NO es moderar. Moderar es lo contrario:
   poner "oculto" o "restaurado", firmar la revisión o dejar nota. */
function _esDecisionDeModerador_(viejo, nuevo) {
  var a = _leerSobreDenuncias_(viejo), b = _leerSobreDenuncias_(nuevo);
  if (b.oculto !== a.oculto && (b.oculto === 'oculto' || b.oculto === 'restaurado')) return true;
  if (b.revisado !== a.revisado && b.revisado) return true;
  if (b.nota !== a.nota) return true;
  return false;
}

/* ¿Puede esta petición cambiar ESTE reporte? Se compara casilla por casilla:
   el autor y el dueño pueden todo; cualquier otra persona, solo las casillas
   comunitarias, y dentro de ellas ni esconde contenido ni aprueba reportes sin
   el permiso correspondiente. */
function _autorizaCambioReporte_(descVieja, descNueva, quien) {
  if (_esAutorDelReporte_(descVieja, quien)) return true;
  if (descNueva == null) return false;   // sin descripción no se sabe qué cambia
  var a = String(descVieja || '').split(' | ');
  var b = String(descNueva).split(' | ');
  var n = Math.max(a.length, b.length);
  var tocaAprobacion = false;
  for (var i = 0; i < n; i++) {
    var va = String(a[i] == null ? '' : a[i]);
    var vb = String(b[i] == null ? '' : b[i]);
    if (va === vb) continue;
    if (i === DESC_IDX_APROBACION) { tocaAprobacion = true; continue; }
    if (DESC_IDX_COMUNITARIAS.indexOf(i) === -1) return false;
    if (i === DESC_IDX_DENUNCIAS && _esDecisionDeModerador_(va, vb) && !_puede_(quien, 'moderar')) return false;
  }
  if (tocaAprobacion && !_puede_(quien, 'aprobar')) return false;
  return true;
}

/* Se conserva por compatibilidad: la usan las pruebas y deja claro, leída
   sola, cuál es la lista blanca. */
function _soloCambiosComunitarios_(descVieja, descNueva) {
  var a = String(descVieja || '').split(' | ');
  var b = String(descNueva || '').split(' | ');
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) {
    if (String(a[i] == null ? '' : a[i]) === String(b[i] == null ? '' : b[i])) continue;
    if (DESC_IDX_COMUNITARIAS.indexOf(i) === -1) return false;
  }
  return true;
}

function userPayload_(user) {
  // Resiliencia: si faltan, derivar nombre completo de nombres+apellidos y el
  // usuario del correo, para que el perfil nunca quede genérico.
  var nombreCompleto = user.nombre_completo || ((user.nombres || '') + ' ' + (user.apellidos || '')).trim();
  var usuario = user.usuario || '';
  if (!usuario && (user.correo || user.email)) usuario = String(user.correo || user.email).split('@')[0];
  return {
    user_id:user.user_id || '', friend_code:normalizeFriendCode_(user.friend_code) || '', nombres:user.nombres || '', apellidos:user.apellidos || '', nombre_completo:nombreCompleto,
    usuario:usuario, correo:user.correo || user.email || '', telefono:user.telefono || user.phone || '', tipo_documento:user.tipo_documento || '',
    cedula:user.cedula || '', cedula_numero:user.cedula_numero || '', pais:user.pais || '', otro_pais:user.otro_pais || '', departamento:user.departamento || '',
    ciudad:user.ciudad || user.ciudad_corregimiento || '', ciudad_corregimiento:user.ciudad_corregimiento || user.ciudad || '', comuna:user.comuna || '', barrio:user.barrio || '',
    ubicacion_completa:user.ubicacion_completa || '', genero:user.genero || '', genero_normalizado:user.genero_normalizado || '', rol_solicitado:user.rol_solicitado || 'citizen',
    estado_cuenta:user.estado_cuenta || '', email_verificado:user.email_verificado || '', avatar:String(user.avatar || '').trim(),
    // Permisos delegados, para que la aplicación pinte los botones correctos
    // desde el primer segundo. Quien decide de verdad sigue siendo el servidor.
    permisos:_leerPermisos_(user.permisos),
    es_dueno: !!normEmail_(user.correo || '') &&
              normEmail_(user.correo || '') === normEmail_(URBIS_AUTH.ADMIN_EMAIL)
  };
}


function socialProfile_(body) {
  const identifier = body.current_user_id || body.user_id || body.friend_code || body.identifier || body.identificador || body.usuario || body.username || body.cedula || body.email || body.correo || '';
  const user = findSocialUser_(identifier);
  if(!user) return { ok:false, message:'No encontré tu perfil activo. Inicia sesión de nuevo.' };
  if(!isVerified_(user)) return { ok:false, message:'Tu cuenta debe estar verificada para usar Social URBIS.' };
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  ensureFriendCodeForRow_(usersSh, user);
  return { ok:true, user: publicSocialUser_(user) };
}
function socialFindUser_(body) {
  const query = normText_(body.query || body.identifier || body.identificador || body.usuario || body.username || body.cedula || body.friend_code || '');
  const current = normText_(body.current_user_id || body.current_identifier || body.current_friend_code || '');
  if(!query) return { ok:false, found:false, message:'Escribe un usuario, cédula o ID URBIS.' };
  const target = findSocialUser_(query);
  if(!target || !isVerified_(target)) return { ok:true, found:false, message:'No encontramos un usuario verificado con ese dato.' };
  const currentUser = current ? findSocialUser_(current) : null;
  if(currentUser && target.user_id && currentUser.user_id && String(target.user_id) === String(currentUser.user_id)) return { ok:true, found:false, self:true, message:'Ese es tu propio perfil.' };
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  ensureFriendCodeForRow_(usersSh, target);
  return { ok:true, found:true, user: publicSocialUser_(target), message:'Usuario encontrado.' };
}
function socialAddFriend_(body) {
  const requesterKey = normText_(body.requester_user_id || body.current_user_id || body.requester_identifier || body.current_identifier || body.user_id || '');
  const targetKey = normText_(body.target_user_id || body.target_identifier || body.target_friend_code || body.query || body.identifier || '');
  if(!requesterKey) return { ok:false, message:'No encontré tu sesión. Inicia sesión otra vez.' };
  if(!targetKey) return { ok:false, message:'Busca primero el usuario que quieres agregar.' };
  const requester = findSocialUser_(requesterKey);
  const target = findSocialUser_(targetKey);
  if(!requester || !isVerified_(requester)) return { ok:false, message:'Tu cuenta debe estar verificada para agregar amigos.' };
  if(!target || !isVerified_(target)) return { ok:false, message:'No encontramos un usuario verificado con ese dato.' };
  if(String(requester.user_id || '') === String(target.user_id || '')) return { ok:false, message:'No puedes agregarte a ti mismo.' };
  const usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  ensureFriendCodeForRow_(usersSh, requester); ensureFriendCodeForRow_(usersSh, target);
  const friendsSh = sheet_(URBIS_AUTH.SHEET_FRIENDS, baseHeaders_().friends);
  const rows = getRows_(friendsSh);
  const exists = rows.find(r => {
    const a=String(r.requester_user_id||''); const b=String(r.target_user_id||'');
    const estado = String(r.estado||'').toLowerCase();
    return estado !== 'cancelado' && estado !== 'rechazado' &&
      ((a===String(requester.user_id)&&b===String(target.user_id))||(a===String(target.user_id)&&b===String(requester.user_id)));
  });
  if(exists) return { ok:true, status:exists.estado || 'pendiente', message:'Ya existe una solicitud o amistad con este usuario.', user:publicSocialUser_(target) };
  appendObject_(friendsSh, { friend_id:newId_('fr'), requester_user_id:requester.user_id || '', requester_usuario:requester.usuario || '', requester_friend_code:normalizeFriendCode_(requester.friend_code), target_user_id:target.user_id || '', target_usuario:target.usuario || '', target_friend_code:normalizeFriendCode_(target.friend_code), estado:'pendiente', fecha_solicitud:nowIso_(), fecha_respuesta:'', origen:'app_social', nota:'' }, baseHeaders_().friends);
  log_({ identificador:requester.usuario || requester.user_id || '', correo:requester.correo || '', usuario:requester.usuario || '', cedula:requester.cedula_numero || requester.cedula || '', telefono:requester.telefono || '', accion:'social_add_friend', resultado:'pending', motivo:'solicitud enviada a ' + (target.usuario || target.friend_code || target.user_id || '') });
  return { ok:true, status:'pendiente', message:'Solicitud enviada. Tu amigo recibirá una notificación para aceptarla.', user:publicSocialUser_(target) };
}

function socialNotifications_(body) {
  var user = findSocialUser_(bodyIdentifier_(body));
  if (!user || !isVerified_(user)) return { ok: true, notifications: [] };
  var friendsSh = sheet_(URBIS_AUTH.SHEET_FRIENDS, baseHeaders_().friends);
  var rows = getRows_(friendsSh);
  var pending = rows.filter(function(r) {
    return String(r.target_user_id || '') === String(user.user_id || '') &&
           (r.estado || 'pendiente') === 'pendiente';
  });
  var usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  var allUsers = getRows_(usersSh).filter(function(r) { return !isDeletedUser_(r); });
  var notifications = pending.map(function(r) {
    var req = allUsers.find(function(u) { return String(u.user_id || '') === String(r.requester_user_id || ''); }) || {};
    return {
      type: 'friend_request',
      friend_id: r.friend_id || '',
      user: {
        usuario: req.usuario || userUsername_(req) || r.requester_usuario || '',
        display_name: ((req.nombres || '') + ' ' + (req.apellidos || '')).trim() || r.requester_usuario || '',
        nombres: req.nombres || r.requester_usuario || '',
        nombre_completo: req.nombre_completo || '',
        friend_code: r.requester_friend_code || req.friend_code || ''
      }
    };
  });
  return { ok: true, notifications: notifications };
}

function socialRespondFriend_(body) {
  var user = findSocialUser_(bodyIdentifier_(body));
  if (!user || !isVerified_(user)) return { ok: false, message: 'Debes iniciar sesión para responder solicitudes.' };
  var friendId = String(body.friend_id || '').trim();
  var response = String(body.response || '').trim().toLowerCase();
  if (!friendId) return { ok: false, message: 'Falta el ID de la solicitud.' };
  if (response !== 'accepted' && response !== 'rejected') return { ok: false, message: 'Respuesta inválida.' };
  var friendsSh = sheet_(URBIS_AUTH.SHEET_FRIENDS, baseHeaders_().friends);
  var rows = getRows_(friendsSh);
  var found = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].friend_id || '') === friendId && String(rows[i].target_user_id || '') === String(user.user_id || '')) {
      found = rows[i]; break;
    }
  }
  if (!found) return { ok: false, message: 'No encontramos esa solicitud o ya fue respondida.' };
  var nuevoEstado = response === 'accepted' ? 'aceptado' : 'rechazado';
  setCellByHeader_(friendsSh, found._row, 'estado', nuevoEstado);
  setCellByHeader_(friendsSh, found._row, 'fecha_respuesta', nowIso_());
  // Buscar el username real del solicitante en la tabla de usuarios (en caso de que requester_usuario esté vacío o mal)
  var usersSh2 = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  var allUsersR = getRows_(usersSh2).filter(function(r) { return !isDeletedUser_(r); });
  var reqUser = allUsersR.find(function(u) { return String(u.user_id||'') === String(found.requester_user_id||''); }) || {};
  var realRequesterUsuario = reqUser.usuario || userUsername_(reqUser) || found.requester_usuario || '';
  // Si el username real difiere del almacenado, actualizar la fila
  if (realRequesterUsuario && realRequesterUsuario !== found.requester_usuario) {
    setCellByHeader_(friendsSh, found._row, 'requester_usuario', realRequesterUsuario);
  }
  log_({ identificador: user.usuario || user.user_id || '', correo: user.correo || '', usuario: user.usuario || '', cedula: user.cedula_numero || user.cedula || '', telefono: user.telefono || '', accion: 'social_respond_friend', resultado: nuevoEstado, motivo: (response === 'accepted' ? 'aceptó' : 'rechazó') + ' solicitud de ' + realRequesterUsuario });
  return { ok: true, status: nuevoEstado, requester_usuario: realRequesterUsuario, requester_user_id: found.requester_user_id || '', message: response === 'accepted' ? '¡Amigo agregado!' : 'Solicitud rechazada.' };
}

function socialRemoveFriend_(body) {
  var user = findSocialUser_(bodyIdentifier_(body));
  if (!user || !isVerified_(user)) return { ok: false, message: 'Debes iniciar sesión.' };
  var targetUsuario = String(body.target_usuario || '').trim().toLowerCase();
  if (!targetUsuario) return { ok: false, message: 'Falta el usuario a eliminar.' };
  var friendsSh = sheet_(URBIS_AUTH.SHEET_FRIENDS, baseHeaders_().friends);
  var rows = getRows_(friendsSh);
  var removed = 0;
  var yo = String(user.usuario || '').toLowerCase();
  rows.forEach(function(r) {
    var a = String(r.requester_usuario || '').toLowerCase();
    var b = String(r.target_usuario || '').toLowerCase();
    if ((a === yo && b === targetUsuario) || (a === targetUsuario && b === yo)) {
      setCellByHeader_(friendsSh, r._row, 'estado', 'eliminado');
      removed++;
    }
  });
  return { ok: true, removed: removed, message: removed > 0 ? 'Amigo eliminado.' : 'No se encontró la amistad.' };
}

function socialCancelRequest_(body) {
  var user = findSocialUser_(bodyIdentifier_(body));
  if (!user || !isVerified_(user)) return { ok: false, message: 'Debes iniciar sesión.' };
  var targetId = String(body.target_user_id || '').trim();
  var friendsSh = sheet_(URBIS_AUTH.SHEET_FRIENDS, baseHeaders_().friends);
  var rows = getRows_(friendsSh);
  var removed = 0;
  rows.forEach(function(r) {
    var esRequeridor = String(r.requester_user_id || '') === String(user.user_id || '');
    var esTarget = !targetId || String(r.target_user_id || '') === targetId;
    var esPendiente = String(r.estado || '') === 'pendiente';
    if (esRequeridor && esTarget && esPendiente) {
      setCellByHeader_(friendsSh, r._row, 'estado', 'cancelado');
      removed++;
    }
  });
  return { ok: true, removed: removed, message: removed > 0 ? 'Solicitud cancelada.' : 'No había solicitud pendiente.' };
}

function socialGetFriends_(body) {
  var user = findSocialUser_(bodyIdentifier_(body));
  if (!user || !isVerified_(user)) return { ok: false, friends: [], message: 'Debes iniciar sesión.' };
  var friendsSh = sheet_(URBIS_AUTH.SHEET_FRIENDS, baseHeaders_().friends);
  var rows = getRows_(friendsSh);
  var userId = String(user.user_id || '');
  var usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  var allUsers = getRows_(usersSh).filter(function(r) { return !isDeletedUser_(r); });
  var friends = [];
  rows.forEach(function(r) {
    if (String(r.estado || '') !== 'aceptado') return;
    var friendUserId = '';
    var friendUsuario = '';
    if (String(r.requester_user_id || '') === userId) {
      friendUserId = String(r.target_user_id || '');
      friendUsuario = String(r.target_usuario || '');
    } else if (String(r.target_user_id || '') === userId) {
      friendUserId = String(r.requester_user_id || '');
      friendUsuario = String(r.requester_usuario || '');
    } else { return; }
    // Buscar datos actuales del amigo en la tabla de usuarios
    var friendRow = allUsers.find(function(u) { return String(u.user_id || '') === friendUserId; }) || {};
    var realUsuario = friendRow.usuario || userUsername_(friendRow) || friendUsuario || '';
    if (!realUsuario || realUsuario === 'sin_usuario') return; // no mostrar amigos sin username válido
    friends.push({
      user_id: friendUserId,
      usuario: realUsuario,
      nombre_completo: friendRow.nombre_completo || ((friendRow.nombres || '') + ' ' + (friendRow.apellidos || '')).trim() || realUsuario,
      ciudad: friendRow.ciudad || friendRow.ciudad_corregimiento || '',
      friend_code: normalizeFriendCode_(friendRow.friend_code) || '',
      avatar: String(friendRow.avatar || '').trim()
    });
  });
  return { ok: true, friends: friends };
}

function socialRepairUsername_(body) {
  var userId = normText_(body.user_id || body.current_user_id || '');
  if (!userId) return { ok: false, message: 'Falta user_id.' };
  var usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  var allUsers = getRows_(usersSh).filter(function(r) { return !isDeletedUser_(r); });
  var user = allUsers.find(function(r) { return String(r.user_id || '') === userId; });
  if (!user) return { ok: false, message: 'Cuenta no encontrada.' };
  var currentUsuario = normUser_(user.usuario || '');
  if (currentUsuario && currentUsuario !== 'sin_usuario') {
    return { ok: true, fixed: false, usuario: currentUsuario, user: userPayload_(user), message: 'El usuario ya es válido.' };
  }
  // Derivar username desde email
  var email = user.correo || user.email || '';
  var newUsuario = '';
  if (email && email.indexOf('@') !== -1) newUsuario = normUser_(email.split('@')[0]);
  if (!newUsuario || newUsuario === 'sin_usuario') {
    var nom = normUser_((user.nombres || '') + (user.apellidos || '').slice(0, 3));
    newUsuario = nom || '';
  }
  if (!newUsuario || newUsuario === 'sin_usuario') return { ok: false, message: 'No se pudo derivar un usuario válido. Escríbele al admin.' };
  // Verificar disponibilidad; si tomado, añadir sufijo
  var taken = allUsers.some(function(r) { return r._row !== user._row && normUser_(r.usuario || '') === newUsuario; });
  if (taken) newUsuario = newUsuario + String(Math.floor(Math.random() * 90 + 10));
  setCellByHeader_(usersSh, user._row, 'usuario', newUsuario);
  user.usuario = newUsuario;
  // También actualizar la fila de amigos_urbis pendiente si existe
  try {
    var friendsSh = sheet_(URBIS_AUTH.SHEET_FRIENDS, baseHeaders_().friends);
    getRows_(friendsSh).forEach(function(r) {
      if (String(r.requester_user_id || '') === userId && normUser_(r.requester_usuario || '') === 'sin_usuario') {
        setCellByHeader_(friendsSh, r._row, 'requester_usuario', newUsuario);
      }
      if (String(r.target_user_id || '') === userId && normUser_(r.target_usuario || '') === 'sin_usuario') {
        setCellByHeader_(friendsSh, r._row, 'target_usuario', newUsuario);
      }
    });
  } catch(e) {}
  log_({ identificador: newUsuario, correo: user.correo || '', usuario: newUsuario, cedula: user.cedula_numero || '', telefono: user.telefono || '', accion: 'social_repair_username', resultado: 'fixed', motivo: 'sin_usuario → ' + newUsuario });
  return { ok: true, fixed: true, usuario: newUsuario, user: userPayload_(user), message: '¡Usuario reparado a @' + newUsuario + '!' };
}

function log_(data) {
  try {
    appendObject_(sheet_(URBIS_AUTH.SHEET_LOGS, baseHeaders_().logs), {
      log_id:newId_('log'), identificador:data.identificador || '', correo:data.correo || '', usuario:data.usuario || '', cedula:data.cedula || '', telefono:data.telefono || '',
      accion:data.accion || '', resultado:data.resultado || '', fecha:nowIso_(), motivo:data.motivo || ''
    }, baseHeaders_().logs);
  } catch (err) { console.error('Error guardando log', err); }
}

function sendCodeEmail_(email, code, subject, intro) {
  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#10233f">' +
        '<h2 style="color:#00B68D;margin-bottom:4px;">URBIS</h2>' +
        '<p>' + intro + '</p>' +
        '<div style="font-size:30px;font-weight:900;letter-spacing:5px;background:#f2fbff;border-radius:14px;padding:14px 18px;display:inline-block;color:#00B68D">' + code + '</div>' +
        '<p>Este código expira en ' + URBIS_AUTH.CODE_TTL_MINUTES + ' minutos.</p>' +
        '<p>Si no solicitaste este código, puedes ignorar este mensaje.</p>' +
      '</div>'
  });
}

// ════════════════════════════════════════════════════════════════════════════
// HERRAMIENTA DE ADMIN: borrar TODO rastro de una cuenta (ejecutar manualmente).
// Cómo usar: en el editor de Apps Script, selecciona "URBIS_borrarCuenta" en el
// menú de funciones (arriba) y pulsa ▶ Ejecutar. Borra de usuarios_registro,
// verificacion_email, registro_logs y amigos_urbis cualquier fila que contenga
// alguno de los valores de BUSCAR (usuario, correo o cédula).
// ════════════════════════════════════════════════════════════════════════════
function URBIS_borrarCuenta() {
  // ▼▼▼ EDITA AQUÍ: pon el usuario, el correo y la cédula de la cuenta a borrar.
  //     Puedes dejar varios; borra cualquier fila que contenga alguno (mín. 5 chars).
  var BUSCAR = [
    '1127588433'                    // cédula registrada que impide nuevo registro
  ];
  // ▲▲▲ (borra las líneas de ejemplo que no conozcas)
  var hojas = [URBIS_AUTH.SHEET_USERS, URBIS_AUTH.SHEET_VERIFY, URBIS_AUTH.SHEET_LOGS, URBIS_AUTH.SHEET_FRIENDS];
  var total = 0;
  hojas.forEach(function(nombre){ total += borrarFilasPorValor_(nombre, BUSCAR); });
  Logger.log('URBIS_borrarCuenta: ' + total + ' fila(s) borradas para [' + BUSCAR.join(', ') + ']');
  return 'Borradas ' + total + ' fila(s).';
}

function borrarFilasPorValor_(nombreHoja, valores) {
  var sh = ss_().getSheetByName(nombreHoja);
  if (!sh) return 0;
  var datos = sh.getDataRange().getValues();
  var vals = valores.map(function(v){ return String(v).trim().toLowerCase(); }).filter(Boolean);
  var borradas = 0;
  for (var i = datos.length - 1; i >= 1; i--) { // de abajo hacia arriba, salta encabezados
    var fila = datos[i].map(function(c){ return String(c).trim().toLowerCase(); });
    var match = vals.some(function(v){
      return fila.some(function(c){ return c === v || (v.length >= 5 && c.indexOf(v) !== -1); });
    });
    if (match) { sh.deleteRow(i + 1); borradas++; }
  }
  return borradas;
}

// ════════════════════════════════════════════════════════════════════════
// CHAT 1-a-1 entre usuarios (estilo Facebook). Hoja "chat_urbis".
// Columnas: conv_id | de | para | texto | fecha
// ════════════════════════════════════════════════════════════════════════
function chatSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName('chat_urbis');
  if (!sh) { sh = ss.insertSheet('chat_urbis'); sh.appendRow(['conv_id', 'de', 'para', 'texto', 'fecha']); }
  return sh;
}
function chatSan_(u) { return String(u || '').toLowerCase().replace(/[^a-z0-9._-]/g, ''); }
function chatConvId_(a, b) { return [chatSan_(a), chatSan_(b)].sort().join('__'); }
function chatFechaIso_(v) { return (v instanceof Date) ? v.toISOString() : String(v || ''); }

function chatSend_(body) {
  var de = normText_(body.de || body.from || '');
  var para = normText_(body.para || body.to || '');
  var texto = String(body.texto || body.text || '').trim();
  if (!de || !para) return { ok: false, message: 'Faltan remitente o destinatario.' };
  if (!texto) return { ok: false, message: 'El mensaje está vacío.' };
  if (texto.length > 1500) texto = texto.slice(0, 1500);
  var sh = chatSheet_();
  sh.appendRow([chatConvId_(de, para), de, para, texto, nowIso_()]);
  return { ok: true };
}

function chatFetch_(body) {
  var yo = normText_(body.usuario || body.de || '');
  var otro = normText_(body.otro || body.para || '');
  if (!yo || !otro) return { ok: false, mensajes: [] };
  var cid = chatConvId_(yo, otro);
  var sh = chatSheet_();
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, mensajes: [] };
  var datos = sh.getRange(2, 1, last - 1, 5).getValues();
  var out = [];
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]) === cid) {
      out.push({ de: String(datos[i][1]), para: String(datos[i][2]), texto: String(datos[i][3]), fecha: chatFechaIso_(datos[i][4]) });
    }
  }
  out.sort(function(a, b) { return new Date(a.fecha) - new Date(b.fecha); });
  if (out.length > 300) out = out.slice(out.length - 300);
  return { ok: true, mensajes: out };
}

function chatInbox_(body) {
  var yo = normText_(body.usuario || '');
  if (!yo) return { ok: false, conversaciones: [] };
  var yoL = yo.toLowerCase();
  var sh = chatSheet_();
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, conversaciones: [] };
  var datos = sh.getRange(2, 1, last - 1, 5).getValues();
  var porOtro = {};
  for (var i = 0; i < datos.length; i++) {
    var de = String(datos[i][1]), para = String(datos[i][2]);
    var deL = de.toLowerCase(), paraL = para.toLowerCase();
    var otro = '';
    if (deL === yoL) otro = para; else if (paraL === yoL) otro = de; else continue;
    if (!otro) continue;
    var fecha = chatFechaIso_(datos[i][4]);
    var k = otro.toLowerCase();
    if (!porOtro[k] || new Date(fecha) > new Date(porOtro[k].fecha)) {
      porOtro[k] = { otro: otro, ultimo: String(datos[i][3]), de: de, fecha: fecha };
    }
  }
  var arr = [];
  for (var key in porOtro) { if (porOtro.hasOwnProperty(key)) arr.push(porOtro[key]); }
  arr.sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });
  return { ok: true, conversaciones: arr };
}

// ════════════════════════════════════════════════════════════════════════
// AVATARES como parte de la IDENTIDAD del usuario (columna 'avatar' en
// usuarios_registro). Escrito por Apps Script (sin el bug de columnas de
// SheetDB) y devuelto junto con los datos del amigo. Soporta futuros avatares
// (variedad / de pago): el id es libre, ej "avatar-01", "avatar-premium-gold".
// ════════════════════════════════════════════════════════════════════════
function setAvatar_(body) {
  var avatar = String(body.avatar || body.avatar_id || body.avatarId || '').trim();
  if (!avatar) return { ok: false, message: 'Falta el avatar.' };
  var ident = normText_(body.user_id || body.current_user_id || body.usuario || body.username ||
    body.identifier || body.identificador || body.friend_code || body.correo || body.email || '');
  if (!ident) return { ok: false, message: 'Falta identificar al usuario.' };
  var user = findSocialUser_(ident);
  if (!user) user = pickBestUser_(findUsersByIdentifier_(ident));
  if (!user) return { ok: false, message: 'Usuario no encontrado.' };
  var usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  setCellByHeader_(usersSh, user._row, 'avatar', avatar);
  return { ok: true, avatar: avatar, usuario: user.usuario || '' };
}

/* Verificación de identidad de una cuenta que ya existe (nivel 1 -> nivel 2).
   El registro pide lo mínimo; los nombres, el documento y el celular llegan
   después, cuando la persona va a subir una foto o a publicar un hecho del
   conflicto armado. Escribe SOLO en la hoja de usuarios: estos datos no pueden
   acabar en la hoja de reportes, que se lee en abierto desde la aplicación. */
function verifyIdentity_(body) {
  var ident = normText_(body.usuario || body.username || body.user_id ||
    body.identifier || body.correo || body.email || '');
  if (!ident) return { ok: false, message: 'Falta identificar al usuario.' };

  var nombres = normText_(body.nombres || '');
  var apellidos = normText_(body.apellidos || '');
  var cedula = String(body.cedula_numero || body.cedula || '').replace(/\D/g, '');
  var telefono = String(body.telefono || body.celular || '').replace(/\D/g, '');
  if (nombres.length < 2) return { ok: false, message: 'Faltan los nombres.' };
  if (apellidos.length < 2) return { ok: false, message: 'Faltan los apellidos.' };
  if (cedula.length < 5) return { ok: false, message: 'Falta el número de documento.' };
  if (telefono.length < 7) return { ok: false, message: 'Falta el número de celular.' };

  var user = findSocialUser_(ident);
  if (!user) user = pickBestUser_(findUsersByIdentifier_(ident));
  if (!user) return { ok: false, message: 'Usuario no encontrado.' };

  // Un documento ya usado por OTRA cuenta se rechaza: si dos cuentas comparten
  // cédula, la verificación deja de significar nada.
  var usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  var duplicado = false;
  getRows_(usersSh).forEach(function (r) {
    if (isDeletedUser_(r)) return;
    if (String(r._row) === String(user._row)) return;
    var c = String(r.cedula_numero || r.cedula || '').replace(/\D/g, '');
    if (c && c === cedula) duplicado = true;
  });
  if (duplicado) return { ok: false, message: 'Ese número de documento ya está registrado en otra cuenta de URBIS.' };

  setCellByHeader_(usersSh, user._row, 'nombres', nombres);
  setCellByHeader_(usersSh, user._row, 'apellidos', apellidos);
  setCellByHeader_(usersSh, user._row, 'nombre_completo', (nombres + ' ' + apellidos).trim());
  setCellByHeader_(usersSh, user._row, 'cedula', cedula);
  setCellByHeader_(usersSh, user._row, 'cedula_numero', cedula);
  setCellByHeader_(usersSh, user._row, 'telefono', telefono);
  setCellByHeader_(usersSh, user._row, 'nivel_cuenta', 'verificado');
  setCellByHeader_(usersSh, user._row, 'fecha_verificacion_identidad', new Date().toISOString());
  return { ok: true, nivel_cuenta: 'verificado', usuario: user.usuario || '' };
}

function getAvatars_(body) {
  var usuarios = body.usuarios || body.users || [];
  if (!Array.isArray(usuarios)) usuarios = String(usuarios || '').split(',');
  var wanted = {};
  usuarios.forEach(function(u) { var k = normUser_(u); if (k) wanted[k] = ''; });
  var usersSh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  getRows_(usersSh).forEach(function(r) {
    if (isDeletedUser_(r)) return;
    var u = userUsername_(r);
    if (u && wanted.hasOwnProperty(u) && r.avatar) wanted[u] = String(r.avatar).trim();
  });
  return { ok: true, avatares: wanted };
}

// ════════════════════════════════════════════════════════════════════════
// MINIJUEGOS · Tabla de líderes GLOBAL (todos los jugadores, sean amigos o no).
// Hoja "puntajes_urbis": usuario | juego | puntos | fecha. Una fila por (usuario,juego).
// Soporta varios minijuegos a futuro vía el campo 'juego'.
// ════════════════════════════════════════════════════════════════════════
function puntajeSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName('puntajes_urbis');
  if (!sh) { sh = ss.insertSheet('puntajes_urbis'); sh.appendRow(['usuario', 'juego', 'puntos', 'fecha']); }
  return sh;
}
function setPuntaje_(body) {
  var usuario = normText_(body.usuario || body.user || '');
  var juego = normText_(body.juego || body.game || 'arcade').toLowerCase();
  var puntos = parseInt(body.puntos || body.score || body.points || 0, 10) || 0;
  if (!usuario) return { ok: false, message: 'Falta usuario.' };
  if (puntos < 0) puntos = 0;
  var sh = puntajeSheet_();
  var last = sh.getLastRow();
  var datos = last >= 2 ? sh.getRange(2, 1, last - 1, 4).getValues() : [];
  var uL = usuario.toLowerCase();
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]).toLowerCase() === uL && String(datos[i][1]).toLowerCase() === juego) {
      var prev = parseInt(datos[i][2], 10) || 0;
      var fin = Math.max(prev, puntos); // nunca baja
      sh.getRange(i + 2, 3).setValue(fin);
      sh.getRange(i + 2, 4).setValue(nowIso_());
      return { ok: true, usuario: usuario, juego: juego, puntos: fin };
    }
  }
  sh.appendRow([usuario, juego, puntos, nowIso_()]);
  return { ok: true, usuario: usuario, juego: juego, puntos: puntos };
}
// Escribe una fila (reporte/evento) DIRECTO en la hoja de reportes (primera pestaña),
// columnas reales tipo|lat|lng|descripcion|fecha. Apps Script escribe por posición =>
// sin el bug de columnas corridas que tiene el POST de SheetDB en este endpoint.
// lat/lng se guardan como TEXTO para que Google Sheets no reinterprete el punto decimal.
// Encuentra la hoja de REPORTES (la que usa SheetDB): la pestaña cuyos encabezados
// son tipo|lat|lng|descripcion|fecha. Robusto sin importar el orden/nombre de pestañas.
function reportesSheet_() {
  var ss = ss_();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    if (sh.getLastColumn() < 5) continue;
    var hdr = sh.getRange(1, 1, 1, 5).getValues()[0].map(function(h){ return String(h || '').trim().toLowerCase(); });
    if (hdr[0] === 'tipo' && hdr[1] === 'lat' && hdr[2] === 'lng' && hdr[3] === 'descripcion' && hdr[4] === 'fecha') return sh;
  }
  return ss.getSheets()[0];
}
function dbWrite_(body) {
  var fila = body.fila || body.data || body;
  if (Array.isArray(fila)) fila = fila[0] || {};
  var tipo = (fila.tipo != null) ? String(fila.tipo) : '';
  var lat = (fila.lat != null) ? String(fila.lat) : '';
  var lng = (fila.lng != null) ? String(fila.lng) : '';
  var descripcion = (fila.descripcion != null) ? String(fila.descripcion) : '';
  var fecha = (fila.fecha != null) ? String(fila.fecha) : nowIso_();
  var sh = reportesSheet_();
  var row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, 5).setNumberFormat('@'); // forzar TEXTO en las 5 columnas
  sh.getRange(row, 1, 1, 5).setValues([[tipo, lat, lng, descripcion, fecha]]);
  return { ok: true, row: row };
}
// Lee TODAS las filas de reportes (reemplaza el GET de SheetDB). Devuelve objetos por encabezado.
/* Posiciones del correo y la cédula del autor dentro del campo `descripcion`,
   que es una cadena separada por " | ". Se calculan como BASE_OFFSET+5 y +6,
   donde BASE_OFFSET = 6 + 37 usos = 43 (ver URBIS_SLOTS en js/04). Si algún día
   cambia el número de usos, hay que cambiarlos aquí también — por eso, además
   de estas dos posiciones, se limpia por patrón cualquier cosa con forma de
   correo, que es la fuga que más duele si el número se desalinea. */
var DESC_IDX_CORREO_AUTOR = 48;
var DESC_IDX_CEDULA_AUTOR = 49;

/* La hoja de reportes se lee en abierto: el mapa tiene que poder cargarse sin
   sesión, y eso es correcto — los reportes SON públicos. Lo que no puede salir
   de aquí son los datos personales de quien reporta.

   Hasta la v574 cada fila llevaba el correo y la cédula del autor, así que
   cualquiera con la URL del script podía descargarse el padrón entero con una
   sola petición. La aplicación los escondía en pantalla ("Solo Admin"), pero
   eso es la interfaz: el dato viajaba igual.

   Se limpian aquí, en el servidor, y no solo en el cliente que dejó de
   escribirlos: los reportes ya publicados siguen teniendo el dato en la hoja, y
   la hoja no se toca (queda el histórico para el dueño, que sí puede abrirla).
   Quien pregunta por la API recibe la fila sin esos campos. */
function _limpiarDatosPersonales_(desc) {
  var texto = String(desc == null ? '' : desc);
  if (!texto) return texto;
  var partes = texto.split(' | ');
  if (partes.length > DESC_IDX_CORREO_AUTOR) partes[DESC_IDX_CORREO_AUTOR] = '';
  if (partes.length > DESC_IDX_CEDULA_AUTOR) partes[DESC_IDX_CEDULA_AUTOR] = '';
  texto = partes.join(' | ');
  // Red de seguridad: un correo escrito en cualquier otro sitio (una nota, un
  // campo desalineado) tampoco debe salir.
  return texto.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '');
}

/* Las peticiones al administrador son correo interno: van en la misma tabla
   que todo lo demás, así que sin esto cualquiera que leyera la respuesta en
   crudo vería lo que escribieron los demás. Se tapa el texto y la captura para
   quien no sea su autor ni tenga el permiso de leer el buzón; el nombre y el
   estado quedan, que es lo que necesita el contador.

   Quién pregunta se resuelve PEREZOSAMENTE, al toparse con la primera
   petición: db_read es la llamada más caliente de la aplicación y no merece
   una lectura extra de la hoja de usuarios cuando no hay nada que tapar. */
function _taparPeticion_(desc) {
  var p = String(desc || '').split('~~~');
  return [p[0] || '', '', '', p[3] || 'nueva'].join('~~~');
}
function dbRead_(body) {
  var sh = reportesSheet_();
  var last = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (last < 2 || lastCol < 1) return { ok: true, data: [] };
  var values = sh.getRange(1, 1, last, lastCol).getValues();
  var headers = values[0].map(function(h){ return String(h || '').trim(); });
  var quien, resuelto = false;
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var v = values[i][c];
      v = (v instanceof Date) ? v.toISOString() : v;
      if (headers[c].toLowerCase() === 'descripcion') v = _limpiarDatosPersonales_(v);
      obj[headers[c]] = v;
    }
    var t = String(obj.tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (t.indexOf('peticion') !== -1) {
      if (!resuelto) { quien = _quienEscribe_(body || {}); resuelto = true; }
      var autor = normUser_(String(obj.descripcion || '').split('~~~')[0] || '');
      var mia = quien && autor && autor === quien.usuario;
      if (!mia && !_puede_(quien, 'peticiones')) obj.descripcion = _taparPeticion_(obj.descripcion);
    }
    out.push(obj);
  }
  return { ok: true, data: out };
}
function _dbColIdx_(headers, col) { for (var i = 0; i < headers.length; i++) { if (headers[i].toLowerCase() === String(col).toLowerCase()) return i; } return -1; }
function _dbMatch_(cell, value, col) {
  if (String(cell) === String(value)) return true;
  if (String(col).toLowerCase() === 'lat' || String(col).toLowerCase() === 'lng') { var a = Number(cell), b = Number(value); if (!isNaN(a) && !isNaN(b) && a === b) return true; }
  return false;
}
// Actualiza filas que coincidan (col=value) con los campos en set{} (edita/archiva/mueve reportes).
function dbUpdate_(body) {
  var col = String(body.col || body.columna || 'lat');
  var value = (body.value != null) ? body.value : body.valor;
  var set = body.set || body.fields || {};
  if (value == null || value === '') return { ok: false, message: 'Falta value' };
  var sh = reportesSheet_();
  var last = sh.getLastRow(); var lastCol = sh.getLastColumn();
  if (last < 2) return { ok: true, updated: 0 };
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h || '').trim(); });
  var colIdx = _dbColIdx_(headers, col);
  if (colIdx < 0) return { ok: false, message: 'Columna no existe: ' + col };
  var data = sh.getRange(2, 1, last - 1, lastCol).getValues();
  var descIdx = _dbColIdx_(headers, 'descripcion');
  var tipoIdx = _dbColIdx_(headers, 'tipo');
  var quien = _quienEscribe_(body);
  var updated = 0, negados = 0;
  for (var i = 0; i < data.length; i++) {
    if (!_dbMatch_(data[i][colIdx], value, col)) continue;
    if (tipoIdx >= 0 && _esFilaTextoDeAlguien_(data[i][tipoIdx])) {
      var descTexto = descIdx >= 0 ? String(data[i][descIdx] || '') : '';
      var puedeTexto = _esAutorDelTexto_(descTexto, quien);
      if (!puedeTexto && set.descripcion != null) {
        puedeTexto = _soloDenunciasEnTexto_(data[i][tipoIdx], descTexto, String(set.descripcion));
        // Denunciar el comentario de otro, sí. Decidir si se esconde o vuelve,
        // solo con el permiso de moderar.
        if (puedeTexto &&
            _esDecisionDeModerador_(String(descTexto).split('~~~')[2] || '',
                                    String(set.descripcion).split('~~~')[2] || '') &&
            !_puede_(quien, 'moderar')) puedeTexto = false;
      }
      if (!puedeTexto) { negados++; continue; }
      Object.keys(set).forEach(function(k){
        var ci = _dbColIdx_(headers, k);
        if (ci >= 0) { var c3 = sh.getRange(i + 2, ci + 1); c3.setNumberFormat('@'); c3.setValue(String(set[k])); }
      });
      updated++;
      continue;
    }
    if (tipoIdx >= 0 && _esFilaMeta_(data[i][tipoIdx])) {
      Object.keys(set).forEach(function(k){
        var ci = _dbColIdx_(headers, k);
        if (ci >= 0) { var c2 = sh.getRange(i + 2, ci + 1); c2.setNumberFormat('@'); c2.setValue(String(set[k])); }
      });
      updated++;
      continue;
    }

    // ¿Puede esta petición cambiar ESTA fila? El dueño y el administrador,
    // todo; cualquier otro, solo las casillas comunitarias (confirmar que el
    // reporte sigue vigente, apoyarlo, denunciarlo). Nadie puede reescribir el
    // texto, la foto o la ubicación de un reporte ajeno.
    var descVieja = descIdx >= 0 ? String(data[i][descIdx] || '') : '';
    // Sin descripción en el cambio, quien no es el autor no toca nada: podría
    // estar moviendo el punto (lat/lng) o cambiando su categoría.
    if (!_autorizaCambioReporte_(descVieja, set.descripcion != null ? String(set.descripcion) : null, quien)) {
      negados++; continue;
    }

    Object.keys(set).forEach(function(k){
      var ci = _dbColIdx_(headers, k);
      if (ci >= 0) { var cell = sh.getRange(i + 2, ci + 1); cell.setNumberFormat('@'); cell.setValue(String(set[k])); }
    });
    updated++;
  }
  if (!updated && negados) {
    return { ok: false, message: 'No puedes editar un reporte que no es tuyo. Si es tuyo, vuelve a iniciar sesión.' };
  }
  return { ok: true, updated: updated };
}
// Borra filas que coincidan (col=value).
/* Borrar es lo único que no tiene vuelta atrás, así que aquí no hay excepción
   comunitaria: o eres el autor del reporte, o eres el administrador. Y hay que
   demostrarlo con un token, no diciéndolo. */
function dbDelete_(body) {
  var col = String(body.col || body.columna || 'lat');
  var value = (body.value != null) ? body.value : body.valor;
  if (value == null || value === '') return { ok: false, message: 'Falta value' };
  var quien = _quienEscribe_(body);
  var sh = reportesSheet_();
  var last = sh.getLastRow(); var lastCol = sh.getLastColumn();
  if (last < 2) return { ok: true, deleted: 0 };
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h || '').trim(); });
  var colIdx = _dbColIdx_(headers, col);
  if (colIdx < 0) return { ok: false, message: 'Columna no existe: ' + col };
  var descIdx = _dbColIdx_(headers, 'descripcion');
  var tipoIdx = _dbColIdx_(headers, 'tipo');
  var data = sh.getRange(2, 1, last - 1, lastCol).getValues();
  var deleted = 0, negados = 0, sinSesion = false;
  for (var i = data.length - 1; i >= 0; i--) {
    if (!_dbMatch_(data[i][colIdx], value, col)) continue;
    // Un comentario o una petición los borra quien los escribió, o el
    // administrador. Antes entraban por la rama de abajo y los borraba
    // cualquiera.
    if (tipoIdx >= 0 && _esFilaTextoDeAlguien_(data[i][tipoIdx])) {
      if (!quien) { sinSesion = true; negados++; continue; }
      var descT = descIdx >= 0 ? String(data[i][descIdx] || '') : '';
      // Su autor, el dueño, o quien tenga delegado el permiso de retirar
      // contenido. Retirar NO es editar: con este permiso se puede quitar un
      // comentario inapropiado, no reescribirlo.
      if (!_esAutorDelTexto_(descT, quien) && !_puede_(quien, 'eliminar')) { negados++; continue; }
      sh.deleteRow(i + 2); deleted++; continue;
    }
    // Filas de fontanería (amistades, GPS, avatares): como estaban.
    if (tipoIdx >= 0 && _esFilaMeta_(data[i][tipoIdx])) { sh.deleteRow(i + 2); deleted++; continue; }
    if (!quien) { sinSesion = true; negados++; continue; }
    var desc = descIdx >= 0 ? String(data[i][descIdx] || '') : '';
    if (!_esAutorDelReporte_(desc, quien) && !_puede_(quien, 'eliminar')) { negados++; continue; }
    sh.deleteRow(i + 2); deleted++;
  }
  if (!deleted && negados) {
    return { ok: false, message: sinSesion
      ? 'Vuelve a iniciar sesión para poder borrar lo que publicaste.'
      : 'Solo puedes borrar lo que publicaste tú.' };
  }
  return { ok: true, deleted: deleted };
}

// ═══════════════════════════════════════════════════════════════════════
// REPARTO DE PERMISOS · solo el dueño de URBIS
// El dueño no entrega su cuenta: entrega tareas. Cada llamada aquí exige que
// quien la hace sea el dueño, y ninguna puede tocar la fila del dueño — ni
// siquiera la suya propia —, para que un permiso mal dado no pueda dejar a
// URBIS sin quien lo administre.
// ═══════════════════════════════════════════════════════════════════════
function _duenoOnada_(body) {
  var quien = _quienEscribe_(body);
  if (!quien) return { error: { ok:false, message:'Vuelve a iniciar sesión.' } };
  if (!quien.esDueno) return { error: { ok:false, message:'Solo el dueño de URBIS puede repartir permisos.' } };
  return { quien: quien };
}
function _esFilaDelDueno_(user) {
  return normEmail_(user.correo || '') === normEmail_(URBIS_AUTH.ADMIN_EMAIL);
}
/* Lo que se devuelve de otra persona: su nombre público y sus permisos. Nunca
   su cédula, su teléfono ni su correo completo — repartir permisos no es
   motivo para abrir la ficha de nadie. */
function _fichaPermisos_(user) {
  var correo = String(user.correo || '');
  var tapado = correo ? correo.charAt(0) + '•••@' + (correo.split('@')[1] || '') : '';
  return {
    usuario: user.usuario || '',
    nombre: user.nombre_completo || ((user.nombres || '') + ' ' + (user.apellidos || '')).trim(),
    correo_tapado: tapado,
    friend_code: normalizeFriendCode_(user.friend_code) || '',
    es_dueno: _esFilaDelDueno_(user),
    permisos: _leerPermisos_(user.permisos)
  };
}

// Quién tiene algo delegado ahora mismo.
function permList_(body) {
  var g = _duenoOnada_(body); if (g.error) return g.error;
  var sh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  var out = [];
  getRows_(sh).forEach(function (r) {
    if (isDeletedUser_(r)) return;
    if (!_leerPermisos_(r.permisos).length) return;
    out.push(_fichaPermisos_(r));
  });
  return { ok:true, catalogo: URBIS_PERMISOS.slice(), equipo: out };
}

// Buscar a alguien por @usuario, correo o ID URBIS antes de darle permisos.
function permFind_(body) {
  var g = _duenoOnada_(body); if (g.error) return g.error;
  var ident = normText_(body.identificador || body.usuario || body.correo || body.q || '');
  if (!ident) return { ok:false, message:'Escribe el usuario, el correo o el ID URBIS.' };
  var user = findSocialUser_(ident) || pickBestUser_(findUsersByIdentifier_(ident));
  if (!user) return { ok:false, message:'No encontré esa cuenta. Revisa que esté escrita igual que al registrarse.' };
  if (!isVerified_(user)) return { ok:false, message:'Esa cuenta todavía no confirmó su correo.' };
  return { ok:true, catalogo: URBIS_PERMISOS.slice(), persona: _fichaPermisos_(user) };
}

// Dar o quitar. Llega la lista COMPLETA de lo que esa persona debe tener:
// así quitar es tan simple como volver a mandar la lista sin ese permiso.
function permSet_(body) {
  var g = _duenoOnada_(body); if (g.error) return g.error;
  var ident = normText_(body.identificador || body.usuario || body.correo || '');
  if (!ident) return { ok:false, message:'Falta decir a quién.' };
  var user = findSocialUser_(ident) || pickBestUser_(findUsersByIdentifier_(ident));
  if (!user) return { ok:false, message:'No encontré esa cuenta.' };
  if (_esFilaDelDueno_(user)) {
    return { ok:false, message:'La cuenta dueña de URBIS ya tiene todo y no se puede cambiar desde aquí.' };
  }
  var pedidos = body.permisos;
  if (typeof pedidos === 'string') pedidos = pedidos.split(',');
  if (!pedidos) pedidos = [];
  var limpios = [];
  for (var i = 0; i < URBIS_PERMISOS.length; i++) {
    for (var j = 0; j < pedidos.length; j++) {
      if (normLower_(pedidos[j]) === URBIS_PERMISOS[i]) { limpios.push(URBIS_PERMISOS[i]); break; }
    }
  }
  var sh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  setCellByHeader_(sh, user._row, 'permisos', limpios.join(','));
  // No se le cierra la sesión: el permiso se comprueba contra la hoja en cada
  // escritura, así que empieza a valer ya. Su teléfono se entera en cuanto
  // vuelva a abrir la aplicación (perm_mine).
  log_({ identificador: user.usuario || ident, correo: user.correo || '', usuario: user.usuario || '',
              accion: 'permisos', resultado: 'ok', motivo: limpios.join(',') || '(sin permisos)' });
  return { ok:true, persona: _fichaPermisos_(findSocialUser_(ident) || user), permisos: limpios };
}

/* Lo que YO tengo. La aplicación la llama al abrirse para no depender de lo
   que quedó guardado en el teléfono cuando se inició sesión: si el dueño da o
   quita un permiso hoy, se nota sin tener que volver a entrar. */
function permMine_(body) {
  var quien = _quienEscribe_(body);
  if (!quien) return { ok:true, permisos: [], es_dueno:false, es_admin:false };
  return { ok:true, permisos: quien.permisos || [], es_dueno: !!quien.esDueno, es_admin: !!quien.esAdmin,
           catalogo: URBIS_PERMISOS.slice() };
}

// ═══════════════════════════════════════════════════════════════════════
// URBIS Pro City · Carpetas compartidas de mapeo
// Cada carpeta vive en su propia hoja ("ProCityCarpetas"): id (código corto
// de 6 caracteres para invitar), nombre, creador, miembros (JSON array de
// usuarios) y fecha. Los PUNTOS no se mueven a otra hoja: el cliente etiqueta
// el punto con el código de la carpeta dentro de su propia columna
// "descripcion" (un campo extra al final que nada más lee), así que aquí solo
// se administra el catálogo de carpetas y su membresía.
// ═══════════════════════════════════════════════════════════════════════
function procityFoldersSheet_() {
  return sheet_('ProCityCarpetas', ['id', 'nombre', 'creador', 'miembros', 'fecha']);
}

function procityFolderCreate_(body) {
  var nombre = normText_(body.nombre || body.name);
  var usuario = normUser_(body.usuario || body.creador || body.user);
  if (!nombre) return { ok: false, message: 'Falta el nombre de la carpeta' };
  if (!usuario) return { ok: false, message: 'Falta el usuario' };
  var sh = procityFoldersSheet_();
  var id = Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  appendObject_(sh, {
    id: id, nombre: nombre, creador: usuario,
    miembros: JSON.stringify([usuario]), fecha: nowIso_()
  }, ['id', 'nombre', 'creador', 'miembros', 'fecha']);
  return { ok: true, folder: { id: id, nombre: nombre, creador: usuario, miembros: [usuario] } };
}

// Une por código (self-join) O agrega directo a un amigo (invitación desde
// la lista de contactos) — es la misma operación en ambos casos: agregar
// `miembro` a la carpeta `id` si no está ya.
function procityFolderAddMember_(body) {
  var id = normText_(body.id || body.codigo || body.folder_id).toUpperCase();
  var miembro = normUser_(body.miembro || body.usuario || body.user);
  if (!id || !miembro) return { ok: false, message: 'Falta el código de la carpeta o el usuario' };
  var sh = procityFoldersSheet_();
  var rows = getRows_(sh);
  var found = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id || '').toUpperCase() === id) { found = rows[i]; break; }
  }
  if (!found) return { ok: false, message: 'No existe una carpeta con ese código' };
  var miembros = [];
  try { miembros = JSON.parse(found.miembros || '[]'); } catch (e) { miembros = []; }
  if (miembros.indexOf(miembro) < 0) miembros.push(miembro);
  setCellByHeader_(sh, found._row, 'miembros', JSON.stringify(miembros));
  return { ok: true, folder: { id: found.id, nombre: found.nombre, creador: found.creador, miembros: miembros } };
}

// Quita a alguien de la carpeta. No deja quitar al creador (para que la
// carpeta no quede huérfana ni un miembro pueda expulsar a quien la creó).
function procityFolderRemoveMember_(body) {
  var id = normText_(body.id || body.codigo || body.folder_id).toUpperCase();
  var miembro = normUser_(body.miembro || body.usuario || body.user);
  if (!id || !miembro) return { ok: false, message: 'Falta el código de la carpeta o el usuario' };
  var sh = procityFoldersSheet_();
  var rows = getRows_(sh);
  var found = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id || '').toUpperCase() === id) { found = rows[i]; break; }
  }
  if (!found) return { ok: false, message: 'No existe una carpeta con ese código' };
  if (normUser_(found.creador) === miembro) return { ok: false, message: 'No puedes quitar al creador de la carpeta' };
  var miembros = [];
  try { miembros = JSON.parse(found.miembros || '[]'); } catch (e) { miembros = []; }
  miembros = miembros.filter(function (u) { return u !== miembro; });
  setCellByHeader_(sh, found._row, 'miembros', JSON.stringify(miembros));
  return { ok: true, folder: { id: found.id, nombre: found.nombre, creador: found.creador, miembros: miembros } };
}

// Cambia el nombre de la carpeta (el código/id NO cambia, solo el nombre
// visible). Cualquier miembro puede renombrarla, no solo el creador.
function procityFolderRename_(body) {
  var id = normText_(body.id || body.codigo || body.folder_id).toUpperCase();
  var nombre = normText_(body.nombre || body.name);
  if (!id || !nombre) return { ok: false, message: 'Falta el código de la carpeta o el nombre nuevo' };
  var sh = procityFoldersSheet_();
  var rows = getRows_(sh);
  var found = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id || '').toUpperCase() === id) { found = rows[i]; break; }
  }
  if (!found) return { ok: false, message: 'No existe una carpeta con ese código' };
  setCellByHeader_(sh, found._row, 'nombre', nombre);
  var miembros = [];
  try { miembros = JSON.parse(found.miembros || '[]'); } catch (e) { miembros = []; }
  return { ok: true, folder: { id: found.id, nombre: nombre, creador: found.creador, miembros: miembros } };
}

function procityFolderListMine_(body) {
  var usuario = normUser_(body.usuario || body.user);
  if (!usuario) return { ok: true, folders: [] };
  var sh = procityFoldersSheet_();
  var rows = getRows_(sh);
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var miembros = [];
    try { miembros = JSON.parse(rows[i].miembros || '[]'); } catch (e) { miembros = []; }
    if (miembros.indexOf(usuario) >= 0) {
      out.push({ id: rows[i].id, nombre: rows[i].nombre, creador: rows[i].creador, miembros: miembros });
    }
  }
  return { ok: true, folders: out };
}

function leaderboard_(body) {
  var juego = normText_(body.juego || body.game || 'arcade').toLowerCase();
  var limit = parseInt(body.limit || 100, 10) || 100;
  var sh = puntajeSheet_();
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, juego: juego, tabla: [] };
  var datos = sh.getRange(2, 1, last - 1, 4).getValues();
  var tabla = [];
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][1]).toLowerCase() !== juego) continue;
    var u = String(datos[i][0]).trim();
    if (!u) continue;
    tabla.push({ usuario: u, puntos: parseInt(datos[i][2], 10) || 0 });
  }
  tabla.sort(function(a, b) { return b.puntos - a.puntos; });
  if (tabla.length > limit) tabla = tabla.slice(0, limit);
  return { ok: true, juego: juego, tabla: tabla };
}

// ════════════════════════════════════════════════════════════════════════════
// ▼▼▼ NUEVO (V163) · CUENTAS DE SISTEMA SIN CORREO ▼▼▼
// ════════════════════════════════════════════════════════════════════════════
//
// QUÉ RESUELVE
// ------------
// 1) Crear "UrbisNoticia" (la cuenta que firma las alertas de desastres) y
//    rotar la del administrador, SIN registro por correo ni código.
// 2) Sacar las contraseñas del archivo público js/00-config.js. Hoy cualquiera
//    puede leerlas abriendo:
//      https://jesmen21.github.io/mapa-comunitario/js/00-config.js
//    Aquí la contraseña se guarda como HASH (SHA-256 + salt) en tu hoja
//    privada, con el mismo hashPassword_() que ya usa el resto del sistema.
//
// CÓMO SE USA (una sola vez)
// --------------------------
//  1. Selecciona arriba la función  crearCuentasSistemaUrbis
//  2. Cambia las dos contraseñas marcadas con CAMBIA_ESTO.
//  3. Pulsa Ejecutar y revisa Ver > Registro de ejecución.
//  4. Entra en la app con ese usuario y contraseña para comprobarlo.
//  5. Vuelve a poner CAMBIA_ESTO y guarda, para no dejarlas escritas.
//
// POR QUÉ FUNCIONA SIN CORREO
// ---------------------------
// La cuenta se marca estado_cuenta='activo' y email_verificado='si', que es lo
// que isVerified_() exige. Entra por el MISMO loginUser_() que todos: no se
// añade ningún atajo ni excepción al camino de autenticación.
//
// NOTA DE SEGURIDAD (actualizada en la v575)
// ------------------------------------------
// Esto elimina la PUBLICACIÓN de las contraseñas, que era el agujero más grave.
// Lo segundo —que borrar y editar se autorizaran solo en el navegador— ya está
// cerrado: el login entrega un token de sesión y dbUpdate_/dbDelete_ comprueban
// aquí quién pide el cambio y si es suyo (ver "QUIÉN PUEDE ESCRIBIR EN LA BASE").
//
// LO QUE SIGUE ABIERTO, dicho sin adornos:
//  · Los contadores comunitarios (apoyos, validaciones, denuncias) los puede
//    escribir cualquiera, porque confirmar o denunciar tiene que funcionar sin
//    cuenta. Alguien podría inflar los suyos o borrarse denuncias. Se cierra con
//    acciones propias que solo sepan SUMAR, no reescribir.
//  · Crear reportes (dbWrite_) sigue abierto: es lo que hace la aplicación. El
//    freno contra el abuso es la moderación, no la autenticación.
//  · Las filas de fontanería (amistades, GPS, avatares, chat) se quedaron como
//    estaban; cerrarlas con la misma regla rompería lo social sin proteger nada
//    que se vea en el mapa.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Nombra ADMINISTRADOR a una cuenta que YA existe, sin tocar su contraseña.
 *
 * `crearCuentasSistemaUrbis` sirve para crear cuentas nuevas, pero le cambia la
 * contraseña a la cuenta si ya existía. Para ascender a alguien que se registró
 * normalmente —con su correo, su código de verificación y su clave— hace falta
 * esto: cambia el rol y nada más.
 *
 * CÓMO SE USA
 *   1. Escribe abajo el usuario (o el correo) de la cuenta.
 *   2. Arriba, en el selector de funciones, elige  hacerAdminUrbis
 *   3. Pulsa Ejecutar y mira Ver > Registro de ejecución.
 *   4. Esa persona debe CERRAR SESIÓN y volver a entrar: el rol viaja en la
 *      sesión, y la que tiene abierta se emitió cuando todavía era ciudadana.
 *
 * Para quitarle el permiso a alguien, cambia 'admin' por 'citizen'.
 */
function hacerAdminUrbis() {
  // ── EDITA AQUÍ ────────────────────────────────────────────────────────────
  var CUENTA = 'urbisprocity';   // usuario o correo
  var ROL    = 'admin';          // 'admin' para dar, 'citizen' para quitar
  // ──────────────────────────────────────────────────────────────────────────

  var ident = normText_(CUENTA);
  if (!ident) { Logger.log('Falta escribir la cuenta.'); return; }
  var user = findSocialUser_(ident) || pickBestUser_(findUsersByIdentifier_(ident));
  if (!user) { Logger.log('No se encontró la cuenta "' + CUENTA + '".'); return; }

  var sh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  setCellByHeader_(sh, user._row, 'rol_solicitado', ROL);
  // Se revoca la sesión abierta: si no, el navegador seguiría usando el token
  // viejo y el permiso nuevo no se notaría hasta que caducara.
  setCellByHeader_(sh, user._row, 'session_token', '');
  setCellByHeader_(sh, user._row, 'session_expira', '');
  Logger.log('"' + (user.usuario || CUENTA) + '" (fila ' + user._row + ') ahora tiene rol: ' + ROL +
             '. Debe cerrar sesión y volver a entrar.');
}

function crearCuentasSistemaUrbis() {
  // ── EDITA AQUÍ ────────────────────────────────────────────────────────────
  // Usa contraseñas largas (12+ caracteres). No reutilices las de otros sitios.
  var CUENTAS = [
    { usuario: 'urbisnoticia', nombre: 'URBIS Noticias',      password: 'CAMBIA_ESTO_1' },
    { usuario: 'urbisadmin',   nombre: 'Administrador URBIS', password: 'CAMBIA_ESTO_2' }
  ];
  // ──────────────────────────────────────────────────────────────────────────

  CUENTAS.forEach(function (c) {
    if (String(c.password).indexOf('CAMBIA_ESTO') === 0) {
      Logger.log('SALTADA "' + c.usuario + '": todavía tiene la contraseña de ejemplo.');
      return;
    }
    if (String(c.password).length < 8) {
      Logger.log('SALTADA "' + c.usuario + '": la contraseña debe tener mínimo 8 caracteres.');
      return;
    }
    var r = upsertCuentaSistemaUrbis_(c.usuario, c.nombre, c.password);
    Logger.log(r.creada
      ? ('CREADA "' + r.usuario + '" (fila ' + r.fila + ')')
      : ('ACTUALIZADA "' + r.usuario + '" (fila ' + r.fila + ') — contraseña cambiada'));
  });
  Logger.log('Listo. Entra en la app con el usuario y la contraseña que pusiste.');
}

/**
 * Crea o actualiza una cuenta de sistema en la hoja de usuarios.
 * Queda PRE-VERIFICADA (no pide código) y con rol admin, para que entre por el
 * mismo loginUser_() que el resto — sin atajos en el navegador.
 */
function upsertCuentaSistemaUrbis_(usuarioRaw, nombreRaw, passwordRaw) {
  var usuario = normUser_(usuarioRaw);
  var nombre = String(nombreRaw || usuario);
  var password = String(passwordRaw || '');
  if (!usuario) throw new Error('Falta el nombre de usuario.');

  var sh = sheet_(URBIS_AUTH.SHEET_USERS, baseHeaders_().users);
  var valores = sh.getDataRange().getValues();
  var encabezados = valores[0].map(function (h) { return String(h || '').trim(); });
  var colUsuario = encabezados.indexOf('usuario');
  if (colUsuario < 0) throw new Error('La hoja de usuarios no tiene la columna "usuario".');

  // ¿Ya existe? (si sí, solo se le cambia la contraseña; no se duplica)
  var fila = -1;
  for (var i = 1; i < valores.length; i++) {
    if (normUser_(valores[i][colUsuario]) === usuario) { fila = i + 1; break; }
  }

  var creada = false;
  if (fila < 0) {
    // appendRow con un array VACÍO lanza error en Apps Script; se añade una
    // celda vacía para crear la fila y luego se rellena por encabezado.
    sh.appendRow(['']);
    fila = sh.getLastRow();
    creada = true;
  }

  // Salt propio y estable, para que loginUser_() lo reproduzca igual.
  var userId = 'sys_' + usuario;
  var salt = userId;

  var campos = {
    user_id: userId,
    usuario: usuario,
    nombres: nombre,
    apellidos: '',
    nombre_completo: nombre,
    correo: '',                 // cuenta de sistema: sin correo asociado
    rol_solicitado: 'admin',
    estado_cuenta: 'activo',    // isVerified_() acepta estado_cuenta = activo
    email_verificado: 'si',     // ...y también email_verificado = si
    password_hash: hashPassword_(password, salt),
    password_salt: salt,
    codigo_verificacion: '',
    codigo_expira_en: '',
    acepta_terminos: 'si',
    observaciones_admin: 'Cuenta de sistema URBIS (crearCuentasSistemaUrbis)'
  };
  if (creada) campos.fecha_registro = nowIso_();
  campos.fecha_verificacion = nowIso_();

  Object.keys(campos).forEach(function (h) {
    if (encabezados.indexOf(h) >= 0) setCellByHeader_(sh, fila, h, campos[h]);
  });

  // Código de amigo, para que la cuenta funcione igual en Social URBIS.
  try {
    var rows = getRows_(sh);
    var creada2 = rows.filter(function (r) { return r._row === fila; })[0];
    if (creada2) ensureFriendCodeForRow_(sh, creada2);
  } catch (e) {}

  return { usuario: usuario, fila: fila, creada: creada };
}

/**
 * Comprobación opcional: verifica que la contraseña quedó bien guardada,
 * SIN mostrarla. Devuelve solo true/false en el registro.
 * Escribe los dos valores, ejecuta, mira el registro y vuelve a vaciarlos.
 */
function probarCuentaSistemaUrbis() {
  var usuario = '';   // ej: 'urbisnoticia'
  var password = '';  // la que acabas de poner
  if (!usuario || !password) {
    Logger.log('Escribe usuario y contraseña dentro de la función para probar.');
    return;
  }
  var out = loginUser_('', password, usuario, usuario);
  Logger.log('Login correcto: ' + (out && out.ok === true));
  if (out && !out.ok) Logger.log('Motivo: ' + out.message);
}
