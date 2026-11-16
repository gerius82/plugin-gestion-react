create table if not exists public.cap_inscripciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 1 and 100),
  apellido text not null check (char_length(trim(apellido)) between 1 and 100),
  telefono text not null check (char_length(regexp_replace(telefono, '[^0-9]', '', 'g')) >= 8),
  telefono_busqueda text generated always as (
    right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 10)
  ) stored,
  dia text not null check (dia in ('Lunes', 'Miércoles', 'Jueves', 'Viernes')),
  hora text not null default '18:30' check (hora = '18:30'),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists cap_inscripciones_activo_idx
  on public.cap_inscripciones (activo, dia, hora);

create index if not exists cap_inscripciones_telefono_idx
  on public.cap_inscripciones (telefono_busqueda);

alter table public.cap_inscripciones enable row level security;
grant select, insert, update, delete on table public.cap_inscripciones to anon, authenticated;

drop policy if exists "cap_inscripciones_select" on public.cap_inscripciones;
create policy "cap_inscripciones_select"
on public.cap_inscripciones for select
to anon, authenticated
using (true);

drop policy if exists "cap_inscripciones_insert" on public.cap_inscripciones;
create policy "cap_inscripciones_insert"
on public.cap_inscripciones for insert
to anon, authenticated
with check (true);

drop policy if exists "cap_inscripciones_update" on public.cap_inscripciones;
create policy "cap_inscripciones_update"
on public.cap_inscripciones for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "cap_inscripciones_delete" on public.cap_inscripciones;
create policy "cap_inscripciones_delete"
on public.cap_inscripciones for delete
to anon, authenticated
using (true);

comment on table public.cap_inscripciones is
  'Alumnos inscriptos al módulo del Club Atlético Provincial para comunicaciones y avisos.';
