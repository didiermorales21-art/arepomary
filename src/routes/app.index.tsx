import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Users, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

function Dashboard() {
  const { data: kpis } = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const [{ count: customers }, { count: products }, salesRes, receivablesRes] = await Promise.all([
        supabase.from("customers").select("*", { head: true, count: "exact" }),
        supabase.from("products").select("*", { head: true, count: "exact" }),
        supabase.from("sales").select("total, balance, created_at"),
        supabase.from("sales").select("balance"),
      ]);
      const sales = salesRes.data ?? [];
      const totalSales = sales.reduce((s, r) => s + Number(r.total || 0), 0);
      const receivables = (receivablesRes.data ?? []).reduce((s, r) => s + Number(r.balance || 0), 0);
      // group by month
      const byMonth: Record<string, number> = {};
      sales.forEach((r) => {
        const d = new Date(r.created_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth[k] = (byMonth[k] || 0) + Number(r.total || 0);
      });
      const chart = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([k, v]) => ({ month: k, total: v }));
      return {
        customers: customers ?? 0,
        products: products ?? 0,
        totalSales,
        receivables,
        salesCount: sales.length,
        chart,
      };
    },
  });

  const cards = [
    { label: "Ventas totales", value: fmt(kpis?.totalSales ?? 0), icon: DollarSign, accent: "bg-gradient-primary" },
    { label: "Órdenes", value: String(kpis?.salesCount ?? 0), icon: ShoppingCart, accent: "bg-gradient-gold" },
    { label: "Clientes", value: String(kpis?.customers ?? 0), icon: Users, accent: "bg-gradient-primary" },
    { label: "Cartera pendiente", value: fmt(kpis?.receivables ?? 0), icon: AlertCircle, accent: "bg-gradient-gold" },
  ];

  return (
    <>
      <PageHeader
        title="Panel ejecutivo"
        description="Indicadores clave de la operación en tiempo real."
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} className="overflow-hidden shadow-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                    <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{c.value}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground ${c.accent}`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Ventas por mes</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {(kpis?.chart.length ?? 0) === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No hay ventas registradas todavía.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis?.chart ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v) => fmt(v)} width={90} />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
