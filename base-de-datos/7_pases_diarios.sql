-- Pases para visitantes que pagan por día. Ejecutar una sola vez en SQL Editor.
-- No modifica socios ni cuotas mensuales. Se puede repetir.
begin;
create table if not exists public.pases_diarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check(char_length(btrim(nombre)) between 2 and 120),
  ci text not null default '' check(ci='' or ci ~ '^[0-9]{5,10}$'),
  fecha date not null check(fecha>=date '1900-01-01' and fecha<=current_date),
  monto integer not null check(monto>0),
  metodo text not null default 'Efectivo' check(metodo in ('Efectivo','Transferencia','Tarjeta','Billetera digital')),
  nota text not null default '' check(char_length(nota)<=120),
  creado timestamptz not null default now(),
  registrado_por uuid not null default auth.uid()
);
create index if not exists pases_diarios_fecha_idx on public.pases_diarios(fecha);
alter table public.pases_diarios enable row level security;
revoke all on public.pases_diarios from public,anon,authenticated;
grant select(id,nombre,ci,fecha,monto,metodo,nota,creado) on public.pases_diarios to authenticated;
grant insert(nombre,ci,fecha,monto,metodo,nota) on public.pases_diarios to authenticated;
drop policy if exists pases_diarios_leer on public.pases_diarios;
drop policy if exists pases_diarios_crear on public.pases_diarios;
create policy pases_diarios_leer on public.pases_diarios for select to authenticated using(public.es_recepcion());
create policy pases_diarios_crear on public.pases_diarios for insert to authenticated with check(public.es_recepcion() and registrado_por=auth.uid());
notify pgrst,'reload schema';
commit;
