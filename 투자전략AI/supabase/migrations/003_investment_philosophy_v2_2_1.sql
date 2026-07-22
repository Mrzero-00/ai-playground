begin;

create table public.philosophy_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED')),
  policy jsonb not null,
  effective_from timestamptz not null,
  proposed_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  architecture_revision_id text,
  created_at timestamptz not null default now(),
  unique (user_id, version),
  check (status not in ('APPROVED', 'ACTIVE') or approved_by is not null)
);

create unique index one_active_philosophy_per_user
  on public.philosophy_versions(user_id) where status = 'ACTIVE';

create table public.philosophy_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_version text not null,
  to_version text not null,
  section text not null,
  previous_policy text not null,
  new_policy text not null,
  rationale text not null,
  evidence_ids uuid[] not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED')),
  proposed_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  architecture_revision_id text,
  effective_from timestamptz not null,
  created_at timestamptz not null default now(),
  check (from_version <> to_version),
  check (cardinality(evidence_ids) > 0),
  check (status not in ('APPROVED', 'ACTIVE') or approved_by is not null),
  check ((section <> 'HARD_SAFETY' and section !~ '^INV-') or status not in ('APPROVED', 'ACTIVE') or architecture_revision_id is not null)
);

create table public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  snapshot_id uuid references public.data_snapshots(id),
  source_id uuid not null references public.data_sources(id),
  evidence_type text not null check (evidence_type in ('FACT', 'CONSENSUS_ESTIMATE', 'MANAGEMENT_GUIDANCE', 'MODEL_ESTIMATE', 'INFERENCE', 'HYPOTHESIS')),
  source_tier text not null check (source_tier in ('A', 'B', 'C', 'D', 'E', 'F')),
  statement text not null,
  as_of timestamptz not null,
  collected_at timestamptz not null,
  score_eligible boolean not null default false,
  source_url text,
  created_at timestamptz not null default now(),
  check (as_of <= collected_at),
  check (not score_eligible or source_tier in ('A', 'B', 'C')),
  check (source_tier <> 'D' or evidence_type in ('INFERENCE', 'HYPOTHESIS')),
  check (source_tier not in ('E', 'F') or evidence_type <> 'FACT')
);

create table public.long_term_theses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  version text not null,
  strategy public.lot_strategy not null check (strategy in ('CORE', 'FUTURE_CORE')),
  status text not null check (status in ('STRENGTHENED', 'UNCHANGED', 'WEAKENED', 'BROKEN', 'REPLACED')),
  summary text not null,
  return_sources text[] not null,
  key_assumptions jsonb not null,
  milestones jsonb not null default '[]'::jsonb,
  catalysts text[] not null default '{}',
  risks text[] not null,
  break_conditions jsonb not null,
  valuation_low numeric(20, 6) not null,
  valuation_base numeric(20, 6) not null,
  valuation_high numeric(20, 6) not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  valuation_as_of timestamptz not null,
  expected_horizon text not null,
  review_schedule timestamptz[] not null,
  evidence_ids uuid[] not null,
  counter_evidence_ids uuid[] not null,
  snapshot_ids uuid[] not null,
  model_version_id uuid not null references public.model_versions(id),
  data_as_of timestamptz not null,
  supersedes_thesis_id uuid references public.long_term_theses(id),
  revision_reason text,
  created_at timestamptz not null,
  unique (user_id, company_id, version),
  check (valuation_low <= valuation_base and valuation_base <= valuation_high),
  check (cardinality(return_sources) > 0 and cardinality(risks) > 0),
  check (jsonb_typeof(key_assumptions) = 'array' and jsonb_array_length(key_assumptions) between 1 and 7),
  check (jsonb_typeof(break_conditions) = 'array' and jsonb_array_length(break_conditions) > 0),
  check (cardinality(review_schedule) > 0),
  check (valuation_as_of <= created_at and data_as_of <= created_at),
  check (cardinality(evidence_ids) > 0 and cardinality(counter_evidence_ids) > 0 and cardinality(snapshot_ids) > 0),
  check ((supersedes_thesis_id is null and revision_reason is null) or (supersedes_thesis_id is not null and length(trim(revision_reason)) > 0))
);

