begin;

alter table public.decisions
  add constraint decisions_id_user_unique unique (id, user_id);

alter table public.decisions
  add constraint decisions_execution_lineage_unique
  unique (id, user_id, allocation_proposal_id, risk_decision_id);

create table public.broker_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker text not null check (broker in ('TOSS')),
  broker_account_seq bigint not null check (broker_account_seq > 0),
  account_alias text not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('READ_ONLY', 'PAPER', 'LIVE_ENABLED', 'SUSPENDED', 'CLOSED')),
  allow_live_orders boolean not null default false,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  unique (id, user_id),
  unique (broker, broker_account_seq),
  check (status <> 'LIVE_ENABLED' or allow_live_orders)
);

create table public.execution_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('DRAFT', 'PAPER', 'APPROVED', 'ACTIVE', 'REVOKED')),
  allowed_modes text[] not null default '{DRY_RUN}',
  account_ids uuid[] not null default '{}',
  max_single_order_notional numeric(30,6) not null check (max_single_order_notional > 0),
  max_daily_order_notional numeric(30,6) not null check (max_daily_order_notional >= max_single_order_notional),
  max_price_drift_bps integer not null check (max_price_drift_bps between 0 and 10000),
  max_data_age_seconds integer not null check (max_data_age_seconds > 0),
  release_evidence_id uuid,
  approved_by uuid references auth.users(id),
  effective_from timestamptz not null,
  expires_at timestamptz,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, version),
  foreign key (release_evidence_id, user_id) references public.release_evidence_bundles(id, user_id),
  check (allowed_modes <@ array['OFF', 'DRY_RUN', 'PAPER', 'LIVE']::text[]),
  check (expires_at is null or effective_from < expires_at),
  check (status not in ('APPROVED', 'ACTIVE') or approved_by is not null),
  check (not ('LIVE' = any(allowed_modes)) or (status = 'ACTIVE' and release_evidence_id is not null))
);

create unique index one_active_execution_policy
  on public.execution_policies(user_id) where status = 'ACTIVE';

create table public.execution_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  broker_account_id uuid not null,
  decision_id uuid not null,
  allocation_proposal_id uuid not null references public.allocation_proposals(id),
  risk_decision_id uuid not null references public.risk_decisions(id),
  portfolio_snapshot_id uuid not null,
  execution_policy_id uuid not null,
  strategy public.lot_strategy not null,
  symbol text not null check (symbol ~ '^[A-Za-z0-9.-]+$'),
  market text not null check (market in ('KR', 'US')),
  side text not null check (side in ('BUY', 'SELL')),
  order_type text not null check (order_type in ('MARKET', 'LIMIT')),
  time_in_force text not null check (time_in_force in ('DAY', 'CLS')),
  quantity numeric(30,6),
  order_amount numeric(30,6),
  limit_price numeric(30,6),
  approved_reference_price numeric(30,6) not null check (approved_reference_price > 0),
  approved_notional numeric(30,6) not null check (approved_notional > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  snapshot_ids uuid[] not null,
  policy_version_ids uuid[] not null,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null,
  data_as_of timestamptz not null,
  expires_at timestamptz not null,
  idempotency_key text not null check (idempotency_key ~ '^[0-9a-f]{64}$'),
  client_order_id text not null check (client_order_id ~ '^[A-Za-z0-9_-]{1,36}$'),
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (broker_account_id, idempotency_key),
  unique (broker_account_id, client_order_id),
  foreign key (portfolio_id, user_id) references public.portfolios(id, user_id),
  foreign key (broker_account_id, user_id) references public.broker_accounts(id, user_id),
  foreign key (decision_id, user_id) references public.decisions(id, user_id),
  foreign key (decision_id, user_id, allocation_proposal_id, risk_decision_id)
    references public.decisions(id, user_id, allocation_proposal_id, risk_decision_id),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id),
  foreign key (execution_policy_id, user_id) references public.execution_policies(id, user_id),
  check ((quantity is not null)::integer + (order_amount is not null)::integer = 1),
  check (quantity is null or quantity > 0),
  check (order_amount is null or order_amount > 0),
  check ((order_type = 'LIMIT' and limit_price > 0) or (order_type = 'MARKET' and limit_price is null)),
  check (not (market = 'KR' and currency <> 'KRW')),
  check (not (market = 'US' and currency <> 'USD')),
  check ((market = 'KR' and symbol ~ '^[0-9]{6}$') or (market = 'US' and symbol ~ '^[A-Za-z0-9.-]+$')),
  check (market <> 'KR' or quantity is null or quantity = trunc(quantity)),
  check (quantity is null or quantity = trunc(quantity) or (market = 'US' and side = 'SELL' and order_type = 'MARKET')),
  check (order_amount is null or (market = 'US' and side = 'BUY' and order_type = 'MARKET')),
  check (time_in_force <> 'CLS' or (market = 'US' and order_type = 'LIMIT')),
  check ((order_amount is not null and approved_notional = order_amount)
    or (quantity is not null and approved_notional >= quantity * approved_reference_price
      and (order_type <> 'LIMIT' or approved_notional >= quantity * limit_price))),
  check (data_as_of <= approved_at and approved_at <= created_at and created_at < expires_at),
  check (cardinality(snapshot_ids) > 0 and portfolio_snapshot_id = any(snapshot_ids)),
  check (cardinality(policy_version_ids) > 0 and execution_policy_id = any(policy_version_ids))
);

