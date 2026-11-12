alter table public.inscripciones
  add column if not exists telefono_alternativo text;

alter table public.inscripciones
  add column if not exists telefono_alternativo_busqueda text
  generated always as (
    right(regexp_replace(coalesce(telefono_alternativo, ''), '[^0-9]', '', 'g'), 10)
  ) stored;

create index if not exists inscripciones_telefono_alternativo_busqueda_idx
  on public.inscripciones (telefono_alternativo_busqueda);

comment on column public.inscripciones.telefono_alternativo is
  'Teléfono opcional de otro adulto autorizado o pagador asociado al alumno.';
