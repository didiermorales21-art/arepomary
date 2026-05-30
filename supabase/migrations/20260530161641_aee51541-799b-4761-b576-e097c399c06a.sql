
-- Helper to insert auth users + profile + seller role
DO $$
DECLARE
  v_company uuid := '00000000-0000-0000-0000-000000000001';
  v_seller record;
  v_sellers jsonb := '[
    {"id":"00000000-0000-0000-0000-000000000001","email":"empresa@arepomary.local","name":"Empresa Arepomary","phone":null},
    {"id":"11111111-1111-1111-1111-111111111101","email":"vendedor1@arepomary.local","name":"María Fernanda López","phone":"3101112233"},
    {"id":"11111111-1111-1111-1111-111111111102","email":"vendedor2@arepomary.local","name":"Juan Carlos Méndez","phone":"3112223344"},
    {"id":"11111111-1111-1111-1111-111111111103","email":"vendedor3@arepomary.local","name":"Diana Patricia Ruiz","phone":"3123334455"},
    {"id":"11111111-1111-1111-1111-111111111104","email":"vendedor4@arepomary.local","name":"Sebastián Torres","phone":"3134445566"}
  ]'::jsonb;
BEGIN
  FOR v_seller IN SELECT * FROM jsonb_to_recordset(v_sellers) AS x(id uuid, email text, name text, phone text)
  LOOP
    -- Auth user
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
      v_seller.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_seller.email,
      crypt('disabled-' || v_seller.id::text, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_seller.name),
      now(), now(), '', '', '', ''
    )
    ON CONFLICT (id) DO NOTHING;

    -- Profile (handle_new_user trigger should create it, but be safe)
    INSERT INTO public.profiles (id, full_name, phone)
    VALUES (v_seller.id, v_seller.name, v_seller.phone)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone;

    -- Seller role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_seller.id, 'seller')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Remove default 'customer' role added by handle_new_user
    DELETE FROM public.user_roles WHERE user_id = v_seller.id AND role = 'customer';
  END LOOP;

  -- Backfill customers
  UPDATE public.customers SET seller_id = v_company WHERE seller_id IS NULL;
END $$;

-- NOT NULL + DEFAULT for customers.seller_id
ALTER TABLE public.customers
  ALTER COLUMN seller_id SET DEFAULT '00000000-0000-0000-0000-000000000001',
  ALTER COLUMN seller_id SET NOT NULL;

-- Update guest order function so the company is the seller
CREATE OR REPLACE FUNCTION public.create_guest_order(_name text, _document_id text, _phone text, _address text, _neighborhood_id uuid, _notes text, _items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_company uuid := '00000000-0000-0000-0000-000000000001';
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
    VALUES (_name, _document_id, _phone, _address, _neighborhood_id, _notes, v_company, 'active')
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
       SET name = COALESCE(NULLIF(_name, ''), name),
           phone = COALESCE(NULLIF(_phone, ''), phone),
           address = COALESCE(NULLIF(_address, ''), address),
           neighborhood_id = COALESCE(_neighborhood_id, neighborhood_id),
           notes = COALESCE(NULLIF(_notes, ''), notes),
           seller_id = COALESCE(seller_id, v_company)
     WHERE id = v_customer_id;
  END IF;

  INSERT INTO public.orders (customer_id, seller_id, status)
  VALUES (v_customer_id, v_company, 'draft')
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
$function$;
