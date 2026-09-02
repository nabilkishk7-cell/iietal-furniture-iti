import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/auth";
import {
  useItems,
  useLocations,
  useInventoryCounts,
  useInventoryCountLines,
  useDistribution,
  arabicWeekday,
  formatNumber,
  type Counter,
} from "@/lib/data";
import { exportPdf } from "@/lib/export";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "الجرد — عهدة الأثاث ITI المنوفية" },
      {
        name: "description",
        content:
          "تسجيل جرد عهدة الأثاث بالتاريخ واليوم والقائمين بالجرد ومقارنة الكمية الواردة من الوزارة بالكمية الحالية مع تصدير PDF.",
      },
      { property: "og:title", content: "الجرد — عهدة الأثاث ITI" },
      {
        property: "og:description",
        content: "إنشاء محاضر الجرد مع المراجعة الآلية للكميات وحفظها وتصديرها.",
      },
    ],
  }),
  component: InventoryPage,
});

const emptyCounters: Counter[] = [{ name: "", title: "" }];

function InventoryPage() {
  const access = useAccess();
  const qc = useQueryClient();
  const { data: items = [] } = useItems();
  const { data: locations = [] } = useLocations();
  const { data: counts = [] } = useInventoryCounts();
  const { data: dist = [] } = useDistribution();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: lines = [] } = useInventoryCountLines(selected);

  const [countedOn, setCountedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [counters, setCounters] = useState<Counter[]>(emptyCounters);
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const activeCount = counts.find((c) => c.id === selected) ?? null;

  /** الكمية الحالية لكل صنف (اختياريًا داخل مكان محدد) */
  const currentQtyMap = useMemo(() => {
    const locFilter = activeCount ? activeCount.location_id : locationId ? Number(locationId) : null;
    const m = new Map<number, number>();
    for (const r of dist) {
      if (locFilter && r.location_id !== locFilter) continue;
      m.set(r.item_id, (m.get(r.item_id) ?? 0) + r.qty);
    }
    return m;
  }, [dist, locationId, activeCount]);

  function validate(): string[] {
    const errs: string[] = [];
    if (!countedOn) errs.push("تاريخ الجرد مطلوب");
    else if (new Date(countedOn + "T00:00:00") > new Date())
      errs.push("لا يمكن أن يكون تاريخ الجرد في المستقبل");

    const filled = counters.filter((c) => c.name.trim() || c.title.trim());
    if (filled.length === 0) errs.push("أضف قائمًا بالجرد واحدًا على الأقل");
    filled.forEach((c, i) => {
      if (!c.name.trim()) errs.push(`اسم القائم بالجرد رقم ${i + 1} مطلوب`);
      if (!c.title.trim()) errs.push(`الوظيفة للقائم بالجرد رقم ${i + 1} مطلوبة`);
    });
    const names = filled.map((c) => c.name.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) errs.push("لا يمكن تكرار اسم القائم بالجرد");

    const entries = Object.entries(qty).filter(([, v]) => v.trim() !== "");
    if (entries.length === 0) errs.push("أدخل الكمية المجرودة لصنف واحد على الأقل");
    for (const [k, v] of entries) {
      const n = Number(v);
      const it = items.find((i) => i.id === Number(k));
      if (!Number.isInteger(n) || n < 0)
        errs.push(`الكمية المجرودة للصنف «${it?.name ?? k}» يجب أن تكون عددًا صحيحًا غير سالب`);
    }
    return errs;
  }

  const save = useMutation({
    mutationFn: async () => {
      const errs = validate();
      setErrors(errs);
      if (errs.length) throw new Error("راجع أخطاء البيانات قبل الحفظ");
      const filled = counters.filter((c) => c.name.trim());
      const rows = Object.entries(qty)
        .filter(([, v]) => v.trim() !== "")
        .map(([k, v]) => ({
          item_id: Number(k),
          counted_qty: Number(v),
          ministry_qty: items.find((i) => i.id === Number(k))?.ministry_qty ?? 0,
          current_qty: currentQtyMap.get(Number(k)) ?? 0,
        }));
      const { data, error } = await supabase
        .from("inventory_counts")
        .insert({
          counted_on: countedOn,
          counted_by_name: filled.map((c) => `${c.name.trim()} (${c.title.trim()})`).join(" / "),
          counters: filled.map((c) => ({ name: c.name.trim(), title: c.title.trim() })),
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
      setErrors([]);
      void qc.invalidateQueries({ queryKey: ["inventory_counts"] });
      setSelected(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tableRows = useMemo(() => {
    if (selected) {
      return lines.map((l) => {
        const it = items.find((i) => i.id === l.item_id);
        return {
          id: l.item_id,
          code: it?.code ?? "—",
          name: it?.name ?? "—",
          ministry: l.ministry_qty,
          current: l.current_qty,
          counted: l.counted_qty as number | null,
        };
      });
    }
    return items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      ministry: i.ministry_qty,
      current: currentQtyMap.get(i.id) ?? 0,
      counted: qty[i.id]?.trim() === "" || qty[i.id] === undefined ? null : Number(qty[i.id]),
    }));
  }, [selected, lines, items, qty, currentQtyMap]);

  function pdf() {
    const date = activeCount?.counted_on ?? countedOn;
    const people = activeCount
      ? (activeCount.counters?.length
          ? activeCount.counters.map((c) => `${c.name} (${c.title})`).join(" / ")
          : activeCount.counted_by_name)
      : counters
          .filter((c) => c.name.trim())
          .map((c) => `${c.name} (${c.title})`)
          .join(" / ");
    const locId = activeCount ? activeCount.location_id : locationId ? Number(locationId) : null;
    const loc = locId ? (locations.find((l) => l.id === locId)?.name ?? "—") : "كل الأماكن";
    exportPdf({
      title: "محضر جرد عهدة الأثاث",
      subtitle: `التاريخ: ${date} — اليوم: ${arabicWeekday(date)} — القائمون بالجرد: ${people || "—"} — المكان: ${loc}`,
      headers: [
        "كود الصنف",
        "اسم الصنف",
        "الكمية الواردة من الوزارة",
        "الكمية الحالية",
        "الكمية المجرودة",
        "المراجعة",
      ],
      rows: tableRows.map((r) => [
        r.code,
        r.name,
        r.ministry,
        r.current,
        r.counted ?? "—",
        r.ministry === r.current ? "مطابق ✓" : "غير مطابق ✗",
      ]),
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

  const readOnly = !!selected || !access.canEditInventory;

  return (
    <AppShell>
      <PageHeader
        title="الجرد"
        description="تسجيل الجرد الفعلي ومقارنة الكمية الواردة من الوزارة بالكمية الحالية مع مراجعة آلية وتصدير PDF."
        actions={
          <button
            onClick={pdf}
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            تصدير PDF
          </button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">
          تاريخ الجرد
          <input
            type="date"
            className="input mt-1.5"
            max={new Date().toISOString().slice(0, 10)}
            value={activeCount?.counted_on ?? countedOn}
            disabled={!!selected}
            onChange={(e) => setCountedOn(e.target.value)}
          />
        </label>
        <div className="text-sm font-medium">
          اليوم
          <div className="input mt-1.5 bg-muted">
            {arabicWeekday(activeCount?.counted_on ?? countedOn)}
          </div>
        </div>
        <label className="text-sm font-medium">
          المكان (اختياري)
          <select
            className="input mt-1.5"
            value={activeCount ? String(activeCount.location_id ?? "") : locationId}
            disabled={!!selected}
            onChange={(e) => setLocationId(e.target.value)}
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

      <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold">القائمون بالجرد (حتى ٣ أشخاص)</h2>
          {!readOnly && counters.length < 3 && (
            <button
              onClick={() => setCounters([...counters, { name: "", title: "" }])}
              className="rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-muted"
            >
              إضافة قائم بالجرد
            </button>
          )}
        </div>
        {selected ? (
          <ul className="space-y-1 text-sm">
            {(activeCount?.counters?.length
              ? activeCount.counters
              : [{ name: activeCount?.counted_by_name ?? "—", title: "" }]
            ).map((c, i) => (
              <li key={i}>
                <strong>{c.name}</strong>
                {c.title ? ` — ${c.title}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {counters.map((c, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs text-muted-foreground">القائم بالجرد {i + 1}</p>
                <input
                  className="input mb-2"
                  placeholder="الاسم"
                  value={c.name}
                  disabled={readOnly}
                  onChange={(e) =>
                    setCounters(counters.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                />
                <input
                  className="input"
                  placeholder="الوظيفة"
                  value={c.title}
                  disabled={readOnly}
                  onChange={(e) =>
                    setCounters(
                      counters.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
                {!readOnly && counters.length > 1 && (
                  <button
                    onClick={() => setCounters(counters.filter((_, j) => j !== i))}
                    className="mt-2 text-xs text-destructive hover:underline"
                  >
                    حذف
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="mb-4 list-inside list-disc space-y-1 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-primary text-xs text-primary-foreground">
              <tr>
                <th className="p-3 text-right">كود الصنف</th>
                <th className="p-3 text-right">اسم الصنف</th>
                <th className="p-3 text-center">الكمية الواردة من الوزارة</th>
                <th className="p-3 text-center">الكمية الحالية</th>
                <th className="p-3 text-center">الكمية المجرودة</th>
                <th className="p-3 text-center">مراجعة</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => {
                const ok = r.ministry === r.current;
                return (
                  <tr key={r.id} className="border-t border-border/70">
                    <td className="p-3 font-medium" dir="ltr">
                      {r.code}
                    </td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3 text-center">{formatNumber(r.ministry)}</td>
                    <td className="p-3 text-center font-semibold">{formatNumber(r.current)}</td>
                    <td className="p-2 text-center">
                      {readOnly ? (
                        <span>{r.counted === null ? "—" : formatNumber(r.counted)}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          className="input mx-auto max-w-[120px]"
                          value={qty[r.id] ?? ""}
                          onChange={(e) => setQty({ ...qty, [r.id]: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full ${ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
                        title={ok ? "مطابق" : "غير مطابق"}
                      >
                        {ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </span>
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
                {save.isPending ? "جارٍ الحفظ…" : "حفظ محضر الجرد"}
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h2 className="mb-3 font-display text-base font-bold">محاضر الجرد المحفوظة</h2>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setSelected(null);
                  setErrors([]);
                }}
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
