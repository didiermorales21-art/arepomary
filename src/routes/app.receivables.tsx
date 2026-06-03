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

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO");
}

function daysSince(d: string | null) {
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
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
        .select("id, invoice_number, issued_at, due_date, balance, customers(name)")
        .gt("balance", 0)
        .neq("status", "cancelled")
        .order("issued_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = (data ?? []).reduce((a, r: any) => a + Number(r.balance || 0), 0);

  const cols = ["#", "Cliente", "Pendiente desde", "Días", "Saldo"];
  const rows = (data ?? []).map((r: any) => [
    `#${r.invoice_number}`,
    r.customers?.name ?? "—",
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
                <TableHead>Pendiente desde</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No hay cartera pendiente.</TableCell></TableRow>
              ) : (
                (data ?? []).map((r: any) => {
                  const days = daysSince(r.issued_at) ?? 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">#{r.invoice_number}</TableCell>
                      <TableCell className="font-medium">{r.customers?.name ?? "—"}</TableCell>
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
                  <TableCell colSpan={4} className="font-semibold">Total pendiente</TableCell>
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
