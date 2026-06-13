import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DollarSign, ShoppingCart, Users, AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { isSellerScoped } from "@/lib/rbac";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

function Dashboard() {
  const { user, roles } = useAuth();
  const sellerOnly = isSellerScoped(roles);
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const { data: kpis } = useQuery({
    queryKey: ["kpis", from, to, sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      let customersQuery = supabase.from("customers").select("*", { head: true, count: "exact" });
      let salesQuery = supabase
          .from("sales")
          .select("total, created_at, seller_id")
          .gte("created_at", fromIso)
          .lte("created_at", toIso);
      let invoicesQuery = supabase
          .from("invoices")
          .select("balance, status, customers!inner(seller_id)")
          .not("status", "in", "(paid,cancelled)");
      if (sellerOnly && user) {
        customersQuery = customersQuery.eq("seller_id", user.id);
        salesQuery = salesQuery.eq("seller_id", user.id);
        invoicesQuery = invoicesQuery.eq("customers.seller_id", user.id);
      }
      const [{ count: customers }, salesRes, invoicesRes] = await Promise.all([
        customersQuery, salesQuery, invoicesQuery,
      ]);
      const sales = salesRes.data ?? [];
      const totalSales = sales.reduce((s, r) => s + Number(r.total || 0), 0);
      const receivables = (invoicesRes.data ?? []).reduce((s, r) => s + Number(r.balance || 0), 0);
      const byMonth: Record<string, number> = {};
      sales.forEach((r) => {
        const d = new Date(r.created_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth[k] = (byMonth[k] || 0) + Number(r.total || 0);
      });
      const chart = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ month: k, total: v }));
      return {
        customers: customers ?? 0,
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

  const resetRange = () => {
    const r = defaultRange();
    setFrom(r.from);
    setTo(r.to);
  };

  return (
    <>
      <PageHeader
        title="Panel ejecutivo"
        description="Indicadores clave de la operación en tiempo real."
      />
      <div className="space-y-6 p-6">
        <Card className="shadow-card">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">Desde</Label>
              <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">Hasta</Label>
              <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" size="sm" onClick={resetRange}>Últimos 30 días</Button>
            <p className="ml-auto text-xs text-muted-foreground">
              Las ventas se filtran por el rango seleccionado. La cartera muestra el saldo pendiente actual.
            </p>
          </CardContent>
        </Card>

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
                No hay ventas en el rango seleccionado.
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
