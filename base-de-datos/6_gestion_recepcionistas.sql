-- CONFIGURACIÓN INICIAL (una vez). Ejecutar después de la migración 5.
-- En la última sección cambia CAMBIAR_POR_TU_CORREO por el correo de tu
-- cuenta ACTUAL de recepción. No escribas aquí contraseñas ni claves.
-- Después de ejecutar, cierra sesión y vuelve a entrar al sistema.
begin;
alter table public.recepcion add column if not exists administrador boolean not null default false;

create or replace function public.es_administrador()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.recepcion where user_id=auth.uid() and administrador);
$$;

create or replace function public.listar_recepcionistas()
returns json language plpgsql security definer set search_path=public as $$
begin
  if not public.es_administrador() then raise exception 'sin_permiso' using errcode='42501'; end if;
  return coalesce((select json_agg(json_build_object(
    'user_id',r.user_id,'email',u.email,'administrador',r.administrador,
    'confirmado',u.email_confirmed_at is not null)
    order by r.administrador desc,u.email)
    from public.recepcion r join auth.users u on u.id=r.user_id),'[]'::json);
end $$;

create or replace function public.autorizar_recepcionista(p_correo text)
returns void language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.es_administrador() then raise exception 'sin_permiso' using errcode='42501'; end if;
  select id into v_id from auth.users where lower(email)=lower(btrim(p_correo));
  if v_id is null then raise exception 'cuenta_no_encontrada'; end if;
  insert into public.recepcion(user_id) values(v_id) on conflict(user_id) do nothing;
end $$;

create or replace function public.quitar_recepcionista(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare protegido boolean;
begin
  if not public.es_administrador() then raise exception 'sin_permiso' using errcode='42501'; end if;
  select administrador into protegido from public.recepcion where user_id=p_user_id for update;
  if coalesce(protegido,false) or p_user_id=auth.uid() then raise exception 'administrador_protegido'; end if;
  delete from public.recepcion where user_id=p_user_id;
end $$;

revoke all on function public.es_administrador() from public,anon,authenticated;
revoke all on function public.listar_recepcionistas() from public,anon,authenticated;
revoke all on function public.autorizar_recepcionista(text) from public,anon,authenticated;
revoke all on function public.quitar_recepcionista(uuid) from public,anon,authenticated;
grant execute on function public.es_administrador() to authenticated;
grant execute on function public.listar_recepcionistas() to authenticated;
grant execute on function public.autorizar_recepcionista(text) to authenticated;
grant execute on function public.quitar_recepcionista(uuid) to authenticated;

-- CAMBIA SOLO EL CORREO ENTRE COMILLAS DE ESTA LÍNEA:
do $$
declare correo_admin text := 'CAMBIAR_POR_TU_CORREO';
begin
  update public.recepcion r set administrador=true
    from auth.users u where u.id=r.user_id and lower(u.email)=lower(btrim(correo_admin));
  if not found then
    raise exception 'No existe una cuenta de recepción con ese correo. Cambia CAMBIAR_POR_TU_CORREO por el correo con el que ya entras a Recepción.';
  end if;
end $$;
notify pgrst,'reload schema';
commit;
