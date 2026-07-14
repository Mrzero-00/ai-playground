create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key,
  user_type text not null default 'anonymous' check (user_type in ('anonymous', 'toss')),
  display_name text not null default '나',
  toss_user_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homes (
  id text primary key,
  name text not null,
  emoji text not null default '🏠',
  task_view_mode text not null default 'todo' check (task_view_mode in ('todo', 'quest')),
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_members (
  id text primary key,
  home_id text not null references public.homes(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (home_id, user_id)
);

create table if not exists public.home_profiles (
  home_id text primary key references public.homes(id) on delete cascade,
  profile jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.chores (
  home_id text not null references public.homes(id) on delete cascade,
  id text not null,
  title text not null,
  category text not null,
  recurrence jsonb not null,
  created_at timestamptz not null,
  schedule_anchor_date date,
  next_due_date date not null,
  is_custom boolean not null default false,
  enabled boolean not null default true,
  assigned_member_id text,
  updated_at timestamptz not null default now(),
  primary key (home_id, id)
);

create table if not exists public.chore_history (
  home_id text not null references public.homes(id) on delete cascade,
  id text not null,
  chore_id text not null,
  chore_title text not null,
  action text not null check (action in ('completed', 'skipped')),
  performed_at timestamptz not null,
  scheduled_for date,
  performed_by_user_id uuid not null references public.app_users(id),
  performed_by_name text not null,
  primary key (home_id, id)
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  notifications jsonb not null default '{"enabled": false, "reminderHour": 9}'::jsonb,
  active_home_id text references public.homes(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists home_members_user_id_idx on public.home_members(user_id);
create index if not exists home_members_home_id_idx on public.home_members(home_id);
create index if not exists chores_home_due_idx on public.chores(home_id, next_due_date);
create index if not exists chore_history_home_performed_idx on public.chore_history(home_id, performed_at desc);
create index if not exists chore_history_user_idx on public.chore_history(performed_by_user_id, performed_at desc);

alter table public.app_users enable row level security;
alter table public.homes enable row level security;
alter table public.home_members enable row level security;
alter table public.home_profiles enable row level security;
alter table public.chores enable row level security;
alter table public.chore_history enable row level security;
alter table public.user_settings enable row level security;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.homes from anon, authenticated;
revoke all on table public.home_members from anon, authenticated;
revoke all on table public.home_profiles from anon, authenticated;
revoke all on table public.chores from anon, authenticated;
revoke all on table public.chore_history from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;

comment on table public.app_users is 'Anonymous test users; later linked to Toss user keys.';
comment on table public.home_members is 'Authorization boundary between users and shared homes.';
