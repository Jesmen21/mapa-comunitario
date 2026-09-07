# La regla que falta en el servidor: cada quien edita SU emprendimiento

Escrito contra el Apps Script real de URBIS (`URBIS Auth Backend`, V163). Los
nombres de función y de variable de aquí abajo son los que ya están en ese
archivo: se pega, no se traduce.

## Qué problema cierra

Desde la v786 el administrador de URBIS crea un emprendimiento y le entrega el
control a una persona: el negocio guarda `duenio` (su usuario) y esa persona
recibe el permiso `vitrina`.

Desde la v787 el cliente lo hace cumplir: los ocho caminos que escriben
preguntan de quién es el negocio antes de tocarlo.

**Pero el candado es del cliente.** El servidor ya mira el permiso `vitrina`
—eso está desde antes—, y el permiso dice «esta persona administra ALGÚN
emprendimiento»: no dice cuál. Con dos personas delegadas, cada una puede
escribirle al negocio de la otra mandando el `db_update` a mano, sin pasar por
la pantalla. Esta es la regla que lo cierra donde de verdad importa.

## Por qué se puede hacer

El token de sesión ya viaja en **todas** las escrituras (`js/12-spa-ui.js`:
`urbisGuardarFila`, `urbisDBUpdate`, `urbisDBDelete` mandan `session_token`), y
`_quienEscribe_(body)` ya lo convierte en `{usuario, correo, esAdmin, esDueno,
permisos}`. El servidor ya sabe quién escribe; solo le falta preguntarse
*sobre qué*.

## Cómo se reconoce una fila de la vitrina

| Tipo                        | Dónde está el id del negocio                          |
|-----------------------------|-------------------------------------------------------|
| `🛍️ Emprendimiento URBIS`   | dentro del sobre `VITRINA_URBIS:` de `descripcion`     |
| `🛍️ Portafolio URBIS`       | en la columna `lat`                                    |
| `🛍️ Logo URBIS`             | en la columna `lat`                                    |

`_esFilaVitrina_(tipo)` ya distingue las tres de un reporte normal. Lo que falta
es distinguir **un negocio de otro**, y eso solo sale de leer el sobre.

## Quién puede qué

|                                   | Dueño / admin URBIS | Quien lo administra | Cualquier otro |
|-----------------------------------|---------------------|---------------------|----------------|
| Crear el emprendimiento           | sí                  | no                  | no             |
| Editar su ficha (texto, teléfono) | sí                  | **solo el suyo**    | no             |
| Cambiar `duenio` o `estado`       | sí                  | no                  | no             |
| Portafolio y logo                 | sí                  | **solo los suyos**  | no             |
| Borrar el emprendimiento entero   | sí                  | no                  | no             |

Es la regla que pidió el dueño: por ahora URBIS da de alta el emprendimiento y
se lo entrega a alguien; esa persona lo mantiene, no lo publica ni lo traspasa.

---

## Bloque 1 · Los ayudantes

Pegar **justo debajo de `_esFilaVitrina_(tipo)`** (queda al lado de lo que ya
habla de la vitrina, y así se lee seguido).

