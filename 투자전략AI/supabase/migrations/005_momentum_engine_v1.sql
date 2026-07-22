begin;

alter table public.momentum_trade_plans
  add constraint momentum_trade_plans_id_user_unique unique (id, user_id);

create table public.momentum_universe_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  market text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  allowed_security_types text[] not null,
  minimum_price numeric(20,6) not null check (minimum_price > 0),
  minimum_market_cap numeric(24,2) not null check (minimum_market_cap > 0),
  minimum_addv_20 numeric(24,2) not null check (minimum_addv_20 > 0),
  maximum_median_spread_bps numeric(10,4) not null check (maximum_median_spread_bps > 0),
  minimum_listing_sessions integer not null check (minimum_listing_sessions > 0),
  excluded_venues text[] not null default '{}',
  excluded_risk_flags text[] not null default '{}',
  effective_from timestamptz not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, market, version),
  check (cardinality(allowed_security_types) > 0),
  check (allowed_security_types <@ array['COMMON_STOCK', 'ADR', 'ETF']::text[])
);

create unique index one_active_momentum_universe_policy
  on public.momentum_universe_policies(user_id, market) where status = 'ACTIVE';

create table public.momentum_universe_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  universe_policy_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  security_id text not null,
  evaluated_at timestamptz not null,
  eligible boolean not null,
  reason_codes text[] not null default '{}',
  liquidity_tier text not null check (liquidity_tier in ('L1', 'L2', 'L3', 'INELIGIBLE')),
  max_participation_rate numeric(10,9) check (max_participation_rate is null or max_participation_rate > 0 and max_participation_rate <= 1),
  snapshot_ids uuid[] not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (user_id, universe_policy_id, security_id, evaluated_at),
  foreign key (universe_policy_id, user_id) references public.momentum_universe_policies(id, user_id),
  check (cardinality(snapshot_ids) > 0),
  check ((eligible and liquidity_tier <> 'INELIGIBLE' and cardinality(reason_codes) = 0)
    or (not eligible and liquidity_tier = 'INELIGIBLE' and cardinality(reason_codes) > 0))
);

create table public.market_regime_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_version_id uuid not null references public.model_versions(id),
  market text not null,
  regime text not null check (regime in ('RISK_ON_TREND', 'RISK_ON_VOLATILE', 'NEUTRAL_RANGE', 'RISK_OFF', 'CRISIS', 'UNKNOWN')),
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  permission text not null check (permission in ('ALLOW', 'ALLOW_REDUCED', 'REQUIRE_MANUAL_REVIEW', 'DENY_NEW_RISK')),
  risk_multiplier numeric(10,9) not null check (risk_multiplier between 0 and 1),
  reason_codes text[] not null,
  snapshot_ids uuid[] not null,
  evaluated_at timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  check (cardinality(reason_codes) > 0 and cardinality(snapshot_ids) > 0),
  check ((regime = 'RISK_ON_TREND' and permission = 'ALLOW' and risk_multiplier = 1)
    or (regime = 'RISK_ON_VOLATILE' and permission = 'ALLOW_REDUCED' and risk_multiplier = 0.6)
    or (regime = 'NEUTRAL_RANGE' and permission = 'ALLOW_REDUCED' and risk_multiplier = 0.4)
    or (regime = 'RISK_OFF' and permission = 'REQUIRE_MANUAL_REVIEW' and risk_multiplier = 0.2)
    or (regime in ('CRISIS', 'UNKNOWN') and permission = 'DENY_NEW_RISK' and risk_multiplier = 0))
);

