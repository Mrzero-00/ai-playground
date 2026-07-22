begin;

create table public.scoring_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  scope text not null check (scope in ('LONG_TERM_CORE', 'LONG_TERM_FUTURE_CORE', 'MOMENTUM_SETUP')),
  status text not null check (status in ('DRAFT', 'VALIDATING', 'SHADOW', 'APPROVED', 'ACTIVE', 'DEPRECATED', 'REJECTED')),
  minimum_applicable_weight_basis_points integer not null check (minimum_applicable_weight_basis_points between 1 and 10000),
  confidence_policy jsonb not null,
  effective_from timestamptz not null,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  supersedes_model_id uuid,
  change_reason text not null check (length(trim(change_reason)) > 0),
  model_hash text not null check (model_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, scope, version),
  foreign key (supersedes_model_id, user_id) references public.scoring_models(id, user_id),
  check (supersedes_model_id is null or supersedes_model_id <> id),
  check (status not in ('APPROVED', 'ACTIVE', 'DEPRECATED') or (approved_by is not null and approved_at is not null)),
  check (approved_at is null or approved_at <= effective_from)
);

create unique index scoring_models_one_active_scope on public.scoring_models(user_id, scope) where status = 'ACTIVE';

create table public.scoring_factor_definitions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  factor_key text not null,
  label text not null,
  direction text not null check (direction in ('HIGHER_IS_BETTER', 'HIGHER_IS_WORSE', 'TARGET_IS_BEST')),
  weight_basis_points integer not null check (weight_basis_points between 1 and 10000),
  critical boolean not null,
  allowed_not_applicable boolean not null,
  normalization_policy jsonb not null,
  evidence_policy jsonb not null,
  partial_score_cap numeric(8,5) check (partial_score_cap between 0 and 100),
  effective_from timestamptz not null,
  unique (id, user_id),
  unique (model_id, factor_key),
  foreign key (model_id, user_id) references public.scoring_models(id, user_id) on delete cascade,
  check (not critical or not allowed_not_applicable)
);

create table public.scoring_thresholds (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  threshold_key text not null,
  minimum_score numeric(8,5) not null check (minimum_score between 0 and 100),
  minimum_confidence numeric(8,5) not null check (minimum_confidence between 0 and 100),
  purpose text not null,
  unique (id, user_id),
  unique (model_id, threshold_key),
  foreign key (model_id, user_id) references public.scoring_models(id, user_id) on delete cascade
);

create table public.scoring_scorecards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid not null,
  subject_type text not null check (subject_type in ('COMPANY', 'SECURITY', 'SETUP', 'REVIEW_COHORT')),
  subject_id text not null,
  scope text not null check (scope in ('LONG_TERM_CORE', 'LONG_TERM_FUTURE_CORE', 'MOMENTUM_SETUP')),
  mode text not null check (mode in ('OPERATIONAL', 'SHADOW', 'HISTORICAL_REPLAY')),
  status text not null check (status in ('SCORED', 'BLOCKED', 'UNAVAILABLE')),
  score_point numeric(8,5) check (score_point between 0 and 100),
  score_low numeric(8,5) check (score_low between 0 and 100),
  score_high numeric(8,5) check (score_high between 0 and 100),
  blocker_codes text[] not null default '{}',
  philosophy_version_id text not null,
  industry_profile_version_id text,
  setup_definition_version text,
  snapshot_ids uuid[] not null,
  evidence_ids uuid[] not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null,
  code_version text not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (model_id, user_id) references public.scoring_models(id, user_id),
  check (as_of <= evaluated_at),
  check ((status = 'SCORED') = (score_point is not null and score_low is not null and score_high is not null)),
  check (score_low is null or (score_low <= score_point and score_point <= score_high)),
  check ((status = 'SCORED') = (cardinality(blocker_codes) = 0))
);

create table public.scoring_factor_results (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null,
  factor_definition_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  factor_key text not null,
  status text not null check (status in ('SCORED', 'BLOCKED', 'NOT_APPLICABLE')),
  availability text not null check (availability in ('AVAILABLE', 'PARTIAL', 'NOT_APPLICABLE', 'UNKNOWN', 'STALE', 'CONFLICTED')),
  direction text not null check (direction in ('HIGHER_IS_BETTER', 'HIGHER_IS_WORSE', 'TARGET_IS_BEST')),
  score numeric(8,5) check (score between 0 and 100),
  score_low numeric(8,5) check (score_low between 0 and 100),
  score_high numeric(8,5) check (score_high between 0 and 100),
  original_weight_basis_points integer not null check (original_weight_basis_points between 1 and 10000),
  effective_weight_basis_points numeric(12,4) not null check (effective_weight_basis_points between 0 and 10000),
  contribution numeric(12,6),
  evidence_ids uuid[] not null default '{}',
  counter_evidence_ids uuid[] not null default '{}',
  warning_codes text[] not null default '{}',
  explanation text not null,
  unique (id, user_id),
  unique (scorecard_id, factor_key),
  foreign key (scorecard_id, user_id) references public.scoring_scorecards(id, user_id) on delete cascade,
  foreign key (factor_definition_id, user_id) references public.scoring_factor_definitions(id, user_id),
  check ((status = 'SCORED') = (score is not null and score_low is not null and score_high is not null and contribution is not null)),
  check (score_low is null or (score_low <= score and score <= score_high)),
  check (status <> 'NOT_APPLICABLE' or (availability = 'NOT_APPLICABLE' and effective_weight_basis_points = 0))
);

