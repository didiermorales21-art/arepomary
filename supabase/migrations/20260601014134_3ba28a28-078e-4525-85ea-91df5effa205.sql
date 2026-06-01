
CREATE OR REPLACE FUNCTION public.add_invoice_payment(
  _invoice_id uuid,
  _amount numeric,
  _method text,
  _reference text DEFAULT NULL,
  _gift_password text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pid uuid;
  v_balance numeric;
  v_method payment_method;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'operations')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  SELECT (total - paid) INTO v_balance FROM public.invoices WHERE id = _invoice_id;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'invoice not found';
  END IF;
  IF _amount > v_balance + 0.001 THEN
    RAISE EXCEPTION 'amount exceeds balance';
  END IF;

  v_method := _method::payment_method;

  IF v_method = 'gift' THEN
    IF _gift_password IS NULL OR _gift_password <> 'D1031176597*' THEN
      RAISE EXCEPTION 'invalid gift password';
    END IF;
  END IF;

  INSERT INTO public.invoice_payments (invoice_id, amount, method, reference, recorded_by)
  VALUES (_invoice_id, _amount, v_method, NULLIF(_reference,''), v_uid)
  RETURNING id INTO v_pid;

  RETURN v_pid;
END;
$$;

REVOKE ALL ON FUNCTION public.add_invoice_payment(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_invoice_payment(uuid, numeric, text, text, text) TO authenticated;
