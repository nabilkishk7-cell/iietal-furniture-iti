import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, Package } from "lucide-react";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { useAccess } from "@/lib/auth";
import { formatNumber, useDistribution, useItems, useLocations } from "@/lib/data";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "البحث والاستعلام — عهدة الأثاث ITI" },
      {
        name: "description",
        content: "بحث موحّد بالمكان أو بالصنف لعرض محتويات أي مكان أو أماكن وجود أي صنف وأعداده.",
      },
      { property: "og:title", content: "البحث والاستعلام — عهدة الأثاث ITI" },
      {
        property: "og:description",
        content: "استعلام سريع عن محتويات الأماكن وأرصدة الأصناف داخل عهدة الأثاث.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const access = useAccess();
  return <AppShell>{access.canViewSearch ? <SearchView /> : <AccessDenied />}</AppShell>;
}

function SearchView() {
  const items = useItems();
  const locations = useLocations();
  const dist = useDistribution();
  const [mode, setMode] = useState<"location" | "item">("location");
  const [locationId, setLocationId] = useState("");
  const [itemId, setItemId] = useState("");

  const rows = dist.data ?? [];

  const byLocation = useMemo(() => {
    if (!locationId) return [];
    return rows
      .filter((r) => String(r.location_id) === locationId && r.qty !== 0)
      .map((r) => ({
        item: items.data?.find((i) => i.id === r.item_id),
        qty: r.qty,
      }))
      .filter((r) => r.item)
      .sort((a, b) => (a.item!.sort_order ?? 0) - (b.item!.sort_order ?? 0));
  }, [rows, locationId, items.data]);

  const byItem = useMemo(() => {
    if (!itemId) return [];
    return rows
      .filter((r) => String(r.item_id) === itemId && r.qty !== 0)
      .map((r) => ({
        location: locations.data?.find((l) => l.id === r.location_id),
        qty: r.qty,
      }))
      .filter((r) => r.location)
      .sort((a, b) => (a.location!.sort_order ?? 0) - (b.location!.sort_order ?? 0));
  }, [rows, itemId, locations.data]);

  const selectedItem = items.data?.find((i) => String(i.id) === itemId);
  const locationTotal = byLocation.reduce((s, r) => s + r.qty, 0);
  const itemTotal = byItem.reduce((s, r) => s + r.qty, 0);

  return (
    <>
      <PageHeader
        title="البحث والاستعلام"
        description="ابحث بالمكان لعرض كل الأصناف الموجودة فيه، أو بالصنف لعرض رصيده الإجمالي وأماكن تواجده."
      />

      <div className="mb-6 inline-flex rounded-xl border border-border bg-card p-1 shadow-card">
        <button
          onClick={() => setMode("location")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === "location" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          <MapPin className="h-4 w-4" /> البحث بالمكان
        </button>
        <button
          onClick={() => setMode("item")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === "item" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          <Package className="h-4 w-4" /> البحث بالصنف
        </button>
      </div>

      {mode === "location" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <label className="block min-w-72 flex-1">
              <span className="mb-1.5 block text-sm font-medium">اختر المكان</span>
              <select
                className="input"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">— اختر المكان —</option>
                {(locations.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-xl bg-accent/15 px-5 py-3">
              <p className="text-xs text-muted-foreground">إجمالي القطع في المكان</p>
              <p className="font-display text-2xl font-bold">{formatNumber(locationTotal)}</p>
            </div>
          </div>

          <ResultTable
            headers={["م", "الصنف", "الكود", "العدد"]}
            empty={locationId ? "لا توجد أصناف في هذا المكان." : "اختر مكانًا لعرض محتوياته."}
            rows={byLocation.map((r, i) => [
              String(i + 1),
              r.item!.name,
              r.item!.code,
              formatNumber(r.qty),
            ])}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <label className="block min-w-72 flex-1">
              <span className="mb-1.5 block text-sm font-medium">اختر الصنف</span>
              <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">— اختر الصنف —</option>
                {(items.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-xl bg-muted px-5 py-3">
              <p className="text-xs text-muted-foreground">الكود</p>
              <p className="font-display text-lg font-bold" dir="ltr">
                {selectedItem?.code ?? "—"}
              </p>
            </div>
            <div className="rounded-xl bg-accent/15 px-5 py-3">
              <p className="text-xs text-muted-foreground">الرصيد الاجمالي</p>
              <p className="font-display text-2xl font-bold">{formatNumber(itemTotal)}</p>
            </div>
          </div>

          <ResultTable
            headers={["م", "الأماكن الموجود بها الصنف", "العدد"]}
            empty={itemId ? "هذا الصنف غير موزّع على أي مكان." : "اختر صنفًا لعرض أماكن تواجده."}
            rows={byItem.map((r, i) => [String(i + 1), r.location!.name, formatNumber(r.qty)])}
          />
        </div>
      )}
    </>
  );
}

function ResultTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            {headers.map((h) => (
              <th key={h} className="p-2.5 text-right first:w-14 first:text-center">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="p-10 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-border/70 odd:bg-muted/40">
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={
                      j === 0
                        ? "p-2.5 text-center text-muted-foreground"
                        : j === r.length - 1
                          ? "p-2.5 font-semibold"
                          : "p-2.5"
                    }
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