create table public.scoring_confidence_results (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  score numeric(8,5) not null check (score between 0 and 100),
  grade text not null check (grade in ('HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED')),
  evidence_coverage numeric(8,5) not null check (evidence_coverage between 0 and 100),
  source_quality numeric(8,5) not null check (source_quality between 0 and 100),
  freshness numeric(8,5) not null check (freshness between 0 and 100),
  model_fit numeric(8,5) not null check (model_fit between 0 and 100),
  disagreement numeric(8,5) not null check (disagreement between 0 and 100),
  warning_codes text[] not null default '{}',
  unique (id, user_id),
  unique (scorecard_id),
  foreign key (scorecard_id, user_id) references public.scoring_scorecards(id, user_id) on delete cascade
);

create table public.scoring_confidence_caps (
  id uuid primary key default gen_random_uuid(),
  confidence_result_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  maximum numeric(8,5) not null check (maximum between 0 and 100),
  unique (confidence_result_id, code),
  foreign key (confidence_result_id, user_id) references public.scoring_confidence_results(id, user_id) on delete cascade
);

create table public.scoring_change_explanations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_scorecard_id uuid not null,
  current_scorecard_id uuid not null,
  comparison_status text not null check (comparison_status in ('COMPARABLE', 'MODEL_CHANGED', 'NOT_COMPARABLE')),
  point_delta numeric(9,5),
  confidence_delta numeric(9,5) not null check (confidence_delta between -100 and 100),
  reason_codes text[] not null default '{}',
  explained_at timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (previous_scorecard_id, user_id) references public.scoring_scorecards(id, user_id),
  foreign key (current_scorecard_id, user_id) references public.scoring_scorecards(id, user_id),
  check (previous_scorecard_id <> current_scorecard_id),
  check ((comparison_status = 'COMPARABLE') = (point_delta is not null))
);

create table public.scoring_factor_deltas (
  id uuid primary key default gen_random_uuid(),
  change_explanation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  factor_key text not null,
  previous_contribution numeric(12,6),
  current_contribution numeric(12,6),
  contribution_delta numeric(12,6),
  reason_codes text[] not null default '{}',
  unique (change_explanation_id, factor_key),
  foreign key (change_explanation_id, user_id) references public.scoring_change_explanations(id, user_id) on delete cascade
);

create table public.scoring_calibration_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid not null,
  strategy_horizon text not null,
  status text not null check (status in ('PASSED', 'FAILED', 'BLOCKED')),
  sample_size integer not null check (sample_size >= 0),
  point_in_time_valid boolean not null,
  tail_guardrail_passed boolean not null,
  cohort_manifest_hash text not null check (cohort_manifest_hash ~ '^[0-9a-f]{64}$'),
  finding_codes text[] not null default '{}',
  executed_at timestamptz not null,
  unique (id, user_id),
  foreign key (model_id, user_id) references public.scoring_models(id, user_id),
  check (status <> 'PASSED' or (point_in_time_valid and tail_guardrail_passed and cardinality(finding_codes) = 0))
);

create table public.scoring_calibration_buckets (
  id uuid primary key default gen_random_uuid(),
  calibration_run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  score_min numeric(8,5) not null check (score_min between 0 and 100),
  score_max numeric(8,5) not null check (score_max between 0 and 100),
  sample_size integer not null check (sample_size >= 0),
  outcome_summary jsonb not null,
  unique (calibration_run_id, score_min, score_max),
  foreign key (calibration_run_id, user_id) references public.scoring_calibration_runs(id, user_id) on delete cascade,
  check (score_min < score_max)
);

create or replace function public.validate_scoring_model_weight_total()
returns trigger language plpgsql as $$
declare target_model_id uuid; total_weight integer;
begin
  if tg_table_name = 'scoring_models' then
    target_model_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    target_model_id := case when tg_op = 'DELETE' then old.model_id else new.model_id end;
  end if;
  select coalesce(sum(weight_basis_points), 0) into total_weight from public.scoring_factor_definitions where model_id = target_model_id;
  if total_weight <> 10000 then raise exception 'scoring model factor weights must sum to 10000 basis points'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create constraint trigger scoring_models_weight_total after insert or update on public.scoring_models
deferrable initially deferred for each row execute function public.validate_scoring_model_weight_total();
create constraint trigger scoring_factors_weight_total after insert or update or delete on public.scoring_factor_definitions
deferrable initially deferred for each row execute function public.validate_scoring_model_weight_total();

