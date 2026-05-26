
-- Phase 3: Logistics + Customer Portal

CREATE TYPE public.shipment_status AS ENUM ('pending','in_transit','delivered','cancelled');

CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  license_plate text,
  vehicle text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers readable" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers manage" ON public.drivers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'));

CREATE SEQUENCE IF NOT EXISTS public.shipments_number_seq;

CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number integer NOT NULL DEFAULT nextval('public.shipments_number_seq'),
  order_id uuid,
  driver_id uuid,
  zone_id uuid,
  status shipment_status NOT NULL DEFAULT 'pending',
  scheduled_for date,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipments readable" ON public.shipments FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations') OR has_role(auth.uid(),'seller')
    OR EXISTS (SELECT 1 FROM public.orders o JOIN public.customers c ON c.id = o.customer_id
               WHERE o.id = shipments.order_id AND c.seller_id = auth.uid()));
CREATE POLICY "shipments manage" ON public.shipments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operations'));

CREATE TRIGGER tg_shipments_touch BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Customer portal: link auth users to customer records
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS portal_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_customers_portal_user ON public.customers(portal_user_id);

CREATE POLICY "customers portal self view" ON public.customers FOR SELECT TO authenticated
  USING (portal_user_id = auth.uid());

CREATE POLICY "orders portal self view" ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = orders.customer_id AND c.portal_user_id = auth.uid()));

CREATE POLICY "sales portal self view" ON public.sales FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = sales.customer_id AND c.portal_user_id = auth.uid()));
