import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Boxes, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const { data: inv, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory" as any)
        .select("id, quantity, min_stock, max_stock, updated_at, products(name, sku, unit), warehouses(name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  return (
    <>
      <PageHeader title="Inventario" description="Existencias actuales por producto y almacén." />
      <div className="p-6">
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Mín.</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : (inv ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  <Boxes className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  Sin movimientos de inventario aún.
                </TableCell></TableRow>
              ) : (
                (inv ?? []).map((r: any) => {
                  const low = Number(r.quantity) <= Number(r.min_stock);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.products?.name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.products?.sku ?? "—"}</TableCell>
                      <TableCell>{r.warehouses?.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(r.quantity)} {r.products?.unit}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{Number(r.min_stock)}</TableCell>
                      <TableCell>
                        {low ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Bajo</Badge>
                        ) : (
                          <Badge variant="default">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
