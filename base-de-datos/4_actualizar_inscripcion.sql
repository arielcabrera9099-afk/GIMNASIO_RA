-- Ejecutar UNA VEZ después de la instalación anterior, antes de publicar el sitio nuevo.
-- No elimina socios ni pagos. Se puede volver a ejecutar.
begin;
-- Fecha real de inscripción. Los registros anteriores conservan el primer día
-- de su mes de inicio; recepción puede corregirlo sin borrar los pagos.
alter table public.socios add column if not exists inscripcion date;
update public.socios set inscripcion = (inicio || '-01')::date where inscripcion is null;
alter table public.socios alter column inscripcion set not null;
grant select (inscripcion) on public.socios to authenticated;

-- Sustituir las firmas anteriores evita RPC ambiguas en PostgREST.
drop function if exists public.crear_socio(text,text,text,integer,text,text);
drop function if exists public.editar_socio(uuid,text,text,text,integer,text,text);

-- ---------------------------------------------------------------------
--  FUNCIONES PARA RECEPCIÓN (crear y editar socios, con PIN cifrado)
-- ---------------------------------------------------------------------

create or replace function public.crear_socio(
  p_nombre text, p_ci text, p_telefono text, p_cuota integer, p_inicio text, p_pin text, p_inscripcion date default null
) returns uuid
language plpgsql security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  if not public.es_recepcion() then raise exception 'sin_permiso' using errcode = '42501'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then raise exception 'pin_invalido'; end if;
  if p_inscripcion is null or p_inscripcion > current_date or p_inscripcion < date '1900-01-01' or to_char(p_inscripcion,'YYYY-MM') <> p_inicio then raise exception 'inscripcion_invalida'; end if;
  insert into public.socios (nombre, ci, telefono, cuota, inicio, pin_hash, inscripcion)
  values (regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g'),
          regexp_replace(coalesce(p_ci, ''), '\D', '', 'g'),
          btrim(coalesce(p_telefono, '')), p_cuota, p_inicio,
          crypt(p_pin, gen_salt('bf')), p_inscripcion)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'ci_duplicada';
end $$;

create or replace function public.editar_socio(
  p_id uuid, p_nombre text, p_ci text, p_telefono text, p_cuota integer, p_inicio text,
  p_pin text default null, p_inscripcion date default null -- vacío = no cambiar el PIN
) returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.es_recepcion() then raise exception 'sin_permiso' using errcode = '42501'; end if;
  if p_pin is not null and p_pin <> '' and p_pin !~ '^[0-9]{4,6}$' then raise exception 'pin_invalido'; end if;
  if p_inscripcion is null or p_inscripcion > current_date or p_inscripcion < date '1900-01-01' or to_char(p_inscripcion,'YYYY-MM') <> p_inicio then raise exception 'inscripcion_invalida'; end if;
  if exists(select 1 from public.pagos where socio_id=p_id and (periodo < p_inicio or fecha < p_inscripcion)) then raise exception 'inscripcion_posterior_a_pagos'; end if;
  update public.socios set
    inscripcion = p_inscripcion,
    nombre   = regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g'),
    ci       = regexp_replace(coalesce(p_ci, ''), '\D', '', 'g'),
    telefono = btrim(coalesce(p_telefono, '')),
    cuota    = p_cuota,
    inicio   = p_inicio,
    pin_hash = case when p_pin is null or p_pin = '' then pin_hash else crypt(p_pin, gen_salt('bf')) end
  where id = p_id;
  if not found then raise exception 'socio_no_encontrado'; end if;
  -- Un PIN nuevo también destraba al socio si estaba bloqueado.
  if p_pin is not null and p_pin <> '' then
    delete from public.intentos_login where ci = regexp_replace(coalesce(p_ci, ''), '\D', '', 'g');
  end if;
exception when unique_violation then
  raise exception 'ci_duplicada';
end $$;

