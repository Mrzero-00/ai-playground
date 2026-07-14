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

create table if not exists public.supply_items (
  home_id text not null references public.homes(id) on delete cascade,
  id text not null,
  name text not null,
  unit text not null,
  purchase_date date not null,
  purchase_quantity numeric not null check (purchase_quantity > 0),
  weekly_usage numeric not null check (weekly_usage > 0),
  safety_stock numeric not null default 0 check (safety_stock >= 0),
  reminder_days_before integer not null default 7 check (reminder_days_before between 0 and 90),
  updated_at timestamptz not null default now(),
  primary key (home_id, id)
);

create index if not exists supply_items_home_idx on public.supply_items(home_id);
alter table public.supply_items enable row level security;
revoke all on table public.supply_items from anon, authenticated;

comment on table public.supply_items is 'Household consumables used to predict check and repurchase dates.';
