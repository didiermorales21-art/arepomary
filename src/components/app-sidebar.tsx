import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  MapPin,
  Wheat,
  Boxes,
  Truck,
  BarChart3,
  Settings,
  LogOut,
  ClipboardList,
  Warehouse,
  ArrowLeftRight,
  ShieldCheck,
  UserCog,
  Receipt,
  Wallet,
  FileText,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const navMain = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Clientes", url: "/app/customers", icon: Users },
  { title: "Productos", url: "/app/products", icon: Package },
  { title: "Pedidos", url: "/app/orders", icon: ClipboardList },
  { title: "Ventas", url: "/app/sales", icon: ShoppingCart },
];

const navOps = [
  { title: "Zonas", url: "/app/zones", icon: MapPin, soon: false },
  { title: "Producción", url: "/app/production", icon: Wheat, soon: false },
  { title: "Almacenes", url: "/app/warehouses", icon: Warehouse, soon: false },
  { title: "Inventario", url: "/app/inventory", icon: Boxes, soon: false },
  { title: "Movimientos", url: "/app/movements", icon: ArrowLeftRight, soon: false },
  { title: "Logística", url: "/app/logistics", icon: Truck, soon: false },
];

const navFinance = [
  { title: "Facturas", url: "/app/invoices", icon: Receipt, soon: false },
  { title: "Cuentas por cobrar", url: "/app/receivables", icon: Wallet, soon: false },
  { title: "Proveedores", url: "/app/suppliers", icon: Building2, soon: false },
  { title: "Cuentas por pagar", url: "/app/payables", icon: FileText, soon: false },
  { title: "Reportes", url: "/app/reports", icon: BarChart3, soon: false },
];

const navAdmin = [
  { title: "Analytics", url: "/app/analytics", icon: BarChart3, soon: false },
  { title: "Usuarios", url: "/app/users", icon: UserCog, soon: false },
  { title: "Auditoría", url: "/app/audit", icon: ShieldCheck, soon: false },
  { title: "Configuración", url: "/app/settings", icon: Settings, soon: false },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => pathname === p || (p !== "/app" && pathname.startsWith(p));
  const { signOut, user, roles } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-gold text-gold-foreground font-display font-bold shadow-elegant">
            A
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base font-semibold text-sidebar-foreground">Arepomary</span>
              <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">ERP Suite</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Cadena de suministro</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navOps.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild={!item.soon}
                    isActive={isActive(item.url)}
                    tooltip={item.title + (item.soon ? " (próximamente)" : "")}
                    className={item.soon ? "opacity-50" : ""}
                  >
                    {item.soon ? (
                      <div>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </div>
                    ) : (
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navAdmin.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild={!item.soon}
                    isActive={isActive(item.url)}
                    tooltip={item.title + (item.soon ? " (próximamente)" : "")}
                    className={item.soon ? "opacity-50" : ""}
                  >
                    {item.soon ? (
                      <div>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </div>
                    ) : (
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="px-2 py-2">
            <div className="truncate text-xs font-medium text-sidebar-foreground">{user.email}</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {roles.length === 0 ? (
                <span className="text-[10px] text-sidebar-foreground/60">sin rol</span>
              ) : (
                roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sidebar-accent-foreground"
                  >
                    {r}
                  </span>
                ))
              )}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
