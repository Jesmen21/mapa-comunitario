/* Service worker de RETIRO de la app ligera de reportes.

   Hasta la v783, reportes.html registraba este archivo con su propia caché y
   —esto es lo grave— con el MISMO alcance ("/") que el service worker de la
   aplicación completa: registrar uno sustituía al otro, y un teléfono que
   hubiera abierto las dos páginas iba alternando entre dos cachés según cuál
   fue la última. Ahora reportes.html solo redirige a index.html y no
   registra nada.

   Pero los teléfonos que YA lo tenían registrado lo conservan hasta que el
   archivo cambie. Este es ese cambio: al activarse borra sus cachés, se da de
   baja a sí mismo y recarga las ventanas que controlaba, para que la próxima
   carga la atienda el service worker de la aplicación. No tiene manejador de
   fetch a propósito: un service worker que no intercepta nada no puede servir
   nada viejo. */
const CACHE = 'urbis-reportes-v803-que-forma-tiene-la-traza';   // solo para el revisor de versión
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k.startsWith('urbis-reportes-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const ventanas = await self.clients.matchAll({ type: 'window' });
    ventanas.forEach(function (v) { try { v.navigate(v.url); } catch (err) {} });
  })());
});
