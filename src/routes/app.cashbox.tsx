import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, Smartphone, Gift, Wallet, MinusCircle, ArrowDownCircle, ArrowUpCircle, ShoppingCart } from "lucide-react";
import { fmtMoney } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/app/cashbox")({
  component: CashboxPage,
});

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  nequi: "Nequi",
  daviplata: "Daviplata",
  gift: "Regalo",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};

const CATEGORY_LABELS: Record<string, string> = {
  supplies: "Compra de insumos",
  supplier_payment: "Pago a proveedor",
  commission: "Pago de comisiones",
  other: "Otro",
};

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

function CashboxPage() {
  const qc = useQueryClient();
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [outOpen, setOutOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const { data: rawMaterials } = useQuery({
    queryKey: ["raw-materials-min"],
    queryFn: async () => (await supabase.from("raw_materials" as any).select("id, name, unit").eq("active", true).order("name")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cashbox", from, to],
    queryFn: async () => {
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      const [pays, bills, outs] = await Promise.all([
        supabase
          .from("invoice_payments")
          .select("amount, method, paid_at, invoices(customers(name))")
          .gte("paid_at", fromIso).lte("paid_at", toIso),
        supabase
          .from("bill_payments")
          .select("amount, method, paid_at, reference, bills(suppliers(name))")
          .gte("paid_at", fromIso).lte("paid_at", toIso),
        supabase
          .from("cash_movements")
          .select("amount, method, occurred_at, category, reason, reference")
          .gte("occurred_at", fromIso).lte("occurred_at", toIso),
      ]);
      if (pays.error) throw pays.error;
      if (bills.error) throw bills.error;
      if (outs.error) throw outs.error;

      const rows: any[] = [];
      (pays.data ?? []).forEach((p: any) => rows.push({
        kind: "in", date: p.paid_at, method: p.method, amount: Number(p.amount || 0),
        party: p.invoices?.customers?.name ?? "Cliente",
        detail: "Pago de factura",
      }));
      (bills.data ?? []).forEach((p: any) => rows.push({
        kind: "out", date: p.paid_at, method: p.method, amount: Number(p.amount || 0),
        party: p.bills?.suppliers?.name ?? "Proveedor",
        detail: "Pago a proveedor", reference: p.reference,
        category: "supplier_payment",
      }));
      (outs.data ?? []).forEach((m: any) => rows.push({
        kind: "out", date: m.occurred_at, method: m.method, amount: Number(m.amount || 0),
        party: CATEGORY_LABELS[m.category] ?? m.category,
        detail: m.reason || CATEGORY_LABELS[m.category] || "Salida de caja",
        reference: m.reference, category: m.category,
      }));
      rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const totals: Record<string, { in: number; out: number; net: number }> = {};
      const ensure = (m: string) => (totals[m] ??= { in: 0, out: 0, net: 0 });
      rows.forEach((r) => {
        const t = ensure(r.method);
        if (r.kind === "in") { t.in += r.amount; t.net += r.amount; }
        else { t.out += r.amount; t.net -= r.amount; }
      });
      return { rows, totals };
    },
  });

  const recordOutflow = useMutation({
    mutationFn: async (input: { amount: number; method: string; category: string; reason: string; reference: string; password: string }) => {
      const { error } = await (supabase as any).rpc("record_cash_outflow", {
        _amount: input.amount,
        _method: input.method,
        _category: input.category,
        _reason: input.reason,
        _reference: input.reference,
        _password: input.password,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashbox"] });
      toast.success("Salida registrada");
      setOutOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const purchaseRm = useMutation({
    mutationFn: async (i: { raw_material_id: string; quantity: number; unit_cost: number; method: string; reference: string; password: string }) => {
      const { error } = await (supabase as any).rpc("purchase_raw_material", {
        _raw_material_id: i.raw_material_id, _quantity: i.quantity, _unit_cost: i.unit_cost,
        _method: i.method, _reference: i.reference, _password: i.password,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashbox"] });
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success("Compra registrada: stock e ingreso reflejados");
      setBuyOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = [
    { key: "cash", label: "Efectivo", icon: Banknote, accent: "bg-gradient-primary" },
    { key: "nequi", label: "Nequi", icon: Smartphone, accent: "bg-gradient-gold" },
    { key: "daviplata", label: "Daviplata", icon: Smartphone, accent: "bg-gradient-primary" },
    { key: "gift", label: "Regalo", icon: Gift, accent: "bg-gradient-gold" },
  ];

  const realKeys = ["cash", "nequi", "daviplata"];
  const totalReal = realKeys.reduce((acc, k) => acc + (data?.totals?.[k]?.net ?? 0), 0);

  const resetRange = () => {
    const r = defaultRange();
    setFrom(r.from);
    setTo(r.to);
  };

  return (
    <>
      <PageHeader
        title="Caja"
        description="Dinero recaudado y salidas de efectivo por método de pago."
        actions={
          <>
            <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ShoppingCart className="mr-1 h-4 w-4" /> Compra de insumos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Compra rápida de materia prima</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    purchaseRm.mutate({
                      raw_material_id: String(fd.get("raw_material_id") || ""),
                      quantity: Number(fd.get("quantity") || 0),
                      unit_cost: Number(fd.get("unit_cost") || 0),
                      method: String(fd.get("method") || "cash"),
                      reference: String(fd.get("reference") || ""),
                      password: String(fd.get("password") || ""),
                    });
                  }}
                >
                  <div className="space-y-2">
                    <Label>Materia prima</Label>
                    <Select name="raw_material_id" required>
                      <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                      <SelectContent>
                        {(rawMaterials ?? []).map((rm: any) => (
                          <SelectItem key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Cantidad</Label><Input name="quantity" type="number" step="0.01" min="0.01" required /></div>
                    <div className="space-y-2"><Label>Costo unitario</Label><Input name="unit_cost" type="number" step="0.01" min="0" required /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Método de pago</Label>
                    <Select name="method" defaultValue="cash">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="nequi">Nequi</SelectItem>
                        <SelectItem value="daviplata">Daviplata</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Referencia</Label><Input name="reference" /></div>
                  <div className="space-y-2"><Label>Clave de autorización</Label><Input name="password" type="password" required autoComplete="off" /></div>
                  <DialogFooter>
                    <Button type="submit" disabled={purchaseRm.isPending} className="bg-gradient-primary">
                      {purchaseRm.isPending ? "Guardando…" : "Registrar compra"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={outOpen} onOpenChange={setOutOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <MinusCircle className="mr-1 h-4 w-4" /> Registrar salida
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Registrar salida de caja</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  recordOutflow.mutate({
                    amount: Number(fd.get("amount") || 0),
                    method: String(fd.get("method") || "cash"),
                    category: String(fd.get("category") || "other"),
                    reason: String(fd.get("reason") || ""),
                    reference: String(fd.get("reference") || ""),
                    password: String(fd.get("password") || ""),
                  });
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="o_amount">Monto</Label>
                    <Input id="o_amount" name="amount" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="o_method">Método</Label>
                    <Select name="method" defaultValue="cash">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="nequi">Nequi</SelectItem>
                        <SelectItem value="daviplata">Daviplata</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o_category">Categoría</Label>
                  <Select name="category" defaultValue="supplies">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplies">Compra de insumos</SelectItem>
                      <SelectItem value="supplier_payment">Pago a proveedor</SelectItem>
                      <SelectItem value="commission">Pago de comisiones</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o_reason">Motivo / descripción</Label>
                  <Input id="o_reason" name="reason" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o_reference">Referencia (opcional)</Label>
                  <Input id="o_reference" name="reference" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o_password">Clave de autorización</Label>
                  <Input id="o_password" name="password" type="password" required autoComplete="off" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={recordOutflow.isPending} className="bg-gradient-primary">
                    {recordOutflow.isPending ? "Guardando…" : "Registrar salida"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
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
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const t = data?.totals?.[c.key];
            return (
              <Card key={c.key} className="overflow-hidden shadow-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                      <p className="font-display text-2xl font-semibold tracking-tight">{fmtMoney(t?.net ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="text-emerald-600">+{fmtMoney(t?.in ?? 0)}</span>{" · "}
                        <span className="text-destructive">-{fmtMoney(t?.out ?? 0)}</span>
                      </p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground ${c.accent}`}>
                      <c.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Saldo disponible (Efectivo + Nequi + Daviplata): {fmtMoney(totalReal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              El método <b>Regalo</b> no representa dinero recibido y se excluye del saldo disponible.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto / contraparte</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : (data?.rows ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Sin movimientos en el rango.</TableCell></TableRow>
                ) : (
                  (data?.rows ?? []).map((r: any, idx: number) => {
                    const isOut = r.kind === "out";
                    return (
                      <TableRow key={idx} className={isOut ? "bg-destructive/5" : "bg-emerald-500/5"}>
                        <TableCell>
                          <Badge variant={isOut ? "destructive" : "default"} className="gap-1">
                            {isOut ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
                            {isOut ? "Salida" : "Ingreso"}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(r.date).toLocaleString("es-CO")}</TableCell>
                        <TableCell className="font-medium">{r.party}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.detail}{r.reference ? ` · ${r.reference}` : ""}</TableCell>
                        <TableCell>{METHOD_LABELS[r.method] ?? r.method}</TableCell>
                        <TableCell className={`text-right font-medium ${isOut ? "text-destructive" : "text-emerald-600"}`}>
                          {isOut ? "-" : "+"}{fmtMoney(r.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
