import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogOut, Package, ShoppingCart, Wallet, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal")({
  component: CustomerPortal,
});

function CustomerPortal() {
  const { user, loading, signOut } = useAuth();
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [changing, setChanging] = useState(false);

  const { data: customer } = useQuery({
    queryKey: ["portal-customer", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, neighborhoods(name, zones(name))")
        .eq("portal_user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["portal-orders", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, delivery_date, created_at")
        .eq("customer_id", customer!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sales } = useQuery({
    queryKey: ["portal-sales", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, status, total, paid, balance, created_at")
        .eq("customer_id", customer!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setChanging(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setChanging(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contraseña actualizada");
    setNewPwd("");
    setConfirmPwd("");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const money = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const balance = (sales ?? []).reduce((a, s) => a + Number(s.balance ?? 0), 0);
  const totalSpent = (sales ?? []).reduce((a, s) => a + Number(s.total ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/"><ArrowLeft className="h-4 w-4" /> Inicio</Link>
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="rounded-2xl border bg-gradient-primary p-8 text-primary-foreground shadow-elegant">
          <p className="text-xs uppercase tracking-widest opacity-80">Portal del cliente</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            {customer?.name ?? "Bienvenido"}
          </h1>
          {!customer && (
            <p className="mt-2 text-sm opacity-90">
              Tu cuenta aún no está vinculada con un cliente. Solicita a tu asesor de Arepomary que asocie tu correo a tu ficha.
            </p>
          )}
        </div>

        {customer && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Pedidos</p>
                      <p className="font-display text-2xl font-semibold">{(orders ?? []).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/20 text-gold-foreground">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Total comprado</p>
                      <p className="font-display text-2xl font-semibold">{money(totalSpent)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Saldo pendiente</p>
                      <p className="font-display text-2xl font-semibold">{money(balance)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-card">
              <CardHeader><CardTitle className="font-display text-base">Mis pedidos</CardTitle></CardHeader>
              <CardContent className="p-0">
                {(orders ?? []).length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Aún no tienes pedidos.</p>
                ) : (
                  <div className="divide-y">
                    {(orders ?? []).map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">Pedido #{o.order_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString("es-CO")}
                            {o.delivery_date && ` · Entrega ${o.delivery_date}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{o.status}</Badge>
                          <span className="font-display font-semibold">{money(Number(o.total))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader><CardTitle className="font-display text-base">Mis facturas</CardTitle></CardHeader>
              <CardContent className="p-0">
                {(sales ?? []).length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Aún no tienes facturas.</p>
                ) : (
                  <div className="divide-y">
                    {(sales ?? []).map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">Factura #{s.sale_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString("es-CO")} · Saldo {money(Number(s.balance ?? 0))}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={s.status === "paid" ? "default" : "secondary"}>{s.status}</Badge>
                          <span className="font-display font-semibold">{money(Number(s.total))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <KeyRound className="h-4 w-4" /> Cambiar contraseña
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onChangePassword} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newpwd">Nueva contraseña</Label>
                <Input
                  id="newpwd"
                  type="password"
                  minLength={6}
                  required
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmpwd">Confirmar contraseña</Label>
                <Input
                  id="confirmpwd"
                  type="password"
                  minLength={6}
                  required
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={changing} className="bg-gradient-primary">
                  {changing ? "Actualizando…" : "Actualizar contraseña"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
