import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/movements")({
  component: MovementsPage,
});

const typeLabel: Record<string, string> = {
  in: "Entrada",
  out: "Salida",
  adjust: "Ajuste",
  production: "Producción",
  sale: "Venta",
  transfer: "Traslado",
};
const typeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  in: "default",
  production: "default",
  out: "destructive",
  sale: "destructive",
  transfer: "outline",
  adjust: "secondary",
};

function MovementsPage() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const canManage = hasRole("admin") || hasRole("operations" as any);
  const [open, setOpen] = useState(false);

  const { data: movements, isLoading } = useQuery({
    queryKey: ["movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements" as any)
        .select("id, type, quantity, unit_cost, reference, created_at, products(name, sku), warehouses(name)")
        .order("created_at", { ascending: false })
        .limit(200);
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
    queryFn: async () => (await supabase.from("warehouses" as any).select("id, name").order("name")).data ?? [],
  });

  const createMv = useMutation({
    mutationFn: async (input: any) => {
      const { error } = await supabase.from("inventory_movements" as any).insert({
        product_id: input.product_id,
        warehouse_id: input.warehouse_id,
        type: input.type,
        quantity: Math.abs(Number(input.quantity)),
        unit_cost: Number(input.unit_cost || 0),
        reference: input.reference || null,
        recorded_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Movimiento registrado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Movimientos de inventario"
        description="Kardex de entradas, salidas, ajustes y producción."
        actions={
          canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-elegant">
                  <Plus className="mr-1 h-4 w-4" /> Nuevo movimiento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Nuevo movimiento</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createMv.mutate(Object.fromEntries(fd.entries()));
                  }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select name="type" defaultValue="in" required>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(typeLabel).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Almacén</Label>
                      <Select name="warehouse_id" required>
                        <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                        <SelectContent>
                          {(warehouses ?? []).map((w: any) => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Producto</Label>
                    <Select name="product_id" required>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {(products ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Cantidad</Label>
                      <Input name="quantity" type="number" min="1" required defaultValue={1} />
                    </div>
                    <div className="space-y-2">
                      <Label>Costo unitario</Label>
                      <Input name="unit_cost" type="number" min="0" defaultValue={0} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Referencia</Label>
                    <Input name="reference" placeholder="Factura, lote, traslado…" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createMv.isPending} className="bg-gradient-primary">
                      Registrar
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
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>Referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (movements ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <ArrowLeftRight className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  Sin movimientos registrados.
                </TableCell></TableRow>
              ) : (
                (movements ?? []).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.created_at).toLocaleString("es-CO")}</TableCell>
                    <TableCell>
                      <Badge variant={typeVariant[m.type] ?? "outline"}>{typeLabel[m.type] ?? m.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{m.products?.name ?? "—"}</TableCell>
                    <TableCell>{m.warehouses?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(m.quantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(m.unit_cost)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.reference ?? "—"}</TableCell>
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
