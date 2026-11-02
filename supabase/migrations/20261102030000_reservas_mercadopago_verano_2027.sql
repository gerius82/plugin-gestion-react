create table if not exists public.reservas_mercadopago (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null unique default gen_random_uuid(),
  alumno_id uuid not null references public.inscripciones(id) on delete restrict,
  matricula_id uuid references public.matriculas(id) on delete set null,
  ciclo_codigo text not null default 'TDV_2027',
  concepto text not null default 'Reserva Taller de Verano 2027',
  monto numeric(12, 2) not null default 10000 check (monto > 0),
  moneda text not null default 'ARS',
  estado text not null default 'creando' check (
    estado in ('creando', 'pendiente', 'aprobado', 'rechazado', 'cancelado', 'vencido', 'reintegrado', 'error')
  ),
  external_reference text not null unique,
  idempotency_key uuid not null unique,
  mp_order_id text unique,
  mp_payment_id text,
  checkout_url text,
  payer_email text,
  detalle_estado text,
  respuesta_mp jsonb not null default '{}'::jsonb,
  pagado_en timestamptz,
  ultima_notificacion_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists reservas_mercadopago_alumno_idx
  on public.reservas_mercadopago (alumno_id, ciclo_codigo, creado_en desc);

create index if not exists reservas_mercadopago_estado_idx
  on public.reservas_mercadopago (estado, creado_en desc);

alter table public.reservas_mercadopago enable row level security;

revoke all on table public.reservas_mercadopago from anon, authenticated;

comment on table public.reservas_mercadopago is
  'Órdenes de Mercado Pago para reservas del Taller de Verano. Solo se accede mediante Edge Functions.';
