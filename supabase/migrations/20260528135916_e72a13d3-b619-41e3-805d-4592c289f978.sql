-- Enums
CREATE TYPE public.invoice_status AS ENUM ('draft','issued','paid','overdue','cancelled');
CREATE TYPE public.bill_status AS ENUM ('draft','received','paid','overdue','cancelled');

-- =========================================================
-- SUPPLIERS
-- =========================================================
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_id text,
  email text,
  phone text,
  address text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers readable" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers manage" ON public.suppliers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'));
CREATE TRIGGER suppliers_touch BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- INVOICES
-- =========================================================
CREATE SEQUENCE public.invoices_number_seq START 1000;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number integer NOT NULL DEFAULT nextval('public.invoices_number_seq'),
  sale_id uuid,
  customer_id uuid NOT NULL,
  issued_at date NOT NULL DEFAULT current_date,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  balance numeric GENERATED ALWAYS AS (total - paid) STORED,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices admin all" ON public.invoices FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'));
CREATE POLICY "invoices sellers view" ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = invoices.customer_id AND c.seller_id = auth.uid()));
CREATE POLICY "invoices portal view" ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = invoices.customer_id AND c.portal_user_id = auth.uid()));

CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Invoice items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_items via invoice" ON public.invoice_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations')
         OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = i.customer_id AND c.seller_id = auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'))));

-- Recalc invoice totals
CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st numeric;
BEGIN
  SELECT COALESCE(SUM(line_total),0) INTO st FROM public.invoice_items WHERE invoice_id = _invoice_id;
  UPDATE public.invoices SET subtotal = st, total = st + tax, updated_at = now() WHERE id = _invoice_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_invoice_items_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN PERFORM public.recalc_invoice_totals(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD); END; $$;

CREATE TRIGGER invoice_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_items_recalc();

-- Invoice payments (reusing payments table is complex; create dedicated)
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  amount numeric NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_payments via invoice" ON public.invoice_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_payments.invoice_id));
CREATE POLICY "invoice_payments insert" ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'));

CREATE OR REPLACE FUNCTION public.tg_invoice_payments_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p numeric; t numeric;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO p FROM public.invoice_payments WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT total INTO t FROM public.invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.invoices
    SET paid = p,
        status = CASE WHEN p >= t AND t > 0 THEN 'paid'::public.invoice_status ELSE status END,
        updated_at = now()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER invoice_payments_recalc AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_payments_recalc();

-- =========================================================
-- BILLS (Cuentas por pagar)
-- =========================================================
CREATE SEQUENCE public.bills_number_seq START 1000;

CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number integer NOT NULL DEFAULT nextval('public.bills_number_seq'),
  supplier_id uuid NOT NULL,
  issued_at date NOT NULL DEFAULT current_date,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  balance numeric GENERATED ALWAYS AS (total - paid) STORED,
  status public.bill_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bills manage" ON public.bills FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'));
CREATE TRIGGER bills_touch BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_items TO authenticated;
GRANT ALL ON public.bill_items TO service_role;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_items manage" ON public.bill_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'));

CREATE OR REPLACE FUNCTION public.recalc_bill_totals(_bill_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st numeric;
BEGIN
  SELECT COALESCE(SUM(line_total),0) INTO st FROM public.bill_items WHERE bill_id = _bill_id;
  UPDATE public.bills SET subtotal = st, total = st + tax, updated_at = now() WHERE id = _bill_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_bill_items_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN PERFORM public.recalc_bill_totals(COALESCE(NEW.bill_id, OLD.bill_id));
  RETURN COALESCE(NEW, OLD); END; $$;

CREATE TRIGGER bill_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.bill_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_bill_items_recalc();

CREATE TABLE public.bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL,
  amount numeric NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_payments TO authenticated;
GRANT ALL ON public.bill_payments TO service_role;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_payments manage" ON public.bill_payments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'));

CREATE OR REPLACE FUNCTION public.tg_bill_payments_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p numeric; t numeric;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO p FROM public.bill_payments WHERE bill_id = COALESCE(NEW.bill_id, OLD.bill_id);
  SELECT total INTO t FROM public.bills WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
  UPDATE public.bills
    SET paid = p,
        status = CASE WHEN p >= t AND t > 0 THEN 'paid'::public.bill_status ELSE status END,
        updated_at = now()
    WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER bill_payments_recalc AFTER INSERT OR UPDATE OR DELETE ON public.bill_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_bill_payments_recalc();