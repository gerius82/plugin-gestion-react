create table if not exists public.encuesta_colonia_config (
  id text primary key default 'global' check (id = 'global'),
  visible boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.encuesta_colonia_config (id, visible)
values ('global', false)
on conflict (id) do nothing;

alter table public.encuesta_colonia_config enable row level security;

revoke all on table public.encuesta_colonia_config from anon, authenticated;
grant all on table public.encuesta_colonia_config to service_role;

comment on table public.encuesta_colonia_config is
  'Control administrativo de publicación de la encuesta Colonia Tecnológica 2027.';

