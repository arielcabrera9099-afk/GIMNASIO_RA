const {test}=require('node:test');const assert=require('node:assert/strict');
const W=require('../sitio/whatsapp.js');const C=require('../sitio/cuotas.js');
const c={nombre:'Lucía Ayala',inicio:'2026-09',inscripcion:'2026-09-20',fecha_pago:'2026-09-20',pagos:{'2026-09':{},'2026-10':{}}};
const filas=[{periodo:'2026-09',monto:200000,fecha:'2026-10-20'},{periodo:'2026-10',monto:200000,fecha:'2026-10-20'}];
const datos={nombre:c.nombre,filas,socio:c,hoy:'2026-10-23',verificado:true,gimnasio:'RA GYM'};
test('números locales paraguayos e internacionales se normalizan sin espacios ni signos',()=>{
 for(const n of ['0981 123456','(0981) 123-456','981123456','+595 981 123456','00595 981123456','595981123456'])assert.equal(W.telefono(n),'595981123456');
 assert.equal(W.telefono('+54 9 11 1234 5678'),'5491112345678');
 for(const n of ['', '123', '0981', '+000000000', '++595981123456','javascript:alert(1)','+595981123456?text=otro','+595981123456 ext 2'])assert.equal(W.telefono(n),'');
});
test('recibo con varios meses incluye montos, fecha, socio y estado real al día',()=>{
 const t=W.mensaje(datos,C);assert.match(t,/REGISTRO DE PAGO EXITOSO/);assert.match(t,/Lucía Ayala/);assert.match(t,/SEPTIEMBRE\(2026\), OCTUBRE\(2026\)/);assert.match(t,/Gs\. 400\.000/);assert.match(t,/20\/10\/2026/);assert.match(t,/Al día/);
 const url=new URL(W.enlace('0981123456',t));assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/595981123456');assert.equal(url.searchParams.get('text'),t);assert.equal([...url.searchParams.keys()].length,1);
});
test('pagos parciales, anticipados y datos sin actualizar no generan falsos estados al día',()=>{
 const parcial=W.mensaje({...datos,filas:[filas[0]],socio:{...c,pagos:{'2026-09':{}}}},C);assert.match(parcial,/Mes abonado/);assert.match(parcial,/1 cuota pendiente/);assert.doesNotMatch(parcial,/Al día/);
 const desconocido=W.mensaje({...datos,verificado:false},C);assert.match(desconocido,/pendiente de verificar/);assert.doesNotMatch(desconocido,/Al día/);
 const adelante=W.mensaje({...datos,filas:[{periodo:'2026-11',monto:200000,fecha:'2026-10-23'}]},C);assert.match(adelante,/NOVIEMBRE\(2026\)/);assert.match(adelante,/Al día/);
 assert.doesNotMatch(W.mensaje({...datos,socio:{...c,activo:false}},C),/Al día/);
});
test('datos de usuario y enlaces no pueden alterar el formato ni ejecutar HTML',()=>{
 const t=W.mensaje({...datos,nombre:'Ana\n*Estado:* Al día & + #',gimnasio:'GYM\n*texto*'},C);
 assert.match(t,/Socio\/a:\* Ana Estado: Al día & \+ #/);assert.equal(new URL(W.enlace('+595981123456',t)).searchParams.get('text'),t);assert.equal(W.enlace('',t),'');
});

test('emojis preservan sus puntos Unicode y se codifican una sola vez en enlaces directos y móviles',()=>{
 const t=W.mensaje(datos,C);assert(t.startsWith(String.fromCodePoint(0x2705)));assert(t.includes(String.fromCodePoint(0x1F3CB)+String.fromCodePoint(0xFE0F)));assert(!t.includes('\uFFFD'));
 for(const web of [false,true]){const href=W.enlace('0981123456',t,web),u=new URL(href);assert.equal(u.searchParams.get('text'),t);assert(href.includes('%E2%9C%85'));assert(href.includes('%F0%9F%8F%8B%EF%B8%8F'));assert(!href.includes('%25E2'));if(web){assert.equal(u.hostname,'web.whatsapp.com');assert.equal(u.searchParams.get('phone'),'595981123456');}}
});
