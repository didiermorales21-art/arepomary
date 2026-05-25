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
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Warehouse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/warehouses")({
  component: WarehousesPage,
});

function WarehousesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [open, setOpen] = useState(false);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["warehouses-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses" as any).select("*").order("name");
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      const { error } = await supabase.from("warehouses" as any).insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses-full"] });
      qc.invalidateQueries({ queryKey: ["warehouses-min"] });
      toast.success("Almacén creado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Almacenes"
        description="Define los almacenes donde se gestiona inventario."
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-elegant">
                  <Plus className="mr-1 h-4 w-4" /> Nuevo almacén
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Nuevo almacén</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createMutation.mutate({
                      name: String(fd.get("name") || ""),
                      location: String(fd.get("location") || ""),
                      description: String(fd.get("description") || ""),
                    });
                  }}
                >
                  <div className="space-y-2"><Label>Nombre</Label><Input name="name" required /></div>
                  <div className="space-y-2"><Label>Ubicación</Label><Input name="location" /></div>
                  <div className="space-y-2"><Label>Descripción</Label><Input name="description" /></div>
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-primary">Guardar</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (warehouses ?? []).length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
            <Warehouse className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Crea tu primer almacén para empezar a registrar inventario.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(warehouses ?? []).map((w: any) => (
              <Card key={w.id} className="shadow-card">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                      <Warehouse className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold">{w.name}</h3>
                      {w.location && <p className="text-xs text-muted-foreground">{w.location}</p>}
                      {w.description && <p className="mt-1 text-sm text-muted-foreground">{w.description}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
