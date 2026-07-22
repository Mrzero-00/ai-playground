begin;

-- public.reports is retained as the legacy Markdown projection table.
-- Canonical v1 reports use the normalized tables below.

create table public.report_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null check (report_type in (
    'DAILY_MOMENTUM_BRIEF', 'WEEKLY_INVESTMENT_OS', 'MONTHLY_CAPITAL_ALLOCATION',
    'QUARTERLY_LONG_TERM_REVIEW', 'EARNINGS_REVIEW', 'TRADE_REVIEW',
    'MODEL_EVOLUTION', 'ANNUAL_INVESTMENT_REVIEW', 'DECISION_REPORT'
  )),
  version text not null,
  status text not null check (status in ('DRAFT', 'APPROVED', 'ACTIVE', 'DEPRECATED')),
  locale text not null,
  required_source_types text[] not null,
  required_sections text[] not null,
  minimum_coverage_basis_points integer not null check (minimum_coverage_basis_points between 0 and 10000),
  allowed_formats text[] not null,
  max_statement_count integer not null check (max_statement_count between 1 and 1000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, report_type, locale, version),
  check (cardinality(required_source_types) > 0),
  check (cardinality(required_sections) > 0),
  check (cardinality(allowed_formats) > 0),
  check (status <> 'DRAFT' or (approved_by is null and approved_at is null)),
  check (status not in ('APPROVED', 'ACTIVE', 'DEPRECATED') or (approved_by is not null and approved_at is not null))
);

create unique index report_templates_one_active_type_locale
  on public.report_templates(user_id, report_type, locale) where status = 'ACTIVE';

create table public.report_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null check (report_type in (
    'DAILY_MOMENTUM_BRIEF', 'WEEKLY_INVESTMENT_OS', 'MONTHLY_CAPITAL_ALLOCATION',
    'QUARTERLY_LONG_TERM_REVIEW', 'EARNINGS_REVIEW', 'TRADE_REVIEW',
    'MODEL_EVOLUTION', 'ANNUAL_INVESTMENT_REVIEW', 'DECISION_REPORT'
  )),
  audience text not null check (audience in ('USER', 'APPROVER', 'REVIEWER', 'OPERATOR')),
  locale text not null,
  timezone text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  data_as_of timestamptz not null,
  requested_at timestamptz not null,
  requested_by text not null,
  template_version text not null,
  renderer_version text not null,
  requested_formats text[] not null,
  idempotency_key text not null,
  correlation_id text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  unique (user_id, idempotency_key),
  check (period_start <= period_end and period_end <= data_as_of and data_as_of <= requested_at),
  check (cardinality(requested_formats) > 0),
  check (length(trim(idempotency_key)) > 0 and length(trim(correlation_id)) > 0)
);

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('REQUESTED', 'VALIDATING', 'GENERATING', 'SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'BLOCKED', 'FAILED', 'CANCELLED')),
  attempt integer not null default 1 check (attempt > 0),
  source_manifest_hash text check (source_manifest_hash ~ '^[0-9a-f]{64}$'),
  failed_formats text[] not null default '{}',
  failure_codes text[] not null default '{}',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (request_id, attempt),
  foreign key (request_id, user_id) references public.report_requests(id, user_id),
  check (finished_at is null or (started_at is not null and started_at <= finished_at)),
  check (status not in ('SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'BLOCKED', 'FAILED', 'CANCELLED') or finished_at is not null)
);

create table public.canonical_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  run_id uuid not null,
  template_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null,
  status text not null check (status in ('READY', 'BLOCKED')),
  publication_status text not null default 'PUBLISHED' check (publication_status in ('PUBLISHED', 'SUPERSEDED', 'WITHDRAWN')),
  revision_chain_id uuid not null,
  revision integer not null check (revision > 0),
  supersedes_report_id uuid,
  title text not null check (length(trim(title)) > 0),
  audience text not null check (audience in ('USER', 'APPROVER', 'REVIEWER', 'OPERATOR')),
  locale text not null,
  timezone text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  data_as_of timestamptz not null,
  generated_at timestamptz not null,
  template_version text not null,
  template_content_hash text not null check (template_content_hash ~ '^[0-9a-f]{64}$'),
  renderer_version text not null,
  primary_recommendation jsonb not null,
  completeness text not null check (completeness in ('COMPLETE', 'PARTIAL', 'INSUFFICIENT')),
  freshness text not null check (freshness in ('FRESH', 'STALE', 'MIXED')),
  lineage_status text not null check (lineage_status in ('VALID', 'INVALID')),
  source_coverage_basis_points integer not null check (source_coverage_basis_points between 0 and 10000),
  counter_evidence_present boolean not null,
  point_in_time_valid boolean not null,
  warning_codes text[] not null default '{}',
  blocker_codes text[] not null default '{}',
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, revision_chain_id, revision),
  foreign key (request_id, user_id) references public.report_requests(id, user_id),
  foreign key (run_id, user_id) references public.report_runs(id, user_id),
  foreign key (template_id, user_id) references public.report_templates(id, user_id),
  foreign key (supersedes_report_id, user_id) references public.canonical_reports(id, user_id),
  check (period_start <= period_end and period_end <= data_as_of and data_as_of <= generated_at),
  check ((revision = 1 and supersedes_report_id is null) or (revision > 1 and supersedes_report_id is not null)),
  check (supersedes_report_id is null or supersedes_report_id <> id),
  check ((status = 'READY' and cardinality(blocker_codes) = 0) or (status = 'BLOCKED' and cardinality(blocker_codes) > 0)),
  check (status <> 'READY' or (lineage_status = 'VALID' and point_in_time_valid)),
  check (status <> 'BLOCKED' or coalesce((primary_recommendation ->> 'executable')::boolean, false) = false)
);