create index scoring_models_scope_version on public.scoring_models(user_id, scope, effective_from desc);
create index scoring_scorecards_subject_time on public.scoring_scorecards(user_id, scope, subject_type, subject_id, evaluated_at desc);
create index scoring_scorecards_rank on public.scoring_scorecards(user_id, scope, model_id, score_point desc, evaluated_at desc) where status = 'SCORED';
create index scoring_calibration_model_time on public.scoring_calibration_runs(user_id, model_id, executed_at desc);

alter table public.scoring_models enable row level security;
alter table public.scoring_factor_definitions enable row level security;
alter table public.scoring_thresholds enable row level security;
alter table public.scoring_scorecards enable row level security;
alter table public.scoring_factor_results enable row level security;
alter table public.scoring_confidence_results enable row level security;
alter table public.scoring_confidence_caps enable row level security;
alter table public.scoring_change_explanations enable row level security;
alter table public.scoring_factor_deltas enable row level security;
alter table public.scoring_calibration_runs enable row level security;
alter table public.scoring_calibration_buckets enable row level security;

create policy scoring_models_owner_select on public.scoring_models for select using (user_id = auth.uid());
create policy scoring_factors_owner_select on public.scoring_factor_definitions for select using (user_id = auth.uid());
create policy scoring_thresholds_owner_select on public.scoring_thresholds for select using (user_id = auth.uid());
create policy scoring_scorecards_owner_select on public.scoring_scorecards for select using (user_id = auth.uid());
create policy scoring_factor_results_owner_select on public.scoring_factor_results for select using (user_id = auth.uid());
create policy scoring_confidence_owner_select on public.scoring_confidence_results for select using (user_id = auth.uid());
create policy scoring_caps_owner_select on public.scoring_confidence_caps for select using (user_id = auth.uid());
create policy scoring_changes_owner_select on public.scoring_change_explanations for select using (user_id = auth.uid());
create policy scoring_deltas_owner_select on public.scoring_factor_deltas for select using (user_id = auth.uid());
create policy scoring_calibration_owner_select on public.scoring_calibration_runs for select using (user_id = auth.uid());
create policy scoring_calibration_buckets_owner_select on public.scoring_calibration_buckets for select using (user_id = auth.uid());

create or replace function public.validate_scoring_model_transition()
returns trigger language plpgsql as $$
begin
  if old.id <> new.id or old.user_id <> new.user_id or old.version <> new.version or old.scope <> new.scope
     or old.minimum_applicable_weight_basis_points <> new.minimum_applicable_weight_basis_points
     or old.confidence_policy <> new.confidence_policy or old.effective_from <> new.effective_from
     or old.supersedes_model_id is distinct from new.supersedes_model_id or old.change_reason <> new.change_reason
     or old.model_hash <> new.model_hash or old.created_at <> new.created_at then
    raise exception 'scoring model immutable configuration cannot change';
  end if;
  if old.status = 'DRAFT' and new.status not in ('VALIDATING', 'REJECTED') then raise exception 'invalid scoring model transition'; end if;
  if old.status = 'VALIDATING' and new.status not in ('SHADOW', 'REJECTED') then raise exception 'invalid scoring model transition'; end if;
  if old.status = 'SHADOW' and new.status not in ('APPROVED', 'REJECTED') then raise exception 'invalid scoring model transition'; end if;
  if old.status = 'APPROVED' and new.status not in ('ACTIVE', 'REJECTED') then raise exception 'invalid scoring model transition'; end if;
  if old.status = 'ACTIVE' and new.status <> 'DEPRECATED' then raise exception 'invalid scoring model transition'; end if;
  if old.status in ('DEPRECATED', 'REJECTED') then raise exception 'terminal scoring model is immutable'; end if;
  if new.status = 'APPROVED' and (new.approved_by is null or new.approved_at is null) then raise exception 'approved scoring model requires reviewer'; end if;
  if old.approved_by is not null and (old.approved_by is distinct from new.approved_by or old.approved_at is distinct from new.approved_at) then raise exception 'scoring model approval is immutable'; end if;
  return new;
end;
$$;

create trigger scoring_models_controlled_transition before update on public.scoring_models for each row execute function public.validate_scoring_model_transition();
create trigger scoring_models_immutable_delete before delete on public.scoring_models for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_factors_immutable before update or delete on public.scoring_factor_definitions for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_thresholds_immutable before update or delete on public.scoring_thresholds for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_scorecards_immutable before update or delete on public.scoring_scorecards for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_factor_results_immutable before update or delete on public.scoring_factor_results for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_confidence_immutable before update or delete on public.scoring_confidence_results for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_caps_immutable before update or delete on public.scoring_confidence_caps for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_changes_immutable before update or delete on public.scoring_change_explanations for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_deltas_immutable before update or delete on public.scoring_factor_deltas for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_calibration_immutable before update or delete on public.scoring_calibration_runs for each row execute function public.prevent_immutable_investment_record_update();
create trigger scoring_calibration_buckets_immutable before update or delete on public.scoring_calibration_buckets for each row execute function public.prevent_immutable_investment_record_update();

commit;
