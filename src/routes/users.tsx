import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { useAccess, ROLE_LABEL, type AppRole } from "@/lib/auth";
import {
  adminCreateUser,
  adminListUsers,
  adminResetPassword,
  adminUpdateUser,
  adminDeleteUser,
} from "@/lib/users.functions";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "المستخدمون والصلاحيات — عهدة الأثاث ITI المنوفية" },
      {
        name: "description",
        content: "إدارة مستخدمي نظام عهدة الأثاث: إضافة مستخدم، تعديل بياناته، تغيير كلمة المرور وتحديد الدور.",
      },
      { property: "og:title", content: "المستخدمون والصلاحيات — عهدة الأثاث ITI" },
      { property: "og:description", content: "ضبط حسابات المستخدمين وأدوارهم وحالتهم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

const ROLES: AppRole[] = ["admin", "reviewer", "user"];

type CreateDraft = {
  username: string;
  password: string;
  full_name: string;
  job_title: string;
  phone: string;
  role: AppRole;
};

type EditDraft = {
  id: string;
  username: string;
  full_name: string;
  job_title: string;
  phone: string;
  is_active: boolean;
  role: AppRole;
};

const emptyCreate: CreateDraft = {
  username: "",
  password: "",
  full_name: "",
  job_title: "",
  phone: "",
  role: "user",
};

function UsersPage() {
  const access = useAccess();
  if (access.loading) {
    return <AppShell>{null}</AppShell>;
  }
  return <AppShell>{access.canManageUsers ? <Users /> : <AccessDenied />}</AppShell>;
}

function Users() {
  const qc = useQueryClient();
  const list = useServerFn(adminListUsers);
  const create = useServerFn(adminCreateUser);
  const update = useServerFn(adminUpdateUser);
  const resetPw = useServerFn(adminResetPassword);
  const removeFn = useServerFn(adminDeleteUser);

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => list({ data: undefined }) });

  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [pwTarget, setPwTarget] = useState<{ id: string; username: string } | null>(null);
  const [newPw, setNewPw] = useState("");
  const [errs, setErrs] = useState<string[]>([]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-users"] });

  const createM = useMutation({
    mutationFn: (d: CreateDraft) => create({ data: d }),
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم بنجاح");
      setCreateDraft(null);
      setErrs([]);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: (d: EditDraft) =>
      update({
        data: {
          id: d.id,
          full_name: d.full_name,
          job_title: d.job_title,
          phone: d.phone,
          is_active: d.is_active,
          role: d.role,
        },
      }),
    onSuccess: () => {
      toast.success("تم تحديث بيانات المستخدم");
      setEditDraft(null);
      setErrs([]);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pwM = useMutation({
    mutationFn: (v: { id: string; password: string }) => resetPw({ data: v }),
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور");
      setPwTarget(null);
      setNewPw("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف المستخدم نهائيًا");
      setEditDraft(null);
      setPwTarget(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function validateCreate(d: CreateDraft) {
    const e: string[] = [];
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(d.username.trim()))
      e.push("اسم المستخدم مطلوب: حروف إنجليزية وأرقام فقط، ٣ خانات على الأقل");
    if (d.password.length < 8) e.push("كلمة المرور يجب ألا تقل عن ٨ خانات");
    if (d.full_name.trim().length < 3) e.push("الاسم الكامل مطلوب");
    return e;
  }

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        description="مسؤول النظام: كل الصلاحيات · مراجع: اطلاع فقط · مستخدم: تحركات العهدة مع التعديل."
        actions={
          <button
            onClick={() => {
              setErrs([]);
              setCreateDraft({ ...emptyCreate });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> مستخدم جديد
          </button>
        }
      />

      {errs.length > 0 && (
        <ul className="mb-4 list-inside list-disc space-y-1 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errs.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {createDraft && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-lg font-bold">إضافة مستخدم جديد</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="اسم المستخدم (إنجليزي) *">
              <input
                className="input mt-1.5"
                dir="ltr"
                value={createDraft.username}
                onChange={(e) => setCreateDraft({ ...createDraft, username: e.target.value })}
              />
            </Field>
            <Field label="كلمة المرور *">
              <input
                type="password"
                className="input mt-1.5"
                dir="ltr"
                value={createDraft.password}
                onChange={(e) => setCreateDraft({ ...createDraft, password: e.target.value })}
              />
            </Field>
            <Field label="الاسم الكامل *">
              <input
                className="input mt-1.5"
                value={createDraft.full_name}
                onChange={(e) => setCreateDraft({ ...createDraft, full_name: e.target.value })}
              />
            </Field>
            <Field label="الوظيفة">
              <input
                className="input mt-1.5"
                value={createDraft.job_title}
                onChange={(e) => setCreateDraft({ ...createDraft, job_title: e.target.value })}
              />
            </Field>
            <Field label="رقم الهاتف">
              <input
                className="input mt-1.5"
                dir="ltr"
                value={createDraft.phone}
                onChange={(e) => setCreateDraft({ ...createDraft, phone: e.target.value })}
              />
            </Field>
            <Field label="الدور">
              <select
                className="input mt-1.5"
                value={createDraft.role}
                onChange={(e) =>
                  setCreateDraft({ ...createDraft, role: e.target.value as AppRole })
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => {
                const e = validateCreate(createDraft);
                setErrs(e);
                if (e.length) {
                  toast.error("راجع البيانات المطلوبة");
                  return;
                }
                createM.mutate(createDraft);
              }}
              disabled={createM.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {createM.isPending ? "جارٍ الحفظ…" : "حفظ"}
            </button>
            <button
              onClick={() => setCreateDraft(null)}
              className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {editDraft && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-lg font-bold">
            تعديل المستخدم «{editDraft.username}»
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="الاسم الكامل *">
              <input
                className="input mt-1.5"
                value={editDraft.full_name}
                onChange={(e) => setEditDraft({ ...editDraft, full_name: e.target.value })}
              />
            </Field>
            <Field label="الوظيفة">
              <input
                className="input mt-1.5"
                value={editDraft.job_title}
                onChange={(e) => setEditDraft({ ...editDraft, job_title: e.target.value })}
              />
            </Field>
            <Field label="رقم الهاتف">
              <input
                className="input mt-1.5"
                dir="ltr"
                value={editDraft.phone}
                onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
              />
            </Field>
            <Field label="الدور">
              <select
                className="input mt-1.5"
                value={editDraft.role}
                onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value as AppRole })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الحالة">
              <select
                className="input mt-1.5"
                value={editDraft.is_active ? "1" : "0"}
                onChange={(e) => setEditDraft({ ...editDraft, is_active: e.target.value === "1" })}
              >
                <option value="1">مُفعّل</option>
                <option value="0">موقوف</option>
              </select>
            </Field>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => {
                if (editDraft.full_name.trim().length < 3) {
                  setErrs(["الاسم الكامل مطلوب"]);
                  return;
                }
                setErrs([]);
                updateM.mutate(editDraft);
              }}
              disabled={updateM.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {updateM.isPending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
            </button>
            <button
              onClick={() => setEditDraft(null)}
              className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {pwTarget && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-lg font-bold">
            تغيير كلمة مرور «{pwTarget.username}»
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="كلمة المرور الجديدة *">
              <input
                type="password"
                dir="ltr"
                className="input mt-1.5"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
              />
            </Field>
            <button
              onClick={() => {
                if (newPw.length < 8) {
                  toast.error("كلمة المرور يجب ألا تقل عن ٨ خانات");
                  return;
                }
                pwM.mutate({ id: pwTarget.id, password: newPw });
              }}
              disabled={pwM.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              حفظ كلمة المرور
            </button>
            <button
              onClick={() => {
                setPwTarget(null);
                setNewPw("");
              }}
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
              <th className="p-3 text-right">اسم المستخدم</th>
              <th className="p-3 text-right">الاسم الكامل</th>
              <th className="p-3 text-right">الوظيفة</th>
              <th className="p-3 text-right">الهاتف</th>
              <th className="p-3 text-right">الدور</th>
              <th className="p-3 text-right">الحالة</th>
              <th className="p-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  جارٍ التحميل…
                </td>
              </tr>
            )}
            {users.isError && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-destructive">
                  تعذّر تحميل المستخدمين — تأكد من صلاحياتك.
                </td>
              </tr>
            )}
            {(users.data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border/70">
                <td className="p-3 font-medium" dir="ltr">
                  {u.username ?? "—"}
                </td>
                <td className="p-3">{u.full_name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{u.job_title ?? "—"}</td>
                <td className="p-3 text-muted-foreground" dir="ltr">
                  {u.phone ?? "—"}
                </td>
                <td className="p-3">{ROLE_LABEL[(u.role as AppRole) ?? "user"]}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.is_active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {u.is_active ? "مُفعّل" : "موقوف"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setErrs([]);
                        setPwTarget(null);
                        setEditDraft({
                          id: u.id,
                          username: u.username ?? "",
                          full_name: u.full_name ?? "",
                          job_title: u.job_title ?? "",
                          phone: u.phone ?? "",
                          is_active: !!u.is_active,
                          role: (u.role as AppRole) ?? "user",
                        });
                      }}
                      className="rounded-md border border-input p-1.5 hover:bg-muted"
                      aria-label="تعديل"
                      title="تعديل البيانات"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditDraft(null);
                        setNewPw("");
                        setPwTarget({ id: u.id, username: u.username ?? "" });
                      }}
                      className="rounded-md border border-input p-1.5 hover:bg-muted"
                      aria-label="كلمة المرور"
                      title="تغيير كلمة المرور"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `حذف المستخدم «${u.username ?? ""}» نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`,
                          )
                        )
                          deleteM.mutate(u.id);
                      }}
                      disabled={deleteM.isPending}
                      className="rounded-md border border-input p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-60"
                      aria-label="حذف"
                      title="حذف المستخدم"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