create unique index canonical_reports_one_successor
  on public.canonical_reports(supersedes_report_id) where supersedes_report_id is not null;

create table public.report_source_manifest (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  source_revision integer not null check (source_revision > 0),
  available_at timestamptz not null,
  as_of timestamptz not null,
  source_result_hash text not null check (source_result_hash ~ '^[0-9a-f]{64}$'),
  model_version_ids text[] not null default '{}',
  policy_version_ids text[] not null default '{}',
  snapshot_ids text[] not null default '{}',
  evidence_ids text[] not null default '{}',
  required boolean not null,
  unique (id, user_id),
  unique (report_id, source_id),
  foreign key (report_id, user_id) references public.canonical_reports(id, user_id) on delete cascade,
  check (length(trim(source_id)) > 0)
);

create table public.report_sections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  section_kind text not null check (section_kind in ('CONCLUSION', 'CHANGES', 'FACTS', 'ESTIMATES', 'INTERPRETATIONS', 'COUNTER_EVIDENCE', 'RISKS', 'ACTIONS', 'NEXT_REVIEW', 'SOURCES')),
  heading text not null check (length(trim(heading)) > 0),
  display_order integer not null check (display_order > 0),
  unique (id, user_id),
  unique (report_id, section_kind),
  unique (report_id, display_order),
  foreign key (report_id, user_id) references public.canonical_reports(id, user_id) on delete cascade
);

create table public.report_statements (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null,
  report_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  statement_key text not null,
  statement_kind text not null check (statement_kind in ('FACT', 'ESTIMATE', 'INTERPRETATION', 'RECOMMENDATION')),
  statement_text text not null check (length(trim(statement_text)) > 0),
  materiality text not null check (materiality in ('PRIMARY', 'SECONDARY', 'CONTEXT')),
  confidence text check (confidence in ('HIGH', 'MEDIUM', 'LOW')),
  source_ids text[] not null default '{}',
  evidence_ids text[] not null default '{}',
  warning_codes text[] not null default '{}',
  display_order integer not null check (display_order > 0),
  unique (id, user_id),
  unique (report_id, statement_key),
  unique (section_id, display_order),
  foreign key (section_id, user_id) references public.report_sections(id, user_id) on delete cascade,
  foreign key (report_id, user_id) references public.canonical_reports(id, user_id) on delete cascade,
  check (statement_kind <> 'FACT' or cardinality(source_ids) > 0)
);

create table public.report_artifacts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_revision integer not null check (report_revision > 0),
  format text not null check (format in ('JSON', 'MARKDOWN', 'WEB', 'PDF', 'NOTIFICATION')),
  renderer_version text not null,
  locale text not null,
  content_text text,
  object_uri text,
  content_type text not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  redaction_policy_version text,
  generated_at timestamptz not null,
  unique (id, user_id),
  unique nulls not distinct (report_id, format, renderer_version, redaction_policy_version),
  foreign key (report_id, user_id) references public.canonical_reports(id, user_id) on delete cascade,
  check ((content_text is not null) <> (object_uri is not null))
);

