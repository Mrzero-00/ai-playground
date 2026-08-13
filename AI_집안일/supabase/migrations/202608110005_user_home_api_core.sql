-- User/Home API v2 foundations.
--
-- This migration is intentionally additive: the legacy /api/state snapshot can
-- continue to read the same tables while new APIs use the atomic RPCs below.

alter table public.app_users
  add column if not exists avatar_url text,
  add column if not exists status text not null default 'active',
  add column if not exists deleted_at timestamptz,
  add column if not exists last_seen_at timestamptz;

alter table public.homes
  add column if not exists timezone text not null default 'Asia/Seoul',
  add column if not exists created_by_user_id uuid references public.app_users(id) on delete set null,
  add column if not exists status text not null default 'active',
  add column if not exists deleted_at timestamptz;

alter table public.home_members
  add column if not exists status text not null default 'active',
  add column if not exists display_name_snapshot text,
  add column if not exists ended_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.home_profiles
  add column if not exists schema_version smallint not null default 1,
  add column if not exists updated_by_user_id uuid references public.app_users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_users_status_check') then
    alter table public.app_users
      add constraint app_users_status_check check (status in ('active', 'suspended', 'deleted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'homes_status_check') then
    alter table public.homes
      add constraint homes_status_check check (status in ('active', 'pending_deletion', 'deleted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'home_members_status_check') then
    alter table public.home_members
      add constraint home_members_status_check check (status in ('active', 'left', 'removed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'home_members_home_id_id_key') then
    alter table public.home_members
      add constraint home_members_home_id_id_key unique (home_id, id);
  end if;
end;
$$;

update public.home_members as membership
set display_name_snapshot = coalesce(nullif(membership.display_name_snapshot, ''), nullif(users.display_name, ''), '구성원')
from public.app_users as users
where users.id = membership.user_id
  and membership.display_name_snapshot is null;

update public.home_members
set display_name_snapshot = '구성원'
where display_name_snapshot is null;

alter table public.home_members
  alter column display_name_snapshot set default '구성원',
  alter column display_name_snapshot set not null;

update public.homes as home
set created_by_user_id = (
  select membership.user_id
  from public.home_members as membership
  where membership.home_id = home.id
    and membership.role = 'owner'
  order by membership.joined_at asc, membership.id asc
  limit 1
)
where home.created_by_user_id is null;

create index if not exists homes_created_by_user_idx
  on public.homes(created_by_user_id)
  where created_by_user_id is not null;

create index if not exists home_members_active_user_idx
  on public.home_members(user_id, home_id)
  where status = 'active';

create index if not exists chores_home_assignee_idx
  on public.chores(home_id, executor_member_id)
  where executor_member_id is not null;

-- executor_member_id is the canonical single assignee. assigned_member_id is
-- mirrored only for backwards compatibility with AppData v2 snapshots.
update public.chores as chore
set executor_member_id = case
  when exists (
    select 1
    from public.home_members as membership
    where membership.home_id = chore.home_id
      and membership.id = chore.executor_member_id
      and membership.status = 'active'
  ) then chore.executor_member_id
  when exists (
    select 1
    from public.home_members as membership
    where membership.home_id = chore.home_id
      and membership.id = chore.assigned_member_id
      and membership.status = 'active'
  ) then chore.assigned_member_id
  else null
end;

update public.chores
set assigned_member_id = executor_member_id
where assigned_member_id is distinct from executor_member_id;

update public.chores
set category = 'etc', updated_at = now()
where category not in ('cleaning', 'kitchen', 'laundry', 'pet', 'living', 'etc');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chores_executor_home_member_fkey') then
    alter table public.chores
      add constraint chores_executor_home_member_fkey
      foreign key (home_id, executor_member_id)
      references public.home_members(home_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chores_assigned_home_member_fkey') then
    alter table public.chores
      add constraint chores_assigned_home_member_fkey
      foreign key (home_id, assigned_member_id)
      references public.home_members(home_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chores_category_check') then
    alter table public.chores
      add constraint chores_category_check
      check (category in ('cleaning', 'kitchen', 'laundry', 'pet', 'living', 'etc'));
  end if;
end;
$$;

create or replace function public.validate_chore_assignee_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.executor_member_id := coalesce(new.executor_member_id, new.assigned_member_id);
    new.assigned_member_id := new.executor_member_id;
  elsif new.executor_member_id is distinct from old.executor_member_id then
    new.assigned_member_id := new.executor_member_id;
  elsif new.assigned_member_id is distinct from old.assigned_member_id then
    new.executor_member_id := new.assigned_member_id;
  else
    new.assigned_member_id := new.executor_member_id;
  end if;

  if new.executor_member_id is not null and not exists (
    select 1
    from public.home_members as membership
    where membership.home_id = new.home_id
      and membership.id = new.executor_member_id
      and membership.status = 'active'
  ) then
    raise exception 'ASSIGNEE_NOT_ACTIVE_HOME_MEMBER' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_chore_assignee_v2 on public.chores;
create trigger validate_chore_assignee_v2
before insert or update of home_id, executor_member_id, assigned_member_id
on public.chores
for each row execute function public.validate_chore_assignee_v2();

create or replace function public.clear_inactive_member_assignments_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' or (old.status = 'active' and new.status <> 'active') then
    update public.chores
    set executor_member_id = null,
        assigned_member_id = null,
        updated_at = now()
    where home_id = old.home_id
      and (executor_member_id = old.id or assigned_member_id = old.id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_inactive_member_assignments_v2 on public.home_members;
create trigger clear_inactive_member_assignments_v2
before delete or update of status
on public.home_members
for each row execute function public.clear_inactive_member_assignments_v2();

revoke all on function public.validate_chore_assignee_v2() from public, anon, authenticated;
revoke all on function public.clear_inactive_member_assignments_v2() from public, anon, authenticated;

alter table public.chore_history
  add column if not exists occurrence_id text,
  add column if not exists category_snapshot text,
  add column if not exists status text not null default 'completed',
  add column if not exists request_id uuid,
  add column if not exists performed_by_membership_id text,
  add column if not exists assignee_membership_id_snapshot text,
  add column if not exists assignee_name_snapshot text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by_user_id uuid references public.app_users(id) on delete set null,
  add column if not exists voided_by_name text,
  add column if not exists void_reason text,
  add column if not exists updated_at timestamptz not null default now();

update public.chore_history as history
set scheduled_for = (history.performed_at at time zone home.timezone)::date
from public.homes as home
where home.id = history.home_id
  and history.scheduled_for is null;

update public.chore_history as history
set category_snapshot = coalesce((
  select case
    when chore.category in ('cleaning', 'kitchen', 'laundry', 'pet', 'living', 'etc') then chore.category
    else 'etc'
  end
  from public.chores as chore
  where chore.home_id = history.home_id
    and chore.id = history.chore_id
), 'etc')
where history.category_snapshot is null;

update public.chore_history as history
set performed_by_membership_id = membership.id
from public.home_members as membership
where membership.home_id = history.home_id
  and membership.user_id = history.performed_by_user_id
  and history.performed_by_membership_id is null;

update public.chore_history as history
set occurrence_id = 'occurrence-' || encode(
  digest(history.home_id || chr(31) || history.chore_id || chr(31) || history.scheduled_for::text, 'sha256'),
  'hex'
)
where history.occurrence_id is null;

update public.chore_history as history
set assignee_membership_id_snapshot = chore.executor_member_id,
    assignee_name_snapshot = coalesce(
      nullif(users.display_name, ''),
      nullif(membership.display_name_snapshot, ''),
      case when chore.executor_member_id is null then null else '구성원' end
    )
from public.chores as chore
left join public.home_members as membership
  on membership.home_id = chore.home_id
 and membership.id = chore.executor_member_id
left join public.app_users as users
  on users.id = membership.user_id
where chore.home_id = history.home_id
  and chore.id = history.chore_id
  and history.assignee_membership_id_snapshot is null;

-- Preserve every legacy row, but only the earliest completion for an occurrence
-- remains active. The rest stay available as explicitly voided audit records.
with ranked as (
  select
    history.home_id,
    history.id,
    row_number() over (
      partition by history.home_id, history.chore_id, history.scheduled_for
      order by history.performed_at asc, history.id asc
    ) as occurrence_rank
  from public.chore_history as history
  where history.action = 'completed'
    and history.status = 'completed'
    and history.scheduled_for is not null
)
update public.chore_history as history
set status = 'voided',
    voided_at = coalesce(history.voided_at, now()),
    void_reason = coalesce(history.void_reason, 'legacy_duplicate'),
    updated_at = now()
from ranked
where ranked.home_id = history.home_id
  and ranked.id = history.id
  and ranked.occurrence_rank > 1;

alter table public.chore_history
  alter column occurrence_id set not null,
  alter column scheduled_for set not null,
  alter column category_snapshot set not null,
  alter column category_snapshot set default 'etc';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chore_history_status_check') then
    alter table public.chore_history
      add constraint chore_history_status_check check (status in ('completed', 'voided'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chore_history_category_snapshot_check') then
    alter table public.chore_history
      add constraint chore_history_category_snapshot_check
      check (category_snapshot in ('cleaning', 'kitchen', 'laundry', 'pet', 'living', 'etc'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chore_history_status_metadata_check') then
    alter table public.chore_history
      add constraint chore_history_status_metadata_check
      check (
        (status = 'completed' and voided_at is null)
        or (status = 'voided' and voided_at is not null)
      );
  end if;
end;
$$;

create unique index if not exists chore_history_active_occurrence_uidx
  on public.chore_history(home_id, chore_id, scheduled_for)
  where action = 'completed' and status = 'completed' and scheduled_for is not null;

create unique index if not exists chore_history_active_occurrence_id_uidx
  on public.chore_history(home_id, occurrence_id)
  where action = 'completed' and status = 'completed';

create unique index if not exists chore_history_request_uidx
  on public.chore_history(home_id, request_id)
  where request_id is not null;

create index if not exists chore_history_user_category_active_idx
  on public.chore_history(performed_by_user_id, category_snapshot, performed_at desc)
  where action = 'completed' and status = 'completed';

create index if not exists chore_history_home_active_cursor_idx
  on public.chore_history(home_id, performed_at desc, id desc)
  where action = 'completed' and status = 'completed';

create or replace function public.chore_to_json_v2(p_chore public.chores)
returns jsonb
language sql
stable
strict
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_chore.id,
    'title', p_chore.title,
    'category', p_chore.category,
    'icon', p_chore.icon,
    'recurrence', p_chore.recurrence,
    'createdAt', p_chore.created_at,
    'scheduleAnchorDate', p_chore.schedule_anchor_date,
    'nextDueDate', p_chore.next_due_date,
    'isCustom', p_chore.is_custom,
    'enabled', p_chore.enabled,
    'assigneeMembershipId', p_chore.executor_member_id,
    'notificationEnabled', p_chore.notification_enabled,
    'notificationTime', case
      when p_chore.notification_time is null then null
      else to_char(p_chore.notification_time, 'HH24:MI')
    end
  );
$$;

create table if not exists public.completion_request_ledger (
  home_id text not null references public.homes(id) on delete cascade,
  request_id uuid not null,
  requested_by_membership_id text not null,
  chore_id text not null,
  scheduled_for date not null,
  outcome text not null check (outcome in ('created', 'already_completed')),
  completion_id text not null,
  next_due_date date not null,
  home_revision bigint not null check (home_revision >= 0),
  chore_snapshot jsonb,
  created_at timestamptz not null default now(),
  primary key (home_id, request_id),
  foreign key (home_id, completion_id)
    references public.chore_history(home_id, id) on delete cascade
);

alter table public.completion_request_ledger
  add column if not exists chore_snapshot jsonb;

create index if not exists completion_request_ledger_completion_idx
  on public.completion_request_ledger(home_id, completion_id);

alter table public.completion_request_ledger enable row level security;
revoke all on table public.completion_request_ledger from public, anon, authenticated;

update public.completion_request_ledger as ledger
set chore_snapshot = case when chore.id is not null then
  public.chore_to_json_v2(chore)
else
  jsonb_build_object(
    'id', history.chore_id,
    'title', history.chore_title,
    'category', history.category_snapshot,
    'icon', null,
    'recurrence', '{"interval": 1, "unit": "week"}'::jsonb,
    'createdAt', history.performed_at,
    'scheduleAnchorDate', null,
    'nextDueDate', history.scheduled_for,
    'isCustom', false,
    'enabled', false,
    'assigneeMembershipId', history.assignee_membership_id_snapshot,
    'notificationEnabled', false,
    'notificationTime', null
  )
end
from public.chore_history as history
left join public.chores as chore
  on chore.home_id = history.home_id and chore.id = history.chore_id
where ledger.home_id = history.home_id
  and ledger.completion_id = history.id
  and ledger.chore_snapshot is null;

insert into public.completion_request_ledger (
  home_id, request_id, requested_by_membership_id, chore_id, scheduled_for,
  outcome, completion_id, next_due_date, home_revision, chore_snapshot, created_at
)
select
  history.home_id,
  history.request_id,
  coalesce(history.performed_by_membership_id, 'legacy-unknown'),
  history.chore_id,
  history.scheduled_for,
  'created',
  history.id,
  coalesce(chore.next_due_date, history.scheduled_for),
  home.sync_revision,
  case when chore.id is not null then
    public.chore_to_json_v2(chore)
  else
    jsonb_build_object(
      'id', history.chore_id,
      'title', history.chore_title,
      'category', history.category_snapshot,
      'icon', null,
      'recurrence', '{"interval": 1, "unit": "week"}'::jsonb,
      'createdAt', history.performed_at,
      'scheduleAnchorDate', null,
      'nextDueDate', history.scheduled_for,
      'isCustom', false,
      'enabled', false,
      'assigneeMembershipId', history.assignee_membership_id_snapshot,
      'notificationEnabled', false,
      'notificationTime', null
    )
  end,
  history.performed_at
from public.chore_history as history
join public.homes as home on home.id = history.home_id
left join public.chores as chore
  on chore.home_id = history.home_id and chore.id = history.chore_id
where history.request_id is not null
on conflict (home_id, request_id) do nothing;

alter table public.completion_request_ledger
  alter column chore_snapshot set not null;

comment on column public.chore_history.occurrence_id
  is 'Stable identifier derived from home, chore, and scheduled date.';
comment on column public.chore_history.performed_by_membership_id
  is 'Immutable membership ID snapshot; intentionally retained if that membership is later deleted.';
comment on column public.chore_history.assignee_membership_id_snapshot
  is 'Assignee membership at completion time; null means the chore was unassigned.';

create or replace function public.protect_chore_history_audit_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.home_id is distinct from old.home_id
     or new.id is distinct from old.id
     or new.occurrence_id is distinct from old.occurrence_id
     or new.chore_id is distinct from old.chore_id
     or new.chore_title is distinct from old.chore_title
     or new.category_snapshot is distinct from old.category_snapshot
     or new.action is distinct from old.action
     or new.request_id is distinct from old.request_id
     or new.performed_at is distinct from old.performed_at
     or new.scheduled_for is distinct from old.scheduled_for
     or new.performed_by_membership_id is distinct from old.performed_by_membership_id
     or new.performed_by_name is distinct from old.performed_by_name
     or new.assignee_membership_id_snapshot is distinct from old.assignee_membership_id_snapshot
     or new.assignee_name_snapshot is distinct from old.assignee_name_snapshot then
    raise exception 'IMMUTABLE_COMPLETION_AUDIT' using errcode = '22023';
  end if;
  if old.status = 'voided' and new.status <> 'voided' then
    raise exception 'VOIDED_COMPLETION_IS_FINAL' using errcode = '22023';
  end if;
  if old.status = 'completed' and new.status = 'voided' and new.voided_at is null then
    raise exception 'VOID_METADATA_REQUIRED' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_chore_history_audit_v2 on public.chore_history;
create trigger protect_chore_history_audit_v2
before update on public.chore_history
for each row execute function public.protect_chore_history_audit_v2();

revoke all on function public.protect_chore_history_audit_v2() from public, anon, authenticated;

create or replace function public.assert_valid_home_profile_v2(p_profile jsonb)
returns void
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  key_text text;
  value_text text;
begin
  if p_profile is null or p_profile = 'null'::jsonb then
    return;
  end if;
  if jsonb_typeof(p_profile) <> 'object' then
    raise exception 'INVALID_HOME_PROFILE' using errcode = '22023';
  end if;
  if coalesce(p_profile->>'householdType', '') not in ('single', 'couple', 'family', 'shared') then
    raise exception 'INVALID_HOUSEHOLD_TYPE' using errcode = '22023';
  end if;
  if p_profile ? 'housingTenure'
     and coalesce(p_profile->>'housingTenure', '') not in ('monthly-rent', 'jeonse', 'owned') then
    raise exception 'INVALID_HOUSING_TENURE' using errcode = '22023';
  end if;
  if coalesce(p_profile->>'memberCount', '') !~ '^\d+$'
     or (p_profile->>'memberCount')::integer not between 0 and 30 then
    raise exception 'INVALID_MEMBER_COUNT' using errcode = '22023';
  end if;
  if coalesce(p_profile->>'roomCount', '') !~ '^\d+$'
     or (p_profile->>'roomCount')::integer not between 0 and 30 then
    raise exception 'INVALID_ROOM_COUNT' using errcode = '22023';
  end if;
  if coalesce(p_profile->>'bathroomCount', '') !~ '^\d+$'
     or (p_profile->>'bathroomCount')::integer not between 0 and 30 then
    raise exception 'INVALID_BATHROOM_COUNT' using errcode = '22023';
  end if;
  if jsonb_typeof(p_profile->'hasPets') is distinct from 'boolean' then
    raise exception 'INVALID_HAS_PETS' using errcode = '22023';
  end if;
  if jsonb_typeof(p_profile->'completed') is distinct from 'boolean' then
    raise exception 'INVALID_PROFILE_COMPLETION' using errcode = '22023';
  end if;
  if jsonb_typeof(p_profile->'petTypes') is distinct from 'array' then
    raise exception 'INVALID_PET_TYPES' using errcode = '22023';
  end if;
  for value_text in select jsonb_array_elements_text(p_profile->'petTypes')
  loop
    if value_text is null or value_text not in ('dog', 'cat', 'fish', 'bird', 'small-animal', 'reptile', 'other') then
      raise exception 'INVALID_PET_TYPE' using errcode = '22023';
    end if;
  end loop;
  if p_profile ? 'childAges' then
    if jsonb_typeof(p_profile->'childAges') <> 'array'
       or jsonb_array_length(p_profile->'childAges') > 20 then
      raise exception 'INVALID_CHILD_AGES' using errcode = '22023';
    end if;
    for value_text in select jsonb_array_elements_text(p_profile->'childAges')
    loop
      if value_text is null or value_text !~ '^\d+$' or value_text::integer not between 0 and 25 then
        raise exception 'INVALID_CHILD_AGE' using errcode = '22023';
      end if;
    end loop;
  end if;
  if p_profile ? 'petCounts' then
    if jsonb_typeof(p_profile->'petCounts') <> 'object' then
      raise exception 'INVALID_PET_COUNTS' using errcode = '22023';
    end if;
    for key_text, value_text in select key, value from jsonb_each_text(p_profile->'petCounts')
    loop
      if key_text not in ('dog', 'cat', 'fish', 'bird', 'small-animal', 'reptile', 'other') then
        raise exception 'INVALID_PET_COUNT_TYPE' using errcode = '22023';
      end if;
      if value_text is null or value_text !~ '^\d+$' or value_text::integer not between 0 and 30 then
        raise exception 'INVALID_PET_COUNT' using errcode = '22023';
      end if;
    end loop;
  end if;
end;
$$;

create or replace function public.advance_chore_due_date_v2(p_from date, p_recurrence jsonb)
returns date
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  recurrence_interval integer;
  recurrence_unit text;
  month_count integer;
  target_month date;
  target_month_last_day date;
begin
  if jsonb_typeof(p_recurrence) <> 'object'
     or coalesce(p_recurrence->>'interval', '') !~ '^\d+$' then
    raise exception 'INVALID_RECURRENCE' using errcode = '22023';
  end if;
  recurrence_interval := (p_recurrence->>'interval')::integer;
  recurrence_unit := p_recurrence->>'unit';
  if recurrence_interval not between 1 and 365
     or recurrence_unit is null
     or recurrence_unit not in ('day', 'week', 'month', 'year') then
    raise exception 'INVALID_RECURRENCE' using errcode = '22023';
  end if;

  if recurrence_unit = 'day' then
    return p_from + recurrence_interval;
  elsif recurrence_unit = 'week' then
    return p_from + (recurrence_interval * 7);
  end if;

  month_count := case when recurrence_unit = 'year' then recurrence_interval * 12 else recurrence_interval end;
  target_month := (date_trunc('month', p_from::timestamp) + make_interval(months => month_count))::date;
  target_month_last_day := (target_month + interval '1 month - 1 day')::date;
  return target_month + least(
    extract(day from p_from)::integer,
    extract(day from target_month_last_day)::integer
  ) - 1;
end;
$$;

create or replace function public.validate_chore_schedule_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.advance_chore_due_date_v2(new.next_due_date, new.recurrence);
  if new.schedule_anchor_date is not null and new.next_due_date < new.schedule_anchor_date then
    raise exception 'INVALID_CHORE_SCHEDULE_RANGE' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_chore_schedule_v2 on public.chores;
create trigger validate_chore_schedule_v2
before insert or update of recurrence, schedule_anchor_date, next_due_date
on public.chores
for each row execute function public.validate_chore_schedule_v2();

revoke all on function public.validate_chore_schedule_v2() from public, anon, authenticated;

create or replace function public.chore_completion_to_json_v2(p_completion public.chore_history)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_completion.id,
    'homeId', p_completion.home_id,
    'occurrenceId', p_completion.occurrence_id,
    'choreId', p_completion.chore_id,
    'scheduledFor', p_completion.scheduled_for,
    'status', p_completion.status,
    'choreSnapshot', jsonb_build_object(
      'title', p_completion.chore_title,
      'category', p_completion.category_snapshot
    ),
    'performedAt', p_completion.performed_at,
    'performedBy', jsonb_build_object(
      'membershipId', p_completion.performed_by_membership_id,
      'userId', p_completion.performed_by_user_id,
      'displayName', p_completion.performed_by_name
    ),
    'assigneeSnapshot', case
      when p_completion.assignee_membership_id_snapshot is null then null
      else jsonb_build_object(
        'membershipId', p_completion.assignee_membership_id_snapshot,
        'displayName', p_completion.assignee_name_snapshot
      )
    end,
    'completedByAssignee', case
      when p_completion.assignee_membership_id_snapshot is null then null
      else p_completion.assignee_membership_id_snapshot = p_completion.performed_by_membership_id
    end,
    'voidedAt', p_completion.voided_at
  );
$$;

create or replace function public.complete_chore_once(
  p_user_id uuid,
  p_home_id text,
  p_chore_id text,
  p_scheduled_for date,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  home_record public.homes%rowtype;
  chore_record public.chores%rowtype;
  completion_record public.chore_history%rowtype;
  ledger_record public.completion_request_ledger%rowtype;
  performer_membership_id text;
  performer_name text;
  assignee_name text;
  v_next_due_date date;
  completion_created boolean := false;
  current_revision bigint;
begin
  if p_user_id is null
     or p_home_id is null or length(p_home_id) not between 3 and 120
     or p_chore_id is null or length(p_chore_id) not between 1 and 160
     or p_scheduled_for is null
     or p_request_id is null then
    raise exception 'INVALID_COMPLETION_REQUEST' using errcode = '22023';
  end if;

  -- Account lifecycle and home mutations share the user -> home -> membership
  -- lock order. This prevents a user deletion from racing the completion FK.
  perform 1
  from public.app_users as users
  where users.id = p_user_id
    and users.status = 'active'
  for share;
  if not found then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;

  select * into home_record
  from public.homes
  where id = p_home_id
    and status = 'active'
  for update;
  if not found then
    raise exception 'HOME_NOT_FOUND' using errcode = 'P0002';
  end if;

  select
    membership.id,
    coalesce(nullif(users.display_name, ''), nullif(membership.display_name_snapshot, ''), '구성원')
  into performer_membership_id, performer_name
  from public.home_members as membership
  join public.app_users as users on users.id = membership.user_id
  where membership.home_id = p_home_id
    and membership.user_id = p_user_id
    and membership.status = 'active'
    and users.status = 'active'
  for update of membership;
  if not found then
    raise exception 'HOME_FORBIDDEN' using errcode = '42501';
  end if;

  -- The ledger owns idempotency independently of completion status. Voiding a
  -- completion never makes the same request ID executable again.
  select * into ledger_record
  from public.completion_request_ledger
  where home_id = p_home_id
    and request_id = p_request_id
  for share;
  if found then
    if ledger_record.requested_by_membership_id <> performer_membership_id
       or ledger_record.chore_id <> p_chore_id
       or ledger_record.scheduled_for <> p_scheduled_for then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    select * into completion_record
    from public.chore_history
    where home_id = p_home_id and id = ledger_record.completion_id;
    if not found then
      raise exception 'COMPLETION_LEDGER_BROKEN' using errcode = '23503';
    end if;
    return jsonb_build_object(
      'created', ledger_record.outcome = 'created',
      'alreadyCompleted', ledger_record.outcome = 'already_completed',
      'idempotentReplay', true,
      'completion', public.chore_completion_to_json_v2(completion_record),
      'chore', ledger_record.chore_snapshot,
      'nextDueDate', ledger_record.next_due_date,
      -- Revision is a live CAS token rather than part of the immutable result.
      'homeRevision', home_record.sync_revision
    );
  end if;

  select * into chore_record
  from public.chores
  where home_id = p_home_id
    and id = p_chore_id
  for update;
  if not found then
    raise exception 'CHORE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not chore_record.enabled then
    raise exception 'CHORE_DISABLED' using errcode = '22023';
  end if;

  select * into completion_record
  from public.chore_history
  where home_id = p_home_id
    and chore_id = p_chore_id
    and scheduled_for = p_scheduled_for
    and action = 'completed'
    and status = 'completed';
  if found then
    insert into public.completion_request_ledger (
      home_id, request_id, requested_by_membership_id, chore_id, scheduled_for,
      outcome, completion_id, next_due_date, home_revision, chore_snapshot
    ) values (
      p_home_id, p_request_id, performer_membership_id, p_chore_id, p_scheduled_for,
      'already_completed', completion_record.id, chore_record.next_due_date,
      home_record.sync_revision, public.chore_to_json_v2(chore_record)
    );
    return jsonb_build_object(
      'created', false,
      'alreadyCompleted', true,
      'idempotentReplay', false,
      'completion', public.chore_completion_to_json_v2(completion_record),
      'chore', public.chore_to_json_v2(chore_record),
      'nextDueDate', chore_record.next_due_date,
      'homeRevision', home_record.sync_revision
    );
  end if;

  if chore_record.next_due_date <> p_scheduled_for then
    raise exception 'CHORE_OCCURRENCE_MISMATCH' using errcode = '22023';
  end if;
  if p_scheduled_for > (clock_timestamp() at time zone home_record.timezone)::date then
    raise exception 'CHORE_NOT_DUE' using errcode = '22023';
  end if;

  if chore_record.executor_member_id is not null then
    select coalesce(nullif(users.display_name, ''), nullif(membership.display_name_snapshot, ''), '구성원')
    into assignee_name
    from public.home_members as membership
    left join public.app_users as users on users.id = membership.user_id
    where membership.home_id = p_home_id
      and membership.id = chore_record.executor_member_id;
  end if;

  insert into public.chore_history (
    home_id,
    id,
    occurrence_id,
    chore_id,
    chore_title,
    category_snapshot,
    action,
    status,
    request_id,
    performed_at,
    scheduled_for,
    performed_by_user_id,
    performed_by_membership_id,
    performed_by_name,
    assignee_membership_id_snapshot,
    assignee_name_snapshot,
    updated_at
  ) values (
    p_home_id,
    'history-' || gen_random_uuid()::text,
    'occurrence-' || encode(digest(p_home_id || chr(31) || p_chore_id || chr(31) || p_scheduled_for::text, 'sha256'), 'hex'),
    p_chore_id,
    chore_record.title,
    chore_record.category,
    'completed',
    'completed',
    p_request_id,
    clock_timestamp(),
    p_scheduled_for,
    p_user_id,
    performer_membership_id,
    performer_name,
    chore_record.executor_member_id,
    assignee_name,
    now()
  )
  on conflict do nothing
  returning * into completion_record;

  if not found then
    select * into completion_record
    from public.chore_history
    where home_id = p_home_id
      and request_id = p_request_id;
    if found and (
      completion_record.chore_id <> p_chore_id
      or completion_record.scheduled_for <> p_scheduled_for
      or completion_record.performed_by_membership_id is distinct from performer_membership_id
    ) then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    elsif not found then
      select * into completion_record
      from public.chore_history
      where home_id = p_home_id
        and chore_id = p_chore_id
        and scheduled_for = p_scheduled_for
        and action = 'completed'
        and status = 'completed';
    end if;
    if not found then
      raise exception 'COMPLETION_CONFLICT' using errcode = '40001';
    end if;
    insert into public.completion_request_ledger (
      home_id, request_id, requested_by_membership_id, chore_id, scheduled_for,
      outcome, completion_id, next_due_date, home_revision, chore_snapshot
    ) values (
      p_home_id,
      p_request_id,
      performer_membership_id,
      p_chore_id,
      p_scheduled_for,
      case when completion_record.request_id = p_request_id then 'created' else 'already_completed' end,
      completion_record.id,
      chore_record.next_due_date,
      home_record.sync_revision,
      public.chore_to_json_v2(chore_record)
    );
    return jsonb_build_object(
      'created', coalesce(completion_record.request_id = p_request_id, false),
      'alreadyCompleted', not coalesce(completion_record.request_id = p_request_id, false),
      'idempotentReplay', coalesce(completion_record.request_id = p_request_id, false),
      'completion', public.chore_completion_to_json_v2(completion_record),
      'chore', public.chore_to_json_v2(chore_record),
      'nextDueDate', chore_record.next_due_date,
      'homeRevision', home_record.sync_revision
    );
  end if;

  completion_created := true;
  -- The existing client schedules the next run from the actual completion day,
  -- not from a potentially long-overdue occurrence date.
  v_next_due_date := public.advance_chore_due_date_v2(
    (clock_timestamp() at time zone home_record.timezone)::date,
    chore_record.recurrence
  );
  update public.chores as chore
  set next_due_date = v_next_due_date,
      updated_at = now()
  where chore.home_id = p_home_id
    and chore.id = p_chore_id;

  update public.homes
  set sync_revision = sync_revision + 1,
      updated_at = now()
  where id = p_home_id
  returning sync_revision into current_revision;

  -- Persist the exact post-completion chore representation so an idempotent
  -- replay remains answerable even after the owner later deletes the chore.
  chore_record.next_due_date := v_next_due_date;

  insert into public.completion_request_ledger (
    home_id, request_id, requested_by_membership_id, chore_id, scheduled_for,
    outcome, completion_id, next_due_date, home_revision, chore_snapshot
  ) values (
    p_home_id, p_request_id, performer_membership_id, p_chore_id, p_scheduled_for,
    'created', completion_record.id, v_next_due_date, current_revision,
    public.chore_to_json_v2(chore_record)
  );

  return jsonb_build_object(
    'created', completion_created,
    'alreadyCompleted', false,
    'idempotentReplay', false,
    'completion', public.chore_completion_to_json_v2(completion_record),
    'chore', public.chore_to_json_v2(chore_record),
    'nextDueDate', v_next_due_date,
    'homeRevision', current_revision
  );
end;
$$;

revoke all on function public.assert_valid_home_profile_v2(jsonb) from public, anon, authenticated;
revoke all on function public.advance_chore_due_date_v2(date, jsonb) from public, anon, authenticated;
revoke all on function public.chore_to_json_v2(public.chores) from public, anon, authenticated;
revoke all on function public.chore_completion_to_json_v2(public.chore_history) from public, anon, authenticated;
revoke all on function public.complete_chore_once(uuid, text, text, date, uuid) from public, anon, authenticated;
grant execute on function public.complete_chore_once(uuid, text, text, date, uuid) to service_role;

comment on function public.complete_chore_once(uuid, text, text, date, uuid)
  is 'Atomically completes one due occurrence, records server-derived actor/assignee snapshots, and deduplicates retries and concurrent members.';

create or replace function public.assign_chore_v2(
  p_user_id uuid,
  p_home_id text,
  p_chore_id text,
  p_assignee_membership_id text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_revision bigint;
  next_revision bigint;
  requester_membership_id text;
begin
  perform 1
  from public.app_users as users
  where users.id = p_user_id and users.status = 'active'
  for share;
  if not found then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;
  select sync_revision into current_revision
  from public.homes
  where id = p_home_id and status = 'active'
  for update;
  if not found then
    raise exception 'HOME_NOT_FOUND' using errcode = 'P0002';
  end if;
  select id into requester_membership_id
    from public.home_members
    where home_id = p_home_id
      and user_id = p_user_id
      and status = 'active'
  for update;
  if not found then
    raise exception 'HOME_FORBIDDEN' using errcode = '42501';
  end if;
  if current_revision <> coalesce(p_expected_revision, 0) then
    raise exception 'SYNC_CONFLICT' using errcode = '40001';
  end if;
  if not exists (
    select 1 from public.chores where home_id = p_home_id and id = p_chore_id
  ) then
    raise exception 'CHORE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_assignee_membership_id is not null then
    perform 1
    from public.home_members
    where home_id = p_home_id
      and id = p_assignee_membership_id
      and status = 'active'
    for update;
    if not found then
      raise exception 'ASSIGNEE_NOT_ACTIVE_HOME_MEMBER' using errcode = '23503';
    end if;
  end if;

  update public.chores
  set executor_member_id = p_assignee_membership_id,
      assigned_member_id = p_assignee_membership_id,
      updated_at = now()
  where home_id = p_home_id and id = p_chore_id;

  update public.homes
  set sync_revision = sync_revision + 1,
      updated_at = now()
  where id = p_home_id
  returning sync_revision into next_revision;

  return jsonb_build_object(
    'choreId', p_chore_id,
    'assigneeMembershipId', p_assignee_membership_id,
    'homeRevision', next_revision
  );
end;
$$;

create or replace function public.update_chore_schedule_v2(
  p_user_id uuid,
  p_home_id text,
  p_chore_id text,
  p_recurrence jsonb,
  p_schedule_anchor_date date,
  p_next_due_date date,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  home_record public.homes%rowtype;
  chore_record public.chores%rowtype;
  requester_membership_id text;
  anchor_date_value date;
  next_revision bigint;
begin
  if p_recurrence is null or p_next_due_date is null then
    raise exception 'INVALID_CHORE_SCHEDULE' using errcode = '22023';
  end if;
  -- Validates interval/unit and guards casts before any write.
  perform public.advance_chore_due_date_v2(p_next_due_date, p_recurrence);

  perform 1
  from public.app_users as users
  where users.id = p_user_id and users.status = 'active'
  for share;
  if not found then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;

  select * into home_record
  from public.homes
  where id = p_home_id and status = 'active'
  for update;
  if not found then
    raise exception 'HOME_NOT_FOUND' using errcode = 'P0002';
  end if;

  select membership.id into requester_membership_id
  from public.home_members as membership
  join public.app_users as users on users.id = membership.user_id
  where membership.home_id = p_home_id
    and membership.user_id = p_user_id
    and membership.status = 'active'
    and users.status = 'active'
  for update of membership;
  if not found then
    raise exception 'HOME_FORBIDDEN' using errcode = '42501';
  end if;
  if home_record.sync_revision <> coalesce(p_expected_revision, 0) then
    raise exception 'SYNC_CONFLICT' using errcode = '40001';
  end if;

  select * into chore_record
  from public.chores
  where home_id = p_home_id and id = p_chore_id
  for update;
  if not found then
    raise exception 'CHORE_NOT_FOUND' using errcode = 'P0002';
  end if;

  anchor_date_value := coalesce(
    p_schedule_anchor_date,
    chore_record.schedule_anchor_date,
    (chore_record.created_at at time zone home_record.timezone)::date
  );
  if p_next_due_date < anchor_date_value
     or p_next_due_date > anchor_date_value + (365 * 50) then
    raise exception 'INVALID_CHORE_SCHEDULE_RANGE' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.chore_history
    where home_id = p_home_id
      and chore_id = p_chore_id
      and scheduled_for = p_next_due_date
      and action = 'completed'
      and status = 'completed'
  ) then
    raise exception 'CHORE_OCCURRENCE_ALREADY_COMPLETED' using errcode = '22023';
  end if;

  update public.chores
  set recurrence = p_recurrence,
      schedule_anchor_date = anchor_date_value,
      next_due_date = p_next_due_date,
      updated_at = now()
  where home_id = p_home_id and id = p_chore_id;

  update public.homes
  set sync_revision = sync_revision + 1,
      updated_at = now()
  where id = p_home_id
  returning sync_revision into next_revision;

  return jsonb_build_object(
    'choreId', p_chore_id,
    'recurrence', p_recurrence,
    'scheduleAnchorDate', anchor_date_value,
    'nextDueDate', p_next_due_date,
    'homeRevision', next_revision
  );
end;
$$;

create or replace function public.set_chore_enabled_v2(
  p_user_id uuid,
  p_home_id text,
  p_chore_id text,
  p_enabled boolean,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_revision bigint;
  requester_membership_id text;
  next_revision bigint;
begin
  if p_enabled is null then
    raise exception 'INVALID_CHORE_ENABLED' using errcode = '22023';
  end if;
  perform 1
  from public.app_users as users
  where users.id = p_user_id and users.status = 'active'
  for share;
  if not found then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;
  select sync_revision into current_revision
  from public.homes
  where id = p_home_id and status = 'active'
  for update;
  if not found then
    raise exception 'HOME_NOT_FOUND' using errcode = 'P0002';
  end if;
  select membership.id into requester_membership_id
  from public.home_members as membership
  join public.app_users as users on users.id = membership.user_id
  where membership.home_id = p_home_id
    and membership.user_id = p_user_id
    and membership.status = 'active'
    and users.status = 'active'
  for update of membership;
  if not found then
    raise exception 'HOME_FORBIDDEN' using errcode = '42501';
  end if;
  if current_revision <> coalesce(p_expected_revision, 0) then
    raise exception 'SYNC_CONFLICT' using errcode = '40001';
  end if;

  perform 1
  from public.chores
  where home_id = p_home_id and id = p_chore_id
  for update;
  if not found then
    raise exception 'CHORE_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.chores
  set enabled = p_enabled, updated_at = now()
  where home_id = p_home_id and id = p_chore_id;
  update public.homes
  set sync_revision = sync_revision + 1, updated_at = now()
  where id = p_home_id
  returning sync_revision into next_revision;

  return jsonb_build_object(
    'choreId', p_chore_id,
    'enabled', p_enabled,
    'homeRevision', next_revision
  );
end;
$$;

create or replace function public.create_home_v2(
  p_user_id uuid,
  p_name text,
  p_emoji text,
  p_timezone text,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  home_id_value text := 'home-' || gen_random_uuid()::text;
  membership_id_value text := 'member-' || gen_random_uuid()::text;
  invite_code_value text;
  actor_name text;
  timezone_value text := coalesce(nullif(trim(p_timezone), ''), 'Asia/Seoul');
  attempt_count integer := 0;
begin
  if p_name is null or length(trim(p_name)) not between 1 and 60 then
    raise exception 'INVALID_HOME_NAME' using errcode = '22023';
  end if;
  if p_emoji is not null and char_length(p_emoji) > 16 then
    raise exception 'INVALID_HOME_EMOJI' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = timezone_value) then
    raise exception 'INVALID_HOME_TIMEZONE' using errcode = '22023';
  end if;
  perform public.assert_valid_home_profile_v2(p_profile);

  select display_name into actor_name
  from public.app_users
  where id = p_user_id and status = 'active'
  for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  loop
    attempt_count := attempt_count + 1;
    invite_code_value := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (select 1 from public.homes where invite_code = invite_code_value);
    if attempt_count >= 10 then
      raise exception 'INVITE_CODE_GENERATION_FAILED' using errcode = '40001';
    end if;
  end loop;

  insert into public.homes (
    id, name, emoji, task_view_mode, assignment_mode, invite_code,
    timezone, created_by_user_id, status, created_at, updated_at, sync_revision
  ) values (
    home_id_value,
    trim(p_name),
    coalesce(nullif(p_emoji, ''), '🏠'),
    'todo',
    'shared',
    invite_code_value,
    timezone_value,
    p_user_id,
    'active',
    now(),
    now(),
    1
  );

  insert into public.home_members (
    id, home_id, user_id, role, status, display_name_snapshot, joined_at, updated_at
  ) values (
    membership_id_value, home_id_value, p_user_id, 'owner', 'active',
    coalesce(nullif(actor_name, ''), '나'), now(), now()
  );

  if p_profile is not null and p_profile <> 'null'::jsonb then
    insert into public.home_profiles (home_id, profile, schema_version, updated_by_user_id, updated_at)
    values (home_id_value, p_profile, 1, p_user_id, now());
  end if;

  insert into public.user_settings (user_id, notifications, active_home_id, updated_at)
  values (p_user_id, '{"enabled": false, "reminderHour": 9}'::jsonb, home_id_value, now())
  on conflict (user_id) do update set
    active_home_id = excluded.active_home_id,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'homeId', home_id_value,
    'membershipId', membership_id_value,
    'inviteCode', invite_code_value,
    'homeRevision', 1
  );
end;
$$;

create or replace function public.update_home_v2(
  p_user_id uuid,
  p_home_id text,
  p_expected_revision bigint,
  p_name text,
  p_emoji text,
  p_timezone text,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_revision bigint;
  next_revision bigint;
  timezone_value text := coalesce(nullif(trim(p_timezone), ''), 'Asia/Seoul');
  owner_membership_id text;
begin
  if p_name is null or length(trim(p_name)) not between 1 and 60 then
    raise exception 'INVALID_HOME_NAME' using errcode = '22023';
  end if;
  if p_emoji is not null and char_length(p_emoji) > 16 then
    raise exception 'INVALID_HOME_EMOJI' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = timezone_value) then
    raise exception 'INVALID_HOME_TIMEZONE' using errcode = '22023';
  end if;
  perform public.assert_valid_home_profile_v2(p_profile);

  perform 1
  from public.app_users as users
  where users.id = p_user_id and users.status = 'active'
  for share;
  if not found then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;

  select sync_revision into current_revision
  from public.homes
  where id = p_home_id and status = 'active'
  for update;
  if not found then
    raise exception 'HOME_NOT_FOUND' using errcode = 'P0002';
  end if;
  select id into owner_membership_id
    from public.home_members
    where home_id = p_home_id
      and user_id = p_user_id
      and role = 'owner'
      and status = 'active'
  for update;
  if not found then
    raise exception 'HOME_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if current_revision <> coalesce(p_expected_revision, 0) then
    raise exception 'SYNC_CONFLICT' using errcode = '40001';
  end if;

  next_revision := current_revision + 1;
  update public.homes
  set name = trim(p_name),
      emoji = coalesce(nullif(p_emoji, ''), '🏠'),
      timezone = timezone_value,
      sync_revision = next_revision,
      updated_at = now()
  where id = p_home_id;

  if p_profile is null or p_profile = 'null'::jsonb then
    delete from public.home_profiles where home_id = p_home_id;
  else
    insert into public.home_profiles (home_id, profile, schema_version, updated_by_user_id, updated_at)
    values (p_home_id, p_profile, 1, p_user_id, now())
    on conflict (home_id) do update set
      profile = excluded.profile,
      schema_version = excluded.schema_version,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object('homeId', p_home_id, 'homeRevision', next_revision);
end;
$$;

create or replace function public.join_home_by_invite_code(
  p_user_id uuid,
  p_invite_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  home_record public.homes%rowtype;
  membership_record public.home_members%rowtype;
  actor_name text;
  normalized_code text := upper(trim(p_invite_code));
  already_member boolean := false;
  next_revision bigint;
begin
  if normalized_code is null or normalized_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'INVALID_INVITE_CODE' using errcode = '22023';
  end if;
  select display_name into actor_name
  from public.app_users
  where id = p_user_id and status = 'active'
  for share;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into home_record
  from public.homes
  where invite_code = normalized_code
    and status = 'active'
  for update;
  if not found then
    raise exception 'HOME_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into membership_record
  from public.home_members
  where home_id = home_record.id and user_id = p_user_id
  for update;
  if found and membership_record.status = 'active' then
    already_member := true;
    next_revision := home_record.sync_revision;
  elsif found and membership_record.status = 'left' then
    update public.home_members
    set status = 'active',
        role = 'member',
        display_name_snapshot = coalesce(nullif(actor_name, ''), '구성원'),
        ended_at = null,
        joined_at = now(),
        updated_at = now()
    where id = membership_record.id
    returning * into membership_record;
  elsif found then
    raise exception 'MEMBERSHIP_REMOVED' using errcode = '42501';
  else
    insert into public.home_members (
      id, home_id, user_id, role, status, display_name_snapshot, joined_at, updated_at
    ) values (
      'member-' || gen_random_uuid()::text,
      home_record.id,
      p_user_id,
      'member',
      'active',
      coalesce(nullif(actor_name, ''), '구성원'),
      now(),
      now()
    ) returning * into membership_record;
  end if;

  if not already_member then
    update public.homes
    set sync_revision = sync_revision + 1,
        updated_at = now()
    where id = home_record.id
    returning sync_revision into next_revision;
  end if;

  insert into public.user_settings (user_id, notifications, active_home_id, updated_at)
  values (p_user_id, '{"enabled": false, "reminderHour": 9}'::jsonb, home_record.id, now())
  on conflict (user_id) do update set
    active_home_id = excluded.active_home_id,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'homeId', home_record.id,
    'membershipId', membership_record.id,
    'alreadyMember', already_member,
    'homeRevision', next_revision
  );
end;
$$;

revoke all on function public.assign_chore_v2(uuid, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.update_chore_schedule_v2(uuid, text, text, jsonb, date, date, bigint) from public, anon, authenticated;
revoke all on function public.set_chore_enabled_v2(uuid, text, text, boolean, bigint) from public, anon, authenticated;
revoke all on function public.create_home_v2(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.update_home_v2(uuid, text, bigint, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.join_home_by_invite_code(uuid, text) from public, anon, authenticated;
grant execute on function public.assign_chore_v2(uuid, text, text, text, bigint) to service_role;
grant execute on function public.update_chore_schedule_v2(uuid, text, text, jsonb, date, date, bigint) to service_role;
grant execute on function public.set_chore_enabled_v2(uuid, text, text, boolean, bigint) to service_role;
grant execute on function public.create_home_v2(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.update_home_v2(uuid, text, bigint, text, text, text, jsonb) to service_role;
grant execute on function public.join_home_by_invite_code(uuid, text) to service_role;

comment on function public.assign_chore_v2(uuid, text, text, text, bigint)
  is 'Assigns a chore to one active membership in the same home, or clears the assignee.';
comment on function public.update_chore_schedule_v2(uuid, text, text, jsonb, date, date, bigint)
  is 'Updates one chore schedule behind membership authorization and home revision CAS.';
comment on function public.set_chore_enabled_v2(uuid, text, text, boolean, bigint)
  is 'Enables or disables one chore behind membership authorization and home revision CAS.';
comment on function public.create_home_v2(uuid, text, text, text, jsonb)
  is 'Creates a home and its owner membership atomically with server-generated identifiers.';
comment on function public.update_home_v2(uuid, text, bigint, text, text, text, jsonb)
  is 'Owner-only CAS update for home metadata and profile.';
comment on function public.join_home_by_invite_code(uuid, text)
  is 'Atomically joins or reactivates one membership using the legacy six-character invite code.';

-- Harden the legacy snapshot writer. Home snapshots still work, but completion
-- facts are append-only: same-day undo changes status to voided instead of
-- deleting a row, and an existing row is never rewritten. The active-occurrence
-- unique index makes concurrent legacy/new completion calls converge on one row.
create or replace function public.save_home_snapshot(
  p_user_id uuid,
  p_client_user_id text,
  p_home jsonb,
  p_expected_revision bigint default 0
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_home_id text := p_home->>'id';
  v_current_revision bigint;
  v_next_revision bigint;
  v_actor_name text;
  v_actor_membership_id text;
  v_actor_role text;
  v_home_timezone text;
  v_home_status text;
begin
  if v_home_id is null or length(v_home_id) < 3 or length(v_home_id) > 120 then
    raise exception 'INVALID_HOME' using errcode = '22023';
  end if;

  select display_name into v_actor_name
  from public.app_users
  where id = p_user_id and status = 'active'
  for share;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select sync_revision, timezone, status
  into v_current_revision, v_home_timezone, v_home_status
  from public.homes
  where id = v_home_id
  for update;

  if not found then
    if p_home->>'name' is null or length(trim(p_home->>'name')) not between 1 and 60 then
      raise exception 'INVALID_HOME_NAME' using errcode = '22023';
    end if;
    insert into public.homes (
      id, name, emoji, task_view_mode, assignment_mode, invite_code,
      timezone, created_by_user_id, status, created_at, updated_at, sync_revision
    ) values (
      v_home_id,
      trim(p_home->>'name'),
      coalesce(nullif(p_home->>'emoji', ''), '🏠'),
      coalesce(p_home->>'taskViewMode', 'todo'),
      coalesce(p_home->>'assignmentMode', 'shared'),
      p_home->>'inviteCode',
      'Asia/Seoul',
      p_user_id,
      'active',
      coalesce((p_home->>'createdAt')::timestamptz, now()),
      now(),
      0
    );
    v_actor_membership_id := 'member-' || gen_random_uuid()::text;
    insert into public.home_members (
      id, home_id, user_id, role, status, display_name_snapshot, joined_at, updated_at
    ) values (
      v_actor_membership_id, v_home_id, p_user_id, 'owner', 'active',
      coalesce(nullif(v_actor_name, ''), '나'), now(), now()
    );
    v_actor_role := 'owner';
    v_current_revision := 0;
    v_home_timezone := 'Asia/Seoul';
    v_home_status := 'active';
  else
    if v_home_status <> 'active' then
      raise exception 'HOME_NOT_ACTIVE' using errcode = '42501';
    end if;
    select id, role
    into v_actor_membership_id, v_actor_role
    from public.home_members
    where home_id = v_home_id
      and user_id = p_user_id
      and status = 'active'
    for update;
    if not found then
      raise exception 'HOME_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if v_current_revision <> coalesce(p_expected_revision, 0) then
    raise exception 'SYNC_CONFLICT' using errcode = '40001';
  end if;

  v_next_revision := v_current_revision + 1;
  if v_actor_role = 'owner' then
    update public.homes
    set name = trim(p_home->>'name'),
        emoji = coalesce(nullif(p_home->>'emoji', ''), '🏠'),
        task_view_mode = coalesce(p_home->>'taskViewMode', 'todo'),
        assignment_mode = coalesce(p_home->>'assignmentMode', 'shared'),
        updated_at = now(),
        sync_revision = v_next_revision
    where id = v_home_id;
  else
    update public.homes
    set updated_at = now(),
        sync_revision = v_next_revision
    where id = v_home_id;
  end if;

  if v_actor_role = 'owner' then
    perform public.assert_valid_home_profile_v2(p_home->'profile');
    if p_home->'profile' is null or p_home->'profile' = 'null'::jsonb then
      delete from public.home_profiles where home_id = v_home_id;
    else
      insert into public.home_profiles (
        home_id, profile, schema_version, updated_by_user_id, updated_at
      ) values (
        v_home_id, p_home->'profile', 1, p_user_id, now()
      )
      on conflict (home_id) do update set
        profile = excluded.profile,
        schema_version = excluded.schema_version,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at;
    end if;
  end if;

  insert into public.chores (
    home_id, id, title, category, recurrence, created_at,
    schedule_anchor_date, next_due_date, is_custom, enabled,
    assigned_member_id, executor_member_id, icon,
    notification_enabled, notification_time, updated_at
  )
  select
    v_home_id,
    item->>'id',
    item->>'title',
    item->>'category',
    item->'recurrence',
    (item->>'createdAt')::timestamptz,
    nullif(item->>'scheduleAnchorDate', '')::date,
    (item->>'nextDueDate')::date,
    coalesce((item->>'isCustom')::boolean, false),
    coalesce((item->>'enabled')::boolean, true),
    null,
    null,
    nullif(item->>'icon', ''),
    coalesce((item->>'notificationEnabled')::boolean, false),
    nullif(item->>'notificationTime', '')::time,
    now()
  from jsonb_array_elements(coalesce(p_home->'chores', '[]'::jsonb)) as item
  on conflict (home_id, id) do update set
    title = excluded.title,
    category = excluded.category,
    icon = excluded.icon,
    notification_enabled = excluded.notification_enabled,
    notification_time = excluded.notification_time,
    updated_at = excluded.updated_at;

  if v_actor_role = 'owner' then
    delete from public.chores as stored
    where stored.home_id = v_home_id
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_home->'chores', '[]'::jsonb)) as item
        where item->>'id' = stored.id
      );
  end if;

  -- Completion creation is intentionally absent here. The API adapter routes
  -- additions through complete_chore_once before saving this sanitized snapshot.

  -- AppData v2 only offers same-day undo. Preserve that behavior without
  -- physically deleting the completion audit row or touching another member's
  -- completion. New action APIs should use an explicit void RPC instead.
  update public.chore_history as stored
  set status = 'voided',
      voided_at = now(),
      voided_by_user_id = p_user_id,
      voided_by_name = coalesce(v_actor_name, '구성원'),
      void_reason = 'legacy_undo',
      updated_at = now()
  where stored.home_id = v_home_id
    and stored.performed_by_user_id = p_user_id
    and stored.action = 'completed'
    and stored.status = 'completed'
    and (stored.performed_at at time zone v_home_timezone)::date =
      (clock_timestamp() at time zone v_home_timezone)::date
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_home->'history', '[]'::jsonb)) as item
      where item->>'id' = stored.id
        and item->>'performedByUserId' in (p_client_user_id, p_user_id::text)
    );

  insert into public.labor_assessments (
    home_id, user_id, planning_score, execution_score, answers, updated_at
  )
  select
    v_home_id,
    p_user_id,
    (item->>'planningScore')::smallint,
    (item->>'executionScore')::smallint,
    item->'answers',
    coalesce((item->>'updatedAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_home->'laborAssessments', '[]'::jsonb)) as item
  where item->>'userId' in (p_client_user_id, p_user_id::text)
  on conflict (home_id, user_id) do update set
    planning_score = excluded.planning_score,
    execution_score = excluded.execution_score,
    answers = excluded.answers,
    updated_at = excluded.updated_at;

  insert into public.supply_items (
    home_id, id, name, unit, purchase_date, purchase_quantity,
    weekly_usage, safety_stock, reminder_days_before, updated_at
  )
  select
    v_home_id,
    item->>'id',
    item->>'name',
    item->>'unit',
    (item->>'purchaseDate')::date,
    (item->>'purchaseQuantity')::numeric,
    (item->>'weeklyUsage')::numeric,
    (item->>'safetyStock')::numeric,
    (item->>'reminderDaysBefore')::integer,
    coalesce((item->>'updatedAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_home->'supplies', '[]'::jsonb)) as item
  on conflict (home_id, id) do update set
    name = excluded.name,
    unit = excluded.unit,
    purchase_date = excluded.purchase_date,
    purchase_quantity = excluded.purchase_quantity,
    weekly_usage = excluded.weekly_usage,
    safety_stock = excluded.safety_stock,
    reminder_days_before = excluded.reminder_days_before,
    updated_at = excluded.updated_at;

  delete from public.supply_items as stored
  where stored.home_id = v_home_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_home->'supplies', '[]'::jsonb)) as item
      where item->>'id' = stored.id
    );

  insert into public.recommendation_preferences (
    home_id, template_id, status, reason, snoozed_until, updated_at
  )
  select
    v_home_id,
    item->>'templateId',
    item->>'status',
    nullif(item->>'reason', ''),
    nullif(item->>'snoozedUntil', '')::date,
    coalesce((item->>'updatedAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_home->'recommendationPreferences', '[]'::jsonb)) as item
  on conflict (home_id, template_id) do update set
    status = excluded.status,
    reason = excluded.reason,
    snoozed_until = excluded.snoozed_until,
    updated_at = excluded.updated_at;

  delete from public.recommendation_preferences as stored
  where stored.home_id = v_home_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_home->'recommendationPreferences', '[]'::jsonb)) as item
      where item->>'templateId' = stored.template_id
    );

  return v_next_revision;
end;
$$;

revoke all on function public.save_home_snapshot(uuid, text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_home_snapshot(uuid, text, jsonb, bigint) to service_role;

comment on function public.save_home_snapshot(uuid, text, jsonb, bigint)
  is 'Legacy CAS snapshot writer; completion facts are retained, voidable, and deduplicated by occurrence.';

-- The legacy AppData client still expresses one user gesture as a broad
-- snapshot plus several narrow mutations. Running those RPCs from the API one
-- by one could commit a prefix and then fail. This wrapper preserves the narrow
-- authorization/invariant checks while making the whole compatibility write a
-- single PostgreSQL transaction.
create or replace function public.apply_legacy_home_mutation_v2(
  p_user_id uuid,
  p_client_user_id text,
  p_home jsonb,
  p_expected_revision bigint,
  p_snapshot_required boolean,
  p_assignments jsonb,
  p_completions jsonb,
  p_schedules jsonb,
  p_enabled_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_home_id text := p_home->>'id';
  v_current_revision bigint;
  v_revision bigint;
  v_actor_membership_id text;
  v_mutation jsonb;
  v_result jsonb;
  v_assignee_membership_id text;
  v_anchor_date date;
begin
  if p_user_id is null
     or p_client_user_id is null
     or jsonb_typeof(p_home) is distinct from 'object'
     or v_home_id is null
     or length(v_home_id) not between 3 and 120
     or p_expected_revision is null
     or p_expected_revision < 0
     or p_snapshot_required is null
     or jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) is distinct from 'array'
     or jsonb_typeof(coalesce(p_completions, '[]'::jsonb)) is distinct from 'array'
     or jsonb_typeof(coalesce(p_schedules, '[]'::jsonb)) is distinct from 'array'
     or jsonb_typeof(coalesce(p_enabled_changes, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'INVALID_LEGACY_MUTATION' using errcode = '22023';
  end if;

  perform 1
  from public.app_users as users
  where users.id = p_user_id and users.status = 'active'
  for share;
  if not found then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;

  -- Every existing-home mutation begins with the same home -> membership lock
  -- order used by the child RPCs. This also gives completion-only writes the
  -- same initial CAS protection as the legacy snapshot endpoint.
  select home.sync_revision into v_current_revision
  from public.homes as home
  where home.id = v_home_id
    and home.status = 'active'
  for update;

  if found then
    select membership.id into v_actor_membership_id
    from public.home_members as membership
    join public.app_users as users on users.id = membership.user_id
    where membership.home_id = v_home_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
      and users.status = 'active'
    for update of membership;
    if not found then
      raise exception 'HOME_FORBIDDEN' using errcode = '42501';
    end if;
    if v_current_revision <> p_expected_revision then
      raise exception 'SYNC_CONFLICT' using errcode = '40001';
    end if;
  else
    if not p_snapshot_required then
      raise exception 'HOME_NOT_FOUND' using errcode = 'P0002';
    end if;
    if p_expected_revision <> 0 then
      raise exception 'SYNC_CONFLICT' using errcode = '40001';
    end if;
  end if;

  v_revision := p_expected_revision;
  if p_snapshot_required then
    v_revision := public.save_home_snapshot(
      p_user_id,
      p_client_user_id,
      p_home,
      v_revision
    );
  end if;

  for v_mutation in
    select value from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb))
  loop
    if jsonb_typeof(v_mutation) is distinct from 'object'
       or nullif(v_mutation->>'choreId', '') is null
       or (
         v_mutation ? 'assigneeMembershipId'
         and jsonb_typeof(v_mutation->'assigneeMembershipId') not in ('string', 'null')
       ) then
      raise exception 'INVALID_LEGACY_ASSIGNMENT' using errcode = '22023';
    end if;
    v_assignee_membership_id := case
      when jsonb_typeof(v_mutation->'assigneeMembershipId') = 'string'
        then nullif(v_mutation->>'assigneeMembershipId', '')
      else null
    end;
    v_result := public.assign_chore_v2(
      p_user_id,
      v_home_id,
      v_mutation->>'choreId',
      v_assignee_membership_id,
      v_revision
    );
    v_revision := (v_result->>'homeRevision')::bigint;
  end loop;

  for v_mutation in
    select value from jsonb_array_elements(coalesce(p_completions, '[]'::jsonb))
  loop
    if jsonb_typeof(v_mutation) is distinct from 'object'
       or nullif(v_mutation->>'choreId', '') is null
       or nullif(v_mutation->>'scheduledFor', '') is null
       or nullif(v_mutation->>'requestId', '') is null then
      raise exception 'INVALID_LEGACY_COMPLETION' using errcode = '22023';
    end if;
    v_result := public.complete_chore_once(
      p_user_id,
      v_home_id,
      v_mutation->>'choreId',
      (v_mutation->>'scheduledFor')::date,
      (v_mutation->>'requestId')::uuid
    );
    v_revision := (v_result->>'homeRevision')::bigint;
  end loop;

  for v_mutation in
    select value from jsonb_array_elements(coalesce(p_schedules, '[]'::jsonb))
  loop
    if jsonb_typeof(v_mutation) is distinct from 'object'
       or nullif(v_mutation->>'choreId', '') is null
       or jsonb_typeof(v_mutation->'recurrence') is distinct from 'object'
       or nullif(v_mutation->>'nextDueDate', '') is null
       or (
         v_mutation ? 'scheduleAnchorDate'
         and jsonb_typeof(v_mutation->'scheduleAnchorDate') not in ('string', 'null')
       ) then
      raise exception 'INVALID_LEGACY_SCHEDULE' using errcode = '22023';
    end if;
    v_anchor_date := case
      when jsonb_typeof(v_mutation->'scheduleAnchorDate') = 'string'
        then nullif(v_mutation->>'scheduleAnchorDate', '')::date
      else null
    end;
    v_result := public.update_chore_schedule_v2(
      p_user_id,
      v_home_id,
      v_mutation->>'choreId',
      v_mutation->'recurrence',
      v_anchor_date,
      (v_mutation->>'nextDueDate')::date,
      v_revision
    );
    v_revision := (v_result->>'homeRevision')::bigint;
  end loop;

  for v_mutation in
    select value from jsonb_array_elements(coalesce(p_enabled_changes, '[]'::jsonb))
  loop
    if jsonb_typeof(v_mutation) is distinct from 'object'
       or nullif(v_mutation->>'choreId', '') is null
       or jsonb_typeof(v_mutation->'enabled') is distinct from 'boolean' then
      raise exception 'INVALID_LEGACY_ENABLED_CHANGE' using errcode = '22023';
    end if;
    v_result := public.set_chore_enabled_v2(
      p_user_id,
      v_home_id,
      v_mutation->>'choreId',
      (v_mutation->>'enabled')::boolean,
      v_revision
    );
    v_revision := (v_result->>'homeRevision')::bigint;
  end loop;

  return jsonb_build_object('homeRevision', v_revision);
end;
$$;

revoke all on function public.apply_legacy_home_mutation_v2(
  uuid, text, jsonb, bigint, boolean, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_legacy_home_mutation_v2(
  uuid, text, jsonb, bigint, boolean, jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on function public.apply_legacy_home_mutation_v2(
  uuid, text, jsonb, bigint, boolean, jsonb, jsonb, jsonb, jsonb
) is 'Applies one legacy snapshot mutation plan atomically; any failed child action rolls the entire plan back.';

-- Shared-home completions must survive account deletion so another member
-- cannot complete the same occurrence again and the household audit remains
-- coherent. The personal user link is removed; immutable membership/name
-- snapshots are retained as shared-home records.
alter table public.chore_history
  alter column performed_by_user_id drop not null;

alter table public.chore_history
  drop constraint if exists chore_history_performed_by_user_id_fkey;

alter table public.chore_history
  add constraint chore_history_performed_by_user_id_fkey
  foreign key (performed_by_user_id)
  references public.app_users(id)
  on delete set null;

create or replace function public.delete_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_home_id text;
  current_membership_id text;
  current_membership_role text;
  next_owner_id text;
begin
  if not exists (select 1 from public.app_users where id = p_user_id) then
    return;
  end if;

  -- Stop new authorized actions before walking memberships. Each home and then
  -- its membership rows are locked in deterministic home_id order.
  update public.app_users
  set status = 'deleted', deleted_at = now(), updated_at = now()
  where id = p_user_id;

  loop
    select membership.home_id into current_home_id
    from public.home_members as membership
    where membership.user_id = p_user_id
    order by membership.home_id asc
    limit 1;
    exit when not found;

    perform 1
    from public.homes
    where id = current_home_id
    for update;
    if not found then
      delete from public.home_members
      where home_id = current_home_id and user_id = p_user_id;
      continue;
    end if;

    select membership.id, membership.role
    into current_membership_id, current_membership_role
    from public.home_members as membership
    where membership.home_id = current_home_id
      and membership.user_id = p_user_id
    for update;
    if not found then
      continue;
    end if;

    next_owner_id := null;
    if current_membership_role = 'owner' then
      -- Lock and revalidate the exact active successor while the home lock is
      -- held. A remover using the v2 lock order cannot invalidate this choice.
      select membership.id into next_owner_id
      from public.home_members as membership
      join public.app_users as users
        on users.id = membership.user_id
       and users.status = 'active'
      where membership.home_id = current_home_id
        and membership.user_id <> p_user_id
        and membership.status = 'active'
      order by case when membership.role = 'owner' then 0 else 1 end,
               membership.joined_at asc,
               membership.id asc
      limit 1
      for update of membership;

      if next_owner_id is null then
        delete from public.homes where id = current_home_id;
        continue;
      end if;

      if not exists (
        select 1
        from public.home_members
        where home_id = current_home_id
          and id = next_owner_id
          and status = 'active'
      ) then
        raise exception 'OWNER_TRANSFER_CONFLICT' using errcode = '40001';
      end if;

      update public.home_members
      set role = 'owner', updated_at = now()
      where home_id = current_home_id and id = next_owner_id;
    end if;

    update public.homes
    set sync_revision = sync_revision + 1, updated_at = now()
    where id = current_home_id;
    delete from public.home_members where id = current_membership_id;
  end loop;

  delete from public.app_users where id = p_user_id;
end;
$$;

revoke all on function public.delete_user_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_account(uuid) to service_role;

comment on function public.delete_user_account(uuid)
  is 'Deletes the personal account link, transfers shared homes, and retains membership/name completion snapshots as shared-home records.';
