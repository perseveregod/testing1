-- Web Push subscriptions: one row per device. Only the server touches this
-- table (RLS on, no policies).

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
