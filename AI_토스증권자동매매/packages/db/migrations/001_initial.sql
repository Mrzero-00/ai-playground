create extension if not exists pgcrypto;
create table strategy_versions (
  id uuid primary key default gen_random_uuid(), name text not null, strategy_type text not null,
  version integer not null, config jsonb not null, status text not null default 'draft', created_at timestamptz not null default now(),
  unique(name, version)
);
create table signals (
  id uuid primary key default gen_random_uuid(), strategy_version_id uuid references strategy_versions(id),
  symbol text not null, strategy_type text not null, status text not null, observed_at timestamptz not null, created_at timestamptz not null default now()
);
create table signal_features (
  id uuid primary key default gen_random_uuid(), signal_id uuid not null references signals(id) on delete cascade,
  features jsonb not null, observed_at timestamptz not null, created_at timestamptz not null default now()
);
create table trades (
  id uuid primary key default gen_random_uuid(), strategy_version_id uuid not null references strategy_versions(id), symbol text not null,
  strategy_type text not null, signal_at timestamptz not null, entry_at timestamptz, exit_at timestamptz,
  planned_entry_min numeric, planned_entry_max numeric, actual_entry_price numeric, actual_exit_price numeric, quantity integer not null check(quantity > 0),
  stop_loss numeric, target_1 numeric, target_2 numeric, pnl_amount numeric, pnl_percent numeric, mfe_percent numeric, mae_percent numeric,
  slippage_percent numeric, exit_reason text, created_at timestamptz not null default now()
);
insert into strategy_versions (id, name, strategy_type, version, config, status)
values ('00000000-0000-0000-0000-000000000001', 'dopamine', 'dopamine', 1,
  '{"minCatalystScore":9,"minRelativeVolume":5,"maxSpreadPercent":2,"maxPremarketGapPercent":80,"maxRiskPerTradePercent":0.5}', 'paper');
create index signals_symbol_observed_at_idx on signals(symbol, observed_at desc);
create index trades_symbol_signal_at_idx on trades(symbol, signal_at desc);
alter table strategy_versions enable row level security;
alter table signals enable row level security;
alter table signal_features enable row level security;
alter table trades enable row level security;