create table public.momentum_evaluations (
  evaluation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  security_id text not null,
  mode text not null check (mode in ('UNIVERSE_SCAN', 'SETUP_DETECTION', 'SETUP_VALIDATION', 'PRICE_REFRESH', 'EVENT_REVIEW', 'POSITION_REVIEW', 'HISTORICAL_REPLAY')),
  universe_membership_id uuid not null,
  market_regime_evaluation_id uuid not null,
  setup_definition_version text not null,
  philosophy_version_id uuid not null references public.philosophy_versions(id),
  point_score numeric(5,2) not null check (point_score between 0 and 100),
  low_score numeric(5,2) not null check (low_score between 0 and 100),
  high_score numeric(5,2) not null check (high_score between 0 and 100),
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  action text not null check (action in ('ENTER', 'WAIT', 'AVOID', 'EXIT', 'REVIEW_REQUIRED')),
  action_constraints text[] not null default '{}',
  execution_risk numeric(5,2) not null check (execution_risk between 0 and 100),
  gap_risk numeric(5,2) not null check (gap_risk between 0 and 100),
  data_as_of timestamptz not null,
  market_price_as_of timestamptz not null,
  evaluated_at timestamptz not null,
  expires_at timestamptz not null,
  next_review_at timestamptz not null,
  operational_state_change_allowed boolean not null,
  explanation jsonb not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (evaluation_id, user_id),
  foreign key (evaluation_id, user_id) references public.evaluations(id, user_id) on delete cascade,
  foreign key (universe_membership_id, user_id) references public.momentum_universe_memberships(id, user_id),
  foreign key (market_regime_evaluation_id, user_id) references public.market_regime_evaluations(id, user_id),
  check (low_score <= point_score and point_score <= high_score),
  check (data_as_of <= evaluated_at and market_price_as_of <= evaluated_at and evaluated_at < expires_at),
  check (next_review_at > evaluated_at),
  check (mode <> 'HISTORICAL_REPLAY' or not operational_state_change_allowed)
);

create table public.momentum_factor_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  evaluation_id uuid not null,
  factor_id text not null check (factor_id in (
    'MOM_RELATIVE_STRENGTH', 'MOM_SECTOR_LEADERSHIP', 'MOM_PRICE_STRUCTURE',
    'MOM_VOLUME_CONFIRMATION', 'MOM_CATALYST_QUALITY', 'MOM_LIQUIDITY_EXECUTION',
    'MOM_REWARD_RISK_TIMING'
  )),
  status text not null check (status in ('SCORED', 'BLOCKED', 'NOT_APPLICABLE')),
  availability text not null check (availability in ('AVAILABLE', 'PARTIAL', 'NOT_APPLICABLE', 'UNKNOWN', 'STALE', 'CONFLICTED')),
  score numeric(5,2) check (score is null or score between 0 and 100),
  bear_score numeric(5,2) check (bear_score is null or bear_score between 0 and 100),
  bull_score numeric(5,2) check (bull_score is null or bull_score between 0 and 100),
  weight numeric(5,2) not null check (weight > 0 and weight <= 100),
  applicable_weight numeric(5,2) not null check (applicable_weight between 0 and 100),
  supporting_evidence_ids uuid[] not null default '{}',
  counter_evidence_ids uuid[] not null default '{}',
  explanation text not null,
  warnings text[] not null default '{}',
  unique (id, user_id),
  unique (evaluation_id, factor_id),
  foreign key (evaluation_id, user_id) references public.momentum_evaluations(evaluation_id, user_id) on delete cascade,
  check ((status = 'SCORED' and score is not null and cardinality(supporting_evidence_ids) > 0)
    or (status <> 'SCORED' and score is null)),
  check (status <> 'NOT_APPLICABLE' or applicable_weight = 0),
  check (applicable_weight <= weight),
  check (bear_score is null or score is not null and bear_score <= score),
  check (bull_score is null or score is not null and bull_score >= score)
);

create table public.momentum_gate_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  evaluation_id uuid not null,
  gate_id text not null,
  status text not null check (status in ('PASSED', 'FAILED', 'REVIEW_REQUIRED', 'NOT_APPLICABLE')),
  severity text not null check (severity in ('INFO', 'SOFT', 'HARD')),
  reason_code text not null,
  evidence_ids uuid[] not null default '{}',
  blocked_actions text[] not null default '{}',
  explanation text not null,
  unique (id, user_id),
  unique (evaluation_id, gate_id),
  foreign key (evaluation_id, user_id) references public.momentum_evaluations(evaluation_id, user_id) on delete cascade
);

create table public.momentum_setup_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  security_id text not null,
  evaluation_id uuid not null,
  setup_type text not null check (setup_type in ('BREAKOUT', 'PULLBACK', 'GAP_CONTINUATION', 'EARNINGS_MOMENTUM', 'SECTOR_ROTATION', 'SPECIAL_SITUATION')),
  setup_definition_version text not null,
  status text not null check (status in ('ELIGIBLE', 'CONDITIONAL', 'INELIGIBLE')),
  trigger_status text not null check (trigger_status in ('NOT_TRIGGERED', 'TRIGGERED', 'CHASED', 'INVALIDATED')),
  lifecycle_state text not null check (lifecycle_state in ('DETECTED', 'VALIDATED', 'PLANNED', 'APPROVED', 'ENTERED', 'MANAGING', 'CLOSED', 'REVIEWED', 'REJECTED', 'EXPIRED', 'INVALIDATED', 'CANCELLED')),
  detected_at timestamptz not null,
  minimum_holding_sessions integer not null check (minimum_holding_sessions > 0),
  maximum_holding_sessions integer not null check (maximum_holding_sessions >= minimum_holding_sessions),
  invalidation_conditions text[] not null,
  warnings text[] not null default '{}',
  unique (id, user_id),
  foreign key (evaluation_id, user_id) references public.momentum_evaluations(evaluation_id, user_id),
  check (cardinality(invalidation_conditions) > 0)
);

