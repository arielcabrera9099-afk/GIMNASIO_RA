/* Exportación XLSX local: solo datos de recepción, sin enviar archivos a terceros. */
(function(root) {
  'use strict';
  function crearLibro(clientes, hoy, ExcelJS, Cuotas) {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'RA GYM';
    const fecha = iso => Cuotas.valida(iso) ? new Date(iso + 'T00:00:00Z') : null;
    const texto = v => String(v ?? '');
    const numero = v => Number(v) || 0;
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
    const pagos = hoja('Pagos registrados', [
      ['Socio','nombre',32],['CI','ci',18,'@'],['Estado del socio','estado'],
      ['Período de cuota','periodo',20,'@'],['Monto (Gs.)','monto',20,'#,##0'],
      ['Fecha de pago','fecha',20,'dd/mm/yyyy'],['Método de pago','metodo'],['Nota','nota',45]
    ]);
    const socios = hoja('Resumen de socios', [
      ['Socio','nombre',32],['CI','ci',18,'@'],['Teléfono','telefono',22,'@'],['Estado','estado',22],
      ['Inscripción','inscripcion',20,'dd/mm/yyyy'],['Primer vencimiento','primerVencimiento',22,'dd/mm/yyyy'],
      ['Cuota mensual (Gs.)','cuota',23,'#,##0'],['Cuotas pendientes','pendientes',22,'0'],
      ['Saldo pendiente (Gs.)','saldo',25,'#,##0'],['Total abonado (Gs.)','total',24,'#,##0']
    ]);
    const pendientes = hoja('Cuotas pendientes', [
      ['Socio','nombre',32],['CI','ci',18,'@'],['Período de cuota','periodo',20,'@'],
      ['Vencimiento','vencimiento',20,'dd/mm/yyyy'],['Monto (Gs.)','monto',20,'#,##0']
    ]);
    for (const c of [...clientes].sort((a,b)=>texto(a.nombre).localeCompare(texto(b.nombre),'es'))) {
      const registros = Object.entries(c.pagos || {}).filter(([,v])=>v);
      const activo = c.activo !== false;
      const deuda = activo ? Cuotas.estado(c,hoy).adeuda : [];
      const estado = activo ? (deuda.length ? 'Con retraso' : 'Al día') : 'De baja';
      socios.addRow({nombre:texto(c.nombre),ci:texto(c.ci),telefono:texto(c.telefono),estado,
        inscripcion:fecha(Cuotas.inscripcion(c)),primerVencimiento:fecha(Cuotas.fechaPago(c)),
        cuota:numero(c.cuota),pendientes:deuda.length,saldo:deuda.length*numero(c.cuota),
        total:registros.reduce((s,[,p])=>s+numero(p.monto),0)});
      for (const [periodo,p] of registros.sort(([a],[b])=>a.localeCompare(b))) {
        pagos.addRow({nombre:texto(c.nombre),ci:texto(c.ci),estado:activo?'Activo':'De baja',
          periodo:texto(periodo),monto:numero(p.monto),fecha:fecha(p.fecha),metodo:texto(p.metodo),nota:texto(p.nota)});
      }
      for (const periodo of deuda) pendientes.addRow({nombre:texto(c.nombre),ci:texto(c.ci),
        periodo,vencimiento:fecha(Cuotas.vence(c,periodo)),monto:numero(c.cuota)});
    }
    return libro;
  }
  const api = {crearLibro};
  if (typeof module === 'object') module.exports = api;
  else root.ExportarCuotas = api;
})(typeof window === 'object' ? window : globalThis);
