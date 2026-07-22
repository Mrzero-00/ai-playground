begin;

alter table public.model_versions
  add constraint model_versions_id_user_unique unique (id, user_id);

alter table public.decisions
  add constraint decisions_id_user_unique unique (id, user_id);

create table public.learning_review_manifests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_type text not null check (review_type in ('DECISION', 'TRADE', 'SKIP', 'RISK', 'PORTFOLIO', 'INCIDENT')),
  strategy text not null check (strategy in ('CORE', 'FUTURE_CORE', 'MOMENTUM', 'PORTFOLIO', 'RISK')),
  company_id uuid references public.companies(id),
  decision_id uuid,
  evaluation_id uuid,
  proposal_id uuid references public.allocation_proposals(id),
  risk_decision_id uuid references public.risk_decisions(id),
  execution_ids uuid[] not null default '{}',
  lot_ids uuid[] not null default '{}',
  model_version_id uuid not null,
  policy_version_ids uuid[] not null,
  decision_snapshot_ids uuid[] not null,
  outcome_snapshot_ids uuid[] not null,
  decision_evidence_ids uuid[] not null,
  outcome_evidence_ids uuid[] not null,
  counterfactual_evidence_ids uuid[] not null default '{}',
  decision_at timestamptz not null,
  outcome_as_of timestamptz not null,
  reviewed_at timestamptz not null,
  minimum_maturity_at timestamptz not null,
  position_closed_at timestamptz,
  regime text,
  setup_type text,
  industry_code text,
  stage text,
  liquidity_tier text,
  event_policy text,
  censored_reason text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (decision_id, user_id) references public.decisions(id, user_id),
  foreign key (evaluation_id, user_id) references public.evaluations(id, user_id),
  foreign key (model_version_id, user_id) references public.model_versions(id, user_id),
  check (cardinality(policy_version_ids) > 0),
  check (cardinality(decision_snapshot_ids) > 0 and cardinality(outcome_snapshot_ids) > 0),
  check (decision_at <= outcome_as_of and outcome_as_of <= reviewed_at),
  check (position_closed_at is null or (decision_at <= position_closed_at and position_closed_at <= outcome_as_of)),
  check (censored_reason is null or length(trim(censored_reason)) > 0),
  check (review_type = 'SKIP' or decision_id is not null),
  check (review_type <> 'TRADE' or (cardinality(execution_ids) > 0 and cardinality(lot_ids) > 0))
);

create table public.learning_process_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_manifest_id uuid not null,
  dimension text not null check (dimension in (
    'DATA_QUALITY', 'EVIDENCE_DISCIPLINE', 'STRATEGY_RULE_COMPLIANCE', 'PORTFOLIO_SIZING',
    'RISK_COMPLIANCE', 'HUMAN_APPROVAL', 'EXECUTION_QUALITY', 'PSYCHOLOGY_DISCIPLINE'
  )),
  status text not null check (status in ('PASS', 'FAIL', 'PARTIAL', 'NOT_APPLICABLE', 'UNKNOWN')),
  score numeric(8,5) check (score is null or score between 0 and 100),
  reason_codes text[] not null,
  evidence_ids uuid[] not null default '{}',
  critical boolean not null,
  unique (id, user_id),
  unique (review_manifest_id, dimension),
  foreign key (review_manifest_id, user_id) references public.learning_review_manifests(id, user_id) on delete cascade,
  check (cardinality(reason_codes) > 0),
  check ((status = 'NOT_APPLICABLE' and score is null and not critical)
    or (status <> 'NOT_APPLICABLE' and score is not null and cardinality(evidence_ids) > 0))
);

