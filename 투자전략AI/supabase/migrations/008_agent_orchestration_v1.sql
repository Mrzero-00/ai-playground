begin;

alter table public.evidence_records
  add constraint evidence_records_id_user_unique unique (id, user_id);

create table public.agent_prompt_templates (
  id text not null,
  version text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_scope text not null check (strategy_scope in ('LONG_TERM', 'MOMENTUM', 'PORTFOLIO', 'RISK', 'LEARNING', 'REPORTING')),
  system_policy text not null,
  task_template text not null,
  output_schema_version text not null,
  required_variables text[] not null default '{}',
  forbidden_content_classes text[] not null default '{}',
  status text not null check (status in ('DRAFT', 'EVALUATING', 'APPROVED', 'ACTIVE', 'DEPRECATED')),
  effective_from timestamptz not null,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  template_hash text not null check (template_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (id, version, user_id),
  check (status not in ('APPROVED', 'ACTIVE') or (approved_by is not null and approved_at is not null))
);

create unique index one_active_agent_prompt_version
  on public.agent_prompt_templates(user_id, id) where status = 'ACTIVE';

create table public.agent_definitions (
  id text not null,
  version text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  strategy_scope text not null check (strategy_scope in ('LONG_TERM', 'MOMENTUM', 'PORTFOLIO', 'RISK', 'LEARNING', 'REPORTING')),
  criticality text not null check (criticality in ('ADVISORY', 'REQUIRED_FOR_ANALYSIS', 'REQUIRED_FOR_RISK')),
  prompt_template_id text not null,
  prompt_version text not null,
  input_schema_version text not null,
  output_schema_version text not null,
  maximum_attempts integer not null check (maximum_attempts between 1 and 3),
  timeout_ms integer not null check (timeout_ms between 1000 and 600000),
  maximum_input_tokens integer not null check (maximum_input_tokens > 0),
  maximum_output_tokens integer not null check (maximum_output_tokens > 0),
  fallback_agent_definition_id text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (id, version, user_id),
  foreign key (prompt_template_id, prompt_version, user_id) references public.agent_prompt_templates(id, version, user_id),
  check (fallback_agent_definition_id is null or fallback_agent_definition_id <> id)
);

create table public.agent_tool_capability_grants (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_definition_id text not null,
  agent_definition_version text not null,
  capability text not null,
  version text not null,
  mode text not null default 'READ_ONLY' check (mode = 'READ_ONLY'),
  allowed_resource_kinds text[] not null,
  allowed_source_ids text[] not null default '{}',
  maximum_calls integer not null check (maximum_calls >= 0),
  timeout_ms integer not null check (timeout_ms > 0),
  maximum_response_bytes integer not null check (maximum_response_bytes > 0),
  valid_from timestamptz not null,
  valid_until timestamptz,
  primary key (id, user_id),
  unique (agent_definition_id, agent_definition_version, capability, version, user_id),
  foreign key (agent_definition_id, agent_definition_version, user_id) references public.agent_definitions(id, version, user_id),
  check (valid_until is null or valid_until > valid_from)
);

create table public.agent_run_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow text not null check (workflow in ('LONG_TERM_REVIEW', 'MOMENTUM_REVIEW', 'LEARNING_REVIEW', 'REPORT_GENERATION')),
  as_of timestamptz not null,
  maximum_concurrency integer not null check (maximum_concurrency between 1 and 16),
  deadline_at timestamptz not null,
  execution_order text[] not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  unique (id, user_id),
  check (as_of <= created_at and created_at < deadline_at)
);

create table public.agent_plan_nodes (
  id text not null,
  plan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_definition_id text not null,
  agent_definition_version text not null,
  depends_on text[] not null default '{}',
  required boolean not null,
  primary key (plan_id, id),
  foreign key (plan_id, user_id) references public.agent_run_plans(id, user_id) on delete cascade,
  foreign key (agent_definition_id, agent_definition_version, user_id) references public.agent_definitions(id, version, user_id),
  check (not (id = any(depends_on)))
);

