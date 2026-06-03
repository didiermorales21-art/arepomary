import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, Smartphone, Gift, Wallet } from "lucide-react";
import { fmtMoney } from "@/lib/export";

export const Route = createFileRoute("/app/cashbox")({
  component: CashboxPage,
});

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  nequi: "Nequi",
  daviplata: "Daviplata",
  gift: "Regalo",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

function CashboxPage() {
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const { data, isLoading } = useQuery({
    queryKey: ["cashbox", from, to],
    queryFn: async () => {
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      const { data: pays, error } = await supabase
        .from("invoice_payments")
        .select("amount, method, paid_at, invoices(customers(name))")
        .gte("paid_at", fromIso)
        .lte("paid_at", toIso)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      const totals: Record<string, number> = {};
      (pays ?? []).forEach((p: any) => {
        totals[p.method] = (totals[p.method] ?? 0) + Number(p.amount || 0);
      });
      return { rows: pays ?? [], totals };
    },
  });

  const cards = [
    { key: "cash", label: "Efectivo", icon: Banknote, accent: "bg-gradient-primary" },
    { key: "nequi", label: "Nequi", icon: Smartphone, accent: "bg-gradient-gold" },
    { key: "daviplata", label: "Daviplata", icon: Smartphone, accent: "bg-gradient-primary" },
    { key: "gift", label: "Regalo", icon: Gift, accent: "bg-gradient-gold" },
  ];

  const totalReal = (data?.totals.cash ?? 0) + (data?.totals.nequi ?? 0) + (data?.totals.daviplata ?? 0);
  const resetRange = () => {
    const r = defaultRange();
    setFrom(r.from);
    setTo(r.to);
  };

  return (
    <>
      <PageHeader
        title="Caja"
        description="Dinero recaudado por método de pago según las facturas ejecutadas."
      />
      <div className="space-y-6 p-6">
        <Card className="shadow-card">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">Desde</Label>
              <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">Hasta</Label>
              <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" size="sm" onClick={resetRange}>Últimos 30 días</Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.key} className="overflow-hidden shadow-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                    <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{fmtMoney(data?.totals[c.key] ?? 0)}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground ${c.accent}`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Total disponible (Efectivo + Nequi + Daviplata): {fmtMoney(totalReal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              El método <b>Regalo</b> no representa dinero recibido y se excluye del total disponible.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : (data?.rows ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Sin pagos en el rango seleccionado.</TableCell></TableRow>
                ) : (
                  (data?.rows ?? []).map((p: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{new Date(p.paid_at).toLocaleString("es-CO")}</TableCell>
                      <TableCell className="font-medium">{p.invoices?.customers?.name ?? "—"}</TableCell>
                      <TableCell>{METHOD_LABELS[p.method] ?? p.method}</TableCell>
                      <TableCell className="text-right">{fmtMoney(Number(p.amount))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