```js
/* ── Vitrina: de quién es cada emprendimiento ─────────────────────────────
   El permiso 'vitrina' dice que alguien administra ALGÚN emprendimiento; no
   dice cuál. El dueño de cada ficha va dentro del sobre VITRINA_URBIS: como
   `duenio`. Las filas de portafolio y de logo no llevan sobre: llevan el id
   del negocio en la columna `lat`, así que su dueño es el del negocio. */
var VIT_PREFIJO = 'VITRINA_URBIS:';

function _vitSobre_(descripcion) {
  // El sobre puede traer campos pegados detrás con " | " (igual que en js/13i).
  var crudo = String(descripcion || '').split(' | ')[0];
  if (crudo.indexOf(VIT_PREFIJO) !== 0) return null;
  try { return JSON.parse(decodeURIComponent(crudo.slice(VIT_PREFIJO.length))) || null; }
  catch (e) { return null; }
}
// normUser_ ya quita la arroba y baja a minúsculas: el mismo aseo que hace el
// cliente al guardar el `duenio`.
function _vitUsuario_(v) { return normUser_(v); }

// Solo la ficha del negocio. Portafolio y logo NO son esto.
function _esFilaNegocio_(tipo) {
  var t = String(tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t.indexOf('emprendimiento') !== -1;
}

/* Dueño del negocio con ese id, buscándolo entre las filas ya leídas. */
function _vitDuenoPorId_(data, tipoIdx, descIdx, id) {
  var buscado = String(id || '').trim();
  if (!buscado || tipoIdx < 0 || descIdx < 0) return null;
  for (var i = 0; i < data.length; i++) {
    if (!_esFilaNegocio_(data[i][tipoIdx])) continue;
    var s = _vitSobre_(data[i][descIdx]);
    if (s && String(s.id || '').trim() === buscado) return _vitUsuario_(s.duenio);
  }
  return null;   // no existe ese negocio
}

/* Igual, pero yendo a la hoja: dbWrite_ no lee las filas. */
function _vitDuenoDeNegocio_(id) {
  if (!String(id || '').trim()) return null;
  var sh = reportesSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var data = sh.getRange(2, 1, last - 1, lastCol).getValues();
  return _vitDuenoPorId_(data, _dbColIdx_(headers, 'tipo'), _dbColIdx_(headers, 'descripcion'), id);
}

/* ¿Puede `quien` tocar ESTA fila de la vitrina? Se llama después de
   _puede_(quien,'vitrina'), no en su lugar. */
function _vitPuedeConFila_(quien, fila, tipoIdx, latIdx, descIdx, data) {
  if (!quien) return false;
  if (quien.esAdmin || quien.esDueno) return true;          // URBIS, todo
  var dueno;
  if (_esFilaNegocio_(fila[tipoIdx])) {
    var s = _vitSobre_(descIdx >= 0 ? fila[descIdx] : '');
    dueno = s ? _vitUsuario_(s.duenio) : null;
  } else {
    dueno = _vitDuenoPorId_(data, tipoIdx, descIdx, latIdx >= 0 ? fila[latIdx] : '');
  }
  // Ficha sin dueño asignado (las de antes de la v786): solo URBIS.
  return !!dueno && dueno === quien.usuario;
}

/* Qué NO puede cambiar quien solo administra: cuál es el negocio, de quién es,
   y si está en el mapa. Traspasar y publicar son de URBIS; el texto, las fotos
   y el teléfono son de quien lo administra. */
function _vitCambioPermitido_(quien, descVieja, descNueva) {
  if (!quien) return false;
  if (quien.esAdmin || quien.esDueno) return true;
  var a = _vitSobre_(descVieja), b = _vitSobre_(descNueva);
  if (!a || !b) return false;    // dejar de ser un sobre es reescribir la fila
  return String(a.id || '') === String(b.id || '') &&
         _vitUsuario_(a.duenio) === _vitUsuario_(b.duenio) &&
         String(a.estado || '') === String(b.estado || '');
}
```

---

## Bloque 2 · `dbWrite_` · crear

En `dbWrite_`, **sustituir** el bloque que ya está:

```js
  if (_esFilaVitrina_(tipo)) {
    var quienV = _quienEscribe_(body);
    if (!_puede_(quienV, 'vitrina')) {
      return { ok: false, message: 'La vitrina de emprendimientos la publica el equipo URBIS.' };
    }
  }
```

por este:

```js
  if (_esFilaVitrina_(tipo)) {
    var quienV = _quienEscribe_(body);
    if (!_puede_(quienV, 'vitrina')) {
      return { ok: false, message: 'La vitrina de emprendimientos la publica el equipo URBIS.' };
    }
    if (!(quienV.esAdmin || quienV.esDueno)) {
      // Dar de alta un emprendimiento es de URBIS: el administrador lo crea y
      // se lo entrega a alguien. Con el permiso a secas solo se añade
      // portafolio o logo, y solo al negocio propio.
      if (_esFilaNegocio_(tipo)) {
        return { ok: false, message: 'Los emprendimientos los da de alta URBIS.' };
      }
      if (_vitDuenoDeNegocio_((fila.lat != null) ? String(fila.lat) : '') !== quienV.usuario) {
        return { ok: false, message: 'Ese emprendimiento no es tuyo: solo lo edita quien URBIS designó.' };
      }
    }
  }
```

---

## Bloque 3 · `dbUpdate_` · editar

Tres retoques en la misma función.

**1.** Junto a `var descIdx` / `var tipoIdx`, añadir una línea:

```js
  var latIdx = _dbColIdx_(headers, 'lat');
```

**2.** Al lado de `var updated = 0, negados = 0;`, añadir la bandera del aviso:

```js
  var negadoVit = false;
```

**3.** **Sustituir** la rama de la vitrina, que ahora es:

```js
    if (tipoIdx >= 0 && _esFilaVitrina_(data[i][tipoIdx])) {
      if (!_puede_(quien, 'vitrina')) { negados++; continue; }
```

por:

