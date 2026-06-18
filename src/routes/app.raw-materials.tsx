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
import { Plus, Pencil, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney } from "@/lib/export";

export const Route = createFileRoute("/app/raw-materials")({
  component: RawMaterialsPage,
});

type RawMaterial = {
  id: string; name: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
  active: boolean; notes: string | null;
};

function RawMaterialsPage() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "operations"]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [adjustFor, setAdjustFor] = useState<RawMaterial | null>(null);
  const [movFor, setMovFor] = useState<RawMaterial | null>(null);

  const { data: materials, isLoading } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials" as any)
        .select("*").order("name");
      if (error) throw error;
      return (data as any[]) as RawMaterial[];
    },
  });

  const { data: linkedCostItems } = useQuery({
    queryKey: ["cost-items-rm-link"],
    queryFn: async () => {
      const { data } = await supabase.from("cost_items" as any)
        .select("id, name, raw_material_id").eq("category", "variable_input");
      return (data as any[]) ?? [];
    },
  });

  const { data: movements } = useQuery({
    queryKey: ["rm-movements", movFor?.id],
    enabled: !!movFor,
    queryFn: async () => {
      const { data } = await supabase
        .from("raw_material_movements" as any)
        .select("*").eq("raw_material_id", movFor!.id)
        .order("created_at", { ascending: false }).limit(50);
      return (data as any[]) ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (input: Partial<RawMaterial> & { id?: string }) => {
      if (input.id) {
        const { error } = await supabase.from("raw_materials" as any)
          .update({ name: input.name, unit: input.unit, min_stock: input.min_stock,
                    unit_cost: input.unit_cost, active: input.active, notes: input.notes })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("raw_materials" as any).insert({
          name: input.name, unit: input.unit, min_stock: input.min_stock,
          unit_cost: input.unit_cost, notes: input.notes,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success("Guardado");
      setOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustStock = useMutation({
    mutationFn: async (input: { rm_id: string; type: string; quantity: number; reason: string }) => {
      const { error } = await supabase.from("raw_material_movements" as any).insert({
        raw_material_id: input.rm_id,
        type: input.type,
        quantity: input.quantity,
        reference: input.reason || "Ajuste manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      qc.invalidateQueries({ queryKey: ["rm-movements"] });
      toast.success("Movimiento registrado");
      setAdjustFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRm = useMutation({
    mutationFn: async (id: string): Promise<"deleted" | "deactivated"> => {
      const { error } = await supabase.from("raw_materials" as any).delete().eq("id", id);
      if (!error) return "deleted";
      if ((error as any).code === "23503" || /foreign key/i.test(error.message)) {
        const { error: upErr } = await supabase.from("raw_materials" as any).update({ active: false }).eq("id", id);
        if (upErr) throw upErr;
        return "deactivated";
      }
      throw error;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success(result === "deactivated"
        ? "Materia prima con historial: se desactivó en lugar de eliminarse."
        : "Materia prima eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(rm: RawMaterial) { setEditing(rm); setOpen(true); }

  const linkedCount = (rmId: string) =>
    (linkedCostItems ?? []).filter((c: any) => c.raw_material_id === rmId).length;

  return (
    <>
      <PageHeader
        title="Materias primas"
        description="Inventario de insumos. Las producciones descuentan stock y las compras lo suman."
        actions={canManage && (
          <Button onClick={openNew} className="bg-gradient-primary shadow-elegant">
            <Plus className="mr-1 h-4 w-4" /> Nueva materia prima
          </Button>
        )}
      />
      <div className="p-6">
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Materia prima</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Costo ref.</TableHead>
                <TableHead>Insumos vinc.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[200px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (materials ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Aún no hay materias primas. Crea la primera para empezar.
                </TableCell></TableRow>
              ) : (
                (materials ?? []).map((m) => {
                  const low = Number(m.current_stock) <= Number(m.min_stock);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell className={`text-right font-medium tabular-nums ${low ? "text-destructive" : ""}`}>
                        {low && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                        {Number(m.current_stock).toLocaleString("es-CO")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{Number(m.min_stock).toLocaleString("es-CO")}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(Number(m.unit_cost))}</TableCell>
                      <TableCell><Badge variant="outline">{linkedCount(m.id)}</Badge></TableCell>
                      <TableCell><Badge variant={m.active ? "default" : "secondary"}>{m.active ? "Activo" : "Inactivo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canManage && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setAdjustFor(m)}>Ajustar</Button>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => {
                                if (confirm(`¿Eliminar "${m.name}"? Esto removerá su histórico de movimientos.`)) deleteRm.mutate(m.id);
                              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setMovFor(m)}>Hist.</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Vincula cada insumo en la sección <a className="underline" href="/app/costs">Costos</a> a una materia prima para que las producciones descuenten stock automáticamente.
        </p>
      </div>

      {/* Create / edit */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar" : "Nueva"} materia prima</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            save.mutate({
              id: editing?.id,
              name: String(fd.get("name") || ""),
              unit: String(fd.get("unit") || "unit"),
              min_stock: Number(fd.get("min_stock") || 0),
              unit_cost: Number(fd.get("unit_cost") || 0),
              active: fd.get("active") === "on",
              notes: String(fd.get("notes") || ""),
            });
          }}>
            <div className="space-y-1"><Label>Nombre</Label><Input name="name" defaultValue={editing?.name ?? ""} required /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><Label className="text-xs">Unidad</Label><Input name="unit" defaultValue={editing?.unit ?? "kg"} required /></div>
              <div className="space-y-1"><Label className="text-xs">Mínimo</Label><Input name="min_stock" type="number" step="0.01" defaultValue={editing?.min_stock ?? 0} /></div>
              <div className="space-y-1"><Label className="text-xs">Costo ref.</Label><Input name="unit_cost" type="number" step="0.01" defaultValue={editing?.unit_cost ?? 0} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input id="rm_active" type="checkbox" name="active" defaultChecked={editing ? editing.active : true} className="h-4 w-4" />
              <Label htmlFor="rm_active" className="text-sm">Activo</Label>
            </div>
            <div className="space-y-1"><Label>Notas</Label><Input name="notes" defaultValue={editing?.notes ?? ""} /></div>
            {editing && (
              <p className="text-xs text-muted-foreground">El stock actual ({Number(editing.current_stock).toLocaleString("es-CO")}) solo cambia con movimientos (compras, producción, ajustes).</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={save.isPending} className="bg-gradient-primary">{save.isPending ? "Guardando…" : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust */}
      <Dialog open={!!adjustFor} onOpenChange={(o) => !o && setAdjustFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Ajustar stock · {adjustFor?.name}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            adjustStock.mutate({
              rm_id: adjustFor!.id,
              type: String(fd.get("type") || "in"),
              quantity: Number(fd.get("quantity") || 0),
              reason: String(fd.get("reason") || ""),
            });
          }}>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select name="type" defaultValue="in">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada (+)</SelectItem>
                  <SelectItem value="out">Salida (−)</SelectItem>
                  <SelectItem value="adjust">Ajuste (±)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Cantidad ({adjustFor?.unit})</Label><Input name="quantity" type="number" step="0.01" required /></div>
            <div className="space-y-1"><Label>Motivo</Label><Input name="reason" placeholder="ej. inventario físico" /></div>
            <DialogFooter>
              <Button type="submit" disabled={adjustStock.isPending} className="bg-gradient-primary">Registrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={!!movFor} onOpenChange={(o) => !o && setMovFor(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Movimientos · {movFor?.name}</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead>Referencia</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(movements ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Sin movimientos.</TableCell></TableRow>
              ) : (movements ?? []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{new Date(m.created_at).toLocaleString("es-CO")}</TableCell>
                  <TableCell>
                    {m.type === "in" ? (
                      <Badge className="gap-1"><ArrowUpCircle className="h-3 w-3" />Entrada</Badge>
                    ) : m.type === "out" ? (
                      <Badge variant="destructive" className="gap-1"><ArrowDownCircle className="h-3 w-3" />Salida</Badge>
                    ) : (
                      <Badge variant="secondary">Ajuste</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Number(m.quantity).toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(Number(m.unit_cost))}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.reference || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}
