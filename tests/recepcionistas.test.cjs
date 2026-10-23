const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const idAdmin='00000000-0000-4000-8000-000000000001';
const idStaff='00000000-0000-4000-8000-000000000002';
const idNuevo='00000000-0000-4000-8000-000000000003';
test('solo el administrador gestiona accesos; se protege su cuenta y se respetan bajas',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.recepcion(user_id uuid primary key references auth.users(id));alter table public.recepcion enable row level security;revoke all on public.recepcion from public,anon,authenticated;insert into auth.users values('${idAdmin}','admin@example.test',now()),('${idStaff}','staff@example.test',now()),('${idNuevo}','nuevo@example.test',null);insert into recepcion values('${idAdmin}'),('${idStaff}');`);
 const sql=fs.readFileSync(path.join(__dirname,'../base-de-datos/6_gestion_recepcionistas.sql'),'utf8').replace('correo_admin text := \'CAMBIAR_POR_TU_CORREO\'','correo_admin text := \'admin@example.test\'');
 await db.exec(sql);await db.exec(sql);
 await db.exec(`set role anon;`);
 await assert.rejects(db.query('select listar_recepcionistas()'),/permission denied/);
 await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${idStaff}';`);
 assert.equal((await db.query('select es_administrador() as a')).rows[0].a,false);
 await assert.rejects(db.query('select listar_recepcionistas()'),/sin_permiso/);
 await assert.rejects(db.query("select autorizar_recepcionista('nuevo@example.test')"),/sin_permiso/);
 await assert.rejects(db.query(`select quitar_recepcionista('${idAdmin}')`),/sin_permiso/);
 await assert.rejects(db.query('update recepcion set administrador=true'),/permission denied/);
 await db.exec(`set request.jwt.claim.sub='${idAdmin}';`);
 assert.equal((await db.query('select es_administrador() as a')).rows[0].a,true);
 await db.query("select autorizar_recepcionista(' NUEVO@example.test ')");await db.query("select autorizar_recepcionista('nuevo@example.test')");
 const lista=(await db.query('select listar_recepcionistas() as cuentas')).rows[0].cuentas;
 assert.equal(lista.length,3);assert.equal(lista.find(u=>u.user_id===idNuevo).administrador,false);assert.equal(lista.find(u=>u.user_id===idNuevo).confirmado,false);
 await assert.rejects(db.query("select autorizar_recepcionista('inexistente@example.test')"),/cuenta_no_encontrada/);
 await assert.rejects(db.query(`select quitar_recepcionista('${idAdmin}')`),/administrador_protegido/);
 await db.query(`select quitar_recepcionista('${idStaff}')`);
 await db.exec(`set request.jwt.claim.sub='${idStaff}';`);
 await assert.rejects(db.query('select listar_recepcionistas()'),/sin_permiso/);
 await db.exec(`reset role;`);
 assert.equal((await db.query(`select count(*)::int as n from recepcion where user_id='${idStaff}'`)).rows[0].n,0);
 }finally{await db.close()}
});
