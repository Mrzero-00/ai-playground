begin;

alter table public.portfolios
  add constraint portfolios_id_user_unique unique (id, user_id);

create table public.portfolio_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  effective_from timestamptz not null,
  limits jsonb not null,
  position_limits jsonb not null,
  momentum_risk_limits jsonb not null,
  liquidity_participation jsonb not null,
  minimum_economic_amount_base numeric(24,6) not null check (minimum_economic_amount_base > 0),
  proposal_ttl_minutes integer not null check (proposal_ttl_minutes > 0),
  leverage_allowed boolean not null default false check (not leverage_allowed),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, version),
  check (jsonb_typeof(limits) = 'object'),
  check (jsonb_typeof(position_limits) = 'object'),
  check (jsonb_typeof(momentum_risk_limits) = 'object'),
  check (jsonb_typeof(liquidity_participation) = 'object')
);

create unique index one_active_portfolio_policy
  on public.portfolio_policies(user_id) where status = 'ACTIVE';

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  as_of timestamptz not null,
  gross_asset_value_base numeric(30,6) not null check (gross_asset_value_base >= 0),
  investable_nav_base numeric(30,6) not null check (investable_nav_base > 0),
  liabilities_base numeric(30,6) not null check (liabilities_base >= 0),
  reserved_cash_base numeric(30,6) not null check (reserved_cash_base >= 0),
  fx_snapshot_id text not null,
  market_snapshot_ids uuid[] not null,
  complete boolean not null,
  anomaly_flags text[] not null default '{}',
  ledger_version text not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, portfolio_id, as_of, ledger_version),
  foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade,
  check (cardinality(market_snapshot_ids) > 0),
  check (as_of <= created_at),
  check (complete and not (anomaly_flags && array['CRITICAL:LEDGER', 'CRITICAL:FX', 'CRITICAL:PRICE']::text[])),
  check (investable_nav_base = gross_asset_value_base - liabilities_base - reserved_cash_base)
);

create table public.portfolio_position_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_snapshot_id uuid not null,
  lot_id uuid not null references public.position_lots(id),
  company_id uuid not null references public.companies(id),
  security_id text not null,
  strategy text not null check (strategy in ('CORE', 'FUTURE_CORE', 'MOMENTUM')),
  quantity numeric(30,10) not null check (quantity > 0),
  market_price numeric(24,8) not null check (market_price > 0),
  asset_currency text not null check (asset_currency ~ '^[A-Z]{3}$'),
  fx_rate_to_base numeric(24,12) not null check (fx_rate_to_base > 0),
  market_value_base numeric(30,6) not null check (market_value_base > 0),
  cost_basis_base numeric(30,6) not null check (cost_basis_base > 0),
  stop_price numeric(24,8),
  gap_scenario_loss_per_unit_base numeric(24,8),
  sector_code text not null,
  industry_code text not null,
  liquidity_tier text not null check (liquidity_tier in ('L1', 'L2', 'L3')),
  unique (id, user_id),
  unique (portfolio_snapshot_id, lot_id),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id) on delete cascade,
  check (abs(market_value_base - quantity * market_price * fx_rate_to_base) < 0.000001),
  check ((strategy = 'MOMENTUM' and stop_price is not null and stop_price > 0)
    or (strategy <> 'MOMENTUM' and stop_price is null)),
  check (gap_scenario_loss_per_unit_base is null or gap_scenario_loss_per_unit_base >= 0)
);

create table public.portfolio_cash_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_snapshot_id uuid not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount numeric(30,6) not null check (amount >= 0),
  fx_rate_to_base numeric(24,12) not null check (fx_rate_to_base > 0),
  amount_base numeric(30,6) not null check (amount_base >= 0),
  owner text not null check (owner in ('LONG_TERM', 'MOMENTUM', 'COMMON_RESERVE')),
  available boolean not null,
  settlement_date date,
  unique (id, user_id),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id) on delete cascade,
  check (abs(amount_base - amount * fx_rate_to_base) < 0.000001)
);

create table public.economic_exposure_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position_snapshot_id uuid not null,
  dimension text not null check (dimension in ('THEME', 'CUSTOMER', 'SUPPLIER', 'MACRO', 'REGULATORY')),
  exposure_key text not null,
  sensitivity numeric(10,9) not null check (sensitivity between 0 and 1),
  confidence numeric(10,9) not null check (confidence between 0 and 1),
  evidence_ids uuid[] not null,
  unique (id, user_id),
  unique (position_snapshot_id, dimension, exposure_key),
  foreign key (position_snapshot_id, user_id) references public.portfolio_position_snapshots(id, user_id) on delete cascade,
  check (cardinality(evidence_ids) > 0)
);

