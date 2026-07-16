create table if not exists phase1_runs (
  id uuid primary key,
  status text not null check (status in ('completed','rejected')),
  symbol text not null,
  payload jsonb not null,
  created_at timestamptz not null
);
create table if not exists phase1_stage_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references phase1_runs(id) deferrable initially deferred,
  stage text not null,
  payload jsonb not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists phase1_stage_events_run_idx on phase1_stage_events(run_id, id);
alter table phase1_runs enable row level security;
alter table phase1_stage_events enable row level security;
