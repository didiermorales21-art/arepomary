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
  wholesale_price: number;
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
      const payload = {
        sku: input.sku,
        name: input.name,
        price: input.price,
        wholesale_price: input.wholesale_price,
        unit: input.unit,
        description: input.description,
        active: input.active,
        image_url: input.image_url,
      };

      if (input.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
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
          <ProductFormFields
            key={editing?.id ?? "new"}
            editing={editing}
            isPending={saveMutation.isPending}
            onSubmit={(v) => saveMutation.mutate({ id: editing?.id, ...v })}
          />
        </DialogContent>
      </Dialog>

      <div className="p-6">
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Foto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Precio estándar</TableHead>
                <TableHead className="text-right">Precio mayorista</TableHead>
                <TableHead>Estado</TableHead>
                {isAdmin && <TableHead className="w-[120px] text-right">Acciones</TableHead>}

              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : (products ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No hay productos.
                  </TableCell>
                </TableRow>

              ) : (
                (products ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted" />
                      )}
                    </TableCell>
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

function ProductFormFields({ editing, isPending, onSubmit }: { editing: any; isPending: boolean; onSubmit: (v: ProductForm) => void }) {
  const [sku, setSku] = useState(editing?.sku ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [price, setPrice] = useState<string>(editing?.price ? String(editing.price) : "");
  const [unit, setUnit] = useState(editing?.unit ?? "paquete");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [active, setActive] = useState<boolean>(editing ? !!editing.active : true);
  const [imageUrl, setImageUrl] = useState<string | null>(editing?.image_url ?? null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Foto subida");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ sku, name, price: Number(price || 0), unit, description, active, image_url: imageUrl });
      }}
    >
      <div className="flex items-center gap-4">
        {imageUrl ? (
          <img src={imageUrl} alt="Producto" className="h-20 w-20 rounded-md object-cover border" />
        ) : (
          <div className="h-20 w-20 rounded-md bg-muted border" />
        )}
        <div className="flex-1 space-y-2">
          <Label htmlFor="image">Foto del producto</Label>
          <Input id="image" type="file" accept="image/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {imageUrl && (
            <button type="button" className="text-xs text-destructive underline" onClick={() => setImageUrl(null)}>
              Quitar foto
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" required value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unidad</Label>
          <Input id="unit" required value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="price">Precio (COP)</Label>
        <Input id="price" type="number" min="0" step="100" required value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Activo (visible para clientes)
      </label>
      <DialogFooter>
        <Button type="submit" disabled={isPending || uploading} className="bg-gradient-primary">
          {isPending ? "Guardando…" : uploading ? "Subiendo foto…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
