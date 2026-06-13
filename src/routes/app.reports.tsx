import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, FileText, BarChart3, Package, Wheat, Wallet, Receipt, UserSquare2 } from "lucide-react";
import { exportToExcel, exportToPdf, fmtMoney } from "@/lib/export";
import { useAuth } from "@/hooks/use-auth";
import { isSellerScoped } from "@/lib/rbac";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { user, roles } = useAuth();
  const sellerOnly = isSellerScoped(roles);
  const { data: company } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("*").limit(1).maybeSingle()).data,
  });

  const reports = [
    {
      key: "sales",
      title: "Ventas",
      desc: "Listado completo de ventas registradas.",
      icon: BarChart3,
      load: async () => {
        let query = supabase.from("sales").select("sale_number, created_at, total, paid, balance, status, seller_id").order("created_at", { ascending: false });
        if (sellerOnly && user) query = query.eq("seller_id", user.id);
        const { data } = await query;
        return {
          cols: ["N°", "Fecha", "Total", "Pagado", "Saldo", "Estado"],
          rows: (data ?? []).map((s) => [s.sale_number, new Date(s.created_at).toLocaleDateString("es-CO"), Number(s.total), Number(s.paid), Number(s.balance ?? 0), s.status]),
        };
      },
    },
    {
      key: "inventory",
      title: "Inventario valorizado",
      desc: "Stock actual con valor estimado por precio de producto.",
      icon: Package,
      load: async () => {
        const { data: inv } = await supabase.from("inventory").select("product_id, warehouse_id, quantity");
        const pids = Array.from(new Set((inv ?? []).map((i) => i.product_id)));
        const wids = Array.from(new Set((inv ?? []).map((i) => i.warehouse_id)));
        const { data: prods } = pids.length ? await supabase.from("products").select("id, name, sku, price").in("id", pids) : { data: [] };
        const { data: wh } = wids.length ? await supabase.from("warehouses").select("id, name").in("id", wids) : { data: [] };
        const pm = new Map((prods ?? []).map((p) => [p.id, p]));
        const wm = new Map((wh ?? []).map((w) => [w.id, w.name]));
        return {
          cols: ["Producto", "SKU", "Almacén", "Cantidad", "Precio", "Valor"],
          rows: (inv ?? []).map((i) => {
            const p = pm.get(i.product_id);
            return [p?.name ?? "—", p?.sku ?? "—", wm.get(i.warehouse_id) ?? "—", Number(i.quantity), Number(p?.price ?? 0), Number(i.quantity) * Number(p?.price ?? 0)];
          }),
        };
      },
    },
    {
      key: "production",
      title: "Producción",
      desc: "Lotes de producción, cantidades y costos.",
      icon: Wheat,
      load: async () => {
        const { data } = await supabase.from("production_batches").select("batch_number, scheduled_for, planned_quantity, produced_quantity, unit_cost, status").order("created_at", { ascending: false });
        return {
          cols: ["Lote", "Programado", "Planeado", "Producido", "Costo unit.", "Estado"],
          rows: (data ?? []).map((b) => [b.batch_number, b.scheduled_for ?? "—", Number(b.planned_quantity), Number(b.produced_quantity), Number(b.unit_cost), b.status]),
        };
      },
    },
    {
      key: "receivables",
      title: "Cobranza",
      desc: "Facturas pendientes de cobro.",
      icon: Wallet,
      load: async () => {
        let query = supabase.from("invoices").select("invoice_number, issued_at, due_date, total, paid, balance, status, customers!inner(seller_id)").gt("balance", 0).neq("status", "cancelled");
        if (sellerOnly && user) query = query.eq("customers.seller_id", user.id);
        const { data } = await query;
        return {
          cols: ["N°", "Emitida", "Vence", "Total", "Pagado", "Saldo", "Estado"],
          rows: (data ?? []).map((i) => [i.invoice_number, i.issued_at, i.due_date ?? "—", Number(i.total), Number(i.paid), Number(i.balance), i.status]),
        };
      },
    },
    {
      key: "sales-by-seller",
      title: "Ventas por vendedor",
      desc: "Cantidad de ventas, total facturado y saldo pendiente por vendedor.",
      icon: UserSquare2,
      load: async () => {
        let query = supabase.from("sales").select("seller_id, total, paid, balance");
        if (sellerOnly && user) query = query.eq("seller_id", user.id);
        const { data: sales } = await query;
        const sellerIds = Array.from(new Set((sales ?? []).map((s) => s.seller_id)));
        const { data: profiles } = sellerIds.length
          ? await supabase.from("profiles").select("id, full_name").in("id", sellerIds)
          : { data: [] };
        const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || "(sin nombre)"]));
        const agg = new Map<string, { count: number; total: number; paid: number; balance: number }>();
        (sales ?? []).forEach((s) => {
          const cur = agg.get(s.seller_id) ?? { count: 0, total: 0, paid: 0, balance: 0 };
          cur.count += 1;
          cur.total += Number(s.total);
          cur.paid += Number(s.paid);
          cur.balance += Number(s.balance ?? 0);
          agg.set(s.seller_id, cur);
        });
        const rows = Array.from(agg.entries())
          .map(([sid, v]) => [nameMap.get(sid) ?? "—", v.count, v.total, v.paid, v.balance])
          .sort((a, b) => Number(b[2]) - Number(a[2]));
        return { cols: ["Vendedor", "N° ventas", "Total", "Pagado", "Saldo"], rows };
      },
    },
    {
      key: "payables",
      title: "Pagos a proveedores",
      desc: "Cuentas por pagar pendientes.",
      icon: Receipt,
      load: async () => {
        const { data } = await supabase.from("bills").select("bill_number, issued_at, due_date, total, paid, balance, status").gt("balance", 0);
        return {
          cols: ["N°", "Emitida", "Vence", "Total", "Pagado", "Saldo", "Estado"],
          rows: (data ?? []).map((b) => [b.bill_number, b.issued_at, b.due_date ?? "—", Number(b.total), Number(b.paid), Number(b.balance), b.status]),
        };
      },
    },
  ];

  return (
    <>
      <PageHeader title="Centro de reportes" description="Exporta cualquier reporte a PDF o Excel." />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {reports.filter((r) => !sellerOnly || ["sales", "receivables", "sales-by-seller"].includes(r.key)).map((r) => (
          <Card key={r.key} className="shadow-card">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                  <r.icon className="h-5 w-5" />
                </div>
              </div>
              <CardTitle className="mt-3 font-display text-lg">{r.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={async () => {
                  const { cols, rows } = await r.load();
                  exportToPdf({ title: r.title, columns: cols, rows, company, filename: `${r.key}.pdf` });
                }}
              >
                <FileText className="mr-1 h-4 w-4" />PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={async () => {
                  const { cols, rows } = await r.load();
                  exportToExcel({ filename: `${r.key}.xlsx`, sheets: [{ name: r.title, columns: cols, rows }] });
                }}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />Excel
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="px-6 pb-6 text-xs text-muted-foreground">
        Moneda configurada: {company?.currency ?? "COP"} · Los reportes usan {fmtMoney(0)} como formato base.
      </div>
    </>
  );
}