create table public.momentum_trade_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  setup_id text not null,
  setup_type text not null check (setup_type in ('BREAKOUT', 'PULLBACK', 'GAP_CONTINUATION', 'EARNINGS_MOMENTUM', 'SECTOR_ROTATION', 'SPECIAL_SITUATION')),
  market_regime text not null check (market_regime in ('RISK_ON_TREND', 'RISK_ON_VOLATILE', 'NEUTRAL_RANGE', 'RISK_OFF', 'CRISIS')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  entry_zone_min numeric(20, 6) not null,
  entry_zone_max numeric(20, 6) not null,
  chase_limit numeric(20, 6) not null,
  initial_stop numeric(20, 6) not null,
  target_1 numeric(20, 6),
  target_2 numeric(20, 6),
  trailing_stop_rule text,
  time_stop_days integer not null check (time_stop_days > 0),
  trigger text not null,
  catalyst_summary text not null,
  invalidation_conditions text[] not null,
  event_risk boolean not null default false,
  evidence_ids uuid[] not null,
  counter_evidence_ids uuid[] not null,
  snapshot_ids uuid[] not null,
  model_version_id uuid not null references public.model_versions(id),
  data_as_of timestamptz not null,
  generated_at timestamptz not null,
  expires_at timestamptz not null,
  check (initial_stop < entry_zone_min and entry_zone_min <= entry_zone_max and entry_zone_max <= chase_limit),
  check (target_1 is null or target_1 > entry_zone_min),
  check (target_2 is null or target_2 > entry_zone_min),
  check (target_1 is null or target_2 is null or target_1 <= target_2),
  check (target_1 is not null or length(trim(trailing_stop_rule)) > 0),
  check (data_as_of <= generated_at and generated_at < expires_at),
  check (cardinality(invalidation_conditions) > 0),
  check (cardinality(evidence_ids) > 0 and cardinality(counter_evidence_ids) > 0 and cardinality(snapshot_ids) > 0)
);

create table public.decision_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decision_key text not null,
  company_id uuid references public.companies(id) on delete cascade,
  strategy text not null check (strategy in ('CORE', 'FUTURE_CORE', 'MOMENTUM', 'CASH')),
  action text not null check (action in ('BUY', 'ACCUMULATE', 'ENTER', 'HOLD', 'WAIT', 'REDUCE', 'EXIT', 'SKIP', 'CASH')),
  expected_horizon text not null,
  expected_return_sources text[] not null default '{}',
  thesis_id uuid references public.long_term_theses(id),
  momentum_setup_id text,
  position_amount numeric(20, 6),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  portfolio_weight numeric(12, 9) check (portfolio_weight is null or portfolio_weight > 0 and portfolio_weight <= 1),
  assumptions text[] not null default '{}',
  risk_summary text not null,
  execution_conditions text[] not null default '{}',
  exit_conditions text[] not null default '{}',
  emotional_state text not null check (emotional_state in ('CALM', 'EXCITED', 'FEARFUL', 'FRUSTRATED', 'REVENGE_RISK', 'FOMO_RISK', 'FATIGUED')),
  evidence_ids uuid[] not null default '{}',
  counter_evidence_ids uuid[] not null default '{}',
  snapshot_ids uuid[] not null default '{}',
  model_version_ids uuid[] not null default '{}',
  data_as_of timestamptz not null,
  recorded_at timestamptz not null,
  review_at timestamptz not null,
  record_type text not null check (record_type in ('ORIGINAL', 'AMENDMENT')),
  original_entry_id uuid references public.decision_journal_entries(id),
  supersedes_entry_id uuid references public.decision_journal_entries(id),
  amendment_reason text,
  check (data_as_of <= recorded_at and recorded_at <= review_at),
  check ((record_type = 'ORIGINAL' and original_entry_id is null and supersedes_entry_id is null and amendment_reason is null)
    or (record_type = 'AMENDMENT' and original_entry_id is not null and supersedes_entry_id is not null and length(trim(amendment_reason)) > 0)),
  check (strategy <> 'MOMENTUM' or action <> 'ENTER' or momentum_setup_id is not null),
  check (strategy not in ('CORE', 'FUTURE_CORE') or action not in ('BUY', 'ACCUMULATE') or thesis_id is not null)
);

