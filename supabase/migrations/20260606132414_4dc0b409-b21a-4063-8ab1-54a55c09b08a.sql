
-- Dedupe invoices per sale: keep oldest, move payments + items to it, delete extras
DO $$
DECLARE r record; v_keep uuid;
BEGIN
  FOR r IN SELECT sale_id FROM public.invoices WHERE sale_id IS NOT NULL GROUP BY sale_id HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO v_keep FROM public.invoices WHERE sale_id = r.sale_id ORDER BY created_at ASC LIMIT 1;
    UPDATE public.invoice_payments SET invoice_id = v_keep
      WHERE invoice_id IN (SELECT id FROM public.invoices WHERE sale_id = r.sale_id AND id <> v_keep);
    DELETE FROM public.invoice_items
      WHERE invoice_id IN (SELECT id FROM public.invoices WHERE sale_id = r.sale_id AND id <> v_keep);
    DELETE FROM public.invoices WHERE sale_id = r.sale_id AND id <> v_keep;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sales_order_id_unique ON public.sales(order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_sale_id_unique ON public.invoices(sale_id) WHERE sale_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.convert_order_to_sale(_order_id uuid)
 RETURNS TABLE(id uuid, sale_number integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE; v_sale_id uuid; v_sale_number integer;
  v_uid uuid := auth.uid(); v_items_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE orders.id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'cannot convert a cancelled order'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'operations') OR v_order.seller_id = v_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT COUNT(*) INTO v_items_count FROM public.order_items WHERE order_id = _order_id;
  IF v_items_count = 0 THEN RAISE EXCEPTION 'No se puede facturar un pedido sin productos'; END IF;
  SELECT s.id, s.sale_number INTO v_sale_id, v_sale_number FROM public.sales s WHERE s.order_id = _order_id;
  IF v_sale_id IS NOT NULL THEN RETURN QUERY SELECT v_sale_id, v_sale_number; RETURN; END IF;
  INSERT INTO public.sales (customer_id, seller_id, notes, status, order_id)
  VALUES (v_order.customer_id, COALESCE(v_order.seller_id, v_uid), v_order.notes, 'confirmed', _order_id)
  RETURNING sales.id, sales.sale_number INTO v_sale_id, v_sale_number;
  INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price)
  SELECT v_sale_id, oi.product_id, oi.quantity, oi.unit_price FROM public.order_items oi WHERE oi.order_id = _order_id;
  UPDATE public.orders SET status = 'delivered', updated_at = now() WHERE orders.id = _order_id;
  RETURN QUERY SELECT v_sale_id, v_sale_number;
END; $function$;

CREATE OR REPLACE FUNCTION public.create_guest_order(_name text, _document_id text, _phone text, _address text, _neighborhood_id uuid, _notes text, _items jsonb, _seller_id uuid DEFAULT NULL::uuid, _delivery_date date DEFAULT NULL::date)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid; v_order_id uuid; v_item jsonb;
  v_company uuid := '00000000-0000-0000-0000-000000000001';
  v_seller uuid; v_days integer[];
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF _document_id IS NULL OR length(trim(_document_id)) = 0 THEN RAISE EXCEPTION 'document required'; END IF;
  IF _phone IS NULL OR _phone !~ '^3[0-9]{9}$' THEN RAISE EXCEPTION 'phone must be 10 digits starting with 3'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'El pedido debe tener al menos un producto'; END IF;
  IF _delivery_date IS NOT NULL THEN
    SELECT COALESCE(delivery_days, ARRAY[1,2,3,4,5,6]::integer[]) INTO v_days
      FROM public.company_settings ORDER BY created_at LIMIT 1;
    IF NOT (EXTRACT(DOW FROM _delivery_date)::int = ANY(v_days)) THEN RAISE EXCEPTION 'delivery date is not on an available day'; END IF;
  END IF;
  IF _seller_id IS NOT NULL AND _seller_id <> v_company THEN
    SELECT user_id INTO v_seller FROM public.user_roles WHERE user_id = _seller_id AND role = 'seller' LIMIT 1;
  END IF;
  IF v_seller IS NULL THEN v_seller := v_company; END IF;
  SELECT id INTO v_customer_id FROM public.customers WHERE document_id = _document_id;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, document_id, phone, address, neighborhood_id, notes, seller_id, status)
    VALUES (_name, _document_id, _phone, _address, _neighborhood_id, _notes, v_seller, 'active') RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers SET name = COALESCE(NULLIF(_name,''), name), phone = COALESCE(NULLIF(_phone,''), phone),
      address = COALESCE(NULLIF(_address,''), address), neighborhood_id = COALESCE(_neighborhood_id, neighborhood_id),
      notes = COALESCE(NULLIF(_notes,''), notes), seller_id = COALESCE(seller_id, v_seller) WHERE id = v_customer_id;
  END IF;
  INSERT INTO public.orders (customer_id, seller_id, status, delivery_date)
  VALUES (v_customer_id, v_seller, 'draft', _delivery_date) RETURNING id INTO v_order_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
    VALUES (v_order_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric);
  END LOOP;
  RETURN v_order_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_auto_create_invoice_for_sale()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_invoice_id uuid; v_items_count int;
