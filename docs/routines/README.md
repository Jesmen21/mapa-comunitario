# Routines de URBIS

Dos módulos de URBIS no se alimentan de código sino de **Routines** (tareas
programadas de la cuenta) que investigan, editan un JSON de `assets/data/` y
hacen commit a `main`:

| Módulo | Archivo que edita | Se ve en |
|---|---|---|
| Seguimiento Presidencial | `assets/data/seguimiento-presidencial.json` | `seguimiento.html` |
| Alertas de desastres | `assets/data/alertas-urbis.json` | el mapa principal |

Los prompts que gobiernan ese trabajo vivían solo dentro de la configuración de
las Routines, donde no se podían revisar ni versionar. Aquí quedan como
documentación: `seguimiento-presidencial.md` y `alertas-desastres.md`.

## Cadencia

Ambas pasaron de **una vez al día** a **cada 6 horas**, escalonadas 3 horas
entre sí para que nunca coincidan empujando a `main`:

| Routine | Cron (UTC) | Hora de Colombia |
|---|---|---|
| Seguimiento Presidencial | `0 3,9,15,21 * * *` | 10:00 · 16:00 · 22:00 · 04:00 |
| Alertas de desastres | `30 0,6,12,18 * * *` | 07:30 · 13:30 · 19:30 · 01:30 |

La portada del seguimiento anuncia esa cadencia en vez de una fecha concreta de
próxima revisión: con cuatro pasadas al día, prometer una fecha es prometer de
menos. Si la cadencia cambia, hay que actualizar `CADENCIA_REVISION` en
`js/70-seguimiento.js`.

## Cómo se aplican estos prompts

Una Routine solo puede publicar en este repositorio si tiene el repositorio
declarado como *source*. Eso se configura al crearla desde la interfaz de
Routines de claude.ai; una Routine creada por un agente no lo lleva y sus
sesiones arrancan sin el repositorio, así que investigan y no pueden publicar
nada. Por eso estos prompts se aplican **editando las Routines existentes**, no
creando otras nuevas.

## Por qué cambiaron los prompts

Pasar de una pasada diaria a cuatro cambia cuál es el riesgo dominante. Ya no es
que se escape un hecho: es que el mismo hecho quede registrado tres veces con
tres redacciones distintas. Cada prompt busca **8 horas** hacia atrás —dos de
solape, para que nada caiga entre pasadas— y a cambio lleva reglas duras de
deduplicación, que ahora son lo primero de la tarea.
