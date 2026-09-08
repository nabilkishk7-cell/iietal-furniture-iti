import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Plus, ChevronDown } from "lucide-react";
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
import { Pager } from "@/components/Pager";
import { exportPdf } from "@/lib/export";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "الجرد — عهدة الأثاث ITI المنوفية" },
      {
        name: "description",
        content:
          "محاضر جرد عهدة الأثاث: مقارنة آلية بين العدد بالنظام والكمية المجرودة مع توقيعات لجنة الجرد ومدير الفرع وتصدير PDF.",
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

const emptyCounters: Counter[] = [
  { name: "", title: "" },
  { name: "", title: "" },
  { name: "", title: "" },
];

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
  const [manager, setManager] = useState<Counter>({ name: "", title: "مدير الفرع" });
  const [locationIds, setLocationIds] = useState<number[]>([]);
  const [locOpen, setLocOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const activeCount = counts.find((c) => c.id === selected) ?? null;

  /** العدد بالنظام لكل صنف (اختياريًا داخل مكان محدد) — مستمد من التوزيع والتحركات */
  const systemQtyMap = useMemo(() => {
    const locFilter = activeCount
      ? activeCount.location_id
        ? [activeCount.location_id]
        : []
      : locationIds;
    const m = new Map<number, number>();
    for (const r of dist) {
      if (locFilter.length && !locFilter.includes(r.location_id)) continue;
      m.set(r.item_id, (m.get(r.item_id) ?? 0) + r.qty);
    }
    return m;
  }, [dist, locationIds, activeCount]);

  function validate(): string[] {
    const errs: string[] = [];
    if (!countedOn) errs.push("تاريخ الجرد مطلوب");
    else if (Number.isNaN(new Date(countedOn + "T00:00:00").getTime()))
      errs.push("تاريخ الجرد غير صالح");
    else if (new Date(countedOn + "T00:00:00") > new Date())
      errs.push("لا يمكن أن يكون تاريخ الجرد في المستقبل");

    if (locationIds.some((id) => !locations.some((l) => l.id === id)))
      errs.push("أحد الأماكن المحددة غير موجود");

    const filled = counters.filter((c) => c.name.trim() || c.title.trim());
    if (filled.length === 0) errs.push("أضف عضو لجنة جرد واحدًا على الأقل");
    filled.forEach((c, i) => {
      if (!c.name.trim()) errs.push(`اسم عضو لجنة الجرد رقم ${i + 1} مطلوب`);
      else if (c.name.trim().length < 3) errs.push(`اسم عضو لجنة الجرد رقم ${i + 1} قصير جدًا`);
      if (!c.title.trim()) errs.push(`الوظيفة لعضو لجنة الجرد رقم ${i + 1} مطلوبة`);
    });
    const names = filled.map((c) => c.name.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) errs.push("لا يمكن تكرار اسم عضو لجنة الجرد");

    if (!manager.name.trim()) errs.push("اسم مدير الفرع مطلوب للتوقيع");
    if (!manager.title.trim()) errs.push("وظيفة مدير الفرع مطلوبة");

    const entries = Object.entries(qty).filter(([, v]) => v.trim() !== "");
    if (entries.length === 0) errs.push("أدخل الكمية المجرودة لصنف واحد على الأقل");
    for (const [k, v] of entries) {
      const n = Number(v);
      const it = items.find((i) => i.id === Number(k));
      if (!it) {
        errs.push("أحد الأصناف المُدخلة غير موجود");
        continue;
      }
      if (!Number.isInteger(n) || n < 0)
        errs.push(`الكمية المجرودة للصنف «${it.name}» يجب أن تكون عددًا صحيحًا غير سالب`);
      else if (n > 1_000_000) errs.push(`الكمية المجرودة للصنف «${it.name}» كبيرة بشكل غير منطقي`);
    }
    if (notes.length > 500) errs.push("الملاحظات أطول من ٥٠٠ حرف");
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
          system_qty: systemQtyMap.get(Number(k)) ?? 0,
        }));
      const { data, error } = await supabase
        .from("inventory_counts")
        .insert({
          counted_on: countedOn,
          counted_by_name: filled.map((c) => `${c.name.trim()} (${c.title.trim()})`).join(" / "),
          counters: filled.map((c) => ({ name: c.name.trim(), title: c.title.trim() })),
          branch_manager_name: manager.name.trim(),
          branch_manager_title: manager.title.trim(),
          location_id: locationIds.length === 1 ? locationIds[0]! : null,
          notes:
            [
              notes.trim(),
              locationIds.length > 1
                ? `الأماكن: ${locationIds.map((id) => locations.find((l) => l.id === id)?.name ?? "").join(" ، ")}`
                : "",
            ]
              .filter(Boolean)
              .join(" — ") || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: le } = await supabase
        .from("inventory_count_lines")
        .insert(rows.map((r) => ({ ...r, count_id: data.id })));
      if (le) {
        await supabase.from("inventory_counts").delete().eq("id", data.id);
        throw le;
      }
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("تم حفظ محضر الجرد بنجاح");
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
          system: l.system_qty,
          counted: l.counted_qty as number | null,
        };
      });
    }
    return items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      system: systemQtyMap.get(i.id) ?? 0,
      counted: qty[i.id]?.trim() === "" || qty[i.id] === undefined ? null : Number(qty[i.id]),
    }));
  }, [selected, lines, items, qty, systemQtyMap]);

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(
    () => tableRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [tableRows, currentPage],
  );

  const activeCounters: Counter[] = activeCount
    ? activeCount.counters?.length
      ? activeCount.counters
      : [{ name: activeCount.counted_by_name ?? "—", title: "" }]
    : counters.filter((c) => c.name.trim());

  function pdf() {
    const date = activeCount?.counted_on ?? countedOn;
    const locNames = activeCount
      ? activeCount.location_id
        ? [locations.find((l) => l.id === activeCount.location_id)?.name ?? "—"]
        : []
      : locationIds.map((id) => locations.find((l) => l.id === id)?.name ?? "—");
    const loc = locNames.length ? locNames.join(" ، ") : "كل الأماكن";
    const matched = tableRows.filter((r) => r.counted !== null && r.counted === r.system).length;
    exportPdf({
      title: "محضر جرد عهدة الأثاث — معهد تكنولوجيا المعلومات فرع المنوفية",
      subtitle: `التاريخ: ${date} — اليوم: ${arabicWeekday(date)} — المكان: ${loc} — عدد الأصناف: ${tableRows.length} — المطابق: ${matched}`,
      headers: ["م", "كود الصنف", "اسم الصنف", "العدد بالنظام", "الكمية المجرودة", "المراجعة"],
      rows: tableRows.map((r, i) => [
        i + 1,
        r.code,
        r.name,
        r.system,
        r.counted ?? "—",
        r.counted !== null && r.counted === r.system ? "مطابق ✓" : "غير مطابق ✗",
      ]),
      signatures: activeCounters.map((c) => ({ name: c.name, title: c.title })),
      branchManager: activeCount
        ? {
            name: activeCount.branch_manager_name ?? "",
            title: activeCount.branch_manager_title ?? "مدير الفرع",
          }
        : { name: manager.name, title: manager.title },
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
        description="مقارنة آلية بين العدد بالنظام والكمية المجرودة فعليًا، مع توقيعات لجنة الجرد ومدير الفرع في محضر رسمي قابل للأرشفة."
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
        <div className="relative text-sm font-medium">
          المكان (اختياري — يمكن اختيار أكثر من مكان)
          {selected ? (
            <div className="input mt-1.5 bg-muted">
              {activeCount?.location_id
                ? (locations.find((l) => l.id === activeCount.location_id)?.name ?? "—")
                : "كل الأماكن"}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setLocOpen((o) => !o)}
                className="input mt-1.5 flex items-center justify-between gap-2 text-right"
              >
                <span className="truncate font-normal">
                  {locationIds.length === 0
                    ? "كل الأماكن"
                    : locationIds
                        .map((id) => locations.find((l) => l.id === id)?.name ?? "")
                        .join(" ، ")}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>
              {locOpen && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-card">
                  <button
                    type="button"
                    onClick={() => setLocationIds([])}
                    className="mb-1 w-full rounded-lg px-2 py-1.5 text-right text-xs text-muted-foreground hover:bg-muted"
                  >
                    مسح التحديد (كل الأماكن)
                  </button>
                  {locations.map((l) => (
                    <label
                      key={l.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-normal hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--primary)]"
                        checked={locationIds.includes(l.id)}
                        onChange={(e) =>
                          setLocationIds(
                            e.target.checked
                              ? [...locationIds, l.id]
                              : locationIds.filter((x) => x !== l.id),
                          )
                        }
                      />
                      {l.name}
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold">لجنة الجرد</h2>
          {!readOnly && (
            <button
              onClick={() => setCounters([...counters, { name: "", title: "" }])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Plus className="h-4 w-4" /> إضافة عضو
            </button>
          )}
        </div>
        {selected ? (
          <ul className="space-y-1 text-sm">
            {activeCounters.map((c, i) => (
              <li key={i}>
                <strong>{c.name}</strong>
                {c.title ? ` — ${c.title}` : ""}
              </li>
            ))}
            <li className="pt-2 text-muted-foreground">
              مدير الفرع: <strong>{activeCount?.branch_manager_name ?? "—"}</strong>
              {activeCount?.branch_manager_title ? ` — ${activeCount.branch_manager_title}` : ""}
            </li>
          </ul>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {counters.map((c, i) => (
                <div key={i} className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-xs text-muted-foreground">عضو لجنة الجرد {i + 1}</p>
                  <input
                    className="input mb-2"
                    placeholder="الاسم"
                    value={c.name}
                    disabled={readOnly}
                    onChange={(e) =>
                      setCounters(
                        counters.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                      )
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
            <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium">
                اسم مدير الفرع
                <input
                  className="input mt-1.5"
                  value={manager.name}
                  disabled={readOnly}
                  onChange={(e) => setManager({ ...manager, name: e.target.value })}
                />
              </label>
              <label className="text-sm font-medium">
                وظيفة مدير الفرع
                <input
                  className="input mt-1.5"
                  value={manager.title}
                  disabled={readOnly}
                  onChange={(e) => setManager({ ...manager, title: e.target.value })}
                />
              </label>
            </div>
          </>
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
                <th className="p-3 text-center">العدد</th>
                <th className="p-3 text-center">الكمية المجرودة</th>
                <th className="p-3 text-center">المراجعة</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => {
                const ok = r.counted !== null && r.counted === r.system;
                return (
                  <tr key={r.id} className="border-t border-border/70">
                    <td className="p-3 font-medium" dir="ltr">
                      {r.code}
                    </td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3 text-center font-semibold">{formatNumber(r.system)}</td>
                    <td className="p-2 text-center">
                      {readOnly ? (
                        <span>{r.counted === null ? "—" : formatNumber(r.counted)}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="input mx-auto max-w-[120px]"
                          value={qty[r.id] ?? ""}
                          onChange={(e) => setQty({ ...qty, [r.id]: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`mx-auto flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
                      >
                        {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {ok ? "مطابق" : "غير مطابق"}
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