create table public.momentum_trade_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_plan_id uuid,
  evaluation_id uuid not null,
  setup_id uuid not null,
  revision integer not null check (revision > 0),
  supersedes_plan_id uuid,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  entry_zone_min numeric(20,6) not null check (entry_zone_min > 0),
  entry_zone_max numeric(20,6) not null check (entry_zone_max > 0),
  chase_limit numeric(20,6) not null check (chase_limit > 0),
  trigger text not null,
  initial_stop numeric(20,6) not null check (initial_stop > 0),
  target_1 numeric(20,6),
  target_2 numeric(20,6),
  trailing_stop_rule text,
  time_stop_sessions integer not null check (time_stop_sessions > 0),
  reference_entry numeric(20,6) not null check (reference_entry > 0),
  unit_risk numeric(20,6) not null check (unit_risk > 0),
  reward_risk_to_target_1 numeric(12,6),
  reward_risk_to_target_2 numeric(12,6),
  estimated_round_trip_cost_r numeric(12,6) not null check (estimated_round_trip_cost_r >= 0),
  invalidation_conditions text[] not null,
  event_policy text not null check (event_policy in ('EXIT_BEFORE_EVENT', 'REDUCE_BEFORE_EVENT', 'HOLD_WITH_SCENARIO_APPROVAL', 'EVENT_IS_SETUP', 'NO_KNOWN_EVENT')),
  evidence_ids uuid[] not null,
  counter_evidence_ids uuid[] not null,
  snapshot_ids uuid[] not null,
  model_version_id uuid not null references public.model_versions(id),
  generated_at timestamptz not null,
  expires_at timestamptz not null,
  unique (id, user_id),
  unique (setup_id, revision),
  foreign key (evaluation_id, user_id) references public.momentum_evaluations(evaluation_id, user_id),
  foreign key (setup_id, user_id) references public.momentum_setup_instances(id, user_id),
  foreign key (legacy_plan_id, user_id) references public.momentum_trade_plans(id, user_id),
  foreign key (supersedes_plan_id, user_id) references public.momentum_trade_plan_revisions(id, user_id),
  check ((revision = 1 and supersedes_plan_id is null) or (revision > 1 and supersedes_plan_id is not null)),
  check (initial_stop < entry_zone_min and entry_zone_min <= reference_entry and reference_entry <= entry_zone_max and entry_zone_max <= chase_limit),
  check (unit_risk = reference_entry - initial_stop),
  check (target_1 is null or target_1 > reference_entry),
  check (target_2 is null or target_2 > reference_entry),
  check (target_1 is null or target_2 is null or target_1 <= target_2),
  check ((target_1 is null and reward_risk_to_target_1 is null)
    or (target_1 is not null and reward_risk_to_target_1 is not null
      and abs(reward_risk_to_target_1 - ((target_1 - reference_entry) / unit_risk)) < 0.0001
      and reward_risk_to_target_1 - estimated_round_trip_cost_r >= 1.5)),
  check ((target_2 is null and reward_risk_to_target_2 is null)
    or (target_2 is not null and reward_risk_to_target_2 is not null
      and abs(reward_risk_to_target_2 - ((target_2 - reference_entry) / unit_risk)) < 0.0001
      and reward_risk_to_target_2 - estimated_round_trip_cost_r >= 2.0)),
  check (target_2 is not null or target_1 is null
    or reward_risk_to_target_1 - estimated_round_trip_cost_r >= 2.0),
  check (target_1 is not null or length(trim(trailing_stop_rule)) > 0),
  check (generated_at < expires_at),
  check (cardinality(invalidation_conditions) > 0),
  check (cardinality(evidence_ids) > 0 and cardinality(counter_evidence_ids) > 0 and cardinality(snapshot_ids) > 0)
);

