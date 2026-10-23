-- =====================================================================
--  SOCIOS DE EJEMPLO (OPCIONAL) · solo para probar
--  Crea 6 socios con pagos, todos con PIN 1234.
--  Cédulas de 1000101 a 1000106.
--  Para borrarlos después, ejecuta la última línea de este archivo.
-- =====================================================================

do $$
declare
  r record;
  v_id uuid;
  v_hoy timestamp := date_trunc('month', current_date::timestamp);
begin
  for r in select * from (values
    ('María Fernanda Giménez', '1000101', '0981 000 101', 150000, 8,  0),
    ('Carlos Benítez',         '1000102', '0982 000 102', 150000, 5, -1),
    ('Lucía Ayala',            '1000103', '0983 000 103', 180000, 6, -3),
    ('Diego Romero',           '1000104', '0984 000 104', 150000, 3,  1),
    ('Sofía Villalba',         '1000105', '0985 000 105', 200000, 11, 0),
    ('Julio Cáceres',          '1000106', '0986 000 106', 150000, 4, -4)
  ) as t(nombre, ci, tel, cuota, desde, hasta)
  loop
    v_id := null;
    insert into public.socios (nombre, ci, telefono, cuota, inicio, pin_hash)
    values (r.nombre, r.ci, r.tel, r.cuota,
            to_char(v_hoy - make_interval(months => r.desde), 'YYYY-MM'),
            extensions.crypt('1234', extensions.gen_salt('bf')))
    on conflict (ci) do nothing
    returning id into v_id;

    if v_id is not null then
      insert into public.pagos (socio_id, periodo, monto, fecha, metodo)
      select v_id, to_char(d, 'YYYY-MM'), r.cuota,
             least((d + interval '4 days')::date, current_date),
             (array['Efectivo','Transferencia','Tarjeta','Billetera digital'])[1 + (extract(month from d)::int % 4)]
      from generate_series(v_hoy - make_interval(months => r.desde),
                           v_hoy + make_interval(months => r.hasta),
                           interval '1 month') as d;
    end if;
  end loop;
end $$;

-- PARA BORRAR LOS EJEMPLOS (quita los dos guiones del inicio y ejecuta):
-- delete from public.socios where ci in ('1000101','1000102','1000103','1000104','1000105','1000106');
