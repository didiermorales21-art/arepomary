import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Wheat } from "lucide-react";
import { useState } from "react";
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
        .select("id, batch_number, planned_quantity, produced_quantity, status, scheduled_for, unit_cost, created_at, products(id, name, sku, image_url)")
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

  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      const { error } = await supabase.from("production_batches" as any).insert({
        product_id: input.product_id,
        planned_quantity: Number(input.planned_quantity),
        scheduled_for: input.scheduled_for || null,
        unit_cost: Number(input.unit_cost || 0),
        responsible_id: user?.id ?? null,
        notes: input.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      toast.success("Lote creado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeBatch = useMutation({
    mutationFn: async ({
      batch,
      producedQty,
      warehouseId,
    }: {
      batch: any;
      producedQty: number;
      warehouseId: string;
    }) => {
      const { error: updErr } = await supabase
        .from("production_batches" as any)
        .update({
          status: "completed",
          produced_quantity: producedQty,
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch.id);
      if (updErr) throw updErr;
      const { error: mvErr } = await supabase.from("inventory_movements" as any).insert({
        product_id: batch.products?.id ?? batch.product_id,
        warehouse_id: warehouseId,
        type: "production",
        quantity: producedQty,
        unit_cost: Number(batch.unit_cost) || 0,
        reference: `Lote #${batch.batch_number}`,
        recorded_by: user?.id ?? null,
      });
      if (mvErr) throw mvErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      toast.success("Lote completado e inventario actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function CompleteDialog({ batch }: { batch: any }) {
    const [qty, setQty] = useState<number>(Number(batch.planned_quantity));
    const [wh, setWh] = useState<string>("");
    const [openD, setOpenD] = useState(false);
    return (
      <Dialog open={openD} onOpenChange={setOpenD}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">Completar</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar lote #{batch.batch_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Cantidad producida</Label>
              <Input type="number" min="0" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Almacén destino</Label>
              <Select value={wh} onValueChange={setWh}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona almacén" />
                </SelectTrigger>
                <SelectContent>
                  {(warehouses ?? []).map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!wh) return toast.error("Selecciona almacén");
                completeBatch.mutate(
                  { batch, producedQty: qty, warehouseId: wh },
                  { onSuccess: () => setOpenD(false) },
                );
              }}
              className="bg-gradient-primary"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <PageHeader
        title="Producción"
        description="Planifica y registra lotes de producción."
        actions={
          canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-elegant">
                  <Plus className="mr-1 h-4 w-4" /> Nuevo lote
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Nuevo lote</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createMutation.mutate(Object.fromEntries(fd.entries()));
                  }}
                >
                  <div className="space-y-2">
                    <Label>Producto</Label>
                    <Select name="product_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {(products ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Cantidad planificada</Label>
                      <Input name="planned_quantity" type="number" min="1" required defaultValue={1} />
                    </div>
                    <div className="space-y-2">
                      <Label>Costo unitario</Label>
                      <Input name="unit_cost" type="number" min="0" defaultValue={0} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Programado para</Label>
                    <Input name="scheduled_for" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea name="notes" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-primary">
                      Guardar
                    </Button>
                  </DialogFooter>
                </form>
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
                <TableHead>Estado</TableHead>
                <TableHead className="w-[140px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (batches ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  <Wheat className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  Aún no hay lotes.
                </TableCell></TableRow>
              ) : (
                (batches ?? []).map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">#{b.batch_number}</TableCell>
                    <TableCell className="font-medium">{b.products?.name ?? "—"}</TableCell>
                    <TableCell>{b.scheduled_for ? new Date(b.scheduled_for).toLocaleDateString("es-CO") : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.planned_quantity} / {b.produced_quantity}</TableCell>
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
