import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Truck, User, Download, FileText, CheckCircle2, MapPin } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { PHONE_INPUT_PROPS, isValidPhone, sanitizePhoneInput } from "@/lib/phone";
import { exportToPdf, exportToExcel } from "@/lib/export";
import { ItemsDetail, ItemsToggle, summarizeItems, aggregateItems, type ItemLite } from "@/components/items-cell";

export const Route = createFileRoute("/app/logistics")({
  component: LogisticsPage,
});

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
const ORDER_STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  confirmed: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  delivered: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-destructive/20 text-destructive",
};

// Only these statuses can be moved from inside a shipment row
const SHIPMENT_STATUS_OPTIONS: Record<string, string> = {
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const COMPANY_DRIVER_KEY = "__company__";

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  notes: string | null;
  delivery_date: string | null;
  driver_id: string | null;
  customer_id: string;
  customers:
    | {
        name?: string | null;
        phone?: string | null;
        address?: string | null;
        neighborhoods?: { name?: string | null; zones?: { name?: string | null; priority?: number | null } | null } | null;
      }
    | null;
  drivers?: { name?: string | null; phone?: string | null } | null;
  order_items?: Array<{ quantity?: number | null; products?: { name?: string | null } | null }> | null;
};

type DriverRow = { id: string; name: string; phone: string | null };