create table public.momentum_setup_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  setup_id uuid not null,
  evaluation_id uuid not null,
  from_state text not null,
  to_state text not null,
  plan_id uuid,
  decision_id uuid references public.decisions(id),
  execution_id uuid references public.execution_records(id),
  reason_code text not null,
  evidence_ids uuid[] not null,
  model_version_id uuid not null references public.model_versions(id),
  occurred_at timestamptz not null,
  actor_id uuid not null references auth.users(id),
  actor_type text not null check (actor_type in ('SYSTEM', 'AI', 'HUMAN', 'SERVICE')),
  unique (id, user_id),
  foreign key (setup_id, user_id) references public.momentum_setup_instances(id, user_id),
  foreign key (evaluation_id, user_id) references public.momentum_evaluations(evaluation_id, user_id),
  foreign key (plan_id, user_id) references public.momentum_trade_plan_revisions(id, user_id),
  check (from_state <> to_state),
  check (cardinality(evidence_ids) > 0),
  check (to_state <> 'APPROVED' or (actor_type = 'HUMAN' and plan_id is not null and decision_id is not null)),
  check (to_state not in ('ENTERED', 'CLOSED') or execution_id is not null)
);

create table public.momentum_catalysts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null,
  occurred_at timestamptz not null,
  available_at timestamptz not null,
  source_tier text not null check (source_tier in ('A', 'B', 'C', 'D', 'E', 'F')),
  official boolean not null,
  summary text not null,
  expected_duration text not null check (expected_duration in ('INTRADAY', 'DAYS', 'WEEKS', 'MONTHS')),
  half_life_hours numeric(12,4) not null check (half_life_hours > 0),
  estimate_revision_observed boolean not null,
  price_reaction_percent numeric(12,6) not null,
  evidence_ids uuid[] not null,
  counter_evidence_ids uuid[] not null,
  unique (id, user_id),
  check (occurred_at <= available_at),
  check (cardinality(evidence_ids) > 0),
  check (type = 'TECHNICAL_ONLY' or source_tier in ('A', 'B', 'C'))
);

create table public.momentum_event_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  evaluation_id uuid not null unique,
  calendar_known boolean not null,
  event_within_plan_horizon boolean not null,
  binary_event boolean not null,
  official_schedule_consistent boolean not null,
  event_policy text not null check (event_policy in ('EXIT_BEFORE_EVENT', 'REDUCE_BEFORE_EVENT', 'HOLD_WITH_SCENARIO_APPROVAL', 'EVENT_IS_SETUP', 'NO_KNOWN_EVENT')),
  manual_review_approved boolean not null,
  gap_risk_score numeric(5,2) not null check (gap_risk_score between 0 and 100),
  gap_scenario jsonb,
  unique (id, user_id),
  foreign key (evaluation_id, user_id) references public.momentum_evaluations(evaluation_id, user_id) on delete cascade,
  check (not binary_event or gap_scenario is not null),
  check (not event_within_plan_horizon or event_policy <> 'NO_KNOWN_EVENT'),
  check (event_policy not in ('HOLD_WITH_SCENARIO_APPROVAL', 'EVENT_IS_SETUP') or manual_review_approved)
);

create table public.momentum_trade_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  setup_id uuid not null,
  evaluation_id uuid not null,
  plan_id uuid not null,
  closed_at timestamptz not null,
  reviewed_at timestamptz not null,
  realized_r_multiple numeric(16,8) not null,
  maximum_adverse_excursion_r numeric(16,8) not null check (maximum_adverse_excursion_r <= 0),
  maximum_favorable_excursion_r numeric(16,8) not null check (maximum_favorable_excursion_r >= 0),
  plan_followed boolean not null,
  process_grade text not null check (process_grade in ('A', 'B', 'C', 'D', 'F')),
  outcome text not null check (outcome in ('WIN', 'LOSS', 'FLAT')),
  rule_violations text[] not null default '{}',
  lessons text[] not null default '{}',
  unique (id, user_id),
  unique (setup_id),
  foreign key (setup_id, user_id) references public.momentum_setup_instances(id, user_id),
  foreign key (evaluation_id, user_id) references public.momentum_evaluations(evaluation_id, user_id),
  foreign key (plan_id, user_id) references public.momentum_trade_plan_revisions(id, user_id),
  check (closed_at <= reviewed_at),
  check (plan_followed or cardinality(rule_violations) > 0),
  check ((realized_r_multiple > 0.05 and outcome = 'WIN')
    or (realized_r_multiple < -0.05 and outcome = 'LOSS')
    or (realized_r_multiple between -0.05 and 0.05 and outcome = 'FLAT'))
);