create table public.agent_run_manifests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_definition_id text not null,
  agent_definition_version text not null,
  provider_id text not null,
  provider_version text not null,
  model_id text not null,
  model_revision text,
  prompt_template_id text not null,
  prompt_version text not null,
  rendered_prompt_hash text not null check (rendered_prompt_hash ~ '^[0-9a-f]{64}$'),
  input_schema_version text not null,
  output_schema_version text not null,
  input_snapshot_ids uuid[] not null default '{}',
  evidence_ids uuid[] not null,
  capability_grant_ids text[] not null default '{}',
  as_of timestamptz not null,
  code_version text not null,
  temperature numeric(5,4) not null check (temperature between 0 and 2),
  seed bigint,
  maximum_input_tokens integer not null check (maximum_input_tokens > 0),
  maximum_output_tokens integer not null check (maximum_output_tokens > 0),
  created_at timestamptz not null,
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (user_id, manifest_hash),
  foreign key (agent_definition_id, agent_definition_version, user_id) references public.agent_definitions(id, version, user_id),
  foreign key (prompt_template_id, prompt_version, user_id) references public.agent_prompt_templates(id, version, user_id),
  check (cardinality(evidence_ids) > 0 and as_of <= created_at)
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  manifest_id uuid not null,
  strategy_scope text not null check (strategy_scope in ('LONG_TERM', 'MOMENTUM', 'PORTFOLIO', 'RISK', 'LEARNING', 'REPORTING')),
  criticality text not null check (criticality in ('ADVISORY', 'REQUIRED_FOR_ANALYSIS', 'REQUIRED_FOR_RISK')),
  purpose text not null,
  correlation_id text not null,
  idempotency_key text not null,
  requested_by_type text not null check (requested_by_type in ('USER', 'SYSTEM', 'SCHEDULER')),
  requested_by_id text not null,
  replay_of_run_id uuid,
  status text not null check (status in ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'BLOCKED', 'FAILED', 'TIMED_OUT', 'CANCELLED')),
  attempt integer not null default 0 check (attempt >= 0),
  failure_codes text[] not null default '{}',
  created_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (user_id, idempotency_key),
  foreign key (manifest_id, user_id) references public.agent_run_manifests(id, user_id),
  foreign key (replay_of_run_id, user_id) references public.agent_runs(id, user_id),
  check (started_at is null or started_at >= created_at),
  check (finished_at is null or finished_at >= coalesce(started_at, created_at)),
  check ((status in ('PENDING', 'RUNNING') and finished_at is null) or (status not in ('PENDING', 'RUNNING') and finished_at is not null))
);

create table public.agent_run_attempts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  provider_request_id text,
  status text not null check (status in ('RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT')),
  retryable boolean not null default false,
  error_code text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cost_micros bigint check (cost_micros is null or cost_micros >= 0),
  started_at timestamptz not null,
  finished_at timestamptz,
  unique (id, user_id),
  unique (run_id, attempt_number),
  foreign key (run_id, user_id) references public.agent_runs(id, user_id) on delete cascade,
  check (finished_at is null or finished_at >= started_at)
);

create table public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  capability_grant_id text not null,
  capability text not null,
  resource_id text not null,
  source_id text not null,
  requested_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('SUCCEEDED', 'FAILED', 'BLOCKED', 'TIMED_OUT')),
  response_bytes integer check (response_bytes is null or response_bytes >= 0),
  content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (attempt_id, user_id) references public.agent_run_attempts(id, user_id) on delete cascade,
  foreign key (capability_grant_id, user_id) references public.agent_tool_capability_grants(id, user_id),
  check (finished_at is null or finished_at >= requested_at)
);

create table public.agent_raw_outputs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_payload bytea not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  byte_length integer not null check (byte_length >= 0),
  retention_until timestamptz not null,
  created_at timestamptz not null,
  unique (id, user_id),
  unique (attempt_id),
  foreign key (attempt_id, user_id) references public.agent_run_attempts(id, user_id) on delete cascade,
  check (retention_until > created_at)
);

