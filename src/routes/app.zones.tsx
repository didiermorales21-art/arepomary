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
import { Plus, MapPin, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/zones")({
  component: ZonesPage,
});

function ZonesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [zoneOpen, setZoneOpen] = useState(false);
  const [hoodOpen, setHoodOpen] = useState(false);

  const { data: zones, isLoading } = useQuery({
    queryKey: ["zones-full"],
    queryFn: async () => (await supabase.from("zones").select("*").order("name")).data ?? [],
  });

  const { data: neighborhoods } = useQuery({
    queryKey: ["neighborhoods-full"],
    queryFn: async () =>
      (await supabase.from("neighborhoods").select("id, name, active, zone_id, zones(name)").order("name")).data ?? [],
  });

  const createZone = useMutation({
    mutationFn: async (input: { name: string; description: string }) => {
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

  return (
    <>
      <PageHeader
        title="Zonas y barrios"
        description="Define zonas geográficas y asigna los barrios a cada una."
        actions={
          isAdmin && (
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
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold">{z.name}</h3>
                        {z.description && <p className="mt-1 text-sm text-muted-foreground">{z.description}</p>}
                      </div>
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
                  {isAdmin && <TableHead className="w-[60px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(neighborhoods ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 4 : 3} className="py-10 text-center text-sm text-muted-foreground">
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
                      {isAdmin && (
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`¿Eliminar el barrio ${n.name}?`)) deleteHood.mutate(n.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
    </>
  );
}
