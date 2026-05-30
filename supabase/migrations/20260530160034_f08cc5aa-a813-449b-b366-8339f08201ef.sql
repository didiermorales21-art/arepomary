-- Función de auditoría: registra INSERT/UPDATE/DELETE en audit_logs
CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_entity_id text;
  v_action text;
  v_details jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_entity_id := (to_jsonb(NEW) ->> 'id');
    v_details := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_entity_id := (to_jsonb(NEW) ->> 'id');
    v_details := jsonb_build_object(
      'changed', (
        SELECT jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value))
        FROM jsonb_each(to_jsonb(OLD)) o
        JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
        WHERE o.value IS DISTINCT FROM n.value
          AND key NOT IN ('updated_at')
      )
    );
    IF v_details->'changed' IS NULL OR v_details->'changed' = 'null'::jsonb THEN
      RETURN NULL;
    END IF;
  ELSE
    v_action := 'delete';
    v_entity_id := (to_jsonb(OLD) ->> 'id');
    v_details := to_jsonb(OLD);
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  END IF;

  INSERT INTO public.audit_logs (action, entity, entity_id, user_id, user_email, details)
  VALUES (v_action, TG_TABLE_NAME, v_entity_id, v_uid, v_email, v_details);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Permitir inserts del trigger SECURITY DEFINER aunque la política solo permita user_id = auth.uid()
DROP POLICY IF EXISTS "audit self insert" ON public.audit_logs;
CREATE POLICY "audit insert by definer or self"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Aplicar triggers a las tablas principales
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','orders','sales','invoices','bills','shipments','products','suppliers','production_batches','inventory_movements','payments','invoice_payments','bill_payments','neighborhoods','zones','drivers']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log()', t, t);
  END LOOP;
END $$;