BEGIN
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN RETURN NEW; END IF;
  SELECT id INTO v_invoice_id FROM public.invoices WHERE sale_id = NEW.id LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_items_count FROM public.sale_items WHERE sale_id = NEW.id;
  IF v_items_count = 0 AND COALESCE(NEW.total,0) = 0 THEN RETURN NEW; END IF;
  INSERT INTO public.invoices (customer_id, sale_id, status, notes, created_by)
  VALUES (NEW.customer_id, NEW.id, 'issued'::invoice_status, NEW.notes, NEW.seller_id) RETURNING id INTO v_invoice_id;
  INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price)
  SELECT v_invoice_id, si.product_id, si.quantity, si.unit_price FROM public.sale_items si WHERE si.sale_id = NEW.id;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_sync_invoice_items_from_sale()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_invoice_id uuid; v_sale public.sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = NEW.sale_id;
  IF v_sale.status <> 'confirmed' THEN RETURN NEW; END IF;
  SELECT id INTO v_invoice_id FROM public.invoices WHERE sale_id = NEW.sale_id LIMIT 1;
  IF v_invoice_id IS NULL THEN
    INSERT INTO public.invoices (customer_id, sale_id, status, notes, created_by)
    VALUES (v_sale.customer_id, v_sale.id, 'issued'::invoice_status, v_sale.notes, v_sale.seller_id)
    RETURNING id INTO v_invoice_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.invoice_items WHERE invoice_id = v_invoice_id AND product_id = NEW.product_id AND quantity = NEW.quantity AND unit_price = NEW.unit_price) THEN
    INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price) VALUES (v_invoice_id, NEW.product_id, NEW.quantity, NEW.unit_price);
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.seller_commission_summary(_from date DEFAULT NULL, _to date DEFAULT NULL)
 RETURNS TABLE(seller_id uuid, seller_name text, packages numeric, commission numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH cfg AS (SELECT commission_standard_per_package AS s, commission_wholesale_per_package AS w FROM public.company_settings ORDER BY created_at LIMIT 1),
  paid AS (
    SELECT i.id AS invoice_id, c.seller_id, c.customer_type, c.gives_commission, c.commission_per_package
    FROM public.invoices i JOIN public.customers c ON c.id = i.customer_id
    WHERE i.status = 'paid' AND (_from IS NULL OR i.issued_at >= _from) AND (_to IS NULL OR i.issued_at <= _to)
      AND COALESCE(c.gives_commission, true) = true
  ),
  lines AS (
    SELECT p.seller_id, p.customer_type, p.commission_per_package, p.invoice_id, SUM(ii.quantity) AS qty
    FROM paid p JOIN public.invoice_items ii ON ii.invoice_id = p.invoice_id
    GROUP BY p.seller_id, p.customer_type, p.commission_per_package, p.invoice_id
  )
  SELECT pr.id AS seller_id, pr.full_name AS seller_name,
    COALESCE(SUM(l.qty), 0) AS packages,
    COALESCE(SUM(l.qty * COALESCE(l.commission_per_package,
      CASE WHEN l.customer_type = 'wholesale' THEN (SELECT w FROM cfg) ELSE (SELECT s FROM cfg) END)), 0) AS commission
  FROM public.profiles pr LEFT JOIN lines l ON l.seller_id = pr.id
  WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = pr.id AND ur.role = 'seller')
  GROUP BY pr.id, pr.full_name ORDER BY commission DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.seller_commission_summary(date, date) TO authenticated;
