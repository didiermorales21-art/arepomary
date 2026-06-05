
-- 1) Customer commission fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS gives_commission boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS commission_per_package numeric;

-- 2) Global defaults
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS commission_standard_per_package numeric NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS commission_wholesale_per_package numeric NOT NULL DEFAULT 500;

-- 3) Raw materials catalog
CREATE TABLE IF NOT EXISTS public.raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  current_stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_materials TO authenticated;
GRANT ALL ON public.raw_materials TO service_role;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raw_materials readable" ON public.raw_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "raw_materials manage" ON public.raw_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

CREATE TRIGGER tg_raw_materials_touch
  BEFORE UPDATE ON public.raw_materials
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 4) Raw material movements
CREATE TABLE IF NOT EXISTS public.raw_material_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in','out','adjust')),
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  reference text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.raw_material_movements TO authenticated;
GRANT ALL ON public.raw_material_movements TO service_role;
ALTER TABLE public.raw_material_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rm_mov readable" ON public.raw_material_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "rm_mov insert" ON public.raw_material_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

CREATE OR REPLACE FUNCTION public.tg_apply_rm_movement()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE delta numeric;
BEGIN
  IF NEW.type = 'in' THEN delta := NEW.quantity;
  ELSIF NEW.type = 'out' THEN delta := -NEW.quantity;
  ELSE delta := NEW.quantity; END IF;
  UPDATE public.raw_materials SET current_stock = current_stock + delta, updated_at = now()
    WHERE id = NEW.raw_material_id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_rm_movement_apply
  AFTER INSERT ON public.raw_material_movements
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_rm_movement();

-- 5) Link cost_items (insumos variables) to a raw material
ALTER TABLE public.cost_items ADD COLUMN IF NOT EXISTS raw_material_id uuid REFERENCES public.raw_materials(id) ON DELETE SET NULL;

-- 6) Production cost line triggers a raw-material 'out' if the cost_item is mapped
CREATE OR REPLACE FUNCTION public.tg_production_consume_rm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rm uuid;
BEGIN
  SELECT raw_material_id INTO v_rm FROM public.cost_items WHERE id = NEW.cost_item_id;
  IF v_rm IS NOT NULL AND COALESCE(NEW.quantity,0) > 0 THEN
    INSERT INTO public.raw_material_movements(raw_material_id, type, quantity, unit_cost, reference, recorded_by)
      VALUES (v_rm, 'out', NEW.quantity, COALESCE(NEW.unit_cost_snapshot,0),
              'production_cost:'||NEW.id::text, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_prod_cost_consume_rm
  AFTER INSERT ON public.production_costs
  FOR EACH ROW EXECUTE FUNCTION public.tg_production_consume_rm();

-- 7) Bill items optional link to raw material -> 'in' movement
ALTER TABLE public.bill_items
  ADD COLUMN IF NOT EXISTS raw_material_id uuid REFERENCES public.raw_materials(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.tg_bill_item_rm_in()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.raw_material_id IS NOT NULL AND COALESCE(NEW.quantity,0) > 0 THEN
    INSERT INTO public.raw_material_movements(raw_material_id, type, quantity, unit_cost, reference, recorded_by)
      VALUES (NEW.raw_material_id, 'in', NEW.quantity, COALESCE(NEW.unit_price,0),
              'bill_item:'||NEW.id::text, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_bill_item_rm_in_trg
  AFTER INSERT ON public.bill_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_bill_item_rm_in();

-- 8) Quick purchase: adds inventory + cash outflow (atomic)
CREATE OR REPLACE FUNCTION public.purchase_raw_material(
  _raw_material_id uuid, _quantity numeric, _unit_cost numeric,
  _method text, _reference text, _password text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_mov uuid; v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'operations')) THEN
    RAISE EXCEPTION 'not authorized'; END IF;
  IF _password IS NULL OR _password <> 'D1031176597*' THEN RAISE EXCEPTION 'clave inválida'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'cantidad inválida'; END IF;
  IF _unit_cost IS NULL OR _unit_cost < 0 THEN RAISE EXCEPTION 'costo inválido'; END IF;
  v_total := _quantity * _unit_cost;
  INSERT INTO public.raw_material_movements(raw_material_id, type, quantity, unit_cost, reference, recorded_by)
    VALUES (_raw_material_id, 'in', _quantity, _unit_cost, NULLIF(_reference,''), v_uid)
    RETURNING id INTO v_mov;
  INSERT INTO public.cash_movements(amount, method, category, reason, reference, recorded_by)
    VALUES (v_total, _method::public.payment_method, 'supplies'::public.cash_movement_category,
            'Compra directa MP', NULLIF(_reference,''), v_uid);
  RETURN v_mov;
END $$;
