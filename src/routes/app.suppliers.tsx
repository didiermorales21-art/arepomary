import { createFileRoute } from "@tanstack/react-router";
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
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { PHONE_INPUT_PROPS, isValidPhone, sanitizePhoneInput } from "@/lib/phone";

export const Route = createFileRoute("/app/suppliers")({
  component: SuppliersPage,
});

const NO_INPUT = "__none__";

function SuppliersPage() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "operations"]);
  const [open, setOpen] = useState(false);
  const [costItemId, setCostItemId] = useState<string>(NO_INPUT);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, tax_id, email, phone, address, active, cost_item_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inputs } = useQuery({
    queryKey: ["cost-items-inputs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cost_items" as any)
        .select("id, name, unit")
        .eq("category", "variable_input")
        .eq("active", true)
        .order("name");
      return (data as any[]) ?? [];
    },
  });
  const inputMap = new Map((inputs ?? []).map((i: any) => [i.id, i.name]));

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; tax_id: string; email: string; phone: string; address: string; notes: string; cost_item_id: string | null }) => {
      const { error } = await supabase.from("suppliers").insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Proveedor creado");
      setOpen(false);
      setCostItemId(NO_INPUT);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="Catálogo de proveedores asociados al insumo que entregan."
        actions={
          canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-elegant">
                  <Plus className="mr-1 h-4 w-4" /> Nuevo proveedor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Nuevo proveedor</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const phone = String(fd.get("phone") || "");
                    if (phone && !isValidPhone(phone)) {
                      toast.error("El teléfono debe tener 10 dígitos y comenzar con 3");
                      return;
                    }
                    createMutation.mutate({
                      name: String(fd.get("name") || ""),
                      tax_id: String(fd.get("tax_id") || ""),
                      email: String(fd.get("email") || ""),
                      phone,
                      address: String(fd.get("address") || ""),
                      notes: String(fd.get("notes") || ""),
                      cost_item_id: costItemId === NO_INPUT ? null : costItemId,
                    });
                  }}
                >
                  <div className="space-y-2"><Label htmlFor="name">Nombre</Label><Input id="name" name="name" required /></div>
                  <div className="space-y-2">
                    <Label>Insumo que provee</Label>
                    <Select value={costItemId} onValueChange={setCostItemId}>
                      <SelectTrigger><SelectValue placeholder="Selecciona un insumo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_INPUT}>Sin insumo específico</SelectItem>
                        {(inputs ?? []).map((i: any) => (
                          <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label htmlFor="tax_id">NIT</Label><Input id="tax_id" name="tax_id" /></div>
                    <div className="space-y-2"><Label htmlFor="phone">Teléfono</Label><Input id="phone" name="phone" {...PHONE_INPUT_PROPS} onInput={(e) => { e.currentTarget.value = sanitizePhoneInput(e.currentTarget.value); }} /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
                  <div className="space-y-2"><Label htmlFor="address">Dirección</Label><Input id="address" name="address" /></div>
                  <div className="space-y-2"><Label htmlFor="notes">Notas</Label><Textarea id="notes" name="notes" rows={3} /></div>
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-primary">
                      {createMutation.isPending ? "Guardando…" : "Guardar"}
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
                <TableHead>Nombre</TableHead>
                <TableHead>Insumo</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (suppliers ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Sin proveedores todavía.</TableCell></TableRow>
              ) : (
                (suppliers ?? []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.cost_item_id ? (inputMap.get(s.cost_item_id) ?? "—") : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{s.tax_id || "—"}</TableCell>
                    <TableCell>{s.email || "—"}</TableCell>
                    <TableCell>{s.phone || "—"}</TableCell>
                    <TableCell><Badge variant={s.active ? "default" : "secondary"}>{s.active ? "Activo" : "Inactivo"}</Badge></TableCell>
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
