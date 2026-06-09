import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserSquare2, Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/sellers")({
  component: SellersPage,
});

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

interface Seller {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  sales_count: number;
  is_company: boolean;
}


function SellersPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Seller | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pickUserId, setPickUserId] = useState<string>("");

  const { data: sellers, isLoading } = useQuery({
    queryKey: ["sellers-list"],
    queryFn: async (): Promise<Seller[]> => {
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "seller");
      if (rErr) throw rErr;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const [{ data: profiles }, { data: sales }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, first_name, last_name, phone").in("id", ids),
        supabase.from("sales").select("seller_id").in("seller_id", ids),
      ]);
      const counts = new Map<string, number>();
      (sales ?? []).forEach((s) => counts.set(s.seller_id, (counts.get(s.seller_id) ?? 0) + 1));
      return (profiles ?? [])
        .map((p) => ({
          id: p.id,
          full_name: p.full_name || "(sin nombre)",
          first_name: (p as any).first_name || "",
          last_name: (p as any).last_name || "",
          phone: p.phone,
          sales_count: counts.get(p.id) ?? 0,
          is_company: p.id === COMPANY_ID,
        }))
        .sort((a, b) => (a.is_company ? -1 : b.is_company ? 1 : a.full_name.localeCompare(b.full_name)));
    },

    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: { id?: string; first_name: string; last_name: string; phone: string }) => {
      if (input.id) {
        const full = `${input.first_name} ${input.last_name}`.trim();
        const { error } = await supabase
          .from("profiles")
          .update({ first_name: input.first_name, last_name: input.last_name, full_name: full, phone: input.phone || null })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        throw new Error("Para crear un vendedor con acceso al sistema, crea el usuario desde Usuarios y asígnale el rol de vendedor.");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sellers-list"] });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Vendedor actualizado");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const { data: candidates } = useQuery({
    queryKey: ["seller-candidates"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone").order("full_name"),
        supabase.from("user_roles").select("user_id").eq("role", "seller"),
      ]);
      const sellerIds = new Set((roles ?? []).map((r) => r.user_id));
      return (profiles ?? []).filter((p) => !sellerIds.has(p.id) && p.id !== COMPANY_ID);
    },
    enabled: isAdmin && addOpen,
  });

  const assignSeller = useMutation({
    mutationFn: async (user_id: string) => {
      const { error } = await supabase.from("user_roles").insert({ user_id, role: "seller" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sellers-list"] });
      qc.invalidateQueries({ queryKey: ["seller-candidates"] });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Vendedor agregado");
      setAddOpen(false);
      setPickUserId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id === COMPANY_ID) throw new Error("No se puede eliminar el vendedor 'Empresa'");
      await supabase.from("customers").update({ seller_id: COMPANY_ID }).eq("seller_id", id);
      await supabase.from("orders").update({ seller_id: COMPANY_ID }).eq("seller_id", id);
      const { error } = await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "seller");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sellers-list"] });
      qc.invalidateQueries({ queryKey: ["seller-candidates"] });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Vendedor eliminado. Sus clientes pasaron a 'Empresa'.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: commissions } = useQuery({
    queryKey: ["seller-commissions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("seller_commission_summary", { _from: null, _to: null });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Vendedores" description="Gestión de la fuerza de ventas." />
        <div className="p-6 text-sm text-muted-foreground">No tienes permisos para acceder a este módulo.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Vendedores"
        description="Equipo comercial. Todo cliente debe estar asociado a un vendedor."
      />
      <div className="p-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setAddOpen(true)} className="bg-gradient-primary">
            <UserPlus className="mr-2 h-4 w-4" /> Agregar vendedor
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(sellers ?? []).map((s) => (
              <Card key={s.id} className="shadow-card">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                        <UserSquare2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display text-base font-semibold leading-tight">{s.full_name}</h3>
                        {s.is_company && (
                          <Badge variant="secondary" className="mt-1 text-[10px]">Vendedor por defecto</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(s);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!s.is_company && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${s.full_name}? Sus clientes pasarán a 'Empresa'.`)) {
                              deleteMutation.mutate(s.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{s.phone || "Sin teléfono"}</p>
                    <p className="text-foreground">
                      <span className="font-semibold">{s.sales_count}</span> venta{s.sales_count === 1 ? "" : "s"} registrada{s.sales_count === 1 ? "" : "s"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          <Plus className="mr-1 inline h-3 w-3" />
          Para crear un usuario nuevo con acceso al sistema, primero créalo en{" "}
          <a className="underline" href="/app/users">Usuarios</a>; luego podrás asignarle el rol <Badge variant="secondary" className="text-[10px]">vendedor</Badge> desde aquí o desde Usuarios.
        </p>
        <div className="mt-8 rounded-xl border bg-card shadow-card">
          <div className="border-b p-4">
            <h3 className="font-display text-lg">Comisiones por pagar</h3>
            <p className="text-xs text-muted-foreground">Calculado por paquete vendido en facturas pagadas (excluye comisiones ya pagadas).</p>
          </div>
          <div className="p-4">
            {(commissions ?? []).filter((c: any) => Number(c.commission) > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay comisiones pendientes.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-2">Vendedor</th><th className="text-right">Paquetes</th><th className="text-right">Comisión</th><th></th></tr>
                </thead>
                <tbody>
                  {(commissions ?? []).filter((c: any) => Number(c.commission) > 0).map((c: any) => (
                    <tr key={c.seller_id} className="border-t">
                      <td className="py-2">{c.seller_name}</td>
                      <td className="text-right tabular-nums">{Number(c.packages).toLocaleString("es-CO")}</td>
                      <td className="text-right tabular-nums font-medium">
                        {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(c.commission))}
                      </td>
                      <td className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setPayCommission({ seller_id: c.seller_id, seller_name: c.seller_name, amount: Number(c.commission) })}>Pagar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setPickUserId(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Agregar vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Select value={pickUserId} onValueChange={setPickUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {(candidates ?? []).length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      No hay usuarios disponibles. Crea uno desde Usuarios.
                    </div>
                  ) : (
                    (candidates ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name || "(sin nombre)"} {c.phone ? `· ${c.phone}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!pickUserId || assignSeller.isPending}
              onClick={() => assignSeller.mutate(pickUserId)}
              className="bg-gradient-primary"
            >
              Asignar como vendedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Editar vendedor</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              saveMutation.mutate({
                id: editing?.id,
                first_name: String(fd.get("first_name") || ""),
                last_name: String(fd.get("last_name") || ""),
                phone: String(fd.get("phone") || ""),
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombres</Label>
                <Input id="first_name" name="first_name" defaultValue={editing?.first_name ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellidos</Label>
                <Input id="last_name" name="last_name" defaultValue={editing?.last_name ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} inputMode="numeric" />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-gradient-primary">
                {saveMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
