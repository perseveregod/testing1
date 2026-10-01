-- Allow "missing_pet" incidents (lost and found pets).
alter table public.incidents drop constraint if exists incidents_category_check;
alter table public.incidents add constraint incidents_category_check check (category in (
  'police', 'fire', 'medical', 'traffic_accident', 'road_hazard',
  'suspicious', 'severe_weather', 'public_safety', 'missing_pet', 'other'));
