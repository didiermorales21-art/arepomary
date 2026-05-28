import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToPdf, fmtMoney } from "@/lib/export";

export const Route = createFileRoute("/app/receivables")({
  component: ReceivablesPage,
});

interface Row {
  customer_id: string;
  name: string;
  current: number;
  d30: number;
  d60: number;
  d90: number;
  d90plus: number;
  total: number;
}

function ReceivablesPage() {
  const { data: company } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("*").limit(1).maybeSingle()).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("customer_id, due_date, balance, customers(name)")
        .gt("balance", 0)
        .neq("status", "cancelled");
      if (error) throw error;
      const today = new Date();
      const buckets = new Map<string, Row>();
      (data ?? []).forEach((inv) => {
        const c = inv.customers as { name: string } | { name: string }[] | null;
        const name = Array.isArray(c) ? c[0]?.name : c?.name;
        const id = inv.customer_id;
        const bal = Number(inv.balance || 0);
        const due = inv.due_date ? new Date(inv.due_date) : null;
        const days = due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0;
        const r = buckets.get(id) ?? { customer_id: id, name: name ?? "—", current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, total: 0 };
        if (days <= 0) r.current += bal;
        else if (days <= 30) r.d30 += bal;
        else if (days <= 60) r.d60 += bal;
        else if (days <= 90) r.d90 += bal;
        else r.d90plus += bal;
        r.total += bal;
        buckets.set(id, r);
      });
      return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
    },
  });

  const totals = (data ?? []).reduce(
    (a, r) => ({ current: a.current + r.current, d30: a.d30 + r.d30, d60: a.d60 + r.d60, d90: a.d90 + r.d90, d90plus: a.d90plus + r.d90plus, total: a.total + r.total }),
    { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, total: 0 },
  );

  const cols = ["Cliente", "Al día", "1-30", "31-60", "61-90", "+90", "Total"];
  const rows = (data ?? []).map((r) => [r.name, r.current, r.d30, r.d60, r.d90, r.d90plus, r.total]);

  return (
    <>
      <PageHeader
        title="Cuentas por cobrar"
        description="Saldos pendientes por cliente con análisis de antigüedad."
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
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Al día</TableHead>
                <TableHead className="text-right">1-30</TableHead>
                <TableHead className="text-right">31-60</TableHead>
                <TableHead className="text-right">61-90</TableHead>
                <TableHead className="text-right">+90</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No hay cartera pendiente.</TableCell></TableRow>
              ) : (
                (data ?? []).map((r) => (
                  <TableRow key={r.customer_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.current)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.d30)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.d60)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.d90)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmtMoney(r.d90plus)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(r.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {(data ?? []).length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Totales</TableCell>
                  <TableCell className="text-right">{fmtMoney(totals.current)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(totals.d30)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(totals.d60)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(totals.d90)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(totals.d90plus)}</TableCell>
                  <TableCell className="text-right font-bold">{fmtMoney(totals.total)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>
    </>
  );
}
