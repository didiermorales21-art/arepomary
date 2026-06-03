
-- 1. Email on customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email text;

-- 2. Supplier linked to a cost input
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cost_item_id uuid REFERENCES public.cost_items(id) ON DELETE SET NULL;

-- 3. Inventory: reserved quantity (orders not yet delivered)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS reserved_quantity numeric NOT NULL DEFAULT 0;

-- Helper: default warehouse
CREATE OR REPLACE FUNCTION public.default_warehouse_id()
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM public.warehouses ORDER BY created_at LIMIT 1
$$;

-- Reserve/release stock when order items change
CREATE OR REPLACE FUNCTION public.tg_order_items_reserve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wh uuid;
  v_status order_status;
  v_avail numeric;
BEGIN
  v_wh := public.default_warehouse_id();
  IF v_wh IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_status FROM public.orders WHERE id = NEW.order_id;
    IF v_status IN ('cancelled','delivered') THEN RETURN NEW; END IF;
    SELECT COALESCE(quantity,0) - COALESCE(reserved_quantity,0) INTO v_avail
      FROM public.inventory WHERE product_id = NEW.product_id AND warehouse_id = v_wh;
    v_avail := COALESCE(v_avail, 0);
    IF v_avail < NEW.quantity THEN
      RAISE EXCEPTION 'Inventario insuficiente: solo % disponibles', v_avail;
    END IF;
    INSERT INTO public.inventory(product_id, warehouse_id, quantity, reserved_quantity)
      VALUES (NEW.product_id, v_wh, 0, NEW.quantity)
      ON CONFLICT (product_id, warehouse_id) DO UPDATE
      SET reserved_quantity = public.inventory.reserved_quantity + NEW.quantity, updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM public.orders WHERE id = OLD.order_id;
    IF v_status IN ('cancelled','delivered') THEN RETURN OLD; END IF;
    UPDATE public.inventory
      SET reserved_quantity = GREATEST(reserved_quantity - OLD.quantity, 0), updated_at = now()
      WHERE product_id = OLD.product_id AND warehouse_id = v_wh;
    RETURN OLD;
  ELSE
    UPDATE public.inventory
      SET reserved_quantity = GREATEST(reserved_quantity - OLD.quantity + NEW.quantity, 0), updated_at = now()
      WHERE product_id = NEW.product_id AND warehouse_id = v_wh;
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS order_items_reserve ON public.order_items;
CREATE TRIGGER order_items_reserve
AFTER INSERT OR DELETE OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_reserve();

-- Release reserve when order moves to cancelled/delivered
CREATE OR REPLACE FUNCTION public.tg_order_status_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wh uuid;
  rec record;
BEGIN
  v_wh := public.default_warehouse_id();
  IF v_wh IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IN ('cancelled','delivered') AND OLD.status NOT IN ('cancelled','delivered') THEN
    FOR rec IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      UPDATE public.inventory
        SET reserved_quantity = GREATEST(reserved_quantity - rec.quantity, 0), updated_at = now()
        WHERE product_id = rec.product_id AND warehouse_id = v_wh;
    END LOOP;
  ELSIF OLD.status IN ('cancelled','delivered') AND NEW.status NOT IN ('cancelled','delivered') THEN
    FOR rec IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      INSERT INTO public.inventory(product_id, warehouse_id, quantity, reserved_quantity)
        VALUES (rec.product_id, v_wh, 0, rec.quantity)
        ON CONFLICT (product_id, warehouse_id) DO UPDATE
        SET reserved_quantity = public.inventory.reserved_quantity + rec.quantity, updated_at = now();
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_status_release ON public.orders;
CREATE TRIGGER orders_status_release
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_order_status_release();

-- Sales: validate real stock and emit inventory movement
CREATE OR REPLACE FUNCTION public.tg_sale_items_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wh uuid;
  v_avail numeric;
BEGIN
  v_wh := public.default_warehouse_id();
  IF v_wh IS NULL THEN RAISE EXCEPTION 'No hay almacén configurado'; END IF;
  SELECT COALESCE(quantity,0) INTO v_avail
    FROM public.inventory WHERE product_id = NEW.product_id AND warehouse_id = v_wh;
  v_avail := COALESCE(v_avail, 0);
  IF v_avail < NEW.quantity THEN
    RAISE EXCEPTION 'Inventario real insuficiente. Disponible: %', v_avail;
  END IF;
  INSERT INTO public.inventory_movements(product_id, warehouse_id, quantity, type, reference, recorded_by)
    VALUES (NEW.product_id, v_wh, NEW.quantity, 'sale', 'sale:' || NEW.sale_id::text, COALESCE(auth.uid(), NULL));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sale_items_inventory ON public.sale_items;
CREATE TRIGGER sale_items_inventory
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.tg_sale_items_inventory();
