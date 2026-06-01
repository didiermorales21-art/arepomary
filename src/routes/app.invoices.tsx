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
        .select("id, invoice_number, issued_at, due_date, total, paid, balance, status, customer_id, notes")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((i) => i.customer_id)));
      const { data: cs } = ids.length
        ? await supabase.from("customers").select("id, name, address, phone").in("id", ids)
        : { data: [] };
      const map = new Map((cs ?? []).map((c) => [c.id, c]));
      return (data ?? []).map((i) => ({ ...i, customers: map.get(i.customer_id) ?? null })) as unknown as InvoiceRow[];
    },
  });

  const { data: detailItems } = useQuery({
    queryKey: ["invoice-items", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const { data: items } = await supabase
        .from("invoice_items")
        .select("id, quantity, unit_price, line_total, product_id")
        .eq("invoice_id", detail!.id);
      const ids = Array.from(new Set((items ?? []).map((i) => i.product_id)));
      const { data: prods } = ids.length
        ? await supabase.from("products").select("id, name, sku").in("id", ids)
        : { data: [] };
      const map = new Map((prods ?? []).map((p) => [p.id, p]));
      return (items ?? []).map((i) => ({ ...i, product: map.get(i.product_id) }));
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
    mutationFn: async (input: { amount: number; method: string; reference: string; gift_password?: string }) => {
      if (!detail) throw new Error("Sin factura");
      const pendiente = Number(detail.total ?? 0) - Number(detail.paid ?? 0);
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new Error("El monto debe ser mayor a 0");
      }
      if (input.amount > pendiente + 0.001) {
        throw new Error(`El monto excede el saldo pendiente (${pendiente.toLocaleString()})`);
      }
      const { error } = await supabase.rpc("add_invoice_payment", {
        _invoice_id: detail.id,
        _amount: input.amount,
        _method: input.method,
        _reference: input.reference || undefined,
        _gift_password: input.gift_password || undefined,
      });
      if (error) throw error;
      return { cubreTotal: Math.abs(input.amount - pendiente) < 0.01 };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-payments", detail?.id] });
      toast.success(res?.cubreTotal ? "Pago total registrado. Factura pagada." : "Pago parcial registrado");
      setPayOpen(false);
    },
    onError: (e: Error) => toast.error(e.message.includes("invalid gift password") ? "Clave incorrecta para Regalo" : e.message),
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
      .select("quantity, unit_price, product_id")
      .eq("invoice_id", inv.id);
    const ids = Array.from(new Set((items ?? []).map((i) => i.product_id)));
    const { data: prods } = ids.length
      ? await supabase.from("products").select("id, name").in("id", ids)
      : { data: [] };
    const pmap = new Map((prods ?? []).map((p) => [p.id, p.name]));
    generateInvoicePdf({
      number: inv.invoice_number,
      issued_at: inv.issued_at,
      due_date: inv.due_date,
      customer: inv.customers ?? { name: "Cliente" },
      tax: 0,
      notes: inv.notes,
      company,
      lines: (items ?? []).map((it) => ({
        description: pmap.get(it.product_id) ?? "Producto",
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      })),
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
                      {(detailItems ?? []).map((it) => (
                          <TableRow key={it.id}>
                            <TableCell>{it.product?.name ?? "—"}</TableCell>
                            <TableCell className="text-right">{it.quantity}</TableCell>
                            <TableCell className="text-right">{fmtMoney(Number(it.unit_price))}</TableCell>
                            <TableCell className="text-right">{fmtMoney(Number(it.line_total))}</TableCell>
                          </TableRow>
                      ))}
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
          <PaymentForm
            pendiente={Number(detail?.total ?? 0) - Number(detail?.paid ?? 0)}
            isPending={addPayment.isPending}
            onSubmit={(v) => addPayment.mutate(v)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function PaymentForm({ pendiente, isPending, onSubmit }: { pendiente: number; isPending: boolean; onSubmit: (v: { amount: number; method: string; reference: string; gift_password?: string }) => void }) {
  const [amount, setAmount] = useState<string>(pendiente > 0 ? String(pendiente) : "");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [giftPassword, setGiftPassword] = useState("");
  const num = Number(amount);
  const valid = Number.isFinite(num) && num > 0 && num <= pendiente + 0.001;
  const excede = Number.isFinite(num) && num > pendiente + 0.001;
  const esTotal = valid && Math.abs(num - pendiente) < 0.01;
  const esParcial = valid && !esTotal;
  const isGift = method === "gift";
  const giftOk = !isGift || giftPassword.length > 0;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (!valid || !giftOk) return; onSubmit({ amount: num, method, reference, gift_password: isGift ? giftPassword : undefined }); }}
    >
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        Saldo pendiente: <span className="font-semibold">${pendiente.toLocaleString()}</span>
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Monto</Label>
        <Input id="amount" type="number" step="0.01" min="0" max={pendiente} required value={amount} onChange={(e) => setAmount(e.target.value)} />
        {excede && <p className="text-xs text-destructive">El monto excede el saldo pendiente.</p>}
        {esTotal && <p className="text-xs text-primary">Este pago cubre la totalidad. La factura quedará pagada.</p>}
        {esParcial && <p className="text-xs text-muted-foreground">Pago parcial. Quedará un saldo de ${(pendiente - num).toLocaleString()}.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="method">Método</Label>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Efectivo</SelectItem>
            <SelectItem value="nequi">Nequi</SelectItem>
            <SelectItem value="daviplata">Daviplata</SelectItem>
            <SelectItem value="gift">Regalo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isGift && (
        <div className="space-y-2">
          <Label htmlFor="gift_password">Clave de autorización (Regalo)</Label>
          <Input id="gift_password" type="password" required value={giftPassword} onChange={(e) => setGiftPassword(e.target.value)} placeholder="Ingresa la clave" />
          <p className="text-xs text-muted-foreground">Los pagos tipo Regalo requieren clave del administrador.</p>
        </div>
      )}
      <div className="space-y-2"><Label htmlFor="reference">Referencia</Label><Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
      <DialogFooter>
        <Button type="submit" disabled={isPending || !valid || !giftOk} className="bg-gradient-primary">
          {isPending ? "Guardando…" : "Registrar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