create table public.learning_outcome_attributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_manifest_id uuid not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  price_pnl_base numeric(30,6) not null,
  dividend_pnl_base numeric(30,6) not null,
  fx_pnl_base numeric(30,6) not null,
  fees_base numeric(30,6) not null check (fees_base >= 0),
  taxes_base numeric(30,6) not null check (taxes_base >= 0),
  slippage_base numeric(30,6) not null,
  gross_pnl_base numeric(30,6) not null,
  net_pnl_base numeric(30,6) not null,
  invested_capital_base numeric(30,6) check (invested_capital_base is null or invested_capital_base > 0),
  initial_planned_risk_base numeric(30,6) check (initial_planned_risk_base is null or initial_planned_risk_base > 0),
  return_percent numeric(16,8),
  r_multiple numeric(16,8),
  mae_percent numeric(16,8) check (mae_percent is null or mae_percent <= 0),
  mfe_percent numeric(16,8) check (mfe_percent is null or mfe_percent >= 0),
  holding_sessions integer check (holding_sessions is null or holding_sessions >= 0),
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (review_manifest_id),
  foreign key (review_manifest_id, user_id) references public.learning_review_manifests(id, user_id) on delete cascade,
  check (gross_pnl_base = price_pnl_base + dividend_pnl_base + fx_pnl_base),
  check (net_pnl_base = gross_pnl_base - fees_base - taxes_base)
);

create table public.learning_decision_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_manifest_id uuid not null,
  outcome_attribution_id uuid,
  maturity text not null check (maturity in ('IMMATURE', 'PARTIALLY_MATURE', 'MATURE', 'CENSORED')),
  process_score numeric(8,5) not null check (process_score between 0 and 100),
  good_process boolean not null,
  outcome_expectation_met boolean not null,
  classification text not null check (classification in (
    'GOOD_PROCESS_GOOD_OUTCOME', 'GOOD_PROCESS_BAD_OUTCOME', 'BAD_PROCESS_GOOD_OUTCOME',
    'BAD_PROCESS_BAD_OUTCOME', 'INCOMPLETE_PROCESS', 'IMMATURE_OUTCOME'
  )),
  outcome_reason_codes text[] not null,
  outcome_evidence_ids uuid[] not null,
  reviewer_id uuid not null references auth.users(id),
  notes text not null,
  code_version text not null,
  reviewed_at timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (review_manifest_id),
  foreign key (review_manifest_id, user_id) references public.learning_review_manifests(id, user_id),
  foreign key (outcome_attribution_id, user_id) references public.learning_outcome_attributions(id, user_id),
  check (cardinality(outcome_reason_codes) > 0 and cardinality(outcome_evidence_ids) > 0),
  check (length(trim(notes)) > 0 and length(trim(code_version)) > 0),
  check (maturity not in ('MATURE', 'CENSORED') or classification <> 'IMMATURE_OUTCOME')
);

create table public.learning_cohort_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy text not null check (strategy in ('CORE', 'FUTURE_CORE', 'MOMENTUM', 'PORTFOLIO', 'RISK')),
  model_version_id uuid not null,
  policy_version_ids uuid[] not null,
  cohort_key jsonb not null,
  review_ids uuid[] not null,
  sample_size integer not null check (sample_size > 0),
  mature_count integer not null check (mature_count >= 0),
  censored_count integer not null check (censored_count >= 0),
  good_process_count integer not null check (good_process_count >= 0),
  good_outcome_count integer not null check (good_outcome_count >= 0),
  evidence_coverage numeric(10,9) not null check (evidence_coverage between 0 and 1),
  regime_count integer not null check (regime_count >= 0),
  maximum_company_concentration numeric(10,9) not null check (maximum_company_concentration between 0 and 1),
  eligible_for_lesson boolean not null,
  blocker_codes text[] not null default '{}',
  analyzed_at timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (model_version_id, user_id) references public.model_versions(id, user_id),
  check (jsonb_typeof(cohort_key) = 'object'),
  check (cardinality(policy_version_ids) > 0 and cardinality(review_ids) = sample_size),
  check (mature_count <= sample_size and censored_count <= sample_size),
  check (eligible_for_lesson = (cardinality(blocker_codes) = 0))
);

