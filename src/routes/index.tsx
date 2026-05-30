import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, ShoppingBag, Truck, Wheat, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: Landing,
});

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

function Landing() {
  const { user, loading } = useAuth();

  const { data: products } = useQuery({
    queryKey: ["public-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, description, price, unit, image_url")
        .eq("active", true)
        .order("name")
        .limit(8);
      return data ?? [];
    },
  });

  if (!loading && user) return <Navigate to="/app" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-gold text-gold-foreground font-display font-bold shadow-elegant">
              A
            </div>
            <div>
              <div className="font-display text-lg font-semibold leading-none">Arepomary</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Arepas artesanales</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">
                <LogIn className="mr-1 h-4 w-4" /> Ingresar
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/signup">
                <UserPlus className="mr-1 h-4 w-4" /> Registrarse
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-primary shadow-elegant">
              <Link to="/order">
                <ShoppingBag className="mr-1 h-4 w-4" /> Hacer pedido
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center text-sidebar-foreground">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Tradición y sabor
          </div>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight md:text-6xl">
            Las arepas que tu familia
            <br />
            <span className="bg-gradient-gold bg-clip-text text-transparent">va a amar.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-sidebar-foreground/80">
            Hechas a mano con maíz seleccionado. Pide en minutos y recíbelas frescas en tu casa o negocio.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90 shadow-elegant">
              <Link to="/order">
                Hacer un pedido <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 text-sidebar-foreground hover:bg-white/10"
            >
              <Link to="/signup">Crear cuenta</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold">Nuestros productos</h2>
            <p className="text-sm text-muted-foreground">Selecciona y arma tu pedido en segundos.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/order">Ver todo</Link>
          </Button>
        </div>
        {(products ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Pronto publicaremos nuestro catálogo.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(products ?? []).map((p) => (
              <Card key={p.id} className="overflow-hidden shadow-card transition hover:-translate-y-0.5 hover:shadow-elegant">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-gradient-primary text-primary-foreground">
                    <Wheat className="h-10 w-10 opacity-80" />
                  </div>
                )}
                <CardContent className="p-5">
                  <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <div className="mt-3 flex items-end justify-between">
                    <span className="font-display text-xl font-semibold">{fmt(Number(p.price))}</span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{p.unit}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <Wheat className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display font-semibold">100% artesanal</h3>
              <p className="text-sm text-muted-foreground">Maíz seleccionado y receta tradicional.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Truck className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display font-semibold">Entregamos en tu zona</h3>
              <p className="text-sm text-muted-foreground">Llevamos directamente a tu barrio.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShoppingBag className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display font-semibold">Pide sin registrarte</h3>
              <p className="text-sm text-muted-foreground">Tu primer pedido en menos de 1 minuto.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Arepomary — Hecho con amor.
      </footer>
    </div>
  );
}