create table public.portfolio_exposure_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_snapshot_id uuid not null,
  dimension text not null check (dimension in ('STRATEGY', 'COMPANY', 'SECTOR', 'INDUSTRY', 'THEME', 'CURRENCY')),
  exposure_key text not null,
  amount_base numeric(30,6) not null check (amount_base >= 0),
  weight numeric(12,9) not null check (weight between 0 and 1),
  confidence numeric(10,9) not null check (confidence between 0 and 1),
  limit_state text not null check (limit_state in ('BELOW_SOFT_MIN', 'WITHIN_TARGET_RANGE', 'ABOVE_SOFT_MAX', 'AT_HARD_MAX', 'ABOVE_HARD_MAX')),
  policy_id uuid not null,
  unique (id, user_id),
  unique (portfolio_snapshot_id, dimension, exposure_key),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id) on delete cascade,
  foreign key (policy_id, user_id) references public.portfolio_policies(id, user_id)
);

create table public.momentum_open_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_snapshot_id uuid not null,
  lot_id uuid not null references public.position_lots(id),
  company_id uuid not null references public.companies(id),
  setup_id uuid,
  quantity numeric(30,10) not null check (quantity > 0),
  active_stop_price numeric(24,8) not null check (active_stop_price > 0),
  scenario_loss_per_unit_base numeric(24,8) not null check (scenario_loss_per_unit_base > 0),
  open_risk_base numeric(30,6) not null check (open_risk_base > 0),
  sector_code text not null,
  theme_keys text[] not null default '{}',
  unique (id, user_id),
  unique (portfolio_snapshot_id, lot_id),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id) on delete cascade,
  foreign key (setup_id, user_id) references public.momentum_setup_instances(id, user_id),
  check (abs(open_risk_base - quantity * scenario_loss_per_unit_base) < 0.000001)
);

create table public.portfolio_stress_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  name text not null,
  status text not null check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  shocks jsonb not null,
  liquidity_haircut numeric(10,9) not null check (liquidity_haircut between 0 and 1),
  momentum_gap_multiplier numeric(12,6) not null check (momentum_gap_multiplier >= 1),
  assumptions text[] not null,
  unique (id, user_id),
  unique (user_id, version),
  check (jsonb_typeof(shocks) = 'object' and cardinality(assumptions) > 0)
);

create table public.portfolio_stress_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_snapshot_id uuid not null,
  scenario_id uuid not null,
  evaluated_at timestamptz not null,
  estimated_loss_base numeric(30,6) not null check (estimated_loss_base <= 0),
  estimated_loss_percent numeric(8,4) not null check (estimated_loss_percent between 0 and 100),
  bucket_losses jsonb not null,
  top_contributors jsonb not null,
  breached_limit_ids text[] not null default '{}',
  cash_after_stress_base numeric(30,6) not null check (cash_after_stress_base >= 0),
  forced_sale_risk boolean not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (portfolio_snapshot_id, scenario_id),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id),
  foreign key (scenario_id, user_id) references public.portfolio_stress_scenarios(id, user_id)
);

create table public.allocation_proposals_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  portfolio_snapshot_id uuid not null,
  policy_id uuid not null,
  evaluation_id uuid not null,
  trade_plan_id uuid,
  company_id uuid not null references public.companies(id),
  security_id text not null,
  mode text not null check (mode in ('SINGLE', 'NEW_CAPITAL', 'REBALANCE', 'HISTORICAL_REPLAY')),
  strategy text not null check (strategy in ('LONG_TERM', 'MOMENTUM')),
  lot_strategy text not null check (lot_strategy in ('CORE', 'FUTURE_CORE', 'MOMENTUM')),
  action text not null check (action in ('BUY', 'ACCUMULATE', 'ENTER')),
  status text not null check (status in ('APPROVED', 'REDUCED', 'WAIT', 'REJECTED')),
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  requested_amount numeric(30,6) not null check (requested_amount >= 0),
  approved_amount numeric(30,6) not null check (approved_amount >= 0),
  executable_quantity numeric(30,10) not null check (executable_quantity >= 0),
  reference_price numeric(24,8) not null check (reference_price > 0),
  allowed_risk_amount numeric(30,6),
  scenario_loss_per_unit numeric(24,8),
  projected_open_risk numeric(30,6),
  constraints_triggered text[] not null default '{}',
  reasons text[] not null,
  risk_handoff jsonb not null,
  snapshot_ids uuid[] not null,
  operational_state_change_allowed boolean not null,
  generated_at timestamptz not null,
  expires_at timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (portfolio_id, user_id) references public.portfolios(id, user_id),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id),
  foreign key (policy_id, user_id) references public.portfolio_policies(id, user_id),
  foreign key (evaluation_id, user_id) references public.evaluations(id, user_id),
  foreign key (trade_plan_id, user_id) references public.momentum_trade_plan_revisions(id, user_id),
  check (approved_amount <= requested_amount),
  check (generated_at < expires_at),
  check (mode <> 'HISTORICAL_REPLAY' or not operational_state_change_allowed),
  check ((strategy = 'MOMENTUM' and lot_strategy = 'MOMENTUM' and action = 'ENTER' and trade_plan_id is not null
      and allowed_risk_amount is not null and scenario_loss_per_unit is not null)
    or (strategy = 'LONG_TERM' and lot_strategy in ('CORE', 'FUTURE_CORE') and action in ('BUY', 'ACCUMULATE') and trade_plan_id is null)),
  check ((status in ('WAIT', 'REJECTED') and approved_amount = 0 and executable_quantity = 0)
    or (status in ('APPROVED', 'REDUCED') and approved_amount > 0 and executable_quantity > 0)),
  check (cardinality(reasons) > 0 and cardinality(snapshot_ids) > 0)
);

