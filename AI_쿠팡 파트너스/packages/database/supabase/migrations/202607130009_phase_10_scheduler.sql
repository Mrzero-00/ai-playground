create table if not exists public.agent_runs (
 id uuid primary key default gen_random_uuid(), workflow_run_id uuid not null references public.workflow_runs(id), agent_name text not null, provider text not null, model text not null, prompt_version_id uuid references public.prompt_versions(id), input jsonb not null, output jsonb, token_usage jsonb, cost numeric, status text not null, error jsonb, started_at timestamptz not null, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workflow_steps (
 id uuid primary key default gen_random_uuid(), workflow_run_id uuid not null references public.workflow_runs(id), step_name text not null, status text not null, attempt_count integer not null default 0, output jsonb, error jsonb, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workflow_run_id, step_name)
);
create index if not exists agent_runs_workflow_started_idx on public.agent_runs(workflow_run_id, started_at);
alter table public.agent_runs enable row level security;
alter table public.workflow_steps enable row level security;
