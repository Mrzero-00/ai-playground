begin;

alter table public.evaluations
  add constraint evaluations_id_user_unique unique (id, user_id);

create table public.industry_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  industry_code text not null,
  name text not null,
  status text not null check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  supported_profiles text[] not null,
  not_applicable_factor_ids text[] not null default '{}',
  critical_factor_ids text[] not null default '{}',
  minimum_applicable_weight numeric(5,2) not null default 85 check (minimum_applicable_weight > 0 and minimum_applicable_weight <= 100),
  model_fit_validated boolean not null default false,
  effective_from timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, industry_code, version),
  check (cardinality(supported_profiles) > 0),
  check (supported_profiles <@ array['CORE', 'FUTURE_CORE']::text[]),
  check (not (critical_factor_ids && not_applicable_factor_ids))
);

create unique index one_active_industry_profile_per_user_code
  on public.industry_profiles(user_id, industry_code) where status = 'ACTIVE';

create table public.long_term_evaluations (
  evaluation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  security_id text not null,
  mode text not null check (mode in ('INITIAL_SCREEN', 'FULL_REVIEW', 'SCHEDULED_REFRESH', 'EARNINGS_REVIEW', 'EVENT_REVIEW', 'DRAWDOWN_REVIEW', 'HISTORICAL_REPLAY')),
  primary_profile text not null check (primary_profile in ('CORE', 'FUTURE_CORE', 'NONE')),
  stage_before text not null,
  proposed_stage text not null,
  stage_change_requires_human_approval boolean not null,
  operational_state_change_allowed boolean not null,
  action text not null check (action in ('ACCUMULATE', 'BUY_ON_WEAKNESS', 'HOLD', 'WATCH', 'REDUCE', 'EXIT', 'REVIEW_REQUIRED')),
  action_constraints text[] not null default '{}',
  thesis_id uuid references public.long_term_theses(id),
  thesis_status text not null check (thesis_status in ('STRENGTHENED', 'UNCHANGED', 'WEAKENED', 'BROKEN', 'REPLACED')),
  philosophy_version_id uuid not null references public.philosophy_versions(id),
  industry_profile_id uuid not null references public.industry_profiles(id),
  permanent_impairment_risk numeric(5,2) not null check (permanent_impairment_risk between 0 and 100),
  next_review_at timestamptz not null,
  review_triggers text[] not null,
  confidence jsonb not null,
  explanation jsonb not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (evaluation_id, user_id),
  foreign key (evaluation_id, user_id) references public.evaluations(id, user_id) on delete cascade,
  check (cardinality(review_triggers) > 0),
  check (mode <> 'HISTORICAL_REPLAY' or not operational_state_change_allowed),
  check (action not in ('ACCUMULATE', 'BUY_ON_WEAKNESS') or thesis_status in ('STRENGTHENED', 'UNCHANGED'))
);

create table public.long_term_profile_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  evaluation_id uuid not null,
  profile text not null check (profile in ('CORE', 'FUTURE_CORE')),
  point_score numeric(5,2) not null check (point_score between 0 and 100),
  low_score numeric(5,2) not null check (low_score between 0 and 100),
  high_score numeric(5,2) not null check (high_score between 0 and 100),
  eligibility text not null check (eligibility in ('ELIGIBLE', 'INELIGIBLE', 'REVIEW_REQUIRED')),
  eligibility_reasons text[] not null default '{}',
  confidence jsonb not null,
  ranking_tier text not null check (ranking_tier in ('A', 'B', 'C', 'D')),
  sensitivity_drivers text[] not null default '{}',
  unique (id, user_id),
  unique (evaluation_id, profile),
  foreign key (evaluation_id, user_id) references public.long_term_evaluations(evaluation_id, user_id) on delete cascade,
  check (low_score <= point_score and point_score <= high_score)
);

create table public.long_term_factor_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_result_id uuid not null,
  factor_id text not null,
  score numeric(5,2) check (score is null or score between 0 and 100),
  bear_score numeric(5,2) check (bear_score is null or bear_score between 0 and 100),
  bull_score numeric(5,2) check (bull_score is null or bull_score between 0 and 100),
  status text not null check (status in ('SCORED', 'BLOCKED', 'NOT_APPLICABLE')),
  availability text not null check (availability in ('AVAILABLE', 'PARTIAL', 'NOT_APPLICABLE', 'UNKNOWN', 'STALE', 'CONFLICTED')),
  weight numeric(7,4) not null check (weight >= 0 and weight <= 100),
  applicable_weight numeric(7,4) not null check (applicable_weight >= 0 and applicable_weight <= weight),
  trend text not null check (trend in ('IMPROVING', 'STABLE', 'DETERIORATING', 'UNKNOWN')),
  supporting_evidence_ids uuid[] not null default '{}',
  counter_evidence_ids uuid[] not null default '{}',
  warnings text[] not null default '{}',
  explanation text not null,
  unique (profile_result_id, factor_id),
  foreign key (profile_result_id, user_id) references public.long_term_profile_results(id, user_id) on delete cascade,
  check ((status = 'SCORED' and score is not null and cardinality(supporting_evidence_ids) > 0)
    or (status <> 'SCORED' and score is null)),
  check (status <> 'NOT_APPLICABLE' or applicable_weight = 0)
);

create table public.long_term_gate_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  evaluation_id uuid not null,
  gate_id text not null,
  status text not null check (status in ('PASSED', 'FAILED', 'REVIEW_REQUIRED', 'NOT_APPLICABLE')),
  severity text not null check (severity in ('INFO', 'SOFT', 'HARD')),
  reason_code text not null,
  evidence_ids uuid[] not null default '{}',
  explanation text not null,
  blocked_actions text[] not null default '{}',
  unique (evaluation_id, gate_id),
  foreign key (evaluation_id, user_id) references public.long_term_evaluations(evaluation_id, user_id) on delete cascade
);

