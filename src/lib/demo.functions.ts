import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * وضع العرض بدون تسجيل دخول ظاهر.
 * ينشئ (أو يحدّث) حسابًا تجريبيًا لكل دور ويعيد جلسة جاهزة للمتصفح،
 * بحيث تظل كل عمليات قاعدة البيانات محمية بسياسات الصلاحيات (RLS).
 */
const roleSchema = z.object({ role: z.enum(["admin", "reviewer", "user"]) });

const DEMO_ACCOUNTS: Record<string, { email: string; name: string }> = {
  admin: { email: "demo.admin@iti-menoufia.app", name: "مسؤول النظام (عرض)" },
  reviewer: { email: "demo.reviewer@iti-menoufia.app", name: "مراجع (عرض)" },
  user: { email: "demo.user@iti-menoufia.app", name: "مستخدم (عرض)" },
};

export const startDemoSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => roleSchema.parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const account = DEMO_ACCOUNTS[data.role]!;
    const password = `Demo-${crypto.randomUUID()}`;

    // ابحث عن الحساب التجريبي أو أنشئه
    let userId: string | undefined;
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list?.users.find((u) => u.email === account.email)?.id;

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      });
      if (error) throw new Error(error.message);
      userId = created.user!.id;
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: account.email, full_name: account.name });

    // اضبط الدور المطلوب فقط
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleError) throw new Error(roleError.message);

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const authClient = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
      email: account.email,
      password,
    });
    if (signInError || !signIn.session) throw new Error(signInError?.message ?? "تعذّر بدء الجلسة");

    return {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      role: data.role,
    };
  });
