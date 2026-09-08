import { ChevronLeft, ChevronRight } from "lucide-react";

/** شريط ترقيم صفحات عربي بسيط: السابق/التالي + أرقام الصفحات */
export function Pager({
  page,
  pageCount,
  total,
  onChange,
  label = "صنف",
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (p: number) => void;
  label?: string;
}) {
  if (pageCount <= 1) return null;

  const pages: (number | "…")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">
        صفحة {page} من {pageCount} — إجمالي {total} {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-input bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
          السابق
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1.5 text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-9 cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                p === page
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "border-input bg-card hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-input bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          التالي
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
