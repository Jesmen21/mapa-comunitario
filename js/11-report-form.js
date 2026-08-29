// ==========================================
  // FORMULARIO PEDAGÓGICO (SIMPLIFICACIÓN PARA EL CIUDADANO)
  // ==========================================
  window.formPaso2 = function(dim, lat, lng, desc = "") {
    // Blindaje: si el tipo no está en dimensiones (p.ej. emoji corrupto/mojibake),
    // usar una config segura para que el formulario NO falle al abrir/editar.
    const _dimCfg = dimensiones[dim] || dimensiones[Object.keys(dimensiones)[0]] || { items: [], color: '#888', icon: '📍' };
    let isEdit = desc !== "";
    let d = isEdit ? desc.split(' | ') : [];
    let item = d[0] || "", n = d[1] || "", nt = d[2] || "", est = d[3] || "Bueno", mat = d[5] || "N/A";
    
    let fotoActual = d[BASE_OFFSET] || ""; 
    let estadoActualValidacion = isEdit ? (d[BASE_OFFSET + 1] || "Pendiente") : (userRole === 'admin' || userRole === 'gov' ? "Aprobado" : "Pendiente");
    let creadorActual = d[BASE_OFFSET + 2] || userNameGlobal;
    let rolActual = d[BASE_OFFSET + 3] || userRole;
    let likesActuales = d[BASE_OFFSET + 4] || 0;
    
    let correoActual = d[BASE_OFFSET + 5] || userEmailGlobal;
    let cedulaActual = d[BASE_OFFSET + 6] || userCedulaGlobal;
    let barrioActual = d[BASE_OFFSET + 7] || userBarrioGlobal;
    
    let opciones = (_dimCfg.items || []).map(i => `<option value="${i}" ${i===item?'selected':''}>${obtenerIconoReporte(dim, i)} ${i}</option>`).join('');

    // ── Ficha del edificio ────────────────────────────────────────────────
    // Va ANTES de la sub-clasificación a propósito: en un recorrido urbano lo
    // primero que se reconoce de un edificio es de qué está hecho y cuánto
    // levanta. La verticalidad es la que sitúa la pieza en el tejido — una
    // torre de 12 pisos y una casa de uno no son el mismo hecho urbano aunque
    // ambas digan "Residencial" — y de ella depende cuánta gente y cuánto
    // movimiento genera. El uso viene después, y pueden ser varios.
    const EDIF = window.URBIS_EDIFICIO || null;
    const esEdificio = !!(EDIF && EDIF.esCategoriaEdificio(dim));
    const fichaEdif = EDIF ? EDIF.leer(desc) : { materialidad: '', pisos: 1, pisosRegistrados: false };
    let htmlEdificio = '';
    if (esEdificio && EDIF) {
        const optsMat = EDIF.MATERIALIDAD.map(m =>
            `<option value="${m}" ${m === fichaEdif.materialidad ? 'selected' : ''}>${m}</option>`).join('');
        const pisosVal = fichaEdif.pisosRegistrados ? fichaEdif.pisos : '';
        const pbActual = fichaEdif.plantaBaja || 'Sin registrar';
        const optsPB = (EDIF.PLANTA_BAJA || []).map(v =>
            `<option value="${v}" ${v === pbActual ? 'selected' : ''}>${v}</option>`).join('');
        const epActual = fichaEdif.epoca || 'Sin registrar';
        const optsEp = (EDIF.EPOCA || []).map(v =>
            `<option value="${v}" ${v === epActual ? 'selected' : ''}>${v}</option>`).join('');
        htmlEdificio = `
        <div class="form-section-edificio">
          <label style="font-size:0.7rem; color:var(--cyan); display:block;">1 · ¿DE QUÉ ESTÁ HECHO? (MATERIALIDAD)</label>
          <select id="sel-materialidad">${optsMat}</select>
          <label style="font-size:0.7rem; color:var(--cyan); display:block; margin-top:10px;">2 · ¿CUÁNTOS PISOS TIENE?</label>
          <input type="number" id="ins-pisos" min="1" max="60" step="1" value="${pisosVal}" placeholder="Ej: 1 para una casa, 12 para una torre">
          <div class="edificio-hint">La altura cambia el peso del edificio en el análisis: una torre de 12 pisos aloja y mueve mucha más gente que una casa de uno, aunque el uso sea el mismo.</div>
          <label style="font-size:0.7rem; color:var(--cyan); display:block; margin-top:12px;">3 · ¿QUÉ HAY A NIVEL DE CALLE?</label>
          <select id="sel-planta-baja">${optsPB}</select>
          <div class="edificio-hint">Lo que se ve al pasar caminando por el frente. Un edificio con las tiendas en el tercer piso y un portón abajo atrae gente igual, pero no hace calle.</div>
          <label style="font-size:0.7rem; color:var(--cyan); display:block; margin-top:12px;">4 · ¿DE QUÉ ÉPOCA ES?</label>
          <select id="sel-epoca">${optsEp}</select>
          <div class="edificio-hint">Los cortes son los de la norma sismo resistente: el primer código colombiano es de 1984, después de Popayán. Junto con el material, dice qué construcciones merecen que alguien vaya a mirarlas en serio. Si no lo sabes, déjalo sin registrar.</div>
        </div>`;
    }
    
    let htmlCheckboxes = '';
    for(let j=0; j<todosLosUsos.length; j++) {
        let isChecked = d[6+j] === "SI" ? "checked" : "";
        htmlCheckboxes += `<div class="usage-item"><input type="checkbox" id="chk-u-${j}" ${isChecked}> ${todosLosUsos[j]}</div>`;
    }
    
    // Lógica pedagógica: Ocultar secciones técnicas si el usuario es ciudadano
    let isCitizen = (userRole === 'citizen');
    let displayTecnico = isCitizen ? 'none' : 'block';
    
    window.__urbisCurrentFormContext = {
        cat: dim,
        lat: String(lat),
        lng: String(lng),
        isEdit: !!isEdit,
        estadoVal: estadoActualValidacion,
        creadorNom: creadorActual,
        creadorRolStr: rolActual,
        likesActuales: likesActuales,
        correoReq: correoActual,
        cedulaReq: cedulaActual,
        barrioReq: barrioActual
    };

    document.getElementById('info-content').innerHTML = `
      <div class="form-section">
        <b style="color:${_dimCfg.color}; font-size: 1.2rem;">${_dimCfg.icon} ${dim.toUpperCase()}</b>
        
        ${htmlEdificio}
        <label style="font-size:0.7rem; color:var(--cyan); display:block; margin-top:10px;">${esEdificio ? '5 · SUB-CLASIFICACIÓN TÉCNICA:' : 'SUB-CLASIFICACIÓN TÉCNICA:'}</label>
        <select id="sel-item">${opciones}</select>
        <input type="text" id="sel-nombre" value="${n}" placeholder="Nombre/Identificador del lugar (Ej: Av 3 con Calle 5)">
        <textarea id="ins-nota" placeholder="Describe el problema, emergencia o situación aquí...">${nt}</textarea>
        
        <div style="display: ${displayTecnico}; margin-top: 10px;">
            <div class="form-row">
                <div>
                    <label style="font-size:0.7rem; color:var(--cyan);">ESTADO FÍSICO:</label>
                    <select id="sel-estado"><option value="Bueno" ${est==="Bueno"?'selected':''}>✅ Bueno</option><option value="Regular" ${est==="Regular"?'selected':''}>⚠️ Regular</option><option value="Malo" ${est==="Malo"?'selected':''}>❌ Malo/Peligro</option></select>
                </div>
                <div>
                    <label style="font-size:0.7rem; color:var(--cyan);">MATERIAL:</label>
                    <select id="sel-mat"><option value="N/A" ${mat==="N/A"?'selected':''}>No Aplica / Mixto</option><option value="Concreto" ${mat==="Concreto"?'selected':''}>Concreto</option><option value="Tierra/Arena" ${mat==="Tierra/Arena"?'selected':''}>Tierra/Arena</option><option value="Metal/Acero" ${mat==="Metal/Acero"?'selected':''}>Metal/Acero</option></select>
                </div>
            </div>
        </div>

        <label style="font-size:0.7rem; color:var(--cyan); display:block; margin-top:10px;">EVIDENCIA FOTOGRÁFICA (SUBIR FOTO O LINK OPCIONAL):</label>
        <div class="evidence-box">
            <div class="evidence-grid">
                <label class="file-upload-label">📷 Subir foto desde el dispositivo
                    <input type="file" id="ins-foto-file" accept="image/*" onchange="previsualizarEvidencia(this)">
                </label>
                <input type="url" id="ins-foto" value="${(fotoActual && fotoActual !== 'N/A' && !fotoActual.startsWith('data:image')) ? fotoActual : ''}" placeholder="O pega un link de la foto aquí (Opcional)">
                <img id="evidence-preview" class="evidence-preview" src="${fotoActual && fotoActual.startsWith('data:image') ? fotoActual : ''}" style="${fotoActual && fotoActual.startsWith('data:image') ? 'display:block;' : ''}" alt="Vista previa de evidencia">
                <div class="evidence-hint">La foto se comprime automáticamente antes de guardarse. Para producción real conviene usar Firebase Storage, Supabase Storage o un servidor propio.</div>
                <div id="evidence-file-name" class="evidence-hint"></div>
            </div>
        </div>
        
        <div style="display: ${esEdificio ? 'block' : displayTecnico};">
            <label style="font-size:0.7rem; color:var(--fuchsia); display:block; margin-top:15px; border-top:1px solid #444; padding-top:10px;">${esEdificio ? '6 · ¿QUÉ PASA ADENTRO? MARCA TODOS LOS USOS:' : 'MATRIZ DE USOS MULTIDIMENSIONAL:'}</label>
            ${esEdificio ? '<div class="edificio-hint">Un mismo edificio puede tener varios usos a la vez: un colegio con cancha y tienda son tres. Márcalos todos — el análisis los reparte entre los pisos que registraste.</div>' : ''}
            <div class="usos-container"><div class="usage-grid">${htmlCheckboxes}</div></div>
        </div>
        
        <button class="btn-save" onclick="enviarDatosDesdeFormulario(this)">GUARDAR REPORTE</button>
        <button class="btn-cancelar" onclick="cancelarRegistro()">❌ CANCELAR</button>
      </div>`;
  };

  window.prepararEdicion = function(lat) {
      const punto = buscarPuntoPorLat(lat);
      if(!punto) { alert("No se encontró el punto para editar."); return; }
      if(!puedeGestionarReporte(punto)) { alert("Solo puedes editar tus propios reportes."); return; }
      if(tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
      try{ map.closePopup(); }catch(e){}
      formPaso2(punto.tipo, punto.lat, punto.lng, punto.descripcion);
      // En móvil el formulario vive en #info-content (dentro del #sidebar oculto).
      // En vez de pelear con el CSS del sidebar, MOVEMOS #info-content a un overlay
      // propio garantizado visible. Sus IDs siguen funcionando para GUARDAR.
      try{
        const ic = document.getElementById('info-content');
        let sheet = document.getElementById('urbis-edit-sheet');
        if(!sheet){
          sheet = document.createElement('div');
          sheet.id = 'urbis-edit-sheet';
          sheet.innerHTML = '<button id="urbis-edit-close" type="button" aria-label="Cerrar edición">×</button><div id="urbis-edit-sheet-body"></div>';
          document.body.appendChild(sheet);
          sheet.querySelector('#urbis-edit-close').onclick = function(){ try{ if(typeof window.cancelarRegistro === 'function') window.cancelarRegistro(); else window.urbisCerrarEdicionOverlay(); }catch(e){} };
        }
        const body = sheet.querySelector('#urbis-edit-sheet-body');
        if(ic && body && ic.parentElement !== body){
          window.__urbisEditICOrigin = ic.parentElement || document.getElementById('sidebar');
          body.appendChild(ic);
        }
        document.body.classList.add('urbis-edit-overlay');
        sheet.style.display = 'block';
        sheet.scrollTop = 0;
      }catch(e){}
  };
  // Cierra el overlay de edición: devuelve #info-content a su sitio original.
  window.urbisCerrarEdicionOverlay = function(){
    try{
      const ic = document.getElementById('info-content');
      const origin = window.__urbisEditICOrigin;
      if(ic && origin && ic.parentElement && ic.parentElement.id === 'urbis-edit-sheet-body'){
        origin.appendChild(ic);
      }
      window.__urbisEditICOrigin = null;
      const sheet = document.getElementById('urbis-edit-sheet');
      if(sheet) sheet.style.display = 'none';
      document.body.classList.remove('urbis-edit-overlay');
    }catch(e){}
  };