create table public.learning_lesson_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cohort_analysis_id uuid not null,
  lesson_type text not null check (lesson_type in ('DATA', 'MODEL', 'EXECUTION', 'RISK', 'PSYCHOLOGY', 'PORTFOLIO', 'NO_CHANGE')),
  strategy text not null check (strategy in ('CORE', 'FUTURE_CORE', 'MOMENTUM', 'PORTFOLIO', 'RISK')),
  title text not null,
  original_assumption text not null,
  observed_pattern text not null,
  alternative_explanations text[] not null,
  supporting_review_ids uuid[] not null,
  contradicting_review_ids uuid[] not null default '{}',
  evidence_ids uuid[] not null,
  sample_size integer not null check (sample_size > 0),
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  status text not null check (status in ('CANDIDATE', 'BLOCKED', 'READY_FOR_REVIEW')),
  blocker_codes text[] not null default '{}',
  generated_at timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (cohort_analysis_id, user_id) references public.learning_cohort_analyses(id, user_id),
  check (cardinality(alternative_explanations) > 0 and cardinality(supporting_review_ids) > 0 and cardinality(evidence_ids) > 0),
  check (not (supporting_review_ids && contradicting_review_ids)),
  check ((status = 'BLOCKED') = (cardinality(blocker_codes) > 0))
);

create table public.investment_lessons_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null,
  lesson_type text not null check (lesson_type in ('DATA', 'MODEL', 'EXECUTION', 'RISK', 'PSYCHOLOGY', 'PORTFOLIO', 'NO_CHANGE')),
  strategy text not null check (strategy in ('CORE', 'FUTURE_CORE', 'MOMENTUM', 'PORTFOLIO', 'RISK')),
  title text not null,
  process_assessment text not null,
  outcome_assessment text not null,
  model_assessment text not null,
  recommended_action text not null check (recommended_action in ('NO_CHANGE', 'DATA_FIX', 'PROCESS_FIX', 'MODEL_HYPOTHESIS', 'POLICY_REVIEW', 'ARCHITECTURE_REVIEW')),
  status text not null check (status in ('APPROVED', 'REJECTED', 'SUPERSEDED')),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null,
  supersedes_lesson_id uuid,
  evidence_ids uuid[] not null,
  review_ids uuid[] not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (candidate_id),
  foreign key (candidate_id, user_id) references public.learning_lesson_candidates(id, user_id),
  foreign key (supersedes_lesson_id, user_id) references public.investment_lessons_v1(id, user_id),
  check (cardinality(evidence_ids) > 0 and cardinality(review_ids) > 0),
  check ((lesson_type = 'NO_CHANGE') = (recommended_action = 'NO_CHANGE'))
);

create table public.model_change_proposals_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_ids uuid[] not null,
  target_model_family text not null check (target_model_family in ('LONG_TERM', 'MOMENTUM', 'PORTFOLIO', 'RISK')),
  champion_model_version_id uuid not null,
  challenger_model_version_id uuid not null,
  problem text not null,
  hypothesis text not null,
  proposed_change text not null,
  expected_benefit text not null,
  possible_side_effects text[] not null,
  rollback_plan text not null,
  primary_metric text not null,
  primary_metric_direction text not null check (primary_metric_direction in ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER')),
  guardrail_metrics text[] not null,
  status text not null check (status in ('HYPOTHESIS', 'VALIDATING', 'REJECTED', 'READY_FOR_APPROVAL', 'APPROVED', 'ACTIVATED', 'ROLLED_BACK')),
  requires_historical_replay boolean not null default true check (requires_historical_replay),
  requires_walk_forward boolean not null default true check (requires_walk_forward),
  requires_shadow_mode boolean not null default true check (requires_shadow_mode),
  requires_human_approval boolean not null default true check (requires_human_approval),
  supersedes_proposal_id uuid,
  validation_result_id uuid,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (champion_model_version_id, user_id) references public.model_versions(id, user_id),
  foreign key (challenger_model_version_id, user_id) references public.model_versions(id, user_id),
  foreign key (supersedes_proposal_id, user_id) references public.model_change_proposals_v1(id, user_id),
  check (champion_model_version_id <> challenger_model_version_id),
  check (cardinality(lesson_ids) > 0 and cardinality(possible_side_effects) > 0 and cardinality(guardrail_metrics) > 0),
  check (status <> 'APPROVED' or (approved_by is not null and approved_at is not null))
);

