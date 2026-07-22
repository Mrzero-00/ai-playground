begin;

create table public.data_lineage_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_entity_type text not null,
  from_entity_id text not null,
  to_entity_type text not null,
  to_entity_id text not null,
  relation text not null check (relation in ('DERIVED_FROM', 'USED_INPUT', 'SUPERSEDES', 'VALIDATES', 'EXPLAINS', 'CORRECTS')),
  as_of timestamptz not null,
  evidence_ids uuid[] not null default '{}',
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  unique (id, user_id),
  unique (user_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation),
  check (as_of <= created_at),
  check (from_entity_type <> to_entity_type or from_entity_id <> to_entity_id),
  check (relation not in ('EXPLAINS', 'VALIDATES') or cardinality(evidence_ids) > 0)
);

create table public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  entity_type text not null,
  classification text not null check (classification in ('LEGAL_AUDIT', 'REPRODUCIBILITY', 'OPERATIONAL', 'SENSITIVE_RAW', 'CACHE')),
  retention_days integer not null check (retention_days between 1 and 36500),
  archive_after_days integer,
  legal_hold_supported boolean not null,
  hard_delete_allowed boolean not null,
  encrypted boolean not null,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null,
  effective_from timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, entity_type, version),
  check (archive_after_days is null or (archive_after_days > 0 and archive_after_days < retention_days)),
  check (approved_at <= effective_from),
  check (classification not in ('LEGAL_AUDIT', 'REPRODUCIBILITY') or not hard_delete_allowed),
  check (classification <> 'SENSITIVE_RAW' or (encrypted and retention_days <= 365)),
  check (classification <> 'CACHE' or not legal_hold_supported)
);

create table public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  reason text not null,
  status text not null check (status in ('REQUESTED', 'VERIFIED', 'PLANNED', 'EXECUTING', 'COMPLETED', 'REJECTED', 'BLOCKED')),
  blocker_codes text[] not null default '{}',
  requested_at timestamptz not null,
  transitioned_at timestamptz not null,
  supersedes_request_id uuid,
  reviewed_by uuid references auth.users(id),
  completed_counts jsonb,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (supersedes_request_id, user_id) references public.data_deletion_requests(id, user_id),
  check (requested_by = user_id),
  check (supersedes_request_id is null or supersedes_request_id <> id),
  check (transitioned_at >= requested_at),
  check ((status = 'BLOCKED') = (cardinality(blocker_codes) > 0)),
  check (status in ('REQUESTED', 'BLOCKED') or reviewed_by is not null),
  check (status <> 'COMPLETED' or (completed_counts is not null and jsonb_typeof(completed_counts) = 'object'))
);

create table public.data_deletion_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  classification text not null check (classification in ('LEGAL_AUDIT', 'REPRODUCIBILITY', 'OPERATIONAL', 'SENSITIVE_RAW', 'CACHE')),
  legal_hold boolean not null,
  reproducibility_required boolean not null,
  requested_action text not null check (requested_action in ('DELETE', 'ANONYMIZE', 'ARCHIVE')),
  unique (id, user_id),
  unique (request_id, entity_type, entity_id),
  foreign key (request_id, user_id) references public.data_deletion_requests(id, user_id) on delete cascade
);

create table public.data_quality_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  severity text not null check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  category text not null check (category in ('MISSING', 'STALE', 'CONFLICT', 'OUTLIER', 'SCHEMA', 'LINEAGE', 'RECONCILIATION')),
  entity_type text not null,
  entity_id text not null,
  status text not null check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  finding_codes text[] not null,
  evidence_ids uuid[] not null default '{}',
  detected_at timestamptz not null,
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_record_id text,
  unique (id, user_id),
  check (cardinality(finding_codes) > 0),
  check (status <> 'ACKNOWLEDGED' or (acknowledged_by is not null and acknowledged_at is not null)),
  check (status <> 'RESOLVED' or (resolved_by is not null and resolved_at is not null and resolution_record_id is not null))
);

create table public.database_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('PORTFOLIO', 'PERFORMANCE', 'EVENT', 'AGENT', 'CUSTOM')),
  status text not null check (status in ('PASSED', 'FAILED', 'BLOCKED')),
  as_of timestamptz not null,
  executed_at timestamptz not null,
  check_count integer not null check (check_count > 0),
  finding_count integer not null check (finding_count >= 0 and finding_count <= check_count),
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  check (as_of <= executed_at),
  check ((status = 'PASSED') = (finding_count = 0))
);

create table public.database_reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  reconciliation_run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  check_id text not null,
  code text not null,
  severity text not null check (severity in ('WARNING', 'CRITICAL')),
  entity_type text not null,
  entity_id text not null,
  actual numeric not null,
  expected numeric not null,
  evidence_ids uuid[] not null default '{}',
  unique (id, user_id),
  unique (reconciliation_run_id, check_id),
  foreign key (reconciliation_run_id, user_id) references public.database_reconciliation_runs(id, user_id) on delete cascade
);

