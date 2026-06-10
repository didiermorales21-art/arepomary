import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileSpreadsheet, FileText, CreditCard, Users, Truck } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { exportToExcel, exportToPdf, fmtMoney } from "@/lib/export";

export const Route = createFileRoute("/app/payables")({
  component: PayablesPage,
});

type BillRow = {
  id: string;
  bill_number: number;
  supplier_id: string | null;
  collaborator_id?: string | null;
  issued_at: string;
  due_date: string | null;
  total: number;
  paid: number;
  balance: number;
  status: string;
  notes: string | null;
  supplier_name?: string;
};


function statusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (s === "paid") return "default";
  if (s === "overdue") return "destructive";
  if (s === "cancelled") return "outline";
  return "secondary";
}

function PayablesPage() {
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [payFor, setPayFor] = useState<BillRow | null>(null);
  const [tab, setTab] = useState<"all" | "supplier" | "labor">("all");

  const { data: company } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("*").limit(1).maybeSingle()).data,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-lite"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name").order("name")).data ?? [],
  });

  const { data: rawMaterials } = useQuery({
    queryKey: ["raw-materials-min"],
    queryFn: async () => (await supabase.from("raw_materials" as any).select("id, name, unit").eq("active", true).order("name")).data ?? [],
  });

  const { data: bills, isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("id, bill_number, supplier_id, collaborator_id, issued_at, due_date, total, paid, balance, status, notes" as any)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const supIds = Array.from(new Set(rows.map((b) => b.supplier_id).filter((x): x is string => !!x)));
      const colIds = Array.from(new Set(rows.map((b) => b.collaborator_id).filter((x): x is string => !!x)));
      const [{ data: sup }, { data: cols }] = await Promise.all([
        supIds.length ? supabase.from("suppliers").select("id, name").in("id", supIds) : Promise.resolve({ data: [] as any[] }),
        colIds.length ? supabase.from("collaborators" as any).select("id, full_name").in("id", colIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const ms = new Map((sup ?? []).map((s: any) => [s.id, s.name]));
      const mc = new Map((cols ?? []).map((c: any) => [c.id, c.full_name]));
      return rows.map((b) => ({ ...b, supplier_name: (b.supplier_id && ms.get(b.supplier_id)) || (b.collaborator_id && mc.get(b.collaborator_id)) || "—" })) as BillRow[];
    },
  });


  const createBill = useMutation({
    mutationFn: async (input: { supplier_id: string; due_date: string; description: string; amount: number; tax: number; raw_material_id: string; quantity: number }) => {
      if (!input.amount || input.amount <= 0) throw new Error("El monto debe ser mayor a 0");
      const { data: bill, error } = await supabase
        .from("bills")
        .insert({ supplier_id: input.supplier_id, due_date: input.due_date || null, status: "received", tax: input.tax })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("bill_items").insert({
        bill_id: bill.id,
        description: input.description,
        quantity: input.quantity || 1,
        unit_price: input.amount / (input.quantity || 1),
        raw_material_id: input.raw_material_id || null,
      } as any);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success("Factura de proveedor creada");
      setOpenCreate(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayment = useMutation({
    mutationFn: async (input: { amount: number; method: string; reference: string; password: string }) => {
      if (!payFor) throw new Error("Sin factura");
      const { error } = await (supabase as any).rpc("add_bill_payment", {
        _bill_id: payFor.id,
        _amount: input.amount,
        _method: input.method,
        _reference: input.reference,
        _password: input.password,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["cashbox"] });
      toast.success("Pago registrado y reflejado en caja");
      setPayFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return (bills ?? []).filter((b) => tab === "all" ? true : tab === "labor" ? !!b.collaborator_id : !!b.supplier_id);
  }, [bills, tab]);

  const cols = ["N°", "Tipo", "Beneficiario", "Fecha", "Vence", "Total", "Pagado", "Saldo", "Estado"];
  const rows = filtered.map((b) => [b.bill_number, b.collaborator_id ? "Mano de obra" : "Proveedor", b.supplier_name ?? "—", b.issued_at, b.due_date ?? "—", Number(b.total), Number(b.paid), Number(b.balance), b.status]);

  return (
    <>
      <PageHeader
        title="Cuentas por pagar"
        description="Facturas de proveedores y pagos realizados."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportToPdf({ title: "Cuentas por pagar", columns: cols, rows, company, filename: "cxp.pdf" })}>
              <FileText className="mr-1 h-4 w-4" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel({ filename: "cxp.xlsx", sheets: [{ name: "CxP", columns: cols, rows }] })}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />Excel
            </Button>
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-elegant"><Plus className="mr-1 h-4 w-4" />Nueva</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Nueva factura de proveedor</DialogTitle></DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createBill.mutate({
                      supplier_id: String(fd.get("supplier_id") || ""),
                      due_date: String(fd.get("due_date") || ""),
                      description: String(fd.get("description") || ""),
                      amount: Number(fd.get("amount") || 0),
                      tax: Number(fd.get("tax") || 0),
                      raw_material_id: String(fd.get("raw_material_id") || ""),
                      quantity: Number(fd.get("quantity") || 1),
                    });
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="supplier_id">Proveedor</Label>
                    <Select name="supplier_id" required>
                      <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                      <SelectContent>
                        {(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="description">Descripción</Label><Input id="description" name="description" required /></div>
                  <div className="space-y-2">
                    <Label htmlFor="raw_material_id">Materia prima (opcional, suma stock al recibir)</Label>
                    <Select name="raw_material_id">
                      <SelectTrigger><SelectValue placeholder="Sin vínculo" /></SelectTrigger>
                      <SelectContent>
                        {(rawMaterials ?? []).map((rm: any) => (
                          <SelectItem key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2"><Label htmlFor="quantity">Cantidad</Label><Input id="quantity" name="quantity" type="number" step="0.01" min="0.01" defaultValue={1} /></div>
                    <div className="space-y-2"><Label htmlFor="amount">Subtotal</Label><Input id="amount" name="amount" type="number" step="0.01" min="0.01" required /></div>
                    <div className="space-y-2"><Label htmlFor="tax">IVA</Label><Input id="tax" name="tax" type="number" step="0.01" defaultValue={0} /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="due_date">Vence</Label><Input id="due_date" name="due_date" type="date" /></div>
                  <DialogFooter>
                    <Button type="submit" disabled={createBill.isPending} className="bg-gradient-primary">
                      {createBill.isPending ? "Guardando…" : "Guardar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <div className="p-6 space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todas ({(bills ?? []).length})</TabsTrigger>
            <TabsTrigger value="supplier"><Truck className="mr-1 h-3.5 w-3.5" />Proveedores ({(bills ?? []).filter((b) => b.supplier_id).length})</TabsTrigger>
            <TabsTrigger value="labor"><Users className="mr-1 h-3.5 w-3.5" />Mano de obra ({(bills ?? []).filter((b) => b.collaborator_id).length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Beneficiario</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">Sin cuentas por pagar.</TableCell></TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono">#{b.bill_number}</TableCell>
                    <TableCell>
                      {b.collaborator_id ? (
                        <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />Mano de obra</Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1"><Truck className="h-3 w-3" />Proveedor</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{b.supplier_name ?? "—"}</TableCell>
                    <TableCell>{b.issued_at}</TableCell>
                    <TableCell>{b.due_date ?? "—"}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(b.total))}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(b.balance))}</TableCell>
                    <TableCell><Badge variant={statusVariant(b.status)}>{b.status}</Badge></TableCell>
                    <TableCell>
                      {Number(b.balance) > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setPayFor(b)}>
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Registrar pago {payFor?.collaborator_id ? "a colaborador" : "a proveedor"}</DialogTitle></DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              addPayment.mutate({
                amount: Number(fd.get("amount") || 0),
                method: String(fd.get("method") || "cash"),
                reference: String(fd.get("reference") || ""),
                password: String(fd.get("password") || ""),
              });
            }}
          >
            <div className="space-y-2"><Label htmlFor="amount">Monto</Label><Input id="amount" name="amount" type="number" step="0.01" required defaultValue={payFor?.balance} /></div>
            <div className="space-y-2">
              <Label htmlFor="method">Método de pago</Label>
              <Select name="method" defaultValue="cash">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="nequi">Nequi</SelectItem>
                  <SelectItem value="daviplata">Daviplata</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Este pago se descontará del saldo de caja del método seleccionado.</p>
            </div>
            <div className="space-y-2"><Label htmlFor="reference">Referencia</Label><Input id="reference" name="reference" /></div>
            <div className="space-y-2">
              <Label htmlFor="password">Clave de autorización</Label>
              <Input id="password" name="password" type="password" required autoComplete="off" />
            </div>
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