create table public.allocation_capacity_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid not null,
  capacity_id text not null,
  status text not null check (status in ('AVAILABLE', 'LIMITED', 'EXHAUSTED', 'UNKNOWN')),
  maximum_additional_amount numeric(30,6) not null check (maximum_additional_amount >= 0),
  current_value numeric(30,6) not null check (current_value >= 0),
  projected_value numeric(30,6) not null check (projected_value >= 0),
  hard_limit_value numeric(30,6) not null check (hard_limit_value >= 0),
  reason_code text not null,
  unique (id, user_id),
  unique (proposal_id, capacity_id),
  foreign key (proposal_id, user_id) references public.allocation_proposals_v1(id, user_id) on delete cascade,
  check (projected_value <= hard_limit_value),
  check (maximum_additional_amount <= greatest(hard_limit_value - current_value, 0))
);

create table public.capital_allocation_decisions_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  portfolio_snapshot_id uuid not null,
  policy_id uuid not null,
  capital_source text not null check (capital_source in ('SALARY', 'DIVIDEND', 'POSITION_EXIT', 'INTEREST', 'EXTERNAL_TRANSFER', 'TAX_REFUND')),
  available_amount numeric(30,6) not null check (available_amount > 0),
  cash_retained numeric(30,6) not null check (cash_retained >= 0 and cash_retained <= available_amount),
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  proposal_ids uuid[] not null default '{}',
  current_weights jsonb not null,
  target_weights jsonb not null,
  projected_weights jsonb not null,
  constraints_triggered text[] not null default '{}',
  stress_summary text not null,
  final_recommendation text not null,
  generated_at timestamptz not null,
  data_as_of timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (portfolio_id, user_id) references public.portfolios(id, user_id),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id),
  foreign key (policy_id, user_id) references public.portfolio_policies(id, user_id),
  check (data_as_of <= generated_at)
);

create table public.bucket_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  from_bucket text not null check (from_bucket in ('LONG_TERM', 'MOMENTUM', 'COMMON_RESERVE')),
  to_bucket text not null check (to_bucket in ('LONG_TERM', 'MOMENTUM', 'COMMON_RESERVE')),
  amount numeric(30,6) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reason text not null,
  portfolio_snapshot_id uuid not null,
  risk_decision_id uuid references public.risk_decisions(id),
  status text not null check (status in ('PROPOSED', 'APPROVED', 'REJECTED', 'EXPIRED')),
  requested_at timestamptz not null,
  expires_at timestamptz not null,
  approved_by uuid references auth.users(id),
  unique (id, user_id),
  foreign key (portfolio_id, user_id) references public.portfolios(id, user_id),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id),
  check (from_bucket <> to_bucket and requested_at < expires_at),
  check (status <> 'APPROVED' or (approved_by is not null and risk_decision_id is not null))
);

create table public.portfolio_rebalance_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  portfolio_snapshot_id uuid not null,
  policy_id uuid not null,
  trigger_codes text[] not null,
  actions jsonb not null,
  requires_manual_review boolean not null,
  automatic_orders_allowed boolean not null default false check (not automatic_orders_allowed),
  summary text not null,
  status text not null check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),
  generated_at timestamptz not null,
  data_as_of timestamptz not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (portfolio_id, user_id) references public.portfolios(id, user_id),
  foreign key (portfolio_snapshot_id, user_id) references public.portfolio_snapshots(id, user_id),
  foreign key (policy_id, user_id) references public.portfolio_policies(id, user_id),
  check (cardinality(trigger_codes) > 0),
  check (data_as_of <= generated_at and generated_at <= due_at),
  check (status <> 'COMPLETED' or completed_at is not null)
);