create table public.migration_verification_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  migration_version text not null,
  environment text not null check (environment in ('LOCAL', 'TEST', 'STAGING', 'PRODUCTION')),
  status text not null check (status in ('PASSED', 'FAILED', 'BLOCKED')),
  schema_hash text not null check (schema_hash ~ '^[0-9a-f]{64}$'),
  constraint_count integer not null check (constraint_count >= 0),
  index_count integer not null check (index_count >= 0),
  rls_table_count integer not null check (rls_table_count >= 0),
  finding_codes text[] not null default '{}',
  verified_by text not null,
  verified_at timestamptz not null,
  unique (id, user_id),
  check ((status = 'PASSED') = (cardinality(finding_codes) = 0))
);

create index lineage_from on public.data_lineage_edges(user_id, from_entity_type, from_entity_id, created_at desc);
create index lineage_to on public.data_lineage_edges(user_id, to_entity_type, to_entity_id, created_at desc);
create index retention_entity_effective on public.data_retention_policies(user_id, entity_type, effective_from desc);
create index deletion_requests_open on public.data_deletion_requests(user_id, status, transitioned_at desc) where status not in ('COMPLETED', 'REJECTED', 'BLOCKED');
create unique index deletion_requests_linear_revision on public.data_deletion_requests(supersedes_request_id) where supersedes_request_id is not null;
create index quality_incidents_open on public.data_quality_incidents(user_id, severity, detected_at desc) where status <> 'RESOLVED';
create index reconciliation_scope_time on public.database_reconciliation_runs(user_id, scope, executed_at desc);
create index migration_verification_time on public.migration_verification_runs(environment, verified_at desc);

alter table public.data_lineage_edges enable row level security;
alter table public.data_retention_policies enable row level security;
alter table public.data_deletion_requests enable row level security;
alter table public.data_deletion_request_items enable row level security;
alter table public.data_quality_incidents enable row level security;
alter table public.database_reconciliation_runs enable row level security;
alter table public.database_reconciliation_findings enable row level security;
alter table public.migration_verification_runs enable row level security;

create policy lineage_owner_select on public.data_lineage_edges for select using (user_id = auth.uid());
create policy retention_owner_select on public.data_retention_policies for select using (user_id = auth.uid());
create policy deletion_requests_owner_select on public.data_deletion_requests for select using (user_id = auth.uid());
create policy deletion_items_owner_select on public.data_deletion_request_items for select using (user_id = auth.uid());
create policy quality_incidents_owner_select on public.data_quality_incidents for select using (user_id = auth.uid());
create policy reconciliation_runs_owner_select on public.database_reconciliation_runs for select using (user_id = auth.uid());
create policy reconciliation_findings_owner_select on public.database_reconciliation_findings for select using (user_id = auth.uid());
create policy migration_verification_owner_select on public.migration_verification_runs for select using (user_id = auth.uid());

create trigger audit_logs_immutable before update or delete on public.audit_logs for each row execute function public.prevent_immutable_investment_record_update();
create trigger domain_events_immutable before update or delete on public.domain_events for each row execute function public.prevent_immutable_investment_record_update();
create trigger lineage_edges_immutable before update or delete on public.data_lineage_edges for each row execute function public.prevent_immutable_investment_record_update();
create trigger retention_policies_immutable before update or delete on public.data_retention_policies for each row execute function public.prevent_immutable_investment_record_update();
create trigger deletion_requests_immutable before update or delete on public.data_deletion_requests for each row execute function public.prevent_immutable_investment_record_update();
create trigger deletion_items_immutable before update or delete on public.data_deletion_request_items for each row execute function public.prevent_immutable_investment_record_update();
create trigger reconciliation_runs_immutable before update or delete on public.database_reconciliation_runs for each row execute function public.prevent_immutable_investment_record_update();
create trigger reconciliation_findings_immutable before update or delete on public.database_reconciliation_findings for each row execute function public.prevent_immutable_investment_record_update();
create trigger migration_verification_immutable before update or delete on public.migration_verification_runs for each row execute function public.prevent_immutable_investment_record_update();

create or replace function public.validate_data_quality_incident_transition()
returns trigger language plpgsql as $$
begin
  if old.status = 'RESOLVED' then raise exception 'resolved data quality incidents are immutable'; end if;
  if old.id <> new.id or old.user_id <> new.user_id or old.entity_type <> new.entity_type
     or old.entity_id <> new.entity_id or old.detected_at <> new.detected_at then
    raise exception 'data quality incident identity is immutable';
  end if;
  if old.status = 'OPEN' and new.status not in ('ACKNOWLEDGED', 'RESOLVED') then raise exception 'invalid data quality incident transition'; end if;
  if old.status = 'ACKNOWLEDGED' and new.status <> 'RESOLVED' then raise exception 'invalid data quality incident transition'; end if;
  return new;
end;
$$;

create trigger data_quality_incidents_controlled_transition before update on public.data_quality_incidents
for each row execute function public.validate_data_quality_incident_transition();
create trigger data_quality_incidents_immutable_delete before delete on public.data_quality_incidents
for each row execute function public.prevent_immutable_investment_record_update();

commit;
