import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, LayoutGrid, Rows3 } from "lucide-react";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { ItemImage } from "@/components/ItemImage";
import { useAccess } from "@/lib/auth";
import { formatNumber, useDistribution, useItemsPage } from "@/lib/data";
import { exportPdf } from "@/lib/export";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "دليل الأصناف — عهدة الأثاث ITI المنوفية" },
      {
        name: "description",
        content:
          "دليل مصوّر لأصناف عهدة الأثاث يعرض الصورة والاسم والكود والعدد ومستلم العهدة والجهة المستلمة.",
      },
      { property: "og:title", content: "دليل الأصناف — عهدة الأثاث ITI" },
      {
        property: "og:description",
        content: "كتالوج بصري كامل لأصناف العهدة مع بيانات الاستلام والجهة المستلمة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const access = useAccess();
  return <AppShell>{access.canViewItems ? <Catalog /> : <AccessDenied />}</AppShell>;
}

const PAGE_SIZE = 12;

function Catalog() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data: dist = [] } = useDistribution();
  const { data: pageData, isFetching } = useItemsPage(page, PAGE_SIZE, q);
  const [view, setView] = useState<"grid" | "table">("grid");

  const totals = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of dist) m.set(r.item_id, (m.get(r.item_id) ?? 0) + r.qty);
    return m;
  }, [dist]);

  const items = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = items.map((i) => ({ item: i, qty: totals.get(i.id) ?? 0 }));

  function pdf() {
    exportPdf({
      title: "دليل أصناف عهدة الأثاث",
      subtitle: `الصفحة ${page} من ${pageCount} — إجمالي الأصناف: ${formatNumber(total)}`,
      headers: ["م", "اسم الصنف", "الكود", "العدد", "مستلم العهدة", "اسم الجهة مستلمة العهدة"],
      rows: rows.map((r, i) => [
        (page - 1) * PAGE_SIZE + i + 1,
        r.item.name,
        r.item.code,
        r.qty,
        r.item.custody_recipient ?? "—",
        r.item.custody_entity ?? "—",
      ]),
      fileName: "items-catalog",
    });
  }

  return (
    <>
      <PageHeader
        title="دليل الأصناف"
        description="كتالوج مصوّر لكل صنف مع الكود والعدد الحالي وبيانات مستلم العهدة والجهة المستلمة."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView(view === "grid" ? "table" : "grid")}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted"
            >
              {view === "grid" ? <Rows3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              {view === "grid" ? "عرض كجدول" : "عرض كبطاقات"}
            </button>
            <button
              onClick={pdf}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <FileText className="h-4 w-4" /> تصدير PDF
            </button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-sm"
          placeholder="ابحث بالاسم أو الكود أو مستلم العهدة…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <p className="text-sm text-muted-foreground">
          إجمالي الأصناف: {formatNumber(total)} — الصفحة {page} من {pageCount}
          {isFetching ? " · جارٍ التحميل…" : ""}
        </p>
      </div>

      {rows.length === 0 && !isFetching && (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          لا توجد أصناف مطابقة.
        </p>
      )}

      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map(({ item, qty }) => (
            <article
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <ItemImage
                path={item.image_url}
                name={item.name}
                className="h-40 w-full rounded-xl"
              />
              <div>
                <h2 className="font-display text-base font-bold leading-snug">{item.name}</h2>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {item.code}
                </p>
              </div>
              <dl className="space-y-1 text-sm">
                <Row label="العدد" value={formatNumber(qty)} strong />
                <Row label="مستلم العهدة" value={item.custody_recipient ?? "—"} />
                <Row label="الجهة المستلمة" value={item.custody_entity ?? "—"} />
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="p-2.5 text-center">م</th>
                <th className="p-2.5 text-center">الصورة</th>
                <th className="p-2.5 text-right">اسم الصنف</th>
                <th className="p-2.5 text-right">الكود</th>
                <th className="p-2.5 text-center">العدد</th>
                <th className="p-2.5 text-right">مستلم العهدة</th>
                <th className="p-2.5 text-right">اسم الجهة مستلمة العهدة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, qty }, i) => (
                <tr key={item.id} className="border-b border-border/70 odd:bg-muted/40">
                  <td className="p-2.5 text-center text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="p-2">
                    <ItemImage path={item.image_url} name={item.name} />
                  </td>
                  <td className="p-2.5 font-medium">{item.name}</td>
                  <td className="p-2.5" dir="ltr">
                    {item.code}
                  </td>
                  <td className="p-2.5 text-center font-semibold">{formatNumber(qty)}</td>
                  <td className="p-2.5">{item.custody_recipient ?? "—"}</td>
                  <td className="p-2.5">{item.custody_entity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          السابق
        </button>
        {Array.from({ length: pageCount }, (_, i) => i + 1)
          .filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 2)
          .map((n, idx, arr) => (
            <span key={n} className="flex items-center gap-2">
              {idx > 0 && arr[idx - 1] !== n - 1 && (
                <span className="text-muted-foreground">…</span>
              )}
              <button
                onClick={() => setPage(n)}
                className={`min-w-9 rounded-lg border px-3 py-1.5 text-sm ${
                  n === page
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-muted"
                }`}
              >
                {formatNumber(n)}
              </button>
            </span>
          ))}
        <button
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          disabled={page >= pageCount}
          className="rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          التالي
        </button>
      </nav>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-bold" : "font-medium"}>{value}</dd>
    </div>
  );
}
