-- 1) Master items: category + image
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS items_set_updated_at ON public.items;
CREATE TRIGGER items_set_updated_at BEFORE UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Immutable audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  actor_email text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins and reviewers read audit" ON public.audit_log;
CREATE POLICY "admins and reviewers read audit" ON public.audit_log
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reviewer'));

CREATE OR REPLACE FUNCTION public.log_movement_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_log(table_name, record_id, action, actor_id, actor_email, before_data, after_data)
  VALUES (
    'movements',
    COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    auth.uid(),
    v_email,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_movement_audit() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS movements_audit ON public.movements;
CREATE TRIGGER movements_audit AFTER INSERT OR UPDATE OR DELETE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.log_movement_audit();

-- 3) Inventory counts
CREATE TABLE IF NOT EXISTS public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counted_on date NOT NULL DEFAULT CURRENT_DATE,
  counted_by_name text NOT NULL,
  location_id bigint REFERENCES public.locations(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_counts TO authenticated;
GRANT ALL ON public.inventory_counts TO service_role;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read counts" ON public.inventory_counts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write counts" ON public.inventory_counts FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER inventory_counts_set_updated_at BEFORE UPDATE ON public.inventory_counts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  item_id bigint NOT NULL REFERENCES public.items(id),
  counted_qty integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_count_lines TO authenticated;
GRANT ALL ON public.inventory_count_lines TO service_role;
ALTER TABLE public.inventory_count_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read count lines" ON public.inventory_count_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write count lines" ON public.inventory_count_lines FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4) Storage policies for item images bucket (bucket created separately)
DROP POLICY IF EXISTS "public read item images" ON storage.objects;
CREATE POLICY "public read item images" ON storage.objects FOR SELECT USING (bucket_id = 'item-images');
DROP POLICY IF EXISTS "admins manage item images" ON storage.objects;
CREATE POLICY "admins manage item images" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'item-images' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'item-images' AND public.has_role(auth.uid(),'admin'));