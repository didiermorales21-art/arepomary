
CREATE TABLE IF NOT EXISTS public.collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  full_name text GENERATED ALWAYS AS (btrim(first_name || ' ' || COALESCE(last_name, ''))) STORED,
  document_id text UNIQUE,
  phone text,
  email text,
  cost_item_id uuid REFERENCES public.cost_items(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collaborators TO authenticated;
GRANT ALL ON public.collaborators TO service_role;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collaborators manage" ON public.collaborators;
CREATE POLICY "collaborators manage" ON public.collaborators
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));
DROP TRIGGER IF EXISTS collaborators_touch ON public.collaborators;
CREATE TRIGGER collaborators_touch BEFORE UPDATE ON public.collaborators
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS audit_collaborators ON public.collaborators;
CREATE TRIGGER audit_collaborators AFTER INSERT OR UPDATE OR DELETE ON public.collaborators
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS collaborator_id uuid
  REFERENCES public.collaborators(id) ON DELETE RESTRICT;
ALTER TABLE public.bills ALTER COLUMN supplier_id DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bills_supplier_or_collaborator_chk') THEN
    ALTER TABLE public.bills ADD CONSTRAINT bills_supplier_or_collaborator_chk
      CHECK (supplier_id IS NOT NULL OR collaborator_id IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  packages numeric NOT NULL DEFAULT 0,
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payments TO authenticated;
GRANT ALL ON public.commission_payments TO service_role;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commission_payments manage" ON public.commission_payments;
CREATE POLICY "commission_payments manage" ON public.commission_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

CREATE TABLE IF NOT EXISTS public.commission_payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.commission_payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  packages numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payment_items TO authenticated;
GRANT ALL ON public.commission_payment_items TO service_role;
ALTER TABLE public.commission_payment_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commission_payment_items manage" ON public.commission_payment_items;
CREATE POLICY "commission_payment_items manage" ON public.commission_payment_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

CREATE OR REPLACE FUNCTION public.seller_commission_summary(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE(seller_id uuid, seller_name text, packages numeric, commission numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH cfg AS (
    SELECT commission_standard_per_package AS s, commission_wholesale_per_package AS w
    FROM public.company_settings ORDER BY created_at LIMIT 1
  ),
  paid AS (
    SELECT i.id AS invoice_id, c.seller_id, c.customer_type, c.gives_commission, c.commission_per_package
    FROM public.invoices i
    JOIN public.customers c ON c.id = i.customer_id
    WHERE i.status = 'paid'
      AND (_from IS NULL OR i.issued_at >= _from)
      AND (_to   IS NULL OR i.issued_at <= _to)
      AND COALESCE(c.gives_commission, true) = true
      AND NOT EXISTS (SELECT 1 FROM public.commission_payment_items cpi WHERE cpi.invoice_id = i.id)
  ),
  lines AS (
    SELECT p.seller_id, p.customer_type, p.commission_per_package, p.invoice_id, SUM(ii.quantity) AS qty
    FROM paid p JOIN public.invoice_items ii ON ii.invoice_id = p.invoice_id
    GROUP BY p.seller_id, p.customer_type, p.commission_per_package, p.invoice_id
  )
  SELECT pr.id AS seller_id, pr.full_name AS seller_name,
    COALESCE(SUM(l.qty), 0) AS packages,
    COALESCE(SUM(l.qty * COALESCE(l.commission_per_package,
      CASE WHEN l.customer_type = 'wholesale' THEN (SELECT w FROM cfg) ELSE (SELECT s FROM cfg) END)), 0) AS commission
  FROM public.profiles pr
  LEFT JOIN lines l ON l.seller_id = pr.id
  WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = pr.id AND ur.role = 'seller')
  GROUP BY pr.id, pr.full_name
  ORDER BY 4 DESC;
$$;

CREATE OR REPLACE FUNCTION public.seller_pending_commission_invoices(_seller_id uuid)
RETURNS TABLE(invoice_id uuid, invoice_number int, issued_at date, customer_name text, packages numeric, rate numeric, amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH cfg AS (
    SELECT commission_standard_per_package AS s, commission_wholesale_per_package AS w
    FROM public.company_settings ORDER BY created_at LIMIT 1
  )
  SELECT i.id AS invoice_id, i.invoice_number, i.issued_at, c.name AS customer_name,
    COALESCE(SUM(ii.quantity),0) AS packages,
    COALESCE(c.commission_per_package,
      CASE WHEN c.customer_type='wholesale' THEN (SELECT w FROM cfg) ELSE (SELECT s FROM cfg) END) AS rate,
    COALESCE(SUM(ii.quantity),0) * COALESCE(c.commission_per_package,
      CASE WHEN c.customer_type='wholesale' THEN (SELECT w FROM cfg) ELSE (SELECT s FROM cfg) END) AS amount
  FROM public.invoices i
  JOIN public.customers c ON c.id = i.customer_id
  LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
  WHERE i.status='paid'
    AND c.seller_id = _seller_id
    AND COALESCE(c.gives_commission, true) = true
    AND NOT EXISTS (SELECT 1 FROM public.commission_payment_items cpi WHERE cpi.invoice_id = i.id)
  GROUP BY i.id, i.invoice_number, i.issued_at, c.name, c.commission_per_package, c.customer_type
  ORDER BY i.issued_at;
$$;

CREATE OR REPLACE FUNCTION public.pay_seller_commissions(_seller_id uuid, _method text, _password text, _reference text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment_id uuid;
  v_total numeric := 0;
  v_pkgs numeric := 0;
  rec record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'operations')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _password IS NULL OR _password <> 'D1031176597*' THEN RAISE EXCEPTION 'clave inválida'; END IF;

  FOR rec IN SELECT * FROM public.seller_pending_commission_invoices(_seller_id) LOOP
    v_total := v_total + rec.amount;
    v_pkgs  := v_pkgs  + rec.packages;
  END LOOP;
  IF v_total <= 0 THEN RAISE EXCEPTION 'No hay comisiones pendientes para este vendedor'; END IF;

  INSERT INTO public.commission_payments(seller_id, amount, method, packages, reference, recorded_by)
    VALUES (_seller_id, v_total, _method::payment_method, v_pkgs, NULLIF(_reference,''), v_uid)
    RETURNING id INTO v_payment_id;

  INSERT INTO public.commission_payment_items(payment_id, invoice_id, packages, amount)
  SELECT v_payment_id, invoice_id, packages, amount
  FROM public.seller_pending_commission_invoices(_seller_id);

  INSERT INTO public.cash_movements(amount, method, category, reason, reference, recorded_by)
    VALUES (v_total, _method::payment_method, 'commission'::cash_movement_category,
            'Pago comisión vendedor', NULLIF(_reference,''), v_uid);

  RETURN v_payment_id;
END $$;
