import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Grid3X3,
  ArrowLeftRight,
  Search,
  Users,
  Menu,
  X,
  Boxes,
  History,
  ClipboardList,
  BookImage,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  UserCog,
  LogOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import logo from "@/assets/iti-logo.png";
import { useAuth, useAccess, ROLE_LABEL } from "@/lib/auth";
import { useManualSync } from "@/lib/data";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Search; allowed: boolean };

const SIDEBAR_KEY = "iti-sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const access = useAccess();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { sync, syncing, lastSynced } = useManualSync();

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // حماية كل الصفحات الداخلية: لا وصول بدون جلسة صالحة حتى عبر الرابط المباشر
  useEffect(() => {
    if (!access.loading && !access.signedIn) {
      void navigate({ to: "/login", replace: true });
    }
  }, [access.loading, access.signedIn, navigate]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      return !c;
    });
  };

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    await navigate({ to: "/login", replace: true });
  };

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
    { to: "/items", label: "الأصناف الرئيسية", icon: Boxes, allowed: access.canViewItems },
    { to: "/catalog", label: "دليل الأصناف", icon: BookImage, allowed: access.canViewItems },
    { to: "/inventory", label: "الجرد", icon: ClipboardList, allowed: access.canViewInventory },
    { to: "/audit", label: "سجل التدقيق", icon: History, allowed: access.canViewAudit },
    { to: "/users", label: "المستخدمون والصلاحيات", icon: Users, allowed: access.canManageUsers },
  ];

  if (access.loading || !access.signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm">جارٍ التحقق من الجلسة…</p>
        </div>
      </div>
    );
  }

  const roleLabel = access.roles.map((r) => ROLE_LABEL[r]).join(" • ") || "بدون صلاحية";
  const sidebarWidth = collapsed ? "lg:w-20" : "lg:w-72";
  const contentPad = collapsed ? "lg:pe-20" : "lg:pe-72";

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-s border-sidebar-border bg-sidebar text-sidebar-foreground transition-[transform,width] duration-300 ease-in-out lg:translate-x-0",
          sidebarWidth,
          mobileOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-card p-1">
            <img
              src={logo}
              alt="شعار معهد تكنولوجيا المعلومات"
              className="h-full w-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold">عهدة الأثاث</p>
              <p className="truncate text-xs text-sidebar-foreground/70">ITI فرع المنوفية</p>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="me-auto rounded-md p-1 text-sidebar-foreground/70 lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={toggleCollapsed}
            className="ms-auto hidden rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:block"
            aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
            title={collapsed ? "توسيع القائمة" : "طي القائمة"}
          >
            {collapsed ? (
              <PanelRightOpen className="h-5 w-5" />
            ) : (
              <PanelRightClose className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto p-3">
          {nav
            .filter((n) => n.allowed)
            .map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  title={n.label}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    collapsed && "lg:justify-center lg:px-0",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <n.icon className="h-4.5 w-4.5 shrink-0" />
                  <span className={cn(collapsed && "lg:hidden")}>{n.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {collapsed ? (
            <div className="grid place-items-center rounded-lg bg-sidebar-accent/60 p-2" title={roleLabel}>
              <UserCog className="h-5 w-5 text-sidebar-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg bg-sidebar-accent/60 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-medium">
                  <UserCog className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
                  وضع العرض بدون تسجيل دخول
                </p>
                <p className="mt-1 leading-relaxed text-sidebar-foreground/70">
                  يتم فتح النظام تلقائيًا بجلسة آمنة محفوظة على الخادم. بدّل الدور لتجربة الصلاحيات.
                </p>
                <p className="mt-1.5 truncate text-sidebar-foreground/60">{user?.email}</p>
              </div>
              <label className="block text-xs font-medium">
                الدور الحالي — {roleLabel}
                <select
                  className="input mt-1.5 bg-sidebar-accent/40 text-sidebar-foreground"
                  value={currentRole}
                  onChange={(e) => {
                    void switchRole(e.target.value as AppRole).then(() => navigate({ to: "/movements" }));
                  }}
                >
                  <option value="admin">مسؤول النظام — كل الصلاحيات</option>
                  <option value="reviewer">مراجع — اطلاع فقط</option>
                  <option value="user">مستخدم — تحركات العهدة فقط</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <div className={cn("transition-[padding] duration-300 ease-in-out", contentPad)}>
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="فتح القائمة"
            className="rounded-md p-1 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-display text-sm font-bold lg:text-base">
            عهدة الأثاث — ITI فرع المنوفية
          </span>
          <div className="ms-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {lastSynced
                ? `آخر مزامنة: ${lastSynced.toLocaleTimeString("ar-EG")}`
                : "لم تتم مزامنة يدوية بعد"}
            </span>
            <button
              onClick={() => void sync()}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "جارٍ المزامنة…" : "مزامنة البيانات"}
            </button>
          </div>
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
        هذه الصفحة غير متاحة لدورك الحالي. يمكنك تبديل الدور من أسفل القائمة الجانبية.
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
    <div className="mb-6 grid grid-cols-1 gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ExportButtons({
  onPdf,
  onExcel,
}: {
  onPdf: () => void;
  onExcel: () => void;
}) {
  return (
    <>
      <button
        onClick={onExcel}
        className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted"
      >
        تصدير Excel
      </button>
      <button
        onClick={onPdf}
        className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted"
      >
        تصدير PDF
      </button>
    </>
  );
}
