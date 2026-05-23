
ALTER FUNCTION public.tg_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.tg_sale_items_recalc() SET search_path = public;
ALTER FUNCTION public.tg_payments_recalc() SET search_path = public;
ALTER FUNCTION public.recalc_sale_totals(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
