#!/usr/bin/env python3
"""Demostrar en rojo (regla 3): una inyección FIEL por cada aserción.

Cada inyección devuelve la base al estado que la aserción existe para rechazar:
el estado viejo medido en la base viva (los permisos abiertos, la política
`with check (true)`, el punto exacto en la vista) o el defecto exacto que la
aserción vigila, escrito como un cambio mínimo sobre el texto REAL de la
migración (`parche`), no como una función reescrita a mano.

Tres resultados, no dos (CLAUDE.md, v1090): ROJO, la aserción mordió; VERDE,
no mordió y la guarda está floja; MURIO, la inyección tumbó la corrida antes
de la aserción, y eso no prueba nada.

    python3 herramientas/modulos/viviendas/supabase/pruebas/inyectar.py
"""
import os, re, subprocess, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
MIG = os.path.join(os.path.dirname(AQUI), 'migrations')


def funcion(archivo, nombre, cambios):
    """Toma `create function <nombre>` de la migración, aplica los cambios
    (cada ancla tiene que aparecer UNA vez) y lo devuelve como create or replace."""
    texto = open(os.path.join(MIG, archivo)).read()
    m = re.search(r'create (?:or replace )?function ' + re.escape(nombre) + r'\(.*?\n(?:end )?\$\$;', texto, re.S)
    assert m, 'no encuentro la función %s en %s' % (nombre, archivo)
    f = m.group(0).replace('create function', 'create or replace function', 1)
    for a, b in cambios:
        assert f.count(a) == 1, 'el ancla no es única en %s: %r' % (nombre, a)
        f = f.replace(a, b)
    return f


def vista(cambios):
    texto = open(os.path.join(MIG, '20261023100013_anunciantes_base.sql')).read()
    m = re.search(r'create or replace view public\.viviendas_publicas.*?where v\.publicada;', texto, re.S)
    v = m.group(0)
    for a, b in cambios:
        assert v.count(a) == 1, a
        v = v.replace(a, b)
    return v


F2 = "insert into public.formulas_puntaje (version, nombre, puntos_por_poi, tope_por_categoria, radio_zona_m, radios_permitidos, activa, nota) values "
def formula(puntos=66.67, tope=100, zona=2000, radios='{300,500,1000}'):
    return ("update public.formulas_puntaje set activa = false where activa;\n" + F2 +
            "(2, 'inyección', %s, %s, %s, '%s', true, 'inyección');" % (puntos, tope, zona, radios))

PANEL_AUTH = "create policy x on public.%s for %s to authenticated using (%s)%s;"

