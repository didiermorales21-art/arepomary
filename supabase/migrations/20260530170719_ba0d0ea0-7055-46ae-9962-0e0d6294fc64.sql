
GRANT SELECT ON public.products TO anon;

CREATE POLICY "products public read active"
ON public.products
FOR SELECT
TO anon
USING (active = true);
