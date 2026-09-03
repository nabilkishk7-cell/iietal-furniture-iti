-- 1) profiles: username / active / metadata
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.profiles
SET username = lower(regexp_replace(split_part(coalesce(email, 'user_' || left(id::text, 8)), '@', 1), '[^a-zA-Z0-9._-]', '', 'g'))
WHERE username IS NULL;

-- ensure uniqueness for any accidental collisions
UPDATE public.profiles p
SET username = p.username || '_' || left(p.id::text, 4)
WHERE EXISTS (
  SELECT 1 FROM public.profiles q
  WHERE q.username = p.username AND q.id <> p.id AND q.created_at < p.created_at
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) active-user gate used by every RLS policy
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_active)
$$;

REVOKE ALL ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated, service_role;

-- roles only count for active users
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id AND p.is_active
    WHERE ur.user_id = _user_id AND ur.role = _role
  )
$$;

-- 3) tighten read policies: signed-in AND active
DROP POLICY IF EXISTS "read items" ON public.items;
CREATE POLICY "read items" ON public.items FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "read locations" ON public.locations;
CREATE POLICY "read locations" ON public.locations FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "read opening" ON public.opening_balances;
CREATE POLICY "read opening" ON public.opening_balances FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "read movements" ON public.movements;
CREATE POLICY "read movements" ON public.movements FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "read counts" ON public.inventory_counts;
CREATE POLICY "read counts" ON public.inventory_counts FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reviewer')));

DROP POLICY IF EXISTS "read count lines" ON public.inventory_count_lines;
CREATE POLICY "read count lines" ON public.inventory_count_lines FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reviewer')));

-- profiles: admins manage, everyone reads own
DROP POLICY IF EXISTS "own profile" ON public.profiles;
CREATE POLICY "own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) inventory: branch manager signature + system qty snapshot
ALTER TABLE public.inventory_counts
  ADD COLUMN IF NOT EXISTS branch_manager_name text,
  ADD COLUMN IF NOT EXISTS branch_manager_title text;

ALTER TABLE public.inventory_count_lines
  ADD COLUMN IF NOT EXISTS system_qty integer NOT NULL DEFAULT 0;

UPDATE public.inventory_count_lines SET system_qty = current_qty WHERE system_qty = 0;

-- 5) movements: database-level integrity
CREATE OR REPLACE FUNCTION public.movement_balance_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE avail integer;
BEGIN
  IF NEW.qty IS NULL OR NEW.qty <= 0 THEN
    RAISE EXCEPTION 'العدد يجب أن يكون رقمًا صحيحًا أكبر من صفر';
  END IF;
  IF NEW.moved_on IS NULL THEN
    RAISE EXCEPTION 'تاريخ الحركة مطلوب';
  END IF;
  IF NEW.moved_on > CURRENT_DATE THEN
    RAISE EXCEPTION 'لا يمكن تسجيل حركة بتاريخ مستقبلي';
  END IF;

  IF NEW.from_location_id IS NOT NULL THEN
    SELECT
      coalesce((SELECT ob.qty FROM public.opening_balances ob
                 WHERE ob.item_id = NEW.item_id AND ob.location_id = NEW.from_location_id), 0)
      + coalesce((SELECT sum(m.qty) FROM public.movements m
                   WHERE m.item_id = NEW.item_id AND m.to_location_id = NEW.from_location_id
                     AND m.id <> NEW.id), 0)
      - coalesce((SELECT sum(m.qty) FROM public.movements m
                   WHERE m.item_id = NEW.item_id AND m.from_location_id = NEW.from_location_id
                     AND m.id <> NEW.id), 0)
    INTO avail;

    IF NEW.qty > avail THEN
      RAISE EXCEPTION 'الرصيد المتاح في مكان المصدر % فقط', avail;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movements_balance ON public.movements;
CREATE TRIGGER movements_balance BEFORE INSERT OR UPDATE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.movement_balance_check();

-- 6) new users keep their username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, job_title, is_active)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'job_title',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  END IF;
  RETURN new;
END;
$$;