create table public.decision_modification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_decision_id uuid not null references public.decisions(id),
  requested_at timestamptz not null,
  requested_by uuid not null references auth.users(id),
  reason text not null,
  requested_strategy text check (requested_strategy is null or requested_strategy in ('CORE', 'FUTURE_CORE', 'MOMENTUM', 'CASH')),
  requested_amount numeric(20, 6),
  requested_currency text check (requested_currency is null or requested_currency ~ '^[A-Z]{3}$'),
  requested_stop numeric(20, 6),
  status text not null default 'REQUIRES_NEW_PROPOSAL' check (status = 'REQUIRES_NEW_PROPOSAL'),
  requires_independent_evaluation boolean not null,
  requires_portfolio_revalidation boolean not null default true check (requires_portfolio_revalidation),
  requires_risk_revalidation boolean not null default true check (requires_risk_revalidation),
  check (length(trim(reason)) > 0),
  check (requested_strategy is not null or requested_amount is not null or requested_stop is not null),
  check ((requested_amount is null and requested_currency is null) or (requested_amount > 0 and requested_currency is not null))
);

create table public.decision_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decision_key text not null,
  strategy text not null check (strategy in ('LONG_TERM', 'FUTURE_CORE', 'MOMENTUM', 'PORTFOLIO', 'RISK')),
  realized_pnl numeric(20, 6) not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  r_multiple numeric(12, 6),
  holding_days integer not null check (holding_days >= 0),
  data_quality_score numeric(5, 2) not null check (data_quality_score between 0 and 100),
  rule_compliant boolean not null,
  position_size_compliant boolean not null,
  execution_compliant boolean not null,
  emotional_state text not null check (emotional_state in ('CALM', 'EXCITED', 'FEARFUL', 'FRUSTRATED', 'REVENGE_RISK', 'FOMO_RISK', 'FATIGUED')),
  psychology_notes text not null default '',
  evidence_ids uuid[] not null,
  classification text not null check (classification in ('GOOD_PROCESS_GOOD_OUTCOME', 'GOOD_PROCESS_BAD_OUTCOME', 'BAD_PROCESS_GOOD_OUTCOME', 'BAD_PROCESS_BAD_OUTCOME')),
  reviewed_at timestamptz not null,
  check (cardinality(evidence_ids) > 0)
);

create table public.investment_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  lesson_type text not null check (lesson_type in ('DATA', 'MODEL', 'EXECUTION', 'RISK', 'PSYCHOLOGY', 'PORTFOLIO', 'NO_CHANGE')),
  strategy text not null check (strategy in ('LONG_TERM', 'FUTURE_CORE', 'MOMENTUM', 'PORTFOLIO', 'RISK')),
  original_assumption text not null,
  observed_outcome text not null,
  process_assessment text not null,
  model_assessment text not null,
  proposed_change text,
  confidence numeric(5, 2) not null check (confidence between 0 and 100),
  sample_size integer not null check (sample_size > 0),
  evidence_ids uuid[] not null,
  decision_review_ids uuid[] not null,
  created_at timestamptz not null,
  check (cardinality(evidence_ids) > 0 and cardinality(decision_review_ids) > 0),
  check (lesson_type <> 'NO_CHANGE' or proposed_change is null)
);

create table public.performance_attributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lot_id uuid not null references public.position_lots(id),
  company_id uuid not null references public.companies(id),
  decision_id uuid not null references public.decisions(id),
  strategy public.lot_strategy not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  realized_pnl numeric(20, 6) not null,
  fees numeric(20, 6) not null check (fees >= 0),
  fx_pnl numeric(20, 6) not null,
  model_version_ids uuid[] not null,
  measured_at timestamptz not null,
  check (cardinality(model_version_ids) > 0)
);

alter table public.evaluations
  add column data_as_of timestamptz,
  add column market_price_as_of timestamptz,
  add column evidence_ids uuid[] not null default '{}',
  add column scoring_evidence_ids uuid[] not null default '{}',
  add column counter_evidence_ids uuid[] not null default '{}',
  add column confidence jsonb;

update public.evaluations
set data_as_of = evaluated_at,
    market_price_as_of = evaluated_at,
    confidence = jsonb_build_object('score', score, 'evidenceCoverage', 0, 'sourceQuality', 0, 'modelFit', 0, 'disagreement', 0)
where data_as_of is null or market_price_as_of is null or confidence is null;

alter table public.evaluations
  alter column data_as_of set not null,
  alter column market_price_as_of set not null,
  alter column confidence set not null,
  add constraint evaluation_point_in_time check (data_as_of <= evaluated_at and market_price_as_of <= evaluated_at);

