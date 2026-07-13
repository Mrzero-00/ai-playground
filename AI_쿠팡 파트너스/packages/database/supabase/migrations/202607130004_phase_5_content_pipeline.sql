create table if not exists public.content_plans (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.product_candidates(id), target_audience jsonb not null, problem_statement text not null, content_angle text not null, channels jsonb not null, ai_output jsonb not null, prompt_version_id uuid not null references public.prompt_versions(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.contents (
 id uuid primary key default gen_random_uuid(), content_plan_id uuid not null references public.content_plans(id), channel text not null, title text, body text not null, metadata jsonb not null default '{}'::jsonb, status text not null default 'DRAFT', compliance_score numeric, confidence_score numeric check (confidence_score is null or confidence_score between 0 and 1), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists contents_status_channel_idx on public.contents(status, channel);
alter table public.content_plans enable row level security;
alter table public.contents enable row level security;
