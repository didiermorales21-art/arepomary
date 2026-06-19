
-- 1) Wipe transactional data (preserve catalogs and master data)
TRUNCATE TABLE
  public.audit_logs,
  public.invoice_payments, public.invoice_items, public.invoices,
  public.bill_payments, public.bill_items, public.bills,
  public.commission_payment_items, public.commission_payments,
  public.payments, public.sale_items, public.sales,
  public.shipments,
  public.order_items, public.orders,
  public.production_costs, public.production_batches,
  public.cash_movements,
  public.inventory_movements, public.raw_material_movements,
  public.inventory,
  public.product_price_history
RESTART IDENTITY CASCADE;

UPDATE public.raw_materials SET current_stock = 0;

-- 2) Add optional user link to collaborators
ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS collaborators_user_id_unique
  ON public.collaborators(user_id) WHERE user_id IS NOT NULL;

-- 3) Unify drivers into collaborators
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_driver_id_fkey;
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_driver_id_fkey;
DROP TABLE IF EXISTS public.drivers CASCADE;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.collaborators(id) ON DELETE SET NULL;
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.collaborators(id) ON DELETE SET NULL;