```js
    if (tipoIdx >= 0 && _esFilaVitrina_(data[i][tipoIdx])) {
      if (!_puede_(quien, 'vitrina')) { negados++; continue; }
      if (!_vitPuedeConFila_(quien, data[i], tipoIdx, latIdx, descIdx, data)) {
        negadoVit = true; negados++; continue;
      }
      // Se puede editar la ficha, no traspasarla ni publicarla.
      if (_esFilaNegocio_(data[i][tipoIdx]) && set.descripcion != null &&
          !_vitCambioPermitido_(quien, descIdx >= 0 ? data[i][descIdx] : '', String(set.descripcion))) {
        negadoVit = true; negados++; continue;
      }
```

(el resto de la rama —el `Object.keys(set).forEach`, el `updated++` y el
`continue`— se queda tal cual).

**4.** Y el aviso del final, para que no diga «reporte» cuando era un negocio:

```js
  if (!updated && negados) {
    return { ok: false, message: negadoVit
      ? 'Ese emprendimiento no es tuyo: solo lo edita quien URBIS designó.'
      : 'No puedes editar un reporte que no es tuyo. Si es tuyo, vuelve a iniciar sesión.' };
  }
```

---

## Bloque 4 · `dbDelete_` · borrar

**Sustituir** la rama de la vitrina, que ahora es:

```js
    if (tipoIdx >= 0 && _esFilaVitrina_(data[i][tipoIdx])) {
      if (!quien) { sinSesion = true; negados++; continue; }
      if (!_puede_(quien, 'vitrina')) { negados++; continue; }
      sh.deleteRow(i + 2); deleted++; continue;
    }
```

por:

```js
    if (tipoIdx >= 0 && _esFilaVitrina_(data[i][tipoIdx])) {
      if (!quien) { sinSesion = true; negados++; continue; }
      if (!_puede_(quien, 'vitrina')) { negados++; continue; }
      // Borrar el emprendimiento entero es de URBIS. Quien lo administra borra
      // su portafolio y su logo, y solo los suyos.
      if (_esFilaNegocio_(data[i][tipoIdx]) && !(quien.esAdmin || quien.esDueno)) { negados++; continue; }
      if (!_vitPuedeConFila_(quien, data[i], tipoIdx, _dbColIdx_(headers, 'lat'), descIdx, data)) {
        negados++; continue;
      }
      sh.deleteRow(i + 2); deleted++; continue;
    }
```

---

## Cómo comprobar que quedó puesto

Sin tocar Google y sin gastar cuentas de verdad: se exporta el Apps Script a un
archivo **de fuera del repositorio** (lleva el secreto de administración dentro,
no puede entrar aquí) y se le pasa la ruta a la prueba:

```bash
node herramientas/probar-regla-vitrina.js /ruta/de/fuera/urbis-auth.gs
```

Carga las funciones del script, les pone una hoja de mentira delante con dos
emprendimientos —el de @uno y el de @dos— y hace las quince preguntas. Contra el
servidor de hoy contesta **8/15**: se cuelan las siete de la tabla de arriba.
Con el parche puesto, 15/15.

Y a mano, con dos cuentas delegadas —@uno con su negocio, @dos con el suyo— y sin tocar
la interfaz, mandando la petición a mano al Apps Script:

1. **@uno edita lo suyo** → `{ok:true, updated:1}`.
2. **@uno edita el de @dos** → `{ok:false, message:'Ese emprendimiento no es
   tuyo…'}` y la hoja intacta.
3. **@uno se pone de `duenio` en su propio sobre** → negado (cambió `duenio`).
4. **@uno publica su negocio** (`estado: 'visible'`) → negado (cambió `estado`).
5. **@uno crea un emprendimiento nuevo** (`db_write`, tipo Emprendimiento) →
   `{ok:false, message:'Los emprendimientos los da de alta URBIS.'}`.
6. **@uno añade un producto al negocio de @dos** (`db_write`, tipo Portafolio,
   `lat` = el id ajeno) → negado.
7. **@uno añade un producto al suyo** → `{ok:true}`.
8. **El administrador, todo lo anterior** → pasa.

Y en el navegador, la batería de siempre: `node pruebas/correr.js tvitrina`
sigue en verde, porque nada de esto cambia el cliente.

## Qué NO cambia

* Los reportes normales, los comentarios, las peticiones y la fontanería
  (amistades, GPS, avatares) siguen exactamente con la regla que tenían: todo
  esto vive dentro de las ramas que ya existían para `_esFilaVitrina_`.
* Leer sigue abierto: la vitrina se ve sin sesión, como el mapa.
* `perm_find` / `perm_set` no se tocan. Repartir el permiso `vitrina` sigue
  siendo solo del dueño de URBIS, y sigue siendo el paso previo a que alguien
  pueda administrar algo.
* El cliente (`js/13i-vitrina.js`) no cambia. Su candado se queda: es lo que
  hace que la pantalla no ofrezca botones que el servidor va a rechazar.
