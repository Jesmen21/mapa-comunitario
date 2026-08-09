# URBIS · Búsqueda funcional con LocationIQ

## Qué se agregó

La barra de búsqueda del modo Movilidad ahora está conectada a LocationIQ Autocomplete.

Flujo:
1. El usuario escribe mínimo 3 letras.
2. URBIS consulta LocationIQ con debounce.
3. Se muestran resultados debajo de la barra.
4. Al tocar un resultado, el mapa se centra en ese lugar.
5. Se marca el destino con el pin rojo.
6. Aparece la burbuja para continuar con la ruta.

## Dónde poner la API key

Abre:

```txt
js/00-config.js
```

Busca:

```js
LOCATIONIQ: {
  apiKey: 'PASTE_YOUR_LOCATIONIQ_API_KEY_HERE',
  countrycodes: 'co',
  limit: 6,
  debounceMs: 450
}
```

Reemplaza el placeholder por tu token real de LocationIQ.

## Nota PWA

Si no ves cambios en el celular, borra datos del sitio o cambia de incógnito. El service worker puede guardar archivos antiguos.
