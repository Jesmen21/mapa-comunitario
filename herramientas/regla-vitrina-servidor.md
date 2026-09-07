# La regla que falta en el servidor: cada quien edita SU emprendimiento

## Qué problema cierra

Desde la v786 el administrador de URBIS crea un emprendimiento y le entrega el
control a una persona: el negocio guarda `duenio` (su usuario) y esa persona
recibe el permiso `vitrina`.

Desde la v787 el cliente lo hace cumplir: los ocho caminos que escriben
preguntan de quién es el negocio antes de tocarlo.

**Pero el candado es del cliente.** El Apps Script mira el permiso `vitrina` y
no distingue un emprendimiento de otro: alguien con el permiso y con
conocimientos técnicos puede escribirle a un negocio ajeno saltándose la
pantalla. Esta es la regla que lo cierra donde de verdad importa.

## Por qué se puede hacer

El token de sesión ya viaja en **todas** las escrituras (`js/12-spa-ui.js`:
`urbisGuardarFila`, `urbisDBUpdate`, `urbisDBDelete` mandan `session_token`).
El servidor ya sabe quién escribe; solo le falta preguntarse *sobre qué*.

## Cómo se reconoce una fila de la vitrina

| Tipo                        | Dónde está el id del negocio                          |
|-----------------------------|-------------------------------------------------------|
| `🛍️ Emprendimiento URBIS`   | dentro del sobre `VITRINA_URBIS:` de `descripcion`     |
| `🛍️ Portafolio URBIS`       | en la columna `lat`                                    |
| `🛍️ Logo URBIS`             | en la columna `lat`                                    |

El sobre es `VITRINA_URBIS:` + `encodeURIComponent(JSON.stringify({...}))`, y
adentro están `id`, `estado` y `duenio`.

## La regla, para pegar en el Apps Script

```javascript
// ── Vitrina: cada quien escribe sobre SU emprendimiento ───────────────────
// Se llama desde db_write, db_update y db_delete, antes de tocar la hoja.
// `usuario` es quien firma la petición (el que ya se resuelve del token);
// `esAdmin` es lo que el script ya calcula para el panel.

var VIT_NEGOCIO = '🛍️ Emprendimiento URBIS';
var VIT_ITEM    = '🛍️ Portafolio URBIS';
var VIT_LOGO    = '🛍️ Logo URBIS';
var VIT_PREFIJO = 'VITRINA_URBIS:';

function vitSobre_(descripcion) {
  var crudo = String(descripcion || '').split(' | ')[0];
  if (crudo.indexOf(VIT_PREFIJO) !== 0) return null;
  try { return JSON.parse(decodeURIComponent(crudo.slice(VIT_PREFIJO.length))); }
  catch (e) { return null; }
}

// Busca en la hoja el negocio con ese id y devuelve su dueño ('' si no tiene).
function vitDuenoDelNegocio_(hoja, id) {
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][COL_TIPO]) !== VIT_NEGOCIO) continue;
    var o = vitSobre_(filas[i][COL_DESCRIPCION]);
    if (o && String(o.id) === String(id)) {
      return String(o.duenio || '').trim().toLowerCase();
    }
  }
  return null;   // no existe ese negocio
}

/* Devuelve '' si la escritura está permitida, o el motivo del rechazo.
   `fila` es la que se va a escribir (db_write) o la que ya está en la hoja
   (db_update / db_delete, resuelta por col=value antes de llamar aquí). */
function vitPuedeEscribir_(hoja, fila, usuario, esAdmin) {
  var tipo = String(fila[COL_TIPO] || '');
  if (tipo !== VIT_NEGOCIO && tipo !== VIT_ITEM && tipo !== VIT_LOGO) return '';

  // Crear, publicar, pausar y eliminar un negocio: solo el administrador.
  // (El estado vive en el sobre; cambiarlo es una edición del negocio.)
  if (tipo === VIT_NEGOCIO) {
    var o = vitSobre_(fila[COL_DESCRIPCION]);
    if (!o) return 'Fila de vitrina con sobre ilegible.';
    if (esAdmin) return '';
    var duenio = String(o.duenio || '').trim().toLowerCase();
    if (!duenio || duenio !== String(usuario || '').trim().toLowerCase()) {
      return 'Ese emprendimiento no es tuyo.';
    }
    return '';
  }

  // Portafolio y logo: cuelgan del id del negocio, que va en `lat`.
  if (esAdmin) return '';
  var duenoNegocio = vitDuenoDelNegocio_(hoja, fila[COL_LAT]);
  if (duenoNegocio === null) return 'Ese emprendimiento no existe.';
  if (!duenoNegocio || duenoNegocio !== String(usuario || '').trim().toLowerCase()) {
    return 'Ese emprendimiento no es tuyo.';
  }
  return '';
}
```

Y en cada acción, antes de escribir:

```javascript
var motivo = vitPuedeEscribir_(hoja, fila, usuario, esAdmin);
if (motivo) return json({ ok: false, message: motivo });
```

`COL_TIPO`, `COL_LAT` y `COL_DESCRIPCION` son los índices que el script ya
use para esas columnas — no los inventes aquí, reutiliza los suyos.

## Tres detalles que importan

1. **Crear un negocio sigue siendo del administrador.** En `db_write` con tipo
   `🛍️ Emprendimiento URBIS`, un delegado solo puede escribir una fila cuyo
   sobre lo nombre a él; en la práctica eso solo pasa al editar, porque crear
   no le sale en pantalla. Si quieres cerrarlo del todo, exige `esAdmin` para
   cualquier `db_write` de ese tipo.

2. **`db_delete` por `lat`** borra el portafolio entero de un negocio. Es lo
   que hace el administrador al eliminarlo. Con la regla puesta, un delegado
   solo puede borrar por `lat` si ese negocio es suyo.

3. **El estado (`borrador`/`visible`/`pausado`) viaja en el sobre.** Si quieres
   que el delegado edite su ficha pero NO pueda publicarse solo, compara el
   estado nuevo con el que ya estaba y rechaza el cambio cuando no sea
   administrador. El cliente ya no le enseña el botón; esto lo haría cierto.

## Cómo comprobar que quedó

Con la cuenta de un delegado (permiso `vitrina`, dueño de un negocio):

1. Editar SU emprendimiento → guarda.
2. Desde la consola del navegador, intentar escribir sobre otro:
   ```js
   const otro = window.urbisVitrina.find(f => !/tu-id/.test(f.descripcion));
   window.urbisDBUpdate('descripcion', otro.descripcion, { descripcion: otro.descripcion });
   ```
   Antes de la regla: responde `ok`. Después: `Ese emprendimiento no es tuyo.`

Mientras la regla no esté, el recorte vive solo en
`js/13i-vitrina.js` → `puedoEditar()`, y así está dicho en su cabecera.
