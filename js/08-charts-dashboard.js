// ==========================================
  // GRÁFICAS DE CHART.JS
  // ==========================================
  function updateChart(id, type, labels, data, colors, title) {
    const canvas = document.getElementById(id);
    if(!canvas) return;
    if(charts[id]) charts[id].destroy();
    const valores = Array.isArray(data) ? data : [];
    const sinDatos = !valores.length || valores.every(val => Number(val) === 0);
    const finalLabels = sinDatos ? ['Sin datos'] : labels;
    const finalData = sinDatos ? [1] : valores;
    const finalColors = sinDatos ? ['rgba(255,255,255,.16)'] : colors;
    charts[id] = new Chart(canvas, {
      type: type,
      data: { labels: finalLabels, datasets: [{ data: finalData, backgroundColor: finalColors, borderWidth: 2, borderColor: '#1a1a1a', hoverOffset: 15 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { title: { display: true, text: sinDatos ? `${title} · Sin datos aprobados` : title, color: '#b8ebe6', font: { size: 14 } }, legend: { position: 'bottom', labels: { color: '#ccc', font: { size: 10 } } } }, cutout: type === 'doughnut' ? '55%' : undefined }
    });
  }

  function actualizarGraficos(data) {
    let cGen = {}; let cUso = { com: 0, res: 0, ins: 0, pub: 0 }; let cEdif = { unPiso: 0, multi: 0, comercial: 0 };
    
    let idxCom = 6 + todosLosUsos.indexOf("Comercial");
    let idxRes = 6 + todosLosUsos.indexOf("Residencial");
    let idxIns = 6 + todosLosUsos.indexOf("Institucional");
    let idxPub = 6 + todosLosUsos.indexOf("Esp. Público");
    let idxDep = 6 + todosLosUsos.indexOf("Deportivo");
    let idxAsen = 6 + todosLosUsos.indexOf("Asentamiento Informal");

    data.forEach(p => {
      let d = p.descripcion.split(' | ');
      let estValidacion = d[BASE_OFFSET + 1] || "Aprobado"; 
      if (estValidacion !== "Aprobado") return; 

      let cat = p.tipo; let elem = d[0] || "";
      cGen[cat] = (cGen[cat] || 0) + 1;
      
      if(d[idxCom] === "SI") cUso.com++; 
      if(d[idxRes] === "SI" || d[idxAsen] === "SI") cUso.res++; 
      if(d[idxIns] === "SI") cUso.ins++; 
      if(d[idxPub] === "SI" || d[idxDep] === "SI") cUso.pub++; 
      
      if(elem.includes("piso") || elem.includes("Casa")) cEdif.unPiso++; else if(elem.includes("Edificio") || elem.includes("Torre")) cEdif.multi++; else cEdif.comercial++;
    });

    updateChart('chartGeneral', 'pie', Object.keys(cGen), Object.values(cGen), ['#ff4757', '#27ae60', '#e84393', '#2c3e50', '#e67e22', '#8e44ad', '#f1c40f', '#c0392b'], 'Distribución Macro Urbana');
    updateChart('chartEdificios', 'doughnut', ['Casas / Baja Altura', 'Torres/Multifamiliares', 'Comercio / Otros'], [cEdif.unPiso, cEdif.multi, cEdif.comercial], ['#9fddd6', '#f5bfd6', '#feca57'], 'Tipología Constructiva');
    updateChart('chartUsos', 'bar', ['Comercial', 'Residencial', 'Institucional', 'Esp.Público'], [cUso.com, cUso.res, cUso.ins, cUso.pub], ['#e84393', '#95a5a6', '#2d3436', '#27ae60'], 'Usos del Suelo');
  }
