import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/auth";
import {
  useItems,
  useLocations,
  useInventoryCounts,
  useInventoryCountLines,
  arabicWeekday,
  formatNumber,
} from "@/lib/data";
import { exportPdf } from "@/lib/export";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "الجرد — عهدة الأثاث ITI المنوفية" },
      {
        name: "description",
        content: "تسجيل جرد عهدة الأثاث بالتاريخ واليوم والقائم بالجرد وأكواد الأصناف والكميات مع تصدير PDF.",
      },
      { property: "og:title", content: "الجرد — عهدة الأثاث ITI" },
      { property: "og:description", content: "إنشاء محاضر الجرد وحفظها وتصديرها." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const access = useAccess();
  const qc = useQueryClient();
  const { data: items = [] } = useItems();
  const { data: locations = [] } = useLocations();
  const { data: counts = [] } = useInventoryCounts();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: lines = [] } = useInventoryCountLines(selected);

  const [countedOn, setCountedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [person, setPerson] = useState("");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<number, string>>({});

  const activeCount = counts.find((c) => c.id === selected) ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!person.trim()) throw new Error("اسم القائم بالجرد مطلوب");
      const rows = Object.entries(qty)
        .filter(([, v]) => v !== "" && !Number.isNaN(Number(v)))
        .map(([k, v]) => ({ item_id: Number(k), counted_qty: Number(v) }));
      if (!rows.length) throw new Error("أدخل كمية واحدة على الأقل");
      const { data, error } = await supabase
        .from("inventory_counts")
        .insert({
          counted_on: countedOn,
          counted_by_name: person.trim(),
          location_id: locationId ? Number(locationId) : null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: le } = await supabase
        .from("inventory_count_lines")
        .insert(rows.map((r) => ({ ...r, count_id: data.id })));
      if (le) throw le;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("تم حفظ محضر الجرد");
      setQty({});
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["inventory_counts"] });
      setSelected(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentRows = useMemo(() => {
    if (selected) {
      return lines.map((l) => {
        const it = items.find((i) => i.id === l.item_id);
        return [it?.code ?? "—", it?.name ?? "—", l.counted_qty];
      });
    }
    return items
      .filter((i) => qty[i.id] !== undefined && qty[i.id] !== "")
      .map((i) => [i.code, i.name, Number(qty[i.id])]);
  }, [selected, lines, items, qty]);

  function pdf() {
    const c = activeCount;
    const date = c?.counted_on ?? countedOn;
    const by = c?.counted_by_name ?? person;
    const loc = c?.location_id
      ? (locations.find((l) => l.id === c.location_id)?.name ?? "")
      : locationId
        ? (locations.find((l) => l.id === Number(locationId))?.name ?? "")
        : "كل الأماكن";
    exportPdf({
      title: "محضر جرد عهدة الأثاث",
      subtitle: `التاريخ: ${date} — اليوم: ${arabicWeekday(date)} — القائم بالجرد: ${by || "—"} — المكان: ${loc}`,
      headers: ["كود الصنف", "اسم الصنف", "الكمية المجرودة"],
      rows: currentRows,
      fileName: `inventory-${date}`,
    });
  }

  if (!access.canViewInventory) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="الجرد"
        description="تسجيل الجرد الفعلي للأصناف وحفظه في قاعدة البيانات مع إمكانية تصديره PDF."
        actions={
          <button
            onClick={pdf}
            className="rounded-lg border border-input bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted"
          >
            تصدير PDF
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">
          تاريخ الجرد
          <input
            type="date"
            className="input mt-1.5"
            value={activeCount?.counted_on ?? countedOn}
            onChange={(e) => {
              setSelected(null);
              setCountedOn(e.target.value);
            }}
          />
        </label>
        <div className="text-sm font-medium">
          اليوم
          <div className="input mt-1.5 bg-muted">{arabicWeekday(activeCount?.counted_on ?? countedOn)}</div>
        </div>
        <label className="text-sm font-medium">
          القائم بالجرد
          <input
            className="input mt-1.5"
            value={activeCount?.counted_by_name ?? person}
            onChange={(e) => {
              setSelected(null);
              setPerson(e.target.value);
            }}
          />
        </label>
        <label className="text-sm font-medium">
          المكان (اختياري)
          <select
            className="input mt-1.5"
            value={activeCount ? String(activeCount.location_id ?? "") : locationId}
            onChange={(e) => {
              setSelected(null);
              setLocationId(e.target.value);
            }}
          >
            <option value="">كل الأماكن</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs">
              <tr>
                <th className="p-3 text-right">كود الصنف</th>
                <th className="p-3 text-right">اسم الصنف</th>
                <th className="p-3 text-right">الكمية المجرودة</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const saved = lines.find((l) => l.item_id === i.id);
                return (
                  <tr key={i.id} className="border-t border-border/70">
                    <td className="p-3 font-medium">{i.code}</td>
                    <td className="p-3">{i.name}</td>
                    <td className="p-2">
                      {selected ? (
                        <span className="px-1">{saved ? formatNumber(saved.counted_qty) : "—"}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          className="input max-w-[130px]"
                          value={qty[i.id] ?? ""}
                          disabled={!access.canEditInventory}
                          onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          {!selected && access.canEditInventory && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <label className="text-sm font-medium">
                ملاحظات
                <textarea
                  className="input mt-1.5 min-h-24"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                حفظ محضر الجرد
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h2 className="mb-3 font-display text-base font-bold">محاضر الجرد المحفوظة</h2>
            <div className="space-y-2">
              <button
                onClick={() => setSelected(null)}
                className={`w-full rounded-lg border px-3 py-2 text-right text-sm ${!selected ? "border-primary bg-primary/10" : "border-input hover:bg-muted"}`}
              >
                محضر جديد
              </button>
              {counts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-right text-sm ${selected === c.id ? "border-primary bg-primary/10" : "border-input hover:bg-muted"}`}
                >
                  <span className="block font-medium">{c.counted_on}</span>
                  <span className="block text-xs text-muted-foreground">{c.counted_by_name}</span>
                </button>
              ))}
              {counts.length === 0 && (
                <p className="text-xs text-muted-foreground">لا توجد محاضر محفوظة بعد.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
