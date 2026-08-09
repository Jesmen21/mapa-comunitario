# URBIS · Script PowerShell para reorganizar PROYECTO URBIS.xlsx
# Ejecutar: .\reorganizar_excel.ps1
# Resultado: PROYECTO URBIS LIMPIO.xlsx en la misma carpeta

$src  = "C:\Users\Jesme\Downloads\PROYECTO URBIS.xlsx"
$dest = "C:\Users\Jesme\Downloads\PROYECTO URBIS LIMPIO.xlsx"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

# Copia el archivo para no tocar el original
Copy-Item $src $dest -Force
$wb = $excel.Workbooks.Open($dest)

# ──────────────────────────────────────────────────────────────
# 1. Hoja 1 — Eliminar columnas 6 a 25 (overflow de datos)
# ──────────────────────────────────────────────────────────────
$sh1 = $wb.Sheets.Item("Hoja 1")
$lastCol = $sh1.UsedRange.Columns.Count
if ($lastCol -gt 5) {
    # Eliminar de derecha a izquierda para no desplazar índices
    for ($c = $lastCol; $c -ge 6; $c--) {
        $sh1.Columns($c).Delete() | Out-Null
    }
}
Write-Host "✓ Hoja 1: reducida a 5 columnas (tipo|lat|lng|descripcion|fecha)"

# ──────────────────────────────────────────────────────────────
# 2. usuarios_registro — Mantener solo columnas únicas (1–60)
#    Eliminar columnas 61 en adelante (duplicados del viejo formato)
# ──────────────────────────────────────────────────────────────
$shu = $wb.Sheets.Item("usuarios_registro")
$lastColU = $shu.UsedRange.Columns.Count
if ($lastColU -gt 60) {
    for ($c = $lastColU; $c -ge 61; $c--) {
        $shu.Columns($c).Delete() | Out-Null
    }
}
# Mover encabezados a fila 1 (actualmente en fila 3)
# Primero eliminar filas 1 y 2 decorativas
$shu.Rows(2).Delete() | Out-Null
$shu.Rows(1).Delete() | Out-Null
Write-Host "✓ usuarios_registro: encabezados en fila 1, columnas reducidas a 60"

# ──────────────────────────────────────────────────────────────
# 3. verificacion_email — Unificar los dos grupos de columnas
#    Grupo 2 (col Y = col 25) contiene los datos reales
#    Copiar al inicio y eliminar columnas sobrantes
# ──────────────────────────────────────────────────────────────
$shv = $wb.Sheets.Item("verificacion_email")
# Los datos reales del Apps Script empiezan en la columna 25 (Y)
# Encabezados limpios: verification_id, user_id, correo, tipo_codigo, codigo,
#                      expira_en, estado, intentos, fecha_creacion, fecha_verificacion, canal
$headersV = @("verification_id","user_id","correo","tipo_codigo","codigo","expira_en","estado","intentos","fecha_creacion","fecha_verificacion","canal","resultado_envio")

# Leer datos del grupo 2 (col 25+)
$lastRowV = $shv.UsedRange.Rows.Count
$grupoData = @()
if ($lastRowV -ge 2) {
    for ($r = 2; $r -le $lastRowV; $r++) {
        $rowData = @()
        for ($c = 25; $c -le 36; $c++) {
            $rowData += $shv.Cells($r, $c).Value2
        }
        $grupoData += ,$rowData
    }
}

# Limpiar toda la hoja
$shv.Cells.Clear() | Out-Null

# Escribir encabezados limpios en fila 1
for ($c = 0; $c -lt $headersV.Count; $c++) {
    $shv.Cells(1, $c + 1).Value2 = $headersV[$c]
}

# Escribir datos del grupo 2 desde fila 2
for ($r = 0; $r -lt $grupoData.Count; $r++) {
    for ($c = 0; $c -lt $grupoData[$r].Count; $c++) {
        $shv.Cells($r + 2, $c + 1).Value2 = $grupoData[$r][$c]
    }
}
Write-Host "✓ verificacion_email: unificada a 12 columnas"

# ──────────────────────────────────────────────────────────────
# 4. registro_logs — Unificar los dos grupos
#    Datos reales en columnas 18+ (col R)
# ──────────────────────────────────────────────────────────────
$shl = $wb.Sheets.Item("registro_logs")
$headersL = @("log_id","fecha","accion","correo","cedula","usuario","resultado","motivo","origen","ip","detalle")
$lastRowL = $shl.UsedRange.Rows.Count
$grupoDataL = @()
if ($lastRowL -ge 2) {
    for ($r = 2; $r -le $lastRowL; $r++) {
        $rowData = @()
        for ($c = 18; $c -le 28; $c++) {
            $rowData += $shl.Cells($r, $c).Value2
        }
        $grupoDataL += ,$rowData
    }
}
$shl.Cells.Clear() | Out-Null
for ($c = 0; $c -lt $headersL.Count; $c++) {
    $shl.Cells(1, $c + 1).Value2 = $headersL[$c]
}
for ($r = 0; $r -lt $grupoDataL.Count; $r++) {
    for ($c = 0; $c -lt $grupoDataL[$r].Count; $c++) {
        $shl.Cells($r + 2, $c + 1).Value2 = $grupoDataL[$r][$c]
    }
}
Write-Host "✓ registro_logs: unificada a 11 columnas"

# ──────────────────────────────────────────────────────────────
# 5. notificaciones_urbis — Mantener solo las 13 columnas del v2
# ──────────────────────────────────────────────────────────────
$shn = $wb.Sheets.Item("notificaciones_urbis")
$headersN = @("notification_id","user_id","tipo","titulo","mensaje","estado","fecha_creacion","fecha_lectura","accion","related_id","actor_user_id","actor_usuario","metadata")
$lastRowN = $shn.UsedRange.Rows.Count
$lastColN = $shn.UsedRange.Columns.Count

# Leer datos columnas 13-25 (donde caen los datos del Apps Script nuevo)
$grupoDataN = @()
if ($lastRowN -ge 2) {
    for ($r = 2; $r -le $lastRowN; $r++) {
        $rowData = @()
        for ($c = 13; $c -le [Math]::Min(25, $lastColN); $c++) {
            $rowData += $shn.Cells($r, $c).Value2
        }
        $grupoDataN += ,$rowData
    }
}
$shn.Cells.Clear() | Out-Null
for ($c = 0; $c -lt $headersN.Count; $c++) {
    $shn.Cells(1, $c + 1).Value2 = $headersN[$c]
}
for ($r = 0; $r -lt $grupoDataN.Count; $r++) {
    for ($c = 0; $c -lt [Math]::Min($grupoDataN[$r].Count, 13); $c++) {
        $shn.Cells($r + 2, $c + 1).Value2 = $grupoDataN[$r][$c]
    }
}
Write-Host "✓ notificaciones_urbis: unificada a 13 columnas"

# ──────────────────────────────────────────────────────────────
# 6. Guardar y cerrar
# ──────────────────────────────────────────────────────────────
$wb.Save()
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

Write-Host ""
Write-Host "✅ Excel limpio guardado en: $dest"
Write-Host "   Puedes abrirlo, verificar y luego subir a Google Drive."
