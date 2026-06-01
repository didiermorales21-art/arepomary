CREATE OR REPLACE FUNCTION public.tg_auto_create_invoice_for_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_invoice_id FROM public.invoices WHERE sale_id = NEW.id LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.invoices (customer_id, sale_id, status, notes, created_by)
  VALUES (NEW.customer_id, NEW.id, 'pending', NEW.notes, NEW.seller_id)
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price)
  SELECT v_invoice_id, si.product_id, si.quantity, si.unit_price
  FROM public.sale_items si
  WHERE si.sale_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_invoice_for_sale_ins ON public.sales;
DROP TRIGGER IF EXISTS trg_auto_create_invoice_for_sale_upd ON public.sales;

CREATE TRIGGER trg_auto_create_invoice_for_sale_ins
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.tg_auto_create_invoice_for_sale();

CREATE TRIGGER trg_auto_create_invoice_for_sale_upd
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.tg_auto_create_invoice_for_sale();

-- Also handle the case where items are inserted after the sale is created as confirmed
CREATE OR REPLACE FUNCTION public.tg_sync_invoice_items_from_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_sale_status sale_status;
BEGIN
  SELECT status INTO v_sale_status FROM public.sales WHERE id = NEW.sale_id;
  IF v_sale_status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  SELECT id INTO v_invoice_id FROM public.invoices WHERE sale_id = NEW.sale_id LIMIT 1;
  IF v_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.invoice_items
    WHERE invoice_id = v_invoice_id AND product_id = NEW.product_id AND quantity = NEW.quantity AND unit_price = NEW.unit_price
  ) THEN
    INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price)
    VALUES (v_invoice_id, NEW.product_id, NEW.quantity, NEW.unit_price);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_items_from_sale ON public.sale_items;
CREATE TRIGGER trg_sync_invoice_items_from_sale
AFTER INSERT ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_invoice_items_from_sale();