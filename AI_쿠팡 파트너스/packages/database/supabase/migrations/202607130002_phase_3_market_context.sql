create table if not exists public.market_contexts (
  id uuid primary key default gen_random_uuid(), market text not null, context_date date not null,
  season text, weather_summary jsonb not null default '[]'::jsonb, trend_keywords jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb, ai_summary jsonb, raw_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(market, context_date)
);
drop trigger if exists market_contexts_set_updated_at on public.market_contexts;
create trigger market_contexts_set_updated_at before update on public.market_contexts for each row execute function public.set_updated_at();
alter table public.market_contexts enable row level security;
