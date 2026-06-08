import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, Wheat } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/production")({
  component: ProductionPage,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  planned: "secondary",
  in_progress: "outline",
  completed: "default",
  cancelled: "destructive",
};
const statusLabel: Record<string, string> = {
  planned: "Planificado",
  in_progress: "En proceso",
  completed: "Completado",
  cancelled: "Cancelado",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

function ProductionPage() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const canManage = hasRole("admin") || hasRole("operations" as any);
  const [open, setOpen] = useState(false);

  const { data: batches, isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_batches" as any)
        .select("id, batch_number, planned_quantity, produced_quantity, status, scheduled_for, unit_cost, variable_input_cost, variable_labor_cost, fixed_cost_allocated, total_cost, created_at, products(id, name, sku, image_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
  const { data: products } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id, name").eq("active", true).order("name")).data ?? [],
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses-min"],
    queryFn: async () =>
      (await supabase.from("warehouses" as any).select("id, name").order("name")).data ?? [],
  });
  const { data: costItems } = useQuery({
    queryKey: ["cost_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_items" as any).select("*").eq("active", true)
        .order("category").order("sort_order");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-min"],
    queryFn: async () =>
      (await supabase.from("suppliers" as any).select("id, name, cost_item_id").eq("active", true).order("name")).data ?? [],
  });

  const inputs = useMemo(() => (costItems ?? []).filter((c) => c.category === "variable_input"), [costItems]);
  const labor  = useMemo(() => (costItems ?? []).filter((c) => c.category === "variable_labor"), [costItems]);
  const fixed  = useMemo(() => (costItems ?? []).filter((c) => c.category === "fixed"), [costItems]);

  async function computeFixedAllocation(producedQty: number, monthStart: Date) {
    if (!producedQty || producedQty <= 0) return { perUnit: 0, monthlyFixed: 0, monthlyUnits: 0 };
    const monthlyFixed = (fixed ?? []).reduce((s, c) => s + Number(c.unit_cost || 0), 0);
    const end = new Date(monthStart);
    end.setMonth(end.getMonth() + 1);
    const { data, error } = await supabase
      .from("production_batches" as any)
      .select("produced_quantity")
      .eq("status", "completed")
      .gte("completed_at", monthStart.toISOString())
      .lt("completed_at", end.toISOString());
    if (error) throw error;
    const otherUnits = (data ?? []).reduce((s: number, b: any) => s + Number(b.produced_quantity || 0), 0);
    const totalUnits = otherUnits + producedQty;
    return { perUnit: totalUnits ? monthlyFixed / totalUnits : 0, monthlyFixed, monthlyUnits: totalUnits };
  }


  function NewBatchForm() {
    const [productId, setProductId] = useState("");
    const [plannedQty, setPlannedQty] = useState<number>(1);
    const [scheduled, setScheduled] = useState("");
    const [notes, setNotes] = useState("");

    const create = useMutation({
      mutationFn: async () => {
        if (!productId) throw new Error("Selecciona producto");
        const { error } = await supabase.from("production_batches" as any).insert({
          product_id: productId,
          planned_quantity: plannedQty,
          scheduled_for: scheduled || null,
          responsible_id: user?.id ?? null,
          notes: notes || null,
        });
        if (error) throw error;
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["batches"] });
        toast.success("Lote planificado");
        setOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });

    return (
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Producto fabricado</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {(products ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cantidad planificada</Label>
            <Input type="number" min="1" className="h-8 text-sm" value={plannedQty} onChange={(e) => setPlannedQty(Number(e.target.value))} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Programado para</Label>
            <Input type="date" className="h-8 text-sm" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
          </div>
        </div>
        <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          Los insumos, mano de obra y costos se confirman al <b>completar el lote</b>. En ese momento se descuentan las materias primas y se generan las cuentas por pagar a los empleados.
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notas</Label>
          <Textarea className="min-h-[60px] text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter className="pt-1">
          <Button type="submit" disabled={create.isPending} className="bg-gradient-primary h-8 text-sm">Guardar</Button>
        </DialogFooter>
      </form>
    );
  }

  const completeBatch = useMutation({
    mutationFn: async ({
      batch, producedQty, warehouseId, inputQty, laborQty, laborSupplier,
    }: {
      batch: any; producedQty: number; warehouseId: string;
      inputQty: Record<string, number>; laborQty: Record<string, number>;
      laborSupplier: Record<string, string>;
    }) => {
      const inputCost = inputs.reduce((s, c) => s + (inputQty[c.id] || 0) * Number(c.unit_cost || 0), 0);
      const laborCost = labor.reduce((s, c) => s + (laborQty[c.id] || 0) * Number(c.unit_cost || 0), 0);

      const monthRef = new Date(batch.scheduled_for || batch.created_at || Date.now());
      const monthStart = new Date(monthRef.getFullYear(), monthRef.getMonth(), 1);
      const { perUnit } = await computeFixedAllocation(producedQty, monthStart);
      const fixedAllocated = perUnit * producedQty;
      const totalCost = inputCost + laborCost + fixedAllocated;
      const unitCost = producedQty > 0 ? totalCost / producedQty : 0;

      // Insert production_costs at completion → triggers deduct raw materials
      const costRows = [
        ...inputs.filter((c) => (inputQty[c.id] || 0) > 0).map((c) => ({
          batch_id: batch.id, cost_item_id: c.id,
          quantity: inputQty[c.id], unit_cost_snapshot: Number(c.unit_cost || 0),
        })),
        ...labor.filter((c) => (laborQty[c.id] || 0) > 0).map((c) => ({
          batch_id: batch.id, cost_item_id: c.id,
          quantity: laborQty[c.id], unit_cost_snapshot: Number(c.unit_cost || 0),
        })),
      ];
      if (costRows.length) {
        const { error: e0 } = await supabase.from("production_costs" as any).insert(costRows);
        if (e0) throw e0;
      }

      const { error: updErr } = await supabase
        .from("production_batches" as any)
        .update({
          status: "completed",
          produced_quantity: producedQty,
          completed_at: new Date().toISOString(),
          variable_input_cost: inputCost,
          variable_labor_cost: laborCost,
          fixed_cost_allocated: fixedAllocated,
          total_cost: totalCost,
          unit_cost: unitCost,
        })
        .eq("id", batch.id);
      if (updErr) throw updErr;

      const { error: mvErr } = await supabase.from("inventory_movements" as any).insert({
        product_id: batch.products?.id ?? batch.product_id,
        warehouse_id: warehouseId,
        type: "production",
        quantity: producedQty,
        unit_cost: unitCost,
        reference: `Lote #${batch.batch_number}`,
        recorded_by: user?.id ?? null,
      });
      if (mvErr) throw mvErr;

      // Generate cuentas por pagar for labor with assigned supplier
      for (const c of labor) {
        const qty = laborQty[c.id] || 0;
        const supId = laborSupplier[c.id];
        if (qty > 0 && supId) {
          const { data: bill, error: bErr } = await supabase.from("bills" as any).insert({
            supplier_id: supId,
            notes: `Mano de obra ${c.name} · Lote #${batch.batch_number}`,
            created_by: user?.id ?? null,
          }).select("id").single();
          if (bErr) throw bErr;
          const { error: biErr } = await supabase.from("bill_items" as any).insert({
            bill_id: (bill as any).id,
            description: `${c.name} - Lote #${batch.batch_number}`,
            quantity: qty,
            unit_price: Number(c.unit_cost || 0),
          });
          if (biErr) throw biErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      qc.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Lote completado: inventarios y cuentas por pagar actualizados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function CompleteDialog({ batch }: { batch: any }) {
    const [qty, setQty] = useState<number>(Number(batch.planned_quantity));
    const [wh, setWh] = useState<string>("");
    const [openD, setOpenD] = useState(false);
    const [inputQty, setInputQty] = useState<Record<string, number>>({});
    const [laborQty, setLaborQty] = useState<Record<string, number>>({});
    const [laborSupplier, setLaborSupplier] = useState<Record<string, string>>(() => {
      const init: Record<string, string> = {};
      (labor ?? []).forEach((c) => {
        const sup = (suppliers ?? []).find((s: any) => s.cost_item_id === c.id);
        if (sup) init[c.id] = sup.id;
      });
      return init;
    });

    const inputCost = inputs.reduce((s, c) => s + (inputQty[c.id] || 0) * Number(c.unit_cost || 0), 0);
    const laborCost = labor.reduce((s, c) => s + (laborQty[c.id] || 0) * Number(c.unit_cost || 0), 0);
    const variable = inputCost + laborCost;
    const variablePerUnit = qty > 0 ? variable / qty : 0;

    return (
      <Dialog open={openD} onOpenChange={setOpenD}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">Completar</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader className="pb-2">
            <DialogTitle>Completar lote #{batch.batch_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Cantidad producida</Label>
                <Input type="number" min="0" className="h-8 text-sm" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Almacén destino</Label>
                <Select value={wh} onValueChange={setWh}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona almacén" /></SelectTrigger>
                  <SelectContent>
                    {(warehouses ?? []).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border p-2">
              <h4 className="mb-1.5 text-sm font-medium">Insumos utilizados</h4>
              {inputs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay insumos. <Link to="/app/costs" className="underline">Ir a Costos</Link></p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {inputs.map((c) => (
                    <div key={c.id} className="space-y-0.5">
                      <Label className="text-[11px] leading-tight block truncate">{c.name} ({c.unit}) · {fmt(c.unit_cost)}/{c.unit}</Label>
                      <Input type="number" min="0" step="0.01" className="h-7 text-sm"
                        value={inputQty[c.id] ?? ""}
                        onChange={(e) => setInputQty({ ...inputQty, [c.id]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border p-2">
              <h4 className="mb-1.5 text-sm font-medium">Mano de obra</h4>
              {labor.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay mano de obra. <Link to="/app/costs" className="underline">Ir a Costos</Link></p>
              ) : (
                <div className="space-y-2">
                  {labor.map((c) => (
                    <div key={c.id} className="grid grid-cols-[1fr_80px_1fr] gap-2 items-end">
                      <Label className="text-[11px] leading-tight truncate">{c.name} · {fmt(c.unit_cost)}/{c.unit}</Label>
                      <Input type="number" min="0" step="1" className="h-7 text-sm"
                        placeholder="Cant."
                        value={laborQty[c.id] ?? ""}
                        onChange={(e) => setLaborQty({ ...laborQty, [c.id]: Number(e.target.value) })}
                      />
                      <Select value={laborSupplier[c.id] || "__none__"} onValueChange={(v) => setLaborSupplier({ ...laborSupplier, [c.id]: v === "__none__" ? "" : v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Empleado" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin cuenta por pagar</SelectItem>
                          {(suppliers ?? []).map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">Si seleccionas un proveedor/empleado, se generará una cuenta por pagar automáticamente.</p>
                </div>
              )}
            </div>

            <div className="rounded-md border bg-muted/30 p-2 text-xs">
              <div className="grid grid-cols-2 gap-y-0.5">
                <span>Costo insumos:</span><span className="text-right tabular-nums">{fmt(inputCost)}</span>
                <span>Costo mano de obra:</span><span className="text-right tabular-nums">{fmt(laborCost)}</span>
                <span>Variable total:</span><span className="text-right tabular-nums font-medium">{fmt(variable)}</span>
                <span>Variable / unidad:</span><span className="text-right tabular-nums">{fmt(variablePerUnit)}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Los costos fijos se prorratean al confirmar.</div>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={completeBatch.isPending}
              onClick={() => {
                if (!wh) return toast.error("Selecciona almacén");
                if (!qty || qty <= 0) return toast.error("Cantidad inválida");
                completeBatch.mutate(
                  { batch, producedQty: qty, warehouseId: wh, inputQty, laborQty, laborSupplier },
                  { onSuccess: () => setOpenD(false) }
                );
              }}
              className="bg-gradient-primary"
            >Confirmar producción</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }


  return (
    <>
      <PageHeader
        title="Producción"
        description="Planifica y registra lotes con costeo automático."
        actions={
          canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-elegant">
                  <Plus className="mr-1 h-4 w-4" /> Nuevo lote
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4">
                <DialogHeader className="pb-2">
                  <DialogTitle className="font-display">Nuevo lote de producción</DialogTitle>
                </DialogHeader>
                <NewBatchForm />
              </DialogContent>
            </Dialog>
          )
        }
      />
      <div className="p-6">
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Programado</TableHead>
                <TableHead className="text-right">Plan / Prod.</TableHead>
                <TableHead className="text-right">Costo unitario</TableHead>
                <TableHead className="text-right">Costo total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[140px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (batches ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  <Wheat className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  Aún no hay lotes.
                </TableCell></TableRow>
              ) : (
                (batches ?? []).map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">#{b.batch_number}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {b.products?.image_url ? (
                          <img src={b.products.image_url} alt={b.products.name} className="h-9 w-9 rounded object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded bg-muted" />
                        )}
                        <span>{b.products?.name ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{b.scheduled_for ? new Date(b.scheduled_for).toLocaleDateString("es-CO") : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.planned_quantity} / {b.produced_quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.status === "completed" ? fmt(Number(b.unit_cost)) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.status === "completed" ? fmt(Number(b.total_cost)) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[b.status] ?? "outline"}>{statusLabel[b.status] ?? b.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {canManage && b.status !== "completed" && b.status !== "cancelled" && (
                        <CompleteDialog batch={b} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
