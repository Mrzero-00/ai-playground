create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.affiliate_providers (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.affiliate_providers(id),
  external_product_id text not null, name text not null, category_path jsonb not null default '[]'::jsonb,
  brand text, canonical_url text, image_url text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider_id, external_product_id)
);

create table if not exists public.product_snapshots (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  price numeric check (price is null or price >= 0), currency text, review_count integer check (review_count is null or review_count >= 0),
  rating numeric check (rating is null or rating between 0 and 5), is_available boolean,
  raw_payload jsonb not null, captured_at timestamptz not null default now()
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(), workflow_name text not null, idempotency_key text not null unique,
  status text not null check (status in ('PENDING','RUNNING','COMPLETED','PARTIAL_FAILURE','FAILED','REVIEW_REQUIRED')),
  input jsonb not null default '{}'::jsonb, output jsonb, error jsonb,
  started_at timestamptz not null default now(), completed_at timestamptz
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(), prompt_key text not null, version integer not null check (version > 0),
  template text not null, schema jsonb, is_active boolean not null default false,
  created_at timestamptz not null default now(), unique(prompt_key, version)
);

create unique index if not exists prompt_versions_one_active_per_key
  on public.prompt_versions(prompt_key) where is_active;
create index if not exists product_snapshots_product_captured_idx on public.product_snapshots(product_id, captured_at desc);
create index if not exists workflow_runs_name_started_idx on public.workflow_runs(workflow_name, started_at desc);

drop trigger if exists affiliate_providers_set_updated_at on public.affiliate_providers;
create trigger affiliate_providers_set_updated_at before update on public.affiliate_providers
for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

alter table public.affiliate_providers enable row level security;
alter table public.products enable row level security;
alter table public.product_snapshots enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.prompt_versions enable row level security;
