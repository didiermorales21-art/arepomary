import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Users, Plus, Trash2, KeyRound, Mail } from "lucide-react";
import { listAuthUsers, updateUserPassword, updateUserEmail } from "@/lib/admin-users.functions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administradores",
  seller: "Vendedores",
  operations: "Operaciones",
  production_operator: "Producción",
  logistics_operator: "Logística",
  customer: "Clientes",
};

export const Route = createFileRoute("/app/users")({
  component: UsersPage,
});

const ALL_ROLES: AppRole[] = ["admin", "seller", "operations", "production_operator", "logistics_operator", "customer"];

function UsersPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { data, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id),
      }));
    },
    enabled: isAdmin,
  });

  const addRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id, role });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Rol asignado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Rol removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Usuarios" description="Gestión de usuarios y roles." />
        <div className="p-6">
          <p className="text-sm text-muted-foreground">No tienes permisos para acceder a este módulo.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Usuarios y roles" description="Administra los miembros del equipo y sus permisos." />
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          (() => {
            const users = data ?? [];
            const renderUser = (u: typeof users[number]) => (
              <Card key={u.id} className="shadow-card">
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold">{u.full_name || "(sin nombre)"}</h3>
                      <p className="text-xs text-muted-foreground">
                        ID: {u.id.slice(0, 8)}… {u.phone && `· ${u.phone}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {u.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">sin rol</span>
                    ) : (
                      u.roles.map((r) => (
                        <Badge key={r.id} variant="secondary" className="gap-1">
                          {ROLE_LABELS[r.role as AppRole] ?? r.role}
                          <button
                            onClick={() => removeRole.mutate(r.id)}
                            className="ml-1 rounded-full hover:bg-destructive/20"
                            title="Quitar rol"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                    <AddRoleDialog
                      userId={u.id}
                      existing={u.roles.map((r) => r.role as AppRole)}
                      onAdd={(role) => addRole.mutate({ user_id: u.id, role })}
                    />
                  </div>
                </CardContent>
              </Card>
            );

            const noRole = users.filter((u) => u.roles.length === 0);

            return (
              <Tabs defaultValue="all">
                <TabsList className="flex flex-wrap h-auto">
                  <TabsTrigger value="all">Todos ({users.length})</TabsTrigger>
                  {ALL_ROLES.map((role) => {
                    const count = users.filter((u) => u.roles.some((r) => r.role === role)).length;
                    return (
                      <TabsTrigger key={role} value={role}>
                        {ROLE_LABELS[role]} ({count})
                      </TabsTrigger>
                    );
                  })}
                  <TabsTrigger value="none">Sin rol ({noRole.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-4">
                  <div className="grid gap-4">{users.map(renderUser)}</div>
                </TabsContent>
                {ALL_ROLES.map((role) => {
                  const filtered = users.filter((u) => u.roles.some((r) => r.role === role));
                  return (
                    <TabsContent key={role} value={role} className="mt-4">
                      {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay usuarios con este rol.</p>
                      ) : (
                        <div className="grid gap-4">{filtered.map(renderUser)}</div>
                      )}
                    </TabsContent>
                  );
                })}
                <TabsContent value="none" className="mt-4">
                  {noRole.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todos los usuarios tienen al menos un rol.</p>
                  ) : (
                    <div className="grid gap-4">{noRole.map(renderUser)}</div>
                  )}
                </TabsContent>
              </Tabs>
            );
          })()
        )}
      </div>
    </>
  );
}

function AddRoleDialog({
  userId,
  existing,
  onAdd,
}: {
  userId: string;
  existing: AppRole[];
  onAdd: (role: AppRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AppRole | "">("");
  const available = ALL_ROLES.filter((r) => !existing.includes(r));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={available.length === 0}>
          <Plus className="mr-1 h-3 w-3" /> Rol
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Asignar rol</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Usuario</Label>
            <Input value={userId} disabled />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {available.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!role}
            onClick={() => {
              if (role) {
                onAdd(role);
                setOpen(false);
                setRole("");
              }
            }}
            className="bg-gradient-primary"
          >
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
