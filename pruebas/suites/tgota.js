const E = require('../entorno.js');
/* LA GOTA DEL EVENTO PREMIUM (assets/brand/urbis-gota.png, js/10, js/09)

   El marcador del evento de Juegos URBIS pintaba `urbis-logo.png`, que es el
   ICONO DE LA APLICACIÓN: la gota blanca de la marca sobre un cuadrado
   celeste. En un lanzador ese cuadrado es el fondo del icono; encima de una
   foto satelital es un recuadro de color pegado en mitad del barrio. Se dijo
   así: «asi cuadrado se ve fuera de lugar».

   `urbis-gota.png` es EL MISMO archivo con el fondo recortado píxel a píxel.
   No es un redibujo, y eso importa: este proyecto ya rechazó una vez que su
   marca se aproximara en trazos («deja este logo original, deja esta forma
   tal cual», js/77). Lo que esta suite defiende:

   · las esquinas del archivo son transparentes —si no, vuelve el cuadrado—;
   · pero la U celeste y el punto dorado SIGUEN ahí: el recorte se lleva el
     celeste del marco y no el de la marca, que la gota encierra;
   · el marcador se ancla en la PUNTA. Una gota que señala con la punta pero
     se ancla por el centro apunta a media cuadra de donde es;
   · y el logo cuadrado no volvió al mapa por ninguna otra puerta.        */
const { chromium } = require(E.MODULOS + '/playwright-core');
const fs = require('fs');
const REPO = process.env.REPO || E.RAIZ;

(async () => {
  const ok = [], fallo = [];
  const chk = (c, t) => (c ? ok : fallo).push(t);
  const b = await chromium.launch({ executablePath: E.CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 300 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(String(e.message).slice(0, 160)));

  chk(fs.existsSync(REPO + '/assets/brand/urbis-gota.png'), 'el archivo de la gota existe');
  chk(fs.existsSync(REPO + '/assets/brand/urbis-logo.png'),
      'y el logo cuadrado sigue donde estaba: es el icono de la aplicación y del papel');

  // ── El archivo, leído píxel a píxel ────────────────────────────────────
  await pg.goto('http://localhost:8199/assets/', { waitUntil: 'domcontentloaded' });
  const px = await pg.evaluate(() => new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      const leer = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] }; };
      const W = c.width, H = c.height;
      // Las cuatro esquinas, el centro de la gota, la U y el punto.
      const esquinas = [leer(1, 1), leer(W - 2, 1), leer(1, H - 2), leer(W - 2, H - 2)];
      // Barrido para encontrar el amarillo del punto y el celeste de la U
      // dentro de lo opaco, sin depender de coordenadas escritas a mano.
      let amarillo = 0, celeste = 0, blanco = 0;
      const dat = g.getImageData(0, 0, W, H).data;
      for (let i = 0; i < dat.length; i += 4) {
        if (dat[i + 3] < 200) continue;
        const r = dat[i], gg = dat[i + 1], bb = dat[i + 2];
        if (r > 220 && gg > 220 && bb > 220) blanco++;
        else if (r > 200 && gg > 150 && bb < 90) amarillo++;
        else if (r < 120 && gg > 170 && bb > 220) celeste++;
      }
      res({ W, H, esquinas, amarillo, celeste, blanco });
    };
    im.onerror = () => res(null);
    im.src = '/assets/brand/urbis-gota.png';
  }));
  chk(!!px, 'la gota se puede cargar en el navegador');
  if (px) {
    chk(px.esquinas.every(c => c.a === 0),
        'las cuatro esquinas son transparentes: no queda nada del cuadrado celeste');
    chk(px.blanco > 20000, 'la gota blanca está entera (' + px.blanco + ' píxeles)');
    chk(px.celeste > 3000, 'la U celeste sobrevivió al recorte (' + px.celeste + ' píxeles)');
    chk(px.amarillo > 1000, 'y el punto dorado también (' + px.amarillo + ' píxeles)');
    // Una gota es más alta que ancha. Si saliera cuadrada, algo se recortó mal.
    chk(px.H > px.W, 'sigue siendo una gota: más alta que ancha (' + px.W + '×' + px.H + ')');
  }

  // ── El marcador ────────────────────────────────────────────────────────
  const j10 = fs.readFileSync(REPO + '/js/10-visible-markers.js', 'utf8');
  const bloque = (j10.match(/\} else if \(esPremium\) \{[\s\S]*?zIndexOffset: 2000 \}\);/) || [''])[0];
  chk(/urbis-gota\.png/.test(bloque), 'el marcador del evento premium pinta la gota');
  /* Se busca el USO —una ruta entre comillas o dentro de un src— y no el
     nombre suelto: el bloque explica en un comentario por qué se dejó de
     usar el logo cuadrado, y una regla que prohibiera nombrarlo empujaría a
     borrar justo la explicación. Es la misma trampa de la v815. */
  const USADO = /src="[^"]*urbis-logo\.png|['"`]assets\/brand\/urbis-logo\.png['"`]/;
  chk(!USADO.test(bloque), 'y ya no pinta el logo cuadrado');
  const anc = bloque.match(/iconSize:\[(\d+),(\d+)\], iconAnchor:\[(\d+),(\d+)\]/);
  chk(!!anc, 'el marcador declara su tamaño y su anclaje');
  if (anc) {
    const alto = +anc[2], anclaY = +anc[4];
    chk(anclaY > alto * 0.8,
        'se ancla en la PUNTA (' + anclaY + ' de ' + alto + '), no por el centro: una gota señala con la punta');
    chk(+anc[3] === Math.round(+anc[1] / 2), 'y centrada a lo ancho');
  }

  // ── El cuadrado no volvió al mapa por otra puerta ──────────────────────
  const enMapa = ['js/10-visible-markers.js', 'js/09-events.js']
    .filter(f => USADO.test(fs.readFileSync(REPO + '/' + f, 'utf8')));
  chk(enMapa.length === 0,
      'ningún archivo del mapa ni del hub de eventos usa ya el logo cuadrado' +
      (enMapa.length ? ': ' + enMapa.join(', ') : ''));

  // ── El sonar late en la punta ──────────────────────────────────────────
  const css = fs.readFileSync(REPO + '/css/01-base-layout.css', 'utf8');
  chk(/\.urbis-coliseo-root \.urbis-aurea \.au-ring\{[^}]*top:8[0-9](\.\d+)?%/.test(css),
      'el anillo del sonar late alrededor de la punta y no del centro del dibujo');

  // ── Y se ve sobre un fondo claro ───────────────────────────────────────
  chk(/drop-shadow\(0 0 2px rgba\(3,105,161/.test(j10),
      'lleva un halo celeste: una gota blanca sin borde se pierde sobre un techo claro');

  const sw = fs.readFileSync(REPO + '/service-worker.js', 'utf8');
  chk(/'\.\/assets\/brand\/urbis-gota\.png'/.test(sw),
      'la gota está en la precaché: un marcador que no carga sin señal es un mapa sin eventos');

  chk(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores[0] : ''));

  await b.close();
  console.log('\n' + ok.map(t => '  ✓ ' + t).join('\n'));
  if (fallo.length) console.log('\n' + fallo.map(t => '  ✗ ' + t).join('\n'));
  console.log('\n  ' + ok.length + '/' + (ok.length + fallo.length));
  process.exit(fallo.length ? 1 : 0);
})();
