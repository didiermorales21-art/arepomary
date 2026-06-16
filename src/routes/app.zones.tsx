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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/zones")({
  component: ZonesPage,
});

function ZonesPage() {
  const qc = useQueryClient();
  const { hasRole, hasAnyRole } = useAuth();
  const isAdmin = hasRole("admin");
  // Logística puede crear y modificar zonas/barrios pero NO eliminar.
  const canEdit = hasAnyRole(["admin", "logistics_operator"]);
  const canDelete = isAdmin;
  const [zoneOpen, setZoneOpen] = useState(false);
  const [hoodOpen, setHoodOpen] = useState(false);
  const [editZone, setEditZone] = useState<any | null>(null);
  const [editHood, setEditHood] = useState<any | null>(null);
  const [editHoodZoneId, setEditHoodZoneId] = useState<string>("");
  const [editHoodActive, setEditHoodActive] = useState<string>("true");

  const { data: zones, isLoading } = useQuery({
    queryKey: ["zones-full"],
    queryFn: async () =>
      (await supabase.from("zones").select("*").order("priority", { ascending: false }).order("name")).data ?? [],
  });

  const { data: neighborhoods } = useQuery({
    queryKey: ["neighborhoods-full"],
    queryFn: async () =>
      (await supabase.from("neighborhoods").select("id, name, active, zone_id, zones(name)").order("name")).data ?? [],
  });

  const createZone = useMutation({
    mutationFn: async (input: { name: string; description: string; priority: number }) => {
      const { error } = await supabase.from("zones").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones-full"] });
      qc.invalidateQueries({ queryKey: ["zones"] });
      toast.success("Zona creada");
      setZoneOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateZone = useMutation({
    mutationFn: async (input: { id: string; name: string; description: string; priority: number }) => {
      const { error } = await supabase.from("zones").update({ name: input.name, description: input.description, priority: input.priority } as any).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones-full"] });
      qc.invalidateQueries({ queryKey: ["zones"] });
      toast.success("Zona actualizada");
      setEditZone(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones-full"] });
      qc.invalidateQueries({ queryKey: ["neighborhoods-full"] });
      toast.success("Zona eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createHood = useMutation({
    mutationFn: async (input: { name: string; zone_id: string }) => {
      if (!input.zone_id) throw new Error("Selecciona una zona");
      const { error } = await supabase.from("neighborhoods").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neighborhoods-full"] });
      qc.invalidateQueries({ queryKey: ["neighborhoods"] });
      toast.success("Barrio creado");
      setHoodOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateHood = useMutation({
    mutationFn: async (input: { id: string; name: string; zone_id: string; active: boolean }) => {
      if (!input.zone_id) throw new Error("Selecciona una zona");
      const { error } = await supabase.from("neighborhoods").update({
        name: input.name, zone_id: input.zone_id, active: input.active,
      }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neighborhoods-full"] });
      qc.invalidateQueries({ queryKey: ["neighborhoods"] });
      toast.success("Barrio actualizado");
      setEditHood(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteHood = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("neighborhoods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neighborhoods-full"] });
      toast.success("Barrio eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEditHood(n: any) {
    setEditHood(n);
    setEditHoodZoneId(n.zone_id || "");
    setEditHoodActive(n.active ? "true" : "false");
  }

  return (
    <>
      <PageHeader
        title="Zonas y barrios"
        description="Define zonas geográficas y asigna los barrios a cada una."
        actions={
          canEdit && (
            <div className="flex gap-2">
              <Dialog open={hoodOpen} onOpenChange={setHoodOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="mr-1 h-4 w-4" /> Nuevo barrio
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">Nuevo barrio</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      createHood.mutate({
                        name: String(fd.get("name") || ""),
                        zone_id: String(fd.get("zone_id") || ""),
                      });
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="hname">Nombre del barrio</Label>
                      <Input id="hname" name="name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zone_id">Zona</Label>
                      <Select name="zone_id">
                        <SelectTrigger id="zone_id">
                          <SelectValue placeholder="Selecciona la zona" />
                        </SelectTrigger>
                        <SelectContent>
                          {(zones ?? []).map((z) => (
                            <SelectItem key={z.id} value={z.id}>
                              {z.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createHood.isPending} className="bg-gradient-primary">
                        Guardar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary shadow-elegant">
                    <Plus className="mr-1 h-4 w-4" /> Nueva zona
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">Nueva zona</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      createZone.mutate({
                        name: String(fd.get("name") || ""),
                        description: String(fd.get("description") || ""),
                        priority: Number(fd.get("priority") || 100),
                      });
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="zname">Nombre</Label>
                      <Input id="zname" name="name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descripción</Label>
                      <Input id="description" name="description" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Prioridad de entrega</Label>
                      <Input id="priority" name="priority" type="number" defaultValue={100} required />
                      <p className="text-xs text-muted-foreground">Mayor número = mayor prioridad. Las rutas salen primero por los barrios de la zona con mayor prioridad.</p>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createZone.isPending} className="bg-gradient-primary">
                        Guardar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )
        }
      />
      <div className="space-y-8 p-6">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Zonas</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(zones ?? []).map((z) => (
                <Card key={z.id} className="shadow-card">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-lg font-semibold">{z.name}</h3>
                            <Badge variant="outline">Prioridad {(z as any).priority ?? 100}</Badge>
                          </div>
                          {z.description && <p className="mt-1 text-sm text-muted-foreground">{z.description}</p>}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex flex-col gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditZone(z)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`¿Eliminar la zona ${z.name}? Esta acción no se puede deshacer.`))
                                  deleteZone.mutate(z.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Barrios</h2>
          <div className="rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barrio</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Estado</TableHead>
                  {canEdit && <TableHead className="w-[100px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(neighborhoods ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 4 : 3} className="py-10 text-center text-sm text-muted-foreground">
                      Aún no hay barrios.
                    </TableCell>
                  </TableRow>
                ) : (
                  (neighborhoods ?? []).map((n: any) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.name}</TableCell>
                      <TableCell>{n.zones?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={n.active ? "default" : "secondary"}>{n.active ? "activo" : "inactivo"}</Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEditHood(n)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm(`¿Eliminar el barrio ${n.name}?`)) deleteHood.mutate(n.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      {/* Edit Zone */}
      <Dialog open={!!editZone} onOpenChange={(o) => !o && setEditZone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Editar zona</DialogTitle>
          </DialogHeader>
          {editZone && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateZone.mutate({
                  id: editZone.id,
                  name: String(fd.get("name") || ""),
                  description: String(fd.get("description") || ""),
                  priority: Number(fd.get("priority") || 100),
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="ez_name">Nombre</Label>
                <Input id="ez_name" name="name" defaultValue={editZone.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ez_desc">Descripción</Label>
                <Input id="ez_desc" name="description" defaultValue={editZone.description || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ez_priority">Prioridad de entrega</Label>
                <Input id="ez_priority" name="priority" type="number" defaultValue={(editZone as any).priority ?? 100} required />
                <p className="text-xs text-muted-foreground">Mayor número = mayor prioridad en la ruta.</p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateZone.isPending} className="bg-gradient-primary">
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Neighborhood */}
      <Dialog open={!!editHood} onOpenChange={(o) => !o && setEditHood(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Editar barrio</DialogTitle>
          </DialogHeader>
          {editHood && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateHood.mutate({
                  id: editHood.id,
                  name: String(fd.get("name") || ""),
                  zone_id: editHoodZoneId,
                  active: editHoodActive === "true",
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="eh_name">Nombre</Label>
                <Input id="eh_name" name="name" defaultValue={editHood.name} required />
              </div>
              <div className="space-y-2">
                <Label>Zona</Label>
                <Select value={editHoodZoneId} onValueChange={setEditHoodZoneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {(zones ?? []).map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={editHoodActive} onValueChange={setEditHoodActive}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Activo</SelectItem>
                    <SelectItem value="false">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateHood.isPending} className="bg-gradient-primary">
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
