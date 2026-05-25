
DO $$ BEGIN CREATE TYPE public.order_status AS ENUM ('draft','confirmed','in_production','ready','delivered','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.batch_status AS ENUM ('planned','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.movement_type AS ENUM ('in','out','adjust','production','sale','transfer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq START 1000;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number integer NOT NULL DEFAULT nextval('public.orders_order_number_seq'),
  customer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  status public.order_status NOT NULL DEFAULT 'draft',
  delivery_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders admin ops all" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));
CREATE POLICY "orders sellers view own" ON public.orders FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));
CREATE POLICY "orders sellers insert own" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() AND public.has_role(auth.uid(),'seller'));
CREATE POLICY "orders sellers update own" ON public.orders FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() AND public.has_role(auth.uid(),'seller'));
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items select" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
    AND (o.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))));
CREATE POLICY "order_items insert" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
    AND (o.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))));
CREATE POLICY "order_items update" ON public.order_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
    AND (o.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))));
CREATE POLICY "order_items delete" ON public.order_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
    AND (o.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))));

CREATE OR REPLACE FUNCTION public.recalc_order_totals(_order_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE st numeric;
BEGIN
  SELECT COALESCE(SUM(line_total),0) INTO st FROM public.order_items WHERE order_id = _order_id;
  UPDATE public.orders SET subtotal = st, total = st + tax, updated_at = now() WHERE id = _order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_order_items_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN PERFORM public.recalc_order_totals(COALESCE(NEW.order_id, OLD.order_id));
  RETURN COALESCE(NEW, OLD); END; $$;

CREATE TRIGGER order_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_recalc();

CREATE SEQUENCE IF NOT EXISTS public.production_batch_number_seq START 1;
CREATE TABLE public.production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number integer NOT NULL DEFAULT nextval('public.production_batch_number_seq'),
  product_id uuid NOT NULL,
  planned_quantity numeric NOT NULL CHECK (planned_quantity > 0),
  produced_quantity numeric NOT NULL DEFAULT 0 CHECK (produced_quantity >= 0),
  status public.batch_status NOT NULL DEFAULT 'planned',
  scheduled_for date,
  started_at timestamptz,
  completed_at timestamptz,
  unit_cost numeric NOT NULL DEFAULT 0,
  responsible_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches readable" ON public.production_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batches manage" ON public.production_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));
CREATE TRIGGER batches_touch BEFORE UPDATE ON public.production_batches FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouses readable" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "warehouses manage" ON public.warehouses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  max_stock numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, warehouse_id)
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory readable" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory manage" ON public.inventory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));
CREATE TRIGGER inventory_touch BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  type public.movement_type NOT NULL,
  quantity numeric NOT NULL CHECK (quantity <> 0),
  unit_cost numeric NOT NULL DEFAULT 0,
  reference text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements readable" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "movements insert" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

CREATE OR REPLACE FUNCTION public.tg_apply_movement()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE delta numeric;
BEGIN
  IF NEW.type IN ('in','production') THEN delta := NEW.quantity;
  ELSIF NEW.type IN ('out','sale','transfer') THEN delta := -NEW.quantity;
  ELSE delta := NEW.quantity;
  END IF;
  INSERT INTO public.inventory(product_id, warehouse_id, quantity)
  VALUES (NEW.product_id, NEW.warehouse_id, delta)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity = public.inventory.quantity + delta, updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER movements_apply AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_movement();

CREATE INDEX idx_movements_product ON public.inventory_movements(product_id, created_at DESC);
CREATE INDEX idx_orders_seller ON public.orders(seller_id, created_at DESC);
CREATE INDEX idx_orders_customer ON public.orders(customer_id, created_at DESC);
