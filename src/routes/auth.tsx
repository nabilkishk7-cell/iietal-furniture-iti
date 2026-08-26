import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/iti-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — عهدة الأثاث ITI" },
      {
        name: "description",
        content: "تسجيل الدخول إلى نظام إدارة عهدة الأثاث الخاص بمعهد تكنولوجيا المعلومات.",
      },
      { property: "og:title", content: "تسجيل الدخول — عهدة الأثاث ITI" },
      {
        property: "og:description",
        content: "بوابة الدخول لنظام إدارة عهدة الأثاث وتتبع التحركات.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName || email },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب. إذا طُلب تأكيد البريد، راجع بريدك الإلكتروني.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إتمام العملية");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("تعذّر تسجيل الدخول بحساب جوجل");
      return;
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="brand-gradient relative hidden flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white p-2">
            <img src={logo} alt="شعار ITI" width={56} height={56} />
          </div>
          <div>
            <p className="font-display text-lg font-bold">معهد تكنولوجيا المعلومات</p>
            <p className="text-sm text-white/75">Information Technology Institute</p>
          </div>
        </div>
        <div className="max-w-lg">
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            نظام إدارة عهدة الأثاث
          </h2>
          <p className="mt-4 text-white/80">
            توزيع دقيق للأصناف على الأماكن، وتسجيل مركزي لتحركات العهدة يحدّث كل الأرصدة والتقارير
            المرتبطة لحظيًا.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { k: "39", v: "صنف أثاث" },
              { k: "49", v: "مكان" },
              { k: "1150", v: "قطعة" },
            ].map((s) => (
              <div key={s.v} className="rounded-xl bg-white/10 p-4 backdrop-blur">
                <p className="font-display text-2xl font-bold">{s.k}</p>
                <p className="text-xs text-white/75">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/60">© ITI — إدارة الأصول والعهد</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src={logo} alt="شعار ITI" width={44} height={44} />
            <span className="font-display text-lg font-bold">عهدة الأثاث — ITI</span>
          </div>
          <h1 className="font-display text-2xl font-bold">
            {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "signin"
              ? "أدخل بيانات حسابك للوصول إلى النظام."
              : "أول حساب يتم إنشاؤه يحصل تلقائيًا على صلاحية مسؤول النظام."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field label="الاسم بالكامل">
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: أحمد محمود"
                />
              </Field>
            )}
            <Field label="البريد الإلكتروني">
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@iti.gov.eg"
                dir="ltr"
              />
            </Field>
            <Field label="كلمة المرور">
              <input
                className="input"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
              />
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "جارٍ المعالجة…" : mode === "signin" ? "دخول" : "إنشاء الحساب"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            أو
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={google}
            className="w-full rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            المتابعة باستخدام حساب جوجل
          </button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
            <button
              className="font-semibold text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "إنشاء حساب" : "تسجيل الدخول"}
            </button>
          </p>
        </div>
      </div>
    </div>
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
