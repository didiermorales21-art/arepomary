
-- Add first_name / last_name to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name  text NOT NULL DEFAULT '';

-- Backfill from existing full_name (split on first space)
UPDATE public.profiles
SET first_name = COALESCE(NULLIF(split_part(full_name, ' ', 1), ''), ''),
    last_name  = COALESCE(NULLIF(regexp_replace(full_name, '^\S+\s*', ''), ''), '')
WHERE (first_name = '' AND last_name = '') AND full_name IS NOT NULL AND full_name <> '';

-- Sync trigger: keep full_name aligned with first_name + last_name (and vice versa)
CREATE OR REPLACE FUNCTION public.tg_sync_profile_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE composed text;
BEGIN
  -- If first/last provided, compose full_name
  IF COALESCE(NEW.first_name,'') <> '' OR COALESCE(NEW.last_name,'') <> '' THEN
    composed := btrim(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,''));
    NEW.full_name := composed;
  ELSIF COALESCE(NEW.full_name,'') <> '' THEN
    -- Only full_name provided: split
    NEW.first_name := COALESCE(NULLIF(split_part(NEW.full_name, ' ', 1), ''), '');
    NEW.last_name  := COALESCE(NULLIF(regexp_replace(NEW.full_name, '^\S+\s*', ''), ''), '');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_sync_profile_name ON public.profiles;
CREATE TRIGGER tg_sync_profile_name
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_profile_name();

-- Update handle_new_user to read first_name/last_name from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text := COALESCE(NEW.raw_user_meta_data->>'first_name','');
  v_last  text := COALESCE(NEW.raw_user_meta_data->>'last_name','');
  v_full  text := COALESCE(NEW.raw_user_meta_data->>'full_name','');
BEGIN
  IF v_first = '' AND v_last = '' AND v_full <> '' THEN
    v_first := COALESCE(NULLIF(split_part(v_full,' ',1),''),'');
    v_last  := COALESCE(NULLIF(regexp_replace(v_full,'^\S+\s*',''),''),'');
  END IF;
  INSERT INTO public.profiles(id, full_name, first_name, last_name)
  VALUES (NEW.id, btrim(v_first || ' ' || v_last), v_first, v_last);
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;

-- Add first_name / last_name to customers (nullable: customer may be a business)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;

-- Backfill
UPDATE public.customers
SET first_name = COALESCE(NULLIF(split_part(name,' ',1),''),''),
    last_name  = NULLIF(regexp_replace(name,'^\S+\s*',''),'')
WHERE first_name IS NULL AND name IS NOT NULL AND name <> '';

-- Sync trigger
CREATE OR REPLACE FUNCTION public.tg_sync_customer_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.first_name,'') <> '' OR COALESCE(NEW.last_name,'') <> '' THEN
    NEW.name := btrim(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,''));
  ELSIF COALESCE(NEW.name,'') <> '' THEN
    NEW.first_name := COALESCE(NULLIF(split_part(NEW.name,' ',1),''),'');
    NEW.last_name  := NULLIF(regexp_replace(NEW.name,'^\S+\s*',''),'');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_sync_customer_name ON public.customers;
CREATE TRIGGER tg_sync_customer_name
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_customer_name();