create table public.long_term_valuation_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  evaluation_id uuid not null unique,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  market_price numeric(20,6) not null check (market_price > 0),
  market_price_as_of timestamptz not null,
  classification text not null check (classification in ('ATTRACTIVE', 'FAIR', 'EXPENSIVE', 'EXTREME', 'UNKNOWN')),
  methods text[] not null,
  expected_return_positive boolean not null,
  bear_loss_tolerable boolean not null,
  sensitivity_drivers text[] not null,
  warnings text[] not null default '{}',
  unique (id, user_id),
  foreign key (evaluation_id, user_id) references public.long_term_evaluations(evaluation_id, user_id) on delete cascade,
  check (cardinality(methods) >= 2 and cardinality(sensitivity_drivers) > 0)
);

create table public.long_term_valuation_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  valuation_result_id uuid not null,
  name text not null check (name in ('BEAR', 'BASE', 'BULL')),
  probability numeric(10,9) not null check (probability > 0 and probability < 1),
  enterprise_value numeric(20,6) not null check (enterprise_value >= 0),
  equity_value numeric(20,6) not null check (equity_value >= 0),
  value_per_share numeric(20,6) not null check (value_per_share >= 0),
  expected_annual_return_5y numeric(12,9),
  expected_annual_return_10y numeric(12,9),
  evidence_ids uuid[] not null,
  unique (valuation_result_id, name),
  foreign key (valuation_result_id, user_id) references public.long_term_valuation_results(id, user_id) on delete cascade,
  check (cardinality(evidence_ids) > 0)
);

create table public.long_term_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  from_stage text not null,
  to_stage text not null,
  evaluation_id uuid not null,
  thesis_id uuid references public.long_term_theses(id),
  reason_code text not null,
  rationale text not null,
  evidence_ids uuid[] not null,
  policy_version_id uuid not null references public.model_versions(id),
  status text not null default 'PROPOSED' check (status in ('PROPOSED', 'APPROVED', 'REJECTED')),
  proposed_at timestamptz not null,
  proposed_by uuid not null references auth.users(id),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  foreign key (evaluation_id, user_id) references public.long_term_evaluations(evaluation_id, user_id),
  check (from_stage <> to_stage),
  check (cardinality(evidence_ids) > 0),
  check (status <> 'APPROVED' or (approved_at is not null and approved_by is not null)),
  check (to_stage not in ('FUTURE_CORE', 'CORE', 'REMOVED', 'ARCHIVED') or status <> 'APPROVED' or approved_by is not null)
);

create table public.long_term_review_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  evaluation_id uuid not null,
  review_type text not null check (review_type in ('SCHEDULED', 'EARNINGS', 'EVENT', 'DRAWDOWN', 'HARD_RISK')),
  due_at timestamptz not null,
  trigger_codes text[] not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (evaluation_id, user_id) references public.long_term_evaluations(evaluation_id, user_id) on delete cascade,
  check (cardinality(trigger_codes) > 0),
  check (status <> 'COMPLETED' or completed_at is not null)
);

create index long_term_evaluations_user_review on public.long_term_evaluations(user_id, next_review_at);
create index long_term_profiles_ranking on public.long_term_profile_results(user_id, profile, ranking_tier, point_score desc);
create index long_term_factors_profile on public.long_term_factor_results(profile_result_id, factor_id);
create index long_term_transitions_company_date on public.long_term_stage_transitions(company_id, proposed_at desc);
create index long_term_reviews_due on public.long_term_review_schedules(user_id, due_at) where status = 'PENDING';

alter table public.industry_profiles enable row level security;
alter table public.long_term_evaluations enable row level security;
alter table public.long_term_profile_results enable row level security;
alter table public.long_term_factor_results enable row level security;
alter table public.long_term_gate_results enable row level security;
alter table public.long_term_valuation_results enable row level security;
alter table public.long_term_valuation_scenarios enable row level security;
alter table public.long_term_stage_transitions enable row level security;
alter table public.long_term_review_schedules enable row level security;

create policy industry_profiles_owner_all on public.industry_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy long_term_evaluations_owner_all on public.long_term_evaluations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy long_term_profile_results_owner_all on public.long_term_profile_results for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy long_term_factor_results_owner_all on public.long_term_factor_results for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy long_term_gate_results_owner_all on public.long_term_gate_results for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy long_term_valuation_results_owner_all on public.long_term_valuation_results for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy long_term_valuation_scenarios_owner_all on public.long_term_valuation_scenarios for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy long_term_stage_transitions_owner_all on public.long_term_stage_transitions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy long_term_review_schedules_owner_all on public.long_term_review_schedules for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger long_term_evaluations_immutable before update on public.long_term_evaluations
for each row execute function public.prevent_immutable_investment_record_update();
create trigger long_term_profile_results_immutable before update on public.long_term_profile_results
for each row execute function public.prevent_immutable_investment_record_update();
create trigger long_term_factor_results_immutable before update on public.long_term_factor_results
for each row execute function public.prevent_immutable_investment_record_update();
create trigger long_term_gate_results_immutable before update on public.long_term_gate_results
for each row execute function public.prevent_immutable_investment_record_update();
create trigger long_term_valuation_results_immutable before update on public.long_term_valuation_results
for each row execute function public.prevent_immutable_investment_record_update();
create trigger long_term_valuation_scenarios_immutable before update on public.long_term_valuation_scenarios
for each row execute function public.prevent_immutable_investment_record_update();

commit;
