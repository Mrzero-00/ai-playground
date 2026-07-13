create table if not exists public.publications (
 id uuid primary key default gen_random_uuid(), content_id uuid not null references public.contents(id), channel text not null, external_publication_id text, published_url text, status text not null, scheduled_at timestamptz, published_at timestamptz, error jsonb, attempt_count integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(content_id, channel)
);
create table if not exists public.affiliate_links (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), provider_id uuid not null references public.affiliate_providers(id), destination_url text not null, affiliate_url text not null, tracking_code text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), expires_at timestamptz
);
create index if not exists publications_status_scheduled_idx on public.publications(status, scheduled_at);
alter table public.publications enable row level security;
alter table public.affiliate_links enable row level security;
