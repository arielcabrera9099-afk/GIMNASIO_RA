const {test}=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const Cuotas=require('../sitio/cuotas.js');
const {crearLibro}=require('../sitio/exportar.js');
const clientes=[
 {nombre:'María Giménez',ci:'0012345',telefono:'0981234567',cuota:150000,inicio:'2026-09',inscripcion:'2026-09-23',fecha_pago:'2026-09-23',activo:true,pagos:{'2026-09':{monto:150000,fecha:'2026-09-23',metodo:'Efectivo',nota:'=HYPERLINK("https://example.test")'}}},
 {nombre:'Carlos Benítez',ci:'5123456',cuota:180000,inicio:'2026-09',inscripcion:'2026-09-28',activo:false,pagos:{'2026-09':{monto:180000,fecha:'2026-09-28',metodo:'Transferencia'}}}
];
test('XLSX legible con todos los pagos, bajas, acentos, CI con ceros, fechas y montos numéricos',async()=>{
 const out=crearLibro(clientes,'2026-10-23',ExcelJS,Cuotas);
 const bytes=await out.xlsx.writeBuffer();assert.equal(Buffer.from(bytes).subarray(0,2).toString(),'PK');
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes);
 assert.deepEqual(loaded.worksheets.map(h=>h.name),['Resumen general','Pagos registrados','Resumen de socios','Cuotas pendientes']);
 const h=loaded.getWorksheet('Pagos registrados');assert.equal(h.rowCount,3);
 assert.equal(h.getCell('A3').value,'María Giménez');assert.equal(h.getCell('B3').value,'0012345');
 assert.equal(h.getCell('D3').value,'SEPTIEMBRE(2026)');assert.equal(h.getCell('D3').type,ExcelJS.ValueType.String);
 assert.equal(loaded.views[0].activeTab,0);assert.equal(loaded.worksheets[0].getCell('B2').value,2);
 assert.equal(h.getCell('C2').value,'De baja');assert.equal(h.getCell('E3').value,150000);
 assert(h.getCell('F3').value instanceof Date);assert.equal(h.getCell('F3').value.toISOString(),'2026-09-23T00:00:00.000Z');
 assert.equal(h.getCell('F3').numFmt,'dd/mm/yyyy');assert.equal(h.getCell('E3').numFmt,'#,##0');
 assert.equal(h.getCell('H3').value,clientes[0].pagos['2026-09'].nota);assert.equal(h.getCell('H3').type,ExcelJS.ValueType.String);
 assert.equal(h.views[0].ySplit,1);assert(h.autoFilter);
});
test('resumen y pendientes coinciden con las reglas y no cobran cuotas nuevas a bajas',()=>{
 const out=crearLibro(clientes,'2026-10-23',ExcelJS,Cuotas);
 const s=out.getWorksheet('Resumen de socios');assert.equal(s.getCell('D2').value,'De baja');assert.equal(s.getCell('H2').value,0);
 assert.equal(s.getCell('D3').value,'Con retraso');assert.equal(s.getCell('H3').value,1);assert.equal(s.getCell('I3').value,150000);assert.equal(s.getCell('J3').value,150000);
 const p=out.getWorksheet('Cuotas pendientes');assert.equal(p.rowCount,2);assert.equal(p.getCell('C2').value,'OCTUBRE(2026)');assert.equal(p.getCell('D2').value.toISOString(),'2026-10-23T00:00:00.000Z');
});
test('sin datos produce hojas con cabeceras; no modifica los datos originales',async()=>{
 const snapshot=JSON.stringify(clientes);crearLibro(clientes,'2026-10-23',ExcelJS,Cuotas);assert.equal(JSON.stringify(clientes),snapshot);
 const out=crearLibro([],'2026-10-23',ExcelJS,Cuotas);for(const h of out.worksheets.filter(h=>h.name!=='Resumen general'))assert.equal(h.rowCount,1);assert.equal(out.getWorksheet('Resumen general').getCell('B2').value,0);
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await out.xlsx.writeBuffer());assert.equal(loaded.worksheets.length,4);
});

test('total de socios incluye socios sin pagos; resumen distingue activos, bajas, cuotas e importes',async()=>{
 const c=[...clientes,{nombre:'Socio sin pagos',ci:'1234567',cuota:200000,inicio:'2026-11',inscripcion:'2026-10-23',fecha_pago:'2026-11-05',pagos:{}}];
 const out=crearLibro(c,'2026-10-23',ExcelJS,Cuotas);
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await out.xlsx.writeBuffer());
 const h=loaded.getWorksheet('Resumen general');
 const esperado={'TOTAL DE SOCIOS':3,'Socios activos':2,'Socios al día':1,'Socios con retraso':1,'Socios de baja':1,'Cuotas pagadas registradas':2,'Cuotas pendientes':1,'Total abonado (Gs.)':330000,'Saldo pendiente (Gs.)':150000};
 for(let i=2;i<=10;i++)assert.equal(h.getCell(i,2).value,esperado[h.getCell(i,1).value]);
 assert.equal(h.getCell('B11').value.toISOString(),'2026-10-23T00:00:00.000Z');assert.equal(h.getCell('B11').numFmt,'dd/mm/yyyy');
});
test('períodos de enero y diciembre conservan el año y muestran nombres de meses',()=>{
 const c={...clientes[0],pagos:{'2025-12':{monto:100,fecha:'2025-12-31'},'2026-01':{monto:100,fecha:'2026-01-31'}}};
 const h=crearLibro([c],'2026-10-23',ExcelJS,Cuotas).getWorksheet('Pagos registrados');
 assert.equal(h.getCell('D2').value,'DICIEMBRE(2025)');assert.equal(h.getCell('D3').value,'ENERO(2026)');
});
