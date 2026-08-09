# URBIS ANÁLISIS — Estudio de la interfaz (la "cabeza" de URBIS)

**Versión:** v296 · **Fecha:** julio 2026
**Idea central:** la app móvil (Android/iPhone) es el *cuerpo* que alimenta datos con miles de usuarios; la plataforma web de PC es la *cabeza* que los analiza. El urbanismo es un órgano vivo: todo está conectado, y URBIS Análisis existe para leer esa vida.

---

## 1. ¿Para quién es? (los 3 perfiles que compran/usan URBIS)

| Perfil | Qué necesita | Qué le da URBIS Análisis |
|---|---|---|
| 🎓 **Estudiante** (arquitectura/urbanismo) | Analizar un sector para su entrega: usos, verde, densidades | Polígono → matriz de usos + capa verde + tablas exportables (CSV para Excel, informe imprimible para la lámina) |
| 🏛️ **Alcaldía / político** | Visión profunda y rápida de la ciudad para decidir e invertir | Balance construido vs. social, reportes históricos de riesgo/accidentes georreferenciados, mapa de calor de actividad ciudadana |
| 📐 **Planeador / consultor** | Diagnóstico técnico con datos frescos (no censos viejos) | Datos comunitarios vivos + análisis satelital de píxeles, cuantificados por hectárea |

## 2. Lo implementado en v296 (ya funciona)

**Entrada:** botón flotante **🛰️ Análisis** (solo escritorio ≥1024px). La app completa de Android/iPhone ahora ES la interfaz también en PC (shell unificado): mismo login bonito, mismos módulos, adaptados a pantalla grande.

**Herramientas de dibujo (el "lápiz"):**
- ✏️ **Polígono libre** — un clic por vértice, doble clic cierra. Muestra área provisional mientras dibujas.
- ▭ **Rectángulo** — dos clics (esquina y esquina opuesta).
- 🗑️ Limpiar · Esc cancela/cierra · área en m²/hectáreas + perímetro al instante.

**El panel de resultados (4 pestañas):**
1. **📊 Matriz** — clasifica TODO lo mapeado por la comunidad dentro del polígono en 10 capas urbanas (vivienda, comercio, verde, deporte, equipamientos, infraestructura, riesgo, tráfico, social, otros), con conteo, densidad por hectárea, barras comparativas y desglose por subtipo (ej: "Casa de un piso × 12").
2. **🌳 Verde** — descarga las teselas satelitales del sector, clasifica píxel a píxel con índice de exceso de verde (ExG = 2G−R−B), pinta la **capa verde sobre el mapa** y entrega: % de cobertura vegetal, m² de verde estimados, % construido/suelo duro, y una lectura (déficit / media / buena cobertura).
3. **🚨 Reportes** — historial de alertas y accidentes reportados por los usuarios dentro del sector, resumidos por tipo y listados por fecha.
4. **⚖️ Balance** — la comparativa que pediste: verde vs. construido (físico, desde píxeles) y social vs. privado vs. riesgo (desde los datos comunitarios), con indicadores tipo "por cada m² de verde hay X m² de suelo duro".

**Salidas:** ⬇️ **CSV** (abre en Excel, separador `;`) · 🖨️ **Informe** (documento imprimible con marca URBIS, tablas y métricas — listo para anexar a un estudio).

**Extra:** 🔥 **Mapa de calor** de toda la actividad ciudadana (dónde reporta/mapea más la gente).

## 3. Principios de diseño de la interfaz

1. **El mapa es el lienzo** — las herramientas flotan; nada tapa el territorio. Toolbar izquierda (acción), panel derecho (lectura), estado abajo.
2. **Dibujar → medir → leer → exportar** en menos de 60 segundos. Sin configuración previa.
3. **Todo cuantificado por hectárea** — permite comparar sectores de tamaños distintos (lenguaje estándar del urbanismo).
4. **Alto contraste siempre** (regla URBIS): panel claro con texto oscuro; sobre el mapa, chips oscuros con texto blanco.
5. **La evidencia es doble**: lo que la gente reporta (matriz) + lo que el satélite muestra (píxeles). Cuando ambas coinciden, el diagnóstico es sólido.

## 4. Hoja de ruta (para pensar el producto)

**v2 — Comparar y proyectar**
- Comparar **dos polígonos** lado a lado (ej: barrio rico vs. barrio popular → desigualdad de verde).
- **Escenarios**: "si arborizo este 10%, el sector pasa de 8% a 18% verde".
- Guardar sectores con nombre (biblioteca de estudios del usuario).
- Exportar **GeoJSON/KML** (para QGIS/ArcGIS — el estándar académico).

**v3 — Inteligencia**
- NDVI real con imágenes **Sentinel-2** (infrarrojo: vegetación real, no solo "píxeles verdes").
- Detección de techos/manzanas por IA → estimar unidades de vivienda sin mapeo manual.
- **Series temporales**: cómo cambió el verde/reportes del sector entre fechas.
- **Índice de Vida Urbana URBIS** (0-100 por sector): combina verde + espacio social + seguridad + servicios. La métrica insignia del producto.

**v4 — Negocio**
- Cuentas institucionales (universidad = N licencias de estudiantes; alcaldía = tablero de ciudad).
- Informes con marca de la institución.
- API de datos agregados (vender acceso a los indicadores, nunca datos personales).

## 5. Nota técnica
Todo corre en el navegador sin backend nuevo: geometría propia (ray casting + shoelace), datos desde la base comunitaria existente, teselas Esri World Imagery con CORS para el análisis de píxeles. Motor puro y testeado (27 pruebas) en `js/49-urbis-analisis.js`.
