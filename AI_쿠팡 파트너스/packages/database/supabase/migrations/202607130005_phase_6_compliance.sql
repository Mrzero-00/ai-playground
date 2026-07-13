create table if not exists public.compliance_results (
 id uuid primary key default gen_random_uuid(), content_id uuid not null references public.contents(id), score numeric not null check (score between 0 and 100), passed boolean not null, violations jsonb not null default '[]'::jsonb, required_disclosures jsonb not null default '[]'::jsonb, validator_version text not null, created_at timestamptz not null default now()
);
create index if not exists compliance_results_content_idx on public.compliance_results(content_id, created_at desc);
alter table public.compliance_results enable row level security;