create table public.agent_normalized_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version text not null,
  status text not null check (status in ('COMPLETED', 'PARTIAL', 'BLOCKED')),
  summary text not null,
  missing_information jsonb not null default '[]'::jsonb,
  quality_flags text[] not null default '{}',
  proposed_actions jsonb not null default '[]'::jsonb,
  output_hash text not null check (output_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  unique (id, user_id),
  unique (run_id),
  foreign key (run_id, user_id) references public.agent_runs(id, user_id),
  check (jsonb_typeof(missing_information) = 'array' and jsonb_typeof(proposed_actions) = 'array')
);

create table public.agent_claims (
  id text not null,
  output_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('FACT_CANDIDATE', 'ESTIMATE', 'INTERPRETATION', 'HYPOTHESIS', 'COUNTERARGUMENT')),
  subject text not null,
  predicate text not null,
  value jsonb not null,
  unit text,
  period_start timestamptz,
  period_end timestamptz,
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED')),
  uncertainty_reasons text[] not null default '{}',
  deterministic_key text,
  primary key (output_id, id),
  unique (output_id, id, user_id),
  foreign key (output_id, user_id) references public.agent_normalized_outputs(id, user_id) on delete cascade,
  check (period_start is null or period_end is null or period_start <= period_end)
);

create table public.agent_claim_evidence (
  output_id uuid not null,
  claim_id text not null,
  evidence_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  location jsonb not null,
  support text not null check (support in ('SUPPORTS', 'CONTRADICTS', 'CONTEXT_ONLY')),
  primary key (output_id, claim_id, evidence_id, support),
  foreign key (output_id, claim_id, user_id) references public.agent_claims(output_id, id, user_id) on delete cascade,
  foreign key (evidence_id, user_id) references public.evidence_records(id, user_id),
  check (jsonb_typeof(location) = 'object')
);

create table public.agent_validation_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  verdict text not null check (verdict in ('ACCEPTED', 'ACCEPTED_WITH_WARNINGS', 'REJECTED')),
  accepted_claim_ids text[] not null default '{}',
  rejected_claim_ids text[] not null default '{}',
  validated_at timestamptz not null,
  policy_version text not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (run_id),
  foreign key (run_id, user_id) references public.agent_runs(id, user_id)
);

