import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToPdf, fmtMoney } from "@/lib/export";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { isSellerScoped } from "@/lib/rbac";
import { ItemsDetail, ItemsToggle, summarizeItems, type ItemLite } from "@/components/items-cell";

export const Route = createFileRoute("/app/receivables")({
  component: ReceivablesPage,
});

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO");
}

function daysSince(d: string | null) {
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

function ReceivablesPage() {
  const { user, roles } = useAuth();
  const sellerOnly = isSellerScoped(roles);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data: company } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("*").limit(1).maybeSingle()).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["receivables", sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("id, invoice_number, issued_at, due_date, balance, customers!inner(name, seller_id), invoice_items(quantity, products(name))")
        .gt("balance", 0)
        .neq("status", "cancelled")
        .order("issued_at", { ascending: true });
      if (sellerOnly && user) query = query.eq("customers.seller_id", user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = (data ?? []).reduce((a, r: any) => a + Number(r.balance || 0), 0);

  const itemList = (r: any): ItemLite[] => (r.invoice_items ?? []).map((item: any) => ({ name: item.products?.name ?? "Producto", quantity: Number(item.quantity ?? 0) }));
  const cols = ["#", "Cliente", "Productos", "Pendiente desde", "Días", "Saldo"];
  const rows = (data ?? []).map((r: any) => [
    `#${r.invoice_number}`,
    r.customers?.name ?? "—",
    summarizeItems(itemList(r), 99),
    fmtDate(r.issued_at),
    daysSince(r.issued_at) ?? "",
    Number(r.balance || 0),
  ]);

  return (
    <>
      <PageHeader
        title="Cuentas por cobrar"
        description="Facturas con saldo pendiente y la fecha desde la que están sin pagar."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportToPdf({ title: "Cartera por cobrar", columns: cols, rows, company, filename: "cartera.pdf" })}>
              <FileText className="mr-1 h-4 w-4" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel({ filename: "cartera.xlsx", sheets: [{ name: "Cartera", columns: cols, rows }] })}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />Excel
            </Button>
          </>
        }
      />
      <div className="p-6">
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="min-w-56">Productos</TableHead>
                <TableHead>Pendiente desde</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No hay cartera pendiente.</TableCell></TableRow>
              ) : (
                (data ?? []).map((r: any) => {
                  const days = daysSince(r.issued_at) ?? 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">#{r.invoice_number}</TableCell>
                      <TableCell className="font-medium">{r.customers?.name ?? "—"}</TableCell>
                      <TableCell>
                        <ItemsToggle items={itemList(r)} open={Boolean(expanded[r.id])} onToggle={() => setExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))} />
                        {expanded[r.id] && <div className="mt-1 pl-4"><ItemsDetail items={itemList(r)} /></div>}
                      </TableCell>
                      <TableCell>{fmtDate(r.issued_at)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${days > 30 ? "text-destructive font-medium" : ""}`}>{days}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtMoney(Number(r.balance))}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {(data ?? []).length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">Total pendiente</TableCell>
                  <TableCell className="text-right font-bold">{fmtMoney(total)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>
    </>
  );
}
