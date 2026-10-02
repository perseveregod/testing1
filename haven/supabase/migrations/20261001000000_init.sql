-- Haven: initial schema.
--
-- Access model: the Next.js server talks to Postgres with the service-role key
-- and enforces every rule (auth, plan limits, moderation). Row Level Security
-- is enabled on every table with no policies for anon/authenticated, so the
-- public Supabase API exposes nothing even if the anon key leaks.
--
-- Geo queries use cube + earthdistance (available on Supabase and stock
-- Postgres) with GiST indexes. Swapping to PostGIS later only touches the
-- indexes and the two functions at the bottom.

create extension if not exists cube;
create extension if not exists earthdistance;

-- users -----------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,               -- Supabase auth.users id once an email is verified
  email text unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  -- ~1 km precision, kept only while "alerts near me" is on
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz
);

create index if not exists users_last_location_gist
  on public.users using gist (ll_to_earth(last_lat, last_lng))
  where last_lat is not null and last_lng is not null;

-- entitlements (one-time purchases; never subscriptions) ------------------------
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null check (plan in ('lifetime')),
  source text not null check (source in ('stripe', 'test', 'admin')),
  external_ref text not null unique,        -- Stripe checkout session id: makes webhooks idempotent
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null,
  granted_at timestamptz not null default now()
);
create index if not exists entitlements_user_idx on public.entitlements (user_id);

-- data sources ----------------------------------------------------------------
create table if not exists public.data_sources (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('user', 'demo', 'open_data', 'weather')),
  attribution text not null,
  url text,
  enabled boolean not null default true,
  last_synced_at timestamptz
);

-- incidents -------------------------------------------------------------------
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'police', 'fire', 'medical', 'traffic_accident', 'road_hazard',
    'suspicious', 'severe_weather', 'public_safety', 'other')),
  title text not null,
  description text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  approximate_address text not null default '',
  severity text not null check (severity in ('low', 'moderate', 'high', 'critical')),
  status text not null check (status in ('active', 'contained', 'resolved', 'under_review')),
  source_id text not null references public.data_sources(id),
  external_id text,
  reporter_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmation_count integer not null default 0,
  ended_count integer not null default 0,
  flag_count integer not null default 0,
  merged_into_id uuid references public.incidents(id) on delete set null,
  unique (source_id, external_id)
);

create index if not exists incidents_geo_gist
  on public.incidents using gist (ll_to_earth(latitude, longitude))
  where merged_into_id is null;
create index if not exists incidents_updated_idx on public.incidents (updated_at desc);
create index if not exists incidents_category_updated_idx on public.incidents (category, updated_at desc);
create index if not exists incidents_reporter_idx on public.incidents (reporter_id);

create table if not exists public.incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  kind text not null check (kind in (
    'created', 'additional_report', 'info', 'status_change', 'severity_change', 'source_update')),
  body text not null,
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists incident_updates_incident_idx on public.incident_updates (incident_id, created_at);

create table if not exists public.incident_confirmations (
  incident_id uuid not null references public.incidents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('confirm', 'ended')),
  created_at timestamptz not null default now(),
  primary key (incident_id, user_id, kind)
);

create table if not exists public.incident_flags (
  incident_id uuid not null references public.incidents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reason text not null check (reason in ('false', 'duplicate', 'personal_info', 'offensive', 'other')),
  created_at timestamptz not null default now(),
  primary key (incident_id, user_id)
);

-- Raw submissions. Several reports can point at one incident (dedupe/merge).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  category text not null,
  latitude double precision not null,
  longitude double precision not null,
  description text not null default '',
  client_request_id text,
  merged boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);
create index if not exists reports_user_created_idx on public.reports (user_id, created_at desc);
create index if not exists reports_incident_idx on public.reports (incident_id);