create table public.execution_preflights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id uuid not null,
  mode text not null check (mode in ('OFF', 'DRY_RUN', 'PAPER', 'LIVE')),
  checked_at timestamptz not null,
  current_price numeric(30,6) not null check (current_price > 0),
  price_as_of timestamptz not null,
  price_drift_bps integer not null check (price_drift_bps >= 0),
  order_notional numeric(30,6) not null check (order_notional > 0),
  buying_power numeric(30,6),
  sellable_quantity numeric(30,6),
  blocker_codes text[] not null default '{}',
  warning_codes text[] not null default '{}',
  allowed boolean not null,
  external_submission_allowed boolean not null,
  evidence jsonb not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (intent_id, user_id) references public.execution_intents(id, user_id),
  check (allowed = (cardinality(blocker_codes) = 0)),
  check (not external_submission_allowed or (allowed and mode = 'LIVE'))
);

create table public.execution_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id uuid not null,
  preflight_id uuid not null,
  attempt_no integer not null check (attempt_no > 0),
  status text not null check (status in ('RESERVED', 'SUBMITTING', 'SUBMITTED', 'UNKNOWN', 'BLOCKED', 'REJECTED')),
  broker_request_id text,
  error_code text,
  outcome_unknown boolean not null default false,
  started_at timestamptz not null,
  completed_at timestamptz,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_hash text check (response_hash is null or response_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (intent_id, attempt_no),
  foreign key (intent_id, user_id) references public.execution_intents(id, user_id),
  foreign key (preflight_id, user_id) references public.execution_preflights(id, user_id),
  check (outcome_unknown = (status = 'UNKNOWN'))
);

create table public.broker_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id uuid not null,
  broker_account_id uuid not null,
  broker text not null check (broker in ('PAPER', 'TOSS')),
  broker_order_id text not null,
  client_order_id text not null,
  initial_status text not null,
  ordered_at timestamptz,
  observed_at timestamptz not null,
  raw_payload jsonb not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (broker, broker_order_id),
  unique (broker_account_id, client_order_id),
  foreign key (intent_id, user_id) references public.execution_intents(id, user_id),
  foreign key (broker_account_id, user_id) references public.broker_accounts(id, user_id)
);

create table public.broker_order_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_order_id uuid not null,
  version integer not null check (version > 0),
  previous_revision_id uuid references public.broker_order_revisions(id),
  status text not null,
  filled_quantity numeric(30,6) not null default 0 check (filled_quantity >= 0),
  average_fill_price numeric(30,6),
  observed_at timestamptz not null,
  broker_request_id text,
  raw_payload jsonb not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (id, user_id, broker_order_id),
  unique (broker_order_id, version),
  foreign key (broker_order_id, user_id) references public.broker_orders(id, user_id),
  foreign key (previous_revision_id, user_id, broker_order_id) references public.broker_order_revisions(id, user_id, broker_order_id),
  check ((version = 1) = (previous_revision_id is null)),
  check ((filled_quantity = 0 and average_fill_price is null) or (filled_quantity > 0 and average_fill_price > 0))
);

create table public.broker_fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_order_id uuid not null,
  broker_execution_id text not null,
  quantity numeric(30,6) not null check (quantity > 0),
  price numeric(30,6) not null check (price > 0),
  commission numeric(30,6) check (commission is null or commission >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  executed_at timestamptz not null,
  observed_at timestamptz not null,
  raw_payload jsonb not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (broker_order_id, broker_execution_id),
  foreign key (broker_order_id, user_id) references public.broker_orders(id, user_id),
  check (executed_at <= observed_at)
);

