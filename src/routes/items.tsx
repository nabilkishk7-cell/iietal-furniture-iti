import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, ImagePlus } from "lucide-react";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/auth";
import { useItems, useItemImageUrl, type Item } from "@/lib/data";

export const Route = createFileRoute("/items")({
  head: () => ({
    meta: [
      { title: "الأصناف الرئيسية — عهدة الأثاث ITI المنوفية" },
      {
        name: "description",
        content: "إدارة أصناف الأثاث: الكود والاسم والتصنيف وصورة الصنف داخل نظام عهدة ITI المنوفية.",
      },
      { property: "og:title", content: "الأصناف الرئيسية — عهدة الأثاث ITI" },
      {
        property: "og:description",
        content: "إضافة وتعديل وحذف أصناف الأثاث مع رفع صور الأصناف.",
      },
    ],
  }),
  component: ItemsPage,
});

type Draft = {
  id?: number;
  code: string;
  name: string;
  item_count: string;
  ministry_qty: string;
  custody_recipient: string;
  custody_entity: string;
  notes: string;
  sort_order: number;
  image_url: string | null;
};

const emptyDraft: Draft = {
  code: "",
  name: "",
  item_count: "",
  ministry_qty: "",
  custody_recipient: "",
  custody_entity: "",
  notes: "",
  sort_order: 0,
  image_url: null,
};

type Errors = Partial<Record<keyof Draft, string>>;

function validateDraft(d: Draft): Errors {
  const e: Errors = {};
  if (!d.code.trim()) e.code = "كود الصنف مطلوب";
  if (!d.name.trim()) e.name = "اسم الصنف مطلوب";
  const n = Number(d.item_count);
  if (d.item_count.trim() === "") e.item_count = "العدد مطلوب";
  else if (!Number.isInteger(n) || n < 0) e.item_count = "أدخل عددًا صحيحًا غير سالب";
  const m = Number(d.ministry_qty);
  if (d.ministry_qty.trim() === "") e.ministry_qty = "الكمية الواردة من الوزارة مطلوبة";
  else if (!Number.isInteger(m) || m < 0) e.ministry_qty = "أدخل عددًا صحيحًا غير سالب";
  if (!d.custody_recipient.trim()) e.custody_recipient = "اسم مستلم العهدة مطلوب";
  if (!d.custody_entity.trim()) e.custody_entity = "اسم الجهة مستلمة العهدة مطلوب";
  if (!Number.isFinite(Number(d.sort_order)) || Number(d.sort_order) < 0)
    e.sort_order = "ترتيب العرض يجب أن يكون رقمًا غير سالب";
  return e;
}

