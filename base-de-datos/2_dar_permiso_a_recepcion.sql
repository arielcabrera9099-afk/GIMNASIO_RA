-- =====================================================================
--  DAR PERMISO DE RECEPCIÓN A UNA CUENTA
--  1) Crea primero el usuario en  Authentication > Users > Add user.
--  2) Cambia el correo de abajo por el de esa persona.
--  3) Pega esto en  SQL Editor > New query  y presiona Run.
--  Repite para cada persona de recepción.
-- =====================================================================

insert into public.recepcion (user_id)
select id from auth.users where email = 'CAMBIAR@CORREO.COM'
on conflict do nothing;

-- Debe mostrar las cuentas con permiso. Si no aparece la tuya, revisa el correo.
select u.email from public.recepcion r join auth.users u on u.id = r.user_id;
