-- Storm Mode: power / flooding / open-place reports, plus optional photos.
-- Safe to run more than once. Also includes the missing_pet category in case
-- the previous migration wasn't applied.

alter table public.incidents drop constraint if exists incidents_category_check;
alter table public.incidents add constraint incidents_category_check check (category in (
  'police', 'fire', 'medical', 'traffic_accident', 'road_hazard',
  'suspicious', 'severe_weather', 'public_safety', 'missing_pet',
  'power', 'flooding', 'place', 'other'));

alter table public.incidents add column if not exists storm_state text
  check (storm_state in ('out', 'on', 'flooded', 'passable', 'open', 'closed'));
alter table public.incidents add column if not exists storm_place_type text
  check (storm_place_type in ('gas', 'grocery', 'laundromat', 'restaurant', 'cooling', 'charging'));
alter table public.incidents add column if not exists has_photo boolean not null default false;

-- Photos live apart from incidents so map and feed queries stay small.
create table if not exists public.incident_photos (
  incident_id uuid primary key references public.incidents(id) on delete cascade,
  data_url text not null check (length(data_url) < 400000),
  created_at timestamptz not null default now()
);
-- Only the server (service role) reads and writes photos.
alter table public.incident_photos enable row level security;

-- Storm queries look up recent reports by category.
create index if not exists incidents_storm_recent_idx
  on public.incidents (category, updated_at desc)
  where storm_state is not null;