create table public.execution_idempotency_keys (
  internal_key text primary key check (internal_key ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id uuid not null,
  state text not null check (state in ('RESERVED', 'SUBMITTING', 'SUBMITTED', 'UNKNOWN', 'FINAL')),
  lease_owner text not null,
  lease_expires_at timestamptz not null,
  broker_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (intent_id, user_id) references public.execution_intents(id, user_id),
  foreign key (broker_order_id, user_id) references public.broker_orders(id, user_id),
  check (state not in ('SUBMITTED', 'FINAL') or broker_order_id is not null)
);

create table public.execution_kill_switches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('GLOBAL', 'BROKER', 'ACCOUNT', 'PORTFOLIO', 'STRATEGY', 'SYMBOL')),
  scope_key text not null,
  version integer not null check (version > 0),
  open boolean not null,
  cancel_only boolean not null default false,
  reason_code text not null,
  evidence_refs text[] not null default '{}',
  approved_by uuid not null references auth.users(id),
  effective_at timestamptz not null,
  expires_at timestamptz,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (user_id, scope, scope_key, version),
  check (not cancel_only or open),
  check (expires_at is null or effective_at < expires_at),
  check (length(trim(reason_code)) > 0)
);

create table public.execution_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_account_id uuid not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  status text not null check (status in ('MATCHED', 'DRIFT', 'FAILED')),
  critical_drift_count integer not null check (critical_drift_count >= 0),
  checked_order_count integer not null check (checked_order_count >= 0),
  checked_fill_count integer not null check (checked_fill_count >= 0),
  checked_holding_count integer not null check (checked_holding_count >= 0),
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (broker_account_id, user_id) references public.broker_accounts(id, user_id),
  check (started_at <= completed_at),
  check (status <> 'MATCHED' or critical_drift_count = 0),
  check (status <> 'DRIFT' or critical_drift_count > 0)
);

create table public.execution_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reconciliation_run_id uuid not null,
  drift_code text not null,
  severity text not null check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  entity_type text not null,
  entity_key text not null,
  internal_value jsonb,
  broker_value jsonb,
  resolved boolean not null default false,
  resolution_evidence_refs text[] not null default '{}',
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (reconciliation_run_id, user_id) references public.execution_reconciliation_runs(id, user_id),
  check (not resolved or cardinality(resolution_evidence_refs) > 0)
);

create or replace function public.validate_execution_intent_lineage_v1()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  decision_record public.decisions%rowtype;
  proposal_record public.allocation_proposals%rowtype;
  risk_record public.risk_decisions%rowtype;
  policy_record public.execution_policies%rowtype;
  account_record public.broker_accounts%rowtype;
begin
  select * into decision_record
  from public.decisions
  where id = new.decision_id and user_id = new.user_id;
  if not found then
    raise exception using errcode = '23503', message = 'execution intent decision ownership is invalid';
  end if;
  if decision_record.status <> 'APPROVED'
    or decision_record.allocation_proposal_id <> new.allocation_proposal_id
    or decision_record.risk_decision_id <> new.risk_decision_id then
    raise exception using errcode = '23514', message = 'execution intent decision lineage is not approved or does not match';
  end if;

  select * into proposal_record
  from public.allocation_proposals
  where id = new.allocation_proposal_id;
  if not found or proposal_record.portfolio_id <> new.portfolio_id
    or proposal_record.status not in ('APPROVED', 'REDUCED')
    or proposal_record.approved_amount < new.approved_notional then
    raise exception using errcode = '23514', message = 'execution intent allocation approval is invalid';
  end if;

  select * into risk_record
  from public.risk_decisions
  where id = new.risk_decision_id;
  if not found or risk_record.proposal_id <> new.allocation_proposal_id
    or risk_record.status not in ('APPROVE', 'APPROVE_WITH_REDUCTION')
    or (risk_record.max_approved_amount is not null and risk_record.max_approved_amount < new.approved_notional) then
    raise exception using errcode = '23514', message = 'execution intent risk approval is invalid';
  end if;

  if decision_record.approved_amount < new.approved_notional then
    raise exception using errcode = '23514', message = 'execution intent exceeds the approved decision amount';
  end if;

  select * into policy_record
  from public.execution_policies
  where id = new.execution_policy_id and user_id = new.user_id;
  if not found or policy_record.status <> 'ACTIVE'
    or not (new.broker_account_id = any(policy_record.account_ids))
    or policy_record.effective_from > new.created_at
    or (policy_record.expires_at is not null and policy_record.expires_at <= new.created_at)
    or policy_record.max_single_order_notional < new.approved_notional then
    raise exception using errcode = '23514', message = 'execution intent policy is inactive, expired, or outside approved limits';
  end if;

  select * into account_record
  from public.broker_accounts
  where id = new.broker_account_id and user_id = new.user_id;
  if not found or account_record.status in ('SUSPENDED', 'CLOSED') then
    raise exception using errcode = '23514', message = 'execution intent broker account is unavailable';
  end if;

  return new;