export function ItemImage({ path, name }: { path: string | null; name: string }) {
  const { data: url } = useItemImageUrl(path);
  if (!url) {
    return (
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-muted text-[10px] text-muted-foreground">
        بلا صورة
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={`صورة الصنف ${name}`}
      loading="lazy"
      className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
    />
  );
}

function ItemsPage() {
  const access = useAccess();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useItems();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return items;
    return items.filter(
      (i) =>
        i.name.includes(t) ||
        i.code.includes(t) ||
        (i.custody_recipient ?? "").includes(t) ||
        (i.custody_entity ?? "").includes(t),
    );
  }, [items, q]);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        code: d.code.trim(),
        name: d.name.trim(),
        item_count: Number(d.item_count) || 0,
        ministry_qty: Number(d.ministry_qty) || 0,
        custody_recipient: d.custody_recipient.trim() || null,
        custody_entity: d.custody_entity.trim() || null,
        notes: d.notes.trim() || null,
        sort_order: Number(d.sort_order) || 0,
        image_url: d.image_url,
      };
      if (d.id) {
        const { error } = await supabase.from("items").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ الصنف");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الصنف");
      void qc.invalidateQueries({ queryKey: ["items"] });
      void qc.invalidateQueries({ queryKey: ["distribution"] });
    },
    onError: () => toast.error("تعذّر الحذف — قد يكون الصنف مرتبطًا بأرصدة أو تحركات"),
  });

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `items/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("item-images").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      setDraft((d) => (d ? { ...d, image_url: path } : d));
      toast.success("تم رفع الصورة");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!access.canViewItems) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="الأصناف الرئيسية"
        description="إدارة بيانات أصناف الأثاث وصورها. تظهر الصورة في نتائج البحث بالاسم."
        actions={
          access.canEditItems ? (
            <button
              onClick={() => {
                setErrors({});
                setDraft({ ...emptyDraft, sort_order: items.length + 1 });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> صنف جديد
            </button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <input
          className="input max-w-sm"
          placeholder="ابحث بالكود أو الاسم أو مستلم العهدة…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {draft && access.canEditItems && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-lg font-bold">
            {draft.id ? "تعديل صنف" : "إضافة صنف جديد"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FieldBox label="كود الصنف" error={errors.code}>
              <input
                className="input mt-1.5"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </FieldBox>
            <FieldBox label="اسم الصنف" error={errors.name}>
              <input
                className="input mt-1.5"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </FieldBox>
            <FieldBox label="العدد" error={errors.item_count}>
              <input
                type="number"
                min={0}
                className="input mt-1.5"
                value={draft.item_count}
                onChange={(e) => setDraft({ ...draft, item_count: e.target.value })}
              />
            </FieldBox>
            <FieldBox label="الكمية الواردة من الوزارة" error={errors.ministry_qty}>
              <input
                type="number"
                min={0}
                className="input mt-1.5"
                value={draft.ministry_qty}
                onChange={(e) => setDraft({ ...draft, ministry_qty: e.target.value })}
              />
            </FieldBox>
            <FieldBox label="مستلم العهدة" error={errors.custody_recipient}>
              <input
                className="input mt-1.5"
                value={draft.custody_recipient}
                onChange={(e) => setDraft({ ...draft, custody_recipient: e.target.value })}
              />
            </FieldBox>
            <FieldBox label="اسم الجهة مستلمة العهدة" error={errors.custody_entity}>
              <input
                className="input mt-1.5"
                value={draft.custody_entity}
                onChange={(e) => setDraft({ ...draft, custody_entity: e.target.value })}
              />
            </FieldBox>
            <FieldBox label="ترتيب العرض" error={errors.sort_order}>
              <input
                type="number"
                min={0}
                className="input mt-1.5"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              />
            </FieldBox>
            <FieldBox label="ملاحظات (اختياري)" error={undefined}>
              <input
                className="input mt-1.5"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </FieldBox>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ItemImage path={draft.image_url} name={draft.name || "جديد"} />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              <ImagePlus className="h-4 w-4" />
              {uploading ? "جارٍ الرفع…" : draft.image_url ? "تغيير الصورة" : "رفع صورة"}
            </button>
            {draft.image_url && (
              <button
                onClick={() => setDraft({ ...draft, image_url: null })}
                className="rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted"
              >
                إزالة الصورة
              </button>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => {
                const errs = validateDraft(draft);
                setErrors(errs);
                if (Object.keys(errs).length) {
                  toast.error("راجع الحقول المطلوبة قبل الحفظ");
                  return;
                }
                setErrors({});
                save.mutate(draft);
              }}
              disabled={save.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              حفظ
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs">
            <tr>
              <th className="p-3 text-right">الصورة</th>
              <th className="p-3 text-right">الكود</th>
              <th className="p-3 text-right">اسم الصنف</th>
              <th className="p-3 text-right">العدد</th>
              <th className="p-3 text-right">الوارد من الوزارة</th>
              <th className="p-3 text-right">مستلم العهدة</th>
              <th className="p-3 text-right">الجهة المستلمة</th>
              <th className="p-3 text-right">ملاحظات</th>
              {access.canEditItems && <th className="p-3 text-right">إجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  جارٍ التحميل…
                </td>
              </tr>
            )}
            {filtered.map((it: Item) => (
              <tr key={it.id} className="border-t border-border/70">
                <td className="p-2">
                  <ItemImage path={it.image_url} name={it.name} />
                </td>
                <td className="p-3 font-medium">{it.code}</td>
                <td className="p-3">{it.name}</td>
                <td className="p-3 font-semibold">{it.item_count}</td>
                <td className="p-3">{it.ministry_qty}</td>
                <td className="p-3 text-muted-foreground">{it.custody_recipient ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{it.custody_entity ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{it.notes ?? "—"}</td>
                {access.canEditItems && (
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setDraft({
                            id: it.id,
                            code: it.code,
                            name: it.name,
                            item_count: String(it.item_count ?? 0),
                            ministry_qty: String(it.ministry_qty ?? 0),
                            custody_recipient: it.custody_recipient ?? "",
                            custody_entity: it.custody_entity ?? "",
                            notes: it.notes ?? "",
                            sort_order: it.sort_order,
                            image_url: it.image_url,
                          })
                        }
                        className="rounded-md border border-input p-1.5 hover:bg-muted"
                        aria-label="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`حذف الصنف «${it.name}»؟`)) remove.mutate(it.id);
                        }}
                        className="rounded-md border border-input p-1.5 text-destructive hover:bg-destructive/10"
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
    </AppShell>
  );
}

function FieldBox({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {error && <span className="mt-1 block text-xs font-normal text-destructive">{error}</span>}
    </label>
  );
}
