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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/products")({
  component: ProductsPage,
});

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

interface ProductForm {
  sku: string;
  name: string;
  price: number;
  unit: string;
  description: string;
  active: boolean;
  image_url: string | null;
}

function ProductsPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: ProductForm & { id?: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("products")
          .update({
            sku: input.sku,
            name: input.name,
            price: input.price,
            unit: input.unit,
            description: input.description,
            active: input.active,
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({
          sku: input.sku,
          name: input.name,
          price: input.price,
          unit: input.unit,
          description: input.description,
          active: input.active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Producto actualizado" : "Producto creado");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo: crea, modifica o elimina productos."
        actions={
          isAdmin && (
            <Button onClick={openCreate} className="bg-gradient-primary shadow-elegant">
              <Plus className="mr-1 h-4 w-4" />
              Nuevo producto
            </Button>
          )
        }
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              saveMutation.mutate({
                id: editing?.id,
                sku: String(fd.get("sku") || ""),
                name: String(fd.get("name") || ""),
                price: Number(fd.get("price") || 0),
                unit: String(fd.get("unit") || "unidad"),
                description: String(fd.get("description") || ""),
                active: fd.get("active") === "on",
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" name="sku" required defaultValue={editing?.sku ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidad</Label>
                <Input id="unit" name="unit" required defaultValue={editing?.unit ?? "paquete"} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required defaultValue={editing?.name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Precio (COP)</Label>
              <Input id="price" name="price" type="number" min="0" step="100" required defaultValue={editing?.price ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" name="description" defaultValue={editing?.description ?? ""} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} />
              Activo (visible para clientes)
            </label>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-gradient-primary">
                {saveMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="p-6">
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
                {isAdmin && <TableHead className="w-[120px] text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : (products ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No hay productos.
                  </TableCell>
                </TableRow>
              ) : (
                (products ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(p.price))}</TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "activo" : "inactivo"}</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`¿Eliminar "${p.name}"?`)) deleteMutation.mutate(p.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
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
