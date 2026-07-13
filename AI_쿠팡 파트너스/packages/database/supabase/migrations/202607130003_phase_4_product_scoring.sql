create table if not exists public.product_candidates (
 id uuid primary key default gen_random_uuid(), workflow_run_id uuid not null references public.workflow_runs(id), product_id uuid not null references public.products(id), market_context_id uuid not null references public.market_contexts(id), status text not null, rank integer, selected boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workflow_run_id, product_id)
);
create table if not exists public.product_scores (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.product_candidates(id), trend_score numeric not null, season_score numeric not null, weather_score numeric not null, conversion_score numeric not null, commission_score numeric not null, content_fit_score numeric not null, penalty_score numeric not null, final_score numeric not null check (final_score between 0 and 100), reasoning jsonb not null, score_version text not null, created_at timestamptz not null default now()
);
create index if not exists product_candidates_run_selected_idx on public.product_candidates(workflow_run_id, selected);
create index if not exists product_scores_final_idx on public.product_scores(final_score desc);
alter table public.product_candidates enable row level security;
alter table public.product_scores enable row level security;
