import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Boxes, ShoppingCart, Truck, Users, Wheat } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  { icon: Users, title: "CRM", desc: "Clientes, zonas y vendedores con asignación clara." },
  { icon: ShoppingCart, title: "Ventas", desc: "Cotiza, factura, registra pagos y mide cartera." },
  { icon: Wheat, title: "Producción", desc: "Lotes, recetas, consumos y costo unitario." },
  { icon: Boxes, title: "Inventario", desc: "Kardex, alertas de stock y movimientos." },
  { icon: Truck, title: "Logística", desc: "Rutas, hojas de entrega y trazabilidad." },
  { icon: BarChart3, title: "Analítica", desc: "Dashboards ejecutivos y operativos." },
];

function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/app" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-gold text-gold-foreground font-display font-bold shadow-elegant">
              A
            </div>
            <div>
              <div className="font-display text-lg font-semibold leading-none">Arepomary</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">ERP Suite</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/login">Ingresar</Link>
            </Button>
            <Button asChild className="bg-gradient-primary shadow-elegant">
              <Link to="/signup">Crear cuenta</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center text-sidebar-foreground">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Plataforma operativa
          </div>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight md:text-6xl">
            La operación de Arepomary,
            <br />
            <span className="bg-gradient-gold bg-clip-text text-transparent">unificada y en tiempo real.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-sidebar-foreground/80">
            CRM, ventas, producción, inventario y logística — en una sola plataforma diseñada para una empresa de
            alimentos en crecimiento.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90 shadow-elegant">
              <Link to="/signup">
                Empezar <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 text-sidebar-foreground hover:bg-white/10">
              <Link to="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Arepomary — ERP interno.
      </footer>
    </div>
  );
}
