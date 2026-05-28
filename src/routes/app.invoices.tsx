import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, FileDown, Download, FileSpreadsheet, FileText, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { exportToExcel, exportToPdf, generateInvoicePdf, fmtMoney } from "@/lib/export";

export const Route = createFileRoute("/app/invoices")({
  component: InvoicesPage,
});

type InvoiceRow = {
  id: string;
  invoice_number: number;
  issued_at: string;
  due_date: string | null;
  total: number;
  paid: number;
  balance: number;
  status: string;
  customer_id: string;
  notes: string | null;
  customers?: { name: string; tax_id?: string | null; address?: string | null; phone?: string | null } | null;
};

function statusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (s === "paid") return "default";
  if (s === "overdue") return "destructive";
  if (s === "cancelled") return "outline";
  return "secondary";
}

function InvoicesPage() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "operations"]);
  const [openCreate, setOpenCreate] = useState(false);
  const [detail, setDetail] = useState<InvoiceRow | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("*").limit(1).maybeSingle()).data,
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-lite"],
    queryFn: async () => (await supabase.from("customers").select("id, name").order("name")).data ?? [],
  });

  const { data: sales } = useQuery({
    queryKey: ["sales-for-invoice"],
    queryFn: async () => (await supabase.from("sales").select("id, sale_number, customer_id, total").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, issued_at, due_date, total, paid, balance, status, customer_id, notes, customers(name, tax_id, address, phone)")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceRow[];
    },
  });

  const { data: detailItems } = useQuery({
    queryKey: ["invoice-items", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_items")
        .select("id, quantity, unit_price, line_total, products(name, sku)")
        .eq("invoice_id", detail!.id);
      return data ?? [];
    },
  });

  const { data: detailPayments } = useQuery({
    queryKey: ["invoice-payments", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_payments")
        .select("id, amount, method, reference, paid_at")
        .eq("invoice_id", detail!.id)
        .order("paid_at", { ascending: false });
      return data ?? [];
    },
  });

  const createFromSale = useMutation({
    mutationFn: async (input: { sale_id: string; due_date: string }) => {
      const sale = sales?.find((s) => s.id === input.sale_id);
      if (!sale) throw new Error("Venta no encontrada");
      const { data: items } = await supabase.from("sale_items").select("product_id, quantity, unit_price").eq("sale_id", input.sale_id);
      const { data: inv, error } = await supabase.from("invoices").insert({
        sale_id: input.sale_id,
        customer_id: sale.customer_id,
        due_date: input.due_date || null,
        status: "issued",
      }).select("id").single();
      if (error) throw error;
      if (items && items.length > 0) {
        const { error: e2 } = await supabase.from("invoice_items").insert(
          items.map((it) => ({ invoice_id: inv.id, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price }))
        );
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Factura creada");
      setOpenCreate(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayment = useMutation({
    mutationFn: async (input: { amount: number; method: string; reference: string }) => {
      if (!detail) throw new Error("Sin factura");
      const { error } = await supabase.from("invoice_payments").insert({
        invoice_id: detail.id,
        amount: input.amount,
        method: input.method as "cash",
        reference: input.reference || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-payments", detail?.id] });
      toast.success("Pago registrado");
      setPayOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportList = (kind: "pdf" | "xlsx") => {
    const cols = ["N°", "Fecha", "Cliente", "Vence", "Total", "Pagado", "Saldo", "Estado"];
    const rows = (invoices ?? []).map((i) => [
      i.invoice_number,
      i.issued_at,
      i.customers?.name ?? "—",
      i.due_date ?? "—",
      Number(i.total),
      Number(i.paid),
      Number(i.balance),
      i.status,
    ]);
    if (kind === "pdf") exportToPdf({ title: "Facturas", columns: cols, rows, company, filename: "facturas.pdf" });
    else exportToExcel({ filename: "facturas.xlsx", sheets: [{ name: "Facturas", columns: cols, rows }] });
  };

  const downloadInvoicePdf = async (inv: InvoiceRow) => {
    const { data: items } = await supabase
      .from("invoice_items")
      .select("quantity, unit_price, products(name)")
      .eq("invoice_id", inv.id);
    type Row = { quantity: number; unit_price: number; products: { name: string } | { name: string }[] | null };
    generateInvoicePdf({
      number: inv.invoice_number,
      issued_at: inv.issued_at,
      due_date: inv.due_date,
      customer: inv.customers ?? { name: "Cliente" },
      tax: 0,
      notes: inv.notes,
      company,
      lines: ((items ?? []) as Row[]).map((it) => {
        const p = Array.isArray(it.products) ? it.products[0] : it.products;
        return {
          description: p?.name ?? "Producto",
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        };
      }),
    });
  };

  return (
    <>
      <PageHeader
        title="Facturas"
        description="Emisión, seguimiento y cobro de facturas a clientes."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportList("pdf")}><FileText className="mr-1 h-4 w-4" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportList("xlsx")}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
            {canManage && (
              <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary shadow-elegant"><Plus className="mr-1 h-4 w-4" />Nueva factura</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-display">Facturar venta</DialogTitle></DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      createFromSale.mutate({
                        sale_id: String(fd.get("sale_id") || ""),
                        due_date: String(fd.get("due_date") || ""),
                      });
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="sale_id">Venta a facturar</Label>
                      <Select name="sale_id" required>
                        <SelectTrigger><SelectValue placeholder="Selecciona una venta" /></SelectTrigger>
                        <SelectContent>
                          {(sales ?? []).map((s) => {
                            const c = customers?.find((c) => c.id === s.customer_id);
                            return (
                              <SelectItem key={s.id} value={s.id}>
                                #{s.sale_number} · {c?.name ?? "—"} · {fmtMoney(Number(s.total))}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="due_date">Fecha de vencimiento</Label>
                      <Input id="due_date" name="due_date" type="date" />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createFromSale.isPending} className="bg-gradient-primary">
                        {createFromSale.isPending ? "Generando…" : "Generar factura"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />
      <div className="p-6">
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (invoices ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Sin facturas emitidas.</TableCell></TableRow>
              ) : (
                (invoices ?? []).map((i) => (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => setDetail(i)}>
                    <TableCell className="font-mono">#{i.invoice_number}</TableCell>
                    <TableCell>{i.issued_at}</TableCell>
                    <TableCell className="font-medium">{i.customers?.name ?? "—"}</TableCell>
                    <TableCell>{i.due_date ?? "—"}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(i.total))}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(i.balance))}</TableCell>
                    <TableCell><Badge variant={statusVariant(i.status)}>{i.status}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); downloadInvoicePdf(i); }}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Factura #{detail.invoice_number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Cliente:</span> <b>{detail.customers?.name}</b></div>
                  <div><span className="text-muted-foreground">Estado:</span> <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge></div>
                  <div><span className="text-muted-foreground">Emitida:</span> {detail.issued_at}</div>
                  <div><span className="text-muted-foreground">Vence:</span> {detail.due_date ?? "—"}</div>
                  <div><span className="text-muted-foreground">Total:</span> <b>{fmtMoney(Number(detail.total))}</b></div>
                  <div><span className="text-muted-foreground">Saldo:</span> <b>{fmtMoney(Number(detail.balance))}</b></div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Líneas</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailItems ?? []).map((it: { id: string; quantity: number; unit_price: number; line_total: number; products: { name: string } | { name: string }[] | null }) => {
                        const p = Array.isArray(it.products) ? it.products[0] : it.products;
                        return (
                          <TableRow key={it.id}>
                            <TableCell>{p?.name ?? "—"}</TableCell>
                            <TableCell className="text-right">{it.quantity}</TableCell>
                            <TableCell className="text-right">{fmtMoney(Number(it.unit_price))}</TableCell>
                            <TableCell className="text-right">{fmtMoney(Number(it.line_total))}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Pagos</h4>
                  {(detailPayments ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Ref.</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detailPayments ?? []).map((p: { id: string; paid_at: string; method: string; reference: string | null; amount: number }) => (
                          <TableRow key={p.id}>
                            <TableCell>{new Date(p.paid_at).toLocaleDateString("es-CO")}</TableCell>
                            <TableCell>{p.method}</TableCell>
                            <TableCell>{p.reference ?? "—"}</TableCell>
                            <TableCell className="text-right">{fmtMoney(Number(p.amount))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => downloadInvoicePdf(detail)}>
                  <FileDown className="mr-1 h-4 w-4" />Descargar PDF
                </Button>
                {canManage && Number(detail.balance) > 0 && (
                  <Button className="bg-gradient-primary" onClick={() => setPayOpen(true)}>
                    <CreditCard className="mr-1 h-4 w-4" />Registrar pago
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Registrar pago</DialogTitle></DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              addPayment.mutate({
                amount: Number(fd.get("amount") || 0),
                method: String(fd.get("method") || "cash"),
                reference: String(fd.get("reference") || ""),
              });
            }}
          >
            <div className="space-y-2"><Label htmlFor="amount">Monto</Label><Input id="amount" name="amount" type="number" step="0.01" required defaultValue={detail?.balance} /></div>
            <div className="space-y-2">
              <Label htmlFor="method">Método</Label>
              <Select name="method" defaultValue="cash">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="check">Cheque</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="reference">Referencia</Label><Input id="reference" name="reference" /></div>
            <DialogFooter>
              <Button type="submit" disabled={addPayment.isPending} className="bg-gradient-primary">
                {addPayment.isPending ? "Guardando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
