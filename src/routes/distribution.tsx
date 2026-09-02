import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, FileText, Info } from "lucide-react";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { useAccess } from "@/lib/auth";
import { buildMatrix, formatNumber, useDistribution, useItems, useLocations } from "@/lib/data";
import { ItemImage } from "@/components/ItemImage";
import { exportPdf } from "@/lib/export";

export const Route = createFileRoute("/distribution")({
  head: () => ({
    meta: [
      { title: "توزيع عهدة الأثاث — ITI" },
      {
        name: "description",
        content: "جدول توزيع أصناف عهدة الأثاث على جميع الأماكن مع الرصيد والإجمالي لكل صنف.",
      },
      { property: "og:title", content: "توزيع عهدة الأثاث — ITI" },
      {
        property: "og:description",
        content: "مصفوفة التوزيع الكاملة للأصناف على الأماكن كما في ملف العهدة الأصلي.",
      },
    ],
  }),
  component: DistributionPage,
});

function DistributionPage() {
  const access = useAccess();
  return <AppShell>{access.canViewDistribution ? <Distribution /> : <AccessDenied />}</AppShell>;
}

function Distribution() {
  const items = useItems();
  const locations = useLocations();
  const dist = useDistribution();
  const [onlyUsedLocations, setOnlyUsedLocations] = useState(true);

  const matrix = useMemo(() => buildMatrix(dist.data ?? []), [dist.data]);

  const locationTotals = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of dist.data ?? []) m.set(r.location_id, (m.get(r.location_id) ?? 0) + r.qty);
    return m;
  }, [dist.data]);

  const visibleLocations = useMemo(
    () =>
      (locations.data ?? []).filter(
        (l) => !onlyUsedLocations || (locationTotals.get(l.id) ?? 0) !== 0,
      ),
    [locations.data, onlyUsedLocations, locationTotals],
  );

  const visibleItems = items.data ?? [];

  const itemTotal = (itemId: number) =>
    (locations.data ?? []).reduce((s, l) => s + (matrix.get(`${itemId}:${l.id}`) ?? 0), 0);

  const grandTotal = (dist.data ?? []).reduce((s, r) => s + r.qty, 0);

  function exportCsv() {
    const header = ["م", "الصنف", "رقم الكود", ...visibleLocations.map((l) => l.name), "الإجمالي"];
    const rows = visibleItems.map((it, idx) => [
      String(idx + 1),
      it.name,
      it.code,
      ...visibleLocations.map((l) => String(matrix.get(`${it.id}:${l.id}`) ?? 0)),
      String(itemTotal(it.id)),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "توزيع-عهدة-الأثاث.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdfFile() {
    exportPdf({
      title: "توزيع عهدة الأثاث",
      subtitle: `إجمالي القطع: ${formatNumber(grandTotal)} — عدد الأماكن: ${visibleLocations.length}`,
      headers: ["م", "الصنف", "رقم الكود", ...visibleLocations.map((l) => l.name), "الإجمالي"],
      rows: visibleItems.map((it, idx) => [
        idx + 1,
        it.name,
        it.code,
        ...visibleLocations.map((l) => matrix.get(`${it.id}:${l.id}`) ?? 0),
        itemTotal(it.id),
      ]),
      fileName: "distribution",
    });
  }

  return (
    <>
      <PageHeader
        title="توزيع عهدة الأثاث"
        description="الرصيد الحالي لكل صنف موزّعًا على الأماكن = الرصيد الافتتاحي + حركات العهدة."
        actions={
          <div className="flex flex-wrap gap-2">
          <button
            onClick={exportPdfFile}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <FileText className="h-4 w-4" />
            تصدير PDF
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            تصدير CSV
          </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyUsedLocations}
            onChange={(e) => setOnlyUsedLocations(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          إظهار الأماكن التي بها عهدة فقط
        </label>
        <span className="ms-auto rounded-lg bg-muted px-3 py-1.5 text-sm">
          الإجمالي الكلي: <strong>{formatNumber(grandTotal)}</strong> قطعة
        </span>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          هذا الجدول للعرض فقط. أي نقل بين الأماكن يتم تسجيله من صفحة <strong>تحركات العهدة</strong>{" "}
          وينعكس هنا وفي باقي التقارير تلقائيًا.
        </p>
      </div>

      <div className="overflow-auto rounded-2xl border border-border bg-card shadow-card scroll-thin">
        <table className="min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="bg-primary text-primary-foreground">
              <th className="sticky right-0 z-30 min-w-12 bg-primary p-2 text-center">م</th>
              <th className="sticky right-12 z-30 min-w-16 bg-primary p-2 text-center">الصورة</th>
              <th className="sticky right-28 z-30 min-w-72 bg-primary p-2 text-right">الصنــف</th>
              <th className="p-2 text-center">رقم الكود</th>
              <th className="p-2 text-center">الرصيد</th>
              {visibleLocations.map((l) => (
                <th key={l.id} className="min-w-24 p-2 text-center text-xs font-medium">
                  <span className="block max-w-28 whitespace-normal leading-tight">{l.name}</span>
                </th>
              ))}
              <th className="min-w-20 bg-accent/80 p-2 text-center text-accent-foreground">الاجمالى</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((it, idx) => {
              const total = itemTotal(it.id);
              return (
                <tr key={it.id} className="border-b border-border/70 odd:bg-muted/40">
                  <td className="sticky right-0 z-10 bg-inherit p-2 text-center text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="sticky right-12 z-10 bg-inherit p-2">
                    <ItemImage path={it.image_url} name={it.name} />
                  </td>
                  <td className="sticky right-28 z-10 bg-inherit p-2 font-medium">{it.name}</td>
                  <td className="p-2 text-center text-muted-foreground" dir="ltr">
                    {it.code}
                  </td>
                  <td className="p-2 text-center font-semibold">{formatNumber(total)}</td>
                  {visibleLocations.map((l) => {
                    const v = matrix.get(`${it.id}:${l.id}`) ?? 0;
                    return (
                      <td
                        key={l.id}
                        className={
                          v < 0
                            ? "p-2 text-center font-bold text-destructive"
                            : v > 0
                              ? "p-2 text-center font-semibold text-foreground"
                              : "p-2 text-center text-muted-foreground/40"
                        }
                      >
                        {v === 0 ? "0" : formatNumber(v)}
                      </td>
                    );
                  })}
                  <td className="bg-accent/10 p-2 text-center font-bold">{formatNumber(total)}</td>
                </tr>
              );
            })}
            <tr className="bg-secondary font-bold">
              <td className="sticky right-0 z-10 bg-secondary p-2" />
              <td className="sticky right-12 z-10 bg-secondary p-2" />
              <td className="sticky right-28 z-10 bg-secondary p-2">إجمالي المكان</td>
              <td className="p-2" />
              <td className="p-2 text-center">{formatNumber(grandTotal)}</td>
              {visibleLocations.map((l) => (
                <td key={l.id} className="p-2 text-center">
                  {formatNumber(locationTotals.get(l.id) ?? 0)}
                </td>
              ))}
              <td className="bg-accent/20 p-2 text-center">{formatNumber(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
