update public.turnos
set activo = false
where ciclo_codigo = 'TDV_2027';

insert into public.turnos (
  ciclo_codigo,
  sede,
  dia,
  hora,
  cupo_maximo,
  activo
)
values
  ('TDV_2027', 'Calle Mendoza', 'Martes', '18:30 a 20:00', 13, true),
  ('TDV_2027', 'Calle Mendoza', 'Miércoles', '18:30 a 20:00', 13, true),
  ('TDV_2027', 'Calle Mendoza', 'Jueves', '18:30 a 20:00', 13, true),
  ('TDV_2027', 'Calle Mendoza', 'Sábado', '09:30 a 11:00', 13, true),
  ('TDV_2027', 'Calle Mendoza', 'Sábado', '11:30 a 13:00', 13, true),
  ('TDV_2027', 'Fisherton', 'Martes', '18:30 a 20:00', 13, true),
  ('TDV_2027', 'Fisherton', 'Jueves', '18:30 a 20:00', 13, true),
  ('TDV_2027', 'Fisherton', 'Sábado', '09:30 a 11:00', 13, true)
on conflict (ciclo_codigo, sede, dia, hora) do update
set cupo_maximo = excluded.cupo_maximo,
    activo = excluded.activo;

update public.cursos
set turnos_config = jsonb_build_object(
      'Calle Mendoza', jsonb_build_object(
        'Martes', jsonb_build_array('18:30 a 20:00'),
        'Miércoles', jsonb_build_array('18:30 a 20:00'),
        'Jueves', jsonb_build_array('18:30 a 20:00'),
        'Sábado', jsonb_build_array('09:30 a 11:00', '11:30 a 13:00')
      ),
      'Fisherton', jsonb_build_object(
        'Martes', jsonb_build_array('18:30 a 20:00'),
        'Jueves', jsonb_build_array('18:30 a 20:00'),
        'Sábado', jsonb_build_array('09:30 a 11:00')
      )
    ),
    cupos_config = jsonb_build_object(
      'Calle Mendoza', jsonb_build_object(
        'Martes', jsonb_build_object('18:30 a 20:00', 13),
        'Miércoles', jsonb_build_object('18:30 a 20:00', 13),
        'Jueves', jsonb_build_object('18:30 a 20:00', 13),
        'Sábado', jsonb_build_object(
          '09:30 a 11:00', 13,
          '11:30 a 13:00', 13
        )
      ),
      'Fisherton', jsonb_build_object(
        'Martes', jsonb_build_object('18:30 a 20:00', 13),
        'Jueves', jsonb_build_object('18:30 a 20:00', 13),
        'Sábado', jsonb_build_object('09:30 a 11:00', 13)
      )
    )
where ciclo = 'TDV_2027';