create table public.model_validation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid not null,
  evaluated_at timestamptz not null,
  code_version text not null,
  verdict text not null check (verdict in ('PASS', 'PASS_WITH_GUARDRAILS', 'INSUFFICIENT_EVIDENCE', 'FAIL', 'BLOCKED')),
  blocker_codes text[] not null default '{}',
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (proposal_id, user_id) references public.model_change_proposals_v1(id, user_id),
  check ((verdict in ('PASS', 'PASS_WITH_GUARDRAILS')) = (cardinality(blocker_codes) = 0))
);

alter table public.model_change_proposals_v1
  add constraint model_change_validation_result_fk
  foreign key (validation_result_id, user_id) references public.model_validation_runs(id, user_id);

create table public.model_validation_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  validation_run_id uuid not null,
  stage text not null check (stage in ('HISTORICAL_REPLAY', 'WALK_FORWARD', 'SHADOW')),
  dataset_manifest_id uuid not null,
  champion_metric numeric not null,
  challenger_metric numeric not null,
  guardrails jsonb not null,
  point_in_time_valid boolean not null,
  operational_state_change_allowed boolean not null default false check (not operational_state_change_allowed),
  sample_size integer not null check (sample_size > 0),
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (validation_run_id, stage),
  foreign key (validation_run_id, user_id) references public.model_validation_runs(id, user_id) on delete cascade,
  check (jsonb_typeof(guardrails) = 'object')
);

create table public.shadow_model_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid not null,
  input_snapshot_ids uuid[] not null,
  champion_output jsonb not null,
  challenger_output jsonb not null,
  divergence jsonb not null,
  observed_at timestamptz not null,
  operational_state_change_allowed boolean not null default false check (not operational_state_change_allowed),
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (proposal_id, user_id) references public.model_change_proposals_v1(id, user_id),
  check (cardinality(input_snapshot_ids) > 0),
  check (jsonb_typeof(champion_output) = 'object' and jsonb_typeof(challenger_output) = 'object' and jsonb_typeof(divergence) = 'object')
);

create table public.learning_drift_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_version_id uuid not null,
  drift_type text not null check (drift_type in ('DATA', 'FEATURE', 'SCORE', 'CALIBRATION', 'ACTION', 'PORTFOLIO', 'EXECUTION_COST', 'OUTCOME', 'RULE_COMPLIANCE')),
  severity text not null check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  status text not null check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  metric_name text not null,
  observed_value numeric,
  expected_range jsonb not null,
  evidence_ids uuid[] not null,
  detected_at timestamptz not null,
  resolved_at timestamptz,
  resolution_record_id uuid,
  unique (id, user_id),
  foreign key (model_version_id, user_id) references public.model_versions(id, user_id),
  check (jsonb_typeof(expected_range) = 'object' and cardinality(evidence_ids) > 0),
  check (status <> 'RESOLVED' or (resolved_at is not null and resolution_record_id is not null))
);

