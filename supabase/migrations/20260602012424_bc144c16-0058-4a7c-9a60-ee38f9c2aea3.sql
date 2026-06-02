
-- Cost categories enum
DO $$ BEGIN
  CREATE TYPE public.cost_category AS ENUM ('variable_input','variable_labor','fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- cost_items: parametrized costs (per unit for variable, monthly amount for fixed)
CREATE TABLE IF NOT EXISTS public.cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  category public.cost_category NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  unit_cost numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cost_items TO authenticated;
GRANT ALL ON public.cost_items TO service_role;

ALTER TABLE public.cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_items readable" ON public.cost_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_items admin manage" ON public.cost_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_cost_items_updated BEFORE UPDATE ON public.cost_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults
INSERT INTO public.cost_items (key,name,category,unit,unit_cost,is_system,sort_order) VALUES
  ('queso','Queso','variable_input','g',0,true,10),
  ('maiz','Maíz','variable_input','g',0,true,20),
  ('mantequilla','Mantequilla','variable_input','g',0,true,30),
  ('maizena','Maizena','variable_input','g',0,true,40),
  ('almiyuca','Almiyuca','variable_input','g',0,true,50),
  ('sal','Sal','variable_input','g',0,true,60),
  ('bocadillo','Bocadillo','variable_input','g',0,true,70),
  ('asadores','Asadores','variable_labor','persona',0,true,10),
  ('armadores','Armadores','variable_labor','persona',0,true,20),
  ('auxiliares','Auxiliares','variable_labor','persona',0,true,30),
  ('arriendo','Arriendo','fixed','mes',0,true,10),
  ('gas','Gas','fixed','mes',0,true,20),
  ('servicios','Servicios','fixed','mes',0,true,30),
  ('bolsas','Bolsas','fixed','mes',0,true,40),
  ('stikers','Stikers','fixed','mes',0,true,50)
ON CONFLICT (key) DO NOTHING;

-- production_costs: consumption per batch
CREATE TABLE IF NOT EXISTS public.production_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  cost_item_id uuid NOT NULL REFERENCES public.cost_items(id),
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost_snapshot numeric NOT NULL DEFAULT 0,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_cost_snapshot) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_costs TO authenticated;
GRANT ALL ON public.production_costs TO service_role;

ALTER TABLE public.production_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_costs readable" ON public.production_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "production_costs manage" ON public.production_costs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

CREATE INDEX IF NOT EXISTS idx_production_costs_batch ON public.production_costs(batch_id);

-- Add cost breakdown columns to production_batches
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS variable_input_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variable_labor_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fixed_cost_allocated numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost numeric NOT NULL DEFAULT 0;
