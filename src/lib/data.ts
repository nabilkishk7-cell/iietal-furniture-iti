import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Item = {
  id: number;
  code: string;
  name: string;
  notes: string | null;
  sort_order: number;
  /** العدد المسجّل للصنف */
  item_count: number;
  /** الكمية الواردة من الوزارة */
  ministry_qty: number;
  /** مستلم العهدة */
  custody_recipient: string | null;
  /** اسم الجهة مستلمة العهدة */
  custody_entity: string | null;
  image_url: string | null;
};

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
export type AuditEntry = {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  actor_id: string | null;
  actor_email: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};
export type InventoryCount = {
  id: string;
  counted_on: string;
  counted_by_name: string;
  location_id: number | null;
  counters: Counter[];
  branch_manager_name: string | null;
  branch_manager_title: string | null;
  notes: string | null;
  created_at: string;
};
export type Counter = { name: string; title: string };

export type InventoryCountLine = {
  id: string;
  count_id: string;
  item_id: number;
  counted_qty: number;
  system_qty: number;
  ministry_qty: number;
  current_qty: number;
  notes: string | null;
};

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("items")
        .select("id, code, name, notes, sort_order, item_count, ministry_qty, custody_recipient, custody_entity, image_url")
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

export function useAuditLog() {
  return useQuery({
    queryKey: ["audit_log"],
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from("audit_log")
        .select(
          "id, table_name, record_id, action, actor_id, actor_email, before_data, after_data, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
  });
}

export function useInventoryCounts() {
  return useQuery({
    queryKey: ["inventory_counts"],
    queryFn: async (): Promise<InventoryCount[]> => {
      const { data, error } = await supabase
        .from("inventory_counts")
        .select(
          "id, counted_on, counted_by_name, location_id, counters, branch_manager_name, branch_manager_title, notes, created_at",
        )
        .order("counted_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InventoryCount[];
    },
  });
}

export function useInventoryCountLines(countId: string | null) {
  return useQuery({
    queryKey: ["inventory_count_lines", countId],
    enabled: !!countId,
    queryFn: async (): Promise<InventoryCountLine[]> => {
      const { data, error } = await supabase
        .from("inventory_count_lines")
        .select("id, count_id, item_id, counted_qty, system_qty, ministry_qty, current_qty, notes")
        .eq("count_id", countId!);
      if (error) throw error;
      return (data ?? []) as InventoryCountLine[];
    },
  });
}

/** إجمالي الرصيد الحالي لكل صنف مستمدًا من التوزيع والتحركات */
export function totalsByItem(dist: DistRow[]) {
  const m = new Map<number, number>();
  for (const r of dist) m.set(r.item_id, (m.get(r.item_id) ?? 0) + r.qty);
  return m;
}

export type ItemsPage = { rows: Item[]; total: number };

/** ترقيم صفحات على مستوى قاعدة البيانات لدليل الأصناف */
export function useItemsPage(page: number, pageSize: number, search: string) {
  return useQuery({
    queryKey: ["items-page", page, pageSize, search],
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ItemsPage> => {
      const from = (page - 1) * pageSize;
      let query = supabase
        .from("items")
        .select(
          "id, code, name, notes, sort_order, item_count, ministry_qty, custody_recipient, custody_entity, image_url",
          { count: "exact" },
        );
      const t = search.trim();
      if (t) {
        const safe = t.replace(/[,%()]/g, " ").trim();
        query = query.or(
          `name.ilike.%${safe}%,code.ilike.%${safe}%,custody_recipient.ilike.%${safe}%,custody_entity.ilike.%${safe}%`,
        );
      }
      const { data, error, count } = await query
        .order("sort_order")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      return { rows: (data ?? []) as Item[], total: count ?? 0 };
    },
  });
}

export type ProfileRow = { id: string; email: string | null; full_name: string | null };

export function useProfiles(enabled: boolean) {
  return useQuery({
    queryKey: ["profiles"],
    enabled,
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
}

export function useUserRoles(enabled: boolean) {
  return useQuery({
    queryKey: ["user_roles"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("id, user_id, role");
      if (error) throw error;
      return (data ?? []) as { id: string; user_id: string; role: string }[];
    },
  });
}

/** رابط مؤقت لعرض صورة الصنف المخزّنة في مساحة التخزين الخاصة */
export function useItemImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["item-image", path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data, error } = await supabase.storage
        .from("item-images")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** زر المزامنة اليدوية: يعيد تحميل كل البيانات المخزّنة */
export function useManualSync() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await qc.invalidateQueries();
      await qc.refetchQueries({ type: "active" });
      setLastSynced(new Date());
    } finally {
      setSyncing(false);
    }
  }, [qc]);

  return { sync, syncing, lastSynced };
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

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function buildMatrix(dist: DistRow[]) {
  const map = new Map<string, number>();
  for (const r of dist) map.set(`${r.item_id}:${r.location_id}`, r.qty);
  return map;
}
