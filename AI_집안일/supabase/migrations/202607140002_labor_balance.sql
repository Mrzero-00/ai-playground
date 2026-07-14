alter table public.chores add column if not exists planner_member_id text;
alter table public.chores add column if not exists executor_member_id text;
alter table public.homes add column if not exists assignment_mode text not null default 'shared' check (assignment_mode in ('shared', 'auto'));

create table if not exists public.labor_assessments (
  home_id text not null references public.homes(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  planning_score smallint not null check (planning_score between 0 and 100),
  execution_score smallint not null check (execution_score between 0 and 100),
  answers jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (home_id, user_id)
);

create index if not exists labor_assessments_home_idx on public.labor_assessments(home_id);
alter table public.labor_assessments enable row level security;
revoke all on table public.labor_assessments from anon, authenticated;

comment on table public.labor_assessments is 'Self-reported planning and execution load; not an ability or ranking score.';
