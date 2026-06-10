ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100;
CREATE INDEX IF NOT EXISTS zones_priority_idx ON public.zones (priority DESC);