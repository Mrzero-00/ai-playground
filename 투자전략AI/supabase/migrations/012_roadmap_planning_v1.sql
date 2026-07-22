begin;

create table public.roadmap_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision_chain_id uuid not null,
  version integer not null check (version > 0),
  supersedes_plan_id uuid,
  as_of timestamptz not null,
  readiness text not null check (readiness in ('R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6')),
  blocker_codes text[] not null default '{}',
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, revision_chain_id, version),
  foreign key (supersedes_plan_id, user_id) references public.roadmap_plans(id, user_id),
  check ((version = 1 and supersedes_plan_id is null) or (version > 1 and supersedes_plan_id is not null)),
  check (supersedes_plan_id is null or supersedes_plan_id <> id)
);

create unique index roadmap_plans_one_successor on public.roadmap_plans(supersedes_plan_id)
  where supersedes_plan_id is not null;

create table public.roadmap_gates (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  gate_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  environment text not null check (environment in ('CI', 'PREVIEW', 'INTEGRATED', 'SHADOW', 'PILOT', 'PRODUCTION')),
  status text not null check (status in ('PENDING', 'PASSED', 'FAILED', 'BLOCKED')),
  evaluated_at timestamptz not null,
  blocker_codes text[] not null default '{}',
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (plan_id, gate_key),
  foreign key (plan_id, user_id) references public.roadmap_plans(id, user_id) on delete cascade,
  check ((status in ('FAILED', 'BLOCKED') and cardinality(blocker_codes) > 0) or (status in ('PENDING', 'PASSED') and cardinality(blocker_codes) = 0))
);

create table public.roadmap_gate_checks (
  id uuid primary key default gen_random_uuid(),
  gate_id uuid not null,
  check_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('PRODUCT', 'DOMAIN', 'DATA', 'SECURITY', 'QUALITY', 'OPERATIONS', 'MODEL_RISK')),
  required boolean not null,
  waivable boolean not null,
  status text not null check (status in ('PASSED', 'FAILED', 'BLOCKED', 'WAIVED')),
  evidence_refs text[] not null default '{}',
  evaluated_at timestamptz not null,
  evaluator_id text not null check (length(trim(evaluator_id)) > 0),
  expires_at timestamptz,
  blocker_code text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (gate_id, check_key),
  foreign key (gate_id, user_id) references public.roadmap_gates(id, user_id) on delete cascade,
  check (status not in ('PASSED', 'WAIVED') or cardinality(evidence_refs) > 0),
  check (status <> 'WAIVED' or (waivable and expires_at is not null and expires_at > evaluated_at)),
  check (status not in ('FAILED', 'BLOCKED') or length(trim(blocker_code)) > 0)
);

create table public.roadmap_milestones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  milestone_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  title text not null check (length(trim(title)) > 0),
  readiness_target text not null check (readiness_target in ('R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6')),
  status text not null check (status in ('PLANNED', 'IN_PROGRESS', 'AT_RISK', 'BLOCKED', 'READY', 'RELEASED', 'CANCELLED')),
  required_gate_keys text[] not null default '{}',
  owner_ids text[] not null,
  scope_refs text[] not null,
  target_start timestamptz,
  target_end timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (plan_id, milestone_key),
  foreign key (plan_id, user_id) references public.roadmap_plans(id, user_id) on delete cascade,
  check (cardinality(owner_ids) > 0 and cardinality(scope_refs) > 0),
  check ((target_start is null and target_end is null) or (target_start is not null and target_end is not null and target_start <= target_end))
);

create table public.roadmap_milestone_dependencies (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  milestone_id uuid not null,
  dependency_milestone_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (milestone_id, dependency_milestone_id),
  foreign key (plan_id, user_id) references public.roadmap_plans(id, user_id) on delete cascade,
  foreign key (milestone_id, user_id) references public.roadmap_milestones(id, user_id) on delete cascade,
  foreign key (dependency_milestone_id, user_id) references public.roadmap_milestones(id, user_id) on delete cascade,
  check (milestone_id <> dependency_milestone_id)
);

