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
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { isSellerScoped } from "@/lib/rbac";
import { ItemsDetail, ItemsToggle, type ItemLite } from "@/components/items-cell";

export const Route = createFileRoute("/app/sales")({
  component: SalesPage,
});

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  confirmed: "outline",
  paid: "default",
  cancelled: "destructive",
};

interface LineDraft {
  product_id: string;
  quantity: number;
  unit_price: number;
}

function SalesPage() {
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const sellerOnly = isSellerScoped(roles);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales", sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("id, sale_number, total, paid, balance, status, created_at, seller_id, customers(name), sale_items(quantity, products(name))")
        .order("created_at", { ascending: false });
      if (sellerOnly && user) query = query.eq("seller_id", user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-min", sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase.from("customers").select("id, name, customer_type, seller_id").order("name");
      if (sellerOnly && user) query = query.eq("seller_id", user.id);
      return (await query).data ?? [];
    },
  });
  const { data: products } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () =>
      (await supabase.from("products").select("id, name, price, wholesale_price, sku").eq("active", true).order("name")).data ?? [],
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
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({ customer_id: customerId, seller_id: user.id, status: "confirmed" })
        .select("id")
        .single();
      if (error || !sale) throw error ?? new Error("No se pudo crear");
      const { error: itemsErr } = await supabase.from("sale_items").insert(
        lines.map((l) => ({
          sale_id: sale.id,
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      );
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      toast.success("Venta registrada");
      setOpen(false);
      setLines([]);
      setCustomerId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addLine() {
    if (!products || products.length === 0) return;
    const p = products[0];
    setLines((prev) => [...prev, { product_id: p.id, quantity: 1, unit_price: priceFor(p) }]);
  }
  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Registra ventas y haz seguimiento de pagos y cartera."
        actions={sellerOnly ? null : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" />
                Nueva venta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display">Nueva venta</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un cliente" />
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
                              updateLine(i, { product_id: v, unit_price: p ? priceFor(p) : l.unit_price });
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
                          onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                        />
                        <Input
                          className="col-span-3"
                          type="number"
                          min="0"
                          value={l.unit_price}
                          onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="col-span-1"
                          onClick={() => removeLine(i)}
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
                  {createMutation.isPending ? "Guardando…" : "Registrar venta"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <div className="p-6">
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="min-w-56">Productos</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : (sales ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Aún no hay ventas registradas.
                  </TableCell>
                </TableRow>
              ) : (
                (sales ?? []).map((s: any) => {
                  const items: ItemLite[] = (s.sale_items ?? []).map((item: any) => ({
                    name: item.products?.name ?? "Producto",
                    quantity: Number(item.quantity ?? 0),
                  }));
                  return <Fragment key={s.id}>
                  <TableRow>
                    <TableCell className="font-mono text-xs">#{s.sale_number}</TableCell>
                    <TableCell className="font-medium">{s.customers?.name ?? "—"}</TableCell>
                    <TableCell>{new Date(s.created_at).toLocaleDateString("es-CO")}</TableCell>
                    <TableCell>
                      <ItemsToggle items={items} open={Boolean(expanded[s.id])} onToggle={() => setExpanded((prev) => ({ ...prev, [s.id]: !prev[s.id] }))} />
                    </TableCell>
                    <TableCell className="text-right">{fmt(Number(s.total))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(s.paid))}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">{fmt(Number(s.balance))}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[s.status] ?? "outline"}>{s.status}</Badge>
                    </TableCell>
                  </TableRow>
                  {expanded[s.id] && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30 pl-12"><ItemsDetail items={items} /></TableCell>
                    </TableRow>
                  )}
                  </Fragment>;
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