create index momentum_membership_security_time on public.momentum_universe_memberships(user_id, security_id, evaluated_at desc);
create index market_regime_market_time on public.market_regime_evaluations(user_id, market, evaluated_at desc);
create index momentum_evaluations_security_time on public.momentum_evaluations(user_id, security_id, created_at desc);
create index momentum_evaluations_setup_time on public.momentum_evaluations(user_id, setup_definition_version, created_at desc);
create index momentum_evaluations_ranking on public.momentum_evaluations(user_id, action, point_score desc, confidence desc);
create index momentum_evaluations_due_review on public.momentum_evaluations(user_id, next_review_at) where mode <> 'HISTORICAL_REPLAY';
create index momentum_setup_active on public.momentum_setup_instances(user_id, security_id, detected_at desc)
  where lifecycle_state not in ('CLOSED', 'REVIEWED', 'REJECTED', 'EXPIRED', 'INVALIDATED', 'CANCELLED');
create index momentum_plan_expiry on public.momentum_trade_plan_revisions(user_id, expires_at);
create index momentum_catalyst_company_time on public.momentum_catalysts(company_id, available_at desc);

alter table public.momentum_universe_policies enable row level security;
alter table public.momentum_universe_memberships enable row level security;
alter table public.market_regime_evaluations enable row level security;
alter table public.momentum_evaluations enable row level security;
alter table public.momentum_factor_results enable row level security;
alter table public.momentum_gate_results enable row level security;
alter table public.momentum_setup_instances enable row level security;
alter table public.momentum_trade_plan_revisions enable row level security;
alter table public.momentum_setup_transitions enable row level security;
alter table public.momentum_catalysts enable row level security;
alter table public.momentum_event_risk_assessments enable row level security;
alter table public.momentum_trade_reviews enable row level security;

create policy momentum_universe_policies_owner_all on public.momentum_universe_policies
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy momentum_universe_memberships_owner_select on public.momentum_universe_memberships
  for select using (user_id = auth.uid());
create policy market_regime_evaluations_owner_select on public.market_regime_evaluations
  for select using (user_id = auth.uid());
create policy momentum_evaluations_owner_select on public.momentum_evaluations
  for select using (user_id = auth.uid());
create policy momentum_factor_results_owner_select on public.momentum_factor_results
  for select using (user_id = auth.uid());
create policy momentum_gate_results_owner_select on public.momentum_gate_results
  for select using (user_id = auth.uid());
create policy momentum_setup_instances_owner_select on public.momentum_setup_instances
  for select using (user_id = auth.uid());
create policy momentum_trade_plan_revisions_owner_select on public.momentum_trade_plan_revisions
  for select using (user_id = auth.uid());
create policy momentum_setup_transitions_owner_select on public.momentum_setup_transitions
  for select using (user_id = auth.uid());
create policy momentum_catalysts_owner_select on public.momentum_catalysts
  for select using (user_id = auth.uid());
create policy momentum_event_risk_owner_select on public.momentum_event_risk_assessments
  for select using (user_id = auth.uid());
create policy momentum_trade_reviews_owner_select on public.momentum_trade_reviews
  for select using (user_id = auth.uid());

create trigger momentum_universe_memberships_immutable before update on public.momentum_universe_memberships
for each row execute function public.prevent_immutable_investment_record_update();
create trigger market_regime_evaluations_immutable before update on public.market_regime_evaluations
for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_evaluations_immutable before update on public.momentum_evaluations
for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_factor_results_immutable before update on public.momentum_factor_results
for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_gate_results_immutable before update on public.momentum_gate_results
for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_setup_instances_immutable before update on public.momentum_setup_instances
for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_trade_plan_revisions_immutable before update on public.momentum_trade_plan_revisions
for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_setup_transitions_immutable before update on public.momentum_setup_transitions
for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_catalysts_immutable before update on public.momentum_catalysts
for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_event_risk_immutable before update on public.momentum_event_risk_assessments
for each row execute function public.prevent_immutable_investment_record_update();
create trigger momentum_trade_reviews_immutable before update on public.momentum_trade_reviews
for each row execute function public.prevent_immutable_investment_record_update();

commit;
