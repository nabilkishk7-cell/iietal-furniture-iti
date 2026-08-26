import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Item = { id: number; code: string; name: string; notes: string | null; sort_order: number };
export type Location = { id: number; name: string; sort_order: number };
export type DistRow = { item_id: number; location_id: number; qty: number };
export type Movement = {
  id: string;
  moved_on: string;
  item_id: number;
  qty: number;
  from_location_id: number | null;
  to_location_id: number | null;
  security_from: string | null;
  security_to: string | null;
  employee_name: string | null;
  notes: string | null;
  created_at: string;
};

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("items")
        .select("id, code, name, notes, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async (): Promise<Location[]> => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Location[];
    },
  });
}

export function useDistribution() {
  return useQuery({
    queryKey: ["distribution"],
    queryFn: async (): Promise<DistRow[]> => {
      const { data, error } = await supabase
        .from("v_distribution")
        .select("item_id, location_id, qty");
      if (error) throw error;
      return (data ?? []) as DistRow[];
    },
  });
}

export function useMovements() {
  return useQuery({
    queryKey: ["movements"],
    queryFn: async (): Promise<Movement[]> => {
      const { data, error } = await supabase
        .from("movements")
        .select(
          "id, moved_on, item_id, qty, from_location_id, to_location_id, security_from, security_to, employee_name, notes, created_at",
        )
        .order("moved_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });
}

export const AR_WEEKDAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export function arabicWeekday(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return AR_WEEKDAYS[d.getDay()] ?? "";
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("ar-EG").format(n);
}

export function buildMatrix(dist: DistRow[]) {
  const map = new Map<string, number>();
  for (const r of dist) map.set(`${r.item_id}:${r.location_id}`, r.qty);
  return map;
}