create table public.agent_validation_findings (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  severity text not null check (severity in ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  path text,
  message text not null,
  evidence_ids uuid[] not null default '{}',
  unique (id, user_id),
  foreign key (validation_id, user_id) references public.agent_validation_results(id, user_id) on delete cascade
);

create table public.agent_provider_circuit_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id text not null,
  model_id text not null,
  agent_definition_id text not null,
  state text not null check (state in ('CLOSED', 'OPEN', 'HALF_OPEN')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  opened_at timestamptz,
  retry_after timestamptz,
  updated_at timestamptz not null,
  unique (id, user_id),
  unique (user_id, provider_id, model_id, agent_definition_id)
);

create index agent_runs_status_time on public.agent_runs(user_id, status, created_at desc);
create index agent_runs_definition_time on public.agent_runs(user_id, manifest_id, created_at desc);
create index agent_attempts_run_number on public.agent_run_attempts(user_id, run_id, attempt_number);
create index agent_claims_subject on public.agent_claims(user_id, subject, predicate, kind);
create index agent_findings_severity on public.agent_validation_findings(user_id, severity, code);
create index agent_circuit_state on public.agent_provider_circuit_states(user_id, state, retry_after);

alter table public.agent_prompt_templates enable row level security;
alter table public.agent_definitions enable row level security;
alter table public.agent_tool_capability_grants enable row level security;
alter table public.agent_run_plans enable row level security;
alter table public.agent_plan_nodes enable row level security;
alter table public.agent_run_manifests enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_run_attempts enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.agent_raw_outputs enable row level security;
alter table public.agent_normalized_outputs enable row level security;
alter table public.agent_claims enable row level security;
alter table public.agent_claim_evidence enable row level security;
alter table public.agent_validation_results enable row level security;
alter table public.agent_validation_findings enable row level security;
alter table public.agent_provider_circuit_states enable row level security;

create policy agent_prompts_owner_select on public.agent_prompt_templates for select using (user_id = auth.uid());
create policy agent_definitions_owner_select on public.agent_definitions for select using (user_id = auth.uid());
create policy agent_capabilities_owner_select on public.agent_tool_capability_grants for select using (user_id = auth.uid());
create policy agent_plans_owner_select on public.agent_run_plans for select using (user_id = auth.uid());
create policy agent_plan_nodes_owner_select on public.agent_plan_nodes for select using (user_id = auth.uid());
create policy agent_manifests_owner_select on public.agent_run_manifests for select using (user_id = auth.uid());
create policy agent_runs_owner_select on public.agent_runs for select using (user_id = auth.uid());
create policy agent_attempts_owner_select on public.agent_run_attempts for select using (user_id = auth.uid());
create policy agent_tool_calls_owner_select on public.agent_tool_calls for select using (user_id = auth.uid());
create policy agent_normalized_outputs_owner_select on public.agent_normalized_outputs for select using (user_id = auth.uid());
create policy agent_claims_owner_select on public.agent_claims for select using (user_id = auth.uid());
create policy agent_claim_evidence_owner_select on public.agent_claim_evidence for select using (user_id = auth.uid());
create policy agent_validations_owner_select on public.agent_validation_results for select using (user_id = auth.uid());
create policy agent_findings_owner_select on public.agent_validation_findings for select using (user_id = auth.uid());
create policy agent_circuit_owner_select on public.agent_provider_circuit_states for select using (user_id = auth.uid());

-- Raw Provider output is intentionally not exposed through an authenticated-user RLS policy.

create trigger agent_prompts_immutable before update on public.agent_prompt_templates for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_definitions_immutable before update on public.agent_definitions for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_capabilities_immutable before update on public.agent_tool_capability_grants for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_plans_immutable before update on public.agent_run_plans for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_plan_nodes_immutable before update on public.agent_plan_nodes for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_manifests_immutable before update on public.agent_run_manifests for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_attempts_immutable before update on public.agent_run_attempts for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_tool_calls_immutable before update on public.agent_tool_calls for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_raw_outputs_immutable before update on public.agent_raw_outputs for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_outputs_immutable before update on public.agent_normalized_outputs for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_claims_immutable before update on public.agent_claims for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_claim_evidence_immutable before update on public.agent_claim_evidence for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_validations_immutable before update on public.agent_validation_results for each row execute function public.prevent_immutable_investment_record_update();
create trigger agent_findings_immutable before update on public.agent_validation_findings for each row execute function public.prevent_immutable_investment_record_update();

create or replace function public.validate_agent_run_transition()
returns trigger language plpgsql as $$
begin
  if old.status in ('SUCCEEDED', 'PARTIAL', 'BLOCKED', 'FAILED', 'TIMED_OUT', 'CANCELLED') then
    raise exception 'terminal agent_runs records are immutable';
  end if;
  if old.id <> new.id or old.user_id <> new.user_id or old.request_id <> new.request_id
     or old.manifest_id <> new.manifest_id or old.idempotency_key <> new.idempotency_key
     or old.created_at <> new.created_at then
    raise exception 'agent run lineage is immutable';
  end if;
  if old.status = 'PENDING' and new.status not in ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'BLOCKED', 'FAILED', 'TIMED_OUT', 'CANCELLED') then
    raise exception 'invalid PENDING agent run transition';
  end if;
  if old.status = 'RUNNING' and new.status not in ('SUCCEEDED', 'PARTIAL', 'BLOCKED', 'FAILED', 'TIMED_OUT', 'CANCELLED') then
    raise exception 'invalid RUNNING agent run transition';
  end if;
  return new;
end;
$$;

create trigger agent_runs_controlled_transition before update on public.agent_runs
for each row execute function public.validate_agent_run_transition();

commit;
