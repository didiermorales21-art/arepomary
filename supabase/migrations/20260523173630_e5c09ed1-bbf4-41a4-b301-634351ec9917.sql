
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','seller','production_operator','logistics_operator','customer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Auto-create profile + default 'customer' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''));
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Zones
CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones readable" ON public.zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage zones" ON public.zones FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Customers
CREATE TYPE public.customer_status AS ENUM ('active','inactive','prospect');
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  purchase_frequency text,
  status public.customer_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.customers(seller_id);
CREATE INDEX ON public.customers(zone_id);
CREATE TRIGGER customers_touch BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins all customers" ON public.customers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sellers view own customers" ON public.customers FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "sellers insert own customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid() AND public.has_role(auth.uid(),'seller'));
CREATE POLICY "sellers update own customers" ON public.customers FOR UPDATE TO authenticated USING (seller_id = auth.uid() AND public.has_role(auth.uid(),'seller'));

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unit',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products readable" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Product price history
CREATE TABLE public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price history readable" ON public.product_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write price history" ON public.product_price_history FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Sales
CREATE TYPE public.sale_status AS ENUM ('draft','confirmed','paid','cancelled');
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number serial UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid numeric(12,2) NOT NULL DEFAULT 0,
  balance numeric(12,2) GENERATED ALWAYS AS (total - paid) STORED,
  status public.sale_status NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.sales(seller_id);
CREATE INDEX ON public.sales(customer_id);
CREATE INDEX ON public.sales(status);
CREATE TRIGGER sales_touch BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins all sales" ON public.sales FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sellers view own sales" ON public.sales FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "sellers insert own sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid() AND public.has_role(auth.uid(),'seller'));
CREATE POLICY "sellers update own sales" ON public.sales FOR UPDATE TO authenticated USING (seller_id = auth.uid() AND public.has_role(auth.uid(),'seller'));

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  line_total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.sale_items(sale_id);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale items via sale access" ON public.sale_items FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "sale items insert by seller/admin" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS(SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "sale items update by seller/admin" ON public.sale_items FOR UPDATE TO authenticated USING (
  EXISTS(SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "sale items delete by seller/admin" ON public.sale_items FOR DELETE TO authenticated USING (
  EXISTS(SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);

-- Payments
CREATE TYPE public.payment_method AS ENUM ('cash','transfer','card','other');
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.payments(sale_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments via sale access" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "payments insert by seller/admin" ON public.payments FOR INSERT TO authenticated WITH CHECK (
  EXISTS(SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (s.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);

-- Trigger: keep sale totals in sync
CREATE OR REPLACE FUNCTION public.recalc_sale_totals(_sale_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE st numeric;
BEGIN
  SELECT COALESCE(SUM(line_total),0) INTO st FROM public.sale_items WHERE sale_id = _sale_id;
  UPDATE public.sales SET subtotal = st, total = st + tax, updated_at = now() WHERE id = _sale_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sale_items_recalc()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.recalc_sale_totals(COALESCE(NEW.sale_id, OLD.sale_id));
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER sale_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_sale_items_recalc();

CREATE OR REPLACE FUNCTION public.tg_payments_recalc()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p numeric;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO p FROM public.payments WHERE sale_id = COALESCE(NEW.sale_id, OLD.sale_id);
  UPDATE public.sales SET paid = p, status = CASE WHEN p >= total AND total > 0 THEN 'paid'::public.sale_status ELSE status END, updated_at = now()
    WHERE id = COALESCE(NEW.sale_id, OLD.sale_id);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER payments_recalc AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payments_recalc();

-- Seed zones + a couple of demo products
INSERT INTO public.zones(name, description) VALUES
  ('Norte','Zona norte de la ciudad'),
  ('Centro','Zona centro'),
  ('Sur','Zona sur'),
  ('Este','Zona este');

INSERT INTO public.products(sku, name, description, price, unit) VALUES
  ('AR-CLAS-500','Arepa Clásica 500g','Paquete de 5 unidades de arepa clásica', 8500, 'paquete'),
  ('AR-MAIZ-1KG','Arepa de Maíz 1kg','Paquete familiar de arepa de maíz amarillo', 15500, 'paquete'),
  ('AR-INTE-500','Arepa Integral 500g','Paquete de 5 unidades de arepa integral', 9500, 'paquete'),
  ('AR-MINI-300','Mini Arepas 300g','Bolsa de 12 mini arepas', 7000, 'bolsa');