function LogisticsPage() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "logistics_operator"]);
  const [openDriver, setOpenDriver] = useState(false);
  const [filterDate, setFilterDate] = useState<string>(todayISO());
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: orders } = useQuery({
    queryKey: ["logistics-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, notes, delivery_date, driver_id, customer_id, customers(name, phone, address, neighborhoods(name, zones(name, priority))), drivers:collaborators!orders_driver_id_fkey(name:full_name, phone), order_items(quantity, products(name))")
        .not("status", "in", "(cancelled)")
        .order("delivery_date", { ascending: true })
        .order("order_number", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collaborators")
        .select("id, full_name, phone, cost_items!inner(key)")
        .eq("active", true)
        .eq("cost_items.key", "repartidor")
        .order("full_name");
      if (error) throw error;
      return ((data ?? []) as Array<{ id: string; full_name: string | null; phone: string | null }>).map((d) => ({
        id: d.id,
        name: d.full_name ?? "",
        phone: d.phone,
      })) as DriverRow[];
    },
  });

  const createDriver = useMutation({
    mutationFn: async (input: { first_name: string; last_name: string | null; phone: string | null; document_id: string | null }) => {
      const { data: ci, error: ciErr } = await supabase.from("cost_items").select("id").eq("key", "repartidor").maybeSingle();
      if (ciErr) throw ciErr;
      if (!ci) throw new Error("No existe el cargo Repartidor en costos");
      const { error } = await supabase.from("collaborators").insert({ ...input, cost_item_id: ci.id, active: true } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Repartidor creado");
      setOpenDriver(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const updateOrder = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("orders").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logistics-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkUpdateOrders = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("orders").update(patch as never).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logistics-orders"] });
      toast.success("Pedidos actualizados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Only confirmed (and already-delivered) orders can be part of a shipment.
  // Drafts and cancelled orders never appear here.
  const filteredOrders = useMemo<OrderRow[]>(() => {
    return (orders ?? []).filter((o) => {
      if (o.status !== "confirmed" && o.status !== "delivered") return false;
      if (!o.delivery_date) return false;
      if (filterDate && o.delivery_date !== filterDate) return false;
      if (filterDriver !== "all") {
        if (filterDriver === COMPANY_DRIVER_KEY) {
          if (o.driver_id) return false;
        } else if (o.driver_id !== filterDriver) return false;
      }
      return true;
    });
  }, [orders, filterDate, filterDriver]);

  type Group = {
    key: string;
    driverId: string | null;
    driverName: string;
    date: string;
    orders: OrderRow[];
  };

  const orderSortKey = (o: OrderRow) => {
    const z = o.customers?.neighborhoods?.zones;
    const p = typeof z?.priority === "number" ? z.priority : -1;
    const zn = z?.name ?? "zzz";
    const nb = o.customers?.neighborhoods?.name ?? "zzz";
    return { p, zn, nb };
  };

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const o of filteredOrders) {
      const key = `${o.driver_id ?? "none"}|${o.delivery_date}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          driverId: o.driver_id,
          driverName: o.drivers?.name ?? "Sin conductor asignado",
          date: o.delivery_date!,
          orders: [],
        });
      }
      map.get(key)!.orders.push(o);
    }
    // sort orders inside each group: higher zone priority first, then zone name, then neighborhood
    for (const g of map.values()) {
      g.orders.sort((a, b) => {
        const ka = orderSortKey(a);
        const kb = orderSortKey(b);
        if (kb.p !== ka.p) return kb.p - ka.p;
        if (ka.zn !== kb.zn) return ka.zn.localeCompare(kb.zn);
        return ka.nb.localeCompare(kb.nb);
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.driverName.localeCompare(b.driverName);
    });
  }, [filteredOrders]);

  const unassignedOrders = useMemo<OrderRow[]>(() => {
    return (orders ?? []).filter((o) => o.status === "confirmed" && (!o.delivery_date || !o.driver_id));
  }, [orders]);

  const buildExportRows = (list: OrderRow[]) =>
    list.map((o) => [
      `#${o.order_number}`,
      o.delivery_date ?? "—",
      o.drivers?.name ?? "Sin conductor",
      o.customers?.name ?? "—",
      o.customers?.phone ?? "—",
      o.customers?.address ?? "—",
      summarizeItems(toItems(o), 99),
      ORDER_STATUS_LABEL[o.status] ?? o.status,
    ]);

  const toItems = (order: OrderRow): ItemLite[] =>
    (order.order_items ?? []).map((item) => ({
      name: item.products?.name ?? "Producto",
      quantity: Number(item.quantity ?? 0),
    }));

  const productTotals = (list: OrderRow[]): ItemLite[] => {
    const all: ItemLite[] = [];
    list.forEach((o) => all.push(...toItems(o)));
    return aggregateItems(all);
  };

  const handleDownloadPdf = () => {
    if (filteredOrders.length === 0) {
      toast.error("No hay pedidos para descargar");
      return;
    }
    const totals = productTotals(filteredOrders);
    exportToPdf({
      title: "Pedidos por entregar",
      columns: ["Pedido", "Fecha", "Conductor", "Cliente", "Teléfono", "Dirección", "Productos", "Estado"],
      rows: buildExportRows(filteredOrders),
      meta: {
        Fecha: filterDate || "Todas",
        Conductor:
          filterDriver === "all"
            ? "Todos"
            : filterDriver === COMPANY_DRIVER_KEY
              ? "Sin asignar"
              : (drivers ?? []).find((d) => d.id === filterDriver)?.name ?? "—",
        Pedidos: String(filteredOrders.length),
      },
      extraTable: {
        title: "Total por tipo de producto (alistamiento)",
        columns: ["Producto", "Cantidad total"],
        rows: totals.map((t) => [t.name, t.quantity]),
      },
      filename: `entregas_${filterDate || "todas"}.pdf`,
    });
  };

  const handleDownloadExcel = () => {
    if (filteredOrders.length === 0) {
      toast.error("No hay pedidos para descargar");
      return;
    }
    const totals = productTotals(filteredOrders);
    exportToExcel({
      filename: `entregas_${filterDate || "todas"}`,
      sheets: [
        {
          name: "Entregas",
          columns: ["Pedido", "Fecha", "Conductor", "Cliente", "Teléfono", "Dirección", "Productos", "Estado"],
          rows: buildExportRows(filteredOrders),
        },
        {
          name: "Totales producto",
          columns: ["Producto", "Cantidad total"],
          rows: totals.map((t) => [t.name, t.quantity]),
        },
      ],
    });
  };

  const downloadGroupPdf = (g: Group) => {
    const totals = productTotals(g.orders);
    exportToPdf({
      title: `Ruta ${g.driverName}`,
      columns: ["Pedido", "Cliente", "Teléfono", "Dirección", "Productos", "Total", "Estado"],
      rows: g.orders.map((o) => [
        `#${o.order_number}`,
        o.customers?.name ?? "—",
        o.customers?.phone ?? "—",
        o.customers?.address ?? "—",
        summarizeItems(toItems(o), 99),
        String(o.total ?? 0),
        ORDER_STATUS_LABEL[o.status] ?? o.status,
      ]),
      meta: {
        Conductor: g.driverName,
        Fecha: g.date,
        Pedidos: String(g.orders.length),
      },
      extraTable: {
        title: "Total por tipo de producto (alistamiento)",
        columns: ["Producto", "Cantidad total"],
        rows: totals.map((t) => [t.name, t.quantity]),
      },
      filename: `ruta_${g.driverName.replace(/\s+/g, "_")}_${g.date}.pdf`,
    });
  };

  return (
    <>
      <PageHeader
        title="Logística"
        description="Los envíos se arman automáticamente agrupando los pedidos de cada conductor por día."
        actions={
          canManage && (
            <Dialog open={openDriver} onOpenChange={setOpenDriver}>
              <DialogTrigger asChild>
                <Button variant="outline"><User className="mr-1 h-4 w-4" /> Repartidor</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Nuevo repartidor</DialogTitle></DialogHeader>
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
                      first_name: String(fd.get("first_name") || ""),
                      last_name: String(fd.get("last_name") || "") || null,
                      phone: phone || null,
                      document_id: String(fd.get("document_id") || "") || null,
                    });
                  }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2"><Label>Nombres</Label><Input name="first_name" required /></div>
                    <div className="space-y-2"><Label>Apellidos</Label><Input name="last_name" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2"><Label>Teléfono</Label><Input name="phone" {...PHONE_INPUT_PROPS} onInput={(e) => { e.currentTarget.value = sanitizePhoneInput(e.currentTarget.value); }} /></div>
                    <div className="space-y-2"><Label>Documento</Label><Input name="document_id" /></div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={createDriver.isPending} className="bg-gradient-primary">Guardar</Button></DialogFooter>
                </form>
              </DialogContent>

            </Dialog>
          )
        }
      />

      <div className="p-6">
        <Tabs defaultValue="shipments">
          <TabsList>
            <TabsTrigger value="shipments">Envíos del día</TabsTrigger>
            <TabsTrigger value="unassigned">Por asignar ({unassignedOrders.length})</TabsTrigger>
            <TabsTrigger value="drivers">Conductores</TabsTrigger>
          </TabsList>

          <TabsContent value="shipments" className="mt-4 space-y-4">
            <Card className="shadow-card">
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
                <div className="grid flex-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha de entrega</Label>
                    <div className="flex gap-2">
                      <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                      <Button type="button" variant="outline" size="sm" onClick={() => setFilterDate("")}>
                        Todas
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Conductor</Label>
                    <Select value={filterDriver} onValueChange={setFilterDriver}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value={COMPANY_DRIVER_KEY}>Sin asignar</SelectItem>
                        {(drivers ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleDownloadPdf}>
                    <FileText className="mr-1 h-4 w-4" /> PDF
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDownloadExcel}>
                    <Download className="mr-1 h-4 w-4" /> Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground">
              {groups.length} envío(s) · {filteredOrders.length} pedido(s)
              {filterDate && ` · ${filterDate}`}
            </div>

            {groups.length === 0 ? (
              <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
                <Truck className="mx-auto mb-2 h-8 w-8 opacity-50" />
                No hay pedidos asignados para los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((g) => {
                  const pending = g.orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
                  const allDelivered = pending.length === 0;
                  return (
                    <Card key={g.key} className="shadow-card">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                              <Truck className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="font-display text-base font-semibold">
                                {g.driverName} · {g.date}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {g.orders.length} pedido(s) · {pending.length} pendiente(s)
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => downloadGroupPdf(g)}>
                              <FileText className="mr-1 h-4 w-4" /> Ruta PDF
                            </Button>
                            {canManage && !allDelivered && (
                              <Button
                                type="button"
                                size="sm"
                                className="bg-gradient-primary"
                                disabled={bulkUpdateOrders.isPending}
                                onClick={() => bulkUpdateOrders.mutate({ ids: pending.map((o) => o.id), patch: { status: "delivered" } })}
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar entregados
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="divide-y rounded-lg border">
                          {g.orders.map((o) => {
                            const items = toItems(o);
                            return <div key={o.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-medium">
                                  Pedido #{o.order_number} · {o.customers?.name ?? "—"}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  {o.customers?.neighborhoods?.zones?.name && (
                                    <Badge variant="outline" className="font-normal">
                                      {o.customers.neighborhoods.zones.name}
                                      {typeof o.customers.neighborhoods.zones.priority === "number" && ` · P${o.customers.neighborhoods.zones.priority}`}
                                      {o.customers.neighborhoods.name && ` · ${o.customers.neighborhoods.name}`}
                                    </Badge>
                                  )}
                                  {o.customers?.phone && <span>{o.customers.phone}</span>}
                                  {o.customers?.address && (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="h-3 w-3" /> {o.customers.address}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 max-w-xl">
                                  <ItemsToggle items={items} open={Boolean(expanded[o.id])} onToggle={() => setExpanded((prev) => ({ ...prev, [o.id]: !prev[o.id] }))} />
                                  {expanded[o.id] && <div className="mt-1 pl-4"><ItemsDetail items={items} /></div>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={ORDER_STATUS_TONE[o.status] ?? ""} variant="secondary">
                                  {ORDER_STATUS_LABEL[o.status] ?? o.status}
                                </Badge>
                                {canManage && (
                                  <Select
                                    value={o.status}
                                    onValueChange={(v) => updateOrder.mutate({ id: o.id, patch: { status: v } })}
                                  >
                                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(SHIPMENT_STATUS_OPTIONS).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>;
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="unassigned" className="mt-4 space-y-3">
            <div className="text-xs text-muted-foreground">
              Asigna fecha de entrega y conductor para que el pedido aparezca dentro de un envío.
            </div>
            {unassignedOrders.length === 0 ? (
              <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
                Todos los pedidos activos ya tienen fecha y conductor asignados.
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedOrders.map((o) => (
                  <Card key={o.id} className="shadow-card">
                    <CardContent className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          Pedido #{o.order_number} · {o.customers?.name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {o.customers?.phone ?? ""} {o.customers?.address ? `· ${o.customers.address}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="date"
                          className="h-8 w-40"
                          defaultValue={o.delivery_date ?? ""}
                          onBlur={(e) => {
                            const v = e.currentTarget.value || null;
                            if (v !== (o.delivery_date ?? null)) {
                              updateOrder.mutate({ id: o.id, patch: { delivery_date: v } });
                            }
                          }}
                          disabled={!canManage}
                        />
                        <Select
                          value={o.driver_id ?? ""}
                          onValueChange={(v) => updateOrder.mutate({ id: o.id, patch: { driver_id: v || null } })}
                          disabled={!canManage}
                        >
                          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Conductor" /></SelectTrigger>
                          <SelectContent>
                            {(drivers ?? []).map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
                        {d.phone && <p className="text-xs text-muted-foreground">{d.phone}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(drivers ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No hay repartidores registrados.</p>
              )}

            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
