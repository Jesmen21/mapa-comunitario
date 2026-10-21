#!/usr/bin/env node
/* URBIS · verificador de enlaces del registro presidencial
   ========================================================
   Se corre EN SU COMPUTADOR, no acá: el contenedor donde se escribió este
   archivo tiene el proxy cerrado a todos los dominios, así que desde allá
   «no responde» y «no hay red» se ven igual — que es exactamente el error
   que este proyecto no comete (v1065).

       node herramientas/verificar-enlaces.js
       node herramientas/verificar-enlaces.js --pausa 1500 --salida /tmp/enlaces.csv
       node herramientas/verificar-enlaces.js --solo petro --desde 200

   SIN DEPENDENCIAS: solo `fetch`, `fs` y `path`, que vienen con Node 18+.

   QUÉ HACE, y en este orden por cada enlace:
     1. HEAD, que no descarga el cuerpo.
     2. Si el HEAD falla o devuelve 405/403/501 —hay medios que no lo
        permiten—, reintenta con GET. Un 405 a un HEAD NO es un enlace roto,
        y contarlo como tal sería el falso positivo caro de esta medición.
     3. Espera `--pausa` milisegundos entre peticiones. Por defecto 1.200 ms,
        y por DOMINIO además se respeta esa misma pausa: pedirle cien veces
        seguidas a infobae.com es la manera de que lo tumben a uno.

   QUÉ SACA: un CSV con una fila por enlace y estas columnas —

     archivo, entrada_id, entrada_titulo, fuente_nombre, url, metodo,
     codigo, ok, redirige_a, error

   `codigo` es 0 cuando no hubo respuesta (DNS, timeout, conexión cortada);
   ahí `error` dice qué pasó. **Un 0 no es «el enlace está muerto»**: es «no
   se pudo comprobar», y la diferencia importa. */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const REGISTROS = {
  presidencial: 'assets/data/seguimiento-presidencial.json',
  petro: 'assets/data/seguimiento-petro.json'
};

function arg(nombre, pordefecto) {
  const i = process.argv.indexOf('--' + nombre);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : pordefecto;
}

const PAUSA = Math.max(0, parseInt(arg('pausa', '1200'), 10) || 1200);
const CORTE = Math.max(1000, parseInt(arg('timeout', '15000'), 10) || 15000);
const DESDE = Math.max(0, parseInt(arg('desde', '0'), 10) || 0);
const SOLO = arg('solo', '');
const SALIDA = path.resolve(arg('salida', path.join(RAIZ, 'enlaces-verificados.csv')));

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* El CSV se escribe con comillas dobles y las internas se duplican, que es
   la regla de verdad del formato: un título con una coma —y acá los hay a
   montones— partiría la fila en dos sin esto. */
function csv(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return '"' + s.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}

function recolectar() {
  const out = [];
  for (const [clave, rel] of Object.entries(REGISTROS)) {
    if (SOLO && SOLO !== clave) continue;
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) { console.error('no está ' + rel + ', se salta'); continue; }
    const d = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const mete = (titulo, id, fuentes) => (fuentes || []).forEach((f) => {
      if (f && f.u) out.push({ archivo: clave, id: id || '', titulo: titulo || '', nombre: f.n || '', url: f.u });
    });
    (d.entradas || []).forEach((e) => mete(e.titulo, e.id, e.fuentes));
    (((d.casos || {}).lista) || []).forEach((c) => mete(c.titulo, c.id, c.fuentes));
    (d.contradicciones && d.contradicciones.casos || []).forEach((c) => mete(c.tema, c.id, c.fuentes));
  }
  return out;
}

async function pedir(url, metodo) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CORTE);
  try {
    const r = await fetch(url, {
      method: metodo,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'URBIS-verificador-de-enlaces/1.0 (+https://urbispro.city)' }
    });
    return { codigo: r.status, ok: r.ok, destino: r.url !== url ? r.url : '' };
  } catch (e) {
    return { codigo: 0, ok: false, destino: '', error: (e && e.message) || String(e) };
  } finally {
    clearTimeout(t);
  }
}

(async () => {
  const lista = recolectar().slice(DESDE);
  if (!lista.length) { console.error('no hay enlaces que revisar'); process.exit(1); }
  console.error(lista.length + ' enlaces · pausa ' + PAUSA + ' ms · corte ' + CORTE + ' ms');
  console.error('sale en ' + SALIDA + '\n');

  const cab = ['archivo', 'entrada_id', 'entrada_titulo', 'fuente_nombre', 'url',
               'metodo', 'codigo', 'ok', 'redirige_a', 'error'];
  fs.writeFileSync(SALIDA, '﻿' + cab.join(',') + '\n', 'utf8');

  const ultimaDe = {};
  const cuenta = { ok: 0, roto: 0, sinRespuesta: 0 };

  for (let i = 0; i < lista.length; i++) {
    const it = lista[i];
    let host = '';
    try { host = new URL(it.url).hostname; } catch (e) { /* URL inválida: se registra igual */ }

    /* La pausa por DOMINIO va además de la global: con 155 dominios, la
       global sola deja a los seis grandes recibiendo ráfagas. */
    const espera = Math.max(PAUSA, (ultimaDe[host] || 0) + PAUSA - Date.now());
    if (espera > 0) await dormir(espera);
    ultimaDe[host] = Date.now();

    let metodo = 'HEAD';
    let r = await pedir(it.url, 'HEAD');
    if (!r.ok && (r.codigo === 0 || [403, 405, 404, 429, 501].includes(r.codigo))) {
      await dormir(PAUSA);
      metodo = 'HEAD+GET';
      const g = await pedir(it.url, 'GET');
      /* Se queda la MEJOR de las dos: si el GET responde, el HEAD solo decía
         que ese servidor no acepta HEAD. */
      if (g.ok || g.codigo) r = g;
    }

    if (r.ok) cuenta.ok++; else if (r.codigo === 0) cuenta.sinRespuesta++; else cuenta.roto++;

    fs.appendFileSync(SALIDA, [it.archivo, it.id, it.titulo, it.nombre, it.url,
      metodo, r.codigo, r.ok ? 'si' : 'no', r.destino || '', r.error || ''].map(csv).join(',') + '\n', 'utf8');

    const marca = r.ok ? 'ok ' : (r.codigo === 0 ? ' ? ' : '!! ');
    process.stderr.write(marca + (i + 1) + '/' + lista.length + '  ' + r.codigo + '  ' + it.url.slice(0, 92) + '\n');
  }

  /* Las tres cuentas van APARTE porque piden cosas distintas: un 404 hay que
     arreglarlo, un 0 hay que volver a intentarlo con mejor red. Sumarlas
     mandaría a buscar fuentes nuevas para enlaces que quizá están vivos. */
  console.error('\nresponden ' + cuenta.ok +
                ' · con código de error ' + cuenta.roto +
                ' · SIN RESPUESTA (no comprobados) ' + cuenta.sinRespuesta);
  console.error('CSV en ' + SALIDA);
})();
