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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { isSellerScoped } from "@/lib/rbac";
import { ItemsToggle, ItemsDetail, type ItemLite } from "@/components/items-cell";

export const Route = createFileRoute("/app/orders")({
  component: OrdersPage,
});

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  confirmed: "outline",
  delivered: "default",
  cancelled: "destructive",
};

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borradores" },
  { value: "confirmed", label: "Confirmados" },
  { value: "delivered", label: "Entregados" },
  { value: "cancelled", label: "Cancelados" },
];

interface LineDraft {
  product_id: string;
  quantity: number;
  unit_price: number;
}

function OrdersPage() {
  const qc = useQueryClient();
  const { user, roles, hasAnyRole } = useAuth();
  const sellerOnly = isSellerScoped(roles);
  // Solo administrador y logística pueden marcar entregado / convertir en venta.
  const canDeliver = hasAnyRole(["admin", "logistics_operator"]);
  const isAdmin = hasAnyRole(["admin"]);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [statusTab, setStatusTab] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      let q = supabase
        .from("orders" as any)
        .select("id, order_number, total, status, delivery_date, created_at, customers!inner(name, seller_id), sales(id, sale_number), order_items(quantity, products(name))")
        .order("created_at", { ascending: false });
      if (sellerOnly && user) q = q.eq("customers.seller_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc("convert_order_to_sale" as any, { _order_id: orderId });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      return row as { id: string; sale_number: number };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      toast.success(`Venta #${res.sale_number} creada`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-min", sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase.from("customers").select("id, name, document_id, phone, customer_type, seller_id").order("name");
      if (sellerOnly && user) query = query.eq("seller_id", user.id);
      return (await query).data ?? [];
    },
  });
  const { data: deliveryDays } = useQuery({
    queryKey: ["delivery-days"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("delivery_days" as any)
        .limit(1)
        .maybeSingle();
      const dd = (data as any)?.delivery_days;
      return Array.isArray(dd) && dd.length > 0 ? (dd as number[]) : [1, 2, 3, 4, 5, 6];
    },
  });
  const isDayAllowed = (d: Date) => (deliveryDays ?? [1, 2, 3, 4, 5, 6]).includes(d.getDay());
  const allowedDaysLabel = (() => {
    const names = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const dd = deliveryDays ?? [];
    return dd.length === 7 ? "Todos los días" : dd.slice().sort().map((i) => names[i]).join(", ");
  })();
  const { data: products } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () =>
      (await supabase.from("products").select("id, name, price, wholesale_price").eq("active", true).order("name")).data ?? [],
  });

  const selectedCustomer = (customers ?? []).find((c: any) => c.id === customerId);
  const isWholesale = (selectedCustomer as any)?.customer_type === "wholesale";
  const priceFor = (p: any) => {
    const w = Number(p?.wholesale_price ?? 0);
    return isWholesale && w > 0 ? w : Number(p?.price ?? 0);
  };

  useEffect(() => {
    setLines((prev) =>
      prev.map((l) => {
        const p = (products ?? []).find((pp: any) => pp.id === l.product_id);
        return p ? { ...l, unit_price: priceFor(p) } : l;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWholesale]);



  const total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sin sesión");
      if (!customerId) throw new Error("Selecciona cliente");
      if (lines.length === 0) throw new Error("Agrega al menos un producto");
      const { data: order, error } = await supabase
        .from("orders" as any)
        .insert({
          customer_id: customerId,
          seller_id: user.id,
          status: "confirmed",
          delivery_date: deliveryDate || null,
        })
        .select("id")
        .single();
      if (error || !order) throw error ?? new Error("No se pudo crear");
      const { error: itemsErr } = await supabase.from("order_items" as any).insert(
        lines.map((l) => ({
          order_id: (order as any).id,
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      );
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido creado");
      setOpen(false);
      setLines([]);
      setCustomerId("");
      setCustomerSearch("");
      setDeliveryDate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Estado actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addLine() {
    if (!products || products.length === 0) return;
    const p = products[0];
    setLines((prev) => [...prev, { product_id: p.id, quantity: 1, unit_price: priceFor(p) }]);
  }

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Gestiona pedidos de clientes y su flujo hasta entrega."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" /> Nuevo pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display">Nuevo pedido</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cliente (busca por nombre o documento)</Label>
                    <Input
                      placeholder="Nombre o documento…"
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId(""); }}
                    />
                    {customerSearch && !customerId && (
                      <div className="max-h-40 overflow-auto rounded-md border bg-popover text-sm shadow-md">
                        {(customers ?? [])
                          .filter((c: any) => {
                            const q = customerSearch.toLowerCase();
                            return (
                              c.name?.toLowerCase().includes(q) ||
                              (c.document_id ?? "").toLowerCase().includes(q) ||
                              (c.phone ?? "").includes(q)
                            );
                          })
                          .slice(0, 8)
                          .map((c: any) => (
                            <button
                              key={c.id}
                              type="button"
                              className="block w-full px-3 py-2 text-left hover:bg-accent"
                              onClick={() => { setCustomerId(c.id); setCustomerSearch(`${c.name}${c.document_id ? " · " + c.document_id : ""}`); }}
                            >
                              <div className="font-medium">{c.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {c.document_id ?? "Sin doc."} {c.phone ? `· ${c.phone}` : ""}
                              </div>
                            </button>
                          ))}
                        {(customers ?? []).filter((c: any) => {
                          const q = customerSearch.toLowerCase();
                          return c.name?.toLowerCase().includes(q) || (c.document_id ?? "").toLowerCase().includes(q);
                        }).length === 0 && (
                          <div className="px-3 py-2 text-muted-foreground">Sin coincidencias.</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de entrega</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !deliveryDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {deliveryDate
                            ? format(new Date(deliveryDate + "T00:00:00"), "PPP")
                            : "Selecciona fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={deliveryDate ? new Date(deliveryDate + "T00:00:00") : undefined}
                          onSelect={(d) => {
                            if (!d) return setDeliveryDate("");
                            const yyyy = d.getFullYear();
                            const mm = String(d.getMonth() + 1).padStart(2, "0");
                            const dd = String(d.getDate()).padStart(2, "0");
                            setDeliveryDate(`${yyyy}-${mm}-${dd}`);
                          }}
                          disabled={(d) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return d < today || !isDayAllowed(d);
                          }}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Días disponibles: {allowedDaysLabel}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>Productos</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addLine}>
                      <Plus className="mr-1 h-3 w-3" /> Agregar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {lines.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sin productos agregados.</p>
                    )}
                    {lines.map((l, i) => (
                      <div key={i} className="grid grid-cols-12 items-center gap-2">
                        <div className="col-span-6">
                          <Select
                            value={l.product_id}
                            onValueChange={(v) => {
                              const p = (products ?? []).find((pp) => pp.id === v);
                              setLines((prev) =>
                                prev.map((x, idx) =>
                                  idx === i
                                    ? { ...x, product_id: v, unit_price: p ? priceFor(p) : x.unit_price }
                                    : x,
                                ),
                              );
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(products ?? []).map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          className="col-span-2"
                          type="number"
                          min="1"
                          value={l.quantity}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x, idx) => (idx === i ? { ...x, quantity: Number(e.target.value) } : x)),
                            )
                          }
                        />
                        <Input
                          className="col-span-3"
                          type="number"
                          min="0"
                          value={l.unit_price}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x, idx) => (idx === i ? { ...x, unit_price: Number(e.target.value) } : x)),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="col-span-1"
                          onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-display text-xl font-semibold">{fmt(total)}</span>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="bg-gradient-primary"
                >
                  {createMutation.isPending ? "Guardando…" : "Crear pedido"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-4 p-6">
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList>
              {STATUS_TABS.map((t) => {
                const count =
                  t.value === "all"
                    ? (orders ?? []).length
                    : (orders ?? []).filter((o: any) => o.status === t.value).length;
                return (
                  <TabsTrigger key={t.value} value={t.value}>
                    {t.label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Entrega</Label>
              <Input
                type="date"
                className="h-9 w-40"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
              {filterDate && (
                <Button type="button" variant="outline" size="sm" onClick={() => setFilterDate("")}>
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          {STATUS_TABS.map((t) => {
            const filtered = (orders ?? []).filter((o: any) => {
              if (t.value !== "all" && o.status !== t.value) return false;
              if (filterDate && o.delivery_date !== filterDate) return false;
              return true;
            });
            return (
              <TabsContent key={t.value} value={t.value} className="mt-4">
                <div className="rounded-xl border bg-card shadow-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Productos</TableHead>
                        <TableHead>Entrega</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[180px]">Avanzar</TableHead>
                        <TableHead className="w-[170px]">Venta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                            Cargando…
                          </TableCell>
                        </TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                            Sin pedidos para los filtros seleccionados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((o: any) => {
                          const existingSale = Array.isArray(o.sales) ? o.sales[0] : o.sales;
                          const canConvert = o.status !== "draft" && o.status !== "cancelled" && !existingSale;
                          const items: ItemLite[] = (o.order_items ?? []).map((it: any) => ({
                            name: it.products?.name ?? "—",
                            quantity: Number(it.quantity ?? 0),
                          }));
                          const isOpen = !!expanded[o.id];
                          return (
                            <Fragment key={o.id}>
                            <TableRow key={o.id}>
                              <TableCell className="font-mono text-xs">#{o.order_number}</TableCell>
                              <TableCell className="font-medium">{o.customers?.name ?? "—"}</TableCell>
                              <TableCell className="max-w-[260px]">
                                <ItemsToggle items={items} open={isOpen} onToggle={() => setExpanded((p) => ({ ...p, [o.id]: !p[o.id] }))} />
                              </TableCell>
                              <TableCell>
                                {o.delivery_date ? new Date(o.delivery_date).toLocaleDateString("es-CO") : "—"}
                              </TableCell>
                              <TableCell className="text-right">{fmt(Number(o.total))}</TableCell>
                              <TableCell>
                                <Badge variant={statusVariant[o.status] ?? "outline"}>
                                  {statusLabel[o.status] ?? o.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={statusLabel[o.status] ? o.status : "confirmed"}
                                  onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v })}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(statusLabel).map(([k, v]) => {
                                      // Vendedor: no puede cancelar si ya está entregado o convertido en venta.
                                      const sellerBlockCancel =
                                        k === "cancelled" &&
                                        sellerOnly &&
                                        (o.status === "delivered" || !!existingSale);
                                      return (
                                        <SelectItem
                                          key={k}
                                          value={k}
                                          disabled={(k === "delivered" && !canDeliver) || sellerBlockCancel}
                                        >
                                          {v}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {existingSale ? (
                                  <Badge variant="default" className="font-mono text-xs">
                                    Venta #{existingSale.sale_number}
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!canConvert || !canDeliver || convertMutation.isPending}
                                    title={!canDeliver ? "Solo logística o administrador puede convertir en venta" : undefined}
                                    onClick={() => convertMutation.mutate(o.id)}
                                  >
                                    Convertir en venta
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow key={o.id + "-detail"} className="bg-muted/30">
                                <TableCell colSpan={8} className="py-2">
                                  <ItemsDetail items={items} />
                                </TableCell>
                              </TableRow>
                            )}
                            </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </>
  );
}
