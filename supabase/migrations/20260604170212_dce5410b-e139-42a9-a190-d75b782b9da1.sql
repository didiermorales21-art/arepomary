
-- Category enum for outflows
DO $$ BEGIN
  CREATE TYPE public.cash_movement_category AS ENUM ('supplies','supplier_payment','commission','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  category public.cash_movement_category NOT NULL DEFAULT 'other',
  reason text,
  reference text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_movements view" ON public.cash_movements;
CREATE POLICY "cash_movements view" ON public.cash_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

DROP POLICY IF EXISTS "cash_movements insert" ON public.cash_movements;
CREATE POLICY "cash_movements insert" ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

-- RPC: record cash outflow (password protected)
CREATE OR REPLACE FUNCTION public.record_cash_outflow(
  _amount numeric, _method text, _category text, _reason text, _reference text, _password text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'operations')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _password IS NULL OR _password <> 'D1031176597*' THEN
    RAISE EXCEPTION 'clave inválida';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'monto inválido';
  END IF;
  INSERT INTO public.cash_movements(amount, method, category, reason, reference, recorded_by)
    VALUES (_amount, _method::public.payment_method, _category::public.cash_movement_category,
            NULLIF(_reason,''), NULLIF(_reference,''), v_uid)
    RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- RPC: pay a supplier bill (password protected, ties to cashbox via bill_payments)
CREATE OR REPLACE FUNCTION public.add_bill_payment(
  _bill_id uuid, _amount numeric, _method text, _reference text DEFAULT NULL, _password text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pid uuid;
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'operations')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _password IS NULL OR _password <> 'D1031176597*' THEN
    RAISE EXCEPTION 'clave inválida';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'monto inválido'; END IF;

  SELECT (total - paid) INTO v_balance FROM public.bills WHERE id = _bill_id;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'factura no encontrada'; END IF;
  IF _amount > v_balance + 0.001 THEN RAISE EXCEPTION 'el monto excede el saldo'; END IF;

  INSERT INTO public.bill_payments(bill_id, amount, method, reference, recorded_by)
    VALUES (_bill_id, _amount, _method::public.payment_method, NULLIF(_reference,''), v_uid)
    RETURNING id INTO v_pid;
  RETURN v_pid;
END $$;