create index portfolio_snapshots_latest on public.portfolio_snapshots(user_id, portfolio_id, as_of desc);
create index portfolio_positions_company on public.portfolio_position_snapshots(portfolio_snapshot_id, company_id, strategy);
create index portfolio_exposures_dimension on public.portfolio_exposure_snapshots(portfolio_snapshot_id, dimension, weight desc);
create index momentum_open_risk_sector on public.momentum_open_risk_snapshots(portfolio_snapshot_id, sector_code);
create index allocation_proposals_expiry on public.allocation_proposals_v1(user_id, status, expires_at);
create index allocation_proposals_company on public.allocation_proposals_v1(user_id, company_id, generated_at desc);
create index rebalance_reviews_due on public.portfolio_rebalance_reviews(user_id, due_at) where status = 'PENDING';

alter table public.portfolio_policies enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.portfolio_position_snapshots enable row level security;
alter table public.portfolio_cash_balances enable row level security;
alter table public.economic_exposure_definitions enable row level security;
alter table public.portfolio_exposure_snapshots enable row level security;
alter table public.momentum_open_risk_snapshots enable row level security;
alter table public.portfolio_stress_scenarios enable row level security;
alter table public.portfolio_stress_results enable row level security;
alter table public.allocation_proposals_v1 enable row level security;
alter table public.allocation_capacity_results enable row level security;
alter table public.capital_allocation_decisions_v1 enable row level security;
alter table public.bucket_transfer_requests enable row level security;
alter table public.portfolio_rebalance_reviews enable row level security;

create policy portfolio_policies_owner_all on public.portfolio_policies for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy portfolio_snapshots_owner_select on public.portfolio_snapshots for select using (user_id = auth.uid());
create policy portfolio_positions_owner_select on public.portfolio_position_snapshots for select using (user_id = auth.uid());
create policy portfolio_cash_owner_select on public.portfolio_cash_balances for select using (user_id = auth.uid());
create policy economic_exposures_owner_select on public.economic_exposure_definitions for select using (user_id = auth.uid());
create policy portfolio_exposure_snapshots_owner_select on public.portfolio_exposure_snapshots for select using (user_id = auth.uid());
create policy momentum_open_risk_owner_select on public.momentum_open_risk_snapshots for select using (user_id = auth.uid());
create policy stress_scenarios_owner_all on public.portfolio_stress_scenarios for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy stress_results_owner_select on public.portfolio_stress_results for select using (user_id = auth.uid());
create policy allocation_proposals_v1_owner_select on public.allocation_proposals_v1 for select using (user_id = auth.uid());
create policy allocation_capacity_owner_select on public.allocation_capacity_results for select using (user_id = auth.uid());
create policy capital_decisions_v1_owner_select on public.capital_allocation_decisions_v1 for select using (user_id = auth.uid());
create policy bucket_transfers_owner_select on public.bucket_transfer_requests for select using (user_id = auth.uid());
create policy rebalance_reviews_owner_select on public.portfolio_rebalance_reviews for select using (user_id = auth.uid());

create trigger portfolio_snapshots_immutable before update on public.portfolio_snapshots for each row execute function public.prevent_immutable_investment_record_update();
create trigger portfolio_positions_immutable before update on public.portfolio_position_snapshots for each row execute function public.prevent_immutable_investment_record_update();
create trigger portfolio_cash_immutable before update on public.portfolio_cash_balances for each row execute function public.prevent_immutable_investment_record_update();
create trigger economic_exposures_immutable before update on public.economic_exposure_definitions for each row execute function public.prevent_immutable_investment_record_update();
create trigger portfolio_exposures_immutable before update on public.portfolio_exposure_snapshots for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_open_risk_immutable before update on public.momentum_open_risk_snapshots for each row execute function public.prevent_immutable_investment_record_update();
create trigger portfolio_stress_results_immutable before update on public.portfolio_stress_results for each row execute function public.prevent_immutable_investment_record_update();
create trigger allocation_proposals_v1_immutable before update on public.allocation_proposals_v1 for each row execute function public.prevent_immutable_investment_record_update();
create trigger allocation_capacity_immutable before update on public.allocation_capacity_results for each row execute function public.prevent_immutable_investment_record_update();
create trigger capital_decisions_v1_immutable before update on public.capital_allocation_decisions_v1 for each row execute function public.prevent_immutable_investment_record_update();
create trigger portfolio_rebalance_reviews_immutable before update on public.portfolio_rebalance_reviews for each row execute function public.prevent_immutable_investment_record_update();

commit;