alter table public.allocation_proposals
  add column action text,
  add column lot_strategy public.lot_strategy;

update public.allocation_proposals
set action = case when strategy = 'MOMENTUM' then 'ENTER' else 'BUY' end,
    lot_strategy = case when strategy = 'MOMENTUM' then 'MOMENTUM'::public.lot_strategy else null end
where action is null;

alter table public.allocation_proposals
  alter column action set not null,
  add constraint allocation_action_strategy check ((strategy = 'MOMENTUM' and action = 'ENTER') or (strategy = 'LONG_TERM' and action in ('BUY', 'ACCUMULATE'))),
  add constraint allocation_lot_strategy check ((strategy = 'MOMENTUM' and lot_strategy = 'MOMENTUM') or (strategy = 'LONG_TERM' and lot_strategy in ('CORE', 'FUTURE_CORE')) or lot_strategy is null);

alter table public.decisions
  add column action text;

update public.decisions d
set action = a.action
from public.allocation_proposals a
where a.id = d.allocation_proposal_id and d.action is null;

alter table public.decisions
  alter column action set not null,
  add constraint decision_action check (action in ('BUY', 'ACCUMULATE', 'ENTER', 'HOLD', 'WAIT', 'REDUCE', 'EXIT', 'SKIP', 'CASH'));

alter table public.risk_decisions
  add column supersedes_risk_decision_id uuid references public.risk_decisions(id),
  add column reviewed_by uuid references auth.users(id),
  add column manual_review_evidence_ids uuid[];

create or replace function public.prevent_immutable_investment_record_update()
returns trigger language plpgsql as $$
begin
  raise exception '% records are immutable; insert a revision instead', tg_table_name;
end;
$$;

create trigger evidence_records_immutable before update on public.evidence_records
for each row execute function public.prevent_immutable_investment_record_update();
create trigger long_term_theses_immutable before update on public.long_term_theses
for each row execute function public.prevent_immutable_investment_record_update();
create trigger decision_journal_immutable before update on public.decision_journal_entries
for each row execute function public.prevent_immutable_investment_record_update();
create trigger decision_reviews_immutable before update on public.decision_reviews
for each row execute function public.prevent_immutable_investment_record_update();
create trigger performance_attributions_immutable before update on public.performance_attributions
for each row execute function public.prevent_immutable_investment_record_update();

create index evidence_company_asof on public.evidence_records(company_id, as_of desc);
create index philosophy_changes_version on public.philosophy_changes(user_id, to_version, created_at desc);
create index thesis_company_created on public.long_term_theses(company_id, created_at desc);
create index momentum_plan_company_generated on public.momentum_trade_plans(company_id, generated_at desc);
create index journal_decision_recorded on public.decision_journal_entries(decision_key, recorded_at);
create index reviews_decision_reviewed on public.decision_reviews(decision_key, reviewed_at desc);
create index lessons_strategy_created on public.investment_lessons(strategy, created_at desc);
create index attribution_lot_measured on public.performance_attributions(lot_id, measured_at desc);

alter table public.philosophy_versions enable row level security;
alter table public.philosophy_changes enable row level security;
alter table public.evidence_records enable row level security;
alter table public.long_term_theses enable row level security;
alter table public.momentum_trade_plans enable row level security;
alter table public.decision_journal_entries enable row level security;
alter table public.decision_modification_requests enable row level security;
alter table public.decision_reviews enable row level security;
alter table public.investment_lessons enable row level security;
alter table public.performance_attributions enable row level security;

create policy philosophy_owner_all on public.philosophy_versions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy philosophy_changes_owner_all on public.philosophy_changes for all using (user_id = auth.uid()) with check (user_id = auth.uid() and proposed_by = auth.uid());
create policy evidence_owner_all on public.evidence_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy theses_owner_all on public.long_term_theses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy momentum_plans_owner_all on public.momentum_trade_plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy journal_owner_all on public.decision_journal_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy modification_owner_all on public.decision_modification_requests for all using (user_id = auth.uid() and requested_by = auth.uid()) with check (user_id = auth.uid() and requested_by = auth.uid());
create policy reviews_owner_all on public.decision_reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy lessons_owner_all on public.investment_lessons for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy attribution_owner_all on public.performance_attributions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
