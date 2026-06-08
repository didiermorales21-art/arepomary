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
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/costs")({
  component: CostsPage,
});

function CostsPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");
  const [open, setOpen] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["cost_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_items" as any)
        .select("*")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: rawMaterials } = useQuery({
    queryKey: ["raw-materials-min"],
    queryFn: async () => {
      const { data } = await supabase.from("raw_materials" as any)
        .select("id, name, unit").eq("active", true).order("name");
      return (data as any[]) ?? [];
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("cost_items" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost_items"] });
      qc.invalidateQueries({ queryKey: ["cost-items-inputs"] });
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createItem = useMutation({
    mutationFn: async (input: any) => {
      const key = (input.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const { error } = await supabase.from("cost_items" as any).insert({
        key: `${key}_${Date.now().toString(36)}`,
        name: input.name,
        category: input.category,
        unit: input.unit || (input.category === "fixed" ? "mes" : "unit"),
        unit_cost: Number(input.unit_cost) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost_items"] });
      qc.invalidateQueries({ queryKey: ["cost-items-inputs"] });
      toast.success("Costo creado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost_items"] });
      toast.success("Eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function Row({ it }: { it: any }) {
    const [name, setName] = useState<string>(it.name);
    const [unit, setUnit] = useState<string>(it.unit);
    const [val, setVal] = useState<string>(String(it.unit_cost));
    const [rmId, setRmId] = useState<string>(it.raw_material_id ?? "");
    const editableMeta = canManage && it.category === "variable_input";
    const showRm = it.category === "variable_input";
    const dirty =
      Number(val) !== Number(it.unit_cost) ||
      (editableMeta && (name !== it.name || unit !== it.unit)) ||
      (showRm && (rmId || "") !== (it.raw_material_id ?? ""));
    const save = () => {
      const patch: Record<string, unknown> = { unit_cost: Number(val) };
      if (editableMeta) {
        if (!name.trim()) return toast.error("El nombre no puede estar vacío");
        patch.name = name.trim();
        patch.unit = unit.trim() || "unit";
      }
      if (showRm) patch.raw_material_id = rmId || null;
      updateItem.mutate({ id: it.id, patch });
    };
    return (
      <TableRow>
        <TableCell className="font-medium">
          {editableMeta ? (
            <Input className="h-8" value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <>{it.name} {it.is_system && <Badge variant="outline" className="ml-1">sistema</Badge>}</>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {editableMeta ? (
            <Input className="h-8 w-24" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g, kg…" />
          ) : (
            it.unit
          )}
        </TableCell>
        <TableCell className="text-right">
          <Input
            className="ml-auto h-8 w-28 text-right tabular-nums"
            type="number" min="0" step="0.01"
            value={val} onChange={(e) => setVal(e.target.value)}
            disabled={!canManage}
          />
        </TableCell>
        {showRm && (
          <TableCell>
            <Select value={rmId || "__none__"} onValueChange={(v) => setRmId(v === "__none__" ? "" : v)} disabled={!canManage}>
              <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Sin vínculo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin vínculo</SelectItem>
                {(rawMaterials ?? []).map((rm: any) => (
                  <SelectItem key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
        )}
        <TableCell className="w-[160px]">
          <div className="flex justify-end gap-2">
            {canManage && dirty && <Button size="sm" onClick={save}>Guardar</Button>}
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => {
                if (confirm(`¿Eliminar "${it.name}"? Esta acción no se puede deshacer.`)) deleteItem.mutate(it.id);
              }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>

      </TableRow>
    );
  }

  const groups: { key: string; title: string; help?: string }[] = [
    { key: "variable_input", title: "Insumos variables", help: "Edita nombre, unidad y costo unitario. Se usan al registrar lotes de producción." },
    { key: "variable_labor", title: "Mano de obra variable", help: "Costo por persona en cada lote de producción." },
    { key: "fixed", title: "Costos fijos (mensuales)", help: "Se prorratean entre las unidades producidas en el mes del lote." },
  ];

  return (
    <>
      <PageHeader
        title="Costos"
        description="Parametriza insumos, mano de obra y costos fijos para calcular el costo unitario de producción."
        actions={
          canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-elegant">
                  <Plus className="mr-1 h-4 w-4" /> Nuevo costo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Nuevo costo</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createItem.mutate(Object.fromEntries(fd.entries()));
                  }}
                >
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select name="category" defaultValue="variable_input">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="variable_input">Insumo variable</SelectItem>
                        <SelectItem value="variable_labor">Mano de obra variable</SelectItem>
                        <SelectItem value="fixed">Costo fijo (mensual)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Unidad</Label>
                      <Input name="unit" placeholder="g, kg, persona, mes…" />
                    </div>
                    <div className="space-y-2">
                      <Label>Costo</Label>
                      <Input name="unit_cost" type="number" min="0" step="0.01" defaultValue={0} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createItem.isPending} className="bg-gradient-primary">Crear</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <div className="space-y-6 p-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : (
          groups.map((g) => {
            const list = (items ?? []).filter((i) => i.category === g.key);
            const showRm = g.key === "variable_input";
            return (
              <div key={g.key} className="rounded-xl border bg-card shadow-card">
                <div className="border-b p-4">
                  <h3 className="font-display text-lg">{g.title}</h3>
                  {g.help && <p className="text-xs text-muted-foreground">{g.help}</p>}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      {showRm && <TableHead>Materia prima vinculada</TableHead>}
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.length === 0 ? (
                      <TableRow><TableCell colSpan={showRm ? 5 : 4} className="py-6 text-center text-sm text-muted-foreground">Sin elementos</TableCell></TableRow>
                    ) : list.map((it) => <Row key={it.id} it={it} />)}
                  </TableBody>
                </Table>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