-- saved places + alerts --------------------------------------------------------
create table if not exists public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('home', 'work', 'school', 'family', 'custom')),
  label text not null,
  latitude double precision not null,
  longitude double precision not null,
  address text not null default '',
  alerts_enabled boolean not null default true,
  -- Lifetime: per-place overrides of the account-wide alert rules
  radius_mi double precision,
  categories text[],
  created_at timestamptz not null default now()
);
create index if not exists saved_locations_user_idx on public.saved_locations (user_id);
create index if not exists saved_locations_geo_gist
  on public.saved_locations using gist (ll_to_earth(latitude, longitude))
  where alerts_enabled;

create table if not exists public.alert_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  enabled boolean not null default true,
  radius_mi double precision not null default 3,
  categories text[] not null default '{}',
  saved_place_alerts boolean not null default true,
  critical_only boolean not null default false,
  quiet_hours_start text,
  quiet_hours_end text,
  time_zone text,
  near_me boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null,
  severity text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, incident_id)
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- counters ----------------------------------------------------------------------
create or replace function public.bump_incident_vote() returns trigger
language plpgsql as $$
begin
  if new.kind = 'confirm' then
    update public.incidents set confirmation_count = confirmation_count + 1 where id = new.incident_id;
  else
    update public.incidents set ended_count = ended_count + 1 where id = new.incident_id;
  end if;
  return new;
end $$;

drop trigger if exists incident_confirmations_count on public.incident_confirmations;
create trigger incident_confirmations_count after insert on public.incident_confirmations
  for each row execute function public.bump_incident_vote();

create or replace function public.bump_incident_flag() returns trigger
language plpgsql as $$
begin
  update public.incidents set flag_count = flag_count + 1 where id = new.incident_id;
  return new;
end $$;

drop trigger if exists incident_flags_count on public.incident_flags;
create trigger incident_flags_count after insert on public.incident_flags
  for each row execute function public.bump_incident_flag();

-- geo queries -------------------------------------------------------------------
create or replace function public.incidents_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision,
  p_since timestamptz,
  p_categories text[] default null,
  p_limit integer default 200
) returns setof public.incidents
language sql stable as $$
  select i.*
  from public.incidents i
  where i.merged_into_id is null
    and i.updated_at >= p_since
    and earth_box(ll_to_earth(p_lat, p_lng), p_radius_m) @> ll_to_earth(i.latitude, i.longitude)
    and earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(i.latitude, i.longitude)) <= p_radius_m
    and (p_categories is null or cardinality(p_categories) = 0 or i.category = any(p_categories))
  order by i.updated_at desc
  limit least(greatest(p_limit, 1), 500);
$$;

-- Users who might want an alert for an incident at (lat, lng). The caller
-- applies each user's own radius and category rules.
create or replace function public.alert_user_candidates(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision
) returns table (
  user_id uuid,
  last_lat double precision,
  last_lng double precision,
  prefs jsonb,
  plan text
)
language sql stable as $$
  select u.id, u.last_lat, u.last_lng, to_jsonb(ap.*),
         coalesce((select e.plan from public.entitlements e where e.user_id = u.id limit 1), 'free')
  from public.alert_preferences ap
  join public.users u on u.id = ap.user_id
  where ap.enabled and ap.near_me
    and u.last_lat is not null and u.last_lng is not null
    and earth_box(ll_to_earth(p_lat, p_lng), p_radius_m) @> ll_to_earth(u.last_lat, u.last_lng);
$$;

create or replace function public.alert_place_candidates(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision
) returns setof public.saved_locations
language sql stable as $$
  select s.*
  from public.saved_locations s
  where s.alerts_enabled
    and earth_box(ll_to_earth(p_lat, p_lng), p_radius_m) @> ll_to_earth(s.latitude, s.longitude);
$$;

-- lock everything down to the service role ------------------------------------------
alter table public.users enable row level security;
alter table public.entitlements enable row level security;
alter table public.data_sources enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_updates enable row level security;
alter table public.incident_confirmations enable row level security;
alter table public.incident_flags enable row level security;
alter table public.reports enable row level security;
alter table public.saved_locations enable row level security;
alter table public.alert_preferences enable row level security;
alter table public.notifications enable row level security;
