-- One-off cleanup so stored data matches what the app tells people.
-- Safe to run more than once.

-- Saved places are kept to about a block (3 decimals), never the exact spot.
update public.saved_locations
set latitude = round(latitude::numeric, 3)::double precision,
    longitude = round(longitude::numeric, 3)::double precision
where latitude <> round(latitude::numeric, 3)::double precision
   or longitude <> round(longitude::numeric, 3)::double precision;

-- The near-me point exists only while near-me alerts are in effect.
update public.users u
set last_lat = null, last_lng = null, last_location_at = null
where u.last_lat is not null
  and not exists (
    select 1 from public.alert_preferences ap
    where ap.user_id = u.id and ap.enabled and ap.near_me
  );
