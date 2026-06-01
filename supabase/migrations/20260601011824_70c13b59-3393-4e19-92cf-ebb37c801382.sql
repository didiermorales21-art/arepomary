ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS delivery_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6]::integer[];