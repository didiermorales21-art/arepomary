import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { isSellerScoped } from "@/lib/rbac";
import { allocateProductionProfits } from "@/lib/production-profit";

export const Route = createFileRoute("/app/analytics")({
  component: AnalyticsPage,
});

const COLORS = ["var(--primary)", "var(--gold)", "var(--muted-foreground)", "var(--destructive)"];

function AnalyticsPage() {
  const { user, roles } = useAuth();
  const sellerOnly = isSellerScoped(roles);
  const { data: sales } = useQuery({
    queryKey: ["analytics-sales", sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("total, status, created_at, customer_id, seller_id, customers(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (sellerOnly && user) query = query.eq("seller_id", user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: invoiceAgg } = useQuery({
    queryKey: ["analytics-invoices", sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("total, paid, balance, status, customers!inner(seller_id)")
        .neq("status", "cancelled");
      if (sellerOnly && user) query = query.eq("customers.seller_id", user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: saleItems } = useQuery({
    queryKey: ["analytics-items", sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase
        .from("sale_items")
        .select("product_id, quantity, line_total, products(name), sales!inner(status, seller_id, customers(customer_type, gives_commission, commission_per_package))");
      if (sellerOnly && user) query = query.eq("sales.seller_id", user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: production } = useQuery({
    queryKey: ["analytics-production"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_batches")
        .select("batch_number, product_id, planned_quantity, produced_quantity, total_cost, status, created_at, products(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: commissionSettings } = useQuery({
    queryKey: ["analytics-commission-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("commission_standard_per_package, commission_wholesale_per_package").limit(1).maybeSingle()).data,
    enabled: !sellerOnly,
  });

  // KPIs (revenue from invoices for actual billed + paid)
  const totalRevenue = (invoiceAgg ?? []).reduce((a, i) => a + Number(i.total ?? 0), 0);
  const totalPaid = (invoiceAgg ?? []).reduce((a, i) => a + Number(i.paid ?? 0), 0);
  const receivables = (invoiceAgg ?? []).reduce((a, i) => a + Number(i.balance ?? 0), 0);
  const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

  // Sales by status
  const statusAgg = new Map<string, number>();
  (sales ?? []).forEach((s) => statusAgg.set(s.status, (statusAgg.get(s.status) ?? 0) + Number(s.total ?? 0)));
  const statusData = Array.from(statusAgg, ([name, value]) => ({ name, value }));

  // Top products
  const productAgg = new Map<string, number>();
  (saleItems ?? []).forEach((i) => {
    const name = (i.products as { name?: string } | null)?.name ?? "—";
    productAgg.set(name, (productAgg.get(name) ?? 0) + Number(i.line_total ?? 0));
  });
  const topProducts = Array.from(productAgg, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  // Top customers
  const custAgg = new Map<string, number>();
  (sales ?? []).forEach((s) => {
    const name = (s.customers as { name?: string } | null)?.name ?? "—";
    custAgg.set(name, (custAgg.get(name) ?? 0) + Number(s.total ?? 0));
  });
  const topCustomers = Array.from(custAgg, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  // Monthly trend
  const monthAgg = new Map<string, number>();
  (sales ?? []).forEach((s) => {
    const d = new Date(s.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthAgg.set(key, (monthAgg.get(key) ?? 0) + Number(s.total ?? 0));
  });
  const monthly = Array.from(monthAgg, ([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month));

  // Production efficiency
  const planned = (production ?? []).reduce((a, p) => a + Number(p.planned_quantity ?? 0), 0);
  const produced = (production ?? []).reduce((a, p) => a + Number(p.produced_quantity ?? 0), 0);
  const efficiency = planned > 0 ? (produced / planned) * 100 : 0;
  const profitData = !sellerOnly ? allocateProductionProfits(
    production ?? [], (saleItems ?? []) as any[],
    Number(commissionSettings?.commission_standard_per_package ?? 0),
    Number(commissionSettings?.commission_wholesale_per_package ?? 0),
  ).map((profit, index) => ({
    batch: `#${(production ?? [])[index]?.batch_number ?? index + 1}`,
    gross: profit.grossProfit,
    net: profit.netProfit,
    margin: profit.netMargin,
  })) : [];

  const money = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

  return (
    <>
      <PageHeader title="Analytics" description="Inteligencia de negocio en tiempo real." />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Ingresos", value: money(totalRevenue) },
            { label: "Cobrado", value: money(totalPaid) },
            { label: "Por cobrar", value: money(receivables) },
            { label: "Tasa de cobro", value: `${collectionRate.toFixed(1)}%` },
          ].map((k) => (
            <Card key={k.label} className="shadow-card">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="mt-1 font-display text-2xl font-semibold">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-display text-base">Tendencia mensual de ventas</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-display text-base">Ventas por estado</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-display text-base">Top productos</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-display text-base">Top clientes</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCustomers} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="value" fill="var(--gold)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-display text-base">Eficiencia de producción</CardTitle></CardHeader>
          <CardContent className="grid gap-4 p-6 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Planificado</p>
              <p className="font-display text-2xl font-semibold">{planned.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Producido</p>
              <p className="font-display text-2xl font-semibold">{produced.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Eficiencia</p>
              <p className="font-display text-2xl font-semibold text-primary">{efficiency.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>

        {!sellerOnly && (
          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-display text-base">Comportamiento de utilidades por producción</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={profitData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="batch" />
                  <YAxis yAxisId="money" tickFormatter={(v) => money(v)} width={90} />
                  <YAxis yAxisId="percent" orientation="right" tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number, name: string) => name === "Margen neto %" ? `${value.toFixed(1)}%` : money(value)} />
                  <Legend />
                  <Bar yAxisId="money" dataKey="gross" name="Utilidad bruta" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="money" dataKey="net" name="Utilidad neta" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="percent" type="monotone" dataKey="margin" name="Margen neto %" stroke="var(--foreground)" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
