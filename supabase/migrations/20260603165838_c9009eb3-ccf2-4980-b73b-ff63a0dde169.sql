
DROP FUNCTION IF EXISTS public.lookup_customer_by_document(text);
CREATE FUNCTION public.lookup_customer_by_document(_document_id text)
RETURNS TABLE(name text, phone text, email text, address text, neighborhood_id uuid, seller_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.name, c.phone, c.email, c.address, c.neighborhood_id, c.seller_id
  FROM public.customers c WHERE c.document_id = _document_id LIMIT 1
$$;