create index learning_reviews_model_time on public.learning_decision_reviews(user_id, reviewed_at desc);
create index learning_manifests_strategy_model on public.learning_review_manifests(user_id, strategy, model_version_id, outcome_as_of desc);
create index learning_cohorts_model_time on public.learning_cohort_analyses(user_id, model_version_id, analyzed_at desc);
create index learning_candidates_status on public.learning_lesson_candidates(user_id, status, generated_at desc);
create index learning_lessons_strategy on public.investment_lessons_v1(user_id, strategy, approved_at desc);
create index model_changes_status on public.model_change_proposals_v1(user_id, status, created_at desc);
create index model_validations_proposal on public.model_validation_runs(user_id, proposal_id, evaluated_at desc);
create index learning_drift_open on public.learning_drift_alerts(user_id, severity, detected_at desc) where status = 'OPEN';

alter table public.learning_review_manifests enable row level security;
alter table public.learning_process_results enable row level security;
alter table public.learning_outcome_attributions enable row level security;
alter table public.learning_decision_reviews enable row level security;
alter table public.learning_cohort_analyses enable row level security;
alter table public.learning_lesson_candidates enable row level security;
alter table public.investment_lessons_v1 enable row level security;
alter table public.model_change_proposals_v1 enable row level security;
alter table public.model_validation_runs enable row level security;
alter table public.model_validation_metrics enable row level security;
alter table public.shadow_model_observations enable row level security;
alter table public.learning_drift_alerts enable row level security;

create policy learning_manifests_owner_select on public.learning_review_manifests for select using (user_id = auth.uid());
create policy learning_process_owner_select on public.learning_process_results for select using (user_id = auth.uid());
create policy learning_outcomes_owner_select on public.learning_outcome_attributions for select using (user_id = auth.uid());
create policy learning_reviews_owner_select on public.learning_decision_reviews for select using (user_id = auth.uid());
create policy learning_cohorts_owner_select on public.learning_cohort_analyses for select using (user_id = auth.uid());
create policy learning_candidates_owner_select on public.learning_lesson_candidates for select using (user_id = auth.uid());
create policy learning_lessons_v1_owner_select on public.investment_lessons_v1 for select using (user_id = auth.uid());
create policy model_changes_v1_owner_select on public.model_change_proposals_v1 for select using (user_id = auth.uid());
create policy model_validations_owner_select on public.model_validation_runs for select using (user_id = auth.uid());
create policy model_validation_metrics_owner_select on public.model_validation_metrics for select using (user_id = auth.uid());
create policy shadow_observations_owner_select on public.shadow_model_observations for select using (user_id = auth.uid());
create policy learning_drift_owner_select on public.learning_drift_alerts for select using (user_id = auth.uid());

create trigger learning_manifests_immutable before update on public.learning_review_manifests for each row execute function public.prevent_immutable_investment_record_update();
create trigger learning_process_immutable before update on public.learning_process_results for each row execute function public.prevent_immutable_investment_record_update();
create trigger learning_outcomes_immutable before update on public.learning_outcome_attributions for each row execute function public.prevent_immutable_investment_record_update();
create trigger learning_reviews_immutable before update on public.learning_decision_reviews for each row execute function public.prevent_immutable_investment_record_update();
create trigger learning_cohorts_immutable before update on public.learning_cohort_analyses for each row execute function public.prevent_immutable_investment_record_update();
create trigger learning_candidates_immutable before update on public.learning_lesson_candidates for each row execute function public.prevent_immutable_investment_record_update();
create trigger learning_lessons_v1_immutable before update on public.investment_lessons_v1 for each row execute function public.prevent_immutable_investment_record_update();
create trigger model_changes_v1_immutable before update on public.model_change_proposals_v1 for each row execute function public.prevent_immutable_investment_record_update();
create trigger model_validations_immutable before update on public.model_validation_runs for each row execute function public.prevent_immutable_investment_record_update();
create trigger model_validation_metrics_immutable before update on public.model_validation_metrics for each row execute function public.prevent_immutable_investment_record_update();
create trigger shadow_observations_immutable before update on public.shadow_model_observations for each row execute function public.prevent_immutable_investment_record_update();
commit;
