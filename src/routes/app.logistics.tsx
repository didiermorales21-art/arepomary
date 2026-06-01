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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Truck, User, Download, FileText } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { PHONE_INPUT_PROPS, isValidPhone, sanitizePhoneInput } from "@/lib/phone";
import { exportToPdf, exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/app/logistics")({
  component: LogisticsPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_transit: "En tránsito",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-foreground",
  in_transit: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  delivered: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-destructive/20 text-destructive",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  in_production: "En producción",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function LogisticsPage() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "operations"]);
  const [openShip, setOpenShip] = useState(false);
  const [openDriver, setOpenDriver] = useState(false);

  const { data: shipments } = useQuery({
    queryKey: ["shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*, drivers(name, license_plate), zones(name), orders(order_number, customers(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["orders-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customers(name)")
        .not("status", "in", "(delivered,cancelled)")
        .order("order_number", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: zones } = useQuery({
    queryKey: ["zones-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zones").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createShipment = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { error } = await supabase.from("shipments").insert(input as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      toast.success("Envío creado");
      setOpenShip(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createDriver = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { error } = await supabase.from("drivers").insert(input as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Conductor creado");
      setOpenDriver(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "in_transit") patch.dispatched_at = new Date().toISOString();
      if (status === "delivered") patch.delivered_at = new Date().toISOString();
      const { error } = await supabase.from("shipments").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      toast.success("Estado actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Logística"
        description="Planificación de envíos, conductores y entregas."
        actions={
          canManage && (
            <div className="flex gap-2">
              <Dialog open={openDriver} onOpenChange={setOpenDriver}>
                <DialogTrigger asChild>
                  <Button variant="outline"><User className="mr-1 h-4 w-4" /> Conductor</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-display">Nuevo conductor</DialogTitle></DialogHeader>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const phone = String(fd.get("phone") || "");
                      if (phone && !isValidPhone(phone)) {
                        toast.error("El teléfono debe tener 10 dígitos y comenzar con 3");
                        return;
                      }
                      createDriver.mutate({
                        name: String(fd.get("name") || ""),
                        phone: phone || null,
                        license_plate: String(fd.get("license_plate") || "") || null,
                        vehicle: String(fd.get("vehicle") || "") || null,
                      });
                    }}
                  >
                    <div className="space-y-2"><Label>Nombre</Label><Input name="name" required /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2"><Label>Teléfono</Label><Input name="phone" {...PHONE_INPUT_PROPS} onInput={(e) => { e.currentTarget.value = sanitizePhoneInput(e.currentTarget.value); }} /></div>
                      <div className="space-y-2"><Label>Placa</Label><Input name="license_plate" /></div>
                    </div>
                    <div className="space-y-2"><Label>Vehículo</Label><Input name="vehicle" placeholder="Camioneta NPR" /></div>
                    <DialogFooter><Button type="submit" disabled={createDriver.isPending} className="bg-gradient-primary">Guardar</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={openShip} onOpenChange={setOpenShip}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary shadow-elegant"><Plus className="mr-1 h-4 w-4" /> Envío</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-display">Nuevo envío</DialogTitle></DialogHeader>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      createShipment.mutate({
                        order_id: String(fd.get("order_id") || "") || null,
                        driver_id: String(fd.get("driver_id") || "") || null,
                        zone_id: String(fd.get("zone_id") || "") || null,
                        scheduled_for: String(fd.get("scheduled_for") || "") || null,
                        address: String(fd.get("address") || "") || null,
                        notes: String(fd.get("notes") || "") || null,
                      });
                    }}
                  >
                    <div className="space-y-2">
                      <Label>Pedido</Label>
                      <Select name="order_id">
                        <SelectTrigger><SelectValue placeholder="Selecciona pedido" /></SelectTrigger>
                        <SelectContent>
                          {(orders ?? []).map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              #{o.order_number} — {(o.customers as { name?: string } | null)?.name ?? "—"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Conductor</Label>
                        <Select name="driver_id">
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {(drivers ?? []).map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Zona</Label>
                        <Select name="zone_id">
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {(zones ?? []).map((z) => (
                              <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2"><Label>Fecha programada</Label><Input type="date" name="scheduled_for" /></div>
                    <div className="space-y-2"><Label>Dirección</Label><Input name="address" /></div>
                    <div className="space-y-2"><Label>Notas</Label><Textarea name="notes" rows={2} /></div>
                    <DialogFooter><Button type="submit" disabled={createShipment.isPending} className="bg-gradient-primary">Crear envío</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )
        }
      />
      <div className="p-6">
        <Tabs defaultValue="shipments">
          <TabsList>
            <TabsTrigger value="shipments">Envíos</TabsTrigger>
            <TabsTrigger value="drivers">Conductores</TabsTrigger>
          </TabsList>
          <TabsContent value="shipments" className="mt-4">
            <div className="space-y-3">
              {(shipments ?? []).length === 0 ? (
                <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
                  <Truck className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  Aún no hay envíos. Crea uno para empezar.
                </div>
              ) : (
                (shipments ?? []).map((s) => {
                  const order = s.orders as { order_number?: number; customers?: { name?: string } } | null;
                  const driver = s.drivers as { name?: string; license_plate?: string } | null;
                  const zone = s.zones as { name?: string } | null;
                  return (
                    <Card key={s.id} className="shadow-card">
                      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                            <Truck className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-display text-base font-semibold">
                              Envío #{s.shipment_number}
                              {order?.order_number && <span className="text-muted-foreground"> · Pedido #{order.order_number}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {order?.customers?.name ?? "Sin cliente"}
                              {driver?.name && ` · ${driver.name}${driver.license_plate ? ` (${driver.license_plate})` : ""}`}
                              {zone?.name && ` · ${zone.name}`}
                              {s.scheduled_for && ` · ${s.scheduled_for}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={STATUS_TONE[s.status] ?? ""} variant="secondary">
                            {STATUS_LABEL[s.status] ?? s.status}
                          </Badge>
                          {canManage && (
                            <Select
                              value={s.status}
                              onValueChange={(v) => updateStatus.mutate({ id: s.id, status: v })}
                            >
                              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
          <TabsContent value="drivers" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(drivers ?? []).map((d) => (
                <Card key={d.id} className="shadow-card">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-gold text-gold-foreground">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold">{d.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {d.license_plate ?? "—"} · {d.vehicle ?? "Sin vehículo"}
                        </p>
                        {d.phone && <p className="text-xs text-muted-foreground">{d.phone}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(drivers ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No hay conductores registrados.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
