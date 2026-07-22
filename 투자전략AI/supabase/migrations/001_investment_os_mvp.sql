begin;

create extension if not exists pgcrypto;

create type public.strategy_type as enum ('LONG_TERM', 'MOMENTUM');
create type public.lot_strategy as enum ('CORE', 'FUTURE_CORE', 'MOMENTUM');
create type public.decision_status as enum ('PENDING_APPROVAL', 'MANUAL_REVIEW', 'BLOCKED', 'APPROVED', 'REJECTED');
create type public.model_status as enum ('DRAFT', 'TESTING', 'APPROVED', 'ACTIVE', 'DEPRECATED', 'ARCHIVED');
create type public.job_status as enum ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL', 'CANCELLED');

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  base_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  exchange text not null,
  name text not null,
  industry text,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  unique (ticker, exchange)
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED')),
  base_url text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.data_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_id uuid not null references public.data_sources(id),
  kind text not null check (kind in ('MARKET', 'FINANCIAL', 'NEWS', 'INDUSTRY')),
  as_of timestamptz not null,
  collected_at timestamptz not null default now(),
  source_url text,
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED')),
  stale_data boolean not null default false,
  payload jsonb not null,
  unique (company_id, source_id, kind, as_of)
);

create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy text not null check (strategy in ('LONG_TERM', 'MOMENTUM', 'PORTFOLIO', 'RISK')),
  version text not null,
  status public.model_status not null default 'DRAFT',
  parameters jsonb not null default '{}'::jsonb,
  approved_by uuid references auth.users(id),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, strategy, version)
);

create unique index one_active_model_per_strategy
  on public.model_versions(user_id, strategy) where status = 'ACTIVE';

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  strategy public.strategy_type not null,
  model_version_id uuid not null references public.model_versions(id),
  snapshot_ids uuid[] not null default '{}',
  score numeric(5,2) not null check (score between 0 and 100),
  result jsonb not null,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.position_lots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  strategy public.lot_strategy not null,
  opened_at timestamptz not null,
  average_price numeric(20,6) not null check (average_price > 0),
  quantity numeric(20,6) not null check (quantity > 0),
  thesis_id uuid,
  momentum_setup_id uuid,
  exit_policy text not null check (exit_policy in ('THESIS_BREAK', 'VALUATION', 'STOP_LOSS', 'TARGET', 'TIME_STOP')),
  status text not null check (status in ('OPEN', 'PARTIALLY_CLOSED', 'CLOSED')),
  check ((strategy = 'MOMENTUM' and momentum_setup_id is not null and exit_policy in ('STOP_LOSS', 'TARGET', 'TIME_STOP'))
    or (strategy <> 'MOMENTUM' and thesis_id is not null))
);

create table public.allocation_proposals (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  company_id uuid references public.companies(id),
  strategy public.strategy_type not null,
  requested_amount numeric(20,2) not null check (requested_amount > 0),
  approved_amount numeric(20,2) not null check (approved_amount >= 0),
  status text not null check (status in ('APPROVED', 'REDUCED', 'WAIT', 'REJECTED')),
  reasons jsonb not null default '[]'::jsonb,
  constraints_triggered text[] not null default '{}',
  generated_at timestamptz not null
);

create table public.risk_decisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.allocation_proposals(id) on delete cascade,
  status text not null check (status in ('APPROVE', 'APPROVE_WITH_REDUCTION', 'REQUIRE_MANUAL_REVIEW', 'DENY')),
  max_approved_amount numeric(20,2),
  risk_flags text[] not null default '{}',
  rationale text not null,
  evaluated_at timestamptz not null
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  allocation_proposal_id uuid not null references public.allocation_proposals(id),
  risk_decision_id uuid not null references public.risk_decisions(id),
  model_version_ids uuid[] not null default '{}',
  status public.decision_status not null,
  approved_amount numeric(20,2) not null check (approved_amount >= 0),
  reasons jsonb not null default '[]'::jsonb,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.execution_records (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id),
  lot_id uuid not null references public.position_lots(id),
  requested_quantity numeric(20,6) not null check (requested_quantity > 0),
  filled_quantity numeric(20,6) not null check (filled_quantity >= 0 and filled_quantity <= requested_quantity),
  recommended_price numeric(20,6) not null check (recommended_price > 0),
  average_fill_price numeric(20,6),
  status text not null check (status in ('PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED')),
  recorded_at timestamptz not null
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  status public.job_status not null default 'PENDING',
  attempts integer not null default 0,
  failed_components text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  aggregate_id text not null,
  model_version_id uuid references public.model_versions(id),
  payload jsonb not null,
  occurred_at timestamptz not null
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  markdown text not null,
  evidence_ids text[] not null default '{}',
  model_version_ids uuid[] not null default '{}',
  generated_at timestamptz not null,
  private boolean not null default true
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  check (action <> 'RISK_OVERRIDDEN' or length(trim(reason)) > 0)
);

create index snapshots_company_kind_asof on public.data_snapshots(company_id, kind, as_of desc);
create index evaluations_company_strategy_date on public.evaluations(company_id, strategy, evaluated_at desc);
create index lots_portfolio_status on public.position_lots(portfolio_id, status);
create index events_aggregate_date on public.domain_events(aggregate_id, occurred_at);
create index audit_entity_date on public.audit_logs(entity_id, occurred_at);

alter table public.portfolios enable row level security;
alter table public.model_versions enable row level security;
alter table public.evaluations enable row level security;
alter table public.position_lots enable row level security;
alter table public.allocation_proposals enable row level security;
alter table public.risk_decisions enable row level security;
alter table public.decisions enable row level security;
alter table public.execution_records enable row level security;
alter table public.jobs enable row level security;
alter table public.domain_events enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

create policy portfolios_owner_all on public.portfolios for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy models_owner_all on public.model_versions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy evaluations_owner_all on public.evaluations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy decisions_owner_all on public.decisions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy jobs_owner_all on public.jobs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy events_owner_all on public.domain_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reports_owner_all on public.reports for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_owner_select on public.audit_logs for select using (user_id = auth.uid());
create policy audit_owner_insert on public.audit_logs for insert with check (user_id = auth.uid() and actor_id = auth.uid());

create policy lots_portfolio_owner on public.position_lots for all
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid()));
create policy allocations_portfolio_owner on public.allocation_proposals for all
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid()));
create policy risks_proposal_owner on public.risk_decisions for all
  using (exists (select 1 from public.allocation_proposals a join public.portfolios p on p.id = a.portfolio_id where a.id = proposal_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.allocation_proposals a join public.portfolios p on p.id = a.portfolio_id where a.id = proposal_id and p.user_id = auth.uid()));
create policy executions_decision_owner on public.execution_records for all
  using (exists (select 1 from public.decisions d where d.id = decision_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.decisions d where d.id = decision_id and d.user_id = auth.uid()));

commit;
