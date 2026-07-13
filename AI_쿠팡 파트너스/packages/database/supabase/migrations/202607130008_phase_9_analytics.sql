create table if not exists public.performance_events (
 id uuid primary key default gen_random_uuid(), publication_id uuid references public.publications(id), affiliate_link_id uuid references public.affiliate_links(id), event_type text not null, event_at timestamptz not null, session_id text, anonymous_user_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.conversions (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.affiliate_providers(id), external_conversion_id text not null, affiliate_link_id uuid references public.affiliate_links(id), product_id uuid references public.products(id), amount numeric, commission numeric, currency text, converted_at timestamptz not null, raw_payload jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(provider_id, external_conversion_id)
);
create index if not exists performance_events_link_event_idx on public.performance_events(affiliate_link_id, event_at);
alter table public.performance_events enable row level security;
alter table public.conversions enable row level security;
