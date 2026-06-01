-- Add wholesale price to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS wholesale_price numeric NOT NULL DEFAULT 0;

-- Customer type enum
DO $$ BEGIN
  CREATE TYPE public.customer_type AS ENUM ('standard', 'wholesale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type public.customer_type NOT NULL DEFAULT 'standard';

-- Only admins can change customer_type. Sellers updating own customers should
-- not be able to escalate type. Add a trigger to enforce that.
CREATE OR REPLACE FUNCTION public.tg_guard_customer_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.customer_type IS DISTINCT FROM OLD.customer_type THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can change customer type';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.customer_type <> 'standard' THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can assign non-standard customer type';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_customer_type ON public.customers;
CREATE TRIGGER guard_customer_type
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_customer_type();