create or replace function public.cambiar_estado_socio(p_id uuid, p_activo boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.es_recepcion() then raise exception 'sin_permiso' using errcode = '42501'; end if;
  update public.socios set activo = p_activo where id = p_id;
  if not found then raise exception 'socio_no_encontrado'; end if;
end $$;

-- ---------------------------------------------------------------------
--  FUNCIÓN PARA SOCIOS (entrar con cédula + PIN y ver solo lo propio)
-- ---------------------------------------------------------------------
-- 5 intentos fallidos seguidos bloquean esa cédula durante 15 minutos.
create or replace function public.socio_login(p_ci text, p_pin text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_ci text := regexp_replace(coalesce(p_ci, ''), '\D', '', 'g');
  s public.socios;
  i public.intentos_login;
  v_ok boolean;
begin
  select * into s from public.socios where ci = v_ci;
  if not found then
    return json_build_object('ok', false);
  end if;

  select * into i from public.intentos_login where ci = v_ci;
  if found and i.fallos >= 5 and i.ultimo > now() - interval '15 minutes' then
    return json_build_object('ok', false, 'bloqueado', true);
  end if;

  v_ok := s.activo and coalesce(p_pin, '') <> '' and s.pin_hash = crypt(p_pin, s.pin_hash);
  if not v_ok then
    insert into public.intentos_login (ci, fallos, ultimo) values (v_ci, 1, now())
    on conflict (ci) do update set
      fallos = case when public.intentos_login.ultimo < now() - interval '15 minutes'
                    then 1 else public.intentos_login.fallos + 1 end,
      ultimo = now();
    return json_build_object('ok', false);
  end if;

  delete from public.intentos_login where ci = v_ci;
  return json_build_object(
    'ok', true,
    'socio', json_build_object('nombre', s.nombre, 'ci', s.ci, 'inicio', s.inicio, 'inscripcion', s.inscripcion, 'cuota', s.cuota),
    'pagos', coalesce((
      select json_agg(json_build_object('periodo', p.periodo, 'monto', p.monto,
                                        'fecha', p.fecha, 'metodo', p.metodo)
                      order by p.periodo desc)
      from public.pagos p where p.socio_id = s.id), '[]'::json)
  );
end $$;

-- ---------------------------------------------------------------------
--  PERMISOS DE LAS FUNCIONES
-- ---------------------------------------------------------------------
revoke all on function public.es_recepcion()                                     from public, anon, authenticated;
revoke all on function public.crear_socio(text, text, text, integer, text, text, date) from public, anon, authenticated;
revoke all on function public.editar_socio(uuid, text, text, text, integer, text, text, date) from public, anon, authenticated;
revoke all on function public.cambiar_estado_socio(uuid, boolean)                from public, anon, authenticated;
revoke all on function public.socio_login(text, text)                            from public, anon, authenticated;

grant execute on function public.es_recepcion()                                     to authenticated;
grant execute on function public.crear_socio(text, text, text, integer, text, text, date) to authenticated;
grant execute on function public.editar_socio(uuid, text, text, text, integer, text, text, date) to authenticated;
grant execute on function public.cambiar_estado_socio(uuid, boolean)                to authenticated;
grant execute on function public.socio_login(text, text)                            to anon, authenticated;

-- Todas las escrituras respetan la fecha de inscripción y el período inicial.
create or replace function public.validar_inscripcion_socio()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.inscripcion is null then new.inscripcion := (new.inicio || '-01')::date; end if;
  if to_char(new.inscripcion,'YYYY-MM') <> new.inicio then raise exception 'inscripcion_invalida'; end if;
  return new;
end $$;
drop trigger if exists socio_inscripcion on public.socios;
create trigger socio_inscripcion before insert or update on public.socios
for each row execute function public.validar_inscripcion_socio();

create or replace function public.validar_fecha_pago()
returns trigger language plpgsql security definer set search_path = public as $$
declare fecha_inscripcion date;
begin
  select inscripcion into fecha_inscripcion from public.socios where id = new.socio_id;
  if fecha_inscripcion is null or new.fecha < fecha_inscripcion or new.fecha > current_date
     or new.periodo < to_char(fecha_inscripcion,'YYYY-MM') then
    raise exception 'fecha_pago_invalida';
  end if;
  return new;
end $$;
drop trigger if exists pago_fecha on public.pagos;
create trigger pago_fecha before insert or update on public.pagos
for each row execute function public.validar_fecha_pago();

commit;
