-- Persist travel route details so invoice drafts can show
-- origin, destination and trip mode (one_way / round_trip).
ALTER TABLE public.services
  ADD COLUMN travel_origin TEXT,
  ADD COLUMN travel_destination TEXT,
  ADD COLUMN trip_mode TEXT CHECK (trip_mode IN ('one_way', 'round_trip'));
