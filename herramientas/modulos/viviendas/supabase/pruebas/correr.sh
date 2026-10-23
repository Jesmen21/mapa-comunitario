#!/usr/bin/env bash
# Corre la suite de la Fase 1 contra un Postgres local con PostGIS.
#
#   bash herramientas/modulos/viviendas/supabase/pruebas/correr.sh            # todo
#   INYECCION=archivo.sql bash .../correr.sh                                   # con una inyección
#
# 1. crea una base limpia, 2. carga el entorno que imita a Supabase, 3. aplica
# la línea base y las migraciones EN ORDEN, deteniéndose en el primer error,
# 4. carga los datos de ejemplo, 5. si hay INYECCION, la aplica (es el estado
# viejo que una aserción tiene que rechazar), 6. corre cada archivo de prueba.
#
# Cada prueba imprime una línea «ok · …» o «FALLA · …». El resumen final cuenta
# las dos y TAMBIÉN las que se esperaban: una suite que muere a la mitad no
# imprime fallas, y el silencio no es un aprobado (CLAUDE.md, «Una salida vacía
# no es una salida buena»).
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(dirname "$AQUI")"
BASE="${BASE:-viviendas_pruebas}"
PSQL=(su postgres -c)
q() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -X -d $BASE $*"; }

su postgres -c "dropdb --if-exists $BASE" && su postgres -c "createdb $BASE" || { echo "MURIO · no se pudo crear la base"; exit 3; }
su postgres -c "psql -q -X -d $BASE -c \"alter database $BASE set search_path = \\\"\\\$user\\\", public, extensions\"" >/dev/null

if ! q "-f $AQUI/entorno_local.sql" >/tmp/viv_entorno.log 2>&1; then echo "MURIO · entorno_local"; cat /tmp/viv_entorno.log; exit 3; fi
for m in "$RAIZ"/migrations/*.sql; do
  if ! q "-f $m" >/tmp/viv_mig.log 2>&1; then echo "MURIO · migración $(basename "$m")"; cat /tmp/viv_mig.log; exit 3; fi
done
if [ -f "$RAIZ/datos/ejemplo.sql" ]; then
  if ! q "-f $RAIZ/datos/ejemplo.sql" >/tmp/viv_datos.log 2>&1; then echo "MURIO · datos de ejemplo"; cat /tmp/viv_datos.log; exit 3; fi
fi
if ! q "-f $AQUI/marco.sql" >/tmp/viv_marco.log 2>&1; then echo "MURIO · marco de pruebas"; cat /tmp/viv_marco.log; exit 3; fi
if [ -n "${INYECCION:-}" ]; then
  if ! q "-f $INYECCION" >/tmp/viv_iny.log 2>&1; then echo "MURIO · la inyección no se dejó aplicar"; cat /tmp/viv_iny.log; exit 3; fi
fi

ok=0; mal=0; esperadas=0
for t in "$AQUI"/prueba_*.sql; do
  n=$(grep -c "perform pr.ok(" "$t"); esperadas=$((esperadas + n))
  salida=$(q "-f $t" 2>&1)
  echo "$salida" | grep -E "^(psql:.*)?(NOTICE:  )?(ok|FALLA) · " | sed -E 's/^psql:[^:]*:[0-9]+: //; s/^NOTICE:  //'
  if echo "$salida" | grep -q "ERROR:"; then echo "MURIO · $(basename "$t"): $(echo "$salida" | grep -m1 "ERROR:")"; fi
  ok=$((ok + $(echo "$salida" | grep -c "ok · "))); mal=$((mal + $(echo "$salida" | grep -c "FALLA · ")))
done
echo
echo "  $ok bien · $mal fallaron · $((esperadas - ok - mal)) no llegaron a correr · $esperadas esperadas"
[ "$mal" = 0 ] && [ "$ok" = "$esperadas" ] && exit 0 || exit 1
