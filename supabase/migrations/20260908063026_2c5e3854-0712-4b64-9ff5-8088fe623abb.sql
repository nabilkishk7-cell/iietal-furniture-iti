DROP POLICY IF EXISTS "admin write counts" ON public.inventory_counts;
CREATE POLICY "admin or reviewer write counts" ON public.inventory_counts
  FOR ALL TO authenticated
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reviewer'::app_role)))
  WITH CHECK (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reviewer'::app_role)));

DROP POLICY IF EXISTS "admin write count lines" ON public.inventory_count_lines;
CREATE POLICY "admin or reviewer write count lines" ON public.inventory_count_lines
  FOR ALL TO authenticated
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reviewer'::app_role)))
  WITH CHECK (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reviewer'::app_role)));