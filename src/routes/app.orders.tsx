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
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/orders")({
  component: OrdersPage,
});

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  confirmed: "outline",
  in_production: "outline",
  ready: "default",
  delivered: "default",
  cancelled: "destructive",
};

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  in_production: "En producción",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

interface LineDraft {
  product_id: string;
  quantity: number;
  unit_price: number;
}

function OrdersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders" as any)
        .select("id, order_number, total, status, delivery_date, created_at, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => (await supabase.from("customers").select("id, name, document_id, phone").order("name")).data ?? [],
  });
  const { data: products } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () =>
      (await supabase.from("products").select("id, name, price").eq("active", true).order("name")).data ?? [],
  });

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
    setLines((prev) => [...prev, { product_id: p.id, quantity: 1, unit_price: Number(p.price) }]);
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
                    <Label>Cliente</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {(customers ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de entrega</Label>
                    <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
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
                                    ? { ...x, product_id: v, unit_price: p ? Number(p.price) : x.unit_price }
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
      <div className="p-6">
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[180px]">Avanzar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : (orders ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Aún no hay pedidos.
                  </TableCell>
                </TableRow>
              ) : (
                (orders ?? []).map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">#{o.order_number}</TableCell>
                    <TableCell className="font-medium">{o.customers?.name ?? "—"}</TableCell>
                    <TableCell>
                      {o.delivery_date ? new Date(o.delivery_date).toLocaleDateString("es-CO") : "—"}
                    </TableCell>
                    <TableCell className="text-right">{fmt(Number(o.total))}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[o.status] ?? "outline"}>{statusLabel[o.status] ?? o.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={o.status}
                        onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabel).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
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
