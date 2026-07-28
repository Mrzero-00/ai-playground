alter table public.homes
  add column if not exists sync_revision bigint not null default 0;

alter table public.chores
  add column if not exists icon text,
  add column if not exists notification_enabled boolean not null default false,
  add column if not exists notification_time time;

create table if not exists public.recommendation_preferences (
  home_id text not null references public.homes(id) on delete cascade,
  template_id text not null,
  status text not null check (status in ('active', 'dismissed', 'snoozed')),
  reason text check (reason in ('not-applicable', 'duplicate', 'not-now')),
  snoozed_until date,
  updated_at timestamptz not null default now(),
  primary key (home_id, template_id)
);

create index if not exists recommendation_preferences_home_idx
  on public.recommendation_preferences(home_id);

alter table public.recommendation_preferences enable row level security;
revoke all on table public.recommendation_preferences from anon, authenticated;

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
begin
  if v_home_id is null or length(v_home_id) < 3 or length(v_home_id) > 120 then
    raise exception 'INVALID_HOME';
  end if;

  select display_name into v_actor_name
  from public.app_users
  where id = p_user_id;

  select sync_revision into v_current_revision
  from public.homes
  where id = v_home_id
  for update;

  if not found then
    insert into public.homes (
      id, name, emoji, task_view_mode, assignment_mode, invite_code,
      created_at, updated_at, sync_revision
    ) values (
      v_home_id,
      p_home->>'name',
      coalesce(nullif(p_home->>'emoji', ''), '🏠'),
      coalesce(p_home->>'taskViewMode', 'todo'),
      coalesce(p_home->>'assignmentMode', 'shared'),
      p_home->>'inviteCode',
      coalesce((p_home->>'createdAt')::timestamptz, now()),
      now(),
      0
    );
    insert into public.home_members (id, home_id, user_id, role, joined_at)
    values ('member-' || gen_random_uuid()::text, v_home_id, p_user_id, 'owner', now())
    on conflict (home_id, user_id) do nothing;
    v_current_revision := 0;
  elsif not exists (
    select 1 from public.home_members
    where home_id = v_home_id and user_id = p_user_id
  ) then
    raise exception 'HOME_FORBIDDEN' using errcode = '42501';
  end if;

  if v_current_revision <> coalesce(p_expected_revision, 0) then
    raise exception 'SYNC_CONFLICT' using errcode = '40001';
  end if;

  v_next_revision := v_current_revision + 1;
  update public.homes set
    name = p_home->>'name',
    emoji = coalesce(nullif(p_home->>'emoji', ''), '🏠'),
    task_view_mode = coalesce(p_home->>'taskViewMode', 'todo'),
    assignment_mode = coalesce(p_home->>'assignmentMode', 'shared'),
    updated_at = now(),
    sync_revision = v_next_revision
  where id = v_home_id;

  if p_home->'profile' is null or p_home->'profile' = 'null'::jsonb then
    delete from public.home_profiles where home_id = v_home_id;
  else
    insert into public.home_profiles (home_id, profile, updated_at)
    values (v_home_id, p_home->'profile', now())
    on conflict (home_id) do update set
      profile = excluded.profile,
      updated_at = excluded.updated_at;
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
    nullif(item->>'assignedMemberId', ''),
    nullif(item->>'executorMemberId', ''),
    nullif(item->>'icon', ''),
    coalesce((item->>'notificationEnabled')::boolean, false),
    nullif(item->>'notificationTime', '')::time,
    now()
  from jsonb_array_elements(coalesce(p_home->'chores', '[]'::jsonb)) as item
  on conflict (home_id, id) do update set
    title = excluded.title,
    category = excluded.category,
    recurrence = excluded.recurrence,
    schedule_anchor_date = excluded.schedule_anchor_date,
    next_due_date = excluded.next_due_date,
    is_custom = excluded.is_custom,
    enabled = excluded.enabled,
    assigned_member_id = excluded.assigned_member_id,
    executor_member_id = excluded.executor_member_id,
    icon = excluded.icon,
    notification_enabled = excluded.notification_enabled,
    notification_time = excluded.notification_time,
    updated_at = excluded.updated_at;

  delete from public.chores as stored
  where stored.home_id = v_home_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_home->'chores', '[]'::jsonb)) as item
      where item->>'id' = stored.id
    );

  insert into public.chore_history (
    home_id, id, chore_id, chore_title, action, performed_at,
    scheduled_for, performed_by_user_id, performed_by_name
  )
  select
    v_home_id,
    item->>'id',
    item->>'choreId',
    item->>'choreTitle',
    item->>'action',
    (item->>'performedAt')::timestamptz,
    nullif(item->>'scheduledFor', '')::date,
    p_user_id,
    coalesce(v_actor_name, '구성원')
  from jsonb_array_elements(coalesce(p_home->'history', '[]'::jsonb)) as item
  where item->>'performedByUserId' in (p_client_user_id, p_user_id::text)
  on conflict (home_id, id) do update set
    chore_title = excluded.chore_title,
    action = excluded.action,
    performed_at = excluded.performed_at,
    scheduled_for = excluded.scheduled_for,
    performed_by_name = excluded.performed_by_name;

  delete from public.chore_history as stored
  where stored.home_id = v_home_id
    and stored.performed_by_user_id = p_user_id
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
  is 'Atomically writes one authorized home snapshot and rejects stale revisions.';
