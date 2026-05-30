
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_order_id_unique
  ON public.sales(order_id) WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.convert_order_to_sale(_order_id uuid)
RETURNS TABLE(id uuid, sale_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_sale_id uuid;
  v_sale_number integer;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE orders.id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'cannot convert a cancelled order';
  END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'operations') OR v_order.seller_id = v_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT s.id, s.sale_number INTO v_sale_id, v_sale_number
  FROM public.sales s WHERE s.order_id = _order_id;
  IF v_sale_id IS NOT NULL THEN
    RETURN QUERY SELECT v_sale_id, v_sale_number;
    RETURN;
  END IF;

  INSERT INTO public.sales (customer_id, seller_id, notes, status, order_id)
  VALUES (v_order.customer_id, COALESCE(v_order.seller_id, v_uid), v_order.notes, 'confirmed', _order_id)
  RETURNING sales.id, sales.sale_number INTO v_sale_id, v_sale_number;

  INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price)
  SELECT v_sale_id, oi.product_id, oi.quantity, oi.unit_price
  FROM public.order_items oi
  WHERE oi.order_id = _order_id;

  UPDATE public.orders SET status = 'delivered', updated_at = now() WHERE orders.id = _order_id;

  RETURN QUERY SELECT v_sale_id, v_sale_number;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_order_to_sale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_order_to_sale(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
