create table if not exists public.content_reviews (
 id uuid primary key default gen_random_uuid(), content_id uuid not null references public.contents(id), decision text not null check (decision in ('APPROVED','REJECTED')), reason text, reviewed_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (decision <> 'REJECTED' or length(trim(reason)) > 0)
);
create index if not exists content_reviews_content_idx on public.content_reviews(content_id, created_at desc);
alter table public.content_reviews enable row level security;
