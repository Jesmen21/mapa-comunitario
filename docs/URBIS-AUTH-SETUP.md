# URBIS · Registro con verificación por correo

## Qué se agregó

- Registro ciudadano obligatorio con nombre, correo, documento, celular y barrio.
- Aceptación de términos y condiciones.
- Aceptación de análisis anónimo de movilidad.
- Verificación por código de 6 dígitos enviado al correo.
- Sesión persistente en `localStorage`: el usuario queda logueado en ese dispositivo hasta cerrar sesión, borrar datos del sitio o desinstalar la PWA.

## Paso externo obligatorio

1. Sube el Excel actualizado a Google Sheets.
2. Abre el Google Sheets.
3. Ve a **Extensiones > Apps Script**.
4. Copia el contenido de `docs/apps-script-urbis-auth.gs`.
5. Guarda.
6. Despliega como **Web App**:
   - Ejecutar como: **Tú**
   - Acceso: **Cualquier usuario**
7. Copia la URL del Web App.
8. Pégala en `js/00-config.js`:

```js
AUTH: {
  APPS_SCRIPT_ENDPOINT: 'PEGA_AQUI_LA_URL_DE_APPS_SCRIPT',
  ADMIN_EMAIL: 'TU_CORREO_ADMIN@gmail.com'
}
```

## Prueba recomendada

1. Borra caché/datos del sitio en Chrome móvil.
2. Entra a URBIS.
3. Toca **Entrar como ciudadano**.
4. Llena todos los datos.
5. Acepta términos y análisis anónimo.
6. Toca **Crear cuenta y verificar correo**.
7. Revisa el correo.
8. Escribe el código.
9. Al verificar, URBIS debe entrar y conservar la sesión.