end;
$$;

create trigger execution_intents_validate_lineage
before insert on public.execution_intents
for each row execute function public.validate_execution_intent_lineage_v1();

create index execution_intents_decision on public.execution_intents(user_id, decision_id, created_at desc);
create index execution_intents_account on public.execution_intents(user_id, broker_account_id, created_at desc);
create index execution_preflights_intent on public.execution_preflights(intent_id, checked_at desc);
create index execution_attempts_unknown on public.execution_attempts(user_id, started_at) where status = 'UNKNOWN';
create index broker_orders_account_observed on public.broker_orders(user_id, broker_account_id, observed_at desc);
create index broker_order_revisions_latest on public.broker_order_revisions(broker_order_id, version desc);
create index broker_fills_order_time on public.broker_fills(broker_order_id, executed_at);
create index execution_idempotency_leases on public.execution_idempotency_keys(state, lease_expires_at);
create index execution_kill_switch_current on public.execution_kill_switches(user_id, scope, scope_key, version desc);
create index execution_reconciliation_account on public.execution_reconciliation_runs(user_id, broker_account_id, completed_at desc);
create index execution_reconciliation_critical on public.execution_reconciliation_items(user_id, resolved) where severity = 'CRITICAL';

alter table public.broker_accounts enable row level security;
alter table public.execution_policies enable row level security;
alter table public.execution_intents enable row level security;
alter table public.execution_preflights enable row level security;
alter table public.execution_attempts enable row level security;
alter table public.broker_orders enable row level security;
alter table public.broker_order_revisions enable row level security;
alter table public.broker_fills enable row level security;
alter table public.execution_idempotency_keys enable row level security;
alter table public.execution_kill_switches enable row level security;
alter table public.execution_reconciliation_runs enable row level security;
alter table public.execution_reconciliation_items enable row level security;

create policy broker_accounts_owner_select on public.broker_accounts for select using (user_id = auth.uid());
create policy execution_policies_owner_select on public.execution_policies for select using (user_id = auth.uid());
create policy execution_intents_owner_select on public.execution_intents for select using (user_id = auth.uid());
create policy execution_preflights_owner_select on public.execution_preflights for select using (user_id = auth.uid());
create policy execution_attempts_owner_select on public.execution_attempts for select using (user_id = auth.uid());
create policy broker_orders_owner_select on public.broker_orders for select using (user_id = auth.uid());
create policy broker_order_revisions_owner_select on public.broker_order_revisions for select using (user_id = auth.uid());
create policy broker_fills_owner_select on public.broker_fills for select using (user_id = auth.uid());
create policy execution_kill_switches_owner_select on public.execution_kill_switches for select using (user_id = auth.uid());
create policy execution_reconciliation_runs_owner_select on public.execution_reconciliation_runs for select using (user_id = auth.uid());
create policy execution_reconciliation_items_owner_select on public.execution_reconciliation_items for select using (user_id = auth.uid());

create trigger broker_accounts_immutable before update on public.broker_accounts for each row execute function public.prevent_immutable_investment_record_update();
create trigger execution_policies_immutable before update on public.execution_policies for each row execute function public.prevent_immutable_investment_record_update();
create trigger execution_intents_immutable before update on public.execution_intents for each row execute function public.prevent_immutable_investment_record_update();
create trigger execution_preflights_immutable before update on public.execution_preflights for each row execute function public.prevent_immutable_investment_record_update();
create trigger execution_attempts_immutable before update on public.execution_attempts for each row execute function public.prevent_immutable_investment_record_update();
create trigger broker_orders_immutable before update on public.broker_orders for each row execute function public.prevent_immutable_investment_record_update();
create trigger broker_order_revisions_immutable before update on public.broker_order_revisions for each row execute function public.prevent_immutable_investment_record_update();
create trigger broker_fills_immutable before update on public.broker_fills for each row execute function public.prevent_immutable_investment_record_update();
create trigger execution_kill_switches_immutable before update on public.execution_kill_switches for each row execute function public.prevent_immutable_investment_record_update();
create trigger execution_reconciliation_runs_immutable before update on public.execution_reconciliation_runs for each row execute function public.prevent_immutable_investment_record_update();
create trigger execution_reconciliation_items_immutable before update on public.execution_reconciliation_items for each row execute function public.prevent_immutable_investment_record_update();

commit;