create table public.release_evidence_bundles (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  milestone_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  commit_sha text not null check (commit_sha ~ '^[0-9a-fA-F]{7,64}$'),
  status text not null check (status in ('READY', 'BLOCKED')),
  build_artifact_refs text[] not null default '{}',
  contract_refs text[] not null default '{}',
  test_evidence_refs text[] not null default '{}',
  migration_evidence_refs text[] not null default '{}',
  security_evidence_refs text[] not null default '{}',
  operations_evidence_refs text[] not null default '{}',
  gate_keys text[] not null default '{}',
  open_critical_risk_count integer not null check (open_critical_risk_count >= 0),
  missing_evidence_groups text[] not null default '{}',
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.roadmap_plans(id, user_id),
  foreign key (milestone_id, user_id) references public.roadmap_milestones(id, user_id),
  check ((status = 'READY' and cardinality(missing_evidence_groups) = 0 and open_critical_risk_count = 0
      and cardinality(build_artifact_refs) > 0 and cardinality(contract_refs) > 0
      and cardinality(test_evidence_refs) > 0 and cardinality(migration_evidence_refs) > 0
      and cardinality(security_evidence_refs) > 0 and cardinality(operations_evidence_refs) > 0
      and cardinality(gate_keys) > 0)
    or (status = 'BLOCKED' and cardinality(missing_evidence_groups) > 0))
);

create table public.roadmap_replays (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_result_hash text not null check (source_result_hash ~ '^[0-9a-f]{64}$'),
  replay_result_hash text not null check (replay_result_hash ~ '^[0-9a-f]{64}$'),
  matches boolean not null,
  replayed_at timestamptz not null,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.roadmap_plans(id, user_id),
  check (matches = (source_result_hash = replay_result_hash))
);

create or replace function public.validate_roadmap_plan_revision()
returns trigger language plpgsql as $$
declare previous_record public.roadmap_plans%rowtype;
begin
  if new.supersedes_plan_id is null then
    if new.version <> 1 or new.revision_chain_id <> new.id then raise exception 'invalid initial roadmap revision'; end if;
    return new;
  end if;
  select * into previous_record from public.roadmap_plans where id = new.supersedes_plan_id;
  if not found or previous_record.user_id <> new.user_id
    or previous_record.revision_chain_id <> new.revision_chain_id
    or new.version <> previous_record.version + 1 or new.as_of < previous_record.as_of then
    raise exception 'roadmap revision lineage conflict';
  end if;
  return new;
end;
$$;

create trigger roadmap_plan_revision before insert on public.roadmap_plans
for each row execute function public.validate_roadmap_plan_revision();

create or replace function public.validate_roadmap_gate_boundary()
returns trigger language plpgsql as $$
declare plan_as_of timestamptz;
begin
  select as_of into plan_as_of from public.roadmap_plans where id = new.plan_id and user_id = new.user_id;
  if plan_as_of is null then raise exception 'roadmap gate parent plan not found'; end if;
  if new.evaluated_at > plan_as_of then raise exception 'roadmap gate evaluated after plan as_of'; end if;
  return new;
end;
$$;

create trigger roadmap_gate_boundary before insert on public.roadmap_gates
for each row execute function public.validate_roadmap_gate_boundary();

create or replace function public.validate_roadmap_check_boundary()
returns trigger language plpgsql as $$
declare gate_evaluated_at timestamptz;
begin
  select evaluated_at into gate_evaluated_at from public.roadmap_gates where id = new.gate_id and user_id = new.user_id;
  if gate_evaluated_at is null then raise exception 'roadmap check parent gate not found'; end if;
  if new.evaluated_at > gate_evaluated_at then raise exception 'roadmap check evaluated after parent gate'; end if;
  return new;
end;
$$;

create trigger roadmap_check_boundary before insert on public.roadmap_gate_checks
for each row execute function public.validate_roadmap_check_boundary();

create or replace function public.validate_roadmap_dependency()
returns trigger language plpgsql as $$
declare milestone_plan uuid;
declare dependency_plan uuid;
declare creates_cycle boolean;
begin
  select plan_id into milestone_plan from public.roadmap_milestones where id = new.milestone_id and user_id = new.user_id;
  select plan_id into dependency_plan from public.roadmap_milestones where id = new.dependency_milestone_id and user_id = new.user_id;
  if milestone_plan is null or dependency_plan is null or milestone_plan <> new.plan_id or dependency_plan <> new.plan_id then
    raise exception 'roadmap dependency crosses plan boundary';
  end if;
  with recursive ancestors(id) as (
    select dependency_milestone_id from public.roadmap_milestone_dependencies where milestone_id = new.dependency_milestone_id
    union
    select d.dependency_milestone_id from public.roadmap_milestone_dependencies d join ancestors a on d.milestone_id = a.id
  ) select exists(select 1 from ancestors where id = new.milestone_id) into creates_cycle;
  if creates_cycle then raise exception 'roadmap dependency cycle detected'; end if;
  return new;
