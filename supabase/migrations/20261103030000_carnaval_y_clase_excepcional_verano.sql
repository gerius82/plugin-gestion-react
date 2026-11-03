insert into public.feriados (fecha, descripcion)
values
  (date '2027-02-08', 'Carnaval'),
  (date '2027-02-09', 'Carnaval')
on conflict (fecha) do update
set descripcion = excluded.descripcion;

create table if not exists public.clases_excepcionales (
  id uuid primary key default gen_random_uuid(),
  ciclo_codigo text not null references public.ciclos(codigo) on update cascade on delete cascade,
  sede text not null,
  fecha_original date not null,
  dia_original text not null,
  hora_original text not null,
  fecha_reprogramada date not null,
  dia_reprogramado text not null,
  hora_reprogramada text not null,
  motivo text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (ciclo_codigo, sede, fecha_original, hora_original)
);

create index if not exists clases_excepcionales_fecha_idx
  on public.clases_excepcionales (ciclo_codigo, fecha_reprogramada, sede);

alter table public.clases_excepcionales enable row level security;

drop policy if exists "clases_excepcionales_lectura_publica" on public.clases_excepcionales;
create policy "clases_excepcionales_lectura_publica"
  on public.clases_excepcionales
  for select
  to anon, authenticated
  using (true);

grant select on public.clases_excepcionales to anon, authenticated;
revoke insert, update, delete on public.clases_excepcionales from anon, authenticated;

insert into public.clases_excepcionales (
  ciclo_codigo,
  sede,
  fecha_original,
  dia_original,
  hora_original,
  fecha_reprogramada,
  dia_reprogramado,
  hora_reprogramada,
  motivo,
  activo
)
values
  (
    'TDV_2027',
    'Calle Mendoza',
    date '2027-02-09',
    'Martes',
    '18:30 a 20:00',
    date '2027-02-12',
    'Viernes',
    '18:30 a 20:00',
    'Reprogramación por feriado de Carnaval',
    true
  ),
  (
    'TDV_2027',
    'Fisherton',
    date '2027-02-09',
    'Martes',
    '18:30 a 20:00',
    date '2027-02-12',
    'Viernes',
    '18:30 a 20:00',
    'Reprogramación por feriado de Carnaval',
    true
  )
on conflict (ciclo_codigo, sede, fecha_original, hora_original) do update
set dia_original = excluded.dia_original,
    fecha_reprogramada = excluded.fecha_reprogramada,
    dia_reprogramado = excluded.dia_reprogramado,
    hora_reprogramada = excluded.hora_reprogramada,
    motivo = excluded.motivo,
    activo = excluded.activo;
