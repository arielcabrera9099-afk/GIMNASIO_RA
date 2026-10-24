const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
test('pases diarios persistentes e independientes, con validación y acceso solo de recepción',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 const staff='00000000-0000-4000-8000-000000000001',otro='00000000-0000-4000-8000-000000000002';
 try {
 await db.exec(`create schema auth;create schema extensions;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../base-de-datos/1_crear_base_de_datos.sql'),'utf8'));
 const sql=fs.readFileSync(path.join(__dirname,'../base-de-datos/7_pases_diarios.sql'),'utf8');await db.exec(sql);await db.exec(sql);
 await db.exec(`insert into auth.users values('${staff}'),('${otro}');insert into recepcion(user_id)values('${staff}');set role anon;`);
 await assert.rejects(db.query('select nombre from pases_diarios'),/permission denied/);
 await assert.rejects(db.query("insert into pases_diarios(nombre,fecha,monto) values('Anónimo',current_date,20000)"),/permission denied/);
 await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${otro}';`);
 assert.equal((await db.query('select nombre from pases_diarios')).rows.length,0);
 await assert.rejects(db.query("insert into pases_diarios(nombre,fecha,monto) values('Sin permiso',current_date,20000)"),/row-level security/);
 await db.exec(`set request.jwt.claim.sub='${staff}';`);
 await db.query("insert into pases_diarios(nombre,ci,fecha,monto,metodo,nota)values('Visita diaria','0012345',current_date,20000,'Efectivo','Prueba')");
 await db.query("insert into pases_diarios(nombre,fecha,monto)values('Visita diaria',current_date-1,15000)");
 const lista=await db.query('select nombre,ci,monto from pases_diarios order by monto desc');assert.equal(lista.rows.length,2);assert.equal(lista.rows[0].ci,'0012345');assert.equal(lista.rows[1].ci,'');
 for(const values of ["'Fecha futura',current_date+1,20000","'Monto cero',current_date,0","'Fecha inválida',date '1899-12-31',20000"]) await assert.rejects(db.query('insert into pases_diarios(nombre,fecha,monto)values('+values+')'),/check constraint/);
 await assert.rejects(db.query("insert into pases_diarios(nombre,ci,fecha,monto)values('CI inválida','123',current_date,20000)"),/check constraint/);
 await assert.rejects(db.query(`insert into pases_diarios(nombre,fecha,monto,registrado_por)values('Suplantar',current_date,20000,'${otro}')`),/permission denied/);
 await assert.rejects(db.query('update pases_diarios set monto=1'),/permission denied/);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int as n from socios')).rows[0].n,0);assert.equal((await db.query('select count(*)::int as n from pagos')).rows[0].n,0);
 assert.equal((await db.query(`select count(*)::int as n from pases_diarios where registrado_por='${staff}'`)).rows[0].n,2);
 }finally{await db.close()}
});