INY = [
  # ── seguridad ────────────────────────────────────────────────────────────
  ('anon no lee la ubicación exacta de la tabla',
   "grant select (ubicacion) on public.viviendas to anon, authenticated;"),
  # Dos barreras: el filtro de la vista y la política de la tabla. Cada una
  # basta sola, así que la inyección fiel quita las dos.
  ('anon lee la vista pública y solo las publicadas',
   'drop policy "ver viviendas publicadas" on public.viviendas; create policy x on public.viviendas for select to anon, authenticated using (true);\n' +
   vista([('where v.publicada;', ';')])),
  ('anon no pide visita sin sesión',
   'grant insert on public.interesados to anon; create policy x on public.interesados for insert to anon with check (true); alter table public.interesados alter column user_id drop not null;'),
  # El estado de fábrica medido en la base viva: todo concedido a anon, tablas
  # y funciones. Sin las funciones, el disparador de revisión frena a anon por
  # accidente y la inyección no sería fiel.
  ('anon no escribe viviendas',
   'grant all on public.viviendas to anon; grant execute on all functions in schema public to anon;'
   ' grant usage on schema privado to anon; grant execute on all functions in schema privado to anon;'
   ' create policy x on public.viviendas for update to anon using (true);'),
  ('anon no puede vaciar una tabla',
   'grant truncate on all tables in schema public to anon;'),
  ('anon no lee perfiles, transacciones ni bitácora',
   'grant select on public.perfiles, public.transacciones, public.bitacora to anon;'),
  ('anon no tiene permiso de ejecutar las funciones',
   'grant execute on all functions in schema public to anon;'),
  ('anon registra un evento anónimo y no lo puede leer',
   'grant select on public.eventos to anon;'),
  ('el cliente pide visita a su nombre',
   'drop policy "un cliente con sesion pide visita a su nombre" on public.interesados;'),
  ('el cliente no pide visita a nombre de otro',
   'drop policy "un cliente con sesion pide visita a su nombre" on public.interesados; create policy x on public.interesados for insert to authenticated with check (true);'),
  ('el límite de envíos frena',
   'drop trigger interesados_limite on public.interesados;'),
  ('el cliente ve su perfil y ningún otro',
   'create policy x on public.perfiles for select to authenticated using (true);'),
  ('el cliente no se da a sí mismo el rol de admin',
   'create policy x on public.roles_usuario for insert to authenticated with check (true);'),
  ('el cliente no ve la ubicación exacta por la función',
   funcion('20261023100005_vista_publica.sql', 'public.ubicacion_exacta',
           [("  if not public.es_admin() then\n    raise exception 'Solo el admin ve la ubicación exacta.' using errcode = '42501';\n  end if;\n", '')])),
  ('el cliente no ve transacciones aunque existan',
   'create policy x on public.transacciones for select to authenticated using (true);'),
  ('el cliente guarda un favorito suyo y no uno a nombre de otro',
   'create policy x on public.favoritos for insert to authenticated with check (true);'),
  ('un cliente no ve las solicitudes ni los favoritos de otro',
   'create policy x on public.interesados for select to authenticated using (true);'),
  ('el admin sin segundo paso',
   funcion('20261023100002_roles.sql', 'public.es_admin', [("privado.tiene_rol('admin') and public.sesion_con_dos_pasos()", "privado.tiene_rol('admin')")])),
  ('el admin ve la ubicación exacta por su función, y es distinta de la pública',
   funcion('20261023100005_vista_publica.sql', 'privado.poner_ubicacion_publica',
           [('new.ubicacion_publica := privado.desplazar_punto(new.id, new.ubicacion);', 'new.ubicacion_publica := new.ubicacion;')]) +
   '\nupdate public.viviendas set ocultar_ubicacion_exacta = ocultar_ubicacion_exacta;'),
  ('el admin lee el perfil de quien pidió visita y no el de quien no',
   'drop policy "el admin lee el perfil de quien pidio visita" on public.perfiles; create policy x on public.perfiles for select to authenticated using (public.es_admin());'),
  ('el admin registra una transacción y nadie la puede borrar',
   'grant delete on public.transacciones to authenticated; create policy x on public.transacciones for delete to authenticated using (true);'),
  ('el admin publica y edita viviendas',
   'drop policy "admin escribe viviendas" on public.viviendas;'),
  ('nadie escribe la bitácora a mano',
   'grant insert, delete on public.bitacora to authenticated; create policy x on public.bitacora for all to authenticated using (true) with check (true);'),
  ('la bitácora anota el cambio sin copiar la coordenada',
   'drop trigger bitacora_viviendas on public.viviendas; create trigger bitacora_viviendas after insert or update or delete on public.viviendas for each row execute function privado.anotar_bitacora();'),
  ('gerencia lee transacciones y bitácora',
   'drop policy "admin y gerencia leen transacciones" on public.transacciones; create policy x on public.transacciones for select to authenticated using (public.es_admin());'),
  ('gerencia no escribe nada',
   'create policy x on public.viviendas for update to authenticated using (public.es_gerencia()) with check (true);'),
  ('gerencia no ve teléfonos ni correos',
   'create policy x on public.perfiles for select to authenticated using (public.es_gerencia());'),
  ('el anunciante crea un borrador propio',
   'drop policy "el anunciante crea borradores" on public.viviendas;'),
  ('el anunciante no puede publicarse solo',
   'drop trigger viviendas_proteger_revision on public.viviendas;'),
  ('el anunciante no ve el borrador interno de URBIS',
   'create policy x on public.viviendas for select to authenticated using (true);'),
  ('en revisión el anunciante ya no puede editar',
   'drop policy "el anunciante edita en borrador o rechazado" on public.viviendas; create policy x on public.viviendas for update to authenticated using (propietario_id = auth.uid()) with check (propietario_id = auth.uid());'),
  # ── fórmula ──────────────────────────────────────────────────────────────
  ('fórmula · dos colegios a 100 y 250 m suman 87', formula(puntos=25)),
  ('fórmula · cuatro paraderos a 250 m suman 133 y el tope', formula(tope=1000)),
  ('fórmula · sin puntos en el radio pero con puntos en la zona es un 0 MEDIDO', formula(zona=500)),
  ('fórmula · sin ningún punto en 2 km la categoría queda SIN MEDIR', formula(zona=100000)),
  ('fórmula · el total es la media ponderada', formula(zona=100000)),
  ('fórmula · la corrida guarda la copia',
   "create function pr.sin_rastro() returns trigger language plpgsql as $$ begin new.formula_copia := null; new.categorias_copia := null; return new; end $$;"
   " create trigger sin_rastro before insert on public.analisis_ubicacion for each row execute function pr.sin_rastro();"),
  ('fórmula · el detalle trae cada punto del radio',
   "create function pr.sin_detalle() returns trigger language plpgsql as $$ begin new.detalle := '[]'; return new; end $$;"
   " create trigger sin_detalle before insert on public.analisis_ubicacion for each row execute function pr.sin_detalle();"),
  ('fórmula · una fórmula no se edita', 'drop trigger formulas_inmutables on public.formulas_puntaje;'),
  ('fórmula · cambiar un peso no toca la copia',
   "create function pr.copia_viva() returns trigger language plpgsql as $$ begin update public.analisis_ubicacion set categorias_copia ="
   " (select jsonb_agg(jsonb_build_object('clave', clave, 'peso', peso) order by orden) from public.categorias_poi where cuenta_para_analisis); return null; end $$;"
   " create trigger copia_viva after update on public.categorias_poi for each statement execute function pr.copia_viva();"),
  ('fórmula · un radio fuera de los permitidos se rechaza', formula(radios='{300,500,750,1000}')),
  ('fórmula · sin datos en la zona el total queda NULL',
   "create function pr.cero() returns trigger language plpgsql as $$ begin new.puntaje_total := coalesce(new.puntaje_total, 0); new.estado := 'ok'; return new; end $$;"
   " create trigger cero before insert on public.analisis_ubicacion for each row execute function pr.cero();"),
  ('fórmula · con la ubicación oculta, la distancia sale del punto público',
   funcion('20261023100010_formula_puntaje.sql', 'public.calcular_analisis_ubicacion',
           [('select v.ubicacion_publica, v.ocultar_ubicacion_exacta into v_punto, v_oculta', 'select v.ubicacion, v.ocultar_ubicacion_exacta into v_punto, v_oculta')])),
  ('fortalezas · una por categoría',
   funcion('20261023100011_fortalezas.sql', 'public.generar_fortalezas', [("select distinct on (e ->> 'categoria') e as d", 'select e as d')])),
  ('fortalezas · una fortaleza sin punto y sin razón', 'alter table public.vivienda_fortalezas drop constraint fortalezas_con_base;'),
  ('fortalezas · la distancia la calcula la base', 'drop trigger fortalezas_distancia on public.vivienda_fortalezas;'),
  # ── importador ───────────────────────────────────────────────────────────
  ('importador · la primera vez inserta los tres',
   funcion('20261023100009_categorias_y_espejo.sql', 'public.importar_mapeos', [('    if not found then\n', '    if false then\n')])),
  ('importador · reimportar el mismo archivo no duplica',
   'alter table public.puntos_interes drop constraint puntos_urbis_mapeo_id_unico;\n' +
   funcion('20261023100009_categorias_y_espejo.sql', 'public.importar_mapeos', [('    if not found then\n', '    if true then\n')])),
  ('importador · un polígono entra con su geometría',
   funcion('20261023100009_categorias_y_espejo.sql', 'public.importar_mapeos', [("        v_geom, v_p ->> 'miniatura_url', coalesce", "        null, v_p ->> 'miniatura_url', coalesce")])),
  ('importador · un punto cambiado se actualiza',
   funcion('20261023100009_categorias_y_espejo.sql', 'public.hash_mapeo', [("p ->> 'modulo_origen', p ->> 'nombre', ", "p ->> 'modulo_origen', ")])),
  ('importador · rechaza una miniatura en base64',
   'alter table public.puntos_interes drop constraint puntos_miniatura_https;\n' +
   funcion('20261023100009_categorias_y_espejo.sql', 'public.importar_mapeos', [("      when v_p ? 'miniatura_url'", "      when false and v_p ? 'miniatura_url'")])),
  ('importador · un punto que falta en un archivo completo se desactiva',
   funcion('20261023100009_categorias_y_espejo.sql', 'public.importar_mapeos', [('  if p_completo then\n', '  if false then\n')])),
  ('importador · cada corrida queda en sincronizaciones',
   funcion('20261023100009_categorias_y_espejo.sql', 'public.importar_mapeos', [("terminada_en = now(), estado = 'ok',", 'terminada_en = now(),')])),
  ('importador · el público no ve un punto desactivado',
   'drop policy "se ven los puntos activos" on public.puntos_interes; create policy x on public.puntos_interes for select to anon, authenticated using (true);'),
  ('importador · un punto local cercano a otro avisa',
   funcion('20261023100009_categorias_y_espejo.sql', 'public.proponer_punto_local', [('extensions.st_dwithin(p.ubicacion, v_punto, 25)', 'extensions.st_dwithin(p.ubicacion, v_punto, 1)')])),
  ('importador · confirmado, queda pendiente de enviar a URBIS',
   'alter table public.puntos_interes drop constraint puntos_con_origen;\n' +
   funcion('20261023100009_categorias_y_espejo.sql', 'public.proponer_punto_local', [("'viviendas', 'viviendas', true)", "'viviendas', 'viviendas', false)")])),
  # ── mapa y datos ─────────────────────────────────────────────────────────
  ('mapa · las viviendas del rectángulo y solo ellas',
   funcion('20261023100006_mapa_por_area.sql', 'public.viviendas_en_area',
           [('  where vp.ubicacion operator(extensions.&&)\n        extensions.st_makeenvelope(p_oeste, p_sur, p_este, p_norte, 4326)::extensions.geography\n', '  where true\n')])),
  ('mapa · el filtro de operación separa venta de arriendo',
   funcion('20261023100006_mapa_por_area.sql', 'public.viviendas_en_area', [('(p_operacion is null or vp.operacion = p_operacion)', 'true')])),
  ('mapa · con el mapa alejado no se piden puntos', "update public.ajustes set valor = '0' where clave = 'pois_zoom_minimo';"),
  ('mapa · la vista pública nunca trae el punto exacto',
   vista([('with (security_invoker = true)', 'with (security_invoker = false)'), ('v.ubicacion_publica as ubicacion,', 'v.ubicacion as ubicacion,')])),
  ('vista pública · todo punto oculto está desplazado entre 80 y 150 m',
   funcion('20261023100005_vista_publica.sql', 'privado.desplazar_punto', [('v_metros double precision := 80 + ', 'v_metros double precision := 5 + ')]) +
   '\nupdate public.viviendas set ocultar_ubicacion_exacta = ocultar_ubicacion_exacta;'),
  ('vista pública · el desplazamiento no cambia entre recargas',
   funcion('20261023100005_vista_publica.sql', 'privado.desplazar_punto', [('v_h text := md5(p_id::text || v_sal);', 'v_h text := md5(random()::text);')]) +
   '\nupdate public.viviendas set ocultar_ubicacion_exacta = ocultar_ubicacion_exacta;'),
  ('datos de ejemplo · seis viviendas de la maqueta', "update public.viviendas set operacion = 'venta' where operacion = 'arriendo';"),
  ('datos de ejemplo · un solo comando los borra',
   funcion('20261023100001_viviendas_campos.sql', 'public.borrar_datos_de_ejemplo', [("  delete from public.puntos_interes where fuente = 'ejemplo';\n", '')])),
  ('esquema · el slug nace solo',
   'alter table public.viviendas drop constraint viviendas_slug_formato;\n' +
   funcion('20261023100001_viviendas_campos.sql', 'public.viviendas_poner_slug', [("coalesce(public.slug_de(new.nombre), 'vivienda')", 'lower(new.nombre)')])),
  ('esquema · un parqueadero sin dato queda NULL', 'alter table public.viviendas alter column parqueaderos set default 0;'),
  ('esquema · el bucket de Supabase quedó retirado', "insert into storage.buckets (id, name, public) values ('viviendas-fotos', 'viviendas-fotos', true);"),
  ('esquema · rls_auto_enable ya no se deja ejecutar', 'grant execute on function public.rls_auto_enable() to anon, authenticated;'),
  ('esquema · toda tabla de public tiene la seguridad por fila activa', 'create table public.sin_rls (x int);'),
  ('esquema · una tabla nueva nace sin permisos',
   'alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;'),
]


