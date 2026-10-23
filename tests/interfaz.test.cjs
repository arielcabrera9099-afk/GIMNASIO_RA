const {chromium:pw} = require('playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'../sitio');
const capturas=path.resolve(__dirname,'../capturas');
fs.mkdirSync(capturas,{recursive:true});
let browser,server;
(async()=>{
const chromium=(await import('@sparticuz/chromium')).default;
server=http.createServer((req,res)=>{
 const p=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
 if(!p.startsWith(root+path.sep) && p!==root){res.writeHead(403).end();return;}
 const file=p===root?path.join(root,'index.html'):p;
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const baseURL=`http://127.0.0.1:${server.address().port}`;
browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.clock.install({time:new Date('2026-10-23T12:00:00')});
let staff=false;
const mock=()=>{
 const clients=[
 {id:'a',nombre:'María Giménez',ci:'4123456',cuota:150000,inicio:'2026-09',inscripcion:'2026-09-23',activo:true},
 {id:'b',nombre:'Carlos Benítez',ci:'5123456',cuota:180000,inicio:'2026-09',inscripcion:'2026-09-28',activo:true},
 {id:'c',nombre:'Lucía Ayala',ci:'6123456',cuota:200000,inicio:'2026-09',inscripcion:'2026-09-20',activo:true}];
 const payments=[{socio_id:'a',periodo:'2026-09',monto:150000,fecha:'2026-09-23',metodo:'Efectivo'}, {socio_id:'a',periodo:'2026-10',monto:150000,fecha:'2026-10-23',metodo:'Efectivo'},{socio_id:'b',periodo:'2026-09',monto:180000,fecha:'2026-09-28',metodo:'Efectivo'}];
 const staffAccounts=[{user_id:'admin',email:'recepcion@example.test',administrador:true,confirmado:true,autorizado:true},{user_id:'existente',email:'existente@example.test',administrador:false,confirmado:true,autorizado:false}];
 window.testAdmin=true;window.testCalls=[];
 window.supabase={createClient(url,key,options){
 if(options?.auth?.storageKey==='ra-gym-altas') return {auth:{
 async signUp({email}){window.testCalls.push({name:'signup',email,persistSession:options.auth.persistSession});if(window.testSignupDisabled)return {error:{code:'signup_disabled'}};const u={user_id:email,email,administrador:false,confirmado:false,autorizado:false};staffAccounts.push(u);return {data:{user:{id:u.user_id,identities:[{}]},session:window.testConfirmNow?{}:null},error:null}},
 async signOut(){window.testCalls.push({name:'signout_secundario'})}
 }};
 return {
 auth:{onAuthStateChange(){},async getSession(){return {data:{session:window.testStaff?{}:null}}},async signInWithPassword(){return {data:{session:{}},error:null}},async signOut(){}},
 async rpc(name,args){window.testCalls.push({name,args});if(name==='es_recepcion')return {data:true};
 if(name==='es_administrador')return {data:window.testAdmin};
 if(name==='listar_recepcionistas')return {data:staffAccounts.filter(u=>u.autorizado)};
 if(name==='autorizar_recepcionista'){const u=staffAccounts.find(u=>u.email===args.p_correo);if(!u)return {error:{message:'cuenta_no_encontrada'}};u.autorizado=true;return {error:null}};
 if(name==='quitar_recepcionista'){const u=staffAccounts.find(u=>u.user_id===args.p_user_id);if(u)u.autorizado=false;return {error:null}};if(name==='socio_login')return {data:{ok:true,socio:clients[0],pagos:payments.filter(p=>p.socio_id==='a')}};
 if(name==='crear_socio'){clients.push({id:'d',nombre:args.p_nombre,ci:args.p_ci,cuota:args.p_cuota,inicio:args.p_inicio,inscripcion:args.p_inscripcion,fecha_pago:args.p_fecha_pago,activo:true});return {data:'d'}};return {data:null,error:null}},
 from(table){const q={select(){return q},order(){return q},async range(){return window.testFailLoad ? {data:null,error:{message:'red'}} : {data:table==='socios'?clients:payments,error:null}},async insert(rows){window.testCalls.push({name:'insert_pagos',args:rows});payments.push(...rows);return {error:null}}};return q}
 }}};
};
await page.route('**/vendor/supabase-2.118.0.js',route=>route.fulfill({contentType:'application/javascript',body:`window.testStaff=${staff};(${mock.toString()})();`}));
await page.goto(baseURL);
await page.locator('#lgCi').waitFor();
assert.equal(await page.locator('[data-act=exportar-excel]').count(),0);
assert.equal(await page.locator('[role=tab]').first().textContent(),'Cliente');
assert.equal(await page.locator('#tabCliente').getAttribute('aria-selected'),'true');
await page.screenshot({path:path.join(capturas,'login.png'),fullPage:true});
await page.locator('#tabCliente').focus();await page.keyboard.press('ArrowRight');await page.locator('#stEmail').waitFor();
await page.getByRole('tab',{name:'Cliente',exact:true}).click();
await page.locator('#lgCi').fill('4123456');await page.locator('#lgPin').fill('1234');await page.locator('#lgOk').click();
await page.locator('.membership-status').waitFor();assert.match(await page.locator('.membership-status').textContent(),/Al día/);
await page.screenshot({path:path.join(capturas,'cliente.png'),fullPage:true});
await page.getByRole('button',{name:'Salir',exact:true}).click();
await page.getByRole('tab',{name:'Recepción',exact:true}).click();
await page.locator('#stEmail').fill('recepcion@example.test');await page.locator('#stPass').fill('test-only');await page.locator('#stOk').click();
await page.locator('.row').first().waitFor();assert.equal(await page.locator('.row').count(),3);
await page.getByRole('button',{name:'Recepcionistas',exact:true}).click();await page.locator('.staff-list li').waitFor();
assert.equal(await page.locator('.staff-list [data-act=quitar-recepcionista]').count(),0);
await page.locator('#rpEmail').fill('nuevo@example.test');await page.locator('#rpPass').fill('PruebaSegura123');
await page.getByRole('button',{name:'Crear recepcionista',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('#rpResultado')?.hidden===false);
assert.match(await page.locator('#rpResultado').textContent(),/confirmar/);assert.equal(await page.locator('#rpPass').inputValue(),'');
assert.equal(await page.locator('.staff-list li').count(),2);
const signup=await page.evaluate(()=>window.testCalls.find(c=>c.name==='signup'));assert.equal(signup.persistSession,false);
await page.locator('#rpEmail').fill('existente@example.test');await page.getByRole('button',{name:'Dar acceso a cuenta existente',exact:true}).click();
await page.waitForFunction(()=>document.querySelectorAll('.staff-list li').length===3);
await page.screenshot({path:path.join(capturas,'recepcionistas.png'),fullPage:true});
const quitar=page.locator('.staff-list li').filter({hasText:'nuevo@example.test'}).getByRole('button');await quitar.click();await quitar.click();
await page.waitForFunction(()=>document.querySelectorAll('.staff-list li').length===2);
await page.evaluate(()=>{window.testConfirmNow=true});await page.locator('#rpEmail').fill('inmediato@example.test');await page.locator('#rpPass').fill('PruebaSegura123');await page.getByRole('button',{name:'Crear recepcionista',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.staff-list li').length===3);assert.match(await page.locator('#rpResultado').textContent(),/Ya puede entrar/);assert.equal(await page.evaluate(()=>window.testCalls.filter(c=>c.name==='signout_secundario').length),1);
await page.evaluate(()=>{window.testSignupDisabled=true});await page.locator('#rpEmail').fill('bloqueado@example.test');await page.locator('#rpPass').fill('PruebaSegura123');await page.getByRole('button',{name:'Crear recepcionista',exact:true}).click();
await page.locator('#rpError').waitFor();assert.match(await page.locator('#rpError').textContent(),/desactivadas/);
await page.getByRole('button',{name:'Cerrar',exact:true}).click();assert.equal(await page.locator('.row').count(),3);

await page.locator('[data-f=aldia]').click();assert.equal(await page.locator('.row').count(),2);
await page.locator('[data-f=retraso]').click();assert.equal(await page.locator('.row').count(),1);assert.match(await page.locator('.row').textContent(),/Lucía/);
await page.locator('[data-f=todos]').click();
await page.locator('#busca').fill('maria');assert.equal(await page.locator('.row').count(),1);
await page.locator('#buscaCi').fill('512');assert.equal(await page.locator('.row').count(),0);
await page.locator('#busca').fill('');assert.equal(await page.locator('.row').count(),1);
await page.locator('#buscaCi').fill('');
await page.locator('#busca').fill('maria');
const descarga=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Excel',exact:true}).click();
const archivo=await descarga;assert.equal(archivo.suggestedFilename(),'cuotas-gimnasio-2026-10-23.xlsx');
const ExcelJS=require('exceljs');const libro=new ExcelJS.Workbook();await libro.xlsx.readFile(await archivo.path());
assert.equal(libro.worksheets[0].name,'Resumen general');assert.equal(libro.getWorksheet('Resumen general').getCell('B2').value,3);assert.equal(libro.getWorksheet('Pagos registrados').getCell('D2').value,'SEPTIEMBRE(2026)');assert.equal(libro.getWorksheet('Cuotas pendientes').getCell('C3').value,'OCTUBRE(2026)');assert.equal(libro.getWorksheet('Pagos registrados').rowCount,4);assert.equal(libro.getWorksheet('Resumen de socios').rowCount,4);assert.equal(libro.getWorksheet('Cuotas pendientes').rowCount,3);
assert.equal(await page.locator('.row').count(),1); // El filtro no limita el Excel ni se pierde.
let descargasExtras=0;page.on('download',()=>descargasExtras++);
await page.evaluate(()=>{window.testFailLoad=true});await page.getByRole('button',{name:'Descargar Excel',exact:true}).click();
await page.waitForFunction(()=>!document.querySelector('[data-act=exportar-excel]').disabled);
assert.match(await page.locator('#toast').textContent(),/No se pudo actualizar/);assert.equal(descargasExtras,0);
await page.evaluate(()=>{window.testFailLoad=false});await page.locator('#busca').fill('');
await page.getByRole('button',{name:'Actualizar',exact:true}).click();
await page.screenshot({path:path.join(capturas,'recepcion.png'),fullPage:true});
await page.getByRole('button',{name:'Nuevo socio',exact:true}).click();
assert.equal(await page.locator('#cInicio').inputValue(),'2026-10-23');
assert.equal(await page.locator('#cFechaPago').inputValue(),'2026-10-23');await page.getByRole('button',{name:'📅 Elegir fecha',exact:true}).click();assert.equal(await page.getByRole('button',{name:'23 oct 2026',exact:true}).getAttribute('aria-pressed'),'true');await page.screenshot({path:path.join(capturas,'calendario-fecha.png'),fullPage:true});await page.getByRole('button',{name:'📅 Elegir fecha',exact:true}).click();
await page.locator('#cNombre').fill('Socio Nuevo');await page.locator('#cCi').fill('7654321');await page.locator('#cPin').fill('1234');await page.locator('#cInicio').fill('2026-10-15');await page.locator('#cFechaPago').fill('2026-10-14');await page.locator('#cOk').click();assert.match(await page.locator('#cError').textContent(),/igual o posterior/);await page.getByRole('button',{name:'📅 Elegir fecha',exact:true}).click();assert.equal(await page.getByRole('button',{name:'14 oct 2026',exact:true}).isDisabled(),true);await page.locator('#calMes').selectOption('10');await page.getByRole('button',{name:'5 nov 2026',exact:true}).click();assert.equal(await page.locator('#cFechaPago').inputValue(),'2026-11-05');await page.screenshot({path:path.join(capturas,'nuevo-socio.png'),fullPage:true});await page.locator('#cOk').click();await page.locator('#dlg').waitFor({state:'hidden'});
const create=await page.evaluate(()=>window.testCalls.find(c=>c.name==='crear_socio'));assert.equal(create.args.p_inscripcion,'2026-10-15');assert.equal(create.args.p_inicio,'2026-11');assert.equal(create.args.p_fecha_pago,'2026-11-05');
await page.getByRole('button',{name:'Socio Nuevo',exact:true}).click();await page.getByRole('button',{name:'Editar datos',exact:true}).click();assert.equal(await page.locator('#cFechaPago').inputValue(),'2026-11-05');await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('button',{name:'Cerrar',exact:true}).click();
await page.locator('.row').filter({hasText:'Lucía'}).getByRole('button',{name:'Registrar pago'}).click();
await page.locator('#pgFecha').fill('2026-09-19');await page.locator('#pgOk').click();assert.match(await page.locator('#pgError').textContent(),/inscripción y hoy/);
await page.locator('#pgFecha').fill('2026-10-20');await page.locator('#pgN').fill('2');
await page.screenshot({path:path.join(capturas,'pago.png'),fullPage:true});
await page.locator('#pgOk').click();await page.locator('#dlg').waitFor({state:'hidden'});
const insert=await page.evaluate(()=>window.testCalls.find(c=>c.name==='insert_pagos'));assert.equal(insert.args.length,2);assert.equal(insert.args[0].fecha,'2026-10-20');assert.equal(insert.args[0].periodo,'2026-09');assert.equal(insert.args[1].periodo,'2026-10');
await page.setViewportSize({width:390,height:844});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
for(const row of await page.locator('.row').all()){const name=await row.locator('.r-nom').boundingBox();const status=await row.locator('.r-est').boundingBox();assert(name.y+name.height<=status.y,'El estado no tapa el nombre');}
await page.clock.runFor(4000);
await page.screenshot({path:path.join(capturas,'recepcion-movil.png'),fullPage:true});
await page.getByRole('button',{name:'Salir',exact:true}).click();await page.locator('#lgCi').waitFor();
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(capturas,'login-movil.png'),fullPage:true});
await page.evaluate(()=>{window.testAdmin=false});await page.getByRole('tab',{name:'Recepción',exact:true}).click();await page.locator('#stEmail').fill('normal@example.test');await page.locator('#stPass').fill('test-only');await page.locator('#stOk').click();await page.locator('.row').first().waitFor();assert.equal(await page.getByRole('button',{name:'Recepcionistas',exact:true}).count(),0);await page.getByRole('button',{name:'Nuevo socio',exact:true}).click();await page.getByRole('button',{name:'📅 Elegir fecha',exact:true}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#dlg').evaluate(el=>el.scrollWidth<=el.clientWidth));await page.screenshot({path:path.join(capturas,'calendario-movil.png'),fullPage:true});await page.getByRole('button',{name:'Seleccionar hoy',exact:true}).click();assert.equal(await page.locator('#cFechaPago').inputValue(),'2026-10-23');
assert.deepEqual(errors,[]);
console.log('PASS navegador: calendario con elección de día, cuentas nuevas y existentes, alta sin cambiar sesión, altas deshabilitadas, permisos de administrador;  cliente primero, teclado, login cliente/recepción, vencimientos, filtros de estado/nombre/CI combinados, alta de socio, fecha de pago y múltiples cuotas; descarga XLSX con todos los datos pese a filtros y bloqueo si falla la actualización; móvil sin desbordamiento; sin errores JS. Con Supabase simulado.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
