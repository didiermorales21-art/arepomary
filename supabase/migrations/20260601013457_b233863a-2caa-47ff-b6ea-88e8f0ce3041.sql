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
  VALUES (NEW.customer_id, NEW.id, 'issued'::invoice_status, NEW.notes, NEW.seller_id)
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price)
  SELECT v_invoice_id, si.product_id, si.quantity, si.unit_price
  FROM public.sale_items si
  WHERE si.sale_id = NEW.id;

  RETURN NEW;
END;
$$;