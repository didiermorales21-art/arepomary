ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_driver_delivery
  ON public.orders (driver_id, delivery_date);