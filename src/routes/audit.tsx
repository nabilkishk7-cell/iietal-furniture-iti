import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { useAccess } from "@/lib/auth";
import { useAuditLog, useItems, useLocations, formatDateTime, type AuditEntry } from "@/lib/data";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "سجل التدقيق — عهدة الأثاث ITI المنوفية" },
      {
        name: "description",
        content: "سجل غير قابل للتعديل لكل إضافة أو تعديل أو حذف في تحركات عهدة الأثاث.",
      },
      { property: "og:title", content: "سجل التدقيق — عهدة الأثاث ITI" },
      {
        property: "og:description",
        content: "من قام بالتعديل ومتى وما الذي تغيّر بالتفصيل.",
      },
    ],
  }),
  component: AuditPage,
});

const ACTION_LABEL: Record<string, string> = {
  INSERT: "إضافة",
  UPDATE: "تعديل",
  DELETE: "حذف",
};

const FIELD_LABEL: Record<string, string> = {
  moved_on: "التاريخ",
  item_id: "الصنف",
  qty: "الكمية",
  from_location_id: "من مكان",
  to_location_id: "إلى مكان",
  security_from: "أمن الصرف",
  security_to: "أمن الاستلام",
  employee_name: "الموظف",
  notes: "ملاحظات",
};

function AuditPage() {
  const access = useAccess();
  const { data: entries = [], isLoading } = useAuditLog();
  const { data: items = [] } = useItems();
  const { data: locations = [] } = useLocations();
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");

  const itemName = (id: unknown) => items.find((i) => i.id === Number(id))?.name ?? String(id ?? "—");
  const locName = (id: unknown) =>
    id == null ? "—" : (locations.find((l) => l.id === Number(id))?.name ?? String(id));

  const fmt = (field: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (field === "item_id") return itemName(v);
    if (field === "from_location_id" || field === "to_location_id") return locName(v);
    return String(v);
  };

  const summary = (e: AuditEntry) => {
    const before = e.before_data ?? {};
    const after = e.after_data ?? {};
    const keys = Object.keys(FIELD_LABEL);
    if (e.action === "INSERT") {
      return keys
        .filter((k) => after[k] !== null && after[k] !== undefined && after[k] !== "")
        .map((k) => `${FIELD_LABEL[k]}: ${fmt(k, after[k])}`)
        .join(" · ");
    }
    if (e.action === "DELETE") {
      return keys
        .filter((k) => before[k] !== null && before[k] !== undefined && before[k] !== "")
        .map((k) => `${FIELD_LABEL[k]}: ${fmt(k, before[k])}`)
        .join(" · ");
    }
    const changes = keys
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => `${FIELD_LABEL[k]}: ${fmt(k, before[k])} ← ${fmt(k, after[k])}`);
    return changes.length ? changes.join(" · ") : "لا تغييرات جوهرية";
  };

  const rows = useMemo(() => {
    return entries.filter((e) => {
      if (action && e.action !== action) return false;
      if (q.trim() && !(e.actor_email ?? "").includes(q.trim()) && !summary(e).includes(q.trim()))
        return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, action, q, items, locations]);

  if (!access.canViewAudit) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="سجل التدقيق"
        description="سجل دائم لا يمكن تعديله أو حذفه، يوثّق كل عملية على تحركات العهدة."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input max-w-[200px]" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">كل العمليات</option>
          <option value="INSERT">إضافة</option>
          <option value="UPDATE">تعديل</option>
          <option value="DELETE">حذف</option>
        </select>
        <input
          className="input max-w-sm"
          placeholder="بحث بالمستخدم أو التفاصيل…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs">
            <tr>
              <th className="p-3 text-right">التاريخ والوقت</th>
              <th className="p-3 text-right">المستخدم</th>
              <th className="p-3 text-right">العملية</th>
              <th className="p-3 text-right">ملخّص التغيير</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  جارٍ التحميل…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  لا توجد سجلات مطابقة.
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-border/70 align-top">
                <td className="whitespace-nowrap p-3 text-muted-foreground">
                  {formatDateTime(e.created_at)}
                </td>
                <td className="p-3">{e.actor_email ?? "—"}</td>
                <td className="p-3">
                  <span
                    className={
                      e.action === "DELETE"
                        ? "rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
                        : e.action === "INSERT"
                          ? "rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success"
                          : "rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                    }
                  >
                    {ACTION_LABEL[e.action] ?? e.action}
                  </span>
                </td>
                <td className="p-3 leading-relaxed">{summary(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
