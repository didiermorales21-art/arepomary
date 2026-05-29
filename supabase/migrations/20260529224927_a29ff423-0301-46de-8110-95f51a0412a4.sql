
-- helper trigger function for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.neighborhoods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.neighborhoods TO authenticated;
GRANT ALL ON public.neighborhoods TO service_role;

ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "neighborhoods readable" ON public.neighborhoods FOR SELECT USING (true);
CREATE POLICY "neighborhoods admin manage" ON public.neighborhoods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER neighborhoods_set_updated_at
  BEFORE UPDATE ON public.neighborhoods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS document_id text,
  ADD COLUMN IF NOT EXISTS neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_document_id_unique
  ON public.customers(document_id) WHERE document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_guest_order(
  _name text,
  _document_id text,
  _phone text,
  _address text,
  _neighborhood_id uuid,
  _notes text,
  _items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_item jsonb;
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

  SELECT id INTO v_customer_id FROM public.customers WHERE document_id = _document_id;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, document_id, phone, address, neighborhood_id, notes, seller_id, status)
    VALUES (_name, _document_id, _phone, _address, _neighborhood_id, _notes, NULL, 'active')
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
       SET name = COALESCE(NULLIF(_name, ''), name),
           phone = COALESCE(NULLIF(_phone, ''), phone),
           address = COALESCE(NULLIF(_address, ''), address),
           neighborhood_id = COALESCE(_neighborhood_id, neighborhood_id),
           notes = COALESCE(NULLIF(_notes, ''), notes)
     WHERE id = v_customer_id;
  END IF;

  INSERT INTO public.orders (customer_id, seller_id, status)
  VALUES (v_customer_id, NULL, 'draft')
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

GRANT EXECUTE ON FUNCTION public.create_guest_order(text,text,text,text,uuid,text,jsonb) TO anon, authenticated;

ALTER TABLE public.orders ALTER COLUMN seller_id DROP NOT NULL;
