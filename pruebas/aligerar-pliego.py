"""Rehace un PDF de láminas más liviano: la MISMA página de 60 × 90 cm con la
misma imagen, con menos píxeles. El tamaño del papel no cambia, así que medir
milímetros sobre él sigue dando lo mismo; lo único que baja es la nitidez de
la letra chica.

Tres objetos por página —página, imagen y flujo de contenido— numerados
seguidos. La primera versión los numeraba `3+2i` y `4+2i` y el contenido de
una página chocaba con el objeto de la siguiente: salían TRES MediaBox con dos
imágenes. Se vio contando páginas contra imágenes distintas, no leyendo."""
import re, io, sys
from PIL import Image

def jpegs(path):
    d = open(path, 'rb').read(); out = []
    for m in re.finditer(rb'stream\r?\n', d):
        s = m.end()
        if d[s:s+2] == b'\xff\xd8':
            e = d.find(b'\nendstream', s); out.append(d[s:e])
    return out

def pdf(paginas, ancho_mm, alto_mm):
    W = ancho_mm * 72 / 25.4; H = alto_mm * 72 / 25.4
    n = len(paginas)
    total = 2 + 3 * n
    salida = bytearray(b'%PDF-1.4\n'); mapa = {}
    def poner(i, cabeza, crudo=None):
        mapa[i] = len(salida)
        salida.extend(('%d 0 obj\n' % i).encode('latin-1'))
        salida.extend(cabeza.encode('latin-1'))
        if crudo is not None:
            salida.extend(crudo); salida.extend(b'\nendstream')
        salida.extend(b'\nendobj\n')
    kids = ' '.join('%d 0 R' % (3 + i * 3) for i in range(n))
    poner(1, '<< /Type /Catalog /Pages 2 0 R >>')
    poner(2, '<< /Type /Pages /Count %d /Kids [%s] >>' % (n, kids))
    for i, (datos, w, h) in enumerate(paginas):
        pg, im, ct = 3 + i * 3, 4 + i * 3, 5 + i * 3
        poner(pg, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] '
                  '/Resources << /XObject << /I0 %d 0 R >> >> /Contents %d 0 R >>'
                  % (W, H, im, ct))
        poner(im, '<< /Type /XObject /Subtype /Image /Width %d /Height %d '
                  '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode '
                  '/Length %d >>\nstream\n' % (w, h, len(datos)), datos)
        flujo = 'q %.2f 0 0 %.2f 0 0 cm /I0 Do Q' % (W, H)
        poner(ct, '<< /Length %d >>\nstream\n' % len(flujo), flujo.encode('latin-1'))
    xref = len(salida)
    salida.extend(('xref\n0 %d\n0000000000 65535 f \n' % (total + 1)).encode('latin-1'))
    for i in range(1, total + 1):
        salida.extend(('%010d 00000 n \n' % mapa.get(i, 0)).encode('latin-1'))
    salida.extend(('trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF'
                   % (total + 1, xref)).encode('latin-1'))
    return bytes(salida)

src, dst, esc, q = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4])
pgs = []
for j in jpegs(src):
    im = Image.open(io.BytesIO(j)).convert('RGB')
    w, h = int(im.width * esc), int(im.height * esc)
    b = io.BytesIO()
    im.resize((w, h), Image.LANCZOS).save(b, 'JPEG', quality=q, optimize=True, progressive=True)
    pgs.append((b.getvalue(), w, h))
open(dst, 'wb').write(pdf(pgs, 600, 900))
print(dst, '·', len(pgs), 'páginas ·', round(len(open(dst, 'rb').read()) / 1048576, 2), 'MB')
