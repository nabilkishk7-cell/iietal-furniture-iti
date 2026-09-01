import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAccess, ROLE_LABEL, type AppRole } from "@/lib/auth";
import { useProfiles, useUserRoles } from "@/lib/data";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "المستخدمون والصلاحيات — عهدة الأثاث ITI المنوفية" },
      {
        name: "description",
        content: "إدارة مستخدمي نظام عهدة الأثاث وتحديد أدوارهم: مسؤول، مراجع، مستخدم.",
      },
      { property: "og:title", content: "المستخدمون والصلاحيات — عهدة الأثاث ITI" },
      { property: "og:description", content: "ضبط أدوار المستخدمين وصلاحيات الوصول." },
    ],
  }),
  component: UsersPage,
});

const ROLES: AppRole[] = ["admin", "reviewer", "user"];

function UsersPage() {
  const access = useAccess();
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useProfiles(access.canManageUsers);
  const { data: roles = [] } = useUserRoles(access.canManageUsers);

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: de } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (de) throw de;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية");
      void qc.invalidateQueries({ queryKey: ["user_roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!access.canManageUsers) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="المستخدمون والصلاحيات"
        description="مسؤول النظام: كل الصلاحيات · مراجع: اطلاع على كل الصفحات دون تعديل · مستخدم: تحركات العهدة فقط مع التعديل."
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs">
            <tr>
              <th className="p-3 text-right">الاسم</th>
              <th className="p-3 text-right">البريد الإلكتروني</th>
              <th className="p-3 text-right">الدور</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  جارٍ التحميل…
                </td>
              </tr>
            )}
            {profiles.map((p) => {
              const current = (roles.find((r) => r.user_id === p.id)?.role ?? "user") as AppRole;
              return (
                <tr key={p.id} className="border-t border-border/70">
                  <td className="p-3">{p.full_name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{p.email ?? "—"}</td>
                  <td className="p-3">
                    <select
                      className="input max-w-[220px]"
                      value={current}
                      onChange={(e) =>
                        setRole.mutate({ userId: p.id, role: e.target.value as AppRole })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
