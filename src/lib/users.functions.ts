import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOMAIN = "iti-menoufia.app";
const ROLES = ["admin", "reviewer", "user"] as const;

const usernameSchema = z
  .string()
  .trim()
  .min(3, "اسم المستخدم يجب ألا يقل عن ٣ أحرف")
  .max(40, "اسم المستخدم طويل جدًا")
  .regex(/^[a-zA-Z0-9._-]+$/, "اسم المستخدم يقبل الحروف الإنجليزية والأرقام والنقطة والشرطة فقط");

const passwordSchema = z
  .string()
  .min(8, "كلمة المرور يجب ألا تقل عن ٨ خانات")
  .max(72, "كلمة المرور طويلة جدًا");

function emailFor(username: string) {
  return `${username.trim().toLowerCase()}@${DOMAIN}`;
}

/** يتحقق أن المستدعي مسؤول نظام فعّال، وإلا يرفض الطلب */
async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) {
    throw new Error("غير مصرّح لك بإدارة المستخدمين");
  }
}

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, job_title, phone, email, is_active, created_at")
      .order("created_at");
    if (error) throw new Error(error.message);

    const { data: roles, error: re } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (re) throw new Error(re.message);

    const roleMap = new Map<string, string>();
    for (const r of roles ?? []) roleMap.set(r.user_id, r.role);

    return (profiles ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      job_title: p.job_title,
      phone: p.phone,
      is_active: p.is_active,
      created_at: p.created_at,
      role: roleMap.get(p.id) ?? "user",
    }));
  });

const createSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(3, "الاسم الكامل مطلوب").max(120),
  job_title: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  role: z.enum(ROLES),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const username = data.username.toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) throw new Error("اسم المستخدم مستخدم بالفعل");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: emailFor(username),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: data.full_name,
        job_title: data.job_title,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "تعذّر إنشاء المستخدم");

    const uid = created.user.id;
    const { error: pe } = await supabaseAdmin
      .from("profiles")
      .update({
        username,
        full_name: data.full_name,
        job_title: data.job_title || null,
        phone: data.phone || null,
        is_active: true,
      })
      .eq("id", uid);
    if (pe) throw new Error(pe.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: re } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.role });
    if (re) throw new Error(re.message);

    return { id: uid };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(3, "الاسم الكامل مطلوب").max(120),
  job_title: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  is_active: z.boolean(),
  role: z.enum(ROLES),
});

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.id === context.userId && (!data.is_active || data.role !== "admin")) {
      throw new Error("لا يمكنك إيقاف حسابك أو تخفيض صلاحيتك بنفسك");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        job_title: data.job_title || null,
        phone: data.phone || null,
        is_active: data.is_active,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error: re } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.id, role: data.role });
    if (re) throw new Error(re.message);

    if (!data.is_active) {
      await supabaseAdmin.auth.admin.signOut(data.id).catch(() => undefined);
    }
    return { ok: true };
  });

const passwordResetSchema = z.object({ id: z.string().uuid(), password: passwordSchema });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => passwordResetSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

/** حذف مستخدم نهائيًا (مسؤول النظام فقط) */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.id === context.userId) {
      throw new Error("لا يمكنك حذف حسابك الحالي");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
