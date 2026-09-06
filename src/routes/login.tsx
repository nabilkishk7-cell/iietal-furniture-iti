import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import logo from "@/assets/iti-logo.png";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — عهدة الأثاث ITI المنوفية" },
      {
        name: "description",
        content: "تسجيل الدخول إلى نظام إدارة عهدة الأثاث بمعهد تكنولوجيا المعلومات فرع المنوفية.",
      },
      { property: "og:title", content: "تسجيل الدخول — عهدة الأثاث ITI" },
      { property: "og:description", content: "دخول آمن باسم المستخدم وكلمة المرور." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ username?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/movements", replace: true });
  }, [loading, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fe: { username?: string; password?: string } = {};
    if (!username.trim()) fe.username = "اسم المستخدم مطلوب";
    if (!password) fe.password = "كلمة المرور مطلوبة";
    setFieldErr(fe);
    setError(null);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      await signIn(username, password);
      await navigate({ to: "/movements", replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="w-full max-w-[220px] rounded-xl bg-card p-3">
            <img
              src={logo}
              alt="شعار معهد تكنولوجيا المعلومات"
              className="mx-auto h-auto w-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">نظام إدارة عهدة الأثاث</h1>
            <p className="mt-1 text-sm text-muted-foreground">ITI — فرع المنوفية</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <label className="block text-sm font-medium">
            اسم المستخدم
            <input
              className="input mt-1.5"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم"
            />
            {fieldErr.username && (
              <span className="mt-1 block text-xs font-normal text-destructive">
                {fieldErr.username}
              </span>
            )}
          </label>

          <label className="block text-sm font-medium">
            كلمة المرور
            <input
              type="password"
              className="input mt-1.5"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {fieldErr.password && (
              <span className="mt-1 block text-xs font-normal text-destructive">
                {fieldErr.password}
              </span>
            )}
          </label>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {busy ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          للحصول على حساب أو إعادة تعيين كلمة المرور، تواصل مع مسؤول النظام.
        </p>
      </div>
    </div>
  );
}