create table public.report_replays (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  replayed_at timestamptz not null,
  source_result_hash text not null check (source_result_hash ~ '^[0-9a-f]{64}$'),
  replay_result_hash text not null check (replay_result_hash ~ '^[0-9a-f]{64}$'),
  matches boolean not null,
  artifact_hashes jsonb not null default '{}'::jsonb,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (report_id, user_id) references public.canonical_reports(id, user_id),
  check (matches = (source_result_hash = replay_result_hash))
);

create table public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  artifact_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('IN_APP', 'EMAIL', 'PUSH', 'SLACK')),
  destination_hash text not null,
  status text not null check (status in ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRY_SCHEDULED', 'CANCELLED')),
  attempts integer not null default 0 check (attempts >= 0),
  requested_at timestamptz not null,
  sent_at timestamptz,
  delivered_at timestamptz,
  next_retry_at timestamptz,
  last_error_code text,
  unique (id, user_id),
  foreign key (report_id, user_id) references public.canonical_reports(id, user_id),
  foreign key (artifact_id, user_id) references public.report_artifacts(id, user_id),
  check (delivered_at is null or sent_at is not null)
);

create or replace function public.validate_report_source_point_in_time()
returns trigger language plpgsql as $$
declare target_data_as_of timestamptz;
begin
  select data_as_of into target_data_as_of from public.canonical_reports
    where id = new.report_id and user_id = new.user_id;
  if target_data_as_of is null then raise exception 'report source parent not found'; end if;
  if new.available_at > target_data_as_of or new.as_of > target_data_as_of then
    raise exception 'report source violates point-in-time boundary';
  end if;
  return new;
end;
$$;

create trigger report_source_point_in_time before insert on public.report_source_manifest
for each row execute function public.validate_report_source_point_in_time();

create or replace function public.validate_report_revision_chain()
returns trigger language plpgsql as $$
declare previous_record public.canonical_reports%rowtype;
begin
  if new.supersedes_report_id is null then
    if new.revision <> 1 or new.revision_chain_id <> new.id then raise exception 'invalid initial report revision'; end if;
    return new;
  end if;
  select * into previous_record from public.canonical_reports where id = new.supersedes_report_id;
  if not found then raise exception 'previous report revision not found'; end if;
  if previous_record.user_id <> new.user_id or previous_record.report_type <> new.report_type
     or previous_record.revision_chain_id <> new.revision_chain_id or new.revision <> previous_record.revision + 1 then
    raise exception 'report revision lineage conflict';
  end if;
  return new;
end;
$$;

create trigger canonical_report_revision_chain before insert on public.canonical_reports
for each row execute function public.validate_report_revision_chain();

