import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAccess, useAuth } from "@/lib/auth";
import {
  arabicWeekday,
  buildMatrix,
  formatNumber,
  useDistribution,
  useItems,
  useLocations,
  useMovements,
  type Movement,
} from "@/lib/data";

export const Route = createFileRoute("/movements")({
  head: () => ({
    meta: [
      { title: "تحركات العهدة — ITI" },
      {
        name: "description",
        content: "تسجيل وتعديل حركات نقل الأثاث من مكان إلى مكان مع تحديث الأرصدة تلقائيًا.",
      },
      { property: "og:title", content: "تحركات العهدة — ITI" },
      {
        property: "og:description",
        content: "المرجع الرسمي لتسجيل تحركات عهدة الأثاث بين الأماكن داخل المعهد.",
      },
    ],
  }),
  component: MovementsPage,
});

type FormState = {
  id?: string;
  moved_on: string;
  item_id: string;
  qty: string;
  from_location_id: string;
  to_location_id: string;
  security_from: string;
  security_to: string;
  employee_name: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  moved_on: new Date().toISOString().slice(0, 10),
  item_id: "",
  qty: "1",
  from_location_id: "",
  to_location_id: "",
  security_from: "",
  security_to: "",
  employee_name: "",
  notes: "",
});

function MovementsPage() {
  return (
    <AppShell>
      <Movements />
    </AppShell>
  );
}

