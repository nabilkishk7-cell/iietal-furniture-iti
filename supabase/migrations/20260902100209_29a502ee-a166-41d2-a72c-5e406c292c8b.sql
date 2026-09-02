ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS item_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ministry_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custody_recipient text,
  ADD COLUMN IF NOT EXISTS custody_entity text;

UPDATE public.items SET item_count = COALESCE(NULLIF(regexp_replace(COALESCE(category,''), '\D', '', 'g'), '')::int, 0) WHERE item_count = 0;

ALTER TABLE public.items DROP COLUMN IF EXISTS category;

ALTER TABLE public.inventory_counts
  ADD COLUMN IF NOT EXISTS counters jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.inventory_count_lines
  ADD COLUMN IF NOT EXISTS ministry_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_qty integer NOT NULL DEFAULT 0;