-- =====================================================================
--  CUOTAS DEL GIMNASIO · Base de datos para Supabase
--  Pegar completo en  SQL Editor > New query  y presionar Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- Para guardar los PIN de los socios de forma cifrada.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
--  TABLAS
-- ---------------------------------------------------------------------

-- Un registro por socio. El PIN se guarda cifrado (pin_hash), nunca en claro.
create table if not exists public.socios (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (char_length(btrim(nombre)) between 2 and 120),
  ci        text not null unique check (ci ~ '^[0-9]{5,10}$'),
  telefono  text not null default '' check (char_length(telefono) <= 40),
  cuota     integer not null check (cuota > 0),            -- guaraníes por mes
  inicio    text not null check (inicio ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),  -- primer mes de cuota, AAAA-MM
  activo    boolean not null default true,
  pin_hash  text not null,
  creado    timestamptz not null default now()
);

-- Un registro por cuota pagada. No puede haber dos pagos del mismo mes para un socio.
create table if not exists public.pagos (
  id              uuid primary key default gen_random_uuid(),
  socio_id        uuid not null references public.socios(id) on delete cascade,
  periodo         text not null check (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),  -- mes que cubre, AAAA-MM
  monto           integer not null check (monto > 0),
  fecha           date not null,                                                  -- día en que se pagó
  metodo          text not null default 'Efectivo'
                  check (metodo in ('Efectivo','Transferencia','Tarjeta','Billetera digital')),
  nota            text not null default '' check (char_length(nota) <= 120),
  creado          timestamptz not null default now(),
  registrado_por  uuid default auth.uid(),
  unique (socio_id, periodo)
);
create index if not exists pagos_socio_idx on public.pagos (socio_id);

-- Personas de recepción autorizadas (cuentas de Supabase Authentication).
create table if not exists public.recepcion (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Control de intentos fallidos de PIN (evita adivinar PIN por fuerza bruta).
create table if not exists public.intentos_login (
  ci      text primary key,
  fallos  integer not null default 0,
  ultimo  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  SEGURIDAD: nadie lee ni escribe tablas sin pasar por estas reglas
-- ---------------------------------------------------------------------
alter table public.socios         enable row level security;
alter table public.pagos          enable row level security;
alter table public.recepcion      enable row level security;
alter table public.intentos_login enable row level security;

revoke all on public.socios, public.pagos, public.recepcion, public.intentos_login
  from public, anon, authenticated;

-- ¿La persona que está conectada es de recepción?
create or replace function public.es_recepcion()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.recepcion where user_id = auth.uid());
$$;

-- Recepción lee socios (sin el PIN) y lee, carga y quita pagos.
grant select (id, nombre, ci, telefono, cuota, inicio, activo, creado)
  on public.socios to authenticated;
grant select, insert, delete on public.pagos to authenticated;

drop policy if exists socios_leer  on public.socios;
drop policy if exists pagos_leer   on public.pagos;
drop policy if exists pagos_crear  on public.pagos;
drop policy if exists pagos_borrar on public.pagos;

create policy socios_leer  on public.socios for select to authenticated using (public.es_recepcion());
create policy pagos_leer   on public.pagos  for select to authenticated using (public.es_recepcion());
create policy pagos_crear  on public.pagos  for insert to authenticated with check (public.es_recepcion());
create policy pagos_borrar on public.pagos  for delete to authenticated using (public.es_recepcion());

-- ---------------------------------------------------------------------
--  FUNCIONES PARA RECEPCIÓN (crear y editar socios, con PIN cifrado)
-- ---------------------------------------------------------------------

create or replace function public.crear_socio(
  p_nombre text, p_ci text, p_telefono text, p_cuota integer, p_inicio text, p_pin text
) returns uuid
language plpgsql security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  if not public.es_recepcion() then raise exception 'sin_permiso' using errcode = '42501'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then raise exception 'pin_invalido'; end if;
  insert into public.socios (nombre, ci, telefono, cuota, inicio, pin_hash)
  values (regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g'),
          regexp_replace(coalesce(p_ci, ''), '\D', '', 'g'),
          btrim(coalesce(p_telefono, '')), p_cuota, p_inicio,
          crypt(p_pin, gen_salt('bf')))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'ci_duplicada';
end $$;

create or replace function public.editar_socio(
  p_id uuid, p_nombre text, p_ci text, p_telefono text, p_cuota integer, p_inicio text,
  p_pin text default null           -- vacío = no cambiar el PIN
) returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.es_recepcion() then raise exception 'sin_permiso' using errcode = '42501'; end if;
  if p_pin is not null and p_pin <> '' and p_pin !~ '^[0-9]{4,6}$' then raise exception 'pin_invalido'; end if;
  update public.socios set
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
    'socio', json_build_object('nombre', s.nombre, 'ci', s.ci, 'inicio', s.inicio, 'cuota', s.cuota),
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
revoke all on function public.crear_socio(text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.editar_socio(uuid, text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.cambiar_estado_socio(uuid, boolean)                from public, anon, authenticated;
revoke all on function public.socio_login(text, text)                            from public, anon, authenticated;

grant execute on function public.es_recepcion()                                     to authenticated;
grant execute on function public.crear_socio(text, text, text, integer, text, text) to authenticated;
grant execute on function public.editar_socio(uuid, text, text, text, integer, text, text) to authenticated;
grant execute on function public.cambiar_estado_socio(uuid, boolean)                to authenticated;
grant execute on function public.socio_login(text, text)                            to anon, authenticated;