function Movements() {
  const access = useAccess();
  const { user } = useAuth();
  const items = useItems();
  const locations = useLocations();
  const movements = useMovements();
  const dist = useDistribution();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [filter, setFilter] = useState("");

  const matrix = useMemo(() => buildMatrix(dist.data ?? []), [dist.data]);
  const itemName = (id: number) => items.data?.find((i) => i.id === id)?.name ?? "—";
  const locName = (id: number | null) =>
    id ? (locations.data?.find((l) => l.id === id)?.name ?? "—") : null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["distribution"] });
  };

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        moved_on: f.moved_on,
        item_id: Number(f.item_id),
        qty: Number(f.qty),
        from_location_id: f.from_location_id ? Number(f.from_location_id) : null,
        to_location_id: f.to_location_id ? Number(f.to_location_id) : null,
        security_from: f.security_from || null,
        security_to: f.security_to || null,
        employee_name: f.employee_name || null,
        notes: f.notes || null,
      };
      if (f.id) {
        const { error } = await supabase.from("movements").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("movements")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ الحركة وتحديث أرصدة التوزيع");
      setForm(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الحركة");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.item_id) { toast.error("اختر الصنف"); return; }
    const qty = Number(form.qty);
    if (!Number.isFinite(qty) || qty <= 0) { toast.error("أدخل عددًا صحيحًا أكبر من صفر"); return; }
    if (!form.from_location_id && !form.to_location_id)
      { toast.error("حدد مكان المصدر أو مكان الوجهة على الأقل"); return; }
    if (form.from_location_id && form.from_location_id === form.to_location_id)
      { toast.error("لا يمكن النقل من وإلى نفس المكان"); return; }
    if (form.from_location_id) {
      const available = matrix.get(`${form.item_id}:${form.from_location_id}`) ?? 0;
      const original = form.id ? (movements.data?.find((m) => m.id === form.id) ?? null) : null;
      const restored =
        original && String(original.from_location_id ?? "") === form.from_location_id
          ? original.qty
          : 0;
      if (qty > available + restored)
        { toast.error(`الرصيد المتاح في مكان المصدر ${formatNumber(available + restored)} فقط`); return; }
    }
    save.mutate(form);
  }

  const rows = (movements.data ?? []).filter((m) => {
    if (!filter.trim()) return true;
    const t = filter.trim();
    return (
      itemName(m.item_id).includes(t) ||
      (locName(m.from_location_id) ?? "").includes(t) ||
      (locName(m.to_location_id) ?? "").includes(t) ||
      (m.employee_name ?? "").includes(t)
    );
  });

  const startEdit = (m: Movement) =>
    setForm({
      id: m.id,
      moved_on: m.moved_on,
      item_id: String(m.item_id),
      qty: String(m.qty),
      from_location_id: m.from_location_id ? String(m.from_location_id) : "",
      to_location_id: m.to_location_id ? String(m.to_location_id) : "",
      security_from: m.security_from ?? "",
      security_to: m.security_to ?? "",
      employee_name: m.employee_name ?? "",
      notes: m.notes ?? "",
    });

  return (
    <>
      <PageHeader
        title="تحركات العهدة"
        description="المرجع الرسمي لأي نقل بين الأماكن — كل حركة تُحدّث جدول التوزيع وصفحات البحث ولوحة التحكم فورًا."
        actions={
          access.canEditMovements && (
            <button
              onClick={() => setForm(emptyForm())}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              تسجيل حركة جديدة
            </button>
          )
        }
      />

      {!access.canEditMovements && (
        <p className="mb-4 rounded-xl border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
          لديك صلاحية الاطلاع فقط على تحركات العهدة.
        </p>
      )}

      <input
        className="input mb-4 max-w-sm"
        placeholder="بحث في الحركات (صنف، مكان، موظف)…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="p-2.5 text-center">م</th>
              <th className="p-2.5 text-right">اليوم</th>
              <th className="p-2.5 text-right">التاريخ</th>
              <th className="p-2.5 text-right">الصنف</th>
              <th className="p-2.5 text-center">العدد</th>
              <th className="p-2.5 text-right">المكان (من)</th>
              <th className="p-2.5 text-right">المكان (الى)</th>
              <th className="p-2.5 text-right">امن (من)</th>
              <th className="p-2.5 text-right">امن (الى)</th>
              <th className="p-2.5 text-right">اسم الموظف</th>
              <th className="p-2.5 text-right">ملاحظات</th>
              {access.canEditMovements && <th className="p-2.5 text-center">إجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="p-10 text-center text-muted-foreground">
                  لا توجد حركات مسجلة.
                </td>
              </tr>
            )}
            {rows.map((m, i) => (
              <tr key={m.id} className="border-b border-border/70 odd:bg-muted/40">
                <td className="p-2.5 text-center text-muted-foreground">{i + 1}</td>
                <td className="p-2.5">{arabicWeekday(m.moved_on)}</td>
                <td className="whitespace-nowrap p-2.5" dir="ltr">
                  {m.moved_on}
                </td>
                <td className="p-2.5 font-medium">{itemName(m.item_id)}</td>
                <td className="p-2.5 text-center font-semibold">{formatNumber(m.qty)}</td>
                <td className="p-2.5">{locName(m.from_location_id) ?? "— (إضافة عهدة)"}</td>
                <td className="p-2.5">{locName(m.to_location_id) ?? "— (صرف/إخراج)"}</td>
                <td className="p-2.5">{m.security_from ?? "—"}</td>
                <td className="p-2.5">{m.security_to ?? "—"}</td>
                <td className="p-2.5">{m.employee_name ?? "—"}</td>
                <td className="max-w-48 p-2.5 text-muted-foreground">{m.notes ?? "—"}</td>
                {access.canEditMovements && (
                  <td className="p-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => startEdit(m)}
                        className="rounded-md p-1.5 hover:bg-muted"
                        aria-label="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("هل تريد حذف هذه الحركة؟ سيتم تعديل الأرصدة تلقائيًا.")) {
                            remove.mutate(m.id);
                          }
                        }}
                        className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && access.canEditMovements && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <form
            onSubmit={submit}
            className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-panel"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                {form.id ? "تعديل حركة العهدة" : "تسجيل حركة عهدة جديدة"}
              </h2>
              <button type="button" onClick={() => setForm(null)} aria-label="إغلاق">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="التاريخ">
                <input
                  type="date"
                  className="input"
                  value={form.moved_on}
                  onChange={(e) => setForm({ ...form, moved_on: e.target.value })}
                  required
                />
              </Field>
              <Field label="العدد">
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                  required
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="الصنف">
                  <select
                    className="input"
                    value={form.item_id}
                    onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                    required
                  >
                    <option value="">— اختر الصنف —</option>
                    {(items.data ?? []).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.code})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="المكان (من) — اتركه فارغًا لإضافة عهدة جديدة">
                <select
                  className="input"
                  value={form.from_location_id}
                  onChange={(e) => setForm({ ...form, from_location_id: e.target.value })}
                >
                  <option value="">— بدون —</option>
                  {(locations.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {form.item_id
                        ? ` (متاح: ${matrix.get(`${form.item_id}:${l.id}`) ?? 0})`
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="المكان (الى) — اتركه فارغًا للصرف/الإخراج">
                <select
                  className="input"
                  value={form.to_location_id}
                  onChange={(e) => setForm({ ...form, to_location_id: e.target.value })}
                >
                  <option value="">— بدون —</option>
                  {(locations.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="أمن (من)">
                <input
                  className="input"
                  value={form.security_from}
                  onChange={(e) => setForm({ ...form, security_from: e.target.value })}
                />
              </Field>
              <Field label="أمن (الى)">
                <input
                  className="input"
                  value={form.security_to}
                  onChange={(e) => setForm({ ...form, security_to: e.target.value })}
                />
              </Field>
              <Field label="اسم الموظف">
                <input
                  className="input"
                  value={form.employee_name}
                  onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                />
              </Field>
              <Field label="ملاحظات">
                <input
                  className="input"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {save.isPending ? "جارٍ الحفظ…" : "حفظ الحركة"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
