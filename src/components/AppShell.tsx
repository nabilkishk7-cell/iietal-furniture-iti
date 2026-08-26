import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Grid3X3,
  ArrowLeftRight,
  Search,
  Users,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import logo from "@/assets/iti-logo.png";
import { useAuth, useAccess, ROLE_LABEL } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Search; allowed: boolean };

export function AppShell({ children }: { children: ReactNode }) {
  const access = useAccess();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!access.loading && !access.signedIn) {
      navigate({ to: "/auth" });
    }
  }, [access.loading, access.signedIn, navigate]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const nav: NavItem[] = [
    { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, allowed: access.canViewDashboard },
    {
      to: "/distribution",
      label: "توزيع عهدة الأثاث",
      icon: Grid3X3,
      allowed: access.canViewDistribution,
    },
    { to: "/movements", label: "تحركات العهدة", icon: ArrowLeftRight, allowed: true },
    { to: "/search", label: "البحث والاستعلام", icon: Search, allowed: access.canViewSearch },
    { to: "/users", label: "المستخدمون والصلاحيات", icon: Users, allowed: access.canManageUsers },
  ];

  if (access.loading || !access.signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm">جارٍ التحميل…</p>
        </div>
      </div>
    );
  }

  const roleLabel = access.roles.map((r) => ROLE_LABEL[r]).join(" • ") || "بدون صلاحية";

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/95 p-1.5">
            <img src={logo} alt="شعار معهد تكنولوجيا المعلومات" width={44} height={44} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold">عهدة الأثاث</p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              معهد تكنولوجيا المعلومات ITI
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="me-auto rounded-md p-1 text-sidebar-foreground/70 lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3 scroll-thin">
          {nav
            .filter((n) => n.allowed)
            .map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <n.icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{n.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-sidebar-accent/60 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" />
            <div className="min-w-0 text-xs">
              <p className="truncate font-medium">{user?.email}</p>
              <p className="text-sidebar-foreground/70">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="lg:pe-72">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="فتح القائمة" className="rounded-md p-1">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-display font-bold">عهدة الأثاث — ITI</span>
        </header>
        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function AccessDenied() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
      <h1 className="font-display text-xl font-bold">لا تملك صلاحية الوصول</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        هذه الصفحة غير متاحة لدورك الحالي. تواصل مع مسؤول النظام لتعديل الصلاحيات.
      </p>
      <Link
        to="/movements"
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        الذهاب إلى تحركات العهدة
      </Link>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