create or replace function public.validate_report_run_transition()
returns trigger language plpgsql as $$
begin
  if old.id <> new.id or old.request_id <> new.request_id or old.user_id <> new.user_id or old.attempt <> new.attempt or old.created_at <> new.created_at then
    raise exception 'report run immutable identity cannot change';
  end if;
  if old.status = 'REQUESTED' and new.status not in ('VALIDATING', 'CANCELLED') then raise exception 'invalid report run transition'; end if;
  if old.status = 'VALIDATING' and new.status not in ('GENERATING', 'BLOCKED', 'FAILED', 'CANCELLED') then raise exception 'invalid report run transition'; end if;
  if old.status = 'GENERATING' and new.status not in ('SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED', 'CANCELLED') then raise exception 'invalid report run transition'; end if;
  if old.status in ('SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'BLOCKED', 'FAILED', 'CANCELLED') then raise exception 'terminal report run is immutable'; end if;
  return new;
end;
$$;

create trigger report_runs_controlled_transition before update on public.report_runs
for each row execute function public.validate_report_run_transition();

create or replace function public.validate_report_template_transition()
returns trigger language plpgsql as $$
begin
  if old.id <> new.id or old.user_id <> new.user_id or old.report_type <> new.report_type
     or old.version <> new.version or old.locale <> new.locale
     or old.required_source_types <> new.required_source_types or old.required_sections <> new.required_sections
     or old.minimum_coverage_basis_points <> new.minimum_coverage_basis_points
     or old.allowed_formats <> new.allowed_formats or old.max_statement_count <> new.max_statement_count
     or old.content_hash <> new.content_hash or old.created_at <> new.created_at then
    raise exception 'report template immutable configuration cannot change';
  end if;
  if old.status = 'DRAFT' and new.status <> 'APPROVED' then raise exception 'invalid report template transition'; end if;
  if old.status = 'APPROVED' and new.status <> 'ACTIVE' then raise exception 'invalid report template transition'; end if;
  if old.status = 'ACTIVE' and new.status <> 'DEPRECATED' then raise exception 'invalid report template transition'; end if;
  if old.status = 'DEPRECATED' then raise exception 'deprecated report template is immutable'; end if;
  if new.status = 'APPROVED' and (new.approved_by is null or new.approved_at is null) then raise exception 'approved report template requires reviewer'; end if;
  if old.approved_by is not null and (old.approved_by is distinct from new.approved_by or old.approved_at is distinct from new.approved_at) then
    raise exception 'report template approval is immutable';
  end if;
  return new;
end;
$$;

create trigger report_templates_controlled_transition before update on public.report_templates
for each row execute function public.validate_report_template_transition();

create index report_requests_type_period on public.report_requests(user_id, report_type, period_end desc);
create index report_runs_request_status on public.report_runs(user_id, request_id, status, created_at desc);
create index canonical_reports_type_period on public.canonical_reports(user_id, report_type, period_end desc, revision desc);
create index canonical_reports_status on public.canonical_reports(user_id, status, generated_at desc);
create index report_source_lookup on public.report_source_manifest(user_id, source_type, source_id);
create index report_artifacts_report_format on public.report_artifacts(user_id, report_id, format);
create index report_deliveries_retry on public.report_deliveries(status, next_retry_at) where status in ('FAILED', 'RETRY_SCHEDULED');

alter table public.report_templates enable row level security;
alter table public.report_requests enable row level security;
alter table public.report_runs enable row level security;
alter table public.canonical_reports enable row level security;
alter table public.report_source_manifest enable row level security;
alter table public.report_sections enable row level security;
alter table public.report_statements enable row level security;
alter table public.report_artifacts enable row level security;
alter table public.report_replays enable row level security;
alter table public.report_deliveries enable row level security;

create policy report_templates_owner_select on public.report_templates for select using (user_id = auth.uid());
create policy report_requests_owner_select on public.report_requests for select using (user_id = auth.uid());
create policy report_runs_owner_select on public.report_runs for select using (user_id = auth.uid());
create policy canonical_reports_owner_select on public.canonical_reports for select using (user_id = auth.uid());
create policy report_source_owner_select on public.report_source_manifest for select using (user_id = auth.uid());
create policy report_sections_owner_select on public.report_sections for select using (user_id = auth.uid());
create policy report_statements_owner_select on public.report_statements for select using (user_id = auth.uid());
create policy report_artifacts_owner_select on public.report_artifacts for select using (user_id = auth.uid());
create policy report_replays_owner_select on public.report_replays for select using (user_id = auth.uid());
create policy report_deliveries_owner_select on public.report_deliveries for select using (user_id = auth.uid());

create trigger report_templates_immutable_delete before delete on public.report_templates for each row execute function public.prevent_immutable_investment_record_update();
create trigger report_requests_immutable before update or delete on public.report_requests for each row execute function public.prevent_immutable_investment_record_update();
create trigger report_runs_immutable_delete before delete on public.report_runs for each row execute function public.prevent_immutable_investment_record_update();
create trigger canonical_reports_immutable before update or delete on public.canonical_reports for each row execute function public.prevent_immutable_investment_record_update();
create trigger report_source_immutable before update or delete on public.report_source_manifest for each row execute function public.prevent_immutable_investment_record_update();
create trigger report_sections_immutable before update or delete on public.report_sections for each row execute function public.prevent_immutable_investment_record_update();
create trigger report_statements_immutable before update or delete on public.report_statements for each row execute function public.prevent_immutable_investment_record_update();
create trigger report_artifacts_immutable before update or delete on public.report_artifacts for each row execute function public.prevent_immutable_investment_record_update();
create trigger report_replays_immutable before update or delete on public.report_replays for each row execute function public.prevent_immutable_investment_record_update();

commit;
