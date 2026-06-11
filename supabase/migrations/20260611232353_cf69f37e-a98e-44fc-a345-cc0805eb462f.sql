
-- Helper: is user a staff member (any internal role)
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','operations','seller','production_operator','logistics_operator')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- 1) audit_logs: remove permissive INSERT; SECURITY DEFINER trigger bypasses RLS
DROP POLICY IF EXISTS "audit insert by definer or self" ON public.audit_logs;

-- 2) invoice_payments: scope SELECT
DROP POLICY IF EXISTS "invoice_payments via invoice" ON public.invoice_payments;
CREATE POLICY "invoice_payments scoped select" ON public.invoice_payments
FOR SELECT USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'operations')
  OR EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.customers c ON c.id = i.customer_id
    WHERE i.id = invoice_payments.invoice_id
      AND (c.seller_id = auth.uid() OR c.portal_user_id = auth.uid())
  )
);

-- 3) company_settings: restrict to staff
DROP POLICY IF EXISTS "company readable" ON public.company_settings;
CREATE POLICY "company readable by staff" ON public.company_settings
FOR SELECT USING (public.is_staff(auth.uid()));

-- 4) drivers: restrict to staff
DROP POLICY IF EXISTS "drivers readable" ON public.drivers;
CREATE POLICY "drivers readable by staff" ON public.drivers
FOR SELECT USING (public.is_staff(auth.uid()));

-- 5) profiles: own profile or staff
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by self or staff" ON public.profiles
FOR SELECT USING (id = auth.uid() OR public.is_staff(auth.uid()));

-- 6) suppliers: restrict to admin/operations
DROP POLICY IF EXISTS "suppliers readable" ON public.suppliers;
CREATE POLICY "suppliers readable by admin ops" ON public.suppliers
FOR SELECT USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations')
);

-- 7) Storage: remove public listing on product-images bucket.
-- Public URLs continue to work without SELECT on storage.objects.
DROP POLICY IF EXISTS "product-images public read" ON storage.objects;
CREATE POLICY "product-images staff list" ON storage.objects
FOR SELECT USING (bucket_id = 'product-images' AND public.is_staff(auth.uid()));

-- 8) Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.default_warehouse_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_sale_totals(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_invoice_totals(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_bill_totals(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_order_totals(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_sale_items_inventory() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_apply_movement() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_invoice_payments_recalc() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_invoice_items_recalc() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_bill_items_recalc() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_payments_recalc() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_sale_items_recalc() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_order_items_recalc() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_apply_rm_movement() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_production_consume_rm() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_bill_item_rm_in() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_sync_profile_name() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_sync_invoice_items_from_sale() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_order_status_release() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_bill_payments_recalc() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_order_items_reserve() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_guard_customer_type() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_sync_customer_name() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_auto_create_invoice_for_sale() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.add_invoice_payment(uuid,numeric,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_bill_payment(uuid,numeric,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purchase_raw_material(uuid,numeric,numeric,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pay_seller_commissions(uuid,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_cash_outflow(numeric,text,text,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seller_pending_commission_invoices(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seller_commission_summary(date,date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.convert_order_to_sale(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lookup_customer_by_document(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_public_sellers() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_delivery_days() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_guest_order(text,text,text,text,uuid,text,jsonb,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_guest_order(text,text,text,text,uuid,text,jsonb,uuid,date) FROM PUBLIC;

-- Re-grant only where intentionally callable
-- has_role: used inside RLS policies; needs to be callable by both anon and authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;

-- Public (guest) callable
GRANT EXECUTE ON FUNCTION public.create_guest_order(text,text,text,text,uuid,text,jsonb,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_order(text,text,text,text,uuid,text,jsonb,uuid,date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_customer_by_document(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_sellers() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_days() TO anon, authenticated;

-- Authenticated-only RPCs (handlers verify role + password internally)
GRANT EXECUTE ON FUNCTION public.add_invoice_payment(uuid,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_bill_payment(uuid,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_raw_material(uuid,numeric,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_seller_commissions(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_cash_outflow(numeric,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_pending_commission_invoices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_commission_summary(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_order_to_sale(uuid) TO authenticated;
