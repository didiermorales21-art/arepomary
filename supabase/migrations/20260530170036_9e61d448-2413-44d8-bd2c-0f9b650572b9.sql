
-- Public read of sellers (id, name) without exposing the full profiles table
CREATE OR REPLACE FUNCTION public.list_public_sellers()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'seller'
  WHERE p.id <> '00000000-0000-0000-0000-000000000001'::uuid
  ORDER BY p.full_name
$$;

GRANT EXECUTE ON FUNCTION public.list_public_sellers() TO anon, authenticated;

-- Drop old signature and recreate with optional _seller_id
DROP FUNCTION IF EXISTS public.create_guest_order(text, text, text, text, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_guest_order(
  _name text,
  _document_id text,
  _phone text,
  _address text,
  _neighborhood_id uuid,
  _notes text,
  _items jsonb,
  _seller_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_company uuid := '00000000-0000-0000-0000-000000000001';
  v_seller uuid;
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'name required';
  END IF;
  IF _document_id IS NULL OR length(trim(_document_id)) = 0 THEN
    RAISE EXCEPTION 'document required';
  END IF;
  IF _phone IS NULL OR _phone !~ '^3[0-9]{9}$' THEN
    RAISE EXCEPTION 'phone must be 10 digits starting with 3';
  END IF;

  -- Resolve seller: must be a valid seller, else company
  IF _seller_id IS NOT NULL AND _seller_id <> v_company THEN
    SELECT user_id INTO v_seller
    FROM public.user_roles
    WHERE user_id = _seller_id AND role = 'seller'
    LIMIT 1;
  END IF;
  IF v_seller IS NULL THEN
    v_seller := v_company;
  END IF;

  SELECT id INTO v_customer_id FROM public.customers WHERE document_id = _document_id;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, document_id, phone, address, neighborhood_id, notes, seller_id, status)
    VALUES (_name, _document_id, _phone, _address, _neighborhood_id, _notes, v_seller, 'active')
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
       SET name = COALESCE(NULLIF(_name, ''), name),
           phone = COALESCE(NULLIF(_phone, ''), phone),
           address = COALESCE(NULLIF(_address, ''), address),
           neighborhood_id = COALESCE(_neighborhood_id, neighborhood_id),
           notes = COALESCE(NULLIF(_notes, ''), notes),
           seller_id = COALESCE(seller_id, v_seller)
     WHERE id = v_customer_id;
  END IF;

  INSERT INTO public.orders (customer_id, seller_id, status)
  VALUES (v_customer_id, v_seller, 'draft')
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- Also expose a public lookup so anon users can prefill from document_id
CREATE OR REPLACE FUNCTION public.lookup_customer_by_document(_document_id text)
RETURNS TABLE(name text, phone text, address text, neighborhood_id uuid, seller_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.name, c.phone, c.address, c.neighborhood_id, c.seller_id
  FROM public.customers c
  WHERE c.document_id = _document_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.lookup_customer_by_document(text) TO anon, authenticated;