def correr(sql):
    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False, dir='/tmp') as f:
        f.write(sql)
    os.chmod(f.name, 0o644)
    env = dict(os.environ, INYECCION=f.name, BASE='viviendas_inyeccion')
    r = subprocess.run(['bash', os.path.join(AQUI, 'correr.sh')], capture_output=True, text=True, env=env)
    os.unlink(f.name)
    return r.stdout + r.stderr


limpia = correr('select 1;')
total = re.search(r'(\d+) bien · (\d+) fallaron', limpia)
print('corrida limpia: %s bien · %s fallaron' % total.groups())
if total.group(2) != '0':
    print(limpia); sys.exit(2)
nombres = re.findall(r'^ok · (.*)$', limpia, re.M)

cubiertas, flojas, murieron = set(), [], []
for frag, sql in INY:
    blanco = [n for n in nombres if n.startswith(frag)]
    if len(blanco) != 1:
        print('? la inyección «%s» no apunta a UNA aserción (%d)' % (frag, len(blanco))); flojas.append(frag); continue
    n = blanco[0]
    salida = correr(sql)
    if 'FALLA · ' + n in salida:
        estado = 'ROJO'; cubiertas.add(n)
    elif 'ok · ' + n in salida:
        estado = 'VERDE'; flojas.append(n)
    else:
        estado = 'MURIO'; murieron.append(n)
        m = re.search(r'MURIO · .*', salida)
        n += '  — ' + (m.group(0) if m else 'sin línea de la aserción')
    print('%-6s · %s' % (estado, n))

sin = [n for n in nombres if n not in cubiertas]
print('\n%d de %d aserciones mordieron · %d verdes · %d murieron · %d sin inyección que muerda' %
      (len(cubiertas), len(nombres), len(flojas), len(murieron), len(sin)))
for n in sin:
    print('  sin rojo demostrado: ' + n)
sys.exit(0 if not sin else 1)
