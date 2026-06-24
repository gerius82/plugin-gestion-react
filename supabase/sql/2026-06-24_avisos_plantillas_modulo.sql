alter table public.avisos_plantillas
add column if not exists modulo text;

update public.avisos_plantillas
set modulo = 'avisos'
where modulo is null or btrim(modulo) = '';

alter table public.avisos_plantillas
alter column modulo set default 'avisos';

alter table public.avisos_plantillas
alter column modulo set not null;

create index if not exists avisos_plantillas_modulo_orden_idx
on public.avisos_plantillas (modulo, orden);