end;
$$;

create trigger roadmap_dependency_boundary before insert on public.roadmap_milestone_dependencies
for each row execute function public.validate_roadmap_dependency();

create or replace function public.validate_release_evidence_boundary()
returns trigger language plpgsql as $$
declare milestone_record public.roadmap_milestones%rowtype;
declare plan_as_of timestamptz;
declare matched_gate_count integer;
begin
  select * into milestone_record from public.roadmap_milestones where id = new.milestone_id and user_id = new.user_id;
  select as_of into plan_as_of from public.roadmap_plans where id = new.plan_id and user_id = new.user_id;
  if milestone_record.id is null or plan_as_of is null or milestone_record.plan_id <> new.plan_id then
    raise exception 'release evidence crosses roadmap plan boundary';
  end if;
  if milestone_record.status not in ('READY', 'RELEASED') then raise exception 'release evidence milestone is not ready'; end if;
  if new.created_at < plan_as_of then raise exception 'release evidence predates roadmap plan'; end if;
  if not (milestone_record.required_gate_keys <@ new.gate_keys) then raise exception 'release evidence omits required gate'; end if;
  select count(distinct gate_key) into matched_gate_count from public.roadmap_gates
    where plan_id = new.plan_id and user_id = new.user_id and gate_key = any(new.gate_keys) and status = 'PASSED';
  if matched_gate_count <> cardinality(new.gate_keys) then raise exception 'release evidence gate is missing, duplicated, or not passed'; end if;
  return new;
end;
$$;

create trigger release_evidence_boundary before insert on public.release_evidence_bundles
for each row execute function public.validate_release_evidence_boundary();

create index roadmap_plans_user_as_of on public.roadmap_plans(user_id, as_of desc);
create index roadmap_gates_plan_status on public.roadmap_gates(user_id, plan_id, status);
create index roadmap_milestones_plan_status on public.roadmap_milestones(user_id, plan_id, status);
create index release_evidence_status on public.release_evidence_bundles(user_id, status, created_at desc);

alter table public.roadmap_plans enable row level security;
alter table public.roadmap_gates enable row level security;
alter table public.roadmap_gate_checks enable row level security;
alter table public.roadmap_milestones enable row level security;
alter table public.roadmap_milestone_dependencies enable row level security;
alter table public.release_evidence_bundles enable row level security;
alter table public.roadmap_replays enable row level security;

create policy roadmap_plans_owner_select on public.roadmap_plans for select using (user_id = auth.uid());
create policy roadmap_gates_owner_select on public.roadmap_gates for select using (user_id = auth.uid());
create policy roadmap_checks_owner_select on public.roadmap_gate_checks for select using (user_id = auth.uid());
create policy roadmap_milestones_owner_select on public.roadmap_milestones for select using (user_id = auth.uid());
create policy roadmap_dependencies_owner_select on public.roadmap_milestone_dependencies for select using (user_id = auth.uid());
create policy release_evidence_owner_select on public.release_evidence_bundles for select using (user_id = auth.uid());
create policy roadmap_replays_owner_select on public.roadmap_replays for select using (user_id = auth.uid());

create trigger roadmap_plans_immutable before update or delete on public.roadmap_plans for each row execute function public.prevent_immutable_investment_record_update();
create trigger roadmap_gates_immutable before update or delete on public.roadmap_gates for each row execute function public.prevent_immutable_investment_record_update();
create trigger roadmap_checks_immutable before update or delete on public.roadmap_gate_checks for each row execute function public.prevent_immutable_investment_record_update();
create trigger roadmap_milestones_immutable before update or delete on public.roadmap_milestones for each row execute function public.prevent_immutable_investment_record_update();
create trigger roadmap_dependencies_immutable before update or delete on public.roadmap_milestone_dependencies for each row execute function public.prevent_immutable_investment_record_update();
create trigger release_evidence_immutable before update or delete on public.release_evidence_bundles for each row execute function public.prevent_immutable_investment_record_update();
create trigger roadmap_replays_immutable before update or delete on public.roadmap_replays for each row execute function public.prevent_immutable_investment_record_update();

commit;
