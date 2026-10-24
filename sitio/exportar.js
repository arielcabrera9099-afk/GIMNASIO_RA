/* Exportación XLSX local: solo datos de recepción, sin enviar archivos a terceros. */
(function(root) {
  'use strict';
  function crearLibro(clientes, hoy, ExcelJS, Cuotas, diarios = []) {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'RA GYM';
    libro.views = [{activeTab:0}];
    const fecha = iso => Cuotas.valida(iso) ? new Date(iso + 'T00:00:00Z') : null;
    const texto = v => String(v ?? '');
    const numero = v => Number(v) || 0;
    const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const periodoVisible = p => /^(\d{4})-(0[1-9]|1[0-2])$/.test(p) ? `${meses[Number(p.slice(5))-1]}(${p.slice(0,4)})` : texto(p);
    function hoja(nombre, columnas) {
      const h = libro.addWorksheet(nombre, {views:[{state:'frozen',ySplit:1}]});
      h.columns = columnas.map(([header,key,width=22,formato]) => ({header,key,width,...(formato ? {style:{numFmt:formato}} : {})}));
      h.autoFilter = {from:{row:1,column:1},to:{row:1,column:columnas.length}};
      h.getRow(1).height = 28;
      h.getRow(1).eachCell(c => {
        c.font = {bold:true,color:{argb:'FFFFFFFF'}};
        c.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF176C61'}};
        c.alignment = {vertical:'middle'};
      });
      return h;
    }
    const resumen = hoja('Resumen general', [['Resumen del gimnasio','concepto',38],['Valor','valor',26]]);
    resumen.autoFilter = undefined;
    const totales = {activos:0,aldia:0,retraso:0,baja:0,pagos:0,pendientes:0,abonado:0,saldo:0};
    const pagos = hoja('Pagos registrados', [
      ['Socio','nombre',32],['CI','ci',18,'@'],['Estado del socio','estado'],
      ['Período de cuota','periodo',26,'@'],['Monto (Gs.)','monto',20,'#,##0'],
      ['Fecha de pago','fecha',20,'dd/mm/yyyy'],['Método de pago','metodo'],['Nota','nota',45]
    ]);
    const socios = hoja('Resumen de socios', [
      ['Socio','nombre',32],['CI','ci',18,'@'],['Teléfono','telefono',22,'@'],['Estado','estado',22],
      ['Inscripción','inscripcion',20,'dd/mm/yyyy'],['Primer vencimiento','primerVencimiento',22,'dd/mm/yyyy'],
      ['Cuota mensual (Gs.)','cuota',23,'#,##0'],['Cuotas pendientes','pendientes',22,'0'],
      ['Saldo pendiente (Gs.)','saldo',25,'#,##0'],['Total abonado (Gs.)','total',24,'#,##0']
    ]);
    const pendientes = hoja('Cuotas pendientes', [
      ['Socio','nombre',32],['CI','ci',18,'@'],['Período de cuota','periodo',26,'@'],
      ['Vencimiento','vencimiento',20,'dd/mm/yyyy'],['Monto (Gs.)','monto',20,'#,##0']
    ]);
    const pases = hoja('Pases diarios', [
      ['Visitante','nombre',32],['CI','ci',18,'@'],['Fecha de visita y pago','fecha',26,'dd/mm/yyyy'],
      ['Monto (Gs.)','monto',20,'#,##0'],['Método de pago','metodo',24],['Nota','nota',45]
    ]);
    for(const p of [...diarios].sort((a,b)=>texto(a.fecha).localeCompare(texto(b.fecha))||texto(a.nombre).localeCompare(texto(b.nombre),'es'))) {
      pases.addRow({nombre:texto(p.nombre),ci:texto(p.ci),fecha:fecha(p.fecha),monto:numero(p.monto),metodo:texto(p.metodo),nota:texto(p.nota)});
    }
    for (const c of [...clientes].sort((a,b)=>texto(a.nombre).localeCompare(texto(b.nombre),'es'))) {
      const registros = Object.entries(c.pagos || {}).filter(([,v])=>v);
      const activo = c.activo !== false;
      const deuda = activo ? Cuotas.estado(c,hoy).adeuda : [];
      const estado = activo ? (deuda.length ? 'Con retraso' : 'Al día') : 'De baja';
      totales.activos += activo ? 1 : 0;
      totales.baja += activo ? 0 : 1;
      totales.aldia += activo && !deuda.length ? 1 : 0;
      totales.retraso += activo && deuda.length ? 1 : 0;
      totales.pagos += registros.length;
      totales.pendientes += deuda.length;
      totales.abonado += registros.reduce((s,[,p])=>s+numero(p.monto),0);
      totales.saldo += deuda.length*numero(c.cuota);
      socios.addRow({nombre:texto(c.nombre),ci:texto(c.ci),telefono:texto(c.telefono),estado,
        inscripcion:fecha(Cuotas.inscripcion(c)),primerVencimiento:fecha(Cuotas.fechaPago(c)),
        cuota:numero(c.cuota),pendientes:deuda.length,saldo:deuda.length*numero(c.cuota),
        total:registros.reduce((s,[,p])=>s+numero(p.monto),0)});
      for (const [periodo,p] of registros.sort(([a],[b])=>a.localeCompare(b))) {
        pagos.addRow({nombre:texto(c.nombre),ci:texto(c.ci),estado:activo?'Activo':'De baja',
          periodo:periodoVisible(periodo),monto:numero(p.monto),fecha:fecha(p.fecha),metodo:texto(p.metodo),nota:texto(p.nota)});
      }
      for (const periodo of deuda) pendientes.addRow({nombre:texto(c.nombre),ci:texto(c.ci),
        periodo:periodoVisible(periodo),vencimiento:fecha(Cuotas.vence(c,periodo)),monto:numero(c.cuota)});
    }
    for (const [concepto,valor] of [
      ['TOTAL DE SOCIOS',clientes.length],['Socios activos',totales.activos],['Socios al día',totales.aldia],
      ['Socios con retraso',totales.retraso],['Socios de baja',totales.baja],
      ['Cuotas pagadas registradas',totales.pagos],['Cuotas pendientes',totales.pendientes],
      ['Cuotas mensuales abonadas (Gs.)',totales.abonado],['Saldo pendiente (Gs.)',totales.saldo],['Fecha del reporte',fecha(hoy)]
    ]) resumen.addRow({concepto,valor});
    resumen.getRow(2).height = 42;
    resumen.getRow(2).eachCell(c=>{c.font={bold:true,size:20,color:{argb:'FF176C61'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE1F3E9'}};c.alignment={vertical:'middle'};});
    for(let fila=2;fila<=10;fila++) resumen.getCell(fila,2).numFmt='#,##0';
    resumen.getCell('B11').numFmt='dd/mm/yyyy';
    const totalDiarios=diarios.reduce((t,p)=>t+numero(p.monto),0);
    resumen.addRow({concepto:'Pases diarios registrados',valor:diarios.length});
    resumen.addRow({concepto:'Total pases diarios (Gs.)',valor:totalDiarios});
    resumen.addRow({concepto:'Recaudación total (Gs.)',valor:totales.abonado+totalDiarios});
    for(let fila=12;fila<=14;fila++)resumen.getCell(fila,2).numFmt='#,##0';
    return libro;
  }
  const api = {crearLibro};
  if (typeof module === 'object') module.exports = api;
  else root.ExportarCuotas = api;
})(typeof window === 'object' ? window : globalThis);
