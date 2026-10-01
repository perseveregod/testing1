-- Community board: local events, RSVPs ("Going"), comment threads and flags.
-- Safe to run more than once. Only the server (service role) touches these
-- tables; row level security is on with no policies, so clients can't.

create table if not exists public.community_events (
  id text primary key,
  kind text not null check (kind in ('community_day', 'cleanup', 'meeting', 'market', 'sports', 'family', 'other')),
  title text not null check (length(title) between 1 and 80),
  description text not null default '' check (length(description) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz,
  place_name text not null check (length(place_name) between 1 and 80),
  latitude double precision not null,
  longitude double precision not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  going_count integer not null default 0,
  comment_count integer not null default 0,
  flag_count integer not null default 0,
  hidden boolean not null default false,
  is_demo boolean not null default false
);
create index if not exists community_events_upcoming_idx
  on public.community_events (starts_at) where not hidden;
create index if not exists community_events_creator_idx
  on public.community_events (created_by, created_at desc);

create table if not exists public.community_comments (
  id text primary key,
  event_id text not null references public.community_events(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  body text not null check (length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  flag_count integer not null default 0,
  hidden boolean not null default false,
  is_demo boolean not null default false
);
create index if not exists community_comments_event_idx
  on public.community_comments (event_id, created_at);
create index if not exists community_comments_user_idx
  on public.community_comments (user_id, created_at desc);

create table if not exists public.community_rsvps (
  event_id text not null references public.community_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists community_rsvps_user_idx on public.community_rsvps (user_id);

create table if not exists public.community_flags (
  target_kind text not null check (target_kind in ('event', 'comment')),
  target_id text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (target_kind, target_id, user_id)
);

-- Counters are owned by triggers so concurrent requests can't drift them.
create or replace function public.community_rsvp_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.community_events set going_count = going_count + 1 where id = new.event_id;
  else
    update public.community_events set going_count = greatest(0, going_count - 1) where id = old.event_id;
  end if;
  return null;
end $$;
drop trigger if exists community_rsvps_count on public.community_rsvps;
create trigger community_rsvps_count after insert or delete on public.community_rsvps
  for each row execute function public.community_rsvp_count();

create or replace function public.community_comment_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' and not new.hidden then
    update public.community_events set comment_count = comment_count + 1 where id = new.event_id;
  elsif tg_op = 'UPDATE' and new.hidden and not old.hidden then
    update public.community_events set comment_count = greatest(0, comment_count - 1) where id = new.event_id;
  end if;
  return null;
end $$;
drop trigger if exists community_comments_count on public.community_comments;
create trigger community_comments_count after insert or update of hidden on public.community_comments
  for each row execute function public.community_comment_count();

create or replace function public.community_flag_count() returns trigger
language plpgsql as $$
begin
  if new.target_kind = 'event' then
    update public.community_events set flag_count = flag_count + 1 where id = new.target_id;
  else
    update public.community_comments set flag_count = flag_count + 1 where id = new.target_id;
  end if;
  return null;
end $$;
drop trigger if exists community_flags_count on public.community_flags;
create trigger community_flags_count after insert on public.community_flags
  for each row execute function public.community_flag_count();

alter table public.community_events enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_rsvps enable row level security;
alter table public.community_flags enable row level security;
