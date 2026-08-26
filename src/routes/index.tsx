import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Boxes, MapPin, Layers, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { AppShell, AccessDenied, PageHeader } from "@/components/AppShell";
import { useAccess } from "@/lib/auth";
import { useDistribution, useItems, useLocations, useMovements, formatNumber, arabicWeekday } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — عهدة الأثاث ITI" },
      {
        name: "description",
        content:
          "ملخص لحظي لعهدة الأثاث: عدد الأصناف وإجمالي القطع والأماكن المستخدمة وحركات النقل والأرصدة السالبة.",
      },
      { property: "og:title", content: "لوحة التحكم — عهدة الأثاث ITI" },
      {
        property: "og:description",
        content: "إحصائيات شاملة لتوزيع عهدة الأثاث داخل معهد تكنولوجيا المعلومات.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const access = useAccess();
  return (
    <AppShell>{access.canViewDashboard ? <Dashboard /> : <AccessDenied />}</AppShell>
  );
}

function Dashboard() {
  const items = useItems();
  const locations = useLocations();
  const dist = useDistribution();
  const movements = useMovements();

  const stats = useMemo(() => {
    const rows = dist.data ?? [];
    const total = rows.reduce((s, r) => s + r.qty, 0);
    const usedLocations = new Set(rows.filter((r) => r.qty > 0).map((r) => r.location_id));
    const negative = rows.filter((r) => r.qty < 0);
    const byLocation = new Map<number, number>();
    const byItem = new Map<number, number>();
    for (const r of rows) {
      byLocation.set(r.location_id, (byLocation.get(r.location_id) ?? 0) + r.qty);
      byItem.set(r.item_id, (byItem.get(r.item_id) ?? 0) + r.qty);
    }
    return { total, usedLocations, negative, byLocation, byItem };
  }, [dist.data]);

  const locName = (id: number) => locations.data?.find((l) => l.id === id)?.name ?? "—";
  const itemName = (id: number) => items.data?.find((i) => i.id === id)?.name ?? "—";

  const topLocations = useMemo(
    () =>
      [...stats.byLocation.entries()]
        .map(([id, qty]) => ({ name: locName(id), qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10),
    [stats.byLocation, locations.data],
  );

  const topItems = useMemo(
    () =>
      [...stats.byItem.entries()]
        .map(([id, qty]) => ({ name: itemName(id).slice(0, 28), qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8),
    [stats.byItem, items.data],
  );

  const loading = items.isLoading || locations.isLoading || dist.isLoading;

  return (
    <>
      <PageHeader
        title="لوحة التحكم الرئيسية"
        description="ملخص لحظي لتوزيع عهدة الأثاث وحركاتها داخل الفرع."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={Layers}
          label="عدد أصناف العهدة"
          value={items.data?.length ?? 0}
          loading={loading}
        />
        <StatCard icon={Boxes} label="إجمالي قطع الأثاث" value={stats.total} loading={loading} />
        <StatCard
          icon={MapPin}
          label="عدد الأماكن المستخدمة"
          value={stats.usedLocations.size}
          hint={`من إجمالي ${formatNumber(locations.data?.length ?? 0)} مكان`}
          loading={loading}
        />
        <StatCard
          icon={ArrowLeftRight}
          label="عدد حركات العهدة"
          value={movements.data?.length ?? 0}
          loading={movements.isLoading}
        />
        <StatCard
          icon={AlertTriangle}
          label="أرصدة سالبة"
          value={stats.negative.length}
          tone={stats.negative.length ? "danger" : "ok"}
          loading={loading}
        />
      </div>

      {stats.negative.length > 0 && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">تنبيه: توجد أرصدة سالبة</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {stats.negative.slice(0, 6).map((r) => (
              <li key={`${r.item_id}-${r.location_id}`}>
                {itemName(r.item_id)} — {locName(r.location_id)}: {formatNumber(r.qty)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="أكثر 10 أماكن من حيث عدد القطع">
          <ChartBars data={topLocations} color="var(--color-chart-1)" />
        </Panel>
        <Panel title="أكثر 8 أصناف من حيث العدد">
          <ChartBars data={topItems} color="var(--color-chart-2)" />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="أحدث تحركات العهدة" className="xl:col-span-2">
          {movements.data && movements.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-xs text-muted-foreground">
                    <th className="p-2">التاريخ</th>
                    <th className="p-2">الصنف</th>
                    <th className="p-2">العدد</th>
                    <th className="p-2">من</th>
                    <th className="p-2">إلى</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.data.slice(0, 8).map((m) => (
                    <tr key={m.id} className="border-b border-border/60 last:border-0">
                      <td className="whitespace-nowrap p-2">
                        {m.moved_on} <span className="text-muted-foreground">({arabicWeekday(m.moved_on)})</span>
                      </td>
                      <td className="p-2">{itemName(m.item_id)}</td>
                      <td className="p-2 font-semibold">{formatNumber(m.qty)}</td>
                      <td className="p-2">{m.from_location_id ? locName(m.from_location_id) : "— (إضافة)"}</td>
                      <td className="p-2">{m.to_location_id ? locName(m.to_location_id) : "— (صرف)"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا توجد حركات مسجلة حتى الآن.{" "}
              <Link to="/movements" className="font-medium text-primary hover:underline">
                تسجيل أول حركة
              </Link>
            </p>
          )}
        </Panel>

        <Panel title="أماكن بلا عهدة">
          <div className="max-h-72 space-y-1 overflow-y-auto text-sm scroll-thin">
            {(locations.data ?? [])
              .filter((l) => (stats.byLocation.get(l.id) ?? 0) === 0)
              .map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-1.5"
                >
                  <span>{l.name}</span>
                  <span className="text-xs text-muted-foreground">0</span>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  loading,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  hint?: string;
  tone?: "ok" | "danger";
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={
            tone === "danger"
              ? "grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive"
              : "grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-primary"
          }
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold">
        {loading ? "…" : formatNumber(value)}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 shadow-card ${className ?? ""}`}>
      <h2 className="mb-4 font-display text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

function ChartBars({ data, color }: { data: { name: string; qty: number }[]; color: string }) {
  return (
    <div className="h-72 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 60, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="name"
            angle={-40}
            textAnchor="end"
            interval={0}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              direction: "rtl",
              fontSize: 12,
            }}
            formatter={(v: number) => [formatNumber(v), "العدد"]}
          />
          <Bar dataKey="qty" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
