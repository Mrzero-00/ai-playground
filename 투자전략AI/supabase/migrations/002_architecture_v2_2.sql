begin;

alter type public.decision_status add value if not exists 'EXPIRED';

alter table public.data_snapshots
  add column complete boolean not null default true,
  add column anomaly_flags text[] not null default '{}';

alter table public.allocation_proposals
  add column portfolio_policy_version_id uuid references public.model_versions(id),
  add column expires_at timestamptz,
  add column currency text not null default 'USD',
  add column input_evaluation_ids uuid[] not null default '{}',
  add column snapshot_ids uuid[] not null default '{}';

update public.allocation_proposals
set expires_at = generated_at + interval '15 minutes'
where expires_at is null;

alter table public.allocation_proposals
  alter column expires_at set not null,
  add constraint allocation_currency_format check (currency ~ '^[A-Z]{3}$'),
  add constraint allocation_expiry_after_generation check (expires_at > generated_at);

alter table public.risk_decisions
  add column risk_policy_version_id uuid references public.model_versions(id),
  add column data_as_of timestamptz;

update public.risk_decisions
set data_as_of = evaluated_at
where data_as_of is null;

alter table public.risk_decisions
  alter column data_as_of set not null;

alter table public.decisions
  add column currency text not null default 'USD',
  add column expires_at timestamptz,
  add column snapshot_ids uuid[] not null default '{}';

update public.decisions d
set expires_at = a.expires_at,
    currency = a.currency,
    snapshot_ids = a.snapshot_ids
from public.allocation_proposals a
where a.id = d.allocation_proposal_id and d.expires_at is null;

alter table public.decisions
  alter column expires_at set not null,
  add constraint decision_currency_format check (currency ~ '^[A-Z]{3}$');

alter table public.position_lots
  add column currency text not null default 'USD',
  add constraint lot_currency_format check (currency ~ '^[A-Z]{3}$');

alter table public.execution_records
  rename column recorded_at to executed_at;

alter table public.execution_records
  add column currency text not null default 'USD',
  add constraint execution_currency_format check (currency ~ '^[A-Z]{3}$');

alter table public.jobs
  rename column attempts to attempt;

alter table public.jobs
  rename column failed_components to legacy_failed_components;

alter table public.jobs
  add column correlation_id text,
  add column idempotency_key text,
  add column failures jsonb not null default '[]'::jsonb;

update public.jobs
set correlation_id = id::text,
    idempotency_key = 'legacy:' || id::text
where correlation_id is null or idempotency_key is null;

alter table public.jobs
  alter column correlation_id set not null,
  alter column idempotency_key set not null;

create unique index jobs_user_idempotency_key on public.jobs(user_id, idempotency_key);

alter table public.domain_events
  add column correlation_id text,
  add column schema_version text not null default '1';

update public.domain_events
set correlation_id = id::text
where correlation_id is null;

alter table public.domain_events
  alter column correlation_id set not null;

create table public.event_outbox (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  aggregate_id text not null,
  correlation_id text not null,
  schema_version text not null,
  model_version_id uuid references public.model_versions(id),
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'PUBLISHED', 'FAILED')),
  attempts integer not null default 0,
  created_at timestamptz not null,
  published_at timestamptz,
  last_error text
);

create index event_outbox_pending on public.event_outbox(status, created_at) where status = 'PENDING';

create table public.processed_events (
  consumer_name text not null,
  event_id uuid not null,
  processed_at timestamptz not null default now(),
  primary key (consumer_name, event_id)
);

create table public.idempotency_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, operation, idempotency_key)
);

alter table public.event_outbox enable row level security;
alter table public.processed_events enable row level security;
alter table public.idempotency_requests enable row level security;

-- Outbox, processed-event and idempotency rows are server/worker internals.
-- No client policy is created; the service role accesses them behind the API.

commit;
