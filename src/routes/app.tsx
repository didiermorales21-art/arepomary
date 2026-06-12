import { createFileRoute, Outlet, Navigate, useRouter, useRouterState, Link } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, ShieldOff } from "lucide-react";
import { canAccessPath } from "@/lib/rbac";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function BackButton() {
  const router = useRouter();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const atRoot = pathname === "/app" || pathname === "/app/";

  if (atRoot) {
    return (
      <Button asChild variant="ghost" size="sm" className="gap-1.5">
        <Link to="/">
          <Home className="h-4 w-4" /> Inicio
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={() => {
        if (window.history.length > 1) router.history.back();
        else router.navigate({ to: "/app" });
      }}
    >
      <ArrowLeft className="h-4 w-4" /> Atrás
    </Button>
  );
}

function NoAccess() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-10 text-center">
      <ShieldOff className="h-10 w-10 text-muted-foreground" />
      <h2 className="font-display text-xl font-semibold">Sin acceso a este módulo</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Tu perfil no tiene permisos para abrir esta sección. Si crees que es un error, contacta a un administrador.
      </p>
      <Button asChild variant="outline">
        <Link to="/app"><Home className="mr-1 h-4 w-4" /> Volver al inicio</Link>
      </Button>
    </div>
  );
}

function AppLayout() {
  const { user, loading, roles } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const allowed = canAccessPath(pathname, roles);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <BackButton />
            <div className="ml-auto text-sm text-muted-foreground">Arepomary ERP</div>
          </header>
          <div className="flex-1">
            {allowed ? <Outlet /> : <NoAccess />}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}


