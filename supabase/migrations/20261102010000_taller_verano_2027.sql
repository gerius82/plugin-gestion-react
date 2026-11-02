insert into public.ciclos (
  codigo,
  nombre_publico,
  fecha_inicio,
  fecha_fin,
  activo,
  descripcion,
  orden,
  fecha_inicio_ciclo
)
select
  'TDV_2027',
  'Taller de Verano 2027',
  date '2026-11-08',
  date '2027-02-28',
  true,
  'Taller de verano para los meses de enero y febrero de 2027',
  2,
  date '2027-01-05'
where not exists (
  select 1 from public.ciclos where codigo = 'TDV_2027'
);

insert into public.cursos (
  nombre,
  ciclo,
  descripcion,
  edad_min,
  edad_max,
  imagen_url,
  activo,
  turnos_config,
  precio_curso,
  precio_inscripcion,
  turnos_config_backup,
  cupos_config
)
select
  nombre,
  'TDV_2027',
  descripcion,
  edad_min,
  edad_max,
  imagen_url,
  true,
  turnos_config,
  precio_curso,
  precio_inscripcion,
  turnos_config_backup,
  cupos_config
from public.cursos
where ciclo = 'TDV'
  and not exists (
    select 1 from public.cursos where ciclo = 'TDV_2027'
  )
order by id
limit 1;

insert into public.turnos (
  id,
  ciclo_codigo,
  sede,
  dia,
  hora,
  cupo_maximo,
  activo
)
select
  gen_random_uuid(),
  'TDV_2027',
  source.sede,
  source.dia,
  source.hora,
  source.cupo_maximo,
  source.activo
from public.turnos source
where source.ciclo_codigo = 'TDV'
  and not exists (
    select 1
    from public.turnos target
    where target.ciclo_codigo = 'TDV_2027'
      and target.sede = source.sede
      and target.dia = source.dia
      and target.hora = source.hora
  );

