import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users2, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/collaborators")({
  component: CollaboratorsPage,
});

type Collab = {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  document_id: string | null;
  phone: string | null;
  email: string | null;
  cost_item_id: string | null;
  active: boolean;
  notes: string | null;
};

function CollaboratorsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Collab | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["collaborators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collaborators" as any)
        .select("*")
        .order("first_name");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: laborItems } = useQuery({
    queryKey: ["labor-cost-items"],
    queryFn: async () => {
      const { data } = await supabase.from("cost_items" as any)
        .select("id, name").eq("category", "variable_labor").eq("active", true).order("name");
      return (data as any[]) ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (input: Partial<Collab> & { id?: string }) => {
      const payload = {
        first_name: input.first_name,
        last_name: input.last_name || null,
        document_id: input.document_id || null,
        phone: input.phone || null,
        email: input.email || null,
        cost_item_id: input.cost_item_id || null,
        active: input.active ?? true,
        notes: input.notes || null,
      };
      if (input.id) {
        const { error } = await supabase.from("collaborators" as any).update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("collaborators" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collaborators"] });
      toast.success("Colaborador guardado");
      setOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collaborators" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["collaborators"] }); toast.success("Eliminado"); },
    onError: (e: Error) => toast.error(e.message.includes("violates foreign key") ? "Tiene cuentas por pagar asociadas; no se puede eliminar." : e.message),
  });

  const laborName = (id: string | null) => (laborItems ?? []).find((c: any) => c.id === id)?.name;

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Personas que ejecutan actividades de mano de obra (no son proveedores ni vendedores)."
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary"><Plus className="mr-1 h-4 w-4" />Nuevo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Nuevo"} colaborador</DialogTitle></DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  save.mutate({
                    id: editing?.id,
                    first_name: String(fd.get("first_name") || ""),
                    last_name: String(fd.get("last_name") || ""),
                    document_id: String(fd.get("document_id") || ""),
                    phone: String(fd.get("phone") || ""),
                    email: String(fd.get("email") || ""),
                    cost_item_id: String(fd.get("cost_item_id") || "") || null,
                    active: true,
                    notes: String(fd.get("notes") || ""),
                  });
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Nombres</Label><Input name="first_name" defaultValue={editing?.first_name ?? ""} required /></div>
                  <div className="space-y-1"><Label>Apellidos</Label><Input name="last_name" defaultValue={editing?.last_name ?? ""} /></div>
                  <div className="space-y-1"><Label>Documento</Label><Input name="document_id" defaultValue={editing?.document_id ?? ""} /></div>
                  <div className="space-y-1"><Label>Teléfono</Label><Input name="phone" defaultValue={editing?.phone ?? ""} /></div>
                  <div className="space-y-1 col-span-2"><Label>Email</Label><Input name="email" type="email" defaultValue={editing?.email ?? ""} /></div>
                  <div className="space-y-1 col-span-2">
                    <Label>Actividad de mano de obra</Label>
                    <Select name="cost_item_id" defaultValue={editing?.cost_item_id ?? ""}>
                      <SelectTrigger><SelectValue placeholder="Selecciona actividad" /></SelectTrigger>
                      <SelectContent>
                        {(laborItems ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2"><Label>Notas</Label><Input name="notes" defaultValue={editing?.notes ?? ""} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={save.isPending} className="bg-gradient-primary">Guardar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-6">
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(items ?? []).map((c: Collab) => (
              <Card key={c.id} className="shadow-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground"><Users2 className="h-5 w-5" /></div>
                      <div>
                        <h3 className="font-display text-base font-semibold leading-tight">{c.full_name}</h3>
                        {c.cost_item_id && <Badge variant="secondary" className="mt-1 text-[10px]">{laborName(c.cost_item_id)}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`¿Eliminar a ${c.full_name}?`)) del.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {c.document_id && <p>Doc: {c.document_id}</p>}
                    {c.phone && <p>{c.phone}</p>}
                    {c.email && <p className="truncate">{c.email}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(items ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin colaboradores registrados.</p>}
          </div>
        )}
      </div>
    </>
  );
}
