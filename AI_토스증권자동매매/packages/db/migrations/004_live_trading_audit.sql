create table if not exists live_order_audit (id uuid primary key default gen_random_uuid(), idempotency_key uuid not null unique, environment text not null check (environment in ('sandbox','production')), symbol text not null, side text not null, request jsonb not null, response jsonb, readiness jsonb not null, created_at timestamptz not null default now());
alter table live_order_audit enable row level security;
comment on table live_order_audit is 'Service-role-only immutable audit trail; no client RLS policies by design.';
